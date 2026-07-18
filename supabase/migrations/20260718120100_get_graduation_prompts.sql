-- =====================================================
-- get_graduation_prompts — when to suggest group → friend (Confidence, spec 03)
-- =====================================================
-- Returns up to p_limit graduation prompts for the CALLING user: people the
-- engine thinks they should send a friend request to, with a display context.
-- The layer prompts — it never bypasses privacy gates (the request itself still
-- goes through the normal friendships insert + acceptance flow).
--
-- Candidate sources (union → exclude → dedup → rank):
--   * post_quest_add — co-attendees of a shared event that finished recently:
--     completed in the last 7 days, or its date passed in the last 7 days
--     (cancelled quests are not shared activity). context = event title.
--   * warm_pair_add — pairs currently warm/hot in pair_pulse with the caller.
--     context = neutral "crossing paths" line, plus the quest_ledger count
--     when the pair has one.
--
-- Universal exclusions, both sources:
--   * blocked_users in either direction
--   * target has allow_friend_requests = false, or profile_visibility 'private'
--   * a prompt_dismissals row for (caller, target, THIS prompt_type)
--   * ANY friendships row in either direction — accepted (already friends),
--     pending (already asked: never nag), declined (respect the no), blocked
--
-- Rank: post_quest_add before warm_pair_add; within a type, most recent shared
-- activity first. A target eligible via both sources appears once, keeping the
-- higher-priority (post_quest_add) prompt — unless that specific prompt type
-- was dismissed, in which case the surviving type may still surface them.
--
-- SECURITY DEFINER: reads other users' privacy settings, pair_pulse rows and
-- attendance to make the decision, but only ever exposes name/avatar/context
-- for people the caller shared real activity with.

create or replace function public.get_graduation_prompts(p_limit int default 3)
returns table(
  prompt_type       text,
  target_id         uuid,
  target_name       text,
  target_avatar_url text,
  context           text,
  rank              int
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    return;
  end if;

  return query
  with post_quest as (
    -- one row per co-attendee; context/recency from their most recent
    -- qualifying shared event
    select
      'post_quest_add'::text as c_type,
      a2.user_id             as c_target,
      max(coalesce(e.completed_at, e.date)) as c_activity_at,
      (array_agg(e.title order by coalesce(e.completed_at, e.date) desc))[1]
                             as c_context,
      1                      as c_priority
    from public.attendance a1
    join public.attendance a2
      on a2.event_id = a1.event_id and a2.user_id <> a1.user_id
    join public.events e on e.id = a1.event_id
    where a1.user_id = v_uid
      and (
        (e.status = 'completed'
          and e.completed_at >= now() - interval '7 days')
        or (coalesce(e.status, 'active') <> 'cancelled'
          and e.date <= now()
          and e.date >= now() - interval '7 days')
      )
    group by a2.user_id
  ),
  warm_pair as (
    select
      'warm_pair_add'::text as c_type,
      case when pp.user_lo = v_uid then pp.user_hi else pp.user_lo end
                            as c_target,
      coalesce(pp.last_interaction_at, pp.computed_at) as c_activity_at,
      case
        when coalesce(ql.quest_count, 0) >= 1 then format(
          'You two keep crossing paths — %s sidequest%s together',
          ql.quest_count, case when ql.quest_count = 1 then '' else 's' end)
        else 'You two keep crossing paths'
      end                   as c_context,
      2                     as c_priority
    from public.pair_pulse pp
    left join public.quest_ledger ql
      on ql.user_lo = pp.user_lo and ql.user_hi = pp.user_hi
    where pp.state in ('warm', 'hot')
      and v_uid in (pp.user_lo, pp.user_hi)
  ),
  candidates as (
    select pq.c_type, pq.c_target, pq.c_activity_at, pq.c_context, pq.c_priority
      from post_quest pq
    union all
    select wp.c_type, wp.c_target, wp.c_activity_at, wp.c_context, wp.c_priority
      from warm_pair wp
  ),
  allowed as (
    select c.*
    from candidates c
    where not exists (
        select 1 from public.blocked_users bl
        where (bl.blocker_id = v_uid and bl.blocked_id = c.c_target)
           or (bl.blocker_id = c.c_target and bl.blocked_id = v_uid))
      -- both settings default when the target has no privacy row
      and coalesce((select ups.allow_friend_requests
                      from public.user_privacy_settings ups
                     where ups.user_id = c.c_target), true)
      and coalesce((select ups.profile_visibility
                      from public.user_privacy_settings ups
                     where ups.user_id = c.c_target), 'public') <> 'private'
      and not exists (
        select 1 from public.prompt_dismissals pd
        where pd.user_id = v_uid
          and pd.target_id = c.c_target
          and pd.prompt_type = c.c_type)
      and not exists (
        select 1 from public.friendships f
        where (f.requester_id = v_uid and f.addressee_id = c.c_target)
           or (f.requester_id = c.c_target and f.addressee_id = v_uid))
  ),
  deduped as (
    select distinct on (al.c_target) al.*
    from allowed al
    order by al.c_target, al.c_priority asc, al.c_activity_at desc nulls last
  )
  select
    d.c_type,
    d.c_target,
    coalesce(p.full_name, p.username) as t_name,
    p.avatar_url                      as t_avatar,
    d.c_context,
    (row_number() over (
       order by d.c_priority asc, d.c_activity_at desc nulls last, d.c_target asc
     ))::int                          as t_rank
  from deduped d
  join public.profiles p on p.id = d.c_target
  order by d.c_priority asc, d.c_activity_at desc nulls last, d.c_target asc
  limit greatest(coalesce(p_limit, 3), 0);
end;
$$;

comment on function public.get_graduation_prompts(int) is
  'Confidence Layer: up to p_limit "add them as a friend?" prompts for the caller (post_quest_add > warm_pair_add), honouring blocks, privacy gates, dismissals and existing friendship rows.';

revoke all on function public.get_graduation_prompts(int) from public, anon;
grant execute on function public.get_graduation_prompts(int) to authenticated;

-- The RPC enters attendance by caller id; the only existing index leads with
-- event_id. This also serves the profile screen's attendance-by-user query.
create index if not exists idx_attendance_user_event
  on public.attendance (user_id, event_id);
