// Renders the diagram kit's Riemann slider and checks that the y-axis passes through x = 0.
const { chromium } = await import(new URL('../../../client/node_modules/@playwright/test/index.mjs', import.meta.url).href);
const { createServer } = await import(new URL('../../../client/node_modules/vite/dist/node/index.js', import.meta.url).href);
const CLIENT = new URL('../../../client/', import.meta.url).pathname;
const OUT = new URL('./shots/', import.meta.url).pathname;
const server = await createServer({ root: CLIENT, configFile: CLIENT + 'vite.config.js', logLevel: 'error', server: { host: '127.0.0.1', port: 0, hmr: false, watch: null }, optimizeDeps: { entries: ['test/support/diagram-gallery.html'] } });
await server.listen();
const base = `http://127.0.0.1:${server.httpServer.address().port}`;
const browser = await chromium.launch(); const page = await browser.newPage({ viewport: { width: 900, height: 1000 }, deviceScaleFactor: 2 });
await page.goto(base + '/test/support/diagram-gallery.html'); await page.waitForSelector('[data-diagram-interactive]');
const el = page.locator('[data-diagram-interactive]', { hasText: 'Add rectangles under the curve' }).first();
await el.scrollIntoViewIfNeeded(); await el.screenshot({ path: OUT + 'riemann-axis.png' });
const geo = await el.evaluate(root => { const svg = root.querySelector('svg'); const ax = [...svg.querySelectorAll('.dg-axis')].map(l => ({ x1: +l.getAttribute('x1'), x2: +l.getAttribute('x2'), y1: +l.getAttribute('y1'), y2: +l.getAttribute('y2') })); return ax; });
console.log(JSON.stringify(geo));
await browser.close(); await server.close();
