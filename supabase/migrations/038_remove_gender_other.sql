-- Remove the 'other' constraint from gender in the members table

-- Update any existing members who might have 'other' to null or 'male'/'female'. We'll just set it to null for safety if they have 'other', or default to 'male'. Let's set to null since we're removing it.
UPDATE public.members SET gender = NULL WHERE gender = 'other';

-- We need to drop the old check constraint and recreate it without 'other'
ALTER TABLE public.members DROP CONSTRAINT IF EXISTS members_gender_check;
ALTER TABLE public.members ADD CONSTRAINT members_gender_check CHECK (gender IN ('male', 'female'));
