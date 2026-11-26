// The marked page, driven in a real browser. WHAT IS REAL: the engine's verdicts on the owner's two live
// cases (2026-11-18: the buoy h(t) = 22 + 5 sin(πt/6), and the stationary points of y = 2x³ + 9x²), the
// MarkedPage component and its styles, both editions' languages, light and dark, desktop and 390 px.
// WHAT IS SYNTHETIC, and labelled so: the page itself (invented strokes for ink; a canvas drawing of ruled
// paper with the reader's per-line boxes for the photo) and the server mark. No real student, photo,
// reader or device. The flow through the real server is covered by tour-photo-answer and tour-ink.
// The page is one photo (the larger column), small markers by each line, and ONE panel for the selected line.
//
//   node client/test/tour-marked-page.mjs [--shots=<dir>]
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const CLIENT = fileURLToPath(new URL('..', import.meta.url));
const shots = (process.argv.find(a => a.startsWith('--shots=')) || '').slice(8);
if (shots) mkdirSync(shots, { recursive: true });
let pass = 0; const failures = [];
const ok = (c, l) => { if (c) pass++; else failures.push(l); };

const server = await createServer({
  root: CLIENT, configFile: fileURLToPath(new URL('../vite.config.js', import.meta.url)), logLevel: 'error',
  server: { host: '127.0.0.1', port: 0, strictPort: false, hmr: false, watch: null, proxy: undefined },
  optimizeDeps: { entries: ['test/support/marked-page-gallery.html'] }
});
await server.listen();
const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
const url = (c, source, edition, theme) => `${origin}/test/support/marked-page-gallery.html?case=${c}&source=${source}&edition=${edition}&theme=${theme}`;

