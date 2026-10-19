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
import { handwrite, pressRead } from './fakeServerReader.js';

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
const installInkWriteFault = page => page.addInitScript(() => {
  const put = IDBObjectStore.prototype.put;
  IDBObjectStore.prototype.put = function (value, ...rest) {
    const fault = this.name === 'inkDrafts' ? globalThis.__PRI_E2E_INK_WRITE__ : null;
    if (fault === 'throw') throw new DOMException('synthetic: the device store is full', 'QuotaExceededError');
    if (fault === 'drop') return this.count();
    return put.call(this, value, ...rest);
  };
  // Every distinct thing the status line said, in order, since the last reset.
  globalThis.__PRI_E2E_STATUS__ = [];
  setInterval(() => {
    const el = document.querySelector('.qpage .ws-actions .status-line');
    if (!el) return;
    const now = `${el.getAttribute('data-work-state')}|${el.innerText.replace(/\s+/g, ' ').trim()}`;
    const log = globalThis.__PRI_E2E_STATUS__;
    if (log[log.length - 1] !== now) log.push(now);
  }, 25);
});
const resetStatusLog = page => page.evaluate(() => { globalThis.__PRI_E2E_STATUS__ = []; });
const statusLog = page => page.evaluate(() => globalThis.__PRI_E2E_STATUS__.slice());
/** What the status line said from the moment the new stroke began to be saved. */
const sinceSaving = log => { const at = log.findIndex(l => l.startsWith('saving|')); return at < 0 ? log : log.slice(at); };
/** Wait for the one work state to be `state` (or any of an array); true when it is, false at the timeout. */
const waitWorkState = (page, state, timeout = 20000) => page.waitForFunction(
  want => want.includes(document.querySelector('.qpage .ws-actions .status-line')?.getAttribute('data-work-state')),
  [].concat(state), { timeout }).then(() => true, () => false);
const SAVED_WORDS = /saved on this device|\bis saved\b|^saved\b/i;
/** Signed in, a kept page that has been read settles on "read" (or "saved" before a reading lands). */
const SETTLED = ['read', 'saved'];

/** Largest coordinate difference between two stored pages with the same shape, or null. */
function geometryDrift(a, b) {
  let A, B; try { A = JSON.parse(a); B = JSON.parse(b); } catch { return null; }
  if (!Array.isArray(A) || !Array.isArray(B) || A.length !== B.length) return null;
  let worst = 0;
  for (let i = 0; i < A.length; i++) {
    const pa = A[i].points, pb = B[i].points;
    if (!Array.isArray(pa) || !Array.isArray(pb) || pa.length !== pb.length) return null;
    for (let j = 0; j < pa.length; j++) worst = Math.max(worst, Math.abs(pa[j][0] - pb[j][0]), Math.abs(pa[j][1] - pb[j][1]));
  }
  return worst;
}
const strokeCount = s => { try { const a = JSON.parse(s); return Array.isArray(a) ? a.length : -1; } catch { return -1; } };

const endServerSession = online => online.platform.h.db.prepare('DELETE FROM account_sessions WHERE account_id=?').run(online.account.id).changes;
const OUTAGE_WORDS = /isn’t answering right now|isn't answering right now|Photo reading isn’t working/i;
const NEEDS_ACCOUNT_WORDS = /needs a Pri account/i;
const cardText = page => visibleText(page, '.qpage .ws-work');

