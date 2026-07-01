-- ============================================================
-- 006_member_sport_class.sql
-- Add sport field to members
-- ============================================================

ALTER TABLE public.members
  ADD COLUMN IF NOT EXISTS sport text;
