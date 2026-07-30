# lifecycle-runner

Supabase Edge Function that runs one-shot **lifecycle / account-"warming"** jobs —
nudges aimed at accounts created on the marketing website before the app is
installed (e.g. "you signed up but never finished onboarding"). A cron tick (or a
manual `curl`) POSTs here; the runner walks a **job registry**, selects candidate
users for each job, skips anyone already handled, executes, and records the outcome
in `public.lifecycle_events`.

This is generic **plumbing**, not a campaign suite. The actual campaigns are decided
later; one example job ships here **disabled** to show the shape. Adding a real
campaign = appending a `LifecycleJob` to the `JOBS` array.

It mirrors the sibling webhooks ([`../revenuecat-webhook`](../revenuecat-webhook/index.ts),
[`../stripe-webhook`](../stripe-webhook/index.ts)): a `service_role` client that
bypasses RLS, fail-closed shared-secret auth, and plain JSON responses.

## Idempotency

`public.lifecycle_events` has `UNIQUE(user_id, job_key)` — this is the whole
idempotency backbone. Each job runs **at most once per user, forever**:

- The runner pre-filters out any user already present in `lifecycle_events` for
  that `job_key` (any status — `sent`, `skipped`, or `failed`).
- The unique constraint double-guards on insert (a `23505` from an overlapping
  cron tick is treated as "already handled" → counted as skipped).
- `failed` is **terminal**: a failed row is not retried automatically. To force a
  retry, `DELETE` that user's row for the `job_key`. (Rationale: for warm-up email,
  at-most-once beats a double-send.)
- Narrow race: because the outcome is recorded *after* `run()`, two overlapping
  ticks could both send before either records. An hourly, batch-bounded cron makes
  this effectively impossible. If you ever need a hard guarantee, change `runJob`
  to claim-insert the row *before* `run()`.

## Adding a job (the registry contract)

Append an object matching this contract to the `JOBS` array in `index.ts`:

```ts
type Candidate = { user_id: string; email: string; job_key?: string; [key: string]: unknown };

type LifecycleJob = {
  key: string;          // stable, persisted to lifecycle_events.job_key — never rename in place
  enabled: boolean;     // master switch; disabled jobs are skipped on real runs
  description: string;  // for logs / dashboards
  selectUsers(admin): Promise<Candidate[]>;          // return up to ~BATCH_SIZE (50) users
  run(admin, user): Promise<'sent' | 'skipped'>;     // do the work for one user
};
```

