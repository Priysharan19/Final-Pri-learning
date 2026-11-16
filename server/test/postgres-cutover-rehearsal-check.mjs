// Pri Learning · the production cutover, rehearsed end to end on throwaway databases.
//
//   node scripts/with-postgres.mjs node server/test/postgres-cutover-rehearsal-check.mjs
//
// docs/operations/postgres-cutover.md moves a live SQLite platform onto
// Supabase Postgres in four operator steps: back up (§6), export (§6a),
// import into the migrated project, point the server at it. Each step has its
// own test (platform-db-operations, sqlite-to-postgres-export); this one runs
// them in order and then asks the question the cutover is for: does the real
// server, booted on the imported database as pri_server under RLS, still know
// its students?
//
//   1. A real server on a SQLite FILE: two students sign up, verify, answer
//      questions (one right, one wrong) over /v1. Their history is read back.
//   2. backup.mjs takes the VACUUM INTO copy; the export reads THAT copy.
//   3. import-inserts.sql into a freshly migrated Postgres; verify.sql clean.
//   4. A new server on that Postgres: a device signed in before the cutover is
//      still signed in; each student signs in with their password; their
//      history is the same events, ids and marks; neither sees the other's;
//      a new answer is marked and lands after every imported cursor.
//
// Synthetic accounts, scripted nothing: the real marker, the real routes, the
// real tools. Throwaway local Postgres only — this is a rehearsal, NOT the
// production cutover, which needs the owner's authorisation and the hosted
// project (BLOCKED_EXTERNAL, #386).
import './support/hermetic.mjs';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

if (!String(process.env.PRI_TEST_PG_ADMIN_URL || '').trim()) {
  console.log('POSTGRES CUTOVER REHEARSAL: SKIPPED — needs a throwaway Postgres (run via node scripts/with-postgres.mjs).');
  process.exit(0);
}
// The Postgres runner counts a suite only when it says which engine it ran on.
console.log('engine: postgres');
const scratch = mkdtempSync(join(tmpdir(), 'pri-cutover-'));
process.env.NODE_ENV = 'test';
process.env.PRI_AUTH_DELIVERY_KEY = '6b'.repeat(32);
process.env.PRI_FREE_PRACTICE_PER_DAY = '100000';
delete process.env.PRI_PUBLIC_ORIGIN;
const { startApp, registerAccount, verifyEmail } = await import('./support/app-harness.mjs');
const { createPlatformDb } = await import('../platform/db.js');
const { ensureAuthDeliverySchema } = await import('../platform/authDelivery.js');
const { ensureBillingSchema } = await import('../platform/billingSchema.js');
const { createPostgresStore, asStore } = await import('../platform/store.js');
const { backupPlatformDb } = await import('../tools/backup.mjs');
const { exportSqliteToPostgres } = await import('../tools/sqlite-to-postgres-export.mjs');
const { scratchDatabase, serverRoleUrl } = await import('./support/postgres.mjs');

let count = 0;
const eq = (a, b, name) => { assert.deepEqual(a, b, name); count++; };
const ok = (cond, name) => { assert.ok(cond, name); count++; };
const PASSWORD = 'correct-horse-battery';
let target = null, pgStore = null, before = null, after = null;

