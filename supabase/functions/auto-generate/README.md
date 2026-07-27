# auto-generate

Supabase Edge Function for the Social Momentum Engine's **Auto-Generate**
component (spec 04): detects clusters of compatible users and auto-creates
sidequests when no activity exists in their city. Auto-created quests are
transparently **system-hosted** — `events.user_id` is the "Waypoint" profile
(create it with `npm run admin:create-system-host`), and the client renders
"Suggested by Waypoint" off its username. Invitees get an **email invite with a
deep link**; nobody is ever auto-RSVP'd (consent first).

It uses a `service_role` client, fail-closed shared-secret auth, and an optional
Resend transport that degrades to `skipped`. Generated-event creation and email
delivery are backed by the transactional database boundary introduced in
`20260726090200_autogen_transactional_idempotency.sql`.

## Paths

**Auto-cancel sweep (every invocation, runs first).** Generated `active` events
starting within 24h with fewer than 2 distinct genuine participants →
`status='cancelled'` + `engine_events('autogen.cancelled')`, in one database
transaction. The system host is explicitly excluded from the count. A 6-hour
grace applies from `created_at` so a same-day hot quest isn't strangled at birth
by the next hourly tick. Pending invitations are closed as `skipped` in that
same transaction; an event with an actively leased delivery is deferred.
Cancelling is a status change — the event's group chat is **not** deleted
(the conversations cascade fires only on event DELETE); the chat simply
belongs to a visibly cancelled quest.

**Hot path (every invocation).** Cities where ≥3 distinct users submitted
`quest_intents` (social ∈ pair/group/either) in the trailing 6h → greedy
chemistry clustering (seed = highest-scoring pair, additions need avg
`chemistry_score` ≥ 25, size 3–6) → template via `suggest_quest` with the
cluster's majority energy/social/categories, filtered to `social_mode`
group/either and `risk_tier` 1 → scheduled same day 18:30 local when the
median `time_max` ≥ 90 and it's before 15:00 local, else next day 18:30.

