import jwt from 'jsonwebtoken';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { pool } from '../db/client.js';
import { PASSWORD, createTestApp, fieldErrors, registerUser, useCleanDatabase } from './helpers.js';

useCleanDatabase();
const app = createTestApp();
const SECRET = 'test-secret-that-is-long-enough-for-hs256-signing';

const cookieFrom = (res: request.Response) => {
  const header = res.headers['set-cookie'] as unknown as string[] | undefined;
  return header?.find((c) => c.startsWith('pms_refresh=')) ?? '';
};

describe('POST /api/auth/register', () => {
  it('creates an account, returns a session and never returns the password hash', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ fullName: 'Asha Rao', email: '  Asha@Example.COM ', password: PASSWORD })
      .expect(201);

    expect(res.body.success).toBe(true);
    expect(res.body.data.user).toMatchObject({ fullName: 'Asha Rao', email: 'asha@example.com' });
    expect(res.body.data.accessToken).toEqual(expect.any(String));
    expect(JSON.stringify(res.body)).not.toMatch(/password/i);
    // Web client: refresh token is an HttpOnly cookie scoped to /api/auth, not in the body.
    expect(res.body.data.refreshToken).toBeUndefined();
    const cookie = cookieFrom(res);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/Path=\/api\/auth/);
    expect(cookie).toMatch(/SameSite=Lax/i);
  });

  it('stores a bcrypt hash, not the plain-text password', async () => {
    await request(app).post('/api/auth/register').send({ fullName: 'Asha Rao', email: 'hash@example.com', password: PASSWORD }).expect(201);
    const { rows } = await pool.query<{ password_hash: string }>("select password_hash from users where email = 'hash@example.com'");
    expect(rows[0]?.password_hash).toMatch(/^\$2[aby]\$/);
    expect(rows[0]?.password_hash).not.toContain(PASSWORD);
  });

  it('rejects a duplicate email regardless of case with 409', async () => {
    await request(app).post('/api/auth/register').send({ fullName: 'First', email: 'dup@example.com', password: PASSWORD }).expect(201);
    const res = await request(app)
      .post('/api/auth/register')
      .send({ fullName: 'Second', email: 'DUP@example.com', password: PASSWORD })
      .expect(409);
    expect(res.body.error.code).toBe('EMAIL_TAKEN');
  });

  it('returns field-level errors for invalid input', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ fullName: '', email: 'not-an-email', password: 'short' })
      .expect(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(fieldErrors(res.body)).toEqual(expect.arrayContaining(['fullName', 'email', 'password']));
  });

  it('rejects missing fields and unexpected fields', async () => {
    const missing = await request(app).post('/api/auth/register').send({}).expect(400);
    expect(fieldErrors(missing.body)).toEqual(expect.arrayContaining(['fullName', 'email', 'password']));
    await request(app)
      .post('/api/auth/register')
      .send({ fullName: 'Admin', email: 'x@example.com', password: PASSWORD, role: 'ADMIN' })
      .expect(400);
  });
});

