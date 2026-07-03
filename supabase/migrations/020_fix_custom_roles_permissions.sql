-- ============================================================
-- 020_fix_custom_roles_permissions.sql
-- Fix 403 Forbidden errors by disabling RLS and granting permissions
-- to match the rest of the application.
-- ============================================================

-- Disable RLS to match the rest of the schema
ALTER TABLE public.roles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles DISABLE ROW LEVEL SECURITY;

-- Drop the restrictive policies added in 019
DROP POLICY IF EXISTS "Allow authenticated read access to roles" ON public.roles;
DROP POLICY IF EXISTS "Allow authenticated read access to user_roles" ON public.user_roles;

-- Grant all privileges to the Supabase client roles (anon & authenticated)
GRANT ALL ON TABLE public.roles TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.user_roles TO anon, authenticated, service_role;
