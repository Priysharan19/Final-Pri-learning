// Pri Learning · NSW HSC-style papers over real HTTP (plan mission G4).
//
// Drives server/platform/exams.js's `nsw` kind through the whole production
// middleware chain, on SQLite and (with --engine=postgres) on Postgres as the
// pri_server role. Nothing is stubbed and no mark is produced here: the right
// answer is computed in this file from the server's own sealed paper, read
// straight from its store, with the engine's checker.
//
// Covered:
//   · the switch: off (the default) → 404 for the list and the create; a
//     Priyabhata server refuses the kind as outside its curriculum;
//   · the list: every blueprint, released or not, with what it lacks, and no
//     question or answer in it; the release state is the engine's check on the
//     server's pool, and the pool is the edition's issued forms and nothing else;
//   · a blueprint that is not released is refused and seals nothing; a spec
//     carrying anything but the blueprint's id is refused;
//   · a released paper (the test blueprint, on G3's real pool): every question
//     is drawn from an issued NSW form on its slot's outcome, sealed with its
//     identity and final-answer-only marking, of a final-answer type; no
//     answer, step, criterion, plan or seed leaves before finalisation;
//   · reading time: the server's; a snapshot or a finish inside it is refused
//     and nothing is stored;
//   · marking: a right answer earns the slot's marks, a wrong one 0 even with
//     working and the method-mark switch on, a blank 0 and no attempt;
//   · deadline and grace exactly as the India papers: in grace marked on what
//     the finish carries; after it, closed by the server on its last snapshot;
//   · the result is an "Answer-checked practice paper": no band, grade, ATAR,
//     HSC mark or prediction at any depth; the exam-result event says so.
import './support/hermetic.mjs';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const keys = ['NODE_ENV', 'PRI_PLATFORM_DB', 'PRI_AUTH_DELIVERY_KEY', 'PRI_PUBLIC_ORIGIN', 'PRI_EDITION', 'PRI_METHOD_MARKS', 'PRI_METHOD_MARKS_EXAMINER_RESULT', 'PRI_NSW_EXAMS', 'PRI_NSW_EXAMS_TEST_BLUEPRINT'];
const before = Object.fromEntries(keys.map(key => [key, process.env[key]]));
const scratch = mkdtempSync(join(tmpdir(), 'pri-nsw-exam-'));
process.env.NODE_ENV = 'test';
process.env.PRI_PLATFORM_DB = join(scratch, 'platform.db');
process.env.PRI_AUTH_DELIVERY_KEY = 'b3'.repeat(32);
// The method-mark switch is ON: a Prithagoras paper must still pay the final
// answer only (editionMarking.js, and the NSW answer types below).
process.env.PRI_METHOD_MARKS = 'on';
process.env.PRI_EDITION = 'prithagoras';
delete process.env.PRI_METHOD_MARKS_EXAMINER_RESULT;
delete process.env.PRI_PUBLIC_ORIGIN;
delete process.env.PRI_NSW_EXAMS;
delete process.env.PRI_NSW_EXAMS_TEST_BLUEPRINT;

const { startApp, checks, registerAccount, verifyEmail } = await import('./support/app-harness.mjs');
const { requestedEngine } = await import('./support/engine.mjs');
const { FINISH_GRACE_MS } = await import('../platform/exams.js');
const { NSW_BANK_LEDGER, nswCell, nswQuestionIdentity } = await import('../platform/nswBanks.js');
const { indiaBank } = await import('../platform/indiaBanks.js');
const {
  NSW_EXAM_POOL, NSW_TEST_BLUEPRINT, nswExamCatalogue, useNswTestBlueprintForTests, formOutcomes
} = await import('../platform/nswExamPool.js');
const { NSW_EXAM_BLUEPRINTS, blueprintRelease, slotsOf, NSW_EXAM_LABEL } = await import('../../client/src/engine/nswExams.js');
const { checkAnswer } = await import('../../client/src/engine/checker.js');
const { loadAllBanks, generateQuestion } = await import('../../client/src/engine/generators/index.js');

const c = checks();
await loadAllBanks();

// The server reads the clock with Date.now(); the suite moves it.
const realNow = Date.now;
let skew = 0;
Date.now = () => realNow() + skew;

