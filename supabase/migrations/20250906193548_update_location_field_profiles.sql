-- Migration: Update profiles location field for city-level location
-- File: supabase/migrations/20250906193548_update_location_field_profiles.sql.sql
-- Purpose: Use existing location field for city-level user location

-- The location field already exists from a previous migration (20250904214459_home_screen_functions.sql)
-- Just ensure it exists and add any missing related fields
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS location text,
ADD COLUMN IF NOT EXISTS location_country text,
ADD COLUMN IF NOT EXISTS location_country_code text,
ADD COLUMN IF NOT EXISTS location_updated_at timestamp with time zone;

-- Add indexes for location-based queries
CREATE INDEX IF NOT EXISTS idx_profiles_location ON public.profiles(location);
CREATE INDEX IF NOT EXISTS idx_profiles_location_country_code ON public.profiles(location_country_code);

-- Add comments for documentation
COMMENT ON COLUMN public.profiles.location IS 'User current city for discovery features';
COMMENT ON COLUMN public.profiles.location_country IS 'Country name for current location';
COMMENT ON COLUMN public.profiles.location_country_code IS 'ISO country code for current location';
COMMENT ON COLUMN public.profiles.location_updated_at IS 'Timestamp of last location update';

-- Create a function to find users in the same city
CREATE OR REPLACE FUNCTION public.get_users_in_city(
  city_name text,
  country_name text DEFAULT NULL
)
RETURNS TABLE(
  id uuid,
  full_name text,
  avatar_url text,
  bio text,
  location text,
  location_country text,
  nationality_code text,
  interests jsonb,
  gender text,
  updated_at timestamp with time zone
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT 
    p.id,
    p.full_name,
    p.avatar_url,
    p.bio,
    p.location,
    p.location_country,
    p.nationality_code,
    p.interests,
    p.gender,
    p.updated_at
  FROM public.profiles p
  WHERE 
    p.location = city_name
    AND (country_name IS NULL OR p.location_country = country_name)
    AND p.onboarding_completed = true
    AND p.id != auth.uid() -- Exclude current user
  ORDER BY p.updated_at DESC NULLS LAST
  LIMIT 200;
$$;

-- Create a function to find users in nearby cities (same country)
CREATE OR REPLACE FUNCTION public.get_nearby_city_users(
  user_city text,
  user_country text
)
RETURNS TABLE(
  id uuid,
  full_name text,
  avatar_url text,
  bio text,
  location text,
  location_country text,
  nationality_code text,
  interests jsonb,
  gender text
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT 
    p.id,
    p.full_name,
    p.avatar_url,
    p.bio,
    p.location,
    p.location_country,
    p.nationality_code,
    p.interests,
    p.gender
  FROM public.profiles p
  WHERE 
    p.location_country = user_country
    AND p.onboarding_completed = true
    AND p.id != auth.uid() -- Exclude current user
  ORDER BY 
    CASE WHEN p.location = user_city THEN 0 ELSE 1 END, -- Same city first
    p.updated_at DESC NULLS LAST
  LIMIT 200;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.get_users_in_city(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_nearby_city_users(text, text) TO authenticated;

-- Verification
DO $$
BEGIN
  RAISE NOTICE '==========================================';
  RAISE NOTICE 'Location field setup complete';
  RAISE NOTICE '==========================================';
  RAISE NOTICE 'Using columns:';
  RAISE NOTICE '  • location (city name)';
  RAISE NOTICE '  • location_country';
  RAISE NOTICE '  • location_country_code';
  RAISE NOTICE '  • location_updated_at';
  RAISE NOTICE '';
  RAISE NOTICE 'New functions added:';
  RAISE NOTICE '  • get_users_in_city()';
  RAISE NOTICE '  • get_nearby_city_users()';
  RAISE NOTICE '==========================================';
END $$;