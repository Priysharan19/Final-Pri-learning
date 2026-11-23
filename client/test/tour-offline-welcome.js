// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · a signed-out visitor opens /welcome with the network gone
//
// Bug: with the Prithagoras service worker installed and the device offline,
// /welcome showed "Prithagoras stopped mid-render". The landing page is a lazy
// chunk that is deliberately not in the offline copy (client/vite.config.js,
// ON_DEMAND "public landing"), so its import failed and the failure reached the
// root error boundary. components/ChunkBoundary.jsx now tells that case plainly
// ("could not load", with Try again) and leaves every other error to the root.
//
// This builds the client for Prithagoras, serves it from a loopback file server
// (no platform server: nothing here is marked, checked or revealed), installs
// the REAL service worker in Chromium (WebKit's setOffline blocks the worker, so
// this is Chromium only), goes offline and opens /welcome and /welcome/marking:
//
//   · the crash screen never appears; the page says it could not load, offers
//     Try again, and shows no marking, no answer and no account control;
//   · the failure was the page's own file (the import failed), not a render fault;
//   · back online, Try again brings the real landing page;
//   · CONTROL: a genuine render error is still the crash screen (the boundary
//     does not hide faults), and online /welcome never showed the notice.
//
// SYNTHETIC: Playwright Chromium, a built client, a file server. Not a device.
//
// Run:  node client/test/tour-offline-welcome.js
// ─────────────────────────────────────────────────────────────────────────────
import { chromium } from '@playwright/test';
import { createServer } from 'node:http';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const CLIENT = join(dirname(fileURLToPath(import.meta.url)), '..');
const EDITION = 'prithagoras';
const en = (await import('../src/i18n/strings.en.js')).default;
const CRASH = /stopped mid-render/i;

let pass = 0;
const failures = [];
const check = (name, condition, detail = '') => {
  if (condition) pass++; else failures.push(`${name}${detail ? ` — ${detail}` : ''}`);
  console.log(`  ${condition ? '✓' : '✗'} ${name}${condition || !detail ? '' : ` — ${detail}`}`);
};

