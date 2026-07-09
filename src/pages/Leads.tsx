import { useState } from "react";
import { Plus, Phone, Calendar, StickyNote, TrendingUp, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { SearchableSelect } from "@/components/SearchableSelect";
import { useLeads, useCreateLead, useUpdateLead, useMembers, useUpdateMember, useDeleteLead, useSports, useEmployees, useProfiles } from "@/hooks/use-data";
import { MultiSelect } from "@/components/MultiSelect";
import type { Lead } from "@/lib/types";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { format } from "date-fns";
import { useLocation } from "wouter";

const SOURCES = ["Walk-in", "Referral", "Facebook", "Instagram", "WhatsApp", "Invitation"];
const STATUSES = ["New", "Contacted", "Follow-up", "Converted", "Invited", "Lost"] as const;

const statusColors: Record<string, string> = {
  New: "bg-blue-100 text-blue-700 border-blue-200",
  Contacted: "bg-amber-100 text-amber-700 border-amber-200",
  "Follow-up": "bg-violet-100 text-violet-700 border-violet-200",
  Converted: "bg-emerald-100 text-emerald-700 border-emerald-200",
  Invited: "bg-fuchsia-100 text-fuchsia-700 border-fuchsia-200",
  Lost: "bg-red-100 text-red-700 border-red-200",
};

export default function Leads() {
  const { data: leads = [] } = useLeads();
  const { data: members = [] } = useMembers();
  const { data: sports = [] } = useSports();
  const { data: employees = [] } = useEmployees();
  const { data: profiles = [] } = useProfiles();
  const createLead = useCreateLead();
  const updateLead = useUpdateLead();
  const updateMember = useUpdateMember();
  const deleteLead = useDeleteLead();
  const { currentUser } = useAuth();
  const [, navigate] = useLocation();

  const [mainTab, setMainTab] = useState("leads");
  const [tab, setTab] = useState("all");
  const [showAdd, setShowAdd] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [editLead, setEditLead] = useState<Lead | null>(null);
  const [newNote, setNewNote] = useState("");
  const [form, setForm] = useState({ name: "", phone: "", source: "Walk-in", invitingMemberId: "", interest: "" });
  const [showConvertDialog, setShowConvertDialog] = useState(false);
  const [leadToConvert, setLeadToConvert] = useState<Lead | null>(null);
  const [convertedToMemberId, setConvertedToMemberId] = useState("");
  const [filterSource, setFilterSource] = useState("all");
  const [filterInterest, setFilterInterest] = useState("all");

  const filtered = leads.filter(l =>
    (tab === "all" || l.status === tab) &&
    (filterSource === "all" || l.source === filterSource) &&
    (filterInterest === "all" || (l.interest && l.interest.includes(filterInterest)))
  );

  const sportsOptions = sports.map(s => ({ value: s.name, label: s.name }));

  const counts = STATUSES.reduce((acc, s) => {
    acc[s] = leads.filter(l => l.status === s).length;
    return acc;
  }, {} as Record<string, number>);

  const totalCalls = leads.reduce((s, l) => s + l.calls_made, 0);
  const converted = leads.filter(l => l.status === 'Converted').length;
  const conversionRate = leads.length > 0 ? Math.round((converted / leads.length) * 100) : 0;

  const handleAddLead = () => {
    if (!form.name.trim() || !form.phone.trim()) { toast.error("Name and phone required"); return; }

    if (!/^\d{11}$/.test(form.phone.trim())) {
      toast.error("Phone number must be exactly 11 digits");
      return;
    }

    if (form.source === "Invitation") {
      if (!form.invitingMemberId) {
        toast.error("Please select the inviting member.");
        return;
      }
      const member = members.find(m => m.uuid === form.invitingMemberId);
      if (!member || member.invitations_remaining <= 0) {
        toast.error("Selected member does not have enough invitations.");
        return;
      }
    }

    const linkedEmployee = employees.find(e => e.user_id === currentUser?.id);

    createLead.mutate({
      name: form.name.trim(),
      phone: form.phone.trim(),
      source: form.source,
      status: 'New',
      notes: [],
      calls_made: 0,
      follow_up_date: new Date(Date.now() + 86400000).toISOString(),
      assigned_to: currentUser?.id || null,
      interest: form.interest || null,
      inviting_member_id: form.source === "Invitation" ? form.invitingMemberId : null,
      took_invitation: false,
    }, {
      onSuccess: () => {
        if (form.source === "Invitation" && form.invitingMemberId) {
          const member = members.find(m => m.uuid === form.invitingMemberId);
          if (member) {
            updateMember.mutate({
              id: member.uuid,
              updates: { invitations_remaining: member.invitations_remaining - 1 }
            });
          }
        }
        toast.success(`Lead added: ${form.name}`);
        setForm({ name: "", phone: "", source: "Walk-in", invitingMemberId: "", interest: "" });
        setShowAdd(false);
      },
      onError: (err) => toast.error(`Error adding lead: ${err.message}`)
    });
  };

  const handleAddNote = (lead: Lead) => {
    if (!newNote.trim()) return;
    const updatedNotes = [...lead.notes, newNote.trim()];
    updateLead.mutate({
      id: lead.id,
      updates: { notes: updatedNotes }
    }, {
      onSuccess: () => {
        setSelectedLead(prev => prev ? { ...prev, notes: updatedNotes } : null);
        setNewNote("");
        toast.success("Note added");
      },
      onError: (err) => toast.error(`Error adding note: ${err.message}`)
    });
  };

  const handleUpdateStatus = (lead: Lead, status: Lead['status']) => {
    if (status === 'Converted' && lead.status !== 'Converted') {
      setLeadToConvert(lead);
      setConvertedToMemberId("");
      setShowConvertDialog(true);
      return;
    }
    updateLead.mutate({
      id: lead.id,
      updates: { status }
    }, {
      onSuccess: () => {
        if (selectedLead?.id === lead.id) setSelectedLead(prev => prev ? { ...prev, status } : null);
        toast.success(`Status updated to ${status}`);
      },
      onError: (err) => toast.error(`Error updating status: ${err.message}`)
    });
  };

  const handleConfirmConvert = () => {
    if (!leadToConvert || !convertedToMemberId) return;
    updateLead.mutate({
      id: leadToConvert.id,
      updates: { 
        status: 'Converted',
        converted_to_member_id: convertedToMemberId,
        converted_by_user_id: currentUser?.id
      }
    }, {
      onSuccess: () => {
        if (selectedLead?.id === leadToConvert.id) {
          setSelectedLead(prev => prev ? { ...prev, status: 'Converted', converted_to_member_id: convertedToMemberId, converted_by_user_id: currentUser?.id } : null);
        }
        toast.success(`Lead converted to member successfully!`);
        setShowConvertDialog(false);
        setLeadToConvert(null);
      },
      onError: (err) => toast.error(`Error converting lead: ${err.message}`)
    });
  };

  const handleUpdateFollowUp = (lead: Lead, date: string) => {
    updateLead.mutate({
      id: lead.id,
      updates: { follow_up_date: date }
    }, {
      onSuccess: () => {
        if (selectedLead?.id === lead.id) {
          setSelectedLead(prev => prev ? { ...prev, follow_up_date: date } : null);
        }
        toast.success("Follow-up date updated.");
      },
      onError: (err) => toast.error(`Error updating date: ${err.message}`)
    });
  };

  const handleEditLead = () => {
    if (!form.name.trim() || !form.phone.trim() || !editLead) { toast.error("Name and phone required"); return; }

    if (!/^\d{11}$/.test(form.phone.trim())) {
      toast.error("Phone number must be exactly 11 digits");
      return;
    }

    updateLead.mutate({
      id: editLead.id,
      updates: {
        name: form.name.trim(),
        phone: form.phone.trim(),
        source: form.source,
        interest: form.interest || null
      }
    }, {
      onSuccess: () => {
        if (selectedLead?.id === editLead.id) {
          setSelectedLead(prev => prev ? { ...prev, name: form.name.trim(), phone: form.phone.trim(), source: form.source, interest: form.interest || null } : null);
        }
        toast.success(`Lead updated`);
        setEditLead(null);
        setShowEdit(false);
      },
      onError: (err) => toast.error(`Error updating lead: ${err.message}`)
    });
  };

  const handleDeleteLead = (lead: Lead) => {
    if (!confirm("Are you sure you want to delete this lead?")) return;
    deleteLead.mutate(lead.id, {
      onSuccess: () => {
        toast.success("Lead deleted");
        setSelectedLead(null);
      },
      onError: (err) => toast.error(`Error deleting lead: ${err.message}`)
    });
  };

  const handleUpdateCalls = (lead: Lead, calls: number) => {
    updateLead.mutate({
      id: lead.id,
      updates: { calls_made: calls }
    }, {
      onSuccess: () => {
        if (selectedLead?.id === lead.id) {
          setSelectedLead(prev => prev ? { ...prev, calls_made: calls } : null);
        }
      },
      onError: (err) => toast.error(`Error updating calls: ${err.message}`)
    });
  };

  const handleUpdateTookInvitation = (lead: Lead, took: boolean) => {
    updateLead.mutate({
      id: lead.id,
      updates: { took_invitation: took }
    }, {
      onSuccess: () => {
        if (selectedLead?.id === lead.id) {
          setSelectedLead(prev => prev ? { ...prev, took_invitation: took } : null);
        }
        toast.success(took ? "Invitation session marked as taken" : "Invitation session marked as not taken");
      },
      onError: (err) => toast.error(`Error updating invitation status: ${err.message}`)
    });
  };

  return (
    <Tabs value={mainTab} onValueChange={setMainTab} className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Leads</h1>
          <p className="text-sm text-muted-foreground">{leads.length} total leads</p>
        </div>
        <div className="flex items-center gap-4">
          <TabsList className="hidden sm:inline-flex">
            <TabsTrigger value="leads">Leads</TabsTrigger>
            <TabsTrigger value="performance">Employee Performance</TabsTrigger>
          </TabsList>
          <Button data-testid="btn-add-lead" onClick={() => setShowAdd(true)} className="gap-2">
            <Plus className="w-4 h-4" /> New Lead
          </Button>
        </div>
      </div>

      <TabsContent value="leads" className="space-y-5 mt-0">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="p-3 rounded-xl border bg-card text-center">
          <p className="text-2xl font-bold text-foreground">{leads.length}</p>
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
          const count = leads.filter(l => l.source === source).length;
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

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="flex-wrap h-auto gap-1">
            <TabsTrigger value="all" className="text-xs">All ({leads.length})</TabsTrigger>
            {STATUSES.map(s => <TabsTrigger key={s} value={s} className="text-xs">{s} ({counts[s] || 0})</TabsTrigger>)}
          </TabsList>
        </Tabs>

        <div className="flex gap-2">
          <Select value={filterSource} onValueChange={setFilterSource}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Source..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Sources</SelectItem>
              {SOURCES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={filterInterest} onValueChange={setFilterInterest}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Interest..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Interests</SelectItem>
              {sports.map(s => <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Leads list */}
      {filtered.length === 0 ? (
        <Card><CardContent className="py-12 text-center"><p className="text-muted-foreground">No leads</p></CardContent></Card>
      ) : (
        <div className="rounded-md border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Next Follow-up</TableHead>
                <TableHead>Calls</TableHead>
                <TableHead>Notes</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(lead => (
                <TableRow
                  key={lead.id}
                  data-testid={`lead-row-${lead.id}`}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => setSelectedLead(lead)}
                >
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <span className="text-xs font-bold text-primary">{lead.name.charAt(0)}</span>
                      </div>
                      {lead.name}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">{lead.phone}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">{lead.source}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Calendar className="w-3 h-3" />
                      <span>{format(new Date(lead.follow_up_date), "dd/MM")}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Phone className="w-3 h-3" />
                      <span>{lead.calls_made}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {lead.notes.length > 0 ? (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <StickyNote className="w-3 h-3" />
                        <span>{lead.notes.length}</span>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${statusColors[lead.status]}`}>
                      {lead.status}
                      
                    </span>
                    {lead.status === 'Converted' && lead.converted_by_user_id && (
                      <span className="text-xs text-muted-foreground font-normal">
                        <br></br>by {profiles.find(p => p.id === lead.converted_by_user_id)?.name || 'Unknown'}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditLead(lead);
                          setForm({ name: lead.name, phone: lead.phone, source: lead.source, invitingMemberId: lead.inviting_member_id || "", interest: lead.interest || "" });
                          setShowEdit(true);
                        }}
                        className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                        title="Edit"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteLead(lead);
                        }}
                        className="p-1.5 rounded-md hover:bg-red-50 transition-colors text-muted-foreground hover:text-red-600"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      </TabsContent>

      <TabsContent value="performance" className="space-y-5 mt-0">
        <div className="rounded-md border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee Name</TableHead>
                <TableHead>Leads Brought In</TableHead>
                <TableHead>Calls Made</TableHead>
                <TableHead>Converted to Member</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {employees.map(emp => {
                const empLeads = leads.filter(l => l.assigned_to === emp.id);
                const leadsCount = empLeads.length;
                const callsCount = empLeads.reduce((s, l) => s + l.calls_made, 0);
                const convertedCount = empLeads.filter(l => l.status === 'Converted').length;
                
                if (leadsCount === 0 && callsCount === 0) return null;
                
                return (
                  <TableRow key={emp.id}>
                    <TableCell className="font-medium">{emp.name}</TableCell>
                    <TableCell>{leadsCount}</TableCell>
                    <TableCell>{callsCount}</TableCell>
                    <TableCell className="text-emerald-600 font-bold">{convertedCount}</TableCell>
                  </TableRow>
                );
              })}
              {employees.length === 0 || employees.every(emp => {
                const empLeads = leads.filter(l => l.assigned_to === emp.id);
                return empLeads.length === 0 && empLeads.reduce((s, l) => s + l.calls_made, 0) === 0;
              }) ? (
                <TableRow>
                  <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                    No performance data available.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </div>
      </TabsContent>

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
              <Input data-testid="input-lead-phone" placeholder="01XXXXXXXXX" value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Source</Label>
              <Select value={form.source} onValueChange={v => setForm(p => ({ ...p, source: v }))}>
                <SelectTrigger data-testid="select-lead-source"><SelectValue /></SelectTrigger>
                <SelectContent>{SOURCES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Interest</Label>
              <MultiSelect
                options={sportsOptions}
                selected={form.interest ? form.interest.split(",").map(s => s.trim()).filter(Boolean) : []}
                onChange={(selected) => setForm(p => ({ ...p, interest: selected.join(", ") }))}
                placeholder="Select sports..."
              />
            </div>
            {form.source === "Invitation" && (
              <div className="space-y-1.5">
                <Label>Inviting Member *</Label>
                <SearchableSelect
                  options={members.map(m => ({
                    value: m.uuid,
                    label: `${m.name} (${m.invitations_remaining} invites left)`,
                    searchTerms: `${m.phone} ${m.id}`,
                  }))}
                  value={form.invitingMemberId}
                  onValueChange={v => setForm(p => ({ ...p, invitingMemberId: v }))}
                  placeholder="Search member..."
                  searchPlaceholder="Type name, phone, or member ID..."
                  emptyMessage="No members found"
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button data-testid="btn-save-lead" onClick={handleAddLead} disabled={createLead.isPending}>
              {createLead.isPending ? "Creating..." : "Create Lead"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Lead Detail Dialog */}
      <Dialog open={!!selectedLead} onOpenChange={o => !o && setSelectedLead(null)}>
        {selectedLead && (
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {selectedLead.name}
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${statusColors[selectedLead.status]}`}>
                      {selectedLead.status}
                    </span>
                  </div>
                </div>
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="flex gap-4 flex-wrap items-center">
                <p className="text-sm text-muted-foreground"><Phone className="w-3.5 h-3.5 inline mr-1" />{selectedLead.phone}</p>
                <p className="text-sm text-muted-foreground">{selectedLead.source}</p>
                <div className="flex items-center gap-2">
                  <Label className="text-xs text-muted-foreground">Calls:</Label>
                  <Input
                    type="number"
                    min={0}
                    value={selectedLead.calls_made}
                    onChange={e => handleUpdateCalls(selectedLead, parseInt(e.target.value) || 0)}
                    className="w-16 h-7 text-xs"
                  />
                </div>
              </div>

              {selectedLead.status === 'Converted' && (
                <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-3 space-y-1.5 mt-2">
                  <p className="text-sm font-medium text-emerald-900">Conversion Details</p>
                  <p className="text-xs text-emerald-700">
                    <span className="font-semibold">Linked Member:</span> {
                      selectedLead.converted_to_member_id 
                        ? members.find(m => m.uuid === selectedLead.converted_to_member_id)?.name || 'Unknown Member'
                        : 'Not linked'
                    }
                  </p>
                  <p className="text-xs text-emerald-700">
                    <span className="font-semibold">Converted By:</span> {
                      selectedLead.converted_by_user_id
                        ? profiles.find(p => p.id === selectedLead.converted_by_user_id)?.name || 'Unknown User'
                        : 'Unknown User'
                    }
                  </p>
                </div>
              )}

              {selectedLead.source === "Invitation" && (
                <div className="space-y-1.5 pt-1">
                  <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50 border">
                    <input 
                      type="checkbox" 
                      id="took_invitation"
                      className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                      checked={selectedLead.took_invitation}
                      onChange={(e) => handleUpdateTookInvitation(selectedLead, e.target.checked)}
                    />
                    <Label htmlFor="took_invitation" className="text-sm cursor-pointer">
                      Took Invitation Session
                    </Label>
                  </div>
                </div>
              )}
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
              <div className="space-y-1.5 pt-2">
                <Label className="text-xs">Next Follow-up Date</Label>
                <Input
                  type="date"
                  value={selectedLead.follow_up_date ? new Date(selectedLead.follow_up_date).toISOString().split('T')[0] : ""}
                  onChange={e => {
                    const d = new Date(e.target.value);
                    if (!isNaN(d.getTime())) handleUpdateFollowUp(selectedLead, d.toISOString());
                  }}
                  className="text-sm h-8"
                />
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
                  disabled={updateLead.isPending}
                >
                  Add
                </Button>
              </div>
            </div>
          </DialogContent>
        )}
      </Dialog>
      <Dialog open={showEdit} onOpenChange={open => { setShowEdit(open); if (!open) setEditLead(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Lead</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Full Name *</Label>
              <Input placeholder="Name" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Phone *</Label>
              <Input placeholder="055-XXXXXXX" value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Source</Label>
              <Select value={form.source} onValueChange={v => setForm(p => ({ ...p, source: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{SOURCES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Interest</Label>
              <MultiSelect
                options={sportsOptions}
                selected={form.interest ? form.interest.split(",").map(s => s.trim()).filter(Boolean) : []}
                onChange={(selected) => setForm(p => ({ ...p, interest: selected.join(", ") }))}
                placeholder="Select sports..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEdit(false)}>Cancel</Button>
            <Button onClick={handleEditLead} disabled={updateLead.isPending}>
              {updateLead.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Convert Lead Dialog */}
      <Dialog open={showConvertDialog} onOpenChange={open => { setShowConvertDialog(open); if (!open) setLeadToConvert(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Convert Lead to Member</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Link to Member Profile</Label>
              <SearchableSelect
                options={members.map(m => ({
                  value: m.uuid,
                  label: `${m.name} (${m.id === -1 ? 'Clinic Visitor' : m.id})`,
                  searchTerms: `${m.phone} ${m.id}`,
                }))}
                value={convertedToMemberId}
                onValueChange={setConvertedToMemberId}
                placeholder="Search member..."
                searchPlaceholder="Type name, phone, or member ID..."
                emptyMessage="No members found"
              />
              <p className="text-xs text-muted-foreground mt-1">Select the member account that was created for this lead.</p>
            </div>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">Or</span>
              </div>
            </div>

            <Button 
              variant="outline" 
              className="w-full"
              onClick={() => {
                setShowConvertDialog(false);
                navigate(`/members?createLeadId=${leadToConvert?.id}&leadName=${encodeURIComponent(leadToConvert?.name || "")}&leadPhone=${encodeURIComponent(leadToConvert?.phone || "")}`);
              }}
            >
              Create New Member
            </Button>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConvertDialog(false)}>Cancel</Button>
            <Button onClick={handleConfirmConvert} disabled={!convertedToMemberId || updateLead.isPending}>
              {updateLead.isPending ? "Converting..." : "Confirm Conversion"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Tabs>
  );
}
