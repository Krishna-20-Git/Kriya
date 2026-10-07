import { createHash, randomBytes } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { AppError } from './app-error.js';

const ISSUER = 'pms-api';
const AUDIENCE = 'pms-clients';
const ALGORITHM = 'HS256';

interface AccessTokenPayload {
  sub: string;
  typ: 'access';
}

export const signAccessToken = (userId: string): string =>
  jwt.sign({ typ: 'access' } satisfies Omit<AccessTokenPayload, 'sub'>, env.JWT_ACCESS_SECRET, {
    algorithm: ALGORITHM,
    subject: userId,
    issuer: ISSUER,
    audience: AUDIENCE,
    expiresIn: env.ACCESS_TOKEN_TTL_SECONDS,
  });

/**
 * Verifies signature, algorithm (prevents "alg: none" / algorithm-confusion attacks),
 * issuer, audience and expiry. Maps library errors to stable API error codes.
 */
export const verifyAccessToken = (token: string): { userId: string } => {
  try {
    const payload = jwt.verify(token, env.JWT_ACCESS_SECRET, {
      algorithms: [ALGORITHM],
      issuer: ISSUER,
      audience: AUDIENCE,
    });
    if (typeof payload === 'string' || payload.typ !== 'access' || typeof payload.sub !== 'string') {
      throw new AppError(401, 'INVALID_TOKEN', 'Invalid access token');
    }
    return { userId: payload.sub };
  } catch (error) {
    if (error instanceof AppError) throw error;
    if (error instanceof jwt.TokenExpiredError) {
      throw new AppError(401, 'TOKEN_EXPIRED', 'Access token has expired');
    }
    throw new AppError(401, 'INVALID_TOKEN', 'Invalid access token');
  }
};

/** 256 bits of randomness, URL-safe. Only the SHA-256 hash is ever stored. */
export const generateRefreshToken = (): string => randomBytes(32).toString('base64url');

export const hashToken = (token: string): string => createHash('sha256').update(token).digest('hex');
