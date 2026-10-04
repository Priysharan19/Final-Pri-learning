// Page links push or replace by the real URL, not the router's stale location.
//
// Regression for the CP-10 Android finding (2026-10-02): Back from /practice
// to /, then a Practice tap before Home had rendered, made React Router's
// <Link> compare against its not-yet-updated location (/practice), REPLACE
// the Home entry (idx 0) and leave nothing behind it — the next Back left
// the app. This drives React Router's own browser history over a fake
// window whose React render lags the URL, exactly as on a slow phone.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { UNSAFE_createBrowserHistory as createBrowserHistory, createPath } from 'react-router-dom';
import { isCurrentUrl, pageLinkClick } from '../src/platform/pageLink.js';
import { historyDepth, wantsBack } from '../src/platform/backNavigation.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = path => readFileSync(join(ROOT, path), 'utf8');

let pass = 0;
let fail = 0;
function check(name, condition, detail = '') {
  if (condition) { pass += 1; console.log(`  ✔ ${name}`); }
  else { fail += 1; console.log(`  ✘ ${name}${detail ? ` — ${detail}` : ''}`); }
}

/** A browser session history: entries, a cursor, popstate on traversal. */
function fakeBrowser(start) {
  const entries = [{ url: start, state: null }];
  let at = 0;
  const popListeners = new Set();
  const location = {};
  const sync = () => {
    const u = new URL(entries[at].url, 'http://localhost');
    Object.assign(location, { pathname: u.pathname, search: u.search, hash: u.hash, href: u.href, origin: u.origin });
  };
  const history = {
    get state() { return entries[at].state; },
    get length() { return entries.length; },
    pushState(state, _title, url) { entries.splice(at + 1); entries.push({ url: url ?? entries[at].url, state }); at += 1; sync(); },
    replaceState(state, _title, url) { entries[at] = { url: url ?? entries[at].url, state }; sync(); },
    go(n) {
      const next = Math.max(0, Math.min(entries.length - 1, at + n));
      if (next === at) return;
      at = next; sync();
      for (const fn of popListeners) fn({ type: 'popstate' });
    },
    back() { this.go(-1); },
  };
  location.assign = url => history.pushState(null, '', url);
  sync();
  const win = {
    location, history,
    addEventListener(type, fn) { if (type === 'popstate') popListeners.add(fn); },
    removeEventListener(type, fn) { if (type === 'popstate') popListeners.delete(fn); },
  };
  return { win, stack: () => entries.map(e => `${e.url}@${e.state?.idx}`), at: () => at };
}

/** BrowserRouter: React Router's history, with React's render deferred. The
 * router's location (what <Link> compares against) only moves on render(). */
function slowRouter(start) {
  const browser = fakeBrowser(start);
  const history = createBrowserHistory({ window: browser.win, v5Compat: true });
  let rendered = history.location;
  let pending = null;
  history.listen(update => { pending = update.location; });
  const navigate = (to, opts = {}) => (opts.replace ? history.replace(to) : history.push(to));
  return {
    ...browser, history, navigate,
    routerLocation: () => rendered,
    render() { if (pending) { rendered = pending; pending = null; } },
  };
}

function click(handler, init = {}) {
  const event = { button: 0, metaKey: false, altKey: false, ctrlKey: false, shiftKey: false, defaultPrevented: false, ...init };
  event.preventDefault = () => { event.defaultPrevented = true; };
  handler(event);
  return event;
}

/** Home → Practice → Back → (tap Practice before Home renders) → Back. */
function backThenTapBeforeRender(decide) {
  const r = slowRouter('/');
  r.navigate('/practice'); r.render();
  r.win.history.back(); // the URL is / at once; React has not re-rendered
  const routerStillSaid = createPath(r.routerLocation());
  decide(r, '/practice');
  return { r, routerStillSaid };
}

console.log('— the race, with React Router\'s own Link rule (control) —');
{
  const { r, routerStillSaid } = backThenTapBeforeRender((r, to) => {
    // useLinkClickHandler: replace = createPath(location) === createPath(to)
    const replace = createPath(r.routerLocation()) === to;
    r.navigate(to, { replace });
  });
  check('the router still reports /practice after Back moved the URL to /', routerStillSaid === '/practice' && r.win.location.pathname === '/practice');
  check('the stale rule REPLACES the Home entry (bug reproduced): no / left in the stack', r.at() === 0 && r.stack()[0] === '/practice@0' && !r.stack().some(e => e.startsWith('/@')), r.stack().join(' '));
  check('…and the page then refuses Back, so Back would leave the app', !wantsBack({ doc: null, hist: r.win.history }));
}

console.log('— the race, with page links —');
{
  const { r } = backThenTapBeforeRender((r, to) => {
    const ev = click(pageLinkClick({ to, navigate: r.navigate, win: r.win }));
    check('the click is handled in-app (default prevented)', ev.defaultPrevented);
  });
  r.render();
  check('Practice is pushed after Home: stack is / then /practice', r.stack().join(' ') === '/@0 /practice@1', r.stack().join(' '));
  check('the new entry has idx > 0', historyDepth(r.win.history) === 1);
  check('the page wants the next Back press', wantsBack({ doc: null, hist: r.win.history }));
  check('the router renders /practice', r.routerLocation().pathname === '/practice');
  r.win.history.back(); r.render();
  check('Back returns to Home', r.win.location.pathname === '/' && r.routerLocation().pathname === '/');
  check('Home is the landing entry again: Back now leaves the app', historyDepth(r.win.history) === 0 && !wantsBack({ doc: null, hist: r.win.history }));
}

