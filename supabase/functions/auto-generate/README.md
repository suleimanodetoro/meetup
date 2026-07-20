# auto-generate

Supabase Edge Function for the Social Momentum Engine's **Auto-Generate**
component (spec 04): detects clusters of compatible users and auto-creates
sidequests when no activity exists in their city. Auto-created quests are
transparently **system-hosted** — `events.user_id` is the "Waypoint" profile
(create it with `npm run admin:create-system-host`), and the client renders
"Suggested by Waypoint" off its username. Invitees get an **email invite with a
deep link**; nobody is ever auto-RSVP'd (consent first).

It mirrors [`../lifecycle-runner`](../lifecycle-runner/index.ts): `service_role`
client that bypasses RLS, fail-closed shared-secret auth, optional Resend
transport that degrades to `skipped`, and `public.lifecycle_events` as the
at-most-once invite ledger.

## Paths

**Auto-cancel sweep (every invocation, runs first).** System-hosted `active`
events starting within 24h with fewer than 2 attendees → `status='cancelled'` +
`engine_events('autogen.cancelled')`. A 6-hour grace applies from `created_at`
so a same-day hot quest isn't strangled at birth by the next hourly tick.
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

## Guardrails (enforced in the function)

- Max **2 live** (future, active) system-hosted events per city.
- Max **1 auto-quest invite per user per ISO week** — checked against
  `lifecycle_events` rows with `job_key like 'autogen:%'` in the current ISO
  week, applied **before clustering** so a created quest never ends up with
  un-invitable members.
- Cluster exclusions: not onboarded, `profile_visibility='private'`, the
  system host itself. Blocked pairs need no explicit check: `chemistry_score`
  hard-zeroes them and a 0-score edge is unclusterable.
- Per-tick bounds: at most 5 cities per path per invocation and 12 clustering
  candidates per city (overflow is logged and picked up by later ticks).

**Idempotency / re-invoke safety:** invitees get a `lifecycle_events` row
(`job_key = autogen:{event_id}`, UNIQUE per user) the moment a quest is
created, so on re-invocation the weekly-invite guard removes them from the
candidate pool — the same city can't produce a duplicate quest for the same
people. The 2-live-events city cap is the backstop.

## Instrumentation

- `engine_events('autogen.created')` — `event_id` + `{path, city, cluster_size, catalog_slug}`
- `engine_events('autogen.invited')` — one per invitee, `{path, city, delivery}`
- `engine_events('autogen.cancelled')` — `{city, attendee_count}`

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
```
