// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the app starts, or says why it did not.
//
// The splash in index.html is static: it is up before the app has run and only
// the app's first render takes it down. For weeks a browser suite would, now
// and then, sit on that splash until its timeout — document loaded, no page
// error, nothing failed that anything was listening for. This suite forces
// every way that can happen and asserts the two outcomes that are acceptable:
// the app mounts, or the student is told, accurately, with a reload button.
//
// Each case is forced, not waited for:
//   · a chunk of the entry module's import graph fails to download
//   · the same chunk is answered `200 text/html` — what a server that serves
//     the shell for unknown paths says about a chunk it no longer has
//   · the entry module loads and throws, or loads and never renders
//   · the boot health probe never settles (not even when aborted)
//   · the service worker's cache write is refused (quota) while the network
//     answer is good
//   · the service worker is asked for a chunk the server answers with the shell
// and two boundaries are pinned: API paths are not answered by the worker, and
// the notice's words are the catalogue's (English and Hindi).
//
// SYNTHETIC: Playwright Chromium against the built client on a loopback file
// server. Faults are injected by the test. Not evidence about a physical
// device, Safari, or a real network.
//
// Usage: node client/test/boot-resilience-check.mjs [--no-build]
// ─────────────────────────────────────────────────────────────────────────────
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, extname, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { ensureBuild } from './e2e.mjs';
import { contentSecurityPolicy } from '../../server/platform/headers.js';
import { watchBoot, bootRecovery } from './support/boot-diagnostics.mjs';
import en from '../src/i18n/strings.en.js';
import hi from '../src/i18n/strings.hi.js';
import { BOOT_NOTICE_KEYS } from '../src/platform/bootNotice.js';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const DIST = join(ROOT, 'client', 'dist');

let pass = 0;
const failures = [];
const ok = (cond, label, detail = '') => { if (cond) pass++; else failures.push(detail ? `${label} — ${detail}` : label); };
const eq = (a, b, label) => ok(JSON.stringify(a) === JSON.stringify(b), label, `expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);

// ── A file server that behaves like the platform server for unknown paths ────
// server/app.js answers every path that is not a built file and not /v1 with
// the shell, because an unknown path is normally an in-app route. That is also
// what it says about a hashed chunk from a build it no longer has.

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2',
  '.webmanifest': 'application/manifest+json'
};

const CSP = contentSecurityPolicy({ connectSources: [] });
const cspViolations = [];

async function serve(dir) {
  const root = normalize(dir).replace(/[\\/]$/, '');
  const server = createServer(async (req, res) => {
    const pathname = decodeURIComponent(new URL(req.url, 'http://pri.local').pathname);
    if (pathname.startsWith('/v1/')) {
      res.writeHead(404, { 'content-type': 'application/json', 'cache-control': 'no-store' });
      res.end('{"error":"no platform behind this file server"}');
      return;
    }
    let file = normalize(join(root, pathname));
    const inside = file.startsWith(root + sep);
    if (!inside || !existsSync(file) || statSync(file).isDirectory()) file = join(root, 'index.html');
    const body = await readFile(file);
    res.writeHead(200, {
      'content-type': MIME[extname(file).toLowerCase()] || 'application/octet-stream', 'cache-control': 'no-store',
      // The policy the platform server enforces (server/platform/headers.js):
      // the notice is drawn under it, so it must not need anything it forbids.
      'content-security-policy': CSP
    });
    res.end(body);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  return {
    origin: `http://127.0.0.1:${server.address().port}`,
    close: () => new Promise(resolve => { server.closeAllConnections?.(); server.close(resolve); })
  };
}

// ── What the build says ──────────────────────────────────────────────────────

ensureBuild(!process.argv.includes('--no-build'));
const shell = readFileSync(join(DIST, 'index.html'), 'utf8');
const sw = readFileSync(join(DIST, 'sw.js'), 'utf8');
const guard = readFileSync(join(DIST, 'boot-guard.js'), 'utf8');
const ENTRY = shell.match(/<script type="module"[^>]*src="(\/assets\/index-[^"]+\.js)"/)?.[1];
const APP_CHUNK = shell.match(/href="(\/assets\/App-[^"]+\.js)"/)?.[1];
ok(!!ENTRY && !!APP_CHUNK, 'the built shell names its entry module and the App chunk', `${ENTRY} ${APP_CHUNK}`);

