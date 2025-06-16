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

// Knowledgebase Pages
import KnowledgebasePage from "@/pages/KnowledgebasePage";
import ArticleDetailPage from "@/pages/ArticleDetailPage";

// DEBUGGING: Simplified Router to isolate KB page issue
function Router() {
  // const [location] = useLocation(); // Temporarily comment out if it causes issues even here
  // const isMobile = useIsMobile(); // Temporarily comment out

  // Directly return the Switch for KB pages
  return (
    <main className="h-full bg-background">
      <Switch>
        <Route path="/:articleSlug" component={ArticleDetailPage} />
        <Route path="/" component={KnowledgebasePage} />
        {/* Add other routes here if needed for basic testing, or a NotFound */}
        {/* For now, let's keep it minimal */}
         <ProtectedRoute path="/panel" component={Home} /> {/* Keep one panel route for comparison */}
         <Route component={NotFound} />
      </Switch>
    </main>
  );
}
// END DEBUGGING SECTION

function App() {
  const [location] = useLocation();
  const [isWelcomeModalOpen, setWelcomeModalOpen] = useState(false);
  useEffect(() => {
    const hasSeenModal = localStorage.getItem("hasSeenWelcomeModal");
    // Welcome modal should appear on the admin panel's home page
    const isOnPanelHomePage = location === '/panel';
    const isFromProvisioning = new URLSearchParams(window.location.search).get('fromProvisioning') === 'true';
    
    // Explicitly exclude certain pages from showing the welcome modal
    // Note: /auth is now /panel/auth for admin, but we might have a general /auth too.
    const excludedPages = ['/auth', '/panel/auth', '/appeals', '/provisioning-in-progress'];
    const isOnExcludedPage = excludedPages.some(page => location.startsWith(page));
    const isOnPlayerTicketPage = location.startsWith('/player-ticket/');
    const isOnAcceptInvitationPage = location.startsWith('/accept-invitation');
    
    // Hide welcome modal if not on the panel home page
    if (!isOnPanelHomePage) {
      setWelcomeModalOpen(false);
      return;
    }
    
    // Only show welcome modal on panel home page, not coming from provisioning, and not on excluded pages
    if (!hasSeenModal &&
        isOnPanelHomePage &&
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
