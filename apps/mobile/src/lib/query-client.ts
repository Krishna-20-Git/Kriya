import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { QueryClient, focusManager, onlineManager } from '@tanstack/react-query';
import { AppState, type AppStateStatus } from 'react-native';
import { ApiError } from './api';

/** TanStack Query learns about connectivity from NetInfo: queries pause offline and resume on reconnect. */
onlineManager.setEventListener((setOnline) =>
  NetInfo.addEventListener((state) => {
    setOnline(state.isConnected !== false && state.isInternetReachable !== false);
  }),
);

/** Returning to the app counts as "window focus", so stale lists refetch and show web changes. */
focusManager.setEventListener((handleFocus) => {
  const subscription = AppState.addEventListener('change', (status: AppStateStatus) => handleFocus(status === 'active'));
  return () => subscription.remove();
});

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 15_000,
      // Cached data stays usable for a week so tasks can be viewed offline.
      gcTime: 7 * 24 * 60 * 60 * 1000,
      retry: (failureCount, error) => {
        if (error instanceof ApiError && error.status >= 400 && error.status < 500) return false;
        return failureCount < 2;
      },
    },
    // Mutations fail immediately when offline (with a clear message) instead of silently queueing.
    mutations: { networkMode: 'always', retry: false },
  },
});

/**
 * Offline viewing: project and task data (not tokens — those are in SecureStore) is persisted to
 * AsyncStorage and restored on launch. The cache is wiped on logout.
 */
export const persister = createAsyncStoragePersister({ storage: AsyncStorage, key: 'pms.query-cache', throttleTime: 1000 });

export const PERSISTED_QUERY_ROOTS = new Set(['dashboard', 'projects', 'project', 'tasks', 'task']);

export async function clearCachedData() {
  queryClient.clear();
  await persister.removeClient();
}
