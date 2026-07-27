-- Provision the transparent, non-login Waypoint identity that owns generated
-- quests. A stable UUID lets deployment configure SYSTEM_HOST_USER_ID without
-- querying or exporting production auth data.

do $$
declare
  v_system_id uuid := '4b1bc4fd-0ce0-4378-a54f-ec6deb7b4788';
  v_system_email constant text := 'system@usewaypoint.app';
  v_existing_id uuid;
  v_username_owner uuid;
begin
  select u.id into v_existing_id
  from auth.users u
  where lower(u.email) = v_system_email
  limit 1;

  -- Preserve an environment that was already provisioned by the admin script.
  -- The NOTICE below reports the resolved UUID for that environment's secret.
  if v_existing_id is not null then
    v_system_id := v_existing_id;
  end if;

  select p.id into v_username_owner
  from public.profiles p
  where lower(p.username) = 'waypoint'
  limit 1;

  if v_username_owner is not null and v_username_owner <> v_system_id then
    raise exception
      'profile username waypoint already belongs to %, refusing to replace it',
      v_username_owner;
  end if;

  if v_existing_id is null then
    insert into auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      confirmation_token,
      recovery_token,
      email_change_token_new,
      email_change_token_current,
      email_change,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      is_sso_user,
      is_anonymous
    ) values (
      '00000000-0000-0000-0000-000000000000',
      v_system_id,
      'authenticated',
      'authenticated',
      v_system_email,
      '',
      now(),
      '',
      '',
      '',
      '',
      '',
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"Waypoint"}'::jsonb,
      now(),
      now(),
      false,
      false
    );
  end if;

  insert into public.profiles (
    id,
    username,
    full_name,
    bio,
    onboarding_completed,
    updated_at
  ) values (
    v_system_id,
    'waypoint',
    'Waypoint',
    'Official sidequests, suggested by Waypoint when your city is quiet.',
    true,
    now()
  )
  on conflict (id) do update
  set username = excluded.username,
      full_name = excluded.full_name,
      bio = excluded.bio,
      onboarding_completed = true,
      updated_at = now();

  raise notice 'Waypoint system host ready: %', v_system_id;
end;
$$;
