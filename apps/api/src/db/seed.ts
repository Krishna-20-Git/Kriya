/**
 * Seeds a demo account with realistic, entirely fictional data.
 * Dates are relative to today so the dashboard always shows a mix of overdue,
 * due-soon and completed work, no matter when the seed is run.
 *
 * Re-runnable: the demo user (and, by cascade, their projects and tasks) is deleted first.
 * Other accounts are never touched.
 *
 *   Email:    demo@example.com
 *   Password: Demo@12345        (test credentials — documented in the README)
 *
 * Also creates an admin account for demonstrating role-based access control:
 *   Email:    admin@example.com
 *   Password: SEED_ADMIN_PASSWORD if set; otherwise Admin@12345, but ONLY for a local database.
 * A hosted database never gets the publicly documented admin password: without
 * SEED_ADMIN_PASSWORD the admin account is simply not created there.
 */
import { passwordSchema, type ProjectStatus, type TaskPriority, type TaskStatus } from '@pms/shared';
import { sql } from 'drizzle-orm';
import { hashPassword } from '../utils/password.js';
import { db, pool } from './client.js';
import { auditLogs, projects, tasks, users } from './schema.js';

export const DEMO_EMAIL = 'demo@example.com';
export const DEMO_PASSWORD = 'Demo@12345';
export const ADMIN_EMAIL = 'admin@example.com';
export const LOCAL_ADMIN_PASSWORD = 'Admin@12345';

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]', 'db']);
const isLocalDatabase = () => {
  try {
    return LOCAL_HOSTS.has(new URL(process.env.DATABASE_URL ?? '').hostname);
  } catch {
    return false;
  }
};

/** The admin password to seed, or null to skip the admin account (hosted DB without an explicit password). */
function adminPassword(): string | null {
  const explicit = process.env.SEED_ADMIN_PASSWORD;
  if (explicit) {
    const check = passwordSchema.safeParse(explicit);
    if (!check.success) throw new Error(`SEED_ADMIN_PASSWORD is too weak: ${check.error.issues[0]?.message}`);
    return explicit;
  }
  return isLocalDatabase() ? LOCAL_ADMIN_PASSWORD : null;
}

const day = (offset: number) => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
};

interface SeedTask {
  name: string;
  description?: string;
  priority: TaskPriority;
  status: TaskStatus;
  due: number | null;
}

interface SeedProject {
  name: string;
  description: string;
  status: ProjectStatus;
  start: number;
  end: number | null;
  tasks: SeedTask[];
}

const DATA: SeedProject[] = [
  {
    name: 'Website Redesign',
    description: 'Refresh the marketing site with the new brand guidelines and improve page speed.',
    status: 'IN_PROGRESS',
    start: -21,
    end: 24,
    tasks: [
      { name: 'Audit current site analytics', priority: 'MEDIUM', status: 'COMPLETED', due: -14 },
      {
        name: 'Design new homepage layout',
        description: 'Desktop and mobile variants, reviewed with marketing.',
        priority: 'HIGH',
        status: 'COMPLETED',
        due: -6,
      },
      { name: 'Build pricing page', priority: 'HIGH', status: 'IN_PROGRESS', due: 2 },
      { name: 'Write copy for features section', priority: 'MEDIUM', status: 'PENDING', due: 5 },
      { name: 'Optimise images and fonts', priority: 'LOW', status: 'PENDING', due: 12 },
      { name: 'Set up redirects for old URLs', priority: 'HIGH', status: 'PENDING', due: -1 },
    ],
  },
  {
    name: 'Mobile App Launch',
    description: 'Prepare the Android release: store listing, QA pass and launch checklist.',
    status: 'IN_PROGRESS',
    start: -10,
    end: 30,
    tasks: [
      { name: 'Prepare Play Store screenshots', priority: 'MEDIUM', status: 'IN_PROGRESS', due: 4 },
      { name: 'Run regression test pass', priority: 'HIGH', status: 'PENDING', due: 1 },
      { name: 'Write release notes', priority: 'LOW', status: 'PENDING', due: 9 },
      { name: 'Configure crash reporting', priority: 'HIGH', status: 'COMPLETED', due: -3 },
    ],
  },
  {
    name: 'Q4 Customer Research',
    description: 'Interview existing customers about onboarding and summarise the findings.',
    status: 'NOT_STARTED',
    start: 7,
    end: 45,
    tasks: [
      { name: 'Draft interview guide', priority: 'MEDIUM', status: 'PENDING', due: 10 },
      { name: 'Recruit 8 participants', priority: 'MEDIUM', status: 'PENDING', due: 14 },
    ],
  },
  {
    name: 'Internal Wiki Migration',
    description: 'Move team documentation from the old wiki to the new knowledge base.',
    status: 'COMPLETED',
    start: -60,
    end: -15,
    tasks: [
      { name: 'Export pages from old wiki', priority: 'LOW', status: 'COMPLETED', due: -40 },
      { name: 'Restructure page hierarchy', priority: 'MEDIUM', status: 'COMPLETED', due: -30 },
      { name: 'Announce the new wiki to the team', priority: 'LOW', status: 'COMPLETED', due: -16 },
    ],
  },
];

