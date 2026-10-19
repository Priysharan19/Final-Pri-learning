// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · what the hot paths cost, counted (#441 port, issue #506)
//
//   node server/test/hot-path-budget-check.mjs                     (SQLite)
//   node scripts/with-postgres.mjs node server/test/hot-path-budget-check.mjs --engine=postgres
//
// One handwritten answer is a handful of /v1 requests, and each request is a
// number of database statements. When the app and its database are in
// different regions every statement is a wire round trip, so a count that
// creeps up is time a student waits. This suite drives the shipped app
// (server/app.js → /v1) over a real loopback socket with a COUNTING STORE —
// every statement and transaction-control command the store sends is counted
// at the store's edge (Postgres: each client.query() is one wire round trip;
// SQLite: each driver call) — and PINS, per engine:
//
//   · the round trips of every hot request (issue, typed Submit, ink Submit,
//     the three-request receipt sequence it replaces, sync push and pull,
//     /account/me, /account/guardian/state);
//   · that one ink Submit is ONE request, and reads the picture through the
//     same one-paid-read path (a transcript just shown is reused);
//   · that the request's own meter (server/platform/requestTiming.js) agrees
//     with the counting store, carries numbers only, reaches /v1/metrics per
//     route template, and is sent as a Server-Timing header only when
//     PRI_SERVER_TIMING=1 and only to a signed-in caller;
//   · the reading invariants of the one-request Submit: the reader is sent the
//     picture alone (answer-blind), and the mark is the deterministic engine's
//     verdict on the submitted answer text — never the reading's;
//   · consumeRateLimit's single-statement rule (allow, count, refuse, restart).
//
// A change that adds a round trip to one of these paths fails here and has to
// change the pinned number on purpose. The numbers are MEASURED by this suite.
//
// Evidence class: LOCAL and SYNTHETIC. The reader is a local HTTP fixture that
// answers with the text encoded in the picture; it says nothing about reading
// accuracy or provider latency. Loopback timings are printed, never pinned.
// ─────────────────────────────────────────────────────────────────────────────
import './support/hermetic.mjs';
import { createServer } from 'node:http';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const dir = mkdtempSync(join(tmpdir(), 'pri-hot-path-'));
// --report: print the counts without pinning them (used to measure a build
// that predates this suite's pins, e.g. the "before" column of the PR notes).
const REPORT_ONLY = process.argv.includes('--report');
// --legacy: only the paths a build without the one-request Submit has.
const LEGACY_ONLY = process.argv.includes('--legacy');

// ── The synthetic reader ─────────────────────────────────────────────────────
// A picture is a tagged byte string; the reader answers with the text it holds.
const picture = (text, salt = '') =>
  'data:image/png;base64,' + Buffer.from(`SYNTHETIC|${JSON.stringify(text)}|${salt}|` + 'a'.repeat(300)).toString('base64');
const provider = { calls: 0, sent: [] };
const fake = createServer((req, res) => {
  let raw = '';
  req.on('data', chunk => { raw += chunk; });
  req.on('end', () => {
    provider.calls += 1;
    provider.sent.push(raw);
    const sent = JSON.parse(raw);
    const image = sent.input[1].content.find(part => part.type === 'input_image').image_url;
    const [, text] = Buffer.from(image.split(',')[1], 'base64').toString('utf8').split('|');
    const lines = String(JSON.parse(text)).split('\n').map(line => ({ text: line, latex: '', confidence: 0.97 }));
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({
      model: sent.model,
      output_text: JSON.stringify({ lines, confidence: 0.97, needs_confirmation: false }),
      usage: { input_tokens: 900, output_tokens: 40, total_tokens: 940 }
    }));
  });
});
await new Promise(resolve => fake.listen(0, '127.0.0.1', resolve));

