import { useState } from "react";
import { useSports, useCreateSport, useUpdateSport, useDeleteSport } from "@/hooks/use-data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Trophy, Search } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import type { Sport } from "@/lib/types";
import { useAuth } from "@/lib/auth";

export default function Sports() {
  const { isAdmin } = useAuth();
  const { data: sports = [], isLoading } = useSports();
  const createSport = useCreateSport();
  const updateSport = useUpdateSport();
  const deleteSport = useDeleteSport();

  const [query, setQuery] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [editSport, setEditSport] = useState<Sport | null>(null);
  const [formName, setFormName] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<Sport | null>(null);

  const filtered = sports.filter(s => s.name.toLowerCase().includes(query.toLowerCase()));

  const openAdd = () => { setFormName(""); setShowAdd(true); };
  const openEdit = (s: Sport) => { setEditSport(s); setFormName(s.name); };
  const closeDialogs = () => { setShowAdd(false); setEditSport(null); };

  const handleSave = () => {
    if (!formName.trim()) {
      toast.error("Sport name is required");
      return;
    }

    if (editSport) {
      updateSport.mutate({ id: editSport.id, updates: { name: formName.trim() } }, {
        onSuccess: () => { toast.success("Sport updated"); closeDialogs(); },
        onError: (err) => toast.error(`Error: ${err.message}`)
      });
    } else {
      createSport.mutate({ name: formName.trim() }, {
        onSuccess: () => { toast.success("Sport added"); closeDialogs(); },
        onError: (err) => toast.error(`Error: ${err.message}`)
      });
    }
  };

  const handleDelete = () => {
    if (!confirmDelete) return;
    deleteSport.mutate(confirmDelete.id, {
      onSuccess: () => { toast.success("Sport deleted"); setConfirmDelete(null); },
      onError: (err) => toast.error(`Error: ${err.message}`)
    });
  };

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Sports</h1>
          <p className="text-sm text-muted-foreground">{sports.length} total sports</p>
        </div>
        {isAdmin && (
          <Button onClick={openAdd} className="gap-2 shrink-0"><Plus className="w-4 h-4" /> Add Sport</Button>
        )}
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder="Search sports..." 
            value={query} 
            onChange={e => setQuery(e.target.value)} 
            className="pl-9" 
          />
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">Loading sports...</div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">No sports found.</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Sport Name</TableHead>
                    <TableHead>Created At</TableHead>
                    <TableHead className="w-[100px] text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(s => (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">{s.name}</TableCell>
                      <TableCell className="text-muted-foreground">{format(new Date(s.created_at), 'dd MMM yyyy')}</TableCell>
                      <TableCell className="text-right">
                        {isAdmin && (
                          <div className="flex items-center justify-end gap-2">
                            <button onClick={() => openEdit(s)} className="p-2 hover:bg-muted rounded-md text-muted-foreground hover:text-foreground transition-colors"><Pencil className="w-4 h-4" /></button>
                            <button onClick={() => setConfirmDelete(s)} className="p-2 hover:bg-red-50 rounded-md text-muted-foreground hover:text-red-600 transition-colors"><Trash2 className="w-4 h-4" /></button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add / Edit Dialog */}
      <Dialog open={showAdd || !!editSport} onOpenChange={o => !o && closeDialogs()}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{editSport ? "Edit Sport" : "New Sport"}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Name</label>
              <Input placeholder="e.g. Kickboxing" value={formName} onChange={e => setFormName(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialogs}>Cancel</Button>
            <Button onClick={handleSave} disabled={createSport.isPending || updateSport.isPending}>{editSport ? "Save" : "Add Sport"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={!!confirmDelete} onOpenChange={o => !o && setConfirmDelete(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Delete Sport</DialogTitle></DialogHeader>
          <div className="py-4 text-sm text-muted-foreground">
            Are you sure you want to delete {confirmDelete?.name}? This action cannot be undone. Classes associated with this sport may be affected.
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleteSport.isPending}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
