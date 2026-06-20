-- REVERT for 20260620000000_quests_phase1b_engine.sql
-- Drops the two new functions and restores get_city_plans_ranked to its prior
-- definition (pre-harden body from 20260523140000, with search_path pinned as it
-- was after 20260613100200). All-or-nothing.

BEGIN;

DROP FUNCTION IF EXISTS public.complete_quest(bigint, uuid);
DROP FUNCTION IF EXISTS public.suggest_quest(smallint, text, int, smallint, smallint, text[], int);

-- Restore the un-hardened get_city_plans_ranked (no block/visibility/is_private filters).
CREATE OR REPLACE FUNCTION public.get_city_plans_ranked(
  city_name text,
  window_from date DEFAULT NULL,
  window_to date DEFAULT NULL,
  page_limit int DEFAULT 20,
  page_offset int DEFAULT 0
)
RETURNS TABLE(
  event_id bigint,
  title text,
  description text,
  image_uri text,
  date timestamptz,
  end_date timestamptz,
  location_name text,
  cost numeric,
  cost_currency text,
  attendee_count bigint,
  host_name text,
  host_avatar text,
  match_score int
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  city_lower      text := LOWER(TRIM(city_name));
  effective_from  date := COALESCE(window_from, CURRENT_DATE);
  effective_to    date := COALESCE(window_to,   (CURRENT_DATE + INTERVAL '90 days')::date);
  earliest_cutoff date := CURRENT_DATE - INTERVAL '14 days';
BEGIN
  RETURN QUERY
  WITH city_events AS (
    SELECT
      e.id, e.title, e.description, e.image_uri, e.date, e.end_date, e.location_name,
      e.cost, e.cost_currency, e.user_id AS host_id,
      (SELECT COUNT(*) FROM public.attendance a WHERE a.event_id = e.id) AS attendee_count
    FROM public.events e
    WHERE LOWER(TRIM(e.city)) = city_lower
      AND e.date >= earliest_cutoff
  ),
  scored AS (
    SELECT
      ce.*,
      CASE
        WHEN ce.date::date BETWEEN effective_from AND effective_to THEN 1000
        WHEN ce.date::date >  effective_to    AND ce.date::date <= effective_to   + 14 THEN 500
        WHEN ce.date::date <  effective_from  AND ce.date::date >= effective_from - 14 THEN 300
        WHEN ce.date::date >  effective_to + 14 THEN 100
        ELSE 50
      END AS match_score
    FROM city_events ce
  )
  SELECT
    s.id AS event_id, s.title, s.description, s.image_uri, s.date, s.end_date,
    s.location_name, s.cost, s.cost_currency, s.attendee_count,
    host.full_name AS host_name, host.avatar_url AS host_avatar, s.match_score
  FROM scored s
  LEFT JOIN public.profiles host ON host.id = s.host_id
  ORDER BY s.match_score DESC, s.date ASC, s.attendee_count DESC
  LIMIT page_limit OFFSET page_offset;
END;
$$;

-- Keep the anon lockdown even on revert — undoing the hardening must not re-open
-- this SECURITY DEFINER RPC to anon. (get_city_users_ranked stays locked too.)
REVOKE ALL ON FUNCTION public.get_city_plans_ranked(text, date, date, int, int) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.get_city_plans_ranked(text, date, date, int, int) TO authenticated;

COMMIT;
