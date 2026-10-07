import { registerDeviceSchema, unregisterDeviceSchema } from '@pms/shared';
import { createHash, timingSafeEqual } from 'node:crypto';
import type { Request, Response } from 'express';
import { env } from '../config/env.js';
import { requireUserId } from '../middleware/auth.middleware.js';
import { notificationService } from '../services/notification.service.js';
import { AppError, notFound } from '../utils/app-error.js';
import { parse, sendData, sendNoContent } from '../utils/http.js';

/** Constant-time comparison (hashing first makes the lengths equal). */
const secretMatches = (given: string, expected: string) =>
  timingSafeEqual(createHash('sha256').update(given).digest(), createHash('sha256').update(expected).digest());

export const notificationController = {
  async register(req: Request, res: Response) {
    const input = parse(registerDeviceSchema, req.body);
    sendData(res, await notificationService.registerDevice(requireUserId(req), input), 201);
  },

  async unregister(req: Request, res: Response) {
    const { token } = parse(unregisterDeviceSchema, req.body);
    await notificationService.unregisterDevice(requireUserId(req), token);
    sendNoContent(res);
  },

  async list(req: Request, res: Response) {
    sendData(res, await notificationService.listDevices(requireUserId(req)));
  },

  async test(req: Request, res: Response) {
    sendData(res, await notificationService.sendTest(requireUserId(req)));
  },

  /** POST /api/internal/reminders/run — called by an external scheduler with `Authorization: Bearer <CRON_SECRET>`. */
  async runReminders(req: Request, res: Response) {
    if (!env.CRON_SECRET) throw notFound('Route'); // Disabled unless a secret is configured.
    const [scheme, token] = (req.headers.authorization ?? '').split(' ');
    if (scheme?.toLowerCase() !== 'bearer' || !token || !secretMatches(token, env.CRON_SECRET)) {
      throw new AppError(401, 'UNAUTHENTICATED', 'Invalid cron secret');
    }
    sendData(res, await notificationService.runDueTomorrowReminders());
  },
};
