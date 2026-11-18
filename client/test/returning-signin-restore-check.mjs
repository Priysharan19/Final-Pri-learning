// Pri Learning · returning sign-in on a device with no profile
//
// Owner report (live, Prithagoras): signing in again with Google on a browser
// with no local profile asked "Which year are you in?", and the profile the
// device then made replaced the one the account already held. An existing
// account signing in on an empty device must (1) never be asked its class when
// the server holds a profile, (2) get that profile and its progress back, and
// (3) never overwrite or tombstone what the server holds.
//
// Drives the real IndexedDB-backed modules against a stateful in-process
// server. No production endpoint is contacted.
//
// Usage: node client/test/returning-signin-restore-check.mjs

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { installBrowserEnv, resetStorage } from './backend-check.mjs';

installBrowserEnv();
resetStorage();
globalThis.__PRI_CLOUD_ORIGIN__ = 'https://pri.example.test';

const account = { id: 'acct-G', email: 'g@example.test', name: 'G', role: 'student', emailVerified: true };
const stored = { name: 'Gia', year: 11, course: 'nsw', pathway: 'ext1', indiaTrack: null, avatar: '🦊', theme: 'dark', dailyGoal: 25, handwriting: true };
const entities = new Map([['profile:self', { kind: 'profile', entityId: 'self', version: 2, serverCursor: 5, tombstone: false, body: { ...stored } }]]);
const events = [];
const pushes = [];
let cursor = 5;
let holdProfile = true;

const json = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json', 'x-pri-request-id': 'returning-test' } });
globalThis.fetch = async (url, options = {}) => {
  const path = new URL(url).pathname;
  if (path === '/v1/account/login' || path === '/v1/account/me') return json({ account });
  if (path === '/v1/entitlements') return json({ entitlement: { plan: 'free', status: 'free', provider: 'none', sourceVersion: 0 } });
  if (path.startsWith('/v1/sync/pull/')) {
    const from = Number(path.split('/').at(-1)) || 0;
    return json({
      schemaVersion: 1, cursor, hasMore: false,
      events: events.filter(e => e.serverCursor > from),
      entities: [...entities.values()].filter(e => holdProfile && e.serverCursor > from)
    });
  }
  if (path === '/v1/sync/push') {
    const body = JSON.parse(options.body || '{}');
    pushes.push(body);
    const accepted = [];
    for (const e of body.entities || []) {
      const key = `${e.kind}:${e.entityId}`;
      const held = entities.get(key);
      cursor += 1;
      const next = { kind: e.kind, entityId: e.entityId, version: (held?.version || 0) + 1, serverCursor: cursor, tombstone: e.operation === 'delete', body: e.body };
      entities.set(key, next);
      accepted.push({ kind: e.kind, entityId: e.entityId, version: next.version, serverCursor: cursor });
    }
    return json({ schemaVersion: 1, cursor, acceptedEvents: (body.events || []).map((e, i) => ({ id: e.id, serverCursor: cursor + i, replayed: false })), acceptedEntities: accepted, fullRescanAccepted: !!body.fullRescan });
  }
  if (path === '/v1/account/logout') return json({ ok: true });
  return json({ error: { code: 'NOT_FOUND', message: path } }, 404);
};

const { put, get, byIndex } = await import('../src/local/idb.js');
const { loginCloudAccount } = await import('../src/platform/cloudAccount.js');
const { syncNow } = await import('../src/platform/syncWorker.js');
const { readStoredAccountProfile, applyStoredProfile, usableStoredProfile } = await import('../src/platform/accountProfileRestore.js');
const { cloud } = await import('../src/platform/cloudTransport.js');

