// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · E2E journeys — online-only checking, as a student meets it.
//
// Owner decision 2026-10-10: nothing is checked signed out or offline, not even
// labelled as a device mark. Checking an answer, awarding marks and showing the
// solution need a verified signed-in account, a connection and a question the
// server issued. Before that a student may read, type, write, preview and keep
// drafts, and is offered sign-in or reconnect in place without losing work.
//
// tour-write-sign-in.js carries the handwritten signed-out journey (code
// sign-in on the card). This file carries the rest of the contract:
//
//   1. Type, signed out — the draft is kept (and survives a reload); Submit and
//      Show solution are refused with the sign-in in the card and NO verdict,
//      marks, XP or solution; nothing reaches the server and nothing is spent;
//      after signing in on the card (password) the same question and the same
//      typed work are there, and the submission is marked by the server.
//   2. Type, offline — a signed-in student loses the connection (every /v1
//      request fails at the network layer); Submit shows the reconnect message
//      and keeps the work; Retry after reconnecting is marked exactly once.
//   3. Write, offline — the same, with handwriting.
//   4. Exams, signed out — a paper does not start; sign-in is offered in place.
//
// WHAT IS REAL: the built client, the real platform server and its SQLite
// database, the account, every grade. WHAT IS SYNTHETIC: the handwriting
// reader's provider hop in journey 3 (support/online-session.mjs) — a scripted
// stand-in, labelled in this suite's output; nothing here is evidence about
// real handwriting recognition, a real provider or a real device.
//
// Run on its own:  node client/test/tour-online-check.js
// ─────────────────────────────────────────────────────────────────────────────
import { pathToFileURL } from 'node:url';
import { handwrite } from './fakeServerReader.js';
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
 * Open practice on a question with one typed answer box whose right answer the
 * oracle can regenerate as plain text (`accept` narrows it further).
 */
