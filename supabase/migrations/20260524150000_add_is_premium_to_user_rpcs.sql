-- Add an `is_premium` flag to the user-returning RPCs that feed the home
-- screen's suggested-users rail and the city detail's Users tab, so the UI
-- can render a small gold badge on premium subscribers without doing a
-- second round-trip per user.
--
-- The truth condition matches the client-side derivation in
-- hooks/useSubscription.tsx exactly:
--   entitlement_id IS NOT NULL
--   AND (expires_at IS NULL OR expires_at > NOW())
--
-- We expose it via a SQL helper so anywhere that needs "is this user
-- premium?" can call public.is_user_premium(uuid) instead of duplicating
-- the boolean — keeping the rule in one place.

------------------------------------------------------------
-- 1) Helper function
------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.is_user_premium(uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_subscriptions us
    WHERE us.user_id = uid
      AND us.entitlement_id IS NOT NULL
      AND (us.expires_at IS NULL OR us.expires_at > NOW())
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_user_premium(uuid) TO authenticated, anon;

------------------------------------------------------------
-- 2) Extend get_suggested_users with is_premium
--
-- Signature must stay byte-for-byte identical to the version from
-- 20250916154645 (id..common_cities) plus our new is_premium column at
-- the end. Anything else and Postgres throws SQLSTATE 42P13 ("return
-- type mismatch"). Function body is the same scoring logic — we only
-- add the is_premium projection and a soft preference in ORDER BY.
------------------------------------------------------------

DROP FUNCTION IF EXISTS public.get_suggested_users(uuid);

CREATE OR REPLACE FUNCTION public.get_suggested_users(current_user_id uuid)
RETURNS TABLE(
  id uuid,
  full_name text,
  avatar_url text,
  bio text,
  birth_date date,
  nationality_code text,
  interests jsonb,
  languages jsonb,
  location text,
  similarity_score integer,
  common_interests text[],
  common_cities text[],
  is_premium boolean
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH user_data AS (
    SELECT
      p.interests AS user_interests,
      array_agg(DISTINCT v.city) FILTER (WHERE v.city IS NOT NULL) AS user_cities
    FROM profiles p
    LEFT JOIN visits v ON v.user_id = p.id
      AND v.end_date >= CURRENT_DATE
    WHERE p.id = current_user_id
    GROUP BY p.id, p.interests
  ),
  scored_users AS (
    SELECT
      p.id,
      p.full_name,
      p.avatar_url,
      p.bio,
      p.birth_date,
      p.nationality_code,
      p.interests,
      p.languages,
      p.location,
      COALESCE(
        CASE
          WHEN ud.user_interests IS NOT NULL AND p.interests IS NOT NULL
          THEN (
            SELECT COUNT(*)::integer
            FROM jsonb_array_elements_text(p.interests) AS p_interest
            JOIN jsonb_array_elements_text(ud.user_interests) AS u_interest
              ON p_interest = u_interest
          )
          ELSE 0
        END, 0
      ) AS interest_score,
      CASE
        WHEN ud.user_interests IS NOT NULL AND p.interests IS NOT NULL
        THEN ARRAY(
          SELECT DISTINCT p_interest
          FROM jsonb_array_elements_text(p.interests) AS p_interest
          JOIN jsonb_array_elements_text(ud.user_interests) AS u_interest
            ON p_interest = u_interest
        )
        ELSE ARRAY[]::text[]
      END AS common_interests,
      ARRAY(
        SELECT DISTINCT v.city
        FROM visits v
        WHERE v.user_id = p.id
          AND v.city = ANY(ud.user_cities)
          AND v.end_date >= CURRENT_DATE
      ) AS common_cities,
      public.is_user_premium(p.id) AS is_premium
    FROM profiles p
    CROSS JOIN user_data ud
    WHERE p.id != current_user_id
      AND p.onboarding_completed = true
  )
  SELECT
    su.id,
    su.full_name,
    su.avatar_url,
    su.bio,
    su.birth_date,
    su.nationality_code,
    su.interests,
    su.languages,
    su.location,
    su.interest_score + (COALESCE(array_length(su.common_cities, 1), 0) * 2) AS similarity_score,
    su.common_interests,
    su.common_cities,
    su.is_premium
  FROM scored_users su
  ORDER BY
    -- Slight nudge so premium users surface a bit higher within tied
    -- similarity scores — exposes the gold badge without distorting the
    -- relevance ranking that drives the rail's main value.
    (su.interest_score + (COALESCE(array_length(su.common_cities, 1), 0) * 2)) DESC,
    su.is_premium DESC,
    RANDOM()
  LIMIT 7;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_suggested_users(uuid) TO authenticated;

------------------------------------------------------------
-- 3) Extend get_city_users_ranked with is_premium
------------------------------------------------------------

DROP FUNCTION IF EXISTS public.get_city_users_ranked(text, date, date, int, int);

CREATE OR REPLACE FUNCTION public.get_city_users_ranked(
  city_name text,
  window_from date DEFAULT NULL,
  window_to date DEFAULT NULL,
  page_limit int DEFAULT 20,
  page_offset int DEFAULT 0
)
RETURNS TABLE (
  user_id uuid,
  full_name text,
  avatar_url text,
  bio text,
  nationality_code text,
  is_verified boolean,
  visit_start date,
  visit_end date,
  match_score int,
  is_premium boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  city_lower text := LOWER(TRIM(city_name));
  effective_from date := COALESCE(window_from, CURRENT_DATE);
  effective_to date := COALESCE(window_to, CURRENT_DATE + INTERVAL '90 days');
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
    s.match_score,
    public.is_user_premium(s.user_id) AS is_premium
  FROM scored s
  JOIN public.profiles p ON p.id = s.user_id
  -- Tiebreaker on user_id makes pagination deterministic when scores match,
  -- which removes the React-key collision the client had to dedupe.
  ORDER BY s.match_score DESC, s.s ASC, s.user_id ASC
  LIMIT page_limit OFFSET page_offset;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_city_users_ranked(text, date, date, int, int) TO authenticated;

DO $$
BEGIN
  RAISE NOTICE 'Added: is_user_premium(uuid); updated: get_suggested_users, get_city_users_ranked.';
END $$;
