import { useLocation } from "wouter";
import { Users, LogIn, AlertTriangle, DollarSign, UserPlus, Clock, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useMembers, useInvoices, useLeads, useClasses, useCoaches, useTodayCheckIns, useCheckInCoach, useCoachCheckInsToday, useEmployees, useEmployeeCheckInsToday, useClockInEmployee, useClockOutEmployee } from "@/hooks/use-data";
import StatusBadge from "@/components/StatusBadge";
import { format } from "date-fns";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

export default function Dashboard() {
  const { currentUser } = useAuth();
  const [, setLocation] = useLocation();
  const { data: members = [] } = useMembers();
  const { data: invoices = [] } = useInvoices();
  const { data: leads = [] } = useLeads();
  const { data: classes = [] } = useClasses();
  const { data: coaches = [] } = useCoaches();
  const { data: checkIns = [] } = useCoachCheckInsToday();
  const checkInMutation = useCheckInCoach();

  const { data: employees = [] } = useEmployees();
  const { data: employeeCheckIns = [] } = useEmployeeCheckInsToday();
  const { data: memberCheckInsToday = [] } = useTodayCheckIns();
  const clockInMutation = useClockInEmployee();
  const clockOutMutation = useClockOutEmployee();

  const activeMembers = members.filter(m => m.status === 'active').length;
  const expiringSoon = members.filter(m => m.status === 'expiring_soon');
  const expired = members.filter(m => m.status === 'expired');
  const withDebt = members.filter(m => m.status === 'has_debt');
  const newLeads = leads.filter(l => l.status === 'New');
  const outstandingAmount = invoices
    .filter(i => i.status === 'partial' || i.status === 'unpaid')
    .reduce((sum, i) => sum + (i.total_amount - i.paid_amount), 0);

  const todayName = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][new Date().getDay()];
  const linkedCoach = coaches.find(c => c.user_id === currentUser?.id || c.name.toLowerCase() === currentUser?.name?.toLowerCase());
  const myClassesToday = linkedCoach 
    ? classes.filter(c => c.coach_id === linkedCoach.id && c.schedules?.some(s => s.day === todayName))
    : [];

  const linkedEmployee = employees.find(e => e.name.toLowerCase() === currentUser?.name?.toLowerCase());
  const myShiftToday = linkedEmployee
    ? employeeCheckIns.find(ci => ci.employee_id === linkedEmployee.id)
    : null;

  const myLeads = linkedEmployee ? leads.filter(l => l.assigned_to === linkedEmployee.id) : [];
  const myLeadsCount = myLeads.length;
  const myCallsMade = myLeads.reduce((s, l) => s + l.calls_made, 0);
  const myConvertedLeads = myLeads.filter(l => l.status === 'Converted').length;

  const todayStr = new Date().toISOString().split('T')[0];
  const myCheckInsToday = linkedEmployee ? memberCheckInsToday.filter(ci => ci.checked_in_by === linkedEmployee.name && ci.created_at.startsWith(todayStr)) : [];
  const myCheckInsCount = myCheckInsToday.length;

  const todayClasses = classes.slice(0, 4);

  const statCards = [
    { label: "Active Members", value: activeMembers, icon: Users, color: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-100" },
    { label: "Expiring Soon", value: expiringSoon.length, icon: AlertTriangle, color: "text-amber-600", bg: "bg-amber-50", border: "border-amber-100" },
    { label: "Expired Members", value: expired.length, icon: AlertTriangle, color: "text-red-600", bg: "bg-red-50", border: "border-red-100" },
    { label: "Outstanding (EGP)", value: outstandingAmount.toLocaleString(), icon: DollarSign, color: "text-purple-600", bg: "bg-purple-50", border: "border-purple-100" },
    { label: "New Leads", value: newLeads.length, icon: TrendingUp, color: "text-blue-600", bg: "bg-blue-50", border: "border-blue-100" },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{format(new Date(), "EEEE, dd/MM/yyyy")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button data-testid="btn-quick-checkin" onClick={() => setLocation("/checkin")} className="gap-2">
            <LogIn className="w-4 h-4" />
            Check In
          </Button>
          <Button data-testid="btn-quick-new-member" variant="outline" onClick={() => setLocation("/members")} className="gap-2">
            <Users className="w-4 h-4" />
            New Member
          </Button>
          <Button data-testid="btn-quick-new-lead" variant="outline" onClick={() => setLocation("/leads")} className="gap-2">
            <UserPlus className="w-4 h-4" />
            New Lead
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {statCards.map(({ label, value, icon: Icon, color, bg, border }) => (
          <Card key={label} className={`border ${border}`} data-testid={`stat-${label.toLowerCase().replace(/\s+/g, '-')}`}>
            <CardContent className="p-4">
              <div className={`w-9 h-9 rounded-lg ${bg} flex items-center justify-center mb-3`}>
                <Icon className={`w-4 h-4 ${color}`} />
              </div>
              <p className="text-2xl font-bold text-foreground">{value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
            </CardContent>
          </Card>
        ))}
      </div>


      {linkedEmployee && (
        <Card className="border-blue-600 bg-blue-50/50">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg text-blue-700">
              <Clock className="w-5 h-5" />
              My Shift ({linkedEmployee.name})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between p-4 rounded-lg bg-card border">
              <div>
                <p className="font-semibold text-foreground">
                  {myShiftToday 
                    ? (myShiftToday.check_out_time ? "Shift Completed" : "Clocked In")
                    : "Not Clocked In"}
                </p>
                {myShiftToday && (
                  <p className="text-sm text-muted-foreground mt-1">
                    Clock In: {format(new Date(myShiftToday.check_in_time || ""), "hh:mm a")}
                    {myShiftToday.check_out_time && ` • Clock Out: ${format(new Date(myShiftToday.check_out_time || ""), "hh:mm a")}`}
                  </p>
                )}
              </div>
              <div>
                {!myShiftToday ? (
                  <Button 
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                    disabled={clockInMutation.isPending}
                    onClick={() => clockInMutation.mutate(linkedEmployee.id, {
                      onSuccess: () => toast.success("Clocked in successfully")
                    })}
                  >
                    Clock In
                  </Button>
                ) : !myShiftToday.check_out_time ? (
                  <Button 
                    variant="outline"
                    className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                    disabled={clockOutMutation.isPending}
                    onClick={() => clockOutMutation.mutate(myShiftToday.id, {
                      onSuccess: () => toast.success("Clocked out successfully")
                    })}
                  >
                    Clock Out
                  </Button>
                ) : null}
              </div>
            </div>
            
            <div className="mt-6 pt-4 border-t border-blue-100">
              <h4 className="text-sm font-semibold text-blue-900 mb-3">My Performance Today</h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="bg-white rounded-md p-3 border border-blue-50 text-center">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Check-ins Processed</p>
                  <p className="text-xl font-bold text-blue-700 mt-1">{myCheckInsCount}</p>
                </div>
                <div className="bg-white rounded-md p-3 border border-blue-50 text-center">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Leads Assigned</p>
                  <p className="text-xl font-bold text-blue-700 mt-1">{myLeadsCount}</p>
                </div>
                <div className="bg-white rounded-md p-3 border border-blue-50 text-center">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Calls Made</p>
                  <p className="text-xl font-bold text-blue-700 mt-1">{myCallsMade}</p>
                </div>
                <div className="bg-white rounded-md p-3 border border-blue-50 text-center">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Converted</p>
                  <p className="text-xl font-bold text-emerald-600 mt-1">{myConvertedLeads}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Today's Classes */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Clock className="w-4 h-4 text-muted-foreground" />
              Recent Classes
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 pt-0">
            {todayClasses.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No classes available</p>
            ) : (
              todayClasses.map(c => (
                <div key={c.id} data-testid={`class-${c.id}`} className="flex items-center gap-3 p-2.5 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{c.name}</p>
                    <p className="text-xs text-muted-foreground">{c.coach_name ?? 'Unassigned'} • {c.sport_name ?? 'No Sport'}</p>
                  </div>
                  <Badge variant="secondary" className="text-xs shrink-0">{c.schedules?.length || 0} slots</Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Expiring Soon */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              Expiring Memberships
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 pt-0 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
            {expiringSoon.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No expiring memberships</p>
            ) : (
              expiringSoon.map(m => (
                <div key={m.uuid} data-testid={`expiring-${m.uuid}`} className="flex items-center gap-3 p-2.5 rounded-lg bg-muted/50">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">#{m.id} - {m.name}</p>
                    <p className="text-xs text-muted-foreground">{m.sessions_remaining} sessions left</p>
                  </div>
                  <StatusBadge status={m.status} />
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Outstanding Payments */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-purple-500" />
              Outstanding Payments
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 pt-0">
            {invoices.filter(i => i.status !== 'paid').length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No outstanding payments</p>
            ) : (
              invoices.filter(i => i.status !== 'paid').map(inv => (
                <div key={inv.uuid} data-testid={`outstanding-${inv.uuid}`} className="flex items-center gap-3 p-2.5 rounded-lg bg-muted/50">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{inv.member_name}</p>
                    <p className="text-xs text-muted-foreground">{inv.id}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-foreground">{(inv.total_amount - inv.paid_amount).toLocaleString()} EGP</p>
                    <Badge variant={inv.status === 'partial' ? 'secondary' : 'destructive'} className="text-xs capitalize">{inv.status}</Badge>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* New Leads */}
      {newLeads.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center justify-between">
              <span className="flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-blue-500" />
                New Leads
              </span>
              <Button variant="ghost" size="sm" onClick={() => setLocation("/leads")} className="text-xs h-7">View All</Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {newLeads.slice(0, 4).map(lead => (
                <div key={lead.id} data-testid={`lead-card-${lead.id}`} className="p-3 rounded-lg border bg-blue-50 border-blue-100">
                  <p className="text-sm font-medium text-foreground">{lead.name}</p>
                  <p className="text-xs text-muted-foreground">{lead.phone}</p>
                  <Badge variant="secondary" className="text-xs mt-1">{lead.source}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
