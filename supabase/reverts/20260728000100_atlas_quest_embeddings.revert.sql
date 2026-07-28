-- Revert for 20260728000100_atlas_quest_embeddings.sql
-- Drops only what the forward migration added. The `vector` extension is
-- deliberately left installed: dropping an extension is a cluster-level
-- decision and other consumers may exist by the time this runs.

begin;

drop function if exists public.atlas_match_quests(text, integer, smallint, smallint, text, boolean, integer);
drop table if exists public.atlas_quest_embeddings;

commit;
