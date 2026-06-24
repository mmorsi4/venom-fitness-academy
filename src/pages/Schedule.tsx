import { Clock, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell
} from "recharts";
import { useGymSessions } from "@/hooks/use-data";
import type { GymSession } from "@/lib/types";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default function Schedule() {
  const { data: sessions = [] } = useGymSessions();

  const sessionsByDay = DAYS.reduce((acc, day) => {
    acc[day] = sessions.filter(s => s.day_of_week === day);
    return acc;
  }, {} as Record<string, GymSession[]>);

  const activeDays = DAYS.filter(d => sessionsByDay[d].length > 0);

  const attendanceData = [...sessions]
    .sort((a, b) => b.attendance_count - a.attendance_count)
    .map(s => ({ name: s.name, attendance: s.attendance_count, capacity: s.capacity }));

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Session Schedule</h1>
        <p className="text-sm text-muted-foreground">Weekly fixed schedule and attendance overview</p>
      </div>

      {/* Weekly grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {activeDays.length === 0 && (
          <div className="col-span-full py-8 text-center text-muted-foreground">
            No active sessions in the schedule.
          </div>
        )}
        {activeDays.map(day => (
          <Card key={day}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">{day}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {sessionsByDay[day].map(session => {
                const pct = Math.round((session.attendance_count / session.capacity) * 100);
                const isFull = pct >= 100;
                const isNearFull = pct >= 80;
                return (
                  <div key={session.id} data-testid={`schedule-session-${session.id}`} className="p-3 rounded-lg border bg-card hover:bg-accent transition-colors">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <Clock className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                          <span className="text-xs font-bold text-primary">{session.time}</span>
                        </div>
                        <p className="font-semibold text-sm text-foreground mt-0.5">{session.name}</p>
                        <p className="text-xs text-muted-foreground">{session.coach_name ?? 'Unassigned'}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="flex items-center gap-1 justify-end">
                          <Users className="w-3.5 h-3.5 text-muted-foreground" />
                          <span className={`text-sm font-bold ${isFull ? 'text-red-600' : isNearFull ? 'text-amber-600' : 'text-foreground'}`}>
                            {session.attendance_count}/{session.capacity}
                          </span>
                        </div>
                        {isFull && <Badge variant="destructive" className="text-xs mt-1">Full</Badge>}
                      </div>
                    </div>
                    <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${isFull ? 'bg-red-500' : isNearFull ? 'bg-amber-500' : 'bg-primary'}`}
                        style={{ width: `${Math.min(pct, 100)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Attendance chart */}
      {attendanceData.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Attendance by Session</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={attendanceData} layout="vertical" margin={{ top: 0, right: 30, left: 60, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(214 28% 88%)" />
                <XAxis type="number" tick={{ fontSize: 11 }} domain={[0, 20]} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={80} />
                <Tooltip formatter={(v: number) => [`${v} members`]} />
                <Bar dataKey="attendance" radius={[0, 4, 4, 0]} name="Attendance">
                  {attendanceData.map((entry, idx) => (
                    <Cell
                      key={idx}
                      fill={entry.attendance >= entry.capacity ? '#ef4444' : entry.attendance >= entry.capacity * 0.8 ? '#f59e0b' : 'hsl(25 95% 55%)'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <div className="flex items-center gap-4 mt-3 justify-center text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-primary inline-block" />Normal</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-amber-500 inline-block" />Near Full (80%+)</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-red-500 inline-block" />Full</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Most attended */}
      {sessions.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Most Attended Sessions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {[...sessions].sort((a, b) => b.attendance_count - a.attendance_count).slice(0, 5).map((s, idx) => (
                <div key={s.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-muted/50">
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${idx === 0 ? 'bg-amber-100 text-amber-700' : 'bg-muted text-muted-foreground'}`}>
                    {idx + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{s.name}</p>
                    <p className="text-xs text-muted-foreground">{s.day_of_week} · {s.time} · {s.coach_name ?? 'Unassigned'}</p>
                  </div>
                  <span className="text-sm font-bold text-foreground flex-shrink-0">{s.attendance_count} members</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
