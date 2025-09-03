-- supabase/migrations/20250829202448_fix_messaging_system_complete.sql
-- =====================================================
-- COMPREHENSIVE FIX FOR MESSAGING SYSTEM (WORKING VERSION)
-- =====================================================

-- 0) Safety: Ensure participants uniqueness so ON CONFLICT works
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'conversation_participants_conversation_id_user_id_key'
  ) THEN
    ALTER TABLE public.conversation_participants
      ADD CONSTRAINT conversation_participants_conversation_id_user_id_key
      UNIQUE (conversation_id, user_id);
  END IF;
END $$;

-- Create unique index for one group conversation per event
-- This wasn't being created properly before
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE schemaname = 'public' 
    AND tablename = 'conversations'
    AND indexname = 'one_group_convo_per_event'
  ) THEN
    CREATE UNIQUE INDEX one_group_convo_per_event
    ON public.conversations(event_id)
    WHERE type = 'group' AND event_id IS NOT NULL;
  END IF;
END $$;

-- 1) Drop existing problematic triggers and functions
DROP TRIGGER IF EXISTS on_event_created ON public.events;
DROP TRIGGER IF EXISTS on_attendance_created ON public.attendance;
DROP FUNCTION IF EXISTS public.create_event_conversation() CASCADE;
DROP FUNCTION IF EXISTS public.add_user_to_event_conversation() CASCADE;

-- 2) Function: create conversation when event is created
CREATE OR REPLACE FUNCTION public.create_event_conversation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $func$
DECLARE
  conv_id bigint;
  existing_conv_id bigint;
BEGIN
  -- Check if conversation already exists
  SELECT id INTO existing_conv_id
  FROM public.conversations
  WHERE event_id = NEW.id AND type = 'group'
  LIMIT 1;
  
  IF existing_conv_id IS NULL THEN
    -- Create new conversation
    INSERT INTO public.conversations (type, name, event_id, avatar_url, created_at)
    VALUES ('group', NEW.title, NEW.id, NEW.image_uri, now())
    RETURNING id INTO conv_id;
    
    RAISE NOTICE 'Created conversation % for event %', conv_id, NEW.id;
  ELSE
    -- Update existing conversation
    UPDATE public.conversations
    SET name = NEW.title, avatar_url = NEW.image_uri
    WHERE id = existing_conv_id;
    
    conv_id := existing_conv_id;
    RAISE NOTICE 'Updated existing conversation % for event %', conv_id, NEW.id;
  END IF;
  
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Failed to create conversation for event %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$func$;

-- 3) Function: add user to conversation when they join event
CREATE OR REPLACE FUNCTION public.add_user_to_event_conversation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $func$
DECLARE
  conv_id bigint;
BEGIN
  SELECT c.id INTO conv_id
  FROM public.conversations c
  WHERE c.event_id = NEW.event_id
  AND c.type = 'group'
  LIMIT 1;

  IF conv_id IS NOT NULL THEN
    INSERT INTO public.conversation_participants (conversation_id, user_id, joined_at)
    VALUES (conv_id, NEW.user_id, now())
    ON CONFLICT (conversation_id, user_id) DO NOTHING;

    RAISE NOTICE 'Added user % to conversation % for event %', NEW.user_id, conv_id, NEW.event_id;
  ELSE
    RAISE WARNING 'No conversation found for event %', NEW.event_id;
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Failed to add user % to event % conversation: %', NEW.user_id, NEW.event_id, SQLERRM;
  RETURN NEW;
END;
$func$;

-- 4) Recreate triggers
CREATE TRIGGER on_event_created
  AFTER INSERT ON public.events
  FOR EACH ROW
  EXECUTE FUNCTION public.create_event_conversation();

CREATE TRIGGER on_attendance_created
  AFTER INSERT ON public.attendance
  FOR EACH ROW
  EXECUTE FUNCTION public.add_user_to_event_conversation();

-- 5) Backfill missing conversations + participants (SAFE VERSION)
DO $$
DECLARE
  event_rec RECORD;
  conv_id bigint;
  attendee_rec RECORD;
  existing_conv_id bigint;
BEGIN
  FOR event_rec IN
    SELECT e.*
    FROM public.events e
    LEFT JOIN public.conversations c ON c.event_id = e.id AND c.type = 'group'
    WHERE c.id IS NULL
  LOOP
    -- Double-check conversation doesn't exist (defensive)
    SELECT id INTO existing_conv_id
    FROM public.conversations
    WHERE event_id = event_rec.id AND type = 'group'
    LIMIT 1;
    
    IF existing_conv_id IS NULL THEN
      -- Create new conversation
      INSERT INTO public.conversations (type, name, event_id, avatar_url, created_at)
      VALUES ('group', event_rec.title, event_rec.id, event_rec.image_uri, COALESCE(event_rec.created_at, now()))
      RETURNING id INTO conv_id;
      
      RAISE NOTICE 'Created missing conversation % for event %', conv_id, event_rec.id;
    ELSE
      conv_id := existing_conv_id;
      RAISE NOTICE 'Conversation already exists for event %', event_rec.id;
    END IF;

    -- Add attendees if we have a conversation
    IF conv_id IS NOT NULL THEN
      FOR attendee_rec IN
        SELECT a.user_id
        FROM public.attendance a
        WHERE a.event_id = event_rec.id
      LOOP
        INSERT INTO public.conversation_participants (conversation_id, user_id, joined_at)
        VALUES (conv_id, attendee_rec.user_id, now())
        ON CONFLICT (conversation_id, user_id) DO NOTHING;
      END LOOP;
    END IF;
  END LOOP;
