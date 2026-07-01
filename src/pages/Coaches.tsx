import { useState } from "react";
import { CheckCircle2, Clock, Dumbbell, DollarSign, Plus, Pencil } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import { 
  useCoaches, useInvoices, useMembers, 
  useCreateCoach, useUpdateCoach, 
  useCoachCheckInsToday, useCheckInCoach 
} from "@/hooks/use-data";
import type { Coach } from "@/lib/types";
import { toast } from "sonner";

const paymentTypeColors: Record<string, string> = {
  salary: "bg-blue-100 text-blue-700 border border-blue-200",
  per_session: "bg-violet-100 text-violet-700 border border-violet-200",
  commission: "bg-amber-100 text-amber-700 border border-amber-200",
};
const paymentTypeLabels: Record<string, string> = {
  salary: "Monthly Salary", per_session: "Per Session", commission: "Commission",
};
const commissionBaseLabels: Record<string, string> = {
  revenue: "Total Revenue", members: "New Members",
};

interface CoachForm {
  name: string;
  phone: string;
  paymentType: "salary" | "per_session" | "commission";
  rate: string;
  commissionBase: "revenue" | "members";
}

const emptyForm: CoachForm = { name: "", phone: "", paymentType: "salary", rate: "", commissionBase: "revenue" };

