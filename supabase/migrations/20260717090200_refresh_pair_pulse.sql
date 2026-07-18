-- =====================================================
-- refresh_pair_pulse() — nightly recompute of pair momentum
-- =====================================================
-- Recomputes score/state for every pair with any signal in the trailing 90
-- days PLUS every pair already tracked (so quiet pairs keep decaying and can
-- transition to cooling/cold without fresh activity). Emits engine_events:
--   * 'pulse.transition'  when a pair drifts hot/warm -> cooling
--   * 'nudge.converted'   when a pair interacted after a recent 'nudge.sent'
--
-- Service-role / cron only — clients never execute this. Scheduling: nightly
-- 03:30 UTC via pg_cron (guarded DO block at the bottom of this file).
-- Manual invocation (psql, service role or postgres):
--   select public.refresh_pair_pulse();

create or replace function public.refresh_pair_pulse()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  -- ── Tuning constants — the one obvious place to tune the Pulse Monitor ──
  c_window         constant interval := interval '90 days'; -- signal lookback
  c_half_life_days constant numeric  := 14.0;               -- decay half-life
  c_hot_min        constant numeric  := 80;                 -- score >= hot
  c_warm_min       constant numeric  := 30;                 -- score >= warm
  c_cooling_min    constant numeric  := 10;                 -- score >= cooling*
  c_quest_pts      constant numeric  := 40;  -- per co-completed quest (strongest)
  c_coattend_pts   constant numeric  := 15;  -- per distinct co-attended event
  c_friend_pts     constant numeric  := 10;  -- accepted friendship, once
  c_dm_msg_pts     constant numeric  := 2;   -- per DM message (capped/day)
  c_group_msg_pts  constant numeric  := 1;   -- per shared-group message (capped/day)
  c_msg_daily_cap  constant int      := 10;  -- messages that score, per pair/day
  c_nudge_window   constant interval := interval '14 days'; -- nudge->conversion window
