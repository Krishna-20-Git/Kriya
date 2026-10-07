import { adminAuditLogQuerySchema, adminUserListQuerySchema, idParamSchema, updateUserRoleSchema } from '@pms/shared';
import type { Request, Response } from 'express';
import { requireUserId } from '../middleware/auth.middleware.js';
import { adminService } from '../services/admin.service.js';
import { parse, sendData, sendPage } from '../utils/http.js';

export const adminController = {
  async listUsers(req: Request, res: Response) {
    const { items, meta } = await adminService.listUsers(parse(adminUserListQuerySchema, req.query));
    sendPage(res, items, meta);
  },

  async changeRole(req: Request, res: Response) {
    const { id } = parse(idParamSchema, req.params);
    const { role } = parse(updateUserRoleSchema, req.body);
    sendData(res, await adminService.changeRole(requireUserId(req), id, role));
  },

  async listAuditLogs(req: Request, res: Response) {
    const { items, meta } = await adminService.listAuditLogs(parse(adminAuditLogQuerySchema, req.query));
    sendPage(res, items, meta);
  },
};
