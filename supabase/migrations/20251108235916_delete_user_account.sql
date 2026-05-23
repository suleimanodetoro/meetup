-- Migration: Add delete_user_account function
-- This function allows users to delete their own account and all associated data

CREATE OR REPLACE FUNCTION public.delete_user_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_id_to_delete uuid;
BEGIN
  -- Get the current user's ID
  user_id_to_delete := auth.uid();
  
  -- Check if user is authenticated
  IF user_id_to_delete IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Delete user data in the correct order (due to foreign key constraints)
  
  -- 1. Delete messages
  DELETE FROM messages WHERE user_id = user_id_to_delete;
  
  -- 2. Delete conversation participants
  DELETE FROM conversation_participants WHERE user_id = user_id_to_delete;
  
  -- 3. Delete attendance records
  DELETE FROM attendance WHERE user_id = user_id_to_delete;
  
  -- 4. Delete events created by user
  DELETE FROM events WHERE creator_id = user_id_to_delete;
  
  -- 5. Delete friendships
  DELETE FROM friendships 
  WHERE requester_id = user_id_to_delete OR addressee_id = user_id_to_delete;
  
  -- 6. Delete blocked users
  DELETE FROM blocked_users 
  WHERE blocker_id = user_id_to_delete OR blocked_id = user_id_to_delete;
  
  -- 7. Delete visits
  DELETE FROM visits WHERE user_id = user_id_to_delete;
  
  -- 8. Delete profile (this should cascade to other tables with ON DELETE CASCADE)
  DELETE FROM profiles WHERE id = user_id_to_delete;
  
  -- 9. Delete the auth user (this will cascade to profiles if not already deleted)
  DELETE FROM auth.users WHERE id = user_id_to_delete;
  
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.delete_user_account() TO authenticated;

-- Add comment for documentation
COMMENT ON FUNCTION public.delete_user_account() IS 
'Allows authenticated users to delete their own account and all associated data. This operation cannot be undone.';