// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the first mistake, over HTTP, for typed, ink and photo alike
//
//   node server/test/first-mistake-http-check.mjs                    (SQLite)
//   node server/test/first-mistake-http-check.mjs --engine=postgres  (scripts/with-postgres.mjs)
//
// Issue #430: a photographed page for "first term 9, common difference 3, find
// the 9th term" was answered "Incorrect" and nothing else. This suite boots the
// shipped app (server/app.js → /v1), has the server issue that question, and
// submits the same five lines three ways — typed, as ink and as a photo, the
// last two through /recognize and /recognition/:receipt/confirm with the real
// provider adapter pointed at a local fixture — and asserts that:
//
//   · while a try is left the reply says nothing about any line;
//   · the reply that resolves the question carries the SAME per-line review in
//     all three modes: four verified lines and the first mistake on `= 35`,
//     with the blank line of the page keeping its place;
//   · the marks in it are the marks the marker decided (0 of 1 here — the
//     rubric of this question has one mark; 2 of 3 on the three-mark sum);
//   · the reader is sent the picture and nothing of the question, its answer
//     or its marks, and reviewing costs no provider call at all;
//   · a replay returns the identical review, so reload and history match;
//   · a page of some other question is reported as unmatched, with no marks;
//   · a hundred lines are answered inside the marker's deadline.
//
// Evidence class: SYNTHETIC. The "photo" is a tagged byte string and the
// reader is a fixture that returns authored lines. Nothing here reads a real
// page, measures reading accuracy, or is deployed.
// ─────────────────────────────────────────────────────────────────────────────
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const PAGE = ['a = 9, d = 3', 'T_n = a + (n - 1)d', 'T_9 = 9 + 8 × 3', '', '    = 9 + 24', '    = 35'];
const picture = label => 'data:image/png;base64,' + Buffer.from(`PICTURE|${label}|` + 'p'.repeat(300)).toString('base64');
const provider = { calls: 0, bodies: [] };
const fake = createServer((req, res) => {
  let raw = '';
  req.on('data', chunk => { raw += chunk; });
  req.on('end', () => {
    provider.calls += 1;
    provider.bodies.push(raw);
    const reading = { lines: PAGE.filter(l => l.trim()).map(text => ({ text: text.trim(), latex: '', confidence: 0.95 })), confidence: 0.95, needs_confirmation: false };
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ model: JSON.parse(raw).model, output_text: JSON.stringify(reading), usage: { input_tokens: 900, output_tokens: 60, total_tokens: 960 } }));
  });
});
await new Promise(resolve => fake.listen(0, '127.0.0.1', resolve));

const vars = ['NODE_ENV', 'PRI_PLATFORM_DB', 'PRI_AUTH_DELIVERY_KEY', 'PRI_PUBLIC_ORIGIN', 'PRI_HANDWRITING_API_KEY', 'PRI_HANDWRITING_ENDPOINT',
  'PRI_HANDWRITING_MODEL', 'PRI_HANDWRITING_FALLBACK_MODEL', 'PRI_PAID_CALLS_PER_HOUR', 'PRI_PAID_CALLS_PER_DAY', 'PRI_WORKING_API_KEY', 'PRI_WORKING_ENDPOINT'];
const before = Object.fromEntries(vars.map(key => [key, process.env[key]]));
const scratch = mkdtempSync(join(tmpdir(), 'pri-first-mistake-'));
Object.assign(process.env, {
  NODE_ENV: 'test', PRI_PLATFORM_DB: join(scratch, 'platform.db'), PRI_AUTH_DELIVERY_KEY: 'f1'.repeat(32),
  PRI_HANDWRITING_API_KEY: 'local-fixture', PRI_HANDWRITING_ENDPOINT: `http://127.0.0.1:${fake.address().port}/v1/responses`,
  PRI_HANDWRITING_MODEL: 'fixture-primary', PRI_HANDWRITING_FALLBACK_MODEL: 'fixture-fallback',
  PRI_PAID_CALLS_PER_HOUR: '10000', PRI_PAID_CALLS_PER_DAY: '100000'
});
for (const key of ['PRI_PUBLIC_ORIGIN', 'PRI_WORKING_API_KEY', 'PRI_WORKING_ENDPOINT']) delete process.env[key];
const { startApp, checks, registerAccount, verifyEmail } = await import('./support/app-harness.mjs');
const { requestedEngine } = await import('./support/engine.mjs');

const TERM = { generator: 'c10-arithmetic-progressions', difficulty: 1, seed: 10931, curriculum: 'in' };
const SAVINGS = { generator: 'c10-arithmetic-progressions', difficulty: 4, seed: 11, curriculum: 'in' };

