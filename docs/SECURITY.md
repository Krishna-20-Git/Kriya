# Security

Each item lists where it is implemented and the test that proves it.

| Control | Implementation | Verified by |
|---|---|---|
| Passwords hashed with bcrypt (cost 12), never stored or returned in plain text | `apps/api/src/utils/password.ts`; serializers whitelist fields | `auth.test.ts` "stores a bcrypt hash" · "never returns the password hash" |
| Same error for unknown email and wrong password; constant-time path via a dummy hash | `auth.service.ts` `login` | `auth.test.ts` "returns the same 401…" |
| JWT access tokens: HS256 pinned, issuer/audience checked, 15-minute expiry | `utils/tokens.ts` | `auth.test.ts`: expired, wrong signature, `alg: none`, malformed |
| Refresh tokens: random 256-bit, stored as SHA-256, rotated on every use, family revoked on reuse | `auth.service.ts` `refresh`, `refresh_tokens` table | `auth.test.ts` "rotation" suite |
| Logout and "sign out everywhere" revoke refresh tokens server-side | `auth.service.ts` | `auth.test.ts` "logout" suite |
| Protected routes require a valid Bearer token | `middleware/auth.middleware.ts`, `routes/index.ts` | `authorization.test.ts` "protected routes" |
| **Authorization / IDOR:** owner condition inside every SELECT, UPDATE and DELETE; tasks scoped through `projects.user_id` | `repositories/*.repository.ts` | `authorization.test.ts` (A vs B: read, PUT, PATCH, DELETE, list, search, inject task, move task, dashboard) and `scripts/verify-flow.mjs` steps 6–10 |
| **Role-based access control:** `/api/admin/*` requires role ADMIN; the role is read from the database on each request, never from the token or the client | `middleware/role.middleware.ts`, `routes/index.ts` | `admin.test.ts` "returns 403 to a regular user…", "applies a promotion immediately" |
| Roles cannot be self-assigned; admins cannot demote themselves; the last admin cannot be demoted (row locks prevent races); every role change is audit-logged with the actor | `registerSchema` (strict), `admin.service.ts` `changeRole` | `admin.test.ts` "ignores a role sent at registration", "never leaves the system without an admin" |
| Admins see accounts and counts only — not other users' projects or tasks; the admin audit log hides project/task names | `admin.repository.ts` selects no project/task columns and nulls `entity_name` for project/task entries | `admin.test.ts` "lists accounts with counts but no project or task contents", "still cannot read another user's projects" |
| Push devices belong to the signed-in user; a token can only be removed by its owner; sign-out and "sign out everywhere" stop reminders | `notification.repository.ts`, `auth.service.ts` `logoutAll` | `notifications.test.ts` "cannot unregister someone else's phone", "sign out everywhere stops reminders" |
| Cron endpoint disabled unless `CRON_SECRET` is set; secret compared in constant time | `notification.controller.ts` `runReminders` | `notifications.test.ts` "is disabled (404)…", "rejects a wrong secret…" |
| Reminder content only includes the device owner's open tasks | `notification.repository.ts` `openTasksDueOn` (owner join) | "only ever includes the device owner's tasks" |
| 404 (not 403) for other users' resources — existence is not revealed | services `notFound` | `authorization.test.ts` `expectNotFound` |
| Request IDs from the body are re-verified (task `projectId`) | `task.service.ts` `assertProjectOwned` | "cannot receive tasks created by another user" |
| Validation of every body, query and path parameter (Zod) | `packages/shared/src/schemas`, controllers | `projects.test.ts`, `tasks.test.ts`, `schemas.test.ts` |
| Mass-assignment protection: unknown fields rejected (`userId`, `role` …) | `z.strictObject` | "rejects … unknown field" tests |
| SQL injection: parameterised queries only (Drizzle); sort columns whitelisted; LIKE wildcards escaped | repositories, `utils/http.ts` `escapeLike` | "rejects a sort field that is not whitelisted", "treats LIKE wildcards … as literal" |
| Rate limiting: failed logins per IP and per account, register, refresh, all API traffic | `middleware/rate-limit.middleware.ts` | `auth.test.ts` "rate-limits repeated failed logins", "per-account login limit" |
| CORS allow-list with credentials; other origins get no CORS headers | `app.ts` | `dashboard.test.ts` "allows the web origin and blocks other origins" |
| CSRF: refresh cookie is HttpOnly, SameSite=Lax, path `/api/auth`; cookie endpoints reject foreign `Origin` | `auth.controller.ts`, `trusted-origin.middleware.ts` | `auth.test.ts` "rejects refresh from an untrusted browser origin" |
| Security headers (Helmet), no `X-Powered-By` | `app.ts` | "sets security headers and hides the framework" |
| Body size limit (100 KB) | `express.json({ limit })` | "rejects a body larger than 100 KB with 413" |
| No stack traces or SQL in responses; generic 500 with request ID | `middleware/error.middleware.ts` | error contract tests |
| Logs never contain passwords, tokens, cookies or auth headers; query strings dropped | `utils/logger.ts` (redaction), `request-logger.middleware.ts` | code review |
| Secrets only in environment variables; env validated at startup (weak/missing secret stops the server) | `config/env.ts`, `.gitignore`, `*.env.example` | start without `JWT_ACCESS_SECRET` |
| Mobile tokens in Expo SecureStore (Android Keystore); never AsyncStorage | `apps/mobile/src/lib/api.ts` `sessionStore` | code review |
| Mobile offline cache holds task data only and is wiped on logout / session expiry | `apps/mobile/src/lib/query-client.ts`, `auth.tsx` | code review |
| Web access token only in memory (not localStorage) | `apps/web/src/lib/api.ts` | `api.test.ts` |
| Database constraints as a second line of defence | `schema.ts`: FKs, enums, CHECK, unique `lower(email)` | migration |
| Docker image runs as non-root `node` user | `apps/api/Dockerfile` | |

