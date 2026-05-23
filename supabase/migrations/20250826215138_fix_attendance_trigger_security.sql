-- supabase/migrations/20250826_fix_attendance_trigger_security.sql
-- Fix: Add SECURITY DEFINER to the attendance trigger that was missed

-- The add_user_to_event_conversation function needs SECURITY DEFINER
-- to bypass RLS when inserting into conversation_participants
DROP TRIGGER IF EXISTS on_attendance_created ON attendance;
DROP FUNCTION IF EXISTS add_user_to_event_conversation();

CREATE OR REPLACE FUNCTION add_user_to_event_conversation()
RETURNS trigger 
SECURITY DEFINER -- This was missing!
SET search_path = public
AS $$
DECLARE
  conv_id bigint;
BEGIN
  -- Find the conversation for this event
  SELECT id INTO conv_id FROM conversations WHERE event_id = NEW.event_id;
  
  -- Add user as participant
  IF conv_id IS NOT NULL THEN
    INSERT INTO conversation_participants (conversation_id, user_id)
    VALUES (conv_id, NEW.user_id)
    ON CONFLICT DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate the trigger
CREATE TRIGGER on_attendance_created
  AFTER INSERT ON attendance
  FOR EACH ROW
  EXECUTE FUNCTION add_user_to_event_conversation();

-- Verify
DO $$
BEGIN
  RAISE NOTICE 'Fixed: add_user_to_event_conversation now runs with SECURITY DEFINER';
END $$;