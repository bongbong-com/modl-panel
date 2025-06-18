import { useEffect } from 'react';
import { useSettings } from '@/hooks/use-data';

/**
 * Hook to manage document title and favicon based on server settings
 */
export function useDocumentTitle() {
  const { data: settingsData } = useSettings();

  useEffect(() => {
    const serverDisplayName = settingsData?.settings?.general?.serverDisplayName || '';
    const panelIconUrl = settingsData?.settings?.general?.panelIconUrl;

    // Update document title
    if (serverDisplayName) {
      document.title = `${serverDisplayName} - Panel`;
    } else {
      document.title = 'modl - Panel';
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
  }, [settingsData]);

  return {
    serverDisplayName: settingsData?.settings?.general?.serverDisplayName || '',
    panelIconUrl: settingsData?.settings?.general?.panelIconUrl || ''
  };
}
