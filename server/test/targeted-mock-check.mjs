// Pri Learning · targeted board mocks (premium-intelligence plan F3) — the
// pure rule (engine/targetedMock.js), the composer's capped lean
// (engine/indiaExamComposer.js) and the server's Premium gate and key over
// real HTTP (server/platform/exams.js). Nothing is stubbed.
//
// Covered: targets come only from due dot points and unfixed mistakes, with
// their evidence; an untargeted paper composes exactly as before; a targeted
// paper keeps the blueprint (sections, marks, allotted chapters) and leans at
// most TARGETED_SHARE_CAP of its questions; GET /exams/targets and a targeted
// create are Premium (402 PREMIUM_REQUIRED, capability premium-exams) and seal
// nothing on the free plan; Premium gets a server-written key that names only
// targets from its own graded attempts; the result and its event are labelled
// targeted; the flag is strict.
import './support/hermetic.mjs';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pngDataUrl } from './support/test-image.mjs';

const keys = ['NODE_ENV', 'PRI_PLATFORM_DB', 'PRI_AUTH_DELIVERY_KEY', 'PRI_PUBLIC_ORIGIN', 'PRI_AUTH_EMAIL_PROVIDER'];
const before = Object.fromEntries(keys.map(key => [key, process.env[key]]));
const scratch = mkdtempSync(join(tmpdir(), 'pri-targeted-mock-'));
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
const { MOCK_LABEL } = await import('../../client/src/engine/boardMock.js');
const T = await import('../../client/src/engine/targetedMock.js');

const engine = requestedEngine();
let raw = null, pg = null, store;
if (engine === 'sqlite') {
  raw = createPlatformDb(join(scratch, 'targeted.db'));
  ensureAuthDeliverySchema(raw);
  ensureBillingSchema(raw);
  store = asStore(raw);
} else {
  const { scratchDatabase, serverRoleUrl } = await import('./support/postgres.mjs');
  const scratchDb = await scratchDatabase('targeted');
  pg = { scratchDb };
  store = await createPostgresStore(await serverRoleUrl(scratchDb.name));
}
const h = await startApp({ db: store });

let count = 0;
const ok = (cond, name) => { assert.ok(cond, name); count++; };
const eq = (actual, expected, name) => { assert.deepEqual(actual, expected, name); count++; };

let keySeq = 0;
const idem = () => `targeted-suite-${String(++keySeq).padStart(4, '0')}-${Date.now().toString(36)}`;
const create = (jar, body) => h.request('/v1/exams', { method: 'POST', jar, body, headers: { 'Idempotency-Key': idem() } });
const finish = (jar, id, body = {}) => h.request(`/v1/exams/${id}/finish`, { method: 'POST', jar, body });
const sealed = async id => JSON.parse((await h.db.get("SELECT response_json FROM idempotency_keys WHERE scope='exam-paper' AND key=?", [id])).response_json);
const rows = async (accountId, scope) => Number((await h.db.get('SELECT COUNT(*) AS n FROM idempotency_keys WHERE account_id=? AND scope=?', [accountId, scope]))?.n || 0);

await loadAllBanks();
async function spec(jar, grade, variant = 'standard', targets = null) {
  await h.db.run('DELETE FROM rate_limits');
  const set = await h.request('/v1/exams/layout', { method: 'POST', jar, body: { blueprint: { track: 'cbse', grade, variant } } });
  assert.equal(set.status, 200, `layout ${grade}: ${set.status} ${set.text}`);
  const blueprint = indiaExamPaperSpec({ track: 'cbse', grade, variant });
  const chapters = indiaScope('cbse', grade);
  const pyq = indiaPyqCells('cbse', chapters);
  await loadBanksFor([...new Set([...pyq.values()].flatMap(list => list.map(cell => cell.generator)))]);
  const paper = composeIndiaPaper(blueprint, { seed: set.data.layoutSeed, draw: generateQuestion, chapters, targets, pyqCellsFor: (chapter, range) => narrowCells(pyq.get(chapter.id) || [], range) });
  return { ...paperSpecOf(paper, { track: 'cbse', grade, variant }), composed: paper };
}


