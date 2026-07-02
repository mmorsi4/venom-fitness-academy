-- ============================================================
-- 007_invoice_id.sql
-- Rename invoice columns, add member subscription tracking,
-- create trigger to auto-update member on invoice creation
-- ============================================================

-- ── 1. Invoice column renames ───────────────────────────────
ALTER TABLE public.invoices RENAME COLUMN id TO uuid;
ALTER TABLE public.invoices RENAME COLUMN display_id TO id;

-- ── 2. Add subscription tracking columns to members ─────────
ALTER TABLE public.members
  ADD COLUMN IF NOT EXISTS package_id uuid REFERENCES public.packages(id) ON DELETE SET NULL;

ALTER TABLE public.members
  ADD COLUMN IF NOT EXISTS invitations_remaining int NOT NULL DEFAULT 0;

ALTER TABLE public.members
  ADD COLUMN IF NOT EXISTS inbody_sessions_remaining int NOT NULL DEFAULT 0;

-- ── 3. Trigger: auto-update member subscription on invoice insert ──

CREATE OR REPLACE FUNCTION public.handle_invoice_created()
RETURNS trigger AS $$
DECLARE
  v_pkg public.packages%rowtype;
BEGIN
  -- Only update member if the invoice references a package
  IF NEW.package_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_pkg FROM public.packages WHERE id = NEW.package_id;

  IF v_pkg IS NULL THEN
    RETURN NEW;
  END IF;

  UPDATE public.members
  SET
    package_id                = v_pkg.id,
    package_name              = v_pkg.name,
    sessions_remaining        = v_pkg.sessions,
    freeze_days_remaining     = v_pkg.freeze_days,
    invitations_remaining     = v_pkg.invitations,
    inbody_sessions_remaining = v_pkg.inbody_sessions,
    expires_at                = now() + (v_pkg.validity_days || ' days')::interval,
    status                    = 'active'
  WHERE uuid = NEW.member_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_invoice_created
  AFTER INSERT ON public.invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_invoice_created();

-- ── 4. Fix check_in_member function (display_id was removed in 005) ──

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
  v_new_remaining int;
  v_action     text;
  v_action_type text;
  v_details    text;
BEGIN
  -- Lock the member row
  SELECT * INTO v_member FROM public.members WHERE uuid = p_member_id FOR UPDATE;

  IF v_member IS NULL THEN
    RAISE EXCEPTION 'Member not found: %', p_member_id;
  END IF;

  -- Decrement sessions (floor at 0, unlimited stays at 999)
  IF v_member.sessions_remaining = 999 THEN
    v_new_remaining := 999;
  ELSE
    v_new_remaining := greatest(0, v_member.sessions_remaining - 1);
  END IF;

  -- Update member
  UPDATE public.members
  SET sessions_remaining = v_new_remaining,
      status = CASE
        WHEN v_new_remaining <= 2 AND v_new_remaining != 999 THEN 'expiring_soon'
        ELSE status
      END
  WHERE uuid = p_member_id;

  -- Build audit entry
  IF p_is_override THEN
    v_action := 'Override Check-in';
    v_action_type := 'override_checkin';
    v_details := format('Allowed %sexpired member #%s (%s) to attend',
      CASE WHEN p_pay_later THEN '(Pay Later) ' ELSE '' END,
      v_member.id, v_member.name);
  ELSE
    v_action := 'Check-in';
    v_action_type := 'checkin';
    v_details := format('Normal check-in: #%s (%s), session deducted (%s remaining)',
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

-- ── 5. Cleanup function for expired subscriptions ─────────────

CREATE OR REPLACE FUNCTION public.cleanup_expired_subscriptions()
RETURNS void AS $$
BEGIN
  UPDATE public.members
  SET
    package_id = null,
    package_name = 'None',
    sessions_remaining = 0,
    freeze_days_remaining = 0,
    invitations_remaining = 0,
    inbody_sessions_remaining = 0,
    status = 'expired'
  WHERE expires_at < now() AND status != 'expired';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;