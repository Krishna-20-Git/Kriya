import type { RegisterDeviceInput } from '@pms/shared';
import { and, eq, inArray, isNull, ne, or, sql } from 'drizzle-orm';
import type { Executor } from '../db/client.js';
import { notificationDevices, projects, tasks } from '../db/schema.js';

export const notificationRepository = {
  /**
   * One row per push token. If the same phone signs in as a different user, the token moves to
   * that user (and its "already reminded today" marker resets), so nobody gets someone else's reminders.
   */
  upsertDevice: async (db: Executor, userId: string, input: RegisterDeviceInput) => {
    const [row] = await db
      .insert(notificationDevices)
      .values({ userId, token: input.token, platform: input.platform, timezone: input.timezone })
      .onConflictDoUpdate({
        target: notificationDevices.token,
        set: {
          userId,
          platform: input.platform,
          timezone: input.timezone,
          updatedAt: new Date(),
          lastReminderOn: sql`case when ${notificationDevices.userId} = ${userId} then ${notificationDevices.lastReminderOn} else null end`,
        },
      })
      .returning();
    if (!row) throw new Error('Device upsert returned no row');
    return row;
  },

  /** Only removes the token if it belongs to the caller. */
  deleteDevice: async (db: Executor, userId: string, token: string) => {
    const rows = await db
      .delete(notificationDevices)
      .where(and(eq(notificationDevices.userId, userId), eq(notificationDevices.token, token)))
      .returning({ id: notificationDevices.id });
    return rows.length;
  },

  deleteAllForUser: (db: Executor, userId: string) => db.delete(notificationDevices).where(eq(notificationDevices.userId, userId)),

  deleteByTokens: (db: Executor, tokens: string[]) =>
    tokens.length ? db.delete(notificationDevices).where(inArray(notificationDevices.token, tokens)) : Promise.resolve(),

  listForUser: (db: Executor, userId: string) =>
    db.select().from(notificationDevices).where(eq(notificationDevices.userId, userId)).orderBy(notificationDevices.createdAt),

  listAll: (db: Executor) => db.select().from(notificationDevices),

  /**
   * Atomically claims a device for today's reminder. Returns false if another run already claimed
   * it, so overlapping job runs (cron + in-process scheduler) can never send the reminder twice.
   */
  claimForDate: async (db: Executor, id: string, localDate: string) => {
    const rows = await db
      .update(notificationDevices)
      .set({ lastReminderOn: localDate })
      .where(
        and(
          eq(notificationDevices.id, id),
          or(isNull(notificationDevices.lastReminderOn), ne(notificationDevices.lastReminderOn, localDate)),
        ),
      )
      .returning({ id: notificationDevices.id });
    return rows.length === 1;
  },

  /** Undo a claim when sending failed for a transient reason, so the next run retries. */
  releaseClaim: (db: Executor, id: string, previous: string | null) =>
    db.update(notificationDevices).set({ lastReminderOn: previous }).where(eq(notificationDevices.id, id)),

  /** Open (not completed) tasks of one user due on a given date, most important first. */
  openTasksDueOn: (db: Executor, userId: string, date: string) =>
    db
      .select({ id: tasks.id, name: tasks.name, priority: tasks.priority })
      .from(tasks)
      .innerJoin(projects, eq(projects.id, tasks.projectId))
      .where(and(eq(projects.userId, userId), eq(tasks.dueDate, date), ne(tasks.status, 'COMPLETED')))
      .orderBy(sql`${tasks.priority} desc`, tasks.name),
};
