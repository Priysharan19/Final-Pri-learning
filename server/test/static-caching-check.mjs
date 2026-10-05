// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · caching policy for the built client (ledger 1.11)
//
// Through the real server (app.js → express.static + compression):
//   · hashed assets under /assets are immutable for a year;
//   · index.html, sw.js, release.json and the manifest are no-cache and
//     revalidate (ETag → 304), the SPA fallback included;
//   · everything else briefly cached;
//   · Brotli when the client accepts it, gzip otherwise, Vary: Accept-Encoding;
//   · the /v1 control plane stays no-store.
// Against a synthetic dist always, and against the real client/dist when it
// has been built.
// ─────────────────────────────────────────────────────────────────────────────
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

process.env.NODE_ENV = 'test';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const { startApp, checks } = await import('./support/app-harness.mjs');
const { cacheControlFor, IMMUTABLE, REVALIDATE, SHORT } = await import('../platform/staticCache.js');

const c = checks();
const tmp = mkdtempSync(join(tmpdir(), 'pri-static-cache-'));
const dist = join(tmp, 'dist');
mkdirSync(join(dist, 'assets'), { recursive: true });
mkdirSync(join(dist, 'icons'), { recursive: true });
const big = `// built chunk\n${'export const pad = "0123456789abcdef";\n'.repeat(200)}`;
writeFileSync(join(dist, 'index.html'), '<!doctype html><html><head><title>Pri</title><script type="module" src="/assets/index-Ab12Cd34.js"></script></head><body><div id="root"></div></body></html>\n');
writeFileSync(join(dist, 'sw.js'), `const VERSION = 'v1';\n${big}`);
writeFileSync(join(dist, 'release.json'), JSON.stringify({ releaseSha: 'f'.repeat(40) }));
writeFileSync(join(dist, 'manifest.webmanifest'), '{"name":"Pri"}');
writeFileSync(join(dist, 'assets', 'index-Ab12Cd34.js'), big);
writeFileSync(join(dist, 'assets', 'index-Ab12Cd34.css'), '.a{color:red}\n'.repeat(300));
writeFileSync(join(dist, 'assets', 'ink-model-9f8e7d6c5b.js'), big);
writeFileSync(join(dist, 'assets', 'plain.js'), 'export const unhashed = 1;\n');
writeFileSync(join(dist, 'icons', 'icon-192.png'), Buffer.alloc(300, 1));

// ── Unit: the policy by path ───────────────────────────────────────────────
c.eq(cacheControlFor('/srv/dist/assets/index-Ab12Cd34.js'), IMMUTABLE, 'a hashed chunk is immutable');
c.eq(cacheControlFor('/srv/dist/assets/ink-model-9f8e7d6c5b.js'), IMMUTABLE, 'a named hashed chunk is immutable');
c.eq(cacheControlFor('/srv/dist/assets/index-Ab12Cd34.js.map'), IMMUTABLE, 'its source map too');
c.eq(cacheControlFor('/srv/dist/assets/plain.js'), SHORT, 'an unhashed file under assets is not immutable');
c.eq(cacheControlFor('/srv/dist/index.html'), REVALIDATE, 'the shell revalidates');
c.eq(cacheControlFor('/srv/dist/sw.js'), REVALIDATE, 'the service worker revalidates');
c.eq(cacheControlFor('/srv/dist/release.json'), REVALIDATE, 'the release identity revalidates');
c.eq(cacheControlFor('/srv/dist/manifest.webmanifest'), REVALIDATE, 'the manifest revalidates');
c.eq(cacheControlFor('/srv/dist/icons/icon-192.png'), SHORT, 'an icon is briefly cached');
c.eq(cacheControlFor('C:\\srv\\dist\\assets\\index-Ab12Cd34.js'), IMMUTABLE, 'Windows separators are normalised');
c.eq(cacheControlFor('/srv/dist/nested/assets-index-Ab12Cd34.js'), SHORT, 'only the assets directory counts as hashed output');

async function expectPolicy(h, path, { cache, encoding = null, accept = 'br, gzip', type = null }, label) {
  const res = await h.request(path, { headers: { Accept: '*/*', 'Accept-Encoding': accept } });
  c.eq(res.status, 200, `${label}: served`);
  c.eq(res.headers.get('cache-control'), cache, `${label}: Cache-Control is "${cache}"`);
  if (type) c.match(res.headers.get('content-type'), type, `${label}: content type`);
  if (encoding) {
    c.eq(res.headers.get('content-encoding'), encoding, `${label}: ${encoding} when the client accepts "${accept}"`);
    c.match(res.headers.get('vary'), /Accept-Encoding/i, `${label}: Vary: Accept-Encoding`);
  }
  return res;
}

