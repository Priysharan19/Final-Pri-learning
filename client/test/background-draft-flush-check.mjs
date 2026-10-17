// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · A typed answer still waiting in the draft store's coalescing
// window is on disk before the app can be suspended (#528)
//
// queueDraft holds a keystroke for up to COALESCE_MS before writing it. A
// phone that goes to the background inside that window can be suspended and
// then killed without another chance to run JavaScript, so the pending write
// must reach localStorage synchronously on the first "going away" signal:
//
//   1 · the page is hidden (visibilitychange → hidden), in a browser;
//   2 · the page is unloaded (pagehide);
//   3 · the native shell's own lifecycle event (priBridge envelope v1:
//       willResignActive → "inactive", didEnterBackground → "background"),
//       which the iOS/Android shells send before suspension;
//   4 · coming back (visible / "active") neither loses nor rewrites it, and a
//       page reloaded from scratch (the web process was killed while in the
//       background) reads the same draft back.
//
// Deterministic: no timers are allowed to fire — every check runs before the
// coalescing timer could, so only the flush-on-leave path can have written.
//
//   node client/test/background-draft-flush-check.mjs
// ─────────────────────────────────────────────────────────────────────────────
import { createFakeHost } from '../src/platform/native/fakeHost.js';

let pass = 0;
const failures = [];
const ok = (cond, label) => { if (cond) pass++; else failures.push(label); };

// ── A minimal page: localStorage, window/document events, a visibility state ─
const disk = new Map();
const localStorage = {
  getItem: k => (disk.has(String(k)) ? disk.get(String(k)) : null),
  setItem: (k, v) => { disk.set(String(k), String(v)); },
  removeItem: k => { disk.delete(String(k)); },
  key: i => [...disk.keys()][i] ?? null,
  get length() { return disk.size; },
  clear: () => disk.clear()
};
function target() {
  const listeners = new Map();
  return {
    addEventListener(type, fn) { if (!listeners.has(type)) listeners.set(type, []); listeners.get(type).push(fn); },
    removeEventListener(type, fn) { const l = listeners.get(type) || []; const i = l.indexOf(fn); if (i >= 0) l.splice(i, 1); },
    dispatch(type) { for (const fn of [...(listeners.get(type) || [])]) fn({ type }); }
  };
}
const win = target();
const doc = Object.assign(target(), { visibilityState: 'visible', documentElement: { lang: 'en' }, cookie: '' });
globalThis.window = Object.assign(globalThis, { localStorage, addEventListener: win.addEventListener, removeEventListener: win.removeEventListener });
globalThis.document = doc;
const hide = () => { doc.visibilityState = 'hidden'; doc.dispatch('visibilitychange'); };
const show = () => { doc.visibilityState = 'visible'; doc.dispatch('visibilitychange'); };

// The native shell, as the Swift/Kotlin shells speak to the page.
const host = createFakeHost({ capabilities: { lifecycle: { versions: [1], backButton: false } } });

// Stop the coalescing timer from ever firing: anything on disk below was
// written by a flush, not by the timed write.
const realSetTimeout = globalThis.setTimeout;
const held = [];
globalThis.setTimeout = (fn, ms) => { held.push({ fn, ms }); return held.length; };
globalThis.clearTimeout = () => {};

const drafts = await import('../src/components/drafts.js');
const { priNative } = await import('../src/platform/native/index.js');
priNative.lifecycle.state(); // the runtime binds to the fake host

const onDisk = id => {
  for (const [k, v] of disk) if (k.endsWith(`.question.${id}`)) { try { return JSON.parse(v).data?.typed ?? null; } catch { return 'unreadable'; } }
  return null;
};
const type = (id, typed) => drafts.queueDraft('question', id, { typed, working: '' }, { label: 'Triangles', path: '/practice' });

// ── 1 · visibilitychange → hidden ────────────────────────────────────────────
type('q-hide', 'x+4');
type('q-hide', 'x+42');
ok(onDisk('q-hide') === null, '1 · a queued keystroke is not on disk yet (still inside the coalescing window)');
ok(held.some(t => t.ms === 400), '1 · and is waiting on the coalescing timer');
hide();
ok(onDisk('q-hide') === 'x+42', '1 · hiding the page writes the latest pending answer synchronously');
show();
ok(onDisk('q-hide') === 'x+42' && drafts.readDraft('question', 'q-hide')?.typed === 'x+42', '4 · coming back keeps it, on disk and through readDraft');

// ── 2 · pagehide ─────────────────────────────────────────────────────────────
type('q-pagehide', '3/4');
ok(onDisk('q-pagehide') === null, '2 · pending before pagehide');
win.dispatch('pagehide');
ok(onDisk('q-pagehide') === '3/4', '2 · pagehide writes the pending answer');

// ── 3 · the native shell's lifecycle, with the page still "visible" ──────────
// WKWebView does not always deliver visibilitychange before suspension; the
// shell's own event must be enough on its own.
type('q-inactive', '7');
ok(onDisk('q-inactive') === null, '3 · pending before the shell reports inactive');
host.event('lifecycle.state', { state: 'inactive' });
ok(doc.visibilityState === 'visible' && onDisk('q-inactive') === '7', '3 · willResignActive ("inactive") writes it without any visibilitychange');
type('q-background', '12');
host.event('lifecycle.state', { state: 'background' });
ok(onDisk('q-background') === '12', '3 · didEnterBackground ("background") writes it');
type('q-active', '5');
host.event('lifecycle.state', { state: 'active' });
ok(onDisk('q-active') === null, '3 · becoming active is not a flush signal (the timed write still owns it)');
hide();
ok(onDisk('q-active') === '5', '3 · and the next hide writes it');

// ── 4 · a page reloaded from scratch reads the flushed draft back ─────────────
const reloaded = await import('../src/components/drafts.js?reloaded');
ok(reloaded.readDraft('question', 'q-hide')?.typed === 'x+42' && reloaded.readDraft('question', 'q-inactive')?.typed === '7',
  '4 · a fresh copy of the draft store (web process killed while backgrounded) reads the same answers');

globalThis.setTimeout = realSetTimeout;
host.uninstall();

console.log(`background draft flush: ${pass} passed, ${failures.length} failed`);
for (const f of failures) console.log(`  ✗ ${f}`);
process.exit(failures.length ? 1 : 0);
