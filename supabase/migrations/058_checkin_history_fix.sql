CREATE OR REPLACE FUNCTION public.check_in_member(
  p_member_id      uuid,
  p_is_override    boolean DEFAULT false,
  p_pay_later      boolean DEFAULT false,
  p_performed_by   uuid DEFAULT null,
  p_performer_name text DEFAULT 'System',
  p_invoice_uuid   uuid DEFAULT null
)
RETURNS void AS $$
DECLARE
  v_member     public.members%rowtype;
  v_invoice    public.invoices%rowtype;
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

  -- Lock the invoice row if provided
  IF p_invoice_uuid IS NOT NULL THEN
    SELECT * INTO v_invoice FROM public.invoices WHERE uuid = p_invoice_uuid FOR UPDATE;
    IF v_invoice IS NULL THEN
      RAISE EXCEPTION 'Invoice not found: %', p_invoice_uuid;
    END IF;
  END IF;

  -- Check freeze status (applies globally to member or invoice)
  IF v_member.frozen_until IS NOT NULL AND v_member.frozen_until > now() THEN
    IF NOT p_is_override THEN
      RAISE EXCEPTION 'Member is frozen until %. Please cancel freeze to check-in.', to_char(v_member.frozen_until, 'YYYY-MM-DD');
    ELSE
      v_unused_freeze_days := CEIL(EXTRACT(EPOCH FROM (v_member.frozen_until - now())) / 86400);
      IF v_unused_freeze_days > 0 THEN
        UPDATE public.members
        SET expires_at = expires_at - (v_unused_freeze_days || ' days')::interval,
            frozen_until = null
        WHERE uuid = p_member_id;
      ELSE
        UPDATE public.members SET frozen_until = null WHERE uuid = p_member_id;
      END IF;
    END IF;
  ELSE
    IF v_member.frozen_until IS NOT NULL THEN
      UPDATE public.members SET frozen_until = null WHERE uuid = p_member_id;
    END IF;
  END IF;

  -- Check if current package is clinic
  v_is_clinic := false;
  IF p_invoice_uuid IS NOT NULL THEN
      IF v_invoice.package_id IS NOT NULL THEN
        SELECT is_clinic INTO v_is_clinic FROM public.packages WHERE id = v_invoice.package_id;
      END IF;
  ELSE
      IF v_member.id = -1 THEN
        v_is_clinic := true;
      ELSIF v_member.package_id IS NOT NULL THEN
        SELECT is_clinic INTO v_is_clinic FROM public.packages WHERE id = v_member.package_id;
      END IF;
  END IF;

  IF p_invoice_uuid IS NOT NULL THEN
      -- Invoice-based check-in
      IF p_is_override THEN
        IF v_is_clinic THEN
          RAISE EXCEPTION 'Cannot override check-in for clinic packages.';
        END IF;
        IF v_invoice.sessions_remaining <= -3 THEN
          RAISE EXCEPTION 'Invoice has reached the maximum allowed override debt of -3 sessions.';
        END IF;
      ELSE
        IF v_invoice.sessions_remaining <= 0 THEN
          RAISE EXCEPTION 'Invoice has no sessions remaining.';
        END IF;
      END IF;

      -- Decrement sessions
      IF v_invoice.sessions_remaining = 999 THEN
        v_new_remaining := 999;
      ELSIF p_is_override THEN
        v_new_remaining := GREATEST(-3, v_invoice.sessions_remaining - 1);
      ELSE
        v_new_remaining := GREATEST(0, v_invoice.sessions_remaining - 1);
      END IF;

      -- Update Invoice
      UPDATE public.invoices
      SET sessions_remaining = v_new_remaining
      WHERE uuid = p_invoice_uuid;

      -- Update member (just last_checkin)
      UPDATE public.members
      SET last_checkin = now()
      WHERE uuid = p_member_id;

      -- Build audit entry
      IF p_is_override THEN
        v_action := 'Override Check-in (Invoice)';
        v_action_type := 'override_checkin';
        v_details := format('Allowed %s(Pay Later) to attend on invoice %s. Session debt: %s',
          CASE WHEN p_pay_later THEN '(Pay Later) ' ELSE '' END,
          v_invoice.id, v_new_remaining);
      ELSE
        v_action := 'Check-in (Invoice)';
        v_action_type := 'checkin';
        v_details := format('Check-in on invoice %s (%s), session deducted (%s remaining)',
          v_invoice.id, v_invoice.package_name, v_new_remaining);
      END IF;
  ELSE
      -- Fallback to Member-based check-in
      IF p_is_override THEN
        IF v_is_clinic THEN
          RAISE EXCEPTION 'Cannot override check-in for clinic packages.';
        END IF;
        IF v_member.sessions_remaining <= -3 THEN
          RAISE EXCEPTION 'Member has reached the maximum allowed override debt of -3 sessions.';
        END IF;
      ELSE
        IF v_member.sessions_remaining <= 0 THEN
          RAISE EXCEPTION 'Member has no sessions remaining.';
        END IF;
      END IF;

      -- Decrement sessions
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
          last_checkin = now(),
          status = CASE
            WHEN v_new_remaining <= 2 AND v_new_remaining != 999 AND v_new_remaining > 0 THEN 'expiring_soon'
            ELSE status
          END
      WHERE uuid = p_member_id;

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
  END IF;

  -- Insert audit log
  INSERT INTO public.audit_logs (action, action_type, performed_by, performer_name, member_id, member_name, details)
  VALUES (v_action, v_action_type, p_performed_by, p_performer_name, p_member_id, v_member.name, v_details);

  -- Insert check-in record for history modal!
  INSERT INTO public.check_ins (member_id, checked_in_by, is_override, pay_later)
  VALUES (p_member_id, p_performed_by, p_is_override, p_pay_later);

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
