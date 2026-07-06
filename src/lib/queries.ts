// @ts-nocheck
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
  await supabase.rpc('activate_pending_subscriptions');

  let allData: any[] = [];
  let page = 0;
  const limit = 1000;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await supabase
      .from('members')
      .select('*, classes(id, name, schedules, sports(name), coaches(name)), invoices(created_at, package_id, is_applied, activation_date)')
      .order('created_at', { ascending: false })
      .range(page * limit, (page + 1) * limit - 1);

    if (error) throw error;
    if (data) {
      allData = allData.concat(data);
      if (data.length < limit) {
        hasMore = false;
      } else {
        page++;
      }
    } else {
      hasMore = false;
    }
  }
  
  return allData.map((m: any) => {
    const validInvoices = (m.invoices || []).filter((i: any) => i.package_id != null);
    
    const appliedInvoices = validInvoices.filter((i: any) => i.is_applied);
    appliedInvoices.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    const lastSubDate = appliedInvoices.length > 0 ? appliedInvoices[0].created_at : null;

    const pendingInvoices = validInvoices.filter((i: any) => !i.is_applied && i.activation_date);
    pendingInvoices.sort((a: any, b: any) => new Date(a.activation_date).getTime() - new Date(b.activation_date).getTime());
    const pendingSubDate = pendingInvoices.length > 0 ? pendingInvoices[0].activation_date : null;

    let class_info = null;
    if (m.classes) {
      class_info = {
        id: m.classes.id,
        name: m.classes.name,
        schedules: Array.isArray(m.classes.schedules) ? m.classes.schedules.filter((s: any) => s && s.day && s.time) : [],
        sport_name: m.classes.sports?.name ?? null,
        coach_name: m.classes.coaches?.name ?? null,
      };
    }

    return {
      ...m,
      coach_name: m.coaches?.name ?? null,
      class_info,
      last_subscription_date: lastSubDate,
      pending_subscription_date: pendingSubDate,
      coaches: undefined,
      classes: undefined,
      invoices: undefined,
    };
  }) as Member[];
}

export async function createMember(member: Omit<Member, 'uuid' | 'created_at' | 'coach_name'>) {
  const memberData: any = { ...member };

  // Note: the database trigger 'trg_set_member_id' will automatically
  // assign an auto-incrementing ID if member.id is 0.
  if (member.id === -1) {
    memberData.id = -1;
  } else if (!member.id || member.id <= 0) {
    memberData.id = 0; // The trigger intercepts 0 and sets it to MAX(id) + 1
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
    // A 0 here implies they are transitioning from a Clinic Visitor (-1) to a regular member,
    // or similarly needs an auto-generated ID. Since update doesn't trigger INSERT, 
    // we must manually query the DB for the max ID here.
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
  invoiceId?: string;
}) {
  const { error } = await supabase.rpc('check_in_member', {
    p_member_id: args.memberId,
    p_is_override: args.isOverride ?? false,
    p_pay_later: args.payLater ?? false,
    p_performed_by: args.performedBy ?? null,
    p_performer_name: args.performerName ?? 'System',
    p_invoice_uuid: args.invoiceId ?? null
  });
  if (error) throw error;
}

export async function freezeMember(memberId: string, days: number) {
  // Read current freeze state and expiration date
  const { data: member, error: readErr } = await supabase
    .from('members')
    .select('freeze_days_remaining, expires_at')
    .eq('uuid', memberId)
    .single();
  if (readErr) throw readErr;
  
  if (member.freeze_days_remaining < days) {
    throw new Error(`Cannot freeze for ${days} days. Only ${member.freeze_days_remaining} days remaining.`);
  }

  const newRemaining = Math.max(0, (member.freeze_days_remaining ?? 0) - days);
  
  // Extend expiration date if there is one
  let newExpiresAt = member.expires_at;
  if (newExpiresAt) {
    const d = new Date(newExpiresAt);
    d.setDate(d.getDate() + days);
    newExpiresAt = d.toISOString();
  }
  
  // Calculate frozen_until date
  const frozenUntil = new Date();
  frozenUntil.setDate(frozenUntil.getDate() + days);

  const { error } = await supabase
    .from('members')
    .update({ 
      freeze_days_remaining: newRemaining,
      expires_at: newExpiresAt,
      frozen_until: frozenUntil.toISOString()
    })
    .eq('uuid', memberId);
  if (error) throw error;
}

