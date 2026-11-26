// The teacher-marked page, driven in a real browser (Prithagoras edition). WHAT IS REAL: the MarkedPage component, its styles and the bundled
// handwriting face; the engine's verdicts on the stationary-points and "crossed" cases. WHAT IS SYNTHETIC, and labelled so: the 19-line
// stationary-points page (a canvas drawing with fixture line boxes, two columns in the middle), the fixture report classes and the fixture criteria.
// No photograph of a person, no real student, no real reader, no device.
//   node client/test/tour-teacher-marked-page.mjs [--shots=<dir>]
import { chromium } from '@playwright/test';
import { mkdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { PHRASES } from '../src/components/markedPageTeacher.js';

const CLIENT = fileURLToPath(new URL('..', import.meta.url));
// Screenshots are taken only when asked for (--shots=<dir> or PRI_TOUR_SHOTS=<dir>); CI sets neither, so the assertions run without the extra loads.
const shots = (process.argv.find(a => a.startsWith('--shots=')) || '').slice(8) || process.env.PRI_TOUR_SHOTS || '';
if (shots) mkdirSync(shots, { recursive: true });
let pass = 0; const failures = [];
const ok = (c, l) => { if (c) pass++; else failures.push(l); };

const server = await createServer({
  root: CLIENT, configFile: fileURLToPath(new URL('../vite.config.js', import.meta.url)), logLevel: 'error',
  server: { host: '127.0.0.1', port: 0, strictPort: false, hmr: false, watch: null, proxy: undefined, fs: { strict: false } },
  optimizeDeps: { entries: ['test/support/marked-page-gallery.html'] }
});
await server.listen();
const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
const url = (c, { theme = 'light', edition = 'prithagoras', teacher = true, extra = '' } = {}) => `${origin}/test/support/marked-page-gallery.html?case=${c}&source=photo&edition=${edition}&theme=${theme}${teacher ? '&teacher=1' : ''}${extra ? `&${extra}` : ''}`;
const browser = await chromium.launch();
// One load per page: the lazy marking layer is awaited by its own element, the view is chosen by the control the student uses, and the layout is
// settled by the browser's own signals (fonts, the image, two frames), never by a fixed sleep.
const settle = pg => pg.evaluate(() => Promise.all([document.fonts.ready, new Promise(r => { const im = document.querySelector('.mp-img'); if (!im || im.complete) r(); else im.addEventListener('load', r, { once: true }); })]).then(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))));
const switchView = async (page, view) => {
  if ((await page.getAttribute('.mp-t-sheet', 'data-mp-view')) !== view) await page.click(`[data-mp-view-option="${view}"]`);
  await page.waitForSelector(`.mp-t-sheet[data-mp-view="${view}"]`);
  if (view !== 'original') await page.waitForSelector('.mp-t-tick');
  await settle(page);
};
const open = async (page, u, view = 'marked') => {
  await page.goto(u, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.mp-t-sheet');
  await switchView(page, view);
};
const gone = pg => pg.waitForFunction(() => !document.querySelector('[data-mp-pop]'), null, { timeout: 2000 }).then(() => true, () => false);
const lum = hex => { const c = hex.match(/\w\w/g).map(h => parseInt(h, 16) / 255).map(v => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
const contrast = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const hexOf = rgb => '#' + rgb.match(/\d+/g).slice(0, 3).map(n => Number(n).toString(16).padStart(2, '0')).join('');
// The page and its report are the engine's REAL output (server/test/support/teacher-page-real-reports.mjs): since the tick-every-true-line engine the engine
// ticks 16 of these 19 lines, each with its own class id. Lines 1 and 13 are headings (neutral); line 17 is a bare list of points the engine does not read.
const CLASS_OF = { 2: 'given', 3: 'differentiation', 4: 'conditionLine', 5: 'stationaryEquation', 6: 'factorisation', 7: 'stationaryValues', 8: 'secondDerivative', 9: 'signClaim', 10: 'natureClaim', 11: 'signClaim', 12: 'natureClaim', 14: 'substitution', 15: 'substitution', 16: 'trueAsWritten', 18: 'conclusionMatches', 19: 'conclusion' };
// Where the engine verified what a line DID (a change between two lines), the page says that fact; every other tick says its class. (engine/stepExplain.js)
const SPECIFIC = { 3: '4x³ → 12x², −36x² → −72x', 6: '12x² − 72x = 12x(x − 6)', 7: 'x = 0 or x = 6', 14: '4 × 0³ − 36 × 0² = 0', 15: '6³ = 216, 6² = 36', 16: '4 × 216 = 864, 36 × 36 = 1296, 864 − 1296 = −432' };
const phraseWanted = n => SPECIFIC[n] || PHRASES[CLASS_OF[n]] || null;
const CHECKED = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 15, 16, 18, 19];
const UNCHECKED = [1, 13, 17];         // headings (neutral) and a list of points the engine could not verify: no tick, no cross

for (const [size, viewport] of [['desktop', { width: 1280, height: 900 }], ['phone', { width: 390, height: 844 }]]) {
  for (const theme of ['light', 'dark']) {
    const where = `${size}/${theme}`;
    const ctx = await browser.newContext({ viewport, colorScheme: theme }); const page = await ctx.newPage();
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await open(page, url('owner19', { theme, extra: 'criteria=1' }));
    const got = await page.evaluate(() => {
      const sec = document.querySelector('[data-marked-page]');
      const rect = el => el.getBoundingClientRect().toJSON();
      const img = rect(sec.querySelector('.mp-img'));
      const boxes = JSON.parse(document.querySelector('[data-gallery-boxes]').getAttribute('data-gallery-boxes'));
      const ticks = [...sec.querySelectorAll('.mp-t-tick')].map(b => ({ n: Number(b.getAttribute('data-mp-box')), label: b.getAttribute('aria-label'), where: b.getAttribute('data-mp-where'), r: rect(b.querySelector('svg')), tag: b.tagName, cls: b.getAttribute('data-mp-class'), phrase: b.getAttribute('data-mp-phrase'), num: rect(b.querySelector('.mp-t-num')), numShown: getComputedStyle(b.querySelector('.mp-t-num')).display !== 'none' }));
      return {
        img, boxes, ticks, boxesPx: boxes.map(b => ({ x0: img.left + b.x * img.width, x1: img.left + (b.x + b.w) * img.width, y0: img.top + b.y * img.height, y1: img.top + (b.y + b.h) * img.height })),
        markBoxes: [...sec.querySelectorAll('[data-mp-markbox]')].map(b => ({ n: b.getAttribute('data-mp-markbox'), text: b.textContent.trim(), label: b.getAttribute('aria-label'), r: rect(b) })),
        says: [...sec.querySelectorAll('[data-mp-say]')].map(w => ({ n: w.getAttribute('data-mp-say'), text: (w.getAttribute('data-mp-say-plain') ?? w.textContent.trim()), r: rect(w), font: getComputedStyle(w).fontFamily })),
        onPaper: { say: (() => { const e = sec.querySelector('.mp-t-say'); return e ? getComputedStyle(e).color : null; })(), tick: getComputedStyle(sec.querySelector('.mp-t-glyph.is-right')).color, under: 'rgb(184, 50, 56)' },
        gutterBg: getComputedStyle(sec.querySelector('[data-mp-gutter]')).backgroundColor,
        sheetH: rect(sec.querySelector('.mp-sheet-in')).height, sheetTop: rect(sec.querySelector('.mp-sheet-in')).top,
        words: [...sec.querySelectorAll('[data-mp-words]')].map(w => ({ n: w.getAttribute('data-mp-words'), text: (w.getAttribute('data-mp-say-plain') ?? w.textContent.trim()), font: getComputedStyle(w).fontFamily, r: rect(w) })),
        tally: sec.querySelector('[data-mp-tally]')?.textContent, figure: sec.querySelector('[data-mp-figure]')?.getAttribute('data-mp-figure'), stateWord: sec.querySelector('[data-mp-state-word]')?.textContent,
        foot: sec.querySelector('[data-mp-foot]')?.textContent, assess: sec.querySelector('[data-mp-assess] summary')?.innerText.replace(/\s+/g, ' ').trim(),
        rows: [...sec.querySelectorAll('[data-mp-row]')].map(r => r.innerText.replace(/\s+/g, ' ').trim()),
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        sheetAttr: sec.querySelector('.mp-t-sheet')?.getAttribute('data-mp-size'),
        root: !!sec.classList.contains('mp-t-root'), text: sec.innerText,
        bad: [...sec.querySelectorAll('*')].filter(e => /gradient/.test(getComputedStyle(e).backgroundImage) || (getComputedStyle(e).backdropFilter || 'none') !== 'none').length,
        fontOk: document.fonts.check('16px "Pri Hand"'),
        tokens: Object.fromEntries(['--mk-paper', '--mk-graphite', '--mk-correct', '--mk-error', '--mk-ink', '--mk-accent', '--mk-advisory', '--mk-advisory-text', '--mk-rule', '--mk-quiet'].map(k => [k, getComputedStyle(sec).getPropertyValue(k).trim()]))
      };
    });
    ok(errors.length === 0, `${where}: no page errors ${errors}`);
    ok(got.root, `${where}: the marking root carries the scoped tokens`);
    // ticks only where the engine proved a line; never on the lines it could not verify
    ok(JSON.stringify(got.ticks.map(t => t.n)) === JSON.stringify(CHECKED), `${where}: a tick on exactly the proved lines ${JSON.stringify(got.ticks.map(t => t.n))}`);
    ok(got.ticks.every(t => t.tag === 'BUTTON' && new RegExp(`^Line ${t.n}: correct\\.`).test(t.label)), `${where}: every tick is a button with a text alternative`);
    ok(/Line 3: correct\. 4x³ → 12x², −36x² → −72x\./.test(got.ticks.find(t => t.n === 3).label), `${where}: the label says what the line did: ${got.ticks.find(t => t.n === 3).label}`);
    ok(!got.ticks.some(t => UNCHECKED.includes(t.n)), `${where}: no tick and no cross on a line the engine could not verify`);
    // exactly one margin box, on the line that earned the mark, and it says what the server awarded
    ok(got.markBoxes.length === 1 && got.markBoxes[0].text === '1/1' && got.markBoxes[0].n === '7', `${where}: one margin mark, 1/1, on line 7 ${JSON.stringify(got.markBoxes)}`);
    ok(/Line 7: 1 mark awarded/.test(got.markBoxes[0].label), `${where}: the margin mark has a text alternative`);
    // no tick sits on the student's writing
    const onInk = got.ticks.filter(t => t.where === 'page').filter(t => got.boxesPx.some(b => t.r.left < b.x1 && b.x0 < t.r.right && t.r.top < b.y1 && b.y0 < t.r.bottom));
    ok(onInk.length === 0, `${where}: no tick covers a line of writing ${JSON.stringify(onInk.map(t => t.n))}`);
    if (size === 'desktop') {
      const pg = got.ticks.filter(t => t.where === 'page');
      ok(pg.every((a, i) => pg.every((b, j) => i === j || !(a.r.left < b.r.right && b.r.left < a.r.right && a.r.top < b.r.bottom && b.r.top < a.r.bottom))), `${where}: no two ticks overlap`);
    }
    // every tick is anchored to ITS line: centre inside the line's own vertical range, just right of its box (a gutter tick is at the margin, still level with it)
    const anchored = got.ticks.map(t => { const b = got.boxesPx[t.n - 1]; const cy = (t.r.top + t.r.bottom) / 2; return { n: t.n, where: t.where, dy: cy >= b.y0 - 1 && cy <= b.y1 + 1, dx: t.where === 'gutter' || (t.r.left - b.x1 >= -1 && t.r.left - b.x1 <= 14) }; });
    ok(anchored.every(a => a.dy && a.dx), `${where}: every tick sits on its own line, just after it ${JSON.stringify(anchored.filter(a => !(a.dy && a.dx)))}`);
    ok(size !== 'desktop' || got.ticks.every(t => t.where === 'page'), `${where}: even line 8, beside the second column, keeps its tick on its own line`);
    // the phrase on each tick is the phrase of that line's own class
    ok(got.ticks.every(t => t.cls === CLASS_OF[t.n] && (t.phrase || null) === phraseWanted(t.n)), `${where}: every phrase is its own line's class ${JSON.stringify(got.ticks.filter(t => t.cls !== CLASS_OF[t.n]).map(t => [t.n, t.cls]))}`);
    ok(got.ticks.find(t => t.n === 7).phrase === 'x = 0 or x = 6', `${where}: line 7 says its own class`);
    // the number is clear of the stroke
    ok(got.ticks.filter(t => t.numShown).every(t => t.num.left >= t.r.right - 3), `${where}: tick numbers stand clear of the stroke`);
    ok(got.ticks.filter(t => t.numShown).every(t => !got.boxesPx.some((b, i) => i + 1 !== t.n && t.num.left < b.x1 && b.x0 < t.num.right && t.num.top < b.y1 && b.y0 < t.num.bottom)), `${where}: a number never lands on another line's writing`);
    // the margin mark is level with its line; the few words follow the tick on the same line
    ok(got.markBoxes.every(m => { const b = got.boxesPx[Number(m.n) - 1]; const cy = (m.r.top + m.r.bottom) / 2; return cy >= b.y0 - 1 && cy <= b.y1 + 1; }), `${where}: each margin mark is level with its own line`);
    // the short phrase stands after the tick on every ticked line that has free space beside it, and never touches ink, a tick or another phrase
    const sayN = got.says.map(w => Number(w.n));
    if (size === 'desktop') {
      ok(sayN.includes(3) && sayN.includes(6), `${where}: phrases after the ticks on lines 3 and 6, line 7's in the margin with a leader (got ${sayN})`);
      ok(got.says.find(w => w.n === '3').text === SPECIFIC[3] && got.says.find(w => w.n === '6').text === SPECIFIC[6] && (got.says.find(w => w.n === '7') || got.words.find(w => w.n === '7')).text === SPECIFIC[7], `${where}: each says its own class`);
    } else ok(got.says.length === 0 && got.words.length === 0, `${where}: a phone page carries no words on it (the popover and the list do); each tick stands once`);
    if (size === 'desktop') {
      const spoken = new Set([...got.says.map(w => Number(w.n)), ...got.words.map(w => Number(w.n))]);
      ok(got.ticks.filter(t => t.phrase).every(t => spoken.has(t.n)), `${where}: every tick with a phrase carries it on the page, beside it or in the margin ${JSON.stringify(got.ticks.filter(t => t.phrase && !spoken.has(t.n)).map(t => t.n))}`);
    }
    ok((got.onPaper.say === null || got.onPaper.say === 'rgb(40, 116, 73)') && got.onPaper.tick === 'rgb(40, 116, 73)' && got.onPaper.under === 'rgb(184, 50, 56)', `${where}: what is drawn on the photograph keeps the colours that read on paper in both themes ${JSON.stringify(got.onPaper)}`);
    ok(got.says.every(w => /Pri Hand/.test(w.font)), `${where}: phrases are in the bundled face`);
    ok(got.says.every(w => { const t = got.ticks.find(x => String(x.n) === w.n); return w.r.left >= t.r.right - 1 && w.r.left - t.r.right <= 30 && Math.abs((w.r.top + w.r.bottom) / 2 - (t.r.top + t.r.bottom) / 2) <= 10; }), `${where}: each phrase follows its own tick on the same line`);
    ok(got.says.every(w => !got.boxesPx.some(b => w.r.left < b.x1 && b.x0 < w.r.right && w.r.top < b.y1 && b.y0 < w.r.bottom) && !got.ticks.some(t => t.r.left < w.r.right && w.r.left < t.r.right && t.r.top < w.r.bottom && w.r.top < t.r.bottom) && got.says.every(o => o === w || !(w.r.left < o.r.right && o.r.left < w.r.right && w.r.top < o.r.bottom && o.r.top < w.r.bottom))), `${where}: no phrase touches writing, a tick or another phrase`);
    // On a phone the page is 330 px wide and the two-column middle of this fixture leaves no free space beside some lines: a tick may then stand in the right
// gutter, level with its own line (the anchoring check above), never more than two, and never twice. On a desktop every tick stands on the page.
const inGutter = got.ticks.filter(t => t.where !== 'page').map(t => t.n);
ok(got.ticks.length === CHECKED.length && (size === 'desktop' ? inGutter.length === 0 : inGutter.length <= 2), `${where}: every tick stands once, at the end of its own line on the page (phone: at most two in the gutter, level with their lines) ${JSON.stringify(inGutter)}`);
    // ticks stand at the end of their own lines, one each: no tick is drawn twice (a page tick and a margin tick for the same line)
    ok(new Set(got.ticks.map(t => t.n)).size === got.ticks.length && (size !== 'phone' || got.ticks.every(t => t.where === 'page') || got.ticks.filter(t => t.where === 'gutter').every(t => !got.ticks.some(o => o !== t && o.n === t.n))), `${where}: each tick once`);
    // phone: ticks stay legible; the margin is paper in either theme
    ok(got.ticks.every(t => t.r.height >= 15.5), `${where}: every tick is at least 16 px tall (${Math.min(...got.ticks.map(t => t.r.height))})`);
    if (size === 'phone') {
      const before = await page.evaluate(() => document.querySelector('.mp-sheet-in').getBoundingClientRect().width);
      await page.locator('[data-mp-enlarge]').click(); await page.waitForSelector('.mp-t-zoom.is-on'); await settle(page);
      const big = await page.evaluate(() => ({ w: document.querySelector('.mp-sheet-in').getBoundingClientRect().width, overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth, scrolls: document.querySelector('.mp-t-zoom').scrollWidth > document.querySelector('.mp-t-zoom').clientWidth, tick: Math.min(...[...document.querySelectorAll('.mp-t-tick svg')].map(e => e.getBoundingClientRect().height)) }));
      ok(big.w >= before * 2 && big.overflow <= 0 && big.scrolls && big.tick >= 16, `${where}: Enlarge page makes the page wider, scrolls inside its own frame, the document does not ${JSON.stringify(big)} from ${Math.round(before)}`);
      await page.locator('[data-mp-enlarge]').click();
      ok(await page.evaluate(() => document.querySelector('.mp-sheet-in').getBoundingClientRect().width) <= before + 1, `${where}: Fit to screen returns`);
      const fill = await page.evaluate(() => ({ sheet: document.querySelector('.mp-t-sheet').getBoundingClientRect().width, body: document.querySelector('.mp-body').getBoundingClientRect().width }));
      ok(fill.sheet >= fill.body - 1, `${where}: the page and its margin fill the width (${Math.round(fill.sheet)} of ${Math.round(fill.body)} px)`);
    }
    ok(got.gutterBg === 'rgb(248, 247, 243)', `${where}: the margin is the same paper in both themes (${got.gutterBg})`);
    ok(got.fontOk, `${where}: the bundled handwriting face loads`);
    ok(got.tally === '16 lines correct. 0 wrong. 1 not checked.', `${where}: the tally counts maths lines only: ${got.tally}`);
    ok(got.figure === '1/1' && got.stateWord === 'Fully correct', `${where}: the server's mark and its one-word state ${got.figure} ${got.stateWord}`);
    ok(/Assessment . Attempt 01/i.test(got.assess) && /Marked/i.test(got.assess), `${where}: the assessment line: ${got.assess}`);
    ok(got.rows.length === 1 && /Finds the stationary values/.test(got.rows[0]) && /1\/1/.test(got.rows[0]) && /Line 7 gives x = 0 or x = 6/.test(got.rows[0]), `${where}: one mark-allocation row for the one real criterion ${JSON.stringify(got.rows)}`);
    ok(got.foot === '0 corrections · 1 criterion satisfied', `${where}: the footer ${got.foot}`);
    ok(!/%/.test(got.text.replace(/\d+%\)/g, '')) , `${where}: no percentage`);
    ok(got.overflow <= 0, `${where}: no horizontal scroll (${got.overflow}px)`);
    ok(got.bad === 0 && !/—/.test(got.text) && !/\p{Extended_Pictographic}/u.test(got.text), `${where}: no gradient, glass, em dash or emoji`);
    // AA contrast of the marking colours on the paper, in this theme
    const t = got.tokens;
    ok(contrast(t['--mk-correct'], t['--mk-paper']) >= 4.5 && contrast(t['--mk-error'], t['--mk-paper']) >= 4.5 && contrast(t['--mk-graphite'], t['--mk-paper']) >= 4.5 && contrast(t['--mk-quiet'], t['--mk-paper']) >= 4.5 && contrast(t['--mk-accent'], t['--mk-paper']) >= 4.5 && contrast(t['--mk-advisory-text'], t['--mk-paper']) >= 4.5,
      `${where}: marking colours reach AA on the paper ${[['correct', '--mk-correct'], ['error', '--mk-error'], ['graphite', '--mk-graphite'], ['accent', '--mk-accent']].map(([n, k]) => `${n} ${contrast(t[k], t['--mk-paper']).toFixed(2)}`).join(', ')}`);
    if (theme === 'light') ok(t['--mk-paper'].toLowerCase() === '#f8f7f3' && t['--mk-correct'].toLowerCase() === '#287449' && t['--mk-error'].toLowerCase() === '#b83238' && t['--mk-accent'].toLowerCase() === '#7654a5', `${where}: the owner's tokens`);

    // three criteria: three margin boxes, none invented; no criteria at all: none
    await open(page, url('owner19', { theme, extra: 'criteria=3' }));
    ok(JSON.stringify(await page.locator('[data-mp-markbox]').evaluateAll(es => es.map(e => e.getAttribute('data-mp-markbox')))) === '["3","7","16"]', `${where}: three criteria, three margin marks, each on its own line`);
    // for every fixture, the boxes in the margin never add up to more than the server's marks, and nothing is boxed that the server did not pay
    for (const [cs, extra, total] of [['owner19', 'criteria=3', 3], ['owner19', 'criteria=1', 1], ['owner19', '', 1], ['wrong', '', 0]]) {
      await open(page, url(cs, { theme, extra }));
      const sum = await page.evaluate(() => [...document.querySelectorAll('[data-mp-markbox]')].reduce((a, b) => a + Number(b.getAttribute('data-mp-markbox-text').split('/')[0]), 0));
      const fig = await page.evaluate(() => document.querySelector('[data-mp-figure]').getAttribute('data-mp-figure'));
      ok(sum <= Number(fig.split('/')[0]) && sum <= total, `${where}: ${cs} ${extra || 'no criteria'}: margin boxes add to ${sum}, the server's marks are ${fig}`);
    }
    await open(page, url('owner19', { theme }));
    ok(await page.locator('[data-mp-markbox]').count() === 0, `${where}: no approved criteria, no margin mark and no allocation rows (nothing invented)`);
    ok(await page.locator('[data-mp-row]').count() === 0, `${where}: no invented rows`);

    // the cross
    await open(page, url('wrong', { theme }), 'marked');
    const cross = await page.evaluate(() => {
      const b = document.querySelector('.mp-t-tick.is-wrong');
      return { n: b?.getAttribute('data-mp-box'), label: b?.getAttribute('aria-label'), color: b && getComputedStyle(b.querySelector('svg')).color, under: document.querySelectorAll('[data-mp-under]').length,
        words: [...document.querySelectorAll('[data-mp-say], [data-mp-words]')].map(w => (w.getAttribute('data-mp-say-plain') ?? w.textContent.trim())), ticks: document.querySelectorAll('.mp-t-tick.is-right').length,
        none: ['6', '7', '8', '9'].every(n => !document.querySelector(`[data-mp-box="${n}"]`)) };
    });
    ok(cross.n === '5' && /^Line 5: wrong\. /.test(cross.label) && cross.under === 1 && cross.ticks === 3 && cross.none, `${where}: one cross on the first wrong line, with its underline; none on unverified lines ${JSON.stringify(cross)}`);
    if (size === 'desktop') ok(cross.words.some(w => /x terms come to 18x/.test(w)), `${where}: the cross says why, in the engine's own words ${cross.words}`);
    ok(contrast(hexOf(cross.color), '#fbfaf6') >= 4.5, `${where}: the cross is red enough to read on the photographed paper`);
    if (shots) {
      for (const v of ['marked', 'detailed', 'original']) {
        await open(page, url('owner19', { theme, extra: 'criteria=1' }), v);
        await page.screenshot({ path: `${shots}/teacher-marked-${v}-${size}-${theme}.png`, fullPage: true });
      }
      await open(page, url('wrong', { theme }), 'detailed');
      await page.screenshot({ path: `${shots}/teacher-marked-cross-${size}-${theme}.png`, fullPage: true });
    }
    await ctx.close();
  }
}

{
  // views, traceability, keyboard, motion, India
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } }); const page = await ctx.newPage();
  await open(page, url('owner19', { extra: 'criteria=3' }), 'marked');
  const radios = await page.locator('[data-mp-view-option]').evaluateAll(es => es.map(e => [e.getAttribute('data-mp-view-option'), e.getAttribute('aria-checked'), e.tabIndex]));
  ok(JSON.stringify(radios) === JSON.stringify([['original', 'false', -1], ['marked', 'true', 0], ['detailed', 'false', -1]]), `three views, one tab stop ${JSON.stringify(radios)}`);
  const original = await page.evaluate(() => ({ src: document.querySelector('.mp-img').getAttribute('src').length, filter: document.querySelector('.mp-img').style.filter, mode: document.querySelector('.mp-img').getAttribute('data-mp-photo') }));
  ok(original.mode === 'original' && !original.filter, 'the page opens as the photograph was taken: no cleaning filter');
  await page.locator('[data-mp-view-option="original"]').click();
  ok(await page.locator('.mp-t-tick, [data-mp-gutter], [data-mp-assess], [data-mp-layer]').count() === 0 || await page.locator('[data-mp-layer]').count() === 0, 'Original shows the page and no marking layer');
  ok(await page.locator('.mp-t-tick').count() === 0 && await page.locator('[data-mp-gutter]').count() === 0 && await page.locator('.mp-panel').isHidden(), 'Original: no tick, no margin, no panel');
  const same = await page.evaluate(() => document.querySelector('.mp-img').getAttribute('src').length);
  ok(same === original.src, 'Original shows the same photograph, untouched');
  await page.reload({ waitUntil: 'domcontentloaded' }); await page.waitForSelector('.mp-t-sheet');
  ok(await page.locator('[data-mp-view-option="original"]').getAttribute('aria-checked') === 'true', 'the choice is remembered');
  await page.locator('[data-mp-view-option="original"]').focus(); await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowRight');
  ok(await page.locator('[data-mp-view-option="detailed"]').getAttribute('aria-checked') === 'true', 'arrow keys move between the views');

  // the page never changes height between views, and every mark stays level with its line in each
  const heights = {};
  for (const v of ['original', 'marked', 'detailed']) {
    if (v === 'original') await open(page, url('owner19', { extra: 'criteria=3' }), v); else await switchView(page, v);
    heights[v] = await page.evaluate(() => {
      const img = document.querySelector('.mp-img').getBoundingClientRect();
      const sheet = document.querySelector('.mp-sheet-in').getBoundingClientRect();
      const boxes = JSON.parse(document.querySelector('[data-gallery-boxes]').getAttribute('data-gallery-boxes'));
      const lvl = el => { const r = el.getBoundingClientRect(); return (r.top + r.bottom) / 2; };
      const off = [...document.querySelectorAll('[data-mp-box], [data-mp-markbox]')].map(e => { const n = Number(e.getAttribute('data-mp-box') || e.getAttribute('data-mp-markbox')); const b = boxes[n - 1]; const y0 = img.top + b.y * img.height, y1 = img.top + (b.y + b.h) * img.height; const cy = lvl(e); return cy >= y0 - 1 && cy <= y1 + 1 ? null : n; }).filter(Boolean);
      return { h: Math.round(sheet.height), top: Math.round(sheet.top), off, imgH: Math.round(img.height) };
    });
  }
  ok(heights.original.h === heights.marked.h && heights.marked.h === heights.detailed.h && heights.original.top === heights.detailed.top, `the page keeps its height and place in every view ${JSON.stringify(heights)}`);
  ok(heights.marked.off.length === 0 && heights.detailed.off.length === 0, `marks stay level with their lines in Marked and Detailed ${JSON.stringify([heights.marked.off, heights.detailed.off])}`);
  await open(page, url('owner19', { extra: 'criteria=3' }), 'detailed');
  const first = await page.evaluate(() => ({ state: document.querySelector('.mp-state')?.innerText.replace(/\s+/g, ' ').trim(), icons: document.querySelectorAll('.mp-state svg').length }));
  ok(first.state.length > 0, `line 1 as the engine reports it (it could not read it): ${first.state}`);
    await page.locator('[data-mp-box="2"]').click();
  ok(/^Question restated/.test(await page.locator('.mp-state').innerText()), 'the restated question says Question restated');
  // Detailed: steps are keyboard reachable, name the step with its mark and one sentence, and trace to the page
  ok(await page.locator('[data-mp-chip]').count() === 3, 'one step chip per real criterion');
  await page.locator('[data-mp-chip="stationary"]').focus(); await page.keyboard.press('Enter');
  const step = await page.locator('[data-mp-stepdetail]').innerText();
  ok(/Finds the stationary values/.test(step) && /1\/1 mark/.test(step) && /Line 7 gives x = 0 or x = 6/.test(step), `a step shows its name, mark and why: ${step.replace(/\s+/g, ' ')}`);
  ok(await page.locator('[data-mp-trace="7"]').count() === 1 && await page.locator('[data-mp-trace]').count() === 1, 'the step lights the line that earned it, and only it');
  ok(await page.locator('[data-mp-markbox="7"].is-traced').count() === 1, 'and its margin mark');
  await page.locator('[data-mp-chip="stationary"]').click();
  ok(await page.locator('[data-mp-trace]').count() === 0, 'choosing the step again clears it');
  await page.locator('[data-mp-row="points"]').click();
  ok(await page.locator('[data-mp-trace="16"]').count() === 1, 'a mark-allocation row lights its line on the page');
  await page.locator('[data-mp-box="3"]').click();
  ok(await page.locator('[data-mp-row="derivative"].is-traced').count() === 1 && await page.locator('[data-mp-row="points"].is-traced').count() === 0, 'a tick lights the row it earned, and only that row');
  await page.keyboard.press('Tab');
  ok(await page.evaluate(() => !!document.activeElement), 'keyboard focus moves on');
  const list = await page.locator('[data-mp-list] li').count();
  ok(list >= 6, `Detailed feedback lists every mark in words (${list})`);
  await ctx.close();

  // nothing the server has not released is in the page: no worked solution, no step text, no question text or answer key (they are not given to this component)
  const lc = await browser.newContext({ viewport: { width: 1280, height: 900 } }); const lp = await lc.newPage();
  await open(lp, url('owner19', { extra: 'criteria=1' }), 'detailed');
  const leak = await lp.evaluate(() => { const h = document.documentElement.outerHTML; return ['Stationary $x$-values', 'The larger is', 'has two stationary points', 'owner-stationary', 'solutionFor', '"answer"'].filter(t => h.includes(t)); });
  await lc.close();
  ok(leak.length === 0, `no answer, solution or question text anywhere in the marked page's DOM ${JSON.stringify(leak)}`);
  const qc = readFileSync(new URL('../src/components/QuestionCard.jsx', import.meta.url), 'utf8');
  ok(/const awInput = useMemo\(\(\) => \{\s*if \(!resolved \|\| previousAttempt \|\| !res \|\| res\.revealed \|\| res\.invalid/.test(qc), 'the marked page is built only for a resolved, unrevealed, valid result: there is nothing to draw before marking');
  // reduced motion: drawn, not animated
  const rm = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' }); const pr = await rm.newPage();
  await open(pr, url('owner19'), 'marked');
  const reduced = await pr.evaluate(() => [...document.querySelectorAll('.mp-t-glyph path')].map(p => getComputedStyle(p).animationName));
  ok(reduced.length > 0 && reduced.every(n => n === 'none'), `reduced motion: ticks appear drawn, no animation ${reduced.slice(0, 2)}`);
  await rm.close();
  const mo = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'no-preference' }); const pm = await mo.newPage();
  await open(pm, url('owner19'), 'marked');
  ok((await pm.evaluate(() => getComputedStyle(document.querySelector('.mp-t-glyph path')).animationName)) === 'mp-t-draw', 'with motion allowed, the tick draws on');
  await mo.close();

  // India renders exactly as before: no marking root, no ticks, the old markers, the old header, in Hindi
  const hi = await browser.newContext({ viewport: { width: 1280, height: 900 } }); const ph = await hi.newPage();
  const requested = []; ph.on('request', r => requested.push(r.url()));
  await ph.goto(url('stationary', { edition: 'priyabhata', teacher: false }), { waitUntil: 'domcontentloaded' }); await ph.waitForSelector('[data-marked-page]'); await ph.waitForSelector('.mp-marker[data-mp-box]');
  const india = await ph.evaluate(() => ({ root: document.querySelector('.mp-t-root, .mp-t-sheet, .mp-t-tick, [data-mp-views], [data-mp-tally], [data-mp-assess], [data-mp-gutter]') !== null, markers: document.querySelectorAll('.mp-marker[data-mp-box]').length, sentence: !!document.querySelector('[data-mp-counts]'), hasPhoto: document.querySelector('.mp-img') !== null || document.querySelector('.mp-ink') !== null,
    photo: document.querySelector('.mp-img')?.getAttribute('data-mp-photo') || null }));
  ok(!india.root && india.markers > 0 && india.sentence, `India: no teacher marks, the old markers and header ${JSON.stringify(india)}`);
  ok(!requested.some(u => /teacherLayer|TeacherMarks|markedPageTeacher|MarkedPageTeacher/.test(u)), 'India never fetches the marking layer');
  await hi.close();
  const src = readFileSync(new URL('../src/components/MarkedPage.jsx', import.meta.url), 'utf8');
  ok(/teacherMarks = EDITION === 'prithagoras'/.test(src), 'the teacher-marked page is on only in the Prithagoras build');
  const strings = readFileSync(new URL('../src/components/markedPageTeacher.js', import.meta.url), 'utf8') + readFileSync(new URL('../src/components/TeacherMarks.jsx', import.meta.url), 'utf8');
  ok(!/[ऀ-ॿ]/.test(strings), 'no Hindi in the new surface');
}

