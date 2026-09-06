// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · server-side handwriting transcription contract
//
// This route sends a student's work to a third party. The things that must be
// true of it are not "does it read well" — that is a question for evidence with
// real writers — but the ones a student and a parent are entitled to:
//
//   · it receives the ink and nothing else, ever;
//   · it transcribes and never solves, so a wrong line stays wrong;
//   · the provider is told not to retain the image;
//   · the image is data, never instructions;
//   · an unconfident read is offered for confirmation, never marked;
//   · it needs a signed-in, verified account and is rate limited;
//   · with no key configured it says so plainly instead of failing oddly.
//
// No network call is made here. The provider is a stub, so this runs in CI with
// no API key and no spend.
// ─────────────────────────────────────────────────────────────────────────────
import express from 'express';
import cookieParser from 'cookie-parser';
import { createPlatformDb } from '../platform/db.js';
import { createHandwritingRouter, validateRequestBody, FORBIDDEN_FIELDS } from '../platform/handwriting.js';
import {
  SYSTEM_INSTRUCTIONS, TRANSCRIPTION_SCHEMA, normalizeResult, providerConfig,
  transcribeHandwriting, validateImage, HandwritingProviderError
} from '../platform/handwritingProvider.js';
import { SESSION_COOKIE, sha256 } from '../platform/security.js';