const drive = h => {
  const post = (path, body, jar, headers = {}) => h.request(path, { method: 'POST', jar, body, headers });
  let n = 0;
  return {
    issue: (jar, seed) => post('/v1/practice/issue', { generator: 'c8-linear-equations-both-sides', difficulty: 2, seed, curriculum: 'in' }, jar),
    sealed: async id => JSON.parse((await asStore(h.db).get("SELECT response_json FROM idempotency_keys WHERE scope='practice-question' AND key=?", [id])).response_json).answer,
    submit: (jar, id, answer, tag) => {
      const sid = `cutover-${tag}-${String(++n).padStart(3, '0')}`;
      return post(`/v1/practice/${id}/submit`, { submissionId: sid, answer: String(answer), mode: 'typed' }, jar, { 'Idempotency-Key': sid });
    },
    login: (jar, email, deviceId) => post('/v1/account/login', { email, password: PASSWORD, deviceId }, jar),
    me: jar => h.request('/v1/account/me', { jar }),
    history: async jar => {
      const out = [];
      let cursor = 0;
      for (let page = 0; page < 50; page++) {
        const r = await h.request(`/v1/sync/pull/${cursor}`, { jar });
        assert.equal(r.status, 200, `pull ${cursor}: ${r.status}`);
        out.push(...r.data.events);
        cursor = r.data.cursor;
        if (!r.data.hasMore) break;
      }
      return out;
    }
  };
};
const graded = events => events.filter(e => e.kind === 'graded-attempt')
  .map(e => ({ id: e.id, entityId: e.entityId, correct: e.payload?.correct === true, marksEarned: e.payload?.marksEarned ?? null, serverCursor: Number(e.serverCursor) }))
  .sort((x, y) => x.serverCursor - y.serverCursor);

