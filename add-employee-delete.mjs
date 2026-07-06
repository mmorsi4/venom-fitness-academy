import fs from 'fs';

// 1. queries.ts
let queriesPath = 'src/lib/queries.ts';
let queriesContent = fs.readFileSync(queriesPath, 'utf8');
if (!queriesContent.includes('export async function deleteEmployeeDeduction')) {
  queriesContent = queriesContent.replace(
    /export async function createEmployeeDeduction[\s\S]*?}/,
    `$&

export async function deleteEmployeeDeduction(id: string) {
  const { error } = await supabase.from('employee_deductions').delete().eq('id', id);
  if (error) throw error;
}`
  );
  fs.writeFileSync(queriesPath, queriesContent, 'utf8');
}

// 2. use-data.ts
let hooksPath = 'src/hooks/use-data.ts';
let hooksContent = fs.readFileSync(hooksPath, 'utf8');
if (!hooksContent.includes('export function useDeleteEmployeeDeduction')) {
  hooksContent = hooksContent.replace(
    /export function useCreateEmployeeDeduction[\s\S]*?}/,
    `$&

export function useDeleteEmployeeDeduction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => q.deleteEmployeeDeduction(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['employeeDeductions'] }),
  });
}`
  );
  fs.writeFileSync(hooksPath, hooksContent, 'utf8');
}

console.log("Added delete function and hook");
