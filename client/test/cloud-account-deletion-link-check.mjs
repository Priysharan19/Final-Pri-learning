// Pri Learning · deleting the cloud account forgets it on this device (#500)
//
// Production bug (#500): an account made with a one-time code (no password, no
// Apple or Google) deleted itself in Settings → Account, and the server deleted
// it, but the device kept the persisted link row
// (device/pri-cloud-account-link-v1:<pid>). After a relaunch the profile was
// still "linked" to an account that no longer exists, so sign-in and sync were
// refused while the stale link stayed. The password and provider deletion
// handlers each unlinked by hand; the code handler did not.
//
// The contract this file holds: deleting the cloud account from this device is
// one platform call, deleteCloudAccount(pid, proof), and it always removes the
// link, the account's replica state and the native session, whatever the proof
// (password, provider token, one-time code). A refused deletion keeps the link.
// Every deletion handler in the Account panel goes through that one call, so a
// new handler cannot forget the local half again.
//
//   node client/test/cloud-account-deletion-link-check.mjs

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
const { profileOutboxStats } = await import('../src/platform/profileOutbox.js');
const { onCloudSessionChange } = await import('../src/platform/cloudSession.js');

const deleteCloudAccount = cloudAccount.deleteCloudAccount;
ok('the platform exposes one deletion call that also forgets the account locally',
  typeof deleteCloudAccount === 'function', `deleteCloudAccount is ${typeof deleteCloudAccount}`);

// ── A fake cloud: records every request; DELETE /v1/account answers as told ──
let account = null;
let deleteReply = { status: 200, body: { deleted: true } };
const requests = [];
const json = (value, status = 200) => new Response(JSON.stringify(value), {
  status,
  headers: { 'content-type': 'application/json', 'x-pri-request-id': 'test-request' }
});
globalThis.fetch = async (url, options = {}) => {
  const path = new URL(url).pathname;
  const method = String(options.method || 'GET').toUpperCase();
  requests.push({ method, path, body: options.body ? JSON.parse(options.body) : undefined });
  if (path === '/v1/account/login') return json({ account });
  if (path === '/v1/account/me') return json({ account });
  if (path === '/v1/entitlements') return json({ entitlement: { plan: 'free', status: 'free', provider: 'none', sourceVersion: 0 } });
  if (path === '/v1/account/logout') return json({ ok: true });
  if (path === '/v1/account' && method === 'DELETE') return json(deleteReply.body, deleteReply.status);
  return json({ error: { code: 'NOT_FOUND', message: path } }, 404);
};

const announcements = [];
onCloudSessionChange(event => announcements.push(event?.detail));

/** A profile linked to an account, with the replica state a completed sync leaves. */
async function linkedProfile(pid, accountId) {
  account = { id: accountId, email: `${accountId}@example.test`, name: accountId, role: 'student', emailVerified: true };
  await put('profiles', { id: pid, name: `Local ${pid}`, year: 12, course: 'in' });
  await loginCloudAccount(pid, { email: account.email, password: 'only-for-the-fake' });
  await put('device', { id: `pri-cloud-sync-state-v1:${pid}`, cursor: 9, accountId, entityVersions: { 'profile:self': 4 } });
  await put('device', { id: `pri-cloud-outbox-v1:${pid}`, version: 1, nextSeq: 3, initialComplete: true, items: [] });
  await put('device', { id: `pri-cloud-remote-event-v1:${pid}:event-1`, eventId: 'event-1', payload: { privateTo: accountId } });
}
const deviceRows = () => JSON.stringify(rawRows().device || []);

const proofs = [
  ['one-time code (the #500 path)', 'p-code', 'acct-code', { otpChallengeId: 'challenge-1', otpCode: '123456' }],
  ['password', 'p-pass', 'acct-pass', { password: 'correct horse' }],
  ['provider token', 'p-social', 'acct-social', { provider: 'google', idToken: 'id-token', nonce: 'nonce-1' }]
];

