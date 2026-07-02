-- ============================================================
-- 001_initial_schema.sql
-- Core tables for the Venom Fitness Academy gym app
-- ============================================================

-- Enable UUID generation
create extension if not exists "pgcrypto";

-- ── Profiles (linked to auth.users) ─────────────────────────

create table public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  email      text not null,
  name       text not null,
  role       text not null default 'reception'
             check (role in ('admin', 'reception', 'sales')),
  created_at timestamptz not null default now()
);

-- Auto-create profile row when a new auth user is created
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'role', 'reception')
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── Coaches ─────────────────────────────────────────────────

create table public.coaches (
  id                 uuid primary key default gen_random_uuid(),
  name               text not null,
  phone              text not null default '',
  payment_type       text not null default 'salary'
                     check (payment_type in ('salary', 'per_session', 'commission')),
  rate               numeric not null default 0,
  commission_base    text check (commission_base in ('revenue', 'members')),
  sessions_this_month int not null default 0,
  created_at         timestamptz not null default now()
);

-- ── Members ─────────────────────────────────────────────────

-- Sequence for human-readable display IDs (M001, M002, ...)
create sequence public.member_display_id_seq start with 1;

create table public.members (
  id                 uuid primary key default gen_random_uuid(),
  display_id         text not null unique default ('M' || lpad(nextval('member_display_id_seq')::text, 3, '0')),
  name               text not null,
  phone              text not null,
  parent_phone       text,
  birth_date         date,
  gender             text check (gender in ('male', 'female', 'other')),
  status             text not null default 'active'
                     check (status in ('active', 'expired', 'expiring_soon', 'has_debt', 'new')),
  sessions_remaining int not null default 0,
  expires_at         timestamptz,
  member_since       timestamptz not null default now(),
  package_name       text not null default 'None',
  class_id           uuid references public.classes(id) on delete set null,
  freeze_days_remaining int not null default 7,
  created_at         timestamptz not null default now()
);

-- ── Subscription Packages ───────────────────────────────────

create table public.packages (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  sessions        int not null,
  price           numeric not null,
  validity_days   int not null default 30,
  freeze_days     int not null default 7,
  invitations     int not null default 0,
  inbody_sessions int not null default 0,
  created_at      timestamptz not null default now()
);

-- ── Discounts ───────────────────────────────────────────────

create table public.discounts (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  type          text not null default 'manual'
                check (type in ('seasonal', 'manual')),
  discount_type text not null default 'fixed'
                check (discount_type in ('fixed', 'percentage')),
  value         numeric not null default 0,
  active        boolean not null default true,
  created_at      timestamptz not null default now()
);

-- ── Invoices ────────────────────────────────────────────────

-- Sequence for human-readable invoice IDs
create sequence public.invoice_display_id_seq start with 1001;

create table public.invoices (
  id                   uuid primary key default gen_random_uuid(),
  display_id           text not null unique default ('INV-' || nextval('invoice_display_id_seq')::text),
  member_id            uuid not null references public.members(id) on delete cascade,
  member_name          text not null,
  package_id           uuid references public.packages(id) on delete set null,
  package_name         text not null default '',
  discount_id          uuid references public.discounts(id) on delete set null,
  discount_description text,
  discount_amount      numeric not null default 0,
  total_amount         numeric not null default 0,
  paid_amount          numeric not null default 0,
  status               text not null default 'unpaid'
                       check (status in ('paid', 'partial', 'unpaid')),
  payment_method       text not null default 'Cash'
                       check (payment_method in ('Cash', 'Visa', 'InstaPay')),
  created_at           timestamptz not null default now()
);

-- ── Discount ↔ Member (junction) ───────────────────────────

create table public.discount_members (
  discount_id uuid not null references public.discounts(id) on delete cascade,
  member_id   uuid not null references public.members(id) on delete cascade,
  primary key (discount_id, member_id)
);

-- ── Discount ↔ Invoice (junction) ──────────────────────────

