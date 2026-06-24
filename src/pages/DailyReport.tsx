import { useState, useMemo } from "react";
import {
  CalendarDays, Users, DollarSign, TrendingDown, TrendingUp,
  Clock, CheckCircle2, CreditCard, AlertTriangle
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAppState } from "@/lib/store";
import { MOCK_SESSIONS } from "@/lib/mock-data";
import { format, isSameDay, subDays, addDays, parseISO } from "date-fns";

function isoToDate(s: string) {
  try { return parseISO(s); } catch { return new Date(); }
}

const DAYS_OF_WEEK = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default function DailyReport() {
  const { state } = useAppState();
  const [selectedDate, setSelectedDate] = useState(new Date());

  const dateStr = format(selectedDate, "yyyy-MM-dd");
  const dayOfWeek = DAYS_OF_WEEK[selectedDate.getDay()];
  const isToday = isSameDay(selectedDate, new Date());

  // Sessions for this day of week
  const sessionsForDay = MOCK_SESSIONS.filter(s => s.dayOfWeek === dayOfWeek);

  // Check-ins from audit log for selected date
  const checkIns = useMemo(() =>
    state.auditLogs.filter(log =>
      (log.actionType === 'checkin' || log.actionType === 'override_checkin') &&
      isSameDay(isoToDate(log.timestamp), selectedDate)
    ), [state.auditLogs, selectedDate]);

  // Overrides for selected date
  const overrides = checkIns.filter(l => l.actionType === 'override_checkin');

  // Invoices created on this date
  const invoicesForDay = useMemo(() =>
    state.invoices.filter(i => isSameDay(isoToDate(i.createdAt), selectedDate)),
    [state.invoices, selectedDate]
  );

  // Expenses for this date
  const expensesForDay = useMemo(() =>
    state.expenses.filter(e => isSameDay(isoToDate(e.date), selectedDate)),
    [state.expenses, selectedDate]
  );

  const totalIncome = invoicesForDay.reduce((s, i) => s + i.paidAmount, 0);
  const totalExpenses = expensesForDay.reduce((s, e) => s + e.amount, 0);
  const netBalance = totalIncome - totalExpenses;
  const totalAttendance = sessionsForDay.reduce((s, s2) => s + (isToday ? s2.attendanceCount : s2.attendanceCount), 0);

  const cashIncome = invoicesForDay.filter(i => i.paymentMethod === 'Cash').reduce((s, i) => s + i.paidAmount, 0);
  const visaIncome = invoicesForDay.filter(i => i.paymentMethod === 'Visa').reduce((s, i) => s + i.paidAmount, 0);
  const instapayIncome = invoicesForDay.filter(i => i.paymentMethod === 'InstaPay').reduce((s, i) => s + i.paidAmount, 0);

  const prevDay = () => setSelectedDate(d => subDays(d, 1));
  const nextDay = () => setSelectedDate(d => {
    const next = addDays(d, 1);
    return next <= new Date() ? next : d;
  });

  const summaryCards = [
    { label: "Members Checked In", value: checkIns.length, icon: Users, color: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-100" },
    { label: "Sessions Today", value: sessionsForDay.length, icon: Clock, color: "text-blue-600", bg: "bg-blue-50", border: "border-blue-100" },
    { label: "Total Attendance", value: totalAttendance, icon: CheckCircle2, color: "text-violet-600", bg: "bg-violet-50", border: "border-violet-100" },
    { label: "Overrides", value: overrides.length, icon: AlertTriangle, color: overrides.length > 0 ? "text-red-600" : "text-muted-foreground", bg: overrides.length > 0 ? "bg-red-50" : "bg-muted/50", border: overrides.length > 0 ? "border-red-100" : "border-border" },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Header with date nav */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Daily Report</h1>
          <p className="text-sm text-muted-foreground">Day-by-day accounting and attendance</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={prevDay}>←</Button>
          <div className="flex items-center gap-2 px-4 py-2 rounded-lg border bg-card min-w-[200px] justify-center">
            <CalendarDays className="w-4 h-4 text-muted-foreground" />
            <span className="font-semibold text-foreground">{format(selectedDate, "EEEE, MMMM d, yyyy")}</span>
            {isToday && <Badge className="text-xs">Today</Badge>}
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
            <p className="text-xs text-muted-foreground mt-1">AED collected</p>
            <div className="flex flex-wrap gap-1.5 mt-3">
              {cashIncome > 0 && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">Cash: {cashIncome}</span>
              )}
              {visaIncome > 0 && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">Visa: {visaIncome}</span>
              )}
              {instapayIncome > 0 && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-violet-100 text-violet-700">InstaPay: {instapayIncome}</span>
              )}
              {totalIncome === 0 && <span className="text-xs text-muted-foreground">No payments</span>}
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
            <p className="text-xs text-muted-foreground mt-1">AED spent</p>
            {expensesForDay.length > 0 && (
              <p className="text-xs text-muted-foreground mt-3">{expensesForDay.length} expense record{expensesForDay.length > 1 ? 's' : ''}</p>
            )}
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
            <p className="text-xs text-muted-foreground mt-1">AED net for the day</p>
          </CardContent>
        </Card>
      </div>

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
            {sessionsForDay.length === 0 ? (
              <div className="py-6 text-center text-muted-foreground text-sm">No sessions scheduled on {dayOfWeek}</div>
            ) : (
              <div className="space-y-2">
                {sessionsForDay.map(session => {
                  const pct = Math.round((session.attendanceCount / session.capacity) * 100);
                  return (
                    <div key={session.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border border-border">
                      <div className="text-center min-w-[44px]">
                        <p className="text-sm font-bold text-foreground">{session.time}</p>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground">{session.name}</p>
                        <p className="text-xs text-muted-foreground">{session.coachName}</p>
                        <div className="mt-1.5 h-1.5 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-primary rounded-full" style={{ width: `${Math.min(pct, 100)}%` }} />
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-sm font-bold text-foreground">{session.attendanceCount}</p>
                        <p className="text-xs text-muted-foreground">/{session.capacity}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Members checked in */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center justify-between">
              <span className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                Members Checked In ({checkIns.length})
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {checkIns.length === 0 ? (
              <div className="py-6 text-center text-muted-foreground text-sm">No check-ins recorded for this day</div>
            ) : (
              <div className="space-y-2">
                {checkIns.map(log => (
                  <div key={log.id} className={`flex items-center gap-3 p-2.5 rounded-lg border ${log.actionType === 'override_checkin' ? 'bg-red-50 border-red-200' : 'bg-emerald-50 border-emerald-100'}`}>
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${log.actionType === 'override_checkin' ? 'bg-red-100' : 'bg-emerald-100'}`}>
                      {log.actionType === 'override_checkin'
                        ? <AlertTriangle className="w-3.5 h-3.5 text-red-600" />
                        : <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">{log.memberName || log.details.split('(')[1]?.split(')')[0] || 'Member'}</p>
                      {log.actionType === 'override_checkin' && (
                        <p className="text-xs text-red-600">Override — expired member</p>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground flex-shrink-0">{format(isoToDate(log.timestamp), "HH:mm")}</p>
                  </div>
                ))}
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
                  <div key={inv.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border border-border">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground">{inv.memberName}</p>
                      <p className="text-xs text-muted-foreground">{inv.id} · {inv.packageName}</p>
                      <p className="text-xs text-muted-foreground">{inv.paymentMethod}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-bold text-foreground">{inv.paidAmount.toLocaleString()} EGP</p>
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
                      <p className="text-xs text-muted-foreground">{e.category}</p>
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
