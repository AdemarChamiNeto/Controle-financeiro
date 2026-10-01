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
          <Route path="/" component={() => <FinanceDashboardLayout><Dashboard /></FinanceDashboardLayout>} />
          <Route path="/transactions" component={() => <FinanceDashboardLayout><Transactions /></FinanceDashboardLayout>} />
          <Route path="/categories" component={() => <FinanceDashboardLayout><Categories /></FinanceDashboardLayout>} />
          <Route path="/budgets" component={() => <FinanceDashboardLayout><Budgets /></FinanceDashboardLayout>} />
          <Route path="/goals" component={() => <FinanceDashboardLayout><Goals /></FinanceDashboardLayout>} />
          <Route path="/reports" component={() => <FinanceDashboardLayout><Reports /></FinanceDashboardLayout>} />
          <Route path="/settings" component={() => <FinanceDashboardLayout><Settings /></FinanceDashboardLayout>} />
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
