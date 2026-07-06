-- ============================================================
-- 051_schema_phase2.sql
-- Phase 2 & 3 schema additions:
--   1. Fix: last_checkin column on members (fixes check-in crash)
--   2. PT flag on packages
--   3. PT session tracking on coaches
--   4. Substitute tracking on coach_check_ins
--   5. Employees table
--   6. Finance base balances table
--   7. Invoice payment-completion records
-- ============================================================

-- ── 1. Fix check-in crash: add last_checkin to members ────────
ALTER TABLE public.members
  ADD COLUMN IF NOT EXISTS last_checkin timestamptz;

-- ── 2. PT flag on packages ─────────────────────────────────────
ALTER TABLE public.packages
  ADD COLUMN IF NOT EXISTS is_pt boolean NOT NULL DEFAULT false;

-- ── 3. PT session tracking on coaches ──────────────────────────
ALTER TABLE public.coaches
  ADD COLUMN IF NOT EXISTS pt_sessions_done int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pt_rate numeric NOT NULL DEFAULT 250;

-- ── 3.5. Lead took_invitation ───────────────────────────────────
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS took_invitation boolean NOT NULL DEFAULT false;

-- ── 4. Coach check-in: substitute + session type ───────────────
ALTER TABLE public.coach_check_ins
  ADD COLUMN IF NOT EXISTS is_substitute boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS original_coach_id uuid REFERENCES public.coaches(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS session_type text NOT NULL DEFAULT 'group',
  ADD COLUMN IF NOT EXISTS member_uuid uuid REFERENCES public.members(uuid) ON DELETE SET NULL;

-- Drop and recreate unique constraint to allow PT sessions (same coach, same class, same day allowed for PT)
ALTER TABLE public.coach_check_ins
  DROP CONSTRAINT IF EXISTS coach_check_ins_coach_id_date_class_key;

ALTER TABLE public.coach_check_ins
  ADD CONSTRAINT coach_check_ins_coach_class_date_type_key 
  UNIQUE (coach_id, check_in_date, class_id, session_type, member_uuid);

-- ── 5. Employees table ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.employees (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name           text NOT NULL,
  phone          text NOT NULL DEFAULT '',
  department     text NOT NULL DEFAULT 'General',
  rate           numeric NOT NULL DEFAULT 0, -- monthly salary
  work_days      text[] NOT NULL DEFAULT '{}',
  shift_start    time,
  shift_end      time,
  late_threshold_minutes int NOT NULL DEFAULT 15,
  deduction_per_minute   numeric NOT NULL DEFAULT 0,
  created_at     timestamptz NOT NULL DEFAULT now()
);

-- Employee check-ins (HR attendance)
CREATE TABLE IF NOT EXISTS public.employee_checkins (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id    uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  checked_in_at  timestamptz NOT NULL DEFAULT now(),
  late_minutes   int NOT NULL DEFAULT 0,
  deduction      numeric NOT NULL DEFAULT 0,
  notes          text,
  created_at     timestamptz NOT NULL DEFAULT now()
);

-- Employee manual deductions
CREATE TABLE IF NOT EXISTS public.employee_deductions (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id    uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  amount         numeric NOT NULL,
  reason         text NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now()
);

-- ── 6. Finance base balances (opening balances per month) ───────
CREATE TABLE IF NOT EXISTS public.finance_base_balances (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  month      int NOT NULL,  -- 0-indexed (0 = Jan)
  year       int NOT NULL,
  cash       numeric NOT NULL DEFAULT 0,
  visa       numeric NOT NULL DEFAULT 0,
  instapay   numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (month, year)
);

-- ── 7. Invoice partial payment records ──────────────────────────
-- We track additional payments against an existing invoice
-- without triggering the subscription activation trigger
CREATE TABLE IF NOT EXISTS public.invoice_payments (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_uuid   uuid NOT NULL REFERENCES public.invoices(uuid) ON DELETE CASCADE,
  amount         numeric NOT NULL,
  payment_method text NOT NULL DEFAULT 'Cash'
    CHECK (payment_method IN ('Cash', 'Visa', 'InstaPay', 'Split')),
  split_payments jsonb,
  paid_at        timestamptz NOT NULL DEFAULT now(),
  recorded_by    uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  notes          text,
  created_at     timestamptz NOT NULL DEFAULT now()
);

-- ── 8. Update check_in_member to set last_checkin ──────────────
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

  -- Update member (includes last_checkin now)
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

  -- Insert audit log
  INSERT INTO public.audit_logs (action, action_type, performed_by, performer_name, member_id, member_name, details)
  VALUES (v_action, v_action_type, p_performed_by, p_performer_name, p_member_id, v_member.name, v_details);

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── 9. RLS: open new tables ─────────────────────────────────────
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all_employees" ON public.employees FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE public.employee_checkins ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all_emp_checkins" ON public.employee_checkins FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE public.employee_deductions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all_emp_deductions" ON public.employee_deductions FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE public.finance_base_balances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all_finance_base" ON public.finance_base_balances FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE public.invoice_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all_invoice_payments" ON public.invoice_payments FOR ALL USING (true) WITH CHECK (true);
