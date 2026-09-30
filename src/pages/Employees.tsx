import { useState, useMemo } from "react";
import {
  Users, Plus, Pencil, Trash2, Clock, AlertTriangle, ChevronDown,
  DollarSign, Calendar, Shield, Search, CheckCircle2, RotateCcw,
  Settings, Check
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
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
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import {
  useEmployees, useCreateEmployee, useUpdateEmployee, useDeleteEmployee,
  useEmployeeCheckIns, useCreateEmployeeCheckIn,
  useEmployeeDeductions, useCreateEmployeeDeduction, useDeleteEmployeeDeduction,
  useUpdateEmployeeCheckInTime, useDeleteEmployeeCheckIn, useWaiveEmployeeCheckInDeduction,
  useCreateExpense
} from "@/hooks/use-data";
import { useAuth } from "@/lib/auth";
import type { Employee, PaymentMethod } from "@/lib/types";
import { toast } from "sonner";
import { format, differenceInMinutes, parseISO } from "date-fns";
import { formatTo12Hour } from "@/lib/utils";
import { DAYS_OF_WEEK } from "@/lib/constants";

const DEPARTMENTS = ["Reception", "Sales", "Cleaning", "Security", "Management", "Other"];

const emptyForm = {
  name: "",
  phone: "",
  department: "Reception",
  rate: "",
  workDays: ["Saturday", "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday"] as string[],
  shiftStart: "09:00",
  shiftEnd: "17:00",
  lateThresholdMinutes: "15",
  deduction15mDays: "0.25",
  deduction20mDays: "0.5",
  deduction30mPlusDays: "1",
  workDaysPerMonth: "26",
  deductionPerMinute: "0",
  missedDayDeduction: "1",
  user_id: "",
  status: "active" as "active" | "inactive"
};

function empToForm(e: Employee) {
  return {
    name: e.name,
    phone: e.phone,
    department: e.department || "Reception",
    rate: String(e.rate ?? 0),
    workDays: Array.isArray(e.work_days) && e.work_days.length > 0 ? [...e.work_days] : ["Saturday", "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday"],
    shiftStart: e.shift_start || "09:00",
    shiftEnd: e.shift_end || "17:00",
    lateThresholdMinutes: String(e.late_threshold_minutes ?? 15),
    deduction15mDays: String((e as any).deduction_15m_days ?? 0.25),
    deduction20mDays: String((e as any).deduction_20m_days ?? 0.5),
    deduction30mPlusDays: String((e as any).deduction_30m_plus_days ?? 1),
    workDaysPerMonth: String((e as any).work_days_per_month ?? 26),
    deductionPerMinute: String(e.deduction_per_minute ?? 0),
    missedDayDeduction: String(e.missed_day_deduction ?? 1),
    user_id: e.user_id || "",
    status: (e as any).status || "active" as "active" | "inactive"
  };
}

export default function Employees() {
  const { isAdmin, users } = useAuth();
  const { data: employees = [] } = useEmployees();
  const createEmployee = useCreateEmployee();
  const updateEmployee = useUpdateEmployee();
  const deleteEmployee = useDeleteEmployee();

  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  const { data: allCheckIns = [] } = useEmployeeCheckIns(selectedMonth, selectedYear);
  const { data: allDeductions = [] } = useEmployeeDeductions();
  const createCheckIn = useCreateEmployeeCheckIn();
  const createDeduction = useCreateEmployeeDeduction();
  const deleteDeduction = useDeleteEmployeeDeduction();
  const waiveCheckInDeduction = useWaiveEmployeeCheckInDeduction();
  const createExpense = useCreateExpense();
  const updateEmployeeCheckInTime = useUpdateEmployeeCheckInTime();
  const deleteEmployeeCheckIn = useDeleteEmployeeCheckIn();

  const [deductionsModalEmp, setDeductionsModalEmp] = useState<Employee | null>(null);

  const [tab, setTab] = useState("directory");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // Employee Edit/Add Dialog
  const [showDialog, setShowDialog] = useState(false);
  const [editEmp, setEditEmp] = useState<Employee | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [confirmDelete, setConfirmDelete] = useState<Employee | null>(null);

  // Quick Check-in state
  const [checkInSearch, setCheckInSearch] = useState("");

  // Manual Deduction Dialog
  const [showManualDeduction, setShowManualDeduction] = useState(false);
  const [manualDeductionForm, setManualDeductionForm] = useState({
    employee_id: "",
    amount: "",
    reason: "",
    date: format(new Date(), "yyyy-MM-dd")
  });

  // Payroll Settlement Dialog
  const [settlingEmployee, setSettlingEmployee] = useState<Employee | null>(null);
  const [settlementBonus, setSettlementBonus] = useState("0");
  const [settlementMethod, setSettlementMethod] = useState<PaymentMethod>("Cash");
  const [settlementNotes, setSettlementNotes] = useState("");

  const openCreate = () => {
    setForm(emptyForm);
    setEditEmp(null);
    setShowDialog(true);
  };

  const openEdit = (e: Employee) => {
    setEditEmp(e);
    setForm(empToForm(e));
    setShowDialog(true);
  };

  const closeDialog = () => {
    setShowDialog(false);
    setEditEmp(null);
  };

  const toggleWorkDay = (day: string) => {
    setForm(p => ({
      ...p,
      workDays: p.workDays.includes(day)
        ? p.workDays.filter(d => d !== day)
        : [...p.workDays, day]
    }));
  };

  const handleSave = () => {
    if (!form.name.trim()) {
      toast.error("Name is required");
      return;
    }
    const payload: any = {
      name: form.name.trim(),
      phone: form.phone.trim(),
      department: form.department,
      rate: Number(form.rate) || 0,
      work_days: form.workDays,
      shift_start: form.shiftStart || null,
      shift_end: form.shiftEnd || null,
      late_threshold_minutes: Number(form.lateThresholdMinutes) || 0,
      deduction_15m_days: Number(form.deduction15mDays) >= 0 ? Number(form.deduction15mDays) : 0.25,
      deduction_20m_days: Number(form.deduction20mDays) >= 0 ? Number(form.deduction20mDays) : 0.50,
      deduction_30m_plus_days: Number(form.deduction30mPlusDays) >= 0 ? Number(form.deduction30mPlusDays) : 1.00,
      work_days_per_month: Number(form.workDaysPerMonth) || 26,
      deduction_per_minute: Number(form.deductionPerMinute) || 0,
      missed_day_deduction: Number(form.missedDayDeduction) || 0,
      user_id: form.user_id || null,
      status: form.status
    };

    if (editEmp) {
      updateEmployee.mutate({ id: editEmp.id, updates: payload }, {
        onSuccess: () => {
          toast.success("Employee updated successfully");
          closeDialog();
        },
        onError: (e) => toast.error(`Error: ${e.message}`)
      });
    } else {
      createEmployee.mutate(payload, {
        onSuccess: () => {
          toast.success("Employee added successfully");
          closeDialog();
        },
        onError: (e) => toast.error(`Error: ${e.message}`)
      });
    }
  };

  const handleCreateManualDeduction = () => {
    if (!manualDeductionForm.employee_id || !manualDeductionForm.amount || !manualDeductionForm.reason.trim()) {
      toast.error("Please fill all required fields");
      return;
    }
    createDeduction.mutate({
      employee_id: manualDeductionForm.employee_id,
      amount: Number(manualDeductionForm.amount),
      reason: manualDeductionForm.reason.trim()
    }, {
      onSuccess: () => {
        toast.success("Deduction recorded successfully");
        setShowManualDeduction(false);
        setManualDeductionForm({
          employee_id: "",
          amount: "",
          reason: "",
          date: format(new Date(), "yyyy-MM-dd")
        });
      },
      onError: (e) => toast.error(`Error: ${e.message}`)
    });
  };

  const handleSettlePayroll = () => {
    if (!settlingEmployee) return;

    const empDeductions = allDeductions.filter(d => d.employee_id === settlingEmployee.id);
    const manualDeductionsTotal = empDeductions.reduce((s, d) => s + d.amount, 0);

    const empCheckIns = allCheckIns.filter(ci => ci.employee_id === settlingEmployee.id);
    const lateDeductionsTotal = empCheckIns.reduce((s, ci) => s + (ci.deduction || 0), 0);

    const bonus = Number(settlementBonus) || 0;
    const netSalary = Math.max(0, settlingEmployee.rate - manualDeductionsTotal - lateDeductionsTotal + bonus);

    const periodStr = format(new Date(selectedYear, selectedMonth, 1), "MMM yyyy");

    createExpense.mutate({
      category: "Staff Payroll",
      amount: netSalary,
      description: `Payroll settlement for ${settlingEmployee.name} (${periodStr})${bonus > 0 ? ` [Bonus: +${bonus} EGP]` : ''}${settlementNotes ? ` - ${settlementNotes}` : ''}`,
      date: new Date().toISOString(),
      payment_method: settlementMethod,
      liability_id: null,
      coach_id: null
    }, {
      onSuccess: () => {
        toast.success(`Paycheck settled for ${settlingEmployee.name} (${netSalary.toLocaleString()} EGP expensed in Accounting)`);
        setSettlingEmployee(null);
        setSettlementBonus("0");
        setSettlementNotes("");
      },
      onError: (e) => toast.error(`Settlement failed: ${e.message}`)
    });
  };

  const filteredEmployees = employees.filter(e => {
    const q = search.toLowerCase();
    const matchesQuery = e.name.toLowerCase().includes(q) ||
      e.phone.includes(q) ||
      (e.department && e.department.toLowerCase().includes(q));
    const empStatus = (e as any).status || "active";
    const matchesStatus = statusFilter === "all" || empStatus === statusFilter;
    return matchesQuery && matchesStatus;
  });

  const checkedInToday = allCheckIns.filter(ci => {
    const d = new Date(ci.checked_in_at || ci.check_in_time || ci.created_at || "");
    const today = new Date();
    return d.getDate() === today.getDate() && d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
  });

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Users className="w-6 h-6 text-primary" /> Employees & Attendance
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Manage staff members, attendance check-in, late deductions, and payroll settlements.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          {isAdmin && (
            <Button onClick={openCreate} className="gap-2">
              <Plus className="w-4 h-4" /> Add Employee
            </Button>
          )}
        </div>
      </div>

      {/* Navigation Tabs */}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="grid grid-cols-2 md:grid-cols-4 w-full md:w-auto">
          <TabsTrigger value="directory" className="gap-1.5">
            <Users className="w-4 h-4" /> Staff Directory ({employees.length})
          </TabsTrigger>
          <TabsTrigger value="self-checkin" className="gap-1.5">
            <Shield className="w-4 h-4" /> Self Check-In
          </TabsTrigger>
          <TabsTrigger value="deductions" className="gap-1.5">
            <Clock className="w-4 h-4" /> Deductions Log ({allDeductions.length})
          </TabsTrigger>
          <TabsTrigger value="payroll" className="gap-1.5">
            <DollarSign className="w-4 h-4" /> Payroll & Expense
          </TabsTrigger>
        </TabsList>

        {/* ── 1. Staff Directory Tab ── */}
        <TabsContent value="directory" className="space-y-4 mt-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, role, or phone..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9 h-10"
              />
            </div>
            <div className="flex items-center gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-36 h-10">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="rounded-xl border bg-card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Role / Title</TableHead>
                  <TableHead>Shift Hours</TableHead>
                  <TableHead>Base Salary</TableHead>
                  <TableHead>Status</TableHead>
                  {isAdmin && <TableHead className="w-[100px] text-right">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEmployees.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={isAdmin ? 6 : 5} className="py-12 text-center text-muted-foreground">
                      No employees found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredEmployees.map(emp => {
                    const isCheckedIn = checkedInToday.some(ci => ci.employee_id === emp.id);
                    const empStatus = (emp as any).status || "active";
                    const workDaysCount = (emp.work_days || []).length;

                    return (
                      <TableRow key={emp.id} className="hover:bg-muted/30">
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary text-sm flex-shrink-0">
                              {emp.name.charAt(0)}
                            </div>
                            <div>
                              <p className="font-semibold text-foreground text-sm">{emp.name}</p>
                              <p className="text-xs text-muted-foreground">{emp.phone}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm font-medium">
                          {emp.department || "Staff"}
                        </TableCell>
                        <TableCell>
                          <div className="text-xs space-y-0.5">
                            <p className="font-medium text-foreground">
                              {emp.shift_start && emp.shift_end
                                ? `${formatTo12Hour(emp.shift_start)} – ${formatTo12Hour(emp.shift_end)}`
                                : "Flexible"}
                            </p>
                            <p className="text-muted-foreground">
                              {workDaysCount > 0 ? `${workDaysCount * 4} days/mo` : "24 days/mo"}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-xs">
                            <p className="font-bold text-foreground text-sm">{(emp.rate || 0).toLocaleString()} EGP</p>
                            <p className="text-muted-foreground">Monthly</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={`capitalize text-xs font-semibold ${
                              empStatus === 'active'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : 'bg-muted text-muted-foreground border-muted-foreground/30'
                            }`}
                          >
                            {empStatus}
                          </Badge>
                          {isCheckedIn && (
                            <span className="ml-2 text-[10px] text-emerald-600 font-bold bg-emerald-100 px-1.5 py-0.5 rounded">
                              ✓ In Today
                            </span>
                          )}
                        </TableCell>
                        {isAdmin && (
                          <TableCell>
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setDeductionsModalEmp(emp)}
                                className="h-8 w-8 p-0 text-muted-foreground hover:text-red-600 hover:bg-red-50"
                                title="Manage deductions & penalties"
                              >
                                <Clock className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openEdit(emp)}
                                className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                                title="Edit employee details"
                              >
                                <Pencil className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setConfirmDelete(emp)}
                                className="h-8 w-8 p-0 text-muted-foreground hover:text-red-600 hover:bg-red-50"
                                title="Delete employee"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* ── 2. Self Check-In Tab ── */}
        <TabsContent value="self-checkin" className="space-y-4 mt-4">
          <div className="max-w-xl mx-auto space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Shield className="w-4 h-4 text-primary" /> Staff Attendance Check-In
                </CardTitle>
                <CardDescription>
                  Search your name or phone number to record check-in. Late deductions will apply automatically based on your shift settings.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Search Employee</Label>
                  <Input
                    placeholder="Enter staff name or phone..."
                    value={checkInSearch}
                    onChange={e => setCheckInSearch(e.target.value)}
                  />
                </div>

                {checkInSearch.trim().length > 0 && (
                  <div className="space-y-2 pt-2">
                    {employees
                      .filter(e => e.name.toLowerCase().includes(checkInSearch.toLowerCase()) || e.phone.includes(checkInSearch))
                      .map(emp => {
                        const isCheckedIn = checkedInToday.some(ci => ci.employee_id === emp.id);

                        const handleCheckInClick = () => {
                          const now = new Date();
                          let lateMinutes = 0;
                          let deduction = 0;

                          if (emp.shift_start) {
                            const [sh, sm] = emp.shift_start.split(':').map(Number);
                            const shiftStart = new Date(now);
                            shiftStart.setHours(sh, sm, 0, 0);
                            const diff = differenceInMinutes(now, shiftStart);
                            const threshold = emp.late_threshold_minutes ?? 15;
                            if (diff > threshold) {
                              const lateAfterGrace = diff - threshold;
                              lateMinutes = diff;

                              const workDays = (emp as any).work_days_per_month || 26;
                              const dailyRate = (emp.rate || 0) > 0 ? ((emp.rate || 0) / workDays) : 0;

                              let daysCut = 0;
                              let tierLabel = "";

                              if (lateAfterGrace <= 15) {
                                daysCut = (emp as any).deduction_15m_days !== undefined ? Number((emp as any).deduction_15m_days) : 0.25;
                                tierLabel = "1–15m after grace";
                              } else if (lateAfterGrace <= 20) {
                                daysCut = (emp as any).deduction_20m_days !== undefined ? Number((emp as any).deduction_20m_days) : 0.50;
                                tierLabel = "16–20m after grace";
                              } else {
                                daysCut = (emp as any).deduction_30m_plus_days !== undefined ? Number((emp as any).deduction_30m_plus_days) : 1.00;
                                tierLabel = "30+m after grace";
                              }

                              deduction = Math.round(daysCut * dailyRate);
                              notes = `Arrived ${diff}m late (${lateAfterGrace}m after grace). Deducted ${daysCut} day (${deduction} EGP) [${tierLabel}]`;
                            }
                          }

                          createCheckIn.mutate({
                            employee_id: emp.id,
                            checked_in_at: now.toISOString(),
                            late_minutes: lateMinutes,
                            deduction,
                            notes: lateMinutes > 0 ? notes : "On time"
                          }, {
                            onSuccess: () => {
                              toast.success(
                                lateMinutes > 0
                                  ? `${emp.name} checked in — ${lateMinutes}m late (${deduction} EGP deduction)`
                                  : `${emp.name} checked in on time!`
                              );
                              setCheckInSearch("");
                            },
                            onError: (e) => toast.error(`Check-in failed: ${e.message}`)
                          });
                        };

                        return (
                          <div key={emp.id} className="p-3 rounded-lg border bg-card flex items-center justify-between">
                            <div>
                              <p className="font-semibold text-sm">{emp.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {emp.department} · Shift: {emp.shift_start ? formatTo12Hour(emp.shift_start) : "Flexible"}
                              </p>
                            </div>
                            <Button
                              size="sm"
                              disabled={isCheckedIn || createCheckIn.isPending}
                              onClick={handleCheckInClick}
                              className={isCheckedIn ? "bg-emerald-600 text-white" : ""}
                            >
                              {isCheckedIn ? "✓ Checked In" : "Check In"}
                            </Button>
                          </div>
                        );
                      })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ── 3. Deductions Log Tab ── */}
        <TabsContent value="deductions" className="space-y-4 mt-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-foreground">Attendance & Manual Deductions</h2>
            {isAdmin && (
              <Button onClick={() => setShowManualDeduction(true)} variant="outline" className="gap-2">
                <Plus className="w-4 h-4 text-red-500" /> Record Manual Deduction
              </Button>
            )}
          </div>

          <div className="rounded-xl border bg-card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Staff</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Date & Time</TableHead>
                  <TableHead>Reason / Notes</TableHead>
                  {isAdmin && <TableHead className="text-right w-[110px]">Action</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {allDeductions.length === 0 && allCheckIns.filter(ci => (ci.deduction || 0) > 0).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={isAdmin ? 6 : 5} className="py-12 text-center text-muted-foreground">
                      No deductions recorded
                    </TableCell>
                  </TableRow>
                ) : (
                  <>
                    {/* Manual Deductions */}
                    {allDeductions.map(d => {
                      const emp = employees.find(e => e.id === d.employee_id);
                      return (
                        <TableRow key={d.id}>
                          <TableCell className="font-medium text-sm">
                            {emp?.name ?? "Unknown"}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 text-xs">
                              Manual Penalty
                            </Badge>
                          </TableCell>
                          <TableCell className="font-bold text-red-600 text-sm">
                            -{d.amount.toLocaleString()} EGP
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {format(new Date(d.created_at), "dd MMM yyyy hh:mm a")}
                          </TableCell>
                          <TableCell className="text-xs text-foreground">
                            {d.reason}
                          </TableCell>
                          {isAdmin && (
                            <TableCell className="text-right">
                              <Button
                                variant="ghost"
                                size="sm"
                                disabled={deleteDeduction.isPending}
                                onClick={() => {
                                  deleteDeduction.mutate(d.id, {
                                    onSuccess: () => toast.success(`Removed deduction of ${d.amount} EGP for ${emp?.name || 'employee'}`),
                                    onError: (err: any) => toast.error(`Error: ${err.message}`)
                                  });
                               }}
                                className="h-8 px-2.5 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 gap-1.5 font-medium"
                                title="Remove manual penalty"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>Remove</span>
                              </Button>
                            </TableCell>
                          )}
                        </TableRow>
                      );
                    })}

                    {/* Auto Late Deductions from Check-ins */}
                    {allCheckIns
                      .filter(ci => (ci.deduction || 0) > 0)
                      .map(ci => {
                        const emp = employees.find(e => e.id === ci.employee_id);
                        return (
                          <TableRow key={`late-${ci.id}`}>
                            <TableCell className="font-medium text-sm">
                              {emp?.name ?? "Unknown"}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-xs">
                                Late Arrival ({ci.late_minutes}m)
                              </Badge>
                            </TableCell>
                            <TableCell className="font-bold text-amber-600 text-sm">
                              -{(ci.deduction || 0).toLocaleString()} EGP
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {format(new Date(ci.checked_in_at || ci.check_in_time || ci.created_at || ""), "dd MMM yyyy hh:mm a")}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {ci.notes || `Arrived ${ci.late_minutes}m after shift grace period`}
                            </TableCell>
                            {isAdmin && (
                              <TableCell className="text-right">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  disabled={waiveCheckInDeduction.isPending}
                                  onClick={() => {
                                    waiveCheckInDeduction.mutate({
                                      id: ci.id,
                                      notes: (ci.notes ? `${ci.notes} | ` : '') + 'Late deduction waived by admin'
                                    }, {
                                      onSuccess: () => toast.success(`Waived late penalty of ${(ci.deduction || 0)} EGP for ${emp?.name || 'employee'}`),
                                      onError: (err: any) => toast.error(`Error: ${err.message}`)
                                    });
                                  }}
                                  className="h-8 px-2.5 text-xs text-amber-700 hover:text-amber-800 hover:bg-amber-50 gap-1.5 font-medium"
                                  title="Waive late penalty"
                                >
                                  <RotateCcw className="w-3.5 h-3.5" />
                                  <span>Waive</span>
                                </Button>
                              </TableCell>
                            )}
                          </TableRow>
                        );
                      })}
                  </>
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* ── 4. Payroll & Expense Tab ── */}
        <TabsContent value="payroll" className="space-y-4 mt-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Monthly Payroll Settlement</h2>
              <p className="text-xs text-muted-foreground">Review monthly attendance, deduct penalties, and expense payroll directly into Accounting.</p>
            </div>
            <div className="flex items-center gap-2">
              <Select value={selectedMonth.toString()} onValueChange={v => setSelectedMonth(Number(v))}>
                <SelectTrigger className="w-36 h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 12 }).map((_, i) => (
                    <SelectItem key={i} value={i.toString()}>
                      {format(new Date(2026, i, 1), "MMMM")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={selectedYear.toString()} onValueChange={v => setSelectedYear(Number(v))}>
                <SelectTrigger className="w-28 h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[2025, 2026, 2027].map(y => (
                    <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="rounded-xl border bg-card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Staff</TableHead>
                  <TableHead>Base Salary</TableHead>
                  <TableHead>Days Attended</TableHead>
                  <TableHead>Total Deductions</TableHead>
                  <TableHead>Net Payable</TableHead>
                  {isAdmin && <TableHead className="w-[140px] text-right">Action</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {employees.map(emp => {
                  const empDeductions = allDeductions.filter(d => d.employee_id === emp.id);
                  const manualTotal = empDeductions.reduce((s, d) => s + d.amount, 0);

                  const empCheckIns = allCheckIns.filter(ci => ci.employee_id === emp.id);
                  const lateTotal = empCheckIns.reduce((s, ci) => s + (ci.deduction || 0), 0);
                  const totalDeductions = manualTotal + lateTotal;

                  const netSalary = Math.max(0, emp.rate - totalDeductions);

                  return (
                    <TableRow key={emp.id}>
                      <TableCell>
                        <p className="font-semibold text-sm">{emp.name}</p>
                        <p className="text-xs text-muted-foreground">{emp.department}</p>
                      </TableCell>
                      <TableCell className="font-semibold text-sm">
                        {emp.rate.toLocaleString()} EGP
                      </TableCell>
                      <TableCell className="text-sm">
                        {empCheckIns.length} day(s)
                      </TableCell>
                      <TableCell className="text-sm font-semibold text-red-600">
                        {totalDeductions > 0 ? (
                          <button
                            type="button"
                            onClick={() => setDeductionsModalEmp(emp)}
                            className="underline hover:text-red-700 font-semibold cursor-pointer text-left"
                            title="Click to view and remove deductions for this employee"
                          >
                            -{totalDeductions.toLocaleString()} EGP
                          </button>
                        ) : (
                          <span className="text-muted-foreground">0 EGP</span>
                        )}
                      </TableCell>
                      <TableCell className="font-bold text-primary text-base">
                        {netSalary.toLocaleString()} EGP
                      </TableCell>
                      {isAdmin && (
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            onClick={() => {
                              setSettlingEmployee(emp);
                              setSettlementBonus("0");
                              setSettlementNotes("");
                            }}
                            className="h-8 text-xs font-semibold"
                          >
                            Settle Paycheck
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>

      {/* ── Add / Edit Employee Dialog ── */}
      <Dialog open={showDialog} onOpenChange={o => !o && closeDialog()}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editEmp ? `Edit Employee: ${editEmp.name}` : "Add New Employee"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2 max-h-[75vh] overflow-y-auto pr-1">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Full Name *</Label>
                <Input
                  placeholder="e.g. Samar Ahmed"
                  value={form.name}
                  onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Phone Number *</Label>
                <Input
                  placeholder="01000000000"
                  value={form.phone}
                  onChange={e => setForm(p => ({ ...p, phone: e.target.value }))}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Department / Role</Label>
                <Select value={form.department} onValueChange={v => setForm(p => ({ ...p, department: v }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DEPARTMENTS.map(d => (
                      <SelectItem key={d} value={d}>{d}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Monthly Salary (EGP) *</Label>
                <Input
                  type="number"
                  placeholder="5000"
                  value={form.rate}
                  onChange={e => setForm(p => ({ ...p, rate: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Work Days</Label>
              <div className="flex flex-wrap gap-1.5">
                {DAYS_OF_WEEK.map(d => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => toggleWorkDay(d)}
                    className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${
                      form.workDays.includes(d)
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-card hover:bg-muted border-border text-muted-foreground'
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
                <Input
                  type="time"
                  value={form.shiftStart}
                  onChange={e => setForm(p => ({ ...p, shiftStart: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Shift End</Label>
                <Input
                  type="time"
                  value={form.shiftEnd}
                  onChange={e => setForm(p => ({ ...p, shiftEnd: e.target.value }))}
                />
              </div>
            </div>

            {/* Check-In & Lateness Rules Settings (Per Day) */}
            <div className="p-3.5 rounded-xl bg-muted/40 border space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <Settings className="w-3.5 h-3.5 text-primary" /> Check-in & Deduction Settings
                </p>
                <Badge variant="outline" className="text-[10px] font-normal text-muted-foreground bg-background">
                  Day-based (per day)
                </Badge>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <div className="space-y-1">
                  <Label className="text-[11px] font-medium">Grace Period</Label>
                  <div className="relative">
                    <Input
                      type="number"
                      min="0"
                      value={form.lateThresholdMinutes}
                      onChange={e => setForm(p => ({ ...p, lateThresholdMinutes: e.target.value }))}
                      className="pr-9 h-8 text-xs"
                    />
                    <span className="absolute right-2 top-2 text-[10px] text-muted-foreground">min</span>
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-[11px] font-medium">1–15m after grace</Label>
                  <div className="relative">
                    <Input
                      type="number"
                      step="0.05"
                      min="0"
                      placeholder="0.25"
                      value={form.deduction15mDays}
                      onChange={e => setForm(p => ({ ...p, deduction15mDays: e.target.value }))}
                      className="pr-9 h-8 text-xs"
                    />
                    <span className="absolute right-2 top-2 text-[10px] text-muted-foreground">day</span>
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-[11px] font-medium">16–20m after grace</Label>
                  <div className="relative">
                    <Input
                      type="number"
                      step="0.05"
                      min="0"
                      placeholder="0.5"
                      value={form.deduction20mDays}
                      onChange={e => setForm(p => ({ ...p, deduction20mDays: e.target.value }))}
                      className="pr-9 h-8 text-xs"
                    />
                    <span className="absolute right-2 top-2 text-[10px] text-muted-foreground">day</span>
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-[11px] font-medium">30+m after grace</Label>
                  <div className="relative">
                    <Input
                      type="number"
                      step="0.05"
                      min="0"
                      placeholder="1.0"
                      value={form.deduction30mPlusDays}
                      onChange={e => setForm(p => ({ ...p, deduction30mPlusDays: e.target.value }))}
                      className="pr-9 h-8 text-xs"
                    />
                    <span className="absolute right-2 top-2 text-[10px] text-muted-foreground">day</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                <div className="space-y-1">
                  <Label className="text-[11px] font-medium">Missed Day Rate</Label>
                  <div className="relative">
                    <Input
                      type="number"
                      step="0.25"
                      min="0"
                      placeholder="1.0"
                      value={form.missedDayDeduction}
                      onChange={e => setForm(p => ({ ...p, missedDayDeduction: e.target.value }))}
                      className="pr-9 h-8 text-xs"
                    />
                    <span className="absolute right-2 top-2 text-[10px] text-muted-foreground">day</span>
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-[11px] font-medium">Working Days / Month</Label>
                  <div className="relative">
                    <Input
                      type="number"
                      min="1"
                      max="31"
                      placeholder="26"
                      value={form.workDaysPerMonth}
                      onChange={e => setForm(p => ({ ...p, workDaysPerMonth: e.target.value }))}
                      className="pr-10 h-8 text-xs"
                    />
                    <span className="absolute right-2 top-2 text-[10px] text-muted-foreground">days</span>
                  </div>
                </div>
              </div>

              {/* Live salary deduction preview */}
              {Number(form.rate) > 0 && (
                <div className="p-2.5 rounded-lg bg-background/80 border text-[11px] text-muted-foreground space-y-1.5 mt-1">
                  {(() => {
                    const salary = Number(form.rate) || 0;
                    const days = Number(form.workDaysPerMonth) || 26;
                    const dailyRate = Math.round(salary / days);
                    const t1 = Math.round((Number(form.deduction15mDays) || 0) * dailyRate);
                    const t2 = Math.round((Number(form.deduction20mDays) || 0) * dailyRate);
                    const t3 = Math.round((Number(form.deduction30mPlusDays) || 0) * dailyRate);
                    return (
                      <>
                        <div className="flex justify-between items-center font-semibold text-foreground">
                          <span>Daily Salary:</span>
                          <span>{salary.toLocaleString()} ÷ {days} days = <span className="text-primary font-bold">{dailyRate.toLocaleString()} EGP/day</span></span>
                        </div>
                        <div className="grid grid-cols-3 gap-1 pt-0.5 text-[10.5px]">
                          <div className="p-1 rounded bg-muted/40 text-center">
                            <span className="block text-[10px] text-muted-foreground">1–15m late:</span>
                            <span className="font-bold text-red-600">-{t1} EGP</span> <span className="text-[10px]">({form.deduction15mDays || 0}d)</span>
                          </div>
                          <div className="p-1 rounded bg-muted/40 text-center">
                            <span className="block text-[10px] text-muted-foreground">16–20m late:</span>
                            <span className="font-bold text-red-600">-{t2} EGP</span> <span className="text-[10px]">({form.deduction20mDays || 0}d)</span>
                          </div>
                          <div className="p-1 rounded bg-muted/40 text-center">
                            <span className="block text-[10px] text-muted-foreground">30+m late:</span>
                            <span className="font-bold text-red-600">-{t3} EGP</span> <span className="text-[10px]">({form.deduction30mPlusDays || 0}d)</span>
                          </div>
                        </div>
                      </>
                    );
                  })()}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v: any) => setForm(p => ({ ...p, status: v }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Linked Login Account</Label>
                <select
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-xs"
                  value={form.user_id}
                  onChange={e => setForm(p => ({ ...p, user_id: e.target.value }))}
                >
                  <option value="">-- No Linked Account --</option>
                  {users.map(u => (
                    <option key={u.id} value={u.id}>{u.name} ({u.email})</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Cancel</Button>
            <Button onClick={handleSave} disabled={createEmployee.isPending || updateEmployee.isPending}>
              {editEmp ? "Save Changes" : "Create Employee"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Manual Deduction Dialog ── */}
      <Dialog open={showManualDeduction} onOpenChange={setShowManualDeduction}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Record Manual Deduction</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label>Select Staff *</Label>
              <Select
                value={manualDeductionForm.employee_id}
                onValueChange={v => setManualDeductionForm(p => ({ ...p, employee_id: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose employee..." />
                </SelectTrigger>
                <SelectContent>
                  {employees.map(e => (
                    <SelectItem key={e.id} value={e.id}>{e.name} ({e.department})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Amount (EGP) *</Label>
                <Input
                  type="number"
                  placeholder="200"
                  value={manualDeductionForm.amount}
                  onChange={e => setManualDeductionForm(p => ({ ...p, amount: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Date</Label>
                <Input
                  type="date"
                  value={manualDeductionForm.date}
                  onChange={e => setManualDeductionForm(p => ({ ...p, date: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Reason / Note *</Label>
              <Textarea
                placeholder="Reason for penalty..."
                value={manualDeductionForm.reason}
                onChange={e => setManualDeductionForm(p => ({ ...p, reason: e.target.value }))}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowManualDeduction(false)}>Cancel</Button>
            <Button onClick={handleCreateManualDeduction} disabled={createDeduction.isPending} className="bg-red-600 hover:bg-red-700 text-white">
              Apply Deduction
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Payroll Settlement Dialog ── */}
      <Dialog open={!!settlingEmployee} onOpenChange={o => !o && setSettlingEmployee(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Settle Paycheck: {settlingEmployee?.name}</DialogTitle>
          </DialogHeader>
          {settlingEmployee && (() => {
            const empDeductions = allDeductions.filter(d => d.employee_id === settlingEmployee.id);
            const manualTotal = empDeductions.reduce((s, d) => s + d.amount, 0);

            const empCheckIns = allCheckIns.filter(ci => ci.employee_id === settlingEmployee.id);
            const lateTotal = empCheckIns.reduce((s, ci) => s + (ci.deduction || 0), 0);
            const totalDeductions = manualTotal + lateTotal;

            const bonus = Number(settlementBonus) || 0;
            const netSalary = Math.max(0, settlingEmployee.rate - totalDeductions + bonus);

            return (
              <div className="space-y-4 py-2">
                <div className="p-3.5 rounded-xl bg-muted/40 border space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Period:</span>
                    <span className="font-semibold">{format(new Date(selectedYear, selectedMonth, 1), "MMMM yyyy")}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Base Salary:</span>
                    <span className="font-semibold">{settlingEmployee.rate.toLocaleString()} EGP</span>
                  </div>
                  <div className="flex justify-between text-red-600">
                    <span>Attendance & Penalties ({empCheckIns.length} days):</span>
                    <span className="font-semibold">-{totalDeductions.toLocaleString()} EGP</span>
                  </div>
                  <div className="flex justify-between text-emerald-600">
                    <span>Bonus / Extra:</span>
                    <span className="font-semibold">+{bonus.toLocaleString()} EGP</span>
                  </div>
                  <div className="pt-2 border-t flex justify-between text-base font-bold text-foreground">
                    <span>Net Amount to Pay:</span>
                    <span className="text-primary text-lg">{netSalary.toLocaleString()} EGP</span>
                  </div>
                </div>

                {totalDeductions > 0 && (
                  <div className="space-y-1.5 p-3 rounded-xl bg-red-50/40 border border-red-200/50">
                    <p className="text-xs font-semibold text-red-800 flex items-center justify-between">
                      <span>Applied Deductions ({empDeductions.length + empCheckIns.filter(ci => (ci.deduction || 0) > 0).length})</span>
                      <span className="text-[10px] text-muted-foreground font-normal">Click to forgive/remove</span>
                    </p>
                    <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                      {empDeductions.map(d => (
                        <div key={d.id} className="flex items-center justify-between p-1.5 rounded-lg bg-white border border-red-100 text-xs shadow-xs">
                          <div className="truncate mr-2">
                            <span className="font-bold text-red-600">-{d.amount.toLocaleString()} EGP</span>
                            <span className="text-muted-foreground ml-1.5">({d.reason})</span>
                          </div>
                          {isAdmin && (
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={deleteDeduction.isPending}
                              onClick={() => {
                                deleteDeduction.mutate(d.id, {
                                  onSuccess: () => toast.success(`Removed deduction of ${d.amount} EGP`),
                                  onError: (e) => toast.error(`Error: ${e.message}`)
                                });
                              }}
                              className="h-6 px-2 text-[11px] text-red-600 hover:text-red-700 hover:bg-red-50 font-medium shrink-0"
                            >
                              <Trash2 className="w-3 h-3 mr-1" /> Remove
                            </Button>
                          )}
                        </div>
                      ))}
                      {empCheckIns.filter(ci => (ci.deduction || 0) > 0).map(ci => (
                        <div key={`ci-${ci.id}`} className="flex items-center justify-between p-1.5 rounded-lg bg-white border border-amber-100 text-xs shadow-xs">
                          <div className="truncate mr-2">
                            <span className="font-bold text-amber-600">-{(ci.deduction || 0).toLocaleString()} EGP</span>
                            <span className="text-muted-foreground ml-1.5">(Late {ci.late_minutes}m)</span>
                          </div>
                          {isAdmin && (
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={waiveCheckInDeduction.isPending}
                              onClick={() => {
                                waiveCheckInDeduction.mutate({
                                  id: ci.id,
                                  notes: (ci.notes ? `${ci.notes} | ` : '') + 'Waived in payroll settlement'
                                }, {
                                  onSuccess: () => toast.success(`Waived late penalty of ${(ci.deduction || 0)} EGP`),
                                  onError: (e) => toast.error(`Error: ${e.message}`)
                                });
                              }}
                              className="h-6 px-2 text-[11px] text-amber-700 hover:text-amber-800 hover:bg-amber-50 font-medium shrink-0"
                            >
                              <RotateCcw className="w-3 h-3 mr-1" /> Waive
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Bonus (EGP)</Label>
                    <Input
                      type="number"
                      value={settlementBonus}
                      onChange={e => setSettlementBonus(e.target.value)}
                      placeholder="0"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Payment Method</Label>
                    <Select value={settlementMethod} onValueChange={v => setSettlementMethod(v as PaymentMethod)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Cash">Cash</SelectItem>
                        <SelectItem value="Visa">Visa</SelectItem>
                        <SelectItem value="InstaPay">InstaPay</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label>Notes (Optional)</Label>
                  <Input
                    placeholder="e.g. Paid in full"
                    value={settlementNotes}
                    onChange={e => setSettlementNotes(e.target.value)}
                  />
                </div>

                <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2">
                  <DollarSign className="w-4 h-4 shrink-0 text-emerald-600" />
                  <span>This will automatically record an Expense under Staff Payroll in Accounting.</span>
                </div>
              </div>
            );
          })()}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSettlingEmployee(null)}>Cancel</Button>
            <Button onClick={handleSettlePayroll} disabled={createExpense.isPending} className="font-bold">
              Confirm & Settle Paycheck
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Employee Specific Deductions Modal ── */}
      <Dialog open={!!deductionsModalEmp} onOpenChange={o => !o && setDeductionsModalEmp(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Deductions & Adjustments: {deductionsModalEmp?.name}</DialogTitle>
          </DialogHeader>
          {deductionsModalEmp && (() => {
            const empDeductions = allDeductions.filter(d => d.employee_id === deductionsModalEmp.id);
            const manualTotal = empDeductions.reduce((s, d) => s + d.amount, 0);

            const empCheckIns = allCheckIns.filter(ci => ci.employee_id === deductionsModalEmp.id);
            const lateCheckIns = empCheckIns.filter(ci => (ci.deduction || 0) > 0);
            const lateTotal = lateCheckIns.reduce((s, ci) => s + (ci.deduction || 0), 0);
            const totalDeductions = manualTotal + lateTotal;

            return (
              <div className="space-y-4 py-2">
                <div className="p-3 rounded-xl bg-muted/40 border flex justify-between items-center text-sm">
                  <div>
                    <p className="font-semibold text-foreground">{deductionsModalEmp.name}</p>
                    <p className="text-xs text-muted-foreground">{deductionsModalEmp.department} • Base: {(deductionsModalEmp.rate || 0).toLocaleString()} EGP</p>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-muted-foreground block">Total Deductions</span>
                    <span className="font-bold text-red-600 text-base">-{totalDeductions.toLocaleString()} EGP</span>
                  </div>
                </div>

                {isAdmin && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full gap-2 border-dashed border-red-300 text-red-600 hover:bg-red-50 hover:text-red-700"
                    onClick={() => {
                      setManualDeductionForm({
                        employee_id: deductionsModalEmp.id,
                        amount: "",
                        reason: "",
                        date: new Date().toISOString().split("T")[0]
                      });
                      setShowManualDeduction(true);
                    }}
                  >
                    <Plus className="w-4 h-4" /> Add Manual Deduction
                  </Button>
                )}

                <div className="space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Applied Penalties & Deductions ({empDeductions.length + lateCheckIns.length})
                  </h4>

                  <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                    {empDeductions.length === 0 && lateCheckIns.length === 0 ? (
                      <div className="p-6 text-center text-muted-foreground text-xs border rounded-lg bg-card">
                        No deductions recorded for this staff member.
                      </div>
                    ) : (
                      <>
                        {empDeductions.map(d => (
                          <div key={d.id} className="flex items-center justify-between p-2.5 rounded-lg border bg-card hover:bg-muted/30">
                            <div>
                              <div className="flex items-center gap-1.5">
                                <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 text-[10px] px-1.5 py-0">
                                  Manual
                                </Badge>
                                <span className="font-bold text-red-600 text-sm">-{d.amount.toLocaleString()} EGP</span>
                              </div>
                              <p className="text-xs text-foreground mt-0.5">{d.reason}</p>
                              <p className="text-[10px] text-muted-foreground">{format(new Date(d.created_at), "dd MMM yyyy hh:mm a")}</p>
                            </div>
                            {isAdmin && (
                              <Button
                                size="sm"
                                variant="ghost"
                                disabled={deleteDeduction.isPending}
                                onClick={() => {
                                  deleteDeduction.mutate(d.id, {
                                    onSuccess: () => toast.success(`Removed deduction of ${d.amount} EGP`),
                                    onError: (e) => toast.error(`Error: ${e.message}`)
                                  });
                                }}
                                className="h-7 px-2 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 gap-1"
                                title="Remove deduction"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>Remove</span>
                              </Button>
                            )}
                          </div>
                        ))}

                        {lateCheckIns.map(ci => (
                          <div key={`ci-${ci.id}`} className="flex items-center justify-between p-2.5 rounded-lg border bg-card hover:bg-muted/30">
                            <div>
                              <div className="flex items-center gap-1.5">
                                <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-[10px] px-1.5 py-0">
                                  Late ({ci.late_minutes}m)
                                </Badge>
                                <span className="font-bold text-amber-600 text-sm">-{(ci.deduction || 0).toLocaleString()} EGP</span>
                              </div>
                              <p className="text-xs text-foreground mt-0.5">{ci.notes || "Late check-in arrival"}</p>
                              <p className="text-[10px] text-muted-foreground">
                                {format(new Date(ci.checked_in_at || ci.check_in_time || ci.created_at || ""), "dd MMM yyyy hh:mm a")}
                              </p>
                            </div>
                            {isAdmin && (
                              <Button
                                size="sm"
                                variant="ghost"
                                disabled={waiveCheckInDeduction.isPending}
                                onClick={() => {
                                  waiveCheckInDeduction.mutate({
                                    id: ci.id,
                                    notes: (ci.notes ? `${ci.notes} | ` : '') + 'Late deduction waived by admin'
                                  }, {
                                    onSuccess: () => toast.success(`Waived late penalty of ${(ci.deduction || 0)} EGP`),
                                    onError: (e) => toast.error(`Error: ${e.message}`)
                                  });
                                }}
                                className="h-7 px-2 text-xs text-amber-700 hover:text-amber-800 hover:bg-amber-50 gap-1"
                                title="Waive late penalty"
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                                <span>Waive</span>
                              </Button>
                            )}
                          </div>
                        ))}
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })()}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeductionsModalEmp(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirmation Dialog ── */}
      <AlertDialog open={!!confirmDelete} onOpenChange={o => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {confirmDelete?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove this employee and all their associated records.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => {
                if (!confirmDelete) return;
                deleteEmployee.mutate(confirmDelete.id, {
                  onSuccess: () => {
                    toast.success("Employee deleted");
                    setConfirmDelete(null);
                  },
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
