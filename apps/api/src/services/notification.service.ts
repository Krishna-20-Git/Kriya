import type { NotificationDevice, RegisterDeviceInput } from '@pms/shared';
import { env } from '../config/env.js';
import { db } from '../db/client.js';
import type { NotificationDeviceRow } from '../db/schema.js';
import { notificationRepository } from '../repositories/notification.repository.js';
import { sendExpoPush, type PushMessage, type PushSender } from '../utils/expo-push.js';
import { logger } from '../utils/logger.js';

/** Must match the channel id created by the Android app (src/lib/notifications.ts). */
export const REMINDER_CHANNEL_ID = 'due-reminders';

/** The phone's local calendar date and hour, computed in its own time zone. */
export function localClock(now: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return { date: `${get('year')}-${get('month')}-${get('day')}`, hour: Number(get('hour')) };
}

export const addDays = (date: string, days: number) => {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y!, m! - 1, d! + days)).toISOString().slice(0, 10);
};

export function buildReminder(tasks: { id: string; name: string }[], date: string): Omit<PushMessage, 'to'> {
  const [first] = tasks;
  const title = tasks.length === 1 ? 'Task due tomorrow' : `${tasks.length} tasks due tomorrow`;
  const names = tasks.slice(0, 3).map((t) => t.name);
  const more = tasks.length > 3 ? ` and ${tasks.length - 3} more` : '';
  return {
    title,
    body: `${names.join(', ')}${more}`,
    // A single task opens that task; several open the task list.
    data: { type: 'due-tomorrow', date, ...(tasks.length === 1 && first ? { taskId: first.id } : {}) },
    channelId: REMINDER_CHANNEL_ID,
    sound: 'default',
  };
}

const toDevice = (row: NotificationDeviceRow): NotificationDevice => ({
  token: row.token,
  platform: row.platform as NotificationDevice['platform'],
  timezone: row.timezone,
  createdAt: row.createdAt.toISOString(),
});

export interface ReminderRunSummary {
  devices: number;
  due: number;
  sent: number;
  noTasks: number;
  failed: number;
  removedTokens: number;
}

export const notificationService = {
  async registerDevice(userId: string, input: RegisterDeviceInput) {
    return toDevice(await notificationRepository.upsertDevice(db, userId, input));
  },

  async unregisterDevice(userId: string, token: string) {
    await notificationRepository.deleteDevice(db, userId, token);
  },

  async listDevices(userId: string) {
    return (await notificationRepository.listForUser(db, userId)).map(toDevice);
  },

  /** "Send test notification" in the app: proves the whole push path works end to end. */
  async sendTest(userId: string, send: PushSender = sendExpoPush) {
    const devices = await notificationRepository.listForUser(db, userId);
    const results = await send(
      devices.map((d) => ({
        to: d.token,
        title: 'Reminders are on',
        body: 'You’ll get a notification the evening before a task is due.',
        data: { type: 'test' },
        channelId: REMINDER_CHANNEL_ID,
        sound: 'default',
      })),
    );
    await notificationRepository.deleteByTokens(db, results.filter((r) => !r.ok && r.permanent).map((r) => r.token));
    return { devices: devices.length, sent: results.filter((r) => r.ok).length };
  },

  /**
   * The "due tomorrow" job. Safe to run as often as you like (hourly cron, every 15 minutes
   * in-process, or both): each device is claimed for its local date before sending, so it gets
   * at most one reminder per day, sent at or after REMINDER_HOUR on the phone's own clock.
   */
  async runDueTomorrowReminders(now = new Date(), send: PushSender = sendExpoPush): Promise<ReminderRunSummary> {
    const summary: ReminderRunSummary = { devices: 0, due: 0, sent: 0, noTasks: 0, failed: 0, removedTokens: 0 };
    const devices = await notificationRepository.listAll(db);
    summary.devices = devices.length;

    const outgoing: { device: NotificationDeviceRow; message: PushMessage }[] = [];
    const taskCache = new Map<string, { id: string; name: string }[]>();

    for (const device of devices) {
      const clock = localClock(now, device.timezone);
      if (clock.hour < env.REMINDER_HOUR || device.lastReminderOn === clock.date) continue;
      if (!(await notificationRepository.claimForDate(db, device.id, clock.date))) continue;
      summary.due += 1;

      const tomorrow = addDays(clock.date, 1);
      const key = `${device.userId}:${tomorrow}`;
      let due = taskCache.get(key);
      if (!due) {
        due = await notificationRepository.openTasksDueOn(db, device.userId, tomorrow);
        taskCache.set(key, due);
      }
      if (due.length === 0) {
        summary.noTasks += 1; // Claimed anyway: nothing to say today, and no need to re-check every run.
        continue;
      }
      outgoing.push({ device, message: { to: device.token, ...buildReminder(due, tomorrow) } });
    }

    if (outgoing.length) {
      const results = await send(outgoing.map((o) => o.message));
      const byToken = new Map(results.map((r) => [r.token, r]));
      const remove: string[] = [];
      for (const { device } of outgoing) {
        const result = byToken.get(device.token);
        if (result?.ok) summary.sent += 1;
        else {
          summary.failed += 1;
          if (result && result.permanent) remove.push(device.token);
          else await notificationRepository.releaseClaim(db, device.id, device.lastReminderOn);
        }
      }
      await notificationRepository.deleteByTokens(db, remove);
      summary.removedTokens = remove.length;
    }

    logger.info({ reminders: summary }, 'Due-tomorrow reminder run finished');
    return summary;
  },
};

/** Optional in-process scheduler (REMINDER_SCHEDULER=true). Overlap with an external cron is harmless. */
export function startReminderScheduler(intervalMs = 15 * 60 * 1000) {
  const run = () => notificationService.runDueTomorrowReminders().catch((err: unknown) => logger.error({ err }, 'Reminder run failed'));
  const timer = setInterval(run, intervalMs);
  timer.unref();
  void run();
  logger.info({ everyMinutes: intervalMs / 60_000, hour: env.REMINDER_HOUR }, 'Reminder scheduler started');
  return () => clearInterval(timer);
}
