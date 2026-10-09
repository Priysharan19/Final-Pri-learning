// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · KNOWN RED — product defects found while migrating the browser
// suites to online-only, server-authoritative grading (owner decision
// 2026-10-10). NOT wired into CI: every flow here is expected to FAIL until the
// product is fixed, and each failure is one reported PRODUCT BUG. When a flow
// here goes green, move its assertion into the named CI flow and delete it.
//
//   node client/test/known-red-online-only-grading.mjs [--no-build] [--only=id,…]
//
// Real server, real account (support/online-session.mjs). No reader involved.
// ─────────────────────────────────────────────────────────────────────────────
import { pathToFileURL } from 'node:url';

const TOPIC = 'y7-equations';
const WRONG = '-987654';
const shownId = page => page.locator('.qpage').first().getAttribute('data-question-id');
const visibleText = (page, selector) => page.evaluate(sel => [...document.querySelectorAll(sel)]
  .filter(el => el.getClientRects().length > 0).map(el => el.innerText).join(' ').replace(/\s+/g, ' ').trim(), selector);

async function typedQuestion(page, base, settle) {
  await page.goto(`${base}/practice?subtopic=${TOPIC}`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.qpage[data-question-id] .q-prompt', { timeout: 30000 });
  const typeTab = page.getByRole('button', { name: 'Answer by typing' });
  const box = page.locator('.editor-body input.answer-input');
  for (let i = 0; i < 14; i++) {
    if (await typeTab.count()) await typeTab.click();
    await settle();
    if (await box.count() === 1) return box;
    const leaving = await shownId(page);
    await page.locator('.ctx-next').click();
    await page.waitForFunction(id => document.querySelector('.qpage[data-question-id]')?.getAttribute('data-question-id') !== id, leaving, { timeout: 30000 });
  }
  return null;
}
async function missTwice(page, box) {
  for (const value of [WRONG, WRONG + '1']) {
    await box.fill(value);
    await page.locator('.ws-actions .btn-primary').click();
    await page.waitForSelector(value === WRONG ? '.verdict-bad' : '.eval-card', { timeout: 20000 });
  }
}
const attempts = page => page.evaluate(() => new Promise(ok => {
  const r = indexedDB.open('pri-learning');
  r.onsuccess = () => { const db = r.result; const c = db.transaction('attempts').objectStore('attempts').getAll();
    c.onsuccess = () => { db.close(); ok(c.result.map(a => ({ id: String(a.id).slice(37, 60), mode: a.mode, correct: a.correct, remote: typeof a.remoteEventId === 'string', server: a.serverAttemptId || a.remoteEventId || null }))); };
    c.onerror = () => { db.close(); ok(null); }; };
  r.onerror = () => ok(null);
}));

// BUG 1 · client/src/components/QuestionCard.jsx (criteria block gated on
// !serverAuthoritative). Every practice result is now server-authoritative, so
// the marking-criteria table is never shown after a question resolves.
// Was: tour-v3.js "the marking criteria are shown".
const criteria = {
  id: 'criteria', name: 'KNOWN RED · marking criteria after a server-marked question', online: true,
  async run({ page, base, check, goto, createProfile, settle, online }) {
    await goto('/'); await createProfile({ name: 'Known Red One', year: 7 }); await online.signIn({ name: 'Known Red One' });
    const box = await typedQuestion(page, base, settle);
    await missTwice(page, box);
    await check('the marking criteria are shown with the worked solution',
      await page.locator('.criteria-table tbody tr').count() >= 1, `${await page.locator('.criteria-table').count()} criteria tables`);
  }
};

// BUG 2 · client/src/components/checkAccess.js refusedCheckState() sets
// `conflict` for any 409, and QuestionCard.jsx then titles the refusal
// "This question is already finished … finished elsewhere, perhaps in another
// tab" — for QUESTION_NOT_SERVER_ISSUED (and QUESTION_PREPARED_EXPIRED), which
// are 409s that mean nothing of the kind. checkRefusal() has no entry for
// either code. Was: tour-online-check.js "Draft · opened offline".
const draftCopy = {
  id: 'draft-copy', name: 'KNOWN RED · an offline draft\'s refusal is not called "already finished"', online: true,
  async run({ page, base, check, goto, createProfile, settle, online }) {
    await goto('/'); await createProfile({ name: 'Known Red Four', year: 7 }); await online.signIn({ name: 'Known Red Four' });
    await page.addInitScript(origin => { window.__PRI_CLOUD_ORIGIN__ = origin; }, base);
    await online.disconnect();
    const box = await typedQuestion(page, base, settle);
    await box.fill(WRONG);
    await online.reconnect();
    await page.locator('.ws-actions .btn-primary').click();
    await page.waitForSelector('.verdict', { timeout: 20000 }).catch(() => {});
    const said = await visibleText(page, '.verdict');
    await check('the refusal does not claim the question was already finished, or finished in another tab',
      /opened without a connection/i.test(said) && !/already finished|finished elsewhere|another tab/i.test(said), JSON.stringify(said));
    await check('and it is a named refusal with Next question on it', await page.locator('[data-check-refusal]').count() === 1 && await page.locator('[data-check-next]').count() === 1,
      `${await page.locator('[data-check-refusal]').count()} named refusals, ${await page.locator('[data-check-next]').count()} Next controls`);
  }
};

// BUG 3 · client/src/platform/cloudSyncRestore.js applyRemoteLearningEvents():
// `locallyCommitted` is read once, before the loop; a sync pull that overlaps a
// submit imports the server grader's own event as a second attempt row
// (`<pid>:remote:<attemptId>`) beside the device's row for the SAME server
// attempt. One answer, two attempt rows (answered count, accuracy, hints).
// Seen in tour-ink.js under a flapping connection (4 of 5 runs). Intermittent.
const syncRace = {
  id: 'sync-race', name: 'KNOWN RED · one server-marked answer is one attempt row, even when a sync overlaps it', online: true,
  async run({ page, ctx, base, check, goto, createProfile, settle, online }) {
    await goto('/'); await createProfile({ name: 'Known Red Five', year: 7 }); await online.signIn({ name: 'Known Red Five' });
    let worst = [];
    for (let round = 0; round < 6; round++) {
      const box = await typedQuestion(page, base, settle);
      const known = await online.answerOf();
      await box.fill(known.kind === 'text' && known.text !== null ? known.text : WRONG);
      const flap = (async () => { for (let i = 0; i < 12; i++) {
        await ctx.setOffline(true); await page.evaluate(() => window.dispatchEvent(new Event('offline')));
        await ctx.setOffline(false); await page.evaluate(() => window.dispatchEvent(new Event('online')));
        await page.waitForTimeout(25);
      } })();
      await page.locator('.ws-actions .btn-primary').click().catch(() => {});
      await flap;
      await page.waitForSelector('.eval-card, .verdict', { timeout: 20000 }).catch(() => {});
      const retry = page.locator('[data-check-retry]');
      if (await retry.count()) { await retry.click(); await page.waitForSelector('.eval-card, .verdict-bad', { timeout: 20000 }).catch(() => {}); }
      await page.waitForTimeout(2500);
      const rows = await attempts(page) || [];
      const byServer = new Map();
      for (const a of rows) byServer.set(a.server, (byServer.get(a.server) || 0) + 1);
      worst = rows;
      if ([...byServer.values()].some(n => n > 1)) break;
    }
    const counts = new Map();
    for (const a of worst) counts.set(a.server, (counts.get(a.server) || 0) + 1);
    await check('no server attempt appears as two attempt rows on the device', [...counts.values()].every(n => n === 1), JSON.stringify(worst));
  }
};

// STILL DEVICE-MARKED (coordinator: being moved to the server). Each is checked
// here signed out, with the server present, exactly as a student would meet it.
//  · Rush / Match: Rush.jsx:46 and Match.jsx:88 post /rush/answer →
//    backend.js 'POST /rush/answer' runs checkAnswer() on the device, writes an
//    attempt (XP) and returns answerText.
//  · India exam simulations: api.js routes /exams to indiaExamBackend.js for
//    course 'in', which never reaches backend.js entitlementGate('POST /exams').
//  · Placement: backend.js 'POST /placement/:id/answer' runs checkAnswer().
const deviceMarked = {
  id: 'device-marked', name: 'KNOWN RED · signed out: Rapid Fire and an India exam paper are not marked on the device', online: true,
  async run({ page, base, check, goto, createProfile, settle }) {
    await goto('/'); await createProfile({ name: 'Known Red Six', year: 12, course: 'in', track: 'jee-main' });
    await page.goto(`${base}/exams`, { waitUntil: 'domcontentloaded' });
    const start = page.getByRole('button', { name: 'Start JEE Main Mathematics simulation' });
    await start.waitFor({ timeout: 30000 });
    await start.click();
    const started = await page.waitForSelector('.exam-timer', { timeout: 15000 }).then(() => true, () => false);
    await check('signed out, an India exam simulation does not start (sign-in is offered instead)',
      !started && await page.locator('[data-exam-start-refused]').count() === 1, `exam room opened: ${started}; ${page.url()}`);
    await page.goto(`${base}/rush`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.shell main .btn-primary', { timeout: 30000 });
    await page.locator('.shell main .btn-primary').first().click();
    await settle();
    const option = page.locator('.mcq button:visible, .mcq-opt:visible').first();
    const box = page.locator('input.answer-input:visible, input[type="text"]:visible').first();
    await page.waitForTimeout(1200);
    if (await option.count()) await option.click();
    else if (await box.count()) { await box.fill('0'); await box.press('Enter'); }
    await page.waitForTimeout(1500);
    const rows = await attempts(page) || [];
    await check('signed out, a Rapid Fire answer is not marked on the device (no attempt row, no verdict)',
      rows.length === 0, `${rows.length} attempt row(s) written signed out: ${JSON.stringify(rows.slice(0, 2))}`);
  }
};

export const flows = [criteria, draftCopy, syncRace, deviceMarked];

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const { runFlows } = await import('./e2e.mjs');
  console.log('KNOWN RED — expected to fail; each failure is a reported product defect. Not part of CI.');
  const failed = await runFlows(flows);
  console.log(failed ? '\nKNOWN RED: still red, as recorded.' : '\nKNOWN RED: everything passed — move these assertions into CI flows and delete this file.');
  process.exit(0);
}
