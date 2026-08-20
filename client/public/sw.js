// Pri Learning service worker — full offline support.
// App-shell cache-first; everything the app needs ships in the precache.
const VERSION = 'pri-v2';

self.addEventListener('install', (e) => {
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  e.respondWith((async () => {
    const cache = await caches.open(VERSION);
    const cached = await cache.match(e.request, { ignoreSearch: url.pathname === '/' });
    if (cached) {
      // refresh in the background
      e.waitUntil(fetch(e.request).then(res => { if (res.ok) cache.put(e.request, res.clone()); }).catch(() => { }));
      return cached;
    }
    try {
      const res = await fetch(e.request);
      if (res.ok && (url.pathname.startsWith('/assets/') || url.pathname === '/' || url.pathname.endsWith('.html') ||
        url.pathname.endsWith('.svg') || url.pathname.endsWith('.png') || url.pathname.endsWith('.webmanifest'))) {
        cache.put(e.request, res.clone());
      }
      return res;
    } catch {
      // offline navigation → serve the app shell
      const shell = await cache.match('/');
      if (shell) return shell;
      throw new Error('offline');
    }
  })());
});
