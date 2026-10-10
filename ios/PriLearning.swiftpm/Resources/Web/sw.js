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
const VERSION = 'pri-29829a0b3811';
const PRECACHE = ["/","/assets/App-CxV3GnPw.js","/assets/KaTeX_AMS-Regular-BQhdFMY1.woff2","/assets/KaTeX_Main-Bold-Cx986IdX.woff2","/assets/KaTeX_Main-BoldItalic-DxDJ3AOS.woff2","/assets/KaTeX_Main-Italic-NWA7e6Wa.woff2","/assets/KaTeX_Main-Regular-B22Nviop.woff2","/assets/KaTeX_Math-BoldItalic-CZnvNsCZ.woff2","/assets/KaTeX_Math-Italic-t53AETM-.woff2","/assets/KaTeX_Size1-Regular-mCD8mA8B.woff2","/assets/KaTeX_Size2-Regular-Dy4dx90m.woff2","/assets/KaTeX_Size4-Regular-Dl5lxZxV.woff2","/assets/backend-D8cMrpaE.js","/assets/cloudAccount-Cz72ku5y.js","/assets/cloudErrorCopy-B8ogfnw1.js","/assets/cloudSession-CnTBrYKl.js","/assets/cloudSyncRestore-DXjaGW8K.js","/assets/cloudTransport-B3YGHM4v.js","/assets/curriculum-in-Bh2Dn16G.js","/assets/defineProperty-BbfpZ9Tg.js","/assets/diagnose-BrvrPQmn.js","/assets/expr-BAyLlB_l.js","/assets/formFactor-CvnDoCvZ.js","/assets/generators-Bkemxq7a.js","/assets/i18n-DWdLnAeN.js","/assets/idb-CNrzlctl.js","/assets/index-Bpvrfh9-.js","/assets/index-Y2rCuy1j.css","/assets/indiaProduct-BVftTEgi.js","/assets/inputHint-BaQGaT5a.js","/assets/inter-latin-wght-normal-Dx4kXJAl.woff2","/assets/languages-CVi7imSC.js","/assets/native-BgLmmOa8.js","/assets/ncert-syllabus-CKacrE7J.js","/assets/practiceLinks-C92U7OG6.js","/assets/preload-helper-BZ1Pz5am.js","/assets/pyqCoverage-DAjph3AM.js","/assets/qhelpers-Dq1uC5IS.js","/assets/reason-area-vKC4I3-I.js","/assets/releaseIdentity-J0Uj19H1.js","/assets/rolldown-runtime-CbXtAM7H.js","/assets/store-aGxDTp25.js","/assets/vendor-react-Dtm3F6TO.js","/boot-guard.js","/favicon.svg","/icons/icon-180.png","/index.html","/manifest.webmanifest","/splash.svg","/theme-boot.js"];
const WARM = ["/assets/AccountDeleteRequest-CpSkmEDM.js","/assets/AssignmentInboxPanel-Bl8lBW3Z.js","/assets/Charts-CfUL0ki0.js","/assets/CheckRefusal-CPPsBZ6l.js","/assets/Classes-BjxZWgj9.js","/assets/ClassroomPanel-DwoB2699.js","/assets/CloudAccountPanel-DVboVJEC.js","/assets/CloudAccountPanel-Dku7bH7d.js","/assets/ExamRoom-C_SKMHEz.js","/assets/Exams-BmXZH_6p.js","/assets/GuardianConsent-BMb5-vXK.js","/assets/History-oVkjVYi3.js","/assets/Legal-CJAvmxGC.js","/assets/LinearEquationsTopperSectionProduction-B96vXtzw.js","/assets/Match-TAZLKVa0.js","/assets/NcertClass8ChapterSection-B3F5v5n6.js","/assets/NcertClass9ChapterSection-QgTByLom.js","/assets/OtpInput-C5M8DEd6.js","/assets/PlanCard-kCMJ5L3G.js","/assets/PlanPage-CFE8j7Z1.js","/assets/PracticeBase-12r9qhCW.css","/assets/PracticeBase-DyJPNY0V.js","/assets/Progress-DaRhld8-.js","/assets/QuestionCard-C-mUo43x.css","/assets/QuestionCard-V4iGO2wF.js","/assets/RationalNumbersTopperSectionProduction-BhNnpuYc.js","/assets/Rush-Ba_PRZj4.js","/assets/Settings-DvxxrMKY.js","/assets/SignUpFlow-C7apyZXw.css","/assets/SignUpFlow-CotKobT8.js","/assets/SignUpFlow-Dbs12BM8.js","/assets/Tasks-1W-wA25r.js","/assets/assignmentTarget-B6wjmFCI.js","/assets/backend-BDz_Bum1.js","/assets/cloudAccount-C7MlyzKl.js","/assets/cloudReader-DXQJo9cW.js","/assets/cloudSyncScheduler-B2Zeu7T-.js","/assets/cloudSyncScheduler-CkIPfoav.js","/assets/copy-DC7k5i8z.js","/assets/demoSeed-Bx3veiPx.js","/assets/figures--_2Ot-DF.js","/assets/files-BkEChupo.js","/assets/inkLatex-4SP97VBx.js","/assets/latex-hWwEj1kh.js","/assets/ncertTerms-Ds6pWWUR.js","/assets/notesIndex-Bxk9oByQ.js","/assets/notesIndex-C9JaehS2.js","/assets/personal-BaQRH6eb.js","/assets/reminders-BMrw_MYb.js","/assets/reminders-DeKkmgjm.js","/assets/settings-DhD3I8ka.js","/assets/socialSignIn-Dyiog5qL.js","/assets/strings.hi-YM9Oe0Xf.js","/assets/vendor-katex-CRuPsUhM.js","/assets/vendor-katex-DzFXvcrH.css","/assets/workspace-CpWUaWGD.css","/auth/callback.html","/auth/callback.js","/icons/icon-192.png","/icons/icon-512.png","/icons/icon-maskable-192.png"];
const OPTIONAL = ["/assets/InkAnswer-B30WB6Zx.js","/assets/InkAnswer-BtfsbN8F.js","/assets/InkAnswer-CHVygwv2.js","/assets/InkAnswer-CXUZ4O04.js","/assets/InkAnswer-Cs3obH11.js","/assets/InkAnswer-SwAz3oHl.js","/assets/NativeInkCanvas-DfvikEGC.js","/assets/ink-engine-C1fc9g9V.js","/assets/ink-model-D3cN_hBH.js","/assets/ink-personal-BHAF41nc.js","/assets/model-data-DsXS_xxz.js","/assets/recognizer-Mqe9D0S6.js"];
// ─────────────────────────────────────────────────────────────────────────────

