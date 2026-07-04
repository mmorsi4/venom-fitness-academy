ALTER TABLE invoices ADD COLUMN class_id uuid REFERENCES classes(id) ON DELETE SET NULL;
