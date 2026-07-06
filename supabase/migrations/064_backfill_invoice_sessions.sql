-- Backfill sessions_remaining on invoices that missed the initial update

-- 1. For all invoices with null sessions_remaining, if it is NOT the most recent paid invoice for a member, it is old/consumed, set to 0.
UPDATE public.invoices
SET sessions_remaining = 0
WHERE sessions_remaining IS NULL
  AND status IN ('paid', 'partial')
  AND id NOT IN (
    SELECT id
    FROM (
      SELECT id, ROW_NUMBER() OVER (PARTITION BY member_id ORDER BY created_at DESC) as rn
      FROM public.invoices
      WHERE status IN ('paid', 'partial')
    ) sub
    WHERE rn = 1
  );

-- 2. For the most recent paid invoice for each member, if it is null, sync it to the member's current sessions_remaining.
UPDATE public.invoices i
SET sessions_remaining = m.sessions_remaining
FROM public.members m
WHERE i.member_id = m.uuid
  AND i.sessions_remaining IS NULL
  AND i.status IN ('paid', 'partial');
