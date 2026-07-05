-- ── Migration: Expenses ID ──

-- Rename id to uuid
ALTER TABLE public.expenses RENAME COLUMN id TO uuid;

-- Add id text column
ALTER TABLE public.expenses ADD COLUMN id text;

-- Create sequence for default expense IDs
CREATE SEQUENCE IF NOT EXISTS expense_display_id_seq START 1;

-- Backfill existing IDs with sequence
UPDATE public.expenses SET id = nextval('expense_display_id_seq')::text WHERE id IS NULL;

-- Make id NOT NULL and UNIQUE
ALTER TABLE public.expenses ALTER COLUMN id SET NOT NULL;
ALTER TABLE public.expenses ADD CONSTRAINT expenses_id_key UNIQUE (id);

-- Trigger for auto-incrementing ID if not provided (custom ID)
CREATE OR REPLACE FUNCTION public.set_expense_id()
RETURNS trigger AS $$
DECLARE
  v_max_id int;
BEGIN
  IF NEW.id IS NULL OR NEW.id = '' THEN
    -- Find highest numeric ID currently used
    SELECT max(NULLIF(regexp_replace(id, '\D', '', 'g'), '')::int) INTO v_max_id FROM public.expenses;
    IF v_max_id IS NULL THEN
      NEW.id := '1';
    ELSE
      NEW.id := (v_max_id + 1)::text;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_expense_created_before ON public.expenses;
CREATE TRIGGER on_expense_created_before
  BEFORE INSERT ON public.expenses
  FOR EACH ROW
  EXECUTE FUNCTION public.set_expense_id();
