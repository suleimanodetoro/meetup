-- Purpose: Enable DM conversations end-to-end, fix RLS to allow DM membership-based access,
-- tighten participant writes to service-role only, add missing Realtime publications,
-- and add a safe backfill from attendance → conversation participants for group chats.

-- Safety first
SET statement_timeout = '60s';
SET lock_timeout = '15s';
SET idle_in_transaction_session_timeout = '60s';
SET client_min_messages TO warning;

-- 1) SCHEMA CHANGE: allow DM messages (event_id can be NULL)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'messages'
      AND column_name  = 'event_id'
      AND is_nullable  = 'NO'
  ) THEN
    ALTER TABLE public.messages
      ALTER COLUMN event_id DROP NOT NULL;
  END IF;
END$$;

-- 2) RLS: conversations — allow viewing any conversation I participate in (DM or group)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='conversations'
      AND policyname='Users can view their conversations'
  ) THEN
    DROP POLICY "Users can view their conversations" ON public.conversations;
  END IF;
END$$;

CREATE POLICY "Users can view conversations they participate in"
ON public.conversations
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.conversation_participants cp
    WHERE cp.conversation_id = conversations.id
      AND cp.user_id = auth.uid()
  )
);

-- 3) RLS: conversation_participants — tighten to only view parts of my convos; writes via service role only
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='conversation_participants'
      AND policyname='Users can view participants in their conversations'
  ) THEN
    DROP POLICY "Users can view participants in their conversations" ON public.conversation_participants;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='conversation_participants'
      AND policyname='System can manage participants'
  ) THEN
    DROP POLICY "System can manage participants" ON public.conversation_participants;
  END IF;
END$$;

CREATE POLICY "Users can view participants of their conversations"
ON public.conversation_participants
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.conversation_participants cp2
    WHERE cp2.conversation_id = conversation_participants.conversation_id
      AND cp2.user_id = auth.uid()
  )
);

-- Lock writes to service role (client should use SECURITY DEFINER RPCs)
CREATE POLICY "Service manages participants"
ON public.conversation_participants
FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- 4) RLS: messages — allow read/write by DM membership OR group attendance
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='messages'
      AND policyname='Users can read messages in their conversations'
  ) THEN
    DROP POLICY "Users can read messages in their conversations" ON public.messages;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='messages'
      AND policyname='Users can send messages to their conversations'
  ) THEN
    DROP POLICY "Users can send messages to their conversations" ON public.messages;
  END IF;
END$$;

CREATE POLICY "Users can read messages (dm or group)"
ON public.messages
FOR SELECT
USING (
  (
    messages.conversation_id IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM public.conversation_participants cp
      WHERE cp.conversation_id = messages.conversation_id
        AND cp.user_id = auth.uid()
    )
  )
  OR
  (
    messages.event_id IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM public.attendance a
      WHERE a.event_id = messages.event_id
        AND a.user_id = auth.uid()
    )
  )
);

CREATE POLICY "Users can send messages (dm or group)"
ON public.messages
FOR INSERT
WITH CHECK (
  user_id = auth.uid()
  AND (
    (
      conversation_id IS NOT NULL AND
      EXISTS (
        SELECT 1 FROM public.conversation_participants cp
        WHERE cp.conversation_id = messages.conversation_id
          AND cp.user_id = auth.uid()
      )
    )
    OR
    (
      event_id IS NOT NULL AND
      EXISTS (
        SELECT 1 FROM public.attendance a
        WHERE a.event_id = messages.event_id
          AND a.user_id = auth.uid()
      )
    )
  )
);

-- Keep your existing self-update/delete policies as-is

-- 5) RPC: make DM creator SECURITY DEFINER + enforce sender = auth.uid()
CREATE OR REPLACE FUNCTION public.get_or_create_dm_conversation_enhanced(sender_id uuid, recipient_id uuid)
RETURNS TABLE(conversation_id bigint, is_new boolean, can_message boolean, block_reason text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  conv_id bigint;
  can_msg boolean;
  block_msg text;
  is_new_conv boolean := false;
BEGIN
  -- Caller must be the sender
  IF auth.uid() IS DISTINCT FROM sender_id THEN
    RAISE EXCEPTION 'sender_id must equal auth.uid()';
  END IF;

  -- Check if allowed to message (uses your existing helper & privacy/blocks)
  SELECT * INTO can_msg FROM can_users_message(sender_id, recipient_id);
  IF NOT can_msg THEN
    IF EXISTS (
      SELECT 1 FROM blocked_users 
      WHERE (blocker_id = recipient_id AND blocked_id = sender_id)
         OR (blocker_id = sender_id AND blocked_id = recipient_id)
    ) THEN
      block_msg := 'blocked';
    ELSE
      SELECT COALESCE(message_privacy, 'everyone')
      INTO block_msg
      FROM user_privacy_settings
      WHERE user_id = recipient_id;

      IF block_msg = 'friends_only' THEN
        block_msg := 'Add as friend to message';
      ELSIF block_msg = 'nobody' THEN
        block_msg := 'User has disabled messaging';
      ELSE
        block_msg := 'not_allowed';
      END IF;
    END IF;

    RETURN QUERY SELECT NULL::bigint, false, false, block_msg;
    RETURN;
  END IF;

  -- Find existing DM with both users
  SELECT c.id INTO conv_id
  FROM conversations c
  WHERE c.type = 'dm'
    AND EXISTS (SELECT 1 FROM conversation_participants cp WHERE cp.conversation_id = c.id AND cp.user_id = sender_id)
    AND EXISTS (SELECT 1 FROM conversation_participants cp WHERE cp.conversation_id = c.id AND cp.user_id = recipient_id)
  LIMIT 1;

  -- Otherwise create
  IF conv_id IS NULL THEN
    INSERT INTO conversations (type) VALUES ('dm') RETURNING id INTO conv_id;
    INSERT INTO conversation_participants (conversation_id, user_id)
    VALUES (conv_id, sender_id), (conv_id, recipient_id);
    is_new_conv := true;
  END IF;

  RETURN QUERY SELECT conv_id, is_new_conv, true, NULL::text;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_or_create_dm_conversation_enhanced(uuid, uuid) TO authenticated;

-- 6) Realtime publication: add missing tables (idempotent)
DO $$
DECLARE
  _tbl text;
BEGIN
  FOREACH _tbl IN ARRAY ARRAY['public.messages','public.typing_indicators','public.conversation_participants','public.conversations']
  LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND (schemaname || '.' || tablename) = _tbl
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE %s', _tbl);
    END IF;
  END LOOP;
END$$;

-- 7) Backfill: ensure everyone in attendance is also a participant for the event’s group chat
INSERT INTO public.conversation_participants (conversation_id, user_id, joined_at)
SELECT c.id, a.user_id, now()
FROM public.attendance a
JOIN public.conversations c
  ON c.event_id = a.event_id AND c.type = 'group'
LEFT JOIN public.conversation_participants cp
  ON cp.conversation_id = c.id AND cp.user_id = a.user_id
WHERE cp.id IS NULL
ON CONFLICT (conversation_id, user_id) DO NOTHING;

-- 8) Optional: schedule typing cleanup every minute if pg_cron is available


-- Done.
