// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · one paid read per picture (server/platform/recognitionOps.js)
//
//   node server/test/recognition-dedupe-check.mjs                    (SQLite)
//   node server/test/recognition-dedupe-check.mjs --engine=postgres  (scripts/with-postgres.mjs)
//
// The invariant: an unchanged recognition operation never causes a second paid
// provider call; a changed one always gets a fresh read.
//
// Evidence class: a COUNTING TEST PROVIDER, not the real one. Part 1 drives the
// shipped app (server/app.js → /v1) over a real loopback socket through
// support/app-harness.mjs, with the real provider adapter pointed at a local
// HTTP server that counts every request it receives — so "provider calls" here
// are requests that actually left the adapter. Part 2 hands recognitionOps an
// injected transcriber for what needs no HTTP (what is stored, restart, refunds).
// Nothing here measures reading accuracy, and nothing here is deployed.
// ─────────────────────────────────────────────────────────────────────────────
import { createServer } from 'node:http';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const dir = mkdtempSync(join(tmpdir(), 'pri-recognition-dedupe-'));

// ── The counting provider ────────────────────────────────────────────────────
// A picture is a tagged byte string, so the provider can be told how to behave
// by the picture alone — exactly the only thing the adapter sends it.
const picture = (label, behaviour = 'ok', filler = 'a') =>
  'data:image/png;base64,' + Buffer.from(`PICTURE|${behaviour}|${label}|` + filler.repeat(300)).toString('base64');

const provider = { calls: new Map(), total: 0, held: new Map(), arrivals: new Map(), failedOnce: new Set(), models: [] };
const callsFor = label => provider.calls.get(label) || 0;
function arrived(label) {
  return new Promise((resolve, reject) => {
    if (provider.held.has(label)) return resolve();
    const timer = setTimeout(() => reject(new Error(`provider never received ${label}`)), 8000);
    provider.arrivals.set(label, () => { clearTimeout(timer); resolve(); });
  });
}
function release(label) { const go = provider.held.get(label); provider.held.delete(label); go?.(); }
const reply = (res, body) => {
  res.writeHead(200, { 'content-type': 'application/json' });
  res.end(JSON.stringify({
    model: body.model,
    output_text: JSON.stringify(body.reading),
    usage: { input_tokens: 1000, output_tokens: 60, total_tokens: 1060, output_tokens_details: { reasoning_tokens: 20 }, input_tokens_details: { cached_tokens: 0 } }
  }));
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
    provider.models.push(sent.model);
    const read = { lines: [{ text: label, latex: '', confidence: 0.96 }], confidence: 0.96, needs_confirmation: false };
    const blank = { lines: [], confidence: 0, needs_confirmation: true };
    const unsure = { lines: [{ text: label, latex: '', confidence: 0.4 }], confidence: 0.4, needs_confirmation: true };
    if (behaviour === 'blank') return reply(res, { model: sent.model, reading: blank });
    if (behaviour === 'failonce' && !provider.failedOnce.has(label)) {
      provider.failedOnce.add(label);
      res.writeHead(500, { 'content-type': 'application/json' });
      return res.end('{}');
    }
    if (behaviour === 'hangonce' && !provider.failedOnce.has(label)) return; // never answers: the adapter's own timeout ends it
    if (behaviour === 'fallbackfails') {
      if (sent.model === 'fixture-fallback') { res.writeHead(500, { 'content-type': 'application/json' }); return res.end('{}'); }
      return reply(res, { model: sent.model, reading: unsure });
    }
    if (behaviour === 'hold') {
      provider.held.set(label, () => reply(res, { model: sent.model, reading: read }));
      provider.arrivals.get(label)?.();
      provider.arrivals.delete(label);
      return;
    }
    return reply(res, { model: sent.model, reading: read });
  });
});
await new Promise(resolve => fake.listen(0, '127.0.0.1', resolve));

const vars = ['NODE_ENV', 'PRI_PLATFORM_DB', 'PRI_AUTH_DELIVERY_KEY', 'PRI_PUBLIC_ORIGIN', 'PRI_HANDWRITING_API_KEY',
  'PRI_HANDWRITING_ENDPOINT', 'PRI_HANDWRITING_MODEL', 'PRI_HANDWRITING_FALLBACK_MODEL', 'PRI_HANDWRITING_TIMEOUT_MS',
  'PRI_PAID_CALLS_PER_HOUR', 'PRI_PAID_CALLS_PER_DAY', 'PRI_AI_DAILY_FREE', 'PRI_AI_DAILY_PREMIUM'];
const previous = Object.fromEntries(vars.map(name => [name, process.env[name]]));
Object.assign(process.env, {
  NODE_ENV: 'test', PRI_PLATFORM_DB: join(dir, 'test.sqlite'), PRI_AUTH_DELIVERY_KEY: 'ea'.repeat(32),
  PRI_HANDWRITING_API_KEY: 'local-counting-fixture', PRI_HANDWRITING_ENDPOINT: `http://127.0.0.1:${fake.address().port}/v1/responses`,
  PRI_HANDWRITING_MODEL: 'fixture-primary', PRI_HANDWRITING_FALLBACK_MODEL: 'fixture-fallback', PRI_HANDWRITING_TIMEOUT_MS: '20000',
  PRI_PAID_CALLS_PER_HOUR: '10000', PRI_PAID_CALLS_PER_DAY: '100000'
});
for (const name of ['PRI_PUBLIC_ORIGIN', 'PRI_AI_DAILY_FREE', 'PRI_AI_DAILY_PREMIUM']) delete process.env[name];

const { startApp, registerAccount, verifyEmail, cookieHeader, checks } = await import('./support/app-harness.mjs');
const { requestedEngine } = await import('./support/engine.mjs');
const { decryptDeliveryToken } = await import('../platform/deliveryCrypto.js');
const { sha256 } = await import('../platform/security.js');
const { metrics } = await import('../platform/metrics.js');
const { setLogSink } = await import('../platform/observability.js');
const { HandwritingProviderError } = await import('../platform/handwritingProvider.js');
const { createRecognitionOps, recognitionOpsFor, RECOGNITION_TTL_MS, RECOGNITION_SCOPE, RECOGNITION_MAX_TRANSCRIPT_BYTES } = await import('../platform/recognitionOps.js');
const { createHash } = await import('node:crypto');
const { reservePaidCall, refundPaidCall, consumePaidCall } = await import('../platform/spendCeiling.js');

const c = checks();
const h = await startApp({ engine: requestedEngine() });
const ops = recognitionOpsFor(h.db);
const logged = [];
const previousSink = setLogSink((level, text, line) => { logged.push(line); });

