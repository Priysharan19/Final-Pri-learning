// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the stats diagram pack in a real browser (Chromium)
//
// client/test/support/diagram-stats-gallery.jsx draws every stats kind through the
// app's own Vite pipeline. This drives it as a student would:
//   LAYOUT    at 375 px nothing scrolls sideways; svgs and labels stay inside their
//             figures; numeric labels are KaTeX; no two labels in one figure overlap;
//   SIMULATOR +1/+10/+100/+1000 add trials, the live region states the relative
//             frequency beside the theoretical probability, Reset starts again, and
//             the same seed gives the same counts after a reload;
//   KEYBOARD  the binomial and data sliders move with arrow keys and the readouts
//             follow (the measures that change are named);
//   THEME     light and dark: label text ≥ 4.5 : 1, bars and lines ≥ 3 : 1;
//   MOTION    reduced motion: every bar transition is 0 s;
//   TARGETS   buttons and sliders ≥ 44 px; keyboard focus is visible.
//   node client/test/diagram-pack-stats-browser-check.mjs   (STATS_SHOTS=<dir> saves screenshots)
// ─────────────────────────────────────────────────────────────────────────────
import { chromium } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { realpathSync } from 'node:fs';
import { join } from 'node:path';
import { createServer } from 'vite';

const CLIENT = fileURLToPath(new URL('..', import.meta.url));
let pass = 0;
const failures = [];
const ok = (cond, label) => { if (cond) pass++; else failures.push(label); };

const server = await createServer({
  root: CLIENT, configFile: fileURLToPath(new URL('../vite.config.js', import.meta.url)), logLevel: 'error',
  // A worktree may borrow node_modules by symlink: KaTeX's fonts are then served from its real path.
  server: { host: '127.0.0.1', port: 0, strictPort: false, hmr: false, watch: null, proxy: undefined, fs: { allow: [CLIENT, realpathSync(join(CLIENT, 'node_modules'))] } },
  optimizeDeps: { entries: ['test/support/diagram-stats-gallery.html'] }
});
await server.listen();
const URL_ = `http://127.0.0.1:${server.httpServer.address().port}/test/support/diagram-stats-gallery.html`;
const shots = process.env.STATS_SHOTS || null;

