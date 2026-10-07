# Interview notes

Short, defensible answers with pointers into the code. Read the code paths once before the review.

## Technology choices

**Why React (Vite) rather than Next.js?** The web app is a fully authenticated dashboard with no SEO or server rendering needs, so an SPA is simpler: one static build on a CDN and one API. Vite gives instant dev reloads. Next.js would add a second server runtime without a benefit here.

**Why React Native with Expo?** Same language, same validation package and the same data-fetching library as the web app. Expo provides SecureStore (Keystore-backed storage), file-based routing, and EAS to build an APK without a local Android toolchain.

**Why Express?** The assignment allows Express or NestJS. Express keeps the request pipeline explicit — helmet → CORS → rate limit → auth → validation → controller — which is easy to explain line by line. Structure comes from layering (routes / controllers / services / repositories), not the framework. Express 5 also forwards async errors to the error handler natively.

**Why PostgreSQL?** Relational data with real constraints: foreign keys with cascade, enums, a CHECK on date order, a unique index on `lower(email)`, and `date` vs `timestamptz` types.

**Why Drizzle instead of Prisma?** Both give parameterised, typed queries. Drizzle's query builder is close to SQL, so the owner filter is visible in every query; migrations are plain SQL files committed in `apps/api/drizzle/`; and there is no separate engine binary. Prisma would have been equally valid.

**Why JWT?** Stateless access tokens let any API instance authenticate a request without a database lookup, and the same token format works for the browser and the phone. The weakness — JWTs cannot be revoked — is handled by making them short-lived (15 minutes) and pairing them with revocable refresh tokens stored in the database.

**Why bcrypt?** It is deliberately slow and salted, so a leaked database cannot be cracked quickly or with rainbow tables. Cost 12 ≈ 250 ms per hash; tests use cost 4 for speed.

**Why Zod?** One schema gives runtime validation, TypeScript types and (via `z.toJSONSchema`) the OpenAPI request schemas. The schemas live in `packages/shared`, so the API, web forms and mobile forms enforce identical rules.

**Why TanStack Query?** It is a server-state cache: loading and error states, retries, invalidation after mutations, refetch on window focus or app foreground, and persistence for offline viewing. It replaces hand-written `useEffect` fetching.

**Why SecureStore?** It encrypts values with a key held in the Android Keystore (iOS Keychain). AsyncStorage is a plain file readable on a rooted device or from a backup.

## How it works

**How does authorization work?** Authentication identifies the user (`req.auth.userId` from the JWT). Authorization is enforced inside every repository query: projects are filtered by `user_id = $userId`; tasks are filtered through their project (`JOIN projects … WHERE projects.user_id = $userId`, or `project_id IN (SELECT id FROM projects WHERE user_id = $userId)` for UPDATE and DELETE). The check is part of the same SQL statement that reads or writes, so there is no window between "check" and "act". IDs from the request are never trusted: a task's `projectId` is verified before insert or move. → `apps/api/src/repositories/task.repository.ts`, tested in `authorization.test.ts`.

**Why 404 instead of 403 for another user's project?** 403 would confirm the ID exists. 404 tells an attacker nothing.

**How is SQL injection prevented?** Drizzle sends values as bind parameters, never concatenated into SQL. The only dynamic SQL is `ORDER BY`, and its column comes from a whitelist lookup (`SORT_COLUMNS[sortBy]`) after Zod has already rejected any value not in the enum. LIKE wildcards in search terms are escaped so `%` matches a literal percent sign.

**How are passwords protected?** bcrypt hash at registration; the hash is never selected by profile queries and response objects are built by whitelisting serializers, so it cannot leak. Login compares against a dummy hash when the email is unknown and returns one generic error. Failed attempts are rate-limited per IP and per account.

**How does the mobile app talk to the backend?** Plain HTTPS to the same REST endpoints, base URL from `EXPO_PUBLIC_API_URL`. It sends `X-Client: mobile` so login returns the refresh token in the JSON body (phones have no cookie jar); both tokens go into SecureStore. Every request carries `Authorization: Bearer`.

**How does token expiration work?** The access token expires after 15 minutes. The API answers `401 TOKEN_EXPIRED`; the client calls `/api/auth/refresh` once (shared between parallel requests), receives a new pair, and replays the original request — the user notices nothing. Refresh tokens last 7 days, sliding. When the refresh token is expired or revoked, refresh returns 401, the client clears the session and shows "Your session has expired. Please log in again."

**What is refresh-token rotation and reuse detection?** Each refresh revokes the presented token and issues a new one in the same family. If an old, already-rotated token shows up again, someone copied it, so the whole family is revoked. A 30-second grace window returns a retryable 409 instead, because two browser tabs refreshing at once is normal.

**How does CORS work here?** Browsers block cross-origin responses unless the server allows the origin. The API allows only `WEB_ORIGIN` (with credentials for the cookie) and sends no CORS headers to other origins. In production the web app calls `/api` on its own domain through a Vercel rewrite, so most requests are same-origin anyway. CORS does not apply to the mobile app, which is not a browser.

