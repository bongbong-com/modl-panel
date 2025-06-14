import { useState, useEffect } from "react";
import { Switch, Route, useLocation } from "wouter";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Sidebar from "@/components/layout/Sidebar";
import MobileNavbar from "@/components/layout/MobileNavbar";
import { SidebarProvider } from "@/hooks/use-sidebar";
import { DashboardProvider } from "@/contexts/DashboardContext";
import { AuthProvider } from "@/hooks/use-auth";
import { ProtectedRoute, AuthRoute } from "@/lib/protected-route";
import { useIsMobile } from "@/hooks/use-mobile";
import Home from "@/pages/home";
import Lookup from "@/pages/lookup";
import LookupPage from "@/pages/lookup-page";
import PlayerDetailPage from "@/pages/player-detail-page";
import Tickets from "@/pages/tickets";
import TicketDetail from "@/pages/ticket-detail";
import PlayerTicket from "@/pages/player-ticket";
import Audit from "@/pages/audit";
import Settings from "@/pages/settings";
import AuthPage from "@/pages/auth-page";
import AppealsPage from "@/pages/appeals";
import ApiDocs from "@/pages/api-docs";
import ProvisioningInProgressPage from "@/pages/provisioning-in-progress";
import AcceptInvitationPage from "@/pages/AcceptInvitationPage";
import { WelcomeModal } from "@/components/layout/WelcomeModal";

function Router() {
  const [location] = useLocation();
  const isMobile = useIsMobile();
  
  const isAuthPage = location === '/auth';
  const isAppealsPage = location === '/appeals';
  const isPlayerTicketPage = location.startsWith('/player-ticket/');
  const isProvisioningPage = location === '/provisioning-in-progress';
  const isAcceptInvitationPage = location.startsWith('/accept-invitation');

  // Don't show navigation on auth page, appeals page, player ticket page, or provisioning page
  if (isAuthPage || isAppealsPage || isPlayerTicketPage || isProvisioningPage || isAcceptInvitationPage) {
    return (
      <main className="h-full">
        <Switch>
          <AuthRoute path="/auth" component={AuthPage} />
          <Route path="/appeals" component={AppealsPage} />
          <Route path="/player-ticket/:id" component={PlayerTicket} />
          <Route path="/provisioning-in-progress" component={ProvisioningInProgressPage} />
          <Route path="/accept-invitation" component={AcceptInvitationPage} />
        </Switch>
      </main>
    );
  }

  // Mobile version
  if (isMobile) {
    return (
      <div className="flex flex-col h-full bg-background">
        <main className="flex-1 overflow-y-auto bg-background transition-all duration-300 ease-in-out scrollbar pb-16">
          <Switch>
            <ProtectedRoute path="/" component={Home} />
            <ProtectedRoute path="/lookup" component={LookupPage} />
            <ProtectedRoute path="/player/:uuid" component={PlayerDetailPage} />
            <ProtectedRoute path="/tickets" component={Tickets} />
            <ProtectedRoute path="/tickets/:id" component={TicketDetail} />
            <ProtectedRoute path="/audit" component={Audit} />
            <ProtectedRoute path="/settings" component={Settings} />
            <ProtectedRoute path="/api-docs" component={ApiDocs} />
            <AuthRoute path="/auth" component={AuthPage} />
            <Route path="/appeals" component={AppealsPage} />
            <Route path="/player-ticket/:id" component={PlayerTicket} />
            <Route path="/provisioning-in-progress" component={ProvisioningInProgressPage} /> {/* Provisioning page route for mobile, though typically accessed without nav */}
            <Route component={NotFound} />
          </Switch>
        </main>
        <MobileNavbar />
      </div>
    );
  }

  // Desktop version
  return (
    <div className="flex h-full overflow-hidden bg-background">
      <Sidebar />
      <main className="flex-1 pl-24 overflow-y-auto bg-background transition-all duration-300 ease-in-out scrollbar">
        <Switch>
          <ProtectedRoute path="/" component={Home} />
          <ProtectedRoute path="/lookup" component={Lookup} />
          <ProtectedRoute path="/tickets" component={Tickets} />
          <ProtectedRoute path="/tickets/:id" component={TicketDetail} />
          <ProtectedRoute path="/audit" component={Audit} />
          <ProtectedRoute path="/settings" component={Settings} />
          <ProtectedRoute path="/api-docs" component={ApiDocs} />
          <AuthRoute path="/auth" component={AuthPage} />
          <Route path="/appeals" component={AppealsPage} />
          <Route path="/player-ticket/:id" component={PlayerTicket} />
          <Route path="/provisioning-in-progress" component={ProvisioningInProgressPage} /> {/* Provisioning page route for desktop, though typically accessed without nav */}
          <Route component={NotFound} />
        </Switch>
      </main>
    </div>
  );
}

function App() {
  const [location] = useLocation();
  const [isWelcomeModalOpen, setWelcomeModalOpen] = useState(false);  useEffect(() => {
    const hasSeenModal = localStorage.getItem("hasSeenWelcomeModal");
    const isOnHomePage = location === '/';
    const isFromProvisioning = new URLSearchParams(window.location.search).get('fromProvisioning') === 'true';
    
    // Explicitly exclude certain pages from showing the welcome modal
    const excludedPages = ['/auth', '/appeals', '/provisioning-in-progress'];
    const isOnExcludedPage = excludedPages.some(page => location.startsWith(page));
    const isOnPlayerTicketPage = location.startsWith('/player-ticket/');
    const isOnAcceptInvitationPage = location.startsWith('/accept-invitation');
    
    // Hide welcome modal if not on home page
    if (!isOnHomePage) {
      setWelcomeModalOpen(false);
      return;
    }
    
    // Only show welcome modal on home page, not coming from provisioning, and not on excluded pages
    if (!hasSeenModal && 
        isOnHomePage && 
        !isFromProvisioning && 
        !isOnExcludedPage && 
        !isOnPlayerTicketPage && 
        !isOnAcceptInvitationPage) {
      setWelcomeModalOpen(true);
    }
  }, [location]);

  const handleCloseWelcomeModal = () => {
    localStorage.setItem("hasSeenWelcomeModal", "true");
    setWelcomeModalOpen(false);
  };

  return (
    <AuthProvider>
      <SidebarProvider>
        <DashboardProvider>
          <TooltipProvider>
            <Toaster />
            <WelcomeModal isOpen={isWelcomeModalOpen} onClose={handleCloseWelcomeModal} />
            <Router />
          </TooltipProvider>
        </DashboardProvider>
      </SidebarProvider>
    </AuthProvider>
  );
}

export default App;
