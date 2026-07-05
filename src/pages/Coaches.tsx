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
  useCoachCheckInsToday, useCheckInCoach,
  useCoachCheckInsForMonth, useClasses
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
}

const emptyForm: CoachForm = { name: "", phone: "", paymentType: "salary", rate: "" };
export default function Coaches() {
  const { isAdmin } = useAuth();
  const { data: coaches = [] } = useCoaches();
  const { data: invoices = [] } = useInvoices();
  const { data: members = [] } = useMembers();
  const { data: checkIns = [] } = useCoachCheckInsToday();
  const { data: checkInsThisMonth = [] } = useCoachCheckInsForMonth(new Date().getMonth(), new Date().getFullYear());
  const { data: classes = [] } = useClasses();

  const createCoach = useCreateCoach();
  const updateCoach = useUpdateCoach();
  const checkInMutation = useCheckInCoach();

  const [checkInModal, setCheckInModal] = useState(false);
  const [showCoachDialog, setShowCoachDialog] = useState(false);
  const [editCoach, setEditCoach] = useState<Coach | null>(null);
  const [form, setForm] = useState<CoachForm>(emptyForm);
  const [coachSearch, setCoachSearch] = useState("");
  const [mainCoachSearch, setMainCoachSearch] = useState("");

  const [classCheckInCoach, setClassCheckInCoach] = useState<Coach | null>(null);
  const [selectedClassId, setSelectedClassId] = useState<string>("none");

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

  const openClassCheckIn = (coach: Coach) => {
    setClassCheckInCoach(coach);
    setSelectedClassId("none");
  };

  const submitCheckIn = () => {
    if (!classCheckInCoach) return;
    
    if (selectedClassId === "none") {
      toast.error("Please select a specific class to check into.");
      return;
    }

    const classData = classes.find(c => c.id === selectedClassId);
    if (!classData) return;

    // Validate the day of the week
    const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const todayName = DAYS[new Date().getDay()];
    const scheduledSlotsForToday = classData.schedules.filter(s => s.day === todayName).length;

    if (scheduledSlotsForToday === 0) {
      toast.error(`This class is not scheduled for today (${todayName}).`);
      return;
    }

    // Validate check-in count for this class today
    const checkInsForThisClassToday = checkIns.filter(ci => ci.coach_id === classCheckInCoach.id && ci.class_id === selectedClassId).length;
    if (checkInsForThisClassToday >= scheduledSlotsForToday) {
      toast.error(`Coach has already checked in ${checkInsForThisClassToday} time(s) for this class today (Max: ${scheduledSlotsForToday}).`);
      return;
    }

    checkInMutation.mutate({ coachId: classCheckInCoach.id, classId: selectedClassId }, {
      onSuccess: () => {
        toast.success(`${classCheckInCoach.name} checked in`);
        setClassCheckInCoach(null);
      },
      onError: (err) => {
        toast.error(`Failed to check in: ${err.message}`);
      }
    });
  };

  const openAdd = () => { setForm(emptyForm); setEditCoach(null); setShowCoachDialog(true); };
  const openEdit = (c: Coach) => {
    setEditCoach(c);
    setForm({ name: c.name, phone: c.phone || "", paymentType: c.payment_type as "salary" | "per_session", rate: String(c.rate) });
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
          rate: Number(form.rate)
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
          <Button data-testid="btn-coach-checkin-modal" onClick={() => setCheckInModal(true)} className="gap-2">
            <CheckCircle2 className="w-4 h-4" /> Check-In
          </Button>
        </div>
      </div>



      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {coaches.filter(c => c.name.toLowerCase().includes(mainCoachSearch.toLowerCase()) || (c.phone && c.phone.includes(mainCoachSearch))).map(coach => {
          const stats = calculateCoachPayroll(coach, new Date().getMonth(), new Date().getFullYear(), classes, checkInsThisMonth, monthlyRevenue, newMembersThisMonth);
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
                    </div>
                  )}
                </div>
                
                  <div className="grid grid-cols-2 gap-2">
                    <div className="p-2.5 rounded-lg bg-muted/50 text-center flex flex-col justify-center">
                      <p className="text-lg font-bold">{stats.scheduledSlotsInMonth}</p>
                      <p className="text-xs text-muted-foreground">Expected Slots</p>
                    </div>
                    <div className="p-2.5 rounded-lg bg-muted/50 text-center flex flex-col justify-center">
                      <p className="text-lg font-bold">{stats.attendedSessions}</p>
                      <p className="text-xs text-muted-foreground">Attended Slots</p>
                    </div>
                  </div>

                <div className="p-3 rounded-lg border bg-card">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2"><DollarSign className="w-4 h-4 text-primary" /><span className="text-sm font-medium">Monthly Payroll</span></div>
                    <span className="text-base font-bold">{stats.calculatedAmount.toLocaleString()} EGP</span>
                  </div>
                  {stats.missedSessions > 0 && coach.payment_type === 'salary' && (
                    <div className="text-xs text-red-500 font-semibold mt-1">
                      Deducted {Math.round(stats.deduction).toLocaleString()} EGP for {stats.missedSessions} missed session(s)
                    </div>
                  )}
                  {coach.payment_type === 'per_session' && stats.missedSessions === 0 && <p className="text-xs text-muted-foreground mt-1">{sessions} sessions × {coach.rate} EGP</p>}
                </div>
                <Button data-testid={`btn-checkin-coach-${coach.id}`} variant="outline" size="sm" className="w-full gap-2" onClick={() => openClassCheckIn(coach)}>
                  <Dumbbell className="w-3.5 h-3.5" /> Check In for Today
                </Button>
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
              const stats = calculateCoachPayroll(coach, new Date().getMonth(), new Date().getFullYear(), classes, checkInsThisMonth, monthlyRevenue, newMembersThisMonth);
              return (
                <div key={coach.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium">{coach.name}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${paymentTypeColors[coach.payment_type]}`}>{paymentTypeLabels[coach.payment_type]}</span>
                  </div>
                  <span className="text-sm font-bold">{stats.calculatedAmount.toLocaleString()} EGP</span>
                </div>
              );
            })}
            <div className="flex items-center justify-between py-2 pt-3">
              <span className="text-sm font-bold">Total Payroll</span>
              <span className="text-base font-bold text-primary">
                {coaches.reduce((s, c) => s + calculateCoachPayroll(c, new Date().getMonth(), new Date().getFullYear(), classes, checkInsThisMonth, monthlyRevenue, newMembersThisMonth).calculatedAmount, 0).toLocaleString()} EGP
              </span>
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
                return (
                  <div key={c.id} className="flex items-center justify-between p-3 rounded-lg border bg-card">
                  <div><p className="font-medium">{c.name}</p><p className="text-xs text-muted-foreground">{paymentTypeLabels[c.payment_type]}</p></div>
                  <Button data-testid={`btn-modal-checkin-coach-${c.id}`} size="sm" onClick={() => openClassCheckIn(c)}>Check In</Button>
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

      <Dialog open={!!classCheckInCoach} onOpenChange={(o) => !o && setClassCheckInCoach(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Check In: {classCheckInCoach?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Select Class</Label>
              <Select value={selectedClassId} onValueChange={setSelectedClassId}>
                <SelectTrigger><SelectValue placeholder="Select a class" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">General Check-In (No specific class)</SelectItem>
                  {classCheckInCoach && classes.filter(c => c.coach_id === classCheckInCoach.id).map(cls => (
                    <SelectItem key={cls.id} value={cls.id}>
                      {cls.name} ({cls.sport_name})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setClassCheckInCoach(null)}>Cancel</Button>
            <Button onClick={submitCheckIn} disabled={checkInMutation.isPending}>Submit Check-In</Button>
          </DialogFooter>
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
              <Select value={form.paymentType} onValueChange={(v: "salary" | "per_session") => setForm(p => ({ ...p, paymentType: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="salary">Monthly Salary</SelectItem>
                  <SelectItem value="per_session">Per Session</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{form.paymentType === 'salary' ? 'Monthly Rate (EGP)' : 'Rate per Session (EGP)'}</Label>
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
