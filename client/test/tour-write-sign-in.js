// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · E2E journey — write (or type) signed out, sign in ON the
// question, and have that same question marked by the server.
//
// The owner's staging report, Write mode while signed out: "Reading your
// handwriting needs a Pri account. Your working is saved…", an "Account
// settings" link that led away from the page, a footer that said "Not saved on
// this device", and a disabled Submit. This is that day, with the right ending,
// kept as a permanent browser journey.
//
// WHAT IS REAL HERE
//   · the built client, mounted in a browser, driven through its own controls;
//   · the real platform server (server/app.js, in this process) on its own
//     SQLite database file: accounts, OTP, sessions, guardian gate, practice
//     issue / recognise / correct / grade, with the SMS TEST adapter;
//   · the server's real handwriting route and provider module (request shape,
//     schema parse, confidence floor, receipts).
//
// WHAT IS SYNTHETIC — and labelled as such in this suite's output
//   · the handwriting READER. The one network hop from the provider module to
//     the model is answered in this process by a stand-in that never looks at
//     the picture: it returns the text this flow scripts, at a scripted
//     confidence. Nothing here is evidence about real handwriting recognition,
//     a real provider, a real iPad or a real Pencil. Any other outbound request
//     is refused, so this suite cannot reach a real provider even by accident.
//
// HOW THE RIGHT ANSWER IS KNOWN. Never from the device: once the question is
// adopted the answer key lives only in the server's database, which is where
// this harness (the "teacher's desk", not the student's browser) reads it.
//
// ENGINE. Chromium, as wired into `npm run test:e2e`. It is not evidence for
// WebKit: under `--browser=webkit` this harness's /v1 forwarding is not reached
// by the page's requests (they are answered by the static server instead), so
// the journey stops at "Send code" for a harness reason, not a product one.
//
// Run on its own:  node client/test/tour-write-sign-in.js
// ─────────────────────────────────────────────────────────────────────────────
import { pathToFileURL } from 'node:url';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { handwrite } from './fakeServerReader.js';

const SERVER_ORIGIN_SEEN = 'http://localhost:5173';
const SURELY_WRONG = '-987654';
const UNREADABLE = ')(';
const MAX_SKIPS = 14;
const EVIDENCE = 'SYNTHETIC-READER EVIDENCE';

// ── The harness: real server, synthetic reader ───────────────────────────────

const ENV = {
  PRI_SMS_PROVIDER: 'test',
  PRI_AUTH_EMAIL_PROVIDER: 'test',
  PRI_PUBLIC_ORIGIN: SERVER_ORIGIN_SEEN,
  PRI_HANDWRITING_API_KEY: 'synthetic-reader-not-a-provider-key',
  PRI_HANDWRITING_MODEL: 'synthetic-reader',
  PRI_HANDWRITING_FALLBACK_MODEL: 'synthetic-reader',
  PRI_PAID_CALLS_PER_HOUR: '10000',
  PRI_PAID_CALLS_PER_DAY: '100000'
};
const ENV_CLEARED = ['PRI_HANDWRITING_ENDPOINT', 'PRI_HANDWRITING_PROBE_ENDPOINT', 'PRI_HANDWRITING_CONFIDENCE_FLOOR', 'PRI_PLATFORM_DB'];

