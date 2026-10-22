// Pri Learning · board mock papers over real HTTP (server/platform/exams.js).
//
// Drives the production middleware chain on SQLite (and, with
// --engine=postgres, on Postgres as the pri_server role). Nothing is stubbed.
//
// Covered: a mock is only a CBSE Class X Standard / Class XII blueprint paper
// and says so in its label and title; a free account gets ONE sample mock for
// the life of the account (finishing it does not bring it back) and the sample
// does not spend the free exam-simulation window; Premium (granted through the
// audited admin route) sits as many as it likes; strict validation of the
// flag; another account cannot read a mock; and the marked result carries the
// examiner's margin, which equals what the engine gives the same response
// (the oracle reads the sealed paper and marks with markerOps.js itself).
import './support/hermetic.mjs';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const keys = ['NODE_ENV', 'PRI_PLATFORM_DB', 'PRI_AUTH_DELIVERY_KEY', 'PRI_PUBLIC_ORIGIN', 'PRI_AUTH_EMAIL_PROVIDER'];
const before = Object.fromEntries(keys.map(key => [key, process.env[key]]));
const scratch = mkdtempSync(join(tmpdir(), 'pri-board-mock-'));
process.env.NODE_ENV = 'test';
process.env.PRI_PLATFORM_DB = join(scratch, 'unused.db');
process.env.PRI_AUTH_DELIVERY_KEY = '7c'.repeat(32);
delete process.env.PRI_PUBLIC_ORIGIN;

const { startApp, registerAccount, verifyEmail, promoteRole } = await import('./support/app-harness.mjs');
const { requestedEngine } = await import('./support/engine.mjs');
const { createPlatformDb } = await import('../platform/db.js');
const { ensureBillingSchema } = await import('../platform/billingSchema.js');
const { ensureAuthDeliverySchema } = await import('../platform/authDelivery.js');
const { asStore, createPostgresStore } = await import('../platform/store.js');
const { markResponse, stepMetaFor } = await import('../platform/markerOps.js');
const { loadAllBanks, loadBanksFor, generateQuestion } = await import('../../client/src/engine/generators/index.js');
const { composeIndiaPaper, paperSpecOf } = await import('../../client/src/engine/indiaExamComposer.js');
const { indiaExamPaperSpec } = await import('../../client/src/engine/indiaExams.js');
const { indiaScope } = await import('../../client/src/engine/indiaProduct.js');
const { indiaPyqCells, narrowCells } = await import('../../client/src/engine/indiaExamCells.js');
const { MOCK_LABEL, mockTitleOf } = await import('../../client/src/engine/boardMock.js');

const engine = requestedEngine();
let raw = null, pg = null, store;
if (engine === 'sqlite') {
  raw = createPlatformDb(join(scratch, 'mock.db'));
  ensureAuthDeliverySchema(raw);
  ensureBillingSchema(raw);
  store = asStore(raw);
} else {
  const { scratchDatabase, serverRoleUrl } = await import('./support/postgres.mjs');
  const scratchDb = await scratchDatabase('mocks');
  pg = { scratchDb };
  store = await createPostgresStore(await serverRoleUrl(scratchDb.name));
}
const h = await startApp({ db: store });

let count = 0;
const ok = (cond, name) => { assert.ok(cond, name); count++; };
const eq = (actual, expected, name) => { assert.deepEqual(actual, expected, name); count++; };