// The guard is a plain same-origin script (the CSP allows no inline script),
// it is requested before the module, and it is part of the offline install.
const guardAt = shell.indexOf('<script src="/boot-guard.js"></script>');
ok(guardAt > 0 && guardAt < shell.indexOf('type="module"'), 'the shell loads boot-guard.js as an external script, before the app module');
ok(!/<script(?![^>]*\bsrc=)[^>]*>/.test(shell), 'the shell has no inline script (script-src is \'self\')');
const PRECACHE = JSON.parse(sw.match(/^const PRECACHE = (.*);$/m)[1]);
ok(PRECACHE.includes('/boot-guard.js'), 'boot-guard.js is in the service worker install, so it is there offline');

// The script-free fallback in the shell: both languages (no script, so no way
// to choose), the catalogue's words, a plain link that reloads, hidden until a
// CSS delay elapses, and switched off as soon as the guard is running.
const late = shell.match(/<div id="bs-late">(.*?)<\/div>/s)?.[1] || '';
for (const [lang, table] of [['en', en], ['hi', hi]]) {
  ok(late.includes(`<p lang="${lang}">${table['boot.slowTitle']}${lang === 'hi' ? '।' : '.'} ${table['boot.slowBody']}</p>`),
    `the shell's script-free fallback says the ${lang} catalogue's still-loading sentence`, late.slice(0, 300));
  ok(late.includes(table[BOOT_NOTICE_KEYS.reload]), `and its link carries the ${lang} catalogue's reload label`);
}
ok(/<a href="">/.test(late), 'the fallback\'s reload control is a plain link to the current address — it works with no script');
// (The build minifies and reorders the shell's inline style, so this reads
// declarations, not a literal string; case 2c measures the delay itself.)
const lateRule = shell.match(/#bs-late\{([^}]*)\}/)?.[1] || '';
ok(/visibility:hidden/.test(lateRule) && /animation:[^;]*\b12s\b/.test(lateRule) && /html\[data-boot-guard\] #bs-late\{display:none\}/.test(shell),
  'it is hidden until twelve seconds have passed, and switched off when boot-guard.js is running');

// The words on the notice are catalogue entries; the guard carries copies
// because the catalogue is inside the bundle that failed to arrive.
for (const [lang, table] of [['en', en], ['hi', hi]]) {
  for (const key of [...BOOT_NOTICE_KEYS.load, ...BOOT_NOTICE_KEYS.start, ...BOOT_NOTICE_KEYS.slow, BOOT_NOTICE_KEYS.reload]) {
    ok(typeof table[key] === 'string' && guard.includes(`'${table[key]}'`), `boot-guard.js carries the ${lang} catalogue's ${key} word for word`, JSON.stringify(table[key]));
  }
}

// ── The browser ──────────────────────────────────────────────────────────────

const server = await serve(DIST);
const browser = await chromium.launch();
const APP = '.auth-wrap, .shell';
const NOTICE = '[data-boot-failure]';

const noticeOf = (page) => page.evaluate(() => {
  const box = document.querySelector('[data-boot-failure]');
  if (!box) return null;
  const [title, body, button] = box.children;
  return {
    kind: box.getAttribute('data-boot-failure'), role: box.getAttribute('role'), lang: box.getAttribute('lang'),
    title: title.textContent, body: body.textContent, button: button.textContent, buttonTag: button.tagName,
    visible: box.getBoundingClientRect().height > 0 && button.getBoundingClientRect().height >= 24,
    splash: !!document.getElementById('bs'), boot: window.__PRI_BOOT__
  };
});

/** One case in its own context; a throw is a failed check, not a dead suite. */
async function scenario(name, { workers = 'block', init = null } = {}, run) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: workers });
  if (init) await ctx.addInitScript(init);
  const page = await ctx.newPage();
  const watch = watchBoot(page);
  page.on('console', m => { if (/Content Security Policy/i.test(m.text())) cspViolations.push(`${name}: ${m.text().split('\n')[0].slice(0, 200)}`); });
  try {
    await run({ ctx, page, watch });
  } catch (err) {
    const seen = await watch.describe().catch(() => null);
    ok(false, `${name} ran to the end`, `${String(err?.message || err).split('\n')[0]} · ${JSON.stringify(seen)}`);
  } finally {
    watch.stop();
    await ctx.close();
  }
}

