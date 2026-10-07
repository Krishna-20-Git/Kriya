import {
  API_ERROR_CODES,
  AUDIT_ACTIONS,
  PROJECT_SORT_FIELDS,
  PROJECT_STATUSES,
  TASK_PRIORITIES,
  TASK_SORT_FIELDS,
  TASK_STATUSES,
  createProjectSchema,
  createTaskSchema,
  loginSchema,
  patchProjectSchema,
  patchTaskSchema,
  refreshSchema,
  registerDeviceSchema,
  registerSchema,
  unregisterDeviceSchema,
  updateUserRoleSchema,
  USER_ROLES,
} from '@pms/shared';
import { z } from 'zod';

type JsonSchema = Record<string, unknown>;

/** Request bodies are generated from the same Zod schemas the API validates with. */
const fromZod = (schema: z.ZodType): JsonSchema => {
  const { $schema: _ignored, ...json } = z.toJSONSchema(schema, { io: 'input', unrepresentable: 'any' }) as JsonSchema;
  return json;
};

const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });
const uuid = { type: 'string', format: 'uuid' };
const date = { type: 'string', format: 'date', example: '2026-10-07' };
const timestamp = { type: 'string', format: 'date-time' };

const success = (data: JsonSchema) => ({
  type: 'object',
  required: ['success', 'data'],
  properties: { success: { const: true }, data },
});

const page = (item: string) => ({
  type: 'object',
  required: ['success', 'data', 'meta'],
  properties: { success: { const: true }, data: { type: 'array', items: ref(item) }, meta: ref('PaginationMeta') },
});

const json = (schema: JsonSchema, example?: unknown) => ({
  content: { 'application/json': { schema, ...(example === undefined ? {} : { example }) } },
});

const error = (description: string, code: string, message: string) => ({
  description,
  ...json(ref('Error'), { success: false, error: { code, message, requestId: '5d2c9a0e-…' } }),
});

const errors = {
  400: error('Validation failed', 'VALIDATION_ERROR', 'Request validation failed'),
  401: error('Missing, invalid or expired access token', 'TOKEN_EXPIRED', 'Access token has expired'),
  404: error('Not found — or owned by another user (the API does not distinguish)', 'NOT_FOUND', 'Project not found'),
  429: error('Rate limit exceeded', 'RATE_LIMITED', 'Too many requests. Please slow down.'),
};

const idParam = { name: 'id', in: 'path', required: true, schema: uuid };
const query = (name: string, schema: JsonSchema, description: string) => ({ name, in: 'query', required: false, schema, description });
const paging = [
  query('page', { type: 'integer', minimum: 1, default: 1 }, 'Page number (1-based)'),
  query('limit', { type: 'integer', minimum: 1, maximum: 100, default: 20 }, 'Items per page'),
  query('sortOrder', { type: 'string', enum: ['asc', 'desc'], default: 'desc' }, 'Sort direction'),
];

const secured = { security: [{ bearerAuth: [] }] };

const exampleProject = {
  id: '9b2f3c1e-1a2b-4c3d-8e9f-0a1b2c3d4e5f',
  name: 'Website redesign',
  description: 'Refresh the marketing site.',
  status: 'IN_PROGRESS',
  startDate: '2026-10-01',
  endDate: '2026-11-15',
  createdAt: '2026-10-01T09:30:00.000Z',
  updatedAt: '2026-10-05T14:02:00.000Z',
  taskCount: 6,
  completedTaskCount: 2,
};

const exampleTask = {
  id: '1c9d8e7f-6a5b-4c3d-9e8f-7a6b5c4d3e2f',
  projectId: exampleProject.id,
  project: { id: exampleProject.id, name: exampleProject.name },
  name: 'Design the pricing page',
  description: '',
  priority: 'HIGH',
  status: 'IN_PROGRESS',
  dueDate: '2026-10-12',
  completedAt: null,
  createdAt: '2026-10-02T10:00:00.000Z',
  updatedAt: '2026-10-06T08:15:00.000Z',
};

const exampleUser = { id: '0f8e7d6c-5b4a-4392-8170-6f5e4d3c2b1a', fullName: 'Demo User', email: 'demo@example.com', createdAt: '2026-10-01T09:00:00.000Z' };

