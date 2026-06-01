-- City user cards should render current-location flags before nationality.

DROP FUNCTION IF EXISTS public.get_city_users_ranked(text, date, date, int, int);
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
  location_country_code text,
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
    p.location_country_code,
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
