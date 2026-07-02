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
  source             text not null default 'Walk-in',
  status             text not null default 'active'
                     check (status in ('active', 'expired', 'expiring_soon', 'has_debt')),
  sessions_remaining int not null default 0,
  expires_at         timestamptz not null default now(),
  member_since       timestamptz not null default now(),
  package_name       text not null default 'None',
  assigned_coach_id  uuid references public.coaches(id) on delete set null,
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
  created_at    timestamptz not null default now()
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

-- ── Gym Sessions (schedule) ─────────────────────────────────

create table public.gym_sessions (
  id               uuid primary key default gen_random_uuid(),
  name             text not null,
  day_of_week      text not null,
  time             text not null,
  capacity         int not null default 20,
  coach_id         uuid references public.coaches(id) on delete set null,
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
