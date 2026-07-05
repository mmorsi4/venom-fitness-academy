-- Function to set member ID to the max number + 1 if it is 0 or null
CREATE OR REPLACE FUNCTION public.set_member_id()
RETURNS trigger AS $$
DECLARE
  v_max_id int;
BEGIN
  IF NEW.id IS NULL OR NEW.id = 0 THEN
    SELECT max(id) INTO v_max_id FROM public.members WHERE id > 0;
    IF v_max_id IS NULL THEN
      v_max_id := 0;
    END IF;
    NEW.id := v_max_id + 1;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_set_member_id ON public.members;
CREATE TRIGGER trg_set_member_id
  BEFORE INSERT ON public.members
  FOR EACH ROW
  EXECUTE FUNCTION public.set_member_id();
