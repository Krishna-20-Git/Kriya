import { CLIENT_HEADER, MOBILE_CLIENT, loginSchema, refreshSchema, registerSchema, type AuthSession } from '@pms/shared';
import type { CookieOptions, Request, Response } from 'express';
import { env } from '../config/env.js';
import { requireUserId } from '../middleware/auth.middleware.js';
import { authService, type IssuedSession } from '../services/auth.service.js';
import { parse, sendData, sendNoContent } from '../utils/http.js';

export const REFRESH_COOKIE = 'pms_refresh';

const cookieOptions = (): CookieOptions => ({
  httpOnly: true, // not readable from JavaScript, so an XSS bug cannot steal the session
  secure: env.COOKIE_SECURE,
  sameSite: env.COOKIE_SAMESITE,
  path: '/api/auth', // only sent to the auth endpoints, never to /api/projects etc.
  maxAge: env.REFRESH_TOKEN_TTL_DAYS * 86_400_000,
});

const isMobile = (req: Request) => req.headers[CLIENT_HEADER] === MOBILE_CLIENT;

/**
 * Web: refresh token goes into an HttpOnly cookie and is omitted from the body.
 * Mobile: there is no cookie jar, so the token is returned in the body and stored in SecureStore.
 */
function sendSession(req: Request, res: Response, session: IssuedSession, status: number) {
  const { refreshToken, ...rest } = session;
  if (isMobile(req)) {
    const body: AuthSession = { ...rest, refreshToken };
    return sendData(res, body, status);
  }
  res.cookie(REFRESH_COOKIE, refreshToken, cookieOptions());
  return sendData(res, rest satisfies AuthSession, status);
}

function presentedRefreshToken(req: Request): string | undefined {
  if (isMobile(req)) return parse(refreshSchema, req.body ?? {}).refreshToken;
  const cookie: unknown = req.cookies?.[REFRESH_COOKIE];
  return typeof cookie === 'string' && cookie.length > 0 ? cookie : undefined;
}

function clearRefreshCookie(res: Response) {
  const { maxAge: _maxAge, ...options } = cookieOptions();
  res.clearCookie(REFRESH_COOKIE, options);
}

export const authController = {
  async register(req: Request, res: Response) {
    const session = await authService.register(parse(registerSchema, req.body));
    sendSession(req, res, session, 201);
  },

  async login(req: Request, res: Response) {
    const session = await authService.login(parse(loginSchema, req.body));
    sendSession(req, res, session, 200);
  },

  async refresh(req: Request, res: Response) {
    try {
      const session = await authService.refresh(presentedRefreshToken(req));
      sendSession(req, res, session, 200);
    } catch (error) {
      // A dead refresh cookie is useless; remove it so the browser stops sending it.
      if (!isMobile(req)) clearRefreshCookie(res);
      throw error;
    }
  },

  async logout(req: Request, res: Response) {
    await authService.logout(presentedRefreshToken(req));
    clearRefreshCookie(res);
    sendNoContent(res);
  },

  async logoutAll(req: Request, res: Response) {
    await authService.logoutAll(requireUserId(req));
    clearRefreshCookie(res);
    sendNoContent(res);
  },

  async me(req: Request, res: Response) {
    sendData(res, await authService.me(requireUserId(req)));
  },
};
