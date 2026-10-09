// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the real marking authority for the deterministic client suites
//
// Owner decision 2026-10-10: grading is online-only and server-authoritative.
// Checking an answer, awarding marks and showing a solution need a verified,
// eligible, signed-in account, a connection and a server-issued question. The
// suites that drive client/src/local/backend.js in Node therefore need a real
// server behind them. This helper gives them one, and nothing else:
//
//   · the shipped /v1 app (server/app.js, the whole middleware chain) booted
//     in-process on its own SQLite database over a real loopback socket, via
//     server/test/support/app-harness.mjs — no route is stubbed and no mark is
//     ever produced here;
//   · a real, email-verified adult account per test profile, linked to the
//     local profile by the product's own loginCloudAccount(), so
//     profileCloudAccountId(pid) and the session cookie agree;
//   · a cookie jar per profile. The device has one session at a time; a suite
//     that switches profile is a student signing in again, so the jar follows
//     the selected local profile unless the suite pins another one;
//   · switches a suite uses to prove the refusals: signed out (no cookies
//     leave the device), offline (the request never leaves the device), and
//     another profile's session (the wrong account);
//   · a record of what each /v1/practice/issue request asked for (generator,
//     difficulty, seed) keyed by the server's question id. A server-issued row
//     carries no answer on the device, so a suite that needs "the right answer"
//     regenerates the question from those parameters with the engine — a test
//     oracle, never something the product reads.
//
//   · with `ink: true`, what a handwritten submission needs to reach the
//     server from Node: a canvas stand-in so the device can rasterise strokes
//     (Node has none), and a loopback stand-in for the third-party handwriting
//     reader (the Responses API) that the SERVER calls. The stand-in reads
//     every page as the same fixed text; the product then sends the student's
//     own confirmed text through the server's correction receipt, exactly as
//     it does when a student corrects a reading. The reader never sees a
//     question or an answer, and it never marks anything.
//
// The fetch wrapper only attaches cookies and counts traffic; requests are
// forwarded byte-for-byte to the real server and its replies are returned
// untouched.
//
// Time compression: these suites replay days or weeks of practice in seconds,
// so the server's hourly abuse limiters (proved by server/test/abuse-limits-
// check.mjs) would read a suite as abuse. Their buckets are cleared as the
// suite goes unless it asks for `keepRateLimits`. No marking rule is touched.
//
// Import it AFTER installBrowserEnv() and BEFORE importing anything from
// client/src, with a top-level `await startOnlineAuthority()`.
// ─────────────────────────────────────────────────────────────────────────────
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const ENV_NAMES = ['NODE_ENV', 'PRI_PLATFORM_DB', 'PRI_AUTH_DELIVERY_KEY', 'PRI_PUBLIC_ORIGIN',
  'PRI_HANDWRITING_API_KEY', 'PRI_HANDWRITING_ENDPOINT', 'PRI_HANDWRITING_MODEL', 'PRI_HANDWRITING_FALLBACK_MODEL',
  'PRI_PAID_CALLS_PER_HOUR', 'PRI_PAID_CALLS_PER_DAY', 'PRI_AI_DAILY_FREE', 'PRI_AI_DAILY_PREMIUM'];
// A 1×1 white PNG. The reader stand-in does not look at it; the server only
// checks that what the device sent is a bounded base64 image.
const BLANK_PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4//8/AwAI/AL+p5qgoAAAAABJRU5ErkJggg==';
/** What the reader stand-in "reads" on every page. Never a valid answer. */
export const READER_TEXT = 'reader stand-in';
const PASSWORD = 'correct-horse-battery';
const PREMIUM_DAYS = 30;

/** A stable submission key the way the card mints one per tap. */
let submissionSeq = 0;
export const nextSubmissionId = (prefix = 'sub_suite') =>
  `${prefix}_${String(++submissionSeq).padStart(6, '0')}_${Date.now().toString(36)}`;

