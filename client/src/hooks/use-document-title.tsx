import { useEffect } from 'react';
import { useLocation } from 'wouter';
import { useSettings } from '@/hooks/use-data';

/**
 * Get the page name from the current route
 */
function getPageName(location: string): string {
  // Handle panel routes
  if (location.startsWith('/panel')) {
    if (location === '/panel') return 'Dashboard';
    if (location === '/panel/lookup') return 'Player Lookup';
    if (location === '/panel/tickets') return 'Tickets';
    if (location.startsWith('/panel/tickets/')) return 'Ticket Details';
    if (location === '/panel/audit') return 'Audit Log';
    if (location === '/panel/settings') return 'Settings';
    if (location === '/panel/api-docs') return 'API Documentation';
    if (location === '/panel/auth') return 'Staff Login';
    if (location.startsWith('/panel/player/')) return 'Player Details';
    return 'Panel';
  }
  
  // Handle public routes
  if (location === '/') return 'Support';
  if (location === '/knowledgebase') return 'Knowledge Base';
  if (location === '/appeals') return 'Appeals';
  if (location === '/auth') return 'Login';
  if (location.startsWith('/player-ticket/')) return 'Ticket';
  if (location === '/provisioning-in-progress') return 'Provisioning';
  if (location.startsWith('/accept-invitation')) return 'Accept Invitation';
  
  // Default fallback
  return 'Panel';
}

/**
 * Hook to manage document title and favicon based on server settings
 */
export function useDocumentTitle() {
  const { data: settingsData } = useSettings();
  const [location] = useLocation();

  useEffect(() => {
    const serverDisplayName = settingsData?.settings?.general?.serverDisplayName || '';
    const panelIconUrl = settingsData?.settings?.general?.panelIconUrl;
    const pageName = getPageName(location);

    // Update document title
    if (serverDisplayName) {
      document.title = `${pageName} - ${serverDisplayName}`;
    } else {
      document.title = `${pageName} - modl`;
    }

    // Update favicon if available
    if (panelIconUrl) {
      // Remove existing favicon links
      const existingFavicons = document.querySelectorAll('link[rel*="icon"]');
      existingFavicons.forEach(link => link.remove());

      // Add new favicon
      const link = document.createElement('link');
      link.rel = 'icon';
      link.type = 'image/x-icon';
      link.href = panelIconUrl;
      document.head.appendChild(link);

      // Also add apple-touch-icon for mobile
      const appleTouchIcon = document.createElement('link');
      appleTouchIcon.rel = 'apple-touch-icon';
      appleTouchIcon.href = panelIconUrl;
      document.head.appendChild(appleTouchIcon);
    }
  }, [settingsData, location]);

  return {
    serverDisplayName: settingsData?.settings?.general?.serverDisplayName || '',
    panelIconUrl: settingsData?.settings?.general?.panelIconUrl || ''
  };
}
