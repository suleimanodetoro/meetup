-- Local-only fixtures are loaded by scripts/test-db.sh. All changes here roll
-- back. SELECT checks run as authenticated, not the RLS-bypassing test owner.
begin;

create temporary table privacy_expectations (
  user_id uuid primary key,
  scenario text not null,
  visible boolean not null
);
insert into privacy_expectations values
  ('70000000-0000-4000-8000-000000000001', 'own private profile', true),
  ('70000000-0000-4000-8000-000000000002', 'public stranger', true),
  ('70000000-0000-4000-8000-000000000003', 'missing privacy settings', true),
  ('70000000-0000-4000-8000-000000000004', 'friends-only accepted outgoing', true),
  ('70000000-0000-4000-8000-000000000005', 'friends-only accepted incoming', true),
  ('70000000-0000-4000-8000-000000000006', 'friends-only pending', false),
  ('70000000-0000-4000-8000-000000000007', 'private accepted friend', false),
  ('70000000-0000-4000-8000-000000000008', 'blocked by caller', false),
  ('70000000-0000-4000-8000-000000000009', 'blocks caller', false),
  ('70000000-0000-4000-8000-000000000010', 'friends-only declined', false),
  ('70000000-0000-4000-8000-000000000011', 'friends-only stranger', false),
  ('70000000-0000-4000-8000-000000000012', 'null visibility defaults public', true);
grant select on privacy_expectations to authenticated;

delete from public.blocked_users
where blocker_id in (select user_id from privacy_expectations)
  and blocked_id in (select user_id from privacy_expectations);
delete from public.friendships
where requester_id in (select user_id from privacy_expectations)
  and addressee_id in (select user_id from privacy_expectations);
delete from public.user_privacy_settings
where user_id in (select user_id from privacy_expectations);
insert into public.user_privacy_settings (user_id, profile_visibility)
select user_id, case
  when scenario in ('own private profile', 'private accepted friend') then 'private'
  when scenario like 'friends-only%' then 'friends_only'
  when scenario = 'null visibility defaults public' then null
  else 'public'
end
from privacy_expectations where scenario <> 'missing privacy settings';

insert into public.friendships (requester_id, addressee_id, status) values
  ('70000000-0000-4000-8000-000000000001', '70000000-0000-4000-8000-000000000004', 'accepted'),
  ('70000000-0000-4000-8000-000000000005', '70000000-0000-4000-8000-000000000001', 'accepted'),
  ('70000000-0000-4000-8000-000000000001', '70000000-0000-4000-8000-000000000006', 'pending'),
  ('70000000-0000-4000-8000-000000000007', '70000000-0000-4000-8000-000000000001', 'accepted'),
  ('70000000-0000-4000-8000-000000000010', '70000000-0000-4000-8000-000000000001', 'declined');
insert into public.blocked_users (blocker_id, blocked_id) values
  ('70000000-0000-4000-8000-000000000001', '70000000-0000-4000-8000-000000000008'),
  ('70000000-0000-4000-8000-000000000009', '70000000-0000-4000-8000-000000000001');

delete from public.visits where user_id in (select user_id from privacy_expectations);
insert into public.visits (user_id, city, country, start_date, end_date)
select user_id, 'Privacy Regression City', 'United Kingdom', current_date, current_date + 7
from privacy_expectations;

-- Give every target an event, and every other target a DM and a warm-pair
-- candidate. Privacy must also hold in definer RPC projections.
update public.profiles set avatar_url = 'privacy-regression://' || id::text
where id in (select user_id from privacy_expectations);
insert into public.events (title, user_id, city, date)
select scenario, user_id, 'Privacy Regression RPC City', now() + interval '1 day'
from privacy_expectations;

create temporary table privacy_conversations (
  conversation_id bigint primary key,
  user_id uuid not null,
  visible boolean not null
);
grant select on privacy_conversations to authenticated;
do $$
declare
  v_case record;
  v_conversation_id bigint;
  v_caller uuid := '70000000-0000-4000-8000-000000000001';
begin
  for v_case in select * from privacy_expectations where user_id <> v_caller loop
    insert into public.conversations (type) values ('dm') returning id into v_conversation_id;
    insert into public.conversation_participants (conversation_id, user_id)
    values (v_conversation_id, v_caller), (v_conversation_id, v_case.user_id);
    insert into public.messages (conversation_id, user_id, content)
    values (v_conversation_id, v_case.user_id, 'Privacy regression message');
    insert into privacy_conversations values (v_conversation_id, v_case.user_id, v_case.visible);
    insert into public.pair_pulse (user_lo, user_hi, score, state)
    values (v_caller, v_case.user_id, 70, 'warm')
    on conflict (user_lo, user_hi) do update set score = 70, state = 'warm';
  end loop;
end;
$$;
delete from public.prompt_dismissals
where user_id = '70000000-0000-4000-8000-000000000001'
  and target_id in (select user_id from privacy_expectations);
update public.user_privacy_settings set allow_friend_requests = false
where user_id = '70000000-0000-4000-8000-000000000002';

select set_config('request.jwt.claim.role', 'authenticated', true),
       set_config('request.jwt.claim.sub', '70000000-0000-4000-8000-000000000001', true);
set local role authenticated;

do $$
declare
  v_case record;
  v_count integer;
  v_visit_id bigint;
  v_profile_id uuid;
  v_rpc record;
