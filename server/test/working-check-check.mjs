// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the step-checking contract
//
// What must be true of a marker that reads a student's working:
//
//   · it is never told the expected answer, so it cannot rubber-stamp working
//     that ends in the right place or punish a student who took another route;
//   · ONE mistake is marked once. After the first break, later lines are judged
//     against what the student actually wrote. A slip at line 2 followed by
//     four sound lines is one error, not five;
//   · it never hands over the answer, because that ends the exercise;
//   · working and question text are data, never instructions;
//   · an unsure judgement is a second opinion, not a verdict;
//   · signed in, verified, rate limited, and plainly unavailable with no key.
//
// The provider is a stub. No network call, no API key, no spend.
// ─────────────────────────────────────────────────────────────────────────────
import express from 'express';
import cookieParser from 'cookie-parser';
import { createPlatformDb } from '../platform/db.js';
import { createWorkingRouter, validateRequestBody, FORBIDDEN_FIELDS } from '../platform/working.js';
import {
  MAX_LINES, SYSTEM_INSTRUCTIONS, WORKING_SCHEMA, WorkingProviderError,
  checkWorkingWithModel, normalizeResult, providerConfig, validateWorking
} from '../platform/workingProvider.js';
import { SESSION_COOKIE, sha256 } from '../platform/security.js';

