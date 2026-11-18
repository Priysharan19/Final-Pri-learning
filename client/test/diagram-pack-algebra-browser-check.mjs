// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the algebra diagram pack in a real browser (Chromium)
//
// client/test/support/diagram-pack-algebra-gallery.jsx draws every algebra kind
// through the app's own Vite config. At phone width (375 px): no sideways scroll,
// every svg and KaTeX label inside its figure, no two point labels overlapping;
// keyboard and pointer change the pictures and the live regions say the new
// numbers; 44 px targets; a visible focus outline; light and dark contrast for the
// pack's strokes; reduced motion switches transitions off.
//   node client/test/diagram-pack-algebra-browser-check.mjs
// ─────────────────────────────────────────────────────────────────────────────
import { chromium } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { realpathSync } from 'node:fs';
import { createServer } from 'vite';

const CLIENT = fileURLToPath(new URL('..', import.meta.url));
let pass = 0;
const failures = [];
const ok = (cond, label) => { if (cond) pass++; else failures.push(label); };

const server = await createServer({
  root: CLIENT, configFile: fileURLToPath(new URL('../vite.config.js', import.meta.url)), logLevel: 'error',
  // node_modules may be a link to the main checkout's (a worktree); KaTeX's fonts are served from there.
  server: { host: '127.0.0.1', port: 0, strictPort: false, hmr: false, watch: null, proxy: undefined, fs: { allow: [CLIENT, realpathSync(new URL('../node_modules', import.meta.url))] } },
  optimizeDeps: { entries: ['test/support/diagram-pack-algebra-gallery.html'] }
});
await server.listen();
const URL_ = `http://127.0.0.1:${server.httpServer.address().port}/test/support/diagram-pack-algebra-gallery.html`;

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

  // ── Layout at phone width ──────────────────────────────────────────────────
  const layout = await page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const out = { vw, scrollW: document.documentElement.scrollWidth, svgs: 0, wide: [], labels: 0, plain: 0, spill: [], clash: [] };
    for (const svg of document.querySelectorAll('.dg svg')) {
      out.svgs += 1;
      const r = svg.getBoundingClientRect();
      if (r.right > vw + 0.5 || r.left < -0.5) out.wide.push(svg.closest('[data-case]')?.dataset.case);
      const boxes = [];
      for (const lab of svg.querySelectorAll('.dg-tex-in')) {
        out.labels += 1;
        const k = lab.querySelector('.katex');
        if (!k) { out.plain += 1; continue; }
        const kr = k.getBoundingClientRect();
        if (kr.right > r.right + 4 || kr.left < r.left - 4 || kr.bottom > r.bottom + 4 || kr.top < r.top - 4) out.spill.push(`${svg.closest('[data-case]')?.dataset.case}:${k.textContent.slice(0, 16)}`);
        if (!lab.closest('.dg-small')) boxes.push([kr, k.textContent]);
      }
      for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
        const [a, ta] = boxes[i]; const [b, tb] = boxes[j];
        if (a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1) out.clash.push(`${svg.closest('[data-case]')?.dataset.case}:${ta}/${tb}`);
      }
    }
    out.errors = document.querySelectorAll('.katex-error').length;
    return out;
  });
  ok(layout.scrollW <= layout.vw + 1, `no sideways scroll at ${layout.vw} px (scroll width ${layout.scrollW})`);
  ok(layout.svgs === 10, `all ten figures are drawn (${layout.svgs})`);
  ok(layout.wide.length === 0, `no svg runs past the phone's edge (${layout.wide.join(',')})`);
  ok(layout.labels > 60 && layout.plain === 0 && layout.errors === 0, `every label is KaTeX (${layout.labels} labels, ${layout.plain} plain, ${layout.errors} errors)`);
  ok(layout.spill.length === 0, `no label spills outside its figure (${layout.spill.join(' ')})`);
  ok(layout.clash.length === 0, `no two point or line labels overlap as typeset (${layout.clash.join(' ')})`);

  // ── paramGraph: keyboard moves a parameter, the words follow ───────────────
  const G = page.locator('[data-case="interactive-0"]');
  const c = G.locator('input[type="range"]').nth(2);
  await c.focus();
  for (let i = 0; i < 2; i++) await page.keyboard.press('ArrowLeft');
  ok(await c.inputValue() === '4', 'ArrowLeft moves c by its step (6 → 4)');
  let words = await G.locator('[role="status"]').innerText();
  ok(/y\s*=\s*x\s*2\s*−\s*5\s*x\s*\+\s*4|x2−5x\+4/.test(words.replace(/\s+/g, '')) || /x\^2-5x\+4/.test(await G.locator('[role="status"] annotation').first().textContent()), `the readout writes y = x^2 - 5x + 4 (${words.slice(0, 80)})`);
  const ann = (await G.locator('[role="status"] annotation').allTextContents()).join(' | ');
  ok(ann.includes('x=1') && ann.includes('x=4') && ann.includes('y=4'), `and gives the new roots 1 and 4 and intercept 4 (${ann.slice(0, 160)})`);
  const desc = await G.locator('desc').textContent();
  ok(/x = 1 and x = 4/.test(desc) && /\(2\.5, -2\.25\)/.test(desc), `the figure's description states the same numbers (${desc.slice(0, 120)})`);
  await G.getByRole('button', { name: 'Reset' }).click();
  ok(await c.inputValue() === '6', 'Reset restores c = 6');

  // ── sequenceExplorer: n slider ─────────────────────────────────────────────
  const S = page.locator('[data-case="interactive-1"]');
  const n = S.locator('input[type="range"]').nth(2);
  await n.focus(); await page.keyboard.press('End');
  ok((await S.locator('rect.dg-bar').count()) === 13, 'End on n draws 12 bars (plus the legend swatch)');
  ok(/S_\{12\}/.test((await S.locator('[role="status"] annotation').allTextContents()).join(' ')), 'and the readout gives S_12');

  // ── slopeFieldExplorer: pointer sets the starting point ────────────────────
  const F = page.locator('[data-case="interactive-2"]');
  const svg = F.locator('svg').first();
  await svg.scrollIntoViewIfNeeded();
  const box = await svg.boundingBox();
  const vb = await svg.evaluate(s => [s.viewBox.baseVal.width, s.viewBox.baseVal.height]);
  // (1, 0) in data: the frame maps x ∈ [-2, 2] to [44, width-18] and y ∈ [-1, 5] to [height-32, 16].
  const px = 44 + ((1 + 2) / 4) * (vb[0] - 62); const py = 16 + ((5 - 0) / 6) * (vb[1] - 48);
  await page.mouse.click(box.x + (px / vb[0]) * box.width, box.y + (py / vb[1]) * box.height);
  const sf = F.locator('input[type="range"]');
  ok(Number(await sf.nth(0).inputValue()) === 1 && Number(await sf.nth(1).inputValue()) === 0, `clicking the field at (1, 0) moves the start there (${await sf.nth(0).inputValue()}, ${await sf.nth(1).inputValue()})`);
  ok(/through\s*\(1,\s*0\)/.test((await F.locator('desc').textContent())), 'and the description follows');
  await sf.nth(1).focus(); await page.keyboard.press('ArrowRight');
  ok(Number(await sf.nth(1).inputValue()) > 0, 'the y0 slider moves with the keyboard');

  // ── lpExplorer: to the optimum ─────────────────────────────────────────────
  const L = page.locator('[data-case="interactive-3"]');
  await L.getByRole('button', { name: 'Move to the optimum' }).click();
  const lpWords = await L.locator('[role="status"]').innerText();
  ok(/maximum/.test(lpWords) && /approached but never reached/.test(lpWords), `the optimum (12/5, 14/5) on a strict boundary is named and not reached (${lpWords.slice(0, 140)})`);
  ok((await L.getByRole('button', { name: 'Move to the optimum' }).getAttribute('aria-pressed')) === 'true', 'the button shows it is chosen');
  const k = L.locator('input[type="range"]');
  await k.focus(); await page.keyboard.press('Home');
  ok(/only touches the region/.test(await L.locator('[role="status"]').innerText()), 'Home moves the level line back to the corner (0, 0), where it only touches the region');

  // ── numberLineStepper ──────────────────────────────────────────────────────
  const N = page.locator('[data-case="interactive-4"]');
  ok((await N.locator('path.dga-jump').count()) === 0, 'the stepper starts with no jumps drawn');
  await N.getByRole('button', { name: 'Next jump' }).click(); await N.getByRole('button', { name: 'Next jump' }).click();
  ok((await N.locator('path.dga-jump').count()) === 2 && /After 2 of 4 jumps you are at\s*5/.test(await N.locator('[role="status"]').innerText()), 'two Next presses draw two jumps and say where they land');
  await N.getByRole('button', { name: 'Show all' }).click();
  ok((await N.locator('path.dga-jump').count()) === 4 && (await N.getByRole('button', { name: 'Next jump' }).isDisabled()), 'Show all draws four and disables Next');
  const b = N.locator('input[type="range"]').nth(1);
  await b.focus(); await page.keyboard.press('ArrowRight');
  ok(/5 jumps of[\s\S]*end at\s*8/.test(await N.locator('[role="status"]').innerText()) && (await N.locator('path.dga-jump').count()) === 0, 'changing b to 5 starts again: five jumps of 1 will end at 8');

  // ── Targets and focus ──────────────────────────────────────────────────────
  const small = await page.evaluate(() => [...document.querySelectorAll('.dgi button, .dgi input[type="range"]')].filter(e => e.getBoundingClientRect().height < 43.5).length);
  ok(small === 0, `every button and slider is at least 44 px tall (${small} are not)`);
  await N.getByRole('button', { name: 'Start again' }).focus();
  await page.keyboard.press('Shift+Tab');
  const outline = await page.evaluate(() => { const cs = getComputedStyle(document.activeElement); return { s: cs.outlineStyle, w: parseFloat(cs.outlineWidth), tag: document.activeElement.tagName }; });
  ok(outline.s !== 'none' && outline.w >= 2, `a keyboard-focused control shows an outline (${outline.tag} ${outline.s} ${outline.w}px)`);

  // ── Contrast of the pack's strokes in light and dark ───────────────────────
  const contrast = t => page.evaluate(theme => {
    document.documentElement.setAttribute('data-theme', theme);
    const parse = c => { const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(c); return m ? [+m[1], +m[2], +m[3]] : null; };
    const lum = ([r, g, b]) => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
    const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)]; return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
    const bg = parse(getComputedStyle(document.querySelector('main')).backgroundColor);
    const out = {};
    for (const sel of ['.dga-boundary', '.dga-jump', '.dga-sum', '.dga-level', '.dga-slope', '.dga-sumdot']) {
      const el = document.querySelector(sel); if (!el) { out[sel] = 0; continue; }
      const c = parse(getComputedStyle(el)[sel.includes('dot') ? 'fill' : 'stroke']); out[sel] = c && bg ? ratio(c, bg) : 0;
    }
    let text = 99; for (const el of document.querySelectorAll('.dga .dg-tex-in, .dg .dg-tex-in')) { const c = parse(getComputedStyle(el).color); if (c && bg) text = Math.min(text, ratio(c, bg)); }
    out.text = text; out.bg = bg;
    return out;
  }, t);
  const light = await contrast('light'); const dark = await contrast('dark');
  for (const sel of ['.dga-boundary', '.dga-jump', '.dga-sum', '.dga-level', '.dga-slope', '.dga-sumdot']) ok(light[sel] >= 3 && dark[sel] >= 3, `${sel} has at least 3 : 1 contrast (light ${light[sel].toFixed(2)}, dark ${dark[sel].toFixed(2)})`);
  ok(light.text >= 4.5 && dark.text >= 4.5, `labels have at least 4.5 : 1 (light ${light.text.toFixed(2)}, dark ${dark.text.toFixed(2)})`);
  ok(JSON.stringify(light.bg) !== JSON.stringify(dark.bg), 'the theme really flips');

  // ── Reduced motion ─────────────────────────────────────────────────────────
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, reducedMotion: 'reduce' });
  const p2 = await ctx.newPage();
  await p2.goto(URL_, { waitUntil: 'networkidle' });
  await p2.waitForSelector('[data-case="interactive-3"] .dga-level');
  const durations = await p2.evaluate(() => [...document.querySelectorAll('.dga .dga-level, .dga .dga-boundary, .dga .dg-curve, .dga .dg-bar')].map(el => getComputedStyle(el).transitionDuration));
  ok(durations.length > 0 && durations.every(d => d.split(',').every(v => parseFloat(v) === 0)), 'with reduced motion every transition is 0 s');
  await ctx.close();
} finally {
  await browser.close();
  await server.close();
}

if (failures.length) {
  console.error(`DIAGRAM PACK ALGEBRA (browser): FAIL — ${failures.length} of ${pass + failures.length} checks failed`);
  for (const f of failures) console.error(`  · ${f}`);
  process.exit(1);
}
console.log(`DIAGRAM PACK ALGEBRA (browser): PASS — ${pass}/${pass} checks — at 375 px nothing overflows and labels stay apart inside their figures; keyboard and pointer move every explorer and the live regions follow; 44 px targets, visible focus, contrast in light and dark, reduced motion honoured`);
