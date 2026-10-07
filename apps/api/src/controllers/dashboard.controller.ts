import { auditLogQuerySchema, dashboardQuerySchema } from '@pms/shared';
import type { Request, Response } from 'express';
import { db } from '../db/client.js';
import { requireUserId } from '../middleware/auth.middleware.js';
import { auditRepository } from '../repositories/audit.repository.js';
import { dashboardService } from '../services/dashboard.service.js';
import { parse, sendData } from '../utils/http.js';
import { toAuditLog } from '../utils/serializers.js';

const serverToday = () => new Date().toISOString().slice(0, 10);

export const dashboardController = {
  async get(req: Request, res: Response) {
    const { today } = parse(dashboardQuerySchema, req.query);
    sendData(res, await dashboardService.get(requireUserId(req), today ?? serverToday()));
  },
};

export const activityController = {
  async list(req: Request, res: Response) {
    const { limit } = parse(auditLogQuerySchema, req.query);
    const rows = await auditRepository.listForUser(db, requireUserId(req), limit);
    sendData(res, rows.map(toAuditLog));
  },
};
