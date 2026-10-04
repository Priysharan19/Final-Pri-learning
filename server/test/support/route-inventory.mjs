// Shared by route-inventory-check.mjs and security-acceptance-check.mjs.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createPlatformDb } from '../../platform/db.js';
import { createPlatformRouter } from '../../platform/router.js';
import { listRoutes } from '../../platform/routePolicy.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const INVENTORY_PATH = join(root, 'docs', 'security', 'route-inventory.json');
const AUTH_KINDS = new Set(['none', 'session', 'credentials', 'bearer-token', 'oidc-token', 'provider-signature', 'operator-token']);
const ROLES = new Set(['student', 'teacher', 'support', 'admin']);
const CSRF = new Set(['not-applicable', 'double-submit-when-session-cookie']);
const ORIGIN = new Set(['not-applicable', 'enforced', 'exempt-provider-webhook', 'exempt-provider-callback']);
const MUTATION = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export function loadInventory(path = INVENTORY_PATH) {
  const inventory = JSON.parse(readFileSync(path, 'utf8'));
  if (inventory.format !== 'pri-route-inventory-v1' || !Array.isArray(inventory.routes)) throw new Error('route inventory format is not pri-route-inventory-v1');
  return inventory;
}

export function mountedRoutes(router = createPlatformRouter(createPlatformDb(':memory:'))) {
  return listRoutes(router, '/v1');
}

const key = route => `${route.method} ${route.path}`;
const sortedRoles = roles => (roles === null ? null : [...roles].sort());

/** Every way the mounted routes and the inventory disagree, as readable lines. */
export function compareInventory(mounted, inventory) {
  const problems = [];
  const listed = new Map();
  for (const entry of inventory.routes) {
    if (listed.has(key(entry))) problems.push(`duplicate inventory entry ${key(entry)}`);
    listed.set(key(entry), entry);
  }
  const seen = new Set();
  for (const route of mounted) {
    const k = key(route);
    if (seen.has(k)) problems.push(`route mounted twice: ${k}`);
    seen.add(k);
    const entry = listed.get(k);
    if (!entry) { problems.push(`UNLISTED ROUTE ${k}: add it to docs/security/route-inventory.json with its security review`); continue; }
    const p = route.policy;
    if ((entry.auth === 'session') !== p.session) problems.push(`${k}: inventory auth=${entry.auth} but requireSession is ${p.session ? '' : 'not '}mounted`);
    if (JSON.stringify(sortedRoles(entry.roles)) !== JSON.stringify(sortedRoles(p.roles))) problems.push(`${k}: inventory roles ${JSON.stringify(entry.roles)} but mounted ${JSON.stringify(p.roles)}`);
    // operator-token is machine-derived like session: the tagged gate in
    // router.js (PRI_METRICS_TOKEN) must be mounted exactly where it is declared.
    if ((entry.auth === 'operator-token') !== !!p.operatorToken) problems.push(`${k}: inventory auth=${entry.auth} but the operator-token gate is ${p.operatorToken ? '' : 'not '}mounted`);
    if (entry.verifiedEmail !== p.verifiedEmail) problems.push(`${k}: inventory verifiedEmail=${entry.verifiedEmail} but mounted ${p.verifiedEmail}`);
    // The second-factor gate (security.js requireMfa): false, true, or a
    // step-up window. An inventory entry that omits it declares false.
    if (JSON.stringify(entry.mfa ?? false) !== JSON.stringify(p.mfa)) problems.push(`${k}: inventory mfa=${JSON.stringify(entry.mfa ?? false)} but mounted ${JSON.stringify(p.mfa)}`);
    if (entry.guardianConsent !== p.guardianConsent) problems.push(`${k}: inventory guardianConsent=${entry.guardianConsent} but mounted ${p.guardianConsent}`);
    if (JSON.stringify(entry.rateLimits) !== JSON.stringify(p.rateLimits)) problems.push(`${k}: inventory rateLimits ${JSON.stringify(entry.rateLimits)} but mounted ${JSON.stringify(p.rateLimits)}`);
    for (const problem of p.outOfOrder || []) problems.push(`${k}: guard order — ${problem} (it would answer 403 where 401 is due, or read no session)`);
    // A limit on a signed-in route that runs before requireSession is keyed by
    // IP: every account behind one school NAT shares it, and one account can
    // spread across addresses. Only anonymous routes may be IP-keyed.
    if (entry.auth === 'session' && p.rateLimits.some(limit => limit.identity !== 'account')) problems.push(`${k}: rate limit runs before requireSession, so it is keyed by IP instead of by account`);
    const csrf = p.csrf ? 'double-submit-when-session-cookie' : 'not-applicable';
    if (entry.csrf !== csrf) problems.push(`${k}: inventory csrf=${entry.csrf} but mounted ${csrf}`);
  }
  for (const k of listed.keys()) if (!seen.has(k)) problems.push(`STALE INVENTORY ENTRY ${k}: no such route is mounted`);
  for (const entry of inventory.routes) {
    const k = key(entry);
    if (!AUTH_KINDS.has(entry.auth)) problems.push(`${k}: unknown auth kind ${entry.auth}`);
    if (entry.roles !== null && (!Array.isArray(entry.roles) || !entry.roles.length || entry.roles.some(role => !ROLES.has(role)))) problems.push(`${k}: roles must be null or a non-empty list of known roles`);
    if (typeof entry.ownership !== 'string' || entry.ownership.trim().length < 8) problems.push(`${k}: ownership rule missing`);
    if (!CSRF.has(entry.csrf)) problems.push(`${k}: unknown csrf value ${entry.csrf}`);
    if (!ORIGIN.has(entry.origin)) problems.push(`${k}: unknown origin value ${entry.origin}`);
    if (MUTATION.has(entry.method) && entry.origin === 'not-applicable') problems.push(`${k}: a mutation must state its origin policy`);
    if (!MUTATION.has(entry.method) && entry.origin !== 'not-applicable') problems.push(`${k}: only mutations have an origin policy`);
    if (MUTATION.has(entry.method) ? entry.bodyLimit !== inventory.transportBodyLimit : entry.bodyLimit !== 'no-body') problems.push(`${k}: bodyLimit must be ${MUTATION.has(entry.method) ? inventory.transportBodyLimit : 'no-body'}`);
    // A route that authenticates nobody and limits nobody must say why in review.
    if (entry.auth === 'none' && MUTATION.has(entry.method) && !entry.rateLimits.length && k !== 'POST /v1/account/logout') problems.push(`${k}: anonymous mutation without a rate limit`);
    if (['credentials', 'bearer-token', 'oidc-token'].includes(entry.auth) && !entry.rateLimits.length) problems.push(`${k}: credential/token route without a rate limit`);
    if (entry.roles?.includes('admin') && entry.roles.length === 1 && entry.auth !== 'session') problems.push(`${k}: admin route without a session`);
    // Every route only staff can reach asks for their second factor, except the
    // enrolment ceremony itself (which is what makes the factor exist).
    const staffOnly = Array.isArray(entry.roles) && entry.roles.every(role => role === 'admin' || role === 'support');
    if (staffOnly && !(entry.mfa ?? false) && !entry.path.startsWith('/v1/account/mfa/')) problems.push(`${k}: a staff-only route must require a second factor (mfa)`);
    if ((entry.mfa ?? false) && entry.auth !== 'session') problems.push(`${k}: mfa requires a session`);
  }
  return problems;
}

