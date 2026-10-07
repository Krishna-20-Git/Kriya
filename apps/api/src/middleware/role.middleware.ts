import type { UserRole } from '@pms/shared';
import type { NextFunction, Request, Response } from 'express';
import { db } from '../db/client.js';
import { userRepository } from '../repositories/user.repository.js';
import { forbidden, unauthenticated } from '../utils/app-error.js';

/**
 * Role check, mounted after authMiddleware. The role comes from the database rather than the
 * JWT, so promoting or demoting someone takes effect on their very next request — no waiting
 * for a 15-minute access token to expire.
 */
export const requireRole =
  (...allowed: UserRole[]) =>
  async (req: Request, _res: Response, next: NextFunction) => {
    if (!req.auth) throw unauthenticated();
    const role = await userRepository.findRole(db, req.auth.userId);
    if (!role) throw unauthenticated('Your account no longer exists');
    if (!allowed.includes(role)) throw forbidden('Admin access required');
    next();
  };
