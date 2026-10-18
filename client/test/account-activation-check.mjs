// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · may this profile open the app? — the gate's decision, in Node
//
// platform/accountActivation.js is the one question App.jsx asks before any
// route renders: is this device profile linked to an account whose LIVE
// session the server confirms, whose contact is verified, whose age/guardian
// decision the server's own bound statement permits, and which has synced
// once. Every "yes" has to come from the server in the same call; nothing
// cached may answer it; and only the server's own refusal may ever eject a
// student who is already inside — a 429, a 503 or a dropped connection must
// read as "not now", never as a sign-out.
//
// The real module runs here against a scripted server (fetch is stood in, as
// cloud-sync-ack-check.mjs does for the sync worker), so every refusal code,
// its retryable flag and the A→B→A second-tab swap are exercised exactly.
//
// Usage:  node client/test/account-activation-check.mjs
// ─────────────────────────────────────────────────────────────────────────────
import { installBrowserEnv, resetStorage } from './backend-check.mjs';

installBrowserEnv();
resetStorage();
globalThis.__PRI_CLOUD_ORIGIN__ = 'https://pri.example.test';

const ACCOUNT_A = { id: 'acct-A', email: 'a@example.test', name: 'A', role: 'student', emailVerified: true };
const ACCOUNT_B = { id: 'acct-B', email: 'b@example.test', name: 'B', role: 'student', emailVerified: true };

// What the scripted server says next. Each field is a function so a test can
// script one reply and leave the rest honest.
const server = {
  me: () => ({ status: 200, body: { account: ACCOUNT_A } }),
  guardian: () => ({ status: 200, body: { accountId: 'acct-A', required: false, state: 'not-required', eligible: true, emailVerified: true, blockerCode: null } }),
  push: null,                 // null = accept everything; a function overrides
  calls: []
};
let serverCursor = 0;
const json = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json', 'x-pri-request-id': 'activation-test' } });
const refusal = (status, code) => json({ error: { code, message: code } }, status);

globalThis.fetch = async (url, options = {}) => {
  const path = new URL(url).pathname;
  server.calls.push(`${options.method || 'GET'} ${path}`);
  if (path === '/v1/account/login') return json({ account: ACCOUNT_A });
  if (path === '/v1/account/me') { const r = server.me(); return r.status === 200 ? json(r.body) : refusal(r.status, r.code || 'AUTH_REQUIRED'); }
  if (path === '/v1/account/guardian/state') { const r = server.guardian(); return r.status === 200 ? json(r.body) : refusal(r.status, r.code || 'SERVICE_UNAVAILABLE'); }
  if (path === '/v1/account/logout') return json({ ok: true });
  if (path === '/v1/entitlements') return json({ entitlement: { plan: 'free', status: 'free', provider: 'none', sourceVersion: 0 } });
  if (path.startsWith('/v1/sync/pull/')) {
    const from = Number(path.split('/').pop()) || 0;
    return json({ schemaVersion: 1, cursor: Math.max(from, serverCursor), hasMore: false, events: [], entities: [] });
  }
  if (path === '/v1/sync/push') {
    if (server.push) return server.push();
    const body = JSON.parse(options.body || '{}');
    const cursor = (serverCursor += 100);
    const acceptedEvents = (body.events || []).map((event, i) => ({ id: event.id, serverCursor: cursor + i, replayed: false }));
    const acceptedEntities = (body.entities || []).map((entity, i) => ({ kind: entity.kind, entityId: entity.entityId, version: entity.baseVersion + 1, serverCursor: cursor + 50 + i }));
    return json({ schemaVersion: 1, cursor, acceptedEvents, acceptedEntities, fullRescanAccepted: !!body.fullRescan });
  }
  return json({ error: { code: 'NOT_FOUND', message: path } }, 404);
};

const { put } = await import('../src/local/idb.js');
const { loginCloudAccount, cloudAccountLink } = await import('../src/platform/cloudAccount.js');
const { profileOutboxStats } = await import('../src/platform/profileOutbox.js');
const {
  ensureAccountActivated, ActivationBlocked, isActivationDenied,
  ACTIVATION_DENIED_CODES, ACTIVATION_SIGN_IN_CODES, ACTIVATION_GUARDIAN_CODES, ACTIVATION_BLOCKED_CODES
} = await import('../src/platform/accountActivation.js');

