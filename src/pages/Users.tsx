import { useState } from "react";
import { Plus, Shield, Users, Pencil, Trash2, Eye, EyeOff } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import { useAuth, UserRole, AppUser } from "@/lib/auth";
import { toast } from "sonner";

const roleColors: Record<UserRole, string> = {
  admin: "bg-[#ffc700]/20 text-yellow-800 border-[#ffc700]/40",
  reception: "bg-blue-100 text-blue-700 border-blue-200",
  sales: "bg-violet-100 text-violet-700 border-violet-200",
};

const roleLabels: Record<UserRole, string> = {
  admin: "Admin",
  reception: "Reception",
  sales: "Sales",
};

const roleDescriptions: Record<UserRole, string> = {
  admin: "Full access — all pages including user management",
  reception: "Operational access — check-in, members, invoices, finance, coaches, schedule",
  sales: "Sales access — members and leads only",
};

interface UserForm {
  name: string;
  email: string;
  password: string;
  role: UserRole;
}

const emptyForm: UserForm = { name: "", email: "", password: "", role: "reception" };

export default function UsersPage() {
  const { users, currentUser, createUser, updateUser, deleteUser } = useAuth();
  const [showDialog, setShowDialog] = useState(false);
  const [editUser, setEditUser] = useState<AppUser | null>(null);
  const [form, setForm] = useState<UserForm>(emptyForm);
  const [showPass, setShowPass] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<AppUser | null>(null);

  const openCreate = () => { setForm(emptyForm); setEditUser(null); setShowDialog(true); };
  const openEdit = (u: AppUser) => {
    setEditUser(u);
    setForm({ name: u.name, email: u.email, password: u.password, role: u.role });
    setShowDialog(true);
  };
  const closeDialog = () => { setShowDialog(false); setEditUser(null); };

  const handleSave = () => {
    if (!form.name.trim() || !form.email.trim() || !form.password.trim()) {
      toast.error("All fields are required");
      return;
    }
    if (!form.email.includes('@')) {
      toast.error("Enter a valid email address");
      return;
    }
    if (editUser) {
      updateUser(editUser.id, { name: form.name.trim(), email: form.email.trim(), password: form.password, role: form.role });
      toast.success(`User updated: ${form.name}`);
    } else {
      const result = createUser({ name: form.name.trim(), email: form.email.trim(), password: form.password, role: form.role });
      if (!result.ok) { toast.error(result.error ?? "Failed to create user"); return; }
      toast.success(`Account created for ${form.name}`);
    }
    closeDialog();
  };

  const handleDelete = (u: AppUser) => {
    if (u.id === currentUser?.id) { toast.error("You cannot delete your own account"); return; }
    deleteUser(u.id);
    toast.success(`Deleted: ${u.name}`);
    setConfirmDelete(null);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">User Management</h1>
          <p className="text-sm text-muted-foreground">{users.length} account{users.length !== 1 ? 's' : ''} · Admin access only</p>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="w-4 h-4" /> New Account
        </Button>
      </div>

      {/* Role overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {(Object.keys(roleDescriptions) as UserRole[]).map(role => (
          <div key={role} className="p-4 rounded-xl border bg-card">
            <div className="flex items-center gap-2 mb-2">
              <Shield className="w-4 h-4 text-muted-foreground" />
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${roleColors[role]}`}>
                {roleLabels[role]}
              </span>
              <span className="text-xs text-muted-foreground ml-auto">{users.filter(u => u.role === role).length} user{users.filter(u => u.role === role).length !== 1 ? 's' : ''}</span>
            </div>
            <p className="text-xs text-muted-foreground">{roleDescriptions[role]}</p>
          </div>
        ))}
      </div>

      {/* Users list */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Users className="w-4 h-4 text-muted-foreground" /> All Accounts
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {users.map(u => (
            <div key={u.id} className={`flex items-center gap-4 p-3 rounded-lg border bg-card hover:bg-muted/30 transition-colors ${u.id === currentUser?.id ? 'border-primary/40 bg-primary/5' : ''}`}>
              <div className="w-9 h-9 rounded-full bg-[#0a0a0a] flex items-center justify-center flex-shrink-0">
                <span className="text-sm font-bold text-[#ffc700]">{u.name.charAt(0).toUpperCase()}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-foreground">{u.name}</p>
                  {u.id === currentUser?.id && (
                    <span className="text-xs text-muted-foreground">(you)</span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">{u.email}</p>
              </div>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${roleColors[u.role]}`}>
                {roleLabels[u.role]}
              </span>
              <div className="flex gap-1.5 flex-shrink-0">
                <Button variant="ghost" size="sm" onClick={() => openEdit(u)} className="h-7 w-7 p-0">
                  <Pencil className="w-3.5 h-3.5" />
                </Button>
                {u.id !== currentUser?.id && (
                  <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(u)} className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive">
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={o => !o && closeDialog()}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editUser ? `Edit: ${editUser.name}` : 'Create New Account'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Full Name</Label>
              <Input placeholder="e.g. John Smith" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Email Address</Label>
              <Input type="email" placeholder="user@gym.com" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>{editUser ? 'Password (leave blank to keep unchanged — not implemented in mock)' : 'Password'}</Label>
              <div className="relative">
                <Input
                  type={showPass ? "text" : "password"}
                  placeholder="••••••••"
                  value={form.password}
                  onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(p => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Role</Label>
              <Select value={form.role} onValueChange={(v: UserRole) => setForm(p => ({ ...p, role: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin — full access</SelectItem>
                  <SelectItem value="reception">Reception — operational tabs</SelectItem>
                  <SelectItem value="sales">Sales — members & leads only</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">{roleDescriptions[form.role]}</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Cancel</Button>
            <Button onClick={handleSave}>{editUser ? 'Save Changes' : 'Create Account'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <Dialog open={!!confirmDelete} onOpenChange={o => !o && setConfirmDelete(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Delete Account</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground py-2">
            Are you sure you want to delete <strong>{confirmDelete?.name}</strong>?
            They will lose access immediately.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => confirmDelete && handleDelete(confirmDelete)}>Delete Account</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
