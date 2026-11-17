// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the diagram kit in a real browser (Chromium)
//
// client/test/support/diagram-gallery.jsx draws every kind, static and
// interactive, through the app's own Vite pipeline. This drives it as a student
// would and judges what the browser computed:
//
//   LAYOUT     at phone width (375 px) nothing overflows horizontally; every svg
//              and every label lies inside its figure; labels are real KaTeX;
//   KEYBOARD   range inputs respond to arrow keys; the unit-circle point is a
//              slider that arrows, Shift, Page, Home and End move, and pointer
//              drag sets; every change reaches the live region with the numbers;
//   THEME      light and dark: label text ≥ 4.5 : 1 and strokes ≥ 3 : 1 against
//              the Instrument's base colour;
//   MOTION     with prefers-reduced-motion: reduce every transition is 0 s;
//   TARGETS    every button and range input is at least 44 px tall;
//   FOCUS      a keyboard-focused control shows a visible outline.
//
//   node client/test/diagram-kit-browser-check.mjs
// ─────────────────────────────────────────────────────────────────────────────
import { chromium } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { auditLabels } from './support/label-audit.mjs';

const CLIENT = fileURLToPath(new URL('..', import.meta.url));
let pass = 0;
const failures = [];
const ok = (cond, label) => { if (cond) pass++; else failures.push(label); };

// The app's own Vite config (its React dedupe, its aliases and its KaTeX handling), on a free port.
const server = await createServer({
  root: CLIENT, configFile: fileURLToPath(new URL('../vite.config.js', import.meta.url)), logLevel: 'error',
  server: { host: '127.0.0.1', port: 0, strictPort: false, hmr: false, watch: null, proxy: undefined },
  optimizeDeps: { entries: ['test/support/diagram-gallery.html'] }
});
await server.listen();
const base = `http://127.0.0.1:${server.httpServer.address().port}`;
const URL_ = `${base}/test/support/diagram-gallery.html`;