const c = checks();
const h = await startApp({ engine: requestedEngine() });
let serial = 0;
try {
  const a = await registerAccount(h, { email: 'first.mistake@example.test', deviceId: 'ipad-first-mistake' });
  c.eq(a.status, 201, 'a student account exists');
  c.eq((await verifyEmail(h, a.account.id)).status, 200, 'and is verified');
  const issue = async sample => {
    const r = await h.request('/v1/practice/issue', { method: 'POST', jar: a.jar, body: sample });
    assert.equal(r.status, 201, 'the server issues the question');
    return r.data.question;
  };
  const post = (qid, body) => h.request(`/v1/practice/${qid}/submit`, { method: 'POST', jar: a.jar, headers: { 'Idempotency-Key': body.submissionId }, body });

  /** Submit `lines` with `answer` in one mode until the question resolves. */
  async function mark(sample, mode, answer, lines, { tries = 2 } = {}) {
    const q = await issue(sample);
    let receipt;
    if (mode !== 'typed') {
      const read = await h.request(`/v1/practice/${q.id}/recognize`, { method: 'POST', jar: a.jar, body: { mode, image: picture(`${mode}-${serial}`) } });
      assert.equal(read.status, 201, `${mode}: the page is read`);
      // The receipt is of the whole page; the answer submitted is the student's confirmed final answer.
      const confirmed = await h.request(`/v1/practice/${q.id}/recognition/${read.data.receipt}/confirm`, { method: 'POST', jar: a.jar, body: { text: answer } });
      assert.equal(confirmed.status, 201, `${mode}: the student confirms the answer`);
      receipt = confirmed.data.receipt;
    }
    const replies = [], bodies = [];
    for (let attempt = 0; attempt < tries; attempt += 1) {
      const body = { submissionId: `first-mistake-${String(serial++).padStart(4, '0')}`, answer, mode, steps: lines.join('\n'), ...(receipt ? { transcriptionReceipt: receipt } : {}) };
      const r = await post(q.id, body);
      replies.push(r); bodies.push(body);
      if (r.status !== 200 || r.data.resolved || r.data.invalid) break;
    }
    return { q, replies, bodies, last: replies.at(-1).data };
  }

  const probe = await issue(TERM);
  c.eq(probe.prompt, 'An arithmetic progression has first term $9$ and common difference $3$. Find its $9$th term.', 'the issued question is the owner\'s');
  c.deq([probe.answerType, probe.criteriaCount, probe.supportsSteps], ['numeric', 1, true], 'numeric, one mark, and its working is checked');
  for (const key of ['answer', 'solution', 'steps', 'traps', 'stepcheck', 'seed']) c.ok(!(key in probe), `the public question has no ${key}`);

  // ── The owner's page, three ways ───────────────────────────────────────────
  const reviews = {};
  for (const mode of ['typed', 'ink', 'photo']) {
    const calls = provider.calls;
    const r = await mark(TERM, mode, '35', PAGE);
    c.eq(provider.calls - calls, mode === 'typed' ? 0 : 1, `${mode}: ${mode === 'typed' ? 'no' : 'one'} reader call for the page — and none for marking or reviewing it`);
    const [open, closed] = r.replies.map(x => x.data);
    c.deq([r.replies.length, open.correct, open.resolved, open.triesLeft], [2, false, false, 1], `${mode}: the first wrong try leaves the question open`);
    c.deq([open.workingReview, open.stepReport, open.partial, 'solution' in open], [null, null, null, false], `${mode}: and says nothing about any line, mark or solution`);
    c.ok(!/33|9 \+ 24|mistake|slip|line/i.test(String(open.feedback).replace('Your working is checked when this question is finished.', '')), `${mode}: nor in its feedback`);
    c.deq([closed.correct, closed.resolved, closed.marksEarned, closed.marksPossible], [false, true, 0, 1], `${mode}: the second resolves it — incorrect, 0 of 1`);
    const v = closed.workingReview;
    c.ok(v && v.version === 1 && v.basis === 'deterministic', `${mode}: the resolving reply carries the per-line review`);
    c.deq(v.lines.map(l => l.check), ['verified', 'verified', 'verified', null, 'verified', 'first-mistake'], `${mode}: four ticks, a blank line in its place, and the first mistake on the last line`);
    c.deq(v.lines.map(l => l.read), ['submitted', 'submitted', 'submitted', 'blank', 'submitted', 'submitted'], `${mode}: every submitted line keeps its index`);
    c.deq([v.firstMistake.index, v.firstMistake.position, v.firstMistake.cls, v.firstMistake.correction, v.firstMistake.hint], [5, 'last', 'arithmetic-slip', '9 + 24 = 33, not 35.', 'Recheck 9 + 24.'], `${mode}: anchored on "= 35": 9 + 24 = 33, not 35`);
    c.deq(v.lines.filter(l => l.read === 'submitted').slice(0, 4).map(l => l.role), ['given', 'formula', 'substitution', 'arithmetic'], `${mode}: each tick names what it verified`);
    c.deq(v.marks, { earned: 0, possible: 1, method: 0 }, `${mode}: the review reports the marker's marks — one mark, for the answer`);
    c.deq([v.certified, v.matchesQuestion, v.answerCorrect, v.unexplained], [false, true, false, false], `${mode}: not certified, matched to the question, explained`);
    c.eq(closed.partial.note, 'No method marks: this question carries a single mark, for the answer.', `${mode}: and the marker says why there are no method marks`);
    c.eq(closed.stepReport.firstBreak, 4, `${mode}: the step report agrees (fifth written line)`);
    c.ok(String(closed.solution?.answerText) === '33', `${mode}: released together with the solution`);
    // Reload / history: the same key returns the same reply.
    const again = await post(r.q.id, r.bodies.at(-1));
    c.deq(again.data, closed, `${mode}: a replay of the submission is the identical reply, review included`);
    const stored = await h.db.all("SELECT payload_json FROM learning_events WHERE account_id=? AND entity_id=? AND kind='graded-attempt'", [a.account.id, r.q.id]);
    c.deq([stored.length, JSON.parse(stored[0].payload_json).marksEarned, JSON.parse(stored[0].payload_json).inputMode], [1, 0, mode], `${mode}: one graded attempt is recorded, with the same marks`);
    reviews[mode] = v;
  }
  c.deq(reviews.ink, reviews.typed, 'ink receives exactly the review typed working receives');
  c.deq(reviews.photo, reviews.typed, 'photo receives exactly the review typed working receives');

  // ── Answer-blindness of the reader ─────────────────────────────────────────
  c.eq(provider.bodies.length, 2, 'the reader was called twice in all: once per page read');
  for (const raw of provider.bodies) {
    const sent = JSON.parse(raw);
    const text = JSON.stringify(sent, (key, value) => (key === 'image_url' ? '[image]' : value));
    c.ok(!/arithmetic progression|first term|common difference|9\$?th term/i.test(text), 'the reader is not sent the question');
    c.ok(!/\b33\b/.test(text) && !/a \+ \(n ?- ?1\)/.test(text), 'nor the answer or the formula');
    c.ok(!/stepcheck|marksPossible|criteria|expected|solution/i.test(text.replace(/"expected[^"]*"/g, '')) || !/"(stepcheck|marksPossible|criteria|solution)"/.test(text), 'nor any rubric, mark or solution field');
    c.ok(sent.input.some(part => Array.isArray(part.content) && part.content.some(x => x.type === 'input_image')), 'only the picture and its fixed instructions');
  }

  // ── The correct page; a right answer over a wrong line ─────────────────────
  for (const mode of ['typed', 'photo']) {
    const right = await mark(TERM, mode, '33', [...PAGE.slice(0, 5), '    = 33']);
    c.deq([right.replies.length, right.last.correct, right.last.marksEarned], [1, true, 1], `${mode}: the correct page is 1 of 1 on the first try`);
    c.deq([right.last.workingReview.firstMistake, right.last.workingReview.certified, right.last.workingReview.counts.verified], [null, true, 5], `${mode}: no mistake, five lines verified, certified`);
    const lucky = await mark(TERM, mode, '33', ['T_9 = 9 + 8 × 3', '= 9 + 26', '= 33']);
    c.deq([lucky.last.correct, lucky.last.marksEarned, lucky.last.workingReview.certified, lucky.last.workingReview.firstMistake?.index], [true, 1, false, 1], `${mode}: a right answer keeps its mark, but the invalid line is shown and the working is not certified`);
  }

  // ── Rubric marks are preserved, per question ───────────────────────────────
  const sum = await issue(SAVINGS);
  const values = sum.prompt.match(/\$₹?(\d+)\$/g).map(m => Number(m.replace(/\D/g, '')));
  const [first, step, months] = values;
  const method = ['S_n = n/2(2a + (n - 1)d)', `S = ${months}/2 × (2 × ${first} + ${months - 1} × ${step})`, '= 1'];
  for (const mode of ['typed', 'ink', 'photo']) {
    const r = await mark(SAVINGS, mode, '1', method);
    c.deq([r.last.correct, r.last.marksEarned, r.last.marksPossible], [false, 2, 3], `${mode}: on the three-mark sum, the formula and the substitution earn 2 of 3`);
    c.deq(r.last.workingReview.marks, { earned: 2, possible: 3, method: 2 }, `${mode}: the review reports them`);
    c.deq(r.last.workingReview.lines.map(l => [l.check, l.criterion, l.mark]), [['verified', 'formula', 1], ['verified', 'substitution', 1], ['first-mistake', null, 0]], `${mode}: a mark beside each line that earned one, and none beside the line that broke`);
    c.eq(r.last.partial.awarded, 2, `${mode}: the same as the method evidence`);
    const stored = await h.db.all("SELECT payload_json FROM learning_events WHERE account_id=? AND entity_id=? AND kind='graded-attempt'", [a.account.id, r.q.id]);
    c.eq(JSON.parse(stored[0].payload_json).marksEarned, 2, `${mode}: and as the recorded attempt`);
  }
  const padded = await mark(SAVINGS, 'photo', '1', [`a = ${first}, d = ${step}, n = ${months}`, '1 + 1 = 2', `S = ${months * 7}`]);
  c.deq([padded.last.marksEarned, padded.last.workingReview.marks.method], [0, 0], 'given values copied out, true arithmetic on the side and a guess earn nothing');

  // ── A page of some other question ──────────────────────────────────────────
  const other = await mark(TERM, 'photo', '5', ['x^2 - 5x + 6 = 0', '(x - 2)(x - 3) = 0', 'x = 2 or x = 3', '2 + 3 = 5']);
  c.deq([other.last.correct, other.last.marksEarned, other.last.workingReview.matchesQuestion, other.last.workingReview.firstMistake], [false, 0, false, null], 'a page of another question: unmatched, no marks, and no line of it called a mistake');
  c.deq(other.last.workingReview.lines.map(l => l.check), ['not-checked', 'not-checked', 'not-checked', 'verified'], 'its lines are not checked against this question; arithmetic that is true is only that');
  c.eq(other.last.workingReview.counts.tied, 0, 'and none is tied to the question');

  // ── A reading to confirm ───────────────────────────────────────────────────
  const doubt = await mark(TERM, 'photo', '35', ['T_9 = 9 + 8 × 3', '= g + 24', '= 35']);
  c.deq([doubt.last.workingReview.firstMistake, doubt.last.workingReview.lines.map(l => l.check)], [null, ['verified', 'confirm', 'confirm']], 'a 9 read as g: no line is accused; confirmation is asked for');

  // ── A new attempt has a new review ─────────────────────────────────────────
  const retry = await issue(TERM);
  const one = await post(retry.id, { submissionId: 'first-mistake-retry-1', answer: '35', mode: 'typed', steps: PAGE.join('\n') });
  const two = await post(retry.id, { submissionId: 'first-mistake-retry-2', answer: '33', mode: 'typed', steps: 'T_9 = 9 + 8 × 3\n= 33' });
  c.deq([one.data.resolved, one.data.workingReview], [false, null], 'a wrong first attempt carries no review');
  c.deq([two.data.correct, two.data.workingReview.lines.length, two.data.workingReview.firstMistake], [true, 2, null], 'the rewritten working has its own review: two lines, no mistake, nothing of the first attempt');
  c.ok(!JSON.stringify(two.data.workingReview).includes('35'), 'not even its wrong value');

  // ── Inside the marker's deadline ───────────────────────────────────────────
  const many = Array.from({ length: 100 }, (_, i) => `T = ${i} + ${i} × 3 = ${i * 4 + (i % 7 === 0 ? 1 : 0)}`);
  const big = await issue(TERM);
  const at = Date.now();
  await post(big.id, { submissionId: 'first-mistake-big-1', answer: '1', mode: 'typed', steps: many.join('\n') });
  const resolved = await post(big.id, { submissionId: 'first-mistake-big-2', answer: '1', mode: 'typed', steps: many.join('\n') });
  const ms = Date.now() - at;
  c.deq([resolved.status, resolved.data.resolved, resolved.data.tooComplex === true], [200, true, false], 'a hundred lines of working are marked and reviewed, not stopped at the deadline');
  c.ok(ms < 3000, `two submissions of them in ${ms} ms`);
  c.eq(resolved.data.workingReview.lines.length, 100, 'every line has its result');
  c.eq(provider.calls, provider.bodies.length, 'and from first to last, marking and reviewing made no provider call of their own');
} finally {
  await h.close();
  await new Promise(resolve => fake.close(resolve));
  for (const [key, value] of Object.entries(before)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
  rmSync(scratch, { recursive: true, force: true });
}
console.log(`engine: ${h.engine}`);
console.log(`FIRST MISTAKE OVER HTTP: PASS — ${c.count()}/${c.count()} checks — typed, ink and photo working receive the same per-line review on the reply that resolves the question and nothing before it; the first mistake is anchored on the line it was made; marks are the rubric's; the reader is sent no question, answer or mark.`);
