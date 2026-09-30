-- ============================================================
-- 016_fix_handle_invoice_created.sql
-- Fix: Remove invalid references to non-existent columns (total_sessions,
-- freeze_days_total, freeze_days_used) on public.members and restore
-- the correct BEFORE INSERT trigger on invoices.
-- ============================================================

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
    NEW.activation_date := COALESCE(NEW.created_at, now());
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
    v_new_debt := COALESCE(v_member.session_debt, 0);
    IF COALESCE(v_member.sessions_remaining, 0) < 0 THEN
      v_new_debt := v_new_debt + ABS(v_member.sessions_remaining);
    END IF;
  ELSE
    v_new_debt := COALESCE(v_member.session_debt, 0);
    IF COALESCE(v_member.sessions_remaining, 0) < 0 THEN
      v_new_debt := v_new_debt + ABS(v_member.sessions_remaining);
    END IF;
    
    v_new_sessions := v_pkg.sessions - v_new_debt;
    v_new_debt := 0;
  END IF;

  -- Apply to member
  UPDATE public.members
  SET
    package_id                = v_pkg.id,
    package_name              = v_pkg.name,
    sessions_remaining        = v_new_sessions,
    session_debt              = v_new_debt,
    freeze_days_remaining     = COALESCE(v_pkg.freeze_days, 7),
    invitations_remaining     = COALESCE(v_pkg.invitations, 0),
    inbody_sessions_remaining = COALESCE(v_pkg.inbody_sessions, 0),
    expires_at                = NEW.activation_date + (COALESCE(v_pkg.validity_days, 30) || ' days')::interval,
    status                    = CASE WHEN NEW.status IN ('unpaid', 'partial') THEN 'has_debt' ELSE 'active' END
  WHERE uuid = NEW.member_id;

  NEW.is_applied := true;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Remove duplicate or old AFTER INSERT trigger, and ensure BEFORE INSERT trigger is used
DROP TRIGGER IF EXISTS on_invoice_created ON public.invoices;
DROP TRIGGER IF EXISTS on_invoice_created_before ON public.invoices;

CREATE TRIGGER on_invoice_created_before
  BEFORE INSERT ON public.invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_invoice_created();

-- ── Fix pay_liability for recurring & installment liabilities ─────────
CREATE OR REPLACE FUNCTION public.pay_liability(
  p_liability_id uuid,
  p_amount       numeric
)
RETURNS void AS $$
DECLARE
  v_liability public.liabilities%rowtype;
  v_new_paid  numeric;
  v_complete  boolean;
  v_next_due  timestamptz;
BEGIN
  SELECT * INTO v_liability FROM public.liabilities WHERE id = p_liability_id FOR UPDATE;

  IF v_liability IS NULL THEN
    RAISE EXCEPTION 'Liability not found: %', p_liability_id;
  END IF;

  v_new_paid := v_liability.paid_amount + p_amount;

  -- One-time payment completes when full amount reached
  IF v_liability.type = 'one_time' THEN
    v_complete := v_new_paid >= v_liability.total_amount;
    v_new_paid := LEAST(v_new_paid, v_liability.total_amount);
  -- Installment with multiple payments completes when total reached
  ELSIF v_liability.type = 'installment' AND v_liability.total_amount > v_liability.installment_amount THEN
    v_complete := v_new_paid >= v_liability.total_amount;
  ELSE
    -- Ongoing recurring liability (e.g. monthly rent/utilities) or single-installment repeat
    v_complete := false;
  END IF;

  -- Advance next due date for recurring / installment obligations
  IF v_liability.frequency_days > 0 THEN
    v_next_due := v_liability.next_due_date + (v_liability.frequency_days || ' days')::interval;
  ELSE
    v_next_due := v_liability.next_due_date;
  END IF;

  UPDATE public.liabilities
  SET paid_amount   = v_new_paid,
      is_complete   = v_complete,
      next_due_date = v_next_due
  WHERE id = p_liability_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
