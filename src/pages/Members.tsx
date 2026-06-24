import { useState } from "react";
import { Plus, Search, Phone, Calendar, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useMembers, useCoaches, useCreateMember, useUpdateMember } from "@/hooks/use-data";
import type { Member, Gender } from "@/lib/types";
import StatusBadge from "@/components/StatusBadge";
import { toast } from "sonner";
import { format, differenceInYears, parseISO } from "date-fns";

const SOURCES = ["Walk-in", "Referral", "Facebook", "Instagram", "WhatsApp"];
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
  source: string;
  assignedCoachId: string;
}

const emptyForm: MemberForm = {
  name: "", phone: "", parentPhone: "", birthDate: "",
  gender: "", source: "Walk-in", assignedCoachId: "",
};

function memberToForm(m: Member): MemberForm {
  return {
    name: m.name, phone: m.phone, parentPhone: m.parent_phone ?? "",
    birthDate: m.birth_date ?? "", gender: m.gender ?? "",
    source: m.source, assignedCoachId: m.assigned_coach_id ?? "",
  };
}

function calcAge(birthDate?: string | null) {
  if (!birthDate) return null;
  try { return differenceInYears(new Date(), parseISO(birthDate)); } catch { return null; }
}

export default function Members() {
  const { data: members = [] } = useMembers();
  const { data: coaches = [] } = useCoaches();
  const createMember = useCreateMember();
  const updateMember = useUpdateMember();

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [showAdd, setShowAdd] = useState(false);
  const [editMember, setEditMember] = useState<Member | null>(null);
  const [form, setForm] = useState<MemberForm>(emptyForm);

  const filtered = members.filter(m => {
    const matchSearch =
      m.name.toLowerCase().includes(query.toLowerCase()) ||
      m.display_id.toLowerCase().includes(query.toLowerCase()) ||
      m.phone.includes(query);
    const matchStatus = statusFilter === "all" || m.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const counts: Record<string, number> = {
    all: members.length,
    active: members.filter(m => m.status === 'active').length,
    expiring_soon: members.filter(m => m.status === 'expiring_soon').length,
    expired: members.filter(m => m.status === 'expired').length,
    has_debt: members.filter(m => m.status === 'has_debt').length,
  };

  const openAdd = () => { setForm(emptyForm); setShowAdd(true); };
  const openEdit = (m: Member) => { setEditMember(m); setForm(memberToForm(m)); };
  const closeDialogs = () => { setShowAdd(false); setEditMember(null); };

  const handleSave = async () => {
    if (!form.name.trim() || !form.phone.trim()) {
      toast.error("Name and phone are required");
      return;
    }

    const assignedCoachId = (form.assignedCoachId && form.assignedCoachId !== '__none__') ? form.assignedCoachId : null;

    if (editMember) {
      updateMember.mutate({
        id: editMember.id,
        updates: {
          name: form.name.trim(),
          phone: form.phone.trim(),
          parent_phone: form.parentPhone.trim() || null,
          birth_date: form.birthDate || null,
          gender: (form.gender as Gender) || null,
          source: form.source,
          assigned_coach_id: assignedCoachId,
        }
      }, {
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
        source: form.source,
        assigned_coach_id: assignedCoachId,
        status: 'active',
        sessions_remaining: 0,
        total_sessions: 0,
        expires_at: new Date().toISOString(),
        member_since: new Date().toISOString(),
        package_name: "None",
        freeze_days_used: 0,
        freeze_days_total: 7,
      }, {
        onSuccess: () => {
          toast.success(`Member ${form.name} created`);
          closeDialogs();
        },
        onError: (err) => toast.error(`Error creating: ${err.message}`)
      });
    }
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
            <TabsTrigger value="expiring_soon" className="text-xs">Expiring ({counts.expiring_soon})</TabsTrigger>
            <TabsTrigger value="expired" className="text-xs">Expired ({counts.expired})</TabsTrigger>
            <TabsTrigger value="has_debt" className="text-xs">Debt ({counts.has_debt})</TabsTrigger>
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
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {filtered.map(m => {
            const age = calcAge(m.birth_date);
            return (
              <Card key={m.id} data-testid={`member-card-${m.id}`} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <span className="text-sm font-bold text-primary">{m.name.charAt(0)}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-foreground text-sm">{m.name}</p>
                        <StatusBadge status={m.status} />
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {m.display_id}
                        {m.gender && ` · ${m.gender}`}
                        {age !== null && ` · ${age}y`}
                      </p>
                    </div>
                    <button
                      data-testid={`btn-edit-member-${m.id}`}
                      onClick={() => openEdit(m)}
                      className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground flex-shrink-0"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                    <div className="p-1.5 rounded bg-muted/50">
                      <p className="text-sm font-bold text-foreground">
                        {m.sessions_remaining === 999 ? "∞" : m.sessions_remaining}
                      </p>
                      <p className="text-xs text-muted-foreground leading-tight">Sessions</p>
                    </div>
                    <div className="p-1.5 rounded bg-muted/50">
                      <p className="text-sm font-bold text-foreground truncate">{m.package_name?.split(' ')[0]}</p>
                      <p className="text-xs text-muted-foreground leading-tight">Package</p>
                    </div>
                    <div className="p-1.5 rounded bg-muted/50">
                      <p className="text-sm font-bold text-foreground">{format(new Date(m.expires_at), "dd MMM")}</p>
                      <p className="text-xs text-muted-foreground leading-tight">Expires</p>
                    </div>
                  </div>

                  <div className="mt-3 space-y-1">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Phone className="w-3 h-3" /> {m.phone}
                      {m.parent_phone && (
                        <span className="text-xs text-muted-foreground/70">· P: {m.parent_phone}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Calendar className="w-3 h-3" /> Since {format(new Date(m.member_since), "MMM yyyy")}
                      {m.coach_name && (
                        <span className="ml-1">· {m.coach_name.split(' ')[0]}</span>
                      )}
                    </div>
                  </div>

                  {m.freeze_days_total && m.freeze_days_total > 0 && (
                    <div className="mt-2">
                      <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                        <span>Freeze days</span>
                        <span>{m.freeze_days_used ?? 0}/{m.freeze_days_total}</span>
                      </div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-400 rounded-full"
                          style={{ width: `${((m.freeze_days_used ?? 0) / m.freeze_days_total) * 100}%` }}
                        />
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Add / Edit Member Dialog */}
      <Dialog open={showAdd || !!editMember} onOpenChange={o => !o && closeDialogs()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editMember ? `Edit: ${editMember.name}` : "New Member"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2 max-h-[70vh] overflow-y-auto pr-1">
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
                  placeholder="055-XXXXXXX"
                  value={form.phone}
                  onChange={f('phone')}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="m-parent-phone">Parent Phone</Label>
                <Input
                  data-testid="input-new-member-parent-phone"
                  id="m-parent-phone"
                  placeholder="055-XXXXXXX"
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

            {/* Source */}
            <div className="space-y-1.5">
              <Label>Source</Label>
              <Select value={form.source} onValueChange={v => setForm(p => ({ ...p, source: v }))}>
                <SelectTrigger data-testid="select-member-source">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SOURCES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* Assigned Coach */}
            <div className="space-y-1.5">
              <Label>Assigned Coach</Label>
              <Select value={form.assignedCoachId} onValueChange={v => setForm(p => ({ ...p, assignedCoachId: v }))}>
                <SelectTrigger data-testid="select-member-coach">
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None</SelectItem>
                  {coaches.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

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
    </div>
  );
}
