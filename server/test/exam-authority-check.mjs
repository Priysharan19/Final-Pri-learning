// Pri Learning · server-authoritative examination papers.
//
// Drives server/platform/exams.js over real HTTP through the whole production
// middleware chain, on SQLite and (with --engine=postgres) on Postgres as the
// pri_server role. Nothing is stubbed and no mark is produced here.
//
// The oracle: the server never sends an answer before a paper is finalised, so
// "the right answer" and "the mark this response earns" are computed in this
// file from the server's own sealed paper, read straight from its store, with
// the engine's checker. What the route returns must equal that.
//
// Covered: who may start a paper; strict spec validation; no private field at
// any depth before finalisation; idempotent create; durable answer snapshots;
// correct / wrong / blank / partial-working marks; exactly-once finalisation
// under a concurrent double finish; identical replay; the deadline rule (in
// grace, late, answers added after the bell); account isolation on every
// route; learning events written once; and an app restart on the same
// database.
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const keys = ['NODE_ENV', 'PRI_PLATFORM_DB', 'PRI_AUTH_DELIVERY_KEY', 'PRI_PUBLIC_ORIGIN', 'PRI_AUTH_EMAIL_PROVIDER'];
const before = Object.fromEntries(keys.map(key => [key, process.env[key]]));
const scratch = mkdtempSync(join(tmpdir(), 'pri-exam-authority-'));
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
const { FINISH_GRACE_MS } = await import('../platform/exams.js');
const { checkAnswer, methodMarks } = await import('../../client/src/engine/checker.js');
const { stepMetaFor } = await import('../platform/practice.js');
const { loadAllBanks, loadBanksFor, generateQuestion } = await import('../../client/src/engine/generators/index.js');
const { composeIndiaPaper, paperSpecOf } = await import('../../client/src/engine/indiaExamComposer.js');
const { indiaExamPaperSpec } = await import('../../client/src/engine/indiaExams.js');
const { indiaScope } = await import('../../client/src/engine/indiaProduct.js');
const { indiaPyqCells } = await import('../../client/src/engine/indiaExamCells.js');
const { solveLinearPrompt } = await import('./support/linear-equation.mjs');

const engine = requestedEngine();

// ── One database that outlives the app, so the app can be restarted on it ────
let raw = null, pg = null, store = null;
const dbFile = join(scratch, 'exams.db');
async function openStore() {
  if (engine === 'sqlite') {
    raw = createPlatformDb(dbFile);
    ensureAuthDeliverySchema(raw);
    ensureBillingSchema(raw);
    store = asStore(raw);
  } else {
    if (!pg) {
      const { scratchDatabase, serverRoleUrl } = await import('./support/postgres.mjs');
      const scratchDb = await scratchDatabase('exams');
      pg = { scratchDb, url: await serverRoleUrl(scratchDb.name) };
    }
    store = await createPostgresStore(pg.url);
  }
  return store;
}
async function closeStore() {
  if (engine === 'sqlite') { if (raw?.open) raw.close(); } else await store.close();
}

let h = await startApp({ db: await openStore() });
async function restart() {
  await h.close();
  await closeStore();
  h = await startApp({ db: await openStore() });
}

// The server reads the clock with Date.now(); the suite moves it.
const realNow = Date.now;
let skew = 0;
Date.now = () => realNow() + skew;

let count = 0;
const ok = (cond, name) => { assert.ok(cond, name); count++; };
const eq = (actual, expected, name) => { assert.deepEqual(actual, expected, name); count++; };

const PRIVATE = new Set(['answer', 'solution', 'solutionText', 'steps', 'traps', 'stepcheck', 'seed', 'hints', 'optionTraps',
  'correctIndex', 'correctIndices', 'criteria', 'canonicalWorking', 'expected', 'markScheme', 'builtFrom', 'repairOpportunities', 'altSeed', 'recipe']);
const leaks = (value, path = '') => {
  if (!value || typeof value !== 'object') return [];
  return Object.entries(value).flatMap(([k, v]) => [...(PRIVATE.has(k) ? [path + k] : []), ...leaks(v, path + k + '.')]);
};

let keySeq = 0;
const idem = () => `exam-suite-${String(++keySeq).padStart(4, '0')}-${realNow().toString(36)}`;
const create = (jar, body, key = idem()) => h.request('/v1/exams', { method: 'POST', jar, body, headers: key ? { 'Idempotency-Key': key } : {} });
const save = (jar, id, body) => h.request(`/v1/exams/${id}/answers`, { method: 'PUT', jar, body });
const finish = (jar, id, body = {}) => h.request(`/v1/exams/${id}/finish`, { method: 'POST', jar, body });
const read = (jar, id) => h.request(`/v1/exams/${id}`, { jar });
const rows = async (accountId, scope) => Number((await h.db.get('SELECT COUNT(*) AS n FROM idempotency_keys WHERE account_id=? AND scope=?', [accountId, scope]))?.n || 0);
const events = async (accountId, kind) => h.db.all('SELECT id,device_id,entity_id,payload_json FROM learning_events WHERE account_id=? AND kind=? ORDER BY device_seq', [accountId, kind]);
/** The server's sealed paper — the oracle's only source. */
const sealed = async id => JSON.parse((await h.db.get("SELECT response_json FROM idempotency_keys WHERE scope='exam-paper' AND key=?", [id])).response_json);

