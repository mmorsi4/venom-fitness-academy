import { useState, useMemo } from "react";
import {
  Users, Plus, Pencil, Trash2, Clock, AlertTriangle, ChevronDown,
  DollarSign, Calendar, Shield
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle
} from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  useEmployees, useCreateEmployee, useUpdateEmployee, useDeleteEmployee,
  useEmployeeCheckIns, useCreateEmployeeCheckIn,
  useEmployeeDeductions, useCreateEmployeeDeduction,
  useUpdateEmployeeCheckInTime, useDeleteEmployeeCheckIn
} from "@/hooks/use-data";
import { useAuth } from "@/lib/auth";
import type { Employee } from "@/lib/types";
import { toast } from "sonner";
import { format, differenceInMinutes, parseISO } from "date-fns";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const DEPARTMENTS = ["Reception", "Sales", "Cleaning", "Security", "Management", "Other"];

const emptyForm = {
  name: "", phone: "", department: "Reception", rate: "",
  workDays: [] as string[], shiftStart: "09:00", shiftEnd: "17:00",
  lateThresholdMinutes: "15", deductionPerMinute: "0", missedDayDeduction: "0", user_id: ""
};

function empToForm(e: Employee) {
  return {
    name: e.name, phone: e.phone, department: e.department, rate: String(e.rate),
    workDays: [...e.work_days], shiftStart: e.shift_start || "09:00",
    shiftEnd: e.shift_end || "17:00",
    lateThresholdMinutes: String(e.late_threshold_minutes),
    deductionPerMinute: String(e.deduction_per_minute),
    missedDayDeduction: String(e.missed_day_deduction || 0),
    user_id: e.user_id || "",
  };
}

