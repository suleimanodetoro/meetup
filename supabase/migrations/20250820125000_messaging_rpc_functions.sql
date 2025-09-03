-- supabase/migrations/20250820125000_messaging_rpc_functions.sql
-- =====================================================
-- RPC FUNCTIONS FOR FRIEND SYSTEM & MESSAGING
-- =====================================================

-- 1. Get mutual friends between two users
CREATE OR REPLACE FUNCTION get_mutual_friends(
  user1_id uuid,
  user2_id uuid
)
RETURNS TABLE(
  id uuid,
  full_name text,
  username text,
  avatar_url text
) AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT p.id, p.full_name, p.username, p.avatar_url
  FROM profiles p
  WHERE p.id IN (
    -- Friends of user1
    SELECT CASE 
      WHEN f1.requester_id = user1_id THEN f1.addressee_id
      ELSE f1.requester_id
    END
    FROM friendships f1
    WHERE (f1.requester_id = user1_id OR f1.addressee_id = user1_id)
    AND f1.status = 'accepted'
  )
  AND p.id IN (
    -- Friends of user2
    SELECT CASE 
      WHEN f2.requester_id = user2_id THEN f2.addressee_id
      ELSE f2.requester_id
    END
    FROM friendships f2
    WHERE (f2.requester_id = user2_id OR f2.addressee_id = user2_id)
    AND f2.status = 'accepted'
  )
  AND p.id NOT IN (user1_id, user2_id);
END;
$$ LANGUAGE plpgsql;

