-- supabase/migrations/20250904_fix_trending_visits.sql
-- Fixes the get_trending_visits function to remove p.created_at reference

DROP FUNCTION IF EXISTS get_trending_visits();

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

-- Also fix the other functions that might have similar issues
DROP FUNCTION IF EXISTS get_popular_plans_with_attendees();

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

DROP FUNCTION IF EXISTS get_new_plans();

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

DROP FUNCTION IF EXISTS get_plans_by_category(text);

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

-- Grant permissions again
GRANT EXECUTE ON FUNCTION get_trending_visits() TO authenticated;
GRANT EXECUTE ON FUNCTION get_popular_plans_with_attendees() TO authenticated;
GRANT EXECUTE ON FUNCTION get_new_plans() TO authenticated;
GRANT EXECUTE ON FUNCTION get_plans_by_category(text) TO authenticated;

DO $$
BEGIN
  RAISE NOTICE 'Fixed functions to remove p.created_at references';
END $$;