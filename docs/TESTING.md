# Testing

## Automated

```bash
createdb pms_test          # once; or set TEST_DATABASE_URL
npm test                   # all suites
npm test -w @pms/api       # API only
npm run lint && npm run typecheck
```

| Suite | Location | Count | Notes |
|---|---|---|---|
| Shared validation (unit) | `packages/shared/src/schemas.test.ts` | 38 | Emails, password policy, impossible dates (2026-02-30), enums, unknown fields, sort whitelist, page caps, due-date wording, roles, push tokens, time zones |
| API integration | `apps/api/src/test/*.test.ts` | 133 | Real PostgreSQL. The schema is rebuilt from the committed migrations before the run, so the migrations are tested too. Tables are truncated before each test. |
| Web unit | `apps/web/src/**/*.test.ts(x)` | 53 | API client (refresh single-flight, session-expiry signal, network errors), error states, accessible badges, filters, admin route guard, WCAG AA contrast of both themes (36 colour pairs) |

### API integration coverage

- **auth.test.ts** — register (email normalisation, hash stored, no hash in the response, cookie flags), duplicate email in any case (409), field errors, missing and unknown fields; login on web and mobile with one account; identical errors for wrong email and wrong password; rate limit per IP and per account; `/me`; missing / malformed / wrong-signature / `alg:none` / expired tokens; refresh rotation (web cookie and mobile body); CSRF origin check; concurrent-refresh 409; reuse detection revoking the family; expired refresh token; logout and logout-all.
- **authorization.test.ts** — User B attacks User A's project and task by ID with GET, PUT, PATCH and DELETE; searches for them; lists A's project's tasks; injects a task into A's project; moves a task into A's project. Every attempt returns 404 and A's data is verified unchanged. Dashboard isolation. Every protected route returns 401 without a token.
- **projects.test.ts** — CRUD, PUT vs PATCH semantics, cascade delete, 404 vs 400 for IDs, validation table (missing/blank/oversized name, invalid status, impossible date, wrong format, end before start, unknown field), PATCH dates checked against stored values, malformed JSON, search (case-insensitive, LIKE wildcards literal), filters, whitelisted sorting, pagination metadata.
- **tasks.test.ts** — CRUD, completedAt set and cleared, priority change, PUT moves between owned projects, missing project, validation table (lower-case enum, invalid date, oversized description …), 413 for large bodies, combined search + status + priority filters, project filter, priority sorted by importance, due-date sort with nulls last, pagination.
- **admin.test.ts** — USER gets 403 on every admin route; promotion takes effect without a new token; user list shows counts but never project names; search and role filter; promote/demote with audit entries naming the actor; cannot demote yourself; last admin protected; invalid role/id → 400; unknown user → 404; admins still get 404 on other users' projects.
- **notifications.test.ts** — device register/list/unregister, token moves between accounts, cannot remove another user's token, "sign out everywhere" clears devices; reminder job: local time computed per time zone, open tasks only, most important first, once per day even with concurrent runs, waits for 18:00 on the phone's clock, never includes other users' tasks, deletes uninstalled tokens and retries transient failures; cron endpoint disabled without a secret and rejects a wrong one; `dueOn` filter.
- **dashboard.test.ts** — zero state, statistics computed from data and updated after changes, overdue by the client's `today`, invalid `today`; audit log entries without sensitive data; health; JSON 404; security headers; CORS allow and deny; OpenAPI document contains every required endpoint.

## End-to-end scenario against a running API

```bash
npm run dev:api                                          # or point at a deployment
node scripts/verify-flow.mjs                             # http://localhost:4000
node scripts/verify-flow.mjs https://your-api.onrender.com
```

It plays a web client (cookie) and a mobile client (`X-Client: mobile`) at the same time and runs the evaluator's scenario: user A creates a project and a task; user B tries to read, modify, delete and inject (all must 404); the same account logs in on both clients; a task created by the web client is fetched by the mobile client; the mobile client edits it and the web client sees the change; then invalid login, token tampering, refresh rotation, revoked sessions, invalid project/task data, duplicate email, missing fields, invalid enums and invalid dates. The result at the time of writing was **29 passed, 0 failed**. Step 21 (no network) is reported as skipped because it is a client behaviour; see the manual checklist below.

## Manual checklist — Android (run on a device or emulator before recording)

| # | Step | Expected |
|---|---|---|
| 1 | Launch the app | Splash screen, then Login |
| 2 | Tap **Sign in** with empty fields | "Email is required", "Password is required" |
| 3 | Log in with the demo account | Dashboard with the same numbers as the web dashboard |
| 4 | On the web, create a task; on the phone, pull down on Tasks | The new task appears |
| 5 | Open the task; tap **High**, then **In Progress** | Chips update; refresh the web page and the change is there |
| 6 | Tap **Mark as completed**, then go back | Check mark and strikethrough in the list; dashboard counts change |
| 7 | Tasks tab: type a search term; tap **High** | List narrows (server-side) |
| 8 | **+** → create a task without a name | "Task name is required" |
| 9 | Delete a task | Native confirmation, then it disappears |
| 10 | Turn on airplane mode, open Tasks and Dashboard | "No internet connection — showing saved data" banner; cached data visible |
| 11 | Still offline: try to complete a task | Alert "Could not update task — No internet connection…" |
| 12 | Kill and relaunch the app while offline | Still signed in; cached tasks visible |
| 13 | Airplane mode off, pull to refresh | Data refreshes; banner disappears |
| 14 | On the web, Settings → **Sign out everywhere**; on the phone, wait 15 minutes (or set `ACCESS_TOKEN_TTL_SECONDS=30` on the API) and pull to refresh | Login screen with "Your session has expired. Please log in again." |
| 15 | Settings → **Sign out** | Login screen; relaunching does not show the previous user's data |

## Manual checklist — web

Responsive layouts were checked at 320, 390, 768, 1024, 1280 and 1440 px (no horizontal scrolling; tables collapse into stacked rows below 1280 px). Keyboard: Tab through the sidebar, forms and dialogs (Esc closes; focus is trapped in dialogs by the native `<dialog>` element). A browser session that expires shows the same session-expired message on the login page.
