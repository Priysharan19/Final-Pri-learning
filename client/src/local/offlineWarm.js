// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · finishing the offline build after the app is on screen
//
// The service worker's install now writes only what the first paint blocks on.
// Everything else a student needs with the network off — the pages, the
// question registry, the chapter sections, the remaining styles — is written by
// a second pass, and this module is what asks for it.
//
// It is asked for late on purpose. The old install wrote all 3.7 MB while the
// browser was still fetching the files the profile screen was waiting on, and
// on a 700 kbps line the two fought each other for half a minute. Waiting until
// the page is rendered and the main thread is idle costs the student nothing
// they can see and finishes the offline build seconds later.
//
// WHAT IS NOT ASKED FOR BY DEFAULT. The handwriting recogniser is 0.9 MB, and a
// budget Android phone with no stylus may never open the write tab. It is
// warmed only where those bytes are honestly cheap:
//
//   · a shell that says it is the native app, where every asset is read off the
//     app bundle and the "download" is a local file read. Today that shell does
//     not register a service worker at all — main.jsx skips it — so this branch
//     never runs there; it is written down so that a native shell which does
//     register one is never told a local file read is expensive;
//   · a browser that reports an unmetered 4G link.
//
// Everywhere else it arrives the first time the student actually opens the
// write tab, and QuestionCard says so in as many words if they are offline when
// they do. The rule is deliberately conservative: Data Saver on, or anything
// the browser calls 2G or 3G, means no.
// ─────────────────────────────────────────────────────────────────────────────

/** Wait for the browser to be idle, or a short beat where it has no such idea. */
function whenIdle(run) {
  if (typeof requestIdleCallback === 'function') requestIdleCallback(run, { timeout: 4000 });
  else setTimeout(run, 1200);
}

/**
 * Are the recogniser's 0.9 MB cheap on this device right now?
 *
 * Safari reports no connection information at all, so an iPad on the web
 * answers false and picks the recogniser up on first use. That is the right way
 * round: guessing "probably wifi" and being wrong costs a student on a shared
 * data pack real money.
 */
export function optionalWarmAllowed(scope = typeof window === 'undefined' ? {} : window) {
  if (scope.__PRI_NATIVE__) return true;
  const link = scope.navigator?.connection;
  if (!link || link.saveData) return false;
  return link.effectiveType === '4g';
}

/**
 * Ask the active service worker to finish the offline build.
 *
 * Resolves with what the worker reports it holds, or null when there is no
 * worker to ask — a development server, a browser with service workers turned
 * off, or the very first load before one has taken control. None of those are
 * errors: the runtime cache still keeps whatever the student actually opens.
 */
export function warmOfflineBuild({ scope = window, timeoutMs = 120000 } = {}) {
  const worker = scope.navigator?.serviceWorker?.controller;
  if (!worker) return Promise.resolve(null);
  const optional = optionalWarmAllowed(scope);
  return new Promise((resolve) => {
    let done = false;
    const finish = (value) => { if (!done) { done = true; resolve(value); } };
    // A MessageChannel keeps this answer to this question. Warming can take a
    // while on a slow link and the page must never sit waiting on it, so the
    // timeout resolves rather than rejects: nothing downstream depends on it.
    try {
      const channel = new MessageChannel();
      channel.port1.onmessage = (e) => finish(e.data || null);
      worker.postMessage({ type: 'pri-warm', optional }, [channel.port2]);
      setTimeout(() => finish(null), timeoutMs);
    } catch {
      finish(null);
    }
  });
}

/** Fire-and-forget: called once at boot, after the first screen is painted. */
export function scheduleOfflineWarm(scope = window) {
  if (!scope.navigator?.serviceWorker) return;
  const ask = () => { void warmOfflineBuild({ scope }); };
  // The controller arrives asynchronously on a first visit; `ready` is the
  // event that says one exists, and `controllerchange` the one that says this
  // page now has it. Either is a fine moment to ask.
  scope.navigator.serviceWorker.ready.then(() => whenIdle(ask), () => { });
  scope.navigator.serviceWorker.addEventListener('controllerchange', () => whenIdle(ask), { once: true });
}
