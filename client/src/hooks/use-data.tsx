import { useQuery, useMutation, QueryClient } from '@tanstack/react-query';
import { queryClient } from '../lib/queryClient';

// Player-related hooks
export function usePlayers() {
  return useQuery({
    queryKey: ['/api/panel/players'],
    queryFn: async () => {
      const res = await fetch('/api/panel/players');
      if (!res.ok) {
        throw new Error('Failed to fetch players');
      }
      return res.json();
    }
  });
}

export function usePlayer(uuid: string) {
  return useQuery({
    queryKey: ['/api/panel/players', uuid],
    queryFn: async () => {
      const res = await fetch(`/api/panel/players/${uuid}`);
      if (!res.ok) {
        // If 404, return null - this is not an error, just no player found
        if (res.status === 404) {
          return null;
        }
        throw new Error('Failed to fetch player');
      }
      return res.json();
    },
    enabled: !!uuid, // Only run the query if we have a uuid
    // Don't cache this data for long, so new opens can see the latest data
    staleTime: 1000, // 1 second
    refetchOnWindowFocus: true, // Refetch when window gets focus
    refetchOnMount: true // Refetch when component mounts
  });
}

// Ticket-related hooks
export function useTickets() {
  return useQuery({
    queryKey: ['/api/panel/tickets'],
    queryFn: async () => {
      const res = await fetch('/api/panel/tickets');
      if (!res.ok) {
        throw new Error('Failed to fetch tickets');
      }
      return res.json();
    },
    // Disabled cache to ensure we always get fresh data
    staleTime: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: true
  });
}

export function useTicket(id: string) {
  return useQuery({
    queryKey: ['/api/public/tickets', id],
    queryFn: async () => {
      const res = await fetch(`/api/public/tickets/${id}`);
      if (!res.ok) {
        if (res.status === 404) {
          return null;
        }
        throw new Error('Failed to fetch ticket');
      }
      return res.json();
    },
    enabled: !!id,
    // Disable caching to always get fresh data
    staleTime: 0,
    gcTime: 0, // This is the v5 replacement for cacheTime
    refetchOnMount: true,
    refetchOnWindowFocus: true
  });
}

export function useCreateTicket() {
  return useMutation({
    mutationFn: async (ticketData: any) => {
      const res = await fetch('/api/panel/tickets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(ticketData)
      });
      
      if (!res.ok) {
        throw new Error('Failed to create ticket');
      }
      
      return res.json();
    },
    onSuccess: () => {
      // Invalidate tickets query to refresh the list
      queryClient.invalidateQueries({ queryKey: ['/api/panel/tickets'] });
    }
  });
}

export function useUpdateTicket() {
  return useMutation({
    mutationFn: async ({ id, data }: { id: string, data: any }) => {
      const res = await fetch(`/api/panel/tickets/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      });
      
      if (!res.ok) {
        throw new Error('Failed to update ticket');
      }
      
      return res.json();
    },
    onSuccess: (data) => {
      // Update the specific ticket in the cache
      queryClient.invalidateQueries({ queryKey: ['/api/panel/tickets', data._id] });
      // Invalidate the entire list to refresh it
      queryClient.invalidateQueries({ queryKey: ['/api/panel/tickets'] });
    }
  });
}

// Public ticket hooks for player ticket page
export function useAddTicketReply() {
  return useMutation({
    mutationFn: async ({ id, reply }: { id: string, reply: any }) => {
      const res = await fetch(`/api/public/tickets/${id}/replies`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(reply)
      });
      
      if (!res.ok) {
        throw new Error('Failed to add reply');
      }
      
      return res.json();
    },
    onSuccess: (data, variables) => {
      // Update the specific ticket in the cache
      queryClient.invalidateQueries({ queryKey: ['/api/public/tickets', variables.id] });
    }
  });
}

export function useSubmitTicketForm() {
  return useMutation({
    mutationFn: async ({ id, formData }: { id: string, formData: any }) => {
      const res = await fetch(`/api/public/tickets/${id}/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });
      
      if (!res.ok) {
        throw new Error('Failed to submit ticket form');
      }
      
      return res.json();
    },
    onSuccess: (data, variables) => {
      // Update the specific ticket in the cache
      queryClient.invalidateQueries({ queryKey: ['/api/public/tickets', variables.id] });
    }
  });
}

// Appeal-related hooks
export function useAppeals() {
  return useQuery({
    queryKey: ['/api/panel/appeals'],
    queryFn: async () => {
      const res = await fetch('/api/panel/appeals');
      if (!res.ok) {
        throw new Error('Failed to fetch appeals');
      }
      return res.json();
    }
  });
}

export function useAppealsByPunishment(punishmentId: string) {
  return useQuery({
    queryKey: ['/api/panel/appeals/punishment', punishmentId],
    queryFn: async () => {
      const res = await fetch(`/api/panel/appeals/punishment/${punishmentId}`);
      if (!res.ok) {
        if (res.status === 404) {
          return [];
        }
        throw new Error('Failed to fetch appeals');
      }
      return res.json();
    },
    enabled: !!punishmentId
  });
}

