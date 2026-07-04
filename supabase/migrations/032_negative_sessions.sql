-- 032_negative_sessions.sql

-- Add session_debt column
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS session_debt int NOT NULL DEFAULT 0;

-- 1. check_in_member updates
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
  v_is_clinic  boolean;
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

  -- Check if current package is clinic
  v_is_clinic := false;
  IF v_member.id = -1 THEN
    v_is_clinic := true;
  ELSIF v_member.package_id IS NOT NULL THEN
    SELECT is_clinic INTO v_is_clinic FROM public.packages WHERE id = v_member.package_id;
  END IF;

  IF p_is_override THEN
    IF v_is_clinic THEN
      RAISE EXCEPTION 'Cannot override check-in for clinic packages.';
    END IF;
    IF v_member.sessions_remaining <= -3 THEN
      RAISE EXCEPTION 'Member has reached the maximum allowed override debt of -3 sessions.';
    END IF;
  ELSE
    -- Normal check-in
    IF v_member.sessions_remaining <= 0 THEN
      RAISE EXCEPTION 'Member has no sessions remaining.';
    END IF;
  END IF;

  -- Decrement sessions (floor at 0 normally, -3 for override, unlimited stays at 999)
  IF v_member.sessions_remaining = 999 THEN
    v_new_remaining := 999;
  ELSIF p_is_override THEN
    v_new_remaining := GREATEST(-3, v_member.sessions_remaining - 1);
  ELSE
    v_new_remaining := GREATEST(0, v_member.sessions_remaining - 1);
  END IF;

  -- Update member
  UPDATE public.members
  SET sessions_remaining = v_new_remaining,
      status = CASE
        WHEN v_new_remaining <= 2 AND v_new_remaining != 999 AND v_new_remaining > 0 THEN 'expiring_soon'
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
    v_details := format('Allowed %s(Pay Later) expired or frozen member %s (%s) to attend. Session debt: %s',
      CASE WHEN p_pay_later THEN '(Pay Later) ' ELSE '' END,
      v_member.id, v_member.name, v_new_remaining);
  ELSE
    v_action := 'Check-in';
    v_action_type := 'checkin';
    v_details := format('Normal check-in: %s (%s), session deducted (%s remaining)',
      v_member.id, v_member.name, v_new_remaining);
  END IF;

  -- Insert audit log
  INSERT INTO public.audit_logs (action, action_type, performed_by, performer_name, member_id, member_name, details)
  VALUES (v_action, v_action_type, p_performed_by, p_performer_name, p_member_id, v_member.name, v_details);

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 2. handle_invoice_created update
CREATE OR REPLACE FUNCTION public.handle_invoice_created()
RETURNS trigger AS $$
DECLARE
  v_pkg public.packages%rowtype;
  v_member public.members%rowtype;
  v_new_sessions int;
  v_new_debt int;
BEGIN
  IF NEW.package_id IS NULL THEN
    NEW.is_applied := true;
    RETURN NEW;
  END IF;

  -- Default activation_date to created_at if not provided
  IF NEW.activation_date IS NULL THEN
    NEW.activation_date := NEW.created_at;
  END IF;

  SELECT * INTO v_pkg FROM public.packages WHERE id = NEW.package_id;
  IF v_pkg IS NULL THEN
    NEW.is_applied := true;
    RETURN NEW;
  END IF;

  -- If activation_date is in the future, don't apply yet
  IF NEW.activation_date > now() THEN
    NEW.is_applied := false;
    RETURN NEW;
  END IF;

  -- Fetch the member to check for session debt
  SELECT * INTO v_member FROM public.members WHERE uuid = NEW.member_id;
  IF v_member IS NULL THEN
    NEW.is_applied := true;
    RETURN NEW;
  END IF;

  -- Calculate new sessions with debt
  IF v_pkg.is_clinic THEN
    v_new_sessions := v_pkg.sessions;
    v_new_debt := v_member.session_debt;
    IF v_member.sessions_remaining < 0 THEN
      v_new_debt := v_new_debt + ABS(v_member.sessions_remaining);
    END IF;
  ELSE
    v_new_debt := v_member.session_debt;
    IF v_member.sessions_remaining < 0 THEN
      v_new_debt := v_new_debt + ABS(v_member.sessions_remaining);
    END IF;
    
    v_new_sessions := v_pkg.sessions - v_new_debt;
    v_new_debt := 0;
  END IF;

  -- Otherwise, apply now
  UPDATE public.members
  SET
    package_id                = v_pkg.id,
    package_name              = v_pkg.name,
    sessions_remaining        = v_new_sessions,
    session_debt              = v_new_debt,
    freeze_days_remaining     = v_pkg.freeze_days,
    invitations_remaining     = v_pkg.invitations,
    inbody_sessions_remaining = v_pkg.inbody_sessions,
    expires_at                = NEW.activation_date + (v_pkg.validity_days || ' days')::interval,
    status                    = 'active'
  WHERE uuid = NEW.member_id;

  NEW.is_applied := true;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 3. activate_pending_subscriptions update
CREATE OR REPLACE FUNCTION public.activate_pending_subscriptions()
RETURNS void AS $$
DECLARE
  v_inv public.invoices%rowtype;
  v_pkg public.packages%rowtype;
  v_member public.members%rowtype;
  v_new_sessions int;
  v_new_debt int;
BEGIN
  FOR v_inv IN 
    SELECT * FROM public.invoices 
    WHERE is_applied = false 
      AND activation_date <= now()
      AND package_id IS NOT NULL
    ORDER BY activation_date ASC
  LOOP
    SELECT * INTO v_pkg FROM public.packages WHERE id = v_inv.package_id;
    IF v_pkg IS NOT NULL THEN
      
      SELECT * INTO v_member FROM public.members WHERE uuid = v_inv.member_id;
      
      IF v_member IS NOT NULL THEN
        IF v_pkg.is_clinic THEN
          v_new_sessions := v_pkg.sessions;
          v_new_debt := v_member.session_debt;
          IF v_member.sessions_remaining < 0 THEN
            v_new_debt := v_new_debt + ABS(v_member.sessions_remaining);
          END IF;
        ELSE
          v_new_debt := v_member.session_debt;
          IF v_member.sessions_remaining < 0 THEN
            v_new_debt := v_new_debt + ABS(v_member.sessions_remaining);
          END IF;
          
          v_new_sessions := v_pkg.sessions - v_new_debt;
          v_new_debt := 0;
        END IF;

        UPDATE public.members
        SET
          package_id                = v_pkg.id,
          package_name              = v_pkg.name,
          sessions_remaining        = v_new_sessions,
          session_debt              = v_new_debt,
          freeze_days_remaining     = v_pkg.freeze_days,
          invitations_remaining     = v_pkg.invitations,
          inbody_sessions_remaining = v_pkg.inbody_sessions,
          expires_at                = v_inv.activation_date + (v_pkg.validity_days || ' days')::interval,
          status                    = 'active'
        WHERE uuid = v_inv.member_id;
      END IF;
    END IF;
    
    UPDATE public.invoices
    SET is_applied = true
    WHERE uuid = v_inv.uuid;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
