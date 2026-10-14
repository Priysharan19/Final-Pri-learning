// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · what the hot paths cost, counted (server/platform/requestTiming.js)
//
//   node server/test/hot-path-budget-check.mjs                     (SQLite)
//   node server/test/hot-path-budget-check.mjs --engine=postgres   (scripts/with-postgres.mjs)
//
// One handwritten answer is a handful of /v1 requests, and each request is a
// number of database statements. When the app and its database are in different
// regions every statement is a wire round trip of 100 ms or more, so a count
// that creeps up is seconds a student waits. This suite drives the shipped app
// (server/app.js → /v1) over a real loopback socket, reads each request's own
// meter from its `http_request` log line, and PINS, per engine:
//
//   · statements, wire round trips and transactions for every hot request;
//   · how many requests one student action takes.
//
// A change that adds a statement to one of these paths fails here and has to
// change the pinned number on purpose. The numbers below are MEASURED from this
// suite; none is a target that was written down first.
//
// Benchmark mode (not run in CI) reports wall time under an injected, test-only
// per-round-trip delay (PostgresStore.testRoundTripDelayMs):
//
//   node scripts/with-postgres.mjs node server/test/hot-path-budget-check.mjs \
//        --engine=postgres --bench=30 --latency=100 [--legacy] [--provider-ms=0]
//
// Evidence class: LOCAL and SYNTHETIC. The reader is a local HTTP fixture that
// answers at once with the text encoded in the picture — it is not the real
// reader and says nothing about reading accuracy or the provider's latency. The
// injected delay models distance to the database; it is not a measurement of
// any deployment.
// ─────────────────────────────────────────────────────────────────────────────
import { createServer } from 'node:http';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const arg = name => {
  const flag = process.argv.find(value => value === `--${name}` || value.startsWith(`--${name}=`));
  if (!flag) return null;
  return flag.includes('=') ? flag.slice(flag.indexOf('=') + 1) : true;
};
const BENCH = arg('bench') ? Math.max(1, Number(arg('bench')) || 30) : 0;
const LATENCY = Number(arg('latency') || 0);
const PROVIDER_MS = Number(arg('provider-ms') || 0);
// The three-request Submit the client made before /submit accepted the picture.
const LEGACY_ONLY = arg('legacy') === true;

const dir = mkdtempSync(join(tmpdir(), 'pri-hot-path-'));

// ── The synthetic reader ─────────────────────────────────────────────────────
// A picture is a tagged byte string; the reader answers with the lines it holds.
const picture = (lines, salt = '') =>
  'data:image/png;base64,' + Buffer.from(`SYNTHETIC|${JSON.stringify(lines)}|${salt}|` + 'a'.repeat(300)).toString('base64');
const provider = { calls: 0 };
const fake = createServer((req, res) => {
  let raw = '';
  req.on('data', chunk => { raw += chunk; });
  req.on('end', () => {
    const sent = JSON.parse(raw);
    const image = sent.input[1].content.find(part => part.type === 'input_image').image_url;
    const lines = JSON.parse(Buffer.from(image.split(',')[1], 'base64').toString('utf8').split('|')[1]);
    provider.calls += 1;
    setTimeout(() => {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({
        model: sent.model,
        output_text: JSON.stringify({ lines: lines.map(text => ({ text, latex: '', confidence: 0.97 })), confidence: 0.97, needs_confirmation: false }),
        usage: { input_tokens: 1000, output_tokens: 60, total_tokens: 1060 }
      }));
    }, PROVIDER_MS);
  });
});
await new Promise(resolve => fake.listen(0, '127.0.0.1', resolve));

const vars = ['NODE_ENV', 'PRI_PLATFORM_DB', 'PRI_AUTH_DELIVERY_KEY', 'PRI_PUBLIC_ORIGIN', 'PRI_HANDWRITING_API_KEY',
  'PRI_HANDWRITING_ENDPOINT', 'PRI_HANDWRITING_MODEL', 'PRI_HANDWRITING_FALLBACK_MODEL', 'PRI_HANDWRITING_TIMEOUT_MS',
  'PRI_PAID_CALLS_PER_HOUR', 'PRI_PAID_CALLS_PER_DAY', 'PRI_AI_DAILY_FREE', 'PRI_AI_DAILY_PREMIUM', 'PRI_SERVER_TIMING'];
