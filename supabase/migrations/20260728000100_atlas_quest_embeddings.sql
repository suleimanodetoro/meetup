-- Atlas semantic quest retrieval: pgvector + quest embeddings + match RPC
--
-- Enables the `vector` extension (first use in this project) and adds a
-- versioned embedding side-table for quest_catalog, plus the service-only
-- retrieval RPC the atlas-plan edge function calls. Embeddings live in their
-- own table (not a column on quest_catalog) so the catalog itself is
-- untouched and re-embedding with a new model/version is a plain re-upsert.
--
-- Embeddings are produced by the shared embedder module
-- (supabase/functions/atlas-plan/lib/embedder.ts) and backfilled locally via
-- `npm run atlas:embed-quests`. The v0 embedder is deterministic feature
-- hashing (256 dims, cosine) — honest lexical retrieval that runs with zero
-- credentials; the embedding_version column exists precisely so a learned
-- model can replace it row-by-row later.
--
-- The scalar quest dimensions (duration, cost tier, risk tier, social mode)
-- stay HARD filters here, exactly as suggest_quest treats them — the vector
-- only replaces the hand-tuned "+40 category/vibe overlap" ranking term.

create extension if not exists vector with schema extensions;

create table if not exists public.atlas_quest_embeddings (
  quest_id bigint primary key references public.quest_catalog (id) on delete cascade,
  embedding extensions.vector(256) not null,
  embedding_version text not null,
  -- Hash of the embedded source text (title + dare + why + category + vibe)
  -- so the backfill can skip rows whose content has not changed.
  content_hash text not null,
  updated_at timestamptz not null default now()
);

comment on table public.atlas_quest_embeddings is
  'Versioned semantic embeddings for quest_catalog templates, used by Atlas retrieval. Service-role only.';

create index if not exists atlas_quest_embeddings_hnsw_idx
  on public.atlas_quest_embeddings
  using hnsw (embedding extensions.vector_cosine_ops);

alter table public.atlas_quest_embeddings enable row level security;

revoke all on table public.atlas_quest_embeddings from anon, authenticated;

-- Semantic retrieval over the quest catalog with hard scalar constraint
-- filters. Service-role only (Atlas runs server-side, like chemistry_score
-- after 20260726090100).
create or replace function public.atlas_match_quests(
  p_embedding text,
  p_time_max integer default null,
  p_budget smallint default null,
  p_risk_max smallint default null,
  p_social text default null,
  p_require_solo_safe boolean default false,
  p_limit integer default 12
)
returns table (
  quest_id bigint,
  slug text,
  title text,
  dare text,
  why text,
  category text,
  energy_level smallint,
  social_mode text,
  duration_min integer,
  cost_tier smallint,
  budget_min numeric,
  budget_max numeric,
  currency text,
  risk_tier smallint,
  is_solo_safe boolean,
  vibe text[],
  interests jsonb,
  similarity double precision,
  embedding_version text
)
language plpgsql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_query extensions.vector(256);
  v_limit integer := least(greatest(coalesce(p_limit, 12), 1), 50);
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role'
     and session_user <> 'postgres' then
    raise exception 'atlas_match_quests: service role required'
      using errcode = '42501';
  end if;

  if p_embedding is null then
    raise exception 'atlas_match_quests: p_embedding is required'
      using errcode = '22023';
  end if;

  if p_social is not null
     and p_social not in ('solo', 'pair', 'group', 'either') then
    raise exception 'atlas_match_quests: invalid p_social %', p_social
      using errcode = '22023';
  end if;

  -- Cast errors (wrong dimension / malformed literal) surface to the caller;
  -- the only caller is the Atlas engine, which owns the embedder.
  v_query := p_embedding::extensions.vector(256);

  return query
  select
    q.id,
    q.slug,
    q.title,
    q.dare,
    q.why,
    q.category,
    q.energy_level,
    q.social_mode,
    q.duration_min,
    q.cost_tier,
    q.budget_min,
    q.budget_max,
    q.currency,
    q.risk_tier,
    q.is_solo_safe,
    q.vibe,
    q.interests,
    1 - (e.embedding operator(extensions.<=>) v_query)::double precision,
    e.embedding_version
  from public.atlas_quest_embeddings e
  join public.quest_catalog q on q.id = e.quest_id
  where q.is_active
    and (p_time_max is null or q.duration_min <= p_time_max)
    and (p_budget is null or q.cost_tier <= p_budget)
    and (p_risk_max is null or q.risk_tier <= p_risk_max)
    and (
      p_social is null
      or q.social_mode = p_social
      or q.social_mode = 'either'
    )
    and (not p_require_solo_safe or q.is_solo_safe)
  order by e.embedding operator(extensions.<=>) v_query asc, q.id asc
  limit v_limit;
end;
$$;

comment on function public.atlas_match_quests(text, integer, smallint, smallint, text, boolean, integer) is
  'Atlas semantic quest retrieval: cosine match over atlas_quest_embeddings with hard scalar filters. Service-role only.';

-- Postgres grants EXECUTE to PUBLIC by default on new functions; this
-- codebase always revokes and re-grants explicitly (regression happened
-- before on get_city_plans_ranked — see 20260620000000).
revoke all on function public.atlas_match_quests(text, integer, smallint, smallint, text, boolean, integer)
  from public, anon, authenticated;

grant execute on function public.atlas_match_quests(text, integer, smallint, smallint, text, boolean, integer)
  to service_role;
