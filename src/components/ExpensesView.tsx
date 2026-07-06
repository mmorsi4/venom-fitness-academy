import { useState } from "react";
import { Plus, Trash2, Pencil, Search, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle
} from "@/components/ui/alert-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { useExpenses, useLiabilities, useCoaches, useClasses, useCoachCheckInsForMonth, useMembers, useCreateExpense, useUpdateExpense, useDeleteExpense, useMarkCoachSessionsPaid, useDeleteExpenseWithRollback, useEmployees, useEmployeeCheckIns, useEmployeeDeductions, useCreateEmployeeDeduction, useCoachDeductions, useDeleteCoachDeduction } from "@/hooks/use-data";
import { calculateCoachPayroll } from "@/lib/utils";
import { toast } from "sonner";
import { format } from "date-fns";

import type { Expense } from "@/lib/types";

const BASE_CATEGORIES = ["Government Bills", "Maintenance", "Salaries", "Loans/Debts", "Purchases", "Other"];
const LIABILITY_CATEGORY = "Liability Payment";
const paymentMethods = ["Cash", "Visa", "InstaPay", "Split"] as const;

const emptyForm = {
  customId: "",
  category: "Maintenance",
  customCategory: "",
  amount: "",
  description: "",
  liabilityId: "",
  date: "",
  paymentMethod: "Cash",
  splitPayments: [] as { method: string; amount: string }[],
  coachId: "",
  coachUnpaidIds: [] as string[],
  employeeId: "",
  employeeBonus: 0,
  includeCoachAdjustments: false
};

