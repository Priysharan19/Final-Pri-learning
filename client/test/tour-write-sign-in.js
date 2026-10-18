// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · E2E journeys — the session ends mid-work (revoked on the
// server): the student is told so beside the work, signs in again ON the
// question, and that same question is read and marked by the server.
//
// The owner's staging report, Write mode while signed out: "Reading your
// handwriting needs a Pri account. Your working is saved…", an "Account
// settings" link that led away from the page, a footer that said "Not saved on
// this device", and a disabled Submit. Since the activation gate (issue #477)
// nobody is inside the app without a confirmed account, so "signed out" can
// only happen to a student who is already working: the session ends. These
// journeys are that day, with the right ending. (The four "signed out at
// open" journeys that used to live here walked a state the app no longer has;
// tour-activation-gate.js proves the gate itself.)
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
// ENGINE. Chromium, as wired into `npm run test:e2e`; the page reaches the
// real platform server directly (support/online-session.mjs), in any engine.
//
// Run on its own:  node client/test/tour-write-sign-in.js
// ─────────────────────────────────────────────────────────────────────────────
import { pathToFileURL } from 'node:url';
import { handwrite } from './fakeServerReader.js';

const SURELY_WRONG = '-987654';
const MAX_SKIPS = 14;
const EVIDENCE = 'SYNTHETIC-READER EVIDENCE';
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
    notSaved: /\bnot saved\b|couldn.t save/i.test(shown),
    state: document.querySelector('.qpage .ws-actions .status-line')?.getAttribute('data-work-state') || null,
    shown
  };
  const open = indexedDB.open('pri-learning');
  open.onerror = () => done({ ...claims, kept: false, store: 'unopened' });
  open.onsuccess = () => {
    const db = open.result;
    let req;
    try { req = db.transaction('inkDrafts').objectStore('inkDrafts').getAllKeys(); }
    catch { db.close(); return done({ ...claims, kept: false, store: 'missing' }); }
    req.onsuccess = () => {
      const key = req.result.find(k => String(k).endsWith(`:${qid}`));
      if (key === undefined) { db.close(); return done({ ...claims, kept: false, store: 'read', strokes: null }); }
      // A profile with no password keeps the row readable, so the stored
      // geometry itself can be compared; a sealed row gives only its key.
      const row = db.transaction('inkDrafts').objectStore('inkDrafts').get(key);
      row.onsuccess = () => { db.close(); done({ ...claims, kept: true, store: 'read', strokes: Array.isArray(row.result?.strokes) ? JSON.stringify(row.result.strokes) : null }); };
      row.onerror = () => { db.close(); done({ ...claims, kept: true, store: 'read', strokes: null }); };
    };
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
const practiceCalls = (calls, re) => calls.filter(c => c.method === 'POST' && re.test(c.path));

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
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');

/** Class 10 Arithmetic Progressions, signed out, on a written-answer question. */
async function openWrittenAPQuestion(page, base, settle) {
  await page.goto(`${base}/practice?subtopic=c10-arithmetic-progressions`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.qpage[data-question-id] .q-prompt', { timeout: 30000 });
  for (let skips = 0; skips <= MAX_SKIPS; skips++) {
    const kind = await page.locator('.qpage').first().getAttribute('data-mode');
    if (kind !== 'mcq' && await page.getByRole('button', { name: 'Answer by handwriting' }).count() &&
        await page.locator('[data-check-unmarkable]').count() === 0) return true;
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
 * A fault in the device store, injected under the app: `throw` refuses the
 * write outright (a full disk); `drop` acknowledges it and writes nothing (a
 * browser that loses the write after saying yes). Only the ink-draft store is
 * touched, and only while the flow asks for it.
 */
const endServerSession = online => online.platform.h.db.prepare('DELETE FROM account_sessions WHERE account_id=?').run(online.account.id).changes;
const OUTAGE_WORDS = /isn’t answering right now|isn't answering right now|Photo reading isn’t working/i;
const NEEDS_ACCOUNT_WORDS = /needs a Pri account/i;
const cardText = page => visibleText(page, '.qpage .ws-work');

export const sessionEndedWriteFlow = {
  id: 'write-session-ended',
  online: true,
  name: 'Write · session ended before reading: "sign in again" beside the work, then read and marked; a real outage still says so, with a retry',

  async run({ page, base, check, goto, createProfile, mathText, settle, note, online, browserName }) {
    note(`${EVIDENCE}: "Write · session ended…" [${browserName || 'chromium'}] ends a real server session (its row is deleted from the server's SQLite) and scripts the stand-in reader up and down; server, sign-in, recognise and grade routes are real. Not real-provider, real-handwriting, production or real-device evidence.`);
    const { reader } = online;
    reader.text = '12'; reader.confidence = 0.97; reader.down = false;
    await goto('/');
    await createProfile({ name: 'Session Write', course: 'in', year: 10 });
    const account = await online.signIn({ name: 'Session Write' });
    if (!await check('signed in, India Class 10 practice (Arithmetic Progressions) serves a written-answer question',
      await openWrittenAPQuestion(page, base, settle), `${MAX_SKIPS} questions and none took a written answer`)) return;
    const qid = await shownId(page);
    const prompt = await mathText('.q-prompt');
    await page.getByRole('button', { name: 'Answer by handwriting' }).click();
    await page.waitForSelector('.ink-canvas-live', { timeout: 30000 });
    await page.evaluate(() => { window.__PRI_E2E_SAME_PAGE__ = 'kept'; });

    // ── a REAL reader outage, signed in ──────────────────────────────────────
    reader.down = true;
    await handwrite(page, await page.locator('.ink-canvas-live').boundingBox(), '5');
    const retry = page.locator('[data-ink-retry-reading]');
    await retry.waitFor({ state: 'visible', timeout: 30000 }).catch(() => {});
    const outage = await cardText(page);
    await check(`a reader that really is down is said as that — "isn’t answering right now" — with Try again, and is NOT called a sign-in problem [${EVIDENCE}]`,
      OUTAGE_WORDS.test(outage) && await retry.isVisible() && await page.locator('[data-ink-account-recovery]').count() === 0 &&
        !/sign in again|signed out/i.test(outage) && await page.locator('.ink-line, .eval-card, .verdict-bad').count() === 0,
      outage.slice(0, 400));
    reader.down = false;
    await retry.click();
    await page.waitForSelector('.ink-line', { timeout: 30000 }).catch(() => {});
    await check(`and Try again reads the page once the reader is back [${EVIDENCE}]`,
      await page.locator('.ink-line').first().getAttribute('data-text').catch(() => null) === '12' && !OUTAGE_WORDS.test(await cardText(page)),
      (await cardText(page)).slice(0, 300));

    // ── the session ends; the student writes more ────────────────────────────
    const ended = endServerSession(online);
    const readsBefore = reader.requests.length;
    await handwrite(page, await page.locator('.ink-canvas-live').boundingBox(), '2', { x: 140 });
    const recovery = page.locator('[data-ink-account-recovery]');
    const signIn = recovery.locator('[data-ink-sign-in]');
    await signIn.waitFor({ state: 'visible', timeout: 30000 }).catch(() => {});
    await waitWorkState(page, 'waiting-sign-in');
    const seen = await cardText(page);
    const refusals = (await online.settled(), online.calls.filter(c => /^\/v1\/handwriting\//.test(c.path) && c.status === 401));
    await check('the server refused the read with 401 AUTH_REQUIRED (the session is gone), and the reader was not asked',
      ended >= 1 && refusals.length >= 1 && refusals.some(c => c.json?.error?.code === 'AUTH_REQUIRED') && refusals.every(c => !c.json || c.json.error?.code === 'AUTH_REQUIRED') && reader.requests.length === readsBefore,
      JSON.stringify(online.calls.slice(-4).map(c => `${c.path} ${c.status}`)));
    await check('the student is told the truth: signed out, sign in again — NOT that the reader is not answering, and not that they need an account',
      await recovery.locator('[data-ink-session-ended]').isVisible() && /You’ve been signed out\. Sign in again/i.test(seen) &&
        !OUTAGE_WORDS.test(seen) && !NEEDS_ACCOUNT_WORDS.test(seen) && await page.locator('[data-ink-retry-reading]').count() === 0,
      seen.slice(0, 500));
    const truth = await saveTruth(page, qid);
    await check('the sign-in is a button beside the work — "Sign in again to check this answer"; the strokes are saved, the question is the same, Submit waits',
      (await signIn.innerText()).trim() === 'Sign in again to check this answer' && await signIn.isEnabled() &&
        await signIn.evaluate(el => el.tagName === 'BUTTON' && el.classList.contains('btn-primary')) &&
        truth.kept && truth.state === 'waiting-sign-in' && !truth.notSaved && await shownId(page) === qid &&
        await page.locator('.ws-actions .btn-primary').isDisabled() && await page.locator('.eval-card, .verdict-bad').count() === 0,
      JSON.stringify({ state: truth.state, shown: truth.shown }));
    const inkBefore = await inkOnCanvas(page);

    // ── sign in again, on the card ───────────────────────────────────────────
    await signIn.click();
    await online.signInHere(recovery, { account });
    await page.waitForSelector('.ink-line', { timeout: 30000 }).catch(() => {});
    await check('signed in again without leaving: same page, same question, same strokes, and the sign-in notice is gone',
      await page.evaluate(() => window.__PRI_E2E_SAME_PAGE__) === 'kept' && new URL(page.url()).pathname === '/practice' &&
        await shownId(page) === qid && await mathText('.q-prompt') === prompt && await inkOnCanvas(page) === inkBefore &&
        await page.locator('[data-ink-account-recovery]').count() === 0, page.url());
    await check(`the kept page is then read by itself and the transcript is shown, editable [${EVIDENCE}]`,
      await page.locator('.ink-line').count() >= 1 && await page.locator('.ink-line .ink-correct-btn').count() >= 1 && reader.requests.length > readsBefore,
      `${await page.locator('.ink-line').count()} lines; ${reader.requests.length - readsBefore} provider requests`);
    const right = await online.answerOf();
    if (!await check('the right answer is known only from the server\'s sealed copy', typeof right.text === 'string' && right.text.length > 0, JSON.stringify({ kind: right.kind }))) return;
    await correctReading(page, right.text);
    await pressSubmit(page);
    await page.waitForSelector('.eval-card', { timeout: 30000 }).catch(() => {});
    const grade = (await online.practiceCalls(new RegExp(`^/v1/practice/${right.serverQuestionId}/submit$`))).at(-1);
    await check('Submit then works: the server marks it — authoritative, correct, resolved once',
      grade?.status === 200 && grade.json?.authoritative === true && grade.json.correct === true && grade.json.resolved === true &&
        await page.locator('.eval-card[data-outcome="correct"]').count() === 1 && online.ledger(right.serverQuestionId).thisDone === 1,
      JSON.stringify(grade && { status: grade.status, json: grade.json }).slice(0, 300));
    await check('no outbound request was refused: nothing tried to reach a real provider', reader.refused.length === 0, JSON.stringify(reader.refused));
  }
};

export const sessionEndedPhotoFlow = {
  id: 'photo-session-ended',
  online: true,
  name: 'Photo · session ended before reading: "sign in again" beside the photo, then the same photo is read and marked',

  async run({ page, ctx, base, check, goto, createProfile, mathText, settle, note, online, browserName }) {
    note(`${EVIDENCE}: "Photo · session ended…" [${browserName || 'chromium'}] ends the session by clearing the browser's cookies; the image is a 1×1 test PNG and the reader is the scripted stand-in. Not real-provider, real-photo, production or real-device evidence.`);
    const { reader } = online;
    reader.text = '12'; reader.confidence = 0.97; reader.down = false;
    await goto('/');
    await createProfile({ name: 'Session Photo', course: 'in', year: 10 });
    const account = await online.signIn({ name: 'Session Photo' });
    if (!await check('signed in, India Class 10 practice (Arithmetic Progressions) serves a written-answer question',
      await openWrittenAPQuestion(page, base, settle), `${MAX_SKIPS} questions and none took a written answer`)) return;
    const qid = await shownId(page);
    const prompt = await mathText('.q-prompt');
    await page.evaluate(() => { window.__PRI_E2E_SAME_PAGE__ = 'kept'; });

    await ctx.clearCookies();
    const readsBefore = reader.requests.length;
    await page.getByRole('button', { name: /answer with a photo/i }).click();
    await page.locator('.editor-body input[type="file"]').setInputFiles({ name: 'working.png', mimeType: 'image/png', buffer: PNG });
    const signIn = page.locator('[data-photo-sign-in]');
    await signIn.waitFor({ state: 'visible', timeout: 30000 }).catch(() => {});
    const thumb = await page.locator('.photo-thumb img').getAttribute('src').catch(() => null);
    const seen = await cardText(page);
    const status = page.locator('.ws-actions .status-line');
    // The photo is now kept on the device (sealed draft, confirmed by
    // readback), so the line passes through "Saving…" before it settles.
    await page.waitForFunction(() => document.querySelector('.ws-actions .status-line')?.getAttribute('data-work-state') !== 'saving', null, { timeout: 15000 }).catch(() => {});
    await check('with the session cookie gone the student is told: signed out, sign in again — not a reader outage, not "needs an account"',
      await page.locator('[data-photo-session-ended]').isVisible() && /You’ve been signed out\. Sign in again/i.test(seen) &&
        !OUTAGE_WORDS.test(seen) && !NEEDS_ACCOUNT_WORDS.test(seen) && await page.locator('[data-photo-retry-reading]').count() === 0,
      seen.slice(0, 500));
    await check('beside the photo: "Sign in again to check this answer"; the photo is still attached, nothing was read, Submit waits',
      (await signIn.innerText()).trim() === 'Sign in again to check this answer' && /^data:image\//.test(thumb || '') &&
        await status.getAttribute('data-work-state') === 'waiting-sign-in' && reader.requests.length === readsBefore &&
        await page.locator('[data-photo-correct-transcript]').count() === 0 && await page.locator('.ws-actions .btn-primary').isDisabled(),
      `state ${await status.getAttribute('data-work-state')}`);

    await signIn.click();
    await online.signInHere(page.locator('[data-photo-account-recovery]'), { account });
    const transcript = page.locator('[data-photo-correct-transcript]');
    await transcript.waitFor({ state: 'visible', timeout: 30000 }).catch(() => {});
    await check(`signed in again in place: same question, the SAME photo, now read by itself with an editable transcript [${EVIDENCE}]`,
      await page.evaluate(() => window.__PRI_E2E_SAME_PAGE__) === 'kept' && await shownId(page) === qid && await mathText('.q-prompt') === prompt &&
        await page.locator('.photo-thumb img').getAttribute('src').catch(() => null) === thumb &&
        await transcript.inputValue().catch(() => null) === '12' && await transcript.isEditable() && reader.requests.length > readsBefore,
      `transcript ${JSON.stringify(await transcript.inputValue().catch(() => null))}`);
    const right = await online.answerOf();
    if (!await check('the right answer is known only from the server\'s sealed copy', typeof right.text === 'string' && right.text.length > 0, JSON.stringify({ kind: right.kind }))) return;
    await transcript.fill(right.text);
    await pressSubmit(page);
    await page.waitForSelector('.eval-card', { timeout: 30000 }).catch(() => {});
    const grade = (await online.practiceCalls(new RegExp(`^/v1/practice/${right.serverQuestionId}/submit$`))).at(-1);
    await check('Submit then works: marked by the server as a photo answer — authoritative, correct, resolved once',
      grade?.status === 200 && grade.json?.authoritative === true && grade.json.correct === true && grade.json.resolved === true && grade.body?.mode === 'photo' &&
        await page.locator('.eval-card[data-outcome="correct"]').count() === 1 && online.ledger(right.serverQuestionId).thisDone === 1,
      JSON.stringify(grade && { status: grade.status, json: grade.json }).slice(0, 300));
  }
};

export const sessionEndedSubmitFlow = {
  id: 'submit-session-ended',
  online: true,
  name: 'Submit · session ended at Submit: work held, "sign in again", never a wrong-answer verdict; then marked exactly once',

  async run({ page, base, check, goto, createProfile, mathText, settle, note, online, browserName }) {
    note(`${EVIDENCE}: "Submit · session ended…" [${browserName || 'chromium'}] ends a real server session between the reading and Submit; the reader is the scripted stand-in. Not real-provider, real-handwriting, production or real-device evidence.`);
    const { reader } = online;
    reader.text = '12'; reader.confidence = 0.97; reader.down = false;
    await goto('/');
    await createProfile({ name: 'Session Submit', course: 'in', year: 10 });
    const account = await online.signIn({ name: 'Session Submit' });
    if (!await check('signed in, India Class 10 practice (Arithmetic Progressions) serves a written-answer question',
      await openWrittenAPQuestion(page, base, settle), `${MAX_SKIPS} questions and none took a written answer`)) return;
    const qid = await shownId(page);
    const prompt = await mathText('.q-prompt');
    await page.getByRole('button', { name: 'Answer by handwriting' }).click();
    await page.waitForSelector('.ink-canvas-live', { timeout: 30000 });
    await page.evaluate(() => { window.__PRI_E2E_SAME_PAGE__ = 'kept'; });
    await handwrite(page, await page.locator('.ink-canvas-live').boundingBox(), '5');
    await page.waitForSelector('.ink-line .ink-correct-btn', { timeout: 30000 }).catch(() => {});
    const right = await online.answerOf();
    if (!await check(`signed in, the page is read and the right answer is known only from the server's sealed copy [${EVIDENCE}]`,
      await page.locator('.ink-line').count() === 1 && typeof right.text === 'string' && right.text.length > 0, JSON.stringify({ kind: right.kind }))) return;
    await correctReading(page, right.text);
    const inkBefore = await inkOnCanvas(page);
    const submits = () => online.practiceCalls(new RegExp(`^/v1/practice/${right.serverQuestionId}/submit$`));

    // ── the session ends, then Submit is pressed ─────────────────────────────
    endServerSession(online);
    await pressSubmit(page);
    const refusal = page.locator('[data-check-refusal="sign-in"]');
    await refusal.waitFor({ state: 'visible', timeout: 30000 }).catch(() => {});
    const seen = await cardText(page);
    const refused = (await online.settled(), online.calls.filter(c => new RegExp(`^/v1/practice/${right.serverQuestionId}/`).test(c.path) && c.status === 401));
    await check('the server refused with 401 before anything was marked: no grade was committed',
      refused.length >= 1 && refused.some(c => c.json?.error?.code === 'AUTH_REQUIRED') && refused.every(c => !c.json || c.json.error?.code === 'AUTH_REQUIRED') && (await submits()).every(c => c.status !== 200) &&
        online.ledger(right.serverQuestionId).thisDone === 0, JSON.stringify(online.calls.slice(-3).map(c => `${c.path.replace(right.serverQuestionId, ':id')} ${c.status}`)));
    await check('the card says NOT CHECKED and "sign in again" — never a wrong-answer verdict, marks, or a solution',
      await refusal.isVisible() && /has not been checked/i.test(seen) && /You’ve been signed out\. Sign in again/i.test(seen) &&
        await page.locator('.verdict.verdict-technical').count() === 1 && await page.locator('.verdict-bad, .eval-card, .solution-panel').count() === 0 &&
        !/not quite|incorrect|not this time/i.test(seen) && !OUTAGE_WORDS.test(seen),
      seen.slice(0, 500));
    const signIn = page.locator('.verdict [data-check-sign-in]');
    const held = await saveTruth(page, qid);
    await check('the work is held: same question, strokes on the page and in the store, the corrected reading still shown, sign-in button beside it',
      await shownId(page) === qid && await inkOnCanvas(page) === inkBefore && held.kept &&
        await page.locator('.ink-line').first().getAttribute('data-text').catch(() => null) === right.text &&
        (await signIn.innerText().catch(() => '')).trim() === 'Sign in again to check this answer' && await signIn.isEnabled().catch(() => false),
      JSON.stringify({ kept: held.kept, state: held.state, line: await page.locator('.ink-line').first().getAttribute('data-text').catch(() => null) }));

    // ── sign in again on the card, press Submit ──────────────────────────────
    await signIn.click();
    await online.signInHere(page.locator('.verdict'), { account });
    await page.waitForFunction(() => !document.querySelector('[data-check-refusal]'), null, { timeout: 30000 }).catch(() => {});
    await check('signed in again in place: the refusal is gone, nothing was sent by itself, and the same reading waits for the student\'s own Submit',
      await page.evaluate(() => window.__PRI_E2E_SAME_PAGE__) === 'kept' && await shownId(page) === qid && await mathText('.q-prompt') === prompt &&
        await page.locator('[data-check-refusal]').count() === 0 && await page.locator('.eval-card').count() === 0 &&
        (await submits()).every(c => c.status !== 200) && await page.locator('.ink-line').first().getAttribute('data-text').catch(() => null) === right.text,
      `refusals ${await page.locator('[data-check-refusal]').count()}`);
    await pressSubmit(page);
    await page.waitForSelector('.eval-card', { timeout: 30000 }).catch(() => {});
    const done = (await submits()).filter(c => c.status === 200);
    const ledger = online.ledger(right.serverQuestionId);
    await check('Submit is then marked by the server exactly once: authoritative, correct, one completion',
      done.length === 1 && done[0].json?.authoritative === true && done[0].json.correct === true && done[0].json.resolved === true &&
        await page.locator('.eval-card[data-outcome="correct"]').count() === 1 && ledger.thisDone === 1 && ledger.completions === 1,
      `${done.length} graded; ${JSON.stringify(ledger)}`);
  }
};

export const flows = [sessionEndedWriteFlow, sessionEndedPhotoFlow, sessionEndedSubmitFlow];

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const { runFlows } = await import('./e2e.mjs');
  console.log(`${EVIDENCE} — the handwriting reader in this suite is a scripted stand-in; the server, its SQLite database and its grading are real. No real provider, device or handwriting is evidenced here.`);
  process.exit(await runFlows(flows) ? 1 : 0);
}