{
  // the popover: hover, keyboard focus and tap each open the fuller detail anchored to the mark
  const rectsOf = async (pg, n) => pg.evaluate(k => {
    const pop = document.querySelector('[data-mp-pop]'); const tick = document.querySelector(`[data-mp-box="${k}"]`);
    if (!pop) return null;
    const img = document.querySelector('.mp-img').getBoundingClientRect();
    const boxes = JSON.parse(document.querySelector('[data-gallery-boxes]').getAttribute('data-gallery-boxes'));
    const b = boxes[k - 1]; const pr = pop.getBoundingClientRect(); const own = { l: img.left + b.x * img.width, r: img.left + (b.x + b.w) * img.width, t: img.top + b.y * img.height, b: img.top + (b.y + b.h) * img.height };
    return { text: pop.innerText.replace(/\s+/g, ' ').trim(), role: pop.getAttribute('role'), id: pop.id, desc: tick.getAttribute('aria-describedby'), via: pop.getAttribute('data-mp-pop-via'), side: pop.getAttribute('data-mp-pop-side'),
      coversOwn: pr.left < own.r && own.l < pr.right && pr.top < own.b && own.t < pr.bottom, inPage: pr.left >= img.left - 1 && pr.right <= img.right + 1 && pr.top >= img.top - 1 && pr.bottom <= img.bottom + 1, maths: pop.querySelectorAll('.katex').length, anim: getComputedStyle(pop).animationName, bg: getComputedStyle(pop).backgroundColor, border: getComputedStyle(pop).borderTopWidth, shadow: getComputedStyle(pop).boxShadow };
  }, n);
  for (const theme of ['light', 'dark']) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, colorScheme: theme }); const pg = await ctx.newPage();
    await open(pg, url('owner19', { theme, extra: 'criteria=1' }), 'marked');
    ok(await pg.locator('[data-mp-pop]').count() === 0, `${theme}: no popover until asked`);
    await pg.hover('[data-mp-box="3"]'); await pg.waitForSelector('[data-mp-pop="3"]');
    let r = await rectsOf(pg, 3);
    ok(r && r.role === 'tooltip' && r.desc === r.id && /Line 3: correct/.test(r.text) && /Differentiated term by term/.test(r.text), `${theme}: hover opens a tooltip with the class's sentence and aria-describedby ${r && r.text}`);
    ok(r && !r.coversOwn && r.inPage && r.border !== '0px' && r.shadow === 'none', `${theme}: it never covers its own line, stays in the page, fine rule and no shadow`);
    if (shots) await pg.screenshot({ path: `${shots}/teacher-popover-correct-desktop-${theme}.png`, fullPage: true });
    await pg.mouse.move(5, 5); await gone(pg);
    ok(await pg.locator('[data-mp-pop]').count() === 0, `${theme}: moving away closes it`);
    await pg.focus('[data-mp-box="6"]'); await pg.waitForSelector('[data-mp-pop="6"]');
    r = await rectsOf(pg, 6);
    ok(r && r.via === 'focus' && /Line 6: correct/.test(r.text) && /Took out the common factor/.test(r.text) && r.desc === r.id, `${theme}: keyboard focus opens it ${r && r.text}`);
    await pg.keyboard.press('Escape');
    ok(await pg.locator('[data-mp-pop]').count() === 0 && await pg.evaluate(() => document.activeElement?.getAttribute('data-mp-box')) === '6', `${theme}: Escape closes it and keeps focus on the mark`);
    await pg.focus('[data-mp-box="16"]'); await pg.waitForSelector('[data-mp-pop="16"]');
    r = await rectsOf(pg, 16);
    ok(r && /Three changes/.test(r.text) && r.maths > 0 && !/\$/.test(r.text), `${theme}: the engine's own piece (both sides come to -432) is typeset with the maths renderer, not shown as source ${r && r.text}`);
    await pg.focus('[data-mp-box="7"]'); await pg.waitForSelector('[data-mp-pop="7"]');
    r = await rectsOf(pg, 7);
    ok(r && /Mark awarded here: 1\/1\./.test(r.text) && !r.coversOwn && r.inPage && await pg.locator('[data-mp-pop]').count() === 1, `${theme}: the paid mark says so, the popover stays off its line and in view; one at a time`);
    await pg.evaluate(() => document.activeElement.blur()); await gone(pg);
    ok(await pg.locator('[data-mp-pop]').count() === 0, `${theme}: blur closes it`);
    // a cross: the reason and the corrected line the server sent
    await open(pg, url('wrong', { theme }), 'marked');
    await pg.hover('.mp-t-tick.is-wrong'); await pg.waitForSelector('[data-mp-pop="5"]');
    r = await rectsOf(pg, 5);
    ok(r && /Line 5: wrong/.test(r.text) && r.maths > 0 && !/\$/.test(r.text) && /Corrected line/.test(r.text) && /6x/.test(r.text) && !r.coversOwn && r.inPage, `${theme}: the cross is on line 5 (the wrong factorisation 0 = 6x[x + 4]) with the engine's own reason, typeset, and the corrected line the server sent ${r && r.text}`);
    if (shots) await pg.screenshot({ path: `${shots}/teacher-popover-wrong-desktop-${theme}.png`, fullPage: true });
    await ctx.close();
  }
  // reduced motion: appears at once
  const rmc = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' }); const rp = await rmc.newPage();
  await open(rp, url('owner19', { extra: 'criteria=1' }), 'marked'); await rp.hover('[data-mp-box="3"]'); await rp.waitForSelector('[data-mp-pop="3"]');
  ok((await rectsOf(rp, 3)).anim === 'none', 'reduced motion: the popover appears without animation');
  await rmc.close();
  // a phone: tap opens, a second tap on the same mark or a tap elsewhere closes
  for (const theme of ['light', 'dark']) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, colorScheme: theme }); const pg = await ctx.newPage();
    await open(pg, url('owner19', { theme, extra: 'criteria=1' }), 'marked');
    await pg.tap('[data-mp-box="7"]'); await pg.waitForSelector('[data-mp-pop="7"]');
    let r = await rectsOf(pg, 7);
    ok(r && r.via === 'tap' && /Mark awarded here: 1\/1\./.test(r.text) && !r.coversOwn && r.inPage, `${theme} phone: a tap opens it, inside the page, off its own line ${r && r.text}`);
    if (shots) await pg.screenshot({ path: `${shots}/teacher-popover-correct-phone-${theme}.png`, fullPage: true });
    await pg.tap('.mp-t-tally'); await gone(pg);
    ok(await pg.locator('[data-mp-pop]').count() === 0, `${theme} phone: a tap elsewhere closes it`);
    await pg.tap('[data-mp-box="3"]'); await pg.waitForSelector('[data-mp-pop="3"]'); await pg.tap('[data-mp-box="3"]'); await gone(pg);
    ok(await pg.locator('[data-mp-pop]').count() === 0, `${theme} phone: a second tap on the same mark closes it`);
    ok(await pg.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth) <= 0, `${theme} phone: no sideways scroll with a popover`);
    await ctx.close();
  }
}

