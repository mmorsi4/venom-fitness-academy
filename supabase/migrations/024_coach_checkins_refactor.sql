-- ============================================================
-- 024_coach_checkins_refactor.sql
-- Overhaul coach check-ins to support specific classes and 
-- remove the static sessions_this_month tracker.
-- ============================================================

-- 1. Add class_id to coach_check_ins
ALTER TABLE public.coach_check_ins 
ADD COLUMN class_id uuid REFERENCES public.classes(id) ON DELETE CASCADE;

-- 2. Drop the old unique constraint (1 check-in per day)
ALTER TABLE public.coach_check_ins 
DROP CONSTRAINT IF EXISTS coach_check_ins_coach_id_check_in_date_key;

-- 3. Add the new unique constraint (1 check-in per class per day)
-- We use NULLS NOT DISTINCT if possible, but standard UNIQUE is fine for now
ALTER TABLE public.coach_check_ins 
ADD CONSTRAINT coach_check_ins_coach_id_date_class_key UNIQUE (coach_id, check_in_date, class_id);

-- 4. Drop the obsolete sessions_this_month column from coaches
ALTER TABLE public.coaches 
DROP COLUMN IF EXISTS sessions_this_month;