END $$;

-- 6) RLS policies (idempotent)
DROP POLICY IF EXISTS "Users can create DM conversations" ON public.conversations;
DROP POLICY IF EXISTS "Service functions can manage conversations" ON public.conversations;
DROP POLICY IF EXISTS "System can create conversations" ON public.conversations;
DROP POLICY IF EXISTS "Users can view their conversations" ON public.conversations;

-- View conversations you participate in
CREATE POLICY "Users can view their conversations"
ON public.conversations
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.conversation_participants cp
    WHERE cp.conversation_id = conversations.id
      AND cp.user_id = auth.uid()
  )
);

-- Participants table policies
DROP POLICY IF EXISTS "Users can view participants of their conversations" ON public.conversation_participants;
DROP POLICY IF EXISTS "Users can view participants in their conversations" ON public.conversation_participants;
DROP POLICY IF EXISTS "System can add participants" ON public.conversation_participants;

-- View participants for conversations you're in
CREATE POLICY "Users can view participants in their conversations"
ON public.conversation_participants
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.conversation_participants cp2
    WHERE cp2.conversation_id = conversation_participants.conversation_id
      AND cp2.user_id = auth.uid()
  )
);

-- 7) Fix get_user_conversations function (with ambiguity fixes)
DROP FUNCTION IF EXISTS public.get_user_conversations(uuid);

CREATE OR REPLACE FUNCTION public.get_user_conversations(p_user_id uuid)
RETURNS TABLE(
  conversation_id bigint,
  conversation_type text,
  conversation_name text,
  avatar_url text,
  last_message_content text,
  last_message_at timestamptz,
  last_message_user_name text,
  unread_count bigint,
  participant_count bigint,
  event_id bigint,
  event_country_code text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $func$
BEGIN
  RETURN QUERY
  WITH user_conversations AS (
    SELECT c.*, cp.last_read_at, cp.is_muted
    FROM public.conversations c
    JOIN public.conversation_participants cp ON c.id = cp.conversation_id
    WHERE cp.user_id = p_user_id
  ),
  conversation_messages AS (
    SELECT DISTINCT ON (m.conversation_id)
      m.conversation_id,
      m.content,
      m.created_at,
      p.full_name AS sender_name
    FROM public.messages m
    JOIN public.profiles p ON m.user_id = p.id
    WHERE COALESCE(m.is_deleted, false) = false
    ORDER BY m.conversation_id, m.created_at DESC
  ),
  unread_counts AS (
    SELECT uc.id AS conv_id,
           COUNT(m.id) AS unread_count
    FROM user_conversations uc
    LEFT JOIN public.messages m
      ON m.conversation_id = uc.id
     AND COALESCE(m.is_deleted, false) = false
     AND m.user_id <> p_user_id
     AND m.created_at > COALESCE(uc.last_read_at, '1970-01-01'::timestamptz)
    GROUP BY uc.id
  ),
  participant_counts AS (
    SELECT cp.conversation_id AS conv_id,
           COUNT(*) AS participant_count
    FROM public.conversation_participants cp
    GROUP BY cp.conversation_id
  )
  SELECT
    uc.id,
    uc.type,
    CASE
      WHEN uc.type = 'dm' THEN (
        SELECT p.full_name
        FROM public.conversation_participants cp2
        JOIN public.profiles p ON cp2.user_id = p.id
        WHERE cp2.conversation_id = uc.id
          AND cp2.user_id <> p_user_id
        LIMIT 1
      )
      ELSE uc.name
    END,
    CASE
      WHEN uc.type = 'dm' THEN (
        SELECT p.avatar_url
        FROM public.conversation_participants cp2
        JOIN public.profiles p ON cp2.user_id = p.id
        WHERE cp2.conversation_id = uc.id
          AND cp2.user_id <> p_user_id
        LIMIT 1
      )
      ELSE uc.avatar_url
    END,
    cm.content,
    cm.created_at,
    cm.sender_name,
    COALESCE(urc.unread_count, 0),
    COALESCE(pc.participant_count, 0),
    uc.event_id,
    e.country_code
  FROM user_conversations uc
  LEFT JOIN conversation_messages cm ON cm.conversation_id = uc.id
  LEFT JOIN unread_counts urc ON urc.conv_id = uc.id
  LEFT JOIN participant_counts pc ON pc.conv_id = uc.id
  LEFT JOIN public.events e ON e.id = uc.event_id
  ORDER BY COALESCE(cm.created_at, uc.created_at) DESC;
END;
$func$;

-- 8) Grant permissions
GRANT EXECUTE ON FUNCTION public.create_event_conversation() TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_user_to_event_conversation() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_conversations(uuid) TO authenticated;

-- 9) Final verification
DO $$
DECLARE
  event_count int;
  group_conv_count int;
  events_without_conv int;
BEGIN
  SELECT COUNT(*) INTO event_count FROM public.events;
  SELECT COUNT(*) INTO group_conv_count FROM public.conversations WHERE type = 'group';
  
  SELECT COUNT(*) INTO events_without_conv
  FROM public.events e
  LEFT JOIN public.conversations c ON c.event_id = e.id AND c.type = 'group'
  WHERE c.id IS NULL;
  
  RAISE NOTICE 'Events: %, Group Conversations: %, Events without conversations: %', 
    event_count, group_conv_count, events_without_conv;
  
  IF events_without_conv = 0 THEN
    RAISE NOTICE '✅ SUCCESS: All events have conversations!';
  ELSE
    RAISE WARNING '⚠️ Some events still missing conversations: %', events_without_conv;
  END IF;
END $$;