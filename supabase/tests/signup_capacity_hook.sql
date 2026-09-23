begin;

do $$
begin
  if has_function_privilege('anon', 'private.before_user_created_capacity(jsonb)', 'EXECUTE')
     or has_function_privilege('authenticated', 'private.before_user_created_capacity(jsonb)', 'EXECUTE') then
    raise exception 'Clients must not call the Auth capacity hook';
  end if;
  if not has_schema_privilege('supabase_auth_admin', 'private', 'USAGE')
     or not has_function_privilege('supabase_auth_admin', 'private.before_user_created_capacity(jsonb)', 'EXECUTE') then
    raise exception 'Supabase Auth must be able to invoke the capacity hook';
  end if;
end;
$$;

do $$
declare
  result jsonb;
  provider text;
begin
  foreach provider in array array['email', 'google', 'apple'] loop
    result := private.before_user_created_capacity(jsonb_build_object(
      'user', jsonb_build_object('app_metadata', jsonb_build_object('provider', provider))
    ));
    if (result->'error'->>'http_code')::integer <> 403
       or result->'error'->>'message' <> 'Sign-ups are temporarily paused because we are experiencing high demand. Please try again later. Existing members can still sign in.' then
      raise exception 'New % accounts must receive the capacity message', provider;
    end if;
  end loop;
end;
$$;

rollback;