console.log('— tapping the page you are on adds nothing —');
{
  const r = slowRouter('/');
  r.navigate('/practice'); r.render();
  click(pageLinkClick({ to: '/practice', navigate: r.navigate, win: r.win })); r.render();
  check('a tap on the current page replaces, no duplicate entry', r.stack().join(' ') === '/@0 /practice@1', r.stack().join(' '));
  // Router stale the other way: it still says /practice but the URL is /.
  r.win.history.back();
  click(pageLinkClick({ to: '/', navigate: r.navigate, win: r.win })); r.render();
  check('Home tapped while the router still shows Practice replaces, keeping one Home', r.stack().join(' ') === '/@0 /practice@1' && r.at() === 0, `${r.stack().join(' ')} at ${r.at()}`);
}

console.log('— search and hash are part of the page —');
{
  const win = { location: { pathname: '/review', search: '?filter=wrong', hash: '' } };
  check('same path + search is current', isCurrentUrl('/review?filter=wrong', win));
  check('a different search is a different page', !isCurrentUrl('/review', win));
  check('an object `to` is compared the same way', isCurrentUrl({ pathname: '/review', search: '?filter=wrong' }, win));
  const teach = { location: { pathname: '/teach', search: '', hash: '#teacher-classes' } };
  check('a different hash is a different place', !isCurrentUrl('/teach#teacher-assignments', teach) && isCurrentUrl('/teach#teacher-classes', teach));
  check('no window means never "current" (push)', !isCurrentUrl('/', null));
}

console.log('— it stays a normal link —');
{
  const calls = [];
  const navigate = (to, opts) => calls.push([to, opts.replace, opts.state]);
  const win = { location: { pathname: '/', search: '', hash: '' } };
  for (const mod of ['metaKey', 'ctrlKey', 'shiftKey', 'altKey']) {
    const ev = click(pageLinkClick({ to: '/practice', navigate, win }), { [mod]: true });
    check(`${mod}-click is left to the browser`, !ev.defaultPrevented);
  }
  check('a non-left button is left to the browser', !click(pageLinkClick({ to: '/practice', navigate, win }), { button: 1 }).defaultPrevented);
  check('target=_blank is left to the browser', !click(pageLinkClick({ to: '/practice', navigate, win, target: '_blank' })).defaultPrevented);
  check('none of those navigated in-app', calls.length === 0);
  let sheetClosed = false;
  click(pageLinkClick({ to: '/exams', navigate, win, onClick: () => { sheetClosed = true; } }));
  check('the caller\'s onClick runs (More sheet closes) and the link still navigates', sheetClosed && calls.at(-1)?.[0] === '/exams' && calls.at(-1)?.[1] === false);
  const before = calls.length;
  click(pageLinkClick({ to: '/exams', navigate, win, onClick: e => e.preventDefault() }));
  check('an onClick that prevents default stops navigation', calls.length === before);
  click(pageLinkClick({ to: '/exams', navigate, win, replace: true }));
  check('an explicit replace prop is honoured', calls.at(-1)?.[1] === true);
  click(pageLinkClick({ to: '/exams', navigate, win, state: { from: 'home' } }));
  check('link state reaches navigate', calls.at(-1)?.[2]?.from === 'home');
}

console.log('— every in-app page link uses it —');
{
  const files = ['client/src/App.jsx', 'client/src/components/FreeCapNotice.jsx', 'client/src/pages/PracticeBase.jsx', 'client/src/pages/Legal.jsx', 'client/src/pages/Login.jsx', 'client/src/pages/Notes.jsx'];
  for (const f of files) {
    const src = read(f);
    check(`${f} has no raw <Link>`, !/<Link\b/.test(src) && /<PageLink\b/.test(src));
  }
  const app = read('client/src/App.jsx');
  check('sidebar, mobile nav and More sheet are PageLinks', (app.match(/<PageLink key=\{item\.to\}/g) || []).length === 3);
  check('the logo decides from the real URL too', app.includes("nav('/', { replace: isCurrentUrl('/') })"));
  const comp = read('client/src/components/PageLink.jsx');
  check('PageLink routes every click through pageLinkClick', comp.includes('onClick={pageLinkClick({ to, navigate, onClick, target, replace, state })}'));
  // Sweep the whole client: a screen added later must not reintroduce the
  // race by importing React Router's Link directly (only PageLink may).
  const sources = [];
  const walk = dir => {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) walk(full);
      else if (/\.jsx?$/.test(name)) sources.push(full);
    }
  };
  walk(join(ROOT, 'client', 'src'));
  const rawLinkImport = /import\s*\{[^}]*\bLink\b[^}]*\}\s*from\s*['"]react-router(-dom)?['"]/;
  const offenders = sources
    .filter(f => !f.endsWith(join('components', 'PageLink.jsx')))
    .filter(f => rawLinkImport.test(readFileSync(f, 'utf8')))
    .map(f => f.slice(ROOT.length + 1));
  check('no other file under client/src imports React Router\'s Link directly', offenders.length === 0, offenders.join(', '));
}

const total = pass + fail;
if (fail) {
  console.log(`PAGE LINK HISTORY: FAIL — ${fail}/${total} checks failed`);
  process.exit(1);
}
console.log(`PAGE LINK HISTORY: PASS — ${pass}/${total} checks`);
