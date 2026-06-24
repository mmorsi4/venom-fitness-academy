import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import {
  LayoutDashboard, Users, LogIn, Package, FileText, DollarSign,
  Dumbbell, Calendar, UserPlus, ClipboardList, Tag, Settings,
  ChevronRight, CalendarDays, BarChart2, AlertCircle, Landmark,
  UserCog, LogOut, ImageIcon
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAppState } from "@/lib/store";
import { useAuth, ROLE_NAV } from "@/lib/auth";
import { differenceInDays, parseISO } from "date-fns";
import { toast } from "sonner";

const ALL_NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/checkin", label: "Check-In", icon: LogIn, highlight: true },
  { href: "/members", label: "Members", icon: Users },
  { href: "/subscriptions", label: "Subscriptions", icon: Package },
  { href: "/invoices", label: "Invoices", icon: FileText },
  { href: "/discounts", label: "Discounts", icon: Tag },
  { href: "/finance", label: "Finance", icon: DollarSign },
  { href: "/daily", label: "Daily Report", icon: CalendarDays },
  { href: "/reports", label: "Member Reports", icon: BarChart2 },
  { href: "/coaches", label: "Coaches", icon: Dumbbell },
  { href: "/schedule", label: "Schedule", icon: Calendar },
  { href: "/leads", label: "Leads (CRM)", icon: UserPlus },
  { href: "/liabilities", label: "Liabilities", icon: Landmark },
  { href: "/audit", label: "Audit Log", icon: ClipboardList },
  { href: "/users", label: "User Management", icon: UserCog },
];

export default function Layout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const { state } = useAppState();
  const { currentUser, logout } = useAuth();

  const allowedHrefs = ROLE_NAV[currentUser!.role];
  const navItems = ALL_NAV_ITEMS.filter(item => allowedHrefs.includes(item.href));

  // const expiringSoon = state.members.filter(m => m.status === 'expiring_soon').length;
  // const hasDebt = state.members.filter(m => m.status === 'has_debt').length;
  // const newLeads = state.leads.filter(l => l.status === 'New').length;

  const dueLiabilities = state.liabilities.filter(l => {
    if (l.isComplete) return false;
    const daysUntil = differenceInDays(parseISO(l.nextDueDate), new Date());
    return daysUntil <= l.notifyDaysBefore && daysUntil >= 0;
  });

  const handleLogout = () => {
    logout();
    toast.success("Signed out");
  };

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar */}
      <aside className="w-60 flex-shrink-0 bg-sidebar flex flex-col border-r border-sidebar-border">
        {/* Logo — image placeholder */}
        <div className="px-4 py-4 border-b border-sidebar-border">
          <div className="flex flex-col items-center gap-2 py-2">
            <div className="w-full h-14 rounded-xl border-2 border-dashed border-sidebar-border/60 flex flex-col items-center justify-center gap-1 text-sidebar-foreground/40 hover:border-primary/50 hover:text-primary/60 transition-colors cursor-pointer group">
              <ImageIcon className="w-5 h-5 group-hover:text-primary/60" />
              <span className="text-[10px] font-medium uppercase tracking-wider">Gym Logo</span>
            </div>
            <div className="text-center">
              <p className="text-xs font-semibold text-white/80 leading-none">GymPro</p>
              <p className="text-[10px] text-sidebar-foreground/40 mt-0.5">Management System</p>
            </div>
          </div>
        </div>

        {/* Alert strip
        {(expiringSoon > 0 || hasDebt > 0 || newLeads > 0) && (
          <div className="px-3 py-2 border-b border-sidebar-border space-y-1">
            {expiringSoon > 0 && (
              <div className="flex items-center gap-2 px-2 py-1 rounded bg-amber-500/10 text-amber-400 text-xs">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" />
                {expiringSoon} expiring soon
              </div>
            )}
            {hasDebt > 0 && (
              <div className="flex items-center gap-2 px-2 py-1 rounded bg-purple-500/10 text-purple-400 text-xs">
                <span className="w-1.5 h-1.5 rounded-full bg-purple-400 flex-shrink-0" />
                {hasDebt} outstanding debt
              </div>
            )}
            {newLeads > 0 && (
              <div className="flex items-center gap-2 px-2 py-1 rounded bg-blue-500/10 text-blue-400 text-xs">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0" />
                {newLeads} new leads
              </div>
            )}
          </div>
        )} */}

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-2 px-2 space-y-0.5">
          {navItems.map(({ href, label, icon: Icon, highlight }) => {
            const active = location === href;
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-all cursor-pointer",
                  active
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : highlight
                      ? "text-primary border border-primary/30 hover:bg-primary hover:text-primary-foreground"
                      : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                )}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                <span className="flex-1 truncate">{label}</span>
                {active && <ChevronRight className="w-3 h-3 opacity-60 flex-shrink-0" />}
                {href === '/liabilities' && dueLiabilities.length > 0 && !active && (
                  <span className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0 animate-pulse" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="px-3 py-3 border-t border-sidebar-border">
          <div className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-sidebar-accent transition-colors">
            <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center text-xs font-bold text-primary-foreground flex-shrink-0">
              {currentUser!.name.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-white truncate">{currentUser!.name}</p>
              <p className="text-xs text-sidebar-foreground/50 truncate capitalize">{currentUser!.role}</p>
            </div>
            <button
              onClick={handleLogout}
              title="Sign out"
              className="text-sidebar-foreground/40 hover:text-red-400 transition-colors flex-shrink-0"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto flex flex-col">
        {/* Liability due ribbons — informational only, pay via Finance */}
        {dueLiabilities.map(l => {
          const daysUntil = differenceInDays(parseISO(l.nextDueDate), new Date());
          return (
            <div
              key={l.id}
              className="flex items-center gap-3 px-4 py-2.5 bg-red-600 text-white text-sm flex-shrink-0"
              data-testid={`liability-ribbon-${l.id}`}
            >
              <AlertCircle className="w-4 h-4 flex-shrink-0 animate-pulse" />
              <span className="flex-1 font-medium">
                <strong>{l.name}</strong> — {l.type === 'one_time' ? 'Payment' : 'Installment'} of{' '}
                <strong>{l.installmentAmount.toLocaleString()} EGP</strong> due{' '}
                {daysUntil === 0 ? 'today' : `in ${daysUntil} day${daysUntil !== 1 ? 's' : ''}`}
                {' '}· Pay via Finance → Add Expense → Liability Payment
              </span>
              <Link
                href="/liabilities"
                className="flex-shrink-0 px-3 py-1 rounded bg-white/20 hover:bg-white/30 text-white text-xs font-medium transition-colors border border-white/20"
              >
                View Details
              </Link>
              <Link
                href="/finance"
                className="flex-shrink-0 px-3 py-1 rounded bg-white text-red-700 text-xs font-semibold hover:bg-white/90 transition-colors"
              >
                Pay Now →
              </Link>
            </div>
          );
        })}

        <div className="flex-1">
          {children}
        </div>
      </main>
    </div>
  );
}
