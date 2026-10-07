import { z } from 'zod';
import { PROJECT_SORT_FIELDS, SORT_ORDERS, TASK_SORT_FIELDS } from '../enums.js';
import { LIMITS, isoDate, uuid } from '../primitives.js';
import { projectStatusSchema } from './project.js';
import { taskPrioritySchema, taskStatusSchema } from './task.js';

/** Query strings arrive as strings; treat `?status=` the same as no filter. */
const emptyToUndefined = (value: unknown) =>
  typeof value === 'string' && value.trim() === '' ? undefined : value;

const optionalParam = <T extends z.ZodType>(schema: T) =>
  z.preprocess(emptyToUndefined, schema.optional());

const pagination = {
  page: z.preprocess(
    emptyToUndefined,
    z.coerce.number().int('page must be an integer').min(1, 'page must be at least 1').max(100_000).default(1),
  ),
  limit: z.preprocess(
    emptyToUndefined,
    z.coerce
      .number()
      .int('limit must be an integer')
      .min(1, 'limit must be at least 1')
      .max(LIMITS.pageSize.max, `limit must be at most ${LIMITS.pageSize.max}`)
      .default(LIMITS.pageSize.default),
  ),
};

const search = optionalParam(z.string().trim().max(LIMITS.search.max, 'search is too long'));
const sortOrder = z.preprocess(emptyToUndefined, z.enum(SORT_ORDERS).default('desc'));

export const projectListQuerySchema = z.strictObject({
  search,
  status: optionalParam(projectStatusSchema),
  ...pagination,
  sortBy: z.preprocess(
    emptyToUndefined,
    z.enum(PROJECT_SORT_FIELDS, { error: `sortBy must be one of: ${PROJECT_SORT_FIELDS.join(', ')}` }).default('createdAt'),
  ),
  sortOrder,
});
export type ProjectListQuery = z.infer<typeof projectListQuerySchema>;

export const taskListQuerySchema = z.strictObject({
  search,
  status: optionalParam(taskStatusSchema),
  priority: optionalParam(taskPrioritySchema),
  projectId: optionalParam(uuid('projectId')),
  /** Tasks due on exactly this date (YYYY-MM-DD) — used for "due tomorrow" reminders. */
  dueOn: optionalParam(isoDate('dueOn')),
  ...pagination,
  sortBy: z.preprocess(
    emptyToUndefined,
    z.enum(TASK_SORT_FIELDS, { error: `sortBy must be one of: ${TASK_SORT_FIELDS.join(', ')}` }).default('createdAt'),
  ),
  sortOrder,
});
export type TaskListQuery = z.infer<typeof taskListQuerySchema>;

export const idParamSchema = z.strictObject({ id: uuid() });

export const auditLogQuerySchema = z.strictObject({
  limit: z.preprocess(emptyToUndefined, z.coerce.number().int().min(1).max(50).default(20)),
});

/** The client sends its local date so "overdue" is evaluated in the user's timezone, not the server's. */
export const dashboardQuerySchema = z.strictObject({
  today: optionalParam(isoDate('today')),
});
