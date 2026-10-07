import type { Express } from 'express';
import request from 'supertest';
import { afterAll, beforeEach } from 'vitest';
import { createApp, type AppOptions } from '../app.js';
import { pool } from '../db/client.js';

export const PASSWORD = 'Passw0rd!';

export const createTestApp = (options: AppOptions = {}) =>
  createApp({ rateLimits: { loginMax: 1000, loginPerAccountMax: 1000, registerMax: 1000, refreshMax: 1000, apiMax: 10_000, ...options.rateLimits } });

/** Wipes all rows before each test and closes the pool after the file. */
export function useCleanDatabase() {
  beforeEach(async () => {
    await pool.query('TRUNCATE users, projects, tasks, refresh_tokens, audit_logs, notification_devices RESTART IDENTITY CASCADE');
  });
  afterAll(async () => {
    await pool.end();
  });
}

let counter = 0;

export interface TestUser {
  id: string;
  email: string;
  token: string;
  refreshToken: string;
  auth: { Authorization: string };
}

/** Registers through the real endpoint as a mobile client, so the refresh token is in the body. */
export async function registerUser(app: Express, name = 'Test User'): Promise<TestUser> {
  counter += 1;
  const email = `user${counter}.${Date.now()}@example.com`;
  const res = await request(app)
    .post('/api/auth/register')
    .set('X-Client', 'mobile')
    .send({ fullName: name, email, password: PASSWORD })
    .expect(201);
  const { user, accessToken, refreshToken } = res.body.data;
  return { id: user.id, email, token: accessToken, refreshToken, auth: { Authorization: `Bearer ${accessToken}` } };
}

export async function createProject(app: Express, user: TestUser, body: Record<string, unknown> = {}) {
  const res = await request(app)
    .post('/api/projects')
    .set(user.auth)
    .send({ name: 'Project', startDate: '2026-10-01', ...body })
    .expect(201);
  return res.body.data as { id: string; name: string; status: string };
}

export async function createTask(app: Express, user: TestUser, projectId: string, body: Record<string, unknown> = {}) {
  const res = await request(app)
    .post('/api/tasks')
    .set(user.auth)
    .send({ projectId, name: 'Task', ...body })
    .expect(201);
  return res.body.data as { id: string; name: string; status: string; priority: string; completedAt: string | null };
}

export const fieldErrors = (body: { error?: { details?: { path: string }[] } }) =>
  (body.error?.details ?? []).map((detail) => detail.path);

/** Promotes a test user directly in the database (the API itself never lets a client self-promote). */
export async function makeAdmin(user: TestUser) {
  await pool.query(`UPDATE users SET role = 'ADMIN' WHERE id = $1`, [user.id]);
}
