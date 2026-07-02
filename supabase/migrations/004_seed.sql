-- ============================================================
-- 004_seed.sql
-- Seed data matching the original mock data
-- Run AFTER creating your first admin user via Supabase Auth.
-- ============================================================

-- ── Coaches ─────────────────────────────────────────────────

insert into public.coaches (id, name, payment_type, rate, commission_base, sessions_this_month) values
  ('00000000-0000-0000-0000-000000000c01', 'Alex Turner',  'salary',     3000, null,      22),
  ('00000000-0000-0000-0000-000000000c02', 'Bella Nour',   'per_session', 80,  null,      18),
  ('00000000-0000-0000-0000-000000000c03', 'Chris Maged',  'commission',  10,  'revenue', 25);

-- ── Packages ────────────────────────────────────────────────

insert into public.packages (id, name, sessions, price, validity_days, freeze_days, invitations, inbody_sessions) values
  ('00000000-0000-0000-0000-000000000b01', '8 Sessions',        8,   350, 30, 7,  1, 1),
  ('00000000-0000-0000-0000-000000000b02', '12 Sessions',       12,  480, 30, 7,  2, 2),
  ('00000000-0000-0000-0000-000000000b03', 'Unlimited Monthly', 999, 700, 30, 14, 3, 2),
  ('00000000-0000-0000-0000-000000000b04', '16 Sessions',       16,  580, 45, 10, 2, 2);

-- ── Members ─────────────────────────────────────────────────

insert into public.members (id, display_id, name, phone, parent_phone, birth_date, gender, source, status, sessions_remaining, expires_at, member_since, package_name, assigned_coach_id, freeze_days_remaining) values
  ('00000000-0000-0000-0000-000000000a01', 'M001', 'Ahmed Al-Rashid', '055-0101', '055-0100', '1998-03-15', 'male',   'Walk-in',   'active',        8, now() + interval '14 days', now() - interval '60 days', '12 Sessions',       '00000000-0000-0000-0000-000000000c01', 7),
  ('00000000-0000-0000-0000-000000000a02', 'M002', 'Nour Hassan',     '055-0102', '055-0109', '2002-07-22', 'female', 'Instagram', 'expiring_soon', 2,  now() + interval '2 days',  now() - interval '30 days', '8 Sessions',        '00000000-0000-0000-0000-000000000c02', 4),
  ('00000000-0000-0000-0000-000000000a03', 'M003', 'Kareem Mansour',  '055-0103', null,       '1995-11-08', 'male',   'Referral',  'expired',       0, now() - interval '5 days',  now() - interval '90 days', '12 Sessions',       '00000000-0000-0000-0000-000000000c03', 7),
  ('00000000-0000-0000-0000-000000000a04', 'M004', 'Sara Al-Fahed',   '055-0104', '055-0111', '2001-01-30', 'female', 'Facebook',  'has_debt',      10, now() + interval '25 days', now() - interval '5 days',  '12 Sessions',       '00000000-0000-0000-0000-000000000c02', 7),
  ('00000000-0000-0000-0000-000000000a05', 'M005', 'Layla Ibrahim',   '055-0105', null,       '1999-05-14', 'female', 'WhatsApp',  'active',        6,  now() + interval '18 days', now() - interval '15 days', '8 Sessions',        '00000000-0000-0000-0000-000000000c02', 7),
  ('00000000-0000-0000-0000-000000000a06', 'M006', 'Omar Khalil',     '055-0106', null,       '1993-09-03', 'male',   'Walk-in',   'active',        999, now() + interval '20 days', now() - interval '10 days', 'Unlimited Monthly', '00000000-0000-0000-0000-000000000c01', 12),
  ('00000000-0000-0000-0000-000000000a07', 'M007', 'Rania Saleh',     '055-0107', '055-0120', '2003-12-19', 'female', 'Instagram', 'expiring_soon', 1, now() + interval '1 day',   now() - interval '45 days', '12 Sessions',       '00000000-0000-0000-0000-000000000c03', 7),
  ('00000000-0000-0000-0000-000000000a08', 'M008', 'Hassan Yousef',   '055-0108', null,       '1990-06-25', 'male',   'Referral',  'expired',       2, now() - interval '3 days',  now() - interval '75 days', '12 Sessions',       '00000000-0000-0000-0000-000000000c01', 7);

