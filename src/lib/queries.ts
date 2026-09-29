/* ---------------------------------------------------------------
   queries.ts — All Supabase queries organized by entity.
   Each function returns a Supabase query builder or result.
   --------------------------------------------------------------- */

import { supabase } from './supabase';
import type {
  Member, SubscriptionPackage, Invoice, Discount, Coach, Lead,
  Expense, Liability, AuditLog, CheckIn, CoachCheckIn, Class, Sport,
  Profile,
} from './types';

// ── Profiles ────────────────────────────────────────────────

export async function getProfiles() {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at');
  if (error) throw error;
  return data as Profile[];
}

// ── Members ─────────────────────────────────────────────────

export async function getMembers() {
  // First, clean up any subscriptions that have expired
  await supabase.rpc('cleanup_expired_subscriptions');

  const allRows: any[] = [];
  let page = 0;
  const pageSize = 1000;
  while (true) {
    const { data, error } = await supabase
      .from('members')
      .select('*, classes(id, name, schedules, sports(name), coaches(name)), invoices(created_at, package_id)')
      .order('created_at', { ascending: false })
      .range(page * pageSize, (page + 1) * pageSize - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    allRows.push(...data);
    if (data.length < pageSize) break;
    page++;
  }
  
  return allRows.map((m: any) => {
    const validInvoices = (m.invoices || []).filter((i: any) => i.package_id != null);
    validInvoices.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    const lastSubDate = validInvoices.length > 0 ? validInvoices[0].created_at : null;

    let class_info = null;
    if (m.classes) {
      class_info = {
        id: m.classes.id,
        name: m.classes.name,
        schedules: m.classes.schedules,
        sport_name: m.classes.sports?.name ?? null,
        coach_name: m.classes.coaches?.name ?? null,
      };
    }

    return {
      ...m,
      coach_name: m.coaches?.name ?? null,
      class_info,
      last_subscription_date: lastSubDate,
      coaches: undefined,
      classes: undefined,
      invoices: undefined,
    };
  }) as Member[];
}

export async function createMember(member: Omit<Member, 'uuid' | 'created_at' | 'coach_name'>) {
  const memberData: any = { ...member };

  // Auto-assign numeric id if not set (and not -1 for clinic visitors)
  if (!member.id || member.id <= 0) {
    if (member.id === -1) {
      memberData.id = -1;
    } else {
      const { data: maxData } = await supabase
        .from('members')
        .select('id')
        .gt('id', 0)
        .order('id', { ascending: false })
        .limit(1)
        .single();
      memberData.id = (maxData?.id ?? 0) + 1;
    }
  }

  const { data, error } = await supabase
    .from('members')
    .insert(memberData)
    .select()
    .single();
  if (error) throw error;
  return data as Member;
}

export async function updateMember(uuid: string, updates: Partial<Member>) {
  const { coach_name, ...clean } = updates as any;
  
  if (clean.id === 0) {
    const { data: maxData } = await supabase
      .from('members')
      .select('id')
      .gt('id', 0)
      .order('id', { ascending: false })
      .limit(1)
      .single();
    clean.id = (maxData?.id ?? 0) + 1;
  }

  const { data, error } = await supabase
    .from('members')
    .update(clean)
    .eq('uuid', uuid)
    .select()
    .single();
  if (error) throw error;
  return data as Member;
}

export async function deleteMember(uuid: string) {
  const { error } = await supabase.from('members').delete().eq('uuid', uuid);
  if (error) throw error;
}

// ── Check-In (calls DB function) ────────────────────────────

export async function checkInMember(args: {
  memberId: string;
  isOverride?: boolean;
  payLater?: boolean;
  performedBy?: string;
  performerName?: string;
}) {
  const { error } = await supabase.rpc('check_in_member', {
    p_member_id: args.memberId,
    p_is_override: args.isOverride ?? false,
    p_pay_later: args.payLater ?? false,
    p_performed_by: args.performedBy ?? null,
    p_performer_name: args.performerName ?? 'System',
  });
  if (error) throw error;
}

export async function freezeMember(memberId: string, days: number) {
  // Read current freeze state
  const { data: member, error: readErr } = await supabase
    .from('members')
    .select('freeze_days_used, freeze_days_total')
    .eq('id', memberId)
    .single();
  if (readErr) throw readErr;
  const newUsed = Math.min((member.freeze_days_used ?? 0) + days, member.freeze_days_total ?? 7);
  const { error } = await supabase
    .from('members')
    .update({ freeze_days_used: newUsed })
    .eq('id', memberId);
  if (error) throw error;
}

// ── Packages ────────────────────────────────────────────────

export async function getPackages() {
  const { data, error } = await supabase
    .from('packages')
    .select('*')
    .order('price');
  if (error) throw error;
  return data as SubscriptionPackage[];
}

export async function createPackage(pkg: Omit<SubscriptionPackage, 'id' | 'created_at'>) {
  const { data, error } = await supabase.from('packages').insert(pkg).select().single();
  if (error) throw error;
  return data as SubscriptionPackage;
}

export async function updatePackage(id: string, updates: Partial<SubscriptionPackage>) {
  const { data, error } = await supabase.from('packages').update(updates).eq('id', id).select().single();
  if (error) throw error;
  return data as SubscriptionPackage;
}

export async function deletePackage(id: string) {
  const { error } = await supabase.from('packages').delete().eq('id', id);
  if (error) throw error;
}

// ── Invoices ────────────────────────────────────────────────

export async function getInvoices() {
  const allRows: any[] = [];
  let page = 0;
  const pageSize = 1000;
  while (true) {
    const { data, error } = await supabase
      .from('invoices')
      .select('*')
      .order('created_at', { ascending: false })
      .range(page * pageSize, (page + 1) * pageSize - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    allRows.push(...data);
    if (data.length < pageSize) break;
    page++;
  }
  return allRows as Invoice[];
}

export async function createInvoice(inv: Omit<Invoice, 'uuid' | 'created_at' | 'id'>) {
  const { data, error } = await supabase.from('invoices').insert(inv).select().single();
  if (error) throw error;
  return data as Invoice;
}

export async function updateInvoice(uuid: string, updates: Partial<Invoice>) {
  const { data, error } = await supabase.from('invoices').update(updates).eq('uuid', uuid).select().single();
  if (error) throw error;
  return data as Invoice;
}

export async function deleteInvoice(uuid: string) {
  const { error } = await supabase.from('invoices').delete().eq('uuid', uuid);
  if (error) throw error;
}

// ── Discounts ───────────────────────────────────────────────

export async function getDiscounts() {
  const { data: discounts, error } = await supabase
    .from('discounts')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;

  // Fetch junction table data
  const { data: dm } = await supabase.from('discount_members').select('*');
  const { data: di } = await supabase.from('discount_invoices').select('*');

  return (discounts ?? []).map((d: any) => ({
    ...d,
    member_ids: (dm ?? []).filter((r: any) => r.discount_id === d.id).map((r: any) => r.member_id),
    invoice_ids: (di ?? []).filter((r: any) => r.discount_id === d.id).map((r: any) => r.invoice_id),
  })) as Discount[];
}

export async function createDiscount(
  discount: Omit<Discount, 'id' | 'created_at' | 'member_ids' | 'invoice_ids'>,
  memberIds: string[]
) {
  const { data, error } = await supabase.from('discounts').insert(discount).select().single();
  if (error) throw error;
  if (memberIds.length > 0) {
    const { error: jErr } = await supabase
      .from('discount_members')
      .insert(memberIds.map(mid => ({ discount_id: data.id, member_id: mid })));
    if (jErr) throw jErr;
  }
  return { ...data, member_ids: memberIds, invoice_ids: [] } as Discount;
}

export async function updateDiscount(
  id: string,
  updates: Partial<Discount>,
  memberIds?: string[]
) {
  const { member_ids, invoice_ids, ...clean } = updates as any;
  const { data, error } = await supabase.from('discounts').update(clean).eq('id', id).select().single();
  if (error) throw error;
  if (memberIds !== undefined) {
    await supabase.from('discount_members').delete().eq('discount_id', id);
    if (memberIds.length > 0) {
      await supabase
        .from('discount_members')
        .insert(memberIds.map(mid => ({ discount_id: id, member_id: mid })));
    }
  }
  return data as Discount;
}

export async function addDiscountInvoice(discountId: string, invoiceId: string) {
  const { error } = await supabase
    .from('discount_invoices')
    .insert({ discount_id: discountId, invoice_id: invoiceId });
  if (error) throw error;
}

export async function addDiscountMember(discountId: string, memberId: string) {
  const { error } = await supabase
    .from('discount_members')
    .upsert({ discount_id: discountId, member_id: memberId });
  if (error) throw error;
}

export async function removeDiscountMember(discountId: string, memberId: string) {
  const { error } = await supabase
    .from('discount_members')
    .delete()
    .eq('discount_id', discountId)
    .eq('member_id', memberId);
  if (error) throw error;
}

// ── Coaches ─────────────────────────────────────────────────

export async function getCoaches() {
  const { data, error } = await supabase.from('coaches').select('*').order('name');
  if (error) throw error;
  return data as Coach[];
}

export async function createCoach(coach: Omit<Coach, 'id' | 'created_at'>) {
  const { data, error } = await supabase.from('coaches').insert(coach).select().single();
  if (error) throw error;
  return data as Coach;
}

export async function updateCoach(id: string, updates: Partial<Coach>) {
  const { data, error } = await supabase.from('coaches').update(updates).eq('id', id).select().single();
  if (error) throw error;
  return data as Coach;
}

export async function getCoachCheckInsToday() {
  const today = new Date().toISOString().split('T')[0];
  const { data, error } = await supabase
    .from('coach_check_ins')
    .select('*')
    .eq('check_in_date', today);
  if (error) throw error;
  return data as CoachCheckIn[];
}

export async function checkInCoach(coachId: string) {
  const today = new Date().toISOString().split('T')[0];
  const { error } = await supabase
    .from('coach_check_ins')
    .upsert({ coach_id: coachId, check_in_date: today });
  if (error) throw error;
}

// ── Leads ───────────────────────────────────────────────────

export async function getLeads() {
  const { data, error } = await supabase
    .from('leads')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data as Lead[];
}

export async function createLead(lead: Omit<Lead, 'id' | 'created_at'>) {
  const { data, error } = await supabase.from('leads').insert(lead).select().single();
  if (error) throw error;
  return data as Lead;
}

export async function updateLead(id: string, updates: Partial<Lead>) {
  const { data, error } = await supabase.from('leads').update(updates).eq('id', id).select().single();
  if (error) throw error;
  return data as Lead;
}

// ── Expenses ────────────────────────────────────────────────

export async function getExpenses() {
  const { data, error } = await supabase
    .from('expenses')
    .select('*')
    .order('date', { ascending: false });
  if (error) throw error;
  return data as Expense[];
}

export async function createExpense(expense: Omit<Expense, 'id' | 'created_at'>) {
  const { data, error } = await supabase.from('expenses').insert(expense).select().single();
  if (error) throw error;
  // If this is a liability payment, call the pay_liability function
  if (expense.liability_id) {
    await supabase.rpc('pay_liability', {
      p_liability_id: expense.liability_id,
      p_amount: expense.amount,
    });
  }
  return data as Expense;
}

// ── Liabilities ─────────────────────────────────────────────

export async function getLiabilities() {
  const { data, error } = await supabase
    .from('liabilities')
    .select('*')
    .order('is_complete', { ascending: true })
    .order('next_due_date');
  if (error) throw error;
  return data as Liability[];
}

export async function createLiability(liability: Omit<Liability, 'id' | 'created_at'>) {
  const { data, error } = await supabase.from('liabilities').insert(liability).select().single();
  if (error) throw error;
  return data as Liability;
}

export async function updateLiability(id: string, updates: Partial<Liability>) {
  const { data, error } = await supabase.from('liabilities').update(updates).eq('id', id).select().single();
  if (error) throw error;
  return data as Liability;
}

// ── Audit Logs ──────────────────────────────────────────────

export async function getAuditLogs() {
  const { data, error } = await supabase
    .from('audit_logs')
    .select('*')
    .order('timestamp', { ascending: false });
  if (error) throw error;
  return data as AuditLog[];
}

export async function createAuditLog(log: Omit<AuditLog, 'id'>) {
  const { data, error } = await supabase.from('audit_logs').insert(log).select().single();
  if (error) throw error;
  return data as AuditLog;
}

// ── Check-Ins (history) ─────────────────────────────────────

export async function getTodayCheckIns() {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const { data, error } = await supabase
    .from('check_ins')
    .select('*')
    .gte('created_at', startOfDay.toISOString())
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data as CheckIn[];
}

// ── Sports ──────────────────────────────────────────────────

export async function getSports() {
  const { data, error } = await supabase
    .from('sports')
    .select('*')
    .order('name');
  if (error) throw error;
  return data as Sport[];
}

export async function createSport(sport: Omit<Sport, 'id' | 'created_at'>) {
  const { data, error } = await supabase.from('sports').insert(sport).select().single();
  if (error) throw error;
  return data as Sport;
}

export async function updateSport(id: string, updates: Partial<Sport>) {
  const { data, error } = await supabase.from('sports').update(updates).eq('id', id).select().single();
  if (error) throw error;
  return data as Sport;
}

export async function deleteSport(id: string) {
  const { error } = await supabase.from('sports').delete().eq('id', id);
  if (error) throw error;
}

// ── Classes ─────────────────────────────────────────────────

export async function getClasses() {
  const { data, error } = await supabase
    .from('classes')
    .select('*, coaches(name), sports(name)')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((c: any) => ({
    ...c,
    coach_name: c.coaches?.name ?? null,
    sport_name: c.sports?.name ?? null,
    coaches: undefined,
    sports: undefined,
  })) as Class[];
}

export async function createClass(cls: Omit<Class, 'id' | 'created_at' | 'coach_name' | 'sport_name'>) {
  const { data, error } = await supabase.from('classes').insert(cls).select().single();
  if (error) throw error;
  return data as Class;
}

export async function updateClass(id: string, updates: Partial<Class>) {
  const { coach_name, sport_name, ...clean } = updates as any;
  const { data, error } = await supabase.from('classes').update(clean).eq('id', id).select().single();
  if (error) throw error;
  return data as Class;
}

export async function deleteClass(id: string) {
  const { error } = await supabase.from('classes').delete().eq('id', id);
  if (error) throw error;
}

// ── Employees ───────────────────────────────────────────────

export async function getEmployees() {
  const { data, error } = await supabase
    .from('employees')
    .select('*')
    .order('name');
  if (error) throw error;
  return data as Employee[];
}

export async function createEmployee(emp: Omit<Employee, 'id' | 'created_at'>) {
  const { data, error } = await supabase
    .from('employees')
    .insert(emp)
    .select()
    .single();
  if (error) throw error;
  return data as Employee;
}

export async function updateEmployee(id: string, updates: Partial<Employee>) {
  const { data, error } = await supabase
    .from('employees')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data as Employee;
}

export async function deleteEmployee(id: string) {
  const { error } = await supabase
    .from('employees')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

// ── Employee Lateness Rules ─────────────────────────────────

export async function getEmployeeLatenessRules() {
  const { data, error } = await supabase
    .from('employee_lateness_rules')
    .select('*')
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) {
    // Return default rules if table empty
    return {
      id: 'default',
      grace_period_minutes: 15,
      deduction_15m_days: 0.25,
      deduction_20m_days: 0.50,
      deduction_30m_plus_days: 1.00,
      updated_at: new Date().toISOString(),
    } as EmployeeLatenessRules;
  }
  return data as EmployeeLatenessRules;
}

export async function updateEmployeeLatenessRules(updates: Partial<EmployeeLatenessRules>) {
  const { id, updated_at, ...clean } = updates as any;
  // If id is default or doesn't exist, try upsert
  const { data: existing } = await supabase
    .from('employee_lateness_rules')
    .select('id')
    .limit(1)
    .maybeSingle();

  if (existing) {
    const { data, error } = await supabase
      .from('employee_lateness_rules')
      .update({ ...clean, updated_at: new Date().toISOString() })
      .eq('id', existing.id)
      .select()
      .single();
    if (error) throw error;
    return data as EmployeeLatenessRules;
  } else {
    const { data, error } = await supabase
      .from('employee_lateness_rules')
      .insert({ ...clean, updated_at: new Date().toISOString() })
      .select()
      .single();
    if (error) throw error;
    return data as EmployeeLatenessRules;
  }
}

// ── Employee Attendance ─────────────────────────────────────

export async function getEmployeeAttendances(date?: string) {
  let query = supabase
    .from('employee_attendances')
    .select('*, employees(*)');

  if (date) {
    query = query.eq('date', date);
  }

  const { data, error } = await query.order('check_in_time', { ascending: false });
  if (error) throw error;

  return (data ?? []).map((row: any) => ({
    ...row,
    employee: row.employees,
    employees: undefined,
  })) as EmployeeAttendance[];
}

export async function checkInEmployee(args: {
  employeeId: string;
  minutesLate?: number;
  status?: AttendanceStatus;
  notes?: string;
  autoDeduct?: {
    daysDeducted: number;
    amountDeducted: number;
    reason: string;
  };
}) {
  const today = new Date().toISOString().split('T')[0];
  const { data: attendance, error: attError } = await supabase
    .from('employee_attendances')
    .insert({
      employee_id: args.employeeId,
      check_in_time: new Date().toISOString(),
      date: today,
      minutes_late: args.minutesLate ?? 0,
      status: args.status ?? 'on_time',
      notes: args.notes ?? null,
    })
    .select()
    .single();

  if (attError) throw attError;

  // If there is an auto-deduction, insert into employee_deduction_logs
  if (args.autoDeduct && args.autoDeduct.daysDeducted > 0) {
    await supabase.from('employee_deduction_logs').insert({
      employee_id: args.employeeId,
      attendance_id: attendance.id,
      deduction_type: 'auto_late',
      days_deducted: args.autoDeduct.daysDeducted,
      amount_deducted: args.autoDeduct.amountDeducted,
      reason: args.autoDeduct.reason,
      date: today,
      is_reverted: false,
    });
  }

  return attendance as EmployeeAttendance;
}

export async function checkOutEmployee(attendanceId: string) {
  const { data, error } = await supabase
    .from('employee_attendances')
    .update({ check_out_time: new Date().toISOString() })
    .eq('id', attendanceId)
    .select()
    .single();
  if (error) throw error;
  return data as EmployeeAttendance;
}

// ── Employee Deduction Logs ─────────────────────────────────

export async function getEmployeeDeductionLogs() {
  const { data, error } = await supabase
    .from('employee_deduction_logs')
    .select('*, employees(*)')
    .order('created_at', { ascending: false });
  if (error) throw error;

  return (data ?? []).map((row: any) => ({
    ...row,
    employee: row.employees,
    employees: undefined,
  })) as EmployeeDeductionLog[];
}

export async function createEmployeeDeductionLog(deduction: Omit<EmployeeDeductionLog, 'id' | 'created_at' | 'employee' | 'is_reverted' | 'reverted_by' | 'reverted_at' | 'revert_reason'>) {
  const { data, error } = await supabase
    .from('employee_deduction_logs')
    .insert({
      ...deduction,
      is_reverted: false,
    })
    .select()
    .single();
  if (error) throw error;
  return data as EmployeeDeductionLog;
}

export async function revertEmployeeDeductionLog(args: {
  id: string;
  revertedBy?: string;
  revertReason?: string;
}) {
  const { data, error } = await supabase
    .from('employee_deduction_logs')
    .update({
      is_reverted: true,
      reverted_by: args.revertedBy ?? null,
      reverted_at: new Date().toISOString(),
      revert_reason: args.revertReason ?? 'Reverted by Admin',
    })
    .eq('id', args.id)
    .select()
    .single();
  if (error) throw error;
  return data as EmployeeDeductionLog;
}

// ── Employee Payroll Settlements ───────────────────────────

export async function getEmployeePayrollSettlements() {
  const { data, error } = await supabase
    .from('employee_payroll_settlements')
    .select('*')
    .order('settled_at', { ascending: false });
  if (error) throw error;
  return data as EmployeePayrollSettlement[];
}

export async function createEmployeePayrollSettlement(settlement: {
  employee_id: string;
  employee_name: string;
  period_month: number;
  period_year: number;
  base_salary: number;
  total_days_deducted: number;
  total_deductions_amount: number;
  bonus_amount: number;
  net_salary: number;
  payment_method: PaymentMethod;
  settled_by?: string;
  notes?: string;
}) {
  const today = new Date().toISOString().split('T')[0];
  
  // 1. Create an official Expense record in public.expenses
  const { data: exp, error: expErr } = await supabase
    .from('expenses')
    .insert({
      category: 'Salaries',
      amount: settlement.net_salary,
      description: `Payroll settlement for ${settlement.employee_name} (${settlement.period_month}/${settlement.period_year}) - Base: ${settlement.base_salary} EGP, Deductions: -${settlement.total_deductions_amount} EGP, Bonus: +${settlement.bonus_amount} EGP`,
      date: today,
      liability_id: null,
    })
    .select()
    .single();

  if (expErr) throw expErr;

  // 2. Insert the settlement linking to the expense
  const { data, error } = await supabase
    .from('employee_payroll_settlements')
    .insert({
      ...settlement,
      expense_id: exp.id,
      settled_by: settlement.settled_by ?? null,
      settled_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) throw error;

  return { settlement: data as EmployeePayrollSettlement, expense: exp };
}
