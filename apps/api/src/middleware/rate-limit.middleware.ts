import type { ApiFailure } from '@pms/shared';
import { ipKeyGenerator, rateLimit, type Options } from 'express-rate-limit';

const MINUTE = 60_000;

const limiter = (windowMs: number, limit: number, message: string, options: Partial<Options> = {}) =>
  rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (_req, res) => {
      const body: ApiFailure = { success: false, error: { code: 'RATE_LIMITED', message } };
      res.status(429).json(body);
    },
    ...options,
  });

export interface RateLimitConfig {
  loginMax: number;
  loginPerAccountMax: number;
  registerMax: number;
  refreshMax: number;
  apiMax: number;
}

/**
 * Per-IP limits (express-rate-limit groups IPv6 addresses by /56 so one host cannot rotate addresses).
 * Login only counts failed attempts, so a user who signs in successfully is never locked out by their own logins.
 */
export const createRateLimiters = (config: RateLimitConfig) => ({
  login: limiter(15 * MINUTE, config.loginMax, 'Too many login attempts. Please wait 15 minutes and try again.', {
    skipSuccessfulRequests: true,
  }),
  /**
   * Second layer keyed by the target email, not the IP: stops password guessing against one account
   * even when the attacker rotates IPs or spoofs X-Forwarded-For through a proxy chain.
   */
  loginPerAccount: limiter(15 * MINUTE, config.loginPerAccountMax, 'Too many failed attempts for this account. Please wait 15 minutes.', {
    skipSuccessfulRequests: true,
    keyGenerator: (req) => {
      const email: unknown = (req.body as { email?: unknown } | undefined)?.email;
      return typeof email === 'string' && email.trim() ? `email:${email.trim().toLowerCase().slice(0, 254)}` : `ip:${ipKeyGenerator(req.ip ?? '')}`;
    },
  }),
  register: limiter(60 * MINUTE, config.registerMax, 'Too many accounts created from this network. Please try again later.'),
  refresh: limiter(15 * MINUTE, config.refreshMax, 'Too many session refreshes. Please try again later.'),
  api: limiter(15 * MINUTE, config.apiMax, 'Too many requests. Please slow down.'),
});

export type RateLimiters = ReturnType<typeof createRateLimiters>;
