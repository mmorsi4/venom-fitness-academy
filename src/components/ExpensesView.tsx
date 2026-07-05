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
import { useExpenses, useLiabilities, useCreateExpense, useUpdateExpense, useDeleteExpense } from "@/hooks/use-data";
import { toast } from "sonner";
import { format } from "date-fns";
import type { Expense } from "@/lib/types";

const BASE_CATEGORIES = ["Government Bills", "Maintenance", "Salaries", "Loans/Debts", "Purchases", "Other"];
const LIABILITY_CATEGORY = "Liability Payment";

const emptyForm = {
  customId: "",
  category: "Maintenance",
  customCategory: "",
  amount: "",
  description: "",
  liabilityId: "",
  date: "",
};

export function ExpensesView() {
  const { data: expenses = [] } = useExpenses();
  const { data: liabilities = [] } = useLiabilities();
  const createExpense = useCreateExpense();
  const updateExpense = useUpdateExpense();
  const deleteExpense = useDeleteExpense();

  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(emptyForm);

  // Edit/Delete
  const [editExpense, setEditExpense] = useState<Expense | null>(null);
  const [editForm, setEditForm] = useState({ category: "", customCategory: "", amount: "", description: "", date: "" });
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

  const resetForm = () => setForm(emptyForm);

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

    const finalCategory = form.category === 'CUSTOM' ? form.customCategory.trim() : form.category;
    
    const payload: any = {
      category: finalCategory,
      amount: Number(form.amount),
      description: form.description || finalCategory,
      date: form.date ? new Date(form.date).toISOString() : new Date().toISOString(),
      liability_id: isLiabilityPayment ? form.liabilityId : null,
    };

    if (form.customId.trim()) payload.id = form.customId.trim();

    createExpense.mutate(payload, {
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
          toast.success(`Expense recorded: ${finalCategory}`, { description: `${Number(form.amount).toLocaleString()} EGP` });
        }
        resetForm();
        setShowCreate(false);
      },
      onError: (err) => toast.error(`Error recording expense: ${err.message}`)
    });
  };

  const handleSaveEdit = () => {
    if (!editExpense) return;
    if (editForm.category === 'CUSTOM' && !editForm.customCategory.trim()) { toast.error("Enter a custom category name"); return; }
    if (!editForm.amount || Number(editForm.amount) <= 0) { toast.error("Enter a valid amount"); return; }

    const finalCategory = editForm.category === 'CUSTOM' ? editForm.customCategory.trim() : editForm.category;

    updateExpense.mutate({
      uuid: editExpense.uuid,
      updates: {
        category: finalCategory,
        amount: Number(editForm.amount),
        description: editForm.description || finalCategory,
        date: editForm.date ? new Date(editForm.date).toISOString() : editExpense.date,
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
    deleteExpense.mutate(confirmDelete.uuid, {
      onSuccess: () => {
        toast.success("Expense deleted");
        setConfirmDelete(null);
      },
      onError: (err) => toast.error(`Error deleting expense: ${err.message}`)
    });
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
                      <TableCell>{format(new Date(expense.date), 'dd MMM yyyy')}</TableCell>
                      <TableCell>{expense.category}</TableCell>
                      <TableCell>{expense.description}</TableCell>
                      <TableCell className="text-right font-semibold text-red-600">
                        {expense.amount.toLocaleString()} EGP
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

            <div className="space-y-1.5">
              <Label>Amount (EGP) *</Label>
              <Input
                type="number" placeholder="0"
                value={form.amount}
                onChange={e => setForm(p => ({ ...p, amount: e.target.value }))}
              />
            </div>
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
              {isLiabilityPayment ? 'Record Payment' : 'Record Expense'}
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

            <div className="space-y-1.5">
              <Label>Amount (EGP) *</Label>
              <Input
                type="number" placeholder="0"
                value={editForm.amount}
                onChange={e => setEditForm(p => ({ ...p, amount: e.target.value }))}
              />
            </div>
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
            <Button onClick={handleSaveEdit} disabled={updateExpense.isPending}>Save Changes</Button>
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
