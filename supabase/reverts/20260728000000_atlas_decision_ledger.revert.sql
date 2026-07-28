-- Revert for 20260728000000_atlas_decision_ledger.sql
-- Drops only what the forward migration added.

begin;

drop table if exists public.atlas_decisions;

commit;
