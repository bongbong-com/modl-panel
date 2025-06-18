import { useQuery } from '@tanstack/react-query';

/**
 * Hook to fetch basic server settings from the public API
 * This is used for unprotected pages like homepage and auth page
 */
export function usePublicSettings() {
  return useQuery({
    queryKey: ['/api/public/settings'],
    queryFn: async () => {
      try {
        const res = await fetch('/api/public/settings');
        
        if (!res.ok) {
          throw new Error(`Failed to fetch public settings. Status: ${res.status}`);
        }
        
        const data = await res.json();
        return data;
      } catch (error) {
        // Return fallback values if the API fails
        return {
          serverDisplayName: 'modl',
          panelIconUrl: null
        };
      }
    },
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
    gcTime: 1000 * 60 * 10, // Keep in cache for 10 minutes
    refetchOnWindowFocus: false, // Don't refetch on window focus
    retry: 1, // Only retry once if it fails
  });
}
