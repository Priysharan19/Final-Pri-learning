// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the guest trial, device side (ADR-0003)
//
// Five typed or multiple-choice questions a day for a visitor with no account.
// Everything that matters is the server's: it mints the anonymous token (an
// HttpOnly cookie this code never sees), chooses and seals each question,
// marks each answer and counts. This module only carries the CSRF value the
// session reply names, in memory, and turns the server's refusals into the
// handful of states the screen has words for.
//
// It never marks, never reads a key, never touches the on-device engine, never
// stores an answer, and is not offered inside a native shell (whose cookie and
// CSRF jar is the shell's own, ADR-0003 item 7).
// ─────────────────────────────────────────────────────────────────────────────
import { cloud, cloudAvailable, nativeCloudAvailable } from '../platform/cloudTransport.js';
import { priNative } from '../platform/native/index.js';

let session = null;

/** Whether the first screen may be the guest trial: a browser with a reachable server, never a native shell. */
export function guestTrialAvailable() {
  try { return typeof window !== 'undefined' && !priNative.isNativeShell() && !nativeCloudAvailable() && cloudAvailable(); }
  catch { return false; }
}

const reason = error => {
  const code = error?.code;
  if (code === 'GUEST_LIMIT_REACHED') return 'limit';
  if (code === 'GUEST_ADDRESS_LIMIT') return 'address';
  if (code === 'GUEST_BUSY') return 'busy';
  if (code === 'GUEST_SIGN_UP_REQUIRED' || error?.status === 402) return 'account';
  if (code === 'GUEST_NO_QUESTION' || code === 'PRACTICE_BANK_OUTSIDE_CURRICULUM') return 'none';
  if (code === 'GUEST_QUESTION_EXPIRED') return 'expired';
  if (code === 'GUEST_TOO_FAST') return 'fast';
  if (code === 'MARKING_BUSY') return 'marking-busy';
  if (code === 'GUEST_ALREADY_ANSWERED') return 'answered';
  return 'offline';
};

/** Start or resume the trial on this device: { limit, remaining }. */
export async function startGuest() {
  const out = await cloud.guestStart();
  session = { csrf: out.csrf, limit: out.limit, remaining: out.remaining };
  return { limit: out.limit, remaining: out.remaining };
}

// One restart when the token has lapsed (a day passed with the page open).
async function withSession(call) {
  if (!session) await startGuest();
  try { return await call(session.csrf); }
  catch (error) {
    if (error?.status === 401 || error?.code === 'CSRF_REJECTED') { await startGuest(); return call(session.csrf); }
    throw error;
  }
}

/** One question: { question, sealed, remaining, limit } or throws { reason }. */
export async function askGuest({ generator, difficulty, curriculum, form }) {
  try {
    const out = await withSession(csrf => cloud.guestQuestion({ generator, difficulty, curriculum, form }, csrf));
    session.remaining = out.remaining;
    return out;
  } catch (error) { throw Object.assign(new Error('guest question refused'), { reason: reason(error), resetAt: error?.resetAt }); }
}

/** One verdict: { resolved, correct, answer, remaining } | { invalid } or throws { reason }. */
export async function answerGuest({ sealed, answer }) {
  try {
    const out = await withSession(csrf => cloud.guestAnswer({ sealed, answer }, csrf));
    if (typeof out?.remaining === 'number') session.remaining = out.remaining;
    return out;
  } catch (error) { throw Object.assign(new Error('guest answer refused'), { reason: reason(error) }); }
}

export const guestRemaining = () => session?.remaining ?? null;
