/**
 * The free plan's daily allowance. ONE definition: the device reads it for its
 * copy (local/entitlementGate.js, paywall/), and the server enforces it where a
 * practice answer is MARKED (server/platform/practiceAllowance.js at
 * POST /v1/practice/:id/submit), counting its own marked scripts per account.
 *
 * The free/Premium split (notebook + paywall proposal):
 *   · practice is unlimited on the free plan — every question is issued;
 *   · examiner marking is the free plan's daily allowance: 5 marked scripts a
 *     day. A "script" is one question marked by the deterministic engine; the
 *     second try on the same question belongs to the same script and is not
 *     counted again;
 *   · Premium lifts the marking allowance (`unlimited-marking`).
 *
 * The server's day is the Indian calendar day: Asia/Kolkata, UTC+05:30, no
 * daylight saving.
 *
 * It lives in the engine folder because that is the only client source the
 * production image carries; a server import from anywhere else in client/src
 * fails at boot in the container (see examAllowance.js).
 */
export const FREE_MARKING_ALLOWANCE = Object.freeze({ scriptsPerDay: 5, timeZone: 'Asia/Kolkata' });

/**
 * Kept for the day/time-zone definition older modules import. Practice itself
 * is no longer capped: `perDay` is null (unlimited).
 */
export const FREE_PRACTICE_ALLOWANCE = Object.freeze({ perDay: null, timeZone: FREE_MARKING_ALLOWANCE.timeZone });

/**
 * The issue modes whose marking the allowance counts: the Practice surface's
 * own (practice, notebook/review retries, tasks). Rush and Match are one-try
 * games and the placement check is onboarding evidence (it writes no attempt):
 * none of them is counted by the device or by the server.
 */
export const CAPPED_PRACTICE_MODES = Object.freeze(['practice', 'review', 'task']);

/** How many of the newest mistakes the free plan's notebook shows in full. */
export const FREE_NOTEBOOK_PREVIEW = 3;
