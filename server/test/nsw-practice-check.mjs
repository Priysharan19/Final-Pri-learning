// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Prithagoras issues and marks NSW practice (plan G3, ADR-0002)
//
// The server's edition decides which banks it issues, and nothing a client
// sends can change that. This suite boots the shipped /v1 app (SQLite, or
// Postgres with --engine=postgres) as each edition in turn and proves over
// real HTTP:
//
//   PRITHAGORAS (PRI_EDITION=prithagoras)
//   · an NSW bank mapped to a current syllabus is issued, prepared, bound,
//     repeated and twinned; an India bank, a `partial` bank, a cell with no dot
//     point, a cell the quality gate excluded and a request naming the India
//     course are refused, and a refusal escrows nothing;
//   · every issued question is sealed with its jurisdiction, syllabus id and
//     version and outcome code(s) (ADR-0002 decision 7), none of which the
//     device is sent, and its graded attempt records them;
//   · a question whose answer is its working is never issued;
//   · marking is the final answer only: with PRI_METHOD_MARKS=on — which pays
//     method marks on a Priyabhata test server — correct working behind a wrong
//     answer earns nothing, the reply carries no method evidence or method
//     row, and the solution states one criterion. (The control proves the same
//     working WOULD earn a method mark where the switch is honoured.)
//   · GET /v1/curriculum lists every current NSW outcome with honest
//     availability, and what it advertises can be issued;
//   · an India paper is refused, not served.
//
//   PRIYABHATA (PRI_EDITION unset) — unchanged
//   · India banks are issued with no sealed identity or marking limit; NSW
//     banks and the NSW course are refused exactly as before (D15);
//     /v1/curriculum serves nothing (404 to a signed-in account).
//
// SYNTHETIC: generated questions and a scripted client. Not evidence about
// real students, an examiner's certification or NESA approval.
// ─────────────────────────────────────────────────────────────────────────────
import './support/hermetic.mjs';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const keys = ['NODE_ENV', 'PRI_PLATFORM_DB', 'PRI_AUTH_DELIVERY_KEY', 'PRI_PUBLIC_ORIGIN', 'PRI_FREE_PRACTICE_PER_DAY', 'PRI_EDITION', 'PRI_METHOD_MARKS', 'PRI_METHOD_MARKS_EXAMINER_RESULT'];
const before = Object.fromEntries(keys.map(key => [key, process.env[key]]));
const scratch = mkdtempSync(join(tmpdir(), 'pri-nsw-practice-'));
process.env.NODE_ENV = 'test';
process.env.PRI_PLATFORM_DB = join(scratch, 'platform.db');
process.env.PRI_AUTH_DELIVERY_KEY = 'a7'.repeat(32);
process.env.PRI_FREE_PRACTICE_PER_DAY = '100000';
// The switch that pays method marks on a test server. Prithagoras must not honour it.
process.env.PRI_METHOD_MARKS = 'on';
process.env.PRI_EDITION = 'prithagoras';
delete process.env.PRI_METHOD_MARKS_EXAMINER_RESULT;
delete process.env.PRI_PUBLIC_ORIGIN;

const { startApp, checks, registerAccount, verifyEmail } = await import('./support/app-harness.mjs');
const { requestedEngine } = await import('./support/engine.mjs');
const { bankPolicy, FINAL_ANSWER_MARKING } = await import('../platform/editionBanks.js');
const { nswBank, nswCell, NSW_BANK_LEDGER, NSW_BANK_COUNT, NSW_CELL_COUNT, nswCurriculumResponse } = await import('../platform/nswBanks.js');
const { indiaBank } = await import('../platform/indiaBanks.js');
const { FINAL_ANSWER_ONLY } = await import('../platform/markingPolicy.js');
const { editionMarkingPolicy: markingPolicy, editionMethodMarksRefusal: methodMarksRefusal } = await import('../platform/editionMarking.js');
const { MARKER_OPS } = await import('../platform/markerOps.js');
const { NSW_OUTCOME_BY_CODE, NSW_CURRENT_SYLLABUSES, NSW_SYLLABUS_BY_ID, outcomesOf } = await import('../../client/src/engine/curriculum-nsw/index.js');
const { topicAvailability, practiceTargetAvailable } = await import('../../client/src/engine/curriculumAvailability.js');
const { EDITIONS } = await import('../../client/edition.config.mjs');

const c = checks();
const keysOf = value => (!value || typeof value !== 'object' ? []
  : Array.isArray(value) ? value.flatMap(keysOf)
    : Object.entries(value).flatMap(([key, inner]) => [key, ...keysOf(inner)]));
const PRIVATE = ['answer', 'answerText', 'correctIndex', 'solution', 'steps', 'stepcheck', 'criteria', 'traps', 'optionTraps', 'seed',
  '_practiceMode', '_curriculum', '_marking', '_generator', 'curriculum', 'outcomes', 'syllabus', 'jurisdiction'];

