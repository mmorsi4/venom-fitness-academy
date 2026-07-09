ALTER TABLE leads
ADD COLUMN converted_to_member_id UUID REFERENCES members(uuid) ON DELETE SET NULL,
ADD COLUMN converted_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
