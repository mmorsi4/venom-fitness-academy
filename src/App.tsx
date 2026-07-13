import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
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
import Classes from "@/pages/Classes";
import Sports from "@/pages/Sports";
import Leads from "@/pages/Leads";
import AuditLog from "@/pages/AuditLog";
import Discounts from "@/pages/Discounts";
import DailyReport from "@/pages/DailyReport";
import Reports from "@/pages/Reports";
import Liabilities from "@/pages/Liabilities";
import UsersPage from "@/pages/Users";
import Employees from "@/pages/Employees";
import EmployeeCheckIn from "@/pages/EmployeeCheckIn";
import NotFound from "@/pages/not-found";
import Register from "@/pages/Register";

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
    </Layout>
  );
}

function AppInner() {
  const { currentUser } = useAuth();
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
