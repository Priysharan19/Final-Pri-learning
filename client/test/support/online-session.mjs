// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the online session every browser flow marks against.
//
// Owner decision 2026-10-10: checking an answer, awarding marks and showing a
// solution need a verified signed-in account, a connection and a question the
// SERVER issued. A browser flow that marks anything therefore needs a server
// and an account, and this module is the one place both come from.
//
// WHAT IS REAL
//   · the platform server (server/app.js → /v1), in this process, on its own
//     SQLite file, serving the built client from the same origin — so the page
//     reaches /v1 exactly as the deployed app does (same-origin, real cookies,
//     real CSRF pair, real security headers). No Playwright route stands in for
//     a verdict: every mark in a flow that uses this session was committed by
//     the server's deterministic engine and read back from its receipt.
//   · the account: registered and email-verified over the server's own HTTP
//     routes, then SIGNED IN THROUGH THE APP — Settings → Pri account → Sign
//     in — which is the product code that links a local profile to an account.
//
// WHAT IS SYNTHETIC — and must be labelled so wherever it is evidence
//   · the handwriting READER. The single hop from the server's provider module
//     to the model is answered here by a stand-in that never looks at the
//     picture: it returns the text and confidence the flow scripts. Nothing
//     that passes through it is evidence about real handwriting recognition, a
//     real provider, a real iPad or a real Pencil. Every other outbound request
//     from this process is refused, so no suite can reach a real provider.
//   · email and SMS delivery use the server's TEST adapters (no message sent).
//
// THE ORACLE. The server chooses every creditable question and never discloses
// a seed or an answer before the question is resolved, so the device holds no
// key. A flow that needs the right answer asks `answerOf()`, which reads the
// server's own sealed copy of the question it issued from the server's
// database IN THIS PROCESS — the test's desk, not the student's browser — and
// refuses to answer unless that copy is the question on screen. Nothing is
// ever handed to the page.
// ─────────────────────────────────────────────────────────────────────────────
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const SYNTHETIC_EVIDENCE = 'SYNTHETIC-READER EVIDENCE';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const DIST = join(ROOT, 'client', 'dist');
const PASSWORD = 'online-session-e2e-passphrase-42';

const ENV = {
  PRI_SMS_PROVIDER: 'test',
  PRI_AUTH_EMAIL_PROVIDER: 'test',
  PRI_HANDWRITING_API_KEY: 'synthetic-reader-not-a-provider-key',
  PRI_HANDWRITING_MODEL: 'synthetic-reader',
  PRI_HANDWRITING_FALLBACK_MODEL: 'synthetic-reader',
  PRI_PAID_CALLS_PER_HOUR: '10000',
  PRI_PAID_CALLS_PER_DAY: '100000'
};
// PRI_PUBLIC_ORIGIN is cleared: outside production the server then accepts the
// page's own origin, which is this server's ephemeral loopback port.
const ENV_CLEARED = ['PRI_HANDWRITING_ENDPOINT', 'PRI_HANDWRITING_PROBE_ENDPOINT', 'PRI_HANDWRITING_CONFIDENCE_FLOOR',
  'PRI_PLATFORM_DB', 'PRI_PUBLIC_ORIGIN', 'NODE_ENV'];

let shared = null;
let accountSerial = 0;

/** The one platform of this suite run, booted on first use. */
export function onlinePlatform() {
  if (!shared) shared = startOnlinePlatform().catch(err => { shared = null; throw err; });
  return shared;
}

/** Close the shared platform if a flow ever started it. Safe to call twice. */
export async function closeOnlinePlatform() {
  const running = shared;
  shared = null;
  if (running) await (await running.catch(() => null))?.close();
}

