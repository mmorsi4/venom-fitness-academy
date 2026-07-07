import { useState } from "react";
import { useLocation } from "wouter";
import { Plus, Search, Phone, Calendar, Pencil, Trash2, Snowflake, Unlock, ArrowUpCircle, BicepsFlexed, Mail, Clock, Camera } from "lucide-react";
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { SearchableSelect } from "@/components/SearchableSelect";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useMembers, useCoaches, useClasses, useCreateMember, useUpdateMember, useDeleteMember, useCreateAuditLog, useFreezeMember, useUnfreezeMember, usePackages, useCreateInvoice, useAuditLogs, useInvoices, useUpdateInvoice, useMemberCheckIns, useDeleteMemberCheckIn, useUpdateMemberCheckIn } from "@/hooks/use-data";
import { uploadMemberPhoto } from "@/lib/queries";
import { CameraCapture } from "@/components/CameraCapture";
import { useAuth } from "@/lib/auth";
import type { Member, Gender } from "@/lib/types";
import StatusBadge from "@/components/StatusBadge";
import { toast } from "sonner";
import { format, differenceInYears, parseISO } from "date-fns";

const GENDERS: { value: Gender; label: string }[] = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
];

interface MemberForm {
  name: string;
  phone: string;
  parentPhone: string;
  birthDate: string;
  gender: string;
  id: number;
  customId: string;
  classId: string;
  isClinicVisitor: boolean;

  // Custom edit fields
  sessions_remaining: string;
  freeze_days_remaining: string;
  invitations_remaining: string;
  inbody_sessions_remaining: string;
  status: string;
  removePhoto?: boolean;
}

const emptyForm: MemberForm = {
  name: "", phone: "", parentPhone: "", birthDate: "",
  gender: "", classId: "", id: 0, customId: "", isClinicVisitor: false,
  sessions_remaining: "0",
  freeze_days_remaining: "0",
  invitations_remaining: "0", inbody_sessions_remaining: "0",
  status: "active"
};

function memberToForm(m: Member): MemberForm {
  return {
    name: m.name, phone: m.phone, parentPhone: m.parent_phone ?? "",
    birthDate: m.birth_date ?? "", gender: m.gender ?? "",
    id: m.id,
    customId: m.id !== -1 ? String(m.id) : "",
    classId: m.class_id ?? "",
    isClinicVisitor: m.id === -1,
    sessions_remaining: String(m.sessions_remaining ?? 0),
    freeze_days_remaining: String(m.freeze_days_remaining ?? 0),
    invitations_remaining: String(m.invitations_remaining ?? 0),
    inbody_sessions_remaining: String(m.inbody_sessions_remaining ?? 0),
    status: m.status ?? "active",
  };
}

function calcAge(birthDate?: string | null) {
  if (!birthDate) return null;
  try { return differenceInYears(new Date(), parseISO(birthDate)); } catch { return null; }
}

