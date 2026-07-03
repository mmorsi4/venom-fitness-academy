-- ============================================================
-- 021_drop_legacy_role_column.sql
-- Drop the legacy 'role' column from profiles now that
-- the user_roles table is fully implemented.
-- ============================================================

-- 1. Drop the column
ALTER TABLE public.profiles DROP COLUMN IF EXISTS role;

-- 2. Update the trigger to remove the reference to the role column
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  v_role_id uuid;
  v_role_name text;
BEGIN
  -- Determine initial role name (default 'reception')
  v_role_name := coalesce(new.raw_user_meta_data->>'role', 'reception');
  
  -- Insert into profiles without the role column
  insert into public.profiles (id, email, name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1))
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
