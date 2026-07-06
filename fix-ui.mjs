import fs from 'fs';
const path = 'src/components/ExpensesView.tsx';
let content = fs.readFileSync(path, 'utf8');

const target = `<div className="space-y-1.5">
              <Label>Category</Label>`;

const replacement = `{form.category === 'Salaries' && (
              <div className="space-y-3 p-3 bg-muted/50 rounded-lg border border-border mt-3 mb-3">
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

if (content.includes(target)) {
  content = content.replace(target, replacement);
  fs.writeFileSync(path, content, 'utf8');
} else {
  console.log("Could not find target");
}
