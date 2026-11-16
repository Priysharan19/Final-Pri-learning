// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · past papers: a default-OFF switch
//
// The previous-year archives (the source-cited archive in engine/pyq and the
// reviewed JEE department catalog in generators/jee-pyq-runtime.js) hold
// transcriptions of NTA, JAB and CBSE papers. No written rights opinion on
// their commercial use exists yet (docs/legal/counsel/COUNSEL-INFORMATION-PACK
// item 24; V1 decision D23, 1 Nov 2026). Until counsel answers, nothing from
// either archive reaches a student: not through the "past papers only" filter,
// not in the ordinary practice pool, and not as a cell of a timed paper.
//
// The switch is read at call time, never cached, and it is OFF unless the
// environment says otherwise:
//
//   · server / Node (the authority that issues every question and paper):
//       PRI_PAST_PAPERS=1
//   · client build:
//       PRI_FEATURE_PAST_PAPERS=1 → client/vite.config.js defines
//       __PRI_FEATURE_PAST_PAPERS__ (a production build ignores overrides)
//   · suites that exercise the archive machinery itself set the env variable
//     (process.env.PRI_PAST_PAPERS = '1') before they call into the engine, or
//     use the runtime override globalThis.__PRI_PAST_PAPERS__ = true | false.
//
// The archive code stays in the bundle so the switch is a switch, not a
// deletion: client/test/past-papers-flag-check.mjs proves both states.
// ─────────────────────────────────────────────────────────────────────────────

/* global __PRI_FEATURE_PAST_PAPERS__ */

/** Why past papers are off: shown in refusals and reports, never guessed at. */
export const PAST_PAPERS_OFF_REASON = 'rights-opinion-pending';

function productionBuild() {
  try { return import.meta.env?.PROD === true; } catch { return false; }
}

function builtConstant() {
  return typeof __PRI_FEATURE_PAST_PAPERS__ === 'boolean' ? __PRI_FEATURE_PAST_PAPERS__ : null;
}

function envSwitch() {
  try {
    const value = typeof process !== 'undefined' && process?.env ? process.env.PRI_PAST_PAPERS : undefined;
    if (value === undefined || value === null || value === '') return null;
    return String(value).trim() === '1';
  } catch { return null; }
}

function runtimeOverride() {
  const forced = globalThis.__PRI_PAST_PAPERS__;
  return typeof forced === 'boolean' ? forced : null;
}

/**
 * Are previous-year questions allowed to reach a student right now?
 * Default false. A production client build answers only from its build
 * constant; everywhere else the runtime override wins, then the environment,
 * then the build constant, then the default.
 */
export function pastPapersEnabled() {
  const built = builtConstant();
  if (productionBuild() && built !== null) return built;
  const forced = runtimeOverride();
  if (forced !== null) return forced;
  const env = envSwitch();
  if (env !== null) return env;
  return built ?? false;
}

/** The switch as a report or a refusal states it. */
export function pastPapersStatus() {
  const enabled = pastPapersEnabled();
  return Object.freeze({ enabled, reason: enabled ? null : PAST_PAPERS_OFF_REASON });
}