export default function Members() {
  const { data: members = [] } = useMembers();
  const { data: invoices = [] } = useInvoices();
  const updateInvoice = useUpdateInvoice();
  const { data: coaches = [] } = useCoaches();
  const { data: classes = [] } = useClasses();
  const createMember = useCreateMember();
  const updateMember = useUpdateMember();
  const deleteMember = useDeleteMember();
  const createAuditLog = useCreateAuditLog();
  const freezeMember = useFreezeMember();
  const unfreezeMember = useUnfreezeMember();
  const { data: packages = [] } = usePackages();
  const { data: auditLogs = [] } = useAuditLogs();
  const createInvoice = useCreateInvoice();
  const { currentUser } = useAuth();
  const [, navigate] = useLocation();

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [showAdd, setShowAdd] = useState(false);
  const [photoBlob, setPhotoBlob] = useState<Blob | null>(null);
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [editMember, setEditMember] = useState<Member | null>(null);
  const [form, setForm] = useState<MemberForm>(emptyForm);
  const [confirmDelete, setConfirmDelete] = useState<Member | null>(null);
  const [freezeMemberState, setFreezeMemberState] = useState<Member | null>(null);
  const [freezeDaysInput, setFreezeDaysInput] = useState("");
  const [upgradeMemberState, setUpgradeMemberState] = useState<Member | null>(null);
  const [upgradePackageId, setUpgradePackageId] = useState("");
  const [upgradePaymentMethod, setUpgradePaymentMethod] = useState("Cash");
  const [upgradeInvoiceId, setUpgradeInvoiceId] = useState("");
  const [upgradePaymentDate, setUpgradePaymentDate] = useState("");
  const [upgradeDiscount, setUpgradeDiscount] = useState("");
  const [upgradePaidAmount, setUpgradePaidAmount] = useState("");
  const [upgradePackageCategoryFilter, setUpgradePackageCategoryFilter] = useState<string>("All");
  const [historyMember, setHistoryMember] = useState<Member | null>(null);
  const { data: checkInHistory = [] } = useMemberCheckIns(historyMember?.uuid || "");
  const deleteMemberCheckIn = useDeleteMemberCheckIn(historyMember?.uuid || "");
  const updateMemberCheckInTime = useUpdateMemberCheckIn();
  const [editingLogId, setEditingLogId] = useState<string | null>(null);
  const [editLogTime, setEditLogTime] = useState("");


  const [searchField, setSearchField] = useState<string>("all");
  const [classFilter, setClassFilter] = useState<string>("all");
  const [packageFilter, setPackageFilter] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const filtered = members.filter(m => {
    const q = query.toLowerCase();
    let matchSearch = false;

    const isNumeric = /^\d+$/.test(query.trim());
    if (searchField === "all") {
      matchSearch = m.name.toLowerCase().includes(q) || m.phone.includes(query);
      if (m.id !== -1 && isNumeric) {
        // Only do EXACT match for ID if user typed a number
        matchSearch = matchSearch || m.id.toString() === query.trim();
      }
    } else if (searchField === "id" && m.id !== -1) {
      matchSearch = m.id.toString() === query.trim();
    } else if (searchField === "name") {
      matchSearch = m.name.toLowerCase().includes(q);
    } else if (searchField === "phone") {
      matchSearch = m.phone.includes(query.trim());
    }

    const isFrozen = m.frozen_until ? new Date(m.frozen_until) > new Date() : false;
    let matchStatus = false;
    if (statusFilter === "all") matchStatus = true;
    else if (statusFilter === "frozen") matchStatus = isFrozen;
    else if (statusFilter === "active") matchStatus = m.status === 'active' && !isFrozen;
    else matchStatus = m.status === statusFilter;

    const matchClass = classFilter === "all" || m.class_id === classFilter;
    const matchPackage = packageFilter === "all" || m.package_id === packageFilter;

    return matchSearch && matchStatus && matchClass && matchPackage;
  });

  const totalPages = Math.ceil(filtered.length / pageSize);
  const paginatedMembers = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const counts: Record<string, number> = {
    all: members.length,
    active: members.filter(m => m.status === 'active' && !(m.frozen_until && new Date(m.frozen_until) > new Date())).length,
    frozen: members.filter(m => m.frozen_until && new Date(m.frozen_until) > new Date()).length,
    expiring_soon: members.filter(m => m.status === 'expiring_soon').length,
    expired: members.filter(m => m.status === 'expired').length,
    has_debt: members.filter(m => m.status === 'has_debt').length,
    new: members.filter(m => m.status === 'new').length,
  };

  const openAdd = () => { setForm(emptyForm); setShowAdd(true); setPhotoBlob(null); setPhotoDataUrl(null); setIsCapturing(false); };
  const openEdit = (m: Member) => { setEditMember(m); setForm(memberToForm(m)); setPhotoBlob(null); setPhotoDataUrl(m.photo_url || null); setIsCapturing(false); };
  const closeDialogs = () => { setShowAdd(false); setEditMember(null); setPhotoBlob(null); setPhotoDataUrl(null); setIsCapturing(false); };

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
        status: form.status as any,
      };

      if (!form.isClinicVisitor && editMember.id === -1) {
        updates.id = 0; // Signals queries.ts to auto-assign a new ID
      } else if (!form.isClinicVisitor && form.customId && editMember.id !== Number(form.customId)) {
        updates.id = Number(form.customId);
      }

      // Automatically update status based on sessions remaining
      if (updates.sessions_remaining !== undefined && editMember.sessions_remaining !== updates.sessions_remaining) {
        if (updates.sessions_remaining <= 0 && updates.sessions_remaining !== 999) {
          updates.status = 'expired';
        } else if (updates.sessions_remaining <= 2 && updates.sessions_remaining > 0 && updates.sessions_remaining !== 999) {
          updates.status = 'expiring_soon';
        } else if (updates.status === 'expired' && updates.sessions_remaining > 0) {
          updates.status = 'active';
        }
      }

      if (form.removePhoto) updates.photo_url = null;

      updateMember.mutate({ id: editMember.uuid, updates }, {
        onSuccess: async () => {
          if (photoBlob) {
            try {
              const url = await uploadMemberPhoto(editMember.uuid, photoBlob);
              await updateMember.mutateAsync({ id: editMember.uuid, updates: { photo_url: url } });
            } catch (err) { toast.error("Failed to upload photo"); }
          }
          // Sync with invoice if sessions changed
          if (updates.sessions_remaining !== undefined && editMember.sessions_remaining !== updates.sessions_remaining) {
            const latestInvoice = invoices.filter(i =>
              i.member_id === editMember.uuid &&
              (i.status === 'paid' || i.status === 'partial')
            ).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

            if (latestInvoice.length > 0) {
              updateInvoice.mutate({
                uuid: latestInvoice[0].uuid,
                updates: { sessions_remaining: updates.sessions_remaining }
              });
            }
          }

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
        session_debt: 0,
        expires_at: null,
        member_since: new Date().toISOString(),
        package_id: null,
        package_name: 'None',
        freeze_days_remaining: 0,
        invitations_remaining: 0,
        inbody_sessions_remaining: 0,
        id: form.isClinicVisitor ? -1 : (form.customId ? Number(form.customId) : 0),
      }, {
        onSuccess: async (newMember) => {
          if (photoBlob && newMember) {
            try {
              const url = await uploadMemberPhoto(newMember.uuid, photoBlob);
              await updateMember.mutateAsync({ id: newMember.uuid, updates: { photo_url: url } });
            } catch (err) { toast.error("Failed to upload photo"); }
          }
          toast.success(`Member ${form.name} created`);
          closeDialogs();
        },
        onError: (err) => toast.error(`Error creating: ${err.message}`)
      });
    }
  };

  const handleDelete = (member: Member) => {
    if (!confirm("Are you sure you want to permanently delete this member?")) return;
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
      onError: (err) => toast.error(`Error deleting: ${err.message}`)
    });
  };

  const handleDecrement = (member: Member, field: 'invitations_remaining' | 'inbody_sessions_remaining') => {
    const currentVal = member[field] ?? 0;
    if (currentVal <= 0) return;
    updateMember.mutate({
      id: member.uuid,
      updates: { [field]: currentVal - 1 }
    }, {
      onSuccess: () => {
        const typeStr = field === 'invitations_remaining' ? 'invitation' : 'InBody session';
        toast.success(`Used 1 ${typeStr} for ${member.name}`);
        createAuditLog.mutate({
          action: `Decrement ${typeStr}`,
          action_type: 'other',
          performed_by: currentUser?.id ?? null,
          performer_name: currentUser?.name ?? 'System',
          member_id: member.uuid,
          member_name: member.name,
          timestamp: new Date().toISOString(),
          details: `Decremented ${typeStr} for member ${member.id} (${member.name}). Remaining: ${currentVal - 1}`,
        });
      },
      onError: (err) => toast.error(`Error: ${err.message}`)
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
          details: `Froze membership for ${days} days. Previous expires_at: ${freezeMemberState.expires_at ? format(new Date(freezeMemberState.expires_at), 'dd/MM/yyyy') : 'N/A'}`,
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

  const handleUpgrade = async () => {
    if (!upgradeMemberState || !upgradePackageId) return;
    const currentPkg = packages.find(p => p.name === upgradeMemberState.package_name);
    const newPkg = packages.find(p => p.id.toString() === upgradePackageId);
    if (!currentPkg || !newPkg) {
      toast.error("Package data missing");
      return;
    }

    const activeInvoice = invoices.filter(i => i.member_id === upgradeMemberState.uuid && i.package_name === upgradeMemberState.package_name).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];

    let usedSessions = 0;
    if (currentPkg.sessions !== 999 && upgradeMemberState.sessions_remaining !== 999) {
      usedSessions = Math.max(0, currentPkg.sessions - upgradeMemberState.sessions_remaining);
    }

    const newSessions = newPkg.sessions === 999 ? 999 : Math.max(0, newPkg.sessions - usedSessions);

    const activationDateStr = activeInvoice?.activation_date || activeInvoice?.created_at || new Date().toISOString();
    const actDate = new Date(activationDateStr);
    const newExpiresAt = new Date(actDate.getTime() + newPkg.validity_days * 86400000).toISOString();

    const priceDiff = Math.max(0, newPkg.price - currentPkg.price);
    const discountAmt = Number(upgradeDiscount) || 0;
    const finalExpected = Math.max(0, priceDiff - discountAmt);
    const actualPaid = upgradePaidAmount !== "" ? Number(upgradePaidAmount) : finalExpected;

    if (activeInvoice) {
      updateInvoice.mutate({
        uuid: activeInvoice.uuid,
        updates: { sessions_remaining: 0 }
      });
    }

    createInvoice.mutate({
      member_id: upgradeMemberState.uuid,
      member_name: upgradeMemberState.name,
      class_id: upgradeMemberState.class_id || null,
      package_id: newPkg.id,
      package_name: newPkg.name,
      total_amount: newPkg.price,
      paid_amount: actualPaid,
      status: actualPaid >= finalExpected ? 'paid' : (actualPaid > 0 ? 'partial' : 'unpaid'),
      discount_id: null,
      discount_description: discountAmt > 0 ? 'Upgrade Discount' : null,
      discount_amount: discountAmt,
      payment_method: upgradePaymentMethod as any,
      activation_date: activationDateStr,
      ...(upgradePaymentDate ? { created_at: new Date(upgradePaymentDate).toISOString() } : {}),
      ...(upgradeInvoiceId.trim() ? { id: upgradeInvoiceId.trim() } : {})
    }, {
      onSuccess: () => {
        updateMember.mutate({
          id: upgradeMemberState.uuid,
          updates: {
            package_name: newPkg.name,
            package_id: newPkg.id,
            sessions_remaining: newSessions,
            expires_at: newExpiresAt,
            status: 'active'
          }
        }, {
          onSuccess: () => {
            createAuditLog.mutate({
              action: 'Upgrade Package',
              action_type: 'edit_payment',
              performed_by: currentUser?.id ?? null,
              performer_name: currentUser?.name ?? 'System',
              member_id: upgradeMemberState.uuid,
              member_name: upgradeMemberState.name,
              timestamp: new Date().toISOString(),
              details: `Upgraded from ${currentPkg.name} to ${newPkg.name}. Difference paid: ${priceDiff} EGP`,
            });
            toast.success("Package upgraded successfully");
            setUpgradeMemberState(null);
            setUpgradePackageId("");
            setUpgradePaymentMethod("Cash");
            setUpgradeInvoiceId("");
            setUpgradePaymentDate("");
            setUpgradeDiscount("");
            setUpgradePaidAmount("");
            setUpgradePackageCategoryFilter("All");
          }
        });
      },
      onError: (err: any) => toast.error(`Error upgrading: ${err.message}`)
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
        <div className="relative flex-1 flex gap-2">
          <Select value={searchField} onValueChange={setSearchField}>
            <SelectTrigger className="w-[120px]">
              <SelectValue placeholder="Search by..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Any</SelectItem>
              <SelectItem value="id">ID</SelectItem>
              <SelectItem value="name">Name</SelectItem>
              <SelectItem value="phone">Phone</SelectItem>
            </SelectContent>
          </Select>
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              data-testid="input-member-search"
              placeholder={`Search ${searchField === 'all' ? 'by name, ID, or phone' : `by ${searchField}`}...`}
              value={query}
              onChange={e => {
                setQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="pl-9"
            />
          </div>
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

      <div className="flex flex-col sm:flex-row gap-3">
        <Select value={classFilter} onValueChange={setClassFilter}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue placeholder="Filter by class" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Classes</SelectItem>
            {classes.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={packageFilter} onValueChange={setPackageFilter}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue placeholder="Filter by subscription" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Subscriptions</SelectItem>
            {packages.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
          </SelectContent>
        </Select>
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
              {paginatedMembers.map(m => {
                const age = calcAge(m.birth_date);
                return (
                  <TableRow key={m.uuid} data-testid={`member-row-${m.uuid}`}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className={`w-14 h-14 rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden border shadow-sm ${m.id === -1 ? 'bg-teal-100 text-teal-600 border-teal-200' : 'bg-primary/10 text-primary border-primary/20'}`}>
                          {m.photo_url ? (
                            <img src={m.photo_url} alt={m.name} className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-xl font-bold">{m.name.charAt(0)}</span>
                          )}
                        </div>
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-semibold text-foreground text-sm">{m.name}</p>
                            <StatusBadge status={m.status} />
                            {m.frozen_until && new Date(m.frozen_until) > new Date() && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-700">
                                FROZEN
                              </span>
                            )}
                            {(() => {
                              // 1. Try actual joint_invoice_group_id
                              const jGroups = invoices.filter((i: any) => i.member_id === m.uuid && i.joint_invoice_group_id).map((i: any) => i.joint_invoice_group_id);
                              let jIds: any[] = [];
                              if (jGroups.length > 0) {
                                const jInvs = invoices.filter((i: any) => jGroups.includes(i.joint_invoice_group_id) && i.member_id !== m.uuid);
                                jIds = Array.from(new Set(jInvs.map((i: any) => members.find((mem: any) => mem.uuid === i.member_id)?.id))).filter(Boolean);
                              }

                              // 2. Try parsing discount_description (e.g. "10% joint 3354, 3355")
                              if (jIds.length === 0) {
                                const myInvs = invoices.filter((i: any) => i.member_id === m.uuid && i.discount_description);
                                for (const inv of myInvs) {
                                  const match = inv.discount_description?.match(/(?:joint|join)\s*(?:with)?\s*[:#-]?\s*([\d,\s&]+)/i);
                                  if (match && match[1]) {
                                    const extractedIds = match[1].replace(/&/g, ',').split(',').map((s: string) => s.trim()).filter((s: string) => s && !isNaN(Number(s)));
                                    jIds.push(...extractedIds);
                                  }
                                }
                                jIds = Array.from(new Set(jIds));
                              }

                              if (jIds.length === 0) return null;
                              return (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-700">
                                  Joint: {jIds.join(', ')}
                                </span>
                              );
                            })()}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {m.id === -1 ? (
                              <span className="text-teal-600 font-medium">Clinic Visitor</span>
                            ) : (
                              <>{`#${m.id ?? '?'}`}</>
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
                            <span className="font-semibold text-primary">{m.class_info.name ?? 'No Sport'}</span>
                            <span className="text-muted-foreground mx-1">-</span>
                            <span>{m.class_info.coach_name ?? 'No Coach'}</span>
                            <div className="text-xs text-muted-foreground mt-1">
                              {m.class_info.schedules?.map(s => `${s?.day?.slice(0, 3)} ${s?.time}`).join(', ')}
                            </div>
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-sm">-</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        {(() => {
                          const activeInvoices = invoices.filter(i =>
                            i.member_id === m.uuid &&
                            (i.status === 'paid' || i.status === 'partial') &&
                            (i.sessions_remaining === undefined || i.sessions_remaining === null || i.sessions_remaining > 0)
                          );

                          if (activeInvoices.length > 0) {
                            return activeInvoices.map(inv => (
                              <div key={inv.uuid} className="text-sm font-medium text-blue-700 bg-blue-50 px-2 py-1 rounded w-max mb-1">
                                {inv.package_name || inv.class_id} {inv.sessions_remaining === 999 ? '(∞ left)' : inv.sessions_remaining !== null ? `(${inv.sessions_remaining} left)` : ''}
                              </div>
                            ));
                          }

                          if (m.package_name && m.package_name !== 'None') {
                            return (
                              <div className="text-sm font-medium text-gray-500 bg-gray-50 px-2 py-1 rounded w-max mb-1 flex items-center gap-1">
                                {m.package_name} <span className="text-xs font-normal">(Expired/Empty)</span>
                              </div>
                            );
                          }

                          return <p className="text-sm font-medium text-muted-foreground">None</p>;
                        })()}

                        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                          Last Subscription: {m.last_subscription_date ? format(new Date(m.last_subscription_date), "dd/MM/yyyy") : 'Never'}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          Expires: {m.expires_at ? format(new Date(m.expires_at), "dd/MM/yyyy") : 'N/A'}
                        </div>
                        {m.pending_subscription_date && (
                          <div className="flex items-center gap-2 text-xs text-amber-600 font-medium">
                            Pending Activation: {format(new Date(m.pending_subscription_date), "dd/MM/yyyy")}
                          </div>
                        )}
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
                        {m.invitations_remaining > 0 ?
                          (<button
                            data-testid={`btn-invite-member-${m.uuid}`}
                            onClick={() => handleDecrement(m, 'invitations_remaining')}
                            className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                            title="Invite"
                          >
                            <Mail className="w-4 h-4" />
                          </button>) : ("")
                        }
                        {m.inbody_sessions_remaining > 0 ?
                          (<button
                            data-testid={`btn-inbody-member-${m.uuid}`}
                            onClick={() => handleDecrement(m, 'inbody_sessions_remaining')}
                            className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                            title="InBody"
                          >
                            <BicepsFlexed className="w-4 h-4" />
                          </button>) : ("")
                        }
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
                        ) : m.freeze_days_remaining > 0 ? (
                          <button
                            data-testid={`btn-freeze-member-${m.uuid}`}
                            onClick={() => { setFreezeMemberState(m); setFreezeDaysInput(""); }}
                            className="p-1.5 rounded-md hover:bg-blue-50 transition-colors text-muted-foreground hover:text-blue-600"
                            title="Freeze"
                          >
                            <Snowflake className="w-4 h-4" />
                          </button>
                        ) : ("")}
                        {m.last_subscription_date && new Date(m.last_subscription_date).getTime() > Date.now() - 7 * 86400000 && (
                          <button
                            data-testid={`btn-upgrade-member-${m.uuid}`}
                            onClick={() => setUpgradeMemberState(m)}
                            className="p-1.5 rounded-md hover:bg-emerald-50 transition-colors text-muted-foreground hover:text-emerald-600"
                            title="Upgrade Package"
                          >
                            <ArrowUpCircle className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          data-testid={`btn-history-member-${m.uuid}`}
                          onClick={() => setHistoryMember(m)}
                          className="p-1.5 rounded-md hover:bg-indigo-50 transition-colors text-muted-foreground hover:text-indigo-600"
                          title="Session History"
                        >
                          <Clock className="w-4 h-4" />
                        </button>
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

          <div className="flex items-center justify-between p-4 border-t">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Rows per page:</span>
              <Select value={pageSize.toString()} onValueChange={v => { setPageSize(Number(v)); setCurrentPage(1); }}>
                <SelectTrigger className="w-[70px] h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="25">25</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-4">
              <span className="text-sm text-muted-foreground">
                Page {currentPage} of {totalPages} (Total: {filtered.length})
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages || totalPages === 0}
                >
                  Next
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Member Dialog */}
      <Dialog open={showAdd || !!editMember} onOpenChange={o => !o && closeDialogs()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editMember ? `Edit: ${editMember.name}` : "New Member"}</DialogTitle>
          </DialogHeader>
          <Tabs defaultValue="details" className="w-full">
            {editMember && (
              <TabsList className="grid w-full grid-cols-2 mb-4">
                <TabsTrigger value="details">Details</TabsTrigger>
                <TabsTrigger value="history">History</TabsTrigger>
              </TabsList>
            )}
            <TabsContent value="details">
              <div className="space-y-4 py-2 max-h-[70vh] overflow-y-auto pr-1">
                {/* Photo Capture Section */}
                <div className="flex flex-col items-center gap-3 pb-4 border-b">
                  {isCapturing ? (
                    <div className="w-full">
                      <CameraCapture
                        onCapture={(blob, url) => {
                          setPhotoBlob(blob);
                          setPhotoDataUrl(url);
                          setIsCapturing(false);
                        }}
                        onCancel={() => setIsCapturing(false)}
                      />
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center gap-4 w-full">
                      <div className="relative">
                        {photoDataUrl ? (
                          <img src={photoDataUrl} alt="Preview" className="w-[200px] h-[200px] rounded-lg object-cover border shadow-sm" />
                        ) : (
                          <div className="w-[200px] h-[200px] rounded-lg bg-muted flex items-center justify-center border shadow-sm">
                            <Camera className="w-12 h-12 text-muted-foreground opacity-50" />
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Button type="button" variant="outline" size="sm" onClick={() => setIsCapturing(true)}>
                          <Camera className="w-4 h-4 mr-2" />
                          {photoDataUrl ? "Retake Photo" : "Take Photo"}
                        </Button>
                        {photoDataUrl && (
                          <Button type="button" variant="ghost" size="sm" className="text-destructive" onClick={() => {
                            setPhotoBlob(null);
                            setPhotoDataUrl(null);
                            if (editMember && editMember.photo_url) {
                              setForm(f => ({ ...f, removePhoto: true } as any));
                            }
                          }}>
                            Remove
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                </div>

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

                {/* Custom ID (Optional) */}
                {!form.isClinicVisitor && (
                  <div className="space-y-1.5">
                    <Label htmlFor="m-custom-id">Member ID</Label>
                    <Input
                      id="m-custom-id"
                      placeholder="Leave empty for auto-generation"
                      type="number"
                      value={form.customId}
                      onChange={f('customId')}
                    />
                  </div>
                )}

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
                            {c.name ?? 'Class Name'} - {c.coach_name ?? 'Coach'} ({c.schedules?.length || 0} slots)
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

                {editMember && (
                  <div className="pt-4 mt-4 border-t space-y-4">
                    <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Status</h4>
                    <div className="space-y-1.5">
                      <Select value={form.status} onValueChange={(val) => setForm({ ...form, status: val })}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="inactive">Inactive</SelectItem>
                          <SelectItem value="frozen">Frozen</SelectItem>
                        </SelectContent>
                      </Select>
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

              </div>
              <DialogFooter className="mt-6">
                <Button variant="outline" onClick={closeDialogs}>Cancel</Button>
                <Button
                  data-testid="btn-save-member"
                  onClick={handleSave}
                  disabled={createMember.isPending || updateMember.isPending}
                >
                  {createMember.isPending || updateMember.isPending ? "Saving..." : editMember ? "Save Changes" : "Create Member"}
                </Button>
              </DialogFooter>
            </TabsContent>

            {editMember && (
              <TabsContent value="history">
                <div className="space-y-4 py-2 max-h-[70vh] overflow-y-auto pr-1">
                  {(() => {
                    const history = auditLogs.filter(l =>
                      (l.action_type === 'checkin' || l.action_type === 'override_checkin') &&
                      l.details.includes(editMember.id.toString())
                    ).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

                    if (history.length === 0) {
                      return <p className="text-sm text-muted-foreground text-center py-6">No check-in history found.</p>;
                    }

                    return (
                      <div className="space-y-3">
                        {history.map(log => (
                          <div key={log.id} className="p-3 rounded-lg border bg-muted/30 text-sm">
                            <div className="flex justify-between items-start mb-1">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold">{format(parseISO(log.timestamp), "MMM d, yyyy h:mm a")}</span>
                              </div>
                              <span className="text-xs text-muted-foreground">{log.action_type === 'override_checkin' ? 'Override' : 'Check-in'}</span>
                            </div>
                            <div className="flex justify-between items-end mt-2">
                              <p className="text-muted-foreground text-xs leading-snug">{log.details}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>
              </TabsContent>
            )}
          </Tabs>
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
              disabled={deleteMember.isPending}
            >
              {deleteMember.isPending ? "Deleting..." : "Delete Permanently"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!historyMember} onOpenChange={(o) => !o && setHistoryMember(null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Session History: {historyMember?.name}</DialogTitle>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto pr-2 space-y-2 py-2">
            {checkInHistory.filter(ci => {
              if (!historyMember?.last_subscription_date) return true;
              return new Date(ci.created_at) >= new Date(historyMember.last_subscription_date);
            }).length === 0 ? (
              <p className="text-center text-muted-foreground py-6">No sessions recorded in current subscription.</p>
            ) : checkInHistory.filter(ci => {
              if (!historyMember?.last_subscription_date) return true;
              return new Date(ci.created_at) >= new Date(historyMember.last_subscription_date);
            }).map(ci => {
              return (
                <div key={ci.id} className="flex flex-col p-3 rounded-lg border bg-card">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex flex-col">
                      <p className="font-semibold text-sm">Session</p>
                      {editingLogId === ci.id ? (
                        <div className="flex items-center gap-2 mt-1">
                          <Input 
                            type="datetime-local" 
                            value={editLogTime} 
                            onChange={e => setEditLogTime(e.target.value)} 
                            className="h-8 text-xs max-w-[200px]" 
                          />
                          <Button size="sm" onClick={() => {
                            updateMemberCheckInTime.mutate({ id: ci.id, newTime: new Date(editLogTime).toISOString() });
                            setEditingLogId(null);
                          }}>Save</Button>
                          <Button size="sm" variant="ghost" onClick={() => setEditingLogId(null)}>Cancel</Button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 mt-0.5">
                          <p className="text-xs text-muted-foreground">
                            {format(parseISO(ci.created_at), "MMM d, yyyy h:mm a")}
                          </p>
                          <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-foreground" onClick={() => { 
                            setEditingLogId(ci.id); 
                            setEditLogTime(format(parseISO(ci.created_at), "yyyy-MM-dd'T'HH:mm")); 
                          }}>
                            <Pencil className="h-3 w-3" />
                          </Button>
                        </div>
                      )}
                      {ci.is_override && (
                        <Badge variant="outline" className="text-[10px] mt-1 bg-amber-50 text-amber-600 border-amber-200 w-max">Manual Override</Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex justify-between items-end border-t pt-2">
                    <p className="text-xs text-muted-foreground">Checked in by: <span className="font-medium text-foreground">{ci.checked_in_by_name || 'System'}</span></p>
                    <Button variant="ghost" size="sm" className="h-6 text-destructive text-xs hover:bg-destructive/10" onClick={() => {
                      if(confirm("Are you sure you want to delete this check-in? The session will be refunded to the member.")) {
                        deleteMemberCheckIn.mutate(ci.id);
                      }
                    }}>
                      <Trash2 className="h-3 w-3 mr-1" /> Delete
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>

      {/* Freeze Member Dialog */}
      <Dialog open={!!freezeMemberState} onOpenChange={o => { if (!o) { setFreezeMemberState(null); setFreezeDaysInput(""); } }}>
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
            <Button onClick={handleFreeze} disabled={freezeMember.isPending}>
              {freezeMember.isPending ? "Freezing..." : "Freeze Membership"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Upgrade Member Dialog */}
      <Dialog open={!!upgradeMemberState} onOpenChange={o => { if (!o) { setUpgradeMemberState(null); setUpgradePackageId(""); setUpgradePaymentMethod("Cash"); setUpgradeInvoiceId(""); setUpgradePaymentDate(""); setUpgradeDiscount(""); setUpgradePaidAmount(""); setUpgradePackageCategoryFilter("All"); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Upgrade Package</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="px-3 py-2 rounded-lg bg-muted/50 text-sm space-y-1">
              <div className="flex justify-between"><span className="text-muted-foreground">Member</span><span>{upgradeMemberState?.name}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Current Package</span><span className="font-bold">{upgradeMemberState?.package_name}</span></div>
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label>Select New Package</Label>
                <Tabs value={upgradePackageCategoryFilter} onValueChange={(v: any) => setUpgradePackageCategoryFilter(v)} className="w-[150px]">
                  <TabsList className="grid w-full grid-cols-3 h-7 text-[10px]">
                    <TabsTrigger value="All" className="text-[10px]">All</TabsTrigger>
                    <TabsTrigger value="Normal" className="text-[10px]">Gym</TabsTrigger>
                    <TabsTrigger value="PT" className="text-[10px]">PT</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
              <SearchableSelect
                options={packages.filter(p => p.name !== upgradeMemberState?.package_name && p.category !== 'Clinic' && (upgradePackageCategoryFilter === "All" || p.category === upgradePackageCategoryFilter)).map(p => ({
                  value: p.id.toString(),
                  label: `${p.name} - ${p.price} EGP`,
                  searchTerms: p.category
                }))}
                value={upgradePackageId}
                onValueChange={setUpgradePackageId}
                placeholder="Select package..."
                searchPlaceholder="Search packages..."
              />
            </div>
            {upgradePackageId && upgradeMemberState?.package_name && (
              <>
                <div className="grid grid-cols-2 gap-3 mt-4">
                  <div className="space-y-1.5">
                    <Label>Payment Method</Label>
                    <Select value={upgradePaymentMethod} onValueChange={setUpgradePaymentMethod}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Cash">Cash</SelectItem>
                        <SelectItem value="Visa">Visa</SelectItem>
                        <SelectItem value="InstaPay">InstaPay</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Custom Invoice ID <span className="text-muted-foreground text-xs">(optional)</span></Label>
                    <Input placeholder="e.g. INV-123" value={upgradeInvoiceId} onChange={e => setUpgradeInvoiceId(e.target.value)} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Payment Date</Label>
                    <Input type="date" value={upgradePaymentDate} onChange={e => setUpgradePaymentDate(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Discount <span className="text-muted-foreground text-xs">(optional)</span></Label>
                    <Input type="number" min="0" placeholder="0 EGP" value={upgradeDiscount} onChange={e => setUpgradeDiscount(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Paid Amount (EGP)</Label>
                    <Input type="number" min="0" placeholder={`Full Amount (${Math.max(0, (packages.find(p => p.id.toString() === upgradePackageId)?.price || 0) - (packages.find(p => p.name === upgradeMemberState.package_name)?.price || 0) - Number(upgradeDiscount))} EGP)`} value={upgradePaidAmount} onChange={e => setUpgradePaidAmount(e.target.value)} />
                  </div>
                </div>
                <div className="px-3 py-2 rounded-lg bg-emerald-50 border border-emerald-100 text-sm space-y-1 mt-2">
                  <div className="flex justify-between"><span className="text-muted-foreground">Difference to Pay</span>
                    <span className="font-bold text-emerald-600">
                      {Math.max(0, (packages.find(p => p.id.toString() === upgradePackageId)?.price || 0) - (packages.find(p => p.name === upgradeMemberState.package_name)?.price || 0))} EGP
                    </span>
                  </div>
                  {(Number(upgradeDiscount) > 0) && (
                    <div className="flex justify-between"><span className="text-muted-foreground">After Discount</span>
                      <span className="font-bold text-emerald-600">
                        {Math.max(0, (packages.find(p => p.id.toString() === upgradePackageId)?.price || 0) - (packages.find(p => p.name === upgradeMemberState.package_name)?.price || 0) - Number(upgradeDiscount))} EGP
                      </span>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setUpgradeMemberState(null); setUpgradePackageId(""); setUpgradePaymentMethod("Cash"); setUpgradeInvoiceId(""); setUpgradePaymentDate(""); setUpgradeDiscount(""); setUpgradePaidAmount(""); setUpgradePackageCategoryFilter("All"); }}>Cancel</Button>
            <Button onClick={handleUpgrade} disabled={createInvoice.isPending || updateMember.isPending}>
              {createInvoice.isPending || updateMember.isPending ? "Upgrading..." : "Upgrade Now"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
import { Badge } from "@/components/ui/badge";
