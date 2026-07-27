-- Run against the local seeded database only:
--   psql postgresql://postgres:postgres@127.0.0.1:54322/postgres \
--     -X -v ON_ERROR_STOP=1 -f supabase/tests/autogen_transactional_idempotency.sql
--
-- Every mutation is rolled back. A failed assertion aborts the script.

begin;

do $$
declare
  v_users uuid[];
  v_host uuid;
  v_cluster_one uuid[];
  v_cluster_cancel uuid[];
  v_cluster_keep uuid[];
  v_quest_id bigint;
  v_first record;
  v_repeat record;
  v_cancel_event record;
  v_keep_event record;
  v_count integer;
  v_before integer;
  v_worker_one constant uuid := '10000000-0000-4000-8000-000000000001';
  v_worker_two constant uuid := '20000000-0000-4000-8000-000000000002';
  v_claim_ids bigint[];
  v_key_before text;
  v_key_after text;
  v_report jsonb;
  v_city_one text := 'OC3 Atomic ' || txid_current()::text;
  v_city_cancel text := 'OC3 Threshold ' || txid_current()::text;
begin
  select array_agg(candidate.id order by candidate.id)
  into v_users
  from (
    select p.id
    from public.profiles p
    join auth.users u on u.id = p.id
    where coalesce(p.onboarding_completed, false)
      and coalesce((select ups.profile_visibility
                    from public.user_privacy_settings ups
                    where ups.user_id = p.id), 'public') <> 'private'
      and not exists (
        select 1 from public.autogen_invites ai
        where ai.user_id = p.id
          and ai.invite_week = date_trunc('week', now() at time zone 'UTC')::date
      )
    order by p.id
    limit 10
  ) candidate;

  if coalesce(cardinality(v_users), 0) < 10 then
    raise exception 'Auto-Generate test requires ten eligible seeded users';
  end if;

  v_host := v_users[1];
  v_cluster_one := v_users[2:4];
  v_cluster_cancel := v_users[5:7];
  v_cluster_keep := v_users[8:10];

  select q.id into v_quest_id
  from public.quest_catalog q
  where q.is_active and q.risk_tier = 1 and q.social_mode in ('group', 'either')
  order by q.id
  limit 1;
  if v_quest_id is null then
    raise exception 'Auto-Generate test requires an eligible quest template';
  end if;

  if has_function_privilege(
    'authenticated',
    'public.reserve_autogen_event(text,text,text,text,timestamptz,uuid,bigint,uuid[],integer)',
    'EXECUTE'
  ) or has_function_privilege(
    'anon',
    'public.reserve_autogen_event(text,text,text,text,timestamptz,uuid,bigint,uuid[],integer)',
    'EXECUTE'
  ) then
    raise exception 'non-service role can reserve generated events';
  end if;
  if not has_function_privilege(
    'service_role',
    'public.reserve_autogen_event(text,text,text,text,timestamptz,uuid,bigint,uuid[],integer)',
    'EXECUTE'
  ) then
    raise exception 'service_role cannot reserve generated events';
  end if;
  if has_table_privilege('authenticated', 'public.autogen_invites', 'SELECT')
     or has_table_privilege('anon', 'public.autogen_generations', 'SELECT') then
    raise exception 'Auto-Generate internals are exposed to clients';
  end if;

  -- One RPC commits the event, tag, creation metric, outbox, and lifecycle
  -- claims. Use a slot outside the cancellation horizon for this case.
  select * into v_first
  from public.reserve_autogen_event(
    'hot', v_city_one, 'United Kingdom', 'GB', now() + interval '10 days',
    v_host, v_quest_id, v_cluster_one, 2
  );
  if not v_first.created then
    raise exception 'first reservation was not reported as created';
  end if;

  select * into v_repeat
  from public.reserve_autogen_event(
    'hot', upper(v_city_one), 'United Kingdom', 'GB', now() + interval '10 days',
    v_host, v_quest_id, v_cluster_one, 2
  );
  -- now() is transaction-stable, and city identity is case-insensitive.
  if v_repeat.created or v_repeat.event_id <> v_first.event_id
     or v_repeat.generation_key <> v_first.generation_key then
    raise exception 'same generation slot did not converge on the original event';
  end if;

  select count(*) into v_count from public.events e where e.id = v_first.event_id;
  if v_count <> 1 then raise exception 'reservation did not create exactly one event'; end if;
  select count(*) into v_count from public.quest_tags qt where qt.event_id = v_first.event_id;
  if v_count <> 1 then raise exception 'reservation did not create exactly one tag row'; end if;
  select count(*) into v_count from public.engine_events ee
  where ee.event_id = v_first.event_id and ee.event_key = 'autogen.created';
  if v_count <> 1 then raise exception 'reservation did not create exactly one creation metric'; end if;
  select count(*) into v_count from public.autogen_invites ai where ai.event_id = v_first.event_id;
  if v_count <> 3 then raise exception 'reservation did not create all three outbox rows'; end if;
  select count(*) into v_count from public.lifecycle_events le
  where le.job_key = 'autogen:' || v_first.event_id::text and le.status = 'pending';
  if v_count <> 3 then raise exception 'reservation did not create all three lifecycle claims first'; end if;

  -- A different generation that races for the same users in the same ISO week
  -- must fail as a unit. No event, tag, metric, or partial invite may survive.
  select count(*) into v_before from public.events e where e.city = v_city_one || ' Conflict';
  begin
    perform * from public.reserve_autogen_event(
      'daily', v_city_one || ' Conflict', 'United Kingdom', 'GB', now() + interval '11 days',
      v_host, v_quest_id, v_cluster_one, 2
    );
    raise exception 'weekly invitation conflict was accepted';
  exception when sqlstate 'P0001' then
    if sqlerrm not in ('AUTOGEN_WEEKLY_INVITE_CONFLICT', 'AUTOGEN_CONCURRENT_CLAIM_CONFLICT') then
      raise;
    end if;
  end;
  select count(*) into v_count from public.events e where e.city = v_city_one || ' Conflict';
  if v_count <> v_before then
    raise exception 'failed reservation left an orphan event';
  end if;

  -- Lease all three emails. A second worker cannot also own them.
  select array_agg(c.invite_id order by c.invite_id) into v_claim_ids
  from public.claim_autogen_invites(v_worker_one, v_first.event_id, 10, 600) c;
  if cardinality(v_claim_ids) <> 3 then
    raise exception 'first worker did not claim exactly three invitations';
  end if;
  select count(*) into v_count
  from public.claim_autogen_invites(v_worker_two, v_first.event_id, 10, 600);
  if v_count <> 0 then raise exception 'second worker duplicated a live lease'; end if;

  select ai.idempotency_key into v_key_before
  from public.autogen_invites ai where ai.id = v_claim_ids[1];

  -- Retryable ambiguity returns to pending without claiming success. The key
  -- remains stable when the lease is reclaimed, which makes provider retry safe.
  if public.complete_autogen_invite(
    v_claim_ids[1], v_worker_one, 'failed', 'simulated timeout', null, true
  ) <> 'pending' then
    raise exception 'retryable failure did not return to pending';
  end if;
  perform public.complete_autogen_invite(
    v_claim_ids[2], v_worker_one, 'sent', null, 'resend_test_id', false
  );
  perform public.complete_autogen_invite(
    v_claim_ids[3], v_worker_one, 'skipped', 'no email', null, false
  );

  begin
    perform public.complete_autogen_invite(
      v_claim_ids[2], v_worker_one, 'sent', null, 'resend_test_id', false
    );
    raise exception 'completed invitation was completed twice';
  exception when sqlstate 'P0001' then
    if sqlerrm <> 'AUTOGEN_INVITE_CLAIM_LOST' then raise; end if;
  end;

  select count(*) into v_count
  from public.claim_autogen_invites(v_worker_two, v_first.event_id, 10, 600);
  if v_count <> 0 then raise exception 'backoff was ignored'; end if;

  update public.autogen_invites
  set next_attempt_at = now() - interval '1 second'
  where id = v_claim_ids[1];

  select c.idempotency_key into v_key_after
  from public.claim_autogen_invites(v_worker_two, v_first.event_id, 10, 600) c;
  if v_key_after is distinct from v_key_before then
    raise exception 'provider idempotency key changed across retry';
  end if;
  perform public.complete_autogen_invite(
    v_claim_ids[1], v_worker_two, 'sent', null, 'resend_retry_id', false
  );

  select count(*) into v_count from public.engine_events ee
  where ee.event_id = v_first.event_id and ee.event_key = 'autogen.invited';
  if v_count <> 3 then raise exception 'invite outcomes were not recorded exactly once'; end if;
  select count(*) into v_count from public.engine_events ee
  where ee.event_id = v_first.event_id and ee.event_key = 'autogen.invite_retry_scheduled';
  if v_count <> 1 then raise exception 'retry scheduling metric missing or duplicated'; end if;

  -- An ambiguous send older than the provider's idempotency window is never
  -- retried blindly. It is dead-lettered for review instead of risking mail #2.
  update public.autogen_invites
  set status = 'processing', worker_token = v_worker_one,
      lease_expires_at = now() - interval '1 minute',
      first_attempt_at = now() - interval '24 hours'
  where id = v_claim_ids[3];
  update public.lifecycle_events le
  set status = 'pending'
  from public.autogen_invites ai
  where ai.id = v_claim_ids[3] and le.id = ai.lifecycle_event_id;

  select count(*) into v_count
  from public.claim_autogen_invites(v_worker_two, v_first.event_id, 10, 600);
  if v_count <> 0 then raise exception 'expired provider safety window was retried'; end if;
  if (select ai.status from public.autogen_invites ai where ai.id = v_claim_ids[3]) <> 'failed' then
    raise exception 'expired ambiguous delivery was not dead-lettered';
  end if;
  if not exists (
    select 1 from public.engine_events ee
    where ee.event_id = v_first.event_id
      and ee.user_id = v_cluster_one[3]
      and ee.event_key = 'autogen.invite_abandoned'
      and ee.payload ->> 'reason' = 'provider_idempotency_window_expired'
  ) then
    raise exception 'expired ambiguous delivery lacks an audit metric';
  end if;

  -- Two generated events in one city: host + one real person must cancel;
  -- host + two real people must remain active. The host is never attendance.
  select * into v_cancel_event
  from public.reserve_autogen_event(
    'hot', v_city_cancel, 'United Kingdom', 'GB', now() + interval '2 hours',
    v_host, v_quest_id, v_cluster_cancel, 2
  );
  select * into v_keep_event
  from public.reserve_autogen_event(
    'hot', v_city_cancel, 'United Kingdom', 'GB', now() + interval '3 hours',
    v_host, v_quest_id, v_cluster_keep, 2
  );

  update public.events set created_at = now() - interval '7 hours'
  where id in (v_cancel_event.event_id, v_keep_event.event_id);

  insert into public.attendance (event_id, user_id) values
    (v_cancel_event.event_id, v_host),
    (v_cancel_event.event_id, v_cluster_cancel[1]),
    (v_keep_event.event_id, v_host),
    (v_keep_event.event_id, v_cluster_keep[1]),
    (v_keep_event.event_id, v_cluster_keep[2]);

  v_report := public.cancel_underfilled_autogen_events(v_host, 24, 6, 2);

  if (select e.status from public.events e where e.id = v_cancel_event.event_id) <> 'cancelled' then
    raise exception 'host plus one participant incorrectly met the threshold';
  end if;
  if (select e.status from public.events e where e.id = v_keep_event.event_id) <> 'active' then
    raise exception 'two genuine participants did not meet the threshold';
  end if;
  if not (v_report -> 'cancelled' @> jsonb_build_array(jsonb_build_object(
    'event_id', v_cancel_event.event_id,
    'city', v_city_cancel,
    'participant_count', 1
  ))) then
    raise exception 'cancellation report did not expose the genuine participant count: %', v_report;
  end if;
  if not exists (
    select 1 from public.engine_events ee
    where ee.event_id = v_cancel_event.event_id
      and ee.event_key = 'autogen.cancelled'
      and ee.payload @> '{"participant_count": 1, "system_host_excluded": true}'::jsonb
  ) then
    raise exception 'cancellation metric does not prove host exclusion';
  end if;
  if exists (
    select 1 from public.autogen_invites ai
    where ai.event_id = v_cancel_event.event_id and ai.status in ('pending', 'processing')
  ) then
    raise exception 'cancelled event retained deliverable invitation work';
  end if;

  raise notice 'Auto-Generate transactional idempotency, retry safety, and host-excluded threshold passed';
end;
$$;

rollback;
