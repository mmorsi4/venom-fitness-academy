-- ============================================================
-- 022_update_class_attendance_trigger.sql
-- Automatically manage class attendance_count based on members.class_id
-- ============================================================

-- First, correct any existing attendance counts
UPDATE public.classes c
SET attendance_count = (
  SELECT count(*) FROM public.members m WHERE m.class_id = c.id
);

-- Function to handle attendance count changes
CREATE OR REPLACE FUNCTION public.handle_member_class_change()
RETURNS trigger AS $$
BEGIN
  -- If updating and the class_id didn't change, do nothing
  IF TG_OP = 'UPDATE' AND OLD.class_id IS NOT DISTINCT FROM NEW.class_id THEN
    RETURN NEW;
  END IF;

  -- Decrement old class
  IF (TG_OP = 'UPDATE' OR TG_OP = 'DELETE') AND OLD.class_id IS NOT NULL THEN
    UPDATE public.classes 
    SET attendance_count = attendance_count - 1 
    WHERE id = OLD.class_id;
  END IF;
  
  -- Increment new class
  IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') AND NEW.class_id IS NOT NULL THEN
    UPDATE public.classes 
    SET attendance_count = attendance_count + 1 
    WHERE id = NEW.class_id;
  END IF;
  
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS trigger_member_class_change ON public.members;

-- Create the trigger
CREATE TRIGGER trigger_member_class_change
AFTER INSERT OR UPDATE OF class_id OR DELETE ON public.members
FOR EACH ROW EXECUTE FUNCTION public.handle_member_class_change();
