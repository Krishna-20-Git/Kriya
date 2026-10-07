import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { env } from '../config/env.js';
import { pool } from '../db/client.js';
import { addDays, buildReminder, localClock, notificationService } from '../services/notification.service.js';
import type { PushMessage, PushResult, PushSender } from '../utils/expo-push.js';
import { createProject, createTask, createTestApp, registerUser, useCleanDatabase, type TestUser } from './helpers.js';

const app = createTestApp();
useCleanDatabase();

const TOKEN_A = 'ExponentPushToken[device-a]';
const TOKEN_B = 'ExponentPushToken[device-b]';

const registerDevice = (user: TestUser, token = TOKEN_A, timezone = 'Asia/Kolkata') =>
  request(app).post('/api/notifications/devices').set(user.auth).send({ token, platform: 'android', timezone });

/** A fake Expo push service that records what would have been sent. */
function fakeSender(outcome: (m: PushMessage) => PushResult = (m) => ({ token: m.to, ok: true })) {
  const sent: PushMessage[] = [];
  const send: PushSender = async (messages) => {
    sent.push(...messages);
    return messages.map(outcome);
  };
  return { sent, send };
}

// 2026-10-07 13:00 UTC = 18:30 in India (reminder time) = 09:00 in New York (too early).
const EVENING_IN_INDIA = new Date('2026-10-07T13:00:00Z');

describe('device registration', () => {
  it('registers, lists and unregisters a phone', async () => {
    const user = await registerUser(app);
    const res = await registerDevice(user).expect(201);
    expect(res.body.data).toMatchObject({ token: TOKEN_A, platform: 'android', timezone: 'Asia/Kolkata' });

    const list = await request(app).get('/api/notifications/devices').set(user.auth).expect(200);
    expect(list.body.data).toHaveLength(1);

    await request(app).delete('/api/notifications/devices').set(user.auth).send({ token: TOKEN_A }).expect(204);
    const after = await request(app).get('/api/notifications/devices').set(user.auth).expect(200);
    expect(after.body.data).toHaveLength(0);
  });

  it('is idempotent and moves the token when another user signs in on the same phone', async () => {
    const alice = await registerUser(app);
    const bob = await registerUser(app);
    await registerDevice(alice).expect(201);
    await registerDevice(alice).expect(201);
    await registerDevice(bob).expect(201);

    const aliceDevices = await request(app).get('/api/notifications/devices').set(alice.auth).expect(200);
    const bobDevices = await request(app).get('/api/notifications/devices').set(bob.auth).expect(200);
    expect(aliceDevices.body.data).toHaveLength(0);
    expect(bobDevices.body.data).toHaveLength(1);
  });

  it('cannot unregister someone else’s phone', async () => {
    const alice = await registerUser(app);
    const mallory = await registerUser(app);
    await registerDevice(alice).expect(201);
    await request(app).delete('/api/notifications/devices').set(mallory.auth).send({ token: TOKEN_A }).expect(204);
    const list = await request(app).get('/api/notifications/devices').set(alice.auth).expect(200);
    expect(list.body.data).toHaveLength(1);
  });

  it('validates the token and time zone, and requires a session', async () => {
    const user = await registerUser(app);
    await request(app).post('/api/notifications/devices').set(user.auth).send({ token: 'abc', platform: 'android', timezone: 'Asia/Kolkata' }).expect(400);
    await registerDevice(user, TOKEN_A, 'Not/AZone').expect(400);
    await request(app).post('/api/notifications/devices').send({ token: TOKEN_A, platform: 'android', timezone: 'UTC' }).expect(401);
  });

  it('“sign out everywhere” stops reminders to every phone', async () => {
    const user = await registerUser(app);
    await registerDevice(user, TOKEN_A).expect(201);
    await registerDevice(user, TOKEN_B).expect(201);
    await request(app).post('/api/auth/logout-all').set(user.auth).expect(204);
    const { rows } = await pool.query('SELECT count(*)::int AS n FROM notification_devices');
    expect(rows[0].n).toBe(0);
  });
});