export async function unfreezeMember(memberId: string) {
  const { data: member, error: readErr } = await supabase
    .from('members')
    .select('frozen_until, expires_at')
    .eq('uuid', memberId)
    .single();
  
  if (readErr) throw readErr;
  if (!member.frozen_until) return; // not frozen

  const frozenUntil = new Date(member.frozen_until);
  const now = new Date();
  
  if (frozenUntil > now) {
    const diffTime = frozenUntil.getTime() - now.getTime();
    const unusedDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (unusedDays > 0) {
      let newExpiresAt = member.expires_at;
      if (newExpiresAt) {
        const d = new Date(newExpiresAt);
        d.setDate(d.getDate() - unusedDays);
        newExpiresAt = d.toISOString();
      }
      
      const { error } = await supabase
        .from('members')
        .update({
          expires_at: newExpiresAt,
          frozen_until: null
        })
        .eq('uuid', memberId);
      if (error) throw error;
      return;
    }
  }
  
  // if already passed or no unused days, just clear it
  const { error } = await supabase
    .from('members')
    .update({ frozen_until: null })
    .eq('uuid', memberId);
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
  await supabase.rpc('activate_pending_subscriptions');
  const { data, error } = await supabase
    .from('invoices')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data as Invoice[];
}

export async function createInvoice(inv: Omit<Invoice, 'uuid' | 'created_at' | 'id' | 'is_applied'>) {
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

  return (discounts ?? []) as Discount[];
}

export async function createDiscount(
  discount: Omit<Discount, 'id' | 'created_at'>
) {
  const { data, error } = await supabase.from('discounts').insert(discount).select().single();
  if (error) throw error;
  return data as Discount;
}

