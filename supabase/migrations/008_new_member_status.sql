-- Drop constraint and recreate with 'new' status
ALTER TABLE public.members DROP CONSTRAINT IF EXISTS members_status_check;
ALTER TABLE public.members ADD CONSTRAINT members_status_check CHECK (status in ('active', 'expired', 'expiring_soon', 'has_debt', 'new'));

-- Make expires_at nullable
ALTER TABLE public.members ALTER COLUMN expires_at DROP NOT NULL;
ALTER TABLE public.members ALTER COLUMN expires_at DROP DEFAULT;
