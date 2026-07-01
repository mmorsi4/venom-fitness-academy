-- ============================================================
-- 005_rename_id.sql
-- Rename id to uuid, add numeric id
-- ============================================================

ALTER TABLE public.members RENAME COLUMN id TO uuid;
ALTER TABLE public.members ADD COLUMN id int;

-- Backfill existing members with sequential numbers based on display_id
-- Parse the numeric part of display_id (e.g., 'M001' → 1)
UPDATE public.members
SET id = CAST(REPLACE(display_id, 'M', '') AS int)
WHERE display_id LIKE 'M%' AND id IS NULL;

ALTER TABLE public.members DROP COLUMN display_id;

-- Create a sequence for future member numbers
CREATE SEQUENCE IF NOT EXISTS public.member_id_seq;
SELECT setval('member_id_seq', COALESCE((SELECT MAX(id) FROM public.members WHERE id > 0), 0));

-- Create index for id lookups
CREATE INDEX IF NOT EXISTS idx_members_id ON public.members(id);