const SHELL = '/index.html';
const STAMP = '/__pri-built';
const KEEP = 2;
// Either a hashed build asset (anything under /assets/) or a static file by
// extension; the groups make the two anchored alternatives explicit.
const CACHEABLE = /(?:^\/assets\/)|(?:\.(?:js|css|html|svg|png|webmanifest|woff2?|ttf)$)/;

// ── Install ──────────────────────────────────────────────────────────────────

// A hashed filename is its own identity, so the HTTP cache cannot answer with
// the wrong bytes; the shell is the one name that outlives its contents.
const hashed = (url) => url !== '/' && url !== SHELL;

// A server that answers every path it does not know with the shell — ours
// does, because an unknown path is usually an in-app route — answers a chunk
// it no longer has with `200 text/html`. Kept under the chunk's name, that
// page would be handed back as the chunk on every later load, and a module
// that arrives as HTML never runs: the app would sit on its splash with no
// failed request to show for it. So a script is only kept if it is a script,
// a stylesheet if it is a stylesheet, and HTML only under an HTML name.
function rightKind(pathname, res) {
  const type = res.headers.get('content-type') || '';
  const html = /text\/html/i.test(type);
  if (pathname === '/' || /\.html$/.test(pathname)) return html;
  if (/\.m?js$/.test(pathname)) return /javascript|ecmascript/i.test(type);
  if (/\.css$/.test(pathname)) return /text\/css/i.test(type);
  return !html;
}