-- 2. Check friendship status between two users
CREATE OR REPLACE FUNCTION get_friendship_status(
  user1_id uuid,
  user2_id uuid
)
RETURNS TABLE(
  status text,
  is_requester boolean
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    f.status,
    (f.requester_id = user1_id) as is_requester
  FROM friendships f
  WHERE (
    (f.requester_id = user1_id AND f.addressee_id = user2_id) OR
    (f.requester_id = user2_id AND f.addressee_id = user1_id)
  )
  LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- 3. Get conversation list with details for a user
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
) AS $$
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
    WHERE m.is_deleted = false
    ORDER BY m.conversation_id, m.created_at DESC
  ),
  unread_counts AS (
    SELECT 
      uc.id as conversation_id,
      COUNT(m.id) as unread_count
    FROM user_conversations uc
    LEFT JOIN messages m ON m.conversation_id = uc.id
    WHERE m.created_at > COALESCE(uc.last_read_at, '1970-01-01'::timestamp)
    AND m.is_deleted = false
    AND m.user_id != p_user_id
    GROUP BY uc.id
  ),
  participant_counts AS (
    SELECT 
      conversation_id,
      COUNT(*) as participant_count
    FROM conversation_participants
    GROUP BY conversation_id
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
$$ LANGUAGE plpgsql;

-- 4. Get or create a DM conversation between two users (enhanced)
CREATE OR REPLACE FUNCTION get_or_create_dm_conversation_enhanced(
  sender_id uuid,
  recipient_id uuid
)
RETURNS TABLE(
  conversation_id bigint,
  is_new boolean,
  can_message boolean,
  block_reason text
) AS $$
DECLARE
  conv_id bigint;
  can_msg boolean;
  block_msg text;
  is_new_conv boolean := false;
BEGIN
  -- Check if users can message each other
  SELECT * INTO can_msg FROM can_users_message(sender_id, recipient_id);
  
  IF NOT can_msg THEN
    -- Determine why they can't message
    IF EXISTS (
      SELECT 1 FROM blocked_users 
      WHERE (blocker_id = recipient_id AND blocked_id = sender_id)
      OR (blocker_id = sender_id AND blocked_id = recipient_id)
    ) THEN
      block_msg := 'blocked';
    ELSE
      SELECT message_privacy INTO block_msg
      FROM user_privacy_settings
      WHERE user_id = recipient_id;
      
      IF block_msg = 'friends_only' THEN
        block_msg := 'Add as friend to message';
      ELSIF block_msg = 'nobody' THEN
        block_msg := 'User has disabled messaging';
      END IF;
    END IF;
    
    RETURN QUERY SELECT NULL::bigint, false, false, block_msg;
    RETURN;
  END IF;
  
  -- Check if DM conversation already exists
  SELECT c.id INTO conv_id
  FROM conversations c
  WHERE c.type = 'dm'
  AND EXISTS (
    SELECT 1 FROM conversation_participants 
    WHERE conversation_id = c.id AND user_id = sender_id
  )
  AND EXISTS (
    SELECT 1 FROM conversation_participants 
    WHERE conversation_id = c.id AND user_id = recipient_id
  );
  
  -- If not, create new DM conversation
  IF conv_id IS NULL THEN
    INSERT INTO conversations (type) 
    VALUES ('dm') 
    RETURNING id INTO conv_id;
    
    -- Add both participants
    INSERT INTO conversation_participants (conversation_id, user_id)
    VALUES 
      (conv_id, sender_id), 
      (conv_id, recipient_id);
    
    is_new_conv := true;
  END IF;
  
  RETURN QUERY SELECT conv_id, is_new_conv, true, NULL::text;
END;
$$ LANGUAGE plpgsql;

-- 5. Search for users to add as friends
CREATE OR REPLACE FUNCTION search_users_for_friends(
  searcher_id uuid,
  search_term text,
  limit_count integer DEFAULT 20
)
RETURNS TABLE(
  id uuid,
  full_name text,
  username text,
  avatar_url text,
  bio text,
  friendship_status text,
  mutual_friends_count bigint,
  mutual_plans_count bigint
) AS $$
BEGIN
  RETURN QUERY
  WITH friendship_statuses AS (
    SELECT 
      CASE 
        WHEN requester_id = searcher_id THEN addressee_id
        ELSE requester_id
      END as friend_id,
      status
    FROM friendships
    WHERE requester_id = searcher_id OR addressee_id = searcher_id
  ),
  mutual_friends_counts AS (
    SELECT 
      p.id as user_id,
      COUNT(DISTINCT mf.id) as mutual_count
    FROM profiles p
    CROSS JOIN LATERAL get_mutual_friends(searcher_id, p.id) mf
    GROUP BY p.id
  ),
  mutual_plans_counts AS (
    SELECT 
      a2.user_id,
      COUNT(DISTINCT a1.event_id) as mutual_count
    FROM attendance a1
    JOIN attendance a2 ON a1.event_id = a2.event_id
    WHERE a1.user_id = searcher_id
    AND a2.user_id != searcher_id
    GROUP BY a2.user_id
  )
  SELECT 
    p.id,
    p.full_name,
    p.username,
    p.avatar_url,
    p.bio,
    fs.status as friendship_status,
    COALESCE(mfc.mutual_count, 0) as mutual_friends_count,
    COALESCE(mpc.mutual_count, 0) as mutual_plans_count
  FROM profiles p
  LEFT JOIN friendship_statuses fs ON fs.friend_id = p.id
  LEFT JOIN mutual_friends_counts mfc ON mfc.user_id = p.id
  LEFT JOIN mutual_plans_counts mpc ON mpc.user_id = p.id
  WHERE p.id != searcher_id
  AND (
    LOWER(p.full_name) LIKE LOWER('%' || search_term || '%')
    OR LOWER(p.username) LIKE LOWER('%' || search_term || '%')
  )
  ORDER BY 
    -- Prioritize mutual connections
    COALESCE(mfc.mutual_count, 0) + COALESCE(mpc.mutual_count, 0) DESC,
    -- Then by name match
    CASE 
      WHEN LOWER(p.full_name) LIKE LOWER(search_term || '%') THEN 1
      WHEN LOWER(p.username) LIKE LOWER(search_term || '%') THEN 2
      ELSE 3
    END
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;

-- 6. Get chat statistics for a user
CREATE OR REPLACE FUNCTION get_user_chat_stats(
  p_user_id uuid
)
RETURNS TABLE(
  total_conversations bigint,
  dm_conversations bigint,
  group_conversations bigint,
  total_messages_sent bigint,
  total_friends bigint,
  pending_requests bigint
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    (SELECT COUNT(*) FROM conversation_participants WHERE user_id = p_user_id),
    (SELECT COUNT(*) 
     FROM conversation_participants cp 
     JOIN conversations c ON cp.conversation_id = c.id 
     WHERE cp.user_id = p_user_id AND c.type = 'dm'),
    (SELECT COUNT(*) 
     FROM conversation_participants cp 
     JOIN conversations c ON cp.conversation_id = c.id 
     WHERE cp.user_id = p_user_id AND c.type = 'group'),
    (SELECT COUNT(*) FROM messages WHERE user_id = p_user_id AND is_deleted = false),
    (SELECT COUNT(*) 
     FROM friendships 
     WHERE (requester_id = p_user_id OR addressee_id = p_user_id) 
     AND status = 'accepted'),
    (SELECT COUNT(*) 
     FROM friendships 
     WHERE addressee_id = p_user_id 
     AND status = 'pending');
END;
$$ LANGUAGE plpgsql;

-- 7. Mark all messages as read in a conversation
CREATE OR REPLACE FUNCTION mark_conversation_as_read(
  p_conversation_id bigint,
  p_user_id uuid
)
RETURNS void AS $$
BEGIN
  -- Update last read timestamp
  UPDATE conversation_participants
  SET last_read_at = now()
  WHERE conversation_id = p_conversation_id
  AND user_id = p_user_id;
  
  -- Insert read receipts for unread messages
  INSERT INTO message_read_receipts (message_id, user_id)
  SELECT m.id, p_user_id
  FROM messages m
  WHERE m.conversation_id = p_conversation_id
  AND m.user_id != p_user_id
  AND NOT EXISTS (
    SELECT 1 FROM message_read_receipts mr
    WHERE mr.message_id = m.id AND mr.user_id = p_user_id
  );
END;
$$ LANGUAGE plpgsql;

-- 8. Cleanup old typing indicators (to be run periodically)
CREATE OR REPLACE FUNCTION cleanup_old_typing_indicators()
RETURNS void AS $$
BEGIN
  DELETE FROM typing_indicators
  WHERE started_at < now() - interval '30 seconds';
END;
$$ LANGUAGE plpgsql;