# atlas-plan

Atlas is Waypoint's AI planning engine: it takes a free-text intention
("I'm new to Leeds, free 7–10 tonight, have £15, don't drink, feel awkward
meeting strangers, and like photography") and runs it through a typed,
verified, fully-audited pipeline:

```
free text
  → intent compiler        (LLM structured output, or rule-based mock)
  → semantic retrieval     (pgvector over quest_catalog + hard scalar filters)
  → group composition      (pairwise chemistry_score, greedy average-linkage,
                            requester-seeded, every rejection recorded)
  → schedule proposal      (static per-country UTC offsets, ±1h honesty)
  → deterministic verifier (budget / time / risk / exclusions / eligibility /
                            chemistry floor / sociable hours — AI proposes,
                            code decides)
  → decision ledger        (one atlas_decisions row per request, replayable)
```

**Shadow mode is the only mode in this slice.** The full pipeline runs and is
recorded, but nothing real happens: no events, no invitations, no messages.
Executing verified plans transactionally (a `reserve_atlas_event` sibling of
`reserve_autogen_event`) is the next slice.

## Invocation

Client-invoked, unlike the cron-driven functions: `verify_jwt = true`, the
caller's session JWT resolves the requester.

```ts
const { data } = await supabase.functions.invoke('atlas-plan', {
  body: { intent_text: 'free 7-10 tonight, £15, like photography' },
});
```

Service-role callers (ops, tests) must name the requester:

```bash
curl -s -X POST "$SUPABASE_URL/functions/v1/atlas-plan" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"user_id":"<uuid>","intent_text":"new to Leeds, free 7-10 tonight, £15, do not drink, awkward meeting strangers, like photography"}'
```

Body: `intent_text` (3–500 chars, required), `mode` (optional, must be
`"shadow"`), `user_id` (service callers only). Response carries `status`
(`proposed` | `rejected` | `error`), the compiled constraints, the plan (when
proposed), every verifier check, rejection reasons, and engine/model/version
metadata. The considered-candidates list (who was rejected from the group and
why) is deliberately **not** in the response — it names other users; it lives
only in the service-only `atlas_decisions` ledger.

## Secrets

| Name | Required | Effect |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | no | When set, intent compilation uses the Anthropic API (`claude-opus-5`, structured outputs). When unset — or on refusal/timeout/error — the deterministic rule-based compiler runs instead and the ledger records `compiler_kind`. |
| `ATLAS_MODEL` | no | Override the Anthropic model id. |
| `SYSTEM_HOST_USER_ID` | no | Excludes the system host from group candidates (username `waypoint` is excluded regardless). |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | injected | Edge runtime provides these. |

The function is fully operational with **zero** configured secrets — that is
the point of the provider boundary: deterministic mock end-to-end, flip one
secret for the live model.

## Data written per request

- `public.atlas_decisions` — one row: raw intent, compiled constraints, all
  retrieval candidates with similarity, all group candidates with selection /
  rejection reasons, the proposal, every verifier result, engine + model +
  prompt + embedding versions, latency. Service-role only (RLS, zero
  policies).
- `public.engine_events` — one `atlas.decision` row (metrics ledger).

## Retrieval prerequisites

Semantic retrieval reads `atlas_quest_embeddings` (see migration
`20260728000100`). Backfill locally with:

```bash
npm run atlas:embed-quests
```

Until embeddings exist the engine transparently falls back to the
deterministic `suggest_quest` ranker (`source: "suggest_quest_fallback"` in
the trace), so the pipeline works on a fresh `supabase db reset` either way.

## Local test

```bash
supabase start
npm run seed                # 75 personas to compose groups from
npm run atlas:embed-quests  # optional: enable vector retrieval
supabase functions serve atlas-plan --env-file ./supabase/functions/.env
# then the curl above with your local service_role key
```

## Replay

```bash
npm run atlas:replay
```

Re-runs recorded decisions through the current engine (compile → verify, no
side effects, no DB writes) and diffs status/quest/verifier verdicts — the
counterfactual harness for engine changes.

## Deploy

```bash
supabase functions deploy atlas-plan   # verify_jwt stays ON (client-invoked)
supabase secrets set ANTHROPIC_API_KEY=...   # optional, enables the live compiler
```
