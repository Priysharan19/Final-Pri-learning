// Pri Learning · the regional edition this server serves (ADR-0002, plan E1, E2).
//
// One source of truth: client/edition.config.mjs, read here exactly as the
// client build reads it, from PRI_EDITION (unset = Priyabhata). An unknown
// value throws, so a mistyped service variable stops the server at start-up
// instead of serving one edition's students under the other's identity.
//
// THE EDITION IS DEPLOYMENT IDENTITY, NEVER TENANT SELECTION. A deployment
// serves exactly one edition, fixed when the process starts. Nothing a request
// carries (a header, a body field, a query parameter) chooses the edition,
// its data, brand, currency or authorization. E2 adds the two checks that
// hold that:
//
//   1. assertEditionAgreement: the built client this server ships
//      (client/dist/features.json, written by the Vite build) must have been
//      made for the same edition, or the server does not start.
//   2. refuseOtherEdition: a client may declare the edition it was built for
//      in X-Pri-Edition. The server uses the declaration ONLY TO REFUSE
//      (409 EDITION_MISMATCH). A matching or absent header changes nothing.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { EDITIONS, resolveEdition } from '../../client/edition.config.mjs';

export function serverEdition(env = process.env) {
  return resolveEdition(env);
}

/** The request header a client declares its build's edition in. */
export const EDITION_HEADER = 'x-pri-edition';

// What a built client says about itself:
//   { state: 'absent' }                 no dist folder (an API-only process)
//   { state: 'undeclared' }             a dist with no readable edition (a build from before E1, or a damaged one)
//   { state: 'declared', edition }      the string features.json carries; not yet checked against the table
function readBuiltClient(dist) {
  if (!dist || !existsSync(dist)) return { state: 'absent' };
  let features;
  try {
    features = JSON.parse(readFileSync(join(dist, 'features.json'), 'utf8'));
  } catch {
    return { state: 'undeclared' };
  }
  const edition = typeof features?.edition === 'string' ? features.edition.trim() : '';
  return edition ? { state: 'declared', edition } : { state: 'undeclared' };
}

/**
 * The edition the built client in `dist` was made for, as its features.json
 * declares it, or null when there is no dist or it declares none. The value is
 * returned as written: it may be an id this server does not know, which
 * assertEditionAgreement refuses.
 */
export function builtClientEdition(dist) {
  const built = readBuiltClient(dist);
  return built.state === 'declared' ? built.edition : null;
}

// The entry point and the app both check the same dist; say it once per process.
const warnedDists = new Set();

// Printable in one log line whatever features.json held.
const shown = value => JSON.stringify(String(value).slice(0, 40));

/**
 * Hold the server's edition equal to the built client's. Returns
 * { edition, client, checked } or throws an Error whose message is one line
 * naming both sides (code EDITION_MISMATCH or EDITION_UNDECLARED).
 *
 *   no dist at all                 → nothing to cross-check; start normally
 *   dist declares this edition     → start
 *   dist declares anything else    → refuse, in every environment
 *   dist declares no edition       → refuse in production; warn elsewhere
 *                                    (once per dist per process)
 */
export function assertEditionAgreement({ dist, env = process.env, production = env.NODE_ENV === 'production', warn = console.warn } = {}) {
  const edition = serverEdition(env);
  const built = readBuiltClient(dist);
  if (built.state === 'absent') return { edition, client: null, checked: false };
  if (built.state === 'declared') {
    if (built.edition === edition) return { edition, client: edition, checked: true };
    throw Object.assign(
      new Error(`edition_mismatch: this server is ${edition} (PRI_EDITION) but the built client it would serve was made for ${shown(built.edition)} (features.json); refusing to start`),
      { code: 'EDITION_MISMATCH', serverEdition: edition, clientEdition: built.edition }
    );
  }
  const line = `edition_undeclared: this server is ${edition} (PRI_EDITION) but the built client it would serve names no edition in features.json`;
  if (production) {
    throw Object.assign(new Error(`${line}; refusing to start`), { code: 'EDITION_UNDECLARED', serverEdition: edition, clientEdition: null });
  }
  if (!warnedDists.has(dist)) {
    warnedDists.add(dist);
    warn(`${line}; continuing because this is not a production process`);
  }
  return { edition, client: null, checked: false };
}

