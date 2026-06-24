import { useState } from "react";
import { ShieldCheck, Filter } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import { useAppState } from "@/lib/store";
import { format } from "date-fns";
import { AuditLog as AuditLogType } from "@/lib/mock-data";

const actionTypeColors: Record<string, string> = {
  override_checkin: "bg-red-100 text-red-700 border-red-200",
  edit_payment: "bg-amber-100 text-amber-700 border-amber-200",
  apply_discount: "bg-blue-100 text-blue-700 border-blue-200",
  remove_discount: "bg-violet-100 text-violet-700 border-violet-200",
  checkin: "bg-emerald-100 text-emerald-700 border-emerald-200",
  other: "bg-gray-100 text-gray-700 border-gray-200",
};

const actionTypeLabels: Record<string, string> = {
  override_checkin: "Override Check-in",
  edit_payment: "Edit Payment",
  apply_discount: "Apply Discount",
  remove_discount: "Remove Discount",
  checkin: "Check-in",
  other: "Other",
};

export default function AuditLog() {
  const { state } = useAppState();
  const [filter, setFilter] = useState("all");

  const filtered = state.auditLogs.filter(l => filter === "all" || l.actionType === filter);

  const userCounts = state.auditLogs.reduce((acc, log) => {
    acc[log.performedBy] = (acc[log.performedBy] || 0) + 1;
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
          const count = state.auditLogs.filter(l => l.actionType === key).length;
          return (
            <div key={key} className={`p-3 rounded-xl border text-center ${actionTypeColors[key]}`}>
              <p className="text-xl font-bold">{count}</p>
              <p className="text-xs font-medium mt-0.5">{label}</p>
            </div>
          );
        })}
      </div>

      {/* Filter */}
      <div className="flex items-center gap-3">
        <Filter className="w-4 h-4 text-muted-foreground" />
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger data-testid="select-audit-filter" className="w-52">
            <SelectValue placeholder="Filter by action..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Actions ({state.auditLogs.length})</SelectItem>
            <SelectItem value="override_checkin">Override Check-in</SelectItem>
            <SelectItem value="edit_payment">Edit Payment</SelectItem>
            <SelectItem value="apply_discount">Apply Discount</SelectItem>
            <SelectItem value="remove_discount">Remove Discount</SelectItem>
            <SelectItem value="checkin">Check-in</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground">{filtered.length} result{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Log entries */}
      {filtered.length === 0 ? (
        <Card><CardContent className="py-12 text-center"><p className="text-muted-foreground">No audit entries found</p></CardContent></Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((log: AuditLogType) => (
            <div
              key={log.id}
              data-testid={`audit-entry-${log.id}`}
              className="flex items-start gap-4 p-4 rounded-lg border bg-card hover:bg-accent transition-colors"
            >
              <div className="flex-shrink-0 mt-0.5">
                <ShieldCheck className={`w-5 h-5 ${
                  log.actionType === 'override_checkin' ? 'text-red-500' :
                  log.actionType === 'edit_payment' ? 'text-amber-500' :
                  log.actionType === 'apply_discount' || log.actionType === 'remove_discount' ? 'text-blue-500' :
                  'text-emerald-500'
                }`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${actionTypeColors[log.actionType]}`}>
                    {actionTypeLabels[log.actionType]}
                  </span>
                  <span className="text-sm font-medium text-foreground">{log.action}</span>
                </div>
                <p className="text-sm text-muted-foreground mt-1">{log.details}</p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-sm font-medium text-foreground">{log.performedBy}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{format(new Date(log.timestamp), "dd MMM, HH:mm")}</p>
              </div>
            </div>
          ))}
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
