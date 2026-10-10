// Says so when the app cannot start, instead of leaving the splash up for ever.
//
// The splash in index.html is static markup: it is on screen before a single
// byte of the app has run, and only the app's first render takes it down. So
// anything that stops that render — a chunk that did not download, a chunk that
// arrived as something other than a script, an exception while the entry module
// was evaluating — used to leave a student looking at a logo with no words and
// no way out. None of those raise window.onerror for a failed module fetch, so
// nothing else in the app could notice either.
//
// This file is the one piece that does not depend on the bundle. It is a plain
// script served from this origin (the Content-Security-Policy allows no inline
// script), it runs from <head> before the module is requested, and it only
// ever does three things:
//
//   · records what happened to the boot in window.__PRI_BOOT__ — which phase
//     was reached and which files failed to load — for support and the suites;
//   · replaces the silent splash with a short, accurate message and a reload
//     button when the entry module fails to load, or when the page has finished
//     loading and the app still has not rendered;
//   · says the load is slow when it has been a long time, without pretending
//     that slow is broken.
//
// It never hides the splash on a timer and never guesses that the app is fine.
// When the app does render, React replaces the contents of #root and whatever
// this file drew goes with it.
//
// ONE AUTOMATIC RELOAD. The fault this was written for is transient: a browser
// that stops the service worker while a navigation's requests are in flight
// answers those requests with a network error, the entry module is one of
// them, and the very next load is fine. So the first time the entry module
// fails to load, the page is reloaded once, by itself, and says nothing. If
// the reload fails as well — or one already happened in the last minute — the
// notice is shown and the student decides. The reload is recorded
// (window.__PRI_BOOT__.retried on the load that follows) so that support and
// the browser suites can see that it was needed; it is never silent to them.
//
// WHEN THIS FILE DOES NOT ARRIVE. See the note where it marks <html>: the shell
// has a fallback that needs no script.
//
// The words are copies of catalogue entries (boot.* and errorScreen.reload in
// src/i18n/strings.en.js and strings.hi.js): the catalogue lives in the bundle
// this file exists to outlive, so it cannot be read from here. The boot suite
// (client/test/boot-resilience-check.mjs) fails if a copy drifts.
(function () {
  var win = window, doc = document;
  // This file is itself a request, and the fault it was written for — the
  // service worker stopped while a navigation's requests are in flight — can
  // take it down with the rest. index.html therefore carries a script-free
  // fallback (#bs-late: a sentence and a link, revealed by CSS after twelve
  // seconds). Saying "the guard is here" switches that fallback off, because
  // from here on this file can say something more exact, in one language.
  doc.documentElement.setAttribute('data-boot-guard', '');
  var boot = win.__PRI_BOOT__ = { phase: 'document', failed: [], errors: 0, notice: null, retried: null };

  // The automatic reload is remembered for this tab only, and only briefly:
  // long enough that a load which keeps failing reloads once and then stops.
  var RETRY_KEY = 'pri-boot-retry', RETRY_WINDOW_MS = 60000;
  var retryAllowed = false;
  try {
    var last = JSON.parse(win.sessionStorage.getItem(RETRY_KEY) || 'null');
    if (last && Date.now() - last.at < RETRY_WINDOW_MS) boot.retried = { failed: last.failed || [] };
    else retryAllowed = true;
  } catch (e) { /* no session storage: no automatic reload, the notice instead */ }

  function reloadOnce() {
    if (!retryAllowed) return false;
    retryAllowed = false;
    try { win.sessionStorage.setItem(RETRY_KEY, JSON.stringify({ at: Date.now(), failed: boot.failed.slice(0, 12) })); }
    catch (e) { return false; }
    boot.phase = 'reloading';
    win.location.reload();
    return true;
  }

  // After the page has finished loading, the first render is at most the boot
  // probe's bound away (main.jsx). Well past that with the splash still up
  // means the app is not going to start by itself.
  var AFTER_LOAD_MS = 6000;
  // A page that has not even finished loading by now is on a very slow or a
  // stalled connection. That is said as what it is — slow — not as a failure.
  var SLOW_MS = 45000;

  var COPY = {
    en: {
      load: ['Pri Learning could not load', 'Part of the app did not download. Check your connection, then reload.'],
      start: ['Pri Learning did not start', 'The app loaded but did not open. Reloading keeps every profile and everything saved on this device.'],
      slow: ['Still loading Pri Learning', 'This is taking longer than it should. You can keep waiting, or reload.'],
      reload: 'Reload Pri Learning'
    },
    hi: {
      load: ['Pri Learning लोड नहीं हो सका', 'ऐप का एक हिस्सा डाउनलोड नहीं हुआ। अपना कनेक्शन जाँचें, फिर दोबारा लोड करें।'],
      start: ['Pri Learning शुरू नहीं हुआ', 'ऐप लोड हो गया, लेकिन खुला नहीं। दोबारा लोड करने पर हर प्रोफ़ाइल और इस डिवाइस पर सहेजा हुआ सब कुछ सुरक्षित रहता है।'],
      slow: ['Pri Learning अभी लोड हो रहा है', 'इसमें जितना लगना चाहिए उससे ज़्यादा समय लग रहा है। आप इंतज़ार कर सकते हैं, या दोबारा लोड कर सकते हैं।'],
      reload: 'Pri Learning फिर से लोड करें'
    }
  };

  // The language chosen on the sign-in screen is the only one readable before
  // the app runs (a profile's own language is in its database record).
  function language() {
    try { return localStorage.getItem('pri-signin-language') === 'hi' ? 'hi' : 'en'; } catch (e) { return 'en'; }
  }

  function splash() { return doc.getElementById('bs'); }
  // The app's first render replaces everything inside #root, splash included.
  function mounted() { return !splash(); }

  function pathOf(url) {
    try { return new URL(url, win.location.href).pathname; } catch (e) { return ''; }
  }

  // Before reloading after a failed download: drop any copy of the files that
  // failed from this origin's caches, so the reload asks the network for them
  // rather than being handed the same unusable copy again. Only the named
  // files are touched; the rest of the offline build stays.
  function forgetFailed() {
    if (!boot.failed.length || !win.caches) return Promise.resolve();
    return win.caches.keys().then(function (names) {
      return Promise.all(names.filter(function (n) { return n.indexOf('pri-') === 0; }).map(function (n) {
        return win.caches.open(n).then(function (cache) {
          return Promise.all(boot.failed.map(function (p) { return cache.delete(p); }));
        });
      }));
    }).catch(function () { });
  }

  function show(kind) {
    var host = splash();
    if (!host) return;
    var lang = language(), copy = COPY[lang], words = copy[kind];
    var box = doc.getElementById('bs-notice');
    if (!box) {
      host.style.gridAutoFlow = 'row';
      host.style.alignContent = 'center';
      host.style.justifyItems = 'center';
      host.style.gap = '20px';
      host.style.padding = '24px';
      box = doc.createElement('div');
      box.id = 'bs-notice';
      box.setAttribute('role', 'alert');
      box.style.cssText = 'max-width:34em;text-align:center;color:var(--ink,CanvasText);font:15px/1.5 var(--font,system-ui,sans-serif)';
      var title = doc.createElement('p');
      title.style.cssText = 'margin:0 0 6px;font-weight:600;font-size:17px';
      var body = doc.createElement('p');
      body.style.cssText = 'margin:0 0 18px;color:var(--ink-2,CanvasText)';
      var button = doc.createElement('button');
      button.type = 'button';
      button.className = 'btn btn-primary';
      button.addEventListener('click', function () {
        button.disabled = true;
        forgetFailed().then(function () { win.location.reload(); });
      });
      box.appendChild(title); box.appendChild(body); box.appendChild(button);
      host.appendChild(box);
    }
    box.setAttribute('lang', lang);
    box.setAttribute('data-boot-failure', kind);
    box.children[0].textContent = words[0];
    box.children[1].textContent = words[1];
    box.children[2].textContent = copy.reload;
    boot.notice = kind;
  }

  // A script or stylesheet that fails to load raises `error` on its own
  // element and nowhere else; it does not bubble, so it is caught on the way
  // down. A module script raises it when any file in its import graph could
  // not be fetched or was not a script — which is the whole app not starting.
  win.addEventListener('error', function (e) {
    var t = e.target;
    if (!t || t === win || !t.tagName) { if (!mounted()) boot.errors++; return; }
    var tag = t.tagName, url = tag === 'SCRIPT' ? t.src : tag === 'LINK' ? t.href : '';
    if (!url || (tag === 'LINK' && !/modulepreload|stylesheet/.test(t.rel || ''))) return;
    var path = pathOf(url);
    if (path && boot.failed.indexOf(path) < 0 && boot.failed.length < 24) boot.failed.push(path);
    if (tag === 'SCRIPT' && t.type === 'module' && !mounted() && boot.phase !== 'reloading') {
      if (reloadOnce()) return;
      boot.phase = 'load-failed';
      show('load');
    }
  }, true);

  win.addEventListener('load', function () {
    setTimeout(function () {
      if (mounted() || boot.notice === 'load' || boot.phase === 'reloading') return;
      show(boot.failed.length ? 'load' : 'start');
    }, AFTER_LOAD_MS);
  });

  setTimeout(function () {
    if (!mounted() && !boot.notice && boot.phase !== 'reloading') show('slow');
  }, SLOW_MS);
})();
