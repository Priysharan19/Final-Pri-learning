#!/usr/bin/env node
// Pri Learning · a returning browser moves to the live build (client/src/platform/freshBuild.js).
// Deterministic: a fake window, a fake release.json reader, no browser and no network.
import { readFileSync } from 'node:fs';
import { freshnessAction, watchFreshBuild } from '../src/platform/freshBuild.js';
import en from '../src/i18n/strings.en.js';
import hi from '../src/i18n/strings.hi.js';

let pass = 0;
const failures = [];
const ok = (c, label) => { if (c) pass++; else failures.push(label); };

const A = 'a'.repeat(40);
const B = 'b'.repeat(40);

// ── the decision ─────────────────────────────────────────────────────────────
ok(freshnessAction({ ownSha: A, liveSha: A, touched: false }) === 'none', 'same build: nothing');
ok(freshnessAction({ ownSha: '', liveSha: B, touched: false }) === 'none', 'unknown own build (dev/native): nothing');
ok(freshnessAction({ ownSha: A, liveSha: 'development-unknown', touched: false }) === 'none', 'unknown live build: nothing');
ok(freshnessAction({ ownSha: A, liveSha: B, touched: false }) === 'reload', 'stale and untouched: reload');
ok(freshnessAction({ ownSha: A, liveSha: B, touched: true }) === 'notice', 'stale and touched: notice, never reload');
ok(freshnessAction({ ownSha: A, liveSha: B, touched: false, alreadyReloadedFor: B }) === 'notice', 'already reloaded for this build: notice, no loop');

// ── a fake page ──────────────────────────────────────────────────────────────
function fakeWin({ storage = true } = {}) {
  const handlers = {};
  const store = new Map();
  const added = [];
  const el = (tag) => ({ tag, children: [], style: {}, attrs: {}, listeners: {},
    setAttribute(k, v) { this.attrs[k] = v; }, appendChild(c) { this.children.push(c); },
    addEventListener(t, f) { this.listeners[t] = f; } });
  const body = el('body');
  const doc = { querySelector: () => ({ getAttribute: () => '/assets/index-OLD.js' }), body, visibilityState: 'visible', createElement: el, getElementById: (id) => body.children.find(c => c.id === id) || null, addEventListener() {}, removeEventListener() {} };
  const replaced = [];
  const cachesState = { 'pri-old': new Set(['/index.html', '/', '/assets/x.js']), 'pri-new': new Set(['/index.html', '/']) };
  const win = {
    document: doc, reloads: 0, updates: 0, added, fetches: 0, fetchOk: true,
    fetchShell: async (sha) => { win.fetches++; win.shellUrls.push(sha); if (!win.fetchOk) return null; return { clone() { return this; }, text: async () => `<html><script type="module" crossorigin src="/assets/${win.shellEntry}"></script></html>` }; },
    shellUrls: [], shellEntry: 'index-NEW.js',
    addEventListener(t, f) { (handlers[t] = handlers[t] || []).push(f); },
    removeEventListener() {},
    fire(t) { (handlers[t] || []).forEach(f => f({})); },
    location: { reload() { win.reloads++; } },
    sessionStorage: storage ? { getItem: k => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) } : { getItem() { throw new Error('no'); }, setItem() { throw new Error('no'); } },
    navigator: { serviceWorker: { getRegistration: async () => ({ update: async () => { win.updates++; } }) } },
    caches: {
      keys: async () => Object.keys(cachesState),
      open: async (n) => ({ delete: async (p) => cachesState[n].delete(p), put: async (p) => { cachesState[n].add(p); replaced.push(`${n}${p}`); } })
    },
    cachesState, store, replaced
  };
  return win;
}
const live = (sha) => async () => ({ releaseSha: sha });
const run = async (win, sha, own = A) => {
  const w = watchFreshBuild(win, { read: live(sha), ownSha: own, immediate: false, fetchShell: win.fetchShell });
  const r = await w.check();
  return { w, r };
};

