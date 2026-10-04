// Pri Learning · automatic cloud sync
//
// syncNow used to have exactly one caller: the "Sync now" button. A student who
// never opened Settings never synced, and a new device never restored. This
// module runs syncNow for the signed-in local profile without a button:
//
//   · when the app starts (installed once the profile is known, so the local
//     database is ready and the cloud origin has been discovered);
//   · when the browser/shell comes back online;
//   · when the page becomes visible again, and when a native shell reports the
//     app `active` through priNative.lifecycle;
//   · a few seconds after a practice answer is recorded (debounced, so a run
//     of answers is one sync);
//   · every 15 minutes while the page is visible.
//
// It is a no-op offline, with no cloud origin, with no linked account, and
// while a run is already in flight (a trigger during a run is coalesced into at
// most one follow-up run). A sync the server refuses for a reason that will not
// change by retrying — guardian consent pending or withdrawn, signed out,
// account mismatch, shell too old — pauses automatic runs for a while instead of
// knocking every 15 minutes; a manual Sync still works and clears the pause.
//
// Everything that touches the network is syncNow, behind cloudTransport. This
// module only decides WHEN.

import { syncNow as realSyncNow } from './syncWorker.js';
import { cloudAccountLink as realCloudAccountLink } from './cloudAccount.js';
import { cloudAvailable as realCloudAvailable } from './cloudTransport.js';
import { priNative } from './native/index.js';

export const AUTO_SYNC_INTERVAL_MS = 15 * 60 * 1000;
export const ATTEMPT_DEBOUNCE_MS = 5 * 1000;
export const PAUSE_MS = 30 * 60 * 1000;
export const ATTEMPT_EVENT = 'pri:attempt-feedback';
export const SYNC_EVENT = 'pri:cloud-sync';

// Refusals that retrying on a timer cannot change. Anything else (offline,
// timeout, 5xx, a transient conflict) is simply tried again on the next trigger.
export const PAUSE_CODES = Object.freeze([
  'GUARDIAN_CONSENT_PENDING', 'GUARDIAN_CONSENT_WITHDRAWN', 'GUARDIAN_CONSENT_UNAVAILABLE',
  'CLOUD_SIGN_IN_REQUIRED', 'CLOUD_ACCOUNT_MISMATCH', 'SYNC_ACCOUNT_MISMATCH',
  'CLOUD_ACCOUNT_NOT_LINKED', 'CLIENT_UPGRADE_REQUIRED', 'EMAIL_VERIFICATION_REQUIRED',
  'CLOUD_DISABLED'
]);

const PID = /^[A-Za-z0-9._-]{1,100}$/;

function defaultDeps() {
  const g = globalThis;
  return {
    syncNow: realSyncNow,
    cloudAccountLink: realCloudAccountLink,
    cloudAvailable: realCloudAvailable,
    lifecycle: priNative?.lifecycle || null,
    window: typeof g.window !== 'undefined' ? g.window : null,
    document: typeof g.document !== 'undefined' ? g.document : null,
    navigator: typeof g.navigator !== 'undefined' ? g.navigator : null,
    now: () => Date.now(),
    setTimeout: (fn, ms) => g.setTimeout(fn, ms),
    clearTimeout: id => g.clearTimeout(id),
    setInterval: (fn, ms) => g.setInterval(fn, ms),
    clearInterval: id => g.clearInterval(id)
  };
}

/**
 * Build a scheduler over explicit dependencies. Production uses the singleton
 * below; tests build their own with fake timers, a fake window and a fake
 * syncNow so every trigger and guard is checked deterministically.
 */
