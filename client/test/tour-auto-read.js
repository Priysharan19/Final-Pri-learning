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
import { handwrite, pressRead, readLines, turnOnServerReading } from './fakeServerReader.js';
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
    await page.waitForSelector('.ink-line', { timeout: 15000 });
    await shot('2-read-automatically');
    await check('accepting the prompt lets the page be read with no press of Read, and the reading is on screen', (await readLines(page))[0] === '1');
    await check('the footer says one plain thing and does not order a manual read first',
      !/Read your answer first/.test(await page.locator('.ws-actions').innerText()), (await page.locator('.ws-actions .status-line').innerText()).replace(/\s+/g, ' '));
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
    await check('nothing was marked: no submit request, no verdict, and Mark my working is the only way forward',
      (await submitCalls()).length === 0 && await page.locator('.eval-card, .verdict-bad').count() === 0 && await page.getByRole('button', { name: /^Mark my working/ }).count() === 1);
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

    // ── 4b · the owner's live page: three lines, the middle of line 1 misread ─
    // One state per line, the doubtful span named, one panel, upright functions.
    await page.locator('.ink-tool[aria-label*="lear"]').first().click();
    reader.text = '22 + 5sin((n+)/6)\nmax = 22 + 5\n= 27';
    await handwrite(page, box, '1', { y: 20 });
    await handwrite(page, box, '1', { y: 130 });
    await handwrite(page, box, '1', { y: 240 });
    await page.waitForSelector('[data-confirm-reading]', { timeout: 15000 });
    await shot('4-misread-line-named');
    await check('the reading is listed once: the panel names only the one line to check, not all three again',
      await page.locator('.ink-line').count() === 3 && await page.locator('[data-confirm-line]').count() === 1 && await page.locator('[data-confirm-line="0"]').count() === 1);
    await check('it says which line and which part: "Line 1: check (n+)" as a control that opens the editor',
      /Line 1: check/.test(await page.locator('[data-confirm-shape="0"]').innerText()) && (await page.locator('[data-confirm-span="0"]').innerText()).includes('n'));
    await check('the count says what to do in plain words', (await page.locator('[data-confirm-count]').innerText()).trim() === 'Check line 1, then confirm');
    await check('focus is on the line to check', await page.evaluate(() => !!document.activeElement?.closest?.('[data-confirm-line="0"]')));
    await check('the warning is a normal sentence in the body face: not capitals, not monospace, no dashed box',
      await page.locator('.ws-confirm-unsure').first().evaluate(el => { const c = getComputedStyle(el); return c.textTransform === 'none' && !/mono/i.test(c.fontFamily); })
      && await page.locator('[data-confirm-line="0"]').evaluate(el => getComputedStyle(el).outlineStyle !== 'dashed'));
    await check('line 1 is "check" and lines 2 and 3 are not, wherever the state is shown (the leading = on line 3 is working, not an error)',
      await page.locator('.in-rstate[data-read-state="check"]').count() <= 1 && await page.locator('[data-line-doubt], .ink-line-low').count() <= 1 && await page.locator('.in-read-cf, .in-read-tg:text-is("read")').count() === 0);
    await check('function names are upright operators in the reading', await page.locator('.ink-line .mop').count() >= 1);
    await check('Your answer does not begin with a relation sign',
      !/Your answer:\s*[=≈]/.test((await page.locator('.ws-actions .status-line').innerText()).replace(/\s+/g, ' ')));
    await page.locator('[data-confirm-span="0"]').click();
    await check('tapping the doubtful part opens the symbol editor for that line', await page.locator('.ink-correct input').count() === 1);
    await page.getByRole('button', { name: 'Cancel' }).first().click().catch(() => {});
    await check('and still nothing was marked', (await submitCalls()).length === 0 && await page.locator('.eval-card, .verdict-bad').count() === 0);
    await page.locator('.ink-tool[aria-label*="lear"]').first().click();
    reader.text = '1717';
    await handwrite(page, box, '1', { x: 40 });
    for (let i = 0; i < 40 && (await readLines(page))[0] !== '1717'; i++) await page.waitForTimeout(150);

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
      for (let i = 0; i < 30 && await page.locator('[data-ink-stale]').count(); i++) await page.waitForTimeout(150);
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
    await check('with the device preference off the Read my answer button is present and nothing is read until pressed',
      await primaryRead() >= 1 && reader.requests.length === before2 && await page.locator('.ink-read-hint').count() === 1, `${reader.requests.length - before2} call(s)`);
    await pressRead(page);
    for (let i = 0; i < 40 && reader.requests.length === before2; i++) await page.waitForTimeout(100);
    await check('pressing it reads', reader.requests.length === before2 + 1);
    await page.evaluate(() => localStorage.removeItem('pri.autoRead'));
  }
};

export default flow;
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { runOne } = await import('./e2e.mjs');
  await runOne(flow);
}
