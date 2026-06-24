import { useState } from "react";
import { Package, Snowflake, Users, Activity, Plus, Pencil, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from "@/components/ui/dialog";
import { usePackages, useMembers, useCreatePackage, useUpdatePackage, useDeletePackage } from "@/hooks/use-data";
import type { SubscriptionPackage } from "@/lib/types";
import { toast } from "sonner";

interface PkgForm {
  name: string;
  sessions: string;
  price: string;
  validityDays: string;
  freezeDays: string;
  invitations: string;
  inBodySessions: string;
}

const emptyForm: PkgForm = {
  name: "", sessions: "", price: "", validityDays: "30",
  freezeDays: "7", invitations: "1", inBodySessions: "1",
};

function pkgToForm(p: SubscriptionPackage): PkgForm {
  return {
    name: p.name, sessions: p.sessions === 999 ? "0" : String(p.sessions),
    price: String(p.price), validityDays: String(p.validity_days),
    freezeDays: String(p.freeze_days), invitations: String(p.invitations),
    inBodySessions: String(p.inbody_sessions),
  };
}

export default function Subscriptions() {
  const { data: packages = [] } = usePackages();
  const { data: members = [] } = useMembers();
  const createPackage = useCreatePackage();
  const updatePackage = useUpdatePackage();
  const deletePackage = useDeletePackage();

  const [showDialog, setShowDialog] = useState(false);
  const [editPkg, setEditPkg] = useState<SubscriptionPackage | null>(null);
  const [form, setForm] = useState<PkgForm>(emptyForm);
  const [confirmDelete, setConfirmDelete] = useState<SubscriptionPackage | null>(null);
  const [unlimited, setUnlimited] = useState(false);

  const f = (key: keyof PkgForm) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(p => ({ ...p, [key]: e.target.value }));

  const openCreate = () => {
    setForm(emptyForm); setEditPkg(null); setUnlimited(false); setShowDialog(true);
  };
  const openEdit = (p: SubscriptionPackage) => {
    setEditPkg(p); setForm(pkgToForm(p)); setUnlimited(p.sessions === 999); setShowDialog(true);
  };
  const closeDialog = () => { setShowDialog(false); setEditPkg(null); };

  const handleSave = () => {
    if (!form.name.trim() || !form.price) { toast.error("Name and price are required"); return; }
    const sessions = unlimited ? 999 : (Number(form.sessions) || 0);
    if (!unlimited && sessions <= 0) { toast.error("Enter a valid number of sessions"); return; }

    if (editPkg) {
      updatePackage.mutate({
        id: editPkg.id,
        updates: {
          name: form.name.trim(),
          sessions,
          price: Number(form.price),
          validity_days: Number(form.validityDays) || 30,
          freeze_days: Number(form.freezeDays) || 7,
          invitations: Number(form.invitations) || 0,
          inbody_sessions: Number(form.inBodySessions) || 0,
        }
      }, {
        onSuccess: () => {
          toast.success(`Package updated: ${form.name}`);
          closeDialog();
        },
        onError: (err) => toast.error(`Error updating package: ${err.message}`)
      });
    } else {
      createPackage.mutate({
        name: form.name.trim(),
        sessions,
        price: Number(form.price),
        validity_days: Number(form.validityDays) || 30,
        freeze_days: Number(form.freezeDays) || 7,
        invitations: Number(form.invitations) || 0,
        inbody_sessions: Number(form.inBodySessions) || 0,
      }, {
        onSuccess: () => {
          toast.success(`Package created: ${form.name}`);
          closeDialog();
        },
        onError: (err) => toast.error(`Error creating package: ${err.message}`)
      });
    }
  };

  const handleDelete = (pkg: SubscriptionPackage) => {
    const inUse = members.some(m => m.package_name === pkg.name);
    if (inUse) {
      toast.error("Cannot delete — members are currently on this package");
      setConfirmDelete(null);
      return;
    }
    deletePackage.mutate(pkg.id, {
      onSuccess: () => {
        toast.success(`Package deleted: ${pkg.name}`);
        setConfirmDelete(null);
      },
      onError: (err) => toast.error(`Error deleting package: ${err.message}`)
    });
  };

  const packageUsage = packages.map(pkg => ({
    ...pkg,
    activeCount: members.filter(m => m.package_name === pkg.name && m.status === 'active').length,
  }));

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Subscription Packages</h1>
          <p className="text-sm text-muted-foreground">Manage available packages and their details</p>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="w-4 h-4" /> New Package
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {packageUsage.map(pkg => (
          <Card key={pkg.id} data-testid={`package-${pkg.id}`} className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Package className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-base">{pkg.name}</CardTitle>
                    <p className="text-sm text-muted-foreground mt-0.5">{pkg.validity_days}-day validity</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <p className="text-2xl font-bold text-foreground">{pkg.price}<span className="text-sm font-normal text-muted-foreground ml-1">EGP</span></p>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" onClick={() => openEdit(pkg)} className="h-7 w-7 p-0">
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(pkg)} className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive">
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-muted/50 text-center">
                  <p className="text-xl font-bold text-foreground">{pkg.sessions === 999 ? "∞" : pkg.sessions}</p>
                  <p className="text-xs text-muted-foreground">Sessions</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/50 text-center">
                  <p className="text-xl font-bold text-foreground">{pkg.activeCount}</p>
                  <p className="text-xs text-muted-foreground">Active Members</p>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Included Amenities</p>
                <div className="flex flex-wrap gap-2">
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-50 border border-blue-100 text-blue-700 text-xs font-medium">
                    <Snowflake className="w-3 h-3" />{pkg.freeze_days} Freeze Days
                  </div>
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-violet-50 border border-violet-100 text-violet-700 text-xs font-medium">
                    <Users className="w-3 h-3" />{pkg.invitations} Invitation{pkg.invitations !== 1 ? 's' : ''}
                  </div>
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-100 text-emerald-700 text-xs font-medium">
                    <Activity className="w-3 h-3" />{pkg.inbody_sessions} InBody Session{pkg.inbody_sessions !== 1 ? 's' : ''}
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t border-border">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Price per session</span>
                  <span className="font-semibold text-foreground">
                    {pkg.sessions === 999 ? "—" : `${(pkg.price / pkg.sessions).toFixed(0)} EGP`}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Member distribution */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Member Distribution</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {packages.map(pkg => {
            const count = members.filter(m => m.package_name === pkg.name).length;
            const pct = members.length > 0 ? Math.round((count / members.length) * 100) : 0;
            return (
              <div key={pkg.id} className="flex items-center gap-3 p-3 rounded-lg bg-card border">
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between mb-1">
                    <span className="text-sm font-medium text-foreground">{pkg.name}</span>
                    <span className="text-sm text-muted-foreground">{count} members ({pct}%)</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-constructive rounded-full transition-all" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={o => !o && closeDialog()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editPkg ? `Edit: ${editPkg.name}` : 'New Subscription Package'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2 max-h-[70vh] overflow-y-auto pr-1">
            <div className="space-y-1.5">
              <Label>Package Name *</Label>
              <Input placeholder="e.g. 12 Sessions" value={form.name} onChange={f('name')} />
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <Label>Sessions</Label>
                <button
                  onClick={() => setUnlimited(p => !p)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${unlimited ? 'bg-primary text-primary-foreground border-primary' : 'bg-muted text-muted-foreground border-input hover:bg-accent'}`}
                >
                  {unlimited ? '∞ Unlimited' : 'Set count'}
                </button>
              </div>
              {!unlimited && (
                <Input type="number" placeholder="e.g. 12" min="1" value={form.sessions} onChange={f('sessions')} />
              )}
              {unlimited && <p className="text-xs text-muted-foreground px-1">Unlimited sessions — no deduction</p>}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Price (EGP) *</Label>
                <Input type="number" placeholder="0" value={form.price} onChange={f('price')} />
              </div>
              <div className="space-y-1.5">
                <Label>Validity (days)</Label>
                <Input type="number" placeholder="30" value={form.validityDays} onChange={f('validityDays')} />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label>Freeze Days</Label>
                <Input type="number" placeholder="7" value={form.freezeDays} onChange={f('freezeDays')} />
              </div>
              <div className="space-y-1.5">
                <Label>Invitations</Label>
                <Input type="number" placeholder="1" value={form.invitations} onChange={f('invitations')} />
              </div>
              <div className="space-y-1.5">
                <Label>InBody Sessions</Label>
                <Input type="number" placeholder="1" value={form.inBodySessions} onChange={f('inBodySessions')} />
              </div>
            </div>

            {form.price && (unlimited ? false : form.sessions) && (
              <div className="px-3 py-2 rounded-lg bg-muted/50 text-xs text-muted-foreground">
                Price per session: <strong>{(Number(form.price) / Number(form.sessions)).toFixed(0)} EGP</strong>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Cancel</Button>
            <Button onClick={handleSave}>{editPkg ? 'Save Changes' : 'Create Package'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={!!confirmDelete} onOpenChange={o => !o && setConfirmDelete(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Delete Package</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground py-2">
            Are you sure you want to delete <strong>{confirmDelete?.name}</strong>?
            {members.some(m => m.package_name === confirmDelete?.name) && (
              <span className="block mt-2 text-red-600 font-medium">⚠ Members are currently on this package — cannot delete.</span>
            )}
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => confirmDelete && handleDelete(confirmDelete)}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
