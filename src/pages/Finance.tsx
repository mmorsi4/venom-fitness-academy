import { useState } from "react";
import { Plus, TrendingUp, TrendingDown, DollarSign, Landmark } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

const chartData = [
  { name: "Week 1", Income: 4200, Expenses: 1800 },
  { name: "Week 2", Income: 5800, Expenses: 2200 },
  { name: "Week 3", Income: 3900, Expenses: 1500 },
  { name: "Week 4", Income: 6200, Expenses: 2800 },
];

const monthlyData = [
  { name: "Jan", Income: 18000, Expenses: 8500 },
  { name: "Feb", Income: 22000, Expenses: 9200 },
  { name: "Mar", Income: 28000, Expenses: 11000 },
  { name: "Apr", Income: 25000, Expenses: 10500 },
  { name: "May", Income: 31000, Expenses: 12000 },
  { name: "Jun", Income: 27000, Expenses: 9800 },
];

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

  const [period, setPeriod] = useState("monthly");
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const isLiabilityPayment = form.category === LIABILITY_CATEGORY;
  const activeLiabilities = liabilities.filter(l => !l.is_complete);
  const selectedLiability = activeLiabilities.find(l => l.id === form.liabilityId);

  const totalIncome = invoices.reduce((s, i) => s + i.paid_amount, 0);
  const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);
  const netBalance = totalIncome - totalExpenses;

  const cashIncome = invoices.filter(i => i.payment_method === 'Cash').reduce((s, i) => s + i.paid_amount, 0);
  const visaIncome = invoices.filter(i => i.payment_method === 'Visa').reduce((s, i) => s + i.paid_amount, 0);
  const instapayIncome = invoices.filter(i => i.payment_method === 'InstaPay').reduce((s, i) => s + i.paid_amount, 0);

  const allCategories = [...BASE_CATEGORIES, LIABILITY_CATEGORY];
  const expenseByCategory = allCategories.map(cat => ({
    category: cat,
    amount: expenses.filter(e => e.category === cat).reduce((s, e) => s + e.amount, 0),
  })).filter(c => c.amount > 0);

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

  const chartDataToShow = period === "monthly" ? monthlyData : chartData;

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

      {/* Chart */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold">Revenue vs Expenses</CardTitle>
            <Tabs value={period} onValueChange={setPeriod}>
              <TabsList className="h-7">
                <TabsTrigger value="weekly" className="text-xs h-6">Weekly</TabsTrigger>
                <TabsTrigger value="monthly" className="text-xs h-6">Monthly</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
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
            {expenses.slice().reverse().slice(0, 8).map(e => (
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
