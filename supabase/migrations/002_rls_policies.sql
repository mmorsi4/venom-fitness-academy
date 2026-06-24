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
alter table public.coach_check_ins disable row level security;
alter table public.gym_sessions disable row level security;

-- 2. Grant all privileges to the Supabase client roles
-- This ensures that your frontend application (which connects 
-- via the anon/authenticated key) has full permission to read/write.
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon;

GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;

GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
