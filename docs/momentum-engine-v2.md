# Social Momentum Engine v2 — the four components, sidequest era

Status: proposal (2026-07). Rewritten to follow the README's actual architecture —
Chemistry Matching · Auto-Generate · Pulse Monitor · Confidence Layer — rather than
the quest-schema-first framing of the earlier draft.

> **Implementation specs live in `docs/specs/`** — read `00-overview.md` first,
> then dispatch one agent per spec in order: 01-pulse-monitor →
> 02-chemistry-matching → 03-confidence-layer → 04-auto-generate.

## Ground truth: what exists vs. the vision

The README defines the engine as a four-component intelligence system managing the
complete friendship lifecycle. What's shipped today (quests Phase 1 + this week's
Phase 2a UI wiring) covers slivers of it:

| Component | Shipped today | Gap |
|---|---|---|
| Chemistry Matching | `suggest_quest()` (quest↔mood), `get_city_users_ranked` (date-overlap only) | No people↔people compatibility score; interests/languages/behaviour unused |
| Auto-Generate | — | Entirely unbuilt |
| Pulse Monitor | `quest_ledger` pair counts, completion-gated | Deaf to messages/joins/attendance; no drift detection; no nudges |
| Confidence Layer | Product structure (event chat → friend request → DM) | No intelligence: nothing decides *when* to prompt graduation |

Design correction adopted from review: **the engine must not wait for completion.**
Manual "Mark completed" (Phase 2a) stays — it's the highest-quality signal and feeds
the ledger's explicit moments — but momentum accrues passively from signals already
in the DB: messages, co-attendance, RSVPs, DM cadence, friendship acceptance.

## 1 · Pulse Monitor (build first — everything else reads it)

The heart. A per-pair **momentum score** computed from ALL interaction signals,
with time decay, surfaced as states not numbers: **Hot / Warm / Cooling / Cold**.

Signals & suggested weights (tunable, stored in one place):

```
co-completion (quest_ledger)         +40   the strongest, rarest signal
co-attendance (same event roster)    +15
accepted friendship                  +10   one-time
DM message (per, capped/day)         +2    cap 10/day so spam ≠ momentum
group-chat message in shared event   +1    cap 10/day
decay                                score × 0.5 every 14 quiet days
```

Implementation: a `pair_pulse` materialized view (or nightly-refreshed table)
keyed (user_lo, user_hi) like `quest_ledger` — sources: `quest_ledger`,
`attendance` self-join, `friendships`, `messages`⨝`conversation_participants`
for DMs. No client writes; pure derivation. RLS mirrors `quest_ledger`.

Drift detection = state transitions. `Hot → Cooling` for a pair is THE event the
README promises ("flags drift before users disengage") — it feeds nudges (§5).

UI (small): pulse state chip on friend rows + other-user profiles (extends the
"⚡ N sidequests together" badge shipped in 2a); optional "cooling" section in
Friends.

## 1.5 · Intent capture (persist the on-ramp)

The intent flow (`app/create-plan/intent.tsx` → `suggest_quest()`) already asks
users what they feel like doing — energy, solo/pair/group, time, budget, vibes —
but the submission is ephemeral: nothing stores it, so the engine can't learn
from it. Fix is tiny: a `quest_intents` table (user_id, city, energy, social,
time_max, budget, categories[], created_at; insert-only from the intent screen,
RLS: own rows). Downstream uses:

- **Chemistry**: repeated stated preferences blend with static interests.
- **Auto-Generate (hot path)**: N users in one city submit compatible intents
  within a few hours → create the sidequest and invite exactly them *now*,
  while the feeling is live — demand-sensing beats nightly cluster scans.
- **Nudges**: streak-save suggestions match what the user usually asks for.

## 2 · Chemistry Matching (people ↔ people)

A real compatibility score between two users, per the README's signal list:

```
shared interests (of 23)      up to 30
geographic proximity          up to 20   same city 20 / same country 8
date-range overlap (visits)   up to 20   existing city-ranking logic, reused
meeting-pref compatibility    up to 10   gender prefs respected as hard filter
language overlap              up to 10
behavioural (pulse-informed)  up to 10   friends-of-warm-friends bonus
```