// stale + untouched → reloads once, replaces the stale shell, asks the worker to update
{
  const win = fakeWin();
  const { r } = await run(win, B);
  ok(r === 'reload' && win.reloads === 1, 'untouched stale page reloads once');
  ok(win.updates >= 1, 'worker asked to update');
  ok(win.fetches === 1 && win.replaced.length === 4 && win.cachesState['pri-old'].has('/index.html') && win.cachesState['pri-old'].has('/assets/x.js'), 'the live shell is fetched first and replaces the cached one; nothing else is touched');
  ok(win.store.get('pri.freshBuild.reloaded.v1') === B, 'reload recorded for the live build');
  // The reloaded page is still on the old shell (worker answered stale again): no second reload.
  const again = await run(win, B);
  ok(again.r === 'notice' && win.reloads === 1, 'a second visit to the same stale answer shows the notice, never loops');
  ok(win.document.getElementById('pri-update-notice'), 'notice present');
}

// stale + the student typed → notice only, nothing reloaded, work untouched
for (const type of ['keydown', 'input', 'pointerdown', 'touchstart', 'paste']) {
  const win = fakeWin();
  const w = watchFreshBuild(win, { read: live(B), ownSha: A, immediate: false, fetchShell: win.fetchShell });
  win.fire(type);
  const r = await w.check();
  ok(r === 'notice' && win.reloads === 0, `${type} before the check: notice, no reload`);
  ok(win.cachesState['pri-old'].has('/index.html'), `${type}: caches untouched until the student chooses`);
}
{
  // The notice's own button reloads, once, after dropping the shell.
  const win = fakeWin();
  const w = watchFreshBuild(win, { read: live(B), ownSha: A, immediate: false, fetchShell: win.fetchShell });
  win.fire('keydown');
  await w.check();
  const btn = win.document.getElementById('pri-update-notice').children[1];
  btn.listeners.click();
  await new Promise(r => setTimeout(r, 10));
  ok(win.reloads === 1 && win.replaced.length === 4, 'choosing the notice reloads once after replacing the stale shell');
}

// current build, unreadable manifest, dev build, and no storage
{
  const win = fakeWin();
  ok((await run(win, A)).r === 'none' && win.reloads === 0, 'current build: nothing');
  const w = watchFreshBuild(fakeWin(), { read: async () => null, ownSha: A, immediate: false });
  ok(await w.check() === 'none', 'manifest unreadable (offline): nothing');
  const w2 = watchFreshBuild(fakeWin(), { read: async () => { throw new Error('x'); }, ownSha: A, immediate: false });
  ok(await w2.check() === 'none', 'manifest throws: nothing');
  ok((await run(fakeWin(), B, '')).r === 'none', 'development build never reloads');
  const noStore = fakeWin({ storage: false });
  const r = (await run(noStore, B)).r;
  ok(r === 'notice' && noStore.reloads === 0, 'no sessionStorage: cannot prove a single reload, so notice only');
}

// N2: the new shell cannot be fetched (the connection drops): the cached shell is left exactly as it was
{
  const win = fakeWin(); win.fetchOk = false;
  const { r } = await run(win, B);
  ok(r === 'notice' && win.reloads === 0 && win.replaced.length === 0 && win.cachesState['pri-old'].has('/index.html') && win.cachesState['pri-new'].has('/'), 'fetch of the new shell failed: nothing replaced, no pointless reload, notice shown');
}

