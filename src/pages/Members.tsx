import { useState } from "react";
import { useLocation } from "wouter";
import { Plus, Search, Phone, Calendar, Pencil, Trash2, Snowflake, Unlock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useMembers, useCoaches, useClasses, useCreateMember, useUpdateMember, useDeleteMember, useCreateAuditLog, useFreezeMember, useUnfreezeMember } from "@/hooks/use-data";
import { useAuth } from "@/lib/auth";
import type { Member, Gender } from "@/lib/types";
import StatusBadge from "@/components/StatusBadge";
import { toast } from "sonner";
import { format, differenceInYears, parseISO } from "date-fns";

const GENDERS: { value: Gender; label: string }[] = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "other", label: "Other" },
];

interface MemberForm {
  name: string;
  phone: string;
  parentPhone: string;
  birthDate: string;
  gender: Gender | "";
  id: number;
  classId: string;
  isClinicVisitor: boolean;
  
  // Custom edit fields
  sessions_remaining: string;
  freeze_days_remaining: string;
  invitations_remaining: string;
  inbody_sessions_remaining: string;
}

const emptyForm: MemberForm = {
  name: "", phone: "", parentPhone: "", birthDate: "",
  gender: "", classId: "", id: 0, isClinicVisitor: false,
  sessions_remaining: "0",
  freeze_days_remaining: "0",
  invitations_remaining: "0", inbody_sessions_remaining: "0"
};

function memberToForm(m: Member): MemberForm {
  return {
    name: m.name, phone: m.phone, parentPhone: m.parent_phone ?? "",
    birthDate: m.birth_date ?? "", gender: m.gender ?? "",
    id: m.id,
    classId: m.class_id ?? "",
    isClinicVisitor: m.id === -1,
    sessions_remaining: String(m.sessions_remaining ?? 0),
    freeze_days_remaining: String(m.freeze_days_remaining ?? 0),
    invitations_remaining: String(m.invitations_remaining ?? 0),
    inbody_sessions_remaining: String(m.inbody_sessions_remaining ?? 0),
  };
}

function calcAge(birthDate?: string | null) {
  if (!birthDate) return null;
  try { return differenceInYears(new Date(), parseISO(birthDate)); } catch { return null; }
}