try {
  // ── 1 · the control: an undisturbed load mounts and shows no notice ───────
  await scenario('an undisturbed load', {}, async ({ page }) => {
    await page.goto(server.origin + '/', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector(APP, { timeout: 15000 });
    const state = await page.evaluate(() => ({ phase: window.__PRI_BOOT__?.phase, failed: window.__PRI_BOOT__?.failed, retried: window.__PRI_BOOT__?.retried, notice: !!document.querySelector('[data-boot-failure]'), splash: !!document.getElementById('bs') }));
    eq(state, { phase: 'render', failed: [], retried: null, notice: false, splash: false }, 'an undisturbed load mounts the app: boot phase "render", nothing failed, no reload, no notice, splash gone');
    ok(await page.evaluate(() => document.documentElement.hasAttribute('data-boot-guard') && !document.getElementById('bs-late')), 'and the script-free fallback went with the splash, having been switched off by the guard');
  });

  // ── 2 · a chunk of the entry graph does not download ──────────────────────
  await scenario('a chunk that fails to download', {}, async ({ ctx, page, watch }) => {
    let failing = true, documents = 0;
    page.on('request', r => { if (r.isNavigationRequest() && r.frame() === page.mainFrame()) documents++; });
    await ctx.route(url => url.pathname === APP_CHUNK, route => failing ? route.abort('failed') : route.continue());
    await page.goto(server.origin + '/practice', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector(NOTICE, { timeout: 10000 });
    const n = await noticeOf(page);
    // It tried again by itself exactly once before saying anything, and then
    // stopped: a chunk that keeps failing must not become a reload loop.
    await page.waitForTimeout(1500);
    eq([documents, !!n.boot.retried, n.boot.retried?.failed.includes(APP_CHUNK)], [2, true, true],
      'a chunk that keeps failing: the page reloads itself once, records that it did, and then stops and says so');
    eq({ kind: n.kind, role: n.role, lang: n.lang, tag: n.buttonTag, visible: n.visible },
      { kind: 'load', role: 'alert', lang: 'en', tag: 'BUTTON', visible: true },
      'a chunk that fails to download: a visible alert with a real button replaces the silent splash');
    eq([n.title, n.body, n.button], [...BOOT_NOTICE_KEYS.load.map(k => en[k]), en[BOOT_NOTICE_KEYS.reload]],
      'the notice says the app could not load, in the catalogue\'s English words');
    ok(n.boot.phase === 'load-failed' && n.boot.failed.includes(APP_CHUNK), 'the boot record names the chunk that failed', JSON.stringify(n.boot));
    ok(await page.locator(APP).count() === 0, 'and the app is not pretending to be up behind it');
    const seen = await watch.describe();
    ok(seen.bootPhase === 'load-failed' && seen.failedRequests.some(line => line.includes(APP_CHUNK)) && seen.bootFailed.includes(APP_CHUNK),
      'the harness diagnostics name the same fault: the failed request and the boot phase', JSON.stringify({ phase: seen.bootPhase, failed: seen.failedRequests, boot: seen.bootFailed }));
    // The reload action works: with the fault gone, pressing it starts the app.
    failing = false;
    await page.locator(`${NOTICE} button`).click();
    await page.waitForSelector(APP, { timeout: 15000 });
    ok(await page.locator(NOTICE).count() === 0, 'pressing Reload once the chunk can be had starts the app, and the notice is gone');
  });

  // ── 2b · the transient case: the chunk fails once, and the next load is fine
  // This is the fault seen in CI, modelled: a service worker stopped while a
  // navigation's requests are in flight answers them with a network error, and
  // the load after it is clean. (Stopping the worker over CDP reproduces the
  // real thing about one time in five; this forces the same effect every time.)
  await scenario('a chunk that fails once', {}, async ({ ctx, page, watch }) => {
    let failures = 1, documents = 0;
    page.on('request', r => { if (r.isNavigationRequest() && r.frame() === page.mainFrame()) documents++; });
    await ctx.route(url => url.pathname === ENTRY, route => failures-- > 0 ? route.abort('failed') : route.continue());
    await page.goto(server.origin + '/exams', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector(APP, { timeout: 15000 });
    const state = await page.evaluate(() => ({ phase: window.__PRI_BOOT__.phase, retried: window.__PRI_BOOT__.retried, notice: !!document.querySelector('[data-boot-failure]'), path: location.pathname }));
    eq([documents, state.phase, state.notice, state.path], [2, 'render', false, '/exams'],
      'an entry module that fails to load once: one automatic reload, the app is up on the same route, no notice');
    ok(!!state.retried && state.retried.failed.includes(ENTRY), 'the load that followed records that it is a retry and what had failed', JSON.stringify(state.retried));
    const seen = await watch.describe();
    ok(!!seen.bootRetried && seen.failedRequests.some(line => line.includes(ENTRY)),
      'and the harness diagnostics show it — a recovered boot is never reported as an ordinary one', JSON.stringify({ retried: seen.bootRetried, failed: seen.failedRequests }));
    const note = await bootRecovery(watch, page, '/exams');
    ok(typeof note === 'string' && note.includes('ONE AUTOMATIC RELOAD') && note.includes(ENTRY), 'bootRecovery() turns that into a note for the suite report', String(note).slice(0, 200));
  });

  // ── 2c · every script fails, the guard included ───────────────────────────
  // What a stopped service worker can do to a navigation: the document
  // arrives and nothing it asks for does. No script runs, so only the shell's
  // own markup can speak.
  await scenario('no script arrives at all', {}, async ({ ctx, page }) => {
    await ctx.route(url => /\.js$/.test(url.pathname), route => route.abort('failed'));
    await page.goto(server.origin + '/', { waitUntil: 'load' });
    const lateState = () => page.evaluate(() => {
      const el = document.getElementById('bs-late');
      const link = el?.querySelector('a');
      return { guard: !!window.__PRI_BOOT__, visible: !!el && getComputedStyle(el).visibility === 'visible' && el.getBoundingClientRect().height > 0, text: document.body.innerText.trim().length > 0, link: link ? link.href === location.href : false };
    });
    const early = await lateState();
    eq([early.guard, early.visible, early.text], [false, false, false], 'with no script at all, the splash starts as it always has: the mark alone, no words yet');
    await page.waitForFunction(() => getComputedStyle(document.getElementById('bs-late')).visibility === 'visible', null, { timeout: 20000 });
    const later = await lateState();
    eq([later.visible, later.text, later.link], [true, true, true], 'twelve seconds on, with no script having run, the shell itself says it is still loading and offers a link that reloads');
    await ctx.unroute(url => /\.js$/.test(url.pathname));
    await ctx.unrouteAll();
    await page.locator('#bs-late a').click();
    await page.waitForSelector(APP, { timeout: 15000 });
    ok(true, 'following that link once scripts can be had starts the app');
  });

  // ── 3 · the same, for a device whose sign-in language is Hindi ────────────
  await scenario('the notice in Hindi', { init: () => { try { localStorage.setItem('pri-signin-language', 'hi'); } catch { /* opaque origin */ } } }, async ({ ctx, page }) => {
    await ctx.route(url => url.pathname === APP_CHUNK, route => route.abort('failed'));
    await page.goto(server.origin + '/', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector(NOTICE, { timeout: 10000 });
    const n = await noticeOf(page);
    eq([n.lang, n.title, n.body, n.button], ['hi', ...BOOT_NOTICE_KEYS.load.map(k => hi[k]), hi[BOOT_NOTICE_KEYS.reload]],
      'on a device whose sign-in language is Hindi the notice is the catalogue\'s Hindi, marked lang="hi"');
  });

  // ── 4 · the chunk is answered with the shell: 200, text/html ──────────────
  await scenario('a chunk answered with the shell', {}, async ({ ctx, page, watch }) => {
    await ctx.route(url => url.pathname === APP_CHUNK, route => route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: shell }));
    await page.goto(server.origin + '/', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector(NOTICE, { timeout: 10000 });
    const n = await noticeOf(page);
    eq(n.kind, 'load', 'a chunk answered 200 text/html (no failed request, no page error) still ends in the could-not-load notice');
    const seen = await watch.describe();
    ok(seen.wrongKind.some(line => line.includes(APP_CHUNK) && /text\/html/.test(line)),
      'and the harness diagnostics name the chunk that came back as HTML', JSON.stringify(seen.wrongKind));
  });

  // ── 5 · the entry module loads and throws while evaluating ────────────────
  await scenario('an entry module that throws', {}, async ({ ctx, page }) => {
    await ctx.route(url => url.pathname === ENTRY, route => route.fulfill({ status: 200, contentType: 'text/javascript', body: 'throw new Error("forced by boot-resilience-check");' }));
    const started = Date.now();
    await page.goto(server.origin + '/', { waitUntil: 'load' });
    ok(await page.locator(NOTICE).count() === 0, 'an entry module that throws: nothing is claimed the instant the page finishes loading');
    await page.waitForSelector(NOTICE, { timeout: 15000 });
    const n = await noticeOf(page);
    eq([n.kind, n.title, n.body, n.button], ['start', ...BOOT_NOTICE_KEYS.start.map(k => en[k]), en[BOOT_NOTICE_KEYS.reload]],
      'after the page has loaded and the app still has not rendered, the notice says it did not start');
    ok(n.boot.phase === 'document' && n.boot.errors >= 1 && n.boot.failed.length === 0,
      'the boot record shows the module never got going and that an error was raised, not a failed download', JSON.stringify(n.boot));
    ok(Date.now() - started < 14000, 'and it says so within seconds of the load, not after a long timeout', `${Date.now() - started} ms`);
  });

  // ── 6 · the entry module loads and simply never renders ───────────────────
  await scenario('an entry module that never renders', {}, async ({ ctx, page }) => {
    await ctx.route(url => url.pathname === ENTRY, route => route.fulfill({ status: 200, contentType: 'text/javascript', body: 'export {};' }));
    await page.goto(server.origin + '/', { waitUntil: 'load' });
    await page.waitForSelector(NOTICE, { timeout: 15000 });
    const n = await noticeOf(page);
    eq([n.kind, n.boot.errors, n.splash], ['start', 0, true], 'a bundle that runs without error and never renders is also reported, not left as a silent splash');
  });

  // ── 7 · the health probe never settles, not even when aborted ─────────────
  await scenario('a health probe that never settles', {
    init: () => {
      const real = window.fetch;
      window.__probeAsked = 0;
      window.fetch = function (input, init) {
        const url = typeof input === 'string' ? input : input?.url || '';
        if (/\/v1\/health$/.test(url)) { window.__probeAsked++; return new Promise(() => { }); }
        return real.call(this, input, init);
      };
    }
  }, async ({ page }) => {
    const started = Date.now();
    await page.goto(server.origin + '/', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector(APP, { timeout: 15000 });
    const ms = Date.now() - started;
    const state = await page.evaluate(() => ({ asked: window.__probeAsked, notice: !!document.querySelector('[data-boot-failure]'), cloud: typeof window.__PRI_CLOUD_ORIGIN__ }));
    ok(state.asked >= 1, 'the forced fault was reached: the boot asked for /v1/health', JSON.stringify(state));
    ok(ms < 6000, 'a health probe that never settles — not even when aborted — does not hold the first render past its own bound', `${ms} ms`);
    eq([state.notice, state.cloud], [false, 'undefined'], 'the app is up with the cloud simply not found, and no failure notice');
  });

  // ── 8 · the health probe is refused outright ──────────────────────────────
  await scenario('a health probe that is refused', {}, async ({ ctx, page }) => {
    await ctx.route(url => url.pathname === '/v1/health', route => route.abort('connectionrefused'));
    await page.goto(server.origin + '/', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.auth-wrap .hero-title, .auth-card', { timeout: 15000 });
    ok(await page.locator(NOTICE).count() === 0, 'an unreachable server does not stop the app: the sign-in screen is up and no boot notice is shown');
  });

  // ── 9 · the service worker ────────────────────────────────────────────────
  await scenario('the service worker', { workers: 'allow' }, async ({ ctx, page }) => {
    const fromWorker = new Map();
    page.on('response', r => { try { fromWorker.set(new URL(r.url()).pathname + new URL(r.url()).search, r.fromServiceWorker()); } catch { /* not a URL */ } });
    await page.goto(server.origin + '/', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector(APP, { timeout: 15000 });
    await page.waitForFunction(() => !!navigator.serviceWorker?.controller, null, { timeout: 30000 });
    const worker = ctx.serviceWorkers()[0] || await ctx.waitForEvent('serviceworker', { timeout: 15000 });

    // 9a · API paths are not the worker's.
    await page.evaluate(async () => { await fetch('/v1/health').then(r => r.text()).catch(() => null); await fetch('/splash.svg?seen=by-worker').then(r => r.text()); });
    eq([fromWorker.get('/v1/health'), fromWorker.get('/splash.svg?seen=by-worker')], [false, true],
      'the worker answers same-origin assets and leaves /v1 to the network, as if it were not installed');

    // 9b · a chunk the server answers with the shell is never kept as that chunk.
    const gone = '/assets/gone-00000000.js';
    const got = await page.evaluate(async (path) => {
      const res = await fetch(path); await res.text();
      await new Promise(r => setTimeout(r, 400));
      const kept = await caches.match(path);
      return { status: res.status, type: res.headers.get('content-type'), kept: !!kept };
    }, gone);
    ok(got.status === 200 && /text\/html/.test(got.type || ''), 'the forced fault was reached: the server answered a missing chunk with 200 text/html', JSON.stringify(got));
    eq(got.kept, false, 'the worker does not keep the shell under a chunk\'s name — it would be handed back as that chunk on every later load');

    // 9c · a cache write that is refused does not turn a good answer into an error.
    await worker.evaluate(() => {
      self.__putsRefused = 0;
      Cache.prototype.put = function () { self.__putsRefused++; return Promise.reject(new DOMException('forced by boot-resilience-check', 'QuotaExceededError')); };
    });
    const fresh = await page.evaluate(async () => {
      try { const res = await fetch('/splash.svg?after=quota'); return { ok: res.ok, bytes: (await res.text()).length }; }
      catch (err) { return { ok: false, error: String(err?.message || err) }; }
    });
    const refused = await worker.evaluate(() => self.__putsRefused);
    ok(refused >= 1, 'the forced fault was reached: the worker tried to keep a copy and the write was refused', `${refused} writes`);
    ok(fresh.ok === true && fresh.bytes > 0, 'with the cache write refused, the page still gets the network\'s answer', JSON.stringify(fresh));
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector(APP, { timeout: 15000 });
    ok(await page.locator(NOTICE).count() === 0, 'and a reload in that state still starts the app');
  });

  // ── 10 · offline, from the install alone ──────────────────────────────────
  await scenario('offline from the install', { workers: 'allow' }, async ({ ctx, page }) => {
    await page.goto(server.origin + '/', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector(APP, { timeout: 15000 });
    await page.waitForFunction(() => !!navigator.serviceWorker?.controller, null, { timeout: 30000 });
    // The install holds what the first paint needs; the rest of the offline
    // build is the second pass. Ask for it and wait, as the app does when idle.
    const warmed = await page.evaluate(() => new Promise(resolve => {
      const channel = new MessageChannel();
      channel.port1.onmessage = e => resolve(e.data);
      navigator.serviceWorker.controller.postMessage({ type: 'pri-warm', optional: true }, [channel.port2]);
      setTimeout(() => resolve(null), 60000);
    }));
    ok(!!warmed && warmed.warmed === warmed.of && warmed.of > 0, 'the offline build finished arriving before the network was switched off', JSON.stringify(warmed));
    await ctx.setOffline(true);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector(APP, { timeout: 15000 });
    const state = await page.evaluate(() => ({ guard: !!window.__PRI_BOOT__, phase: window.__PRI_BOOT__?.phase, failed: window.__PRI_BOOT__?.failed, notice: !!document.querySelector('[data-boot-failure]') }));
    eq(state, { guard: true, phase: 'render', failed: [], notice: false }, 'with the network off the app (and its boot guard) start from the install: nothing failed, no notice');
  });
} finally {
  await browser.close();
  await server.close();
}

eq(cspViolations, [], 'every case ran under the platform\'s Content-Security-Policy with no violation — the notice needs no inline script');

console.log(failures.length
  ? `BOOT RESILIENCE: FAIL — ${failures.length} of ${pass + failures.length} checks failed\n  · ${failures.join('\n  · ')}`
  : `BOOT RESILIENCE: PASS — ${pass}/${pass} checks — a failed or mis-served chunk, an entry module that throws or never renders, a health probe that never settles or is refused, a refused cache write and the offline install each end in the app or in a visible notice with Reload (en + hi). SYNTHETIC: Playwright Chromium, faults injected by the test.`);
process.exit(failures.length ? 1 : 0);
