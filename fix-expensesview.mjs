import fs from 'fs';
const path = 'src/components/ExpensesView.tsx';
let content = fs.readFileSync(path, 'utf8');

// I will fix the handleCreate function
const correctHandleCreate = `
  const handleCreate = () => {
    if (form.category === 'CUSTOM' && !form.customCategory.trim()) { toast.error("Enter a custom category name"); return; }
    if (!form.amount || Number(form.amount) <= 0) { toast.error("Enter a valid amount"); return; }
    if (isLiabilityPayment && !form.liabilityId) { toast.error("Select a liability to pay"); return; }

    if (form.paymentMethod === 'Split') {
      const splitTotal = form.splitPayments.reduce((sum, split) => sum + Number(split.amount), 0);
      if (splitTotal !== Number(form.amount)) {
        toast.error(\`Split payments total (\${splitTotal}) must equal the expense amount (\${form.amount})\`);
        return;
      }
      if (form.splitPayments.some(s => !s.amount || Number(s.amount) <= 0)) {
        toast.error("All split payments must have a valid amount");
        return;
      }
    }

    const finalCategory = form.category === 'CUSTOM' ? form.customCategory.trim() : form.category;

    const payload: any = {
      category: finalCategory,
      amount: Number(form.amount),
      description: form.description || finalCategory,
      date: form.date ? new Date(form.date).toISOString() : new Date().toISOString(),
      liability_id: isLiabilityPayment ? form.liabilityId : null,
      payment_method: form.paymentMethod,
      split_payments: form.paymentMethod === 'Split' ? form.splitPayments.map(s => ({ method: s.method, amount: Number(s.amount) })) : null,
    };

    if (form.customId.trim()) payload.id = form.customId.trim();

    createExpense.mutate(payload, {
      onSuccess: () => {
        if (form.category === 'Salaries' && form.coachUnpaidIds?.length > 0) {
          markSessionsPaid.mutate(form.coachUnpaidIds);
        }
        if (isLiabilityPayment && selectedLiability) {
          const newPaid = selectedLiability.paid_amount + Number(form.amount);
          const complete = newPaid >= selectedLiability.total_amount;
          toast.success(\`Payment recorded for "\${selectedLiability.name}"\`, {
            description: complete
              ? "Liability fully paid off! ??"
              : \`\${Math.round((newPaid / selectedLiability.total_amount) * 100)}% of total paid\`,
          });
        } else {
          toast.success(\`Expense recorded: \${finalCategory}\`, { description: \`\${Number(form.amount).toLocaleString()} EGP\` });
        }
        resetForm();
        setShowCreate(false);
      },
      onError: (err) => toast.error(\`Error recording expense: \${err.message}\`)
    });
  };
`;

const startIndex = content.indexOf('const handleCreate = () => {');
const endIndex = content.indexOf('const handleSaveEdit = () => {');

if (startIndex !== -1 && endIndex !== -1) {
  content = content.substring(0, startIndex) + correctHandleCreate.trim() + '\n\n  ' + content.substring(endIndex);
  fs.writeFileSync(path, content, 'utf8');
}
