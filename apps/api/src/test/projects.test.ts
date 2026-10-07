import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createProject, createTask, createTestApp, fieldErrors, registerUser, useCleanDatabase, type TestUser } from './helpers.js';

useCleanDatabase();
const app = createTestApp();
let user: TestUser;

beforeEach(async () => {
  user = await registerUser(app);
});

describe('project CRUD', () => {
  it('creates a project with defaults and returns it', async () => {
    const res = await request(app)
      .post('/api/projects')
      .set(user.auth)
      .send({ name: '  Website redesign ', startDate: '2026-10-01', endDate: '2026-11-15' })
      .expect(201);
    expect(res.body.data).toMatchObject({
      name: 'Website redesign',
      description: '',
      status: 'NOT_STARTED',
      startDate: '2026-10-01',
      endDate: '2026-11-15',
      taskCount: 0,
      completedTaskCount: 0,
    });
    expect(res.body.data).not.toHaveProperty('userId');
  });

  it('reads a project with task progress', async () => {
    const project = await createProject(app, user);
    await createTask(app, user, project.id, { status: 'COMPLETED' });
    await createTask(app, user, project.id);
    const res = await request(app).get(`/api/projects/${project.id}`).set(user.auth).expect(200);
    expect(res.body.data).toMatchObject({ taskCount: 2, completedTaskCount: 1 });
  });

  it('replaces a project with PUT (omitted optional fields reset)', async () => {
    const project = await createProject(app, user, { description: 'Old', endDate: '2026-12-01' });
    const res = await request(app)
      .put(`/api/projects/${project.id}`)
      .set(user.auth)
      .send({ name: 'Renamed', status: 'IN_PROGRESS', startDate: '2026-10-02' })
      .expect(200);
    expect(res.body.data).toMatchObject({ name: 'Renamed', status: 'IN_PROGRESS', description: '', endDate: null });
  });

  it('updates individual fields with PATCH', async () => {
    const project = await createProject(app, user, { description: 'Keep me' });
    const res = await request(app).patch(`/api/projects/${project.id}`).set(user.auth).send({ status: 'COMPLETED' }).expect(200);
    expect(res.body.data).toMatchObject({ status: 'COMPLETED', description: 'Keep me' });
  });

  it('deletes a project and its tasks', async () => {
    const project = await createProject(app, user);
    const task = await createTask(app, user, project.id);
    await request(app).delete(`/api/projects/${project.id}`).set(user.auth).expect(204);
    await request(app).get(`/api/projects/${project.id}`).set(user.auth).expect(404);
    await request(app).get(`/api/tasks/${task.id}`).set(user.auth).expect(404);
  });

  it('returns 404 for a project that does not exist and 400 for a malformed ID', async () => {
    await request(app).get('/api/projects/00000000-0000-4000-8000-000000000000').set(user.auth).expect(404);
    const res = await request(app).get('/api/projects/not-a-uuid').set(user.auth).expect(400);
    expect(fieldErrors(res.body)).toEqual(['id']);
  });
});

describe('project validation', () => {
  it.each([
    ['missing name', { startDate: '2026-10-01' }, 'name'],
    ['blank name', { name: '   ', startDate: '2026-10-01' }, 'name'],
    ['oversized name', { name: 'x'.repeat(121), startDate: '2026-10-01' }, 'name'],
    ['invalid status', { name: 'P', startDate: '2026-10-01', status: 'DONE' }, 'status'],
    ['missing start date', { name: 'P' }, 'startDate'],
    ['impossible date', { name: 'P', startDate: '2026-02-30' }, 'startDate'],
    ['wrong date format', { name: 'P', startDate: '01/10/2026' }, 'startDate'],
    ['end before start', { name: 'P', startDate: '2026-10-10', endDate: '2026-10-01' }, 'endDate'],
    ['unknown field', { name: 'P', startDate: '2026-10-01', userId: '00000000-0000-4000-8000-000000000000' }, '(root)'],
  ])('rejects %s', async (_label, body, field) => {
    const res = await request(app).post('/api/projects').set(user.auth).send(body).expect(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(fieldErrors(res.body)).toContain(field);
  });

  it('validates PATCH dates against the stored values', async () => {
    const project = await createProject(app, user, { startDate: '2026-10-10' });
    const res = await request(app).patch(`/api/projects/${project.id}`).set(user.auth).send({ endDate: '2026-10-01' }).expect(400);
    expect(fieldErrors(res.body)).toEqual(['endDate']);
  });

  it('rejects an empty PATCH body', async () => {
    const project = await createProject(app, user);
    await request(app).patch(`/api/projects/${project.id}`).set(user.auth).send({}).expect(400);
  });

  it('rejects malformed JSON with 400', async () => {
    const res = await request(app)
      .post('/api/projects')
      .set(user.auth)
      .set('Content-Type', 'application/json')
      .send('{"name": ')
      .expect(400);
    expect(res.body.error.message).toBe('Request body is not valid JSON');
  });
});

describe('project search, filters, sorting and pagination', () => {
  beforeEach(async () => {
    await createProject(app, user, { name: 'Website redesign', status: 'IN_PROGRESS', startDate: '2026-10-03' });
    await createProject(app, user, { name: 'Mobile app', status: 'IN_PROGRESS', startDate: '2026-10-01' });
    await createProject(app, user, { name: 'Website copy', status: 'COMPLETED', startDate: '2026-10-02' });
    await createProject(app, user, { name: '100% coverage', status: 'NOT_STARTED', startDate: '2026-10-04' });
  });

  const names = (res: request.Response) => res.body.data.map((p: { name: string }) => p.name);

  it('searches by name, case-insensitively', async () => {
    const res = await request(app).get('/api/projects').query({ search: 'WEBSITE' }).set(user.auth).expect(200);
    expect(names(res).sort()).toEqual(['Website copy', 'Website redesign']);
  });

  it('treats LIKE wildcards in the search as literal characters', async () => {
    const res = await request(app).get('/api/projects').query({ search: '%' }).set(user.auth).expect(200);
    expect(names(res)).toEqual(['100% coverage']);
  });

  it('filters by status and combines with search', async () => {
    const res = await request(app).get('/api/projects').query({ status: 'IN_PROGRESS', search: 'web' }).set(user.auth).expect(200);
    expect(names(res)).toEqual(['Website redesign']);
  });

  it('sorts by a whitelisted field', async () => {
    const res = await request(app).get('/api/projects').query({ sortBy: 'startDate', sortOrder: 'asc' }).set(user.auth).expect(200);
    expect(names(res)).toEqual(['Mobile app', 'Website copy', 'Website redesign', '100% coverage']);
  });

  it('rejects a sort field that is not whitelisted', async () => {
    await request(app).get('/api/projects').query({ sortBy: 'user_id' }).set(user.auth).expect(400);
    await request(app).get('/api/projects').query({ status: 'DONE' }).set(user.auth).expect(400);
  });

  it('paginates with total counts', async () => {
    const res = await request(app).get('/api/projects').query({ limit: 3, page: 2, sortBy: 'name', sortOrder: 'asc' }).set(user.auth).expect(200);
    expect(res.body.meta).toEqual({ page: 2, limit: 3, total: 4, totalPages: 2 });
    expect(names(res)).toEqual(['Website redesign']);
  });
});