// ── Synthetic dist through the real server ─────────────────────────────────
const h = await startApp({ dist });
try {
  const shell = await expectPolicy(h, '/', { cache: REVALIDATE, type: /text\/html/ }, 'shell');
  c.ok(!!shell.headers.get('etag') && !!shell.headers.get('last-modified'), 'the shell carries an ETag and Last-Modified, so no-cache means revalidate rather than refetch');
  await expectPolicy(h, '/index.html', { cache: REVALIDATE }, 'index.html by name');
  await expectPolicy(h, '/practice/some/deep/route', { cache: REVALIDATE, type: /text\/html/ }, 'SPA fallback');
  await expectPolicy(h, '/sw.js', { cache: REVALIDATE, encoding: 'br', type: /javascript/ }, 'service worker');
  await expectPolicy(h, '/release.json', { cache: REVALIDATE }, 'release.json');
  await expectPolicy(h, '/manifest.webmanifest', { cache: REVALIDATE }, 'manifest');
  await expectPolicy(h, '/assets/index-Ab12Cd34.js', { cache: IMMUTABLE, encoding: 'br', type: /javascript/ }, 'hashed JS');
  await expectPolicy(h, '/assets/index-Ab12Cd34.js', { cache: IMMUTABLE, encoding: 'gzip', accept: 'gzip' }, 'hashed JS, gzip-only client');
  await expectPolicy(h, '/assets/index-Ab12Cd34.css', { cache: IMMUTABLE, encoding: 'br', type: /text\/css/ }, 'hashed CSS');
  await expectPolicy(h, '/assets/ink-model-9f8e7d6c5b.js', { cache: IMMUTABLE, encoding: 'br' }, 'named hashed chunk');
  await expectPolicy(h, '/assets/plain.js', { cache: SHORT }, 'unhashed asset');
  await expectPolicy(h, '/icons/icon-192.png', { cache: SHORT }, 'icon');
  const identity = await h.request('/assets/index-Ab12Cd34.js', { headers: { Accept: '*/*', 'Accept-Encoding': 'identity' } });
  c.ok(!identity.headers.get('content-encoding'), 'a client that accepts no encoding gets the bytes as they are');

  const health = await h.request('/v1/health');
  c.eq(health.headers.get('cache-control'), 'no-store', 'the control plane stays no-store');
  const missing = await h.request('/assets/does-not-exist-Ab12Cd34.js', { headers: { Accept: '*/*' } });
  c.match(missing.headers.get('content-type'), /text\/html/, 'an unknown asset path falls through to the SPA shell (the app decides)');
  c.eq(missing.headers.get('cache-control'), REVALIDATE, 'and that answer is never cached as the asset');
} finally {
  await h.close();
  rmSync(tmp, { recursive: true, force: true });
}

// ── The real build, when it exists ─────────────────────────────────────────
const realDist = join(ROOT, 'client', 'dist');
let realChecked = 0;
if (existsSync(join(realDist, 'index.html')) && existsSync(join(realDist, 'assets'))) {
  const served = await startApp({ dist: realDist });
  try {
    const hashed = readdirSync(join(realDist, 'assets')).filter(name => /-[A-Za-z0-9_-]{8,}\.js$/.test(name)).sort();
    c.ok(hashed.length > 0, 'the real build names its chunks by hash');
    await expectPolicy(served, '/', { cache: REVALIDATE, type: /text\/html/ }, 'real shell');
    await expectPolicy(served, '/sw.js', { cache: REVALIDATE }, 'real service worker');
    await expectPolicy(served, '/release.json', { cache: REVALIDATE }, 'real release.json');
    await expectPolicy(served, `/assets/${hashed[0]}`, { cache: IMMUTABLE, encoding: 'br' }, `real chunk ${hashed[0]}`);
    realChecked = 4;
  } finally {
    await served.close();
  }
}

console.log(`STATIC CACHING: PASS — ${c.count()}/${c.count()} checks — hashed assets immutable, shell/sw.js/release.json revalidate, Brotli and gzip negotiated, /v1 no-store${realChecked ? ' (real build verified)' : ' (real build not present; synthetic only)'}`);
