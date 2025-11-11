-- Fix delete_user_account - use correct column names from schema
DROP FUNCTION IF EXISTS public.delete_user_account();

CREATE OR REPLACE FUNCTION public.delete_user_account()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  user_id_to_delete uuid;
BEGIN
  user_id_to_delete := auth.uid();
  
  IF user_id_to_delete IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Delete user data in correct order
  DELETE FROM messages WHERE user_id = user_id_to_delete;
  
  DELETE FROM conversation_participants WHERE user_id = user_id_to_delete;
  
  DELETE FROM attendance WHERE user_id = user_id_to_delete;
  
  -- FIXED: events table uses user_id, NOT creator_id
  DELETE FROM events WHERE user_id = user_id_to_delete;
  
  DELETE FROM friendships 
  WHERE requester_id = user_id_to_delete OR addressee_id = user_id_to_delete;
  
  DELETE FROM blocked_users 
  WHERE blocker_id = user_id_to_delete OR blocked_id = user_id_to_delete;
  
  DELETE FROM visits WHERE user_id = user_id_to_delete;
  
  DELETE FROM profiles WHERE id = user_id_to_delete;
  
  DELETE FROM auth.users WHERE id = user_id_to_delete;
  
  RETURN jsonb_build_object('success', true, 'user_id', user_id_to_delete);
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_user_account() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.delete_user_account() FROM anon;

COMMENT ON FUNCTION public.delete_user_account() IS 
'Allows authenticated users to delete their own account and all associated data.';