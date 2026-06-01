-- Prefer current-location country codes anywhere the app renders "where they are"
-- flags. Nationality remains identity/background data.

DROP FUNCTION IF EXISTS public.get_users_in_city(text, text);
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
  location_country_code text,
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
    p.location_country_code,
    p.nationality_code,
    p.interests,
    p.gender,
    p.updated_at
  FROM public.profiles p
  WHERE
    p.location = city_name
    AND (country_name IS NULL OR p.location_country = country_name)
    AND p.onboarding_completed = true
    AND p.id != auth.uid()
  ORDER BY p.updated_at DESC NULLS LAST
  LIMIT 200;
$$;

DROP FUNCTION IF EXISTS public.get_nearby_city_users(text, text);
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
  location_country_code text,
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
    p.location_country_code,
    p.nationality_code,
    p.interests,
    p.gender
  FROM public.profiles p
  WHERE
    p.location_country = user_country
    AND p.location != user_city
    AND p.onboarding_completed = true
    AND p.id != auth.uid()
  ORDER BY p.updated_at DESC NULLS LAST
  LIMIT 100;
$$;

GRANT EXECUTE ON FUNCTION public.get_users_in_city(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_nearby_city_users(text, text) TO authenticated;
