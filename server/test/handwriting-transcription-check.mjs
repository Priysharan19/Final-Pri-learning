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
import './support/hermetic.mjs';
import express from 'express';
import cookieParser from 'cookie-parser';
import { createPlatformDb } from '../platform/db.js';
import { createHandwritingRouter, validateRequestBody, FORBIDDEN_FIELDS } from '../platform/handwriting.js';
import {
  SYSTEM_INSTRUCTIONS, TRANSCRIPTION_SCHEMA, normalizeResult, providerConfig,
  providerStaticStatus, probeHandwritingProvider, transcribeHandwriting,
  validateImage, HandwritingProviderError
} from '../platform/handwritingProvider.js';
import { SESSION_COOKIE, sha256 } from '../platform/security.js';
import { serverReleaseIdentity } from '../platform/releaseIdentity.js';

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
  { lines: [{ text: '2x + 8', confidence: 0.99, uncertain: false, doubt: '', gap_before: false }, { text: 'x = 4', confidence: 0.41, uncertain: false, doubt: '', gap_before: false }], confidence: 0.97, needs_confirmation: false },
  { model: 'test', confidenceFloor: 0.82 }
);
ok(mixed.confidence <= 0.41, `a page is only as confident as its worst line (${mixed.confidence})`);
ok(mixed.needsConfirmation, 'and below the floor it asks for confirmation');
eq([mixed.confidenceFloor, mixed.providerNeedsConfirmation], [0.82, false],
  'normalization preserves the configured floor and distinguishes floor doubt from provider-declared ambiguity');
const providerAmbiguous = normalizeResult(
  { lines: [{ text: 'x = 4', confidence: 0.96, uncertain: false, doubt: '', gap_before: false }], confidence: 0.96, needs_confirmation: true },
  { model: 'test', confidenceFloor: 0.9 }
);
eq([providerAmbiguous.needsConfirmation, providerAmbiguous.providerNeedsConfirmation, providerAmbiguous.confidenceFloor], [true, true, 0.9],
  'provider-declared ambiguity remains explicit even when all line confidences exceed the configured floor');
const clean = normalizeResult(
  { lines: [{ text: '6 <= 2x + 8 <= 16', confidence: 0.96, uncertain: false, doubt: '', gap_before: false }], confidence: 0.95, needs_confirmation: false },
  { model: 'test', confidenceFloor: 0.82 }
);
ok(!clean.needsConfirmation && clean.confidence >= 0.9, 'a confident single line is usable');
// ── per-line doubt: reported, never settled silently, never repaired ─────────
// The owner's page (2026-10-10): "(x+3)² ⩾ 0" written with a slanted bar. A
// symbol the reader cannot tell is a doubt about THAT line, handed to the
// student — the text is passed on exactly as read.
{
  const doubted = normalizeResult({
    confidence: 0.95, needs_confirmation: false,
    lines: [
      { text: 'f(x) = (x+3)^2 + 6', latex: '', confidence: 0.97, uncertain: false, doubt: '', gap_before: true },
      { text: '(x+3)^2 > 0', latex: '', confidence: 0.95, uncertain: true, doubt: '>= or >', gap_before: false },
      { text: 'least value => 6.', latex: '', confidence: 0.98, uncertain: false, doubt: 'ignored when not uncertain', gap_before: false }
    ]
  }, { model: 'test', confidenceFloor: 0.82 });
  eq(doubted.lines.map(l => [l.text, l.uncertain, l.doubt, l.gapBefore]),
    [['f(x) = (x+3)^2 + 6', false, null, true], ['(x+3)^2 > 0', true, '>= or >', false], ['least value => 6.', false, null, false]],
    'each line carries its own doubt and layout gap; a doubt is kept only for a line marked uncertain');
  eq(doubted.text, 'f(x) = (x+3)^2 + 6\n(x+3)^2 > 0\nleast value => 6.', 'and no line is rewritten: a doubted ">" stays ">", a sentence keeps its full stop');
  eq([doubted.providerNeedsConfirmation, doubted.needsConfirmation], [true, true], 'a line the reader doubts makes the page one to confirm, even when the page-level flag was not raised');
  const legacy = normalizeResult({ confidence: 0.95, needs_confirmation: false, lines: [{ text: '7', latex: '', confidence: 0.95 }] }, { model: 'test', confidenceFloor: 0.82 });
  // #196 D2: this used to read a line with no `uncertain` flag as "no doubt".
  // The strict schema requires the flag, so a reply without it has broken its
  // own contract — and a broken contract fails closed, as a doubt.
  eq([legacy.lines[0].uncertain, legacy.lines[0].doubt, legacy.lines[0].gapBefore, legacy.needsConfirmation], [true, null, false, true],
    'a line missing its required `uncertain` flag is a doubt to confirm, never "no doubt"');
  const line = TRANSCRIPTION_SCHEMA.properties.lines.items;
  eq([...line.required].sort(), ['confidence', 'doubt', 'gap_before', 'latex', 'text', 'uncertain'], 'the strict schema requires every per-line field');
  ok(line.additionalProperties === false && line.properties.uncertain.type === 'boolean' && line.properties.doubt.maxLength === 120 && line.properties.gap_before.type === 'boolean', 'and nothing beyond them');
  ok(/bar under it/.test(SYSTEM_INSTRUCTIONS) && /x and n/.test(SYSTEM_INSTRUCTIONS) && /do not settle it silently/.test(SYSTEM_INSTRUCTIONS), 'the instruction reads relation and look-alike symbols from their strokes and reports a doubt');
  ok(/Never choose a symbol because it would make the mathematics true/.test(SYSTEM_INSTRUCTIONS) && /You do not know the question/.test(SYSTEM_INSTRUCTIONS), 'and never decides a symbol by what would be mathematically right');
  ok(!/expected|answer key|solution|rubric|marks? scheme/i.test(SYSTEM_INSTRUCTIONS), 'the instruction names no answer, solution or rubric');
}

eq(normalizeResult({ lines: [], confidence: 1, needs_confirmation: false }, { model: 'test', confidenceFloor: 0.5 }).needsConfirmation,
  true, 'a transcription with no lines always needs confirmation');