begin
  for v_case in select * from privacy_expectations loop
    if (exists (select 1 from public.profiles where id = v_case.user_id))
       is distinct from v_case.visible then
      raise exception 'Direct profile RLS failed: %', v_case.scenario;
    end if;
    if (exists (select 1 from public.visits where user_id = v_case.user_id))
       is distinct from v_case.visible then
      raise exception 'Direct visit RLS failed: %', v_case.scenario;
    end if;
  end loop;

  -- Bulk reads/joins must filter the same rows as targeted reads.
  select count(*) into v_count
  from public.profiles p join public.visits v on v.user_id = p.id
  join privacy_expectations e on e.user_id = p.id;
  if v_count <> 6 then
    raise exception 'Bulk profile/visit join returned % rows; expected 6', v_count;
  end if;

  select count(*) into v_count from public.get_city_plans_ranked('Privacy Regression RPC City');
  if v_count <> 12 then raise exception 'Privacy filtering removed event rows'; end if;
  for v_rpc in
    select r.host_name, r.host_avatar, e.scenario, e.visible
    from public.get_city_plans_ranked('Privacy Regression RPC City') r
    join public.events ev on ev.id = r.event_id
    join privacy_expectations e on e.user_id = ev.user_id
  loop
    if (v_rpc.host_name is not null) is distinct from v_rpc.visible
       or (v_rpc.host_avatar is not null) is distinct from v_rpc.visible then
      raise exception 'City plans leaked/missed host profile: %', v_rpc.scenario;
    end if;
  end loop;

  select count(*) into v_count
  from public.get_user_conversations(auth.uid()) r
  join privacy_conversations c on c.conversation_id = r.conversation_id;
  if v_count <> 11 then raise exception 'Privacy filtering removed DM rows'; end if;
  for v_rpc in
    select r.*, c.visible
    from public.get_user_conversations(auth.uid()) r
    join privacy_conversations c on c.conversation_id = r.conversation_id
  loop
    if (v_rpc.conversation_name is not null) is distinct from v_rpc.visible
       or (v_rpc.avatar_url is not null) is distinct from v_rpc.visible
       or (v_rpc.last_message_user_name is not null) is distinct from v_rpc.visible then
      raise exception 'Conversation profile projection ignored privacy';
    end if;
    if v_rpc.last_message_content is distinct from 'Privacy regression message' then
      raise exception 'Hidden sender profile suppressed the readable message';
    end if;
  end loop;

  if exists (
    select 1 from public.get_graduation_prompts(100) r
    join privacy_expectations e on e.user_id = r.target_id
    where not e.visible or e.scenario = 'public stranger'
  ) then
    raise exception 'Friend prompt ignored visibility or allow_friend_requests';
  end if;
  select count(*) into v_count from public.get_graduation_prompts(100)
  where target_id in ('70000000-0000-4000-8000-000000000003', '70000000-0000-4000-8000-000000000012');
  if v_count <> 2 then raise exception 'Eligible public friend prompts disappeared'; end if;

  if to_regprocedure('public.get_visit_details(bigint)') is not null
     or to_regprocedure('public.get_visit_users(bigint,integer)') is not null then
    raise exception 'Obsolete trip-ID RPCs still expose hidden visit anchors';
  end if;
  if has_function_privilege('anon', 'public.get_city_plans_ranked(text,date,date,integer,integer)', 'EXECUTE')
     or has_function_privilege('anon', 'public.get_city_meta_window(text,date,date)', 'EXECUTE')
     or has_function_privilege('anon', 'public.get_nearby_city_users(text,text)', 'EXECUTE')
     or has_function_privilege('anon', 'public.get_user_conversations(uuid)', 'EXECUTE') then
    raise exception 'Anonymous caller can execute authenticated discovery/inbox RPCs';
  end if;

  -- Privacy changes must not break profile editing or trip CRUD for the owner.
  update public.profiles set bio = 'Privacy regression own profile update'
  where id = auth.uid() returning id into v_profile_id;
  if v_profile_id is distinct from auth.uid() then
    raise exception 'Private owner could not update/read their profile';
  end if;
  insert into public.visits (user_id, city, start_date, end_date)
  values (auth.uid(), 'Owner CRUD', current_date, current_date + 1)
  returning id into v_visit_id;
  update public.visits set city = 'Owner CRUD updated' where id = v_visit_id;
  if not exists (select 1 from public.visits where id = v_visit_id and city = 'Owner CRUD updated') then
    raise exception 'Private owner could not insert/update/read their visit';
  end if;
  delete from public.visits where id = v_visit_id;
  if exists (select 1 from public.visits where id = v_visit_id) then
    raise exception 'Private owner could not delete their visit';
  end if;

  -- Visibility grants read access only; another user's public rows stay immutable.
  update public.profiles set bio = 'Unauthorized update'
  where id = '70000000-0000-4000-8000-000000000002';
  get diagnostics v_count = row_count;
  if v_count <> 0 then raise exception 'Caller updated another profile'; end if;
  delete from public.visits where user_id = '70000000-0000-4000-8000-000000000002';
  get diagnostics v_count = row_count;
  if v_count <> 0 then raise exception 'Caller deleted another user''s visit'; end if;

  if has_table_privilege('anon', 'public.profiles', 'SELECT')
     or has_table_privilege('anon', 'public.visits', 'SELECT') then
    raise exception 'Anonymous table read privileges were restored';
  end if;
  if has_function_privilege('anon', 'private.can_read_profile(uuid)', 'EXECUTE') then
    raise exception 'Anonymous caller can execute the privacy helper';
  end if;
  if has_table_privilege('authenticated', 'public.profiles', 'TRUNCATE')
     or has_table_privilege('authenticated', 'public.visits', 'TRUNCATE') then
    raise exception 'Authenticated clients retain RLS-bypassing TRUNCATE';
  end if;
end;
$$;

-- A role without an authenticated identity must see no rows, including public.
select set_config('request.jwt.claim.sub', '', true);
do $$
begin
  if exists (select 1 from public.profiles) or exists (select 1 from public.visits) then
    raise exception 'Missing caller identity did not fail closed';
  end if;
end;
$$;

reset role;
rollback;
