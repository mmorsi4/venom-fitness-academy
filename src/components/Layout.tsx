import { ReactNode, useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import {
  LayoutDashboard, Users, LogIn, Package, FileText, DollarSign,
  Dumbbell, Calendar, UserPlus, ClipboardList, Tag,
  ChevronRight, CalendarDays, BarChart2, AlertCircle, Landmark,
  UserCog, LogOut, Menu, X, Trophy, Shield
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { useLiabilities } from "@/hooks/use-data";
import { differenceInDays, parseISO } from "date-fns";
import { toast } from "sonner";

const ALL_NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/checkin", label: "Check-In", icon: LogIn, highlight: true },
  { href: "/members", label: "Members", icon: Users },
  { href: "/subscriptions", label: "Subscriptions", icon: Package },
  { href: "/invoices", label: "Accounting", icon: FileText },
  { href: "/discounts", label: "Discounts", icon: Tag },
  { href: "/finance", label: "Finance", icon: DollarSign },
  { href: "/daily", label: "Daily Report", icon: CalendarDays },
  { href: "/reports", label: "Member Reports", icon: BarChart2 },
  { href: "/coaches", label: "Coaches", icon: Dumbbell },
  { href: "/classes", label: "Classes", icon: Calendar },
  { href: "/sports", label: "Sports", icon: Trophy },
  { href: "/leads", label: "Leads", icon: UserPlus },
  { href: "/liabilities", label: "Liabilities", icon: Landmark },
  { href: "/audit", label: "Audit Log", icon: ClipboardList },
  { href: "/users", label: "User Management", icon: UserCog },
  { href: "/employees", label: "Employees", icon: Users },
  { href: "/employee-checkin", label: "Staff Check-In", icon: Shield },
];

export default function Layout({ children }: { children: ReactNode }) {
  const [location, setLocation] = useLocation();
  const { currentUser, logout } = useAuth();
  const { data: liabilities = [] } = useLiabilities();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Close mobile menu when route changes
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location]);

  if (!currentUser) return <>{children}</>;

  const allowedHrefs = Array.from(new Set([...currentUser.roles.flatMap(r => r.tabs), '/employee-checkin']));
  const navItems = ALL_NAV_ITEMS.filter(item => allowedHrefs.includes(item.href));
  
  // Route protection
  useEffect(() => {
    if (location === '/' && !allowedHrefs.includes('/')) {
      if (allowedHrefs.length > 0) {
        setLocation(allowedHrefs[0]);
      }
    }
  }, [location, allowedHrefs, setLocation]);

  const isKnownRoute = ALL_NAV_ITEMS.some(item => item.href === location);
  const isAllowed = !isKnownRoute || allowedHrefs.includes(location);

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
    <div className="flex h-screen print:h-auto overflow-hidden print:overflow-visible bg-background w-full">
      {/* Mobile Backdrop */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/80 z-40 md:hidden print:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 w-64 bg-sidebar flex flex-col transform transition-transform duration-300 ease-in-out md:relative md:translate-x-0 print:hidden",
        isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        {/* Mobile close button */}
        <button 
          onClick={() => setIsMobileMenuOpen(false)}
          className="md:hidden absolute top-4 right-4 p-2 text-sidebar-foreground hover:bg-sidebar-accent rounded-md"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Logo */}
        <div className="px-4 py-2 mt-8 md:mt-0">
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
              <p className="text-xs text-sidebar-foreground/50 truncate capitalize">{currentUser.roles.map(r => r.name).join(', ')}</p>
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
      <main className="flex-1 overflow-y-auto print:overflow-visible flex flex-col relative w-full min-w-0">
        {/* Mobile Header */}
        <div className="md:hidden print:hidden flex items-center justify-between p-4 bg-sidebar border-b border-sidebar-border flex-shrink-0 sticky top-0 z-30">
          <button 
            onClick={() => setIsMobileMenuOpen(true)}
            className="p-2 -ml-2 text-sidebar-foreground hover:bg-sidebar-accent rounded-md transition-colors"
          >
            <Menu className="w-6 h-6" />
          </button>
          <img src="/venom_logo.png" alt="Venom Logo" className="h-8 object-contain" />
        </div>

        {/* Liability due ribbons */}
        {canViewLiabilities && dueLiabilities.map(l => {
          const daysUntil = differenceInDays(parseISO(l.next_due_date), new Date());
          return (
            <div
              key={l.id}
              className="flex flex-col md:flex-row md:items-center gap-3 px-4 py-3 bg-red-600 text-white text-sm flex-shrink-0"
              data-testid={`liability-ribbon-${l.id}`}
            >
              <div className="flex items-start md:items-center gap-3 flex-1">
                <AlertCircle className="w-5 h-5 flex-shrink-0 animate-pulse mt-0.5 md:mt-0" />
                <span className="font-medium leading-tight">
                  <strong>{l.name}</strong> — {l.type === 'one_time' ? 'Payment' : 'Installment'} of{' '}
                  <strong>{l.installment_amount.toLocaleString()} EGP</strong> due{' '}
                  {daysUntil === 0 ? 'today' : `in ${daysUntil} day${daysUntil !== 1 ? 's' : ''}`}
                  {' '}
                  <span className="hidden md:inline">· Pay via Finance → Add Expense → Liability Payment</span>
                </span>
              </div>
              <div className="flex items-center gap-2 md:pl-0 pl-8">
                {allowedHrefs.includes('/liabilities') && (
                  <Link
                    href="/liabilities"
                    className="flex-shrink-0 px-3 py-1.5 md:py-1 rounded bg-white/20 hover:bg-white/30 text-white text-xs font-medium transition-colors border border-white/20 text-center flex-1 md:flex-none"
                  >
                    View Details
                  </Link>
                )}
                {allowedHrefs.includes('/finance') && (
                  <Link
                    href={`/invoices?action=add-expense&category=Liability+Payment&liability_id=${l.id}&amount=${l.installment_amount}`}
                    className="flex-shrink-0 px-3 py-1.5 md:py-1 rounded bg-white text-red-700 text-xs font-semibold hover:bg-white/90 transition-colors text-center flex-1 md:flex-none"
                  >
                    Pay Now →
                  </Link>
                )}
              </div>
            </div>
          );
        })}

        <div className="flex-1">
          {isAllowed ? children : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center p-8 bg-white border border-gray-200 rounded-xl shadow-sm max-w-md">
                <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                <h2 className="text-xl font-bold text-gray-900 mb-2">Access Denied</h2>
                <p className="text-gray-500 mb-6">
                  You do not have permission to view this page. If you believe this is an error, please contact your administrator.
                </p>
                {allowedHrefs.length > 0 && (
                  <button
                    onClick={() => setLocation(allowedHrefs[0])}
                    className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 transition-colors"
                  >
                    Go to {ALL_NAV_ITEMS.find(i => i.href === allowedHrefs[0])?.label || 'Homepage'}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
