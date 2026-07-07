import { useState, useMemo } from "react";
import { Shield, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useEmployees, useEmployeeCheckIns, useCreateEmployeeCheckIn } from "@/hooks/use-data";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { format, differenceInMinutes } from "date-fns";

export default function EmployeeCheckIn() {
  const { currentUser, isAdmin } = useAuth();
  const { data: employees = [] } = useEmployees();
  const { data: allCheckIns = [] } = useEmployeeCheckIns(
    new Date().getMonth(), new Date().getFullYear()
  );
  const createCheckIn = useCreateEmployeeCheckIn();

  const [hrSearch, setHrSearch] = useState("");

  const hrMatchedEmployee = useMemo(() => {
    if (!isAdmin) {
      return employees.find(e => e.user_id === currentUser?.id) || null;
    }
    if (!hrSearch.trim()) return null;
    const q = hrSearch.toLowerCase();
    return employees.find(e =>
      e.name.toLowerCase().includes(q) || e.phone.includes(q)
    ) || null;
  }, [hrSearch, employees, isAdmin, currentUser]);

  const handleHrCheckIn = () => {
    if (!hrMatchedEmployee) { toast.error("Employee not found"); return; }

    const now = new Date();
    let lateMinutes = 0;
    let deduction = 0;

    if (hrMatchedEmployee.shift_start) {
      const [sh, sm] = hrMatchedEmployee.shift_start.split(':').map(Number);
      const shiftStart = new Date(now);
      shiftStart.setHours(sh, sm, 0, 0);
      const threshold = hrMatchedEmployee.late_threshold_minutes;
      const diff = differenceInMinutes(now, shiftStart);
      if (diff > threshold) {
        lateMinutes = diff - threshold;
        deduction = lateMinutes * hrMatchedEmployee.deduction_per_minute;
      }
    }

    createCheckIn.mutate({
      employee_id: hrMatchedEmployee.id,
      checked_in_at: now.toISOString(),
      late_minutes: lateMinutes,
      deduction,
      notes: lateMinutes > 0 ? `Arrived ${lateMinutes} minutes late` : null,
    }, {
      onSuccess: () => {
        toast.success(
          lateMinutes > 0
            ? `Checked in — ${lateMinutes} min late, deduction: ${deduction.toFixed(0)} EGP`
            : `${hrMatchedEmployee.name} checked in on time!`
        );
        setHrSearch("");
      },
      onError: (e) => toast.error(`Error: ${e.message}`)
    });
  };

  const checkedInToday = allCheckIns.filter(ci => {
    const d = new Date(ci.checked_in_at || ci.check_in_time || ci.created_at || "");
    const today = new Date();
    return d.getDate() === today.getDate() && d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
  });

  return (
    <div className="p-6">
      <div className="max-w-md mx-auto space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Shield className="w-4 h-4 text-primary" /> Employee Self Check-in
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {isAdmin ? (
              <div className="space-y-1.5">
                <Label>Search by name or phone number</Label>
                <Input
                  placeholder="Enter employee name or phone..."
                  value={hrSearch}
                  onChange={e => setHrSearch(e.target.value)}
                  autoFocus
                />
              </div>
            ) : (
              <div className="text-sm text-muted-foreground text-center py-2">
                You are checking in as your linked staff account.
              </div>
            )}

            {hrMatchedEmployee && (
              <div className="p-3 rounded-lg bg-primary/5 border border-primary/20 space-y-2">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <span className="font-bold text-primary">{hrMatchedEmployee.name.charAt(0)}</span>
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">{hrMatchedEmployee.name}</p>
                    <p className="text-xs text-muted-foreground">{hrMatchedEmployee.department}</p>
                  </div>
                </div>
                {hrMatchedEmployee.shift_start && (
                  <div className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    Shift: {hrMatchedEmployee.shift_start} — {hrMatchedEmployee.shift_end}
                  </div>
                )}
              </div>
            )}

            <Button
              className="w-full"
              onClick={handleHrCheckIn}
              disabled={!hrMatchedEmployee || createCheckIn.isPending || (hrMatchedEmployee ? checkedInToday.some(ci => ci.employee_id === hrMatchedEmployee.id) : false)}
            >
              {createCheckIn.isPending ? "Recording..." : (hrMatchedEmployee && checkedInToday.some(ci => ci.employee_id === hrMatchedEmployee.id) ? "Already Checked In Today" : "✓ Check In Now")}
            </Button>

            {/* Today's check-ins */}
            {isAdmin && checkedInToday.length > 0 && (
              <div className="space-y-2 pt-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Today's Attendance</p>
                {checkedInToday.map(ci => {
                  const emp = employees.find(e => e.id === ci.employee_id);
                  return (
                    <div key={ci.id} className="flex items-center justify-between py-1.5 border-b border-border text-sm">
                      <span className="font-medium text-foreground">{emp?.name ?? "Unknown"}</span>
                      <div className="flex items-center gap-2">
                        {(ci.late_minutes || 0) > 0 && (
                          <Badge variant="outline" className="text-xs text-amber-600 border-amber-300">
                            +{(ci.late_minutes || 0)}min late
                          </Badge>
                        )}
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(ci.checked_in_at || ci.check_in_time || ci.created_at || ""), "HH:mm")}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