// ── Specs, composed the way a device composes them ───────────────────────────
await loadAllBanks();
async function indiaSpec(track, grade, seed, variant = 'standard') {
  const spec = indiaExamPaperSpec({ track, grade, variant });
  const chapters = indiaScope(track, grade);
  const pyq = indiaPyqCells(track, chapters);
  await loadBanksFor([...new Set([...pyq.values()].flatMap(list => list.map(cell => cell.generator)))]);
  const inWindow = (cells, { min = 1, max = 4 } = {}) => {
    const inside = cells.filter(c => c.difficulty >= min && c.difficulty <= max);
    return inside.length ? inside : cells;
  };
  const paper = composeIndiaPaper(spec, { seed, draw: generateQuestion, chapters, pyqCellsFor: (chapter, range) => inWindow(pyq.get(chapter.id) || [], range) });
  return paperSpecOf(paper, { track, grade, variant });
}
const LINEAR = 'c8-linear-equations-both-sides';
const practiceSpec = (length = 10, minutes = 30) => ({
  kind: 'practice-paper', paper: { year: 8, minutes },
  slots: Array.from({ length }, () => ({ generator: LINEAR, difficulty: 2 }))
});

// ── The oracle ───────────────────────────────────────────────────────────────
const isCorrect = (q, given) => { try { return checkAnswer(q, given).correct === true; } catch { return false; } };
/** A response the checker accepts for this sealed question, or null. */
function rightAnswer(q) {
  const a = q.answer || {};
  const candidates = [];
  if (q.answerType === 'mcq') candidates.push(String(a.correctIndex));
  else if (q.answerType === 'multi-mcq') return (a.correctIndices || []).join(',');
  else if (q.answerType === 'numeric') {
    if (a.canonicalInput) candidates.push(String(a.canonicalInput));
    if (a.simplestFraction) candidates.push(`${a.simplestFraction.n}/${a.simplestFraction.d}`);
    if (a.value !== undefined) candidates.push(String(a.value));
  } else if (q.answerType === 'expression') candidates.push(String(a.expr));
  else if (q.answerType === 'set') candidates.push((a.values || []).join(', '));
  else if (q.answerType === 'point') candidates.push(`(${a.x}, ${a.y})`);
  else if (q.answerType === 'ratio') candidates.push(`${a.a}:${a.b}`);
  return candidates.find(text => isCorrect(q, text)) ?? null;
}
function wrongAnswer(q) {
  const a = q.answer || {};
  if (q.answerType === 'mcq') return String((Number(a.correctIndex) + 1) % (q.mcqOptions?.length || 4));
  if (q.answerType === 'multi-mcq') {
    const wrong = (q.mcqOptions || []).map((_, i) => i).find(i => !(a.correctIndices || []).includes(i));
    return wrong === undefined ? null : String(wrong);
  }
  const text = q.answerType === 'numeric' && Number.isFinite(Number(a.value)) ? String(Number(a.value) + 7) : '987654';
  return isCorrect(q, text) ? null : text;
}
/** What the marking grid awards this response, by the published rule. */
function expectedMark(q, given, grid, working) {
  if (given === undefined || String(given).trim() === '') return Number(grid.unanswered ?? 0);
  if (q.answerType === 'multi-mcq') {
    const chosen = new Set(String(given).split(',').map(Number));
    const key = new Set(q.answer.correctIndices);
    if ([...chosen].some(i => !key.has(i))) return Number(grid.incorrect ?? 0);
    return chosen.size === key.size ? Number(grid.correct) : Number(grid.partialPerOption ?? 0) * chosen.size;
  }
  if (isCorrect(q, given)) return Number(grid.correct);
  const objective = q.answerType === 'mcq' || Number(grid.incorrect || 0) < 0 || Number(grid.correct) <= 1;
  if (!objective && working && stepMetaFor(q)) {
    const method = methodMarks({ meta: stepMetaFor(q), working, marks: Number(grid.correct), prompt: q.prompt });
    if (method?.awarded > 0) return Math.min(Number(grid.correct) - 1, method.awarded);
  }
  return Number(grid.incorrect ?? 0);
}
/** Answer a sealed paper in a fixed rotation and say what it must score. */
function plan(paper, pattern = ['right', 'wrong', 'blank']) {
  const answers = {};
  const expected = {};
  let total = 0, score = 0, n = 0;
  const respond = (key, q, grid, slot) => {
    const want = pattern[n++ % pattern.length];
    const given = want === 'right' ? rightAnswer(q) : want === 'wrong' ? wrongAnswer(q) : null;
    if (given !== null) answers[key] = given;
    const mark = expectedMark(q, answers[key], grid);
    expected[slot] = (expected[slot] || 0) + mark;
    score += mark;
  };
  for (const sq of paper.questions) {
    const q = sq.payload;
    if (q.multipart) for (const part of q.parts) { respond(`${sq.id}::${part.key}`, part, { correct: part.marks, incorrect: 0, unanswered: 0 }, sq.id); total += part.marks; }
    else { respond(sq.id, q, sq.marking, sq.id); total += Number(sq.marking.correct); }
  }
  return { answers, expected, score, total };
}

