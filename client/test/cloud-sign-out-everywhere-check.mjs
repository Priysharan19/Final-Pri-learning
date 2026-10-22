// Pri Learning · "Sign out everywhere" in Settings → Account (#481, via #506)
//
// The server has long had POST /v1/account/logout-all (accounts.js; tested in
// server/test/security-acceptance-check.mjs, session-alerts-check.mjs,
// otp-sign-in-check.mjs and account-lifecycle-journey-check.mjs): every live
// session of the account, on every device, this one included, stops
// authenticating. A student whose iPad was lost had no way to reach it. The
// Account security panel now offers it, behind one inline confirmation.
//
// The contract this file holds:
//   1. The platform call signOutCloudAccountEverywhere(pid) POSTs logout-all
//      once and only then forgets this profile's link (the replica state, the
//      outbox's account, the native session) and announces the session ended
//      — which is what relocks the activation gate onto the sign-in card.
//   2. A refusal (401, 403 CSRF, 429) or an outage forgets nothing: the panel
//      never says "signed out on every device" when the server was not told.
//   3. The panel asks before it acts, goes through that one call, and has its
//      copy in English and Hindi.
//
//   node client/test/cloud-sign-out-everywhere-check.mjs

import { readFileSync } from 'node:fs';
import { installBrowserEnv, resetStorage, rawRows } from './backend-check.mjs';

installBrowserEnv();
resetStorage();
globalThis.__PRI_CLOUD_ORIGIN__ = 'https://pri.example.test';
// Node has no window event bus; give the session-change signal one to land on.
if (typeof globalThis.dispatchEvent !== 'function') {
  const bus = new EventTarget();
  globalThis.addEventListener = bus.addEventListener.bind(bus);
  globalThis.removeEventListener = bus.removeEventListener.bind(bus);
  globalThis.dispatchEvent = bus.dispatchEvent.bind(bus);
}

