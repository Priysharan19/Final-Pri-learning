// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · service worker — the app runs with the network switched off.
// Install writes the whole build into a cache named after it: the shell, every
// code chunk down to the handwriting model, styles, fonts and icons, so a first
// run followed by a flight still has a working write tab. The name is a digest
// of that build, so a redeploy lands in a cache of its own and takes effect on
// the next navigation instead of leaving a stale shell that names chunks which
// are no longer on the server.
//
// The build before this one is kept rather than dropped. A page that was open
// across the redeploy is now driven by this worker but still asks for its own
// chunk filenames, and those are answered from the cache it started on. Only
// builds older than that are deleted, which holds the device to two.
// ─────────────────────────────────────────────────────────────────────────────

// ── Build manifest, filled in by the pri-precache plugin ─────────────────────
const VERSION = 'pri-bb37576e12eb';
const PRECACHE = ["/","/assets/InkAnswer-B4kWWvn0.js","/assets/InkAnswer-BmUeaP7n.js","/assets/InkAnswer-BxIt3GUD.js","/assets/InkAnswer-CVxbw-ZB.js","/assets/KaTeX_AMS-Regular-BQhdFMY1.woff2","/assets/KaTeX_Caligraphic-Bold-Dq_IR9rO.woff2","/assets/KaTeX_Caligraphic-Regular-Di6jR-x-.woff2","/assets/KaTeX_Fraktur-Bold-CL6g_b3V.woff2","/assets/KaTeX_Fraktur-Regular-CTYiF6lA.woff2","/assets/KaTeX_Main-Bold-Cx986IdX.woff2","/assets/KaTeX_Main-BoldItalic-DxDJ3AOS.woff2","/assets/KaTeX_Main-Italic-NWA7e6Wa.woff2","/assets/KaTeX_Main-Regular-B22Nviop.woff2","/assets/KaTeX_Math-BoldItalic-CZnvNsCZ.woff2","/assets/KaTeX_Math-Italic-t53AETM-.woff2","/assets/KaTeX_SansSerif-Bold-D1sUS0GD.woff2","/assets/KaTeX_SansSerif-Italic-C3H0VqGB.woff2","/assets/KaTeX_SansSerif-Regular-DDBCnlJ7.woff2","/assets/KaTeX_Script-Regular-D3wIWfF6.woff2","/assets/KaTeX_Size1-Regular-mCD8mA8B.woff2","/assets/KaTeX_Size2-Regular-Dy4dx90m.woff2","/assets/KaTeX_Size4-Regular-Dl5lxZxV.woff2","/assets/KaTeX_Typewriter-Regular-CO6r4hn1.woff2","/assets/NativeInkCanvas-B-QcBzt5.js","/assets/adaptive-D50qVmsk.js","/assets/demoSeed-CI8OZOvk.js","/assets/feedbackGeometry-DKypf3Ee.js","/assets/figures--_2Ot-DF.js","/assets/index-CLHJMZG8.css","/assets/index-D3M38pkm.js","/assets/india-algebra-D749UDPM.js","/assets/india-calculus-Bf1NSBl9.js","/assets/india-class10-Dw7u8EZ5.js","/assets/india-coordinate-B3WtjUst.js","/assets/india-foundation-_eSFF5BE.js","/assets/india-junior--IyLmVey.js","/assets/india-olympiad-D49dlyYM.js","/assets/india-senior-CCGFsGIE.js","/assets/ink-engine-DpC-mqxw.js","/assets/ink-model-DxZOPWsc.js","/assets/inter-cyrillic-ext-wght-normal-BOeWTOD4.woff2","/assets/inter-cyrillic-wght-normal-DqGufNeO.woff2","/assets/inter-greek-ext-wght-normal-DlzME5K_.woff2","/assets/inter-greek-wght-normal-CkhJZR-_.woff2","/assets/inter-latin-ext-wght-normal-DO1Apj_S.woff2","/assets/inter-latin-wght-normal-Dx4kXJAl.woff2","/assets/inter-vietnamese-wght-normal-CBcvBZtf.woff2","/assets/model-data-C7waaejE.js","/assets/multipart-DEZWYKq6.js","/assets/qhelpers-Dq1uC5IS.js","/assets/recognizer-Kgm7h79R.js","/assets/rolldown-runtime-CbXtAM7H.js","/assets/streams-ext-BX6vFLJW.js","/assets/streams-standard-EAeJMBB_.js","/assets/vendor-katex-BkSWQkk7.js","/assets/vendor-katex-DEcVZfaU.css","/assets/vendor-react-2OOGS8Cs.js","/assets/year10-ySGvk5Sp.js","/assets/year11-CAUuv3q-.js","/assets/year12-0orhQEbL.js","/assets/year7-CQz82Lgf.js","/assets/year8-C5iPbJFu.js","/assets/year9-DEk_XSq1.js","/favicon.svg","/icons/icon-180.png","/icons/icon-192.png","/icons/icon-512.png","/index.html","/manifest.webmanifest"];
// ─────────────────────────────────────────────────────────────────────────────

