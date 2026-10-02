// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · one practice attempt, one cloud learning event (§09/§22)
//
// End to end across the device/server boundary, in one process: the shipped
// local backend, profile outbox and sync worker (client/src, on the in-memory
// IndexedDB the client suites use) push to the shipped /v1 server (this
// harness, SQLite by default, `--engine=postgres` on a migrated Postgres).
// Nothing on either side is stubbed except the transport's cookie jar.
//
// The production bug: the local commit of an attempt and its cloud-queue entry
// were two writes, so an app killed between them left an attempt the server
// never received — and the replay that recovered the submission did not queue
// it either. Each case below ends with the server's own count of learning
// events for the question: exactly one.
//   1. killed after the commit, before the API layer queued it → replay → sync
//   2. a crash inside the commit itself → replay marks it → sync
//   3. a first wrong try, then the resolving try, then a replay → sync
//   4. syncing again sends nothing twice
// ─────────────────────────────────────────────────────────────────────────────
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const names = ['NODE_ENV', 'PRI_PLATFORM_DB', 'PRI_AUTH_DELIVERY_KEY', 'PRI_PUBLIC_ORIGIN'];
const prior = Object.fromEntries(names.map(name => [name, process.env[name]]));
const scratch = mkdtempSync(join(tmpdir(), 'pri-attempt-sync-'));
process.env.NODE_ENV = 'test';
process.env.PRI_PLATFORM_DB = join(scratch, 'platform.db');
process.env.PRI_AUTH_DELIVERY_KEY = '77'.repeat(32);
delete process.env.PRI_PUBLIC_ORIGIN;

const { startApp, checks, registerAccount, verifyEmail, absorbCookies, cookieHeader } = await import('./support/app-harness.mjs');
const { requestedEngine } = await import('./support/engine.mjs');

const c = checks();
const app = await startApp({ engine: requestedEngine() });
const db = app.db;

// ── The device ───────────────────────────────────────────────────────────────
const { installBrowserEnv, resetStorage } = await import('../../client/test/backend-check.mjs');
installBrowserEnv(); resetStorage();
globalThis.__PRI_CLOUD_ORIGIN__ = app.origin;

// A browser's cookie jar for the device's own requests (credentials:
// 'include'); the harness's requests carry their own jar and pass untouched.
const deviceJar = {};
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, options = {}) => {
  if (options.credentials !== 'include') return realFetch(url, options);
  const headers = { ...(options.headers || {}) };
  const cookies = cookieHeader(deviceJar);
  if (cookies) headers.Cookie = cookies;
  const { credentials: _c, cache: _k, redirect: _r, ...rest } = options;
  const response = await realFetch(url, { ...rest, headers, redirect: 'manual' });
  absorbCookies(response, deviceJar);
  return response;
};
if (typeof globalThis.document === 'undefined') {
  globalThis.document = { get cookie() { return Object.entries(deviceJar).map(([k, v]) => `${k}=${v}`).join('; '); } };
}

const { api } = await import('../../client/src/api.js');
const { dispatch } = await import('../../client/src/local/backend.js');
const idb = await import('../../client/src/local/idb.js');
const { checkAnswer } = await import('../../client/src/engine/checker.js');
const { loadAllBanks } = await import('../../client/src/engine/generators/index.js');
const { subtopicsForYear } = await import('../../client/src/engine/curriculum.js');
const { loginCloudAccount } = await import('../../client/src/platform/cloudAccount.js');
const { syncNow } = await import('../../client/src/platform/syncWorker.js');
await loadAllBanks();

// The same crash injection the client suite uses: the next transaction that
// writes the attempt and the cloud queue row dies on the queue write.
const database = await new Promise((resolve, reject) => {
  const req = globalThis.indexedDB.open('pri-learning');
  req.onsuccess = () => resolve(req.result);
  req.onerror = () => reject(req.error);
});
let crashQueueWrite = false;
const realTransaction = database.transaction.bind(database);
database.transaction = (stores, mode) => {
  const tr = realTransaction(stores, mode);
  const list = Array.isArray(stores) ? stores : [stores];
  if (crashQueueWrite && mode === 'readwrite' && list.includes('device') && list.includes('attempts')) {
    crashQueueWrite = false;
    const objectStore = tr.objectStore.bind(tr);
    tr.objectStore = (name) => {
      const st = objectStore(name);
      if (name !== 'device') return st;
      return new Proxy(st, {
        get(target, prop) {
          if (prop === 'put') return () => { throw new Error('simulated crash while committing'); };
          const v = target[prop];
          return typeof v === 'function' ? v.bind(target) : v;
        }
      });
    };
  }
  return tr;
};