const transcribe = (jar, image) => h.request('/v1/handwriting/transcribe', { method: 'POST', jar, body: { image } });
const recognize = (jar, qid, image, mode = 'ink') => h.request(`/v1/practice/${qid}/recognize`, { method: 'POST', jar, body: { mode, image } });
const issue = jar => h.request('/v1/practice/issue', { method: 'POST', jar, body: { generator: 'c8-linear-equations-both-sides', difficulty: 2, seed: 104729, curriculum: 'in' } });
const bucketCount = async bucket => Number((await h.db.get('SELECT count FROM rate_limits WHERE bucket=?', [bucket]))?.count ?? 0);
const hash = accountId => sha256(String(accountId)).slice(0, 24);
const paid = async () => ({ hour: await bucketCount('paid-provider:hour'), day: await bucketCount('paid-provider:day') });
const allowanceUsed = accountId => bucketCount(`ai-daily:handwriting:${hash(accountId)}`);
const requestsCounted = (accountId, key = 'handwriting-transcribe') => bucketCount(`${key}:${hash(accountId)}`);
const receipts = async accountId => Number((await h.db.get("SELECT COUNT(*) AS n FROM idempotency_keys WHERE account_id=? AND scope='practice-recognition'", [accountId]))?.n);
const resetBudget = () => h.db.run("DELETE FROM rate_limits WHERE bucket LIKE 'paid-provider:%'");
const ceiling = (hour, day) => { process.env.PRI_PAID_CALLS_PER_HOUR = String(hour); process.env.PRI_PAID_CALLS_PER_DAY = String(day); };
let students = 0;
async function student() {
  students += 1;
  // Registration is limited per address per hour; this suite is one address.
  await h.db.run("DELETE FROM rate_limits WHERE bucket LIKE 'register:%'");
  const email = `dedupe.student.${students}@example.test`;
  const account = await registerAccount(h, { email, deviceId: `dedupe-ipad-${students}` });
  if (account.status !== 201) throw new Error(`register: ${account.status} ${account.text}`);
  const verified = await verifyEmail(h, account.account.id);
  if (verified.status !== 200) throw new Error(`verify: ${verified.status}`);
  return { jar: account.jar, id: account.account.id, email };
}
async function until(condition, what) {
  const deadline = Date.now() + 8000;
  while (!(await condition())) {
    if (Date.now() > deadline) throw new Error(`timed out waiting for ${what}`);
    await new Promise(resolve => setTimeout(resolve, 15));
  }
}

