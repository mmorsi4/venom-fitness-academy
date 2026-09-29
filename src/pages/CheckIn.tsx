import { useState, useMemo } from "react";
import { Search, CheckCircle2, AlertTriangle, XCircle, UserCheck, Clock, Calendar, Dumbbell, Trophy, CreditCard } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle
} from "@/components/ui/alert-dialog";
import { useMembers, useCheckInMember, useInvoices } from "@/hooks/use-data";
import { useAuth } from "@/lib/auth";
import type { Member } from "@/lib/types";
import StatusBadge from "@/components/StatusBadge";
import { toast } from "sonner";
import { format } from "date-fns";

export default function CheckIn() {
  const { data: members = [] } = useMembers();
  const { data: invoices = [] } = useInvoices();
  const checkInMutation = useCheckInMember();
  const { currentUser } = useAuth();
  
  const [query, setQuery] = useState("");
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [overrideDialog, setOverrideDialog] = useState(false);
  const [successMember, setSuccessMember] = useState<Member | null>(null);
  const [checkedInToday, setCheckedInToday] = useState<string[]>([]);

  // Calculate outstanding debt per member
  const memberDebts = useMemo(() => {
    const map = new Map<string, { totalDebt: number; unpaidInvoices: typeof invoices }>();
    for (const inv of invoices) {
      if (inv.status !== 'paid') {
        const remaining = Math.max(0, (Number(inv.total_amount) || 0) - (Number(inv.paid_amount) || 0));
        if (remaining > 0) {
          const addDebt = (key: string) => {
            if (!key) return;
            const current = map.get(key) || { totalDebt: 0, unpaidInvoices: [] };
            current.totalDebt += remaining;
            current.unpaidInvoices.push(inv);
            map.set(key, current);
          };
          if (inv.member_id) addDebt(String(inv.member_id));
          if (inv.member_name) addDebt(inv.member_name.toLowerCase().trim());
        }
      }
    }
    return map;
  }, [invoices]);

  const getMemberDebtInfo = (m: Member) => {
    return (
      memberDebts.get(m.uuid) ||
      memberDebts.get(String(m.id)) ||
      memberDebts.get(m.name.toLowerCase().trim()) ||
      { totalDebt: 0, unpaidInvoices: [] }
    );
  };

  const results = query.length >= 1
    ? members.filter(m =>
        m.name.toLowerCase().includes(query.toLowerCase()) ||
        m.id.toString().includes(query) ||
        m.phone.includes(query)
      ).slice(0, 6)
    : [];

  const doCheckIn = (member: Member, override = false, payLater = false) => {
    checkInMutation.mutate({
      memberId: member.uuid,
      isOverride: override,
      payLater: payLater,
      performedBy: currentUser?.id,
      performerName: currentUser?.name
    }, {
      onSuccess: () => {
        setCheckedInToday(prev => [...prev, member.uuid]);
        setSuccessMember(member);
        setSelectedMember(null);
        setQuery("");
        setOverrideDialog(false);
        const msg = override
          ? `Override check-in: ${member.name}${payLater ? " (Pay Later)" : ""}`
          : `Checked in: ${member.name}`;
        toast.success(msg, { description: override ? "Action logged in audit trail" : `Session deducted` });
      },
      onError: (err) => {
        toast.error(`Check-in failed: ${err.message}`);
      }
    });
  };

  const handleSelect = (member: Member) => {
    setSelectedMember(member);
    setSuccessMember(null);
  };

  const isMemberExpired = (m: Member) => {
    // If they have sessions remaining and expiry date is in future, NOT expired
    if (m.sessions_remaining > 0 && m.expires_at && new Date(m.expires_at) >= new Date()) {
      return false;
    }
    // If unlimited sessions and expiry is in future, NOT expired
    if (m.sessions_remaining === 999 && (!m.expires_at || new Date(m.expires_at) >= new Date())) {
      return false;
    }
    // Expired if status is expired OR no sessions left OR expires_at is in past
    return m.status === 'expired' || 
      (m.sessions_remaining <= 0 && m.sessions_remaining !== 999) || 
      (m.expires_at ? new Date(m.expires_at) < new Date() : false);
  };

  const handleCheckInClick = () => {
    if (!selectedMember) return;
    const needsOverride = isMemberExpired(selectedMember);
    if (needsOverride) {
      setOverrideDialog(true);
    } else {
      doCheckIn(selectedMember);
    }
  };

  const selectedMemberDebt = selectedMember ? memberDebts.get(selectedMember.uuid) : null;
  const selectedMemberInvoices = selectedMember ? invoices.filter(i => i.member_id === selectedMember.uuid) : [];
  const recentlyCheckedIn = members.filter(m => checkedInToday.includes(m.uuid));

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Member Check-In</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Search by name, member ID, or phone number</p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
        <Input
          data-testid="input-checkin-search"
          type="search"
          placeholder="Search member..."
          value={query}
          onChange={e => { setQuery(e.target.value); setSelectedMember(null); setSuccessMember(null); }}
          className="pl-10 h-12 text-base"
          autoFocus
        />
      </div>

      {/* Search results */}
      {results.length > 0 && !selectedMember && (
        <div className="space-y-2">
          {results.map(m => {
            const debt = getMemberDebtInfo(m);
            return (
              <button
                key={m.uuid}
                data-testid={`result-member-${m.uuid}`}
                onClick={() => handleSelect(m)}
                className="w-full text-left p-3 rounded-lg border bg-card hover:bg-accent transition-colors flex items-center gap-4"
              >
                <div className="w-9 h-9 rounded-full overflow-hidden bg-primary/10 flex items-center justify-center flex-shrink-0">
                  {m.photo_url ? (
                    <img src={m.photo_url} alt={m.name} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-sm font-bold text-primary">{m.name.charAt(0)}</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-foreground">{m.name}</p>
                  <p className="text-sm text-muted-foreground">#{m.id} · {m.phone}</p>
                </div>
                <div className="flex items-center gap-2">
                  {debt && debt.totalDebt > 0 && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700 border border-red-200">
                      Due: {debt.totalDebt.toLocaleString()} EGP
                    </span>
                  )}
                  <StatusBadge status={m.status} />
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Member card */}
      {selectedMember && (() => {
        const expired = isMemberExpired(selectedMember);
        const selectedMemberDebt = getMemberDebtInfo(selectedMember);
        return (
          <Card className={
            expired ? "border-red-300 bg-red-50/50 shadow-sm" :
            selectedMember.status === 'expiring_soon' ? "border-amber-300 bg-amber-50/50 shadow-sm" :
            "border-emerald-200 bg-emerald-50/50 shadow-sm"
          }>
            <CardHeader className="pb-3 border-b border-border/40">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-full overflow-hidden bg-white flex items-center justify-center flex-shrink-0 shadow-sm border">
                  {selectedMember.photo_url ? (
                    <img src={selectedMember.photo_url} alt={selectedMember.name} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-lg font-bold text-primary">{selectedMember.name.charAt(0)}</span>
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <CardTitle className="text-xl">{selectedMember.name}</CardTitle>
                    <StatusBadge status={selectedMember.status} />
                    {selectedMemberDebt && selectedMemberDebt.totalDebt > 0 && (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-700 border border-red-300 animate-pulse">
                        ⚠️ Outstanding: {selectedMemberDebt.totalDebt.toLocaleString()} EGP
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mt-0.5">#{selectedMember.id} · {selectedMember.phone}</p>
                </div>
                <button onClick={() => setSelectedMember(null)} className="text-muted-foreground hover:text-foreground p-1 rounded">✕</button>
              </div>
            </CardHeader>

            <CardContent className="space-y-4 pt-4">
              {/* Primary Membership Stats */}
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="p-3 rounded-xl bg-white shadow-sm border">
                  <p className="text-2xl font-bold text-foreground">
                    {selectedMember.sessions_remaining === 999 ? "∞" : selectedMember.sessions_remaining}
                  </p>
                  <p className="text-xs font-medium text-muted-foreground mt-0.5">Sessions Left</p>
                </div>
                <div className="p-3 rounded-xl bg-white shadow-sm border">
                  <p className="text-sm font-bold text-foreground truncate" title={selectedMember.package_name}>
                    {selectedMember.package_name || "None"}
                  </p>
                  <p className="text-xs font-medium text-muted-foreground mt-0.5">Active Package</p>
                </div>
                <div className="p-3 rounded-xl bg-white shadow-sm border">
                  <p className="text-sm font-bold text-foreground">
                    {selectedMember.expires_at ? format(new Date(selectedMember.expires_at), "dd MMM yyyy") : 'N/A'}
                  </p>
                  <p className="text-xs font-medium text-muted-foreground mt-0.5">Expires</p>
                </div>
              </div>

              {/* Outstanding Debt Alert Banner */}
              {selectedMemberDebt && selectedMemberDebt.totalDebt > 0 && (
                <div className="p-3.5 rounded-xl bg-red-100/90 border border-red-300 text-red-900 text-sm space-y-1.5">
                  <div className="flex items-center gap-2 font-semibold">
                    <AlertTriangle className="w-4 h-4 text-red-700 flex-shrink-0" />
                    <span>Member Has Unpaid Invoices ({selectedMemberDebt.totalDebt.toLocaleString()} EGP Total Due)</span>
                  </div>
                  <div className="text-xs space-y-1 pl-6">
                    {selectedMemberDebt.unpaidInvoices.map(inv => (
                      <div key={inv.uuid} className="flex justify-between items-center text-red-800">
                        <span>Invoice #{inv.id} ({inv.package_name})</span>
                        <span className="font-semibold">Paid {inv.paid_amount.toLocaleString()} / {inv.total_amount.toLocaleString()} EGP</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Class & Coach & Schedule Details */}
              {selectedMember.class_info && (
                <div className="p-3 rounded-xl bg-white border shadow-sm space-y-1.5 text-sm">
                  <p className="text-xs font-semibold uppercase text-muted-foreground tracking-wider flex items-center gap-1.5">
                    <Trophy className="w-3.5 h-3.5 text-primary" /> Class & Coach Details
                  </p>
                  <div className="flex justify-between items-center text-sm font-medium">
                    <span className="text-foreground font-semibold">{selectedMember.class_info.sport_name ?? 'Sport'}</span>
                    <span className="text-primary">{selectedMember.class_info.coach_name ?? 'Coach'}</span>
                  </div>
                  {selectedMember.class_info.schedules && selectedMember.class_info.schedules.length > 0 && (
                    <div className="text-xs text-muted-foreground flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      <span>{selectedMember.class_info.schedules.map(s => `${s.day.slice(0, 3)} ${s.time}`).join(', ')}</span>
                    </div>
                  )}
                  {selectedMember.last_subscription_date && (
                    <div className="text-xs text-muted-foreground">
                      Started: {format(new Date(selectedMember.last_subscription_date), "dd MMM yyyy")}
                    </div>
                  )}
                </div>
              )}

              {/* Multiple Packages History Display */}
              {selectedMemberInvoices.length > 1 && (
                <div className="p-3 rounded-xl bg-white/80 border text-xs space-y-2">
                  <p className="font-semibold text-muted-foreground uppercase tracking-wider">
                    Recent Subscription Invoices ({selectedMemberInvoices.length})
                  </p>
                  <div className="space-y-1.5 max-h-28 overflow-y-auto">
                    {selectedMemberInvoices.slice(0, 3).map(inv => (
                      <div key={inv.uuid} className="flex items-center justify-between p-1.5 rounded bg-muted/40 text-muted-foreground">
                        <span className="font-medium text-foreground">{inv.package_name} (#{inv.id})</span>
                        <span>{format(new Date(inv.created_at), "dd MMM yyyy")}</span>
                        <Badge variant="outline" className="text-[10px] py-0">{inv.status}</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Expiration warnings */}
              {selectedMember.status === 'expiring_soon' && !expired && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-100 border border-amber-300 text-amber-900 text-sm">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0 text-amber-700" />
                  <span>This membership is expiring soon ({selectedMember.sessions_remaining} sessions left).</span>
                </div>
              )}

              {expired && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-red-100 border border-red-300 text-red-900 text-sm">
                  <XCircle className="w-4 h-4 flex-shrink-0 text-red-700" />
                  <span>
                    {selectedMember.sessions_remaining <= 0
                      ? "No sessions remaining. Override required to check in."
                      : `Membership expired on ${selectedMember.expires_at ? format(new Date(selectedMember.expires_at), "MMM d, yyyy") : 'N/A'}. Override required.`}
                  </span>
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <Button
                  data-testid="btn-checkin-confirm"
                  onClick={handleCheckInClick}
                  disabled={checkedInToday.includes(selectedMember.uuid) || checkInMutation.isPending}
                  className="flex-1 h-11 text-base font-semibold gap-2"
                  variant={expired ? 'destructive' : 'default'}
                >
                  <CheckCircle2 className="w-5 h-5" />
                  {expired ? 'Override & Check In' :
                    checkedInToday.includes(selectedMember.uuid) ? 'Already Checked In' : 'Check In'}
                </Button>
                <Button data-testid="btn-checkin-cancel" variant="outline" onClick={() => setSelectedMember(null)}>Cancel</Button>
              </div>
            </CardContent>
          </Card>
        );
      })()}

      {/* Success state */}
      {successMember && (
        <Card className="border-emerald-200 bg-emerald-50 shadow-sm">
          <CardContent className="p-6 text-center space-y-2">
            <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
            <p className="text-xl font-bold text-emerald-800">{successMember.name}</p>
            <p className="text-sm text-emerald-700">Checked in successfully at {format(new Date(), "HH:mm")}</p>
            <p className="text-sm text-muted-foreground">
              {successMember.sessions_remaining === 999 ? "Unlimited sessions" : `${Math.max(0, successMember.sessions_remaining - 1)} sessions remaining`}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Recently checked in today */}
      {recentlyCheckedIn.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" /> Checked In This Session
          </p>
          <div className="space-y-1.5">
            {recentlyCheckedIn.map(m => (
              <div key={m.uuid} data-testid={`checked-in-${m.uuid}`} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-emerald-50 border border-emerald-100">
                <UserCheck className="w-4 h-4 text-emerald-600" />
                <span className="text-sm font-medium text-foreground">{m.name}</span>
                <span className="text-xs text-muted-foreground ml-auto">{format(new Date(), "HH:mm")}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Override Dialog */}
      <AlertDialog open={overrideDialog} onOpenChange={setOverrideDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Override Expired Membership</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{selectedMember?.name}</strong>'s membership has expired or has 0 sessions. This action will be logged in the audit trail.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel data-testid="btn-override-cancel">Cancel</AlertDialogCancel>
            <Button
              data-testid="btn-override-paylater"
              variant="outline"
              onClick={() => selectedMember && doCheckIn(selectedMember, true, true)}
              className="border-amber-300 text-amber-700 hover:bg-amber-50"
              disabled={checkInMutation.isPending}
            >
              Mark Pay Later
            </Button>
            <AlertDialogAction
              data-testid="btn-override-allow"
              onClick={() => selectedMember && doCheckIn(selectedMember, true, false)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={checkInMutation.isPending}
            >
              Allow Anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

