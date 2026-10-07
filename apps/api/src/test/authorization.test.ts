import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createProject, createTask, createTestApp, registerUser, useCleanDatabase, type TestUser } from './helpers.js';

/**
 * The core security property of the assignment: users can only see and change their own data.
 * User A owns a project and a task; user B attacks them directly by ID.
 * Every attempt must fail with 404 (not 403, so B cannot even confirm the IDs exist),
 * and A's data must be unchanged afterwards.
 */
useCleanDatabase();
const app = createTestApp();

let alice: TestUser;
let bob: TestUser;
let aliceProject: { id: string };
let aliceTask: { id: string };
let bobProject: { id: string };

beforeEach(async () => {
  alice = await registerUser(app, 'Alice');
  bob = await registerUser(app, 'Bob');
  aliceProject = await createProject(app, alice, { name: 'Alice secret project' });
  aliceTask = await createTask(app, alice, aliceProject.id, { name: 'Alice secret task' });
  bobProject = await createProject(app, bob, { name: 'Bob project' });
});

const expectNotFound = (res: request.Response) => {
  expect(res.status).toBe(404);
  expect(res.body.error.code).toBe('NOT_FOUND');
  expect(JSON.stringify(res.body)).not.toContain('Alice');
};

describe("another user's project", () => {
  it('cannot be read', async () => {
    expectNotFound(await request(app).get(`/api/projects/${aliceProject.id}`).set(bob.auth));
  });

  it('cannot be replaced with PUT', async () => {
    expectNotFound(
      await request(app).put(`/api/projects/${aliceProject.id}`).set(bob.auth).send({ name: 'Hacked', startDate: '2026-10-01' }),
    );
  });

  it('cannot be modified with PATCH', async () => {
    expectNotFound(await request(app).patch(`/api/projects/${aliceProject.id}`).set(bob.auth).send({ status: 'COMPLETED' }));
  });

  it('cannot be deleted', async () => {
    expectNotFound(await request(app).delete(`/api/projects/${aliceProject.id}`).set(bob.auth));
  });

  it('never appears in list results, even when searched for by name', async () => {
    const res = await request(app).get('/api/projects').query({ search: 'Alice' }).set(bob.auth).expect(200);
    expect(res.body.data).toEqual([]);
    expect(res.body.meta.total).toBe(0);
  });

  it('cannot be used to list its tasks', async () => {
    expectNotFound(await request(app).get('/api/tasks').query({ projectId: aliceProject.id }).set(bob.auth));
  });

  it('cannot receive tasks created by another user', async () => {
    expectNotFound(await request(app).post('/api/tasks').set(bob.auth).send({ projectId: aliceProject.id, name: 'Injected' }));
  });

  it('is unchanged after all of the attacks above', async () => {
    await request(app).put(`/api/projects/${aliceProject.id}`).set(bob.auth).send({ name: 'Hacked', startDate: '2026-10-01' });
    await request(app).patch(`/api/projects/${aliceProject.id}`).set(bob.auth).send({ status: 'COMPLETED' });
    await request(app).delete(`/api/projects/${aliceProject.id}`).set(bob.auth);
    await request(app).post('/api/tasks').set(bob.auth).send({ projectId: aliceProject.id, name: 'Injected' });

    const res = await request(app).get(`/api/projects/${aliceProject.id}`).set(alice.auth).expect(200);
    expect(res.body.data).toMatchObject({ name: 'Alice secret project', status: 'NOT_STARTED', taskCount: 1 });
  });
});

describe("another user's task", () => {
  it('cannot be read', async () => {
    expectNotFound(await request(app).get(`/api/tasks/${aliceTask.id}`).set(bob.auth));
  });

  it('cannot be replaced with PUT', async () => {
    expectNotFound(
      await request(app).put(`/api/tasks/${aliceTask.id}`).set(bob.auth).send({ projectId: bobProject.id, name: 'Stolen' }),
    );
  });

  it('cannot be marked completed with PATCH', async () => {
    expectNotFound(await request(app).patch(`/api/tasks/${aliceTask.id}`).set(bob.auth).send({ status: 'COMPLETED' }));
  });

  it('cannot be deleted', async () => {
    expectNotFound(await request(app).delete(`/api/tasks/${aliceTask.id}`).set(bob.auth));
  });

  it('never appears in list results', async () => {
    const res = await request(app).get('/api/tasks').query({ search: 'secret' }).set(bob.auth).expect(200);
    expect(res.body.data).toEqual([]);
  });

  it('is unchanged after the attacks above', async () => {
    await request(app).patch(`/api/tasks/${aliceTask.id}`).set(bob.auth).send({ status: 'COMPLETED' });
    await request(app).delete(`/api/tasks/${aliceTask.id}`).set(bob.auth);
    const res = await request(app).get(`/api/tasks/${aliceTask.id}`).set(alice.auth).expect(200);
    expect(res.body.data).toMatchObject({ name: 'Alice secret task', status: 'PENDING' });
  });
});

describe('moving tasks between projects', () => {
  it("a user cannot move their own task into another user's project", async () => {
    const bobTask = await createTask(app, bob, bobProject.id);
    expectNotFound(await request(app).patch(`/api/tasks/${bobTask.id}`).set(bob.auth).send({ projectId: aliceProject.id }));
    const res = await request(app).get(`/api/tasks/${bobTask.id}`).set(bob.auth).expect(200);
    expect(res.body.data.projectId).toBe(bobProject.id);
  });
});

describe('dashboard isolation', () => {
  it("counts only the caller's own projects and tasks", async () => {
    const res = await request(app).get('/api/dashboard').set(bob.auth).expect(200);
    expect(res.body.data).toMatchObject({ totalProjects: 1, totalTasks: 0 });
    expect(res.body.data.recentProjects.map((p: { name: string }) => p.name)).toEqual(['Bob project']);
  });
});

describe('protected routes', () => {
  it.each([
    ['get', '/api/projects'],
    ['post', '/api/projects'],
    ['get', '/api/tasks'],
    ['post', '/api/tasks'],
    ['get', '/api/dashboard'],
    ['get', '/api/activity'],
  ] as const)('%s %s requires authentication', async (method, path) => {
    const res = await request(app)[method](path).expect(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });
});
