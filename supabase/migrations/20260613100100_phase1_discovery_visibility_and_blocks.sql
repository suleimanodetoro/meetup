-- Phase 1 (deslop audit) — S4 + Q9.
--
-- The discovery RPCs are SECURITY DEFINER, so they BYPASS RLS — the policy
-- lockdown in the companion migration does not reach them. profile_visibility
-- and blocked_users must therefore be enforced inside each body. Rule applied to
-- every people-returning RPC (caller = auth.uid(), except get_suggested_users
-- which is SECURITY INVOKER and uses its current_user_id param):
--   * exclude users blocked in EITHER direction vs the caller
--   * profile_visibility: 'public' always; 'friends_only' only to accepted
--     friends; 'private' never appears in discovery
-- The COUNT RPCs (get_city_meta_window, get_visit_details.user_count) apply the
-- IDENTICAL predicate so the list/“has more” paging in useCityOverview stays in
-- sync with the filtered lists.
-- Also: pins search_path on each (S9), and restores the is_premium column +
-- deterministic user_id tiebreaker that 20260530161100 dropped (Q9).

-- ============================================================
-- get_users_in_city  (map + city list)
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_users_in_city(city_name text, country_name text DEFAULT NULL::text)
RETURNS TABLE(
  id uuid, full_name text, avatar_url text, bio text, location text,
  location_country text, location_country_code text, nationality_code text,
  interests jsonb, gender text, updated_at timestamp with time zone
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
  SELECT p.id, p.full_name, p.avatar_url, p.bio, p.location, p.location_country,
         p.location_country_code, p.nationality_code, p.interests, p.gender, p.updated_at
  FROM public.profiles p
  WHERE p.location = city_name
    AND (country_name IS NULL OR p.location_country = country_name)
    AND p.onboarding_completed = true
    AND p.id != auth.uid()
    AND NOT EXISTS (
      SELECT 1 FROM public.blocked_users b
      WHERE (b.blocker_id = auth.uid() AND b.blocked_id = p.id)
         OR (b.blocker_id = p.id AND b.blocked_id = auth.uid())
    )
    AND (
      COALESCE((SELECT ups.profile_visibility FROM public.user_privacy_settings ups WHERE ups.user_id = p.id), 'public') = 'public'
      OR (
        COALESCE((SELECT ups.profile_visibility FROM public.user_privacy_settings ups WHERE ups.user_id = p.id), 'public') = 'friends_only'
        AND EXISTS (
          SELECT 1 FROM public.friendships f
          WHERE f.status = 'accepted'
            AND ((f.requester_id = auth.uid() AND f.addressee_id = p.id)
              OR (f.requester_id = p.id AND f.addressee_id = auth.uid()))
        )
      )
    )
  ORDER BY p.updated_at DESC NULLS LAST
  LIMIT 200;
$function$;

-- ============================================================
-- get_nearby_city_users  (same-country, other-city fallback)
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_nearby_city_users(user_city text, user_country text)
RETURNS TABLE(
  id uuid, full_name text, avatar_url text, bio text, location text,
  location_country text, location_country_code text, nationality_code text,
  interests jsonb, gender text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
  SELECT p.id, p.full_name, p.avatar_url, p.bio, p.location, p.location_country,
         p.location_country_code, p.nationality_code, p.interests, p.gender
  FROM public.profiles p
  WHERE p.location_country = user_country
    AND p.location != user_city
    AND p.onboarding_completed = true
    AND p.id != auth.uid()
    AND NOT EXISTS (
      SELECT 1 FROM public.blocked_users b
      WHERE (b.blocker_id = auth.uid() AND b.blocked_id = p.id)
         OR (b.blocker_id = p.id AND b.blocked_id = auth.uid())
    )
    AND (
      COALESCE((SELECT ups.profile_visibility FROM public.user_privacy_settings ups WHERE ups.user_id = p.id), 'public') = 'public'
      OR (
        COALESCE((SELECT ups.profile_visibility FROM public.user_privacy_settings ups WHERE ups.user_id = p.id), 'public') = 'friends_only'
        AND EXISTS (
          SELECT 1 FROM public.friendships f
          WHERE f.status = 'accepted'
            AND ((f.requester_id = auth.uid() AND f.addressee_id = p.id)
              OR (f.requester_id = p.id AND f.addressee_id = auth.uid()))
        )
      )
    )
  ORDER BY p.updated_at DESC NULLS LAST
  LIMIT 100;
$function$;

-- ============================================================
-- get_city_users_ranked  (city Users tab) — S4 + Q9 (restore is_premium + tiebreaker)
-- Return type changes (is_premium re-added) => DROP then CREATE.
-- ============================================================
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
  match_score int,
  is_premium boolean
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
  WITH city_visitors AS (
    SELECT v.user_id, v.start_date, v.end_date
    FROM public.visits v
    WHERE LOWER(TRIM(v.city)) = city_lower AND v.end_date >= earliest_cutoff
  ),
  city_event_hosts AS (
    SELECT DISTINCT e.user_id, e.date::date AS start_date, COALESCE(e.end_date, e.date)::date AS end_date
    FROM public.events e
    WHERE LOWER(TRIM(e.city)) = city_lower AND e.date >= earliest_cutoff AND e.user_id IS NOT NULL
  ),
  city_event_attendees AS (
    SELECT DISTINCT a.user_id, e.date::date AS start_date, COALESCE(e.end_date, e.date)::date AS end_date
    FROM public.attendance a
    JOIN public.events e ON e.id = a.event_id
    WHERE LOWER(TRIM(e.city)) = city_lower AND e.date >= earliest_cutoff
  ),
  all_city_users AS (
    SELECT * FROM city_visitors
    UNION ALL SELECT * FROM city_event_hosts
    UNION ALL SELECT * FROM city_event_attendees
  ),
  deduped AS (
    SELECT u.user_id, MIN(u.start_date) AS s, MAX(u.end_date) AS e
    FROM all_city_users u
    GROUP BY u.user_id
  ),
  scored AS (
    SELECT d.user_id, d.s, d.e,
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
    s.match_score,
    public.is_user_premium(s.user_id) AS is_premium
  FROM scored s
  JOIN public.profiles p ON p.id = s.user_id
  WHERE NOT EXISTS (
      SELECT 1 FROM public.blocked_users b
      WHERE (b.blocker_id = auth.uid() AND b.blocked_id = p.id)
         OR (b.blocker_id = p.id AND b.blocked_id = auth.uid())
    )
    AND (
      COALESCE((SELECT ups.profile_visibility FROM public.user_privacy_settings ups WHERE ups.user_id = p.id), 'public') = 'public'
      OR (
        COALESCE((SELECT ups.profile_visibility FROM public.user_privacy_settings ups WHERE ups.user_id = p.id), 'public') = 'friends_only'
        AND EXISTS (
          SELECT 1 FROM public.friendships f
          WHERE f.status = 'accepted'
            AND ((f.requester_id = auth.uid() AND f.addressee_id = p.id)
              OR (f.requester_id = p.id AND f.addressee_id = auth.uid()))
        )
      )
    )
  ORDER BY s.match_score DESC, s.s ASC, s.user_id ASC
  LIMIT page_limit OFFSET page_offset;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_city_users_ranked(text, date, date, int, int) TO authenticated;

-- ============================================================
-- get_city_meta_window  (city header counts) — filter MUST match get_city_users_ranked
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_city_meta_window(
  city_name text,
  window_from date DEFAULT NULL,
  window_to date DEFAULT NULL
)
RETURNS TABLE(city text, country text, country_code text, user_count bigint, plan_count bigint)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  city_lower      text := LOWER(TRIM(city_name));
  earliest_cutoff date := CURRENT_DATE - INTERVAL '14 days';
BEGIN
  RETURN QUERY
  WITH city_visitors AS (
    SELECT v.user_id FROM public.visits v
    WHERE LOWER(TRIM(v.city)) = city_lower AND v.end_date >= earliest_cutoff
  ),
  city_event_hosts AS (
    SELECT DISTINCT e.user_id FROM public.events e
    WHERE LOWER(TRIM(e.city)) = city_lower AND e.date >= earliest_cutoff AND e.user_id IS NOT NULL
  ),
  city_event_attendees AS (
    SELECT DISTINCT a.user_id FROM public.attendance a
    JOIN public.events e ON e.id = a.event_id
    WHERE LOWER(TRIM(e.city)) = city_lower AND e.date >= earliest_cutoff
  ),
  deduped AS (
    SELECT user_id FROM city_visitors
    UNION SELECT user_id FROM city_event_hosts
    UNION SELECT user_id FROM city_event_attendees
  ),
  visible AS (
    SELECT d.user_id FROM deduped d
    WHERE NOT EXISTS (
        SELECT 1 FROM public.blocked_users b
        WHERE (b.blocker_id = auth.uid() AND b.blocked_id = d.user_id)
           OR (b.blocker_id = d.user_id AND b.blocked_id = auth.uid())
      )
      AND (
        COALESCE((SELECT ups.profile_visibility FROM public.user_privacy_settings ups WHERE ups.user_id = d.user_id), 'public') = 'public'
        OR (
          COALESCE((SELECT ups.profile_visibility FROM public.user_privacy_settings ups WHERE ups.user_id = d.user_id), 'public') = 'friends_only'
          AND EXISTS (
            SELECT 1 FROM public.friendships f
            WHERE f.status = 'accepted'
              AND ((f.requester_id = auth.uid() AND f.addressee_id = d.user_id)
                OR (f.requester_id = d.user_id AND f.addressee_id = auth.uid()))
          )
        )
      )
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
    (SELECT COUNT(*) FROM visible)::bigint,
    (SELECT COUNT(*) FROM public.events e
       WHERE LOWER(TRIM(e.city)) = city_lower AND e.date >= earliest_cutoff)::bigint
  FROM city_meta m;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_city_meta_window(text, date, date) TO authenticated;

-- ============================================================
-- get_visit_users  (people overlapping a visit)
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_visit_users(visit_id_param bigint, limit_param int DEFAULT NULL)
RETURNS TABLE(
  user_id uuid, full_name text, avatar_url text, bio text, nationality_code text,
  is_verified boolean, visit_start date, visit_end date, overlap_days int
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  target_visit RECORD;
BEGIN
  SELECT v.id, v.city, v.country, v.country_code, v.start_date, v.end_date, v.user_id
  INTO target_visit FROM public.visits v WHERE v.id = visit_id_param;

  RETURN QUERY
  SELECT
    p.id AS user_id, p.full_name, p.avatar_url, p.bio, p.nationality_code,
    COALESCE(p.onboarding_completed, false) AS is_verified,
    v2.start_date AS visit_start, v2.end_date AS visit_end,
    (LEAST(v2.end_date::date, target_visit.end_date::date)
      - GREATEST(v2.start_date::date, target_visit.start_date::date) + 1)::int AS overlap_days
  FROM public.visits v2
  JOIN public.profiles p ON v2.user_id = p.id
  WHERE v2.city = target_visit.city
    AND v2.user_id != target_visit.user_id
    AND daterange(v2.start_date, v2.end_date, '[]') && daterange(target_visit.start_date, target_visit.end_date, '[]')
    AND NOT EXISTS (
      SELECT 1 FROM public.blocked_users b
      WHERE (b.blocker_id = auth.uid() AND b.blocked_id = p.id)
         OR (b.blocker_id = p.id AND b.blocked_id = auth.uid())
    )
    AND (
      COALESCE((SELECT ups.profile_visibility FROM public.user_privacy_settings ups WHERE ups.user_id = p.id), 'public') = 'public'
      OR (
        COALESCE((SELECT ups.profile_visibility FROM public.user_privacy_settings ups WHERE ups.user_id = p.id), 'public') = 'friends_only'
        AND EXISTS (
          SELECT 1 FROM public.friendships f
          WHERE f.status = 'accepted'
            AND ((f.requester_id = auth.uid() AND f.addressee_id = p.id)
              OR (f.requester_id = p.id AND f.addressee_id = auth.uid()))
        )
      )
    )
  ORDER BY overlap_days DESC, v2.created_at DESC
  LIMIT limit_param;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_visit_users(bigint, int) TO authenticated;

-- ============================================================
-- get_visit_details  (visit header) — user_count filtered to match get_visit_users
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_visit_details(visit_id_param bigint)
RETURNS TABLE(
  id bigint, city text, country text, country_code text,
  start_date date, end_date date, user_count bigint, plan_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN QUERY
  SELECT
    v.id, v.city, v.country, v.country_code, v.start_date, v.end_date,
    (SELECT COUNT(DISTINCT v2.user_id)
       FROM public.visits v2
       WHERE v2.city = v.city
         AND daterange(v2.start_date, v2.end_date, '[]') && daterange(v.start_date, v.end_date, '[]')
         AND NOT EXISTS (
           SELECT 1 FROM public.blocked_users b
           WHERE (b.blocker_id = auth.uid() AND b.blocked_id = v2.user_id)
              OR (b.blocker_id = v2.user_id AND b.blocked_id = auth.uid())
         )
         AND (
           COALESCE((SELECT ups.profile_visibility FROM public.user_privacy_settings ups WHERE ups.user_id = v2.user_id), 'public') = 'public'
           OR (
             COALESCE((SELECT ups.profile_visibility FROM public.user_privacy_settings ups WHERE ups.user_id = v2.user_id), 'public') = 'friends_only'
             AND EXISTS (
               SELECT 1 FROM public.friendships f
               WHERE f.status = 'accepted'
                 AND ((f.requester_id = auth.uid() AND f.addressee_id = v2.user_id)
                   OR (f.requester_id = v2.user_id AND f.addressee_id = auth.uid()))
             )
           )
         )
    ) AS user_count,
    (SELECT COUNT(*) FROM public.events e2
       WHERE e2.city = v.city AND e2.date::date BETWEEN v.start_date AND v.end_date) AS plan_count
  FROM public.visits v
  WHERE v.id = visit_id_param;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_visit_details(bigint) TO authenticated;

-- ============================================================
-- get_suggested_users  (home rail) — SECURITY INVOKER; filter keys on current_user_id
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_suggested_users(current_user_id uuid)
RETURNS TABLE(
  id uuid, full_name text, avatar_url text, bio text, birth_date date,
  nationality_code text, interests jsonb, languages jsonb, location text,
  similarity_score integer, common_interests text[], common_cities text[], is_premium boolean
)
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN QUERY
  WITH user_data AS (
    SELECT
      p.interests AS user_interests,
      array_agg(DISTINCT v.city) FILTER (WHERE v.city IS NOT NULL) AS user_cities
    FROM profiles p
    LEFT JOIN visits v ON v.user_id = p.id AND v.end_date >= CURRENT_DATE
    WHERE p.id = current_user_id
    GROUP BY p.id, p.interests
  ),
  scored_users AS (
    SELECT
      p.id, p.full_name, p.avatar_url, p.bio, p.birth_date, p.nationality_code,
      p.interests, p.languages, p.location,
      COALESCE(
        CASE WHEN ud.user_interests IS NOT NULL AND p.interests IS NOT NULL THEN (
          SELECT COUNT(*)::integer
          FROM jsonb_array_elements_text(p.interests) AS p_interest
          JOIN jsonb_array_elements_text(ud.user_interests) AS u_interest ON p_interest = u_interest
        ) ELSE 0 END, 0
      ) AS interest_score,
      CASE WHEN ud.user_interests IS NOT NULL AND p.interests IS NOT NULL THEN ARRAY(
        SELECT DISTINCT p_interest
        FROM jsonb_array_elements_text(p.interests) AS p_interest
        JOIN jsonb_array_elements_text(ud.user_interests) AS u_interest ON p_interest = u_interest
      ) ELSE ARRAY[]::text[] END AS common_interests,
      ARRAY(
        SELECT DISTINCT v.city FROM visits v
        WHERE v.user_id = p.id AND v.city = ANY(ud.user_cities) AND v.end_date >= CURRENT_DATE
      ) AS common_cities,
      public.is_user_premium(p.id) AS is_premium
    FROM profiles p
    CROSS JOIN user_data ud
    WHERE p.id != current_user_id
      AND p.onboarding_completed = true
      AND NOT EXISTS (
        SELECT 1 FROM public.blocked_users b
        WHERE (b.blocker_id = current_user_id AND b.blocked_id = p.id)
           OR (b.blocker_id = p.id AND b.blocked_id = current_user_id)
      )
      AND (
        COALESCE((SELECT ups.profile_visibility FROM public.user_privacy_settings ups WHERE ups.user_id = p.id), 'public') = 'public'
        OR (
          COALESCE((SELECT ups.profile_visibility FROM public.user_privacy_settings ups WHERE ups.user_id = p.id), 'public') = 'friends_only'
          AND EXISTS (
            SELECT 1 FROM public.friendships f
            WHERE f.status = 'accepted'
              AND ((f.requester_id = current_user_id AND f.addressee_id = p.id)
                OR (f.requester_id = p.id AND f.addressee_id = current_user_id))
          )
        )
      )
  )
  SELECT
    su.id, su.full_name, su.avatar_url, su.bio, su.birth_date, su.nationality_code,
    su.interests, su.languages, su.location,
    su.interest_score + (COALESCE(array_length(su.common_cities, 1), 0) * 2) AS similarity_score,
    su.common_interests, su.common_cities, su.is_premium
  FROM scored_users su
  ORDER BY
    (su.interest_score + (COALESCE(array_length(su.common_cities, 1), 0) * 2)) DESC,
    su.is_premium DESC,
    RANDOM()
  LIMIT 7;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_suggested_users(uuid) TO authenticated;