// ── The policy, as data ─────────────────────────────────────────────────────
{
  const nsw = bankPolicy('prithagoras'), india = bankPolicy('priyabhata');
  c.deq([nsw.curriculum, india.curriculum], [EDITIONS.prithagoras.defaultCourse, EDITIONS.priyabhata.defaultCourse], 'each edition issues its own default course');
  c.eq(bankPolicy(), nsw, 'this process is a Prithagoras server (PRI_EDITION)');
  c.ok(nsw.issues('y7-integers') && !nsw.issues('c10-arithmetic-progressions') && india.issues('c10-arithmetic-progressions') && !india.issues('y7-integers'),
    'an NSW bank is Prithagoras\'s and an India bank Priyabhata\'s, never the other way');
  c.deq([india.admits, india.identityOf, india.marking], [null, null, null], 'Priyabhata admits, seals and limits nothing: its questions are unchanged');
  c.eq(nsw.marking, FINAL_ANSWER_MARKING, 'Prithagoras questions are limited to their final answer');
  assert.throws(() => bankPolicy('atlantis'), /No question banks/);
  c.ok(true, 'an unknown edition has no banks');
  const issued = NSW_BANK_LEDGER.filter(e => e.issued);
  c.eq(issued.length, NSW_BANK_COUNT, `the ledger issues ${NSW_BANK_COUNT} NSW generators`);
  c.ok(issued.every(e => e.status === 'mapped' && NSW_SYLLABUS_BY_ID[e.syllabus].status === 'current'), 'every issued generator is mapped to a current syllabus');
  c.ok(NSW_BANK_LEDGER.filter(e => e.status !== 'mapped').every(e => !e.issued && !nswBank(e.generator) && e.reason), 'a partial or retired generator is never issued, and says why');
  c.eq(NSW_BANK_LEDGER.reduce((n, e) => n + e.cells.filter(cell => cell.issued).length, 0), NSW_CELL_COUNT, `over ${NSW_CELL_COUNT} cells`);
  // The marking switch.
  c.eq(markingPolicy({ PRI_METHOD_MARKS: 'on', PRI_EDITION: 'prithagoras' }), FINAL_ANSWER_ONLY, 'method marks cannot be switched on for Prithagoras');
  c.eq(markingPolicy({ NODE_ENV: 'production', PRI_METHOD_MARKS: 'on', PRI_METHOD_MARKS_EXAMINER_RESULT: 'india-499-result', PRI_EDITION: 'prithagoras' }), FINAL_ANSWER_ONLY,
    'not even with an examiner result named: it certifies another jurisdiction\'s rubric');
  c.eq(methodMarksRefusal({ PRI_METHOD_MARKS: 'on', PRI_EDITION: 'prithagoras' })?.code, 'MARKER_POLICY_EDITION_UNCERTIFIED', 'and the refusal is named');
  c.eq(methodMarksRefusal({ PRI_EDITION: 'prithagoras' }), null, 'nothing configured needs no explanation');
  c.eq(markingPolicy({ PRI_METHOD_MARKS: 'on', PRI_EDITION: 'priyabhata' }).methodMarks, true, 'Priyabhata\'s switch is as it was');
  c.eq(markingPolicy({ PRI_METHOD_MARKS: 'on' }).methodMarks, true, 'and so is an unset edition\'s');
}