-- Reset the sequence to continue after our seeded data
select setval('member_display_id_seq', 8);
select setval('invoice_display_id_seq', 1006);

-- ── Discounts ───────────────────────────────────────────────

insert into public.discounts (id, name, type, discount_type, value, active) values
  ('00000000-0000-0000-0000-000000000d01', 'Ramadan Special 2025', 'seasonal',   'percentage', 15, true),
  ('00000000-0000-0000-0000-000000000d02', 'Couples Discount',     'manual',     'fixed',      50, true);

insert into public.discount_members (discount_id, member_id) values
  ('00000000-0000-0000-0000-000000000d01', '00000000-0000-0000-0000-000000000a04'),
  ('00000000-0000-0000-0000-000000000d01', '00000000-0000-0000-0000-000000000a06'),
  ('00000000-0000-0000-0000-000000000d02', '00000000-0000-0000-0000-000000000a01'),
  ('00000000-0000-0000-0000-000000000d02', '00000000-0000-0000-0000-000000000a05');

-- ── Invoices ────────────────────────────────────────────────

insert into public.invoices (id, display_id, member_id, member_name, package_id, package_name, discount_id, discount_description, discount_amount, total_amount, paid_amount, status, payment_method, created_at) values
  ('00000000-0000-0000-0000-000000000e01', 'INV-1001', '00000000-0000-0000-0000-000000000a01', 'Ahmed Al-Rashid', '00000000-0000-0000-0000-000000000b02', '12 Sessions',       null,                                     null,                 0,  480, 480, 'paid',    'Visa',     now() - interval '15 days'),
  ('00000000-0000-0000-0000-000000000e02', 'INV-1002', '00000000-0000-0000-0000-000000000a04', 'Sara Al-Fahed',   '00000000-0000-0000-0000-000000000b02', '12 Sessions',       '00000000-0000-0000-0000-000000000d01',   'Ramadan promotion',  50, 480, 200, 'partial', 'Cash',     now() - interval '5 days'),
  ('00000000-0000-0000-0000-000000000e03', 'INV-1003', '00000000-0000-0000-0000-000000000a05', 'Layla Ibrahim',   '00000000-0000-0000-0000-000000000b01', '8 Sessions',        null,                                     null,                 0,  350, 350, 'paid',    'InstaPay', now() - interval '15 days'),
  ('00000000-0000-0000-0000-000000000e04', 'INV-1004', '00000000-0000-0000-0000-000000000a06', 'Omar Khalil',     '00000000-0000-0000-0000-000000000b03', 'Unlimited Monthly', '00000000-0000-0000-0000-000000000d01',   'Ramadan promotion',  70, 700, 0,   'unpaid',  'Cash',     now() - interval '10 days'),
  ('00000000-0000-0000-0000-000000000e05', 'INV-1005', '00000000-0000-0000-0000-000000000a07', 'Rania Saleh',     '00000000-0000-0000-0000-000000000b02', '12 Sessions',       null,                                     null,                 0,  480, 480, 'paid',    'Visa',     now() - interval '45 days'),
  ('00000000-0000-0000-0000-000000000e06', 'INV-1006', '00000000-0000-0000-0000-000000000a02', 'Nour Hassan',     '00000000-0000-0000-0000-000000000b01', '8 Sessions',        null,                                     null,                 0,  350, 350, 'paid',    'Cash',     now());

insert into public.discount_invoices (discount_id, invoice_id) values
  ('00000000-0000-0000-0000-000000000d01', '00000000-0000-0000-0000-000000000e02'),
  ('00000000-0000-0000-0000-000000000d01', '00000000-0000-0000-0000-000000000e04');

-- ── Leads ───────────────────────────────────────────────────

insert into public.leads (name, phone, source, status, notes, follow_up_date, calls_made) values
  ('David Miller',   '055-0201', 'Instagram', 'New',       '{}',                                                             now() + interval '1 day',  0),
  ('Emma Al-Sayed',  '055-0202', 'Walk-in',   'Contacted', '{"Interested in unlimited package","Wants trial session"}',       now() + interval '2 days', 2),
  ('Firas Nabil',    '055-0203', 'Facebook',  'Follow-up', '{"Budget concern","Offered discount"}',                           now(),                     3),
  ('Ghada Farouk',   '055-0204', 'Referral',  'Converted', '{"Converted to 12 sessions package"}',                            now() - interval '1 day',  1),
  ('Hana Ziad',      '055-0205', 'WhatsApp',  'Lost',      '{"Went with competitor"}',                                        now() - interval '5 days', 4);

