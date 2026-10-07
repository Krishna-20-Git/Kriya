import { and, eq, isNull } from 'drizzle-orm';
import type { Executor } from '../db/client.js';
import { refreshTokens } from '../db/schema.js';

export type RevokeReason = 'rotated' | 'logout' | 'logout_all' | 'reuse_detected';

export const refreshTokenRepository = {
  create: async (
    db: Executor,
    data: { userId: string; tokenHash: string; familyId: string; expiresAt: Date },
  ) => {
    await db.insert(refreshTokens).values(data);
  },

  findByHash: async (db: Executor, tokenHash: string) => {
    const [row] = await db.select().from(refreshTokens).where(eq(refreshTokens.tokenHash, tokenHash)).limit(1);
    return row ?? null;
  },

  /**
   * Revokes one token only if it is still active. Returns false when another request
   * already rotated it — this conditional update is what makes rotation race-safe.
   */
  revokeIfActive: async (db: Executor, id: string, reason: RevokeReason) => {
    const rows = await db
      .update(refreshTokens)
      .set({ revokedAt: new Date(), revokedReason: reason })
      .where(and(eq(refreshTokens.id, id), isNull(refreshTokens.revokedAt)))
      .returning({ id: refreshTokens.id });
    return rows.length > 0;
  },

  revokeFamily: async (db: Executor, familyId: string, reason: RevokeReason) => {
    await db
      .update(refreshTokens)
      .set({ revokedAt: new Date(), revokedReason: reason })
      .where(and(eq(refreshTokens.familyId, familyId), isNull(refreshTokens.revokedAt)));
  },

  revokeAllForUser: async (db: Executor, userId: string, reason: RevokeReason) => {
    await db
      .update(refreshTokens)
      .set({ revokedAt: new Date(), revokedReason: reason })
      .where(and(eq(refreshTokens.userId, userId), isNull(refreshTokens.revokedAt)));
  },
};
