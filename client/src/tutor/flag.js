// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the AI tutor feature flag
//
// The frozen V1 scope (docs/release/PRI_V1_RELEASE_SCOPE.md) ships no public
// beta surfaces, and the AI tutor is not V1 unless a coordinator-approved scope
// change adds it. So the tutor is OFF in every production build unless that
// build was made with PRI_FEATURE_TUTOR=1 (staging), and ON on the development
// server. When it is off there is no tutor UI beyond the deterministic hints,
// the local tutor routes refuse with TUTOR_DISABLED, and nothing is sent to
// /v1/tutor. The server has its own switch (PRI_FEATURE_TUTOR=1) and answers
// 404 without it.
//
// A runtime override exists only outside production builds — the dev server
// and Node test suites — through localStorage `pri-feature-tutor` ('1'/'0') or
// globalThis.__PRI_TUTOR_OVERRIDE__ (true/false). A production build ignores
// both: nothing on the device can switch the tutor on.
// ─────────────────────────────────────────────────────────────────────────────

/* global __PRI_FEATURE_TUTOR__, __PRI_PRODUCTION_BUILD__ */
const BUILD_FLAG = typeof __PRI_FEATURE_TUTOR__ === 'boolean' ? __PRI_FEATURE_TUTOR__ : null;
const PRODUCTION_BUILD = typeof __PRI_PRODUCTION_BUILD__ === 'boolean' ? __PRI_PRODUCTION_BUILD__ : false;

export function tutorFeatureEnabled(scope = globalThis) {
  if (BUILD_FLAG === true && PRODUCTION_BUILD) return true;
  if (PRODUCTION_BUILD) return false;
  const override = scope?.__PRI_TUTOR_OVERRIDE__;
  if (override === true || override === false) return override;
  try {
    const stored = scope?.localStorage?.getItem?.('pri-feature-tutor');
    if (stored === '1') return true;
    if (stored === '0') return false;
  } catch { /* storage unavailable: fall through to the build default */ }
  return BUILD_FLAG === true;
}

export function tutorDisabledError() {
  return Object.assign(new Error('The AI tutor is not enabled in this build.'), { status: 404, code: 'TUTOR_DISABLED' });
}
