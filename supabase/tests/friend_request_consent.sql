-- Run against the local seeded database only:
--   docker exec -i supabase_db_MeetupClone psql -U postgres -d postgres -X \
--     < supabase/tests/friend_request_consent.sql
--
-- Every data mutation is rolled back. A failed assertion aborts the script.

begin;

do $$
declare
  v_users uuid[];
  v_a uuid;
  v_b uuid;
  v_c uuid;
  v_friendship_id bigint;
  v_status text;
begin
  select array_agg(p.id order by p.id)
  into v_users
  from (
    select id
    from public.profiles
    order by id
    limit 3
  ) p;

  if coalesce(array_length(v_users, 1), 0) < 3 then
    raise exception 'Consent test requires at least three seeded profiles';
  end if;

  v_a := v_users[1];
  v_b := v_users[2];
  v_c := v_users[3];

  delete from public.blocked_users
  where blocker_id in (v_a, v_b, v_c) and blocked_id in (v_a, v_b, v_c);
  delete from public.friendships
  where requester_id in (v_a, v_b, v_c) and addressee_id in (v_a, v_b, v_c);
  delete from public.user_privacy_settings where user_id in (v_a, v_b, v_c);

  if has_table_privilege('authenticated', 'public.friendships', 'INSERT')
     or has_table_privilege('authenticated', 'public.friendships', 'UPDATE')
     or has_table_privilege('authenticated', 'public.friendships', 'DELETE') then
    raise exception 'authenticated still has direct friendship mutation privileges';
  end if;

  if has_table_privilege('anon', 'public.friendships', 'INSERT')
     or has_table_privilege('anon', 'public.friendships', 'UPDATE')
     or has_table_privilege('anon', 'public.friendships', 'DELETE') then
    raise exception 'anon still has direct friendship mutation privileges';
  end if;

  if not has_function_privilege(
    'authenticated', 'public.send_friend_request(uuid)', 'EXECUTE'
  ) or not has_function_privilege(
    'authenticated', 'public.respond_to_friend_request(uuid,boolean)', 'EXECUTE'
  ) or not has_function_privilege(
    'authenticated', 'public.cancel_friend_request(uuid)', 'EXECUTE'
  ) then
    raise exception 'authenticated is missing friendship RPC execution privileges';
  end if;

  if has_function_privilege('anon', 'public.send_friend_request(uuid)', 'EXECUTE')
     or has_function_privilege(
       'anon', 'public.respond_to_friend_request(uuid,boolean)', 'EXECUTE'
     )
     or has_function_privilege('anon', 'public.cancel_friend_request(uuid)', 'EXECUTE') then
    raise exception 'anon can execute friendship mutation RPCs';
  end if;

  perform set_config('request.jwt.claim.sub', v_a::text, true);

  if public.can_send_friend_request(v_a) then
    raise exception 'self-request was eligible';
  end if;

  insert into public.user_privacy_settings (user_id, allow_friend_requests)
  values (v_b, false);

  if public.can_send_friend_request(v_b) then
    raise exception 'allow_friend_requests=false was ignored';
  end if;

  begin
    perform public.send_friend_request(v_b);
    raise exception 'send succeeded while requests were disabled';
  exception when sqlstate '42501' or sqlstate '22023' then
    null;
  end;

  update public.user_privacy_settings
  set allow_friend_requests = true, profile_visibility = 'private'
  where user_id = v_b;

  if public.can_send_friend_request(v_b) then
    raise exception 'private profile was eligible';
  end if;

  update public.user_privacy_settings
  set profile_visibility = 'public'
  where user_id = v_b;

  insert into public.blocked_users (blocker_id, blocked_id) values (v_b, v_a);
  if public.can_send_friend_request(v_b) then
    raise exception 'reverse-direction block was ignored';
  end if;
  delete from public.blocked_users where blocker_id = v_b and blocked_id = v_a;

  if not public.can_send_friend_request(v_b) then
    raise exception 'eligible request was rejected';
  end if;

  v_friendship_id := public.send_friend_request(v_b);
  if v_friendship_id is null or not exists (
    select 1 from public.friendships
    where id = v_friendship_id
      and requester_id = v_a
      and addressee_id = v_b
      and status = 'pending'
  ) then
    raise exception 'pending request was not created correctly';
  end if;

  if public.can_send_friend_request(v_b) then
    raise exception 'existing relationship row did not suppress another request';
  end if;

  -- The requester cannot accept their own request.
  begin
    perform public.respond_to_friend_request(v_a, true);
    raise exception 'requester manufactured acceptance';
  exception when sqlstate '42501' or sqlstate '22023' then
    null;
  end;

  perform set_config('request.jwt.claim.sub', v_b::text, true);
  v_status := public.respond_to_friend_request(v_a, true);
  if v_status <> 'accepted' then
    raise exception 'addressee acceptance failed';
  end if;

  -- Blocking either party is authoritative and severs the accepted row.
  insert into public.blocked_users (blocker_id, blocked_id) values (v_b, v_a);
  if exists (
    select 1 from public.friendships
    where (requester_id = v_a and addressee_id = v_b)
       or (requester_id = v_b and addressee_id = v_a)
  ) then
    raise exception 'block did not sever friendship state';
  end if;
  delete from public.blocked_users where blocker_id = v_b and blocked_id = v_a;

  -- Requesters can cancel pending requests, but only through the RPC.
  perform set_config('request.jwt.claim.sub', v_a::text, true);
  perform public.send_friend_request(v_c);
  if not public.cancel_friend_request(v_c) then
    raise exception 'requester could not cancel pending request';
  end if;
  if exists (
    select 1 from public.friendships
    where requester_id = v_a and addressee_id = v_c
  ) then
    raise exception 'cancel left the pending row behind';
  end if;

  raise notice 'friend request consent regression checks passed';
end;
$$;

rollback;