async function fill(cache, urls) {
  const missed = [];
  await Promise.all(urls.map(async (url) => {
    try {
      const res = await fetch(new Request(url, { cache: hashed(url) ? 'default' : 'reload', credentials: 'same-origin' }));
      if (!res.ok) throw new Error(String(res.status));
      if (!rightKind(url, res)) throw new Error('wrong kind');
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

// A message is acted on only when it comes from a page of this origin. Service
// worker clients are same-origin by construction, so in a browser this never
// turns away a real page; it makes the boundary explicit and holds it if the
// worker is ever reachable another way.
const fromThisOrigin = (e) => !e.origin || e.origin === self.location.origin;

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
  if (!fromThisOrigin(e)) return;
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

// ── Reminders (display only) ─────────────────────────────────────────────────
// The page computes when a reminder is due (client/src/reminders) and, while it
// is open, asks the worker to show it; the worker never decides anything and
// has no push subscription — there is no server to push from. A tap opens the
// in-app route the reminder named, in the window that is already open where
// there is one. Titles and bodies arrive generic by construction: counts and
// catalogue copy, never a question or a mark.

const REMINDER_ROUTE = /^\/[a-z-]*$/;

self.addEventListener('message', (e) => {
  if (e.data?.type !== 'pri-notify') return;
  if (!fromThisOrigin(e)) return;
  const title = String(e.data.title || '').slice(0, 120);
  const body = String(e.data.body || '').slice(0, 200);
  const tag = String(e.data.tag || 'pri-reminder').slice(0, 64);
  const url = REMINDER_ROUTE.test(String(e.data.url || '')) ? e.data.url : '/';
  if (!title) return;
  e.waitUntil(self.registration.showNotification(title, { body, tag, data: { url }, icon: '/icons/icon-192.png' }).catch(() => {}));
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = REMINDER_ROUTE.test(String(e.notification.data?.url || '')) ? e.notification.data.url : '/';
  e.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const open = all.find(c => 'focus' in c);
    if (open) {
      try { await open.focus(); } catch { /* focus can be refused; navigate below */ }
      if ('navigate' in open) { try { await open.navigate(url); } catch { /* cross-origin or detached */ } }
      return;
    }
    if (self.clients.openWindow) await self.clients.openWindow(url);
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

// The API is not the worker's. Nothing under these paths is ever cached, so
// answering them here bought nothing and put the worker — its start-up, its
// cache lookup, its lifetime — between the app and every server call it makes,
// the boot health probe included. They go straight to the network, exactly as
// they would with no worker installed; offline they fail the same way.
const API = /^\/(?:v1|api)\//;

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  if (API.test(url.pathname)) return;
  // The Google/Apple sign-in popup lands here; it is its own small page, not an
  // in-app route, and must never be answered with the app shell.
  if (url.pathname === '/auth/callback.html' || url.pathname === '/auth/callback.js') return;
  e.respondWith(req.mode === 'navigate' ? shellFor(e) : assetFor(e, url));
});

// Keeping a copy is a convenience; the answer the page is waiting for is not.
// The copy is written after the response has been handed back, and a write
// that fails — a full disk, a body cut short, a quota — loses the copy and
// nothing else. It used to be awaited inside the same try as the fetch, so a
// failed write turned a good network response into a network error.
function keep(e, key, res) {
  const copy = res.clone();
  e.waitUntil(caches.open(VERSION).then(cache => cache.put(key, copy)).catch(() => {}));
}

// Every in-app route renders from the one shell, and it has to be this build's
// shell — an older one would name chunks this cache no longer holds.
async function shellFor(e) {
  let shell = null;
  try {
    const cache = await caches.open(VERSION);
    shell = (await cache.match(SHELL)) || (await cache.match('/'));
  } catch { /* a cache that cannot be read is a cache miss */ }
  if (shell) return shell;
  try {
    const res = await fetch(e.request);
    if (res.ok && res.type === 'basic' && rightKind(SHELL, res)) keep(e, SHELL, res);
    return res;
  } catch {
    return Response.error();
  }
}

// Filenames carry a content hash, so a hit in the retained previous build is
// the same bytes under the same name — that is what keeps a session that was
// open across a redeploy able to reach the chunks it has not loaded yet.
async function assetFor(e, url) {
  const req = e.request;
  let hit = null;
  try { hit = await caches.match(req); } catch { /* unreadable cache: ask the network */ }
  if (hit) return hit;
  try {
    const res = await fetch(req);
    if (res.ok && res.type === 'basic' && CACHEABLE.test(url.pathname) && rightKind(url.pathname, res)) keep(e, req, res);
    return res;
  } catch {
    return Response.error();
  }
}
