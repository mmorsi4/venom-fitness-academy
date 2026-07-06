DO $$
DECLARE
    fk_name text;
BEGIN
    SELECT constraint_name INTO fk_name
    FROM information_schema.table_constraints
    WHERE table_name = 'coach_deductions' AND constraint_type = 'FOREIGN KEY'
    LIMIT 1;

    IF fk_name IS NOT NULL THEN
        EXECUTE 'ALTER TABLE public.coach_deductions DROP CONSTRAINT ' || fk_name;
    END IF;
END $$;

ALTER TABLE public.coach_deductions
ADD CONSTRAINT coach_deductions_coach_id_fkey
FOREIGN KEY (coach_id) REFERENCES public.coaches(id) ON DELETE CASCADE;