const PRIVATE = new Set(['answer', 'solution', 'solutionText', 'steps', 'traps', 'stepcheck', 'seed', 'hints', 'optionTraps',
  'correctIndex', 'correctIndices', 'criteria', 'canonicalWorking', 'expected', 'markScheme', 'builtFrom', 'repairOpportunities',
  'altSeed', 'recipe', '_curriculum', '_marking', '_generator', '_practiceMode', 'answerText']);
const leaks = (value, path = '') => {
  if (!value || typeof value !== 'object') return [];
  return Object.entries(value).flatMap(([k, v]) => [...(PRIVATE.has(k) ? [path + k] : []), ...leaks(v, path + k + '.')]);
};
// No band, grade, ATAR, HSC mark, prediction or state comparison anywhere.
const BANDISH = /^(band|bands|bandLabel|grade|grades|atar|hscMark|hscBand|predicted|prediction|predictedMark|predictedBand|stateMean|percentile|examBand)$/i;
const bandKeys = (value, path = '') => {
  if (!value || typeof value !== 'object') return [];
  return Object.entries(value).flatMap(([k, v]) => [...(BANDISH.test(k) ? [path + k] : []), ...bandKeys(v, path + k + '.')]);
};

const isCorrect = (q, text) => { try { return checkAnswer(q, text).correct === true; } catch { return false; } };
function rightAnswer(q) {
  const a = q.answer || {};
  const candidates = [];
  if (q.answerType === 'mcq') candidates.push(String(a.correctIndex));
  else if (q.answerType === 'numeric') {
    if (a.canonicalInput) candidates.push(String(a.canonicalInput));
    if (a.simplestFraction) candidates.push(`${a.simplestFraction.n}/${a.simplestFraction.d}`);
    if (a.value !== undefined) candidates.push(String(a.value));
  } else if (q.answerType === 'expression') candidates.push(String(a.expr));
  else if (q.answerType === 'set') candidates.push((a.values || []).join(', '));
  else if (q.answerType === 'point') candidates.push(`(${a.x}, ${a.y})`);
  return candidates.find(text => isCorrect(q, text)) ?? null;
}
function wrongAnswer(q) {
  const a = q.answer || {};
  if (q.answerType === 'mcq') return String((Number(a.correctIndex) + 1) % (q.mcqOptions?.length || 4));
  const text = q.answerType === 'numeric' && Number.isFinite(Number(a.value)) ? String(Number(a.value) + 7) : '987654';
  return isCorrect(q, text) ? null : text;
}

// ── The pool and the release check, as data ────────────────────────────────
{
  const issued = new Set(NSW_BANK_LEDGER.flatMap(e => e.cells.filter(cell => cell.issued).map(cell => `${e.generator}|${cell.difficulty}`)));
  c.ok(NSW_EXAM_POOL.length > 0 && NSW_EXAM_POOL.every(form => issued.has(`${form.generator}|${form.difficulty}`) && nswCell(form.generator, form.difficulty)),
    `the pool is ${NSW_EXAM_POOL.length} issued NSW forms and nothing else`);
  c.ok(NSW_EXAM_POOL.every(form => !indiaBank(form.generator)), 'no India bank is in the pool');
  c.eq(NSW_EXAM_POOL.length, issued.size, 'every issued form is in it (each names at least one current outcome)');
  // Each form's outcomes are exactly what every question it generates is sealed with.
  let sampled = 0;
  for (const form of NSW_EXAM_POOL) {
    for (let s = 1; s <= 6; s++) {
      const q = generateQuestion(form.generator, form.difficulty, s * 104729 + form.difficulty);
      const identity = nswQuestionIdentity(q, form.generator);
      if (!identity) continue;
      assert.deepEqual(identity.outcomes.map(o => o.code).sort(), [...form.outcomes].sort(), `${form.generator}|${form.difficulty} seals the outcomes the pool counts it on`);
      sampled++;
    }
  }
  c.ok(sampled > NSW_EXAM_POOL.length * 3, `the pool's outcomes are the sealed identity of ${sampled} sampled questions`);
  c.deq(formOutcomes('c10-arithmetic-progressions', 2), [], 'an India bank has no outcomes here');
}