try {
  // ══ Part 1 · the shipped app over HTTP, counting provider ══════════════════
  const a = await student();

  // ── 1 · The same picture twice is one call ─────────────────────────────────
  {
    const image = picture('x = 4');
    const before = await paid();
    const first = await transcribe(a.jar, image);
    c.eq(first.status, 200, 'a first read answers 200');
    c.eq(first.data.reused, false, 'and says it was a provider read');
    c.eq(first.data.transcription.text, 'x = 4', 'with the provider transcript');
    const second = await transcribe(a.jar, image);
    c.eq(second.status, 200, 'the same picture again answers 200');
    c.eq(second.data.reused, true, 'and says it was served without a paid call');
    c.deq(second.data.transcription, first.data.transcription, 'with the identical transcript');
    c.eq(callsFor('x = 4'), 1, 'identical image twice → exactly one provider call');
    const after = await paid();
    c.deq([after.hour - before.hour, after.day - before.day], [1, 1], 'one unit of each deployment window was counted, not two');
    c.eq(await allowanceUsed(a.id), 1, 'and one unit of the account daily allowance');
    c.eq(await requestsCounted(a.id), 2, 'both requests still counted against the per-account request rate limit');
    c.ok(!JSON.stringify(second.data).includes('local-counting-fixture'), 'the response carries no credential');
  }

  // ── 2 · Ten at once are one call ───────────────────────────────────────────
  {
    const image = picture('ten at once', 'hold');
    const before = await paid();
    const allowanceBefore = await allowanceUsed(a.id);
    const running = Array.from({ length: 10 }, () => transcribe({ ...a.jar }, image));
    await arrived('ten at once');
    await until(async () => (await requestsCounted(a.id)) >= 12, 'all ten requests to pass the rate limiter');
    await new Promise(resolve => setTimeout(resolve, 150));
    c.eq(ops.stats().inFlight, 1, 'ten concurrent equivalent requests are one read in flight');
    release('ten at once');
    const results = await Promise.all(running);
    c.ok(results.every(r => r.status === 200 && r.data.transcription.text === 'ten at once'), 'all ten are answered with the transcript');
    c.eq(results.filter(r => r.data.reused === false).length, 1, 'exactly one of them was the paid read');
    c.eq(callsFor('ten at once'), 1, '10 concurrent identical → exactly one provider call');
    const after = await paid();
    c.deq([after.hour - before.hour, after.day - before.day], [1, 1], 'one paid unit for all ten');
    c.eq((await allowanceUsed(a.id)) - allowanceBefore, 1, 'one AI-allowance unit for all ten');
  }

  // ── 3 · Two tabs: two sessions of one account ──────────────────────────────
  {
    const tab2 = {};
    const login = await h.request('/v1/account/login', { method: 'POST', jar: tab2, body: { email: a.email, password: 'correct-horse-battery', deviceId: 'dedupe-second-tab' } });
    c.eq(login.status, 200, 'a second session of the same account signs in');
    const image = picture('two tabs');
    const [one, two] = await Promise.all([transcribe(a.jar, image), transcribe(tab2, image)]);
    c.deq([one.status, two.status], [200, 200], 'both tabs are answered');
    const later = await transcribe(tab2, image);
    c.eq(later.data.reused, true, 'the other tab is served from the first tab\'s read afterwards too');
    c.eq(callsFor('two tabs'), 1, 'two sessions of one account, same picture → one provider call');
  }

  // ── 4 · Another account gets its own read ──────────────────────────────────
  const b = await student();
  {
    const image = picture('x = 4');
    const before = callsFor('x = 4');
    const theirs = await transcribe(b.jar, image);
    c.eq(theirs.status, 200, 'a second account reading the same picture is answered');
    c.eq(theirs.data.reused, false, 'by a provider read of its own — nothing is shared across accounts');
    c.eq(callsFor('x = 4') - before, 1, 'same image, second ACCOUNT → its own provider call');
    c.eq(await allowanceUsed(b.id), 1, 'counted against that account\'s own allowance');
    c.eq((await transcribe(b.jar, image)).data.reused, true, 'and then reusable by that account');
  }

  // ── 5 · One changed byte is a new picture ──────────────────────────────────
  {
    const before = provider.total;
    const first = await transcribe(a.jar, picture('one byte', 'ok', 'a'));
    const changed = await transcribe(a.jar, picture('one byte', 'ok', 'b'));
    const sameBytes = Buffer.from(picture('one byte', 'ok', 'a').split(',')[1], 'base64');
    const oneOff = Buffer.from(sameBytes); oneOff[oneOff.length - 1] ^= 1;
    const flipped = await transcribe(a.jar, 'data:image/png;base64,' + oneOff.toString('base64'));
    c.deq([first.data.reused, changed.data.reused, flipped.data.reused], [false, false, false], 'a changed picture is always read afresh');
    c.eq(provider.total - before, 3, 'one changed byte → a new provider call each time');
    const asJpeg = await transcribe(a.jar, 'data:image/jpeg;base64,' + sameBytes.toString('base64'));
    c.eq(asJpeg.data.reused, false, 'the same bytes declared as another image type are a different request');
  }

  // ── 6 · /transcribe then /recognize: one call, and a real receipt ──────────
  const q = await issue(a.jar);
  c.eq(q.status, 201, 'the server issues a question');
  const qid = q.data.question.id;
  let firstReceipt;
  {
    const image = picture('9');
    const shown = await transcribe(a.jar, image);
    c.eq(shown.data.reused, false, 'the transcript is shown from a provider read');
    const before = await paid();
    const allowanceBefore = await allowanceUsed(a.id);
    const minted = await recognize(a.jar, qid, image);
    c.eq(minted.status, 201, 'submitting the same picture mints a receipt');
    c.eq(minted.data.reused, true, 'from the transcript already paid for');
    c.eq(callsFor('9'), 1, '/transcribe then /recognize, same picture → one provider call in total');
    c.deq(await paid(), before, 'the receipt cost no deployment unit');
    c.eq(await allowanceUsed(a.id), allowanceBefore, 'and no AI-allowance unit');
    c.eq(await requestsCounted(a.id, 'practice-recognize'), 1, 'but it did count against the recognize request rate limit');
    firstReceipt = minted.data.receipt;
    const row = await h.db.get("SELECT response_json FROM idempotency_keys WHERE account_id=? AND scope='practice-recognition' AND key=?", [a.id, firstReceipt]);
    const evidence = JSON.parse(row.response_json);
    c.deq([evidence.questionId, evidence.mode, evidence.text], [qid, 'ink', '9'], 'the receipt is bound to this question, this mode and this transcript');

    // ── 7 · A second try with the picture unchanged costs nothing ────────────
    const again = await recognize(a.jar, qid, image);
    c.eq(again.status, 201, 'a second unchanged try mints its own receipt');
    c.ok(again.data.receipt && again.data.receipt !== firstReceipt, 'a receipt is still minted per recognize call');
    c.eq(again.data.reused, true, 'without another read');
    c.eq(callsFor('9'), 1, 'second try unchanged → 0 further provider calls');
    c.eq(await receipts(a.id), 2, 'two receipts, one provider call');

    // The receipt is bound to its question: it cannot mark another one.
    const other = await issue(a.jar);
    const wrongQuestion = await h.request(`/v1/practice/${other.data.question.id}/submit`, {
      method: 'POST', jar: a.jar, headers: { 'Idempotency-Key': 'dedupe-wrong-question' },
      body: { submissionId: 'dedupe-wrong-question', answer: '9', mode: 'ink', transcriptionReceipt: firstReceipt }
    });
    c.deq([wrongQuestion.status, wrongQuestion.data?.error?.code], [422, 'RECOGNITION_RECEIPT_MISMATCH'], 'a receipt for one question is refused on another');
    const graded = await h.request(`/v1/practice/${qid}/submit`, {
      method: 'POST', jar: a.jar, headers: { 'Idempotency-Key': 'dedupe-right-question' },
      body: { submissionId: 'dedupe-right-question', answer: '9', mode: 'ink', transcriptionReceipt: firstReceipt }
    });
    c.eq(graded.status, 200, 'and is accepted by the deterministic marker on its own question');
    c.eq(graded.data.correct, true, 'which marks the transcript, as before');

    // A completed question still refuses recognition, kept transcript or not.
    const late = await recognize(a.jar, qid, image);
    c.deq([late.status, late.data?.error?.code], [409, 'QUESTION_ALREADY_GRADED'], 'a kept transcript does not reopen a completed question');
    c.eq(callsFor('9'), 1, 'and nothing was read to say so');

    // Another account cannot reach this question, or this account's transcript.
    const foreign = await recognize(b.jar, qid, image);
    c.eq(foreign.status, 404, 'another account is refused on a question that is not theirs');
    c.eq(callsFor('9'), 1, 'before any read');
  }

  // ── 8 · Slow provider, the client gives up, then retries ───────────────────
  {
    const rawPost = (jar, image, signal) => fetch(`${h.origin}/v1/handwriting/transcribe`, {
      method: 'POST', signal,
      headers: { 'content-type': 'application/json', accept: 'application/json', cookie: cookieHeader(jar), 'x-pri-csrf': jar.pri_csrf },
      body: JSON.stringify({ image })
    });
    // (a) the retry arrives while the abandoned read is still running
    const slow = picture('abandoned then joined', 'hold');
    const abortA = new AbortController();
    const givenUp = rawPost(a.jar, slow, abortA.signal).then(() => 'answered', error => error.name);
    await arrived('abandoned then joined');
    abortA.abort();
    c.eq(await givenUp, 'AbortError', 'the client aborts while the provider is still thinking');
    await new Promise(resolve => setTimeout(resolve, 100));
    c.eq(ops.stats().inFlight, 1, 'the server read continues after the client has gone');
    const retry = transcribe(a.jar, slow);
    await new Promise(resolve => setTimeout(resolve, 100));
    release('abandoned then joined');
    const joined = await retry;
    c.deq([joined.status, joined.data.reused, joined.data.transcription.text], [200, true, 'abandoned then joined'], 'the retry joins the read already in flight');
    c.eq(callsFor('abandoned then joined'), 1, 'slow provider + client abort + retry during the read → one provider call');

    // (b) the retry arrives after the abandoned read has finished
    const slow2 = picture('abandoned then kept', 'hold');
    const abortB = new AbortController();
    const givenUp2 = rawPost(a.jar, slow2, abortB.signal).then(() => 'answered', error => error.name);
    await arrived('abandoned then kept');
    abortB.abort();
    await givenUp2;
    release('abandoned then kept');
    await until(() => ops.stats().inFlight === 0, 'the abandoned read to finish');
    const before = await paid();
    const served = await transcribe(a.jar, slow2);
    c.deq([served.status, served.data.reused, served.data.transcription.text], [200, true, 'abandoned then kept'], 'the result of an abandoned read is kept for the retry');
    c.eq(callsFor('abandoned then kept'), 1, 'slow provider + client abort + retry afterwards → one provider call');
    c.deq(await paid(), before, 'and the retry cost nothing');
  }

  // ── 9 · A failure is never kept ────────────────────────────────────────────
  {
    const image = picture('fails once', 'failonce');
    const before = await paid();
    const failed = await transcribe(a.jar, image);
    c.deq([failed.status, failed.data?.error?.code, failed.data?.error?.retryable], [503, 'HANDWRITING_PROVIDER_5XX', true], 'a provider 5xx reaches the student as a retryable coded error');
    const retried = await transcribe(a.jar, image);
    c.deq([retried.status, retried.data.reused, retried.data.transcription.text], [200, false, 'fails once'], 'the explicit retry is a real provider read');
    c.eq(callsFor('fails once'), 2, 'provider failure then retry → two attempts; nothing was kept from the failure');
    const after = await paid();
    c.deq([after.hour - before.hour, after.day - before.day], [2, 2], 'a provider 5xx is NOT refunded: both attempts are counted (the provider may have billed)');
    c.eq((await transcribe(a.jar, image)).data.reused, true, 'the successful retry is what is kept');

    // A read whose fallback attempt failed is served, but not kept.
    const shaky = picture('fallback fails', 'fallbackfails');
    const one = await transcribe(a.jar, shaky);
    c.deq([one.status, one.data.transcription.fallbackAttempted, one.data.transcription.fallbackFailureCode], [200, true, 'HANDWRITING_PROVIDER_5XX'], 'a read whose fallback failed is still answered');
    const two = await transcribe(a.jar, shaky);
    c.eq(two.data.reused, false, 'but is not kept, so the retry tries the fallback for real');
    c.eq(callsFor('fallback fails'), 4, 'two reads × (primary + failed fallback) = four attempts');
  }

  // ── 9b · The student's own retries: double click, refresh, restored strokes ─
  {
    // Double click: two identical requests at the same instant.
    const twice = picture('double click', 'hold');
    const clicks = [transcribe({ ...a.jar }, twice), transcribe({ ...a.jar }, twice)];
    await arrived('double click');
    await new Promise(resolve => setTimeout(resolve, 150));
    release('double click');
    const answered = await Promise.all(clicks);
    c.deq(answered.map(r => r.status), [200, 200], 'a double click is answered twice');
    c.deq(answered.map(r => r.data.reused).sort(), [false, true], 'by one paid read and one free one');
    c.eq(callsFor('double click'), 1, 'double click → one provider call');

    // Page refresh / strokes restored from IndexedDB: the client re-sends the
    // byte-identical picture, possibly after this server has restarted. A new
    // recognitionOps is what a restarted process (or another replica) holds:
    // no memory of the first, the same database.
    const restored = picture('restored strokes');
    c.eq((await transcribe(a.jar, restored)).data.reused, false, 'strokes are read once');
    c.eq((await transcribe(a.jar, restored)).data.reused, true, 'a page refresh re-sending the same picture is free');
    let restartCalls = 0;
    const afterRestart = createRecognitionOps();
    const again = await afterRestart.read({ db: h.db, accountId: a.id, image: restored, env: process.env, transcribe: async () => { restartCalls += 1; throw new Error('the provider must not be called'); } });
    c.deq([again.reused, again.source, again.result.text, restartCalls], [true, 'cache', 'restored strokes', 0], 'identical strokes restored after a restart (or on another replica) are served from the kept read');
    c.eq(callsFor('restored strokes'), 1, 'refresh + restored strokes → one provider call in all');

    // A genuine edit — one more stroke — is a new picture and a new paid read.
    const edited = await transcribe(a.jar, picture('restored strokes', 'ok', 'c'));
    c.eq(edited.data.reused, false, 'a genuine edit is read afresh');
    c.eq(callsFor('restored strokes'), 2, 'genuine edit → a new provider call');

    // Provider timeout, then the student retries.
    process.env.PRI_HANDWRITING_TIMEOUT_MS = '2000';
    const slowImage = picture('times out once', 'hangonce');
    const before = await paid();
    const timedOut = await transcribe(a.jar, slowImage);
    c.deq([timedOut.status, timedOut.data?.error?.code, timedOut.data?.error?.retryable], [504, 'HANDWRITING_TIMEOUT', true], 'a provider that never answers is a retryable coded timeout');
    const attempts = callsFor('times out once');
    c.ok(attempts >= 1 && attempts <= 2, `the timeout cost ${attempts} provider attempt(s) (primary, and the fallback inside the same budget)`);
    const afterTimeout = await paid();
    c.eq(afterTimeout.hour - before.hour, attempts, 'a timeout is NOT refunded: every attempt keeps its unit (the provider may have billed)');
    provider.failedOnce.add('times out once');
    const afterRetry = await transcribe(a.jar, slowImage);
    c.deq([afterRetry.status, afterRetry.data.reused, afterRetry.data.transcription.text], [200, false, 'times out once'], 'the retry after a timeout is a real read: nothing was kept from the timeout');
    c.eq(callsFor('times out once'), attempts + 1, 'network timeout then retry → one more provider call, not zero and not two');
    process.env.PRI_HANDWRITING_TIMEOUT_MS = '20000';
  }

  // ── 9c · A refused request never consumes the student's attempt ────────────
  {
    const s = await student();
    const sq = await issue(s.jar);
    const sqid = sq.data.question.id;
    const attemptState = async () => ({
      receipts: await receipts(s.id),
      completed: Number((await h.db.get("SELECT COUNT(*) AS n FROM idempotency_keys WHERE account_id=? AND scope='practice-completion'", [s.id])).n),
      graded: Number((await h.db.get("SELECT COUNT(*) AS n FROM learning_events WHERE account_id=? AND kind='graded-attempt'", [s.id])).n)
    });
    const untouched = await attemptState();
    await resetBudget();
    ceiling(1, 1000);
    c.eq((await transcribe(a.jar, picture('takes the last unit'))).status, 200, 'another student takes the deployment\'s last unit');
    const refusedRead = await recognize(s.jar, sqid, picture('9', 'ok', 'z'));
    c.deq([refusedRead.status, refusedRead.data?.error?.code], [503, 'PAID_CAPACITY_REACHED'], 'this student\'s submit is refused for capacity');
    c.deq(await attemptState(), untouched, 'and wrote no receipt, no completion and no graded attempt');
    ceiling(10000, 100000);
    process.env.PRI_AI_DAILY_FREE = '1';
    c.eq((await transcribe(s.jar, picture('uses the allowance'))).status, 200, 'the student uses their one daily read');
    const overAllowance = await recognize(s.jar, sqid, picture('9', 'ok', 'z'));
    c.eq(overAllowance.status, 429, 'a submit over the allowance is refused');
    c.deq(await attemptState(), untouched, 'and likewise consumed nothing of the attempt');
    delete process.env.PRI_AI_DAILY_FREE;
    const typed = await h.request(`/v1/practice/${sqid}/submit`, { method: 'POST', jar: s.jar, headers: { 'Idempotency-Key': 'dedupe-first-real-try' },
      body: { submissionId: 'dedupe-first-real-try', answer: '5', mode: 'typed' } });
    c.deq([typed.status, typed.data.correct, typed.data.resolved], [200, false, false], 'the question is still on its FIRST try: a wrong answer now leaves a second try');
    const second = await recognize(s.jar, sqid, picture('9', 'ok', 'z'));
    c.eq(second.status, 201, 'and once capacity is back the same picture is read and receipted');
    const final = await h.request(`/v1/practice/${sqid}/submit`, { method: 'POST', jar: s.jar, headers: { 'Idempotency-Key': 'dedupe-second-real-try' },
      body: { submissionId: 'dedupe-second-real-try', answer: '9', mode: 'ink', transcriptionReceipt: second.data.receipt } });
    c.deq([final.status, final.data.correct], [200, true], 'for the second try the student still had');
  }

  // ── 10 · A blank page: two calls once, then none ───────────────────────────
  {
    const image = picture('blank page', 'blank');
    const before = await paid();
    const allowanceBefore = await allowanceUsed(a.id);
    const blank = await transcribe(a.jar, image);
    c.deq([blank.status, blank.data.transcription.text, blank.data.transcription.needsConfirmation, blank.data.transcription.fallbackAttempted], [200, '', true, true], 'a blank page is an empty, unconfirmed read after the fallback model');
    c.eq(callsFor('blank page'), 2, 'which costs two provider calls (primary + fallback)');
    const after = await paid();
    c.deq([after.hour - before.hour, after.day - before.day], [2, 2], 'and two deployment units');
    c.eq((await allowanceUsed(a.id)) - allowanceBefore, 1, 'but one allowance unit: the allowance counts requests');
    const againBlank = await transcribe(a.jar, image);
    c.eq(againBlank.data.reused, true, 'the same blank picture again is served from memory');
    const open = await issue(a.jar);
    const refused = await recognize(a.jar, open.data.question.id, image);
    c.deq([refused.status, refused.data?.error?.code], [422, 'RECOGNITION_EMPTY'], 'an empty read still mints no receipt');
    c.eq(callsFor('blank page'), 2, 'same blank picture again → 0 further calls on either route');
    c.deq(await paid(), after, 'and no further units');
  }

  // ── 11 · The kept transcript never bypasses authority ──────────────────────
  {
    // (a) signed out between the read and the recognize
    const s = await student();
    const sq = await issue(s.jar);
    const image = picture('signed out');
    c.eq((await transcribe(s.jar, image)).status, 200, 'a transcript is kept for an account');
    const stale = { ...s.jar };
    c.eq((await h.request('/v1/account/logout', { method: 'POST', jar: s.jar, body: {} })).status, 200, 'the account signs out');
    const afterLogout = await recognize(stale, sq.data.question.id, image);
    c.eq(afterLogout.status, 401, 'a kept transcript does not answer a session that has ended');
    c.eq(await receipts(s.id), 0, 'and mints no receipt');

    // (b) signed out WHILE a reused read is awaited: the commit-time re-check
    const s2 = await student();
    const s2q = await issue(s2.jar);
    const held = picture('signed out mid read', 'hold');
    const showing = transcribe({ ...s2.jar }, held);
    await arrived('signed out mid read');
    const minting = recognize({ ...s2.jar }, s2q.data.question.id, held);
    await until(async () => (await requestsCounted(s2.id, 'practice-recognize')) >= 1, 'the recognize request to reach its handler');
    await new Promise(resolve => setTimeout(resolve, 150));
    c.eq((await h.request('/v1/account/logout', { method: 'POST', jar: s2.jar, body: {} })).status, 200, 'the account signs out during the read');
    release('signed out mid read');
    const [, mintedLate] = await Promise.all([showing, minting]);
    c.deq([mintedLate.status, mintedLate.data?.error?.code], [401, 'AUTH_REQUIRED'], 'a reused read is still refused at commitment when the session has ended');
    c.eq(await receipts(s2.id), 0, 'no receipt is written');
    c.eq(callsFor('signed out mid read'), 1, 'and the read was one provider call');

    // (c) a guardian withdraws consent between the read and the recognize
    const childJar = {};
    await h.db.run("DELETE FROM rate_limits WHERE bucket LIKE 'register:%'");
    const registration = await h.request('/v1/account/register', { method: 'POST', jar: childJar, body: {
      name: 'QA Student', email: 'dedupe.child@example.test', password: 'guardian-pass-123', deviceId: 'dedupe-child-ipad',
      isAdult: false, year: '9', guardianName: 'QA Guardian', guardianEmail: 'dedupe.guardian@example.test' } });
    c.eq(registration.status, 201, 'a minor registers');
    const childId = registration.data.account.id;
    c.eq((await verifyEmail(h, childId)).status, 200, 'and verifies their email');
    const guardianToken = async kind => {
      const row = await h.db.get('SELECT token_id,token_ciphertext FROM auth_delivery_outbox WHERE account_id=? AND kind=? ORDER BY created_at DESC LIMIT 1', [childId, kind]);
      return decryptDeliveryToken(row.token_ciphertext, `${childId}:${kind}:${row.token_id}`);
    };
    c.eq((await h.request('/v1/account/guardian/confirm', { method: 'POST', body: { token: await guardianToken('guardian-consent') } })).status, 200, 'the guardian consents');
    const childQuestion = await issue(childJar);
    const childImage = picture('consent withdrawn');
    c.eq((await transcribe(childJar, childImage)).status, 200, 'the child\'s picture is read and kept');
    c.eq((await h.request('/v1/account/guardian/withdraw', { method: 'POST', body: { token: await guardianToken('guardian-withdraw') } })).status, 200, 'the guardian withdraws consent');
    const afterWithdrawal = await recognize(childJar, childQuestion.data.question.id, childImage);
    c.eq(afterWithdrawal.status, 403, 'a kept transcript does not answer an account whose consent was withdrawn');
    c.match(afterWithdrawal.data?.error?.code, /^GUARDIAN_CONSENT_/, 'with the consent code');
    c.eq(await receipts(childId), 0, 'and no receipt exists');
    c.eq((await transcribe(childJar, childImage)).status, 403, 'nor is the transcript itself served any more');
    c.eq(callsFor('consent withdrawn'), 1, 'one provider call in all');
  }

  // ── 12 · The kept transcript expires ───────────────────────────────────────
  {
    const image = picture('expires');
    c.eq((await transcribe(a.jar, image)).data.reused, false, 'a read is kept');
    let offset = RECOGNITION_TTL_MS - 1000;
    ops.configure({ now: () => Date.now() + offset });
    c.eq((await transcribe(a.jar, image)).data.reused, true, 'and is reused just inside the 15-minute lifetime');
    offset = RECOGNITION_TTL_MS + 1000;
    const expired = await transcribe(a.jar, image);
    c.eq(expired.data.reused, false, 'and read afresh just after it');
    c.eq(callsFor('expires'), 2, 'TTL expiry → a new provider call');
    c.eq(RECOGNITION_TTL_MS, 15 * 60 * 1000, 'the lifetime is the documented 15 minutes');
    ops.configure({ now: () => Date.now() });
    // Reuse does not extend the lifetime: it is measured from the paid read.
    c.eq((await transcribe(a.jar, image)).data.reused, true, 'the fresh read is kept in turn');
  }

  // ── 13 · The ceiling is never exceeded by concurrent DIFFERENT pictures ────
  for (const limit of [1, 3]) {
    await resetBudget();
    ceiling(limit, 1000);
    const racer = await student();
    const before = provider.total;
    const results = await Promise.all(Array.from({ length: 8 }, (_, i) => transcribe({ ...racer.jar }, picture(`ceiling ${limit} race ${i}`))));
    const accepted = results.filter(r => r.status === 200).length;
    const refused = results.filter(r => r.status === 503 && r.data?.error?.code === 'PAID_CAPACITY_REACHED').length;
    c.eq(accepted, limit, `ceiling ${limit}: exactly ${limit} of 8 concurrent different reads are accepted`);
    c.eq(refused, 8 - limit, `ceiling ${limit}: the other ${8 - limit} are refused with the capacity code`);
    c.eq(provider.total - before, limit, `ceiling ${limit}: the provider received exactly ${limit} calls`);
    c.deq(await paid(), { hour: limit, day: limit }, `ceiling ${limit}: the counters stop at the ceiling`);
    c.eq(await allowanceUsed(racer.id), limit, `ceiling ${limit}: refused requests gave their allowance unit back`);
  }
  // The same race when the DAY window is the one that fills.
  {
    await resetBudget();
    ceiling(1000, 3);
    const racer = await student();
    const before = provider.total;
    const results = await Promise.all(Array.from({ length: 8 }, (_, i) => transcribe({ ...racer.jar }, picture(`day race ${i}`))));
    c.eq(results.filter(r => r.status === 200).length, 3, 'day ceiling 3: exactly 3 of 8 are accepted');
    c.eq(provider.total - before, 3, 'day ceiling 3: the provider received exactly 3 calls');
    c.deq(await paid(), { hour: 3, day: 3 }, 'a request refused by the day window is not counted in the hour window either');
    const dayRefusal = results.find(r => r.status === 503);
    c.eq(dayRefusal.data.error.window, 'day', 'and the refusal names the day window');
  }

  // ── 14 · The refusal is machine-readable, and a kept read needs no capacity ─
  {
    await resetBudget();
    ceiling(1, 1000);
    const image = picture('last unit');
    const startedAt = Date.now();
    c.eq((await transcribe(a.jar, image)).status, 200, 'the last unit of the hour is spent');
    const refusal = await transcribe(a.jar, picture('one too many'));
    const error = refusal.data?.error || {};
    c.deq([refusal.status, error.code, error.retryable, error.window], [503, 'PAID_CAPACITY_REACHED', true, 'hour'], 'the refusal keeps its status and code and names the window');
    c.ok(Number.isInteger(error.resetAt) && error.resetAt > startedAt && error.resetAt <= Date.now() + 60 * 60 * 1000, 'resetAt is an epoch-ms time inside the next hour');
    c.eq(refusal.headers.get('ratelimit-reset'), String(Math.ceil(error.resetAt / 1000)), 'and agrees with the RateLimit-Reset header');
    c.ok(typeof error.message === 'string' && error.message.length > 0, 'the human message is still there');
    c.eq(callsFor('one too many'), 0, 'a refused request never reaches the provider');
    c.deq(await paid(), { hour: 1, day: 1 }, 'and counts nothing');
    const kept = await transcribe(a.jar, image);
    c.deq([kept.status, kept.data.reused], [200, true], 'a picture already read is still served with the ceiling spent: it needs no capacity');
    const open = await issue(a.jar);
    const mintedAtCeiling = await recognize(a.jar, open.data.question.id, image);
    c.deq([mintedAtCeiling.status, mintedAtCeiling.data.reused], [201, true], 'and its receipt can still be minted');
    const recognizeRefused = await recognize(a.jar, open.data.question.id, picture('one too many for recognize'));
    c.deq([recognizeRefused.status, recognizeRefused.data?.error?.code, recognizeRefused.data?.error?.window, Number.isInteger(recognizeRefused.data?.error?.resetAt)],
      [503, 'PAID_CAPACITY_REACHED', 'hour', true], 'the recognize route refuses in the same shape');

    // The per-account allowance refusal, same idea.
    await resetBudget();
    ceiling(10000, 100000);
    process.env.PRI_AI_DAILY_FREE = '1';
    const capped = await student();
    c.eq((await transcribe(capped.jar, picture('allowance one'))).status, 200, 'an account uses its one daily read');
    const over = await transcribe(capped.jar, picture('allowance two'));
    const overError = over.data?.error || {};
    c.deq([over.status, overError.code, overError.retryable, overError.window, overError.limit], [429, 'AI_ALLOWANCE_EXHAUSTED', true, 'day', 1], 'the allowance refusal is machine-readable too');
    c.ok(Number.isInteger(overError.resetAt) && overError.resetAt > Date.now(), 'with an epoch-ms resetAt');
    c.eq(over.headers.get('ratelimit-reset'), String(Math.ceil(overError.resetAt / 1000)), 'matching its header');
    c.eq(callsFor('allowance two'), 0, 'and nothing was sent');
    c.deq([(await transcribe(capped.jar, picture('allowance one'))).status, await allowanceUsed(capped.id)], [200, 1], 'a picture already read is served without touching the exhausted allowance');
    delete process.env.PRI_AI_DAILY_FREE;
  }

  // ── 15 · Fail closed: no ceiling, no server reading — kept transcript or not ─
  {
    const image = picture('fail closed');
    c.eq((await transcribe(a.jar, image)).status, 200, 'a read is kept while the ceiling is configured');
    delete process.env.PRI_PAID_CALLS_PER_HOUR;
    const closed = await transcribe(a.jar, image);
    c.deq([closed.status, closed.data?.error?.code], [503, 'PAID_CAPACITY_NOT_CONFIGURED'], 'with the ceiling unconfigured even a kept picture is refused');
    const fresh = await transcribe(a.jar, picture('fail closed fresh'));
    c.deq([fresh.status, fresh.data?.error?.code, callsFor('fail closed fresh')], [503, 'PAID_CAPACITY_NOT_CONFIGURED', 0], 'and a new picture is refused before anything is sent');
    ceiling(10000, 100000);
  }

  // ── 16 · Token usage is recorded as numbers only ───────────────────────────
  {
    metrics.reset();
    logged.length = 0;
    const image = picture('usage numbers');
    await transcribe(a.jar, image);
    await transcribe(a.jar, image);
    const counters = metrics.snapshot().counters;
    c.eq(counters['provider_tokens_total{kind=input,model=fixture-primary,provider=handwriting}']?.total, 1000, 'input tokens reported by the provider are counted once');
    c.eq(counters['provider_tokens_total{kind=output,model=fixture-primary,provider=handwriting}']?.total, 60, 'output tokens likewise');
    c.eq(counters['provider_tokens_total{kind=reasoning,model=fixture-primary,provider=handwriting}']?.total, 20, 'and reasoning tokens');
    c.eq(counters['provider_http_calls_total{model=fixture-primary,provider=handwriting}']?.total, 1, 'one HTTP call to the provider for two requests, under the model id the provider reported back');
    c.eq(counters['recognition_reads_total{source=provider}']?.total, 1, 'one read by the provider');
    c.eq(counters['recognition_reads_total{source=cache}']?.total, 1, 'one read from memory');
    c.eq(counters['provider_calls_total{outcome=ok,provider=handwriting}']?.total, 1, 'a reused read is not counted as a provider call');
    const usageLines = logged.filter(line => line.event === 'provider_usage');
    c.eq(usageLines.length, 1, 'one usage log line for the one paid read');
    c.deq([usageLines[0].inputTokens, usageLines[0].outputTokens, usageLines[0].reasoningTokens, usageLines[0].count, usageLines[0].paidUnits, usageLines[0].provider],
      [1000, 60, 20, 1, 1, 'handwriting'], 'carrying token counts, the call count and the units');
    c.ok(Object.keys(usageLines[0]).every(key => ['ts', 'level', 'event', 'requestId', 'provider', 'count', 'paidUnits', 'latencyMs', 'inputTokens', 'outputTokens', 'reasoningTokens'].includes(key)),
      'and nothing else: no picture, no transcript, no account');
    c.ok(!JSON.stringify(logged).includes('usage numbers') && !JSON.stringify(logged).includes(image.slice(30, 90)), 'no log line carries the transcript or the picture');
  }

  // ══ Part 2 · recognitionOps directly, injected transcriber ═════════════════
  const unitEnv = { PRI_HANDWRITING_API_KEY: 'unit-key', PRI_PAID_CALLS_PER_HOUR: '100000', PRI_PAID_CALLS_PER_DAY: '100000', PRI_AI_DAILY_FREE: '100000' };
  await resetBudget();
  let injectedCalls = 0;
  const injected = async image => {
    injectedCalls += 1;
    const label = Buffer.from(image.split(',')[1], 'base64').toString('utf8').split('|')[2];
    return { engine: 'cloud-injected', lines: [{ text: label, latex: null, confidence: 0.97 }], text: label, confidence: 0.97, needsConfirmation: false };
  };

  // ── 17 · What is stored, for whom, and for how long ────────────────────────
  {
    const owner = await student();
    const other = await student();
    const stored = accountId => h.db.all('SELECT key, response_json, request_digest, created_at, expires_at FROM idempotency_keys WHERE account_id=? AND scope=?', [accountId, RECOGNITION_SCOPE]);
    const kept = createRecognitionOps();
    const image = picture('kept shape');
    const first = await kept.read({ db: h.db, accountId: owner.id, image, env: unitEnv, transcribe: injected });
    c.ok(Object.isFrozen(first.result) && Object.isFrozen(first.result.lines), 'a read is handed out frozen');
    const rows = await stored(owner.id);
    c.eq(rows.length, 1, 'one row is kept for one read, in idempotency_keys under the account that paid for it');
    const row = rows[0];
    const bytes = Buffer.from(image.split(',')[1], 'base64');
    const plainDigest = createHash('sha256').update(bytes).digest('hex');
    c.match(row.key, /^[0-9a-f]{64}$/, 'its key is a 64-hex digest');
    c.ok(row.key !== plainDigest && !JSON.stringify(row).includes(plainDigest), 'a KEYED digest: the plain SHA-256 of the picture is nowhere in the row');
    c.ok(!row.response_json.includes(image.split(',')[1].slice(0, 60)) && !row.response_json.includes('data:image') && row.response_json.length < 600,
      `the row holds the transcript only, never the picture (${row.response_json.length} characters for a ${image.length}-character picture)`);
    c.deq(Object.keys(JSON.parse(row.response_json)).sort(), ['result', 'v'], 'as a versioned transcript record');
    c.eq(Number(row.expires_at) - Number(row.created_at), RECOGNITION_TTL_MS, 'expiring 15 minutes after the paid read');
    c.eq((await stored(other.id)).length, 0, 'no other account has a row');
    c.eq((await kept.read({ db: h.db, accountId: owner.id, image, env: unitEnv, transcribe: injected })).reused, true, 'the owner reuses it');
    const beforeOther = injectedCalls;
    const theirs = await kept.read({ db: h.db, accountId: other.id, image, env: unitEnv, transcribe: injected });
    c.deq([theirs.reused, injectedCalls - beforeOther], [false, 1], 'another account never receives it and pays for its own read');
    c.ok((await stored(other.id))[0].key !== row.key, 'and its row has a different key for the same picture');

    // The configuration is part of the identity.
    const before = injectedCalls;
    for (const change of [{ PRI_HANDWRITING_MODEL: 'another-primary' }, { PRI_HANDWRITING_FALLBACK_MODEL: 'another-fallback' }, { PRI_HANDWRITING_REASONING_EFFORT: 'medium' }, { PRI_HANDWRITING_CONFIDENCE_FLOOR: '0.9' }]) {
      const changed = await kept.read({ db: h.db, accountId: owner.id, image, env: { ...unitEnv, ...change }, transcribe: injected });
      c.eq(changed.reused, false, `a changed ${Object.keys(change)[0]} is a different operation`);
    }
    c.eq(injectedCalls - before, 4, 'each configuration change was read afresh');

    // Expired rows of the account go at its next paid read, not only at housekeeping.
    const liveBefore = (await stored(owner.id)).length;
    let offset = RECOGNITION_TTL_MS + 1000;
    kept.configure({ now: () => Date.now() + offset });
    await kept.read({ db: h.db, accountId: owner.id, image: picture('after expiry'), env: unitEnv, transcribe: injected });
    c.ok(liveBefore >= 5 && (await stored(owner.id)).length === 1, 'an account\'s expired reads are deleted when it next pays for one');
    kept.configure({ now: () => Date.now() });

    // A transcript larger than any real one is served and not stored.
    const bounded = createRecognitionOps({ maxTranscriptBytes: 50 });
    const rowsBefore = (await stored(owner.id)).length;
    const large = await bounded.read({ db: h.db, accountId: owner.id, image: picture('too large to keep'), env: unitEnv, transcribe: injected });
    c.deq([large.reused, large.result.text, (await stored(owner.id)).length - rowsBefore, bounded.stats().notStored], [false, 'too large to keep', 0, 1], 'an over-bound transcript is served but never stored');
    c.eq(RECOGNITION_MAX_TRANSCRIPT_BYTES, 64 * 1024, 'the shipped bound is the documented 64 kB');

    // A storage failure never fails a read the student has paid a unit for.
    const brokenDb = { ...h.db, dialect: h.db.dialect, get: (...args) => h.db.get(...args), run: (...args) => h.db.run(...args), all: (...args) => h.db.all(...args),
      transaction: (fn, options) => (options?.accountScope ? Promise.reject(new Error('disk full')) : h.db.transaction(fn, options)) };
    const unlucky = createRecognitionOps();
    const served = await unlucky.read({ db: brokenDb, accountId: owner.id, image: picture('store fails'), env: unitEnv, transcribe: injected });
    c.deq([served.reused, served.result.text, unlucky.stats().notStored], [false, 'store fails', 1], 'when the row cannot be written the read is still answered');

    // Deleting the account deletes its kept reads (ON DELETE CASCADE).
    c.ok((await stored(other.id)).length >= 1, 'an account has kept reads');
    const deleted = await h.request('/v1/account', { method: 'DELETE', jar: other.jar, body: { password: 'correct-horse-battery' } });
    if (deleted.status === 200 || deleted.status === 204) {
      c.eq((await stored(other.id)).length, 0, 'account deletion through the product route removes them');
    } else {
      await h.db.run('DELETE FROM accounts WHERE id=?', [other.id]);
      c.eq((await stored(other.id)).length, 0, 'deleting the account row removes them (ON DELETE CASCADE)');
    }
  }

  // ── 18 · Refunds: only when nothing was sent ───────────────────────────────
  {
    const unit = createRecognitionOps();
    const refundee = (await student()).id;
    const keptRows = async () => Number((await h.db.get('SELECT COUNT(*) AS n FROM idempotency_keys WHERE account_id=? AND scope=?', [refundee, RECOGNITION_SCOPE])).n);
    const failing = code => async () => { throw new HandwritingProviderError('x', { code, status: 503, retryable: true }); };
    const attempt = async (label, code) => {
      const before = await paid();
      const usedBefore = await allowanceUsed(refundee);
      let thrown = null;
      try { await unit.read({ db: h.db, accountId: refundee, image: picture(label), env: unitEnv, transcribe: failing(code) }); }
      catch (error) { thrown = error.code; }
      const after = await paid();
      return { thrown, paidDelta: after.hour - before.hour, dayDelta: after.day - before.day, allowanceDelta: (await allowanceUsed(refundee)) - usedBefore, kept: await keptRows() };
    };
    c.deq(await attempt('refund config', 'HANDWRITING_PROVIDER_CONFIG_INVALID'), { thrown: 'HANDWRITING_PROVIDER_CONFIG_INVALID', paidDelta: 0, dayDelta: 0, allowanceDelta: 0, kept: 0 },
      'an invalid configuration (nothing was sent) gives back the paid unit and the allowance unit');
    for (const code of ['HANDWRITING_TIMEOUT', 'HANDWRITING_PROVIDER_5XX', 'HANDWRITING_UNREACHABLE', 'HANDWRITING_PROVIDER_429', 'HANDWRITING_REJECTED', 'HANDWRITING_MALFORMED']) {
      c.deq(await attempt(`refund ${code}`, code), { thrown: code, paidDelta: 1, dayDelta: 1, allowanceDelta: 1, kept: 0 },
        `${code} keeps its paid unit and its allowance unit, and nothing is kept`);
    }

    // The reservation primitive itself.
    await resetBudget();
    const env = { PRI_HANDWRITING_API_KEY: 'k', PRI_PAID_CALLS_PER_HOUR: '2', PRI_PAID_CALLS_PER_DAY: '2' };
    const one = await reservePaidCall(h.db, { env });
    c.deq([one.verdict, one.units.length], [null, 2], 'a reservation names the hour and day rows it counted');
    await refundPaidCall(h.db, one);
    c.deq(await paid(), { hour: 0, day: 0 }, 'and a refund gives back exactly that');
    await refundPaidCall(h.db, one);
    c.deq(await paid(), { hour: 0, day: 0 }, 'never below zero');
    c.eq(await consumePaidCall(h.db, { env }), null, 'consumePaidCall still answers null when a call may proceed');
    c.eq(await consumePaidCall(h.db, { env }), null, 'up to the ceiling');
    const full = await consumePaidCall(h.db, { env });
    c.deq([full.status, full.code, full.window, full.retryable], [503, 'PAID_CAPACITY_REACHED', 'hour', true], 'and the capacity verdict past it');
    const missing = await reservePaidCall(h.db, { env: { PRI_HANDWRITING_API_KEY: 'k' } });
    c.deq([missing.verdict?.code, missing.units.length], ['PAID_CAPACITY_NOT_CONFIGURED', 0], 'a key with no ceiling still refuses: unconfigured is never unlimited');
    c.deq(await reservePaidCall(h.db, { env: {} }), { verdict: null, units: [] }, 'and with no key there is nothing to count');
  }

  console.log(`engine: ${h.engine}`);
  console.log(`RECOGNITION DEDUPE: PASS — ${c.count()}/${c.count()} checks — real ${h.engine} HTTP against a counting test provider (${provider.total} provider requests in all) plus an injected transcriber: one paid read per unchanged picture, a fresh read for a changed one, the ceiling never exceeded, authority never bypassed.`);
} finally {
  setLogSink(previousSink);
  for (const go of provider.held.values()) go();
  await h.close();
  await new Promise(resolve => { fake.closeAllConnections?.(); fake.close(resolve); });
  rmSync(dir, { recursive: true, force: true });
  for (const name of vars) { if (previous[name] === undefined) delete process.env[name]; else process.env[name] = previous[name]; }
}
