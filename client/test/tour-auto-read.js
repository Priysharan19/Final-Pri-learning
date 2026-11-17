// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · handwriting is read on its own after a pause.
//
// OWNER DECISION, 18 November 2026 (supersedes read-on-request, #440/#942):
// "make it automatically read handwriting in the background, dont need to press
// read." This flow pins what that means and what it must never mean:
//
//   · not before the student has said yes to the reader (no prompt of its own);
//   · not while the pen is writing: only after it has rested (~1.3 s);
//   · a read still out for an older page is cancelled when the page changes;
//   · the same answer-blind picture-only request as a press of Read my answer;
//   · nothing is ever marked by a read: the confirmation panel waits for the
//     student, and Confirm and mark is the only way a mark is asked for.
//
// EVIDENCE CLASS. A real browser and the real platform server; the reader's
// provider hop is a scripted stand-in that never looks at the picture.
//
// Run on its own:  node client/test/tour-auto-read.js
// ─────────────────────────────────────────────────────────────────────────────
import { pathToFileURL } from 'node:url';
import { handwrite, pressRead, readLines, turnOnServerReading } from './fakeServerReader.js';
import { SYNTHETIC_EVIDENCE } from './support/online-session.mjs';

const TOPIC = 'c7-finding-unknown-current';
const onlyPictureAndQuestionId = body => !!body && Object.keys(body).every(k => ['image', 'mode', 'questionId'].includes(k));

export const flow = {
  id: 'auto-read',
  name: 'Ink · read automatically after a pause (owner decision, 18 Nov 2026)',
  online: true,

  async run({ page, base, check, note, goto, createProfile, settle, online }) {
    const reader = online.reader;
    Object.assign(reader, { text: '1', confidence: 0.97, down: false, gate: null });
    reader.requests.length = 0;
    note(`${SYNTHETIC_EVIDENCE}: the reader behind the real server is a scripted stand-in (it returns the text this flow sets and never looks at the picture).`);
    await goto('/');
    await createProfile({ name: 'Ada Byron', year: 7 });
    await online.signIn({ name: 'Ada Byron' });
    await check('server reading is on for this signed-in profile', await turnOnServerReading(page, base));

    await page.goto(`${base}/practice?subtopic=${TOPIC}`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.q-prompt', { timeout: 30000 });
    const typeTab = page.getByRole('button', { name: 'Answer by typing' });
    for (let i = 0; i < 8; i++) {
      if (await typeTab.count()) await typeTab.click();
      await settle();
      if (await page.locator('.editor-body input.answer-input').count() === 1) break;
      const leaving = (await online.shownRow())?.id;
      await page.locator('.ctx-next').click();
      await page.waitForFunction(id => { const el = document.querySelector('.qpage[data-question-id]'); return el && el.getAttribute('data-question-id') !== id && el.querySelector('.q-prompt'); }, leaving, { timeout: 30000 });
    }
    await page.getByRole('button', { name: 'Answer by handwriting' }).click();
    await page.waitForSelector('.ink-canvas-live', { timeout: 30000 });
    const box = await page.locator('.ink-canvas-live').boundingBox();
    const submitCalls = () => online.practiceCalls(/^\/v1\/practice\/[^/]+\/submit$/);
    const pageReads = () => online.practiceCalls(/^\/v1\/practice\/[^/]+\/recogni[sz]e$|^\/v1\/handwriting\/transcribe$/);

    // ── 1 · not before the student has said yes ──────────────────────────────
    await handwrite(page, box, '1');
    await page.waitForTimeout(2200);
    await check('before the student has agreed to the reader, writing and pausing sends nothing and opens no prompt',
      reader.requests.length === 0 && await page.locator('[data-reader-permission]').count() === 0, `${reader.requests.length} provider call(s)`);
    await pressRead(page);    // the prompt is accepted on sight, as a student's press does
    await page.waitForSelector('.ink-line', { timeout: 15000 });
    await check('a press of Read my answer is still the manual way, and it reads', (await readLines(page))[0] === '1');
    const base1 = reader.requests.length;

    // ── 2 · not while writing, after the pause ───────────────────────────────
    reader.text = '17';
    const t0 = Date.now();
    await handwrite(page, box, '7', { x: 150 });
    const quiet = reader.requests.length === base1;
    await check('while the pen is still recently writing nothing is sent, and the earlier reading is marked as of earlier writing',
      quiet && await page.locator('[data-ink-stale]').isVisible(), `${reader.requests.length - base1} call(s) ${Date.now() - t0} ms after the last stroke began`);
    for (let i = 0; i < 40 && (await readLines(page))[0] !== '17'; i++) await page.waitForTimeout(150);
    await check('after the pause the page is read on its own, once, and the reading is current', (await readLines(page))[0] === '17' && reader.requests.length === base1 + 1 && await page.locator('[data-ink-stale]').count() === 0,
      `read ${JSON.stringify(await readLines(page))}; +${reader.requests.length - base1} call(s)`);
    await check('the reading appears with the honest state, not a verdict', await page.locator('[data-auto-read-state]').count() === 1);

    // ── 3 · answer-blind, never marked ───────────────────────────────────────
    const sent = (await pageReads()).at(-1);
    await check('the automatic read is the same answer-blind request: the picture and nothing else', !!sent && onlyPictureAndQuestionId(sent.body), JSON.stringify(Object.keys(sent?.body || {})));
    await page.waitForTimeout(1800);
    await check('nothing was marked: no submit request, no verdict, and Confirm and mark is the only way forward',
      (await submitCalls()).length === 0 && await page.locator('.eval-card, .verdict-bad').count() === 0 && await page.getByRole('button', { name: /^Confirm and mark/ }).count() === 1);
    await check('an unchanged page is not read again', reader.requests.length === base1 + 1, `${reader.requests.length - base1} call(s)`);

    // ── 4 · a superseded read is cancelled ───────────────────────────────────
    let release;
    reader.gate = new Promise(res => { release = res; });
    reader.text = '171';
    await handwrite(page, box, '1', { x: 220 });
    for (let i = 0; i < 40 && reader.requests.length < base1 + 2; i++) await page.waitForTimeout(100);
    await check('the read for the new page has started and is being held', reader.requests.length === base1 + 2);
    reader.text = '1717';
    await handwrite(page, box, '7', { x: 290 });          // the page changes while that read is out
    release();
    reader.gate = null;
    for (let i = 0; i < 60 && (await readLines(page))[0] !== '1717'; i++) await page.waitForTimeout(150);
    await check('the older page\'s late answer never shows as current: only the latest page\'s reading lands',
      (await readLines(page))[0] === '1717' && await page.locator('[data-ink-stale]').count() === 0, JSON.stringify(await readLines(page)));
    await check('and still nothing was marked', (await submitCalls()).length === 0 && await page.locator('.eval-card, .verdict-bad').count() === 0);
  }
};

export default flow;
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { runOne } = await import('./e2e.mjs');
  await runOne(flow);
}
