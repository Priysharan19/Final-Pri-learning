// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the diagram pack "plane" in a real browser (Chromium)
//
// A page of every plane-pack kind, served through the app's own Vite config from a
// virtual module (no gallery file to keep in step), driven as a student would:
//   LAYOUT    at 375 px nothing scrolls sideways; every svg and KaTeX label is inside
//             its figure; no console or page error;
//   KEYBOARD  range inputs move by their step and the live region follows; the circle's
//             point is a slider that arrows, Shift, Page, Home and End move; pointer drag;
//   TARGETS   every button and range input is at least 44 px tall; focus is visible;
//   THEME     light and dark: labels ≥ 4.5 : 1, strokes ≥ 3 : 1 against the base colour;
//   MOTION    with prefers-reduced-motion: reduce every transition is 0 s.
//   node client/test/diagram-pack-plane-browser-check.mjs
// ─────────────────────────────────────────────────────────────────────────────
import { chromium } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { realpathSync } from 'node:fs';

const CLIENT = fileURLToPath(new URL('..', import.meta.url));
let pass = 0;
const failures = [];
const ok = (cond, label) => { if (cond) pass++; else failures.push(label); };

const PAGE = '/__plane-pack.html';
const ENTRY = '/__plane-pack-gallery.js';
const GALLERY = `
import React from 'react';
import { createRoot } from 'react-dom/client';
import '/src/instrument/instrument.css';
import DiagramFromSpec from '/src/diagrams/DiagramFromSpec.jsx';
const STATIC = [
  { kind: 'plane', xmin: -1, xmax: 5, ymin: -1, ymax: 4, points: [{ x: 0, y: 0, label: 'O', pos: 'sw' }, { x: 4, y: 0, label: 'A' }, { x: 4, y: 3, label: 'B' }], segments: [{ from: [0, 0], to: [4, 3], label: 'auto', ticks: 1 }], polygons: [{ points: [[0, 0], [4, 0], [4, 3]] }], angles: [{ at: [0, 0], from: [4, 0], to: [4, 3], label: 'auto' }, { at: [4, 0], from: [0, 0], to: [4, 3], right: true }] },
  { kind: 'plane', xmin: -4, xmax: 4, ymin: -3, ymax: 5, lines: [{ through: [[0, 1], [1, 3]], label: 'y=2x+1' }], curves: [{ expr: 'x^2-2', label: 'y=x^2-2' }], circles: [{ cx: -2, cy: 2, r: 1, dashed: true }], param: [{ x: '3*cos(t)', y: '2*sin(t)', t: [0, 6.2832] }] },
  { kind: 'parallelLines', angle: 60, mark: 'coInterior' }, { kind: 'parallelLines', angle: 25, mark: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] },
  { kind: 'areaModel', rows: [{ size: 5, label: 'x' }, { size: 3, label: 3 }], cols: [{ size: 5, label: 'x' }, { size: 2, label: 2 }] },
  { kind: 'areaModel', rows: [{ size: 10, label: 10 }, { size: 4, label: 4 }], cols: [{ size: 20, label: 20 }, { size: 3, label: 3 }] },
  { kind: 'fractionBar', bars: [{ parts: 4, shaded: 3 }, { parts: 8, shaded: 6 }, { parts: 3, shaded: 2 }] }
];
const INTERACTIVE = [
  { kind: 'parallelLinesExplorer', angle: 60, mark: 'coInterior' },
  { kind: 'triangleExplorer', mode: 'angleSum' }, { kind: 'triangleExplorer', mode: 'pythagoras', initial: { a: 3, b: 4 } },
  { kind: 'triangleExplorer', mode: 'trigRatios' }, { kind: 'triangleExplorer', mode: 'similar' }, { kind: 'triangleExplorer', mode: 'area' },
  { kind: 'circleExplorer', theorem: 'centre' }, { kind: 'circleExplorer', theorem: 'segment' }, { kind: 'circleExplorer', theorem: 'semicircle' },
  { kind: 'circleExplorer', theorem: 'cyclic' }, { kind: 'circleExplorer', theorem: 'tangent' }, { kind: 'circleExplorer', theorem: 'chords' }
];
const h = React.createElement;
function Gallery() {
  return h('main', { style: { maxWidth: 640, margin: '0 auto', padding: '0 16px 48px', background: 'var(--in-base)', color: 'var(--in-tx)' } },
    ...STATIC.map((spec, i) => h('div', { key: 's' + i, 'data-case': 'static-' + i }, h(DiagramFromSpec, { spec }))),
    ...INTERACTIVE.map((spec, i) => h('div', { key: 'i' + i, 'data-case': 'interactive-' + i }, h(DiagramFromSpec, { spec, interactive: true }))));
}
document.documentElement.classList.add('ui-instrument');
createRoot(document.getElementById('root')).render(h(Gallery));
`;
const virtualGallery = {
  name: 'plane-pack-gallery',
  resolveId: id => (id === ENTRY ? `\0${ENTRY}` : null),
  load: id => (id === `\0${ENTRY}` ? GALLERY : null), // plain JS (createElement): the React plugin does not compile virtual modules
  configureServer(srv) {
    srv.middlewares.use(async (req, res, next) => {
      if (req.url !== PAGE) return next();
      const html = await srv.transformIndexHtml(PAGE, `<!doctype html><html lang="en-AU"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><title>Plane pack</title></head><body><div id="root"></div><script type="module" src="${ENTRY}"></script></body></html>`);
      res.setHeader('Content-Type', 'text/html'); res.end(html);
    });
  }
};

