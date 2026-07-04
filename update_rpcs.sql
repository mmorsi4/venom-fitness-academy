CREATE OR REPLACE FUNCTION public.handle_invoice_created()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
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
    status                    = 'active',
    class_id                  = COALESCE(NEW.class_id, v_member.class_id)
  WHERE uuid = NEW.member_id;

  NEW.is_applied := true;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.activate_pending_subscriptions()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
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
          status                    = 'active',
          class_id                  = COALESCE(v_inv.class_id, v_member.class_id)
        WHERE uuid = v_inv.member_id;
      END IF;
    END IF;
    
    UPDATE public.invoices
    SET is_applied = true
    WHERE uuid = v_inv.uuid;
  END LOOP;
END;
$function$;
