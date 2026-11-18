// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · handwriting is read on its own after a pause.
//
// OWNER DECISION, 18 November 2026 (supersedes read-on-request, #440/#942):
// "make it automatically read handwriting in the background, dont need to press
// read." This flow pins what that means and what it must never mean:
//
//   · nothing leaves the device before the student has said yes to the reader.
//     A pause opens the one-time prompt itself, once (a new account could
//     otherwise never be read automatically; the only way in was a button);
//     accepting it is what lets the read go ahead, with no press of Read;
//   · with automatic reading on there is no primary Read button and no
//     "read once, when you ask" hint, for a mouse, a finger or a pen; with the
//     device preference off the button is back and nothing is read until pressed;
//   · not while the pen is writing: only after it has rested (~1.3 s);
//   · a read still out for an older page is cancelled when the page changes;
//   · the same answer-blind picture-only request as a press of Read my answer;
//   · nothing is ever marked by a read: the confirmation panel waits for the
//     student, and Mark my working is the only way a mark is asked for.
//
// EVIDENCE CLASS. A real browser and the real platform server; the reader's
// provider hop is a scripted stand-in that never looks at the picture.
//
// Run on its own:  node client/test/tour-auto-read.js
// ─────────────────────────────────────────────────────────────────────────────
import { pathToFileURL } from 'node:url';
import { handwrite, markWorking, readingIsNotShown, turnOnServerReading } from './fakeServerReader.js';
import { SYNTHETIC_EVIDENCE } from './support/online-session.mjs';

const AUTO_WAIT = 2600;
const TOPIC = 'c7-finding-unknown-current';
const onlyPictureAndQuestionId = body => !!body && Object.keys(body).every(k => ['image', 'mode', 'questionId'].includes(k));

