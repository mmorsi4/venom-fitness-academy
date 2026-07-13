import { useState, useMemo, useEffect } from "react";
import { useSearch, useLocation } from "wouter";
import {
  CalendarDays, Users, DollarSign, TrendingDown, TrendingUp,
  Clock, CheckCircle2, CreditCard, AlertTriangle
} from "lucide-react";
import { calculateIncomeByMethod } from "../lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useAuditLogs, useInvoices, useExpenses, useClasses, useInvoicePayments, useCheckInsByDate, useMembers, useClassScheduleOverrides } from "@/hooks/use-data";
import { format, isSameDay, subDays, addDays, parseISO } from "date-fns";

function isoToDate(s: string) {
  try { return parseISO(s); } catch { return new Date(); }
}

const DAYS_OF_WEEK = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default function DailyReport() {
  const { data: auditLogs = [] } = useAuditLogs();
  const { data: invoices = [] } = useInvoices();
  const { data: expenses = [] } = useExpenses();
  const { data: classes = [] } = useClasses();
  const { data: invoicePayments = [] } = useInvoicePayments();
  const { data: members = [] } = useMembers();
  const { data: scheduleOverrides = [] } = useClassScheduleOverrides();
  const searchParams = useSearch();
  const [, setLocation] = useLocation();

  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  
  useEffect(() => {
    const params = new URLSearchParams(searchParams);
    const dateParam = params.get("date");
    if (dateParam) {
      const d = parseISO(dateParam);
      if (!isNaN(d.getTime())) {
        setSelectedDate(d);
        params.delete("date");
        const newSearch = params.toString();
        const newUrl = newSearch ? window.location.pathname + "?" + newSearch : window.location.pathname;
        setLocation(newUrl);
      }
    }
  }, [searchParams, setLocation]);

  const dateString = format(selectedDate, "yyyy-MM-dd");
  const { data: checkInsData = [] } = useCheckInsByDate(selectedDate);

  // Memoized values for the selected day
  const dayOfWeek = DAYS_OF_WEEK[selectedDate.getDay()];
  const isToday = isSameDay(selectedDate, new Date());

  const classesForDay = classes.filter(cls => {
    const regularSchedule = (cls.schedules || []).find(s => s.day === dayOfWeek);
    const overrideForDay = scheduleOverrides.find(o => o.class_id === cls.id && o.original_date === dateString);
    const postponedToDay = scheduleOverrides.find(o => o.class_id === cls.id && o.status === 'postponed' && o.new_date === dateString);

    let isScheduledToday = !!regularSchedule;
    
    if (overrideForDay && (overrideForDay.status === 'postponed' || overrideForDay.status === 'cancelled')) {
      isScheduledToday = false;
    }
    if (postponedToDay) {
      isScheduledToday = true;
    }
    return isScheduledToday;
  });

  // Check-ins from check_ins table for selected date
  const checkIns = checkInsData;

  // Overrides for selected date
  const overrides = checkIns.filter(l => l.is_override);

  // Invoices created on this date
  const invoicesForDay = useMemo(() =>
    invoices.filter(i => isSameDay(isoToDate(i.created_at), selectedDate)),
    [invoices, selectedDate]
  );

  // Expenses for this date
  const expensesForDay = useMemo(() =>
    expenses.filter(e => isSameDay(isoToDate(e.date), selectedDate)),
    [expenses, selectedDate]
  );

  const totalIncome = invoicesForDay.reduce((s, i) => s + i.paid_amount, 0);
  const totalExpenses = expensesForDay.reduce((s, e) => s + e.amount, 0);
  const netBalance = totalIncome - totalExpenses;
  const totalAttendance = classesForDay.reduce((s, c) => s + c.attendance_count, 0);
  
  const cashIncome = calculateIncomeByMethod(invoicesForDay, 'Cash');
  const visaIncome = calculateIncomeByMethod(invoicesForDay, 'Visa');
  const instapayIncome = calculateIncomeByMethod(invoicesForDay, 'InstaPay');

  const cashExpenses = expensesForDay.filter(e => e.payment_method === 'Cash').reduce((s, e) => s + e.amount, 0);
  const visaExpenses = expensesForDay.filter(e => e.payment_method === 'Visa').reduce((s, e) => s + e.amount, 0);
  const instapayExpenses = expensesForDay.filter(e => e.payment_method === 'InstaPay').reduce((s, e) => s + e.amount, 0);

  const prevDay = () => setSelectedDate(d => subDays(d, 1));
  const nextDay = () => setSelectedDate(d => {
    const next = addDays(d, 1);
    return next <= new Date() ? next : d;
  });

  const summaryCards = [
    { label: "Door Check-ins", value: checkIns.length, icon: Users, color: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-100" },
    { label: "Classes Today", value: classesForDay.length, icon: Clock, color: "text-blue-600", bg: "bg-blue-50", border: "border-blue-100" },
    { label: "Class Attendances", value: totalAttendance, icon: CheckCircle2, color: "text-violet-600", bg: "bg-violet-50", border: "border-violet-100" },
    { label: "Overrides", value: overrides.length, icon: AlertTriangle, color: overrides.length > 0 ? "text-red-600" : "text-muted-foreground", bg: overrides.length > 0 ? "bg-red-50" : "bg-muted/50", border: overrides.length > 0 ? "border-red-100" : "border-border" },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Header with date nav */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Daily Report</h1>
          <p className="text-sm text-muted-foreground">Day-by-day accounting and attendance</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <Button variant="outline" size="sm" onClick={prevDay}>←</Button>
          <div className="flex items-center gap-1 px-1 py-1 rounded-lg border bg-card justify-center flex-1 sm:flex-none">
            <Input 
              type="date"
              className="h-8 w-[140px] border-none shadow-none focus-visible:ring-0 text-foreground font-semibold"
              value={format(selectedDate, "yyyy-MM-dd")}
              onChange={(e) => {
                if (e.target.value) {
                  const d = parseISO(e.target.value);
                  if (!isNaN(d.getTime()) && d <= new Date()) {
                    setSelectedDate(d);
                  }
                }
              }}
              max={format(new Date(), "yyyy-MM-dd")}
            />
            {isToday && <Badge className="text-xs mr-2">Today</Badge>}
          </div>
          <Button variant="outline" size="sm" onClick={nextDay} disabled={isToday}>→</Button>
          <Button variant="outline" size="sm" onClick={() => setSelectedDate(new Date())}>Today</Button>
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {summaryCards.map(({ label, value, icon: Icon, color, bg, border }) => (
          <Card key={label} className={`border ${border}`}>
            <CardContent className="p-4">
              <div className={`w-8 h-8 rounded-lg ${bg} flex items-center justify-center mb-3`}>
                <Icon className={`w-4 h-4 ${color}`} />
              </div>
              <p className="text-2xl font-bold text-foreground">{value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Financial summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-emerald-100">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-muted-foreground">Income</p>
              <TrendingUp className="w-4 h-4 text-emerald-500" />
            </div>
            <p className="text-3xl font-bold text-emerald-600">{totalIncome.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground mt-1">EGP collected</p>
            <div className="flex flex-wrap gap-2 mt-4">
              {cashIncome > 0 && (
                <Badge variant="outline" className="text-sm px-3 py-1 font-semibold border-amber-200 bg-amber-50 text-amber-700 shadow-sm">
                  Cash: {cashIncome.toLocaleString()} EGP
                </Badge>
              )}
              {visaIncome > 0 && (
                <Badge variant="outline" className="text-sm px-3 py-1 font-semibold border-blue-200 bg-blue-50 text-blue-700 shadow-sm">
                  Visa: {visaIncome.toLocaleString()} EGP
                </Badge>
              )}
              {instapayIncome > 0 && (
                <Badge variant="outline" className="text-sm px-3 py-1 font-semibold border-violet-200 bg-violet-50 text-violet-700 shadow-sm">
                  InstaPay: {instapayIncome.toLocaleString()} EGP
                </Badge>
              )}
              {totalIncome === 0 && <span className="text-sm text-muted-foreground">No payments</span>}
            </div>
          </CardContent>
        </Card>
        <Card className="border-red-100">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-muted-foreground">Expenses</p>
              <TrendingDown className="w-4 h-4 text-red-500" />
            </div>
            <p className="text-3xl font-bold text-red-600">{totalExpenses.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground mt-1">EGP spent</p>
            <div className="flex flex-wrap gap-2 mt-4">
              {cashExpenses > 0 && (
                <Badge variant="outline" className="text-sm px-3 py-1 font-semibold border-amber-200 bg-amber-50 text-amber-700 shadow-sm">
                  Cash: {cashExpenses.toLocaleString()} EGP
                </Badge>
              )}
              {visaExpenses > 0 && (
                <Badge variant="outline" className="text-sm px-3 py-1 font-semibold border-blue-200 bg-blue-50 text-blue-700 shadow-sm">
                  Visa: {visaExpenses.toLocaleString()} EGP
                </Badge>
              )}
              {instapayExpenses > 0 && (
                <Badge variant="outline" className="text-sm px-3 py-1 font-semibold border-violet-200 bg-violet-50 text-violet-700 shadow-sm">
                  InstaPay: {instapayExpenses.toLocaleString()} EGP
                </Badge>
              )}
              {totalExpenses === 0 && <span className="text-sm text-muted-foreground">No expenses</span>}
            </div>
          </CardContent>
        </Card>
        <Card className={netBalance >= 0 ? "border-emerald-100" : "border-red-100"}>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-muted-foreground">Net Balance</p>
              <DollarSign className={`w-4 h-4 ${netBalance >= 0 ? 'text-emerald-500' : 'text-red-500'}`} />
            </div>
            <p className={`text-3xl font-bold ${netBalance >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
              {netBalance >= 0 ? '' : '-'}{Math.abs(netBalance).toLocaleString()}
            </p>
            <p className="text-xs text-muted-foreground mt-1">EGP net for the day</p>
          </CardContent>
        </Card>
      </div>

      {/* Account Balance by Method */}
      <Card>
        <CardContent className="p-5">
          <p className="text-sm font-semibold text-muted-foreground mb-3">Account Balance (Today)</p>
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'Cash', income: cashIncome, expense: cashExpenses },
              { label: 'Visa', income: visaIncome, expense: visaExpenses },
              { label: 'InstaPay', income: instapayIncome, expense: instapayExpenses },
            ].map(({ label, income, expense }) => {
              const net = income - expense;
              const positive = net >= 0;
              return (
                <div key={label} className={`rounded-lg border p-3 ${positive ? 'bg-emerald-50 border-emerald-100' : 'bg-red-50 border-red-100'}`}>
                  <p className="text-xs font-medium text-muted-foreground mb-1">{label}</p>
                  <p className={`text-xl font-bold ${positive ? 'text-emerald-600' : 'text-red-600'}`}>
                    {positive ? '' : '-'}{Math.abs(net).toLocaleString()} <span className="text-xs font-normal">EGP</span>
                  </p>
                  <div className="flex gap-3 mt-1.5 text-[11px]">
                    <span className="text-emerald-600">↑ {income.toLocaleString()}</span>
                    <span className="text-red-500">↓ {expense.toLocaleString()}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sessions */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Clock className="w-4 h-4 text-muted-foreground" />
              Sessions on {dayOfWeek}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {classesForDay.length === 0 ? (
              <div className="py-6 text-center text-muted-foreground text-sm">No classes scheduled on {dayOfWeek}</div>
            ) : (
              <div className="space-y-2">
                {classesForDay.map(cls => {
                  const pct = Math.round((cls.attendance_count / cls.capacity) * 100);
                  // Find the schedule for this day to show the time
                  const time = cls.schedules?.find(s => s.day === dayOfWeek)?.time ?? '--:--';
                  return (
                    <div key={cls.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border border-border">
                      <div className="text-center min-w-[44px]">
                        <p className="text-sm font-bold text-foreground">{time}</p>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground">{cls.name}</p>
                        <p className="text-xs text-muted-foreground">{cls.coach_name ?? 'Unassigned'}</p>
                        <div className="mt-1.5 h-1.5 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-primary rounded-full" style={{ width: `${Math.min(pct, 100)}%` }} />
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-sm font-bold text-foreground">{cls.attendance_count}</p>
                        <p className="text-xs text-muted-foreground">/{cls.capacity}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Door Check-ins */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center justify-between">
              <span className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                Door Check-ins ({checkIns.length})
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {checkIns.length === 0 ? (
              <div className="py-6 text-center text-muted-foreground text-sm">No check-ins recorded for this day</div>
            ) : (
              <div className="space-y-2">
                {checkIns.map(log => {
                  const member = members.find(m => m.uuid === log.member_id);
                  return (
                    <div key={log.id} className={`flex items-center gap-3 p-2.5 rounded-lg border ${log.is_override ? 'bg-red-50 border-red-200' : 'bg-emerald-50 border-emerald-100'}`}>
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${log.is_override ? 'bg-red-100' : 'bg-emerald-100'}`}>
                        {log.is_override
                          ? <AlertTriangle className="w-3.5 h-3.5 text-red-600" />
                          : <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground">{member?.name || 'Unknown Member'}</p>
                        {log.is_override && (
                          <p className="text-xs text-red-600">Override — expired or missing invoice</p>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground flex-shrink-0">{format(isoToDate(log.created_at), "hh:mm a")}</p>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Invoices */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-muted-foreground" />
              Invoices Created ({invoicesForDay.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {invoicesForDay.length === 0 ? (
              <div className="py-6 text-center text-muted-foreground text-sm">No invoices created on this day</div>
            ) : (
              <div className="space-y-2">
                {invoicesForDay.map(inv => (
                  <div key={inv.uuid} className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border border-border">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground">{inv.member_name}</p>
                      <p className="text-xs text-muted-foreground">{inv.id} · {inv.package_name}</p>
                      <p className="text-xs text-muted-foreground">{inv.payment_method}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-bold text-foreground">{inv.paid_amount.toLocaleString()} EGP</p>
                      <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                        inv.status === 'paid' ? 'bg-emerald-100 text-emerald-700' :
                        inv.status === 'partial' ? 'bg-amber-100 text-amber-700' :
                        'bg-red-100 text-red-700'
                      }`}>{inv.status}</span>
                    </div>
                  </div>
                ))}
                <div className="pt-2 flex justify-between text-sm font-bold border-t border-border">
                  <span>Total Collected</span>
                  <span className="text-emerald-600">{totalIncome.toLocaleString()} EGP</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Expenses */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <TrendingDown className="w-4 h-4 text-red-500" />
              Expenses ({expensesForDay.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {expensesForDay.length === 0 ? (
              <div className="py-6 text-center text-muted-foreground text-sm">No expenses recorded on this day</div>
            ) : (
              <div className="space-y-2">
                {expensesForDay.map(e => (
                  <div key={e.id} className="flex items-center justify-between p-3 rounded-lg bg-red-50 border border-red-100">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground">{e.description || e.category}</p>
                      <p className="text-xs text-muted-foreground">{e.id} · {e.category}</p>
                    </div>
                    <p className="text-sm font-bold text-red-600 flex-shrink-0">{e.amount.toLocaleString()} EGP</p>
                  </div>
                ))}
                <div className="pt-2 flex justify-between text-sm font-bold border-t border-border">
                  <span>Total Spent</span>
                  <span className="text-red-600">{totalExpenses.toLocaleString()} EGP</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
