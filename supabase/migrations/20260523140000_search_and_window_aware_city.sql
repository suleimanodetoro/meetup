-- 20260523140000_search_and_window_aware_city.sql
--
-- Adds the search-by-city + date-range city overview API. Four new RPCs:
--
--   search_cities(query, max_results)
--     Typeahead source for the home search bar. Returns cities present in
--     the app's data (events.city + visits.city), case-insensitive prefix-
--     or-substring match, ranked by activity count. We deliberately do not
--     hit Mapbox for this — search universe is "cities your app knows
--     about", not "every city on earth."
--
--   get_city_meta_window(city, from, to)
--     City detail header: resolved city/country/code + total counts of
--     ranked users and plans for the requested window. One row.
--
--   get_city_users_ranked(city, from, to, limit, offset)
--     Paginated user list, ranked by date overlap with [from, to]. Each
--     user collapses across visits + event hosts + event attendees to one
--     MIN-start / MAX-end "presence window." Score = 1000 (overlaps the
--     requested window) / 500 (arrives within 14 days after) / 300 (left
--     within 14 days before) / 100 (far future) / 50 (far past). Past
--     entries older than CURRENT_DATE - 14 days are filtered upstream.
--
--   get_city_plans_ranked(city, from, to, limit, offset)
--     Paginated plan (event) list, same scoring rubric keyed on event
--     date. Tiebreak by attendee_count desc, then date asc.
--
-- The old get_city_overview(text) is intentionally NOT dropped here — the
-- existing useCityOverview hook still calls it. A follow-up migration
-- will drop it once the hook switches over.

