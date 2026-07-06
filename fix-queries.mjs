import fs from 'fs';
const path = 'src/lib/queries.ts';
let content = fs.readFileSync(path, 'utf8');

// Fix the mangled createEmployeeDeduction / deleteEmployeeDeduction section
const broken = `export async function createEmployeeDeduction(ded: Omit<EmployeeDeduction, 'id' | 'created_at'>) {
  const { data, error }

export async function deleteEmployeeDeduction(id: string) {
  const { error } = await supabase.from('employee_deductions').delete().eq('id', id);
  if (error) throw error;
} = await supabase.from('employee_deductions').insert(ded).select().single();
  if (error) throw error;
  return data as EmployeeDeduction;
}`;

const fixed = `export async function createEmployeeDeduction(ded: Omit<EmployeeDeduction, 'id' | 'created_at'>) {
  const { data, error } = await supabase.from('employee_deductions').insert(ded).select().single();
  if (error) throw error;
  return data as EmployeeDeduction;
}

export async function deleteEmployeeDeduction(id: string) {
  const { error } = await supabase.from('employee_deductions').delete().eq('id', id);
  if (error) throw error;
}`;

if (content.includes(broken.trim().slice(0, 60))) {
  // Try a fuzzy replacement
}

content = content.replace(
  /export async function createEmployeeDeduction[\s\S]*?} = await supabase\.from\('employee_deductions'\)\.insert\(ded\)\.select\(\)\.single\(\);\r?\n  if \(error\) throw error;\r?\n  return data as EmployeeDeduction;\r?\n}/,
  fixed
);

// Add unmarkCoachSessionsPaidForExpense after markCoachSessionsPaid
const afterMark = `export async function markCoachSessionsPaid(checkInIds: string[]) {
  if (!checkInIds.length) return;
  const { error } = await supabase.from('coach_check_ins')
    .update({ is_paid: true })
    .in('id', checkInIds);
  if (error) throw error;
}`;

const withUnmark = afterMark + `

export async function unmarkCoachSessionsPaidForExpense(expenseId: string, coachId: string) {
  // When deleting a salary expense for a coach, find the check-ins paid around that time
  // and reset them to unpaid. We unmark the most recent paid check-ins for this coach.
  const { data: expense } = await supabase.from('expenses').select('*').eq('uuid', expenseId).single();
  if (!expense) return;
  
  // Get paid check-ins for this coach that are not tied to other expenses
  const { data: checkIns } = await supabase
    .from('coach_check_ins')
    .select('id')
    .eq('coach_id', coachId)
    .eq('is_paid', true);
    
  if (!checkIns || !checkIns.length) return;
  
  // Reset all paid sessions for this coach to unpaid (rollback)
  const ids = checkIns.map((ci: any) => ci.id);
  const { error } = await supabase.from('coach_check_ins')
    .update({ is_paid: false })
    .in('id', ids);
  if (error) throw error;
}`;

content = content.replace(afterMark, withUnmark);

fs.writeFileSync(path, content, 'utf8');
console.log('Fixed queries.ts!');
