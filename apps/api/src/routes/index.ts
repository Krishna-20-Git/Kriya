import { sql } from 'drizzle-orm';
import { Router } from 'express';
import { adminController } from '../controllers/admin.controller.js';
import { authController } from '../controllers/auth.controller.js';
import { activityController, dashboardController } from '../controllers/dashboard.controller.js';
import { notificationController } from '../controllers/notification.controller.js';
import { projectController } from '../controllers/project.controller.js';
import { taskController } from '../controllers/task.controller.js';
import { db } from '../db/client.js';
import { authMiddleware } from '../middleware/auth.middleware.js';
import type { RateLimiters } from '../middleware/rate-limit.middleware.js';
import { requireRole } from '../middleware/role.middleware.js';
import { trustedOriginMiddleware } from '../middleware/trusted-origin.middleware.js';

/** Routes are declarative: path → middleware → controller. No logic lives here. */
export function createApiRouter(limits: RateLimiters): Router {
  const api = Router();

  api.get('/health', async (_req, res) => {
    await db.execute(sql`select 1`);
    res.json({ success: true, data: { status: 'ok', database: 'up', time: new Date().toISOString() } });
  });

  const auth = Router();
  auth.post('/register', limits.register, authController.register);
  auth.post('/login', limits.login, limits.loginPerAccount, authController.login);
  auth.post('/refresh', limits.refresh, trustedOriginMiddleware, authController.refresh);
  auth.post('/logout', trustedOriginMiddleware, authController.logout);
  auth.post('/logout-all', authMiddleware, authController.logoutAll);
  auth.get('/me', authMiddleware, authController.me);
  api.use('/auth', auth);

  // Everything below requires a valid access token.
  const projects = Router();
  projects.use(authMiddleware);
  projects.get('/', projectController.list);
  projects.post('/', projectController.create);
  projects.get('/:id', projectController.get);
  projects.put('/:id', projectController.replace);
  projects.patch('/:id', projectController.patch);
  projects.delete('/:id', projectController.remove);
  api.use('/projects', projects);

  const tasks = Router();
  tasks.use(authMiddleware);
  tasks.get('/', taskController.list);
  tasks.post('/', taskController.create);
  tasks.get('/:id', taskController.get);
  tasks.put('/:id', taskController.replace);
  tasks.patch('/:id', taskController.patch);
  tasks.delete('/:id', taskController.remove);
  api.use('/tasks', tasks);

  api.get('/dashboard', authMiddleware, dashboardController.get);
  api.get('/activity', authMiddleware, activityController.list);

  // Push reminders: each signed-in phone registers its Expo push token and time zone.
  const notifications = Router();
  notifications.use(authMiddleware);
  notifications.get('/devices', notificationController.list);
  notifications.post('/devices', notificationController.register);
  notifications.delete('/devices', notificationController.unregister);
  notifications.post('/test', notificationController.test);
  api.use('/notifications', notifications);

  // Machine-to-machine: the scheduler that triggers the due-tomorrow job (disabled without CRON_SECRET).
  api.post('/internal/reminders/run', notificationController.runReminders);

  // Admin area: authenticated AND role = ADMIN (checked against the database on every request).
  const admin = Router();
  admin.use(authMiddleware, requireRole('ADMIN'));
  admin.get('/users', adminController.listUsers);
  admin.patch('/users/:id/role', adminController.changeRole);
  admin.get('/audit-logs', adminController.listAuditLogs);
  api.use('/admin', admin);

  return api;
}