**Cold path (only with `{"mode":"daily"}`).** Cities with ≥8 onboarded
resident profiles AND fewer than 2 future public open sidequests AND zero of
those human-hosted (a human host's future quest always wins — skip the city).
Cluster seeds from the resident with the most recent app signal (latest
message or attendance). Template from interests shared by ≥2 cluster members,
mapped to catalog vibe vocabulary; energy defaults to 2. Scheduled next
Saturday, 11:00 local for energy-3 templates, else 18:00.

City-local time is an **approximation**: one static UTC offset per
`country_code` (no DST; wide countries get their most populous zone, e.g.
US → Eastern). It only drives hour-granularity choices, where ±1h is fine.

## Guardrails (pre-filtered in the function, enforced in the database)

- Max **2 live** (future, active) system-hosted events per city.
- Max **1 auto-quest invite per user per ISO week** — pre-filtered through
  `lifecycle_events` and enforced under concurrency by
  `autogen_invites UNIQUE(user_id, invite_week)` inside the reservation
  transaction.
- Cluster exclusions: not onboarded, `profile_visibility='private'`, the
  system host itself. Blocked pairs need no explicit check: `chemistry_score`
  hard-zeroes them and a 0-score edge is unclusterable.
- Per-tick bounds: at most 5 cities per path per invocation and 12 clustering
  candidates per city (overflow is logged and picked up by later ticks).

## Transaction and retry guarantees

`reserve_autogen_event(...)` is the only creation path. In one PostgreSQL
transaction it:

1. takes a transaction-scoped lock for the normalised city;
2. claims a deterministic key for `(path, city, scheduled time)`;
3. rechecks the live-city cap and weekly invite uniqueness;
4. creates the event, quest tags and `autogen.created` metric; and
5. creates every invite-outbox row and `lifecycle_events(status='pending')`
   claim.

Any error rolls all five steps back. Concurrent invocations for the same slot
return the original event, while a competing weekly claim aborts without an
orphan event.

Email is deliberately outside the database transaction, but never precedes
the durable claim. `claim_autogen_invites(...)` leases rows with `FOR UPDATE
SKIP LOCKED`; `complete_autogen_invite(...)` atomically updates the outbox,
lifecycle row and delivery metric. Each provider request carries the stable
outbox key in Resend's `Idempotency-Key` header. An interrupted worker can be
reclaimed after ten minutes and retry the same request safely. Retriable
provider errors back off for five minutes and stop after three completed
attempts. An ambiguous delivery not recovered inside a conservative 23-hour
window is dead-lettered for manual review rather than retried after Resend's
24-hour idempotency window. See [Resend's idempotency-key documentation](https://resend.com/docs/dashboard/emails/idempotency-keys).

## Instrumentation

- `engine_events('autogen.created')` — `event_id` + `{path, city, cluster_size, catalog_slug}`
- `engine_events('autogen.invited')` — one per invitee, `{path, city, delivery}`
- `engine_events('autogen.invite_retry_scheduled')` — retriable delivery failure
- `engine_events('autogen.invite_abandoned')` — ambiguous delivery exceeded the provider safety window
- `engine_events('autogen.cancelled')` — `{city, participant_count, system_host_excluded:true}`

## Secrets to set

```bash
# Bearer auth for this endpoint (fail-closed: unset ⇒ 503 to everything).
supabase secrets set AUTO_GENERATE_AUTH=$(openssl rand -hex 32)

# The system host's profile UUID — printed by `npm run admin:create-system-host`.
# Fail-closed: unset ⇒ 503.
supabase secrets set SYSTEM_HOST_USER_ID=<uuid>

# Email transport (optional, shared with lifecycle-runner). Without it,
# invites record delivery='skipped' and everything else still runs.
supabase secrets set RESEND_API_KEY=re_xxx
supabase secrets set LIFECYCLE_FROM_EMAIL="Waypoint <hello@usewaypoint.app>"
```

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected by the Edge runtime.

## Deploy

```bash
supabase functions deploy auto-generate --no-verify-jwt
```

Cron/curl callers aren't Supabase users, so JWT verification is off —
auth is the `AUTO_GENERATE_AUTH` Bearer secret checked inside the function.
`verify_jwt = false` is set in [`supabase/config.toml`](../../config.toml).

## Invoke manually

```bash
# Hourly shape: auto-cancel sweep + hot path.
curl -X POST https://<project-ref>.supabase.co/functions/v1/auto-generate \
  -H "Authorization: Bearer $AUTO_GENERATE_AUTH" \
  -H "Content-Type: application/json" -d '{}'

# Daily shape: auto-cancel + hot + cold.
curl -X POST https://<project-ref>.supabase.co/functions/v1/auto-generate \
  -H "Authorization: Bearer $AUTO_GENERATE_AUTH" \
  -H "Content-Type: application/json" -d '{"mode":"daily"}'
```

The JSON response is a full run report: `{mode, autoCancel, hot, cold}` with
per-city `created` / `skipped` (+reasons) detail.

## Scheduling

Unlike lifecycle-runner (whose cron snippet is commented out),
`supabase/migrations/20260718150000_autogen_cron.sql` **enables** `pg_cron` +
`pg_net` and schedules two jobs — hourly `{}` and daily-10:00-UTC
`{"mode":"daily"}` — **guarded**: each tick reads the function URL and Bearer
secret from Vault at call time and no-ops until both exist. Provision them
once per environment (never in a committed file):

```sql
select vault.create_secret('https://<project-ref>.supabase.co/functions/v1/auto-generate', 'autogen_function_url');
select vault.create_secret('<AUTO_GENERATE_AUTH value>', 'autogen_auth');
```

## Local testing

```bash
# 1) System host + its UUID:
npm run admin:create-system-host

# 2) Serve with local env (SUPABASE_URL/SERVICE_ROLE key are injected by the CLI):
supabase functions serve auto-generate --no-verify-jwt --env-file ./supabase/functions/.env.autogen.local
#    where the env file holds AUTO_GENERATE_AUTH=<anything> and SYSTEM_HOST_USER_ID=<uuid>.

# 3) Manufacture compatible quest_intents rows with SQL, then:
curl -X POST http://127.0.0.1:54321/functions/v1/auto-generate \
  -H "Authorization: Bearer <AUTO_GENERATE_AUTH>" \
  -H "Content-Type: application/json" -d '{}'

# Transaction/idempotency regression (all fixture mutations roll back):
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres \
  -X -v ON_ERROR_STOP=1 \
  -f supabase/tests/autogen_transactional_idempotency.sql
```
