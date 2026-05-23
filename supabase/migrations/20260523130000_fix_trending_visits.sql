-- 20260523130000_fix_trending_visits.sql
--
-- The old get_trending_visits() grouped by (city, start_date, end_date)
-- and required 2+ users in the same bucket. Two travellers only "trended
-- together" if they typed the exact same date range, which never collides
-- in practice. Result: the home screen's Trending Trips rail rendered
-- empty even with 18 active visits across 5 cities.
--
-- Fix: group by city alone. Two or more travellers active in the same
-- city count as a trend, regardless of whether their date ranges match
-- exactly. The card now shows the broadest window (earliest start to
-- latest end) so the user can see "people will be here from X to Y."

CREATE OR REPLACE FUNCTION public.get_trending_visits()
RETURNS TABLE(
  id bigint,
  city text,
  country text,
  country_code text,
  start_date date,
  end_date date,
  user_count bigint,
  image_url text,
  recent_users jsonb
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH active_visits AS (
    SELECT
      v.id,
      v.city,
      v.country,
      v.country_code,
      v.start_date,
      v.end_date,
      v.user_id
    FROM public.visits v
    WHERE v.end_date >= CURRENT_DATE
  ),
  city_groups AS (
    SELECT
      LOWER(TRIM(av.city)) AS city_key,
      MIN(av.id) AS group_id,
      MAX(av.city) AS group_city,
      MAX(av.country) AS group_country,
      MAX(av.country_code) AS group_country_code,
      MIN(av.start_date) AS group_start_date,
      MAX(av.end_date) AS group_end_date,
      COUNT(DISTINCT av.user_id) AS group_user_count
    FROM active_visits av
    GROUP BY LOWER(TRIM(av.city))
    HAVING COUNT(DISTINCT av.user_id) > 1
  )
  SELECT
    cg.group_id,
    cg.group_city,
    cg.group_country,
    cg.group_country_code,
    cg.group_start_date,
    cg.group_end_date,
    cg.group_user_count,
    (SELECT e.image_uri
     FROM public.events e
     WHERE LOWER(TRIM(e.city)) = cg.city_key
       AND e.image_uri IS NOT NULL
       AND e.date >= CURRENT_DATE
     ORDER BY e.created_at DESC
     LIMIT 1) AS image_url,
    COALESCE(
      (SELECT jsonb_agg(u)
       FROM (
         SELECT jsonb_build_object(
           'id', p.id,
           'full_name', p.full_name,
           'avatar_url', p.avatar_url
         ) AS u
         FROM public.visits v2
         JOIN public.profiles p ON p.id = v2.user_id
         WHERE LOWER(TRIM(v2.city)) = cg.city_key
           AND v2.end_date >= CURRENT_DATE
         ORDER BY v2.start_date ASC
         LIMIT 4
       ) sub),
      '[]'::jsonb
    ) AS recent_users
  FROM city_groups cg
  ORDER BY cg.group_user_count DESC, cg.group_start_date ASC
  LIMIT 20;
END;
$$;

DO $$
BEGIN
  RAISE NOTICE 'Updated: get_trending_visits() now groups by city, no date-equality requirement.';
END $$;