create table public.discount_invoices (
  discount_id uuid not null references public.discounts(id) on delete cascade,
  invoice_id  uuid not null references public.invoices(id) on delete cascade,
  primary key (discount_id, invoice_id)
);

-- ── Leads (CRM) ────────────────────────────────────────────

create table public.leads (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  phone          text not null,
  source         text not null default 'Walk-in',
  status         text not null default 'New'
                 check (status in ('New', 'Contacted', 'Follow-up', 'Converted', 'Lost')),
  notes          text[] not null default '{}',
  follow_up_date timestamptz not null default (now() + interval '1 day'),
  assigned_to    uuid references public.profiles(id) on delete set null,
  calls_made     int not null default 0,
  created_at     timestamptz not null default now()
);

-- ── Liabilities ─────────────────────────────────────────────

create table public.liabilities (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null,
  description         text not null default '',
  type                text not null default 'installment'
                      check (type in ('installment', 'one_time')),
  total_amount        numeric not null default 0,
  paid_amount         numeric not null default 0,
  installment_amount  numeric not null default 0,
  frequency_days      int not null default 30,
  next_due_date       timestamptz not null default (now() + interval '30 days'),
  notify_days_before  int not null default 5,
  is_complete         boolean not null default false,
  created_at          timestamptz not null default now()
);

-- ── Expenses ────────────────────────────────────────────────

create table public.expenses (
  id           uuid primary key default gen_random_uuid(),
  category     text not null,
  amount       numeric not null default 0,
  description  text not null default '',
  date         timestamptz not null default now(),
  liability_id uuid references public.liabilities(id) on delete set null,
  created_at   timestamptz not null default now()
);

-- ── Audit Logs ──────────────────────────────────────────────

create table public.audit_logs (
  id             uuid primary key default gen_random_uuid(),
  action         text not null,
  action_type    text not null default 'other'
                 check (action_type in ('override_checkin', 'edit_payment', 'apply_discount', 'remove_discount', 'checkin', 'other')),
  performed_by   uuid references public.profiles(id) on delete set null,
  performer_name text not null default '',
  member_id      uuid references public.members(id) on delete set null,
  member_name    text,
  timestamp      timestamptz not null default now(),
  details        text not null default ''
);

-- ── Check-Ins (member attendance) ───────────────────────────

create table public.check_ins (
  id            uuid primary key default gen_random_uuid(),
  member_id     uuid not null references public.members(id) on delete cascade,
  checked_in_by uuid references public.profiles(id) on delete set null,
  is_override   boolean not null default false,
  pay_later     boolean not null default false,
  created_at    timestamptz not null default now()
);

-- ── Coach Check-Ins ─────────────────────────────────────────

create table public.coach_check_ins (
  id            uuid primary key default gen_random_uuid(),
  coach_id      uuid not null references public.coaches(id) on delete cascade,
  check_in_date date not null default current_date,
  created_at    timestamptz not null default now(),
  unique (coach_id, check_in_date)
);

-- ── Sports ──────────────────────────────────────────────────

create table public.sports (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  created_at  timestamptz not null default now()
);

-- ── Classes ─────────────────────────────────────────────────

create table public.classes (
  id               uuid primary key default gen_random_uuid(),
  name             text not null,
  sport_id         uuid references public.sports(id) on delete cascade,
  coach_id         uuid references public.coaches(id) on delete set null,
  schedules        jsonb not null default '[]'::jsonb,
  capacity         int not null default 20,
  attendance_count int not null default 0,
  created_at       timestamptz not null default now()
);

-- ── Indexes ─────────────────────────────────────────────────

