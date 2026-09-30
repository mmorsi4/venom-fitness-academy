-- ============================================================
-- 015_member_fixes_and_employees.sql
-- 1. Fix members_status_check constraint to include 'inactive' and 'frozen'
-- 2. Improve handle_invoice_created trigger for upgrade session subtraction and correct expiry
-- 3. Create employees, attendance, lateness rules, deduction logs, and payroll settlement tables
-- ============================================================

-- 1. Fix members_status_check constraint
ALTER TABLE public.members DROP CONSTRAINT IF EXISTS members_status_check;
ALTER TABLE public.members ADD CONSTRAINT members_status_check 
  CHECK (status in ('active', 'inactive', 'expired', 'expiring_soon', 'has_debt', 'new', 'frozen'));

-- 2. Correct handle_invoice_created trigger
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

-- Re-create trigger as BEFORE INSERT
DROP TRIGGER IF EXISTS on_invoice_created ON public.invoices;
DROP TRIGGER IF EXISTS on_invoice_created_before ON public.invoices;

CREATE TRIGGER on_invoice_created_before
  BEFORE INSERT ON public.invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_invoice_created();

-- 3. Fix check_in_member to avoid false expired lockups when sessions are remaining
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
BEGIN
  -- Lock the member row
  SELECT * INTO v_member FROM public.members WHERE uuid = p_member_id FOR UPDATE;

  IF v_member IS NULL THEN
    RAISE EXCEPTION 'Member not found: %', p_member_id;
  END IF;

  -- Validation: Ensure sessions are available for non-override check-ins
  IF NOT p_is_override AND v_member.sessions_remaining <= 0 AND v_member.sessions_remaining != 999 THEN
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
      last_checkin = now(),
      status = CASE
        WHEN v_new_remaining <= 2 AND v_new_remaining != 999 AND v_new_remaining > 0 THEN 'expiring_soon'
        WHEN v_new_remaining = 0 AND v_new_remaining != 999 THEN 'expired'
        WHEN v_member.status = 'expired' AND (v_member.expires_at IS NULL OR v_member.expires_at > now()) AND v_new_remaining > 2 THEN 'active'
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
    v_details := format('Allowed %s(Pay Later) expired member %s (%s) to attend',
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


-- 4. EMPLOYEES TABLES
CREATE TABLE IF NOT EXISTS public.employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text,
  phone text NOT NULL,
  job_title text NOT NULL,
  salary_type text NOT NULL DEFAULT 'monthly' CHECK (salary_type IN ('monthly', 'hourly', 'daily')),
  base_salary numeric(10,2) NOT NULL DEFAULT 0,
  shift_start text NOT NULL DEFAULT '09:00',
  shift_end text NOT NULL DEFAULT '17:00',
  work_days_per_month int NOT NULL DEFAULT 26,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Lateness settings table (Single row configuration)
CREATE TABLE IF NOT EXISTS public.employee_lateness_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  grace_period_minutes int NOT NULL DEFAULT 15,
  deduction_15m_days numeric(5,2) NOT NULL DEFAULT 0.25, -- days cut if 15-19 min late
  deduction_20m_days numeric(5,2) NOT NULL DEFAULT 0.50, -- days cut if 20-29 min late
  deduction_30m_plus_days numeric(5,2) NOT NULL DEFAULT 1.00, -- days cut if 30+ min late
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Insert default lateness rule if empty
INSERT INTO public.employee_lateness_rules (grace_period_minutes, deduction_15m_days, deduction_20m_days, deduction_30m_plus_days)
SELECT 15, 0.25, 0.50, 1.00
WHERE NOT EXISTS (SELECT 1 FROM public.employee_lateness_rules);

-- Employee Attendance table
CREATE TABLE IF NOT EXISTS public.employee_attendances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  check_in_time timestamptz NOT NULL DEFAULT now(),
  check_out_time timestamptz,
  date date NOT NULL DEFAULT CURRENT_DATE,
  minutes_late int NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'on_time' CHECK (status IN ('on_time', 'late', 'excused', 'absent')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Employee Deductions Log table (Auto and Manual with Revert capabilities)
CREATE TABLE IF NOT EXISTS public.employee_deduction_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  attendance_id uuid REFERENCES public.employee_attendances(id) ON DELETE SET NULL,
  deduction_type text NOT NULL CHECK (deduction_type IN ('auto_late', 'manual', 'absence')),
  days_deducted numeric(5,2) NOT NULL DEFAULT 0,
  amount_deducted numeric(10,2) NOT NULL DEFAULT 0,
  reason text NOT NULL,
  date date NOT NULL DEFAULT CURRENT_DATE,
  is_reverted boolean NOT NULL DEFAULT false,
  reverted_by uuid,
  reverted_at timestamptz,
  revert_reason text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Employee Payroll Settlements table (Settles salary and records expense)
CREATE TABLE IF NOT EXISTS public.employee_payroll_settlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  employee_name text NOT NULL,
  period_month int NOT NULL,
  period_year int NOT NULL,
  base_salary numeric(10,2) NOT NULL,
  total_days_deducted numeric(5,2) NOT NULL DEFAULT 0,
  total_deductions_amount numeric(10,2) NOT NULL DEFAULT 0,
  bonus_amount numeric(10,2) NOT NULL DEFAULT 0,
  net_salary numeric(10,2) NOT NULL,
  expense_id text NOT NULL,
  payment_method text NOT NULL DEFAULT 'Cash' CHECK (payment_method IN ('Cash', 'Visa', 'InstaPay')),
  settled_by uuid,
  settled_at timestamptz NOT NULL DEFAULT now(),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS and public access policies
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_lateness_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_attendances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_deduction_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_payroll_settlements ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'employees' AND policyname = 'allow_all_employees') THEN
    CREATE POLICY allow_all_employees ON public.employees FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'employee_lateness_rules' AND policyname = 'allow_all_employee_rules') THEN
    CREATE POLICY allow_all_employee_rules ON public.employee_lateness_rules FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'employee_attendances' AND policyname = 'allow_all_employee_attendances') THEN
    CREATE POLICY allow_all_employee_attendances ON public.employee_attendances FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'employee_deduction_logs' AND policyname = 'allow_all_employee_deduction_logs') THEN
    CREATE POLICY allow_all_employee_deduction_logs ON public.employee_deduction_logs FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'employee_payroll_settlements' AND policyname = 'allow_all_employee_settlements') THEN
    CREATE POLICY allow_all_employee_settlements ON public.employee_payroll_settlements FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;
