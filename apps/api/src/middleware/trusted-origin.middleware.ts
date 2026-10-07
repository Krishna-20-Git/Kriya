import type { NextFunction, Request, Response } from 'express';
import { env } from '../config/env.js';
import { AppError } from '../utils/app-error.js';

/**
 * CSRF defence for the two endpoints that act on the refresh-token cookie (refresh, logout).
 * SameSite already stops most cross-site requests; this also rejects any browser request whose
 * Origin is not the web app. Requests without an Origin header (the mobile app, curl) are not
 * cookie-authenticated, so they are unaffected.
 */
export function trustedOriginMiddleware(req: Request, _res: Response, next: NextFunction) {
  const origin = req.headers.origin;
  if (origin && !env.WEB_ORIGINS.includes(origin.replace(/\/$/, ''))) {
    throw new AppError(403, 'FORBIDDEN', 'Request origin is not allowed');
  }
  next();
}
