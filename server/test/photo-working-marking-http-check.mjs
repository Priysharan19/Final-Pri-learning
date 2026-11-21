// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · a photographed page, as the server marks it
//
// The owner's question (2026-10-10): "Find the least value taken by the real
// function f(x) = (x + 3)² + 6." — numeric, three marks. The photographed page
// carried unrelated set notes above the working. This suite boots the shipped
// /v1 app, has the server issue that question, and records over HTTP what the
// deterministic marker pays, so the Photo client's choices rest on fact:
//
//   · the sentence "least value => 6." is refused as unreadable and spends no
//     try — which is why the client must never put a sentence in the field;
//   · 6 earns 3 of 3 with the working, with the unrelated notes left in, and
//     with strict ">" where "≥" is right: this question's working is not
//     step-checked (supportsSteps: false), so no line is crossed either way (a line restating what the prompt gives may be ticked as given);
//   · 9 with correct working earns 0 of 3: there are no method marks here;
//   · on a question whose working IS checked, unrelated lines such as
//     `b = {40,50,60}` are notes — never a broken line — and do not void the
//     method marks of the lines beside them.
//
// Nothing here changes the engine; it pins what the engine does.
// ─────────────────────────────────────────────────────────────────────────────
import './support/hermetic.mjs';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const keys = ['NODE_ENV', 'PRI_PLATFORM_DB', 'PRI_AUTH_DELIVERY_KEY', 'PRI_PUBLIC_ORIGIN'];
const before = Object.fromEntries(keys.map(key => [key, process.env[key]]));
const scratch = mkdtempSync(join(tmpdir(), 'pri-photo-marking-'));
process.env.NODE_ENV = 'test';
// D12: method marks are off by default — production marks the final answer only
// until an examiner signs (#499). This suite pins the method rubric itself, so it
// turns the server switch on; marking-policy-check.mjs pins the default.
process.env.PRI_METHOD_MARKS = 'on';
process.env.PRI_PLATFORM_DB = join(scratch, 'platform.db');
process.env.PRI_AUTH_DELIVERY_KEY = 'e7'.repeat(32);
delete process.env.PRI_PUBLIC_ORIGIN;
const { startApp, checks, registerAccount, verifyEmail } = await import('./support/app-harness.mjs');
const { requestedEngine } = await import('./support/engine.mjs');
// Named by (skill, difficulty, seed): the skill's direct form (client/test/support/direct-forms.mjs). Other forms are
// marked by the sweeps over every issued question.
(await import('../../client/src/engine/generators/index.js')).directFormsOnly(true);

const LEAST = { generator: 'c11-relations-functions', difficulty: 3, seed: 301, curriculum: 'in' };
const AP = { generator: 'c10-arithmetic-progressions', difficulty: 3, seed: 5401, curriculum: 'in' };
const NOTES = ['b = {40,50,60}.', 'b = {100,50,60}.', 'final:', 'a = {10,99,30}.', 'b = {100,50,60}.'];
const WORK = ['f(x) = (x+3)^2 + 6', '(x+3)^2 >= 0', '(x+3)^2 + 6 >= 6', 'least value => 6'];
const STRICT = WORK.map(line => line.replace(/>=/g, '>'));
const AP_WORK = ['-122 = 16 - 6(n-1)', '-138 = -6(n-1)', '23 = n-1'];

