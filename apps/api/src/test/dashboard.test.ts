import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { buildOpenApiDocument } from '../docs/openapi.js';
import { createProject, createTask, createTestApp, registerUser, useCleanDatabase } from './helpers.js';

useCleanDatabase();
const app = createTestApp();

describe('GET /api/dashboard', () => {
  it('returns zeros for a new user', async () => {
    const user = await registerUser(app);
    const res = await request(app).get('/api/dashboard').set(user.auth).expect(200);
    expect(res.body.data).toMatchObject({
      totalProjects: 0,
      totalTasks: 0,
      completedTasks: 0,
      pendingTasks: 0,
      projectsInProgress: 0,
      recentProjects: [],
      upcomingTasks: [],
    });
  });

  it('computes statistics from the user’s data and updates after changes', async () => {
    const user = await registerUser(app);
    const a = await createProject(app, user, { status: 'IN_PROGRESS' });
    const b = await createProject(app, user, { status: 'IN_PROGRESS' });
    await createProject(app, user, { status: 'COMPLETED' });
    await createTask(app, user, a.id, { status: 'COMPLETED', priority: 'HIGH' });
    await createTask(app, user, a.id, { status: 'PENDING', dueDate: '2026-10-01' }); // overdue relative to "today" below
    const later = await createTask(app, user, b.id, { status: 'IN_PROGRESS', dueDate: '2026-10-20' });
    await createTask(app, user, b.id, { status: 'PENDING', priority: 'LOW' });

    const res = await request(app).get('/api/dashboard').query({ today: '2026-10-07' }).set(user.auth).expect(200);
    expect(res.body.data).toMatchObject({
      totalProjects: 3,
      totalTasks: 4,
      completedTasks: 1,
      pendingTasks: 2,
      inProgressTasks: 1,
      projectsInProgress: 2,
      overdueTasks: 1,
      projectStatusDistribution: { NOT_STARTED: 0, IN_PROGRESS: 2, COMPLETED: 1 },
      taskStatusDistribution: { PENDING: 2, IN_PROGRESS: 1, COMPLETED: 1 },
      taskPriorityDistribution: { LOW: 1, MEDIUM: 2, HIGH: 1 },
    });
    // Upcoming: open tasks with a due date, soonest first; completed tasks are excluded.
    expect(res.body.data.upcomingTasks.map((t: { dueDate: string }) => t.dueDate)).toEqual(['2026-10-01', '2026-10-20']);

    await request(app).patch(`/api/tasks/${later.id}`).set(user.auth).send({ status: 'COMPLETED' }).expect(200);
    const after = await request(app).get('/api/dashboard').query({ today: '2026-10-07' }).set(user.auth).expect(200);
    expect(after.body.data).toMatchObject({ completedTasks: 2, inProgressTasks: 0 });
  });

  it('rejects an invalid today parameter', async () => {
    const user = await registerUser(app);
    await request(app).get('/api/dashboard').query({ today: 'yesterday' }).set(user.auth).expect(400);
  });
});

describe('GET /api/activity (audit log)', () => {
  it('records actions without sensitive data', async () => {
    const user = await registerUser(app);
    const project = await createProject(app, user, { name: 'Audited' });
    const task = await createTask(app, user, project.id, { name: 'Audited task' });
    await request(app).delete(`/api/tasks/${task.id}`).set(user.auth).expect(204);

    const res = await request(app).get('/api/activity').set(user.auth).expect(200);
    expect(res.body.data.map((e: { action: string }) => e.action)).toEqual(['TASK_DELETED', 'TASK_CREATED', 'PROJECT_CREATED', 'USER_REGISTERED']);
    expect(JSON.stringify(res.body)).not.toMatch(/password|token/i);
  });
});

describe('platform behaviour', () => {
  it('reports health including the database', async () => {
    const res = await request(app).get('/api/health').expect(200);
    expect(res.body.data).toMatchObject({ status: 'ok', database: 'up' });
  });

  it('returns a JSON 404 for unknown routes', async () => {
    const res = await request(app).get('/api/nope').expect(404);
    expect(res.body).toMatchObject({ success: false, error: { code: 'NOT_FOUND' } });
  });

  it('sets security headers and hides the framework', async () => {
    const res = await request(app).get('/api/health');
    expect(res.headers['x-powered-by']).toBeUndefined();
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-request-id']).toEqual(expect.any(String));
  });

  it('allows the web origin and blocks other origins (CORS)', async () => {
    const allowed = await request(app).options('/api/projects').set('Origin', 'http://localhost:5173').set('Access-Control-Request-Method', 'GET');
    expect(allowed.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    expect(allowed.headers['access-control-allow-credentials']).toBe('true');
    const blocked = await request(app).options('/api/projects').set('Origin', 'https://evil.example').set('Access-Control-Request-Method', 'GET');
    expect(blocked.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('documents every endpoint required by the assignment', () => {
    const doc = buildOpenApiDocument();
    const required = {
      '/api/auth/register': ['post'],
      '/api/auth/login': ['post'],
      '/api/auth/logout': ['post'],
      '/api/auth/me': ['get'],
      '/api/projects': ['get', 'post'],
      '/api/projects/{id}': ['get', 'put', 'delete'],
      '/api/tasks': ['get', 'post'],
      '/api/tasks/{id}': ['get', 'put', 'delete'],
      '/api/dashboard': ['get'],
    };
    for (const [path, methods] of Object.entries(required)) {
      for (const method of methods) {
        expect((doc.paths as Record<string, Record<string, unknown>>)[path]?.[method], `${method.toUpperCase()} ${path}`).toBeDefined();
      }
    }
  });
});
