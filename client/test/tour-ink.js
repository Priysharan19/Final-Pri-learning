// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · E2E flow — handwriting, through the real canvas.
//
// This is the assertion the project has been missing. Five suites measure the
// recogniser — 40 trials a symbol, held-out writers, whole lines of working —
// and every one of them calls recognize() directly in Node. None of them mounts
// the canvas. So the entire path between a pen and a mark is untested: pointer
// capture, the 1€ filter, coalesced-event accumulation, the stroke buffer, the
// 240 ms debounce, the reading panel, the confidence gate that can hold a
// submit back, and the answer the card finally posts. A regression anywhere in
// there would leave all five ink suites green and the app unusable.
//
// So this flow writes an answer by hand — real pointer events, one stroke at a
// time, from the same template geometry the recogniser suites are scored on —
// and follows it all the way to a mark. It knows what the answer is the same
// way tour-v3 does: miss twice, read the worked solution, then press the card's
// own "Redo Question" and hand-write the answer it just gave.
//
// Run on its own:  node client/test/tour-ink.js
// ─────────────────────────────────────────────────────────────────────────────
import { pathToFileURL } from 'node:url';
import { TEMPLATES } from '../src/ink/templates.js';
import { readLines, turnOnServerReading, useFakeServerReader } from './fakeServerReader.js';

const TOPIC = 'y7-equations';
const SURELY_WRONG = '-987654';
const MAX_QUESTIONS = 8;

// Glyph geometry, matched to the shape the recogniser suites score against:
// a little taller than wide, with a clear gap between neighbours so the
// segmenter has something to cut on.
const GLYPH_W = 58;
const GLYPH_H = 84;
const ADVANCE = 66;

const SUBMIT = { name: 'Submit Answer' };

/** Write one line of glyphs onto the canvas with the mouse, stroke by stroke. */
async function handwrite(page, box, text, { x = 40, y = 34 } = {}) {
  let ox = box.x + x;
  for (const ch of text) {
    const variant = TEMPLATES[ch]?.[0];
    if (!variant) throw new Error(`no template for ${JSON.stringify(ch)}`);
    for (const stroke of variant) {
      const pts = stroke.map(([px, py]) => [
        ox + (px / 100) * GLYPH_W,
        box.y + y + (py / 100) * GLYPH_H
      ]);
      await page.mouse.move(pts[0][0], pts[0][1]);
      await page.mouse.down();
      for (const [px, py] of pts) await page.mouse.move(px, py);
      await page.mouse.up();
    }
    ox += ADVANCE;
  }
  await page.waitForTimeout(600);   // the recogniser runs 240 ms after the last point
}

/** What the reading panel says it read, line by line. */
const reading = (page) => readLines(page);
const readingArrives = (page) => page.waitForSelector('.ink-line', { timeout: 15000 }).catch(() => {});