let pass = 0;
let fail = 0;
const failures = [];
const ok = (name, condition, detail = '') => {
  if (condition) { pass++; return; }
  fail++;
  failures.push(`${name}${detail ? ` — ${detail}` : ''}`);
};
const same = (name, actual, expected) => ok(name, JSON.stringify(actual) === JSON.stringify(expected), `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);

const { put } = await import('../src/local/idb.js');
const cloudAccount = await import('../src/platform/cloudAccount.js');
const { cloudAccountLink, cloudLinkRowId, loginCloudAccount } = cloudAccount;
const { onCloudSessionChange } = await import('../src/platform/cloudSession.js');
const { cloud } = await import('../src/platform/cloudTransport.js');

// ── A fake cloud: records every request; logout-all answers as told ─────────
let account = null;
let logoutAllReply = { status: 200, body: { ok: true, revoked: 3 } };
const requests = [];
const json = (value, status = 200) => new Response(JSON.stringify(value), {
  status, headers: { 'content-type': 'application/json', 'x-pri-request-id': 'test-request' }
});
globalThis.fetch = async (url, options = {}) => {
  const path = new URL(url).pathname;
  const method = String(options.method || 'GET').toUpperCase();
  requests.push({ method, path, body: options.body ? JSON.parse(options.body) : undefined });
  if (path === '/v1/account/login') return json({ account });
  if (path === '/v1/account/me') return json({ account });
  if (path === '/v1/entitlements') return json({ entitlement: { plan: 'free', status: 'free', provider: 'none', sourceVersion: 0 } });
  if (path === '/v1/account/logout') return json({ ok: true });
  if (path === '/v1/account/logout-all' && method === 'POST') {
    if (logoutAllReply === 'network') throw Object.assign(new TypeError('Failed to fetch'), { code: 'NETWORK' });
    return json(logoutAllReply.body, logoutAllReply.status);
  }
  return json({ error: { code: 'NOT_FOUND', message: path } }, 404);
};

const announcements = [];
onCloudSessionChange(event => announcements.push(event?.detail));

async function linkedProfile(pid, accountId) {
  account = { id: accountId, email: `${accountId}@example.test`, name: accountId, role: 'student', emailVerified: true };
  await put('profiles', { id: pid, name: `Local ${pid}`, year: 10, course: 'in' });
  await loginCloudAccount(pid, { email: account.email, password: 'only-for-the-fake' });
  await put('device', { id: `pri-cloud-sync-state-v1:${pid}`, cursor: 9, accountId, entityVersions: { 'profile:self': 4 } });
}
const deviceRows = () => JSON.stringify(rawRows().device || []);
const logoutAlls = () => requests.filter(r => r.method === 'POST' && r.path === '/v1/account/logout-all');

// ── 1 · Transport and platform call ─────────────────────────────────────────
ok('the transport exposes cloud.logoutAll', typeof cloud.logoutAll === 'function');
const signOutEverywhere = cloudAccount.signOutCloudAccountEverywhere;
ok('the platform exposes one sign-out-everywhere call', typeof signOutEverywhere === 'function', typeof signOutEverywhere);

{
  const pid = 'p-everywhere';
  await linkedProfile(pid, 'acct-everywhere');
  same('the profile starts linked', (await cloudAccountLink(pid))?.accountId, 'acct-everywhere');
  requests.length = 0;
  announcements.length = 0;
  logoutAllReply = { status: 200, body: { ok: true, revoked: 3 } };
  let result = null;
  let error = null;
  try { result = await signOutEverywhere?.(pid); } catch (err) { error = err; }
  same('signing out everywhere succeeds', error?.message || null, null);
  same('exactly one POST /v1/account/logout-all, with an empty body', logoutAlls().map(r => r.body), [{}]);
  same('it reports what the server revoked', result, { connected: false, revoked: 3 });
  same('no per-device logout is sent after it: the server has already ended this session', requests.filter(r => r.path === '/v1/account/logout').length, 0);
  same('the link row is gone, so a relaunch finds no account', await cloudAccountLink(pid), null);
  ok('no device row still names the link', !deviceRows().includes(cloudLinkRowId(pid)), deviceRows());
  ok('the account\'s sync cursor is gone', !deviceRows().includes(`pri-cloud-sync-state-v1:${pid}`), deviceRows());
  same('the session is announced as ended for this profile (the gate relocks on it)',
    announcements.filter(a => a?.localProfileId === pid).at(-1), { localProfileId: pid, connected: false, accountId: null, role: null });
}

// ── 2 · A refusal or an outage forgets nothing ──────────────────────────────
for (const [label, reply, code] of [
  ['an expired session (401)', { status: 401, body: { error: { code: 'AUTH_REQUIRED', message: 'Sign in.' } } }, 'AUTH_REQUIRED'],
  ['a CSRF refusal (403)', { status: 403, body: { error: { code: 'CSRF_REJECTED', message: 'No.' } } }, 'CSRF_REJECTED'],
  ['the rate limit (429)', { status: 429, body: { error: { code: 'RATE_LIMITED', message: 'Later.' } } }, 'RATE_LIMITED'],
  ['an outage (no answer)', 'network', null]
]) {
  const pid = `p-kept-${logoutAlls().length}-${label.length}`;
  await linkedProfile(pid, 'acct-kept');
  requests.length = 0;
  announcements.length = 0;
  logoutAllReply = reply;
  let error = null;
  try { await signOutEverywhere?.(pid); } catch (err) { error = err; }
  ok(`${label}: the call throws, so the panel shows the failure`, !!error);
  if (code) same(`${label}: the server's code reaches the panel`, error?.code, code);
  same(`${label}: the link is kept`, (await cloudAccountLink(pid))?.accountId, 'acct-kept');
  ok(`${label}: the sync state is kept`, deviceRows().includes(`pri-cloud-sync-state-v1:${pid}`), deviceRows());
  same(`${label}: no "session ended" is announced`, announcements.filter(a => a?.localProfileId === pid && a.connected === false).length, 0);
}

