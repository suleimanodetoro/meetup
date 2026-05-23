-- 20260523120100_drop_visit_id_rpcs.sql
--
-- The visit-id-keyed city detail RPCs are no longer referenced by the
-- app (see 20260523120000_city_overview.sql + the commit that switched
-- the trending cards and event-detail city tap over to /city/[name]).
-- Dropping them so the function namespace doesn't carry dead code
-- forward into future schema dumps.

DROP FUNCTION IF EXISTS public.get_visit_details(bigint);
DROP FUNCTION IF EXISTS public.get_visit_users(bigint, int);
DROP FUNCTION IF EXISTS public.get_visit_plans(bigint);

DO $$
BEGIN
  RAISE NOTICE 'Dropped: get_visit_details / get_visit_users / get_visit_plans (replaced by get_city_overview).';
END $$;
