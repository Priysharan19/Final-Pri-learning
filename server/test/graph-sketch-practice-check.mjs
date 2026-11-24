// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · a graph-sketch question over the real /v1 practice routes
//
// Boots the shipped app as a Prithagoras server (SQLite, or Postgres with
// --engine=postgres) and takes a sketch question through issue, a wrong open
// try, a right answer, two wrong tries, a reveal and an unreadable answer. It
// proves what the unit suites cannot:
//
//   · the issued question tells the device WHICH features it asks for and
//     nothing else: no answer, key, function or feature value on the wire;
//   · an open (first, wrong) try is answered with the same fixed shape as for
//     any other question: no solution, no verdict on any feature;
//   · the reply that resolves the question carries the marker's verdict on
//     each feature and the function the graph is of, and the immutable reply
//     is stored and replayed byte for byte; the answer is sent and stored as
//     text, so no new column or table is involved;
//   · the graded attempt is recorded like any other (marks, curriculum).
//
// SYNTHETIC: generated questions and a scripted client. Not evidence about
// real students, an examiner's certification or NESA approval.
// ─────────────────────────────────────────────────────────────────────────────
import './support/hermetic.mjs';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const keys = ['NODE_ENV', 'PRI_OFFERING', 'PRI_PLATFORM_DB', 'PRI_AUTH_DELIVERY_KEY', 'PRI_PUBLIC_ORIGIN', 'PRI_FREE_PRACTICE_PER_DAY', 'PRI_EDITION', 'PRI_QBANK_DIR'];
const before = Object.fromEntries(keys.map(key => [key, process.env[key]]));
const scratch = mkdtempSync(join(tmpdir(), 'pri-graph-sketch-'));
process.env.NODE_ENV = 'test';
process.env.PRI_PLATFORM_DB = join(scratch, 'platform.db');
process.env.PRI_AUTH_DELIVERY_KEY = 'c5'.repeat(32);
process.env.PRI_FREE_PRACTICE_PER_DAY = '100000';
process.env.PRI_EDITION = 'prithagoras';
process.env.PRI_OFFERING = 'catalogue';
process.env.PRI_QBANK_DIR = 'off';   // this suite is about the generators' sketches; the author bank has no sketch and takes most of a cell's draws
delete process.env.PRI_PUBLIC_ORIGIN;

const { startApp, checks, registerAccount, verifyEmail } = await import('./support/app-harness.mjs');
const { requestedEngine } = await import('./support/engine.mjs');
const { PUBLIC_QUESTION_FIELDS } = await import('../../client/src/engine/publicQuestion.js');