const previous = Object.fromEntries(vars.map(name => [name, process.env[name]]));
Object.assign(process.env, {
  NODE_ENV: 'test', PRI_PLATFORM_DB: join(dir, 'test.sqlite'), PRI_AUTH_DELIVERY_KEY: 'eb'.repeat(32),
  PRI_HANDWRITING_API_KEY: 'local-synthetic-reader', PRI_HANDWRITING_ENDPOINT: `http://127.0.0.1:${fake.address().port}/v1/responses`,
  PRI_HANDWRITING_MODEL: 'synthetic-primary', PRI_HANDWRITING_FALLBACK_MODEL: 'synthetic-primary', PRI_HANDWRITING_TIMEOUT_MS: '20000',
  PRI_PAID_CALLS_PER_HOUR: '100000', PRI_PAID_CALLS_PER_DAY: '1000000', PRI_AI_DAILY_FREE: '100000', PRI_AI_DAILY_PREMIUM: '100000',
  PRI_SERVER_TIMING: '1'
});
delete process.env.PRI_PUBLIC_ORIGIN;

const { startApp, registerAccount, verifyEmail, checks } = await import('./support/app-harness.mjs');
const { requestedEngine } = await import('./support/engine.mjs');
const { solveLinearPrompt } = await import('./support/linear-equation.mjs');
const { TIMING_PHASES } = await import('../platform/requestTiming.js');

const c = checks();
const lines = new Map();
const h = await startApp({ engine: requestedEngine(), log: line => { if (line.requestId) lines.set(line.requestId, line); } });
const engine = h.engine;
console.log(`engine: ${engine}`);

let serial = 0;
/** One request, and the server's own meter for it. */
async function call(path, options = {}, attempt = 0) {
  // A session's idle window slides at most once a minute, with one UPDATE. On
  // a slow machine that write would land in whichever request crossed the
  // minute; keep every counted request inside it (not part of any count: this
  // statement is made by the suite, outside the request).
  if (!BENCH) await h.db.run('UPDATE account_sessions SET last_seen_at = ?', [Date.now()]);
  const requestId = `hot-${++serial}-${Math.random().toString(36).slice(2, 10)}`;
  const started = performance.now();
  const response = await h.request(path, { ...options, headers: { ...(options.headers || {}), 'X-Request-Id': requestId } });
  const wall = performance.now() - started;
  // Benchmark only: a long run on a busy machine can lose a loopback connection
  // to the throwaway Postgres. That answer is the coded, retryable 503, nothing
  // was written, and the sample is taken again rather than recorded.
  if (BENCH && response.status === 503 && response.data?.error?.retryable === true && /^PLATFORM_DB_/.test(response.data.error.code) && attempt < 5) {
    lines.delete(requestId);
    return call(path, options, attempt + 1);
  }
  // The log line is written on `finish`, a tick after the client has its reply.
  for (let i = 0; i < 400 && !lines.has(requestId); i++) await new Promise(resolve => setTimeout(resolve, 5));
  const line = lines.get(requestId);
  if (!line) throw new Error(`no http_request line for ${path}`);
  lines.delete(requestId);
  return {
    status: response.status, data: response.data, headers: response.headers, wall, line,
    cost: { statements: line.dbStatements, roundTrips: line.dbRoundTrips, transactions: line.dbTransactions }
  };
}

let students = 0;
async function student() {
  students += 1;
  await h.db.run("DELETE FROM rate_limits WHERE bucket LIKE 'register:%'");
  const account = await registerAccount(h, { email: `hot.path.${students}@example.test`, deviceId: `hot-ipad-${students}` });
  if (account.status !== 201) throw new Error(`register: ${account.status} ${account.text}`);
  const verified = await verifyEmail(h, account.account.id);
  if (verified.status !== 200) throw new Error(`verify: ${verified.status}`);
  return { jar: account.jar, id: account.account.id };
}

let seeds = 7000;
async function issue(s) {
  const response = await call('/v1/practice/issue', { method: 'POST', jar: s.jar,
    body: { generator: 'c8-linear-equations-both-sides', difficulty: 2, seed: ++seeds, curriculum: 'in' } });
  if (response.status !== 201) throw new Error(`issue: ${response.status} ${JSON.stringify(response.data)}`);
  const solved = solveLinearPrompt(response.data.question.prompt);
  return { response, qid: response.data.question.id, answer: `${solved.variable} = ${solved.root}`, working: `${solved.lhs} = ${solved.rhs}` };
}

