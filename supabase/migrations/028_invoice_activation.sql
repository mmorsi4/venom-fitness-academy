-- ============================================================
-- 028_invoice_activation.sql
-- Add activation_date and is_applied to invoices
-- ============================================================

-- ── 1. Add columns ───────────────────────────────
ALTER TABLE public.invoices
ADD COLUMN IF NOT EXISTS activation_date timestamp with time zone,
ADD COLUMN IF NOT EXISTS is_applied boolean NOT NULL DEFAULT false;

-- Backfill existing invoices
UPDATE public.invoices
SET activation_date = created_at, is_applied = true
WHERE activation_date IS NULL;

-- ── 2. Update trigger ───────────────────────────────
DROP TRIGGER IF EXISTS on_invoice_created ON public.invoices;

CREATE OR REPLACE FUNCTION public.handle_invoice_created()
RETURNS trigger AS $$
DECLARE
  v_pkg public.packages%rowtype;
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

  -- Otherwise, apply now
  UPDATE public.members
  SET
    package_id                = v_pkg.id,
    package_name              = v_pkg.name,
    sessions_remaining        = v_pkg.sessions,
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

CREATE TRIGGER on_invoice_created_before
  BEFORE INSERT ON public.invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_invoice_created();

-- ── 3. Create activation RPC ───────────────────────────────
CREATE OR REPLACE FUNCTION public.activate_pending_subscriptions()
RETURNS void AS $$
DECLARE
  v_inv public.invoices%rowtype;
  v_pkg public.packages%rowtype;
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
      UPDATE public.members
      SET
        package_id                = v_pkg.id,
        package_name              = v_pkg.name,
        sessions_remaining        = v_pkg.sessions,
        freeze_days_remaining     = v_pkg.freeze_days,
        invitations_remaining     = v_pkg.invitations,
        inbody_sessions_remaining = v_pkg.inbody_sessions,
        expires_at                = v_inv.activation_date + (v_pkg.validity_days || ' days')::interval,
        status                    = 'active'
      WHERE uuid = v_inv.member_id;
    END IF;
    
    UPDATE public.invoices
    SET is_applied = true
    WHERE uuid = v_inv.uuid;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
