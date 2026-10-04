// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · reminders runtime
//
// Turns a computed schedule (schedule.js) into notifications on whichever
// surface this host has, and nothing else:
//
//   native shell   the `notifications` capability over the priNative envelope —
//                  UNUserNotificationCenter local notifications, scheduled up
//                  to seven days ahead, replaced wholesale on every sync and
//                  cleared on sign-out or when the toggle goes off.
//   browser        the Notification API, shown through the service worker's
//                  registration while the page is open. There is no push
//                  server, so a browser that is closed shows nothing; a
//                  reminder missed while closed is shown once on the next open
//                  if it is still fresh (under twelve hours old).
//
// Permission is requested from exactly one place — the Settings toggle — and
// never on load. Everything here tolerates a host with neither surface: the
// calls resolve false and the product carries on.
// ─────────────────────────────────────────────────────────────────────────────
import { priNative } from '../platform/native/index.js';
import { translate } from '../i18n/index.js';
import { renderReminder } from './schedule.js';

const QUEUE_KEY = pid => `pri-reminders-queue:${pid}`;
const SHOWN_KEY = pid => `pri-reminders-shown:${pid}`;
const ARM_WINDOW_MS = 24 * 3_600_000;   // timers are armed this far ahead while the page is open
const CATCH_UP_MS = 12 * 3_600_000;     // a missed reminder older than this is stale, not shown
const MAX_TIMER_MS = 2_147_000_000;     // setTimeout's ceiling
export const MAX_NATIVE_ITEMS = 64;

function storage(scope) {
  try { return scope?.localStorage || null; } catch { return null; }
}
const readJson = (store, key, fallback) => { try { return JSON.parse(store.getItem(key) || 'null') ?? fallback; } catch { return fallback; } };
const writeJson = (store, key, value) => { try { store.setItem(key, JSON.stringify(value)); } catch { /* best effort */ } };

/** The native surface, when the shell advertises `notifications`; else null. */
export function nativeNotifications(native = priNative) {
  const api = native?.notifications;
  if (!api || typeof native.has !== 'function' || !native.has('notifications')) return null;
  return api;
}

/**
 * createReminderRuntime({ scope, native, translate, now })
 * `scope` is the window (tests pass a stub); `native` the priNative facade.
 */
