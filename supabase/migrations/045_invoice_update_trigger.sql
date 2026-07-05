-- =====================================================================
-- MIGRATION: 045_invoice_update_trigger.sql
-- Description: Trigger to handle updates to invoices, ensuring member balances
-- are correctly adjusted if the package or member is changed on an applied invoice.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.handle_invoice_updated()
RETURNS trigger AS $$
DECLARE
  v_old_pkg public.packages%rowtype;
  v_new_pkg public.packages%rowtype;
  v_old_member public.members%rowtype;
  v_new_member public.members%rowtype;
BEGIN
  -- We only care if the old or new invoice is/was applied
  IF OLD.is_applied = false AND NEW.is_applied = false THEN
    RETURN NEW;
  END IF;

  -- 1. Revert OLD invoice effects if it was applied
  IF OLD.is_applied = true AND OLD.package_id IS NOT NULL THEN
    SELECT * INTO v_old_pkg FROM public.packages WHERE id = OLD.package_id;
    SELECT * INTO v_old_member FROM public.members WHERE uuid = OLD.member_id;
    
    IF v_old_pkg IS NOT NULL AND v_old_member IS NOT NULL THEN
      -- Revert
      UPDATE public.members
      SET
        sessions_remaining        = GREATEST(0, sessions_remaining - v_old_pkg.sessions),
        freeze_days_remaining     = GREATEST(0, freeze_days_remaining - v_old_pkg.freeze_days),
        invitations_remaining     = GREATEST(0, invitations_remaining - v_old_pkg.invitations),
        inbody_sessions_remaining = GREATEST(0, inbody_sessions_remaining - v_old_pkg.inbody_sessions)
      WHERE uuid = OLD.member_id;
    END IF;
  END IF;

  -- 2. Apply NEW invoice effects if it should be applied
  IF NEW.activation_date <= now() THEN
    NEW.is_applied := true;
  ELSE
    NEW.is_applied := false;
  END IF;

  IF NEW.is_applied = true AND NEW.package_id IS NOT NULL THEN
    SELECT * INTO v_new_pkg FROM public.packages WHERE id = NEW.package_id;
    
    IF v_new_pkg IS NOT NULL THEN
      UPDATE public.members
      SET
        package_id                = v_new_pkg.id,
        package_name              = v_new_pkg.name,
        sessions_remaining        = sessions_remaining + v_new_pkg.sessions,
        freeze_days_remaining     = freeze_days_remaining + v_new_pkg.freeze_days,
        invitations_remaining     = invitations_remaining + v_new_pkg.invitations,
        inbody_sessions_remaining = inbody_sessions_remaining + v_new_pkg.inbody_sessions,
        expires_at                = NEW.activation_date + (v_new_pkg.validity_days || ' days')::interval,
        status                    = 'active'
      WHERE uuid = NEW.member_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_invoice_updated_before ON public.invoices;
CREATE TRIGGER on_invoice_updated_before
  BEFORE UPDATE OF member_id, package_id, activation_date ON public.invoices
  FOR EACH ROW
  WHEN (OLD.member_id IS DISTINCT FROM NEW.member_id OR 
        OLD.package_id IS DISTINCT FROM NEW.package_id OR 
        OLD.activation_date IS DISTINCT FROM NEW.activation_date)
  EXECUTE FUNCTION public.handle_invoice_updated();
