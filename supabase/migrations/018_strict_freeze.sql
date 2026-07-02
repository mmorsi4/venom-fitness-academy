-- migration 018_strict_freeze.sql

ALTER TABLE public.members ADD COLUMN IF NOT EXISTS frozen_until timestamptz;

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
  v_unused_freeze_days int;
BEGIN
  -- Lock the member row
  SELECT * INTO v_member FROM public.members WHERE uuid = p_member_id FOR UPDATE;

  IF v_member IS NULL THEN
    RAISE EXCEPTION 'Member not found: %', p_member_id;
  END IF;

  -- Check freeze status
  IF v_member.frozen_until IS NOT NULL AND v_member.frozen_until > now() THEN
    IF NOT p_is_override THEN
      RAISE EXCEPTION 'Member is frozen until %. Please cancel freeze to check-in.', to_char(v_member.frozen_until, 'YYYY-MM-DD');
    ELSE
      -- Calculate unused freeze days (ceiling of diff in days)
      v_unused_freeze_days := CEIL(EXTRACT(EPOCH FROM (v_member.frozen_until - now())) / 86400);
      IF v_unused_freeze_days > 0 THEN
        -- Subtract from expires_at, do NOT refund freeze_days_remaining
        UPDATE public.members
        SET 
          expires_at = expires_at - (v_unused_freeze_days || ' days')::interval,
          frozen_until = null
        WHERE uuid = p_member_id;
      ELSE
        UPDATE public.members SET frozen_until = null WHERE uuid = p_member_id;
      END IF;
    END IF;
  ELSE
    -- Just clear it if it's passed
    IF v_member.frozen_until IS NOT NULL THEN
      UPDATE public.members SET frozen_until = null WHERE uuid = p_member_id;
    END IF;
  END IF;

  -- Validation: Ensure sessions are available for non-override check-ins
  IF NOT p_is_override AND v_member.sessions_remaining <= 0 THEN
    RAISE EXCEPTION 'Member has no sessions remaining.';
  END IF;

  -- Decrement sessions (floor at 0, unlimited stays at 999)
  IF v_member.sessions_remaining = 999 THEN
    v_new_remaining := 999;
  ELSE
    v_new_remaining := GREATEST(0, v_member.sessions_remaining - 1);
  END IF;

  -- Update member
  UPDATE public.members
  SET sessions_remaining = v_new_remaining,
      status = CASE
        WHEN v_new_remaining <= 2 AND v_new_remaining != 999 THEN 'expiring_soon'
        ELSE status
      END
  WHERE uuid = p_member_id;

  -- Increment coach session count if applicable (based on assigned class)
  IF v_member.class_id IS NOT NULL THEN
    SELECT coach_id INTO v_class_coach FROM public.classes WHERE id = v_member.class_id;
    IF v_class_coach IS NOT NULL THEN
      UPDATE public.coaches
      SET sessions_this_month = sessions_this_month + 1
      WHERE id = v_class_coach;
    END IF;
  END IF;

  -- Build audit entry
  IF p_is_override THEN
    v_action := 'Override Check-in';
    v_action_type := 'override_checkin';
    v_details := format('Allowed %s(Pay Later) expired or frozen member %s (%s) to attend',
      CASE WHEN p_pay_later THEN '(Pay Later) ' ELSE '' END,
      v_member.id, v_member.name);
  ELSE
    v_action := 'Check-in';
    v_action_type := 'checkin';
    v_details := format('Normal check-in: %s (%s), session deducted (%s remaining)',
      v_member.id, v_member.name, v_new_remaining);
  END IF;

  -- Insert audit log
  INSERT INTO public.audit_logs (action, action_type, performed_by, performer_name, member_id, member_name, details)
  VALUES (v_action, v_action_type, p_performed_by, p_performer_name, p_member_id, v_member.name, v_details);

  -- Insert check-in record
  INSERT INTO public.check_ins (member_id, checked_in_by, is_override, pay_later)
  VALUES (p_member_id, p_performed_by, p_is_override, p_pay_later);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