let submissions = 0;
const submissionId = () => `hot-submission-${++submissions}-${Math.random().toString(36).slice(2, 10)}`;
const expectOk = (response, status, what) => {
  if (response.status !== status) throw new Error(`${what}: ${response.status} ${JSON.stringify(response.data)}`);
  return response;
};
const graded = (response, what) => {
  expectOk(response, 200, what);
  if (response.data.correct !== true || response.data.resolved !== true) throw new Error(`${what}: not marked correct ${JSON.stringify(response.data).slice(0, 300)}`);
  return response;
};

// ── The student actions ──────────────────────────────────────────────────────
// Each returns the requests it made, in order. `single` is what the shipped
// client does now; `legacy` is the sequence it made before (still supported).
const actions = {
  async typed(s) {
    const q = await issue(s);
    const id = submissionId();
    const submit = graded(await call(`/v1/practice/${q.qid}/submit`, { method: 'POST', jar: s.jar, headers: { 'Idempotency-Key': id },
      body: { submissionId: id, answer: q.answer, mode: 'typed' } }), 'typed submit');
    return { issue: q.response, submit };
  },
  // Ink: the transcript is shown first (/handwriting/transcribe), then Submit.
  async ink(s, { flow, corrected }) {
    const q = await issue(s);
    // "corrected": the page holds a line of working and the answer; the answer
    // submitted is the last line, which is not the whole transcript.
    const page = corrected ? [q.working, q.answer] : [q.answer];
    const image = picture(page, `${q.qid}`);
    const read = expectOk(await call('/v1/handwriting/transcribe', { method: 'POST', jar: s.jar, body: { image } }), 200, 'transcribe');
    const id = submissionId();
    if (flow === 'single') {
      const submit = graded(await call(`/v1/practice/${q.qid}/submit`, { method: 'POST', jar: s.jar, headers: { 'Idempotency-Key': id },
        body: { submissionId: id, answer: q.answer, mode: 'ink', image, ...(corrected ? { steps: q.working } : {}) } }), 'ink submit');
      return { read, press: [submit] };
    }
    const recognize = expectOk(await call(`/v1/practice/${q.qid}/recognize`, { method: 'POST', jar: s.jar, body: { mode: 'ink', image } }), 201, 'recognize');
    const press = [recognize];
    let receipt = recognize.data.receipt;
    if (recognize.data.transcription.text !== q.answer) {
      const confirm = expectOk(await call(`/v1/practice/${q.qid}/recognition/${receipt}/confirm`, { method: 'POST', jar: s.jar, body: { text: q.answer } }), 201, 'confirm');
      press.push(confirm);
      receipt = confirm.data.receipt;
    }
    press.push(graded(await call(`/v1/practice/${q.qid}/submit`, { method: 'POST', jar: s.jar, headers: { 'Idempotency-Key': id },
      body: { submissionId: id, answer: q.answer, mode: 'ink', transcriptionReceipt: receipt, ...(corrected ? { steps: q.working } : {}) } }), 'ink submit'));
    return { read, press };
  },
  // Photo: nothing is read until Submit, so the reader is called inside it.
  async photo(s, { flow }) {
    const q = await issue(s);
    const image = picture([q.answer], `photo-${q.qid}`);
    const id = submissionId();
    if (flow === 'single') {
      return { press: [graded(await call(`/v1/practice/${q.qid}/submit`, { method: 'POST', jar: s.jar, headers: { 'Idempotency-Key': id },
        body: { submissionId: id, answer: q.answer, mode: 'photo', image } }), 'photo submit')] };
    }
    const recognize = expectOk(await call(`/v1/practice/${q.qid}/recognize`, { method: 'POST', jar: s.jar, body: { mode: 'photo', image } }), 201, 'recognize');
    const submit = graded(await call(`/v1/practice/${q.qid}/submit`, { method: 'POST', jar: s.jar, headers: { 'Idempotency-Key': id },
      body: { submissionId: id, answer: q.answer, mode: 'photo', transcriptionReceipt: recognize.data.receipt } }), 'photo submit');
    return { press: [recognize, submit] };
  },
  async reads(s) {
    return {
      me: expectOk(await call('/v1/account/me', { jar: s.jar }), 200, 'me'),
      guardianState: expectOk(await call('/v1/account/guardian/state', { jar: s.jar }), 200, 'guardian state'),
      handwritingStatus: expectOk(await call('/v1/handwriting/status', { jar: s.jar }), 200, 'handwriting status'),
      workingStatus: expectOk(await call('/v1/working/status', { jar: s.jar }), 200, 'working status')
    };
  }
};

