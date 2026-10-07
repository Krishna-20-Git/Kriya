import type { AdminAuditLogEntry, AdminUser, AuditLogEntry, Project, Task, User } from '@pms/shared';
import type { AdminAuditRow, AdminUserRow } from '../repositories/admin.repository.js';
import type { AuditLogRow, ProjectRow, TaskRow, UserRow } from '../db/schema.js';

/**
 * Database rows never leave the API directly. Each serializer whitelists the fields a
 * client may see, so a new column (or passwordHash) can never leak by accident.
 */
export const toUser = (row: Pick<UserRow, 'id' | 'fullName' | 'email' | 'role' | 'createdAt'>): User => ({
  id: row.id,
  fullName: row.fullName,
  email: row.email,
  role: row.role,
  createdAt: row.createdAt.toISOString(),
});

export type ProjectWithCounts = ProjectRow & { taskCount: number; completedTaskCount: number };

export const toProject = (row: ProjectWithCounts): Project => ({
  id: row.id,
  name: row.name,
  description: row.description,
  status: row.status,
  startDate: row.startDate,
  endDate: row.endDate,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
  taskCount: Number(row.taskCount),
  completedTaskCount: Number(row.completedTaskCount),
});

export type TaskWithProject = TaskRow & { projectName: string };

export const toTask = (row: TaskWithProject): Task => ({
  id: row.id,
  projectId: row.projectId,
  project: { id: row.projectId, name: row.projectName },
  name: row.name,
  description: row.description,
  priority: row.priority,
  status: row.status,
  dueDate: row.dueDate,
  completedAt: row.completedAt ? row.completedAt.toISOString() : null,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
});

export const toAuditLog = (row: AuditLogRow): AuditLogEntry => ({
  id: row.id,
  action: row.action,
  entityType: row.entityType as AuditLogEntry['entityType'],
  entityId: row.entityId,
  entityName: row.entityName,
  createdAt: row.createdAt.toISOString(),
});

export const toAdminUser = (row: AdminUserRow): AdminUser => ({
  ...toUser(row),
  projectCount: Number(row.projectCount),
  taskCount: Number(row.taskCount),
  // Sub-select results arrive as strings from node-postgres, not Date objects.
  lastActiveAt: row.lastActiveAt ? new Date(row.lastActiveAt).toISOString() : null,
});

export const toAdminAuditLog = (row: AdminAuditRow): AdminAuditLogEntry => ({
  id: row.id,
  action: row.action,
  entityType: row.entityType as AuditLogEntry['entityType'],
  entityId: row.entityId,
  entityName: row.entityName,
  createdAt: row.createdAt.toISOString(),
  actor: { id: row.actorId, fullName: row.actorName, email: row.actorEmail },
});
