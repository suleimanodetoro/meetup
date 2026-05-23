-- Migration: Fix DM conversation creation ambiguous column error
-- Issue: "column reference 'conversation_id' is ambiguous" in ON CONFLICT clause
-- Solution: Create new function with renamed output columns and no ON CONFLICT

-- Drop old broken function
DROP FUNCTION IF EXISTS public.get_or_create_dm_conversation_enhanced(uuid, uuid);

-- Create fixed version with renamed output columns to avoid any ambiguity
CREATE OR REPLACE FUNCTION public.get_or_create_dm_conversation_v3(
  sender_id uuid, 
  recipient_id uuid
)
RETURNS TABLE(
  conv_id_out bigint,  -- Renamed to avoid ambiguity
  is_new_out boolean, 
  can_msg_out boolean, 
  block_msg_out text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_conv_id bigint;
  v_is_new boolean := false;
  v_privacy text;
BEGIN
  -- Validate caller is the sender
  IF auth.uid() IS DISTINCT FROM sender_id THEN
    RAISE EXCEPTION 'sender_id must equal auth.uid()';
  END IF;
  
  -- Prevent self-messaging
  IF sender_id = recipient_id THEN
    RETURN QUERY SELECT NULL::bigint, false, false, 'Cannot message yourself'::text;
    RETURN;
  END IF;
  
  -- Check if users have blocked each other
  IF EXISTS (
    SELECT 1 FROM public.blocked_users 
    WHERE (blocker_id = recipient_id AND blocked_id = sender_id)
       OR (blocker_id = sender_id AND blocked_id = recipient_id)
  ) THEN
    RETURN QUERY SELECT NULL::bigint, false, false, 'User is blocked'::text;
    RETURN;
  END IF;
  
  -- Check recipient's privacy settings
  SELECT COALESCE(message_privacy, 'everyone')
  INTO v_privacy
  FROM public.user_privacy_settings
  WHERE user_id = recipient_id;
  
  -- Enforce privacy settings
  IF v_privacy = 'nobody' THEN
    RETURN QUERY SELECT NULL::bigint, false, false, 'User has disabled messaging'::text;
    RETURN;
  ELSIF v_privacy = 'friends_only' THEN
    -- Check if they are friends
    IF NOT EXISTS (
      SELECT 1 FROM public.friendships
      WHERE status = 'accepted'
      AND ((requester_id = sender_id AND addressee_id = recipient_id)
        OR (requester_id = recipient_id AND addressee_id = sender_id))
    ) THEN
      RETURN QUERY SELECT NULL::bigint, false, false, 'Add as friend to message'::text;
      RETURN;
    END IF;
  END IF;
  
  -- Find existing DM conversation between these users
  SELECT c.id INTO v_conv_id
  FROM public.conversations c
  WHERE c.type = 'dm'
    AND EXISTS (
      SELECT 1 FROM public.conversation_participants cp1
      WHERE cp1.conversation_id = c.id AND cp1.user_id = sender_id
    )
    AND EXISTS (
      SELECT 1 FROM public.conversation_participants cp2
      WHERE cp2.conversation_id = c.id AND cp2.user_id = recipient_id
    )
  LIMIT 1;
  
  -- Create new conversation if it doesn't exist
  IF v_conv_id IS NULL THEN
    -- Create the conversation
    INSERT INTO public.conversations (type, created_at)
    VALUES ('dm', NOW())
    RETURNING id INTO v_conv_id;
    
    -- Add sender as participant (handle duplicate gracefully)
    BEGIN
      INSERT INTO public.conversation_participants (conversation_id, user_id, joined_at)
      VALUES (v_conv_id, sender_id, NOW());
    EXCEPTION WHEN unique_violation THEN
      -- Participant already exists, ignore
      NULL;
    END;
    
    -- Add recipient as participant (handle duplicate gracefully)
    BEGIN
      INSERT INTO public.conversation_participants (conversation_id, user_id, joined_at)
      VALUES (v_conv_id, recipient_id, NOW());
    EXCEPTION WHEN unique_violation THEN
      -- Participant already exists, ignore
      NULL;
    END;
    
    v_is_new := true;
    
    RAISE NOTICE 'Created new DM conversation % between % and %', v_conv_id, sender_id, recipient_id;
  END IF;
  
  -- Return results with renamed columns to match table definition
  RETURN QUERY 
  SELECT v_conv_id, v_is_new, true, NULL::text;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.get_or_create_dm_conversation_v3(uuid, uuid) TO authenticated;

-- Add documentation
COMMENT ON FUNCTION public.get_or_create_dm_conversation_v3(uuid, uuid) IS 
'Creates or retrieves a DM conversation between two users with privacy and block checks.
Returns conv_id_out, is_new_out, can_msg_out, and block_msg_out.
Fixed version that avoids ambiguous column reference errors.';