# Social Momentum Engine — implementation specs (overview)

Read this file first, then your assigned spec. These specs turn the README's
four-component vision (Chemistry Matching · Auto-Generate · Pulse Monitor ·
Confidence Layer) into four independently-buildable work packages.

**Build order & dependencies:**

```
01-pulse-monitor      (foundation: pair_pulse + engine_events + drift nudge)
02-chemistry          (needs 01's engine_events; adds quest_intents + scoring)
03-confidence-layer   (needs 01's pair_pulse; light client work)
04-auto-generate      (needs 02's chemistry + intents; biggest lift)
```

Each spec ships value alone. Do not start 02 before 01 is merged, etc.

## Product context

Waypoint is a sidequest/social-meetup app (React Native + Supabase) pivoting
from "event app" to "sidequesting app". The engine's job (per README.md):
manage the complete friendship lifecycle — match compatible people (Chemistry),
create activity where none exists (Auto-Generate), detect relationship drift
before disengagement (Pulse), and graduate connections group → friend → DM
(Confidence). Design principles, non-negotiable:

- **Momentum is relational** (pairs/crews), never global XP or leaderboards.
- **The engine never waits for manual input alone** — it reads passive signals
  (messages, RSVPs, co-attendance) with explicit quest completion as the
  strongest signal, not the gate.
- **Consent and privacy win every tie**: respect `blocked_users`,
  `user_privacy_settings` (profile_visibility, message_privacy,
  allow_friend_requests), and gender/meeting preferences. Prompt, never bypass.
- **No paid momentum**: premium sees more, never is more.
- Every component **emits metrics** (see engine_events below) — measured impact
  is a first-class deliverable, not an afterthought.

## Codebase context (verify, don't trust — read the files)

- Stack: Expo SDK 53 + expo-router (`app/`), TypeScript strict-ish, Supabase
  (Postgres + RLS + edge functions in `supabase/functions/`, migrations in
  `supabase/migrations/` named `YYYYMMDDHHMMSS_slug.sql`). Generated DB types:
  `types/supabase.ts` (regenerate or type call-sites properly; never hack the
  generated file).
- Key tables (see migrations for full DDL): `profiles` (location,
  location_country, interests **jsonb array**, languages jsonb array, gender,
  gender_preference, meeting_preference, onboarding_completed),
  `events` (bigint id, user_id SET NULL, kind 'solo'|'open'|'crew',
  status 'active'|'completed'|'cancelled', city/country/country_code,
  location_point PostGIS nullable, date, is_private, interests jsonb array),
  `attendance`, `friendships` (requester/addressee, status), `blocked_users`,
  `conversations`/`conversation_participants`/`messages` (DM + per-event group
  chats auto-created by trigger), `visits` (city + date window),
  `quest_catalog` (165 templates: category, energy_level 1-3, social_mode,
  duration_min, cost_tier, risk_tier, is_solo_safe, vibe text[]),
  `quest_tags` (per-event quest metadata, `is_seed` flags demo data),
  `quest_ledger` (user_lo < user_hi, quest_count, last_quest_at),
  `user_subscriptions`, `user_privacy_settings`, `lifecycle_events`
  (append-only, UNIQUE(user_id, job_key) idempotency).
- Key RPCs: `complete_quest(event_id, partner_id)` (fills quest_ledger),
  `suggest_quest(...)` (intent → ranked catalog quests),
  `get_city_users_ranked` / `get_city_plans_ranked` / `get_users_in_city`
  (discovery; **authenticated-only** — see the REVOKE pattern in
  `20260620000000_quests_phase1b_engine.sql` and always re-apply grants after
  CREATE OR REPLACE), `get_user_conversations`.
- Edge function pattern: `supabase/functions/lifecycle-runner/` — job registry
  (`selectUsers()` + `run()`), Bearer-secret auth (fail-closed 503), optional
  Resend email transport, batch 50, at-most-once via lifecycle_events. pg_cron
  scheduling exists as a **commented pattern** in
  `20260706000000_lifecycle_infra.sql` — follow it when enabling schedules.
- Client conventions: all color-filled CTAs use `components/GradientButton`
  (refraction style); flowing `@gorhom/bottom-sheet` over Modal jump-cuts (see
  the partner picker in `app/event/[id]/index.tsx`); `InitialsAvatar` fallback
  for missing avatars.

## Hard rules for every agent

1. **jsonb arrays vs objects**: `profiles.interests`, `events.interests` are
   jsonb ARRAYS (`'[]'`-shaped). One `'{}'` row can break an RPC for everyone.
2. **RLS + grants**: every new table gets RLS from the first migration. Every
   SECURITY DEFINER function gets `SET search_path = public, pg_temp`, REVOKE
   from anon/public, GRANT to authenticated (or service-role-only for engine
   internals). Client-readable views/tables expose only what the viewer may see.
3. **Typecheck**: `npx tsc --noEmit` must add zero errors (baseline ~25 known
   errors live in `modules/onboarding/OnboardingFrame.tsx` and Deno files under
   `supabase/functions/` — leave them).
4. **Verify locally**: `supabase start` + `supabase db reset` applies all
   migrations; `npm run seed` populates 115 demo users/101 events (all
   `@seed.local`; `npm run seed:reset` wipes them). Prove your feature with
   real local queries/RPC calls, not by reading your own code. NEVER run
   anything against a remote/production Supabase URL.
5. **Never** add Co-Authored-By or any AI attribution to anything. Do not
   `git commit` unless your brief explicitly says to.
6. Seed-data caveat: while the `@seed.local` demo world is live, engine
   features will treat those personas as users. Fine for development; any
   real-world metrics snapshot must happen after `seed:reset`.

## Shared metrics foundation: `engine_events`

Built by spec 01, used by all. Append-only evidence ledger:

```sql
create table public.engine_events (
  id         bigint generated always as identity primary key,
  event_key  text not null,        -- 'pulse.transition', 'intent.submitted',
                                   -- 'nudge.sent', 'nudge.converted',
                                   -- 'confidence.prompt_shown|accepted|dismissed',
                                   -- 'autogen.created|invited|cancelled'
  user_id    uuid references auth.users(id) on delete set null,
  pair_lo    uuid, pair_hi uuid,   -- canonical pair when applicable
  event_id   bigint,               -- events.id when applicable
  payload    jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
```

RLS: **no client select** (metrics are operator-only; query via service role).
Client-side emissions go through one RPC `log_engine_event(p_event_key text,
p_payload jsonb default '{}', p_event_id bigint default null)` — SECURITY
DEFINER, stamps `auth.uid()`, allowlists event keys, authenticated-only.
Server-side jobs insert directly with the service role.

**Why this exists**: each component's measurable outcome (drift-nudge
re-engagement rate, prompt→friendship conversion, auto-quest activation) is
the evidence layer for the product's impact story. Emit events exactly as your
spec says — the queries that turn them into metrics come later.

## How to brief an agent on a spec

> Repo: /Users/suleimanodetoro/Desktop/BecomingHirable/ReactNativeProjects/MeetupClone
> Read docs/specs/00-overview.md fully, then docs/specs/0X-<name>.md — that is
> your work package. Follow its Definition of Done and Verification sections
> exactly. Respect every Hard Rule in the overview. Report back: files changed,
> what you verified with evidence, and anything you had to decide yourself.