const vars = ['NODE_ENV', 'PRI_PLATFORM_DB', 'PRI_AUTH_DELIVERY_KEY', 'PRI_PUBLIC_ORIGIN', 'PRI_HANDWRITING_API_KEY',
  'PRI_HANDWRITING_ENDPOINT', 'PRI_HANDWRITING_MODEL', 'PRI_HANDWRITING_FALLBACK_MODEL', 'PRI_HANDWRITING_TIMEOUT_MS',
  'PRI_PAID_CALLS_PER_HOUR', 'PRI_PAID_CALLS_PER_DAY', 'PRI_AI_DAILY_FREE', 'PRI_AI_DAILY_PREMIUM', 'PRI_SERVER_TIMING'];
const previous = Object.fromEntries(vars.map(name => [name, process.env[name]]));
Object.assign(process.env, {
  NODE_ENV: 'test', PRI_PLATFORM_DB: join(dir, 'test.sqlite'), PRI_AUTH_DELIVERY_KEY: 'eb'.repeat(32),
  PRI_HANDWRITING_API_KEY: 'local-synthetic-fixture', PRI_HANDWRITING_ENDPOINT: `http://127.0.0.1:${fake.address().port}/v1/responses`,
  PRI_HANDWRITING_MODEL: 'fixture-primary', PRI_HANDWRITING_FALLBACK_MODEL: 'fixture-fallback', PRI_HANDWRITING_TIMEOUT_MS: '20000',
  PRI_PAID_CALLS_PER_HOUR: '10000', PRI_PAID_CALLS_PER_DAY: '100000'
});
for (const name of ['PRI_PUBLIC_ORIGIN', 'PRI_AI_DAILY_FREE', 'PRI_AI_DAILY_PREMIUM', 'PRI_SERVER_TIMING']) delete process.env[name];

const { startApp, registerAccount, verifyEmail, checks } = await import('./support/app-harness.mjs');
const { requestedEngine } = await import('./support/engine.mjs');
const { solveLinearPrompt } = await import('./support/linear-equation.mjs');
const { consumeRateLimit } = await import('../platform/security.js');
let metricsModule = null;
try { metricsModule = await import('../platform/metrics.js'); } catch { /* a build without route metrics */ }
let timingModule = null;
try { timingModule = await import('../platform/requestTiming.js'); } catch { /* a build without the meter */ }

const engine = requestedEngine();
const c = checks();
const logged = [];
const h = await startApp({ engine, log: line => logged.push(line) });

// ── The counting store ───────────────────────────────────────────────────────
const trace = { on: false, sql: [] };
const note = sql => { if (trace.on) trace.sql.push(String(typeof sql === 'string' ? sql : sql?.text || '')); };
if (engine === 'postgres') {
  const pool = h.db.pool;
  const connect = pool.connect.bind(pool);
  const setups = new Set();
  pool.connect = async (...args) => {
    const client = await connect(...args);
    if (!client.__priHotPathCounted) {
      client.__priHotPathCounted = true;
      const query = client.query.bind(client);
      client.query = (sql, ...rest) => {
        // A pooled connection's one-time session setup belongs to opening the
        // connection, not to the request that happened to be first on it.
        const text = typeof sql === 'string' ? sql : sql?.text || '';
        if (/^SET search_path TO /.test(text) && !setups.has(client)) setups.add(client);
        else note(sql);
        return query(sql, ...rest);
      };
    }
    return client;
  };
} else {
  const store = h.db;
  const exec = store._exec.bind(store);
  store._exec = (kind, sql, params) => { note(sql); return exec(kind, sql, params); };
  const rawExec = store.raw.exec.bind(store.raw);
  store.raw.exec = sql => { note(sql); return rawExec(sql); };
}

/** One request, counted: its status, body, headers, round trips and meter line. */
async function counted(path, options) {
  trace.sql = [];
  trace.on = true;
  const before = logged.length;
  const started = process.hrtime.bigint();
  const response = await h.request(path, options);
  const ms = Number(process.hrtime.bigint() - started) / 1e6;
  trace.on = false;
  // The access log line is written on 'finish'; wait for it.
  for (let i = 0; i < 50 && logged.length === before; i++) await new Promise(resolve => setTimeout(resolve, 2));
  const line = logged.slice(before).find(entry => entry?.event === 'http_request') || null;
  return { ...response, trips: trace.sql.length, sql: [...trace.sql], ms, line };
}

