-- Phase 1b (engine): matching + completion RPCs, and the required hardening of
-- get_city_plans_ranked. ADDITIVE — only CREATE OR REPLACE FUNCTION + new functions;
-- no table/data changes. Depends on 1a (quest_catalog, events.status/completed_at,
-- quest_ledger). Paired revert: 20260620000000_quests_phase1b_engine.revert.sql

BEGIN;

-- ============================================================================
-- 1. HARDEN get_city_plans_ranked (open-quest discovery) — REQUIRED before any
--    stranger discovery. Adds: is_private=false, bidirectional block exclusion,
--    and host profile_visibility (mirrors get_users_in_city). Also pins
--    search_path (the original relied on the global ALTER in 20260613100200;
--    a CREATE OR REPLACE drops that, so we set it explicitly here).
-- ============================================================================
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
      -- only open/discoverable quests (NULL is_private treated as open)
      AND e.is_private IS NOT TRUE
      -- bidirectional block exclusion (mirrors get_users_in_city)
      AND NOT EXISTS (
        SELECT 1 FROM public.blocked_users b
        WHERE (b.blocker_id = auth.uid() AND b.blocked_id = e.user_id)
           OR (b.blocker_id = e.user_id AND b.blocked_id = auth.uid())
      )
      -- host profile_visibility (public, or friends_only when an accepted friend)
      AND (
        COALESCE((SELECT ups.profile_visibility FROM public.user_privacy_settings ups WHERE ups.user_id = e.user_id), 'public') = 'public'
        OR (
          COALESCE((SELECT ups.profile_visibility FROM public.user_privacy_settings ups WHERE ups.user_id = e.user_id), 'public') = 'friends_only'
          AND EXISTS (
            SELECT 1 FROM public.friendships f
            WHERE f.status = 'accepted'
              AND ((f.requester_id = auth.uid() AND f.addressee_id = e.user_id)
                OR (f.requester_id = e.user_id AND f.addressee_id = auth.uid()))
          )
        )
      )
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

-- Lock down to authenticated only. Postgres grants EXECUTE to PUBLIC by default
-- and the original (20260523140000) never revoked it, so a CREATE OR REPLACE
-- leaves anon able to call this SECURITY DEFINER discovery RPC — revoke it now.
REVOKE ALL ON FUNCTION public.get_city_plans_ranked(text, date, date, int, int) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.get_city_plans_ranked(text, date, date, int, int) TO authenticated;

-- The sibling user-discovery RPC has the same never-revoked-PUBLIC exposure
-- (created in 20260523140000, never revoked since) — close it here too so anon
-- can't enumerate users. This lockdown intentionally persists across the revert.
REVOKE ALL ON FUNCTION public.get_city_users_ranked(text, date, date, int, int) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.get_city_users_ranked(text, date, date, int, int) TO authenticated;

