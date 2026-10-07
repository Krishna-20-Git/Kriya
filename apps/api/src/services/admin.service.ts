import type { AdminAuditLogQuery, AdminUserListQuery, UserRole } from '@pms/shared';
import { db } from '../db/client.js';
import { adminRepository } from '../repositories/admin.repository.js';
import { auditRepository } from '../repositories/audit.repository.js';
import { AppError, notFound } from '../utils/app-error.js';
import { pageMeta } from '../utils/http.js';
import { toAdminAuditLog, toAdminUser } from '../utils/serializers.js';

export const adminService = {
  async listUsers(query: AdminUserListQuery) {
    const { rows, total } = await adminRepository.listUsers(db, query);
    return { items: rows.map(toAdminUser), meta: pageMeta(query.page, query.limit, total) };
  },

  /**
   * Two safeguards keep the system administrable:
   * 1. An admin cannot remove their own admin role (no accidental self-lockout).
   * 2. The last remaining admin cannot be demoted.
   * Rows are locked inside the transaction, so concurrent role changes cannot bypass either rule.
   */
  async changeRole(actorId: string, targetId: string, role: UserRole) {
    return db.transaction(async (tx) => {
      const target = await adminRepository.findUserForUpdate(tx, targetId);
      if (!target) throw notFound('User');

      if (target.role !== role) {
        if (target.id === actorId) {
          throw new AppError(409, 'ROLE_CHANGE_NOT_ALLOWED', 'You can’t remove your own admin role. Ask another admin to do it.');
        }
        if (target.role === 'ADMIN') {
          const admins = await adminRepository.lockAdmins(tx);
          if (admins.length <= 1) throw new AppError(409, 'ROLE_CHANGE_NOT_ALLOWED', 'At least one admin must remain.');
        }
      }

      const updated = await adminRepository.setRole(tx, targetId, role);
      if (target.role !== role) {
        await auditRepository.record(tx, {
          userId: actorId,
          action: 'ROLE_CHANGED',
          entityType: 'USER',
          entityId: target.id,
          entityName: `${target.email}: ${target.role} → ${role}`,
        });
      }
      return toAdminUser(updated);
    });
  },

  async listAuditLogs(query: AdminAuditLogQuery) {
    const { rows, total } = await adminRepository.listAuditLogs(db, query);
    return { items: rows.map(toAdminAuditLog), meta: pageMeta(query.page, query.limit, total) };
  },
};
