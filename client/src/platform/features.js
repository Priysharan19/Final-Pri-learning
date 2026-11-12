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
//   PRI_FEATURE_EXTENDED_TRACKS=1
//                             the tracks and roles outside the certified V1
//                             scope (docs/content/certification-report.md
//                             certifies cbse, jee-main and jee-advanced only;
//                             PRI_V1_RELEASE_SCOPE §6/§11/§16 keep the teacher
//                             product out of public V1): the Olympiad track,
//                             the Teacher role in onboarding and the
//                             classroom/assignment panels for students.
//                             Profiles that already hold one of these keep
//                             working whatever the flag says — it gates new
//                             selection only.
//   instrument               NOT a flag any more. The student interface is
//                             set once, in client/interface.config.mjs (V1
//                             decision D7), and every build — web, iOS and
//                             Android — ships the Instrument from it. The
//                             build still records it here as a constant so
//                             code can branch on it, and it is true wherever
//                             Vite builds or serves the app.
//   PRI_FEATURE_AUSTRALIA=1   the onboarding link to the Australian syllabuses
//                             (V1 is India-only; existing Australian profiles
//                             keep working either way)
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

import { INTERFACE_SKIN as SETTING_SKIN } from '../../interface.config.mjs';


/* global __PRI_FEATURE_PLACEMENT__, __PRI_FEATURE_EXTENDED_TRACKS__, __PRI_FEATURE_AUSTRALIA__, __PRI_FEATURE_EXAM_HANDWRITING__, __PRI_FEATURE_INSTRUMENT__, __PRI_FEATURE_PARENT_REPORT__, __PRI_FEATURE_LIBRARY__ */
const BUILT = {
  placement: typeof __PRI_FEATURE_PLACEMENT__ === 'boolean' ? __PRI_FEATURE_PLACEMENT__ : null,
  extendedTracks: typeof __PRI_FEATURE_EXTENDED_TRACKS__ === 'boolean' ? __PRI_FEATURE_EXTENDED_TRACKS__ : null,
  australia: typeof __PRI_FEATURE_AUSTRALIA__ === 'boolean' ? __PRI_FEATURE_AUSTRALIA__ : null,
  // PRI_FEATURE_EXAM_HANDWRITING=1 — handwriting input in timed exams. OFF by
  // default in a production build: a paper then offers Type only.
  examHandwriting: typeof __PRI_FEATURE_EXAM_HANDWRITING__ === 'boolean' ? __PRI_FEATURE_EXAM_HANDWRITING__ : null,
  // The student interface (client/interface.config.mjs): true in every build.
  // The Node suites, which have no build constant, see the same interface
  // production ships.
  instrument: typeof __PRI_FEATURE_INSTRUMENT__ === 'boolean' ? __PRI_FEATURE_INSTRUMENT__ : true,
  // PRI_FEATURE_PARENT_REPORT=1 — the parent weekly report's screens. OFF in a
  // production build until counsel has reviewed email about minors (D22); the
  // server is off too unless PRI_PARENT_REPORT=on (server/platform/parentReport.js).
  parentReport: typeof __PRI_FEATURE_PARENT_REPORT__ === 'boolean' ? __PRI_FEATURE_PARENT_REPORT__ : null,
  // PRI_FEATURE_LIBRARY=1 — the shared resource library's page (/library,
  // ADR-0002 plan F1). OFF in a production build: a new student surface outside
  // the frozen V1 scope, so V1 behaviour is unchanged until the owner's GO.
  library: typeof __PRI_FEATURE_LIBRARY__ === 'boolean' ? __PRI_FEATURE_LIBRARY__ : null
};

// The student interface as a build constant (client/interface.config.mjs).
// Written so a production build folds it to a literal: Vite replaces the
// global with true, the conditional collapses, and the bundler can then drop
// every branch written for the v1.0 shell along with whatever only it imports.
// featureEnabled('instrument') is a runtime call the bundler cannot see
// through, so shared pages read this instead.
export const INSTRUMENT_UI = typeof __PRI_FEATURE_INSTRUMENT__ === 'boolean' ? __PRI_FEATURE_INSTRUMENT__ : true;
// The skin the Instrument's chrome wears ('aurora' or 'instrument'), from the
// same setting; where there is no build constant (the Node suites) the
// setting itself is read.
/* global __PRI_INTERFACE_SKIN__ */
export const INTERFACE_SKIN_UI = typeof __PRI_INTERFACE_SKIN__ === 'string' ? __PRI_INTERFACE_SKIN__ : SETTING_SKIN;

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
