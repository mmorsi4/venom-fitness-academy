import { useState, useEffect, useRef } from "react";
import { useLocation, useSearch } from "wouter";
import { Plus, Search, Phone, Calendar, Pencil, Trash2, Snowflake, Unlock, ArrowUpCircle, BicepsFlexed, Mail, Clock, Camera, QrCode } from "lucide-react";
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
import { validateEgyptPhone } from "@/lib/utils";
import { SearchableSelect } from "@/components/SearchableSelect";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useMembers, useCoaches, useClasses, useCreateMember, useUpdateMember, useDeleteMember, useCreateAuditLog, useFreezeMember, useUnfreezeMember, usePackages, useCreateInvoice, useAuditLogs, useInvoices, useUpdateInvoice, useMemberCheckIns, useDeleteMemberCheckIn, useUpdateMemberCheckIn, useUpdateLead } from "@/hooks/use-data";
import { uploadMemberPhoto } from "@/lib/queries";
import { CameraCapture } from "@/components/CameraCapture";
import { processImageFile } from "@/lib/imageUtils";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import type { Member, Gender } from "@/lib/types";
import StatusBadge from "@/components/StatusBadge";
import { toast } from "sonner";
import { format, differenceInYears, parseISO } from "date-fns";
import QRCode from "react-qr-code";
import { MemberFilters } from "@/components/features/members/MemberFilters";
import { MemberList } from "@/components/features/members/MemberList";

const GENDERS: { value: Gender; label: string }[] = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
];

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
  const updateLead = useUpdateLead();
  const { currentUser } = useAuth();
  const [, navigate] = useLocation();
  const searchString = useSearch();
  const hasConsumedParams = useRef(false);

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
  const [qrMember, setQrMember] = useState<Member | null>(null);
  const [registrationLinkQr, setRegistrationLinkQr] = useState<string | null>(null);

  useEffect(() => {
    if (hasConsumedParams.current) return;
    const params = new URLSearchParams(searchString);
    const createLeadId = params.get("createLeadId");
    const leadName = params.get("leadName");
    const leadPhone = params.get("leadPhone");

    if (createLeadId && !showAdd) {
      setShowAdd(true);
      setForm(prev => ({
        ...prev,
        name: leadName || "",
        phone: leadPhone || ""
      }));
      hasConsumedParams.current = true;
    }
  }, [searchString, showAdd]);

  const generateSelfRegistrationLink = async () => {
    try {
      const id = crypto.randomUUID();
      const url = `${window.location.origin}/register/${id}`;
      setRegistrationLinkQr(url);
    } catch (err: any) {
      toast.error(`Error generating link: ${err.message}`);
    }
  };


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
  }).sort((a, b) => {
    const isNumeric = /^\d+$/.test(query.trim());
    if (isNumeric) {
      if (a.id.toString() === query.trim() && b.id.toString() !== query.trim()) return -1;
      if (b.id.toString() === query.trim() && a.id.toString() !== query.trim()) return 1;
    }
    return 0;
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
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={generateSelfRegistrationLink} 
            className="gap-2"
            title="Generate One-Time Link"
          >
            <QrCode className="w-4 h-4" /> Self-Registration QR
          </Button>
          <Button data-testid="btn-add-member" onClick={openAdd} className="gap-2">
            <Plus className="w-4 h-4" /> New Member
          </Button>
        </div>
      </div>

      <MemberFilters 
        searchField={searchField} setSearchField={setSearchField}
        query={query} setQuery={setQuery} setCurrentPage={setCurrentPage}
        statusFilter={statusFilter} setStatusFilter={setStatusFilter}
        counts={counts}
        classFilter={classFilter} setClassFilter={setClassFilter} classes={classes}
        packageFilter={packageFilter} setPackageFilter={setPackageFilter} packages={packages}
      />

      <MemberList 
        paginatedMembers={paginatedMembers} invoices={invoices} members={members}
        filteredLength={filtered.length} pageSize={pageSize} setPageSize={setPageSize}
        currentPage={currentPage} setCurrentPage={setCurrentPage} totalPages={totalPages}
        unfreezeIsPending={unfreezeMember.isPending} setQrMember={setQrMember}
        handleDecrement={handleDecrement} handleUnfreeze={handleUnfreeze}
        setFreezeMemberState={setFreezeMemberState} setFreezeDaysInput={setFreezeDaysInput}
        setUpgradeMemberState={setUpgradeMemberState} setHistoryMember={setHistoryMember}
        openEdit={openEdit} setConfirmDelete={setConfirmDelete}
      />

      <MemberFormDialog
        showAdd={showAdd}
        editMember={editMember}
        form={form}
        setForm={setForm}
        closeDialogs={closeDialogs}
        invoices={invoices || []}
        classes={classes || []}
        currentUser={currentUser}
        searchString={searchString}
        auditLogs={auditLogs || []}
        isCapturing={isCapturing}
        setIsCapturing={setIsCapturing}
        photoBlob={photoBlob}
        setPhotoBlob={setPhotoBlob}
        photoDataUrl={photoDataUrl}
        setPhotoDataUrl={setPhotoDataUrl}
      />
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

      {/* QR Code Dialog */}
      <Dialog open={!!qrMember} onOpenChange={(open) => !open && setQrMember(null)}>
        <DialogContent className="sm:max-w-md text-center">
          <DialogHeader>
            <DialogTitle>QR Code</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center justify-center p-6 space-y-4">
            {qrMember && (
              <div className="bg-white p-4 rounded-xl shadow-sm">
                <QRCode value={qrMember.uuid} size={256} />
              </div>
            )}
            <p className="text-sm font-medium">{qrMember?.name}</p>
            <p className="text-xs text-muted-foreground">Scan this code to check in.</p>
          </div>
          <DialogFooter className="sm:justify-center">
            <Button variant="secondary" onClick={() => setQrMember(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Registration Link QR Dialog */}
      <Dialog open={!!registrationLinkQr} onOpenChange={(open) => !open && setRegistrationLinkQr(null)}>
        <DialogContent className="sm:max-w-md text-center">
          <DialogHeader>
            <DialogTitle>Self-Registration QR</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center justify-center p-6 space-y-4">
            {registrationLinkQr && (
              <div className="bg-white p-4 rounded-xl shadow-sm">
                <QRCode value={registrationLinkQr} size={256} />
              </div>
            )}
            <p className="text-sm font-medium">One-Time Registration Link</p>
            <p className="text-xs text-muted-foreground">Scan this to register a new member. The link closes automatically upon completion.</p>
          </div>
          <DialogFooter className="sm:justify-center">
            <Button variant="secondary" onClick={() => setRegistrationLinkQr(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
import { Badge } from "@/components/ui/badge";
import { MemberFormDialog, memberToForm, emptyForm, type MemberForm } from "@/components/features/members/MemberFormDialog";

