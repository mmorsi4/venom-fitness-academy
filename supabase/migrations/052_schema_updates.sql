-- 052_schema_updates.sql

-- 1. Add settled_by_invoice_id to invoices
ALTER TABLE public.invoices 
ADD COLUMN IF NOT EXISTS settled_by_invoice_id uuid REFERENCES public.invoices(uuid) ON DELETE SET NULL;

-- 2. Add coach_id to expenses
ALTER TABLE public.expenses
ADD COLUMN IF NOT EXISTS coach_id uuid REFERENCES public.employees(id) ON DELETE SET NULL;

-- 3. Add took_invitation to leads
ALTER TABLE public.leads
ADD COLUMN IF NOT EXISTS took_invitation boolean DEFAULT false;