**How is CSRF handled?** Normal API calls use a Bearer header, which a malicious site cannot attach. The refresh cookie is HttpOnly and SameSite=Lax, is only sent to `/api/auth`, and those endpoints reject requests whose `Origin` is not the web app.

**How does rate limiting work?** express-rate-limit counts requests per key in a time window and returns 429 with `RateLimit` headers. Login: 10 failed attempts per IP and 10 per account per 15 minutes (successful logins are not counted). Register: 10 per hour per IP. Refresh: 120 per 15 minutes. Everything: 600 per 15 minutes. With several API instances, the in-memory store would move to Redis.

**How does the database relationship work?** `users 1─N projects 1─N tasks`, with foreign keys and `ON DELETE CASCADE`. Tasks do not store `user_id`; ownership comes through the project (3NF — one source of truth).

**How does cross-platform synchronisation work?** There is no sync protocol: both apps read and write the same rows through the same API. After a mutation, a client invalidates its cached queries. The other client sees the change when it next fetches — pull-to-refresh on Android, page refresh or simply re-focusing the tab on the web.

**How is it deployed?** PostgreSQL on Neon, the API on Render (blueprint in `render.yaml`; migrations run on start), the web app on Vercel with an `/api` rewrite to Render, and the APK built with EAS. CI runs lint, typecheck, tests against a Postgres service container, the API and web builds, and an Android Metro bundle.

## Likely questions

**Q: Where would this break at scale?** Offset pagination gets slow on deep pages (switch to keyset/cursor pagination); `ILIKE '%x%'` cannot use B-tree indexes (add `pg_trgm`); in-memory rate limits do not share state across instances (move them to Redis); dashboard aggregates run per request (cache them or maintain counters).

**Q: Why PUT and PATCH?** PUT replaces the whole resource (the edit form sends everything). PATCH changes only what is sent — the mobile status and priority chips and "mark completed". Both reuse one service method.

**Q: What happens if two requests update the same task?** Last write wins. For this domain that is acceptable; optimistic concurrency (an `updated_at` or version check returning 409) is the upgrade path.

**Q: Why not store the access token in localStorage?** Any XSS could read it. It lives in memory and is restored on reload from the HttpOnly refresh cookie.

**Q: What if the JWT secret leaks?** Anyone could mint access tokens. Rotate `JWT_ACCESS_SECRET` (all access tokens become invalid; clients refresh transparently, because refresh tokens are not JWTs and are unaffected).

**Q: How do you know authorization works?** `authorization.test.ts` creates two real users and has user B attempt every operation on user A's data by ID — read, replace, patch, delete, list, search, inject a task, move a task — asserting 404 and that A's data is unchanged. `scripts/verify-flow.mjs` repeats this against the deployed server.

**Q: Why are tests against a real database instead of mocks?** The risky code is SQL — ownership filters, constraints, cascades, sorting. Mocks would test that I called a function, not that the query is correct. The suite takes about 11 seconds.

**Q: What did testing actually catch?** A correlated sub-query that counted every project's tasks as 0 (an unqualified `id` resolved to the wrong table); the web app logging users out when the refresh endpoint was rate-limited; a lost "Task deleted" toast when the list unmounted; and the post-login redirect ignoring the originally requested page. All four were fixed, and the first two are now covered by tests.

**Q: How does offline mode work on Android?** NetInfo tells TanStack Query when the device is offline. Queries pause instead of failing, and cached data (persisted to AsyncStorage, never including tokens) stays visible under an offline banner. Mutations fail immediately with an alert rather than queueing silently. Everything is wiped on logout.

**Q: How does RBAC work, and why can't admins see everyone's tasks?** Two roles, USER and ADMIN, stored on `users.role`. `requireRole('ADMIN')` runs after the JWT check and reads the role from the database on every request — so a demotion takes effect on the next request instead of after the 15-minute token lifetime, and a forged or stale token claim can't grant access. Admins manage accounts and read the system-wide audit log, but the assignment says users only see their own data, so admins get counts, not contents — even the admin audit log hides project and task names. Two invariants are enforced in a transaction with row locks: you can't demote yourself, and the last admin can't be demoted — otherwise two admins demoting each other at the same instant could lock everyone out.

**Q: How do the "due tomorrow" push notifications work?** The phone registers its Expo push token and IANA time zone. An hourly job (triggered by a GitHub Actions schedule, or an in-process timer) finds devices whose local time is past 18:00, atomically claims each one for its local date (`UPDATE … WHERE last_reminder_on IS DISTINCT FROM today RETURNING`), and sends one message per phone through Expo's push service. The claim makes the job idempotent — it can run hourly, twice, or concurrently without double-sending. `DeviceNotRegistered` deletes the token; network failures release the claim so the next run retries.

**Q: Why an external cron instead of a timer in the API?** Free hosting sleeps when idle, so an in-process timer would miss evenings. The cron calls an endpoint protected by a shared secret (constant-time compare, disabled when unset). The in-process scheduler still exists for always-on servers; running both is safe because of the claim.

**Q: What happens in Expo Go?** Expo Go on Android can't receive remote push (since SDK 53), so the app detects that and schedules the same reminder locally from the tasks due tomorrow, refreshed whenever the app opens or a task changes. Settings shows which mode is active, with a "Send test notification" button.