import { Link } from "wouter";
import { format } from "date-fns";
import { Tag, Trash2, Pencil, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Invoice, Member } from "@/lib/types";

interface InvoiceListProps {
  paginatedInvoices: Invoice[];
  invoices: Invoice[];
  members: Member[];
  filteredLength: number;
  pageSize: number;
  setPageSize: (v: number) => void;
  currentPage: number;
  setCurrentPage: React.Dispatch<React.SetStateAction<number>>;
  totalPages: number;
  openEditInvoice: (inv: Invoice) => void;
  setConfirmDelete: (inv: Invoice | null) => void;
  setPaymentModalInvoice: (inv: Invoice | null) => void;
}

export function InvoiceList({
  paginatedInvoices, invoices, members, filteredLength,
  pageSize, setPageSize, currentPage, setCurrentPage, totalPages,
  openEditInvoice, setConfirmDelete, setPaymentModalInvoice
}: InvoiceListProps) {

  const getActualPaidAmount = (inv: Invoice) => {
    const childrenPaid = invoices
      .filter(i => i.package_name && i.package_name.startsWith(`Payment Completion: ${inv.id}`))
      .reduce((sum, i) => sum + i.paid_amount, 0);
    return inv.paid_amount + childrenPaid;
  };

  if (filteredLength === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground">No invoices</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="rounded-md border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Invoice</TableHead>
            <TableHead>Member ID</TableHead>
            <TableHead>Member Name</TableHead>
            <TableHead>Package</TableHead>
            <TableHead>Creation Date</TableHead>
            <TableHead>Status & Payment</TableHead>
            <TableHead className="text-right">Amount</TableHead>
            <TableHead className="w-[80px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {paginatedInvoices.map((inv: any) => {
            const shortId = members.find(m => m.uuid === inv.member_id)?.id;
            const jointRelated = inv.joint_invoice_group_id ? invoices.filter((i: any) => i.joint_invoice_group_id === inv.joint_invoice_group_id && i.uuid !== inv.uuid) : [];

            return (
              <TableRow key={inv.uuid} data-testid={`invoice-${inv.uuid}`}>
                <TableCell className="font-bold text-xs text-muted-foreground">
                  {inv.id}
                </TableCell>
                <TableCell className="text-sm font-medium text-muted-foreground">{shortId === -1 ? 'Clinic Visitor' : (shortId ?? '?')}</TableCell>
                <TableCell className="font-medium text-sm">
                  <Link href={`/members?search=${inv.member_id}`} className="hover:underline text-primary">
                    {inv.member_name}
                  </Link>
                  {inv.id.startsWith("FREE-") && (
                    <div className="mt-1">
                      <span className="text-[10px] text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded-md inline-block max-w-fit font-bold">
                        FREE MEMBERSHIP
                      </span>
                    </div>
                  )}
                  {inv.joint_invoice_group_id && (
                    <div className="mt-1 flex flex-col gap-0.5">
                      <span className="text-[10px] text-purple-700 bg-purple-100 px-1.5 py-0.5 rounded-md inline-block max-w-fit font-bold">
                        JOINT INVOICE
                      </span>
                      {jointRelated.map(r => {
                        const relShortId = members.find(m => m.uuid === r.member_id)?.id;
                        return (
                          <span key={r.uuid} className="text-[10px] text-muted-foreground ml-1">
                            With: #{relShortId} {r.member_name}
                          </span>
                        );
                      })}
                    </div>
                  )}
                </TableCell>
                <TableCell>
                  <p className="text-sm font-semibold">{inv.package_name}</p>
                  <p className="text-xs text-muted-foreground">{inv.discount_description}</p>
                  {inv.activation_date && (
                    <p className="text-[10px] text-blue-600 mt-0.5">Starts: {format(new Date(inv.activation_date), "dd MMM yyyy")}</p>
                  )}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {format(new Date(inv.created_at), "dd MMM yyyy")}
                </TableCell>
                <TableCell>
                  <div className="flex flex-col gap-1 items-start">
                    <span className={`capitalize px-2 py-0.5 rounded-full text-xs font-medium ${
                      inv.status === 'paid' ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' :
                      inv.status === 'partial' ? 'bg-amber-100 text-amber-700 border border-amber-200' :
                      'bg-red-100 text-red-700 border border-red-200'
                    }`}>
                      {inv.status}
                    </span>
                    <div className="flex flex-col gap-0.5 text-xs text-muted-foreground mt-1">
                      {inv.payment_method === 'Split' && inv.split_payments ? (
                        inv.split_payments.map((sp: any, idx: number) => (
                          <div key={idx} className="flex items-center gap-1 text-[10px]">
                            <CreditCard className="w-3 h-3" /> {sp.method}: {sp.amount}
                          </div>
                        ))
                      ) : (
                        <div className="flex items-center gap-1">
                          <CreditCard className="w-3 h-3" /> {inv.payment_method}
                        </div>
                      )}
                    </div>
                    {inv.status === 'partial' && (
                      <div className="space-y-1">
                        <p className="text-[10px] text-muted-foreground">Paid: {getActualPaidAmount(inv)} / {inv.total_amount}</p>
                        <Button
                          size="sm"
                          variant="secondary"
                          className="h-6 text-[10px] px-2"
                          onClick={(e) => {
                            e.stopPropagation();
                            setPaymentModalInvoice(inv);
                          }}
                        >
                          Collect
                        </Button>
                      </div>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <p className="text-sm font-bold">{getActualPaidAmount(inv).toLocaleString()} EGP</p>
                  {inv.discount_amount > 0 && (
                    <div className="flex items-center gap-1 justify-end text-muted-foreground mt-0.5">
                      <Tag className="w-3 h-3" />
                      <p className="text-[10px]">-{inv.discount_amount} EGP</p>
                    </div>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1 justify-end">
                    <button
                      data-testid={`btn-edit-invoice-${inv.uuid}`}
                      onClick={() => openEditInvoice(inv)}
                      className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      data-testid={`btn-delete-invoice-${inv.uuid}`}
                      onClick={() => setConfirmDelete(inv)}
                      className="p-1.5 rounded-md hover:bg-red-50 transition-colors text-muted-foreground hover:text-red-600"
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
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground mr-4">
            Page {currentPage} of {totalPages === 0 ? 1 : totalPages} ({filteredLength} total)
          </span>
          <div className="flex gap-1">
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
