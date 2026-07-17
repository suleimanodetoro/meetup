# Spec 03 — Confidence Layer

**Required reading first:** `docs/specs/00-overview.md`. Depends on spec 01
(`pair_pulse`, `engine_events`, `log_engine_event`).

## Goal

The README's "graduated exposure: group → friend request → DMs". The rails
already exist in the product (event group chats are auto-created; DMs unlock
via accepted friendships; `message_privacy` is enforced). What's missing is
the intelligence deciding **when to prompt graduation**. This spec adds the
prompt engine and the two highest-value client moments. The layer prompts —
it never bypasses privacy gates.

## Deliverables

### 1. Migration: `prompt_dismissals`

```sql
create table public.prompt_dismissals (
  user_id     uuid not null references public.profiles(id) on delete cascade,
  target_id   uuid not null references public.profiles(id) on delete cascade,
  prompt_type text not null,
  created_at  timestamptz not null default now(),
  primary key (user_id, target_id, prompt_type)
);
```

RLS: insert/select own rows (`user_id = auth.uid()`).

### 2. RPC: `get_graduation_prompts(p_limit int default 3)`

SECURITY DEFINER, `SET search_path`, revoke anon/public, grant authenticated.
Returns for the **calling** user: `table(prompt_type text, target_id uuid,
target_name text, target_avatar_url text, context text, rank int)`.

Candidate rules (union, then rank, then limit):

- **`post_quest_add`** — highest priority. Users the caller co-attended an
  event with, where the event completed OR its date passed within the last
  7 days, and no `friendships` row exists in either direction. `context`:
  the event title.
- **`warm_pair_add`** — pairs in `pair_pulse` at warm/hot with the caller,
  no friendship row either direction. `context`: "You two keep crossing paths"
  -style neutral string plus quest count if `quest_ledger` has one.

Universal exclusions, applied to both:
- any `blocked_users` row either direction;
- target's `user_privacy_settings.allow_friend_requests = false`;
- target's `profile_visibility='private'`;
- a row in `prompt_dismissals` for (caller, target, prompt_type);
- a `friendships` row with status 'pending' (already requested — never nag),
  'declined' (respect the no), or 'blocked'.

Rank: post_quest_add before warm_pair_add; within type, most recent shared
activity first. Deduplicate targets across types (keep the higher-priority
prompt).

### 3. Client moment A — post-completion prompt

In `app/event/[id]/index.tsx`, the quest-completion flow (`completeWith`)
already knows the chosen partner. On successful completion **with a partner
who is not already a friend** (check `friendships` both directions), show an
inline follow-up in the same bottom sheet before it closes — "Add {name} as a
friend?" with a filled `GradientButton` (accept) and a plain text dismiss.

- Accept → reuse the existing friend-request insert flow (find it in
  `app/profile/[userId].tsx` — do not reinvent the write; extract/share if
  needed) + `log_engine_event('confidence.prompt_accepted', {type:
  'post_quest_add'})`.
- Dismiss → insert `prompt_dismissals` + `log_engine_event(
  'confidence.prompt_dismissed', ...)`.
- Shown → `log_engine_event('confidence.prompt_shown', ...)` once per display.

### 4. Client moment B — warm-pair prompt on profile

In `app/profile/[userId].tsx`: when viewing a non-friend whose
`get_graduation_prompts` includes them (fetch once alongside the existing
pair queries — or cheaper: reuse the already-fetched pair_pulse state +
friendship status client-side and only consult dismissals), render a
dismissible one-liner card under the pulse/ledger badges: context string +
"Add friend" (existing request flow) + an X (writes dismissal). Same three
engine_events as moment A with `type: 'warm_pair_add'`.

Keep both moments visually quiet — a nudge, not a takeover. Match each
screen's existing card/chip idioms.

## Out of scope

DM-unlock changes (friendship gating stays exactly as is), push/email nudges
(Pulse owns those), a dedicated "people you may know" screen, batching prompts
into feeds.

## Verification (all local)

1. `supabase db reset` + `npm run seed`; manufacture: pair E-F co-attended a
   past-dated event, no friendship (→ post_quest_add); pair G-H warm in
   pair_pulse, no friendship (→ warm_pair_add); pair with pending request
   (→ excluded); target with allow_friend_requests=false (→ excluded).
2. Call `get_graduation_prompts` as each test user; assert exact
   inclusion/exclusion and ranking. Anon rejected.
3. Dismiss one prompt (insert via RPC path from the app code or SQL as the
   user); re-call — it must not return.
4. Code-walk both client moments end-to-end (shown/accepted/dismissed events,
   reused request flow); simulator verification if trivially available.
5. `npx tsc --noEmit` — zero new errors.

## Definition of done

Migration + RPC + two client moments + full engine_events instrumentation,
verified as above, no commits, report with the RPC outputs from step 2 as
evidence.