export function buildOpenApiDocument() {
  return {
    openapi: '3.1.0',
    info: {
      title: 'Project Management System API',
      version: '1.0.0',
      description: [
        'One REST API serves both the web app and the Android app.',
        '',
        '**Authentication.** `POST /api/auth/login` returns a short-lived JWT access token (15 min). Send it as `Authorization: Bearer <token>`.',
        'Web clients receive the refresh token as an HttpOnly cookie; mobile clients send `X-Client: mobile` and receive it in the body.',
        'Refresh tokens rotate on every use and are revoked on logout.',
        '',
        '**Authorization.** Every project and task query is scoped to the authenticated user. Requests for another user\'s resources return `404`, the same as for IDs that do not exist.',
        '',
        '**Responses.** Success: `{ "success": true, "data": … }` (lists add `meta`). Errors: `{ "success": false, "error": { "code", "message", "details?" } }`.',
        '',
        'Try it: call **POST /api/auth/login** with the demo account, copy `accessToken`, click **Authorize**.',
      ].join('\n'),
    },
    servers: [{ url: '/', description: 'This server' }],
    tags: [
      { name: 'Auth' },
      { name: 'Projects' },
      { name: 'Tasks' },
      { name: 'Dashboard' },
      { name: 'Notifications', description: 'Due-tomorrow push reminders for the Android app' },
      { name: 'Admin', description: 'Requires role ADMIN. Returns 403 FORBIDDEN for everyone else.' },
      { name: 'System' },
    ],
    components: {
      securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } },
      schemas: {
        RegisterRequest: fromZod(registerSchema),
        LoginRequest: fromZod(loginSchema),
        RefreshRequest: fromZod(refreshSchema),
        CreateProjectRequest: fromZod(createProjectSchema),
        PatchProjectRequest: fromZod(patchProjectSchema),
        CreateTaskRequest: fromZod(createTaskSchema),
        PatchTaskRequest: fromZod(patchTaskSchema),
        UpdateRoleRequest: fromZod(updateUserRoleSchema),
        RegisterDeviceRequest: fromZod(registerDeviceSchema),
        UnregisterDeviceRequest: fromZod(unregisterDeviceSchema),
        User: {
          type: 'object',
          required: ['id', 'fullName', 'email', 'role', 'createdAt'],
          properties: { id: uuid, fullName: { type: 'string' }, email: { type: 'string', format: 'email' }, role: { type: 'string', enum: [...USER_ROLES] }, createdAt: timestamp },
        },
        AdminUser: {
          allOf: [
            ref('User'),
            {
              type: 'object',
              required: ['projectCount', 'taskCount', 'lastActiveAt'],
              properties: { projectCount: { type: 'integer' }, taskCount: { type: 'integer' }, lastActiveAt: { ...timestamp, type: ['string', 'null'] } },
            },
          ],
        },
        AdminAuditEntry: {
          allOf: [
            ref('ActivityEntry'),
            {
              type: 'object',
              required: ['actor'],
              properties: { actor: { type: 'object', properties: { id: uuid, fullName: { type: 'string' }, email: { type: 'string' } } } },
            },
          ],
        },
        NotificationDevice: {
          type: 'object',
          properties: { token: { type: 'string' }, platform: { type: 'string', enum: ['android', 'ios'] }, timezone: { type: 'string' }, createdAt: timestamp },
        },
        AuthSession: {
          type: 'object',
          required: ['user', 'accessToken', 'expiresIn'],
          properties: {
            user: ref('User'),
            accessToken: { type: 'string' },
            expiresIn: { type: 'integer', description: 'Seconds until the access token expires' },
            refreshToken: { type: 'string', description: 'Only for mobile clients (X-Client: mobile)' },
          },
        },
        Project: {
          type: 'object',
          properties: {
            id: uuid,
            name: { type: 'string' },
            description: { type: 'string' },
            status: { type: 'string', enum: [...PROJECT_STATUSES] },
            startDate: date,
            endDate: { ...date, type: ['string', 'null'] },
            createdAt: timestamp,
            updatedAt: timestamp,
            taskCount: { type: 'integer' },
            completedTaskCount: { type: 'integer' },
          },
        },
        Task: {
          type: 'object',
          properties: {
            id: uuid,
            projectId: uuid,
            project: { type: 'object', properties: { id: uuid, name: { type: 'string' } } },
            name: { type: 'string' },
            description: { type: 'string' },
            priority: { type: 'string', enum: [...TASK_PRIORITIES] },
            status: { type: 'string', enum: [...TASK_STATUSES] },
            dueDate: { ...date, type: ['string', 'null'] },
            completedAt: { ...timestamp, type: ['string', 'null'] },
            createdAt: timestamp,
            updatedAt: timestamp,
          },
        },
        Dashboard: {
          type: 'object',
          properties: {
            totalProjects: { type: 'integer' },
            totalTasks: { type: 'integer' },
            completedTasks: { type: 'integer' },
            pendingTasks: { type: 'integer', description: 'Tasks with status PENDING' },
            inProgressTasks: { type: 'integer' },
            projectsInProgress: { type: 'integer' },
            overdueTasks: { type: 'integer' },
            projectStatusDistribution: { type: 'object', additionalProperties: { type: 'integer' } },
            taskStatusDistribution: { type: 'object', additionalProperties: { type: 'integer' } },
            taskPriorityDistribution: { type: 'object', additionalProperties: { type: 'integer' } },
            recentProjects: { type: 'array', items: ref('Project') },
            upcomingTasks: { type: 'array', items: ref('Task') },
          },
        },
        ActivityEntry: {
          type: 'object',
          properties: {
            id: uuid,
            action: { type: 'string', enum: [...AUDIT_ACTIONS] },
            entityType: { type: 'string', enum: ['USER', 'PROJECT', 'TASK'] },
            entityId: { ...uuid, type: ['string', 'null'] },
            entityName: { type: ['string', 'null'] },
            createdAt: timestamp,
          },
        },
        PaginationMeta: {
          type: 'object',
          properties: { page: { type: 'integer' }, limit: { type: 'integer' }, total: { type: 'integer' }, totalPages: { type: 'integer' } },
        },
        Error: {
          type: 'object',
          required: ['success', 'error'],
          properties: {
            success: { const: false },
            error: {
              type: 'object',
              required: ['code', 'message'],
              properties: {
                code: { type: 'string', enum: [...API_ERROR_CODES] },
                message: { type: 'string' },
                details: {
                  type: 'array',
                  items: { type: 'object', properties: { path: { type: 'string' }, message: { type: 'string' } } },
                },
                requestId: { type: 'string' },
              },
            },
          },
        },
      },
    },
    paths: {
      '/api/auth/register': {
        post: {
          tags: ['Auth'],
          summary: 'Create an account and start a session',
          description: 'Email is normalised to lowercase. Password: 8–128 characters with at least one letter and one number. Rate-limited per IP.',
          requestBody: { required: true, ...json(ref('RegisterRequest'), { fullName: 'Demo User', email: 'demo@example.com', password: 'Demo@12345' }) },
          responses: {
            201: { description: 'Account created', ...json(success(ref('AuthSession')), { success: true, data: { user: exampleUser, accessToken: 'eyJhbGciOi…', expiresIn: 900 } }) },
            400: errors[400],
            409: error('Email already registered', 'EMAIL_TAKEN', 'An account with this email already exists'),
            429: errors[429],
          },
        },
      },
      '/api/auth/login': {
        post: {
          tags: ['Auth'],
          summary: 'Log in',
          description: 'Wrong email and wrong password return the same error. Failed attempts are rate-limited per IP.',
          parameters: [{ name: 'X-Client', in: 'header', required: false, schema: { type: 'string', enum: ['mobile'] }, description: 'Send `mobile` to receive the refresh token in the body' }],
          requestBody: { required: true, ...json(ref('LoginRequest'), { email: 'demo@example.com', password: 'Demo@12345' }) },
          responses: {
            200: { description: 'Logged in', ...json(success(ref('AuthSession'))) },
            400: errors[400],
            401: error('Invalid credentials', 'INVALID_CREDENTIALS', 'Invalid email or password'),
            429: errors[429],
          },
        },
      },
      '/api/auth/refresh': {
        post: {
          tags: ['Auth'],
          summary: 'Exchange a refresh token for a new session (rotation)',
          description: 'Web: refresh token from the HttpOnly cookie. Mobile: `{ "refreshToken": "…" }` with `X-Client: mobile`. The presented token is revoked and a new one issued. Re-using a rotated token revokes the whole session.',
          requestBody: { required: false, ...json(ref('RefreshRequest')) },
          responses: {
            200: { description: 'New session', ...json(success(ref('AuthSession'))) },
            401: error('Refresh token missing, expired, revoked or reused', 'REFRESH_TOKEN_INVALID', 'Your session has expired. Please log in again.'),
            409: error('Token was rotated by a concurrent request; retry once', 'REFRESH_CONFLICT', 'Session was refreshed by another request. Retry once.'),
            429: errors[429],
          },
        },
      },
      '/api/auth/logout': {
        post: {
          tags: ['Auth'],
          summary: 'Log out (revokes the refresh token)',
          description: 'Idempotent. Revokes the refresh token and clears the cookie. Access tokens are stateless and expire on their own within 15 minutes; clients discard them immediately.',
          requestBody: { required: false, ...json(ref('RefreshRequest')) },
          responses: { 204: { description: 'Logged out' } },
        },
      },
      '/api/auth/logout-all': {
        post: { tags: ['Auth'], summary: 'Revoke every session of the current user (all devices)', ...secured, responses: { 204: { description: 'All sessions revoked' }, 401: errors[401] } },
      },
      '/api/auth/me': {
        get: {
          tags: ['Auth'],
          summary: 'Current user',
          ...secured,
          responses: { 200: { description: 'The authenticated user', ...json(success(ref('User')), { success: true, data: exampleUser }) }, 401: errors[401] },
        },
      },
      '/api/projects': {
        get: {
          tags: ['Projects'],
          summary: 'List your projects',
          ...secured,
          parameters: [
            query('search', { type: 'string', maxLength: 100 }, 'Case-insensitive match on project name'),
            query('status', { type: 'string', enum: [...PROJECT_STATUSES] }, 'Filter by status'),
            query('sortBy', { type: 'string', enum: [...PROJECT_SORT_FIELDS], default: 'createdAt' }, 'Sort field (whitelisted)'),
            ...paging,
          ],
          responses: {
            200: { description: 'A page of projects', ...json(page('Project'), { success: true, data: [exampleProject], meta: { page: 1, limit: 20, total: 1, totalPages: 1 } }) },
            400: errors[400],
            401: errors[401],
          },
        },
        post: {
          tags: ['Projects'],
          summary: 'Create a project',
          ...secured,
          requestBody: { required: true, ...json(ref('CreateProjectRequest'), { name: 'Website redesign', description: 'Refresh the marketing site.', status: 'NOT_STARTED', startDate: '2026-10-01', endDate: '2026-11-15' }) },
          responses: { 201: { description: 'Created', ...json(success(ref('Project')), { success: true, data: exampleProject }) }, 400: errors[400], 401: errors[401] },
        },
      },
      '/api/projects/{id}': {
        parameters: [idParam],
        get: { tags: ['Projects'], summary: 'Get one of your projects', ...secured, responses: { 200: { description: 'Project', ...json(success(ref('Project'))) }, 400: errors[400], 401: errors[401], 404: errors[404] } },
        put: {
          tags: ['Projects'],
          summary: 'Replace a project',
          description: 'Full replacement: omitted optional fields reset to their defaults. Use PATCH to change individual fields.',
          ...secured,
          requestBody: { required: true, ...json(ref('CreateProjectRequest')) },
          responses: { 200: { description: 'Updated', ...json(success(ref('Project'))) }, 400: errors[400], 401: errors[401], 404: errors[404] },
        },
        patch: {
          tags: ['Projects'],
          summary: 'Update some fields of a project',
          ...secured,
          requestBody: { required: true, ...json(ref('PatchProjectRequest'), { status: 'COMPLETED' }) },
          responses: { 200: { description: 'Updated', ...json(success(ref('Project'))) }, 400: errors[400], 401: errors[401], 404: errors[404] },
        },
        delete: { tags: ['Projects'], summary: 'Delete a project and its tasks', ...secured, responses: { 204: { description: 'Deleted' }, 400: errors[400], 401: errors[401], 404: errors[404] } },
      },
      '/api/tasks': {
        get: {
          tags: ['Tasks'],
          summary: 'List your tasks (across all projects, or one project)',
          ...secured,
          parameters: [
            query('search', { type: 'string', maxLength: 100 }, 'Case-insensitive match on task name'),
            query('status', { type: 'string', enum: [...TASK_STATUSES] }, 'Filter by status'),
            query('priority', { type: 'string', enum: [...TASK_PRIORITIES] }, 'Filter by priority'),
            query('projectId', uuid, 'Only tasks in this project (must be yours)'),
            query('dueOn', date, 'Only tasks due on this date'),
            query('sortBy', { type: 'string', enum: [...TASK_SORT_FIELDS], default: 'createdAt' }, 'Sort field (whitelisted)'),
            ...paging,
          ],
          responses: {
            200: { description: 'A page of tasks', ...json(page('Task'), { success: true, data: [exampleTask], meta: { page: 1, limit: 20, total: 1, totalPages: 1 } }) },
            400: errors[400],
            401: errors[401],
            404: errors[404],
          },
        },
        post: {
          tags: ['Tasks'],
          summary: 'Create a task in one of your projects',
          ...secured,
          requestBody: { required: true, ...json(ref('CreateTaskRequest'), { projectId: exampleProject.id, name: 'Design the pricing page', priority: 'HIGH', status: 'PENDING', dueDate: '2026-10-12' }) },
          responses: {
            201: { description: 'Created', ...json(success(ref('Task')), { success: true, data: exampleTask }) },
            400: errors[400],
            401: errors[401],
            404: error('projectId does not exist or belongs to another user', 'NOT_FOUND', 'Project not found'),
          },
        },
      },
      '/api/tasks/{id}': {
        parameters: [idParam],
        get: { tags: ['Tasks'], summary: 'Get one of your tasks', ...secured, responses: { 200: { description: 'Task', ...json(success(ref('Task'))) }, 400: errors[400], 401: errors[401], 404: errors[404] } },
        put: {
          tags: ['Tasks'],
          summary: 'Replace a task',
          description: 'Full replacement. Changing `projectId` moves the task; the target project must also be yours.',
          ...secured,
          requestBody: { required: true, ...json(ref('CreateTaskRequest')) },
          responses: { 200: { description: 'Updated', ...json(success(ref('Task'))) }, 400: errors[400], 401: errors[401], 404: errors[404] },
        },
        patch: {
          tags: ['Tasks'],
          summary: 'Update some fields of a task (e.g. mark completed)',
          ...secured,
          requestBody: { required: true, ...json(ref('PatchTaskRequest'), { status: 'COMPLETED' }) },
          responses: { 200: { description: 'Updated', ...json(success(ref('Task'))) }, 400: errors[400], 401: errors[401], 404: errors[404] },
        },
        delete: { tags: ['Tasks'], summary: 'Delete a task', ...secured, responses: { 204: { description: 'Deleted' }, 400: errors[400], 401: errors[401], 404: errors[404] } },
      },
      '/api/dashboard': {
        get: {
          tags: ['Dashboard'],
          summary: 'Statistics for the authenticated user',
          ...secured,
          parameters: [query('today', date, "The client's local date, used to compute overdue tasks. Defaults to the server's UTC date.")],
          responses: { 200: { description: 'Dashboard', ...json(success(ref('Dashboard'))) }, 400: errors[400], 401: errors[401] },
        },
      },
      '/api/activity': {
        get: {
          tags: ['Dashboard'],
          summary: 'Your recent activity (audit log)',
          ...secured,
          parameters: [query('limit', { type: 'integer', minimum: 1, maximum: 50, default: 20 }, 'Number of entries')],
          responses: { 200: { description: 'Activity entries, newest first', ...json(success({ type: 'array', items: ref('ActivityEntry') })) }, 401: errors[401] },
        },
      },
      '/api/notifications/devices': {
        get: { tags: ['Notifications'], summary: 'Phones registered for your reminders', ...secured, responses: { 200: { description: 'Devices', ...json(success({ type: 'array', items: ref('NotificationDevice') })) }, 401: errors[401] } },
        post: {
          tags: ['Notifications'],
          summary: 'Register this phone for due-tomorrow reminders',
          description: 'Idempotent. If the token was registered by another account (shared phone), it moves to the caller.',
          ...secured,
          requestBody: { required: true, ...json(ref('RegisterDeviceRequest'), { token: 'ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]', platform: 'android', timezone: 'Asia/Kolkata' }) },
          responses: { 201: { description: 'Registered', ...json(success(ref('NotificationDevice'))) }, 400: errors[400], 401: errors[401] },
        },
        delete: {
          tags: ['Notifications'],
          summary: 'Stop reminders on this phone (called on sign-out)',
          ...secured,
          requestBody: { required: true, ...json(ref('UnregisterDeviceRequest')) },
          responses: { 204: { description: 'Removed (or was not registered to you)' }, 400: errors[400], 401: errors[401] },
        },
      },
      '/api/notifications/test': {
        post: { tags: ['Notifications'], summary: 'Send a test push to your registered phones', ...secured, responses: { 200: { description: 'Number of devices and messages accepted by Expo' }, 401: errors[401] } },
      },
      '/api/internal/reminders/run': {
        post: {
          tags: ['Notifications'],
          summary: 'Run the due-tomorrow reminder job (for a scheduler)',
          description:
            'Authenticated with `Authorization: Bearer <CRON_SECRET>`, not a user token. Returns 404 when CRON_SECRET is not configured. Safe to call repeatedly: each phone gets at most one reminder per local day, at or after REMINDER_HOUR on its own clock.',
          responses: { 200: { description: 'Run summary' }, 401: { description: 'Wrong secret' }, 404: { description: 'Disabled' } },
        },
      },
      '/api/admin/users': {
        get: {
          tags: ['Admin'],
          summary: 'List all accounts with project/task counts',
          description: 'Admins see accounts and counts only — never the contents of other users’ projects or tasks.',
          ...secured,
          parameters: [
            query('search', { type: 'string', maxLength: 100 }, 'Matches name or email'),
            query('role', { type: 'string', enum: [...USER_ROLES] }, 'Filter by role'),
            query('page', { type: 'integer', minimum: 1, default: 1 }, 'Page number'),
            query('limit', { type: 'integer', minimum: 1, maximum: 100, default: 20 }, 'Page size'),
          ],
          responses: { 200: { description: 'Users', ...json(page('AdminUser')) }, 400: errors[400], 401: errors[401], 403: error('Not an admin', 'FORBIDDEN', 'Admin access required') },
        },
      },
      '/api/admin/users/{id}/role': {
        parameters: [idParam],
        patch: {
          tags: ['Admin'],
          summary: 'Change a user’s role',
          description: 'You cannot remove your own admin role, and the last admin cannot be demoted (409 ROLE_CHANGE_NOT_ALLOWED). Every change is written to the audit log.',
          ...secured,
          requestBody: { required: true, ...json(ref('UpdateRoleRequest'), { role: 'ADMIN' }) },
          responses: {
            200: { description: 'Updated user', ...json(success(ref('AdminUser'))) },
            400: errors[400],
            401: errors[401],
            403: error('Not an admin', 'FORBIDDEN', 'Admin access required'),
            404: errors[404],
            409: error('Would remove the last admin or your own admin role', 'ROLE_CHANGE_NOT_ALLOWED', 'At least one admin must remain.'),
          },
        },
      },
      '/api/admin/audit-logs': {
        get: {
          tags: ['Admin'],
          summary: 'Audit log across all users',
          ...secured,
          parameters: [
            query('userId', uuid, 'Only entries by this user'),
            query('action', { type: 'string', enum: [...AUDIT_ACTIONS] }, 'Only this action'),
            query('page', { type: 'integer', minimum: 1, default: 1 }, 'Page number'),
            query('limit', { type: 'integer', minimum: 1, maximum: 100, default: 20 }, 'Page size'),
          ],
          responses: { 200: { description: 'Entries, newest first', ...json(page('AdminAuditEntry')) }, 400: errors[400], 401: errors[401], 403: error('Not an admin', 'FORBIDDEN', 'Admin access required') },
        },
      },
      '/api/health': {
        get: { tags: ['System'], summary: 'Liveness and database check', responses: { 200: { description: 'Healthy' }, 500: { description: 'Database unreachable' } } },
      },
    },
  };
}
