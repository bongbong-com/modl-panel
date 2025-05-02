import { useQuery, useMutation, QueryClient } from '@tanstack/react-query';
import { queryClient } from '../lib/queryClient';

// Player-related hooks
export function usePlayers() {
  return useQuery({
    queryKey: ['/api/players'],
    queryFn: async () => {
      const res = await fetch('/api/players');
      if (!res.ok) {
        throw new Error('Failed to fetch players');
      }
      return res.json();
    }
  });
}

export function usePlayer(uuid: string) {
  return useQuery({
    queryKey: ['/api/players', uuid],
    queryFn: async () => {
      console.log('Fetching data for player:', uuid);
      const res = await fetch(`/api/players/${uuid}`);
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
    queryKey: ['/api/tickets'],
    queryFn: async () => {
      const res = await fetch('/api/tickets');
      if (!res.ok) {
        throw new Error('Failed to fetch tickets');
      }
      return res.json();
    }
  });
}

export function useTicket(id: string) {
  return useQuery({
    queryKey: ['/api/tickets', id],
    queryFn: async () => {
      const res = await fetch(`/api/tickets/${id}`);
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
    cacheTime: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: true
  });
}

export function useCreateTicket() {
  return useMutation({
    mutationFn: async (ticketData: any) => {
      const res = await fetch('/api/tickets', {
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
      queryClient.invalidateQueries({ queryKey: ['/api/tickets'] });
    }
  });
}

export function useUpdateTicket() {
  return useMutation({
    mutationFn: async ({ id, data }: { id: string, data: any }) => {
      const res = await fetch(`/api/tickets/${id}`, {
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
      queryClient.invalidateQueries({ queryKey: ['/api/tickets', data._id] });
      // Invalidate the entire list to refresh it
      queryClient.invalidateQueries({ queryKey: ['/api/tickets'] });
    }
  });
}

// Appeal-related hooks
export function useAppeals() {
  return useQuery({
    queryKey: ['/api/appeals'],
    queryFn: async () => {
      const res = await fetch('/api/appeals');
      if (!res.ok) {
        throw new Error('Failed to fetch appeals');
      }
      return res.json();
    }
  });
}

export function useAppealsByPunishment(punishmentId: string) {
  return useQuery({
    queryKey: ['/api/appeals/punishment', punishmentId],
    queryFn: async () => {
      const res = await fetch(`/api/appeals/punishment/${punishmentId}`);
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
      const res = await fetch('/api/appeals', {
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
      queryClient.invalidateQueries({ queryKey: ['/api/appeals'] });
    }
  });
}

// Staff-related hooks
export function useStaff() {
  return useQuery({
    queryKey: ['/api/staff'],
    queryFn: async () => {
      const res = await fetch('/api/staff');
      if (!res.ok) {
        throw new Error('Failed to fetch staff');
      }
      return res.json();
    }
  });
}

// Log-related hooks
export function useLogs() {
  return useQuery({
    queryKey: ['/api/logs'],
    queryFn: async () => {
      const res = await fetch('/api/logs');
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
    queryKey: ['/api/settings'],
    queryFn: async () => {
      const res = await fetch('/api/settings');
      if (!res.ok) {
        throw new Error('Failed to fetch settings');
      }
      return res.json();
    }
  });
}

// System stats hooks
export function useStats() {
  return useQuery({
    queryKey: ['/api/stats'],
    queryFn: async () => {
      const res = await fetch('/api/stats');
      if (!res.ok) {
        throw new Error('Failed to fetch stats');
      }
      return res.json();
    }
  });
}