// ── 4c · A reply that breaks its own schema fails closed (#196 D1/D2) ───────
// The schema is the contract the provider's strict mode is asked to keep. The
// server does not rely on that: a custom PRI_HANDWRITING_ENDPOINT, or a
// provider that drifts, can return anything. Whatever comes back, a reply
// outside the contract is never returned as a confident reading.
{
  const provider = await import('../platform/handwritingProvider.js');
  const LIMIT = TRANSCRIPTION_SCHEMA.properties.lines.maxItems;
  const FLOOR = { model: 'test', confidenceFloor: 0.82 };
  const goodLine = (text = 'x = 4') => ({ text, latex: '', confidence: 0.97, uncertain: false, doubt: '', gap_before: false });
  const goodReply = (lines = [goodLine()]) => ({ lines, confidence: 0.97, needs_confirmation: false });
  const settle = reply => { try { return { result: normalizeResult(reply, FLOOR) }; } catch (error) { return { error }; } };

  // The positive control: a conforming confident reply IS usable, so every
  // refusal below is caused by the one thing each case breaks.
  const control = settle(goodReply());
  eq([control.error?.code ?? null, control.result?.needsConfirmation, control.result?.providerNeedsConfirmation], [null, false, false],
    'a reply that keeps the schema is a confident reading (the control every case below departs from)');
  eq(provider.MAX_TRANSCRIPTION_LINES, LIMIT, 'the line limit the server enforces is the schema\'s own constant, not a second copy');

  // D1 — more lines than the schema allows.
  const atLimit = settle(goodReply(Array.from({ length: LIMIT }, (_, i) => goodLine(`x = ${i}`))));
  eq([atLimit.error?.code ?? null, atLimit.result?.lines.length, atLimit.result?.needsConfirmation], [null, LIMIT, false],
    `exactly ${LIMIT} lines is inside the contract and reads normally`);
  for (const count of [LIMIT + 1, 500]) {
    const over = settle(goodReply(Array.from({ length: count }, (_, i) => goodLine(`x = ${i}`))));
    ok(!over.result, `${count} lines is never returned as a reading, confident or otherwise`);
    // 422 and not retryable (#196 review N4): the same page would be read the
    // same way again, so the device must not resend it and pay again by itself.
    eq([over.error?.code, over.error?.status, over.error?.retryable], ['HANDWRITING_MALFORMED', 422, false],
      `${count} lines is refused through the existing malformed-reply code, as a refusal not to resend by itself`);
  }
  for (const [label, bad] of [['a number', 7], ['an object', { toString: () => 'x = 4' }], ['missing', undefined], ['null', null]]) {
    const reply = goodReply([{ ...goodLine(), text: bad }]);
    eq(settle(reply).error?.code, 'HANDWRITING_MALFORMED', `a line whose text is ${label} is refused, not coerced or silently dropped`);
  }
  eq(settle(goodReply(['x = 4'])).error?.code, 'HANDWRITING_MALFORMED', 'a line that is not an object is refused');
  eq([settle(goodReply([{ ...goodLine(), text: 7 }])).error?.status, settle(goodReply([{ ...goodLine(), text: 7 }])).error?.retryable], [502, true],
    'a garbled line is a 502 the reader may answer differently next time, so it stays retryable');

  // #196 review N1 — a line is never cut short. Truncated text would be marked
  // as though the student had written it, so a line past the schema's
  // maxLength is a malformed reply, like a page past maxItems.
  eq([provider.MAX_TRANSCRIPTION_LINES, provider.MAX_LINE_TEXT_CHARS, provider.MAX_LINE_LATEX_CHARS, provider.MAX_LINE_DOUBT_CHARS], [40, 400, 600, 120],
    'the pinned limits: 40 lines, 400 characters of text, 600 of latex, 120 of doubt');
  const lineSchema = TRANSCRIPTION_SCHEMA.properties.lines.items.properties;
  eq([LIMIT, lineSchema.text.maxLength, lineSchema.latex.maxLength, lineSchema.doubt.maxLength],
    [provider.MAX_TRANSCRIPTION_LINES, provider.MAX_LINE_TEXT_CHARS, provider.MAX_LINE_LATEX_CHARS, provider.MAX_LINE_DOUBT_CHARS],
    'and the schema states exactly the limits the server enforces (one constant each, no second copy)');
  const TEXT_MAX = lineSchema.text.maxLength;
  const atText = settle(goodReply([goodLine('x'.repeat(TEXT_MAX))]));
  eq([atText.error?.code ?? null, atText.result?.lines[0].text.length, atText.result?.needsConfirmation], [null, TEXT_MAX, false],
    `a line of exactly ${TEXT_MAX} characters reads in full`);
  for (const length of [TEXT_MAX + 1, 506]) {
    const long = settle(goodReply([goodLine('2'.repeat(length))]));
    ok(!long.result, `a line of ${length} characters is never returned — not whole, and not cut to ${TEXT_MAX}`);
    eq([long.error?.code, long.error?.status, long.error?.retryable], ['HANDWRITING_MALFORMED', 422, false],
      `a line of ${length} characters is refused as malformed, not to be resent by itself`);
  }
  const LATEX_MAX = lineSchema.latex.maxLength;
  const atLatex = settle(goodReply([{ ...goodLine(), latex: 'x'.repeat(LATEX_MAX) }])).result;
  eq([atLatex?.lines[0].latex?.length, atLatex?.needsConfirmation], [LATEX_MAX, false], `display latex of exactly ${LATEX_MAX} characters is kept`);
  const longLatex = settle(goodReply([{ ...goodLine('x = 4'), latex: '\\frac{1}{2}'.repeat(80) }])).result;
  eq([longLatex?.lines[0].latex, longLatex?.lines[0].text, longLatex?.lines[0].confidence], [null, 'x = 4', 0.97],
    'display latex past its limit is dropped, never cut into broken mathematics; the line keeps its text');

  // D2 — a doubt flag that is not exactly false is a doubt.
  for (const [label, value] of [['the string "true"', 'true'], ['the string "false"', 'false'], ['1', 1], ['0', 0], ['null', null], ['missing', undefined]]) {
    const page = { ...goodReply() };
    if (value === undefined) delete page.needs_confirmation; else page.needs_confirmation = value;
    const r = settle(page).result;
    eq([r?.needsConfirmation, r?.providerNeedsConfirmation], [true, true], `needs_confirmation ${label} is a doubt, never "no doubt"`);
    const line = goodLine();
    if (value === undefined) delete line.uncertain; else line.uncertain = value;
    const l = settle(goodReply([line])).result;
    eq([l?.lines[0].uncertain, l?.needsConfirmation, l?.providerNeedsConfirmation], [true, true, true], `a line's uncertain ${label} is a doubt on that line and the page`);
  }

  // D2 — a confidence that is not a finite number in [0, 1] is low confidence.
  for (const [label, value] of [['the string "0.99"', '0.99'], ['NaN', NaN], ['Infinity', Infinity], ['1.5', 1.5], ['-0.1', -0.1], ['null', null], ['missing', undefined], ['a boolean', true]]) {
    const page = { ...goodReply() };
    if (value === undefined) delete page.confidence; else page.confidence = value;
    const r = settle(page).result;
    ok(r?.needsConfirmation === true && r.confidence < FLOOR.confidenceFloor, `a page confidence of ${label} is below the floor and needs confirmation (${r?.confidence})`);
    const line = goodLine();
    if (value === undefined) delete line.confidence; else line.confidence = value;
    const l = settle(goodReply([line])).result;
    ok(l?.needsConfirmation === true && l.confidence < FLOOR.confidenceFloor && l.lines[0].confidence === 0,
      `a line confidence of ${label} counts as 0, so the page needs confirmation`);
  }
  eq([settle(goodReply()).result.confidence, settle({ ...goodReply(), confidence: 1 }).result.confidence, settle({ ...goodReply([{ ...goodLine(), confidence: 0 }]) }).result.confidence],
    [0.97, 0.97, 0], 'genuine values at and inside the bounds are kept exactly; nothing here moves the floor');
}

