# Spec 02 — Chemistry Matching (+ intent capture)

**Required reading first:** `docs/specs/00-overview.md`. Depends on spec 01
(engine_events + `log_engine_event` must exist).

## Goal

A real people↔people compatibility score — the README's "multi-signal
compatibility scoring using interests, geography, date overlap, and behavioural
data" — wired into the discovery surfaces so the home map's people pins and the
city user rankings become *the most compatible people*, not arbitrary ones.
Plus: **persist the intent flow** so stated preferences become behavioural
signal (today `app/create-plan/intent.tsx` submissions are thrown away).

## Deliverables

### 1. Migration: `quest_intents`

```sql
create table public.quest_intents (
  id           bigint generated always as identity primary key,
  user_id      uuid not null references public.profiles(id) on delete cascade,
  city         text,            -- profile location at submission time
  country_code text,
  energy       smallint,        -- 1..3, nullable (user may skip sliders)
  social       text check (social in ('solo','pair','group','either')),
  time_max     int,             -- minutes
  budget       smallint,        -- 0..2
  comfort      smallint,        -- 1..3
  categories   text[],
  created_at   timestamptz not null default now()
);
```

RLS: insert own rows (user_id = auth.uid()), select own rows only. Engine
functions read it as definer/service role.

### 2. Client: persist intent submissions

In `app/create-plan/intent.tsx`, when the user requests suggestions (find the
existing `suggest_quest` call), also fire-and-forget an insert into
`quest_intents` with the current slider values + the profile's city/country
(non-blocking: failure must never break the suggestion flow) and emit
`log_engine_event('intent.submitted', payload: {energy, social, time_max,
budget, categories})`. One insert per suggestion request, not per slider move.

### 3. SQL function: `chemistry_score(p_a uuid, p_b uuid)`

STABLE, SECURITY DEFINER (reads private prefs), `SET search_path`, revoke
anon/public — callable by authenticated (it exposes only a number + reasons,
never the underlying private fields). Returns
`table(score int, reasons text[])`.

Hard exclusions (return score 0, empty reasons):
- any `blocked_users` row in either direction;
- either profile lacks `onboarding_completed = true`;
- gender/meeting-preference incompatibility — **read `get_users_in_city`'s
  SQL first and reuse its exact gender_preference semantics** so chemistry
  never surfaces someone discovery would filter out;
- `user_privacy_settings.profile_visibility = 'private'` on either side
  (friends-only visibility: allow only if an accepted friendship exists —
  again mirror existing discovery RPC behaviour).

Additive components (cap total 100):

| Component | Rule | Max |
|---|---|---|
| Shared interests | 10 per shared entry of `profiles.interests` (jsonb array ∩) | 30 |
| Geography | same `location` city +20, else same `location_country` +8 | 20 |
| Visit overlap | any overlapping `visits` window in the same city (either direction, next 90d) +20; same-city visits without overlap +6 | 20 |
| Meeting prefs | both have compatible `meeting_preference` (neither 'no-plans') +10 | 10 |
| Languages | +5 per shared language (jsonb array ∩) | 10 |
| Behavioural | stated-intent similarity: both have `quest_intents` in the last 30d whose modal `energy` matches (+3) and modal `social` matches (+3); friends-of-warm bonus: exists mutual accepted friend M where pair(M, other) is warm/hot in `pair_pulse` (+4) | 10 |

`reasons` collects human strings for components that scored ("3 shared
interests", "both in Dundee", "overlapping visit dates", "similar energy") —
UI may use them later; keep them short and generic.

### 4. Discovery integration

Upgrade **both** ranked-user RPCs (CREATE OR REPLACE + **re-apply the full
REVOKE/GRANT lockdown** — that regression already happened once, see
`20260620000000_quests_phase1b_engine.sql` comments):

- `get_city_users_ranked(...)`: keep the existing window/overlap tier as the
  primary sort; add `chemistry_score(auth.uid(), candidate)` as the secondary
  sort (replacing/preceding whatever arbitrary tiebreak exists today). Also
  return the chemistry score as an extra column (additive change — confirm the
  client tolerates extra columns; it does with supabase-js `select` RPCs).
- `get_users_in_city(...)` (home map's 12 people pins): order by chemistry
  desc, then whatever its current ordering is.

Performance guard: score only the candidate set the RPC already produced
(bounded by city + filters + LIMIT), never all-users × all-users. If the
function currently limits after ordering, ensure the candidate set entering
chemistry scoring is ≤ ~500 rows (add a sane pre-limit if needed and note it).

## Out of scope

Client "why matched" UI, changes to `suggest_quest` (quest↔mood matching is
fine as-is), pair_pulse changes, any new screens.

## Verification (all local)

1. `supabase db reset` + `npm run seed`.
2. Direct SQL: `chemistry_score` for (a) two Dundee seeds sharing interests —
   expect same-city +20 and interest points with reasons; (b) a blocked pair —
   0; (c) cross-city pair with overlapping Dundee visits — visit points.
3. Insert two compatible `quest_intents` rows and confirm the behavioural
   component moves.
4. Call `get_users_in_city('Dundee','United Kingdom')` as an authed seed user
   before/after: same candidates, chemistry-informed order, extra column
   present; anon call still rejected.
5. Intent screen: code-walk the insert (non-blocking, correct payload); local
   run of the app if trivially available, else report code-verified.
6. `npx tsc --noEmit` — zero new errors.

## Definition of done

Migration + client capture + chemistry function + both discovery RPCs
upgraded with lockdown intact, verified as above, no commits, report with
evidence including example scores from step 2.
