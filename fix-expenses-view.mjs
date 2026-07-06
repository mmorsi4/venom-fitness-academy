import fs from 'fs';
const path = 'src/components/ExpensesView.tsx';
let content = fs.readFileSync(path, 'utf8');

// Fix the corrupted onSuccess callback - the JSX from "return (" got mangled inside it
const broken = `      onSuccess: () => {
        toast.success("Expense updated");
        setEditExpense(null);
        <div>
          <h1 className="text-2xl font-bold text-foreground">Expenses</h1>
          <p className="text-sm text-muted-foreground">{filtered.length} expenses found</p>
        </div>
        <Button data-testid="btn-create-expense" onClick={() => setShowCreate(true)} className="gap-2">
          <Plus className="w-4 h-4" /> New Expense
        </Button>
      </div>

      {/* Filters */}`;

const fixed = `      onSuccess: () => {
        toast.success("Expense updated");
        setEditExpense(null);
      },
      onError: (err) => toast.error(\`Error updating expense: \${err.message}\`)
    });
  };

  const handleDelete = () => {
    if (!confirmDelete) return;
    // If it's a coach salary expense, rollback the is_paid flags on their check-ins
    if (confirmDelete.category === 'Salaries' && confirmDelete.coach_id) {
      deleteExpenseWithRollback.mutate(
        { expenseId: confirmDelete.uuid, coachId: confirmDelete.coach_id },
        {
          onSuccess: () => { toast.success('Expense deleted & coach sessions restored'); setConfirmDelete(null); },
          onError: (err) => toast.error(\`Error deleting expense: \${err.message}\`)
        }
      );
    } else {
      deleteExpense.mutate(confirmDelete.uuid, {
        onSuccess: () => { toast.success('Expense deleted'); setConfirmDelete(null); },
        onError: (err) => toast.error(\`Error deleting expense: \${err.message}\`)
      });
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Expenses</h1>
          <p className="text-sm text-muted-foreground">{filtered.length} expenses found</p>
        </div>
        <Button data-testid="btn-create-expense" onClick={() => setShowCreate(true)} className="gap-2">
          <Plus className="w-4 h-4" /> New Expense
        </Button>
      </div>

      {/* Filters */}`;

if (!content.includes(broken.trim().slice(0,50).trim())) {
  console.error("Could not find broken section");
  console.log("Looking for:", JSON.stringify(broken.trim().slice(0,80)));
  process.exit(1);
}

content = content.replace(broken, fixed);
fs.writeFileSync(path, content, 'utf8');
console.log("Fixed ExpensesView.tsx!");