describe('due-tomorrow reminder job', () => {
  async function userWithTasksDueTomorrow(timezone = 'Asia/Kolkata') {
    const user = await registerUser(app);
    await registerDevice(user, TOKEN_A, timezone).expect(201);
    const project = await createProject(app, user, { startDate: '2026-10-01' });
    return { user, project };
  }

  it('computes the local date and hour in the phone’s time zone', () => {
    expect(localClock(EVENING_IN_INDIA, 'Asia/Kolkata')).toEqual({ date: '2026-10-07', hour: 18 });
    expect(localClock(EVENING_IN_INDIA, 'America/New_York')).toEqual({ date: '2026-10-07', hour: 9 });
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  });

  it('sends one reminder listing the open tasks due tomorrow, most important first', async () => {
    const { user, project } = await userWithTasksDueTomorrow();
    await createTask(app, user, project.id, { name: 'Low thing', priority: 'LOW', dueDate: '2026-10-08' });
    await createTask(app, user, project.id, { name: 'Urgent thing', priority: 'HIGH', dueDate: '2026-10-08' });
    await createTask(app, user, project.id, { name: 'Already done', dueDate: '2026-10-08', status: 'COMPLETED' });
    await createTask(app, user, project.id, { name: 'Due today', dueDate: '2026-10-07' });

    const { sent, send } = fakeSender();
    const summary = await notificationService.runDueTomorrowReminders(EVENING_IN_INDIA, send);

    expect(summary).toMatchObject({ devices: 1, due: 1, sent: 1 });
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ to: TOKEN_A, title: '2 tasks due tomorrow', body: 'Urgent thing, Low thing', channelId: 'due-reminders' });
    expect(sent[0]?.data).toMatchObject({ type: 'due-tomorrow', date: '2026-10-08' });
  });

  it('never sends twice on the same day, however often the job runs', async () => {
    const { user, project } = await userWithTasksDueTomorrow();
    await createTask(app, user, project.id, { name: 'Ship it', dueDate: '2026-10-08' });
    const { sent, send } = fakeSender();
    await notificationService.runDueTomorrowReminders(EVENING_IN_INDIA, send);
    await notificationService.runDueTomorrowReminders(new Date('2026-10-07T15:00:00Z'), send);
    await Promise.all([notificationService.runDueTomorrowReminders(EVENING_IN_INDIA, send), notificationService.runDueTomorrowReminders(EVENING_IN_INDIA, send)]);
    expect(sent).toHaveLength(1);
    // The next evening is a new day.
    await createTask(app, user, project.id, { name: 'Next one', dueDate: '2026-10-09' });
    await notificationService.runDueTomorrowReminders(new Date('2026-10-08T13:00:00Z'), send);
    expect(sent).toHaveLength(2);
  });

  it('waits until the reminder hour on the phone’s own clock', async () => {
    const { user, project } = await userWithTasksDueTomorrow('America/New_York');
    await createTask(app, user, project.id, { name: 'NY task', dueDate: '2026-10-08' });
    const { sent, send } = fakeSender();
    await notificationService.runDueTomorrowReminders(EVENING_IN_INDIA, send); // 09:00 in New York
    expect(sent).toHaveLength(0);
    await notificationService.runDueTomorrowReminders(new Date('2026-10-07T22:30:00Z'), send); // 18:30 in New York
    expect(sent).toHaveLength(1);
  });

  it('sends nothing when nothing is due, and only ever includes the device owner’s tasks', async () => {
    await userWithTasksDueTomorrow();
    const other = await registerUser(app);
    const otherProject = await createProject(app, other);
    await createTask(app, other, otherProject.id, { name: 'Not yours', dueDate: '2026-10-08' });

    const { sent, send } = fakeSender();
    const summary = await notificationService.runDueTomorrowReminders(EVENING_IN_INDIA, send);
    expect(sent).toHaveLength(0);
    expect(summary.noTasks).toBe(1);
  });

  it('opens the task directly when exactly one is due', () => {
    const msg = buildReminder([{ id: 't1', name: 'Only one' }], '2026-10-08');
    expect(msg).toMatchObject({ title: 'Task due tomorrow', body: 'Only one', data: { taskId: 't1' } });
    const many = buildReminder(['a', 'b', 'c', 'd', 'e'].map((n) => ({ id: n, name: n })), '2026-10-08');
    expect(many.body).toBe('a, b, c and 2 more');
  });

  it('deletes tokens of uninstalled apps and retries after transient failures', async () => {
    const { user, project } = await userWithTasksDueTomorrow();
    await registerDevice(user, TOKEN_B).expect(201);
    await createTask(app, user, project.id, { name: 'Ship it', dueDate: '2026-10-08' });

    const failing = fakeSender((m) =>
      m.to === TOKEN_A ? { token: m.to, ok: false, permanent: true, error: 'DeviceNotRegistered' } : { token: m.to, ok: false, permanent: false, error: 'timeout' },
    );
    const summary = await notificationService.runDueTomorrowReminders(EVENING_IN_INDIA, failing.send);
    expect(summary).toMatchObject({ failed: 2, removedTokens: 1 });

    const { rows } = await pool.query('SELECT token FROM notification_devices');
    expect(rows.map((r) => r.token)).toEqual([TOKEN_B]);

    // TOKEN_B's claim was released, so the next run retries it.
    const retry = fakeSender();
    await notificationService.runDueTomorrowReminders(EVENING_IN_INDIA, retry.send);
    expect(retry.sent.map((m) => m.to)).toEqual([TOKEN_B]);
  });
});

describe('POST /api/internal/reminders/run', () => {
  const original = env.CRON_SECRET;
  afterEach(() => {
    env.CRON_SECRET = original;
    vi.restoreAllMocks();
  });

  it('is disabled (404) when no CRON_SECRET is configured', async () => {
    env.CRON_SECRET = undefined;
    await request(app).post('/api/internal/reminders/run').expect(404);
  });

  it('rejects a wrong secret and runs the job with the right one', async () => {
    env.CRON_SECRET = 's'.repeat(40);
    const run = vi.spyOn(notificationService, 'runDueTomorrowReminders').mockResolvedValue({ devices: 0, due: 0, sent: 0, noTasks: 0, failed: 0, removedTokens: 0 });
    await request(app).post('/api/internal/reminders/run').set('Authorization', 'Bearer wrong').expect(401);
    expect(run).not.toHaveBeenCalled();
    const res = await request(app).post('/api/internal/reminders/run').set('Authorization', `Bearer ${'s'.repeat(40)}`).expect(200);
    expect(res.body.data.devices).toBe(0);
    expect(run).toHaveBeenCalledOnce();
  });
});

describe('GET /api/tasks?dueOn=', () => {
  it('returns only tasks due on that date', async () => {
    const user = await registerUser(app);
    const project = await createProject(app, user);
    await createTask(app, user, project.id, { name: 'Tomorrow', dueDate: '2026-10-08' });
    await createTask(app, user, project.id, { name: 'Later', dueDate: '2026-10-20' });
    const res = await request(app).get('/api/tasks?dueOn=2026-10-08').set(user.auth).expect(200);
    expect(res.body.data.map((t: { name: string }) => t.name)).toEqual(['Tomorrow']);
  });
});