// ── 5 · What is actually sent to the provider ────────────────────────────────
let sent = null;
const recordingFetch = async (url, init) => {
  sent = { url, init, body: JSON.parse(init.body) };
  return {
    ok: true,
    status: 200,
    json: async () => ({ output_text: JSON.stringify({ lines: [{ text: '-1, 0, 1, 2, 4', confidence: 0.95, uncertain: false, doubt: '', gap_before: false }], confidence: 0.95, needs_confirmation: false }) })
  };
};
const env = { PRI_HANDWRITING_API_KEY: 'test-key-not-real', PRI_HANDWRITING_MODEL: 'test-primary', PRI_HANDWRITING_FALLBACK_MODEL: 'test-fallback', PRI_PAID_CALLS_PER_HOUR: '10000', PRI_PAID_CALLS_PER_DAY: '100000', PRI_RELEASE_SHA: '1111111111111111111111111111111111111111' };
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
    json: async () => ({ output_text: JSON.stringify({ lines: [{ text: 'x = 4', confidence, uncertain: false, doubt: '', gap_before: false }], confidence, needs_confirmation: confidence < 0.8 }) })
  };
};
const escalated = await transcribeHandwriting(PNG, { env, fetchImpl: unsureThenSure });
eq(calls, 2, 'an unconfident read escalates to the second model');
ok(escalated.escalated && !escalated.needsConfirmation, 'and the better read is the one returned');

// ── 6b · A malformed reply on either model (#196 review N2) ──────────────────
// Modelled on unsureThenSure: each case scripts the primary and the fallback.
{
  const conforming = (text, confidence) => ({ text, latex: '', confidence, uncertain: false, doubt: '', gap_before: false });
  const tooLong = { lines: Array.from({ length: 41 }, (_, i) => conforming(`x = ${i}`, 0.97)), confidence: 0.97, needs_confirmation: false };
  const scripted = (byModel) => {
    const seen = [];
    const fetchImpl = async (_url, init) => {
      const model = JSON.parse(init.body).model;
      seen.push(model);
      const reply = byModel[model];
      if (reply === 'hang') {
        return new Promise((_resolve, reject) => {
          const fail = () => reject(new DOMException('Aborted', 'AbortError'));
          if (init.signal.aborted) fail(); else init.signal.addEventListener('abort', fail, { once: true });
        });
      }
      return { ok: true, status: 200, json: async () => ({ output_text: JSON.stringify(reply) }) };
    };
    return { seen, fetchImpl };
  };
  const attempt = async (byModel, extra = {}) => {
    const { seen, fetchImpl } = scripted(byModel);
    let authorised = 0;
    try {
      const result = await transcribeHandwriting(PNG, { env: { ...env, ...extra }, fetchImpl, authorizeFallback: () => { authorised += 1; return null; } });
      return { result, seen, authorised };
    } catch (error) { return { error, seen, authorised }; }
  };

  const primaryMalformed = await attempt({ 'test-primary': tooLong, 'test-fallback': { lines: [conforming('x = 4', 0.97)], confidence: 0.97, needs_confirmation: false } });
  eq([primaryMalformed.error?.code, primaryMalformed.error?.status, !!primaryMalformed.result], ['HANDWRITING_MALFORMED', 422, false],
    'a malformed primary reply is the refusal, not a reading');
  eq([primaryMalformed.seen, primaryMalformed.authorised], [['test-primary'], 0],
    'and no fallback is asked for or sent: a malformed reply is not an unsure one');

  const doubtedThenMalformed = await attempt({
    'test-primary': { lines: [conforming('x = 4', 0.4)], confidence: 0.4, needs_confirmation: true },
    'test-fallback': tooLong
  });
  eq(doubtedThenMalformed.seen, ['test-primary', 'test-fallback'], 'a doubted primary escalates to the fallback');
  eq([doubtedThenMalformed.result?.text, doubtedThenMalformed.result?.needsConfirmation, doubtedThenMalformed.result?.escalated,
    doubtedThenMalformed.result?.fallbackAttempted, doubtedThenMalformed.result?.fallbackFailureCode],
  ['x = 4', true, false, true, 'HANDWRITING_MALFORMED'],
  'a malformed fallback keeps the doubted primary reading — still to be confirmed — and names the fallback failure');

  const rescueMalformed = await attempt({ 'test-primary': 'hang', 'test-fallback': tooLong }, { PRI_HANDWRITING_TIMEOUT_MS: '5000' });
  eq(rescueMalformed.seen, ['test-primary', 'test-fallback'], 'a primary timeout tries the fallback once');
  eq([rescueMalformed.error?.code, !!rescueMalformed.result], ['HANDWRITING_MALFORMED', false],
    'and a malformed fallback after a timeout is a refusal: there is no reading to fall back to');
}

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

