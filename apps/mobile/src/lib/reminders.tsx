import type { Task } from '@pms/shared';
import { useQuery } from '@tanstack/react-query';

import { useRouter } from 'expo-router';
import { createContext, use, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AppState, Platform } from 'react-native';
import { apiPage } from './api';
import { Notifications, type NotificationResponse } from './expo-notifications';
import {
  clearReminders,
  ensureChannel,
  getPermission,
  readEnabled,
  registerForPush,
  requestPermission,
  saveEnabled,
  scheduleLocalReminder,
  sendTestNotification,
  tomorrowLocal,
  unregisterPush,
  type DeliveryMode,
  type PermissionState,
  UNAVAILABLE_MESSAGE,
} from './notifications';

interface RemindersContextValue {
  /** null while loading. */
  enabled: boolean | null;
  permission: PermissionState;
  /** How reminders reach this phone; null when off or not yet decided. */
  mode: DeliveryMode | null;
  /** Returns false if the user (or Android) blocked notifications. */
  setEnabled: (enabled: boolean) => Promise<boolean>;
  sendTest: () => Promise<void>;
}

const RemindersContext = createContext<RemindersContextValue | null>(null);

/** Mounted inside the signed-in area only. */
export function RemindersProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [enabled, setEnabledState] = useState<boolean | null>(null);
  const [permission, setPermission] = useState<PermissionState>('undetermined');
  const [mode, setMode] = useState<DeliveryMode | null>(null);
  const [tomorrow, setTomorrow] = useState(tomorrowLocal);

  // First signed-in launch on this phone: ask for permission once and turn reminders on if allowed.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        await ensureChannel();
        let on = await readEnabled();
        let perm = await getPermission();
        if (on === null) {
          perm = perm === 'granted' ? perm : await requestPermission();
          on = perm === 'granted';
          await saveEnabled(on);
        }
        if (!cancelled) {
          setPermission(perm);
          setEnabledState(on);
        }
      } catch {
        // Notifications unavailable on this device/platform: reminders simply stay off.
        if (!cancelled) setEnabledState(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Coming back to the app: the date may have changed, and notifications may have been allowed in Android settings.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      setTomorrow(tomorrowLocal());
      void getPermission()
        .then(setPermission)
        .catch(() => undefined);
    });
    return () => sub.remove();
  }, []);

  // Choose push or local delivery whenever reminders are (re)activated.
  useEffect(() => {
    if (!enabled || permission !== 'granted') {
      setMode((current) => (current === 'unavailable' ? current : null));
      return;
    }
    let cancelled = false;
    void registerForPush()
      .catch((): DeliveryMode => 'local')
      .then((m) => {
        if (!cancelled) setMode(m);
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, permission]);

  // Local fallback: keep tonight's reminder in sync with the tasks due tomorrow. The key sits under
  // ['tasks'], so any task change (here or after a pull-to-refresh) refetches it automatically.
  const dueTomorrow = useQuery({
    queryKey: ['tasks', { dueOn: tomorrow, purpose: 'reminder' }],
    queryFn: () => apiPage<Task>('/api/tasks', { query: { dueOn: tomorrow, limit: 100, sortBy: 'priority', sortOrder: 'desc' } }),
    enabled: mode === 'local',
    select: (page) => page.items.filter((task) => task.status !== 'COMPLETED'),
  });
  useEffect(() => {
    if (mode === 'local' && dueTomorrow.data) {
      // If even a local notification cannot be scheduled, say so instead of failing silently.
      void scheduleLocalReminder(dueTomorrow.data).catch(() => setMode('unavailable'));
    }
  }, [mode, dueTomorrow.data]);

  // Tapping a reminder: one task opens that task; several open the task list. Covers both a tap
  // while the app is running and a tap that launched it. (Not available on web.)
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const open = (response: NotificationResponse) => {
      if (response.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;
      void Notifications.clearLastNotificationResponseAsync().catch(() => undefined); // handle each tap once
      const data = response.notification.request.content.data as { type?: string; taskId?: string } | undefined;
      if (data?.type !== 'due-tomorrow') return;
      if (data.taskId) router.push(`/tasks/${data.taskId}`);
      else router.push('/tasks');
    };
    void Notifications.getLastNotificationResponseAsync()
      .then((response) => response && open(response))
      .catch(() => undefined);
    const subscription = Notifications.addNotificationResponseReceivedListener(open);
    return () => subscription.remove();
  }, [router]);

  const setEnabled = useCallback(
    async (next: boolean) => {
      try {
        if (next) {
          const perm = permission === 'granted' ? permission : await requestPermission();
          setPermission(perm);
          if (perm !== 'granted') return false;
        } else {
          await unregisterPush();
          await clearReminders();
        }
        await saveEnabled(next);
        setEnabledState(next);
        return true;
      } catch {
        // The notification system itself failed (not a user refusal): keep reminders off, show why.
        setEnabledState(false);
        setMode('unavailable');
        return true;
      }
    },
    [permission],
  );

  const sendTest = useCallback(async () => {
    try {
      await sendTestNotification(mode ?? 'local');
    } catch (error) {
      if (mode !== 'push') {
        // A local notification could not be scheduled: this environment cannot show reminders.
        setMode('unavailable');
        throw new Error(UNAVAILABLE_MESSAGE);
      }
      throw error;
    }
  }, [mode]);

  const value = useMemo(() => ({ enabled, permission, mode, setEnabled, sendTest }), [enabled, permission, mode, setEnabled, sendTest]);
  return <RemindersContext value={value}>{children}</RemindersContext>;
}

export function useReminders() {
  const context = use(RemindersContext);
  if (!context) throw new Error('useReminders must be used inside <RemindersProvider>');
  return context;
}
