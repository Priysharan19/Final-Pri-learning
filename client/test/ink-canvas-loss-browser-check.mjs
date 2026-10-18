// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Ink canvas — handwriting never vanishes (#449).
//
// The owner saw, on Windows 11 Chrome (dark theme, Write mode): a blank writing
// canvas straight after writing, Submit disabled, "Not saved on this device".
// This check reproduces the mechanisms that can take ink off the shared canvas
// and pins the contract that keeps it there, with real browser bitmaps and
// real pointer input:
//
//   · a ResizeObserver callback whose pixel dimensions are unchanged (fractional
//     layout widths under a fractional devicePixelRatio) must not touch the
//     bitmaps — assigning canvas.width clears a bitmap even when the value is
//     the same, and that is the in-progress stroke gone;
//   · a parent re-render that changes the strokes callback's identity must not
//     tear the ResizeObserver / pointer subscription down mid-stroke;
//   · a real resize must redraw committed AND in-progress ink;
//   · a cancelled stroke (pointercancel) must commit what was written and must
//     not leave the canvas deaf to the next pen-down;
//   · a theme flip repaints committed ink in the new colour, never loses it;
//   · a canvas whose first real pixel size equals a fresh <canvas>'s default
//     300×150 bitmap (the scribble pad at 75 % zoom) still paints: "the
//     bitmap did not change" is not "the contexts are ready".
//
// Matrix: Chromium and WebKit × devicePixelRatio 1.25 and 1.5 (Windows scale
// factors) × mouse (trusted input) and pen (Chromium: trusted pen via CDP with
// pressure; WebKit: PointerEvent pointerType 'pen'), dark colour scheme.
//
// EVIDENCE CLASS. Emulated: a headless browser on the machine running this
// check, with the device scale factors and pointer types of a Windows laptop.
// It is not Windows 11 hardware, not a real Pencil or Surface pen, and proves
// nothing about a GPU compositor it never ran on.
//
// Run:  node client/test/ink-canvas-loss-browser-check.mjs [--browser=chromium|webkit]
// ─────────────────────────────────────────────────────────────────────────────
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import { chromium, webkit } from '@playwright/test';

const clientRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const only = process.argv.find(a => a.startsWith('--browser='))?.slice(10) || null;
const DPRS = [1.25, 1.5];
const POINTERS = ['mouse', 'pen'];

let pass = 0;
const failures = [];
const check = (name, condition, detail = '') => {
  if (condition) { pass++; return true; }
  failures.push(`${name}${detail ? `\n      ${detail}` : ''}`);
  console.log(`  ✖ ${name}${detail ? `  — ${detail}` : ''}`);
  return false;
};

// ── In-page probes ───────────────────────────────────────────────────────────

/** Non-transparent pixels on a canvas, plus its bitmap size. */
const scan = (selector) => {
  const c = document.querySelector(selector);
  if (!c) return { ink: 0, width: 0, height: 0 };
  const data = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
  let ink = 0;
  for (let i = 3; i < data.length; i += 4) if (data[i] > 0) ink++;
  return { ink, width: c.width, height: c.height };
};

/** Count every assignment to canvas.width / canvas.height (each one clears the bitmap). */
const instrument = () => {
  const width = Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype, 'width');
  const height = Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype, 'height');
  window.__bitmapWrites = 0;
  for (const canvas of document.querySelectorAll('.ink-canvas')) {
    Object.defineProperty(canvas, 'width', {
      configurable: true,
      get() { return width.get.call(this); },
      set(next) { window.__bitmapWrites++; width.set.call(this, next); }
    });
    Object.defineProperty(canvas, 'height', {
      configurable: true,
      get() { return height.get.call(this); },
      set(next) { window.__bitmapWrites++; height.set.call(this, next); }
    });
  }
  // The pointer id of the stroke in progress, for a scripted pointercancel.
  window.__lastPointer = null;
  document.addEventListener('pointerdown', e => { window.__lastPointer = { id: e.pointerId, type: e.pointerType }; }, true);
};

const frames = (page, n = 2) => page.evaluate(n => new Promise(ok => {
  const step = k => (k <= 0 ? ok() : requestAnimationFrame(() => step(k - 1)));
  step(n);
}), n);

