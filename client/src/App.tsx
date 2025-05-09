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
import PlayerTicket from "@/pages/player-ticket";
import Audit from "@/pages/audit";
import Settings from "@/pages/settings";
import AuthPage from "@/pages/auth-page";
import AppealsPage from "@/pages/appeals";
import ApiDocs from "@/pages/api-docs";

function Router() {
  const [location] = useLocation();
  const isAuthPage = location === '/auth';
  const isAppealsPage = location === '/appeals';
  const isPlayerTicketPage = location.startsWith('/player-ticket/');
  const isApiDocs = location === '/api-docs';

  // Don't show sidebar on auth page, appeals page, or player ticket page
  if (isAuthPage || isAppealsPage || isPlayerTicketPage || isApiDocs) {
    return (
      <main className="h-full">
        <Switch>
          <AuthRoute path="/auth" component={AuthPage} />
          <Route path="/appeals" component={AppealsPage} />
          <Route path="/player-ticket/:id" component={PlayerTicket} />
          <Route path="/api-docs" component={ApiDocs} />
        </Switch>
      </main>
    );
  }

  return (
    <div className="flex h-full overflow-hidden bg-background">
      <Sidebar />
      <main className="flex-1 ml-4 overflow-y-auto bg-background transition-all duration-300 ease-in-out scrollbar">
        <Switch>
          <ProtectedRoute path="/" component={Home} />
          <ProtectedRoute path="/lookup" component={Lookup} />
          <ProtectedRoute path="/tickets" component={Tickets} />
          <ProtectedRoute path="/tickets/:id" component={TicketDetail} />
          <ProtectedRoute path="/audit" component={Audit} />
          <ProtectedRoute path="/settings" component={Settings} />
          <AuthRoute path="/auth" component={AuthPage} />
          <Route path="/appeals" component={AppealsPage} />
          <Route path="/api-docs" component={ApiDocs} />
          <Route path="/player-ticket/:id" component={PlayerTicket} />
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