// ── 8 · Provider configuration, readiness and failure taxonomy ──────────────
const invalidEndpoint = providerStaticStatus({
  ...env,
  NODE_ENV: 'production',
  PRI_HANDWRITING_ENDPOINT: 'http://api.openai.com/v1/responses'
});
ok(invalidEndpoint.configured && !invalidEndpoint.configValid && invalidEndpoint.problems.includes('endpoint-not-https'),
  'production refuses a configured non-HTTPS handwriting endpoint');

const invalidModel = providerStaticStatus({ ...env, PRI_HANDWRITING_MODEL: 'bad model with spaces' });
ok(!invalidModel.configValid && invalidModel.problems.includes('primary-model-invalid'),
  'an invalid model identifier does not count as usable configuration');

const probeReady = await probeHandwritingProvider({
  env,
  cache: false,
  fetchImpl: async () => ({ ok: true, status: 200 })
});
ok(probeReady.usable === true && probeReady.degraded === false && probeReady.fallbackUsable === true,
  'readiness probes both configured models without sending student ink');

let probeCalls = 0;
const probeLimited = await probeHandwritingProvider({
  env,
  cache: false,
  fetchImpl: async () => {
    probeCalls += 1;
    return probeCalls === 1 ? { ok: false, status: 429 } : { ok: true, status: 200 };
  }
});
ok(probeLimited.usable === false && probeLimited.degraded === true && probeLimited.failureCode === 'HANDWRITING_PROVIDER_429',
  'a provider 429 is degraded, not falsely ready');

const providerFailure = async (status) => ({ ok: false, status, json: async () => ({}) });
for (const [statusCode, expectedCode] of [[401, 'HANDWRITING_PROVIDER_AUTH'], [429, 'HANDWRITING_PROVIDER_429'], [500, 'HANDWRITING_PROVIDER_5XX']]) {
  let error = null;
  try { await transcribeHandwriting(PNG, { env, fetchImpl: () => providerFailure(statusCode) }); } catch (e) { error = e; }
  eq(error?.code, expectedCode, `provider HTTP ${statusCode} keeps its own coded failure`);
}

let unreachable = null;
try { await transcribeHandwriting(PNG, { env, fetchImpl: async () => { throw new Error('network down'); } }); }
catch (e) { unreachable = e; }
eq(unreachable?.code, 'HANDWRITING_UNREACHABLE', 'a transport failure is distinct from provider HTTP failures');

let timedOut = null;
try {
  await transcribeHandwriting(PNG, {
    env: { ...env, PRI_HANDWRITING_TIMEOUT_MS: '2000' },
    fetchImpl: async (_url, init) => new Promise((_resolve, reject) => {
      const fail = () => reject(new DOMException('Aborted', 'AbortError'));
      if (init.signal.aborted) fail();
      else init.signal.addEventListener('abort', fail, { once: true });
    })
  });
} catch (e) { timedOut = e; }
eq(timedOut?.code, 'HANDWRITING_TIMEOUT', 'provider timeout is distinct from cancellation and unreachable transport');

// ── Reading budget (browser run, 2026-10: a 20 s primary timeout failed a read
// that succeeded on the automatic retry) ──────────────────────────────────────
eq(providerConfig({ PRI_HANDWRITING_API_KEY: 'k' }).timeoutMs, 45000, 'the default reading budget is 45 s');
eq(providerConfig({ PRI_HANDWRITING_API_KEY: 'k', PRI_HANDWRITING_TIMEOUT_MS: '90000' }).timeoutMs, 60000, 'and it is capped at 60 s');
eq(providerConfig({ PRI_HANDWRITING_API_KEY: 'k' }).reasoningEffort, 'low', 'reasoning effort stays low unless a deployment opts in');
eq(providerConfig({ PRI_HANDWRITING_API_KEY: 'k', PRI_HANDWRITING_REASONING_EFFORT: 'minimal' }).reasoningEffort, 'minimal', 'minimal reasoning effort can be opted into');
ok(providerStaticStatus({ PRI_HANDWRITING_API_KEY: 'k', PRI_HANDWRITING_REASONING_EFFORT: 'turbo' }).problems.includes('reasoning-effort-invalid'),
  'an unknown reasoning effort is a configuration problem, not silently sent');
{
  const seen = [];
  const hangsThenAnswers = async (_url, init) => {
    const body = JSON.parse(init.body);
    seen.push({ model: body.model, effort: body.reasoning?.effort });
    if (body.model === 'test-primary') {
      return new Promise((_resolve, reject) => {
        const fail = () => reject(new DOMException('Aborted', 'AbortError'));
        if (init.signal.aborted) fail(); else init.signal.addEventListener('abort', fail, { once: true });
      });
    }
    return { ok: true, status: 200, json: async () => ({ output_text: JSON.stringify({ lines: [{ text: 'x = 4', confidence: 0.97, uncertain: false, doubt: '', gap_before: false }], confidence: 0.97, needs_confirmation: false }) }) };
  };
  const started = Date.now();
  const rescued = await transcribeHandwriting(PNG, {
    env: { ...env, PRI_HANDWRITING_TIMEOUT_MS: '2000', PRI_HANDWRITING_REASONING_EFFORT: 'minimal' },
    fetchImpl: hangsThenAnswers
  });
  eq(seen.map(c => c.model), ['test-primary', 'test-fallback'], 'a primary timeout tries the fallback model once');
  eq(seen.map(c => c.effort), ['minimal', 'minimal'], 'with the configured reasoning effort');
  eq([rescued.text, rescued.model, rescued.primaryFailureCode], ['x = 4', 'test-fallback', 'HANDWRITING_TIMEOUT'], 'and its reading is returned');
  ok(Date.now() - started < 2000 + 400, 'inside the one reading budget');

  seen.length = 0;
  let refusedTimeout = null;
  try {
    await transcribeHandwriting(PNG, {
      env: { ...env, PRI_HANDWRITING_TIMEOUT_MS: '2000' },
      fetchImpl: hangsThenAnswers,
      authorizeFallback: () => ({ code: 'PAID_CAPACITY_REACHED' })
    });
  } catch (e) { refusedTimeout = e; }
  eq([refusedTimeout?.code, seen.length], ['HANDWRITING_TIMEOUT', 1], 'a spend refusal stops the timeout fallback and nothing more is sent');
}

