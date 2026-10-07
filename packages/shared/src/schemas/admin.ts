import { z } from 'zod';
import { AUDIT_ACTIONS, USER_ROLES } from '../enums.js';
import { LIMITS, uuid } from '../primitives.js';

const emptyToUndefined = (value: unknown) => (typeof value === 'string' && value.trim() === '' ? undefined : value);
const optionalParam = <T extends z.ZodType>(schema: T) => z.preprocess(emptyToUndefined, schema.optional());
const page = z.preprocess(emptyToUndefined, z.coerce.number().int().min(1).max(100_000).default(1));
const limit = z.preprocess(emptyToUndefined, z.coerce.number().int().min(1).max(LIMITS.pageSize.max).default(20));

export const userRoleSchema = z.enum(USER_ROLES, { error: `Role must be one of: ${USER_ROLES.join(', ')}` });

/** GET /api/admin/users */
export const adminUserListQuerySchema = z.strictObject({
  search: optionalParam(z.string().trim().max(LIMITS.search.max, 'search is too long')),
  role: optionalParam(userRoleSchema),
  page,
  limit,
});
export type AdminUserListQuery = z.infer<typeof adminUserListQuerySchema>;

/** PATCH /api/admin/users/:id/role */
export const updateUserRoleSchema = z.strictObject({ role: userRoleSchema });
export type UpdateUserRoleInput = z.infer<typeof updateUserRoleSchema>;

/** GET /api/admin/audit-logs */
export const adminAuditLogQuerySchema = z.strictObject({
  userId: optionalParam(uuid('userId')),
  action: optionalParam(z.enum(AUDIT_ACTIONS, { error: 'Unknown audit action' })),
  page,
  limit,
});
export type AdminAuditLogQuery = z.infer<typeof adminAuditLogQuerySchema>;
