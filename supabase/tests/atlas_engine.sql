-- Run against the local seeded database only:
--   psql postgresql://postgres:postgres@127.0.0.1:54322/postgres \
--     -X -v ON_ERROR_STOP=1 -f supabase/tests/atlas_engine.sql
--
-- Every data mutation is rolled back. A failed assertion aborts the script.
--
-- Covers the Atlas SQL surface added in 20260728000000/20260728000100:
-- lockdown posture of atlas_decisions and atlas_quest_embeddings, the
-- atlas_match_quests grants, its cosine ordering, and its hard scalar
-- filters.

begin;

do $$
declare
  v_short_id bigint;
  v_short_dur int;
  v_long_id bigint;
  v_long_dur int;
  v_x text;
  v_y text;
  v_near_y text;
  v_row record;
  v_count int;
  v_decision_id bigint;
begin
  -- ------------------------------------------------------------------
  -- Extension + lockdown posture
  -- ------------------------------------------------------------------
  if not exists (select 1 from pg_extension where extname = 'vector') then
    raise exception 'pgvector extension is not installed';
  end if;

  if not (select relrowsecurity from pg_class where oid = 'public.atlas_decisions'::regclass) then
    raise exception 'atlas_decisions must have RLS enabled';
  end if;
  if exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'atlas_decisions') then
    raise exception 'atlas_decisions must have ZERO policies (service-only table)';
  end if;
  if has_table_privilege('authenticated', 'public.atlas_decisions', 'SELECT')
     or has_table_privilege('anon', 'public.atlas_decisions', 'SELECT') then
    raise exception 'clients must not be able to read atlas_decisions';
  end if;

  if not (select relrowsecurity from pg_class where oid = 'public.atlas_quest_embeddings'::regclass) then
    raise exception 'atlas_quest_embeddings must have RLS enabled';
  end if;
  if has_table_privilege('authenticated', 'public.atlas_quest_embeddings', 'SELECT')
     or has_table_privilege('anon', 'public.atlas_quest_embeddings', 'SELECT') then
    raise exception 'clients must not be able to read atlas_quest_embeddings';
  end if;

  if has_function_privilege(
    'authenticated',
    'public.atlas_match_quests(text,integer,smallint,smallint,text,boolean,integer)',
    'EXECUTE'
  ) then
    raise exception 'authenticated can execute atlas_match_quests';
  end if;
  if has_function_privilege(
    'anon',
    'public.atlas_match_quests(text,integer,smallint,smallint,text,boolean,integer)',
    'EXECUTE'
  ) then
    raise exception 'anon can execute atlas_match_quests';
  end if;
  if not has_function_privilege(
    'service_role',
    'public.atlas_match_quests(text,integer,smallint,smallint,text,boolean,integer)',
    'EXECUTE'
  ) then
    raise exception 'service_role is missing atlas_match_quests execute privileges';
  end if;

  -- ------------------------------------------------------------------
  -- Retrieval semantics: cosine ordering + hard scalar filters
  -- ------------------------------------------------------------------
  -- Derive the fixture pair from the live catalog: the shortest and longest
  -- group-compatible templates (durations differ, so the time filter can
  -- separate them).
  select id, duration_min into v_short_id, v_short_dur
  from public.quest_catalog
  where is_active and social_mode in ('group', 'either')
  order by duration_min asc, id asc
  limit 1;

  select id, duration_min into v_long_id, v_long_dur
  from public.quest_catalog
  where is_active and social_mode in ('group', 'either')
  order by duration_min desc, id desc
  limit 1;

  if v_short_id is null or v_long_id is null or v_long_dur <= v_short_dur then
    raise exception 'quest_catalog seed lacks group templates with distinct durations (% .. %)',
      v_short_dur, v_long_dur;
  end if;

  -- Orthogonal unit vectors: x for the short quest, y for the long one.
  v_x := '[1' || repeat(',0', 255) || ']';
  v_y := '[0,1' || repeat(',0', 254) || ']';
  v_near_y := '[0.1,0.9' || repeat(',0', 254) || ']';

  insert into public.atlas_quest_embeddings (quest_id, embedding, embedding_version, content_hash)
  values
    (v_short_id, v_x::extensions.vector(256), 'test-v0', 'hash-short'),
    (v_long_id, v_y::extensions.vector(256), 'test-v0', 'hash-long');

  -- Nearest to y must be the long quest, and similarity must order the rows.
  select * into v_row
  from public.atlas_match_quests(p_embedding := v_near_y, p_limit := 5)
  limit 1;
  if v_row.quest_id is distinct from v_long_id then
    raise exception 'cosine ordering broken: expected quest % first, got %', v_long_id, v_row.quest_id;
  end if;
  if v_row.similarity <= 0.5 then
    raise exception 'similarity for near-parallel vectors should be high, got %', v_row.similarity;
  end if;

  -- Hard time filter removes the long quest even though it is the better match.
  select count(*) into v_count
  from public.atlas_match_quests(p_embedding := v_near_y, p_time_max := v_short_dur, p_limit := 5)
  where quest_id = v_long_id;
  if v_count <> 0 then
    raise exception 'p_time_max filter failed to exclude the long quest';
  end if;

  select count(*) into v_count
  from public.atlas_match_quests(p_embedding := v_near_y, p_time_max := v_short_dur, p_limit := 5)
  where quest_id = v_short_id;
  if v_count <> 1 then
    raise exception 'p_time_max filter also lost the short quest';
  end if;

  -- Invalid inputs are rejected loudly.
  begin
    perform * from public.atlas_match_quests(p_embedding := null);
    raise exception 'null embedding was accepted';
  exception when sqlstate '22023' then
    null;
  end;
  begin
    perform * from public.atlas_match_quests(p_embedding := v_x, p_social := 'swarm');
    raise exception 'invalid p_social was accepted';
  exception when sqlstate '22023' then
    null;
  end;

  -- ------------------------------------------------------------------
  -- Decision ledger shape
  -- ------------------------------------------------------------------
  insert into public.atlas_decisions (raw_intent, engine_version, compiler_kind, stage, status, mode)
  values ('regression intent', 'atlas-test', 'mock', 'decided', 'proposed', 'shadow')
  returning id into v_decision_id;

  select * into v_row from public.atlas_decisions where id = v_decision_id;
  if v_row.compiled_intent::text <> '{}' or v_row.retrieval_candidates::text <> '[]' then
    raise exception 'jsonb defaults drifted: compiled_intent must be {} and retrieval_candidates []';
  end if;

  begin
    insert into public.atlas_decisions (raw_intent, engine_version, compiler_kind, status)
    values ('bad', 'atlas-test', 'mock', 'sideways');
    raise exception 'invalid status was accepted';
  exception when check_violation then
    null;
  end;

  begin
    insert into public.atlas_decisions (raw_intent, engine_version, compiler_kind)
    values ('bad', 'atlas-test', 'gpt-oops');
    raise exception 'invalid compiler_kind was accepted';
  exception when check_violation then
    null;
  end;

  raise notice 'atlas engine surface regression passed';
end;
$$;

rollback;
