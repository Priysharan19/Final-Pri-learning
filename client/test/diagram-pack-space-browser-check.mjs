// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · diagram pack "space" in a real browser (Chromium)
//
// client/test/support/diagram-gallery-space.jsx draws every space kind through the app's
// own Vite pipeline. At phone width (375 px): no sideways scroll, every svg and every KaTeX
// label inside its figure, no two labels overlapping on screen; keyboard: range inputs move
// by their step and the live region follows with the new numbers; buttons switch modes and
// presets; 44 px targets; a visible focus outline; light and dark keep label contrast;
// reduced motion leaves no transition.
//
//   node client/test/diagram-pack-space-browser-check.mjs [--shots <dir>]
// ─────────────────────────────────────────────────────────────────────────────
import { chromium } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { realpathSync } from 'node:fs';

const CLIENT = fileURLToPath(new URL('..', import.meta.url));
const shots = process.argv.includes('--shots') ? process.argv[process.argv.indexOf('--shots') + 1] : null;
let pass = 0;
const failures = [];
const ok = (cond, label) => { if (cond) pass++; else failures.push(label); };

const server = await createServer({
  root: CLIENT, configFile: fileURLToPath(new URL('../vite.config.js', import.meta.url)), logLevel: 'error',
  // fs.allow: a worktree may borrow node_modules by symlink; its real path must be servable (KaTeX fonts).
  server: { host: '127.0.0.1', port: 0, strictPort: false, hmr: false, watch: null, proxy: undefined, fs: { allow: [fileURLToPath(new URL('../..', import.meta.url)), realpathSync(`${CLIENT}node_modules`)] } },
  optimizeDeps: { entries: ['test/support/diagram-gallery-space.html'] }
});
await server.listen();
const URL_ = `http://127.0.0.1:${server.httpServer.address().port}/test/support/diagram-gallery-space.html`;
const browser = await chromium.launch();
try {
  const context = await browser.newContext({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 2 });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('response', r => { if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });
  await page.goto(URL_, { waitUntil: 'networkidle' });
  await page.waitForSelector('[data-case="interactive-7"] svg', { timeout: 30000 });
  ok(errors.length === 0, `no console or page errors (${errors.slice(0, 2).join(' | ')})`);
  if (shots) await page.screenshot({ path: `${shots}/space-375.png`, fullPage: true });

  const layout = await page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const out = { vw, scrollW: document.documentElement.scrollWidth, svgs: 0, wide: [], labels: 0, plain: 0, spill: [], overlap: [] };
    for (const svg of document.querySelectorAll('.dg > svg')) {
      out.svgs += 1;
      const r = svg.getBoundingClientRect(); const where = svg.closest('[data-case]')?.dataset.case;
      if (r.right > vw + 0.5 || r.left < -0.5) out.wide.push(where);
      const boxes = [];
      for (const lab of svg.querySelectorAll('.dg-tex-in')) {
        out.labels += 1;
        const k = lab.querySelector('.katex'); if (!k) { out.plain += 1; continue; }
        const kr = k.getBoundingClientRect();
        if (kr.right > r.right + 4 || kr.left < r.left - 4 || kr.bottom > r.bottom + 4 || kr.top < r.top - 4) out.spill.push(`${where}:${k.textContent.slice(0, 16)}`);
        boxes.push({ t: k.textContent.slice(0, 16), l: kr.left, r: kr.right, tp: kr.top, b: kr.bottom });
      }
      for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i]; const b = boxes[j];
        if (a.l < b.r - 1 && b.l < a.r - 1 && a.tp < b.b - 1 && b.tp < a.b - 1) out.overlap.push(`${where}:${a.t}/${b.t}`);
      }
    }
    out.errors = document.querySelectorAll('.katex-error').length;
    return out;
  });
  ok(layout.scrollW <= layout.vw + 1, `no sideways scroll at ${layout.vw} px (${layout.scrollW})`);
  ok(layout.svgs === 16, `every case is drawn (${layout.svgs} figures)`);
  ok(layout.wide.length === 0, `no figure runs past the phone's edge (${layout.wide.join(',')})`);
  ok(layout.labels > 80 && layout.plain === 0 && layout.errors === 0, `every label is KaTeX (${layout.labels} labels, ${layout.plain} plain, ${layout.errors} errors)`);
  ok(layout.spill.length === 0, `no label spills out of its figure (${layout.spill.join(' ')})`);
  ok(layout.overlap.length === 0, `no two labels overlap on screen (${layout.overlap.join(' ')})`);

  // Keyboard and the live region
  // the readout as its plain words plus the TeX source of its mathematics
  const live = c => page.locator(`[data-case="${c}"] [role="status"]`).evaluate(el => { const c2 = el.cloneNode(true); for (const k of c2.querySelectorAll('.katex')) k.replaceWith(k.querySelector('annotation')?.textContent || ''); return c2.textContent; });
  const P = page.locator('[data-case="interactive-0"]');
  const theta = P.locator('input[name="theta"]');
  await theta.focus();
  ok(await theta.getAttribute('aria-valuetext') === 'π/4', 'polar: θ starts at π/4 (from 1 + i)');
  await page.keyboard.press('ArrowRight');
  ok(await theta.getAttribute('aria-valuetext') === 'π/3' && /\\tfrac\{\\pi\}\{3\}/.test(await live('interactive-0')) , `ArrowRight moves θ by π/12 to π/3, and the readout follows (${(await live('interactive-0')).slice(0, 80)})`);
  const R = page.locator('[data-case="interactive-2"] input[name="n"]');
  await R.focus(); await page.keyboard.press('ArrowRight');
  ok(await R.inputValue() === '4' && /4 roots/.test(await live('interactive-2')), 'roots: n goes to 4 and the readout says so');
  const Vx = page.locator('[data-case="interactive-3"]');
  await Vx.locator('input[name="bx"]').focus(); await page.keyboard.press('ArrowRight');
  ok(/5/.test(await live('interactive-3')) && (await Vx.locator('input[name="bx"]').inputValue()) === '2', 'vector: b moves to (2, 2) and the readout gives the new sum');
  await Vx.getByRole('button', { name: 'Dot product' }).click();
  ok((await Vx.getByRole('button', { name: 'Dot product' }).getAttribute('aria-pressed')) === 'true' && /cos/.test(await live('interactive-3')), 'the mode buttons switch to the dot product');
  await Vx.getByRole('button', { name: 'Reset' }).click();
  ok((await Vx.locator('input[name="bx"]').inputValue()) === '1', 'Reset restores the starting vectors');
  const M = page.locator('[data-case="interactive-5"]');
  await M.getByRole('button', { name: 'Reflect in y = x' }).click();
  ok(/reversed/.test(await live('interactive-5')), 'matrix: the reflection preset reverses orientation');
  const S = page.locator('[data-case="interactive-6"] input[name="h"]');
  await S.focus(); await page.keyboard.press('ArrowLeft');
  ok(/V=/.test((await page.locator('[data-case="interactive-6"] annotation').allTextContents()).join(' ')) && (await S.inputValue()) === '3.5', 'solid: the height slider moves by 0.5 and the volume is recomputed');

  const small = await page.evaluate(() => [...document.querySelectorAll('.dgi button, .dgi input[type="range"]')].filter(e => e.getBoundingClientRect().height < 43.5).length);
  ok(small === 0, `every button and slider is at least 44 px tall (${small} are not)`);
  await page.locator('[data-case="interactive-4"] input[name="ax"]').focus();
  await page.keyboard.press('Shift+Tab'); await page.keyboard.press('Tab');
  const outline = await page.evaluate(() => { const cs = getComputedStyle(document.activeElement); return { s: cs.outlineStyle, w: parseFloat(cs.outlineWidth) }; });
  ok(outline.s !== 'none' && outline.w >= 2, `keyboard focus is visible (${outline.s} ${outline.w}px)`);

  const contrast = async t => page.evaluate(theme => {
    document.documentElement.setAttribute('data-theme', theme);
    const parse = c => { const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(c); return m ? m.slice(1, 4).map(Number) : null; };
    const lum = ([r, g, b]) => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
    const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)]; return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
    const bg = parse(getComputedStyle(document.querySelector('main')).backgroundColor);
    let worst = 99; for (const el of document.querySelectorAll('.dg-tex-in')) { const c = parse(getComputedStyle(el).color); if (c && bg) worst = Math.min(worst, ratio(c, bg)); }
    let stroke = 99; for (const sel of ['.dg-axis', '.dg-vector.is-part', '.dg-vector.is-resultant', '.dg-solid']) { const el = document.querySelector(sel); const c = el && parse(getComputedStyle(el).stroke); if (c && bg) stroke = Math.min(stroke, ratio(c, bg)); }
    return { worst, stroke, bg };
  }, t);
  const light = await contrast('light'); const dark = await contrast('dark');
  if (shots) await page.screenshot({ path: `${shots}/space-375-dark.png`, fullPage: true });
  ok(light.worst >= 4.5 && dark.worst >= 4.5, `label contrast ≥ 4.5 : 1 (light ${light.worst.toFixed(2)}, dark ${dark.worst.toFixed(2)})`);
  ok(light.stroke >= 3 && dark.stroke >= 3, `stroke contrast ≥ 3 : 1 (light ${light.stroke.toFixed(2)}, dark ${dark.stroke.toFixed(2)})`);
  ok(JSON.stringify(light.bg) !== JSON.stringify(dark.bg), 'the theme really changes');

  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, reducedMotion: 'reduce' });
  const p2 = await ctx.newPage(); await p2.goto(URL_, { waitUntil: 'networkidle' }); await p2.waitForSelector('[data-case="interactive-7"] svg');
  const durations = await p2.evaluate(() => [...document.querySelectorAll('.dgi *')].map(el => getComputedStyle(el).transitionDuration).filter(d => d.split(',').some(v => parseFloat(v) > 0)));
  await ctx.close();
  ok(durations.length === 0, `with reduced motion nothing transitions (${durations.length})`);
} finally {
  await browser.close();
  await server.close();
}
if (failures.length) {
  console.error(`DIAGRAM PACK SPACE (browser): FAIL — ${failures.length} of ${pass + failures.length} checks failed`);
  for (const f of failures) console.error(`  · ${f}`);
  process.exit(1);
}
console.log(`DIAGRAM PACK SPACE (browser): PASS — ${pass}/${pass} checks — at 375 px nothing overflows and no labels collide; sliders, modes and presets work from the keyboard and are announced; contrast holds in light and dark; reduced motion is honoured`);
