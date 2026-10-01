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

/** Ask /v1/tutor/help. Resolves to { tutor } or { error: { code } }; never rejects. */
export async function requestTutorHelp(body, { signal = null } = {}) {
  // Dark by default: with the feature off nothing is sent to /v1/tutor.
  if (!tutorFeatureEnabled()) return { error: { code: 'TUTOR_DISABLED' } };
  try {
    if (override) return await override(body, { signal });
    if (!cloudAvailable()) return { error: { code: 'TUTOR_OFFLINE' } };
    const response = await cloud.tutorHelp(body, { signal, timeoutMs: TIMEOUT_MS });
    if (!response?.tutor) return { error: { code: 'TUTOR_MALFORMED' } };
    return { tutor: response.tutor };
  } catch (error) {
    const timedOut = error?.name === 'TimeoutError' || error?.name === 'AbortError';
    return { error: { code: timedOut ? 'TUTOR_TIMEOUT' : String(error?.code || 'TUTOR_FAILED').slice(0, 60), status: Number(error?.status) || null } };
  }
}
