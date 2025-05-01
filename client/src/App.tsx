import { Switch, Route, useLocation } from "wouter";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Sidebar from "@/components/layout/Sidebar";
import { SidebarProvider } from "@/hooks/use-sidebar";
import { DashboardProvider } from "@/contexts/DashboardContext";
import { AuthProvider } from "@/hooks/use-auth";
import { ProtectedRoute, AuthRoute } from "@/lib/protected-route";
import Home from "@/pages/home";
import Lookup from "@/pages/lookup";
import Tickets from "@/pages/tickets";
import TicketDetail from "@/pages/ticket-detail";
import Audit from "@/pages/audit";
import Settings from "@/pages/settings";
import AuthPage from "@/pages/auth-page";

function Router() {
  const [location] = useLocation();
  const isAuthPage = location === '/auth';

  // Don't show sidebar on auth page
  if (isAuthPage) {
    return (
      <main className="h-full">
        <Switch>
          <Route path="/auth" component={AuthPage} />
        </Switch>
      </main>
    );
  }

  return (
    <div className="flex h-full overflow-hidden bg-background">
      <Sidebar />
      <main className="flex-1 overflow-y-auto bg-background transition-all duration-300 ease-in-out scrollbar">
        <Switch>
          <Route path="/" component={Home} />
          <Route path="/lookup" component={Lookup} />
          <Route path="/tickets" component={Tickets} />
          <Route path="/tickets/:id" component={TicketDetail} />
          <Route path="/audit" component={Audit} />
          <Route path="/settings" component={Settings} />
          <Route path="/auth" component={AuthPage} />
          <Route component={NotFound} />
        </Switch>
      </main>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <SidebarProvider>
        <DashboardProvider>
          <TooltipProvider>
            <Toaster />
            <Router />
          </TooltipProvider>
        </DashboardProvider>
      </SidebarProvider>
    </AuthProvider>
  );
}

export default App;
