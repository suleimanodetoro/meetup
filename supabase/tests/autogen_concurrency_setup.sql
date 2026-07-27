do $$
declare
  v_event_ids bigint[];
begin
  select array_agg(ag.event_id) into v_event_ids
  from public.autogen_generations ag
  where ag.city_key = 'oc3 concurrency regression';

  if cardinality(v_event_ids) > 0 then
    delete from public.engine_events ee where ee.event_id = any(v_event_ids);
    delete from public.lifecycle_events le
    where le.job_key = any(
      select 'autogen:' || event_id::text from unnest(v_event_ids) event_id
    );
    delete from public.events e where e.id = any(v_event_ids);
  end if;

  if (select count(*) from public.profiles p
      where coalesce(p.onboarding_completed, false)
        and coalesce((select ups.profile_visibility
                      from public.user_privacy_settings ups
                      where ups.user_id = p.id), 'public') <> 'private') < 4 then
    raise exception 'Concurrency test requires four eligible profiles';
  end if;
  if not exists (
    select 1 from public.quest_catalog q
    where q.is_active and q.risk_tier = 1 and q.social_mode in ('group', 'either')
  ) then
    raise exception 'Concurrency test requires an eligible quest template';
  end if;
end;
$$;
