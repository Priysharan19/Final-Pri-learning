// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · client compatibility floor (CP-11)
//
// Native shells below the configured minimum build get a structured 426 upgrade
// answer on every cloud route except health and the routes a student needs to
// get back in and then leave or take their data; shells at or above it, unknown
// or absent client ids (the web app) and an unset floor are unaffected; bad
// configuration is a production boot problem. The second half drives the REAL
// /v1 router: an old shell signs in, cannot sync, exports, and deletes.
// ─────────────────────────────────────────────────────────────────────────────
import assert from 'node:assert/strict';
import express from 'express';
import { clientCompatibility, compatibilityConfigProblems, compatibilityStatus } from '../platform/clientCompatibility.js';

let n = 0;
const ok = (c, l) => { assert.ok(c, l); n += 1; };

const env = { PRI_MIN_IOS_BUILD: '20', PRI_MIN_ANDROID_BUILD: '7' };
const app = express();
app.use(clientCompatibility(env));
app.all(/.*/, (req, res) => res.json({ reached: true }));
const server = await new Promise(r => { const l = app.listen(0, '127.0.0.1', () => r(l)); });
const base = `http://127.0.0.1:${server.address().port}`;
const call = async (method, path, headers = {}) => {
  const res = await fetch(base + path, { method, headers });
  return { status: res.status, body: await res.json() };
};

try {
  const old = await call('GET', '/sync/pull/0', { 'x-pri-client': 'ios-native-v1', 'x-pri-shell-build': '19' });
  ok(old.status === 426 && old.body.error.code === 'CLIENT_UPGRADE_REQUIRED' && old.body.error.platform === 'ios' && old.body.error.minBuild === 20 && old.body.error.build === 19,
    'an iOS shell below the floor gets a structured upgrade answer');
  ok((await call('GET', '/sync/pull/0', { 'x-pri-client': 'ios-native-v1', 'x-pri-shell-build': '20' })).status === 200, 'at the floor it is served');
  ok((await call('GET', '/sync/pull/0', { 'x-pri-client': 'ios-native-v1', 'x-pri-shell-build': '120' })).status === 200, 'above the floor it is served');
  const missing = await call('POST', '/sync/push', { 'x-pri-client': 'android-native-v1' });
  ok(missing.status === 426 && missing.body.error.platform === 'android' && missing.body.error.build === null, 'a shell that sends no build is treated as below the floor');
  ok((await call('POST', '/sync/push', { 'x-pri-client': 'android-native-v1', 'x-pri-shell-build': 'abc' })).status === 426, 'a malformed build is below the floor');
  ok((await call('POST', '/sync/push', { 'x-pri-client': 'android-native-v1', 'x-pri-shell-build': '1'.repeat(10) })).status === 426, 'an absurdly long build is below the floor, not a bypass');
  ok((await call('POST', '/sync/push', { 'x-pri-client': 'android-native-v1', 'x-pri-shell-build': '7' })).status === 200, 'Android at its own floor is served');
  const exits = [['GET', '/health'], ['GET', '/ready'], ['POST', '/account/login'], ['GET', '/account/me'], ['POST', '/account/logout'],
    ['POST', '/account/identity/nonce'], ['POST', '/account/identity/apple/sign-in'], ['POST', '/account/identity/google/sign-in'],
    ['POST', '/account/password/reset-request'], ['POST', '/account/password/reset'],
    ['POST', '/account/email/verification-request'], ['POST', '/account/email/verify'],
    ['GET', '/account/devices'], ['DELETE', '/account/devices/abc123'], ['GET', '/account/export'], ['DELETE', '/account'],
    ['DELETE', '/ACCOUNT'], ['GET', '/account/export/']];
  for (const [method, path] of exits) {
    ok((await call(method, path, { 'x-pri-client': 'ios-native-v1', 'x-pri-shell-build': '1' })).status === 200, `${method} ${path} stays reachable from an old shell (get back in, leave or take your data)`);
  }
  const head = await fetch(base + '/health', { method: 'HEAD', headers: { 'x-pri-client': 'ios-native-v1', 'x-pri-shell-build': '1' } });
  ok(head.status === 200, 'HEAD /health stays reachable from an old shell');
  for (const [method, path] of [['POST', '/account/register'], ['POST', '/handwriting/transcribe'], ['POST', '/working/check'],
    ['POST', '/billing/apple/transaction'], ['POST', '/account/identity/apple/link'], ['PATCH', '/account/password']]) {
    ok((await call(method, path, { 'x-pri-client': 'ios-native-v1', 'x-pri-shell-build': '1' })).status === 426, `${method} ${path} is refused below the floor (not an exit route)`);
  }
  const refusal = await fetch(base + '/sync/pull/0', { headers: { 'x-pri-client': 'ios-native-v1', 'x-pri-shell-build': '2' } });
  ok(refusal.status === 426 && refusal.headers.get('upgrade') === 'pri-shell' && refusal.headers.get('cache-control') === 'no-store', 'a 426 names what to upgrade (RFC 9110) and is never cached');
  ok((await call('GET', '/account/export-everything', { 'x-pri-client': 'ios-native-v1', 'x-pri-shell-build': '1' })).status === 426, 'the exemptions are exact paths, not prefixes');
  ok((await call('GET', '/sync/pull/0')).status === 200 && (await call('GET', '/sync/pull/0', { 'x-pri-client': 'web-v1' })).status === 200, 'the web app has no floor');
  ok((await call('GET', '/sync/pull/0', { 'x-pri-client': 'ios-native-v2', 'x-pri-shell-build': '1' })).status === 200, 'an unknown client id is not a native shell here (the origin rules treat it as a browser)');
} finally {
  await new Promise(r => server.close(r));
}