const YEAR10 = subtopicsForYear(10).map(t => t.id);
let turn = 0;
function canonical(q) {
  const a = q?.answer; if (!a) return null;
  if (a.canonicalInput !== undefined) return String(a.canonicalInput);
  if (q.answerType === 'numeric') return a.surdForm || a.simplestFraction || a.requireExact ? null : String(a.value);
  if (q.answerType === 'mcq') return String(a.correctIndex);
  return null;
}
function wrongFor(q) {
  if (q.answerType === 'numeric') return String((Number(q.answer.value) || 0) + 7);
  if (q.answerType === 'mcq') return String(((q.answer.correctIndex || 0) + 1) % Math.max(2, q.mcqOptions?.length || 4));
  return null;
}
async function markable() {
  for (let i = 0; i < 60; i++) {
    const s = await api.post('/practice/next', { mode: 'topic', subtopic: YEAR10[turn++ % YEAR10.length], resume: false });
    const q = (await idb.get('questions', s.question.id)).payload;
    const right = canonical(q), wrong = wrongFor(q);
    if (right !== null && wrong !== null && checkAnswer(q, right).correct && !checkAnswer(q, wrong).correct
      && !checkAnswer(q, wrong).invalid && !(q.answerType === 'mcq' && q.answer.optionTraps?.[Number(wrong)])) {
      return { id: s.question.id, right, wrong };
    }
    await api.post(`/practice/${s.question.id}/discard`, {});
  }
  throw new Error('no markable question was served');
}

try {
  // ── An account on the server, a profile on the device, linked ─────────────
  const email = 'attempt.sync@example.test';
  const password = 'correct-horse-battery';
  const reg = await registerAccount(app, { email, password, name: 'Attempt Sync', deviceId: 'ipad-attempt-sync' });
  c.eq(reg.status, 201, 'a student account exists on the server');
  const accountId = reg.account.id;
  const verified = await verifyEmail(app, accountId);
  c.ok(verified.status === 200, `its email is verified (${verified.status})`);

  const me = (await api.post('/profiles', { name: 'Attempt Sync', year: 10 })).user;
  await loginCloudAccount(me.id, { email, password });
  const first = await syncNow(me.id);
  c.eq(first.requiresFullRescan, false, 'the first sync reconciles the new profile');

  const serverEvents = async (qid) => (await db.all(
    'SELECT id, kind FROM learning_events WHERE account_id=? AND entity_id=?', [accountId, qid]
  ));

  // ── 1 · killed after the commit, before the API layer ran ──────────────────
  const a = await markable();
  const committed = await dispatch('POST', `/practice/${a.id}/submit`, { answer: a.right, ms: 600, submissionId: 'sub_sync_case_one_01' });
  c.eq(committed.resolved, true, 'the attempt committed on the device');
  const replayA = await api.post(`/practice/${a.id}/submit`, { answer: a.right, ms: 600, submissionId: 'sub_sync_case_one_01' });
  c.eq(replayA.replayed, true, 'the relaunch replay returns the recorded verdict');
  await syncNow(me.id);
  const eventsA = await serverEvents(a.id);
  c.eq(eventsA.length, 1, `the server holds exactly one learning event for it (${eventsA.length})`);
  c.eq(eventsA[0]?.kind, 'practice-progress', 'a practice-progress event');

  // ── 2 · a crash inside the commit ──────────────────────────────────────────
  const b = await markable();
  crashQueueWrite = true;
  const crashed = await api.post(`/practice/${b.id}/submit`, { answer: b.right, ms: 600, submissionId: 'sub_sync_case_two_02' }).then(() => null, e => e);
  c.ok(crashed && /simulated crash/.test(crashed.message), 'the commit died mid-transaction');
  await syncNow(me.id);
  c.eq((await serverEvents(b.id)).length, 0, 'nothing reached the server for a commit that never happened');
  const replayB = await api.post(`/practice/${b.id}/submit`, { answer: b.right, ms: 600, submissionId: 'sub_sync_case_two_02' });
  c.eq(replayB.resolved, true, 'the relaunch marks it now');
  await syncNow(me.id);
  c.eq((await serverEvents(b.id)).length, 1, 'and the server then holds exactly one event for it');

  // ── 3 · a wrong first try, the resolving try, and a replay of each ─────────
  const d = await markable();
  await api.post(`/practice/${d.id}/submit`, { answer: d.wrong, ms: 600, submissionId: 'sub_sync_case_three_1' });
  await api.post(`/practice/${d.id}/submit`, { answer: d.wrong, ms: 600, submissionId: 'sub_sync_case_three_1' });
  await api.post(`/practice/${d.id}/submit`, { answer: d.right, ms: 600, submissionId: 'sub_sync_case_three_2' });
  await api.post(`/practice/${d.id}/submit`, { answer: d.right, ms: 600, submissionId: 'sub_sync_case_three_2' });
  await syncNow(me.id);
  c.eq((await serverEvents(d.id)).length, 1, 'two tries and two replays are one event on the server');

  // ── 4 · syncing again sends nothing twice ──────────────────────────────────
  const again = await syncNow(me.id);
  c.eq(again.pending, 0, 'the device queue is empty');
  const totals = await Promise.all([a.id, b.id, d.id].map(serverEvents));
  c.deq(totals.map(rows => rows.length), [1, 1, 1], 'each question still has exactly one event');
} finally {
  await app.close();
  globalThis.fetch = realFetch;
  rmSync(scratch, { recursive: true, force: true });
  for (const name of names) {
    if (prior[name] === undefined) delete process.env[name];
    else process.env[name] = prior[name];
  }
}

console.log(`engine: ${app.engine}`);
console.log(`PRACTICE ATTEMPT SYNC — PASS — ${c.count()}/${c.count()} checks — a killed or crashed submission reaches the server as exactly one learning event.`);
