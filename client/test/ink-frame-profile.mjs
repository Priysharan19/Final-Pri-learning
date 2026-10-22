// Ink frame profile (Pri Luxury PR 3). Mounts the real InkCanvas (the
// stroke-loss fixture) in headless Chromium, writes a stroke-heavy page with
// synthetic mouse input, and reports rAF frame intervals and the time spent
// inside each frame callback, for the classic renderer and the outline (wet,
// pressure) renderer. Headless desktop Chromium, not an iPad: the numbers are
// relative evidence, not device evidence.
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import { chromium } from '@playwright/test';

const clientRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const STROKES = Number(process.env.STROKES || 120), PTS = Number(process.env.PTS || 80);
const server = await createServer({ root: clientRoot, configFile: false, plugins: [react()], define: { __PRI_FEATURE_INSTRUMENT__: 'true' }, logLevel: 'silent', server: { host: '127.0.0.1', port: 0 } });
await server.listen();
const url = `http://127.0.0.1:${server.httpServer.address().port}/test/fixtures/ink-canvas-loss.html?height=700&width=1000`;
const browser = await chromium.launch();
const pct = (a, p) => a[Math.min(a.length - 1, Math.floor(a.length * p))];
async function run(outline) {
  const ctx = await browser.newContext({ viewport: { width: 1100, height: 800 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await page.addInitScript(`(${(on => {
    // documentElement does not exist yet; it does by readyState interactive,
    // which comes before the fixture's deferred module mounts the canvas.
    if (on) document.addEventListener('readystatechange', () => document.documentElement.classList.add('ui-instrument'));
    const raf = window.requestAnimationFrame.bind(window);
    window.__work = []; window.__ts = [];
    window.requestAnimationFrame = cb => raf(ts => { const t0 = performance.now(); cb(ts); window.__work.push(performance.now() - t0); });
    const tick = ts => { window.__ts.push(ts); raf(tick); }; raf(tick);
  }).toString()})(${outline})`);
  await page.goto(url);
  await page.waitForSelector('canvas.ink-canvas-live');
  const box = await page.locator('canvas.ink-canvas-live').boundingBox();
  await page.evaluate(() => { window.__work = window.__work || []; window.__work.length = 0; window.__ts.length = 0; });
  for (let s = 0; s < STROKES; s++) {
    const row = s % 14, col = Math.floor(s / 14);
    const x0 = box.x + 20 + col * 110, y0 = box.y + 25 + row * 48;
    await page.mouse.move(x0, y0); await page.mouse.down();
    for (let i = 1; i <= PTS; i++) await page.mouse.move(x0 + i * 1.1, y0 + Math.sin(i / 5) * 14);
    await page.mouse.up();
  }
  await page.waitForTimeout(600);
  const { work, ts, strokes, cls } = await page.evaluate(() => ({ cls: document.documentElement.className, work: window.__work.filter(w => w > 0.02), ts: window.__ts, strokes: document.querySelector('[data-strokes]')?.dataset.strokes }));
  const iv = ts.slice(1).map((t, i) => t - ts[i]).sort((a, b) => a - b);
  work.sort((a, b) => a - b);
  await ctx.close();
  return { renderer: outline ? 'outline (pressure + wet settle)' : 'classic', htmlClass: cls, frames: iv.length,
    interval_ms: { p50: +pct(iv, .5).toFixed(2), p95: +pct(iv, .95).toFixed(2), p99: +pct(iv, .99).toFixed(2), max: +iv[iv.length - 1].toFixed(2) },
    over_16_7ms: `${(iv.filter(x => x > 16.7 * 1.5).length / iv.length * 100).toFixed(2)}% of frames > 25ms`,
    callback_ms: { n: work.length, p50: +pct(work, .5).toFixed(3), p95: +pct(work, .95).toFixed(3), p99: +pct(work, .99).toFixed(3), max: +work[work.length - 1].toFixed(3) } };
}
const out = [await run(false), await run(true)];
console.log(JSON.stringify({ strokes: STROKES, pointsPerStroke: PTS, dpr: 2, note: 'headless Chromium on a Mac, synthetic mouse; not iPad evidence', results: out }, null, 2));
await browser.close(); await server.close();
