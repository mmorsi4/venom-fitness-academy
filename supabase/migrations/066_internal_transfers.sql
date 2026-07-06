CREATE TABLE public.internal_transfers (
  id uuid primary key default gen_random_uuid(),
  from_account text not null,
  to_account text not null,
  amount numeric not null,
  date timestamptz not null default now(),
  note text,
  created_at timestamptz not null default now()
);

-- Disable RLS to match the rest of the application
ALTER TABLE public.internal_transfers DISABLE ROW LEVEL SECURITY;

GRANT ALL ON TABLE public.internal_transfers TO anon, authenticated, service_role;
