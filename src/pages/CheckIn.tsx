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
import { useMembers, useCheckInMember, usePackages } from "@/hooks/use-data";
import { useAuth } from "@/lib/auth";
import type { Member, SubscriptionPackage } from "@/lib/types";
import StatusBadge from "@/components/StatusBadge";
import { toast } from "sonner";
import { format } from "date-fns";

export default function CheckIn() {
  const { data: members = [] } = useMembers();
  const { data: packages = [] } = usePackages();
  const checkInMutation = useCheckInMember();
  const { currentUser } = useAuth();
  
  const [query, setQuery] = useState("");
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);

  const [successMember, setSuccessMember] = useState<Member | null>(null);
  const [checkedInToday, setCheckedInToday] = useState<string[]>([]);

  const results = query.length >= 1
    ? members.filter(m =>
        m.name.toLowerCase().includes(query.toLowerCase()) ||
        m.id.toString().includes(query) ||
        m.phone.includes(query)
      ).slice(0, 6)
    : [];

  const doCheckIn = (member: Member) => {
    checkInMutation.mutate({
      memberId: member.uuid,
      isOverride: false,
      payLater: false,
      performedBy: currentUser?.id,
      performerName: currentUser?.name
    }, {
      onSuccess: () => {
        setCheckedInToday(prev => [...prev, member.uuid]);
        setSuccessMember(member);
        setSelectedMember(null);
        setQuery("");
        toast.success(`Checked in: ${member.name}`, { description: `Session deducted` });
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

  const isClinic = selectedMember 
    ? (selectedMember.id === -1 || (packages.find(p => p.id === selectedMember.package_id)?.is_clinic || false))
    : false;

  const handleCheckInClick = () => {
    if (!selectedMember) return;
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
        isOverride: true,
        payLater: false,
        performedBy: currentUser?.id,
        performerName: currentUser?.name
      }, {
        onSuccess: () => {
          setCheckedInToday(prev => [...prev, selectedMember.uuid]);
          setSuccessMember(selectedMember);
          setSelectedMember(null);
          setQuery("");
          toast.success(`Check-in Override Successful`, { description: `Freeze cancelled and checked in.` });
        },
        onError: (err) => {
          toast.error(`Check-in override failed: ${err.message}`);
        }
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
        isOverride: true,
        payLater: false,
        performedBy: currentUser?.id,
        performerName: currentUser?.name
      }, {
        onSuccess: () => {
          setCheckedInToday(prev => [...prev, selectedMember.uuid]);
          setSuccessMember(selectedMember);
          setSelectedMember(null);
          setQuery("");
          toast.success(`Check-in Override Successful`, { description: `Session debt increased or expired member checked in.` });
        },
        onError: (err) => {
          toast.error(`Check-in override failed: ${err.message}`);
        }
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
                <p className="text-sm font-bold text-foreground">{selectedMember.expires_at ? format(new Date(selectedMember.expires_at), "dd MMM") : "—"}</p>
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
                <span>Membership expired on {selectedMember.expires_at ? format(new Date(selectedMember.expires_at), "MMM d, yyyy") : "unknown date"}. Cannot check in.</span>
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
                <span>This member is frozen until {format(new Date(selectedMember.frozen_until), "MMM d, yyyy")}. Overriding will cancel the freeze.</span>
              </div>
            )}

            {selectedMember.status === 'has_debt' && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-purple-100 border border-purple-200 text-purple-800 text-sm">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span>Member has outstanding payment. Proceed with check-in?</span>
              </div>
            )}

            <div className="flex gap-2">
              {!(selectedMember.sessions_remaining <= -3 && selectedMember.sessions_remaining !== 999) && !(isClinic && selectedMember.sessions_remaining <= 0) && (
                <Button
                  data-testid="btn-checkin-confirm"
                  onClick={handleCheckInClick}
                  disabled={checkedInToday.includes(selectedMember.uuid) || checkInMutation.isPending}
                  className={`flex-1 h-11 text-base font-semibold gap-2 ${(selectedMember.frozen_until && new Date(selectedMember.frozen_until) > new Date()) || selectedMember.status === 'expired' || (selectedMember.sessions_remaining <= 0 && selectedMember.sessions_remaining !== 999) ? 'bg-orange-500 hover:bg-orange-600 text-white' : ''}`}
                >
                  <CheckCircle2 className="w-5 h-5" />
                  {checkedInToday.includes(selectedMember.uuid) 
                    ? 'Already Checked In' 
                    : (selectedMember.frozen_until && new Date(selectedMember.frozen_until) > new Date()) 
                        ? 'Override & Unfreeze' 
                        : (selectedMember.status === 'expired' || (selectedMember.sessions_remaining <= 0 && selectedMember.sessions_remaining !== 999))
                            ? 'Override Check In'
                            : 'Check In'}
                </Button>
              )}
              <Button data-testid="btn-checkin-cancel" variant="outline" onClick={() => setSelectedMember(null)} className={(!(selectedMember.sessions_remaining <= -3 && selectedMember.sessions_remaining !== 999) && !(isClinic && selectedMember.sessions_remaining <= 0)) ? "" : "flex-1"}>Cancel</Button>
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
            <p className="text-sm text-emerald-700">
              {successMember.sessions_remaining === 999 
                ? "Unlimited sessions" 
                : `${successMember.sessions_remaining - 1} sessions remaining`}
            </p>
          </CardContent>
        </Card>
      )}




    </div>
  );
}