async function startPlatform() {
  const before = Object.fromEntries([...Object.keys(ENV), ...ENV_CLEARED, 'PRI_AUTH_DELIVERY_KEY'].map(k => [k, process.env[k]]));
  process.env.PRI_AUTH_DELIVERY_KEY = process.env.PRI_AUTH_DELIVERY_KEY || '44'.repeat(32);
  Object.assign(process.env, ENV);
  for (const k of ENV_CLEARED) delete process.env[k];

  // The stand-in reader. `text`/`confidence` are scripted by the flow; every
  // request the provider module sends is kept so the flow can prove the reader
  // was sent the picture and nothing about the question.
  const reader = { text: '7', confidence: 0.6, requests: [], refused: [] };
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (input, init = {}) => {
    const url = new URL(typeof input === 'string' ? input : input.url);
    if (url.hostname === '127.0.0.1' || url.hostname === 'localhost') return realFetch(input, init);
    if (url.host === 'api.openai.com' && url.pathname.startsWith('/v1/models/')) {
      return new Response(JSON.stringify({ id: 'synthetic-reader' }), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    if (url.host === 'api.openai.com' && url.pathname === '/v1/responses') {
      const body = JSON.parse(String(init.body || '{}'));
      reader.requests.push(body);
      const lines = String(reader.text).split('\n').filter(Boolean).map(text => ({ text, latex: text, confidence: reader.confidence }));
      return new Response(JSON.stringify({
        output_text: JSON.stringify({ lines, confidence: reader.confidence, needs_confirmation: reader.confidence < 0.82 })
      }), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    reader.refused.push(url.origin + url.pathname);
    throw new Error(`tour-write-sign-in: outbound request refused (${url.origin}) — this suite never reaches a real provider`);
  };

  const dir = mkdtempSync(join(tmpdir(), 'pri-write-sign-in-'));
  const { startApp } = await import('../../server/test/support/app-harness.mjs');
  const { createPlatformDb } = await import('../../server/platform/db.js');
  const sms = await import('../../server/platform/smsProvider.js');
  const db = createPlatformDb(join(dir, 'platform.sqlite'));
  const h = await startApp({ db });
  const close = async () => {
    await h.close();
    try { db.close?.(); } catch { /* already closed */ }
    globalThis.fetch = realFetch;
    for (const [k, v] of Object.entries(before)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
    rmSync(dir, { recursive: true, force: true });
  };
  return { h, sms, reader, close };
}

/** Forward every /v1 request to the real server and keep what was exchanged. */
async function proxyV1(ctx, h) {
  const calls = [];
  await ctx.route('**/v1/**', async route => {
    const request = route.request();
    const url = new URL(request.url());
    const incoming = request.headers();
    const headers = { Accept: 'application/json', Origin: SERVER_ORIGIN_SEEN };
    for (const name of ['cookie', 'content-type', 'x-pri-csrf', 'x-pri-client', 'x-pri-request-id', 'idempotency-key']) {
      if (incoming[name]) headers[name] = incoming[name];
    }
    const method = request.method();
    const sent = ['GET', 'HEAD'].includes(method) ? undefined : request.postData() ?? undefined;
    const response = await fetch(`${h.origin}${url.pathname}${url.search}`, { method, headers, body: sent });
    const buffer = Buffer.from(await response.arrayBuffer());
    let json = null; try { json = JSON.parse(buffer.toString('utf8')); } catch { json = null; }
    let body = null; try { body = sent ? JSON.parse(sent) : null; } catch { body = null; }
    calls.push({ method, path: url.pathname, status: response.status, body, json });
    const outHeaders = { 'content-type': response.headers.get('content-type') || 'application/json' };
    const cookies = typeof response.headers.getSetCookie === 'function' ? response.headers.getSetCookie() : [];
    if (cookies.length) outHeaders['set-cookie'] = cookies.join('\n');
    const retry = response.headers.get('retry-after');
    if (retry) outHeaders['retry-after'] = retry;
    return route.fulfill({ status: response.status, headers: outHeaders, body: buffer });
  });
  return calls;
}

// ── What the page can be asked ───────────────────────────────────────────────

const shownId = page => page.locator('.qpage').first().getAttribute('data-question-id');

/** Rendered text only: a display:none node says nothing to a student. */
const visibleText = (page, selector) => page.evaluate(sel => [...document.querySelectorAll(sel)]
  .filter(el => el.getClientRects().length > 0).map(el => el.innerText).join(' ').replace(/\s+/g, ' ').trim(), selector);

/**
 * The save claim on screen and the IndexedDB fact, read in one tick so the two
 * can be compared. Kept ink lives in the sealed `inkDrafts` store under
 * `${profileId}:${questionId}`; the row is ciphertext, its key is the fact.
 */
const saveTruth = (page, questionId) => page.evaluate(qid => new Promise(done => {
  const shown = [...document.querySelectorAll('.qpage .status-line, .qpage .ink-status, .qpage [data-ink-account-recovery] p')]
    .filter(el => el.getClientRects().length > 0).map(el => el.innerText).join(' | ').replace(/\s+/g, ' ');
  const claims = {
    saved: /\bsaved on this device\b|\b(?:is|are) saved\b|^saved\b/i.test(shown),
    notSaved: /\bnot saved\b/i.test(shown),
    shown
  };
  const open = indexedDB.open('pri-learning');
  open.onerror = () => done({ ...claims, kept: false, store: 'unopened' });
  open.onsuccess = () => {
    const db = open.result;
    let req;
    try { req = db.transaction('inkDrafts').objectStore('inkDrafts').getAllKeys(); }
    catch { db.close(); return done({ ...claims, kept: false, store: 'missing' }); }
    req.onsuccess = () => { db.close(); done({ ...claims, kept: req.result.some(k => String(k).endsWith(`:${qid}`)), store: 'read' }); };
    req.onerror = () => { db.close(); done({ ...claims, kept: false, store: 'error' }); };
  };
}), questionId);

/**
 * How much is drawn on the page's canvases (committed strokes are painted on
 * the base canvas, the stroke in progress on the live one), in painted pixels.
 * Compared against the blank page, and across the sign-in.
 */
const inkOnCanvas = page => page.evaluate(() => {
  let inked = 0;
  for (const canvas of document.querySelectorAll('canvas.ink-canvas')) {
    const { data } = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);
    for (let i = 3; i < data.length; i += 4) if (data[i] > 40) inked++;
  }
  return inked;
});

/** The canonical answer the server escrowed for a question it issued. */
function serverAnswer(h, serverQuestionId) {
  const row = h.db.prepare("SELECT response_json FROM idempotency_keys WHERE scope='practice-question' AND key=?").get(serverQuestionId);
  if (!row) return null;
  const q = JSON.parse(row.response_json);
  const a = q.answer || {};
  let text = null;
  if (q.answerType === 'numeric') {
    if (a.canonicalInput) text = String(a.canonicalInput);
    else if (a.simplestFraction) text = `${a.simplestFraction.n}/${a.simplestFraction.d}`;
    else if (a.value !== undefined) text = String(a.value);
  }
  return { answerType: q.answerType, prompt: q.prompt, text };
}

const practiceCalls = (calls, re) => calls.filter(c => c.method === 'POST' && re.test(c.path));

/**
 * Open India Class 12 practice signed out, in one chapter, and stop on a 1-mark
 * written-answer question. The chapter is pinned so the run is the same every
 * time: left to the adaptive picker, Class 12 can serve Three Dimensional
 * Geometry, whose generator id the server's issue route currently refuses
 * (see known-red-server-issue-3d-generators.mjs) — a different defect from
 * the one this journey guards, and one that would make this journey flaky.
 */
async function openOneMarkQuestion(page, base, settle) {
  await page.goto(`${base}/practice?subtopic=c12-probability`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.qpage[data-question-id] .q-prompt', { timeout: 30000 });
  for (let skips = 0; skips <= MAX_SKIPS; skips++) {
    const marks = (await page.locator('.q-marks').first().innerText().catch(() => '')).trim();
    const written = await page.getByRole('button', { name: 'Answer by handwriting' }).count();
    if (written && /^1 mark$/i.test(marks)) return true;
    const leaving = await shownId(page);
    await page.locator('.ctx-next').click();
    await page.waitForFunction(id => {
      const el = document.querySelector('.qpage[data-question-id]');
      return el && el.getAttribute('data-question-id') !== id && el.querySelector('.q-prompt');
    }, leaving, { timeout: 30000 });
    await settle();
  }
  return false;
}

/** India Class 12 integrals: a 1-mark typed answer that also takes typed working. */
async function openOneMarkWorkingQuestion(page, base, settle) {
  await page.goto(`${base}/practice?subtopic=c12-integrals`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.qpage[data-question-id] .q-prompt', { timeout: 30000 });
  for (let skips = 0; skips <= MAX_SKIPS; skips++) {
    const marks = (await page.locator('.q-marks').first().innerText().catch(() => '')).trim();
    const typeTab = page.getByRole('button', { name: 'Answer by typing' });
    if (await typeTab.count() && /^1 mark$/i.test(marks)) {
      await typeTab.click();
      await settle();
      if (await page.locator('.editor-body input.answer-input').count() === 1 && await page.locator('.editor-body .btn-disclose').count() === 1) return true;
    }
    const leaving = await shownId(page);
    await page.locator('.ctx-next').click();
    await page.waitForFunction(id => {
      const el = document.querySelector('.qpage[data-question-id]');
      return el && el.getAttribute('data-question-id') !== id && el.querySelector('.q-prompt');
    }, leaving, { timeout: 30000 });
    await settle();
  }
  return false;
}

/**
 * Sign in without leaving the question: the card's own "Sign in to check this
 * answer" → "Use a phone or email code". A new phone number has no account, so
 * the same panel asks the sign-up questions and finishes with the ticket the
 * code earned. 18 or older: no guardian is needed for this account (the
 * guardian gate has its own journey in tour-otp-onboarding.js).
 */
async function signInOnTheCard({ page, sms, phone, e164 }) {
  const seen = {};
  const recovery = page.locator('[data-ink-account-recovery]');
  await recovery.locator('[data-ink-sign-in]').click();
  await recovery.locator('[data-ink-code-sign-in]').waitFor({ state: 'visible', timeout: 20000 });
  await recovery.locator('[data-ink-code-sign-in]').click();
  await recovery.locator('[data-signup-step="method"]').waitFor({ timeout: 20000 });
  await recovery.locator('#signup-destination').fill(phone);
  await recovery.getByTestId('signup-send-code').click();
  await recovery.locator('[data-signup-step="code"]').waitFor({ timeout: 20000 });
  const sent = sms.readTestOutbox({ to: e164 }).at(-1);
  // The whole code lands in the first box at once — the way the keyboard's
  // "from Messages" suggestion and SMS autofill deliver it (the box is
  // autocomplete="one-time-code"). Digit-by-digit typing is tour-otp-onboarding's.
  await recovery.locator('#signup-code-0').fill(sent.code);
  await recovery.locator('[data-signup-step="role"]').waitFor({ timeout: 20000 });
  await recovery.getByTestId('signup-role-student').click();
  await recovery.locator('[data-signup-step="age"]').waitFor({ timeout: 20000 });
  await recovery.getByTestId('signup-age-18').click();
  await recovery.locator('[data-signup-step="class"]').waitFor({ timeout: 20000 });
  await recovery.getByTestId('signup-class-12').click();
  // The new account's name: asked here, already filled from this profile.
  seen.name = await recovery.locator('#signup-flow-name').inputValue().catch(() => null);
  await recovery.getByTestId('signup-class-next').click();
  return { ...sent, nameOffered: seen.name };
}

/** Correct the doubtful line the reader returned to what the student "wrote". */
async function correctReading(page, text) {
  await page.locator('.ink-line .ink-correct-btn').first().click();
  const box = page.locator('.ink-line form.ink-correct input');
  await box.fill(text);
  await page.locator('.ink-line form.ink-correct button[type="submit"]').click();
  await page.waitForFunction(t => document.querySelector('.ink-line[data-corrected="true"]')?.getAttribute('data-text') === t, text, { timeout: 10000 });
}

async function pressSubmit(page) {
  const button = page.locator('.ws-actions .btn-primary');
  await page.waitForFunction(() => { const b = document.querySelector('.ws-actions .btn-primary'); return !!b && !b.disabled; }, null, { timeout: 15000 });
  await button.click();
}

/** History: the rows for one question, as a student reads them. */
async function historyRows(page, questionId) {
  await page.waitForSelector('.hist-row, .muted', { timeout: 30000 });
  await page.waitForFunction(() => !document.querySelector('[role="status"]')?.textContent?.startsWith('Loading'), null, { timeout: 15000 }).catch(() => {});
  await page.waitForSelector('.hist-row', { timeout: 15000 }).catch(() => {});
  const all = await page.locator('.hist-row').count();
  const mine = page.locator(`.hist-row[data-question-id="${questionId}"]`);
  const texts = (await mine.allInnerTexts()).map(t => t.replace(/\s+/g, ' ').trim().replace(/\d{1,2}:\d{2}.*$/, ''));
  return { all, mine: await mine.count(), texts, verdicts: await mine.locator('.hist-verdict .sr-only').allInnerTexts() };
}

/** What the server durably holds for this account's practice. */
function serverLedger(h, accountId, serverQuestionId) {
  const completions = h.db.prepare("SELECT COUNT(*) AS n FROM idempotency_keys WHERE account_id=? AND scope='practice-completion'").get(accountId).n;
  const issued = h.db.prepare("SELECT COUNT(*) AS n FROM idempotency_keys WHERE account_id=? AND scope='practice-question'").get(accountId).n;
  const thisDone = h.db.prepare("SELECT COUNT(*) AS n FROM idempotency_keys WHERE account_id=? AND scope='practice-completion' AND key=?").get(accountId, serverQuestionId).n;
  return { completions: Number(completions), issued: Number(issued), thisDone: Number(thisDone) };
}

// ── Journey 1 · handwriting ──────────────────────────────────────────────────

export const writeFlow = {
  id: 'write-sign-in',
  name: 'Write · signed out, sign in on the card, same question server-marked',

  async run({ page, ctx, base, check, goto, createProfile, mathText, settle, note }) {
    const { h, sms, reader, close } = await startPlatform();
    note(`${EVIDENCE}: the handwriting reader in "Write · signed out…" is a scripted stand-in (text and confidence chosen by the test); server, SQLite, OTP, issue/recognise/correct/grade routes are real. Not real-provider, real-handwriting or real-device evidence.`);
    try {
      await page.addInitScript(origin => { window.__PRI_CLOUD_ORIGIN__ = origin; }, base);
      const calls = await proxyV1(ctx, h);
      const PHONE = '98111 22334', E164 = '+919811122334';

      await goto('/');
      await createProfile({ name: 'Write Journey', course: 'in', year: 12 });
      if (!await check('signed out, India Class 12 practice (Probability) serves a 1-mark written-answer question',
        await openOneMarkQuestion(page, base, settle), `${MAX_SKIPS} questions and none was a 1-mark written answer`)) return;

      // ── 1 · signed out, Write mode ─────────────────────────────────────────
      await page.getByRole('button', { name: 'Answer by handwriting' }).click();
      await page.waitForSelector('.ink-canvas-live', { timeout: 30000 });
      const qid = await shownId(page);
      const prompt = await mathText('.q-prompt');
      const blank = await saveTruth(page, qid);
      const inkBlank = await inkOnCanvas(page);
      await check('before a stroke is drawn nothing is claimed saved, and nothing is',
        !blank.saved && !blank.notSaved && !blank.kept, JSON.stringify(blank));

      // From here to the end of step 3 nothing reloads and nothing navigates.
      await page.evaluate(() => { window.__PRI_E2E_SAME_PAGE__ = 'kept'; });
      const box = await page.locator('.ink-canvas-live').boundingBox();
      await handwrite(page, box, '7');
      const recovery = page.locator('[data-ink-account-recovery]');
      await recovery.waitFor({ state: 'visible', timeout: 15000 }).catch(() => {});
      // The save claim follows the readback: sample until it settles, and at
      // every sample a "saved" claim must have a row behind it.
      let truth = await saveTruth(page, qid);
      const lies = [];
      for (let i = 0; i < 40 && !(truth.saved && truth.kept); i++) {
        if (truth.saved && !truth.kept) lies.push(truth.shown);
        await page.waitForTimeout(150);
        truth = await saveTruth(page, qid);
      }
      await check('the card offers sign-in inside the question: "Sign in to check this answer"',
        await recovery.isVisible() && (await recovery.locator('[data-ink-sign-in]').innerText()).trim() === 'Sign in to check this answer',
        `recovery visible ${await recovery.isVisible().catch(() => null)}`);
      const settingsLinks = await page.evaluate(() => [...document.querySelectorAll('.qpage a[href="/settings"], .qpage a[href$="/settings"]')]
        .filter(el => el.getClientRects().length > 0).map(el => el.innerText.trim()));
      await check('and no link to Account settings is shown as the way forward',
        settingsLinks.length === 0, `visible settings links: ${JSON.stringify(settingsLinks)}`);
      await check('"saved" is never claimed without a stored row behind it',
        lies.length === 0, `claimed saved with no inkDrafts row: ${JSON.stringify(lies.slice(0, 2))}`);
      await check('the save status shown matches the IndexedDB readback of the ink draft',
        truth.saved && truth.kept && truth.store === 'read', JSON.stringify(truth));
      await check('"saved" and "not saved" are never on screen together',
        !(truth.saved && truth.notSaved), truth.shown);
      const signedOutSeen = await visibleText(page, '.qpage');
      await check('the old contradictory notice ("needs a Pri account. Your working is saved") is not shown',
        !/needs a Pri account/i.test(signedOutSeen) && !/keep this screen open/i.test(signedOutSeen),
        signedOutSeen.slice(0, 300));
      await check('the ink is not read or marked while signed out, and Submit waits for a reading',
        await page.locator('.ink-preview').count() === 0 && await page.locator('.ws-actions .btn-primary').isDisabled() &&
          /has not been read or graded/.test(await visibleText(page, '[data-ink-account-recovery] p')));
      // Signed out but online, the question on screen is one the server
      // PREPARED (anonymous: a public question and a sealed token). That is
      // the only practice call allowed before sign-in: nothing is issued, read
      // or marked, and the prepare request carries no seed and no answer.
      const prepares = practiceCalls(calls, /^\/v1\/practice\/prepare$/);
      await check('nothing has been sent to be read or marked: no reader call, no provider request, and the only practice call is the anonymous prepare (no seed, no answer)',
        !calls.some(c => /^\/v1\/(?:handwriting\/transcribe|practice\/(?!prepare$))/.test(c.path)) && reader.requests.length === 0 &&
          prepares.length >= 1 && prepares.every(c => !('seed' in (c.body || {})) && !('answer' in (c.json?.question || {})) && !('id' in (c.json?.question || {}))),
        JSON.stringify(calls.map(c => `${c.method} ${c.path}`)));
      await check('sign-in is enabled only once the ink is proven saved',
        await recovery.locator('[data-ink-sign-in]').isEnabled());
      const inkBefore = await inkOnCanvas(page);

      // ── 2 · sign in, on the card ───────────────────────────────────────────
      const sent = await signInOnTheCard({ page, sms, phone: PHONE, e164: E164 });
      await check('the code arrived through the server\'s test SMS adapter (no real message was sent)',
        /^\d{6}$/.test(sent?.code || ''), JSON.stringify(sent && { purpose: sent.purpose }));
      await check('a new number is asked for the account\'s name on the card, pre-filled from this profile',
        sent.nameOffered === 'Write Journey', JSON.stringify(sent.nameOffered));
      await page.waitForSelector('.ink-line', { timeout: 30000 }).catch(() => {});
      const account = h.db.prepare("SELECT a.id FROM account_phones p JOIN accounts a ON a.id=p.account_id WHERE p.phone_e164=?").get(E164);
      await check('the account was created and verified on the real server',
        !!account && calls.some(c => c.path === '/v1/account/otp/verify' && c.status < 300), JSON.stringify(account || null));
      await check('the student never left the question: same page, same URL, no reload',
        new URL(page.url()).pathname === '/practice' && await page.evaluate(() => window.__PRI_E2E_SAME_PAGE__) === 'kept',
        page.url());
      await check('the SAME question is on screen (same prompt, same question id)',
        await mathText('.q-prompt') === prompt && await shownId(page) === qid,
        `prompt ${JSON.stringify(await mathText('.q-prompt'))} id ${await shownId(page)} (was ${JSON.stringify(prompt)} ${qid})`);
      const inkAfter = await inkOnCanvas(page);
      const keptAfter = await saveTruth(page, qid);
      await check('the strokes are still on the canvas and still in the ink draft',
        inkBefore > inkBlank && inkAfter === inkBefore && keptAfter.kept,
        `painted pixels: blank ${inkBlank}, written ${inkBefore}, after sign-in ${inkAfter}; draft kept ${keptAfter.kept}`);
      await check('the sign-in notice is gone once signed in',
        await page.locator('[data-ink-account-recovery]').count() === 0);

      // ── 3 · the reader's transcript, corrected, then server-marked ─────────
      const lines = await page.locator('.ink-line').evaluateAll(nodes => nodes.map(n => ({ text: n.getAttribute('data-text'), low: n.classList.contains('ink-line-low') })));
      await check(`the kept ink is read by itself after sign-in and the transcript is shown [${EVIDENCE}]`,
        lines.length === 1 && lines[0].text === '7', JSON.stringify(lines));
      await check('the reader was sent the picture and nothing about the question (answer-blind)',
        reader.requests.length >= 1 && reader.requests.every(r => {
          const parts = (r.input || []).flatMap(m => m.content || []);
          return parts.filter(p => p.type === 'input_image').length === 1 && /^data:image\//.test(parts.find(p => p.type === 'input_image').image_url) &&
            !JSON.stringify(parts.filter(p => p.type !== 'input_image')).includes(prompt.slice(0, 24));
        }), `${reader.requests.length} provider requests`);
      await check('a doubtful transcript is editable in place',
        lines[0]?.low === true && await page.locator('.ink-line .ink-correct-btn').count() === 1, JSON.stringify(lines));
      await check('signing in alone marks nothing: no question was issued or graded yet',
        practiceCalls(calls, /^\/v1\/practice\/(?!prepare$)/).length === 0, JSON.stringify(practiceCalls(calls, /^\/v1\/practice\/(?!prepare$)/).map(c => c.path)));

      await correctReading(page, SURELY_WRONG);
      await pressSubmit(page);
      await page.waitForSelector('.verdict-bad, .eval-card', { timeout: 30000 }).catch(() => {});
      const issues = practiceCalls(calls, /^\/v1\/practice\/issue$/);
      const serverQid = issues[0]?.json?.question?.id || null;
      await check('the prepared question was BOUND to this account at submit: one issue request carrying only the prepared token — no generator, seed or answer',
        issues.length === 1 && issues[0].status === 201 && !!serverQid &&
          JSON.stringify(Object.keys(issues[0].body || {})) === '["prepared"]' && typeof issues[0].body.prepared === 'string' &&
          prepares.filter(c => c.json?.prepared === issues[0].body.prepared).length === 1,
        JSON.stringify(issues.map(c => ({ status: c.status, keys: Object.keys(c.body || {}) }))));
      const escrow = serverQid ? serverAnswer(h, serverQid) : null;
      await check('adopted, not replaced: the local question id and prompt are unchanged and the server holds that same question',
        await shownId(page) === qid && await mathText('.q-prompt') === prompt && !!escrow && escrow.prompt === issues[0]?.json?.question?.prompt,
        `on screen ${await shownId(page)} (was ${qid}); server question ${serverQid}`);
      const firstGrade = practiceCalls(calls, new RegExp(`^/v1/practice/${serverQid}/submit$`)).at(-1);
      await check('the correction was recorded by the server as the student\'s, on top of the reader\'s receipt',
        practiceCalls(calls, new RegExp(`^/v1/practice/${serverQid}/recognize$`)).some(c => c.status === 201 && c.json?.transcription?.text === '7') &&
          practiceCalls(calls, new RegExp(`^/v1/practice/${serverQid}/recognition/[^/]+/confirm$`)).some(c => c.status < 300 && c.body?.text === SURELY_WRONG),
        JSON.stringify(practiceCalls(calls, /^\/v1\/practice\/.+/).map(c => `${c.status} ${c.path.replace(serverQid, ':id')}`)));
      await check('a wrong answer: server-authoritative result, 0 of 1 marks, one try remaining',
        firstGrade?.status === 200 && firstGrade.json?.authoritative === true && firstGrade.json.correct === false &&
          firstGrade.json.resolved === false && firstGrade.json.triesLeft === 1 &&
          firstGrade.json.marksEarned === 0 && firstGrade.json.marksPossible === 1 && firstGrade.body?.mode === 'ink',
        JSON.stringify(firstGrade && { status: firstGrade.status, json: firstGrade.json }).slice(0, 400));
      await check('the card shows that miss and keeps the question open for the second try',
        await page.locator('.verdict-bad').count() >= 1 && await page.locator('.eval-card').count() === 0 &&
          !/server response did not match/i.test(await visibleText(page, '.qpage')),
        (await visibleText(page, '.verdict-bad')).slice(0, 200));
      if (!await check('the right answer is known from the server\'s escrow, not from the device',
        escrow?.answerType === 'numeric' && typeof escrow.text === 'string' && escrow.text.length > 0, JSON.stringify(escrow && { answerType: escrow.answerType, has: !!escrow.text }))) return;

      // Second try: the student rewrites the line; the stand-in is doubtful
      // again and the student states what they wrote.
      await page.locator('.ink-answer').getByRole('button', { name: /clear/i }).first().click().catch(() => {});
      await page.waitForFunction(() => document.querySelectorAll('.ink-line').length === 0, null, { timeout: 10000 }).catch(() => {});
      const box2 = await page.locator('.ink-canvas-live').boundingBox();
      await handwrite(page, box2, '7');
      await page.waitForSelector('.ink-line .ink-correct-btn', { timeout: 20000 }).catch(() => {});
      await correctReading(page, escrow.text);
      await pressSubmit(page);
      await page.waitForSelector('.eval-card', { timeout: 30000 }).catch(() => {});
      const grades = practiceCalls(calls, new RegExp(`^/v1/practice/${serverQid}/submit$`));
      const lastGrade = grades.at(-1);
      await check('the right answer: server-authoritative result, 1 of 1 marks, resolved',
        lastGrade?.status === 200 && lastGrade.json?.authoritative === true && lastGrade.json.correct === true &&
          lastGrade.json.resolved === true && lastGrade.json.marksEarned === 1 && lastGrade.json.marksPossible === 1,
        JSON.stringify(lastGrade && { status: lastGrade.status, json: lastGrade.json }).slice(0, 400));
      const marks = (await page.locator('.eval-marks').innerText().catch(() => '')).replace(/\s+/g, ' ').trim();
      await check('the card shows the server\'s marks: 1 / 1, correct, and does not call it a device mark',
        await page.locator('.eval-card[data-outcome="correct"]').count() === 1 && /^1 \/ 1 marks?\b/.test(marks) &&
          await page.locator('[data-grade-unavailable]').count() === 0 && !/marked on this device/i.test(await visibleText(page, '.ws-actions .status-line')),
        `marks ${JSON.stringify(marks)}; status ${JSON.stringify(await visibleText(page, '.ws-actions .status-line'))}`);
      await check('still the same question, and still no reload since the first stroke',
        await shownId(page) === qid && await page.evaluate(() => window.__PRI_E2E_SAME_PAGE__) === 'kept');
      const ledger = serverLedger(h, account.id, serverQid);
      await check('no duplicate attempts on the server: one question issued, one completion, two graded submissions',
        ledger.issued === 1 && ledger.completions === 1 && ledger.thisDone === 1 && grades.length === 2 && issues.length === 1,
        `${JSON.stringify(ledger)}; ${grades.length} grade requests`);
      await check('no outbound request was refused: nothing tried to reach a real provider',
        reader.refused.length === 0, JSON.stringify(reader.refused));

      await page.goto(`${base}/history`, { waitUntil: 'domcontentloaded' });
      const before = await historyRows(page, qid);
      await check('History holds exactly one resolved attempt, for this question, marked correct',
        before.all === 1 && before.mine === 1 && before.verdicts.join() === 'Correct', JSON.stringify(before));

      // ── 4 · reload ─────────────────────────────────────────────────────────
      await page.reload({ waitUntil: 'domcontentloaded' });
      const after = await historyRows(page, qid);
      await check('after a reload History still shows that one attempt with the same verdict',
        after.all === 1 && after.mine === 1 && after.verdicts.join() === 'Correct' && after.texts.join('|') === before.texts.join('|'),
        `before ${JSON.stringify(before)} after ${JSON.stringify(after)}`);
      const ledgerAfter = serverLedger(h, account.id, serverQid);
      await check('and the server still holds the same single completion (1 / 1 was committed once)',
        ledgerAfter.completions === 1 && ledgerAfter.issued === 1 &&
          practiceCalls(calls, new RegExp(`^/v1/practice/${serverQid}/submit$`)).length === 2, JSON.stringify(ledgerAfter));
    } finally {
      await close();
    }
  }
};

// ── Journey 2 · typed ────────────────────────────────────────────────────────

export const typedFlow = {
  id: 'type-sign-in',
  name: 'Type · typed answer and working survive sign-in on the card, server-marked',

  async run({ page, ctx, base, check, goto, createProfile, mathText, settle, note }) {
    const { h, sms, reader, close } = await startPlatform();
    note(`${EVIDENCE}: in "Type · typed answer…" the stand-in reader is only what lets the Write tab's sign-in complete; the typed answer is graded by the real server with no reader involved.`);
    try {
      await page.addInitScript(origin => { window.__PRI_CLOUD_ORIGIN__ = origin; }, base);
      const calls = await proxyV1(ctx, h);
      const PHONE = '98222 33445', E164 = '+919822233445';
      const WORKING = '2 + 2 = 4\n3 + 3 = 6';

      await goto('/');
      await createProfile({ name: 'Type Journey', course: 'in', year: 12 });
      if (!await check('signed out, India Class 12 practice (Integrals) serves a 1-mark question that takes a typed answer and typed working',
        await openOneMarkWorkingQuestion(page, base, settle), `${MAX_SKIPS} questions and none was a 1-mark typed answer with working`)) return;

      // ── typed, signed out ──────────────────────────────────────────────────
      await page.getByRole('button', { name: 'Answer by typing' }).click();
      const answerBox = page.locator('.editor-body input.answer-input');
      await answerBox.waitFor({ timeout: 15000 });
      const qid = await shownId(page);
      const prompt = await mathText('.q-prompt');
      await page.evaluate(() => { window.__PRI_E2E_SAME_PAGE__ = 'kept'; });
      await answerBox.fill(SURELY_WRONG);
      await page.locator('.editor-body .btn-disclose').click();
      const workingBox = page.locator('.editor-body textarea');
      await workingBox.fill(WORKING);
      await page.waitForFunction(() => /saved on this device/i.test(document.querySelector('.ws-actions .status-line')?.innerText || ''), null, { timeout: 10000 }).catch(() => {});
      await check('the typed answer and working are saved on this device before any account exists',
        /saved on this device/i.test(await visibleText(page, '.ws-actions .status-line')) &&
          await page.evaluate(id => Object.keys(localStorage).some(k => k.endsWith(`.question.${id}`)), qid),
        await visibleText(page, '.ws-actions .status-line'));

      // ── sign in on the card (the Write tab holds the in-card sign-in) ──────
      await page.getByRole('button', { name: 'Answer by handwriting' }).click();
      await page.waitForSelector('.ink-canvas-live', { timeout: 30000 });
      const box = await page.locator('.ink-canvas-live').boundingBox();
      await handwrite(page, box, '7');
      await page.waitForFunction(() => document.querySelector('[data-ink-sign-in]')?.disabled === false, null, { timeout: 20000 }).catch(() => {});
      await check('the card offers sign-in in place once the stroke is proven saved',
        await page.locator('[data-ink-account-recovery] [data-ink-sign-in]').isEnabled());
      await signInOnTheCard({ page, sms, phone: PHONE, e164: E164 });
      await page.waitForFunction(() => !document.querySelector('[data-ink-account-recovery]'), null, { timeout: 30000 }).catch(() => {});
      const account = h.db.prepare("SELECT a.id FROM account_phones p JOIN accounts a ON a.id=p.account_id WHERE p.phone_e164=?").get(E164);
      await check('signed in on the real server without leaving the question',
        !!account && new URL(page.url()).pathname === '/practice' && await page.evaluate(() => window.__PRI_E2E_SAME_PAGE__) === 'kept' &&
          await page.locator('[data-ink-account-recovery]').count() === 0, page.url());

      // ── back to Type: nothing typed was lost ───────────────────────────────
      await page.getByRole('button', { name: 'Answer by typing' }).click();
      await answerBox.waitFor({ timeout: 15000 });
      if (!await workingBox.count()) await page.locator('.editor-body .btn-disclose').click();
      await check('the SAME question is on screen after sign-in',
        await shownId(page) === qid && await mathText('.q-prompt') === prompt, `${await shownId(page)} (was ${qid})`);
      await check('the typed answer survived the sign-in', await answerBox.inputValue() === SURELY_WRONG, JSON.stringify(await answerBox.inputValue()));
      await check('the typed working survived the sign-in', await workingBox.inputValue() === WORKING, JSON.stringify(await workingBox.inputValue()));

      // ── server-marked: unreadable, wrong, then right ───────────────────────
      // An answer the marker cannot parse is still the server's to answer, and
      // it costs nothing: no mark, no try, and the card says so plainly.
      await answerBox.fill(UNREADABLE);
      await pressSubmit(page);
      await page.waitForSelector('.verdict-bad, .eval-card', { timeout: 30000 }).catch(() => {});
      const issues = practiceCalls(calls, /^\/v1\/practice\/issue$/);
      const serverQid = issues[0]?.json?.question?.id || null;
      const escrow = serverQid ? serverAnswer(h, serverQid) : null;
      const unreadable = practiceCalls(calls, new RegExp(`^/v1/practice/${serverQid}/submit$`)).at(-1);
      const unreadableSeen = await visibleText(page, '.qpage');
      await check('an unreadable typed answer is answered by the server as unreadable (no mark, no try spent) and shown as that, not as a failed submission',
        unreadable?.json?.authoritative === true && unreadable.json.invalid === true && unreadable.json.resolved === false &&
          unreadable.json.marksEarned === 0 && await page.locator('.eval-card').count() === 0 &&
          !/did not match this submission|not submitted yet/i.test(unreadableSeen),
        `${JSON.stringify(unreadable?.json).slice(0, 260)} · on screen: ${(await visibleText(page, '.verdict-bad, .verdict')).slice(0, 200)}`);
      await answerBox.fill(SURELY_WRONG);
      await pressSubmit(page);
      await page.waitForFunction(n => window.__PRI_E2E_SAME_PAGE__ && document.querySelectorAll('.verdict-bad, .eval-card').length >= n, 1, { timeout: 30000 }).catch(() => {});
      await page.waitForTimeout(400);
      await check('the typed question was adopted by the server at submit: one issue, same question id on screen',
        issues.length === 1 && issues[0].status === 201 && !!escrow && await shownId(page) === qid && await mathText('.q-prompt') === prompt,
        JSON.stringify(issues.map(c => c.status)));
      const firstGrade = practiceCalls(calls, new RegExp(`^/v1/practice/${serverQid}/submit$`)).at(-1);
      await check('a wrong typed answer: server-authoritative, 0 of 1 marks, one try remaining, graded as typed with the working attached',
        firstGrade?.status === 200 && firstGrade.json?.authoritative === true && firstGrade.json.correct === false &&
          firstGrade.json.resolved === false && firstGrade.json.triesLeft === 1 && firstGrade.json.marksEarned === 0 &&
          firstGrade.json.marksPossible === 1 && firstGrade.body?.mode === 'typed' && firstGrade.body?.answer === SURELY_WRONG &&
          firstGrade.body?.steps === WORKING && !('transcriptionReceipt' in (firstGrade.body || {})),
        JSON.stringify(firstGrade && { status: firstGrade.status, body: firstGrade.body, json: firstGrade.json }).slice(0, 500));
      await check('no reading receipt was involved in a typed grade',
        practiceCalls(calls, /\/recogni/).length === 0, JSON.stringify(practiceCalls(calls, /\/recogni/).map(c => c.path)));
      await check('the card shows the miss and keeps the answer and the working for the second try',
        await page.locator('.verdict-bad').count() >= 1 && await page.locator('.eval-card').count() === 0 &&
          await answerBox.inputValue() === SURELY_WRONG && await workingBox.inputValue() === WORKING);
      if (!await check('the right answer is known from the server\'s escrow, not from the device',
        escrow?.answerType === 'numeric' && !!escrow.text, JSON.stringify(escrow && { answerType: escrow.answerType }))) return;

      await answerBox.fill(escrow.text);
      await pressSubmit(page);
      await page.waitForSelector('.eval-card', { timeout: 30000 }).catch(() => {});
      const grades = practiceCalls(calls, new RegExp(`^/v1/practice/${serverQid}/submit$`));
      const lastGrade = grades.at(-1);
      const marks = (await page.locator('.eval-marks').innerText().catch(() => '')).replace(/\s+/g, ' ').trim();
      await check('the right typed answer: server-authoritative, 1 of 1 marks, and the card shows 1 / 1',
        lastGrade?.json?.authoritative === true && lastGrade.json.correct === true && lastGrade.json.resolved === true &&
          lastGrade.json.marksEarned === 1 && lastGrade.json.marksPossible === 1 &&
          await page.locator('.eval-card[data-outcome="correct"]').count() === 1 && /^1 \/ 1 marks?\b/.test(marks) &&
          await page.locator('[data-grade-unavailable]').count() === 0,
        `marks ${JSON.stringify(marks)} ${JSON.stringify(lastGrade?.json).slice(0, 300)}`);
      const ledger = serverLedger(h, account.id, serverQid);
      await check('no duplicate attempts on the server: one question issued, one completion, three submissions (unreadable, wrong, right)',
        ledger.issued === 1 && ledger.completions === 1 && ledger.thisDone === 1 && grades.length === 3, JSON.stringify(ledger));

      await page.goto(`${base}/history`, { waitUntil: 'domcontentloaded' });
      const before = await historyRows(page, qid);
      await check('History holds exactly one resolved attempt, for this question, marked correct',
        before.all === 1 && before.mine === 1 && before.verdicts.join() === 'Correct', JSON.stringify(before));
      await page.reload({ waitUntil: 'domcontentloaded' });
      const after = await historyRows(page, qid);
      await check('after a reload History still shows that one attempt with the same verdict',
        after.all === 1 && after.mine === 1 && after.verdicts.join() === 'Correct' && after.texts.join('|') === before.texts.join('|') &&
          serverLedger(h, account.id, serverQid).completions === 1,
        `before ${JSON.stringify(before)} after ${JSON.stringify(after)}`);
      await check('no outbound request was refused: nothing tried to reach a real provider',
        reader.refused.length === 0, JSON.stringify(reader.refused));
    } finally {
      await close();
    }
  }
};

export const flows = [writeFlow, typedFlow];

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const { runFlows } = await import('./e2e.mjs');
  console.log(`${EVIDENCE} — the handwriting reader in this suite is a scripted stand-in; the server, its SQLite database and its grading are real. No real provider, device or handwriting is evidenced here.`);
  process.exit(await runFlows(flows) ? 1 : 0);
}