// What the engine said, as the page must show it. `sentence` is the whole header in the Prithagoras (English) edition; `selected` is the
// line the panel opens on (the first cross, else line 1); `word` is that line's state in words.
const EXPECT = {
  buoy: { statuses: ['checked', 'checked', 'checked'], sentence: 'Every line was checked.', mark: '2/2', selected: 1, word: 'Correct', cross: null },
  stationary: { statuses: ['checked', 'checked', 'condition', 'checked', 'checked', 'checked', 'checked', 'first-error'], sentence: 'Correct up to line 7. The first error is on line 8. 6 lines checked and correct. 1 line wrong.', mark: '0/3', selected: 8, word: 'Wrong', cross: 8 },
  mixed: { statuses: ['checked', 'unread', 'checked', 'not-verified', 'checked', 'checked'], sentence: 'The lines Pri could check are correct. The final answer is not. 4 lines checked and correct. 2 lines not checked.', mark: '0/3', selected: 1, word: 'Correct', cross: null },
  crossed: { statuses: ['checked', 'checked', 'condition', 'checked', 'first-error', 'not-verified', 'not-verified', 'not-verified', 'not-verified'], sentence: 'Correct up to line 4. The first error is on line 5. 3 lines checked and correct. 1 line wrong. 4 lines not checked.', mark: '0/3', selected: 5, word: 'Wrong', cross: 5 },
  product: { statuses: ['condition', 'checked', 'checked', 'condition', 'checked', 'checked', 'checked', 'checked', 'first-error'], sentence: 'Correct up to line 8. The first error is on line 9. 6 lines checked and correct. 1 line wrong.', mark: '0/3', selected: 9, word: 'Wrong', cross: 9 },
  wrongfinal: { statuses: ['checked', 'checked', 'condition', 'checked', 'checked', 'checked', 'checked'], sentence: 'The lines Pri could check are correct. The final answer is not. 6 lines checked and correct.', mark: '0/3', selected: 1, word: 'Correct', cross: null }
};
const WORDS = { checked: 'Correct', 'first-error': 'Wrong', condition: 'Context', 'not-verified': 'Not checked', unread: 'Not checked', follows: 'Not checked', incomplete: 'Not checked' };
const browser0 = await chromium.launch();
{
  // The criteria table: absent for every real (unapproved) type; a fixture approval shows it, summing to the server mark.
  const ctx = await browser0.newContext({ viewport: { width: 1280, height: 900 } }); const pg = await ctx.newPage();
  await pg.goto(`${url('buoy', 'ink', 'prithagoras', 'light')}`, { waitUntil: 'networkidle' }); await pg.waitForSelector('[data-marked-page]');
  ok(await pg.locator('[data-mp-criteria]').count() === 0, 'an unapproved type shows no criteria table, empty or greyed');
  // Where the host's score card already shows the figure, the page does not print the marks a second time.
  for (const [c, note] of [['buoy', 0], ['stationary', 1]]) {
    await pg.goto(`${url(c, 'photo', 'prithagoras', 'light')}&score=1`, { waitUntil: 'networkidle' }); await pg.waitForSelector('[data-marked-page]');
    ok(await pg.locator('[data-mp-mark]').count() === 0 && await pg.locator('[data-mp-mark-note]').count() === note && !/\d+ of \d+ marks?/.test(await pg.locator('.mp-head').innerText()), `${c}: with the score card shown the page prints no marks (the final-answer note only where it applies)`);
  }
  await pg.goto(`${url('buoy', 'ink', 'prithagoras', 'light')}&criteria=1`, { waitUntil: 'networkidle' }); await pg.waitForSelector('[data-marked-page]');
  const rows = await pg.locator('[data-mp-criterion]').evaluateAll(es => es.map(e => [e.getAttribute('data-mp-criterion'), e.getAttribute('data-awarded')]));
  ok(JSON.stringify(rows) === JSON.stringify([['max', 'yes'], ['value', 'yes']]), `a fixture-approved type shows its criteria ${JSON.stringify(rows)}`);
  const label = await pg.locator('[data-mp-approval-label]').innerText();
  ok(/approved by the author \(Priysharan Tripathi, tutor\)\. Not an official NESA guideline\./.test(label) && !/examiner-certified/i.test(label), `the label names the author and disclaims NESA: ${label}`);
  ok(/2 of 2 marks/.test(await pg.locator('.mp-table tfoot').innerText()) && await pg.locator('[data-mp-mark]').getAttribute('data-mp-mark') === '2/2', 'the table total equals the server mark');
  if (shots) await pg.screenshot({ path: `${shots}/criteria-fixture-buoy-desktop.png`, fullPage: true });
  await ctx.close();
}
{
  // Selection by click and by keyboard, on the crossed fixture (a11y gate: the real flow cannot reach a working-type question there).
  // The line list is the screen-reader source, in line order; the markers on the page are real buttons with names.
  const ctx = await browser0.newContext({ viewport: { width: 1440, height: 900 } }); const pg = await ctx.newPage();
  await pg.goto(`${url('crossed', 'photo', 'prithagoras', 'light')}&reading=1`, { waitUntil: 'networkidle' }); await pg.waitForSelector('[data-marked-page]');
  const nums = await pg.locator('[data-mp-card]').evaluateAll(es => es.map(e => Number(e.getAttribute('data-mp-card'))));
  ok(nums.length === 9 && nums.every((n, i) => n === i + 1), `the line list holds every line, in line order (${nums})`);
  ok(await pg.locator('[data-mp-card="collapsed"]').count() === 0, 'there is no separate "Not verified" box: the unchecked lines are rows like the rest');
  ok(await pg.locator('[data-mp-see-line]').count() === 0 && await pg.locator('[data-mp-detail] [data-mp-reading="5"]').count() === 1 && /How Pri read this line/.test(await pg.locator('[data-mp-detail]').innerText()), 'on a wrong line "How Pri read this line" is shown and there is no second "See how Pri read this line" link');
  ok(await pg.locator('[data-mp-box="3"] svg').count() === 1 && await pg.locator('[data-mp-pick="3"] svg').count() === 1 && await pg.locator('[data-mp-box="3"] path[d="M7 12h10"]').count() === 1 && await pg.locator('[data-mp-pick="3"] path[d="M7 12h10"]').count() === 1 && await pg.locator('[data-mp-box="1"] path[d="m5 12.5 4.5 4.5L19 7.5"]').count() === 1, 'a Context line has a plain dash, not a tick, in the list and on its marker');
  ok(await pg.locator('[data-marked-page]').getAttribute('data-mp-selected') === '5' && /Line 5/.test(await pg.locator('[data-mp-detail]').innerText()) && /Wrong/.test(await pg.locator('[data-mp-detail]').innerText()), 'the panel opens on the first crossed line, in words');
  ok(await pg.locator('[data-mp-box="5"]').getAttribute('aria-label') === 'Line 5, wrong' && await pg.locator('[data-mp-box="1"]').getAttribute('aria-label') === 'Line 1, correct' && await pg.locator('[data-mp-box="6"]').getAttribute('aria-label') === 'Line 6, not checked' && await pg.locator('[data-mp-box="3"]').getAttribute('aria-label') === 'Line 3, context', 'markers are named buttons: Line 5, wrong');
  ok(await pg.locator('button[data-mp-box]').count() === 9, 'every marker is a real button');
  // click a marker
  await pg.locator('[data-mp-box="2"]').click();
  ok(await pg.locator('[data-marked-page]').getAttribute('data-mp-selected') === '2' && /Line 2/.test(await pg.locator('[data-mp-detail]').innerText()) && /Correct/.test(await pg.locator('[data-mp-detail]').innerText()) && await pg.locator('[data-mp-card="2"] button').getAttribute('aria-current') === 'true', 'clicking a marker selects the line: panel and list follow');
  ok(await pg.locator('[data-mp-box="2"]').getAttribute('aria-pressed') === 'true' && await pg.locator('[data-mp-box="5"]').getAttribute('aria-pressed') === 'false', 'the selected marker says so, not only by colour');
  // click a not-checked marker and an unread one
  await pg.locator('[data-mp-box="7"]').click();
  ok(/Not checked/.test(await pg.locator('[data-mp-detail]').innerText()) && /wasn’t checked/.test(await pg.locator('[data-mp-detail]').innerText()), 'a not-checked line is called Not checked, never right or wrong');
  // (the crossed page has no unread line now: the engine does not judge lines after the first error, so the unread checks run on the mixed fixture, whose line 2 is unread)
  await pg.goto(`${url('mixed', 'photo', 'prithagoras', 'light')}&reading=1`, { waitUntil: 'networkidle' }); await pg.waitForSelector('[data-marked-page]');
  await pg.locator('[data-mp-box="2"]').click();
  ok(/couldn’t read it/.test(await pg.locator('[data-mp-detail]').innerText()) && /Rewrite it, or type it/.test(await pg.locator('[data-mp-detail]').innerText()), 'an unread line says Pri could not read it and what to do');
  ok(await pg.locator('[data-mp-see-line]').count() === 0, 'an unread line has no reading to offer');
  await pg.goto(`${url('crossed', 'photo', 'prithagoras', 'light')}&reading=1`, { waitUntil: 'networkidle' }); await pg.waitForSelector('[data-marked-page]');
  // keyboard on the list: Tab into the list stops once; arrows move
  await pg.locator('[data-mp-box="6"]').click();
  await pg.locator('[data-mp-pick="6"]').focus();
  await pg.keyboard.press('ArrowDown');
  ok(await pg.locator('[data-marked-page]').getAttribute('data-mp-selected') === '7' && await pg.evaluate(() => document.activeElement?.getAttribute('data-mp-pick')) === '7', 'ArrowDown moves to line 7 and focus goes with it');
  await pg.keyboard.press('End');
  ok(await pg.locator('[data-marked-page]').getAttribute('data-mp-selected') === '9' && /Not checked/.test(await pg.locator('[data-mp-detail]').innerText()), 'End goes to the last line');
  await pg.keyboard.press('Home'); await pg.keyboard.press('ArrowUp');
  ok(await pg.locator('[data-marked-page]').getAttribute('data-mp-selected') === '1', 'Home goes to line 1, and ArrowUp stops there');
  ok(await pg.locator('[data-mp-pick]').evaluateAll(bs => bs.filter(b => b.tabIndex === 0).length) === 0, 'the screen-reader list adds no tab stops');
  // keyboard on the markers
  await pg.locator('[data-mp-box="1"]').focus();
  await pg.keyboard.press('ArrowDown'); await pg.keyboard.press('ArrowDown');
  ok(await pg.locator('[data-marked-page]').getAttribute('data-mp-selected') === '3' && await pg.evaluate(() => document.activeElement?.getAttribute('data-mp-box')) === '3', 'arrow keys move between the markers on the photo, carrying focus');
  const ring = await pg.evaluate(() => { const b = document.querySelector('[data-mp-box="3"]'); b.focus(); const s = getComputedStyle(b); return { style: s.outlineStyle, w: s.outlineWidth }; });
  ok(ring.style !== 'none' && parseFloat(ring.w) >= 2, 'a focused marker shows a visible focus ring');
  // "See how Pri read this line" stays a real, on-demand button
  await pg.locator('[data-mp-box="1"]').click();
  const see = pg.locator('[data-mp-see-line]').first();
  await see.focus();
  ok(await see.evaluate(b => b.tagName === 'BUTTON') && await see.getAttribute('aria-expanded') === 'false' && await pg.locator('[data-mp-reading]').count() === 0, 'See how Pri read this line is a real button, collapsed, nothing read out before it is pressed');
  await pg.keyboard.press('Enter');
  ok(await see.getAttribute('aria-expanded') === 'true' && await pg.locator('[data-mp-reading]').count() === 1 && await pg.evaluate(() => document.activeElement?.tagName) === 'BUTTON', 'Enter on it expands the reading in place and focus stays on the button');
  // the panel is announced politely
  ok(await pg.locator('.mp-live').getAttribute('aria-live') === 'polite', 'the panel is a polite live region');
  await ctx.close();
}
{
  // Decluttered: the summary and marks above the photo, everything about the reading in one disclosure beneath it, one stepper, no list of rows.
  const ctx = await browser0.newContext({ viewport: { width: 1440, height: 900 } }); const pg = await ctx.newPage();
  await pg.goto(`${url('crossed', 'photo', 'prithagoras', 'light')}&reading=1`, { waitUntil: 'networkidle' }); await pg.waitForSelector('[data-marked-page]');
  ok(await pg.locator('.mp-head [data-mp-see-page], .mp-head [data-mp-photo-toggle]').count() === 0 && await pg.locator('[data-mp-about] [data-mp-see-page]').count() === 1 && await pg.locator('[data-mp-about] [data-mp-photo-toggle]').count() === 1, 'above the photo: the summary and marks only; the readings, the photo toggle and the note are in "About this reading"');
  ok(await pg.locator('[data-mp-about]').evaluate(d => d.open === false) && /About this reading/.test(await pg.locator('[data-mp-about] summary').innerText()), 'the disclosure is closed to begin with');
  const list = await pg.locator('.mp-comments').evaluate(o => { const r = o.getBoundingClientRect(); return { w: r.width, h: r.height }; });
  ok(list.w <= 2 && list.h <= 2, 'the nine-row status list is not drawn: the markers are the navigation');
  ok(/Line 5 of 9/.test(await pg.locator('[data-mp-step-of]').innerText()) && await pg.locator('[data-mp-step="next"]').isEnabled() && await pg.locator('[data-mp-step="prev"]').isEnabled(), 'a compact stepper says Line 5 of 9, with Next and Previous both on in the middle');
  await pg.locator('[data-mp-step="prev"]').click();
  ok(await pg.locator('[data-marked-page]').getAttribute('data-mp-selected') === '4' && /Line 4 of 9/.test(await pg.locator('[data-mp-step-of]').innerText()), 'Previous moves to line 4');
  const box = await pg.locator('.mp-detail').evaluate(d => { const s = getComputedStyle(d); return { b: s.borderTopWidth, bg: s.backgroundColor }; });
  ok(box.b === '0px' && box.bg === 'rgba(0, 0, 0, 0)', 'the panel is a calm column, not a box');
  const q = await pg.evaluate(() => { const g = id => getComputedStyle(document.querySelector(`[data-mp-box="${id}"]`)); return { tick: g(1).borderTopColor, quiet: g(6).borderTopColor, quietOpacity: g(6).opacity, tickOpacity: g(1).opacity }; });
  ok(q.quiet === 'rgba(0, 0, 0, 0)' && parseFloat(q.quietOpacity) < 1 && q.tick !== 'rgba(0, 0, 0, 0)' && q.tickOpacity === '1', 'a not-checked marker is quieter than a tick');
  await pg.locator('[data-mp-about] summary').click();
  await pg.locator('[data-mp-see-page]').click();
  ok(await pg.locator('[data-mp-all] [data-mp-reading]').count() === 9 && await pg.locator('[data-mp-reading]').count() === 9, 'the whole-page reading lists each line Pri read once');
  await ctx.close();
}
{
  // The product-rule page: a specific comment on every correct line and a detailed annotation on the wrong one (the REAL engine report).
  for (const [w, h] of [[1440, 900], [390, 844]]) {
    const ctx = await browser0.newContext({ viewport: { width: w, height: h } }); const pg = await ctx.newPage();
    await pg.goto(`${url('product', 'photo', 'prithagoras', 'light')}`, { waitUntil: 'networkidle' }); await pg.waitForSelector('[data-marked-page]');
    const parts = await pg.evaluate(() => [...document.querySelectorAll('[data-mp-detail] [data-mp-fact], [data-mp-detail] [data-mp-kept]')].map(e => [e.getAttribute('data-mp-fact') || 'kept', e.innerText.replace(/\s+/g, ' ').trim()]));
    ok(JSON.stringify(parts.map(x => x[0])) === JSON.stringify(['from', 'read', 'whatChanged', 'whyWrong', 'corrected', 'check', 'kept']), `${w}: the wrong line reads in order: the line before, the line as read, what changed, why, corrected, quick check, kept (${parts.map(x => x[0])})`);
    ok(/^From line 8/.test(parts[0][1]) && /How Pri read/.test(parts[1][1]) && /What changed/.test(parts[2][1]) && /Why it is wrong/.test(parts[3][1]) && /Corrected line/.test(parts[4][1]) && /Quick check/.test(parts[5][1]) && /algebra slip/.test(parts[6][1]), `${w}: each part carries its label and the engine's words, maths typeset`);
    const order = await pg.evaluate(() => [...document.querySelectorAll('[data-mp-detail] > *')].map(e => e.getBoundingClientRect().top));
    ok(order.every((t, i, a) => i === 0 || t >= a[i - 1]), `${w}: the parts run top to bottom in that order`);
    const fix = await pg.evaluate(() => ({ fix: parseFloat(getComputedStyle(document.querySelector('[data-mp-corrected]')).fontSize), from: parseFloat(getComputedStyle(document.querySelector('[data-mp-from]')).fontSize), typeset: document.querySelectorAll('[data-mp-corrected] .katex, [data-mp-from] .katex').length }));
    ok(fix.fix > fix.from && fix.typeset >= 2, `${w}: the corrected line is typeset and visually primary over the line it came from`);
    ok(await pg.locator('[data-mp-detail] [data-mp-why-error]').count() === 1 && await pg.locator('[data-mp-box="9"]').getAttribute('aria-label') === 'Line 9, wrong', `${w}: the cross is line 9`);
    await pg.locator('[data-mp-box="8"]').click();
    const d8 = await pg.locator('[data-mp-detail]').innerText();
    ok(/Correct/.test(d8) && /Correct expansion: 2x\s*\(x\s*-\s*1\)/.test(d8.replace(/\s+/g, ' ')) || /Correct expansion/.test(d8), `${w}: a correct line shows the engine's specific comment as its detail`);
    ok(await pg.locator('[data-mp-detail] [data-mp-fact]').count() === 0, `${w}: a correct line has no wrong-line parts`);
    for (const n of [2, 3, 5, 6, 7, 8]) { await pg.locator(`[data-mp-box="${n}"]`).click(); if (!(await pg.locator('[data-mp-detail] [data-mp-why]').count())) { ok(false, `${w}: line ${n} has a specific comment`); break; } }
    ok(true, `${w}: every correct line was walked`);
    await ctx.close();
  }
}
{
  // The engine's optional facts: a first-break index and a corrected line. Shown when present, absent without them.
  const ctx = await browser0.newContext({ viewport: { width: 1280, height: 900 } }); const pg = await ctx.newPage();
  await pg.goto(`${url('stationary', 'photo', 'prithagoras', 'light')}`, { waitUntil: 'networkidle' }); await pg.waitForSelector('[data-marked-page]');
  ok(await pg.locator('[data-mp-corrected]').count() === 0 && await pg.locator('[data-mp-fact="corrected"]').count() === 0, 'with no corrected line from the engine the panel shows none and invents none');
  await pg.goto(`${url('crossed', 'photo', 'prithagoras', 'light')}&facts=1`, { waitUntil: 'networkidle' }); await pg.waitForSelector('[data-marked-page]');
  ok(await pg.locator('[data-mp-corrected] .katex').count() > 0 && /Corrected line/.test(await pg.locator('[data-mp-fact="corrected"]').innerText()), 'a corrected line from the engine is shown typeset on the wrong line');
  await pg.locator('[data-mp-box="1"]').click();
  ok(await pg.locator('[data-mp-corrected]').count() === 0, 'a correct line shows no corrected line');
  await ctx.close();
}
await browser0.close();
const browser = await chromium.launch();
try {
  for (const edition of ['prithagoras', 'priyabhata']) for (const theme of ['light', 'dark']) for (const [size, viewport] of [['desktop', { width: 1280, height: 900 }], ['phone', { width: 390, height: 844 }]]) {
    const context = await browser.newContext({ viewport, deviceScaleFactor: 1, colorScheme: theme });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    {
      // The UI face is the one that loads: the used platform font for the sentence is the bundled Instrument Sans, not a system fallback.
      await page.goto(url('buoy', 'ink', edition, theme), { waitUntil: 'networkidle' }); await page.waitForSelector('[data-marked-page]');
      const cdp = await context.newCDPSession(page);
      await cdp.send('DOM.enable'); await cdp.send('CSS.enable');
      const { root } = await cdp.send('DOM.getDocument');
      const { nodeId } = await cdp.send('DOM.querySelector', { nodeId: root.nodeId, selector: '.mp-sentence' });
      const { fonts } = await cdp.send('CSS.getPlatformFontsForNode', { nodeId });
      ok(fonts.some(f => f.isCustomFont && /Instrument Sans/i.test(f.familyName)) && (edition !== 'prithagoras' || fonts.every(f => f.isCustomFont && /Instrument Sans/i.test(f.familyName))), `${edition}/${theme}/${size}: the Latin UI font used is the bundled Instrument Sans, never a system fallback; Devanagari may fall back (${JSON.stringify(fonts.map(f => [f.familyName, f.isCustomFont]))})`);
    }
    for (const c of Object.keys(EXPECT)) for (const source of ['ink', 'photo']) {
      const where = `${c}/${source}/${edition}/${theme}/${size}`;
      await page.goto(url(c, source, edition, theme), { waitUntil: 'networkidle' });
      await page.waitForSelector('[data-marked-page]', { timeout: 30000 });
      await page.waitForTimeout(150);
      if (source === 'photo') await page.locator('[data-mp-about] summary').click();
      const e = EXPECT[c];
      const got = await page.evaluate(() => {
        const sec = document.querySelector('[data-marked-page]');
        const rect = el => el && el.getBoundingClientRect().toJSON();
        const rows = [...sec.querySelectorAll('[data-mp-card]')].map(li => ({ id: li.getAttribute('data-mp-card'), status: li.getAttribute('data-mp-status'), text: li.innerText, hasIcon: !!li.querySelector('svg'), tab: li.querySelector('button').tabIndex }));
        const markers = [...sec.querySelectorAll('[data-mp-box]')].map(b => ({ n: b.getAttribute('data-mp-box'), status: b.getAttribute('data-mp-status'), tag: b.tagName, label: b.getAttribute('aria-label'), text: b.innerText.trim(), icon: !!b.querySelector('svg'), r: rect(b) }));
        const sheet = rect(sec.querySelector('.mp-sheet'));
        const img = rect(sec.querySelector('.mp-img, .mp-ink'));
        return {
          sentence: sec.querySelector('[data-mp-sentence]')?.innerText.replace(/\s+/g, ' ').trim(), mark: sec.querySelector('[data-mp-mark]')?.getAttribute('data-mp-mark') || null,
          aligned: sec.getAttribute('data-mp-aligned'), selected: Number(sec.getAttribute('data-mp-selected')), rows, markers, sheet, img,
          figure: rect(sec.querySelector('.mp-page')), panel: rect(sec.querySelector('.mp-panel')), body: rect(sec.querySelector('.mp-body')),
          detail: sec.querySelector('[data-mp-detail]')?.innerText || '', detailN: Number(sec.querySelector('[data-mp-detail]')?.getAttribute('data-mp-detail')),
          under: [...sec.querySelectorAll('[data-mp-under]')].map(u => ({ n: u.getAttribute('data-mp-under'), r: rect(u) })),
          overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
          list: !!sec.querySelector('ol[aria-label]'), headings: [...sec.querySelectorAll('h3')].map(h => h.textContent),
          whole: sec.innerText
        };
      });
      // the states shown are the engine's states, one row per line, in words
      ok(JSON.stringify(got.rows.map(x => [x.id, x.status])) === JSON.stringify(e.statuses.map((s, i) => [String(i + 1), s])), `${where}: the line list states ${JSON.stringify(got.rows.map(x => [x.id, x.status]))}`);
      if (edition === 'prithagoras') {
        ok(got.sentence === e.sentence, `${where}: header ${JSON.stringify(got.sentence)} expected ${JSON.stringify(e.sentence)}`);
        ok(got.rows.every((x, i) => x.text.includes(WORDS[e.statuses[i]])), `${where}: every row says its state in a word`);
        ok(!/lines? correct\b|\d+ of \d+ lines/.test(got.sentence), `${where}: no "N of M lines correct" that mixes unchecked with wrong`);
        const counts = [...got.sentence.matchAll(/(\d+) lines? (checked and correct|wrong|not checked)/g)].map(m => [m[2], Number(m[1])]);
        const want = { 'checked and correct': e.statuses.filter(x => x === 'checked').length, wrong: e.statuses.filter(x => x === 'first-error').length, 'not checked': e.statuses.filter(x => !['checked', 'condition', 'first-error'].includes(x)).length };
        ok(JSON.stringify(Object.fromEntries(counts)) === JSON.stringify(Object.fromEntries(Object.entries(want).filter(([, n]) => n > 0 && (e.statuses.length > 3 || true)))) || e.sentence === 'Every line was checked.', `${where}: three separate counts, a zero part left out (${JSON.stringify(counts)})`);
      }
      ok(got.mark === e.mark, `${where}: the mark is the server's ${e.mark}, got ${got.mark}`);
      ok(!/Not verified/.test(got.whole) && got.rows.length === e.statuses.length, `${where}: no "Not verified" box`);
      // the panel opens on the first cross, else line 1, with the state in words
      ok(got.selected === e.selected && got.detailN === e.selected && got.detail.includes(`Line ${e.selected}`) || edition !== 'prithagoras', `${where}: the panel opens on line ${e.selected} (got ${got.detailN})`);
      if (edition === 'prithagoras') ok(got.detail.includes(e.word), `${where}: the panel says ${e.word}`);
      if (e.cross) {
        ok(/\S/.test(got.detail.replace(/Line \d+|Wrong/g, '')) && got.detail.length > 30, `${where}: the wrong line has the engine's comment in the panel`);
        ok(got.under.length === 1 && got.under[0].n === String(e.cross), `${where}: the wrong line, and only it, is underlined on the page`);
      } else ok(got.under.length === 0, `${where}: no cross, no underline`);
      if (c === 'buoy') ok(!got.rows.some(x => x.status === 'first-error') && !got.markers.some(b => b.status === 'first-error'), `${where}: no error shown on the buoy working`);
      // every row and marker is a word and an icon, never colour alone; one tab stop in the list; one named list
      ok(got.rows.every(x => x.hasIcon && x.text.trim().length > 3) && got.rows.every(x => x.tab === -1), `${where}: the screen-reader list has an icon and words on every row and adds no tab stops`);
      ok(got.list && got.headings.length === 1, `${where}: the lines are one named list under one heading`);
      ok(got.overflow <= 0, `${where}: no horizontal scroll (${got.overflow}px)`);
      // markers: one real button per judged line, an icon and the number, named with the state
      ok(got.aligned === 'true' && got.markers.length === e.statuses.length && got.markers.every(b => b.tag === 'BUTTON' && b.icon && b.text === b.n && /^Line \d+, /.test(b.label || '') || edition !== 'prithagoras'), `${where}: every judged line has a marker button with an icon, its number and a name (${got.markers.length}/${e.statuses.length})`);
      const inside = got.markers.every(b => b.r.left >= got.sheet.left - 1 && b.r.right <= got.sheet.right + 1 && b.r.top >= got.sheet.top - 1 && b.r.bottom <= got.sheet.bottom + 1);
      ok(inside, `${where}: every marker lies on the page`);
      ok(got.markers.every((b, i, a) => i === 0 || b.r.top + b.r.height / 2 > a[i - 1].r.top + a[i - 1].r.height / 2), `${where}: markers run top to bottom`);
      ok(got.markers.every(b => b.r.width >= 24 && b.r.height >= 24), `${where}: every marker is at least 24 px square to press`);
      const touching = got.markers.some((b, i, a) => i > 0 && b.r.top < a[i - 1].r.bottom - 0.5);
      ok(!touching, `${where}: no two markers overlap`);
      if (source === 'photo') {
        // The drawing is exact: each marker stands at the left edge and vertical centre of the reader's box on the PICTURE
        // (the rendered image's own rectangle), whatever the page width; its right edge is 4 px left of the box so it never covers the writing.
        const geo = await page.evaluate(() => {
          const img = document.querySelector('.mp-img').getBoundingClientRect();
          const want = JSON.parse(document.querySelector('[data-gallery-boxes]').getAttribute('data-gallery-boxes'));
          return { img: img.toJSON(), want, boxes: [...document.querySelectorAll('[data-mp-box]')].map(b => b.getBoundingClientRect().toJSON()), under: [...document.querySelectorAll('[data-mp-under]')].map(u => u.getBoundingClientRect().toJSON()) };
        });
        const worst = geo.boxes.reduce((m, r, i) => {
          const w = geo.want[i];
          const dx = Math.abs(r.right + 4 - (geo.img.left + w.x * geo.img.width));
          const dy = Math.abs((r.top + r.height / 2) - (geo.img.top + (w.y + w.h / 2) * geo.img.height));
          return Math.max(m, dx, dy);
        }, 0);
        ok(geo.boxes.length === geo.want.length && worst <= 1.5, `${where}: every photo marker stands at the reader's box left edge and centre, within ${worst.toFixed(2)} px`);
        ok(geo.boxes.every((r, i) => r.right <= geo.img.left + geo.want[i].x * geo.img.width), `${where}: no marker sits over the writing`);
        if (geo.under.length) {
          const w = geo.want[e.cross - 1];
          ok(Math.abs(geo.under[0].top - (geo.img.top + (w.y + w.h) * geo.img.height)) <= 2.5 && geo.under[0].height <= 3, `${where}: the underline is a thin line at the foot of the wrong line's box (${geo.under[0].height}px)`);
        }
        ok(await page.locator('[data-mp-approx-note]').count() === 1, `${where}: the page says the markers are approximate`);
        ok(await page.locator('[data-mp-photo-toggle]').count() === 1 && /unchanged|वैसी ही/.test(await page.locator('[data-marked-page] .mp-photo-note').innerText()), `${where}: Show original photo and the note that the original is unchanged are kept`);
      }
      // layout: wide, the photo is the larger column (at least 60%) with the panel beside it; narrow, the photo is full width and the panel opens beneath
      if (size === 'desktop') {
        ok(got.figure.width / got.body.width >= 0.6 && got.panel.left >= got.figure.right - 1 && got.panel.width >= 240, `${where}: the photo takes ${(100 * got.figure.width / got.body.width).toFixed(1)}% of the width, the panel beside it`);
      } else {
        ok(got.figure.width >= got.body.width - 1 && got.panel.top >= got.figure.bottom - 1 && got.panel.width >= got.body.width - 1, `${where}: on a phone the photo is full width and the panel is beneath it`);
      }
      if (source === 'photo' && c === 'crossed' && size === 'desktop') {
        const before = await page.locator('.mp-img').getAttribute('data-mp-photo');
        await page.locator('[data-mp-photo-toggle]').click();
        const after = await page.locator('.mp-img').getAttribute('data-mp-photo');
        ok(before === 'cleaned' && after === 'original', `${where}: the photo is shown cleaned for display with a Show original toggle (${before} -> ${after})`);
        await page.locator('[data-mp-photo-toggle]').click();
      }
      if (c === 'crossed' && source === 'photo' && edition === 'prithagoras') {
        const cross = await page.evaluate(() => ({ lead: !!document.querySelector('[data-mp-detail] [data-mp-why-error]'), typeset: !!document.querySelector('[data-mp-detail] .katex') }));
        ok(cross.lead, `${where}: the wrong line has its one lead sentence`);
        ok(cross.typeset, `${where}: the wrong line's text is typeset mathematics`);
      }
      // the panel never covers the page, and a tall page does not push the cross out of reach
      if (size === 'phone' && c === 'crossed' && source === 'photo') {
        await page.locator('[data-mp-box="3"]').scrollIntoViewIfNeeded();
        await page.locator('[data-mp-box="3"]').click();
        await page.waitForTimeout(250);
        const st = await page.evaluate(() => ({ sel: document.querySelector('[data-marked-page]').getAttribute('data-mp-selected'), top: document.querySelector('[data-mp-detail]').getBoundingClientRect().top, h: innerHeight }));
        ok(st.sel === '3' && st.top < st.h, `${where}: tapping a marker selects the line and brings its panel into view`);
      }
      // the owner's ban list, on what the browser computed
      const banned = await page.evaluate(() => {
        const sec = document.querySelector('[data-marked-page]'); const bad = [];
        for (const el of sec.querySelectorAll('*')) {
          const s = getComputedStyle(el);
          if (/gradient/.test(s.backgroundImage)) bad.push('gradient');
          if (s.backdropFilter && s.backdropFilter !== 'none') bad.push('blur');
          if (el.matches('.mp-detail') && (parseFloat(s.borderTopWidth) > 0 || parseFloat(s.borderLeftWidth) > 0 || s.backgroundColor !== 'rgba(0, 0, 0, 0)')) bad.push('a box round the panel');
          if (/opacity|transform|all/.test(s.transitionProperty) && parseFloat(s.transitionDuration) > 0 && el.matches('.mp-marker, .mp-detail, .mp-pick')) bad.push('animated');
        }
        return [...new Set(bad)].concat(/—/.test(sec.innerText) ? ['em dash'] : []).concat(/\p{Extended_Pictographic}/u.test(sec.innerText) ? ['emoji'] : []);
      });
      ok(banned.length === 0, `${where}: banned styles or copy present: ${banned}`);
      if (shots && ['crossed', 'stationary', 'buoy'].includes(c) && edition === 'prithagoras' && theme === 'light') {
        await page.screenshot({ path: `${shots}/${c}-${source}-${edition}-${theme}-${size}.png`, fullPage: true });
      }
      if (shots && edition === 'priyabhata' && c === 'crossed' && theme === 'light' && source === 'photo') await page.screenshot({ path: `${shots}/${c}-${source}-${edition}-${theme}-${size}.png`, fullPage: true });
    }
    ok(errors.length === 0, `${edition}/${theme}/${size}: page errors ${errors.slice(0, 3)}`);
    await context.close();
  }
} finally { await browser.close(); await server.close(); }

if (failures.length) { console.error(failures.slice(0, 40).map(f => `  · ${f}`).join('\n')); console.error(`MARKED PAGE TOUR: FAIL — ${failures.length} of ${pass + failures.length}`); process.exit(1); }
console.log(`MARKED PAGE TOUR: PASS — ${pass}/${pass} checks — the owner's two cases and a mixed page, ink and photo, both editions, light and dark, desktop and 390 px; the page and the mark are SYNTHETIC, the verdicts are the engine's`);
