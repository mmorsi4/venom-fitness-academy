-- ============================================================
-- 014_remove_member_source.sql
-- Remove source column from members table
-- ============================================================

ALTER TABLE public.members DROP COLUMN IF EXISTS source;
