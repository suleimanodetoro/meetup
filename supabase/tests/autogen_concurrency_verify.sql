do $$
declare
  v_event_id bigint;
  v_count bigint;
begin
  select count(*), min(ag.event_id) into v_count, v_event_id
  from public.autogen_generations ag
  where ag.city_key = 'oc3 concurrency regression';
  if v_count <> 1 then
    raise exception 'concurrent reservation created % generation rows, expected one', v_count;
  end if;
  if (select count(*) from public.events e where e.id = v_event_id) <> 1 then
    raise exception 'concurrent reservation did not converge on one event';
  end if;
  if (select count(*) from public.quest_tags qt where qt.event_id = v_event_id) <> 1 then
    raise exception 'concurrent reservation did not converge on one tag';
  end if;
  if (select count(*) from public.engine_events ee
      where ee.event_id = v_event_id and ee.event_key = 'autogen.created') <> 1 then
    raise exception 'concurrent reservation did not converge on one creation metric';
  end if;
  if (select count(*) from public.autogen_invites ai where ai.event_id = v_event_id) <> 3 then
    raise exception 'concurrent reservation did not converge on three invites';
  end if;
  if (select count(*) from public.lifecycle_events le
      where le.job_key = 'autogen:' || v_event_id::text) <> 3 then
    raise exception 'concurrent reservation did not converge on three lifecycle claims';
  end if;

  delete from public.engine_events ee where ee.event_id = v_event_id;
  delete from public.lifecycle_events le where le.job_key = 'autogen:' || v_event_id::text;
  delete from public.events e where e.id = v_event_id;

  raise notice 'Auto-Generate two-connection concurrency regression passed';
end;
$$;
