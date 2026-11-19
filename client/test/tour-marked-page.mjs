// The marked page, driven in a real browser. WHAT IS REAL: the engine's verdicts on the owner's two live
// cases (2026-11-18: the buoy h(t) = 22 + 5 sin(πt/6), and the stationary points of y = 2x³ + 9x²), the
// MarkedPage component and its styles, both editions' languages, light and dark, desktop and 390 px.
// WHAT IS SYNTHETIC, and labelled so: the page itself (invented strokes for ink; a canvas drawing of ruled
// paper with the reader's per-line boxes for the photo) and the server mark. No real student, photo,
// reader or device. The flow through the real server is covered by tour-photo-answer and tour-ink.
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

// What the engine said, as the page must show it.
const EXPECT = {
  buoy: { statuses: ['checked', 'checked', 'checked'], sentence: /^Every line was checked\.$/, mark: '2/2', collapsed: null, firstError: null },
  stationary: { statuses: ['checked', 'checked', 'condition', 'checked', 'checked', 'checked', 'checked', 'first-error'], sentence: /^6 of 8 lines correct\. First error on line 8\.$/, mark: '0/3', collapsed: null, firstError: 8 },
  mixed: { statuses: ['checked', 'unread', 'checked', 'not-verified', 'checked', 'checked'], sentence: null, mark: '0/3', collapsed: '2,4', firstError: null }
};
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
  // The keyboard walk of the marked page (a11y gate: the real flow cannot reach a working-type question there). Comments list in
  // line order is the screen-reader source; "See how Pri read this line" is a real button, reachable and operable by keyboard.
  const ctx = await browser0.newContext({ viewport: { width: 1280, height: 900 } }); const pg = await ctx.newPage();
  await pg.goto(`${url('stationary', 'ink', 'prithagoras', 'light')}&reading=1`, { waitUntil: 'networkidle' }); await pg.waitForSelector('[data-marked-page]');
  const nums = await pg.locator('[data-mp-card]').evaluateAll(es => es.map(e => e.getAttribute('data-mp-card')).filter(n => n !== 'collapsed').map(Number));
  ok(nums.length === 8 && nums.every((n, i) => i === 0 || n > nums[i - 1]), `the comments list is in line order (${nums})`);
  const see = pg.locator('[data-mp-see-line]').first();
  await see.focus();
  ok(await see.evaluate(b => b.tagName === 'BUTTON') && await see.getAttribute('aria-expanded') === 'false', 'See how Pri read this line is a real button, collapsed');
  await pg.keyboard.press('Enter');
  ok(await see.getAttribute('aria-expanded') === 'true' && await pg.locator('[data-mp-reading]').count() >= 1 && await pg.evaluate(() => document.activeElement?.tagName) === 'BUTTON', 'Enter on it expands the reading in place and focus stays on the button');
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
      await page.waitForTimeout(250);
      const e = EXPECT[c];
      const got = await page.evaluate(() => {
        const sec = document.querySelector('[data-marked-page]');
        const cards = [...sec.querySelectorAll('[data-mp-card]')].map(li => ({ id: li.getAttribute('data-mp-card'), status: li.getAttribute('data-mp-status'), text: li.innerText, tab: li.tabIndex, hasIcon: !!li.querySelector('svg'), top: li.getBoundingClientRect().top, bottom: li.getBoundingClientRect().bottom }));
        const boxes = [...sec.querySelectorAll('[data-mp-box]')].map(b => ({ n: b.getAttribute('data-mp-box'), status: b.getAttribute('data-mp-status'), r: b.getBoundingClientRect().toJSON() }));
        const sheet = sec.querySelector('.mp-sheet').getBoundingClientRect();
        return {
          sentence: sec.querySelector('[data-mp-sentence]')?.innerText.trim(), mark: sec.querySelector('[data-mp-mark]')?.getAttribute('data-mp-mark') || null,
          aligned: sec.getAttribute('data-mp-aligned'), level: sec.getAttribute('data-mp-level'), cards, boxes, sheet: sheet.toJSON(),
          overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
          list: !!sec.querySelector('ol[aria-label]'), headings: [...sec.querySelectorAll('h3')].map(h => h.textContent),
          collapsed: sec.querySelector('[data-mp-card="collapsed"]')?.getAttribute('data-mp-lines') || null
        };
      });
      // the states shown are the engine's states
      const lineCards = got.cards.filter(x => x.id !== 'collapsed');
      const wantLines = e.statuses.map((s, i) => [String(i + 1), s]).filter(([, s]) => s !== 'unread' && s !== 'not-verified');
      ok(JSON.stringify(lineCards.map(x => [x.id, x.status])) === JSON.stringify(wantLines), `${where}: the comment states ${JSON.stringify(lineCards.map(x => [x.id, x.status]))} expected ${JSON.stringify(wantLines)}`);
      if (edition === 'prithagoras' && e.sentence) ok(e.sentence.test(got.sentence), `${where}: header ${JSON.stringify(got.sentence)}`);
      ok(got.mark === e.mark, `${where}: the mark is the server's ${e.mark}, got ${got.mark}`);
      ok(got.collapsed === e.collapsed, `${where}: collapsed card ${got.collapsed} expected ${e.collapsed}`);
      ok(got.cards.filter(x => x.id === 'collapsed').length <= 1, `${where}: at most ONE collapsed card`);
      if (e.firstError) {
        const fe = got.cards.find(x => x.status === 'first-error');
        ok(fe && fe.id === String(e.firstError) && fe.hasIcon && /First error|पहली|गलती/i.test(fe.text), `${where}: the first-error card says so in a word and an icon`);
        ok(/0/.test(fe.text) && fe.text.length > 30, `${where}: the first-error card carries its own explanation`);
      }
      if (c === 'buoy') ok(!got.cards.some(x => x.status === 'first-error') && !got.boxes.some(b => b.status === 'first-error'), `${where}: no error shown on the buoy working`);
      // every card is a word and an icon, never colour alone; every card reachable by keyboard
      ok(got.cards.every(x => x.hasIcon && x.text.trim().length > 3 && x.tab === 0), `${where}: every comment has an icon, words and a tab stop`);
      ok(got.list && got.headings.length === 1, `${where}: the comments are one named list under one heading`);
      ok(got.overflow <= 0, `${where}: no horizontal scroll (${got.overflow}px)`);
      // outlines: aligned on both sources; one per judged line
      ok(got.aligned === 'true' && got.boxes.length === e.statuses.length, `${where}: every judged line is outlined on the page (${got.boxes.length}/${e.statuses.length}, aligned ${got.aligned})`);
      const inside = got.boxes.every(b => b.r.left >= got.sheet.left - 1 && b.r.right <= got.sheet.right + 1 && b.r.top >= got.sheet.top - 1 && b.r.bottom <= got.sheet.bottom + 1);
      ok(inside, `${where}: every outline lies on the page`);
      ok(got.boxes.every((b, i, a) => i === 0 || b.r.top + b.r.height / 2 > a[i - 1].r.top + a[i - 1].r.height / 2), `${where}: outlines run top to bottom`);
      if (source === 'photo') {
        // The drawing is exact: each marker stands at the left edge and vertical centre of the reader's box on the PICTURE
        // (the rendered image's own rectangle), whatever the page width. Owner's live page, 20 Nov 2026: outlines looked low.
        const geo = await page.evaluate(() => {
          const img = document.querySelector('.mp-img').getBoundingClientRect();
          const want = JSON.parse(document.querySelector('[data-gallery-boxes]').getAttribute('data-gallery-boxes'));
          return { img: img.toJSON(), want, boxes: [...document.querySelectorAll('[data-mp-box]')].map(b => b.getBoundingClientRect().toJSON()) };
        });
        const worst = geo.boxes.reduce((m, r, i) => {
          const w = geo.want[i];
          const dx = Math.abs(r.left - (geo.img.left + w.x * geo.img.width));
          const dy = Math.abs((r.top + r.height / 2) - (geo.img.top + (w.y + w.h / 2) * geo.img.height));
          return Math.max(m, dx, dy);
        }, 0);
        ok(geo.boxes.length === geo.want.length && worst <= 1.5, `${where}: every photo marker stands on the reader's box centre and left edge, within ${worst.toFixed(2)} px`);
        ok(geo.boxes.every(r => r.width <= 3), `${where}: a photo is marked with a bar, never a tight outline`);
        ok(await page.locator('[data-mp-approx-note]').count() === 1, `${where}: the page says the markers are approximate`);
      }
      if (size === 'desktop') {
        ok(got.level === 'true', `${where}: comments are level with their lines on a wide screen`);
        // each line's comment is level with its outline (within a card's height), and no two overlap
        const byN = Object.fromEntries(got.boxes.map(b => [b.n, b.r]));
        const levelOk = lineCards.every(x => { const r = byN[x.id]; const mid = r.top + r.height / 2; return mid >= x.top - 2 && mid <= x.bottom + 2 || Math.abs(x.top - r.top) < 120; });
        ok(levelOk, `${where}: each comment sits beside its line`);
        const sorted = [...got.cards].sort((a, b) => a.top - b.top);
        ok(sorted.every((x, i) => i === 0 || x.top >= sorted[i - 1].bottom - 1), `${where}: no two comments overlap`);
      } else {
        ok(got.level !== 'true' && got.cards[0].top >= got.sheet.bottom - 1, `${where}: on a phone the comments follow the page, in line order`);
      }
      // Compact verified rows, one specific reason or none, the mark in proportion, tags in the margin, the first error in view
      const shape = await page.evaluate(() => {
        const sec = document.querySelector('[data-marked-page]');
        const rows = [...sec.querySelectorAll('.mp-row')].map(r => ({ h: r.getBoundingClientRect().height, text: r.innerText.replace(/\s+/g, ' ').trim() }));
        const fe = sec.querySelector('[data-mp-status="first-error"]'); const feBox = fe && fe.getBoundingClientRect();
        const tags = [...sec.querySelectorAll('.mp-tag')].map(t => { const tr = t.getBoundingClientRect(); const b = t.parentElement.getBoundingClientRect(); return { outside: tr.right <= b.left + 1, inSheet: tr.left >= sec.querySelector('.mp-sheet').getBoundingClientRect().left - 1 }; });
        return { rows, feBottom: feBox ? feBox.bottom : null, tags, quiet: sec.querySelector('.mp-mark-quiet')?.innerText || null, loud: !!sec.querySelector('p.mp-mark'), filler: /true for the question|Valid step \(checked\)/.test(sec.innerText) };
      });
      ok(shape.rows.every(r => r.h <= 30), `${where}: every verified line is one compact row (${shape.rows.map(r => Math.round(r.h))})`);
      ok(!shape.filler, `${where}: no filler sentence on a verified line`);
      ok(shape.tags.every(t => t.outside && t.inSheet), `${where}: every numbered tag sits in the margin, outside its line's box`);
      if (e.mark === '0/3') ok(shape.quiet && !shape.loud && !/^0 of 3 marks$/.test(shape.quiet), `${where}: a wrong final answer never headlines 0 of N (${shape.quiet})`);
      if (e.mark === '2/2') ok(shape.loud && !shape.quiet, `${where}: a right answer shows its mark prominently`);
      if (c === 'stationary' && size === 'desktop') ok(shape.feBottom !== null && shape.feBottom <= 900, `${where}: the first-error card is in view on a 900px viewport (${Math.round(shape.feBottom)})`);
      if (c === 'stationary' && edition === 'prithagoras') {
        const typeset = await page.locator('[data-mp-why-error] .katex').count();
        ok(typeset > 0, `${where}: the first-error sentence is typeset mathematics`);
      }
      if (size === 'phone' && c === 'stationary') {
        await page.locator('[data-mp-card="3"]').click();
        await page.waitForTimeout(400);
        const hl = await page.evaluate(() => document.querySelector('[data-mp-box="3"]').classList.contains('is-active'));
        ok(hl, `${where}: tapping a comment highlights its line`);
      }
      if (source === 'photo' && c === 'stationary' && size === 'desktop') {
        const before = await page.locator('.mp-img').getAttribute('data-mp-photo');
        await page.locator('[data-mp-photo-toggle]').click();
        const after = await page.locator('.mp-img').getAttribute('data-mp-photo');
        ok(before === 'cleaned' && after === 'original', `${where}: the photo is shown cleaned for display with a Show original toggle (${before} -> ${after})`);
        await page.locator('[data-mp-photo-toggle]').click();
        await page.keyboard.press('Shift'); // back to keyboard modality: the focus-ring check below is about keyboard focus
      }
      // tying a comment to its line: focus lights both
      if (size === 'desktop' && c === 'stationary') {
        await page.locator('[data-mp-card="8"]').focus();
        const lit = await page.evaluate(() => ({ card: document.querySelector('[data-mp-card="8"]').classList.contains('is-active'), box: document.querySelector('[data-mp-box="8"]').classList.contains('is-active') }));
        ok(lit.card && lit.box, `${where}: focusing a comment lights its outline too`);
        await page.locator('[data-mp-box="3"]').hover();
        const lit2 = await page.evaluate(() => ({ card: document.querySelector('[data-mp-card="3"]').classList.contains('is-active'), box: document.querySelector('[data-mp-box="3"]').classList.contains('is-active') }));
        ok(lit2.card && lit2.box, `${where}: hovering an outline lights its comment`);
        const focusStyle = await page.evaluate(() => { document.querySelector('[data-mp-card="2"]').focus(); const s = getComputedStyle(document.querySelector('[data-mp-card="2"]')); return { outline: s.outlineStyle, width: s.outlineWidth }; });
        ok(focusStyle.outline !== 'none', `${where}: a focused comment shows a visible focus ring`);
      }
      // the owner's ban list, on what the browser computed
      const banned = await page.evaluate(() => {
        const sec = document.querySelector('[data-marked-page]'); const bad = [];
        for (const el of sec.querySelectorAll('*')) {
          const s = getComputedStyle(el);
          if (/gradient/.test(s.backgroundImage)) bad.push('gradient');
          if (s.backdropFilter && s.backdropFilter !== 'none') bad.push('blur');
          for (const side of ['Left']) if (el.matches('.mp-card') && parseFloat(s[`border${side}Width`]) !== parseFloat(s.borderTopWidth)) bad.push('left-border card');
          if (el.matches('.mp-card') && parseFloat(s.borderTopWidth) < 1) bad.push('no hairline');
          if (/opacity|transition/.test(s.transitionProperty) && parseFloat(s.transitionDuration) > 0 && el.matches('.mp-card, .mp-box')) bad.push('fading hover');
        }
        return [...new Set(bad)].concat(/—/.test(sec.innerText) ? ['em dash'] : []).concat(/\p{Extended_Pictographic}/u.test(sec.innerText) ? ['emoji'] : []);
      });
      ok(banned.length === 0, `${where}: banned styles or copy present: ${banned}`);
      if (shots && ['stationary', 'buoy'].includes(c) && edition === 'prithagoras') {
        await page.screenshot({ path: `${shots}/${c}-${source}-${edition}-${theme}-${size}.png`, fullPage: true });
      }
      if (shots && edition === 'priyabhata' && c === 'stationary' && theme === 'light') await page.screenshot({ path: `${shots}/${c}-${source}-${edition}-${theme}-${size}.png`, fullPage: true });
      if (shots && c === 'mixed' && size === 'desktop' && theme === 'light' && edition === 'prithagoras') await page.screenshot({ path: `${shots}/${c}-${source}-${edition}-${theme}-${size}.png`, fullPage: true });
    }
    ok(errors.length === 0, `${edition}/${theme}/${size}: page errors ${errors.slice(0, 3)}`);
    await context.close();
  }
} finally { await browser.close(); await server.close(); }

if (failures.length) { console.error(failures.slice(0, 40).map(f => `  · ${f}`).join('\n')); console.error(`MARKED PAGE TOUR: FAIL — ${failures.length} of ${pass + failures.length}`); process.exit(1); }
console.log(`MARKED PAGE TOUR: PASS — ${pass}/${pass} checks — the owner's two cases and a mixed page, ink and photo, both editions, light and dark, desktop and 390 px; the page and the mark are SYNTHETIC, the verdicts are the engine's`);
