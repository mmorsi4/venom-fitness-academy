-- 068_missed_day_deduction.sql
ALTER TABLE public.employees 
ADD COLUMN IF NOT EXISTS missed_day_deduction numeric NOT NULL DEFAULT 0;