## Final audit

- [x] Password hashing (bcrypt) · [x] No plaintext passwords · [x] JWT validation · [x] Token expiration
- [x] Protected routes · [x] Authorization · [x] IDOR prevention · [x] Zod validation
- [x] SQL injection protection · [x] CORS · [x] Helmet · [x] Rate limiting
- [x] Secure cookies · [x] SecureStore · [x] No secrets committed · [x] No sensitive logs
- [x] No stack traces in production · [x] No sensitive API responses
- [x] Role-based access control (server-enforced) · [x] Authenticated cron trigger

## Accepted trade-offs

- **Admins are not super-users of data.** An admin manages accounts and reads the audit log but cannot open other people's projects or tasks — the assignment's privacy rule ("users can only view their own data") still holds for admins.
- **Reminders after session expiry or an offline sign-out.** If a phone's session expires (7 days unused), or the user signs out while offline, the server keeps that phone's push token, so evening reminders continue until someone signs in on it again (the token then moves to the new user) — the phone stays signed out either way. An online sign-out or "sign out everywhere" stops them immediately.
- **Stateless access tokens.** After logout an already-issued access token remains valid for up to 15 minutes. Checking a denylist on every request would remove the benefit of JWTs; the short lifetime bounds the risk, and the refresh token, which matters more, is revoked immediately.
- **Account enumeration on register.** `409 EMAIL_TAKEN` reveals that an email is registered. The assignment requires unique emails with clear feedback; registration is rate-limited per IP.
- **Per-account login throttling** can lock a victim out for 15 minutes if someone deliberately fails logins for their email. This is the standard trade-off for stopping distributed password guessing.
- **IP-based limits behind proxies.** The web app reaches the API through two proxies (Vercel's rewrite, then Render's load balancer), so production uses `TRUST_PROXY=2` to see the real visitor IP. A client calling Render directly passes through only one proxy and can therefore choose the IP that per-IP limits count (by sending its own `X-Forwarded-For`). The protections that matter most do not depend on IPs: the per-account login limit stops password guessing, and passwords are bcrypt-hashed. The fix is to serve the API on one path only (e.g. a custom domain behind a single proxy) and set `TRUST_PROXY=1`.
- **Refresh on a very unreliable network.** Refresh tokens rotate on every use. If the server rotates the token but the response never reaches the phone, the phone still holds the old token: within 30 seconds it gets `409 REFRESH_CONFLICT`, and after that, reuse detection signs the session out (the safe outcome — it is indistinguishable from a stolen token). The user simply signs in again.
- **Seeded admin account.** `Admin@12345` is documented for local development only. On a hosted database the seed creates the admin account only with a private `SEED_ADMIN_PASSWORD`.
