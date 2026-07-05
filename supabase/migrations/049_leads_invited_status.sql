-- ============================================================
-- 049_leads_invited_status.sql
-- Add 'Invited' to leads status constraint
-- ============================================================

-- 1. Drop existing constraint (the name might be 'leads_status_check' or system generated)
-- To be safe, we dynamically drop the constraint on the status column
DO $$
DECLARE
    constraint_name text;
BEGIN
    SELECT con.conname INTO constraint_name
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_attribute attr ON attr.attrelid = con.conrelid AND attr.attnum = ANY(con.conkey)
    WHERE rel.relname = 'leads' AND attr.attname = 'status';

    IF constraint_name IS NOT NULL THEN
        EXECUTE 'ALTER TABLE public.leads DROP CONSTRAINT ' || constraint_name;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- 2. Add the new constraint with 'Invited' included
ALTER TABLE public.leads ADD CONSTRAINT leads_status_check 
CHECK (status IN ('New', 'Contacted', 'Follow-up', 'Converted', 'Invited', 'Lost'));
