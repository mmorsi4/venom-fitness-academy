-- Remove the old sequence default
ALTER TABLE public.invoices ALTER COLUMN id DROP DEFAULT;

-- Function to set invoice ID to the max number + 1 if not provided
CREATE OR REPLACE FUNCTION public.set_invoice_id()
RETURNS trigger AS $$
DECLARE
  v_max_id int;
BEGIN
  IF NEW.id IS NULL OR NEW.id = '' THEN
    -- Acquire transaction-level advisory lock to prevent concurrent inserts from generating the same ID
    PERFORM pg_advisory_xact_lock('invoices'::regclass::oid::int);
    
    SELECT max(NULLIF(regexp_replace(id, '\D', '', 'g'), '')::int) INTO v_max_id FROM public.invoices;
    IF v_max_id IS NULL THEN
      v_max_id := 1000;
    END IF;
    NEW.id := (v_max_id + 1)::text;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_set_invoice_id ON public.invoices;
CREATE TRIGGER trg_set_invoice_id
  BEFORE INSERT ON public.invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.set_invoice_id();

-- Update existing records to remove the 'INV-' prefix
UPDATE public.invoices SET id = replace(id, 'INV-', '') WHERE id LIKE 'INV-%';