let malformedEnvelope = null;
try {
  await transcribeHandwriting(PNG, {
    env,
    fetchImpl: async () => ({ ok: true, status: 200, json: async () => { throw new SyntaxError('bad json'); } })
  });
} catch (e) { malformedEnvelope = e; }
eq(malformedEnvelope?.code, 'HANDWRITING_PROVIDER_MALFORMED_RESPONSE', 'malformed provider JSON is coded');

let emptyEnvelope = null;
try {
  await transcribeHandwriting(PNG, {
    env,
    fetchImpl: async () => ({ ok: true, status: 200, json: async () => ({}) })
  });
} catch (e) { emptyEnvelope = e; }
eq(emptyEnvelope?.code, 'HANDWRITING_EMPTY', 'an empty provider envelope is coded');

const alreadyCancelled = new AbortController();
alreadyCancelled.abort();
let cancelled = null;
try {
  await transcribeHandwriting(PNG, {
    env,
    signal: alreadyCancelled.signal,
    fetchImpl: async (_url, init) => {
      if (init.signal.aborted) throw new DOMException('Aborted', 'AbortError');
      return recordingFetch(_url, init);
    }
  });
} catch (e) { cancelled = e; }
eq(cancelled?.code, 'HANDWRITING_CANCELLED', 'cancellation is distinct from timeout and outage');

let fallbackCalls = 0;
const fallbackFailureFetch = async (_url, init) => {
  fallbackCalls += 1;
  if (fallbackCalls === 2) return { ok: false, status: 500, json: async () => ({}) };
  return {
    ok: true, status: 200,
    json: async () => ({ output_text: JSON.stringify({
      lines: [{ text: 'x = ?', confidence: 0.4, uncertain: false, doubt: '', gap_before: false }],
      confidence: 0.4,
      needs_confirmation: true
    }) })
  };
};
const fallbackFailure = await transcribeHandwriting(PNG, { env, fetchImpl: fallbackFailureFetch });
ok(fallbackFailure.fallbackAttempted === true
  && fallbackFailure.fallbackFailureCode === 'HANDWRITING_PROVIDER_5XX'
  && fallbackFailure.escalated === false,
  'a failed fallback is preserved in safe diagnostics while the primary low-confidence read survives');

// ── 8b · The fallback model is its own paid call ────────────────────────────
let budgetedFetches = 0;
const alwaysUnsure = async (_url, init) => {
  budgetedFetches += 1;
  return {
    ok: true, status: 200,
    json: async () => ({ output_text: JSON.stringify({ lines: [{ text: 'x = ?', confidence: 0.4, uncertain: false, doubt: '', gap_before: false }], confidence: 0.4, needs_confirmation: true }) })
  };
};
let fallbackRefused = null;
let authorizeCalls = 0;
try {
  await transcribeHandwriting(PNG, {
    env,
    fetchImpl: alwaysUnsure,
    authorizeFallback: () => { authorizeCalls += 1; return { status: 503, code: 'PAID_CAPACITY_REACHED', message: 'limit', retryable: true, resetAt: Date.now() + 1000 }; }
  });
} catch (e) { fallbackRefused = e; }
eq([budgetedFetches, authorizeCalls], [1, 1], 'a refused fallback is never sent: one provider call, one budget check');
ok(fallbackRefused?.code === 'PAID_CAPACITY_REACHED' && fallbackRefused?.paidCallVerdict?.code === 'PAID_CAPACITY_REACHED',
  'and the refusal carries the coded budget verdict');
budgetedFetches = 0;
authorizeCalls = 0;
await transcribeHandwriting(PNG, { env, fetchImpl: alwaysUnsure, authorizeFallback: () => { authorizeCalls += 1; return null; } });
eq([budgetedFetches, authorizeCalls], [2, 1], 'an authorised fallback is counted once and sent once');
budgetedFetches = 0;
authorizeCalls = 0;
await transcribeHandwriting(PNG, { env, fetchImpl: recordingFetch, authorizeFallback: () => { authorizeCalls += 1; return null; } });
eq(authorizeCalls, 0, 'a confident first read never asks the budget for a fallback');

// ── 8c · The probe override can never carry the key to a foreign host ───────
for (const [override, label] of [
  ['http://api.openai.com/v1/models', 'plain HTTP'],
  ['https://attacker.example/v1/models', 'a foreign host'],
  ['https://user:pw@api.openai.com/v1/models', 'embedded credentials'],
  ['not a url', 'a malformed URL']
]) {
  const st = providerStaticStatus({ ...env, PRI_HANDWRITING_PROBE_ENDPOINT: override });
  ok(!st.configValid && st.problems.includes('probe-endpoint-invalid'), `a probe override to ${label} is invalid configuration`);
  const urls = [];
  const probed = await probeHandwritingProvider({
    env: { ...env, PRI_HANDWRITING_PROBE_ENDPOINT: override },
    cache: false,
    fetchImpl: async (url) => { urls.push(url); return { ok: true, status: 200 }; }
  });
  ok(urls.length === 0 && probed.usable === false, `and no request (and no key) is sent to ${label}`);
}
const customEnv = { ...env, PRI_HANDWRITING_ENDPOINT: 'https://vision.example/v1/read' };
const sameHostProbeUrls = [];
const sameHost = await probeHandwritingProvider({
  env: { ...customEnv, PRI_HANDWRITING_PROBE_ENDPOINT: 'https://vision.example/v1/health' },
  cache: false,
  fetchImpl: async (url) => { sameHostProbeUrls.push(url); return { ok: true, status: 200 }; }
});
ok(sameHost.usable === true && sameHostProbeUrls.every(u => new URL(u).host === 'vision.example'),
  'an HTTPS probe override on the configured provider host is allowed');
const openAiProbe = providerStaticStatus({ ...customEnv, PRI_HANDWRITING_PROBE_ENDPOINT: 'https://api.openai.com/v1/models' });
ok(openAiProbe.configValid, 'an HTTPS probe override on api.openai.com is allowed');
ok(!providerStaticStatus({ ...customEnv, PRI_HANDWRITING_PROBE_ENDPOINT: 'https://other.example/v1/health' }).configValid,
  'a probe override on any other host is refused even with a custom provider');

// ── 9 · The route: signed in, verified, rate limited ─────────────────────────
const db = createPlatformDb(':memory:');
const now = Date.now();
db.prepare('INSERT INTO accounts(id,email,name,role,created_at,updated_at,email_verified_at) VALUES (?,?,?,?,?,?,?)')
  .run('acct-verified', 'v@example.test', 'Verified', 'student', now, now, now);
