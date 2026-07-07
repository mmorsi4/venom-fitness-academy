/* ---------------------------------------------------------------
   use-data.ts — React Query hooks for all entities.
   Wraps queries.ts with useQuery / useMutation + cache invalidation.
   --------------------------------------------------------------- */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import * as q from '../lib/queries';
import type { Member, SubscriptionPackage, Invoice, Discount, Coach, Lead, Expense, Liability, AuditLog, Sport, Class, Employee, InvoicePayment, InternalTransfer } from '../lib/types';

// ── Query keys (centralized for easy invalidation) ──────────

export const queryKeys = {
  members: ['members'] as const,
  packages: ['packages'] as const,
  invoices: ['invoices'] as const,
  discounts: ['discounts'] as const,
  coaches: ['coaches'] as const,
  coachCheckIns: ['coachCheckIns'] as const,
  leads: ['leads'] as const,
  expenses: ['expenses'] as const,
  liabilities: ['liabilities'] as const,
  internalTransfers: ['internalTransfers'] as const,
  auditLogs: ['auditLogs'] as const,
  todayCheckIns: ['todayCheckIns'] as const,
  employeeCheckIns: ['employeeCheckIns'] as const,
  classes: ['classes'] as const,
  sports: ['sports'] as const,
  profiles: ['profiles'] as const,
};

// ── Members ─────────────────────────────────────────────────

export function useMembers() {
  return useQuery({ queryKey: queryKeys.members, queryFn: q.getMembers });
}

export function useCreateMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (member: Omit<Member, 'uuid' | 'created_at' | 'coach_name'>) =>
      q.createMember(member),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.members }),
  });
}

export function useUpdateMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<Member> }) =>
      q.updateMember(id, updates),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.members }),
  });
}

export function useDeleteMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: q.deleteMember,
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.members }),
  });
}

export function useCheckInMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: q.checkInMember,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.members });
      qc.invalidateQueries({ queryKey: queryKeys.auditLogs });
      qc.invalidateQueries({ queryKey: queryKeys.todayCheckIns });
      qc.invalidateQueries({ queryKey: queryKeys.invoices });
    },
  });
}

export function useFreezeMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ memberId, days }: { memberId: string; days: number }) =>
      q.freezeMember(memberId, days),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.members }),
  });
}

export function useUnfreezeMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (memberId: string) => q.unfreezeMember(memberId),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.members }),
  });
}

// ── Packages ────────────────────────────────────────────────

export function usePackages() {
  return useQuery({ queryKey: queryKeys.packages, queryFn: q.getPackages });
}

export function useCreatePackage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (pkg: Omit<SubscriptionPackage, 'id' | 'created_at'>) => q.createPackage(pkg),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.packages }),
  });
}

export function useUpdatePackage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<SubscriptionPackage> }) =>
      q.updatePackage(id, updates),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.packages }),
  });
}

export function useDeletePackage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: q.deletePackage,
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.packages }),
  });
}

// ── Invoices ────────────────────────────────────────────────

export function useInvoices() {
  return useQuery({ queryKey: queryKeys.invoices, queryFn: q.getInvoices });
}

export function useCreateInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (inv: Omit<Invoice, 'uuid' | 'id' | 'is_applied' | 'created_at'> & { created_at?: string }) => q.createInvoice(inv),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.invoices });
      qc.invalidateQueries({ queryKey: queryKeys.members });
      qc.invalidateQueries({ queryKey: queryKeys.discounts });
    },
  });
}

export function useUpdateInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ uuid, updates }: { uuid: string; updates: Partial<Invoice> }) =>
      q.updateInvoice(uuid, updates),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.invoices }),
  });
}

export function useDeleteInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: q.deleteInvoice,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.invoices });
      qc.invalidateQueries({ queryKey: queryKeys.members });
      qc.invalidateQueries({ queryKey: queryKeys.discounts });
    },
  });
}

