-- =====================================================
-- chemistry_score(p_a, p_b) — people↔people compatibility (Chemistry, spec 02)
-- =====================================================
-- Returns (score 0..100, reasons text[]) for a pair of users. SECURITY DEFINER
-- because it reads private inputs (user_privacy_settings, gender/meeting
-- preferences, quest_intents, pair_pulse) — but it exposes only the number and
-- short generic reason strings, never the underlying fields. Callable by
-- authenticated: the discovery RPCs use it as an ORDER BY.
--
-- HARD EXCLUSIONS (score 0, empty reasons) — consent wins every tie:
--   * blocked_users in either direction
--   * either profile not onboarding_completed
--   * gender-preference incompatibility, checked BOTH directions. No discovery
--     RPC filters on gender today, so these are the onboarding fields' native
--     semantics (modules/onboarding: gender_preference 'guys'|'girls'|
--     'everyone'; gender 'male'|'female'|'non-binary'|'other'|
--     'prefer-not-to-say'): 'guys' → other's gender must be 'male', 'girls' →
--     'female', 'everyone'/null → anyone. Legacy pre-20250810 preference
--     values ('male'/'female') are honoured with the same meaning.
--   * profile_visibility 'private' on either side; 'friends_only' on either
--     side allowed only when the two are accepted friends (mirrors the
--     visibility predicate in the discovery RPCs, 20260613100100).
--
-- ADDITIVE COMPONENTS (capped at 100):
--   shared interests    10/shared entry, max 30   (profiles.interests jsonb ∩)
--   geography           same city +20 else same country +8
--   visit overlap       overlapping windows in same city (next 90d) +20,
--                       same city without overlap +6
--   meeting prefs       both set and neither 'no-plans' +10
--   languages           5/shared entry, max 10    (profiles.languages jsonb ∩)
--   behavioural         modal intent energy match +3, modal social match +3
--                       (quest_intents, last 30d); mutual accepted friend
--                       whose pair with the OTHER user is warm/hot +4
--
-- jsonb hard rule: interests/languages are jsonb ARRAYS but a stray '{}' row
-- must never break the function — every ∩ is guarded by jsonb_typeof='array'.

create or replace function public.chemistry_score(p_a uuid, p_b uuid)
returns table(score int, reasons text[])
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  -- tuning constants
  c_interest_pts        int := 10;
  c_interest_cap        int := 30;
  c_same_city_pts       int := 20;
  c_same_country_pts    int := 8;
  c_visit_overlap_pts   int := 20;
  c_visit_same_city_pts int := 6;
  c_meeting_pts         int := 10;
  c_lang_pts            int := 5;
  c_lang_cap            int := 10;
  c_energy_pts          int := 3;
  c_social_pts          int := 3;
  c_warm_friend_pts     int := 4;
  c_intent_window       interval := interval '30 days';
  c_visit_horizon_days  int := 90;

  a record;
  b record;
  v_score   int := 0;
  v_reasons text[] := '{}';
  n         int;
  v_visit   int;  -- 2 = overlapping same-city windows, 1 = same city no overlap
  a_energy  smallint;
  b_energy  smallint;
  a_social  text;
  b_social  text;