// ── Pointer drivers ──────────────────────────────────────────────────────────
// mouse: Playwright's trusted mouse. pen: trusted pen through CDP in Chromium
// (pointerType 'pen', pressure, pointerrawupdate and coalescing as a real pen
// gives them); WebKit has no pen injection, so there a PointerEvent with
// pointerType 'pen' is dispatched on the live canvas.

async function penDriver(page, browserName) {
  if (browserName === 'chromium') {
    const cdp = await page.context().newCDPSession(page);
    const send = (type, x, y, extra = {}) => cdp.send('Input.dispatchMouseEvent', {
      type, x, y, pointerType: 'pen', button: 'left', clickCount: type === 'mousePressed' ? 1 : 0,
      buttons: type === 'mouseReleased' ? 0 : 1, force: type === 'mouseReleased' ? 0 : 0.62, ...extra
    });
    return {
      down: (x, y) => send('mousePressed', x, y),
      move: (x, y) => send('mouseMoved', x, y),
      up: (x, y) => send('mouseReleased', x, y)
    };
  }
  const fire = (type, x, y) => page.evaluate(({ type, x, y }) => {
    const target = document.querySelector('.ink-canvas-live');
    target.dispatchEvent(new PointerEvent(type, {
      bubbles: true, cancelable: true, composed: true, pointerId: 7, pointerType: 'pen', isPrimary: true,
      clientX: x, clientY: y, pressure: type === 'pointerup' ? 0 : 0.62,
      button: type === 'pointermove' ? -1 : 0, buttons: type === 'pointerup' ? 0 : 1
    }));
  }, { type, x, y });
  return {
    down: (x, y) => fire('pointerdown', x, y),
    move: (x, y) => fire('pointermove', x, y),
    up: (x, y) => fire('pointerup', x, y)
  };
}

async function driverFor(page, kind, browserName) {
  if (kind === 'pen') return penDriver(page, browserName);
  return {
    down: async (x, y) => { await page.mouse.move(x, y); await page.mouse.down(); },
    move: (x, y) => page.mouse.move(x, y),
    up: async (x, y) => { await page.mouse.move(x, y); await page.mouse.up(); }
  };
}

/** Move the pointer along a gently waving line between two fractions of the canvas. */
async function trace(page, drv, box, { y, from, to, steps = 10 }) {
  for (let i = 1; i <= steps; i++) {
    const fx = from + (to - from) * i / steps;
    await drv.move(box.x + box.width * fx, box.y + box.height * (y + (i % 2 ? 0.015 : 0)));
  }
}

const liveBox = (page) => page.locator('.ink-canvas-live').boundingBox();
const strokeCount = (page) => page.evaluate(() => window.__ink.getStrokes().length);
const waitStrokes = (page, n) => page.waitForFunction(n => document.getElementById('stroke-count')?.textContent === String(n), n, { timeout: 5000 }).then(() => true, () => false);
const cancelActive = (page) => page.evaluate(() => {
  const last = window.__lastPointer;
  const target = document.querySelector('.ink-canvas-live');
  target.dispatchEvent(new PointerEvent('pointercancel', {
    bubbles: true, cancelable: false, composed: true,
    pointerId: last?.id ?? 1, pointerType: last?.type || 'mouse', isPrimary: true
  }));
  return last;
});

// ── One cell of the matrix ───────────────────────────────────────────────────

