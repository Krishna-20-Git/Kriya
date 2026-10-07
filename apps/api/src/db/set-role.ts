/**
 * Grants or removes the admin role from the command line — the way to create the first admin
 * on a fresh production database, where nobody can use the admin screen yet.
 *
 *   npm run user:role -w @pms/api -- someone@example.com ADMIN
 *   npm run user:role -w @pms/api -- someone@example.com USER
 */
import { USER_ROLES, type UserRole } from '@pms/shared';
import { eq, sql } from 'drizzle-orm';
import { db, pool } from './client.js';
import { auditLogs, users } from './schema.js';

async function main() {
  const [email, roleArg = 'ADMIN'] = process.argv.slice(2);
  const role = roleArg.toUpperCase() as UserRole;
  if (!email || !USER_ROLES.includes(role)) {
    console.error('Usage: npm run user:role -w @pms/api -- <email> <USER|ADMIN>');
    process.exitCode = 1;
    return;
  }
  const [user] = await db.select({ id: users.id, role: users.role }).from(users).where(sql`lower(${users.email}) = ${email.toLowerCase()}`);
  if (!user) {
    console.error(`No account with email ${email}.`);
    process.exitCode = 1;
    return;
  }
  if (user.role === role) {
    console.log(`${email} is already ${role}.`);
    return;
  }
  await db.transaction(async (tx) => {
    await tx.update(users).set({ role }).where(eq(users.id, user.id));
    // Recorded against the account itself, since the change came from the server console, not an admin.
    await tx.insert(auditLogs).values({ userId: user.id, action: 'ROLE_CHANGED', entityType: 'USER', entityId: user.id, entityName: `${email}: ${user.role} → ${role} (console)` });
  });
  console.log(`${email}: ${user.role} → ${role}`);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
