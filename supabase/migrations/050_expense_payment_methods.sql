-- ============================================================
-- 050_expense_payment_methods.sql
-- Add payment methods and split payments to expenses
-- ============================================================

ALTER TABLE public.expenses ADD COLUMN payment_method text not null default 'Cash';
ALTER TABLE public.expenses ADD CONSTRAINT expenses_payment_method_check 
  CHECK (payment_method IN ('Cash', 'Visa', 'InstaPay', 'Split'));
ALTER TABLE public.expenses ADD COLUMN split_payments jsonb;