// ── Discounts ───────────────────────────────────────────────

export function useDiscounts() {
  return useQuery({ queryKey: queryKeys.discounts, queryFn: q.getDiscounts });
}

export function useCreateDiscount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ discount }: {
      discount: Omit<Discount, 'id' | 'created_at' | 'member_ids' | 'invoice_ids'>;
    }) => q.createDiscount(discount as any),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.discounts }),
  });
}

export function useUpdateDiscount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, updates }: {
      id: string;
      updates: Partial<Discount>;
    }) => q.updateDiscount(id, updates as any),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.discounts }),
  });
}

// ── Coaches ─────────────────────────────────────────────────

export function useCoaches() {
  return useQuery({ queryKey: queryKeys.coaches, queryFn: q.getCoaches });
}

export function useCoachCheckInsToday() {
  return useQuery({ queryKey: queryKeys.coachCheckIns, queryFn: q.getCoachCheckInsToday });
}

export function useCoachCheckInsForMonth(month: number, year: number) {
  return useQuery({
    queryKey: [...queryKeys.coachCheckIns, month, year],
    queryFn: () => q.getCoachCheckInsForMonth(month, year)
  });
}

export function useCreateCoach() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (coach: Omit<Coach, 'id' | 'created_at'>) => q.createCoach(coach),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.coaches }),
  });
}

export function useUpdateCoach() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<Coach> }) =>
      q.updateCoach(id, updates),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.coaches }),
  });
}

export function useDeleteCoach() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      q.deleteCoach(id, name),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.coaches });
      qc.invalidateQueries({ queryKey: ['expenses'] });
    }
  });
}

export function useCheckInCoach() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ coachId, classId }: { coachId: string, classId?: string }) => q.checkInCoach(coachId, classId),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.coachCheckIns }),
  });
}

// ── Leads ───────────────────────────────────────────────────

export function useLeads() {
  return useQuery({ queryKey: queryKeys.leads, queryFn: q.getLeads });
}

export function useCreateLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (lead: Omit<Lead, 'id' | 'created_at'>) => q.createLead(lead),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.leads }),
  });
}

export function useUpdateLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<Lead> }) =>
      q.updateLead(id, updates),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.leads }),
  });
}

export function useDeleteLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => q.deleteLead(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.leads }),
  });
}

// --- Internal Transfers ---
export function useInternalTransfers() {
  return useQuery({ queryKey: queryKeys.internalTransfers, queryFn: q.getInternalTransfers });
}

export function useCreateInternalTransfer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (transfer: Omit<InternalTransfer, 'id' | 'created_at'>) => q.createInternalTransfer(transfer),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.internalTransfers });
    },
  });
}

export function useDeleteInternalTransfer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: q.deleteInternalTransfer,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.internalTransfers });
    },
  });
}

// ── Expenses ────────────────────────────────────────────────

export function useExpenses() {
  return useQuery({ queryKey: queryKeys.expenses, queryFn: q.getExpenses });
}

export function useMarkCoachSessionsPaid() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ ids, expenseId }: { ids: string[]; expenseId?: string }) => q.markCoachSessionsPaid(ids, expenseId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.coachCheckIns });
    }
  });
}

export function useCreateExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (expense: Omit<Expense, 'uuid' | 'id' | 'created_at'> & { id?: string }) => q.createExpense(expense as any),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.expenses });
      qc.invalidateQueries({ queryKey: queryKeys.liabilities });
    },
  });
}

export function useUpdateExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ uuid, updates }: { uuid: string; updates: Partial<Expense> }) =>
      q.updateExpense(uuid, updates),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.expenses });
      qc.invalidateQueries({ queryKey: queryKeys.liabilities });
    },
  });
}

export function useDeleteExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (uuid: string) => q.deleteExpense(uuid),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.expenses });
      qc.invalidateQueries({ queryKey: queryKeys.liabilities });
    },
  });
}

