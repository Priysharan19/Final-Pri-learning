// Pri Learning · where the time went on a timed paper (premium-intelligence
// plan F10): the pure report (engine/examTime.js) against hand-computed rows,
// and the server's Premium gate on it over real HTTP (server/platform/exams.js).
// Nothing is stubbed.
//
// Covered: the report is null unless every question was measured; shares,
// marks per minute and the last question reached per section are exact; it
// carries no advice; a Premium result carries it on finish and on read; a free
// result never does, and says only that it exists; an unmeasured paper offers
// nothing.
import './support/hermetic.mjs';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const keys = ['NODE_ENV', 'PRI_PLATFORM_DB', 'PRI_AUTH_DELIVERY_KEY', 'PRI_PUBLIC_ORIGIN', 'PRI_AUTH_EMAIL_PROVIDER'];
const before = Object.fromEntries(keys.map(key => [key, process.env[key]]));
const scratch = mkdtempSync(join(tmpdir(), 'pri-exam-time-'));
process.env.NODE_ENV = 'test';
process.env.PRI_PLATFORM_DB = join(scratch, 'unused.db');
process.env.PRI_AUTH_DELIVERY_KEY = '3d'.repeat(32);
delete process.env.PRI_PUBLIC_ORIGIN;

const { startApp, registerAccount, verifyEmail, promoteRole } = await import('./support/app-harness.mjs');
const { requestedEngine } = await import('./support/engine.mjs');
const { createPlatformDb } = await import('../platform/db.js');
const { ensureBillingSchema } = await import('../platform/billingSchema.js');
const { ensureAuthDeliverySchema } = await import('../platform/authDelivery.js');
const { asStore, createPostgresStore } = await import('../platform/store.js');
const { loadAllBanks, loadBanksFor, generateQuestion } = await import('../../client/src/engine/generators/index.js');
const { composeIndiaPaper, paperSpecOf } = await import('../../client/src/engine/indiaExamComposer.js');
const { indiaExamPaperSpec } = await import('../../client/src/engine/indiaExams.js');
const { indiaScope } = await import('../../client/src/engine/indiaProduct.js');
const { indiaPyqCells, narrowCells } = await import('../../client/src/engine/indiaExamCells.js');
const { timeReport, reached } = await import('../../client/src/engine/examTime.js');

const engine = requestedEngine();
let raw = null, pg = null, store;
if (engine === 'sqlite') {
  raw = createPlatformDb(join(scratch, 'time.db'));
  ensureAuthDeliverySchema(raw);
  ensureBillingSchema(raw);
  store = asStore(raw);
} else {
  const { scratchDatabase, serverRoleUrl } = await import('./support/postgres.mjs');
  const scratchDb = await scratchDatabase('examtime');
  pg = { scratchDb };
  store = await createPostgresStore(await serverRoleUrl(scratchDb.name));
}
const h = await startApp({ db: store });

let count = 0;
const ok = (cond, name) => { assert.ok(cond, name); count++; };
const eq = (actual, expected, name) => { assert.deepEqual(actual, expected, name); count++; };

let keySeq = 0;
const idem = () => `time-suite-${String(++keySeq).padStart(4, '0')}-${Date.now().toString(36)}`;
const create = (jar, body) => h.request('/v1/exams', { method: 'POST', jar, body, headers: { 'Idempotency-Key': idem() } });
const finish = (jar, id, body = {}) => h.request(`/v1/exams/${id}/finish`, { method: 'POST', jar, body });
const sealed = async id => JSON.parse((await h.db.get("SELECT response_json FROM idempotency_keys WHERE scope='exam-paper' AND key=?", [id])).response_json);
const rows = async (accountId, scope) => Number((await h.db.get('SELECT COUNT(*) AS n FROM idempotency_keys WHERE account_id=? AND scope=?', [accountId, scope]))?.n || 0);

await loadAllBanks();
async function spec(jar, grade, variant = 'standard') {
  await h.db.run('DELETE FROM rate_limits');
  const set = await h.request('/v1/exams/layout', { method: 'POST', jar, body: { blueprint: { track: 'cbse', grade, variant } } });
  assert.equal(set.status, 200, `layout ${grade}: ${set.status} ${set.text}`);
  const blueprint = indiaExamPaperSpec({ track: 'cbse', grade, variant });
  const chapters = indiaScope('cbse', grade);
  const pyq = indiaPyqCells('cbse', chapters);
  await loadBanksFor([...new Set([...pyq.values()].flatMap(list => list.map(cell => cell.generator)))]);
  const paper = composeIndiaPaper(blueprint, { seed: set.data.layoutSeed, draw: generateQuestion, chapters, pyqCellsFor: (chapter, range) => narrowCells(pyq.get(chapter.id) || [], range) });
  return paperSpecOf(paper, { track: 'cbse', grade, variant });
}