export function createReminderRuntime({ scope = globalThis, native = priNative, translate: tr = translate, now = () => Date.now() } = {}) {
  const timers = new Map();

  const webSupported = () => typeof scope?.Notification === 'function';
  const webPermission = () => (webSupported() ? scope.Notification.permission : 'unsupported');

  async function registration() {
    try {
      const sw = scope?.navigator?.serviceWorker;
      if (!sw) return null;
      return (await sw.getRegistration?.()) || null;
    } catch { return null; }
  }

  async function showWeb(item) {
    if (webPermission() !== 'granted') return false;
    const options = { body: item.body, tag: item.id, data: { url: item.url }, renotify: false, silent: false };
    try {
      const reg = await registration();
      if (reg && typeof reg.showNotification === 'function') { await reg.showNotification(item.title, options); return true; }
    } catch { /* fall through to the page-level API */ }
    try { new scope.Notification(item.title, options); return true; } catch { return false; }
  }

  function clearTimers() {
    for (const handle of timers.values()) scope.clearTimeout?.(handle) ?? clearTimeout(handle);
    timers.clear();
  }

  /** Arm page timers for the queued items due within the window. */
  function arm(pid, items) {
    clearTimers();
    const store = storage(scope);
    const shown = new Set(store ? readJson(store, SHOWN_KEY(pid), []) : []);
    const t = now();
    const setT = scope.setTimeout || setTimeout;
    for (const item of items) {
      if (shown.has(item.id)) continue;
      const wait = item.at - t;
      if (wait < 0 || wait > ARM_WINDOW_MS || wait > MAX_TIMER_MS) continue;
      timers.set(item.id, setT(() => { timers.delete(item.id); void fire(pid, item); }, Math.max(0, wait)));
    }
  }

  async function fire(pid, item) {
    const ok = await showWeb(item);
    const store = storage(scope);
    if (ok && store) {
      const shown = readJson(store, SHOWN_KEY(pid), []);
      writeJson(store, SHOWN_KEY(pid), [...shown.filter(id => id !== item.id), item.id].slice(-50));
    }
    return ok;
  }

  /** Show the freshest reminder that fell due while the page was closed. */
  async function catchUp(pid, items) {
    const store = storage(scope);
    const shown = new Set(store ? readJson(store, SHOWN_KEY(pid), []) : []);
    const t = now();
    const missed = items.filter(i => i.at <= t && t - i.at <= CATCH_UP_MS && !shown.has(i.id)).sort((a, b) => b.at - a.at);
    if (!missed.length) return false;
    return fire(pid, missed[0]);
  }

  return {
    /** 'native' | 'granted' | 'denied' | 'default' | 'unsupported' */
    surface() {
      if (nativeNotifications(native)) return 'native';
      return webPermission();
    },
    supported() { return !!nativeNotifications(native) || webSupported(); },

    /** Ask for permission. Called only from an explicit user action. */
    async requestPermission() {
      const nat = nativeNotifications(native);
      if (nat) {
        try { const r = await nat.requestPermission(); return r?.granted === true; } catch { return false; }
      }
      if (!webSupported()) return false;
      try { return (await scope.Notification.requestPermission()) === 'granted'; } catch { return false; }
    },

    /**
     * Replace whatever is scheduled with `items` (schedule.js output). Returns
     * { surface, scheduled }. Items are rendered to generic text here; nothing
     * but keys and counts went in, so nothing else can come out.
     */
    async sync(pid, items) {
      const rendered = (items || []).map(i => renderReminder(i, tr)).slice(0, MAX_NATIVE_ITEMS);
      const nat = nativeNotifications(native);
      if (nat) {
        try {
          await nat.cancelAll();
          if (!rendered.length) return { surface: 'native', scheduled: 0 };
          const r = await nat.schedule({ items: rendered });
          return { surface: 'native', scheduled: Number(r?.scheduled) || 0 };
        } catch { return { surface: 'native', scheduled: 0 }; }
      }
      const store = storage(scope);
      if (store && pid) writeJson(store, QUEUE_KEY(pid), rendered);
      if (webPermission() !== 'granted') { clearTimers(); return { surface: webPermission(), scheduled: 0 }; }
      arm(pid, rendered);
      await catchUp(pid, rendered);
      return { surface: 'granted', scheduled: timers.size };
    },

    /** Re-arm from the stored queue on boot (browser only; native holds its own). */
    async resume(pid) {
      if (nativeNotifications(native) || !pid) return 0;
      const store = storage(scope);
      const queued = store ? readJson(store, QUEUE_KEY(pid), []) : [];
      if (!Array.isArray(queued) || !queued.length || webPermission() !== 'granted') return 0;
      arm(pid, queued);
      await catchUp(pid, queued);
      return timers.size;
    },

    /** Sign-out and toggle-off: nothing pending, nothing shown, nothing kept. */
    async cancelAll(pid) {
      clearTimers();
      const store = storage(scope);
      if (store && pid) { try { store.removeItem(QUEUE_KEY(pid)); store.removeItem(SHOWN_KEY(pid)); } catch { /* nothing to clear */ } }
      const nat = nativeNotifications(native);
      if (nat) { try { await nat.cancelAll(); } catch { /* the shell may already have none */ } }
      try {
        const reg = await registration();
        const open = reg && typeof reg.getNotifications === 'function' ? await reg.getNotifications() : [];
        for (const n of open) n.close?.();
      } catch { /* no registration */ }
      return true;
    },

    /** Diagnostics for tests: how many page timers are armed. */
    armed() { return timers.size; },
    dispose() { clearTimers(); }
  };
}

let shared = null;
export function reminderRuntime() {
  if (!shared) shared = createReminderRuntime();
  return shared;
}

/** The one call sign-out makes: forget every reminder on this device. */
export function cancelRemindersOnSignOut(pid) {
  return reminderRuntime().cancelAll(pid);
}