begin
  score := 0;
  reasons := '{}'::text[];

  if p_a is null or p_b is null or p_a = p_b then
    return next; return;
  end if;

  select p.interests, p.languages, p.location, p.location_country,
         p.meeting_preference, p.gender, p.gender_preference,
         coalesce(p.onboarding_completed, false) as onboarded
    into a
    from public.profiles p where p.id = p_a;
  if not found or not a.onboarded then return next; return; end if;

  select p.interests, p.languages, p.location, p.location_country,
         p.meeting_preference, p.gender, p.gender_preference,
         coalesce(p.onboarding_completed, false) as onboarded
    into b
    from public.profiles p where p.id = p_b;
  if not found or not b.onboarded then return next; return; end if;

  -- blocked in either direction
  if exists (
    select 1 from public.blocked_users bl
    where (bl.blocker_id = p_a and bl.blocked_id = p_b)
       or (bl.blocker_id = p_b and bl.blocked_id = p_a)
  ) then return next; return; end if;

  -- gender preference satisfied in BOTH directions
  if not (
       (a.gender_preference is null or a.gender_preference = 'everyone'
         or (a.gender_preference in ('guys','male')   and b.gender = 'male')
         or (a.gender_preference in ('girls','female') and b.gender = 'female'))
   and (b.gender_preference is null or b.gender_preference = 'everyone'
         or (b.gender_preference in ('guys','male')   and a.gender = 'male')
         or (b.gender_preference in ('girls','female') and a.gender = 'female'))
  ) then return next; return; end if;

  -- visibility: private never matches; friends_only only between accepted friends
  if exists (
    select 1 from public.user_privacy_settings ups
    where ups.user_id in (p_a, p_b) and ups.profile_visibility = 'private'
  ) then return next; return; end if;

  if exists (
    select 1 from public.user_privacy_settings ups
    where ups.user_id in (p_a, p_b) and ups.profile_visibility = 'friends_only'
  ) and not exists (
    select 1 from public.friendships f
    where f.status = 'accepted'
      and ((f.requester_id = p_a and f.addressee_id = p_b)
        or (f.requester_id = p_b and f.addressee_id = p_a))
  ) then return next; return; end if;

  -- ── shared interests ──────────────────────────────────────────────
  n := 0;
  if jsonb_typeof(a.interests) = 'array' and jsonb_typeof(b.interests) = 'array' then
    select count(distinct ai.val) into n
    from jsonb_array_elements_text(a.interests) ai(val)
    join jsonb_array_elements_text(b.interests) bi(val) on bi.val = ai.val;
  end if;
  if n > 0 then
    v_score := v_score + least(c_interest_cap, n * c_interest_pts);
    v_reasons := v_reasons
      || format('%s shared interest%s', n, case when n = 1 then '' else 's' end);
  end if;

  -- ── geography ─────────────────────────────────────────────────────
  if a.location is not null and b.location is not null
     and lower(btrim(a.location)) = lower(btrim(b.location)) then
    v_score := v_score + c_same_city_pts;
    v_reasons := v_reasons || format('both in %s', btrim(b.location));
  elsif a.location_country is not null and b.location_country is not null
     and lower(btrim(a.location_country)) = lower(btrim(b.location_country)) then
    v_score := v_score + c_same_country_pts;
    v_reasons := v_reasons || 'same country'::text;
  end if;

  -- ── visit overlap (windows touching the next 90 days) ─────────────
  select max(case when daterange(va.start_date, va.end_date, '[]')
                    && daterange(vb.start_date, vb.end_date, '[]')
             then 2 else 1 end)
    into v_visit
    from public.visits va
    join public.visits vb on lower(btrim(vb.city)) = lower(btrim(va.city))
   where va.user_id = p_a and vb.user_id = p_b
     and daterange(va.start_date, va.end_date, '[]')
         && daterange(current_date, current_date + c_visit_horizon_days, '[]')
     and daterange(vb.start_date, vb.end_date, '[]')
         && daterange(current_date, current_date + c_visit_horizon_days, '[]');
  if v_visit = 2 then
    v_score := v_score + c_visit_overlap_pts;
    v_reasons := v_reasons || 'overlapping visit dates'::text;
  elsif v_visit = 1 then
    v_score := v_score + c_visit_same_city_pts;
    v_reasons := v_reasons || 'visiting the same city'::text;
  end if;

  -- ── meeting preferences ('no_plans' = legacy pre-20250810 spelling) ─
  if a.meeting_preference is not null and a.meeting_preference not in ('no-plans','no_plans')
     and b.meeting_preference is not null and b.meeting_preference not in ('no-plans','no_plans') then
    v_score := v_score + c_meeting_pts;
    v_reasons := v_reasons || 'both open to meeting up'::text;
  end if;

  -- ── shared languages ──────────────────────────────────────────────
  n := 0;
  if jsonb_typeof(a.languages) = 'array' and jsonb_typeof(b.languages) = 'array' then
    select count(distinct al.val) into n
    from jsonb_array_elements_text(a.languages) al(val)
    join jsonb_array_elements_text(b.languages) bl(val) on bl.val = al.val;
  end if;
  if n > 0 then
    v_score := v_score + least(c_lang_cap, n * c_lang_pts);
    v_reasons := v_reasons
      || format('%s shared language%s', n, case when n = 1 then '' else 's' end);
  end if;

  -- ── behavioural: stated-intent similarity (modal prefs, last 30d) ──
  select qi.energy into a_energy
    from public.quest_intents qi
   where qi.user_id = p_a and qi.energy is not null
     and qi.created_at >= now() - c_intent_window
   group by qi.energy order by count(*) desc, qi.energy limit 1;
  select qi.energy into b_energy
    from public.quest_intents qi
   where qi.user_id = p_b and qi.energy is not null
     and qi.created_at >= now() - c_intent_window
   group by qi.energy order by count(*) desc, qi.energy limit 1;
  if a_energy is not null and a_energy = b_energy then
    v_score := v_score + c_energy_pts;
    v_reasons := v_reasons || 'similar energy'::text;
  end if;

  select qi.social into a_social
    from public.quest_intents qi
   where qi.user_id = p_a and qi.social is not null
     and qi.created_at >= now() - c_intent_window
   group by qi.social order by count(*) desc, qi.social limit 1;
  select qi.social into b_social
    from public.quest_intents qi
   where qi.user_id = p_b and qi.social is not null
     and qi.created_at >= now() - c_intent_window
   group by qi.social order by count(*) desc, qi.social limit 1;
  if a_social is not null and a_social = b_social then
    v_score := v_score + c_social_pts;
    v_reasons := v_reasons || 'similar group size'::text;
  end if;

  -- ── behavioural: friends-of-warm ──────────────────────────────────
  -- A mutual accepted friend M whose pair with p_b is currently warm/hot:
  -- "a friend you share is actively hanging out with them".
  if exists (
    select 1
      from public.pair_pulse pp
     cross join lateral (
       select case when pp.user_lo = p_b then pp.user_hi else pp.user_lo end as m
     ) mut
     where pp.state in ('warm','hot')
       and p_b in (pp.user_lo, pp.user_hi)
       and mut.m <> p_a
       and exists (
         select 1 from public.friendships f
         where f.status = 'accepted'
           and ((f.requester_id = p_a and f.addressee_id = mut.m)
             or (f.requester_id = mut.m and f.addressee_id = p_a)))
       and exists (
         select 1 from public.friendships f
         where f.status = 'accepted'
           and ((f.requester_id = p_b and f.addressee_id = mut.m)
             or (f.requester_id = mut.m and f.addressee_id = p_b)))
  ) then
    v_score := v_score + c_warm_friend_pts;
    v_reasons := v_reasons || 'a mutual friend is active with them'::text;
  end if;

  score := least(100, v_score);
  reasons := v_reasons;
  return next;
  return;
end;
$$;

comment on function public.chemistry_score(uuid, uuid) is
  'Chemistry: 0..100 compatibility + short reasons for a pair. Hard-zeroes blocked / un-onboarded / gender-pref-incompatible / private pairs. Used as discovery ordering.';

revoke all on function public.chemistry_score(uuid, uuid) from public, anon;
grant execute on function public.chemistry_score(uuid, uuid) to authenticated, service_role;
