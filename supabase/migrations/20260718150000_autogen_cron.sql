-- =====================================================
-- Auto-Generate scheduling — pg_cron + pg_net, guarded (spec 04)
-- =====================================================
-- Unlike lifecycle-runner (whose cron snippet stays commented out in
-- 20260706000000_lifecycle_infra.sql), Auto-Generate ships SCHEDULED: two
-- cron jobs POST to the auto-generate edge function —
--
--   auto-generate-hourly  '0 * * * *'   body {}                (cancel sweep + hot path)
--   auto-generate-daily   '0 10 * * *'  body {"mode":"daily"}  (+ cold path), 10:00 UTC per spec
--
-- GUARDED: no URL and no secret are hardcoded here. Each tick reads both from
-- Vault at call time and NO-OPS (the WHERE clause fails) until an operator
-- provisions them, once per environment:
--
--   select vault.create_secret('https://<project-ref>.supabase.co/functions/v1/auto-generate', 'autogen_function_url');
--   select vault.create_secret('<AUTO_GENERATE_AUTH value>', 'autogen_auth');
--
-- (Locally you'd point the URL at http://127.0.0.1:54321/... — but local
-- verification normally just curls the served function directly; these jobs
-- sit dormant on a fresh `db reset` because Vault starts empty.)
--
-- At 10:00 UTC both jobs fire and the hot path runs twice — harmless by
-- design: invitees gain lifecycle_events rows at creation, so the second run's
-- weekly-invite guard drains the same candidate pool, and the 2-live-events
-- city cap backstops it.

create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

-- cron.schedule(name, ...) upserts by jobname, so re-running is safe.
select cron.schedule(
  'auto-generate-hourly',
  '0 * * * *',
  $$
    select net.http_post(
      url     := (select decrypted_secret from vault.decrypted_secrets where name = 'autogen_function_url'),
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'autogen_auth')
      ),
      body    := '{}'::jsonb
    )
    where (select count(*) from vault.decrypted_secrets
            where name in ('autogen_function_url', 'autogen_auth')) = 2;
  $$
);

select cron.schedule(
  'auto-generate-daily',
  '0 10 * * *',
  $$
    select net.http_post(
      url     := (select decrypted_secret from vault.decrypted_secrets where name = 'autogen_function_url'),
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'autogen_auth')
      ),
      body    := '{"mode":"daily"}'::jsonb
    )
    where (select count(*) from vault.decrypted_secrets
            where name in ('autogen_function_url', 'autogen_auth')) = 2;
  $$
);

-- To stop them later:
--   select cron.unschedule('auto-generate-hourly');
--   select cron.unschedule('auto-generate-daily');
