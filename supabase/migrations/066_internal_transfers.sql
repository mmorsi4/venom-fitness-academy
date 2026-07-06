CREATE TABLE public.internal_transfers (
  id uuid primary key default gen_random_uuid(),
  from_account text not null,
  to_account text not null,
  amount numeric not null,
  date timestamptz not null default now(),
  note text,
  created_at timestamptz not null default now()
);

ALTER TABLE public.internal_transfers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all access for authenticated users" ON public.internal_transfers FOR ALL TO authenticated USING (true) WITH CHECK (true);

GRANT ALL ON TABLE public.internal_transfers TO anon, authenticated, service_role;
