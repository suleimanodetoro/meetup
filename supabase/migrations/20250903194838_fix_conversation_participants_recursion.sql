-- Migration: 20250903150000_fix_conversation_participants_recursion.sql
-- Purpose: Fix infinite recursion in conversation_participants RLS policies
-- =====================================================

-- Drop all existing policies on affected tables
DROP POLICY IF EXISTS "Users can view participants in their conversations" ON public.conversation_participants;
DROP POLICY IF EXISTS "System can add participants" ON public.conversation_participants;
DROP POLICY IF EXISTS "Users can update their participant status" ON public.conversation_participants;
DROP POLICY IF EXISTS "Users can view their conversations" ON public.conversations;
DROP POLICY IF EXISTS "Users can read messages in their conversations" ON public.messages;
DROP POLICY IF EXISTS "Users can send messages to their conversations" ON public.messages;
DROP POLICY IF EXISTS "Users can update their own messages" ON public.messages;
DROP POLICY IF EXISTS "Users can delete their own messages" ON public.messages;

-- Create new policies that avoid circular references

-- Conversations: Check via attendance table, not participants
CREATE POLICY "Users can view their conversations" 
ON public.conversations
FOR SELECT 
TO authenticated
USING (
  -- Group conversations: user must be attending the event
  (
    type = 'group' 
    AND event_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM attendance a 
      WHERE a.event_id = conversations.event_id 
      AND a.user_id = auth.uid()
    )
  )
  OR
  -- DM conversations: placeholder for future implementation
  (type = 'dm' AND false)
);

-- Conversation participants: Check via attendance, not self-reference
CREATE POLICY "Users can view participants in their conversations" 
ON public.conversation_participants
FOR SELECT 
TO authenticated
USING (
  -- Check if user attends the same event as this conversation
  EXISTS (
    SELECT 1 
    FROM conversations c
    JOIN attendance a ON a.event_id = c.event_id
    WHERE c.id = conversation_participants.conversation_id
    AND a.user_id = auth.uid()
  )
);

-- Allow system functions to manage participants
CREATE POLICY "System can manage participants" 
ON public.conversation_participants
FOR ALL
USING (true)
WITH CHECK (true);

-- Messages: Check via attendance
CREATE POLICY "Users can read messages in their conversations" 
ON public.messages
FOR SELECT 
TO authenticated
USING (
  -- Conversation messages: check via event attendance
  (
    conversation_id IS NOT NULL 
    AND EXISTS (
      SELECT 1 
      FROM conversations c
      JOIN attendance a ON a.event_id = c.event_id
      WHERE c.id = messages.conversation_id
      AND a.user_id = auth.uid()
    )
  )
  OR
  -- Event messages (legacy)
  (
    event_id IS NOT NULL 
    AND EXISTS (
      SELECT 1 
      FROM attendance a
      WHERE a.event_id = messages.event_id 
      AND a.user_id = auth.uid()
    )
  )
);

-- Messages: Insert policy
CREATE POLICY "Users can send messages to their conversations" 
ON public.messages
FOR INSERT 
TO authenticated
WITH CHECK (
  user_id = auth.uid() 
  AND (
    -- Conversation messages: check via attendance
    (
      conversation_id IS NOT NULL 
      AND EXISTS (
        SELECT 1 
        FROM conversations c
        JOIN attendance a ON a.event_id = c.event_id
        WHERE c.id = messages.conversation_id
        AND a.user_id = auth.uid()
      )
    )
    OR
    -- Event messages (legacy)
    (
      event_id IS NOT NULL 
      AND EXISTS (
        SELECT 1 
        FROM attendance a
        WHERE a.event_id = messages.event_id 
        AND a.user_id = auth.uid()
      )
    )
  )
);

-- Messages: Update/Delete policies
CREATE POLICY "Users can update their own messages" 
ON public.messages
FOR UPDATE 
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their own messages" 
ON public.messages
FOR DELETE 
TO authenticated
USING (user_id = auth.uid());

-- Ensure event creators are in attendance and participants
INSERT INTO attendance (event_id, user_id, created_at)
SELECT DISTINCT e.id, e.user_id, e.created_at
FROM events e
WHERE NOT EXISTS (
  SELECT 1 FROM attendance a 
  WHERE a.event_id = e.id 
  AND a.user_id = e.user_id
)
ON CONFLICT DO NOTHING;

-- Add event creators to conversation participants if missing
INSERT INTO conversation_participants (conversation_id, user_id, joined_at)
SELECT DISTINCT c.id, e.user_id, NOW()
FROM conversations c
JOIN events e ON e.id = c.event_id
WHERE c.type = 'group'
AND NOT EXISTS (
  SELECT 1 FROM conversation_participants cp
  WHERE cp.conversation_id = c.id
  AND cp.user_id = e.user_id
)
ON CONFLICT DO NOTHING;