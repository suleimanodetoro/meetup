# Spec 01 — Pulse Monitor

**Required reading first:** `docs/specs/00-overview.md` (context, hard rules,
engine_events definition — building engine_events is part of THIS spec).

## Goal

A per-pair momentum score derived from all interaction signals, decaying over
time, surfaced as four states — **Hot / Warm / Cooling / Cold** — with drift
detection (Hot/Warm → Cooling transitions) that triggers a re-engagement nudge.
This is the README's "Pulse Monitor: tracks engagement health per friendship,
flags drift before users disengage."

## Deliverables

### 1. Migration: `engine_events` + `log_engine_event`

Exactly as defined in the overview. Allowlist for client-emitted keys starts
with: `confidence.prompt_shown`, `confidence.prompt_accepted`,
`confidence.prompt_dismissed`, `intent.submitted` (later specs use them;
server-side keys are inserted directly, not via the RPC).

### 2. Migration: `pair_pulse`

```sql
create table public.pair_pulse (
  user_lo    uuid not null references public.profiles(id) on delete cascade,
  user_hi    uuid not null references public.profiles(id) on delete cascade,
  score      numeric not null default 0,
  state      text not null default 'cold'
             check (state in ('hot','warm','cooling','cold')),
  prev_state text,
  last_interaction_at timestamptz,
  computed_at timestamptz not null default now(),
  primary key (user_lo, user_hi),
  check (user_lo < user_hi)
);
```

RLS: select only where `auth.uid() in (user_lo, user_hi)`; no client writes.
(Mirror `quest_ledger`'s policy — read it first.)

### 3. Refresh function: `refresh_pair_pulse()`

SECURITY DEFINER, **service-role/cron only** (revoke from anon AND
authenticated). Recomputes all pairs with any signal in the trailing 90 days.

Raw score per pair = sum of, over the trailing 90 days:

| Signal | Source | Weight |
|---|---|---|
| Quest co-completions | `quest_ledger.quest_count` (all-time), recency from `last_quest_at` | +40 each |
| Co-attendance | `attendance` self-join on event_id (distinct events, both users) | +15 each |
| Accepted friendship | `friendships.status='accepted'` | +10 once |
| DM messages between the pair | `messages` ⨝ `conversation_participants` where conversation `type='dm'` and both are the participants; `is_deleted is not true` | +2 per message, capped 10 msgs/day |
| Group messages in shared event chats | messages by either user in group conversations both participate in | +1 per message, capped 10 msgs/day |

Then apply decay: `score = raw × 0.5 ^ (quiet_days / 14.0)` where `quiet_days`
= days since the most recent signal of any kind (`last_interaction_at`).

States (constants at the top of the function, one obvious place to tune):

- `hot`: score ≥ 80
- `warm`: 30 ≤ score < 80
- `cooling`: 10 ≤ score < 30 **and** the pair was warm/hot at some prior
  refresh (use existing row's state/prev_state); a pair that never warmed up
  is just `cold`, not cooling — cooling means *lost* momentum
- `cold`: everything else

On each refresh, when a row transitions from `hot`/`warm` → `cooling`, insert
`engine_events('pulse.transition', pair_lo, pair_hi, payload: {from, to,
score})`. Also detect **nudge conversion**: if a `nudge.sent` event exists for
the pair in the last 14 days and `last_interaction_at` is newer than it, emit
`nudge.converted` once (guard against duplicates via an exists-check on a
prior converted event newer than that nudge).

Exclusions: skip pairs with a `blocked_users` row in either direction (delete
their pair_pulse row if present).

### 4. Scheduling

Enable a nightly run (03:30 UTC) via pg_cron following the commented pattern
in `20260706000000_lifecycle_infra.sql`. If pg_cron cannot be enabled locally,
the migration must still apply cleanly (guard with existence checks) and the
function must be manually invokable — document the manual invocation.

### 5. Cooling-pair nudge (lifecycle-runner job)

Add a `LifecycleJob` to `supabase/functions/lifecycle-runner/index.ts`:

- `selectUsers`: both members of pairs that emitted `pulse.transition` →
  cooling in the last 24h, who have an email.
- `job_key`: `cooling:{user_lo}:{user_hi}:{ISO-week}` (dated → can re-fire in
  a later week, at most once per pair-week per user via lifecycle_events).
- `run`: email (Resend, existing transport) — subject/body in the app's voice,
  e.g. "You and {first_name}: {quest_count} sidequests together. It's been
  {days} days." Include one suggested quest: pick from `quest_catalog` matching
  the pair's most common shared `quest_tags.vibe`/category from co-attended
  events (fallback: any low-energy `is_solo_safe=false` pair-friendly quest).
- Insert `engine_events('nudge.sent', pair keys, payload: {job_key, quest_slug})`.
- Ship it **enabled**, but remember the runner is fail-closed without
  `LIFECYCLE_RUNNER_AUTH` and silently skips email without `RESEND_API_KEY` —
  note both in your report.

### 6. Client: pulse chips

- `app/profile/[userId].tsx`: the existing ledger fetch also reads
  `pair_pulse` for the pair (canonical lo/hi ordering — copy the existing
  pattern in that file). Render a small state chip next to the "⚡ N sidequests
  together" pill: 🔥 Hot / ✨ Warm / 🌙 Cooling. **Hide when cold or absent**
  (cold is the default state of strangers — showing it is noise).
- `app/friends.tsx`: same chip on friend rows (batch-fetch pair_pulse for the
  visible friend ids with one `.or()` query, not per-row round trips).
- Match existing styling idioms in those files; no redesigns.

## Out of scope

Push notifications (no token infra yet — email only), weekly streaks,
crew/group pulse, any paywall interaction, backfilling engine_events history.

## Verification (all local)

1. `supabase db reset` applies your migrations cleanly on top of existing ones.
2. Seed (`npm run seed`), then manufacture a pair history with SQL as the
   service role: insert co-attendance + DMs for pair A-B (should be warm/hot),
   an old-signals-only pair C-D previously warm (manually set prev row, then
   refresh — must transition to cooling and emit `pulse.transition`), and a
   blocked pair (must have no row).
3. Run `refresh_pair_pulse()` twice — second run must be idempotent (no
   duplicate transition events).
4. RLS probe: as authed user A (use the seed users' JWTs or
   `set role authenticated; set request.jwt.claims`), confirm A reads A-B but
   CANNOT read C-D. Anon reads nothing.
5. Serve the lifecycle-runner locally (`supabase functions serve`) with a test
   auth secret; invoke; confirm the cooling job selects C and D, writes
   lifecycle_events rows, and emits `nudge.sent` (email send may be skipped
   without RESEND_API_KEY — the skip path must log status 'skipped').
6. `npx tsc --noEmit`: zero new errors. App renders: profile of a warm pair
   shows the chip (verify via code-walk + local data if no simulator).

## Definition of done

Migrations + refresh function + cron pattern + lifecycle job + two client
surfaces + engine_events foundation, all verified as above, working tree only
(no commits), report with evidence.
