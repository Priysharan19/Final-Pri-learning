// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · when "What went wrong?" is offered
//
// The button explains a verdict the deterministic engine has already given, so
// it appears only where a wrong line or a wrong answer is on screen:
//
//   · a graded "not yet" on a first try (the attempt is still open — the
//     diagnosis then never states the answer, and is charged like a tutor level);
//   · a resolved question the student got wrong (the mark is final — the
//     diagnosis may name the answer they have already been shown).
//
// Never with the tutor off (src/tutor/flag.js), never on a placement check,
// never after Reveal (no work of theirs was judged), never on an entry the
// engine could not read, and never on a right answer.
// ─────────────────────────────────────────────────────────────────────────────

export function showDiagnoseButton({ tutorEnabled, diagnostic = false, resolved = false, res = null, gradedRetry = false } = {}) {
  if (tutorEnabled !== true || diagnostic) return false;
  if (!res || res.invalid || res.technical || res.conflict) return false;
  if (resolved) return res.correct === false && res.revealed !== true;
  return gradedRetry === true && res.correct !== true;
}

/**
 * "Check this line so far": under a server reading in Write mode, before the
 * question is resolved, with the tutor on, never on a placement check.
 */
export function showLineCheckButton({ tutorEnabled, diagnostic = false, writeMode = false, resolved = false, hasLines = false, checksLeft = 2, lineCheckEnabled = lineCheckFeatureEnabled() } = {}) {
  return lineCheckEnabled === true && tutorEnabled === true && !diagnostic && writeMode === true && !resolved && hasLines === true && checksLeft > 0;
}

/* global __PRI_PRODUCTION_BUILD__ */
/**
 * "Check this line so far" is OFF (Director decision): an answer relating two
 * variables can still be told right from wrong until final-answer detection
 * is engine-based. The server route is 404 without PRI_FEATURE_LINE_CHECK=1;
 * here the button is hidden in every build. Only a non-production build (dev
 * server, Node suites) may switch it on, through
 * globalThis.__PRI_LINE_CHECK_OVERRIDE__ = true.
 */
export function lineCheckFeatureEnabled(scope = globalThis) {
  const production = typeof __PRI_PRODUCTION_BUILD__ === 'boolean' ? __PRI_PRODUCTION_BUILD__ : false;
  if (production) return false;
  return scope?.__PRI_LINE_CHECK_OVERRIDE__ === true;
}

/** The final-answer status the diagnosis is told: the engine's, as the card holds it. */
export function finalAnswerStatus(res) {
  if (res?.correct === true) return 'correct';
  if (res?.correct === false) return 'wrong';
  return 'unknown';
}
