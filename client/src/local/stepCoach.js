// The live step coach's practice route (F1), split out of local/backend.js so
// it loads only when the server has switched the coach on for this account
// (first-visit budget, client/test/install-budget-check.mjs). backend.js
// checks the profile, the row and the lines before importing this.
// backend.js has checked the tutor switch before it imports this module.
import { cloudAvailable, cloudRequest } from '../platform/cloudTransport.js';

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
  if (coachOverride) return Promise.resolve(true);
  if (!cloudAvailable()) return Promise.resolve(false);
  if (!coachStatus) coachStatus = cloudRequest('/v1/tutor/status', { timeoutMs: 10000 }).then(r => r?.stepCoach === true).catch(() => { coachStatus = null; return false; });
  return coachStatus;
}
/** Forget the cached answer (sign-in, sign-out, a plan change). */
export function resetStepCoachStatus() { coachStatus = null; }

/** Ask /v1/tutor/step-coach. Resolves to { stepCoach } or { error: { code } }; never rejects. */
export async function requestStepCoach(body, { signal = null } = {}) {
  try {
    if (coachOverride) return await coachOverride(body, { signal });
    if (!cloudAvailable()) return { error: { code: 'TUTOR_OFFLINE' } };
    const response = await cloudRequest('/v1/tutor/step-coach', { method: 'POST', body, signal, timeoutMs: 15000 });
    if (!Array.isArray(response?.stepCoach?.lines)) return { error: { code: 'TUTOR_MALFORMED' } };
    return { stepCoach: response.stepCoach };
  } catch (error) {
    const code = String(error?.code || 'TUTOR_FAILED').slice(0, 60);
    // The server said no for this account: stop asking this session.
    if (code === 'STEP_COACH_PREMIUM' || code === 'NOT_FOUND' || error?.status === 404) coachStatus = Promise.resolve(false);
    return { error: { code } };
  }
}

/** The whole POST /practice/:id/tutor/step-coach route; backend.js passes its own helpers. */
export async function coachRoute(body, params, { requireProfile, get, put, assertPracticeRow, sanitizeText }) {
  const p = await requireProfile();
  const row = await get('questions', params.id);
  if (!row || row.pid !== p.id) throw Object.assign(new Error('Question not found'), { status: 404 });
  assertPracticeRow(row);
  if (row.discardedAt || row.answered || !row.serverQuestionId) return { stepCoach: null };
  const lines = (Array.isArray(body?.lines) ? body.lines : []).map(l => sanitizeText(l, 400)).filter(Boolean).slice(0, 40);
  if (!lines.length) return { stepCoach: null };
  return coachLines(row, lines, put);
}

/** Ask the server, keep only status and step, and record the shown help on the attempt. */
export async function coachLines(row, lines, put) {
  const outcome = await requestStepCoach({ context: 'practice', serverQuestionId: String(row.serverQuestionId), lines });
  const rows = outcome?.stepCoach?.lines;
  if (!Array.isArray(rows) || rows.length !== lines.length || outcome.stepCoach.unchecked) return { stepCoach: null, code: outcome?.error?.code || null };
  const clean = rows.map(r => {
    const status = ['ok', 'break', 'unsure', 'final'].includes(r?.status) ? r.status : 'unsure';
    return status === 'ok' && Number.isInteger(r.step) && r.step > 0 && r.step < 100 ? { status, step: r.step } : { status };
  });
  const shown = clean.map((r, i) => ({ i, s: r.status })).filter(r => r.s === 'ok' || r.s === 'break');
  if (shown.length) {
    const env = row.assistance && typeof row.assistance === 'object' ? row.assistance : {};
    const coach = env.stepCoach && typeof env.stepCoach === 'object' ? env.stepCoach : { reads: 0, breaks: [], ticks: [] };
    coach.reads = (Number(coach.reads) || 0) + 1;
    for (const { i, s } of shown) {
      const list = s === 'break' ? (coach.breaks ||= []) : (coach.ticks ||= []);
      if (!list.includes(i) && list.length < 40) list.push(i);
    }
    coach.level = coach.breaks?.length ? 'A1' : 'A0-verify';
    coach.initiatedBy = 'system';
    coach.revealedNextStep = false;
    coach.revealedFinalAnswer = false;
    row.assistance = { ...env, stepCoach: coach };
    await put('questions', row);
  }
  return { stepCoach: { lines: clean, checksLeft: Number.isInteger(outcome.stepCoach.checksLeft) ? outcome.stepCoach.checksLeft : null } };
}
