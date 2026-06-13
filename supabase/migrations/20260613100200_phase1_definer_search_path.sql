-- Phase 1 (deslop audit) — S9: pin search_path on every SECURITY DEFINER
-- function in `public` that lacks it.
--
-- A SECURITY DEFINER function without a fixed search_path is the classic
-- Postgres privilege-escalation primitive (a caller can prepend a schema and
-- shadow an unqualified object). Most bodies here are schema-qualified, so this
-- is defense-in-depth — but it's cheap and uniform. Done as a catalog-driven
-- loop rather than per-signature ALTERs so it can't break on an overload or a
-- mis-remembered signature, and so any future DEFINER function gets caught on a
-- re-run.
DO $$
DECLARE
  fn record;
BEGIN
  FOR fn IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef                                                   -- SECURITY DEFINER only
      AND COALESCE(array_to_string(p.proconfig, ','), '') NOT LIKE '%search_path%'
  LOOP
    EXECUTE format('ALTER FUNCTION %s SET search_path = public, pg_temp', fn.sig);
    RAISE NOTICE 'Pinned search_path on %', fn.sig;
  END LOOP;
END $$;