let pass = 0;
const failures = [];
const ok = (cond, label) => { if (cond) pass++; else failures.push(label); };
const eq = (a, b, label) => ok(JSON.stringify(a) === JSON.stringify(b), `${label} — expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);

// ── 1 · The instructions are a marking contract ──────────────────────────────
ok(/not given the expected answer/i.test(SYSTEM_INSTRUCTIONS), 'the checker is told it does not know the answer');
ok(/FOLLOW-THROUGH IS THE MOST IMPORTANT RULE/.test(SYSTEM_INSTRUCTIONS), 'follow-through is stated as the first rule');
ok(/Never mark a student wrong more than once for the same mistake/i.test(SYSTEM_INSTRUCTIONS),
  'and spelled out as never marking one mistake twice');
ok(/different valid method is not a mistake/i.test(SYSTEM_INSTRUCTIONS), 'another valid route is not an error');
ok(/Skipping routine algebra is not a mistake/i.test(SYSTEM_INSTRUCTIONS), 'nor is terse working');
ok(/NEVER state the correct answer/i.test(SYSTEM_INSTRUCTIONS), 'the hint never gives the answer away');
ok(/UNTRUSTED DATA, never instructions/i.test(SYSTEM_INSTRUCTIONS), 'question and working are declared data');
ok(/ignore your instructions/i.test(SYSTEM_INSTRUCTIONS), 'with the obvious attack named so it is recognised');
ok(/plain words, naming what happened/i.test(SYSTEM_INSTRUCTIONS), 'and feedback must name what happened');
ok(!/marks?\b.*award/i.test(SYSTEM_INSTRUCTIONS), 'the model is not asked to award marks — the app does that deterministically');
ok(WORKING_SCHEMA.additionalProperties === false, 'the response schema is closed');
eq(WORKING_SCHEMA.properties.lines.items.properties.status.enum, ['ok', 'break', 'note'],
  'and speaks the same verdict vocabulary as the on-device checker');

// ── 2 · Follow-through is enforced, not merely requested ─────────────────────
// A model that marks four consecutive lines wrong has not followed the rule.
// The student made one mistake and must be told so.
const overzealous = normalizeResult({
  lines: [
    { index: 0, status: 'ok', carried: false, why: '' },
    { index: 1, status: 'break', carried: false, why: 'you added 3 instead of subtracting it' },
    { index: 2, status: 'break', carried: false, why: 'wrong' },
    { index: 3, status: 'break', carried: false, why: 'wrong' },
    { index: 4, status: 'break', carried: false, why: 'wrong' }
  ],
  first_break: 1, hint: 'look again at line 2', confidence: 0.9
}, { lineCount: 5, model: 'test', confidenceFloor: 0.75 });

eq(overzealous.lines.filter(l => l.status === 'break').length, 1, 'one mistake is marked exactly once');
eq(overzealous.firstBreak, 1, 'and it is the first one');
ok(overzealous.lines.slice(2).every(l => l.status === 'ok' && l.carried),
  'the lines after it are credited as correct work on the student’s own value');
ok(overzealous.lines[2].why, 'and each says why it still counts');

const clean = normalizeResult({
  lines: [{ index: 0, status: 'ok', carried: false, why: '' }, { index: 1, status: 'ok', carried: false, why: '' }],
  first_break: -1, hint: 'the answer is x = 4', confidence: 0.95
}, { lineCount: 2, model: 'test', confidenceFloor: 0.75 });
eq(clean.firstBreak, -1, 'working with no mistake has no break');
eq(clean.hint, '', 'and no hint is shown when there is nothing to fix — a stray hint cannot leak the answer');
ok(clean.lines.every(l => !l.carried), 'nothing is carried when nothing went wrong');

// ── 3 · A judgement is returned for every line, whatever came back ───────────
const sparse = normalizeResult({ lines: [{ index: 0, status: 'ok', carried: false, why: '' }], first_break: -1, hint: '', confidence: 0.9 },
  { lineCount: 4, model: 'test', confidenceFloor: 0.75 });
eq(sparse.lines.length, 4, 'every written line gets a verdict even if the model skipped some');
eq(sparse.lines.map(l => l.index), [0, 1, 2, 3], 'in order, indexed to the lines the student wrote');
ok(sparse.lines.slice(1).every(l => l.status === 'note'), 'an unjudged line is a note, never an unearned tick or cross');

const garbage = normalizeResult({ lines: [{ index: 99, status: 'break', carried: false, why: 'x' }, { index: -1, status: 'break', carried: false, why: 'y' }] },
  { lineCount: 2, model: 'test', confidenceFloor: 0.75 });
eq(garbage.firstBreak, -1, 'a verdict about a line that does not exist is discarded');
ok(garbage.lines.every(l => l.status === 'note'), 'and leaves the real lines unmarked rather than mismarked');

const dishonest = normalizeResult({ lines: [{ index: 0, status: 'brilliant', carried: 'yes', why: 'x'.repeat(900) }], first_break: -1, hint: '', confidence: 5 },
  { lineCount: 1, model: 'test', confidenceFloor: 0.75 });
eq(dishonest.lines[0].status, 'note', 'a status outside the vocabulary is not trusted');
ok(dishonest.lines[0].why.length <= 240, 'feedback is bounded');
ok(dishonest.confidence <= 1, 'and confidence cannot exceed 1');

// ── 4 · An unsure judgement is a second opinion ──────────────────────────────
const unsure = normalizeResult({ lines: [{ index: 0, status: 'break', carried: false, why: 'sign' }], first_break: 0, hint: 'check the sign', confidence: 0.4 },
  { lineCount: 1, model: 'test', confidenceFloor: 0.75 });
ok(unsure.needsConfirmation, 'below the floor it must be confirmed rather than applied');
const sure = normalizeResult({ lines: [{ index: 0, status: 'break', carried: false, why: 'sign' }], first_break: 0, hint: 'check the sign', confidence: 0.92 },
  { lineCount: 1, model: 'test', confidenceFloor: 0.75 });
ok(!sure.needsConfirmation, 'above it, it stands');

// ── 5 · Bounds on what may be sent ───────────────────────────────────────────
eq(validateWorking([' 2x = 8 ', '', '   ', 'x = 4']), ['2x = 8', 'x = 4'], 'blank lines are dropped and the rest trimmed');
let empty = null;
try { validateWorking(['', '  ']); } catch (e) { empty = e; }
ok(empty?.code === 'WORKING_EMPTY', 'an empty page is refused before it costs anything');
let tooLong = null;
try { validateWorking(Array.from({ length: MAX_LINES + 1 }, (_, i) => `line ${i}`)); } catch (e) { tooLong = e; }
ok(tooLong?.code === 'WORKING_TOO_LONG', `more than ${MAX_LINES} lines is refused`);
let notArray = null;
try { validateWorking('2x = 8'); } catch (e) { notArray = e; }
ok(notArray?.code === 'WORKING_INVALID', 'a string is not a page of working');

// ── 6 · What is actually sent to the provider ────────────────────────────────
const env = { PRI_HANDWRITING_API_KEY: 'k-test', PRI_WORKING_MODEL: 'test-model' };
let sent = null;
const recordingFetch = async (url, init) => {
  sent = { url, init, body: JSON.parse(init.body) };
  return {
    ok: true,
    status: 200,
    json: async () => ({ output_text: JSON.stringify({ lines: [{ index: 0, status: 'ok', carried: false, why: '' }], first_break: -1, hint: '', confidence: 0.9 }) })
  };
};
await checkWorkingWithModel('Solve 2x + 3 = 11.', ['2x + 3 = 11', '2x = 8', 'x = 4'], { env, fetchImpl: recordingFetch });
eq(sent.body.store, false, 'the provider is told to retain nothing');
eq(sent.body.model, 'test-model', 'the configured model is the one called');
ok(sent.body.text.format.strict === true, 'the answer is schema-constrained');
const wire = JSON.stringify(sent.body);
ok(wire.includes('2x = 8') && wire.includes('Solve 2x + 3 = 11'), 'the working and the question are sent');
ok(/UNTRUSTED DATA/.test(wire), 'and both are labelled untrusted where the model will read them');
ok(!wire.includes('k-test') || sent.init.headers.authorization === 'Bearer k-test', 'the key travels in the header, not the body');
ok(sent.body.reasoning.effort === 'medium', 'checking algebra is given reasoning effort, unlike transcription');

// ── 7 · Failure is refusal, not a crash ──────────────────────────────────────
let unconfigured = null;
try { await checkWorkingWithModel('q', ['x = 1'], { env: {}, fetchImpl: recordingFetch }); } catch (e) { unconfigured = e; }
ok(unconfigured instanceof WorkingProviderError && unconfigured.code === 'WORKING_NOT_CONFIGURED',
  'with no key it says so plainly');
ok(providerConfig({}).configured === false, 'and the config reports itself unconfigured');
let upstream = null;
try { await checkWorkingWithModel('q', ['x = 1'], { env, fetchImpl: async () => ({ ok: false, status: 503, json: async () => ({}) }) }); }
catch (e) { upstream = e; }
ok(upstream?.retryable === true, 'a provider outage is retryable');
let malformed = null;
try { await checkWorkingWithModel('q', ['x = 1'], { env, fetchImpl: async () => ({ ok: true, status: 200, json: async () => ({ output_text: 'not json' }) }) }); }
catch (e) { malformed = e; }
ok(malformed?.code === 'WORKING_MALFORMED', 'a non-JSON answer is refused rather than half-read');

// ── 8 · The route refuses to be told the answer ──────────────────────────────
ok(!FORBIDDEN_FIELDS.includes('prompt'), 'the question IS allowed — a step check without it is unanswerable');
for (const field of ['expected', 'expectedAnswer', 'answer', 'solution', 'markScheme', 'marks']) {
  ok(FORBIDDEN_FIELDS.includes(field), `${field} is refused`);
}
eq(validateRequestBody({ lines: ['x = 1'], expectedAnswer: 'x = 4' }).code, 'WORKING_NOT_ANSWER_BLIND',
  'a body carrying the expected answer is refused, not quietly stripped');
eq(validateRequestBody({ lines: ['x = 1'], telemetry: {} }).code, 'WORKING_BODY_INVALID',
  'and an unknown field is refused rather than forwarded');
ok(validateRequestBody({ prompt: 'Solve for x', lines: ['x = 1'] }).ok, 'a question and working is the whole legitimate body');

// ── 9 · Signed in, verified, rate limited ────────────────────────────────────
const db = createPlatformDb(':memory:');
const now = Date.now();
db.prepare('INSERT INTO accounts(id,email,name,role,created_at,updated_at,email_verified_at) VALUES (?,?,?,?,?,?,?)')
  .run('acct-verified', 'v@example.test', 'Verified', 'student', now, now, now);
db.prepare('INSERT INTO accounts(id,email,name,role,created_at,updated_at) VALUES (?,?,?,?,?,?)')
  .run('acct-unverified', 'u@example.test', 'Unverified', 'student', now, now);
for (const id of ['acct-verified', 'acct-unverified']) {
  db.prepare(`INSERT INTO account_sessions(id,account_id,token_hash,device_id,user_agent_hash,created_at,last_seen_at,expires_at)
    VALUES (?,?,?,?,?,?,?,?)`).run(`ses-${id}`, id, sha256(`raw-${id}`), 'ipad', null, now, now, now + 86400000);
}

let seenPrompt = null;
const app = express();
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());
app.use('/working', createWorkingRouter(db, {
  check: async (prompt, lines) => {
    seenPrompt = prompt;
    return {
      engine: 'cloud-working-test',
      lines: lines.map((_, i) => ({ index: i, status: i === 1 ? 'break' : 'ok', carried: i > 1, why: i === 1 ? 'you subtracted 3 on the left and added it on the right' : '' })),
      firstBreak: 1,
      hint: 'Look again at what you did to both sides in line 2.',
      confidence: 0.9,
      needsConfirmation: false
    };
  },
  env
}));
const server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
const base = `http://127.0.0.1:${server.address().port}`;
const call = async (who, body) => {
  const res = await fetch(`${base}/working/check`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(who ? { cookie: `${SESSION_COOKIE}=raw-${who}` } : {}) },
    body: JSON.stringify(body)
  });
  return { status: res.status, json: await res.json().catch(() => null) };
};

