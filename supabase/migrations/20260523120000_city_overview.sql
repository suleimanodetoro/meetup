-- 20260523120000_city_overview.sql
--
-- Replaces the visit-id-keyed "city detail" RPCs (get_visit_details,
-- get_visit_users, get_visit_plans) with a single city-name-keyed RPC.
--
-- Why:
-- - The old RPCs scoped users + plans to whichever visit_id was passed in.
--   That makes them "matchmaking for a specific trip," not "everything
--   happening in this city."
-- - Different entry points to the same city (trending card, event-detail
--   city tap) picked different visit_ids, so the same city rendered
--   different result sets depending on how you got there.
-- - Cities with zero current visits couldn't render at all — there was
--   no visit_id to key on.
--
-- This RPC returns one row with five columns (city/country/country_code,
-- counts, users jsonb, plans jsonb). One round trip; identical product
-- experience regardless of how the user navigated to the city.

CREATE OR REPLACE FUNCTION public.get_city_overview(city_name text)
RETURNS TABLE(
  city text,
  country text,
  country_code text,
  user_count bigint,
  plan_count bigint,
  users jsonb,
  plans jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  city_lower text := LOWER(TRIM(city_name));
BEGIN
  RETURN QUERY
  WITH city_visits AS (
    -- One row per user: their earliest upcoming visit to the city.
    SELECT DISTINCT ON (v.user_id)
      v.user_id,
      v.start_date AS visit_start,
      v.end_date   AS visit_end
    FROM public.visits v
    WHERE LOWER(TRIM(v.city)) = city_lower
      AND v.end_date >= CURRENT_DATE
    ORDER BY v.user_id, v.start_date ASC
  ),
  city_events AS (
    SELECT
      e.id            AS event_id,
      e.title,
      e.description,
      e.image_uri,
      e.date          AS event_date,
      e.end_date      AS event_end_date,
      e.location_name,
      e.cost,
      e.cost_currency,
      e.user_id       AS host_id,
      (SELECT COUNT(*) FROM public.attendance a WHERE a.event_id = e.id) AS attendee_count
    FROM public.events e
    WHERE LOWER(TRIM(e.city)) = city_lower
      AND e.date >= CURRENT_DATE
  ),
  city_meta AS (
    -- Canonical city/country/code from whichever table has a row.
    -- Falls through to the input string if neither does.
    SELECT
      COALESCE(
        (SELECT v.city FROM public.visits v WHERE LOWER(TRIM(v.city)) = city_lower LIMIT 1),
        (SELECT e.city FROM public.events e WHERE LOWER(TRIM(e.city)) = city_lower LIMIT 1),
        TRIM(city_name)
      ) AS resolved_city,
      COALESCE(
        (SELECT v.country FROM public.visits v WHERE LOWER(TRIM(v.city)) = city_lower LIMIT 1),
        (SELECT e.country FROM public.events e WHERE LOWER(TRIM(e.city)) = city_lower LIMIT 1)
      ) AS resolved_country,
      COALESCE(
        (SELECT v.country_code FROM public.visits v WHERE LOWER(TRIM(v.city)) = city_lower LIMIT 1),
        (SELECT e.country_code FROM public.events e WHERE LOWER(TRIM(e.city)) = city_lower LIMIT 1)
      ) AS resolved_country_code
  )
  SELECT
    m.resolved_city,
    m.resolved_country,
    m.resolved_country_code,
    (SELECT COUNT(*) FROM city_visits)::bigint,
    (SELECT COUNT(*) FROM city_events)::bigint,
    COALESCE(
      (SELECT jsonb_agg(
         jsonb_build_object(
           'user_id', cv.user_id,
           'full_name', p.full_name,
           'avatar_url', p.avatar_url,
           'bio', p.bio,
           'nationality_code', p.nationality_code,
           'is_verified', COALESCE(p.onboarding_completed, false),
           'visit_start', cv.visit_start,
           'visit_end', cv.visit_end
         ) ORDER BY cv.visit_start ASC
       )
       FROM city_visits cv
       JOIN public.profiles p ON p.id = cv.user_id),
      '[]'::jsonb
    ) AS users,
    COALESCE(
      (SELECT jsonb_agg(
         jsonb_build_object(
           'event_id', ce.event_id,
           'title', ce.title,
           'description', ce.description,
           'image_uri', ce.image_uri,
           'date', ce.event_date,
           'end_date', ce.event_end_date,
           'location_name', ce.location_name,
           'cost', ce.cost,
           'cost_currency', ce.cost_currency,
           'attendee_count', ce.attendee_count,
           'host_name', host.full_name,
           'host_avatar', host.avatar_url
         ) ORDER BY ce.event_date ASC
       )
       FROM city_events ce
       LEFT JOIN public.profiles host ON host.id = ce.host_id),
      '[]'::jsonb
    ) AS plans
  FROM city_meta m;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_city_overview(text) TO authenticated;

-- Make case-insensitive city lookups fast on both tables.
CREATE INDEX IF NOT EXISTS idx_visits_city_lower
  ON public.visits ((LOWER(TRIM(city))));
CREATE INDEX IF NOT EXISTS idx_events_city_lower
  ON public.events ((LOWER(TRIM(city))));

DO $$
BEGIN
  RAISE NOTICE 'Added: get_city_overview(text) — city-name-keyed city detail.';
END $$;