create index idx_members_status on public.members(status);
create index idx_members_display_id on public.members(display_id);
create index idx_invoices_member on public.invoices(member_id);
create index idx_invoices_status on public.invoices(status);
create index idx_check_ins_member on public.check_ins(member_id);
create index idx_check_ins_date on public.check_ins(created_at);
create index idx_audit_logs_type on public.audit_logs(action_type);
create index idx_audit_logs_time on public.audit_logs(timestamp);
create index idx_expenses_date on public.expenses(date);
create index idx_leads_status on public.leads(status);
create index idx_liabilities_complete on public.liabilities(is_complete);
create index idx_coach_checkins_date on public.coach_check_ins(check_in_date);
-- ============================================================
-- 002_rls_policies.sql
-- (RLS REMOVED AS REQUESTED)
-- This file ensures Row Level Security is disabled and 
-- full permissions are granted to your Supabase frontend.
-- ============================================================

-- 1. Disable RLS on all tables
alter table public.profiles disable row level security;
alter table public.members disable row level security;
alter table public.packages disable row level security;
alter table public.invoices disable row level security;
alter table public.discounts disable row level security;
alter table public.discount_members disable row level security;
alter table public.discount_invoices disable row level security;
alter table public.coaches disable row level security;
alter table public.leads disable row level security;
alter table public.expenses disable row level security;
alter table public.liabilities disable row level security;
alter table public.audit_logs disable row level security;
alter table public.check_ins disable row level security;
alter table public.classes disable row level security;
alter table public.sports disable row level security;
alter table public.coach_check_ins disable row level security;

-- 2. Grant all privileges to the Supabase client roles
-- This ensures that your frontend application (which connects 
-- via the anon/authenticated key) has full permission to read/write.
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon;

GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;

GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
-- ============================================================
-- 003_functions.sql
-- Database functions for transactional business logic
-- ============================================================

-- ── check_in_member ─────────────────────────────────────────
-- Decrements sessions, updates status, logs audit, creates check_in row.
-- All in a single atomic transaction.

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
  IF NOT p_is_override AND v_member.sessions_remaining <= 0 THEN
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
      status = CASE
        WHEN v_new_remaining <= 2 AND v_new_remaining != 999 THEN 'expiring_soon'
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


-- ── pay_liability ───────────────────────────────────────────
-- Updates paid amount, marks complete if fully paid, advances due date.

create or replace function public.pay_liability(
  p_liability_id uuid,
  p_amount       numeric
)
returns void as $$
declare
  v_liability public.liabilities%rowtype;
  v_new_paid  numeric;
  v_complete  boolean;
  v_next_due  timestamptz;
begin
  select * into v_liability from public.liabilities where id = p_liability_id for update;

  if v_liability is null then
    raise exception 'Liability not found: %', p_liability_id;
  end if;

  v_new_paid := least(v_liability.paid_amount + p_amount, v_liability.total_amount);
  v_complete := v_new_paid >= v_liability.total_amount;

  -- Advance next due date for installments
  if not v_complete and v_liability.frequency_days > 0 then
    v_next_due := v_liability.next_due_date + (v_liability.frequency_days || ' days')::interval;
  else
    v_next_due := v_liability.next_due_date;
  end if;

  update public.liabilities
  set paid_amount   = v_new_paid,
      is_complete   = v_complete,
      next_due_date = v_next_due
  where id = p_liability_id;
end;
$$ language plpgsql security definer;

-- ============================================================
-- 004_seed_data.sql
-- Initial sample data
-- ============================================================

-- ── Packages ────────────────────────────────────────────────

insert into public.packages (id, name, sessions, price, validity_days, freeze_days, invitations, inbody_sessions) values
  ('00000000-0000-0000-0000-000000000b01', '8 Sessions',        8,  350, 30, 7, 1, 1),
  ('00000000-0000-0000-0000-000000000b02', '12 Sessions',       12, 480, 30, 7, 2, 2),
  ('00000000-0000-0000-0000-000000000b03', 'Unlimited Monthly', 999, 700, 30, 14, 3, 2),
  ('00000000-0000-0000-0000-000000000b04', '16 Sessions',       16,  580, 45, 10, 2, 2);

-- ── Members ─────────────────────────────────────────────────

