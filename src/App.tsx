import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { AppStateProvider } from "@/lib/store";
import { AuthProvider, useAuth } from "@/lib/auth";
import Layout from "@/components/Layout";
import LoginPage from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import Members from "@/pages/Members";
import CheckIn from "@/pages/CheckIn";
import Subscriptions from "@/pages/Subscriptions";
import Invoices from "@/pages/Invoices";
import Finance from "@/pages/Finance";
import Coaches from "@/pages/Coaches";
import Schedule from "@/pages/Schedule";
import Leads from "@/pages/Leads";
import AuditLog from "@/pages/AuditLog";
import Discounts from "@/pages/Discounts";
import DailyReport from "@/pages/DailyReport";
import Reports from "@/pages/Reports";
import Liabilities from "@/pages/Liabilities";
import UsersPage from "@/pages/Users";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient();

function Router() {
  return (
    <Layout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/members" component={Members} />
        <Route path="/checkin" component={CheckIn} />
        <Route path="/subscriptions" component={Subscriptions} />
        <Route path="/invoices" component={Invoices} />
        <Route path="/finance" component={Finance} />
        <Route path="/coaches" component={Coaches} />
        <Route path="/schedule" component={Schedule} />
        <Route path="/leads" component={Leads} />
        <Route path="/audit" component={AuditLog} />
        <Route path="/discounts" component={Discounts} />
        <Route path="/daily" component={DailyReport} />
        <Route path="/reports" component={Reports} />
        <Route path="/liabilities" component={Liabilities} />
        <Route path="/users" component={UsersPage} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function AppInner() {
  const { currentUser } = useAuth();
  if (!currentUser) return <LoginPage />;
  return (
    <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
      <Router />
    </WouterRouter>
  );
}

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClient}>
        <AppStateProvider>
          <TooltipProvider>
            <AppInner />
            <Toaster richColors position="top-right" />
          </TooltipProvider>
        </AppStateProvider>
      </QueryClientProvider>
    </AuthProvider>
  );
}

export default App;
