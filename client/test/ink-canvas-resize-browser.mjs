/**
 * Regression for owner-observed disappearing ink (#449).
 * Uses real Chromium/WebKit canvas bitmaps and pointer input, but a local
 * isolated React component (not a claim of Windows/Pencil/staged acceptance).
 *
 * cd client && node test/ink-canvas-resize-browser.mjs
 */
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { createServer } from 'vite';
import { chromium, webkit } from 'playwright';

const clientRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const server = await createServer({
  root: clientRoot, configFile: false,
  server: { host: '127.0.0.1', port: 0, strictPort: false }
});
let passed = 0;
const check = (name, condition) => {
  assert.ok(condition, name);
  console.log('PASS:', name);
  passed++;
};
const scan = () => {
  const c = document.querySelector('.ink-canvas-base');
  const data = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
  let ink = 0;
  for (let i = 3; i < data.length; i += 4) if (data[i] > 0) ink++;
  return { ink, width: c.width, height: c.height };
};
const draw = async (page, fracY = 0.33, xStart = 0.18, xEnd = 0.63) => {
  const box = await page.locator('.ink-canvas-live').boundingBox();
  await page.mouse.move(box.x + box.width * xStart, box.y + box.height * fracY);
  await page.mouse.down();
  for (let i = 1; i <= 10; i++) {
    await page.mouse.move(box.x + box.width * (xStart + (xEnd - xStart) * i / 10),
      box.y + box.height * (fracY + (i % 2 ? 0.018 : 0)));
  }
  await page.mouse.up();
};

try {
  await server.listen();
  const address = server.httpServer.address();
  const url = `http://127.0.0.1:${address.port}/test/fixtures/ink-canvas-resize.html`;
  for (const [name, browserType] of [['Chromium', chromium], ['WebKit', webkit]]) {
    const browser = await browserType.launch({ headless: true });
    try {
      const page = await browser.newPage({ viewport: { width: 1100, height: 720 } });
      const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      await page.goto(url);
      await page.waitForSelector('.ink-canvas-live');
      await page.waitForFunction(() => document.querySelector('.ink-canvas-base')?.width > 0);
      // Instrument assignment to width, which clears bitmap even if unchanged.
      await page.evaluate(() => {
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
      });
      await draw(page);
      await page.waitForFunction(() => document.getElementById('stroke-count')?.textContent === '1');
      const first = await page.evaluate(scan);
      check(`${name} first line is committed to base bitmap`, first.ink > 100 && first.width > 0);
      await page.waitForTimeout(1200);
      const paused = await page.evaluate(scan);
      check(`${name} line persists after pause`, paused.ink === first.ink);
      await page.evaluate(() => window.__inkTest.poke());
      await page.waitForTimeout(100);
      const stable = await page.evaluate(scan);
      const widthResets = await page.evaluate(() => window.__bitmapWrites);
      check(`${name} callback-change rerender retains ink and never resets bitmap`,
        stable.ink === first.ink && widthResets === 0);
      await draw(page, 0.60, 0.25, 0.77);
      await page.waitForFunction(() => document.getElementById('stroke-count')?.textContent === '2');
      const second = await page.evaluate(scan);
      check(`${name} multiple handwriting lines retained`, second.ink > stable.ink);
      // Resize WHILE pen is physically down and moving; the live layer must
      // replay current points and the committed bitmap must survive.
      const box = await page.locator('.ink-canvas-live').boundingBox();
      await page.mouse.move(box.x + box.width * 0.25, box.y + box.height * 0.78);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width * 0.40, box.y + box.height * 0.78, { steps: 5 });
      await page.evaluate(() => window.__inkTest.resize(480));
      await page.waitForFunction(() => document.querySelector('.ink-canvas-base')?.width === 480);
      const resized = await page.locator('.ink-canvas-live').boundingBox();
      await page.mouse.move(resized.x + resized.width * 0.68, resized.y + resized.height * 0.78, { steps: 5 });
      await page.mouse.up();
      await page.waitForFunction(() => document.getElementById('stroke-count')?.textContent === '3');
      const third = await page.evaluate(scan);
      check(`${name} in-progress stroke and older lines survive real resize`,
        third.ink > 100 && (await page.evaluate(() => window.__inkTest.getStrokes().length)) === 3 &&
        (await page.evaluate(() => window.__inkTest.getStrokes()[2].points.length)) > 2);
      await page.evaluate(() => window.__inkTest.undo());
      await page.waitForFunction(() => document.getElementById('stroke-count')?.textContent === '2');
      check(`${name} undo preserves previous handwriting`, (await page.evaluate(scan)).ink > 100);
      check(`${name} browser errors absent`, errors.length === 0);
      await page.close();
    } finally {
      await browser.close();
    }
  }
  console.log(`INK CANVAS RESIZE BROWSER: ${passed} PASS`);
} finally {
  await server.close();
}
