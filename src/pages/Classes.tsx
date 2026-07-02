import { useState } from "react";
import { useClasses, useCreateClass, useUpdateClass, useDeleteClass, useSports, useCoaches } from "@/hooks/use-data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Calendar as CalendarIcon, Clock, Users, X, Search } from "lucide-react";
import { toast } from "sonner";
import type { Class, ClassSchedule } from "@/lib/types";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

interface ClassForm {
  name: string;
  sportId: string;
  coachId: string;
  schedules: ClassSchedule[];
  capacity: string;
}

const emptyForm: ClassForm = { name: "", sportId: "", coachId: "", schedules: [], capacity: "20" };

export default function Classes() {
  const { data: classes = [], isLoading } = useClasses();
  const { data: sports = [] } = useSports();
  const { data: coaches = [] } = useCoaches();
  const createClass = useCreateClass();
  const updateClass = useUpdateClass();
  const deleteClass = useDeleteClass();

  const [query, setQuery] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [editClass, setEditClass] = useState<Class | null>(null);
  const [form, setForm] = useState<ClassForm>(emptyForm);
  const [confirmDelete, setConfirmDelete] = useState<Class | null>(null);

  const filtered = classes.filter(c => {
    const q = query.toLowerCase();
    return c.name.toLowerCase().includes(q) ||
           c.sport_name?.toLowerCase().includes(q) ||
           c.coach_name?.toLowerCase().includes(q);
  });

  const openAdd = () => { setForm(emptyForm); setShowAdd(true); };
  const openEdit = (c: Class) => {
    setEditClass(c);
    setForm({
      name: c.name,
      sportId: c.sport_id ?? "",
      coachId: c.coach_id ?? "",
      schedules: c.schedules || [],
      capacity: String(c.capacity)
    });
    setShowAdd(true);
  };
  const closeDialogs = () => { setShowAdd(false); setEditClass(null); };

  const handleAddSchedule = () => {
    setForm(p => ({ ...p, schedules: [...p.schedules, { day: "Sunday", time: "18:00" }] }));
  };

  const handleUpdateSchedule = (idx: number, field: 'day' | 'time', value: string) => {
    const newSchedules = [...form.schedules];
    newSchedules[idx] = { ...newSchedules[idx], [field]: value };
    setForm(p => ({ ...p, schedules: newSchedules }));
  };

  const handleRemoveSchedule = (idx: number) => {
    setForm(p => ({ ...p, schedules: p.schedules.filter((_, i) => i !== idx) }));
  };

  const handleSave = () => {
    if (!form.name.trim() || !form.sportId) {
      toast.error("Name and Sport are required");
      return;
    }
    if (form.schedules.length === 0) {
      toast.error("At least one schedule is required");
      return;
    }

    const payload = {
      name: form.name.trim(),
      sport_id: form.sportId,
      coach_id: form.coachId || null,
      schedules: form.schedules,
      capacity: Number(form.capacity) || 20,
    };

    if (editClass) {
      updateClass.mutate({ id: editClass.id, updates: payload }, {
        onSuccess: () => { toast.success("Class updated"); closeDialogs(); },
        onError: (err) => toast.error(`Error: ${err.message}`)
      });
    } else {
      createClass.mutate({ ...payload, attendance_count: 0 }, {
        onSuccess: () => { toast.success("Class added"); closeDialogs(); },
        onError: (err) => toast.error(`Error: ${err.message}`)
      });
    }
  };

  const handleDelete = () => {
    if (!confirmDelete) return;
    deleteClass.mutate(confirmDelete.id, {
      onSuccess: () => { toast.success("Class deleted"); setConfirmDelete(null); },
      onError: (err) => toast.error(`Error: ${err.message}`)
    });
  };

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Classes</h1>
          <p className="text-sm text-muted-foreground">{classes.length} active classes</p>
        </div>
        <Button onClick={openAdd} className="gap-2 shrink-0"><Plus className="w-4 h-4" /> Add Class</Button>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder="Search by class name, coach, or sport..." 
            value={query} 
            onChange={e => setQuery(e.target.value)} 
            className="pl-9" 
          />
        </div>
      </div>

      {/* Grid of Classes */}
      {isLoading ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">Loading classes...</p>
          </CardContent>
        </Card>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">No classes found.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map(cls => (
            <Card key={cls.id} className="hover:shadow-md transition-shadow flex flex-col group">
              <CardHeader className="p-4 pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <CardTitle className="text-lg font-bold truncate">{cls.name}</CardTitle>
                    <p className="text-sm text-primary font-medium mt-0.5">{cls.sport_name ?? 'Unknown Sport'}</p>
                  </div>
                  <div className="flex shrink-0 gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(cls)}>
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:text-red-600 hover:bg-red-50" onClick={() => setConfirmDelete(cls)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-4 pt-2 flex-1 flex flex-col gap-3">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Users className="w-4 h-4" />
                  <span>Coach: <strong>{cls.coach_name ?? 'Unassigned'}</strong></span>
                </div>
                
                <div className="space-y-1.5 flex-1">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Schedule</span>
                  <div className="flex flex-wrap gap-1.5">
                    {cls.schedules?.map((s, i) => (
                      <div key={i} className="inline-flex items-center gap-1 px-2 py-1 bg-muted rounded text-xs font-medium">
                        <CalendarIcon className="w-3 h-3 text-muted-foreground" />
                        {s.day.slice(0, 3)}
                        <Clock className="w-3 h-3 ml-1 text-muted-foreground" />
                        {s.time}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-3 border-t flex items-center justify-between mt-auto">
                  <span className="text-sm text-muted-foreground">Capacity</span>
                  <span className="font-semibold">{cls.attendance_count ?? 0} / {cls.capacity}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add / Edit Dialog */}
      <Dialog open={showAdd || !!editClass} onOpenChange={o => !o && closeDialogs()}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editClass ? "Edit Class" : "New Class"}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4 max-h-[70vh] overflow-y-auto pr-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Class Name</label>
              <Input placeholder="e.g. Beginners Kickboxing" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Sport</label>
                <Select value={form.sportId} onValueChange={v => setForm(p => ({ ...p, sportId: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select Sport" /></SelectTrigger>
                  <SelectContent>
                    {sports.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Coach</label>
                <Select value={form.coachId} onValueChange={v => setForm(p => ({ ...p, coachId: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select Coach" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Unassigned</SelectItem>
                    {coaches.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Class Schedule</label>
                <Button type="button" variant="outline" size="sm" onClick={handleAddSchedule} className="h-7 text-xs">
                  <Plus className="w-3 h-3 mr-1" /> Add Time
                </Button>
              </div>
              <div className="space-y-3">
                {form.schedules.map((sched, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <Select value={sched.day} onValueChange={v => handleUpdateSchedule(idx, 'day', v)}>
                      <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {DAYS.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Input type="time" value={sched.time} onChange={e => handleUpdateSchedule(idx, 'time', e.target.value)} className="flex-1" />
                    <Button type="button" variant="ghost" size="icon" onClick={() => handleRemoveSchedule(idx)} className="text-red-500 shrink-0">
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
                {form.schedules.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-2 border border-dashed rounded-md">No schedule added yet</p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Capacity</label>
              <Input type="number" placeholder="20" value={form.capacity} onChange={e => setForm(p => ({ ...p, capacity: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialogs}>Cancel</Button>
            <Button onClick={handleSave} disabled={createClass.isPending || updateClass.isPending}>{editClass ? "Save Changes" : "Create Class"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={!!confirmDelete} onOpenChange={o => !o && setConfirmDelete(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Delete Class</DialogTitle></DialogHeader>
          <div className="py-4 text-sm text-muted-foreground">
            Are you sure you want to delete {confirmDelete?.name}? This action cannot be undone.
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleteClass.isPending}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
