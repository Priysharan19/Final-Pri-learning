// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · what a page that never showed the app was actually doing.
//
// "Timeout 30000ms exceeded waiting for .shell" is the same sentence for five
// different faults: a chunk that did not download, a chunk answered with the
// wrong kind of file, an exception while the entry module evaluated, an app
// that rendered but never got past its boot screen, and a document that is
// still loading. A browser suite that reports only the timeout sends the next
// person to guess, and this one was guessed at for days.
//
// watchBoot(page) listens for the duration of one navigation and, when asked,
// says what it saw — as part of the failure message. It never retries, never
// reloads and never waits longer: a second load would hide the fault it is
// here to name. Paths only; never a body, a header or a query string.
//
// What it can see that the page's own `error` handlers cannot:
//   · requests that FAILED (a module fetch that fails raises no window.onerror)
//   · scripts and stylesheets answered 200 with the wrong content type — the
//     shell handed back for a chunk the server no longer has
//   · which answers came from the service worker
// and from inside the page: how far public/boot-guard.js says the boot got
// (window.__PRI_BOOT__), the worker that controls the page, its state, and the
// build caches on the device (the cache name is the worker's build version).
// ─────────────────────────────────────────────────────────────────────────────

const short = (url) => { try { return new URL(url).pathname.slice(0, 80); } catch { return '?'; } };
const firstLine = (text, n = 160) => String(text ?? '').split('\n')[0].slice(0, n);

const EXPECTED_TYPE = { script: /javascript|ecmascript/i, stylesheet: /text\/css/i };

/** Read by page.evaluate: closure-free. */
async function pageState() {
  const root = document.getElementById('root');
  const boot = window.__PRI_BOOT__ || null;
  const state = {
    url: location.pathname + location.search,
    readyState: document.readyState,
    online: navigator.onLine,
    // How far the boot got. `splash` true with phase "module"/"render" means the
    // bundle ran and React has not committed; phase "document" means the entry
    // module never evaluated; `failed` names the files that did not load.
    splash: !!document.getElementById('bs'),
    bootPhase: boot ? boot.phase : null,
    bootFailed: boot ? boot.failed.slice(0, 12) : null,
    bootErrors: boot ? boot.errors : null,
    bootNotice: document.querySelector('[data-boot-failure]')?.getAttribute('data-boot-failure') || null,
    // Set when THIS load is the one automatic reload after a failed first try.
    bootRetried: boot ? boot.retried : null,
    moduleRan: !!window.__PRI_BUILD_FEATURES__,
    cloudOrigin: typeof window.__PRI_CLOUD_ORIGIN__ === 'string',
    rootChildren: root?.childElementCount ?? null,
    root: (root?.firstElementChild?.outerHTML || '').replace(/\s+/g, ' ').slice(0, 200),
    // The app's own boot screen (profile not yet read) is .auth-wrap with no
    // card in it: rendered, but still deciding who is signed in.
    appBootScreen: !!document.querySelector('.auth-wrap') && !document.querySelector('.auth-card, .hero-title, .signup-flow'),
    crash: [...document.querySelectorAll('.crash-card')].map(el => el.innerText.replace(/\s+/g, ' ').slice(0, 240)),
    alerts: [...document.querySelectorAll('[role="alert"]')].map(el => el.innerText.replace(/\s+/g, ' ').slice(0, 160)),
    text: (document.body?.innerText || '').replace(/\s+/g, ' ').slice(0, 160),
    serviceWorker: null
  };
  try {
    const sw = navigator.serviceWorker;
    if (sw) {
      const regs = await sw.getRegistrations();
      state.serviceWorker = {
        controlled: !!sw.controller,
        controllerState: sw.controller?.state || null,
        registrations: regs.map(r => ({ installing: r.installing?.state || null, waiting: r.waiting?.state || null, active: r.active?.state || null })),
        // The cache name is the build digest the worker was generated with.
        builds: (await caches.keys()).filter(k => k.startsWith('pri-'))
      };
    }
  } catch (err) {
    state.serviceWorker = { unreadable: String(err?.message || err).slice(0, 120) };
  }
  return state;
}

/**
 * Start watching one navigation. Call before page.goto().
 * @returns {{ describe: () => Promise<object>, stop: () => void }}
 */
export function watchBoot(page) {
  const open = new Map();
  const failed = [], refused = [], wrongKind = [], errors = [];
  let fromWorker = 0, responses = 0;

  const onRequest = r => open.set(r, short(r.url()));
  const onFinished = r => open.delete(r);
  const onFailed = r => {
    open.delete(r);
    failed.push(`${r.resourceType()} ${short(r.url())} — ${firstLine(r.failure()?.errorText || 'failed', 80)}`);
  };
  const onResponse = r => {
    responses++;
    const viaWorker = r.fromServiceWorker();
    if (viaWorker) fromWorker++;
    const via = viaWorker ? ' (answered by the service worker)' : '';
    const kind = r.request().resourceType();
    const type = r.headers()['content-type'] || '';
    if (r.status() >= 400) refused.push(`${r.status()} ${short(r.url())}${via}`);
    else if (r.status() === 200 && EXPECTED_TYPE[kind] && !EXPECTED_TYPE[kind].test(type)) {
      wrongKind.push(`${kind} ${short(r.url())} answered as ${type || 'no content-type'}${via}`);
    }
  };
  const onPageError = e => errors.push(`uncaught: ${firstLine(e?.message || e)}`);
  const onConsole = m => { if (m.type() === 'error') errors.push(`console: ${firstLine(m.text())}`); };

  const hooks = [['request', onRequest], ['requestfinished', onFinished], ['requestfailed', onFailed],
    ['response', onResponse], ['pageerror', onPageError], ['console', onConsole]];
  for (const [event, fn] of hooks) page.on(event, fn);
  const stop = () => { for (const [event, fn] of hooks) page.off(event, fn); };

  const describe = async () => {
    const seen = await page.evaluate(pageState).catch(e => ({ unreadable: firstLine(e?.message || e) }));
    seen.failedRequests = failed.slice(-12);
    seen.wrongKind = wrongKind.slice(-12);
    seen.refused = refused.slice(-12);
    seen.unanswered = [...open.values()].slice(0, 12);
    seen.errors = errors.slice(-8);
    seen.responses = `${responses} seen, ${fromWorker} from the service worker`;
    return seen;
  };

  return { describe, stop };
}

/**
 * A boot that only succeeded because public/boot-guard.js reloaded the page
 * once is a pass that must not look like an ordinary one. Returns a sentence
 * for the suite's notes (or null): what failed on the first try, as the page
 * recorded it and as this watcher saw it.
 */
export async function bootRecovery(watch, page, what) {
  const retried = await page.evaluate(() => window.__PRI_BOOT__?.retried || null).catch(() => null);
  if (!retried) return null;
  const seen = await watch.describe();
  return `BOOT RECOVERED BY ONE AUTOMATIC RELOAD · ${what} · first try failed to load ${JSON.stringify(retried.failed)} · failed requests ${JSON.stringify(seen.failedRequests)} · wrong kind ${JSON.stringify(seen.wrongKind)} · service worker ${JSON.stringify(seen.serviceWorker)}`;
}

/**
 * Turn a boot timeout into a message that names the fault. Throws; never
 * swallows, never retries.
 */
export async function bootFailure(err, watch, what) {
  const seen = await watch.describe();
  watch.stop();
  return new Error(`${firstLine(err?.message || err, 200)} · ${what} · ${JSON.stringify(seen)}`);
}
