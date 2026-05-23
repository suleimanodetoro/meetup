-- Function to get the most active cities in the last 14 days
CREATE OR REPLACE FUNCTION get_trending_cities()
RETURNS TABLE(city TEXT, country TEXT, country_code TEXT, plan_count BIGINT, image_url TEXT)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        e.city,
        e.country,
        e.country_code,
        COUNT(e.id) as plan_count,
        -- Fetches the image of the most popular plan in that city to use as the city's cover
        (SELECT image_uri FROM events 
         WHERE city = e.city 
         ORDER BY (SELECT COUNT(*) FROM attendance WHERE event_id = events.id) DESC, created_at DESC
         LIMIT 1) as image_url
    FROM
        events e
    WHERE
        e.created_at >= NOW() - INTERVAL '14 days'
    GROUP BY
        e.city, e.country, e.country_code
    ORDER BY
        plan_count DESC
    LIMIT 10;
END;
$$;

-- Function to get the most popular plans based on attendee count
CREATE OR REPLACE FUNCTION get_popular_plans()
RETURNS SETOF events
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        e.*
    FROM
        events e
    ORDER BY
        -- COALESCE ensures that if an event has no attendees, its count is treated as 0
        (SELECT COALESCE(COUNT(*), 0) FROM attendance WHERE event_id = e.id) DESC,
        e.created_at DESC
    LIMIT 10;
END;
$$;