try {
  // ── 1 · a live SQLite platform with two students ──────────────────────────
  const dbPath = join(scratch, 'pri-learning-platform.db');
  const raw = createPlatformDb(dbPath);
  ensureAuthDeliverySchema(raw);
  ensureBillingSchema(raw);
  before = await startApp({ db: raw });
  const b1 = drive(before);
  const asha = await registerAccount(before, { name: 'Asha', email: 'asha.cutover@example.test', deviceId: 'ipad-asha' });
  const ravi = await registerAccount(before, { name: 'Ravi', email: 'ravi.cutover@example.test', deviceId: 'phone-ravi' });
  eq([(await verifyEmail(before, asha.account.id)).status, (await verifyEmail(before, ravi.account.id)).status], [200, 200], 'two students signed up and verified on SQLite');
  for (const [who, tag, seeds] of [[asha, 'asha', [5101, 5102, 5103]], [ravi, 'ravi', [5201, 5202]]]) {
    for (const [i, seed] of seeds.entries()) {
      const q = await b1.issue(who.jar, seed);
      eq(q.status, 201, `${tag}: question ${i + 1} issued`);
      const right = (await b1.sealed(q.data.question.id)).value;
      const answer = i === 1 ? Number(right) + 7 : right;
      let s = await b1.submit(who.jar, q.data.question.id, answer, tag);
      // A first wrong answer leaves one try open; a second wrong one resolves the question.
      if (i === 1) s = await b1.submit(who.jar, q.data.question.id, Number(right) + 9, tag);
      eq([s.status, s.data?.correct, s.data?.resolved], [200, i !== 1, true], `${tag}: question ${i + 1} resolved ${i !== 1 ? 'right' : 'wrong'}`);
    }
  }
  const ashaBefore = graded(await b1.history(asha.jar));
  const raviBefore = graded(await b1.history(ravi.jar));
  eq([ashaBefore.length, raviBefore.length], [3, 2], 'their histories hold three and two marked attempts');
  eq([ashaBefore.map(e => e.correct), raviBefore.map(e => e.correct)], [[true, false, true], [true, false]], 'with the marks as given');
  await before.close();
  before = null;

  // ── 2 · backup, then export the backup ───────────────────────────────────
  const backup = backupPlatformDb({ dbPath, outDir: join(scratch, 'backups') });
  eq([backup.ok, backup.integrity, backup.accounts], [true, 'ok', 2], 'the backup is verified and holds both accounts');
  const exported = exportSqliteToPostgres({ dbPath: backup.path, outDir: join(scratch, 'export'), inserts: true });
  ok(exported.ok === true && exported.totals.rows > 0 && exported.source.accounts === 2, `the backup exports (${exported.totals.rows} rows, ${exported.source.accounts} accounts)`);

  // ── 3 · import into a freshly migrated Postgres ──────────────────────────
  target = await scratchDatabase('cutover_rehearsal');
  await target.client.query(readFileSync(join(scratch, 'export', 'import-inserts.sql'), 'utf8'));
  const verifySql = readFileSync(join(scratch, 'export', 'verify.sql'), 'utf8');
  const verifyQueries = verifySql.split(/\n(?=-- \d\. )/).map(block => block.split('\n').filter(l => !l.startsWith('--')).join('\n').trim()).filter(Boolean);
  const counts = await target.client.query(verifyQueries[0]);
  eq(counts.rows.filter(r => r.result !== 'ok').map(r => `${r.table_name} ${r.expected_rows}≠${r.actual_rows}`), [], 'verify.sql: every table count matches');
  eq([(await target.client.query(verifyQueries[1])).rows[0].versions_ok, (await target.client.query(verifyQueries[2])).rows[0].cursor_sequence_ok,
    (await target.client.query(verifyQueries[3])).rows[0].emails_lowercase_ok, (await target.client.query(verifyQueries[4])).rows[0].audit_log_identity_ok],
  [true, true, true, true], 'verify.sql: versions, cursor sequence, email case and audit identity are ok');

  // ── 4 · the server on Postgres, as pri_server under RLS ──────────────────
  pgStore = await createPostgresStore(await serverRoleUrl(target.name));
  after = await startApp({ db: pgStore });
  const a1 = drive(after);
  const kept = await a1.me(asha.jar);
  eq([kept.status, kept.data?.account?.id], [200, asha.account.id], 'a device signed in before the cutover is still signed in after it (sessions moved with the data)');
  const ashaJar = {}, raviJar = {};
  eq((await a1.login(ashaJar, 'asha.cutover@example.test', 'ipad-asha-2')).status, 200, 'Asha signs in with her password on Postgres');
  eq((await a1.login(raviJar, 'RAVI.Cutover@example.test', 'phone-ravi-2')).status, 200, 'Ravi signs in (email case-insensitive, as before)');
  eq((await a1.login({}, 'asha.cutover@example.test', 'ipad-x').then(r => r)).status === 200, true, '(a third sign-in also works)');
  const wrong = await after.request('/v1/account/login', { method: 'POST', jar: {}, body: { email: 'asha.cutover@example.test', password: 'not-her-password', deviceId: 'x' } });
  ok(wrong.status === 401 || wrong.status === 400, `a wrong password is still refused (${wrong.status})`);

  const ashaAfter = graded(await a1.history(ashaJar));
  const raviAfter = graded(await a1.history(raviJar));
  eq(ashaAfter, ashaBefore, 'Asha\'s history on Postgres is the same events, ids, cursors and marks');
  eq(raviAfter, raviBefore, 'and so is Ravi\'s');
  const ashaIds = new Set(ashaAfter.map(e => e.id));
  eq(raviAfter.filter(e => ashaIds.has(e.id)), [], 'neither sees the other\'s attempts');

  const q = await a1.issue(ashaJar, 5104);
  eq(q.status, 201, 'a new question is issued on Postgres');
  const s = await a1.submit(ashaJar, q.data.question.id, (await a1.sealed(q.data.question.id)).value, 'asha-after');
  eq([s.status, s.data?.correct, s.data?.authoritative], [200, true, true], 'and marked by the server');
  const ashaNow = graded(await a1.history(ashaJar));
  eq(ashaNow.length, 4, 'her history grows to four');
  ok(ashaNow[3].serverCursor > Math.max(...ashaBefore.map(e => e.serverCursor), ...raviBefore.map(e => e.serverCursor)), `the new attempt lands after every imported cursor (${ashaNow[3].serverCursor})`);
  eq(graded(await a1.history(raviJar)), raviBefore, 'Ravi\'s history is unchanged by Asha\'s new answer');

  console.log(`POSTGRES CUTOVER REHEARSAL: PASS — ${count}/${count} checks — a live SQLite platform backed up, exported, imported into a migrated Postgres and served by the real server as pri_server: sessions, passwords, histories and marks survive exactly, accounts stay apart, new answers mark and sync after the imported cursors. Throwaway databases only; not the production cutover.`);
} finally {
  if (before) await before.close();
  if (after) await after.close();
  if (pgStore && !after) await pgStore.close();
  if (target) await target.drop();
  rmSync(scratch, { recursive: true, force: true });
}
