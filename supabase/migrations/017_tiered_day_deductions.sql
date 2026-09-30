-- ============================================================
-- 017_tiered_day_deductions.sql
-- Add tiered lateness day-deductions and monthly work-days to public.employees
-- ============================================================

ALTER TABLE public.employees 
ADD COLUMN IF NOT EXISTS deduction_15m_days numeric NOT NULL DEFAULT 0.25,
ADD COLUMN IF NOT EXISTS deduction_20m_days numeric NOT NULL DEFAULT 0.50,
ADD COLUMN IF NOT EXISTS deduction_30m_plus_days numeric NOT NULL DEFAULT 1.00,
ADD COLUMN IF NOT EXISTS work_days_per_month int NOT NULL DEFAULT 26;
