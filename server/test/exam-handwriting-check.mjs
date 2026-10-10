// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · handwriting that had not been read when a paper closed
//
//   node server/test/exam-handwriting-check.mjs                    (SQLite)
//   node server/test/exam-handwriting-check.mjs --engine=postgres  (scripts/with-postgres.mjs)
//
// Owner decision (R4): a handwritten exam answer the student never had read is
// not an empty answer. At the deadline, or on submit, the page is FROZEN by the
// digest of its picture; the answer is PENDING — unmarked, never blank, never
// given an invented mark — and at most a bounded number of reads of exactly
// that frozen picture may be started afterwards, by the account that sat the
// paper, each reserved in the paper's result row before the reader is asked.
//
// WHAT IS REAL: the shipped platform app over HTTP on its own database
// (sessions, CSRF, the exam router, the marker pool and its deterministic
// engine, recognitionOps and its kept reads, the spend ceiling, the allowance).
// WHAT IS SYNTHETIC: the handwriting READER. It is a local HTTP stand-in that
// never looks at a picture: a picture here is a tagged byte string that says
// what the stand-in should answer and how (confident, unsure, blank, slow,
// hanging, failing). No real provider, no real handwriting, no real device.
// Every count of "provider calls" below is a count of requests to that
// stand-in. SYNTHETIC-READER EVIDENCE.
// ─────────────────────────────────────────────────────────────────────────────
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const EVIDENCE = 'SYNTHETIC-READER EVIDENCE';
const scratch = mkdtempSync(join(tmpdir(), 'pri-exam-handwriting-'));

// ── The counting stand-in reader ─────────────────────────────────────────────
const picture = (label, behaviour = 'ok', filler = 'a') =>
  'data:image/png;base64,' + Buffer.from(`PICTURE|${behaviour}|${label}|` + filler.repeat(300)).toString('base64');
const digestOf = image => createHash('sha256').update(Buffer.from(image.split(',')[1], 'base64')).digest('hex');

const provider = { calls: new Map(), total: 0, held: new Map(), arrivals: new Map(), hanging: new Set(), doubting: new Set() };
const callsFor = label => provider.calls.get(label) || 0;
function arrived(label) {
  return new Promise((resolve, reject) => {
    if (provider.held.has(label)) return resolve();
    const timer = setTimeout(() => reject(new Error(`the reader never received ${label}`)), 15000);
    provider.arrivals.set(label, () => { clearTimeout(timer); resolve(); });
  });
}
function release(label) { const go = provider.held.get(label); provider.held.delete(label); go?.(); }
const reply = (res, model, reading) => {
  res.writeHead(200, { 'content-type': 'application/json' });
  res.end(JSON.stringify({ model, output_text: JSON.stringify(reading), usage: { input_tokens: 1000, output_tokens: 60, total_tokens: 1060 } }));
};
const fake = createServer((req, res) => {
  let raw = '';
  req.on('data', chunk => { raw += chunk; });
  req.on('end', () => {
    const sent = JSON.parse(raw);
    const image = sent.input[1].content.find(part => part.type === 'input_image').image_url;
    const [, behaviour, label] = Buffer.from(image.split(',')[1], 'base64').toString('utf8').split('|');
    provider.total += 1;
    provider.calls.set(label, callsFor(label) + 1);
    const lines = label.split('\n').map(text => ({ text, latex: '', confidence: 0.96 }));
    const read = { lines, confidence: 0.96, needs_confirmation: false };
    if (behaviour === 'blank') return reply(res, sent.model, { lines: [], confidence: 0, needs_confirmation: true });
    if (behaviour === 'unsure') return reply(res, sent.model, { lines: lines.map(l => ({ ...l, confidence: 0.4 })), confidence: 0.4, needs_confirmation: true });
    if (behaviour === 'doubt' && provider.doubting.has(label)) return reply(res, sent.model, { lines: lines.map(l => ({ ...l, confidence: 0.4 })), confidence: 0.4, needs_confirmation: true });
    if (behaviour === 'fail') { res.writeHead(500, { 'content-type': 'application/json' }); return res.end('{}'); }
    if (behaviour === 'hang' && provider.hanging.has(label)) return; // never answers: the adapter's own timeout ends it
    if (behaviour === 'hold') {
      provider.held.set(label, () => reply(res, sent.model, read));
      provider.arrivals.get(label)?.();
      provider.arrivals.delete(label);
      return;
    }
    return reply(res, sent.model, read);
  });
});
await new Promise(resolve => fake.listen(0, '127.0.0.1', resolve));

const vars = ['NODE_ENV', 'PRI_PLATFORM_DB', 'PRI_AUTH_DELIVERY_KEY', 'PRI_PUBLIC_ORIGIN', 'PRI_AUTH_EMAIL_PROVIDER', 'PRI_HANDWRITING_API_KEY',
  'PRI_HANDWRITING_ENDPOINT', 'PRI_HANDWRITING_MODEL', 'PRI_HANDWRITING_FALLBACK_MODEL', 'PRI_HANDWRITING_TIMEOUT_MS',
  'PRI_PAID_CALLS_PER_HOUR', 'PRI_PAID_CALLS_PER_DAY', 'PRI_AI_DAILY_FREE', 'PRI_AI_DAILY_PREMIUM'];
const previous = Object.fromEntries(vars.map(name => [name, process.env[name]]));
Object.assign(process.env, {
  NODE_ENV: 'test', PRI_PLATFORM_DB: join(scratch, 'unused.db'), PRI_AUTH_DELIVERY_KEY: '5d'.repeat(32),
  PRI_HANDWRITING_API_KEY: 'local-counting-fixture', PRI_HANDWRITING_ENDPOINT: `http://127.0.0.1:${fake.address().port}/v1/responses`,
  PRI_HANDWRITING_MODEL: 'fixture-primary', PRI_HANDWRITING_TIMEOUT_MS: '2000',
  PRI_PAID_CALLS_PER_HOUR: '10000', PRI_PAID_CALLS_PER_DAY: '100000'
});
for (const name of ['PRI_PUBLIC_ORIGIN', 'PRI_AI_DAILY_FREE', 'PRI_AI_DAILY_PREMIUM', 'PRI_HANDWRITING_FALLBACK_MODEL']) delete process.env[name];

const { startApp, registerAccount, verifyEmail } = await import('./support/app-harness.mjs');
const { requestedEngine } = await import('./support/engine.mjs');
const { createPlatformDb } = await import('../platform/db.js');
const { ensureBillingSchema } = await import('../platform/billingSchema.js');
const { ensureAuthDeliverySchema } = await import('../platform/authDelivery.js');
const { asStore, createPostgresStore } = await import('../platform/store.js');
const {
  FINISH_GRACE_MS, HANDWRITING_MAX_ATTEMPTS, HANDWRITING_BACKOFF_MS, HANDWRITING_RECOVERY_WINDOW_MS, PENDING_MESSAGE
} = await import('../platform/exams.js');
const { checkAnswer } = await import('../../client/src/engine/checker.js');
const { subtopicsForYear } = await import('../../client/src/engine/curriculum.js');
const { multipartForYear } = await import('../../client/src/engine/generators/multipart.js');

