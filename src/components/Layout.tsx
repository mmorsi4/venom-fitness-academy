import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import {
  LayoutDashboard, Users, LogIn, Package, FileText, DollarSign,
  Dumbbell, Calendar, UserPlus, ClipboardList, Tag,
  ChevronRight, CalendarDays, BarChart2, AlertCircle, Landmark,
  UserCog, LogOut
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth, ROLE_NAV } from "@/lib/auth";
import { useLiabilities } from "@/hooks/use-data";
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
  const { currentUser, logout } = useAuth();
  const { data: liabilities = [] } = useLiabilities();

  if (!currentUser) return <>{children}</>;

  const allowedHrefs = ROLE_NAV[currentUser.role];
  const navItems = ALL_NAV_ITEMS.filter(item => allowedHrefs.includes(item.href));
  
  const canViewLiabilities = allowedHrefs.includes('/finance') || allowedHrefs.includes('/liabilities');

  const dueLiabilities = liabilities.filter(l => {
    if (l.is_complete) return false;
    const daysUntil = differenceInDays(parseISO(l.next_due_date), new Date());
    return daysUntil <= l.notify_days_before && daysUntil >= 0;
  });

  const handleLogout = () => {
    logout();
    toast.success("Signed out");
  };

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar */}
      <aside className="w-60 flex-shrink-0 bg-sidebar flex flex-col">
        {/* Logo */}
        <div className="px-4 py-2">
          <div className="flex flex-col items-center gap-2 py-2">
            <img src="/venom_logo.png" alt="Venom Logo" className="w-full h-18 object-contain" />
          </div>
        </div>

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
              {currentUser.name.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-white truncate">{currentUser.name}</p>
              <p className="text-xs text-sidebar-foreground/50 truncate capitalize">{currentUser.role}</p>
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
        {/* Liability due ribbons */}
        {canViewLiabilities && dueLiabilities.map(l => {
          const daysUntil = differenceInDays(parseISO(l.next_due_date), new Date());
          return (
            <div
              key={l.id}
              className="flex items-center gap-3 px-4 py-2.5 bg-red-600 text-white text-sm flex-shrink-0"
              data-testid={`liability-ribbon-${l.id}`}
            >
              <AlertCircle className="w-4 h-4 flex-shrink-0 animate-pulse" />
              <span className="flex-1 font-medium">
                <strong>{l.name}</strong> — {l.type === 'one_time' ? 'Payment' : 'Installment'} of{' '}
                <strong>{l.installment_amount.toLocaleString()} EGP</strong> due{' '}
                {daysUntil === 0 ? 'today' : `in ${daysUntil} day${daysUntil !== 1 ? 's' : ''}`}
                {' '}· Pay via Finance → Add Expense → Liability Payment
              </span>
              {allowedHrefs.includes('/liabilities') && (
                <Link
                  href="/liabilities"
                  className="flex-shrink-0 px-3 py-1 rounded bg-white/20 hover:bg-white/30 text-white text-xs font-medium transition-colors border border-white/20"
                >
                  View Details
                </Link>
              )}
              {allowedHrefs.includes('/finance') && (
                <Link
                  href="/finance"
                  className="flex-shrink-0 px-3 py-1 rounded bg-white text-red-700 text-xs font-semibold hover:bg-white/90 transition-colors"
                >
                  Pay Now →
                </Link>
              )}
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