db.prepare('INSERT INTO accounts(id,email,name,role,created_at,updated_at) VALUES (?,?,?,?,?,?)')
  .run('acct-unverified', 'u@example.test', 'Unverified', 'student', now, now);
for (const id of ['acct-status-limit', 'acct-status-misc']) {
  db.prepare('INSERT INTO accounts(id,email,name,role,created_at,updated_at,email_verified_at) VALUES (?,?,?,?,?,?,?)')
    .run(id, `${id}@example.test`, id, 'student', now, now, now);
}
for (const id of ['acct-verified', 'acct-unverified', 'acct-status-limit', 'acct-status-misc']) {
  db.prepare(`INSERT INTO account_sessions(id,account_id,token_hash,device_id,user_agent_hash,created_at,last_seen_at,expires_at)
    VALUES (?,?,?,?,?,?,?,?)`).run(`ses-${id}`, id, sha256(`raw-${id}`), 'ipad', null, now, now, now + 86400000);
}

const app = express();
app.use(express.json({ limit: '2mb' }));
app.use(cookieParser());
app.use('/handwriting', createHandwritingRouter(db, {
  transcribe: async () => ({ engine: 'cloud-test', lines: [{ text: '-1, 0, 1, 2, 4', confidence: 0.95 }], text: '-1, 0, 1, 2, 4', confidence: 0.95, confidenceFloor: 0.9, providerNeedsConfirmation: false, needsConfirmation: false, escalated: false, fallbackAttempted: false, fallbackFailureCode: null, latencyMs: 17 }),
  probe: async () => ({ ...providerStaticStatus(env), usable: true, degraded: false, failureCode: null, latencyMs: 7, fallbackUsable: true }),
  env
}));
const noBudgetEnv = { ...env };
delete noBudgetEnv.PRI_PAID_CALLS_PER_HOUR;
delete noBudgetEnv.PRI_PAID_CALLS_PER_DAY;
let noBudgetProbeCalls = 0;
app.use('/handwriting-unbudgeted', createHandwritingRouter(db, {
  probe: async () => { noBudgetProbeCalls += 1; return { ...providerStaticStatus(noBudgetEnv), usable: true }; },
  env: noBudgetEnv
}));
const staleShaEnv = { ...env, PRI_RELEASE_SHA: 'f'.repeat(40) };
app.use('/handwriting-stale-sha', createHandwritingRouter(db, {
  probe: async () => ({ ...providerStaticStatus(env), usable: true, degraded: false, failureCode: null, latencyMs: 7, fallbackUsable: true }),
  env: staleShaEnv
}));
app.use('/handwriting-injected-sha', createHandwritingRouter(db, {
  probe: async () => ({ ...providerStaticStatus(env), usable: true, degraded: false, failureCode: null, latencyMs: 7, fallbackUsable: true }),
  releaseIdentity: () => ({ releaseSha: '2'.repeat(40) }),
  env: staleShaEnv
}));
app.use('/handwriting-probe-throws', createHandwritingRouter(db, {
  probe: async () => { throw new Error('provider exploded'); },
  env
}));
let slowProbeCalls = 0;
app.use('/handwriting-slow-probe', createHandwritingRouter(db, {
  probe: async () => {
    slowProbeCalls += 1;
    await new Promise(resolve => setTimeout(resolve, 150));
    return { ...providerStaticStatus(env), usable: true, degraded: false, failureCode: null, latencyMs: 150, fallbackUsable: true };
  },
  env
}));

// A separate deployment database for the spend ceiling, so the fallback's own
// paid call is counted against a ceiling nothing else has touched.
const budgetDb = createPlatformDb(':memory:');
budgetDb.prepare('INSERT INTO accounts(id,email,name,role,created_at,updated_at,email_verified_at) VALUES (?,?,?,?,?,?,?)')
  .run('acct-budget', 'b@example.test', 'Budget', 'student', now, now, now);
budgetDb.prepare(`INSERT INTO account_sessions(id,account_id,token_hash,device_id,user_agent_hash,created_at,last_seen_at,expires_at)
  VALUES (?,?,?,?,?,?,?,?)`).run('ses-acct-budget', 'acct-budget', sha256('raw-acct-budget'), 'ipad', null, now, now, now + 86400000);
const ceilingEnv = { ...env, PRI_PAID_CALLS_PER_HOUR: '3', PRI_PAID_CALLS_PER_DAY: '100' };
let ceilingFetches = 0;
const budgetApp = express();
budgetApp.use(express.json({ limit: '2mb' }));
budgetApp.use(cookieParser());
budgetApp.use('/handwriting', createHandwritingRouter(budgetDb, {
  transcribe: (image, options) => transcribeHandwriting(image, {
    ...options,
    fetchImpl: async (...args) => { ceilingFetches += 1; return alwaysUnsure(...args); }
  }),
  env: ceilingEnv
}));

