CREATE TABLE IF NOT EXISTS public.coach_deductions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  coach_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  amount numeric NOT NULL DEFAULT 0,
  forgiven_sessions integer NOT NULL DEFAULT 0,
  reason text,
  date timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.coach_deductions ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all authenticated users
CREATE POLICY "Allow all authenticated users to read and write coach_deductions"
ON public.coach_deductions
FOR ALL
USING (auth.role() = 'authenticated')
WITH CHECK (auth.role() = 'authenticated');