export async function updateDiscount(
  id: string,
  updates: Partial<Discount>
) {
  const clean = updates;
  const { data, error } = await supabase.from('discounts').update(clean).eq('id', id).select().single();
  if (error) throw error;
  return data as Discount;
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

export async function deleteCoach(id: string, name: string) {
  // Delete any salary expenses associated with this coach
  await supabase.from('expenses').delete().ilike('description', `Salary payment for ${name}%`);
  const { error } = await supabase.from('coaches').delete().eq('id', id);
  if (error) throw error;
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

export async function getCoachHistory(coachId: string) {
  const { data, error } = await supabase
    .from('coach_check_ins')
    .select('*')
    .eq('coach_id', coachId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data as CoachCheckIn[];
}

export async function getCoachCheckInsForMonth(month: number, year: number) {
  const startDate = new Date(year, month, 1).toISOString();
  const endDate = new Date(year, month + 1, 0, 23, 59, 59).toISOString();
  const { data, error } = await supabase
    .from('coach_check_ins')
    .select('*')
    .gte('created_at', startDate)
    .lte('created_at', endDate);
  if (error) throw error;
  return data as CoachCheckIn[];
}

export async function checkInCoach(coachId: string, classId?: string) {
  const today = new Date().toISOString().split('T')[0];
  const payload: any = { coach_id: coachId, check_in_date: today };
  if (classId) payload.class_id = classId;
  const { error } = await supabase.from('coach_check_ins').insert(payload);
  if (error) throw error;
}

export async function checkInCoachWithDetails(args: {
  coachId: string;
  classId?: string;
  isSubstitute?: boolean;
  originalCoachId?: string;
  sessionType?: 'group' | 'pt';
  memberUuid?: string;
}) {
  const today = new Date().toISOString().split('T')[0];
  const payload: any = {
    coach_id: args.coachId,
    check_in_date: today,
    is_substitute: args.isSubstitute ?? false,
    session_type: args.sessionType ?? 'group',
  };
  if (args.classId) payload.class_id = args.classId;
  if (args.originalCoachId) payload.original_coach_id = args.originalCoachId;
  if (args.memberUuid) payload.member_uuid = args.memberUuid;
  const { error } = await supabase.from('coach_check_ins').insert(payload);
  if (error) throw error;
}

export async function getMemberCheckIns(memberUuid: string) {
  const { data, error } = await supabase
    .from('check_ins')
    .select('*')
    .eq('member_id', memberUuid)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data as CheckIn[];
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

export async function deleteLead(id: string) {
  const { error } = await supabase.from('leads').delete().eq('id', id);
  if (error) throw error;
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

export async function createExpense(expense: Omit<Expense, 'uuid' | 'id' | 'created_at'> & { id?: string }) {
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

export async function updateExpense(uuid: string, updates: Partial<Expense>) {
  const { data, error } = await supabase.from('expenses').update(updates).eq('uuid', uuid).select().single();
  if (error) throw error;
  return data as Expense;
}

export async function deleteExpense(uuid: string) {
  const { error } = await supabase.from('expenses').delete().eq('uuid', uuid);
  if (error) throw error;
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
    schedules: Array.isArray(c.schedules) ? c.schedules.filter((s: any) => s && s.day && s.time) : [],
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
export async function createJointInvoiceGroup() {
  const { data, error } = await supabase.from('joint_invoice_groups').insert({}).select().single();
  if (error) throw error;
  return data as { id: string; created_at: string };
}

// ── Invoice Payments (debt completion) ──────────────────────
import type { Employee, EmployeeCheckIn, EmployeeDeduction, FinanceBaseBalance, InvoicePayment } from './types';

export async function getInvoicePayments(invoiceUuid?: string) {
  let q = supabase.from('invoice_payments').select('*').order('paid_at', { ascending: false });
  if (invoiceUuid) q = q.eq('invoice_uuid', invoiceUuid);
  const { data, error } = await q;
  if (error) throw error;
  return data as InvoicePayment[];
}

export async function createInvoicePayment(payment: Omit<InvoicePayment, 'id' | 'created_at'>) {
  const { data, error } = await supabase.from('invoice_payments').insert(payment).select().single();
  if (error) throw error;
  
  // Also update the paid_amount on the invoice
  const { data: invData } = await supabase.from('invoices').select('total_amount, paid_amount').eq('uuid', payment.invoice_uuid).single();
  
  const allPayments = await getInvoicePayments(payment.invoice_uuid);
  const totalPaid = (invData?.paid_amount || 0) + payment.amount;
  
  await supabase.from('invoices').update({ 
    paid_amount: totalPaid,
    status: totalPaid >= (invData?.total_amount || 0) ? 'paid' : 'partial'
  }).eq('uuid', payment.invoice_uuid);
  return data as InvoicePayment;
}

// ── Employees ────────────────────────────────────────────────

export async function getEmployees() {
  const { data, error } = await supabase.from('employees').select('*').order('name');
  if (error) throw error;
  return data as Employee[];
}

export async function createEmployee(emp: Omit<Employee, 'id' | 'created_at'>) {
  const { data, error } = await supabase.from('employees').insert(emp).select().single();
  if (error) throw error;
  return data as Employee;
}

export async function updateEmployee(id: string, updates: Partial<Employee>) {
  const { data, error } = await supabase.from('employees').update(updates).eq('id', id).select().single();
  if (error) throw error;
  return data as Employee;
}

export async function deleteEmployee(id: string) {
  const { error } = await supabase.from('employees').delete().eq('id', id);
  if (error) throw error;
}

export async function getEmployeeCheckInsToday() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const { data, error } = await supabase
    .from('employee_checkins')
    .select('*')
    .gte('check_in_time', today.toISOString())
    .order('check_in_time', { ascending: false });
  if (error) throw error;
  return data as EmployeeCheckIn[];
}

export async function getEmployeeCheckIns(month?: number, year?: number) {
  let q = supabase.from('employee_checkins').select('*').order('checked_in_at', { ascending: false });
  if (month !== undefined && year !== undefined) {
    const start = new Date(year, month, 1).toISOString();
    const end = new Date(year, month + 1, 0, 23, 59, 59).toISOString();
    q = q.gte('checked_in_at', start).lte('checked_in_at', end);
  }
  const { data, error } = await q;
  if (error) throw error;
  return data as EmployeeCheckIn[];
}

export async function clockInEmployee(employeeId: string) {
  const { data, error } = await supabase
    .from('employee_checkins')
    .insert({ employee_id: employeeId })
    .select()
    .single();
  if (error) throw error;
  return data as EmployeeCheckIn;
}

export async function clockOutEmployee(checkInId: string) {
  const { data, error } = await supabase
    .from('employee_checkins')
    .update({ check_out_time: new Date().toISOString() })
    .eq('id', checkInId)
    .select()
    .single();
  if (error) throw error;
  return data as EmployeeCheckIn;
}

export async function createEmployeeCheckIn(checkIn: Omit<EmployeeCheckIn, 'id' | 'created_at'>) {
  const { data, error } = await supabase.from('employee_checkins').insert(checkIn).select().single();
  if (error) throw error;
  return data as EmployeeCheckIn;
}

export async function getEmployeeDeductions(employeeId?: string) {
  let q = supabase.from('employee_deductions').select('*').order('created_at', { ascending: false });
  if (employeeId) q = q.eq('employee_id', employeeId);
  const { data, error } = await q;
  if (error) throw error;
  return data as EmployeeDeduction[];
}

export async function createEmployeeDeduction(ded: Omit<EmployeeDeduction, 'id' | 'created_at'>) {
  const { data, error } = await supabase.from('employee_deductions').insert(ded).select().single();
  if (error) throw error;
  return data as EmployeeDeduction;
}

export async function deleteEmployeeDeduction(id: string) {
  const { error } = await supabase.from('employee_deductions').delete().eq('id', id);
  if (error) throw error;
}

// ── Finance Base Balances ────────────────────────────────────

export async function getFinanceBaseBalances() {
  const { data, error } = await supabase.from('finance_base_balances').select('*').order('year', { ascending: false });
  if (error) throw error;
  return data as FinanceBaseBalance[];
}

export async function upsertFinanceBaseBalance(balance: Omit<FinanceBaseBalance, 'id' | 'created_at'>) {
  const { data, error } = await supabase
    .from('finance_base_balances')
    .upsert(balance, { onConflict: 'month,year' })
    .select().single();
  if (error) throw error;
  return data as FinanceBaseBalance;
}

// ── Global Settings ────────────────────────────────────────

export async function getGlobalSettings() {
  const { data, error } = await supabase.from('global_settings').select('*').eq('id', 1).single();
  if (error && error.code !== 'PGRST116') throw error;
  return data as import('./types').GlobalSettings | null;
}

export async function upsertGlobalSettings(settings: Partial<import('./types').GlobalSettings>) {
  const { data, error } = await supabase.from('global_settings').upsert({ id: 1, ...settings }).select().single();
  if (error) throw error;
  return data as import('./types').GlobalSettings;
}

// ── Coach Deductions ─────────────────────────────────────────

export async function getCoachDeductions() {
  const { data, error } = await supabase.from('coach_deductions').select('*').order('date', { ascending: false });
  if (error) throw error;
  return data as CoachDeduction[];
}

export async function createCoachDeduction(deduction: Omit<CoachDeduction, 'id' | 'created_at'>) {
  const { data, error } = await supabase.from('coach_deductions').insert(deduction).select().single();
  if (error) throw error;
  return data as CoachDeduction;
}

export async function deleteCoachDeduction(id: string) {
  const { error } = await supabase.from('coach_deductions').delete().eq('id', id);
  if (error) throw error;
}


export async function markCoachSessionsPaid(checkInIds: string[], expenseId?: string) {
  if (!checkInIds.length) return;
  const { error } = await supabase.from('coach_check_ins')
    .update({ is_paid: true, expense_uuid: expenseId || null })
    .in('id', checkInIds);
  if (error) throw error;
}

export async function unmarkCoachSessionsPaidForExpense(expenseId: string, coachId: string) {
  // Reset sessions paid specifically by this expense to unpaid
  const { error } = await supabase.from('coach_check_ins')
    .update({ is_paid: false, expense_uuid: null })
    .eq('expense_uuid', expenseId)
    .eq('coach_id', coachId);
  
  if (error) throw error;
}
