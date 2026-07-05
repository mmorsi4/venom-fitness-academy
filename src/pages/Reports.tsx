import { useState, useMemo } from "react";
import { Filter, Download, Users, TrendingUp, FileSpreadsheet, Printer } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import StatusBadge from "@/components/StatusBadge";
import { SearchableSelect } from "@/components/SearchableSelect";
import type { MemberStatus } from "@/lib/types";
import { useMembers, useInvoices, useExpenses, useCoaches, useSports, useClasses, usePackages } from "@/hooks/use-data";
import { format, differenceInYears, parseISO } from "date-fns";

const ALL_STATUSES: MemberStatus[] = ['active', 'expired', 'expiring_soon', 'has_debt'];

function calcAge(birthDate?: string | null) {
  if (!birthDate) return null;
  try { return differenceInYears(new Date(), parseISO(birthDate)); } catch { return null; }
}

export default function Reports() {
  const { data: members = [] } = useMembers();
  const { data: invoices = [] } = useInvoices();
  const { data: expenses = [] } = useExpenses();
  const { data: coaches = [] } = useCoaches();
  const { data: sports = [] } = useSports();
  const { data: classes = [] } = useClasses();
  const { data: packages = [] } = usePackages();

  const profitabilityByCoach = useMemo(() => {
    return coaches.map(coach => {
      const coachMembers = members.filter(m => (m.class_info?.coach_name || m.coach_name) === coach.name);
      const memberIds = new Set(coachMembers.map(m => m.uuid));

      const revenue = invoices
        .filter(inv => memberIds.has(inv.member_id) && inv.status === 'paid')
        .reduce((sum, inv) => sum + inv.paid_amount, 0);

      const coachExpenses = expenses
        .filter(exp => exp.category === coach.name || exp.description.includes(coach.name))
        .reduce((sum, exp) => sum + exp.amount, 0);

      return {
        name: coach.name,
        membersCount: coachMembers.length,
        revenue,
        expenses: coachExpenses,
        net: revenue - coachExpenses
      };
    }).sort((a, b) => b.net - a.net);
  }, [coaches, members, invoices, expenses]);

  const [filters, setFilters] = useState({
    status: "all", gender: "all",
    package: "all", coach: "all", sport: "all", class: "all", expiringWithin: "all",
  });

  const setFilter = (key: string, value: string) =>
    setFilters(prev => ({ ...prev, [key]: value }));

  const filtered = useMemo(() => {
    return members.filter(m => {
      if (filters.status !== 'all' && m.status !== filters.status) return false;
      if (filters.gender !== 'all' && m.gender !== filters.gender) return false;
      if (filters.package !== 'all' && m.package_name !== filters.package) return false;
      if (filters.coach !== 'all' && (m.class_info?.coach_name || m.coach_name) !== filters.coach) return false;
      if (filters.sport !== 'all' && m.class_info?.sport_name !== filters.sport) return false;
      if (filters.class !== 'all' && m.class_info?.name !== filters.class) return false;
      if (filters.expiringWithin !== 'all') {
        const days = Number(filters.expiringWithin);
        if (!m.expires_at) return false;
        const daysUntilExpiry = Math.ceil((new Date(m.expires_at).getTime() - Date.now()) / 86400000);
        if (daysUntilExpiry > days || daysUntilExpiry < 0) return false;
      }
      return true;
    });
  }, [members, filters]);

  const uniquePackagesSet = new Set(members.map(m => m.package_name).filter(Boolean) as string[]);
  packages.forEach(p => uniquePackagesSet.add(p.name));
  const allPackageNames = Array.from(uniquePackagesSet).sort();
  const uniqueCoachesSet = new Set(members.map(m => m.class_info?.coach_name || m.coach_name).filter(Boolean) as string[]);
  coaches.forEach(c => uniqueCoachesSet.add(c.name));
  const allCoachNames = Array.from(uniqueCoachesSet).sort();

  const uniqueSportsSet = new Set(members.map(m => m.class_info?.sport_name).filter(Boolean) as string[]);
  sports.forEach(s => uniqueSportsSet.add(s.name));
  const allSportNames = Array.from(uniqueSportsSet).sort();

  const uniqueClassesSet = new Set(members.map(m => m.class_info?.name).filter(Boolean) as string[]);
  classes.forEach(c => uniqueClassesSet.add(c.name));
  const allClassNames = Array.from(uniqueClassesSet).sort();

  const statsForFiltered = {
    total: filtered.length,
    active: filtered.filter(m => m.status === 'active').length,
    male: filtered.filter(m => m.gender === 'male').length,
    female: filtered.filter(m => m.gender === 'female').length,
    avgSessionsLeft: filtered.length > 0
      ? Math.round(filtered.reduce((s, m) => s + (m.sessions_remaining === 999 ? 0 : m.sessions_remaining), 0) / filtered.length)
      : 0,
  };

  const activeFiltersCount = Object.values(filters).filter(v => v !== 'all').length;
  const handleClearFilters = () =>
    setFilters({ status: "all", gender: "all", package: "all", coach: "all", sport: "all", class: "all", expiringWithin: "all" });

  // ---- Export helpers ----
  const exportToExcel = async () => {
    const XLSX = await import('xlsx');
    const rows = filtered.map(m => ({
      "ID": m.id,
      "Name": m.name,
      "Phone": m.phone,
      "Parent Phone": m.parent_phone ?? "",
      "Birth Date": m.birth_date ?? "",
      "Age": calcAge(m.birth_date) ?? "",
      "Gender": m.gender ?? "",
      "Status": m.status,
      "Package": m.package_name,
      "Sessions Remaining": m.sessions_remaining === 999 ? "Unlimited" : m.sessions_remaining,
      "Expires": m.expires_at ? format(new Date(m.expires_at), "dd/MM/yyyy") : "—",
      "Member Since": format(new Date(m.member_since), "dd/MM/yyyy"),
      "Class": m.class_info?.name ?? "",
      "Sport": m.class_info?.sport_name ?? "",
      "Coach": m.class_info?.coach_name || m.coach_name || "",
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Members");
    XLSX.writeFile(wb, `venom_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
  };

  const exportToPDF = async () => {
    const { default: jsPDF } = await import('jspdf');
    const { default: autoTable } = await import('jspdf-autotable');
    const doc = new jsPDF({ orientation: 'landscape' });

    doc.setFontSize(16);
    doc.text('Venom Fitness Academy Member Report', 14, 15);
    doc.setFontSize(10);
    doc.text(`Generated: ${format(new Date(), 'dd MMM yyyy HH:mm')}  |  Filters: ${activeFiltersCount > 0 ? `${activeFiltersCount} active` : 'None'}  |  Total: ${filtered.length}`, 14, 22);

    autoTable(doc, {
      startY: 28,
      head: [['ID', 'Name', 'Phone', 'Gender', 'Status', 'Package', 'Sessions', 'Class', 'Coach']],
      body: filtered.map(m => [
        m.id, m.name, m.phone,
        m.gender ?? '—',
        m.status.replace('_', ' '),
        m.package_name,
        m.sessions_remaining === 999 ? '∞' : m.sessions_remaining,
        m.class_info?.name ?? '—',
        m.class_info?.coach_name || m.coach_name || '—',
      ]),
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [37, 99, 235], textColor: 255, fontSize: 8 },
      alternateRowStyles: { fillColor: [248, 250, 252] },
    });

    doc.save(`venom_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Member Reports</h1>
          <p className="text-sm text-muted-foreground">Filter and analyze member data</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2" onClick={exportToExcel} disabled={filtered.length === 0}>
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" /> Export Excel
          </Button>
          <Button variant="outline" className="gap-2" onClick={exportToPDF} disabled={filtered.length === 0}>
            <Printer className="w-4 h-4 text-red-600" /> Export PDF
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-muted-foreground" />
              Filter Members
              {activeFiltersCount > 0 && <Badge className="text-xs">{activeFiltersCount} active</Badge>}
            </span>
            {activeFiltersCount > 0 && (
              <Button variant="ghost" size="sm" onClick={handleClearFilters} className="text-xs h-7">Clear All</Button>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-3">
            {[
              { key: 'status', label: 'Status', options: [['all', 'All Statuses'], ...ALL_STATUSES.map(s => [s, s.replace('_', ' ')])] },
              { key: 'gender', label: 'Gender', options: [['all', 'All Genders'], ['male', 'Male'], ['female', 'Female']] },
              { key: 'expiringWithin', label: 'Expiring Within', options: [['all', 'Any Time'], ['7', '7 days'], ['14', '14 days'], ['30', '30 days']] },
            ].map(({ key, label, options }) => (
              <div key={key} className="flex-1 min-w-[140px] space-y-1.5">
                <Label className="text-xs">{label}</Label>
                <Select value={filters[key as keyof typeof filters]} onValueChange={v => setFilter(key, v)}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {options.map(([val, lbl]) => (
                      <SelectItem key={val} value={val}>{lbl}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
            <div className="flex-1 min-w-[140px] space-y-1.5">
              <Label className="text-xs">Package</Label>
              <SearchableSelect
                options={[
                  { value: 'all', label: 'All Packages' },
                  ...allPackageNames.map(p => ({ value: p, label: p, searchTerms: p }))
                ]}
                value={filters.package}
                onValueChange={v => setFilter('package', v)}
                placeholder="All Packages"
                searchPlaceholder="Search package..."
                className="h-8 text-xs"
              />
            </div>
            <div className="flex-1 min-w-[140px] space-y-1.5">
              <Label className="text-xs">Coach</Label>
              <SearchableSelect
                options={[
                  { value: 'all', label: 'All Coaches' },
                  ...allCoachNames.map(c => ({ value: c, label: c, searchTerms: c }))
                ]}
                value={filters.coach}
                onValueChange={v => setFilter('coach', v)}
                placeholder="All Coaches"
                searchPlaceholder="Search coach..."
                className="h-8 text-xs"
              />
            </div>
            <div className="flex-1 min-w-[140px] space-y-1.5">
              <Label className="text-xs">Sport</Label>
              <SearchableSelect
                options={[
                  { value: 'all', label: 'All Sports' },
                  ...allSportNames.map(c => ({ value: c, label: c, searchTerms: c }))
                ]}
                value={filters.sport}
                onValueChange={v => setFilter('sport', v)}
                placeholder="All Sports"
                searchPlaceholder="Search sport..."
                className="h-8 text-xs"
              />
            </div>
            <div className="flex-1 min-w-[140px] space-y-1.5">
              <Label className="text-xs">Class</Label>
              <SearchableSelect
                options={[
                  { value: 'all', label: 'All Classes' },
                  ...allClassNames.map(c => ({ value: c, label: c, searchTerms: c }))
                ]}
                value={filters.class}
                onValueChange={v => setFilter('class', v)}
                placeholder="All Classes"
                searchPlaceholder="Search class..."
                className="h-8 text-xs"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        {[
          { label: "Total", value: statsForFiltered.total, color: "text-foreground" },
          { label: "Active", value: statsForFiltered.active, color: "text-emerald-600" },
          { label: "Male", value: statsForFiltered.male, color: "text-blue-600" },
          { label: "Female", value: statsForFiltered.female, color: "text-pink-600" },
          { label: "Avg Sessions Left", value: statsForFiltered.avgSessionsLeft, color: "text-primary" },
        ].map(({ label, value, color }) => (
          <div key={label} className="p-3 rounded-xl border bg-card text-center">
            <p className={`text-xl font-bold ${color}`}>{value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Profitability Analytics */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-emerald-600" />
            Profitability by Coach
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="text-left p-3 text-xs font-semibold text-muted-foreground">Coach</th>
                  <th className="text-right p-3 text-xs font-semibold text-muted-foreground">Members</th>
                  <th className="text-right p-3 text-xs font-semibold text-emerald-600">Total Revenue</th>
                  <th className="text-right p-3 text-xs font-semibold text-red-600">Total Expenses</th>
                  <th className="text-right p-3 text-xs font-semibold text-primary">Net Profit/Loss</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {profitabilityByCoach.map(p => (
                  <tr key={p.name} className="hover:bg-muted/30 transition-colors">
                    <td className="p-3 font-medium text-foreground">{p.name}</td>
                    <td className="p-3 text-right">{p.membersCount}</td>
                    <td className="p-3 text-right text-emerald-600">{p.revenue.toLocaleString()} EGP</td>
                    <td className="p-3 text-right text-red-600">{p.expenses.toLocaleString()} EGP</td>
                    <td className="p-3 text-right font-bold text-primary">{p.net.toLocaleString()} EGP</td>
                  </tr>
                ))}
                {profitabilityByCoach.length === 0 && (
                  <tr><td colSpan={5} className="text-center py-6 text-muted-foreground">No coaches found</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Results table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Users className="w-4 h-4 text-muted-foreground" />
            Results — {filtered.length} member{filtered.length !== 1 ? 's' : ''}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground text-sm">No members match the selected filters</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30">
                    {['Member', 'Contact', 'Status', 'Package', 'Class', 'Coach', 'Sessions', 'Expires'].map(h => (
                      <th key={h} className="text-left p-3 text-xs font-semibold text-muted-foreground">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filtered.map(m => {
                    const age = calcAge(m.birth_date);
                    return (
                      <tr key={m.uuid} data-testid={`report-row-${m.uuid}`} className="hover:bg-muted/30 transition-colors">
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                              <span className="text-xs font-bold text-primary">{m.name.charAt(0)}</span>
                            </div>
                            <div>
                              <p className="font-medium text-foreground">{m.name}</p>
                              <p className="text-xs text-muted-foreground">{m.id === -1 ? 'Clinic Visitor' : m.id}{age !== null && ` · ${age}y`}{m.gender && ` · ${m.gender}`}</p>
                            </div>
                          </div>
                        </td>
                        <td className="p-3">
                          <p className="text-foreground">{m.phone}</p>
                          {m.parent_phone && <p className="text-xs text-muted-foreground">Parent: {m.parent_phone}</p>}
                        </td>
                        <td className="p-3"><StatusBadge status={m.status} /></td>
                        <td className="p-3"><p className="text-foreground">{m.package_name}</p></td>
                        <td className="p-3">
                          <p className="text-foreground text-xs">{m.class_info?.name || '—'}</p>
                          {m.class_info?.sport_name && <p className="text-[10px] text-muted-foreground">{m.class_info.sport_name}</p>}
                        </td>
                        <td className="p-3"><p className="text-foreground text-xs">{m.class_info?.coach_name || m.coach_name || '—'}</p></td>
                        <td className="p-3">
                          <p className="font-medium text-foreground">
                            {m.sessions_remaining === 999 ? '∞' : m.sessions_remaining}
                          </p>
                        </td>
                        <td className="p-3"><p className="text-foreground">{m.expires_at ? format(new Date(m.expires_at), "dd/MM/yyyy") : "—"}</p></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>


    </div>
  );
}
