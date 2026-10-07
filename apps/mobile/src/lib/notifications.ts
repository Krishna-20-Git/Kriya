import AsyncStorage from '@react-native-async-storage/async-storage';
import { formatCalendarDate, todayLocal, type NotificationDevice, type Task } from '@pms/shared';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Notifications, pushSupported, type NotificationContentInput } from './expo-notifications';
import { Platform } from 'react-native';
import { apiData } from './api';

/**
 * Due-tomorrow reminders, delivered one of two ways:
 *
 * 1. **Push (preferred).** The phone registers its Expo push token and time zone with the API. An
 *    hourly server job sends the reminder at REMINDER_HOUR on the phone's own clock, so it
 *    arrives even if the app has not been opened that day, and reflects changes made on the web.
 * 2. **Local (fallback).** When a push token is not available — Expo Go on Android does not
 *    support remote push, and push needs an EAS project ID — the app schedules the same
 *    reminder on the phone itself from the tasks it fetched. It is refreshed whenever the app
 *    is opened or a task changes.
 */

/** Must match REMINDER_CHANNEL_ID in the API (notification.service.ts). */
export const CHANNEL_ID = 'due-reminders';
/** Same default as the API's REMINDER_HOUR. */
export const REMINDER_HOUR = 18;

const KEYS = {
  enabled: 'kriya-reminders-enabled',
  pushToken: 'kriya-push-token',
  localShownOn: 'kriya-local-reminder-shown-on',
} as const;
const LOCAL_ID = 'due-tomorrow-local';

// Show reminders as a banner even while the app is open.
Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
});

export const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
const projectId: string | undefined =
  (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId ?? Constants.easConfig?.projectId;

export type PermissionState = 'granted' | 'denied' | 'undetermined';
/** 'unavailable': this environment cannot show notifications at all (seen in some Expo Go versions). */
export type DeliveryMode = 'push' | 'local' | 'unavailable';

let channelReady = false;

/**
 * Creates the "Due-date reminders" channel. Best effort: Expo Go on Android rejects channel
 * creation, in which case notifications fall back to the app's default channel.
 */
export async function ensureChannel(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  try {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'Due-date reminders',
      description: 'The evening before a task is due',
      importance: Notifications.AndroidImportance.HIGH,
    });
    channelReady = true;
  } catch {
    channelReady = false;
  }
  return channelReady;
}

/** Only target our channel if it exists; otherwise Android would drop the notification. */
const channel = () => (channelReady ? { channelId: CHANNEL_ID } : {});

export const UNAVAILABLE_MESSAGE = 'Expo Go can’t show reminders on this phone. They work in the installed app (APK).';

export async function getPermission(): Promise<PermissionState> {
  const { status } = await Notifications.getPermissionsAsync();
  return status === 'granted' ? 'granted' : status === 'denied' ? 'denied' : 'undetermined';
}

/** Android 13+ shows the system prompt; older versions grant automatically. The channel must exist first. */
export async function requestPermission(): Promise<PermissionState> {
  await ensureChannel();
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted' ? 'granted' : 'denied';
}

/** null = reminders were never turned on or off on this phone (first run). */
export async function readEnabled(): Promise<boolean | null> {
  const value = await AsyncStorage.getItem(KEYS.enabled).catch(() => null);
  return value === null ? null : value === 'true';
}
export const saveEnabled = (enabled: boolean) => AsyncStorage.setItem(KEYS.enabled, String(enabled)).catch(() => undefined);

