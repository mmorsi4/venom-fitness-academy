import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Class, SubscriptionPackage } from "@/lib/types";

interface MemberFiltersProps {
  searchField: string;
  setSearchField: (v: string) => void;
  query: string;
  setQuery: (v: string) => void;
  setCurrentPage: (v: number) => void;
  statusFilter: string;
  setStatusFilter: (v: string) => void;
  counts: Record<string, number>;
  classFilter: string;
  setClassFilter: (v: string) => void;
  classes: Class[];
  packageFilter: string;
  setPackageFilter: (v: string) => void;
  packages: SubscriptionPackage[];
}

export function MemberFilters({
  searchField, setSearchField, query, setQuery, setCurrentPage,
  statusFilter, setStatusFilter, counts,
  classFilter, setClassFilter, classes,
  packageFilter, setPackageFilter, packages
}: MemberFiltersProps) {
  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 flex gap-2">
          <Select value={searchField} onValueChange={setSearchField}>
            <SelectTrigger className="w-[120px]">
              <SelectValue placeholder="Search by..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Any</SelectItem>
              <SelectItem value="id">ID</SelectItem>
              <SelectItem value="name">Name</SelectItem>
              <SelectItem value="phone">Phone</SelectItem>
            </SelectContent>
          </Select>
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              data-testid="input-member-search"
              placeholder={`Search ${searchField === 'all' ? 'by name, ID, or phone' : `by ${searchField}`}...`}
              value={query}
              onChange={e => {
                setQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="pl-9"
            />
          </div>
        </div>
        <Tabs value={statusFilter} onValueChange={setStatusFilter}>
          <TabsList className="h-9 flex-wrap">
            <TabsTrigger value="all" className="text-xs">All ({counts.all})</TabsTrigger>
            <TabsTrigger value="active" className="text-xs">Active ({counts.active})</TabsTrigger>
            <TabsTrigger value="frozen" className="text-xs">Frozen ({counts.frozen})</TabsTrigger>
            <TabsTrigger value="expiring_soon" className="text-xs">Expiring ({counts.expiring_soon})</TabsTrigger>
            <TabsTrigger value="expired" className="text-xs">Expired ({counts.expired})</TabsTrigger>
            <TabsTrigger value="has_debt" className="text-xs">Debt ({counts.has_debt})</TabsTrigger>
            <TabsTrigger value="new" className="text-xs">New ({counts.new})</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <Select value={classFilter} onValueChange={setClassFilter}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue placeholder="Filter by class" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Classes</SelectItem>
            {classes.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={packageFilter} onValueChange={setPackageFilter}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue placeholder="Filter by subscription" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Subscriptions</SelectItem>
            {packages.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