async function runCell({ browser, browserName, url, dpr, pointer }) {
  const tag = `${browserName} dpr=${dpr} ${pointer}`;
  const ctx = await browser.newContext({ viewport: { width: 1100, height: 720 }, deviceScaleFactor: dpr, colorScheme: 'dark', hasTouch: pointer === 'pen' });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e?.message || e)));
  try {
    await page.goto(url);
    await page.waitForSelector('.ink-canvas-live');
    await page.waitForFunction(() => document.querySelector('.ink-canvas-base')?.width > 0);
    const dark = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--ink').trim());
    check(`${tag} · the fixture is in the dark theme the owner used`, dark === '#edebe4', `--ink ${dark}`);
    const base0 = await page.evaluate(scan, '.ink-canvas-base');
    check(`${tag} · bitmaps are sized for the device pixel ratio`,
      base0.width === Math.round(620 * dpr) && base0.height === Math.round(300 * dpr), JSON.stringify(base0));
    await page.evaluate(instrument);
    const drv = await driverFor(page, pointer, browserName);

    // ── 1 · same-size churn in the middle of a stroke ───────────────────────
    let box = await liveBox(page);
    await drv.down(box.x + box.width * 0.15, box.y + box.height * 0.30);
    await trace(page, drv, box, { y: 0.30, from: 0.15, to: 0.40 });
    await frames(page);
    const liveMid = await page.evaluate(scan, '.ink-canvas-live');
    check(`${tag} · the live stroke is on the live layer while the pen is down`, liveMid.ink > 20, `${liveMid.ink} px`);
    // What the real parents do while a student writes: re-render with a new
    // callback (InkAnswer: a reading arrived / cleared) and nudge the layout by
    // a fraction of a CSS pixel (fluid width under a fractional DPR). Neither
    // changes the canvas's pixel size.
    for (let i = 0; i < 3; i++) await page.evaluate(() => window.__ink.poke());
    await page.evaluate(() => window.__ink.setWidth('620.4px'));
    await page.waitForFunction(() => document.getElementById('render-count')?.textContent === '3');
    await frames(page, 3);
    const writes1 = await page.evaluate(() => window.__bitmapWrites);
    const liveAfter = await page.evaluate(scan, '.ink-canvas-live');
    check(`${tag} · a same-size ResizeObserver callback and a callback-identity re-render never reset the bitmaps`,
      writes1 === 0, `${writes1} canvas.width/height assignments`);
    check(`${tag} · the in-progress stroke is still visible after that churn`,
      liveAfter.ink >= liveMid.ink && liveAfter.width === liveMid.width, `${liveMid.ink} → ${liveAfter.ink} px; width ${liveMid.width} → ${liveAfter.width}`);
    await trace(page, drv, box, { y: 0.30, from: 0.40, to: 0.65 });
    await drv.up(box.x + box.width * 0.65, box.y + box.height * 0.30);
    check(`${tag} · the stroke written through the churn is committed`, await waitStrokes(page, 1), `strokes ${await strokeCount(page)}`);
    const base1 = await page.evaluate(scan, '.ink-canvas-base');
    check(`${tag} · committed ink is painted on the base layer`, base1.ink > 100, `${base1.ink} px`);
    check(`${tag} · the Submit gate (inkHasStrokes mirror) opens`, await page.locator('#submit').isEnabled());
    await page.waitForTimeout(1200);
    const base1b = await page.evaluate(scan, '.ink-canvas-base');
    check(`${tag} · and it is still there 1.2 s later`, base1b.ink === base1.ink, `${base1.ink} → ${base1b.ink} px`);

    // ── 2 · a real resize while the pen is down ─────────────────────────────
    box = await liveBox(page);
    await drv.down(box.x + box.width * 0.20, box.y + box.height * 0.60);
    await trace(page, drv, box, { y: 0.60, from: 0.20, to: 0.40, steps: 5 });
    await frames(page);
    await page.evaluate(() => window.__ink.setWidth(480));
    await page.waitForFunction(dpr => document.querySelector('.ink-canvas-base')?.width === Math.round(480 * dpr), dpr);
    await frames(page, 2);
    const liveResized = await page.evaluate(scan, '.ink-canvas-live');
    const baseResized = await page.evaluate(scan, '.ink-canvas-base');
    check(`${tag} · after a real resize the committed line is redrawn`, baseResized.ink > 100, `${baseResized.ink} px`);
    check(`${tag} · and the in-progress stroke is replayed on the live layer`, liveResized.ink > 20, `${liveResized.ink} px`);
    const resizedBox = await liveBox(page);
    await trace(page, drv, resizedBox, { y: 0.60, from: 0.45, to: 0.70, steps: 5 });
    await drv.up(resizedBox.x + resizedBox.width * 0.70, resizedBox.y + resizedBox.height * 0.60);
    check(`${tag} · the stroke that spanned the resize is committed with its points`,
      await waitStrokes(page, 2) && (await page.evaluate(() => window.__ink.getStrokes()[1]?.points.length)) > 4,
      `strokes ${await strokeCount(page)}`);
    const base2 = await page.evaluate(scan, '.ink-canvas-base');
    check(`${tag} · both lines are on the base layer`, base2.ink > baseResized.ink, `${baseResized.ink} → ${base2.ink} px`);
    const writes2 = await page.evaluate(() => window.__bitmapWrites);
    // The height is unchanged, so the true value is one width assignment per
    // layer: a height write here would be a needless clear of both bitmaps.
    check(`${tag} · the real resize touched each bitmap once (width only)`, writes2 === 2, `${writes2} assignments`);

    // ── 3 · a cancelled stroke keeps what was written and the next one works ─
    box = await liveBox(page);
    await drv.down(box.x + box.width * 0.20, box.y + box.height * 0.80);
    await trace(page, drv, box, { y: 0.80, from: 0.20, to: 0.50, steps: 6 });
    await frames(page);
    const cancelled = await cancelActive(page);
    check(`${tag} · the cancel was addressed to the stroke in progress`, !!cancelled && (pointer === 'pen' ? cancelled.type === 'pen' : cancelled.type === 'mouse'), JSON.stringify(cancelled));
    check(`${tag} · a pointercancel commits the ink written so far`, await waitStrokes(page, 3), `strokes ${await strokeCount(page)}`);
    // The browser's own pointerup for that pointer may still arrive; it must be ignored.
    await drv.up(box.x + box.width * 0.50, box.y + box.height * 0.80);
    await page.waitForTimeout(100);
    check(`${tag} · a late pointerup after the cancel adds nothing`, (await strokeCount(page)) === 3, `strokes ${await strokeCount(page)}`);
    const writes3 = await page.evaluate(() => window.__bitmapWrites);
    await drv.down(box.x + box.width * 0.55, box.y + box.height * 0.80);
    await trace(page, drv, box, { y: 0.80, from: 0.55, to: 0.85, steps: 6 });
    await drv.up(box.x + box.width * 0.85, box.y + box.height * 0.80);
    check(`${tag} · the canvas is not deaf after a cancel: the next stroke is committed`, await waitStrokes(page, 4), `strokes ${await strokeCount(page)}`);

    // ── 4 · the theme flips under committed ink ─────────────────────────────
    const beforeTheme = await page.evaluate(scan, '.ink-canvas-base');
    await page.evaluate(() => window.__ink.setTheme('light'));
    await frames(page, 2);
    const afterTheme = await page.evaluate(scan, '.ink-canvas-base');
    const inkColour = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--ink').trim());
    check(`${tag} · a theme flip repaints committed ink in the new colour and loses none`,
      inkColour === '#111' && afterTheme.ink > 0 && Math.abs(afterTheme.ink - beforeTheme.ink) <= beforeTheme.ink * 0.05,
      `${beforeTheme.ink} → ${afterTheme.ink} px, --ink ${inkColour}`);
    const writes4 = await page.evaluate(() => window.__bitmapWrites);
    check(`${tag} · neither the cancel nor the theme flip reset a bitmap`, writes4 === writes3 && writes3 === writes2, `${writes2} → ${writes3} → ${writes4}`);

    // ── 5 · undo keeps the rest ─────────────────────────────────────────────
    await page.evaluate(() => window.__ink.undo());
    check(`${tag} · undo removes one stroke and keeps the others painted`,
      await waitStrokes(page, 3) && (await page.evaluate(scan, '.ink-canvas-base')).ink > 100);
    check(`${tag} · no uncaught error reached the page`, errors.length === 0, errors.slice(0, 2).join(' · '));
  } catch (err) {
    check(`${tag} · the cell ran to the end`, false, String(err?.stack || err).split('\n').slice(0, 3).join(' | '));
  } finally {
    await ctx.close();
  }
}

