import type { NextFunction, Request, Response } from 'express';
import { unauthenticated } from '../utils/app-error.js';
import { verifyAccessToken } from '../utils/tokens.js';

/**
 * Requires `Authorization: Bearer <access token>`. Both clients use the header:
 * the web app keeps the access token in memory, the mobile app in SecureStore.
 */
export function authMiddleware(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header) throw unauthenticated();

  const [scheme, token] = header.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token) {
    throw unauthenticated('Authorization header must use the Bearer scheme');
  }

  req.auth = verifyAccessToken(token);
  next();
}

/** Typed accessor for handlers mounted behind authMiddleware. */
export function requireUserId(req: Request): string {
  if (!req.auth) throw unauthenticated();
  return req.auth.userId;
}
