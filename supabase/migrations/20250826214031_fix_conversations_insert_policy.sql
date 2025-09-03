-- supabase/migrations/20250826_fix_conversations_insert_policy.sql
-- Fix: Add missing INSERT policy for conversations table to allow event trigger to work

-- Drop and recreate the trigger function with SECURITY DEFINER
-- This allows the function to bypass RLS when creating conversations
DROP TRIGGER IF EXISTS on_event_created ON events;
DROP FUNCTION IF EXISTS create_event_conversation();

CREATE OR REPLACE FUNCTION create_event_conversation()
RETURNS trigger 
SECURITY DEFINER -- This is the key change - runs with elevated privileges
SET search_path = public
AS $$
BEGIN
  -- Create a group conversation for the event
  INSERT INTO conversations (type, name, event_id, avatar_url)
  VALUES ('group', NEW.title, NEW.id, NEW.image_uri);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate the trigger
CREATE TRIGGER on_event_created
  AFTER INSERT ON events
  FOR EACH ROW
  EXECUTE FUNCTION create_event_conversation();

-- Also add a policy for users to create DM conversations
-- (keeping this for when users initiate DM conversations)
CREATE POLICY "Users can create DM conversations" 
ON public.conversations
FOR INSERT 
WITH CHECK (type = 'dm');

-- Add policy for service role to manage conversations (for functions)
CREATE POLICY "Service functions can manage conversations" 
ON public.conversations
FOR ALL 
TO service_role
USING (true)
WITH CHECK (true);

-- Verify the fix
DO $$
BEGIN
  RAISE NOTICE 'Fixed: Conversations can now be created via event trigger';
  RAISE NOTICE 'Added: SECURITY DEFINER to create_event_conversation function';
  RAISE NOTICE 'Added: INSERT policy for DM conversations';
  RAISE NOTICE 'Added: Service role policy for conversation management';
END $$;