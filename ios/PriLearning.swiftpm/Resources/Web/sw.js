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
const VERSION = 'pri-0814b8fca31c';
const PRECACHE = ["/","/assets/InkAnswer-2KC0KtpL.js","/assets/InkAnswer-CXzz1HJH.js","/assets/InkAnswer-DdqLXnTM.js","/assets/InkAnswer-bdP4JV5b.js","/assets/KaTeX_AMS-Regular-BQhdFMY1.woff2","/assets/KaTeX_Caligraphic-Bold-Dq_IR9rO.woff2","/assets/KaTeX_Caligraphic-Regular-Di6jR-x-.woff2","/assets/KaTeX_Fraktur-Bold-CL6g_b3V.woff2","/assets/KaTeX_Fraktur-Regular-CTYiF6lA.woff2","/assets/KaTeX_Main-Bold-Cx986IdX.woff2","/assets/KaTeX_Main-BoldItalic-DxDJ3AOS.woff2","/assets/KaTeX_Main-Italic-NWA7e6Wa.woff2","/assets/KaTeX_Main-Regular-B22Nviop.woff2","/assets/KaTeX_Math-BoldItalic-CZnvNsCZ.woff2","/assets/KaTeX_Math-Italic-t53AETM-.woff2","/assets/KaTeX_SansSerif-Bold-D1sUS0GD.woff2","/assets/KaTeX_SansSerif-Italic-C3H0VqGB.woff2","/assets/KaTeX_SansSerif-Regular-DDBCnlJ7.woff2","/assets/KaTeX_Script-Regular-D3wIWfF6.woff2","/assets/KaTeX_Size1-Regular-mCD8mA8B.woff2","/assets/KaTeX_Size2-Regular-Dy4dx90m.woff2","/assets/KaTeX_Size4-Regular-Dl5lxZxV.woff2","/assets/KaTeX_Typewriter-Regular-CO6r4hn1.woff2","/assets/NativeInkCanvas-Lp3ipOt6.js","/assets/demoSeed-WMjQcDS1.js","/assets/figures-mq_lXv1l.js","/assets/index-DCzcUNOP.js","/assets/index-DxiIxy5G.css","/assets/ink-engine-CLn0gnM7.js","/assets/ink-model-CyGLEx0q.js","/assets/ink-personal-n-OeLcRg.js","/assets/inter-cyrillic-ext-wght-normal-BOeWTOD4.woff2","/assets/inter-cyrillic-wght-normal-DqGufNeO.woff2","/assets/inter-greek-ext-wght-normal-DlzME5K_.woff2","/assets/inter-greek-wght-normal-CkhJZR-_.woff2","/assets/inter-latin-ext-wght-normal-DO1Apj_S.woff2","/assets/inter-latin-wght-normal-Dx4kXJAl.woff2","/assets/inter-vietnamese-wght-normal-CBcvBZtf.woff2","/assets/multipart-B2hqfwnp.js","/assets/streams-ext-DAF3mhTG.js","/assets/streams-standard-KbGRHXoW.js","/assets/vendor-katex-BYZTj3zW.css","/assets/vendor-katex-BhPo-4pa.js","/assets/vendor-react-DQwvFvLD.js","/assets/vite-preload-CLcXU_4U.js","/assets/year10-vlSPOrSA.js","/assets/year11-Bow-DY8e.js","/assets/year12-Cebo92FN.js","/assets/year7-ChwrLIkD.js","/assets/year8-DWZ3Aei8.js","/assets/year9-B7saeATL.js","/favicon.svg","/icons/icon-180.png","/icons/icon-192.png","/icons/icon-512.png","/index.html","/manifest.webmanifest"];
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
