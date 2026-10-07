import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createProject, createTask, createTestApp, makeAdmin, registerUser, useCleanDatabase } from './helpers.js';

const app = createTestApp();
useCleanDatabase();

describe('role-based access control', () => {
  it('registers everyone as USER and returns the role on the session and /me', async () => {
    const user = await registerUser(app);
    const me = await request(app).get('/api/auth/me').set(user.auth).expect(200);
    expect(me.body.data.role).toBe('USER');
  });

  it('ignores a role sent at registration (strict body)', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ fullName: 'Mallory', email: 'mallory@example.com', password: 'Passw0rd!', role: 'ADMIN' })
      .expect(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it.each([
    ['get', '/api/admin/users'],
    ['get', '/api/admin/audit-logs'],
    ['patch', '/api/admin/users/00000000-0000-4000-8000-000000000000/role'],
  ] as const)('returns 403 to a regular user for %s %s', async (method, path) => {
    const user = await registerUser(app);
    const res = await request(app)[method](path).set(user.auth).send({ role: 'ADMIN' }).expect(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('returns 401 without a token', async () => {
    await request(app).get('/api/admin/users').expect(401);
  });

  it('applies a promotion immediately, without a new token', async () => {
    const user = await registerUser(app);
    await request(app).get('/api/admin/users').set(user.auth).expect(403);
    await makeAdmin(user);
    await request(app).get('/api/admin/users').set(user.auth).expect(200);
  });
});

describe('GET /api/admin/users', () => {
  it('lists accounts with counts but no project or task contents', async () => {
    const admin = await registerUser(app, 'Ada Admin');
    await makeAdmin(admin);
    const user = await registerUser(app, 'Uma User');
    const project = await createProject(app, user, { name: 'Secret plans' });
    await createTask(app, user, project.id);
    await createTask(app, user, project.id);

    const res = await request(app).get('/api/admin/users').set(admin.auth).expect(200);
    expect(res.body.meta.total).toBe(2);
    const row = res.body.data.find((u: { id: string }) => u.id === user.id);
    expect(row).toMatchObject({ fullName: 'Uma User', role: 'USER', projectCount: 1, taskCount: 2 });
    expect(row.lastActiveAt).toEqual(expect.any(String));
    expect(JSON.stringify(res.body)).not.toContain('Secret plans');
    expect(JSON.stringify(res.body)).not.toContain('passwordHash');
  });

  it('filters by role and searches by name or email', async () => {
    const admin = await registerUser(app, 'Ada Admin');
    await makeAdmin(admin);
    await registerUser(app, 'Zed Person');

    const admins = await request(app).get('/api/admin/users?role=ADMIN').set(admin.auth).expect(200);
    expect(admins.body.data.map((u: { id: string }) => u.id)).toEqual([admin.id]);

    const search = await request(app).get('/api/admin/users?search=zed').set(admin.auth).expect(200);
    expect(search.body.data).toHaveLength(1);
    expect(search.body.data[0].fullName).toBe('Zed Person');
  });

  it('still cannot read another user’s projects through the normal endpoints', async () => {
    const admin = await registerUser(app);
    await makeAdmin(admin);
    const user = await registerUser(app);
    const project = await createProject(app, user);
    await request(app).get(`/api/projects/${project.id}`).set(admin.auth).expect(404);
  });
});

describe('PATCH /api/admin/users/:id/role', () => {
  it('promotes and demotes, recording who did it in the audit log', async () => {
    const admin = await registerUser(app);
    await makeAdmin(admin);
    const user = await registerUser(app);

    const promoted = await request(app).patch(`/api/admin/users/${user.id}/role`).set(admin.auth).send({ role: 'ADMIN' }).expect(200);
    expect(promoted.body.data.role).toBe('ADMIN');
    // The promoted user can use the admin area straight away.
    await request(app).get('/api/admin/users').set(user.auth).expect(200);

    await request(app).patch(`/api/admin/users/${user.id}/role`).set(admin.auth).send({ role: 'USER' }).expect(200);
    await request(app).get('/api/admin/users').set(user.auth).expect(403);

    const logs = await request(app).get('/api/admin/audit-logs?action=ROLE_CHANGED').set(admin.auth).expect(200);
    expect(logs.body.data).toHaveLength(2);
    expect(logs.body.data[0]).toMatchObject({ action: 'ROLE_CHANGED', entityId: user.id, actor: { id: admin.id } });
    expect(logs.body.data[0].entityName).toContain('ADMIN → USER');
  });

  it('does not let an admin remove their own admin role', async () => {
    const admin = await registerUser(app);
    await makeAdmin(admin);
    const other = await registerUser(app);
    await makeAdmin(other);
    const res = await request(app).patch(`/api/admin/users/${admin.id}/role`).set(admin.auth).send({ role: 'USER' }).expect(409);
    expect(res.body.error.code).toBe('ROLE_CHANGE_NOT_ALLOWED');
  });

  it('never leaves the system without an admin', async () => {
    const a = await registerUser(app);
    const b = await registerUser(app);
    await makeAdmin(a);
    await makeAdmin(b);
    await request(app).patch(`/api/admin/users/${b.id}/role`).set(a.auth).send({ role: 'USER' }).expect(200);
    // b is no longer an admin, so a is the last one — and cannot demote themselves either.
    await request(app).patch(`/api/admin/users/${a.id}/role`).set(a.auth).send({ role: 'USER' }).expect(409);
  });

  it('validates the role and the id, and 404s for unknown users', async () => {
    const admin = await registerUser(app);
    await makeAdmin(admin);
    await request(app).patch(`/api/admin/users/${admin.id}/role`).set(admin.auth).send({ role: 'OWNER' }).expect(400);
    await request(app).patch('/api/admin/users/not-a-uuid/role').set(admin.auth).send({ role: 'USER' }).expect(400);
    await request(app).patch('/api/admin/users/00000000-0000-4000-8000-000000000000/role').set(admin.auth).send({ role: 'USER' }).expect(404);
  });

  it('is a no-op (and not logged) when the role is unchanged', async () => {
    const admin = await registerUser(app);
    await makeAdmin(admin);
    const user = await registerUser(app);
    await request(app).patch(`/api/admin/users/${user.id}/role`).set(admin.auth).send({ role: 'USER' }).expect(200);
    const logs = await request(app).get('/api/admin/audit-logs?action=ROLE_CHANGED').set(admin.auth).expect(200);
    expect(logs.body.data).toHaveLength(0);
  });
});

describe('GET /api/admin/audit-logs', () => {
  it('shows every user’s activity with the actor, newest first, paginated', async () => {
    const admin = await registerUser(app);
    await makeAdmin(admin);
    const user = await registerUser(app, 'Uma User');
    await createProject(app, user, { name: 'Alpha' });

    const res = await request(app).get('/api/admin/audit-logs?limit=2').set(admin.auth).expect(200);
    expect(res.body.meta).toMatchObject({ page: 1, limit: 2, total: 3 });
    expect(res.body.data[0]).toMatchObject({ action: 'PROJECT_CREATED', entityName: null, actor: { id: user.id, fullName: 'Uma User' } });
    // Admins learn that a project was created, not what it is called.
    expect(JSON.stringify(res.body)).not.toContain('Alpha');

    const filtered = await request(app).get(`/api/admin/audit-logs?userId=${admin.id}`).set(admin.auth).expect(200);
    expect(filtered.body.data.every((e: { actor: { id: string } }) => e.actor.id === admin.id)).toBe(true);
  });
});