// ── Default-bitmap first mount ───────────────────────────────────────────────
// A fresh <canvas> already has a 300×150 bitmap. When the first real size is
// exactly that, the sizing pass finds nothing to change — and must still prime
// the contexts, or every stroke is recorded (Submit opens) but never painted.
// Two sizes that land there: a 150 px sheet in a 300 px column at dpr 1, and
// the QuestionCard scribble pad (height 200) in a 400 px column at Chrome's
// 75 % zoom (dpr 0.75).
const DEFAULT_BITMAP_CELLS = [
  { height: 150, width: 300, dpr: 1 },
  { height: 200, width: 400, dpr: 0.75 }
];

async function runDefaultBitmapCell({ browser, browserName, url, height, width, dpr }) {
  const tag = `${browserName} dpr=${dpr} mouse · first mount at ${width}×${height} CSS px (default 300×150 bitmap)`;
  const ctx = await browser.newContext({ viewport: { width: 1100, height: 720 }, deviceScaleFactor: dpr, colorScheme: 'dark' });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e?.message || e)));
  try {
    await page.goto(`${url}?height=${height}&width=${width}`);
    await page.waitForSelector('.ink-canvas-live');
    await page.waitForFunction(() => document.querySelector('.ink-canvas-base')?.width > 0);
    const base0 = await page.evaluate(scan, '.ink-canvas-base');
    // The premise: this cell really sits on the default bitmap. If it does not,
    // the cell proves nothing and says so rather than passing by accident.
    check(`${tag} · the pixel size is the default bitmap`, base0.width === 300 && base0.height === 150, JSON.stringify(base0));
    await page.evaluate(instrument);
    const drv = await driverFor(page, 'mouse', browserName);
    const box = await liveBox(page);
    await drv.down(box.x + box.width * 0.15, box.y + box.height * 0.40);
    await trace(page, drv, box, { y: 0.40, from: 0.15, to: 0.70, steps: 8 });
    await frames(page);
    const liveMid = await page.evaluate(scan, '.ink-canvas-live');
    check(`${tag} · the stroke under the pen is painted on the live layer`, liveMid.ink > 20, `${liveMid.ink} px`);
    await drv.up(box.x + box.width * 0.70, box.y + box.height * 0.40);
    check(`${tag} · the stroke is committed`, await waitStrokes(page, 1), `strokes ${await strokeCount(page)}`);
    const base1 = await page.evaluate(scan, '.ink-canvas-base');
    check(`${tag} · committed ink is painted on the base layer — not a blank sheet behind an open Submit`, base1.ink > 50, `${base1.ink} px`);
    const writes = await page.evaluate(() => window.__bitmapWrites);
    check(`${tag} · no bitmap was reset to get there`, writes === 0, `${writes} assignments`);
    check(`${tag} · no uncaught error reached the page`, errors.length === 0, errors.slice(0, 2).join(' · '));
  } catch (err) {
    check(`${tag} · the cell ran to the end`, false, String(err?.stack || err).split('\n').slice(0, 3).join(' | '));
  } finally {
    await ctx.close();
  }
}

