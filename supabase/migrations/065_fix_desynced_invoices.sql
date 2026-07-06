-- 065_fix_desynced_invoices.sql
-- Sync the most recent paid/partial invoice's sessions_remaining with the member's current sessions_remaining.
-- This fixes invoices that were stuck at 0 due to the manual sync bug, while the member had > 0 sessions.

UPDATE public.invoices i
SET sessions_remaining = m.sessions_remaining
FROM public.members m,
     (
       SELECT id, ROW_NUMBER() OVER (PARTITION BY member_id ORDER BY created_at DESC) as rn
       FROM public.invoices
       WHERE status IN ('paid', 'partial')
     ) latest
WHERE i.member_id = m.uuid
  AND i.id = latest.id
  AND latest.rn = 1
  AND i.sessions_remaining IS DISTINCT FROM m.sessions_remaining
  AND m.sessions_remaining > 0;
