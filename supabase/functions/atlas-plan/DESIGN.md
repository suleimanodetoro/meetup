# Atlas — the Waypoint planning engine

Atlas turns a free-text human intention into a **verified, executable,
fully-audited** group plan. It is not "an LLM that suggests activities": the
model (when enabled) is confined to one job — compiling prose into a typed
plan request — and everything after that boundary is deterministic,
inspectable code whose every decision is recorded and replayable.

```
"I'm new to Leeds, free 7–10 tonight, have £15, don't drink,
 feel awkward meeting strangers, and like photography."
        │
        ▼
┌────────────────────┐   ANTHROPIC_API_KEY set → claude-opus-5, structured
│ 1 INTENT COMPILER  │   outputs against a strict JSON schema; otherwise (or
│   prose → typed    │   on refusal/timeout) a deterministic rule-based
│   constraints      │   compiler. Either way normalizeWireIntent() clamps
└─────────┬──────────┘   every field before the engine trusts it.
          ▼
┌────────────────────┐   pgvector cosine search over quest_catalog
│ 2 SEMANTIC         │   embeddings; scalar dimensions (duration, cost tier,
│   RETRIEVAL        │   risk tier, social mode) stay HARD SQL filters.
└─────────┬──────────┘   Falls back to suggest_quest when no embeddings.
          ▼
┌────────────────────┐   Pairwise chemistry_score over city candidates,
│ 3 GROUP            │   greedy average-linkage seeded on the requester.
│   COMPOSITION      │   Every candidate — selected or not — gets a written
└─────────┬──────────┘   reason in the ledger. Zero-score edges disqualify.
          ▼
┌────────────────────┐   Static per-country UTC offsets (±1h documented
│ 4 SCHEDULE         │   approximation, same as auto-generate), honoring the
└─────────┬──────────┘   stated window.
          ▼
┌────────────────────┐   16 pure checks (some conditional): budget tier and
│ 5 DETERMINISTIC    │   amount, time fit, risk vs comfort, hard-exclusion
│   VERIFIER         │   tags (word-boundary), group size, chemistry floor,
│   AI proposes,     │   member eligibility (re-asserted), future start,
│   code decides     │   window honor, sociable hours, horizon. block fails
└─────────┬──────────┘   kill the plan; warns ride along. Candidates are
          │              tried in retrieval order until
          ▼              one passes — rejected attempts keep their results.
┌────────────────────┐   One atlas_decisions row per request: raw intent,
│ 6 DECISION LEDGER  │   compiled constraints, all candidates + rejection
│   + REPLAY         │   reasons, proposal, verifier output, engine/model/
└────────────────────┘   prompt/embedding versions, timings.
```

## Why this shape

Waypoint's engine (Chemistry, Pulse, Auto-Generate) is deterministic and
hand-tuned — deliberately so; it shipped. Atlas adds the intelligent layer on
top **without surrendering any of the properties that made the deterministic
stack trustworthy**:

- **Typed boundary.** The LLM produces a `CompiledIntent` under a strict JSON
  schema (`INTENT_WIRE_JSON_SCHEMA`), and `normalizeWireIntent()` clamps every
  numeric range and enum afterward. Nothing downstream ever parses prose.
- **Degradation is a feature.** No API key, a refusal, a timeout, a malformed
  answer — every failure lands on the deterministic rule-based compiler, and
  `compiler_kind` in the ledger says which path ran. The pipeline is fully
  operational with zero credentials, which is also what makes it testable.
- **Verification is code, not vibes.** The verifier re-asserts facts upstream
  stages already enforced (member eligibility, chemistry floor) exactly the
  way `reserve_autogen_event` re-validates clusters the edge function already
  filtered — defense in depth against every earlier stage, including the
  model.
- **Provenance is the product.** `atlas_decisions` records what was
  considered, what was rejected, and why — including the candidates that did
  NOT make the group and each verifier check that passed. `npm run
  atlas:replay` re-runs history under the current engine and reports drift.

## Components

| Piece | Where | Notes |
| --- | --- | --- |
| Decision ledger | `supabase/migrations/20260728000000_atlas_decision_ledger.sql` | Service-only (RLS, zero policies). jsonb discipline: objects `'{}'`, arrays `'[]'`. |
| pgvector + retrieval RPC | `supabase/migrations/20260728000100_atlas_quest_embeddings.sql` | First `vector` usage in the project. HNSW index, versioned embeddings side-table, `atlas_match_quests` (service-role only, hard scalar filters). |
| Engine core | `supabase/functions/atlas-plan/lib/` | Runtime-agnostic TypeScript (no Deno globals, `.ts`-extension imports) — the same modules run in the Deno edge runtime, Node's test runner, and tsx scripts. |
| Anthropic adapter | `supabase/functions/atlas-plan/lib/anthropic.ts` | `claude-opus-5`, structured outputs, 30 s timeout, refusal handled (`stop_reason` checked before content). Dynamically imported only when the key exists. |
| HTTP entrypoint | `supabase/functions/atlas-plan/index.ts` | Client-invoked (`verify_jwt = true`); service-role callers pass `user_id`. |
| Embedder v0 | `supabase/functions/atlas-plan/lib/embedder.ts` | Deterministic 256-dim signed feature hashing (unigrams+bigrams, L2). Honest lexical retrieval, zero credentials, byte-identical across runtimes. `EMBEDDING_VERSION` exists so a learned model is a re-upsert, not a schema change. |
| Backfill | `npm run atlas:embed-quests` | Idempotent (content-hash + version skip). Local-only guard shared with the seed scripts. |
| Replay | `npm run atlas:replay` | Compile + verifier drift against recorded decisions, zero side effects. |
| Dev screen | `app/atlas/index.tsx` | Settings → “Dev — Atlas” (`__DEV__`), registered in NavigationController `staticRoutes`. Renders compiled chips, the plan, the group with cooperative roles, and the full verifier checklist. |
| Tests | `npm run test:atlas` + `supabase/tests/atlas_engine.sql` | 35 Node unit tests over compiler/embedder/optimizer/verifier/engine; SQL regression covers lockdown posture, grants, cosine ordering, hard filters, ledger constraints (wired into `scripts/test-db.sh`). |

