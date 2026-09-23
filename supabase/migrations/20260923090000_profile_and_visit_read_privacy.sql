-- Direct table reads must enforce the same visibility rules as discovery.
-- Keep the existing table/query shape for released clients, including profile
-- embeds in attendance and messages. An inaccessible embedded profile is null.
-- Owners retain complete access to their own profile and trips.

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

-- The referenced settings and block rows are themselves owner-scoped by RLS.
-- An invoker predicate would miss other users' settings and incoming blocks.
-- This definer reads them without exposing them or accepting a caller identity.
-- It does not read profiles, so using it in profiles RLS cannot recurse.
create or replace function private.can_read_profile(p_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null
    and p_profile_id is not null
    and (
      p_profile_id = auth.uid()
      or (
        not exists (
          select 1 from public.blocked_users b
          where (b.blocker_id = auth.uid() and b.blocked_id = p_profile_id)
             or (b.blocker_id = p_profile_id and b.blocked_id = auth.uid())
        )
        and (
          coalesce((
            select ups.profile_visibility
            from public.user_privacy_settings ups
            where ups.user_id = p_profile_id
          ), 'public') = 'public'
          or (
            (select ups.profile_visibility
             from public.user_privacy_settings ups
             where ups.user_id = p_profile_id) = 'friends_only'
            and exists (
              select 1 from public.friendships f
              where f.status = 'accepted'
                and ((f.requester_id = auth.uid() and f.addressee_id = p_profile_id)
                  or (f.requester_id = p_profile_id and f.addressee_id = auth.uid()))
            )
          )
        )
      )
    );
$$;

comment on function private.can_read_profile(uuid) is
  'Caller-bound profile/trip visibility: own rows, public/default, or accepted friends; blocks in either direction take precedence over access to another user.';

revoke all on function private.can_read_profile(uuid) from public, anon;
grant execute on function private.can_read_profile(uuid) to authenticated;

drop policy if exists "profiles_authenticated_read" on public.profiles;
create policy "profiles_authenticated_read"
  on public.profiles for select to authenticated
  using (private.can_read_profile(id));

drop policy if exists "visits_authenticated_read" on public.visits;
create policy "visits_authenticated_read"
  on public.visits for select to authenticated
  using (private.can_read_profile(user_id));

-- TRUNCATE is not subject to RLS; it is never a client operation.
revoke truncate on public.profiles, public.visits from authenticated;

-- These obsolete visit-ID RPCs were removed in 20260523120100, then accidentally
-- recreated by the discovery hardening migration. They have no app callers;
-- get_visit_details exposed the anchor trip regardless of its owner's privacy.
drop function if exists public.get_visit_details(bigint);
drop function if exists public.get_visit_users(bigint, integer);

-- Definer RPCs bypass table RLS. Apply the same predicate to each embedded
-- profile while preserving the event/chat data the caller is allowed to read.
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
  match_score int,
  lat double precision,
  lng double precision
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
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
      ST_Y(e.location_point::geometry) AS lat,
      ST_X(e.location_point::geometry) AS lng,
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
    s.match_score,
    s.lat,
    s.lng
  FROM scored s
  LEFT JOIN public.profiles host ON host.id = s.host_id
    AND private.can_read_profile(host.id)
  ORDER BY s.match_score DESC, s.date ASC, s.attendee_count DESC
  LIMIT page_limit OFFSET page_offset;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_user_conversations(p_user_id uuid)
RETURNS TABLE(
  conversation_id bigint,
  conversation_type text,
  conversation_name text,
  avatar_url text,
  last_message_content text,
  last_message_at timestamp with time zone,
  last_message_user_name text,
  unread_count bigint,
  participant_count bigint,
  event_id bigint,
  event_country_code text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
BEGIN
  IF auth.uid() IS NULL OR auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  WITH user_conversations AS (
    SELECT
      c.*,
      cp.last_read_at,
      cp.is_muted
    FROM conversations c
    JOIN conversation_participants cp ON c.id = cp.conversation_id
    WHERE cp.user_id = p_user_id
  ),
  conversation_messages AS (
    SELECT DISTINCT ON (m.conversation_id)
      m.conversation_id,
      m.content,
      m.created_at,
      p.full_name as sender_name
    FROM messages m
    LEFT JOIN profiles p ON m.user_id = p.id
      AND private.can_read_profile(p.id)
    WHERE m.is_deleted = false OR m.is_deleted IS NULL
    ORDER BY m.conversation_id, m.created_at DESC
  ),
  unread_counts AS (
    SELECT
      uc.id as conversation_id,
      COUNT(m.id) as unread_count
    FROM user_conversations uc
    LEFT JOIN messages m ON m.conversation_id = uc.id
    WHERE m.created_at > COALESCE(uc.last_read_at, '1970-01-01'::timestamp)
    AND (m.is_deleted = false OR m.is_deleted IS NULL)
    AND m.user_id != p_user_id
    GROUP BY uc.id
  ),
  participant_counts AS (
    SELECT
      cp.conversation_id as conversation_id,
      COUNT(*) as participant_count
    FROM conversation_participants cp
    GROUP BY cp.conversation_id
  )
  SELECT
    uc.id as conversation_id,
    uc.type as conversation_type,
    CASE
      WHEN uc.type = 'dm' THEN (
        SELECT p.full_name
        FROM conversation_participants cp2
        JOIN profiles p ON cp2.user_id = p.id
          AND private.can_read_profile(p.id)
        WHERE cp2.conversation_id = uc.id
        AND cp2.user_id != p_user_id
        LIMIT 1
      )
      ELSE uc.name
    END as conversation_name,
    CASE
      WHEN uc.type = 'dm' THEN (
        SELECT p.avatar_url
        FROM conversation_participants cp2
        JOIN profiles p ON cp2.user_id = p.id
          AND private.can_read_profile(p.id)
        WHERE cp2.conversation_id = uc.id
        AND cp2.user_id != p_user_id
        LIMIT 1
      )
      ELSE uc.avatar_url
    END as avatar_url,
    cm.content as last_message_content,
    cm.created_at as last_message_at,
    cm.sender_name as last_message_user_name,
    COALESCE(urc.unread_count, 0) as unread_count,
    pc.participant_count,
    uc.event_id,
    e.country_code as event_country_code
  FROM user_conversations uc
  LEFT JOIN conversation_messages cm ON cm.conversation_id = uc.id
  LEFT JOIN unread_counts urc ON urc.conversation_id = uc.id
  LEFT JOIN participant_counts pc ON pc.conversation_id = uc.id
  LEFT JOIN events e ON uc.event_id = e.id
  ORDER BY COALESCE(cm.created_at, uc.created_at) DESC;
END;
$function$;

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
    and private.can_read_profile(p.id)
  order by d.c_priority asc, d.c_activity_at desc nulls last, d.c_target asc
  limit greatest(coalesce(p_limit, 3), 0);
end;
$$;

-- PUBLIC execution survives a role-specific revoke. Discovery and inbox RPCs
-- are authenticated-only, matching the table grants and the mobile contract.
revoke all on function public.get_city_plans_ranked(text, date, date, integer, integer),
  public.get_city_meta_window(text, date, date),
  public.get_nearby_city_users(text, text),
  public.get_user_conversations(uuid)
  from public, anon;
grant execute on function public.get_city_plans_ranked(text, date, date, integer, integer),
  public.get_city_meta_window(text, date, date),
  public.get_nearby_city_users(text, text),
  public.get_user_conversations(uuid)
  to authenticated;
