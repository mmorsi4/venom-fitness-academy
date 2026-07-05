-- ── Trigger: auto-rollback member subscription on invoice deletion ──

CREATE OR REPLACE FUNCTION public.handle_invoice_deleted()
RETURNS trigger AS $$
DECLARE
  v_pkg public.packages%rowtype;
  v_member public.members%rowtype;
  v_latest_inv public.invoices%rowtype;
BEGIN
  -- 1. Only process if the invoice was actually applied
  IF OLD.is_applied = false THEN
    RETURN OLD;
  END IF;

  -- 2. Only process if the invoice had a package
  IF OLD.package_id IS NULL THEN
    RETURN OLD;
  END IF;

  SELECT * INTO v_pkg FROM public.packages WHERE id = OLD.package_id;
  IF v_pkg IS NULL THEN
    RETURN OLD;
  END IF;

  SELECT * INTO v_member FROM public.members WHERE uuid = OLD.member_id;
  IF v_member IS NULL THEN
    RETURN OLD;
  END IF;

  -- 3. Determine if this invoice is the member's current/latest active subscription
  SELECT * INTO v_latest_inv
  FROM public.invoices
  WHERE member_id = OLD.member_id
    AND is_applied = true
    AND package_id IS NOT NULL
  ORDER BY activation_date DESC NULLS LAST, created_at DESC
  LIMIT 1;

  -- 4. If the invoice being deleted IS the latest applied invoice, roll back the balances
  IF v_latest_inv.uuid = OLD.uuid THEN
    UPDATE public.members
    SET
      sessions_remaining        = GREATEST(0, v_member.sessions_remaining - v_pkg.sessions),
      freeze_days_remaining     = GREATEST(0, v_member.freeze_days_remaining - v_pkg.freeze_days),
      invitations_remaining     = GREATEST(0, v_member.invitations_remaining - v_pkg.invitations),
      inbody_sessions_remaining = GREATEST(0, v_member.inbody_sessions_remaining - v_pkg.inbody_sessions),
      package_id                = NULL,
      package_name              = 'None',
      status                    = 'expired'
    WHERE uuid = OLD.member_id;
  END IF;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_invoice_deleted_before ON public.invoices;
CREATE TRIGGER on_invoice_deleted_before
  BEFORE DELETE ON public.invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_invoice_deleted();