-- ============================================================================
-- 2. suggest_quest — intent → ranked catalog sidequests (the create on-ramp +
--    discovery suggestions). Reads only the authenticated-readable catalog, so
--    SECURITY INVOKER (no RLS bypass needed). All factors optional/defaulted.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.suggest_quest(
  p_energy     smallint DEFAULT NULL,   -- 1..3
  p_social     text     DEFAULT NULL,   -- 'solo'|'pair'|'group'|'either'
  p_time_max   int      DEFAULT NULL,   -- minutes available
  p_budget     smallint DEFAULT NULL,   -- 0..2 spend band
  p_comfort    smallint DEFAULT NULL,   -- 1..3 risk ceiling
  p_categories text[]   DEFAULT NULL,   -- catalog categories and/or vibe tags
  p_limit      int      DEFAULT 10
)
RETURNS TABLE(
  id bigint, slug text, title text, dare text, why text, category text,
  energy_level smallint, social_mode text, duration_min int, cost_tier smallint,
  budget_min numeric, budget_max numeric, currency text, risk_tier smallint,
  is_solo_safe boolean, vibe text[], match_score int, match_reasons text[]
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
  SELECT
    q.id, q.slug, q.title, q.dare, q.why, q.category, q.energy_level, q.social_mode,
    q.duration_min, q.cost_tier, q.budget_min, q.budget_max, q.currency, q.risk_tier,
    q.is_solo_safe, q.vibe,
    (
      (CASE WHEN p_categories IS NOT NULL AND (q.category = ANY(p_categories) OR q.vibe && p_categories) THEN 40 ELSE 0 END)
    + (CASE WHEN p_energy IS NOT NULL THEN GREATEST(0, 15 - 7 * ABS(q.energy_level - p_energy)) ELSE 0 END)
    + (CASE WHEN p_social IS NOT NULL AND (q.social_mode = p_social OR q.social_mode = 'either') THEN 20 ELSE 0 END)
    + (CASE WHEN p_time_max IS NOT NULL AND q.duration_min <= p_time_max THEN 10 ELSE 0 END)
    )::int AS match_score,
    ARRAY_REMOVE(ARRAY[
      CASE WHEN p_categories IS NOT NULL AND (q.category = ANY(p_categories) OR q.vibe && p_categories) THEN 'matches your vibe' END,
      CASE WHEN p_time_max IS NOT NULL AND q.duration_min <= p_time_max THEN 'fits your time' END,
      CASE WHEN p_budget IS NOT NULL AND q.cost_tier <= p_budget THEN 'in your budget' END,
      CASE WHEN p_social = 'solo' AND q.is_solo_safe THEN 'good solo' END
    ], NULL) AS match_reasons
  FROM public.quest_catalog q
  WHERE q.is_active
    AND (p_time_max IS NULL OR q.duration_min <= p_time_max)
    AND (p_budget  IS NULL OR q.cost_tier   <= p_budget)
    AND (p_comfort IS NULL OR q.risk_tier   <= p_comfort)
    AND (
      p_social IS NULL OR p_social = 'either'
      OR q.social_mode = p_social OR q.social_mode = 'either'
      OR (p_social = 'solo' AND q.is_solo_safe)
    )
  ORDER BY match_score DESC, q.duration_min ASC, q.id ASC
  LIMIT p_limit;
$$;

REVOKE ALL ON FUNCTION public.suggest_quest(smallint, text, int, smallint, smallint, text[], int) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.suggest_quest(smallint, text, int, smallint, smallint, text[], int) TO authenticated;

-- ============================================================================
-- 3. complete_quest — mark a quest done + bump the pairwise ledger. SECURITY
--    DEFINER (writes quest_ledger which has no client write grant), pinned
--    search_path, and validates the caller (and partner) are participants.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.complete_quest(
  p_event_id  bigint,
  p_partner_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid     uuid := auth.uid();
  v_lo      uuid;
  v_hi      uuid;
  v_updated int;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  -- caller must be on this quest's roster
  IF NOT EXISTS (
    SELECT 1 FROM public.attendance a WHERE a.event_id = p_event_id AND a.user_id = v_uid
  ) THEN
    RAISE EXCEPTION 'not a participant of this quest';
  END IF;

  -- Any roster member may complete an open/collaborative quest (by design).
  UPDATE public.events
     SET status = 'completed', completed_at = now()
   WHERE id = p_event_id
     AND status <> 'completed';
  GET DIAGNOSTICS v_updated = ROW_COUNT;

  -- Only credit the ledger on the actual completion transition, so repeat calls
  -- can't inflate the "you & them: N quests" counter.
  IF v_updated = 0 THEN
    RETURN;
  END IF;

  -- pairwise ledger: only if a real partner who is also on the roster
  IF p_partner_id IS NOT NULL
     AND p_partner_id <> v_uid
     AND EXISTS (
       SELECT 1 FROM public.attendance a WHERE a.event_id = p_event_id AND a.user_id = p_partner_id
     )
  THEN
    v_lo := LEAST(v_uid, p_partner_id);
    v_hi := GREATEST(v_uid, p_partner_id);
    INSERT INTO public.quest_ledger (user_lo, user_hi, quest_count, first_quest_at, last_quest_at)
    VALUES (v_lo, v_hi, 1, now(), now())
    ON CONFLICT (user_lo, user_hi) DO UPDATE
      SET quest_count   = public.quest_ledger.quest_count + 1,
          last_quest_at = now();
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.complete_quest(bigint, uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.complete_quest(bigint, uuid) TO authenticated;

COMMIT;