try {
  // ── Accounts ───────────────────────────────────────────────────────────────
  const a = await registerAccount(h, { email: 'exam.a@example.test', deviceId: 'ipad-exam-a' });
  const b = await registerAccount(h, { email: 'exam.b@example.test', deviceId: 'ipad-exam-b' });
  const unverified = await registerAccount(h, { email: 'exam.unverified@example.test', deviceId: 'ipad-exam-u' });
  const teacher = await registerAccount(h, { email: 'exam.teacher@example.test', deviceId: 'ipad-exam-t' });
  eq([a.status, b.status, unverified.status, teacher.status], [201, 201, 201, 201], 'four real accounts exist');
  for (const account of [a, b, teacher]) eq((await verifyEmail(h, account.account.id)).status, 200, 'email verified');
  await promoteRole(h, teacher.jar, teacher.account.id, 'teacher');
  const childJar = {};
  const child = await h.request('/v1/account/register', { method: 'POST', jar: childJar, body: {
    name: 'Exam Child', email: 'exam.child@example.test', password: 'correct-horse-battery', deviceId: 'ipad-exam-c',
    isAdult: false, year: '9', guardianName: 'Exam Guardian', guardianEmail: 'exam.guardian@example.test' } });
  eq(child.status, 201, 'a child account with consent pending exists');
  eq((await verifyEmail(h, child.data.account.id)).status, 200, 'and its email is verified');

  const cbse = await indiaSpec('cbse', 10, 1001);
  const practice = practiceSpec();

  // ── Who may start a paper ──────────────────────────────────────────────────
  eq((await create({}, practice)).status, 401, 'a signed-out caller cannot start a paper');
  const unverifiedTry = await create(unverified.jar, practice);
  eq([unverifiedTry.status, unverifiedTry.data?.error?.code], [403, 'EMAIL_UNVERIFIED'], 'an unverified account cannot start a paper');
  eq((await create(teacher.jar, practice)).status, 403, 'a teacher account cannot start a student paper');
  const childTry = await create(childJar, practice);
  eq(childTry.status, 403, 'a child whose guardian has not consented cannot start a paper');
  ok(/GUARDIAN|CONSENT/.test(String(childTry.data?.error?.code)), `and is told it is the guardian gate (${childTry.data?.error?.code})`);
  for (const account of [unverified, teacher]) eq(await rows(account.account.id, 'exam-paper'), 0, 'a refused start seals nothing');
  eq(await rows(child.data.account.id, 'exam-paper'), 0, 'a consent-refused start seals nothing');

  // ── Strict spec validation ─────────────────────────────────────────────────
  const refused = async (body, name, key = idem()) => {
    const r = await create(a.jar, body, key);
    eq([r.status, r.data?.error?.code], [400, key ? 'EXAM_SPEC_INVALID' : 'IDEMPOTENCY_KEY_REQUIRED'], name);
  };
  await refused(practice, 'a start without an idempotency key is refused', null);
  await refused({ ...practice, kind: 'quiz' }, 'an unknown kind of paper is refused');
  await refused({ ...practice, answers: {} }, 'an unknown top-level field is refused');
  await refused({ ...practice, slots: practice.slots.slice(0, 9) }, 'a practice paper of nine questions is refused');
  await refused({ ...practice, slots: Array.from({ length: 200 }, () => practice.slots[0]) }, 'an oversized slot list is refused');
  await refused({ ...practice, slots: practice.slots.map((s, i) => (i ? s : { ...s, seed: 7 })) }, 'a caller-chosen seed is refused');
  await refused({ ...practice, slots: practice.slots.map((s, i) => (i ? s : { ...s, marks: 99 })) }, 'caller-chosen marks are refused');
  await refused({ ...practice, slots: practice.slots.map((s, i) => (i ? s : { ...s, difficulty: 9 })) }, 'a difficulty outside 1–4 is refused');
  await refused({ ...practice, slots: practice.slots.map((s, i) => (i ? s : { ...s, generator: '../../etc/passwd' })) }, 'a generator that is not an authored id is refused');
  await refused({ ...practice, paper: { ...practice.paper, minutes: 600 } }, 'a ten-hour practice paper is refused');
  await refused({ ...practice, title: 'x'.repeat(121) }, 'an overlong title is refused');
  await refused({ ...cbse, slots: cbse.slots.slice(1) }, 'a blueprint paper with a question missing is refused');
  await refused({ ...cbse, slots: [...cbse.slots.slice(1), cbse.slots[0]] }, 'slots out of the blueprint section order are refused');
  await refused({ ...cbse, blueprint: { ...cbse.blueprint, marks: 500 } }, 'a caller cannot attach marks to a blueprint');
  const foreignCell = JSON.parse(JSON.stringify(cbse));
  const single = foreignCell.slots.find(slot => slot.recipe.kind === 'single');
  single.recipe.cell.generator = 'c12-matrices-determinant';
  await refused(foreignCell, 'a cell from outside the track and class is refused');
  const seededCell = JSON.parse(JSON.stringify(cbse));
  seededCell.slots.find(slot => slot.recipe.kind === 'single').recipe.cell.seed = 12345;
  await refused(seededCell, 'a seed inside a recipe cell is refused');
  const wrongItem = JSON.parse(JSON.stringify(cbse));
  wrongItem.slots[0].recipe = wrongItem.slots.at(-1).recipe;
  await refused(wrongItem, 'an item the section does not set is refused');
  const notReleased = await create(a.jar, { kind: 'india', blueprint: { track: 'cbse', grade: 7, variant: 'standard' }, slots: [] });
  eq([notReleased.status, notReleased.data?.error?.code], [409, 'EXAM_BLUEPRINT_NOT_RELEASED'], 'a class with no released blueprint is refused');
  const unsupported = await create(a.jar, { ...practice, slots: practice.slots.map((s, i) => (i ? s : { ...s, generator: 'c8-no-such-generator-here' })) });
  eq([unsupported.status, unsupported.data?.error?.code], [422, 'EXAM_CONTENT_UNSUPPORTED'], 'a generator the banks do not hold is refused, not dropped');
  eq(await rows(a.account.id, 'exam-paper'), 0, 'no refused spec sealed a paper');

  // ── A CBSE Class 10 paper is issued by the server ──────────────────────────
  const firstKey = idem();
  const made = await create(a.jar, { ...cbse, title: 'CBSE Class 10 · Paper 1' }, firstKey);
  eq(made.status, 201, 'an eligible student starts a paper');
  const exam = made.data.exam;
  eq(leaks(made.data), [], 'the issued paper discloses no answer, step, trap, seed or criterion at any depth');
  ok(/^[0-9a-f-]{36}$/.test(exam.id), 'the exam id is the server\'s');
  eq(made.data.accountId, String(a.account.id), 'the reply names the owning account');
  eq([exam.questions.length, exam.total, exam.durationMin], [38, 80, 180], 'the paper is the published 38 questions, 80 marks, 180 minutes');
  eq(exam.deadline - exam.startedAt, 180 * 60000, 'the deadline is the start plus the duration, on the server clock');
  eq(exam.graceMs, FINISH_GRACE_MS, 'the paper states its submission grace');
  eq(exam.title, 'CBSE Class 10 · Paper 1', 'the title the device composed is kept');
  const bySection = {};
  for (const q of exam.questions) (bySection[q.section] ||= []).push(q.marks);
  eq(Object.fromEntries(Object.entries(bySection).map(([k, v]) => [k, [v.length, v[0]]])),
    { A: [20, 1], B: [5, 2], C: [6, 3], D: [4, 5], E: [3, 4] }, 'the marking grid is the blueprint\'s, not the caller\'s');
  ok(exam.questions.every(q => q.payload.prompt || (q.payload.stem && q.payload.parts?.length)), 'every question carries a prompt, or a stem with parts');
  ok(exam.questions.some(q => q.payload.multipart) && exam.questions.some(q => q.payload.alt), 'case studies and internal choice are issued');
  const paperA = await sealed(exam.id);
  eq(paperA.questions.map(q => q.id), exam.questions.map(q => q.id), 'the sealed paper is the one returned');
  ok(paperA.questions.every(q => q.payload.multipart || q.payload.answer), 'the sealed paper holds every answer key');
  ok(typeof paperA.paperVersion === 'string' && paperA.paperVersion === exam.paperVersion, 'the paper carries one immutable version');

  // Idempotent create.
  const again = await create(a.jar, { ...cbse, title: 'CBSE Class 10 · Paper 1' }, firstKey);
  eq([again.status, again.data.exam.id], [201, exam.id], 'a retried start returns the same paper');
  eq(again.data.exam.questions, exam.questions, 'with the same questions');
  eq([again.data.exam.startedAt, again.data.exam.deadline], [exam.startedAt, exam.deadline], 'and the same clock');
  const reused = await create(a.jar, practice, firstKey);
  eq([reused.status, reused.data?.error?.code], [409, 'IDEMPOTENCY_KEY_REUSED'], 'the same key cannot start a different paper');
  eq(await rows(a.account.id, 'exam-paper'), 1, 'one paper was sealed for three requests');
  const other = await create(a.jar, cbse);
  ok(other.status === 201 && other.data.exam.id !== exam.id, 'a new key starts a new paper');
  ok(JSON.stringify(other.data.exam.questions.map(q => q.payload.prompt || q.payload.stem)) !== JSON.stringify(exam.questions.map(q => q.payload.prompt || q.payload.stem)),
    'the server chooses the questions: the same spec is not the same paper twice');
  const prompts = exam.questions.filter(q => !q.payload.multipart).map(q => `${q.generator}|${q.payload.prompt}`);
  eq(new Set(prompts).size, prompts.length, 'no question repeats inside a paper');

  // ── Reading and checkpointing ──────────────────────────────────────────────
  const open = await read(a.jar, exam.id);
  eq([open.status, open.data.state, open.data.snapshot, open.data.expired], [200, 'open', null, false], 'the owner reads the open paper');
  eq(leaks(open.data), [], 'reading an open paper discloses nothing private');
  const first = exam.questions.find(q => !q.payload.multipart);
  const saved = await save(a.jar, exam.id, { answers: { [first.id]: '41' }, workings: {}, times: { [first.id]: 5000 }, modes: {}, cur: 0, rev: 2 });
  eq([saved.status, saved.data.saved, saved.data.rev], [200, true, 2], 'a snapshot is saved');
  ok(Number.isFinite(saved.data.savedAt) && saved.data.remainingMs > 0 && saved.data.deadline === exam.deadline, 'with the server\'s timestamp and clock');
  const stale = await save(a.jar, exam.id, { answers: { [first.id]: 'older' }, rev: 1 });
  eq([stale.status, stale.data.saved, stale.data.stale, stale.data.rev], [200, false, true, 2], 'a retried older snapshot never replaces a newer one');
  eq((await read(a.jar, exam.id)).data.snapshot.answers, { [first.id]: '41' }, 'the latest snapshot reads back');
  const badSave = async (body, name) => eq([(await save(a.jar, exam.id, body)).status], [400], name);
  await badSave({ answers: { 'not-a-question': '1' }, rev: 3 }, 'an answer for a question outside the paper is refused');
  await badSave({ answers: { [first.id]: 'x'.repeat(4001) }, rev: 3 }, 'an overlong answer is refused');
  await badSave({ answers: { [first.id]: '1' }, marks: { [first.id]: 5 }, rev: 3 }, 'a snapshot cannot carry marks');
  await badSave({ answers: { [first.id]: '1' } }, 'a snapshot without a revision is refused');
  eq((await read(a.jar, exam.id)).data.snapshot.rev, 2, 'refused snapshots change nothing');

  // ── Account isolation ──────────────────────────────────────────────────────
  const unknownId = '00000000-0000-4000-8000-000000000000';
  const foreignRead = await read(b.jar, exam.id);
  const unknownRead = await read(b.jar, unknownId);
  const malformedRead = await read(b.jar, 'not-an-id');
  eq([foreignRead.status, unknownRead.status, malformedRead.status], [404, 404, 404], 'another account\'s, an unknown and a malformed id all read 404');
  eq([foreignRead.data.error, unknownRead.data.error], [malformedRead.data.error, malformedRead.data.error], 'and are indistinguishable');
  const foreignSave = await save(b.jar, exam.id, { answers: { [first.id]: '9' }, rev: 9 });
  const foreignFinish = await finish(b.jar, exam.id, { answers: { [first.id]: '9' } });
  eq([foreignSave.status, foreignFinish.status], [404, 404], 'another account can neither checkpoint nor finish the paper');
  eq([foreignSave.data.error, foreignFinish.data.error], [malformedRead.data.error, malformedRead.data.error], 'with the same answer as an unknown id');
  eq([(await save(b.jar, 'not-an-id', { rev: 1 })).status, (await finish(b.jar, unknownId)).status], [404, 404], 'malformed and unknown ids are 404 on every route');
  eq([(await read({}, exam.id)).status, (await save({}, exam.id, { rev: 9 })).status, (await finish({}, exam.id)).status], [401, 401, 401], 'a signed-out caller reaches no paper');
  eq([await rows(b.account.id, 'exam-paper'), await rows(b.account.id, 'exam-answers'), await rows(b.account.id, 'exam-result')], [0, 0, 0], 'the other account wrote nothing');
  eq((await events(b.account.id, 'graded-attempt')).length + (await events(b.account.id, 'exam-attempt')).length, 0, 'and earned no learning events');
  eq([(await read(a.jar, exam.id)).data.state, (await read(a.jar, exam.id)).data.snapshot.answers[first.id]], ['open', '41'], 'the owner\'s paper is untouched and still open');
  eq(await rows(a.account.id, 'exam-result'), 0, 'and was not finalised by the stranger');

  // ── Finish: right, wrong and blank against the oracle ──────────────────────
  const sat = plan(paperA);
  ok(Object.values(sat.answers).length >= 20 && sat.score > 0 && sat.score < sat.total, `the plan mixes right, wrong and blank answers (${sat.score}/${sat.total})`);
  const done = await finish(a.jar, exam.id, { answers: sat.answers, ms: 45 * 60000, reason: 'student', submissionKey: 'sub-cbse-first-0001' });
  eq(done.status, 200, 'the paper is finalised');
  const result = done.data;
  eq([result.authoritative, result.late, result.finalisedBy, result.inputSource], [true, false, 'student', 'submission'], 'by the student, in time, on the answers the request carried');
  eq([result.score, result.total], [sat.score, 80], 'the total equals the oracle');
  eq(Object.fromEntries(result.detail.map(d => [d.id, d.awarded])), sat.expected, 'every question\'s mark equals the oracle');
  eq(result.pct, Math.round(1000 * sat.score / 80) / 10, 'the percentage is the score over the total');
  ok(result.detail.every(d => d.multipart ? d.parts.every(p => typeof p.answerText === 'string' && Array.isArray(p.steps)) : (d.solution && Array.isArray(d.solution.steps) && Array.isArray(d.solution.criteria))),
    'solutions are disclosed once the paper is finalised');
  eq(result.summary.sections.map(s => [s.id, s.questions, s.marks]), [['A', 20, 20], ['B', 5, 10], ['C', 6, 18], ['D', 4, 20], ['E', 3, 12]], 'the per-section analysis inputs are the blueprint\'s sections');
  eq(result.summary.sections.reduce((n, s) => n + s.awarded, 0), sat.score, 'and add up to the score');
  const blankOne = result.detail.find(d => !d.multipart && d.unanswered);
  ok(blankOne && blankOne.awarded === 0 && blankOne.attemptId === null, 'a blank question earns zero and records no attempt');

  // Replay and the finished paper.
  const replay = await finish(a.jar, exam.id, { answers: {}, reason: 'deadline' });
  eq([replay.status, replay.data], [200, result], 'a replayed finish returns the identical stored result');
  const afterFinish = await save(a.jar, exam.id, { answers: { [first.id]: '1' }, rev: 50 });
  eq([afterFinish.status, afterFinish.data?.error?.code], [409, 'EXAM_FINALISED'], 'a finished paper refuses further checkpoints');
  const readBack = await read(a.jar, exam.id);
  eq([readBack.data.state, readBack.data.result], ['finished', result], 'the stored result reads back unchanged');
  eq(leaks(readBack.data.exam), [], 'the paper beside it is still the public paper');

  // Learning events, once.
  const graded = await events(a.account.id, 'graded-attempt');
  const attempted = result.detail.flatMap(d => (d.multipart ? d.parts : [d])).filter(x => x.attemptId);
  eq(graded.length, attempted.length, 'one graded-attempt event per attempted question or part');
  eq(graded.map(e => e.id).sort(), attempted.map(x => x.attemptId).sort(), 'keyed by the attempt ids the result carries');
  ok(graded.every(e => { const p = JSON.parse(e.payload_json); return e.device_id === 'server-grader' && p.attemptId === e.id && p.questionId === e.entity_id && p.mode === 'exam' && p.examId === exam.id && typeof p.subtopic === 'string' && (p.correct === true || p.correct === false); }),
    'in the practice payload conventions, by the server grader, in exam mode');
  const examEvents = await events(a.account.id, 'exam-attempt');
  eq(examEvents.length, 1, 'one exam-level event');
  const examPayload = JSON.parse(examEvents[0].payload_json);
  eq([examEvents[0].device_id, examEvents[0].entity_id, examPayload.state, examPayload.examId, examPayload.score, examPayload.total, examPayload.serverMarked],
    ['server-grader', exam.id, 'finished', exam.id, sat.score, 80, true], 'written by the server grader with the certified score');

  // ── Exactly once under a concurrent double finish ──────────────────────────
  const twin = other.data.exam;
  const twinPlan = plan(await sealed(twin.id), ['wrong', 'right', 'right', 'blank']);
  const gradedBefore = (await events(a.account.id, 'graded-attempt')).length;
  const [one, two] = await Promise.all([
    finish(a.jar, twin.id, { answers: twinPlan.answers, reason: 'student' }),
    finish(a.jar, twin.id, { answers: twinPlan.answers, reason: 'student' })
  ]);
  eq([one.status, two.status], [200, 200], 'two simultaneous finishes both answer');
  eq(one.data, two.data, 'with one and the same result');
  eq(one.data.score, twinPlan.score, 'equal to the oracle');
  eq(await rows(a.account.id, 'exam-result'), 2, 'one result row per paper');
  eq((await events(a.account.id, 'exam-attempt')).length, 2, 'the exam-level event was written once');
  eq((await events(a.account.id, 'graded-attempt')).length - gradedBefore,
    one.data.detail.flatMap(d => (d.multipart ? d.parts : [d])).filter(x => x.attemptId).length, 'and each attempt once');

  // ── Partial marks from working ─────────────────────────────────────────────
  const linear = await create(a.jar, practice);
  eq(linear.status, 201, 'a practice paper is issued');
  eq(leaks(linear.data), [], 'and discloses nothing private');
  const lp = await sealed(linear.data.exam.id);
  eq([lp.questions.length, lp.kind, lp.durationMin], [10, 'practice-paper', 30], 'ten questions for thirty minutes');
  const answers = {}, workings = {}, want = {};
  let partials = 0;
  lp.questions.forEach((sq, i) => {
    const q = sq.payload;
    const marks = Number(sq.marking.correct);
    if (i % 3 === 0) { answers[sq.id] = rightAnswer(q); want[sq.id] = marks; return; }
    if (i % 3 === 1) { want[sq.id] = 0; return; }
    // Sound working that stops before a wrong final answer.
    const s = solveLinearPrompt(q.prompt);
    const a1 = s.left.coefficient - s.right.coefficient, c1 = s.right.constant - s.left.constant;
    workings[sq.id] = `${a1}${s.variable} = ${c1}`;
    answers[sq.id] = String(s.root + 3);
    want[sq.id] = expectedMark(q, answers[sq.id], sq.marking, workings[sq.id]);
    if (want[sq.id] > 0 && want[sq.id] < marks) partials++;
  });
  ok(partials >= 1, `at least one multi-mark question earns method marks short of full (${partials})`);
  const linearDone = await finish(a.jar, linear.data.exam.id, { answers, workings });
  eq(linearDone.status, 200, 'the practice paper is finalised');
  eq(Object.fromEntries(linearDone.data.detail.map(d => [d.id, d.awarded])), want, 'full, zero and method marks all equal the oracle');
  ok(linearDone.data.detail.filter(d => d.partial).every(d => d.awarded === d.partial.awarded && d.awarded > 0 && d.awarded < d.marks && d.markingScheme === 'step-marked'),
    'a partial mark is method credit, capped below full marks');
  ok(linearDone.data.detail.every(d => d.awarded >= 0 && d.awarded <= d.marks), 'no mark is outside its question\'s range');
  const restated = await create(a.jar, practice);
  const rp = await sealed(restated.data.exam.id);
  const multi = rp.questions.find(sq => Number(sq.marking.correct) >= 2);
  if (multi) {
    const copy = String(multi.payload.prompt).replace(/\$/g, '');
    const r = await finish(a.jar, restated.data.exam.id, { answers: { [multi.id]: '987654' }, workings: { [multi.id]: copy } });
    eq(r.data.detail.find(d => d.id === multi.id).awarded, 0, 'copying the question out as working earns nothing');
  } else { await finish(a.jar, restated.data.exam.id, {}); ok(true, 'no multi-mark question drawn this run'); }

  // ── JEE: negative marks, partial per option, previous-year items ───────────
  const jeeMain = await create(a.jar, await indiaSpec('jee-main', 12, 2002));
  eq(jeeMain.status, 201, 'a JEE Main mathematics section is issued');
  eq(leaks(jeeMain.data), [], 'and discloses nothing private');
  eq([jeeMain.data.exam.questions.length, jeeMain.data.exam.total], [25, 100], '25 questions, 100 marks');
  ok(jeeMain.data.exam.questions.every(q => q.marking.correct === 4 && q.marking.incorrect === -1), 'every question is +4/−1 by the server\'s grid');
  const jm = await sealed(jeeMain.data.exam.id);
  const pyqCount = jm.questions.filter(q => q.pyq).length;
  ok(jeeMain.data.exam.questions.filter(q => q.pyq).every(q => q.payload.pyq === true && q.payload.pyqSource), `previous-year items are issued with their source (${pyqCount} in this paper)`);
  const jmPlan = plan(jm, ['wrong', 'right', 'blank']);
  const jmDone = await finish(a.jar, jeeMain.data.exam.id, { answers: jmPlan.answers });
  eq([jmDone.data.score, jmDone.data.total], [jmPlan.score, 100], 'JEE Main marks equal the oracle');
  ok(jmDone.data.detail.some(d => d.awarded === -1) && jmDone.data.summary.negativeMarks > 0, 'a wrong answer costs a mark');
  eq(Object.fromEntries(jmDone.data.detail.map(d => [d.id, d.awarded])), jmPlan.expected, 'question by question');

  const jeeAdv = await create(a.jar, await indiaSpec('jee-advanced', 12, 3003));
  eq(jeeAdv.status, 201, 'a JEE Advanced paper is issued');
  eq(leaks(jeeAdv.data), [], 'and discloses nothing private');
  const ja = await sealed(jeeAdv.data.exam.id);
  const multis = ja.questions.filter(q => q.payload.answerType === 'multi-mcq');
  ok(multis.length > 0 && multis.every(q => q.marking.partialPerOption > 0), 'multiple-correct questions carry per-option partial marks');
  const jaAnswers = {}, jaWant = {};
  let partialMulti = 0;
  for (const sq of ja.questions) {
    const q = sq.payload;
    if (q.answerType === 'multi-mcq' && q.answer.correctIndices.length > 1 && !partialMulti) {
      jaAnswers[sq.id] = String(q.answer.correctIndices[0]);
      partialMulti = sq.marking.partialPerOption;
    } else if (q.answerType === 'multi-mcq') jaAnswers[sq.id] = wrongAnswer(q) ?? rightAnswer(q);
    else jaAnswers[sq.id] = rightAnswer(q) ?? '';
    jaWant[sq.id] = expectedMark(q, jaAnswers[sq.id], sq.marking);
  }
  const jaDone = await finish(a.jar, jeeAdv.data.exam.id, { answers: jaAnswers });
  eq(Object.fromEntries(jaDone.data.detail.map(d => [d.id, d.awarded])), jaWant, 'JEE Advanced marks equal the oracle');
  ok(!partialMulti || jaDone.data.detail.some(d => d.partial && d.awarded === partialMulti && d.markingScheme === 'objective-partial'), 'one correct option of several earns the per-option mark');

  // Internal choice: the OR question is the one marked.
  const choicePaper = (await create(a.jar, cbse)).data.exam;
  const cp = await sealed(choicePaper.id);
  const withChoice = cp.questions.find(sq => sq.payload.alt && rightAnswer(sq.payload.alt) !== null);
  if (withChoice) {
    const r = await finish(a.jar, choicePaper.id, { answers: { [`${withChoice.id}::or`]: rightAnswer(withChoice.payload.alt) } });
    const d = r.data.detail.find(x => x.id === withChoice.id);
    eq([d.choiceTaken, d.awarded, d.prompt], ['or', Number(withChoice.marking.correct), withChoice.payload.alt.prompt], 'the alternative question is marked when it is the one answered');
  } else { await finish(a.jar, choicePaper.id, {}); ok(true, 'no checkable alternative drawn this run'); }

  // ── The deadline ───────────────────────────────────────────────────────────
  const late = (await create(a.jar, practice)).data.exam;
  const latePaper = await sealed(late.id);
  const [q1, q2, q3] = latePaper.questions;
  const right = sq => rightAnswer(sq.payload);
  eq((await save(a.jar, late.id, { answers: { [q1.id]: right(q1) }, rev: 1 })).data.saved, true, 'before the bell a snapshot with one answer is saved');
  skew += 30 * 60000 + FINISH_GRACE_MS - 5000;
  eq((await save(a.jar, late.id, { answers: { [q1.id]: right(q1), [q2.id]: right(q2) }, rev: 2 })).data.saved, true, 'inside the grace a snapshot is still accepted');
  skew += 10000;
  const tooLate = await save(a.jar, late.id, { answers: { [q1.id]: right(q1), [q2.id]: right(q2), [q3.id]: right(q3) }, rev: 3 });
  eq([tooLate.status, tooLate.data?.error?.code], [409, 'EXAM_DEADLINE_PASSED'], 'after deadline + grace nothing more can be saved');
  const expired = await read(a.jar, late.id);
  eq([expired.data.state, expired.data.expired, expired.data.snapshot.rev], ['open', true, 2], 'the paper reads as expired, holding its last snapshot');
  const lateDone = await finish(a.jar, late.id, { answers: Object.fromEntries(latePaper.questions.map(sq => [sq.id, right(sq)])), reason: 'student' });
  eq([lateDone.status, lateDone.data.late, lateDone.data.finalisedBy, lateDone.data.inputSource], [200, true, 'deadline', 'server-snapshot-before-deadline'], 'a finish after the grace is flagged late');
  eq(lateDone.data.score, Number(q1.marking.correct) + Number(q2.marking.correct), 'and marks only the snapshot saved before it');
  eq(lateDone.data.detail.filter(d => !d.unanswered).map(d => d.id), [q1.id, q2.id], 'answers added after the bell are ignored');
  eq(lateDone.data.detail.find(d => d.id === q3.id).given, '', 'the late answer is not even recorded as given');
  ok(lateDone.data.snapshotSavedAt <= late.deadline + FINISH_GRACE_MS, 'the snapshot marked was saved before deadline + grace');

  const inGrace = (await create(a.jar, practice)).data.exam;
  const gracePaper = await sealed(inGrace.id);
  skew += 30 * 60000 + 60000;
  const graceDone = await finish(a.jar, inGrace.id, { answers: { [gracePaper.questions[0].id]: right(gracePaper.questions[0]) }, reason: 'deadline' });
  eq([graceDone.data.late, graceDone.data.finalisedBy, graceDone.data.score], [false, 'deadline', Number(gracePaper.questions[0].marking.correct)], 'the automatic submit at the bell, a minute late, is marked on what it carries');

  const silent = (await create(a.jar, practice)).data.exam;
  skew += 30 * 60000 + FINISH_GRACE_MS + 1000;
  const silentPaper = await sealed(silent.id);
  const silentDone = await finish(a.jar, silent.id, { answers: Object.fromEntries(silentPaper.questions.map(sq => [sq.id, right(sq)])) });
  eq([silentDone.data.late, silentDone.data.score, silentDone.data.detail.every(d => d.unanswered)], [true, 0, true], 'a late finish with nothing checkpointed marks nothing');

  // ── Restart on the same database ───────────────────────────────────────────
  const carried = (await create(a.jar, practice)).data.exam;
  const carriedPaper = await sealed(carried.id);
  await save(a.jar, carried.id, { answers: { [carriedPaper.questions[0].id]: right(carriedPaper.questions[0]) }, rev: 4 });
  await restart();
  const reopened = await read(a.jar, carried.id);
  eq([reopened.status, reopened.data.state, reopened.data.snapshot.rev], [200, 'open', 4], 'after a restart the open paper and its snapshot are still there');
  eq(reopened.data.exam.questions, carried.questions, 'the same questions');
  eq([reopened.data.exam.startedAt, reopened.data.exam.deadline], [carried.startedAt, carried.deadline], 'on the same clock');
  eq((await read(a.jar, exam.id)).data.result, result, 'and the finished result is unchanged');
  const carriedDone = await finish(a.jar, carried.id, {});
  eq([carriedDone.status, carriedDone.data.score, carriedDone.data.inputSource], [200, Number(carriedPaper.questions[0].marking.correct), 'submission'],
    'a finish that carries no answers falls back to the snapshot saved before the restart');
  eq((await finish(a.jar, carried.id, {})).data, carriedDone.data, 'and replays identically');
  eq((await read(b.jar, carried.id)).status, 404, 'isolation holds after the restart');
} finally {
  Date.now = realNow;
  await h.close();
  await closeStore();
  if (pg) await pg.scratchDb.drop();
  rmSync(scratch, { recursive: true, force: true });
  for (const key of keys) {
    if (before[key] === undefined) delete process.env[key]; else process.env[key] = before[key];
  }
}
console.log(`EXAM AUTHORITY: PASS — ${count}/${count} checks — a paper is issued, collected, marked once and read back by its owner only, on a real Pri ${engine} server.`);
console.log('engine: ' + engine);
