import type { AdminAuditLogQuery, AdminUserListQuery, UserRole } from '@pms/shared';
import { and, count, desc, eq, ilike, or, sql, type SQL } from 'drizzle-orm';
import type { Executor } from '../db/client.js';
import { auditLogs, users } from '../db/schema.js';
import { escapeLike } from '../utils/http.js';

/**
 * Admin reads. Admins see accounts and counts, never the contents of anyone's projects or tasks:
 * the counts come from correlated sub-selects, and no project/task columns are ever selected here.
 */
const adminUserColumns = {
  id: users.id,
  fullName: users.fullName,
  email: users.email,
  role: users.role,
  createdAt: users.createdAt,
  projectCount: sql<number>`(select count(*)::int from "projects" p where p."user_id" = "users"."id")`,
  taskCount: sql<number>`(select count(*)::int from "tasks" t join "projects" p on p."id" = t."project_id" where p."user_id" = "users"."id")`,
  lastActiveAt: sql<Date | null>`(select max(a."created_at") from "audit_logs" a where a."user_id" = "users"."id")`,
};

export const adminRepository = {
  listUsers: async (db: Executor, query: AdminUserListQuery) => {
    const filters: SQL[] = [];
    if (query.search) {
      const pattern = `%${escapeLike(query.search)}%`;
      filters.push(or(ilike(users.fullName, pattern), ilike(users.email, pattern))!);
    }
    if (query.role) filters.push(eq(users.role, query.role));
    const where = filters.length ? and(...filters) : undefined;

    const [rows, [total]] = await Promise.all([
      db
        .select(adminUserColumns)
        .from(users)
        .where(where)
        .orderBy(desc(users.createdAt), users.id)
        .limit(query.limit)
        .offset((query.page - 1) * query.limit),
      db.select({ value: count() }).from(users).where(where),
    ]);
    return { rows, total: total?.value ?? 0 };
  },

  findUserForUpdate: async (db: Executor, id: string) => {
    const [row] = await db
      .select({ id: users.id, email: users.email, role: users.role })
      .from(users)
      .where(eq(users.id, id))
      .for('update')
      .limit(1);
    return row ?? null;
  },

  /** Locks every admin row, so two admins demoting each other at the same moment cannot leave zero admins. */
  lockAdmins: (db: Executor) => db.select({ id: users.id }).from(users).where(eq(users.role, 'ADMIN')).for('update'),

  setRole: async (db: Executor, id: string, role: UserRole) => {
    await db.update(users).set({ role }).where(eq(users.id, id));
    const [row] = await db.select(adminUserColumns).from(users).where(eq(users.id, id)).limit(1);
    if (!row) throw new Error('User disappeared during role change');
    return row;
  },

  listAuditLogs: async (db: Executor, query: AdminAuditLogQuery) => {
    const filters: SQL[] = [];
    if (query.userId) filters.push(eq(auditLogs.userId, query.userId));
    if (query.action) filters.push(eq(auditLogs.action, query.action));
    const where = filters.length ? and(...filters) : undefined;

    const [rows, [total]] = await Promise.all([
      db
        .select({
          id: auditLogs.id,
          action: auditLogs.action,
          entityType: auditLogs.entityType,
          entityId: auditLogs.entityId,
          // Project and task names are user content: admins see that an action happened, not what it was called.
          entityName: sql<string | null>`case when ${auditLogs.entityType} in ('PROJECT', 'TASK') then null else ${auditLogs.entityName} end`,
          createdAt: auditLogs.createdAt,
          actorId: users.id,
          actorName: users.fullName,
          actorEmail: users.email,
        })
        .from(auditLogs)
        .innerJoin(users, eq(users.id, auditLogs.userId))
        .where(where)
        .orderBy(desc(auditLogs.createdAt), desc(auditLogs.id))
        .limit(query.limit)
        .offset((query.page - 1) * query.limit),
      db.select({ value: count() }).from(auditLogs).where(where),
    ]);
    return { rows, total: total?.value ?? 0 };
  },
};

export type AdminUserRow = Awaited<ReturnType<typeof adminRepository.setRole>>;
export type AdminAuditRow = Awaited<ReturnType<typeof adminRepository.listAuditLogs>>['rows'][number];
