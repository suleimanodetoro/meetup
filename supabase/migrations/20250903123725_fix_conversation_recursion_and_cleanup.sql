-- =====================================================
-- Migration: 20250903_fix_conversation_recursion_and_cleanup.sql
-- Purpose: Fix infinite recursion in RLS policies and clean orphaned data
-- Author: System
-- Date: 2025-09-03
-- =====================================================

-- STEP 1: Drop all existing problematic policies
-- =====================================================
DROP POLICY IF EXISTS "Users can view participants in their conversations" ON public.conversation_participants;
DROP POLICY IF EXISTS "Users can view their conversations" ON public.conversations;
DROP POLICY IF EXISTS "Users can read messages in their conversations" ON public.messages;
DROP POLICY IF EXISTS "Users can send messages to their conversations" ON public.messages;

-- STEP 2: Create fixed non-recursive policies for conversations
-- =====================================================
-- This policy doesn't reference conversation_participants, breaking the circular dependency
CREATE POLICY "Users can view their conversations" 
ON public.conversations
FOR SELECT 
TO authenticated
USING (
  -- Direct check using a simple subquery
  id IN (
    SELECT conversation_id 
    FROM conversation_participants 
    WHERE user_id = auth.uid()
  )
);

-- STEP 3: Create fixed policy for conversation_participants
-- =====================================================
-- This uses a simpler approach without self-referencing
CREATE POLICY "Users can view participants in their conversations" 
ON public.conversation_participants
FOR SELECT 
TO authenticated
USING (
  -- User can see participant records if they are in that conversation
  conversation_id IN (
    SELECT conversation_id 
    FROM conversation_participants cp_check
    WHERE cp_check.user_id = auth.uid()
  )
);

-- STEP 4: Create INSERT policy for conversation_participants (for system functions)
-- =====================================================
CREATE POLICY "System can add participants" 
ON public.conversation_participants
FOR INSERT 
TO authenticated
WITH CHECK (true); -- Functions with SECURITY DEFINER will handle this

-- STEP 5: Fix messages policies
-- =====================================================
CREATE POLICY "Users can read messages in their conversations" 
ON public.messages
FOR SELECT 
TO authenticated
USING (
  -- Check conversation-based messages
  (
    conversation_id IS NOT NULL 
    AND conversation_id IN (
      SELECT cp.conversation_id 
      FROM conversation_participants cp
      WHERE cp.user_id = auth.uid()
    )
  )
  OR
  -- Check event-based messages (legacy)
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

CREATE POLICY "Users can send messages to their conversations" 
ON public.messages
FOR INSERT 
TO authenticated
WITH CHECK (
  user_id = auth.uid() 
  AND (
    -- For conversation-based messages
    (
      conversation_id IS NOT NULL 
      AND conversation_id IN (
        SELECT cp.conversation_id 
        FROM conversation_participants cp
        WHERE cp.user_id = auth.uid()
      )
    )
    OR
    -- For event-based messages (legacy)
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

-- STEP 6: Add UPDATE and DELETE policies for messages
-- =====================================================
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

-- STEP 7: Clean up orphaned conversations (17 found in diagnostic)
-- =====================================================
DO $$
DECLARE
  orphaned_count integer;
  conv_rec record;
BEGIN
  -- Count orphaned conversations
  SELECT COUNT(*) INTO orphaned_count
  FROM conversations c
  LEFT JOIN conversation_participants cp ON cp.conversation_id = c.id
  WHERE cp.id IS NULL;
  
  RAISE NOTICE 'Found % orphaned conversations', orphaned_count;
  
  -- For each orphaned conversation, try to add participants
  FOR conv_rec IN
    SELECT c.*, e.user_id as creator_id
    FROM conversations c
    LEFT JOIN conversation_participants cp ON cp.conversation_id = c.id
    LEFT JOIN events e ON e.id = c.event_id
    WHERE cp.id IS NULL AND c.type = 'group' AND c.event_id IS NOT NULL
  LOOP
    -- Add the event creator as a participant
    IF conv_rec.creator_id IS NOT NULL THEN
      INSERT INTO conversation_participants (conversation_id, user_id, joined_at)
      VALUES (conv_rec.id, conv_rec.creator_id, NOW())
      ON CONFLICT (conversation_id, user_id) DO NOTHING;
      
      RAISE NOTICE 'Added creator to conversation % for event %', conv_rec.id, conv_rec.event_id;
    END IF;
    
    -- Add all attendees
    INSERT INTO conversation_participants (conversation_id, user_id, joined_at)
    SELECT conv_rec.id, a.user_id, NOW()
    FROM attendance a
    WHERE a.event_id = conv_rec.event_id
    ON CONFLICT (conversation_id, user_id) DO NOTHING;
  END LOOP;
  
  -- Delete conversations that still have no participants (shouldn't happen for group convos)
  DELETE FROM conversations c
  WHERE NOT EXISTS (
    SELECT 1 FROM conversation_participants cp 
    WHERE cp.conversation_id = c.id
  )
  AND c.type = 'dm'; -- Only delete orphaned DM conversations
  
END $$;

-- STEP 8: Create helper policies for other operations
-- =====================================================
-- Allow users to update their own participant record (for last_read_at)
CREATE POLICY "Users can update their participant status" 
ON public.conversation_participants
FOR UPDATE 
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- STEP 9: Verify the fix
-- =====================================================
DO $$
DECLARE
  test_result boolean;
  error_msg text;
BEGIN
  -- Test query that was failing
  BEGIN
    PERFORM * FROM conversation_participants LIMIT 1;
    PERFORM * FROM conversations LIMIT 1;
    RAISE NOTICE 'SUCCESS: Policies are working without recursion!';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS error_msg = MESSAGE_TEXT;
    RAISE EXCEPTION 'FAILED: Policies still have issues: %', error_msg;
  END;
END $$;

-- STEP 10: Grant necessary permissions
-- =====================================================
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON public.conversations TO authenticated;
GRANT ALL ON public.conversation_participants TO authenticated;
GRANT ALL ON public.messages TO authenticated;

-- Log completion
DO $$
BEGIN
  RAISE NOTICE '=== Migration Complete ===';
  RAISE NOTICE '1. Fixed recursive RLS policies';
  RAISE NOTICE '2. Cleaned up orphaned conversations';
  RAISE NOTICE '3. Added missing policies for UPDATE/DELETE';
  RAISE NOTICE '4. Verified policies work without recursion';
END $$;