begin
  -- 0. Consent wins ties: blocked pairs are never scored, and any previously
  --    tracked row is removed so no stale pulse lingers after a block.
  delete from public.pair_pulse pp
  where exists (
    select 1 from public.blocked_users b
    where (b.blocker_id = pp.user_lo and b.blocked_id = pp.user_hi)
       or (b.blocker_id = pp.user_hi and b.blocked_id = pp.user_lo)
  );

  -- 1. Raw score + most-recent-signal timestamp per pair.
  --    (Temp table because the result feeds three statements: transition
  --    events, the upsert, and nudge-conversion detection.)
  drop table if exists tmp_pulse_next;
  create temp table tmp_pulse_next (
    user_lo   uuid,
    user_hi   uuid,
    score     numeric,
    last_interaction_at timestamptz,
    old_state text,
    old_prev  text,
    new_state text
  ) on commit drop;

  insert into tmp_pulse_next
  with
  -- DM conversations, keyed by their (exactly two) participants.
  dm_convs as (
    select c.id as conv_id,
           least(a.user_id, b.user_id)    as user_lo,
           greatest(a.user_id, b.user_id) as user_hi
    from public.conversations c
    join public.conversation_participants a on a.conversation_id = c.id
    join public.conversation_participants b on b.conversation_id = c.id
                                           and a.user_id < b.user_id
    where c.type = 'dm'
  ),
  -- DM messages between the pair, capped per day so a single chatty evening
  -- can't masquerade as a month of momentum.
  dm_msgs as (
    select d.user_lo, d.user_hi,
           sum(least(per_day.cnt, c_msg_daily_cap)) as capped_msgs,
           max(per_day.last_at)                     as last_at
    from dm_convs d
    join lateral (
      select m.created_at::date as day, count(*) as cnt, max(m.created_at) as last_at
      from public.messages m
      where m.conversation_id = d.conv_id
        and m.user_id in (d.user_lo, d.user_hi)
        and m.is_deleted is not true
        and m.created_at >= now() - c_window
      group by m.created_at::date
    ) per_day on true
    group by d.user_lo, d.user_hi
  ),
  -- Every participant pair of every group chat (event chats). Messages by
  -- EITHER member count toward the pair, capped per day. Quadratic in group
  -- size — fine at current scale for a nightly job; revisit with crew pulse.
  group_pairs as (
    select c.id as conv_id,
           least(a.user_id, b.user_id)    as user_lo,
           greatest(a.user_id, b.user_id) as user_hi
    from public.conversations c
    join public.conversation_participants a on a.conversation_id = c.id
    join public.conversation_participants b on b.conversation_id = c.id
                                           and a.user_id < b.user_id
    where c.type = 'group'
  ),
  grp_msgs as (
    select g.user_lo, g.user_hi,
           sum(least(per_day.cnt, c_msg_daily_cap)) as capped_msgs,
           max(per_day.last_at)                     as last_at
    from group_pairs g
    join lateral (
      select m.created_at::date as day, count(*) as cnt, max(m.created_at) as last_at
      from public.messages m
      where m.conversation_id = g.conv_id
        and m.user_id in (g.user_lo, g.user_hi)
        and m.is_deleted is not true
        and m.created_at >= now() - c_window
      group by m.created_at::date
    ) per_day on true
    group by g.user_lo, g.user_hi
  ),
  -- Distinct events both attended, dated within the window. Future RSVPs
  -- don't count yet — an interaction hasn't happened until the event has.
  coattend as (
    select least(a.user_id, b.user_id)    as user_lo,
           greatest(a.user_id, b.user_id) as user_hi,
           count(distinct a.event_id)     as events_together,
           max(e.date)                    as last_at
    from public.attendance a
    join public.attendance b on b.event_id = a.event_id and a.user_id < b.user_id
    join public.events e on e.id = a.event_id
    where e.date >= now() - c_window
      and e.date <= now()
    group by 1, 2
  ),
  friends as (
    select least(f.requester_id, f.addressee_id)    as user_lo,
           greatest(f.requester_id, f.addressee_id) as user_hi,
           max(f.updated_at)                        as accepted_at
    from public.friendships f
    where f.status = 'accepted'
    group by 1, 2
  ),
  -- Union of every pair with any signal, plus pairs we already track (their
  -- score must keep decaying even when all signals have aged out).
  pair_universe as (
    select user_lo, user_hi from dm_msgs
    union select user_lo, user_hi from grp_msgs
    union select user_lo, user_hi from coattend
    union select user_lo, user_hi from friends
    union select user_lo, user_hi from public.quest_ledger
    union select user_lo, user_hi from public.pair_pulse
  ),
  scored as (
    select u.user_lo, u.user_hi,
           ( coalesce(q.quest_count, 0)       * c_quest_pts
           + coalesce(ca.events_together, 0)  * c_coattend_pts
           + case when f.user_lo is not null then c_friend_pts else 0 end
           + coalesce(dm.capped_msgs, 0)      * c_dm_msg_pts
           + coalesce(g.capped_msgs, 0)       * c_group_msg_pts
           )::numeric as raw_score,
           -- Most recent signal of any kind. Falls back to the previously
           -- stored value so decay stays continuous when signals age out of
           -- the window (GREATEST ignores nulls).
           greatest(q.last_quest_at, ca.last_at, f.accepted_at,
                    dm.last_at, g.last_at, old.last_interaction_at) as last_interaction_at,
           old.state      as old_state,
           old.prev_state as old_prev
    from pair_universe u
    left join public.quest_ledger q  on q.user_lo  = u.user_lo and q.user_hi  = u.user_hi
    left join coattend ca            on ca.user_lo = u.user_lo and ca.user_hi = u.user_hi
    left join friends f              on f.user_lo  = u.user_lo and f.user_hi  = u.user_hi
    left join dm_msgs dm             on dm.user_lo = u.user_lo and dm.user_hi = u.user_hi
    left join grp_msgs g             on g.user_lo  = u.user_lo and g.user_hi  = u.user_hi
    left join public.pair_pulse old  on old.user_lo = u.user_lo and old.user_hi = u.user_hi
    where not exists (
      select 1 from public.blocked_users b
      where (b.blocker_id = u.user_lo and b.blocked_id = u.user_hi)
         or (b.blocker_id = u.user_hi and b.blocked_id = u.user_lo)
    )
  ),
  decayed as (
    select s.*,
           case
             when s.last_interaction_at is null then 0
             -- score = raw * 0.5 ^ (quiet_days / half_life). quiet_days is
             -- clamped at 0 so clock skew can never inflate a score.
             else round(
               s.raw_score * power(
                 0.5,
                 greatest(0, extract(epoch from (now() - s.last_interaction_at)) / 86400.0)
                   / c_half_life_days
               ), 2)
           end as score
    from scored s
  )
  select d.user_lo, d.user_hi, d.score, d.last_interaction_at,
         d.old_state, d.old_prev,
         case
           when d.score >= c_hot_min  then 'hot'
           when d.score >= c_warm_min then 'warm'
           -- *cooling means LOST momentum: only pairs that were hot/warm at
           -- some prior refresh (directly, or via the recorded prev_state
           -- chain) can cool. A pair that never warmed up is just cold.
           when d.score >= c_cooling_min
                and (d.old_state in ('hot','warm','cooling')
                     or d.old_prev in ('hot','warm','cooling')) then 'cooling'
           else 'cold'
         end as new_state
  from decayed d;

  -- 2. Drift detection: emit one event per hot/warm -> cooling transition.
  --    Idempotent across refreshes because a second run sees old_state =
  --    'cooling' and no longer matches.
  insert into public.engine_events (event_key, pair_lo, pair_hi, payload)
  select 'pulse.transition', n.user_lo, n.user_hi,
         jsonb_build_object('from', n.old_state, 'to', n.new_state, 'score', n.score)
  from tmp_pulse_next n
  where n.old_state in ('hot','warm')
    and n.new_state = 'cooling';

  -- 3. Persist the new pulse. prev_state only advances when the state
  --    actually changes, preserving "what were they before this".
  insert into public.pair_pulse as pp
        (user_lo, user_hi, score, state, prev_state, last_interaction_at, computed_at)
  select n.user_lo, n.user_hi, n.score, n.new_state,
         case when n.old_state is distinct from n.new_state
              then n.old_state else n.old_prev end,
         n.last_interaction_at, now()
  from tmp_pulse_next n
  on conflict (user_lo, user_hi) do update
    set score               = excluded.score,
        state               = excluded.state,
        prev_state          = excluded.prev_state,
        last_interaction_at = excluded.last_interaction_at,
        computed_at         = excluded.computed_at;

  -- 4. Nudge conversion: a 'nudge.sent' in the last 14 days followed by a
  --    newer interaction => 'nudge.converted', once per nudge (the NOT EXISTS
  --    on a converted event newer than that nudge makes re-runs no-ops).
  insert into public.engine_events (event_key, pair_lo, pair_hi, payload)
  select 'nudge.converted', s.pair_lo, s.pair_hi,
         jsonb_build_object(
           'nudge_event_id', s.id,
           'nudge_sent_at',  s.created_at,
           'interacted_at',  n.last_interaction_at
         )
  from (
    select distinct on (pair_lo, pair_hi) id, pair_lo, pair_hi, created_at
    from public.engine_events
    where event_key = 'nudge.sent'
      and created_at >= now() - c_nudge_window
    order by pair_lo, pair_hi, created_at desc
  ) s
  join tmp_pulse_next n on n.user_lo = s.pair_lo and n.user_hi = s.pair_hi
  where n.last_interaction_at > s.created_at
    and not exists (
      select 1 from public.engine_events c
      where c.event_key = 'nudge.converted'
        and c.pair_lo = s.pair_lo
        and c.pair_hi = s.pair_hi
        and c.created_at > s.created_at
    );