const browser = await chromium.launch();
try {
  const context = await browser.newContext({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 2 });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(URL_, { waitUntil: 'networkidle' });
  await page.waitForSelector('[data-case="interactive-6"] svg', { timeout: 30000 });
  ok(errors.length === 0, `no console or page errors (${errors.slice(0, 2).join(' | ')})`);

  // ── Layout at phone width ──────────────────────────────────────────────────
  const layout = await page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const out = { vw, scrollW: document.documentElement.scrollWidth, svgs: 0, wide: [], tiny: [], labelsOut: 0, labels: 0, plainLabels: 0, kinds: document.querySelectorAll('[data-case]').length };
    for (const svg of document.querySelectorAll('.dg svg')) {
      out.svgs += 1;
      const r = svg.getBoundingClientRect();
      if (r.right > vw + 0.5 || r.left < -0.5) out.wide.push(svg.closest('[data-case]')?.dataset.case);
      if (r.width < 200 || r.height < 60) out.tiny.push(svg.closest('[data-case]')?.dataset.case);
      for (const lab of svg.querySelectorAll('.dg-tex-in')) {
        out.labels += 1;
        const k = lab.querySelector('.katex');
        if (!k) { out.plainLabels += 1; continue; }
        const kr = k.getBoundingClientRect();
        if (kr.width > 0 && (kr.right > r.right + 6 || kr.left < r.left - 6 || kr.bottom > r.bottom + 6 || kr.top < r.top - 6)) { out.labelsOut += 1; (out.spill ||= []).push(`${svg.closest('[data-case]')?.dataset.case}:${k.textContent.slice(0, 20)}`); }
      }
    }
    out.tables = [...document.querySelectorAll('.dg-table')].filter(t => t.scrollWidth > t.clientWidth + 1 && getComputedStyle(t).overflowX === 'visible').length;
    out.errors = document.querySelectorAll('.katex-error').length;
    return out;
  });
  ok(layout.scrollW <= layout.vw + 1, `the page does not scroll sideways at ${layout.vw} px (scroll width ${layout.scrollW})`);
  ok(layout.svgs >= 47 && layout.kinds >= 48, `every kind is on the page (${layout.svgs} diagrams, ${layout.kinds} cases)`);
  ok(layout.wide.length === 0, `no svg runs past the phone's edge (${layout.wide.join(',')})`);
  ok(layout.tiny.length === 0, `no svg is shrunk to unreadable size (${layout.tiny.join(',')})`);
  ok(layout.labels > 300 && layout.plainLabels === 0, `every label is typeset by KaTeX (${layout.labels} labels, ${layout.plainLabels} plain)`);
  ok(layout.labelsOut === 0, `no label spills outside its figure (${layout.labelsOut}: ${(layout.spill || []).join(' ')})`);
  ok(layout.errors === 0, 'no KaTeX error is shown');
  ok(layout.tables === 0, 'a table is scrollable, never clipped');

  // ── Labels never sit on a stroked path or on each other (support/label-audit.mjs) ──
  const overlaps = await auditLabels(page, '[data-case]');
  ok(overlaps.figures >= 46 && overlaps.samples > 5000 && overlaps.labels > 300, `the overlap audit covered ${overlaps.figures} figures, ${overlaps.labels} labels, ${overlaps.samples} stroke samples`);
  ok(overlaps.found.length === 0, `no label sits on a stroked path or on another label (${overlaps.found.length}): ${overlaps.found.slice(0, 80).join(' | ')}`);

  // ── Accessible names and the tab order of the interactive variants ─────────
  const named = await page.evaluate(() => {
    const out = { sliders: 0, unnamed: [], buttons: 0, unnamedButtons: 0, live: 0, sections: 0, unlabelledSections: 0 };
    for (const el of document.querySelectorAll('.dgi input[type="range"], .dgi [role="slider"]')) {
      out.sliders += 1;
      const name = el.getAttribute('aria-label') || (el.labels && el.labels[0]?.textContent) || '';
      if (!name.trim()) out.unnamed.push(el.outerHTML.slice(0, 60));
    }
    for (const b of document.querySelectorAll('.dgi button')) { out.buttons += 1; if (!b.textContent.trim()) out.unnamedButtons += 1; }
    out.live = document.querySelectorAll('.dgi [role="status"][aria-live="polite"]').length;
    for (const s of document.querySelectorAll('.dgi')) { out.sections += 1; if (!s.getAttribute('aria-labelledby') || !document.getElementById(s.getAttribute('aria-labelledby'))?.textContent.trim()) out.unlabelledSections += 1; }
    return out;
  });
  ok(named.sliders >= 14 && named.unnamed.length === 0, `every slider has a name (${named.sliders} sliders, unnamed: ${named.unnamed.join(' ')})`);
  ok(named.buttons >= 10 && named.unnamedButtons === 0, 'every button has a name');
  ok(named.sections === 7 && named.live === 7 && named.unlabelledSections === 0, 'every interactive diagram is a labelled section with a polite live region');

  // ── Keyboard: native ranges ────────────────────────────────────────────────
  const T = page.locator('[data-case="interactive-0"]');
  const a = T.locator('input[type="range"]').first();
  await a.focus();
  const before = await a.inputValue();
  await page.keyboard.press('ArrowRight');
  const after = await a.inputValue();
  ok(Number(after) === Number(before) + 0.25, `ArrowRight moves a range by its step (${before} → ${after})`);
  const readout = await T.locator('[role="status"]').innerText();
  ok(/stretch 1\.25/.test(readout), `and the live region says what changed (${readout.slice(0, 60)})`);
  await page.keyboard.press('End');
  ok(Number(await a.inputValue()) === 3, 'End goes to the maximum');
  await T.getByRole('button', { name: 'Reset' }).click();
  ok(Number(await a.inputValue()) === 1, 'Reset restores the starting values');

  const L = page.locator('[data-case="interactive-1"]');
  {
    const r = T.locator('input[type="range"]');
    await r.nth(1).focus(); for (let i = 0; i < 4; i++) await page.keyboard.press('ArrowRight');
    await r.nth(2).focus(); for (let i = 0; i < 6; i++) await page.keyboard.press('ArrowRight');
    const tex = (await T.locator('annotation').allTextContents()).join(' ');
    ok(tex.includes('y=\\left(2(x-3)\\right)^2'), `a scaled and shifted parabola is bracketed so it reads as drawn (${tex.slice(0, 120)})`);
  }
  const m = L.locator('input[type="range"]').first();
  ok((await L.locator('input[type="range"]').count()) === 2, 'the line explorer has just its two sliders (m and c)');
  await m.focus(); await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowRight');
  const lineWords = await L.locator('[role="status"]').innerText();
  ok(/gradient\s*1\.5/.test(lineWords), `changing m changes the gradient in the words (${lineWords.slice(0, 80)})`);

  // ── Keyboard and pointer: the unit-circle point ────────────────────────────
  const U = page.locator('[data-case="interactive-2"]');
  const handle = U.locator('[role="slider"][aria-label="Point on the unit circle"]');
  await handle.focus();
  ok(await handle.getAttribute('aria-valuenow') === '30', 'the point starts at 30°');
  for (let i = 0; i < 15; i++) await page.keyboard.press('ArrowUp');
  ok(await handle.getAttribute('aria-valuenow') === '45', 'fifteen ArrowUp presses move it 15° to 45°');
  ok(/cosine 0\.707107/.test(await handle.getAttribute('aria-valuetext')), 'its value text gives cosine and sine');
  await page.keyboard.press('Shift+ArrowUp');
  ok(await handle.getAttribute('aria-valuenow') === '60', 'Shift+Arrow moves 15°');
  await page.keyboard.press('PageDown');
  ok(await handle.getAttribute('aria-valuenow') === '45', 'PageDown moves back 15°');
  await page.keyboard.press('ArrowRight');
  ok(await handle.getAttribute('aria-valuenow') === '46', 'ArrowRight increases the angle, as a slider does');
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('Home');
  ok(await handle.getAttribute('aria-valuenow') === '0', 'Home goes to 0°');
  await page.keyboard.press('End');
  ok(await handle.getAttribute('aria-valuenow') === '359', 'End goes to 359°');
  ok(/θ|theta|\\theta/.test(await U.locator('[role="status"]').innerHTML()) || /359/.test(await U.locator('[role="status"]').innerText()), 'the live region follows the angle');
  const svg = U.locator('svg').first();
  const box = await svg.boundingBox();
  // Pointer drag to the top of the circle (90°): the centre of the viewBox is the centre of the circle.
  await page.mouse.move(box.x + box.width / 2 + 2, box.y + box.height / 2 - box.height * 0.3);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 - box.height * 0.3, { steps: 3 });
  await page.mouse.up();
  const dragged = Number(await handle.getAttribute('aria-valuenow'));
  ok(dragged >= 86 && dragged <= 94, `dragging to the top of the circle sets about 90° (${dragged}°)`);
  await U.getByRole('button', { name: '120°' }).click();
  ok(await handle.getAttribute('aria-valuenow') === '120' && (await U.getByRole('button', { name: '120°' }).getAttribute('aria-pressed')) === 'true', 'a preset sets the angle and shows it is chosen');

  // ── The other interactive variants ─────────────────────────────────────────
  const S = page.locator('[data-case="interactive-3"]');
  await S.getByRole('button', { name: 'Move to the tangent' }).click();
  ok(/h=0\.001/.test(await S.locator('[role="status"]').innerText()) && /2\.001/.test(await S.locator('[role="status"]').innerText()), 'moving the secant to the tangent reports gradient 2.001 → 2');
  const R = page.locator('[data-case="interactive-4"]');
  await R.locator('input[type="range"]').focus(); await page.keyboard.press('End');
  ok(/60 left-point rectangles/.test(await R.locator('[role="status"]').innerText()), 'the Riemann slider adds rectangles up to 60');
  await R.getByRole('button', { name: 'Midpoint' }).click();
  ok(/mid-point/.test(await R.locator('[role="status"]').innerText()) && (await R.getByRole('button', { name: 'Midpoint' }).getAttribute('aria-pressed')) === 'true', 'the endpoint rule is a toggle button');
  const N = page.locator('[data-case="interactive-5"]');
  await N.getByRole('button', { name: '±2 SD' }).click();
  ok(/0\.9545/.test(await N.locator('[role="status"]').innerText()), '±2 SD shades 0.9545 of the normal curve');
  const C = page.locator('[data-case="interactive-6"]');
  await C.getByRole('button', { name: 'Monthly' }).click();
  ok(/12 times a year/.test(await C.locator('[role="status"]').innerText()), 'compounding monthly is announced');

  // ── Targets and focus ──────────────────────────────────────────────────────
  const targets = await page.evaluate(() => [...document.querySelectorAll('.dgi button, .dgi input[type="range"]')].filter(e => e.getBoundingClientRect().height < 43.5).length);
  ok(targets === 0, `every button and slider is at least 44 px tall (${targets} are not)`);
  // Tab into the first slider of the next diagram from a button of the one before: a keyboard focus, so :focus-visible applies.
  await page.locator('[data-case="interactive-4"]').getByRole('button', { name: 'Midpoint' }).focus();
  await page.keyboard.press('Tab');
  const outline = await page.evaluate(() => { const el = document.activeElement; const cs = getComputedStyle(el); return { tag: `${el.tagName} ${(el.textContent || '').slice(0, 16)} fv=${el.matches(':focus-visible')} cls=${document.documentElement.className}`, style: cs.outlineStyle, width: parseFloat(cs.outlineWidth) }; });
  ok(outline.style !== 'none' && outline.width >= 2, `a keyboard-focused control (${outline.tag}) shows an outline (${outline.style} ${outline.width}px)`);

  // ── Theme: contrast in light and dark ──────────────────────────────────────
  const contrast = async theme => page.evaluate(t => {
    document.documentElement.setAttribute('data-theme', t);
    const parse = c => { const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(c); return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null; };
    const lum = ([r, g, b]) => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
    const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)]; return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
    const bg = parse(getComputedStyle(document.body.firstElementChild.firstElementChild).backgroundColor) || parse(getComputedStyle(document.querySelector('main')).backgroundColor);
    const worst = { text: 99, stroke: 99 };
    for (const el of document.querySelectorAll('.dg-tex-in')) { const c = parse(getComputedStyle(el).color); if (c && bg) worst.text = Math.min(worst.text, ratio(c, bg)); }
    for (const sel of ['.dg-axis', '.dg-curve.is-primary', '.dg-curve.is-secondary', '.dg-dot.is-key', '.dg-curve.is-tangent', '.dg-asymptote']) {
      const el = document.querySelector(sel); if (!el) continue;
      const prop = sel.includes('dot') ? 'fill' : 'stroke'; const c = parse(getComputedStyle(el)[prop]);
      if (c && bg) worst.stroke = Math.min(worst.stroke, ratio(c, bg));
    }
    return { theme: t, bg, ...worst };
  }, theme);
  const light = await contrast('light'); const dark = await contrast('dark');
  ok(light.text >= 4.5 && dark.text >= 4.5, `label text has at least 4.5 : 1 contrast (light ${light.text.toFixed(2)}, dark ${dark.text.toFixed(2)})`);
  ok(light.stroke >= 3 && dark.stroke >= 3, `graph strokes have at least 3 : 1 contrast (light ${light.stroke.toFixed(2)}, dark ${dark.stroke.toFixed(2)})`);
  ok(JSON.stringify(light.bg) !== JSON.stringify(dark.bg), 'the page really changes theme (the tokens flip)');
  await page.evaluate(() => document.documentElement.removeAttribute('data-theme'));

  // ── Reduced motion ─────────────────────────────────────────────────────────
  const motion = async mode => {
    const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, reducedMotion: mode });
    const p = await ctx.newPage();
    await p.goto(URL_, { waitUntil: 'networkidle' });
    await p.waitForSelector('[data-case="interactive-0"] .dg-curve');
    const r = await p.evaluate(() => [...document.querySelectorAll('.dgi .dg-curve, .dgi .dg-bar, .dgi .dg-shade')].map(el => getComputedStyle(el).transitionDuration));
    await ctx.close();
    return r;
  };
  const reduced = await motion('reduce'); const normal = await motion('no-preference');
  ok(reduced.length > 0 && reduced.every(d => d.split(',').every(v => parseFloat(v) === 0)), 'with reduced motion every transition is 0 s');
  ok(normal.some(d => d.split(',').some(v => parseFloat(v) > 0)), 'without it the short transition exists');
} finally {
  await browser.close();
  await server.close();
}

if (failures.length) {
  console.error(`DIAGRAM KIT (browser): FAIL — ${failures.length} of ${pass + failures.length} checks failed`);
  for (const f of failures.slice(0, 40)) console.error(`  · ${f}`);
  process.exit(1);
}
console.log(`DIAGRAM KIT (browser): PASS — ${pass}/${pass} checks — at phone width nothing overflows, labels are KaTeX inside their figures, every control is keyboard-operable and announced, light and dark keep their contrast, and reduced motion is honoured`);