// ── Liabilities ─────────────────────────────────────────────

export function useLiabilities() {
  return useQuery({ queryKey: queryKeys.liabilities, queryFn: q.getLiabilities });
}

export function useCreateLiability() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (liability: Omit<Liability, 'id' | 'created_at'>) => q.createLiability(liability),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.liabilities }),
  });
}

export function useUpdateLiability() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<Liability> }) =>
      q.updateLiability(id, updates),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.liabilities }),
  });
}

// ── Audit Logs ──────────────────────────────────────────────

export function useAuditLogs() {
  return useQuery({ queryKey: queryKeys.auditLogs, queryFn: q.getAuditLogs });
}

export function useCreateAuditLog() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (log: Omit<AuditLog, 'id'>) => q.createAuditLog(log),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.auditLogs }),
  });
}

export function useMemberCheckIns(memberId: string) {
  return useQuery({
    queryKey: ['memberCheckIns', memberId],
    queryFn: () => q.getMemberCheckIns(memberId),
    enabled: !!memberId,
  });
}

export function useDeleteMemberCheckIn(memberUuid: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => q.deleteMemberCheckIn(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.members });
      qc.invalidateQueries({ queryKey: queryKeys.invoices });
      qc.invalidateQueries({ queryKey: ['memberCheckIns', memberUuid] });
    },
    onError: (err: any) => toast.error(err.message || 'Failed to delete check-in'),
  });
}

export function useUpdateMemberCheckIn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, newTime }: { id: string; newTime: string }) => q.updateMemberCheckInTime(id, newTime),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['memberCheckIns'] });
    },
  });
}

// ── Check-Ins (today) ───────────────────────────────────────

export function useTodayCheckIns() {
  return useQuery({ queryKey: queryKeys.todayCheckIns, queryFn: q.getTodayCheckIns });
}

// ── Sports ──────────────────────────────────────────────────

export function useSports() {
  return useQuery({ queryKey: queryKeys.sports, queryFn: q.getSports });
}

export function useCreateSport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (sport: Omit<Sport, 'id' | 'created_at'>) => q.createSport(sport),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.sports }),
  });
}

export function useUpdateSport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<Sport> }) => q.updateSport(id, updates),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.sports }),
  });
}

export function useDeleteSport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => q.deleteSport(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.sports }),
  });
}

// ── Classes ─────────────────────────────────────────────────

export function useClasses() {
  return useQuery({ queryKey: queryKeys.classes, queryFn: q.getClasses });
}

export function useCreateClass() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (cls: Omit<Class, 'id' | 'created_at' | 'coach_name' | 'sport_name'>) => q.createClass(cls),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.classes }),
  });
}

export function useUpdateClass() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<Class> }) => q.updateClass(id, updates),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.classes }),
  });
}

export function useDeleteClass() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => q.deleteClass(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.classes }),
  });
}

// ── Profiles ────────────────────────────────────────────────

export function useProfiles() {
  return useQuery({ queryKey: queryKeys.profiles, queryFn: q.getProfiles });
}
export function useCreateJointInvoiceGroup() {
  return useMutation({
    mutationFn: () => q.createJointInvoiceGroup(),
  });
}
// ── Invoice Payments ──────────────────────────────────────────

export function useInvoicePayments(invoiceUuid?: string) {
  return useQuery({
    queryKey: ['invoicePayments', invoiceUuid],
    queryFn: () => q.getInvoicePayments(invoiceUuid),
  });
}

export function useCreateInvoicePayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payment: Parameters<typeof q.createInvoicePayment>[0]) => q.createInvoicePayment(payment),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.invoices });
      qc.invalidateQueries({ queryKey: ['invoicePayments'] });
    },
  });
}

// ── Historical Employee Check-Ins & Deductions ────────────────

export function useEmployeeCheckIns(month?: number, year?: number) {
  return useQuery({
    queryKey: ['employeeCheckIns', month, year],
    queryFn: () => q.getEmployeeCheckIns(month, year),
  });
}

