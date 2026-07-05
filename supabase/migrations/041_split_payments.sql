-- ── Migration: Split Payments ──

-- Add the split_payments JSONB column
ALTER TABLE public.invoices ADD COLUMN split_payments jsonb;

-- Update the payment_method constraint to allow 'Split'
ALTER TABLE public.invoices DROP CONSTRAINT IF EXISTS invoices_payment_method_check;
ALTER TABLE public.invoices ADD CONSTRAINT invoices_payment_method_check 
  CHECK (payment_method IN ('Cash', 'Visa', 'InstaPay', 'Split'));
