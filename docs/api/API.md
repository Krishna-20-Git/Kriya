# API reference

- Interactive docs: `GET /api/docs` (Swagger UI) — click **Authorize** and paste an access token.
- Machine-readable: [`openapi.json`](openapi.json) (OpenAPI 3.1; import into Postman or Insomnia). Request schemas are generated from the Zod schemas in `packages/shared`, and CI fails if this file is out of date.

Base URL: `http://localhost:4000` locally, or your deployed API.

## Conventions

- JSON in, JSON out. Dates: `YYYY-MM-DD` for calendar dates, ISO-8601 for timestamps.
- Every endpoint needs `Authorization: Bearer <accessToken>` except register, login, refresh, logout, health and the internal reminder trigger. Admin endpoints also need the ADMIN role.
- Success: `{ "success": true, "data": … }`. Lists: `{ "success": true, "data": [ … ], "meta": { "page", "limit", "total", "totalPages" } }`.
- Errors: `{ "success": false, "error": { "code", "message", "details"?: [{ "path", "message" }], "requestId" } }`. Codes: [ARCHITECTURE.md](../architecture/ARCHITECTURE.md#error-contract).
- Unknown body fields are rejected (`400`). Another user's resource returns `404`, exactly like a missing one.
- `PUT` replaces a resource (omitted optional fields reset to defaults). `PATCH` changes only the fields sent.

## Authentication

### POST /api/auth/register
```http
POST /api/auth/register
Content-Type: application/json

{ "fullName": "Demo User", "email": "demo@example.com", "password": "Demo@12345" }
```
`201`
```json
{ "success": true, "data": {
  "user": { "id": "0f8e…", "fullName": "Demo User", "email": "demo@example.com", "createdAt": "2026-10-07T09:00:00.000Z" },
  "accessToken": "eyJhbGciOiJIUzI1NiIs…", "expiresIn": 900 } }
```
Web clients also receive `Set-Cookie: pms_refresh=…; HttpOnly; Path=/api/auth; SameSite=Lax`. Mobile clients send `X-Client: mobile` and receive `"refreshToken"` in `data` instead.
Errors: `400` validation (password 8–128 characters with a letter and a number), `409 EMAIL_TAKEN`, `429`.

### POST /api/auth/login
Body `{ "email", "password" }` → `200` with the same shape. Wrong email and wrong password both return `401 INVALID_CREDENTIALS` "Invalid email or password". Failed attempts are limited per IP and per account (`429`).

### POST /api/auth/refresh
Web: no body (the cookie is sent automatically). Mobile: `X-Client: mobile` and `{ "refreshToken": "…" }`. Returns a new session and **revokes the token that was presented**.
- `401 UNAUTHENTICATED` — no token presented.
- `401 REFRESH_TOKEN_INVALID` — expired, revoked or unknown token ("Your session has expired. Please log in again.").
- `401 REFRESH_TOKEN_REUSED` — a rotated token was replayed; the whole session has been revoked.
- `409 REFRESH_CONFLICT` — a parallel request rotated it a moment ago; retry once.

### POST /api/auth/logout
Revokes the session's refresh tokens and clears the cookie. Idempotent. `204`.

### POST /api/auth/logout-all
Revokes every session of the user on every device. `204`.

### GET /api/auth/me
`200 { "success": true, "data": { "id", "fullName", "email", "createdAt" } }`

## Projects

### GET /api/projects
| Query | Values | Default |
|---|---|---|
| `search` | text (≤ 100), case-insensitive match on name | – |
| `status` | `NOT_STARTED` \| `IN_PROGRESS` \| `COMPLETED` | – |
| `page` | ≥ 1 | 1 |
| `limit` | 1–100 | 20 |
| `sortBy` | `name` \| `createdAt` \| `startDate` \| `endDate` \| `status` | `createdAt` |
| `sortOrder` | `asc` \| `desc` | `desc` |

```http
GET /api/projects?search=website&status=IN_PROGRESS&page=1&limit=20
```
```json
{ "success": true,
  "data": [{ "id": "9b2f…", "name": "Website Redesign", "description": "…", "status": "IN_PROGRESS",
             "startDate": "2026-09-16", "endDate": "2026-10-31", "createdAt": "…", "updatedAt": "…",
             "taskCount": 6, "completedTaskCount": 2 }],
  "meta": { "page": 1, "limit": 20, "total": 1, "totalPages": 1 } }
```

### POST /api/projects
```json
{ "name": "Website Redesign", "description": "optional", "status": "NOT_STARTED", "startDate": "2026-10-01", "endDate": "2026-11-15" }
```
Only `name` and `startDate` are required. `endDate` may be `null` and must not be before `startDate`. `201` with the project.

### GET /api/projects/:id · PUT /api/projects/:id · PATCH /api/projects/:id · DELETE /api/projects/:id
- `PUT` takes the same body as POST (full replacement).
- `PATCH` takes any subset, e.g. `{ "status": "COMPLETED" }`; date order is checked against the stored values.
- `DELETE` → `204`; the project's tasks are deleted too.
- Malformed ID → `400`; missing or not yours → `404`.

## Tasks

### GET /api/tasks
Same paging and sorting parameters as projects, plus:

| Query | Values |
|---|---|
| `status` | `PENDING` \| `IN_PROGRESS` \| `COMPLETED` |
| `priority` | `LOW` \| `MEDIUM` \| `HIGH` |
| `projectId` | UUID of one of your projects (`404` if it is not yours) |
| `dueOn` | `YYYY-MM-DD` — only tasks due on that date |
| `sortBy` | `name` \| `createdAt` \| `dueDate` \| `priority` \| `status` (priority sorts by importance; tasks without a due date sort last) |

```http
GET /api/tasks?search=login&status=PENDING&priority=HIGH
```
Each task includes its project: `"project": { "id": "…", "name": "Website Redesign" }`.

### POST /api/tasks
```json
{ "projectId": "9b2f…", "name": "Build pricing page", "description": "", "priority": "HIGH", "status": "PENDING", "dueDate": "2026-10-12" }
```
`projectId` and `name` are required; `priority` defaults to `MEDIUM`, `status` to `PENDING`. `404 "Project not found"` if the project is not yours.

### GET /api/tasks/:id · PUT /api/tasks/:id · PATCH /api/tasks/:id · DELETE /api/tasks/:id
- Mark completed: `PATCH /api/tasks/:id { "status": "COMPLETED" }` — the server sets `completedAt`; reopening clears it.
- Change priority: `PATCH /api/tasks/:id { "priority": "HIGH" }`.
- Moving a task (`projectId` in PUT/PATCH) requires the target project to be yours.

## Dashboard

### GET /api/dashboard?today=YYYY-MM-DD
`today` is optional: clients send their local date so "overdue" follows the user's timezone.
```json
{ "success": true, "data": {
  "totalProjects": 4, "totalTasks": 15, "completedTasks": 6, "pendingTasks": 7, "inProgressTasks": 2,
  "projectsInProgress": 2, "overdueTasks": 1,
  "projectStatusDistribution": { "NOT_STARTED": 1, "IN_PROGRESS": 2, "COMPLETED": 1 },
  "taskStatusDistribution": { "PENDING": 7, "IN_PROGRESS": 2, "COMPLETED": 6 },
  "taskPriorityDistribution": { "LOW": 4, "MEDIUM": 6, "HIGH": 5 },
  "recentProjects": [ … 5 most recently updated … ],
  "upcomingTasks": [ … 6 open tasks with a due date, overdue first … ] } }
```
"Pending tasks" means tasks whose status is `PENDING`; in-progress tasks are counted separately.

### GET /api/activity?limit=20
The user's audit log, newest first: `{ id, action, entityType, entityId, entityName, createdAt }`.

## Notifications

### POST /api/notifications/devices
Registers this phone for due-tomorrow reminders. Body: `{ "token": "ExponentPushToken[…]", "platform": "android", "timezone": "Asia/Kolkata" }` → `201`. Idempotent; a token registered by another account moves to the caller.

### DELETE /api/notifications/devices
Body `{ "token": "…" }` → `204`. Only removes your own token. Called by the app on sign-out.

### GET /api/notifications/devices · POST /api/notifications/test
Your registered phones · send a test push to them now.

### POST /api/internal/reminders/run
For a scheduler, not users: `Authorization: Bearer <CRON_SECRET>`. Sends each phone at most one reminder per local day at or after `REMINDER_HOUR` (default 18:00 on the phone's clock). `404` when `CRON_SECRET` is not configured.

## Admin (role ADMIN)

Everyone else gets `403 FORBIDDEN`. The role is checked against the database on every request.

### GET /api/admin/users?search=&role=&page=&limit=
Accounts with `role`, `projectCount`, `taskCount`, `lastActiveAt`. No project or task contents.

### PATCH /api/admin/users/:id/role
Body `{ "role": "ADMIN" | "USER" }` → updated user. `409 ROLE_CHANGE_NOT_ALLOWED` when demoting yourself or the last admin. Logged as `ROLE_CHANGED`.

### GET /api/admin/audit-logs?userId=&action=&page=&limit=
Audit entries across all users, newest first, each with its `actor`.

## System

`GET /api/health` → `{ "status": "ok", "database": "up" }` (also used by Render's and Docker's health checks).

## Try it with curl

```bash
API=http://localhost:4000
TOKEN=$(curl -s $API/api/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"demo@example.com","password":"Demo@12345"}' | node -pe 'JSON.parse(require("fs").readFileSync(0)).data.accessToken')
curl -s "$API/api/tasks?priority=HIGH&sortBy=dueDate&sortOrder=asc" -H "Authorization: Bearer $TOKEN"
```