## Shadow mode (and what live will take)

This slice **never creates anything**: no events, no invites, no messages.
`mode` is pinned to `shadow` and anything else is a 400. That is deliberate —
it makes the full pipeline safe to run against production traffic for
calibration before a single user-visible action happens.

The live slice already has its pattern picked out: a `reserve_atlas_event`
RPC modeled on `reserve_autogen_event` (single transaction: event +
quest_tags + provenance + lifecycle claims + invite outbox; per-city advisory
lock; deterministic idempotency key), reusing the invite outbox machinery
verbatim. Nothing in the current response shape needs to change.

## Security posture

- `atlas_decisions` / `atlas_quest_embeddings`: RLS enabled, zero policies,
  grants revoked (engine_events convention).
- `atlas_match_quests`: EXECUTE revoked from public/anon/authenticated,
  granted to service_role, in-body role guard (autogen RPC convention).
- The edge function is JWT-verified; requester identity comes from the
  token, never the body (service-role callers excepted, and they must name a
  user).
- The client response deliberately omits the considered-candidates list —
  who was rejected from a group and why names other users; that stays in the
  service-only ledger. Pairwise chemistry scores are likewise aggregated
  (avg + weakest) in the response.
- The LLM sees the requester's intent text and coarse profile context (city,
  country) — never other users' data; group composition happens entirely in
  deterministic code on the service side.
- Client copies of verifier details and rejection reasons are sanitized (no
  UUIDs in prose); the raw text lives only in the ledger. The dev screen is
  additionally gated at the component level, so a production deep link to
  `/atlas` redirects to the tabs.
- Per-user throttle: `ATLAS_MAX_REQUESTS_PER_HOUR` (default 20) checked
  against the decision ledger — each request can spend an LLM call and up to
  66 chemistry RPCs, so the ceiling is per-caller, not just per-request.
  Service-role callers are exempt.
- The service-key check uses a constant-time comparison, and `toCityKey`
  strips LIKE/PostgREST wildcards so a user-controlled city can never widen
  the candidate match beyond one city.
- Scope note: planning in an intent-stated city (not just the profile city)
  exposes group members' names/ids for that city — the same class of
  information the existing authenticated discovery RPCs
  (`get_users_in_city`, `get_city_users_ranked`) already return for any
  city, including a per-user chemistry column. Atlas returns strictly less
  (≤5 members, aggregate chemistry only), now bounded further by the
  throttle.

## Honest limitations (v0)

- **Embeddings are lexical.** Feature hashing captures vocabulary overlap,
  not meaning; similarity numbers are low (a top match ~0.2). The interface —
  pgvector schema, HNSW index, versioned rows, retrieval RPC — is exactly
  what a learned embedding model plugs into.
- **Replay covers compile + verify.** Full-pipeline replay needs the
  candidate/chemistry snapshot persisted per decision; listed below.
- **Static UTC offsets, no DST** — same documented ±1h approximation
  auto-generate uses, flagged in every schedule label.
- **A "tonight" window that has already passed rolls to tomorrow** at the
  same wall-clock time (labeled truthfully) rather than rejecting.
- **`npm run test:atlas` needs Node ≥ 22.6** (`--experimental-strip-types`).
  The repository's quality workflow pins Node 22.6 and runs the Atlas suite as
  part of `npm test` before the database regression suite.
- Compiled-intent budget semantics are GBP (matching quest_catalog).

## Roadmap

1. **Live execution slice** — `reserve_atlas_event` + invite outbox reuse,
   `ATLAS_ALLOW_LIVE` gate, consented cohort.
2. **Candidate snapshot in the ledger** → full-pipeline counterfactual
   replay (`engine vNext would have chosen differently on N of M decisions`).
3. **Learned embeddings** behind `EMBEDDING_VERSION` (server-side only; keys
   never ship in the bundle).
4. **Outcome joins** — attendance, completion, pair_pulse deltas and repeat
   interaction at +7/+30 days keyed by `decision_id`, alongside the
   existing `atlas.decision` engine_events row.
5. **Decision observatory** — an operator UI over `atlas_decisions` (the
   data model already supports it; this document's pipeline diagram is
   essentially its wireframe).
6. **Bandit selection among verified-safe candidates** once outcome volume
   exists — never before.
