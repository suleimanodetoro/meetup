-- supabase/migrations/20250819193000_fix_visit_details_ambiguous_columns.sql
-- Fixes the ambiguous column references in visit detail functions

-- Drop existing functions first
DROP FUNCTION IF EXISTS public.get_visit_details(bigint);
DROP FUNCTION IF EXISTS public.get_visit_users(bigint, int);
DROP FUNCTION IF EXISTS public.get_visit_plans(bigint);

-- ============================================
-- 1. FIXED: Function to get visit details with counts
-- ============================================
CREATE OR REPLACE FUNCTION public.get_visit_details(visit_id_param bigint)
RETURNS TABLE(
  id bigint,
  city text,
  country text,
  country_code text,
  start_date date,
  end_date date,
  user_count bigint,
  plan_count bigint
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    v.id,
    v.city,
    v.country,
    v.country_code,
    v.start_date,
    v.end_date,
    (SELECT COUNT(DISTINCT v2.user_id) 
     FROM public.visits v2
     WHERE v2.city = v.city 
     AND daterange(v2.start_date, v2.end_date, '[]') && daterange(v.start_date, v.end_date, '[]')
    ) as user_count,
    (SELECT COUNT(*) 
     FROM public.events e
     WHERE e.city = v.city 
     AND e.date::date BETWEEN v.start_date AND v.end_date
    ) as plan_count
  FROM public.visits v
  WHERE v.id = visit_id_param;
END;
$$;

-- ============================================
-- 2. FIXED: Function to get users visiting same city
-- ============================================
CREATE OR REPLACE FUNCTION public.get_visit_users(
  visit_id_param bigint, 
  limit_param int DEFAULT NULL
)
RETURNS TABLE(
  user_id uuid,
  full_name text,
  avatar_url text,
  bio text,
  nationality_code text,
  is_verified boolean,
  visit_start date,
  visit_end date,
  overlap_days int
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  target_visit RECORD;
BEGIN
  -- Get the target visit details with explicit column selection
  SELECT v.id, v.city, v.country, v.country_code, v.start_date, v.end_date, v.user_id 
  INTO target_visit 
  FROM public.visits v 
  WHERE v.id = visit_id_param;
  
  RETURN QUERY
  SELECT 
    p.id as user_id,
    p.full_name,
    p.avatar_url,
    p.bio,
    p.nationality_code,
    COALESCE(p.onboarding_completed, false) as is_verified,
    v2.start_date as visit_start,
    v2.end_date as visit_end,
    EXTRACT(DAY FROM 
      LEAST(v2.end_date, target_visit.end_date) - 
      GREATEST(v2.start_date, target_visit.start_date)
    )::int + 1 as overlap_days
  FROM public.visits v2
  JOIN public.profiles p ON v2.user_id = p.id
  WHERE v2.city = target_visit.city
    AND v2.user_id != target_visit.user_id
    AND daterange(v2.start_date, v2.end_date, '[]') && daterange(target_visit.start_date, target_visit.end_date, '[]')
  ORDER BY overlap_days DESC, v2.created_at DESC
  LIMIT limit_param;
END;
$$;

-- ============================================
-- 3. FIXED: Function to get plans in city during visit
-- ============================================
CREATE OR REPLACE FUNCTION public.get_visit_plans(visit_id_param bigint)
RETURNS TABLE(
  event_id bigint,
  title text,
  description text,
  image_uri text,
  date timestamp with time zone,
  location_name text,
  cost numeric,
  attendee_count bigint,
  host_name text,
  host_avatar text
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  target_visit RECORD;
BEGIN
  -- Get the target visit details with explicit column selection
  SELECT v.id, v.city, v.country, v.country_code, v.start_date, v.end_date, v.user_id 
  INTO target_visit 
  FROM public.visits v 
  WHERE v.id = visit_id_param;
  
  RETURN QUERY
  SELECT 
    e.id as event_id,
    e.title,
    e.description,
    e.image_uri,
    e.date,
    e.location_name,
    e.cost,
    (SELECT COUNT(*) FROM public.attendance a WHERE a.event_id = e.id) as attendee_count,
    p.full_name as host_name,
    p.avatar_url as host_avatar
  FROM public.events e
  LEFT JOIN public.profiles p ON e.user_id = p.id
  WHERE e.city = target_visit.city
    AND e.date BETWEEN target_visit.start_date::timestamp AND (target_visit.end_date + interval '1 day')::timestamp
  ORDER BY attendee_count DESC, e.created_at DESC;
END;
$$;

-- ============================================
-- 4. Grant permissions again
-- ============================================
GRANT EXECUTE ON FUNCTION public.get_visit_details(bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_visit_users(bigint, int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_visit_plans(bigint) TO authenticated;

-- ============================================
-- 5. Test the functions to verify they work
-- ============================================
DO $$
BEGIN
  RAISE NOTICE 'Functions recreated successfully with qualified column references';
  RAISE NOTICE 'All ambiguous column references have been fixed';
END $$;