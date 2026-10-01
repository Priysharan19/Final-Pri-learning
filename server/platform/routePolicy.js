// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · what each /v1 route actually enforces, read off the router
//
// The access-control middlewares (requireSession, requireRole,
// requireVerifiedEmail, requireGuardianConsent, rateLimit, csrfGuard) carry a
// small frozen `priPolicy` tag. listRoutes() walks an Express router the way a
// request would traverse it — router-level middleware applies only to the
// layers registered after it, a path-scoped middleware applies to the router
// mounted on the same path — and reports, for every method + path, the policy
// that is really in front of the handler.
//
// docs/security/route-inventory.json is the reviewed statement of what that
// policy should be. server/test/route-inventory-check.mjs compares the two, so
// a route added without an inventory entry, or a guard removed from one, fails
// CI instead of shipping silently.
// ─────────────────────────────────────────────────────────────────────────────

/** Attach (or extend) the policy tag on a middleware. Returns the middleware. */
export function tagPolicy(fn, policy) {
  Object.defineProperty(fn, 'priPolicy', {
    value: Object.freeze({ ...(fn.priPolicy || {}), ...policy }),
    configurable: true,
    enumerable: false
  });
  return fn;
}

function isRouter(handle) {
  return typeof handle === 'function' && Array.isArray(handle.stack);
}

/** The static mount path of a `router.use(path, …)` layer ('' for a path-less use). */
export function mountPath(layer) {
  if (layer.regexp?.fast_slash) return '';
  const source = String(layer.regexp?.source || '');
  const match = /^\^((?:\\\/[A-Za-z0-9._-]+)+)\\\/\?\(\?=\\\/\|\$\)$/.exec(source);
  if (!match) throw new Error(`routePolicy: unrecognised mount pattern ${source}`);
  return match[1].replace(/\\\//g, '/');
}

const MUTATION = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export function derivePolicy(method, chain) {
  const policy = {
    session: false,
    roles: null,
    verifiedEmail: false,
    guardianConsent: false,
    rateLimits: [],
    csrf: false
  };
  for (const fn of chain) {
    const tag = fn?.priPolicy;
    if (!tag) continue;
    if (tag.session) policy.session = true;
    if (tag.verifiedEmail) policy.verifiedEmail = true;
    if (tag.guardianConsent) policy.guardianConsent = true;
    if (tag.csrf && MUTATION.has(method)) policy.csrf = true;
    if (tag.rateLimit) policy.rateLimits.push({ ...tag.rateLimit });
    if (Array.isArray(tag.roles)) {
      // Successive role gates narrow: a request must pass every one of them.
      policy.roles = policy.roles === null
        ? [...tag.roles].sort()
        : policy.roles.filter(role => tag.roles.includes(role));
    }
  }
  return policy;
}

/**
 * Every route reachable through `router`, with the policy that guards it.
 * Paths are relative to wherever `router` itself is mounted.
 */
export function listRoutes(router, prefix = '', inherited = []) {
  const routes = [];
  const scoped = [];
  const byPath = new Map();
  for (const layer of router.stack || []) {
    if (layer.route) {
      const chain = [...inherited, ...scoped, ...layer.route.stack.map(entry => entry.handle)];
      for (const method of Object.keys(layer.route.methods).filter(name => layer.route.methods[name])) {
        const upper = method.toUpperCase();
        routes.push({ method: upper, path: `${prefix}${layer.route.path}`, policy: derivePolicy(upper, chain) });
      }
      continue;
    }
    // Error handlers never authorise anything.
    if (layer.handle?.length === 4) continue;
    const path = mountPath(layer);
    if (isRouter(layer.handle)) {
      routes.push(...listRoutes(layer.handle, `${prefix}${path}`, [...inherited, ...scoped, ...(byPath.get(path) || [])]));
    } else if (path === '') {
      scoped.push(layer.handle);
    } else {
      byPath.set(path, [...(byPath.get(path) || []), layer.handle]);
    }
  }
  return routes;
}
