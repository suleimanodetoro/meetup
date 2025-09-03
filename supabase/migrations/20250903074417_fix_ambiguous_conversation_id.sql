--20250903074417_fix_ambiguous_conversation_id.sql
-- Fix the ambiguous conversation_id reference in get_user_conversations function

DROP FUNCTION IF EXISTS get_user_conversations(uuid);

CREATE OR REPLACE FUNCTION get_user_conversations(
  p_user_id uuid
)
RETURNS TABLE(
  conversation_id bigint,
  conversation_type text,
  conversation_name text,
  avatar_url text,
  last_message_content text,
  last_message_at timestamp with time zone,
  last_message_user_name text,
  unread_count bigint,
  participant_count bigint,
  event_id bigint,
  event_country_code text
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH user_conversations AS (
    SELECT 
      c.*,
      cp.last_read_at,
      cp.is_muted
    FROM conversations c
    JOIN conversation_participants cp ON c.id = cp.conversation_id
    WHERE cp.user_id = p_user_id
  ),
  conversation_messages AS (
    SELECT DISTINCT ON (m.conversation_id)
      m.conversation_id,
      m.content,
      m.created_at,
      p.full_name as sender_name
    FROM messages m
    JOIN profiles p ON m.user_id = p.id
    WHERE m.is_deleted = false OR m.is_deleted IS NULL
    ORDER BY m.conversation_id, m.created_at DESC
  ),
  unread_counts AS (
    SELECT 
      uc.id as conversation_id,
      COUNT(m.id) as unread_count
    FROM user_conversations uc
    LEFT JOIN messages m ON m.conversation_id = uc.id
    WHERE m.created_at > COALESCE(uc.last_read_at, '1970-01-01'::timestamp)
    AND (m.is_deleted = false OR m.is_deleted IS NULL)
    AND m.user_id != p_user_id
    GROUP BY uc.id
  ),
  participant_counts AS (
    SELECT 
      cp.conversation_id as conversation_id,  -- FIX: Qualify with table alias
      COUNT(*) as participant_count
    FROM conversation_participants cp  -- FIX: Add alias
    GROUP BY cp.conversation_id  -- FIX: Use qualified name
  )
  SELECT 
    uc.id as conversation_id,
    uc.type as conversation_type,
    CASE 
      WHEN uc.type = 'dm' THEN (
        SELECT p.full_name 
        FROM conversation_participants cp2
        JOIN profiles p ON cp2.user_id = p.id
        WHERE cp2.conversation_id = uc.id 
        AND cp2.user_id != p_user_id
        LIMIT 1
      )
      ELSE uc.name
    END as conversation_name,
    CASE 
      WHEN uc.type = 'dm' THEN (
        SELECT p.avatar_url 
        FROM conversation_participants cp2
        JOIN profiles p ON cp2.user_id = p.id
        WHERE cp2.conversation_id = uc.id 
        AND cp2.user_id != p_user_id
        LIMIT 1
      )
      ELSE uc.avatar_url
    END as avatar_url,
    cm.content as last_message_content,
    cm.created_at as last_message_at,
    cm.sender_name as last_message_user_name,
    COALESCE(urc.unread_count, 0) as unread_count,
    pc.participant_count,
    uc.event_id,
    e.country_code as event_country_code
  FROM user_conversations uc
  LEFT JOIN conversation_messages cm ON cm.conversation_id = uc.id
  LEFT JOIN unread_counts urc ON urc.conversation_id = uc.id
  LEFT JOIN participant_counts pc ON pc.conversation_id = uc.id
  LEFT JOIN events e ON uc.event_id = e.id
  ORDER BY COALESCE(cm.created_at, uc.created_at) DESC;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_user_conversations(uuid) TO authenticated;