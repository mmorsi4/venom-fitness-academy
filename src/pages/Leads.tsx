import { useState } from "react";
import { Plus, Phone, Calendar, StickyNote, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAppState } from "@/lib/store";
import { Lead } from "@/lib/mock-data";
import { toast } from "sonner";
import { format } from "date-fns";

const SOURCES = ["Walk-in", "Referral", "Facebook", "Instagram", "WhatsApp"];
const STATUSES = ["New", "Contacted", "Follow-up", "Converted", "Lost"] as const;

const statusColors: Record<string, string> = {
  New: "bg-blue-100 text-blue-700 border-blue-200",
  Contacted: "bg-amber-100 text-amber-700 border-amber-200",
  "Follow-up": "bg-violet-100 text-violet-700 border-violet-200",
  Converted: "bg-emerald-100 text-emerald-700 border-emerald-200",
  Lost: "bg-red-100 text-red-700 border-red-200",
};

export default function Leads() {
  const { state, dispatch } = useAppState();
  const [tab, setTab] = useState("all");
  const [showAdd, setShowAdd] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [newNote, setNewNote] = useState("");
  const [form, setForm] = useState({ name: "", phone: "", source: "Walk-in" });

  const filtered = state.leads.filter(l => tab === "all" || l.status === tab);

  const counts = STATUSES.reduce((acc, s) => {
    acc[s] = state.leads.filter(l => l.status === s).length;
    return acc;
  }, {} as Record<string, number>);

  const totalCalls = state.leads.reduce((s, l) => s + l.callsMade, 0);
  const converted = state.leads.filter(l => l.status === 'Converted').length;
  const conversionRate = state.leads.length > 0 ? Math.round((converted / state.leads.length) * 100) : 0;

  const handleAddLead = () => {
    if (!form.name.trim() || !form.phone.trim()) { toast.error("Name and phone required"); return; }
    const lead: Lead = {
      id: `L${Date.now()}`, name: form.name.trim(), phone: form.phone.trim(),
      source: form.source, status: 'New', notes: [], callsMade: 0,
      followUpDate: new Date(Date.now() + 86400000).toISOString(), assignedTo: "Reception",
    };
    dispatch({ type: 'ADD_LEAD', payload: lead });
    toast.success(`Lead added: ${form.name}`);
    setForm({ name: "", phone: "", source: "Walk-in" });
    setShowAdd(false);
  };

  const handleAddNote = (lead: Lead) => {
    if (!newNote.trim()) return;
    const updated = { ...lead, notes: [...lead.notes, newNote.trim()] };
    dispatch({ type: 'UPDATE_LEAD', payload: updated });
    setSelectedLead(updated);
    setNewNote("");
    toast.success("Note added");
  };

  const handleUpdateStatus = (lead: Lead, status: Lead['status']) => {
    const updated = { ...lead, status, callsMade: lead.callsMade + (status === 'Contacted' ? 1 : 0) };
    dispatch({ type: 'UPDATE_LEAD', payload: updated });
    if (selectedLead?.id === lead.id) setSelectedLead(updated);
    toast.success(`Status updated to ${status}`);
  };

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Leads (CRM)</h1>
          <p className="text-sm text-muted-foreground">{state.leads.length} total leads</p>
        </div>
        <Button data-testid="btn-add-lead" onClick={() => setShowAdd(true)} className="gap-2">
          <Plus className="w-4 h-4" /> New Lead
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="p-3 rounded-xl border bg-card text-center">
          <p className="text-2xl font-bold text-foreground">{state.leads.length}</p>
          <p className="text-xs text-muted-foreground">Total Leads</p>
        </div>
        <div className="p-3 rounded-xl border bg-card text-center">
          <p className="text-2xl font-bold text-foreground">{totalCalls}</p>
          <p className="text-xs text-muted-foreground">Calls Made</p>
        </div>
        <div className="p-3 rounded-xl border bg-card text-center">
          <p className="text-2xl font-bold text-emerald-600">{converted}</p>
          <p className="text-xs text-muted-foreground">Converted</p>
        </div>
        <div className="p-3 rounded-xl border bg-card text-center">
          <p className="text-2xl font-bold text-primary">{conversionRate}%</p>
          <p className="text-xs text-muted-foreground">Conversion Rate</p>
        </div>
      </div>

      {/* Source breakdown */}
      <div className="flex flex-wrap gap-2">
        {SOURCES.map(source => {
          const count = state.leads.filter(l => l.source === source).length;
          if (count === 0) return null;
          return (
            <div key={source} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border bg-card text-sm">
              <TrendingUp className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="font-medium">{source}</span>
              <span className="text-muted-foreground">({count})</span>
            </div>
          );
        })}
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="all" className="text-xs">All ({state.leads.length})</TabsTrigger>
          {STATUSES.map(s => <TabsTrigger key={s} value={s} className="text-xs">{s} ({counts[s] || 0})</TabsTrigger>)}
        </TabsList>
      </Tabs>

      {/* Leads list */}
      {filtered.length === 0 ? (
        <Card><CardContent className="py-12 text-center"><p className="text-muted-foreground">No leads</p></CardContent></Card>
      ) : (
        <div className="space-y-2">
          {filtered.map(lead => (
            <Card
              key={lead.id}
              data-testid={`lead-row-${lead.id}`}
              className="hover:shadow-sm transition-shadow cursor-pointer"
              onClick={() => setSelectedLead(lead)}
            >
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-bold text-primary">{lead.name.charAt(0)}</span>
                  </div>
                  <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-2 items-center">
                    <div>
                      <p className="text-sm font-semibold text-foreground">{lead.name}</p>
                      <div className="flex items-center gap-1 mt-0.5">
                        <Phone className="w-3 h-3 text-muted-foreground" />
                        <p className="text-xs text-muted-foreground">{lead.phone}</p>
                      </div>
                    </div>
                    <div>
                      <Badge variant="outline" className="text-xs">{lead.source}</Badge>
                    </div>
                    <div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Calendar className="w-3 h-3" />
                        <span>Follow-up: {format(new Date(lead.followUpDate), "dd MMM")}</span>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                        <Phone className="w-3 h-3" />
                        <span>{lead.callsMade} calls</span>
                      </div>
                    </div>
                    <div>
                      {lead.notes.length > 0 && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <StickyNote className="w-3 h-3" />
                          <span>{lead.notes.length} note{lead.notes.length > 1 ? 's' : ''}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${statusColors[lead.status]}`}>
                    {lead.status}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add Lead Dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent>
          <DialogHeader><DialogTitle>New Lead</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Full Name *</Label>
              <Input data-testid="input-lead-name" placeholder="Name" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Phone *</Label>
              <Input data-testid="input-lead-phone" placeholder="055-XXXXXXX" value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Source</Label>
              <Select value={form.source} onValueChange={v => setForm(p => ({ ...p, source: v }))}>
                <SelectTrigger data-testid="select-lead-source"><SelectValue /></SelectTrigger>
                <SelectContent>{SOURCES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button data-testid="btn-save-lead" onClick={handleAddLead}>Create Lead</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Lead Detail Dialog */}
      <Dialog open={!!selectedLead} onOpenChange={o => !o && setSelectedLead(null)}>
        {selectedLead && (
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center justify-between">
                {selectedLead.name}
                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${statusColors[selectedLead.status]}`}>
                  {selectedLead.status}
                </span>
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="flex gap-2 flex-wrap">
                <p className="text-sm text-muted-foreground"><Phone className="w-3.5 h-3.5 inline mr-1" />{selectedLead.phone}</p>
                <p className="text-sm text-muted-foreground">{selectedLead.source}</p>
                <p className="text-sm text-muted-foreground">{selectedLead.callsMade} calls</p>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Update Status</Label>
                <div className="flex flex-wrap gap-1.5">
                  {STATUSES.map(s => (
                    <button
                      key={s}
                      data-testid={`btn-lead-status-${s}`}
                      onClick={() => handleUpdateStatus(selectedLead, s)}
                      className={`px-2.5 py-1 rounded-full text-xs font-medium border cursor-pointer transition-opacity ${statusColors[s]} ${selectedLead.status === s ? 'ring-2 ring-offset-1 ring-primary' : 'opacity-70 hover:opacity-100'}`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Notes</Label>
                {selectedLead.notes.map((note, i) => (
                  <div key={i} className="p-2 rounded-lg bg-muted/50 text-sm text-foreground">{note}</div>
                ))}
                {selectedLead.notes.length === 0 && (
                  <p className="text-xs text-muted-foreground">No notes yet</p>
                )}
              </div>
              <div className="flex gap-2">
                <Textarea
                  data-testid="input-lead-note"
                  placeholder="Add a note..."
                  value={newNote}
                  onChange={e => setNewNote(e.target.value)}
                  className="text-sm resize-none h-16"
                />
                <Button
                  data-testid="btn-add-note"
                  variant="outline"
                  size="sm"
                  className="self-end"
                  onClick={() => handleAddNote(selectedLead)}
                >
                  Add
                </Button>
              </div>
            </div>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
