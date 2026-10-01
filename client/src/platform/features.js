// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · build-time feature flags.
//
// The frozen V1 scope (docs/release/PRI_V1_RELEASE_SCOPE.md) ships no default
// public beta surfaces. A feature outside that scope is therefore built behind
// a flag that is OFF in a production build unless the build environment turns
// it on, and ON in development and in test builds:
//
//   PRI_FEATURE_PLACEMENT=1   the placement diagnostic (onboarding offer, Home
//                             and Progress entry points, /placement, and the
//                             adaptive picker's diagnostic prior)
//
// client/vite.config.js turns each PRI_FEATURE_* environment variable into a
// compile-time boolean (`__PRI_FEATURE_PLACEMENT__`). `vite build` without the
// variable gives false; `vite` (development) gives true. Outside Vite — the
// Node test suites that import the engine and the local backend directly —
// there is no build constant and the feature defaults to on, as tests do.
//
// A runtime override exists only where no production build constant is in
// force: `globalThis.__PRI_FEATURE_OVERRIDES__ = { placement: false }` (tests)
// or localStorage `pri-feature:placement` = '1' | '0' (development). A
// production build ignores both, so nobody can switch a non-V1 surface on in
// the shipped app from the console. Enabling one for V1 is a scope change that
// needs coordinator approval, not a code change.
// ─────────────────────────────────────────────────────────────────────────────

/* global __PRI_FEATURE_PLACEMENT__ */
const BUILT = {
  placement: typeof __PRI_FEATURE_PLACEMENT__ === 'boolean' ? __PRI_FEATURE_PLACEMENT__ : null
};

const productionBuild = () => {
  try { return import.meta.env?.PROD === true; } catch { return false; }
};

function override(name) {
  const injected = globalThis.__PRI_FEATURE_OVERRIDES__;
  if (injected && typeof injected[name] === 'boolean') return injected[name];
  try {
    const stored = globalThis.localStorage?.getItem(`pri-feature:${name}`);
    if (stored === '1') return true;
    if (stored === '0') return false;
  } catch { /* storage may be unavailable; the build default stands */ }
  return null;
}

/** Is a flagged feature on in this build? */
export function featureEnabled(name) {
  if (!(name in BUILT)) return false;
  const built = BUILT[name];
  if (productionBuild() && built !== null) return built;
  const forced = override(name);
  if (forced !== null) return forced;
  return built ?? true;
}

/** The flags as this build resolves them — read by the browser tours. */
export function featureSnapshot() {
  return Object.freeze(Object.fromEntries(Object.keys(BUILT).map(name => [name, featureEnabled(name)])));
}
