import fs from 'fs';
const path = 'src/components/ExpensesView.tsx';
let content = fs.readFileSync(path, 'utf8');

if (!content.includes('useMarkCoachSessionsPaid')) {
  // 1. Add imports
  content = content.replace(
    `import { useExpenses, useLiabilities, useCoaches, useCreateExpense, useUpdateExpense, useDeleteExpense } from "@/hooks/use-data";`,
    `import { useExpenses, useLiabilities, useCoaches, useClasses, useCoachCheckIns, useMembers, useCreateExpense, useUpdateExpense, useDeleteExpense, useMarkCoachSessionsPaid } from "@/hooks/use-data";
import { calculateCoachPayroll } from "@/lib/utils";`
  );

  // 2. Add emptyForm fields
  content = content.replace(
    `splitPayments: [] as { method: string; amount: string }[],`,
    `splitPayments: [] as { method: string; amount: string }[],
  coachId: "",
  coachUnpaidIds: [] as string[],`
  );

  // 3. Add hooks to ExpensesView
  content = content.replace(
    `  const createExpense = useCreateExpense();`,
    `  const createExpense = useCreateExpense();
  const markSessionsPaid = useMarkCoachSessionsPaid();
  const { data: coaches = [] } = useCoaches();
  const { data: classes = [] } = useClasses();
  const { data: coachCheckIns = [] } = useCoachCheckIns();
  const { data: members = [] } = useMembers();`
  );

  // 4. Update handleCreate to mark sessions
  content = content.replace(
    `    createExpense.mutate(payload, {`,
    `    createExpense.mutate(payload, {
      onSuccess: () => {
        if (form.category === 'Salaries' && form.coachUnpaidIds?.length > 0) {
          markSessionsPaid.mutate(form.coachUnpaidIds);
        }
        `
  );

  // 5. Replace handleCreate's old onSuccess (it has a block already)
  // Wait, I need to be careful with replace. I'll use multi_replace directly in node script.
  content = content.replace(
    `      onSuccess: () => {
        if (isLiabilityPayment`,
    `      onSuccess: () => {
        if (form.category === 'Salaries' && form.coachUnpaidIds?.length > 0) {
          markSessionsPaid.mutate(form.coachUnpaidIds);
        }
        if (isLiabilityPayment`
  );

  // 6. Add UI fields in modal
  const uiTarget = `<div className="space-y-1.5">
              <Label>Category</Label>`;
  
  const uiReplacement = `
            {form.category === 'Salaries' && (
              <div className="space-y-3 p-3 bg-muted/50 rounded-lg border border-border mt-3">
                <div className="space-y-1.5">
                  <Label>Select Coach</Label>
                  <Select value={form.coachId} onValueChange={(id) => {
                    const coach = coaches.find(c => c.id === id);
                    if (!coach) return;
                    // Calculate payroll for current month
                    const now = new Date();
                    const checkInsThisMonth = coachCheckIns.filter(ci => new Date(ci.check_in_date).getMonth() === now.getMonth() && new Date(ci.check_in_date).getFullYear() === now.getFullYear());
                    const monthlyRevenue = 0; // approximate, not used for standard coaches usually
                    const newMembersThisMonth = 0;
                    
                    const stats = calculateCoachPayroll(coach, now.getMonth(), now.getFullYear(), classes, checkInsThisMonth, monthlyRevenue, newMembersThisMonth);
                    
                    // Count unpaid sessions explicitly
                    const ptUnpaid = checkInsThisMonth.filter(ci => ci.coach_id === id && ci.session_type === 'pt' && !ci.is_paid).length;
                    const groupMainUnpaid = checkInsThisMonth.filter(ci => ci.coach_id === id && ci.session_type === 'group' && !ci.is_substitute && !ci.is_paid).length;
                    const groupSubUnpaid = checkInsThisMonth.filter(ci => ci.coach_id === id && ci.session_type === 'group' && ci.is_substitute && !ci.is_paid).length;
                    const totalUnpaid = ptUnpaid + groupMainUnpaid + groupSubUnpaid;
                    
                    // Calculate amount owed
                    let owed = 0;
                    if (coach.payment_type === 'per_session') {
                      owed = (groupMainUnpaid + groupSubUnpaid) * coach.rate + (ptUnpaid * (coach.pt_rate || 250));
                    } else {
                      const originalScheduled = stats.scheduledSlotsInMonth + checkInsThisMonth.filter(ci => ci.coach_id === id && ci.session_type === 'group' && !ci.is_substitute && ci.is_paid).length;
                      const perSessionRate = originalScheduled > 0 ? (coach.rate / originalScheduled) : 0;
                      owed = (groupSubUnpaid * perSessionRate) + (ptUnpaid * (coach.pt_rate || 250));
                    }

                    setForm(p => ({ 
                      ...p, 
                      coachId: id, 
                      amount: String(owed),
                      description: \`Salary payment for \${coach.name} (\${totalUnpaid} sessions)\`,
                      coachUnpaidIds: stats.unpaidCheckInIds || []
                    }));
                  }}>
                    <SelectTrigger><SelectValue placeholder="Select a coach..." /></SelectTrigger>
                    <SelectContent>
                      {coaches.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                {form.coachId && (
                  <div className="flex gap-4">
                    <div className="space-y-1.5 flex-1">
                      <Label>Unpaid Sessions</Label>
                      <Input readOnly value={form.coachUnpaidIds?.length || 0} className="bg-muted" />
                    </div>
                  </div>
                )}
              </div>
            )}
            
            <div className="space-y-1.5">
              <Label>Category</Label>`;

  content = content.replace(uiTarget, uiReplacement);

  fs.writeFileSync(path, content, 'utf8');
}