A candidate may carry its **own `job_key`** (prefix it with the job's static key)
to scope the at-most-once guarantee more narrowly than "once per user, forever" —
e.g. `cooling_pair_nudge` keys per pair-week (`cooling:{lo}:{hi}:{ISO-week}`) so
the same user can be nudged about a different pair, or about the same pair again
in a later week. When omitted, the job's static `key` is used and the guarantee
is the classic once-per-user-forever.

- `selectUsers` returns candidates; **idempotency is the runner's job**, don't
  re-implement it. Keep the set bounded (`BATCH_SIZE`, currently 50) so a cron tick
  stays fast.
- `run` does the side effect and returns `'sent'` (it happened) or `'skipped'` (it
  didn't, e.g. email transport not configured). Throw to record `'failed'`.
- Email jobs should use the shared `sendEmail({ to, subject, html })` helper, which
  returns `'skipped'` when `RESEND_API_KEY` is unset (so the pipeline runs end-to-end
  without email configured) and throws on a real API error.

**Selecting on account age / email:** `public.profiles` has **no `created_at` and no
`email`** column — the signup timestamp and email live only in `auth.users`, which
the service-role PostgREST client can't query directly (the `auth` schema isn't
exposed). The optional onboarding job uses `admin.auth.admin.listUsers()` for
`created_at` + `email` and intersects with the not-yet-onboarded profiles. It scans a
deliberately bounded window; a larger campaign can replace that selector with a
`SECURITY DEFINER` SQL function over `auth.users`.

## Optional onboarding-completion job

`welcome_incomplete_onboarding` — selects accounts created >24h ago whose
`profiles.onboarding_completed = false` and sends a "finish setting up Waypoint"
email with deployment-configured app-store links. It is disabled by default because
the lifecycle runner's enabled jobs are selected explicitly, not because the core
product is awaiting launch. Set `enabled: true` and deploy when this campaign is wanted.

## cooling_pair_nudge (ENABLED — Pulse Monitor drift re-engagement)

Emails **both members** of every pair that drifted hot/warm → cooling in the last
24h (from `engine_events` rows emitted by the nightly `refresh_pair_pulse()`):
their shared sidequest tally, how long it's been quiet, and one suggested quest
matched to the vibes of events they actually co-attended. Blocked pairs are
excluded. Idempotent per pair-week per user via candidate `job_key`
`cooling:{user_lo}:{user_hi}:{ISO-week}`. Every send is recorded as
`engine_events('nudge.sent')`; the next refresh emits `nudge.converted` if the
pair interacts within 14 days — nudge→re-engagement conversion is measurable
from day one. Note: the runner stays fail-closed without `LIFECYCLE_RUNNER_AUTH`
and records `skipped` (no email) without `RESEND_API_KEY`.

## Secrets to set

```bash
# Shared secret for the Bearer auth on this endpoint. Generate a random value and
# use the SAME value in the cron Authorization header. Fail-closed: if this is
# unset the function returns 503 to everything.
supabase secrets set LIFECYCLE_RUNNER_AUTH=$(openssl rand -hex 32)

# Email transport (Resend). Optional — without it, email jobs resolve to 'skipped'
# and the pipeline still runs end-to-end (dry plumbing).
supabase secrets set RESEND_API_KEY=re_xxx
supabase secrets set LIFECYCLE_FROM_EMAIL="Waypoint <hello@usewaypoint.app>"
supabase secrets set WAYPOINT_APP_STORE_URL="https://apps.apple.com/app/..."
supabase secrets set WAYPOINT_PLAY_STORE_URL="https://play.google.com/store/apps/details?id=..."
```

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically by the Edge
runtime (same as the webhooks).

## Deploy

```bash
supabase functions deploy lifecycle-runner --no-verify-jwt
```

`--no-verify-jwt` is required because the runner is triggered by cron / a raw `curl`,
not an authenticated Supabase user — auth is the `LIFECYCLE_RUNNER_AUTH` Bearer secret
checked inside the function. `verify_jwt = false` is already set for this function in
[`supabase/config.toml`](../../config.toml), matching the webhooks.

## Database migration (apply before/with deploy)

- `supabase/migrations/20260706000000_lifecycle_infra.sql` creates
  `public.lifecycle_events` (RLS on, service-role only — no user policies) and the
  unique idempotency constraint. Apply it before the first real run.

## Invoke manually

Preview (selects nothing, sends nothing, records nothing) — reports what **every**
registered job *would* pick up, including disabled ones:

```bash
curl -X POST https://<project-ref>.supabase.co/functions/v1/lifecycle-runner \
  -H "Authorization: Bearer $LIFECYCLE_RUNNER_AUTH" \
  -H "Content-Type: application/json" \
  -d '{"dryRun": true}'
# -> { "dryRun": true, "jobs": { "welcome_incomplete_onboarding": { "enabled": false, "wouldSelect": N, "sample": [...] } } }
```

Real run (enabled jobs only):

```bash
curl -X POST https://<project-ref>.supabase.co/functions/v1/lifecycle-runner \
  -H "Authorization: Bearer $LIFECYCLE_RUNNER_AUTH" \
  -H "Content-Type: application/json" \
  -d '{}'
# -> { "welcome_incomplete_onboarding": { "sent": X, "skipped": Y, "failed": Z } }
```

## Scheduling (pg_cron)

`pg_cron` and `pg_net` are **not enabled** in this project yet (only `postgis` is).
The schedule is left commented out in the migration so it's a deliberate, manual step.
When ready, run this once in the SQL editor (do **not** commit the secret):

```sql
create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net  with schema extensions;

select cron.schedule(
  'lifecycle-runner-hourly',
  '0 * * * *',
  $$
    select net.http_post(
      url     := 'https://<project-ref>.supabase.co/functions/v1/lifecycle-runner',
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'Authorization', 'Bearer ' || '<LIFECYCLE_RUNNER_AUTH>'
      ),
      body    := '{}'::jsonb
    );
  $$
);

-- Stop it later:
-- select cron.unschedule('lifecycle-runner-hourly');
```

## Local testing

```bash
supabase functions serve lifecycle-runner --no-verify-jwt --env-file ./supabase/functions/.env
curl -X POST http://localhost:54321/functions/v1/lifecycle-runner \
  -H "Authorization: Bearer <LIFECYCLE_RUNNER_AUTH>" \
  -H "Content-Type: application/json" \
  -d '{"dryRun": true}'
```
