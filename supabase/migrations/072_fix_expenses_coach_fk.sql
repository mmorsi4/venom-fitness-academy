ALTER TABLE public.expenses DROP CONSTRAINT IF EXISTS expenses_coach_id_fkey;
ALTER TABLE public.expenses ADD CONSTRAINT expenses_coach_id_fkey FOREIGN KEY (coach_id) REFERENCES public.coaches(id) ON DELETE CASCADE;