function build() {
  const out = mkdtempSync(join(tmpdir(), `pri-offline-welcome-${EDITION}-`));
  const vite = join(CLIENT, 'node_modules', 'vite', 'bin', 'vite.js');
  const result = spawnSync(process.execPath, [vite, 'build', '--outDir', out, '--emptyOutDir', '--logLevel', 'error'],
    { cwd: CLIENT, encoding: 'utf8', env: { ...process.env, PRI_EDITION: EDITION, VITE_PRI_EDITION: EDITION } });
  if (result.status !== 0 || !existsSync(join(out, 'index.html'))) throw new Error(`the ${EDITION} build failed:\n${result.stdout || ''}${result.stderr || ''}`);
  return out;
}

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json' };
async function serve(dir) {
  const root = normalize(dir).replace(/[\\/]$/, '');
  const server = createServer((req, res) => {
    const pathname = decodeURIComponent(new URL(req.url, 'http://pri.local').pathname);
    if (pathname.startsWith('/v1/')) { res.writeHead(503, { 'content-type': 'application/json' }); res.end('{"error":"no platform behind this file server"}'); return; }
    const full = normalize(join(root, pathname));
    const file = extname(pathname) && full.startsWith(root + sep) ? full : join(root, 'index.html');
    readFile(file).then(body => { res.writeHead(200, { 'content-type': MIME[extname(file).toLowerCase()] || 'application/octet-stream', 'cache-control': 'no-store' }); res.end(body); })
      .catch(() => { res.writeHead(404).end(); });
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  return { origin: `http://127.0.0.1:${server.address().port}`, close: () => new Promise(resolve => { server.closeAllConnections?.(); server.close(resolve); }) };
}

const bodyText = page => page.evaluate(() => document.body.innerText.replace(/\s+/g, ' ').trim());

let dist = null;
let server = null;
let browser = null;
try {
  dist = build();
  server = await serve(dist);
  browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', e => pageErrors.push(String(e.message || e)));
  const failedFiles = [];
  page.on('requestfailed', r => failedFiles.push(new URL(r.url()).pathname));

  // The visitor first opens the app somewhere other than /welcome, so the worker is installed and its
  // offline copy is whole, and the landing page's own files are not in it.
  await page.goto(`${server.origin}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.auth-wrap, .shell', { timeout: 30000 });
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.waitForFunction(async () => { for (const k of await caches.keys()) { if (await (await caches.open(k)).match('/')) return true; } return false; }, null, { timeout: 60000 });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !!navigator.serviceWorker.controller, null, { timeout: 30000 });
  check('the real service worker is installed and controlling', await page.evaluate(() => !!navigator.serviceWorker.controller));
  const cachedLanding = await page.evaluate(async () => { for (const k of await caches.keys()) { for (const r of await (await caches.open(k)).keys()) if (/\/assets\/Landing-/.test(r.url)) return true; } return false; });
  check('the landing page\'s own files are not in the offline copy (the premise of the bug)', !cachedLanding);

  await context.setOffline(true);
  for (const path of ['/welcome', '/welcome/marking']) {
    failedFiles.length = 0;
    await page.goto(`${server.origin}${path}`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[data-testid="page-not-downloaded"], h1', { timeout: 30000 });
    await page.waitForTimeout(800);
    const text = await bodyText(page);
    check(`offline ${path}: the crash screen is not shown`, !CRASH.test(text) && !/SOMETHING WENT WRONG/i.test(text), text.slice(0, 160));
    check(`offline ${path}: the page says it could not load, in plain words`, text.includes(en['boot.loadFailedTitle'].replace('{brand}', 'Prithagoras')) && text.includes(en['boot.loadFailedBody']), text.slice(0, 200));
    check(`offline ${path}: it offers Try again`, await page.getByRole('button', { name: en['common.tryAgain'] }).count() === 1);
    check(`offline ${path}: it is announced as a status, not an alert`, await page.locator('[data-testid="page-not-downloaded"][role="status"]').count() === 1);
    check(`offline ${path}: it is the page's own file that did not arrive`, failedFiles.some(f => /\/assets\/(Landing|PublicInfo)-/.test(f)), failedFiles.join(','));
    check(`offline ${path}: nothing is marked, checked or offered (no sign-up, sign-in or answer control)`, await page.locator('input, textarea, [data-testid="picker-create-account"]').count() === 0);
  }

  // Back online, Try again brings the real page.
  await context.setOffline(false);
  await page.getByRole('button', { name: en['common.tryAgain'] }).click();
  await page.waitForSelector('main, h1', { timeout: 30000 });
  await page.waitForFunction(() => /How marking works|Marking/i.test(document.body.innerText) && !/could not load/i.test(document.body.innerText), null, { timeout: 30000 });
  check('back online, Try again shows the real page and no notice', await page.locator('[data-testid="page-not-downloaded"]').count() === 0 && !CRASH.test(await bodyText(page)));

  // Online /welcome never shows the notice.
  await page.goto(`${server.origin}/welcome`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => /Create an account/i.test(document.body.innerText), null, { timeout: 30000 });
  check('online /welcome is the landing page', await page.locator('[data-testid="page-not-downloaded"]').count() === 0);

  // CONTROL: a genuine fault is not a download failure and is not hidden.
  const { isChunkLoadFailure } = await import('../src/components/chunkFailure.js');
  check('CONTROL: a render fault is not taken for a download failure', !isChunkLoadFailure(new TypeError("Cannot read properties of undefined (reading 'map')")));
  check('CONTROL: each browser\'s wording for a failed import is', [
    'Failed to fetch dynamically imported module: http://x/assets/Landing-1.js',
    'Importing a module script failed.',
    'error loading dynamically imported module',
    'Load failed'
  ].every(m => isChunkLoadFailure(new TypeError(m))));
  check('no uncaught page error reached the window', pageErrors.length === 0, pageErrors.join(' | '));
} catch (error) {
  failures.push(`the tour stopped: ${String(error?.stack || error).split('\n').slice(0, 4).join(' | ')}`);
} finally {
  await browser?.close().catch(() => {});
  await server?.close?.().catch(() => {});
  if (dist) rmSync(dist, { recursive: true, force: true });
}

if (failures.length) {
  console.log('\nfailures:');
  for (const line of failures) console.log(`  ${line}`);
}
console.log(`\nOFFLINE WELCOME: ${failures.length ? 'FAIL' : 'PASS'} — ${pass}/${pass + failures.length} checks — SYNTHETIC; a built Prithagoras client with its real service worker, offline, opens /welcome without the crash screen`);
process.exit(failures.length ? 1 : 0);