insert into public.members (id, display_id, name, phone, parent_phone, birth_date, gender, status, sessions_remaining, expires_at, member_since, package_name, freeze_days_remaining) values
  ('00000000-0000-0000-0000-000000000a01', 'M001', 'Ahmed Al-Rashid', '055-0101', '055-0100', '1998-03-15', 'male',   'active',        8, now() + interval '14 days', now() - interval '60 days', '12 Sessions',       7),
  ('00000000-0000-0000-0000-000000000a02', 'M002', 'Nour Hassan',     '055-0102', '055-0109', '2002-07-22', 'female', 'expiring_soon', 2,  now() + interval '2 days',  now() - interval '30 days', '8 Sessions',        7),
  ('00000000-0000-0000-0000-000000000a03', 'M003', 'Kareem Mansour',  '055-0103', null,       '1995-11-08', 'male',   'expired',       0, now() - interval '5 days',  now() - interval '90 days', '12 Sessions',       7),
  ('00000000-0000-0000-0000-000000000a04', 'M004', 'Sara Al-Fahed',   '055-0104', '055-0111', '2001-01-30', 'female', 'has_debt',      10, now() + interval '25 days', now() - interval '5 days',  '12 Sessions',       7),
  ('00000000-0000-0000-0000-000000000a05', 'M005', 'Layla Ibrahim',   '055-0105', null,       '1999-05-14', 'female', 'active',        6,  now() + interval '18 days', now() - interval '15 days', '8 Sessions',        7),
  ('00000000-0000-0000-0000-000000000a06', 'M006', 'Omar Khalil',     '055-0106', null,       '1993-09-03', 'male',   'active',        999, now() + interval '20 days', now() - interval '10 days', 'Unlimited Monthly', 14),
  ('00000000-0000-0000-0000-000000000a07', 'M007', 'Rania Saleh',     '055-0107', '055-0120', '2003-12-19', 'female', 'expiring_soon', 1,  now() + interval '1 day',   now() - interval '45 days', '12 Sessions',       7),
  ('00000000-0000-0000-0000-000000000a08', 'M008', 'Hassan Yousef',   '055-0108', null,       '1990-06-25', 'male',   'expired',       2,  now() - interval '3 days',  now() - interval '75 days', '12 Sessions',       7);

-- Reset the sequence to continue after our seeded data
select setval('member_display_id_seq', 8);
select setval('invoice_display_id_seq', 1006);

-- ── Discounts ───────────────────────────────────────────────

insert into public.discounts (id, name, type, discount_type, value, active) values
  ('00000000-0000-0000-0000-000000000d01', 'Ramadan Special 2025', 'seasonal',   'percentage', 15, true),
  ('00000000-0000-0000-0000-000000000d02', 'Couples Discount',     'manual',     'fixed',      50, true);

insert into public.discount_members (discount_id, member_id) values
  ('00000000-0000-0000-0000-000000000d01', '00000000-0000-0000-0000-000000000a04'),
  ('00000000-0000-0000-0000-000000000d01', '00000000-0000-0000-0000-000000000a06'),
  ('00000000-0000-0000-0000-000000000d02', '00000000-0000-0000-0000-000000000a01'),
  ('00000000-0000-0000-0000-000000000d02', '00000000-0000-0000-0000-000000000a05');

-- ── Invoices ────────────────────────────────────────────────

