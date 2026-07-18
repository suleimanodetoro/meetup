-- =====================================================
-- Chemistry → discovery ordering (Chemistry, spec 02)
-- =====================================================
-- Wires chemistry_score(auth.uid(), candidate) into both ranked-user RPCs so
-- the home map's people pins and the city Users tab surface the most
-- compatible people first, instead of arbitrary recency/start-date order.
--
--   get_users_in_city    — order by chemistry desc, then the previous
--                          updated_at recency order. Same filters, same
--                          return shape (the home map reads id/name/avatar).
--   get_city_users_ranked — the window/overlap tier stays the PRIMARY sort;
--                          chemistry replaces the arbitrary start-date
--                          tiebreak (user_id stays as the deterministic final
--                          tiebreak). Returns a new trailing `chemistry`
--                          column — additive; supabase-js rpc callers
--                          (hooks/useCityOverview) tolerate extra columns.
--
-- Performance guard (spec): chemistry is only computed for a bounded
-- candidate set. Both functions pre-limit to 500 candidates using their OLD
-- ordering before scoring (the old code ordered the full set anyway, so a
-- 500 cap is strictly cheaper). Consequence for get_city_users_ranked:
-- page_offset paging tops out at 500 rows per city/window — 25 pages of 20,
-- far beyond what the Users tab scrolls.
--
-- Bodies are copied from 20260613100100 (the current definitions) with the
-- ordering/bounding changes only. Lockdown is RE-APPLIED after every
-- CREATE OR REPLACE — that regression happened once already (see the
-- comments in 20260620000000). Bonus fix: get_users_in_city had a GRANT to
-- authenticated but was NEVER revoked from PUBLIC/anon (functions default to
-- PUBLIC EXECUTE), so anon could execute it; it is revoked here.

-- ============================================================
-- get_users_in_city  (home map people pins + city list)
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_users_in_city(city_name text, country_name text DEFAULT NULL::text)
RETURNS TABLE(
  id uuid, full_name text, avatar_url text, bio text, location text,
  location_country text, location_country_code text, nationality_code text,
  interests jsonb, gender text, updated_at timestamp with time zone
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
  WITH candidates AS (
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
    LIMIT 500
  )
  SELECT c.id, c.full_name, c.avatar_url, c.bio, c.location, c.location_country,
         c.location_country_code, c.nationality_code, c.interests, c.gender, c.updated_at
  FROM candidates c
  ORDER BY (SELECT cs.score FROM public.chemistry_score(auth.uid(), c.id) cs) DESC,
           c.updated_at DESC NULLS LAST
  LIMIT 200;
$function$;

REVOKE ALL ON FUNCTION public.get_users_in_city(text, text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.get_users_in_city(text, text) TO authenticated;

-- ============================================================
-- get_city_users_ranked  (city Users tab)
-- Return type changes (chemistry added) => DROP then CREATE.
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
  is_premium boolean,
  chemistry int
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
  ),
  -- Everything visible to the caller, in the OLD deterministic order, capped
  -- at 500 so chemistry_score runs on a bounded set (see header comment).
  visible AS (
    SELECT
      s.user_id,
      p.full_name,
      p.avatar_url,
      p.bio,
      p.nationality_code,
      p.location_country_code,
      COALESCE(p.onboarding_completed, false) AS is_verified,
      s.s,
      s.e,
      s.match_score
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
    LIMIT 500
  ),
  with_chemistry AS (
    SELECT v.*,
      COALESCE((SELECT cs.score FROM public.chemistry_score(auth.uid(), v.user_id) cs), 0) AS chem
    FROM visible v
  )
  SELECT
    w.user_id,
    w.full_name,
    w.avatar_url,
    w.bio,
    w.nationality_code,
    w.location_country_code,
    w.is_verified,
    w.s AS visit_start,
    w.e AS visit_end,
    w.match_score,
    public.is_user_premium(w.user_id) AS is_premium,
    w.chem AS chemistry
  FROM with_chemistry w
  ORDER BY w.match_score DESC, w.chem DESC, w.s ASC, w.user_id ASC
  LIMIT page_limit OFFSET page_offset;
END;
$$;

REVOKE ALL ON FUNCTION public.get_city_users_ranked(text, date, date, int, int) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.get_city_users_ranked(text, date, date, int, int) TO authenticated;
