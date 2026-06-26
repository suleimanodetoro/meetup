-- supabase/migrations/20260626120000_widen_profiles_gender_check.sql

-- Widen the gender CHECK to match the onboarding selector. The column was
-- created inline in 20250809000000_complete_profiles_table.sql as
--   gender text CHECK (gender IN ('male', 'female', 'other'))
-- (Postgres auto-named the column constraint `profiles_gender_check`), but the
-- onboarding GenderField (modules/onboarding/fields/GenderField.tsx) lets users
-- pick 'non-binary' and 'prefer-not-to-say' too. Those two violated the old
-- constraint, so the gender step failed to save (Postgres error 23514). Allow
-- the full set the UI can emit. NULL stays permitted (column is nullable / the
-- step is skippable in spirit and edit-profile may clear it).
ALTER TABLE public.profiles
DROP CONSTRAINT IF EXISTS profiles_gender_check;

ALTER TABLE public.profiles
ADD CONSTRAINT profiles_gender_check
CHECK (gender IS NULL OR gender IN ('male', 'female', 'non-binary', 'other', 'prefer-not-to-say'));