insert into public.invoices (id, display_id, member_id, member_name, package_id, package_name, discount_id, discount_description, discount_amount, total_amount, paid_amount, status, payment_method, created_at) values
  ('00000000-0000-0000-0000-000000000e01', 'INV-1001', '00000000-0000-0000-0000-000000000a01', 'Ahmed Al-Rashid', '00000000-0000-0000-0000-000000000b02', '12 Sessions',       null,                                     null,                 0,  480, 480, 'paid',    'Visa',     now() - interval '15 days'),
  ('00000000-0000-0000-0000-000000000e02', 'INV-1002', '00000000-0000-0000-0000-000000000a04', 'Sara Al-Fahed',   '00000000-0000-0000-0000-000000000b02', '12 Sessions',       '00000000-0000-0000-0000-000000000d01',   'Ramadan promotion',  50, 480, 200, 'partial', 'Cash',     now() - interval '5 days'),
  ('00000000-0000-0000-0000-000000000e03', 'INV-1003', '00000000-0000-0000-0000-000000000a05', 'Layla Ibrahim',   '00000000-0000-0000-0000-000000000b01', '8 Sessions',        null,                                     null,                 0,  350, 350, 'paid',    'InstaPay', now() - interval '15 days'),
  ('00000000-0000-0000-0000-000000000e04', 'INV-1004', '00000000-0000-0000-0000-000000000a06', 'Omar Khalil',     '00000000-0000-0000-0000-000000000b03', 'Unlimited Monthly', '00000000-0000-0000-0000-000000000d01',   'Ramadan promotion',  70, 700, 0,   'unpaid',  'Cash',     now() - interval '10 days'),
  ('00000000-0000-0000-0000-000000000e05', 'INV-1005', '00000000-0000-0000-0000-000000000a07', 'Rania Saleh',     '00000000-0000-0000-0000-000000000b02', '12 Sessions',       null,                                     null,                 0,  480, 480, 'paid',    'Visa',     now() - interval '45 days'),
  ('00000000-0000-0000-0000-000000000e06', 'INV-1006', '00000000-0000-0000-0000-000000000a02', 'Nour Hassan',     '00000000-0000-0000-0000-000000000b01', '8 Sessions',        null,                                     null,                 0,  350, 350, 'paid',    'Cash',     now());

insert into public.discount_invoices (discount_id, invoice_id) values
  ('00000000-0000-0000-0000-000000000d01', '00000000-0000-0000-0000-000000000e02'),
  ('00000000-0000-0000-0000-000000000d01', '00000000-0000-0000-0000-000000000e04');

-- ── Leads ───────────────────────────────────────────────────

insert into public.leads (name, phone, source, status, notes, follow_up_date, calls_made) values
  ('David Miller',   '055-0201', 'Instagram', 'New',       '{}',                                                             now() + interval '1 day',  0),
  ('Emma Al-Sayed',  '055-0202', 'Walk-in',   'Contacted', '{"Interested in unlimited package","Wants trial session"}',       now() + interval '2 days', 2),
  ('Firas Nabil',    '055-0203', 'Facebook',  'Follow-up', '{"Budget concern","Offered discount"}',                           now(),                     3),
  ('Ghada Farouk',   '055-0204', 'Referral',  'Converted', '{"Converted to 12 sessions package"}',                            now() - interval '1 day',  1),
  ('Hana Ziad',      '055-0205', 'WhatsApp',  'Lost',      '{"Went with competitor"}',                                        now() - interval '5 days', 4);

-- ── Expenses ────────────────────────────────────────────────

insert into public.expenses (category, amount, description, date) values
  ('Salaries',         12000, 'Monthly coach salaries',      now() - interval '5 days'),
  ('Maintenance',       450,  'Treadmill belt replacement',  now() - interval '3 days'),
  ('Government Bills', 1200,  'Electricity bill',            now() - interval '8 days'),
  ('Purchases',         800,  'Resistance bands restock',    now());

-- ── Liabilities ─────────────────────────────────────────────

insert into public.liabilities (name, description, type, total_amount, paid_amount, installment_amount, frequency_days, next_due_date, notify_days_before, is_complete) values
  ('Commercial Treadmill Set', '8 commercial treadmills purchased for cardio zone', 'installment', 24000, 6000, 2000, 30, now() + interval '3 days',  5, false),
  ('AC System Upgrade',        'Full HVAC upgrade for main gym floor',              'one_time',    8500,  0,    8500, 0,  now() + interval '12 days', 5, false),
  ('Reception Renovation',     'New reception desk, chairs, and lighting',          'installment', 15000, 7500, 2500, 30, now() + interval '18 days', 5, false);

