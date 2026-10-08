# Kriya — Project Management System (Web + Android)

*Kriya (क्रिया) is Sanskrit for "action" — where plans turn into done work.*

A project and task manager with a **React web app** and a **React Native (Expo) Android app** that share **one Express API and one PostgreSQL database**. Sign in with the same account on either platform; a change made on one appears on the other after a refresh (pull-to-refresh on Android).

| | |
|---|---|
| **Source** | https://github.com/Krishna-20-Git/Kriya |
| **Web app** | https://kriya-eosin.vercel.app |
| **API** | https://pms-api-lyg7.onrender.com · Swagger: https://pms-api-lyg7.onrender.com/api/docs |
| **Android** | [Download the APK](https://expo.dev/accounts/krishna20/projects/kriya-pms/builds/93444ab8-4813-47db-8e62-34cebcd7037d) (Expo build page — scan the QR code or tap Install on the phone) |
| **Demo account** | `demo@example.com` / `Demo@12345` (test data only) |
| **Admin account** | Local: `admin@example.com` / `Admin@12345`. Deployed: same email, password shared privately with the evaluators (never published — see [RBAC](#role-based-access-control)) |

![Web dashboard](docs/screenshots/web-dashboard.png)

---

## Contents

[Features](#features) · [Tech stack](#tech-stack) · [Architecture](#architecture) · [Folder structure](#folder-structure) · [Database](#database) · [Authentication](#authentication) · [Security](#security) · [API](#api-documentation) · [Local setup](#local-setup) · [Environment variables](#environment-variables) · [Running the mobile app](#running-the-mobile-app) · [Testing](#testing) · [Docker](#docker) · [Deployment](#deployment) · [Cross-platform demo](#cross-platform-demo) · [Troubleshooting](#troubleshooting) · [Known limitations](#known-limitations) · [Future improvements](#future-improvements)

---

## Features

**Required**

- Register, log in, log out — one account on web and Android; emails are unique (case-insensitive); passwords hashed with bcrypt.
- Projects: create, view, edit, delete, list your own. Fields: name, description, status (Not Started / In Progress / Completed), start date, end date, created date.
- Tasks inside projects: create, edit, delete, mark completed. Fields: name, description, priority (Low / Medium / High), status (Pending / In Progress / Completed), due date, created date.
- Dashboard: total projects, total tasks, completed tasks, pending tasks, projects in progress — computed live from the signed-in user's data.
- Search projects and tasks by name; filter projects by status; filter tasks by status and priority. Filtering happens on the server.
- Android: register/login/logout, dashboard, projects (search, filter, sort, create, edit, delete), project tasks, create/edit/delete tasks, complete tasks, change status and priority, search and filter, pull-to-refresh, token in secure device storage, session-expiry redirect with a message, clear no-network states.

**Bonus (implemented and tested)**

| Bonus | Where |
|---|---|
| Role-based access control (USER / ADMIN) | `role` column, `requireRole('ADMIN')` middleware, `/api/admin/*`, web **Admin** page — see [RBAC](#role-based-access-control) |
| Push notifications for tasks due tomorrow | Expo push + hourly job (`/api/internal/reminders/run`, GitHub Actions schedule) with an on-device fallback — see [Reminders](#due-tomorrow-reminders) |
| Refresh tokens with rotation and reuse detection | `apps/api/src/services/auth.service.ts` |
| Pagination and safe (whitelisted) sorting | `GET /api/projects`, `GET /api/tasks` |
| Audit log of user actions | `audit_logs` table, `GET /api/activity`, web Settings page |
| Shared types and validation for API, web and mobile | `packages/shared` |
| Offline viewing of tasks on Android | TanStack Query cache persisted to AsyncStorage (tokens stay in SecureStore) |
| Unit and integration tests (224) | Vitest + Supertest against real PostgreSQL |
| Docker | `apps/api/Dockerfile`, `docker-compose.yml` |
| CI/CD | `.github/workflows/ci.yml` — lint, typecheck, tests, builds, Android bundle; Render and Vercel deploy on every push to `main` |
| Light / dark / system theme | Settings on web and Android; WCAG AA contrast checked in tests |

Every bonus item in the assignment is implemented.

### Role-based access control

Two roles: **USER** (everyone, by default) and **ADMIN**.

| Capability | USER | ADMIN | Why |
|---|---|---|---|
| Own projects, tasks, dashboard, theme, reminders | Yes | Yes | Admins are users too; their own work is unchanged. |
| Read or change other users' projects and tasks | No (404) | No (404) | The assignment requires that users only see their own data. Admin duties (accounts, security review) don't need task contents, so least privilege applies. |
| List all accounts with project/task counts and last activity | No (403) | Yes | Needed to manage accounts; counts show activity without exposing content. |
| Promote a user to admin / demote an admin | No (403) | Yes | Someone has to manage roles; letting users do it would be privilege escalation. |
| Demote yourself | – | No (409) | Prevents an accidental lock-out; another admin must do it. |
| Demote the last admin | – | No (409) | The system must always have someone who can manage roles. |
| Read the system-wide audit log (filter by user / action) | No (403) | Yes | Accountability and incident review (e.g. who changed a role, suspicious sign-ins). |
| Edit or delete audit entries | No | No | The log must be tamper-evident, even against admins. |
| See passwords, password hashes or tokens | No | No | Never exposed by any endpoint; hashes and tokens are one-way. |
| Delete accounts or reset passwords | No | No | Not built: destructive and outside the brief. "Sign out everywhere" is per user. |

- The role is **read from the database on every admin request** (not trusted from the JWT), so a demotion takes effect immediately. Both apps also re-read the profile when they regain focus (web: also every minute and on any 403), so the Admin link appears or disappears without signing out.
- Clients can never set a role: registration rejects unknown fields, and only an admin (or the server console) can change one.
- Safeguards: an admin cannot remove their own admin role, and the last admin cannot be demoted (`409 ROLE_CHANGE_NOT_ALLOWED`); rows are locked so concurrent changes cannot bypass this. Every change is audit-logged with who did it.
- First admin on a fresh database: `npm run user:role -w @pms/api -- you@example.com ADMIN`. The seed creates `admin@example.com` with the documented password **only on a local database**; on a hosted database it is created only if `SEED_ADMIN_PASSWORD` is set, so a public repo never exposes a working admin password.
- The admin audit log shows who did what and when, but hides project and task names (user content); account-level entries such as role changes keep their details.
- Web: an **Admin** item appears in the sidebar for admins only; `/admin` shows 404 to everyone else. Android shows your role in Settings.

### Due-tomorrow reminders

At 18:00 on the phone's own clock, the Android app gets a notification listing the open tasks due tomorrow ("2 tasks due tomorrow — Build pricing page, Write copy"). Tapping it opens the task (or the task list if there are several).

- **Push (APK):** after sign-in the phone registers its Expo push token and time zone (`POST /api/notifications/devices`). An hourly job (`POST /api/internal/reminders/run`, triggered by [`.github/workflows/reminders.yml`](.github/workflows/reminders.yml) or `REMINDER_SCHEDULER=true`) sends each phone at most one reminder per local day — each device is atomically claimed for the date before sending, so overlapping runs never double-send. Uninstalled apps' tokens are removed; transient failures are retried next hour.
- **On-device fallback (Expo Go / no push setup):** Expo Go on Android does not support remote push, so the app schedules the same reminder locally from the tasks due tomorrow, refreshed whenever the app opens or a task changes.
- Settings → **Reminders**: on/off switch, delivery status and **Send test notification**. Signing out unregisters the phone; "Sign out everywhere" unregisters every phone.
- Push in the APK needs a one-time EAS + Firebase setup: [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md#push-notifications).

## Screenshots

| Web — tasks | Web — project detail | Android — dashboard | Android — tasks |
|---|---|---|---|
| ![](docs/screenshots/web-tasks.png) | ![](docs/screenshots/web-project-detail.png) | ![](docs/screenshots/android-dashboard.png) | ![](docs/screenshots/android-tasks.png) |

More in [`docs/screenshots`](docs/screenshots). Android screenshots were rendered from the app's own components through react-native-web for documentation; record the real device for the demo video.

## Tech stack

| Layer | Choice | Why |
|---|---|---|
| Web | React 19, Vite, TypeScript, Tailwind CSS 4, React Router 7, TanStack Query, React Hook Form, Zod | Fast dev server, typed end to end, server state handled by a cache instead of hand-written effects |
| Mobile | React Native 0.86, Expo SDK 57, Expo Router, Expo SecureStore, NetInfo, TanStack Query | Same language and validation as web; SecureStore uses the Android Keystore |
| API | Node 22, Express 5, TypeScript, Zod, jsonwebtoken, bcrypt, Helmet, CORS, express-rate-limit, pino | Small, explicit middleware pipeline that is easy to explain and test |
| Database | PostgreSQL 16, Drizzle ORM, SQL migrations | Relational data with foreign keys, enums, check constraints; parameterised queries only |
| Docs | OpenAPI 3.1 + Swagger UI | Request schemas generated from the same Zod schemas the API validates with |
| Tests | Vitest, Supertest, React Testing Library | Integration tests hit a real database, not mocks |

**Why Drizzle instead of Prisma?** Both are parameterised ORMs that satisfy the assignment. Drizzle keeps the generated SQL migrations in the repository (`apps/api/drizzle/`), has no separate query-engine binary, and its query builder maps 1:1 to SQL, which makes ownership filters easy to read in review.

## Architecture

```mermaid
flowchart LR
  subgraph Clients
    W["Web app (React)<br/>access token in memory<br/>refresh token: HttpOnly cookie"]
    M["Android app (Expo)<br/>tokens in SecureStore<br/>offline cache in AsyncStorage"]
  end
  W -- "/api/* (same origin via Vercel rewrite)" --> A
  M -- "HTTPS + X-Client: mobile" --> A
  A["Express API<br/>helmet → CORS → rate limit → JWT auth<br/>→ Zod validation → controller → service → repository"]
  A -- "Drizzle (parameterised SQL)" --> D[("PostgreSQL")]
  S["packages/shared<br/>Zod schemas · enums · types"] -.-> W & M & A
```

- **One API, two clients.** Both apps call the same endpoints. The only difference is how the refresh token travels: an HttpOnly cookie for the browser, the JSON body (stored in SecureStore) for the phone.
- **Layers.** Routes declare middleware and map to controllers; controllers parse input and shape responses; services hold business rules and transactions; repositories hold every SQL query, each one scoped to the owner.
- **Shared package.** Zod schemas validate API requests *and* drive the web and mobile forms, so a rule such as "end date cannot be before start date" is written once.

Details: [`docs/architecture/ARCHITECTURE.md`](docs/architecture/ARCHITECTURE.md).

## Folder structure

```
apps/
  api/        Express API — src/{config,controllers,routes,services,repositories,middleware,db,docs,utils,test}
  web/        React + Vite web app — src/{pages,components,layouts,auth,lib}
  mobile/     Expo Router app — app/ (screens and navigation), src/{components,lib}
packages/
  shared/     Zod schemas, enums, API types, date helpers (used by all three apps)
docs/         architecture, database (ER diagram), api (OpenAPI), security, testing, deployment, demo script, interview notes
scripts/      verify-flow.mjs — runs the evaluator scenario against any running API
```

## Database

![ER diagram](docs/database/ER-DIAGRAM.png)

`users 1─N projects 1─N tasks`, plus `refresh_tokens`, `audit_logs` and `notification_devices` (each linked to its user); `users.role` is `USER` or `ADMIN`. UUID keys, foreign keys with `ON DELETE CASCADE`, Postgres enums for statuses and priorities, `CHECK (end_date >= start_date)`, unique index on `lower(email)`, and composite indexes that start with the owner column (`projects(user_id, status)`, `tasks(project_id, status)` …). Tasks reach their owner through `projects.user_id`, so ownership is stored in exactly one place.

Full schema, index rationale and normalisation notes: [`docs/database/SCHEMA.md`](docs/database/SCHEMA.md). Editable diagram source: [`ER-DIAGRAM.mmd`](docs/database/ER-DIAGRAM.mmd).

## Authentication

| | Web | Android |
|---|---|---|
| Access token (JWT, HS256, 15 min) | JavaScript memory only | Expo SecureStore |
| Refresh token (random 256-bit, 7 days, rotates on use) | HttpOnly, SameSite=Lax cookie, path `/api/auth` | Expo SecureStore (Android Keystore) |
| Expired access token | Client refreshes once and retries the request | Same |
| Session ended (refresh token expired or revoked) | Redirect to login: "Your session has expired. Please log in again." | Same |

The database stores only a SHA-256 hash of each refresh token. Reusing a rotated token revokes that whole login session (stolen-token detection). Logout revokes the session; **Sign out everywhere** revokes every device. Flow diagrams: [`docs/architecture/ARCHITECTURE.md`](docs/architecture/ARCHITECTURE.md#authentication-flow).

## Security

- **Authorization:** every project and task query includes the owner condition in the SQL itself — `WHERE id = $1 AND user_id = $2` — including UPDATE and DELETE, so there is no check-then-write gap. Another user's IDs return **404**, indistinguishable from IDs that do not exist. A task's `projectId` from the request body is verified before any write.
- **Validation:** Zod on every body, query string and path parameter; unknown fields rejected (no mass assignment); enum, date, length and UUID checks; 100 KB body limit.
- **SQL injection:** only parameterised queries through Drizzle; sort columns come from a whitelist; LIKE wildcards in searches are escaped.
- **Passwords:** bcrypt (cost 12); a dummy hash is compared for unknown emails, so timing does not reveal which emails exist; the same error for wrong email and wrong password.
- **Rate limits:** failed logins per IP and per account, registrations, refreshes, and overall API traffic; JSON 429 responses.
- **HTTP:** Helmet headers, CORS allow-list with credentials, CSRF origin check on cookie endpoints, no `X-Powered-By`, request IDs.
- **Data exposure:** responses are built by whitelisting serializers (password hashes cannot leak); logs redact authorization headers, cookies, passwords and tokens; production errors never include stack traces.

Checklist with file references: [`docs/SECURITY.md`](docs/SECURITY.md).

## API documentation

- Interactive: **`/api/docs`** (Swagger UI) on any running API.
- Static: [`docs/api/openapi.json`](docs/api/openapi.json) (importable into Postman) and [`docs/api/API.md`](docs/api/API.md) with examples.

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/api/auth/register` | – | Create account, start session |
| POST | `/api/auth/login` | – | Log in |
| POST | `/api/auth/refresh` | refresh token | Rotate session |
| POST | `/api/auth/logout` | refresh token | Revoke session |
| POST | `/api/auth/logout-all` | Bearer token | Revoke all sessions |
| GET | `/api/auth/me` | Bearer token | Current user |
| GET / POST | `/api/projects` | Bearer token | List (search, status, page, limit, sortBy, sortOrder) / create |
| GET / PUT / PATCH / DELETE | `/api/projects/:id` | Bearer token | Read / replace / partial update / delete (cascades tasks) |
| GET / POST | `/api/tasks` | Bearer token | List (search, status, priority, projectId, page, limit, sortBy, sortOrder) / create |
| GET / PUT / PATCH / DELETE | `/api/tasks/:id` | Bearer token | Read / replace / partial update / delete |
| GET | `/api/dashboard` | Bearer token | Statistics, recent projects, due-soon tasks |
| GET | `/api/activity` | Bearer token | Audit log for the current user |
| GET / POST / DELETE | `/api/notifications/devices` | Bearer token | List / register / unregister this phone for due-tomorrow reminders |
| POST | `/api/notifications/test` | Bearer token | Send a test push to your phones |
| GET | `/api/admin/users` | ADMIN | All accounts with counts (search, role, page, limit) |
| PATCH | `/api/admin/users/:id/role` | ADMIN | Promote / demote |
| GET | `/api/admin/audit-logs` | ADMIN | System-wide audit log (userId, action, page, limit) |
| POST | `/api/internal/reminders/run` | `CRON_SECRET` | Run the reminder job (for a scheduler) |
| GET | `/api/health` | – | Liveness + database check |

Responses: `{ "success": true, "data": … }` (lists add `meta: { page, limit, total, totalPages }`); errors: `{ "success": false, "error": { "code", "message", "details"? } }`.

## Local setup

**Prerequisites:** Node.js 22 (or ≥ 20.19), npm 10+, PostgreSQL 14+ **or** Docker. For Android: a phone with **Expo Go** (a version that supports Expo SDK 57 — update it from the Play Store) or an Android Studio emulator.

```bash
git clone https://github.com/Krishna-20-Git/Kriya.git
cd Kriya
npm ci                                   # installs all workspaces from the lockfile
npm run build:shared                     # compiles packages/shared (used by every app)

# Database — pick one
createdb pms                             # local PostgreSQL
docker compose up -d db                  # or Docker: PostgreSQL 16 on localhost:5432 (user/password postgres)

cp apps/api/.env.example apps/api/.env   # DATABASE_URL already matches both options above
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
                                         # paste the output as JWT_ACCESS_SECRET in apps/api/.env
npm run db:migrate                       # applies apps/api/drizzle/*.sql
npm run db:seed                          # demo@example.com / Demo@12345 and (local only) admin@example.com / Admin@12345

# Run
npm run dev:api                          # http://localhost:4000  (Swagger: /api/docs)
npm run dev:web                          # http://localhost:5173  (proxies /api to :4000)
npm run dev:mobile                       # Expo — press "a" for the Android emulator
```

Open the web app at http://localhost:5173 and sign in with `demo@example.com` / `Demo@12345`.

**Windows (PowerShell):** the same commands work; use `Copy-Item apps/api/.env.example apps/api/.env` if `cp` is unavailable. If port 5432 is already taken by another PostgreSQL, change the left side of `ports` in `docker-compose.yml` (e.g. `'5433:5432'`) and the port in `DATABASE_URL` to match.

**Test database** (only for `npm test`): `createdb pms_test`, or with Docker `docker compose exec db createdb -U postgres pms_test`.

> Use `npm ci` (not `npm install`) with npm 10. If you change dependencies, regenerate the lockfile with npm 11 (`npx npm@11 install`) — npm 10 has a known resolver bug with this workspace layout.

## Environment variables

**API — `apps/api/.env`** (full list with comments in [`.env.example`](apps/api/.env.example))

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `DATABASE_URL` | yes | – | PostgreSQL connection string |
| `JWT_ACCESS_SECRET` | yes | – | HMAC secret for access tokens, ≥ 32 characters |
| `WEB_ORIGIN` | prod | `http://localhost:5173` | Comma-separated browser origins allowed by CORS |
| `PORT` | – | `4000` | |
| `NODE_ENV` | – | `development` | `production` enables secure cookies and JSON logs |
| `DATABASE_SSL` | – | `false` | `true` for Neon / Render / Supabase |
| `TRUST_PROXY` | – | `0` | Number of proxies in front of the API (`2` for Vercel → Render) |
| `ACCESS_TOKEN_TTL_SECONDS` | – | `900` | Lower it (e.g. `30`) to demonstrate expiry handling |
| `REFRESH_TOKEN_TTL_DAYS` | – | `7` | Sliding session length |
| `COOKIE_SAMESITE` / `COOKIE_SECURE` | – | `lax` / auto | Refresh-cookie attributes |
| `BCRYPT_ROUNDS` | – | `12` | |
| `RATE_LIMIT_*` | – | see file | Login (per IP and per account), register, refresh, API |
| `REMINDER_HOUR` | – | `18` | Local hour (phone's clock) for due-tomorrow reminders |
| `REMINDER_SCHEDULER` | – | `false` | Run the reminder job in-process every 15 min |
| `CRON_SECRET` | – | unset | Enables `POST /api/internal/reminders/run` for an external scheduler (≥ 32 chars) |
| `EXPO_ACCESS_TOKEN` | – | unset | Only if Expo "enhanced push security" is on |
| `SEED_ADMIN_PASSWORD` | – | unset | Seed only: password for `admin@example.com` on a non-local database (locally the seed uses `Admin@12345`) |
| `TEST_DATABASE_URL` | – | `…/pms_test` | Tests only: the database the API test suite rebuilds |

There is deliberately **no `JWT_REFRESH_SECRET`**: refresh tokens are random opaque strings checked against the database (so they can be revoked), not JWTs.

**Web — `apps/web/.env`** (optional; [`.env.example`](apps/web/.env.example))

| Variable | Default | Purpose |
|---|---|---|
| `VITE_API_URL` | empty | Leave empty: the app calls `/api` on its own origin (Vite proxy locally, Vercel rewrite in production) |
| `API_PROXY_TARGET` | `http://localhost:4000` | Where the Vite dev server forwards `/api` |

**Mobile — `apps/mobile/.env`** ([`.env.example`](apps/mobile/.env.example)) — `EXPO_PUBLIC_*` values are built into the app, so never put secrets here; restart Expo with `npx expo start -c` after changing them.

| Variable | Required | Purpose |
|---|---|---|
| `EXPO_PUBLIC_API_URL` | yes | Base URL of the API — the same backend as the web app (see the table below) |
| `EXPO_PUBLIC_WEB_URL` | no | The web app's address; admins get an "Open Admin on the web" button in Settings |

For APK builds the same variables are set per profile in [`apps/mobile/eas.json`](apps/mobile/eas.json).

## Running the mobile app

The app talks to whatever `EXPO_PUBLIC_API_URL` points at — the same API as the web app.

| Target | `EXPO_PUBLIC_API_URL` |
|---|---|
| Android emulator → local API | `http://10.0.2.2:4000` (the emulator's alias for your computer) |
| Phone with Expo Go → local API | `http://<your-computer-LAN-IP>:4000` (same Wi-Fi) |
| Anything → deployed API | `https://<your-api>.onrender.com` |

```bash
cd apps/mobile
cp .env.example .env          # set EXPO_PUBLIC_API_URL
npx expo start                # scan the QR code with Expo Go, or press "a"
```

**Phone on the same Wi-Fi:** find your computer's address with `ipconfig` (Windows) or `ipconfig getifaddr en0` (macOS) — use the Wi-Fi adapter, not virtual ones such as WSL/Docker — and check it from the phone's browser first: `http://<ip>:4000/api/health` must show `"status":"ok"`. Windows may also need the network set to *Private* (Settings → Network) so the firewall lets the phone connect.

### Running the mobile app against the deployed backend

No local server is needed — only the deployed API URL.

1. **With Expo Go (quickest):** in `apps/mobile/.env` set `EXPO_PUBLIC_API_URL=https://<your-api>.onrender.com`, run `npx expo start -c`, scan the QR code. Settings → Connection shows the API URL the app is using.
2. **As an installed APK:** set the same URL in `apps/mobile/eas.json` (`preview` profile) and build it (below). The APK then works on any network.

Free Render instances sleep when idle: open `https://<your-api>.onrender.com/api/health` once before testing, or the first request may take up to a minute.

**Building the APK against the deployed backend:** set the URL in `apps/mobile/eas.json` (`preview` profile), then:

```bash
npm i -g eas-cli && eas login
cd apps/mobile && eas build --platform android --profile preview
```

EAS prints a download link for the `.apk` — that link (or the file) is the Android submission. Step-by-step: [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md#4-android-apk).

## Testing

```bash
npm test               # shared unit tests + API integration tests + web unit tests
npm run lint           # ESLint across the monorepo
npm run typecheck      # shared, API, web and mobile
npm run verify:flow    # end-to-end evaluator scenario against a running API (add a URL to test a deployment)
```

| Suite | Tests | What it proves |
|---|---|---|
| `packages/shared` | 38 | Validation rules: emails, passwords, impossible dates, enums, unknown fields, sort whitelist, roles, push tokens, time zones |
| `apps/api` (integration, real PostgreSQL) | 133 | Auth, token expiry/rotation/reuse, rate limits, CRUD, **cross-user access attempts (IDOR)**, **RBAC (403s, last-admin and self-demotion rules, immediate effect)**, **reminder job (time zones, once-per-day, failures)**, validation, pagination, dashboard maths, CORS, headers |
| `apps/web` | 53 | Token refresh single-flight, session-expiry signalling, error states, admin route guard, page clamping after deletes, WCAG AA contrast of both themes |
| `scripts/verify-flow.mjs` | 29 checks | The 27-step evaluator scenario, run against a live server |

API tests need a database: `TEST_DATABASE_URL` (default `postgres://postgres:postgres@localhost:5432/pms_test`). The schema is rebuilt from the committed migrations on every run. Details and the manual mobile checklist: [`docs/TESTING.md`](docs/TESTING.md).

## Docker

```bash
docker compose up --build                       # PostgreSQL + API on :4000 (migrations run on start)
docker compose exec api node dist/db/seed.js    # optional demo data
```

The image is multi-stage: TypeScript is compiled in a build stage and the runtime stage contains only production dependencies, runs as the non-root `node` user and has a health check. The web and mobile apps run outside Docker and point at port 4000.

## Deployment

Recommended free setup — **Neon** (PostgreSQL) + **Render** (API) + **Vercel** (web) + **EAS** (APK):

1. **Database:** create a Neon project; copy the connection string.
2. **API on Render:** New → Blueprint → this repo (uses [`render.yaml`](render.yaml)). Set `DATABASE_URL` and `WEB_ORIGIN`. Migrations run on start. Seed once from your machine: `DATABASE_URL=<neon-url> DATABASE_SSL=true npm run db:seed`.
3. **Web on Vercel:** import the repo, root directory `apps/web`, framework Vite. In [`apps/web/vercel.json`](apps/web/vercel.json) replace `REPLACE-WITH-YOUR-API` with the Render hostname — Vercel then serves `/api` on the web app's own domain, so the refresh cookie is first-party.
4. **APK:** put the Render URL in `apps/mobile/eas.json` and run `eas build` (above).
5. **Check it:** `node scripts/verify-flow.mjs https://<your-api>.onrender.com` should print 29 passed.

Exact settings and gotchas (Render cold starts, cookie settings without the proxy): [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md).

## Cross-platform demo

Five-minute script with timings: [`docs/DEMO_SCRIPT.md`](docs/DEMO_SCRIPT.md). In short: log in on web → create a project and a task → log in on Android with the same account → pull to refresh, the task is there → change its status and priority on the phone → refresh the web page, the change is there.

## Troubleshooting

| Symptom | Fix |
|---|---|
| `Invalid environment configuration` on API start | A required variable is missing or too short — the message names it. |
| Web shows "Unable to connect to the server" | API not running on :4000, or `API_PROXY_TARGET` points elsewhere. |
| Android shows "Unable to connect to the server" | Emulator must use `10.0.2.2`, not `localhost`; a phone must use your computer's LAN IP; restart Expo after editing `.env`. |
| First request after a while takes ~50 s | Render's free tier sleeps. Open `/api/health` before a demo. |
| Login works but a refresh logs you out (web, deployed) | The `/api` rewrite in `apps/web/vercel.json` was not updated, so the cookie is cross-site. |
| `npm install` fails with `Cannot read properties of null (reading 'edgesOut')` | npm 10 resolver bug — use `npm ci`, or `npx npm@11 install`. |
| API tests fail to start | Create the test database: `createdb pms_test` (or set `TEST_DATABASE_URL`). |
| `does not provide an export named …` when starting the API | The shared package is out of date: `npm run build:shared` (the `dev:*` and `db:*` scripts do this automatically). |
| `port is already allocated` from Docker | Another PostgreSQL uses 5432: change the host port in `docker-compose.yml` and in `DATABASE_URL`. |
| Phone worked yesterday, now "Unable to connect" | Your computer's Wi-Fi IP changed: run `ipconfig`, update `EXPO_PUBLIC_API_URL`, then `npx expo start -c` and scan the new QR code. |
| Expo Go says the project is incompatible | Update Expo Go from the Play Store (the app uses Expo SDK 57). |

## Known limitations

- Access tokens are stateless: after logout an already-issued access token stays valid until it expires (≤ 15 minutes). Refresh tokens are revoked immediately.
- Changes appear on the other platform after a refresh, pull-to-refresh or returning to the app/tab — not instantly (no WebSockets).
- The admin area is web-only by design (rare, high-risk, detail-heavy work belongs on the web console). Android shows the role, and admins get an **Administration** card in Settings that opens the web Admin page (`EXPO_PUBLIC_WEB_URL`).
- In Expo Go, reminders are scheduled on the phone (Expo Go cannot receive remote push on Android); server push works in the APK after the EAS/Firebase setup.
- The per-account login limit can be used to temporarily lock an account (15 minutes) — the usual trade-off of account-based throttling.
- The Android Projects tab and the task form's project picker (both apps) load the 100 most recent projects; the web Projects page is fully paginated.
- See [`docs/SECURITY.md`](docs/SECURITY.md#accepted-trade-offs) for the security trade-offs (proxy headers and per-IP limits, refresh tokens on very unreliable networks).
- The Docker image and the CI workflow were written and their steps replayed outside Docker during development; run `docker compose up --build` once on your machine to confirm.

## Future improvements

- Real-time sync with WebSockets or server-sent events.
- Trigram index (`pg_trgm`) for fast substring search on large datasets.
- Shared team projects with per-project roles (owner / editor / viewer), building on the existing USER/ADMIN roles.
- End-to-end tests with Playwright (web) and Maestro (Android) in CI.
