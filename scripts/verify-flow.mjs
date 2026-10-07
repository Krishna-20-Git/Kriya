#!/usr/bin/env node
/**
 * End-to-end check of the evaluator's scenario against a RUNNING API — local or deployed.
 *
 *   node scripts/verify-flow.mjs                         # http://localhost:4000
 *   node scripts/verify-flow.mjs https://your-api.onrender.com
 *
 * It plays two clients at once: a "web" client (refresh token in a cookie) and a "mobile"
 * client (X-Client: mobile, refresh token in the body), exactly like the real apps.
 * Creates two throwaway accounts (user-a-…@example.com, user-b-…@example.com). Needs Node 20+.
 */

const BASE = (process.argv[2] ?? process.env.API_URL ?? 'http://localhost:4000').replace(/\/$/, '');
const stamp = Date.now();
const PASSWORD = 'Verify1234';

let passed = 0;
let failed = 0;

async function call(method, path, { token, body, mobile = false, cookie, origin } = {}) {
  const headers = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  if (mobile) headers['X-Client'] = 'mobile';
  if (cookie) headers.Cookie = cookie;
  if (origin) headers.Origin = origin;
  const res = await fetch(`${BASE}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  return { status: res.status, body: json, setCookie: res.headers.get('set-cookie') ?? '' };
}

function check(step, label, condition, detail = '') {
  if (condition) {
    passed += 1;
    console.log(`  \x1b[32m✓\x1b[0m ${String(step).padStart(2)}. ${label}`);
  } else {
    failed += 1;
    console.log(`  \x1b[31m✗\x1b[0m ${String(step).padStart(2)}. ${label}${detail ? `\n        ${detail}` : ''}`);
  }
}

const show = (r) => `HTTP ${r.status} ${JSON.stringify(r.body)?.slice(0, 200)}`;

async function main() {
  console.log(`\nVerifying ${BASE}\n`);
  const health = await call('GET', '/api/health').catch((error) => ({ status: 0, body: String(error) }));
  if (health.status !== 200) {
    console.error(`API is not reachable at ${BASE}: ${show(health)}`);
    process.exit(1);
  }

  console.log('Authorization (users can only touch their own data)');
  const emailA = `user-a-${stamp}@example.com`;
  const regA = await call('POST', '/api/auth/register', { body: { fullName: 'User A', email: emailA, password: PASSWORD } });
  check(1, 'Register user A', regA.status === 201 && !JSON.stringify(regA.body).includes('passwordHash'), show(regA));

  const loginA = await call('POST', '/api/auth/login', { body: { email: emailA, password: PASSWORD } });
  const tokenA = loginA.body?.data?.accessToken;
  check(2, 'Login user A', loginA.status === 200 && !!tokenA, show(loginA));

  const projA = await call('POST', '/api/projects', { token: tokenA, body: { name: 'Project A', startDate: '2026-10-01', status: 'IN_PROGRESS' } });
  const projectId = projA.body?.data?.id;
  check(3, 'Create project A', projA.status === 201 && !!projectId, show(projA));

  const taskA = await call('POST', '/api/tasks', { token: tokenA, body: { projectId, name: 'Task A', priority: 'HIGH' } });
  const taskId = taskA.body?.data?.id;
  check(4, 'Create task A', taskA.status === 201 && !!taskId, show(taskA));

  const regB = await call('POST', '/api/auth/register', { body: { fullName: 'User B', email: `user-b-${stamp}@example.com`, password: PASSWORD } });
  const tokenB = regB.body?.data?.accessToken;
  check(5, 'Login as user B', regB.status === 201 && !!tokenB, show(regB));

  const steal = [
    [6, 'B cannot read project A', await call('GET', `/api/projects/${projectId}`, { token: tokenB })],
    [7, 'B cannot read task A', await call('GET', `/api/tasks/${taskId}`, { token: tokenB })],
    [8, 'B cannot modify project A (PUT)', await call('PUT', `/api/projects/${projectId}`, { token: tokenB, body: { name: 'Hacked', startDate: '2026-10-01' } })],
    ['8b', 'B cannot modify task A (PATCH)', await call('PATCH', `/api/tasks/${taskId}`, { token: tokenB, body: { status: 'COMPLETED' } })],
    ['8c', 'B cannot add a task to project A', await call('POST', '/api/tasks', { token: tokenB, body: { projectId, name: 'Injected' } })],
    [9, 'B cannot delete project A', await call('DELETE', `/api/projects/${projectId}`, { token: tokenB })],
    ['9b', 'B cannot delete task A', await call('DELETE', `/api/tasks/${taskId}`, { token: tokenB })],
  ];
  for (const [step, label, res] of steal) check(step, `${label} → 404`, res.status === 404, show(res));

  const listB = await call('GET', '/api/projects?search=Project%20A', { token: tokenB });
  const stillThere = await call('GET', `/api/projects/${projectId}`, { token: tokenA });
  check(
    10,
    "Every unauthorized operation failed and A's data is intact",
    listB.body?.data?.length === 0 && stillThere.body?.data?.name === 'Project A' && stillThere.body?.data?.taskCount === 1,
    `${show(listB)} | ${show(stillThere)}`,
  );

  console.log('\nCross-platform sync (same account, same API, same database)');
  const web = await call('POST', '/api/auth/login', { body: { email: emailA, password: PASSWORD } });
  const webToken = web.body?.data?.accessToken;
  const webCookie = web.setCookie.split(';')[0];
  check(11, 'Web login (refresh token in HttpOnly cookie)', web.status === 200 && /pms_refresh=/.test(webCookie) && /HttpOnly/i.test(web.setCookie), show(web));

  const mobile = await call('POST', '/api/auth/login', { mobile: true, body: { email: emailA, password: PASSWORD } });
  let mobileToken = mobile.body?.data?.accessToken;
  const mobileRefresh = mobile.body?.data?.refreshToken;
  check(12, 'Mobile login with the same account (refresh token in body → SecureStore)', mobile.status === 200 && !!mobileRefresh && mobile.body.data.user.id === web.body.data.user.id, show(mobile));

  const webTask = await call('POST', '/api/tasks', { token: webToken, body: { projectId, name: `Created on web ${stamp}`, priority: 'LOW' } });
  check(13, 'Create task on web', webTask.status === 201, show(webTask));

  const pulled = await call('GET', `/api/tasks?search=${encodeURIComponent(`Created on web ${stamp}`)}`, { token: mobileToken });
  check(14, 'Mobile pull-to-refresh (re-fetch)', pulled.status === 200, show(pulled));
  check(15, 'Task created on web appears on mobile', pulled.body?.data?.length === 1);

  const modified = await call('PATCH', `/api/tasks/${webTask.body?.data?.id}`, { token: mobileToken, body: { status: 'IN_PROGRESS', priority: 'HIGH' } });
  check(16, 'Modify task on mobile (status + priority)', modified.status === 200, show(modified));

  const refreshed = await call('GET', `/api/tasks/${webTask.body?.data?.id}`, { token: webToken });
  check(17, 'Refresh web', refreshed.status === 200, show(refreshed));
  check(18, 'Modification made on mobile appears on web', refreshed.body?.data?.status === 'IN_PROGRESS' && refreshed.body?.data?.priority === 'HIGH', show(refreshed));

  console.log('\nError handling and validation');
  const bad = await call('POST', '/api/auth/login', { body: { email: emailA, password: 'WrongPass1' } });
  check(19, 'Invalid login → 401 INVALID_CREDENTIALS', bad.status === 401 && bad.body?.error?.code === 'INVALID_CREDENTIALS', show(bad));

  const forged = await call('GET', '/api/dashboard', { token: `${webToken.slice(0, -4)}AAAA` });
  const rotated = await call('POST', '/api/auth/refresh', { mobile: true, body: { refreshToken: mobileRefresh } });
  mobileToken = rotated.body?.data?.accessToken ?? mobileToken;
  const webRefresh = webCookie ? await call('POST', '/api/auth/refresh', { cookie: webCookie }) : { status: 0 };
  await call('POST', '/api/auth/logout', { mobile: true, body: { refreshToken: rotated.body?.data?.refreshToken } });
  const afterLogout = await call('POST', '/api/auth/refresh', { mobile: true, body: { refreshToken: rotated.body?.data?.refreshToken } });
  check(
    20,
    'Token expiry path: tampered token → 401, refresh rotates (web + mobile), revoked session → 401 "session expired"',
    forged.status === 401 && rotated.status === 200 && webRefresh.status === 200 && afterLogout.status === 401,
    `${show(forged)} | refresh ${rotated.status} | web refresh ${webRefresh.status} | after logout ${show(afterLogout)}`,
  );
  console.log('        (a genuinely expired JWT → 401 TOKEN_EXPIRED needs the signing secret; it is covered in apps/api/src/test/auth.test.ts)');
  console.log('  \x1b[33m–\x1b[0m 21. No network — SKIPPED: a client-side behaviour, not testable against the API. Manual steps in docs/TESTING.md');

  const badProject = await call('POST', '/api/projects', { token: tokenA, body: { name: '', startDate: 'tomorrow', status: 'DONE' } });
  check(22, 'Invalid project data → 400 with field details', badProject.status === 400 && badProject.body?.error?.details?.length >= 3, show(badProject));

  const badTask = await call('POST', '/api/tasks', { token: tokenA, body: { projectId: 'nope', name: '   ', priority: 'URGENT' } });
  check(23, 'Invalid task data → 400 with field details', badTask.status === 400 && badTask.body?.error?.details?.length >= 3, show(badTask));

  const dup = await call('POST', '/api/auth/register', { body: { fullName: 'Dup', email: emailA.toUpperCase(), password: PASSWORD } });
  check(24, 'Duplicate email (different case) → 409 EMAIL_TAKEN', dup.status === 409 && dup.body?.error?.code === 'EMAIL_TAKEN', show(dup));

  const missing = await call('POST', '/api/tasks', { token: tokenA, body: {} });
  check(25, 'Missing required fields → 400', missing.status === 400 && missing.body.error.details.some((d) => d.path === 'name'), show(missing));

  const badEnum = await call('PATCH', `/api/tasks/${taskId}`, { token: tokenA, body: { status: 'done' } });
  const badEnumQuery = await call('GET', '/api/tasks?priority=CRITICAL', { token: tokenA });
  check(26, 'Invalid enum values (body and query) → 400', badEnum.status === 400 && badEnumQuery.status === 400, `${show(badEnum)} | ${show(badEnumQuery)}`);

  const badDates = await call('POST', '/api/projects', { token: tokenA, body: { name: 'Dates', startDate: '2026-02-30' } });
  const reversed = await call('POST', '/api/projects', { token: tokenA, body: { name: 'Dates', startDate: '2026-10-10', endDate: '2026-10-01' } });
  check(27, 'Invalid dates (impossible date, end before start) → 400', badDates.status === 400 && reversed.status === 400, `${show(badDates)} | ${show(reversed)}`);

  await call('DELETE', `/api/projects/${projectId}`, { token: tokenA });

  console.log(`\n${passed} passed, ${failed} failed\n`);
  process.exit(failed ? 1 : 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
