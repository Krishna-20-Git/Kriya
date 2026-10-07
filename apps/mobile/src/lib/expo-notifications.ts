/* eslint-disable @typescript-eslint/no-require-imports -- conditional loading is the point of this file */
import { isRunningInExpoGo } from 'expo';
import type * as ExpoNotifications from 'expo-notifications';
import { Platform } from 'react-native';

/**
 * Expo Go on Android (SDK 53+) cannot receive remote push, and importing the `expo-notifications`
 * package root there throws immediately (its push-token auto-registration runs on import).
 * Local notifications still work, so in Expo Go on Android we load only the local-notification
 * modules; in a real build (the APK) we load the full package, including push.
 *
 * Type-only imports above are erased at build time, so they do not trigger the package root.
 */
export const pushSupported = !(Platform.OS === 'android' && isRunningInExpoGo());

type Local = Pick<
  typeof ExpoNotifications,
  | 'setNotificationHandler'
  | 'setNotificationChannelAsync'
  | 'getPermissionsAsync'
  | 'requestPermissionsAsync'
  | 'scheduleNotificationAsync'
  | 'cancelScheduledNotificationAsync'
  | 'cancelAllScheduledNotificationsAsync'
  | 'addNotificationResponseReceivedListener'
  | 'getLastNotificationResponseAsync'
  | 'clearLastNotificationResponseAsync'
  | 'DEFAULT_ACTION_IDENTIFIER'
  | 'AndroidImportance'
  | 'SchedulableTriggerInputTypes'
>;

type Full = Local & Pick<typeof ExpoNotifications, 'getExpoPushTokenAsync'>;

function loadLocalOnly(): Local {
  return {
    ...(require('expo-notifications/build/NotificationsHandler') as Pick<Local, 'setNotificationHandler'>),
    ...(require('expo-notifications/build/setNotificationChannelAsync') as Pick<Local, 'setNotificationChannelAsync'>),
    ...(require('expo-notifications/build/NotificationPermissions') as Pick<Local, 'getPermissionsAsync' | 'requestPermissionsAsync'>),
    ...(require('expo-notifications/build/scheduleNotificationAsync') as Pick<Local, 'scheduleNotificationAsync'>),
    ...(require('expo-notifications/build/cancelScheduledNotificationAsync') as Pick<Local, 'cancelScheduledNotificationAsync'>),
    ...(require('expo-notifications/build/cancelAllScheduledNotificationsAsync') as Pick<Local, 'cancelAllScheduledNotificationsAsync'>),
    ...(require('expo-notifications/build/NotificationsEmitter') as Pick<
      Local,
      'addNotificationResponseReceivedListener' | 'getLastNotificationResponseAsync' | 'clearLastNotificationResponseAsync' | 'DEFAULT_ACTION_IDENTIFIER'
    >),
    ...(require('expo-notifications/build/NotificationChannelManager.types') as Pick<Local, 'AndroidImportance'>),
    ...(require('expo-notifications/build/Notifications.types') as Pick<Local, 'SchedulableTriggerInputTypes'>),
  };
}

export const Notifications: Local & Partial<Full> = pushSupported ? (require('expo-notifications') as Full) : loadLocalOnly();

export type { NotificationContentInput, NotificationResponse } from 'expo-notifications';
