import { useState } from "react";
import { Plus, Shield, Users, Pencil, Trash2, Eye, EyeOff, CheckSquare, Square } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from "@/components/ui/dialog";
import { useAuth, AppUser } from "@/lib/auth";
import type { Role } from "@/lib/types";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const ALL_TABS = [
  { value: '/', label: 'Dashboard' },
  { value: '/checkin', label: 'Check-In' },
  { value: '/members', label: 'Members' },
  { value: '/subscriptions', label: 'Subscriptions' },
  { value: '/invoices', label: 'Invoices' },
  { value: '/discounts', label: 'Discounts' },
  { value: '/finance', label: 'Finance' },
  { value: '/daily', label: 'Daily Report' },
  { value: '/reports', label: 'Member Reports' },
  { value: '/coaches', label: 'Coaches' },
  { value: '/classes', label: 'Classes' },
  { value: '/sports', label: 'Sports' },
  { value: '/leads', label: 'Leads' },
  { value: '/liabilities', label: 'Liabilities' },
  { value: '/audit', label: 'Audit Log' },
  { value: '/users', label: 'User Management' },
];

interface UserForm {
  name: string;
  email: string;
  password: string;
  roleIds: string[];
}

interface RoleForm {
  name: string;
  description: string;
  tabs: string[];
}

const emptyUserForm: UserForm = { name: "", email: "", password: "", roleIds: [] };
const emptyRoleForm: RoleForm = { name: "", description: "", tabs: [] };