let pass = 0;
const failures = [];
const ok = (name, cond, detail = '') => { if (cond) pass++; else failures.push(`${name}${detail ? ` — ${detail}` : ''}`); };
const eq = (name, a, b) => ok(name, JSON.stringify(a) === JSON.stringify(b), `expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);

// The server marked three answers on the first device.
for (const [i, q] of ['q-a', 'q-b', 'q-c'].entries()) {
  cursor += 1;
  const id = `attempt-${q}`;
  events.push({ serverCursor: cursor, id, deviceId: 'server-grader', deviceSeq: i + 1, kind: 'graded-attempt', entityId: q, occurredAt: 1_000 + i,
    payload: { attemptId: id, questionId: q, subtopic: 'linear', difficulty: 2, correct: i !== 1, ms: 4000, hintsUsed: 0, tutorLevel: 0, support: 'independent', mode: 'practice', viaInk: false, ratingBefore: 1150, ratingAfter: 1160, createdAt: 1_000 + i } });
}

// ── 1 · A session with no local profile asks the server, and gets the profile ─
const read = await readStoredAccountProfile(account.id, { pull: cloud.syncPull });
eq('the stored profile is read before anything is asked', [read?.year, read?.pathway, read?.name], [11, 'ext1', 'Gia']);
eq('its settings come with it', [read?.avatar, read?.theme, read?.dailyGoal], ['🦊', 'dark', 25]);

// ── 2 · The device profile the sign-in makes is a vessel, not an authority ───
// What POST /profiles writes: the right class, every setting at its default.
await put('profiles', { id: 'p-new', name: 'Gia', avatar: '🙂', year: 11, course: 'nsw', pathway: 'ext1', role: 'student', theme: 'light', dailyGoal: 10, xp: 0 });
await applyStoredProfile('p-new', read);
await loginCloudAccount('p-new', { email: account.email, password: 'test-password-only' });
const sync = await syncNow('p-new');
const row = await get('profiles', 'p-new');
eq('the device profile takes the stored avatar, theme and goal', [row.avatar, row.theme, row.dailyGoal], ['🦊', 'dark', 25]);
ok('the vessel marker is gone after the first sync', row.restoredFromAccount === undefined);
const server = entities.get('profile:self');
eq('the server profile still holds the stored settings', [server.body.avatar, server.body.theme, server.body.dailyGoal, server.body.year, server.body.pathway, server.body.name], ['🦊', 'dark', 25, 11, 'ext1', 'Gia']);
ok('the server profile was never tombstoned', server.tombstone === false);
ok('every profile this device pushed carries the stored values',
  pushes.flatMap(p => p.entities || []).filter(e => e.kind === 'profile').every(e => e.operation === 'upsert' && e.body.avatar === '🦊' && e.body.theme === 'dark' && e.body.dailyGoal === 25));

// ── 3 · Progress comes back ──────────────────────────────────────────────────
eq('three server-marked answers are restored on the empty device', (await byIndex('attempts', 'pid', 'p-new')).length, 3);
ok('the sync reports the restore', sync.restoredEvents >= 3, String(sync.restoredEvents));

// ── 3b · Even a vessel holding defaults cannot replace the stored profile ────
entities.set('profile:self', { kind: 'profile', entityId: 'self', version: 7, serverCursor: ++cursor, tombstone: false, body: { ...stored } });
await put('profiles', { id: 'p-bare', name: 'Gia', avatar: '🙂', year: 11, course: 'nsw', pathway: 'advanced', role: 'student', theme: 'light', dailyGoal: 10, xp: 0, restoredFromAccount: true });
await loginCloudAccount('p-bare', { email: account.email, password: 'test-password-only' });
await syncNow('p-bare');
const bare = await get('profiles', 'p-bare');
eq('a marked device profile adopts the stored profile whole', [bare.avatar, bare.theme, bare.dailyGoal, bare.pathway], ['🦊', 'dark', 25, 'ext1']);
eq('and the server still holds the stored profile', [entities.get('profile:self').body.pathway, entities.get('profile:self').body.avatar, entities.get('profile:self').tombstone], ['ext1', '🦊', false]);

// ── 4 · "Could not ask" is never "has none"; "has none" is the only time the class is asked ──
let threw = false;
try { await readStoredAccountProfile(account.id, { pull: async () => { throw new Error('offline'); } }); } catch { threw = true; }
ok('a failed read throws rather than reporting no profile', threw);
holdProfile = false;
eq('an account with no stored profile reads as none (the class is then asked)', await readStoredAccountProfile(account.id, { pull: cloud.syncPull }), null);
entities.set('profile:self', { ...entities.get('profile:self'), tombstone: true });
holdProfile = true;
eq('a tombstoned profile reads as none', await readStoredAccountProfile(account.id, { pull: cloud.syncPull }), null);
eq('a stored year outside 7-12 is not usable', usableStoredProfile({ year: 3 }), null);

// ── 5 · The card reads before it asks ────────────────────────────────────────
const flow = readFileSync(fileURLToPath(new URL('../src/components/SignUpFlow.jsx', import.meta.url)), 'utf8');
ok('signedIn reads the stored profile before asking the class',
  /if \(!inline && year === null\) \{\s*let stored = null;\s*try \{ stored = await readStoredAccountProfile\(/.test(flow));
ok('a read failure stops at the error and never falls through to the class',
  /catch \(err\) \{ fail\(err\); return; \}\s*if \(stored && stored\.course === defaultCourse\(\)\)/.test(flow));
ok('the stored profile is handed to the device profile maker', /restoredProfile: stored/.test(flow));

if (failures.length) { console.error(failures.map(f => `FAIL ${f}`).join('\n')); process.exit(1); }
console.log(`returning-signin-restore-check: ${pass}/${pass} checks passed`);
