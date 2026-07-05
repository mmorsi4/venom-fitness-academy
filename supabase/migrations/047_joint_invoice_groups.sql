CREATE TABLE public.joint_invoice_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.invoices
ADD COLUMN joint_invoice_group_id uuid REFERENCES public.joint_invoice_groups(id) ON DELETE SET NULL;
GRANT ALL ON TABLE public.joint_invoice_groups TO anon, authenticated, service_role;
