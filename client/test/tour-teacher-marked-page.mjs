// The teacher-marked page, driven in a real browser (Prithagoras edition). WHAT IS REAL: the MarkedPage component, its styles and the bundled
// handwriting face; the engine's verdicts on the stationary-points and "crossed" cases. WHAT IS SYNTHETIC, and labelled so: the 19-line
// stationary-points page (a canvas drawing with fixture line boxes, two columns in the middle), the fixture report classes and the fixture criteria.
// No photograph of a person, no real student, no real reader, no device.
//   node client/test/tour-teacher-marked-page.mjs [--shots=<dir>]
import { chromium } from '@playwright/test';
import { mkdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const CLIENT = fileURLToPath(new URL('..', import.meta.url));
const shots = (process.argv.find(a => a.startsWith('--shots=')) || '').slice(8);
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
const open = async (page, u, view = 'marked') => {
  await page.goto(u, { waitUntil: 'networkidle' });
  await page.evaluate(v => { try { localStorage.setItem('pri.markedPage.view', v); } catch { /* none */ } }, view);
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector('[data-marked-page]');
  await page.waitForTimeout(700);
};
const lum = hex => { const c = hex.match(/\w\w/g).map(h => parseInt(h, 16) / 255).map(v => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
const contrast = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const hexOf = rgb => '#' + rgb.match(/\d+/g).slice(0, 3).map(n => Number(n).toString(16).padStart(2, '0')).join('');
const CHECKED = [2, 3, 5, 6, 7, 8, 14, 15, 16, 19];          // the fixture lines the engine ticks
const UNCHECKED = [1, 4, 9, 10, 11, 12, 13, 17, 18];         // conditions and lines it could not verify: no tick, no cross

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
      const ticks = [...sec.querySelectorAll('.mp-t-tick')].map(b => ({ n: Number(b.getAttribute('data-mp-box')), label: b.getAttribute('aria-label'), where: b.getAttribute('data-mp-where'), r: rect(b.querySelector('svg')), tag: b.tagName }));
      return {
        img, boxes, ticks, boxesPx: boxes.map(b => ({ x0: img.left + b.x * img.width, x1: img.left + (b.x + b.w) * img.width, y0: img.top + b.y * img.height, y1: img.top + (b.y + b.h) * img.height })),
        markBoxes: [...sec.querySelectorAll('[data-mp-markbox]')].map(b => ({ n: b.getAttribute('data-mp-markbox'), text: b.textContent.trim(), label: b.getAttribute('aria-label') })),
        words: [...sec.querySelectorAll('[data-mp-words]')].map(w => ({ n: w.getAttribute('data-mp-words'), text: w.textContent.trim(), font: getComputedStyle(w).fontFamily })),
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
    ok(/Line 3: correct\. Correct differentiation\./.test(got.ticks.find(t => t.n === 3).label), `${where}: the label names the class: ${got.ticks.find(t => t.n === 3).label}`);
    ok(!got.ticks.some(t => UNCHECKED.includes(t.n)), `${where}: no tick and no cross on a line the engine could not verify`);
    // exactly one margin box, on the line that earned the mark, and it says what the server awarded
    ok(got.markBoxes.length === 1 && got.markBoxes[0].text === '1/1' && got.markBoxes[0].n === '19', `${where}: one margin mark, 1/1, on line 19 ${JSON.stringify(got.markBoxes)}`);
    ok(/Line 19: 1 mark awarded/.test(got.markBoxes[0].label), `${where}: the margin mark has a text alternative`);
    // no tick sits on the student's writing
    const onInk = got.ticks.filter(t => t.where === 'page').filter(t => got.boxesPx.some(b => t.r.left < b.x1 && b.x0 < t.r.right && t.r.top < b.y1 && b.y0 < t.r.bottom));
    ok(onInk.length === 0, `${where}: no tick covers a line of writing ${JSON.stringify(onInk.map(t => t.n))}`);
    ok(got.ticks.find(t => t.n === 8).where === 'gutter', `${where}: line 8's tick would land on the second column, so it stands in the gutter`);
    ok(got.ticks.filter(t => t.n !== 8).every(t => t.where === 'page'), `${where}: the others stand at the end of their lines`);
    if (size === 'desktop') {
      const pg = got.ticks.filter(t => t.where === 'page');
      ok(pg.every((a, i) => pg.every((b, j) => i === j || !(a.r.left < b.r.right && b.r.left < a.r.right && a.r.top < b.r.bottom && b.r.top < a.r.bottom))), `${where}: no two ticks overlap`);
      ok(got.sheetAttr === 'roomy' && got.words.some(w => w.n === '19' && w.text === 'Correct solutions' && /Pri Hand/.test(w.font)), `${where}: a few short handwritten words stand in the margin, in the bundled face ${JSON.stringify(got.words)}`);
    }
    ok(got.words.length <= 3, `${where}: only a few words at most (${got.words.length})`);
    ok(got.fontOk, `${where}: the bundled handwriting face loads`);
    ok(got.tally === '10 lines correct. 0 wrong. 9 not checked.' || /^10 lines correct\. 0 wrong\. \d+ not checked\.$/.test(got.tally), `${where}: the tally counts maths lines only: ${got.tally}`);
    ok(got.figure === '1/1' && got.stateWord === 'Fully correct', `${where}: the server's mark and its one-word state ${got.figure} ${got.stateWord}`);
    ok(/Assessment . Attempt 01/i.test(got.assess) && /Marked/i.test(got.assess), `${where}: the assessment line: ${got.assess}`);
    ok(got.rows.length === 1 && /States the larger x-coordinate/.test(got.rows[0]) && /1\/1/.test(got.rows[0]) && /Line 19 gives 6/.test(got.rows[0]), `${where}: one mark-allocation row for the one real criterion ${JSON.stringify(got.rows)}`);
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
    ok(JSON.stringify(await page.locator('[data-mp-markbox]').evaluateAll(es => es.map(e => e.getAttribute('data-mp-markbox')))) === '["3","7","19"]', `${where}: three criteria, three margin marks, each on its own line`);
    await open(page, url('owner19', { theme }));
    ok(await page.locator('[data-mp-markbox]').count() === 0, `${where}: no approved criteria, no margin mark and no allocation rows (nothing invented)`);
    ok(await page.locator('[data-mp-row]').count() === 0, `${where}: no invented rows`);

    // the cross
    await open(page, url('crossed', { theme }), 'marked');
    const cross = await page.evaluate(() => {
      const b = document.querySelector('.mp-t-tick.is-wrong');
      return { n: b?.getAttribute('data-mp-box'), label: b?.getAttribute('aria-label'), color: b && getComputedStyle(b.querySelector('svg')).color, under: document.querySelectorAll('[data-mp-under]').length,
        words: [...document.querySelectorAll('[data-mp-words]')].map(w => w.textContent.trim()), ticks: document.querySelectorAll('.mp-t-tick.is-right').length,
        none: ['5', '6', '7'].every(n => !document.querySelector(`[data-mp-box="${n}"]`)) };
    });
    ok(cross.n === '9' && /^Line 9: wrong\. /.test(cross.label) && cross.under === 1 && cross.ticks === 4 && cross.none, `${where}: one cross on the first wrong line, with its underline; none on unverified lines ${JSON.stringify(cross)}`);
    if (size === 'desktop') ok(cross.words.length === 1 && /does not follow from the one above/.test(cross.words[0]), `${where}: the cross says why, in the engine's fixed words ${cross.words}`);
    ok(contrast(hexOf(cross.color), theme === 'light' ? '#f8f7f3' : '#1d1d1b') >= 4.5, `${where}: the cross is red enough to read`);
    if (shots) {
      for (const v of ['marked', 'detailed', 'original']) {
        await open(page, url('owner19', { theme, extra: 'criteria=3' }), v);
        await page.screenshot({ path: `${shots}/teacher-marked-${v}-${size}-${theme}.png`, fullPage: true });
      }
      await open(page, url('crossed', { theme }), 'detailed');
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
  await page.reload({ waitUntil: 'networkidle' }); await page.waitForSelector('[data-marked-page]');
  ok(await page.locator('[data-mp-view-option="original"]').getAttribute('aria-checked') === 'true', 'the choice is remembered');
  await page.locator('[data-mp-view-option="original"]').focus(); await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowRight');
  ok(await page.locator('[data-mp-view-option="detailed"]').getAttribute('aria-checked') === 'true', 'arrow keys move between the views');

  // Detailed: steps are keyboard reachable, name the step with its mark and one sentence, and trace to the page
  ok(await page.locator('[data-mp-chip]').count() === 3, 'one step chip per real criterion');
  await page.locator('[data-mp-chip="stationary"]').focus(); await page.keyboard.press('Enter');
  const step = await page.locator('[data-mp-stepdetail]').innerText();
  ok(/Finds the stationary values/.test(step) && /1\/1 mark/.test(step) && /Line 7 gives x = 0 or x = 6/.test(step), `a step shows its name, mark and why: ${step.replace(/\s+/g, ' ')}`);
  ok(await page.locator('[data-mp-trace="7"]').count() === 1 && await page.locator('[data-mp-trace]').count() === 1, 'the step lights the line that earned it, and only it');
  ok(await page.locator('[data-mp-markbox="7"].is-traced').count() === 1, 'and its margin mark');
  await page.locator('[data-mp-chip="stationary"]').click();
  ok(await page.locator('[data-mp-trace]').count() === 0, 'choosing the step again clears it');
  await page.locator('[data-mp-row="answer"]').click();
  ok(await page.locator('[data-mp-trace="19"]').count() === 1, 'a mark-allocation row lights its line on the page');
  await page.locator('[data-mp-box="3"]').click();
  ok(await page.locator('[data-mp-row="derivative"].is-traced').count() === 1 && await page.locator('[data-mp-row="answer"].is-traced').count() === 0, 'a tick lights the row it earned, and only that row');
  await page.keyboard.press('Tab');
  ok(await page.evaluate(() => !!document.activeElement), 'keyboard focus moves on');
  const list = await page.locator('[data-mp-list] li').count();
  ok(list === 10, `Detailed feedback lists every mark in words (${list})`);
  await ctx.close();

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
  await ph.goto(url('stationary', { edition: 'priyabhata', teacher: false }), { waitUntil: 'networkidle' }); await ph.waitForSelector('[data-marked-page]');
  const india = await ph.evaluate(() => ({ root: document.querySelector('.mp-t-root, .mp-t-sheet, .mp-t-tick, [data-mp-views], [data-mp-tally], [data-mp-assess], [data-mp-gutter]') !== null, markers: document.querySelectorAll('.mp-marker[data-mp-box]').length, sentence: !!document.querySelector('[data-mp-counts]'), hasPhoto: document.querySelector('.mp-img') !== null || document.querySelector('.mp-ink') !== null,
    photo: document.querySelector('.mp-img')?.getAttribute('data-mp-photo') || null }));
  ok(!india.root && india.markers > 0 && india.sentence, `India: no teacher marks, the old markers and header ${JSON.stringify(india)}`);
  await hi.close();
  const src = readFileSync(new URL('../src/components/MarkedPage.jsx', import.meta.url), 'utf8');
  ok(/teacherMarks = EDITION === 'prithagoras'/.test(src), 'the teacher-marked page is on only in the Prithagoras build');
  const strings = readFileSync(new URL('../src/components/markedPageTeacher.js', import.meta.url), 'utf8') + readFileSync(new URL('../src/components/TeacherMarks.jsx', import.meta.url), 'utf8');
  ok(!/[ऀ-ॿ]/.test(strings), 'no Hindi in the new surface');
}

await browser.close(); await server.close();
if (failures.length) { console.error(`tour-teacher-marked-page: ${failures.length} failed of ${pass + failures.length}`); for (const f of failures) console.error(' - ' + f); process.exit(1); }
console.log(`tour-teacher-marked-page: ${pass} checks passed${shots ? `, shots in ${shots}` : ''}`);
