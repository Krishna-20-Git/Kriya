import { describe, expect, it } from 'vitest';
import {
  adminUserListQuerySchema,
  createProjectSchema,
  registerDeviceSchema,
  updateUserRoleSchema,
  createTaskSchema,
  describeDueDate,
  isoDate,
  loginSchema,
  patchProjectSchema,
  patchTaskSchema,
  projectListQuerySchema,
  registerSchema,
  taskListQuerySchema,
} from './index.js';

const PROJECT_ID = '3f1b6a0e-6d1c-4c1e-9a2b-1f0e2d3c4b5a';

describe('registerSchema', () => {
  it('normalises email to trimmed lowercase', () => {
    const parsed = registerSchema.parse({ fullName: ' Asha Rao ', email: '  Asha@Example.COM ', password: 'secret123' });
    expect(parsed.email).toBe('asha@example.com');
    expect(parsed.fullName).toBe('Asha Rao');
  });

  it.each([
    ['invalid email', { fullName: 'Asha Rao', email: 'not-an-email', password: 'secret123' }],
    ['short password', { fullName: 'Asha Rao', email: 'a@b.co', password: 'abc12' }],
    ['password without a number', { fullName: 'Asha Rao', email: 'a@b.co', password: 'onlyletters' }],
    ['blank full name', { fullName: '   ', email: 'a@b.co', password: 'secret123' }],
    ['unknown field (mass assignment)', { fullName: 'Asha Rao', email: 'a@b.co', password: 'secret123', role: 'admin' }],
  ])('rejects %s', (_label, input) => {
    expect(registerSchema.safeParse(input).success).toBe(false);
  });

  it('login does not enforce the password policy', () => {
    expect(loginSchema.safeParse({ email: 'a@b.co', password: 'x' }).success).toBe(true);
  });
});

describe('isoDate', () => {
  const schema = isoDate('Date');
  it.each(['2026-02-29', '2026-13-01', '2026-04-31', '07/10/2026', '2026-1-1', '3000-01-01'])('rejects %s', (value) => {
    expect(schema.safeParse(value).success).toBe(false);
  });
  it.each(['2028-02-29', '2026-10-07', '2026-12-31'])('accepts %s', (value) => {
    expect(schema.safeParse(value).success).toBe(true);
  });
});

describe('project schemas', () => {
  it('applies defaults on create', () => {
    const parsed = createProjectSchema.parse({ name: 'Website', startDate: '2026-10-01' });
    expect(parsed).toEqual({ name: 'Website', description: '', status: 'NOT_STARTED', startDate: '2026-10-01', endDate: null });
  });

  it('rejects an end date before the start date', () => {
    const result = createProjectSchema.safeParse({ name: 'Website', startDate: '2026-10-10', endDate: '2026-10-01' });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(['endDate']);
  });

  it('rejects an invalid status and a userId field', () => {
    expect(createProjectSchema.safeParse({ name: 'X', startDate: '2026-10-01', status: 'DONE' }).success).toBe(false);
    expect(createProjectSchema.safeParse({ name: 'X', startDate: '2026-10-01', userId: PROJECT_ID }).success).toBe(false);
  });

  it('requires at least one field on PATCH', () => {
    expect(patchProjectSchema.safeParse({}).success).toBe(false);
    expect(patchProjectSchema.safeParse({ status: 'COMPLETED' }).success).toBe(true);
  });
});

