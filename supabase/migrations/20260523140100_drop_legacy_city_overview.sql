-- 20260523140100_drop_legacy_city_overview.sql
--
-- get_city_overview(text) is no longer referenced. useCityOverview now
-- calls the three windowed RPCs added in 20260523140000:
--   get_city_meta_window, get_city_users_ranked, get_city_plans_ranked.
-- The pre-window single RPC was bypassing date-range filtering and
-- ranking, and is dead weight in the function namespace.

DROP FUNCTION IF EXISTS public.get_city_overview(text);

DO $$
BEGIN
  RAISE NOTICE 'Dropped: get_city_overview(text) — replaced by windowed RPC trio.';
END $$;
