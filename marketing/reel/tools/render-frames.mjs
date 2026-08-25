#!/usr/bin/env node
// Renders the reel to JPEG frames using headless Chrome over raw CDP — no
// dependencies (Node ≥22 for the built-in WebSocket client). Chromium taints
// canvases for any foreignObject SVG, so in-page readback is impossible; the
// compositor screenshot path has no such restriction and is pixel-exact.
//
//   node marketing/reel/tools/serve.mjs &          # the reel server on :4174
//   node marketing/reel/tools/render-frames.mjs [--fps 30] [--dur 0] [--quality 95]
//
// Frames land in marketing/reel/export/frames/f00000.jpg …; encode them with
// tools/export.html?frames=1 (see README).

import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const args = Object.fromEntries(process.argv.slice(2).map((a, i, all) =>
  a.startsWith('--') ? [a.slice(2), all[i + 1] && !all[i + 1].startsWith('--') ? all[i + 1] : '1'] : []).filter(p => p.length));
const FPS = Number(args.fps) || 30;
const LIMIT = Number(args.dur) || 0;
const QUALITY = Number(args.quality) || 95;
const BASE = args.base || 'http://localhost:4174';
const CHROME = args.chrome || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const ROOT = dirname(fileURLToPath(import.meta.url));
const OUT = join(ROOT, '..', 'export', 'frames');
const PROFILE = join(ROOT, '..', 'export', '.chrome-profile');
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

const chrome = spawn(CHROME, [
  '--headless=new', '--remote-debugging-port=0', `--user-data-dir=${PROFILE}`,
  '--no-first-run', '--no-default-browser-check', '--hide-scrollbars',
  '--force-device-scale-factor=1', '--window-size=2200,3960', 'about:blank',
], { stdio: ['ignore', 'ignore', 'pipe'] });
process.on('exit', () => { try { chrome.kill(); } catch {} });

const wsBrowserUrl = await new Promise((res, rej) => {
  let buf = '';
  const t = setTimeout(() => rej(new Error('Chrome did not report a DevTools endpoint')), 30000);
  chrome.stderr.on('data', (c) => {
    buf += c;
    const m = buf.match(/DevTools listening on (ws:\/\/\S+)/);
    if (m) { clearTimeout(t); res(m[1]); }
  });
  chrome.on('exit', (code) => rej(new Error('Chrome exited early (' + code + ')')));
});
const port = new URL(wsBrowserUrl).port;

// Find the about:blank page target and connect to it directly.
const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
const page = targets.find((t) => t.type === 'page');
if (!page) throw new Error('no page target');
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error('CDP connect failed')); });

let seq = 0;
const pending = new Map();
ws.onmessage = (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) {
    const { res, rej } = pending.get(msg.id);
    pending.delete(msg.id);
    msg.error ? rej(new Error(msg.error.message)) : res(msg.result);
  }
};
const cdp = (method, params = {}) => new Promise((res, rej) => {
  const id = ++seq;
  pending.set(id, { res, rej });
  ws.send(JSON.stringify({ id, method, params }));
});
const evaluate = async (expression) => {
  const r = await cdp('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error('page threw: ' + JSON.stringify(r.exceptionDetails.exception?.description || r.exceptionDetails.text));
  return r.result.value;
};

await cdp('Emulation.setDeviceMetricsOverride', { width: 2200, height: 3960, deviceScaleFactor: 1, mobile: false });
await cdp('Page.enable');
await cdp('Page.navigate', { url: `${BASE}/tools/frame.html` });

console.log('waiting for reel boot + fonts…');
const deadline = Date.now() + 90000;
for (;;) {
  const ok = await evaluate(`(()=>{const s=document.querySelector('svg[data-om-exportable-video-with-duration-secs]');
    return !!(s && s.getAttribute('data-om-sync-seek')==='true' && document.fonts && document.fonts.status==='loaded');})()`);
  if (ok) break;
  if (Date.now() > deadline) throw new Error('timeout waiting for the reel to boot');
  await new Promise((r) => setTimeout(r, 300));
}
await new Promise((r) => setTimeout(r, 1200)); // font-swap settle

const total = await evaluate(`+document.querySelector('svg[data-om-exportable-video-with-duration-secs]').getAttribute('data-om-exportable-video-with-duration-secs')`);
const rect = await evaluate(`(()=>{const r=document.querySelector('svg[data-om-exportable-video-with-duration-secs]').getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height};})()`);
if (Math.round(rect.w) !== 2160 || Math.round(rect.h) !== 3840)
  throw new Error(`stage is ${rect.w}×${rect.h}, expected 2160×3840 — fit-to-box scale is not 1`);

const dur = LIMIT > 0 ? Math.min(LIMIT, total) : total;
const frames = Math.round(dur * FPS);
console.log(`rendering ${frames} frames (${dur}s at ${FPS}fps) at 2160×3840, jpeg q${QUALITY}`);

const t0 = Date.now();
for (let i = 0; i < frames; i++) {
  const t = Math.min(dur - 0.0001, i / FPS);
  await evaluate(`(()=>{const s=document.querySelector('svg[data-om-exportable-video-with-duration-secs]');
    s.dispatchEvent(new CustomEvent('data-om-seek-to-time-frame',{detail:{time:${t},sync:true}}));return true;})()`);
  const shot = await cdp('Page.captureScreenshot', {
    format: 'jpeg', quality: QUALITY, fromSurface: true, captureBeyondViewport: true,
    clip: { x: rect.x, y: rect.y, width: 2160, height: 3840, scale: 1 },
  });
  writeFileSync(join(OUT, 'f' + String(i).padStart(5, '0') + '.jpg'), Buffer.from(shot.data, 'base64'));
  if (i % 30 === 0 && i > 0) {
    const el = (Date.now() - t0) / 1000;
    console.log(`frame ${i}/${frames} — ${(i / el).toFixed(1)} fps — eta ${Math.round((frames - i) / (i / el))}s`);
  }
}
writeFileSync(join(OUT, 'manifest.json'), JSON.stringify({ frames, fps: FPS, width: 2160, height: 3840, duration: dur }));
console.log(`done: ${frames} frames in ${((Date.now() - t0) / 1000).toFixed(0)}s → ${OUT}`);
ws.close();
chrome.kill();
