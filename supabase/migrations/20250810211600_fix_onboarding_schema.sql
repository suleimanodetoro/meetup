-- supabase/migrations/20250810_fix_onboarding_schema.sql

-- Fix the enum constraints to match the app's actual values
ALTER TABLE public.profiles 
DROP CONSTRAINT IF EXISTS profiles_meeting_preference_check;

ALTER TABLE public.profiles 
ADD CONSTRAINT profiles_meeting_preference_check 
CHECK (meeting_preference IN ('go-together', 'meet-there', 'chat-first', 'no-plans'));

ALTER TABLE public.profiles 
DROP CONSTRAINT IF EXISTS profiles_gender_preference_check;

ALTER TABLE public.profiles 
ADD CONSTRAINT profiles_gender_preference_check 
CHECK (gender_preference IN ('guys', 'girls', 'everyone'));

-- Ensure all columns exist with proper types
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS interests jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS languages jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS meeting_preference text,
ADD COLUMN IF NOT EXISTS gender_preference text;

-- Create or replace the handle_new_user function to ensure profile creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (
    id,
    full_name,
    avatar_url,
    onboarding_completed,
    onboarding_step,
    updated_at
  ) VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'full_name', ''),
    COALESCE(new.raw_user_meta_data->>'avatar_url', ''),
    false,
    0,
    now()
  ) ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$;

-- Ensure the trigger exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();