let pass = 0;
const failures = [];
const ok = (name, condition, detail = '') => { if (condition) { pass++; return true; } failures.push(`${name}${detail ? ` — ${detail}` : ''}`); return false; };
const eq = (name, actual, expected) => ok(name, JSON.stringify(actual) === JSON.stringify(expected), `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);

/** Run the gate and return the refusal (or the activation under `ready`). */
async function gate(pid, options) {
  try { return { ready: await ensureAccountActivated(pid, options) }; }
  catch (error) {
    if (!(error instanceof ActivationBlocked)) throw error;
    return { code: error.code, retryable: error.retryable, denied: isActivationDenied(error), cause: error.cause?.code || error.cause?.status || null };
  }
}
const syncCalls = () => server.calls.filter(c => /\/v1\/sync\//.test(c)).length;
const reset = () => { server.me = () => ({ status: 200, body: { account: ACCOUNT_A } }); server.guardian = () => ({ status: 200, body: { accountId: 'acct-A', required: false, state: 'not-required', eligible: true, emailVerified: true, blockerCode: null } }); server.push = null; };

// ── 0 · the vocabulary ───────────────────────────────────────────────────────
eq('the authoritative refusals are exactly these', [...ACTIVATION_DENIED_CODES].sort(),
  ['ACCOUNT_ACCESS_DENIED', 'ACCOUNT_MISMATCH', 'ACCOUNT_NOT_LINKED', 'AGE_DECLARATION_REQUIRED', 'EMAIL_UNVERIFIED', 'GUARDIAN_CONSENT_PENDING', 'GUARDIAN_CONSENT_WITHDRAWN', 'PROFILE_MISSING', 'SIGN_IN_REQUIRED']);
ok('every sign-in, guardian and blocked code is an authoritative refusal',
  [...ACTIVATION_SIGN_IN_CODES, ...ACTIVATION_GUARDIAN_CODES, ...ACTIVATION_BLOCKED_CODES].every(code => ACTIVATION_DENIED_CODES.includes(code)));
ok('no retryable condition is in the authoritative list',
  ['SESSION_UNAVAILABLE', 'CONSENT_UNAVAILABLE', 'FIRST_SYNC_PENDING', 'CLOUD_UNAVAILABLE'].every(code => !ACTIVATION_DENIED_CODES.includes(code)));

// ── 1 · no profile, no link ──────────────────────────────────────────────────
eq('no profile at all is PROFILE_MISSING', (await gate(null)).code, 'PROFILE_MISSING');
await put('profiles', { id: 'p1', name: 'Asha', avatar: '🙂', year: 10, role: 'student', course: 'in', indiaTrack: 'cbse', theme: 'dark', dailyGoal: 10, handwriting: true });
{
  const r = await gate('p1');
  eq('a profile with no link row is ACCOUNT_NOT_LINKED', r.code, 'ACCOUNT_NOT_LINKED');
  ok('and that is authoritative, not retryable', r.denied && !r.retryable);
  eq('the server was not asked anything for an unlinked profile', server.calls.filter(c => !c.includes('/v1/sync')).length, 0);
}

// ── 2 · the happy path: live session, bound statement, first sync ────────────
await loginCloudAccount('p1', { email: 'a@example.test', password: 'test-password-only' });
ok('the link exists but has never synced', (await cloudAccountLink('p1'))?.accountId === 'acct-A' && (await cloudAccountLink('p1')).lastSyncAt === null);
ok('a fresh link requires a full reconciliation', (await profileOutboxStats('p1')).requiresFullRescan === true);
server.calls.length = 0;
{
  const r = await gate('p1');
  ok('an adult with a live, verified session and a bound eligible statement is let in', !!r.ready, JSON.stringify(r));
  eq('the activation names the profile and the account', [r.ready?.profileId, r.ready?.accountId], ['p1', 'acct-A']);
  eq('and carries the server\'s consent verdict', r.ready?.guardian, { required: false, state: 'not-required' });
  ok('the live session was asked for (/me), then the ONE bound statement, then the first sync',
    server.calls.indexOf('GET /v1/account/me') < server.calls.indexOf('GET /v1/account/guardian/state') &&
    server.calls.indexOf('GET /v1/account/guardian/state') < server.calls.findIndex(c => /\/v1\/sync\//.test(c)), server.calls.join(', '));
  ok('the first sync ran: push and pull reached the server', syncCalls() >= 2, server.calls.join(', '));
  ok('and the link now records it', Number((await cloudAccountLink('p1')).lastSyncAt) > 0);
  ok('the reconciliation is complete', (await profileOutboxStats('p1')).requiresFullRescan === false);
}
server.calls.length = 0;
{
  const r = await gate('p1', { sync: false });
  ok('a recheck of a profile already inside asks the server again', !!r.ready && server.calls.includes('GET /v1/account/me') && server.calls.includes('GET /v1/account/guardian/state'));
  eq('and never repeats a sync', syncCalls(), 0);
}
server.calls.length = 0;
{
  const r = await gate('p1');
  ok('a profile that has synced before is not made to sync again at the gate (the scheduler keeps it in step)', !!r.ready && syncCalls() === 0, server.calls.join(', '));
}

// ── 3 · the account must be the one the caller linked ────────────────────────
eq('an expected account that is not the linked one is ACCOUNT_MISMATCH, before the server is asked', (await gate('p1', { expectedAccountId: 'acct-B' })).code, 'ACCOUNT_MISMATCH');
eq('the linked account as expected is fine', !!(await gate('p1', { expectedAccountId: 'acct-A' })).ready, true);

// ── 4 · what the live session says ───────────────────────────────────────────
server.me = () => ({ status: 401, code: 'AUTH_REQUIRED' });
{
  const r = await gate('p1');
  eq('a session the server no longer has is SIGN_IN_REQUIRED', r.code, 'SIGN_IN_REQUIRED');
  ok('authoritative: the student is sent back to the card', r.denied && !r.retryable);
  ok('and it is a sign-in code, so the gate shows the card', ACTIVATION_SIGN_IN_CODES.includes(r.code));
}
server.me = () => ({ status: 403, code: 'ACCOUNT_SUSPENDED' });
{
  const r = await gate('p1');
  eq('a refused account is ACCOUNT_ACCESS_DENIED', r.code, 'ACCOUNT_ACCESS_DENIED');
  ok('authoritative, and a "blocked" screen', r.denied && ACTIVATION_BLOCKED_CODES.includes(r.code));
}
for (const status of [429, 500, 503]) {
  server.me = () => ({ status, code: status === 429 ? 'RATE_LIMITED' : 'SERVICE_UNAVAILABLE' });
  const r = await gate('p1');
  eq(`a ${status} from /me is SESSION_UNAVAILABLE`, r.code, 'SESSION_UNAVAILABLE');
  ok(`a ${status} is retryable and never ejects a student`, r.retryable && !r.denied);
}
server.me = () => { throw new TypeError('Failed to fetch'); };
{
  const r = await gate('p1');
  eq('a dropped connection is SESSION_UNAVAILABLE', r.code, 'SESSION_UNAVAILABLE');
  ok('retryable, never a sign-out', r.retryable && !r.denied);
}
server.me = () => ({ status: 200, body: { account: ACCOUNT_B } });
{
  const r = await gate('p1');
  eq('a live session for ANOTHER account (a second tab signed in) is ACCOUNT_MISMATCH', r.code, 'ACCOUNT_MISMATCH');
  ok('authoritative, and the link row was not overwritten with account B', r.denied && (await cloudAccountLink('p1')).accountId === 'acct-A');
}
server.me = () => ({ status: 200, body: { account: { ...ACCOUNT_A, emailVerified: false } } });
eq('an unverified contact is EMAIL_UNVERIFIED', (await gate('p1')).code, 'EMAIL_UNVERIFIED');
server.me = () => ({ status: 200, body: { account: { ...ACCOUNT_A, emailVerified: undefined } } });
eq('an absent verified flag fails closed as EMAIL_UNVERIFIED', (await gate('p1')).code, 'EMAIL_UNVERIFIED');
reset();

// ── 5 · what the bound statement says ────────────────────────────────────────
const child = (state, extra = {}) => ({ status: 200, body: { accountId: 'acct-A', required: true, state, eligible: state === 'given', emailVerified: true, blockerCode: state === 'given' ? null : `GUARDIAN_CONSENT_${state.toUpperCase()}`, ...extra } });
server.guardian = () => child('pending');
{
  const r = await gate('p1');
  eq('a child whose guardian has not approved is GUARDIAN_CONSENT_PENDING', r.code, 'GUARDIAN_CONSENT_PENDING');
  ok('authoritative — the waiting screen, never the shell', r.denied && ACTIVATION_GUARDIAN_CODES.includes(r.code));
}
server.guardian = () => child('withdrawn');
{
  const r = await gate('p1');
  eq('a withdrawn approval is GUARDIAN_CONSENT_WITHDRAWN', r.code, 'GUARDIAN_CONSENT_WITHDRAWN');
  ok('authoritative, and a "blocked" screen with no way to ask again', r.denied && ACTIVATION_BLOCKED_CODES.includes(r.code));
}
server.guardian = () => child('undeclared', { blockerCode: 'AGE_DECLARATION_REQUIRED' });
eq('an account with no age on record is AGE_DECLARATION_REQUIRED', (await gate('p1')).code, 'AGE_DECLARATION_REQUIRED');
server.guardian = () => child('given');
{
  const r = await gate('p1');
  ok('a guardian-approved child is let in', !!r.ready, JSON.stringify(r));
  eq('with the consent on record', r.ready?.guardian, { required: true, state: 'given' });
}
server.guardian = () => ({ status: 200, body: { accountId: 'acct-B', required: false, state: 'not-required', eligible: true, emailVerified: true } });
{
  const r = await gate('p1');
  eq('A→B→A: a statement about account B between /me and /guardian/state is ACCOUNT_MISMATCH, never a permission for A', r.code, 'ACCOUNT_MISMATCH');
  ok('authoritative', r.denied);
}
server.guardian = () => ({ status: 200, body: { required: false, state: 'not-required' } });
{
  const r = await gate('p1');
  eq('an older server\'s unbound statement (no account id, no verdict) is CONSENT_UNAVAILABLE', r.code, 'CONSENT_UNAVAILABLE');
  ok('retryable, not grandfathered in', r.retryable && !r.denied);
}
server.guardian = () => ({ status: 200, body: { accountId: 'acct-A', required: true, state: 'pending', eligible: true, emailVerified: true } });
eq('a contradictory statement (eligible while pending) is refused as CONSENT_UNAVAILABLE', (await gate('p1')).code, 'CONSENT_UNAVAILABLE');
server.guardian = () => ({ status: 503, code: 'SERVICE_UNAVAILABLE' });
{
  const r = await gate('p1');
  eq('a 503 from the statement is CONSENT_UNAVAILABLE', r.code, 'CONSENT_UNAVAILABLE');
  ok('retryable: a student inside stays inside', r.retryable && !r.denied);
}
server.guardian = () => ({ status: 401, code: 'AUTH_REQUIRED' });
eq('a 401 from the statement is SIGN_IN_REQUIRED', (await gate('p1')).code, 'SIGN_IN_REQUIRED');
server.guardian = () => ({ status: 403, code: 'ACCOUNT_SUSPENDED' });
eq('a 403 from the statement is ACCOUNT_ACCESS_DENIED', (await gate('p1')).code, 'ACCOUNT_ACCESS_DENIED');
reset();

// ── 6 · the first sync, on a second profile that has never synced ────────────
await put('profiles', { id: 'p2', name: 'Ravi', avatar: '🙂', year: 9, role: 'student', course: 'in', indiaTrack: 'cbse', theme: 'dark', dailyGoal: 10, handwriting: true });
await loginCloudAccount('p2', { email: 'a@example.test', password: 'test-password-only' });
server.push = () => refusal(503, 'SERVICE_UNAVAILABLE');
server.calls.length = 0;
{
  const r = await gate('p2');
  eq('a first sync the server could not take is FIRST_SYNC_PENDING', r.code, 'FIRST_SYNC_PENDING');
  ok('retryable: nothing is lost and the student may try again', r.retryable && !r.denied);
  ok('the link records no sync', (await cloudAccountLink('p2')).lastSyncAt === null);
  ok('and the reconciliation is still owed', (await profileOutboxStats('p2')).requiresFullRescan === true);
}
server.push = null;
{
  const r = await gate('p2');
  ok('the retry, with the server back, lets the same profile in', !!r.ready && r.ready.accountId === 'acct-A', JSON.stringify(r));
  ok('and the reconciliation is now complete', (await profileOutboxStats('p2')).requiresFullRescan === false && Number((await cloudAccountLink('p2')).lastSyncAt) > 0);
}
server.push = () => refusal(401, 'AUTH_REQUIRED');
await put('profiles', { id: 'p3', name: 'Meera', avatar: '🙂', year: 8, role: 'student', course: 'in', indiaTrack: 'cbse', theme: 'dark', dailyGoal: 10, handwriting: true });
await loginCloudAccount('p3', { email: 'a@example.test', password: 'test-password-only' });
eq('a session that ends during the first sync is SIGN_IN_REQUIRED', (await gate('p3')).code, 'SIGN_IN_REQUIRED');
server.push = () => refusal(403, 'GUARDIAN_CONSENT_PENDING');
eq('a guardian refusal during the first sync is GUARDIAN_CONSENT_PENDING', (await gate('p3')).code, 'GUARDIAN_CONSENT_PENDING');
server.push = null;

// ── 7 · no server configured at all ──────────────────────────────────────────
{
  const origin = globalThis.__PRI_CLOUD_ORIGIN__;
  delete globalThis.__PRI_CLOUD_ORIGIN__;
  const r = await gate('p1');
  eq('a build with no Pri server is CLOUD_UNAVAILABLE', r.code, 'CLOUD_UNAVAILABLE');
  ok('retryable, not an eviction', r.retryable && !r.denied);
  globalThis.__PRI_CLOUD_ORIGIN__ = origin;
}

if (failures.length) {
  console.log(`ACCOUNT ACTIVATION: FAIL — ${failures.length} of ${pass + failures.length} checks failed`);
  for (const f of failures) console.log(`  · ${f}`);
  process.exit(1);
}
console.log(`ACCOUNT ACTIVATION: PASS — ${pass}/${pass} checks — a live session, one bound statement and a first sync open the app; the server's own refusals eject, a 429/503/dropped connection never does`);
