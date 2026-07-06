ALTER TABLE public.coaches ADD COLUMN IF NOT EXISTS pt_percentage integer default 100;

UPDATE public.coaches
SET rate = 0, payment_type = 'per_session'
WHERE payment_type = 'salary';
