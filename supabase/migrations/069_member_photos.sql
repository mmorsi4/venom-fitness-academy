-- 069_member_photos.sql
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS photo_url text;
