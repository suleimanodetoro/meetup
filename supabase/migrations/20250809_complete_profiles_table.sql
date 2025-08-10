-- supabase/migrations/20250809_complete_profiles_table.sql

-- Add missing fields to profiles table for complete onboarding
-- Note: country/country_code exist in events and visits tables, but profiles needs nationality
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS gender text CHECK (gender IN ('male', 'female', 'other')),
ADD COLUMN IF NOT EXISTS nationality text, -- User's country of origin (full name)
ADD COLUMN IF NOT EXISTS nationality_code text, -- User's country code for flag display
ADD COLUMN IF NOT EXISTS interests jsonb DEFAULT '[]'::jsonb, -- Array of interest strings
ADD COLUMN IF NOT EXISTS meeting_preference text CHECK (meeting_preference IN ('travel_together', 'meet_there', 'message_first', 'no_plans')),
ADD COLUMN IF NOT EXISTS gender_preference text CHECK (gender_preference IN ('male', 'female', 'everyone')),
ADD COLUMN IF NOT EXISTS onboarding_completed boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS onboarding_step integer DEFAULT 0; -- Track which step they're on in case they drop off

-- Add indexes for commonly queried fields
CREATE INDEX IF NOT EXISTS idx_profiles_nationality_code ON public.profiles(nationality_code);
CREATE INDEX IF NOT EXISTS idx_profiles_gender ON public.profiles(gender);
CREATE INDEX IF NOT EXISTS idx_profiles_interests ON public.profiles USING gin(interests);
CREATE INDEX IF NOT EXISTS idx_profiles_onboarding_completed ON public.profiles(onboarding_completed);

-- Update the RLS policies if needed
-- These should already be covered by existing policies, but let's be explicit