export default function Coaches() {
  const { data: coaches = [] } = useCoaches();
  const { data: invoices = [] } = useInvoices();
  const { data: members = [] } = useMembers();
  const { data: checkIns = [] } = useCoachCheckInsToday();
  const createCoach = useCreateCoach();
  const updateCoach = useUpdateCoach();
  const checkInMutation = useCheckInCoach();

  const [checkInModal, setCheckInModal] = useState(false);
  const [showCoachDialog, setShowCoachDialog] = useState(false);
  const [editCoach, setEditCoach] = useState<Coach | null>(null);
  const [form, setForm] = useState<CoachForm>(emptyForm);
  const [coachSearch, setCoachSearch] = useState("");

  const checkedInCount = coaches.filter(c => checkIns.some(ci => ci.coach_id === c.id)).length;

  const monthlyRevenue = invoices
    .filter(i => {
      const d = new Date(i.created_at); const now = new Date();
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    })
    .reduce((s, i) => s + i.paid_amount, 0);

  const newMembersThisMonth = members.filter(m => {
    const d = new Date(m.member_since); const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;

  const calcEarnings = (coach: Coach) => {
    if (coach.payment_type === 'salary') return coach.rate;
    if (coach.payment_type === 'per_session') return coach.rate * coach.sessions_this_month;
    const base = coach.commission_base === 'members' ? newMembersThisMonth * 1000 : monthlyRevenue;
    return Math.round((coach.rate / 100) * base);
  };

  const handleCoachCheckIn = (coachId: string, name: string) => {
    checkInMutation.mutate(coachId, {
      onSuccess: () => toast.success(`${name} checked in for session`),
      onError: (err) => toast.error(`Failed to check in: ${err.message}`)
    });
  };

  const openAdd = () => { setForm(emptyForm); setEditCoach(null); setShowCoachDialog(true); };
  const openEdit = (c: Coach) => {
    setEditCoach(c);
    setForm({ name: c.name, phone: c.phone || "", paymentType: c.payment_type, rate: String(c.rate), commissionBase: c.commission_base ?? 'revenue' });
    setShowCoachDialog(true);
  };
  const closeDialog = () => { setShowCoachDialog(false); setEditCoach(null); };

  const handleSave = () => {
    if (!form.name.trim() || !form.phone.trim() || !form.rate) { toast.error("Name, phone, and rate are required"); return; }
    if (!/^\d{11}$/.test(form.phone.trim())) { toast.error("Phone number must be exactly 11 digits"); return; }
    
    if (editCoach) {
      updateCoach.mutate({
        id: editCoach.id,
        updates: {
          name: form.name.trim(),
          phone: form.phone.trim(),
          payment_type: form.paymentType,
          rate: Number(form.rate),
          commission_base: form.commissionBase
        }
      }, {
        onSuccess: () => {
          toast.success(`Coach updated: ${form.name}`);
          closeDialog();
        },
        onError: (err) => toast.error(`Error updating: ${err.message}`)
      });
    } else {
      createCoach.mutate({
        name: form.name.trim(),
        phone: form.phone.trim(),
        payment_type: form.paymentType,
        rate: Number(form.rate),
        commission_base: form.commissionBase,
        sessions_this_month: 0,
      }, {
        onSuccess: () => {
          toast.success(`Coach added: ${form.name}`);
          closeDialog();
        },
        onError: (err) => toast.error(`Error adding: ${err.message}`)
      });
    }
  };

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Coaches</h1>
          <p className="text-sm text-muted-foreground">{checkedInCount} of {coaches.length} checked in today</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={openAdd} className="gap-2">
            <Plus className="w-4 h-4" /> Add Coach
          </Button>
          <Button data-testid="btn-coach-checkin-modal" onClick={() => setCheckInModal(true)} className="gap-2">
            <CheckCircle2 className="w-4 h-4" /> Coach Check-In
          </Button>
        </div>
      </div>

      <Card className="bg-muted/30">
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-4 text-sm mb-3">
            <div><p className="text-xs text-muted-foreground">Monthly Revenue (commission base)</p><p className="font-bold">{monthlyRevenue.toLocaleString()} EGP</p></div>
            <div><p className="text-xs text-muted-foreground">New Members This Month</p><p className="font-bold">{newMembersThisMonth}</p></div>
          </div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Today's Check-In Status</p>
          <div className="flex flex-wrap gap-3">
            {coaches.map(c => {
              const isCheckedIn = checkIns.some(ci => ci.coach_id === c.id);
              return (
                <div key={c.id} data-testid={`coach-status-${c.id}`} className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${isCheckedIn ? 'bg-emerald-50 border-emerald-200' : 'bg-card border-border'}`}>
                  <div className={`w-2 h-2 rounded-full ${isCheckedIn ? 'bg-emerald-500' : 'bg-gray-300'}`} />
                  <span className="text-sm font-medium">{c.name}</span>
                  {isCheckedIn ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> : <Clock className="w-3.5 h-3.5 text-muted-foreground" />}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {coaches.map(coach => {
          const earnings = calcEarnings(coach);
          const isCheckedIn = checkIns.some(ci => ci.coach_id === coach.id);
          return (
            <Card key={coach.id} data-testid={`coach-card-${coach.id}`} className="hover:shadow-md transition-shadow">
              <CardContent className="p-5 space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-11 h-11 rounded-full bg-[#0a0a0a] flex items-center justify-center flex-shrink-0">
                    <span className="text-base font-bold text-[#ffc700]">{coach.name.charAt(0)}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold">{coach.name}</p>
                    <div className="flex items-center gap-1 flex-wrap mt-1">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${paymentTypeColors[coach.payment_type]}`}>
                        {paymentTypeLabels[coach.payment_type]}
                      </span>
                      {coach.payment_type === 'commission' && coach.commission_base && (
                        <span className="text-xs text-muted-foreground">on {commissionBaseLabels[coach.commission_base]}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <div className={`w-2.5 h-2.5 rounded-full ${isCheckedIn ? 'bg-emerald-500' : 'bg-gray-300'}`} />
                    <button onClick={() => openEdit(coach)} className="p-1 rounded hover:bg-muted transition-colors text-muted-foreground">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="p-2.5 rounded-lg bg-muted/50 text-center">
                    <p className="text-lg font-bold">{coach.sessions_this_month}</p>
                    <p className="text-xs text-muted-foreground">Sessions (Month)</p>
                  </div>
                  <div className="p-2.5 rounded-lg bg-muted/50 text-center">
                    <p className="text-lg font-bold">
                      {coach.payment_type === 'salary' ? `${coach.rate.toLocaleString()}` :
                       coach.payment_type === 'per_session' ? `${coach.rate}/ses` : `${coach.rate}%`}
                    </p>
                    <p className="text-xs text-muted-foreground">Rate</p>
                  </div>
                </div>
                <div className="p-3 rounded-lg border bg-card">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2"><DollarSign className="w-4 h-4 text-primary" /><span className="text-sm font-medium">Monthly Payroll</span></div>
                    <span className="text-base font-bold">{earnings.toLocaleString()} EGP</span>
                  </div>
                  {coach.payment_type === 'per_session' && <p className="text-xs text-muted-foreground mt-1">{coach.sessions_this_month} × {coach.rate} EGP</p>}
                  {coach.payment_type === 'commission' && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {coach.rate}% of {coach.commission_base === 'members' ? `${newMembersThisMonth} new members (×1000)` : `${monthlyRevenue.toLocaleString()} EGP revenue`}
                    </p>
                  )}
                </div>
                {!isCheckedIn && (
                  <Button data-testid={`btn-checkin-coach-${coach.id}`} variant="outline" size="sm" className="w-full gap-2" onClick={() => handleCoachCheckIn(coach.id, coach.name)} disabled={checkInMutation.isPending}>
                    <Dumbbell className="w-3.5 h-3.5" /> Check In for Today
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold">Monthly Payroll Summary</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-2">
            {coaches.map(coach => (
              <div key={coach.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium">{coach.name}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${paymentTypeColors[coach.payment_type]}`}>{paymentTypeLabels[coach.payment_type]}</span>
                  {coach.payment_type === 'commission' && (
                    <span className="text-xs text-muted-foreground">{coach.rate}% on {commissionBaseLabels[coach.commission_base ?? 'revenue']}</span>
                  )}
                </div>
                <span className="text-sm font-bold">{calcEarnings(coach).toLocaleString()} EGP</span>
              </div>
            ))}
            <div className="flex items-center justify-between py-2 pt-3">
              <span className="text-sm font-bold">Total Payroll</span>
              <span className="text-base font-bold text-primary">{coaches.reduce((s, c) => s + calcEarnings(c), 0).toLocaleString()} EGP</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={checkInModal} onOpenChange={setCheckInModal}>
        <DialogContent>
          <DialogHeader><DialogTitle>Coach Check-In</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <Input 
              placeholder="Search by coach name or phone..." 
              value={coachSearch} 
              onChange={(e) => setCoachSearch(e.target.value)}
            />
            <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
              {coaches.filter(c => 
                c.name.toLowerCase().includes(coachSearch.toLowerCase()) || 
                (c.phone && c.phone.includes(coachSearch))
              ).map(c => {
                const isCheckedIn = checkIns.some(ci => ci.coach_id === c.id);
                return (
                  <div key={c.id} className="flex items-center justify-between p-3 rounded-lg border bg-card">
                  <div><p className="font-medium">{c.name}</p><p className="text-xs text-muted-foreground">{paymentTypeLabels[c.payment_type]}</p></div>
                  {isCheckedIn ? (
                    <span className="flex items-center gap-1 text-emerald-600 text-sm font-medium"><CheckCircle2 className="w-4 h-4" /> Checked In</span>
                  ) : (
                    <Button data-testid={`btn-modal-checkin-coach-${c.id}`} size="sm" onClick={() => handleCoachCheckIn(c.id, c.name)} disabled={checkInMutation.isPending}>Check In</Button>
                  )}
                </div>
              );
            })}
            {coaches.filter(c => c.name.toLowerCase().includes(coachSearch.toLowerCase()) || (c.phone && c.phone.includes(coachSearch))).length === 0 && (
              <p className="text-sm text-center text-muted-foreground py-4">No coaches found matching your search.</p>
            )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showCoachDialog} onOpenChange={o => !o && closeDialog()}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{editCoach ? `Edit: ${editCoach.name}` : 'Add Coach'}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5"><Label>Name</Label><Input placeholder="Coach name" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} /></div>
            <div className="space-y-1.5"><Label>Phone</Label><Input placeholder="01XXXXXXXXX" value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} /></div>
            <div className="space-y-1.5">
              <Label>Payment Type</Label>
              <Select value={form.paymentType} onValueChange={(v: "salary" | "per_session" | "commission") => setForm(p => ({ ...p, paymentType: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="salary">Monthly Salary</SelectItem>
                  <SelectItem value="per_session">Per Session</SelectItem>
                  <SelectItem value="commission">Commission (%)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {form.paymentType === 'commission' && (
              <div className="space-y-1.5">
                <Label>Commission Base</Label>
                <Select value={form.commissionBase} onValueChange={(v: "revenue" | "members") => setForm(p => ({ ...p, commissionBase: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="revenue">% of Monthly Revenue</SelectItem>
                    <SelectItem value="members">% of New Members Value</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1.5">
              <Label>{form.paymentType === 'salary' ? 'Monthly Rate (EGP)' : form.paymentType === 'per_session' ? 'Rate per Session (EGP)' : 'Commission Rate (%)'}</Label>
              <Input type="number" placeholder="0" value={form.rate} onChange={e => setForm(p => ({ ...p, rate: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Cancel</Button>
            <Button onClick={handleSave} disabled={createCoach.isPending || updateCoach.isPending}>{editCoach ? 'Save Changes' : 'Add Coach'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