export async function startOnlinePlatform({ dist = DIST } = {}) {
  if (!existsSync(join(dist, 'index.html'))) throw new Error(`online-session: ${dist} has no built client`);
  const saved = Object.fromEntries([...Object.keys(ENV), ...ENV_CLEARED, 'PRI_AUTH_DELIVERY_KEY'].map(k => [k, process.env[k]]));
  process.env.PRI_AUTH_DELIVERY_KEY = process.env.PRI_AUTH_DELIVERY_KEY || '44'.repeat(32);
  Object.assign(process.env, ENV);
  for (const k of ENV_CLEARED) delete process.env[k];

  // The stand-in reader. `text` / `confidence` are scripted by the flow; every
  // request the provider module sends is kept so a flow can prove the reader
  // was sent the picture and nothing about the question. `down` makes the
  // provider hop fail the way an unreachable model does.
  const reader = { text: '7', confidence: 0.6, down: false, requests: [], refused: [] };
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (input, init = {}) => {
    const url = new URL(typeof input === 'string' ? input : input.url);
    if (url.hostname === '127.0.0.1' || url.hostname === 'localhost') return realFetch(input, init);
    if (url.host === 'api.openai.com' && url.pathname.startsWith('/v1/models/')) {
      return new Response(JSON.stringify({ id: 'synthetic-reader' }), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    if (url.host === 'api.openai.com' && url.pathname === '/v1/responses') {
      reader.requests.push(JSON.parse(String(init.body || '{}')));
      if (reader.down) return new Response(JSON.stringify({ error: { message: 'synthetic reader scripted down' } }), { status: 503, headers: { 'content-type': 'application/json' } });
      const lines = String(reader.text).split('\n').filter(Boolean).map(text => ({ text, latex: text, confidence: reader.confidence }));
      return new Response(JSON.stringify({
        output_text: JSON.stringify({ lines, confidence: reader.confidence, needs_confirmation: reader.confidence < 0.82 })
      }), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    reader.refused.push(url.origin + url.pathname);
    throw new Error(`online-session: outbound request refused (${url.origin}) — browser suites never reach a real provider`);
  };

  const dir = mkdtempSync(join(tmpdir(), 'pri-online-session-'));
  const harness = await import('../../../server/test/support/app-harness.mjs');
  const { createPlatformDb } = await import('../../../server/platform/db.js');
  const sms = await import('../../../server/platform/smsProvider.js');
  const db = createPlatformDb(join(dir, 'platform.sqlite'));
  const h = await harness.startApp({ db, dist });

  /**
   * A verified adult student account, made at the server's own routes. It is
   * not signed in anywhere yet: `session.signIn()` does that through the app.
   */
  // The desk's own requests reuse keep-alive sockets the server may have just
  // timed out; a request that never left ("fetch failed") is sent again.
  const desk = async (send) => {
    for (let attempt = 0; ; attempt++) {
      try { return await send(); }
      catch (err) { if (attempt >= 3 || !/fetch failed/i.test(String(err?.message))) throw err; await new Promise(r => setTimeout(r, 50)); }
    }
  };

  async function newAccount({ name = 'Online Student' } = {}) {
    const serial = ++accountSerial;
    // Every student of a suite run arrives from the same loopback address, so
    // the per-address sign-up and sign-in limits (8 an hour, 12 a quarter-hour)
    // would stop the ninth flow. The desk clears those two counters; it is not
    // a product path, and the limits themselves are proved by the server suites.
    h.db.prepare("DELETE FROM rate_limits WHERE bucket LIKE 'register%' OR bucket LIKE 'login%'").run();
    const email = `e2e.${process.pid}.${serial}.${Date.now().toString(36)}@example.test`;
    const made = await desk(() => harness.registerAccount(h, { name, email, password: PASSWORD, deviceId: `e2e-desk-${serial}` }));
    if (made.status !== 201 || !made.account?.id) throw new Error(`online-session: register answered ${made.status} ${made.text}`);
    const verified = await desk(() => harness.verifyEmail(h, made.account.id));
    if (verified.status >= 300) throw new Error(`online-session: verify-email answered ${verified.status} ${verified.text}`);
    // The desk's own session is not the student's: end it so the only live
    // session for this account is the one the browser signs in with.
    await h.request('/v1/account/logout', { method: 'POST', jar: made.jar }).catch(() => {});
    return { id: String(made.account.id), name, email, password: PASSWORD };
  }

  /** What the server durably holds for one account's practice. */
  function ledger(accountId, serverQuestionId = null) {
    const n = (scope, key = null) => Number(h.db.prepare(
      `SELECT COUNT(*) AS n FROM idempotency_keys WHERE account_id=? AND scope=?${key ? ' AND key=?' : ''}`
    ).get(...(key ? [accountId, scope, key] : [accountId, scope])).n);
    return {
      issued: n('practice-question'), completions: n('practice-completion'),
      thisDone: serverQuestionId ? n('practice-completion', serverQuestionId) : null
    };
  }

  async function close() {
    await h.close();
    try { db.close?.(); } catch { /* already closed */ }
    globalThis.fetch = realFetch;
    for (const [k, v] of Object.entries(saved)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
    rmSync(dir, { recursive: true, force: true });
  }

  /**
   * Another account, at the desk, takes up a prepared question first — what a
   * shared token "used elsewhere" means. Returns the server's reply status.
   */
  async function bindPreparedElsewhere(prepared) {
    const other = await newAccount({ name: 'Someone Else' });
    const jar = {};
    const login = await desk(() => h.request('/v1/account/login', { method: 'POST', jar, body: { email: other.email, password: other.password, deviceId: 'e2e-desk-elsewhere' } }));
    if (login.status !== 200) throw new Error(`online-session: desk login answered ${login.status} ${login.text}`);
    const bound = await desk(() => h.request('/v1/practice/issue', { method: 'POST', jar, body: { prepared } }));
    return { status: bound.status, accountId: other.id, questionId: bound.data?.question?.id || null };
  }

  const platform = { origin: h.origin, h, db, sms, reader, newAccount, ledger, bindPreparedElsewhere, close };
  platform.session = (ctx, page) => onlineSession(platform, ctx, page);
  return platform;
}

// ── One flow's view of the platform ──────────────────────────────────────────

const V1 = /^\/v1\//;

/** The answer a student would type for a generated question, by answer type. */
export function typedAnswerOf(q) {
  const a = q.answer || {};
  switch (q.answerType) {
    case 'mcq': return { kind: 'mcq', index: a.correctIndex, text: q.mcqOptions?.[a.correctIndex] ?? null };
    case 'numeric':
      if (a.canonicalInput) return { kind: 'text', text: String(a.canonicalInput) };
      if (a.simplestFraction) return { kind: 'text', text: `${a.simplestFraction.n}/${a.simplestFraction.d}` };
      if (a.value !== undefined) return { kind: 'text', text: String(a.value) };
      return { kind: 'text', text: null };
    case 'expression': return { kind: 'text', text: a.expr || null };
    case 'set': return { kind: 'text', text: Array.isArray(a.values) ? a.values.join(', ') : null };
    case 'point': return { kind: 'text', text: `(${a.x}, ${a.y})` };
    case 'ratio': return { kind: 'text', text: `${a.a} : ${a.b}` };
    default: return { kind: q.answerType, text: null };
  }
}

function onlineSession(platform, ctx, page) {
  const calls = [];
  const pending = new Set();
  // Observed, never intercepted: the request goes to the real server and this
  // only keeps what was exchanged, so a flow can assert on the server's reply.
  ctx.on('response', response => {
    const request = response.request();
    let url; try { url = new URL(request.url()); } catch { return; }
    if (url.origin !== platform.origin || !V1.test(url.pathname)) return;
    const entry = { method: request.method(), path: url.pathname, status: response.status(), body: null, json: null };
    try { entry.body = request.postDataJSON(); } catch { entry.body = null; }
    calls.push(entry);
    // A body that never arrives (the connection was cut mid-reply) must not
    // hold a flow open: give it five seconds, then leave `json` null.
    const read = Promise.race([response.json(), new Promise((_, no) => setTimeout(no, 5000))])
      .then(json => { entry.json = json; }).catch(() => {}).finally(() => pending.delete(read));
    pending.add(read);
  });
  const settled = async () => { while (pending.size) await Promise.all([...pending]); };

  /** POSTs to /v1/practice/… matching `re`, with their replies read. */
  const practiceCalls = async (re) => { await settled(); return calls.filter(c => c.method === 'POST' && re.test(c.path)); };

  /** The linked account ids this device holds, read back from IndexedDB. */
  const linkedAccounts = () => page.evaluate(() => new Promise(done => {
    const open = indexedDB.open('pri-learning');
    open.onerror = () => done(null);
    open.onsuccess = () => {
      const db = open.result;
      const req = db.transaction('device').objectStore('device').getAll();
      req.onsuccess = () => { db.close(); done(req.result.filter(r => String(r.id).startsWith('pri-cloud-account-link-v1:')).map(r => String(r.accountId))); };
      req.onerror = () => { db.close(); done(null); };
    };
  }));

  /**
   * Fill and send the account panel's sign-in form inside `scope` (Settings,
   * or the panel a question card opens in place), then prove the link by
   * readback. Selectors, not wording: the Hindi flow signs in with this too.
   */
  async function completeSignIn(scope, who) {
    const form = scope.locator('form', { has: page.locator('#cloud-password') });
    await form.waitFor({ state: 'visible', timeout: 30000 });
    await form.locator('button.btn-sm').first().click();
    await form.locator('#cloud-email').fill(who.email);
    await form.locator('#cloud-password').fill(who.password);
    const answered = page.waitForResponse(r => new URL(r.url()).pathname === '/v1/account/login', { timeout: 30000 });
    await form.locator('button[type="submit"]').click();
    const login = await answered;
    if (login.status() !== 200) throw new Error(`online-session: sign-in answered ${login.status()}`);
    let linked = null;
    for (let i = 0; i < 100; i++) {
      linked = await linkedAccounts();
      if (linked?.includes(who.id)) break;
      await page.waitForTimeout(100);
    }
    if (!linked?.includes(who.id)) throw new Error(`online-session: the profile is not linked to the account it signed in to (${JSON.stringify(linked)})`);
  }

  /**
   * Sign in WITHOUT leaving the page: `scope` is where the app has already
   * opened its account panel in place (a question card, the Exams page).
   */
  async function signInHere(scope, { name = 'Online Student', account = null } = {}) {
    const who = account || await platform.newAccount({ name });
    await completeSignIn(scope, who);
    session.account = who;
    return who;
  }

  /**
   * Sign this context's active local profile in to a fresh verified account,
   * through Settings → Pri account → Sign in, and come back linked. This is
   * the app's own sign-in: the profile ↔ account link in IndexedDB and the
   * session cookie are written by product code, not by the test.
   */
  async function signIn({ name = 'Online Student', account = null } = {}) {
    const who = account || await platform.newAccount({ name });
    await page.goto(`${platform.origin}/settings`, { waitUntil: 'domcontentloaded' });
    const panel = page.locator('section', { has: page.locator('#cloud-account-title') });
    await panel.waitFor({ state: 'visible', timeout: 30000 });
    await completeSignIn(panel, who);
    // The form goes away once the panel holds a linked, verified session.
    await panel.locator('form', { has: page.locator('#cloud-password') }).waitFor({ state: 'detached', timeout: 30000 });
    session.account = who;
    return who;
  }

  /** The stored row behind the question on screen — ids and issue data only. */
  const shownRow = () => page.evaluate(() => new Promise(done => {
    const id = document.querySelector('.qpage[data-question-id]')?.getAttribute('data-question-id');
    if (!id) return done(null);
    const open = indexedDB.open('pri-learning');
    open.onerror = () => done({ id, row: false });
    open.onsuccess = () => {
      const db = open.result;
      let req;
      try { req = db.transaction('questions').objectStore('questions').get(id); }
      catch { db.close(); return done({ id, row: false }); }
      req.onsuccess = () => {
        const row = req.result; db.close();
        done({ id, row: !!row, serverQuestionId: row?.serverQuestionId || null, prompt: row?.payload?.prompt ?? null,
          checkState: row?.serverQuestionId ? 'issued' : row?.prepared ? 'prepared' : row?.draftOnly ? 'draft' : 'legacy' });
      };
      req.onerror = () => { db.close(); done({ id, row: false }); };
    };
  }));

  /**
   * The right answer to the question on screen, read at the test's desk from
   * the server's own sealed copy of the question it issued. Returns
   * { answerType, kind, text, index, prompt, serverQuestionId }; `kind` is
   * 'unissued' while the server has not issued the question (a prepared
   * question before sign-in, or an offline draft): nobody can know the answer
   * then, which is the point.
   */
  async function answerOf() {
    await settled();
    const shown = await shownRow();
    if (!shown?.row) throw new Error(`online-session: no stored question behind the card (${JSON.stringify(shown)})`);
    if (!shown.serverQuestionId) return { kind: 'unissued', text: null, serverQuestionId: null, checkState: shown.checkState };
    const sealed = platform.h.db.prepare("SELECT account_id, response_json FROM idempotency_keys WHERE scope='practice-question' AND key=?").get(shown.serverQuestionId);
    if (!sealed) throw new Error(`online-session: the server holds no issued question ${shown.serverQuestionId}`);
    const q = JSON.parse(sealed.response_json);
    if (shown.prompt !== null && q.prompt !== shown.prompt) {
      throw new Error('online-session: the server\'s sealed question is not the one on screen — the oracle refuses to guess');
    }
    return { answerType: q.answerType, prompt: q.prompt, serverQuestionId: shown.serverQuestionId, accountId: String(sealed.account_id), ...typedAnswerOf(q) };
  }

  // ── Exam papers: the server's sealed paper and its stored result ───────────
  /** The server's id for a paper this device holds (from the local exam row). */
  const examServerId = (localExamId) => page.evaluate(id => new Promise(done => {
    const open = indexedDB.open('pri-learning');
    open.onerror = () => done(null);
    open.onsuccess = () => {
      const db = open.result;
      const req = db.transaction('exams').objectStore('exams').get(id);
      req.onsuccess = () => { db.close(); done(req.result?.server?.examId || null); };
      req.onerror = () => { db.close(); done(null); };
    };
  }), localExamId);
  const sealedExam = async (localExamId, scope) => {
    const serverId = await examServerId(localExamId);
    if (!serverId) return null;
    const row = platform.h.db.prepare('SELECT account_id, response_json FROM idempotency_keys WHERE scope=? AND key=?').get(scope, serverId);
    return row ? { serverId, accountId: String(row.account_id), ...JSON.parse(row.response_json) } : null;
  };
  /**
   * The right typed answer for each single question of a paper, keyed by
   * question number — read at the test's desk from the server's sealed paper.
   * The device holds no answers for a server-issued paper and none is read
   * from it or handed to it.
   */
  async function examAnswers(localExamId) {
    const paper = await sealedExam(localExamId, 'exam-paper');
    if (!paper) throw new Error(`online-session: the server holds no sealed paper for exam ${localExamId}`);
    const out = [];
    for (const [i, entry] of (paper.questions || []).entries()) {
      const q = entry?.payload || entry;
      const a = q?.answer;
      if (!q || !a || q.multipart) continue;
      let typed = null;
      if (a.canonicalInput !== undefined) typed = String(a.canonicalInput);
      else if (q.answerType === 'numeric') {
        typed = a.surdForm ? `${a.surdForm.k === 1 ? '' : a.surdForm.k === -1 ? '-' : a.surdForm.k}sqrt(${a.surdForm.r})`
          : a.simplestFraction ? `${a.simplestFraction.n}/${a.simplestFraction.d}`
          : a.requireExact || a.value === undefined ? null : String(a.value);
      } else if (q.answerType === 'expression') typed = a.expr;
      else if (q.answerType === 'set') typed = a.values.join(', ');
      else if (q.answerType === 'point') typed = `(${a.x}, ${a.y})`;
      else if (q.answerType === 'ratio') typed = `${a.a}:${a.b}`;
      if (typed) out.push([i + 1, typed]);
    }
    return out;
  }
  /** The server's stored result for a paper, or null while it is unmarked. */
  const examResult = (localExamId) => sealedExam(localExamId, 'exam-result');

  /**
   * Cut the device off from the server at the network layer, for a signed-in
   * student: every /v1 request fails as an unreachable host does. The app
   * shell and its assets still load, as they do from the service worker.
   */
  let cut = null;
  const toServer = url => url.origin === platform.origin && V1.test(url.pathname);
  async function disconnect() {
    if (cut) return;
    cut = route => route.abort('internetdisconnected');
    await ctx.route(toServer, cut);
  }
  async function reconnect() {
    if (!cut) return;
    await ctx.unroute(toServer, cut);
    cut = null;
  }

  const session = {
    platform, origin: platform.origin, reader: platform.reader, sms: platform.sms, calls, account: null,
    settled, practiceCalls, examServerId, examAnswers, examResult, signIn, signInHere, linkedAccounts, shownRow, answerOf, disconnect, reconnect,
    ledger: (serverQuestionId = null) => platform.ledger(session.account?.id, serverQuestionId)
  };
  return session;
}
