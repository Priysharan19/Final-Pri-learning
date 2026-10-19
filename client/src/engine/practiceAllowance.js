/**
 * The free plan's daily practice allowance. ONE definition: the device reads it
 * for its fast pre-check and its copy (local/entitlementGate.js), and the
 * server enforces it where a creditable question is issued
 * (server/platform/practiceAllowance.js at POST /v1/practice/issue and
 * POST /v1/practice/:id/repeat), counting its own issued questions per account.
 *
 * The server's day is the Indian calendar day: Asia/Kolkata, UTC+05:30, no
 * daylight saving. The device's own pre-check uses the profile's calendar,
 * which for an India profile is Asia/Kolkata unless the student set another
 * zone — so the two agree for every India profile by default, and where they
 * differ the server's answer is the one that stands.
 *
 * It lives in the engine folder because that is the only client source the
 * production image carries; a server import from anywhere else in client/src
 * fails at boot in the container (see examAllowance.js).
 */
export const FREE_PRACTICE_ALLOWANCE = Object.freeze({ perDay: 20, timeZone: 'Asia/Kolkata' });

/**
 * The issue modes the cap counts: the ones the Practice surface serves through
 * POST /practice/next (and "the same question again" from History). The free
 * plan's copy is "{limit} practice questions a day, and everything else
 * unlimited": Rush and Match are games and the placement check is onboarding
 * evidence (it writes no attempt), so neither is counted by the device or by
 * the server.
 */
export const CAPPED_PRACTICE_MODES = Object.freeze(['practice', 'review', 'task']);