// ── One true save state, signed in ───────────────────────────────────────────
// Since the activation gate (issue #477) every student writing is signed in,
// so the page is saved AND read. What the save line says must still be the
// device store's truth: never "saved" without a row behind it, a refused or
// silently dropped write said as a failed save with "Save again", and the
// strokes kept through a mode switch, a resize, an offline blip and a reload.
export const saveTruthFlow = {
  id: 'ink-save-truth',
  online: true,
  name: 'Write · one true save state: ink survives reload, mode switch, resize, offline; a failed write says so and retries',

  async run({ page, ctx, base, check, goto, createProfile, mathText, settle, note, online, browserName }) {
    note(`${EVIDENCE}: "Write · one true save state…" [${browserName || 'chromium'}] is browser automation of the device store (a real IndexedDB in a Playwright ${browserName || 'chromium'} context, with write faults injected by the test); the page is read by the scripted stand-in reader and nothing is submitted. Not evidence about a physical device, Safari itself, a real provider or real handwriting.`);
    const { reader } = online;
    Object.assign(reader, { text: '5', lines: null, confidence: 0.97, down: false });
    await installInkWriteFault(page);
    await goto('/');
    await createProfile({ name: 'Save Truth', course: 'in', year: 10 });
    await online.signIn({ name: 'Save Truth' });
    if (!await check('signed in, India Class 10 practice (Arithmetic Progressions) serves a written-answer question',
      await openWrittenAPQuestion(page, base, settle), `${MAX_SKIPS} questions and none took a written answer`)) return;

    await page.getByRole('button', { name: 'Answer by handwriting' }).click();
    await page.waitForSelector('.ink-canvas-live', { timeout: 30000 });
    const qid = await shownId(page);
    const prompt = await mathText('.q-prompt');
    const inkBlank = await inkOnCanvas(page);
    const blank = await saveTruth(page, qid);
    await check('before a stroke: nothing is claimed saved or unsaved, and nothing is stored',
      !blank.saved && !blank.notSaved && !blank.kept && blank.state === 'idle', JSON.stringify(blank));

    // ── draw ─────────────────────────────────────────────────────────────────
    await resetStatusLog(page);
    await handwrite(page, await page.locator('.ink-canvas-live').boundingBox(), '5');
    // Read on request (#440): the student asks for the reading.
    await pressRead(page);
    await page.waitForSelector('.ink-line', { timeout: 30000 }).catch(() => {});
    const settledFirst = await waitWorkState(page, SETTLED);
    const first = await saveTruth(page, qid);
    const firstLog = await statusLog(page);
    await check('the status goes saving → settled, and never says the save failed',
      settledFirst && firstLog.some(l => l.startsWith('saving|')) && !firstLog.some(l => l.startsWith('save-failed|') || /couldn.t save|not saved/i.test(l)),
      JSON.stringify(firstLog));
    await check('the page is in the store, readable through a fresh IndexedDB connection, and nothing says it is not saved',
      first.kept && first.store === 'read' && first.strokes !== null && strokeCount(first.strokes) >= 1 && !first.notSaved,
      JSON.stringify({ ...first, strokes: strokeCount(first.strokes) }));
    await check('"saved" and "not saved" are never on screen together', !(first.saved && first.notSaved), first.shown);
    await check(`and, signed in, the kept page is read [${EVIDENCE}]`,
      await page.locator('.ink-line').first().getAttribute('data-text').catch(() => null) === '5' && first.state === 'read',
      JSON.stringify({ state: first.state, lines: await page.locator('.ink-line').count() }));
    const written = await inkOnCanvas(page);

    // ── mode switches ────────────────────────────────────────────────────────
    await page.getByRole('button', { name: 'Answer by typing' }).click();
    await page.locator('.editor-body input.answer-input, .editor-body textarea').first().waitFor({ timeout: 15000 });
    await page.getByRole('button', { name: /answer with a photo/i }).click();
    await page.locator('.editor-body input[type="file"]').waitFor({ state: 'attached', timeout: 15000 });
    await page.getByRole('button', { name: 'Answer by handwriting' }).click();
    await page.waitForSelector('.ink-canvas-live', { timeout: 30000 });
    // Coming back to the pen re-saves the page (saving → settled): wait for
    // the state after that write, not the one carried over from before.
    await page.waitForTimeout(900);
    await waitWorkState(page, SETTLED);
    const afterModes = await saveTruth(page, qid);
    await check('Type → Photo → Write: the same strokes are on the page and in the store',
      written > inkBlank && await inkOnCanvas(page) === written && afterModes.strokes === first.strokes && SETTLED.includes(afterModes.state),
      `painted ${await inkOnCanvas(page)} (was ${written}); stored same ${afterModes.strokes === first.strokes}; state ${afterModes.state}`);

    // ── resize: the sheet narrows, then returns ──────────────────────────────
    const viewport = page.viewportSize();
    await page.setViewportSize({ width: 1100, height: 800 });
    await page.waitForTimeout(500);
    await waitWorkState(page, SETTLED);
    const narrow = await saveTruth(page, qid);
    await page.setViewportSize(viewport);
    await page.waitForTimeout(500);
    await waitWorkState(page, SETTLED);
    const wide = await saveTruth(page, qid);
    const narrowDrift = geometryDrift(first.strokes, narrow.strokes);
    const drift = geometryDrift(first.strokes, wide.strokes);
    await check('resize: every stroke and point survives the narrower sheet, and the original geometry returns with the original width (±2px)',
      narrowDrift !== null && narrow.kept && drift !== null && drift <= 2 && await inkOnCanvas(page) > inkBlank && !wide.notSaved,
      `narrow drift ${narrowDrift}; restored drift ${drift}`);

    // ── a brief offline blip ─────────────────────────────────────────────────
    await resetStatusLog(page);
    await ctx.setOffline(true);
    await page.waitForTimeout(900);
    const off = await saveTruth(page, qid);
    await ctx.setOffline(false);
    await page.waitForTimeout(900);
    await waitWorkState(page, SETTLED);
    const back = await saveTruth(page, qid);
    const blipLog = await statusLog(page);
    await check('offline for a moment and back: strokes still on the page and in the store, and the save is never called failed',
      off.kept && back.kept && back.strokes === wide.strokes && await inkOnCanvas(page) > inkBlank && SETTLED.includes(back.state) &&
        !blipLog.some(l => l.startsWith('save-failed|')), JSON.stringify({ state: back.state, log: blipLog }));

    // ── reload ───────────────────────────────────────────────────────────────
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.qpage[data-question-id] .q-prompt', { timeout: 30000 });
    await page.waitForSelector('.ink-canvas-live', { timeout: 30000 }).catch(() => {});
    await waitWorkState(page, SETTLED);
    const reloaded = await saveTruth(page, qid);
    await check('reload: the same question comes back in Write mode with the strokes restored from IndexedDB, geometry unchanged',
      await shownId(page) === qid && await mathText('.q-prompt') === prompt && await page.locator('.ink-canvas-live').count() === 1 &&
        await inkOnCanvas(page) > inkBlank && reloaded.strokes === back.strokes && SETTLED.includes(reloaded.state),
      `id ${await shownId(page)} (was ${qid}); painted ${await inkOnCanvas(page)}; stored same ${reloaded.strokes === back.strokes}; state ${reloaded.state}`);

    // ── the device store refuses the write ───────────────────────────────────
    const beforeFault = await inkOnCanvas(page);
    await page.evaluate(() => { globalThis.__PRI_E2E_INK_WRITE__ = 'throw'; });
    await resetStatusLog(page);
    await handwrite(page, await page.locator('.ink-canvas-live').boundingBox(), '2', { x: 140 });
    // Read on request (#440): the student asks for the reading.
    await pressRead(page);
    const failed = await waitWorkState(page, 'save-failed');
    const refused = await saveTruth(page, qid);
    const refusedLog = await statusLog(page);
    const retry = page.locator('.ws-actions [data-save-retry]');
    await check('a refused write is said as a failed save, with "Save again" — and "saved" is never shown for it',
      failed && /Couldn’t save on this device/.test(refused.shown) && !refused.saved && await retry.isVisible() &&
        (await retry.innerText()).trim() === 'Save again' && refusedLog.some(l => l.startsWith('saving|')) && !sinceSaving(refusedLog).some(l => SAVED_WORDS.test(l.split('|')[1] || '')),
      JSON.stringify({ shown: refused.shown, log: refusedLog }));
    await check('the new stroke is still on the page (never dropped) and the stored page is still the earlier one',
      await inkOnCanvas(page) > beforeFault && refused.strokes === reloaded.strokes && refused.state === 'save-failed' &&
        !SAVED_WORDS.test(await visibleText(page, '.qpage .ink-status')),
      `painted ${await inkOnCanvas(page)} (was ${beforeFault}); state ${refused.state}; stored same ${refused.strokes === reloaded.strokes}`);
    await retry.click();
    await page.waitForTimeout(1200);
    const stillRefused = await saveTruth(page, qid);
    await check('"Save again" while the store still refuses: still a failed save, still not "saved"',
      stillRefused.state === 'save-failed' && !stillRefused.saved && stillRefused.strokes === reloaded.strokes, JSON.stringify({ state: stillRefused.state, shown: stillRefused.shown }));
    await page.evaluate(() => { globalThis.__PRI_E2E_INK_WRITE__ = null; });
    await retry.click();
    const recovered = await waitWorkState(page, SETTLED);
    const healed = await saveTruth(page, qid);
    await check('once the store accepts it, "Save again" saves BOTH strokes and the failure is gone, from a fresh readback',
      recovered && !healed.notSaved && healed.strokes !== reloaded.strokes && strokeCount(healed.strokes) > strokeCount(reloaded.strokes) &&
        await retry.count() === 0, JSON.stringify({ state: healed.state, shown: healed.shown, strokes: strokeCount(healed.strokes) }));

    // ── the store acknowledges the write and keeps nothing ───────────────────
    await page.evaluate(() => { globalThis.__PRI_E2E_INK_WRITE__ = 'drop'; });
    await resetStatusLog(page);
    await handwrite(page, await page.locator('.ink-canvas-live').boundingBox(), '3', { x: 240 });
    // Read on request (#440): the student asks for the reading.
    await pressRead(page);
    const caught = await waitWorkState(page, 'save-failed');
    const droppedLog = await statusLog(page);
    const dropped = await saveTruth(page, qid);
    await check('an acknowledged write that kept nothing is caught by the readback: failed save, never "saved"',
      caught && droppedLog.some(l => l.startsWith('saving|')) && !sinceSaving(droppedLog).some(l => SAVED_WORDS.test(l.split('|')[1] || '')) &&
        dropped.strokes === healed.strokes && await retry.isVisible(),
      JSON.stringify({ log: droppedLog, stored: strokeCount(dropped.strokes) }));
    await page.evaluate(() => { globalThis.__PRI_E2E_INK_WRITE__ = null; });
    await retry.click();
    const resaved = await waitWorkState(page, SETTLED);
    const final = await saveTruth(page, qid);
    await check('and is saved by "Save again" once the store really writes',
      resaved && strokeCount(final.strokes) > strokeCount(healed.strokes) && await retry.count() === 0,
      JSON.stringify({ state: final.state, strokes: strokeCount(final.strokes) }));
    await check('through all of it nothing was submitted or marked, and no provider outside the stand-in was reached',
      (await online.practiceCalls(/^\/v1\/practice\/[^/]+\/submit$/)).length === 0 && online.ledger().completions === 0 && reader.refused.length === 0,
      JSON.stringify({ ledger: online.ledger(), refused: reader.refused }));
  }
};

