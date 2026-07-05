-- Drop the commission_base column from coaches
ALTER TABLE public.coaches DROP COLUMN IF EXISTS commission_base;

-- Update any existing coaches that had 'commission' payment_type to 'salary'
UPDATE public.coaches SET payment_type = 'salary' WHERE payment_type = 'commission';

-- We need to drop the old check constraint and recreate it without 'commission'
ALTER TABLE public.coaches DROP CONSTRAINT IF EXISTS coaches_payment_type_check;
ALTER TABLE public.coaches ADD CONSTRAINT coaches_payment_type_check CHECK (payment_type IN ('salary', 'per_session'));