export function useCreateEmployeeCheckIn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (checkIn: Parameters<typeof q.createEmployeeCheckIn>[0]) => q.createEmployeeCheckIn(checkIn),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.employeeCheckIns }),
  });
}

export function useEmployeeDeductions(employeeId?: string) {
  return useQuery({
    queryKey: ['employeeDeductions', employeeId],
    queryFn: () => q.getEmployeeDeductions(employeeId),
  });
}

export function useCreateEmployeeDeduction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ded: Parameters<typeof q.createEmployeeDeduction>[0]) => q.createEmployeeDeduction(ded),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['employeeDeductions'] }),
  });
}

export function useDeleteEmployeeDeduction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => q.deleteEmployeeDeduction(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['employeeDeductions'] }),
  });
}

// -- Finance Base Balances --

export function useFinanceBaseBalances() {
  return useQuery({ queryKey: ['financeBaseBalances'], queryFn: q.getFinanceBaseBalances });
}

export function useUpsertFinanceBaseBalance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (balance: Parameters<typeof q.upsertFinanceBaseBalance>[0]) => q.upsertFinanceBaseBalance(balance),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['financeBaseBalances'] }),
  });
}

// -- Global Settings --

export function useGlobalSettings() {
  return useQuery({ queryKey: ['globalSettings'], queryFn: q.getGlobalSettings });
}

export function useUpsertGlobalSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (settings: Parameters<typeof q.upsertGlobalSettings>[0]) => q.upsertGlobalSettings(settings),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['globalSettings'] }),
  });
}

// -- Coach Deductions --

export function useCoachDeductions() {
  return useQuery({ queryKey: ['coachDeductions'], queryFn: q.getCoachDeductions });
}

export function useCreateCoachDeduction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (deduction: Parameters<typeof q.createCoachDeduction>[0]) => q.createCoachDeduction(deduction),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['coachDeductions'] }),
  });
}

export function useDeleteCoachDeduction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => q.deleteCoachDeduction(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['coachDeductions'] }),
  });
}

// -- Additional Hooks --

export function useCheckInCoachWithDetails() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: Parameters<typeof q.checkInCoachWithDetails>[0]) => q.checkInCoachWithDetails(args),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.coachCheckIns }),
  });
}

export function useEmployees() {
  return useQuery({ queryKey: ['employees'], queryFn: q.getEmployees });
}

export function useCreateEmployee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (employee: Omit<Employee, 'id' | 'created_at'>) => q.createEmployee(employee as any),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['employees'] }),
  });
}

export function useUpdateEmployee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<Employee> }) => q.updateEmployee(id, updates as any),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['employees'] }),
  });
}

export function useDeleteEmployee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => q.deleteEmployee(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['employees'] }),
  });
}

export function useEmployeeCheckInsToday() {
  return useQuery({ queryKey: ['employeeCheckInsToday'], queryFn: q.getEmployeeCheckInsToday });
}

export function useClockInEmployee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (employeeId: string) => q.clockInEmployee(employeeId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['employeeCheckInsToday'] }),
  });
}

export function useClockOutEmployee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (checkInId: string) => q.clockOutEmployee(checkInId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['employeeCheckInsToday'] }),
  });
}



export function useCoachHistory(coachId: string | undefined) {
  return useQuery({
    queryKey: ['coachHistory', coachId],
    queryFn: () => q.getCoachHistory(coachId!),
    enabled: !!coachId,
  });
}

export function useDeleteExpenseWithRollback() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ expenseId, coachId }: { expenseId: string; coachId: string | null }) => {
      if (coachId) {
        await q.unmarkCoachSessionsPaidForExpense(expenseId, coachId);
      }
      await q.deleteExpense(expenseId);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.expenses });
      qc.invalidateQueries({ queryKey: queryKeys.coachCheckIns });
    },
  });
}