async function openTypedQuestion({ page, base, settle, online, accept = () => true }) {
  await page.goto(`${base}/practice?subtopic=${TOPIC}`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.qpage[data-question-id] .q-prompt', { timeout: 30000 });
  const typeTab = page.getByRole('button', { name: 'Answer by typing' });
  const answerBox = page.locator('.editor-body input.answer-input');
  for (let skips = 0; skips <= MAX_SKIPS; skips++) {
    if (await typeTab.count()) await typeTab.click();
    await settle();
    if (await answerBox.count() === 1) {
      const known = await online.answerOf();
      if (known.kind === 'text' && known.text !== null && accept(String(known.text))) return known;
    }
    await nextQuestion(page, settle);
  }
  return null;
}

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

// ── 1 · Type, signed out ─────────────────────────────────────────────────────

export const typeSignedOut = {
  id: 'type-signed-out',
  name: 'Type · signed out: kept, not checked; signed in on the card, server-marked',
  online: true,

  async run({ page, base, check, goto, createProfile, mathText, settle, online }) {
    await goto('/');
    await createProfile({ name: 'Signed Out Typist', year: 7 });
    const known = await openTypedQuestion({ page, base, settle, online });
    if (!await check('signed out, Practice serves a question to read and a box to type in', !!known)) return;
    const qid = await shownId(page);
    const prompt = await mathText('.q-prompt');
    const answerBox = page.locator('.editor-body input.answer-input');

    // ── said before Submit is pressed ────────────────────────────────────────
    const notice = page.locator('[data-check-needs-account]');
    await check('before anything is submitted the card says checking needs a Pri account, with sign-in in the card',
      await notice.isVisible() && /needs a Pri account/i.test(await notice.innerText()) &&
        await notice.locator('[data-check-sign-in]').isEnabled(),
      (await notice.innerText().catch(() => 'no notice')).slice(0, 200));

    // ── the draft is kept, and survives a reload ────────────────────────────
    await answerBox.fill(SURELY_WRONG);
    await page.waitForFunction(() => /saved on this device/i.test(document.querySelector('.ws-actions .status-line')?.innerText || ''), null, { timeout: 10000 }).catch(() => {});
    const drafted = await deviceFacts(page, qid);
    await check('the typed answer is saved on this device before any account exists (storage readback)',
      /saved on this device/i.test(await visibleText(page, '.ws-actions .status-line')) && JSON.stringify(drafted.draft || '').includes(SURELY_WRONG),
      `status ${JSON.stringify(await visibleText(page, '.ws-actions .status-line'))}; draft ${JSON.stringify(drafted.draft).slice(0, 160)}`);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.qpage[data-question-id] .q-prompt', { timeout: 30000 });
    const typeTab = page.getByRole('button', { name: 'Answer by typing' });
    if (await typeTab.count()) await typeTab.click();
    await answerBox.waitFor({ timeout: 15000 });
    await check('after a reload the same question and the same typed answer are back',
      await shownId(page) === qid && await answerBox.inputValue() === SURELY_WRONG,
      `question ${await shownId(page)} (was ${qid}); box ${JSON.stringify(await answerBox.inputValue())}`);

    // ── Submit: refused, nothing checked ─────────────────────────────────────
    await page.evaluate(() => { window.__PRI_E2E_SAME_PAGE__ = 'kept'; });
    await pressSubmit(page);
    await page.locator('[data-check-refusal]').waitFor({ state: 'visible', timeout: 15000 }).catch(() => {});
    let shown = await resultOnCard(page);
    await check('Submit is answered with the sign-in, in the card: "Checking needs a Pri account"',
      shown.refusal.join() === 'sign-in' && /Checking needs a Pri account/.test(await visibleText(page, '.verdict')) &&
        await page.locator('.verdict [data-check-sign-in]').isEnabled(),
      `${JSON.stringify(shown)} ${JSON.stringify((await visibleText(page, '.verdict')).slice(0, 160))}`);
    await check('and with NO verdict, marks, XP or solution', nothingMarked(shown), JSON.stringify(shown));
    await check('the refusal is announced to assistive technology, politely, in words that say what did not happen',
      /has not been checked/.test(await page.evaluate(() => [...document.querySelectorAll('.qpage [role="status"][aria-live="polite"][aria-atomic="true"]')].map(el => el.textContent).join(' '))));
    let facts = await deviceFacts(page, qid);
    await check('nothing was spent on the device: no attempt row, no try, the question still open',
      facts.attempts === 0 && facts.row?.tries === 0 && facts.row?.answered === 0 && !facts.row?.issued, JSON.stringify(facts));
    await check('nothing was sent to be marked: no practice request reached the server',
      (await online.practiceCalls(/^\/v1\/practice\//)).length === 0,
      JSON.stringify((await online.practiceCalls(/^\/v1\/practice\//)).map(c => c.path)));
    await check('the typed answer is still in the box', await answerBox.inputValue() === SURELY_WRONG, JSON.stringify(await answerBox.inputValue()));

    // ── Show solution: refused the same way ──────────────────────────────────
    const reveal = page.locator('.ws-actions-btns .btn').filter({ hasText: /solution/i }).first();
    for (let press = 0; press < 2 && await reveal.count(); press++) { await reveal.click(); await page.waitForTimeout(300); }
    await page.locator('[data-check-refusal]').waitFor({ state: 'visible', timeout: 15000 }).catch(() => {});
    shown = await resultOnCard(page);
    facts = await deviceFacts(page, qid);
    await check('Show solution is refused the same way: sign-in in the card, no solution, nothing revealed or spent',
      shown.refusal.join() === 'sign-in' && nothingMarked(shown) && facts.attempts === 0 && facts.row?.answered === 0 &&
        (await online.practiceCalls(/^\/v1\/practice\//)).length === 0,
      `${JSON.stringify(shown)} ${JSON.stringify(facts)}`);
    await check('nothing on the page offers or claims a mark made on this device',
      !/marked on this device|checked on this device/i.test(await visibleText(page, '.qpage')), (await visibleText(page, '.qpage')).slice(0, 240));

    // ── sign in, on the card ─────────────────────────────────────────────────
    await page.locator('.verdict [data-check-sign-in]').click();
    const account = await online.signInHere(page.locator('.qpage'), { name: 'Signed Out Typist' });
    await page.waitForFunction(() => !document.querySelector('[data-check-needs-account]') && !document.querySelector('.qpage #cloud-password'), null, { timeout: 30000 }).catch(() => {});
    await check('signed in on the real server without leaving the question: same page, no reload',
      new URL(page.url()).pathname === '/practice' && await page.evaluate(() => window.__PRI_E2E_SAME_PAGE__) === 'kept' &&
        (await online.linkedAccounts())?.includes(account.id), page.url());
    await check('the SAME question and the SAME typed answer are on screen after sign-in',
      await shownId(page) === qid && await mathText('.q-prompt') === prompt && await answerBox.inputValue() === SURELY_WRONG,
      `question ${await shownId(page)} (was ${qid}); box ${JSON.stringify(await answerBox.inputValue())}`);
    await check('signing in alone marks nothing', (await online.practiceCalls(/^\/v1\/practice\//)).length === 0 && nothingMarked(await resultOnCard(page)),
      JSON.stringify(await resultOnCard(page)));

    // ── server-marked: the kept wrong answer, then the right one ─────────────
    await pressSubmit(page);
    await page.waitForSelector('.verdict-bad, .eval-card', { timeout: 30000 }).catch(() => {});
    const issues = await online.practiceCalls(/^\/v1\/practice\/issue$/);
    const serverQid = issues[0]?.json?.question?.id || null;
    const first = (await online.practiceCalls(new RegExp(`^/v1/practice/${serverQid}/submit$`))).at(-1);
    await check('the question was issued by the server at submit — generator, difficulty and seed, never an answer — and stayed the same question',
      issues.length === 1 && issues[0].status === 201 && !!serverQid && await shownId(page) === qid && await mathText('.q-prompt') === prompt &&
        Object.keys(issues[0].body || {}).every(k => ['generator', 'difficulty', 'seed', 'curriculum', 'mode'].includes(k)),
      JSON.stringify(issues.map(c => ({ status: c.status, body: c.body }))));
    await check('the kept wrong answer is marked by the server: authoritative, wrong, one try left',
      first?.status === 200 && first.json?.authoritative === true && first.json.correct === false && first.json.resolved === false &&
        first.json.triesLeft === 1 && first.body?.answer === SURELY_WRONG && first.body?.mode === 'typed' && await page.locator('.verdict-bad').count() >= 1,
      String(JSON.stringify(first && { status: first.status, body: first.body, json: first.json })).slice(0, 400));
    await answerBox.fill(known.text);
    await pressSubmit(page);
    await page.waitForSelector('.eval-card', { timeout: 30000 }).catch(() => {});
    const grades = await online.practiceCalls(new RegExp(`^/v1/practice/${serverQid}/submit$`));
    const marks = (await page.locator('.eval-marks').innerText().catch(() => '')).replace(/\s+/g, ' ').trim();
    await check('the right answer (regenerated at the test\'s desk) is marked correct by the server, full marks on the card',
      grades.length === 2 && grades[1].json?.authoritative === true && grades[1].json.correct === true && grades[1].json.resolved === true &&
        /^(\d+(?:\.\d)?) \/ \1 marks?\b/.test(marks) && await page.locator('.eval-card[data-outcome="correct"]').count() === 1,
      `marks ${JSON.stringify(marks)}; ${String(JSON.stringify(grades.at(-1)?.json)).slice(0, 240)}`);
    const ledger = online.ledger(serverQid);
    await check('one question issued, one completion on the server, and no device-mark wording anywhere',
      ledger.issued === 1 && ledger.completions === 1 && ledger.thisDone === 1 && !/marked on this device/i.test(await visibleText(page, '.qpage')),
      JSON.stringify(ledger));
    const history = await historyRows(page, base, qid);
    await check('History holds exactly one attempt for that question, marked correct',
      history.all === 1 && history.mine === 1 && history.verdicts.join() === 'Correct', JSON.stringify(history));
  }
};

// ── 2 · Type, offline ────────────────────────────────────────────────────────

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
        grades.at(-1).body?.mode === 'ink' && typeof grades.at(-1).body?.transcriptionReceipt === 'string' && /^(\d+(?:\.\d)?) \/ \1 marks?\b/.test(marks),
      `marks ${JSON.stringify(marks)}; ${String(JSON.stringify(grades.at(-1) && { body: { ...grades.at(-1).body, transcriptionReceipt: typeof grades.at(-1).body?.transcriptionReceipt }, json: grades.at(-1).json })).slice(0, 300)}`);
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

// ── 4 · Exams, signed out ────────────────────────────────────────────────────

export const examSignedOut = {
  id: 'exam-signed-out',
  name: 'Exams · signed out: a paper does not start; sign in in place, then it does',
  online: true,

  async run({ page, base, check, goto, createProfile, online }) {
    await goto('/');
    await createProfile({ name: 'Signed Out Candidate', year: 9 });
    await page.goto(`${base}/exams`, { waitUntil: 'domcontentloaded' });
    const start = page.getByRole('button', { name: 'Start practice paper' });
    await start.waitFor({ timeout: 30000 });
    await page.evaluate(() => { window.__PRI_E2E_SAME_PAGE__ = 'kept'; });
    await start.click();
    const refused = page.locator('[data-exam-start-refused]');
    await refused.waitFor({ state: 'visible', timeout: 20000 }).catch(() => {});
    await check('signed out, Start practice paper is refused in place: "Starting a paper needs a Pri account"',
      await refused.getAttribute('data-exam-start-refused').catch(() => null) === 'sign-in' && await refused.getAttribute('role') === 'alert' &&
        /Starting a paper needs a Pri account/.test(await refused.innerText()) && /has not started/i.test(await refused.innerText()),
      (await refused.innerText().catch(() => 'no refusal shown')).slice(0, 200));
    const exams = await page.evaluate(() => new Promise(done => {
      const open = indexedDB.open('pri-learning');
      open.onsuccess = () => { const db = open.result; const r = db.transaction('exams').objectStore('exams').count(); r.onsuccess = () => { db.close(); done(r.result); }; r.onerror = () => { db.close(); done(-1); }; };
      open.onerror = () => done(-1);
    }));
    await check('no paper was generated and the exam room did not open',
      exams === 0 && new URL(page.url()).pathname === '/exams' && await page.locator('.exam-timer').count() === 0, `${exams} stored paper(s); ${page.url()}`);
    await refused.locator('[data-check-sign-in]').click();
    await online.signInHere(refused, { name: 'Signed Out Candidate' });
    await check('sign-in completes on the Exams page: no navigation, no reload',
      new URL(page.url()).pathname === '/exams' && await page.evaluate(() => window.__PRI_E2E_SAME_PAGE__) === 'kept', page.url());
    await page.getByRole('button', { name: 'Start practice paper' }).click();
    await page.waitForSelector('.exam-timer', { timeout: 60000 }).catch(() => {});
    await check('signed in, the same button starts the paper', await page.locator('.exam-timer').count() === 1 && /\/exams\/[^/]+$/.test(new URL(page.url()).pathname), page.url());
  }
};

export const flows = [typeSignedOut, typeOffline, writeOffline, examSignedOut];

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const { runFlows } = await import('./e2e.mjs');
  console.log(`${SYNTHETIC_EVIDENCE} — in this suite the handwriting reader behind the real server is a scripted stand-in; the server, its SQLite database, the account and every grade are real. No real provider, device or handwriting is evidenced here.`);
  process.exit(await runFlows(flows) ? 1 : 0);
}
