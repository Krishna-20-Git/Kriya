import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { errorMessage } from '../lib/api';
import { usePatchTask } from '../lib/queries';
import type { Task } from '@pms/shared';

/**
 * Pull-to-refresh: refetches every active query the screen depends on. The spinner reflects only
 * the user's pull, not background refetches, so it never flickers on its own.
 */
export function usePullToRefresh(roots: string[]) {
  const client = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all(roots.map((root) => client.refetchQueries({ queryKey: [root], type: 'active' })));
    } finally {
      setRefreshing(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- roots is a static list per screen
  }, [client]);
  return { refreshing, onRefresh };
}

/** Mark completed / reopen, with a native alert if it fails (e.g. offline). */
export function useToggleComplete() {
  const patch = usePatchTask();
  const toggle = useCallback(
    (task: Task) => {
      patch.mutate(
        { id: task.id, input: { status: task.status === 'COMPLETED' ? 'PENDING' : 'COMPLETED' } },
        { onError: (error) => Alert.alert('Could not update task', errorMessage(error)) },
      );
    },
    [patch],
  );
  return { toggle, pendingId: patch.isPending ? patch.variables?.id : undefined };
}

export function useDebounced<T>(value: T, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}
