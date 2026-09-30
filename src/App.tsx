import { lazy, Suspense } from "react";
import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider, useAuth } from "@/lib/auth";
import Layout from "@/components/Layout";
import LoginPage from "@/pages/Login";

// Lazy-loaded routes for performance and fast initial page load
const Dashboard = lazy(() => import("@/pages/Dashboard"));
const Members = lazy(() => import("@/pages/Members"));
const CheckIn = lazy(() => import("@/pages/CheckIn"));
const Subscriptions = lazy(() => import("@/pages/Subscriptions"));
const Invoices = lazy(() => import("@/pages/Invoices"));
const Finance = lazy(() => import("@/pages/Finance"));
const Coaches = lazy(() => import("@/pages/Coaches"));
const Classes = lazy(() => import("@/pages/Classes"));
const Sports = lazy(() => import("@/pages/Sports"));
const Leads = lazy(() => import("@/pages/Leads"));
const AuditLog = lazy(() => import("@/pages/AuditLog"));
const Discounts = lazy(() => import("@/pages/Discounts"));
const DailyReport = lazy(() => import("@/pages/DailyReport"));
const Reports = lazy(() => import("@/pages/Reports"));
const Liabilities = lazy(() => import("@/pages/Liabilities"));
const UsersPage = lazy(() => import("@/pages/Users"));
const Employees = lazy(() => import("@/pages/Employees"));
const EmployeeCheckIn = lazy(() => import("@/pages/EmployeeCheckIn"));
const NotFound = lazy(() => import("@/pages/not-found"));
const Register = lazy(() => import("@/pages/Register"));

function PageLoader() {
  return (
    <div className="flex h-[60vh] w-full items-center justify-center">
      <div className="flex flex-col items-center gap-2">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <span className="text-xs text-muted-foreground">Loading...</span>
      </div>
    </div>
  );
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 3, // 3 minutes stale time to avoid repetitive heavy network queries
      gcTime: 1000 * 60 * 15,    // Keep garbage collection cache for 15 minutes
      refetchOnWindowFocus: false, // Prevent aggressive network requests on every window focus
      retry: 1,
    },
  },
});

function Router() {
  return (
    <Layout>
      <Suspense fallback={<PageLoader />}>
        <Switch>
          <Route path="/" component={Dashboard} />
          <Route path="/members" component={Members} />
          <Route path="/checkin" component={CheckIn} />
          <Route path="/subscriptions" component={Subscriptions} />
          <Route path="/invoices" component={Invoices} />
          <Route path="/finance" component={Finance} />
          <Route path="/coaches" component={Coaches} />
          <Route path="/classes" component={Classes} />
          <Route path="/sports" component={Sports} />
          <Route path="/leads" component={Leads} />
          <Route path="/audit" component={AuditLog} />
          <Route path="/discounts" component={Discounts} />
          <Route path="/daily" component={DailyReport} />
          <Route path="/reports" component={Reports} />
          <Route path="/liabilities" component={Liabilities} />
          <Route path="/users" component={UsersPage} />
          <Route path="/employees" component={Employees} />
          <Route path="/employee-checkin" component={EmployeeCheckIn} />

          <Route component={NotFound} />
        </Switch>
      </Suspense>
    </Layout>
  );
}

function AppInner() {
  const { currentUser, loading } = useAuth();
  
  if (loading) {
    return <div className="min-h-screen bg-sidebar flex items-center justify-center p-4">Loading...</div>;
  }

  if (!currentUser) return <LoginPage />;
  return <Router />;
}

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Switch>
              <Route path="/register/:id" component={Register} />
              <Route path="*">
                <AppInner />
              </Route>
            </Switch>
          </WouterRouter>
          <Toaster richColors position="top-right" />
        </TooltipProvider>
      </QueryClientProvider>
    </AuthProvider>
  );
}

export default App;
