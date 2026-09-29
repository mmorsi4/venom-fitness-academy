import { useState } from "react";
import { Plus, TrendingUp, TrendingDown, DollarSign, Landmark, ChevronLeft, ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from "@/components/ui/dialog";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from "recharts";
import { useInvoices, useExpenses, useLiabilities, useCreateExpense } from "@/hooks/use-data";
import { toast } from "sonner";
import { format } from "date-fns";

const BASE_CATEGORIES = ["Government Bills", "Maintenance", "Salaries", "Loans/Debts", "Purchases", "Other"];
const LIABILITY_CATEGORY = "Liability Payment";

const emptyForm = {
  category: "Maintenance",
  amount: "",
  description: "",
  liabilityId: "",
};

export default function Finance() {
  const { data: invoices = [] } = useInvoices();
  const { data: expenses = [] } = useExpenses();
  const { data: liabilities = [] } = useLiabilities();
  const createExpense = useCreateExpense();

  const [showAddExpense, setShowAddExpense] = useState(false);
  const [form, setForm] = useState(emptyForm);

  // Month/Year filter
  const [filterMonth, setFilterMonth] = useState(new Date().getMonth());
  const [filterYear, setFilterYear] = useState(new Date().getFullYear());

  const isLiabilityPayment = form.category === LIABILITY_CATEGORY;
  const activeLiabilities = liabilities.filter(l => !l.is_complete);
  const selectedLiability = activeLiabilities.find(l => l.id === form.liabilityId);

  // Filter invoices and expenses by selected month/year
  const filteredInvoices = invoices.filter(i => {
    const d = new Date(i.created_at);
    return d.getMonth() === filterMonth && d.getFullYear() === filterYear;
  });

  const filteredExpenses = expenses.filter(e => {
    const d = new Date(e.date);
    return d.getMonth() === filterMonth && d.getFullYear() === filterYear;
  });

  const totalIncome = filteredInvoices.reduce((s, i) => s + i.paid_amount, 0);
  const totalExpenses = filteredExpenses.reduce((s, e) => s + e.amount, 0);
  const netBalance = totalIncome - totalExpenses;

  const cashIncome = filteredInvoices.filter(i => i.payment_method === 'Cash').reduce((s, i) => s + i.paid_amount, 0);
  const visaIncome = filteredInvoices.filter(i => i.payment_method === 'Visa').reduce((s, i) => s + i.paid_amount, 0);
  const instapayIncome = filteredInvoices.filter(i => i.payment_method === 'InstaPay').reduce((s, i) => s + i.paid_amount, 0);

  const allCategories = [...BASE_CATEGORIES, LIABILITY_CATEGORY];
  const expenseByCategory = allCategories.map(cat => ({
    category: cat,
    amount: filteredExpenses.filter(e => e.category === cat).reduce((s, e) => s + e.amount, 0),
  })).filter(c => c.amount > 0);

  // Income by package
  const incomeByPackage = [...new Set(filteredInvoices.map(i => i.package_name).filter(Boolean))]
    .map(pkg => ({
      package: pkg,
      amount: filteredInvoices.filter(i => i.package_name === pkg).reduce((s, i) => s + i.paid_amount, 0),
      count: filteredInvoices.filter(i => i.package_name === pkg).length,
    }))
    .sort((a, b) => b.amount - a.amount);

  // Generate weekly chart data from filtered data
  const chartDataToShow = [
    { name: "Week 1", start: 1, end: 7 },
    { name: "Week 2", start: 8, end: 14 },
    { name: "Week 3", start: 15, end: 21 },
    { name: "Week 4", start: 22, end: 31 },
  ].map(w => ({
    name: w.name,
    Income: filteredInvoices
      .filter(i => { const d = new Date(i.created_at).getDate(); return d >= w.start && d <= w.end; })
      .reduce((s, i) => s + i.paid_amount, 0),
    Expenses: filteredExpenses
      .filter(e => { const d = new Date(e.date).getDate(); return d >= w.start && d <= w.end; })
      .reduce((s, e) => s + e.amount, 0),
  }));

  const handleCategoryChange = (cat: string) => {
    setForm(p => ({
      ...p, category: cat, liabilityId: "",
      amount: cat === LIABILITY_CATEGORY ? "" : p.amount,
      description: cat === LIABILITY_CATEGORY ? "" : p.description,
    }));
  };

  const handleLiabilitySelect = (id: string) => {
    const l = activeLiabilities.find(x => x.id === id);
    setForm(p => ({
      ...p, liabilityId: id,
      amount: l ? String(l.installment_amount) : "",
      description: l ? `${l.type === 'one_time' ? 'Payment' : 'Installment'} — ${l.name}` : "",
    }));
  };

  const handleAddExpense = () => {
    if (!form.amount || Number(form.amount) <= 0) { toast.error("Enter a valid amount"); return; }
    if (isLiabilityPayment && !form.liabilityId) { toast.error("Select a liability to pay"); return; }

    createExpense.mutate({
      category: form.category,
      amount: Number(form.amount),
      description: form.description || form.category,
      date: new Date().toISOString(),
      liability_id: isLiabilityPayment ? form.liabilityId : null,
    }, {
      onSuccess: () => {
        if (isLiabilityPayment && selectedLiability) {
          const newPaid = selectedLiability.paid_amount + Number(form.amount);
          const complete = newPaid >= selectedLiability.total_amount;
          toast.success(`Payment recorded for "${selectedLiability.name}"`, {
            description: complete
              ? "Liability fully paid off! 🎉"
              : `${Math.round((newPaid / selectedLiability.total_amount) * 100)}% of total paid`,
          });
        } else {
          toast.success(`Expense recorded: ${form.category}`, { description: `${Number(form.amount).toLocaleString()} EGP` });
        }
        setForm(emptyForm);
        setShowAddExpense(false);
      },
      onError: (err) => toast.error(`Error recording expense: ${err.message}`)
    });
  };

  const prevMonth = () => {
    if (filterMonth === 0) { setFilterMonth(11); setFilterYear(y => y - 1); }
    else setFilterMonth(m => m - 1);
  };

  const nextMonth = () => {
    if (filterMonth === 11) { setFilterMonth(0); setFilterYear(y => y + 1); }
    else setFilterMonth(m => m + 1);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Financial Management</h1>
          <p className="text-sm text-muted-foreground">Income, expenses, and reports</p>
        </div>
        <Button data-testid="btn-add-expense" onClick={() => setShowAddExpense(true)} variant="outline" className="gap-2">
          <Plus className="w-4 h-4" /> Add Expense
        </Button>
      </div>

      {/* Month/Year Filter */}
      <div className="flex items-center gap-3">
        <Button variant="outline" size="icon" className="h-8 w-8" onClick={prevMonth}>
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <div className="text-center min-w-[140px]">
          <p className="text-sm font-semibold text-foreground">
            {new Date(filterYear, filterMonth).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </p>
        </div>
        <Button variant="outline" size="icon" className="h-8 w-8" onClick={nextMonth}>
          <ChevronRight className="w-4 h-4" />
        </Button>
        <Button
          variant="ghost" size="sm" className="text-xs"
          onClick={() => { setFilterMonth(new Date().getMonth()); setFilterYear(new Date().getFullYear()); }}
        >
          Today
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-emerald-100">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-muted-foreground">Total Income</p>
              <TrendingUp className="w-5 h-5 text-emerald-500" />
            </div>
            <p className="text-3xl font-bold text-emerald-600">{totalIncome.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground mt-1">EGP collected</p>
          </CardContent>
        </Card>
        <Card className="border-red-100">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-muted-foreground">Total Expenses</p>
              <TrendingDown className="w-5 h-5 text-red-500" />
            </div>
            <p className="text-3xl font-bold text-red-600">{totalExpenses.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground mt-1">EGP spent</p>
          </CardContent>
        </Card>
        <Card className={netBalance >= 0 ? "border-emerald-100" : "border-red-100"}>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-muted-foreground">Net Balance</p>
              <DollarSign className={`w-5 h-5 ${netBalance >= 0 ? "text-emerald-500" : "text-red-500"}`} />
            </div>
            <p className={`text-3xl font-bold ${netBalance >= 0 ? "text-emerald-600" : "text-red-600"}`}>
              {netBalance >= 0 ? "" : "-"}{Math.abs(netBalance).toLocaleString()}
            </p>
            <p className="text-xs text-muted-foreground mt-1">EGP net</p>
          </CardContent>
        </Card>
      </div>

      {/* Payment method breakdown */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Cash", amount: cashIncome, color: "bg-amber-100 text-amber-700 border-amber-200" },
          { label: "Visa", amount: visaIncome, color: "bg-blue-100 text-blue-700 border-blue-200" },
          { label: "InstaPay", amount: instapayIncome, color: "bg-violet-100 text-violet-700 border-violet-200" },
        ].map(({ label, amount, color }) => (
          <div key={label} data-testid={`payment-method-${label.toLowerCase()}`} className={`p-4 rounded-xl border ${color} text-center`}>
            <p className="text-xl font-bold">{amount.toLocaleString()}</p>
            <p className="text-xs mt-0.5 font-medium">{label} · EGP</p>
          </div>
        ))}
      </div>

      {/* Income by Package Category */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Income by Package</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {incomeByPackage.length === 0 ? (
            <p className="text-sm text-muted-foreground">No income recorded this month</p>
          ) : (
            incomeByPackage.map(({ package: pkg, amount, count }) => (
              <div key={pkg} className="flex items-center justify-between">
                <div className="flex-1 mr-4">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-foreground font-medium">{pkg}</span>
                    <span className="text-muted-foreground">{amount.toLocaleString()} EGP ({count} invoice{count !== 1 ? 's' : ''})</span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-400 rounded-full"
                      style={{ width: totalIncome > 0 ? `${(amount / totalIncome) * 100}%` : '0%' }}
                    />
                  </div>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Chart */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Weekly Revenue vs Expenses</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartDataToShow} margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 13% 88%)" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: number) => [`${v.toLocaleString()} EGP`]} />
              <Legend />
              <Bar dataKey="Income" fill="#007c00ff" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Expenses" fill="hsl(0 84% 60%)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Expense categories */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Expenses by Category</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {expenseByCategory.length === 0 ? (
              <p className="text-sm text-muted-foreground">No expenses recorded</p>
            ) : (
              expenseByCategory.map(({ category, amount }) => (
                <div key={category} className="flex items-center justify-between">
                  <div className="flex-1 mr-4">
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-foreground font-medium flex items-center gap-1.5">
                        {category === LIABILITY_CATEGORY && <Landmark className="w-3 h-3 text-muted-foreground" />}
                        {category}
                      </span>
                      <span className="text-muted-foreground">{amount.toLocaleString()} EGP</span>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${category === LIABILITY_CATEGORY ? 'bg-amber-400' : 'bg-red-400'}`}
                        style={{ width: totalExpenses > 0 ? `${(amount / totalExpenses) * 100}%` : '0%' }}
                      />
                    </div>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Recent expenses */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Recent Expenses</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {filteredExpenses.slice(0, 8).map(e => (
              <div key={e.id} data-testid={`expense-${e.id}`} className="flex items-center gap-3 p-2.5 rounded-lg bg-muted/50">
                {e.liability_id && <Landmark className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{e.description || e.category}</p>
                  <p className="text-xs text-muted-foreground">{e.category} · {format(new Date(e.date), 'dd MMM')}</p>
                </div>
                <p className="text-sm font-bold text-red-600 flex-shrink-0">{e.amount.toLocaleString()} EGP</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Add Expense Dialog */}
      <Dialog open={showAddExpense} onOpenChange={v => { if (!v) setForm(emptyForm); setShowAddExpense(v); }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Record Expense</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select value={form.category} onValueChange={handleCategoryChange}>
                <SelectTrigger data-testid="select-expense-category"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {allCategories.map(c => (
                    <SelectItem key={c} value={c}>
                      {c === LIABILITY_CATEGORY ? `🏛 ${c}` : c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {isLiabilityPayment && (
              <div className="space-y-1.5">
                <Label>Select Liability *</Label>
                {activeLiabilities.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-2">No active liabilities to pay</p>
                ) : (
                  <Select value={form.liabilityId} onValueChange={handleLiabilitySelect}>
                    <SelectTrigger><SelectValue placeholder="Pick a liability..." /></SelectTrigger>
                    <SelectContent>
                      {activeLiabilities.map(l => (
                        <SelectItem key={l.id} value={l.id}>
                          {l.name} — {l.installment_amount.toLocaleString()} EGP {l.type === 'installment' ? 'installment' : 'one-time'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                {selectedLiability && (
                  <div className="px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-xs space-y-1">
                    <div className="flex justify-between">
                      <span className="text-amber-700">Paid so far</span>
                      <span className="font-medium">{selectedLiability.paid_amount.toLocaleString()} / {selectedLiability.total_amount.toLocaleString()} EGP</span>
                    </div>
                    <div className="h-1.5 bg-amber-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-amber-500 rounded-full"
                        style={{ width: `${Math.round((selectedLiability.paid_amount / selectedLiability.total_amount) * 100)}%` }}
                      />
                    </div>
                    <p className="text-amber-700">{Math.round((selectedLiability.paid_amount / selectedLiability.total_amount) * 100)}% paid</p>
                  </div>
                )}
              </div>
            )}

            <div className="space-y-1.5">
              <Label>Amount (EGP) *</Label>
              <Input
                data-testid="input-expense-amount"
                type="number" placeholder="0"
                value={form.amount}
                onChange={e => setForm(p => ({ ...p, amount: e.target.value }))}
              />
              {isLiabilityPayment && selectedLiability && (
                <p className="text-xs text-muted-foreground">
                  Suggested: {selectedLiability.installment_amount.toLocaleString()} EGP ({selectedLiability.type === 'one_time' ? 'full amount' : `${FREQUENCY_LABELS[selectedLiability.frequency_days] ?? `${selectedLiability.frequency_days}d`} installment`})
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Input
                data-testid="input-expense-description"
                placeholder="Optional description"
                value={form.description}
                onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setForm(emptyForm); setShowAddExpense(false); }}>Cancel</Button>
            <Button data-testid="btn-save-expense" onClick={handleAddExpense} disabled={createExpense.isPending}>
              {isLiabilityPayment ? 'Record Payment' : 'Record Expense'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

const FREQUENCY_LABELS: Record<number, string> = { 7: "weekly", 14: "bi-weekly", 30: "monthly", 90: "quarterly" };
