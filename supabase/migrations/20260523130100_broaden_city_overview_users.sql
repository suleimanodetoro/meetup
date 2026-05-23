-- 20260523130100_broaden_city_overview_users.sql
--
-- The original get_city_overview only counted someone as "in this city"
-- if they had a row in public.visits. That misses two obvious sources:
-- people hosting upcoming events here, and people attending upcoming
-- events here. London, with 14 upcoming events and ~38 RSVPs but only
-- one (expired) visit row, rendered as "0 users" — which is wrong by
-- the product's own definition of "someone who's going to be here."
--
-- Fix: UNION visits + event hosts + event attendees, dedupe by user_id,
-- collapse each user to their broadest known window (MIN start, MAX end).
-- visit_start / visit_end JSON keys are preserved so UserCard doesn't
-- need to learn a new shape — they just represent "when this user is
-- expected in the city," irrespective of whether the source was a trip
-- or an event.

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
  WITH city_visitors AS (
    SELECT
      v.user_id,
      v.start_date,
      v.end_date
    FROM public.visits v
    WHERE LOWER(TRIM(v.city)) = city_lower
      AND v.end_date >= CURRENT_DATE
  ),
  city_event_hosts AS (
    SELECT DISTINCT
      e.user_id,
      e.date::date AS start_date,
      COALESCE(e.end_date, e.date)::date AS end_date
    FROM public.events e
    WHERE LOWER(TRIM(e.city)) = city_lower
      AND e.date >= CURRENT_DATE
      AND e.user_id IS NOT NULL
  ),
  city_event_attendees AS (
    SELECT DISTINCT
      a.user_id,
      e.date::date AS start_date,
      COALESCE(e.end_date, e.date)::date AS end_date
    FROM public.attendance a
    JOIN public.events e ON e.id = a.event_id
    WHERE LOWER(TRIM(e.city)) = city_lower
      AND e.date >= CURRENT_DATE
  ),
  all_city_users AS (
    SELECT * FROM city_visitors
    UNION ALL
    SELECT * FROM city_event_hosts
    UNION ALL
    SELECT * FROM city_event_attendees
  ),
  deduped_users AS (
    SELECT
      user_id,
      MIN(start_date) AS visit_start,
      MAX(end_date)   AS visit_end
    FROM all_city_users
    GROUP BY user_id
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
    (SELECT COUNT(*) FROM deduped_users)::bigint,
    (SELECT COUNT(*) FROM city_events)::bigint,
    COALESCE(
      (SELECT jsonb_agg(
         jsonb_build_object(
           'user_id', du.user_id,
           'full_name', p.full_name,
           'avatar_url', p.avatar_url,
           'bio', p.bio,
           'nationality_code', p.nationality_code,
           'is_verified', COALESCE(p.onboarding_completed, false),
           'visit_start', du.visit_start,
           'visit_end', du.visit_end
         ) ORDER BY du.visit_start ASC
       )
       FROM deduped_users du
       JOIN public.profiles p ON p.id = du.user_id),
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

DO $$
BEGIN
  RAISE NOTICE 'Updated: get_city_overview now unions visits + event hosts + event attendees.';
END $$;
