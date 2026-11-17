// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · smooth ink on Safari (task/ink-smooth-safari).
//
// What the owner felt on an iPad in Safari: about a second before the pen would
// write again, lag, jagged lines, dropped strokes, a page that stuttered. The
// cause measured in the code: every pen-up recomputed the signature of ALL
// strokes, re-segmented all lines, saved the whole page and re-rendered the
// card. This check pins the fix:
//
//   · the incremental stroke signature is exactly strokeSignature(), always;
//   · a pen-up handler does almost nothing synchronously, with 300 strokes on
//     the page (no long task, handler under 50 ms) in Chromium and WebKit;
//   · rendering changes (width smoothing, the one-frame velocity prediction)
//     never change what is stored: stored points keep their own fields, no
//     predicted point enters a stroke, a repaint does not alter them, and what
//     the reader receives (compactStrokes of the stored page) is identical;
//   · answer-blind: no render module imports a marker, generator or answer.
//
// EVIDENCE CLASS. Emulated browsers (headless Chromium and WebKit) with
// synthesized pen events. It is NOT iPad or Apple Pencil evidence: the owner's
// own run with ?inkdebug=1 on the device is the measurement that counts.
//
// Run:  node client/test/ink-smooth-check.mjs [--browser=chromium|webkit]
// ─────────────────────────────────────────────────────────────────────────────
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import { chromium, webkit } from '@playwright/test';
import { strokeSignature, createStrokeSignature } from '../src/ink/strokeSignature.js';
import { renderWidth, velocityPrediction } from '../src/ink/inkRender.js';
import { compactStrokes } from '../src/local/inkDrafts.js';

let pass = 0; const failures = [];
const check = (name, ok, detail = '') => { if (ok) pass += 1; else { failures.push(`${name} ${detail}`); console.log(`  ✖ ${name} ${detail}`); } };

// ── 1 · the incremental signature is the signature ──────────────────────────
let seed = 7; const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
const stroke = () => ({ points: Array.from({ length: 5 + Math.floor(rnd() * 60) }, () => ({ x: rnd() * 600, y: rnd() * 300, w: 3 })) });
{
  const sig = createStrokeSignature();
  let page = []; let same = true;
  for (let i = 0; i < 300; i += 1) { page = [...page, stroke()]; if (sig(page) !== strokeSignature(page)) same = false; }
  check('the incremental signature equals strokeSignature() at every one of 300 pen-ups', same);
  page = page.slice(0, 200); check('after an undo it still equals strokeSignature()', sig(page) === strokeSignature(page));
  page = page.map(s => ({ points: s.points.map(p => ({ ...p, x: p.x * 1.1, y: p.y * 1.1 })) })); // a resize rescales every stroke
  check('after a rescale of the whole page it still equals strokeSignature()', sig(page) === strokeSignature(page));
  check('an empty page', sig([]) === strokeSignature([]));
  const t0 = performance.now(); let tmp = page; for (let i = 0; i < 100; i += 1) { tmp = [...tmp, stroke()]; sig(tmp); }
  const incremental = (performance.now() - t0) / 100;
  const t1 = performance.now(); for (let i = 0; i < 100; i += 1) strokeSignature(tmp);
  const full = (performance.now() - t1) / 100;
  check('a pen-up signature costs a fraction of the full one on a 300-stroke page', incremental < full, `${incremental.toFixed(3)} ms vs ${full.toFixed(3)} ms`);
}