export function useCreateAppeal() {
  return useMutation({
    mutationFn: async (appealData: any) => {
      const res = await fetch('/api/panel/appeals', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(appealData)
      });
      
      if (!res.ok) {
        throw new Error('Failed to create appeal');
      }
      
      return res.json();
    },
    onSuccess: () => {
      // Invalidate appeals query to refresh the list
      queryClient.invalidateQueries({ queryKey: ['/api/panel/appeals'] });
    }
  });
}

// Staff-related hooks
export function useStaff() {
  return useQuery({
    queryKey: ['/api/panel/staff'],
    queryFn: async () => {
      const res = await fetch('/api/panel/staff');
      if (!res.ok) {
        throw new Error('Failed to fetch staff');
      }
      return res.json();
    },
    staleTime: 1000 * 60, // 1 minute
  });
}

// Log-related hooks
export function useLogs() {
  return useQuery({
    queryKey: ['/api/panel/logs'],
    queryFn: async () => {
      const res = await fetch('/api/panel/logs');
      if (!res.ok) {
        throw new Error('Failed to fetch logs');
      }
      return res.json();
    }
  });
}

// Settings-related hooks
export function useSettings() {
  return useQuery({
    queryKey: ['/api/panel/settings'],
    queryFn: async () => {
      try {
        // First try the authenticated endpoint
        const res = await fetch('/api/panel/settings');

        if (res.ok) {
          const responseText = await res.text();
          const data = JSON.parse(responseText);
          return data;
        }

        // If we get a 401 (unauthorized), try the public endpoint
        if (res.status === 401) {
          const publicRes = await fetch('/api/public/settings');
          
          if (publicRes.ok) {
            const publicData = await publicRes.json();
            // Transform public data to match expected format
            return {
              settings: {
                general: {
                  serverDisplayName: publicData.serverDisplayName,
                  panelIconUrl: publicData.panelIconUrl
                }
              }
            };
          }
        }

        // If both endpoints fail, throw an error
        const errorText = await res.text().catch(() => 'Could not read error response text');
        throw new Error(`Failed to fetch settings. Status: ${res.status}. Response: ${errorText}`);
      } catch (error) {
        throw error; // Re-throw to let React Query handle it
      }
    },
    // Modified options to improve behavior when returning to settings page
    staleTime: 0, // Consider data stale immediately - this ensures refetch when returning to the page
    refetchOnMount: 'always', // Always refetch when component mounts (returning to page)
    refetchOnWindowFocus: false, // Don't refetch on window focus to avoid overriding user edits
    gcTime: 1000 * 60 * 5, // Keep data in cache for 5 minutes
    refetchInterval: false, // Disable periodic refetching
    refetchOnReconnect: false // Disable refetch on reconnect
  });
}

// System stats hooks
export function useStats() {
  return useQuery({
    queryKey: ['/api/panel/stats'],
    queryFn: async () => {
      const res = await fetch('/api/panel/stats');
      if (!res.ok) {
        throw new Error('Failed to fetch stats');
      }
      return res.json();
    }
  });
}

// Type for client-side activity items, matching what home.tsx expects
// This should align with the Activity interface in home.tsx
interface ClientActivityAction {
  label: string;
  link?: string;
  primary?: boolean;
}

export interface ClientActivity {
  id: string | number;
  type: string; // e.g., 'new_ticket', 'new_punishment', 'mod_action' - client will map to icons
  color: string;
  title: string;
  time: string; // Formatted date string
  description: string;
  actions: ClientActivityAction[];
}


// Recent Activity Hook
export function useRecentActivity(limit: number = 20, days: number = 7) {
  return useQuery<ClientActivity[]>({
    queryKey: ['/api/panel/activity/recent', limit, days],
    queryFn: async () => {
      const res = await fetch(`/api/panel/activity/recent?limit=${limit}&days=${days}`);
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ message: 'Failed to fetch recent activity and could not parse error response.' }));
        throw new Error(errorData.message || 'Failed to fetch recent activity');
      }
      return res.json();
    },
    staleTime: 1000 * 60 * 1, // 1 minute stale time
    refetchOnWindowFocus: true,
    refetchOnMount: true,
  });
}

// Billing-related hooks
export function useBillingStatus() {
  return useQuery({
    queryKey: ['/api/panel/billing/status'],
    queryFn: async () => {
      const res = await fetch('/api/panel/billing/status');
      if (!res.ok) {
        throw new Error('Failed to fetch billing status');
      }
      return res.json();
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

// Punishment hooks
export function useApplyPunishment() {
  return useMutation({
    mutationFn: async ({ uuid, punishmentData }: { uuid: string, punishmentData: any }) => {
      const res = await fetch(`/api/panel/players/${uuid}/punishments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(punishmentData)
      });
      
      if (!res.ok) {
        throw new Error('Failed to apply punishment');
      }
      
      return res.json();
    },
    onSuccess: (data) => {
      // Invalidate player data to refresh it
      queryClient.invalidateQueries({ queryKey: ['/api/panel/players', data._id] });
      // Invalidate the entire player list to refresh it
      queryClient.invalidateQueries({ queryKey: ['/api/panel/players'] });
    }
  });
}