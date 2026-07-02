-- migration 017_fix_invoice_trigger.sql

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
    expires_at                = NEW.created_at + (v_pkg.validity_days || ' days')::interval,
    status                    = 'active'
  WHERE uuid = NEW.member_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