// B1: a "live" shell that boots from the same entry as this page is the stale one coming back: never written, never reloaded into
{
  const win = fakeWin(); win.shellEntry = 'index-OLD.js';
  const { r } = await run(win, B);
  ok(r === 'notice' && win.reloads === 0 && win.replaced.length === 0, 'a shell with this page\'s own entry is not the new build: no write, no reload, notice');
  const w2 = fakeWin();
  const w = watchFreshBuild(w2, { read: async () => ({ releaseSha: B }), ownSha: A, immediate: false, fetchShell: w2.fetchShell });
  ok(await w.check() === 'reload' && w2.shellUrls[0] === B, 'the shell is requested for the live build');
  const lie = fakeWin(); let n = 0;
  const w3 = watchFreshBuild(lie, { read: async () => ({ releaseSha: n++ === 0 ? B : A }), ownSha: A, immediate: false, fetchShell: lie.fetchShell });
  ok(await w3.check() === 'notice' && lie.replaced.length === 0, 'the manifest no longer names the live build when the shell arrived: nothing written');
}

// (c) the shell request can never be a precache hit: it carries a search string, and "/" is the precache key
{
  const { liveShellUrl } = await import('../src/platform/cloudTransport.js');
  const u = new URL(liveShellUrl('https://x.test', B));
  ok(u.pathname === '/' && u.search === `?shell=${B}`, 'shell URL is /?shell=<sha>');
  ok(u.search !== '' && u.href !== 'https://x.test/', 'so it can never equal the precached "/" request');
  const sw = readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8');
  ok(/const CACHEABLE = \/\(\?:\^\\\/assets\\\/\)\|\(\?:\\\.\(\?:js\|css\|html/.test(sw) && !/\\\/\$/.test(sw.match(/const CACHEABLE = .*/)[0]), 'the worker keeps only build assets and static files, never a response for the path "/"');
}

// the boot check never fires while the page is still loading, and waits a quiet moment after it
{
  const win = fakeWin(); win.document.readyState = 'loading';
  watchFreshBuild(win, { read: live(B), ownSha: A, settleMs: 0, fetchShell: win.fetchShell });
  await new Promise(r => setTimeout(r, 30));
  ok(win.reloads === 0, 'still loading: no check, no reload');
  win.fire('load');
  await new Promise(r => setTimeout(r, 30));
  ok(win.reloads === 1, 'after load the boot check runs');
  const w2 = fakeWin();
  watchFreshBuild(w2, { read: live(B), ownSha: A });
  await new Promise(r => setTimeout(r, 30));
  ok(w2.reloads === 0, 'default settle delay: not within the first 30 ms');
  // placeholders are never a reason to act
  for (const bad of ['', 'development-unknown', 'a'.repeat(39), 'A'.repeat(40)]) {
    ok(freshnessAction({ ownSha: A, liveSha: bad, touched: false }) === 'none' && freshnessAction({ ownSha: bad, liveSha: B, touched: false }) === 'none', `placeholder SHA "${bad}" never acts`);
  }
}

// started with the default (immediate) check: the boot check itself reloads an untouched stale page
{
  const win = fakeWin();
  watchFreshBuild(win, { read: live(B), ownSha: A, settleMs: 0, fetchShell: win.fetchShell });
  await new Promise(r => setTimeout(r, 20));
  ok(win.reloads === 1, 'the boot check on an untouched stale page reloads');
}

// ── wiring and words ─────────────────────────────────────────────────────────
const main = readFileSync(new URL('../src/main.jsx', import.meta.url), 'utf8');
ok(/import\.meta\.env\.PROD[\s\S]{0,1500}watchFreshBuild\(window\)/.test(main), 'main.jsx starts it only where the service worker is registered');
const vite = readFileSync(new URL('../vite.config.js', import.meta.url), 'utf8');
ok(/__PRI_BUILD_SHA__: JSON\.stringify\(command === 'build'/.test(vite), 'build bakes in its own SHA');
for (const k of ['update.available', 'update.reload']) ok(typeof en[k] === 'string' && typeof hi[k] === 'string' && en[k] !== hi[k], `${k} in en and hi`);

if (failures.length) { console.error(`FRESH BUILD: FAIL — ${failures.length} failing of ${pass + failures.length}`); for (const f of failures) console.error('  ✗ ' + f); process.exit(1); }
console.log(`FRESH BUILD: PASS — ${pass}/${pass} checks`);