// ── Entry ────────────────────────────────────────────────────────────────────

const server = await createServer({
  root: clientRoot, configFile: false, logLevel: 'silent', plugins: [react()],
  server: { host: '127.0.0.1', port: 0, strictPort: false }
});
try {
  await server.listen();
  const url = `http://127.0.0.1:${server.httpServer.address().port}/test/fixtures/ink-canvas-loss.html`;
  const engines = [['chromium', chromium], ['webkit', webkit]].filter(([name]) => !only || only === name);
  for (const [browserName, engine] of engines) {
    let browser;
    try { browser = await engine.launch({ headless: true }); }
    catch (err) {
      check(`${browserName} launches`, false, String(err?.message || err).split('\n')[0]);
      continue;
    }
    try {
      for (const dpr of DPRS) for (const pointer of POINTERS) await runCell({ browser, browserName, url, dpr, pointer });
      for (const cell of DEFAULT_BITMAP_CELLS) await runDefaultBitmapCell({ browser, browserName, url, ...cell });
    } finally {
      await browser.close();
    }
  }
} finally {
  await server.close();
}

console.log(`\nINK CANVAS LOSS (emulated Windows scale factors, dark theme, mouse + pen; not Windows 11 hardware evidence): ${pass} passed, ${failures.length} failed`);
if (failures.length) {
  console.log('\nfailures:');
  for (const f of failures) console.log('  ' + f);
  process.exit(1);
}
