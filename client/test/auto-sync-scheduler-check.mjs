// Pri Learning · automatic sync scheduler
//
// syncNow had one caller: the "Sync now" button. The scheduler runs it without a
// button — on start, on `online`, on return to the foreground, a few seconds
// after an answer, and every 15 minutes while visible — and never when it
// should not: offline, with no cloud origin, with no linked account, while a
// run is already in flight, or while the server has said the account cannot
// sync yet. Every trigger and guard is checked here with fake timers, a fake
// window/document and a fake syncNow; nothing real is contacted.
//
// Usage: node client/test/auto-sync-scheduler-check.mjs

import {
  ATTEMPT_DEBOUNCE_MS, ATTEMPT_EVENT, AUTO_SYNC_INTERVAL_MS, PAUSE_MS, SYNC_EVENT, createAutoSyncScheduler
} from '../src/platform/cloudSyncScheduler.js';

let pass = 0;
let fail = 0;
const failures = [];
const ok = (name, condition, detail = '') => {
  if (condition) { pass++; return true; }
  fail++;
  failures.push(`${name}${detail ? ` — ${detail}` : ''}`);
  return false;
};
const eq = (name, actual, expected) => ok(name, JSON.stringify(actual) === JSON.stringify(expected), `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);

// ── A deterministic host ─────────────────────────────────────────────────────

function makeClock() {
  let now = 1_700_000_000_000;
  let nextId = 1;
  const timers = new Map();
  return {
    now: () => now,
    setTimeout: (fn, ms) => { const id = nextId++; timers.set(id, { fn, at: now + ms, every: null }); return id; },
    clearTimeout: id => { timers.delete(id); },
    setInterval: (fn, ms) => { const id = nextId++; timers.set(id, { fn, at: now + ms, every: ms }); return id; },
    clearInterval: id => { timers.delete(id); },
    /** Move time forward, firing due timers in order and yielding to promises between them. */
    async advance(ms) {
      const end = now + ms;
      for (;;) {
        const due = [...timers.entries()].filter(([, t]) => t.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
        if (!due) break;
        const [id, t] = due;
        now = Math.max(now, t.at);
        if (t.every) t.at = now + t.every; else timers.delete(id);
        t.fn();
        await settle();
      }
      now = end;
      await settle();
    },
    pending: () => timers.size
  };
}

async function settle() { for (let i = 0; i < 10; i++) await new Promise(resolve => setImmediate(resolve)); }

class FakeTarget {
  constructor() { this.listeners = new Map(); }
  addEventListener(type, fn) { (this.listeners.get(type) || this.listeners.set(type, new Set()).get(type)).add(fn); }
  removeEventListener(type, fn) { this.listeners.get(type)?.delete(fn); }
  dispatchEvent(event) { for (const fn of [...(this.listeners.get(event.type) || [])]) fn(event); return true; }
  count(type) { return this.listeners.get(type)?.size || 0; }
}

function makeHost() {
  const clock = makeClock();
  const win = new FakeTarget();
  const doc = Object.assign(new FakeTarget(), { visibilityState: 'visible' });
  const nav = { onLine: true };
  const lifecycleListeners = new Set();
  const lifecycle = {
    state: () => 'active',
    on: fn => { lifecycleListeners.add(fn); return () => lifecycleListeners.delete(fn); }
  };
  const calls = [];
  let mode = 'resolve';            // 'resolve' | 'hold' | { reject: code }
  let held = [];
  let link = { accountId: 'acct-A' };
  let available = true;
  const announced = [];
  win.addEventListener(SYNC_EVENT, event => announced.push(event.detail));

  const deps = {
    ...clock,
    window: win, document: doc, navigator: nav, lifecycle,
    cloudAvailable: () => available,
    cloudAccountLink: async pid => (pid === 'p1' ? link : null),
    syncNow: pid => {
      calls.push(pid);
      if (mode === 'hold') return new Promise((resolve, reject) => held.push({ resolve, reject }));
      if (mode && typeof mode === 'object') return Promise.reject(Object.assign(new Error(mode.reject), { code: mode.reject }));
      return Promise.resolve({ pushedEvents: 0, pulledEvents: 0, restoredEvents: 0, lastSyncAt: clock.now() });
    }
  };
  return {
    clock, win, doc, nav, lifecycle, calls, announced,
    emitLifecycle: state => { for (const fn of lifecycleListeners) fn(state); },
    lifecycleListeners,
    setMode: next => { mode = next; },
    releaseHeld: async (result = { restoredEvents: 2 }) => { const list = held; held = []; for (const h of list) h.resolve(result); await settle(); },
    setLink: next => { link = next; },
    setAvailable: next => { available = next; },
    deps
  };
}

const attemptEvent = resolved => ({ type: ATTEMPT_EVENT, detail: { resolved, questionId: 'q' } });

// ── Start, online, foreground, native active ─────────────────────────────────
{
  const h = makeHost();
  const s = createAutoSyncScheduler(h.deps);
  eq('nothing runs before install', s.status().installed, false);
  const synced = [];
  const uninstall = s.install('p1', { onSynced: (result, reason) => synced.push(reason) });
  await settle();
  eq('installing syncs once on start', h.calls, ['p1']);
  eq('onSynced is told which trigger ran', synced, ['start']);
  eq('the status exposes the last automatic sync time', s.status('p1').lastAutoSyncAt, h.clock.now());
  eq('the status is scoped to the installed profile', s.status('p-other').lastAutoSyncAt, null);
  eq('a sync is announced on the window for the Settings panel', h.announced.map(a => [a.reason, a.ok]), [['start', true]]);

  h.win.dispatchEvent({ type: 'online' });
  await settle();
  eq('coming back online syncs', h.calls.length, 2);

  h.doc.visibilityState = 'hidden';
  h.doc.dispatchEvent({ type: 'visibilitychange' });
  await settle();
  eq('going hidden does not sync', h.calls.length, 2);
  h.doc.visibilityState = 'visible';
  h.doc.dispatchEvent({ type: 'visibilitychange' });
  await settle();
  eq('becoming visible syncs', h.calls.length, 3);

  h.emitLifecycle('background');
  await settle();
  eq('a native background report does not sync', h.calls.length, 3);
  h.emitLifecycle('active');
  await settle();
  eq('a native active report syncs', h.calls.length, 4);

  eq('uninstall returns a function a React effect can return', typeof uninstall, 'function');
  uninstall();
  h.win.dispatchEvent({ type: 'online' });
  h.doc.dispatchEvent({ type: 'visibilitychange' });
  h.emitLifecycle('active');
  await h.clock.advance(AUTO_SYNC_INTERVAL_MS * 2);
  eq('after uninstall no trigger syncs', h.calls.length, 4);
  eq('after uninstall no listener is left on the window', h.win.count('online') + h.win.count(ATTEMPT_EVENT), 0);
  eq('after uninstall no listener is left on the document', h.doc.count('visibilitychange'), 0);
  eq('after uninstall no native lifecycle listener is left', h.lifecycleListeners.size, 0);
  eq('after uninstall no timer is left running', h.clock.pending(), 0);
}

// ── Debounced practice attempts ──────────────────────────────────────────────
{
  const h = makeHost();
  const s = createAutoSyncScheduler(h.deps);
  s.install('p1');
  await settle();
  eq('start sync ran', h.calls.length, 1);

  h.win.dispatchEvent(attemptEvent(false));
  await h.clock.advance(ATTEMPT_DEBOUNCE_MS + 1);
  eq('an unresolved submission (wrong first try) does not schedule a sync', h.calls.length, 1);

  h.win.dispatchEvent(attemptEvent(true));
  await h.clock.advance(1000);
  h.win.dispatchEvent(attemptEvent(true));
  await h.clock.advance(1000);
  h.win.dispatchEvent(attemptEvent(true));
  await h.clock.advance(ATTEMPT_DEBOUNCE_MS - 1);
  eq('three answers within the debounce window have not synced yet', h.calls.length, 1);
  await h.clock.advance(2);
  eq('three answers become exactly one sync, after the debounce', h.calls.length, 2);
  eq('the trigger is recorded as the attempt', s.status().lastTrigger, 'attempt');

  s.noteLearningActivity();
  await h.clock.advance(ATTEMPT_DEBOUNCE_MS + 1);
  eq('the explicit activity note syncs the same way', h.calls.length, 3);
  s.uninstall();
}

// ── The 15-minute interval, only while visible ───────────────────────────────
{
  const h = makeHost();
  const s = createAutoSyncScheduler(h.deps);
  s.install('p1');
  await settle();
  await h.clock.advance(AUTO_SYNC_INTERVAL_MS - 1);
  eq('nothing before the interval elapses', h.calls.length, 1);
  await h.clock.advance(1);
  eq('the interval syncs once it elapses', h.calls.length, 2);
  h.doc.visibilityState = 'hidden';
  await h.clock.advance(AUTO_SYNC_INTERVAL_MS * 3);
  eq('a hidden page is not synced on the interval', h.calls.length, 2);
  eq('the skip is recorded with its reason', s.status().lastSkip?.why, 'hidden');
  h.doc.visibilityState = 'visible';
  await h.clock.advance(AUTO_SYNC_INTERVAL_MS);
  eq('the interval resumes once visible', h.calls.length, 3);
  s.uninstall();
}

// ── Never two at once ────────────────────────────────────────────────────────
{
  const h = makeHost();
  h.setMode('hold');
  const s = createAutoSyncScheduler(h.deps);
  s.install('p1');
  await settle();
  eq('the start sync is in flight', [h.calls.length, s.status().running], [1, true]);
  h.win.dispatchEvent({ type: 'online' });
  h.doc.dispatchEvent({ type: 'visibilitychange' });
  h.emitLifecycle('active');
  await h.clock.advance(AUTO_SYNC_INTERVAL_MS);
  const direct = await s.trigger('manual');
  eq('triggers during a run do not start a second sync', h.calls.length, 1);
  eq('a direct trigger during a run says so', direct, { skipped: 'running' });
  await h.releaseHeld();
  eq('exactly one follow-up run covers every trigger that arrived mid-run', h.calls.length, 2);
  eq('the follow-up is the first mid-run trigger', s.status().lastTrigger, 'online');
  await h.releaseHeld();
  await settle();
  eq('no further run after the follow-up', [h.calls.length, s.status().running], [2, false]);
  s.uninstall();
}

// ── Guards: offline, no cloud, no link ───────────────────────────────────────
{
  const h = makeHost();
  h.nav.onLine = false;
  const s = createAutoSyncScheduler(h.deps);
  s.install('p1');
  await settle();
  eq('offline: the start trigger is a no-op', h.calls.length, 0);
  eq('offline: the skip reason is recorded', s.status().lastSkip?.why, 'offline');
  h.win.dispatchEvent(attemptEvent(true));
  await h.clock.advance(ATTEMPT_DEBOUNCE_MS + 1);
  await h.clock.advance(AUTO_SYNC_INTERVAL_MS);
  eq('offline: attempts and the interval are no-ops', h.calls.length, 0);
  h.nav.onLine = true;
  h.win.dispatchEvent({ type: 'online' });
  await settle();
  eq('back online: the next trigger syncs', h.calls.length, 1);

  h.setAvailable(false);
  await h.clock.advance(AUTO_SYNC_INTERVAL_MS);
  eq('no cloud origin: a no-op', [h.calls.length, s.status().lastSkip?.why], [1, 'cloud-unavailable']);
  h.setAvailable(true);

  h.setLink(null);
  await h.clock.advance(AUTO_SYNC_INTERVAL_MS);
  eq('no linked account: a no-op', [h.calls.length, s.status().lastSkip?.why], [1, 'not-linked']);
  h.setLink({ accountId: 'acct-A' });
  await h.clock.advance(AUTO_SYNC_INTERVAL_MS);
  eq('linked again: the interval syncs', h.calls.length, 2);
  s.uninstall();

  const t = createAutoSyncScheduler(h.deps);
  const off = t.install('bad pid!');
  await settle();
  eq('an invalid profile id installs nothing', [t.status().installed, typeof off], [false, 'function']);
}

// ── Consent pending pauses automatic runs; manual sync clears it ─────────────
{
  const h = makeHost();
  h.setMode({ reject: 'GUARDIAN_CONSENT_PENDING' });
  const s = createAutoSyncScheduler(h.deps);
  s.install('p1');
  await settle();
  eq('the refused start run is counted once', h.calls.length, 1);
  eq('the refusal pauses automatic sync', [s.status().paused, s.status().pauseCode], [true, 'GUARDIAN_CONSENT_PENDING']);
  eq('the error is exposed for the status line', s.status().lastError?.code, 'GUARDIAN_CONSENT_PENDING');
  eq('a refused run is announced as not ok', h.announced.at(-1)?.ok, false);
  h.win.dispatchEvent({ type: 'online' });
  h.win.dispatchEvent(attemptEvent(true));
  await h.clock.advance(ATTEMPT_DEBOUNCE_MS + 1);
  await h.clock.advance(AUTO_SYNC_INTERVAL_MS);
  eq('while paused, online/attempt/interval triggers are no-ops', h.calls.length, 1);
  ok('the skip names the pause', String(s.status().lastSkip?.why || '').startsWith('paused:'), s.status().lastSkip?.why);
  await h.clock.advance(PAUSE_MS);
  eq('after the pause window the interval tries again', h.calls.length, 2);
  eq('a second refusal pauses again', s.status().paused, true);

  // The guardian confirmed, and the student pressed Sync now in Settings.
  h.setMode('resolve');
  s.noteManualSync({ restoredEvents: 0 });
  eq('a manual sync clears the pause', s.status().paused, false);
  h.win.dispatchEvent({ type: 'online' });
  await settle();
  eq('automatic sync resumes after the manual sync', h.calls.length, 3);
  eq('a successful run clears the recorded error', s.status().lastError, null);

  // A transient failure never pauses.
  h.setMode({ reject: 'CLOUD_REQUEST_FAILED' });
  h.win.dispatchEvent({ type: 'online' });
  await settle();
  eq('a transient failure is recorded', [h.calls.length, s.status().lastError?.code], [4, 'CLOUD_REQUEST_FAILED']);
  eq('a transient failure does not pause', s.status().paused, false);
  h.win.dispatchEvent({ type: 'online' });
  await settle();
  eq('the next trigger tries again', h.calls.length, 5);
  s.uninstall();
}

// ── Switching profiles ───────────────────────────────────────────────────────
{
  const h = makeHost();
  const s = createAutoSyncScheduler(h.deps);
  s.install('p1');
  await settle();
  s.install('p2');
  await settle();
  eq('installing another profile uninstalls the first and takes over for the second', [h.calls, s.status().pid], [['p1'], 'p2']);
  eq('the second profile is unlinked, so its start run is a no-op', s.status().lastSkip?.why, 'not-linked');
  eq('one listener set, not two', h.win.count('online'), 1);
  s.uninstall();
}

console.log(`\nAuto sync scheduler — ${pass}/${pass + fail} checks`);
if (failures.length) {
  console.log('\nfailures:');
  for (const line of failures) console.log(`  ${line}`);
}
console.log(`\n${fail ? '✖ AUTO SYNC SCHEDULER FAILED' : '✔ AUTO SYNC SCHEDULER PASSED'} — ${pass}/${pass + fail} checks`);
process.exit(fail ? 1 : 0);
