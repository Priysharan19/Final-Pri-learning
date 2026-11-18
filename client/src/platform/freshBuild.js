// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · a returning browser moves to the build the server is serving.
//
// The service worker answers every navigation from the cache of the build it
// was installed with (public/sw.js, shellFor) and installs a new one only
// after the page has loaded. So the first visit after a release is the OLD
// shell, and nothing moved the page onto the new one: a student could sit on
// last week's sign-up step, with last week's rules, until they happened to
// close and reopen the tab twice.
//
// This asks the server (release.json, never cached) which build is live and
// compares it with the SHA this bundle was built from:
//
//   · same, or either side unknown (development, native bundle): nothing.
//   · different, and the student has not touched the page since it loaded:
//     reload once, so the new build is on screen before they start.
//   · different, and they have typed, drawn or tapped: never reload under
//     them — a small notice offers "Update available", and they choose.
//
// It reloads at most once per live build (a guard in sessionStorage), so a
// reload that is somehow answered with the old shell again falls back to the
// notice instead of looping. Before reloading, the stale shell is dropped from
// the worker's caches so the reload cannot be answered with it, and the worker
// is asked to look for its own update.
// ─────────────────────────────────────────────────────────────────────────────

import { readReleaseIdentityManifest } from './cloudTransport.js';
import { translate } from '../i18n/core.js';

const SHA = /^[0-9a-f]{40}$/;
const GUARD_KEY = 'pri.freshBuild.reloaded.v1';
const RECHECK_MS = 60_000;
const SHELL_PATHS = ['/index.html', '/'];
// Anything a person does to a page that may leave something unsaved in it.
const TOUCH_EVENTS = ['keydown', 'input', 'paste', 'pointerdown', 'touchstart'];

/** The SHA this bundle was built from, or '' when it does not know (dev, native). */
export function ownBuildSha() {
  // eslint-disable-next-line no-undef
  const sha = typeof __PRI_BUILD_SHA__ === 'string' ? __PRI_BUILD_SHA__ : '';
  return SHA.test(sha) ? sha : '';
}

/** Pure decision: what to do given who is live, who we are, and what happened. */
export function freshnessAction({ ownSha, liveSha, touched, alreadyReloadedFor }) {
  if (!SHA.test(ownSha || '') || !SHA.test(liveSha || '')) return 'none';
  if (ownSha === liveSha) return 'none';
  if (touched) return 'notice';
  if (alreadyReloadedFor === liveSha) return 'notice';
  return 'reload';
}

async function dropStaleShell(win) {
  try {
    const names = (await win.caches.keys()).filter(n => n.startsWith('pri-'));
    await Promise.all(names.map(async n => {
      const cache = await win.caches.open(n);
      await Promise.all(SHELL_PATHS.map(p => cache.delete(p)));
    }));
  } catch { /* no cache API, or unreadable: the reload then asks the worker as before */ }
}

async function askWorkerToUpdate(win) {
  try {
    const reg = await win.navigator.serviceWorker?.getRegistration?.();
    await reg?.update?.();
  } catch { /* offline or no worker: the notice and reload still work */ }
}

function readGuard(win) {
  try { return win.sessionStorage.getItem(GUARD_KEY) || ''; } catch { return ''; }
}
function writeGuard(win, sha) {
  try { win.sessionStorage.setItem(GUARD_KEY, sha); return true; } catch { return false; }
}

function showNotice(win, onReload) {
  const doc = win.document;
  if (!doc || doc.getElementById('pri-update-notice')) return;
  const box = doc.createElement('div');
  box.id = 'pri-update-notice';
  box.setAttribute('role', 'status');
  box.style.cssText = 'position:fixed;left:50%;bottom:16px;transform:translateX(-50%);z-index:2147483000;display:flex;gap:12px;align-items:center;max-width:calc(100vw - 32px);padding:10px 14px;border:1px solid var(--line,currentColor);border-radius:8px;background:var(--paper,Canvas);color:var(--ink,CanvasText);font:14px/1.4 var(--font,system-ui,sans-serif)';
  const text = doc.createElement('span');
  text.textContent = translate('update.available');
  const button = doc.createElement('button');
  button.type = 'button';
  button.className = 'btn btn-primary';
  button.textContent = translate('update.reload');
  button.addEventListener('click', () => { button.disabled = true; onReload(); });
  box.appendChild(text);
  box.appendChild(button);
  doc.body.appendChild(box);
}

/**
 * Start watching. Returns { check, stop } for tests and teardown.
 * `read` and `ownSha` are injectable; by default they are the live manifest and
 * the SHA baked into this bundle.
 */
export function watchFreshBuild(win = window, { read = readReleaseIdentityManifest, ownSha = ownBuildSha(), now = () => Date.now(), immediate = true } = {}) {
  let touched = false;
  let last = 0;
  let busy = false;
  const touch = () => { touched = true; };
  for (const type of TOUCH_EVENTS) win.addEventListener(type, touch, { capture: true, passive: true });

  async function reloadNow(liveSha) {
    // Record the attempt first: if storage refuses, there is no way to prove
    // the reload happened, so the notice is the only safe outcome.
    if (!writeGuard(win, liveSha)) return false;
    await askWorkerToUpdate(win);
    await dropStaleShell(win);
    win.location.reload();
    return true;
  }

  async function check() {
    if (busy || !SHA.test(ownSha || '')) return 'none';
    const t = now();
    if (last && t - last < RECHECK_MS) return 'none';
    last = t;
    busy = true;
    try {
      const live = await read();
      const liveSha = String(live?.releaseSha || '');
      const action = freshnessAction({ ownSha, liveSha, touched, alreadyReloadedFor: readGuard(win) });
      if (action === 'reload' && await reloadNow(liveSha)) return 'reload';
      if (action !== 'none') {
        showNotice(win, () => { void (async () => {
          writeGuard(win, liveSha);
          await askWorkerToUpdate(win);
          await dropStaleShell(win);
          win.location.reload();
        })(); });
        return 'notice';
      }
      return 'none';
    } catch {
      return 'none';
    } finally {
      busy = false;
    }
  }

  const onVisible = () => { if (win.document?.visibilityState === 'visible') void check(); };
  win.document?.addEventListener('visibilitychange', onVisible);
  win.addEventListener('online', onVisible);
  if (immediate) void check();

  return {
    check: () => { last = 0; return check(); },
    stop() {
      for (const type of TOUCH_EVENTS) win.removeEventListener(type, touch, { capture: true });
      win.document?.removeEventListener('visibilitychange', onVisible);
      win.removeEventListener('online', onVisible);
    }
  };
}