const report = [];
const measured = new Map();
function record(label, result, requests = 1) {
  // PRI_HOT_PATH_VERBOSE=1: the statements of each first sample (diagnosis only).
  if (process.env.PRI_HOT_PATH_VERBOSE && !measured.has(label) && result.sql) {
    console.log(`\n${label}\n  ${result.sql.map(q => q.replace(/\s+/g, ' ').slice(0, 120)).join('\n  ')}`);
  }
  const entry = measured.get(label) || { label, trips: [], ms: [], requests };
  entry.trips.push(result.trips);
  entry.ms.push(result.ms);
  measured.set(label, entry);
  if (!report.includes(entry)) report.push(entry);
}

let students = 0;
async function student() {
  students += 1;
  await h.db.run("DELETE FROM rate_limits WHERE bucket LIKE 'register:%'");
  const account = await registerAccount(h, { email: `hot.path.${students}@example.test`, deviceId: `hot-ipad-${students}` });
  if (account.status !== 201) throw new Error(`register: ${account.status} ${account.text}`);
  const verified = await verifyEmail(h, account.account.id);
  if (verified.status !== 200) throw new Error(`verify: ${verified.status}`);
  return { jar: account.jar, id: account.account.id, deviceId: `hot-ipad-${students}` };
}
let seed = 81000;
const issue = jar => counted('/v1/practice/issue', { method: 'POST', jar, body: { generator: 'c8-linear-equations-both-sides', difficulty: 2, seed: seed++, curriculum: 'in' } });
const answerOf = question => {
  const { variable, root } = solveLinearPrompt(question.prompt);
  return { variable, root: String(root) };
};

