import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PAYMENT_METHODS } from "@/lib/constants";

interface InvoiceFiltersProps {
  searchField: string;
  setSearchField: (v: string) => void;
  searchQuery: string;
  setSearchQuery: (v: string) => void;
  setCurrentPage: (v: number) => void;
  filterPaymentMethod: string;
  setFilterPaymentMethod: (v: string) => void;
  filterPackage: string;
  setFilterPackage: (v: string) => void;
  invoices: any[];
  filterDateFrom: string;
  setFilterDateFrom: (v: string) => void;
  filterDateTo: string;
  setFilterDateTo: (v: string) => void;
  filterClinicOnly: boolean;
  setFilterClinicOnly: (v: boolean) => void;
  filterActivationDateFrom: string;
  setFilterActivationDateFrom: (v: string) => void;
  filterActivationDateTo: string;
  setFilterActivationDateTo: (v: string) => void;
}

export function InvoiceFilters({
  searchField, setSearchField, searchQuery, setSearchQuery, setCurrentPage,
  filterPaymentMethod, setFilterPaymentMethod, filterPackage, setFilterPackage,
  invoices, filterDateFrom, setFilterDateFrom, filterDateTo, setFilterDateTo,
  filterClinicOnly, setFilterClinicOnly, filterActivationDateFrom,
  setFilterActivationDateFrom, filterActivationDateTo, setFilterActivationDateTo
}: InvoiceFiltersProps) {
  return (
    <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
      <div className="flex flex-wrap gap-2">
        <Select value={searchField} onValueChange={setSearchField}>
          <SelectTrigger className="w-[130px] h-9">
            <SelectValue placeholder="Search by..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Fields</SelectItem>
            <SelectItem value="id">ID / Invoice #</SelectItem>
            <SelectItem value="name">Name</SelectItem>
            <SelectItem value="phone">Phone</SelectItem>
          </SelectContent>
        </Select>
        <div className="relative w-64">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search invoices..."
            className="pl-9 h-9"
            value={searchQuery}
            onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); }}
          />
        </div>
      </div>
      <Select value={filterPaymentMethod} onValueChange={setFilterPaymentMethod}>
        <SelectTrigger className="w-36" data-testid="filter-payment-method">
          <SelectValue placeholder="Payment..." />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Methods</SelectItem>
          {PAYMENT_METHODS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
        </SelectContent>
      </Select>
      <Select value={filterPackage} onValueChange={setFilterPackage}>
        <SelectTrigger className="w-40" data-testid="filter-package">
          <SelectValue placeholder="Package..." />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Packages</SelectItem>
          {[...new Set(invoices.map(i => i.package_name).filter(Boolean))].map(p => (
            <SelectItem key={String(p)} value={String(p)}>{String(p)}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input
        type="date"
        value={filterDateFrom}
        onChange={e => setFilterDateFrom(e.target.value)}
        className="w-36"
        title="From date"
      />
      <Input
        type="date"
        value={filterDateTo}
        onChange={e => setFilterDateTo(e.target.value)}
        className="w-36"
        title="To date"
      />
      <div className="flex items-center space-x-2 bg-muted/30 px-3 rounded-md border border-border/50">
        <input
          type="checkbox"
          id="clinic-invoices-toggle"
          checked={filterClinicOnly}
          onChange={(e) => setFilterClinicOnly(e.target.checked)}
          className="rounded border-gray-300 text-primary focus:ring-primary"
        />
        <Label htmlFor="clinic-invoices-toggle" className="text-sm font-medium leading-none cursor-pointer">
          Clinic Only
        </Label>
      </div>
      <div className="flex items-center space-x-2">
        <Label className="text-xs text-muted-foreground shrink-0">Activation Date:</Label>
        <Input
          type="date"
          value={filterActivationDateFrom}
          onChange={e => setFilterActivationDateFrom(e.target.value)}
          className="w-36"
          title="From activation date"
        />
        <Input
          type="date"
          value={filterActivationDateTo}
          onChange={e => setFilterActivationDateTo(e.target.value)}
          className="w-36"
          title="To activation date"
        />
      </div>
    </div>
  );
}