-- ── Expenses ────────────────────────────────────────────────

insert into public.expenses (category, amount, description, date) values
  ('Salaries',         12000, 'Monthly coach salaries',      now() - interval '5 days'),
  ('Maintenance',       450,  'Treadmill belt replacement',  now() - interval '3 days'),
  ('Government Bills', 1200,  'Electricity bill',            now() - interval '8 days'),
  ('Purchases',         800,  'Resistance bands restock',    now());

-- ── Liabilities ─────────────────────────────────────────────

insert into public.liabilities (name, description, type, total_amount, paid_amount, installment_amount, frequency_days, next_due_date, notify_days_before, is_complete) values
  ('Commercial Treadmill Set', '8 commercial treadmills purchased for cardio zone', 'installment', 24000, 6000, 2000, 30, now() + interval '3 days',  5, false),
  ('AC System Upgrade',        'Full HVAC upgrade for main gym floor',              'one_time',    8500,  0,    8500, 0,  now() + interval '12 days', 5, false),
  ('Reception Renovation',     'New reception desk, chairs, and lighting',          'installment', 15000, 7500, 2500, 30, now() + interval '18 days', 5, false);

-- ── Gym Sessions ────────────────────────────────────────────

insert into public.gym_sessions (name, day_of_week, time, capacity, coach_id, attendance_count) values
  ('Morning HIIT',      'Sunday',    '07:00', 20, '00000000-0000-0000-0000-000000000c01', 18),
  ('Yoga Flow',         'Sunday',    '09:00', 15, '00000000-0000-0000-0000-000000000c02', 12),
  ('Strength Training', 'Monday',    '07:00', 20, '00000000-0000-0000-0000-000000000c03', 15),
  ('Spin Class',        'Monday',    '18:00', 20, '00000000-0000-0000-0000-000000000c01', 20),
  ('Boxing',            'Tuesday',   '07:00', 12, '00000000-0000-0000-0000-000000000c03', 10),
  ('Pilates',           'Wednesday', '09:00', 12, '00000000-0000-0000-0000-000000000c02', 8),
  ('CrossFit',          'Thursday',  '07:00', 20, '00000000-0000-0000-0000-000000000c01', 16),
  ('Evening HIIT',      'Thursday',  '19:00', 20, '00000000-0000-0000-0000-000000000c03', 19),
  ('Morning HIIT',      'Saturday',  '08:00', 20, '00000000-0000-0000-0000-000000000c01', 14),
  ('Open Gym',          'Friday',    '10:00', 30, '00000000-0000-0000-0000-000000000c02', 22);

-- ── Audit Logs (sample) ─────────────────────────────────────

insert into public.audit_logs (action, action_type, performer_name, member_id, member_name, timestamp, details) values
  ('Override Check-in', 'override_checkin', 'Admin',     '00000000-0000-0000-0000-000000000a03', 'Kareem Mansour',  now(),                      'Allowed expired member M003 (Kareem Mansour) to attend'),
  ('Edit Payment',      'edit_payment',     'Reception', null,                                    null,              now() - interval '1 hour',  'Updated INV-1002: partial payment recorded, amount 200 EGP'),
  ('Apply Discount',    'apply_discount',   'Admin',     null,                                    null,              now() - interval '1 day',   'Applied Ramadan Special 2025 (15%) to INV-1004'),
  ('Check-in',          'checkin',          'Reception', '00000000-0000-0000-0000-000000000a01', 'Ahmed Al-Rashid', now() - interval '30 min',  'Normal check-in: M001 (Ahmed Al-Rashid), session deducted (8 remaining)'),
  ('Check-in',          'checkin',          'Reception', '00000000-0000-0000-0000-000000000a05', 'Layla Ibrahim',   now() - interval '90 min',  'Normal check-in: M005 (Layla Ibrahim), session deducted (6 remaining)');