export const flow = {
  id: 'ink',
  name: 'Ink · handwriting on the real canvas',

  async run({ page, ctx, base, check, note, goto, createProfile, mathText, settle }) {
    // Handwriting is read only by the server reader (owner decision); this
    // flow brings a stand-in reader and scripts what it "sees".
    const reader = await useFakeServerReader(page, base);
    await goto('/');
    await createProfile({ name: 'Ada Byron', year: 7 });
    await check('server reading can be turned on for this profile', await turnOnServerReading(page, base));

    // ── 1 · miss twice to learn the answer, on a question worth writing ──────
    // Only a short whole number is hand-written here. Every glyph the flow draws
    // has to come from the template set, and an answer of "3/8" or "12.5 cm"
    // would be testing the layout engine's fraction stacking rather than the
    // path from a stroke to a mark.
    await page.goto(`${base}/practice?subtopic=${TOPIC}`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.q-prompt', { timeout: 30000 });

    const typeTab = page.getByRole('button', { name: 'Answer by typing' });
    const answerBox = page.locator('.editor-body input.answer-input');
    let answer = null;
    let asked = 0;
    for (; asked < MAX_QUESTIONS && !answer; asked++) {
      if (await typeTab.count()) await typeTab.click();
      await settle();
      if (await answerBox.count() === 1) {
        await answerBox.fill(SURELY_WRONG);
        await page.getByRole('button', SUBMIT).click();
        await page.waitForSelector('.verdict-bad', { timeout: 20000 });
        await answerBox.fill(SURELY_WRONG + '1');
        await page.getByRole('button', SUBMIT).click();
        await page.waitForSelector('.eval-card', { timeout: 20000 });
        const stated = (await mathText('.final-answer') || '').replace(/^Final answer\s*/i, '').trim();
        const digits = /^(?:[a-z]\s*=\s*)?(-?\d{1,3})$/i.exec(stated);
        if (digits) { answer = digits[1]; break; }
      }
      await page.locator('.ctx-next').click();
      await page.waitForSelector('.q-prompt', { timeout: 30000 });
    }
    if (!await check('a question with a short whole-number answer was found', !!answer,
      `${asked} questions from ${TOPIC} and none had an answer worth hand-writing`)) return;

    const prompt = await mathText('.q-prompt');
    await page.locator('.redo-chip').click();
    await page.waitForSelector('.q-prompt', { timeout: 30000 });
    await settle();
    if (!await check('the same question comes back for the handwritten attempt',
      await mathText('.q-prompt') === prompt,
      `first: ${JSON.stringify(prompt)}\n      again: ${JSON.stringify(await mathText('.q-prompt'))}`)) return;

    // ── 2 · the canvas mounts ────────────────────────────────────────────────
    await page.getByRole('button', { name: 'Answer by handwriting' }).click();
    await page.waitForSelector('.ink-canvas-live', { timeout: 30000 });
    const canvas = page.locator('.ink-canvas-live');
    const box = await canvas.boundingBox();
    await check('the handwriting canvas mounts with a drawable area',
      !!box && box.width > 200 && box.height > 200,
      `canvas box ${JSON.stringify(box)}`);
    await check('an empty canvas is reading nothing',
      await page.locator('.ink-preview').count() === 0,
      'the reading panel was up before a single stroke was drawn');

    // ── 3 · strokes drawn with the pointer go to the reader ─────────────────
    reader.text = '1';
    await handwrite(page, box, '1');
    await readingArrives(page);
    await check('a stroke drawn with the pointer is sent and read back',
      (await reading(page)).length === 1 && reader.requests.length >= 1,
      `${reader.requests.length} requests; read ${JSON.stringify(await reading(page))}`);
    const sent = reader.requests.at(-1);
    await check('the request is the picture of the ink and nothing else — answer-blind',
      !!sent && JSON.stringify(Object.keys(sent)) === '["image"]' && /^data:image\//.test(sent.image),
      `request keys ${JSON.stringify(sent && Object.keys(sent))}`);

    await check('the footer says the server read it',
      /Read by Pri’s server reader/.test(await page.locator('.editor-foot').innerText().catch(() => '')));

    await page.locator('.ink-tool[title="Clear"]').click();
    await settle();
    await check('Clear empties the canvas', await page.locator('.ink-preview').count() === 0,
      `${await page.locator('.ink-line').count()} lines survived a Clear`);

    // ── 3b · offline: no reading, the ink is kept, and it is read on reconnect
    reader.text = answer;
    await ctx.setOffline(true);
    await handwrite(page, box, answer);
    await page.waitForSelector('.ink-status', { timeout: 10000 }).catch(() => {});
    const offlineNote = (await page.locator('.ink-status').innerText().catch(() => '')) || '';
    await check('offline, nothing is read or offered for marking, and the student is told why',
      await page.locator('.ink-preview').count() === 0 && /needs a connection/.test(offlineNote),
      `status ${JSON.stringify(offlineNote)}; ${await page.locator('.ink-line').count()} lines shown`);
    // The connection flaps before it settles: every return re-reads the kept
    // page, but the answer must be submitted for marking exactly once.
    const attemptCount = () => page.evaluate(() => new Promise(ok => {
      const r = indexedDB.open('pri-learning');
      r.onsuccess = () => { const db = r.result; const c = db.transaction('attempts').objectStore('attempts').count();
        c.onsuccess = () => { db.close(); ok(c.result); }; c.onerror = () => { db.close(); ok(-1); }; };
      r.onerror = () => ok(-1);
    }));
    const attemptsBefore = await attemptCount();
    for (let flap = 0; flap < 4; flap++) {
      await ctx.setOffline(false);
      await page.evaluate(() => window.dispatchEvent(new Event('online')));
      await page.waitForTimeout(40 + flap * 30);
      await ctx.setOffline(true);
      await page.evaluate(() => window.dispatchEvent(new Event('offline')));
      await page.waitForTimeout(60);
    }
    await ctx.setOffline(false);
    await page.evaluate(() => window.dispatchEvent(new Event('online')));
    await readingArrives(page);

    // ── 4 · the answer, written by hand, is read back ────────────────────────
    const lines = await reading(page);
    await check('back online, the kept ink is read by itself as one line', lines.length === 1,
      `read ${lines.length} lines: ${JSON.stringify(lines)}`);
    if (!await check(`the server reading ${JSON.stringify(answer)} is what the card will mark`,
      lines[0] === answer, `read ${JSON.stringify(lines[0])}`)) return;
    const notAnswer = reader.requests.every(r => !JSON.stringify(r).includes(`"${answer}"`) || false);
    await check('no request ever carried the expected answer', notAnswer);

    const asMaths = await mathText('.ink-line-math');
    await check('the reading is set as maths, not as loose characters',
      !!asMaths && asMaths.length > 0, `reading panel renders ${JSON.stringify(asMaths)}`);

    // ── 5 · the kept answer is marked by itself once it is read ─────────────
    // The student was told it "will be read and marked when you're back
    // online": no second tap. A doubtful reading would still ask first.
    const confirm = page.getByRole('button', { name: 'That’s what I wrote' });
    await page.waitForSelector('.eval-card', { timeout: 20000 }).catch(async () => {
      if (await confirm.count()) {
        note('the reading was doubtful enough to ask first, so the flow confirmed it — the designed path');
        await confirm.click();
        await page.waitForSelector('.eval-card', { timeout: 20000 });
      }
    });
    await check('back online, the kept handwriting is marked without another tap', await page.locator('.eval-card').count() === 1);
    await page.waitForTimeout(2500);   // anything still queued would land now
    const attemptsAfter = await attemptCount();
    await check('a flapping connection marks the kept answer exactly once',
      attemptsBefore >= 0 && attemptsAfter - attemptsBefore === 1, `attempts ${attemptsBefore} → ${attemptsAfter}`);
    const marked = (await page.locator('.eval-card').innerText()).replace(/\s+/g, ' ');
    const marks = (await page.locator('.eval-marks').innerText()).replace(/\s+/g, ' ').trim();
    await check('the handwritten answer is marked correct — every mark awarded',
      /^(\d+(?:\.\d)?) \/ \1 marks \(100%\)/.test(marks), `marks read ${JSON.stringify(marks)}`);
    await check('and it is not told what was expected instead',
      !/Expected:/.test(marked), `evaluation reads ${JSON.stringify(marked.slice(0, 200))}`);
    await check('the read line is ticked in the reading panel',
      await page.locator('.ink-line-verdict.good').count() >= 1,
      'the marker drew no ✓ beside the student’s reading');
    await check('and on the ink itself — the server line is placed on the written line',
      await page.locator('.ink-verdict.good').count() >= 1,
      'no ✓ drawn on the student’s own writing');

    // ── 6 · the writing was kept with the attempt ────────────────────────────
    await page.goto(`${base}/history`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.hist-row', { timeout: 30000 });
    await page.locator('.hist-main').first().click();
    await page.waitForSelector('.hist-detail', { timeout: 20000 });
    const detail = (await page.locator('.hist-detail').innerText()).replace(/\s+/g, ' ');
    await check('the strokes themselves were kept with the attempt',
      detail.includes('Your handwriting'),
      `detail reads ${JSON.stringify(detail.slice(0, 200))}`);
    await check('and the reading was kept beside them',
      detail.includes(`read as \u201c${answer}\u201d`),
      `detail reads ${JSON.stringify(detail.slice(0, 200))}`);
  }
};

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const { runOne } = await import('./e2e.mjs');
  process.exit(await runOne(flow) ? 1 : 0);
}
