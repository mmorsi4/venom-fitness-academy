-- Migration 036: Add interest and inviting_member_id to leads

ALTER TABLE public.leads
ADD COLUMN IF NOT EXISTS interest text,
ADD COLUMN IF NOT EXISTS inviting_member_id uuid references public.members(id) on delete set null;
