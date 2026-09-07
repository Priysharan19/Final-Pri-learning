// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · service worker — the app runs with the network switched off.
// The build is written into a cache named after it, so a first run followed by
// a flight still has a working app. The name is a digest of that build, so a
// redeploy lands in a cache of its own and takes effect on the next navigation
// instead of leaving a stale shell that names chunks which are no longer on the
// server.
//
// It arrives in two passes, because on a 700 kbps line one pass is a hazard.
// Install used to write the whole 3.7 MB build, and it did so while the browser
// was still fetching the very files the first paint was blocked on — the phone
// downloaded everything twice over a link that could not carry it once, and the
// profile screen took half a minute to appear. So:
//
//   install   writes only what the shell needs to render — the files
//             index.html actually references, the icons and the two faces the
//             first screens paint in. Seconds, not half a minute.
//   warm      writes the rest of the offline build when the app asks, which it
//             does once it is on screen and the main thread is idle. Nothing a
//             student is waiting for is behind it.
//
// Fetches use the default HTTP cache rather than forcing a revalidation. Every
// name in both lists carries a content hash except the shell, so the name IS
// the identity and a cache hit cannot be stale — while forcing a reload meant
// re-downloading the entry, React, KaTeX and the app chunk that the page had
// just finished fetching. The shell alone is fetched with `reload`, since
// /index.html keeps its name across builds and a stale one names dead chunks.
//
// The build before this one is kept rather than dropped. A page that was open
// across the redeploy is now driven by this worker but still asks for its own
// chunk filenames, and those are answered from the cache it started on. Only
// builds older than that are deleted, which holds the device to two.
// ─────────────────────────────────────────────────────────────────────────────

// ── Build manifest, filled in by the pri-precache plugin ─────────────────────
const VERSION = 'pri-9f7bda897672';
const PRECACHE = ["/","/assets/App-BWHqTDJ5.js","/assets/KaTeX_AMS-Regular-BQhdFMY1.woff2","/assets/KaTeX_Main-Bold-Cx986IdX.woff2","/assets/KaTeX_Main-BoldItalic-DxDJ3AOS.woff2","/assets/KaTeX_Main-Italic-NWA7e6Wa.woff2","/assets/KaTeX_Main-Regular-B22Nviop.woff2","/assets/KaTeX_Math-BoldItalic-CZnvNsCZ.woff2","/assets/KaTeX_Math-Italic-t53AETM-.woff2","/assets/KaTeX_Size1-Regular-mCD8mA8B.woff2","/assets/KaTeX_Size2-Regular-Dy4dx90m.woff2","/assets/KaTeX_Size4-Regular-Dl5lxZxV.woff2","/assets/class7-part2-2026-27-production-max_UemZ.js","/assets/class8-chapters-3-13-production-CJqsY6V1.js","/assets/class8-linear-production-BM4WLA4-.js","/assets/class8-rational-production-CAP_H0zO.js","/assets/class9-chapters-production-rsgfMoAh.js","/assets/defineProperty-BbfpZ9Tg.js","/assets/generators-CDfLk5qK.js","/assets/index-BcWE8-vO.css","/assets/index-E3AqEUeL.js","/assets/inter-latin-wght-normal-Dx4kXJAl.woff2","/assets/preload-helper-Czpn1I53.js","/assets/pyqCoverage-7Wk9tN87.js","/assets/qhelpers-Dq1uC5IS.js","/assets/rolldown-runtime-CbXtAM7H.js","/assets/vendor-react-Dlayjq1H.js","/favicon.svg","/icons/icon-180.png","/index.html","/manifest.webmanifest"];
const WARM = ["/assets/AssignmentInboxPanel-BZwCTsDe.js","/assets/Charts-klH-9Wyv.js","/assets/Classes-BwwNHdAM.js","/assets/ClassroomPanel-NzXPAdHE.js","/assets/ExamRoom-DAnc_o7Q.js","/assets/Exams-B9RJNlhO.js","/assets/Favorites-D4oxdjo8.js","/assets/History-CaiF_-RB.js","/assets/InkCanvas-B15GLehu.js","/assets/LinearEquationsTopperSectionProduction-m7B_ck9Y.js","/assets/Match-BqF94u3C.js","/assets/NcertClass8ChapterSection-D3v7NUTR.js","/assets/NcertClass9ChapterSection-DofWQT4l.js","/assets/PracticeBase-BIEeaI0_.js","/assets/PracticeBase-LbQyqki1.css","/assets/Progress-0v2UPDPC.js","/assets/RationalNumbersTopperSectionProduction-ClYTUPKC.js","/assets/Rush-Dogc61Zl.js","/assets/Settings-Bgyl-8WJ.js","/assets/Tasks-olVZfKBF.js","/assets/Teach-DfBh5Zs9.js","/assets/assignmentTarget-BzbNuGAu.js","/assets/cloudReader-urw-1GZg.js","/assets/demoSeed-BvSi6ZJ4.js","/assets/figures--_2Ot-DF.js","/assets/files-BjlwdoHp.js","/assets/latex-CqAS5Udr.js","/assets/legalHindi-BPEfIF5A.js","/assets/multipart-DEZWYKq6.js","/assets/ncertTerms-Ds6pWWUR.js","/assets/personal-BuYYHsz8.js","/assets/strings.hi-DukdfAYJ.js","/assets/vendor-katex-BkSWQkk7.js","/assets/vendor-katex-DEcVZfaU.css","/icons/icon-192.png","/icons/icon-512.png"];
const OPTIONAL = ["/assets/InkAnswer-BKG102Hi.js","/assets/InkAnswer-BpG1InPh.js","/assets/InkAnswer-Brs25nh8.js","/assets/InkAnswer-Dpdj0fUC.js","/assets/InkAnswer-FGPiL4zm.js","/assets/NativeInkCanvas-DucZdBRQ.js","/assets/feedbackGeometry-Ca8ev77D.js","/assets/ink-engine-CfpPOKz1.js","/assets/ink-model-D3cN_hBH.js","/assets/ink-personal-BudlgchY.js","/assets/model-data-DsXS_xxz.js","/assets/recognizer-DVtGBfxV.js"];
// ─────────────────────────────────────────────────────────────────────────────

