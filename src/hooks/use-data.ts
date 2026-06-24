/* ---------------------------------------------------------------
   use-data.ts — React Query hooks for all entities.
   Wraps queries.ts with useQuery / useMutation + cache invalidation.
   --------------------------------------------------------------- */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as q from '../lib/queries';
import type { Member, SubscriptionPackage, Invoice, Discount, Coach, Lead, Expense, Liability, AuditLog, GymSession } from '../lib/types';

// ── Query keys (centralized for easy invalidation) ──────────

export const queryKeys = {
  members:        ['members']       as const,
  packages:       ['packages']      as const,
  invoices:       ['invoices']      as const,
  discounts:      ['discounts']     as const,
  coaches:        ['coaches']       as const,
  coachCheckIns:  ['coachCheckIns'] as const,
  leads:          ['leads']         as const,
  expenses:       ['expenses']      as const,
  liabilities:    ['liabilities']   as const,
  auditLogs:      ['auditLogs']     as const,
  todayCheckIns:  ['todayCheckIns'] as const,
  gymSessions:    ['gymSessions']   as const,
  profiles:       ['profiles']      as const,
};

// ── Members ─────────────────────────────────────────────────

export function useMembers() {
  return useQuery({ queryKey: queryKeys.members, queryFn: q.getMembers });
}

export function useCreateMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (member: Omit<Member, 'id' | 'created_at' | 'display_id' | 'coach_name'>) =>
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
    mutationFn: (inv: Omit<Invoice, 'id' | 'created_at' | 'display_id'>) => q.createInvoice(inv),
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
    mutationFn: ({ id, updates }: { id: string; updates: Partial<Invoice> }) =>
      q.updateInvoice(id, updates),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.invoices }),
  });
}

// ── Discounts ───────────────────────────────────────────────

export function useDiscounts() {
  return useQuery({ queryKey: queryKeys.discounts, queryFn: q.getDiscounts });
}

export function useCreateDiscount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ discount, memberIds }: {
      discount: Omit<Discount, 'id' | 'created_at' | 'member_ids' | 'invoice_ids'>;
      memberIds: string[];
    }) => q.createDiscount(discount, memberIds),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.discounts }),
  });
}

export function useUpdateDiscount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, updates, memberIds }: {
      id: string;
      updates: Partial<Discount>;
      memberIds?: string[];
    }) => q.updateDiscount(id, updates, memberIds),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.discounts }),
  });
}

export function useRemoveDiscountMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ discountId, memberId }: { discountId: string; memberId: string }) =>
      q.removeDiscountMember(discountId, memberId),
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

export function useCheckInCoach() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: q.checkInCoach,
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

// ── Expenses ────────────────────────────────────────────────

export function useExpenses() {
  return useQuery({ queryKey: queryKeys.expenses, queryFn: q.getExpenses });
}

export function useCreateExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (expense: Omit<Expense, 'id' | 'created_at'>) => q.createExpense(expense),
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

// ── Check-Ins (today) ───────────────────────────────────────

export function useTodayCheckIns() {
  return useQuery({ queryKey: queryKeys.todayCheckIns, queryFn: q.getTodayCheckIns });
}

// ── Gym Sessions ────────────────────────────────────────────

export function useGymSessions() {
  return useQuery({ queryKey: queryKeys.gymSessions, queryFn: q.getGymSessions });
}

// ── Profiles ────────────────────────────────────────────────

export function useProfiles() {
  return useQuery({ queryKey: queryKeys.profiles, queryFn: q.getProfiles });
}
