import { useState } from "react";
import { Search, CheckCircle2, AlertTriangle, XCircle, UserCheck, Clock } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle
} from "@/components/ui/alert-dialog";
import { useMembers, useCheckInMember } from "@/hooks/use-data";
import { useAuth } from "@/lib/auth";
import type { Member } from "@/lib/types";
import StatusBadge from "@/components/StatusBadge";
import { toast } from "sonner";
import { format } from "date-fns";

export default function CheckIn() {
  const { data: members = [] } = useMembers();
  const checkInMutation = useCheckInMember();
  const { currentUser } = useAuth();
  
  const [query, setQuery] = useState("");
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [overrideDialog, setOverrideDialog] = useState(false);
  const [successMember, setSuccessMember] = useState<Member | null>(null);
  const [checkedInToday, setCheckedInToday] = useState<string[]>([]);

  const results = query.length >= 1
    ? members.filter(m =>
        m.name.toLowerCase().includes(query.toLowerCase()) ||
        m.id.toLowerCase().includes(query.toLowerCase()) ||
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

  const handleCheckInClick = () => {
    if (!selectedMember) return;
    if (selectedMember.status === 'expired') {
      setOverrideDialog(true);
    } else {
      doCheckIn(selectedMember);
    }
  };

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
                <p className="text-sm text-muted-foreground">{m.id} · {m.phone}</p>
              </div>
              <StatusBadge status={m.status} />
            </button>
          ))}
        </div>
      )}

      {/* Member card */}
      {selectedMember && (
        <Card className={
          selectedMember.status === 'expired' ? "border-red-300 bg-red-50" :
          selectedMember.status === 'expiring_soon' ? "border-amber-300 bg-amber-50" :
          "border-emerald-200 bg-emerald-50"
        }>
          <CardHeader className="pb-2">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center flex-shrink-0 shadow-sm">
                <span className="text-lg font-bold text-primary">{selectedMember.name.charAt(0)}</span>
              </div>
              <div className="flex-1">
                <CardTitle className="text-xl">{selectedMember.name}</CardTitle>
                <p className="text-sm text-muted-foreground">{selectedMember.id} · {selectedMember.phone}</p>
                <div className="mt-1"><StatusBadge status={selectedMember.status} /></div>
              </div>
              <button onClick={() => setSelectedMember(null)} className="text-muted-foreground hover:text-foreground">✕</button>
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
                <p className="text-sm font-bold text-foreground">{format(new Date(selectedMember.expires_at), "dd MMM")}</p>
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
                <span>Membership expired on {format(new Date(selectedMember.expires_at), "MMM d, yyyy")}. Override required.</span>
              </div>
            )}

            {selectedMember.status === 'has_debt' && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-purple-100 border border-purple-200 text-purple-800 text-sm">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span>Member has outstanding payment. Proceed with check-in?</span>
              </div>
            )}

            <div className="flex gap-2">
              <Button
                data-testid="btn-checkin-confirm"
                onClick={handleCheckInClick}
                disabled={checkedInToday.includes(selectedMember.uuid) || checkInMutation.isPending}
                className="flex-1 h-11 text-base font-semibold gap-2"
                variant={selectedMember.status === 'expired' ? 'destructive' : 'default'}
              >
                <CheckCircle2 className="w-5 h-5" />
                {selectedMember.status === 'expired' ? 'Override & Check In' :
                  checkedInToday.includes(selectedMember.uuid) ? 'Already Checked In' : 'Check In'}
              </Button>
              <Button data-testid="btn-checkin-cancel" variant="outline" onClick={() => setSelectedMember(null)}>Cancel</Button>
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
              <strong>{selectedMember?.name}</strong>'s membership has expired. This action will be logged in the audit trail.
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