-- -- ── Gym Sessions ────────────────────────────────────────────

-- insert into public.gym_sessions (name, day_of_week, time, capacity, coach_id, attendance_count) values
--   ('Morning HIIT',      'Sunday',    '07:00', 20, '00000000-0000-0000-0000-000000000c01', 18),
--   ('Yoga Flow',         'Sunday',    '09:00', 15, '00000000-0000-0000-0000-000000000c02', 12),
--   ('Strength Training', 'Monday',    '07:00', 20, '00000000-0000-0000-0000-000000000c03', 15),
--   ('Spin Class',        'Monday',    '18:00', 20, '00000000-0000-0000-0000-000000000c01', 20),
--   ('Boxing',            'Tuesday',   '07:00', 12, '00000000-0000-0000-0000-000000000c03', 10),
--   ('Pilates',           'Wednesday', '09:00', 12, '00000000-0000-0000-0000-000000000c02', 8),
--   ('CrossFit',          'Thursday',  '07:00', 20, '00000000-0000-0000-0000-000000000c01', 16),
--   ('Evening HIIT',      'Thursday',  '19:00', 20, '00000000-0000-0000-0000-000000000c03', 19),
--   ('Morning HIIT',      'Saturday',  '08:00', 20, '00000000-0000-0000-0000-000000000c01', 14),
--   ('Open Gym',          'Friday',    '10:00', 30, '00000000-0000-0000-0000-000000000c02', 22);

-- ── Audit Logs (sample) ─────────────────────────────────────

insert into public.audit_logs (action, action_type, performer_name, member_id, member_name, timestamp, details) values
  ('Override Check-in', 'override_checkin', 'Admin',     '00000000-0000-0000-0000-000000000a03', 'Kareem Mansour',  now(),                      'Allowed expired member M003 (Kareem Mansour) to attend'),
  ('Edit Payment',      'edit_payment',     'Reception', null,                                    null,              now() - interval '1 hour',  'Updated INV-1002: partial payment recorded, amount 200 EGP'),
  ('Apply Discount',    'apply_discount',   'Admin',     null,                                    null,              now() - interval '1 day',   'Applied Ramadan Special 2025 (15%) to INV-1004'),
  ('Check-in',          'checkin',          'Reception', '00000000-0000-0000-0000-000000000a01', 'Ahmed Al-Rashid', now() - interval '30 min',  'Normal check-in: M001 (Ahmed Al-Rashid), session deducted (8 remaining)'),
  ('Check-in',          'checkin',          'Reception', '00000000-0000-0000-0000-000000000a05', 'Layla Ibrahim',   now() - interval '90 min',  'Normal check-in: M005 (Layla Ibrahim), session deducted (6 remaining)');
-- ============================================================
-- 005_rename_id.sql
-- Rename id to uuid, add numeric id
-- ============================================================

ALTER TABLE public.members RENAME COLUMN id TO uuid;
ALTER TABLE public.members ADD COLUMN id int;

-- Backfill existing members with sequential numbers based on display_id
-- Parse the numeric part of display_id (e.g., 'M001' → 1)
UPDATE public.members
SET id = CAST(REPLACE(display_id, 'M', '') AS int)
WHERE display_id LIKE 'M%' AND id IS NULL;

ALTER TABLE public.members DROP COLUMN display_id;

-- Create a sequence for future member numbers
CREATE SEQUENCE IF NOT EXISTS public.member_id_seq;
SELECT setval('member_id_seq', COALESCE((SELECT MAX(id) FROM public.members WHERE id > 0), 0));

-- Create index for id lookups
CREATE INDEX IF NOT EXISTS idx_members_id ON public.members(id);
-- ============================================================
-- 006_member_sport_class.sql
-- Add sport field to members
-- ============================================================

ALTER TABLE public.members
  ADD COLUMN IF NOT EXISTS sport text;
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
