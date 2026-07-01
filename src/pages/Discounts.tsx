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
import { useDiscounts, useMembers, useInvoices, useCreateDiscount, useUpdateDiscount, useRemoveDiscountMember } from "@/hooks/use-data";
import type { Discount } from "@/lib/types";
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
  return { name: d.name, type: d.type, discountType: d.discount_type, value: String(d.value), memberIds: [...d.member_ids] };
}

export default function Discounts() {
  const { data: discounts = [] } = useDiscounts();
  const { data: members = [] } = useMembers();
  const { data: invoices = [] } = useInvoices();
  const createDiscount = useCreateDiscount();
  const updateDiscount = useUpdateDiscount();
  const removeDiscountMember = useRemoveDiscountMember();

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
      updateDiscount.mutate({
        id: editDiscount.id,
        updates: {
          name: form.name.trim(),
          type: form.type,
          discount_type: form.discountType,
          value: Number(form.value),
        },
        memberIds: form.memberIds,
      }, {
        onSuccess: () => {
          toast.success(`Discount group updated: ${form.name}`);
          closeDialog();
        },
        onError: (err) => toast.error(`Error updating: ${err.message}`)
      });
    } else {
      createDiscount.mutate({
        discount: {
          name: form.name.trim(),
          type: form.type,
          discount_type: form.discountType,
          value: Number(form.value),
          active: true,
        },
        memberIds: form.memberIds,
      }, {
        onSuccess: () => {
          toast.success(`Discount group created: ${form.name}`);
          closeDialog();
        },
        onError: (err) => toast.error(`Error creating: ${err.message}`)
      });
    }
  };

  const handleRemoveMemberFromDiscount = (discount: Discount, memberId: string) => {
    removeDiscountMember.mutate({
      discountId: discount.id,
      memberId,
    }, {
      onSuccess: () => {
        toast.success("Member removed from discount group");
        if (discount.member_ids.length <= 1) {
          toast.warning("Discount deactivated — no remaining participants");
        }
      },
      onError: (err) => toast.error(`Error removing member: ${err.message}`)
    });
  };

  const handleToggleActive = (discount: Discount) => {
    updateDiscount.mutate({
      id: discount.id,
      updates: { active: !discount.active },
    }, {
      onSuccess: () => {
        toast.success(discount.active ? `Deactivated: ${discount.name}` : `Activated: ${discount.name}`);
      },
      onError: (err) => toast.error(`Error toggling status: ${err.message}`)
    });
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

      {discounts.length === 0 ? (
        <Card><CardContent className="py-12 text-center"><p className="text-muted-foreground">No discount groups created</p></CardContent></Card>
      ) : (
        <div className="space-y-4">
          {discounts.map(discount => {
            const discountMembers = members.filter(m => discount.member_ids.includes(m.uuid));
            const relatedInvoices = invoices.filter(i => discount.invoice_ids.includes(i.id));
            const conditionsMet = discount.member_ids.length >= 2;

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
                            {discount.discount_type === 'fixed' ? `${discount.value} EGP off` : `${discount.value}% off`}
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
                        Participants ({discountMembers.length})
                      </span>
                    </div>
                    {discountMembers.length === 0 ? (
                      <p className="text-xs text-muted-foreground">No participants</p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {discountMembers.map(m => (
                          <div key={m.uuid} data-testid={`discount-member-${m.uuid}`} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border bg-muted/50 text-xs">
                            <span className="font-medium text-foreground">{m.name}</span>
                            <span className="text-muted-foreground">({m.id})</span>
                            <button
                              data-testid={`btn-remove-member-${m.uuid}`}
                              onClick={() => handleRemoveMemberFromDiscount(discount, m.uuid)}
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
                            <span className="font-mono font-medium text-foreground">{inv.display_id}</span>
                            <span className="text-muted-foreground">{inv.member_name}</span>
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
                    <SelectItem value="fixed">Fixed Amount (EGP)</SelectItem>
                    <SelectItem value="percentage">Percentage (%)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Value ({form.discountType === 'fixed' ? 'EGP' : '%'})</Label>
              <Input data-testid="input-discount-value" type="number" placeholder="0" value={form.value} onChange={e => setForm(p => ({ ...p, value: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>{editDiscount ? 'Members' : 'Select Members (min. 2 for linked discount)'}</Label>
              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {members.map(m => (
                  <button
                    key={m.uuid}
                    data-testid={`select-discount-member-${m.uuid}`}
                    onClick={() => handleToggleMember(m.uuid)}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg border text-left transition-colors ${
                      form.memberIds.includes(m.uuid) ? 'bg-primary/5 border-primary/30' : 'bg-card hover:bg-accent'}`}
                  >
                    <div className={`w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center ${form.memberIds.includes(m.uuid) ? 'bg-primary border-primary' : 'border-input'}`}>
                      {form.memberIds.includes(m.uuid) && <span className="text-white text-xs">✓</span>}
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