export default function Members() {
  const { data: members = [] } = useMembers();
  const { data: coaches = [] } = useCoaches();
  const { data: classes = [] } = useClasses();
  const createMember = useCreateMember();
  const updateMember = useUpdateMember();
  const deleteMember = useDeleteMember();
  const createAuditLog = useCreateAuditLog();
  const freezeMember = useFreezeMember();
  const unfreezeMember = useUnfreezeMember();
  const { currentUser } = useAuth();
  const [, navigate] = useLocation();

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [showAdd, setShowAdd] = useState(false);
  const [editMember, setEditMember] = useState<Member | null>(null);
  const [form, setForm] = useState<MemberForm>(emptyForm);
  const [confirmDelete, setConfirmDelete] = useState<Member | null>(null);
  const [freezeMemberState, setFreezeMemberState] = useState<Member | null>(null);
  const [freezeDaysInput, setFreezeDaysInput] = useState("");

  const filtered = members.filter(m => {
    const q = query.toLowerCase();
    let matchSearch = m.name.toLowerCase().includes(q) || m.phone.includes(query);
    // Allow ID search only for non-clinic visitors
    if (m.id !== -1) {
      matchSearch = matchSearch || m.id.toString().includes(q)
    }
    const isFrozen = m.frozen_until ? new Date(m.frozen_until) > new Date() : false;
    let matchStatus = false;
    if (statusFilter === "all") matchStatus = true;
    else if (statusFilter === "frozen") matchStatus = isFrozen;
    else if (statusFilter === "active") matchStatus = m.status === 'active' && !isFrozen;
    else matchStatus = m.status === statusFilter;
    
    return matchSearch && matchStatus;
  });

  const counts: Record<string, number> = {
    all: members.length,
    active: members.filter(m => m.status === 'active' && !(m.frozen_until && new Date(m.frozen_until) > new Date())).length,
    frozen: members.filter(m => m.frozen_until && new Date(m.frozen_until) > new Date()).length,
    expiring_soon: members.filter(m => m.status === 'expiring_soon').length,
    expired: members.filter(m => m.status === 'expired').length,
    has_debt: members.filter(m => m.status === 'has_debt').length,
    new: members.filter(m => m.status === 'new').length,
  };

  const openAdd = () => { setForm(emptyForm); setShowAdd(true); };
  const openEdit = (m: Member) => { setEditMember(m); setForm(memberToForm(m)); };
  const closeDialogs = () => { setShowAdd(false); setEditMember(null); };

  const handleSave = async () => {
    if (!form.name.trim() || !form.phone.trim()) {
      toast.error("Name and phone are required");
      return;
    }

    const phoneRegex = /^\d{11}$/;
    if (!phoneRegex.test(form.phone.trim())) {
      toast.error("Phone number must be exactly 11 digits");
      return;
    }
    
    if (form.parentPhone.trim() && !phoneRegex.test(form.parentPhone.trim())) {
      toast.error("Parent phone number must be exactly 11 digits");
      return;
    }

    if (editMember) {
      const updates: Partial<Member> = {
        name: form.name.trim(),
        phone: form.phone.trim(),
        parent_phone: form.parentPhone.trim() || null,
        birth_date: form.birthDate || null,
        gender: (form.gender as Gender) || null,
        class_id: form.isClinicVisitor || form.classId === '__none__' ? null : (form.classId || null),
        sessions_remaining: Number(form.sessions_remaining) || 0,
        freeze_days_remaining: Number(form.freeze_days_remaining) || 0,
        invitations_remaining: Number(form.invitations_remaining) || 0,
        inbody_sessions_remaining: Number(form.inbody_sessions_remaining) || 0,
      };

      if (!form.isClinicVisitor && editMember.id === -1) {
        updates.id = 0; // Signals queries.ts to auto-assign a new ID
      }

      updateMember.mutate({ id: editMember.uuid, updates }, {
        onSuccess: () => {
          toast.success(`${form.name} updated`);
          closeDialogs();
        },
        onError: (err) => toast.error(`Error updating: ${err.message}`)
      });
    } else {
      createMember.mutate({
        name: form.name.trim(),
        phone: form.phone.trim(),
        parent_phone: form.parentPhone.trim() || null,
        birth_date: form.birthDate || null,
        gender: (form.gender as Gender) || null,
        class_id: form.isClinicVisitor || form.classId === '__none__' ? null : (form.classId || null),
        status: 'new',
        sessions_remaining: 0,
        expires_at: null,
        member_since: new Date().toISOString(),
        package_name: "None",
        freeze_days_remaining: 0,
        id: form.isClinicVisitor ? -1 : 0,
      }, {
        onSuccess: () => {
          toast.success(`Member ${form.name} created`);
          closeDialogs();
        },
        onError: (err) => toast.error(`Error creating: ${err.message}`)
      });
    }
  };

  const handleDelete = (member: Member) => {
    deleteMember.mutate(member.uuid, {
      onSuccess: () => {
        createAuditLog.mutate({
          action: 'Delete Member',
          action_type: 'other',
          performed_by: currentUser?.id ?? null,
          performer_name: currentUser?.name ?? 'System',
          member_id: null,
          member_name: member.name,
          timestamp: new Date().toISOString(),
          details: `Hard deleted member ${member.id} (${member.name}), phone: ${member.phone}`,
        });
        toast.success(`Member ${member.name} deleted`);
        setConfirmDelete(null);
      },
      onError: (err) => toast.error(`Error deleting: ${err.message}`),
    });
  };

  const handleFreeze = () => {
    if (!freezeMemberState) return;
    const days = Number(freezeDaysInput);
    if (!days || days <= 0 || days % 7 !== 0) {
      toast.error("Please select a valid freeze duration (multiples of 7)");
      return;
    }
    if (days > freezeMemberState.freeze_days_remaining) {
      toast.error(`Cannot freeze for more than ${freezeMemberState.freeze_days_remaining} days`);
      return;
    }

    freezeMember.mutate({ memberId: freezeMemberState.uuid, days }, {
      onSuccess: () => {
        createAuditLog.mutate({
          action: 'Freeze Member',
          action_type: 'other',
          performed_by: currentUser?.id ?? null,
          performer_name: currentUser?.name ?? 'System',
          member_id: freezeMemberState.uuid,
          member_name: freezeMemberState.name,
          timestamp: new Date().toISOString(),
          details: `Froze membership for ${days} days. Previous expires_at: ${freezeMemberState.expires_at ? format(new Date(freezeMemberState.expires_at), 'dd MMM yyyy') : 'N/A'}`,
        });
        toast.success(`Membership frozen for ${days} days`);
        setFreezeMemberState(null);
        setFreezeDaysInput("");
      },
      onError: (err: any) => toast.error(`Error freezing: ${err.message}`)
    });
  };

  const handleUnfreeze = (m: Member) => {
    unfreezeMember.mutate(m.uuid, {
      onSuccess: () => {
        createAuditLog.mutate({
          action: 'Unfreeze Member',
          action_type: 'other',
          performed_by: currentUser?.id ?? null,
          performer_name: currentUser?.name ?? 'System',
          member_id: m.uuid,
          member_name: m.name,
          timestamp: new Date().toISOString(),
          details: `Manually unfroze membership early.`,
        });
        toast.success(`Membership for ${m.name} unfrozen.`);
      },
      onError: (err: any) => toast.error(`Error unfreezing: ${err.message}`)
    });
  };

  const f = (key: keyof MemberForm) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(p => ({ ...p, [key]: e.target.value }));

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Members</h1>
          <p className="text-sm text-muted-foreground">{members.length} total members</p>
        </div>
        <Button data-testid="btn-add-member" onClick={openAdd} className="gap-2">
          <Plus className="w-4 h-4" /> New Member
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            data-testid="input-member-search"
            placeholder="Search by name, ID, or phone..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Tabs value={statusFilter} onValueChange={setStatusFilter}>
          <TabsList className="h-9 flex-wrap">
            <TabsTrigger value="all" className="text-xs">All ({counts.all})</TabsTrigger>
            <TabsTrigger value="active" className="text-xs">Active ({counts.active})</TabsTrigger>
            <TabsTrigger value="frozen" className="text-xs">Frozen ({counts.frozen})</TabsTrigger>
            <TabsTrigger value="expiring_soon" className="text-xs">Expiring ({counts.expiring_soon})</TabsTrigger>
            <TabsTrigger value="expired" className="text-xs">Expired ({counts.expired})</TabsTrigger>
            <TabsTrigger value="has_debt" className="text-xs">Debt ({counts.has_debt})</TabsTrigger>
            <TabsTrigger value="new" className="text-xs">New ({counts.new})</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Members grid */}
      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">No members found</p>
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-md border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Member</TableHead>
                <TableHead>Contact Info</TableHead>
                <TableHead>Class</TableHead>
                <TableHead>Subscription</TableHead>
                <TableHead>Balances</TableHead>
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(m => {
                const age = calcAge(m.birth_date);
                return (
                  <TableRow key={m.uuid} data-testid={`member-row-${m.uuid}`}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${m.id === -1 ? 'bg-teal-100 text-teal-600' : 'bg-primary/10 text-primary'}`}>
                          <span className="text-sm font-bold">{m.name.charAt(0)}</span>
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-semibold text-foreground text-sm">{m.name}</p>
                            <StatusBadge status={m.status} />
                            {m.frozen_until && new Date(m.frozen_until) > new Date() && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-700">
                                FROZEN
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {m.id === -1 ? (
                              <span className="text-amber-600 font-medium">Clinic Visitor</span>
                            ) : (
                              <>#{m.id ?? '?'}</>
                            )}
                            {m.gender && ` · ${m.gender}`}
                            {age !== null && ` · ${age}y`}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Phone className="w-3 h-3" /> {m.phone}
                        </div>
                        {m.parent_phone && (
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span className="w-3 h-3 flex items-center justify-center font-bold text-[10px]">P</span> {m.parent_phone}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        {m.class_info ? (
                          <div className="text-sm">
                            <span className="font-semibold text-primary">{m.class_info.sport_name ?? 'No Sport'}</span>
                            <span className="text-muted-foreground mx-1">-</span>
                            <span>{m.class_info.coach_name ?? 'No Coach'}</span>
                            <div className="text-xs text-muted-foreground mt-1">
                              {m.class_info.schedules?.map(s => `${s.day.slice(0,3)} ${s.time}`).join(', ')}
                            </div>
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-sm">-</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <p className="text-sm font-medium">{m.package_name || 'None'}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          Last Subscription: {m.last_subscription_date ? format(new Date(m.last_subscription_date), "dd MMM yyyy") : 'Never'}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          Expires: {m.expires_at ? format(new Date(m.expires_at), "dd MMM yyyy") : 'N/A'}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1 text-xs">
                        <div className="flex justify-between w-32">
                          <span className="text-muted-foreground">Sessions:</span>
                          <span className="font-medium">{m.sessions_remaining === 999 ? "∞" : m.sessions_remaining}</span>
                        </div>
                        <div className="flex justify-between w-32">
                          <span className="text-muted-foreground">Freezes:</span>
                          <span className="font-medium">{m.freeze_days_remaining}</span>
                        </div>
                        <div className="flex justify-between w-32">
                          <span className="text-muted-foreground">Invites:</span>
                          <span className="font-medium">{m.invitations_remaining ?? 0}</span>
                        </div>
                        <div className="flex justify-between w-32">
                          <span className="text-muted-foreground">InBody:</span>
                          <span className="font-medium">{m.inbody_sessions_remaining ?? 0}</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {m.frozen_until && new Date(m.frozen_until) > new Date() ? (
                          <button
                            data-testid={`btn-unfreeze-member-${m.uuid}`}
                            onClick={() => handleUnfreeze(m)}
                            className="p-1.5 rounded-md hover:bg-orange-50 transition-colors text-muted-foreground hover:text-orange-600"
                            title="Unfreeze"
                            disabled={unfreezeMember.isPending}
                          >
                            <Unlock className="w-4 h-4" />
                          </button>
                        ) : (
                          <button
                            data-testid={`btn-freeze-member-${m.uuid}`}
                            onClick={() => { setFreezeMemberState(m); setFreezeDaysInput(""); }}
                            className="p-1.5 rounded-md hover:bg-blue-50 transition-colors text-muted-foreground hover:text-blue-600"
                            title="Freeze"
                          >
                            <Snowflake className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          data-testid={`btn-edit-member-${m.uuid}`}
                          onClick={() => openEdit(m)}
                          className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                          title="Edit"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          data-testid={`btn-delete-member-${m.uuid}`}
                          onClick={() => setConfirmDelete(m)}
                          className="p-1.5 rounded-md hover:bg-red-50 transition-colors text-muted-foreground hover:text-red-600"
                          title="Delete"
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

      {/* Add / Edit Member Dialog */}
      <Dialog open={showAdd || !!editMember} onOpenChange={o => !o && closeDialogs()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editMember ? `Edit: ${editMember.name}` : "New Member"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2 max-h-[70vh] overflow-y-auto pr-1">
            {/* Clinic Visitor Checkbox */}
            <div className="flex items-center space-x-2">
              <Checkbox
                id="is-clinic-visitor"
                checked={form.isClinicVisitor}
                onCheckedChange={(c) => setForm(p => ({ ...p, isClinicVisitor: !!c }))}
              />
              <Label htmlFor="is-clinic-visitor" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                This is a Clinic Visitor
              </Label>
            </div>

            {/* Name */}
            <div className="space-y-1.5">
              <Label htmlFor="m-name">Full Name *</Label>
              <Input
                data-testid="input-new-member-name"
                id="m-name"
                placeholder="Full name"
                value={form.name}
                onChange={f('name')}
              />
            </div>

            {/* Phone + Parent Phone */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="m-phone">Phone *</Label>
                <Input
                  data-testid="input-new-member-phone"
                  id="m-phone"
                  placeholder="01XXXXXXXXX"
                  value={form.phone}
                  onChange={f('phone')}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="m-parent-phone">Parent Phone</Label>
                <Input
                  data-testid="input-new-member-parent-phone"
                  id="m-parent-phone"
                  placeholder="01XXXXXXXXX"
                  value={form.parentPhone}
                  onChange={f('parentPhone')}
                />
              </div>
            </div>

            {/* Birth date + Gender */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="m-birth">Date of Birth</Label>
                <Input
                  data-testid="input-new-member-birthdate"
                  id="m-birth"
                  type="date"
                  value={form.birthDate}
                  onChange={f('birthDate')}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Gender</Label>
                <Select value={form.gender} onValueChange={v => setForm(p => ({ ...p, gender: v as Gender }))}>
                  <SelectTrigger data-testid="select-member-gender">
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    {GENDERS.map(g => <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Class (Hidden for clinic visitors) */}
            {!form.isClinicVisitor && (
              <div className="space-y-1.5">
                <Label htmlFor="m-class">Class</Label>
                <Select value={form.classId} onValueChange={v => setForm(p => ({ ...p, classId: v }))}>
                  <SelectTrigger data-testid="select-member-class">
                    <SelectValue placeholder="Select Class" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">None</SelectItem>
                    {classes.map(c => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.sport_name ?? 'Sport'} - {c.coach_name ?? 'Coach'} ({c.schedules?.length || 0} slots)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Custom Session Edits */}
            {editMember && (
              <div className="pt-4 mt-4 border-t space-y-4">
                <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Balances</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>Sessions</Label>
                    <Input type="number" value={form.sessions_remaining} onChange={e => setForm(p => ({ ...p, sessions_remaining: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Freeze Days</Label>
                    <Input type="number" value={form.freeze_days_remaining} onChange={e => setForm(p => ({ ...p, freeze_days_remaining: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Invitations</Label>
                    <Input type="number" value={form.invitations_remaining} onChange={e => setForm(p => ({ ...p, invitations_remaining: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>InBody Sessions</Label>
                    <Input type="number" value={form.inbody_sessions_remaining} onChange={e => setForm(p => ({ ...p, inbody_sessions_remaining: e.target.value }))} />
                  </div>
                </div>
              </div>
            )}


            {/* Subscription Package — read-only display + change via invoice */}
            {editMember && (
              <div className="space-y-1.5">
                <Label>Subscription Package</Label>
                <div className="flex items-center gap-2">
                  <div className="flex-1 px-3 py-2 rounded-md border bg-muted/50 text-sm text-foreground">
                    {editMember.package_name || "None"}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="shrink-0"
                    onClick={() => {
                      closeDialogs();
                      navigate(`/invoices?memberId=${editMember.uuid}`);
                    }}
                  >
                    Change Subscription
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  To change the subscription, create a new invoice with the desired package.
                </p>
              </div>
            )}

            {/* Preview age if birthdate set */}
            {form.birthDate && (
              <div className="px-3 py-2 rounded-lg bg-muted/50 text-xs text-muted-foreground">
                Age: {calcAge(form.birthDate) ?? '—'} years old
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialogs}>Cancel</Button>
            <Button data-testid="btn-save-member" onClick={handleSave}>
              {editMember ? "Save Changes" : "Create Member"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Member Confirmation */}
      <AlertDialog open={!!confirmDelete} onOpenChange={o => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Member Permanently</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to permanently delete <strong>{confirmDelete?.name}</strong> ({confirmDelete?.id})?
              <span className="block mt-2 text-red-600 font-medium">
                ⚠ This will also delete all their invoices, check-ins, and discount associations. This action cannot be undone.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmDelete && handleDelete(confirmDelete)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete Permanently
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Freeze Member Dialog */}
      <Dialog open={!!freezeMemberState} onOpenChange={o => { if (!o) { setFreezeMemberState(null); setFreezeDaysInput(""); }}}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Freeze Membership</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="px-3 py-2 rounded-lg bg-muted/50 text-sm space-y-1">
              <div className="flex justify-between"><span className="text-muted-foreground">Member</span><span>{freezeMemberState?.name}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Freeze Days Remaining</span><span className="font-bold text-blue-600">{freezeMemberState?.freeze_days_remaining} days</span></div>
            </div>
            <div className="space-y-1.5">
              <Label>Days to Freeze</Label>
              <Select value={freezeDaysInput} onValueChange={setFreezeDaysInput}>
                <SelectTrigger>
                  <SelectValue placeholder="Select duration" />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: Math.floor((freezeMemberState?.freeze_days_remaining || 0) / 7) }).map((_, i) => {
                    const d = (i + 1) * 7;
                    return <SelectItem key={d} value={d.toString()}>{d} Days</SelectItem>
                  })}
                </SelectContent>
              </Select>
              {(!freezeMemberState?.freeze_days_remaining || freezeMemberState.freeze_days_remaining < 7) && (
                 <p className="text-xs text-red-500">Not enough freeze days remaining (minimum 7).</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setFreezeMemberState(null); setFreezeDaysInput(""); }}>Cancel</Button>
            <Button onClick={handleFreeze} disabled={freezeMember.isPending}>Freeze Membership</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
