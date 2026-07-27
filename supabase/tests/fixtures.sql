-- Deterministic local-only fixture identities for database regression tests.
-- Production migrations never load this file; scripts/test-db.sh refuses any
-- non-loopback database URL before executing it.

do $$
declare
  v_index integer;
  v_user_id uuid;
  v_email text;
begin
  for v_index in 1..12 loop
    v_user_id := ('70000000-0000-4000-8000-' || lpad(v_index::text, 12, '0'))::uuid;
    v_email := format('waypoint-regression-%s@example.invalid', v_index);

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
      v_user_id,
      'authenticated',
      'authenticated',
      v_email,
      '',
      now(),
      '',
      '',
      '',
      '',
      '',
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('full_name', format('Regression User %s', v_index)),
      now(),
      now(),
      false,
      false
    ) on conflict (id) do nothing;

    update public.profiles
    set username = format('regression_user_%s', v_index),
        full_name = format('Regression User %s', v_index),
        location = 'Regression City',
        location_country = 'United Kingdom',
        location_country_code = 'GB',
        interests = '["food","outdoors","creative"]'::jsonb,
        languages = '["en"]'::jsonb,
        onboarding_completed = true,
        updated_at = now()
    where id = v_user_id;
  end loop;
end;
$$;