const c = checks();
const h = await startApp({ engine: requestedEngine() });
let serial = 0;
try {
  const a = await registerAccount(h, { email: 'photo.marking@example.test', deviceId: 'ipad-photo-marking' });
  c.eq(a.status, 201, 'a student account exists');
  c.eq((await verifyEmail(h, a.account.id)).status, 200, 'and is verified');
  const issue = async sample => {
    const r = await h.request('/v1/practice/issue', { method: 'POST', jar: a.jar, body: sample });
    assert.equal(r.status, 201, 'the server issues the question');
    return r.data.question;
  };
  /** Submit until the question resolves (at most two tries); returns every reply. */
  async function mark(sample, answer, lines) {
    const q = await issue(sample);
    const replies = [];
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const id = `photo-marking-${String(serial++).padStart(4, '0')}`;
      const r = await h.request(`/v1/practice/${q.id}/submit`, { method: 'POST', jar: a.jar, headers: { 'Idempotency-Key': id },
        body: { submissionId: id, answer, mode: 'typed', ...(lines ? { steps: lines.join('\n') } : {}) } });
      replies.push(r);
      if (r.status !== 200 || r.data.resolved || r.data.invalid) break;
    }
    return { q, replies, last: replies.at(-1).data };
  }

  const probe = await issue(LEAST);
  c.eq(probe.prompt, 'Find the least value taken by the real function $f(x) = (x + 3)^2 + 6$.', 'the issued question is the owner\'s');
  c.deq([probe.answerType, probe.criteriaCount, probe.supportsSteps], ['numeric', 3, false], 'numeric, three marks, and its working is not step-checked');
  for (const key of ['answer', 'solution', 'steps', 'traps', 'seed']) c.ok(!(key in probe), `the public question has no ${key}`);

  // What the old build sent: the whole last line as the answer.
  const sentence = await mark(LEAST, 'least value => 6.', [...NOTES, ...WORK]);
  c.deq([sentence.replies.length, sentence.last.invalid, sentence.last.correct, sentence.last.resolved, sentence.last.marksEarned, sentence.last.triesLeft], [1, true, false, false, 0, 1],
    'the sentence "least value => 6." is refused as unreadable: not an attempt, no mark, no try spent');
  c.ok(/couldn.t read that as a maths answer/i.test(sentence.last.feedback), 'with the "I couldn\'t read that" message the owner saw');
  c.deq([sentence.last.stepReport, sentence.last.partial], [null, null], 'and nothing about the working');

  for (const [label, lines] of [['with the relevant working', WORK], ['with the unrelated notes left in', [...NOTES, ...WORK]], ['with strict > where ≥ is right', STRICT], ['with no working', null]]) {
    const r = await mark(LEAST, '6', lines);
    c.deq([r.replies.length, r.last.correct, r.last.resolved, r.last.marksEarned, r.last.marksPossible], [1, true, true, 3, 3], `6 ${label}: correct, 3 of 3, on the first try`);
    // Train marking 9: this question still has no Step Check and no method marks (partial stays null). A line that restates
    // what the prompt itself gives may now be ticked as given, feedback only: so a report, when there is one, is the
    // true-as-written report, it crosses nothing, and it carries no mark.
    c.eq(r.last.partial, null, `6 ${label}: no method marks, the working of this question is not step-checked`);
    c.ok(r.last.stepReport === null || (r.last.stepReport.arithmetic === true && r.last.stepReport.firstBreak === -1 && r.last.stepReport.lines.every(l => l.status === 'ok' || l.status === 'note')),
      `6 ${label}: no line is crossed; any tick is a true-as-written tick only`);
    if (lines) {
      // Pinned to what is true today: the ONE ticked line is the one restating the prompt's own f(x), noted as given,
      // and every other line (the working, and any unrelated notes left in) is a note: none is ticked.
      const judged = r.last.stepReport.lines;
      c.deq(judged.filter(l => l.status === 'ok').map(l => [l.text, l.note]), [['f(x) = (x+3)^2 + 6', 'This is given in the question.']],
        `6 ${label}: the only ticked line is the restatement of f(x) = (x+3)^2 + 6, "This is given in the question."`);
      c.ok(judged.filter(l => l.text !== 'f(x) = (x+3)^2 + 6').every(l => l.status === 'note'), `6 ${label}: every other line is a note, no unrelated line is ticked`);
    }
    if (!lines) c.eq(r.last.stepReport, null, `6 ${label}: nothing about working that was not sent`);
    c.ok(String(r.last.solution?.answerText) === '6', `6 ${label}: the worked solution is shown`);
  }
  for (const [label, lines] of [['with the correct working', WORK], ['with the notes and the correct working', [...NOTES, ...WORK]], ['with strict > working', STRICT]]) {
    const r = await mark(LEAST, '9', lines);
    c.deq([r.replies.length, r.last.correct, r.last.resolved, r.last.marksEarned], [2, false, true, 0], `9 ${label}: incorrect after two tries, 0 of 3 — no method marks on this question`);
    c.deq([r.replies[0].data.resolved, r.replies[0].data.stepReport, 'solution' in r.replies[0].data], [false, null, false], `9 ${label}: the first try discloses nothing`);
  }

  // A question whose working IS checked: unrelated lines are notes, not errors.
  const clean = await mark(AP, '23', AP_WORK);
  const noted = await mark(AP, '23', [...NOTES, ...AP_WORK]);
  const after = await mark(AP, '23', [...AP_WORK, ...NOTES]);
  c.deq([clean.q.supportsSteps, clean.last.correct, clean.last.marksEarned, clean.last.marksPossible], [true, false, 2, 3], 'step-checked question, wrong final answer, correct working: 2 of 3 method marks');
  for (const [label, r, offset] of [['above the working', noted, 0], ['below the working', after, 3]]) {
    c.eq(r.last.marksEarned, clean.last.marksEarned, `unrelated notes ${label} do not change the method marks`);
    const judged = r.last.stepReport.lines;
    c.deq(judged.slice(offset, offset + 5).map(l => l.status), ['note', 'note', 'note', 'note', 'note'], `unrelated notes ${label} are reported as notes ("skipped"), never as a broken line`);
    c.deq([r.last.stepReport.firstBreak, judged.filter(l => l.status === 'ok').length], [-1, 3], `and the three lines of working ${label === 'above the working' ? 'below' : 'above'} them are still checked and found sound`);
    c.deq(r.last.partial.lines.filter(l => l.reason === 'note').map(l => l.mark), [0, 0, 0, 0, 0], `the notes ${label} earn nothing and cost nothing`);
  }
  const right = await mark(AP, '24', [...NOTES, ...AP_WORK]);
  c.deq([right.last.correct, right.last.marksEarned], [true, 3], 'and a right answer with notes on the page is 3 of 3');
} finally {
  await h.close();
  for (const [key, value] of Object.entries(before)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
  rmSync(scratch, { recursive: true, force: true });
}
console.log(`engine: ${h.engine}`);
console.log(`PHOTO WORKING MARKING: PASS — ${c.count()}/${c.count()} checks — the owner's question pays 3 of 3 for 6 and refuses a sentence without spending a try; unrelated lines are notes, never a break, with or without step checking.`);