const server = await createServer({
  root: CLIENT, configFile: fileURLToPath(new URL('../vite.config.js', import.meta.url)), logLevel: 'error',
  // a worktree may borrow node_modules by symlink: let Vite serve the KaTeX fonts from where they really are
  server: { host: '127.0.0.1', port: 0, strictPort: false, hmr: false, watch: null, proxy: undefined, fs: { allow: [CLIENT, realpathSync(new URL('../node_modules', import.meta.url))] } },
  plugins: [virtualGallery]
});
await server.listen();
const URL_ = `http://127.0.0.1:${server.httpServer.address().port}${PAGE}`;
const LAST = '[data-case="interactive-11"] svg';

const browser = await chromium.launch();
try {
  const context = await browser.newContext({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 2 });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(URL_, { waitUntil: 'networkidle' });
  await page.waitForSelector(LAST, { timeout: 60000 });
  ok(errors.length === 0, `no console or page errors (${errors.slice(0, 2).join(' | ')})`);

  // ── Layout at phone width ──────────────────────────────────────────────────
  const layout = await page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const out = { vw, scrollW: document.documentElement.scrollWidth, svgs: 0, wide: [], labels: 0, plain: 0, spill: [], errors: document.querySelectorAll('.katex-error').length };
    for (const svg of document.querySelectorAll('.dg svg')) {
      out.svgs += 1;
      const r = svg.getBoundingClientRect();
      if (r.right > vw + 0.5 || r.left < -0.5 || r.width < 200) out.wide.push(svg.closest('[data-case]')?.dataset.case);
      for (const lab of svg.querySelectorAll('.dg-tex-in')) {
        out.labels += 1;
        const k = lab.querySelector('.katex'); if (!k) { out.plain += 1; continue; }
        const kr = k.getBoundingClientRect();
        if (kr.width > 0 && (kr.right > r.right + 4 || kr.left < r.left - 4 || kr.bottom > r.bottom + 4 || kr.top < r.top - 4)) out.spill.push(`${svg.closest('[data-case]')?.dataset.case}:${k.textContent.slice(0, 16)}`);
      }
    }
    return out;
  });
  ok(layout.scrollW <= layout.vw + 1, `the page does not scroll sideways at ${layout.vw} px (${layout.scrollW})`);
  ok(layout.svgs === 19, `every case is drawn (${layout.svgs} figures)`);
  ok(layout.wide.length === 0, `no svg runs past the phone's edge or shrinks below 200 px (${layout.wide.join(',')})`);
  ok(layout.labels > 120 && layout.plain === 0 && layout.errors === 0, `every label is typeset by KaTeX (${layout.labels} labels, ${layout.plain} plain, ${layout.errors} errors)`);
  ok(layout.spill.length === 0, `no label spills outside its figure (${layout.spill.join(' ')})`);

  // ── Keyboard and live regions ──────────────────────────────────────────────
  const live = loc => loc.locator('[role="status"]').innerText();
  const PL = page.locator('[data-case="interactive-0"]');
  const pr = PL.locator('input[type="range"]');
  await pr.focus(); await page.keyboard.press('ArrowRight');
  ok(Number(await pr.inputValue()) === 65, 'the transversal slider moves by its 5° step');
  ok(/65/.test(await live(PL)) && /115/.test(await live(PL)) && /180/.test(await live(PL)), `and the live region states 65° + 115° = 180° (${(await live(PL)).slice(0, 90)})`);
  await page.keyboard.press('Home'); ok(Number(await pr.inputValue()) === 20, 'Home goes to 20°');
  await page.keyboard.press('End'); ok(Number(await pr.inputValue()) === 160, 'End goes to 160°');

  const AS = page.locator('[data-case="interactive-1"]');
  const A = AS.locator('input[type="range"]').first();
  await A.focus(); for (let i = 0; i < 10; i++) await page.keyboard.press('ArrowRight');
  const asText = await live(AS);
  ok(Number(await A.inputValue()) === 60 && /60/.test(asText) && /180/.test(asText), `angle A to 60°: C = 60° and the sum stays 180° (${asText.slice(0, 80)})`);
  await page.keyboard.press('End');
  ok(Number(await A.inputValue()) <= 110, `A cannot pass 170° − B (${await A.inputValue()})`);
  await AS.getByRole('button').click();
  ok(Number(await A.inputValue()) === 50, 'Reset restores the starting angle');

  const PY = page.locator('[data-case="interactive-2"]');
  const pa = PY.locator('input[type="range"]').first();
  await pa.focus(); for (let i = 0; i < 6; i++) await page.keyboard.press('ArrowRight');
  ok(/36\+16=52/.test((await PY.locator('[role="status"] annotation').allTextContents()).join(' ')), 'Pythagoras with a = 6: 36 + 16 = 52 in the live region');

  const CE = page.locator('[data-case="interactive-6"]');
  const handle = CE.locator('[role="slider"]');
  await handle.focus();
  ok(await handle.getAttribute('aria-valuenow') === '250', 'the circle point starts at 250°');
  await page.keyboard.press('ArrowUp'); ok(await handle.getAttribute('aria-valuenow') === '251', 'ArrowUp moves it 1°');
  await page.keyboard.press('Shift+ArrowUp'); ok(await handle.getAttribute('aria-valuenow') === '261', 'Shift+Arrow moves 10°');
  await page.keyboard.press('PageDown'); ok(await handle.getAttribute('aria-valuenow') === '251', 'PageDown moves back 10°');
  await page.keyboard.press('Home'); ok(await handle.getAttribute('aria-valuenow') === '150', 'Home goes to the start of the major arc (150°)');
  await page.keyboard.press('End'); ok(await handle.getAttribute('aria-valuenow') === '370', 'End goes to its end (370°, that is 10°)');
  const ceText = await live(CE);
  ok(/120/.test(ceText) && /60/.test(ceText), `the live region still says 120° and 60° (${ceText.slice(0, 80)})`);
  const svg = CE.locator('svg').first(); const box = await svg.boundingBox();
  // drag to the bottom of the circle (270°)
  await page.mouse.move(box.x + box.width / 2 + 1, box.y + box.height * 0.86);
  await page.mouse.down(); await page.mouse.move(box.x + box.width / 2, box.y + box.height * 0.86, { steps: 3 }); await page.mouse.up();
  const dragged = Number(await handle.getAttribute('aria-valuenow'));
  ok(dragged >= 265 && dragged <= 275, `dragging to the bottom of the circle sets about 270° (${dragged})`);
  const slider = CE.locator('input[type="range"]');
  ok(Number(await slider.inputValue()) === dragged, 'the range input follows the drag');

  // ── Targets and focus ──────────────────────────────────────────────────────
  const small = await page.evaluate(() => [...document.querySelectorAll('.dgi button, .dgi input[type="range"]')].filter(e => e.getBoundingClientRect().height < 43.5).length);
  ok(small === 0, `every button and slider is at least 44 px tall (${small} are not)`);
  await page.locator('[data-case="interactive-5"]').getByRole('button').focus();
  await page.keyboard.press('Tab');
  const outline = await page.evaluate(() => { const cs = getComputedStyle(document.activeElement); return { style: cs.outlineStyle, width: parseFloat(cs.outlineWidth), tag: document.activeElement.tagName }; });
  ok(outline.style !== 'none' && outline.width >= 2, `a keyboard-focused control shows an outline (${outline.tag} ${outline.style} ${outline.width}px)`);
  await page.locator('[data-case="interactive-7"] [role="slider"]').focus();
  const ring = await page.evaluate(() => { const r = document.activeElement.querySelector('.dgi-ring'); return parseFloat(getComputedStyle(r).strokeWidth); });
  ok(ring >= 3, `the focused circle point thickens its ring (${ring}px)`);

  // ── Theme: contrast ────────────────────────────────────────────────────────
  const contrast = async theme => page.evaluate(t => {
    document.documentElement.setAttribute('data-theme', t);
    const parse = c => { const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(c); return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null; };
    const lum = ([r, g, b]) => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
    const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)]; return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
    const bg = parse(getComputedStyle(document.querySelector('main')).backgroundColor);
    const worst = { text: 99, stroke: 99 };
    for (const el of document.querySelectorAll('.dg-tex-in')) { const c = parse(getComputedStyle(el).color); if (c && bg) worst.text = Math.min(worst.text, ratio(c, bg)); }
    for (const sel of ['.dgp-seg', '.dgp-seg.is-transversal', '.dgp-mark-arc', '.dgp-cell', '.dgp-frac', '.dgp-square', '.dgp-square.is-c', '.dg-shape.is-image', '.dgp-line']) {
      const el = document.querySelector(sel); if (!el) continue;
      const c = parse(getComputedStyle(el).stroke); if (c && bg) worst.stroke = Math.min(worst.stroke, ratio(c, bg));
    }
    return { bg, ...worst };
  }, theme);
  const light = await contrast('light'); const dark = await contrast('dark');
  ok(light.text >= 4.5 && dark.text >= 4.5, `labels have at least 4.5 : 1 contrast (light ${light.text.toFixed(2)}, dark ${dark.text.toFixed(2)})`);
  ok(light.stroke >= 3 && dark.stroke >= 3, `strokes have at least 3 : 1 contrast (light ${light.stroke.toFixed(2)}, dark ${dark.stroke.toFixed(2)})`);
  ok(JSON.stringify(light.bg) !== JSON.stringify(dark.bg), 'the theme really changes');
  await page.evaluate(() => document.documentElement.removeAttribute('data-theme'));

  // ── Reduced motion ─────────────────────────────────────────────────────────
  const motion = async mode => {
    const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, reducedMotion: mode });
    const p = await ctx.newPage();
    await p.goto(URL_, { waitUntil: 'networkidle' });
    await p.waitForSelector(LAST, { timeout: 60000 });
    const r = await p.evaluate(() => [...document.querySelectorAll('.dgp .dg-shape, .dgp .dgp-mark-arc')].map(el => getComputedStyle(el).transitionDuration));
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
  console.error(`DIAGRAM PACK plane (browser): FAIL — ${failures.length} of ${pass + failures.length} checks failed`);
  for (const f of failures) console.error(`  · ${f}`);
  process.exit(1);
}
console.log(`DIAGRAM PACK plane (browser): PASS — ${pass}/${pass} checks — at 375 px nothing overflows and every label is KaTeX inside its figure; sliders, the circle point and drag work from the keyboard and pointer and are announced; 44 px targets, visible focus, light/dark contrast and reduced motion hold`);