// ═══ PRITHAGORAS ════════════════════════════════════════════════════════════
const h = await startApp({ engine: requestedEngine() });
let advertisedIssued = 0;
try {
  const a = await registerAccount(h, { email: 'nsw.practice@example.test', deviceId: 'ipad-nsw-practice' });
  c.eq(a.status, 201, 'a student account exists');
  c.eq((await verifyEmail(h, a.account.id)).status, 200, 'and is verified');
  const b = await registerAccount(h, { email: 'nsw.practice.b@example.test', deviceId: 'ipad-nsw-practice-b' });
  c.eq((await verifyEmail(h, b.account.id)).status, 200, 'a second student is verified');
  c.eq((await h.request('/v1/health')).data?.edition, 'prithagoras', '/v1/health reports the Prithagoras edition');

  const issue = (body, jar = a.jar) => h.request('/v1/practice/issue', { method: 'POST', jar, body });
  const submit = (qid, submissionId, answer, steps, jar = a.jar) => h.request(`/v1/practice/${qid}/submit`, {
    method: 'POST', jar, headers: { 'Idempotency-Key': submissionId }, body: { submissionId, answer, mode: 'typed', ...(steps ? { steps } : {}) } });
  const escrowCount = async accountId => Number((await h.db.get("SELECT COUNT(*) AS n FROM idempotency_keys WHERE account_id=? AND scope='practice-question'", [accountId]))?.n || 0);
  const sealedOf = async (accountId, qid) => JSON.parse((await h.db.get("SELECT response_json FROM idempotency_keys WHERE account_id=? AND scope='practice-question' AND key=?", [accountId, qid])).response_json);
  const eventsOf = async qid => (await h.db.all("SELECT payload_json FROM learning_events WHERE account_id=? AND entity_id=? AND kind='graded-attempt'", [a.account.id, qid])).map(row => JSON.parse(row.payload_json));
  const validIdentity = (identity, generator) => {
    assert.equal(identity.jurisdiction, 'NSW');
    assert.equal(identity.authority, 'NESA');
    const entry = NSW_BANK_LEDGER.find(e => e.generator === generator);
    assert.equal(identity.labelledSyllabus, entry.syllabus);
    assert.ok(identity.outcomes.some(o => o.syllabus === identity.syllabus), 'the named syllabus owns one of the outcomes');
    assert.equal(identity.syllabusVersion, NSW_SYLLABUS_BY_ID[identity.syllabus].version);
    assert.ok(identity.outcomes.length >= 1);
    for (const o of identity.outcomes) {
      assert.equal(NSW_OUTCOME_BY_CODE[o.code]?.syllabus, o.syllabus, `${o.code} is a current outcome of ${o.syllabus}`);
      assert.equal(o.syllabusVersion, NSW_SYLLABUS_BY_ID[o.syllabus].version);
    }
    assert.ok(identity.dotpoints.every(id => id.startsWith(`${generator}.`)));
    return true;
  };

  // ── Refusals: nothing outside the edition, nothing unverified ─────────────
  const start = await escrowCount(a.account.id);
  for (const [label, body, status, code] of [
    ['an India bank', { generator: 'c10-arithmetic-progressions', difficulty: 2, curriculum: 'nsw' }, 422, 'PRACTICE_BANK_OUTSIDE_CURRICULUM'],
    ['an India previous-year bank', { generator: 'pyq-cbse-c10-real-numbers', difficulty: 2, curriculum: 'nsw' }, 422, 'PRACTICE_BANK_OUTSIDE_CURRICULUM'],
    ['a request naming the India course', { generator: 'y7-integers', difficulty: 1, curriculum: 'in' }, 400, 'PRACTICE_GENERATOR_INVALID'],
    ['an India bank under the India course', { generator: 'c10-arithmetic-progressions', difficulty: 2, curriculum: 'in' }, 400, 'PRACTICE_GENERATOR_INVALID'],
    ['a request naming no course', { generator: 'y7-integers', difficulty: 1 }, 400, 'PRACTICE_GENERATOR_INVALID'],
    ['a partial bank (pigeonhole is in no current syllabus)', { generator: 'me11-comb', difficulty: 1, curriculum: 'nsw' }, 422, 'PRACTICE_BANK_OUTSIDE_CURRICULUM'],
    ['a partial bank', { generator: 'me12-calc', difficulty: 2, curriculum: 'nsw' }, 422, 'PRACTICE_BANK_OUTSIDE_CURRICULUM'],
    ['a cell whose form assesses no dot point', { generator: 'y8-equations', difficulty: 1, curriculum: 'nsw' }, 422, 'PRACTICE_CONTENT_UNSUPPORTED'],
    ['a cell the quality gate excluded', { generator: 'y9-simint', difficulty: 3, curriculum: 'nsw' }, 422, 'PRACTICE_CONTENT_UNSUPPORTED'],
    ['a cell whose every form is a proof', { generator: 'me12-induction', difficulty: 4, curriculum: 'nsw' }, 422, 'PRACTICE_CONTENT_UNSUPPORTED'],
    ['an unknown generator', { generator: 'y7-nonexistent', difficulty: 1, curriculum: 'nsw' }, 422, 'PRACTICE_BANK_OUTSIDE_CURRICULUM']
  ]) {
    const r = await issue(body);
    c.deq([r.status, r.data?.error?.code], [status, code], `issue: ${label} is refused`);
    const { curriculum, ...rest } = body;
    const p = await h.request('/v1/practice/prepare', { method: 'POST', body: curriculum === undefined ? rest : body });
    c.deq([p.status, p.data?.error?.code], [status, code], `prepare: ${label} is refused`);
  }
  c.ok(!nswCell('y8-equations', 1) && !nswCell('y9-simint', 3) && nswCell('y9-simint', 1), 'the refused cells are the ledger\'s, and their bank\'s other cells are issued');
  c.match((await issue({ generator: 'c10-arithmetic-progressions', difficulty: 2, curriculum: 'nsw' })).data.error.message, /NSW curriculum/, 'the refusal names the NSW curriculum');
  c.eq(await escrowCount(a.account.id), start, 'no refusal escrowed a question');

  // ── Issue: sealed identity, nothing leaked, right answer credited ─────────
  const SAMPLES = [
    { generator: 'y7-integers', difficulty: 1, seed: 11, syllabus: 'nsw-mathematics-k-10-2022', version: '2022', code: 'MA4-INT-C-01' },
    { generator: 'y12-series', difficulty: 2, seed: 5, syllabus: 'nsw-mathematics-advanced-11-12-2024', version: '2024', code: 'MAV-12-03' },
    { generator: 'ms12-nonright', difficulty: 1, seed: 3, syllabus: 'nsw-mathematics-standard-11-12-2024', version: '2024', code: 'MST-12-S2-04' },
    { generator: 'me12-vectors', difficulty: 2, seed: 9, syllabus: 'nsw-mathematics-extension1-11-12-2024', version: '2024', code: 'ME1-12-02' },
    { generator: 'mex-complex', difficulty: 1, seed: 4, syllabus: 'nsw-mathematics-extension2-11-12-2024', version: '2024', code: 'ME2-12-03' }
  ];
  for (const sample of SAMPLES) {
    const tag = `${sample.generator} D${sample.difficulty}`;
    const r = await issue({ generator: sample.generator, difficulty: sample.difficulty, seed: sample.seed, curriculum: 'nsw' });
    c.deq([r.status, r.data?.question?.subtopic], [201, sample.generator], `${tag}: issued`);
    const leaked = keysOf(r.data).filter(key => PRIVATE.includes(key));
    c.eq(leaked.join(','), '', `${tag}: the device is sent no answer, solution, identity or marking field`);
    const sealed = await sealedOf(a.account.id, r.data.question.id);
    c.ok(validIdentity(sealed._curriculum, sample.generator), `${tag}: the sealed question carries a valid curriculum identity`);
    c.deq([sealed._curriculum.syllabus, sealed._curriculum.syllabusVersion], [sample.syllabus, sample.version], `${tag}: syllabus ${sample.syllabus} version ${sample.version}`);
    c.ok(sealed._curriculum.outcomes.some(o => o.code === sample.code), `${tag}: outcome ${sample.code}`);
    c.eq(sealed._marking, FINAL_ANSWER_MARKING, `${tag}: sealed final-answer-only`);
    // The right answer, as the server holds it, is credited in full.
    const key = sealed.answerType === 'mcq' ? String(sealed.answer.correctIndex)
      : sealed.answerType === 'numeric' ? (sealed.answer.canonicalInput || String(sealed.answer.value))
        : sealed.answerType === 'expression' ? sealed.answer.expr
          : sealed.answerType === 'point' ? `(${sealed.answer.x}, ${sealed.answer.y})`
            : sealed.answerType === 'set' ? sealed.answer.values.join(', ') : `${sealed.answer.a}:${sealed.answer.b}`;
    const g = await submit(r.data.question.id, `nsw-right-${sample.generator}`, key);
    c.deq([g.status, g.data?.correct, g.data?.resolved, g.data?.marksEarned], [200, true, true, g.data?.marksPossible], `${tag}: the stored answer is marked correct for full marks`);
    c.deq(g.data.solution.criteria, [{ mark: g.data.marksPossible, text: 'Correct final answer' }], `${tag}: the solution states one criterion, the final answer`);
    c.ok(!g.data.markRows?.method && g.data.partial == null, `${tag}: and no method evidence`);
    const [event] = await eventsOf(r.data.question.id);
    c.deq(event.curriculum, sealed._curriculum, `${tag}: the graded attempt records the same identity`);
    c.eq(event.marksEarned, g.data.marksPossible, `${tag}: and the mark`);
  }

  // ── Final answer only, with the method-mark switch ON ─────────────────────
  {
    const r = await issue({ generator: 'y7-equations', difficulty: 2, seed: 1, curriculum: 'nsw' });
    c.deq([r.status, r.data.question.prompt], [201, 'Solve $2x + 1 = 11$.'], 'a two-mark equation is issued');
    c.ok(r.data.question.criteriaCount >= 2 && r.data.question.supportsSteps === true, 'it carries two marks and its working can be read');
    const sealed = await sealedOf(a.account.id, r.data.question.id);
    const working = ['2x + 1 = 11', '2x = 10'];
    // CONTROL: where the switch is honoured, this working behind this wrong answer earns a method mark.
    const control = MARKER_OPS.practice({ q: sealed, answer: '6', working: working.join('\n'), evidenceIfWrong: true, policy: { methodMarks: true, scheme: 'method-marks' } }, () => {});
    c.ok(control.result.correct === false && control.evidence.partial?.awarded >= 1, `control: the method rubric would pay ${control.evidence.partial?.awarded} mark for this working`);
    const first = await submit(r.data.question.id, 'nsw-final-only-1', '6', working);
    c.deq([first.status, first.data.correct, first.data.resolved, first.data.marksEarned], [200, false, false, 0], 'a first wrong try leaves the question open');
    const second = await submit(r.data.question.id, 'nsw-final-only-2', '6', working);
    c.deq([second.status, second.data.correct, second.data.resolved], [200, false, true], 'the second wrong try resolves it');
    c.eq(second.data.marksEarned, 0, 'and correct working behind a wrong answer earns NOTHING: final answer only');
    c.deq([second.data.partial, second.data.creditedMarks], [null, 0], 'no method evidence, no credited mark');
    c.ok(second.data.markRows && !('method' in second.data.markRows) && second.data.markRows.totals.earned === 0, 'the mark rows carry no method row');
    c.deq(second.data.solution.criteria, [{ mark: second.data.marksPossible, text: 'Correct final answer' }], 'one criterion: the final answer');
    c.ok(Array.isArray(second.data.stepReport?.lines), 'the working is still read and reported, as feedback');
    const [event] = await eventsOf(r.data.question.id);
    c.deq([event.marksEarned, event.correct, event.curriculum?.outcomes?.[0]?.code], [0, false, 'MA4-EQU-C-01'], 'the recorded attempt: no marks, and its outcome');
    // Working alone, no final answer, earns nothing either.
    const again = await issue({ generator: 'y7-equations', difficulty: 2, seed: 2, curriculum: 'nsw' });
    await submit(again.data.question.id, 'nsw-working-only-1', '', ['3x - 5 = 16', '3x = 21']);
    const only = await submit(again.data.question.id, 'nsw-working-only-2', '', ['3x - 5 = 16', '3x = 21']);
    c.deq([only.data.resolved, only.data.marksEarned, only.data.partial], [true, 0, null], 'working with no final answer earns nothing');
  }

  // ── A question answered by its working is never issued ────────────────────
  {
    let working = 0, total = 0;
    for (let i = 0; i < 30; i++) {
      const r = await issue({ generator: 'y8-equations', difficulty: 3, curriculum: 'nsw' });
      assert.equal(r.status, 201);
      total++;
      if (r.data.question.answerType === 'working') working++;
      const sealed = await sealedOf(a.account.id, r.data.question.id);
      assert.ok(validIdentity(sealed._curriculum, 'y8-equations'));
    }
    c.deq([working, total], [0, 30], 'y8-equations D3 has proof-style forms; none of 30 server-chosen issues is one');
    const seeded = [];
    for (let seed = 1; seed <= 40; seed++) seeded.push(await issue({ generator: 'y8-equations', difficulty: 3, seed, curriculum: 'nsw' }));
    const refused = seeded.filter(r => r.status === 422);
    c.ok(refused.length >= 1 && seeded.every(r => r.status === 422 || r.data.question.answerType !== 'working'), `and a seed that lands on one is refused (${refused.length} of 40), never served`);
  }

  // ── A dot point may be asked for; the identity follows the question ───────
  {
    const r = await issue({ generator: 'y8-linear', difficulty: 2, dotpoint: 'y8-linear.2', curriculum: 'nsw' });
    c.eq(r.status, 201, 'a dot point of an NSW bank can be asked for');
    const sealed = await sealedOf(a.account.id, r.data.question.id);
    c.deq([sealed._curriculum.dotpoints, sealed._curriculum.outcomes.map(o => o.code), sealed._curriculum.exact], [['y8-linear.2'], ['MA5-LIN-C-01'], true],
      'and the outcome is where the crosswalk located THAT dot point (Stage 5, though Pri labels the subtopic Year 8)');
    const shared = await issue({ generator: 'y8-circles', difficulty: 4, seed: 7, curriculum: 'nsw' });
    const s2 = await sealedOf(a.account.id, shared.data.question.id);
    c.ok(s2._curriculum.exact === false && s2._curriculum.dotpoints.length === 2 && s2._curriculum.outcomes.length === 2, 'a cell that spans two dot points names both outcomes and says it is not exact');
    // Content Pri labels Advanced that the 2024 syllabuses place in Extension 1 is filed where it sits.
    const poly = await issue({ generator: 'y11-polynomials', difficulty: 1, seed: 2, curriculum: 'nsw' });
    const s3 = await sealedOf(a.account.id, poly.data.question.id);
    c.deq([s3._curriculum.syllabus, s3._curriculum.labelledSyllabus, s3._curriculum.outcomes[0].code],
      ['nsw-mathematics-extension1-11-12-2024', 'nsw-mathematics-advanced-11-12-2024', 'ME1-11-02'], 'remainder-theorem items labelled Advanced are sealed as Extension 1 content');
    c.deq([(await issue({ generator: 'y10-compound', difficulty: 1, curriculum: 'nsw' })).data?.error?.code, (await issue({ generator: 'me11-poly', difficulty: 4, curriculum: 'nsw' })).data?.error?.code],
      ['PRACTICE_BANK_OUTSIDE_CURRICULUM', 'PRACTICE_CONTENT_UNSUPPORTED'], 'a bank the quality gate excluded whole, and a cell it excluded, are refused');
    // Asking a dot point whose only forms are not issued: y8-linear.3 lives at D3 (issued); y8-linear D4 has no dot point.
    c.deq([(await issue({ generator: 'y8-linear', difficulty: 4, curriculum: 'nsw' })).status], [422], 'y8-linear D4 assesses no dot point and is refused');
  }

  // ── Prepared, bound, repeated, twinned: the identity is always sealed ─────
  {
    const p = await h.request('/v1/practice/prepare', { method: 'POST', body: { generator: 'y9-trig', difficulty: 2, curriculum: 'nsw' } });
    c.eq(p.status, 200, 'a signed-out student is prepared an NSW question');
    c.eq(keysOf(p.data).filter(key => PRIVATE.includes(key)).join(','), '', 'which carries nothing private');
    const bound = await issue({ prepared: p.data.prepared, account: String(a.account.id) });
    c.eq(bound.status, 201, 'and one account binds it');
    const sealed = await sealedOf(a.account.id, bound.data.question.id);
    c.ok(validIdentity(sealed._curriculum, 'y9-trig') && sealed._marking === FINAL_ANSWER_MARKING, 'the bound question is sealed like any other');
    const reveal = await h.request(`/v1/practice/${bound.data.question.id}/reveal`, { method: 'POST', jar: a.jar, body: {} });
    c.deq([reveal.status, reveal.data.solution.criteria.length], [200, 1], 'revealing it shows one criterion');
    c.deq((await eventsOf(bound.data.question.id))[0].curriculum, sealed._curriculum, 'and the revealed attempt records the identity');
    const repeat = await h.request(`/v1/practice/${bound.data.question.id}/repeat`, { method: 'POST', jar: a.jar });
    c.deq([repeat.status, repeat.data.repeat], [201, true], 'the same question again is issued as a repeat');
    c.deq((await sealedOf(a.account.id, repeat.data.question.id))._curriculum, sealed._curriculum, 'carrying the same identity');
    // A twin of a wrong resolution.
    const wrong = await issue({ generator: 'y7-equations', difficulty: 2, seed: 3, curriculum: 'nsw' });
    await submit(wrong.data.question.id, 'nsw-twin-1', '99');
    const resolved = await submit(wrong.data.question.id, 'nsw-twin-2', '99');
    const twin = await h.request(`/v1/practice/notebook/${resolved.data.attemptId}/twin`, { method: 'POST', jar: a.jar });
    c.eq(twin.status, 201, 'a twin of a wrong NSW answer is issued');
    const twinSealed = await sealedOf(a.account.id, twin.data.question.id);
    c.ok(validIdentity(twinSealed._curriculum, 'y7-equations') && twinSealed._marking === FINAL_ANSWER_MARKING, 'and sealed');
    // Another account cannot touch any of it.
    c.eq((await submit(bound.data.question.id, 'nsw-foreign', '1', undefined, b.jar)).status, 404, 'another account cannot mark this account\'s NSW question');
  }

  // ── GET /v1/curriculum ────────────────────────────────────────────────────
  {
    c.eq((await h.request('/v1/curriculum')).status, 401, 'the curriculum needs a signed-in account');
    const r = await h.request('/v1/curriculum', { jar: a.jar });
    c.eq(r.status, 200, 'and is served to one');
    c.deq(r.data, JSON.parse(JSON.stringify(nswCurriculumResponse())), 'as the bank module builds it');
    c.deq([r.data.edition, r.data.course, r.data.jurisdiction, r.data.marking], ['prithagoras', 'nsw', 'NSW', 'final-answer-only'], 'for the Prithagoras edition, final answer only');
    c.deq(r.data.syllabuses.map(s => s.id), NSW_CURRENT_SYLLABUSES.map(s => s.id), 'every current NSW syllabus, and no superseded one');
    const listed = r.data.syllabuses.flatMap(s => s.subtopics.flatMap(t => t.dotpoints.map(dp => dp.code)));
    c.deq([...listed].sort(), NSW_CURRENT_SYLLABUSES.flatMap(outcomesOf).map(o => o.code).sort(), `every current outcome is listed once (${listed.length})`);
    const all = r.data.syllabuses.flatMap(s => s.subtopics.flatMap(t => t.dotpoints));
    c.ok(all.every(dp => typeof dp.generated === 'boolean' && dp.generated === dp.practice.length > 0), 'each with an explicit, honest generated flag');
    const missing = all.filter(dp => !dp.generated);
    c.ok(missing.length > 0 && r.data.outcomes.missing === missing.length && r.data.outcomes.total === all.length, `the gap is stated, not hidden: ${missing.length} of ${all.length} outcomes have no issued question`);
    for (const code of ['MA4-GEO-C-01', 'MAV-11-03', 'MST-12-S2-07', 'ME1-11-05']) c.eq(all.find(dp => dp.code === code)?.generated, false, `${code} has no generator and says so`);
    // An outcome reached only through a partial bank is not advertised.
    c.ok(all.filter(dp => dp.generated).every(dp => dp.practice.every(t => nswCell(t.generator, t.difficulties[0]) && t.difficulties.every(d => nswCell(t.generator, d)))), 'every advertised target is an issued cell');
    // The shape curriculumAvailability.js reads.
    const full = r.data.syllabuses[0].subtopics.find(t => t.dotpoints.every(dp => dp.generated));
    const empty = r.data.syllabuses.flatMap(s => s.subtopics).find(t => t.dotpoints.every(dp => !dp.generated));
    c.deq([topicAvailability(full).complete, topicAvailability(empty).selectable, practiceTargetAvailable(empty, 0), practiceTargetAvailable(full, 0)], [true, false, false, true],
      'curriculumAvailability reads it: a focus area with no issued question is not selectable');
    c.ok(!/outcome wording|students? (?:develop|select|appl)/i.test(JSON.stringify(r.data)) && all.every(dp => !('text' in dp)), 'it carries codes and Pri\'s focus-area names, no NESA wording');
    // What it advertises can be issued, and lands on the outcome it was advertised for.
    const sample = all.filter(dp => dp.generated).filter((_, i) => i % 3 === 0);
    for (const dp of sample) {
      const target = dp.practice[0];
      const got = await issue({ generator: target.generator, difficulty: target.difficulties[0], dotpoint: target.dotpoint, curriculum: 'nsw' }, b.jar);
      assert.equal(got.status, 201, `${dp.code}: ${target.generator} D${target.difficulties[0]} ${target.dotpoint} is issued`);
      const sealed = await sealedOf(b.account.id, got.data.question.id);
      assert.ok(sealed._curriculum.outcomes.some(o => o.code === dp.code), `${dp.code}: the issued question carries it`);
      advertisedIssued++;
    }
    c.ok(advertisedIssued >= 20, `${advertisedIssued} advertised outcomes were asked for and issued carrying their code`);
  }

  // ── No India paper on a Prithagoras server ────────────────────────────────
  {
    const paper = await h.request('/v1/exams', { method: 'POST', jar: a.jar, headers: { 'Idempotency-Key': 'nsw-no-practice-paper' },
      body: { kind: 'practice-paper', paper: { year: 7, minutes: 30 }, slots: [{ generator: 'y7-equations', difficulty: 1 }] } });
    c.deq([paper.status, paper.data?.error?.code], [422, 'EXAM_KIND_OUTSIDE_CURRICULUM'], 'the NSW-era practice paper stays refused (HSC-style papers are plan G4)');
    const indiaPaper = await h.request('/v1/exams', { method: 'POST', jar: a.jar, headers: { 'Idempotency-Key': 'nsw-no-india-paper' }, body: { kind: 'india' } });
    c.deq([indiaPaper.status, indiaPaper.data?.error?.code], [422, 'EXAM_KIND_OUTSIDE_CURRICULUM'], 'and an India paper is refused outright, before anything is composed');
    c.eq(Number((await h.db.get("SELECT COUNT(*) AS n FROM idempotency_keys WHERE account_id=? AND scope='exam-paper'", [a.account.id]))?.n || 0), 0, 'no paper was sealed');
  }
} finally {
  await h.close();
}