const SHELL = '/index.html';
const STAMP = '/__pri-built';
const KEEP = 2;
const CACHEABLE = /^\/assets\/|\.(?:js|css|html|svg|png|webmanifest|woff2?|ttf)$/;

// ── Install ──────────────────────────────────────────────────────────────────

// A hashed filename is its own identity, so the HTTP cache cannot answer with
// the wrong bytes; the shell is the one name that outlives its contents.
const hashed = (url) => url !== '/' && url !== SHELL;

async function fill(cache, urls) {
  const missed = [];
  await Promise.all(urls.map(async (url) => {
    try {
      const res = await fetch(new Request(url, { cache: hashed(url) ? 'default' : 'reload', credentials: 'same-origin' }));
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

// ── Warm ─────────────────────────────────────────────────────────────────────
// The second pass. The app asks for it once it is rendered and idle; asking
// twice costs one cache lookup per file and no network, so a reload mid-warm is
// harmless. `warmed` is reported back so a caller — the browser suite included
// — can tell "the offline build is complete" from "it is still arriving".
//
// OPTIONAL is the handwriting recogniser: 0.9 MB that a phone with no stylus
// may never open. It is included only when the page asks for it, because
// whether those bytes are cheap or expensive depends on facts — Data Saver, the
// browser's own view of the link, whether this is the native shell reading off
// an app bundle — that live on the page and not in here. offlineWarm.js decides
// and says so in the message; this only obeys.

let warming = null;

async function warm(withOptional) {
  const wanted = withOptional ? [...WARM, ...OPTIONAL] : WARM;
  const cache = await caches.open(VERSION);
  const already = new Set((await cache.keys()).map(r => new URL(r.url).pathname));
  const missing = wanted.filter(url => !already.has(url));
  if (missing.length) {
    const missed = await fill(cache, missing);
    if (missed.length) await fill(cache, missed);
  }
  const held = new Set((await cache.keys()).map(r => new URL(r.url).pathname));
  return { warmed: wanted.filter(url => held.has(url)).length, of: wanted.length };
}

self.addEventListener('message', (e) => {
  if (e.data?.type !== 'pri-warm') return;
  const optional = Boolean(e.data.optional);
  // One pass at a time. A second ask while one is in flight joins it rather
  // than doubling the requests on a link that has none to spare.
  warming = warming || warm(optional).finally(() => { warming = null; });
  const reply = warming.then(
    result => ({ type: 'pri-warmed', ...result }),
    () => ({ type: 'pri-warmed', warmed: 0, of: WARM.length })
  );
  // A port when the caller wants an answer, the client itself when it does not.
  const port = e.ports?.[0];
  e.waitUntil(reply.then(msg => { if (port) port.postMessage(msg); else e.source?.postMessage(msg); }));
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
