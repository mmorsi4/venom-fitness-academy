import fs from 'fs';
const path = 'src/hooks/use-data.ts';
let content = fs.readFileSync(path, 'utf8');

// Find line 468 onwards and replace the broken section
const lines = content.split('\n');

// Find the broken start - the useCreateEmployeeDeduction that is broken
const brokenStart = lines.findIndex(l => l.includes('export function useCreateEmployeeDeduction'));
const fixed = `export function useCreateEmployeeDeduction() {
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

export function useMemberCheckIns(memberUuid: string) {
  return useQuery({
    queryKey: ['memberCheckIns', memberUuid],
    queryFn: () => q.getMemberCheckIns(memberUuid),
    enabled: !!memberUuid,
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
`;

const newLines = lines.slice(0, brokenStart);
const result = newLines.join('\n') + '\n' + fixed;
fs.writeFileSync(path, result, 'utf8');
console.log('Fixed! Lines from', brokenStart, 'onwards replaced.');
