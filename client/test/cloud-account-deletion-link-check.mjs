// Pri Learning · deleting the cloud account forgets it on this device (#500, #521)
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
// Follow-ups from the #519 review (#521):
//   · the request names the account this profile is linked to, so a server
//     whose device-wide session changed hands refuses it (ACCOUNT_MISMATCH)
//     instead of deleting the session's account;
//   · every other local profile linked to the same account is unlinked too;
//   · a deletion with no answer (network) is settled by one /me probe now and
//     by verifyCloudSession later (a 401 after the request, inside a one-day
//     TTL = account gone, reported as inferred: confirmedBy 'probe');
//   · a server refusal (any status, 5xx included) keeps the link and clears the
//     pending stamp; the native shell is asked to forget the session exactly once.
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

const { put, get } = await import('../src/local/idb.js');
const cloudAccount = await import('../src/platform/cloudAccount.js');
const { cloudAccountLink, cloudLinkRowId, loginCloudAccount, verifyCloudSession } = cloudAccount;
const { profileOutboxStats } = await import('../src/platform/profileOutbox.js');
const { onCloudSessionChange } = await import('../src/platform/cloudSession.js');
const { createFakeHost } = await import('../src/platform/native/fakeHost.js');
const { priNative } = await import('../src/platform/native/index.js');

const deleteCloudAccount = cloudAccount.deleteCloudAccount;
ok('the platform exposes one deletion call that also forgets the account locally',
  typeof deleteCloudAccount === 'function', `deleteCloudAccount is ${typeof deleteCloudAccount}`);

// ── A fake cloud: records every request; DELETE /v1/account answers as told ──
let account = null;
let deleteReply = { status: 200, body: { deleted: true } };
// 'network' makes the DELETE throw with no HTTP status (fetch failed, timed out).
let meReply = null; // null → { account }; otherwise { status, body } or 'network'
const requests = [];
const json = (value, status = 200) => new Response(JSON.stringify(value), {
  status,
  headers: { 'content-type': 'application/json', 'x-pri-request-id': 'test-request' }
});
const networkFailure = () => Object.assign(new TypeError('Failed to fetch'), { code: 'NETWORK' });
function answer(path, method, body) {
  if (path === '/v1/account/login') return { status: 200, body: { account } };
  if (path === '/v1/account/me') {
    if (meReply === 'network') throw networkFailure();
    return meReply || { status: 200, body: { account } };
  }
  if (path === '/v1/entitlements') return { status: 200, body: { entitlement: { plan: 'free', status: 'free', provider: 'none', sourceVersion: 0 } } };
  if (path === '/v1/account/logout') return { status: 200, body: { ok: true } };
  if (path === '/v1/account' && method === 'DELETE') {
    if (deleteReply === 'network') throw networkFailure();
    return deleteReply;
  }
  return { status: 404, body: { error: { code: 'NOT_FOUND', message: path } } };
}
globalThis.fetch = async (url, options = {}) => {
  const path = new URL(url).pathname;
  const method = String(options.method || 'GET').toUpperCase();
  const body = options.body ? JSON.parse(options.body) : undefined;
  requests.push({ method, path, body });
  const reply = answer(path, method, body);
  return json(reply.body, reply.status);
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
const linkRow = pid => get('device', cloudLinkRowId(pid));
const deletions = () => requests.filter(r => r.method === 'DELETE' && r.path === '/v1/account');

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

  // #521 item 3: the proof is sent as given, plus the account this profile is
  // linked to, so the server can refuse a session that changed hands.
  same(`${label}: exactly one DELETE /v1/account carries the proof as given and the linked account id`, deletions().map(r => r.body), [{ ...proof, accountId }]);
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
  same('a refused deletion leaves no pending-deletion stamp behind', (await cloudAccountLink(pid))?.deleteRequestedAt, null);
  same('a refused deletion sends no probe: the server already answered', requests.filter(r => r.path === '/v1/account/me').length, 0);
}