export const sessionEndedWriteFlow = {
  id: 'write-session-ended',
  online: true,
  name: 'Write · session ended before reading: "sign in again" beside the work, then read, corrected and marked over two tries; a real outage still says so, with a retry',

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
    // Read on request (#440): the student asks for the reading.
    await pressRead(page);
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
    // Read on request (#440): the student asks for the reading.
    await pressRead(page);
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
    const sid = right.serverQuestionId;
    const grades = () => online.practiceCalls(new RegExp(`^/v1/practice/${sid}/submit$`));

    // ── first try: the student states a wrong reading and submits ────────────
    const readLine = await page.locator('.ink-line').first().getAttribute('data-text').catch(() => null);
    await correctReading(page, SURELY_WRONG);
    await pressSubmit(page);
    await page.waitForSelector('.verdict-bad, .eval-card', { timeout: 30000 }).catch(() => {});
    // One request (#506): the picture travels with /submit, and the server
    // writes the reader's receipt and the student's correction on top of it
    // beside the mark — the same two records /recognize and /confirm wrote.
    const recognized = await online.practiceCalls(new RegExp(`^/v1/practice/${sid}/recognize$`));
    const confirmed = await online.practiceCalls(new RegExp(`^/v1/practice/${sid}/recognition/[^/]+/confirm$`));
    const firstGrade = (await grades()).at(-1);
    const firstCorrection = online.recognitionProof(firstGrade?.json?.reading?.receipt);
    const firstReading = online.recognitionProof(firstCorrection?.parentReceipt);
    await check('the correction is recorded by the server as the student\'s, on top of the reader\'s receipt (one request: the receipt and the correction written with the mark)',
      recognized.length === 0 && confirmed.length === 0 && firstGrade?.json?.reading?.corrected === true &&
        firstCorrection?.correctedByStudent === true && firstCorrection.text === SURELY_WRONG && firstReading?.text === readLine,
      JSON.stringify({ readLine, separate: recognized.length + confirmed.length, reading: firstGrade?.json?.reading, correction: firstCorrection?.text, read: firstReading?.text }));
    await check('a wrong answer: server-authoritative, 0 marks, not resolved, one try remaining, graded as handwriting under the receipt',
      firstGrade?.status === 200 && firstGrade.json?.authoritative === true && firstGrade.json.correct === false &&
        firstGrade.json.resolved === false && firstGrade.json.triesLeft === 1 && firstGrade.json.marksEarned === 0 &&
        firstGrade.json.marksPossible >= 1 && firstGrade.body?.mode === 'ink' && /^data:image\//.test(firstGrade.body?.image || '') &&
        typeof firstGrade.json.reading?.receipt === 'string' && !!firstCorrection,
      JSON.stringify(firstGrade && { status: firstGrade.status, json: firstGrade.json }).slice(0, 400));
    await check('the card shows that miss and keeps the question open for the second try',
      await page.locator('.verdict-bad').count() >= 1 && await page.locator('.eval-card').count() === 0 && await shownId(page) === qid &&
        online.ledger(sid).thisDone === 0, (await visibleText(page, '.verdict-bad')).slice(0, 200));

    // ── second try: the page is rewritten and the right answer stated ────────
    await page.locator('.ink-answer').getByRole('button', { name: /clear/i }).first().click();
    await page.waitForFunction(() => document.querySelectorAll('.ink-line').length === 0, null, { timeout: 10000 }).catch(() => {});
    // The stand-in may now be handed a picture it has already read for this
    // account; the server would rightly answer with the read it kept. A real
    // reader does not change its mind, so the desk says "a different reader".
    online.forgetKeptReads();
    reader.text = '7';
    const readsBeforeSecond = reader.requests.length;
    await handwrite(page, await page.locator('.ink-canvas-live').boundingBox(), '7');
    // Read on request (#440): the student asks for the reading.
    await pressRead(page);
    await page.waitForSelector('.ink-line .ink-correct-btn', { timeout: 30000 }).catch(() => {});
    await check(`the cleared page is rewritten and read again for the second try [${EVIDENCE}]`,
      await page.locator('.ink-line').first().getAttribute('data-text').catch(() => null) === '7' && reader.requests.length > readsBeforeSecond,
      `${await page.locator('.ink-line').count()} lines; ${reader.requests.length - readsBeforeSecond} provider requests`);
    await correctReading(page, right.text);
    await pressSubmit(page);
    await page.waitForSelector('.eval-card', { timeout: 30000 }).catch(() => {});
    const allGrades = await grades();
    const grade = allGrades.at(-1);
    await check('the second try is marked by the server: authoritative, correct, full marks, resolved',
      grade?.status === 200 && grade.json?.authoritative === true && grade.json.correct === true && grade.json.resolved === true &&
        grade.json.marksEarned === grade.json.marksPossible && await page.locator('.eval-card[data-outcome="correct"]').count() === 1,
      JSON.stringify(grade && { status: grade.status, json: grade.json }).slice(0, 300));
    const ledger = online.ledger(sid);
    await check('no duplicate attempts on the server: one completion for the question, two graded submissions',
      ledger.thisDone === 1 && ledger.completions === 1 && allGrades.filter(c => c.status === 200).length === 2,
      `${JSON.stringify(ledger)}; ${allGrades.length} grade requests`);
    await check('no outbound request was refused: nothing tried to reach a real provider', reader.refused.length === 0, JSON.stringify(reader.refused));

    // ── History, then a reload ───────────────────────────────────────────────
    await page.goto(`${base}/history`, { waitUntil: 'domcontentloaded' });
    const before = await historyRows(page, qid);
    await check('History holds exactly one resolved attempt, for this question, marked correct',
      before.all === 1 && before.mine === 1 && before.verdicts.join() === 'Correct', JSON.stringify(before));
    await page.reload({ waitUntil: 'domcontentloaded' });
    const after = await historyRows(page, qid);
    const ledgerAfter = online.ledger(sid);
    await check('after a reload History still shows that one attempt, and the server still holds the one completion',
      after.all === 1 && after.mine === 1 && after.verdicts.join() === 'Correct' && after.texts.join('|') === before.texts.join('|') &&
        ledgerAfter.completions === 1 && ledgerAfter.thisDone === 1 && (await grades()).length === allGrades.length,
      `before ${JSON.stringify(before)} after ${JSON.stringify(after)} ${JSON.stringify(ledgerAfter)}`);
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
    // Attaching sends nothing (owner decision): the student asks for the read,
    // and it is that request the server answers "signed out".
    await page.locator('[data-photo-read]').waitFor({ state: 'visible', timeout: 30000 }).catch(() => {});
    await page.locator('[data-photo-read]').click().catch(() => {});
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
    // Read on request (#440): the student asks for the reading.
    await pressRead(page);
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

// ── Typed work survives a reload ─────────────────────────────────────────────
export const typedReloadFlow = {
  id: 'type-reload',
  online: true,
  name: 'Type · typed answer and working survive a reload, then the same question is server-marked',

  async run({ page, base, check, goto, createProfile, mathText, settle, online }) {
    const WORKING = '2 + 2 = 4\n3 + 3 = 6';
    await goto('/');
    await createProfile({ name: 'Type Reload', course: 'in', year: 12 });
    await online.signIn({ name: 'Type Reload' });
    await page.goto(`${base}/practice?subtopic=c12-integrals`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.qpage[data-question-id] .q-prompt', { timeout: 30000 });
    const answerBox = page.locator('.editor-body input.answer-input');
    const workingBox = page.locator('.editor-body textarea');
    let right = null;
    for (let skips = 0; skips <= MAX_SKIPS && !right; skips++) {
      const typeTab = page.getByRole('button', { name: 'Answer by typing' });
      if (await typeTab.count()) { await typeTab.click(); await settle(); }
      if (await answerBox.count() === 1 && await page.locator('.editor-body .btn-disclose').count() === 1) {
        const known = await online.answerOf();
        if (known.kind === 'text' && known.text) { right = known; break; }
      }
      const leaving = await shownId(page);
      await page.locator('.ctx-next').click();
      await page.waitForFunction(id => document.querySelector('.qpage[data-question-id]')?.getAttribute('data-question-id') !== id, leaving, { timeout: 30000 });
      await settle();
    }
    if (!await check('signed in, a server-issued question takes a typed answer and typed working', !!right)) return;
    const qid = await shownId(page);
    const prompt = await mathText('.q-prompt');
    await answerBox.fill(SURELY_WRONG);
    await page.locator('.editor-body .btn-disclose').click();
    await workingBox.fill(WORKING);
    await page.waitForFunction(() => /saved on this device/i.test(document.querySelector('.ws-actions .status-line')?.innerText || ''), null, { timeout: 10000 }).catch(() => {});
    await check('the typed answer and working are said saved on this device, with a draft behind the claim',
      /saved on this device/i.test(await visibleText(page, '.ws-actions .status-line')) &&
        await page.evaluate(id => Object.keys(localStorage).some(k => k.endsWith(`.question.${id}`)), qid),
      await visibleText(page, '.ws-actions .status-line'));

    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.qpage[data-question-id] .q-prompt', { timeout: 30000 });
    if (await page.getByRole('button', { name: 'Answer by typing' }).count() && !await answerBox.count()) await page.getByRole('button', { name: 'Answer by typing' }).click();
    await answerBox.waitFor({ timeout: 15000 }).catch(() => {});
    if (await answerBox.count() && !await workingBox.count()) await page.locator('.editor-body .btn-disclose').click().catch(() => {});
    await check('after a reload: the same question, the typed answer and the typed working are all back',
      await shownId(page) === qid && await mathText('.q-prompt') === prompt &&
        await answerBox.inputValue().catch(() => null) === SURELY_WRONG && await workingBox.inputValue().catch(() => null) === WORKING,
      JSON.stringify({ id: await shownId(page), answer: await answerBox.inputValue().catch(() => null), working: await workingBox.inputValue().catch(() => null) }));
    await answerBox.fill(right.text);
    await pressSubmit(page);
    await page.waitForSelector('.eval-card', { timeout: 30000 }).catch(() => {});
    const grade = (await online.practiceCalls(new RegExp(`^/v1/practice/${right.serverQuestionId}/submit$`))).at(-1);
    await check('then it is marked by the server once, as typed, with the restored working attached',
      grade?.status === 200 && grade.json?.authoritative === true && grade.json.correct === true && grade.body?.mode === 'typed' &&
        grade.body?.steps === WORKING && online.ledger(right.serverQuestionId).thisDone === 1,
      JSON.stringify(grade && { status: grade.status, body: { mode: grade.body?.mode, steps: grade.body?.steps }, json: grade.json }).slice(0, 300));
  }
};

export const flows = [saveTruthFlow, sessionEndedWriteFlow, sessionEndedPhotoFlow, sessionEndedSubmitFlow, typedReloadFlow];

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const { runFlows } = await import('./e2e.mjs');
  console.log(`${EVIDENCE} — the handwriting reader in this suite is a scripted stand-in; the server, its SQLite database and its grading are real. No real provider, device or handwriting is evidenced here.`);
  process.exit(await runFlows(flows) ? 1 : 0);
}