export default function UsersPage() {
  const { 
    users, availableRoles, currentUser, 
    createUser, updateUser, deleteUser,
    createRole, updateRole, deleteRole
  } = useAuth();
  
  const [activeTab, setActiveTab] = useState('accounts');
  
  // User state
  const [showUserDialog, setShowUserDialog] = useState(false);
  const [editUser, setEditUser] = useState<AppUser | null>(null);
  const [userForm, setUserForm] = useState<UserForm>(emptyUserForm);
  const [showPass, setShowPass] = useState(false);
  const [confirmDeleteUser, setConfirmDeleteUser] = useState<AppUser | null>(null);

  // Role state
  const [showRoleDialog, setShowRoleDialog] = useState(false);
  const [editRole, setEditRole] = useState<Role | null>(null);
  const [roleForm, setRoleForm] = useState<RoleForm>(emptyRoleForm);
  const [confirmDeleteRole, setConfirmDeleteRole] = useState<Role | null>(null);

  // Loading states
  const [isSavingUser, setIsSavingUser] = useState(false);
  const [isDeletingUser, setIsDeletingUser] = useState(false);
  const [isSavingRole, setIsSavingRole] = useState(false);
  const [isDeletingRole, setIsDeletingRole] = useState(false);

  // --- User Handlers ---
  const openCreateUser = () => { setUserForm(emptyUserForm); setEditUser(null); setShowUserDialog(true); };
  const openEditUser = (u: AppUser) => {
    setEditUser(u);
    setUserForm({ name: u.name, email: u.email, password: "", roleIds: u.roles.map(r => r.id) });
    setShowUserDialog(true);
  };
  const closeUserDialog = () => { setShowUserDialog(false); setEditUser(null); };

  const handleSaveUser = async () => {
    if (!userForm.name.trim() || !userForm.email.trim() || (!editUser && !userForm.password.trim())) {
      toast.error("All required fields must be filled");
      return;
    }
    if (!userForm.email.includes('@')) {
      toast.error("Enter a valid email address");
      return;
    }
    setIsSavingUser(true);
    try {
      if (editUser) {
        const updates: any = { name: userForm.name.trim(), email: userForm.email.trim(), roleIds: userForm.roleIds };
        if (userForm.password) updates.password = userForm.password;
        
        const result = await updateUser(editUser.id, updates);
        if (!result.ok) { toast.error(result.error ?? "Failed to update user"); return; }
        toast.success(`User updated: ${userForm.name}`);
      } else {
        const result = await createUser({ name: userForm.name.trim(), email: userForm.email.trim(), password: userForm.password, roleIds: userForm.roleIds });
        if (!result.ok) { toast.error(result.error ?? "Failed to create user"); return; }
        toast.success(`Account created for ${userForm.name}`);
      }
      closeUserDialog();
    } finally {
      setIsSavingUser(false);
    }
  };

  const handleDeleteUser = async (u: AppUser) => {
    if (u.id === currentUser?.id) { toast.error("You cannot delete your own account"); return; }
    setIsDeletingUser(true);
    try {
      const result = await deleteUser(u.id);
      if (!result.ok) { toast.error(result.error ?? "Failed to delete user"); return; }
      toast.success(`Deleted: ${u.name}`);
      setConfirmDeleteUser(null);
    } finally {
      setIsDeletingUser(false);
    }
  };

  const toggleUserRole = (roleId: string) => {
    setUserForm(prev => {
      const hasRole = prev.roleIds.includes(roleId);
      if (hasRole) return { ...prev, roleIds: prev.roleIds.filter(id => id !== roleId) };
      return { ...prev, roleIds: [...prev.roleIds, roleId] };
    });
  };

  // --- Role Handlers ---
  const openCreateRole = () => { setRoleForm(emptyRoleForm); setEditRole(null); setShowRoleDialog(true); };
  const openEditRole = (r: Role) => {
    setEditRole(r);
    setRoleForm({ name: r.name, description: r.description || "", tabs: r.tabs || [] });
    setShowRoleDialog(true);
  };
  const closeRoleDialog = () => { setShowRoleDialog(false); setEditRole(null); };

  const handleSaveRole = async () => {
    if (!roleForm.name.trim()) {
      toast.error("Role name is required");
      return;
    }
    setIsSavingRole(true);
    try {
      if (editRole) {
        const result = await updateRole(editRole.id, { name: roleForm.name.trim(), description: roleForm.description.trim(), tabs: roleForm.tabs });
        if (!result.ok) { toast.error(result.error ?? "Failed to update role"); return; }
        toast.success(`Role updated: ${roleForm.name}`);
      } else {
        const result = await createRole({ name: roleForm.name.trim(), description: roleForm.description.trim(), tabs: roleForm.tabs });
        if (!result.ok) { toast.error(result.error ?? "Failed to create role"); return; }
        toast.success(`Role created: ${roleForm.name}`);
      }
      closeRoleDialog();
    } finally {
      setIsSavingRole(false);
    }
  };

  const handleDeleteRole = async (r: Role) => {
    setIsDeletingRole(true);
    try {
      const result = await deleteRole(r.id);
      if (!result.ok) { toast.error(result.error ?? "Failed to delete role"); return; }
      toast.success(`Deleted role: ${r.name}`);
      setConfirmDeleteRole(null);
    } finally {
      setIsDeletingRole(false);
    }
  };

  const toggleRoleTab = (tabValue: string) => {
    setRoleForm(prev => {
      const hasTab = prev.tabs.includes(tabValue);
      if (hasTab) return { ...prev, tabs: prev.tabs.filter(t => t !== tabValue) };
      return { ...prev, tabs: [...prev.tabs, tabValue] };
    });
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">User Management</h1>
          <p className="text-sm text-muted-foreground">{users.length} account{users.length !== 1 ? 's' : ''} • Admin access only</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="accounts" className="gap-2"><Users className="w-4 h-4" /> Accounts</TabsTrigger>
            <TabsTrigger value="roles" className="gap-2"><Shield className="w-4 h-4" /> Custom Roles</TabsTrigger>
          </TabsList>
          {activeTab === 'accounts' ? (
            <Button onClick={openCreateUser} className="gap-2">
              <Plus className="w-4 h-4" /> New Account
            </Button>
          ) : (
            <Button onClick={openCreateRole} className="gap-2">
              <Plus className="w-4 h-4" /> New Role
            </Button>
          )}
        </div>

        <TabsContent value="accounts" className="space-y-6">
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
                  <div className="flex flex-wrap gap-1">
                    {u.roles.map(r => (
                      <span key={r.id} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-muted text-muted-foreground border">
                        {r.name}
                      </span>
                    ))}
                    {u.roles.length === 0 && (
                      <span className="text-xs text-muted-foreground italic">No roles</span>
                    )}
                  </div>
                  <div className="flex gap-1.5 flex-shrink-0 ml-4">
                    <Button variant="ghost" size="sm" onClick={() => openEditUser(u)} className="h-7 w-7 p-0">
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    {u.id !== currentUser?.id && (
                      <Button variant="ghost" size="sm" onClick={() => setConfirmDeleteUser(u)} className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive">
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="roles" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {availableRoles.map(r => (
              <Card key={r.id} className="flex flex-col">
                <CardHeader className="pb-3 flex-row items-start justify-between space-y-0">
                  <div>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Shield className="w-4 h-4 text-primary" /> {r.name}
                    </CardTitle>
                    {r.description && <p className="text-xs text-muted-foreground mt-1">{r.description}</p>}
                  </div>
                  <div className="flex gap-1">
                    {r.name.toLowerCase() !== 'admin' && (
                      <>
                        <Button variant="ghost" size="sm" onClick={() => openEditRole(r)} className="h-7 w-7 p-0">
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setConfirmDeleteRole(r)} className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive">
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="flex-1">
                  <p className="text-xs font-semibold mb-2 text-muted-foreground">Accessible Tabs ({r.tabs.length})</p>
                  <div className="flex flex-wrap gap-1.5">
                    {r.tabs.map(t => {
                      const tabConfig = ALL_TABS.find(x => x.value === t);
                      return (
                        <span key={t} className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-muted">
                          {tabConfig ? tabConfig.label : t}
                        </span>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* --- Dialogs --- */}

      {/* Create/Edit User Dialog */}
      <Dialog open={showUserDialog} onOpenChange={o => !o && closeUserDialog()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editUser ? `Edit Account: ${editUser.name}` : 'Create New Account'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Full Name</Label>
              <Input placeholder="e.g. John Smith" value={userForm.name} onChange={e => setUserForm(p => ({ ...p, name: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Email Address</Label>
              <Input type="email" placeholder="user@gym.com" value={userForm.email} onChange={e => setUserForm(p => ({ ...p, email: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>{editUser ? 'Password (leave blank to keep unchanged)' : 'Password'}</Label>
              <div className="relative">
                <Input
                  type={showPass ? "text" : "password"}
                  placeholder="••••••••"
                  value={userForm.password}
                  onChange={e => setUserForm(p => ({ ...p, password: e.target.value }))}
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
            <div className="space-y-2">
              <Label>Roles</Label>
              <div className="space-y-2 max-h-48 overflow-y-auto p-1">
                {availableRoles.map(r => {
                  const checked = userForm.roleIds.includes(r.id);
                  return (
                    <label key={r.id} className="flex items-start gap-3 p-2 rounded-lg border cursor-pointer hover:bg-muted/50">
                      <div className="mt-0.5 text-primary">
                        {checked ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4 text-muted-foreground" />}
                      </div>
                      <input type="checkbox" className="sr-only" checked={checked} onChange={() => toggleUserRole(r.id)} />
                      <div className="flex-1">
                        <p className="text-sm font-medium leading-none mb-1">{r.name}</p>
                        <p className="text-xs text-muted-foreground line-clamp-1">{r.description || r.tabs.length + ' tabs'}</p>
                      </div>
                    </label>
                  );
                })}
                {availableRoles.length === 0 && (
                  <p className="text-sm text-muted-foreground">No roles available. Create one first.</p>
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeUserDialog}>Cancel</Button>
            <Button onClick={handleSaveUser} disabled={isSavingUser}>
              {isSavingUser ? 'Saving...' : editUser ? 'Save Changes' : 'Create Account'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete User Confirm */}
      <Dialog open={!!confirmDeleteUser} onOpenChange={o => !o && setConfirmDeleteUser(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Delete Account</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground py-2">
            Are you sure you want to delete <strong>{confirmDeleteUser?.name}</strong>?
            They will lose access immediately.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDeleteUser(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => confirmDeleteUser && handleDeleteUser(confirmDeleteUser)} disabled={isDeletingUser}>
              {isDeletingUser ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create/Edit Role Dialog */}
      <Dialog open={showRoleDialog} onOpenChange={o => !o && closeRoleDialog()}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editRole ? `Edit Role: ${editRole.name}` : 'Create Custom Role'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Role Name</Label>
                <Input placeholder="e.g. Manager" value={roleForm.name} onChange={e => setRoleForm(p => ({ ...p, name: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Description (Optional)</Label>
                <Input placeholder="Short description" value={roleForm.description} onChange={e => setRoleForm(p => ({ ...p, description: e.target.value }))} />
              </div>
            </div>
            
            <div className="space-y-2 pt-2 border-t">
              <div className="flex items-center justify-between">
                <Label>Accessible Tabs</Label>
                <span className="text-xs text-muted-foreground">{roleForm.tabs.length} selected</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                {ALL_TABS.map(tab => {
                  const checked = roleForm.tabs.includes(tab.value);
                  return (
                    <label 
                      key={tab.value} 
                      className={cn(
                        "flex items-center gap-2 p-2 rounded-md border text-sm cursor-pointer transition-colors",
                        checked ? "bg-primary/10 border-primary" : "hover:bg-muted"
                      )}
                    >
                      <input type="checkbox" className="sr-only" checked={checked} onChange={() => toggleRoleTab(tab.value)} />
                      <div className={checked ? "text-primary" : "text-muted-foreground"}>
                        {checked ? <CheckSquare className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5" />}
                      </div>
                      <span className={checked ? "font-medium" : ""}>{tab.label}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeRoleDialog}>Cancel</Button>
            <Button onClick={handleSaveRole} disabled={isSavingRole}>
              {isSavingRole ? 'Saving...' : editRole ? 'Save Role' : 'Create Role'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Role Confirm */}
      <Dialog open={!!confirmDeleteRole} onOpenChange={o => !o && setConfirmDeleteRole(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Delete Custom Role</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground py-2">
            Are you sure you want to delete the role <strong>{confirmDeleteRole?.name}</strong>?
            Users assigned to this role will lose access to its tabs if they don't have another role providing them.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDeleteRole(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => confirmDeleteRole && handleDeleteRole(confirmDeleteRole)} disabled={isDeletingRole}>
              {isDeletingRole ? 'Deleting...' : 'Delete Role'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
