-- ============================================================
-- 019_custom_roles.sql
-- Create roles and user_roles tables to support dynamic RBAC
-- ============================================================

-- 1. Create `roles` table
CREATE TABLE IF NOT EXISTS public.roles (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  tabs text[] not null default '{}',
  created_at timestamptz not null default now()
);

-- 2. Create `user_roles` linking table
CREATE TABLE IF NOT EXISTS public.user_roles (
  user_id uuid not null references public.profiles(id) on delete cascade,
  role_id uuid not null references public.roles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, role_id)
);

-- 3. Insert default roles
INSERT INTO public.roles (name, description, tabs) VALUES
  ('admin', 'Admin - full access', ARRAY['/', '/checkin', '/members', '/subscriptions', '/invoices', '/discounts', '/finance', '/daily', '/reports', '/coaches', '/classes', '/sports', '/leads', '/liabilities', '/audit', '/users']),
  ('reception', 'Reception - operational tabs', ARRAY['/', '/checkin', '/members', '/invoices', '/finance', '/coaches', '/classes', '/sports', '/daily', '/liabilities']),
  ('sales', 'Sales - members & leads only', ARRAY['/', '/members', '/leads'])
ON CONFLICT (name) DO UPDATE SET tabs = EXCLUDED.tabs, description = EXCLUDED.description;

-- 4. Migrate existing profiles data into user_roles
DO $$
DECLARE
  r_admin uuid;
  r_reception uuid;
  r_sales uuid;
BEGIN
  SELECT id INTO r_admin FROM public.roles WHERE name = 'admin';
  SELECT id INTO r_reception FROM public.roles WHERE name = 'reception';
  SELECT id INTO r_sales FROM public.roles WHERE name = 'sales';

  -- Insert mappings
  INSERT INTO public.user_roles (user_id, role_id)
  SELECT p.id, r_admin
  FROM public.profiles p
  WHERE p.role = 'admin'
  ON CONFLICT DO NOTHING;

  INSERT INTO public.user_roles (user_id, role_id)
  SELECT p.id, r_reception
  FROM public.profiles p
  WHERE p.role = 'reception'
  ON CONFLICT DO NOTHING;

  INSERT INTO public.user_roles (user_id, role_id)
  SELECT p.id, r_sales
  FROM public.profiles p
  WHERE p.role = 'sales'
  ON CONFLICT DO NOTHING;
END $$;

-- 5. Drop the old check constraint on profiles.role (if it exists)
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;

-- 6. Update handle_new_user trigger to use user_roles
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  v_role_id uuid;
  v_role_name text;
BEGIN
  -- Determine initial role name (default 'reception')
  v_role_name := coalesce(new.raw_user_meta_data->>'role', 'reception');
  
  -- Insert into profiles (keep the legacy role field for now, just in case)
  insert into public.profiles (id, email, name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    v_role_name
  );
  
  -- Find the corresponding role ID
  SELECT id INTO v_role_id FROM public.roles WHERE name = v_role_name LIMIT 1;
  
  IF v_role_id IS NOT NULL THEN
    -- Insert into user_roles
    insert into public.user_roles (user_id, role_id)
    values (new.id, v_role_id);
  END IF;

  return new;
end;
$$ language plpgsql security definer;

-- Set up RLS for roles and user_roles
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated read access to roles"
ON public.roles FOR SELECT
TO authenticated USING (true);

CREATE POLICY "Allow authenticated read access to user_roles"
ON public.user_roles FOR SELECT
TO authenticated USING (true);
