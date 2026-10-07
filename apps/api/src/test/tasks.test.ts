import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createProject, createTask, createTestApp, fieldErrors, registerUser, useCleanDatabase, type TestUser } from './helpers.js';

useCleanDatabase();
const app = createTestApp();
let user: TestUser;
let project: { id: string; name: string };

beforeEach(async () => {
  user = await registerUser(app);
  project = await createProject(app, user, { name: 'Launch' });
});

describe('task CRUD', () => {
  it('creates a task with defaults and its project reference', async () => {
    const res = await request(app)
      .post('/api/tasks')
      .set(user.auth)
      .send({ projectId: project.id, name: 'Write tests', dueDate: '2026-10-20' })
      .expect(201);
    expect(res.body.data).toMatchObject({
      name: 'Write tests',
      priority: 'MEDIUM',
      status: 'PENDING',
      dueDate: '2026-10-20',
      completedAt: null,
      project: { id: project.id, name: 'Launch' },
    });
  });

  it('reads a task', async () => {
    const task = await createTask(app, user, project.id, { name: 'Read me' });
    const res = await request(app).get(`/api/tasks/${task.id}`).set(user.auth).expect(200);
    expect(res.body.data.name).toBe('Read me');
  });

  it('marks a task completed and records completedAt; reopening clears it', async () => {
    const task = await createTask(app, user, project.id);
    const done = await request(app).patch(`/api/tasks/${task.id}`).set(user.auth).send({ status: 'COMPLETED' }).expect(200);
    expect(done.body.data.status).toBe('COMPLETED');
    expect(done.body.data.completedAt).toEqual(expect.any(String));

    const reopened = await request(app).patch(`/api/tasks/${task.id}`).set(user.auth).send({ status: 'IN_PROGRESS' }).expect(200);
    expect(reopened.body.data.completedAt).toBeNull();
  });

  it('changes priority without touching other fields', async () => {
    const task = await createTask(app, user, project.id, { name: 'Keep name', dueDate: '2026-10-09' });
    const res = await request(app).patch(`/api/tasks/${task.id}`).set(user.auth).send({ priority: 'HIGH' }).expect(200);
    expect(res.body.data).toMatchObject({ priority: 'HIGH', name: 'Keep name', dueDate: '2026-10-09' });
  });

  it('replaces a task with PUT and can move it to another owned project', async () => {
    const other = await createProject(app, user, { name: 'Other' });
    const task = await createTask(app, user, project.id, { description: 'old', dueDate: '2026-10-09' });
    const res = await request(app)
      .put(`/api/tasks/${task.id}`)
      .set(user.auth)
      .send({ projectId: other.id, name: 'Moved', priority: 'LOW', status: 'IN_PROGRESS' })
      .expect(200);
    expect(res.body.data).toMatchObject({ name: 'Moved', projectId: other.id, description: '', dueDate: null, project: { name: 'Other' } });
  });

  it('deletes a task', async () => {
    const task = await createTask(app, user, project.id);
    await request(app).delete(`/api/tasks/${task.id}`).set(user.auth).expect(204);
    await request(app).get(`/api/tasks/${task.id}`).set(user.auth).expect(404);
  });

  it('returns 404 when the project does not exist', async () => {
    const res = await request(app)
      .post('/api/tasks')
      .set(user.auth)
      .send({ projectId: '00000000-0000-4000-8000-000000000000', name: 'Orphan' })
      .expect(404);
    expect(res.body.error.message).toBe('Project not found');
  });
});

describe('task validation', () => {
  it.each([
    ['missing name', { name: undefined }, 'name'],
    ['empty name', { name: '' }, 'name'],
    ['invalid priority', { priority: 'URGENT' }, 'priority'],
    ['lower-case enum value', { status: 'completed' }, 'status'],
    ['invalid due date', { dueDate: '2026-13-01' }, 'dueDate'],
    ['oversized description', { description: 'x'.repeat(2001) }, 'description'],
    ['malformed project ID', { projectId: 'abc' }, 'projectId'],
  ])('rejects %s', async (_label, override, field) => {
    const res = await request(app)
      .post('/api/tasks')
      .set(user.auth)
      .send({ projectId: project.id, name: 'Task', ...override })
      .expect(400);
    expect(fieldErrors(res.body)).toContain(field);
  });

  it('rejects a body larger than 100 KB with 413', async () => {
    const res = await request(app)
      .post('/api/tasks')
      .set(user.auth)
      .send({ projectId: project.id, name: 'Big', description: 'x'.repeat(150_000) })
      .expect(413);
    expect(res.body.error.code).toBe('PAYLOAD_TOO_LARGE');
  });
});

describe('task search, filters, sorting and pagination', () => {
  beforeEach(async () => {
    const other = await createProject(app, user, { name: 'Other' });
    await createTask(app, user, project.id, { name: 'Fix login bug', priority: 'HIGH', status: 'PENDING', dueDate: '2026-10-10' });
    await createTask(app, user, project.id, { name: 'Login page copy', priority: 'LOW', status: 'COMPLETED', dueDate: '2026-10-05' });
    await createTask(app, user, project.id, { name: 'Release notes', priority: 'MEDIUM', status: 'IN_PROGRESS' });
    await createTask(app, user, other.id, { name: 'Login analytics', priority: 'HIGH', status: 'PENDING', dueDate: '2026-10-07' });
  });

  const names = (res: request.Response) => res.body.data.map((t: { name: string }) => t.name);

  it('searches by name and filters by status and priority together', async () => {
    const res = await request(app)
      .get('/api/tasks')
      .query({ search: 'login', status: 'PENDING', priority: 'HIGH' })
      .set(user.auth)
      .expect(200);
    expect(names(res).sort()).toEqual(['Fix login bug', 'Login analytics']);
  });

  it('filters by project', async () => {
    const res = await request(app).get('/api/tasks').query({ projectId: project.id, search: 'login' }).set(user.auth).expect(200);
    expect(names(res).sort()).toEqual(['Fix login bug', 'Login page copy']);
  });

  it('sorts by priority (by importance, not alphabetically)', async () => {
    const res = await request(app).get('/api/tasks').query({ projectId: project.id, sortBy: 'priority', sortOrder: 'desc' }).set(user.auth).expect(200);
    expect(res.body.data.map((t: { priority: string }) => t.priority)).toEqual(['HIGH', 'MEDIUM', 'LOW']);
  });

  it('sorts by due date with tasks without a due date last', async () => {
    const res = await request(app).get('/api/tasks').query({ sortBy: 'dueDate', sortOrder: 'asc' }).set(user.auth).expect(200);
    expect(names(res)).toEqual(['Login page copy', 'Login analytics', 'Fix login bug', 'Release notes']);
  });

  it('rejects invalid filter values', async () => {
    await request(app).get('/api/tasks').query({ priority: 'URGENT' }).set(user.auth).expect(400);
    await request(app).get('/api/tasks').query({ limit: 0 }).set(user.auth).expect(400);
    await request(app).get('/api/tasks').query({ projectId: 'abc' }).set(user.auth).expect(400);
  });

  it('paginates', async () => {
    const res = await request(app).get('/api/tasks').query({ limit: 3 }).set(user.auth).expect(200);
    expect(res.body.data).toHaveLength(3);
    expect(res.body.meta).toEqual({ page: 1, limit: 3, total: 4, totalPages: 2 });
  });
});
