import { randomUUID } from 'node:crypto';
import type { AuthSession, LoginInput, RegisterInput, User } from '@pms/shared';
import { env } from '../config/env.js';
import { db } from '../db/client.js';
import { auditRepository } from '../repositories/audit.repository.js';
import { refreshTokenRepository } from '../repositories/refresh-token.repository.js';
import { notificationRepository } from '../repositories/notification.repository.js';
import { userRepository } from '../repositories/user.repository.js';
import { AppError } from '../utils/app-error.js';
import { DUMMY_PASSWORD_HASH, hashPassword, verifyPassword } from '../utils/password.js';
import { toUser } from '../utils/serializers.js';
import { generateRefreshToken, hashToken, signAccessToken } from '../utils/tokens.js';

/**
 * If the same refresh token is presented twice within this window, it is almost certainly two
 * tabs (or two parallel requests) refreshing at once, not an attacker. The second request gets a
 * retryable 409 instead of triggering reuse detection and logging the user out everywhere.
 */
const ROTATION_GRACE_MS = 30_000;

export interface IssuedSession extends Omit<AuthSession, 'refreshToken'> {
  refreshToken: string;
}

const sessionExpired = () =>
  new AppError(401, 'REFRESH_TOKEN_INVALID', 'Your session has expired. Please log in again.');

async function issueSession(user: User, familyId: string = randomUUID()): Promise<IssuedSession> {
  const refreshToken = generateRefreshToken();
  await refreshTokenRepository.create(db, {
    userId: user.id,
    tokenHash: hashToken(refreshToken),
    familyId,
    expiresAt: new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 86_400_000),
  });
  return {
    user,
    accessToken: signAccessToken(user.id),
    expiresIn: env.ACCESS_TOKEN_TTL_SECONDS,
    refreshToken,
  };
}

export const authService = {
  async register(input: RegisterInput): Promise<IssuedSession> {
    if (await userRepository.findByEmail(db, input.email)) {
      throw new AppError(409, 'EMAIL_TAKEN', 'An account with this email already exists');
    }

    const passwordHash = await hashPassword(input.password);
    const user = await db
      .transaction(async (tx) => {
        const created = await userRepository.create(tx, { fullName: input.fullName, email: input.email, passwordHash });
        await auditRepository.record(tx, { userId: created.id, action: 'USER_REGISTERED', entityType: 'USER', entityId: created.id });
        return created;
      })
      .catch((error: unknown) => {
        // Two simultaneous registrations with the same email: the unique index wins.
        if ((error as { code?: string })?.code === '23505') {
          throw new AppError(409, 'EMAIL_TAKEN', 'An account with this email already exists');
        }
        throw error;
      });

    return issueSession(toUser(user));
  },

  async login(input: LoginInput): Promise<IssuedSession> {
    const user = await userRepository.findByEmail(db, input.email);
    // Always run bcrypt, even for unknown emails, so response time does not reveal which emails exist.
    const passwordMatches = await verifyPassword(input.password, user?.passwordHash ?? DUMMY_PASSWORD_HASH);
    if (!user || !passwordMatches) {
      throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
    }

    await auditRepository.record(db, { userId: user.id, action: 'LOGIN', entityType: 'USER', entityId: user.id });
    return issueSession(toUser(user));
  },

  /**
   * Refresh-token rotation with reuse detection:
   *  - every refresh revokes the presented token and issues a new one in the same family;
   *  - presenting an already-rotated token (outside the grace window) means it was copied,
   *    so the whole family is revoked and both the attacker and the victim must log in again.
   */
  async refresh(presentedToken: string | undefined): Promise<IssuedSession> {
    // No token at all means "never signed in" — distinct from an expired one, so clients can word it differently.
    if (!presentedToken) throw new AppError(401, 'UNAUTHENTICATED', 'No active session');

    const stored = await refreshTokenRepository.findByHash(db, hashToken(presentedToken));
    if (!stored) throw sessionExpired();

    if (stored.revokedAt) {
      const recentlyRotated =
        stored.revokedReason === 'rotated' && Date.now() - stored.revokedAt.getTime() < ROTATION_GRACE_MS;
      if (recentlyRotated) {
        throw new AppError(409, 'REFRESH_CONFLICT', 'Session was refreshed by another request. Retry once.');
      }
      if (stored.revokedReason === 'rotated') {
        await refreshTokenRepository.revokeFamily(db, stored.familyId, 'reuse_detected');
        throw new AppError(401, 'REFRESH_TOKEN_REUSED', 'Your session is no longer valid. Please log in again.');
      }
      throw sessionExpired();
    }

    if (stored.expiresAt.getTime() <= Date.now()) throw sessionExpired();

    const user = await userRepository.findPublicById(db, stored.userId);
    if (!user) throw sessionExpired();

    const rotated = await refreshTokenRepository.revokeIfActive(db, stored.id, 'rotated');
    if (!rotated) {
      throw new AppError(409, 'REFRESH_CONFLICT', 'Session was refreshed by another request. Retry once.');
    }
    return issueSession(toUser(user), stored.familyId);
  },

  /** Idempotent: logging out with a missing or already-revoked token still succeeds. */
  async logout(presentedToken: string | undefined): Promise<void> {
    if (!presentedToken) return;
    const stored = await refreshTokenRepository.findByHash(db, hashToken(presentedToken));
    if (!stored) return;
    await refreshTokenRepository.revokeFamily(db, stored.familyId, 'logout');
    if (!stored.revokedAt) {
      await auditRepository.record(db, { userId: stored.userId, action: 'LOGOUT', entityType: 'USER', entityId: stored.userId });
    }
  },

  async logoutAll(userId: string): Promise<void> {
    await refreshTokenRepository.revokeAllForUser(db, userId, 'logout_all');
    // "Sign out everywhere" also stops reminders to every phone that was signed in.
    await notificationRepository.deleteAllForUser(db, userId);
    await auditRepository.record(db, { userId, action: 'LOGOUT_ALL', entityType: 'USER', entityId: userId });
  },

  async me(userId: string): Promise<User> {
    const user = await userRepository.findPublicById(db, userId);
    // A valid token for a user that no longer exists is treated as an invalid session.
    if (!user) throw new AppError(401, 'INVALID_TOKEN', 'Account not found');
    return toUser(user);
  },
};
