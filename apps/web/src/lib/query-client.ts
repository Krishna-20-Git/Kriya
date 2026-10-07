import { QueryClient } from '@tanstack/react-query';
import { ApiError } from './api';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 15_000,
      // Re-fetch when the tab regains focus: switching back from the phone shows its changes.
      refetchOnWindowFocus: true,
      retry: (failureCount, error) => {
        // Client errors (401/404/400) will not fix themselves; only retry network blips and 5xx.
        if (error instanceof ApiError && error.status >= 400 && error.status < 500) return false;
        return failureCount < 2;
      },
    },
    mutations: { retry: false },
  },
});
