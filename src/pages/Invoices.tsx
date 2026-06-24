import { useState } from "react";
import { Plus, FileText, CreditCard, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useInvoices, usePackages, useMembers, useDiscounts, useCreateInvoice } from "@/hooks/use-data";
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
};

export default function Invoices() {
  const { data: invoices = [] } = useInvoices();
  const { data: members = [] } = useMembers();
  const { data: packages = [] } = usePackages();
  const { data: discounts = [] } = useDiscounts();
  const createInvoice = useCreateInvoice();

  const [tab, setTab] = useState("all");
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const filtered = invoices.filter(i => tab === "all" || i.status === tab);
  const selectedPackage = packages.find(p => p.id === form.packageId);
  const selectedMember = members.find(m => m.id === form.memberId);
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
      discount_group_id: form.discountMode === 'group' ? form.discountGroupId : null,
      discount_description: form.discountMode === 'custom'
        ? form.customDiscountDescription.trim()
        : (selectedGroup?.name ?? null),
      discount_amount: discountAmount,
      total_amount: total,
      paid_amount: paid,
      status: invStatus,
      payment_method: form.paymentMethod,
    }, {
      onSuccess: () => {
        toast.success(`Invoice created`);
        resetForm();
        setShowCreate(false);
      },
      onError: (err) => {
        toast.error(`Error creating invoice: ${err.message}`);
      }
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

      {filtered.length === 0 ? (
        <Card><CardContent className="py-12 text-center"><p className="text-muted-foreground">No invoices</p></CardContent></Card>
      ) : (
        <div className="space-y-3">
          {filtered.map(inv => (
            <Card key={inv.id} data-testid={`invoice-${inv.id}`} className="hover:shadow-sm transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <FileText className="w-4 h-4 text-primary" />
                  </div>
                  <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-2 items-center">
                    <div><p className="text-xs text-muted-foreground">Invoice</p><p className="text-sm font-bold">{inv.display_id}</p></div>
                    <div><p className="text-xs text-muted-foreground">Member</p><p className="text-sm font-medium">{inv.member_name}</p></div>
                    <div><p className="text-xs text-muted-foreground">Package</p><p className="text-sm">{inv.package_name}</p></div>
                    <div><p className="text-xs text-muted-foreground">Date</p><p className="text-sm">{format(new Date(inv.created_at), "dd MMM yyyy")}</p></div>
                  </div>
                  <div className="text-right flex-shrink-0 space-y-1">
                    <p className="text-base font-bold">{inv.total_amount.toLocaleString()} EGP</p>
                    {inv.discount_amount > 0 && (
                      <div className="flex items-center gap-1 justify-end">
                        <Tag className="w-3 h-3 text-muted-foreground" />
                        <p className="text-xs text-muted-foreground">
                          -{inv.discount_amount} EGP
                          {inv.discount_description && ` · ${inv.discount_description}`}
                        </p>
                      </div>
                    )}
                    <div className="flex items-center gap-1.5 justify-end">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${paymentStatuses[inv.status]}`}>{inv.status}</span>
                      <Badge variant="outline" className="text-xs gap-1"><CreditCard className="w-3 h-3" />{inv.payment_method}</Badge>
                    </div>
                    {inv.status === 'partial' && (
                      <p className="text-xs text-muted-foreground">Paid: {inv.paid_amount} / {inv.total_amount}</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create Invoice Dialog */}
      <Dialog open={showCreate} onOpenChange={v => { if (!v) resetForm(); setShowCreate(v); }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>New Invoice</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2 max-h-[72vh] overflow-y-auto pr-1">

            <div className="space-y-1.5">
              <Label>Member</Label>
              <Select value={form.memberId} onValueChange={v => setForm(p => ({ ...p, memberId: v }))}>
                <SelectTrigger data-testid="select-invoice-member"><SelectValue placeholder="Select member..." /></SelectTrigger>
                <SelectContent>{members.map(m => <SelectItem key={m.id} value={m.id}>{m.name} ({m.display_id})</SelectItem>)}</SelectContent>
              </Select>
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
    </div>
  );
}