describe('task schemas', () => {
  it('applies defaults on create', () => {
    const parsed = createTaskSchema.parse({ projectId: PROJECT_ID, name: 'Write tests' });
    expect(parsed).toMatchObject({ priority: 'MEDIUM', status: 'PENDING', dueDate: null, description: '' });
  });

  it.each([
    ['malformed project ID', { projectId: '123', name: 'X' }],
    ['invalid priority', { projectId: PROJECT_ID, name: 'X', priority: 'URGENT' }],
    ['invalid status', { projectId: PROJECT_ID, name: 'X', status: 'DONE' }],
    ['empty name', { projectId: PROJECT_ID, name: '' }],
    ['oversized name', { projectId: PROJECT_ID, name: 'x'.repeat(161) }],
    ['invalid due date', { projectId: PROJECT_ID, name: 'X', dueDate: '2026-02-30' }],
  ])('rejects %s', (_label, input) => {
    expect(createTaskSchema.safeParse(input).success).toBe(false);
  });

  it('allows clearing the due date with PATCH', () => {
    expect(patchTaskSchema.parse({ dueDate: null })).toEqual({ dueDate: null });
  });
});

describe('list query schemas', () => {
  it('coerces paging and ignores empty filters', () => {
    expect(projectListQuerySchema.parse({ page: '2', limit: '5', status: '' })).toEqual({
      page: 2,
      limit: 5,
      sortBy: 'createdAt',
      sortOrder: 'desc',
    });
  });

  it('only accepts whitelisted sort fields', () => {
    expect(taskListQuerySchema.safeParse({ sortBy: 'passwordHash' }).success).toBe(false);
    expect(taskListQuerySchema.safeParse({ sortBy: 'name; DROP TABLE tasks' }).success).toBe(false);
    expect(taskListQuerySchema.safeParse({ sortBy: 'priority', sortOrder: 'asc' }).success).toBe(true);
  });

  it('caps the page size', () => {
    expect(taskListQuerySchema.safeParse({ limit: '1000' }).success).toBe(false);
  });
});

describe('describeDueDate', () => {
  const now = new Date(2026, 9, 7);
  it('describes relative due dates', () => {
    expect(describeDueDate('2026-10-07', false, now)).toBe('Due today');
    expect(describeDueDate('2026-10-08', false, now)).toBe('Due tomorrow');
    expect(describeDueDate('2026-10-04', false, now)).toBe('Overdue by 3 days');
    expect(describeDueDate(null, false, now)).toBe('No due date');
  });
});

describe('roles and admin queries', () => {
  it('accepts only known roles and nothing else in the body', () => {
    expect(updateUserRoleSchema.safeParse({ role: 'ADMIN' }).success).toBe(true);
    expect(updateUserRoleSchema.safeParse({ role: 'SUPERUSER' }).success).toBe(false);
    expect(updateUserRoleSchema.safeParse({ role: 'ADMIN', userId: 'x' }).success).toBe(false);
  });

  it('cannot be used to self-assign a role at registration', () => {
    expect(registerSchema.safeParse({ fullName: 'Ann Lee', email: 'a@b.co', password: 'Passw0rd!', role: 'ADMIN' }).success).toBe(false);
  });

  it('defaults admin pagination and treats empty filters as absent', () => {
    expect(adminUserListQuerySchema.parse({ role: '', search: '' })).toEqual({ page: 1, limit: 20 });
  });
});

describe('device registration', () => {
  const valid = { token: 'ExponentPushToken[abc123_-XYZ]', platform: 'android', timezone: 'Asia/Kolkata' };

  it('accepts an Expo push token with an IANA time zone', () => {
    expect(registerDeviceSchema.safeParse(valid).success).toBe(true);
  });

  it('rejects other token formats and unknown time zones', () => {
    expect(registerDeviceSchema.safeParse({ ...valid, token: 'fcm:abcdef' }).success).toBe(false);
    expect(registerDeviceSchema.safeParse({ ...valid, timezone: 'Mars/Olympus' }).success).toBe(false);
  });
});

describe('task list dueOn filter', () => {
  it('accepts a calendar date and rejects anything else', () => {
    expect(taskListQuerySchema.parse({ dueOn: '2026-10-08' }).dueOn).toBe('2026-10-08');
    expect(taskListQuerySchema.safeParse({ dueOn: 'tomorrow' }).success).toBe(false);
  });
});
