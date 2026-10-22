// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · E2E journeys — online-only checking, as a student meets it.
//
// Owner decision 2026-10-10: nothing is checked signed out or offline, not even
// labelled as a device mark. Checking an answer, awarding marks and showing the
// solution need a verified signed-in account, a connection and a question the
// server issued. Before that a student may read, type, write, preview and keep
// drafts, and is offered sign-in or reconnect in place without losing work.
//
// Since the activation gate (issue #477) nothing opens without a confirmed
// account, so every journey here starts signed in; tour-activation-gate.js
// proves the gate itself, and tour-write-sign-in.js the handwritten and
// session-ended journeys. This file carries the rest of the contract:
//
//   1. Type, offline — a signed-in student loses the connection (every /v1
//      request fails at the network layer); Submit shows the reconnect message
//      and keeps the work; Retry after reconnecting is marked exactly once.
//   2. Write, offline — the same, with handwriting.
//   3. Offline inside the app — Next question with no connection serves the
//      device's own draft, which can never be marked; the work is kept, and
//      online again the next question is the server's and is marked.
//   4. A prepared question (served when the issue call failed) that another
//      account took up first — refused here (one account, once), the work
//      kept, the next question the server's.
//   5. Sync — a pull overlapping a submit never doubles an attempt.
//   6. Rapid Fire and Match — every answer is server-marked.
//   7. The session ends before a start button — a paper, Rapid Fire and Match
//      start nothing, and signing in again in place starts them.
//   8. A paper finished offline — submitted, not scored, until the server
//      marks it once.
//
// THE ORACLE never regenerates anything: the server chooses every creditable
// question and discloses no seed. Right answers are read at the test's desk
// from the server's sealed copy of the issued question (online-session.mjs).
//
// WHAT IS REAL: the built client, the real platform server and its SQLite
// database, the account, every grade. WHAT IS SYNTHETIC: the handwriting
// reader's provider hop in journey 2 (support/online-session.mjs) — a scripted
// stand-in, labelled in this suite's output; nothing here is evidence about
// real handwriting recognition, a real provider or a real device.
//
// Run on its own:  node client/test/tour-online-check.js
// ─────────────────────────────────────────────────────────────────────────────
import { pathToFileURL } from 'node:url';
import { handwrite, pressRead } from './fakeServerReader.js';
import { SYNTHETIC_EVIDENCE } from './support/online-session.mjs';

const TOPIC = 'y7-equations';
const SURELY_WRONG = '-987654';
const MAX_SKIPS = 14;

const shownId = page => page.locator('.qpage').first().getAttribute('data-question-id');

/** Rendered text only: a display:none node says nothing to a student. */
const visibleText = (page, selector) => page.evaluate(sel => [...document.querySelectorAll(sel)]
  .filter(el => el.getClientRects().length > 0).map(el => el.innerText).join(' ').replace(/\s+/g, ' ').trim(), selector);

/** Everything on the card that would be a result, counted. */
const resultOnCard = page => page.evaluate(() => {
  const n = sel => [...document.querySelectorAll(sel)].filter(el => el.getClientRects().length > 0).length;
  return {
    evaluation: n('.eval-card'), verdict: n('.verdict-bad, .verdict-good'), marks: n('.eval-marks'),
    xp: n('.xp-pop'), solution: n('.solution-block, .solution-panel, .final-answer, .criteria-table'),
    refusal: [...document.querySelectorAll('[data-check-refusal]')].filter(el => el.getClientRects().length > 0).map(el => el.getAttribute('data-check-refusal'))
  };
});
const nothingMarked = r => r.evaluation === 0 && r.verdict === 0 && r.marks === 0 && r.xp === 0 && r.solution === 0;

/** What the device holds for this question: attempts, tries, the typed draft. */
const deviceFacts = (page, qid) => page.evaluate(qid => new Promise(done => {
  const draftKey = Object.keys(localStorage).find(k => k.endsWith(`.question.${qid}`)) || null;
  let draft = null;
  try { draft = draftKey ? JSON.parse(localStorage.getItem(draftKey)) : null; } catch { draft = null; }
  const pending = Object.keys(localStorage).some(k => k.endsWith(`.submit.${qid}`));
  const open = indexedDB.open('pri-learning');
  open.onerror = () => done({ error: 'open failed' });
  open.onsuccess = () => {
    const db = open.result;
    const tx = db.transaction(['attempts', 'questions', 'inkDrafts']);
    const out = { draft: draft?.data ?? null, pending };
    tx.objectStore('attempts').getAll().onsuccess = e => { out.attempts = e.target.result.length; out.attemptsHere = e.target.result.filter(a => a.questionId === qid || a.qid === qid).length; };
    tx.objectStore('questions').get(qid).onsuccess = e => {
      const row = e.target.result;
      out.row = row ? { tries: row.tries || 0, answered: row.answered || 0, hintsUsed: row.hintsUsed || 0, issued: !!row.serverQuestionId, revealed: !!row.revealed } : null;
    };
    tx.objectStore('inkDrafts').getAllKeys().onsuccess = e => { out.inkKept = e.target.result.some(k => String(k).endsWith(`:${qid}`)); };
    tx.oncomplete = () => { db.close(); done(out); };
    tx.onerror = () => { db.close(); done({ ...out, error: 'read failed' }); };
  };
}), qid);

/** Painted pixels on the ink canvases. */
const inkOnCanvas = page => page.evaluate(() => {
  let inked = 0;
  for (const canvas of document.querySelectorAll('canvas.ink-canvas')) {
    const { data } = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);
    for (let i = 3; i < data.length; i += 4) if (data[i] > 40) inked++;
  }
  return inked;
});

async function nextQuestion(page, settle) {
  const leaving = await shownId(page);
  await page.locator('.ctx-next').click();
  await page.waitForFunction(id => {
    const el = document.querySelector('.qpage[data-question-id]');
    return el && el.getAttribute('data-question-id') !== id && el.querySelector('.q-prompt');
  }, leaving, { timeout: 30000 });
  await settle();
}

/**
 * Open practice on a question with one typed answer box. Signed in, the server
 * has issued it and the oracle knows its answer (`accept` narrows which answers
 * will do); signed out it is only a prepared question and nobody knows it yet.
 */
