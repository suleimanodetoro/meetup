# Spec 04 — Auto-Generate

**Required reading first:** `docs/specs/00-overview.md`. Depends on spec 01
(engine_events) and spec 02 (`chemistry_score`, `quest_intents`). Build last.

## Goal

The README's "detects clusters of compatible users and auto-creates plans when
no activity exists in their city" — the structural fix for ghost-town cities.
Two paths: a **hot path** that converts live, compatible intent submissions
into a sidequest while the feeling is fresh, and a **cold path** that seeds
activity in quiet cities on a schedule. Auto-created quests are transparently
system-hosted ("Waypoint" host) — never disguised as human activity.

## Deliverables

### 1. System host identity

- Admin script `scripts/admin/create-system-host.ts` (follow the env/style of
  `scripts/admin/teardown.ts`): idempotently creates one auth user +
  `profiles` row — username `waypoint`, full name "Waypoint", the app's mark
  as avatar (any stable hosted asset), bio "Official sidequests, suggested by
  Waypoint when your city is quiet.", `onboarding_completed=true`. Prints its
  UUID. Email: `system@usewaypoint.app` (protected implicitly: not deletable
  by the teardown tool's filters? — verify: it must never look like trash;
  add its email to the teardown tool's hardcoded protected list).
- The edge function receives this id as env `SYSTEM_HOST_USER_ID` (fail-closed
  503 if unset, matching lifecycle-runner's posture).

### 2. Edge function: `supabase/functions/auto-generate/`

Mirror `supabase/functions/lifecycle-runner/` exactly in structure: Bearer
secret auth (`AUTO_GENERATE_AUTH`, fail-closed), service-role client, a small
README. Invoked hourly (pg_cron + pg_net commented pattern from
`20260706000000_lifecycle_infra.sql`; enable, guarded).

**Hot path (runs every invocation):**
1. Find cities where ≥3 distinct users submitted `quest_intents` rows in the
   trailing 6 hours whose `social` ∈ ('pair','group','either') — group by
   city.
2. Within such a city, cluster: take the intent submitters, compute pairwise
   `chemistry_score`, greedily grow a cluster from the highest-scoring pair,
   adding members whose average chemistry to the cluster ≥ 25; cluster size
   3–6. Discard clusters below 3.
3. Pick the quest: majority `energy`/`social`/`categories` of the cluster's
   intents → call `suggest_quest` semantics against `quest_catalog` (reuse
   the RPC or replicate its scoring in the function) → top result that is
   group-suitable (`social_mode` in ('group','either')) and risk_tier 1.
4. Schedule: if median `time_max` ≥ 90 and it's before 15:00 local-ish, same
   day 18:30; else next day 18:30. (City-local time approximation via
   country_code is fine; document the approximation.)
5. Create the event: `user_id = SYSTEM_HOST_USER_ID`, `kind='open'`,
   `status='active'`, `is_private=false`, title/description from the catalog
   template (dare → description), city/country/country_code from the city,
   `interests` = template interests (**jsonb array**), `location_point` NULL
   (the home map scatters pins from the city name — verified; note it),
   `location_name` = a neutral central meeting point phrase ("Meet central
   {city} — exact spot in the chat"). Insert matching `quest_tags` (vibe,
   energy, social_mode, is_seed=false).
6. Invite exactly the cluster (never auto-RSVP — consent): per user, insert
   `lifecycle_events`-guarded email (job_key `autogen:{event_id}` per user via
   the lifecycle pattern — reuse the lifecycle_events table for idempotency)
   with the quest pitch + deep link `/event/{id}`. Emit
   `engine_events('autogen.created', event_id, payload {path:'hot', city,
   cluster_size, catalog_slug})` and one `autogen.invited` per user.

**Cold path (runs when invoked with `{"mode":"daily"}` — schedule a second
cron at 10:00 UTC):**
1. Candidate cities: ≥8 profiles with `onboarding_completed=true` and
   `location = city`, AND fewer than 2 future-dated, non-cancelled, public
   `kind='open'` events in that city, AND **zero** of those are human-hosted
   (if a human host has a future open sidequest there, skip the city — never
   compete).
2. Cluster residents by chemistry as in the hot path (seed member: the user
   with the most recent app signal — latest message or attendance).
3. Template choice: cluster's shared `profiles.interests` → catalog category
   map; energy default 2; weekend-biased date (next Sat 11:00 or 18:00).
4. Create + invite as hot path, payload `path:'daily'`.

**Guardrails (both paths, enforced in the function):**
- Max 2 live (future, active) system-hosted events per city; skip creation
  beyond that.
- Never invite a user to more than 1 auto-quest per ISO week
  (lifecycle_events dated job keys make this checkable).
- Exclude from clusters: users with `profile_visibility='private'`, users
  without `onboarding_completed`, any pair with a `blocked_users` row
  (chemistry_score already returns 0 — treat 0 as unclusterable).
- **Auto-cancel job** (runs every invocation): system-hosted events with
  `date` within 24h and fewer than 2 attendees → `status='cancelled'` +
  `engine_events('autogen.cancelled')`. The event's group chat dies with it
  per existing cascade behaviour — verify, don't assume.

### 3. Client: transparency label

Where an event's host renders (event detail `app/event/[id]/index.tsx`, plan
cards if host name shows), events hosted by the system profile display
"Suggested by Waypoint" instead of a bare host name. Cheapest correct
mechanism: the client knows the system host's username (`waypoint`) — match on
the joined creator username, no schema change. Keep it to a label/chip;
no layout redesigns.

## Out of scope

Push notifications, ML/embeddings clustering, recurring quests, multi-city
coordination, admin dashboards, any paywall interaction.

## Verification (all local)

1. `supabase db reset` + `npm run seed`; run `create-system-host.ts` locally.
2. Serve `auto-generate` locally. Hot path: insert 3 compatible Dundee
   `quest_intents` (SQL) → invoke → assert: one event created with system
   host + correct fields + quest_tags; exactly 3 `autogen.invited` events;
   re-invoke → **no duplicate event** (guardrails/idempotency hold).
3. Cold path: pick a seeded city, delete its future events (local only) →
   invoke daily mode → cluster + creation happen; a city with a human-hosted
   future sidequest is skipped.
4. Auto-cancel: manufacture a system event <24h out with 0 attendees →
   invoke → cancelled + event emitted.
5. Guardrails: third creation attempt in one city is refused; a user already
   invited this week is not re-invited.
6. Teardown-tool protection: confirm `scripts/admin/teardown.ts` can never
   select the system host (after your protected-list addition).
7. `npx tsc --noEmit` — zero new errors (Deno function files are outside the
   RN tsconfig baseline — do not make it worse).

## Definition of done

System-host script + edge function (both paths + guardrails + cancel job) +
cron enablement pattern + client label + teardown protection + full
instrumentation, verified as above, no commits, report with the local run
transcripts as evidence.
