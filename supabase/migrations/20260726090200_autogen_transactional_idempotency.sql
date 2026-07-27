-- Auto-Generate: transactional creation, durable invite outbox, and honest
-- participant thresholds.
--
-- The edge function may discover and rank candidates, but it must not assemble
-- a generated quest through separate PostgREST writes.  reserve_autogen_event
-- is the single commit boundary for the event, tags, creation metric, weekly
-- invite reservations, and lifecycle claims.  A deterministic generation key
-- plus a city-scoped transaction lock makes overlapping cron ticks converge on
-- one event.

-- A claimed lifecycle job is a real state, not a successful/skipped delivery.
alter table public.lifecycle_events
  drop constraint if exists lifecycle_events_status_check;

alter table public.lifecycle_events
  add constraint lifecycle_events_status_check
  check (status in ('pending', 'sent', 'skipped', 'failed'));

create table public.autogen_generations (
  generation_key       text primary key,
  event_id              bigint not null unique references public.events(id) on delete cascade,
  path                  text not null check (path in ('hot', 'daily')),
  city_key              text not null,
  city                  text not null,
  country               text,
  country_code          text,
  scheduled_for         timestamptz not null,
  system_host_user_id   uuid not null references public.profiles(id) on delete restrict,
  quest_catalog_id      bigint not null references public.quest_catalog(id) on delete restrict,
  quest_slug            text not null,
  quest_title           text not null,
  quest_dare            text not null,
  cluster_user_ids      uuid[] not null,
  created_at            timestamptz not null default now(),
  constraint autogen_generation_key_length check (length(generation_key) between 1 and 512),
  constraint autogen_generation_cluster_size
    check (cardinality(cluster_user_ids) between 3 and 6)
);

comment on table public.autogen_generations is
  'Immutable idempotency record for each auto-generated quest. One row is committed atomically with the event, tags, metric, invite outbox rows, and lifecycle claims.';

create index autogen_generations_city_live_idx
  on public.autogen_generations (system_host_user_id, city_key, scheduled_for desc);

create table public.autogen_invites (
  id                  bigint generated always as identity primary key,
  generation_key      text not null references public.autogen_generations(generation_key) on delete cascade,
  event_id            bigint not null references public.events(id) on delete cascade,
  user_id             uuid not null references auth.users(id) on delete cascade,
  lifecycle_event_id  bigint not null unique references public.lifecycle_events(id) on delete cascade,
  invite_week         date not null,
  recipient_email     text,
  recipient_name      text,
  idempotency_key     text not null unique,
  status              text not null default 'pending'
    check (status in ('pending', 'processing', 'sent', 'skipped', 'failed')),
  attempt_count       integer not null default 0 check (attempt_count >= 0),
  first_attempt_at    timestamptz,
  worker_token        uuid,
  lease_expires_at    timestamptz,
  next_attempt_at     timestamptz not null default now(),
  provider_email_id   text,
  detail              text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  delivered_at        timestamptz,
  constraint autogen_invites_event_user unique (event_id, user_id),
  -- This is the database-enforced version of "one auto-invite per ISO week".
  -- A pre-read in an edge function cannot enforce this under concurrency.
  constraint autogen_invites_user_week unique (user_id, invite_week),
  constraint autogen_invites_idempotency_key_length
    check (length(idempotency_key) between 1 and 256)
);

comment on table public.autogen_invites is
  'Service-only transactional outbox for Auto-Generate email invitations. Rows and lifecycle claims exist before any external email call.';

create index autogen_invites_dispatch_idx
  on public.autogen_invites (next_attempt_at, created_at)
  where status in ('pending', 'processing');

alter table public.autogen_generations enable row level security;
alter table public.autogen_invites enable row level security;
revoke all on public.autogen_generations from public, anon, authenticated;
revoke all on public.autogen_invites from public, anon, authenticated;