export default function Employees() {
  const { isAdmin, users } = useAuth();
  const { data: employees = [] } = useEmployees();
  const createEmployee = useCreateEmployee();
  const updateEmployee = useUpdateEmployee();
  const deleteEmployee = useDeleteEmployee();
  const { data: allCheckIns = [] } = useEmployeeCheckIns(
    new Date().getMonth(), new Date().getFullYear()
  );
  const { data: allDeductions = [] } = useEmployeeDeductions();
  const createCheckIn = useCreateEmployeeCheckIn();
  const createDeduction = useCreateEmployeeDeduction();
  const updateEmployeeCheckInTime = useUpdateEmployeeCheckInTime();
  const deleteEmployeeCheckIn = useDeleteEmployeeCheckIn();

  const [tab, setTab] = useState("directory");
  const [editingLogId, setEditingLogId] = useState<string | null>(null);
  const [editLogTime, setEditLogTime] = useState("");
  const [editLogOutTime, setEditLogOutTime] = useState("");
  const [showDialog, setShowDialog] = useState(false);
  const [editEmp, setEditEmp] = useState<Employee | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [confirmDelete, setConfirmDelete] = useState<Employee | null>(null);
  const [search, setSearch] = useState("");

  // HR Check-in state
  const [hrSearch, setHrSearch] = useState("");
  const [hrPin, setHrPin] = useState("");

  // Deduction dialog
  const [deductionEmp, setDeductionEmp] = useState<Employee | null>(null);
  const [deductionForm, setDeductionForm] = useState({ amount: "", reason: "" });

  const openCreate = () => { setForm(emptyForm); setEditEmp(null); setShowDialog(true); };
  const openEdit = (e: Employee) => { setEditEmp(e); setForm(empToForm(e)); setShowDialog(true); };
  const closeDialog = () => { setShowDialog(false); setEditEmp(null); };

  const toggleWorkDay = (day: string) => {
    setForm(p => ({
      ...p,
      workDays: p.workDays.includes(day) ? p.workDays.filter(d => d !== day) : [...p.workDays, day]
    }));
  };

  const handleSave = () => {
    if (!form.name.trim()) { toast.error("Name is required"); return; }
    const payload = {
      name: form.name.trim(), phone: form.phone.trim(), department: form.department,
      rate: Number(form.rate) || 0, work_days: form.workDays,
      shift_start: form.shiftStart || null, shift_end: form.shiftEnd || null,
      late_threshold_minutes: form.lateThresholdMinutes === "" ? 15 : Number(form.lateThresholdMinutes),
      deduction_per_minute: form.deductionPerMinute === "" ? 0 : Number(form.deductionPerMinute),
      missed_day_deduction: form.missedDayDeduction === "" ? 0 : Number(form.missedDayDeduction),
      user_id: form.user_id || null,
    };
    if (editEmp) {
      updateEmployee.mutate({ id: editEmp.id, updates: payload }, {
        onSuccess: () => { toast.success("Employee updated"); closeDialog(); },
        onError: (e) => toast.error(`Error: ${e.message}`)
      });
    } else {
      createEmployee.mutate(payload, {
        onSuccess: () => { toast.success("Employee added"); closeDialog(); },
        onError: (e) => toast.error(`Error: ${e.message}`)
      });
    }
  };

  const handleAddDeduction = () => {
    if (!deductionEmp || !deductionForm.amount || !deductionForm.reason) {
      toast.error("Amount and reason are required"); return;
    }
    createDeduction.mutate({
      employee_id: deductionEmp.id,
      amount: Number(deductionForm.amount),
      reason: deductionForm.reason,
    }, {
      onSuccess: () => {
        toast.success("Deduction recorded");
        setDeductionEmp(null);
        setDeductionForm({ amount: "", reason: "" });
      },
      onError: (e) => toast.error(`Error: ${e.message}`)
    });
  };

  const filteredEmployees = employees.filter(e =>
    e.name.toLowerCase().includes(search.toLowerCase()) ||
    e.department.toLowerCase().includes(search.toLowerCase())
  );

  const todayName = DAYS[new Date().getDay()];
  const checkedInToday = allCheckIns.filter(ci => {
    const d = new Date(ci.checked_in_at || ci.check_in_time || ci.created_at || "");
    const today = new Date();
    return d.getDate() === today.getDate() && d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
  });

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Employees</h1>
          <p className="text-sm text-muted-foreground">
            {employees.length} employees · {checkedInToday.length} checked in today
          </p>
        </div>
        <div className="flex gap-2">
          {isAdmin && (
            <Button variant="outline" onClick={openCreate} className="gap-2">
              <Plus className="w-4 h-4" /> Add Employee
            </Button>
          )}
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="directory">Directory</TabsTrigger>
            <TabsTrigger value="log">Attendance & Deductions</TabsTrigger>
          </TabsList>
      </Tabs>

      {/* ── Directory Tab ── */}
      {tab === "directory" && (
        <div className="space-y-4">
          <Input
            placeholder="Search by name or department..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="max-w-sm"
          />
          {filteredEmployees.length === 0 ? (
            <Card><CardContent className="py-12 text-center text-muted-foreground">No employees found</CardContent></Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredEmployees.map(emp => {
                const empDeductions = allDeductions.filter(d => d.employee_id === emp.id);
                const totalDeductions = empDeductions.reduce((s, d) => s + d.amount, 0);
                const lateDeductions = allCheckIns
                  .filter(ci => ci.employee_id === emp.id)
                  .reduce((s, ci) => s + (ci.deduction || 0), 0);

                let missedDays = 0;
                const today = new Date();
                for (let d = 1; d < today.getDate(); d++) {
                  const checkDate = new Date(today.getFullYear(), today.getMonth(), d);
                  const dayName = DAYS[checkDate.getDay()];
                  if (emp.work_days.includes(dayName)) {
                    const checkedIn = allCheckIns.some(ci => {
                      const cid = new Date(ci.checked_in_at || ci.check_in_time || ci.created_at || "");
                      return cid.getDate() === d && ci.employee_id === emp.id;
                    });
                    if (!checkedIn) missedDays++;
                  }
                }
                const missedDaysDeductionTotal = missedDays * (emp.missed_day_deduction || 0);

                const netSalary = emp.rate - totalDeductions - lateDeductions - missedDaysDeductionTotal;
                const checkedInThisMonth = allCheckIns.filter(ci => ci.employee_id === emp.id).length;
                const workingToday = emp.work_days.includes(todayName);
                const checkedInTodayEmp = checkedInToday.some(ci => ci.employee_id === emp.id);

                return (
                  <Card key={emp.id} className={`relative ${!workingToday ? 'opacity-70' : ''}`}>
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                            <span className="text-sm font-bold text-primary">{emp.name.charAt(0)}</span>
                          </div>
                          <div>
                            <p className="font-semibold text-foreground">{emp.name}</p>
                            <p className="text-xs text-muted-foreground">{emp.department}</p>
                          </div>
                        </div>
                        <div className="flex gap-1">
                          {checkedInTodayEmp && (
                            <Badge className="text-xs bg-emerald-100 text-emerald-700 border-emerald-200">✓ In</Badge>
                          )}
                          {workingToday && !checkedInTodayEmp && (
                            <Badge variant="outline" className="text-xs text-amber-600 border-amber-300">Expected</Badge>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="p-2 rounded-lg bg-muted/50">
                          <p className="font-semibold text-foreground">{emp.rate.toLocaleString()} EGP</p>
                          <p className="text-muted-foreground">Monthly Salary</p>
                        </div>
                        <div className="p-2 rounded-lg bg-muted/50">
                          <p className="font-semibold text-emerald-700">{Math.max(0, netSalary).toLocaleString()} EGP</p>
                          <p className="text-muted-foreground">Net This Month</p>
                        </div>
                        <div className="p-2 rounded-lg bg-muted/50">
                          <p className="font-semibold text-foreground">{checkedInThisMonth}</p>
                          <p className="text-muted-foreground">Days Attended</p>
                        </div>
                        <div className="p-2 rounded-lg bg-muted/50">
                          <p className="font-semibold text-red-600">{(totalDeductions + lateDeductions + missedDaysDeductionTotal).toLocaleString()} EGP</p>
                          <p className="text-muted-foreground">Deductions</p>
                        </div>
                      </div>

                      {missedDays > 0 && (
                        <div className="text-xs text-red-600 mt-2">
                          <AlertTriangle className="inline w-3 h-3 mr-1" />
                          Missed {missedDays} days (-{missedDaysDeductionTotal} EGP)
                        </div>
                      )}

                      <div className="flex flex-wrap gap-1">
                        {DAYS.map(d => (
                          <span
                            key={d}
                            className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                              emp.work_days.includes(d)
                                ? 'bg-primary/10 text-primary'
                                : 'bg-muted text-muted-foreground/50'
                            }`}
                          >
                            {d.slice(0, 2)}
                          </span>
                        ))}
                      </div>

                      {emp.shift_start && emp.shift_end && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="w-3 h-3" />
                          <span>{emp.shift_start} – {emp.shift_end}</span>
                          {emp.late_threshold_minutes > 0 && (
                            <span className="text-amber-600 ml-1">· {emp.late_threshold_minutes}min grace</span>
                          )}
                        </div>
                      )}

                      {isAdmin && (
                        <div className="flex gap-2 pt-1">
                          <Button variant="outline" size="sm" className="flex-1 h-7 text-xs" onClick={() => openEdit(emp)}>
                            <Pencil className="w-3 h-3 mr-1" /> Edit
                          </Button>
                          <Button variant="outline" size="sm" className="flex-1 h-7 text-xs text-amber-600" onClick={() => setDeductionEmp(emp)}>
                            <DollarSign className="w-3 h-3 mr-1" /> Deduct
                          </Button>
                          <Button variant="outline" size="sm" className="h-7 w-7 p-0 text-red-600" onClick={() => setConfirmDelete(emp)}>
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Log Tab ── */}
      {tab === "log" && (
        <div className="space-y-3">
          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full text-sm text-left">
                  <thead className="bg-muted/50 border-b">
                    <tr>
                      <th className="p-3 font-medium text-muted-foreground">Employee</th>
                      <th className="p-3 font-medium text-muted-foreground">Department</th>
                      <th className="p-3 font-medium text-muted-foreground">Time In</th>
                      <th className="p-3 font-medium text-muted-foreground">Time Out</th>
                      <th className="p-3 font-medium text-muted-foreground">Status</th>
                      <th className="p-3 font-medium text-muted-foreground">Deduction</th>
                      <th className="p-3 font-medium text-muted-foreground text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {allCheckIns.length === 0 ? (
                      <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">No check-ins this month</td></tr>
                    ) : allCheckIns.map(ci => {
                      const emp = employees.find(e => e.id === ci.employee_id);
                      return (
                        <tr key={ci.id} className="hover:bg-muted/30">
                          <td className="p-3 font-medium">{emp?.name ?? "—"}</td>
                          <td className="p-3 text-muted-foreground">{emp?.department ?? "—"}</td>
                          <td className="p-3">
                            {editingLogId === ci.id ? (
                              <Input 
                                type="datetime-local" 
                                value={editLogTime} 
                                onChange={e => setEditLogTime(e.target.value)} 
                                className="h-8 text-xs max-w-[200px]" 
                              />
                            ) : (
                              format(new Date(ci.checked_in_at || ci.check_in_time || ci.created_at || ""), "dd MMM yyyy HH:mm")
                            )}
                          </td>
                          <td className="p-3">
                            {editingLogId === ci.id ? (
                              <Input 
                                type="datetime-local" 
                                value={editLogOutTime} 
                                onChange={e => setEditLogOutTime(e.target.value)} 
                                className="h-8 text-xs max-w-[200px]" 
                              />
                            ) : (
                              ci.check_out_time ? format(new Date(ci.check_out_time), "dd MMM yyyy HH:mm") : "—"
                            )}
                          </td>
                          <td className="p-3">
                            {(ci.late_minutes || 0) > 0 ? (
                              <Badge variant="outline" className="text-amber-600 border-amber-300 text-xs">
                                {(ci.late_minutes || 0)} min late
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-emerald-600 border-emerald-300 text-xs">On time</Badge>
                            )}
                          </td>
                          <td className="p-3 text-red-600">{(ci.deduction || 0) > 0 ? `${(ci.deduction || 0).toFixed(0)} EGP` : "—"}</td>
                          <td className="p-3 text-right">
                            {editingLogId === ci.id ? (
                              <div className="flex justify-end gap-1">
                                <Button size="sm" onClick={() => {
                                  updateEmployeeCheckInTime.mutate({ 
                                    id: ci.id, 
                                    checkInTime: new Date(editLogTime).toISOString(),
                                    checkOutTime: editLogOutTime ? new Date(editLogOutTime).toISOString() : undefined
                                  });
                                  setEditingLogId(null);
                                }}>Save</Button>
                                <Button size="sm" variant="ghost" onClick={() => setEditingLogId(null)}>Cancel</Button>
                              </div>
                            ) : (
                              <div className="flex justify-end gap-1">
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => { 
                                  setEditingLogId(ci.id); 
                                  setEditLogTime(format(new Date(ci.checked_in_at || ci.check_in_time || ci.created_at || ""), "yyyy-MM-dd'T'HH:mm")); 
                                  setEditLogOutTime(ci.check_out_time ? format(new Date(ci.check_out_time), "yyyy-MM-dd'T'HH:mm") : "");
                                }}>
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:bg-destructive/10" onClick={() => {
                                  if(confirm("Are you sure you want to delete this check-in?")) {
                                    deleteEmployeeCheckIn.mutate(ci.id);
                                  }
                                }}>
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Create / Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={o => !o && closeDialog()}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editEmp ? `Edit: ${editEmp.name}` : "Add Employee"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2 max-h-[72vh] overflow-y-auto pr-1">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Full Name *</Label>
                <Input placeholder="Name" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Phone</Label>
                <Input placeholder="Phone" value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Department</Label>
                <select
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                  value={form.department}
                  onChange={e => setForm(p => ({ ...p, department: e.target.value }))}
                >
                  {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>Monthly Salary (EGP)</Label>
                <Input type="number" placeholder="e.g. 3000" value={form.rate} onChange={e => setForm(p => ({ ...p, rate: e.target.value }))} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Linked App Account (Optional)</Label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                value={form.user_id}
                onChange={e => setForm(p => ({ ...p, user_id: e.target.value }))}
              >
                <option value="">-- No Account Linked --</option>
                {users.map(u => (
                  <option key={u.id} value={u.id}>{u.name} ({u.email})</option>
                ))}
              </select>
              <p className="text-[10px] text-muted-foreground">Allows the employee to log in and use their account.</p>
            </div>

            <div className="space-y-1.5">
              <Label>Work Days</Label>
              <div className="flex flex-wrap gap-2">
                {DAYS.map(d => (
                  <button
                    key={d}
                    onClick={() => toggleWorkDay(d)}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                      form.workDays.includes(d)
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-card hover:bg-accent border-input'
                    }`}
                  >
                    {d.slice(0, 3)}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Shift Start</Label>
                <Input type="time" value={form.shiftStart} onChange={e => setForm(p => ({ ...p, shiftStart: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Shift End</Label>
                <Input type="time" value={form.shiftEnd} onChange={e => setForm(p => ({ ...p, shiftEnd: e.target.value }))} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Late Grace (mins)</Label>
                <Input
                  type="number"
                  value={form.lateThresholdMinutes}
                  onChange={e => setForm({ ...form, lateThresholdMinutes: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Deduct per late min</Label>
                <Input
                  type="number"
                  value={form.deductionPerMinute}
                  onChange={e => setForm({ ...form, deductionPerMinute: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Deduction per missed day (EGP)</Label>
              <Input
                type="number"
                value={form.missedDayDeduction}
                onChange={e => setForm({ ...form, missedDayDeduction: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Cancel</Button>
            <Button onClick={handleSave} disabled={createEmployee.isPending || updateEmployee.isPending}>
              {editEmp ? "Save Changes" : "Add Employee"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manual Deduction Dialog */}
      <Dialog open={!!deductionEmp} onOpenChange={o => !o && setDeductionEmp(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Manual Deduction — {deductionEmp?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Amount (EGP)</Label>
              <Input type="number" placeholder="e.g. 200" value={deductionForm.amount}
                onChange={e => setDeductionForm(p => ({ ...p, amount: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Reason</Label>
              <Textarea placeholder="Reason for deduction..." value={deductionForm.reason}
                onChange={e => setDeductionForm(p => ({ ...p, reason: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeductionEmp(null)}>Cancel</Button>
            <Button onClick={handleAddDeduction} className="bg-red-600 hover:bg-red-700 text-white">
              Record Deduction
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <AlertDialog open={!!confirmDelete} onOpenChange={o => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {confirmDelete?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the employee and all their records.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => {
                if (!confirmDelete) return;
                deleteEmployee.mutate(confirmDelete.id, {
                  onSuccess: () => { toast.success("Employee deleted"); setConfirmDelete(null); },
                  onError: (e) => toast.error(`Error: ${e.message}`)
                });
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