export function ExpensesView() {
  const { data: expenses = [] } = useExpenses();
  const { data: liabilities = [] } = useLiabilities();
  const createExpense = useCreateExpense();
  const markSessionsPaid = useMarkCoachSessionsPaid();
  const deleteCoachDeduction = useDeleteCoachDeduction();
  const { data: coaches = [] } = useCoaches();
  const { data: classes = [] } = useClasses();
  const { data: coachCheckIns = [] } = useCoachCheckInsForMonth(new Date().getMonth(), new Date().getFullYear());
  const { data: members = [] } = useMembers();
  const { data: employees = [] } = useEmployees();
  const { data: employeeCheckIns = [] } = useEmployeeCheckIns(new Date().getMonth(), new Date().getFullYear());
  const { data: employeeDeductionsAll = [] } = useEmployeeDeductions();
  const { data: coachDeductions = [] } = useCoachDeductions();
  const createEmployeeDeduction = useCreateEmployeeDeduction();
  const updateExpense = useUpdateExpense();
  const deleteExpense = useDeleteExpense();
  const deleteExpenseWithRollback = useDeleteExpenseWithRollback();

  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ 
    ...emptyForm, 
    salaryTarget: 'coach' as 'coach' | 'employee',
    ptPayCount: 0,
    groupMainPayCount: 0,
    groupSubPayCount: 0
  });

  // Edit/Delete
  const [editExpense, setEditExpense] = useState<Expense | null>(null);
  const [editForm, setEditForm] = useState({ category: "", customCategory: "", amount: "", description: "", date: "", paymentMethod: "Cash", splitPayments: [] as { method: string; amount: string }[] });
  const [confirmDelete, setConfirmDelete] = useState<Expense | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [searchField, setSearchField] = useState("all");
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 25;

  const uniqueExistingCategories = [...new Set(expenses.map(e => e.category))];
  const dynamicCategories = [...new Set([...BASE_CATEGORIES, ...uniqueExistingCategories])].filter(c => c !== LIABILITY_CATEGORY);
  const allCategories = [...dynamicCategories, LIABILITY_CATEGORY, "CUSTOM"];

  const isLiabilityPayment = form.category === LIABILITY_CATEGORY;
  const activeLiabilities = liabilities.filter(l => !l.is_complete);
  const selectedLiability = activeLiabilities.find(l => l.id === form.liabilityId);

  // Filter Logic
  const filtered = expenses.filter(e => {
    // Search
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      let matchesSearch = false;
      if (searchField === "all") {
        matchesSearch = e.id.toLowerCase().includes(q) || e.description.toLowerCase().includes(q);
      } else if (searchField === "id") {
        matchesSearch = e.id.toLowerCase().includes(q);
      } else if (searchField === "desc") {
        matchesSearch = e.description.toLowerCase().includes(q);
      }
      if (!matchesSearch) return false;
    }

    // Category
    if (filterCategory !== "all" && e.category !== filterCategory) return false;

    // Date
    if (filterDateFrom && new Date(e.date) < new Date(filterDateFrom)) return false;
    if (filterDateTo) {
      const toDate = new Date(filterDateTo);
      toDate.setHours(23, 59, 59, 999);
      if (new Date(e.date) > toDate) return false;
    }

    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paginated = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const resetForm = () => setForm({ ...emptyForm, salaryTarget: 'coach', ptPayCount: 0, groupMainPayCount: 0, groupSubPayCount: 0 });

  const handleCategoryChange = (cat: string) => {
    setForm(p => ({
      ...p, category: cat, liabilityId: "", customCategory: "",
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

  const handleCreate = () => {
    if (form.category === 'CUSTOM' && !form.customCategory.trim()) { toast.error("Enter a custom category name"); return; }
    if (!form.amount || Number(form.amount) <= 0) { toast.error("Enter a valid amount"); return; }
    if (isLiabilityPayment && !form.liabilityId) { toast.error("Select a liability to pay"); return; }

    if (form.paymentMethod === 'Split') {
      const splitTotal = form.splitPayments.reduce((sum, split) => sum + Number(split.amount), 0);
      if (splitTotal !== Number(form.amount)) {
        toast.error(`Split payments total (${splitTotal}) must equal the expense amount (${form.amount})`);
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
        if (form.category === 'Salaries' && form.salaryTarget === 'coach' && form.coachUnpaidIds?.length > 0) {
          markSessionsPaid.mutate(form.coachUnpaidIds);
        }
        if (form.category === 'Salaries' && form.salaryTarget === 'coach' && form.includeCoachAdjustments && form.coachId) {
          const now = new Date();
          const monthDeductions = coachDeductions.filter(d => d.coach_id === form.coachId && new Date(d.date).getMonth() === now.getMonth() && new Date(d.date).getFullYear() === now.getFullYear());
          monthDeductions.forEach(d => {
            deleteCoachDeduction.mutate(d.id);
          });
        }
        if (form.category === 'Salaries' && form.salaryTarget === 'employee' && form.employeeId && form.employeeBonus > 0) {
          createEmployeeDeduction.mutate({
            employee_id: form.employeeId,
            amount: form.employeeBonus,
            date: new Date().toISOString(),
            reason: "Salary Manual Bonus"
          });
        }
        if (isLiabilityPayment && selectedLiability) {
          const newPaid = selectedLiability.paid_amount + Number(form.amount);
          const complete = newPaid >= selectedLiability.total_amount;
          toast.success(`Payment recorded for "${selectedLiability.name}"`, {
            description: complete
              ? "Liability fully paid off! ??"
              : `${Math.round((newPaid / selectedLiability.total_amount) * 100)}% of total paid`,
          });
        } else {
          toast.success(`Expense recorded: ${finalCategory}`, { description: `${Number(form.amount).toLocaleString()} EGP` });
        }
        resetForm();
        setShowCreate(false);
      },
      onError: (err) => toast.error(`Error recording expense: ${err.message}`)
    });
  };

  const handleCoachSelectionChange = (coachId: string, ptCount: number, mainCount: number, subCount: number, isInitial = false, includeAdjustments = false) => {
    const coach = coaches.find(c => c.id === coachId);
    if (!coach) return;
    const now = new Date();
    const checkInsThisMonth = coachCheckIns.filter(ci => new Date(ci.check_in_date).getMonth() === now.getMonth() && new Date(ci.check_in_date).getFullYear() === now.getFullYear());

    const ptUnpaid = checkInsThisMonth.filter(ci => ci.coach_id === coachId && ci.session_type === 'pt' && !ci.is_paid).sort((a,b) => a.check_in_date.localeCompare(b.check_in_date));
    const mainUnpaid = checkInsThisMonth.filter(ci => ci.coach_id === coachId && ci.session_type === 'group' && !ci.is_substitute && !ci.is_paid).sort((a,b) => a.check_in_date.localeCompare(b.check_in_date));
    const subUnpaid = checkInsThisMonth.filter(ci => ci.coach_id === coachId && ci.session_type === 'group' && ci.is_substitute && !ci.is_paid).sort((a,b) => a.check_in_date.localeCompare(b.check_in_date));

    const targetPtCount = isInitial ? ptUnpaid.length : ptCount;
    const targetMainCount = isInitial ? mainUnpaid.length : mainCount;
    const targetSubCount = isInitial ? subUnpaid.length : subCount;

    const finalPtCount = Math.min(Math.max(0, targetPtCount), ptUnpaid.length);
    const finalMainCount = Math.min(Math.max(0, targetMainCount), mainUnpaid.length);
    const finalSubCount = Math.min(Math.max(0, targetSubCount), subUnpaid.length);

    const selectedPt = ptUnpaid.slice(0, finalPtCount);
    const selectedMain = mainUnpaid.slice(0, finalMainCount);
    const selectedSub = subUnpaid.slice(0, finalSubCount);

    let owed = 0;
    const ptPct = coach.pt_percentage ?? 100;
    const actualPtRate = (coach.pt_rate || 250) * (ptPct / 100);
    if (coach.payment_type === 'per_session') {
      owed = (finalMainCount + finalSubCount) * coach.rate + (finalPtCount * actualPtRate);
    } else {
      const stats = calculateCoachPayroll(coach, now.getMonth(), now.getFullYear(), classes, checkInsThisMonth, 0, 0, coachDeductions);
      const originalScheduled = stats.scheduledSlotsInMonth + checkInsThisMonth.filter(ci => ci.coach_id === coachId && ci.session_type === 'group' && !ci.is_substitute && ci.is_paid).length;
      const perSessionRate = originalScheduled > 0 ? (coach.rate / originalScheduled) : 0;
      owed = (finalSubCount * perSessionRate) + (finalPtCount * actualPtRate);
    }

    const monthDeductions = coachDeductions.filter(d => d.coach_id === coachId && new Date(d.date).getMonth() === now.getMonth() && new Date(d.date).getFullYear() === now.getFullYear());
    const netAdjustment = monthDeductions.reduce((s, d) => s + d.amount, 0);

    const autoInclude = isInitial && finalPtCount === ptUnpaid.length && finalMainCount === mainUnpaid.length && finalSubCount === subUnpaid.length;
    const finalIncludeAdjustments = isInitial ? autoInclude : includeAdjustments;

    if (finalIncludeAdjustments && netAdjustment !== 0) {
      owed += netAdjustment;
    }

    const ids = [...selectedPt, ...selectedMain, ...selectedSub].map(ci => ci.id);
    const parts = [];
    if (finalMainCount > 0) parts.push(`${finalMainCount} Group`);
    if (finalSubCount > 0) parts.push(`${finalSubCount} Sub`);
    if (finalPtCount > 0) parts.push(`${finalPtCount} PT`);
    
    let partsStr = parts.join(', ');
    if (finalIncludeAdjustments && netAdjustment !== 0) {
      partsStr += ` + ${netAdjustment > 0 ? 'Bonus' : 'Deduction'} (${netAdjustment} EGP)`;
    }

    setForm(p => ({
      ...p,
      coachId,
      amount: String(Math.max(0, owed)),
      coachUnpaidIds: ids,
      ptPayCount: finalPtCount,
      groupMainPayCount: finalMainCount,
      groupSubPayCount: finalSubCount,
      includeCoachAdjustments: finalIncludeAdjustments,
      description: `Salary payment for ${coach.name} ${partsStr ? `(${partsStr})` : ''}`
    }));
  };

  const handleSaveEdit = () => {
    if (!editExpense) return;
    if (editForm.category === 'CUSTOM' && !editForm.customCategory.trim()) { toast.error("Enter a custom category name"); return; }
    if (!editForm.amount || Number(editForm.amount) <= 0) { toast.error("Enter a valid amount"); return; }

    if (editForm.paymentMethod === 'Split') {
      const splitTotal = editForm.splitPayments.reduce((sum, split) => sum + Number(split.amount), 0);
      if (splitTotal !== Number(editForm.amount)) {
        toast.error(`Split payments total (${splitTotal}) must equal the expense amount (${editForm.amount})`);
        return;
      }
      if (editForm.splitPayments.some(s => !s.amount || Number(s.amount) <= 0)) {
        toast.error("All split payments must have a valid amount");
        return;
      }
    }

    const finalCategory = editForm.category === 'CUSTOM' ? editForm.customCategory.trim() : editForm.category;

    updateExpense.mutate({
      uuid: editExpense.uuid,
      updates: {
        category: finalCategory,
        amount: Number(editForm.amount),
        description: editForm.description || finalCategory,
        date: editForm.date ? new Date(editForm.date).toISOString() : editExpense.date,
        payment_method: editForm.paymentMethod as any,
        split_payments: editForm.paymentMethod === 'Split' ? editForm.splitPayments.map(s => ({ method: s.method as any, amount: Number(s.amount) })) : null,
      }
    }, {
      onSuccess: () => {
        toast.success("Expense updated");
        setEditExpense(null);
      },
      onError: (err) => toast.error(`Error updating expense: ${err.message}`)
    });
  };

  const handleDelete = () => {
    if (!confirmDelete) return;
    if (confirmDelete.category === 'Salaries' && confirmDelete.coach_id) {
      deleteExpenseWithRollback.mutate(
        { expenseId: confirmDelete.uuid, coachId: confirmDelete.coach_id },
        {
          onSuccess: () => { toast.success('Expense deleted & sessions restored'); setConfirmDelete(null); },
          onError: (err) => toast.error(`Error deleting expense: ${err.message}`)
        }
      );
    } else {
      deleteExpense.mutate(confirmDelete.uuid, {
        onSuccess: () => { toast.success('Expense deleted'); setConfirmDelete(null); },
        onError: (err) => toast.error(`Error deleting expense: ${err.message}`)
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

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
        <div className="flex flex-wrap gap-2">
          <Select value={searchField} onValueChange={setSearchField}>
            <SelectTrigger className="w-[130px] h-9">
              <SelectValue placeholder="Search by..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Fields</SelectItem>
              <SelectItem value="id">Expense ID</SelectItem>
              <SelectItem value="desc">Description</SelectItem>
            </SelectContent>
          </Select>
          <div className="relative w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search expenses..."
              className="pl-9 h-9"
              value={searchQuery}
              onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); }}
            />
          </div>
        </div>

        <Select value={filterCategory} onValueChange={setFilterCategory}>
          <SelectTrigger className="w-48 h-9">
            <SelectValue placeholder="Category..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {uniqueExistingCategories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>

        <Input
          type="date"
          value={filterDateFrom}
          onChange={e => setFilterDateFrom(e.target.value)}
          className="w-36 h-9"
          title="From date"
        />
        <Input
          type="date"
          value={filterDateTo}
          onChange={e => setFilterDateTo(e.target.value)}
          className="w-36 h-9"
          title="To date"
        />
      </div>

      {/* Table */}
      <Card className="shadow-sm">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="w-[100px] font-semibold text-foreground">ID</TableHead>
                  <TableHead className="font-semibold text-foreground">Date</TableHead>
                  <TableHead className="font-semibold text-foreground">Category</TableHead>
                  <TableHead className="font-semibold text-foreground">Description</TableHead>
                  <TableHead className="text-right font-semibold text-foreground">Amount</TableHead>
                  <TableHead className="w-[100px] text-right font-semibold text-foreground">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginated.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      No expenses found
                    </TableCell>
                  </TableRow>
                ) : (
                  paginated.map(expense => (
                    <TableRow key={expense.uuid} className="hover:bg-muted/30">
                      <TableCell className="font-medium">{expense.id}</TableCell>
                      <TableCell>{format(new Date(expense.date), 'dd/MM/yyyy')}</TableCell>
                      <TableCell>{expense.category}</TableCell>
                      <TableCell>{expense.description}</TableCell>
                      <TableCell className="text-right font-semibold text-red-600">
                        <div className="flex flex-col items-end">
                          <span>{expense.amount.toLocaleString()} EGP</span>
                          <span className="text-xs font-normal text-muted-foreground">{expense.payment_method}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right space-x-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-primary"
                          onClick={() => {
                            setEditExpense(expense);
                            setEditForm({
                              category: uniqueExistingCategories.includes(expense.category) ? expense.category : 'CUSTOM',
                              customCategory: uniqueExistingCategories.includes(expense.category) ? '' : expense.category,
                              amount: String(expense.amount),
                              description: expense.description,
                              date: new Date(expense.date).toISOString().slice(0, 10),
                              paymentMethod: expense.payment_method || 'Cash',
                              splitPayments: expense.split_payments ? expense.split_payments.map(s => ({ method: s.method, amount: String(s.amount) })) : [],
                            });
                          }}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-red-600"
                          onClick={() => setConfirmDelete(expense)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t">
              <p className="text-sm text-muted-foreground">Page {currentPage} of {totalPages}</p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>Previous</Button>
                <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>Next</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={v => { if (!v) resetForm(); setShowCreate(v); }}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Record Expense</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Custom Expense ID (Optional)</Label>
              <Input
                placeholder="Leave blank for auto-generation"
                value={form.customId}
                onChange={e => setForm(p => ({ ...p, customId: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground">Leave empty to continue the sequence.</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Date</Label>
                <Input
                  type="date"
                  value={form.date}
                  onChange={e => setForm(p => ({ ...p, date: e.target.value }))}
                />
              </div>
            </div>

                        {form.category === 'Salaries' && (
              <div className="space-y-3 p-3 bg-muted/50 rounded-lg border border-border mt-3 mb-3">
                <div className="flex gap-4 border-b border-border pb-3 mb-3">
                  <div className="flex-1">
                    <Label>Pay To</Label>
                    <Select value={form.salaryTarget} onValueChange={(v: 'coach'|'employee') => setForm(p => ({ ...p, salaryTarget: v, coachId: '', employeeId: '', amount: '' }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="coach">Coach</SelectItem>
                        <SelectItem value="employee">Employee</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {form.salaryTarget === 'coach' ? (
                  <>                      <div className="space-y-1.5">
                        <Label>Select Coach</Label>
                        <Select value={form.coachId} onValueChange={(id) => handleCoachSelectionChange(id, 0, 0, 0, true)}>
                          <SelectTrigger><SelectValue placeholder="Select a coach..." /></SelectTrigger>
                          <SelectContent>
                            {coaches.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      {form.coachId && (() => {
                        const monthDeductions = coachDeductions.filter(d => d.coach_id === form.coachId && new Date(d.date).getMonth() === new Date().getMonth() && new Date(d.date).getFullYear() === new Date().getFullYear());
                        const netAdjustment = monthDeductions.reduce((s, d) => s + d.amount, 0);
                        return (
                        <div className="flex flex-col gap-3 mt-3 bg-muted/30 p-3 rounded-lg border">
                          <p className="text-sm font-semibold mb-1">Select Sessions to Pay</p>
                          <div className="flex items-center gap-4">
                            <div className="space-y-1.5 flex-1">
                              <Label>PT</Label>
                              <div className="flex items-center gap-2">
                                <Input type="number" min="0" value={form.ptPayCount} onChange={(e) => handleCoachSelectionChange(form.coachId, parseInt(e.target.value) || 0, form.groupMainPayCount, form.groupSubPayCount, false, form.includeCoachAdjustments)} />
                                <span className="text-sm text-muted-foreground whitespace-nowrap">/ {coachCheckIns.filter(ci => ci.coach_id === form.coachId && ci.session_type === 'pt' && !ci.is_paid).length}</span>
                              </div>
                            </div>
                            <div className="space-y-1.5 flex-1">
                              <Label>Group</Label>
                              <div className="flex items-center gap-2">
                                <Input type="number" min="0" value={form.groupMainPayCount} onChange={(e) => handleCoachSelectionChange(form.coachId, form.ptPayCount, parseInt(e.target.value) || 0, form.groupSubPayCount, false, form.includeCoachAdjustments)} />
                                <span className="text-sm text-muted-foreground whitespace-nowrap">/ {coachCheckIns.filter(ci => ci.coach_id === form.coachId && ci.session_type === 'group' && !ci.is_substitute && !ci.is_paid).length}</span>
                              </div>
                            </div>
                            <div className="space-y-1.5 flex-1">
                              <Label>Substitute</Label>
                              <div className="flex items-center gap-2">
                                <Input type="number" min="0" value={form.groupSubPayCount} onChange={(e) => handleCoachSelectionChange(form.coachId, form.ptPayCount, form.groupMainPayCount, parseInt(e.target.value) || 0, false, form.includeCoachAdjustments)} />
                                <span className="text-sm text-muted-foreground whitespace-nowrap">/ {coachCheckIns.filter(ci => ci.coach_id === form.coachId && ci.session_type === 'group' && ci.is_substitute && !ci.is_paid).length}</span>
                              </div>
                            </div>
                          </div>
                          {monthDeductions.length > 0 && (
                            <div className="flex items-center gap-2 mt-2 pt-2 border-t">
                              <Checkbox 
                                checked={form.includeCoachAdjustments}
                                onCheckedChange={(c) => {
                                  const isChecked = !!c;
                                  handleCoachSelectionChange(form.coachId, form.ptPayCount, form.groupMainPayCount, form.groupSubPayCount, false, isChecked);
                                }}
                              />
                              <Label className="text-sm cursor-pointer" onClick={() => handleCoachSelectionChange(form.coachId, form.ptPayCount, form.groupMainPayCount, form.groupSubPayCount, false, !form.includeCoachAdjustments)}>
                                Include Month's Adjustments ({netAdjustment > 0 ? '+' : ''}{netAdjustment} EGP)
                              </Label>
                            </div>
                          )}
                        </div>
                      )})()}
                  </>
                ) : (
                  <>
                    <div className="space-y-1.5">
                      <Label>Select Employee</Label>
                      <Select value={form.employeeId} onValueChange={(id) => {
                        const emp = employees.find(e => e.id === id);
                        if (!emp) return;
                        
                        const lateDeductions = employeeCheckIns
                          .filter(ci => ci.employee_id === emp.id)
                          .reduce((s, ci) => s + (ci.deduction || 0), 0);
                          
                        const explicitDeductions = employeeDeductionsAll
                          .filter(d => d.employee_id === emp.id)
                          .reduce((s, d) => s + d.amount, 0);
                          
                        const totalDeds = lateDeductions + explicitDeductions;
                        const netSalary = emp.rate - totalDeds;

                        setForm(p => ({
                          ...p,
                          employeeId: id,
                          employeeBonus: 0,
                          amount: String(Math.max(0, netSalary)),
                          description: `Salary payment for ${emp.name} (Base: ${emp.rate}, Ded: ${totalDeds})`
                        }));
                      }}>
                        <SelectTrigger><SelectValue placeholder="Select an employee..." /></SelectTrigger>
                        <SelectContent>
                          {employees.map(e => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    {form.employeeId && (() => {
                      const emp = employees.find(e => e.id === form.employeeId);
                      if (!emp) return null;
                      
                      const lateDeductions = employeeCheckIns
                        .filter(ci => ci.employee_id === emp.id)
                        .reduce((s, ci) => s + (ci.deduction || 0), 0);
                        
                      const explicitDeductions = employeeDeductionsAll
                        .filter(d => d.employee_id === emp.id)
                        .reduce((s, d) => s + d.amount, 0);
                        
                      const totalDeds = lateDeductions + explicitDeductions;
                      const netSalary = emp.rate - totalDeds;
                      
                      return (
                        <div className="grid grid-cols-2 gap-4 mt-3">
                          <div className="space-y-1.5">
                            <Label>Base Rate</Label>
                            <Input readOnly value={`${emp.rate} EGP`} className="bg-muted" />
                          </div>
                          <div className="space-y-1.5">
                            <Label>Deductions</Label>
                            <Input readOnly value={`${totalDeds} EGP`} className="bg-muted text-red-600 font-semibold" />
                          </div>
                          <div className="space-y-1.5 col-span-2">
                            <Label>Manual Bonus (EGP)</Label>
                            <Input 
                              type="number" 
                              min="0"
                              value={form.employeeBonus || ''} 
                              onChange={e => {
                                const bonus = Number(e.target.value) || 0;
                                setForm(p => ({
                                  ...p,
                                  employeeBonus: bonus,
                                  amount: String(Math.max(0, netSalary + bonus))
                                }));
                              }} 
                              placeholder="e.g. 500" 
                            />
                          </div>
                        </div>
                      );
                    })()}
                  </>
                )}
              </div>
            )}

            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select value={form.category} onValueChange={handleCategoryChange}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {allCategories.map(c => (
                    <SelectItem key={c} value={c}>
                      {c === 'CUSTOM' ? 'Add Custom Category...' : c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {form.category === 'CUSTOM' && (
              <div className="space-y-1.5">
                <Label>Custom Category Name *</Label>
                <Input
                  autoFocus
                  placeholder="e.g., Water Bill"
                  value={form.customCategory}
                  onChange={e => setForm(p => ({ ...p, customCategory: e.target.value }))}
                />
              </div>
            )}

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
                          {l.name} — {l.installment_amount.toLocaleString()} EGP
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            )}



            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Payment Method</Label>
                <Select value={form.paymentMethod} onValueChange={v => setForm(p => ({ 
                  ...p, 
                  paymentMethod: v,
                  splitPayments: v === 'Split' && p.splitPayments.length === 0 ? [{ method: 'Cash', amount: '' }] : p.splitPayments
                }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {paymentMethods.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Amount (EGP) *</Label>
                <Input
                  type="number" placeholder="0"
                  value={form.amount}
                  onChange={e => setForm(p => ({ ...p, amount: e.target.value }))}
                />
              </div>
            </div>

            {form.paymentMethod === 'Split' && (
              <div className="space-y-3 p-3 border rounded-md bg-muted/20">
                <div className="flex items-center justify-between">
                  <Label>Split Details</Label>
                  <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={() => setForm(p => ({ ...p, splitPayments: [...p.splitPayments, { method: 'Cash', amount: '' }] }))}>
                    <Plus className="w-3 h-3 mr-1" /> Add Split
                  </Button>
                </div>
                {form.splitPayments.map((split, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Select value={split.method} onValueChange={v => {
                      const newSplits = [...form.splitPayments];
                      newSplits[i].method = v;
                      setForm(p => ({ ...p, splitPayments: newSplits }));
                    }}>
                      <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {paymentMethods.filter(m => m !== 'Split').map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Input
                      type="number" placeholder="Amount" value={split.amount}
                      onChange={e => {
                        const newSplits = [...form.splitPayments];
                        newSplits[i].amount = e.target.value;
                        setForm(p => ({ ...p, splitPayments: newSplits }));
                      }}
                    />
                    {form.splitPayments.length > 1 && (
                      <Button variant="ghost" size="icon" className="h-9 w-9 text-red-500" onClick={() => {
                        const newSplits = form.splitPayments.filter((_, idx) => idx !== i);
                        setForm(p => ({ ...p, splitPayments: newSplits }));
                      }}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Input
                placeholder="Optional description"
                value={form.description}
                onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { resetForm(); setShowCreate(false); }}>Cancel</Button>
            <Button onClick={handleCreate} disabled={createExpense.isPending}>
              {createExpense.isPending ? "Saving..." : isLiabilityPayment ? 'Record Payment' : 'Record Expense'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editExpense} onOpenChange={v => { if (!v) setEditExpense(null); }}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Edit Expense {editExpense?.id}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Date</Label>
              <Input
                type="date"
                value={editForm.date}
                onChange={e => setEditForm(p => ({ ...p, date: e.target.value }))}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select value={editForm.category} onValueChange={v => setEditForm(p => ({ ...p, category: v, customCategory: v === 'CUSTOM' ? '' : p.customCategory }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {allCategories.filter(c => c !== LIABILITY_CATEGORY).map(c => (
                    <SelectItem key={c} value={c}>
                      {c === 'CUSTOM' ? 'Add Custom Category...' : c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {editForm.category === 'CUSTOM' && (
              <div className="space-y-1.5">
                <Label>Custom Category Name *</Label>
                <Input
                  autoFocus
                  placeholder="e.g., Water Bill"
                  value={editForm.customCategory}
                  onChange={e => setEditForm(p => ({ ...p, customCategory: e.target.value }))}
                />
              </div>
            )}


            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Payment Method</Label>
                <Select value={editForm.paymentMethod} onValueChange={v => setEditForm(p => ({ 
                  ...p, 
                  paymentMethod: v,
                  splitPayments: v === 'Split' && p.splitPayments.length === 0 ? [{ method: 'Cash', amount: '' }] : p.splitPayments
                }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {paymentMethods.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Amount (EGP) *</Label>
                <Input
                  type="number" placeholder="0"
                  value={editForm.amount}
                  onChange={e => setEditForm(p => ({ ...p, amount: e.target.value }))}
                />
              </div>
            </div>

            {editForm.paymentMethod === 'Split' && (
              <div className="space-y-3 p-3 border rounded-md bg-muted/20">
                <div className="flex items-center justify-between">
                  <Label>Split Details</Label>
                  <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={() => setEditForm(p => ({ ...p, splitPayments: [...p.splitPayments, { method: 'Cash', amount: '' }] }))}>
                    <Plus className="w-3 h-3 mr-1" /> Add Split
                  </Button>
                </div>
                {editForm.splitPayments.map((split, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Select value={split.method} onValueChange={v => {
                      const newSplits = [...editForm.splitPayments];
                      newSplits[i].method = v;
                      setEditForm(p => ({ ...p, splitPayments: newSplits }));
                    }}>
                      <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {paymentMethods.filter(m => m !== 'Split').map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Input
                      type="number" placeholder="Amount" value={split.amount}
                      onChange={e => {
                        const newSplits = [...editForm.splitPayments];
                        newSplits[i].amount = e.target.value;
                        setEditForm(p => ({ ...p, splitPayments: newSplits }));
                      }}
                    />
                    {editForm.splitPayments.length > 1 && (
                      <Button type="button" variant="ghost" size="icon" className="h-9 w-9 text-red-500" onClick={() => {
                        const newSplits = editForm.splitPayments.filter((_, idx) => idx !== i);
                        setEditForm(p => ({ ...p, splitPayments: newSplits }));
                      }}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Input
                placeholder="Optional description"
                value={editForm.description}
                onChange={e => setEditForm(p => ({ ...p, description: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditExpense(null)}>Cancel</Button>
            <Button onClick={handleSaveEdit} disabled={updateExpense.isPending}>
              {updateExpense.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={!!confirmDelete} onOpenChange={v => { if (!v) setConfirmDelete(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Expense</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete expense #{confirmDelete?.id}? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700"
              disabled={deleteExpense.isPending}
            >
              {deleteExpense.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