const c = checks();
const h = await startApp({ engine: requestedEngine() });
let sketches = 0;
try {
  const a = await registerAccount(h, { email: 'graph.sketch@example.test', deviceId: 'ipad-graph-sketch' });
  c.eq(a.status, 201, 'a student account exists');
  c.eq((await verifyEmail(h, a.account.id)).status, 200, 'and is verified');
  const issue = body => h.request('/v1/practice/issue', { method: 'POST', jar: a.jar, body });
  const submit = (qid, submissionId, answer) => h.request(`/v1/practice/${qid}/submit`, {
    method: 'POST', jar: a.jar, headers: { 'Idempotency-Key': submissionId }, body: { submissionId, answer, mode: 'typed' } });
  const sealedOf = async qid => JSON.parse((await h.db.get("SELECT response_json FROM idempotency_keys WHERE account_id=? AND scope='practice-question' AND key=?", [a.account.id, qid])).response_json);
  const eventsOf = async qid => (await h.db.all("SELECT payload_json FROM learning_events WHERE account_id=? AND entity_id=? AND kind='graded-attempt'", [a.account.id, qid])).map(row => JSON.parse(row.payload_json));
  /** The next sketch question this cell issues, from a fixed run of seeds. */
  let seed = 1000;
  const sketch = async (generator, difficulty) => {
    for (let i = 0; i < 80; i++) {
      const r = await issue({ generator, difficulty, seed: (seed += 7), curriculum: 'nsw' });
      if (r.status === 201 && r.data.question.answerType === 'graph-sketch') { sketches++; return r.data.question; }
    }
    throw new Error(`no sketch question from ${generator} D${difficulty}`);
  };
  const PRIVATE = /"(?:answer|steps|graph|spec|scheme|key|text|solution|traps|seed|stepcheck)"\s*:/;

  for (const [generator, difficulty] of [['y11-quadfunc', 2], ['y12-appdiff', 3], ['y12-appdiff', 2]]) {
    const tag = `${generator} D${difficulty}`;
    const sid = tag.replace(/\W+/g, '-');
    // ── Issue ───────────────────────────────────────────────────────────────
    const question = await sketch(generator, difficulty);
    const sealed = await sealedOf(question.id);
    const wire = JSON.stringify(question);
    const allowed = new Set([...PUBLIC_QUESTION_FIELDS, 'id', 'supportsSteps', 'criteriaCount']);
    c.deq(Object.keys(question).filter(k => !allowed.has(k)), [], `${tag}: the issued question holds public fields only`);
    c.ok(Array.isArray(question.sketchAsk) && question.sketchAsk.length >= 2 && question.sketchAsk.every(k => ['xIntercepts', 'yIntercept', 'turning'].includes(k)), `${tag}: it says which features are asked for`);
    c.ok(!PRIVATE.test(wire) && !wire.includes(sealed.answer.text) && !wire.includes(sealed.answer.graph.spec.expression) && !wire.includes(JSON.stringify(sealed.answer.key)), `${tag}: no answer, key, function or feature value is on the wire`);
    c.ok(sealed.answerType === 'graph-sketch' && sealed.answer.graph?.spec?.expression && sealed._marking === 'final-answer-only', `${tag}: the sealed question holds the function and is sealed final-answer-only`);
    const right = JSON.stringify(sealed.answer.key);
    const wrongX = JSON.parse(right);
    if (wrongX.intercepts?.x?.length) wrongX.intercepts.x[0] += 1; else wrongX.intercepts.y += 1;
    const wrongText = JSON.stringify(wrongX);

    // ── An open try: wrong, and told nothing ────────────────────────────────
    const open = await submit(question.id, `${sid}-open`, wrongText);
    c.deq([open.status, open.data.correct, open.data.resolved, open.data.marksEarned, open.data.triesLeft], [200, false, false, 0, 1], `${tag}: a wrong first try leaves the question open`);
    const openWire = JSON.stringify(open.data);
    c.ok(!('solution' in open.data) && !('sketch' in open.data) && !/verdicts?|wentWrong|"correct":"|features|intercept|turning/i.test(openWire.replace('"correct":false', '')), `${tag}: the open try's reply carries no solution and no verdict on any feature`);
    c.ok(!openWire.includes(sealed.answer.text), `${tag}: nor the answer sentence`);

    // ── The right answer resolves it, with the marker's verdicts ────────────
    const done = await submit(question.id, `${sid}-right`, right);
    c.deq([done.status, done.data.correct, done.data.resolved, done.data.marksEarned], [200, true, true, done.data.marksPossible], `${tag}: the right feature set is marked right for full marks`);
    const sk = done.data.solution?.sketch;
    c.ok(sk?.spec?.expression === sealed.answer.graph.spec.expression && Array.isArray(sk.verdicts) && sk.verdicts.length === question.sketchAsk.length && sk.verdicts.every(v => v.verdict === 'ok'), `${tag}: the resolving reply carries the function and an ok verdict for every asked feature`);
    c.ok(done.data.solution.answerText === sealed.answer.text && !('answer' in done.data.solution), `${tag}: and the answer as a sentence`);
    const replay = await submit(question.id, `${sid}-right`, right);
    c.deq(replay.data, done.data, `${tag}: the same submission replays the stored reply exactly`);
    const [event] = await eventsOf(question.id);
    c.deq([event.correct, event.marksEarned, event.subtopic, event.curriculum?.jurisdiction], [true, done.data.marksPossible, generator, 'NSW'], `${tag}: the graded attempt is recorded like any other`);
    c.ok(!JSON.stringify(event).includes(right), `${tag}: and does not store the answer text`);
  }

  // ── Two wrong tries: resolved, nothing earned, the wrong feature named ────
  {
    const question = await sketch('y11-quadfunc', 2);
    const sealed = await sealedOf(question.id);
    const bad = JSON.parse(JSON.stringify(sealed.answer.key));
    bad.turning[0].kind = bad.turning[0].kind === 'max' ? 'min' : 'max';
    const text = JSON.stringify(bad);
    const first = await submit(question.id, 'two-wrong-1', text);
    c.deq([first.data.resolved, first.data.triesLeft], [false, 1], 'two wrong tries: the first is open');
    const second = await submit(question.id, 'two-wrong-2', text);
    c.deq([second.status, second.data.correct, second.data.resolved, second.data.marksEarned], [200, false, true, 0], 'the second wrong try resolves it with no marks');
    const by = Object.fromEntries(second.data.solution.sketch.verdicts.map(v => [v.feature, v]));
    c.ok(by.turning.verdict === 'wrong' && by.turning.detail === 'wrong-kind' && /minimum|maximum/.test(by.turning.correct) && by.xIntercepts.verdict === 'ok' && by.yIntercept.verdict === 'ok', 'the marker names the one feature that is wrong, and how, and credits the rest');
    c.ok(second.data.solution.answerText.length > 8, 'the solution states the right features');
  }

  // ── A reveal carries the function and no verdict ────────────────────────
  {
    const question = await sketch('y12-appdiff', 3);
    const r = await h.request(`/v1/practice/${question.id}/reveal`, { method: 'POST', jar: a.jar, body: {} });
    c.deq([r.status, r.data.revealed, r.data.correct, r.data.marksEarned], [200, true, false, 0], 'a reveal resolves with no marks');
    c.ok(r.data.solution.sketch?.spec?.expression && !('verdicts' in r.data.solution.sketch), 'and carries the function the graph is of, with no verdict');
  }

  // ── An unreadable or oversized answer is not an attempt ─────────────────
  {
    const question = await sketch('y11-quadfunc', 2);
    for (const [label, answer] of [['text that is not a feature set', 'x = 1 and x = 5'], ['a feature set that is too long', JSON.stringify({ intercepts: { x: [1], y: 1 }, pad: 'x'.repeat(9000) })]]) {
      const r = await submit(question.id, `unreadable-${label.split(' ')[0]}-${answer.length}`, answer);
      c.deq([r.status, r.data.invalid, r.data.resolved, r.data.marksEarned, r.data.triesLeft], [200, true, false, 0, r.data.triesLeft], `${label}: invalid, nothing spent, nothing earned`);
      c.ok(r.data.triesLeft === 1 || r.data.triesLeft === 2, `${label}: and the question is still open`);
    }
    const sealed = await sealedOf(question.id);
    const fine = await submit(question.id, 'unreadable-then-right', JSON.stringify(sealed.answer.key));
    c.deq([fine.data.correct, fine.data.resolved], [true, true], 'the question can still be answered afterwards');
  }

  // ── Rush and Match answer in one line of their own: they are never dealt a sketch ──
  {
    let drawn = 0, sketchesDealt = 0;
    for (let i = 0; i < 40; i++) {
      for (const mode of ['rush', 'match']) {
        const r = await issue({ generator: 'y11-quadfunc', difficulty: 2, curriculum: 'nsw', mode });
        if (r.status === 201) { drawn++; if (r.data.question.answerType === 'graph-sketch') sketchesDealt++; }
      }
    }
    c.ok(drawn >= 60 && sketchesDealt === 0, `${drawn} questions dealt to Rush and Match, none a sketch`);
    let practiceSketches = 0;
    for (let i = 0; i < 60; i++) { const r = await issue({ generator: 'y11-quadfunc', difficulty: 2, curriculum: 'nsw', mode: 'practice' }); if (r.data?.question?.answerType === 'graph-sketch') practiceSketches++; }
    c.ok(practiceSketches > 0, `control: practice itself does deal sketches (${practiceSketches} of 60)`);
  }
} finally {
  await h.close();
}
rmSync(scratch, { recursive: true, force: true });
for (const key of keys) {
  if (before[key] === undefined) delete process.env[key];
  else process.env[key] = before[key];
}
console.log(`engine: ${h.engine}`);
console.log(`GRAPH SKETCH PRACTICE: PASS — ${c.count()}/${c.count()} checks — ${sketches} sketch questions issued, answered and resolved over the real practice routes; nothing about the features before resolution; no schema change. [SYNTHETIC]`);
