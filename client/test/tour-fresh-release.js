// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · E2E journey — a returning browser moves to a new release, with the REAL service worker.
//
// Build A is installed and controlling. The origin then serves build B (a different release SHA, a different
// entry script, a different worker version). The page is then opened the way a returning student opens it: the
// worker answers from build A's cache, so the page is build A until freshBuild.js moves it.
//
//   · untouched page       → ends on build B after exactly one reload, and does not loop
//   · touched page         → keeps what was typed, shows the notice, stays on build A
//   · live shell refused   → build A keeps working, offline too; no reload, no loop
//
// WHAT IS REAL: the built client, a real Chromium with its service worker ACTIVE (not blocked), the worker's
// own cache, a real HTTP origin whose root is swapped from A to B while the page is open.
// WHAT IS DERIVED: build B is build A's dist with a new release SHA in release.json and in the baked entry, a
// renamed entry script, and a worker whose version and precache name that entry. No other part of the app differs.
//
// Run on its own:  node client/test/tour-fresh-release.js
// ─────────────────────────────────────────────────────────────────────────────
import { createServer } from 'node:http';
import { cpSync, mkdtempSync, readFileSync, writeFileSync, copyFileSync, rmSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { extname, join, normalize, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const DIST = fileURLToPath(new URL('../dist/', import.meta.url));
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf' };
const B_SHA = 'b'.repeat(40);

/** Build B from build A's dist. */
function deriveB(a, b) {
  cpSync(a, b, { recursive: true });
  const release = JSON.parse(readFileSync(join(a, 'release.json'), 'utf8'));
  const aSha = release.releaseSha;
  const html = readFileSync(join(a, 'index.html'), 'utf8');
  const aEntry = /<script type="module"[^>]*src="(\/assets\/index-[^"]+\.js)"/.exec(html)?.[1];
  if (!aEntry || !/^[0-9a-f]{40}$/.test(aSha)) throw new Error('build A has no entry script or no release SHA');
  const bEntry = aEntry.replace(/index-([^.]+)\.js$/, 'index-BBBBBBBB.js');
  const js = readFileSync(join(a, aEntry), 'utf8');
  if (!js.includes(aSha)) throw new Error('build A\'s entry does not carry its own release SHA');
  writeFileSync(join(b, bEntry), js.split(aSha).join(B_SHA));
  writeFileSync(join(b, 'index.html'), html.split(aEntry).join(bEntry));
  writeFileSync(join(b, 'release.json'), JSON.stringify({ ...release, releaseSha: B_SHA }, null, 2));
  const sw = readFileSync(join(a, 'sw.js'), 'utf8');
  writeFileSync(join(b, 'sw.js'), sw.split(aEntry).join(bEntry).replace(/const VERSION = '[^']*'/, "const VERSION = 'pri-bbbbbbbbbbbb'"));
  return { aEntry, bEntry, aSha };
}

async function serve(state) {
  const server = createServer((req, res) => {
    let url; try { url = new URL(req.url, 'http://pri.local'); } catch { res.writeHead(400).end(); return; }
    state.log.push(`${req.method} ${url.pathname}${url.search}`);
    if (url.search.startsWith('?shell=') && state.failShell) { req.socket.destroy(); return; }
    let pathname = decodeURIComponent(url.pathname);
    if (pathname.endsWith('/')) pathname += 'index.html';
    if (/^\/v1\//.test(pathname)) { res.writeHead(503, { 'content-type': 'application/json' }); res.end('{"error":"no platform in this journey"}'); return; }
    const root = normalize(state.root);
    const full = normalize(join(root, pathname));
    if (!(full === root || full.startsWith(root + sep))) { res.writeHead(403).end(); return; }
    const send = file => readFile(file).then(buf => { res.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream', 'content-length': buf.length, 'cache-control': 'no-store' }); res.end(buf); });
    send(extname(full) ? full : join(root, 'index.html')).catch(() => { res.writeHead(404, { 'content-type': 'text/plain' }); res.end('missing'); });
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  return { origin: `http://127.0.0.1:${server.address().port}`, close: () => new Promise(r => { server.closeAllConnections?.(); server.close(r); }) };
}

const entryOfPage = page => page.evaluate(() => document.querySelector('script[type="module"][src]')?.getAttribute('src') || '');

export const flow = {
  id: 'fresh-release',
  name: 'A returning browser moves to a new release (real service worker): once, never under a student, offline-safe',

  async run({ ctx, check, note }) {
    const work = mkdtempSync(join(tmpdir(), 'pri-fresh-release-'));
    const A = join(work, 'a'); const B = join(work, 'b');
    cpSync(DIST, A, { recursive: true });
    const { aEntry, bEntry } = deriveB(A, B);
    const state = { root: A, failShell: false, log: [] };
    const server = await serve(state);
    note(`build A entry ${aEntry} · build B entry ${bEntry} · worker ACTIVE · ${server.origin}`);
    const browser = ctx.browser();

    /** A fresh browser profile with build A installed, activated and controlling. */
    async function installedA() {
      state.root = A; state.failShell = false; state.log.length = 0;
      const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
      const page = await context.newPage();
      const loads = { n: 0 }; page.on('load', () => { loads.n++; });
      await page.goto(`${server.origin}/`, { waitUntil: 'domcontentloaded' });
      await page.locator('#signup-destination').waitFor({ timeout: 30000 });
      await page.evaluate(async () => { await navigator.serviceWorker.ready; });
      await page.waitForFunction(() => !!navigator.serviceWorker.controller || false, null, { timeout: 30000 }).catch(async () => { await page.reload({ waitUntil: 'domcontentloaded' }); });
      await page.waitForFunction(async () => (await caches.keys()).some(k => k.startsWith('pri-')), null, { timeout: 30000 });
      // the install writes the shell before it reports done: wait for it
      await page.waitForFunction(async () => { for (const k of await caches.keys()) { if (await (await caches.open(k)).match('/')) return true; } return false; }, null, { timeout: 60000 });
      return { context, page, loads };
    }

    // ── 1 · untouched: one reload, onto build B ──────────────────────────────
    {
      const { context, page, loads } = await installedA();
      await check('build A is installed and controlling, running its own entry', await entryOfPage(page) === aEntry && await page.evaluate(() => !!navigator.serviceWorker.controller));
      state.root = B; state.log.length = 0; loads.n = 0;
      await page.reload({ waitUntil: 'domcontentloaded' });
      await check('the worker answers the returning visit from build A\'s cache: the page is still build A at first', await entryOfPage(page) === aEntry || loads.n >= 1);
      await page.waitForFunction(entry => document.querySelector('script[type="module"][src]')?.getAttribute('src') === entry, bEntry, { timeout: 30000 }).catch(e => { note(`never reached build B; requests: ${state.log.slice(-14).join(' | ')}`); throw e; });
      await page.locator('#signup-destination').waitFor({ timeout: 30000 });
      await page.waitForTimeout(6000);
      const shellRequests = state.log.filter(l => l.startsWith('GET /?shell='));
      await check('the untouched page ended on build B', await entryOfPage(page) === bEntry);
      await check('after exactly one automatic reload (this load plus the reload; no loop in 6 s more)', loads.n === 2, `${loads.n} loads`);
      await check('the live shell was asked for as /?shell=<live sha>, never as the precached "/"', shellRequests.length >= 1 && shellRequests.every(l => l === `GET /?shell=${B_SHA}`), JSON.stringify(shellRequests));
      await check('and the worker kept no copy under that key', await page.evaluate(async () => { for (const k of await caches.keys()) { for (const r of await (await caches.open(k)).keys()) if (/shell=/.test(r.url)) return false; } return true; }));
      await check('the page is the new build working (the card is there)', await page.locator('#signup-destination').isVisible());
      await context.close();
    }

    // ── 2 · touched: the notice, nothing lost, still build A ─────────────────
    {
      const { context, page, loads } = await installedA();
      state.root = B; loads.n = 0;
      await page.addInitScript(() => {
        const mo = new MutationObserver(() => { if (document.querySelector('#signup-destination')) { mo.disconnect(); window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' })); } });
        document.addEventListener('DOMContentLoaded', () => mo.observe(document.documentElement, { childList: true, subtree: true }));
      });
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.locator('#signup-destination').waitFor({ timeout: 30000 });
      // This journey has no platform behind it, so the card's field is disabled: in-page memory stands in for typed text (a reload loses it).
      await page.evaluate(() => { window.__typed = 'someone@example.test'; });
      await page.locator('#pri-update-notice').waitFor({ timeout: 30000 });
      await page.waitForTimeout(3000);
      await check('a touched page shows the update notice', await page.locator('#pri-update-notice').count() === 1);
      await check('it was not reloaded under the student, and what was in the page is still there', loads.n === 1 && await page.evaluate(() => window.__typed) === 'someone@example.test', `${loads.n} loads`);
      await check('it is still build A until the student chooses', await entryOfPage(page) === aEntry);
      await page.locator('#pri-update-notice button').click();
      await page.waitForFunction(entry => document.querySelector('script[type="module"][src]')?.getAttribute('src') === entry, bEntry, { timeout: 30000 });
      await check('choosing "Reload" lands on build B', await entryOfPage(page) === bEntry);
      await context.close();
    }

    // ── 3 · the live shell cannot be fetched mid-update: build A keeps working, offline too ──
    {
      const { context, page, loads } = await installedA();
      state.root = B; state.failShell = true; loads.n = 0;
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.locator('#signup-destination').waitFor({ timeout: 30000 });
      await page.locator('#pri-update-notice').waitFor({ timeout: 30000 });
      await page.waitForTimeout(4000);
      await check('the shell fetch failed: no reload into nothing, the notice is offered, no loop', loads.n === 1 && await page.locator('#pri-update-notice').count() === 1, `${loads.n} loads`);
      await check('build A is still the running build', await entryOfPage(page) === aEntry);
      await context.setOffline(true);
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.locator('#signup-destination').waitFor({ timeout: 30000 });
      const offlineEntry = await entryOfPage(page);
      note(`offline reload opened ${offlineEntry}`);
      await check('with the network gone the app still opens from the worker\'s cache (build A, or build B if its worker finished installing first), never an error page', [aEntry, bEntry].includes(offlineEntry) && await page.locator('#signup-destination').count() === 1);
      await context.close();
    }

    await server.close();
    rmSync(work, { recursive: true, force: true });
  }
};

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { runOne } = await import('./e2e.mjs');
  const failed = await runOne(flow);
  process.exit(failed ? 1 : 0);
}