// ── 2 · render helpers never touch their input ──────────────────────────────
{
  const pts = Array.from({ length: 40 }, (_, i) => ({ x: i * 3, y: 100 + Math.sin(i) * 8, w: 2 + (i % 5), t: i * 0.008, p: 0.5, azimuth: 1, altitude: 1.2 }));
  const before = JSON.stringify(pts);
  for (let i = 0; i < pts.length; i += 1) renderWidth(pts, i, 3);
  const guess = velocityPrediction(pts);
  check('width smoothing and prediction leave the stored points byte-identical', JSON.stringify(pts) === before);
  check('the prediction is at most one point, display-only ({x, y} only)', guess.length <= 1 && guess.every(g => Object.keys(g).sort().join() === 'x,y'));
  check('the prediction reaches at most 14 px ahead', guess.every(g => Math.hypot(g.x - pts.at(-1).x, g.y - pts.at(-1).y) <= 14.001));
  check('no prediction from a stalled or ancient sample', velocityPrediction([{ x: 1, y: 1, t: 1 }, { x: 1, y: 1, t: 1.004 }]).length === 0 && velocityPrediction([{ x: 1, y: 1, t: 1 }, { x: 40, y: 1, t: 2 }]).length === 0);
  check('the reader receives the same compacted page before and after rendering', JSON.stringify(compactStrokes([{ points: pts }])) === JSON.stringify(compactStrokes(JSON.parse(before).length ? [{ points: JSON.parse(before) }] : [])));
}

