-- Persist a create-plan intent and its instrumentation as one database fact.
-- The client previously issued two independent requests, so a rejected intent
-- insert could still be followed by a successful intent.submitted event.

create or replace function public.capture_quest_intent(
  p_energy     smallint default null,
  p_social     text default null,
  p_time_max   integer default null,
  p_budget     smallint default null,
  p_categories text[] default null
)
returns bigint
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_city text;
  v_country_code text;
  v_intent_id bigint;
begin
  if v_uid is null then
    raise exception using errcode = '42501', message = 'not authenticated';
  end if;
  if p_energy is not null and p_energy not between 1 and 3 then
    raise exception using errcode = '22023', message = 'invalid energy';
  end if;
  if p_social is not null and p_social not in ('solo', 'pair', 'group', 'either') then
    raise exception using errcode = '22023', message = 'invalid social mode';
  end if;
  if p_time_max is not null and p_time_max <= 0 then
    raise exception using errcode = '22023', message = 'invalid time maximum';
  end if;
  if p_budget is not null and p_budget not between 0 and 2 then
    raise exception using errcode = '22023', message = 'invalid budget';
  end if;
  if cardinality(p_categories) > 32
     or pg_column_size(coalesce(to_jsonb(p_categories), '[]'::jsonb)) > 4096 then
    raise exception using errcode = '22023', message = 'categories payload too large';
  end if;

  select p.location, p.location_country_code
  into v_city, v_country_code
  from public.profiles p
  where p.id = v_uid;

  if not found then
    raise exception using errcode = '23503', message = 'profile not found';
  end if;

  insert into public.quest_intents (
    user_id,
    city,
    country_code,
    energy,
    social,
    time_max,
    budget,
    categories
  ) values (
    v_uid,
    v_city,
    v_country_code,
    p_energy,
    p_social,
    p_time_max,
    p_budget,
    nullif(p_categories, array[]::text[])
  )
  returning id into v_intent_id;

  -- This insert is deliberately in the same function/transaction. Any metric
  -- failure aborts and rolls back the quest_intents row as well.
  insert into public.engine_events (event_key, user_id, payload)
  values (
    'intent.submitted',
    v_uid,
    jsonb_build_object(
      'intent_id', v_intent_id,
      'energy', p_energy,
      'social', p_social,
      'time_max', p_time_max,
      'budget', p_budget,
      'categories', coalesce(to_jsonb(p_categories), '[]'::jsonb)
    )
  );

  return v_intent_id;
end;
$$;

comment on function public.capture_quest_intent(smallint, text, integer, smallint, text[]) is
  'Atomically persists the authenticated user''s quest intent and exactly one intent.submitted engine event.';

revoke all on function public.capture_quest_intent(smallint, text, integer, smallint, text[])
  from public, anon;
grant execute on function public.capture_quest_intent(smallint, text, integer, smallint, text[])
  to authenticated;

-- Backward compatibility for installed clients that still insert the intent
-- first and then call log_engine_event('intent.submitted'). The generic logger
-- may emit that key only by locking and linking a real, recent, uninstrumented
-- intent. It cannot manufacture an intent event from caller-supplied payload.
create or replace function public.log_engine_event(
  p_event_key text,
  p_payload   jsonb default '{}'::jsonb,
  p_event_id  bigint default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_intent public.quest_intents%rowtype;
  v_allowed constant text[] := array[
    'confidence.prompt_shown',
    'confidence.prompt_accepted',
    'confidence.prompt_dismissed',
    'intent.submitted'
  ];
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;
  if p_event_key is null or not (p_event_key = any (v_allowed)) then
    raise exception 'event_key % is not client-emittable', coalesce(p_event_key, '<null>');
  end if;

  if p_event_key = 'intent.submitted' then
    perform pg_advisory_xact_lock(hashtextextended('intent-event:' || v_uid::text, 0));

    select qi.* into v_intent
    from public.quest_intents qi
    where qi.user_id = v_uid
      and qi.created_at >= now() - interval '10 minutes'
      and not exists (
        select 1
        from public.engine_events ee
        where ee.user_id = v_uid
          and ee.event_key = 'intent.submitted'
          and ee.payload ->> 'intent_id' = qi.id::text
      )
    order by qi.created_at desc, qi.id desc
    limit 1;

    if not found then
      raise exception 'intent.submitted requires a recent uninstrumented intent';
    end if;

    p_payload := jsonb_build_object(
      'intent_id', v_intent.id,
      'energy', v_intent.energy,
      'social', v_intent.social,
      'time_max', v_intent.time_max,
      'budget', v_intent.budget,
      'categories', coalesce(to_jsonb(v_intent.categories), '[]'::jsonb)
    );
    p_event_id := null;
  end if;

  if pg_column_size(coalesce(p_payload, '{}'::jsonb)) > 8192 then
    raise exception 'payload too large';
  end if;

  insert into public.engine_events (event_key, user_id, event_id, payload)
  values (p_event_key, v_uid, p_event_id, coalesce(p_payload, '{}'::jsonb));
end;
$$;

revoke all on function public.log_engine_event(text, jsonb, bigint) from anon, public;
grant execute on function public.log_engine_event(text, jsonb, bigint) to authenticated;