// ── 3 · The panel (source contract) ─────────────────────────────────────────
{
  const panel = readFileSync(new URL('../src/components/CloudAccountSecurity.jsx', import.meta.url), 'utf8');
  const fn = name => {
    const start = panel.search(new RegExp(`(async )?function ${name}\\(`));
    if (start < 0) return '';
    const rest = panel.slice(start + 1);
    const ends = ['\n  async function ', '\n  function '].map(m => rest.indexOf(m)).filter(i => i >= 0);
    return panel.slice(start, ends.length ? start + 1 + Math.min(...ends) : panel.length);
  };
  const act = fn('signOutEverywhere');
  ok('the panel has a sign-out-everywhere handler', act.length > 0);
  ok('it goes through the one platform call', /signOutCloudAccountEverywhere\(pid\)/.test(act));
  ok('it never calls the transport or forgets the link by hand', !/cloud\.logoutAll|disconnectCloudAccount|forgetCloudAccount/.test(act));
  ok('success hands the panel back as signed out (sessionRevoked), as revoking this device does',
    /onDeleted\?\.\(\{ cloudDeleted: false, sessionRevoked: true \}\)/.test(act) && act.indexOf('onDeleted') > act.indexOf('signOutCloudAccountEverywhere'));
  ok('a failure is reported with its own copy', /signOutEverywhereFailed/.test(act) && /setError\(/.test(act));
  ok('the first button only opens the confirmation',
    /data-testid="cloud-sign-out-everywhere" onClick=\{\(\) => \{ setConfirmEverywhere\(true\)/.test(panel));
  ok('the confirmation is a labelled group with a yes and a cancel',
    /role="group" aria-labelledby="cloud-sign-out-everywhere-ask" data-testid="cloud-sign-out-everywhere-confirm"/.test(panel) &&
      /data-testid="cloud-sign-out-everywhere-yes" onClick=\{signOutEverywhere\}/.test(panel) &&
      /data-testid="cloud-sign-out-everywhere-cancel" onClick=\{\(\) => setConfirmEverywhere\(false\)\}/.test(panel));
  ok('only the confirmation\'s yes calls the handler', (panel.match(/onClick=\{signOutEverywhere\}/g) || []).length === 1);
  ok('nothing is written anywhere persistent by the panel', !/localStorage|sessionStorage|idb|put\(/.test(panel));
}

// ── 4 · Copy in both catalogues ──────────────────────────────────────────────
{
  const load = async rel => { const mod = await import(rel); return mod.default || mod.en || mod.hi || mod; };
  const en = await load('../src/i18n/strings.en.js');
  const hi = await load('../src/i18n/strings.hi.js');
  for (const key of ['signOutEverywhere', 'signOutEverywhereHelp', 'signOutEverywhereAsk', 'signOutEverywhereYes', 'signingOutEverywhere', 'signedOutEverywhere', 'signOutEverywhereFailed'].map(k => `cloudSecurity.${k}`)) {
    ok(`${key} exists in English`, typeof en?.[key] === 'string' && en[key].length > 3);
    ok(`${key} exists in Hindi`, typeof hi?.[key] === 'string' && hi[key].length > 3 && hi[key] !== en[key]);
  }
  ok('the help says this device is included', /this one included/.test(en['cloudSecurity.signOutEverywhereHelp'] || ''));
  ok('the question says this device is included', /including this one/.test(en['cloudSecurity.signOutEverywhereAsk'] || ''));
}

console.log(`\nCloud sign out everywhere — ${pass}/${pass + fail} checks`);
if (failures.length) {
  console.log('\nfailures:');
  for (const line of failures) console.log(`  ${line}`);
}
console.log(`\nCLOUD SIGN OUT EVERYWHERE: ${fail ? 'FAIL' : 'PASS'} — ${pass}/${pass + fail} checks`);
process.exit(fail ? 1 : 0);
