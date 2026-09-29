import { useState, useEffect } from "react";
import { ShieldCheck, Filter } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import { useAuditLogs } from "@/hooks/use-data";
import { format } from "date-fns";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

const actionTypeColors: Record<string, string> = {
  override_checkin: "bg-red-100 text-red-700 border-red-200",
  delete_checkin: "bg-red-100 text-red-700 border-red-200",
  edit_payment: "bg-amber-100 text-amber-700 border-amber-200",
  apply_discount: "bg-blue-100 text-blue-700 border-blue-200",
  remove_discount: "bg-violet-100 text-violet-700 border-violet-200",
  checkin: "bg-emerald-100 text-emerald-700 border-emerald-200",
  other: "bg-gray-100 text-gray-700 border-gray-200",
};

const actionTypeLabels: Record<string, string> = {
  override_checkin: "Override Check-in",
  delete_checkin: "Delete Check-in",
  edit_payment: "Edit Payment",
  apply_discount: "Apply Discount",
  remove_discount: "Remove Discount",
  checkin: "Check-in",
  other: "Other",
};

export default function AuditLog() {
  const { data: auditLogs = [] } = useAuditLogs();
  const [filter, setFilter] = useState("all");
  const [accountFilter, setAccountFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  const filtered = auditLogs.filter(l => {
    if (filter !== "all" && l.action_type !== filter) return false;
    if (accountFilter !== "all" && l.performer_name !== accountFilter) return false;
    if (dateFilter) {
      const logDate = l.timestamp.split("T")[0];
      if (logDate !== dateFilter) return false;
    }
    return true;
  });

  useEffect(() => {
    setCurrentPage(1);
  }, [filter, accountFilter, dateFilter]);

  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const paginatedLogs = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const uniquePerformers = [...new Set(auditLogs.map(l => l.performer_name).filter(Boolean))];

  const userCounts = auditLogs.reduce((acc, log) => {
    const user = log.performer_name;
    acc[user] = (acc[user] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Audit Log</h1>
        <p className="text-sm text-muted-foreground">Complete record of all critical actions</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Object.entries(actionTypeLabels).filter(([k]) => k !== 'other').map(([key, label]) => {
          const count = auditLogs.filter(l => l.action_type === key).length;
          return (
            <div key={key} className={`p-3 rounded-xl border text-center ${actionTypeColors[key]}`}>
              <p className="text-xl font-bold">{count}</p>
              <p className="text-xs font-medium mt-0.5">{label}</p>
            </div>
          );
        })}
      </div>

      {/* Filter */}
      <div className="flex items-center gap-3 flex-wrap">
        <Filter className="w-4 h-4 text-muted-foreground" />
        <Input 
          type="date" 
          value={dateFilter} 
          onChange={e => setDateFilter(e.target.value)} 
          className="w-40"
        />
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger data-testid="select-audit-filter" className="w-52">
            <SelectValue placeholder="Filter by action..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Actions</SelectItem>
            <SelectItem value="override_checkin">Override Check-in</SelectItem>
            <SelectItem value="delete_checkin">Delete Check-in</SelectItem>
            <SelectItem value="edit_payment">Edit Payment</SelectItem>
            <SelectItem value="apply_discount">Apply Discount</SelectItem>
            <SelectItem value="remove_discount">Remove Discount</SelectItem>
            <SelectItem value="checkin">Check-in</SelectItem>
          </SelectContent>
        </Select>
        <Select value={accountFilter} onValueChange={setAccountFilter}>
          <SelectTrigger data-testid="select-audit-account" className="w-52">
            <SelectValue placeholder="Filter by account..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Accounts</SelectItem>
            {uniquePerformers.map(name => (
              <SelectItem key={name} value={name}>{name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {dateFilter && (
          <Button variant="ghost" size="sm" onClick={() => setDateFilter("")}>
            Clear Date
          </Button>
        )}
        <span className="text-sm text-muted-foreground ml-auto">{filtered.length} result{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Log entries */}
      {filtered.length === 0 ? (
        <Card><CardContent className="py-12 text-center"><p className="text-muted-foreground">No audit entries found</p></CardContent></Card>
      ) : (
        <div className="space-y-4">
          <div className="space-y-2">
            {paginatedLogs.map(log => (
              <div
                key={log.id}
                data-testid={`audit-entry-${log.id}`}
                className="flex items-start gap-4 p-4 rounded-lg border bg-card hover:bg-accent transition-colors"
              >
                <div className="flex-shrink-0 mt-0.5">
                  <ShieldCheck className={`w-5 h-5 ${
                    log.action_type === 'override_checkin' ? 'text-red-500' :
                    log.action_type === 'delete_checkin' ? 'text-red-500' :
                    log.action_type === 'edit_payment' ? 'text-amber-500' :
                    log.action_type === 'apply_discount' || log.action_type === 'remove_discount' ? 'text-blue-500' :
                    'text-emerald-500'
                  }`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${actionTypeColors[log.action_type] || actionTypeColors.other}`}>
                      {actionTypeLabels[log.action_type] || log.action_type}
                    </span>
                    <span className="text-sm font-medium text-foreground">{log.action}</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">{log.details}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-medium text-foreground">{log.performer_name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{format(new Date(log.timestamp), "dd/MM, HH:mm")}</p>
                </div>
              </div>
            ))}
          </div>
          
          {totalPages > 1 && (
            <div className="flex justify-center items-center gap-4 py-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="w-4 h-4 mr-1" /> Prev
              </Button>
              <span className="text-sm font-medium text-muted-foreground">
                Page {currentPage} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
              >
                Next <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Staff activity */}
      {Object.keys(userCounts).length > 0 && (
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Staff Activity</p>
            <div className="flex flex-wrap gap-3">
              {Object.entries(userCounts).map(([user, count]) => (
                <div key={user} className="flex items-center gap-2 px-3 py-1.5 rounded-full border bg-muted/50">
                  <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center">
                    <span className="text-xs font-bold text-primary">{user.charAt(0)}</span>
                  </div>
                  <span className="text-sm font-medium text-foreground">{user}</span>
                  <Badge variant="secondary" className="text-xs">{count}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
