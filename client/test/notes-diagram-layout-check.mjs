// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · every notes diagram, in both editions, is laid out cleanly
//
// client/test/support/notes-diagram-gallery.jsx draws EVERY diagram of an edition's notes
// (India: Classes 6-12 and the olympiad notes; NSW: Stages 4-6) through the notes' own
// TeachingDiagrams. In real Chromium, at desktop and at 390 px, this measures the label boxes
// the browser computed and fails when, in any diagram:
//
//   OVERLAP    two label boxes (KaTeX labels, SVG text) overlap;
//   ON-CURVE   a label box sits on a drawn curve;
//   REFLINE    a drawn reference line (dashed asymptote, or a curve that is a constant)
//              has no label of its own (a plain tick number does not name a line);
//   AXIS NAME  a function graph's axis names disagree with the function's own variables
//              (g(t) is drawn against t and g; x and y only when the function uses them).
//
//   node client/test/notes-diagram-layout-check.mjs [--edition in|nsw] [--verbose]
// ─────────────────────────────────────────────────────────────────────────────
import { chromium } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { realpathSync } from 'node:fs';
import { createServer } from 'vite';

const CLIENT = fileURLToPath(new URL('..', import.meta.url));
const arg = n => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : null; };
const ONLY = arg('--only');
const VERBOSE = process.argv.includes('--verbose');
const EDITIONS = arg('--edition') ? [arg('--edition')] : ['in', 'nsw'];
const WIDTHS = [1100, 390];

const server = await createServer({
  root: CLIENT, configFile: fileURLToPath(new URL('../vite.config.js', import.meta.url)), logLevel: 'error',
  server: { host: '127.0.0.1', port: 0, strictPort: false, hmr: false, watch: null, proxy: undefined, fs: { allow: [CLIENT, fileURLToPath(new URL('../..', import.meta.url)), realpathSync(CLIENT + 'node_modules/..')] } },
  cacheDir: fileURLToPath(new URL('../node_modules/.vite-notes-diagram-layout', import.meta.url)),
  optimizeDeps: { entries: ['test/support/notes-diagram-gallery.html'] }
});
await server.listen();
const origin = `http://127.0.0.1:${server.httpServer.address().port}`;

// Runs in the page: returns { key: [violation, …] } for every diagram.
function measure() {
  const out = {};
  const specs = Object.fromEntries(window.__DIAGRAMS.map(d => [d.key, d.spec]));
  const shrink = r => ({ l: r.left + 1, r: r.right - 1, t: r.top + 3, b: r.bottom - 3 });
  const hit = (a, b) => Math.min(a.r, b.r) - Math.max(a.l, b.l) > 1 && Math.min(a.b, b.b) - Math.max(a.t, b.t) > 1;
  const expectedNames = spec => {
    if (!spec || spec.kind !== 'function') return null;
    const own = s => (typeof s === 'string' && /^\s*[A-Za-z]/.test(s) ? s.trim()[0] : null);
    let x = null; let y = null;
    for (const c of spec.curves || []) {
      const lab = String(c.label || '');
      const f = /^\s*([A-Za-z])\s*\(\s*([A-Za-z])\s*\)/.exec(lab);
      if (f) { y = y || f[1]; x = x || f[2]; continue; }
      const e = /^\s*([A-Za-z])\s*=\s*(.+)$/.exec(lab);
      if (!e) continue;
      // "V = 30000(0.85)^n": the one other letter on the right (not a command, not the e of e^) is the variable.
      const rest = e[2].replace(/\\[A-Za-z]+|\\text\{[^}]*\}/g, '').replace(/e\^/g, '');
      const letters = new Set(rest.match(/[A-Za-z]/g) || []); letters.delete(e[1]);
      if (letters.size === 1 && !y) { y = e[1]; x = [...letters][0]; }
    }
    return { x: spec.xName || own(spec.xLabel) || x || 'x', y: spec.yName || own(spec.yLabel) || y || 'y' };
  };
  for (const sec of document.querySelectorAll('section[data-did]')) {
    const key = sec.dataset.did; const v = []; out[key] = v;
    for (const svg of sec.querySelectorAll('svg.dg-svg')) {
      const labels = [];
      for (const fo of svg.querySelectorAll('foreignObject.dg-tex')) {
        const k = fo.querySelector('.katex-html') || fo.querySelector('.dg-tex-in');
        const r = k.getBoundingClientRect(); if (r.width < 1) continue;
        labels.push({ box: shrink(r), text: (k.textContent || '').trim(), fo });
      }
      for (const t of svg.querySelectorAll('text')) { const r = t.getBoundingClientRect(); if (r.width >= 1) labels.push({ box: shrink(r), text: t.textContent.trim(), fo: t }); }
      if (window.__DUMP) console.log(JSON.stringify(labels.map(l => [l.text, ...Object.values(l.box).map(Math.round)])));
      for (let i = 0; i < labels.length; i++) for (let j = i + 1; j < labels.length; j++) {
        if (labels[i].fo.contains(labels[j].fo) || labels[j].fo.contains(labels[i].fo)) continue;
        if (hit(labels[i].box, labels[j].box)) v.push(`OVERLAP "${labels[i].text}" x "${labels[j].text}"`);
      }
      const paths = [...svg.querySelectorAll('path.dg-curve')];
      const ctm = svg.getScreenCTM();
      const flat = [];
      for (const p of paths) {
        const len = p.getTotalLength(); const pts = [];
        for (let s = 0; s <= len; s += 3) { const q = p.getPointAtLength(s); const m = p.getScreenCTM(); pts.push([m.a * q.x + m.c * q.y + m.e, m.b * q.x + m.d * q.y + m.f]); }
        const xs = pts.map(q => q[0]); const ys = pts.map(q => q[1]);
        const spanX = Math.max(...xs) - Math.min(...xs); const spanY = Math.max(...ys) - Math.min(...ys);
        flat.push({ pts, horizontal: spanY < 0.5 && spanX > 20, vertical: spanX < 0.5 && spanY > 20 });
      }
      for (const lb of labels) if (/[A-Za-z=]/.test(lb.text.replace(/[0-9.,\s−-]/g, ''))) for (const c of flat) if (c.pts.some(([x, y]) => x >= lb.box.l && x <= lb.box.r && y >= lb.box.t && y <= lb.box.b)) { v.push(`ON-CURVE "${lb.text}"`); break; }
      // Reference lines: dashed asymptotes and constant curves. A label is a non-numeric one near the line.
      const refs = [];
      for (const l of svg.querySelectorAll('line.dg-asymptote')) {
        const a = l.getBoundingClientRect(); refs.push({ r: a, what: 'asymptote' });
      }
      for (const c of flat) if (c.horizontal || c.vertical) {
        const xs = c.pts.map(q => q[0]); const ys = c.pts.map(q => q[1]);
        refs.push({ r: { left: Math.min(...xs), right: Math.max(...xs), top: Math.min(...ys), bottom: Math.max(...ys) }, what: 'constant line' });
      }
      const words = labels.filter(l => /[A-Za-z=]/.test(l.text.replace(/[0-9.,\s−-]/g, '')) && !l.fo.closest('.dg-small, .dg-tick'));
      for (const ref of refs) {
        const near = words.some(l => l.box.r >= ref.r.left - 24 && l.box.l <= ref.r.right + 24 && l.box.b >= ref.r.top - 26 && l.box.t <= ref.r.bottom + 26);
        if (!near) v.push(`REFLINE ${ref.what} has no label`);
      }
      // Axis names.
      const exp = expectedNames(specs[key]);
      const names = {};
      for (const e of svg.querySelectorAll('[data-axis-name]')) names[e.dataset.axisName] = ((e.querySelector('.katex-html') || e).textContent || '').trim();
      if (exp) for (const ax of ['x', 'y']) {
        const got = (names[ax] || '').replace(/​/g, '').match(/[A-Za-z]/)?.[0] ?? null;
        if (got !== exp[ax]) v.push(`AXIS NAME ${ax} axis is "${names[ax] ?? 'missing'}", the function uses "${exp[ax]}"`);
      }
    }
  }
  return out;
}