export async function startOnlineAuthority({ label = 'suite', keepRateLimits = false, ink = false, env = {} } = {}) {
  const prior = Object.fromEntries([...ENV_NAMES, ...Object.keys(env)].map(name => [name, process.env[name]]));
  const scratch = mkdtempSync(join(tmpdir(), `pri-online-${label}-`));
  process.env.NODE_ENV = 'test';
  process.env.PRI_PLATFORM_DB = join(scratch, 'platform.db');
  process.env.PRI_AUTH_DELIVERY_KEY = '5a'.repeat(32);
  delete process.env.PRI_PUBLIC_ORIGIN;
  for (const name of ENV_NAMES.slice(4)) delete process.env[name];

  // ── The handwriting reader the server calls (third party, stood in) ───────
  const reader = { calls: 0, server: null };
  if (ink) {
    reader.server = createServer((req, res) => {
      req.resume();
      req.on('end', () => {
        reader.calls += 1;
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ output_text: JSON.stringify({
          lines: [{ text: READER_TEXT, latex: null, confidence: 0.99 }], confidence: 0.99, needs_confirmation: false
        }) }));
      });
    });
    await new Promise(resolve => reader.server.listen(0, '127.0.0.1', resolve));
    process.env.PRI_HANDWRITING_API_KEY = 'k-suite-reader-stand-in';
    process.env.PRI_HANDWRITING_ENDPOINT = `http://127.0.0.1:${reader.server.address().port}/v1/responses`;
    process.env.PRI_PAID_CALLS_PER_HOUR = '100000';
    process.env.PRI_PAID_CALLS_PER_DAY = '100000';
    process.env.PRI_AI_DAILY_FREE = '100000';
    process.env.PRI_AI_DAILY_PREMIUM = '100000';
  }
  for (const [name, value] of Object.entries(env)) {
    if (value === undefined || value === null) delete process.env[name]; else process.env[name] = String(value);
  }

  const harness = await import('../../../server/test/support/app-harness.mjs');
  const app = await harness.startApp({ engine: 'sqlite' });
  globalThis.__PRI_CLOUD_ORIGIN__ = app.origin;

  // ── Sessions: one cookie jar per linked profile ───────────────────────────
  const accounts = new Map();         // pid → { accountId, email, name, jar }
  const noSession = {};
  let pinnedPid;                      // undefined = follow the selected profile
  let signedOut = false;
  let offline = false;
  const traffic = { total: 0, issue: 0, grade: 0, reveal: 0, recognize: 0, refusedOffline: 0 };
  const issued = new Map();           // server question id → { generator, difficulty, seed, mode }

  const selectedPid = () => {
    try { return globalThis.localStorage?.getItem('pri-current-profile') || null; } catch { return null; }
  };
  function activeJar() {
    if (signedOut) return noSession;
    const pid = pinnedPid !== undefined ? pinnedPid : selectedPid();
    return accounts.get(pid)?.jar || noSession;
  }

  async function resetRateLimits() {
    await app.db.run('DELETE FROM rate_limits');
  }

  const realFetch = globalThis.fetch;
  let sinceReset = 0;
  globalThis.fetch = async (url, options = {}) => {
    const target = String(url);
    if (!target.startsWith(app.origin) || options.credentials !== 'include') return realFetch(url, options);
    if (offline) { traffic.refusedOffline += 1; throw new TypeError('fetch failed'); }
    const path = target.slice(app.origin.length);
    traffic.total += 1;
    if (!keepRateLimits && ++sinceReset >= 60) { sinceReset = 0; await resetRateLimits(); }
    const jar = activeJar();
    const headers = { ...(options.headers || {}) };
    const cookies = harness.cookieHeader(jar);
    if (cookies) headers.Cookie = cookies;
    // The CSRF double-submit header is read from document.cookie by the
    // transport; a jar switched since then must still send its own pair.
    if (jar.pri_csrf && (options.method || 'GET') !== 'GET') headers['X-Pri-CSRF'] = jar.pri_csrf;
    else if (!jar.pri_csrf) delete headers['X-Pri-CSRF'];
    const { credentials: _c, cache: _k, redirect: _r, ...rest } = options;
    const response = await realFetch(url, { ...rest, headers, redirect: 'manual' });
    harness.absorbCookies(response, jar);
    if (path === '/v1/practice/issue') {
      traffic.issue += 1;
      if (response.status === 201) {
        try {
          const asked = JSON.parse(String(options.body || '{}'));
          const reply = await response.clone().json();
          if (reply?.question?.id) issued.set(reply.question.id, {
            generator: asked.generator, difficulty: Number(asked.difficulty), mode: asked.mode || 'practice', prepared: typeof asked.prepared === 'string'
          });
        } catch { /* an unreadable reply is the product's to refuse */ }
      }
    } else if (/^\/v1\/practice\/[^/]+\/submit$/.test(path)) traffic.grade += 1;
    else if (/^\/v1\/practice\/[^/]+\/reveal$/.test(path)) traffic.reveal += 1;
    else if (/^\/v1\/practice\/[^/]+\/recognize$/.test(path)) traffic.recognize += 1;
    return response;
  };
  // Node has no document. The CSRF pair is attached above from the jar, so
  // one is stood up only for `ink`, and only with what client/src/ink/
  // cloudRaster.js asks of a canvas. Without it a handwritten submission is
  // refused on the device before anything is sent, as in plain Node.
  const ownsDocument = ink && typeof globalThis.document === 'undefined';
  if (ownsDocument) {
    globalThis.document = {
      get cookie() { return Object.entries(activeJar()).map(([k, v]) => `${k}=${v}`).join('; '); },
      createElement(tag) {
        if (tag !== 'canvas') throw new Error(`the suite document only makes a canvas, not <${tag}>`);
        const pen = new Proxy({}, {
          get: (target, prop) => (prop in target ? target[prop] : () => {}),
          set: (target, prop, value) => { target[prop] = value; return true; }
        });
        return { width: 0, height: 0, getContext: kind => (kind === '2d' ? pen : null), toDataURL: () => BLANK_PNG };
      }
    };
  }

  const cloudAccount = await import('../../src/platform/cloudAccount.js');
  const idb = await import('../../src/local/idb.js');
  const generators = await import('../../src/engine/generators/index.js');

  let accountSeq = 0;
  /**
   * Register and email-verify a real adult account, then link `pid` to it the
   * way the product does (loginCloudAccount). `entitlement: 'premium'` then
   * files a Premium snapshot on the link row, as the suites that need to run
   * past the free daily cap already did before grading moved to the server.
   */
  async function link(pid, { name = 'Suite Student', entitlement = null } = {}) {
    assert.ok(pid, 'link() needs a local profile id');
    if (accounts.has(pid)) return accounts.get(pid);
    const email = `${label}.${++accountSeq}.${String(pid).slice(0, 8)}@example.test`.toLowerCase();
    if (!keepRateLimits) await resetRateLimits();
    const reg = await harness.registerAccount(app, { email, password: PASSWORD, name, deviceId: `suite-device-${accountSeq}` });
    assert.equal(reg.status, 201, `register ${email}: ${reg.status} ${reg.text}`);
    const verified = await harness.verifyEmail(app, reg.account.id);
    assert.equal(verified.status, 200, `verify ${email}: ${verified.status} ${verified.text}`);
    const account = { accountId: String(reg.account.id), email, name, jar: {} };
    accounts.set(pid, account);
    const before = pinnedPid;
    const wasOut = signedOut, wasOffline = offline;
    pinnedPid = pid; signedOut = false; offline = false;
    try { await cloudAccount.loginCloudAccount(pid, { email, password: PASSWORD }); }
    finally { pinnedPid = before; signedOut = wasOut; offline = wasOffline; }
    if (entitlement) await setEntitlement(pid, entitlement);
    return account;
  }

  /** Overwrite the entitlement snapshot on a real link row (account id kept). */
  async function setEntitlement(pid, entitlement) {
    const id = cloudAccount.cloudLinkRowId(pid);
    const row = await idb.get('device', id);
    assert.ok(row?.accountId, 'setEntitlement() needs a linked profile');
    const now = Date.now();
    const snapshot = entitlement === 'premium'
      ? { plan: 'premium', status: 'active', provider: 'web', currentPeriodEnd: now + PREMIUM_DAYS * 86400000,
          offlineUntil: now + 7 * 86400000, issuedAt: now, sourceVersion: 1 }
      : entitlement;
    await idb.put('device', { ...row, entitlement: snapshot });
  }

  /**
   * The full question (answer and steps included) behind a stored row.
   * Not yet issued: the device copy. Issued: regenerated from the parameters
   * the device asked the server to issue, and matched to what is on screen.
   */
  async function answerKey(rowOrId) {
    const row = typeof rowOrId === 'string' ? await idb.get('questions', rowOrId) : rowOrId;
    assert.ok(row, 'answerKey() needs a stored question row');
    if (!row.serverQuestionId) return row.payload;
    // The server chooses the seed and never discloses it, so the oracle is the
    // server's own sealed copy of the question it issued, read from its store.
    const sealed = await app.db.get("SELECT response_json FROM idempotency_keys WHERE scope='practice-question' AND key=?", [row.serverQuestionId]);
    assert.ok(sealed, `the server holds no issued question ${row.serverQuestionId}`);
    const q = JSON.parse(sealed.response_json);
    assert.equal(q.prompt, row.payload.prompt, 'the server\'s sealed question is not the one on screen');
    return q;
  }

  async function scoped(set, restore, fn) {
    set();
    try { return await fn(); } finally { restore(); }
  }

  let closed = false;
  async function close() {
    if (closed) return;
    closed = true;
    await app.close();
    if (reader.server) await new Promise(resolve => { reader.server.closeAllConnections?.(); reader.server.close(resolve); });
    globalThis.fetch = realFetch;
    if (ownsDocument) delete globalThis.document;
    rmSync(scratch, { recursive: true, force: true });
    for (const [name, value] of Object.entries(prior)) {
      if (value === undefined) delete process.env[name]; else process.env[name] = value;
    }
  }

  return {
    app, origin: app.origin, db: app.db, traffic, issued, reader,
    link, setEntitlement, answerKey, resetRateLimits, close,
    accountOf: pid => accounts.get(pid) || null,
    /** Pin the device session to `pid`'s account; `undefined` follows the selected profile again. */
    useSessionOf(pid) { pinnedPid = pid; },
    setSignedOut(value) { signedOut = !!value; },
    setOffline(value) { offline = !!value; },
    signedOut: fn => scoped(() => { signedOut = true; }, () => { signedOut = false; }, fn),
    offline: fn => scoped(() => { offline = true; }, () => { offline = false; }, fn),
    /** A build with no cloud origin at all, for the length of `fn`. */
    unconfigured(fn) {
      return scoped(() => { delete globalThis.__PRI_CLOUD_ORIGIN__; }, () => { globalThis.__PRI_CLOUD_ORIGIN__ = app.origin; }, fn);
    },
    withSessionOf(pid, fn) {
      const before = pinnedPid;
      return scoped(() => { pinnedPid = pid; }, () => { pinnedPid = before; }, fn);
    }
  };
}