const server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
const budgetServer = await new Promise(resolve => { const s = budgetApp.listen(0, '127.0.0.1', () => resolve(s)); });
const budgetBase = `http://127.0.0.1:${budgetServer.address().port}`;
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
  eq([good.json.transcription.confidenceFloor, good.json.transcription.providerNeedsConfirmation], [0.9, false],
    'the route carries the exact provider floor and ambiguity provenance to the client');

  const leaky = await call('acct-verified', { image: PNG, expectedAnswer: '5 integers' });
  eq([leaky.status, leaky.json?.error?.code], [400, 'HANDWRITING_NOT_ANSWER_BLIND'],
    'the route refuses a request that tries to send the expected answer');

  const badImage = await call('acct-verified', { image: 'https://example.test/page.png' });
  eq(badImage.status, 400, 'a URL is not an image');

  const status = await fetch(`${base}/handwriting/status`, { headers: { cookie: `${SESSION_COOKIE}=raw-acct-verified` } });
  const statusBody = await status.json();
  ok(statusBody.available === true && statusBody.usable === true && statusBody.state === 'ready' && statusBody.model === 'test-primary',
    'status says ready only when the configured provider is actually usable');
  eq(statusBody.releaseSha, serverReleaseIdentity().releaseSha, 'status identifies the release with the same resolver /v1/health uses');
  ok(status.headers.get('ratelimit-remaining') !== null, 'status is rate limited per account');

  const statusAs = (path, who = 'acct-status-misc') => fetch(`${base}${path}/status`, { headers: { cookie: `${SESSION_COOKIE}=raw-${who}` } });
  const staleBody = await (await statusAs('/handwriting-stale-sha')).json();
  ok(staleBody.releaseSha !== 'f'.repeat(40) && staleBody.releaseSha === serverReleaseIdentity().releaseSha,
    'a stale PRI_RELEASE_SHA in the route env never outranks the /v1/health identity');
  const injectedBody = await (await statusAs('/handwriting-injected-sha')).json();
  eq(injectedBody.releaseSha, '2'.repeat(40), 'status reports exactly what the release resolver reports, not the raw env value');

  const throwsBody = await (await statusAs('/handwriting-probe-throws')).json();
  ok(throwsBody.usable === false && throwsBody.available === false && throwsBody.state === 'degraded'
    && throwsBody.lastFailureCode === 'HANDWRITING_PROVIDER_PROBE_FAILED',
    'a probe that throws is reported as PROBE_FAILED, never as ready');

  const concurrent = await Promise.all(Array.from({ length: 6 }, () => statusAs('/handwriting-slow-probe').then(r => r.json())));
  eq(slowProbeCalls, 1, 'concurrent status requests share one in-flight provider probe');
  ok(concurrent.every(body => body.state === 'ready'), 'and every caller gets that probe result');
  await statusAs('/handwriting-slow-probe');
  eq(slowProbeCalls, 2, 'once the probe settles, the next status request probes again (the provider cache governs reuse)');

  let statusLimited = null;
  for (let i = 0; i < 125; i += 1) {
    const res = await statusAs('/handwriting', 'acct-status-limit');
    if (res.status === 429) { statusLimited = { i, body: await res.json() }; break; }
    await res.arrayBuffer();
  }
  ok(statusLimited?.body?.error?.code === 'RATE_LIMITED' && statusLimited.i === 120,
    `status refuses past its per-account limit (${statusLimited?.i})`);

  // A different picture each call: the same picture would be read once and
  // then served from memory (recognitionOps.js), spending nothing further.
  let budgetPictures = 0;
  const budgetCall = async () => {
    const res = await fetch(`${budgetBase}/handwriting/transcribe`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: `${SESSION_COOKIE}=raw-acct-budget` },
      body: JSON.stringify({ image: PNG + Buffer.from(`budget-picture-${budgetPictures += 1}`.padEnd(18, '.')).toString('base64') })
    });
    return { status: res.status, json: await res.json().catch(() => null) };
  };
  const firstBudgeted = await budgetCall();
  ok(firstBudgeted.status === 200 && firstBudgeted.json.transcription.fallbackAttempted === true && ceilingFetches === 2,
    'with headroom, primary and fallback are both sent and both counted');
  const secondBudgeted = await budgetCall();
  eq([secondBudgeted.status, secondBudgeted.json?.error?.code, ceilingFetches], [503, 'PAID_CAPACITY_REACHED', 3],
    'with one call left, the primary is sent and the fallback is refused with the coded budget error');
  const thirdBudgeted = await budgetCall();
  eq([thirdBudgeted.status, thirdBudgeted.json?.error?.code, ceilingFetches], [503, 'PAID_CAPACITY_REACHED', 3],
    'with the ceiling spent, nothing is sent: spend never exceeds the ceiling');
  ok(statusBody.configured === true && statusBody.fallbackUsable === true && statusBody.lastLatencyMs === 7,
    'status exposes only safe operational readiness diagnostics');

  const noBudgetStatus = await fetch(`${base}/handwriting-unbudgeted/status`, { headers: { cookie: `${SESSION_COOKIE}=raw-acct-verified` } });
  const noBudgetBody = await noBudgetStatus.json();
  ok(noBudgetBody.configured === true && noBudgetBody.usable === false && noBudgetBody.state === 'unavailable'
    && noBudgetBody.lastFailureCode === 'PAID_CAPACITY_NOT_CONFIGURED',
    'a key without paid-call ceilings is explicitly unavailable, never ready');
  eq(noBudgetProbeCalls, 0, 'status refuses missing spend ceilings before touching the provider');

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
  budgetServer.close();
}