------------------------------------------------------------
-- 1) search_cities
------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.search_cities(
  query text,
  max_results int DEFAULT 8
)
RETURNS TABLE(
  city text,
  country text,
  country_code text,
  activity_count bigint
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  q text := LOWER(TRIM(COALESCE(query, '')));
  earliest_cutoff date := CURRENT_DATE - INTERVAL '14 days';
BEGIN
  RETURN QUERY
  WITH all_cities AS (
    SELECT e.city, e.country, e.country_code
    FROM public.events e
    WHERE e.date >= earliest_cutoff
      AND e.city IS NOT NULL
      AND LENGTH(TRIM(e.city)) > 0
    UNION ALL
    SELECT v.city, v.country, v.country_code
    FROM public.visits v
    WHERE v.end_date >= earliest_cutoff
      AND v.city IS NOT NULL
      AND LENGTH(TRIM(v.city)) > 0
  ),
  grouped AS (
    SELECT
      LOWER(TRIM(ac.city)) AS city_key,
      MAX(ac.city)         AS resolved_city,
      MAX(ac.country)      AS resolved_country,
      MAX(ac.country_code) AS resolved_country_code,
      COUNT(*)             AS activity_count
    FROM all_cities ac
    WHERE q = '' OR LOWER(TRIM(ac.city)) LIKE '%' || q || '%'
    GROUP BY LOWER(TRIM(ac.city))
  )
  SELECT
    g.resolved_city,
    g.resolved_country,
    g.resolved_country_code,
    g.activity_count
  FROM grouped g
  ORDER BY g.activity_count DESC, g.resolved_city ASC
  LIMIT max_results;
END;
$$;

GRANT EXECUTE ON FUNCTION public.search_cities(text, int) TO authenticated;

------------------------------------------------------------
-- 2) get_city_meta_window
------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_city_meta_window(
  city_name text,
  window_from date DEFAULT NULL,
  window_to date DEFAULT NULL
)
RETURNS TABLE(
  city text,
  country text,
  country_code text,
  user_count bigint,
  plan_count bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  city_lower      text := LOWER(TRIM(city_name));
  earliest_cutoff date := CURRENT_DATE - INTERVAL '14 days';
BEGIN
  RETURN QUERY
  WITH city_visitors AS (
    SELECT v.user_id
    FROM public.visits v
    WHERE LOWER(TRIM(v.city)) = city_lower
      AND v.end_date >= earliest_cutoff
  ),
  city_event_hosts AS (
    SELECT DISTINCT e.user_id
    FROM public.events e
    WHERE LOWER(TRIM(e.city)) = city_lower
      AND e.date >= earliest_cutoff
      AND e.user_id IS NOT NULL
  ),
  city_event_attendees AS (
    SELECT DISTINCT a.user_id
    FROM public.attendance a
    JOIN public.events e ON e.id = a.event_id
    WHERE LOWER(TRIM(e.city)) = city_lower
      AND e.date >= earliest_cutoff
  ),
  deduped AS (
    SELECT user_id FROM city_visitors
    UNION
    SELECT user_id FROM city_event_hosts
    UNION
    SELECT user_id FROM city_event_attendees
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
    (SELECT COUNT(*) FROM deduped)::bigint,
    (SELECT COUNT(*) FROM public.events e
       WHERE LOWER(TRIM(e.city)) = city_lower
         AND e.date >= earliest_cutoff)::bigint
  FROM city_meta m;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_city_meta_window(text, date, date) TO authenticated;

------------------------------------------------------------
-- 3) get_city_users_ranked
------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_city_users_ranked(
  city_name text,
  window_from date DEFAULT NULL,
  window_to date DEFAULT NULL,
  page_limit int DEFAULT 20,
  page_offset int DEFAULT 0
)
RETURNS TABLE(
  user_id uuid,
  full_name text,
  avatar_url text,
  bio text,
  nationality_code text,
  is_verified boolean,
  visit_start date,
  visit_end date,
  match_score int
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  city_lower      text := LOWER(TRIM(city_name));
  effective_from  date := COALESCE(window_from, CURRENT_DATE);
  effective_to    date := COALESCE(window_to,   (CURRENT_DATE + INTERVAL '90 days')::date);
  earliest_cutoff date := CURRENT_DATE - INTERVAL '14 days';
BEGIN
  RETURN QUERY
  WITH city_visitors AS (
    SELECT v.user_id, v.start_date, v.end_date
    FROM public.visits v
    WHERE LOWER(TRIM(v.city)) = city_lower
      AND v.end_date >= earliest_cutoff
  ),
  city_event_hosts AS (
    SELECT DISTINCT
      e.user_id,
      e.date::date AS start_date,
      COALESCE(e.end_date, e.date)::date AS end_date
    FROM public.events e
    WHERE LOWER(TRIM(e.city)) = city_lower
      AND e.date >= earliest_cutoff
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
      AND e.date >= earliest_cutoff
  ),
  all_city_users AS (
    SELECT * FROM city_visitors
    UNION ALL SELECT * FROM city_event_hosts
    UNION ALL SELECT * FROM city_event_attendees
  ),
  deduped AS (
    SELECT
      u.user_id,
      MIN(u.start_date) AS s,
      MAX(u.end_date)   AS e
    FROM all_city_users u
    GROUP BY u.user_id
  ),
  scored AS (
    SELECT
      d.user_id,
      d.s,
      d.e,
      CASE
        WHEN daterange(d.s, d.e, '[]') && daterange(effective_from, effective_to, '[]') THEN 1000
        WHEN d.s > effective_to AND d.s <= effective_to + 14 THEN 500
        WHEN d.e < effective_from AND d.e >= effective_from - 14 THEN 300
        WHEN d.s > effective_to + 14 THEN 100
        ELSE 50
      END AS match_score
    FROM deduped d
  )
  SELECT
    s.user_id,
    p.full_name,
    p.avatar_url,
    p.bio,
    p.nationality_code,
    COALESCE(p.onboarding_completed, false) AS is_verified,
    s.s AS visit_start,
    s.e AS visit_end,
    s.match_score
  FROM scored s
  JOIN public.profiles p ON p.id = s.user_id
  ORDER BY s.match_score DESC, s.s ASC
  LIMIT page_limit OFFSET page_offset;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_city_users_ranked(text, date, date, int, int) TO authenticated;

------------------------------------------------------------
-- 4) get_city_plans_ranked
------------------------------------------------------------
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
      e.id,
      e.title,
      e.description,
      e.image_uri,
      e.date,
      e.end_date,
      e.location_name,
      e.cost,
      e.cost_currency,
      e.user_id AS host_id,
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
    s.id            AS event_id,
    s.title,
    s.description,
    s.image_uri,
    s.date,
    s.end_date,
    s.location_name,
    s.cost,
    s.cost_currency,
    s.attendee_count,
    host.full_name  AS host_name,
    host.avatar_url AS host_avatar,
    s.match_score
  FROM scored s
  LEFT JOIN public.profiles host ON host.id = s.host_id
  ORDER BY s.match_score DESC, s.date ASC, s.attendee_count DESC
  LIMIT page_limit OFFSET page_offset;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_city_plans_ranked(text, date, date, int, int) TO authenticated;

DO $$
BEGIN
  RAISE NOTICE 'Added: search_cities, get_city_meta_window, get_city_users_ranked, get_city_plans_ranked.';
END $$;
