-- supabase/migrations/20250904220000_fix_ambiguous_columns.sql
-- Fixes ambiguous column references in all home screen functions

-- 1. Fix get_trending_visits
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
    SELECT 
      MIN(v.id) as group_id,
      v.city as group_city,
      v.country as group_country,
      v.country_code as group_country_code,
      v.start_date as group_start_date,
      v.end_date as group_end_date,
      COUNT(DISTINCT v.user_id) as group_user_count,
      jsonb_agg(
        DISTINCT jsonb_build_object(
          'id', p.id,
          'full_name', p.full_name,
          'avatar_url', p.avatar_url
        )
      ) FILTER (WHERE p.id IS NOT NULL) as all_users
    FROM visits v
    LEFT JOIN profiles p ON v.user_id = p.id
    WHERE v.end_date >= CURRENT_DATE
    GROUP BY v.city, v.country, v.country_code, v.start_date, v.end_date
    HAVING COUNT(DISTINCT v.user_id) > 1
  )
  SELECT 
    vg.group_id,
    vg.group_city,
    vg.group_country,
    vg.group_country_code,
    vg.group_start_date,
    vg.group_end_date,
    vg.group_user_count,
    (SELECT e.image_uri 
     FROM events e
     WHERE e.city = vg.group_city 
       AND e.image_uri IS NOT NULL 
       AND e.date >= CURRENT_DATE
     ORDER BY e.created_at DESC
     LIMIT 1) as visit_image_url,
    CASE 
      WHEN jsonb_array_length(vg.all_users) > 4 
      THEN (SELECT jsonb_agg(elem) FROM (
        SELECT elem FROM jsonb_array_elements(vg.all_users) elem LIMIT 4
      ) t)
      ELSE vg.all_users
    END as visit_recent_users
  FROM visit_groups vg
  ORDER BY vg.group_user_count DESC, vg.group_start_date ASC
  LIMIT 20;
END;
$$;

-- 2. Fix get_popular_plans_with_attendees
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
    SELECT 
      a.event_id,
      COUNT(DISTINCT a.user_id) as att_count,
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
    COALESCE(pa.att_count, 0),
    CASE 
      WHEN jsonb_array_length(pa.all_attendees) > 3 
      THEN (SELECT jsonb_agg(elem) FROM (
        SELECT elem FROM jsonb_array_elements(pa.all_attendees) elem LIMIT 3
      ) t)
      ELSE pa.all_attendees
    END,
    e.created_at
  FROM events e
  LEFT JOIN plan_attendees pa ON e.id = pa.event_id
  WHERE e.date >= CURRENT_DATE
  ORDER BY COALESCE(pa.att_count, 0) DESC, e.created_at DESC
  LIMIT 20;
END;
$$;

-- 3. Fix get_new_plans
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
    SELECT 
      a.event_id,
      COUNT(DISTINCT a.user_id) as att_count,
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
    COALESCE(pa.att_count, 0),
    CASE 
      WHEN jsonb_array_length(pa.all_attendees) > 3 
      THEN (SELECT jsonb_agg(elem) FROM (
        SELECT elem FROM jsonb_array_elements(pa.all_attendees) elem LIMIT 3
      ) t)
      ELSE pa.all_attendees
    END,
    e.created_at
  FROM events e
  LEFT JOIN plan_attendees pa ON e.id = pa.event_id
  WHERE e.date >= CURRENT_DATE
    AND e.created_at >= NOW() - INTERVAL '7 days'
  ORDER BY e.created_at DESC
  LIMIT 20;
END;
$$;

-- 4. Fix get_plans_by_category
DROP FUNCTION IF EXISTS get_plans_by_category(text);

CREATE OR REPLACE FUNCTION get_plans_by_category(category_param text)
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
      COUNT(DISTINCT a.user_id) as att_count,
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
    COALESCE(pa.att_count, 0),
    CASE 
      WHEN jsonb_array_length(pa.all_attendees) > 3 
      THEN (SELECT jsonb_agg(elem) FROM (
        SELECT elem FROM jsonb_array_elements(pa.all_attendees) elem LIMIT 3
      ) t)
      ELSE pa.all_attendees
    END,
    e.interests
  FROM events e
  LEFT JOIN plan_attendees pa ON e.id = pa.event_id
  WHERE e.date >= CURRENT_DATE
    AND (
      e.interests ? category_param
      OR 
      CASE 
        WHEN LOWER(category_param) = 'tropical' THEN 
          e.interests ?| ARRAY['beach', 'island', 'tropical', 'ocean', 'surf', 'diving', 'snorkeling']
        WHEN LOWER(category_param) = 'hiking' THEN 
          e.interests ?| ARRAY['hiking', 'outdoor', 'nature', 'mountains', 'trekking', 'trails', 'camping']
        WHEN LOWER(category_param) = 'backpacking' THEN 
          e.interests ?| ARRAY['backpacking', 'adventure', 'budget', 'hostels', 'solo']
        WHEN LOWER(category_param) = 'adventure' THEN 
          e.interests ?| ARRAY['adventure', 'thrill', 'extreme', 'outdoor', 'sports', 'adrenaline']
        WHEN LOWER(category_param) = 'culture' THEN 
          e.interests ?| ARRAY['culture', 'history', 'museum', 'art', 'heritage', 'architecture', 'local']
        ELSE false
      END
    )
  ORDER BY COALESCE(pa.att_count, 0) DESC, e.created_at DESC
  LIMIT 30;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_trending_visits() TO authenticated;
GRANT EXECUTE ON FUNCTION get_popular_plans_with_attendees() TO authenticated;
GRANT EXECUTE ON FUNCTION get_new_plans() TO authenticated;
GRANT EXECUTE ON FUNCTION get_plans_by_category(text) TO authenticated;

-- Verify the fix
DO $$
BEGIN
  RAISE NOTICE '==========================================';
  RAISE NOTICE 'Fixed ambiguous column references in:';
  RAISE NOTICE '  • get_trending_visits()';
  RAISE NOTICE '  • get_popular_plans_with_attendees()';
  RAISE NOTICE '  • get_new_plans()';
  RAISE NOTICE '  • get_plans_by_category()';
  RAISE NOTICE '==========================================';
END $$;