// ═══ PRIYABHATA — unchanged ═════════════════════════════════════════════════
delete process.env.PRI_EDITION;
const india = await startApp({ engine: requestedEngine() });
try {
  const a = await registerAccount(india, { email: 'india.control@example.test', deviceId: 'ipad-india-control' });
  c.eq((await verifyEmail(india, a.account.id)).status, 200, 'Priyabhata: a verified student');
  c.eq((await india.request('/v1/health')).data?.edition, 'priyabhata', 'Priyabhata: /v1/health reports the edition');
  const issue = body => india.request('/v1/practice/issue', { method: 'POST', jar: a.jar, body });
  const r = await issue({ generator: 'c10-arithmetic-progressions', difficulty: 2, seed: 7, curriculum: 'in' });
  c.eq(r.status, 201, 'Priyabhata: an India bank is issued');
  const sealed = JSON.parse((await india.db.get("SELECT response_json FROM idempotency_keys WHERE account_id=? AND scope='practice-question' AND key=?", [a.account.id, r.data.question.id])).response_json);
  c.ok(!('_curriculum' in sealed) && !('_marking' in sealed), 'Priyabhata: with no sealed identity or marking limit — the question is as it always was');
  for (const [label, body, status, code] of [
    ['an NSW bank', { generator: 'y7-integers', difficulty: 1, curriculum: 'in' }, 422, 'PRACTICE_BANK_OUTSIDE_CURRICULUM'],
    ['the NSW course', { generator: 'y7-integers', difficulty: 1, curriculum: 'nsw' }, 400, 'PRACTICE_GENERATOR_INVALID'],
    ['an India bank under the NSW course', { generator: 'c10-arithmetic-progressions', difficulty: 2, curriculum: 'nsw' }, 400, 'PRACTICE_GENERATOR_INVALID']
  ]) {
    const refused = await issue(body);
    c.deq([refused.status, refused.data?.error?.code], [status, code], `Priyabhata: ${label} is refused`);
  }
  c.match((await issue({ generator: 'y7-integers', difficulty: 1, curriculum: 'in' })).data.error.message, /India curriculum/, 'Priyabhata: in the same words as before');
  // The final-answer seal holds WHERE THE MARK COMMITS, not only in the
  // process-wide switch. This server honours PRI_METHOD_MARKS=on, so its
  // marker pays a method mark for the working below; a question sealed
  // final-answer-only is still committed with none. (The question is planted
  // in this account's escrow: no route here would issue it.)
  {
    const { createHash, randomUUID } = await import('node:crypto');
    const { generateQuestion, loadAllBanks } = await import('../../client/src/engine/generators/index.js');
    await loadAllBanks();
    const plant = async extra => {
      const payload = JSON.stringify({ ...generateQuestion('y7-equations', 2, 1), _practiceMode: 'practice', _generator: 'y7-equations', ...extra });
      const id = randomUUID();
      const now = Date.now();
      await india.db.transaction(() => india.db.run("INSERT INTO idempotency_keys(account_id,scope,key,response_json,request_digest,created_at,expires_at) VALUES (?,'practice-question',?,?,?,?,?)",
        [a.account.id, id, payload, createHash('sha256').update(payload).digest('hex'), now, now + 3600000]), { accountScope: a.account.id });
      return id;
    };
    const twice = async (qid, tag) => {
      const body = n => ({ submissionId: `${tag}-${n}`, answer: '6', mode: 'typed', steps: ['2x + 1 = 11', '2x = 10'] });
      await india.request(`/v1/practice/${qid}/submit`, { method: 'POST', jar: a.jar, headers: { 'Idempotency-Key': `${tag}-1` }, body: body(1) });
      return india.request(`/v1/practice/${qid}/submit`, { method: 'POST', jar: a.jar, headers: { 'Idempotency-Key': `${tag}-2` }, body: body(2) });
    };
    const paid = await twice(await plant({}), 'seal-control');
    c.ok(paid.status === 200 && paid.data.resolved === true && paid.data.marksEarned >= 1 && paid.data.partial?.awarded >= 1,
      `control: this server pays a method mark for the working (${paid.data.marksEarned}/${paid.data.marksPossible})`);
    const sealedReply = await twice(await plant({ _marking: FINAL_ANSWER_MARKING }), 'seal-held');
    c.deq([sealedReply.status, sealedReply.data.resolved, sealedReply.data.marksEarned, sealedReply.data.partial, 'method' in (sealedReply.data.markRows || {})], [200, true, 0, null, false],
      'the same working on a question sealed final-answer-only commits no method mark, even here');
    c.deq(sealedReply.data.solution.criteria, [{ mark: sealedReply.data.marksPossible, text: 'Correct final answer' }], 'and one criterion');
  }
  const indiaKind = await india.request('/v1/exams', { method: 'POST', jar: a.jar, headers: { 'Idempotency-Key': 'india-kind-control' }, body: { kind: 'india' } });
  c.ok(indiaKind.data?.error?.code !== 'EXAM_KIND_OUTSIDE_CURRICULUM', `Priyabhata: an India paper request is read as before (${indiaKind.status} ${indiaKind.data?.error?.code})`);
  c.eq((await india.request('/v1/curriculum')).status, 401, 'Priyabhata: /v1/curriculum sits behind the same session guard');
  const gone = await india.request('/v1/curriculum', { jar: a.jar });
  c.deq([gone.status, gone.data], [404, { error: { code: 'NOT_FOUND', message: 'Platform endpoint not found.' } }], 'Priyabhata: and serves nothing — its curriculum is built on the device');
} finally {
  await india.close();
}

rmSync(scratch, { recursive: true, force: true });
for (const key of keys) {
  if (before[key] === undefined) delete process.env[key];
  else process.env[key] = before[key];
}
console.log(`engine: ${h.engine}`);
console.log(`NSW PRACTICE (G3): PASS — ${c.count()}/${c.count()} checks — Prithagoras issues ${NSW_BANK_COUNT} mapped NSW generators (${NSW_CELL_COUNT} cells) and nothing else, seals jurisdiction, syllabus version and outcome on every question, marks the final answer only with the method-mark switch on, lists every current outcome honestly (${advertisedIssued} advertised outcomes issued); Priyabhata is unchanged. [SYNTHETIC]`);