async function getPushToken(): Promise<string | null> {
  if (!pushSupported || !Notifications.getExpoPushTokenAsync) return null; // Expo Go on Android (SDK 53+) has no remote push.
  if (!projectId) return null; // Run `eas init` to give the app a project ID.
  try {
    return (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  } catch {
    return null; // e.g. no Firebase credentials configured for this build
  }
}

/** Registers this phone for server push. Returns the delivery mode that will actually be used. */
export async function registerForPush(): Promise<DeliveryMode> {
  await ensureChannel();
  const token = await getPushToken();
  if (!token) return 'local';
  try {
    await apiData<NotificationDevice>('/api/notifications/devices', {
      method: 'POST',
      body: { token, platform: Platform.OS === 'ios' ? 'ios' : 'android', timezone: Intl.DateTimeFormat().resolvedOptions().timeZone },
    });
    await AsyncStorage.setItem(KEYS.pushToken, token);
    await Notifications.cancelScheduledNotificationAsync(LOCAL_ID).catch(() => undefined); // push replaces the local copy
    return 'push';
  } catch {
    return 'local';
  }
}

/** Stops server push for this phone. Called when reminders are switched off and before signing out. */
export async function unregisterPush() {
  const token = await AsyncStorage.getItem(KEYS.pushToken).catch(() => null);
  if (!token) return;
  await apiData('/api/notifications/devices', { method: 'DELETE', body: { token } }).catch(() => undefined);
  await AsyncStorage.removeItem(KEYS.pushToken).catch(() => undefined);
}

/** Clears everything reminder-related on this phone (sign-out). The on/off preference is kept. */
export async function clearReminders() {
  await Notifications.cancelAllScheduledNotificationsAsync().catch(() => undefined);
  await AsyncStorage.multiRemove([KEYS.pushToken, KEYS.localShownOn]).catch(() => undefined);
}

export const tomorrowLocal = (now = new Date()) => todayLocal(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1));

function reminderContent(tasks: Pick<Task, 'id' | 'name'>[], date: string): NotificationContentInput {
  const [first] = tasks;
  const names = tasks.slice(0, 3).map((t) => t.name);
  const more = tasks.length > 3 ? ` and ${tasks.length - 3} more` : '';
  return {
    title: tasks.length === 1 ? 'Task due tomorrow' : `${tasks.length} tasks due tomorrow`,
    body: `${names.join(', ')}${more}`,
    data: { type: 'due-tomorrow', date, ...(tasks.length === 1 && first ? { taskId: first.id } : {}) },
    sound: 'default',
  };
}

/**
 * Local fallback: (re)schedules tonight's reminder from the open tasks due tomorrow.
 * Before REMINDER_HOUR it is scheduled for that hour; after it, it is shown once (at most once a day).
 */
export async function scheduleLocalReminder(openTasksDueTomorrow: Pick<Task, 'id' | 'name'>[], now = new Date()) {
  await Notifications.cancelScheduledNotificationAsync(LOCAL_ID).catch(() => undefined);
  if (openTasksDueTomorrow.length === 0) return;

  const today = todayLocal(now);
  const at = new Date(now.getFullYear(), now.getMonth(), now.getDate(), REMINDER_HOUR, 0, 0);
  const content = reminderContent(openTasksDueTomorrow, tomorrowLocal(now));

  if (at > now) {
    await Notifications.scheduleNotificationAsync({
      identifier: LOCAL_ID,
      content,
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: at, ...channel() },
    });
    return;
  }
  // Already past the reminder hour: show it now, unless today's reminder was already shown.
  if ((await AsyncStorage.getItem(KEYS.localShownOn).catch(() => null)) === today) return;
  await AsyncStorage.setItem(KEYS.localShownOn, today).catch(() => undefined);
  await Notifications.scheduleNotificationAsync({
    identifier: LOCAL_ID,
    content,
    trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 5, ...channel() },
  });
}

/** "Send test notification" in Settings. Push mode goes through the server; local mode schedules one here. */
export async function sendTestNotification(mode: DeliveryMode) {
  if (mode === 'unavailable') throw new Error(UNAVAILABLE_MESSAGE);
  if (mode === 'push') {
    const result = await apiData<{ devices: number; sent: number }>('/api/notifications/test', { method: 'POST' });
    if (result.sent > 0) return;
    // Fall through to a local test if the push service did not accept it.
  }
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Reminders are on',
      body: `You’ll get a notification at ${REMINDER_HOUR}:00 the evening before a task is due (e.g. ${formatCalendarDate(tomorrowLocal())}).`,
      data: { type: 'test' },
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 2, ...channel() },
  });
}
