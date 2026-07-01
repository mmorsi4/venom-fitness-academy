-- ============================================================
-- 012_remove_assigned_coach.sql
-- Remove assigned_coach_id from members and update check_in_member RPC
-- ============================================================

-- 1. Remove assigned_coach_id from members
ALTER TABLE public.members DROP COLUMN IF EXISTS assigned_coach_id;

-- 2. Update check_in_member RPC to use class coach
CREATE OR REPLACE FUNCTION public.check_in_member(
  p_member_id      uuid,
  p_is_override    boolean DEFAULT false,
  p_pay_later      boolean DEFAULT false,
  p_performed_by   uuid DEFAULT null,
  p_performer_name text DEFAULT 'System'
)
RETURNS void AS $$
DECLARE
  v_member     public.members%rowtype;
  v_class_coach uuid;
  v_new_remaining int;
  v_action     text;
  v_action_type text;
  v_details    text;
BEGIN
  -- Lock the member row
  SELECT * INTO v_member FROM public.members WHERE id = p_member_id FOR UPDATE;

  IF v_member IS NULL THEN
    RAISE EXCEPTION 'Member not found: %', p_member_id;
  END IF;

  -- Decrement sessions (floor at 0, unlimited stays at 999)
  IF v_member.sessions_remaining = 999 THEN
    v_new_remaining := 999;
  ELSE
    v_new_remaining := GREATEST(0, v_member.sessions_remaining - 1);
  END IF;

  -- Determine action type and details
  IF p_is_override THEN
    v_action_type := 'override_checkin';
    v_details := 'Manual override check-in (expired/empty)';
  ELSE
    v_action_type := 'checkin';
    IF p_pay_later THEN
      v_details := 'Checked in - session deducted (Pay Later)';
    ELSE
      v_details := 'Checked in - session deducted';
    END IF;
  END IF;

  -- Update member
  UPDATE public.members
  SET 
    sessions_remaining = v_new_remaining,
    last_checkin = now()
  WHERE id = p_member_id;

  -- Increment coach session count if applicable (based on assigned class)
  IF v_member.class_id IS NOT NULL THEN
    SELECT coach_id INTO v_class_coach FROM public.classes WHERE id = v_member.class_id;
    IF v_class_coach IS NOT NULL THEN
      UPDATE public.coaches
      SET sessions_this_month = sessions_this_month + 1
      WHERE id = v_class_coach;
    END IF;
  END IF;

  -- Log to audit_logs
  INSERT INTO public.audit_logs (
    action_type, 
    member_name, 
    performed_by_name, 
    details
  ) VALUES (
    v_action_type,
    v_member.name,
    p_performer_name,
    v_details
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