const sum = requests => requests.reduce((total, r) => ({
  statements: total.statements + r.cost.statements, roundTrips: total.roundTrips + r.cost.roundTrips, transactions: total.transactions + r.cost.transactions
}), { statements: 0, roundTrips: 0, transactions: 0 });
const triple = cost => [cost.statements, cost.roundTrips, cost.transactions];

// ── The pinned budget: [statements, round trips, transactions] ───────────────
// MEASURED by this suite on each engine (run it with --measure to retake them).
// Round trips exceed statements by the transaction control: BEGIN and COMMIT on
// both engines, and on Postgres also taking and releasing the account's lock
// and setting the account scope. Opening a connection is not a request's cost
// and is metered as connection wait instead.
const BUDGET = {
  sqlite: {
    'GET /v1/account/me': [1, 1, 0],
    'GET /v1/account/guardian/state': [2, 2, 0],
    'GET /v1/handwriting/status': [3, 3, 0],
    'GET /v1/working/status': [2, 2, 0],
    'POST /v1/practice/issue': [5, 7, 1],
    'POST /v1/practice/:id/submit (typed)': [15, 17, 1],
    'POST /v1/handwriting/transcribe (new picture)': [10, 14, 2],
    'POST /v1/practice/:id/submit (ink, picture already read)': [17, 19, 1],
    'POST /v1/practice/:id/submit (ink, answer is one line of the page)': [17, 19, 1],
    'POST /v1/practice/:id/submit (photo, read here)': [23, 29, 3],
    'legacy POST /v1/practice/:id/recognize (picture already read)': [9, 11, 1],
    'legacy POST /v1/practice/:id/recognition/:receipt/confirm': [5, 7, 1],
    'legacy POST /v1/practice/:id/submit (ink receipt)': [15, 17, 1]
  },
  postgres: {
    'GET /v1/account/me': [1, 1, 0],
    'GET /v1/account/guardian/state': [2, 2, 0],
    'GET /v1/handwriting/status': [3, 3, 0],
    'GET /v1/working/status': [2, 2, 0],
    'POST /v1/practice/issue': [5, 10, 1],
    'POST /v1/practice/:id/submit (typed)': [15, 20, 1],
    'POST /v1/handwriting/transcribe (new picture)': [10, 15, 2],
    'POST /v1/practice/:id/submit (ink, picture already read)': [17, 22, 1],
    'POST /v1/practice/:id/submit (ink, answer is one line of the page)': [17, 22, 1],
    'POST /v1/practice/:id/submit (photo, read here)': [23, 33, 3],
    'legacy POST /v1/practice/:id/recognize (picture already read)': [9, 14, 1],
    'legacy POST /v1/practice/:id/recognition/:receipt/confirm': [5, 10, 1],
    'legacy POST /v1/practice/:id/submit (ink receipt)': [15, 20, 1]
  }
};

const percentile = (values, p) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(p * sorted.length) - 1))];
};

