// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Back then a quick tap must not rewrite the landing entry
//
// Regression for the Android journey that, about 1 in 16 runs, found /practice
// at history idx 0 after Back from /progress, so the next Back left the app.
// Cause: react-router's <Link> replaces instead of pushing when the location
// it last *rendered* equals the target. Right after Back to `/` the popstate
// has moved the entry, but BrowserRouter re-renders in a transition that has
// not committed yet, so the rendered location is still /practice. A tap on
// Practice in that window replaced `/` (idx 0) with /practice.
//
// This drives react-router's real browser history against a fake window whose
// back() commits asynchronously (as in a WebView), with the router's rendered
// location held stale, and checks the decision AppLink makes
// (linkReplacesEntry) together with backNavigation's wantsBack/performBack.
//
// Run on its own:  node client/test/back-link-race-check.mjs
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { UNSAFE_createBrowserHistory as createBrowserHistory, createPath } from 'react-router';
import { linkReplacesEntry, wantsBack, performBack, historyDepth } from '../src/platform/backNavigation.js';

let pass = 0;
const failures = [];
const ok = (cond, label) => { if (cond) pass++; else failures.push(label); };
const tick = () => new Promise(r => setTimeout(r, 0));

// A same-origin window: pushState/replaceState are synchronous, back() is a
// queued traversal that commits later and then fires popstate.
function fakeWindow() {
  const entries = [{ url: '/', state: null }];
  let at = 0;
  const listeners = new Set();
  const split = url => { const u = new URL(url, 'https://app.test'); return { pathname: u.pathname, search: u.search, hash: u.hash }; };
  const win = {
    location: {
      get pathname() { return split(entries[at].url).pathname; },
      get search() { return split(entries[at].url).search; },
      get hash() { return split(entries[at].url).hash; },
      get href() { return 'https://app.test' + entries[at].url; },
      get origin() { return 'https://app.test'; },
    },
    history: {
      get state() { return entries[at].state; },
      get length() { return entries.length; },
      pushState(state, _t, url) { entries.splice(at + 1); entries.push({ url: url ?? entries[at].url, state: structuredClone(state) }); at += 1; },
      replaceState(state, _t, url) { entries[at] = { url: url ?? entries[at].url, state: structuredClone(state) }; },
      back() { setTimeout(() => { if (at > 0) { at -= 1; for (const fn of listeners) fn({ type: 'popstate' }); } }, 0); },
      go(n) { if (n === -1) this.back(); },
    },
    addEventListener(type, fn) { if (type === 'popstate') listeners.add(fn); },
    removeEventListener(type, fn) { if (type === 'popstate') listeners.delete(fn); },
  };
  win.document = { defaultView: win, querySelector: () => null, querySelectorAll: () => [] };
  return win;
}

// The router's view: `rendered` only advances when the transition commits.
function app(win) {
  const history = createBrowserHistory({ window: win, v5Compat: true });
  let pending = null;
  let rendered = { ...history.location };
  history.listen(update => { pending = update.location; });
  const commit = () => { if (pending) rendered = pending; pending = null; };
  const doc = win.document;
  const hist = win.history;
  return {
    history, commit, doc, hist,
    // What react-router's own <Link> decides (useLinkClickHandler).
    routerLinkReplaces: to => createPath(rendered) === to,
    tap(to, decide) { (decide(to) ? history.replace : history.push)(to); commit(); },
    async back() { performBack({ doc, hist }); await tick(); },
  };
}

const parse = to => ({ pathname: to, search: '', hash: '' });

// 1 · The defect, reproduced with react-router's own decision.
{
  const win = fakeWindow(); const a = app(win);
  a.tap('/practice', a.routerLinkReplaces);
  ok(historyDepth(win.history) === 1, 'Home → Practice pushes idx 1');
  await a.back(); // popstate processed, transition not yet committed
  ok(win.location.pathname === '/' && historyDepth(win.history) === 0, 'Back commits to / at idx 0');
  a.tap('/practice', a.routerLinkReplaces);
  ok(historyDepth(win.history) === 0 && win.location.pathname === '/practice',
    'reproduced: the stale-render Link replaces the landing entry, leaving /practice at idx 0');
}

// 2 · The fix: decide from the entry the browser shows at click time.
{
  const win = fakeWindow(); const a = app(win);
  const decide = to => linkReplacesEntry(parse(to), win.location);
  a.tap('/practice', decide);
  await a.back();
  ok(win.location.pathname === '/' && wantsBack({ doc: a.doc, hist: a.hist }) === false, 'Back reaches Home; Home does not want Back');
  a.tap('/practice', decide); // the quick tap, rendered location still /practice
  ok(historyDepth(win.history) === 1 && win.location.pathname === '/practice', 'the quick tap pushes /practice at idx 1');
  a.tap('/progress', decide);
  ok(historyDepth(win.history) === 2, 'Practice → Progress pushes idx 2');
  await a.back(); a.commit();
  ok(win.location.pathname === '/practice' && historyDepth(win.history) === 1, 'Back from Progress returns to /practice at idx 1');
  ok(wantsBack({ doc: a.doc, hist: a.hist }) === true, 'Practice wants Back, so the shell does not leave the app');
  await a.back(); a.commit();
  ok(win.location.pathname === '/' && wantsBack({ doc: a.doc, hist: a.hist }) === false, 'the next Back returns Home, which lets Back leave');
}

// 3 · Tapping the destination you are on still replaces (no duplicate entries).
{
  const win = fakeWindow(); const a = app(win);
  const decide = to => linkReplacesEntry(parse(to), win.location);
  a.tap('/practice', decide);
  a.tap('/practice', decide);
  ok(historyDepth(win.history) === 1 && win.history.length === 2, 're-tapping the current destination replaces, it does not stack');
  ok(linkReplacesEntry({ pathname: '/practice', search: '?t=1', hash: '' }, win.location) === false, 'a different query is a different entry');
  ok(linkReplacesEntry(null, win.location) === false && linkReplacesEntry(parse('/'), null) === false, 'missing inputs never replace');
}

// 4 · Every in-app <Link> goes through AppLink.
{
  const src = fileURLToPath(new URL('../src/', import.meta.url));
  const files = [];
  const walk = d => { for (const n of readdirSync(d)) { const p = join(d, n); statSync(p).isDirectory() ? walk(p) : /\.jsx?$/.test(n) && files.push(p); } };
  walk(src);
  const raw = files.filter(f => !f.endsWith('AppLink.jsx'))
    .filter(f => /import\s*\{[^}]*\bLink\b[^}]*\}\s*from\s*['"]react-router(-dom)?['"]/.test(readFileSync(f, 'utf8')));
  ok(raw.length === 0, `no screen imports react-router's Link directly (found: ${raw.join(', ')})`);
}

if (failures.length) {
  console.error(`back-link race: ${failures.length} failed\n  - ${failures.join('\n  - ')}`);
  process.exit(1);
}
console.log(`back-link race: ${pass}/${pass} checks passed`);