// ── 3 · structure: answer-blind, nothing leaves, prediction stays on the live layer ──
{
  const read = f => readFileSync(new URL(`../src/ink/${f}`, import.meta.url), 'utf8').replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
  for (const f of ['inkRender.js', 'strokeSignature.js']) {
    const src = read(f);
    check(`${f} imports nothing and makes no network call`, !/^import /m.test(src) && !/\bfetch\b|sendBeacon|XMLHttpRequest/.test(src));
  }
  const dbg = read('inkDebug.js');
  check('the debug overlay is off unless ?inkdebug=1 and sends nothing anywhere', /get\('inkdebug'\) === '1'/.test(dbg) && !/\bfetch\b|sendBeacon|XMLHttpRequest/.test(dbg));
  const canvas = read('InkCanvas.jsx');
  check('a predicted point is only assigned to the display list, never pushed into a stroke', !/points\.push\([^)]*predict/i.test(canvas) && /predictedRef\.current = velocityPrediction/.test(canvas));
  check('the pen-up handler defers the parent callback (no synchronous notify)', /notifyLater\(\);/.test(canvas) && !/paintStroke\(ctxRef\.current\.base, points, inkRef\.current\);\s*notify\(\);/.test(canvas));
  check('stylus touches are cancelled non-passively and the canvas keeps touch-action none', /touchstart', stylusTouch, \{ passive: false \}/.test(canvas) && /touchAction: 'none'/.test(canvas));
}

// ── 4 · in the browser: 300 strokes, pen-up cost, stored ink ────────────────
const clientRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const only = process.argv.find(a => a.startsWith('--browser='))?.slice(10) || null;
const server = await createServer({ root: clientRoot, configFile: false, logLevel: 'silent', plugins: [react()], server: { host: '127.0.0.1', port: 0, strictPort: false } });
try {
  await server.listen();
  const url = `http://127.0.0.1:${server.httpServer.address().port}/test/fixtures/ink-canvas-loss.html`;
  for (const [name, engine] of [['chromium', chromium], ['webkit', webkit]].filter(([n]) => !only || only === n)) {
    let browser;
    try { browser = await engine.launch({ headless: true }); } catch (e) { check(`${name} launches`, false, String(e?.message || e).split('\n')[0]); continue; }
    try {
      const ctx = await browser.newContext({ viewport: { width: 1100, height: 720 }, deviceScaleFactor: 2 });
      const page = await ctx.newPage();
      const errors = []; page.on('pageerror', e => errors.push(String(e?.message || e)));
      await page.goto(`${url}?inkdebug=1`);
      await page.waitForSelector('.ink-canvas-live');
      await page.waitForFunction(() => document.querySelector('.ink-canvas-base')?.width > 0);
      const out = await page.evaluate(async () => {
        const live = document.querySelector('.ink-canvas-live');
        const r = live.getBoundingClientRect();
        let longTasks = 0;
        try { new PerformanceObserver(l => { longTasks += l.getEntries().length; }).observe({ entryTypes: ['longtask'] }); } catch { /* not offered */ }
        const fire = (type, x, y, buttons) => live.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, composed: true, pointerId: 9, pointerType: 'pen', isPrimary: true, clientX: x, clientY: y, pressure: type === 'pointerup' ? 0 : 0.6, button: type === 'pointermove' ? -1 : 0, buttons }));
        const upMs = []; let maxX = 0;
        for (let s = 0; s < 300; s += 1) {
          const y = r.top + 12 + (s % 20) * 13, x0 = r.left + 10 + Math.floor(s / 20) * 30;
          fire('pointerdown', x0, y, 1);
          for (let i = 1; i <= 24; i += 1) { const x = x0 + i * 1.1; maxX = Math.max(maxX, x - r.left); fire('pointermove', x, y + Math.sin(i / 3) * 3, 1); }
          const t0 = performance.now(); fire('pointerup', x0 + 26, y, 0); upMs.push(performance.now() - t0);
          if (s % 10 === 9) await new Promise(res => requestAnimationFrame(res));
        }
        await new Promise(res => setTimeout(res, 300));
        const strokes = window.__ink.getStrokes();
        const first = JSON.stringify(strokes);
        document.documentElement.setAttribute('data-theme', 'light');
        await new Promise(res => requestAnimationFrame(() => requestAnimationFrame(res)));
        const again = JSON.stringify(window.__ink.getStrokes());
        const keys = new Set(); let maxStoredX = 0;
        for (const st of strokes) for (const p of st.points) { Object.keys(p).forEach(k => keys.add(k)); maxStoredX = Math.max(maxStoredX, p.x); }
        return { count: strokes.length, maxUp: Math.max(...upMs), p95: upMs.slice().sort((a, b) => a - b)[Math.floor(upMs.length * 0.95)], longTasks, unchanged: first === again, keys: [...keys].sort(), maxStoredX, maxX, debug: window.__inkDebug || null, parentMs: window.__parentMs || 0 };
      });
      check(`${name} · all 300 strokes are stored`, out.count === 300, `${out.count}`);
      check(`${name} · the pen-up handler stays under 50 ms with 300 strokes on the page`, out.maxUp < 50, `max ${out.maxUp.toFixed(1)} ms, p95 ${out.p95.toFixed(1)} ms`);
      check(`${name} · the parent's per-pen-up work (incremental signature) stays under 10 ms on a 300-stroke page`, out.parentMs < 10, `${out.parentMs.toFixed(2)} ms`);
      check(`${name} · no long task (>50 ms) while 300 strokes are written`, name === 'webkit' ? true : out.longTasks === 0, `${out.longTasks} long tasks${name === 'webkit' ? ' (WebKit offers no longtask observer: the handler time above is the measure)' : ''}`);
      check(`${name} · a repaint (theme flip) leaves the stored strokes byte-identical`, out.unchanged);
      check(`${name} · stored points carry only the pen's own fields`, out.keys.every(k => ['x', 'y', 'w', 't', 'p', 'azimuth', 'altitude'].includes(k)), out.keys.join());
      check(`${name} · no predicted point is stored (nothing beyond the last pen position)`, out.maxStoredX <= out.maxX + 0.5, `${out.maxStoredX.toFixed(1)} vs ${out.maxX.toFixed(1)}`);
      check(`${name} · the debug overlay measured pen-ups (owner-run device evidence format)`, !!out.debug && out.debug.strokes >= 300 && (await page.locator('[data-ink-debug]').count()) === 1);
      check(`${name} · no uncaught error reached the page`, errors.length === 0, errors.slice(0, 2).join(' · '));
      await ctx.close();
    } catch (err) {
      check(`${name} · the cell ran to the end`, false, String(err?.stack || err).split('\n').slice(0, 3).join(' | '));
    } finally { await browser.close(); }
  }
} finally { await server.close(); }

console.log(`\nINK SMOOTH (emulated browsers, synthesized pen events; NOT iPad or Apple Pencil evidence — measure on the device with ?inkdebug=1): ${pass} passed, ${failures.length} failed`);
if (failures.length) { console.log('\nfailures:'); for (const f of failures) console.log('  ' + f); process.exit(1); }
