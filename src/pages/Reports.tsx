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
import type { MemberStatus } from "@/lib/types";
import { useMembers } from "@/hooks/use-data";
import { format, differenceInYears, parseISO } from "date-fns";

const ALL_STATUSES: MemberStatus[] = ['active', 'expired', 'expiring_soon', 'has_debt'];
const SOURCES = ["Walk-in", "Referral", "Facebook", "Instagram", "WhatsApp"];

function calcAge(birthDate?: string | null) {
  if (!birthDate) return null;
  try { return differenceInYears(new Date(), parseISO(birthDate)); } catch { return null; }
}

export default function Reports() {
  const { data: members = [] } = useMembers();

  const [filters, setFilters] = useState({
    status: "all", gender: "all", source: "all",
    package: "all", coach: "all", expiringWithin: "all",
  });

  const setFilter = (key: string, value: string) =>
    setFilters(prev => ({ ...prev, [key]: value }));

  const filtered = useMemo(() => {
    return members.filter(m => {
      if (filters.status !== 'all' && m.status !== filters.status) return false;
      if (filters.gender !== 'all' && m.gender !== filters.gender) return false;
      if (filters.source !== 'all' && m.source !== filters.source) return false;
      if (filters.package !== 'all' && m.package_name !== filters.package) return false;
      if (filters.coach !== 'all' && m.coach_name !== filters.coach) return false;
      if (filters.expiringWithin !== 'all') {
        const days = Number(filters.expiringWithin);
        const daysUntilExpiry = Math.ceil((new Date(m.expires_at).getTime() - Date.now()) / 86400000);
        if (daysUntilExpiry > days || daysUntilExpiry < 0) return false;
      }
      return true;
    });
  }, [members, filters]);

  const uniquePackages = [...new Set(members.map(m => m.package_name).filter(Boolean))];
  const uniqueCoaches = [...new Set(members.map(m => m.coach_name).filter(Boolean) as string[])];

  const statsForFiltered = {
    total: filtered.length,
    active: filtered.filter(m => m.status === 'active').length,
    male: filtered.filter(m => m.gender === 'male').length,
    female: filtered.filter(m => m.gender === 'female').length,
    totalSessions: filtered.reduce((s, m) => s + (m.total_sessions === 999 ? 0 : m.total_sessions), 0),
    avgSessionsLeft: filtered.length > 0
      ? Math.round(filtered.reduce((s, m) => s + (m.sessions_remaining === 999 ? 0 : m.sessions_remaining), 0) / filtered.length)
      : 0,
  };

  const activeFiltersCount = Object.values(filters).filter(v => v !== 'all').length;
  const handleClearFilters = () =>
    setFilters({ status: "all", gender: "all", source: "all", package: "all", coach: "all", expiringWithin: "all" });

  // ---- Export helpers ----
  const exportToExcel = async () => {
    const XLSX = await import('xlsx');
    const rows = filtered.map(m => ({
      "ID": m.display_id,
      "Name": m.name,
      "Phone": m.phone,
      "Parent Phone": m.parent_phone ?? "",
      "Birth Date": m.birth_date ?? "",
      "Age": calcAge(m.birth_date) ?? "",
      "Gender": m.gender ?? "",
      "Status": m.status,
      "Package": m.package_name,
      "Sessions Remaining": m.sessions_remaining === 999 ? "Unlimited" : m.sessions_remaining,
      "Total Sessions": m.total_sessions === 999 ? "Unlimited" : m.total_sessions,
      "Expires": format(new Date(m.expires_at), "dd MMM yyyy"),
      "Member Since": format(new Date(m.member_since), "dd MMM yyyy"),
      "Coach": m.coach_name ?? "",
      "Source": m.source,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Members");
    XLSX.writeFile(wb, `GymPro_Members_${format(new Date(), 'yyyyMMdd')}.xlsx`);
  };

  const exportToPDF = async () => {
    const { default: jsPDF } = await import('jspdf');
    const { default: autoTable } = await import('jspdf-autotable');
    const doc = new jsPDF({ orientation: 'landscape' });

    doc.setFontSize(16);
    doc.text('GymPro Member Report', 14, 15);
    doc.setFontSize(10);
    doc.text(`Generated: ${format(new Date(), 'dd MMM yyyy HH:mm')}  |  Filters: ${activeFiltersCount > 0 ? `${activeFiltersCount} active` : 'None'}  |  Total: ${filtered.length}`, 14, 22);

    autoTable(doc, {
      startY: 28,
      head: [['ID', 'Name', 'Phone', 'Gender', 'Status', 'Package', 'Sessions', 'Expires', 'Coach', 'Source']],
      body: filtered.map(m => [
        m.display_id, m.name, m.phone,
        m.gender ?? '—',
        m.status.replace('_', ' '),
        m.package_name,
        m.sessions_remaining === 999 ? '∞' : `${m.sessions_remaining}/${m.total_sessions}`,
        format(new Date(m.expires_at), 'dd MMM yy'),
        m.coach_name ?? '—',
        m.source,
      ]),
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [37, 99, 235], textColor: 255, fontSize: 8 },
      alternateRowStyles: { fillColor: [248, 250, 252] },
    });

    doc.save(`GymPro_Members_${format(new Date(), 'yyyyMMdd')}.pdf`);
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
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
            {[
              { key: 'status', label: 'Status', options: [['all', 'All Statuses'], ...ALL_STATUSES.map(s => [s, s.replace('_', ' ')])] },
              { key: 'gender', label: 'Gender', options: [['all', 'All Genders'], ['male', 'Male'], ['female', 'Female']] },
              { key: 'source', label: 'Source', options: [['all', 'All Sources'], ...SOURCES.map(s => [s, s])] },
              { key: 'package', label: 'Package', options: [['all', 'All Packages'], ...uniquePackages.map(p => [p, p])] },
              { key: 'coach', label: 'Coach', options: [['all', 'All Coaches'], ...uniqueCoaches.map(c => [c, c])] },
              { key: 'expiringWithin', label: 'Expiring Within', options: [['all', 'Any Time'], ['7', '7 days'], ['14', '14 days'], ['30', '30 days']] },
            ].map(({ key, label, options }) => (
              <div key={key} className="space-y-1.5">
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
          { label: "Total Sessions", value: statsForFiltered.totalSessions, color: "text-violet-600" },
          { label: "Avg Sessions Left", value: statsForFiltered.avgSessionsLeft, color: "text-primary" },
        ].map(({ label, value, color }) => (
          <div key={label} className="p-3 rounded-xl border bg-card text-center">
            <p className={`text-xl font-bold ${color}`}>{value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
          </div>
        ))}
      </div>

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
                    {['Member', 'Contact', 'Status', 'Package', 'Coach', 'Sessions', 'Expires', 'Source'].map(h => (
                      <th key={h} className="text-left p-3 text-xs font-semibold text-muted-foreground">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filtered.map(m => {
                    const age = calcAge(m.birth_date);
                    return (
                      <tr key={m.id} data-testid={`report-row-${m.id}`} className="hover:bg-muted/30 transition-colors">
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                              <span className="text-xs font-bold text-primary">{m.name.charAt(0)}</span>
                            </div>
                            <div>
                              <p className="font-medium text-foreground">{m.name}</p>
                              <p className="text-xs text-muted-foreground">{m.display_id}{age !== null && ` · ${age}y`}{m.gender && ` · ${m.gender}`}</p>
                            </div>
                          </div>
                        </td>
                        <td className="p-3">
                          <p className="text-foreground">{m.phone}</p>
                          {m.parent_phone && <p className="text-xs text-muted-foreground">Parent: {m.parent_phone}</p>}
                        </td>
                        <td className="p-3"><StatusBadge status={m.status} /></td>
                        <td className="p-3"><p className="text-foreground">{m.package_name}</p></td>
                        <td className="p-3"><p className="text-foreground text-xs">{m.coach_name || '—'}</p></td>
                        <td className="p-3">
                          <p className="font-medium text-foreground">
                            {m.sessions_remaining === 999 ? '∞' : m.sessions_remaining}
                            <span className="text-xs text-muted-foreground">/{m.total_sessions === 999 ? '∞' : m.total_sessions}</span>
                          </p>
                        </td>
                        <td className="p-3"><p className="text-foreground">{format(new Date(m.expires_at), "dd MMM yyyy")}</p></td>
                        <td className="p-3"><Badge variant="outline" className="text-xs">{m.source}</Badge></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {filtered.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-muted-foreground" /> Source Breakdown (filtered)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {SOURCES.map(source => {
                const count = filtered.filter(m => m.source === source).length;
                const pct = filtered.length > 0 ? Math.round((count / filtered.length) * 100) : 0;
                return (
                  <div key={source} className="p-3 rounded-lg border bg-muted/30 text-center">
                    <p className="text-lg font-bold text-foreground">{count}</p>
                    <p className="text-xs text-muted-foreground">{source}</p>
                    {pct > 0 && <p className="text-xs text-primary font-medium mt-0.5">{pct}%</p>}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
