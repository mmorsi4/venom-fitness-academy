import fs from "fs";
const path = "src/components/ExpensesView.tsx";
let content = fs.readFileSync(path, "utf8");

// The file has CRLF line endings, fix by replacing the specific broken line range
// Lines 218-229 are corrupted. We need to close the onSuccess + mutate + function properly
// then add handleDelete, then restore the return statement.

// Find the exact broken snippet using raw bytes
const brokenChunk = `    }, {\r
      onSuccess: () => {\r
        toast.success("Expense updated");\r
        setEditExpense(null);\r
        <div>\r
          <h1 className="text-2xl font-bold text-foreground">Expenses</h1>\r
          <p className="text-sm text-muted-foreground">{filtered.length} expenses found</p>\r
        </div>\r
        <Button data-testid="btn-create-expense" onClick={() => setShowCreate(true)} className="gap-2">\r
          <Plus className="w-4 h-4" /> New Expense\r
        </Button>\r
      </div>\r
\r
      {/* Filters */}`;

const fixedChunk = `    }, {\r
      onSuccess: () => {\r
        toast.success("Expense updated");\r
        setEditExpense(null);\r
      },\r
      onError: (err) => toast.error(\`Error updating expense: \${err.message}\`)\r
    });\r
  };\r
\r
  const handleDelete = () => {\r
    if (!confirmDelete) return;\r
    if (confirmDelete.category === 'Salaries' && confirmDelete.coach_id) {\r
      deleteExpenseWithRollback.mutate(\r
        { expenseId: confirmDelete.uuid, coachId: confirmDelete.coach_id },\r
        {\r
          onSuccess: () => { toast.success('Expense deleted & sessions restored'); setConfirmDelete(null); },\r
          onError: (err) => toast.error(\`Error deleting expense: \${err.message}\`)\r
        }\r
      );\r
    } else {\r
      deleteExpense.mutate(confirmDelete.uuid, {\r
        onSuccess: () => { toast.success('Expense deleted'); setConfirmDelete(null); },\r
        onError: (err) => toast.error(\`Error deleting expense: \${err.message}\`)\r
      });\r
    }\r
  };\r
\r
  return (\r
    <div className="space-y-5">\r
      <div className="flex items-center justify-between">\r
        <div>\r
          <h1 className="text-2xl font-bold text-foreground">Expenses</h1>\r
          <p className="text-sm text-muted-foreground">{filtered.length} expenses found</p>\r
        </div>\r
        <Button data-testid="btn-create-expense" onClick={() => setShowCreate(true)} className="gap-2">\r
          <Plus className="w-4 h-4" /> New Expense\r
        </Button>\r
      </div>\r
\r
      {/* Filters */}`;

if (content.includes(brokenChunk)) {
  content = content.replace(brokenChunk, fixedChunk);
  fs.writeFileSync(path, content, "utf8");
  console.log("Fixed!");
} else {
  console.log("Not found as-is, trying without CRLF...");
  const b2 = brokenChunk.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const f2 = fixedChunk.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const c2 = content.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  if (c2.includes(b2)) {
    const fixed2 = c2.replace(b2, f2);
    fs.writeFileSync(path, fixed2, "utf8");
    console.log("Fixed (LF)!");
  } else {
    console.log("Still not found. First 100 chars of broken:", JSON.stringify(brokenChunk.slice(0,100)));
  }
}
