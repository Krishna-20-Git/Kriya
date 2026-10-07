import type { ProjectListQuery } from '@pms/shared';
import { and, count, eq, getTableColumns, ilike, sql, type SQL } from 'drizzle-orm';
import type { Executor } from '../db/client.js';
import { projects, type ProjectRow } from '../db/schema.js';
import { escapeLike } from '../utils/http.js';

/**
 * Correlated sub-selects instead of a GROUP BY over all tasks: they only run for the rows
 * on the current page and use the (project_id, status) index.
 */
const projectWithCounts = {
  ...getTableColumns(projects),
  // Column references are fully qualified on purpose: an unqualified "id" inside the
  // sub-select would resolve to tasks.id, not the outer projects.id (covered by a test).
  taskCount: sql<number>`(select count(*)::int from "tasks" t where t."project_id" = "projects"."id")`,
  completedTaskCount: sql<number>`(select count(*)::int from "tasks" t where t."project_id" = "projects"."id" and t."status" = 'COMPLETED')`,
};

/** Whitelisted sort columns. User input selects a key; it is never interpolated into SQL. */
const SORT_COLUMNS = {
  name: sql`lower(${projects.name})`,
  createdAt: sql`${projects.createdAt}`,
  startDate: sql`${projects.startDate}`,
  endDate: sql`${projects.endDate}`,
  status: sql`${projects.status}`,
} satisfies Record<ProjectListQuery['sortBy'], SQL>;

const ownedBy = (userId: string) => eq(projects.userId, userId);

export type ProjectData = Pick<ProjectRow, 'name' | 'description' | 'status' | 'startDate' | 'endDate'>;

export const projectRepository = {
  list: async (db: Executor, userId: string, query: ProjectListQuery) => {
    const filters = [ownedBy(userId)];
    if (query.search) filters.push(ilike(projects.name, `%${escapeLike(query.search)}%`));
    if (query.status) filters.push(eq(projects.status, query.status));
    const where = and(...filters);

    const column = SORT_COLUMNS[query.sortBy];
    const direction = query.sortOrder === 'asc' ? sql`asc nulls last` : sql`desc nulls last`;

    const [items, [totals]] = await Promise.all([
      db
        .select(projectWithCounts)
        .from(projects)
        .where(where)
        // projects.id is a tie-breaker so paging is stable when sort values are equal.
        .orderBy(sql`${column} ${direction}`, projects.id)
        .limit(query.limit)
        .offset((query.page - 1) * query.limit),
      db.select({ total: count() }).from(projects).where(where),
    ]);

    return { items, total: totals?.total ?? 0 };
  },

  /** Returns null both for "does not exist" and "belongs to someone else" — callers answer 404 either way. */
  findOwned: async (db: Executor, userId: string, id: string) => {
    const [project] = await db
      .select(projectWithCounts)
      .from(projects)
      .where(and(eq(projects.id, id), ownedBy(userId)))
      .limit(1);
    return project ?? null;
  },

  exists: async (db: Executor, userId: string, id: string) => {
    const [row] = await db
      .select({ id: projects.id })
      .from(projects)
      .where(and(eq(projects.id, id), ownedBy(userId)))
      .limit(1);
    return !!row;
  },

  create: async (db: Executor, userId: string, data: ProjectData) => {
    const [row] = await db.insert(projects).values({ ...data, userId }).returning({ id: projects.id });
    if (!row) throw new Error('Insert into projects returned no row');
    return row.id;
  },

  /** The owner check is part of the UPDATE itself, so there is no gap between "check" and "write". */
  update: async (db: Executor, userId: string, id: string, data: Partial<ProjectData>) => {
    const rows = await db
      .update(projects)
      .set(data)
      .where(and(eq(projects.id, id), ownedBy(userId)))
      .returning({ id: projects.id });
    return rows.length > 0;
  },

  delete: async (db: Executor, userId: string, id: string) => {
    const rows = await db
      .delete(projects)
      .where(and(eq(projects.id, id), ownedBy(userId)))
      .returning({ id: projects.id, name: projects.name });
    return rows[0] ?? null;
  },

  recent: (db: Executor, userId: string, limit: number) =>
    db
      .select(projectWithCounts)
      .from(projects)
      .where(ownedBy(userId))
      .orderBy(sql`${projects.updatedAt} desc`, projects.id)
      .limit(limit),

  countByStatus: (db: Executor, userId: string) =>
    db
      .select({ status: projects.status, total: count() })
      .from(projects)
      .where(ownedBy(userId))
      .groupBy(projects.status),
};