const engine = requestedEngine();

// ── One database that outlives the app, so the app can be restarted on it ────
let rawDb = null, pg = null, store = null;
const dbFile = join(scratch, 'exams.db');
async function openStore() {
  if (engine === 'sqlite') {
    rawDb = createPlatformDb(dbFile);
    ensureAuthDeliverySchema(rawDb);
    ensureBillingSchema(rawDb);
    store = asStore(rawDb);
  } else {
    if (!pg) {
      const { scratchDatabase, serverRoleUrl } = await import('./support/postgres.mjs');
      const scratchDb = await scratchDatabase('examink');
      pg = { scratchDb, url: await serverRoleUrl(scratchDb.name) };
    }
    store = await createPostgresStore(pg.url);
  }
  return store;
}
async function closeStore() {
  if (engine === 'sqlite') { if (rawDb?.open) rawDb.close(); } else await store.close();
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

let keySeq = 0;
const idem = () => `exam-ink-${String(++keySeq).padStart(4, '0')}-${realNow().toString(36)}`;
const create = (jar, body) => h.request('/v1/exams', { method: 'POST', jar, body, headers: { 'Idempotency-Key': idem() } });
const save = (jar, id, body) => h.request(`/v1/exams/${id}/answers`, { method: 'PUT', jar, body });
const finish = (jar, id, body = {}) => h.request(`/v1/exams/${id}/finish`, { method: 'POST', jar, body });
const read = (jar, id) => h.request(`/v1/exams/${id}`, { jar });
const present = (jar, id, key, image, retry = false) => h.request(`/v1/exams/${id}/handwriting`, { method: 'POST', jar, body: { key, image, ...(retry ? { retry: true } : {}) } });
const transcribe = (jar, image) => h.request('/v1/handwriting/transcribe', { method: 'POST', jar, body: { image } });
const sealed = async id => JSON.parse((await h.db.get("SELECT response_json FROM idempotency_keys WHERE scope='exam-paper' AND key=?", [id])).response_json);
const storedResult = async id => JSON.parse((await h.db.get("SELECT response_json FROM idempotency_keys WHERE scope='exam-result' AND key=?", [id])).response_json);
const events = async (accountId, kind) => (await h.db.all('SELECT id,entity_id,payload_json FROM learning_events WHERE account_id=? AND kind=? ORDER BY device_seq', [accountId, kind]))
  .map(row => ({ id: row.id, entityId: row.entity_id, payload: JSON.parse(row.payload_json) }));

const Y7 = subtopicsForYear(7).map(sub => sub.id);
const Y7_OTHER = Y7.find(id => id !== 'y7-equations');
const STRUCTURED7 = multipartForYear(7, 'advanced');
const ladder = (i, n) => { const t = i / n; return t < 0.2 ? 1 : t < 0.6 ? 2 : t < 0.9 ? 3 : 4; };
const practiceSpec = (length = 10, minutes = 30) => ({
  kind: 'practice-paper', paper: { year: 7, minutes },
  slots: [...Array.from({ length }, (_, i) => ({ generator: i % 2 ? 'y7-equations' : Y7_OTHER, difficulty: ladder(i, length) })), { multipart: STRUCTURED7[0] }]
});
const PAPER_MS = 30 * 60000;

// ── The oracle: the sealed paper, read from the database, never from a reply ─
const isCorrect = (q, given) => { try { return checkAnswer(q, given).correct === true; } catch { return false; } };
function rightAnswer(q) {
  const a = q.answer || {};
  const candidates = [];
  if (q.answerType === 'numeric') {
    if (a.canonicalInput) candidates.push(String(a.canonicalInput));
    if (a.simplestFraction) candidates.push(`${a.simplestFraction.n}/${a.simplestFraction.d}`);
    if (a.value !== undefined) candidates.push(String(a.value));
  } else if (q.answerType === 'expression') candidates.push(String(a.expr));
  // A label travels inside the stand-in's picture, split on "|" and newlines.
  return candidates.find(text => !/[|\n]/.test(text) && isCorrect(q, text)) ?? null;
}
const wrongAnswer = q => { const text = '987654'; return isCorrect(q, text) ? null : text; };
/** Written (non-objective) single questions of a sealed paper the oracle can answer rightly and wrongly. */
const writable = paper => paper.questions.filter(sq => !sq.payload.multipart && !['mcq', 'multi-mcq', 'working'].includes(sq.payload.answerType)
  && rightAnswer(sq.payload) !== null && wrongAnswer(sq.payload) !== null);

let students = 0;
async function student() {
  students += 1;
  await h.db.run("DELETE FROM rate_limits WHERE bucket LIKE 'register:%'");
  const account = await registerAccount(h, { email: `exam.ink.${students}@example.test`, deviceId: `exam-ink-ipad-${students}` });
  if (account.status !== 201) throw new Error(`register: ${account.status} ${account.text}`);
  if ((await verifyEmail(h, account.account.id)).status !== 200) throw new Error('verify failed');
  return { jar: account.jar, id: account.account.id };
}
/** A new account sitting a new practice paper, with at least `need` questions it can write an answer to. */
async function sitting(need = 3) {
  for (let tries = 0; tries < 6; tries++) {
    const who = await student();
    const made = await create(who.jar, practiceSpec());
    if (made.status !== 201) throw new Error(`create: ${made.status} ${made.text}`);
    const paper = await sealed(made.data.exam.id);
    const qs = writable(paper);
    if (qs.length >= need) return { ...who, exam: made.data.exam, paper, qs };
  }
  throw new Error('no paper with enough written questions was issued');
}
const lineOf = (result, sq) => result.detail.find(d => d.id === sq.id);
const others = (result, ...ids) => result.detail.filter(d => !ids.includes(d.id));
/** Everything about a finalised paper that reading a page afterwards must never change. */
const frozenFacts = result => [result.examId, result.startedAt, result.deadline, result.finishedAt, result.late, result.finalisedBy, result.inputSource,
  result.paperVersion, result.total, result.handwriting?.frozenAt, result.handwriting?.submissionDigest, result.handwriting?.windowEndsAt,
  Object.fromEntries(Object.entries(result.handwriting?.pages || {}).map(([k, p]) => [k, p.digest]))];
const sumAwarded = result => result.detail.reduce((n, d) => n + d.awarded, 0);
const sectionAwarded = result => result.summary.sections.reduce((n, s) => n + s.awarded, 0);
const until = async (condition, what) => {
  const stop = realNow() + 15000;
  while (!(await condition())) {
    if (realNow() > stop) throw new Error(`timed out waiting for ${what}`);
    await new Promise(resolve => setTimeout(resolve, 15));
  }
};

const paidPerAnswer = {};
try {
  // ══ 0 · A paper with no handwriting is exactly what it was ═════════════════
  {
    const s = await sitting(1);
    const [q1] = s.qs;
    const done = await finish(s.jar, s.exam.id, { answers: { [q1.id]: rightAnswer(q1.payload) }, reason: 'student' });
    eq([done.status, done.data.authoritative, 'handwriting' in done.data, 'provisional' in done.data, 'pendingMarks' in done.data],
      [200, true, false, false, false], 'a paper with no unread handwriting has no handwriting record and no provisional flag');
    ok(done.data.detail.every(d => !d.pending && d.outcome !== 'pending'), 'and no line of it is pending');
    eq((await read(s.jar, s.exam.id)).data.result, done.data, 'and it reads back as it was finalised');
    const bad = await sitting(1);
    eq([(await save(bad.jar, bad.exam.id, { rev: 1, ink: { [bad.qs[0].id]: 'not-a-digest' } })).status,
      (await save(bad.jar, bad.exam.id, { rev: 1, ink: { 'no-such-key': 'a'.repeat(64) } })).status,
      (await finish(bad.jar, bad.exam.id, { ink: { [bad.qs[0].id]: 'A'.repeat(64) } })).data?.error?.code],
    [400, 400, 'EXAM_FINISH_INVALID'], 'a malformed page digest, or one for a key the paper does not own, is refused');
    const mcq = bad.paper.questions.find(sq => sq.payload.answerType === 'mcq');
    if (mcq) {
      const objective = await finish(bad.jar, bad.exam.id, { ink: { [mcq.id]: 'c'.repeat(64) }, reason: 'student' });
      eq([lineOf(objective.data, mcq).pending, 'handwriting' in objective.data], [undefined, false], 'an objective question cannot be left pending on handwriting');
    } else { await finish(bad.jar, bad.exam.id, { reason: 'student' }); ok(true, 'this paper has no objective question to try'); }
  }

  // ══ 1 · Deadline, handwriting the student HAD read ═════════════════════════
  {
    const s = await sitting(1);
    const [q1] = s.qs;
    const right = rightAnswer(q1.payload);
    const image = picture(right);
    const before = provider.total;
    const reading = await transcribe(s.jar, image);
    eq([reading.status, reading.data.transcription.lines.map(l => l.text), provider.total - before], [200, [right], 1], 'during the paper the student presses Read my answer: one provider call');
    // The transcript they saw is their answer; the page is not "unread", though its digest is still sent.
    eq((await save(s.jar, s.exam.id, { rev: 1, answers: { [q1.id]: right }, modes: { [q1.id]: 'ink' }, ink: { [q1.id]: digestOf(image) } })).data.saved, true, 'the snapshot carries the read answer');
    skew += PAPER_MS + 30000;                                   // the bell, inside the grace
    const done = await finish(s.jar, s.exam.id, { answers: { [q1.id]: right }, modes: { [q1.id]: 'ink' }, ink: { [q1.id]: digestOf(image) }, reason: 'deadline' });
    const line = lineOf(done.data, q1);
    eq([done.status, done.data.finalisedBy, line.correct, line.awarded, line.pending, line.given, 'handwriting' in done.data, provider.total - before],
      [200, 'deadline', true, Number(q1.marking.correct), undefined, right, false, 1],
      `at the deadline, handwriting that was already read is marked on its transcript: no pending state and no further provider call [${EVIDENCE}]`);
    const again = await present(s.jar, s.exam.id, q1.id, image);
    eq([again.status, again.data?.error?.code, provider.total - before], [409, 'EXAM_HANDWRITING_NOT_PENDING', 1], 'and nothing of it can be presented for reading afterwards');
    paidPerAnswer.readBeforeDeadline = provider.total - before;
  }

  // ══ 2 · Deadline, ONE page the student never had read ══════════════════════
  {
    const s = await sitting(3);
    const [q1, q2, q3] = s.qs;
    const right2 = rightAnswer(q2.payload);
    const image = picture(right2);
    const open = await present(s.jar, s.exam.id, q2.id, image);
    eq([open.status, open.data?.error?.code], [409, 'EXAM_NOT_FINALISED'], 'while the paper is open nothing is read through the after-close route');
    const before = provider.total;
    skew += PAPER_MS + 30000;
    const body = { answers: { [q1.id]: rightAnswer(q1.payload) }, modes: { [q2.id]: 'ink' }, ink: { [q2.id]: digestOf(image) }, reason: 'deadline' };
    const done = await finish(s.jar, s.exam.id, body);
    const frozen = done.data;
    const l2 = lineOf(frozen, q2), l3 = lineOf(frozen, q3);
    eq([done.status, frozen.provisional, frozen.pendingMarks, frozen.score], [200, true, Number(q2.marking.correct), Number(q1.marking.correct)],
      'the paper is finalised at the deadline with the unread answer pending: the result is provisional and says how many marks are undecided');
    eq([l2.pending, l2.outcome, l2.correct, l2.unanswered, l2.awarded, l2.given, l2.attemptId, l2.feedback],
      [true, 'pending', false, true, Number(q2.marking.unanswered || 0), '', null, PENDING_MESSAGE],
      'the unread handwritten answer is PENDING: not correct, not wrong, not given an invented mark, with the fixed sentence and no attempt');
    eq([l3.pending, l3.outcome, l3.unanswered], [undefined, 'unanswered', true], 'a question with no answer and no handwriting is unanswered, as ever — a different state');
    const page = frozen.handwriting.pages[q2.id];
    eq([Object.keys(frozen.handwriting.pages), page.digest, page.state, page.reason, page.attempts, frozen.handwriting.maxAttempts, frozen.handwriting.windowEndsAt - frozen.handwriting.frozenAt],
      [[q2.id], digestOf(image), 'awaiting-reading', 'not-read', 0, HANDWRITING_MAX_ATTEMPTS, HANDWRITING_RECOVERY_WINDOW_MS],
      'the page is frozen in the result by the digest of its picture, awaiting reading, with its limits stated');
    eq(provider.total - before, 0, 'finalising read nothing and paid for nothing');
    const receiptRow = (await h.db.get("SELECT response_json FROM idempotency_keys WHERE scope='exam-result' AND key=?", [s.exam.id])).response_json;
    eq([page.key, page.questionId, page.evidence, page.receivedAt, page.snapshotRev, page.triesLeft, page.canRetry],
      [q2.id, q2.id, 'submission-in-time', frozen.finishedAt, null, HANDWRITING_MAX_ATTEMPTS, false],
      'that record is the receipt: which question, the digest, when the server received it and on what evidence, and its status');
    ok(!/base64|data:image|PICTURE/.test(receiptRow) && !receiptRow.includes(image.split(',')[1].slice(0, 40)), 'the stored receipt holds no image bytes at all');
    const attemptsBefore = await events(s.id, 'graded-attempt');
    ok(!attemptsBefore.some(e => e.entityId === q2.id) && attemptsBefore.some(e => e.entityId === q3.id), 'no attempt is recorded for the pending answer (the blank one is, as a practice paper always has)');
    eq((await events(s.id, 'exam-result'))[0].payload.pendingHandwriting, 1, "the paper's own event says one answer is still waiting");
    eq([sumAwarded(frozen), sectionAwarded(frozen)], [frozen.score, frozen.score], 'the totals are the sum of the lines');
    eq((await read(s.jar, s.exam.id)).data.result, frozen, 'the paper reads back exactly so');

    // The student cannot change anything now.
    const lateSave = await save(s.jar, s.exam.id, { rev: 9, answers: { [q2.id]: right2 } });
    eq([lateSave.status, lateSave.data.error.code], [409, 'EXAM_FINALISED'], 'after the paper closed no answer can be saved to it');
    const changed = picture(right2, 'ok', 'b');
    const refinish = await finish(s.jar, s.exam.id, { answers: { [q2.id]: right2, [q3.id]: rightAnswer(q3.payload) }, ink: { [q3.id]: digestOf(changed) }, reason: 'student' });
    eq(refinish.data, frozen, 'a second submission with new answers and new handwriting is answered with the stored result, unchanged');
    const swapped = await present(s.jar, s.exam.id, q2.id, changed);
    eq([swapped.status, swapped.data.error.code, provider.total - before], [409, 'EXAM_HANDWRITING_CHANGED', 0],
      'a different picture for the frozen answer — new strokes, an erasure, a replacement photo — is refused and never reaches the reader');
    const elsewhere = await present(s.jar, s.exam.id, q3.id, changed);
    eq([elsewhere.status, elsewhere.data.error.code], [409, 'EXAM_HANDWRITING_NOT_PENDING'], 'and a page cannot be added to an answer that had none when the paper closed');
    eq((await storedResult(s.exam.id)).handwriting.pages[q2.id].attempts, 0, 'none of that used an attempt');
    const outsider = await student();
    eq([(await present({}, s.exam.id, q2.id, image)).status, (await present(outsider.jar, s.exam.id, q2.id, image)).status], [401, 404],
      'signed out, or as another account, the page cannot be presented at all');

    // The frozen page is read once, after the clock has expired.
    skew += 20 * 60000;
    const resolved = await present(s.jar, s.exam.id, q2.id, image);
    const after = resolved.data.result;
    const r2 = lineOf(after, q2);
    eq([resolved.status, resolved.data.attempted, provider.total - before, callsFor(right2)], [200, true, 1, 1],
      `the frozen page is read after the deadline with exactly one provider call [${EVIDENCE}]`);
    eq([r2.pending, r2.outcome, r2.correct, r2.awarded, r2.given, r2.readAfterClose, typeof r2.attemptId],
      [undefined, 'correct', true, Number(q2.marking.correct), right2, true, 'string'],
      'and the answer it states is marked by the deterministic engine: correct, full marks, flagged as read after the paper closed');
    eq([after.score, after.provisional, after.pendingMarks, after.handwriting.pages[q2.id].state, after.handwriting.pages[q2.id].attempts],
      [frozen.score + Number(q2.marking.correct), false, 0, 'resolved', 1], 'the score now includes it and the result is no longer provisional');
    eq(others(after, q2.id), others(frozen, q2.id), 'every other line of the result is byte-for-byte what it was');
    eq(frozenFacts(after), frozenFacts(frozen), 'and the frozen submission — its digest, its times, its page digests — did not change');
    eq([sumAwarded(after), sectionAwarded(after)], [after.score, after.score], 'the totals are still the sum of the lines');
    const attemptsAfter = await events(s.id, 'graded-attempt');
    const written = attemptsAfter.find(e => e.id === r2.attemptId);
    eq([attemptsAfter.length - attemptsBefore.length, written?.payload.correct, written?.payload.inputMode, written?.payload.examId],
      [1, true, 'ink', s.exam.id], 'exactly one graded attempt is written for it, as handwriting');
    const paperEvent = (await events(s.id, 'exam-result'))[0].payload;
    eq([paperEvent.score, paperEvent.pendingHandwriting], [after.score, undefined], "and the paper's own event carries the score as it now is");
    // Duplicate requests after it is resolved cost nothing and change nothing.
    const twice = await Promise.all([present(s.jar, s.exam.id, q2.id, image), present(s.jar, s.exam.id, q2.id, image)]);
    eq([twice.map(r => [r.status, r.data.attempted]), provider.total - before, (await read(s.jar, s.exam.id)).data.result],
      [[[200, false], [200, false]], 1, after], 'presenting a resolved page again starts nothing and changes nothing');
    eq((await events(s.id, 'graded-attempt')).length, attemptsAfter.length, 'and writes no second attempt');
    paidPerAnswer.unreadAtDeadline = provider.total - before;
  }

  // ══ 3 · Several unread pages: right, wrong, and one the reader doubts ══════
  {
    const s = await sitting(3);
    const [q1, q2, q3] = s.qs;
    const pages = {
      [q1.id]: picture(rightAnswer(q1.payload), 'ok', 'c'),
      [q2.id]: picture(wrongAnswer(q2.payload), 'ok', 'd'),
      [q3.id]: picture(rightAnswer(q3.payload), 'unsure', 'e')
    };
    const before = provider.total;
    const done = await finish(s.jar, s.exam.id, { ink: Object.fromEntries(Object.entries(pages).map(([k, image]) => [k, digestOf(image)])), reason: 'student' });
    const frozen = done.data;
    eq([Object.keys(frozen.handwriting.pages).sort(), frozen.score, frozen.pendingMarks, frozen.provisional],
      [[q1.id, q2.id, q3.id].sort(), 0, [q1, q2, q3].reduce((n, q) => n + Number(q.marking.correct), 0), true],
      'submitting with three unread handwritten answers freezes all three as pending; none is scored');
    const [a, b] = await Promise.all([present(s.jar, s.exam.id, q1.id, pages[q1.id]), present(s.jar, s.exam.id, q2.id, pages[q2.id])]);
    const c = await present(s.jar, s.exam.id, q3.id, pages[q3.id]);
    // One read OPERATION per page. A confident page is one provider call; a
    // page the reader doubts is escalated once to the fallback model by the
    // provider adapter itself (its existing rule), inside that one operation.
    const doubtedCalls = provider.total - before - 2;
    eq([a.status, b.status, c.status, a.data.attempted, b.data.attempted, c.data.attempted], [200, 200, 200, true, true, true], 'each page is presented once and read once');
    ok(doubtedCalls >= 1 && doubtedCalls <= 2, `two provider calls for the two confident pages, and ${doubtedCalls} for the doubted one (its own fallback escalation included) [${EVIDENCE}]`);
    const spentOnThree = provider.total - before;
    const after = (await read(s.jar, s.exam.id)).data.result;
    const [l1, l2, l3] = [q1, q2, q3].map(q => lineOf(after, q));
    eq([l1.correct, l1.awarded, l1.pending], [true, Number(q1.marking.correct), undefined], 'the page that states the right answer is marked correct');
    eq([l2.correct, l2.outcome === 'pending', l2.pending, l2.given, l2.awarded <= 0], [false, false, undefined, wrongAnswer(q2.payload), true],
      'the page that states a wrong answer is marked wrong — by the engine, on what was written');
    const doubted = after.handwriting.pages[q3.id];
    eq([l3.pending, l3.outcome, l3.correct, l3.awarded, l3.attemptId, doubted.state, doubted.reason, doubted.transcript, doubted.canRetry, doubted.triesLeft],
      [true, 'pending', false, Number(q3.marking.unanswered || 0), null, 'needs-review', 'uncertain', [rightAnswer(q3.payload)], true, HANDWRITING_MAX_ATTEMPTS - 1],
      'the page the reader was unsure of is NOT marked: it stays pending, preserved with its unconfirmed transcript, for a person to resolve');
    eq([after.provisional, after.pendingMarks, after.score, sumAwarded(after)], [true, Number(q3.marking.correct), l1.awarded + l2.awarded, after.score],
      'the result stays provisional for exactly that answer');
    eq(others(after, q1.id, q2.id, q3.id), others(frozen, q1.id, q2.id, q3.id), 'no other line changed');
    eq(frozenFacts(after), frozenFacts(frozen), 'and the frozen submission did not change');
    skew += 2 * 60 * 60000;
    const retry = await present(s.jar, s.exam.id, q3.id, pages[q3.id]);
    eq([retry.status, retry.data.attempted, provider.total - before, lineOf(retry.data.result, q3).pending], [200, false, spentOnThree, true],
      'nothing retries by itself: a request that is not the student\'s own Retry starts no second read');
    ok(!(await events(s.id, 'graded-attempt')).some(e => e.entityId === q3.id), 'and no attempt exists for it');
    // An empty read states no answer either.
    const t = await sitting(1);
    const blank = picture('nothing', 'blank', 'f');
    await finish(t.jar, t.exam.id, { ink: { [t.qs[0].id]: digestOf(blank) }, reason: 'student' });
    const empty = await present(t.jar, t.exam.id, t.qs[0].id, blank);
    eq([empty.data.result.handwriting.pages[t.qs[0].id].state, empty.data.result.handwriting.pages[t.qs[0].id].reason, lineOf(empty.data.result, t.qs[0]).pending],
      ['needs-review', 'unreadable', true], 'a page the reader finds nothing on is preserved for review, never treated as a blank answer');
  }

  // ══ 4 · A slow provider, a second tap, a second tab ════════════════════════
  {
    const s = await sitting(1);
    const [q1] = s.qs;
    const label = rightAnswer(q1.payload);
    const image = picture(label, 'hold', 'g');
    const before = callsFor(label);
    const frozen = (await finish(s.jar, s.exam.id, { ink: { [q1.id]: digestOf(image) }, reason: 'student' })).data;
    const waiting = arrived(label);
    const slow = present(s.jar, s.exam.id, q1.id, image);
    await waiting;
    const impatient = await Promise.all([present(s.jar, s.exam.id, q1.id, image), present(s.jar, s.exam.id, q1.id, image)]);
    eq([impatient.map(r => [r.status, r.data.attempted]), callsFor(label) - before], [[[200, false], [200, false]], 1],
      `while a slow read is in flight, two more requests for the same page start nothing: still one provider call [${EVIDENCE}]`);
    const midway = impatient[0].data;
    eq([lineOf(midway.result, q1).pending, midway.result.handwriting.pages[q1.id].attempts, midway.retryAt > Date.now()], [true, 1, true],
      'they are told the page is still pending, with one attempt reserved and when to ask again');
    skew += 5 * 60000;                                          // the clock runs on while the provider thinks
    release(label);
    const landed = await slow;
    eq([landed.status, landed.data.attempted, lineOf(landed.data.result, q1).correct, landed.data.result.handwriting.pages[q1.id].state, callsFor(label) - before],
      [200, true, true, 'resolved', 1], 'the slow read lands after the clock has moved on and is marked: one call in all');
    eq(frozenFacts(landed.data.result), frozenFacts(frozen), 'on the frozen submission and nothing else');
    paidPerAnswer.slowProvider = callsFor(label) - before;
  }

  // ══ 5 · Provider timeout, a process restart, then recovery ═════════════════
  {
    const s = await sitting(1);
    const [q1] = s.qs;
    const label = rightAnswer(q1.payload);
    const image = picture(label, 'hang', 'h');
    const before = callsFor(label);
    provider.hanging.add(label);
    const frozen = (await finish(s.jar, s.exam.id, { ink: { [q1.id]: digestOf(image) }, reason: 'student' })).data;
    const timedOut = await present(s.jar, s.exam.id, q1.id, image);
    const page = timedOut.data.result.handwriting.pages[q1.id];
    eq([timedOut.status, timedOut.data.attempted, page.state, page.reason, page.attempts, lineOf(timedOut.data.result, q1).pending, timedOut.data.result.score],
      [200, true, 'awaiting-reading', 'reader-unavailable', 1, true, frozen.score],
      'a provider that does not answer in time leaves the answer pending — preserved, unmarked — with one attempt used');
    eq(timedOut.data.retryAt - page.lastAttemptAt, HANDWRITING_BACKOFF_MS[0], 'and the earliest next attempt is stated');
    // One read operation: the provider adapter's own primary call and, by its
    // existing rule, one fallback call — both unanswered, both inside its timeout.
    const firstOperation = callsFor(label) - before;
    ok(firstOperation >= 1 && firstOperation <= 2, `that one bounded operation made ${firstOperation} provider call(s) and then gave up [${EVIDENCE}]`);
    const tooSoon = await present(s.jar, s.exam.id, q1.id, image);
    eq([tooSoon.data.attempted, callsFor(label) - before], [false, firstOperation], 'asking again inside the backoff starts no read');
    provider.hanging.delete(label);
    await restart();
    eq((await read(s.jar, s.exam.id)).data.result.handwriting.pages[q1.id], page, 'after a process restart the pending page, its attempt count and its backoff are exactly as they were');
    skew += HANDWRITING_BACKOFF_MS[0] + 1000;
    eq([(await present(s.jar, s.exam.id, q1.id, image)).data.attempted, callsFor(label) - before], [false, firstOperation], 'after the backoff an automatic request still starts nothing: the one automatic read is spent');
    const recovered = await present(s.jar, s.exam.id, q1.id, image, true);
    eq([recovered.data.attempted, lineOf(recovered.data.result, q1).correct, recovered.data.result.handwriting.pages[q1.id].state, recovered.data.result.handwriting.pages[q1.id].attempts, callsFor(label) - before],
      [true, true, 'resolved', 2, firstOperation + 1], 'the student\'s own Retry checking resolves it: the second attempt, exactly one more provider call');
    eq(frozenFacts(recovered.data.result), frozenFacts(frozen), 'on the same frozen submission');
    paidPerAnswer.afterOneTimeout = callsFor(label) - before;
  }

  // ══ 6 · A reader that stays down: bounded retries, then a person ══════════
  {
    const s = await sitting(1);
    const [q1] = s.qs;
    const label = rightAnswer(q1.payload);
    const image = picture(label, 'fail', 'i');
    const before = callsFor(label);
    const frozen = (await finish(s.jar, s.exam.id, { ink: { [q1.id]: digestOf(image) }, reason: 'student' })).data;
    const tries = [];
    for (let n = 0; n < HANDWRITING_MAX_ATTEMPTS; n++) {
      const tried = await present(s.jar, s.exam.id, q1.id, image, n > 0);
      tries.push([tried.data.attempted, tried.data.result.handwriting.pages[q1.id].state, tried.data.result.handwriting.pages[q1.id].attempts]);
      skew += HANDWRITING_BACKOFF_MS[Math.min(n, HANDWRITING_BACKOFF_MS.length - 1)] + 1000;
    }
    eq(tries, [[true, 'awaiting-reading', 1], [true, 'awaiting-reading', 2], [true, 'needs-review', 3]], 'a reader that keeps failing is tried the fixed number of times and no more');
    skew += 24 * 60 * 60000;
    const callsBeforeLast = callsFor(label) - before;
    const spent = await present(s.jar, s.exam.id, q1.id, image, true);
    const final = spent.data.result;
    const sentInAll = callsFor(label) - before;
    eq([spent.data.attempted, final.handwriting.pages[q1.id].reason, final.handwriting.pages[q1.id].nextAttemptAt, final.handwriting.pages[q1.id].triesLeft, final.handwriting.pages[q1.id].canRetry],
      [false, 'retries-exhausted', null, 0, false], 'at the limit even the student\'s own Retry starts nothing, and the page says no tries are left');
    ok(sentInAll >= HANDWRITING_MAX_ATTEMPTS && sentInAll <= 2 * HANDWRITING_MAX_ATTEMPTS && sentInAll === callsBeforeLast,
      `and nothing more is ever sent for it: ${sentInAll} provider calls in all for ${HANDWRITING_MAX_ATTEMPTS} read operations (each may include the adapter's one fallback call) [${EVIDENCE}]`);
    eq([lineOf(final, q1).pending, lineOf(final, q1).awarded, final.score, final.provisional, final.pendingMarks], [true, Number(q1.marking.unanswered || 0), frozen.score, true, Number(q1.marking.correct)],
      'the answer is still pending and still preserved: no mark, no feedback and no attempt was invented for it');
    eq([others(final, q1.id), frozenFacts(final)], [others(frozen, q1.id), frozenFacts(frozen)], 'and nothing else moved');
  }

  // ══ 7 · Capacity exhausted: refused, not paid for, read when capacity returns
  {
    const s = await sitting(1);
    const [q1] = s.qs;
    const label = rightAnswer(q1.payload);
    const image = picture(label, 'ok', 'j');
    const before = callsFor(label);
    const frozen = (await finish(s.jar, s.exam.id, { ink: { [q1.id]: digestOf(image) }, reason: 'student' })).data;
    await h.db.run("DELETE FROM rate_limits WHERE bucket LIKE 'paid-provider:%'");
    process.env.PRI_PAID_CALLS_PER_HOUR = '1';
    eq((await transcribe(s.jar, picture('uses the hour', 'ok', 'k'))).status, 200, "the deployment's one paid call for this hour is used by something else");
    const refused = await present(s.jar, s.exam.id, q1.id, image);
    const page = refused.data.result.handwriting.pages[q1.id];
    eq([refused.status, refused.data.attempted, page.state, page.reason, page.attempts, callsFor(label) - before, lineOf(refused.data.result, q1).pending],
      [200, true, 'awaiting-reading', 'capacity', 1, 0, true], 'with the spending ceiling reached the page is not read and not paid for; the answer stays pending, saying why');
    ok(refused.data.retryAt >= page.lastAttemptAt + HANDWRITING_BACKOFF_MS[0], 'and it is not tried again before the backoff or the ceiling resets');
    process.env.PRI_PAID_CALLS_PER_HOUR = '10000';
    eq([(await present(s.jar, s.exam.id, q1.id, image)).data.attempted, callsFor(label) - before], [false, 0], 'raising nothing by hand: inside the wait nothing is sent even though capacity is back');
    skew += 61 * 60000;
    const read2 = await present(s.jar, s.exam.id, q1.id, image, true);
    eq([read2.data.attempted, lineOf(read2.data.result, q1).correct, read2.data.result.handwriting.pages[q1.id].attempts, callsFor(label) - before],
      [true, true, 2, 1], 'when capacity has returned the frozen page is read: one provider call for the answer');
    eq(frozenFacts(read2.data.result), frozenFacts(frozen), 'on the frozen submission');
    paidPerAnswer.afterCapacityRefusal = callsFor(label) - before;
  }

  // ══ 8 · The device never came back: failed network, session gone, restart ══
  {
    const s = await sitting(3);
    const [q1, q2, q3] = s.qs;
    const label = rightAnswer(q2.payload);
    const image = picture(label, 'ok', 'l');
    const before = callsFor(label);
    eq((await save(s.jar, s.exam.id, { rev: 1, answers: { [q1.id]: rightAnswer(q1.payload) }, modes: { [q2.id]: 'ink' }, ink: { [q2.id]: digestOf(image) } })).data.saved, true,
      'before the bell the snapshot says one answer is handwritten and unread, by its digest only');
    const snap = (await read(s.jar, s.exam.id)).data.snapshot;
    eq([snap.ink, JSON.stringify(snap).includes('base64')], [{ [q2.id]: digestOf(image) }, false], 'the server holds the digest and never the picture');
    skew += PAPER_MS + FINISH_GRACE_MS + 60000;                 // the network failed at the bell; nothing arrived
    await restart();
    // After the deadline a late finish carries more handwriting and more answers. None of it counts.
    const lateImage = picture(rightAnswer(q3.payload), 'ok', 'm');
    const late = await finish(s.jar, s.exam.id, { answers: { [q1.id]: rightAnswer(q1.payload), [q3.id]: rightAnswer(q3.payload) }, ink: { [q2.id]: digestOf(lateImage), [q3.id]: digestOf(lateImage) }, reason: 'deadline' });
    const frozen = late.data;
    eq([late.status, frozen.late, frozen.inputSource, Object.keys(frozen.handwriting.pages), frozen.handwriting.pages[q2.id].digest, lineOf(frozen, q3).pending, lineOf(frozen, q3).unanswered],
      [200, true, 'server-snapshot-before-deadline', [q2.id], digestOf(image), undefined, true],
      'a finish after deadline + grace freezes only what the last snapshot before it held: the earlier page digest, no later answer, no later handwriting');
    eq([lineOf(frozen, q2).pending, lineOf(frozen, q2).outcome, frozen.pendingMarks], [true, 'pending', Number(q2.marking.correct)], 'the handwriting captured before the bell is pending, not blank');
    eq([(await present(s.jar, s.exam.id, q2.id, lateImage)).data?.error?.code, (await present(s.jar, s.exam.id, q3.id, lateImage)).data?.error?.code, callsFor(label) - before],
      ['EXAM_HANDWRITING_CHANGED', 'EXAM_HANDWRITING_NOT_PENDING', 0], 'the picture drawn after the bell cannot stand in for it, and the late page cannot be added');
    // The session has expired: nothing happens until the account signs in again.
    await h.db.run('UPDATE account_sessions SET expires_at=? WHERE account_id=?', [Date.now() - 1000, s.id]);
    const expired = await present(s.jar, s.exam.id, q2.id, image);
    if (expired.status === 401) {
      eq([expired.status, (await storedResult(s.exam.id)).handwriting.pages[q2.id].attempts, callsFor(label) - before], [401, 0, 0], 'with the session expired the page is not read and no attempt is used');
      const login = await h.request('/v1/account/login', { method: 'POST', jar: s.jar, body: { email: `exam.ink.${students}@example.test`, password: 'correct-horse-battery', deviceId: `exam-ink-ipad-${students}` } });
      ok(login.status === 200 || login.status === 201, `the student signs in again (${login.status})`);
    } else {
      throw new Error(`the session table could not be cleared for the expiry check (status ${expired.status})`);
    }
    await restart();
    const back = await present(s.jar, s.exam.id, q2.id, image);
    eq([back.status, back.data.attempted, lineOf(back.data.result, q2).correct, back.data.result.handwriting.pages[q2.id].state, callsFor(label) - before],
      [200, true, true, 'resolved', 1], 'on the next authenticated visit — after two restarts — the frozen page is read once and marked');
    eq([others(back.data.result, q2.id), frozenFacts(back.data.result)], [others(frozen, q2.id), frozenFacts(frozen)], 'and the original submission is exactly what was frozen');

    // Nobody ever finishes: the server closes the paper itself, and the page is still not a blank.
    const gone = await sitting(1);
    const goneImage = picture(rightAnswer(gone.qs[0].payload), 'ok', 'n');
    await save(gone.jar, gone.exam.id, { rev: 1, ink: { [gone.qs[0].id]: digestOf(goneImage) } });
    skew += PAPER_MS + FINISH_GRACE_MS + 60000;
    const closed = (await read(gone.jar, gone.exam.id)).data;
    eq([closed.state, closed.result.unattended, lineOf(closed.result, gone.qs[0]).pending, closed.result.handwriting.pages[gone.qs[0].id].state],
      ['finished', true, true, 'awaiting-reading'], 'a paper the server closes unattended keeps its unread handwriting pending too');
  }

  // ══ 9 · Duplicate submission, then two devices presenting at once ══════════
  {
    const s = await sitting(1);
    const [q1] = s.qs;
    const label = rightAnswer(q1.payload);
    const image = picture(label, 'ok', 'o');
    const before = callsFor(label);
    const body = { ink: { [q1.id]: digestOf(image) }, reason: 'student', submissionKey: 'duplicate-submit-0001' };
    const [f1, f2] = await Promise.all([finish(s.jar, s.exam.id, body), finish(s.jar, s.exam.id, body)]);
    eq([f1.status, f2.status, f1.data.handwriting.pages, f1.data.finishedAt], [200, 200, f2.data.handwriting.pages, f2.data.finishedAt], 'a duplicated submit is one finalisation with one frozen page');
    eq((await h.db.all("SELECT key FROM idempotency_keys WHERE account_id=? AND scope='exam-result'", [s.id])).length, 1, 'one result row');
    const both = await Promise.all([present(s.jar, s.exam.id, q1.id, image), present(s.jar, s.exam.id, q1.id, image), present(s.jar, s.exam.id, q1.id, image)]);
    await until(async () => (await storedResult(s.exam.id)).handwriting.pages[q1.id].state === 'resolved', 'the page to resolve');
    const settled = (await read(s.jar, s.exam.id)).data.result;
    eq([both.map(r => r.status), both.filter(r => r.data.attempted).length, callsFor(label) - before, settled.handwriting.pages[q1.id].attempts, lineOf(settled, q1).correct],
      [[200, 200, 200], 1, 1, 1, true], `three simultaneous requests for one frozen page: one attempt reserved, one provider call, one mark [${EVIDENCE}]`);
    eq((await events(s.id, 'graded-attempt')).filter(e => e.entityId === q1.id).length, 1, 'and one graded attempt');
  }

  // ══ 10 · A read already paid for is reused, not paid for twice ═════════════
  {
    const s = await sitting(1);
    const [q1] = s.qs;
    const label = rightAnswer(q1.payload);
    const image = picture(label, 'ok', 'p');
    const before = callsFor(label);
    eq([(await transcribe(s.jar, image)).status, callsFor(label) - before], [200, 1], 'the student had this exact page read during the paper (one provider call) and then left the answer unconfirmed');
    await finish(s.jar, s.exam.id, { ink: { [q1.id]: digestOf(image) }, reason: 'student' });
    const reused = await present(s.jar, s.exam.id, q1.id, image);
    eq([reused.data.attempted, reused.data.result.handwriting.pages[q1.id].reused, lineOf(reused.data.result, q1).correct, callsFor(label) - before],
      [true, true, true, 1], `after the paper closes the kept read of the unchanged picture is reused: still one provider call for the answer [${EVIDENCE}]`);
    paidPerAnswer.readThenUnconfirmed = callsFor(label) - before;
  }

  // ══ 11 · A structured question: one part pending, its siblings untouched ═══
  {
    let s = null, sq = null, part = null;
    for (let tries = 0; tries < 6 && !part; tries++) {
      s = await sitting(1);
      sq = s.paper.questions.find(q => q.payload.multipart);
      part = (sq?.payload.parts || []).find(p => !['mcq', 'multi-mcq', 'working'].includes(p.answerType) && rightAnswer(p) !== null) || null;
    }
    ok(!!part, 'a structured question with a written part the oracle can answer was issued');
    const key = `${sq.id}::${part.key}`;
    const sibling = sq.payload.parts.find(p => p.key !== part.key && rightAnswer(p) !== null);
    const image = picture(rightAnswer(part), 'ok', 'q');
    const frozen = (await finish(s.jar, s.exam.id, { answers: sibling ? { [`${sq.id}::${sibling.key}`]: rightAnswer(sibling) } : {}, ink: { [key]: digestOf(image) }, reason: 'student' })).data;
    const before = lineOf(frozen, sq);
    eq([before.pending, before.parts.find(p => p.key === part.key).pending, before.parts.filter(p => p.pending).length, frozen.pendingMarks],
      [true, true, 1, Number(part.marks)], 'one part of a structured question is pending; the question says so and the others are marked');
    const done = (await present(s.jar, s.exam.id, key, image)).data.result;
    const after = lineOf(done, sq);
    eq([after.pending, after.parts.find(p => p.key === part.key).correct, after.parts.find(p => p.key === part.key).awarded, after.awarded - before.awarded, done.score - frozen.score],
      [undefined, true, Number(part.marks), Number(part.marks), Number(part.marks)], 'reading it marks that part and adds exactly its marks to the question and the paper');
    eq([after.parts.filter(p => p.key !== part.key), others(done, sq.id), frozenFacts(done), sumAwarded(done)],
      [before.parts.filter(p => p.key !== part.key), others(frozen, sq.id), frozenFacts(frozen), done.score], 'its sibling parts, every other line and the frozen submission are unchanged');
  }

  // ══ 12 · Never presented: after the window it is a person's, never a blank ═
  {
    const s = await sitting(1);
    const [q1] = s.qs;
    const label = rightAnswer(q1.payload);
    const image = picture(label, 'ok', 'r');
    const before = callsFor(label);
    const frozen = (await finish(s.jar, s.exam.id, { ink: { [q1.id]: digestOf(image) }, reason: 'student' })).data;
    skew += HANDWRITING_RECOVERY_WINDOW_MS + 60000;
    await h.db.run('DELETE FROM rate_limits');
    const login = await h.request('/v1/account/login', { method: 'POST', jar: s.jar, body: { email: `exam.ink.${students}@example.test`, password: 'correct-horse-battery', deviceId: `exam-ink-ipad-${students}` } });
    ok(login.status === 200 || login.status === 201, `a week later the student signs in again (${login.status})`);
    const lateRead = (await read(s.jar, s.exam.id)).data.result;
    eq([lateRead.handwriting.pages[q1.id].state, lateRead.handwriting.pages[q1.id].reason, lineOf(lateRead, q1).pending, lateRead.provisional, lateRead.score],
      ['needs-review', 'window-closed', true, true, frozen.score], 'a page nobody presented inside the recovery window is left for an authorised person: still pending, still preserved, never scored as empty');
    const tooLate = await present(s.jar, s.exam.id, q1.id, image);
    eq([tooLate.status, tooLate.data.attempted, callsFor(label) - before], [200, false, 0], 'and automation sends nothing for it any more');
  }

  // ══ 13 · "Needs review" is not a dead end: the student's own Retry checking ═
  {
    const s = await sitting(1);
    const [q1] = s.qs;
    const label = rightAnswer(q1.payload);
    const image = picture(label, 'doubt', 's');
    const before = callsFor(label);
    provider.doubting.add(label);
    const frozen = (await finish(s.jar, s.exam.id, { ink: { [q1.id]: digestOf(image) }, reason: 'student' })).data;
    const auto = await present(s.jar, s.exam.id, q1.id, image);
    const doubted = auto.data.result.handwriting.pages[q1.id];
    const autoCalls = callsFor(label) - before;
    eq([auto.data.attempted, doubted.state, doubted.reason, doubted.attempts, doubted.triesLeft, doubted.canRetry, doubted.retryAt - doubted.lastAttemptAt, lineOf(auto.data.result, q1).pending],
      [true, 'needs-review', 'uncertain', 1, HANDWRITING_MAX_ATTEMPTS - 1, true, HANDWRITING_BACKOFF_MS[1], true],
      'the one automatic read was uncertain: the answer needs review, and the page says how many tries are left and when the next is allowed');
    ok(autoCalls >= 1 && autoCalls <= 2, `that automatic read operation made ${autoCalls} provider call(s) [${EVIDENCE}]`);
    const early = await Promise.all([present(s.jar, s.exam.id, q1.id, image, true), present(s.jar, s.exam.id, q1.id, image, true)]);
    eq([early.map(r => r.data.attempted), early[0].data.retryAt, callsFor(label) - before, (await storedResult(s.exam.id)).handwriting.pages[q1.id].attempts],
      [[false, false], doubted.retryAt, autoCalls, 1], 'Retry checking before the stated time starts nothing, uses no try, and says when it is allowed');
    skew += HANDWRITING_BACKOFF_MS[1] + 1000;
    provider.doubting.delete(label);
    const changed = await present(s.jar, s.exam.id, q1.id, picture(label, 'ok', 't'), true);
    eq([changed.status, changed.data.error.code, callsFor(label) - before, (await storedResult(s.exam.id)).handwriting.pages[q1.id].attempts],
      [409, 'EXAM_HANDWRITING_CHANGED', autoCalls, 1], 'a retry with a changed picture is refused: no read, no try used, no mathematical edit possible');
    eq([(await present(s.jar, s.exam.id, q1.id, image)).data.attempted, callsFor(label) - before], [false, autoCalls], 'and a request that is not the student\'s Retry still starts nothing');
    const taps = await Promise.all([present(s.jar, s.exam.id, q1.id, image, true), present(s.jar, s.exam.id, q1.id, image, true)]);
    await until(async () => (await storedResult(s.exam.id)).handwriting.pages[q1.id].state === 'resolved', 'the retried page to resolve');
    const done = (await read(s.jar, s.exam.id)).data.result;
    eq([taps.map(r => r.status), taps.filter(r => r.data.attempted).length, callsFor(label) - before - autoCalls, done.handwriting.pages[q1.id].attempts, done.handwriting.pages[q1.id].state, lineOf(done, q1).correct, lineOf(done, q1).given],
      [[200, 200], 1, 1, 2, 'resolved', true, label],
      `a double tap on Retry checking with the frozen picture is one try and one provider call, and the answer is marked by the engine [${EVIDENCE}]`);
    eq([others(done, q1.id), frozenFacts(done), (await events(s.id, 'graded-attempt')).filter(e => e.entityId === q1.id).length],
      [others(frozen, q1.id), frozenFacts(frozen), 1], 'on the frozen submission, with one graded attempt');
    paidPerAnswer.retryFromNeedsReview = `${autoCalls}+1`;
  }

  ok(provider.total > 0, 'the stand-in reader was the only reader reached');
} finally {
  Date.now = realNow;
  for (const go of provider.held.values()) go();
  await h.close();
  await closeStore();
  if (pg) await pg.scratchDb.drop();
  await new Promise(resolve => fake.close(resolve));
  rmSync(scratch, { recursive: true, force: true });
  for (const name of vars) { if (previous[name] === undefined) delete process.env[name]; else process.env[name] = previous[name]; }
}
console.log(`provider calls per handwritten exam answer [${EVIDENCE}]: read before the deadline ${paidPerAnswer.readBeforeDeadline} · unread at the deadline ${paidPerAnswer.unreadAtDeadline} · slow provider ${paidPerAnswer.slowProvider} · after one timeout ${paidPerAnswer.afterOneTimeout} · after a capacity refusal ${paidPerAnswer.afterCapacityRefusal} · read, left unconfirmed, then closed ${paidPerAnswer.readThenUnconfirmed} · uncertain automatic read then Retry checking ${paidPerAnswer.retryFromNeedsReview}`);
console.log(`EXAM HANDWRITING: PASS — ${count}/${count} checks — unread handwriting is frozen, pending and read at most a bounded number of times on a real Pri ${engine} server with a synthetic reader.`);
console.log('engine: ' + engine);