/**
 * Refuse a request whose client declares another edition. Refuse-only: the
 * header never selects anything, and a request without it (an older shell, a
 * provider webhook, an operator's curl) passes exactly as before. The body
 * names the two editions so the app can tell its user which app they hold.
 */
export function refuseOtherEdition(edition) {
  const serverBrand = EDITIONS[edition].brand;
  return (req, res, next) => {
    const raw = req.get(EDITION_HEADER);
    if (raw === undefined) return next();
    const declared = String(raw).trim();
    if (declared === edition) return next();
    // Only an id from the table is echoed; anything else is reported as null.
    const known = Object.hasOwn(EDITIONS, declared) ? declared : null;
    res.locals.errorCode = 'EDITION_MISMATCH';
    res.set('Cache-Control', 'no-store');
    return res.status(409).json({
      error: {
        code: 'EDITION_MISMATCH',
        message: known
          ? `This app is ${EDITIONS[known].brand}. It cannot sign in to ${serverBrand}'s service.`
          : `This app was not made for ${serverBrand}'s service.`,
        serverEdition: edition,
        clientEdition: known
      },
      requestId: req.requestId
    });
  };
}

// ── The database belongs to one edition (plan H2) ───────────────────────────
//
// ADR-0002 §9: each edition has its own database. The binding makes a
// mistyped PRI_DATABASE_URL (an Australian service pointed at the Mumbai
// database, or the reverse) stop the server before it listens, rather than
// serve one edition's students from the other's rows.
//
//   platform_meta.edition absent, database has no accounts → write ours, start
//   absent, accounts exist, we are priyabhata              → write ours, start
//                                                            (databases from before H2: production India)
//   absent, accounts exist, we are anything else           → refuse
//   present and equal to ours                              → start
//   present and different (or unknown)                     → refuse
//
// The application never changes a bound database's edition; that is a manual,
// owner-authorised operation (docs/operations/region-isolation-verification.md).
export const EDITION_META_KEY = 'edition';
/** The edition a database that predates the binding is assumed to hold. */
export const LEGACY_DATABASE_EDITION = 'priyabhata';

function bindingError(code, message, extra = {}) {
  return Object.assign(new Error(message), { code, ...extra });
}

/**
 * Bind `db` (a platform store) to `edition`, or throw before anything is
 * served. Returns { edition, bound: 'existing' | 'new' | 'legacy' }.
 * Concurrent first starts are safe: the insert does nothing on conflict and
 * the stored value is re-read and compared.
 */
export async function bindDatabaseEdition(db, edition) {
  if (!Object.hasOwn(EDITIONS, edition)) {
    throw bindingError('EDITION_UNKNOWN', `edition_binding: ${shown(edition)} is not an edition this server knows; refusing to start`);
  }
  const read = async () => (await db.get('SELECT value FROM platform_meta WHERE key = ?', [EDITION_META_KEY]))?.value;
  let stored = await read();
  let bound = 'existing';
  if (stored === undefined || stored === null) {
    const hasAccounts = Boolean(await db.get('SELECT 1 AS one FROM accounts LIMIT 1'));
    if (hasAccounts && edition !== LEGACY_DATABASE_EDITION) {
      throw bindingError('EDITION_DATABASE_UNBOUND',
        `edition_binding: this server is ${edition} (PRI_EDITION) but its database holds accounts and is bound to no edition (a database from before the binding is ${LEGACY_DATABASE_EDITION}'s); refusing to start`,
        { serverEdition: edition, databaseEdition: null });
    }
    await db.run('INSERT INTO platform_meta(key, value) VALUES (?, ?) ON CONFLICT(key) DO NOTHING', [EDITION_META_KEY, edition]);
    bound = hasAccounts ? 'legacy' : 'new';
    stored = await read();
  }
  if (stored !== edition) {
    throw bindingError('EDITION_DATABASE_MISMATCH',
      `edition_binding: this server is ${edition} (PRI_EDITION) but its database is bound to ${shown(stored)} (platform_meta.edition); refusing to start`,
      { serverEdition: edition, databaseEdition: stored });
  }
  return { edition, bound };
}
