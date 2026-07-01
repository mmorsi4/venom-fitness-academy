/* ---------------------------------------------------------------
   queries.ts — All Supabase queries organized by entity.
   Each function returns a Supabase query builder or result.
   --------------------------------------------------------------- */

import { supabase } from './supabase';
import type {
  Member, SubscriptionPackage, Invoice, Discount, Coach, Lead,
  Expense, Liability, AuditLog, CheckIn, CoachCheckIn, GymSession,
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
  const { data, error } = await supabase
    .from('members')
    .select('*, coaches(name)')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((m: any) => ({
    ...m,
    coach_name: m.coaches?.name ?? null,
    coaches: undefined,
  })) as Member[];
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
  const { data, error } = await supabase
    .from('invoices')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data as Invoice[];
}

export async function createInvoice(inv: Omit<Invoice, 'id' | 'created_at' | 'display_id'>) {
  const { data, error } = await supabase.from('invoices').insert(inv).select().single();
  if (error) throw error;
  return data as Invoice;
}

export async function updateInvoice(id: string, updates: Partial<Invoice>) {
  const { data, error } = await supabase.from('invoices').update(updates).eq('id', id).select().single();
  if (error) throw error;
  return data as Invoice;
}

export async function deleteInvoice(id: string) {
  const { error } = await supabase.from('invoices').delete().eq('id', id);
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

// ── Gym Sessions ────────────────────────────────────────────

export async function getGymSessions() {
  const { data, error } = await supabase
    .from('gym_sessions')
    .select('*, coaches(name)')
    .order('day_of_week')
    .order('time');
  if (error) throw error;
  return (data ?? []).map((s: any) => ({
    ...s,
    coach_name: s.coaches?.name ?? null,
    coaches: undefined,
  })) as GymSession[];
}