try {
  // ── The pure report ────────────────────────────────────────────────────────
  const row = (order, section, marks, awarded, ms, extra = {}) => ({ order, section, sectionLabel: `Section ${section}`, marks, awarded, ms, timed: true, unanswered: false, ...extra });
  const rows = [
    row(1, 'A', 1, 1, 60000), row(2, 'A', 1, 0, 60000),
    row(3, 'B', 3, 3, 240000), row(4, 'B', 3, 1, 180000),
    row(5, 'C', 5, 0, 60000), row(6, 'C', 5, 0, 0, { unanswered: true })
  ];
  const r = timeReport(rows);
  eq([r.totalMs, r.marks, r.awarded], [600000, 18, 5], 'totals: 10 minutes measured, 5 of 18 marks');
  eq(r.sections.map(s => [s.id, s.timeShare, s.marksShare, s.marksPerMinute]), [['A', 20, 11.1, 0.5], ['B', 70, 33.3, 0.57], ['C', 10, 55.6, 0]],
    'time share, marks share and marks a minute per section');
  eq(r.sections.map(s => [s.reached, s.questions, s.lastReached?.order, s.lastReached?.lost, s.lost]), [[2, 2, 2, 1, 1], [2, 2, 4, 2, 2], [1, 2, 5, 5, 10]],
    'the last question reached in each section and what it lost');
  eq([reached({ ms: 0, unanswered: true }), reached({ ms: 0, unanswered: false }), reached({ ms: 5 })], [false, true, true], 'reached: time spent or an answer given');
  eq(timeReport(rows.map((d, i) => i === 3 ? { ...d, timed: false } : d)), null, 'one unmeasured question: no report (an even split is not a measurement)');
  eq(timeReport(rows.map(d => ({ ...d, ms: 0 }))), null, 'no time at all: no report');
  eq([timeReport([]), timeReport(null)], [null, null], 'no rows: no report');
  ok(!/should|first|recommend|ideal|target|strategy|improve|predict/i.test(JSON.stringify(r)), 'the report itself carries figures only');

  // ── Over HTTP ──────────────────────────────────────────────────────────────
  const free = await registerAccount(h, { email: 'time.free@example.test', deviceId: 'ipad-time-free' });
  const paid = await registerAccount(h, { email: 'time.paid@example.test', deviceId: 'ipad-time-paid' });
  const admin = await registerAccount(h, { email: 'time.admin@example.test', deviceId: 'ipad-time-admin' });
  for (const a of [free, paid, admin]) eq((await verifyEmail(h, a.account.id)).status, 200, 'verified');
  await promoteRole(h, admin.jar, admin.account.id, 'admin');
  await h.db.run('DELETE FROM rate_limits');
  eq((await h.request('/v1/entitlements/admin/grant', { method: 'POST', jar: admin.jar, body: { accountId: paid.account.id, durationMs: 30 * 86400000 } })).status, 200, 'Premium granted by an admin');

  const sit = async (jar, times) => {
    await h.db.run('DELETE FROM rate_limits');
    const made = await create(jar, await spec(jar, 10));
    assert.equal(made.status, 201, `create: ${made.status} ${made.text}`);
    const exam = made.data.exam;
    const timesOf = times === null ? undefined : Object.fromEntries(exam.questions.map((q, i) => [q.id, i < 5 ? 90000 : 0]));
    await h.db.run('DELETE FROM rate_limits');
    const done = await finish(jar, exam.id, { reason: 'student', ...(timesOf ? { times: timesOf } : {}) });
    assert.equal(done.status, 200, `finish: ${done.status} ${done.text}`);
    return { exam, result: done.data.result ?? done.data };
  };

  const paidSat = await sit(paid.jar, {});
  const report = paidSat.result.timeReport;
  ok(report && report.totalMs === 5 * 90000, 'Premium: the marked result carries where the time went');
  ok(report.sections.reduce((n, s) => n + s.questions, 0) === paidSat.exam.questions.length, 'every question of the paper is in it');
  ok(paidSat.result.detail.every(d => d.timed === true), 'every question was measured, the unopened ones at zero');
  await h.db.run('DELETE FROM rate_limits');
  const reread = await h.request(`/v1/exams/${paidSat.exam.id}`, { jar: paid.jar });
  eq(reread.data.result.timeReport, report, 'and so does the result read back');
  const stored = JSON.parse((await h.db.get("SELECT response_json FROM idempotency_keys WHERE scope='exam-result' AND key=?", [paidSat.exam.id])).response_json);
  ok(stored.timeReport === undefined, 'the report is not stored: it is worked out as the result is read');

  const freeSat = await sit(free.jar, {});
  eq([freeSat.result.timeReport, freeSat.result.timeReportOffered], [undefined, true], 'free: no report on the marked result, only that one exists');
  ok(Array.isArray(freeSat.result.detail) && freeSat.result.detail.every(d => typeof d.ms === 'number'), 'the basic per-question detail stays on the free plan');
  await h.db.run('DELETE FROM rate_limits');
  const freeRead = await h.request(`/v1/exams/${freeSat.exam.id}`, { jar: free.jar });
  eq([freeRead.data.result.timeReport, freeRead.data.result.timeReportOffered], [undefined, true], 'nor on the result read back');

  // Upgrading later shows the report of a paper sat on the free plan.
  await h.db.run('DELETE FROM rate_limits');
  eq((await h.request('/v1/entitlements/admin/grant', { method: 'POST', jar: admin.jar, body: { accountId: free.account.id, durationMs: 30 * 86400000 } })).status, 200, 'the free account upgrades');
  await h.db.run('DELETE FROM rate_limits');
  ok((await h.request(`/v1/exams/${freeSat.exam.id}`, { jar: free.jar })).data.result.timeReport?.totalMs === 5 * 90000, 'and now reads where the time went on that earlier paper');

  const untimed = await sit(paid.jar, null);
  eq([untimed.result.timeReport, untimed.result.timeReportOffered, untimed.result.detail.every(d => d.timed === false)], [undefined, undefined, true], 'a paper with no measured times reports none, even on Premium, and its result is returned as stored');
} finally {
  await h.close();
  if (raw?.open) raw.close(); else if (!raw) await store.close();
  if (pg) await pg.scratchDb.drop();
  rmSync(scratch, { recursive: true, force: true });
  for (const key of keys) {
    if (before[key] === undefined) delete process.env[key]; else process.env[key] = before[key];
  }
}
console.log(`engine: ${engine}`);
console.log(`EXAM TIME: PASS — ${count}/${count} checks on a real Pri ${engine} server — measured per question, described per section, Premium-gated on read.`);
