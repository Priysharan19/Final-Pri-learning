// Screenshots of the marked page for the owner's stationary-points case: 1440 and 390, ink and photo, one theme.
//   node client/test/support/marked-page-shots.mjs <outdir> [light|dark]
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
const CLIENT = fileURLToPath(new URL('../..', import.meta.url));
const out = process.argv[2]; const theme = process.argv[3] || 'light'; mkdirSync(out, { recursive: true });
const server = await createServer({ root: CLIENT, configFile: fileURLToPath(new URL('../../vite.config.js', import.meta.url)), logLevel: 'error',
  server: { host: '127.0.0.1', port: 0, hmr: false, watch: null }, optimizeDeps: { entries: ['test/support/marked-page-gallery.html'] } });
await server.listen();
const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
const browser = await chromium.launch();
for (const [name, viewport] of [['1440', { width: 1440, height: 900 }], ['390', { width: 390, height: 844 }]]) {
  const ctx = await browser.newContext({ viewport, colorScheme: theme }); const page = await ctx.newPage();
  for (const [c, source] of [['stationary', 'ink'], ['stationary', 'photo'], ['buoy', 'ink']]) {
    await page.goto(`${origin}/test/support/marked-page-gallery.html?case=${c}&source=${source}&edition=prithagoras&theme=${theme}`, { waitUntil: 'networkidle' });
    await page.waitForSelector('[data-marked-page]'); await page.waitForTimeout(300);
    await page.screenshot({ path: `${out}/${c}-${source}-${name}-${theme}.png`, fullPage: true });
  }
  await ctx.close();
}
await browser.close(); await server.close(); console.log('shots in', out);