const SHELL = '/index.html';
const STAMP = '/__pri-built';
const KEEP = 2;
const CACHEABLE = /^\/assets\/|\.(?:js|css|html|svg|png|webmanifest|woff2?|ttf)$/;

// ── Install ──────────────────────────────────────────────────────────────────

async function fill(cache, urls) {
  const missed = [];
  await Promise.all(urls.map(async (url) => {
    try {
      const res = await fetch(new Request(url, { cache: 'reload', credentials: 'same-origin' }));
      if (!res.ok) throw new Error(String(res.status));
      await cache.put(url, res);
    } catch {
      missed.push(url);
    }
  }));
  return missed;
}

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const cache = await caches.open(VERSION);
    // One retry, then let the fetch handler top up whatever still missed rather
    // than failing the install and leaving the device with no cache at all.
    const missed = await fill(cache, PRECACHE);
    if (missed.length) await fill(cache, missed);
    await cache.put(STAMP, new Response(String(Date.now())));
    await self.skipWaiting();
  })());
});

// ── Activate ─────────────────────────────────────────────────────────────────

async function stampOf(name) {
  const res = await (await caches.open(name)).match(STAMP);
  return res ? Number(await res.text()) || 0 : 0;
}

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const others = (await caches.keys()).filter(k => k !== VERSION && k.startsWith('pri-'));
    const dated = await Promise.all(others.map(async k => [k, await stampOf(k)]));
    dated.sort((a, b) => b[1] - a[1]);
    await Promise.all(dated.slice(KEEP - 1).map(([k]) => caches.delete(k)));
    await self.clients.claim();
  })());
});

// ── Fetch ────────────────────────────────────────────────────────────────────

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  e.respondWith(req.mode === 'navigate' ? shellFor(req) : assetFor(req, url));
});

// Every in-app route renders from the one shell, and it has to be this build's
// shell — an older one would name chunks this cache no longer holds.
async function shellFor(req) {
  const cache = await caches.open(VERSION);
  const shell = (await cache.match(SHELL)) || (await cache.match('/'));
  if (shell) return shell;
  try {
    const res = await fetch(req);
    if (res.ok) await cache.put(SHELL, res.clone());
    return res;
  } catch {
    return Response.error();
  }
}

// Filenames carry a content hash, so a hit in the retained previous build is
// the same bytes under the same name — that is what keeps a session that was
// open across a redeploy able to reach the chunks it has not loaded yet.
async function assetFor(req, url) {
  const hit = await caches.match(req);
  if (hit) return hit;
  try {
    const res = await fetch(req);
    if (res.ok && res.type === 'basic' && CACHEABLE.test(url.pathname)) {
      await (await caches.open(VERSION)).put(req, res.clone());
    }
    return res;
  } catch {
    return Response.error();
  }
}