async function openTypedQuestion({ page, base, settle, online, issued = true, accept = () => true }) {
  await page.goto(`${base}/practice?subtopic=${TOPIC}`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.qpage[data-question-id] .q-prompt', { timeout: 30000 });
  const typeTab = page.getByRole('button', { name: 'Answer by typing' });
  const answerBox = page.locator('.editor-body input.answer-input');
  for (let skips = 0; skips <= MAX_SKIPS; skips++) {
    if (await typeTab.count()) await typeTab.click();
    await settle();
    if (await answerBox.count() === 1) {
      const known = await online.answerOf();
      if (!issued) return known;
      if (known.kind === 'text' && known.text !== null && accept(String(known.text))) return known;
    }
    await nextQuestion(page, settle);
  }
  return null;
}

/** POSTs that ask the server to issue, read, mark or reveal — not `prepare`. */
const MARKING = /^\/v1\/practice\/(?:issue|[^/]+\/(?:submit|reveal|recognize|repeat|recognition\/.+))$/;

async function historyRows(page, base, qid) {
  await page.goto(`${base}/history`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.hist-row', { timeout: 30000 }).catch(() => {});
  const mine = page.locator(`.hist-row[data-question-id="${qid}"]`);
  return { all: await page.locator('.hist-row').count(), mine: await mine.count(), verdicts: await mine.locator('.hist-verdict .sr-only').allInnerTexts() };
}

const submitButton = page => page.locator('.ws-actions .btn-primary');
async function pressSubmit(page) {
  await page.waitForFunction(() => { const b = document.querySelector('.ws-actions .btn-primary'); return !!b && !b.disabled; }, null, { timeout: 15000 });
  await submitButton(page).click();
}

export const typeOffline = {
  id: 'type-offline',
  name: 'Type · offline: reconnect asked, work kept, Retry marked exactly once',
  online: true,

  async run({ page, base, check, goto, createProfile, mathText, settle, online }) {
    await goto('/');
    await createProfile({ name: 'Offline Typist', year: 7 });
    await online.signIn({ name: 'Offline Typist' });
    const known = await openTypedQuestion({ page, base, settle, online });
    if (!await check('signed in, Practice serves a typed question', !!known)) return;
    const qid = await shownId(page);
    const prompt = await mathText('.q-prompt');
    const answerBox = page.locator('.editor-body input.answer-input');
    await answerBox.fill(known.text);
    await page.waitForFunction(() => /saved on this device/i.test(document.querySelector('.ws-actions .status-line')?.innerText || ''), null, { timeout: 10000 }).catch(() => {});
    const before = online.ledger();
    const gradedBefore = (await online.practiceCalls(/^\/v1\/practice\/[^/]+\/submit$/)).length;

    // ── the connection goes: every /v1 request fails at the network layer ────
    await online.disconnect();
    await page.evaluate(() => { window.__PRI_E2E_SAME_PAGE__ = 'kept'; });
    await pressSubmit(page);
    await page.locator('[data-check-refusal]').waitFor({ state: 'visible', timeout: 30000 }).catch(() => {});
    const shown = await resultOnCard(page);
    await check('offline, Submit is answered with "Pri could not reach the server" and a Try again, in the card',
      shown.refusal.join() === 'reconnect' && /could not reach the server/i.test(await visibleText(page, '.verdict')) &&
        await page.locator('.verdict [data-check-retry]').isVisible(),
      `${JSON.stringify(shown)} ${JSON.stringify((await visibleText(page, '.verdict')).slice(0, 160))}`);
    await check('and with NO verdict, marks, XP or solution', nothingMarked(shown), JSON.stringify(shown));
    await check('the reconnect message is announced to assistive technology',
      /has not been checked/.test(await page.evaluate(() => [...document.querySelectorAll('.qpage [role="status"][aria-live="polite"][aria-atomic="true"]')].map(el => el.textContent).join(' '))));
    const facts = await deviceFacts(page, qid);
    await check('the work is kept: the answer is still in the box and in the saved draft, no attempt row, no try spent',
      await answerBox.inputValue() === known.text && facts.attempts === 0 && facts.row?.tries === 0 && facts.row?.answered === 0,
      `box ${JSON.stringify(await answerBox.inputValue())}; ${JSON.stringify(facts)}`);
    await check('the server marked nothing while it could not be reached',
      online.ledger().completions === before.completions && (await online.practiceCalls(/^\/v1\/practice\/[^/]+\/submit$/)).length === gradedBefore,
      JSON.stringify(online.ledger()));
    await check('nothing claims a mark made on this device', !/marked on this device|checked on this device/i.test(await visibleText(page, '.qpage')));

    // ── still offline: Try again asks again, and still marks nothing ─────────
    await page.locator('.verdict [data-check-retry]').click();
    await page.waitForTimeout(1500);
    await page.locator('[data-check-refusal]').waitFor({ state: 'visible', timeout: 30000 }).catch(() => {});
    const again = await resultOnCard(page);
    await check('still offline, Try again shows the reconnect message again and marks nothing',
      again.refusal.join() === 'reconnect' && nothingMarked(again) && (await deviceFacts(page, qid)).attempts === 0, JSON.stringify(again));

    // ── reconnected: Try again is marked, once ───────────────────────────────
    await online.reconnect();
    await page.locator('.verdict [data-check-retry]').click();
    await page.waitForSelector('.eval-card', { timeout: 30000 }).catch(() => {});
    const row = await online.shownRow();
    const grades = await online.practiceCalls(new RegExp(`^/v1/practice/${row?.serverQuestionId}/submit$`));
    const marks = (await page.locator('.eval-marks').innerText().catch(() => '')).replace(/\s+/g, ' ').trim();
    await check('after reconnecting, Try again is marked by the server — same question, same answer, no reload',
      await shownId(page) === qid && await mathText('.q-prompt') === prompt && await page.evaluate(() => window.__PRI_E2E_SAME_PAGE__) === 'kept' &&
        grades.at(-1)?.status === 200 && grades.at(-1).json?.authoritative === true && grades.at(-1).json.correct === true &&
        grades.at(-1).body?.answer === known.text && /^(\d+(?:\.\d)?) \/ \1 marks?\b/.test(marks),
      `marks ${JSON.stringify(marks)}; ${String(JSON.stringify(grades.at(-1)?.json)).slice(0, 240)}`);
    await page.waitForTimeout(1500);   // anything still queued from the failed tries would land now
    const settledGrades = await online.practiceCalls(new RegExp(`^/v1/practice/${row?.serverQuestionId}/submit$`));
    const ledger = online.ledger(row?.serverQuestionId);
    const after = await deviceFacts(page, qid);
    await check('marked exactly once: one submission key graded, one completion on the server, one attempt row on the device',
      new Set(settledGrades.filter(c => c.status === 200).map(c => c.body?.submissionId)).size === 1 &&
        ledger.thisDone === 1 && ledger.completions === before.completions + 1 && after.attempts === 1,
      `${settledGrades.length} grade request(s), keys ${JSON.stringify([...new Set(settledGrades.map(c => c.body?.submissionId))])}; ${JSON.stringify(ledger)}; attempts ${after.attempts}`);
    const history = await historyRows(page, base, qid);
    await check('History holds exactly one row for that question, marked correct',
      history.all === 1 && history.mine === 1 && history.verdicts.join() === 'Correct', JSON.stringify(history));
  }
};

// ── 3 · Write, offline ───────────────────────────────────────────────────────

export const writeOffline = {
  id: 'write-offline',
  name: 'Write · offline: reconnect asked, ink kept, Retry marked exactly once',
  online: true,

  async run({ page, base, check, goto, createProfile, mathText, settle, online, note }) {
    const reader = online.reader;
    Object.assign(reader, { text: '7', confidence: 0.97, down: false });
    note(`${SYNTHETIC_EVIDENCE}: the handwriting reader in "Write · offline…" is a scripted stand-in (it returns the text this flow sets and never looks at the picture); the server, its database, the receipts and the grade are real. Not real-handwriting, real-provider or real-device evidence.`);
    await goto('/');
    await createProfile({ name: 'Offline Writer', year: 7 });
    await online.signIn({ name: 'Offline Writer' });
    // A short whole number: every glyph drawn comes from the template set.
    const known = await openTypedQuestion({ page, base, settle, online, accept: text => /^\d{1,3}$/.test(text) });
    if (!await check('signed in, Practice serves a question with a short whole-number answer to write', !!known)) return;
    const qid = await shownId(page);
    const prompt = await mathText('.q-prompt');
    await page.getByRole('button', { name: 'Answer by handwriting' }).click();
    await page.waitForSelector('.ink-canvas-live', { timeout: 30000 });
    const blank = await inkOnCanvas(page);
    reader.text = known.text;
    await handwrite(page, await page.locator('.ink-canvas-live').boundingBox(), known.text);
    await pressRead(page);   // reading is asked for: nothing is read because ink was drawn
    await page.waitForSelector('.ink-line', { timeout: 20000 }).catch(() => {});
    const lines = await page.locator('.ink-line').evaluateAll(nodes => nodes.map(n => n.getAttribute('data-text')));
    await check(`online, the writing is read and shown as one line [${SYNTHETIC_EVIDENCE}]`,
      lines.length === 1 && lines[0] === known.text, JSON.stringify(lines));
    await page.waitForFunction(qid => new Promise(ok => {
      const r = indexedDB.open('pri-learning');
      r.onsuccess = () => { const db = r.result; const q = db.transaction('inkDrafts').objectStore('inkDrafts').getAllKeys();
        q.onsuccess = () => { db.close(); ok(q.result.some(k => String(k).endsWith(`:${qid}`))); }; q.onerror = () => { db.close(); ok(false); }; };
      r.onerror = () => ok(false);
    }), qid, { timeout: 15000, polling: 300 }).catch(() => {});
    const written = await inkOnCanvas(page);
    const before = online.ledger();
    const gradedBefore = (await online.practiceCalls(/^\/v1\/practice\/[^/]+\/submit$/)).length;

    // ── the connection goes ──────────────────────────────────────────────────
    await online.disconnect();
    await page.evaluate(() => { window.__PRI_E2E_SAME_PAGE__ = 'kept'; });
    await pressSubmit(page);
    await page.locator('[data-check-refusal]').waitFor({ state: 'visible', timeout: 30000 }).catch(() => {});
    const shown = await resultOnCard(page);
    await check('offline, Submit is answered with "Pri could not reach the server" and a Try again, in the card',
      shown.refusal.join() === 'reconnect' && /could not reach the server/i.test(await visibleText(page, '.verdict')) &&
        await page.locator('.verdict [data-check-retry]').isVisible(),
      `${JSON.stringify(shown)} ${JSON.stringify((await visibleText(page, '.verdict')).slice(0, 160))}`);
    await check('and with NO verdict, marks, XP or solution', nothingMarked(shown), JSON.stringify(shown));
    const facts = await deviceFacts(page, qid);
    await check('the work is kept: the strokes are on the canvas and in the sealed ink draft (IndexedDB readback), no attempt, no try spent',
      written > blank && await inkOnCanvas(page) === written && facts.inkKept === true && facts.attempts === 0 &&
        facts.row?.tries === 0 && facts.row?.answered === 0,
      `painted pixels blank ${blank}, written ${written}, now ${await inkOnCanvas(page)}; ${JSON.stringify(facts)}`);
    await check('the server marked nothing while it could not be reached',
      online.ledger().completions === before.completions && (await online.practiceCalls(/^\/v1\/practice\/[^/]+\/submit$/)).length === gradedBefore,
      JSON.stringify(online.ledger()));
    await check('nothing claims a mark made on this device', !/marked on this device|checked on this device/i.test(await visibleText(page, '.qpage')));

    // ── reconnected: Try again is marked, once ───────────────────────────────
    await online.reconnect();
    await page.locator('.verdict [data-check-retry]').click();
    await page.waitForSelector('.eval-card', { timeout: 30000 }).catch(() => {});
    const row = await online.shownRow();
    const grades = await online.practiceCalls(new RegExp(`^/v1/practice/${row?.serverQuestionId}/submit$`));
    const marks = (await page.locator('.eval-marks').innerText().catch(() => '')).replace(/\s+/g, ' ').trim();
    await check('after reconnecting, Try again is marked by the server as handwriting — same question, no reload',
      await shownId(page) === qid && await mathText('.q-prompt') === prompt && await page.evaluate(() => window.__PRI_E2E_SAME_PAGE__) === 'kept' &&
        grades.at(-1)?.status === 200 && grades.at(-1).json?.authoritative === true && grades.at(-1).json.correct === true &&
        grades.at(-1).body?.mode === 'ink' && /^data:image\//.test(grades.at(-1).body?.image || '') &&
        typeof grades.at(-1).json?.reading?.receipt === 'string' && !!online.recognitionProof(grades.at(-1).json.reading.receipt) && /^(\d+(?:\.\d)?) \/ \1 marks?\b/.test(marks),
      `marks ${JSON.stringify(marks)}; ${String(JSON.stringify(grades.at(-1) && { body: { ...grades.at(-1).body, image: typeof grades.at(-1).body?.image }, json: grades.at(-1).json })).slice(0, 300)}`);
    await page.waitForTimeout(1500);
    const settledGrades = await online.practiceCalls(new RegExp(`^/v1/practice/${row?.serverQuestionId}/submit$`));
    const ledger = online.ledger(row?.serverQuestionId);
    const after = await deviceFacts(page, qid);
    await check('marked exactly once: one submission key graded, one completion on the server, one attempt row on the device',
      new Set(settledGrades.filter(c => c.status === 200).map(c => c.body?.submissionId)).size === 1 &&
        ledger.thisDone === 1 && ledger.completions === before.completions + 1 && after.attempts === 1,
      `${settledGrades.length} grade request(s); ${JSON.stringify(ledger)}; attempts ${after.attempts}`);
    await check('the reader was sent pictures only, and nothing tried to reach a real provider',
      reader.refused.length === 0 && reader.requests.length >= 1, JSON.stringify(reader.refused));
    const history = await historyRows(page, base, qid);
    await check('History holds exactly one row for that question, marked correct',
      history.all === 1 && history.mine === 1 && history.verdicts.join() === 'Correct', JSON.stringify(history));
  }
};

// ── 3b · Opened with no connection: an offline draft is never marked ────────

export const syncOverlap = {
  id: 'sync-overlap',
  name: 'Sync · a pull overlapping a submit never doubles an attempt',
  online: true,

  async run({ page, ctx, base, check, goto, createProfile, settle, online }) {
    await goto('/');
    await createProfile({ name: 'Sync Overlap', year: 7 });
    await online.signIn({ name: 'Sync Overlap' });
    const rowsNow = () => page.evaluate(() => new Promise(ok => {
      const r = indexedDB.open('pri-learning');
      r.onsuccess = () => { const db = r.result; const c = db.transaction('attempts').objectStore('attempts').getAll();
        c.onsuccess = () => { db.close(); ok(c.result.map(a => ({ remote: typeof a.remoteEventId === 'string', server: a.serverAttemptId || a.remoteEventId || null }))); };
        c.onerror = () => { db.close(); ok(null); }; };
      r.onerror = () => ok(null);
    }));
    let rows = [];
    let rounds = 0;
    const roundsSeen = [];
    for (; rounds < 4; rounds++) {
      const known = await openTypedQuestion({ page, base, settle, online });
      if (!known) break;
      const before = online.ledger(known.serverQuestionId);
      // Every round must start with a NEW server-issued question, not the
      // previous question's sealed answer reused after a partial reload.
      if (before.thisDone !== 0 || known.accountId !== online.account?.id) {
        roundsSeen.push({ round: rounds + 1, question: known.serverQuestionId,
          issue: 'not a fresh question for the signed-in account', before });
        break;
      }
      await page.locator('.editor-body input.answer-input').fill(known.text);
      // Exercise the actual offline/online race, including a click that lands
      // while the browser is offline. An offline click that did not leave the
      // browser is NOT a submitted answer, and must be retried explicitly.
      const flap = (async () => { for (let i = 0; i < 12; i++) {
        await ctx.setOffline(true); await page.evaluate(() => window.dispatchEvent(new Event('offline')));
        await ctx.setOffline(false); await page.evaluate(() => window.dispatchEvent(new Event('online')));
        await page.waitForTimeout(25);
      } })();
      const firstClick = await submitButton(page).click().then(() => true, () => false);
      await flap;
      let complete = false;
      let retried = 0;
      // After reconnection, give the card its actual acknowledgement/retry
      // cycle. Do not move to another question while a submitted attempt is
      // unknown: that could hide an unmarked answer behind a successful count.
      for (let poll = 0; poll < 60; poll++) {
        rows = await rowsNow() || [];
        const finished = online.ledger(known.serverQuestionId).thisDone === 1;
        if (finished && rows.length === rounds + 1) { complete = true; break; }
        const retry = page.locator('[data-check-retry]');
        if (await retry.isVisible().catch(() => false) && await retry.isEnabled()) {
          await retry.click();
          retried++;
        } else if (!finished && await submitButton(page).isVisible().catch(() => false)
            && await submitButton(page).isEnabled()) {
          // The original press was not dispatched/received, or the card has
          // settled back to editable work. A student must press it explicitly.
          await submitButton(page).click();
          retried++;
        }
        await page.waitForTimeout(250);
      }
      roundsSeen.push({ round: rounds + 1, question: known.serverQuestionId,
        firstClick, retried, completed: complete,
        serverDone: online.ledger(known.serverQuestionId).thisDone,
        deviceRows: rows.length });
      if (!complete) break;
    }
    const perServerAttempt = new Map();
    for (const a of rows) perServerAttempt.set(a.server, (perServerAttempt.get(a.server) || 0) + 1);
    const ledger = online.ledger();
    await check('four answers were submitted under a flapping connection, each marked by the server',
      roundsSeen.length === 4 && roundsSeen.every(r => r.completed && r.serverDone === 1)
        && ledger.completions === 4 && ledger.issued >= 4,
      `${roundsSeen.length} rounds; ${JSON.stringify(ledger)}; ${JSON.stringify(roundsSeen)}`);
    await check('no server attempt appears as two attempt rows on the device: one row per answer',
      rows.length === 4 && [...perServerAttempt.values()].every(n => n === 1) && !perServerAttempt.has(null), JSON.stringify(rows));
  }
};

// ── 3e · Rapid Fire and Match: signed out no clock starts; answers are the server's ─

export const games = {
  id: 'games',
  name: 'Rapid Fire and Match · signed in, every answer is server-marked',
  online: true,

  async run({ page, base, check, goto, createProfile, settle, online }) {
    await goto('/');
    await createProfile({ name: 'Game Player', year: 7 });
    const attemptRows = () => page.evaluate(() => new Promise(ok => {
      const r = indexedDB.open('pri-learning');
      r.onsuccess = () => { const db = r.result; const c = db.transaction('attempts').objectStore('attempts').getAll();
        c.onsuccess = () => { db.close(); ok(c.result.map(a => ({ mode: a.mode, server: a.serverAttemptId || null }))); }; c.onerror = () => { db.close(); ok(null); }; };
      r.onerror = () => ok(null);
    }));
    // The student entered through the card and the gate (issue #477): there
    // is no signed-out lobby to refuse any more. What the games must still do
    // is mark every answer on the server, never on the device.
    const account = await online.signIn({ name: 'Game Player' });
    await page.goto(`${base}/rush`, { waitUntil: 'domcontentloaded' });
    await page.locator('.qcard .btn-primary.btn-lg').waitFor({ timeout: 30000 });

    // ── Rapid Fire, signed in: three answers, each the server's ──────────────
    const play = async (n) => {
      for (let i = 0; i < n; i++) {
        await page.waitForSelector('.q-prompt', { timeout: 30000 });
        const before = (await attemptRows())?.length ?? 0;
        const option = page.locator('.mcq-opt').first();
        const box = page.locator('input.answer-input').first();
        if (await option.count()) await option.click();
        else { await box.fill('0'); await page.locator('.answer-row .btn-primary').click(); }
        for (let w = 0; w < 80 && ((await attemptRows())?.length ?? 0) === before; w++) await page.waitForTimeout(100);
      }
    };
    await page.locator('.qcard .btn-primary.btn-lg').click();
    const clock = await page.waitForSelector('.rush-timer', { timeout: 30000 }).then(() => true, () => false);
    if (!await check('signed in, Rapid Fire starts: a clock and a question', clock && await page.locator('.q-prompt').count() === 1)) return;
    await play(3);
    const rushRows = (await attemptRows()) || [];
    const sealed = online.platform.db.prepare("SELECT COUNT(*) AS n FROM idempotency_keys WHERE account_id=? AND scope='practice-completion'").get(account.id).n;
    await check('each Rapid Fire answer is a server-marked attempt: every row carries the server\'s attempt id, and the server completed as many',
      rushRows.length === 3 && rushRows.every(a => a.mode === 'rush' && typeof a.server === 'string' && a.server.length > 0) && Number(sealed) === 3,
      `${JSON.stringify(rushRows)}; server completions ${sealed}`);

    // ── Match, signed in ─────────────────────────────────────────────────────
    await page.goto(`${base}/match`, { waitUntil: 'domcontentloaded' });
    await page.locator('.btn-glow').waitFor({ timeout: 30000 });
    await page.locator('.btn-glow').click();
    const playing = await page.waitForSelector('.q-prompt', { timeout: 30000 }).then(() => true, () => false);
    if (!await check('signed in, Match starts', playing && await page.locator('[data-game-refused]').count() === 0)) return;
    await play(2);
    const allRows = (await attemptRows()) || [];
    const matchRows = allRows.filter(a => a.mode === 'match');
    await check('each Match answer is a server-marked attempt too',
      matchRows.length === 2 && matchRows.every(a => typeof a.server === 'string' && a.server.length > 0) &&
        Number(online.platform.db.prepare("SELECT COUNT(*) AS n FROM idempotency_keys WHERE account_id=? AND scope='practice-completion'").get(account.id).n) === 5,
      JSON.stringify(allRows));
    await check('and no uncaught refusal or device mark: every answer the games sent was accepted by the server',
      (await online.practiceCalls(/^\/v1\/practice\/[^/]+\/submit$/)).every(c => c.status === 200 && c.json?.authoritative === true && typeof c.json.attemptId === 'string'),
      JSON.stringify((await online.practiceCalls(/^\/v1\/practice\/[^/]+\/submit$/)).map(c => c.status)));
  }
};

export const examOfflineFinish = {
  id: 'exam-offline-finish',
  name: 'Exam · finished offline: submitted, no score; reconnected: the server\'s result',
  online: true,

  async run({ page, base, check, goto, createProfile, settle, online }) {
    await goto('/');
    await createProfile({ name: 'Offline Finisher', year: 9 });
    const account = await online.signIn({ name: 'Offline Finisher' });
    // Mock papers are Premium-only; this journey is about sitting one, so the account holds real Premium (admin grant).
    await online.grantPremium();
    await page.goto(`${base}/exams`, { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'Start practice paper' }).waitFor({ timeout: 30000 });
    await page.getByRole('button', { name: 'Start practice paper' }).click();
    await page.waitForSelector('.exam-timer', { timeout: 60000 });
    const examId = new URL(page.url()).pathname.split('/').pop();
    const sealed = new Map(await online.examAnswers(examId));
    const answerBox = page.locator('.answer-row input.answer-input');
    const dots = await page.locator('.exam-dot').count();
    let answeredAt = null;
    for (let i = 0; i < dots && answeredAt === null; i++) {
      await page.locator('.exam-dot').nth(i).click();
      await settle();
      if ((await page.locator('.q-meta').innerText()).includes('Structured') || await answerBox.count() !== 1 || !sealed.get(i + 1)) continue;
      await answerBox.fill(sealed.get(i + 1));
      answeredAt = i + 1;
    }
    if (!await check('a server-issued paper is open and one question is answered from the server\'s sealed paper', answeredAt !== null, `${sealed.size} sealed answers`)) return;
    // The answer reaches the server as a checkpoint while the paper is sat.
    const checkpoints = () => online.calls.filter(c => c.method === 'PATCH' && /^\/v1\/exams\/[^/]+\/answers$/.test(c.path) && c.status < 300);
    for (let w = 0; w < 60 && !checkpoints().length; w++) await page.waitForTimeout(250);
    await check('answers are checkpointed to the server while the paper is sat', checkpoints().length >= 1,
      JSON.stringify(online.calls.filter(c => /^\/v1\/exams/.test(c.path)).map(c => `${c.status} ${c.method}`)));

    // ── the connection goes; the student submits ─────────────────────────────
    await online.disconnect();
    await page.evaluate(() => { window.__PRI_E2E_SAME_PAGE__ = 'kept'; });
    await page.locator('.exam-head').getByRole('button', { name: 'Review and submit' }).click();
    await page.locator('[role="dialog"]').getByRole('button', { name: 'Submit paper' }).click();
    const pending = page.locator('[data-exam-pending]').first();
    await pending.waitFor({ state: 'visible', timeout: 60000 }).catch(() => {});
    const pendingText = (await pending.innerText().catch(() => '')).replace(/\s+/g, ' ');
    await check('offline, the room says "Submitted. Not marked yet." as a status — with no score, percentage or marks',
      /Submitted\. Not marked yet\./.test(pendingText) && await pending.getAttribute('role') === 'status' &&
        await page.locator('.hero-num').count() === 0 && !/\d+\s*%|\d+ of \d+ marks/.test(pendingText),
      JSON.stringify(pendingText.slice(0, 240)));
    await check('and the server has marked nothing: no result is held for the paper',
      (await online.examResult(examId)) === null && (await online.practiceCalls(/^\/v1\/exams\/[^/]+\/finish$/)).filter(c => c.status === 200).length === 0);
    await check('nothing claims a mark made on this device', !/marked on this device|checked on this device/i.test(await page.locator('main, .shell').first().innerText()));
    // The Exams list tells the same truth. Reached inside the app: a page
    // load with no server is the activation gate's retry screen (issue #477).
    await page.locator('a[href="/exams"]').first().evaluate(a => a.click());
    await page.waitForSelector('.prio-item', { timeout: 30000 });
    await check('the Exams list shows the paper as waiting to be marked, with no score',
      await page.locator('.prio-item [data-exam-pending]').count() === 1 && !/\d+\/\d+/.test((await page.locator('.prio-item').first().innerText()).replace(/\d{1,2}[:/]\d{2}/g, '')),
      (await page.locator('.prio-item').first().innerText()).replace(/\s+/g, ' ').slice(0, 160));

    // ── reconnected: the server marks it, once, and the room shows that result ─
    await page.locator('.prio-item').first().getByRole('button', { name: /open|resume|review/i }).last().click();
    await page.waitForURL(url => new URL(url).pathname === `/exams/${examId}`, { timeout: 30000 }).catch(() => {});
    if (!await check('the paper reopens inside the app, still offline', new URL(page.url()).pathname === `/exams/${examId}`, page.url())) return;
    await page.locator('[data-exam-pending]').first().waitFor({ state: 'visible', timeout: 30000 }).catch(() => {});
    await online.reconnect();
    await page.evaluate(() => window.dispatchEvent(new Event('online')));
    await page.waitForSelector('.hero-num', { timeout: 45000 }).catch(() => {});
    const result = await online.examResult(examId);
    const summary = (await page.locator('.card').first().innerText().catch(() => '')).replace(/\s+/g, ' ');
    const scored = /(\d+) of (\d+) marks/.exec(summary);
    await check('after reconnecting the paper is marked by the server without being sat again, and the room shows the server\'s score',
      await page.locator('.hero-num').count() === 1 && !!result && result.accountId === account.id && !!scored &&
        JSON.stringify(result).includes(`"score":${scored[1]}`) && JSON.stringify(result).includes(`"total":${scored[2]}`),
      `summary ${JSON.stringify(summary.slice(0, 160))}; server result ${result ? 'held' : 'missing'}`);
    await page.waitForTimeout(1500);
    const finishes = (await online.practiceCalls(/^\/v1\/exams\/[^/]+\/finish$/)).filter(c => c.status === 200);
    await check('marked exactly once: every accepted finish carries the same result, and the answer given offline earned its marks',
      finishes.length >= 1 && new Set(finishes.map(c => JSON.stringify(c.json?.result?.score ?? c.json?.score ?? null))).size === 1 && Number(scored?.[1]) >= 1,
      `${finishes.length} accepted finish call(s); score ${scored?.[1]}/${scored?.[2]}`);
  }
};

// ── 3b · Offline inside the app: an offline draft is never marked ──────────

/** Next question until a typed answer box is on screen (any check state). */
async function findTyped(page, settle) {
  const typeTab = page.getByRole('button', { name: 'Answer by typing' });
  const answerBox = page.locator('.editor-body input.answer-input');
  for (let skips = 0; skips <= MAX_SKIPS; skips++) {
    if (await typeTab.count()) await typeTab.click();
    await settle();
    if (await answerBox.count() === 1) return true;
    await nextQuestion(page, settle);
  }
  return false;
}

/** Next question until the server has issued a typed question whose answer the oracle knows. */
async function findIssuedTyped(page, settle, online) {
  const typeTab = page.getByRole('button', { name: 'Answer by typing' });
  const answerBox = page.locator('.editor-body input.answer-input');
  for (let skips = 0; skips <= MAX_SKIPS; skips++) {
    if (await typeTab.count()) await typeTab.click();
    await settle();
    if (await answerBox.count() === 1) { const known = await online.answerOf(); if (known.kind === 'text' && known.text !== null) return known; }
    await nextQuestion(page, settle);
  }
  return null;
}

export const draftOffline = {
  id: 'draft-offline',
  name: 'Draft · offline inside the app: never marked, work kept; a new question online is server-issued',
  online: true,

  async run({ page, ctx, base, check, goto, createProfile, settle, online }) {
    await goto('/');
    await createProfile({ name: 'Offline Opener', year: 7 });
    const account = await online.signIn({ name: 'Offline Opener' });
    await page.goto(`${base}/practice?subtopic=${TOPIC}`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.qpage[data-question-id] .q-prompt', { timeout: 30000 });
    const answerBox = page.locator('.editor-body input.answer-input');
    const before = online.ledger();
    // Signed in and inside the app, the connection goes; the next question
    // can come from neither issue nor prepare, so the device serves a draft.
    await ctx.setOffline(true);
    await nextQuestion(page, settle);
    const found = await findTyped(page, settle);
    const draftRow = await online.shownRow();
    const qid = await shownId(page);
    if (!await check('offline inside the app, Next question still shows a question to work on — the device\'s own draft, never the server\'s',
      found && draftRow?.checkState === 'draft' && !draftRow.serverQuestionId, JSON.stringify(draftRow))) { await ctx.setOffline(false); return; }
    const said = await visibleText(page, '[data-check-unmarkable]');
    const replace = page.locator('.ws-actions [data-primary-action="replace"]');
    await check('the card says why before any work — cannot be marked — never "already finished" or "another tab"',
      await page.locator('[data-check-unmarkable]').count() === 1 && /cannot be marked/i.test(said) && !/already finished|finished elsewhere|another tab/i.test(said),
      JSON.stringify(said.slice(0, 260)));
    const shown = await resultOnCard(page);
    await check('a draft offers no Submit and no Show solution: the one action is to try for a markable question',
      await replace.count() === 1 && /markable question/i.test(await replace.innerText()) &&
        await page.locator('.ws-actions-btns .btn').filter({ hasText: /solution/i }).count() === 0 &&
        await page.locator('.ws-actions .btn-primary').count() === 1 && nothingMarked(shown) && !/marked on this device|checked on this device/i.test(await visibleText(page, '.qpage')),
      `${await replace.count()} replace; ${JSON.stringify(await page.locator('.ws-actions .btn').allInnerTexts())}`);
    await answerBox.fill(SURELY_WRONG);
    await page.waitForFunction(() => /saved on this device/i.test(document.querySelector('.ws-actions .status-line')?.innerText || ''), null, { timeout: 10000 }).catch(() => {});

    // Still offline: replacing takes a second press, and with no markable
    // question to be had nothing here changes.
    await replace.click();
    const asked = await page.locator('[data-check-replace-confirm]').waitFor({ timeout: 10000 }).then(() => true, () => false) && await shownId(page) === qid;
    await replace.click();
    await page.waitForSelector('[data-check-replace-note]', { timeout: 20000 }).catch(() => {});
    let facts = await deviceFacts(page, qid);
    await check('with work on the page replacing asks first, and offline nothing changes: same question, answer still in the box, no attempt, no try',
      asked && await page.locator('[data-check-replace-note]').count() === 1 && await shownId(page) === qid &&
        await answerBox.inputValue() === SURELY_WRONG && facts.attempts === 0 && facts.row?.tries === 0 && facts.row?.answered === 0,
      `asked ${asked}; shown ${await shownId(page)} vs ${qid}; box ${JSON.stringify(await answerBox.inputValue())}; ${JSON.stringify(facts)}`);
    await check('nothing was sent to be marked and nothing was issued for the draft',
      (await online.practiceCalls(MARKING)).filter(c => c.body?.prepared || /submit|reveal|recogni/.test(c.path)).length === 0 && online.ledger().completions === before.completions,
      JSON.stringify((await online.practiceCalls(MARKING)).map(c => c.path)));

    // Back online: the same action opens the server's question.
    await ctx.setOffline(false);
    await page.evaluate(() => window.dispatchEvent(new Event('online')));
    await replace.click();
    await page.waitForSelector('[data-check-replace-confirm]', { timeout: 10000 }).catch(() => {});
    if (await page.locator('[data-check-replace-confirm]').count()) await replace.click();
    await page.waitForFunction(id => {
      const el = document.querySelector('.qpage[data-question-id]');
      return el && el.getAttribute('data-question-id') !== id && el.querySelector('.q-prompt');
    }, qid, { timeout: 30000 }).catch(() => {});
    await settle();
    facts = await deviceFacts(page, qid);
    const nowRow = await online.shownRow();
    await check('online again the draft is replaced by a question the server issued to this account, and the draft left no attempt',
      await shownId(page) !== qid && nowRow?.checkState === 'issued' && facts.attempts === 0, `${await shownId(page)}; ${JSON.stringify(nowRow)}`);
    const known = await findIssuedTyped(page, settle, online);
    if (!await check('a typed question the server issued is on screen', !!known && known.accountId === account.id, JSON.stringify(await online.shownRow()))) return;
    await answerBox.fill(known.text);
    await pressSubmit(page);
    await page.waitForSelector('.eval-card', { timeout: 30000 }).catch(() => {});
    const grade = (await online.practiceCalls(new RegExp(`^/v1/practice/${known.serverQuestionId}/submit$`))).at(-1);
    await check('and that one is marked by the server',
      grade?.status === 200 && grade.json?.authoritative === true && grade.json.correct === true && await page.locator('.eval-card[data-outcome="correct"]').count() === 1,
      String(JSON.stringify(grade?.json)).slice(0, 240));
    const history = await historyRows(page, base, qid);
    await check('the draft left no attempt behind: History holds only the server-marked question', history.all === 1 && history.mine === 0, JSON.stringify(history));
  }
};

// ── 3c · A prepared question taken up elsewhere is not marked here ───────────

export const preparedTaken = {
  id: 'prepared-taken',
  name: 'Prepared · taken up by another account: not marked here, work kept, next one is',
  online: true,

  async run({ page, ctx, base, check, goto, createProfile, mathText, settle, online }) {
    await goto('/');
    await createProfile({ name: 'Late Binder', year: 7 });
    const account = await online.signIn({ name: 'Late Binder' });
    // While armed, a fresh issue (no prepared token) fails at the route, so
    // serveQuestion falls back to a prepared question for this signed-in student.
    let armed = true;
    let refusedIssues = 0;
    const issueRoute = url => url.origin === online.origin && url.pathname === '/v1/practice/issue';
    const handler = route => {
      let body = null; try { body = route.request().postDataJSON(); } catch { body = null; }
      if (armed && !body?.prepared) { refusedIssues++; return route.abort('connectionfailed'); }
      return route.continue();
    };
    await ctx.route(issueRoute, handler);
    await page.goto(`${base}/practice?subtopic=${TOPIC}`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.qpage[data-question-id] .q-prompt', { timeout: 30000 });
    const found = await findTyped(page, settle);
    armed = false;
    const shownBefore = await online.shownRow();
    const qid = await shownId(page);
    const prompt = await mathText('.q-prompt');
    const answerBox = page.locator('.editor-body input.answer-input');
    const mine = (await online.practiceCalls(/^\/v1\/practice\/prepare$/)).filter(c => c.status === 200 && typeof c.json?.prepared === 'string' && c.json?.question?.prompt === shownBefore?.prompt).at(-1);
    if (!await check('signed in, with the issue call failing, the question on screen is a prepared one', found && refusedIssues >= 1 && shownBefore?.checkState === 'prepared' && !!mine,
      JSON.stringify({ refusedIssues, shownBefore }))) return;
    await answerBox.fill(SURELY_WRONG);
    await page.waitForFunction(() => /saved on this device/i.test(document.querySelector('.ws-actions .status-line')?.innerText || ''), null, { timeout: 10000 }).catch(() => {});
    const issuedBefore = online.ledger().issued;
    const elsewhere = await online.platform.bindPreparedElsewhere(mine.json.prepared);
    await check('another account took the prepared question up first (the server bound it there)', elsewhere.status === 201 && !!elsewhere.questionId, JSON.stringify(elsewhere));
    await pressSubmit(page);
    await page.waitForSelector('.verdict, .eval-card', { timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(600);
    const shown = await resultOnCard(page);
    const said = await visibleText(page, '.verdict');
    const binds = (await online.practiceCalls(/^\/v1\/practice\/issue$/)).filter(c => c.body?.prepared === mine.json.prepared);
    await check('the server refuses to bind it to a second account (409), and nothing is marked here: no verdict, marks, XP or solution',
      binds.length === 1 && binds[0].status === 409 && Object.keys(binds[0].body || {}).every(k => k === 'prepared' || (k === 'account' && binds[0].body.account === account.id)) && nothingMarked(shown) &&
        (await online.practiceCalls(/^\/v1\/practice\/[^/]+\/submit$/)).length === 0 && online.ledger().issued === issuedBefore && online.ledger().completions === 0,
      `${JSON.stringify(binds.map(c => `${c.status} ${c.json?.error?.code}`))} ${JSON.stringify(shown)}`);
    await check('the card says so as a named refusal with Next question on it, never "already finished" or "another tab"',
      said.length > 20 && !/already finished|finished elsewhere|another tab/i.test(said) &&
        await page.locator('[data-check-refusal]').count() === 1 && await page.locator('[data-check-next]').count() === 1,
      `${JSON.stringify(said.slice(0, 260))}; refusal ${JSON.stringify(shown.refusal)}`);
    const facts = await deviceFacts(page, qid);
    await check('the work is kept and nothing was spent: same question, answer still in the box, no attempt, no try',
      await shownId(page) === qid && await mathText('.q-prompt') === prompt && await answerBox.inputValue() === SURELY_WRONG &&
        facts.attempts === 0 && facts.row?.tries === 0 && facts.row?.answered === 0, `${JSON.stringify(facts)}`);
    await ctx.unroute(issueRoute, handler);
    await nextQuestion(page, settle);
    const known = await findIssuedTyped(page, settle, online);
    if (!await check('Next question gives a question the server issued to this account', !!known && known.accountId === account.id, JSON.stringify(await online.shownRow()))) return;
    await answerBox.fill(known.text);
    await pressSubmit(page);
    await page.waitForSelector('.eval-card', { timeout: 30000 }).catch(() => {});
    const grade = (await online.practiceCalls(new RegExp(`^/v1/practice/${known.serverQuestionId}/submit$`))).at(-1);
    await check('and that one is marked by the server', grade?.status === 200 && grade.json?.authoritative === true && grade.json.correct === true,
      String(JSON.stringify(grade?.json)).slice(0, 240));
  }
};

// ── 3f · Session ended at a start button: nothing starts, sign in again in place ─

export const sessionEndedStarts = {
  id: 'session-ended-starts',
  name: 'Session ended at a start: a paper, Rapid Fire and Match start nothing; signing in again in place starts them',
  online: true,

  async run({ page, base, check, goto, createProfile, online }) {
    await goto('/');
    await createProfile({ name: 'Ended Starter', year: 9 });
    const account = await online.signIn({ name: 'Ended Starter' });
    // Mock papers are Premium-only; this journey is about sitting one, so the account holds real Premium (admin grant).
    await online.grantPremium();
    const endSession = () => online.platform.h.db.prepare('DELETE FROM account_sessions WHERE account_id=?').run(account.id).changes;
    const storedExams = () => page.evaluate(() => new Promise(done => {
      const open = indexedDB.open('pri-learning');
      open.onsuccess = () => { const db = open.result; const r = db.transaction('exams').objectStore('exams').count(); r.onsuccess = () => { db.close(); done(r.result); }; r.onerror = () => { db.close(); done(-1); }; };
      open.onerror = () => done(-1);
    }));

    // ── Exams ────────────────────────────────────────────────────────────────
    await page.goto(`${base}/exams`, { waitUntil: 'domcontentloaded' });
    const start = page.getByRole('button', { name: 'Start practice paper' });
    await start.waitFor({ timeout: 30000 });
    await page.evaluate(() => { window.__PRI_E2E_SAME_PAGE__ = 'kept'; });
    const ended = endSession();
    await start.click();
    const refused = page.locator('[data-exam-start-refused]');
    await refused.waitFor({ state: 'visible', timeout: 20000 }).catch(() => {});
    await check('session ended, "Start practice paper" is refused in place with the sign-in beside it; the paper has not started',
      ended >= 1 && await refused.getAttribute('data-exam-start-refused').catch(() => null) === 'sign-in' && await refused.getAttribute('role') === 'alert' &&
        /has not started/i.test(await refused.innerText()) && await refused.locator('[data-check-sign-in]').isEnabled().catch(() => false),
      (await refused.innerText().catch(() => 'no refusal shown')).slice(0, 200));
    await check('no paper was stored or issued, and the exam room did not open',
      await storedExams() === 0 && new URL(page.url()).pathname === '/exams' && await page.locator('.exam-timer').count() === 0 &&
        (await online.practiceCalls(/^\/v1\/exams$/)).filter(c => c.status < 300).length === 0, page.url());
    await refused.locator('[data-check-sign-in]').click();
    await online.signInHere(refused, { account });
    await page.locator('[data-signin-card="inline"]').waitFor({ state: 'detached', timeout: 15000 }).catch(() => {});
    await check('signed in again on the Exams page: no navigation, no reload, and the sign-in card is gone',
      new URL(page.url()).pathname === '/exams' && await page.evaluate(() => window.__PRI_E2E_SAME_PAGE__) === 'kept' &&
        await page.locator('[data-signin-card="inline"]').count() === 0, page.url());
    await page.getByRole('button', { name: 'Start practice paper' }).click();
    await page.waitForSelector('.exam-timer', { timeout: 60000 }).catch(() => {});
    const issued = (await online.practiceCalls(/^\/v1\/exams$/)).filter(c => c.status < 300);
    await check('then the same button starts the paper — issued by the server, once',
      await page.locator('.exam-timer').count() === 1 && /\/exams\/[^/]+$/.test(new URL(page.url()).pathname) && issued.length === 1, `${page.url()}; ${issued.length} issued`);

    // ── Rapid Fire and Match ─────────────────────────────────────────────────
    for (const game of [{ path: '/rush', name: 'Rapid Fire', button: '.qcard .btn-primary.btn-lg', running: '.rush-timer' }, { path: '/match', name: 'Match', button: '.btn-glow', running: '.q-prompt' }]) {
      await page.goto(`${base}${game.path}`, { waitUntil: 'domcontentloaded' });
      await page.locator(game.button).waitFor({ timeout: 30000 });
      await page.evaluate(() => { window.__PRI_E2E_SAME_PAGE__ = 'kept'; });
      const submitsBefore = (await online.practiceCalls(/^\/v1\/practice\/[^/]+\/submit$/)).length;
      endSession();
      await page.locator(game.button).click();
      const block = page.locator('[data-game-refused]');
      await block.waitFor({ state: 'visible', timeout: 20000 }).catch(() => {});
      await check(`session ended, ${game.name} does not start: no clock, no question, the sign-in in place`,
        await block.getAttribute('data-game-refused').catch(() => null) === 'sign-in' && await page.locator('.rush-timer').count() === 0 &&
          await page.locator('.q-prompt').count() === 0 && await block.locator('[data-check-sign-in]').isEnabled().catch(() => false) &&
          (await online.practiceCalls(/^\/v1\/practice\/[^/]+\/submit$/)).length === submitsBefore,
        (await block.innerText().catch(() => 'no refusal shown')).replace(/\s+/g, ' ').slice(0, 200));
      await block.locator('[data-check-sign-in]').click();
      await online.signInHere(block, { account });
      await page.locator('[data-signin-card="inline"]').waitFor({ state: 'detached', timeout: 15000 }).catch(() => {});
      await check(`signed in again in the ${game.name} lobby: no navigation, no reload, and the sign-in card is gone`,
        new URL(page.url()).pathname === game.path && await page.evaluate(() => window.__PRI_E2E_SAME_PAGE__) === 'kept' &&
          await page.locator('[data-signin-card="inline"]').count() === 0, page.url());
      await page.locator(game.button).first().click();
      const going = await page.waitForSelector(game.running, { timeout: 30000 }).then(() => true, () => false);
      await check(`then ${game.name} starts`, going && await page.locator('[data-game-refused]').count() === 0);
    }
  }
};

// Retired with the activation gate (issue #477): "type, signed out", "draft
// opened offline", "a prepared question taken up elsewhere" and the two
// "exams, signed out" journeys walked a signed-out student INSIDE the app —
// a state that no longer exists: nothing opens until the server has confirmed
// the account (tour-activation-gate.js proves the gate; an app opened
// offline is its retry screen). What those journeys protected — work kept,
// never a device mark, sign-in in place — is walked here for a signed-in
// student: offline inside the app (draftOffline), a prepared question taken
// elsewhere (preparedTaken), a session that ended at a start button
// (sessionEndedStarts), and in the session-ended journeys of
// tour-write-sign-in.js.
export const flows = [typeOffline, writeOffline, draftOffline, preparedTaken, syncOverlap, games, sessionEndedStarts, examOfflineFinish];

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const { runFlows } = await import('./e2e.mjs');
  console.log(`${SYNTHETIC_EVIDENCE} — in this suite the handwriting reader behind the real server is a scripted stand-in; the server, its SQLite database, the account and every grade are real. No real provider, device or handwriting is evidenced here.`);
  process.exit(await runFlows(flows) ? 1 : 0);
}
