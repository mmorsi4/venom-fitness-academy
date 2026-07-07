-- 071_simple_history_edit.sql

-- 1. Function to delete a check-in from check_ins and refund a session
CREATE OR REPLACE FUNCTION public.delete_member_checkin(p_checkin_id uuid)
RETURNS void AS $$
DECLARE
  v_checkin public.check_ins%rowtype;
  v_member public.members%rowtype;
BEGIN
  -- Get the check-in
  SELECT * INTO v_checkin FROM public.check_ins WHERE id = p_checkin_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Check-in not found.';
  END IF;

  -- Restore a session to the member if it's not unlimited (999)
  IF v_checkin.member_id IS NOT NULL THEN
    SELECT * INTO v_member FROM public.members WHERE uuid = v_checkin.member_id FOR UPDATE;
    IF v_member.sessions_remaining != 999 THEN
      -- Refund member table
      UPDATE public.members 
      SET sessions_remaining = sessions_remaining + 1,
          status = CASE 
            WHEN sessions_remaining + 1 > 2 THEN 'active'
            WHEN sessions_remaining + 1 > 0 THEN 'expiring_soon'
            ELSE 'expired'
          END
      WHERE uuid = v_checkin.member_id;

      -- Refund active invoice
      UPDATE public.invoices
      SET sessions_remaining = sessions_remaining + 1
      WHERE uuid = (
        SELECT uuid FROM public.invoices
        WHERE member_id = v_checkin.member_id
          AND status IN ('paid', 'partial')
          AND sessions_remaining != 999
        ORDER BY created_at DESC
        LIMIT 1
      );
    END IF;
  END IF;

  -- Log the deletion in audit_logs
  IF v_member.uuid IS NOT NULL THEN
    INSERT INTO public.audit_logs (action, action_type, details, member_id, member_name)
    VALUES (
      'Delete Check-in',
      'delete_checkin',
      format('Deleted check-in from %s. Session refunded.', to_char(v_checkin.created_at, 'YYYY-MM-DD HH24:MI')),
      v_member.uuid,
      v_member.name
    );
  END IF;

  -- Delete the check-in
  DELETE FROM public.check_ins WHERE id = p_checkin_id;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 2. Function to update a check-in time in check_ins
CREATE OR REPLACE FUNCTION public.update_member_checkin_time(p_checkin_id uuid, p_new_time timestamptz)
RETURNS void AS $$
BEGIN
  UPDATE public.check_ins
  SET created_at = p_new_time
  WHERE id = p_checkin_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