const results = {};
const browser = await chromium.launch();
try {
  for (const ed of EDITIONS) {
    const failing = new Map(); let total = 0;
    for (const width of WIDTHS) {
      const page = await (await browser.newContext({ viewport: { width, height: 900 } })).newPage();
      const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      await page.goto(`${origin}/test/support/notes-diagram-gallery.html?edition=${ed}${ONLY ? `&only=${encodeURIComponent(ONLY)}` : ''}`, { waitUntil: 'networkidle' });
      await page.waitForSelector('[data-ready]', { timeout: 120000 });
      await page.waitForFunction(() => document.querySelectorAll('section[data-did] svg').length > 0, { timeout: 60000 }).catch(() => {});
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(500);
      page.on('console', m => { if (process.env.DUMP) console.log(m.text()); }); await page.evaluate(() => { window.__DUMP = true; }); const r = await page.evaluate(measure);
      total = Object.keys(r).length;
      for (const [k, v] of Object.entries(r)) if (v.length) { const prev = failing.get(k) || new Set(); v.forEach(x => prev.add(x)); failing.set(k, prev); }
      if (errors.length) console.log(`page errors (${ed} ${width}): ${errors.slice(0, 3).join(' | ')}`);
      await page.context().close();
    }
    results[ed] = { total, failing: failing.size };
    const cats = {};
    for (const set of failing.values()) for (const x of set) { const c = x.split(' ')[0] === 'AXIS' ? 'AXIS NAME' : x.split(' ')[0]; cats[c] = (cats[c] || 0) + 1; }
    console.log(`${ed}: ${failing.size} of ${total} diagrams fail ${JSON.stringify(cats)}`);
    if (VERBOSE) for (const [k, set] of failing) console.log(`  ${k}\n    ${[...set].slice(0, 6).join('\n    ')}`);
    else for (const [k, set] of [...failing].slice(0, 8)) console.log(`  ${k}: ${[...set][0]}`);
  }
} finally { await browser.close(); await server.close(); }
const bad = Object.values(results).reduce((n, r) => n + r.failing, 0);
console.log(bad ? `notes-diagram-layout-check FAILED: ${bad} diagrams` : `notes-diagram-layout-check ok: ${Object.entries(results).map(([e, r]) => `${e} ${r.total}`).join(', ')} diagrams clean`);
process.exit(bad ? 1 : 0);