// ── 2b · The session changed hands: the server refuses, nothing is deleted ───
{
  const pid = 'p-swapped';
  await linkedProfile(pid, 'acct-mine');
  requests.length = 0;
  deleteReply = { status: 409, body: { error: { code: 'ACCOUNT_MISMATCH', message: 'The signed-in account is not the one this profile is linked to.' } } };
  let error = null;
  try { await deleteCloudAccount?.(pid, { password: 'correct horse' }); } catch (err) { error = err; }
  same('a session that changed hands is refused with the server code', error?.code, 'ACCOUNT_MISMATCH');
  same('the request named the account this profile is linked to', deletions().map(r => r.body.accountId), ['acct-mine']);
  same('the refused profile stays linked to its own account', (await cloudAccountLink(pid))?.accountId, 'acct-mine');
  same('and carries no pending-deletion stamp', (await cloudAccountLink(pid))?.deleteRequestedAt, null);
}

// ── 2c · A server failure (5xx) is a refusal too: the account is still there ─
{
  const pid = 'p-overload';
  await linkedProfile(pid, 'acct-overload');
  requests.length = 0;
  deleteReply = { status: 503, body: { error: { code: 'DATABASE_OVERLOADED', message: 'Try again shortly.', retryable: true } } };
  let error = null;
  try { await deleteCloudAccount?.(pid, { password: 'correct horse' }); } catch (err) { error = err; }
  same('a 503 reaches the panel with its code', [error?.status, error?.code], [503, 'DATABASE_OVERLOADED']);
  same('a 503 keeps the link', (await cloudAccountLink(pid))?.accountId, 'acct-overload');
  ok('a 503 keeps the account sync state', deviceRows().includes(`pri-cloud-sync-state-v1:${pid}`), deviceRows());
  same('a 503 leaves no pending stamp (the server answered: nothing was deleted)', (await cloudAccountLink(pid))?.deleteRequestedAt, null);
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

// ── 3b · Two local profiles linked to the SAME account: both are unlinked ───
// (#521 item 2) A second profile would otherwise keep a link to an account
// that no longer exists and have every later sign-in and sync refused.
{
  await linkedProfile('p-twin-a', 'acct-twin');
  await linkedProfile('p-twin-b', 'acct-twin');
  await linkedProfile('p-bystander', 'acct-bystander');
  announcements.length = 0;
  requests.length = 0;
  deleteReply = { status: 200, body: { deleted: true } };
  await deleteCloudAccount?.('p-twin-a', { password: 'correct horse' });
  same('exactly one DELETE is sent for the twins', deletions().length, 1);
  same('the deleting profile is unlinked', await cloudAccountLink('p-twin-a'), null);
  same('the other profile linked to the same account is unlinked too', await cloudAccountLink('p-twin-b'), null);
  ok('the other profile\'s replica state for that account is gone', !deviceRows().includes('pri-cloud-sync-state-v1:p-twin-b'), deviceRows());
  const twinOutbox = await profileOutboxStats('p-twin-b');
  ok('the other profile\'s outbox is back to a full rescan', twinOutbox.initialComplete === false && twinOutbox.requiresFullRescan === true, JSON.stringify(twinOutbox));
  same('the other profile is told its session ended', announcements.filter(a => a?.localProfileId === 'p-twin-b').at(-1), { localProfileId: 'p-twin-b', connected: false, accountId: null, role: null });
  same('a profile linked to a different account is untouched', (await cloudAccountLink('p-bystander'))?.accountId, 'acct-bystander');
  ok('its replica state is untouched too', deviceRows().includes('pri-cloud-sync-state-v1:p-bystander'), deviceRows());
}

// ── 4 · No profile id, no deletion: never delete an account the device cannot then forget ──
{
  requests.length = 0;
  let error = null;
  try { await deleteCloudAccount?.('', { otpChallengeId: 'c', otpCode: '111111' }); } catch (err) { error = err; }
  ok('a deletion without a local profile id is refused', !!error);
  same('and nothing reaches the server', requests.filter(r => r.path === '/v1/account').length, 0);
  error = null;
  try { await deleteCloudAccount?.('p-never-linked', { password: 'x' }); } catch (err) { error = err; }
  same('a profile with no link is refused: there is no account to name', error?.code, 'CLOUD_ACCOUNT_NOT_LINKED');
  same('and nothing reaches the server either', requests.filter(r => r.path === '/v1/account').length, 0);
}

// ── 5 · No answer from the server (#521 item 1) ─────────────────────────────
// 5a. The request was sent but the reply was lost: the session that asked is
//     dead (/me → 401), so the account went with it. Healed on the spot.
{
  const pid = 'p-lost-reply';
  await linkedProfile(pid, 'acct-lost');
  requests.length = 0;
  deleteReply = 'network';
  meReply = { status: 401, body: { error: { code: 'AUTH_REQUIRED', message: 'Sign in is required.' } } };
  let result = null;
  let error = null;
  try { result = await deleteCloudAccount?.(pid, { password: 'correct horse' }); } catch (err) { error = err; }
  same('a lost reply followed by a 401 probe counts as deleted', [error, result?.deleted, result?.confirmedBy], [null, true, 'probe']);
  same('exactly one probe was sent', requests.filter(r => r.path === '/v1/account/me').length, 1);
  same('the link is gone', await cloudAccountLink(pid), null);
  ok('the replica state is gone', !deviceRows().includes(`pri-cloud-sync-state-v1:${pid}`), deviceRows());
  meReply = null;
}

// 5b. The request never arrived (or timed out mid-transaction): /me still
//     answers 200 for the account right now. Nothing is forgotten, and the
//     stamp is KEPT — on a client timeout the server may still be inside the
//     deletion transaction, so a session alive this instant can be gone a
//     moment later; a single 200 proves nothing. verifyCloudSession settles it
//     (5e: a later 200 clears the stamp; 5c: a later 401 is the deletion).
{
  const pid = 'p-never-sent';
  await linkedProfile(pid, 'acct-alive');
  requests.length = 0;
  deleteReply = 'network';
  meReply = null;
  let error = null;
  try { await deleteCloudAccount?.(pid, { password: 'correct horse' }); } catch (err) { error = err; }
  ok('the network failure reaches the panel', !!error && !error.status, String(error));
  same('the link stays: the account is still there', (await cloudAccountLink(pid))?.accountId, 'acct-alive');
  ok('the pending stamp is kept after a single 200 probe (the deletion may still be in flight)', Number((await cloudAccountLink(pid))?.deleteRequestedAt) > 0, deviceRows());
  same('a later verified 200 is a connected session that clears the stamp', [(await verifyCloudSession(pid)).connected, (await cloudAccountLink(pid))?.deleteRequestedAt], [true, null]);
}

// 5c. Fully offline: the DELETE and the probe both fail. The intent is kept on
//     the link row and settled later by verifyCloudSession.
{
  const pid = 'p-offline';
  await linkedProfile(pid, 'acct-offline');
  await linkedProfile('p-offline-twin', 'acct-offline');
  requests.length = 0;
  deleteReply = 'network';
  meReply = 'network';
  let error = null;
  try { await deleteCloudAccount?.(pid, { password: 'correct horse' }); } catch (err) { error = err; }
  ok('offline: the failure reaches the panel', !!error && !error.status, String(error));
  same('offline: the link stays for now', (await cloudAccountLink(pid))?.accountId, 'acct-offline');
  ok('offline: the pending-deletion stamp is kept on the link row', Number((await cloudAccountLink(pid))?.deleteRequestedAt) > 0, deviceRows());

  // Later, back online: the session is dead → the account went → heal everywhere.
  deleteReply = { status: 200, body: { deleted: true } };
  meReply = { status: 401, body: { error: { code: 'AUTH_REQUIRED', message: 'Sign in is required.' } } };
  announcements.length = 0;
  const verified = await verifyCloudSession(pid);
  same('verifyCloudSession reads a 401 after a pending deletion as "deleted", and says it was inferred', [verified.connected, verified.reason, verified.confirmedBy, verified.link], [false, 'deleted', 'probe', null]);
  same('the link is gone', await cloudAccountLink(pid), null);
  same('the twin profile linked to the same account is unlinked too', await cloudAccountLink('p-offline-twin'), null);
  ok('the replica state is gone', !deviceRows().includes(`pri-cloud-sync-state-v1:${pid}`), deviceRows());
  same('the profile is told its session ended', announcements.filter(a => a?.localProfileId === pid).at(-1), { localProfileId: pid, connected: false, accountId: null, role: null });
  meReply = null;
}

// 5d. A 401 with NO pending stamp is just a signed-out session: the link stays
//     (unchanged behaviour), so an expired cookie never unlinks a live account.
{
  const pid = 'p-signed-out';
  await linkedProfile(pid, 'acct-signed-out');
  meReply = { status: 401, body: { error: { code: 'AUTH_REQUIRED', message: 'Sign in is required.' } } };
  const verified = await verifyCloudSession(pid);
  same('a plain 401 is "signed-out"', [verified.connected, verified.reason, verified.link?.accountId], [false, 'signed-out', 'acct-signed-out']);
  same('and keeps the link', (await cloudAccountLink(pid))?.accountId, 'acct-signed-out');
  meReply = null;
}

// 5e. A stale stamp with a live account: the next 200 clears it.
{
  const pid = 'p-stale-stamp';
  await linkedProfile(pid, 'acct-stale');
  const row = await linkRow(pid);
  await put('device', { ...row, deleteRequestedAt: Date.now() - 60_000 });
  ok('the stale stamp is on the row', Number((await cloudAccountLink(pid))?.deleteRequestedAt) > 0);
  meReply = null;
  const verified = await verifyCloudSession(pid);
  same('a 200 after a stale stamp is a connected session', [verified.connected, verified.link?.accountId], [true, 'acct-stale']);
  same('and the stamp is cleared', (await cloudAccountLink(pid))?.deleteRequestedAt, null);
}

// 5f. The stamp has a TTL (DELETE_STAMP_TTL_MS). Past it, a 401 is read as the
//     ordinary end of a session (idle/absolute expiry, "sign out everywhere", a
//     revocation from the devices list), not as the deletion: the account is
//     not declared gone, nothing is unlinked, and the stale stamp is dropped so
//     it cannot fire later either.
{
  const { DELETE_STAMP_TTL_MS } = cloudAccount;
  same('the stamp TTL is one day', DELETE_STAMP_TTL_MS, 24 * 60 * 60 * 1000);
  const pid = 'p-expired-stamp';
  await linkedProfile(pid, 'acct-still-there');
  await linkedProfile('p-expired-twin', 'acct-still-there');
  const row = await linkRow(pid);
  await put('device', { ...row, deleteRequestedAt: Date.now() - DELETE_STAMP_TTL_MS - 1000 });
  meReply = { status: 401, body: { error: { code: 'AUTH_REQUIRED', message: 'Sign in is required.' } } };
  announcements.length = 0;
  const verified = await verifyCloudSession(pid);
  same('a 401 after the TTL is "signed-out", not "deleted"', [verified.connected, verified.reason, verified.link?.accountId], [false, 'signed-out', 'acct-still-there']);
  same('the link stays', (await cloudAccountLink(pid))?.accountId, 'acct-still-there');
  same('the twin profile stays linked too', (await cloudAccountLink('p-expired-twin'))?.accountId, 'acct-still-there');
  ok('the replica state stays', deviceRows().includes(`pri-cloud-sync-state-v1:${pid}`), deviceRows());
  same('the expired stamp is dropped from the row', (await cloudAccountLink(pid))?.deleteRequestedAt, null);
  same('no "session ended" announcement is made for a live account', announcements.filter(a => a?.localProfileId === pid).length, 0);
  // Just inside the TTL the lost reply is still the likelier story: deleted.
  const fresh = await linkRow(pid);
  await put('device', { ...fresh, deleteRequestedAt: Date.now() - DELETE_STAMP_TTL_MS + 60_000 });
  const inside = await verifyCloudSession(pid);
  same('a 401 inside the TTL is still read as the deletion', [inside.reason, inside.confirmedBy, await cloudAccountLink(pid)], ['deleted', 'probe', null]);
  meReply = null;
}

// ── 6 · Inside a native shell the session jar is the shell's: forget it exactly once ──
// (#521 item 4) The cloud session lives in the shell's native cookie jar; the
// page cannot clear it, so deletion must ask the shell to forget it. Through
// the real priNative envelope transport against the fake host the Swift and
// Kotlin shells are held to.
{
  const shellRequests = [];
  let forgets = 0;
  const host = createFakeHost({
    capabilities: { cloud: { versions: [1], configured: true }, storage: { versions: [1], durable: true } },
    handlers: {
      'host.ready': () => ({}),
      'cloud.forgetSession': () => { forgets += 1; return {}; },
      'cloud.request': payload => {
        const method = String(payload.method || 'GET').toUpperCase();
        const body = payload.body ? JSON.parse(payload.body) : undefined;
        shellRequests.push({ method, path: payload.path, body });
        const reply = answer(payload.path, method, body);
        return { status: reply.status, body: JSON.stringify(reply.body), requestId: 'native-request' };
      }
    }
  });
  priNative.dispose();
  ok('the fake shell is a native shell to the page', priNative.isNativeShell() === true);

  await linkedProfile('p-native', 'acct-native');
  shellRequests.length = 0;
  deleteReply = { status: 200, body: { deleted: true } };
  let error = null;
  try { await deleteCloudAccount?.('p-native', { otpChallengeId: 'challenge-n', otpCode: '222222' }); } catch (err) { error = err; }
  same('native shell: deletion succeeds through the shell transport', error?.message || null, null);
  same('native shell: the DELETE went through the shell and named the linked account', shellRequests.filter(r => r.method === 'DELETE' && r.path === '/v1/account').map(r => r.body), [{ otpChallengeId: 'challenge-n', otpCode: '222222', accountId: 'acct-native' }]);
  same('native shell: the shell is asked to forget its session exactly once', forgets, 1);
  same('native shell: the link is gone', await cloudAccountLink('p-native'), null);

  // A refusal must not touch the shell's jar.
  await linkedProfile('p-native-kept', 'acct-native-kept');
  forgets = 0;
  deleteReply = { status: 401, body: { error: { code: 'OTP_REAUTH_FAILED', message: 'That code is not right.' } } };
  error = null;
  try { await deleteCloudAccount?.('p-native-kept', { otpChallengeId: 'challenge-n2', otpCode: '000000' }); } catch (err) { error = err; }
  same('native shell: a refusal reports the server code', error?.code, 'OTP_REAUTH_FAILED');
  same('native shell: a refusal never asks the shell to forget the session', forgets, 0);
  same('native shell: a refusal keeps the link', (await cloudAccountLink('p-native-kept'))?.accountId, 'acct-native-kept');

  // Two profiles, one account: the device-wide jar is forgotten once.
  await linkedProfile('p-native-twin-a', 'acct-native-twin');
  await linkedProfile('p-native-twin-b', 'acct-native-twin');
  forgets = 0;
  deleteReply = { status: 200, body: { deleted: true } };
  await deleteCloudAccount?.('p-native-twin-a', { password: 'correct horse' });
  same('native shell: both profiles linked to the deleted account are unlinked', [await cloudAccountLink('p-native-twin-a'), await cloudAccountLink('p-native-twin-b')], [null, null]);
  same('native shell: the device-wide session is forgotten once, not once per profile', forgets, 1);

  priNative.dispose();
  host.uninstall();
}

// ── 7 · The Account panel: every deletion handler goes through that one call ─
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
    ok(`the ${label} handler shows the catalogue words for a server refusal (ACCOUNT_MISMATCH has copy)`, /cloudErrorText\(/.test(source), source.slice(0, 400));
  }
  ok('the panel imports the shared deletion call from the platform account module',
    /import\s*\{[^}]*\bdeleteCloudAccount\b[^}]*\}\s*from\s*'\.\.\/platform\/cloudAccount\.js'/.test(panel));
  const { CLOUD_ERROR_CODES_WITH_COPY } = await import('../src/platform/cloudErrorCopy.js');
  ok('ACCOUNT_MISMATCH has catalogue copy', CLOUD_ERROR_CODES_WITH_COPY.includes('ACCOUNT_MISMATCH'));
  const en = (await import('../src/i18n/strings.en.js')).default || (await import('../src/i18n/strings.en.js')).en;
  const hi = (await import('../src/i18n/strings.hi.js')).default || (await import('../src/i18n/strings.hi.js')).hi;
  ok('the mismatch copy exists in English', typeof (en?.['cloudError.accountMismatch']) === 'string' && en['cloudError.accountMismatch'].length > 20);
  ok('the mismatch copy exists in Hindi', typeof (hi?.['cloudError.accountMismatch']) === 'string' && hi['cloudError.accountMismatch'].length > 20);
}

console.log(`\nCloud account deletion link — ${pass}/${pass + fail} checks`);
if (failures.length) {
  console.log('\nfailures:');
  for (const line of failures) console.log(`  ${line}`);
}
console.log(`\nACCOUNT DELETION LINK: ${fail ? 'FAIL' : 'PASS'} — ${pass}/${pass + fail} checks`);
process.exit(fail ? 1 : 0);
