import { useState } from "react";
import { Search, CheckCircle2, AlertTriangle, XCircle, UserCheck, Clock, QrCode, Camera } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle
} from "@/components/ui/alert-dialog";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useMembers, useCheckInMember, usePackages, useCoaches, useCheckInCoachWithDetails, useClasses, useCoachCheckInsToday, useCheckInCoach, useInvoices, useClassScheduleOverrides, useCreateClassScheduleOverride, useDeleteClassScheduleOverride } from "@/hooks/use-data";
import { useAuth } from "@/lib/auth";
import type { Member, SubscriptionPackage, Coach } from "@/lib/types";
import StatusBadge from "@/components/StatusBadge";
import { toast } from "sonner";
import { format } from "date-fns";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Scanner } from '@yudiel/react-qr-scanner';

export default function CheckIn() {
  const { data: members = [] } = useMembers();
  const { data: packages = [] } = usePackages();
  const { data: coaches = [] } = useCoaches();
  const { data: classes = [] } = useClasses();
  const { data: checkIns = [] } = useCoachCheckInsToday();
  const { data: invoices = [] } = useInvoices();
  const checkInMutation = useCheckInMember();
  const coachCheckInMutation = useCheckInCoachWithDetails();
  const checkInCoachStandard = useCheckInCoach();
  const { data: scheduleOverrides = [] } = useClassScheduleOverrides();
  const createOverrideMutation = useCreateClassScheduleOverride();
  const deleteOverrideMutation = useDeleteClassScheduleOverride();
  const [postponeClassId, setPostponeClassId] = useState<string | null>(null);
  const [postponeDate, setPostponeDate] = useState("");
  const [postponeTime, setPostponeTime] = useState("");
  const { currentUser } = useAuth();
  
  const [tab, setTab] = useState("members");
  const [query, setQuery] = useState("");
  const [isScanning, setIsScanning] = useState(false);
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const selectedMember = selectedMemberId ? members.find(m => m.uuid === selectedMemberId) || null : null;
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string>("");
  
  const [ptCoachId, setPtCoachId] = useState<string>("");

  const [successMember, setSuccessMember] = useState<Member | null>(null);
  const [checkedInToday, setCheckedInToday] = useState<string[]>([]);

  const [coachQuery, setCoachQuery] = useState("");
  const [selectedCoach, setSelectedCoach] = useState<Coach | null>(null);
  const [selectedClassId, setSelectedClassId] = useState<string>("none");

  const results = query.length >= 1
    ? members.filter(m =>
        m.name.toLowerCase().includes(query.toLowerCase()) ||
        m.id.toString().includes(query) ||
        m.phone.includes(query)
      ).slice(0, 6)
    : [];

  const handleSuccess = (member: Member, msg: string, desc: string) => {
    if (ptCoachId) {
      coachCheckInMutation.mutate({
        coachId: ptCoachId,
        sessionType: 'pt',
        memberUuid: member.uuid,
        isSubstitute: false,
      }, {
        onSuccess: () => toast.success(`Coach PT session recorded`),
        onError: (err) => toast.error(`Coach check-in failed: ${err.message}`)
      });
    }
    setCheckedInToday(prev => [...prev, member.uuid]);
    setSuccessMember(member);
    setSelectedMemberId(null);
    setPtCoachId("");
    setQuery("");
    toast.success(msg, { description: desc });
  };

  const doCheckIn = (member: Member) => {
    checkInMutation.mutate({
      memberId: member.uuid,
      invoiceId: selectedInvoiceId || undefined,
      isOverride: false,
      payLater: false,
      performedBy: currentUser?.id,
      performerName: currentUser?.name
    }, {
      onSuccess: () => handleSuccess(member, `Checked in: ${member.name}`, `Session deducted`),
      onError: (err) => toast.error(`Check-in failed: ${err.message}`)
    });
  };

  const handleSelect = (member: Member) => {
    setSelectedMemberId(member.uuid);
    setSuccessMember(null);
    const memberActiveInvoices = invoices.filter(i => 
      i.member_id === member.uuid && 
      (i.status === 'paid' || i.status === 'partial') && 
      (i.sessions_remaining === undefined || i.sessions_remaining === null || i.sessions_remaining > 0) &&
      (!member.expires_at || new Date(member.expires_at) >= new Date(new Date().setHours(0,0,0,0)))
    );
    if (memberActiveInvoices.length > 0) {
      setSelectedInvoiceId(memberActiveInvoices[0].uuid);
    } else {
      setSelectedInvoiceId("");
    }
  };

  const selectedInvoice = invoices.find(i => i.uuid === selectedInvoiceId);
  const activePackageId = selectedInvoice ? selectedInvoice.package_id : selectedMember?.package_id;

  const isClinic = selectedMember 
    ? (selectedMember.id === -1 || (packages.find(p => p.id === activePackageId)?.is_clinic || false))
    : false;

  const isPT = selectedMember 
    ? (packages.find(p => p.id === activePackageId)?.is_pt || false)
    : false;

  const handleCheckInClick = () => {
    if (!selectedMember) return;

    if (isPT && !ptCoachId) {
      toast.error("Please select a coach for this PT session.");
      return;
    }

    const isFrozen = selectedMember.frozen_until && new Date(selectedMember.frozen_until) > new Date();
    
    // 1. If frozen, we allow override check-in
    // 2. If sessions are 0, -1, or -2, we allow override check-in (up to -3 max)
    // 3. But NO overrides if the current package is a Clinic package
    // 4. Hard lock for partial payments older than 14 days

    if (selectedMember.status === 'has_debt' && selectedMember.last_subscription_date) {
      const daysSinceInvoice = (Date.now() - new Date(selectedMember.last_subscription_date).getTime()) / (1000 * 3600 * 24);
      if (daysSinceInvoice > 14) {
        toast.error("Cannot check in: Partial payment is overdue (>14 days). Please settle the debt first.");
        return;
      }
    }

    if (isFrozen) {
      if (isClinic) {
        toast.error("Cannot override check-in for clinic packages.");
        return;
      }
      checkInMutation.mutate({
        memberId: selectedMember.uuid,
        invoiceId: selectedInvoiceId || undefined,
        isOverride: true,
        payLater: false,
        performedBy: currentUser?.id,
        performerName: currentUser?.name
      }, {
        onSuccess: () => handleSuccess(selectedMember, `Check-in Override Successful`, `Freeze cancelled and checked in.`),
        onError: (err) => toast.error(`Check-in override failed: ${err.message}`)
      });
      return;
    }

    const needsOverride = selectedMember.status === 'expired' || (selectedMember.sessions_remaining <= 0 && selectedMember.sessions_remaining > -3 && selectedMember.sessions_remaining !== 999);
    
    if (needsOverride) {
      if (isClinic) {
        toast.error("Cannot override check-in for clinic packages.");
        return;
      }
      checkInMutation.mutate({
        memberId: selectedMember.uuid,
        invoiceId: selectedInvoiceId || undefined,
        isOverride: true,
        payLater: false,
        performedBy: currentUser?.id,
        performerName: currentUser?.name
      }, {
        onSuccess: () => handleSuccess(selectedMember, `Check-in Override Successful`, `Session debt increased or expired member checked in.`),
        onError: (err) => toast.error(`Check-in override failed: ${err.message}`)
      });
      return;
    }

    const cantCheckIn = selectedMember.sessions_remaining <= -3 && selectedMember.sessions_remaining !== 999;
    if (cantCheckIn) {
      toast.error("Cannot check in: Reached max session debt (-3).");
      return;
    }
    
    if (isClinic && selectedMember.sessions_remaining <= 0) {
      toast.error("Cannot check in: No sessions remaining for clinic package.");
      return;
    }

    doCheckIn(selectedMember);
  };

  const todayName = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][new Date().getDay()];
  const todayDateString = format(new Date(), 'yyyy-MM-dd');

  function formatTo12Hour(time24: string) {
    if (!time24) return '';
    const [h, m] = time24.split(':');
    let hours = parseInt(h, 10);
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    return `${hours}:${m} ${ampm}`;
  }

  const todaysClasses = classes.map(cls => {
    const regularSchedule = (cls.schedules || []).find(s => s.day === todayName);
    const overrideToday = scheduleOverrides.find(o => o.class_id === cls.id && o.original_date === todayDateString);
    const postponedToToday = scheduleOverrides.find(o => o.class_id === cls.id && o.status === 'postponed' && o.new_date === todayDateString);

    let isScheduledToday = !!regularSchedule;
    let displayTime = regularSchedule?.time;
    let status = 'pending';

    if (overrideToday) {
       status = overrideToday.status;
       if (status === 'postponed' || status === 'cancelled') {
         isScheduledToday = false;
       }
    }
    if (postponedToToday) {
       isScheduledToday = true;
       displayTime = postponedToToday.new_time || displayTime;
       status = 'pending';
    }

    return {
       ...cls,
       isScheduledToday,
       displayTime,
       statusOverride: overrideToday?.status || (postponedToToday ? 'postponed_to_today' : null),
       overrideId: overrideToday?.id || postponedToToday?.id
    };
  }).filter(c => c.isScheduledToday || c.statusOverride === 'cancelled').sort((a,b) => (a.displayTime || '').localeCompare(b.displayTime || ''));
  
  const handleCancelSession = (classId: string) => {
    createOverrideMutation.mutate({ class_id: classId, original_date: todayDateString, status: 'cancelled' }, {
      onSuccess: () => toast.success("Session cancelled for today")
    });
  };
  
  const handlePostponeSession = () => {
    if (!postponeClassId || !postponeDate || !postponeTime) return;
    createOverrideMutation.mutate({ class_id: postponeClassId, original_date: todayDateString, status: 'postponed', new_date: postponeDate, new_time: postponeTime }, {
      onSuccess: () => {
        toast.success("Session postponed successfully");
        setPostponeClassId(null);
      }
    });
  };

  const submitTodayClassCheckIn = (classId: string, coachId: string, originalCoachId: string) => {
    coachCheckInMutation.mutate({
      coachId,
      classId,
      isSubstitute: coachId !== originalCoachId,
      originalCoachId: coachId !== originalCoachId ? originalCoachId : undefined,
      sessionType: 'group'
    }, {
      onSuccess: () => toast.success("Coach checked in successfully"),
      onError: (err) => toast.error(`Failed: ${err.message}`)
    });
  };

  const recentlyCheckedIn = members.filter(m => checkedInToday.includes(m.uuid));

  const doCoachCheckIn = () => {
    if (!selectedCoach) return;
    if (selectedClassId === "none") {
      toast.error("Please select a specific class to check into.");
      return;
    }
    const classData = classes.find(c => c.id === selectedClassId);
    if (!classData) return;
    const todayName = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][new Date().getDay()];
    const scheduledSlotsForToday = classData.schedules.filter(s => s.day === todayName).length;
    if (scheduledSlotsForToday === 0) {
      toast.error(`This class is not scheduled for today (${todayName}).`);
      return;
    }
    const checkInsForThisClassToday = checkIns.filter(ci => ci.coach_id === selectedCoach.id && ci.class_id === selectedClassId).length;
    if (checkInsForThisClassToday >= scheduledSlotsForToday) {
      toast.error(`Coach has already checked in ${checkInsForThisClassToday} time(s) for this class today.`);
      return;
    }
    checkInCoachStandard.mutate({ coachId: selectedCoach.id, classId: selectedClassId }, {
      onSuccess: () => { toast.success(`${selectedCoach.name} checked in`); setSelectedCoach(null); },
      onError: (err) => toast.error(`Failed to check in: ${err.message}`)
    });
  };

  const coachResults = coachQuery.length >= 1
    ? coaches.filter(c => c.name.toLowerCase().includes(coachQuery.toLowerCase()) || c.phone?.includes(coachQuery)).slice(0, 6)
    : [];

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Check-In</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Manage daily attendance</p>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="members">Members</TabsTrigger>
          <TabsTrigger value="coaches">Coaches</TabsTrigger>
        </TabsList>

        <TabsContent value="members" className="space-y-6 mt-6">
          {/* Search */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input
                data-testid="input-checkin-search"
                type="search"
                placeholder="Search member..."
                value={query}
                onChange={e => { setQuery(e.target.value); setSelectedMemberId(null); setSuccessMember(null); }}
                className="pl-10 h-12 text-base"
                autoFocus
              />
            </div>
            <Button
              variant="outline"
              className="h-12 w-12 px-0 shrink-0"
              onClick={() => setIsScanning(true)}
              title="Scan QR Code"
            >
              <QrCode className="w-5 h-5" />
            </Button>
          </div>

      {/* Search results */}
      {results.length > 0 && !selectedMember && (
        <div className="space-y-2">
          {results.map(m => (
            <button
              key={m.uuid}
              data-testid={`result-member-${m.uuid}`}
              onClick={() => handleSelect(m)}
              className="w-full text-left p-3 rounded-lg border bg-card hover:bg-accent transition-colors flex items-center gap-4"
            >
              <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <span className="text-sm font-bold text-primary">{m.name.charAt(0)}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-foreground">{m.name}</p>
                <p className="text-sm text-muted-foreground">{m.id === -1 ? 'Clinic Visitor' : m.id} · {m.phone}</p>
              </div>
              <StatusBadge status={m.status} />
            </button>
          ))}
        </div>
      )}

      {/* Member card */}
      {selectedMember && (
        <Card className={
          (selectedMember.status === 'expired' || (selectedMember.sessions_remaining <= -3 && selectedMember.sessions_remaining !== 999)) ? "border-red-300 bg-red-50" :
          selectedMember.status === 'expiring_soon' ? "border-amber-300 bg-amber-50" :
          (selectedMember.sessions_remaining <= 0 && selectedMember.sessions_remaining !== 999) ? "border-orange-300 bg-orange-50" :
          "border-emerald-200 bg-emerald-50"
        }>
          <CardHeader className="pb-2">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center flex-shrink-0 shadow-sm">
                <span className="text-lg font-bold text-primary">{selectedMember.name.charAt(0)}</span>
              </div>
              <div className="flex-1">
                <CardTitle className="text-xl flex items-center gap-2">
                  {selectedMember.name}
                  <StatusBadge status={selectedMember.status} />
                  {selectedMember.frozen_until && new Date(selectedMember.frozen_until) > new Date() && (
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-700">
                      FROZEN
                    </span>
                  )}
                </CardTitle>
                <p className="text-sm text-muted-foreground">{selectedMember.id === -1 ? 'Clinic Visitor' : selectedMember.id} · {selectedMember.phone}</p>
              </div>
              <button onClick={() => setSelectedMemberId(null)} className="text-muted-foreground hover:text-foreground">✕</button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="p-2 rounded-lg bg-white/70">
                <p className="text-xl font-bold text-foreground">
                  {selectedMember.sessions_remaining === 999 ? "∞" : selectedMember.sessions_remaining}
                </p>
                <p className="text-xs text-muted-foreground">Sessions Left</p>
              </div>
              <div className="p-2 rounded-lg bg-white/70">
                <p className="text-sm font-bold text-foreground truncate">{selectedMember.package_name}</p>
                <p className="text-xs text-muted-foreground">Package</p>
              </div>
              <div className="p-2 rounded-lg bg-white/70">
                <p className="text-sm font-bold text-foreground">{selectedMember.expires_at ? format(new Date(selectedMember.expires_at), "dd/MM") : "—"}</p>
                <p className="text-xs text-muted-foreground">Expires</p>
              </div>
            </div>

            {selectedMember.status === 'expiring_soon' && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-100 border border-amber-200 text-amber-800 text-sm">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span>This member is expiring soon. Consider renewing their subscription.</span>
              </div>
            )}

            {selectedMember.status === 'expired' && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-red-100 border border-red-200 text-red-800 text-sm">
                <XCircle className="w-4 h-4 flex-shrink-0" />
                <span>Membership expired on {selectedMember.expires_at ? format(new Date(selectedMember.expires_at), "dd/MM/yyyy") : "unknown date"}. Cannot check in.</span>
              </div>
            )}

            {selectedMember.sessions_remaining <= -3 && selectedMember.sessions_remaining !== 999 && selectedMember.status !== 'expired' && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-red-100 border border-red-200 text-red-800 text-sm">
                <XCircle className="w-4 h-4 flex-shrink-0" />
                <span>This member has reached the maximum allowed session debt (-3). Cannot check in.</span>
              </div>
            )}

            {selectedMember.sessions_remaining <= 0 && selectedMember.sessions_remaining > -3 && selectedMember.sessions_remaining !== 999 && selectedMember.status !== 'expired' && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-orange-100 border border-orange-200 text-orange-800 text-sm">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span>This member has {selectedMember.sessions_remaining} sessions. Overriding will incur session debt.</span>
              </div>
            )}
            
            {selectedMember.frozen_until && new Date(selectedMember.frozen_until) > new Date() && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-blue-100 border border-blue-200 text-blue-800 text-sm">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span>This member is frozen until {format(new Date(selectedMember.frozen_until), "dd/MM/yyyy")}. Overriding will cancel the freeze.</span>
              </div>
            )}

            {selectedMember.status === 'has_debt' && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-purple-100 border border-purple-200 text-purple-800 text-sm">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span>Member has outstanding payment. Proceed with check-in?</span>
              </div>
            )}

            {isPT && (
              <div className="p-3 rounded-lg bg-indigo-50 border border-indigo-100 space-y-2">
                <Label className="text-indigo-900 font-semibold">Trained by Coach (PT Session) *</Label>
                <Select value={ptCoachId} onValueChange={setPtCoachId}>
                  <SelectTrigger className="bg-white"><SelectValue placeholder="Select Coach..." /></SelectTrigger>
                  <SelectContent>
                    {coaches.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {(() => {
              const activeInvoices = invoices.filter(i => 
                i.member_id === selectedMember.uuid && 
                (i.status === 'paid' || i.status === 'partial') && 
                (i.sessions_remaining === undefined || i.sessions_remaining === null || i.sessions_remaining > 0) &&
                (!selectedMember.expires_at || new Date(selectedMember.expires_at) >= new Date(new Date().setHours(0,0,0,0)))
              );
              
              if (activeInvoices.length > 1) {
                return (
                  <div className="p-3 rounded-lg bg-blue-50 border border-blue-100 space-y-2">
                    <Label className="text-blue-900 font-semibold">Select Subscription</Label>
                    <Select value={selectedInvoiceId} onValueChange={setSelectedInvoiceId}>
                      <SelectTrigger className="bg-white"><SelectValue placeholder="Select Subscription..." /></SelectTrigger>
                      <SelectContent>
                        {activeInvoices.map(inv => (
                          <SelectItem key={inv.uuid} value={inv.uuid}>
                            {inv.package_name} {inv.sessions_remaining === 999 ? '(∞ sessions left)' : inv.sessions_remaining !== null ? `(${inv.sessions_remaining} sessions left)` : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                );
              }
              return null;
            })()}

            <div className="flex gap-2">
              {!(selectedMember.sessions_remaining <= -3 && selectedMember.sessions_remaining !== 999) && !(isClinic && selectedMember.sessions_remaining <= 0) && (
                <Button
                  data-testid="btn-checkin-confirm"
                  onClick={handleCheckInClick}
                  disabled={checkInMutation.isPending}
                  className={`flex-1 h-11 text-base font-semibold gap-2 ${(selectedMember.frozen_until && new Date(selectedMember.frozen_until) > new Date()) || selectedMember.status === 'expired' || (selectedMember.sessions_remaining <= 0 && selectedMember.sessions_remaining !== 999) ? 'bg-orange-500 hover:bg-orange-600 text-white' : ''}`}
                >
                  <CheckCircle2 className="w-5 h-5" />
                  {checkInMutation.isPending
                    ? 'Checking In...'
                    : checkedInToday.includes(selectedMember.uuid) 
                      ? 'Check In Again' 
                      : (selectedMember.frozen_until && new Date(selectedMember.frozen_until) > new Date()) 
                          ? 'Override & Unfreeze' 
                          : (selectedMember.status === 'expired' || (selectedMember.sessions_remaining <= 0 && selectedMember.sessions_remaining !== 999))
                              ? 'Override Check In'
                              : 'Check In'}
                </Button>
              )}
              <Button data-testid="btn-checkin-cancel" variant="outline" onClick={() => setSelectedMemberId(null)} className={(!(selectedMember.sessions_remaining <= -3 && selectedMember.sessions_remaining !== 999) && !(isClinic && selectedMember.sessions_remaining <= 0)) ? "" : "flex-1"}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Success state */}
      {successMember && (
        <Card className="border-emerald-200 bg-emerald-50">
          <CardContent className="p-6 text-center space-y-2">
            <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
            <p className="text-xl font-bold text-emerald-800">{successMember.name}</p>
            <p className="text-sm text-emerald-700">Checked in successfully at {format(new Date(), "hh:mm a")}</p>
            <p className="text-sm text-emerald-700">
              {successMember.sessions_remaining === 999 
                ? "Unlimited sessions" 
                : `${successMember.sessions_remaining - 1} sessions remaining`}
            </p>
          </CardContent>
        </Card>
      )}




        </TabsContent>

        <TabsContent value="coaches" className="space-y-6 mt-6">
          <div className="space-y-3 py-2 max-h-[70vh] overflow-y-auto pr-1">
            {todaysClasses.length === 0 ? (
              <p className="text-center text-muted-foreground py-6">No classes scheduled for today.</p>
            ) : todaysClasses.map(cls => {
              const mainCoach = coaches.find(c => c.id === cls.coach_id);
              const timeSlot = formatTo12Hour((cls as any).displayTime);
              const checkedInForClass = checkIns.filter(ci => ci.class_id === cls.id);
              const alreadyDone = checkedInForClass.length > 0;
              const isCancelled = (cls as any).statusOverride === 'cancelled';

              return (
                <div key={cls.id} className={`rounded-xl border p-4 space-y-3 ${alreadyDone ? 'bg-emerald-50 border-emerald-200' : isCancelled ? 'bg-muted/50 border-muted opacity-80' : 'bg-card'}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-foreground">{cls.name}</p>
                      <p className="text-xs text-muted-foreground">{timeSlot} · {cls.sport_name || 'General'}</p>
                    </div>
                    {alreadyDone ? (
                      <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">
                        ✓ Done - {coaches.find(c => c.id === checkedInForClass[0]?.coach_id)?.name}
                      </Badge>
                    ) : isCancelled ? (
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-muted-foreground border-muted-foreground/30">Cancelled</Badge>
                        <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => {
                          if ((cls as any).overrideId) deleteOverrideMutation.mutate((cls as any).overrideId, { onSuccess: () => toast.success("Cancellation undone") });
                        }}>Undo</Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-amber-600 border-amber-300">Pending</Badge>
                        <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => setPostponeClassId(cls.id)}>Postpone</Button>
                        <Button variant="ghost" size="sm" className="h-6 px-2 text-xs text-red-500 hover:text-red-600 hover:bg-red-50" onClick={() => handleCancelSession(cls.id)}>Cancel</Button>
                      </div>
                    )}
                  </div>

                  {!alreadyDone && !isCancelled && (
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Who taught this session?</p>
                      {/* Main coach first */}
                      {mainCoach && (
                        <button
                          key={mainCoach.id}
                          onClick={() => submitTodayClassCheckIn(cls.id, mainCoach.id, mainCoach.id)}
                          className="w-full flex items-center justify-between p-2.5 rounded-lg border-2 border-primary/20 bg-primary/5 hover:bg-primary/10 transition-colors"
                          disabled={coachCheckInMutation.isPending}
                        >
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center">
                              <span className="text-xs font-bold text-primary">{mainCoach.name.charAt(0)}</span>
                            </div>
                            <span className="text-sm font-medium">{mainCoach.name}</span>
                            <Badge className="text-xs bg-primary/10 text-primary border-primary/20">Main Coach</Badge>
                          </div>
                          <span className="text-xs text-primary font-medium">✓ Check In</span>
                        </button>
                      )}
                      {/* Other coaches as substitutes */}
                      {coaches.filter(c => c.id !== cls.coach_id).map(sub => (
                        <button
                          key={sub.id}
                          onClick={() => submitTodayClassCheckIn(cls.id, sub.id, cls.coach_id || sub.id)}
                          className="w-full flex items-center justify-between p-2.5 rounded-lg border border-input bg-card hover:bg-accent transition-colors"
                          disabled={coachCheckInMutation.isPending}
                        >
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center">
                              <span className="text-xs font-bold text-muted-foreground">{sub.name.charAt(0)}</span>
                            </div>
                            <span className="text-sm">{sub.name}</span>
                            <span className="text-xs text-muted-foreground">(Substitute)</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </TabsContent>

        {/* Postpone Dialog */}
        <Dialog open={!!postponeClassId} onOpenChange={(o) => !o && setPostponeClassId(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Postpone Session</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>New Date</Label>
                <Input type="date" value={postponeDate} onChange={e => setPostponeDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>New Time</Label>
                <Input type="time" value={postponeTime} onChange={e => setPostponeTime(e.target.value)} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setPostponeClassId(null)}>Cancel</Button>
              <Button onClick={handlePostponeSession} disabled={!postponeDate || !postponeTime || createOverrideMutation.isPending}>
                {createOverrideMutation.isPending ? "Saving..." : "Confirm Postpone"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </Tabs>

      {/* QR Scanner Dialog */}
      <Dialog open={isScanning} onOpenChange={setIsScanning}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Scan QR Code</DialogTitle>
          </DialogHeader>
          <div className="aspect-square rounded-lg overflow-hidden bg-black flex items-center justify-center">
            {isScanning && (
              <Scanner
                onScan={(result) => {
                  if (result && result.length > 0) {
                    const scannedUuid = result[0].rawValue;
                    const member = members.find(m => m.uuid === scannedUuid);
                    if (member) {
                      handleSelect(member);
                      setIsScanning(false);
                      toast.success(`Found ${member.name}`);
                    } else {
                      toast.error("Invalid QR code or member not found");
                    }
                  }
                }}
              />
            )}
          </div>
          <DialogFooter className="sm:justify-center">
            <Button variant="secondary" onClick={() => setIsScanning(false)}>Cancel</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
