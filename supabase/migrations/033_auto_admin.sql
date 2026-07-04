-- ============================================================
-- 033_auto_admin.sql
-- Automatically make the first registered user an Admin
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  v_role_id uuid;
  v_role_name text;
  v_user_count int;
BEGIN
  -- Check if this is the very first user in the database
  SELECT count(*) INTO v_user_count FROM public.profiles;

  IF v_user_count = 0 THEN
    v_role_name := 'admin';
  ELSE
    -- Determine initial role name (default 'reception')
    v_role_name := coalesce(new.raw_user_meta_data->>'role', 'reception');
  END IF;
  
  -- Insert into profiles (keep the legacy role field for now)
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