const h = await startApp({ engine: requestedEngine() });
let released = [];
try {
  const accounts = [];
  for (let i = 0; i < 4; i++) {
    const a = await registerAccount(h, { email: `nsw.exam.${i}@example.test`, deviceId: `ipad-nsw-exam-${i}` });
    c.eq((await verifyEmail(h, a.account.id)).status, 200, `student ${i + 1} is verified`);
    accounts.push(a);
  }
  const [a, b, d, e] = accounts;
  let seq = 0;
  const idem = () => `nsw-exam-${String(++seq).padStart(4, '0')}-${realNow().toString(36)}`;
  const create = (jar, body) => h.request('/v1/exams', { method: 'POST', jar, body, headers: { 'Idempotency-Key': idem() } });
  const save = (jar, id, body) => h.request(`/v1/exams/${id}/answers`, { method: 'PUT', jar, body });
  const finish = (jar, id, body = {}) => h.request(`/v1/exams/${id}/finish`, { method: 'POST', jar, body });
  const read = (jar, id) => h.request(`/v1/exams/${id}`, { jar });
  const rows = async (accountId, scope) => Number((await h.db.get('SELECT COUNT(*) AS n FROM idempotency_keys WHERE account_id=? AND scope=?', [accountId, scope]))?.n || 0);
  const sealed = async id => JSON.parse((await h.db.get("SELECT response_json FROM idempotency_keys WHERE scope='exam-paper' AND key=?", [id])).response_json);
  const testPaper = { kind: 'nsw', blueprint: { id: NSW_TEST_BLUEPRINT.id } };

  // ── Switched off (the default) ────────────────────────────────────────────
  const offList = await h.request('/v1/exams/nsw', { jar: a.jar });
  c.deq([offList.status, offList.data?.error?.code], [404, 'EXAM_KIND_UNAVAILABLE'], 'off: the list is not there');
  const offCreate = await create(a.jar, { kind: 'nsw', blueprint: { id: NSW_EXAM_BLUEPRINTS[0].id } });
  c.deq([offCreate.status, offCreate.data?.error?.code], [404, 'EXAM_KIND_UNAVAILABLE'], 'off: an NSW paper cannot be started');
  c.eq(await rows(a.account.id, 'exam-paper'), 0, 'and nothing was sealed');
  c.eq((await h.request('/v1/exams/nsw')).status, 401, 'the list sits behind the session guard');

  process.env.PRI_NSW_EXAMS = 'on';

  // ── The list ──────────────────────────────────────────────────────────────
  const list = await h.request('/v1/exams/nsw', { jar: a.jar });
  c.eq(list.status, 200, 'on: the list answers');
  c.deq(list.data.papers.map(p => p.id), NSW_EXAM_BLUEPRINTS.map(bp => bp.id), 'it lists the five HSC-style blueprints (no test paper until a test asks)');
  c.deq(list.data, nswExamCatalogue(), 'it is the catalogue the engine computes on the pool');
  for (const paper of list.data.papers) {
    const release = blueprintRelease(NSW_EXAM_BLUEPRINTS.find(bp => bp.id === paper.id), NSW_EXAM_POOL);
    assert.equal(paper.released, release.released);
    assert.deepEqual([paper.missingOutcomes, paper.thinOutcomes], [release.missingOutcomes, release.thinOutcomes]);
    assert.ok(paper.source.url.startsWith('https://curriculum.nsw.edu.au/') && paper.source.authority === 'NESA');
    if (!paper.released) assert.ok(paper.missingOutcomes.length + paper.thinOutcomes.length > 0, `${paper.id} says what it lacks`);
  }
  c.ok(true, 'each paper\'s release, gaps and cited source are the engine\'s');
  c.deq([leaks(list.data), bandKeys(list.data)], [[], []], 'no question, answer or band is in the list');
  c.eq(list.data.label, NSW_EXAM_LABEL, `every paper is an "${NSW_EXAM_LABEL}"`);
  released = list.data.papers.filter(p => p.released).map(p => p.id);

  // ── Refusals ──────────────────────────────────────────────────────────────
  for (const paper of list.data.papers.filter(p => !p.released)) {
    const refused = await create(a.jar, { kind: 'nsw', blueprint: { id: paper.id } });
    assert.deepEqual([refused.status, refused.data?.error?.code], [409, 'EXAM_BLUEPRINT_NOT_RELEASED'], paper.id);
    assert.ok(refused.data.error.message.includes([...paper.missingOutcomes, ...paper.thinOutcomes][0]), 'the refusal names what is missing');
  }
  c.ok(true, `every unreleased blueprint is refused, naming what it lacks (${list.data.papers.filter(p => !p.released).length})`);
  for (const [label, body] of [
    ['an unknown blueprint', { kind: 'nsw', blueprint: { id: 'nsw-hsc-general-2027' } }, 409],
    ['the test blueprint before a test asks', testPaper, 409],
    ['a blueprint with another field', { kind: 'nsw', blueprint: { id: NSW_TEST_BLUEPRINT.id, track: 'cbse' } }, 400],
    ['slots from the device', { ...testPaper, slots: [] }, 400],
    ['a layout seed', { ...testPaper, layoutSeed: 7 }, 400],
    ['a practice-paper shape', { ...testPaper, paper: { year: 12 } }, 400],
    ['a board mock', { ...testPaper, mock: true }, 400],
    ['a targeted paper', { ...testPaper, mock: true, targeted: true }, 400],
    ['no blueprint', { kind: 'nsw' }, 400]
  ]) {
    const refused = await create(a.jar, body);
    assert.ok([400, 409].includes(refused.status) && ['EXAM_SPEC_INVALID', 'EXAM_BLUEPRINT_NOT_RELEASED'].includes(refused.data?.error?.code), `${label}: ${refused.status} ${refused.data?.error?.code}`);
  }
  c.ok(true, 'a spec carrying anything but a released blueprint\'s id is refused');
  c.eq(await rows(a.account.id, 'exam-paper'), 0, 'and no refused start sealed a paper');

  // ── A released paper: the test blueprint, on G3's real pool ───────────────
  useNswTestBlueprintForTests(true);
  const withTest = await h.request('/v1/exams/nsw', { jar: a.jar });
  const testEntry = withTest.data.papers.find(p => p.id === NSW_TEST_BLUEPRINT.id);
  c.deq([testEntry?.released, testEntry?.test], [true, true], 'with a test asking, the test paper is listed, released, and says it is a test');
  const started = await create(a.jar, testPaper);
  c.eq(started.status, 201, 'a released paper starts');
  const exam = started.data.exam;
  c.deq([exam.kind, exam.readingMin, exam.reading, exam.readingEndsAt - exam.startedAt, exam.deadline - exam.startedAt],
    ['nsw', 1, true, 60000, 11 * 60000], 'reading time leads, and the deadline is reading plus working time, on the server clock');
  c.deq([exam.nsw.label, exam.nsw.markingScope, exam.nsw.test, exam.title], [NSW_EXAM_LABEL, 'final-answer-only', true, `${NSW_TEST_BLUEPRINT.label} · ${NSW_EXAM_LABEL}`],
    'the paper says what it is and how it is marked; its title is the server\'s');
  c.deq(leaks(started.data), [], 'no answer, step, criterion, plan, seed or sealed identity leaves at the start');
  c.deq(bandKeys(started.data), [], 'and no band');
  const slots = slotsOf(NSW_TEST_BLUEPRINT);
  c.deq(exam.questions.map(q => [q.section, q.marks]), slots.map(s => [s.section, s.marks]), 'one question per slot, in order, at the slot\'s marks');
  c.eq(exam.total, NSW_TEST_BLUEPRINT.totalMarks, `${exam.total} marks`);
  const paper = await sealed(exam.id);
  paper.questions.forEach((sq, i) => {
    const q = sq.payload;
    assert.equal(sq.outcome, slots[i].outcome);
    assert.ok(nswCell(sq.generator, q.difficulty) && !indiaBank(sq.generator), `${sq.generator} is an issued NSW form`);
    assert.ok(q._curriculum.outcomes.some(o => o.code === slots[i].outcome), 'its sealed identity names the slot\'s outcome');
    assert.equal(q._marking, 'final-answer-only');
    assert.ok(['numeric', 'mcq', 'expression', 'point', 'set'].includes(q.answerType) && !q.boardScheme && !q.multipart, 'a final-answer type');
    assert.deepEqual(sq.marking, { correct: slots[i].marks, incorrect: 0, unanswered: 0, partialPerOption: null });
  });
  c.ok(true, 'every sealed question is an issued NSW form on its slot\'s outcome, with its identity and final-answer-only marking');

  // ── Reading time ──────────────────────────────────────────────────────────
  const q = paper.questions.map(sq => sq.payload);
  const ids = paper.questions.map(sq => sq.id);
  const early = await save(a.jar, exam.id, { answers: { [ids[0]]: rightAnswer(q[0]) }, rev: 1 });
  c.deq([early.status, early.data?.error?.code], [409, 'EXAM_READING_TIME'], 'reading time: an answer cannot be saved');
  c.eq(await rows(a.account.id, 'exam-answers'), 0, 'and nothing was stored');
  const earlyFinish = await finish(a.jar, exam.id, { answers: { [ids[0]]: rightAnswer(q[0]) } });
  c.deq([earlyFinish.status, earlyFinish.data?.error?.code], [409, 'EXAM_READING_TIME'], 'reading time: the paper cannot be finished');
  c.eq(await rows(a.account.id, 'exam-result'), 0, 'and no result was written');
  const readingView = await read(a.jar, exam.id);
  c.deq([readingView.data.state, readingView.data.exam.reading, leaks(readingView.data)], ['open', true, []], 'the paper can be read, with nothing private in it');

  // ── Working time ──────────────────────────────────────────────────────────
  skew += 61 * 1000;
  const right0 = rightAnswer(q[0]), wrong1 = wrongAnswer(q[1]), right2 = rightAnswer(q[2]);
  c.ok(right0 !== null && wrong1 !== null && right2 !== null, 'the oracle has a right and a wrong answer');
  const saved = await save(a.jar, exam.id, { answers: { [ids[0]]: right0, [ids[1]]: wrong1 }, workings: { [ids[1]]: 'some working\nthat looks right' }, rev: 1 });
  c.deq([saved.status, saved.data.saved], [200, true], 'working time: answers are saved');
  const openView = await read(a.jar, exam.id);
  c.deq([openView.data.exam.reading, leaks(openView.data)], [false, []], 'the open paper still holds nothing private');
  const done = await finish(a.jar, exam.id, {
    answers: { [ids[0]]: right0, [ids[1]]: wrong1, [ids[2]]: right2 },
    workings: { [ids[1]]: 'some working\nthat looks right', [ids[2]]: 'and some here' }, reason: 'student'
  });
  c.eq(done.status, 200, 'the paper is finished');
  const result = done.data;
  const marks = paper.questions.map(sq => sq.marking.correct);
  c.deq(result.detail.map(line => line.awarded), [marks[0], 0, marks[2], 0, 0], 'right earns the slot\'s marks; wrong earns 0 even with working and the method switch on; blank earns 0');
  c.eq(result.score, marks[0] + marks[2], `score ${result.score} of ${result.total}`);
  c.ok(result.detail.every(line => !line.partial && ['objective', 'final-answer'].includes(line.markingScheme)), 'no line carries a part mark or a method scheme');
  c.deq(result.detail.map(line => line.syllabusOutcome), slots.map(s => s.outcome), 'each line names its slot\'s syllabus outcome');
  c.deq([result.nsw.label, result.nsw.markingScope, result.nsw.markingNote.includes('final answer only')], [NSW_EXAM_LABEL, 'final-answer-only', true], 'the result is an answer-checked practice paper and says how it was marked');
  c.deq(bandKeys(result), [], 'the result has no band, grade, ATAR, HSC mark or prediction at any depth');
  const replay = await finish(a.jar, exam.id, { answers: {} });
  c.deq([replay.status, replay.data.score, replay.data.finishedAt], [200, result.score, result.finishedAt], 'a replayed finish returns the stored result unchanged');
  const attempts = (await h.db.all("SELECT payload_json FROM learning_events WHERE account_id=? AND kind='graded-attempt'", [a.account.id])).map(r => JSON.parse(r.payload_json));
  c.eq(attempts.length, 3, 'three answered questions are three attempts; the blanks are not evidence');
  const examEvent = JSON.parse((await h.db.get("SELECT payload_json FROM learning_events WHERE account_id=? AND kind='exam-result'", [a.account.id])).payload_json);
  c.deq([examEvent.kind, examEvent.nswExam?.label, examEvent.indiaExam, bandKeys(examEvent)], ['nsw', NSW_EXAM_LABEL, null, []], 'the exam-result event files it as an NSW paper, with no band');

  // ── Deadline and grace, as the India papers ───────────────────────────────
  const inGrace = (await create(b.jar, testPaper)).data.exam;
  skew += 61 * 1000;
  const gq = (await sealed(inGrace.id)).questions;
  skew += (inGrace.deadline - Date.now()) + 60 * 1000;
  const graceDone = await finish(b.jar, inGrace.id, { answers: { [gq[0].id]: rightAnswer(gq[0].payload) }, reason: 'deadline' });
  c.deq([graceDone.status, graceDone.data.late, graceDone.data.finalisedBy, graceDone.data.score], [200, false, 'deadline', gq[0].marking.correct],
    'the automatic submit a minute after the bell is marked on what it carries');

  const abandoned = (await create(d.jar, testPaper)).data.exam;
  skew += 61 * 1000;
  const aq = (await sealed(abandoned.id)).questions;
  c.eq((await save(d.jar, abandoned.id, { answers: { [aq[0].id]: rightAnswer(aq[0].payload) }, rev: 1 })).status, 200, 'an answer is saved in working time');
  skew += (abandoned.deadline - Date.now()) + FINISH_GRACE_MS + 1000;
  const tooLate = await save(d.jar, abandoned.id, { answers: { [aq[1].id]: rightAnswer(aq[1].payload) }, rev: 2 });
  c.deq([tooLate.status, tooLate.data?.error?.code], [409, 'EXAM_DEADLINE_PASSED'], 'after deadline + grace nothing more is saved');
  const closed = await read(d.jar, abandoned.id);
  c.deq([closed.data.state, closed.data.result.unattended, closed.data.result.late, closed.data.result.score, closed.data.result.nsw?.label],
    ['finished', true, true, aq[0].marking.correct, NSW_EXAM_LABEL], 'an abandoned paper is closed by the server on its last snapshot, as an answer-checked paper');

  // ── The free allowance is the exam allowance (no new plan logic) ──────────
  const second = await create(a.jar, testPaper);
  c.deq([second.status, second.data?.error?.code], [402, 'FREE_CAP_REACHED'], 'a free account\'s second paper in the window meets the same allowance as any paper');

  // ── Switched off again; then a Priyabhata server ──────────────────────────
  useNswTestBlueprintForTests(false);
  delete process.env.PRI_NSW_EXAMS;
  c.eq((await create(e.jar, testPaper)).status, 404, 'switched off, nothing starts');
  process.env.PRI_NSW_EXAMS = 'on';
  process.env.PRI_EDITION = 'priyabhata';
  const india = await create(e.jar, { kind: 'nsw', blueprint: { id: NSW_EXAM_BLUEPRINTS[0].id } });
  c.deq([india.status, india.data?.error?.code], [422, 'EXAM_KIND_OUTSIDE_CURRICULUM'], 'Priyabhata, switch on: an NSW paper is outside its curriculum');
  c.eq((await h.request('/v1/exams/nsw', { jar: e.jar })).status, 404, 'Priyabhata lists no NSW papers');
  c.eq(await rows(e.account.id, 'exam-paper'), 0, 'and nothing was sealed');
} finally {
  Date.now = realNow;
  await h.close();
}

rmSync(scratch, { recursive: true, force: true });
for (const key of keys) {
  if (before[key] === undefined) delete process.env[key];
  else process.env[key] = before[key];
}
console.log(`engine: ${h.engine}`);
console.log(`NSW EXAMS (G4): PASS — ${c.count()}/${c.count()} checks — ${NSW_EXAM_BLUEPRINTS.length} HSC-style blueprints listed, ${released.length} released on the ${NSW_EXAM_POOL.length}-form pool; a released paper is sealed from issued NSW forms on its slots' outcomes, refuses answers in reading time, marks final answers only, keeps the India deadline and grace, and reports no band. [SYNTHETIC]`);
