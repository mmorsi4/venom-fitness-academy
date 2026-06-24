-- ============================================================
-- 003_functions.sql
-- Database functions for transactional business logic
-- ============================================================

-- ── check_in_member ─────────────────────────────────────────
-- Decrements sessions, updates status, logs audit, creates check_in row.
-- All in a single atomic transaction.

create or replace function public.check_in_member(
  p_member_id      uuid,
  p_is_override    boolean default false,
  p_pay_later      boolean default false,
  p_performed_by   uuid default null,
  p_performer_name text default 'System'
)
returns void as $$
declare
  v_member     public.members%rowtype;
  v_new_remaining int;
  v_action     text;
  v_action_type text;
  v_details    text;
begin
  -- Lock the member row
  select * into v_member from public.members where id = p_member_id for update;

  if v_member is null then
    raise exception 'Member not found: %', p_member_id;
  end if;

  -- Decrement sessions (floor at 0, unlimited stays at 999)
  if v_member.sessions_remaining = 999 then
    v_new_remaining := 999;
  else
    v_new_remaining := greatest(0, v_member.sessions_remaining - 1);
  end if;

  -- Update member
  update public.members
  set sessions_remaining = v_new_remaining,
      status = case
        when v_new_remaining <= 2 and v_new_remaining != 999 then 'expiring_soon'
        else status
      end
  where id = p_member_id;

  -- Build audit entry
  if p_is_override then
    v_action := 'Override Check-in';
    v_action_type := 'override_checkin';
    v_details := format('Allowed %s(Pay Later) expired member %s (%s) to attend',
      case when p_pay_later then '(Pay Later) ' else '' end,
      v_member.display_id, v_member.name);
  else
    v_action := 'Check-in';
    v_action_type := 'checkin';
    v_details := format('Normal check-in: %s (%s), session deducted (%s remaining)',
      v_member.display_id, v_member.name, v_new_remaining);
  end if;

  -- Insert audit log
  insert into public.audit_logs (action, action_type, performed_by, performer_name, member_id, member_name, details)
  values (v_action, v_action_type, p_performed_by, p_performer_name, p_member_id, v_member.name, v_details);

  -- Insert check-in record
  insert into public.check_ins (member_id, checked_in_by, is_override, pay_later)
  values (p_member_id, p_performed_by, p_is_override, p_pay_later);
end;
$$ language plpgsql security definer;


-- ── pay_liability ───────────────────────────────────────────
-- Updates paid amount, marks complete if fully paid, advances due date.

create or replace function public.pay_liability(
  p_liability_id uuid,
  p_amount       numeric
)
returns void as $$
declare
  v_liability public.liabilities%rowtype;
  v_new_paid  numeric;
  v_complete  boolean;
  v_next_due  timestamptz;
begin
  select * into v_liability from public.liabilities where id = p_liability_id for update;

  if v_liability is null then
    raise exception 'Liability not found: %', p_liability_id;
  end if;

  v_new_paid := least(v_liability.paid_amount + p_amount, v_liability.total_amount);
  v_complete := v_new_paid >= v_liability.total_amount;

  -- Advance next due date for installments
  if not v_complete and v_liability.frequency_days > 0 then
    v_next_due := v_liability.next_due_date + (v_liability.frequency_days || ' days')::interval;
  else
    v_next_due := v_liability.next_due_date;
  end if;

  update public.liabilities
  set paid_amount   = v_new_paid,
      is_complete   = v_complete,
      next_due_date = v_next_due
  where id = p_liability_id;
end;
$$ language plpgsql security definer;