// ── 10 · What the route hands the reader, and what it hands back (#196) ──────
// Reconciliation of the #192 cloud-handwriting authority on current main.
// `questionId` is the one field the route accepts beside the picture: it binds
// the read receipt to an issued question. It must never travel to the reader,
// even when it names a question this account owns and a receipt is minted.
// And the reader's reply is untrusted model output: whatever it adds — a
// verdict, marks, an "answer" — the route returns only the closed
// transcription shape, so nothing a model says can arrive looking like a mark.
{
  const QID = '5e1f0c2a-9b3d-4c7e-8a61-2f4d6b8c0e19';
  db.prepare('INSERT INTO accounts(id,email,name,role,created_at,updated_at,email_verified_at) VALUES (?,?,?,?,?,?,?)')
    .run('acct-boundary', 'boundary@example.test', 'Boundary', 'student', now, now, now);
  db.prepare(`INSERT INTO account_sessions(id,account_id,token_hash,device_id,user_agent_hash,created_at,last_seen_at,expires_at)
    VALUES (?,?,?,?,?,?,?,?)`).run('ses-acct-boundary', 'acct-boundary', sha256('raw-acct-boundary'), 'ipad', null, now, now, now + 86400000);
  // The question was issued to this account, so the route mints a receipt for it.
  db.prepare(`INSERT INTO idempotency_keys(account_id,scope,key,response_json,request_digest,created_at,expires_at)
    VALUES (?,?,?,?,?,?,?)`).run('acct-boundary', 'practice-question', QID, '{}', null, now, now + 86400000);

  const bodies = [];
  let scripted = null;   // a reply to send instead of the hostile one below
  const hostileReader = async (_url, init) => {
    bodies.push(String(init?.body ?? ''));
    if (scripted) return { ok: true, status: 200, json: async () => ({ output_text: JSON.stringify(scripted) }) };
    return {
      ok: true, status: 200,
      json: async () => ({ output_text: JSON.stringify({
        lines: [{ text: 'x = 4', latex: 'x = 4', confidence: 0.97, uncertain: false, doubt: '', gap_before: false,
          correct: true, marks: 5, answer: 'x = 4', verdict: 'right' }],
        confidence: 0.97, needs_confirmation: false,
        correct: true, isCorrect: true, marks: 5, marksEarned: 5, answer: 'x = 4', solution: 'subtract 3, halve', verdict: 'correct'
      }) })
    };
  };
  const boundaryApp = express();
  boundaryApp.use(express.json({ limit: '2mb' }));
  boundaryApp.use(cookieParser());
  boundaryApp.use('/handwriting', createHandwritingRouter(db, {
    env,
    transcribe: (image, options) => transcribeHandwriting(image, { ...options, env, fetchImpl: hostileReader })
  }));
  const boundaryServer = await new Promise(resolve => { const s = boundaryApp.listen(0, '127.0.0.1', () => resolve(s)); });
  const boundaryBase = `http://127.0.0.1:${boundaryServer.address().port}`;
  try {
    const page = PNG + Buffer.from('boundary-page-0001').toString('base64');
    const res = await fetch(`${boundaryBase}/handwriting/transcribe`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: `${SESSION_COOKIE}=raw-acct-boundary` },
      body: JSON.stringify({ image: page, questionId: QID, requestId: 'req-boundary-0001' })
    });
    const json = await res.json().catch(() => null);
    eq(res.status, 200, 'a verified account reading for an issued question is answered');
    ok(typeof json?.receipt === 'string' && json.receipt.startsWith('v1.'), 'and, the question being this account\'s own, a read receipt is minted for it');
    eq(bodies.length, 1, 'exactly one body reached the reader');
    const sent = bodies[0] || '';
    ok(!sent.includes(QID) && !sent.includes(QID.slice(0, 8)), 'the issued question id never travels to the reader, though the route bound a receipt to it');
    ok(!sent.includes('req-boundary-0001'), 'nor does the client request id');
    ok(!/"questionId"|"requestId"/.test(sent), 'the reader body has no slot for either');
    ok(sent.includes(page), 'what the reader received is the picture');

    eq(Object.keys(json?.transcription || {}).sort(),
      ['confidence', 'confidenceFloor', 'engine', 'escalated', 'fallbackAttempted', 'fallbackFailureCode', 'latencyMs', 'lines', 'needsConfirmation', 'providerNeedsConfirmation', 'text'],
      'the route answers with the closed transcription shape, whatever extra the model returned');
    eq(Object.keys(json?.transcription?.lines?.[0] || {}).sort(), ['confidence', 'doubt', 'gapBefore', 'latex', 'text', 'uncertain'],
      'and every line is the closed line shape');
    eq(Object.keys(json || {}).sort(), ['receipt', 'reused', 'transcription'], 'nothing beside the transcription, the receipt and the reuse flag');
    const wireReply = JSON.stringify(json);
    for (const leak of ['"correct"', '"isCorrect"', '"marks"', '"marksEarned"', '"answer"', '"solution"', '"verdict"', 'subtract 3']) {
      ok(!wireReply.includes(leak), `a model-supplied ${leak} never reaches the student's device`);
    }
    eq(json?.transcription?.text, 'x = 4', 'the transcription itself comes through unchanged');

    // #196 D1/D2 through the real route: a reply outside its schema is never
    // served to the device as a confident reading, and none is kept or receipted.
    const post = async (label, body = {}) => {
      const r = await fetch(`${boundaryBase}/handwriting/transcribe`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie: `${SESSION_COOKIE}=raw-acct-boundary` },
        body: JSON.stringify({ image: PNG + Buffer.from(`boundary-${label}`.padEnd(24, '.')).toString('base64'), questionId: QID, ...body })
      });
      return { status: r.status, json: await r.json().catch(() => null) };
    };
    const conforming = { text: 'x = 4', latex: '', confidence: 0.97, uncertain: false, doubt: '', gap_before: false };
    scripted = { lines: Array.from({ length: TRANSCRIPTION_SCHEMA.properties.lines.maxItems + 1 }, (_, i) => ({ ...conforming, text: `x = ${i}` })), confidence: 0.97, needs_confirmation: false };
    const tooMany = await post('too-many-lines');
    eq([tooMany.status, tooMany.json?.error?.code, tooMany.json?.error?.retryable], [422, 'HANDWRITING_MALFORMED', false],
      'over the line limit the route answers the existing coded malformed-reply refusal, as one not to resend by itself');
    scripted = { lines: [{ ...conforming, text: '2'.repeat(TRANSCRIPTION_SCHEMA.properties.lines.items.properties.text.maxLength + 106) }], confidence: 0.99, needs_confirmation: false };
    const tooWide = await post('too-long-line');
    eq([tooWide.status, tooWide.json?.error?.code, tooWide.json?.error?.retryable, !!tooWide.json?.transcription], [422, 'HANDWRITING_MALFORMED', false, false],
      'a line past its length limit reaches the device as the same refusal — never as a confident, shortened line');
    ok(!tooMany.json?.transcription && !tooMany.json?.receipt, 'with no transcription and no read receipt');
    for (const [label, reply] of [
      ['string-doubt', { lines: [conforming], confidence: 0.97, needs_confirmation: 'true' }],
      ['string-uncertain', { lines: [{ ...conforming, uncertain: 'true', doubt: '4 or 9' }], confidence: 0.97, needs_confirmation: false }],
      ['string-confidence', { lines: [{ ...conforming, confidence: '0.99' }], confidence: '0.99', needs_confirmation: false }],
      ['out-of-range', { lines: [{ ...conforming, confidence: 1.5 }], confidence: 1.5, needs_confirmation: false }],
      ['missing-fields', { lines: [{ text: 'x = 4' }] }]
    ]) {
      scripted = reply;
      const r = await post(label);
      eq([r.status, r.json?.transcription?.needsConfirmation], [200, true], `through the route, a reply with ${label} is a reading to confirm, never a confident one`);
    }
    scripted = null;
  } finally {
    await new Promise(resolve => boundaryServer.close(resolve));
  }
}

console.log(failures.length
  ? `HANDWRITING TRANSCRIPTION: FAIL — ${failures.length} of ${pass + failures.length} checks failed\n  · ${failures.join('\n  · ')}`
  : `HANDWRITING TRANSCRIPTION: PASS — ${pass}/${pass} checks — answer-blind, transcription-only, unretained, confidence-gated, signed-in and rate limited.`);
process.exit(failures.length ? 1 : 0);
