import { useState, useMemo } from "react";
import {
  Users, UserCheck, Clock, Settings, AlertTriangle, ShieldCheck,
  Plus, Search, DollarSign, CheckCircle2, RotateCcw, FileText,
  Calendar, ArrowRight, Trash2, Pencil, LogIn, LogOut, Check
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import {
  useEmployees, useCreateEmployee, useUpdateEmployee, useDeleteEmployee,
  useEmployeeLatenessRules, useUpdateEmployeeLatenessRules,
  useEmployeeAttendances, useCheckInEmployee, useCheckOutEmployee,
  useEmployeeDeductionLogs, useCreateEmployeeDeductionLog, useRevertEmployeeDeductionLog,
  useEmployeePayrollSettlements, useCreateEmployeePayrollSettlement,
  useCreateAuditLog
} from "@/hooks/use-data";
import { useAuth } from "@/lib/auth";
import type {
  Employee, EmployeeLatenessRules, EmployeeSalaryType,
  EmployeeStatus, PaymentMethod, DeductionType
} from "@/lib/types";
import { toast } from "sonner";
import { format, differenceInMinutes, parse } from "date-fns";

const emptyEmployeeForm = {
  name: "",
  email: "",
  phone: "",
  job_title: "Receptionist",
  salary_type: "monthly" as EmployeeSalaryType,
  base_salary: "",
  shift_start: "09:00",
  shift_end: "17:00",
  work_days_per_month: "26",
  status: "active" as EmployeeStatus,
};

export default function Employees() {
  const { currentUser } = useAuth();
  const isAdmin = currentUser?.role === "admin";

  // Data hooks
  const { data: employees = [] } = useEmployees();
  const { data: rules } = useEmployeeLatenessRules();
  const todayStr = format(new Date(), "yyyy-MM-dd");
  const { data: todayAttendances = [] } = useEmployeeAttendances(todayStr);
  const { data: allAttendances = [] } = useEmployeeAttendances();
  const { data: deductionLogs = [] } = useEmployeeDeductionLogs();
  const { data: settlements = [] } = useEmployeePayrollSettlements();

  // Mutations
  const createEmployeeMutation = useCreateEmployee();
  const updateEmployeeMutation = useUpdateEmployee();
  const deleteEmployeeMutation = useDeleteEmployee();
  const updateRulesMutation = useUpdateEmployeeLatenessRules();
  const checkInMutation = useCheckInEmployee();
  const checkOutMutation = useCheckOutEmployee();
  const createDeductionMutation = useCreateEmployeeDeductionLog();
  const revertDeductionMutation = useRevertEmployeeDeductionLog();
  const createSettlementMutation = useCreateEmployeePayrollSettlement();
  const createAuditLog = useCreateAuditLog();

  // UI States
  const [activeTab, setActiveTab] = useState("attendance");
  const [employeeQuery, setEmployeeQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // Dialogs
  const [showEmployeeModal, setShowEmployeeModal] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [employeeForm, setEmployeeForm] = useState(emptyEmployeeForm);
  const [confirmDelete, setConfirmDelete] = useState<Employee | null>(null);

  // Lateness Settings form
  const [rulesForm, setRulesForm] = useState({
    grace_period_minutes: rules?.grace_period_minutes ?? 15,
    deduction_15m_days: rules?.deduction_15m_days ?? 0.25,
    deduction_20m_days: rules?.deduction_20m_days ?? 0.50,
    deduction_30m_plus_days: rules?.deduction_30m_plus_days ?? 1.00,
  });

  // Manual Deduction Dialog
  const [showManualDeduction, setShowManualDeduction] = useState(false);
  const [manualDeductionForm, setManualDeductionForm] = useState({
    employee_id: "",
    deduction_type: "manual" as DeductionType,
    days_deducted: "0.5",
    reason: "",
    date: todayStr,
  });

  // Revert Deduction Dialog
  const [revertingDeductionId, setRevertingDeductionId] = useState<string | null>(null);
  const [revertReason, setRevertReason] = useState("");

  // Payroll Settlement Dialog
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [settlingEmployee, setSettlingEmployee] = useState<Employee | null>(null);
  const [settlementBonus, setSettlementBonus] = useState("0");
  const [settlementMethod, setSettlementMethod] = useState<PaymentMethod>("Cash");
  const [settlementNotes, setSettlementNotes] = useState("");

  // Self Check-in Search
  const [checkInSearch, setCheckInSearch] = useState("");

  // Update rules form when rules load
  useMemo(() => {
    if (rules) {
      setRulesForm({
        grace_period_minutes: rules.grace_period_minutes,
        deduction_15m_days: rules.deduction_15m_days,
        deduction_20m_days: rules.deduction_20m_days,
        deduction_30m_plus_days: rules.deduction_30m_plus_days,
      });
    }
  }, [rules]);

  // Filtered employees list
  const filteredEmployees = employees.filter(e => {
    const matchQuery = e.name.toLowerCase().includes(employeeQuery.toLowerCase()) || e.phone.includes(employeeQuery) || e.job_title.toLowerCase().includes(employeeQuery.toLowerCase());
    const matchStatus = statusFilter === "all" || e.status === statusFilter;
    return matchQuery && matchStatus;
  });

  // Save / Update Employee
  const handleSaveEmployee = () => {
    if (!employeeForm.name.trim() || !employeeForm.phone.trim()) {
      toast.error("Name and Phone are required");
      return;
    }
    const baseSal = Number(employeeForm.base_salary) || 0;
    const workDays = Number(employeeForm.work_days_per_month) || 26;

    if (editingEmployee) {
      updateEmployeeMutation.mutate({
        id: editingEmployee.id,
        updates: {
          name: employeeForm.name.trim(),
          email: employeeForm.email.trim() || null,
          phone: employeeForm.phone.trim(),
          job_title: employeeForm.job_title.trim(),
          salary_type: employeeForm.salary_type,
          base_salary: baseSal,
          shift_start: employeeForm.shift_start,
          shift_end: employeeForm.shift_end,
          work_days_per_month: workDays,
          status: employeeForm.status,
        }
      }, {
        onSuccess: () => {
          toast.success(`Employee ${employeeForm.name} updated`);
          setShowEmployeeModal(false);
          setEditingEmployee(null);
        },
        onError: (err) => toast.error(`Error updating: ${err.message}`)
      });
    } else {
      createEmployeeMutation.mutate({
        name: employeeForm.name.trim(),
        email: employeeForm.email.trim() || null,
        phone: employeeForm.phone.trim(),
        job_title: employeeForm.job_title.trim(),
        salary_type: employeeForm.salary_type,
        base_salary: baseSal,
        shift_start: employeeForm.shift_start,
        shift_end: employeeForm.shift_end,
        work_days_per_month: workDays,
        status: employeeForm.status,
      }, {
        onSuccess: () => {
          toast.success(`Employee ${employeeForm.name} created`);
          setShowEmployeeModal(false);
          setEmployeeForm(emptyEmployeeForm);
        },
        onError: (err) => toast.error(`Error creating: ${err.message}`)
      });
    }
  };

  const openEditEmployee = (emp: Employee) => {
    setEditingEmployee(emp);
    setEmployeeForm({
      name: emp.name,
      email: emp.email ?? "",
      phone: emp.phone,
      job_title: emp.job_title,
      salary_type: emp.salary_type,
      base_salary: String(emp.base_salary),
      shift_start: emp.shift_start,
      shift_end: emp.shift_end,
      work_days_per_month: String(emp.work_days_per_month),
      status: emp.status,
    });
    setShowEmployeeModal(true);
  };

  // Handle Employee Self Check-In with Lateness Auto-Deduction Calculation
  const handleEmployeeCheckIn = (emp: Employee) => {
    const now = new Date();
    const [shiftHour, shiftMinute] = emp.shift_start.split(":").map(Number);
    const shiftTime = new Date();
    shiftTime.setHours(shiftHour, shiftMinute, 0, 0);

    const diffMinutes = differenceInMinutes(now, shiftTime);
    const grace = rules?.grace_period_minutes ?? 15;

    let minutesLate = 0;
    let status: 'on_time' | 'late' = 'on_time';
    let autoDeduct: { daysDeducted: number; amountDeducted: number; reason: string } | undefined;

    if (diffMinutes > grace) {
      minutesLate = diffMinutes;
      status = 'late';
      const dailyRate = emp.base_salary / (emp.work_days_per_month || 26);

      let daysCut = rules?.deduction_15m_days ?? 0.25;
      if (diffMinutes >= 30) {
        daysCut = rules?.deduction_30m_plus_days ?? 1.0;
      } else if (diffMinutes >= 20) {
        daysCut = rules?.deduction_20m_days ?? 0.50;
      }

      const amountCut = Math.round(dailyRate * daysCut);

      autoDeduct = {
        daysDeducted: daysCut,
        amountDeducted: amountCut,
        reason: `Auto Late Deduction: ${diffMinutes} mins late (Shift: ${emp.shift_start}, Arrived: ${format(now, "HH:mm")})`,
      };
    }

    checkInMutation.mutate({
      employeeId: emp.id,
      minutesLate,
      status,
      notes: minutesLate > 0 ? `Arrived ${minutesLate}m after shift start` : "On time",
      autoDeduct,
    }, {
      onSuccess: () => {
        if (autoDeduct) {
          toast.warning(`Checked in: ${emp.name} (${minutesLate}m late)`, {
            description: `Auto deduction applied: ${autoDeduct.daysDeducted} day(s) (${autoDeduct.amountDeducted} EGP)`
          });
        } else {
          toast.success(`Checked in: ${emp.name} (On Time)`);
        }
        setCheckInSearch("");
      },
      onError: (err) => toast.error(`Check-in failed: ${err.message}`)
    });
  };

  // Handle Employee Check-Out
  const handleEmployeeCheckOut = (attId: string, empName: string) => {
    checkOutMutation.mutate(attId, {
      onSuccess: () => toast.success(`${empName} checked out successfully`),
      onError: (err) => toast.error(`Error checking out: ${err.message}`)
    });
  };

  // Save Lateness Rules
  const handleSaveRules = () => {
    updateRulesMutation.mutate({
      grace_period_minutes: Number(rulesForm.grace_period_minutes) || 15,
      deduction_15m_days: Number(rulesForm.deduction_15m_days) || 0.25,
      deduction_20m_days: Number(rulesForm.deduction_20m_days) || 0.50,
      deduction_30m_plus_days: Number(rulesForm.deduction_30m_plus_days) || 1.00,
    }, {
      onSuccess: () => toast.success("Lateness deduction rules updated successfully"),
      onError: (err) => toast.error(`Error saving rules: ${err.message}`)
    });
  };

  // Create Manual Deduction
  const handleCreateManualDeduction = () => {
    if (!manualDeductionForm.employee_id || !manualDeductionForm.reason.trim()) {
      toast.error("Employee and reason are required");
      return;
    }
    const emp = employees.find(e => e.id === manualDeductionForm.employee_id);
    if (!emp) return;

    const days = Number(manualDeductionForm.days_deducted) || 0;
    const dailyRate = emp.base_salary / (emp.work_days_per_month || 26);
    const amount = Math.round(dailyRate * days);

    createDeductionMutation.mutate({
      employee_id: emp.id,
      attendance_id: null,
      deduction_type: manualDeductionForm.deduction_type,
      days_deducted: days,
      amount_deducted: amount,
      reason: manualDeductionForm.reason.trim(),
      date: manualDeductionForm.date || todayStr,
      created_by: currentUser?.id ?? null,
    }, {
      onSuccess: () => {
        toast.success(`Deduction of ${days} day(s) (${amount} EGP) added for ${emp.name}`);
        setShowManualDeduction(false);
        setManualDeductionForm({
          employee_id: "",
          deduction_type: "manual",
          days_deducted: "0.5",
          reason: "",
          date: todayStr,
        });
      },
      onError: (err) => toast.error(`Error: ${err.message}`)
    });
  };

  // Revert Deduction
  const handleConfirmRevertDeduction = () => {
    if (!revertingDeductionId) return;
    revertDeductionMutation.mutate({
      id: revertingDeductionId,
      revertedBy: currentUser?.id,
      revertReason: revertReason.trim() || "Reverted by Admin",
    }, {
      onSuccess: () => {
        toast.success("Deduction reverted successfully");
        setRevertingDeductionId(null);
        setRevertReason("");
      },
      onError: (err) => toast.error(`Error reverting: ${err.message}`)
    });
  };

  // Settle Payroll Paycheck
  const handleSettlePayroll = () => {
    if (!settlingEmployee) return;

    // Calculate active deductions for this employee in the selected period
    const empDeductions = deductionLogs.filter(d => {
      if (d.employee_id !== settlingEmployee.id || d.is_reverted) return false;
      const dDate = new Date(d.date);
      return dDate.getMonth() + 1 === selectedMonth && dDate.getFullYear() === selectedYear;
    });

    const totalDaysCut = empDeductions.reduce((acc, d) => acc + d.days_deducted, 0);
    const totalAmountCut = empDeductions.reduce((acc, d) => acc + d.amount_deducted, 0);
    const bonus = Number(settlementBonus) || 0;
    const netSalary = Math.max(0, settlingEmployee.base_salary - totalAmountCut + bonus);

    createSettlementMutation.mutate({
      employee_id: settlingEmployee.id,
      employee_name: settlingEmployee.name,
      period_month: selectedMonth,
      period_year: selectedYear,
      base_salary: settlingEmployee.base_salary,
      total_days_deducted: totalDaysCut,
      total_deductions_amount: totalAmountCut,
      bonus_amount: bonus,
      net_salary: netSalary,
      payment_method: settlementMethod,
      settled_by: currentUser?.id,
      notes: settlementNotes.trim() || undefined,
    }, {
      onSuccess: () => {
        createAuditLog.mutate({
          action: 'Settle Employee Payroll',
          action_type: 'other',
          performed_by: currentUser?.id ?? null,
          performer_name: currentUser?.name ?? 'System',
          member_id: null,
          member_name: settlingEmployee.name,
          timestamp: new Date().toISOString(),
          details: `Settled paycheck for ${settlingEmployee.name} (${selectedMonth}/${selectedYear}): Net ${netSalary} EGP (Base: ${settlingEmployee.base_salary}, Cuts: -${totalAmountCut}, Bonus: +${bonus}) via ${settlementMethod}`,
        });
        toast.success(`Paycheck settled for ${settlingEmployee.name} (${netSalary} EGP) and recorded in Expenses!`);
        setSettlingEmployee(null);
        setSettlementBonus("0");
        setSettlementNotes("");
      },
      onError: (err) => toast.error(`Settlement failed: ${err.message}`)
    });
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Users className="w-6 h-6 text-primary" /> Employees & Attendance
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Manage staff members, attendance check-in, late deductions, and payroll settlements.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <Button
              data-testid="btn-new-employee"
              onClick={() => { setEditingEmployee(null); setEmployeeForm(emptyEmployeeForm); setShowEmployeeModal(true); }}
              className="gap-2"
            >
              <Plus className="w-4 h-4" /> Add Employee
            </Button>
          )}
        </div>
      </div>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid grid-cols-2 md:grid-cols-5 h-auto p-1 gap-1">
          <TabsTrigger value="attendance" className="gap-2 py-2">
            <UserCheck className="w-4 h-4" /> Self Check-In
          </TabsTrigger>
          <TabsTrigger value="employees" className="gap-2 py-2">
            <Users className="w-4 h-4" /> Staff Directory ({employees.length})
          </TabsTrigger>
          <TabsTrigger value="deductions" className="gap-2 py-2">
            <Clock className="w-4 h-4" /> Deductions Log ({deductionLogs.filter(d => !d.is_reverted).length})
          </TabsTrigger>
          <TabsTrigger value="payroll" className="gap-2 py-2">
            <DollarSign className="w-4 h-4" /> Payroll & Expense
          </TabsTrigger>
          {isAdmin && (
            <TabsTrigger value="settings" className="gap-2 py-2">
              <Settings className="w-4 h-4" /> Lateness Rules
            </TabsTrigger>
          )}
        </TabsList>

        {/* ── TAB 1: SELF CHECK-IN ── */}
        <TabsContent value="attendance" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Check-In Action Kiosk */}
            <Card className="md:col-span-1 border-primary/20 bg-primary/5 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <LogIn className="w-5 h-5 text-primary" /> Staff Arrival Check-In
                </CardTitle>
                <CardDescription>
                  Search by name or phone to record arrival time.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search staff name..."
                    value={checkInSearch}
                    onChange={e => setCheckInSearch(e.target.value)}
                    className="pl-9 bg-white"
                  />
                </div>

                <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
                  {employees
                    .filter(e => e.status === 'active' && (!checkInSearch || e.name.toLowerCase().includes(checkInSearch.toLowerCase()) || e.phone.includes(checkInSearch)))
                    .map(emp => {
                      const attendance = todayAttendances.find(a => a.employee_id === emp.id);
                      const isCheckedIn = !!attendance;
                      const isCheckedOut = !!attendance?.check_out_time;

                      return (
                        <div
                          key={emp.id}
                          className="p-3 rounded-lg border bg-white flex items-center justify-between shadow-xs hover:border-primary/40 transition-colors"
                        >
                          <div className="min-w-0 pr-2">
                            <p className="font-semibold text-sm text-foreground truncate">{emp.name}</p>
                            <p className="text-xs text-muted-foreground">{emp.job_title} · Shift: {emp.shift_start}</p>
                          </div>
                          <div>
                            {!isCheckedIn ? (
                              <Button
                                size="sm"
                                onClick={() => handleEmployeeCheckIn(emp)}
                                disabled={checkInMutation.isPending}
                                className="h-8 gap-1.5 font-medium"
                              >
                                <LogIn className="w-3.5 h-3.5" /> Check In
                              </Button>
                            ) : !isCheckedOut ? (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleEmployeeCheckOut(attendance.id, emp.name)}
                                disabled={checkOutMutation.isPending}
                                className="h-8 gap-1.5 border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                              >
                                <LogOut className="w-3.5 h-3.5" /> Check Out
                              </Button>
                            ) : (
                              <Badge variant="secondary" className="text-xs gap-1 bg-gray-100 text-gray-600">
                                <Check className="w-3 h-3" /> Done
                              </Badge>
                            )}
                          </div>
                        </div>
                      );
                    })}
                </div>
              </CardContent>
            </Card>

            {/* Today's Attendance Feed */}
            <Card className="md:col-span-2 shadow-sm">
              <CardHeader className="pb-3 border-b">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Clock className="w-5 h-5 text-primary" /> Today's Attendance Log ({todayStr})
                    </CardTitle>
                    <CardDescription>
                      Real-time arrivals, punctuality status, and shifts.
                    </CardDescription>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {todayAttendances.length} Present Today
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {todayAttendances.length === 0 ? (
                  <div className="py-12 text-center text-muted-foreground text-sm">
                    No employee check-ins recorded yet today.
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Employee</TableHead>
                        <TableHead>Check-In</TableHead>
                        <TableHead>Check-Out</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Lateness / Notes</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {todayAttendances.map(att => (
                        <TableRow key={att.id}>
                          <TableCell className="font-semibold text-sm">
                            {att.employee?.name ?? "Unknown Staff"}
                            <span className="block text-xs font-normal text-muted-foreground">{att.employee?.job_title}</span>
                          </TableCell>
                          <TableCell className="text-sm">
                            {format(new Date(att.check_in_time), "hh:mm a")}
                          </TableCell>
                          <TableCell className="text-sm">
                            {att.check_out_time ? format(new Date(att.check_out_time), "hh:mm a") : <span className="text-muted-foreground text-xs italic">Active Shift</span>}
                          </TableCell>
                          <TableCell>
                            {att.status === 'on_time' ? (
                              <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100">On Time</Badge>
                            ) : (
                              <Badge className="bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100">
                                {att.minutes_late}m Late
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {att.notes || "—"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ── TAB 2: STAFF DIRECTORY ── */}
        <TabsContent value="employees" className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, role, or phone..."
                value={employeeQuery}
                onChange={e => setEmployeeQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-md border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Role / Title</TableHead>
                  <TableHead>Shift Hours</TableHead>
                  <TableHead>Base Salary</TableHead>
                  <TableHead>Status</TableHead>
                  {isAdmin && <TableHead className="w-[100px]">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEmployees.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={isAdmin ? 6 : 5} className="py-8 text-center text-muted-foreground">
                      No employees found.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredEmployees.map(emp => (
                    <TableRow key={emp.id}>
                      <TableCell>
                        <div className="font-semibold text-sm">{emp.name}</div>
                        <div className="text-xs text-muted-foreground">{emp.phone} {emp.email && `· ${emp.email}`}</div>
                      </TableCell>
                      <TableCell className="text-sm font-medium">{emp.job_title}</TableCell>
                      <TableCell className="text-sm">
                        {emp.shift_start} - {emp.shift_end}
                        <span className="block text-xs text-muted-foreground">{emp.work_days_per_month} days/mo</span>
                      </TableCell>
                      <TableCell className="text-sm font-bold text-foreground">
                        {emp.base_salary.toLocaleString()} EGP
                        <span className="block text-xs font-normal text-muted-foreground capitalize">{emp.salary_type}</span>
                      </TableCell>
                      <TableCell>
                        <Badge variant={emp.status === 'active' ? 'default' : 'secondary'} className={emp.status === 'active' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : ''}>
                          {emp.status}
                        </Badge>
                      </TableCell>
                      {isAdmin && (
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => openEditEmployee(emp)}
                              className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                              title="Edit"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setConfirmDelete(emp)}
                              className="p-1.5 rounded hover:bg-red-50 text-muted-foreground hover:text-red-600"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* ── TAB 3: DEDUCTIONS LOG (AUTO & MANUAL) ── */}
        <TabsContent value="deductions" className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h3 className="text-base font-bold text-foreground">Deductions & Late Penalties Log</h3>
              <p className="text-xs text-muted-foreground">
                All auto-calculated late deductions and manual administrative deductions with reversible auditing.
              </p>
            </div>
            {isAdmin && (
              <Button onClick={() => setShowManualDeduction(true)} className="gap-2">
                <Plus className="w-4 h-4" /> Add Manual Deduction
              </Button>
            )}
          </div>

          <div className="rounded-md border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Employee</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Reason / Note</TableHead>
                  <TableHead>Days Cut</TableHead>
                  <TableHead>Amount Cut</TableHead>
                  <TableHead>Status</TableHead>
                  {isAdmin && <TableHead className="w-[110px]">Action</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {deductionLogs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={isAdmin ? 8 : 7} className="py-8 text-center text-muted-foreground">
                      No deduction logs recorded.
                    </TableCell>
                  </TableRow>
                ) : (
                  deductionLogs.map(log => (
                    <TableRow key={log.id} className={log.is_reverted ? "opacity-50 line-through bg-muted/20" : ""}>
                      <TableCell className="text-xs">{log.date}</TableCell>
                      <TableCell className="font-semibold text-sm">
                        {log.employee?.name ?? "Staff"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs capitalize">
                          {log.deduction_type.replace('_', ' ')}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs max-w-xs">
                        {log.reason}
                        {log.is_reverted && (
                          <span className="block text-[11px] text-amber-700 not-italic no-underline font-medium mt-0.5">
                            Reverted: {log.revert_reason}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm font-bold text-red-600">
                        -{log.days_deducted} day(s)
                      </TableCell>
                      <TableCell className="text-sm font-bold text-red-600">
                        -{log.amount_deducted.toLocaleString()} EGP
                      </TableCell>
                      <TableCell>
                        {log.is_reverted ? (
                          <Badge variant="secondary" className="text-[10px] bg-amber-100 text-amber-800 border-amber-200">Reverted</Badge>
                        ) : (
                          <Badge variant="default" className="text-[10px] bg-red-100 text-red-700 border-red-200 hover:bg-red-100">Active</Badge>
                        )}
                      </TableCell>
                      {isAdmin && (
                        <TableCell>
                          {!log.is_reverted ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => { setRevertingDeductionId(log.id); setRevertReason(""); }}
                              className="h-7 text-xs gap-1 border-amber-300 text-amber-800 hover:bg-amber-50"
                            >
                              <RotateCcw className="w-3 h-3" /> Revert
                            </Button>
                          ) : (
                            <span className="text-xs text-muted-foreground">Reverted</span>
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* ── TAB 4: PAYROLL & EXPENSE SETTLEMENT ── */}
        <TabsContent value="payroll" className="space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-xl border bg-muted/30">
            <div>
              <h3 className="text-base font-bold text-foreground">Monthly Payroll Calculation & Settlement</h3>
              <p className="text-xs text-muted-foreground">
                Review net salary calculations based on attendance deductions and settle directly into the Gym's Expenses.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Select value={String(selectedMonth)} onValueChange={v => setSelectedMonth(Number(v))}>
                <SelectTrigger className="w-32 bg-white">
                  <SelectValue placeholder="Month" />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                    <SelectItem key={m} value={String(m)}>
                      {format(new Date(2026, m - 1, 1), "MMMM")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={String(selectedYear)} onValueChange={v => setSelectedYear(Number(v))}>
                <SelectTrigger className="w-24 bg-white">
                  <SelectValue placeholder="Year" />
                </SelectTrigger>
                <SelectContent>
                  {[2025, 2026, 2027].map(y => (
                    <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="rounded-md border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Base Salary</TableHead>
                  <TableHead>Deductions ({selectedMonth}/{selectedYear})</TableHead>
                  <TableHead>Net Paycheck</TableHead>
                  <TableHead>Status</TableHead>
                  {isAdmin && <TableHead className="w-[130px]">Settlement</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {employees.filter(e => e.status === 'active').map(emp => {
                  // Find if already settled for this month/year
                  const existingSettlement = settlements.find(
                    s => s.employee_id === emp.id && s.period_month === selectedMonth && s.period_year === selectedYear
                  );

                  // Calculate active deductions for this month
                  const empDeductions = deductionLogs.filter(d => {
                    if (d.employee_id !== emp.id || d.is_reverted) return false;
                    const dDate = new Date(d.date);
                    return dDate.getMonth() + 1 === selectedMonth && dDate.getFullYear() === selectedYear;
                  });

                  const totalDaysCut = empDeductions.reduce((acc, d) => acc + d.days_deducted, 0);
                  const totalAmountCut = empDeductions.reduce((acc, d) => acc + d.amount_deducted, 0);
                  const netEstimated = Math.max(0, emp.base_salary - totalAmountCut);

                  return (
                    <TableRow key={emp.id}>
                      <TableCell>
                        <div className="font-semibold text-sm">{emp.name}</div>
                        <div className="text-xs text-muted-foreground">{emp.job_title}</div>
                      </TableCell>
                      <TableCell className="text-sm font-medium">
                        {emp.base_salary.toLocaleString()} EGP
                      </TableCell>
                      <TableCell className="text-sm">
                        {totalAmountCut > 0 ? (
                          <span className="font-semibold text-red-600">
                            -{totalAmountCut.toLocaleString()} EGP ({totalDaysCut} days)
                          </span>
                        ) : (
                          <span className="text-emerald-600 font-medium">No deductions</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm font-bold text-foreground">
                        {existingSettlement ? existingSettlement.net_salary.toLocaleString() : netEstimated.toLocaleString()} EGP
                      </TableCell>
                      <TableCell>
                        {existingSettlement ? (
                          <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100">
                            Settled ({existingSettlement.payment_method})
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-amber-700 border-amber-300 bg-amber-50">
                            Pending
                          </Badge>
                        )}
                      </TableCell>
                      {isAdmin && (
                        <TableCell>
                          {!existingSettlement ? (
                            <Button
                              size="sm"
                              onClick={() => {
                                setSettlingEmployee(emp);
                                setSettlementBonus("0");
                                setSettlementMethod("Cash");
                                setSettlementNotes("");
                              }}
                              className="h-8 gap-1 font-semibold"
                            >
                              <DollarSign className="w-3.5 h-3.5" /> Settle
                            </Button>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              {format(new Date(existingSettlement.settled_at), "dd MMM yy")}
                            </span>
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* ── TAB 5: LATENESS RULES (ADMIN) ── */}
        {isAdmin && (
          <TabsContent value="settings" className="space-y-4">
            <Card className="max-w-2xl border shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Settings className="w-5 h-5 text-primary" /> Lateness & Grace Period Configuration
                </CardTitle>
                <CardDescription>
                  Define grace period tolerances and auto-deduction penalties in days of salary per minutes late.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Grace Period (Minutes)</Label>
                  <Input
                    type="number"
                    value={rulesForm.grace_period_minutes}
                    onChange={e => setRulesForm(p => ({ ...p, grace_period_minutes: Number(e.target.value) || 0 }))}
                    placeholder="15"
                  />
                  <p className="text-xs text-muted-foreground">
                    Employees arriving within this window after shift start will not incur auto deductions.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                  <div className="space-y-1.5">
                    <Label>15 - 19 Min Late</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        step="0.05"
                        value={rulesForm.deduction_15m_days}
                        onChange={e => setRulesForm(p => ({ ...p, deduction_15m_days: Number(e.target.value) || 0 }))}
                      />
                      <span className="text-xs text-muted-foreground font-medium">Days</span>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label>20 - 29 Min Late</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        step="0.05"
                        value={rulesForm.deduction_20m_days}
                        onChange={e => setRulesForm(p => ({ ...p, deduction_20m_days: Number(e.target.value) || 0 }))}
                      />
                      <span className="text-xs text-muted-foreground font-medium">Days</span>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label>30+ Min Late</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        step="0.05"
                        value={rulesForm.deduction_30m_plus_days}
                        onChange={e => setRulesForm(p => ({ ...p, deduction_30m_plus_days: Number(e.target.value) || 0 }))}
                      />
                      <span className="text-xs text-muted-foreground font-medium">Days</span>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t flex justify-end">
                  <Button onClick={handleSaveRules} disabled={updateRulesMutation.isPending}>
                    Save Deduction Rules
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>

      {/* Add / Edit Employee Dialog */}
      <Dialog open={showEmployeeModal} onOpenChange={setShowEmployeeModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingEmployee ? `Edit: ${editingEmployee.name}` : "New Employee"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3.5 py-2">
            <div className="space-y-1.5">
              <Label>Full Name *</Label>
              <Input
                placeholder="Full name"
                value={employeeForm.name}
                onChange={e => setEmployeeForm(p => ({ ...p, name: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Phone *</Label>
                <Input
                  placeholder="01XXXXXXXXX"
                  value={employeeForm.phone}
                  onChange={e => setEmployeeForm(p => ({ ...p, phone: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Job Title / Role</Label>
                <Input
                  placeholder="Receptionist, Cleaner, etc."
                  value={employeeForm.job_title}
                  onChange={e => setEmployeeForm(p => ({ ...p, job_title: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Email (Optional)</Label>
              <Input
                type="email"
                placeholder="staff@example.com"
                value={employeeForm.email}
                onChange={e => setEmployeeForm(p => ({ ...p, email: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Base Monthly Salary (EGP)</Label>
                <Input
                  type="number"
                  placeholder="6000"
                  value={employeeForm.base_salary}
                  onChange={e => setEmployeeForm(p => ({ ...p, base_salary: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Work Days / Month</Label>
                <Input
                  type="number"
                  placeholder="26"
                  value={employeeForm.work_days_per_month}
                  onChange={e => setEmployeeForm(p => ({ ...p, work_days_per_month: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Shift Start Time</Label>
                <Input
                  type="time"
                  value={employeeForm.shift_start}
                  onChange={e => setEmployeeForm(p => ({ ...p, shift_start: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Shift End Time</Label>
                <Input
                  type="time"
                  value={employeeForm.shift_end}
                  onChange={e => setEmployeeForm(p => ({ ...p, shift_end: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={employeeForm.status} onValueChange={v => setEmployeeForm(p => ({ ...p, status: v as EmployeeStatus }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEmployeeModal(false)}>Cancel</Button>
            <Button onClick={handleSaveEmployee} disabled={createEmployeeMutation.isPending || updateEmployeeMutation.isPending}>
              {editingEmployee ? "Save Changes" : "Create Employee"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Employee Confirmation */}
      <AlertDialog open={!!confirmDelete} onOpenChange={o => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Employee</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{confirmDelete?.name}</strong>?
              This will remove all associated attendance and deduction history.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmDelete && deleteEmployeeMutation.mutate(confirmDelete.id, {
                onSuccess: () => {
                  toast.success("Employee deleted");
                  setConfirmDelete(null);
                }
              })}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Manual Deduction Dialog */}
      <Dialog open={showManualDeduction} onOpenChange={setShowManualDeduction}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Manual Deduction / Penalty</DialogTitle>
          </DialogHeader>
          <div className="space-y-3.5 py-2">
            <div className="space-y-1.5">
              <Label>Employee *</Label>
              <Select
                value={manualDeductionForm.employee_id}
                onValueChange={v => setManualDeductionForm(p => ({ ...p, employee_id: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select Staff" />
                </SelectTrigger>
                <SelectContent>
                  {employees.filter(e => e.status === 'active').map(e => (
                    <SelectItem key={e.id} value={e.id}>{e.name} ({e.job_title})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Days to Deduct</Label>
                <Input
                  type="number"
                  step="0.25"
                  value={manualDeductionForm.days_deducted}
                  onChange={e => setManualDeductionForm(p => ({ ...p, days_deducted: e.target.value }))}
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
              <Label>Reason / Justification *</Label>
              <Textarea
                placeholder="Reason for manual deduction..."
                value={manualDeductionForm.reason}
                onChange={e => setManualDeductionForm(p => ({ ...p, reason: e.target.value }))}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowManualDeduction(false)}>Cancel</Button>
            <Button onClick={handleCreateManualDeduction} disabled={createDeductionMutation.isPending}>
              Apply Deduction
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Revert Deduction Confirmation Dialog */}
      <Dialog open={!!revertingDeductionId} onOpenChange={o => !o && setRevertingDeductionId(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Revert / Remove Deduction</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">
              Are you sure you want to revert this deduction? The penalty will be cancelled and restored to the employee's net paycheck.
            </p>
            <div className="space-y-1.5">
              <Label>Revert Reason / Authorization Note</Label>
              <Input
                placeholder="e.g. Excused by Management / Medical Reason"
                value={revertReason}
                onChange={e => setRevertReason(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRevertingDeductionId(null)}>Cancel</Button>
            <Button onClick={handleConfirmRevertDeduction} disabled={revertDeductionMutation.isPending} className="bg-amber-600 hover:bg-amber-700 text-white">
              Confirm Revert
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Paycheck Settlement Dialog */}
      <Dialog open={!!settlingEmployee} onOpenChange={o => !o && setSettlingEmployee(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Settle Paycheck: {settlingEmployee?.name}</DialogTitle>
          </DialogHeader>
          {settlingEmployee && (() => {
            const empDeductions = deductionLogs.filter(d => {
              if (d.employee_id !== settlingEmployee.id || d.is_reverted) return false;
              const dDate = new Date(d.date);
              return dDate.getMonth() + 1 === selectedMonth && dDate.getFullYear() === selectedYear;
            });
            const totalDaysCut = empDeductions.reduce((acc, d) => acc + d.days_deducted, 0);
            const totalAmountCut = empDeductions.reduce((acc, d) => acc + d.amount_deducted, 0);
            const bonus = Number(settlementBonus) || 0;
            const netSalary = Math.max(0, settlingEmployee.base_salary - totalAmountCut + bonus);

            return (
              <div className="space-y-4 py-2">
                <div className="p-3.5 rounded-xl bg-muted/40 border space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Period:</span>
                    <span className="font-semibold">{format(new Date(selectedYear, selectedMonth - 1, 1), "MMMM yyyy")}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Base Salary:</span>
                    <span className="font-semibold">{settlingEmployee.base_salary.toLocaleString()} EGP</span>
                  </div>
                  <div className="flex justify-between text-red-600">
                    <span>Attendance Deductions ({totalDaysCut} days):</span>
                    <span className="font-semibold">-{totalAmountCut.toLocaleString()} EGP</span>
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

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Bonus / Extra (EGP)</Label>
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
                  <span>This will automatically create an Expense in the Gym's Accounts with an Expense ID.</span>
                </div>
              </div>
            );
          })()}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSettlingEmployee(null)}>Cancel</Button>
            <Button onClick={handleSettlePayroll} disabled={createSettlementMutation.isPending} className="font-bold">
              Confirm & Expense Paycheck
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
