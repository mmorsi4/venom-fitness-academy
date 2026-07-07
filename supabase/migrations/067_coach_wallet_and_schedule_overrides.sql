-- 067_coach_wallet_and_schedule_overrides.sql

-- 1. Add advance_balance to coaches
ALTER TABLE public.coaches
ADD COLUMN advance_balance numeric not null default 0;

-- 2. Create class_schedule_overrides table
CREATE TABLE public.class_schedule_overrides (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  original_date date not null,
  status text not null check (status in ('cancelled', 'postponed')),
  new_date date,
  new_time text,
  created_at timestamptz not null default now(),
  unique (class_id, original_date)
);

-- Enable RLS and grant permissions
ALTER TABLE public.class_schedule_overrides DISABLE ROW LEVEL SECURITY;
GRANT ALL ON TABLE public.class_schedule_overrides TO anon, authenticated, service_role;
