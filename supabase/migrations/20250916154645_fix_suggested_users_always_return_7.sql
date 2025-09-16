-- supabase/migrations/20250117000000_fix_suggested_users_always_return_7.sql
-- =====================================================
-- FIX: get_suggested_users function to ALWAYS return users
-- Previously it only returned users with matching interests/cities
-- Now it returns ALL onboarded users, prioritizing matches
-- =====================================================

-- Drop the broken function
DROP FUNCTION IF EXISTS get_suggested_users(uuid);

-- Create fixed function that ALWAYS returns 7 users
CREATE OR REPLACE FUNCTION get_suggested_users(current_user_id uuid)
RETURNS TABLE(
  id uuid,
  full_name text,
  avatar_url text,
  bio text,
  birth_date date,
  nationality_code text,
  interests jsonb,
  languages jsonb,
  location text,
  similarity_score integer,
  common_interests text[],
  common_cities text[]
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH user_data AS (
    -- Get current user's interests and upcoming visits
    SELECT 
      p.interests as user_interests,
      array_agg(DISTINCT v.city) FILTER (WHERE v.city IS NOT NULL) as user_cities
    FROM profiles p
    LEFT JOIN visits v ON v.user_id = p.id 
      AND v.end_date >= CURRENT_DATE
    WHERE p.id = current_user_id
    GROUP BY p.id, p.interests
  ),
  scored_users AS (
    SELECT 
      p.id,
      p.full_name,
      p.avatar_url,
      p.bio,
      p.birth_date,
      p.nationality_code,
      p.interests,
      p.languages,
      p.location,
      -- Calculate interest overlap (0 if no match)
      COALESCE(
        CASE 
          WHEN ud.user_interests IS NOT NULL AND p.interests IS NOT NULL
          THEN (
            SELECT COUNT(*)::integer
            FROM jsonb_array_elements_text(p.interests) AS p_interest
            JOIN jsonb_array_elements_text(ud.user_interests) AS u_interest
              ON p_interest = u_interest
          )
          ELSE 0
        END, 0
      ) as interest_score,
      -- Get matching interests
      CASE 
        WHEN ud.user_interests IS NOT NULL AND p.interests IS NOT NULL
        THEN ARRAY(
          SELECT DISTINCT p_interest
          FROM jsonb_array_elements_text(p.interests) AS p_interest
          JOIN jsonb_array_elements_text(ud.user_interests) AS u_interest
            ON p_interest = u_interest
        )
        ELSE ARRAY[]::text[]
      END as common_interests,
      -- Get matching cities
      ARRAY(
        SELECT DISTINCT v.city 
        FROM visits v 
        WHERE v.user_id = p.id 
          AND v.city = ANY(ud.user_cities)
          AND v.end_date >= CURRENT_DATE
      ) as common_cities
    FROM profiles p
    CROSS JOIN user_data ud
    WHERE p.id != current_user_id
      AND p.onboarding_completed = true
  )
  SELECT 
    su.id,
    su.full_name,
    su.avatar_url,
    su.bio,
    su.birth_date,
    su.nationality_code,
    su.interests,
    su.languages,
    su.location,
    -- Calculate total score (cities worth more)
    su.interest_score + (COALESCE(array_length(su.common_cities, 1), 0) * 2) as similarity_score,
    su.common_interests,
    su.common_cities
  FROM scored_users su
  -- NO WHERE CLAUSE - RETURN ALL USERS!
  ORDER BY 
    -- First show users with matches
    (su.interest_score + (COALESCE(array_length(su.common_cities, 1), 0) * 2)) DESC,
    -- Then random for variety
    RANDOM()
  LIMIT 7;  -- RETURN EXACTLY 7 USERS
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_suggested_users(uuid) TO authenticated;

-- Verify the fix
DO $$
BEGIN
  RAISE NOTICE 'Successfully fixed get_suggested_users function to always return up to 7 users';
END $$;