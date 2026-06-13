-- Phase 2 (deslop audit) — Q8: clean up a deleted user's storage objects.
--
-- delete_user_account() wiped 8 tables + auth.users but left avatar/plan images
-- publicly served forever (right-to-erasure gap + accruing storage cost). Add a
-- delete of the user's objects in the avatars bucket (new uid/ folder paths AND
-- legacy flat names).
--
-- LIMITATION: deleting storage.objects rows removes the tracking/listing but does
-- NOT itself reclaim the underlying S3 bytes — full physical erasure needs a
-- service-role storage.remove() call. Tracked as a follow-up edge function in
-- TODO.md. This is the best that's safely doable from SQL.
--
-- Body is otherwise the live definition (search_path kept: needs auth for
-- auth.users; storage.objects is schema-qualified).
CREATE OR REPLACE FUNCTION public.delete_user_account()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth', 'pg_temp'
AS $function$
DECLARE
  user_id_to_delete uuid;
BEGIN
  user_id_to_delete := auth.uid();

  IF user_id_to_delete IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  DELETE FROM messages WHERE user_id = user_id_to_delete;
  DELETE FROM conversation_participants WHERE user_id = user_id_to_delete;
  DELETE FROM attendance WHERE user_id = user_id_to_delete;
  DELETE FROM events WHERE user_id = user_id_to_delete;
  DELETE FROM friendships
    WHERE requester_id = user_id_to_delete OR addressee_id = user_id_to_delete;
  DELETE FROM blocked_users
    WHERE blocker_id = user_id_to_delete OR blocked_id = user_id_to_delete;
  DELETE FROM visits WHERE user_id = user_id_to_delete;

  -- Remove the user's images from the avatars bucket (new folder paths + legacy flat names).
  DELETE FROM storage.objects
  WHERE bucket_id = 'avatars'
    AND (
      (storage.foldername(name))[1] = user_id_to_delete::text
      OR name LIKE user_id_to_delete::text || '-%'
      OR name LIKE 'plan-%-' || user_id_to_delete::text || '.jpg'
    );

  DELETE FROM profiles WHERE id = user_id_to_delete;
  DELETE FROM auth.users WHERE id = user_id_to_delete;

  RETURN jsonb_build_object('success', true, 'user_id', user_id_to_delete);
END;
$function$;