// ── 1 · Every kind of proof: the account is deleted and the link is gone ────
for (const [label, pid, accountId, proof] of proofs) {
  await linkedProfile(pid, accountId);
  same(`${label}: the profile starts linked`, (await cloudAccountLink(pid))?.accountId, accountId);
  requests.length = 0;
  announcements.length = 0;
  deleteReply = { status: 200, body: { deleted: true } };

  let error = null;
  try { await deleteCloudAccount?.(pid, proof); } catch (err) { error = err; }
  same(`${label}: deletion succeeds`, error?.message || null, null);

  const deletion = requests.filter(r => r.method === 'DELETE' && r.path === '/v1/account');
  same(`${label}: exactly one DELETE /v1/account carries the proof as given`, deletion.map(r => r.body), [proof]);
  same(`${label}: the persisted link row is removed, so a relaunch finds no account`, await cloudAccountLink(pid), null);
  ok(`${label}: no device row still names the link`, !deviceRows().includes(cloudLinkRowId(pid)), deviceRows());
  ok(`${label}: the deleted account's sync cursor is gone`, !deviceRows().includes(`pri-cloud-sync-state-v1:${pid}`), deviceRows());
  ok(`${label}: the deleted account's replica payload is gone`, !deviceRows().includes(`"privateTo":"${accountId}"`), deviceRows());
  const outbox = await profileOutboxStats(pid);
  ok(`${label}: the profile outbox is back to a full rescan for whichever account comes next`,
    outbox.initialComplete === false && outbox.requiresFullRescan === true, JSON.stringify(outbox));
  same(`${label}: the session is announced as ended for this profile`,
    announcements.filter(a => a?.localProfileId === pid).at(-1), { localProfileId: pid, connected: false, accountId: null, role: null });
  same(`${label}: no logout is sent for a session the deletion already ended`,
    requests.filter(r => r.path === '/v1/account/logout').length, 0);
}

// ── 2 · A refused deletion (wrong code) changes nothing on the device ───────
{
  const pid = 'p-refused';
  await linkedProfile(pid, 'acct-kept');
  requests.length = 0;
  deleteReply = { status: 401, body: { error: { code: 'OTP_REAUTH_FAILED', message: 'That code is not right.' } } };
  let error = null;
  try { await deleteCloudAccount?.(pid, { otpChallengeId: 'challenge-2', otpCode: '000000' }); } catch (err) { error = err; }
  same('a refused deletion reports the server code to the panel', error?.code, 'OTP_REAUTH_FAILED');
  same('a refused deletion keeps the link: the account still exists', (await cloudAccountLink(pid))?.accountId, 'acct-kept');
  ok('a refused deletion keeps the account sync state', deviceRows().includes(`pri-cloud-sync-state-v1:${pid}`), deviceRows());
}

// ── 3 · Deleting one profile's account leaves another profile's link alone ──
{
  await linkedProfile('p-other', 'acct-other');
  await linkedProfile('p-leaving', 'acct-leaving');
  deleteReply = { status: 200, body: { deleted: true } };
  await deleteCloudAccount?.('p-leaving', { otpChallengeId: 'challenge-3', otpCode: '654321' }).catch(() => {});
  same('the deleting profile is unlinked', await cloudAccountLink('p-leaving'), null);
  same('another profile on the same device stays linked to its own account', (await cloudAccountLink('p-other'))?.accountId, 'acct-other');
}

// ── 4 · No profile id, no deletion: never delete an account the device cannot then forget ──
{
  requests.length = 0;
  let error = null;
  try { await deleteCloudAccount?.('', { otpChallengeId: 'c', otpCode: '111111' }); } catch (err) { error = err; }
  ok('a deletion without a local profile id is refused', !!error);
  same('and nothing reaches the server', requests.filter(r => r.path === '/v1/account').length, 0);
}

// ── 5 · The Account panel: every deletion handler goes through that one call ─
{
  const panel = readFileSync(new URL('../src/components/CloudAccountSecurity.jsx', import.meta.url), 'utf8');
  ok('the Account panel never calls the raw transport deletion itself',
    !/cloud\s*\.\s*deleteAccount\s*\(/.test(panel), 'found cloud.deleteAccount( in CloudAccountSecurity.jsx');
  const body = name => {
    const start = panel.indexOf(`async function ${name}(`);
    if (start < 0) return '';
    const next = panel.indexOf('\n  async function ', start + 1);
    const end = panel.indexOf('\n  const providerLabel', start);
    return panel.slice(start, [next, end].filter(i => i > start).sort((a, b) => a - b)[0] ?? panel.length);
  };
  for (const [handler, label] of [['deleteWithCode', 'one-time code'], ['deleteAccount', 'password'], ['deleteWithProvider', 'provider']]) {
    const source = body(handler);
    ok(`the ${label} handler (${handler}) exists`, !!source);
    ok(`the ${label} handler deletes through deleteCloudAccount(pid, …)`, /await\s+deleteCloudAccount\(\s*pid\s*,/.test(source), source.slice(0, 400));
  }
  ok('the panel imports the shared deletion call from the platform account module',
    /import\s*\{[^}]*\bdeleteCloudAccount\b[^}]*\}\s*from\s*'\.\.\/platform\/cloudAccount\.js'/.test(panel));
}

console.log(`\nCloud account deletion link — ${pass}/${pass + fail} checks`);
if (failures.length) {
  console.log('\nfailures:');
  for (const line of failures) console.log(`  ${line}`);
}
console.log(`\nACCOUNT DELETION LINK: ${fail ? 'FAIL' : 'PASS'} — ${pass}/${pass + fail} checks`);
process.exit(fail ? 1 : 0);
