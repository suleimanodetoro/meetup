-- Activate this function through the hosted Before User Created Auth hook.
-- It only runs for new accounts; existing users can still sign in.
-- Disable that hook in Auth settings to reopen registration.
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to supabase_auth_admin;

create or replace function private.before_user_created_capacity(event jsonb)
returns jsonb
language sql
immutable
security invoker
set search_path = ''
as $$
  select jsonb_build_object('error', jsonb_build_object(
    'http_code', 403,
    'message', 'Sign-ups are temporarily paused because we are experiencing high demand. Please try again later. Existing members can still sign in.'
  ));
$$;

revoke all on function private.before_user_created_capacity(jsonb)
  from public, anon, authenticated;
grant execute on function private.before_user_created_capacity(jsonb)
  to supabase_auth_admin;

comment on function private.before_user_created_capacity(jsonb) is
  'Temporary capacity pause. Configure as Before User Created Auth hook; disable the hook to reopen sign-ups. No client release required.';
