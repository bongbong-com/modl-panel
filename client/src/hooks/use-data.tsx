import { useQuery, useMutation, useQueryClient, QueryClient } from '@tanstack/react-query';
import { queryClient } from '../lib/queryClient';
import { useAuth } from './use-auth';

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

export function useCancelSubscription() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/panel/billing/cancel-subscription', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(errorText || 'Failed to cancel subscription');
      }
      
      return res.json();
    },
    onSuccess: () => {
      // Invalidate billing status to refresh the UI
      queryClient.invalidateQueries({ queryKey: ['/api/panel/billing/status'] });
    },
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
        const errorText = await res.text();
        console.error('Punishment API error:', errorText);
        throw new Error(`Failed to apply punishment: ${res.status} ${res.statusText}`);
      }
      
      return res.json();
    },
    onSuccess: (data, variables) => {
      // Invalidate player data to refresh it
      queryClient.invalidateQueries({ queryKey: ['/api/panel/players', variables.uuid] });
      // Invalidate the entire player list to refresh it
      queryClient.invalidateQueries({ queryKey: ['/api/panel/players'] });
    },
    onError: (error) => {
      console.error('Error applying punishment:', error);
    }
  });
}

export function usePanelTicket(id: string) {
  return useQuery({
    queryKey: ['/api/panel/tickets', id],
    queryFn: async () => {
      console.log('=== usePanelTicket FETCH DEBUG ===');
      console.log('Fetching ticket ID:', id);
      console.log('Full URL:', `${window.location.origin}/api/panel/tickets/${id}`);
      
      const res = await fetch(`/api/panel/tickets/${id}`);
      
      console.log('Response status:', res.status);
      console.log('Response headers:', Object.fromEntries(res.headers.entries()));
      
      if (!res.ok) {
        console.log('Request failed with status:', res.status);
        const errorText = await res.text();
        console.log('Error response body:', errorText);
        
        if (res.status === 404) {
          return null;
        }
        throw new Error(`Failed to fetch ticket: ${res.status} ${errorText}`);
      }
      
      const data = await res.json();
      console.log('Successful response data:', data);
      console.log('================================');
      
      return data;
    },
    enabled: !!id,
    // Disable caching to always get fresh data
    staleTime: 0,
    gcTime: 0, // This is the v5 replacement for cacheTime
    refetchOnMount: true,
    refetchOnWindowFocus: true
  });
}

export function usePlayerTickets(uuid: string) {
  return useQuery({
    queryKey: ['/api/panel/tickets/creator', uuid],
    queryFn: async () => {
      const res = await fetch(`/api/panel/tickets/creator/${uuid}`);
      if (!res.ok) {
        if (res.status === 404) {
          return [];
        }
        throw new Error('Failed to fetch player tickets');
      }
      return res.json();
    },
    enabled: !!uuid,
    staleTime: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: true
  });
}

export function useModifyPunishment() {
  const { user } = useAuth();
  
  return useMutation({
    mutationFn: async ({ 
      uuid, 
      punishmentId, 
      modificationType, 
      reason, 
      newDuration 
    }: { 
      uuid: string, 
      punishmentId: string, 
      modificationType: string, 
      reason: string, 
      newDuration?: { value: number; unit: string } 
    }) => {
      const body: any = {
        type: modificationType,
        issuerName: user?.username || 'Unknown User',
        reason: reason
      };

      // Convert duration to milliseconds for MANUAL_DURATION_CHANGE
      if (modificationType === 'MANUAL_DURATION_CHANGE' && newDuration) {
        const multipliers = {
          'seconds': 1000,
          'minutes': 60 * 1000,
          'hours': 60 * 60 * 1000,
          'days': 24 * 60 * 60 * 1000,
          'weeks': 7 * 24 * 60 * 60 * 1000,
          'months': 30 * 24 * 60 * 60 * 1000
        };
        
        const durationMs = newDuration.value * (multipliers[newDuration.unit as keyof typeof multipliers] || 0);
        body.effectiveDuration = durationMs;
      }

      const res = await fetch(`/api/panel/players/${uuid}/punishments/${punishmentId}/modifications`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      });
      
      if (!res.ok) {
        const errorText = await res.text();
        console.error('Modify punishment API error:', errorText);
        throw new Error(`Failed to modify punishment: ${res.status} ${res.statusText}`);
      }
      
      return res.json();
    },
    onSuccess: (data, variables) => {
      // Invalidate player data to refresh it
      queryClient.invalidateQueries({ queryKey: ['/api/panel/players', variables.uuid] });
    },
    onError: (error) => {
      console.error('Error modifying punishment:', error);
    }
  });
}

export function useAddPunishmentNote() {
  const { user } = useAuth();
  
  return useMutation({
    mutationFn: async ({ 
      uuid, 
      punishmentId, 
      noteText 
    }: { 
      uuid: string, 
      punishmentId: string, 
      noteText: string 
    }) => {
      const res = await fetch(`/api/panel/players/${uuid}/punishments/${punishmentId}/notes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          text: noteText,
          issuerName: user?.username || 'Unknown User'
        })
      });
      
      if (!res.ok) {
        const errorText = await res.text();
        console.error('Add punishment note API error:', errorText);
        throw new Error(`Failed to add punishment note: ${res.status} ${res.statusText}`);
      }
      
      return res.json();
    },
    onSuccess: (data, variables) => {
      // Invalidate player data to refresh it
      queryClient.invalidateQueries({ queryKey: ['/api/panel/players', variables.uuid] });
    },
    onError: (error) => {
      console.error('Error adding punishment note:', error);
    }
  });
}