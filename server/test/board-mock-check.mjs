// Pri Learning · board mock papers over real HTTP (server/platform/exams.js).
//
// Owner default D22: board mock papers ship as TYPED timed papers. D19: a
// timed paper is the free plan's one in 30 days; Premium is unlimited.
// Drives the production middleware chain on SQLite (and, with
// --engine=postgres, on Postgres as the pri_server role). Nothing is stubbed.
//
// Covered: a mock is only a CBSE Class X Standard / Class XII blueprint paper
// and says so in its label and title, never "official"; it is the free plan's
// one timed paper for 30 days (a mock and an ordinary paper share the window);
// it is typed — a handwritten mode or an unread page is refused on save and on
// finish, and no page can ever be read on it — while an ordinary paper keeps
// its handwriting; the marked result and its event say it was a mock;
// Premium sits as many as it likes; another account cannot read one.
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
  const plain = await registerAccount(h, { email: 'mock.plain@example.test', deviceId: 'ipad-mock-plain' });
  const admin = await registerAccount(h, { email: 'mock.admin@example.test', deviceId: 'ipad-mock-admin' });
  for (const a of [free, paid, other, plain, admin]) eq((await verifyEmail(h, a.account.id)).status, 200, 'verified');
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

  // ── A free account's one timed paper ───────────────────────────────────────
  await h.db.run('DELETE FROM rate_limits');
  const sample = await create(free.jar, { ...c10, mock: true });
  eq(sample.status, 201, 'a free account sits a board mock');
  const exam = sample.data.exam;
  eq([exam.mock, exam.label, exam.typedOnly, exam.title], [true, MOCK_LABEL, true, mockTitleOf({ track: 'cbse', grade: 10 })], 'labelled "Pri mock in board format", typed');
  ok(!/official|board paper|CBSE paper/i.test(exam.title), 'never called official, a board paper or a CBSE paper');
  eq([exam.questions.length, exam.total, exam.durationMin], [38, 80, 180], 'full length: 38 questions, 80 marks, 180 minutes');
  ok((await sealed(exam.id)).mock === true, 'the sealed paper is a mock');

  await h.db.run('DELETE FROM rate_limits');
  const second = await create(free.jar, { ...(await spec(free.jar, 10)), mock: true });
  eq([second.status, second.data?.error?.code, second.data?.error?.capability], [402, 'FREE_CAP_REACHED', 'premium-exams'], 'D19: a second timed paper in 30 days needs Premium');
  await h.db.run('DELETE FROM rate_limits');
  const ordinary = await create(free.jar, await spec(free.jar, 10));
  eq([ordinary.status, ordinary.data?.error?.code], [402, 'FREE_CAP_REACHED'], 'and the mock was the window\'s paper: an ordinary paper is refused too');
  await h.db.run('DELETE FROM rate_limits');
  eq((await create(plain.jar, await spec(plain.jar, 12))).status, 201, 'another free account sits an ordinary paper');
  await h.db.run('DELETE FROM rate_limits');
  eq((await create(plain.jar, { ...(await spec(plain.jar, 12)), mock: true })).data?.error?.code, 'FREE_CAP_REACHED', 'which spends its window for a mock as well');

  // ── Typed: no handwriting on a mock ────────────────────────────────────────
  const paper = await sealed(exam.id);
  const written = paper.questions.find(q => !['mcq', 'multi-mcq'].includes(q.payload.answerType) && !q.payload.multipart);
  ok(!!written, 'the mock has a written question');
  const save = (jar, id, extra, rev) => h.request(`/v1/exams/${id}/answers`, { method: 'PUT', jar, body: { answers: { [written.id]: '12' }, rev, ...extra } });
  const page = 'a'.repeat(64);
  await h.db.run('DELETE FROM rate_limits');
  eq([(await save(free.jar, exam.id, { modes: { [written.id]: 'ink' } }, 1)).status, (await save(free.jar, exam.id, { ink: { [written.id]: page } }, 2)).status], [400, 400],
    'a handwritten mode or an unread page is refused on save');
  eq((await save(free.jar, exam.id, { modes: { [written.id]: 'type' } }, 3)).status, 200, 'a typed answer is saved');
  eq((await finish(free.jar, exam.id, { answers: { [written.id]: '12' }, modes: { [written.id]: 'ink' }, reason: 'student' })).status, 400, 'and on finish a handwritten mode is refused');
  eq((await finish(free.jar, exam.id, { answers: { [written.id]: '12' }, ink: { [written.id]: page }, reason: 'student' })).status, 400, 'as is a page left to read');
  const done = await finish(free.jar, exam.id, { answers: { [written.id]: '12' }, reason: 'student', submissionKey: `mock-typed-${exam.id.slice(0, 8)}` });
  eq(done.status, 200, 'typed, the mock is marked');
  const result = done.data.result ?? done.data;
  eq([result.mock, result.label, result.total, result.detail.length], [true, MOCK_LABEL, 80, 38], 'the result is labelled a mock and covers the whole paper');
  ok(!result.handwriting?.pages || !Object.keys(result.handwriting.pages).length, 'with no handwriting page to read');
  const read = await h.request(`/v1/exams/${exam.id}/handwriting`, { method: 'POST', jar: free.jar, body: { key: written.id, image: 'data:image/png;base64,' + Buffer.from('x'.repeat(200)).toString('base64') } });
  eq([read.status, read.data?.error?.code], [409, 'EXAM_HANDWRITING_NOT_PENDING'], 'and no page can be read on it');
  const event = await h.db.get("SELECT payload_json FROM learning_events WHERE account_id=? AND kind='exam-result' AND entity_id=?", [free.account.id, exam.id]);
  ok(JSON.parse(event.payload_json).mock === true, 'the exam-result event says it was a mock');

  // An ordinary paper keeps its handwriting (the typed rule is the mock's).
  await h.db.run('DELETE FROM rate_limits');
  const regular = await create(paid.jar, await spec(paid.jar, 10));
  eq(regular.status, 201, 'Premium sits an ordinary paper');
  const regularPaper = await sealed(regular.data.exam.id);
  const regularWritten = regularPaper.questions.find(q => !['mcq', 'multi-mcq'].includes(q.payload.answerType) && !q.payload.multipart);
  await h.db.run('DELETE FROM rate_limits');
  eq((await h.request(`/v1/exams/${regular.data.exam.id}/answers`, { method: 'PUT', jar: paid.jar, body: { answers: {}, modes: { [regularWritten.id]: 'ink' }, ink: { [regularWritten.id]: page }, rev: 1 } })).status, 200,
    'an ordinary paper still accepts a handwritten page');
  ok(regular.data.exam.mock === undefined && regular.data.exam.label === undefined, 'and is not labelled a mock');

  // ── Isolation ──────────────────────────────────────────────────────────────
  eq((await h.request(`/v1/exams/${exam.id}`, { jar: other.jar })).status, 404, 'another account cannot read the mock');
  eq((await h.request(`/v1/exams/${exam.id}`, { jar: {} })).status, 401, 'nor can a signed-out caller');

  // ── Premium ────────────────────────────────────────────────────────────────
  await finish(paid.jar, regular.data.exam.id, {});
  for (const grade of [10, 12, 12]) {
    await h.db.run('DELETE FROM rate_limits');
    const r = await create(paid.jar, { ...(await spec(paid.jar, grade)), mock: true });
    eq([r.status, r.data?.exam?.title], [201, mockTitleOf({ track: 'cbse', grade })], `Premium sits a Class ${grade} mock`);
    await finish(paid.jar, r.data.exam.id, {});
  }
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
console.log(`BOARD MOCK AUTHORITY: PASS — ${count}/${count} checks on a real Pri ${engine} server — typed, labelled, one timed paper in 30 days on the free plan, unlimited on Premium.`);
