-- migration 015_remove_totals.sql

-- Add the new freeze_days_remaining column
ALTER TABLE public.members ADD COLUMN freeze_days_remaining int not null default 7;

-- Backfill data: remaining = max(0, total - used)
UPDATE public.members 
SET freeze_days_remaining = GREATEST(0, freeze_days_total - freeze_days_used);

-- Drop the old columns
ALTER TABLE public.members DROP COLUMN freeze_days_used;
ALTER TABLE public.members DROP COLUMN freeze_days_total;
ALTER TABLE public.members DROP COLUMN total_sessions;