export async function seed() {
  const passwordHash = await hashPassword(DEMO_PASSWORD);

  await db.transaction(async (tx) => {
    await tx.delete(users).where(sql`lower(${users.email}) = ${DEMO_EMAIL}`);
    const [user] = await tx.insert(users).values({ fullName: 'Demo User', email: DEMO_EMAIL, passwordHash }).returning({ id: users.id });
    if (!user) throw new Error('Failed to create demo user');

    for (const [index, p] of DATA.entries()) {
      const createdAt = new Date(Date.now() - (DATA.length - index) * 3_600_000);
      const [project] = await tx
        .insert(projects)
        .values({
          userId: user.id,
          name: p.name,
          description: p.description,
          status: p.status,
          startDate: day(p.start),
          endDate: p.end === null ? null : day(p.end),
          createdAt,
          updatedAt: createdAt,
        })
        .returning({ id: projects.id });
      if (!project) throw new Error('Failed to create project');

      await tx.insert(tasks).values(
        p.tasks.map((t, taskIndex) => ({
          projectId: project.id,
          createdAt: new Date(createdAt.getTime() + (taskIndex + 1) * 600_000),
          name: t.name,
          description: t.description ?? '',
          priority: t.priority,
          status: t.status,
          dueDate: t.due === null ? null : day(t.due),
          completedAt: t.status === 'COMPLETED' ? new Date() : null,
        })),
      );
      await tx.insert(auditLogs).values({
        userId: user.id,
        action: 'PROJECT_CREATED',
        entityType: 'PROJECT',
        entityId: project.id,
        entityName: p.name,
        createdAt,
      });
    }
  });

  const password = adminPassword();
  if (!password) {
    console.log(`Skipped ${ADMIN_EMAIL}: this is not a local database. Set SEED_ADMIN_PASSWORD to create it with a private password.`);
  } else {
    const adminHash = await hashPassword(password);
    await db.transaction(async (tx) => {
      await tx.delete(users).where(sql`lower(${users.email}) = ${ADMIN_EMAIL}`);
      const [admin] = await tx
        .insert(users)
        .values({ fullName: 'Admin User', email: ADMIN_EMAIL, passwordHash: adminHash, role: 'ADMIN' })
        .returning({ id: users.id });
      if (!admin) throw new Error('Failed to create admin user');
      await tx.insert(auditLogs).values({ userId: admin.id, action: 'USER_REGISTERED', entityType: 'USER', entityId: admin.id });
    });
    const shown = password === LOCAL_ADMIN_PASSWORD ? password : '(SEED_ADMIN_PASSWORD)';
    console.log(`Seeded ${ADMIN_EMAIL} / ${shown} (role ADMIN).`);
  }

  const taskCount = DATA.reduce((n, p) => n + p.tasks.length, 0);
  console.log(`Seeded ${DEMO_EMAIL} / ${DEMO_PASSWORD} with ${DATA.length} projects and ${taskCount} tasks.`);
}

seed()
  .then(() => pool.end())
  .catch(async (error: unknown) => {
    console.error('Seed failed:', error);
    await pool.end();
    process.exit(1);
  });
