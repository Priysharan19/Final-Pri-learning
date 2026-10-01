// Route inventory contract (V1 blocker #14, security acceptance).
//
// docs/security/route-inventory.json is the reviewed list of every /v1 route
// with its authentication, roles, verified-email and guardian-consent gates,
// rate limits, CSRF/origin treatment, ownership rule and body limits.
//
// This check reads the guards that are really mounted (server/platform/
// routePolicy.js walks the production router) and fails when:
//   · a route exists that the inventory does not list (a new endpoint shipped
//     without a security review), or the inventory lists a route that is gone;
//   · a listed guard differs from the mounted one (a requireSession, role gate,
//     verified-email gate, consent gate, rate limit or CSRF guard was added,
//     removed or changed without the inventory changing with it);
//   · an entry is incomplete (no ownership rule, unknown auth kind, …).
// A self-test proves the comparison catches an unlisted route and a dropped
// guard, so the check cannot pass by comparing nothing.

import { createPlatformDb } from '../platform/db.js';
import { createPlatformRouter } from '../platform/router.js';
import { listRoutes } from '../platform/routePolicy.js';
import { asyncRouter } from '../platform/asyncRouter.js';
import { rateLimit, requireRole, requireSession } from '../platform/security.js';
import { checks } from './support/app-harness.mjs';
import { compareInventory, loadInventory, mountedRoutes } from './support/route-inventory.mjs';

const c = checks();
const inventory = loadInventory();
const mounted = mountedRoutes();

// The walk sees the whole platform: every sub-router contributes.
c.ok(mounted.length >= 70, `the router walk found ${mounted.length} routes`);
for (const prefix of ['/v1/account/', '/v1/account/identity/', '/v1/sync/', '/v1/billing/', '/v1/classes/', '/v1/assignments/', '/v1/content/', '/v1/reports/', '/v1/handwriting/', '/v1/working/', '/v1/telemetry/', '/v1/admin/', '/v1/entitlements/']) {
  c.ok(mounted.some(route => route.path.startsWith(prefix)), `walk reaches ${prefix}`);
}

const problems = compareInventory(mounted, inventory);
if (problems.length) console.error(problems.map(line => `  ✗ ${line}`).join('\n'));
c.deq(problems, [], 'mounted /v1 routes match docs/security/route-inventory.json exactly');
c.eq(inventory.routes.length, mounted.length, `inventory lists all ${mounted.length} routes`);

// Every authenticated non-public route really sits behind requireSession, and
// every admin-only route behind requireRole('admin').
c.ok(mounted.filter(route => route.path.startsWith('/v1/admin/')).every(route => route.policy.session && JSON.stringify(route.policy.roles) === '["admin"]'), 'every /v1/admin route requires an admin session');
c.ok(mounted.filter(route => /^\/v1\/(sync|classes|assignments|reports|telemetry)\//.test(route.path)).every(route => route.policy.session), 'every sync, class, assignment, report and telemetry route requires a session');
c.ok(mounted.filter(route => route.path === '/v1/handwriting/transcribe' || route.path === '/v1/working/check').every(route => route.policy.session && route.policy.verifiedEmail && route.policy.guardianConsent && route.policy.rateLimits.length === 1), 'paid AI routes need a verified, consented session and a per-account limit');

// ── Self-test: the comparison is not vacuous ───────────────────────────────
{
  const db = createPlatformDb(':memory:');
  const router = createPlatformRouter(db);
  const extra = asyncRouter();
  extra.get('/unreviewed', (req, res) => res.json({}));
  router.stack.splice(router.stack.length - 2, 0, ...(() => { const host = asyncRouter(); host.use('/shadow', extra); return host.stack; })());
  const withExtra = compareInventory(listRoutes(router, '/v1'), inventory);
  c.ok(withExtra.some(line => line.startsWith('UNLISTED ROUTE GET /v1/shadow/unreviewed')), 'self-test: an unlisted route fails the check');

  const loosened = JSON.parse(JSON.stringify(inventory));
  const adminUsers = loosened.routes.find(entry => entry.path === '/v1/admin/users');
  adminUsers.roles = ['admin', 'support'];
  c.ok(compareInventory(mounted, loosened).some(line => line.includes('/v1/admin/users') && line.includes('roles')), 'self-test: a role mismatch fails the check');

  const dropped = mounted.map(route => route.path === '/v1/account/login'
    ? { ...route, policy: { ...route.policy, rateLimits: [] } }
    : route);
  c.ok(compareInventory(dropped, inventory).some(line => line.includes('/v1/account/login') && line.includes('rateLimits')), 'self-test: a removed rate limit fails the check');

  const unguarded = mounted.map(route => route.path === '/v1/sync/push'
    ? { ...route, policy: { ...route.policy, session: false } }
    : route);
  c.ok(compareInventory(unguarded, inventory).some(line => line.includes('/v1/sync/push') && line.includes('requireSession')), 'self-test: a removed requireSession fails the check');

  // The tags the walk reads are present on the real guard factories.
  c.ok(requireSession(db).priPolicy?.session === true, 'requireSession carries its policy tag');
  c.deq([...requireRole('teacher').priPolicy.roles], ['teacher'], 'requireRole carries its roles');
  c.deq({ ...rateLimit(db, 'x', { limit: 3, windowMs: 1000 }).priPolicy.rateLimit }, { key: 'x', limit: 3, windowMs: 1000 }, 'rateLimit carries its limit');
}

console.log(`ROUTE INVENTORY — PASS — ${c.count()}/${c.count()} checks — ${mounted.length} /v1 routes reviewed`);
