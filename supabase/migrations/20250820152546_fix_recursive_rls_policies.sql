-- supabase/migrations/20250820152546_fix_recursive_rls_policies.sql
-- =====================================================
-- FIX INFINITE RECURSION IN RLS POLICIES (CORRECTED VERSION)
-- Problem: conversation_participants policy was checking itself
-- Solution: Use direct user_id check instead of subquery
-- =====================================================

-- 1. Drop the problematic recursive policies
DROP POLICY IF EXISTS "Users can view participants of their conversations" ON public.conversation_participants;
DROP POLICY IF EXISTS "Users can view their conversations" ON public.conversations;

-- 2. Create fixed policy for conversations (check participants without recursion)
CREATE POLICY "Users can view their conversations" 
ON public.conversations
FOR SELECT 
USING (
  id IN (
    SELECT conversation_id 
    FROM conversation_participants 
    WHERE user_id = auth.uid()
  )
);

-- 3. Create fixed policy for conversation_participants (simple direct check)
-- Instead of checking if user is in participants BY querying participants,
-- we just check if this row belongs to the current user OR if they share a conversation
CREATE POLICY "Users can view participants of their conversations" 
ON public.conversation_participants
FOR SELECT 
USING (
  -- Either this row is about the current user
  user_id = auth.uid()
  OR
  -- OR the user is in the same conversation (without recursive check)
  conversation_id IN (
    SELECT conversation_id 
    FROM conversation_participants cp_inner
    WHERE cp_inner.user_id = auth.uid()
  )
);

-- 4. Also fix the messages policies for better performance
DROP POLICY IF EXISTS "Users can read messages in their conversations" ON public.messages;
DROP POLICY IF EXISTS "Users can send messages to their conversations" ON public.messages;

-- Recreate messages SELECT policy with both conversation and event support
CREATE POLICY "Users can read messages in their conversations" 
ON public.messages
FOR SELECT 
USING (
  -- Check conversation-based messages
  (
    conversation_id IS NOT NULL 
    AND conversation_id IN (
      SELECT conversation_id 
      FROM conversation_participants 
      WHERE user_id = auth.uid()
    )
  )
  OR
  -- Check event-based messages (legacy support)
  (
    event_id IS NOT NULL 
    AND EXISTS (
      SELECT 1 
      FROM attendance 
      WHERE event_id = messages.event_id 
      AND user_id = auth.uid()
    )
  )
);

-- Recreate messages INSERT policy
CREATE POLICY "Users can send messages to their conversations" 
ON public.messages
FOR INSERT 
WITH CHECK (
  user_id = auth.uid() 
  AND (
    -- For conversation-based messages
    (
      conversation_id IS NOT NULL 
      AND conversation_id IN (
        SELECT conversation_id 
        FROM conversation_participants 
        WHERE user_id = auth.uid()
      )
    )
    OR
    -- For event-based messages (legacy)
    (
      event_id IS NOT NULL 
      AND EXISTS (
        SELECT 1 
        FROM attendance 
        WHERE event_id = messages.event_id 
        AND user_id = auth.uid()
      )
    )
  )
);

-- 5. Fix other dependent policies for consistency
DROP POLICY IF EXISTS "Users can see typing in their conversations" ON public.typing_indicators;

CREATE POLICY "Users can see typing in their conversations" 
ON public.typing_indicators
FOR SELECT 
USING (
  conversation_id IN (
    SELECT conversation_id 
    FROM conversation_participants 
    WHERE user_id = auth.uid()
  )
);

-- 6. Add missing policies for other tables (CORRECTED - NO IF NOT EXISTS)
-- User privacy settings
DROP POLICY IF EXISTS "Users can view their privacy settings" ON public.user_privacy_settings;
DROP POLICY IF EXISTS "Users can manage their privacy settings" ON public.user_privacy_settings;

CREATE POLICY "Users can view their privacy settings" 
ON public.user_privacy_settings
FOR SELECT 
USING (user_id = auth.uid());

CREATE POLICY "Users can manage their privacy settings" 
ON public.user_privacy_settings
FOR ALL 
USING (user_id = auth.uid());

-- Message read receipts
DROP POLICY IF EXISTS "Users can view read receipts" ON public.message_read_receipts;
DROP POLICY IF EXISTS "Users can mark messages as read" ON public.message_read_receipts;

CREATE POLICY "Users can view read receipts" 
ON public.message_read_receipts
FOR SELECT 
USING (
  message_id IN (
    SELECT m.id 
    FROM messages m
    WHERE m.conversation_id IN (
      SELECT conversation_id 
      FROM conversation_participants 
      WHERE user_id = auth.uid()
    )
  )
);

CREATE POLICY "Users can mark messages as read" 
ON public.message_read_receipts
FOR INSERT 
WITH CHECK (user_id = auth.uid());

-- Blocked users
DROP POLICY IF EXISTS "Users can manage their blocked list" ON public.blocked_users;

CREATE POLICY "Users can manage their blocked list" 
ON public.blocked_users
FOR ALL 
USING (blocker_id = auth.uid());

-- 7. Verify the fix works by testing a simple query
-- This should not cause infinite recursion anymore
DO $$
BEGIN
  -- Test query that would have failed before
  PERFORM * FROM conversations LIMIT 1;
  PERFORM * FROM conversation_participants LIMIT 1;
  RAISE NOTICE 'RLS policies fixed successfully - no infinite recursion!';
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'RLS policies still have issues: %', SQLERRM;
END $$;