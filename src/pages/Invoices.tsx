import { useState, useEffect, useRef } from "react";
import { useLocation, useSearch } from "wouter";
import { Plus, FileText, CreditCard, Tag, Trash2, Pencil, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { Textarea } from "@/components/ui/textarea";
import { SearchableSelect } from "@/components/SearchableSelect";
import { useInvoices, usePackages, useMembers, useDiscounts, useCreateInvoice, useUpdateInvoice, useDeleteInvoice, useCreateAuditLog } from "@/hooks/use-data";
import { useAuth } from "@/lib/auth";
import type { Invoice } from "@/lib/types";
import { toast } from "sonner";
import { format } from "date-fns";

const paymentMethods = ["Cash", "Visa", "InstaPay"];
const paymentStatuses: Record<string, string> = {
  paid: "bg-emerald-100 text-emerald-700 border-emerald-200",
  partial: "bg-amber-100 text-amber-700 border-amber-200",
  unpaid: "bg-red-100 text-red-700 border-red-200",
};

type DiscountMode = 'none' | 'group' | 'custom';
type CustomDiscountType = 'fixed' | 'percentage';

const emptyForm = {
  memberId: "", packageId: "", paymentMethod: "Cash",
  paidAmount: "",
  discountMode: "none" as DiscountMode,
  discountGroupId: "",
  customDiscountType: "fixed" as CustomDiscountType,
  customDiscountValue: "",
  customDiscountDescription: "",
  invoiceDate: "",
};

export default function Invoices() {
  const { data: invoices = [] } = useInvoices();
  const { data: members = [] } = useMembers();
  const { data: packages = [] } = usePackages();
  const { data: discounts = [] } = useDiscounts();
  const createInvoice = useCreateInvoice();
  const updateInvoice = useUpdateInvoice();
  const deleteInvoice = useDeleteInvoice();
  const createAuditLog = useCreateAuditLog();
  const { currentUser } = useAuth();

  const [tab, setTab] = useState("all");
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [, navigate] = useLocation();
  const searchString = useSearch();
  const hasConsumedParams = useRef(false);

  // Auto-open create dialog when navigating from Members with query params
  useEffect(() => {
    if (hasConsumedParams.current) return;
    const params = new URLSearchParams(searchString);
    const memberId = params.get('memberId');
    const packageId = params.get('packageId');
    if (memberId || packageId) {
      hasConsumedParams.current = true;
      setForm(prev => ({
        ...prev,
        memberId: memberId ?? prev.memberId,
        packageId: packageId ?? prev.packageId,
      }));
      setShowCreate(true);
      // Clean up query params from URL
      navigate('/invoices', { replace: true });
    }
  }, [searchString, navigate]);

  // Edit invoice state
  const [editInvoice, setEditInvoice] = useState<Invoice | null>(null);
  const [editForm, setEditForm] = useState({ paidAmount: "", paymentMethod: "Cash" });

  // Delete invoice state
  const [confirmDelete, setConfirmDelete] = useState<Invoice | null>(null);

  // Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [filterPaymentMethod, setFilterPaymentMethod] = useState("all");
  const [filterPackage, setFilterPackage] = useState("all");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");

  const filtered = invoices.filter(i => {
    // Status tab filter
    if (tab !== "all" && i.status !== tab) return false;

    // Text search (invoice ID, member ID, member name, member phone)
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const member = members.find(m => m.uuid === i.member_id);
      const matchesSearch =
        i.id.toLowerCase().includes(q) ||
        member?.id.toString().includes(q) ||
        i.member_name.toLowerCase().includes(q) ||
        (member?.phone ?? "").includes(q);
      if (!matchesSearch) return false;
    }

    // Payment method filter
    if (filterPaymentMethod !== "all" && i.payment_method !== filterPaymentMethod) return false;

    // Package filter
    if (filterPackage !== "all" && i.package_name !== filterPackage) return false;

    // Date range filter
    if (filterDateFrom) {
      const invoiceDate = new Date(i.created_at);
      if (invoiceDate < new Date(filterDateFrom)) return false;
    }
    if (filterDateTo) {
      const invoiceDate = new Date(i.created_at);
      const toDate = new Date(filterDateTo);
      toDate.setHours(23, 59, 59, 999);
      if (invoiceDate > toDate) return false;
    }

    return true;
  });

  const selectedPackage = packages.find(p => p.id === form.packageId);
  const selectedMember = members.find(m => m.uuid === form.memberId);
  const activeDiscounts = discounts.filter(d => d.active);
  const selectedGroup = activeDiscounts.find(d => d.id === form.discountGroupId);

  // Compute discount amount
  let discountAmount = 0;
  if (form.discountMode === 'group' && selectedGroup && selectedPackage) {
    discountAmount = selectedGroup.discount_type === 'fixed'
      ? selectedGroup.value
      : Math.round(selectedPackage.price * selectedGroup.value / 100);
  } else if (form.discountMode === 'custom' && form.customDiscountValue) {
    if (form.customDiscountType === 'fixed') {
      discountAmount = Number(form.customDiscountValue) || 0;
    } else if (selectedPackage) {
      discountAmount = Math.round(selectedPackage.price * (Number(form.customDiscountValue) || 0) / 100);
    }
  }

  const total = selectedPackage ? Math.max(0, selectedPackage.price - discountAmount) : 0;
  const paid = Number(form.paidAmount) || 0;
  const needsDescription = form.discountMode === 'custom' && discountAmount > 0 && !form.customDiscountDescription.trim();

  const resetForm = () => setForm(emptyForm);

  const handleCreate = () => {
    if (!form.memberId || !form.packageId) { toast.error("Select a member and package"); return; }
    if (needsDescription) { toast.error("A reason is required for custom discounts"); return; }

    const invStatus: 'paid' | 'partial' | 'unpaid' =
      paid >= total ? 'paid' : paid > 0 ? 'partial' : 'unpaid';

    createInvoice.mutate({
      member_id: form.memberId,
      member_name: selectedMember?.name ?? "",
      package_id: form.packageId,
      package_name: selectedPackage?.name ?? "",
      discount_id: form.discountMode === 'group' ? form.discountGroupId : null,
      discount_description: form.discountMode === 'custom'
        ? form.customDiscountDescription.trim()
        : (selectedGroup?.name ?? null),
      discount_amount: discountAmount,
      total_amount: total,
      paid_amount: paid,
      status: invStatus,
      payment_method: form.paymentMethod,
      created_at: form.invoiceDate ? new Date(form.invoiceDate).toISOString() : new Date().toISOString(),
    } as any, {
      onSuccess: () => {
        toast.success(`Invoice created`);
        resetForm();
        setShowCreate(false);
      },
      onError: (err: any) => {
        toast.error(`Error creating invoice: ${err.message}`);
      }
    });
  };

  const openEditInvoice = (inv: Invoice) => {
    setEditInvoice(inv);
    setEditForm({
      paidAmount: String(inv.paid_amount),
      paymentMethod: inv.payment_method,
    });
  };

  const handleEditInvoice = () => {
    if (!editInvoice) return;
    const newPaid = Number(editForm.paidAmount) || 0;
    const newStatus: 'paid' | 'partial' | 'unpaid' =
      newPaid >= editInvoice.total_amount ? 'paid' : newPaid > 0 ? 'partial' : 'unpaid';

    updateInvoice.mutate({
      uuid: editInvoice.uuid,
      updates: {
        paid_amount: newPaid,
        payment_method: editForm.paymentMethod as any,
        status: newStatus,
      }
    }, {
      onSuccess: () => {
        createAuditLog.mutate({
          action: 'Edit Invoice',
          action_type: 'edit_payment',
          performed_by: currentUser?.id ?? null,
          performer_name: currentUser?.name ?? 'System',
          member_id: editInvoice.member_id,
          member_name: editInvoice.member_name,
          timestamp: new Date().toISOString(),
          details: `Edited invoice ${editInvoice.id}: paid ${editInvoice.paid_amount} → ${newPaid} EGP, method: ${editForm.paymentMethod}`,
        });
        toast.success(`Invoice ${editInvoice.id} updated`);
        setEditInvoice(null);
      },
      onError: (err) => toast.error(`Error: ${err.message}`),
    });
  };

  const handleDeleteInvoice = (inv: Invoice) => {
    deleteInvoice.mutate(inv.uuid, {
      onSuccess: () => {
        createAuditLog.mutate({
          action: 'Delete Invoice',
          action_type: 'other',
          performed_by: currentUser?.id ?? null,
          performer_name: currentUser?.name ?? 'System',
          member_id: null,
          member_name: inv.member_name,
          timestamp: new Date().toISOString(),
          details: `Hard deleted invoice ${inv.id} for ${inv.member_name}, amount: ${inv.total_amount} EGP`,
        });
        toast.success(`Invoice ${inv.id} deleted`);
        setConfirmDelete(null);
      },
      onError: (err) => toast.error(`Error deleting invoice: ${err.message}`),
    });
  };

  const counts = {
    all: invoices.length,
    paid: invoices.filter(i => i.status === 'paid').length,
    partial: invoices.filter(i => i.status === 'partial').length,
    unpaid: invoices.filter(i => i.status === 'unpaid').length,
  };

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Invoices</h1>
          <p className="text-sm text-muted-foreground">{invoices.length} total invoices</p>
        </div>
        <Button data-testid="btn-create-invoice" onClick={() => setShowCreate(true)} className="gap-2">
          <Plus className="w-4 h-4" /> New Invoice
        </Button>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="all">All ({counts.all})</TabsTrigger>
          <TabsTrigger value="paid">Paid ({counts.paid})</TabsTrigger>
          <TabsTrigger value="partial">Partial ({counts.partial})</TabsTrigger>
          <TabsTrigger value="unpaid">Unpaid ({counts.unpaid})</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            data-testid="input-invoice-search"
            placeholder="Search invoice ID, member ID, member name, or phone..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={filterPaymentMethod} onValueChange={setFilterPaymentMethod}>
          <SelectTrigger className="w-36" data-testid="filter-payment-method">
            <SelectValue placeholder="Payment..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Methods</SelectItem>
            {paymentMethods.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterPackage} onValueChange={setFilterPackage}>
          <SelectTrigger className="w-40" data-testid="filter-package">
            <SelectValue placeholder="Package..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Packages</SelectItem>
            {[...new Set(invoices.map(i => i.package_name).filter(Boolean))].map(p => (
              <SelectItem key={p} value={p}>{p}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          type="date"
          value={filterDateFrom}
          onChange={e => setFilterDateFrom(e.target.value)}
          className="w-36"
          title="From date"
        />
        <Input
          type="date"
          value={filterDateTo}
          onChange={e => setFilterDateTo(e.target.value)}
          className="w-36"
          title="To date"
        />
      </div>

      {filtered.length === 0 ? (
        <Card><CardContent className="py-12 text-center"><p className="text-muted-foreground">No invoices</p></CardContent></Card>
      ) : (
        <div className="rounded-md border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice</TableHead>
                <TableHead>Member ID</TableHead>
                <TableHead>Member Name</TableHead>
                <TableHead>Package</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Status & Payment</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="w-[80px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(inv => {
                const shortId = members.find(m => m.uuid === inv.member_id)?.id;
                return (
                  <TableRow key={inv.uuid} data-testid={`invoice-${inv.uuid}`}>
                    <TableCell className="font-bold text-xs text-muted-foreground">{inv.id}</TableCell>
                    <TableCell className="text-sm font-medium text-muted-foreground">{shortId === -1 ? 'Clinic Visitor' : (shortId ?? '?')}</TableCell>
                    <TableCell className="font-medium text-sm">{inv.member_name}</TableCell>
                    <TableCell className="text-sm">{inv.package_name}</TableCell>
                    <TableCell className="text-sm">{format(new Date(inv.created_at), "dd MMM yyyy")}</TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1 items-start">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${paymentStatuses[inv.status]}`}>
                          {inv.status}
                        </span>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <CreditCard className="w-3 h-3" /> {inv.payment_method}
                        </div>
                        {inv.status === 'partial' && (
                          <p className="text-[10px] text-muted-foreground">Paid: {inv.paid_amount} / {inv.total_amount}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <p className="text-sm font-bold">{inv.total_amount.toLocaleString()} EGP</p>
                      {inv.discount_amount > 0 && (
                        <div className="flex items-center gap-1 justify-end text-muted-foreground mt-0.5">
                          <Tag className="w-3 h-3" />
                          <p className="text-[10px]">-{inv.discount_amount} EGP</p>
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 justify-end">
                        <button
                          data-testid={`btn-edit-invoice-${inv.uuid}`}
                          onClick={() => openEditInvoice(inv)}
                          className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          data-testid={`btn-delete-invoice-${inv.uuid}`}
                          onClick={() => setConfirmDelete(inv)}
                          className="p-1.5 rounded-md hover:bg-red-50 transition-colors text-muted-foreground hover:text-red-600"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Create Invoice Dialog */}
      <Dialog open={showCreate} onOpenChange={v => { if (!v) resetForm(); setShowCreate(v); }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>New Invoice</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2 max-h-[72vh] overflow-y-auto pr-1">

            <div className="space-y-1.5">
              <Label>Member</Label>
              <SearchableSelect
                data-testid="select-invoice-member"
                options={members.map(m => ({
                  value: m.uuid,
                  label: `${m.name} (${m.id})`,
                  searchTerms: `${m.phone} ${m.id}`,
                }))}
                value={form.memberId}
                onValueChange={v => setForm(p => ({ ...p, memberId: v }))}
                placeholder="Search member by name, phone, or ID..."
                searchPlaceholder="Type name, phone, or member ID..."
                emptyMessage="No members found"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Package</Label>
              <Select value={form.packageId} onValueChange={v => setForm(p => ({ ...p, packageId: v }))}>
                <SelectTrigger data-testid="select-invoice-package"><SelectValue placeholder="Select package..." /></SelectTrigger>
                <SelectContent>{packages.map(p => <SelectItem key={p.id} value={p.id}>{p.name} — {p.price} EGP</SelectItem>)}</SelectContent>
              </Select>
            </div>

            {/* Discount */}
            <div className="space-y-3">
              <Label>Discount</Label>
              <div className="flex gap-2">
                {(['none', 'group', 'custom'] as DiscountMode[]).map(mode => (
                  <button
                    key={mode}
                    onClick={() => setForm(p => ({ ...p, discountMode: mode, discountGroupId: '', customDiscountValue: '', customDiscountDescription: '' }))}
                    className={`flex-1 py-1.5 px-2 rounded-lg border text-xs font-medium transition-colors ${form.discountMode === mode ? 'bg-primary text-primary-foreground border-primary' : 'bg-card hover:bg-accent'}`}
                  >
                    {mode === 'none' ? 'No Discount' : mode === 'group' ? 'Discount Group' : 'Custom'}
                  </button>
                ))}
              </div>

              {form.discountMode === 'group' && (
                <div className="space-y-1.5">
                  <Select value={form.discountGroupId} onValueChange={v => setForm(p => ({ ...p, discountGroupId: v }))}>
                    <SelectTrigger><SelectValue placeholder="Select discount group..." /></SelectTrigger>
                    <SelectContent>
                      {activeDiscounts.length === 0
                        ? <SelectItem value="__none__" disabled>No active groups</SelectItem>
                        : activeDiscounts.map(d => (
                          <SelectItem key={d.id} value={d.id}>
                            {d.name} ({d.discount_type === 'fixed' ? `${d.value} EGP` : `${d.value}%`})
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  {selectedGroup && selectedPackage && (
                    <p className="text-xs text-emerald-600 font-medium">Applied: -{discountAmount} EGP off {selectedPackage.price} EGP</p>
                  )}
                </div>
              )}

              {form.discountMode === 'custom' && (
                <div className="space-y-3">
                  {/* Fixed / Percentage toggle */}
                  <div className="flex gap-2">
                    {(['fixed', 'percentage'] as CustomDiscountType[]).map(t => (
                      <button
                        key={t}
                        onClick={() => setForm(p => ({ ...p, customDiscountType: t, customDiscountValue: '' }))}
                        className={`flex-1 py-1.5 rounded-lg border text-xs font-medium transition-colors ${form.customDiscountType === t ? 'bg-foreground text-background border-foreground' : 'bg-card hover:bg-accent'}`}
                      >
                        {t === 'fixed' ? 'Fixed Amount (EGP)' : 'Percentage (%)'}
                      </button>
                    ))}
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">
                      {form.customDiscountType === 'fixed' ? 'Discount Amount (EGP)' : 'Discount (%)'}
                    </Label>
                    <Input
                      data-testid="input-invoice-discount"
                      type="number" min="0"
                      max={form.customDiscountType === 'percentage' ? "100" : undefined}
                      placeholder={form.customDiscountType === 'fixed' ? '0' : '0 – 100'}
                      value={form.customDiscountValue}
                      onChange={e => setForm(p => ({ ...p, customDiscountValue: e.target.value }))}
                    />
                    {form.customDiscountType === 'percentage' && selectedPackage && form.customDiscountValue && (
                      <p className="text-xs text-muted-foreground">= {discountAmount} EGP off</p>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Reason for Discount *</Label>
                    <Textarea
                      data-testid="input-invoice-discount-reason"
                      placeholder="Required: explain why this discount is applied..."
                      value={form.customDiscountDescription}
                      onChange={e => setForm(p => ({ ...p, customDiscountDescription: e.target.value }))}
                      rows={2}
                      className={needsDescription ? 'border-red-400' : ''}
                    />
                    {needsDescription && <p className="text-xs text-red-500">Required when applying a custom discount</p>}
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Amount Paid (EGP)</Label>
                <Input
                  data-testid="input-invoice-paid"
                  type="number" placeholder={String(total)}
                  value={form.paidAmount}
                  onChange={e => setForm(p => ({ ...p, paidAmount: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Payment Method</Label>
                <Select value={form.paymentMethod} onValueChange={v => setForm(p => ({ ...p, paymentMethod: v }))}>
                  <SelectTrigger data-testid="select-invoice-method"><SelectValue /></SelectTrigger>
                  <SelectContent>{paymentMethods.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>

            {/* Invoice Date */}
            <div className="space-y-1.5">
              <Label>Invoice Date</Label>
              <Input
                type="date"
                data-testid="input-invoice-date"
                value={form.invoiceDate}
                onChange={e => setForm(p => ({ ...p, invoiceDate: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground">Leave empty for today's date</p>
            </div>

            {selectedPackage && (
              <div className="p-3 rounded-lg bg-muted/50 text-sm space-y-1">
                <div className="flex justify-between"><span className="text-muted-foreground">Package price</span><span>{selectedPackage.price} EGP</span></div>
                {discountAmount > 0 && (
                  <div className="flex justify-between text-emerald-600">
                    <span>Discount</span><span>-{discountAmount} EGP</span>
                  </div>
                )}
                <div className="flex justify-between font-bold pt-1 border-t border-border"><span>Total</span><span>{total} EGP</span></div>
                <div className="flex justify-between text-muted-foreground"><span>Status</span><span className="capitalize">{paid >= total ? 'Paid' : paid > 0 ? 'Partial' : 'Unpaid'}</span></div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { resetForm(); setShowCreate(false); }}>Cancel</Button>
            <Button data-testid="btn-save-invoice" onClick={handleCreate} disabled={createInvoice.isPending}>Create Invoice</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Invoice Dialog */}
      <Dialog open={!!editInvoice} onOpenChange={o => !o && setEditInvoice(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Edit Invoice: {editInvoice?.id}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="px-3 py-2 rounded-lg bg-muted/50 text-sm space-y-1">
              <div className="flex justify-between"><span className="text-muted-foreground">Member</span><span>{editInvoice?.member_name}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Package</span><span>{editInvoice?.package_name}</span></div>
              <div className="flex justify-between font-bold"><span>Total</span><span>{editInvoice?.total_amount.toLocaleString()} EGP</span></div>
            </div>
            <div className="space-y-1.5">
              <Label>Amount Paid (EGP)</Label>
              <Input
                type="number"
                value={editForm.paidAmount}
                onChange={e => setEditForm(p => ({ ...p, paidAmount: e.target.value }))}
                placeholder={String(editInvoice?.total_amount)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Payment Method</Label>
              <Select value={editForm.paymentMethod} onValueChange={v => setEditForm(p => ({ ...p, paymentMethod: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {paymentMethods.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditInvoice(null)}>Cancel</Button>
            <Button onClick={handleEditInvoice} disabled={updateInvoice.isPending}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Invoice Confirmation */}
      <AlertDialog open={!!confirmDelete} onOpenChange={o => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Invoice</AlertDialogTitle>
            <AlertDialogDescription>
              Permanently delete invoice <strong>{confirmDelete?.id}</strong> for {confirmDelete?.member_name}?
              <span className="block mt-1 text-sm">Amount: {confirmDelete?.total_amount.toLocaleString()} EGP</span>
              <span className="block mt-2 text-red-600 font-medium">This action cannot be undone.</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmDelete && handleDeleteInvoice(confirmDelete)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete Invoice
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