end;
$$;

-- Engine-internal: service-role/cron only. postgres (the owner, which pg_cron
-- runs as) can always execute; everyone else is locked out.
revoke all on function public.refresh_pair_pulse() from public, anon, authenticated;
grant execute on function public.refresh_pair_pulse() to service_role;

-- ---------------------------------------------------------------------------
-- Scheduling: nightly 03:30 UTC via pg_cron (see the commented pattern in
-- 20260706000000_lifecycle_infra.sql). Unlike the lifecycle-runner (an HTTP
-- edge function needing pg_net + a secret), this is a plain SQL call, so it
-- can be scheduled directly and safely from a migration. Every cron.* touch is
-- inside EXECUTE so the migration still applies cleanly where pg_cron is
-- unavailable — in that case run refresh manually / schedule externally:
--   select public.refresh_pair_pulse();
-- ---------------------------------------------------------------------------
do $$
declare
  v_scheduled boolean;
begin
  begin
    create extension if not exists pg_cron;
  exception when others then
    raise notice 'pair_pulse: pg_cron unavailable (%) — run refresh_pair_pulse() manually or schedule externally.', sqlerrm;
  end;

  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    execute $q$select exists (select 1 from cron.job where jobname = 'pair-pulse-nightly')$q$
      into v_scheduled;
    if not v_scheduled then
      execute $q$select cron.schedule('pair-pulse-nightly', '30 3 * * *', 'select public.refresh_pair_pulse()')$q$;
      raise notice 'pair_pulse: scheduled pair-pulse-nightly at 03:30 UTC.';
    end if;
  end if;
end $$;