create or replace function public.reserve_autogen_event(
  p_path                text,
  p_city                text,
  p_country             text,
  p_country_code        text,
  p_scheduled_for       timestamptz,
  p_system_host_user_id uuid,
  p_quest_catalog_id    bigint,
  p_cluster_user_ids    uuid[],
  p_max_live_city_events integer default 2
)
returns table (
  event_id        bigint,
  generation_key text,
  created         boolean
)
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_city text := btrim(p_city);
  v_city_key text;
  v_generation_key text;
  v_cluster uuid[];
  v_quest public.quest_catalog%rowtype;
  v_event_id bigint;
  v_lifecycle_id bigint;
  v_user_id uuid;
  v_profile record;
  v_invite_week date := date_trunc('week', now() at time zone 'UTC')::date;
  v_live_count integer;
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role'
     and session_user <> 'postgres' then
    raise exception using errcode = '42501', message = 'service role required';
  end if;

  if p_path not in ('hot', 'daily') then
    raise exception using errcode = '22023', message = 'invalid Auto-Generate path';
  end if;
  if v_city is null or v_city = '' or p_scheduled_for is null
     or p_system_host_user_id is null or p_quest_catalog_id is null then
    raise exception using errcode = '22023', message = 'missing Auto-Generate input';
  end if;
  if p_max_live_city_events < 1 then
    raise exception using errcode = '22023', message = 'invalid city event cap';
  end if;

  select array_agg(u order by u)
  into v_cluster
  from (select distinct x as u from unnest(p_cluster_user_ids) x where x is not null) s;

  if cardinality(v_cluster) not between 3 and 6
     or cardinality(v_cluster) <> cardinality(p_cluster_user_ids)
     or p_system_host_user_id = any(v_cluster) then
    raise exception using errcode = '22023', message = 'cluster must contain 3-6 distinct non-host users';
  end if;

  select * into v_quest
  from public.quest_catalog q
  where q.id = p_quest_catalog_id
    and q.is_active
    and q.risk_tier = 1
    and q.social_mode in ('group', 'either');
  if not found then
    raise exception using errcode = '22023', message = 'quest template is not eligible for Auto-Generate';
  end if;

  if (select count(*) from public.profiles p
      where p.id = any(v_cluster)
        and coalesce(p.onboarding_completed, false)
        and coalesce((select ups.profile_visibility
                      from public.user_privacy_settings ups
                      where ups.user_id = p.id), 'public') <> 'private')
     <> cardinality(v_cluster) then
    raise exception using errcode = '22023', message = 'cluster contains an ineligible user';
  end if;

  v_city_key := lower(regexp_replace(v_city, '\s+', ' ', 'g'));
  -- The time slot, not the selected template or cohort, is the identity. Two
  -- overlapping jobs that made slightly different choices for the same city
  -- and slot still converge on the first committed event.
  v_generation_key := concat(
    'autogen:v1:', p_path, ':', v_city_key, ':',
    to_char(p_scheduled_for at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')
  );

  -- Serialise all generated-event decisions for a city, including decisions
  -- with different generation keys, so the live-city cap cannot be raced.
  perform pg_advisory_xact_lock(hashtextextended(
    'autogen-city:' || p_system_host_user_id::text || ':' || v_city_key, 0
  ));

  select g.event_id into v_event_id
  from public.autogen_generations g
  where g.generation_key = v_generation_key;
  if found then
    return query select v_event_id, v_generation_key, false;
    return;
  end if;

  select count(*) into v_live_count
  from public.events e
  where e.user_id = p_system_host_user_id
    and e.status = 'active'
    and e.date > now()
    and lower(regexp_replace(btrim(e.city), '\s+', ' ', 'g')) = v_city_key;
  if v_live_count >= p_max_live_city_events then
    raise exception using errcode = 'P0001', message = 'AUTOGEN_CITY_CAP_REACHED';
  end if;

  -- Reject the whole operation if another transaction claimed any member's
  -- weekly invitation. The unique(user_id, invite_week) constraint below is
  -- the final concurrency guard; this check gives a clearer error normally.
  if exists (
    select 1 from public.autogen_invites ai
    where ai.user_id = any(v_cluster) and ai.invite_week = v_invite_week
  ) then
    raise exception using errcode = 'P0001', message = 'AUTOGEN_WEEKLY_INVITE_CONFLICT';
  end if;

  insert into public.events (
    user_id, kind, status, is_private, title, description, city, country,
    country_code, interests, location_point, location_name, date,
    quest_catalog_id
  ) values (
    p_system_host_user_id, 'open', 'active', false, v_quest.title,
    v_quest.dare, v_city, p_country, p_country_code, v_quest.interests,
    null, 'Meet central ' || v_city || ' — exact spot in the chat',
    p_scheduled_for, v_quest.id
  ) returning id into v_event_id;

  insert into public.quest_tags (
    event_id, vibe, energy_level, social_mode, duration_min, risk_tier,
    is_solo_safe, is_seed
  ) values (
    v_event_id, v_quest.vibe, v_quest.energy_level, v_quest.social_mode,
    v_quest.duration_min, v_quest.risk_tier, v_quest.is_solo_safe, false
  );

  insert into public.autogen_generations (
    generation_key, event_id, path, city_key, city, country, country_code,
    scheduled_for, system_host_user_id, quest_catalog_id, quest_slug,
    quest_title, quest_dare, cluster_user_ids
  ) values (
    v_generation_key, v_event_id, p_path, v_city_key, v_city, p_country,
    p_country_code, p_scheduled_for, p_system_host_user_id, v_quest.id,
    v_quest.slug, v_quest.title, v_quest.dare, v_cluster
  );

  insert into public.engine_events (event_key, event_id, payload)
  values (
    'autogen.created', v_event_id,
    jsonb_build_object(
      'path', p_path,
      'city', v_city,
      'cluster_size', cardinality(v_cluster),
      'catalog_slug', v_quest.slug,
      'generation_key', v_generation_key
    )
  );

  foreach v_user_id in array v_cluster loop
    select p.full_name, u.email into v_profile
    from public.profiles p
    join auth.users u on u.id = p.id
    where p.id = v_user_id;

    insert into public.lifecycle_events (user_id, job_key, status, detail)
    values (v_user_id, 'autogen:' || v_event_id::text, 'pending', 'invite reserved transactionally')
    returning id into v_lifecycle_id;

    insert into public.autogen_invites (
      generation_key, event_id, user_id, lifecycle_event_id, invite_week,
      recipient_email, recipient_name, idempotency_key
    ) values (
      v_generation_key, v_event_id, v_user_id, v_lifecycle_id, v_invite_week,
      v_profile.email, v_profile.full_name,
      'autogen-invite/' || v_event_id::text || '/' || v_user_id::text
    );
  end loop;

  return query select v_event_id, v_generation_key, true;
exception
  when unique_violation then
    -- Any weekly-invite race aborts every write performed by this function's
    -- statement subtransaction. Never leave a partial generated event behind.
    raise exception using errcode = 'P0001', message = 'AUTOGEN_CONCURRENT_CLAIM_CONFLICT';
end;
$$;

comment on function public.reserve_autogen_event(text,text,text,text,timestamptz,uuid,bigint,uuid[],integer) is
  'Service-only atomic boundary for generated quest creation and invite reservation. Safe to retry with the same city/path/time slot.';

create or replace function public.claim_autogen_invites(
  p_worker_token uuid,
  p_event_id bigint default null,
  p_limit integer default 20,
  p_lease_seconds integer default 600
)
returns table (
  invite_id bigint,
  event_id bigint,
  user_id uuid,
  recipient_email text,
  recipient_name text,
  idempotency_key text,
  attempt_count integer,
  path text,
  city text,
  scheduled_for timestamptz,
  quest_title text,
  quest_dare text
)
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_stale record;
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role'
     and session_user <> 'postgres' then
    raise exception using errcode = '42501', message = 'service role required';
  end if;
  if p_worker_token is null or p_limit not between 1 and 100
     or p_lease_seconds not between 60 and 3600 then
    raise exception using errcode = '22023', message = 'invalid invite claim parameters';
  end if;

  -- Resend retains idempotency keys for 24 hours. If an edge worker died after
  -- an ambiguous provider response and no recovery occurred within a 23-hour
  -- safety window, do not risk a duplicate external send. Dead-letter it for
  -- operator review, keeping lifecycle state and instrumentation consistent.
  for v_stale in
    select ai.id, ai.user_id, ai.event_id, ai.lifecycle_event_id, ai.attempt_count
    from public.autogen_invites ai
    where (p_event_id is null or ai.event_id = p_event_id)
      and ai.status = 'processing'
      and ai.lease_expires_at <= now()
      and ai.first_attempt_at <= now() - interval '23 hours'
    order by ai.id
    for update skip locked
  loop
    update public.autogen_invites
    set status = 'failed', worker_token = null, lease_expires_at = null,
        detail = 'ambiguous delivery exceeded provider idempotency window; manual review required',
        updated_at = now()
    where id = v_stale.id;

    update public.lifecycle_events
    set status = 'failed',
        detail = 'ambiguous delivery exceeded provider idempotency window; manual review required'
    where id = v_stale.lifecycle_event_id;

    insert into public.engine_events (event_key, user_id, event_id, payload)
    values (
      'autogen.invite_abandoned', v_stale.user_id, v_stale.event_id,
      jsonb_build_object(
        'attempts', v_stale.attempt_count,
        'reason', 'provider_idempotency_window_expired'
      )
    );
  end loop;

  return query
  with candidates as (
    select ai.id
    from public.autogen_invites ai
    join public.events e on e.id = ai.event_id
    where (p_event_id is null or ai.event_id = p_event_id)
      and e.status = 'active'
      and e.date > now()
      and (
        (ai.status = 'pending' and ai.attempt_count < 3 and ai.next_attempt_at <= now())
        or (
          ai.status = 'processing'
          and ai.lease_expires_at <= now()
          and ai.first_attempt_at > now() - interval '23 hours'
        )
      )
    order by ai.created_at, ai.id
    -- Lock the event too. The cancellation RPC takes the same row lock, so an
    -- invite cannot be claimed concurrently with cancellation.
    for update of ai, e skip locked
    limit p_limit
  ), claimed as (
    update public.autogen_invites ai
    set status = 'processing',
        worker_token = p_worker_token,
        lease_expires_at = now() + make_interval(secs => p_lease_seconds),
        attempt_count = ai.attempt_count + 1,
        first_attempt_at = coalesce(ai.first_attempt_at, now()),
        updated_at = now()
    from candidates c
    where ai.id = c.id
    returning ai.*
  )
  select c.id, c.event_id, c.user_id, c.recipient_email, c.recipient_name,
         c.idempotency_key, c.attempt_count, g.path, g.city,
         g.scheduled_for, g.quest_title, g.quest_dare
  from claimed c
  join public.autogen_generations g on g.generation_key = c.generation_key
  order by c.id;
end;
$$;

comment on function public.claim_autogen_invites(uuid,bigint,integer,integer) is
  'Leased, SKIP LOCKED service-only claim for the Auto-Generate invite outbox. Expired claims are safely retried with the same provider idempotency key.';

create or replace function public.complete_autogen_invite(
  p_invite_id bigint,
  p_worker_token uuid,
  p_delivery text,
  p_detail text default null,
  p_provider_email_id text default null,
  p_retryable boolean default false
)
returns text
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_invite public.autogen_invites%rowtype;
  v_final_status text;
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role'
     and session_user <> 'postgres' then
    raise exception using errcode = '42501', message = 'service role required';
  end if;
  if p_delivery not in ('sent', 'skipped', 'failed') then
    raise exception using errcode = '22023', message = 'invalid invite delivery result';
  end if;

  select * into v_invite
  from public.autogen_invites ai
  where ai.id = p_invite_id
  for update;

  if not found or v_invite.status <> 'processing'
     or v_invite.worker_token is distinct from p_worker_token then
    raise exception using errcode = 'P0001', message = 'AUTOGEN_INVITE_CLAIM_LOST';
  end if;

  if p_delivery = 'failed' and p_retryable and v_invite.attempt_count < 3 then
    update public.autogen_invites
    set status = 'pending', worker_token = null, lease_expires_at = null,
        next_attempt_at = now() + interval '5 minutes',
        detail = left(p_detail, 500), updated_at = now()
    where id = p_invite_id;

    update public.lifecycle_events
    set status = 'pending', detail = left(p_detail, 500)
    where id = v_invite.lifecycle_event_id;

    insert into public.engine_events (event_key, user_id, event_id, payload)
    values (
      'autogen.invite_retry_scheduled', v_invite.user_id, v_invite.event_id,
      jsonb_build_object('attempt', v_invite.attempt_count)
    );
    return 'pending';
  end if;

  v_final_status := p_delivery;
  update public.autogen_invites
  set status = v_final_status, worker_token = null, lease_expires_at = null,
      provider_email_id = p_provider_email_id, detail = left(p_detail, 500),
      updated_at = now(),
      delivered_at = case when v_final_status = 'sent' then now() else delivered_at end
  where id = p_invite_id;

  update public.lifecycle_events
  set status = v_final_status, detail = left(p_detail, 500)
  where id = v_invite.lifecycle_event_id;

  insert into public.engine_events (event_key, user_id, event_id, payload)
  select 'autogen.invited', v_invite.user_id, v_invite.event_id,
         jsonb_build_object(
           'delivery', v_final_status,
           'attempts', v_invite.attempt_count,
           'path', g.path,
           'city', g.city
         )
  from public.autogen_generations g
  where g.generation_key = v_invite.generation_key;

  return v_final_status;
end;
$$;

comment on function public.complete_autogen_invite(bigint,uuid,text,text,text,boolean) is
  'Atomically completes or reschedules a claimed Auto-Generate invite, its lifecycle row, and its delivery metric.';

create or replace function public.cancel_underfilled_autogen_events(
  p_system_host_user_id uuid,
  p_horizon_hours integer default 24,
  p_min_age_hours integer default 6,
  p_min_participants integer default 2
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_event record;
  v_invite record;
  v_participant_count integer;
  v_swept integer := 0;
  v_cancelled jsonb := '[]'::jsonb;
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role'
     and session_user <> 'postgres' then
    raise exception using errcode = '42501', message = 'service role required';
  end if;
  if p_horizon_hours < 1 or p_min_age_hours < 0 or p_min_participants < 1 then
    raise exception using errcode = '22023', message = 'invalid cancellation parameters';
  end if;

  for v_event in
    select e.id, e.city
    from public.events e
    join public.autogen_generations g on g.event_id = e.id
    where e.user_id = p_system_host_user_id
      and e.status = 'active'
      and e.date > now()
      and e.date <= now() + make_interval(hours => p_horizon_hours)
      and e.created_at <= now() - make_interval(hours => p_min_age_hours)
    order by e.date, e.id
    for update of e skip locked
  loop
    v_swept := v_swept + 1;

    -- A delivery worker already holding a lease is allowed to finish; defer
    -- cancellation to a later sweep instead of emailing a cancelled event.
    if exists (
      select 1 from public.autogen_invites ai
      where ai.event_id = v_event.id and ai.status = 'processing'
    ) then
      continue;
    end if;

    select count(distinct a.user_id)::integer into v_participant_count
    from public.attendance a
    where a.event_id = v_event.id
      and a.user_id <> p_system_host_user_id;

    if v_participant_count >= p_min_participants then
      continue;
    end if;

    update public.events set status = 'cancelled'
    where id = v_event.id and status = 'active';

    -- Pending/retryable invitations become terminal skips in the same
    -- transaction as cancellation. claim_autogen_invites also locks the event,
    -- so no new delivery can slip between these statements.
    for v_invite in
      select ai.id, ai.user_id, ai.lifecycle_event_id, ai.attempt_count
      from public.autogen_invites ai
      where ai.event_id = v_event.id and ai.status in ('pending', 'failed')
      for update
    loop
      update public.autogen_invites
      set status = 'skipped', worker_token = null, lease_expires_at = null,
          detail = 'event cancelled before invite delivery', updated_at = now()
      where id = v_invite.id;

      update public.lifecycle_events
      set status = 'skipped', detail = 'event cancelled before invite delivery'
      where id = v_invite.lifecycle_event_id;

      insert into public.engine_events (event_key, user_id, event_id, payload)
      values (
        'autogen.invited', v_invite.user_id, v_event.id,
        jsonb_build_object(
          'delivery', 'skipped',
          'attempts', v_invite.attempt_count,
          'reason', 'event_cancelled'
        )
      );
    end loop;

    insert into public.engine_events (event_key, event_id, payload)
    values (
      'autogen.cancelled', v_event.id,
      jsonb_build_object(
        'city', v_event.city,
        'participant_count', v_participant_count,
        'system_host_excluded', true
      )
    );

    v_cancelled := v_cancelled || jsonb_build_array(jsonb_build_object(
      'event_id', v_event.id,
      'city', v_event.city,
      'participant_count', v_participant_count
    ));
  end loop;

  return jsonb_build_object('swept', v_swept, 'cancelled', v_cancelled);
end;
$$;

comment on function public.cancel_underfilled_autogen_events(uuid,integer,integer,integer) is
  'Atomically cancels underfilled generated events and records metrics. Counts distinct genuine participants and explicitly excludes the system host.';

revoke all on function public.reserve_autogen_event(text,text,text,text,timestamptz,uuid,bigint,uuid[],integer)
  from public, anon, authenticated;
revoke all on function public.claim_autogen_invites(uuid,bigint,integer,integer)
  from public, anon, authenticated;
revoke all on function public.complete_autogen_invite(bigint,uuid,text,text,text,boolean)
  from public, anon, authenticated;
revoke all on function public.cancel_underfilled_autogen_events(uuid,integer,integer,integer)
  from public, anon, authenticated;

grant execute on function public.reserve_autogen_event(text,text,text,text,timestamptz,uuid,bigint,uuid[],integer)
  to service_role;
grant execute on function public.claim_autogen_invites(uuid,bigint,integer,integer)
  to service_role;
grant execute on function public.complete_autogen_invite(bigint,uuid,text,text,text,boolean)
  to service_role;
grant execute on function public.cancel_underfilled_autogen_events(uuid,integer,integer,integer)
  to service_role;
