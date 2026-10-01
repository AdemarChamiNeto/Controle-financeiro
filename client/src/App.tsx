import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { useAuth } from "@/_core/hooks/useAuth";
import { FinanceDashboardLayout } from "@/components/FinanceDashboardLayout";
import { Loader2 } from "lucide-react";

// Pages
import Dashboard from "@/pages/Dashboard";
import Transactions from "@/pages/Transactions";
import Categories from "@/pages/Categories";
import Budgets from "@/pages/Budgets";
import Goals from "@/pages/Goals";
import Reports from "@/pages/Reports";
import Settings from "@/pages/Settings";
import NotFound from "@/pages/NotFound";
import Login from "@/pages/Login";

const withLayout = (Page: React.ComponentType) => {
  const Wrapped = () => (
    <FinanceDashboardLayout>
      <Page />
    </FinanceDashboardLayout>
  );
  return Wrapped;
};
const DashboardPage = withLayout(Dashboard);
const TransactionsPage = withLayout(Transactions);
const CategoriesPage = withLayout(Categories);
const BudgetsPage = withLayout(Budgets);
const GoalsPage = withLayout(Goals);
const ReportsPage = withLayout(Reports);
const SettingsPage = withLayout(Settings);

function Router() {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-accent" aria-label="Carregando" />
      </div>
    );
  }

  return (
    <Switch>
      {isAuthenticated ? (
        <>
          <Route path="/" component={DashboardPage} />
          <Route path="/transactions" component={TransactionsPage} />
          <Route path="/categories" component={CategoriesPage} />
          <Route path="/budgets" component={BudgetsPage} />
          <Route path="/goals" component={GoalsPage} />
          <Route path="/reports" component={ReportsPage} />
          <Route path="/settings" component={SettingsPage} />
        </>
      ) : (
        <Route component={Login} />
      )}
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