describe('POST /api/auth/login', () => {
  it('logs in with the same account from web and mobile', async () => {
    const user = await registerUser(app);
    const web = await request(app).post('/api/auth/login').send({ email: user.email, password: PASSWORD }).expect(200);
    expect(cookieFrom(web)).toMatch(/pms_refresh=/);

    const mobile = await request(app)
      .post('/api/auth/login')
      .set('X-Client', 'mobile')
      .send({ email: user.email.toUpperCase(), password: PASSWORD })
      .expect(200);
    expect(mobile.body.data.refreshToken).toEqual(expect.any(String));
    expect(cookieFrom(mobile)).toBe('');
    expect(mobile.body.data.user.id).toBe(web.body.data.user.id);
  });

  it('returns the same 401 for a wrong password and an unknown email', async () => {
    const user = await registerUser(app);
    const wrongPassword = await request(app).post('/api/auth/login').send({ email: user.email, password: 'Wrong1234' }).expect(401);
    const unknownEmail = await request(app).post('/api/auth/login').send({ email: 'nobody@example.com', password: 'Wrong1234' }).expect(401);
    expect(wrongPassword.body.error).toMatchObject({ code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' });
    expect(unknownEmail.body.error).toMatchObject({ code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' });
  });

  it('rate-limits repeated failed logins with 429', async () => {
    const limited = createTestApp({ rateLimits: { loginMax: 3 } });
    for (let i = 0; i < 3; i += 1) {
      await request(limited).post('/api/auth/login').send({ email: 'x@example.com', password: 'Wrong1234' }).expect(401);
    }
    const res = await request(limited).post('/api/auth/login').send({ email: 'x@example.com', password: 'Wrong1234' }).expect(429);
    expect(res.body.error.code).toBe('RATE_LIMITED');
    expect(res.headers['ratelimit-policy']).toBeDefined();
  });
});

describe('per-account login limit', () => {
  it('limits failed attempts against one account even from different IPs', async () => {
    const limited = createTestApp({ rateLimits: { loginPerAccountMax: 3 } });
    const user = await registerUser(limited);
    for (let i = 0; i < 3; i += 1) {
      await request(limited).post('/api/auth/login').set('X-Forwarded-For', `10.0.0.${i}`).send({ email: user.email, password: 'Wrong1234' }).expect(401);
    }
    const blocked = await request(limited).post('/api/auth/login').send({ email: user.email.toUpperCase(), password: PASSWORD }).expect(429);
    expect(blocked.body.error.message).toMatch(/this account/);
    // Other accounts are unaffected.
    const other = await registerUser(limited);
    await request(limited).post('/api/auth/login').send({ email: other.email, password: PASSWORD }).expect(200);
  });
});

describe('GET /api/auth/me and access-token validation', () => {
  it('returns the current user', async () => {
    const user = await registerUser(app, 'Me Myself');
    const res = await request(app).get('/api/auth/me').set(user.auth).expect(200);
    expect(res.body.data).toEqual({ id: user.id, fullName: 'Me Myself', email: user.email, role: 'USER', createdAt: expect.any(String) });
  });

  it.each([
    ['no header', undefined, 'UNAUTHENTICATED'],
    ['wrong scheme', 'Basic abc', 'UNAUTHENTICATED'],
    ['malformed token', 'Bearer not.a.jwt', 'INVALID_TOKEN'],
    ['wrong signature', `Bearer ${jwt.sign({ typ: 'access' }, 'another-secret-another-secret-123', { subject: 'x', issuer: 'pms-api', audience: 'pms-clients' })}`, 'INVALID_TOKEN'],
    ['unsigned "alg: none" token', `Bearer ${jwt.sign({ typ: 'access', sub: 'x', iss: 'pms-api', aud: 'pms-clients' }, '', { algorithm: 'none' })}`, 'INVALID_TOKEN'],
  ])('rejects %s with 401', async (_label, header, code) => {
    const req = request(app).get('/api/auth/me');
    if (header) req.set('Authorization', header);
    const res = await req.expect(401);
    expect(res.body.error.code).toBe(code);
  });

  it('rejects an expired access token with TOKEN_EXPIRED', async () => {
    const user = await registerUser(app);
    const expired = jwt.sign({ typ: 'access' }, SECRET, {
      subject: user.id,
      issuer: 'pms-api',
      audience: 'pms-clients',
      expiresIn: -10,
    });
    const res = await request(app).get('/api/projects').set('Authorization', `Bearer ${expired}`).expect(401);
    expect(res.body.error.code).toBe('TOKEN_EXPIRED');
  });
});

describe('refresh-token rotation', () => {
  it('rotates the refresh token for mobile clients', async () => {
    const user = await registerUser(app);
    const res = await request(app)
      .post('/api/auth/refresh')
      .set('X-Client', 'mobile')
      .send({ refreshToken: user.refreshToken })
      .expect(200);
    expect(res.body.data.refreshToken).not.toBe(user.refreshToken);
    await request(app).get('/api/auth/me').set('Authorization', `Bearer ${res.body.data.accessToken}`).expect(200);
  });

  it('rotates the cookie for web clients', async () => {
    const login = await request(app).post('/api/auth/register').send({ fullName: 'Web User', email: 'web@example.com', password: PASSWORD });
    const cookie = cookieFrom(login).split(';')[0]!;
    const res = await request(app).post('/api/auth/refresh').set('Cookie', cookie).set('Origin', 'http://localhost:5173').expect(200);
    expect(cookieFrom(res).split(';')[0]).not.toBe(cookie);
  });

  it('rejects refresh from an untrusted browser origin (CSRF)', async () => {
    const login = await request(app).post('/api/auth/register').send({ fullName: 'Web User', email: 'csrf@example.com', password: PASSWORD });
    const cookie = cookieFrom(login).split(';')[0]!;
    const res = await request(app).post('/api/auth/refresh').set('Cookie', cookie).set('Origin', 'https://evil.example').expect(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('returns a retryable 409 when the same token is used twice in quick succession', async () => {
    const user = await registerUser(app);
    await request(app).post('/api/auth/refresh').set('X-Client', 'mobile').send({ refreshToken: user.refreshToken }).expect(200);
    const res = await request(app).post('/api/auth/refresh').set('X-Client', 'mobile').send({ refreshToken: user.refreshToken }).expect(409);
    expect(res.body.error.code).toBe('REFRESH_CONFLICT');
  });

  it('revokes the whole session when a rotated token is replayed later (theft detection)', async () => {
    const user = await registerUser(app);
    const first = await request(app).post('/api/auth/refresh').set('X-Client', 'mobile').send({ refreshToken: user.refreshToken }).expect(200);
    // Move the rotation outside the 30-second grace window.
    await pool.query("update refresh_tokens set revoked_at = now() - interval '5 minutes' where revoked_reason = 'rotated'");

    const replay = await request(app).post('/api/auth/refresh').set('X-Client', 'mobile').send({ refreshToken: user.refreshToken }).expect(401);
    expect(replay.body.error.code).toBe('REFRESH_TOKEN_REUSED');
    // The legitimate holder's newer token is now dead too.
    await request(app).post('/api/auth/refresh').set('X-Client', 'mobile').send({ refreshToken: first.body.data.refreshToken }).expect(401);
  });

  it('rejects an expired refresh token', async () => {
    const user = await registerUser(app);
    await pool.query("update refresh_tokens set expires_at = now() - interval '1 second'");
    const res = await request(app).post('/api/auth/refresh').set('X-Client', 'mobile').send({ refreshToken: user.refreshToken }).expect(401);
    expect(res.body.error).toMatchObject({ code: 'REFRESH_TOKEN_INVALID', message: 'Your session has expired. Please log in again.' });
  });

  it('distinguishes "no session" from an unknown or expired refresh token', async () => {
    const none = await request(app).post('/api/auth/refresh').expect(401);
    expect(none.body.error.code).toBe('UNAUTHENTICATED');
    const unknown = await request(app).post('/api/auth/refresh').set('X-Client', 'mobile').send({ refreshToken: 'made-up' }).expect(401);
    expect(unknown.body.error.code).toBe('REFRESH_TOKEN_INVALID');
  });
});

describe('logout', () => {
  it('revokes the refresh token so the session cannot be refreshed', async () => {
    const user = await registerUser(app);
    await request(app).post('/api/auth/logout').set('X-Client', 'mobile').send({ refreshToken: user.refreshToken }).expect(204);
    await request(app).post('/api/auth/refresh').set('X-Client', 'mobile').send({ refreshToken: user.refreshToken }).expect(401);
  });

  it('clears the web cookie and is idempotent', async () => {
    const res = await request(app).post('/api/auth/logout').expect(204);
    expect(cookieFrom(res)).toMatch(/pms_refresh=;/);
    await request(app).post('/api/auth/logout').expect(204);
  });

  it('logout-all revokes every device session', async () => {
    const user = await registerUser(app);
    const second = await request(app)
      .post('/api/auth/login')
      .set('X-Client', 'mobile')
      .send({ email: user.email, password: PASSWORD })
      .expect(200);
    await request(app).post('/api/auth/logout-all').set(user.auth).expect(204);
    await request(app).post('/api/auth/refresh').set('X-Client', 'mobile').send({ refreshToken: user.refreshToken }).expect(401);
    await request(app).post('/api/auth/refresh').set('X-Client', 'mobile').send({ refreshToken: second.body.data.refreshToken }).expect(401);
  });
});
