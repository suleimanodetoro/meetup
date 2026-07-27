-- Run against local Supabase only. Every mutation and test-only trigger is
-- rolled back. A failed assertion aborts the script.

begin;

create or replace function public.test_reject_intent_metric()
returns trigger
language plpgsql
as $$
begin
  if new.event_key = 'intent.submitted' and new.payload ->> 'energy' = '3' then
    raise exception 'TEST_INTENT_METRIC_REJECTED';
  end if;
  return new;
end;
$$;

create trigger test_reject_intent_metric
before insert on public.engine_events
for each row execute function public.test_reject_intent_metric();

do $$
declare
  v_user uuid;
  v_intents_before bigint;
  v_events_before bigint;
  v_intent_id bigint;
begin
  select p.id into v_user
  from public.profiles p
  where coalesce(p.onboarding_completed, false)
  order by p.id
  limit 1;

  if v_user is null then
    raise exception 'Intent capture test requires an onboarded profile';
  end if;

  if has_function_privilege(
    'anon',
    'public.capture_quest_intent(smallint,text,integer,smallint,text[])',
    'EXECUTE'
  ) then
    raise exception 'anon can execute capture_quest_intent';
  end if;
  if not has_function_privilege(
    'authenticated',
    'public.capture_quest_intent(smallint,text,integer,smallint,text[])',
    'EXECUTE'
  ) then
    raise exception 'authenticated cannot execute capture_quest_intent';
  end if;

  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config('request.jwt.claim.sub', v_user::text, true);

  -- Isolate the selected fixture inside this rollback-only transaction.
  delete from public.engine_events ee
  where ee.user_id = v_user and ee.event_key = 'intent.submitted';
  delete from public.quest_intents qi where qi.user_id = v_user;

  select count(*) into v_intents_before
  from public.quest_intents qi where qi.user_id = v_user;
  select count(*) into v_events_before
  from public.engine_events ee
  where ee.user_id = v_user and ee.event_key = 'intent.submitted';

  -- The generic compatibility logger cannot manufacture this metric without
  -- a corresponding uninstrumented intent row.
  begin
    perform public.log_engine_event(
      'intent.submitted',
      '{"energy": 1, "categories": ["invented"]}'::jsonb,
      null
    );
    raise exception 'generic logger manufactured an intent event';
  exception when raise_exception then
    if sqlerrm <> 'intent.submitted requires a recent uninstrumented intent' then
      raise;
    end if;
  end;

  -- Energy 3 activates the test-only rejecting trigger. The exception is
  -- handled in a PL/pgSQL subtransaction, so both inserts must disappear.
  begin
    perform public.capture_quest_intent(
      3::smallint,
      'group',
      60,
      1::smallint,
      array['social']
    );
    raise exception 'metric rejection did not abort capture';
  exception when raise_exception then
    if sqlerrm <> 'TEST_INTENT_METRIC_REJECTED' then
      raise;
    end if;
  end;

  if (select count(*) from public.quest_intents qi where qi.user_id = v_user)
     <> v_intents_before then
    raise exception 'failed metric left a quest_intents row behind';
  end if;
  if (select count(*) from public.engine_events ee
      where ee.user_id = v_user and ee.event_key = 'intent.submitted')
     <> v_events_before then
    raise exception 'failed capture left an intent.submitted event behind';
  end if;

  -- A normal call commits one linked intent and one event.
  v_intent_id := public.capture_quest_intent(
    2::smallint,
    'pair',
    90,
    1::smallint,
    array['cozy']
  );

  if (select count(*) from public.quest_intents qi
      where qi.id = v_intent_id and qi.user_id = v_user and qi.energy = 2) <> 1 then
    raise exception 'successful capture did not persist exactly one intent';
  end if;
  if (select count(*) from public.engine_events ee
      where ee.user_id = v_user
        and ee.event_key = 'intent.submitted'
        and (ee.payload ->> 'intent_id')::bigint = v_intent_id) <> 1 then
    raise exception 'successful capture did not persist exactly one linked event';
  end if;

  -- Installed-client compatibility: a separately persisted intent can be
  -- instrumented once, but the logger derives and links canonical data from
  -- that row rather than trusting the supplied payload.
  insert into public.quest_intents (user_id, energy, social, time_max, budget, categories)
  values (v_user, 1, 'solo', 30, 0, array['cozy'])
  returning id into v_intent_id;

  perform public.log_engine_event(
    'intent.submitted',
    '{"energy": 3, "categories": ["invented"]}'::jsonb,
    null
  );

  if (select count(*) from public.engine_events ee
      where ee.user_id = v_user
        and ee.event_key = 'intent.submitted'
        and (ee.payload ->> 'intent_id')::bigint = v_intent_id
        and ee.payload ->> 'energy' = '1'
        and ee.payload -> 'categories' = '["cozy"]'::jsonb) <> 1 then
    raise exception 'compatibility logger did not link canonical intent data';
  end if;

  begin
    perform public.log_engine_event('intent.submitted', '{}'::jsonb, null);
    raise exception 'compatibility logger instrumented the same intent twice';
  exception when raise_exception then
    if sqlerrm <> 'intent.submitted requires a recent uninstrumented intent' then
      raise;
    end if;
  end;

  raise notice 'intent capture atomicity, authorization, and compatibility checks passed';
end;
$$;

rollback;
