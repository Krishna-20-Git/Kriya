import type { AuditAction } from '@pms/shared';
import { desc, eq } from 'drizzle-orm';
import type { Executor } from '../db/client.js';
import { auditLogs } from '../db/schema.js';

export interface AuditEntry {
  userId: string;
  action: AuditAction;
  entityType: 'USER' | 'PROJECT' | 'TASK';
  entityId?: string | null;
  entityName?: string | null;
}

export const auditRepository = {
  /** Only identifiers and names are recorded — never request bodies, passwords or tokens. */
  record: async (db: Executor, entry: AuditEntry) => {
    await db.insert(auditLogs).values({
      userId: entry.userId,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId ?? null,
      entityName: entry.entityName?.slice(0, 160) ?? null,
    });
  },

  listForUser: (db: Executor, userId: string, limit: number) =>
    db
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.userId, userId))
      .orderBy(desc(auditLogs.createdAt), desc(auditLogs.id))
      .limit(limit),
};
