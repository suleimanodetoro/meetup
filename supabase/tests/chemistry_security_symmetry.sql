-- Run against the local seeded database only:
--   psql postgresql://postgres:postgres@127.0.0.1:54322/postgres \
--     -X -v ON_ERROR_STOP=1 -f supabase/tests/chemistry_security_symmetry.sql
--
-- Every data mutation is rolled back. A failed assertion aborts the script.

begin;

do $$
declare
  v_users uuid[];
  v_a uuid;
  v_b uuid;
  v_c uuid;
  v_ab record;
  v_ba record;
  v_pair record;
  v_pair_count int := 0;
begin
  select array_agg(p.id order by p.id)
  into v_users
  from (
    select id
    from public.profiles
    where coalesce(onboarding_completed, false)
    order by id
    limit 30
  ) p;

  if coalesce(array_length(v_users, 1), 0) < 3 then
    raise exception 'Chemistry test requires at least three onboarded profiles';
  end if;

  v_a := v_users[1];
  v_b := v_users[2];
  v_c := v_users[3];

  if has_function_privilege(
    'authenticated', 'public.chemistry_score(uuid,uuid)', 'EXECUTE'
  ) then
    raise exception 'authenticated can execute raw Chemistry';
  end if;

  if not has_function_privilege(
    'service_role', 'public.chemistry_score(uuid,uuid)', 'EXECUTE'
  ) then
    raise exception 'service_role is missing Chemistry execute privileges';
  end if;

  if has_function_privilege('anon', 'public.chemistry_score(uuid,uuid)', 'EXECUTE') then
    raise exception 'anon can execute Chemistry';
  end if;

  -- Exercise the function's defence-in-depth check with authenticated JWT
  -- claims. In production these claims arrive through the discovery RPCs,
  -- whose owner is allowed to execute raw Chemistry.
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config('request.jwt.claim.sub', v_a::text, true);

  select cs.score, cs.reasons into v_ab
  from public.chemistry_score(v_a, v_b) cs;
  select cs.score, cs.reasons into v_ba
  from public.chemistry_score(v_b, v_a) cs;

  if v_ab.score is distinct from v_ba.score
     or v_ab.reasons is distinct from v_ba.reasons then
    raise exception 'pair-member call is asymmetric: %/% vs %/%',
      v_ab.score, v_ab.reasons, v_ba.score, v_ba.reasons;
  end if;

  -- The same authenticated claim cannot probe a pair of two other people.
  begin
    perform * from public.chemistry_score(v_b, v_c);
    raise exception 'authenticated caller probed an unrelated pair';
  exception when sqlstate '42501' then
    null;
  end;

  -- A forged/non-authenticated role is denied even if its sub matches a pair.
  perform set_config('request.jwt.claim.role', 'anon', true);
  begin
    perform * from public.chemistry_score(v_a, v_b);
    raise exception 'anon-role caller reached Chemistry';
  exception when sqlstate '42501' then
    null;
  end;

  -- Auto-Generate's service-role context can score arbitrary pairs. Check all
  -- unordered pairs in the bounded sample in both directions, including the
  -- reason array, so viewer-relative logic cannot regress silently.
  perform set_config('request.jwt.claim.role', 'service_role', true);
  perform set_config('request.jwt.claim.sub', '', true);

  for v_pair in
    select a.id as a_id, b.id as b_id
    from unnest(v_users) with ordinality a(id, ord)
    join unnest(v_users) with ordinality b(id, ord) on a.ord < b.ord
  loop
    select cs.score, cs.reasons into v_ab
    from public.chemistry_score(v_pair.a_id, v_pair.b_id) cs;
    select cs.score, cs.reasons into v_ba
    from public.chemistry_score(v_pair.b_id, v_pair.a_id) cs;

    if v_ab.score is distinct from v_ba.score
       or v_ab.reasons is distinct from v_ba.reasons then
      raise exception 'asymmetric pair %/%: %/% vs %/%',
        v_pair.a_id, v_pair.b_id,
        v_ab.score, v_ab.reasons, v_ba.score, v_ba.reasons;
    end if;

    v_pair_count := v_pair_count + 1;
  end loop;

  if v_pair_count < 3 then
    raise exception 'too few Chemistry pairs were exercised';
  end if;

  raise notice 'Chemistry authorization passed; % pairs were symmetric', v_pair_count;
end;
$$;

-- Exercise both public discovery RPCs as the real `authenticated` database
-- role. Their SECURITY DEFINER owner may execute raw Chemistry, while the JWT
-- claims still constrain every nested score to (caller, candidate).
with discovery_fixture as (
  select p.location as city, p.location_country as country,
         (array_agg(p.id order by p.id))[1]::text as caller_id
  from public.profiles p
  where coalesce(p.onboarding_completed, false)
    and p.location is not null
  group by p.location, p.location_country
  having count(*) >= 2
  order by count(*) desc, p.location
  limit 1
)
select
  set_config('request.jwt.claim.role', 'authenticated', true),
  set_config('request.jwt.claim.sub', caller_id, true),
  set_config('waypoint_test.city', city, true),
  set_config('waypoint_test.country', coalesce(country, ''), true)
from discovery_fixture;

set local role authenticated;

select count(*) as city_discovery_rows
from public.get_users_in_city(
  current_setting('waypoint_test.city'),
  nullif(current_setting('waypoint_test.country'), '')
);

select count(*) as ranked_city_discovery_rows
from public.get_city_users_ranked(
  current_setting('waypoint_test.city'),
  current_date,
  current_date + 90,
  20,
  0
);

reset role;

-- Auto-Generate uses this direct service-role path.
select set_config('request.jwt.claim.role', 'service_role', true);
select set_config('request.jwt.claim.sub', '', true);

set local role service_role;

select count(*) as service_role_chemistry_rows
from public.chemistry_score(
  (select id from public.profiles order by id limit 1),
  (select id from public.profiles order by id offset 1 limit 1)
);

reset role;

rollback;
