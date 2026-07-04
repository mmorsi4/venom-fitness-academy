import { useState } from "react";
import { Plus, Tag, Users, AlertTriangle, CheckCircle2, Pencil, Search } from "lucide-react";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useDiscounts, useMembers, useInvoices, useCreateDiscount, useUpdateDiscount } from "@/hooks/use-data";
import type { Discount } from "@/lib/types";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";

interface DiscountForm {
  name: string;
  discountType: "fixed" | "percentage";
  value: string;
  isJoint: boolean;
  jointCount: string;
}

const emptyForm: DiscountForm = {
  name: "", discountType: "fixed", value: "", isJoint: false, jointCount: "1",
};

function discountToForm(d: Discount): DiscountForm {
  return { name: d.name, discountType: d.discount_type, value: String(d.value), isJoint: d.is_joint, jointCount: String(d.joint_count) };
}

export default function Discounts() {
  const { isAdmin } = useAuth();
  const { data: discounts = [] } = useDiscounts();
  const { data: members = [] } = useMembers();
  const { data: invoices = [] } = useInvoices();
  const createDiscount = useCreateDiscount();
  const updateDiscount = useUpdateDiscount();
  

  const [showCreate, setShowCreate] = useState(false);
  const [editDiscount, setEditDiscount] = useState<Discount | null>(null);
  const [form, setForm] = useState<DiscountForm>(emptyForm);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const filteredDiscounts = discounts.filter(d => {
    if (statusFilter === "active" && !d.active) return false;
    if (statusFilter === "inactive" && d.active) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchName = d.name.toLowerCase().includes(q);
      const related = invoices.filter(i => i.discount_id === d.id);
      const matchInvoice = related.some(i => {
        const member = members.find(m => m.uuid === i.member_id);
        const shortId = member?.id ?? '';
        return i.id.toLowerCase().includes(q) || 
               i.member_name.toLowerCase().includes(q) || 
               String(shortId).includes(q);
      });
      if (!matchName && !matchInvoice) return false;
    }
    return true;
  });

  const openCreate = () => { setForm(emptyForm); setShowCreate(true); };
  const openEdit = (d: Discount) => { setEditDiscount(d); setForm(discountToForm(d)); };
  const closeDialog = () => { setShowCreate(false); setEditDiscount(null); };

  const handleSave = () => {
    if (!form.name.trim() || !form.value) {
      toast.error("Fill in name and discount value");
      return;
    }
    
    if (editDiscount) {
      updateDiscount.mutate({
        id: editDiscount.id,
        updates: {
          name: form.name.trim(),
          discount_type: form.discountType,
          value: Number(form.value),
          is_joint: form.isJoint,
          joint_count: Number(form.jointCount) || 1,
        },
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
          discount_type: form.discountType,
          value: Number(form.value),
          active: true,
          is_joint: form.isJoint,
          joint_count: Number(form.jointCount) || 1,
        },
      }, {
        onSuccess: () => {
          toast.success(`Discount group created: ${form.name}`);
          closeDialog();
        },
        onError: (err) => toast.error(`Error creating: ${err.message}`)
      });
    }
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
        {isAdmin && (
          <Button data-testid="btn-create-discount" onClick={openCreate} className="gap-2">
            <Plus className="w-4 h-4" /> New Discount Group
          </Button>
        )}
      </div>

      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <Tabs value={statusFilter} onValueChange={setStatusFilter} className="w-full sm:w-auto">
          <TabsList>
            <TabsTrigger value="all">All Groups</TabsTrigger>
            <TabsTrigger value="active">Active</TabsTrigger>
            <TabsTrigger value="inactive">Inactive</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="relative flex-1 max-w">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search discounts by group, invoice ID, member ID, or member name..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {filteredDiscounts.length === 0 ? (
        <Card><CardContent className="py-12 text-center"><p className="text-muted-foreground">No discount groups found</p></CardContent></Card>
      ) : (
        <div className="space-y-4">
          {filteredDiscounts.map(discount => {
            const relatedInvoices = invoices.filter(i => i.discount_id === discount.id);

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
                      {isAdmin && (
                        <>
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
                        </>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {discount.is_joint && (
                    <div className="flex items-center gap-2 p-2.5 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-medium">
                      <Users className="w-4 h-4 flex-shrink-0" />
                      Joint Discount for {discount.joint_count} people
                    </div>
                  )}
                  {/* Related Invoices */}
                  {relatedInvoices.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Related Invoices</p>
                      <div className="flex flex-wrap gap-2">
                        {relatedInvoices.map(inv => {
                          const member = members.find(m => m.uuid === inv.member_id);
                          const shortId = member?.id ?? '?';
                          return (
                            <div key={inv.uuid} className="flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs bg-card">
                              <span className="font-mono font-medium text-foreground">{inv.id}</span>
                              <span className="text-muted-foreground">{inv.member_name} ({shortId === -1 ? 'Clinic' : shortId})</span>
                              <span className={`px-1.5 py-0.5 rounded text-xs ${
                                inv.status === 'paid' ? 'bg-emerald-100 text-emerald-700' :
                                inv.status === 'partial' ? 'bg-amber-100 text-amber-700' :
                                'bg-red-100 text-red-700'}`}>{inv.status}</span>
                            </div>
                          );
                        })}
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
            <div className="space-y-1.5">
              <Label>Value ({form.discountType === 'fixed' ? 'EGP' : '%'})</Label>
              <Input data-testid="input-discount-value" type="number" placeholder="0" value={form.value} onChange={e => setForm(p => ({ ...p, value: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center space-x-2 bg-muted/30 p-3 rounded-md border border-border/50">
                <input
                  type="checkbox"
                  id="joint-discount-toggle"
                  checked={form.isJoint}
                  onChange={(e) => setForm(p => ({ ...p, isJoint: e.target.checked }))}
                  className="rounded border-gray-300 text-primary focus:ring-primary"
                />
                <Label htmlFor="joint-discount-toggle" className="text-sm font-medium leading-none cursor-pointer">
                  Joint Discount
                </Label>
              </div>
            </div>
            
            {form.isJoint && (
              <div className="space-y-1.5">
                <Label>Number of people</Label>
                <Input type="number" min="1" value={form.jointCount} onChange={e => setForm(p => ({ ...p, jointCount: e.target.value }))} />
              </div>
            )}
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
