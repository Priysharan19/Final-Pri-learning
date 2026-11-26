// Screenshots of the teacher-marked page. node client/test/support/teacher-shots.mjs <outdir> [case] [query]
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
const CLIENT = fileURLToPath(new URL('../..', import.meta.url));
const out = process.argv[2]; const which = process.argv[3] || 'owner19'; const extra = process.argv[4] || 'criteria=3'; mkdirSync(out, { recursive: true });
const server = await createServer({ root: CLIENT, configFile: fileURLToPath(new URL('../../vite.config.js', import.meta.url)), logLevel: 'error',
  server: { host: '127.0.0.1', port: 0, hmr: false, watch: null, fs: { strict: false } }, optimizeDeps: { entries: ['test/support/marked-page-gallery.html'] } });
await server.listen();
const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
const browser = await chromium.launch();
for (const [name, viewport] of [['desktop', { width: 1440, height: 1000 }], ['phone', { width: 390, height: 844 }]]) {
  for (const theme of ['light', 'dark']) {
    const ctx = await browser.newContext({ viewport, colorScheme: theme }); const page = await ctx.newPage();
    page.on('console', m => { if (m.type() === 'error') console.log('console error:', m.text()); }); page.on('pageerror', e => console.log('page error:', e.message));
    for (const view of ['marked', 'detailed', 'original']) {
      await page.goto(`${origin}/test/support/marked-page-gallery.html?case=${which}&source=photo&edition=prithagoras&theme=${theme}&teacher=1&${extra}`, { waitUntil: 'networkidle' });
      await page.evaluate(v => localStorage.setItem('pri.markedPage.view', v), view); await page.reload({ waitUntil: 'networkidle' });
      await page.waitForSelector('[data-marked-page]'); await page.waitForTimeout(900);
      await page.screenshot({ path: `${out}/${which}-${view}-${name}-${theme}.png`, fullPage: true });
    }
    await ctx.close();
  }
}
await browser.close(); await server.close(); console.log('shots in', out);
