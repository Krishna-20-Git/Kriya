import { AUDIT_ACTIONS, PROJECT_STATUSES, TASK_PRIORITIES, TASK_STATUSES, USER_ROLES } from '@pms/shared';
import { sql } from 'drizzle-orm';
import {
  check,
  date,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

export const projectStatusEnum = pgEnum('project_status', PROJECT_STATUSES);
export const taskStatusEnum = pgEnum('task_status', TASK_STATUSES);
/** Declared LOW → HIGH, so ORDER BY priority sorts by importance, not alphabetically. */
export const taskPriorityEnum = pgEnum('task_priority', TASK_PRIORITIES);
export const auditActionEnum = pgEnum('audit_action', AUDIT_ACTIONS);
export const userRoleEnum = pgEnum('user_role', USER_ROLES);

const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    fullName: varchar('full_name', { length: 100 }).notNull(),
    email: varchar('email', { length: 254 }).notNull(),
    passwordHash: text('password_hash').notNull(),
    /** Everyone registers as USER; ADMIN is granted by another admin or the make-admin script, never by the client. */
    role: userRoleEnum('role').notNull().default('USER'),
    ...timestamps,
  },
  (t) => [
    // Case-insensitive uniqueness, enforced by the database even if the app forgets to normalise.
    uniqueIndex('users_email_lower_unique').on(sql`lower(${t.email})`),
  ],
);

export const projects = pgTable(
  'projects',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 120 }).notNull(),
    description: text('description').notNull().default(''),
    status: projectStatusEnum('status').notNull().default('NOT_STARTED'),
    startDate: date('start_date', { mode: 'string' }).notNull(),
    endDate: date('end_date', { mode: 'string' }),
    ...timestamps,
  },
  (t) => [
    // Every project query filters by owner first; (user_id, …) composites also serve plain user_id lookups.
    index('projects_user_id_created_at_idx').on(t.userId, t.createdAt),
    index('projects_user_id_status_idx').on(t.userId, t.status),
    check('projects_end_after_start', sql`${t.endDate} IS NULL OR ${t.endDate} >= ${t.startDate}`),
  ],
);

export const tasks = pgTable(
  'tasks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 160 }).notNull(),
    description: text('description').notNull().default(''),
    priority: taskPriorityEnum('priority').notNull().default('MEDIUM'),
    status: taskStatusEnum('status').notNull().default('PENDING'),
    dueDate: date('due_date', { mode: 'string' }),
    completedAt: timestamp('completed_at', { withTimezone: true, mode: 'date' }),
    ...timestamps,
  },
  (t) => [
    index('tasks_project_id_created_at_idx').on(t.projectId, t.createdAt),
    index('tasks_project_id_status_idx').on(t.projectId, t.status),
    index('tasks_project_id_priority_idx').on(t.projectId, t.priority),
    index('tasks_due_date_idx').on(t.dueDate),
  ],
);

/**
 * Refresh tokens are random opaque strings; only their SHA-256 hash is stored, so a
 * database leak does not leak usable sessions. Tokens rotate on every use and share a
 * family ID per login, which lets the API revoke a whole session when a stolen token is replayed.
 */
export const refreshTokens = pgTable(
  'refresh_tokens',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: varchar('token_hash', { length: 64 }).notNull(),
    familyId: uuid('family_id').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'date' }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true, mode: 'date' }),
    revokedReason: varchar('revoked_reason', { length: 20 }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('refresh_tokens_token_hash_unique').on(t.tokenHash),
    index('refresh_tokens_user_id_idx').on(t.userId),
    index('refresh_tokens_family_id_idx').on(t.familyId),
  ],
);

export const auditLogs = pgTable(
  'audit_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    action: auditActionEnum('action').notNull(),
    entityType: varchar('entity_type', { length: 20 }).notNull(),
    /** Not a foreign key on purpose: the log must survive deletion of the project or task it describes. */
    entityId: uuid('entity_id'),
    entityName: varchar('entity_name', { length: 160 }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (t) => [
    index('audit_logs_user_id_created_at_idx').on(t.userId, t.createdAt),
    // The admin audit log lists every user's entries newest-first.
    index('audit_logs_created_at_idx').on(t.createdAt),
  ],
);

/**
 * Phones registered for "due tomorrow" push reminders. One row per Expo push token; the token
 * moves to whichever user last signed in on that phone. `last_reminder_on` (the device's local
 * date) makes the hourly job idempotent: at most one reminder per device per day.
 */
export const notificationDevices = pgTable(
  'notification_devices',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    token: varchar('token', { length: 200 }).notNull(),
    platform: varchar('platform', { length: 10 }).notNull(),
    timezone: varchar('timezone', { length: 64 }).notNull(),
    lastReminderOn: date('last_reminder_on', { mode: 'string' }),
    ...timestamps,
  },
  (t) => [uniqueIndex('notification_devices_token_unique').on(t.token), index('notification_devices_user_id_idx').on(t.userId)],
);

export type UserRow = typeof users.$inferSelect;
export type ProjectRow = typeof projects.$inferSelect;
export type TaskRow = typeof tasks.$inferSelect;
export type RefreshTokenRow = typeof refreshTokens.$inferSelect;
export type AuditLogRow = typeof auditLogs.$inferSelect;
export type NotificationDeviceRow = typeof notificationDevices.$inferSelect;
