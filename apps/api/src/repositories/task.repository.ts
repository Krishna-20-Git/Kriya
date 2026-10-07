import type { TaskListQuery } from '@pms/shared';
import { and, count, eq, getTableColumns, gte, ilike, inArray, isNotNull, lt, ne, sql, type SQL } from 'drizzle-orm';
import type { Executor } from '../db/client.js';
import { projects, tasks, type TaskRow } from '../db/schema.js';
import { escapeLike } from '../utils/http.js';

/**
 * Tasks have no user_id column (that would duplicate data the project already holds).
 * Ownership is enforced by joining through projects and filtering on projects.user_id.
 */
const taskWithProject = { ...getTableColumns(tasks), projectName: projects.name };

const ownedBy = (userId: string) => eq(projects.userId, userId);

/** Sub-select of the caller's project IDs — used where a JOIN is not available (UPDATE / DELETE). */
const ownedProjectIds = (db: Executor, userId: string) =>
  db.select({ id: projects.id }).from(projects).where(ownedBy(userId));

const SORT_COLUMNS = {
  name: sql`lower(${tasks.name})`,
  createdAt: sql`${tasks.createdAt}`,
  dueDate: sql`${tasks.dueDate}`,
  priority: sql`${tasks.priority}`,
  status: sql`${tasks.status}`,
} satisfies Record<TaskListQuery['sortBy'], SQL>;

export type TaskData = Pick<TaskRow, 'projectId' | 'name' | 'description' | 'priority' | 'status' | 'dueDate' | 'completedAt'>;

export const taskRepository = {
  list: async (db: Executor, userId: string, query: TaskListQuery) => {
    const filters = [ownedBy(userId)];
    if (query.search) filters.push(ilike(tasks.name, `%${escapeLike(query.search)}%`));
    if (query.status) filters.push(eq(tasks.status, query.status));
    if (query.priority) filters.push(eq(tasks.priority, query.priority));
    if (query.dueOn) filters.push(eq(tasks.dueDate, query.dueOn));
    if (query.projectId) filters.push(eq(tasks.projectId, query.projectId));
    const where = and(...filters);

    const column = SORT_COLUMNS[query.sortBy];
    const direction = query.sortOrder === 'asc' ? sql`asc nulls last` : sql`desc nulls last`;

    const [items, [totals]] = await Promise.all([
      db
        .select(taskWithProject)
        .from(tasks)
        .innerJoin(projects, eq(tasks.projectId, projects.id))
        .where(where)
        .orderBy(sql`${column} ${direction}`, tasks.id)
        .limit(query.limit)
        .offset((query.page - 1) * query.limit),
      db
        .select({ total: count() })
        .from(tasks)
        .innerJoin(projects, eq(tasks.projectId, projects.id))
        .where(where),
    ]);

    return { items, total: totals?.total ?? 0 };
  },

  findOwned: async (db: Executor, userId: string, id: string) => {
    const [task] = await db
      .select(taskWithProject)
      .from(tasks)
      .innerJoin(projects, eq(tasks.projectId, projects.id))
      .where(and(eq(tasks.id, id), ownedBy(userId)))
      .limit(1);
    return task ?? null;
  },

  create: async (db: Executor, data: TaskData) => {
    const [row] = await db.insert(tasks).values(data).returning({ id: tasks.id });
    if (!row) throw new Error('Insert into tasks returned no row');
    return row.id;
  },

  update: async (db: Executor, userId: string, id: string, data: Partial<TaskData>) => {
    const rows = await db
      .update(tasks)
      .set(data)
      .where(and(eq(tasks.id, id), inArray(tasks.projectId, ownedProjectIds(db, userId))))
      .returning({ id: tasks.id });
    return rows.length > 0;
  },

  delete: async (db: Executor, userId: string, id: string) => {
    const rows = await db
      .delete(tasks)
      .where(and(eq(tasks.id, id), inArray(tasks.projectId, ownedProjectIds(db, userId))))
      .returning({ id: tasks.id, name: tasks.name });
    return rows[0] ?? null;
  },

  countByStatusAndPriority: (db: Executor, userId: string) =>
    db
      .select({ status: tasks.status, priority: tasks.priority, total: count() })
      .from(tasks)
      .innerJoin(projects, eq(tasks.projectId, projects.id))
      .where(ownedBy(userId))
      .groupBy(tasks.status, tasks.priority),

  countOverdue: async (db: Executor, userId: string, today: string) => {
    const [row] = await db
      .select({ total: count() })
      .from(tasks)
      .innerJoin(projects, eq(tasks.projectId, projects.id))
      .where(and(ownedBy(userId), ne(tasks.status, 'COMPLETED'), lt(tasks.dueDate, today)));
    return row?.total ?? 0;
  },

  /** Open tasks that have a due date: overdue first, then soonest. */
  dueSoon: (db: Executor, userId: string, limit: number, fromDate?: string) =>
    db
      .select(taskWithProject)
      .from(tasks)
      .innerJoin(projects, eq(tasks.projectId, projects.id))
      .where(
        and(
          ownedBy(userId),
          ne(tasks.status, 'COMPLETED'),
          isNotNull(tasks.dueDate),
          fromDate ? gte(tasks.dueDate, fromDate) : undefined,
        ),
      )
      .orderBy(tasks.dueDate, sql`${tasks.priority} desc`, tasks.id)
      .limit(limit),
};
