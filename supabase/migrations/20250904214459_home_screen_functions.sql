-- supabase/migrations/20250904_home_screen_functions.sql
-- =====================================================
-- NEW FUNCTIONS FOR HOME SCREEN REDESIGN
-- =====================================================
-- This migration adds NEW functions for the home screen.
-- It does NOT modify or replace existing functions.
-- 
-- Existing functions that remain unchanged:
-- - get_trending_cities() 
-- - get_popular_plans()
--
-- New functions being added:
-- - get_trending_visits() - Groups visits by destination
-- - get_popular_plans_with_attendees() - Enhanced version with counts
-- - get_new_plans() - Recent plans from last 7 days
-- - get_suggested_users() - User recommendations
-- - get_plans_by_category() - Category filtering
-- =====================================================

-- =====================================================
-- 1. NEW FUNCTION: Get Trending Visits (Trips)
-- Groups visits by city and date range, counts users
-- Returns visits with 2+ users going to same place
-- =====================================================
CREATE OR REPLACE FUNCTION get_trending_visits()
RETURNS TABLE(
  id bigint,
  city text,
  country text,
  country_code text,
  start_date date,
  end_date date,
  user_count bigint,
  image_url text,
  recent_users jsonb
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH visit_groups AS (
    -- Group visits by destination and overlapping dates
    SELECT 
      MIN(v.id) as id,
      v.city,
      v.country,
      v.country_code,
      v.start_date,
      v.end_date,
      COUNT(DISTINCT v.user_id) as user_count,
      -- Collect user info for avatar display (max 4 for UI)
      jsonb_agg(
        DISTINCT jsonb_build_object(
          'id', p.id,
          'full_name', p.full_name,
          'avatar_url', p.avatar_url
        )
        ORDER BY p.created_at DESC
      ) FILTER (WHERE p.id IS NOT NULL) as all_users
    FROM visits v
    LEFT JOIN profiles p ON v.user_id = p.id
    WHERE v.end_date >= CURRENT_DATE -- Only future/ongoing trips
    GROUP BY v.city, v.country, v.country_code, v.start_date, v.end_date
    HAVING COUNT(DISTINCT v.user_id) > 1 -- Must have 2+ travelers
  )
  SELECT 
    vg.id,
    vg.city,
    vg.country,
    vg.country_code,
    vg.start_date,
    vg.end_date,
    vg.user_count,
    -- Try to get an image from events in that city
    -- Frontend will use gradient if null
    (SELECT image_uri 
     FROM events 
     WHERE city = vg.city 
       AND image_uri IS NOT NULL 
       AND date >= CURRENT_DATE
     ORDER BY created_at DESC
     LIMIT 1) as image_url,
    -- Limit to 4 users for display
    CASE 
      WHEN jsonb_array_length(vg.all_users) > 4 
      THEN (SELECT jsonb_agg(elem) FROM (
        SELECT elem FROM jsonb_array_elements(vg.all_users) elem LIMIT 4
      ) t)
      ELSE vg.all_users
    END as recent_users
  FROM visit_groups vg
  ORDER BY vg.user_count DESC, vg.start_date ASC
  LIMIT 20; -- Return more than needed, frontend will slice
END;
$$;

-- =====================================================
-- 2. NEW FUNCTION: Get Popular Plans with Attendees
-- Enhanced version that includes attendee count/info
-- Replaces multiple N+1 queries with single call
-- =====================================================
CREATE OR REPLACE FUNCTION get_popular_plans_with_attendees()
RETURNS TABLE(
  id bigint,
  title text,
  description text,
  date timestamp with time zone,
  end_date timestamp with time zone,
  city text,
  country text,
  country_code text,
  location_name text,
  image_uri text,
  cost numeric,
  cost_currency text,
  interests jsonb,
  user_id uuid,
  attendee_count bigint,
  recent_attendees jsonb,
  created_at timestamp with time zone
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH plan_attendees AS (
    -- Pre-aggregate attendee data to avoid N+1
    SELECT 
      a.event_id,
      COUNT(DISTINCT a.user_id) as attendee_count,
      jsonb_agg(
        DISTINCT jsonb_build_object(
          'id', p.id,
          'full_name', p.full_name,
          'avatar_url', p.avatar_url
        )
        ORDER BY a.created_at DESC
      ) FILTER (WHERE p.id IS NOT NULL) as all_attendees
    FROM attendance a
    LEFT JOIN profiles p ON a.user_id = p.id
    GROUP BY a.event_id
  )
  SELECT 
    e.id,
    e.title,
    e.description,
    e.date,
    e.end_date,
    e.city,
    e.country,
    e.country_code,
    e.location_name,
    e.image_uri,
    e.cost,
    e.cost_currency,
    e.interests,
    e.user_id,
    COALESCE(pa.attendee_count, 0) as attendee_count,
    -- Limit to 3 attendees for avatar display
    CASE 
      WHEN jsonb_array_length(pa.all_attendees) > 3 
      THEN (SELECT jsonb_agg(elem) FROM (
        SELECT elem FROM jsonb_array_elements(pa.all_attendees) elem LIMIT 3
      ) t)
      ELSE pa.all_attendees
    END as recent_attendees,
    e.created_at
  FROM events e
  LEFT JOIN plan_attendees pa ON e.id = pa.event_id
  WHERE e.date >= CURRENT_DATE -- Only future events
  ORDER BY COALESCE(pa.attendee_count, 0) DESC, e.created_at DESC
  LIMIT 20;
END;
$$;

-- =====================================================
-- 3. NEW FUNCTION: Get New Plans (Recently Created)
-- Plans created in the last 7 days
-- =====================================================
CREATE OR REPLACE FUNCTION get_new_plans()
RETURNS TABLE(
  id bigint,
  title text,
  description text,
  date timestamp with time zone,
  end_date timestamp with time zone,
  city text,
  country text,
  country_code text,
  location_name text,
  image_uri text,
  cost numeric,
  cost_currency text,
  interests jsonb,
  user_id uuid,
  attendee_count bigint,
  recent_attendees jsonb,
  created_at timestamp with time zone
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH plan_attendees AS (
    -- Pre-aggregate to avoid N+1
    SELECT 
      a.event_id,
      COUNT(DISTINCT a.user_id) as attendee_count,
      jsonb_agg(
        DISTINCT jsonb_build_object(
          'id', p.id,
          'full_name', p.full_name,
          'avatar_url', p.avatar_url
        )
        ORDER BY a.created_at DESC
      ) FILTER (WHERE p.id IS NOT NULL) as all_attendees
    FROM attendance a
    LEFT JOIN profiles p ON a.user_id = p.id
    GROUP BY a.event_id
  )
  SELECT 
    e.id,
    e.title,
    e.description,
    e.date,
    e.end_date,
    e.city,
    e.country,
    e.country_code,
    e.location_name,
    e.image_uri,
    e.cost,
    e.cost_currency,
    e.interests,
    e.user_id,
    COALESCE(pa.attendee_count, 0) as attendee_count,
    CASE 
      WHEN jsonb_array_length(pa.all_attendees) > 3 
      THEN (SELECT jsonb_agg(elem) FROM (
        SELECT elem FROM jsonb_array_elements(pa.all_attendees) elem LIMIT 3
      ) t)
      ELSE pa.all_attendees
    END as recent_attendees,
    e.created_at
  FROM events e
  LEFT JOIN plan_attendees pa ON e.id = pa.event_id
  WHERE e.date >= CURRENT_DATE
    AND e.created_at >= NOW() - INTERVAL '7 days'
  ORDER BY e.created_at DESC
  LIMIT 20;
END;
$$;

-- =====================================================
-- 4. NEW FUNCTION: Get Suggested Users
-- Smart recommendations based on interests & destinations
-- =====================================================
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
      -- Calculate interest overlap
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
    -- Weight cities higher than interests
    su.interest_score + (COALESCE(array_length(su.common_cities, 1), 0) * 2) as similarity_score,
    su.common_interests,
    su.common_cities
  FROM scored_users su
  WHERE su.interest_score > 0 
     OR COALESCE(array_length(su.common_cities, 1), 0) > 0
  ORDER BY similarity_score DESC, su.interest_score DESC
  LIMIT 20;
END;
$$;

-- =====================================================
-- 5. NEW FUNCTION: Get Plans by Category
-- For category pill filtering
-- =====================================================
CREATE OR REPLACE FUNCTION get_plans_by_category(category text)
RETURNS TABLE(
  id bigint,
  title text,
  description text,
  date timestamp with time zone,
  city text,
  country text,
  country_code text,
  image_uri text,
  attendee_count bigint,
  recent_attendees jsonb,
  interests jsonb
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH plan_attendees AS (
    SELECT 
      a.event_id,
      COUNT(DISTINCT a.user_id) as attendee_count,
      jsonb_agg(
        DISTINCT jsonb_build_object(
          'id', p.id,
          'full_name', p.full_name,
          'avatar_url', p.avatar_url
        )
        ORDER BY a.created_at DESC
      ) FILTER (WHERE p.id IS NOT NULL) as all_attendees
    FROM attendance a
    LEFT JOIN profiles p ON a.user_id = p.id
    GROUP BY a.event_id
  )
  SELECT 
    e.id,
    e.title,
    e.description,
    e.date,
    e.city,
    e.country,
    e.country_code,
    e.image_uri,
    COALESCE(pa.attendee_count, 0) as attendee_count,
    CASE 
      WHEN jsonb_array_length(pa.all_attendees) > 3 
      THEN (SELECT jsonb_agg(elem) FROM (
        SELECT elem FROM jsonb_array_elements(pa.all_attendees) elem LIMIT 3
      ) t)
      ELSE pa.all_attendees
    END as recent_attendees,
    e.interests
  FROM events e
  LEFT JOIN plan_attendees pa ON e.id = pa.event_id
  WHERE e.date >= CURRENT_DATE
    AND (
      -- Direct interest match
      e.interests ? category
      OR 
      -- Category mapping for common terms
      CASE 
        WHEN LOWER(category) = 'tropical' THEN 
          e.interests ?| ARRAY['beach', 'island', 'tropical', 'ocean', 'surf', 'diving', 'snorkeling']
        WHEN LOWER(category) = 'hiking' THEN 
          e.interests ?| ARRAY['hiking', 'outdoor', 'nature', 'mountains', 'trekking', 'trails', 'camping']
        WHEN LOWER(category) = 'backpacking' THEN 
          e.interests ?| ARRAY['backpacking', 'adventure', 'budget', 'hostels', 'solo']
        WHEN LOWER(category) = 'adventure' THEN 
          e.interests ?| ARRAY['adventure', 'thrill', 'extreme', 'outdoor', 'sports', 'adrenaline']
        WHEN LOWER(category) = 'culture' THEN 
          e.interests ?| ARRAY['culture', 'history', 'museum', 'art', 'heritage', 'architecture', 'local']
        ELSE false
      END
    )
  ORDER BY COALESCE(pa.attendee_count, 0) DESC, e.created_at DESC
  LIMIT 30;
END;
$$;

-- =====================================================
-- 6. Add location field to profiles if missing
-- Used for "People You May Like" location display
-- =====================================================
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS location text;

COMMENT ON COLUMN public.profiles.location IS 'User current location for display in suggestions';

-- =====================================================
-- 7. Grant permissions for new functions
-- =====================================================
GRANT EXECUTE ON FUNCTION get_trending_visits() TO authenticated;
GRANT EXECUTE ON FUNCTION get_popular_plans_with_attendees() TO authenticated;
GRANT EXECUTE ON FUNCTION get_new_plans() TO authenticated;
GRANT EXECUTE ON FUNCTION get_suggested_users(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_plans_by_category(text) TO authenticated;

-- =====================================================
-- 8. Create indexes for performance optimization
-- These improve query speed for the new functions
-- =====================================================
-- Regular indexes without CURRENT_DATE in WHERE clause
CREATE INDEX IF NOT EXISTS idx_visits_end_date 
  ON public.visits(end_date DESC);

CREATE INDEX IF NOT EXISTS idx_visits_city_dates 
  ON public.visits(city, start_date, end_date);

CREATE INDEX IF NOT EXISTS idx_events_date 
  ON public.events(date DESC);

CREATE INDEX IF NOT EXISTS idx_events_created_recent 
  ON public.events(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_events_interests 
  ON public.events USING gin(interests);

CREATE INDEX IF NOT EXISTS idx_profiles_interests 
  ON public.profiles USING gin(interests)
  WHERE onboarding_completed = true;

CREATE INDEX IF NOT EXISTS idx_attendance_event_user 
  ON public.attendance(event_id, user_id);

-- =====================================================
-- 9. Verification
-- =====================================================
DO $$
BEGIN
  RAISE NOTICE '==========================================';
  RAISE NOTICE 'Home Screen Migration Complete';
  RAISE NOTICE '==========================================';
  RAISE NOTICE 'New functions added:';
  RAISE NOTICE '  • get_trending_visits()';
  RAISE NOTICE '  • get_popular_plans_with_attendees()';
  RAISE NOTICE '  • get_new_plans()';
  RAISE NOTICE '  • get_suggested_users()';
  RAISE NOTICE '  • get_plans_by_category()';
  RAISE NOTICE '';
  RAISE NOTICE 'Existing functions unchanged:';
  RAISE NOTICE '  • get_trending_cities()';
  RAISE NOTICE '  • get_popular_plans()';
  RAISE NOTICE '==========================================';
END $$;