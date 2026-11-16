// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the anonymous public resource catalogue (plan F6a)
//
//   GET /v1/public/resources        the published library of THIS server's edition
//   GET /v1/public/resources/:id    one published resource
//
// For the public Prithagoras site, which stops keeping a second copy of the
// catalogue. It is OFF by default (PRI_PUBLIC_CATALOGUE=on turns it on): with
// the switch off the router is not mounted at all, so the server answers
// exactly as it did before this file existed.
//
// What it is allowed to say is the same set the signed-in library serves
// (resources.js VISIBLE: published, external https link, offered to this
// server's edition) in the same public shape (resourcePublic): no account
// data, no signed URL for a hosted file, no review or edition internals. It
// reads no cookie and sets none; a session on the request changes nothing. It
// takes no query: the site filters on its own device, so there is nothing for
// a caller to inject and the reply is the same for everyone (cacheable).
//
// CORS: Access-Control-Allow-Origin is sent only when the request's Origin is
// listed, exactly, in PRI_PUBLIC_CATALOGUE_ORIGINS (https origins, no
// wildcard, no credentials). A malformed list stops the server at start-up.
// ─────────────────────────────────────────────────────────────────────────────
import { createHash } from 'node:crypto';
import { asyncRouter } from './asyncRouter.js';
import { asStore } from './store.js';
import { rateLimit } from './security.js';
import { serverEdition } from './edition.js';
import { EDITION_IDS } from '../../client/edition.config.mjs';
import { resourcePublic } from './resourceCatalog.js';
import { VISIBLE } from './resources.js';

const ID = /^[a-z0-9][a-z0-9-]{2,119}$/;
const PAGE = 100;
const MAX_REPLY_BYTES = 256 * 1024;
const CLEAN_ORIGIN = /^https:\/\/[a-z0-9]([a-z0-9.-]*[a-z0-9])?(?::\d{1,5})?$/i;

/** { enabled, origins } from the environment; throws on a malformed origin list. */
export function publicCatalogueConfig(env = process.env) {
  const enabled = String(env.PRI_PUBLIC_CATALOGUE || '').trim().toLowerCase() === 'on';
  const raw = String(env.PRI_PUBLIC_CATALOGUE_ORIGINS || '').trim();
  const origins = raw ? raw.split(/[\s,]+/).filter(Boolean) : [];
  for (const origin of origins) {
    if (!CLEAN_ORIGIN.test(origin) || origin.endsWith('.') || origin.includes('*')) {
      throw new Error('PRI_PUBLIC_CATALOGUE_ORIGINS must list exact https origins (no wildcard, path or credentials)');
    }
  }
  // On with no listed origin is allowed: it sends no CORS header at all.
  return { enabled, origins: [...new Set(origins.map(o => o.toLowerCase()))] };
}

export function createPublicResourceRouter(db, { edition = serverEdition(process.env), origins = [] } = {}) {
  db = asStore(db);
  if (!EDITION_IDS.includes(edition)) throw new Error(`public catalogue: unknown edition ${JSON.stringify(edition)}`);
  const router = asyncRouter();

  // Headers every answer carries; nothing here reads or sets a cookie.
  router.use((req, res, next) => {
    res.set('Vary', 'Origin');
    const origin = String(req.get('origin') || '').toLowerCase();
    if (origin && origins.includes(origin)) res.set('Access-Control-Allow-Origin', origin);
    next();
  });

  const send = (req, res, body) => {
    const text = JSON.stringify(body);
    const etag = `"${createHash('sha256').update(text).digest('base64url').slice(0, 27)}"`;
    res.set('Cache-Control', 'public, max-age=300');
    res.set('ETag', etag);
    if (req.get('if-none-match') === etag) return res.status(304).end();
    res.type('application/json').send(text);
  };

  router.get('/', rateLimit(db, 'public-resources-list', { limit: 300, windowMs: 60 * 60 * 1000 }), async (req, res) => {
    const rows = await db.all(`SELECT r.* FROM resources r WHERE ${VISIBLE} ORDER BY r.year DESC, r.title, r.id LIMIT ?`, [edition, PAGE + 1]);
    let resources = rows.slice(0, PAGE).map(resourcePublic);
    let hasMore = rows.length > PAGE;
    while (resources.length && Buffer.byteLength(JSON.stringify(resources)) > MAX_REPLY_BYTES) { resources = resources.slice(0, -1); hasMore = true; }
    send(req, res, { resources, hasMore });
  });

  router.get('/:id', rateLimit(db, 'public-resources-read', { limit: 600, windowMs: 60 * 60 * 1000 }), async (req, res) => {
    const id = String(req.params.id || '');
    const row = ID.test(id) ? await db.get(`SELECT r.* FROM resources r WHERE r.id=? AND ${VISIBLE}`, [id, edition]) : null;
    if (!row) {
      // An unknown id, a draft, a withdrawn row and another edition's row: one answer.
      res.set('Cache-Control', 'no-store');
      return res.status(404).json({ error: { code: 'RESOURCE_NOT_FOUND', message: 'No such resource in this library.' } });
    }
    send(req, res, { resource: resourcePublic(row) });
  });

  return router;
}