try {
  const a = await student();
  const SAMPLES = 3;

  // ── Issue and typed Submit ─────────────────────────────────────────────────
  for (let i = 0; i < SAMPLES; i++) {
    const issued = await issue(a.jar);
    c.eq(issued.status, 201, `issue ${i}: 201`);
    record('POST /v1/practice/issue', issued);
    const { root } = answerOf(issued.data.question);
    const submissionId = `hot-typed-${i}`;
    const typed = await counted(`/v1/practice/${issued.data.question.id}/submit`, {
      method: 'POST', jar: a.jar, headers: { 'Idempotency-Key': submissionId }, body: { submissionId, answer: root, mode: 'typed' }
    });
    c.eq(typed.status, 200, `typed submit ${i}: 200`);
    c.ok(typed.data?.correct === true && typed.data?.resolved === true, `typed submit ${i}: the right answer resolves the question`);
    record('POST /v1/practice/:id/submit (typed, resolves)', typed);
  }

  // ── Ink Submit: the three-request receipt sequence ─────────────────────────
  for (let i = 0; i < SAMPLES; i++) {
    const issued = await issue(a.jar);
    const qid = issued.data.question.id;
    const { variable, root } = answerOf(issued.data.question);
    const image = picture(`${variable} = ${root}`, `legacy-${i}`);
    const readsBefore = provider.calls;
    // Read on request (#440): the student pressed Read my answer first; that is
    // the one paid read. /recognize at Submit replays it and never calls the reader.
    const shown = await counted('/v1/handwriting/transcribe', { method: 'POST', jar: a.jar, body: { image, questionId: qid } });
    c.eq(shown.status, 200, `legacy ink ${i}: Read my answer 200`);
    const recognized = await counted(`/v1/practice/${qid}/recognize`, { method: 'POST', jar: a.jar, body: { mode: 'ink', image } });
    c.eq(recognized.status, 201, `legacy ink ${i}: /recognize 201`);
    const confirmed = await counted(`/v1/practice/${qid}/recognition/${recognized.data.receipt}/confirm`, { method: 'POST', jar: a.jar, body: { text: root } });
    c.eq(confirmed.status, 201, `legacy ink ${i}: the answer is the last line, so a correction receipt is minted`);
    const submissionId = `hot-legacy-${i}`;
    const graded = await counted(`/v1/practice/${qid}/submit`, {
      method: 'POST', jar: a.jar, headers: { 'Idempotency-Key': submissionId },
      body: { submissionId, answer: root, mode: 'ink', transcriptionReceipt: confirmed.data.receipt }
    });
    c.eq(graded.status, 200, `legacy ink ${i}: /submit 200`);
    c.ok(graded.data?.correct === true, `legacy ink ${i}: marked right`);
    c.eq(provider.calls - readsBefore, 1, `legacy ink ${i}: one provider read, at Read my answer`);
    record('ink Submit, three requests (recognize + confirm + submit)', { trips: recognized.trips + confirmed.trips + graded.trips, ms: recognized.ms + confirmed.ms + graded.ms }, 3);
  }

  if (!LEGACY_ONLY) {
    // ── Ink Submit: one request ──────────────────────────────────────────────
    for (let i = 0; i < SAMPLES; i++) {
      const issued = await issue(a.jar);
      const qid = issued.data.question.id;
      const { variable, root } = answerOf(issued.data.question);
      // The page holds the equation's working and, on its last line, the answer.
      const image = picture(`${variable} = ${root}`, `single-${i}`);
      const readsBefore = provider.calls;
      // #440: never-read pictures are refused at Submit, with no provider call.
      const unread = await h.request(`/v1/practice/${qid}/submit`, {
        method: 'POST', jar: a.jar, headers: { 'Idempotency-Key': `hot-unread-${i}` },
        body: { submissionId: `hot-unread-${i}`, answer: root, mode: 'ink', image }
      });
      c.deq([unread.status, unread.data?.error?.code, provider.calls - readsBefore], [409, 'RECOGNITION_READ_EXPIRED', 0],
        `one-request ink ${i}: a picture never read is refused at Submit, nothing read or marked`);
      // The student presses Read my answer: the one paid read (not counted below).
      const shown = await h.request('/v1/handwriting/transcribe', { method: 'POST', jar: a.jar, body: { image, questionId: qid } });
      c.eq(shown.status, 200, `one-request ink ${i}: Read my answer 200`);
      const receiptsBefore = Number((await h.db.get("SELECT COUNT(*) AS n FROM idempotency_keys WHERE account_id=? AND scope='practice-recognition'", [a.id]))?.n);
      const submissionId = `hot-single-${i}`;
      const graded = await counted(`/v1/practice/${qid}/submit`, {
        method: 'POST', jar: a.jar, headers: { 'Idempotency-Key': submissionId },
        body: { submissionId, answer: root, mode: 'ink', image }
      });
      c.eq(graded.status, 200, `one-request ink ${i}: 200`);
      c.ok(graded.data?.correct === true && graded.data?.authoritative === true, `one-request ink ${i}: marked right by the server`);
      c.eq(provider.calls - readsBefore, 1, `one-request ink ${i}: one provider read, at Read my answer`);
      c.ok(graded.data?.reading?.corrected === true && typeof graded.data?.reading?.receipt === 'string', `one-request ink ${i}: the answer is not the whole transcript, so a correction receipt is written with the mark`);
      const receiptsAfter = Number((await h.db.get("SELECT COUNT(*) AS n FROM idempotency_keys WHERE account_id=? AND scope='practice-recognition'", [a.id]))?.n);
      c.eq(receiptsAfter - receiptsBefore, 2, `one-request ink ${i}: the provider and correction receipts are both stored`);
      record('ink Submit, one request (picture with the submission)', graded);
    }

    // The transcript the student was just shown is reused: Submit never pays
    // for a second read of an unchanged picture.
    {
      const issued = await issue(a.jar);
      const { variable, root } = answerOf(issued.data.question);
      const image = picture(`${variable} = ${root}`, 'shown-first');
      const shown = await h.request('/v1/handwriting/transcribe', { method: 'POST', jar: a.jar, body: { image } });
      c.eq(shown.status, 200, 'the page is read for display first');
      const readsBefore = provider.calls;
      const graded = await h.request(`/v1/practice/${issued.data.question.id}/submit`, {
        method: 'POST', jar: a.jar, headers: { 'Idempotency-Key': 'hot-shown' }, body: { submissionId: 'hot-shown', answer: root, mode: 'ink', image }
      });
      c.eq(graded.status, 200, 'Submit after the transcript was shown: 200');
      c.eq(provider.calls - readsBefore, 0, 'Submit after the transcript was shown: no second provider read');
      c.eq(graded.data?.reading?.reused, true, 'and says the reading was the one already paid for');
      const replay = await h.request(`/v1/practice/${issued.data.question.id}/submit`, {
        method: 'POST', jar: a.jar, headers: { 'Idempotency-Key': 'hot-shown' }, body: { submissionId: 'hot-shown', answer: root, mode: 'ink', image }
      });
      c.deq(replay.data, graded.data, 'a replay of the same submission returns the stored reply');
      c.eq(provider.calls - readsBefore, 0, 'and reads nothing');
    }

    // ── Answer-blind reading; the engine decides ─────────────────────────────
    {
      const issued = await issue(a.jar);
      const { variable, root } = answerOf(issued.data.question);
      const wrong = String(Number(root) + 1);
      // The page says the RIGHT answer; the student submits a WRONG one. The
      // mark is the engine's verdict on the submitted text.
      const image = picture(`${variable} = ${root}`, 'blind');
      const sentBefore = provider.sent.length;
      // Read on request (#440): the student has the page read first.
      await h.request('/v1/handwriting/transcribe', { method: 'POST', jar: a.jar, body: { image, questionId: issued.data.question.id } });
      const graded = await h.request(`/v1/practice/${issued.data.question.id}/submit`, {
        method: 'POST', jar: a.jar, headers: { 'Idempotency-Key': 'hot-blind' }, body: { submissionId: 'hot-blind', answer: wrong, mode: 'ink', image }
      });
      c.eq(graded.status, 200, 'answer-blind: 200');
      c.eq(graded.data?.correct, false, 'the reading never sets a mark: a wrong submitted answer is wrong whatever the page says');
      const sent = provider.sent.slice(sentBefore).join('\n');
      c.eq(provider.sent.length - sentBefore, 1, 'answer-blind: one request reached the reader');
      c.ok(!sent.includes(issued.data.question.prompt) && !sent.includes(issued.data.question.id), 'the reader is never sent the question or its id');
      c.ok(!sent.includes(`"${wrong}"`) && !/hot-blind/.test(sent), 'nor the submitted answer or its submission key');
      const blank = await h.request(`/v1/practice/${issued.data.question.id}/submit`, {
        method: 'POST', jar: a.jar, headers: { 'Idempotency-Key': 'hot-receipt-and-picture' },
        body: { submissionId: 'hot-receipt-and-picture', answer: root, mode: 'ink', image, transcriptionReceipt: 'abcdefgh12345' }
      });
      c.eq(blank.status, 400, 'a receipt and a picture together are refused');
      const typedPicture = await h.request(`/v1/practice/${issued.data.question.id}/submit`, {
        method: 'POST', jar: a.jar, headers: { 'Idempotency-Key': 'hot-typed-picture' },
        body: { submissionId: 'hot-typed-picture', answer: root, mode: 'typed', image }
      });
      c.eq(typedPicture.status, 400, 'a typed answer cannot carry a picture');
    }
  }

  // ── Sync and account reads ─────────────────────────────────────────────────
  for (let i = 0; i < SAMPLES; i++) {
    const pushed = await counted('/v1/sync/push', {
      method: 'POST', jar: a.jar, headers: { 'Idempotency-Key': `hot-push-${i}` },
      body: {
        schemaVersion: 1, deviceId: a.deviceId,
        events: Array.from({ length: 5 }, (_, k) => ({ id: `hot-${i}-${k}`, deviceId: a.deviceId, deviceSeq: i * 5 + k + 1, kind: 'practice-attempt', payload: { i, k } })),
        entities: [{ kind: 'bookmark', entityId: `hot-bookmark-${i}`, operation: 'upsert', baseVersion: 0, body: { i } }]
      }
    });
    c.ok(pushed.status >= 200 && pushed.status < 300, `sync push ${i}: ${pushed.status}`);
    record('POST /v1/sync/push (5 events + 1 entity)', pushed);
    const pulled = await counted('/v1/sync/pull/0', { jar: a.jar });
    c.eq(pulled.status, 200, `sync pull ${i}: 200`);
    record('GET /v1/sync/pull/0', pulled);
    const me = await counted('/v1/account/me', { jar: a.jar });
    c.eq(me.status, 200, `me ${i}: 200`);
    record('GET /v1/account/me', me);
    const guardian = await counted('/v1/account/guardian/state', { jar: a.jar });
    c.eq(guardian.status, 200, `guardian state ${i}: 200`);
    c.eq(guardian.data?.emailVerified, true, `guardian state ${i}: emailVerified from the session row`);
    record('GET /v1/account/guardian/state', guardian);
  }

  // ── consumeRateLimit: one statement, the same rule ─────────────────────────
  {
    const bucket = `hot-path-unit:${engine}`;
    const t0 = 1_000_000;
    const verdicts = [];
    for (let i = 0; i < 4; i++) verdicts.push(await consumeRateLimit(h.db, bucket, { limit: 3, windowMs: 1000 }, t0 + i));
    c.deq(verdicts.map(v => v.allowed), [true, true, true, false], 'rate limit: three allowed, the fourth refused');
    c.deq(verdicts.map(v => v.remaining), [2, 1, 0, 0], 'rate limit: remaining counts down');
    c.ok(verdicts.every(v => v.resetAt === t0 + 1000), 'rate limit: every verdict names the end of the same window');
    c.eq(Number((await h.db.get('SELECT count FROM rate_limits WHERE bucket=?', [bucket]))?.count), 3, 'rate limit: a refusal writes nothing');
    const restarted = await consumeRateLimit(h.db, bucket, { limit: 3, windowMs: 1000 }, t0 + 1000);
    c.deq([restarted.allowed, restarted.remaining, restarted.resetAt], [true, 2, t0 + 2000], 'rate limit: the window restarts once it has run out');
    trace.sql = []; trace.on = true;
    await consumeRateLimit(h.db, bucket, { limit: 3, windowMs: 1000 }, t0 + 1001);
    trace.on = false;
    if (!REPORT_ONLY) c.eq(trace.sql.length, 1, 'rate limit: an allowed unit is ONE statement (it was BEGIN, SELECT, UPDATE, COMMIT)');
  }

  // ── The meter agrees with the counting store; numbers only ─────────────────
  if (timingModule && !REPORT_ONLY) {
    const issued = await issue(a.jar);
    c.ok(issued.line, 'the access log line was written');
    c.eq(issued.line.dbRoundTrips, issued.trips, 'the meter\'s round trips equal the counting store\'s');
    c.ok(Number.isInteger(issued.line.dbStatements) && issued.line.dbStatements > 0 && issued.line.dbStatements < issued.line.dbRoundTrips, 'statements are counted apart from transaction control');
    c.eq(issued.line.dbTransactions, 1, 'issue: one transaction');
    c.ok(typeof issued.line.dbMs === 'number' && typeof issued.line.authMs === 'number' && typeof issued.line.eligibilityMs === 'number' && typeof issued.line.limitMs === 'number', 'phase milliseconds are numbers');
    const allowed = new Set(['ts', 'level', 'event', 'requestId', 'method', 'route', 'status', 'ms', 'code', 'release', 'db',
      'dbStatements', 'dbRoundTrips', 'dbTransactions', 'dbMs', 'dbAcquireMs', 'authMs', 'eligibilityMs', 'limitMs', 'providerMs', 'markerMs', 'commitMs', 'serializeMs']);
    c.deq(Object.keys(issued.line).filter(key => !allowed.has(key)), [], 'the log line carries no other field');
    const text = JSON.stringify(issued.line);
    c.ok(!text.includes(a.id) && !/SELECT|INSERT|idempotency_keys/.test(text) && !text.includes(issued.data.question.id), 'no account id, SQL or question id in it');
    c.eq(issued.headers.get('server-timing'), null, 'Server-Timing is off by default');

    if (metricsModule) {
      const snap = metricsModule.metrics.snapshot();
      const key = 'http_route_ms{route=POST:.v1.practice.issue}';
      c.ok(snap.latency[key]?.count >= SAMPLES, '/v1/metrics: latency per route template');
      c.ok(snap.latency['http_route_db_ms{route=POST:.v1.practice.issue}']?.count >= SAMPLES, '/v1/metrics: database ms per route template');
      c.ok(snap.counters['http_route_db_round_trips_total{route=POST:.v1.practice.issue}']?.total > 0, '/v1/metrics: round trips per route template');
      c.ok(Object.keys(snap.latency).filter(k => k.startsWith('http_route_ms{')).every(k => !/[0-9a-f]{8}-[0-9a-f]{4}/.test(k)), 'route labels are templates, never ids');
    }

    process.env.PRI_SERVER_TIMING = '1';
    try {
      const timed = await counted('/v1/account/me', { jar: a.jar });
      const header = timed.headers.get('server-timing') || '';
      c.match(header, /^total;dur=[\d.]+, db;dur=[\d.]+;desc="\d+ statements, \d+ round trips, \d+ transactions", dbacquire;dur=[\d.]+/, 'PRI_SERVER_TIMING=1: a signed-in caller gets the breakdown');
      c.ok(header.includes(`${timed.line.dbRoundTrips} round trips`), 'the header carries the same numbers as the log line');
      c.ok(!/[A-Za-z]{3,}@|acct_|SELECT/.test(header), 'numbers and fixed metric names only');
      const anonymous = await counted('/v1/account/me', {});
      c.eq(anonymous.status, 401, 'an anonymous caller is refused');
      c.eq(anonymous.headers.get('server-timing'), null, 'and is never sent the breakdown (a statement count is a side channel)');
      const health = await counted('/v1/health', {});
      c.eq(health.headers.get('server-timing'), null, 'nor is an anonymous health check');
    } finally { delete process.env.PRI_SERVER_TIMING; }
  }

  // ── Every transaction still declares its scope (RLS) ───────────────────────
  if (engine === 'postgres') {
    trace.sql = []; trace.on = true;
    const issued = await h.request('/v1/practice/issue', { method: 'POST', jar: a.jar, body: { generator: 'c8-linear-equations-both-sides', difficulty: 2, seed: seed++, curriculum: 'in' } });
    if (!LEGACY_ONLY) {
      const { variable, root } = answerOf(issued.data.question);
      await h.request(`/v1/practice/${issued.data.question.id}/submit`, {
        method: 'POST', jar: a.jar, headers: { 'Idempotency-Key': 'hot-scope' }, body: { submissionId: 'hot-scope', answer: root, mode: 'ink', image: picture(`${variable} = ${root}`, 'scope') }
      });
    }
    trace.on = false;
    const begins = trace.sql.filter(sql => /^BEGIN\b/.test(sql));
    c.ok(begins.length >= 1, 'the hot paths open transactions');
    c.eq(begins.filter(sql => !/; SET LOCAL pri\.scope = '(system|account)'; SET LOCAL pri\.account_id = '[A-Za-z0-9_.:-]*'$/.test(sql)).length, 0,
      'every transaction still declares pri.scope in its BEGIN');
    c.eq(trace.sql.filter(sql => sql === 'COMMIT').length, begins.length, 'every COMMIT closes one of them');
    // No account scope leaks back to the pool: after those account-scoped
    // transactions, every pooled connection is back in system scope.
    const after = await Promise.all(Array.from({ length: 4 }, () => h.db.get("SELECT current_setting('pri.scope', true) AS scope, current_setting('pri.account_id', true) AS account")));
    c.ok(after.every(row => row.scope === 'system' && row.account === ''), 'pooled connections return to system scope with no account (SET LOCAL reverts at COMMIT)');
  }

  // ── The pins ───────────────────────────────────────────────────────────────
  // Round trips per hot request after this change, measured by this suite.
  // The trailing comment is the same suite run (--report --legacy) against
  // origin/main d76725115, before this change, so a reviewer can see what each
  // pin replaced. (The one-request Submit did not exist: an ink Submit was the
  // three-request sequence.)
  // practice/issue re-measured on merge train 9: the free plan's daily cap
  // (#537, practiceAllowance.js) reads the entitlement snapshot and today's
  // count, then counts the issue, inside the issue transaction — 7 -> 11 on
  // sqlite and 9 -> 13 on postgres, measured with --report on both engines.
  const PINS = {
    sqlite: {
      'POST /v1/practice/issue': 11,                                     // was 13 (7 before the #537 cap)
      // Train 10, --report on both engines: +2 per submit for the server-charged
      // hint ladder (#584, the rung served so far) and misconception targeting
      // (#586) — 17 -> 19 sqlite, 19 -> 21 postgres; the ink paths likewise.
      'POST /v1/practice/:id/submit (typed, resolves)': 19,              // was 34
      // #440 read on request: the paid read is Read my answer (/handwriting/transcribe,
      // not counted here); /recognize at Submit replays it — 45 -> 35, --report on sqlite.
      'ink Submit, three requests (recognize + confirm + submit)': 37,   // was 86
      'ink Submit, one request (picture with the submission)': 21,       // 29 before #440 (the read moved to Read my answer); was 86
      'POST /v1/sync/push (5 events + 1 entity)': 32,                    // was 37
      'GET /v1/sync/pull/0': 9,                                          // was 14
      'GET /v1/account/me': 1,                                           // was 1
      'GET /v1/account/guardian/state': 2                                // was 4
    },
    postgres: {
      'POST /v1/practice/issue': 13,                                     // was 15 (9 before the #537 cap)
      'POST /v1/practice/:id/submit (typed, resolves)': 21,              // was 37
      // #440 moved the paid read to Read my answer (its sqlite pins fell 10);
      // postgres measured here with the train-10 +2: 51 -> 43 and 31 -> 23.
      'ink Submit, three requests (recognize + confirm + submit)': 43,   // was 94
      'ink Submit, one request (picture with the submission)': 23,       // was 94 (three requests)
      'POST /v1/sync/push (5 events + 1 entity)': 34,                    // was 39
      'GET /v1/sync/pull/0': 9,                                          // was 14
      'GET /v1/account/me': 1,                                           // was 1
      'GET /v1/account/guardian/state': 2                                // was 4
    }
  };
  console.log(`round trips per hot request on ${engine} (every sample; median loopback ms — not pinned):`);
  for (const entry of report) {
    const sorted = [...entry.ms].sort((x, y) => x - y);
    console.log(`  ${entry.label.padEnd(60)} ${entry.requests} req  trips ${entry.trips.join('/')}  ${sorted[Math.floor(sorted.length / 2)].toFixed(1)} ms`);
  }
  if (!REPORT_ONLY) {
    for (const entry of report) {
      const pin = PINS[engine][entry.label];
      c.ok(pin !== undefined, `${entry.label}: has a pin`);
      c.deq(entry.trips, entry.trips.map(() => pin), `${entry.label}: exactly ${pin} round trips on ${engine}`);
    }
    c.eq(measured.get('ink Submit, one request (picture with the submission)')?.requests, 1, 'ink Submit is one request');
  }
} finally {
  await h.close();
  await new Promise(resolve => fake.close(resolve));
  rmSync(dir, { recursive: true, force: true });
  for (const [name, value] of Object.entries(previous)) {
    if (value === undefined) delete process.env[name]; else process.env[name] = value;
  }
}

console.log(`engine: ${engine}`);
console.log(`HOT PATH BUDGET: PASS — ${c.count()}/${c.count()} checks — round trips pinned per hot request on ${engine}; ink Submit is one request with one paid read, answer-blind, marked by the engine; the meter is numbers only and Server-Timing is opt-in for signed-in callers.`);
