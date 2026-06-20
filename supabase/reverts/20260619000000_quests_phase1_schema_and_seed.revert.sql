-- REVERT for 20260619000000_quests_phase1_schema_and_seed.sql
-- Your "out if it goes sideways." Run this to fully undo that migration.
-- Safe because the migration was additive: this only drops what it added.
-- Wrapped in a transaction so it is all-or-nothing (no half-applied revert).

BEGIN;

-- 1. events: remove the quest-instance columns (drops the quest_catalog FK too)
ALTER TABLE public.events
  DROP COLUMN IF EXISTS quest_catalog_id,
  DROP COLUMN IF EXISTS kind,
  DROP COLUMN IF EXISTS status,
  DROP COLUMN IF EXISTS comfort,
  DROP COLUMN IF EXISTS completed_at;

-- 2. drop the new tables (dependents first)
DROP TABLE IF EXISTS public.quest_ledger;
DROP TABLE IF EXISTS public.quest_tags;
DROP TABLE IF EXISTS public.quest_catalog;

-- 3. restore the original reports.target_type CHECK (without 'quest').
--    Reclassify any quest reports first so the narrower CHECK can re-apply.
UPDATE public.reports SET target_type = 'event' WHERE target_type = 'quest';
ALTER TABLE public.reports DROP CONSTRAINT IF EXISTS reports_target_type_check;
ALTER TABLE public.reports ADD CONSTRAINT reports_target_type_check
  CHECK (target_type IN ('user', 'message', 'event', 'conversation'));

COMMIT;