Implementation: `chemistry_score(a uuid, b uuid)` SQL function + a
`get_city_users_ranked` upgrade: rank by `match_score → chemistry → overlap`
instead of overlap alone. The home map's 12 people-pins become *the 12 most
compatible people near you*, not 12 arbitrary ones. Also powers Auto-Generate's
cluster detection.

## 3 · Auto-Generate (the liveliness engine)

README: "detects clusters of compatible users and auto-creates plans when no
activity exists in their city." This is the *structural* fix for ghost-town
cities — the seed data fakes density for screenshots; Auto-Generate creates real
activity forever.

Nightly job (pg_cron or `lifecycle-runner` sibling edge function):

1. Cities with ≥K onboarded users whose upcoming-open-sidequest count < N.
2. Cluster residents/visitors by chemistry score (greedy: seed with the
   highest-pulse user, attach top-compatible neighbours, 4–6 per cluster).
3. Pick a catalog template fitting the cluster (shared interests → category;
   collective energy; `is_solo_safe` for mixed clusters; weekend-biased date).
4. Create the event as a **system-hosted open sidequest** (`kind='open'`,
   host = a designated system profile, clearly labelled "Suggested by Waypoint")
   + `quest_tags`. Auto-created group chat comes free via existing trigger.
5. Invite the cluster: push (token infra pending) or lifecycle email + in-app
   surfacing (auto-generated quests rank into the home map via the existing
   `get_city_plans_ranked` path untouched).

Guardrails: max 2 live auto-quests per city; auto-cancel (status='cancelled')
if 0 RSVPs 24h before date; never auto-generate in a city where a human-hosted
future sidequest exists. Ledger entry per generation for idempotency, mirroring
`lifecycle_events`.

## 4 · Confidence Layer (graduated exposure, now with intelligence)

The rails exist (event chat → friend request → DM). Add the brain that prompts
graduation at the right moment:

- After a shared event completes (or its date passes with both attending):
  surface "Add <name>?" — the post-quest moment is the README's graduation point
  from group-context to friendship.
- When a pair's pulse crosses Warm without a friendship row: nudge the
  friend request in-app.
- DM unlock stays friendship-gated (existing `message_privacy` respected);
  the layer prompts, never bypasses.

Implementation: mostly client + one `get_graduation_prompts(user)` RPC reading
pulse + friendships + recent co-attendance. No schema change.

## 5 · Nudges (drift → action)

Rides the shipped-but-dormant `lifecycle-runner` (idempotent job registry,
Resend transport; enable pg_cron). Campaigns in priority order:

1. **Cooling pair** — "You and Amy: 6 sidequests. It's been 3 weeks." Fires on
   Hot/Warm → Cooling transition; suggests a catalog quest matching the pair's
   history. Dated job keys (`cooling:{pair}:2026-W28`) for recurrence.
2. **Streak save** — Sunday morning, weekly streak about to break, one
   low-energy solo-safe suggestion. (Weekly streaks, not daily — sidequesting
   is a weekend behaviour; daily reads as Duolingo cosplay.)
3. **Auto-quest invite** — from §3.
4. **Warm welcome** — already stubbed (`welcome_incomplete_onboarding`); enable.

Push > email once Expo push tokens are stored; email is the shipped fallback.

## Progression layer (retention dressing on top)

- Weekly personal streak (`user_momentum` table, updated in `complete_quest`).
- Catalog tiers: gate `risk_tier` 2–3 quests behind momentum ("unlock After
  Dark") — re-cuts the existing 165 templates into progression, zero new content.
- Chains: 3-quest themed sequences ("Tay Trilogy") in a `quest_chains` table;
  chain completion is the badge moment and a marketing unit.

## Non-goals

No global XP/levels/leaderboards (momentum is relational and local); no daily
streaks; no paid momentum boosts — premium *sees more*, never *is more*.

## Build order (each step ships value alone)

1. **Pulse Monitor** view + state chips (small; unblocks everything).
1b. **Intent capture** table + insert from the intent screen (an hour; starts
    accumulating behavioural signal immediately — the sooner it ships, the
    more history everything downstream has).
2. **Chemistry function** + ranked-users upgrade (map pins become smart).
3. **Confidence prompts** (client + one RPC).
4. **Nudge campaigns** 1–2 on lifecycle-runner (enable pg_cron).
5. **Auto-Generate** nightly job (biggest lift, biggest payoff — the app
   creates its own liveliness).
6. Progression layer (streaks → tiers → chains) as polish.
