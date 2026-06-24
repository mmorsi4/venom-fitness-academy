import { useState } from "react";
import { Plus, Tag, Users, AlertTriangle, CheckCircle2, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import { useAppState } from "@/lib/store";
import { Discount } from "@/lib/mock-data";
import { toast } from "sonner";

interface DiscountForm {
  name: string;
  type: "seasonal" | "manual";
  discountType: "fixed" | "percentage";
  value: string;
  memberIds: string[];
}

const emptyForm: DiscountForm = {
  name: "", type: "manual", discountType: "fixed", value: "", memberIds: [],
};

function discountToForm(d: Discount): DiscountForm {
  return { name: d.name, type: d.type, discountType: d.discountType, value: String(d.value), memberIds: [...d.memberIds] };
}

export default function Discounts() {
  const { state, dispatch } = useAppState();
  const [showCreate, setShowCreate] = useState(false);
  const [editDiscount, setEditDiscount] = useState<Discount | null>(null);
  const [form, setForm] = useState<DiscountForm>(emptyForm);

  const handleToggleMember = (id: string) =>
    setForm(p => ({
      ...p,
      memberIds: p.memberIds.includes(id) ? p.memberIds.filter(m => m !== id) : [...p.memberIds, id],
    }));

  const openCreate = () => { setForm(emptyForm); setShowCreate(true); };
  const openEdit = (d: Discount) => { setEditDiscount(d); setForm(discountToForm(d)); };
  const closeDialog = () => { setShowCreate(false); setEditDiscount(null); };

  const handleSave = () => {
    if (!form.name.trim() || !form.value) {
      toast.error("Fill in name and discount value");
      return;
    }
    if (!editDiscount && form.memberIds.length === 0) {
      toast.error("Select at least one member");
      return;
    }
    if (editDiscount) {
      const updated: Discount = {
        ...editDiscount,
        name: form.name.trim(), type: form.type,
        discountType: form.discountType, value: Number(form.value),
        memberIds: form.memberIds,
      };
      dispatch({ type: 'UPDATE_DISCOUNT', payload: updated });
      toast.success(`Discount group updated: ${form.name}`);
    } else {
      const discount: Discount = {
        id: `D${Date.now()}`, name: form.name.trim(), type: form.type,
        discountType: form.discountType, value: Number(form.value),
        memberIds: form.memberIds, invoiceIds: [], active: true,
      };
      dispatch({ type: 'ADD_DISCOUNT', payload: discount });
      toast.success(`Discount group created: ${form.name}`);
    }
    closeDialog();
  };

  const handleRemoveMemberFromDiscount = (discount: Discount, memberId: string) => {
    const updated = { ...discount, memberIds: discount.memberIds.filter(id => id !== memberId) };
    if (updated.memberIds.length === 0) {
      dispatch({ type: 'UPDATE_DISCOUNT', payload: { ...updated, active: false } });
      toast.warning("Discount deactivated — no remaining participants");
    } else {
      dispatch({ type: 'UPDATE_DISCOUNT', payload: updated });
      toast.success("Member removed from discount group");
    }
  };

  const handleToggleActive = (discount: Discount) => {
    dispatch({ type: 'UPDATE_DISCOUNT', payload: { ...discount, active: !discount.active } });
    toast.success(discount.active ? `Deactivated: ${discount.name}` : `Activated: ${discount.name}`);
  };

  const isDialogOpen = showCreate || !!editDiscount;

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Discounts</h1>
          <p className="text-sm text-muted-foreground">Manage linked discount groups and cohorts</p>
        </div>
        <Button data-testid="btn-create-discount" onClick={openCreate} className="gap-2">
          <Plus className="w-4 h-4" /> New Discount Group
        </Button>
      </div>

      {state.discounts.length === 0 ? (
        <Card><CardContent className="py-12 text-center"><p className="text-muted-foreground">No discount groups created</p></CardContent></Card>
      ) : (
        <div className="space-y-4">
          {state.discounts.map(discount => {
            const members = state.members.filter(m => discount.memberIds.includes(m.id));
            const relatedInvoices = state.invoices.filter(i => discount.invoiceIds.includes(i.id));
            const conditionsMet = discount.memberIds.length >= 2;

            return (
              <Card key={discount.id} data-testid={`discount-${discount.id}`} className={discount.active ? "" : "opacity-60"}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${discount.active ? 'bg-primary/10' : 'bg-muted'}`}>
                        <Tag className={`w-4 h-4 ${discount.active ? 'text-primary' : 'text-muted-foreground'}`} />
                      </div>
                      <div>
                        <CardTitle className="text-base">{discount.name}</CardTitle>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className="text-xs capitalize">{discount.type}</Badge>
                          <Badge variant="secondary" className="text-xs">
                            {discount.discountType === 'fixed' ? `${discount.value} EGP off` : `${discount.value}% off`}
                          </Badge>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {discount.active ? (
                        <span className="flex items-center gap-1 text-emerald-600 text-xs font-medium">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Active
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-red-500 text-xs font-medium">
                          <AlertTriangle className="w-3.5 h-3.5" /> Inactive
                        </span>
                      )}
                      <Button variant="ghost" size="sm" onClick={() => handleToggleActive(discount)} className="text-xs h-7">
                        {discount.active ? 'Deactivate' : 'Activate'}
                      </Button>
                      <Button
                        data-testid={`btn-edit-discount-${discount.id}`}
                        variant="outline" size="sm"
                        onClick={() => openEdit(discount)}
                        className="gap-1 text-xs h-7"
                      >
                        <Pencil className="w-3 h-3" /> Edit
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {!conditionsMet && discount.active && (
                    <div className="flex items-center gap-2 p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 text-xs">
                      <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                      Fewer than 2 participants — discount conditions may not be met
                    </div>
                  )}
                  {/* Members */}
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Users className="w-3.5 h-3.5 text-muted-foreground" />
                      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                        Participants ({members.length})
                      </span>
                    </div>
                    {members.length === 0 ? (
                      <p className="text-xs text-muted-foreground">No participants</p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {members.map(m => (
                          <div key={m.id} data-testid={`discount-member-${m.id}`} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border bg-muted/50 text-xs">
                            <span className="font-medium text-foreground">{m.name}</span>
                            <span className="text-muted-foreground">({m.id})</span>
                            <button
                              data-testid={`btn-remove-member-${m.id}`}
                              onClick={() => handleRemoveMemberFromDiscount(discount, m.id)}
                              className="ml-1 text-muted-foreground hover:text-destructive transition-colors font-bold"
                            >×</button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  {/* Related Invoices */}
                  {relatedInvoices.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Related Invoices</p>
                      <div className="flex flex-wrap gap-2">
                        {relatedInvoices.map(inv => (
                          <div key={inv.id} className="flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs bg-card">
                            <span className="font-mono font-medium text-foreground">{inv.id}</span>
                            <span className="text-muted-foreground">{inv.memberName}</span>
                            <span className={`px-1.5 py-0.5 rounded text-xs ${
                              inv.status === 'paid' ? 'bg-emerald-100 text-emerald-700' :
                              inv.status === 'partial' ? 'bg-amber-100 text-amber-700' :
                              'bg-red-100 text-red-700'}`}>{inv.status}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create / Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={o => !o && closeDialog()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editDiscount ? `Edit: ${editDiscount.name}` : 'New Discount Group'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2 max-h-[70vh] overflow-y-auto pr-1">
            <div className="space-y-1.5">
              <Label>Discount Name</Label>
              <Input data-testid="input-discount-name" placeholder="e.g. Ramadan Special 2025" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Type</Label>
                <Select value={form.type} onValueChange={(v: "seasonal" | "manual") => setForm(p => ({ ...p, type: v }))}>
                  <SelectTrigger data-testid="select-discount-type"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="seasonal">Seasonal</SelectItem>
                    <SelectItem value="manual">Manual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Discount Type</Label>
                <Select value={form.discountType} onValueChange={(v: "fixed" | "percentage") => setForm(p => ({ ...p, discountType: v }))}>
                  <SelectTrigger data-testid="select-discount-method"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fixed">Fixed Amount (AED)</SelectItem>
                    <SelectItem value="percentage">Percentage (%)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Value ({form.discountType === 'fixed' ? 'AED' : '%'})</Label>
              <Input data-testid="input-discount-value" type="number" placeholder="0" value={form.value} onChange={e => setForm(p => ({ ...p, value: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>{editDiscount ? 'Members' : 'Select Members (min. 2 for linked discount)'}</Label>
              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {state.members.map(m => (
                  <button
                    key={m.id}
                    data-testid={`select-discount-member-${m.id}`}
                    onClick={() => handleToggleMember(m.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg border text-left transition-colors ${
                      form.memberIds.includes(m.id) ? 'bg-primary/5 border-primary/30' : 'bg-card hover:bg-accent'}`}
                  >
                    <div className={`w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center ${form.memberIds.includes(m.id) ? 'bg-primary border-primary' : 'border-input'}`}>
                      {form.memberIds.includes(m.id) && <span className="text-white text-xs">✓</span>}
                    </div>
                    <span className="text-sm font-medium text-foreground">{m.name}</span>
                    <span className="text-xs text-muted-foreground ml-auto">{m.id}</span>
                  </button>
                ))}
              </div>
              {form.memberIds.length > 0 && (
                <p className="text-xs text-muted-foreground">{form.memberIds.length} member{form.memberIds.length > 1 ? 's' : ''} selected</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Cancel</Button>
            <Button data-testid="btn-save-discount" onClick={handleSave}>
              {editDiscount ? 'Save Changes' : 'Create Group'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