try {
  const s = await student();
  // Warm every path once: the marker workers import the engine, the pool opens
  // its connections and sets their session, the statement caches fill. None of
  // that is a per-request cost, and none of it is counted below.
  await actions.reads(s);
  await actions.typed(s);
  if (!LEGACY_ONLY) await actions.ink(s, { flow: 'single', corrected: true });
  await actions.ink(s, { flow: 'legacy', corrected: true });

  if (BENCH) {
    // ══ Benchmark: wall time under an injected per-round-trip delay ══════════
    if (LATENCY > 0) {
      if (engine !== 'postgres') throw new Error('--latency needs --engine=postgres: SQLite has no wire round trip to delay.');
      h.db.testRoundTripDelayMs = LATENCY;
    }
    const samples = new Map();
    const record = (name, request) => {
      if (!samples.has(name)) samples.set(name, { wall: [], cost: request.cost, requests: 1 });
      samples.get(name).wall.push(request.wall);
    };
    const recordAction = (name, requests) => {
      if (!samples.has(name)) samples.set(name, { wall: [], cost: sum(requests), requests: requests.length });
      samples.get(name).wall.push(requests.reduce((total, r) => total + r.wall, 0));
    };
    const flows = LEGACY_ONLY ? ['legacy'] : ['legacy', 'single'];
    for (let i = 0; i < BENCH; i++) {
      // A long run makes more requests an hour than one student may (which the
      // per-account request limits rightly refuse). The benchmark is not a
      // student: its own buckets are cleared between rounds, by the suite.
      await h.db.run("DELETE FROM rate_limits WHERE bucket LIKE 'practice-%' OR bucket LIKE 'handwriting-%'");
      const reads = await actions.reads(s);
      record('GET /v1/account/me', reads.me);
      record('GET /v1/account/guardian/state', reads.guardianState);
      record('GET /v1/handwriting/status', reads.handwritingStatus);
      record('GET /v1/working/status', reads.workingStatus);
      const typed = await actions.typed(s);
      record('POST /v1/practice/issue', typed.issue);
      record('POST /v1/practice/:id/submit (typed)', typed.submit);
      for (const flow of flows) {
        const plain = await actions.ink(s, { flow, corrected: false });
        if (flow === flows[0]) record('POST /v1/handwriting/transcribe (new picture)', plain.read);
        recordAction(`ACTION Submit ink, reading unchanged [${flow}]`, plain.press);
        const corrected = await actions.ink(s, { flow, corrected: true });
        recordAction(`ACTION Submit ink, answer is one line of the page [${flow}]`, corrected.press);
        if (flow === 'legacy') {
          record('legacy POST /v1/practice/:id/recognize (picture already read)', corrected.press[0]);
          record('legacy POST /v1/practice/:id/recognition/:receipt/confirm', corrected.press[1]);
          record('legacy POST /v1/practice/:id/submit (ink receipt)', corrected.press[2]);
        }
        const photo = await actions.photo(s, { flow });
        recordAction(`ACTION Submit photo [${flow}]`, photo.press);
      }
    }
    console.log(`\nBENCH engine=${engine} runs=${BENCH} injectedRoundTripDelayMs=${LATENCY} syntheticReaderMs=${PROVIDER_MS} (local, synthetic reader)`);
    console.log('| what | requests | statements | round trips | transactions | p50 ms | p95 ms |');
    console.log('|---|---:|---:|---:|---:|---:|---:|');
    for (const [name, sample] of samples) {
      console.log(`| ${name} | ${sample.requests} | ${sample.cost.statements} | ${sample.cost.roundTrips} | ${sample.cost.transactions} | ${Math.round(percentile(sample.wall, 0.5))} | ${Math.round(percentile(sample.wall, 0.95))} |`);
    }
    console.log(`synthetic reader calls: ${provider.calls}`);
  } else {
    // ══ Check: the pinned counts ═════════════════════════════════════════════
    const budget = BUDGET[engine];
    // --measure prints what each request cost instead of asserting it: how the
    // pinned numbers above are (re)taken when a path is changed on purpose.
    const pin = (name, request) => (arg('measure')
      ? console.log(`    '${name}': ${JSON.stringify(triple(request.cost)).replace(/,/g, ', ')},`)
      : c.deq(triple(request.cost), budget[name], `${name}: [statements, round trips, transactions] = ${JSON.stringify(triple(request.cost))}`));

    const reads = await actions.reads(s);
    pin('GET /v1/account/me', reads.me);
    pin('GET /v1/account/guardian/state', reads.guardianState);
    pin('GET /v1/handwriting/status', reads.handwritingStatus);
    pin('GET /v1/working/status', reads.workingStatus);

    const typed = await actions.typed(s);
    pin('POST /v1/practice/issue', typed.issue);
    pin('POST /v1/practice/:id/submit (typed)', typed.submit);

    // ── One press of Submit is ONE request, and no second paid read ──────────
    const before = provider.calls;
    const plain = await actions.ink(s, { flow: 'single', corrected: false });
    pin('POST /v1/handwriting/transcribe (new picture)', plain.read);
    c.eq(plain.press.length, 1, 'Submit of a handwritten answer whose reading is unchanged is one request');
    pin('POST /v1/practice/:id/submit (ink, picture already read)', plain.press[0]);
    c.eq(provider.calls - before, 1, 'showing the transcript and marking it cost one read of the picture in total');

    const callsBeforeCorrected = provider.calls;
    const corrected = await actions.ink(s, { flow: 'single', corrected: true });
    c.eq(corrected.press.length, 1, 'Submit of an answer that is one line of the page is one request');
    pin('POST /v1/practice/:id/submit (ink, answer is one line of the page)', corrected.press[0]);
    c.eq(provider.calls - callsBeforeCorrected, 1, 'and still one read of that picture in total');

    const callsBeforePhoto = provider.calls;
    const photo = await actions.photo(s, { flow: 'single' });
    c.eq(photo.press.length, 1, 'Submit of a photographed answer is one request');
    pin('POST /v1/practice/:id/submit (photo, read here)', photo.press[0]);
    c.eq(provider.calls - callsBeforePhoto, 1, 'which reads the photo exactly once');

    // ── The earlier three-request sequence still works, at its own budget ────
    const legacy = await actions.ink(s, { flow: 'legacy', corrected: true });
    c.eq(legacy.press.length, 3, 'the receipt sequence is recognize, confirm, submit');
    pin('legacy POST /v1/practice/:id/recognize (picture already read)', legacy.press[0]);
    pin('legacy POST /v1/practice/:id/recognition/:receipt/confirm', legacy.press[1]);
    pin('legacy POST /v1/practice/:id/submit (ink receipt)', legacy.press[2]);
    const single = sum(corrected.press);
    const three = sum(legacy.press);
    c.ok(single.roundTrips < three.roundTrips && single.statements < three.statements,
      `one request costs less than the three it replaces (${JSON.stringify(triple(single))} against ${JSON.stringify(triple(three))})`);

    // ── The meter itself: numbers only, and only for a signed-in caller ──────
    const header = typed.submit.headers.get('server-timing') || '';
    c.match(header, /^total;dur=[\d.]+, db;dur=[\d.]+;desc="\d+ statements, \d+ round trips, \d+ transactions", dbacquire;dur=[\d.]+(?:, (?:auth|eligibility|limit|provider|marker|commit|serialize);dur=[\d.]+)*$/,
      'Server-Timing carries metric names from the closed list and numbers only');
    c.ok(typed.submit.line.markerMs >= 0 && typed.submit.line.commitMs > 0 && typed.submit.line.authMs >= 0, 'the request line carries the marker, commit and auth phases');
    c.ok(plain.read.line.providerMs > 0, 'a read that reached the reader carries the provider phase');
    c.ok(Object.keys(typed.submit.line).filter(key => /Ms$|^db[A-Z]/.test(key)).every(key =>
      ['dbStatements', 'dbRoundTrips', 'dbTransactions', 'dbMs', 'dbAcquireMs', ...TIMING_PHASES.map(name => `${name}Ms`)].includes(key) && typeof typed.submit.line[key] === 'number'),
    'every timing field on the request line is a number from the closed list');
    const anonymous = await call('/v1/account/login', { method: 'POST', body: { email: 'nobody@example.test', password: 'not-a-real-password', deviceId: 'hot-anon' } });
    c.eq(anonymous.headers.get('server-timing'), null, 'an anonymous caller is never sent the breakdown (a statement count is a side channel)');
    process.env.PRI_SERVER_TIMING = '';
    const quiet = await startApp({ engine: 'sqlite' });
    try {
      const account = await registerAccount(quiet, { email: 'hot.path.quiet@example.test', deviceId: 'hot-quiet' });
      const me = await quiet.request('/v1/account/me', { jar: account.jar });
      c.deq([me.status, me.headers.get('server-timing')], [200, null], 'and no caller is sent it unless PRI_SERVER_TIMING=1');
    } finally { await quiet.close(); }

    console.log(`HOT PATH BUDGET: PASS — ${c.count()}/${c.count()} checks — on ${engine}, statements/round trips/transactions pinned for 13 hot requests; a handwritten or photographed Submit is one request and one read of the picture (synthetic local reader).`);
  }
} finally {
  await h.close();
  await new Promise(resolve => fake.close(resolve));
  rmSync(dir, { recursive: true, force: true });
  for (const name of vars) { if (previous[name] === undefined) delete process.env[name]; else process.env[name] = previous[name]; }
}