export const flow = {
  id: 'auto-read',
  name: 'Ink · read automatically after a pause (owner decision, 18 Nov 2026)',
  online: true,
  readerPermission: 'ask',

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

    // ── 1 · nothing before yes; the pause asks once; no Read button ──────────
    const shot = async name => { if (process.env.PRI_AUTOREAD_SHOTS) { await page.locator('.ws-actions').scrollIntoViewIfNeeded().catch(() => {}); await page.screenshot({ path: `${process.env.PRI_AUTOREAD_SHOTS}/${name}.png` }); } };
    const primaryRead = () => page.locator('[data-ink-read]:not([data-ink-read-quiet])').count();
    await shot('0-before-ink');
    await handwrite(page, box, '1');
    await page.waitForSelector('[data-reader-permission="accept"]', { timeout: 6000 });
    await shot('1-consent-after-pause');
    await check('before the student has agreed to the reader, the pause opens the one-time prompt and sends nothing',
      reader.requests.length === 0, `${reader.requests.length} provider call(s)`);
    await check('with automatic reading on there is no primary Read my answer button and no read-once hint',
      await primaryRead() === 0 && !(await page.locator('.ink-read-hint').count()));
    await page.locator('[data-reader-permission="accept"]').click();
    // Owner decision, 19 Nov 2026: the reading is not shown; one press marks the working on the student's own page. The read
    // still happens on its own after the pause, silently, so these checks count the provider's requests instead of reading a list.
    for (let i = 0; i < 60 && reader.requests.length < 1; i++) await page.waitForTimeout(250);
    await shot('2-read-automatically');
    await check('accepting the prompt lets the page be read with no press of Read, and nothing of the reading is on screen',
      reader.requests.length === 1 && (await readingIsNotShown(page, ['1'].filter(x => x.length > 3))).structure.length === 0 && await page.locator('[data-ink-read]').count() === 0,
      `${reader.requests.length} provider call(s)`);
    await check('the footer says one plain thing and does not order a manual read first',
      !/Read your answer first/.test(await page.locator('.ws-actions').innerText()), (await page.locator('.ws-actions .status-line').innerText().catch(() => '')).replace(/\s+/g, ' '));
    const footerBefore = (await page.locator('.ws-actions').innerText()).replace(/\s+/g, ' ');
    await check('and the reading is not leaked in the footer either: no "Your answer: …" line before the student presses Mark my working',
      !/Your answer/i.test(footerBefore), footerBefore);
    const base1 = reader.requests.length;

    // ── 2 · not while writing, after the pause ───────────────────────────────
    reader.text = '17';
    const t0 = Date.now();
    await handwrite(page, box, '7', { x: 150 });
    const quiet = reader.requests.length === base1;
    await check('while the pen is still recently writing nothing is sent',
      quiet, `${reader.requests.length - base1} call(s) ${Date.now() - t0} ms after the last stroke began`);
    for (let i = 0; i < 60 && reader.requests.length < base1 + 1; i++) await page.waitForTimeout(150);
    await page.waitForTimeout(600);
    await check('after the pause the page is read on its own, once', reader.requests.length === base1 + 1, `+${reader.requests.length - base1} call(s)`);

    // ── 3 · answer-blind, never marked ───────────────────────────────────────
    const sent = (await pageReads()).at(-1);
    await check('the automatic read is the same answer-blind request: the picture and nothing else', !!sent && onlyPictureAndQuestionId(sent.body), JSON.stringify(Object.keys(sent?.body || {})));
    await page.waitForTimeout(1800);
    await check('nothing was marked: no submit request, no verdict, and Mark my working is the only way forward',
      (await submitCalls()).length === 0 && await page.locator('.eval-card, .verdict-bad, [data-marked-page]').count() === 0 && await page.getByRole('button', { name: /^Mark my working/ }).count() === 1);
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
    for (let i = 0; i < 60 && reader.requests.length < base1 + 3; i++) await page.waitForTimeout(150);
    await page.waitForTimeout(600);
    await check('the page that changed is read again, once: the older read is superseded, not shown',
      reader.requests.length === base1 + 3, `+${reader.requests.length - base1} call(s)`);
    await check('and still nothing was marked', (await submitCalls()).length === 0 && await page.locator('.eval-card, .verdict-bad, [data-marked-page]').count() === 0);

    // ── 4b · the owner's live page: the doubtful line is named on the MARKED page, not before ─
    // Owner decision, 19 Nov 2026: the reading is not shown, so the pre-mark confirm panel ("Line 1: check (n+)") is gone;
    // the line-by-line "not checked" / "See how Pri read this line" behaviour is pinned in tour-no-preview.js.

    // ── 5 · mouse, finger and pen all rest and are read ─────────────────────
    for (const type of ['touch', 'pen']) {
      await page.locator('button[aria-label]').filter({ hasText: /^$/ }).first().isVisible().catch(() => false);
      const before = reader.requests.length;
      reader.text = `${type}-ok`; reader.gate = null;
      await page.locator('[data-ink-read-quiet], .ink-tool[title]').first().isVisible().catch(() => false);
      await page.evaluate(([x, y, kind, id]) => {
        const c = document.querySelector('.ink-canvas-live');
        const ev = (t, px, py) => c.dispatchEvent(new PointerEvent(t, { bubbles: true, cancelable: true, pointerId: id, pointerType: kind, isPrimary: true, clientX: px, clientY: py, pressure: 0.5, buttons: t === 'pointerup' ? 0 : 1 }));
        ev('pointerdown', x, y);
        for (let i = 1; i <= 12; i++) ev('pointermove', x + i * 4, y + 70 - (i % 2) * 20);
        ev('pointerup', x + 50, y + 70);
      }, [box.x + (type === 'touch' ? 400 : 480), box.y + 40, type, type === 'touch' ? 31 : 32]);
      const t1 = Date.now();
      for (let i = 0; i < 40 && reader.requests.length === before; i++) await page.waitForTimeout(100);
      await check(`a ${type} pointer's page is read on its own after the pen rests, within the idle window`, reader.requests.length === before + 1 && Date.now() - t1 < 4000, `${reader.requests.length - before} call(s) after ${Date.now() - t1} ms`);
      await check(`and still no primary Read button (${type})`, await primaryRead() === 0);
    }

    // ── 6 · device preference off: the button is back, nothing is read alone ──
    await page.evaluate(() => localStorage.setItem('pri.autoRead', 'off'));
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.ink-canvas-live', { timeout: 30000 }).catch(async () => {
      await page.getByRole('button', { name: 'Answer by handwriting' }).click();
      await page.waitForSelector('.ink-canvas-live', { timeout: 30000 });
    });
    await page.locator('.ink-tool[aria-label*="lear"]').first().click().catch(() => {});
    const box2 = await page.locator('.ink-canvas-live').boundingBox();
    const before2 = reader.requests.length;
    reader.text = '9';
    await handwrite(page, box2, '9');
    await page.waitForTimeout(AUTO_WAIT);
    await shot('3-preference-off-button');
    await check('with the device preference off nothing is read until the student marks, and there is still no Read button',
      await primaryRead() === 0 && reader.requests.length === before2, `${reader.requests.length - before2} call(s)`);
    // One press of Mark my working reads the page (silently) and marks it: the only way a read is asked for.
    await markWorking(page);
    for (let i = 0; i < 60 && (await submitCalls()).length === 0; i++) await page.waitForTimeout(250);
    await check('one press of Mark my working reads the page once and marks it on the server',
      reader.requests.length === before2 + 1 && (await submitCalls()).length === 1, `${reader.requests.length - before2} read(s), ${(await submitCalls()).length} submit(s)`);
    await page.evaluate(() => localStorage.removeItem('pri.autoRead'));
  }
};

export default flow;
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { runOne } = await import('./e2e.mjs');
  await runOne(flow);
}
