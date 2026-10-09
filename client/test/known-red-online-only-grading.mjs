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

// STILL DEVICE-MARKED · India exam simulations. client/src/api.js routes
// /exams to local/indiaExamBackend.js for course 'in', which never reaches
// backend.js entitlementGate('POST /exams'): signed out, with no account, a
// JEE Main / CBSE paper starts, is sat and is marked on the device.
// (Everything else that used to be here — criteria table, History detail,
// Redo, the mislabelled 409 refusals, the sync double-attempt, Rapid Fire and
// Match on the device — is fixed and asserted in the CI flows.)
const indiaExam = {
  id: 'india-exam', name: 'KNOWN RED · signed out: an India exam simulation does not start', online: true,
  async run({ page, base, check, goto, createProfile }) {
    await goto('/'); await createProfile({ name: 'Known Red', year: 12, course: 'in', track: 'jee-main' });
    await page.goto(`${base}/exams`, { waitUntil: 'domcontentloaded' });
    const start = page.getByRole('button', { name: 'Start JEE Main Mathematics simulation' });
    await start.waitFor({ timeout: 30000 });
    await start.click();
    const started = await page.waitForSelector('.exam-timer', { timeout: 15000 }).then(() => true, () => false);
    await check('signed out, an India exam simulation does not start (sign-in is offered instead)',
      !started && await page.locator('[data-exam-start-refused]').count() === 1, `exam room opened: ${started}; ${page.url()}`);
  }
};

export const flows = [indiaExam];

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const { runFlows } = await import('./e2e.mjs');
  console.log('KNOWN RED — expected to fail; each failure is a reported product defect. Not part of CI.');
  const failed = await runFlows(flows);
  console.log(failed ? '\nKNOWN RED: still red, as recorded.' : '\nKNOWN RED: everything passed — move these assertions into CI flows and delete this file.');
  process.exit(0);
}
