import { useState } from "react";
import { Plus, Landmark, CheckCircle2, AlertCircle, CalendarDays, DollarSign, Info } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useLiabilities, useCreateLiability, useUpdateLiability } from "@/hooks/use-data";
import type { Liability } from "@/lib/types";
import { toast } from "sonner";
import { format, differenceInDays, parseISO } from "date-fns";
import { Link } from "wouter";

const FREQUENCY_OPTIONS = [
  { value: "7", label: "Weekly" },
  { value: "14", label: "Bi-weekly" },
  { value: "30", label: "Monthly" },
  { value: "90", label: "Quarterly" },
];

export default function Liabilities() {
  const { data: liabilities = [] } = useLiabilities();
  const createLiability = useCreateLiability();
  const updateLiability = useUpdateLiability();

  const [showCreate, setShowCreate] = useState(false);
  const [editLiability, setEditLiability] = useState<Liability | null>(null);
  const [form, setForm] = useState({
    name: "", description: "",
    type: "installment" as "installment" | "one_time",
    totalAmount: "", installmentAmount: "",
    frequencyDays: "30",
    nextDueDate: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
    notifyDaysBefore: "5",
  });

  const f = (key: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(p => ({ ...p, [key]: e.target.value }));

  const openCreate = () => {
    setForm({ name: "", description: "", type: "installment", totalAmount: "", installmentAmount: "", frequencyDays: "30", nextDueDate: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0], notifyDaysBefore: "5" });
    setShowCreate(true);
  };

  const openEdit = (l: Liability) => {
    setEditLiability(l);
    setForm({
      name: l.name, description: l.description ?? "", type: l.type,
      totalAmount: String(l.total_amount), installmentAmount: String(l.installment_amount),
      frequencyDays: String(l.frequency_days), nextDueDate: l.next_due_date.split('T')[0],
      notifyDaysBefore: String(l.notify_days_before),
    });
    setShowCreate(true);
  };

  const closeDialog = () => { setShowCreate(false); setEditLiability(null); };

  const handleSave = () => {
    if (!form.name.trim() || !form.totalAmount || !form.nextDueDate) {
      toast.error("Name, total amount, and due date are required");
      return;
    }
    const total = Number(form.totalAmount);
    const installment = form.type === 'one_time' ? total : Number(form.installmentAmount);
    if (form.type === 'installment' && (!installment || installment <= 0)) {
      toast.error("Installment amount is required");
      return;
    }
    
    if (editLiability) {
      updateLiability.mutate({
        id: editLiability.id,
        updates: {
          name: form.name.trim(),
          description: form.description.trim(),
          type: form.type,
          total_amount: total,
          installment_amount: installment,
          frequency_days: form.type === 'one_time' ? 0 : Number(form.frequencyDays),
          next_due_date: new Date(form.nextDueDate).toISOString(),
          notify_days_before: Number(form.notifyDaysBefore) || 5,
        }
      }, {
        onSuccess: () => {
          toast.success("Liability updated");
          closeDialog();
        },
        onError: (err) => toast.error(`Error updating: ${err.message}`)
      });
    } else {
      createLiability.mutate({
        name: form.name.trim(),
        description: form.description.trim() || null,
        type: form.type,
        total_amount: total,
        paid_amount: 0,
        installment_amount: installment,
        frequency_days: form.type === 'one_time' ? 0 : Number(form.frequencyDays),
        next_due_date: new Date(form.nextDueDate).toISOString(),
        notify_days_before: Number(form.notifyDaysBefore) || 5,
        is_complete: false,
      }, {
        onSuccess: () => {
          toast.success(`Liability created: ${form.name}`);
          closeDialog();
        },
        onError: (err) => toast.error(`Error creating: ${err.message}`)
      });
    }
  };

  const activeLiabilities = liabilities.filter(l => !l.is_complete);
  const completedLiabilities = liabilities.filter(l => l.is_complete);
  const totalOutstanding = activeLiabilities.reduce((s, l) => s + (l.total_amount - l.paid_amount), 0);
  const nextDue = activeLiabilities
    .filter(l => differenceInDays(parseISO(l.next_due_date), new Date()) >= 0)
    .sort((a, b) => parseISO(a.next_due_date).getTime() - parseISO(b.next_due_date).getTime())[0];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Liabilities</h1>
          <p className="text-sm text-muted-foreground">Track installment plans and one-time obligations</p>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="w-4 h-4" /> New Liability
        </Button>
      </div>

      {/* How to pay info banner */}
      <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-blue-50 border border-blue-200 text-blue-700 text-sm">
        <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
        <span>
          To record a payment, go to <strong>Finance → Add Expense → Liability Payment</strong> and select the liability.
        </span>
        <Link href="/finance" className="ml-auto flex-shrink-0 underline text-xs font-medium hover:text-blue-900">Go to Finance →</Link>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-red-50 flex items-center justify-center">
                <DollarSign className="w-4 h-4 text-red-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-red-600">{totalOutstanding.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">EGP outstanding</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-amber-50 flex items-center justify-center">
                <CalendarDays className="w-4 h-4 text-amber-600" />
              </div>
              <div>
                <p className="text-sm font-bold text-foreground">{nextDue ? nextDue.name : '—'}</p>
                <p className="text-xs text-muted-foreground">
                  {nextDue ? `Next: ${format(parseISO(nextDue.next_due_date), 'dd MMM yyyy')}` : 'No upcoming payments'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-emerald-50 flex items-center justify-center">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{completedLiabilities.length}</p>
                <p className="text-xs text-muted-foreground">completed liabilities</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Active liabilities */}
      {activeLiabilities.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Active</h2>
          {activeLiabilities.map(l => {
            const pct = Math.round((l.paid_amount / l.total_amount) * 100);
            const remaining = l.total_amount - l.paid_amount;
            const daysUntil = differenceInDays(parseISO(l.next_due_date), new Date());
            const isDueSoon = daysUntil <= l.notify_days_before && daysUntil >= 0;
            const isOverdue = daysUntil < 0;

            return (
              <Card key={l.id} className={isDueSoon || isOverdue ? 'border-red-200' : ''}>
                <CardContent className="p-5 space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${isDueSoon || isOverdue ? 'bg-red-50' : 'bg-muted/50'}`}>
                        <Landmark className={`w-5 h-5 ${isDueSoon || isOverdue ? 'text-red-600' : 'text-muted-foreground'}`} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-foreground">{l.name}</p>
                          <Badge variant="outline" className="text-xs capitalize">{l.type === 'one_time' ? 'One-Time' : 'Installment'}</Badge>
                          {isOverdue && <Badge className="text-xs bg-red-600 text-white">Overdue</Badge>}
                          {isDueSoon && !isOverdue && <Badge className="text-xs bg-amber-500 text-white">Due Soon</Badge>}
                        </div>
                        {l.description && <p className="text-xs text-muted-foreground mt-0.5">{l.description}</p>}
                      </div>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => openEdit(l)} className="text-xs h-7 flex-shrink-0">Edit</Button>
                  </div>

                  {/* Progress bar */}
                  <div>
                    <div className="flex items-center justify-between text-sm mb-1.5">
                      <span className="text-muted-foreground">Paid: <span className="font-semibold text-foreground">{l.paid_amount.toLocaleString()} EGP</span></span>
                      <span className="text-muted-foreground">Remaining: <span className="font-semibold text-red-600">{remaining.toLocaleString()} EGP</span></span>
                    </div>
                    <div className="h-3 bg-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${pct >= 75 ? 'bg-emerald-500' : pct >= 40 ? 'bg-amber-500' : 'bg-red-500'}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-xs text-muted-foreground">{pct}% of {l.total_amount.toLocaleString()} EGP total</span>
                      {l.type === 'installment' && (
                        <span className="text-xs text-muted-foreground">{l.installment_amount.toLocaleString()} EGP / {FREQUENCY_OPTIONS.find(f => f.value === String(l.frequency_days))?.label ?? `${l.frequency_days}d`}</span>
                      )}
                    </div>
                  </div>

                  {/* Next due */}
                  <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs ${isOverdue ? 'bg-red-50 border border-red-200 text-red-700' : isDueSoon ? 'bg-amber-50 border border-amber-200 text-amber-700' : 'bg-muted/50 text-muted-foreground'}`}>
                    <CalendarDays className="w-3.5 h-3.5 flex-shrink-0" />
                    {l.type === 'one_time' ? 'Due on' : 'Next installment'}:{' '}
                    <strong>{format(parseISO(l.next_due_date), 'EEEE, dd MMM yyyy')}</strong>
                    {isOverdue && ' (overdue)'}
                    {isDueSoon && !isOverdue && ` (in ${daysUntil} day${daysUntil !== 1 ? 's' : ''})`}
                    {l.type === 'installment' && (
                      <span className="ml-auto">Amount: <strong>{l.installment_amount.toLocaleString()} EGP</strong></span>
                    )}
                    <span className="ml-auto flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" /> Notify {l.notify_days_before}d before
                    </span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Completed */}
      {completedLiabilities.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Completed</h2>
          {completedLiabilities.map(l => (
            <Card key={l.id} className="opacity-60">
              <CardContent className="p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                    <div>
                      <p className="font-medium text-foreground">{l.name}</p>
                      <p className="text-xs text-muted-foreground">{l.total_amount.toLocaleString()} EGP — fully paid</p>
                    </div>
                  </div>
                  <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">Complete</Badge>
                </div>
                <div className="mt-2 h-2 bg-emerald-100 rounded-full overflow-hidden">
                  <div className="h-full w-full bg-emerald-500 rounded-full" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {liabilities.length === 0 && (
        <Card>
          <CardContent className="py-16 text-center">
            <Landmark className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground">No liabilities created yet</p>
            <Button onClick={openCreate} variant="outline" className="mt-4 gap-2">
              <Plus className="w-4 h-4" /> Create First Liability
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Create / Edit Dialog */}
      <Dialog open={showCreate || !!editLiability} onOpenChange={o => !o && closeDialog()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editLiability ? `Edit: ${editLiability.name}` : 'New Liability'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2 max-h-[70vh] overflow-y-auto pr-1">
            <div className="space-y-1.5">
              <Label>Name *</Label>
              <Input placeholder="e.g. Commercial Treadmill Set" value={form.name} onChange={f('name')} />
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea placeholder="Optional details..." value={form.description} onChange={f('description')} rows={2} />
            </div>
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select value={form.type} onValueChange={(v: "installment" | "one_time") => setForm(p => ({ ...p, type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="installment">Installment (recurring payments)</SelectItem>
                  <SelectItem value="one_time">One-Time Payment</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Total Amount (EGP) *</Label>
                <Input type="number" placeholder="0" value={form.totalAmount} onChange={f('totalAmount')} />
              </div>
              {form.type === 'installment' && (
                <div className="space-y-1.5">
                  <Label>Installment Amount (EGP)</Label>
                  <Input type="number" placeholder="0" value={form.installmentAmount} onChange={f('installmentAmount')} />
                </div>
              )}
            </div>
            {form.type === 'installment' && (
              <div className="space-y-1.5">
                <Label>Frequency</Label>
                <Select value={form.frequencyDays} onValueChange={v => setForm(p => ({ ...p, frequencyDays: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {FREQUENCY_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{form.type === 'one_time' ? 'Due Date *' : 'Next Due Date *'}</Label>
                <Input type="date" value={form.nextDueDate} onChange={f('nextDueDate')} />
              </div>
              <div className="space-y-1.5">
                <Label>Notify X Days Before</Label>
                <Input type="number" min="1" max="30" value={form.notifyDaysBefore} onChange={f('notifyDaysBefore')} />
              </div>
            </div>
            {form.totalAmount && form.type === 'installment' && form.installmentAmount && (
              <div className="px-3 py-2 rounded-lg bg-muted/50 text-xs text-muted-foreground">
                Estimated installments: {Math.ceil(Number(form.totalAmount) / Number(form.installmentAmount))} payments
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Cancel</Button>
            <Button onClick={handleSave} disabled={createLiability.isPending || updateLiability.isPending}>{editLiability ? 'Save Changes' : 'Create Liability'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
