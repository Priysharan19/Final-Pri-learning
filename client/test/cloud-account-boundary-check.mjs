// Pri Learning · local profile ↔ cloud account boundary checks
// Ensures an unrelated authenticated cloud cookie cannot silently retarget a
// local child's profile, and that account PII is not persisted in device rows.

import { installBrowserEnv, resetStorage, rawRows } from './backend-check.mjs';

installBrowserEnv();
resetStorage();
globalThis.__PRI_CLOUD_ORIGIN__ = 'https://pri.example.test';

const { put } = await import('../src/local/idb.js');
const {
  cloudAccountLink, disconnectCloudAccount, loginCloudAccount, verifyCloudSession
} = await import('../src/platform/cloudAccount.js');

let account = { id: 'acct-A', email: 'student@example.test', name: 'Student A', role: 'student', emailVerified: true };

const json = (value, status = 200) => new Response(JSON.stringify(value), {
  status,
  headers: { 'content-type': 'application/json', 'x-pri-request-id': 'test-request' }
});

globalThis.fetch = async (url, options = {}) => {
  const path = new URL(url).pathname;
  if (path === '/v1/account/login') return json({ account });
  if (path === '/v1/account/me') return json({ account });
  if (path === '/v1/entitlements') return json({ entitlement: { plan: 'free', status: 'free', provider: 'none', sourceVersion: 0 } });
  if (path === '/v1/account/logout') return json({ ok: true });
  return json({ error: { code: 'NOT_FOUND', message: path } }, 404);
};

let pass = 0;
let fail = 0;
const failures = [];
const ok = (name, condition, detail = '') => {
  if (condition) { pass++; return; }
  fail++;
  failures.push(`${name}${detail ? ` — ${detail}` : ''}`);
};
const same = (name, actual, expected) => ok(name, JSON.stringify(actual) === JSON.stringify(expected), `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);

const link = await loginCloudAccount('p1', { email: account.email, password: 'not-stored-password' });
same('login links expected account', link.accountId, 'acct-A');
same('link exposes no persisted email', link.email, undefined);
same('link exposes no persisted cloud name', link.name, undefined);

const disk = JSON.stringify(rawRows().device || []);
ok('device database does not retain account email', !disk.includes('student@example.test'), disk);
ok('device database does not retain cloud display name', !disk.includes('Student A'), disk);
ok('device database does not retain login password', !disk.includes('not-stored-password'), disk);

// A different authenticated cookie/session must not rewrite the local link.
account = { id: 'acct-B', email: 'other@example.test', name: 'Student B', role: 'student', emailVerified: true };
let mismatch = null;
try { await verifyCloudSession('p1'); } catch (error) { mismatch = error; }
same('different session is rejected before relinking', mismatch?.code, 'CLOUD_LINK_CONFLICT');
same('saved local link remains account A', (await cloudAccountLink('p1'))?.accountId, 'acct-A');

// Disconnect removes only cloud replica metadata, not the local profile stores.
await put('device', { id: 'pri-cloud-sync-state-v1:p1', cursor: 7, accountId: 'acct-A' });
await put('device', { id: 'pri-cloud-outbox-v1:p1', version: 1, nextSeq: 2, initialComplete: true, items: [] });
await put('device', { id: 'pri-cloud-remote-event-v1:p1:event-1', eventId: 'event-1' });
await put('device', { id: 'unrelated-device-row', keep: true });
await disconnectCloudAccount('p1');
same('disconnect removes account link', await cloudAccountLink('p1'), null);
const after = JSON.stringify(rawRows().device || []);
ok('disconnect removes profile sync state', !after.includes('pri-cloud-sync-state-v1:p1'), after);
ok('disconnect removes profile cloud outbox', !after.includes('pri-cloud-outbox-v1:p1'), after);
ok('disconnect removes profile remote-event cache', !after.includes('pri-cloud-remote-event-v1:p1:event-1'), after);
ok('disconnect preserves unrelated device metadata', after.includes('unrelated-device-row'), after);

console.log(`\nCloud account boundary — ${pass}/${pass + fail} checks`);
if (failures.length) {
  console.log('\nfailures:');
  for (const line of failures) console.log(`  ${line}`);
}
console.log(`\n${fail ? '✖ CLOUD ACCOUNT BOUNDARY FAILED' : '✔ CLOUD ACCOUNT BOUNDARY PASSED'} — ${pass}/${pass + fail} checks`);
process.exit(fail ? 1 : 0);