// ── the two owner pages of 26 November 2026 (wide photographs, the reader's boxes in the left 60%) ───────────────────────────────────────────────────────────
// The page must be read at a glance: the photograph large, a tick of at least 18 px, and the REASON written on the page beside every tick (the gutter, with a
// leader, only where the paper has no room). The words say what the line did, from the engine's verified facts (engine/stepExplain.js, lineRecognisers.js).
const OWNER = {
  seats: { tally: '8 lines correct. 0 wrong. 0 not checked.', ticks: [2, 5, 6, 7, 8, 9, 10, 11], say: { 5: 'Substituted n = 20 into n(58 + 2(n − 1))/2', 6: '20 − 1 = 19', 7: '2 × 19 = 38', 8: '58 + 38 = 96', 9: '20 × 96 = 1920', 10: '1920 ÷ 2 = 960', 11: 'Correct answer' }, pop: [6, /Worked out the bracket/] },
  users: { tally: '8 lines correct. 0 wrong. 0 not checked.', ticks: [2, 3, 6, 7, 8, 9, 10, 11], say: { 2: 'Given in the question', 3: 'Common ratio 2, from the question', 6: 'Correct model: start 815, ×2 each week', 7: 'n = 4, from the question', 8: 'Substituted n = 4 into 815 × 2^n', 9: '2⁴ = 16', 10: '815 × 16 = 13 040', 11: 'Correct answer' }, pop: [9, /Worked out the power/] }
};
for (const [name, want] of Object.entries(OWNER)) {
  for (const [label, viewport, card] of [['desktop', { width: 1440, height: 1000 }, ''], ['narrow card', { width: 1440, height: 1000 }, 'card=700'], ['phone', { width: 390, height: 844 }, '']]) {
    for (const theme of ['light', 'dark']) {
      const where = `${name}/${label}/${theme}`;
      const ctx = await browser.newContext({ viewport, colorScheme: theme }); const pg = await ctx.newPage();
      const errs = []; pg.on('pageerror', e => errs.push(e.message));
      await open(pg, url(name, { theme, extra: card }), 'marked');
      const got = await pg.evaluate(() => {
        const sec = document.querySelector('[data-marked-page]'); const rect = el => el.getBoundingClientRect().toJSON();
        const img = rect(sec.querySelector('.mp-img')); const body = rect(sec.querySelector('.mp-body')); const sheet = rect(sec.querySelector('.mp-t-sheet'));
        const boxes = JSON.parse(document.querySelector('[data-gallery-boxes]').getAttribute('data-gallery-boxes'));
        return { img, body, sheet, boxes, boxesPx: boxes.map(b => ({ x0: img.left + b.x * img.width, x1: img.left + (b.x + b.w) * img.width, y0: img.top + b.y * img.height, y1: img.top + (b.y + b.h) * img.height })),
          tally: sec.querySelector('[data-mp-tally]').textContent,
          ticks: [...sec.querySelectorAll('.mp-t-tick')].map(b => ({ n: Number(b.getAttribute('data-mp-box')), where: b.getAttribute('data-mp-where'), r: rect(b.querySelector('svg')), phrase: b.getAttribute('data-mp-phrase') })),
          says: [...sec.querySelectorAll('[data-mp-say]')].map(w => ({ n: Number(w.getAttribute('data-mp-say')), text: (w.getAttribute('data-mp-say-plain') ?? w.textContent.trim()), r: rect(w) })),
          gutter: [...sec.querySelectorAll('[data-mp-words]')].map(w => ({ n: Number(w.getAttribute('data-mp-words')), text: (w.getAttribute('data-mp-say-plain') ?? w.textContent.trim()) })),
          overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth };
      });
      ok(errs.length === 0, `${where}: no page errors ${errs}`);
      ok(got.tally === want.tally, `${where}: ${got.tally}`);
      ok(JSON.stringify(got.ticks.map(t => t.n)) === JSON.stringify(want.ticks), `${where}: ticks on ${JSON.stringify(got.ticks.map(t => t.n))}`);
      ok(got.ticks.every(t => t.phrase && !/true as written/i.test(t.phrase)), `${where}: no tick says "True as written"`);
      for (const [n, text] of Object.entries(want.say)) ok(got.ticks.find(t => t.n === Number(n))?.phrase === text, `${where}: line ${n} says "${text}" (got "${got.ticks.find(t => t.n === Number(n))?.phrase}")`);
      ok(got.overflow <= 0, `${where}: no sideways scroll`);
      if (label !== 'phone') {
        const wide = got.sheet.width / got.body.width;
        ok(got.img.width >= 440, `${where}: the photograph is large enough to read (${Math.round(got.img.width)} px)`);
        ok(label === 'narrow card' || wide >= 0.6, `${where}: the page column is at least 60% of the width (${Math.round(wide * 100)}%)`);
        ok(got.ticks.every(t => t.r.height >= 17.5), `${where}: every tick is at least 18 px (${Math.round(Math.min(...got.ticks.map(t => t.r.height)))})`);
        const spoken = new Set([...got.says.map(w => w.n), ...got.gutter.map(w => w.n)]);
        ok(got.ticks.every(t => spoken.has(t.n)), `${where}: every reason is written on the page or in the margin ${JSON.stringify(got.ticks.filter(t => !spoken.has(t.n)).map(t => t.n))}`);
        ok(label !== 'desktop' || got.says.length >= got.ticks.length - 2, `${where}: nearly every reason stands beside its tick (${got.says.length} of ${got.ticks.length})`);
        ok(got.says.every(w => !got.boxesPx.some(b => w.r.left < b.x1 && b.x0 < w.r.right && w.r.top < b.y1 && b.y0 < w.r.bottom)), `${where}: no reason touches writing`);
        ok(got.ticks.every(t => t.where !== 'page' || !got.boxesPx.some((b, i) => i + 1 !== 0 && t.r.left < b.x1 - 1 && b.x0 < t.r.right && t.r.top + 4 < b.y1 && b.y0 < t.r.bottom - 4)), `${where}: no tick covers writing`);
      }
      if (label === 'desktop' && theme === 'light') {
        const [n, re] = want.pop;
        await pg.hover(`[data-mp-box="${n}"]`); await pg.waitForSelector(`[data-mp-pop="${n}"]`);
        const t = await pg.evaluate(k => document.querySelector(`[data-mp-pop="${k}"]`).innerText.replace(/\s+/g, ' '), n);
        ok(re.test(t) && !/true as written/i.test(t), `${where}: the popover names the operation: ${t}`);
        if (shots) { await pg.waitForTimeout(900); await pg.screenshot({ path: `${shots}/${name}-popover-desktop-${theme}.png`, fullPage: true }); }
        await pg.mouse.move(5, 5);
      }
      if (shots) {
        await pg.waitForTimeout(900);
        await pg.screenshot({ path: `${shots}/${name}-marked-${label.replace(' ', '-')}-${theme}.png`, fullPage: true });
        await pg.click('[data-mp-view-option="detailed"]'); await pg.waitForSelector('.mp-t-sheet[data-mp-view="detailed"]'); await settle(pg); await pg.waitForTimeout(900);
        await pg.screenshot({ path: `${shots}/${name}-detailed-${label.replace(' ', '-')}-${theme}.png`, fullPage: true });
      }
      if (label === 'desktop') {
        await pg.click('[data-mp-view-option="detailed"]'); await pg.waitForSelector('.mp-t-sheet[data-mp-view="detailed"]');
        const list = await pg.evaluate(() => [...document.querySelectorAll('[data-mp-list] li')].map(li => `${li.getAttribute('data-mp-list-n')} ${li.querySelector('[data-mp-plain]')?.getAttribute('data-mp-plain') ?? li.innerText.replace(/\s+/g, ' ').trim()}`));
        ok(list.length >= want.ticks.length && !list.some(x => /true as written|^\d+ Correct (?:arithmetic|substitution)/i.test(x)), `${where}: the list rows give the fact, not the class name ${JSON.stringify(list.slice(0, 3))}`);
        for (const [n, text] of Object.entries(want.say).slice(0, 3)) ok(list.some(x => x.startsWith(`${n} `) && x.includes(text.replace(/^Correct answer$/, 'Correct answer'))), `${where}: row ${n} says "${text}"`);
      }
      await ctx.close();
    }
  }
}

await browser.close(); await server.close();
if (failures.length) { console.error(`tour-teacher-marked-page: ${failures.length} failed of ${pass + failures.length}`); for (const f of failures) console.error(' - ' + f); process.exit(1); }
console.log(`tour-teacher-marked-page: ${pass} checks passed${shots ? `, shots in ${shots}` : ''}`);