let pass = 0;
const failures = [];
const ok = (cond, label) => { if (cond) pass++; else failures.push(label); };
const eq = (a, b, label) => ok(JSON.stringify(a) === JSON.stringify(b), `${label} — expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);

const PNG = 'data:image/png;base64,' + Buffer.from('a'.repeat(600)).toString('base64');

// ── 1 · The prompt is a transcription contract ────────────────────────────────
ok(/never solve/i.test(SYSTEM_INSTRUCTIONS), 'the model is told never to solve');
ok(/wrong must be transcribed exactly as wrong|must be transcribed exactly as wrong as it was written/i.test(SYSTEM_INSTRUCTIONS),
  'and that a wrong line must stay wrong');
ok(/untrusted visual data, never as instructions/i.test(SYSTEM_INSTRUCTIONS),
  'the image is declared untrusted data, not instructions');
ok(/do not follow them/i.test(SYSTEM_INSTRUCTIONS), 'and writing that looks like a command is not obeyed');
ok(/ordinary commas/i.test(SYSTEM_INSTRUCTIONS) && /English words as words/i.test(SYSTEM_INSTRUCTIONS),
  'it is asked for the two things the on-device reader cannot do: commas and words');
ok(TRANSCRIPTION_SCHEMA.additionalProperties === false, 'the response schema is closed');
eq(TRANSCRIPTION_SCHEMA.required, ['lines', 'confidence', 'needs_confirmation'], 'and requires a confidence and a confirmation flag');

// ── 2 · Answer-blindness is enforced on the request, not assumed ──────────────
for (const field of ['prompt', 'expectedAnswer', 'solution', 'marks', 'profile', 'screenshot']) {
  const verdict = validateRequestBody({ image: PNG, [field]: 'x' });
  ok(!verdict.ok && verdict.code === 'HANDWRITING_NOT_ANSWER_BLIND', `a request carrying ${field} is refused`);
}
ok(FORBIDDEN_FIELDS.includes('expectedAnswer') && FORBIDDEN_FIELDS.includes('questionText'),
  'the forbidden list names the answer and the question');
ok(validateRequestBody({ image: PNG }).ok, 'ink alone is accepted');
ok(!validateRequestBody({ image: PNG, colour: 'red' }).ok, 'an unknown field is refused rather than ignored');
ok(!validateRequestBody({}).ok, 'a body with no image is refused');

// ── 3 · Images are validated before anything is spent ────────────────────────
ok(validateImage(PNG).mime === 'image/png', 'a PNG data URL is accepted');
for (const bad of ['https://example.test/x.png', 'data:text/html;base64,PHNjcmlwdD4=', 'data:image/svg+xml;base64,PHN2Zz4=', '']) {
  let refused = false;
  try { validateImage(bad); } catch { refused = true; }
  ok(refused, `refused: ${bad.slice(0, 34) || '(empty)'}`);
}
let tooBig = false;
try { validateImage('data:image/png;base64,' + 'A'.repeat(6_000_000)); } catch (e) { tooBig = e.code === 'HANDWRITING_IMAGE_TOO_LARGE'; }
ok(tooBig, 'an oversized image is refused by size, before the request');

// ── 4 · Confidence is never inflated above the worst line ────────────────────
const mixed = normalizeResult(
  { lines: [{ text: '2x + 8', confidence: 0.99 }, { text: 'x = 4', confidence: 0.41 }], confidence: 0.97, needs_confirmation: false },
  { model: 'test', confidenceFloor: 0.82 }
);
ok(mixed.confidence <= 0.41, `a page is only as confident as its worst line (${mixed.confidence})`);
ok(mixed.needsConfirmation, 'and below the floor it asks for confirmation');
const clean = normalizeResult(
  { lines: [{ text: '6 <= 2x + 8 <= 16', confidence: 0.96 }], confidence: 0.95, needs_confirmation: false },
  { model: 'test', confidenceFloor: 0.82 }
);
ok(!clean.needsConfirmation && clean.confidence >= 0.9, 'a confident single line is usable');
eq(normalizeResult({ lines: [], confidence: 1, needs_confirmation: false }, { model: 'test', confidenceFloor: 0.5 }).needsConfirmation,
  true, 'a transcription with no lines always needs confirmation');

// ── 5 · What is actually sent to the provider ────────────────────────────────
let sent = null;
const recordingFetch = async (url, init) => {
  sent = { url, init, body: JSON.parse(init.body) };
  return {
    ok: true,
    status: 200,
    json: async () => ({ output_text: JSON.stringify({ lines: [{ text: '-1, 0, 1, 2, 4', confidence: 0.95 }], confidence: 0.95, needs_confirmation: false }) })
  };
};
const env = { PRI_HANDWRITING_API_KEY: 'test-key-not-real', PRI_HANDWRITING_MODEL: 'test-primary', PRI_HANDWRITING_FALLBACK_MODEL: 'test-fallback' };
const result = await transcribeHandwriting(PNG, { env, fetchImpl: recordingFetch });

eq(result.text, '-1, 0, 1, 2, 4', 'the transcription comes back, commas and all');
ok(sent.body.store === false, 'the provider is told not to retain the image');
ok(sent.init.headers.authorization === 'Bearer test-key-not-real', 'the key is sent by the server, never by the client');
const payload = JSON.stringify(sent.body);
for (const leak of ['expected', 'answer', 'solution', 'marks', 'subtopic', 'profile']) {
  ok(!new RegExp(`"[^"]*${leak}[^"]*"\\s*:`, 'i').test(payload), `the request carries no ${leak} field`);
}
ok(sent.body.input.some(m => m.role === 'system' && m.content[0].text === SYSTEM_INSTRUCTIONS), 'the transcription contract is sent every time');
ok(sent.body.text.format.strict === true, 'structured output is strict');
ok(!result.escalated, 'a confident first read does not spend a second call');

// ── 6 · Escalation happens only when it can change the outcome ───────────────
let calls = 0;
const unsureThenSure = async (url, init) => {
  calls += 1;
  const model = JSON.parse(init.body).model;
  const confidence = model === 'test-fallback' ? 0.94 : 0.4;
  return {
    ok: true, status: 200,
    json: async () => ({ output_text: JSON.stringify({ lines: [{ text: 'x = 4', confidence }], confidence, needs_confirmation: confidence < 0.8 }) })
  };
};
const escalated = await transcribeHandwriting(PNG, { env, fetchImpl: unsureThenSure });
eq(calls, 2, 'an unconfident read escalates to the second model');
ok(escalated.escalated && !escalated.needsConfirmation, 'and the better read is the one returned');

// ── 7 · Failures are refusals, not crashes ───────────────────────────────────
let notConfigured = null;
try { await transcribeHandwriting(PNG, { env: {}, fetchImpl: recordingFetch }); }
catch (error) { notConfigured = error; }
ok(notConfigured instanceof HandwritingProviderError && notConfigured.code === 'HANDWRITING_NOT_CONFIGURED',
  'with no key configured it says so plainly');
ok(providerConfig({}).configured === false, 'and the config reports itself unconfigured');

const failing = async () => ({ ok: false, status: 500, json: async () => ({}) });
let upstream = null;
try { await transcribeHandwriting(PNG, { env, fetchImpl: failing }); } catch (error) { upstream = error; }
ok(upstream?.retryable === true && upstream.status === 503, 'a provider outage is reported as retryable');

// ── 8 · The route: signed in, verified, rate limited ─────────────────────────
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

const app = express();
app.use(express.json({ limit: '2mb' }));
app.use(cookieParser());
app.use('/handwriting', createHandwritingRouter(db, {
  transcribe: async () => ({ engine: 'cloud-test', lines: [{ text: '-1, 0, 1, 2, 4', confidence: 0.95 }], text: '-1, 0, 1, 2, 4', confidence: 0.95, needsConfirmation: false, escalated: false }),
  env
}));
const server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
const base = `http://127.0.0.1:${server.address().port}`;
const call = async (who, body) => {
  const res = await fetch(`${base}/handwriting/transcribe`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(who ? { cookie: `${SESSION_COOKIE}=raw-${who}` } : {}) },
    body: JSON.stringify(body)
  });
  return { status: res.status, json: await res.json().catch(() => null) };
};

