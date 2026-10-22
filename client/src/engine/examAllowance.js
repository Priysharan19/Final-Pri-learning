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
//
// Mock papers are Premium (the free/Premium split): the free plan's allowance
// is zero papers. The window is kept so a deployment or test can raise it.
export const FREE_EXAM_ALLOWANCE = Object.freeze({ examsPerWindow: 0, examWindowDays: 30 });
