import { useState } from "react";
import { CheckCircle2, Clock, Dumbbell, DollarSign, Plus, Pencil, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  useCreateCoach, useUpdateCoach, useDeleteCoach, 
  useCoachCheckInsToday,
  useCoachCheckInsForMonth, useCoachHistory, useClasses,
  useCoachDeductions, useCreateCoachDeduction, useDeleteCoachDeduction
} from "@/hooks/use-data";
import { toast } from "sonner";
import { calculateCoachPayroll } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import type { Coach } from "@/lib/types";

const paymentTypeColors: Record<string, string> = {
  salary: "bg-blue-100 text-blue-700 border border-blue-200",
  per_session: "bg-violet-100 text-violet-700 border border-violet-200",
};
const paymentTypeLabels: Record<string, string> = {
  salary: "Monthly Salary", per_session: "Per Session",
};
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

interface CoachForm {
  name: string;
  phone: string;
  paymentType: "salary" | "per_session";
  rate: string;
  ptPercentage: string;
}

const emptyForm: CoachForm = { name: "", phone: "", paymentType: "per_session", rate: "", ptPercentage: "100" };
export default function Coaches() {
  const { isAdmin, users } = useAuth();
  const { data: coaches = [] } = useCoaches();
  const { data: invoices = [] } = useInvoices();
  const { data: members = [] } = useMembers();
  const { data: checkIns = [] } = useCoachCheckInsToday();
  const { data: checkInsThisMonth = [] } = useCoachCheckInsForMonth(new Date().getMonth(), new Date().getFullYear());
  const { data: classes = [] } = useClasses();
  const { data: coachDeductions = [] } = useCoachDeductions();

  const createCoach = useCreateCoach();
  const updateCoach = useUpdateCoach();
  const deleteCoach = useDeleteCoach();
  const createDeduction = useCreateCoachDeduction();
  const deleteDeduction = useDeleteCoachDeduction();

  const [showCoachDialog, setShowCoachDialog] = useState(false);
  const [editCoach, setEditCoach] = useState<Coach | null>(null);
  const [deleteCoachData, setDeleteCoachData] = useState<Coach | null>(null);
  const [form, setForm] = useState<CoachForm>(emptyForm);

  // Deductions State
  const [deductionsModalCoach, setDeductionsModalCoach] = useState<Coach | null>(null);
  const [deductionAmount, setDeductionAmount] = useState("");
  const [deductionReason, setDeductionReason] = useState("");
  const [deductionType, setDeductionType] = useState<'deduction'|'bonus'>('deduction');
  const [historyCoach, setHistoryCoach] = useState<Coach | null>(null);

  const { data: history = [] } = useCoachHistory(historyCoach?.id);
  const [coachSearch, setCoachSearch] = useState("");
  const [mainCoachSearch, setMainCoachSearch] = useState("");

  const todayName = DAYS[new Date().getDay()];
  const todaysClasses = classes
    .filter(c => (c.schedules || []).some(s => s.day === todayName))
    .sort((a, b) => {
      const timeA = (a.schedules || []).find(s => s.day === todayName)?.time || "";
      const timeB = (b.schedules || []).find(s => s.day === todayName)?.time || "";
      return timeA.localeCompare(timeB);
    });

  // A coach is checked in today if they have ANY check-in record for today
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

  const handleAddDeduction = () => {
    if (!deductionsModalCoach || !deductionAmount) return;
    const amt = Number(deductionAmount);
    const finalAmount = deductionType === 'bonus' ? amt : -amt;

    createDeduction.mutate({
      coach_id: deductionsModalCoach.id,
      amount: finalAmount,
      forgiven_sessions: 0,
      reason: deductionReason || (deductionType === 'bonus' ? "Manual Bonus" : "Manual Deduction"),
      date: new Date().toISOString()
    }, {
      onSuccess: () => {
        toast.success("Adjustment added");
        setDeductionAmount("");
        setDeductionReason("");
      },
      onError: (err) => {
        console.error("Adjustment error", err);
        toast.error(`Error adding adjustment: ${err.message}`);
      }
    });
  };

  const openAdd = () => { setForm(emptyForm); setEditCoach(null); setShowCoachDialog(true); };
  const openEdit = (c: Coach) => {
    setEditCoach(c);
    setForm({ name: c.name, phone: c.phone || "", paymentType: c.payment_type as "salary" | "per_session", rate: String(c.rate), ptPercentage: String(c.pt_percentage ?? 100) });
    setShowCoachDialog(true);
  };
  const closeDialog = () => { setShowCoachDialog(false); setEditCoach(null); };

  const handleSave = () => {
    if (!form.name.trim() || !form.rate) { toast.error("Name and rate are required"); return; }
    if (form.phone.trim() && !/^\d{11}$/.test(form.phone.trim())) { toast.error("Phone number must be exactly 11 digits"); return; }
    
    if (editCoach) {
      updateCoach.mutate({
        id: editCoach.id,
        updates: {
          name: form.name.trim(),
          phone: form.phone.trim(),
          payment_type: form.paymentType,
          rate: Number(form.rate),
          pt_percentage: Number(form.ptPercentage),
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
        pt_sessions_done: 0,
        pt_rate: 250,
        pt_percentage: Number(form.ptPercentage),
      }, {
        onSuccess: () => {
          toast.success(`Coach added: ${form.name}`);
          closeDialog();
        },
        onError: (err) => toast.error(`Error adding: ${err.message}`)
      });
    }
  };

  const handleDelete = () => {
    if (!deleteCoachData) return;
    deleteCoach.mutate({ id: deleteCoachData.id, name: deleteCoachData.name }, {
      onSuccess: () => {
        toast.success(`Coach deleted: ${deleteCoachData.name}`);
        setDeleteCoachData(null);
      },
      onError: (err) => toast.error(`Error deleting coach: ${err.message}`)
    });
  };

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Coaches</h1>
          <p className="text-sm text-muted-foreground">{checkedInCount} of {coaches.length} checked in today</p>
        </div>
        <div className="flex gap-2 items-center">
          <Input 
            placeholder="Search by name or phone..." 
            value={mainCoachSearch} 
            onChange={(e) => setMainCoachSearch(e.target.value)}
            className="w-48 sm:w-64"
          />
          {isAdmin && (
            <Button variant="outline" onClick={openAdd} className="gap-2">
              <Plus className="w-4 h-4" /> Add
            </Button>
          )}
        </div>
      </div>



      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {coaches.filter(c => c.name.toLowerCase().includes(mainCoachSearch.toLowerCase()) || (c.phone && c.phone.includes(mainCoachSearch))).map(coach => {
          const stats = calculateCoachPayroll(coach, new Date().getMonth(), new Date().getFullYear(), classes, checkInsThisMonth, monthlyRevenue, newMembersThisMonth, coachDeductions);
          const sessions = stats.attendedSessions;
          const todayName = DAYS[new Date().getDay()];
          const coachTotalSlotsToday = classes.filter(c => c.coach_id === coach.id).flatMap(c => c.schedules || []).filter(s => s.day === todayName).length;
          const checkInsTodayCount = checkIns.filter(ci => ci.coach_id === coach.id).length;

          return (
            <Card key={coach.id} data-testid={`coach-card-${coach.id}`} className="hover:shadow-md transition-shadow">
              <CardContent className="p-5 space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-11 h-11 rounded-full bg-[#0a0a0a] flex items-center justify-center flex-shrink-0">
                    <span className="text-base font-bold text-[#ffc700]">{coach.name.charAt(0)}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold truncate">{coach.name}</p>
                      {coachTotalSlotsToday > 0 && (
                        <div className="flex items-center gap-1 shrink-0">
                          {Array.from({ length: coachTotalSlotsToday }).map((_, i) => (
                            <div 
                              key={i} 
                              className={`w-2.5 h-2.5 rounded-full border ${i < checkInsTodayCount ? 'bg-emerald-500 border-emerald-600' : 'bg-transparent border-gray-400'}`} 
                              title={`Slot ${i + 1} of ${coachTotalSlotsToday}`}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-1 flex-wrap mt-1">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${paymentTypeColors[coach.payment_type]}`}>
                        {paymentTypeLabels[coach.payment_type]}
                      </span>
                    </div>
                  </div>
                  {isAdmin && (
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button onClick={() => openEdit(coach)} className="p-1 rounded hover:bg-muted transition-colors text-muted-foreground">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => setDeleteCoachData(coach)} className="p-1 rounded hover:bg-red-50 hover:text-red-600 transition-colors text-muted-foreground">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
                  <div className="grid grid-cols-4 gap-2 cursor-pointer hover:opacity-80 transition-opacity" onClick={() => setHistoryCoach(coach)}>
                    <div className="p-2.5 rounded-lg bg-muted/50 text-center flex flex-col justify-center">
                      <p className="text-lg font-bold">{stats.scheduledSlotsInMonth}</p>
                      <p className="text-xs text-muted-foreground">Expected Slots</p>
                    </div>
                    <div className="p-2.5 rounded-lg bg-muted/50 text-center flex flex-col justify-center">
                      <p className="text-lg font-bold">{stats.attendedSessions}</p>
                      <p className="text-xs text-muted-foreground">Attended Slots</p>
                    </div>
                    <div className="p-2.5 rounded-lg bg-indigo-50/50 border border-indigo-100 text-center flex flex-col justify-center">
                      <p className="text-lg font-bold text-indigo-700">{stats.ptCheckIns || 0}</p>
                      <p className="text-xs text-indigo-600/70 leading-tight">PT Sessions</p>
                    </div>
                    <div className="p-2.5 rounded-lg bg-amber-50/50 border border-amber-100 text-center flex flex-col justify-center">
                      <p className="text-lg font-bold text-amber-700">{stats.subCheckIns || 0}</p>
                      <p className="text-xs text-amber-600/70 leading-tight">Sub Sessions</p>
                    </div>
                  </div>

                <div className="p-3 rounded-lg border bg-card">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2"><DollarSign className="w-4 h-4 text-primary" /><span className="text-sm font-medium">Monthly Payroll</span></div>
                    <span className="text-base font-bold">{stats.calculatedAmount.toLocaleString()} EGP</span>
                  </div>
                  {stats.missedSessions > 0 && coach.payment_type === 'salary' && stats.deduction > 0 && (
                      <div className="text-xs text-red-500 font-semibold mt-1">
                        Deducted {Math.round(stats.deduction).toLocaleString()} EGP for {stats.missedSessions} missed session(s)
                      </div>
                    )}
                    {stats.totalAdvances > 0 && (
                      <div className="text-xs text-orange-500 font-semibold mt-1">
                        Deducted {Math.round(stats.totalAdvances).toLocaleString()} EGP for advances
                      </div>
                    )}
                    {coach.payment_type === 'per_session' && stats.missedSessions === 0 && <p className="text-xs text-muted-foreground mt-1">{sessions} sessions — {coach.rate} EGP/session</p>}
                  </div>
                <div className="grid grid-cols-2 gap-2">
                  <Button data-testid={`btn-deductions-coach-${coach.id}`} variant="outline" size="sm" className="w-full gap-2 text-xs px-1" onClick={() => setDeductionsModalCoach(coach)}>
                    <DollarSign className="w-3.5 h-3.5" /> Adjust
                  </Button>
                  <Button variant="outline" size="sm" className="w-full gap-2 text-xs px-1" onClick={() => setHistoryCoach(coach)}>
                    <Clock className="w-3.5 h-3.5" /> History
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold">Monthly Payroll Summary</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-2">
            {coaches.map(coach => {
              const stats = calculateCoachPayroll(coach, new Date().getMonth(), new Date().getFullYear(), classes, checkInsThisMonth, monthlyRevenue, newMembersThisMonth, coachDeductions);
              return (
                <div key={coach.id} className="flex flex-col py-3 border-b border-border last:border-0 gap-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium">{coach.name}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${paymentTypeColors[coach.payment_type]}`}>{paymentTypeLabels[coach.payment_type]}</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div className="bg-muted/50 p-2 rounded-md">
                      <p className="text-muted-foreground mb-0.5">Expected</p>
                      <p className="font-semibold">{(stats as any).expectedAmount?.toLocaleString() || 0} EGP</p>
                    </div>
                    <div className="bg-green-500/10 text-green-700 p-2 rounded-md">
                      <p className="mb-0.5 opacity-80">Paid</p>
                      <p className="font-semibold">{(stats as any).paidAmount?.toLocaleString() || 0} EGP</p>
                    </div>
                    <div className="bg-amber-500/10 text-amber-700 p-2 rounded-md">
                      <p className="mb-0.5 opacity-80">Owed</p>
                      <p className="font-bold">{stats.calculatedAmount.toLocaleString()} EGP</p>
                    </div>
                  </div>
                </div>
              );
            })}
            <div className="grid grid-cols-3 gap-2 pt-4 border-t border-border mt-2">
              <div className="flex flex-col">
                <span className="text-xs text-muted-foreground">Total Expected</span>
                <span className="text-sm font-bold text-foreground">
                  {coaches.reduce((s, c) => s + ((calculateCoachPayroll(c, new Date().getMonth(), new Date().getFullYear(), classes, checkInsThisMonth, monthlyRevenue, newMembersThisMonth, coachDeductions) as any).expectedAmount || 0), 0).toLocaleString()} EGP
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-xs text-muted-foreground">Total Paid</span>
                <span className="text-sm font-bold text-green-600">
                  {coaches.reduce((s, c) => s + ((calculateCoachPayroll(c, new Date().getMonth(), new Date().getFullYear(), classes, checkInsThisMonth, monthlyRevenue, newMembersThisMonth, coachDeductions) as any).paidAmount || 0), 0).toLocaleString()} EGP
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-xs text-muted-foreground">Total Owed</span>
                <span className="text-base font-bold text-amber-600">
                  {coaches.reduce((s, c) => s + calculateCoachPayroll(c, new Date().getMonth(), new Date().getFullYear(), classes, checkInsThisMonth, monthlyRevenue, newMembersThisMonth, coachDeductions).calculatedAmount, 0).toLocaleString()} EGP
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={showCoachDialog} onOpenChange={o => !o && closeDialog()}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{editCoach ? `Edit: ${editCoach.name}` : 'Add Coach'}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">              <div className="space-y-1.5"><Label>Name</Label><Input placeholder="Coach name" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} /></div>
              <div className="space-y-1.5"><Label>Phone</Label><Input placeholder="01XXXXXXXXX" value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} /></div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Group Session Rate (EGP)</Label>
                  <Input type="number" placeholder="0" value={form.rate} onChange={e => setForm(p => ({ ...p, rate: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>PT Percentage (%)</Label>
                  <Input type="number" min="0" max="100" placeholder="100" value={form.ptPercentage} onChange={e => setForm(p => ({ ...p, ptPercentage: e.target.value }))} />
                </div>
              </div>
            </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Cancel</Button>
            <Button onClick={handleSave} disabled={createCoach.isPending || updateCoach.isPending}>
              {createCoach.isPending || updateCoach.isPending ? "Saving..." : editCoach ? 'Save Changes' : 'Add Coach'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deductionsModalCoach} onOpenChange={(open) => !open && setDeductionsModalCoach(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Coach Adjustments: {deductionsModalCoach?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="flex gap-4">
              <div className="space-y-1.5 flex-1">
                <Label>Type</Label>
                <Select value={deductionType} onValueChange={(v: 'deduction'|'bonus') => setDeductionType(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="deduction">Deduction (-)</SelectItem>
                    <SelectItem value="bonus">Bonus (+)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5 flex-1">
                <Label>Amount (EGP)</Label>
                <Input type="number" min="0" value={deductionAmount} onChange={e => setDeductionAmount(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Reason</Label>
              <Input value={deductionReason} onChange={e => setDeductionReason(e.target.value)} placeholder="e.g. Advance payment" />
            </div>
            <Button className="w-full" onClick={handleAddDeduction} disabled={createDeduction.isPending}>
              Add Adjustment
            </Button>

            <div className="mt-4 border-t pt-4">
              <h4 className="text-sm font-medium mb-3">Adjustments This Month</h4>
              {(() => {
                const now = new Date();
                const thisMonthDeductions = coachDeductions.filter(d => {
                  if (d.coach_id !== deductionsModalCoach?.id) return false;
                  const dDate = new Date(d.date);
                  return dDate.getMonth() === now.getMonth() && dDate.getFullYear() === now.getFullYear();
                });
                
                const totalBonuses = thisMonthDeductions.filter(d => d.amount > 0).reduce((s, d) => s + d.amount, 0);
                const totalDeductions = Math.abs(thisMonthDeductions.filter(d => d.amount < 0).reduce((s, d) => s + d.amount, 0));
                const net = totalBonuses - totalDeductions;

                return (
                  <div className="space-y-3">
                    <div className="flex justify-between bg-muted/50 p-3 rounded-lg text-sm">
                      <div className="text-center">
                        <p className="text-muted-foreground text-xs uppercase mb-1">Bonuses</p>
                        <p className="font-semibold text-emerald-600">+{totalBonuses}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-muted-foreground text-xs uppercase mb-1">Deductions</p>
                        <p className="font-semibold text-red-600">-{totalDeductions}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-muted-foreground text-xs uppercase mb-1">Net</p>
                        <p className={`font-bold ${net > 0 ? 'text-emerald-600' : net < 0 ? 'text-red-600' : ''}`}>{net > 0 ? '+' : ''}{net}</p>
                      </div>
                    </div>

                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {thisMonthDeductions.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-2">No adjustments this month</p>
                      ) : (
                        thisMonthDeductions.map(d => (
                          <div key={d.id} className="flex items-center justify-between p-2 rounded border bg-card">
                            <div>
                              <p className={`text-sm font-bold ${d.amount > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                {d.amount > 0 ? '+' : ''}{d.amount} EGP
                              </p>
                              <p className="text-xs text-muted-foreground">{d.reason}</p>
                            </div>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-red-500 hover:text-red-600 hover:bg-red-50" onClick={() => deleteDeduction.mutate(d.id)} disabled={deleteDeduction.isPending}>
                              ✕
                            </Button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeductionsModalCoach(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!historyCoach} onOpenChange={(o) => !o && setHistoryCoach(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Session History: {historyCoach?.name}</DialogTitle>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto pr-2 space-y-2">
            {history.length === 0 ? (
              <p className="text-center text-muted-foreground py-6">No sessions recorded yet.</p>
            ) : history.map(ci => {
              const cls = classes.find(c => c.id === ci.class_id);
              const m = members.find(mem => mem.uuid === ci.member_uuid);
              return (
                <div key={ci.id} className="flex items-center justify-between p-3 rounded-lg border bg-card">
                  <div>
                    <p className="font-semibold text-sm">
                      {ci.session_type === 'pt' ? 'PT Session' : (cls?.name || 'General Group Session')}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {new Date(ci.check_in_date).toLocaleDateString()} - {new Date(ci.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                    </p>
                    {ci.is_substitute && (
                      <Badge variant="outline" className="text-[10px] mt-1 bg-amber-50 text-amber-600 border-amber-200">Substitute</Badge>
                    )}
                  </div>
                  {ci.session_type === 'pt' && m && (
                    <div className="text-right">
                      <p className="text-sm font-medium">Client</p>
                      <p className="text-xs text-muted-foreground">{m.name}</p>
                    </div>
                  )}
                  {ci.session_type === 'group' && cls && (
                    <div className="text-right">
                      <p className="text-sm font-medium">{cls.sport_name}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={!!deleteCoachData} onOpenChange={(open) => !open && setDeleteCoachData(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Coach</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <p className="text-sm text-muted-foreground">
              Are you sure you want to delete <strong>{deleteCoachData?.name}</strong>?
            </p>
            <div className="bg-red-50 text-red-700 p-3 rounded-md text-sm">
              <p className="font-semibold mb-1">Warning: Cascade Deletion</p>
              <p>This will also permanently delete:</p>
              <ul className="list-disc list-inside mt-1">
                <li>All their check-ins (sessions)</li>
                <li>All recorded salary expenses for them</li>
                <li>All manual adjustments (bonuses/deductions)</li>
              </ul>
              <p className="mt-2">This action cannot be undone.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteCoachData(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleteCoach.isPending}>
              {deleteCoach.isPending ? "Deleting..." : "Delete Coach"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
