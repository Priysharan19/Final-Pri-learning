// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the local backend's one line to the AI tutor
//
// The local practice route decides everything that matters — whether the row
// is a practice row (an exam row never gets here), which level is next, what it
// costs in credit — and only then asks the server for words. This module is
// that ask, and it never throws: every "carry on without it" case resolves to
// { error: { code } } so the route falls back to the question's authored hint.
//
// Nothing about the student is sent but their own work lines and typed answer.
// ─────────────────────────────────────────────────────────────────────────────
import { cloud, cloudAvailable } from '../platform/cloudTransport.js';
import { tutorFeatureEnabled } from '../tutor/flag.js';

const TIMEOUT_MS = 25_000;

let override = null;

/** Tests replace the transport; production never calls this. */
export function setTutorTransportForTests(fn) {
  override = typeof fn === 'function' ? fn : null;
}

let lineOverride = null;
/** Tests replace the line-check transport; production never calls this. */
export function setLineCheckTransportForTests(fn) {
  lineOverride = typeof fn === 'function' ? fn : null;
}

/** Ask /v1/tutor/line-check. Resolves to { lineCheck } or { error: { code } }; never rejects. */
export async function requestLineCheck(body, { signal = null } = {}) {
  if (!tutorFeatureEnabled()) return { error: { code: 'TUTOR_DISABLED' } };
  try {
    if (lineOverride) return await lineOverride(body, { signal });
    if (!cloudAvailable()) return { error: { code: 'TUTOR_OFFLINE' } };
    const response = await cloud.tutorLineCheck(body, { signal });
    if (!response?.lineCheck) return { error: { code: 'TUTOR_MALFORMED' } };
    return { lineCheck: response.lineCheck };
  } catch (error) {
    return { error: { code: String(error?.code || 'TUTOR_FAILED').slice(0, 60) } };
  }
}

let coachOverride = null;
/** Tests replace the step-coach transport; production never calls this. */
export function setStepCoachTransportForTests(fn) {
  coachOverride = typeof fn === 'function' ? fn : null;
}

/**
 * Is the live step coach on for this account? The SERVER decides (its switch
 * and the account's own entitlement snapshot); this only asks, once per
 * session, and treats any failure as off.
 */
let coachStatus = null;
export function stepCoachAvailable() {
  if (!tutorFeatureEnabled()) return Promise.resolve(false);
  if (coachOverride) return Promise.resolve(true);
  if (!cloudAvailable()) return Promise.resolve(false);
  if (!coachStatus) coachStatus = cloud.tutorStatus().then(r => r?.stepCoach === true).catch(() => { coachStatus = null; return false; });
  return coachStatus;
}
/** Forget the cached answer (sign-in, sign-out, a plan change). */
export function resetStepCoachStatus() { coachStatus = null; }

/** Ask /v1/tutor/step-coach. Resolves to { stepCoach } or { error: { code } }; never rejects. */
export async function requestStepCoach(body, { signal = null } = {}) {
  if (!tutorFeatureEnabled()) return { error: { code: 'TUTOR_DISABLED' } };
  try {
    if (coachOverride) return await coachOverride(body, { signal });
    if (!cloudAvailable()) return { error: { code: 'TUTOR_OFFLINE' } };
    const response = await cloud.tutorStepCoach(body, { signal });
    if (!Array.isArray(response?.stepCoach?.lines)) return { error: { code: 'TUTOR_MALFORMED' } };
    return { stepCoach: response.stepCoach };
  } catch (error) {
    const code = String(error?.code || 'TUTOR_FAILED').slice(0, 60);
    // The server said no for this account: stop asking this session.
    if (code === 'STEP_COACH_PREMIUM' || code === 'NOT_FOUND' || error?.status === 404) coachStatus = Promise.resolve(false);
    return { error: { code } };
  }
}

/** Ask /v1/tutor/help. Resolves to { tutor } or { error: { code } }; never rejects. */
export async function requestTutorHelp(body, { signal = null, timeoutMs = TIMEOUT_MS } = {}) {
  // Dark by default: with the feature off nothing is sent to /v1/tutor.
  if (!tutorFeatureEnabled()) return { error: { code: 'TUTOR_DISABLED' } };
  try {
    if (override) return await override(body, { signal, timeoutMs });
    if (!cloudAvailable()) return { error: { code: 'TUTOR_OFFLINE' } };
    // A diagnosis asks for longer (high reasoning effort); never past a minute.
    const response = await cloud.tutorHelp(body, { signal, timeoutMs: Math.min(60_000, Math.max(1_000, Number(timeoutMs) || TIMEOUT_MS)) });
    if (!response?.tutor) return { error: { code: 'TUTOR_MALFORMED' } };
    return { tutor: response.tutor };
  } catch (error) {
    const timedOut = error?.name === 'TimeoutError' || error?.name === 'AbortError';
    return { error: { code: timedOut ? 'TUTOR_TIMEOUT' : String(error?.code || 'TUTOR_FAILED').slice(0, 60), status: Number(error?.status) || null } };
  }
}