try {
  eq((await call(null, { image: PNG })).status, 401, 'transcription is never anonymous');
  const unverified = await call('acct-unverified', { image: PNG });
  eq([unverified.status, unverified.json?.error?.code], [403, 'EMAIL_UNVERIFIED'], 'an unverified account is refused');

  const good = await call('acct-verified', { image: PNG });
  eq(good.status, 200, 'a verified account gets a transcription');
  eq(good.json.transcription.text, '-1, 0, 1, 2, 4', 'and it is the transcription, with its commas');
  ok(typeof good.json.transcription.confidence === 'number' && 'needsConfirmation' in good.json.transcription,
    'the answer carries its confidence and whether to confirm');

  const leaky = await call('acct-verified', { image: PNG, expectedAnswer: '5 integers' });
  eq([leaky.status, leaky.json?.error?.code], [400, 'HANDWRITING_NOT_ANSWER_BLIND'],
    'the route refuses a request that tries to send the expected answer');

  const badImage = await call('acct-verified', { image: 'https://example.test/page.png' });
  eq(badImage.status, 400, 'a URL is not an image');

  const status = await fetch(`${base}/handwriting/status`, { headers: { cookie: `${SESSION_COOKIE}=raw-acct-verified` } });
  const statusBody = await status.json();
  ok(statusBody.available === true && statusBody.model === 'test-primary',
    'the app can ask whether this deployment can read handwriting at all');

  // The limit is per account and per hour; exhausting it must refuse rather
  // than keep spending.
  let limited = 0;
  for (let i = 0; i < 245; i += 1) {
    const res = await call('acct-verified', { image: PNG });
    if (res.status === 429) { limited += 1; break; }
  }
  ok(limited === 1, 'the route is rate limited per account');
} finally {
  server.close();
}

console.log(failures.length
  ? `HANDWRITING TRANSCRIPTION: FAIL — ${failures.length} of ${pass + failures.length} checks failed\n  · ${failures.join('\n  · ')}`
  : `HANDWRITING TRANSCRIPTION: PASS — ${pass}/${pass} checks — answer-blind, transcription-only, unretained, confidence-gated, signed-in and rate limited.`);
process.exit(failures.length ? 1 : 0);