const strip = ({ composed, ...rest }) => rest;
try {
  // ── The pure rule ──────────────────────────────────────────────────────────
  const targets0 = T.targetsFrom({
    due: [{ subtopic: 'g-a', dotpoint: 'a1', recall: 0.5 }, { subtopic: 'g-a', dotpoint: 'a2', recall: 0.7 }, { subtopic: 'g-b', dotpoint: 'b1', recall: 0.8 }, { bad: true }],
    notebook: [{ subtopic: 'g-c', fixed: false }, { subtopic: 'g-c', fixed: false }, { subtopic: 'g-d', fixed: true }, { subtopic: 'g-a', fixed: false, dotpoint: 'a1' }]
  });
  eq(targets0.map(t => t.subtopic), ['g-a', 'g-b', 'g-c'], 'due subtopics first (lowest recall first), then open mistakes; a fixed mistake is no target');
  eq([targets0[0].dueDotpoints, targets0[0].openMistakes, targets0[0].reasons], [['a1', 'a2'], 1, ['due', 'mistakes']], 'each target carries all of its evidence');
  eq(T.targetsFrom({}), [], 'no marked work, no targets');
  eq([T.targetedCap(38), T.targetedCap(10), T.targetedCap(0)], [22, 6, 0], 'the cap is 60% of the questions, rounded down');
  const key0 = T.whyTheseQuestions([{ generator: 'g-a' }, { generator: 'x' }, { recipe: { cells: [{ generator: 'g-c' }] } }], targets0);
  eq([key0.targeted, key0.cap, key0.withinCap, key0.rows.map(r => r.targeted)], [2, 1, false, [true, false, true]], 'the key counts questions drawn from a target and holds them to the cap');
  ok(!/improve|guarantee|predict|accurate|AI-powered|topper/i.test(JSON.stringify(key0) + T.becauseOf(targets0[0]) + T.TARGETED_LABEL), 'its words are evidence, never a promise');

  // ── The composer ───────────────────────────────────────────────────────────
  const blueprint = indiaExamPaperSpec({ track: 'cbse', grade: 10, variant: 'standard' });
  const chapters = indiaScope('cbse', 10);
  await loadBanksFor([...new Set(chapters.flatMap(c => (c.covers || []).map(x => x.gen)))]);
  const compose = (seed, targets) => composeIndiaPaper(blueprint, { seed, draw: generateQuestion, chapters, targets });
  const plainA = compose(4242), plainB = compose(4242, []);
  eq(plainB.questions.map(q => [q.generator, q.seed]), plainA.questions.map(q => [q.generator, q.seed]), 'with no targets the paper is drawn exactly as before');
  ok(plainA.questions.every(q => q.targeted === undefined), 'and carries no targeted flag');
  const gens = [...new Set(chapters.flatMap(c => (c.covers || []).map(x => x.gen)))];
  const asTarget = g => ({ subtopic: g, dueDotpoints: ['x'], openMistakes: 0, reasons: ['due'] });
  // When every cell of every chapter is a target the cap cannot hold; the key
  // says so, and the device composes such a paper again without a lean.
  const all = gens.map(asTarget);
  ok(!T.whyTheseQuestions(compose(11, all).questions, all).withinCap, 'a paper whose every cell is a target is detected as over the cap');
  // One subtopic from each chapter that has another to fall back on.
  const many = chapters.map(c => [...new Set((c.covers || []).map(x => x.gen))]).filter(list => list.length > 1).map(list => asTarget(list[0]));
  for (const seed of [11, 4242, 90001]) {
    const p = compose(seed, many);
    const base = compose(seed);
    eq(p.questions.map(q => [q.section, q.allottedChapterId, q.marking.correct]), base.questions.map(q => [q.section, q.allottedChapterId, q.marking.correct]), `seed ${seed}: the blueprint, the allotted chapters and the marks are unchanged`);
    eq(p.totalMarks, base.totalMarks, `seed ${seed}: so is the total`);
    const steered = p.questions.filter(q => q.targeted).length;
    ok(steered > 0 && steered <= T.targetedCap(p.questions.length), `seed ${seed}: ${steered} questions lean toward a target, within the cap of ${T.targetedCap(p.questions.length)}`);
  }
  const one = [{ subtopic: plainA.questions[0].generator, dueDotpoints: ['x'], openMistakes: 0, reasons: ['due'] }];
  const leaned = compose(4242, one);
  ok(leaned.questions.filter(q => q.generator === one[0].subtopic).length >= plainA.questions.filter(q => q.generator === one[0].subtopic).length, 'a target subtopic is drawn at least as often as without it');

  // ── Over HTTP ──────────────────────────────────────────────────────────────
  const free = await registerAccount(h, { email: 'targeted.free@example.test', deviceId: 'ipad-targeted-free' });
  const paid = await registerAccount(h, { email: 'targeted.paid@example.test', deviceId: 'ipad-targeted-paid' });
  const admin = await registerAccount(h, { email: 'targeted.admin@example.test', deviceId: 'ipad-targeted-admin' });
  for (const a of [free, paid, admin]) eq((await verifyEmail(h, a.account.id)).status, 200, 'verified');
  await promoteRole(h, admin.jar, admin.account.id, 'admin');
  await h.db.run('DELETE FROM rate_limits');
  eq((await h.request('/v1/entitlements/admin/grant', { method: 'POST', jar: admin.jar, body: { accountId: paid.account.id, durationMs: 30 * 86400000 } })).status, 200, 'Premium granted by an admin');

  // Graded attempts the server holds for the Premium account: wrong answers on
  // two Class X subtopics.
  const weak = gens.slice(0, 2);
  let cursor = 9_000_000;
  for (const [i, subtopic] of [...weak, ...weak].entries()) {
    const at = Date.now() - (5 + i) * 86400000;
    const payload = { attemptId: `seed-${i}`, questionId: `q-${i}`, subtopic, dotpoint: null, correct: false, mode: 'practice', difficulty: 2, at };
    await h.db.run("INSERT INTO learning_events(server_cursor,id,account_id,device_id,device_seq,kind,entity_id,occurred_at,payload_json,created_at) VALUES (?,?,?, 'server-grader',?,'graded-attempt',?,?,?,?)",
      [++cursor, `seed-event-${i}`, paid.account.id, cursor, `seed-${i}`, at, JSON.stringify(payload), at]);
  }

  await h.db.run('DELETE FROM rate_limits');
  const freeTargets = await h.request('/v1/exams/targets', { jar: free.jar });
  eq([freeTargets.status, freeTargets.data?.error?.code, freeTargets.data?.error?.capability], [402, 'PREMIUM_REQUIRED', 'premium-exams'], 'the free plan is refused the targets');
  const freeSpec = await spec(free.jar, 10);
  await h.db.run('DELETE FROM rate_limits');
  const freeTry = await create(free.jar, { ...strip(freeSpec), mock: true, targeted: true });
  eq([freeTry.status, freeTry.data?.error?.code, freeTry.data?.error?.capability], [402, 'PREMIUM_REQUIRED', 'premium-exams'], 'and a targeted paper, even with its free paper unused');
  eq(await rows(free.account.id, 'exam-paper'), 0, 'nothing was sealed for it');
  ok(!/improve|guarantee|predict|accurate/i.test(freeTry.data.error.message), 'the refusal promises nothing');
  for (const [extra, why] of [[{ targeted: 'yes', mock: true }, 'a non-boolean flag'], [{ targeted: true }, 'targeted without the mock flag'], [{ targeted: false, mock: true }, 'a false flag']]) {
    await h.db.run('DELETE FROM rate_limits');
    const r = await create(paid.jar, { ...strip(await spec(paid.jar, 10)), ...extra });
    eq([r.status, r.data?.error?.code], [400, 'EXAM_SPEC_INVALID'], `refused: ${why}`);
  }

  await h.db.run('DELETE FROM rate_limits');
  const got = await h.request('/v1/exams/targets', { jar: paid.jar });
  eq(got.status, 200, 'Premium reads its targets');
  eq(got.data.targets.map(t => t.subtopic).sort(), [...weak].sort(), 'which are exactly the subtopics of its own unfixed mistakes');
  ok(got.data.targets.every(t => t.openMistakes === 2 && t.reasons.includes('mistakes')), 'each with its evidence');

  const tspec = await spec(paid.jar, 10, 'standard', got.data.targets);
  await h.db.run('DELETE FROM rate_limits');
  const made = await create(paid.jar, { ...strip(tspec), mock: true, targeted: true });
  eq(made.status, 201, `Premium starts a targeted paper (${made.status} ${made.text?.slice(0, 200)})`);
  const exam = made.data.exam;
  eq([exam.targeted, exam.targetedLabel, exam.mock, exam.questions.length, exam.total], [true, T.TARGETED_LABEL, true, 38, 80], 'labelled targeted, still the full board paper: 38 questions, 80 marks');
  ok(/targeted$/.test(exam.title) && !/official|CBSE paper/i.test(exam.title), 'its title says targeted, never official');
  const why = exam.why;
  ok(why && why.questions === 38 && why.withinCap && why.targeted <= T.targetedCap(38), `the server's key: ${why?.targeted} of 38 lean toward a target, within the cap`);
  ok(why.targeted > 0, 'and the lean happened');
  ok(why.rows.filter(r => r.targeted).every(r => weak.includes(r.subtopic) && r.open === 2), 'every targeted row names one of this account\'s own subtopics and its evidence');
  const sealedPaper = await sealed(exam.id);
  eq(sealedPaper.targeted.key.targeted, why.targeted, 'the key is sealed with the paper');

  const done = await finish(paid.jar, exam.id, { reason: 'student' });
  eq(done.status, 200, 'the targeted paper is marked');
  const result = done.data.result ?? done.data;
  eq([result.targeted, result.mock], [true, true], 'the result says it was targeted');
  const event = await h.db.get("SELECT payload_json FROM learning_events WHERE account_id=? AND kind='exam-result' AND entity_id=?", [paid.account.id, exam.id]);
  ok(JSON.parse(event.payload_json).targeted === true, 'so does its event, so no whole-syllabus estimate reads it as one');
  void MOCK_LABEL;
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
console.log(`TARGETED MOCK: PASS — ${count}/${count} checks on a real Pri ${engine} server — capped lean, blueprint kept, Premium-gated, server-written key.`);