const browser = await chromium.launch();
try {
  const context = await browser.newContext({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 2 });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(URL_, { waitUntil: 'networkidle' });
  await page.waitForSelector('[data-case="interactive-4"] svg', { timeout: 30000 });
  ok(errors.length === 0, `no console or page errors (${errors.slice(0, 2).join(' | ')})`);
  if (shots) for (const el of await page.locator('[data-case]').all()) await el.screenshot({ path: `${shots}/${await el.getAttribute('data-case')}.png` });

  // ── Layout ─────────────────────────────────────────────────────────────────
  const layout = await page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const out = { vw, scrollW: document.documentElement.scrollWidth, svgs: 0, wide: [], spill: [], overlaps: [], plainNumbers: 0, errors: document.querySelectorAll('.katex-error').length };
    for (const svg of document.querySelectorAll('.dg svg')) {
      out.svgs += 1;
      const r = svg.getBoundingClientRect();
      const name = svg.closest('[data-case]')?.dataset.case;
      if (r.right > vw + 0.5 || r.left < -0.5) out.wide.push(name);
      const boxes = [];
      for (const lab of svg.querySelectorAll('.dg-tex-in')) {
        const span = lab.firstElementChild; if (!span) continue;
        const range = document.createRange(); range.selectNodeContents(span);
        const b = range.getBoundingClientRect();
        if (!b.width) continue;
        if (b.right > r.right + 6 || b.left < r.left - 6 || b.bottom > r.bottom + 6 || b.top < r.top - 6) out.spill.push(`${name}:${lab.textContent.slice(0, 16)}`);
        if (/^[\d.\-−]+$/.test(lab.textContent.trim()) && !lab.querySelector('.katex')) out.plainNumbers += 1;
        boxes.push({ b, t: lab.textContent.slice(0, 12) });
      }
      for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i].b; const c = boxes[j].b;
        const ix = Math.min(a.right, c.right) - Math.max(a.left, c.left); const iy = Math.min(a.bottom, c.bottom) - Math.max(a.top, c.top);
        if (ix > 1.5 && iy > 1.5) out.overlaps.push(`${name}: "${boxes[i].t}" × "${boxes[j].t}"`);
      }
    }
    return out;
  });
  ok(layout.scrollW <= layout.vw + 1, `the page does not scroll sideways at ${layout.vw} px (scroll width ${layout.scrollW})`);
  ok(layout.svgs === 17, `every case is drawn (${layout.svgs} figures)`);
  ok(layout.wide.length === 0, `no svg runs past the phone's edge (${layout.wide.join(',')})`);
  ok(layout.spill.length === 0, `no label spills out of its figure (${layout.spill.slice(0, 6).join(' ')})`);
  ok(layout.overlaps.length === 0, `no two labels in a figure overlap (${layout.overlaps.slice(0, 6).join('; ')})`);
  ok(layout.plainNumbers === 0 && layout.errors === 0, `numbers are KaTeX and none fails (${layout.plainNumbers} plain, ${layout.errors} errors)`);

  // ── The simulator ──────────────────────────────────────────────────────────
  const T = page.locator('[data-case="interactive-1"]');
  const status = () => T.locator('[role="status"]').innerText();
  ok(/No trials yet/.test(await status()), 'the two-dice simulator starts with no trials');
  await T.getByRole('button', { name: 'Add 1 trial' }).click();
  await T.getByRole('button', { name: 'Add 10 trials' }).click();
  await T.getByRole('button', { name: 'Add 100 trials' }).click();
  await T.getByRole('button', { name: 'Add 1000 trials' }).click();
  const after = await status();
  ok(/After 1111 trials the event happened \d+ times/.test(after) && /relative frequency/.test(after) && /theoretical probability/.test(after), `after 1 + 10 + 100 + 1000 trials the live region states both numbers (${after.slice(0, 120)})`);
  const desc1 = await T.locator('desc').textContent();
  await page.reload({ waitUntil: 'networkidle' });
  await T.locator('svg').first().waitFor();
  for (const name of ['Add 1 trial', 'Add 10 trials', 'Add 100 trials', 'Add 1000 trials']) await T.getByRole('button', { name }).click();
  ok(await T.locator('desc').textContent() === desc1, 'the same seed gives the same counts after a reload');
  const heights = await T.locator('rect.dgs-freq').evaluateAll(rs => rs.map(r => Number(r.getAttribute('height'))));
  ok(heights.length === 11 && heights[5] === Math.max(...heights), `the sum 7 has the tallest bar after 1111 throws (${heights.map(h => Math.round(h)).join(',')})`);
  await T.getByRole('button', { name: 'Reset' }).click();
  ok(/No trials yet/.test(await status()), 'Reset starts the experiment again');
  const D = page.locator('[data-case="interactive-2"]');
  for (let i = 0; i < 10; i++) await D.getByRole('button', { name: 'Add 1000 trials' }).click();
  const dieWords = await D.locator('[role="status"]').innerText();
  const worst = Number((/relative frequency\s*([\d.]+)/.exec(dieWords) || [])[1]);
  ok(Math.abs(worst - 1 / 6) < 0.02, `after 10 000 die rolls even the furthest face is within 0.02 of 1/6 (${worst})`);

  // ── Keyboard: binomial and data explorers ──────────────────────────────────
  const B = page.locator('[data-case="interactive-0"]');
  const nSlider = B.locator('input[type="range"]').first();
  await nSlider.focus();
  await page.keyboard.press('ArrowRight');
  ok(await nSlider.inputValue() === '11' && /B\(11/.test(await B.locator('[role="status"]').textContent()), 'ArrowRight on n moves it to 11 and the readout follows');
  await B.getByRole('button', { name: 'P(X = k)' }).click();
  ok(/P\(X=8\)/.test(await B.locator('[role="status"]').textContent()), 'the P(X = k) button switches the event');
  const X = page.locator('[data-case="interactive-4"]');
  const v = X.locator('input[type="range"]').first();
  await v.focus();
  await page.keyboard.press('End');
  const moved = await X.locator('[role="status"]').innerText();
  ok(/mean 5\.8571 → /.test(moved) && /range 8 → /.test(moved) && /Unchanged: median 5/.test(moved), `moving the largest value to the end changes the mean and range, not the median (${moved.slice(0, 140)})`);
  await X.getByRole('button', { name: 'Reset' }).click();
  ok(await v.inputValue() === '10', 'Reset puts the value back');

  // ── Targets, focus ─────────────────────────────────────────────────────────
  const small = await page.evaluate(() => [...document.querySelectorAll('.dgi button, .dgi input[type="range"]')].filter(e => e.getBoundingClientRect().height < 43.5).length);
  ok(small === 0, `every button and slider is at least 44 px tall (${small} are not)`);
  await T.getByRole('button', { name: 'Add 1 trial' }).focus();
  await page.keyboard.press('Tab');
  const outline = await page.evaluate(() => { const cs = getComputedStyle(document.activeElement); return { style: cs.outlineStyle, width: parseFloat(cs.outlineWidth) }; });
  ok(outline.style !== 'none' && outline.width >= 2, `keyboard focus is visible (${outline.style} ${outline.width}px)`);

  // ── Theme ──────────────────────────────────────────────────────────────────
  const contrast = theme => page.evaluate(t => {
    document.documentElement.setAttribute('data-theme', t);
    const parse = c => { const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(c); return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null; };
    const lum = ([r, g, b]) => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
    const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)]; return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
    const bg = parse(getComputedStyle(document.querySelector('main')).backgroundColor);
    const worst = { text: 99, stroke: 99 };
    for (const el of document.querySelectorAll('.dg-tex-in')) { const c = parse(getComputedStyle(el).color); if (c && bg) worst.text = Math.min(worst.text, ratio(c, bg)); }
    for (const sel of ['.dg-bar', '.dgs-bar-hl', '.dgs-theory', '.dgs-mean', '.dgs-mark.is-mean', '.dgs-mark.is-median', '.dgs-dot-edit', '.dgs-lane-line', '.dgs-hl-box']) {
      const el = document.querySelector(sel); if (!el) continue;
      const c = parse(getComputedStyle(el).stroke); if (c && bg) worst.stroke = Math.min(worst.stroke, ratio(c, bg));
    }
    return { bg, ...worst };
  }, theme);
  const light = await contrast('light'); const dark = await contrast('dark');
  ok(light.text >= 4.5 && dark.text >= 4.5, `label text ≥ 4.5 : 1 (light ${light.text.toFixed(2)}, dark ${dark.text.toFixed(2)})`);
  ok(light.stroke >= 3 && dark.stroke >= 3, `bars and lines ≥ 3 : 1 (light ${light.stroke.toFixed(2)}, dark ${dark.stroke.toFixed(2)})`);
  ok(JSON.stringify(light.bg) !== JSON.stringify(dark.bg), 'the theme really flips');
  if (shots) for (const el of await page.locator('[data-case]').all()) await el.screenshot({ path: `${shots}/dark-${await el.getAttribute('data-case')}.png` });
  await page.evaluate(() => document.documentElement.removeAttribute('data-theme'));

  // ── Reduced motion ─────────────────────────────────────────────────────────
  const motion = async mode => {
    const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, reducedMotion: mode });
    const p = await ctx.newPage();
    await p.goto(URL_, { waitUntil: 'networkidle' });
    await p.waitForSelector('[data-case="interactive-0"] .dg-bar');
    const r = await p.evaluate(() => [...document.querySelectorAll('.dgi .dg-bar, .dgi .dgs-hatch')].map(el => getComputedStyle(el).transitionDuration));
    await ctx.close();
    return r;
  };
  const reduced = await motion('reduce'); const normal = await motion('no-preference');
  ok(reduced.length > 0 && reduced.every(d => d.split(',').every(x => parseFloat(x) === 0)), 'with reduced motion no bar animates');
  ok(normal.some(d => d.split(',').some(x => parseFloat(x) > 0)), 'without it the short bar transition exists');
} finally {
  await browser.close();
  await server.close();
}

if (failures.length) {
  console.error(`DIAGRAM PACK STATS (browser): FAIL — ${failures.length} of ${pass + failures.length} checks failed`);
  for (const f of failures.slice(0, 40)) console.error(`  · ${f}`);
  process.exit(1);
}
console.log(`DIAGRAM PACK STATS (browser): PASS — ${pass}/${pass} checks — at 375 px nothing overflows or overlaps, the simulator is reproducible and announced, sliders work by keyboard, both themes keep contrast, reduced motion is honoured`);