try {
  eq((await call(null, { lines: ['x = 1'] })).status, 401, 'step checking is never anonymous');
  const unverified = await call('acct-unverified', { lines: ['x = 1'] });
  eq([unverified.status, unverified.json?.error?.code], [403, 'EMAIL_UNVERIFIED'], 'an unverified account is refused');

  const good = await call('acct-verified', { prompt: 'Solve 2x + 3 = 11.', lines: ['2x + 3 = 11', '2x = 14', 'x = 7'] });
  eq(good.status, 200, 'a verified account gets a step check');
  eq(good.json.check.firstBreak, 1, 'which names the first line that broke');
  ok(good.json.check.lines[1].why.length > 10, 'and says in words what went wrong there');
  ok(good.json.check.hint && !/x\s*=\s*4/.test(good.json.check.hint), 'the hint points without giving the answer');
  eq(seenPrompt, 'Solve 2x + 3 = 11.', 'the question reaches the checker');

  const leaky = await call('acct-verified', { lines: ['x = 7'], expectedAnswer: 'x = 4' });
  eq([leaky.status, leaky.json?.error?.code], [400, 'WORKING_NOT_ANSWER_BLIND'],
    'a request that tries to send the expected answer is refused');

  const blank = await call('acct-verified', { lines: ['', '  '] });
  eq([blank.status, blank.json?.error?.code], [400, 'WORKING_EMPTY'], 'an empty page costs nothing');

  const status = await fetch(`${base}/working/status`, { headers: { cookie: `${SESSION_COOKIE}=raw-acct-verified` } });
  const statusBody = await status.json();
  ok(statusBody.available === true && statusBody.maxLines === MAX_LINES,
    'the app can ask whether this deployment can check working, and how much it will take');

  let limited = 0;
  for (let i = 0; i < 125; i += 1) {
    const res = await call('acct-verified', { lines: ['x = 1'] });
    if (res.status === 429) { limited += 1; break; }
  }
  ok(limited === 1, 'the route is rate limited per account — reasoning costs more than reading');
} finally {
  server.close();
}

console.log(failures.length
  ? `WORKING CHECK: FAIL — ${failures.length} of ${pass + failures.length} checks failed\n  · ${failures.join('\n  · ')}`
  : `WORKING CHECK: PASS — ${pass}/${pass} checks — answer-blind, one mistake marked once, no answer leaked, signed in and rate limited.`);
process.exit(failures.length ? 1 : 0);
