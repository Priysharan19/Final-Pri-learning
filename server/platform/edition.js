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
  warn(`${line}; continuing because this is not a production process`);
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
