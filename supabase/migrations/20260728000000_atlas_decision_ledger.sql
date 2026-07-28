-- Atlas decision ledger
--
-- Atlas is the AI planning layer that turns a free-text intention into a
-- verified, executable plan proposal (see supabase/functions/atlas-plan).
-- Every plan request writes exactly one row here carrying the full decision
-- provenance: the raw intent, the compiled constraints, every retrieval and
-- group candidate considered (with rejection reasons), the proposal, each
-- deterministic verifier result, and the engine/model versions that produced
-- it. This is what makes Atlas inspectable and replayable instead of a black
-- box: `npm run atlas:replay` re-runs historical rows against the current
-- engine and diffs the verdicts.
--
-- Service-only table: same lockdown convention as engine_events /
-- autogen_generations (RLS enabled with zero policies, baseline grants
-- revoked). Clients never read or write it directly — the atlas-plan edge
-- function (service role) is the only writer.
--
-- jsonb shape discipline (load-bearing, do not mix):
--   objects  ('{}'::jsonb): compiled_intent, proposal, outcome
--   arrays   ('[]'::jsonb): retrieval_candidates, group_candidates,
--                           verifier_results

create table if not exists public.atlas_decisions (
  id bigint generated always as identity primary key,
  request_id uuid not null unique default gen_random_uuid(),
  -- Requester. SET NULL on account deletion so decision telemetry survives,
  -- mirroring engine_events.user_id.
  user_id uuid references auth.users (id) on delete set null,
  mode text not null default 'shadow' check (mode in ('shadow', 'live')),
  -- Stage the pipeline reached; 'decided' means the full pipeline ran.
  stage text not null default 'received' check (
    stage in ('received', 'compiled', 'retrieved', 'composed', 'verified', 'decided', 'error')
  ),
  -- Final verdict for the request. 'proposed' = verified plan produced
  -- (shadow mode never executes); 'rejected' = a blocking verifier check
  -- failed; 'error' = pipeline fault.
  status text not null default 'error' check (status in ('proposed', 'rejected', 'error')),
  city text,
  city_key text,
  country_code text,
  raw_intent text not null,
  compiled_intent jsonb not null default '{}'::jsonb,
  retrieval_candidates jsonb not null default '[]'::jsonb,
  group_candidates jsonb not null default '[]'::jsonb,
  proposal jsonb not null default '{}'::jsonb,
  verifier_results jsonb not null default '[]'::jsonb,
  outcome jsonb not null default '{}'::jsonb,
  engine_version text not null,
  compiler_kind text not null check (compiler_kind in ('mock', 'anthropic', 'anthropic_fallback_mock')),
  model_id text,
  prompt_version text,
  embedding_version text,
  latency_ms integer,
  error text,
  created_at timestamptz not null default now()
);

comment on table public.atlas_decisions is
  'Append-only decision provenance for the Atlas planning engine. One row per plan request; service-role only.';

create index if not exists atlas_decisions_user_recent_idx
  on public.atlas_decisions (user_id, created_at desc);

create index if not exists atlas_decisions_status_recent_idx
  on public.atlas_decisions (status, created_at desc);

-- Lockdown: RLS on with zero policies + grants revoked (default-deny for
-- clients; the service role bypasses RLS). Same posture as engine_events.
alter table public.atlas_decisions enable row level security;

revoke all on table public.atlas_decisions from anon, authenticated;