let keySeq = 0;
const idem = () => `mock-suite-${String(++keySeq).padStart(4, '0')}-${Date.now().toString(36)}`;
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
  const free = await registerAccount(h, { email: 'mock.free@example.test', deviceId: 'ipad-mock-free' });
  const paid = await registerAccount(h, { email: 'mock.paid@example.test', deviceId: 'ipad-mock-paid' });
  const other = await registerAccount(h, { email: 'mock.other@example.test', deviceId: 'ipad-mock-other' });
  const admin = await registerAccount(h, { email: 'mock.admin@example.test', deviceId: 'ipad-mock-admin' });
  for (const a of [free, paid, other, admin]) eq((await verifyEmail(h, a.account.id)).status, 200, 'verified');
  await promoteRole(h, admin.jar, admin.account.id, 'admin');
  await h.db.run('DELETE FROM rate_limits');
  eq((await h.request('/v1/entitlements/admin/grant', { method: 'POST', jar: admin.jar, body: { accountId: paid.account.id, durationMs: 30 * 86400000 } })).status, 200, 'Premium granted by an admin');

  // ── The flag is strict ─────────────────────────────────────────────────────
  const c10 = await spec(free.jar, 10);
  for (const [body, why] of [
    [{ ...c10, mock: 'yes' }, 'a non-boolean flag'], [{ ...c10, mock: false }, 'a false flag (a paper is a mock or omits it)'], [{ ...c10, mock: 1 }, 'a numeric flag'],
    [{ kind: 'practice-paper', paper: { year: 10, minutes: 30 }, slots: [], mock: true }, 'a practice paper']
  ]) {
    await h.db.run('DELETE FROM rate_limits');
    const r = await create(free.jar, body);
    eq([r.status, r.data?.error?.code], [400, 'EXAM_SPEC_INVALID'], `refused: ${why}`);
  }
  const basic = await spec(free.jar, 10, 'basic');
  await h.db.run('DELETE FROM rate_limits');
  eq((await create(free.jar, { ...basic, mock: true })).status, 400, 'no mock on the Class X Basic blueprint');
  const c11 = await spec(free.jar, 11);
  await h.db.run('DELETE FROM rate_limits');
  eq((await create(free.jar, { ...c11, mock: true })).status, 400, 'no mock on the Class XI school pattern (CBSE sets no board paper)');
  eq(await rows(free.account.id, 'exam-paper'), 0, 'nothing refused was sealed');

  // ── The free sample ────────────────────────────────────────────────────────
  await h.db.run('DELETE FROM rate_limits');
  const sample = await create(free.jar, { ...c10, mock: true });
  eq(sample.status, 201, 'a free account sits its sample mock');
  const exam = sample.data.exam;
  eq([exam.mock, exam.label, exam.title], [true, MOCK_LABEL, mockTitleOf({ track: 'cbse', grade: 10 })], 'labelled "Pri mock in board format"');
  ok(!/official/i.test(exam.title), 'never called official');
  eq([exam.questions.length, exam.total, exam.durationMin], [38, 80, 180], 'full length: 38 questions, 80 marks, 180 minutes');
  eq(await rows(free.account.id, 'exam-mock'), 1, 'the sample is on the mock ledger');
  ok((await sealed(exam.id)).mock === true, 'the sealed paper is a mock');

  const again = await create(free.jar, { ...(await spec(free.jar, 10)), mock: true });
  eq([again.status, again.data?.error?.code, again.data?.error?.capability], [402, 'PREMIUM_REQUIRED', 'premium-exams'], 'a second mock needs Premium');

  // The sample is not a simulation from the free window: the window's one paper is still there.
  await h.db.run('DELETE FROM rate_limits');
  const sim = await create(free.jar, await spec(free.jar, 10));
  eq(sim.status, 201, 'the sample mock did not spend the free 30-day simulation');
  ok(sim.data.exam.mock === undefined && sim.data.exam.title === indiaExamPaperSpec({ track: 'cbse', grade: 10, variant: 'standard' }).label, 'and that paper is not a mock');
  await h.db.run('DELETE FROM rate_limits');
  eq((await create(free.jar, await spec(free.jar, 10))).data?.error?.code, 'FREE_CAP_REACHED', 'the window itself still holds');

  // ── The margin on the result equals the engine's ───────────────────────────
  const paper = await sealed(exam.id);
  const answers = {}, workings = {}, times = {};
  const expected = new Map();
  for (const sq of paper.questions) {
    times[sq.id] = 30000 + sq.order * 1000;
    const q = sq.payload;
    if (q.multipart || q.alt || ['mcq', 'multi-mcq'].includes(q.answerType) || !stepMetaFor(q)) continue;
    const steps = (q.steps || []).map(s => String(s.d ?? '').replace(/\$|\\left|\\right/g, '').split('\n')[0]).filter(Boolean);
    if (!steps.length) continue;
    answers[sq.id] = '987654';
    workings[sq.id] = [...steps, 'x = 987654'].join('\n');
    expected.set(sq.id, markResponse(q, answers[sq.id], workings[sq.id], sq.marking));
  }
  ok(expected.size >= 1, `the paper holds written questions to work (${expected.size})`);
  await h.db.run('DELETE FROM rate_limits');
  const done = await finish(free.jar, exam.id, { answers, workings, times, ms: 60 * 60000, reason: 'student', submissionKey: 'mock-sub-0001' });
  eq(done.status, 200, `the mock is marked: ${done.text?.slice(0, 200)}`);
  const result = done.data.result ?? done.data;
  eq([result.mock, result.label], [true, MOCK_LABEL], 'the result is labelled a mock');
  let margins = 0;
  for (const [id, want] of expected) {
    const line = result.detail.find(d => d.id === id);
    // Per question, uncounted: how many a paper holds depends on the draw.
    assert.deepEqual([line.awarded, line.markingScheme], [want.awarded, want.markingScheme], 'the server marked it as the engine does');
    assert.deepEqual(line.script ?? null, want.script ?? null, 'and returned the engine\'s margin');
    if (line.script) {
      margins++;
      assert.ok(line.script.lines.reduce((n, l) => n + l.mark, 0) <= line.awarded, 'margin marks never exceed the marks');
    }
  }
  ok(margins >= 1, `margins returned: ${margins}`);
  eq(result.detail.filter(d => d.section === 'B').reduce((n, d) => n + d.ms, 0), paper.questions.filter(q => q.section === 'B').reduce((n, q) => n + times[q.id], 0), 'time per question is recorded for the section clock');

  const event = await h.db.get("SELECT payload_json FROM learning_events WHERE account_id=? AND kind='exam-result' AND entity_id=?", [free.account.id, exam.id]);
  ok(JSON.parse(event.payload_json).mock === true, 'the exam-result event says it was a mock');

  await h.db.run('DELETE FROM rate_limits');
  const afterFinish = await create(free.jar, { ...(await spec(free.jar, 12)), mock: true });
  eq(afterFinish.status, 402, 'finishing the sample does not bring it back');

  // ── Isolation ──────────────────────────────────────────────────────────────
  eq((await h.request(`/v1/exams/${exam.id}`, { jar: other.jar })).status, 404, 'another account cannot read the mock');
  eq((await h.request(`/v1/exams/${exam.id}`, { jar: {} })).status, 401, 'nor can a signed-out caller');

  // ── Premium ────────────────────────────────────────────────────────────────
  for (const grade of [10, 12, 10]) {
    await h.db.run('DELETE FROM rate_limits');
    const r = await create(paid.jar, { ...(await spec(paid.jar, grade)), mock: true });
    eq(r.status, 201, `Premium sits a Class ${grade} mock`);
    await finish(paid.jar, r.data.exam.id, {});
  }
  eq(await rows(paid.account.id, 'exam-mock'), 3, 'three mocks on the Premium ledger');
} finally {
  await h.close();
  if (raw?.open) raw.close(); else if (!raw) await store.close();
  if (pg) await pg.scratchDb.drop();
  rmSync(scratch, { recursive: true, force: true });
  for (const key of keys) {
    if (before[key] === undefined) delete process.env[key]; else process.env[key] = before[key];
  }
}
console.log(`BOARD MOCK AUTHORITY: PASS — ${count}/${count} checks on a real Pri ${engine} server.`);
