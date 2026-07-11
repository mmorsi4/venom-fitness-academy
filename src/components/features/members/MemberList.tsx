import { format } from "date-fns";
import { Mail, BicepsFlexed, Unlock, Snowflake, ArrowUpCircle, Clock, Pencil, Trash2, QrCode, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import StatusBadge from "@/components/StatusBadge";
import type { Member } from "@/lib/types";

function calcAge(birthDate?: string | null) {
  if (!birthDate) return null;
  try { return new Date().getFullYear() - new Date(birthDate).getFullYear(); } catch { return null; }
}

interface MemberListProps {
  paginatedMembers: Member[];
  invoices: any[];
  members: Member[];
  filteredLength: number;
  pageSize: number;
  setPageSize: (v: number) => void;
  currentPage: number;
  setCurrentPage: React.Dispatch<React.SetStateAction<number>>;
  totalPages: number;
  unfreezeIsPending: boolean;
  setQrMember: (m: Member | null) => void;
  handleDecrement: (m: Member, field: 'invitations_remaining' | 'inbody_sessions_remaining') => void;
  handleUnfreeze: (m: Member) => void;
  setFreezeMemberState: (m: Member | null) => void;
  setFreezeDaysInput: (v: string) => void;
  setUpgradeMemberState: (m: Member | null) => void;
  setHistoryMember: (m: Member | null) => void;
  openEdit: (m: Member) => void;
  setConfirmDelete: (m: Member | null) => void;
}

export function MemberList({
  paginatedMembers, invoices, members, filteredLength,
  pageSize, setPageSize, currentPage, setCurrentPage, totalPages,
  unfreezeIsPending, setQrMember, handleDecrement, handleUnfreeze,
  setFreezeMemberState, setFreezeDaysInput, setUpgradeMemberState,
  setHistoryMember, openEdit, setConfirmDelete
}: MemberListProps) {

  if (filteredLength === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground">No members found</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="rounded-md border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Member</TableHead>
            <TableHead>Contact Info</TableHead>
            <TableHead>Class</TableHead>
            <TableHead>Subscription</TableHead>
            <TableHead>Balances</TableHead>
            <TableHead className="w-[100px]">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {paginatedMembers.map(m => {
            const age = calcAge(m.birth_date);
            return (
              <TableRow key={m.uuid} data-testid={`member-row-${m.uuid}`}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <div className={`w-14 h-14 rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden border shadow-sm ${m.id === -1 ? 'bg-teal-100 text-teal-600 border-teal-200' : 'bg-primary/10 text-primary border-primary/20'}`}>
                      {m.photo_url ? (
                        <img src={m.photo_url} alt={m.name} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-xl font-bold">{m.name.charAt(0)}</span>
                      )}
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-foreground text-sm">{m.name}</p>
                        <StatusBadge status={m.status} />
                        {m.frozen_until && new Date(m.frozen_until) > new Date() && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-700">
                            FROZEN
                          </span>
                        )}
                        {(() => {
                          const jGroups = invoices.filter((i: any) => i.member_id === m.uuid && i.joint_invoice_group_id).map((i: any) => i.joint_invoice_group_id);
                          let jIds: any[] = [];
                          if (jGroups.length > 0) {
                            const jInvs = invoices.filter((i: any) => jGroups.includes(i.joint_invoice_group_id) && i.member_id !== m.uuid);
                            jIds = Array.from(new Set(jInvs.map((i: any) => members.find((mem: any) => mem.uuid === i.member_id)?.id))).filter(Boolean);
                          }
                          if (jIds.length === 0) {
                            const myInvs = invoices.filter((i: any) => i.member_id === m.uuid && i.discount_description);
                            for (const inv of myInvs) {
                              const match = inv.discount_description?.match(/(?:joint|join)\s*(?:with)?\s*[:#-]?\s*([\d,\s&]+)/i);
                              if (match && match[1]) {
                                const extractedIds = match[1].replace(/&/g, ',').split(',').map((s: string) => s.trim()).filter((s: string) => s && !isNaN(Number(s)));
                                jIds.push(...extractedIds);
                              }
                            }
                            jIds = Array.from(new Set(jIds));
                          }
                          if (jIds.length === 0) return null;
                          return (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-700">
                              Joint: {jIds.join(', ')}
                            </span>
                          );
                        })()}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {m.id === -1 ? (
                          <span className="text-teal-600 font-medium">Clinic Visitor</span>
                        ) : (
                          <>{`#${m.id ?? '?'}`}</>
                        )}
                        {m.gender && ` · ${m.gender}`}
                        {age !== null && ` · ${age}y`}
                      </p>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Phone className="w-3 h-3" /> {m.phone}
                    </div>
                    {m.parent_phone && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="w-3 h-3 flex items-center justify-center font-bold text-[10px]">P</span> {m.parent_phone}
                      </div>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="space-y-1">
                    {m.class_info ? (
                      <div className="text-sm">
                        <span className="font-semibold text-primary">{m.class_info.name ?? 'No Sport'}</span>
                        <span className="text-muted-foreground mx-1">-</span>
                        <span>{m.class_info.coach_name ?? 'No Coach'}</span>
                        <div className="text-xs text-muted-foreground mt-1">
                          {m.class_info.schedules?.map(s => `${s?.day?.slice(0, 3)} ${s?.time}`).join(', ')}
                        </div>
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-sm">-</span>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="space-y-1">
                    {(() => {
                      const activeInvoices = invoices.filter(i =>
                        i.member_id === m.uuid &&
                        (i.status === 'paid' || i.status === 'partial') &&
                        (i.sessions_remaining === undefined || i.sessions_remaining === null || i.sessions_remaining > 0) &&
                        (!i.package_name || !i.package_name.startsWith('Payment Completion'))
                      );

                      if (activeInvoices.length > 0) {
                        return activeInvoices.map(inv => (
                          <div key={inv.uuid} className="text-sm font-medium text-blue-700 bg-blue-50 px-2 py-1 rounded w-max mb-1">
                            {inv.package_name || inv.class_id} {inv.sessions_remaining === 999 ? '(∞ left)' : inv.sessions_remaining !== null ? `(${inv.sessions_remaining} left)` : ''}
                          </div>
                        ));
                      }

                      if (m.package_name && m.package_name !== 'None') {
                        return (
                          <div className="text-sm font-medium text-gray-500 bg-gray-50 px-2 py-1 rounded w-max mb-1 flex items-center gap-1">
                            {m.package_name} <span className="text-xs font-normal">(Expired/Empty)</span>
                          </div>
                        );
                      }

                      return <p className="text-sm font-medium text-muted-foreground">None</p>;
                    })()}

                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                      Last Subscription: {m.last_subscription_date ? format(new Date(m.last_subscription_date), "dd/MM/yyyy") : 'Never'}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      Expires: {m.expires_at ? format(new Date(m.expires_at), "dd/MM/yyyy") : 'N/A'}
                    </div>
                    {m.pending_subscription_date && (
                      <div className="flex items-center gap-2 text-xs text-amber-600 font-medium">
                        Pending Activation: {format(new Date(m.pending_subscription_date), "dd/MM/yyyy")}
                      </div>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-col gap-1 text-xs">
                    <div className="flex justify-between w-32">
                      <span className="text-muted-foreground">Sessions:</span>
                      <span className="font-medium">{m.sessions_remaining === 999 ? "∞" : m.sessions_remaining}</span>
                    </div>
                    <div className="flex justify-between w-32">
                      <span className="text-muted-foreground">Freezes:</span>
                      <span className="font-medium">{m.freeze_days_remaining}</span>
                    </div>
                    <div className="flex justify-between w-32">
                      <span className="text-muted-foreground">Invites:</span>
                      <span className="font-medium">{m.invitations_remaining ?? 0}</span>
                    </div>
                    <div className="flex justify-between w-32">
                      <span className="text-muted-foreground">InBody:</span>
                      <span className="font-medium">{m.inbody_sessions_remaining ?? 0}</span>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <button
                      data-testid={`btn-qr-member-${m.uuid}`}
                      onClick={() => setQrMember(m)}
                      className="p-1.5 rounded-md hover:bg-slate-50 transition-colors text-muted-foreground hover:text-slate-600"
                      title="Show QR Code"
                    >
                      <QrCode className="w-4 h-4" />
                    </button>
                    {m.invitations_remaining > 0 && (
                      <button
                        data-testid={`btn-invite-member-${m.uuid}`}
                        onClick={() => handleDecrement(m, 'invitations_remaining')}
                        className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                        title="Invite"
                      >
                        <Mail className="w-4 h-4" />
                      </button>
                    )}
                    {m.inbody_sessions_remaining > 0 && (
                      <button
                        data-testid={`btn-inbody-member-${m.uuid}`}
                        onClick={() => handleDecrement(m, 'inbody_sessions_remaining')}
                        className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                        title="InBody"
                      >
                        <BicepsFlexed className="w-4 h-4" />
                      </button>
                    )}
                    {m.frozen_until && new Date(m.frozen_until) > new Date() ? (
                      <button
                        data-testid={`btn-unfreeze-member-${m.uuid}`}
                        onClick={() => handleUnfreeze(m)}
                        className="p-1.5 rounded-md hover:bg-orange-50 transition-colors text-muted-foreground hover:text-orange-600"
                        title="Unfreeze"
                        disabled={unfreezeIsPending}
                      >
                        <Unlock className="w-4 h-4" />
                      </button>
                    ) : m.freeze_days_remaining > 0 ? (
                      <button
                        data-testid={`btn-freeze-member-${m.uuid}`}
                        onClick={() => { setFreezeMemberState(m); setFreezeDaysInput(""); }}
                        className="p-1.5 rounded-md hover:bg-blue-50 transition-colors text-muted-foreground hover:text-blue-600"
                        title="Freeze"
                      >
                        <Snowflake className="w-4 h-4" />
                      </button>
                    ) : null}
                    {m.last_subscription_date && new Date(m.last_subscription_date).getTime() > Date.now() - 7 * 86400000 && (
                      <button
                        data-testid={`btn-upgrade-member-${m.uuid}`}
                        onClick={() => setUpgradeMemberState(m)}
                        className="p-1.5 rounded-md hover:bg-emerald-50 transition-colors text-muted-foreground hover:text-emerald-600"
                        title="Upgrade Package"
                      >
                        <ArrowUpCircle className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      data-testid={`btn-history-member-${m.uuid}`}
                      onClick={() => setHistoryMember(m)}
                      className="p-1.5 rounded-md hover:bg-indigo-50 transition-colors text-muted-foreground hover:text-indigo-600"
                      title="Session History"
                    >
                      <Clock className="w-4 h-4" />
                    </button>
                    <button
                      data-testid={`btn-edit-member-${m.uuid}`}
                      onClick={() => openEdit(m)}
                      className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                      title="Edit"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      data-testid={`btn-delete-member-${m.uuid}`}
                      onClick={() => setConfirmDelete(m)}
                      className="p-1.5 rounded-md hover:bg-red-50 transition-colors text-muted-foreground hover:text-red-600"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      <div className="flex items-center justify-between p-4 border-t">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Rows per page:</span>
          <Select value={pageSize.toString()} onValueChange={v => { setPageSize(Number(v)); setCurrentPage(1); }}>
            <SelectTrigger className="w-[70px] h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="25">25</SelectItem>
              <SelectItem value="50">50</SelectItem>
              <SelectItem value="100">100</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-4">
          <span className="text-sm text-muted-foreground">
            Page {currentPage} of {totalPages} (Total: {filteredLength})
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages || totalPages === 0}
            >
              Next
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
