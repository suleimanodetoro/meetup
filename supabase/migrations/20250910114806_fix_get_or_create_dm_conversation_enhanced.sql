-- Migration: Fix ambiguous column reference in get_or_create_dm_conversation_enhanced
-- Date: 2025-09-10
-- Issue: Column reference "conversation_id" was ambiguous in RETURN QUERY
-- Solution: Add explicit column aliases to match the table definition

-- Drop the existing function
DROP FUNCTION IF EXISTS public.get_or_create_dm_conversation_enhanced(uuid, uuid);

-- Recreate the function with the fix
CREATE OR REPLACE FUNCTION public.get_or_create_dm_conversation_enhanced(
  sender_id uuid, 
  recipient_id uuid
)
RETURNS TABLE(
  conversation_id bigint, 
  is_new boolean, 
  can_message boolean, 
  block_reason text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  conv_id bigint;
  is_new_conv boolean := false;
  privacy_setting text;
BEGIN
  -- Validate that caller is the sender
  IF auth.uid() IS DISTINCT FROM sender_id THEN
    RAISE EXCEPTION 'sender_id must equal auth.uid()';
  END IF;
  
  -- Prevent self-messaging
  IF sender_id = recipient_id THEN
    RETURN QUERY SELECT NULL::bigint, false, false, 'Cannot message yourself'::text;
    RETURN;
  END IF;
  
  -- Check if blocked
  IF EXISTS (
    SELECT 1 FROM public.blocked_users 
    WHERE (blocker_id = recipient_id AND blocked_id = sender_id)
       OR (blocker_id = sender_id AND blocked_id = recipient_id)
  ) THEN
    RETURN QUERY SELECT NULL::bigint, false, false, 'User is blocked'::text;
    RETURN;
  END IF;
  
  -- Check privacy settings
  SELECT COALESCE(ups.message_privacy, 'everyone')
  INTO privacy_setting
  FROM public.user_privacy_settings ups
  WHERE ups.user_id = recipient_id;
  
  -- Check if messaging is allowed based on privacy
  IF privacy_setting = 'nobody' THEN
    RETURN QUERY SELECT NULL::bigint, false, false, 'User has disabled messaging'::text;
    RETURN;
  ELSIF privacy_setting = 'friends_only' THEN
    -- Check if they are friends
    IF NOT EXISTS (
      SELECT 1 FROM public.friendships f
      WHERE f.status = 'accepted'
      AND ((f.requester_id = sender_id AND f.addressee_id = recipient_id)
        OR (f.requester_id = recipient_id AND f.addressee_id = sender_id))
    ) THEN
      RETURN QUERY SELECT NULL::bigint, false, false, 'Add as friend to message'::text;
      RETURN;
    END IF;
  END IF;
  
  -- Find existing DM conversation
  SELECT c.id INTO conv_id
  FROM public.conversations c
  WHERE c.type = 'dm'
    AND EXISTS (
      SELECT 1 FROM public.conversation_participants cp 
      WHERE cp.conversation_id = c.id AND cp.user_id = sender_id
    )
    AND EXISTS (
      SELECT 1 FROM public.conversation_participants cp 
      WHERE cp.conversation_id = c.id AND cp.user_id = recipient_id
    )
  LIMIT 1;
  
  -- Create new conversation if it doesn't exist
  IF conv_id IS NULL THEN
    -- Insert conversation
    INSERT INTO public.conversations (type, created_at)
    VALUES ('dm', NOW())
    RETURNING id INTO conv_id;
    
    -- Add both participants
    INSERT INTO public.conversation_participants (conversation_id, user_id, joined_at)
    VALUES 
      (conv_id, sender_id, NOW()),
      (conv_id, recipient_id, NOW())
    ON CONFLICT (conversation_id, user_id) DO NOTHING;
    
    is_new_conv := true;
    
    RAISE NOTICE 'Created new DM conversation % between % and %', conv_id, sender_id, recipient_id;
  END IF;
  
  -- FIXED: Explicitly alias the return values to match table column names
  -- This resolves the "column reference 'conversation_id' is ambiguous" error
  RETURN QUERY 
  SELECT 
    conv_id AS conversation_id,
    is_new_conv AS is_new,
    true AS can_message,
    NULL::text AS block_reason;
END;
$$;

-- Grant necessary permissions (adjust as needed for your setup)
GRANT EXECUTE ON FUNCTION public.get_or_create_dm_conversation_enhanced(uuid, uuid) TO authenticated;

-- Add a comment to document the function
COMMENT ON FUNCTION public.get_or_create_dm_conversation_enhanced(uuid, uuid) IS 
'Creates or retrieves a DM conversation between two users, checking privacy settings and blocks. 
Returns conversation_id, is_new flag, can_message permission, and block_reason if applicable.
Fixed: Resolved ambiguous column reference in RETURN QUERY statement.';