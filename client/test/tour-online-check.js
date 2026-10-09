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
//   4. Opened with no connection — the device shows its own offline draft,
//      which can never be marked (even after reconnecting); the work is kept
//      and the next question, online, is the server's and is marked.
//   5. A prepared question another account took up first — refused here (one
//      account, once), the work kept, the next question the server's.
//   6. Exams, signed out — a paper does not start; sign-in is offered in place.
//
// THE ORACLE never regenerates anything: the server chooses every creditable
// question and discloses no seed. Right answers are read at the test's desk
// from the server's sealed copy of the issued question (online-session.mjs).
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

// ── 1 · Type, signed out ─────────────────────────────────────────────────────

export const typeSignedOut = {
  id: 'type-signed-out',
  name: 'Type · signed out: kept, not checked; signed in on the card, server-marked',
  online: true,

  async run({ page, base, check, goto, createProfile, mathText, settle, online }) {
    await goto('/');
    await createProfile({ name: 'Signed Out Typist', year: 7 });
    const unissued = await openTypedQuestion({ page, base, settle, online, issued: false });
    if (!await check('signed out, Practice serves a question to read and a box to type in', !!unissued)) return;
    const qid = await shownId(page);
    const prompt = await mathText('.q-prompt');
    const answerBox = page.locator('.editor-body input.answer-input');
    // Signed out but online, the question is one the server PREPARED: a public
    // question and a sealed token, no id, no answer — and no seed anywhere.
    const prepares = await online.practiceCalls(/^\/v1\/practice\/prepare$/);
    const mine = prepares.filter(c => c.json?.question?.prompt === (unissued.checkState === 'prepared' ? (c.json?.question?.prompt) : null) && c.status === 200);
    const shownPrepared = prepares.find(c => c.status === 200 && typeof c.json?.prepared === 'string' && c.json?.question && !('id' in c.json.question) && !('answer' in c.json.question));
    await check('the question on screen was prepared by the server: a public question and a sealed token — no id, no answer, no seed sent or returned',
      unissued.kind === 'unissued' && unissued.checkState === 'prepared' && !!shownPrepared && mine.length >= 1 &&
        prepares.every(c => !('seed' in (c.body || {})) && !/"seed"|"answer"|"steps"/.test(JSON.stringify(c.json?.question || {}))),
      `row ${JSON.stringify(unissued)}; ${prepares.length} prepare call(s) ${JSON.stringify(prepares.map(c => ({ status: c.status, body: c.body, keys: Object.keys(c.json || {}) })))}`.slice(0, 500));

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
      (await online.practiceCalls(MARKING)).length === 0,
      JSON.stringify((await online.practiceCalls(MARKING)).map(c => c.path)));
    await check('the typed answer is still in the box', await answerBox.inputValue() === SURELY_WRONG, JSON.stringify(await answerBox.inputValue()));

    // ── Show solution: refused the same way ──────────────────────────────────
    const reveal = page.locator('.ws-actions-btns .btn').filter({ hasText: /solution/i }).first();
    for (let press = 0; press < 2 && await reveal.count(); press++) { await reveal.click(); await page.waitForTimeout(300); }
    await page.locator('[data-check-refusal]').waitFor({ state: 'visible', timeout: 15000 }).catch(() => {});
    shown = await resultOnCard(page);
    facts = await deviceFacts(page, qid);
    await check('Show solution is refused the same way: sign-in in the card, no solution, nothing revealed or spent',
      shown.refusal.join() === 'sign-in' && nothingMarked(shown) && facts.attempts === 0 && facts.row?.answered === 0 &&
        (await online.practiceCalls(MARKING)).length === 0,
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
    await check('signing in alone marks nothing', (await online.practiceCalls(MARKING)).length === 0 && nothingMarked(await resultOnCard(page)),
      JSON.stringify(await resultOnCard(page)));

    // ── server-marked: the kept wrong answer, then the right one ─────────────
    await pressSubmit(page);
    await page.waitForSelector('.verdict-bad, .eval-card', { timeout: 30000 }).catch(() => {});
    const issues = await online.practiceCalls(/^\/v1\/practice\/issue$/);
    const serverQid = issues[0]?.json?.question?.id || null;
    const first = (await online.practiceCalls(new RegExp(`^/v1/practice/${serverQid}/submit$`))).at(-1);
    await check('at submit the SAME row was bound to this account: one issue carrying only the prepared token — no generator, seed or answer — same id, same prompt',
      issues.length === 1 && issues[0].status === 201 && !!serverQid && await shownId(page) === qid && await mathText('.q-prompt') === prompt &&
        JSON.stringify(Object.keys(issues[0].body || {})) === '["prepared"]' && typeof issues[0].body.prepared === 'string' &&
        prepares.some(c => c.json?.prepared === issues[0].body.prepared) && issues[0].json?.question?.prompt === prepares.find(c => c.json?.prepared === issues[0].body.prepared)?.json?.question?.prompt,
      JSON.stringify(issues.map(c => ({ status: c.status, keys: Object.keys(c.body || {}) }))));
    await check('the kept wrong answer is marked by the server: authoritative, wrong, one try left',
      first?.status === 200 && first.json?.authoritative === true && first.json.correct === false && first.json.resolved === false &&
        first.json.triesLeft === 1 && first.body?.answer === SURELY_WRONG && first.body?.mode === 'typed' && await page.locator('.verdict-bad').count() >= 1,
      String(JSON.stringify(first && { status: first.status, body: first.body, json: first.json })).slice(0, 400));
    // Only now does anyone know the answer: the server issued the question,
    // and the test's desk reads its sealed copy from the server's database.
    const known = await online.answerOf();
    if (!await check('the oracle reads the right answer from the server\'s sealed copy of the issued question, owned by this account',
      known.kind === 'text' && known.text !== null && known.serverQuestionId === serverQid && known.accountId === account.id,
      JSON.stringify({ kind: known.kind, has: known.text !== null, owner: known.accountId === account.id }))) return;
    await answerBox.fill(known.text);
    await pressSubmit(page);
    await page.waitForSelector('.eval-card', { timeout: 30000 }).catch(() => {});
    const grades = await online.practiceCalls(new RegExp(`^/v1/practice/${serverQid}/submit$`));
    const marks = (await page.locator('.eval-marks').innerText().catch(() => '')).replace(/\s+/g, ' ').trim();
    await check('the right answer is marked correct by the server, full marks on the card',
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

// ── 3b · Opened with no connection: an offline draft is never marked ────────

export const draftOffline = {
  id: 'draft-offline',
  name: 'Draft · opened offline: never marked, work kept; a new question online is',
  online: true,

  async run({ page, base, check, goto, createProfile, mathText, settle, online }) {
    await goto('/');
    await createProfile({ name: 'Offline Opener', year: 7 });
    await online.signIn({ name: 'Offline Opener' });
    const before = online.ledger();
    // No server reachable when the question is OPENED. The deployment's cloud
    // origin is configured (as a production build's is) rather than discovered
    // by the boot-time health probe, which an unreachable server cannot answer.
    await page.addInitScript(origin => { window.__PRI_CLOUD_ORIGIN__ = origin; }, base);
    await online.disconnect();
    await page.goto(`${base}/practice?subtopic=${TOPIC}`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.qpage[data-question-id] .q-prompt', { timeout: 30000 });
    const typeTab = page.getByRole('button', { name: 'Answer by typing' });
    const answerBox = page.locator('.editor-body input.answer-input');
    for (let skips = 0; skips <= MAX_SKIPS; skips++) {
      if (await typeTab.count()) await typeTab.click();
      await settle();
      if (await answerBox.count() === 1) break;
      await nextQuestion(page, settle);
    }
    const draftRow = await online.shownRow();
    const qid = await shownId(page);
    if (!await check('with no server reachable the device still shows a question to work on — its own offline draft, never the server\'s',
      await answerBox.count() === 1 && draftRow?.checkState === 'draft' && !draftRow.serverQuestionId, JSON.stringify(draftRow))) return;
    await answerBox.fill(SURELY_WRONG);
    await page.waitForFunction(() => /saved on this device/i.test(document.querySelector('.ws-actions .status-line')?.innerText || ''), null, { timeout: 10000 }).catch(() => {});

    // Back online: the draft is still a draft. It can never be marked.
    await online.reconnect();
    await pressSubmit(page);
    await page.waitForSelector('.verdict, [data-check-refusal], .eval-card', { timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(600);
    let shown = await resultOnCard(page);
    const said = await visibleText(page, '.verdict');
    await check('Submit on the draft is refused even after reconnecting: no verdict, marks, XP or solution',
      nothingMarked(shown) && (await online.practiceCalls(MARKING)).length === 0 && online.ledger().issued === before.issued,
      `${JSON.stringify(shown)}; ${JSON.stringify((await online.practiceCalls(MARKING)).map(c => c.path))}`);
    await check('the card says why and what to do — a named refusal with Next question on it, never "already finished" or "another tab"',
      /without a connection/i.test(said) && !/already finished|finished elsewhere|another tab/i.test(said) &&
        await page.locator('[data-check-refusal]').count() === 1 && await page.locator('[data-check-next]').count() === 1,
      `${JSON.stringify(said.slice(0, 260))}; refusal ${JSON.stringify(shown.refusal)}; ${await page.locator('[data-check-next]').count()} Next control(s)`);
    let facts = await deviceFacts(page, qid);
    await check('the work is kept and nothing was spent: answer still in the box and in the draft, no attempt, no try',
      await answerBox.inputValue() === SURELY_WRONG && facts.attempts === 0 && facts.row?.tries === 0 && facts.row?.answered === 0,
      `box ${JSON.stringify(await answerBox.inputValue())}; ${JSON.stringify(facts)}`);
    const reveal = page.locator('.ws-actions-btns .btn').filter({ hasText: /solution/i }).first();
    for (let press = 0; press < 2 && await reveal.count(); press++) { await reveal.click(); await page.waitForTimeout(300); }
    await page.waitForTimeout(600);
    shown = await resultOnCard(page);
    facts = await deviceFacts(page, qid);
    await check('Show solution on the draft is refused the same way: no solution, nothing revealed',
      nothingMarked(shown) && facts.attempts === 0 && facts.row?.answered === 0 && (await online.practiceCalls(MARKING)).length === 0,
      `${JSON.stringify(shown)} ${JSON.stringify(facts)}`);
    await check('there is a way forward on the card: Next question is offered and nothing claims a device mark',
      await page.locator('.ctx-next, [data-check-next]').first().isVisible() && !/marked on this device|checked on this device/i.test(await visibleText(page, '.qpage')));

    // Next question, online: the server's question, which can be marked.
    await nextQuestion(page, settle);
    let known = null;
    for (let skips = 0; skips <= MAX_SKIPS; skips++) {
      if (await typeTab.count()) await typeTab.click();
      await settle();
      if (await answerBox.count() === 1) { known = await online.answerOf(); if (known.kind === 'text' && known.text !== null) break; }
      known = null;
      await nextQuestion(page, settle);
    }
    if (!await check('after reconnecting, Next question gives a question the server issued', !!known && (await online.shownRow())?.checkState === 'issued',
      `${JSON.stringify(await online.shownRow())}; server calls since: ${JSON.stringify(online.calls.slice(-8).map(c => `${c.status} ${c.method} ${c.path} ${c.json?.error?.code || ''}`))}`)) return;
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

  async run({ page, base, check, goto, createProfile, mathText, settle, online }) {
    await goto('/');
    await createProfile({ name: 'Late Binder', year: 7 });
    const unissued = await openTypedQuestion({ page, base, settle, online, issued: false });
    const qid = await shownId(page);
    const prompt = await mathText('.q-prompt');
    const answerBox = page.locator('.editor-body input.answer-input');
    const mine = (await online.practiceCalls(/^\/v1\/practice\/prepare$/)).filter(c => c.status === 200 && typeof c.json?.prepared === 'string').at(-1);
    if (!await check('signed out, the question on screen is a prepared one', unissued?.checkState === 'prepared' && !!mine, JSON.stringify(unissued))) return;
    await answerBox.fill(SURELY_WRONG);
    await page.waitForFunction(() => /saved on this device/i.test(document.querySelector('.ws-actions .status-line')?.innerText || ''), null, { timeout: 10000 }).catch(() => {});
    // One account, once: another account binds the same token first.
    const elsewhere = await online.platform.bindPreparedElsewhere(mine.json.prepared);
    await check('another account took the prepared question up first (the server bound it there)', elsewhere.status === 201 && !!elsewhere.questionId, JSON.stringify(elsewhere));
    await page.locator('[data-check-needs-account] [data-check-sign-in]').click();
    const account = await online.signInHere(page.locator('.qpage'), { name: 'Late Binder' });
    await pressSubmit(page);
    await page.waitForSelector('.verdict, .eval-card', { timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(600);
    const shown = await resultOnCard(page);
    const said = await visibleText(page, '.verdict');
    const issues = await online.practiceCalls(/^\/v1\/practice\/issue$/);
    await check('the server refuses to bind it to a second account (409), and nothing is marked here: no verdict, marks, XP or solution',
      issues.length === 1 && issues[0].status === 409 && JSON.stringify(Object.keys(issues[0].body || {})) === '["prepared"]' && nothingMarked(shown) &&
        (await online.practiceCalls(/^\/v1\/practice\/[^/]+\/submit$/)).length === 0 && online.platform.ledger(account.id).issued === 0,
      `${JSON.stringify(issues.map(c => `${c.status} ${c.json?.error?.code}`))} ${JSON.stringify(shown)}`);
    await check('the card says so as a named refusal with Next question on it, never "already finished" or "another tab"',
      said.length > 20 && !/already finished|finished elsewhere|another tab/i.test(said) &&
        await page.locator('[data-check-refusal]').count() === 1 && await page.locator('[data-check-next]').count() === 1,
      `${JSON.stringify(said.slice(0, 260))}; refusal ${JSON.stringify(shown.refusal)}`);
    const facts = await deviceFacts(page, qid);
    await check('the work is kept and nothing was spent: same question, answer still in the box, no attempt, no try',
      await shownId(page) === qid && await mathText('.q-prompt') === prompt && await answerBox.inputValue() === SURELY_WRONG &&
        facts.attempts === 0 && facts.row?.tries === 0 && facts.row?.answered === 0, `${JSON.stringify(facts)}`);
    await nextQuestion(page, settle);
    const typeTab = page.getByRole('button', { name: 'Answer by typing' });
    let known = null;
    for (let skips = 0; skips <= MAX_SKIPS; skips++) {
      if (await typeTab.count()) await typeTab.click();
      await settle();
      if (await answerBox.count() === 1) { known = await online.answerOf(); if (known.kind === 'text' && known.text !== null) break; }
      known = null;
      await nextQuestion(page, settle);
    }
    if (!await check('Next question gives a question the server issued to this account', !!known && known.accountId === account.id, JSON.stringify(await online.shownRow()))) return;
    await answerBox.fill(known.text);
    await pressSubmit(page);
    await page.waitForSelector('.eval-card', { timeout: 30000 }).catch(() => {});
    const grade = (await online.practiceCalls(new RegExp(`^/v1/practice/${known.serverQuestionId}/submit$`))).at(-1);
    await check('and that one is marked by the server', grade?.status === 200 && grade.json?.authoritative === true && grade.json.correct === true,
      String(JSON.stringify(grade?.json)).slice(0, 240));
  }
};

// ── 3d · One answer is one attempt row, even when a sync overlaps it ────────

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
    for (; rounds < 4; rounds++) {
      const known = await openTypedQuestion({ page, base, settle, online });
      if (!known) break;
      await page.locator('.editor-body input.answer-input').fill(known.text);
      // The connection flaps around the submit: every return starts a sync pull.
      const flap = (async () => { for (let i = 0; i < 12; i++) {
        await ctx.setOffline(true); await page.evaluate(() => window.dispatchEvent(new Event('offline')));
        await ctx.setOffline(false); await page.evaluate(() => window.dispatchEvent(new Event('online')));
        await page.waitForTimeout(25);
      } })();
      await submitButton(page).click().catch(() => {});
      await flap;
      await page.waitForSelector('.eval-card, .verdict', { timeout: 20000 }).catch(() => {});
      const retry = page.locator('[data-check-retry]');
      if (await retry.count()) { await retry.click(); await page.waitForSelector('.eval-card, .verdict-bad', { timeout: 20000 }).catch(() => {}); }
      await page.waitForTimeout(2500);   // a late pull would land now
      rows = await rowsNow() || [];
    }
    const perServerAttempt = new Map();
    for (const a of rows) perServerAttempt.set(a.server, (perServerAttempt.get(a.server) || 0) + 1);
    const ledger = online.ledger();
    await check('four answers were submitted under a flapping connection, each marked by the server', rounds === 4 && ledger.completions === 4, `${rounds} rounds; ${JSON.stringify(ledger)}`);
    await check('no server attempt appears as two attempt rows on the device: one row per answer',
      rows.length === 4 && [...perServerAttempt.values()].every(n => n === 1) && !perServerAttempt.has(null), JSON.stringify(rows));
  }
};

// ── 3e · Rapid Fire and Match: signed out no clock starts; answers are the server's ─

export const games = {
  id: 'games',
  name: 'Rapid Fire and Match · signed out nothing starts; signed in every answer is server-marked',
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
    const refusedIn = async () => {
      const block = page.locator('[data-game-refused]');
      await block.waitFor({ state: 'visible', timeout: 20000 }).catch(() => {});
      return block;
    };

    // ── Match, signed out ────────────────────────────────────────────────────
    await page.goto(`${base}/match`, { waitUntil: 'domcontentloaded' });
    await page.locator('.btn-glow').waitFor({ timeout: 30000 });
    await page.locator('.btn-glow').click();
    let block = await refusedIn();
    await check('signed out, Match does not start: the lobby says why, as an alert, with the sign-in in place',
      await block.getAttribute('data-game-refused').catch(() => null) === 'sign-in' && await block.getAttribute('role') === 'alert' &&
        await block.locator('[data-check-sign-in]').isEnabled() && await page.locator('.q-prompt').count() === 0,
      (await block.innerText().catch(() => 'no refusal shown')).replace(/\s+/g, ' ').slice(0, 200));

    // ── Rapid Fire, signed out ───────────────────────────────────────────────
    await page.goto(`${base}/rush`, { waitUntil: 'domcontentloaded' });
    const startRush = page.locator('.qcard .btn-primary.btn-lg');
    await startRush.waitFor({ timeout: 30000 });
    await page.evaluate(() => { window.__PRI_E2E_SAME_PAGE__ = 'kept'; });
    await startRush.click();
    block = await refusedIn();
    await check('signed out, Rapid Fire does not start: no clock, no question, the sign-in in place',
      await block.getAttribute('data-game-refused').catch(() => null) === 'sign-in' && await page.locator('.rush-timer').count() === 0 &&
        await page.locator('.q-prompt').count() === 0 && await block.locator('[data-check-sign-in]').isEnabled(),
      (await block.innerText().catch(() => 'no refusal shown')).replace(/\s+/g, ' ').slice(0, 200));
    await check('signed out, nothing was marked or written by either game: no attempt row, no question issued',
      (await attemptRows())?.length === 0 && (await online.practiceCalls(MARKING)).filter(c => c.status < 300).length === 0,
      JSON.stringify(await attemptRows()));

    // ── sign in, in the lobby ────────────────────────────────────────────────
    await block.locator('[data-check-sign-in]').click();
    const account = await online.signInHere(block, { name: 'Game Player' });
    await check('sign-in completes in the Rapid Fire lobby: no navigation, no reload',
      new URL(page.url()).pathname === '/rush' && await page.evaluate(() => window.__PRI_E2E_SAME_PAGE__) === 'kept', page.url());

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

export const flows = [typeSignedOut, typeOffline, writeOffline, draftOffline, preparedTaken, syncOverlap, games, examSignedOut];

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const { runFlows } = await import('./e2e.mjs');
  console.log(`${SYNTHETIC_EVIDENCE} — in this suite the handwriting reader behind the real server is a scripted stand-in; the server, its SQLite database, the account and every grade are real. No real provider, device or handwriting is evidenced here.`);
  process.exit(await runFlows(flows) ? 1 : 0);
}
