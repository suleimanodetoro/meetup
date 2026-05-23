-- Migration: Fix delete_user_account function (auth.uid() access)
-- This fixes the "Not authenticated" error by adding auth schema to search_path

DROP FUNCTION IF EXISTS public.delete_user_account();

CREATE OR REPLACE FUNCTION public.delete_user_account()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp  -- FIXED: Added auth schema
AS $$
DECLARE
  user_id_to_delete uuid;
  deleted_counts jsonb := '{}';
  v_count integer;
BEGIN
  -- Get the current user's ID
  user_id_to_delete := auth.uid();
  
  -- Check if user is authenticated
  IF user_id_to_delete IS NULL THEN
    RAISE EXCEPTION 'Not authenticated - auth.uid() returned NULL';
  END IF;

  RAISE NOTICE 'Starting deletion for user: %', user_id_to_delete;

  -- Delete user data in the correct order (due to foreign key constraints)
  
  -- 1. Delete typing indicators (if table exists)
  BEGIN
    DELETE FROM typing_indicators WHERE user_id = user_id_to_delete;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    deleted_counts := jsonb_set(deleted_counts, '{typing_indicators}', to_jsonb(v_count));
    RAISE NOTICE 'Deleted % typing indicators', v_count;
  EXCEPTION WHEN undefined_table THEN
    RAISE NOTICE 'Skipping typing_indicators - table does not exist';
  END;
  
  -- 2. Delete message read receipts (if table exists)
  BEGIN
    DELETE FROM message_read_receipts WHERE user_id = user_id_to_delete;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    deleted_counts := jsonb_set(deleted_counts, '{message_read_receipts}', to_jsonb(v_count));
    RAISE NOTICE 'Deleted % message read receipts', v_count;
  EXCEPTION WHEN undefined_table THEN
    RAISE NOTICE 'Skipping message_read_receipts - table does not exist';
  END;
  
  -- 3. Delete messages
  DELETE FROM messages WHERE user_id = user_id_to_delete;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  deleted_counts := jsonb_set(deleted_counts, '{messages}', to_jsonb(v_count));
  RAISE NOTICE 'Deleted % messages', v_count;
  
  -- 4. Delete conversation participants (if table exists)
  BEGIN
    DELETE FROM conversation_participants WHERE user_id = user_id_to_delete;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    deleted_counts := jsonb_set(deleted_counts, '{conversation_participants}', to_jsonb(v_count));
    RAISE NOTICE 'Deleted % conversation participants', v_count;
  EXCEPTION WHEN undefined_table THEN
    RAISE NOTICE 'Skipping conversation_participants - table does not exist';
  END;
  
  -- 5. Delete orphaned DM conversations (if table exists)
  BEGIN
    DELETE FROM conversations 
    WHERE type = 'dm' 
    AND NOT EXISTS (
      SELECT 1 FROM conversation_participants 
      WHERE conversation_participants.conversation_id = conversations.id
    );
    GET DIAGNOSTICS v_count = ROW_COUNT;
    deleted_counts := jsonb_set(deleted_counts, '{orphaned_conversations}', to_jsonb(v_count));
    RAISE NOTICE 'Deleted % orphaned conversations', v_count;
  EXCEPTION WHEN undefined_table THEN
    RAISE NOTICE 'Skipping conversations - table does not exist';
  END;
  
  -- 6. Delete user privacy settings (if table exists)
  BEGIN
    DELETE FROM user_privacy_settings WHERE user_id = user_id_to_delete;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    deleted_counts := jsonb_set(deleted_counts, '{privacy_settings}', to_jsonb(v_count));
    RAISE NOTICE 'Deleted % privacy settings', v_count;
  EXCEPTION WHEN undefined_table THEN
    RAISE NOTICE 'Skipping user_privacy_settings - table does not exist';
  END;
  
  -- 7. Delete attendance records
  DELETE FROM attendance WHERE user_id = user_id_to_delete;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  deleted_counts := jsonb_set(deleted_counts, '{attendance}', to_jsonb(v_count));
  RAISE NOTICE 'Deleted % attendance records', v_count;
  
  -- 8. Delete events created by user (will cascade to group conversations)
  DELETE FROM events WHERE creator_id = user_id_to_delete;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  deleted_counts := jsonb_set(deleted_counts, '{events}', to_jsonb(v_count));
  RAISE NOTICE 'Deleted % events', v_count;
  
  -- 9. Delete friendships (if table exists)
  BEGIN
    DELETE FROM friendships 
    WHERE requester_id = user_id_to_delete OR addressee_id = user_id_to_delete;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    deleted_counts := jsonb_set(deleted_counts, '{friendships}', to_jsonb(v_count));
    RAISE NOTICE 'Deleted % friendships', v_count;
  EXCEPTION WHEN undefined_table THEN
    RAISE NOTICE 'Skipping friendships - table does not exist';
  END;
  
  -- 10. Delete blocked users (if table exists)
  BEGIN
    DELETE FROM blocked_users 
    WHERE blocker_id = user_id_to_delete OR blocked_id = user_id_to_delete;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    deleted_counts := jsonb_set(deleted_counts, '{blocked_users}', to_jsonb(v_count));
    RAISE NOTICE 'Deleted % blocked users', v_count;
  EXCEPTION WHEN undefined_table THEN
    RAISE NOTICE 'Skipping blocked_users - table does not exist';
  END;
  
  -- 11. Delete visits
  DELETE FROM visits WHERE user_id = user_id_to_delete;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  deleted_counts := jsonb_set(deleted_counts, '{visits}', to_jsonb(v_count));
  RAISE NOTICE 'Deleted % visits', v_count;
  
  -- 12. Delete profile (this should cascade to other tables with ON DELETE CASCADE)
  DELETE FROM profiles WHERE id = user_id_to_delete;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  deleted_counts := jsonb_set(deleted_counts, '{profiles}', to_jsonb(v_count));
  RAISE NOTICE 'Deleted % profiles', v_count;
  
  -- 13. Delete the auth user (this will cascade to profiles if not already deleted)
  DELETE FROM auth.users WHERE id = user_id_to_delete;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  deleted_counts := jsonb_set(deleted_counts, '{auth_users}', to_jsonb(v_count));
  RAISE NOTICE 'Deleted % auth users', v_count;
  
  RAISE NOTICE 'Account deletion completed successfully for user: %', user_id_to_delete;
  RAISE NOTICE 'Deletion summary: %', deleted_counts;
  
  RETURN deleted_counts;
  
EXCEPTION WHEN OTHERS THEN
  RAISE EXCEPTION 'Error deleting account: % (SQLSTATE: %)', SQLERRM, SQLSTATE;
END;
$$;

-- Grant execute permission to authenticated users only
GRANT EXECUTE ON FUNCTION public.delete_user_account() TO authenticated;

-- Revoke from others for security
REVOKE EXECUTE ON FUNCTION public.delete_user_account() FROM anon;
REVOKE EXECUTE ON FUNCTION public.delete_user_account() FROM public;

-- Add comment for documentation
COMMENT ON FUNCTION public.delete_user_account() IS 
'Allows authenticated users to delete their own account and all associated data. Returns deletion counts for debugging. This operation cannot be undone.';

-- Verify the function was created successfully
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc 
    WHERE proname = 'delete_user_account'
    AND pronamespace = 'public'::regnamespace
  ) THEN
    RAISE NOTICE '✅ Function delete_user_account created/updated successfully';
  ELSE
    RAISE EXCEPTION '❌ Function delete_user_account was not created';
  END IF;
END $$;