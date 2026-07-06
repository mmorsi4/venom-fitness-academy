-- Add expense_uuid to coach_check_ins to track which expense paid for which sessions
ALTER TABLE public.coach_check_ins ADD COLUMN IF NOT EXISTS expense_uuid uuid REFERENCES public.expenses(uuid) ON DELETE SET NULL;

-- Add notes to invoices
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS notes text DEFAULT '';
