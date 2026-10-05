// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · caching policy for the built client (ledger 1.11)
//
// Vite names every bundled file by content hash (assets/<name>-<hash>.<ext>),
// so a file at a given URL never changes: it may be cached for a year and
// marked immutable, and a new release simply ships new names. Three files are
// the opposite — their URL is fixed and their content is the release:
//   · index.html     the shell, which names the hashed chunks of THIS release;
//   · sw.js          the service worker, which the browser re-fetches by URL
//                    to discover a new precache (a cached worker is a stuck app);
//   · release.json   the exact release identity the client verifies against
//                    the server (releaseIdentity.js).
// They are served no-cache: always revalidated (ETag/Last-Modified from
// express.static), never served stale, never stored past the revalidation.
// manifest.webmanifest follows them. Everything else under the root (icons,
// the favicon, fonts copied unhashed) gets an hour.
//
// compression() (server/app.js) negotiates Brotli or gzip from Accept-Encoding
// and adds Vary: Accept-Encoding; server/test/static-caching-check.mjs fetches
// built files through the real server and asserts every rule here.
// ─────────────────────────────────────────────────────────────────────────────
import { basename } from 'node:path';

export const IMMUTABLE = 'public, max-age=31536000, immutable';
export const REVALIDATE = 'no-cache';
export const SHORT = 'public, max-age=3600';

// Vite's hash: 8+ URL-safe characters between the last hyphen and the extension.
const HASHED = /^[^/]+-[A-Za-z0-9_-]{8,}\.[a-z0-9]+(?:\.map)?$/;
const ALWAYS_REVALIDATE = new Set(['index.html', 'sw.js', 'release.json', 'manifest.webmanifest']);

/** The Cache-Control for a file at `path` (absolute or relative); exported for the test. */
export function cacheControlFor(path) {
  // Both separators, whatever the host: express.static hands over an absolute path.
  const normalized = String(path || '').replace(/\\/g, '/');
  const name = basename(normalized);
  if (ALWAYS_REVALIDATE.has(name)) return REVALIDATE;
  if (/(^|\/)assets\/[^/]+$/.test(normalized) && HASHED.test(name)) return IMMUTABLE;
  return SHORT;
}

/** express.static setHeaders hook. */
export function staticCacheHeaders(res, path) {
  res.setHeader('Cache-Control', cacheControlFor(path));
}
