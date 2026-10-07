import type { UserRole } from '@pms/shared';
import { eq, sql } from 'drizzle-orm';
import type { Executor } from '../db/client.js';
import { users } from '../db/schema.js';

const publicColumns = { id: users.id, fullName: users.fullName, email: users.email, role: users.role, createdAt: users.createdAt };

export const userRepository = {
  /** The role is read from the database on every admin request, so a demotion takes effect immediately. */
  findRole: async (db: Executor, id: string): Promise<UserRole | null> => {
    const [row] = await db.select({ role: users.role }).from(users).where(eq(users.id, id)).limit(1);
    return row?.role ?? null;
  },

  findByEmail: async (db: Executor, email: string) => {
    const [user] = await db
      .select()
      .from(users)
      .where(sql`lower(${users.email}) = ${email.toLowerCase()}`)
      .limit(1);
    return user ?? null;
  },

  /** Never selects password_hash: callers that only need the profile cannot leak it. */
  findPublicById: async (db: Executor, id: string) => {
    const [user] = await db
      .select(publicColumns)
      .from(users)
      .where(eq(users.id, id))
      .limit(1);
    return user ?? null;
  },

  create: async (db: Executor, data: { fullName: string; email: string; passwordHash: string }) => {
    const [user] = await db
      .insert(users)
      .values(data)
      .returning(publicColumns);
    if (!user) throw new Error('Insert into users returned no row');
    return user;
  },
};