export function createAutoSyncScheduler(overrides = {}) {
  const deps = { ...defaultDeps(), ...overrides };
  const state = {
    pid: null,
    installed: false,
    running: false,
    followUp: null,          // reason of a trigger that arrived mid-run
    debounce: null,
    interval: null,
    teardown: [],
    runs: 0,
    lastTrigger: null,
    lastAttemptAt: null,
    lastAutoSyncAt: null,
    lastAutoSyncResult: null,
    lastError: null,
    lastSkip: null,
    pausedUntil: null,
    pauseCode: null,
    onSynced: null
  };

  const online = () => deps.navigator?.onLine !== false;
  const visible = () => {
    const doc = deps.document;
    if (doc && typeof doc.visibilityState === 'string') return doc.visibilityState !== 'hidden';
    const lc = deps.lifecycle;
    try { return !lc || lc.state() !== 'background'; } catch { return true; }
  };

  function announce(detail) {
    const win = deps.window;
    if (!win || typeof win.dispatchEvent !== 'function') return;
    try {
      const Ctor = globalThis.CustomEvent;
      win.dispatchEvent(Ctor ? new Ctor(SYNC_EVENT, { detail }) : Object.assign(new Event(SYNC_EVENT), { detail }));
    } catch { /* a listener's failure is not the scheduler's */ }
  }

  /** Why an automatic run would not start right now, or null when it may. */
  async function blocker(reason) {
    if (!state.installed || !state.pid) return 'not-installed';
    if (!online()) return 'offline';
    if (reason === 'interval' && !visible()) return 'hidden';
    if (state.pausedUntil && deps.now() < state.pausedUntil) return `paused:${state.pauseCode || 'refused'}`;
    let available = false;
    try { available = !!deps.cloudAvailable(); } catch { available = false; }
    if (!available) return 'cloud-unavailable';
    const link = await deps.cloudAccountLink(state.pid).catch(() => null);
    if (!link?.accountId) return 'not-linked';
    return null;
  }

  async function run(reason) {
    if (state.running) {
      // Never two syncs at once. Remember that something asked, run once more
      // when this run ends, and let that run cover every trigger in between.
      state.followUp = state.followUp || reason;
      return { skipped: 'running' };
    }
    const why = await blocker(reason);
    if (why) {
      state.lastSkip = { reason, why, at: deps.now() };
      return { skipped: why };
    }
    state.running = true;
    state.lastTrigger = reason;
    const pid = state.pid;
    try {
      const result = await deps.syncNow(pid);
      state.runs++;
      state.lastAutoSyncAt = deps.now();
      state.lastAutoSyncResult = result;
      state.lastError = null;
      state.pausedUntil = null;
      state.pauseCode = null;
      announce({ pid, reason, ok: true, result });
      if (typeof state.onSynced === 'function') {
        try { await state.onSynced(result, reason); } catch { /* UI refresh failure is not a sync failure */ }
      }
      return { ok: true, result };
    } catch (error) {
      const code = error?.code || error?.message || 'sync-failed';
      state.lastError = { code: String(code).slice(0, 120), at: deps.now(), reason };
      if (PAUSE_CODES.includes(error?.code)) {
        state.pausedUntil = deps.now() + PAUSE_MS;
        state.pauseCode = error.code;
      }
      announce({ pid, reason, ok: false, code: state.lastError.code });
      return { ok: false, code: state.lastError.code };
    } finally {
      state.running = false;
      if (state.followUp && state.installed && state.pid === pid) {
        const next = state.followUp;
        state.followUp = null;
        // Not awaited: the follow-up is its own run with its own guards.
        void run(next);
      }
    }
  }

  function trigger(reason) {
    return run(String(reason || 'manual'));
  }

  /** A practice answer was recorded: sync shortly, once, however many land. */
  function noteLearningActivity() {
    if (!state.installed) return;
    state.lastAttemptAt = deps.now();
    if (state.debounce) deps.clearTimeout(state.debounce);
    state.debounce = deps.setTimeout(() => {
      state.debounce = null;
      void run('attempt');
    }, ATTEMPT_DEBOUNCE_MS);
  }

  function listen(target, type, handler) {
    if (!target || typeof target.addEventListener !== 'function') return;
    target.addEventListener(type, handler);
    state.teardown.push(() => target.removeEventListener(type, handler));
  }

  function uninstall() {
    for (const off of state.teardown.splice(0)) { try { off(); } catch { /* already gone */ } }
    if (state.debounce) { deps.clearTimeout(state.debounce); state.debounce = null; }
    if (state.interval) { deps.clearInterval(state.interval); state.interval = null; }
    state.installed = false;
    state.followUp = null;
    state.pid = null;
    state.onSynced = null;
  }

  /**
   * Start automatic syncing for one local profile. Returns the uninstall
   * function, so a React effect can return it directly. Installing for another
   * profile first uninstalls the previous one: one scheduler, one profile.
   */
  function install(pid, { onSynced = null, startDelayMs = 0 } = {}) {
    uninstall();
    if (!PID.test(String(pid || ''))) return uninstall;
    state.pid = String(pid);
    state.installed = true;
    state.onSynced = onSynced;
    state.pausedUntil = null;
    state.pauseCode = null;

    listen(deps.window, 'online', () => { void run('online'); });
    listen(deps.document, 'visibilitychange', () => { if (visible()) void run('visible'); });
    listen(deps.window, ATTEMPT_EVENT, event => {
      if (event?.detail?.resolved === true) noteLearningActivity();
    });
    if (deps.lifecycle && typeof deps.lifecycle.on === 'function') {
      try {
        const off = deps.lifecycle.on(next => { if (next === 'active') void run('active'); });
        if (typeof off === 'function') state.teardown.push(off);
      } catch { /* no native lifecycle in this host */ }
    }
    state.interval = deps.setInterval(() => { void run('interval'); }, AUTO_SYNC_INTERVAL_MS);

    if (startDelayMs > 0) {
      const timer = deps.setTimeout(() => { void run('start'); }, startDelayMs);
      state.teardown.push(() => deps.clearTimeout(timer));
    } else {
      void run('start');
    }
    return uninstall;
  }

  /** A manual Sync just happened elsewhere: it clears any pause and is the new "last sync". */
  function noteManualSync(result = null) {
    state.pausedUntil = null;
    state.pauseCode = null;
    state.lastError = null;
    if (result) state.lastAutoSyncResult = result;
  }

  function status(pid = null) {
    const forPid = pid === null || String(pid) === state.pid;
    return {
      installed: state.installed && forPid,
      pid: state.pid,
      running: state.running,
      runs: state.runs,
      lastTrigger: state.lastTrigger,
      lastAutoSyncAt: forPid ? state.lastAutoSyncAt : null,
      restoredEvents: forPid ? (state.lastAutoSyncResult?.restoredEvents || 0) : 0,
      lastError: forPid ? state.lastError : null,
      lastSkip: forPid ? state.lastSkip : null,
      paused: !!(state.pausedUntil && deps.now() < state.pausedUntil),
      pauseCode: state.pausedUntil && deps.now() < state.pausedUntil ? state.pauseCode : null,
      pausedUntil: state.pausedUntil
    };
  }

  return Object.freeze({ install, uninstall, trigger, noteLearningActivity, noteManualSync, status });
}

// ── The app's one scheduler ──────────────────────────────────────────────────

let shared = null;
const scheduler = () => (shared ||= createAutoSyncScheduler());

/** Install for the signed-in local profile; returns the uninstall function. */
export function installAutoSync(pid, options = {}) {
  return scheduler().install(pid, options);
}

export function uninstallAutoSync() {
  if (shared) shared.uninstall();
}

/** Ask for a sync now, through the same guards and single-flight as the triggers. */
export function requestAutoSync(reason = 'manual') {
  return scheduler().trigger(reason);
}

/** A practice answer was recorded outside the window event path. */
export function noteLearningActivity() {
  scheduler().noteLearningActivity();
}

/** The Settings panel pressed Sync now and it succeeded. */
export function noteManualSync(result = null) {
  scheduler().noteManualSync(result);
}

/** What the Settings panel shows about automatic sync. */
export function autoSyncStatus(pid = null) {
  return scheduler().status(pid);
}
