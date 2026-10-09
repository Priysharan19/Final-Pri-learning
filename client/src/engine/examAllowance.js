/**
 * The free plan's exam-simulation allowance. ONE definition: the device reads
 * it for its fast pre-check (local/entitlementGate.js) and the server enforces
 * it when a paper is created (server/platform/exams.js), counting its own
 * sealed papers for the account.
 *
 * It lives in the engine folder because that is the only client source the
 * production image carries; a server import from anywhere else in client/src
 * fails at boot in the container.
 */
export const FREE_EXAM_ALLOWANCE = Object.freeze({ examsPerWindow: 1, examWindowDays: 30 });