// No floor configured: nothing is refused.
const open = express(); open.use(clientCompatibility({})); open.all(/.*/, (req, res) => res.json({ reached: true }));
const s2 = await new Promise(r => { const l = open.listen(0, '127.0.0.1', () => r(l)); });
const r2 = await fetch(`http://127.0.0.1:${s2.address().port}/sync/pull/0`, { headers: { 'x-pri-client': 'ios-native-v1' } });
ok(r2.status === 200, 'with no floor configured every shell is served');
await new Promise(r => s2.close(r));

const status = compatibilityStatus(env);
ok(status.minBuild.ios === 20 && status.minBuild.android === 7 && status.upgradeRequiredResponses >= 10, 'the active floors and the number of refusals are reportable (health)');
ok(compatibilityStatus({}).minBuild.ios === null, 'no floor reports null');

ok(compatibilityConfigProblems({}).length === 0 && compatibilityConfigProblems(env).length === 0, 'unset or valid floors are valid configuration');
ok(compatibilityConfigProblems({ PRI_MIN_IOS_BUILD: 'v2' }).length === 1 && compatibilityConfigProblems({ PRI_MIN_ANDROID_BUILD: '0' }).length === 1, 'a malformed floor is a production boot problem');

// ── The real /v1 router ─────────────────────────────────────────────────────
// An iOS shell below the floor: an existing account signs in, sees itself,
// cannot sync, exports everything, lists its devices and deletes itself; the
// deleted account then cannot sign in. Nobody is trapped behind the floor.
{
  const { mkdtempSync, rmSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const saved = Object.fromEntries(['NODE_ENV', 'PRI_PUBLIC_ORIGIN', 'PRI_PLATFORM_DB', 'PRI_AUTH_DELIVERY_KEY', 'PRI_MIN_IOS_BUILD'].map(k => [k, process.env[k]]));
  const scratch = mkdtempSync(join(tmpdir(), 'pri-compat-'));
  process.env.NODE_ENV = 'test';
  delete process.env.PRI_PUBLIC_ORIGIN;
  process.env.PRI_PLATFORM_DB = join(scratch, 'platform.db');
  process.env.PRI_AUTH_DELIVERY_KEY = '55'.repeat(32);
  process.env.PRI_MIN_IOS_BUILD = '50';
  const [{ default: cookieParser }, { openTestStore }, { createPlatformRouter }] = await Promise.all([
    import('cookie-parser'), import('./support/engine.mjs'), import('../platform/router.js')
  ]);
  const testStore = await openTestStore('sqlite', { label: 'compat' });
  const db = testStore.store;
  const real = express();
  real.use(express.json({ limit: '1mb' }));
  real.use(cookieParser());
  real.use('/v1', createPlatformRouter(db));
  const srv = await new Promise(r => { const l = real.listen(0, '127.0.0.1', () => r(l)); });
  const origin = `http://127.0.0.1:${srv.address().port}`;
  const jar = {};
  const send = async (method, path, { body, shell = '3' } = {}) => {
    const headers = { Accept: 'application/json' };
    if (shell) { headers['X-Pri-Client'] = 'ios-native-v1'; headers['X-Pri-Shell-Build'] = shell; }
    const cookies = Object.entries(jar).map(([k, v]) => `${k}=${v}`).join('; ');
    if (cookies) headers.Cookie = cookies;
    if (jar.pri_csrf && !['GET', 'HEAD'].includes(method)) headers['x-pri-csrf'] = jar.pri_csrf;
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    const res = await fetch(origin + '/v1' + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    for (const c of res.headers.getSetCookie?.() || []) { const [kv] = c.split(';'); const i = kv.indexOf('='); jar[kv.slice(0, i)] = kv.slice(i + 1); }
    const text = await res.text();
    let data = null; try { data = text ? JSON.parse(text) : null; } catch { data = text; }
    return { status: res.status, data, headers: res.headers };
  };
  try {
    const email = 'old-shell@example.test';
    const password = 'old-shell-pass-123';
    const blockedSignup = await send('POST', '/account/register', { body: { name: 'Old Shell', email, password, deviceId: 'old-ipad' } });
    ok(blockedSignup.status === 426 && blockedSignup.data?.error?.code === 'CLIENT_UPGRADE_REQUIRED', 'real router: a new account cannot be created from a shell below the floor');
    // The account already exists (made before the floor was raised, on the web).
    const made = await send('POST', '/account/register', { body: { name: 'Old Shell', email, password, deviceId: 'web' }, shell: null });
    ok(made.status === 201, 'real router: the account exists');
    await db.run('UPDATE accounts SET email_verified_at=? WHERE id=?', [Date.now(), made.data.account.id]);
    for (const k of Object.keys(jar)) delete jar[k];
    const login = await send('POST', '/account/login', { body: { email, password, deviceId: 'old-ipad' } });
    ok(login.status === 200 && login.data?.account?.email === email, 'real router: an old shell can still sign in');
    ok((await send('GET', '/account/me')).status === 200, 'real router: the account screen can verify the session');
    const pull = await send('GET', '/sync/pull?cursor=0');
    ok(pull.status === 426 && pull.data?.error?.minBuild === 50 && pull.data?.error?.build === 3, 'real router: sync answers 426 with the floor and the build');
    const exported = await send('GET', '/account/export');
    ok(exported.status === 200 && exported.data?.format === 'pri-account-export-v1' && exported.data?.account?.email === email, 'real router: the old shell can export everything');
    ok((await send('GET', '/account/devices')).status === 200, 'real router: the old shell can list (and so revoke) its sessions');
    const health = await send('GET', '/health');
    ok(health.status === 200 && health.data?.clientCompatibility?.minBuild?.ios === 50 && health.data.clientCompatibility.upgradeRequiredResponses >= 2, 'real router: health reports the active floor and the refusals');
    const deleted = await send('DELETE', '/account', { body: { password } });
    ok(deleted.status === 200 && deleted.data?.deleted === true, 'real router: the old shell can delete the account');
    for (const k of Object.keys(jar)) delete jar[k];
    ok((await send('POST', '/account/login', { body: { email, password, deviceId: 'old-ipad' } })).status === 401, 'real router: the deleted account cannot sign in again');
    const current = await send('POST', '/account/register', { body: { name: 'Current', email: 'current@example.test', password, deviceId: 'new-ipad' }, shell: '50' });
    ok(current.status === 201, 'real router: a shell at the floor is served normally');
  } finally {
    await new Promise(r => srv.close(r));
    await testStore.close();
    rmSync(scratch, { recursive: true, force: true });
    for (const [k, v] of Object.entries(saved)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
  }
}

console.log(`CLIENT COMPATIBILITY: PASS — ${n}/${n} checks — native shells below the configured build get a structured 426, sign-in and data exit routes stay open (real router: sign in → export → delete), the web app has no floor.`);
