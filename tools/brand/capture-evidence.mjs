// Pri Learning · E4 visual evidence: each edition's sign-in, header, About card and app icons,
// light and dark, at phone (390 pt) and iPad (1024 pt) widths, from real production builds.
// Synthetic browser captures (Playwright Chromium, the account server stood in by
// client/test/support/mock-account.mjs) — not physical-device evidence.
//
//   (in client/) PRI_EDITION=priyabhata  npx vite build --outDir <a>
//   (in client/) PRI_EDITION=prithagoras npx vite build --outDir <b>
//   node tools/brand/capture-evidence.mjs <repo> <a> <b> docs/brand/evidence/e4
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync, mkdirSync } from 'node:fs';
import { join, extname } from 'node:path';
import { createRequire } from 'node:module';

const [repo, distA, distB, out] = process.argv.slice(2);
const require = createRequire(join(repo, 'client/package.json'));
const { chromium } = require('playwright');
const { mockAccountServer, enterThroughCard } = await import(join(repo, 'client/test/support/mock-account.mjs'));
mkdirSync(out, { recursive: true });

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.wasm': 'application/wasm' };
function serve(root) {
  const server = createServer((req, res) => {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    let file = join(root, p);
    if (!file.startsWith(root) || !existsSync(file) || statSync(file).isDirectory()) file = join(root, 'index.html');
    res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream' });
    res.end(readFileSync(file));
  });
  return new Promise(r => server.listen(0, '127.0.0.1', () => r({ url: `http://127.0.0.1:${server.address().port}`, close: () => server.close() })));
}

const HEALTH = (readFileSync(join(repo, 'client/src/platform/cloudTransport.js'), 'utf8').match(/HEALTH_SERVICE = '([^']+)'/) || [])[1];
const SIZES = { phone: { width: 390, height: 844 }, ipad: { width: 1024, height: 1366 } };
const browser = await chromium.launch();
for (const [edition, dist] of [['priyabhata', distA], ['prithagoras', distB]]) {
  const srv = await serve(dist);
  for (const scheme of ['light', 'dark']) {
    for (const [size, viewport] of Object.entries(SIZES)) {
      const ctx = await browser.newContext({ viewport, deviceScaleFactor: 2, colorScheme: scheme, serviceWorkers: 'block', isMobile: size === 'phone', hasTouch: true });
      const page = await ctx.newPage();
      const mock = mockAccountServer({ account: { id: 'acct_e2e_e4', email: `e4-${edition}@example.test`, name: 'Asha', role: 'student' } });
      await page.route('**/v1/**', async route => {
        if (new URL(route.request().url()).pathname === '/v1/health') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ service: HEALTH, edition }) });
        if (!(await mock.handle(route))) await route.fulfill({ status: 404, contentType: 'application/json', body: '{"error":{"code":"NOT_FOUND"}}' }); });
      await page.goto(srv.url + '/', { waitUntil: 'domcontentloaded' });
      await page.locator('[data-signin-card="page"]').waitFor({ timeout: 60000 });
      await page.waitForTimeout(600);
      await page.screenshot({ path: join(out, `${edition}-signin-${scheme}-${size}.png`) });
      await enterThroughCard(page, { email: `e4-${edition}@example.test` });
      await page.goto(srv.url + '/', { waitUntil: 'domcontentloaded' });
      await page.locator('[data-instrument-bar]').waitFor({ timeout: 30000 });
      await page.waitForTimeout(800);
      const bar = page.locator('[data-instrument-bar]');
      const box = await bar.boundingBox();
      await page.screenshot({ path: join(out, `${edition}-header-${scheme}-${size}.png`), clip: { x: 0, y: 0, width: viewport.width, height: Math.min(viewport.height, Math.ceil((box?.y || 0) + (box?.height || 64) + 160)) } });
      if (size === 'ipad') {
        await page.goto(srv.url + '/settings', { waitUntil: 'domcontentloaded' });
        const about = page.locator('[data-about-edition]');
        await about.waitFor({ timeout: 30000 }).catch(() => {});
        if (await about.count()) { await about.scrollIntoViewIfNeeded(); await about.screenshot({ path: join(out, `${edition}-about-${scheme}.png`) }); }
      }
      console.log(edition, scheme, size, 'title:', await page.title());
      await ctx.close();
    }
  }
  // App icon sheet: the PWA icons this build serves, and the native sources, on a neutral ground.
  for (const scheme of ['light', 'dark']) {
    const ctx = await browser.newContext({ viewport: { width: 980, height: 300 }, deviceScaleFactor: 2, colorScheme: scheme });
    const page = await ctx.newPage();
    const b64 = rel => readFileSync(join(dist, rel)).toString('base64');
    const native = rel => readFileSync(join(repo, 'client/brand', edition, rel)).toString('base64');
    const bg = scheme === 'dark' ? '#1a1a1b' : '#f4f3ef', fg = scheme === 'dark' ? '#ecebe6' : '#1b1a17';
    const tile = (src, label, round = 40) => `<figure><img src="${src}" width="160" height="160" style="border-radius:${round}px"><figcaption>${label}</figcaption></figure>`;
    const icons = scheme === 'light'
      ? [tile(`data:image/png;base64,${b64('icons/icon-512.png')}`, 'PWA icon 512'), tile(`data:image/png;base64,${b64('icons/icon-maskable-192.png')}`, 'maskable 192', 80), tile(`data:image/svg+xml;base64,${b64('favicon.svg')}`, 'favicon (light)', 8), tile(`data:image/png;base64,${native('source/native/ios/AppIcon-1024.png')}`, 'iOS source, light')]
      : [tile(`data:image/png;base64,${native('source/native/ios/AppIcon-dark-1024.png')}`, 'iOS source, dark'), tile(`data:image/png;base64,${native('source/native/ios/AppIcon-tinted-1024.png')}`, 'iOS source, tinted'), tile(`data:image/svg+xml;base64,${b64('favicon.svg')}`, 'favicon (dark)', 8), tile(`data:image/png;base64,${b64('icons/icon-512.png')}`, 'PWA icon 512')];
    await page.setContent(`<!doctype html><html><body style="margin:0;background:${bg};color:${fg};font:13px system-ui;display:flex;gap:28px;padding:40px 36px">${icons.join('')}<style>figure{margin:0;text-align:center}figcaption{margin-top:10px}</style></body></html>`);
    await page.waitForTimeout(300);
    await page.screenshot({ path: join(out, `${edition}-icon-${scheme}.png`) });
    await ctx.close();
  }
  srv.close();
}
await browser.close();
console.log('done');
