import { useLocation } from "wouter";
import { Users, LogIn, AlertTriangle, DollarSign, UserPlus, Clock, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useMembers, useInvoices, useLeads, useGymSessions } from "@/hooks/use-data";
import StatusBadge from "@/components/StatusBadge";
import { format } from "date-fns";

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const { data: members = [] } = useMembers();
  const { data: invoices = [] } = useInvoices();
  const { data: leads = [] } = useLeads();
  const { data: sessions = [] } = useGymSessions();

  const activeMembers = members.filter(m => m.status === 'active').length;
  const expiringSoon = members.filter(m => m.status === 'expiring_soon');
  const expired = members.filter(m => m.status === 'expired');
  const withDebt = members.filter(m => m.status === 'has_debt');
  const newLeads = leads.filter(l => l.status === 'New');
  const outstandingAmount = invoices
    .filter(i => i.status === 'partial' || i.status === 'unpaid')
    .reduce((sum, i) => sum + (i.total_amount - i.paid_amount), 0);

  const todaySessions = sessions.slice(0, 4);

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
          <p className="text-sm text-muted-foreground mt-0.5">{format(new Date(), "EEEE, MMMM d, yyyy")}</p>
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Today's Schedule */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Clock className="w-4 h-4 text-muted-foreground" />
              Today's Sessions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 pt-0">
            {todaySessions.map(s => (
              <div key={s.id} data-testid={`session-${s.id}`} className="flex items-center gap-3 p-2.5 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                <div className="text-center min-w-[42px]">
                  <p className="text-xs font-bold text-foreground">{s.time}</p>
                  <p className="text-xs text-muted-foreground">{s.day_of_week.slice(0,3)}</p>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{s.name}</p>
                  <p className="text-xs text-muted-foreground">{s.coach_name ?? 'Unassigned'}</p>
                </div>
                <Badge variant="secondary" className="text-xs">{s.attendance_count}/{s.capacity}</Badge>
              </div>
            ))}
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
          <CardContent className="space-y-2 pt-0">
            {[...expiringSoon, ...expired].slice(0, 5).length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No expiring memberships</p>
            ) : (
              [...expiringSoon, ...expired].slice(0, 5).map(m => (
                <div key={m.id} data-testid={`expiring-${m.id}`} className="flex items-center gap-3 p-2.5 rounded-lg bg-muted/50">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{m.name}</p>
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
                <div key={inv.id} data-testid={`outstanding-${inv.id}`} className="flex items-center gap-3 p-2.5 rounded-lg bg-muted/50">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{inv.member_name}</p>
                    <p className="text-xs text-muted-foreground">{inv.display_id}</p>
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
