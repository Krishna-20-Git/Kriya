# Requirements checklist

Mapped to the assignment PDF. Checked items are implemented and verified.

## Authentication
- [x] Register — `POST /api/auth/register`; web `/register`; Android Register screen
- [x] Login — `POST /api/auth/login`
- [x] Logout — `POST /api/auth/logout` (revokes the session server-side)
- [x] Full name, email, password fields
- [x] Unique email (case-insensitive, unique DB index + 409)
- [x] Passwords hashed with bcrypt, never stored or returned in plain text
- [x] Stays logged in until logout or token expiry (refresh-token rotation)
- [x] Same account on web and mobile (`verify-flow.mjs` steps 11–12)
- [x] Token expiration handled with a clear message on both clients

## Projects
- [x] Create · View · Edit · Delete · List own projects
- [x] Name, description, status (Not Started / In Progress / Completed), start date, end date, created date
- [x] Search by name (server-side)
- [x] Filter by status
- [x] Ownership enforced in SQL (`authorization.test.ts`)

## Tasks
- [x] Multiple tasks per project
- [x] Create · Edit · Delete · Mark completed · View tasks under a project
- [x] Name, description, priority (Low / Medium / High), status (Pending / In Progress / Completed), due date, created date
- [x] Search by name · Filter by status · Filter by priority
- [x] Ownership enforced through the project

## Dashboard
- [x] Total projects · Total tasks · Completed tasks · Pending tasks · Projects in progress
- [x] Computed from the authenticated user's data (`dashboard.test.ts`)

## Mobile (Android)
- [x] React Native + Expo, Android
- [x] Register · Login · Logout with the same account
- [x] Dashboard
- [x] All projects (search, status filter, sort) and the tasks under each project
- [x] Project details with every field (name, description, status, start, end, created date), plus create, edit and delete
- [x] Create · Edit · Delete tasks
- [x] Mark completed · Change status · Change priority
- [x] Search tasks · Filter by status and priority
- [x] Pull-to-refresh on dashboard, projects, project detail, tasks, task detail
- [x] Token in secure storage (Expo SecureStore → Android Keystore)
- [x] Expired token → login screen with a clear message
- [x] No network → clear message (banner, offline state with Retry, alerts), never a blank screen
- [x] Same backend and database as the web app (no separate mobile backend)

## Web
- [x] React (Vite) · responsive (320–1440 px checked) · component structure
- [x] Form validation · loading indicators · error handling · empty states

## Backend
- [x] Node.js + Express, one backend for both apps
- [x] REST architecture, organised routes, middleware, centralised error handling, structured logging
- [x] CORS configured for the web app's domain
- [x] Every required endpoint (`dashboard.test.ts` checks the OpenAPI document lists them)

## Required endpoints — used by both apps

The assignment requires the web app and the mobile app to use the same endpoints. Each row names where each client calls it.

| Endpoint | Web (`apps/web/src`) | Android (`apps/mobile/src`) |
|---|---|---|
| `POST /api/auth/register` | `auth/AuthProvider.tsx` | `lib/auth.tsx` → `lib/api.ts` `authRequest` |
| `POST /api/auth/login` | `auth/AuthProvider.tsx` | `lib/auth.tsx` → `lib/api.ts` `authRequest` |
| `POST /api/auth/logout` | `auth/AuthProvider.tsx` | `lib/api.ts` `logoutRequest` |
| `GET /api/auth/me` | `auth/AuthProvider.tsx` `refreshUser` (focus, every minute, on 403) | `lib/auth.tsx` (app open / foreground) |
| `GET /api/projects` | `lib/queries.ts` `useProjects`, `useProjectOptions` | `lib/queries.ts` `useProjects` |
| `GET /api/projects/{id}` | `lib/queries.ts` `useProject` | `lib/queries.ts` `useProject` |
| `POST /api/projects` | `lib/queries.ts` `useCreateProject` | `lib/queries.ts` `useCreateProject` |
| `PUT /api/projects/{id}` | `lib/queries.ts` `useUpdateProject` | `lib/queries.ts` `useUpdateProject` |
| `DELETE /api/projects/{id}` | `lib/queries.ts` `useDeleteProject` | `lib/queries.ts` `useDeleteProject` |
| `GET /api/tasks` | `lib/queries.ts` `useTasks` | `lib/queries.ts` `useTaskList` |
| `GET /api/tasks/{id}` | `lib/queries.ts` `useTask` (edit dialog loads the latest copy) | `lib/queries.ts` `useTask` (task screen) |
| `POST /api/tasks` | `lib/queries.ts` `useCreateTask` | `lib/queries.ts` `useCreateTask` |
| `PUT /api/tasks/{id}` | `lib/queries.ts` `useUpdateTask` | `lib/queries.ts` `useUpdateTask` |
| `DELETE /api/tasks/{id}` | `lib/queries.ts` `useDeleteTask` | `lib/queries.ts` `useDeleteTask` |
| `GET /api/dashboard` | `lib/queries.ts` `useDashboard` | `lib/queries.ts` `useDashboard` |

Extra endpoints beyond the minimum: `PATCH /api/projects/{id}` and `PATCH /api/tasks/{id}` (quick status/priority changes), `POST /api/auth/refresh`, `POST /api/auth/logout-all`, `GET /api/activity`, `/api/admin/*`, `/api/notifications/*`, `GET /api/health`. Full reference: Swagger at `/api/docs`.

## Database
- [x] PostgreSQL · relational design · foreign keys · normalised (3NF) · indexes · constraints

## Security
- [x] bcrypt · JWT · auth middleware · protected routes
- [x] Users can only view, modify and delete their own data (web and mobile use the same API)
- [x] Backend validation of every request (required fields, email format, dates, empty strings, enums)
- [x] No sensitive data in responses
- [x] SQL injection protection (ORM, parameterised queries, whitelisted sorting)
- [x] Rate limiting on authentication endpoints

## Documentation
- [x] Setup for backend, web and mobile — `README.md`
- [x] Environment variables — `README.md`, `*.env.example`
- [x] Database setup — `README.md`, `docs/database/SCHEMA.md`
- [x] API documentation — Swagger `/api/docs`, `docs/api/API.md`, `docs/api/openapi.json`
- [x] Running the mobile app against the deployed backend — `README.md`, `docs/DEPLOYMENT.md`
- [x] ER diagram — `docs/database/ER-DIAGRAM.png` (+ `.mmd` source)

## Bonus
- [x] Docker · [x] Unit tests · [x] Integration tests · [x] Pagination · [x] Sorting · [x] Audit logs
- [x] Light / dark / system theme on web and Android (WCAG AA contrast checked in `theme.test.ts`)
- [x] CI/CD pipeline (CI on every push; Render/Vercel deploy from `main`; scheduled reminder workflow) · [x] Refresh tokens · [x] Offline viewing of tasks on mobile · [x] Shared types and validation
- [x] Role-based access control — USER / ADMIN, `requireRole` middleware, admin API and web Admin page (`admin.test.ts`)
- [x] Push notifications for tasks due tomorrow — Expo push + hourly job, on-device fallback in Expo Go (`notifications.test.ts`)

## Submission
- [x] Public GitHub repository
- [x] Web deployment URL
- [x] Backend deployment URL
- [x] Android APK
- [x] 5-minute screen recording (`docs/DEMO_SCRIPT.md`)
