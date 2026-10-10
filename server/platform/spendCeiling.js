// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · a ceiling on what the paid reader can cost in a day
//
// Three routes call a metered third party: /v1/handwriting/transcribe,
// /v1/working/check and /v1/tutor/help (one unit per model call, a guarded
// regeneration included; a cached tutor reply costs nothing). Each is rate
// limited per account — 240, 120 and 60 an hour — and that is the wrong unit
// for the thing that actually hurts. Per-account
// limits bound one student. They do not bound the bill.
//
// A thousand accounts at those limits is 360,000 paid calls an hour. Nobody
// running this is watching a dashboard at three in the morning, and the first
// sign of trouble would be an invoice. So there is a second limit here, counted
// across the whole deployment rather than per student, and the routes share it
// because they share one API key and one bill.
//
// It is required whenever a key is configured, with no default. A default is a
// number somebody else guessed about somebody else's budget: too low and the
// feature dies quietly under load, too high and it is not a ceiling. Neither
// failure shows up in a response, which is the same argument the proxy-hops
// setting makes, so the server refuses to start rather than guess.
//
// When the ceiling is reached the route refuses, before anything is sent to
// the provider and before anything is marked. Reading is online-only, so the
// student's page is then NOT read: the client says so, names when the limit
// lifts, stops re-sending until then, and leaves typing the answer open.
// ─────────────────────────────────────────────────────────────────────────────
import { consumeRateLimit } from './security.js';
import { asStore } from './store.js';

/** One budget for every paid route: one key, one bill. */
export const PAID_BUDGET = 'paid-provider';

const positiveInt = (value) => {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
};

/**
 * The ceiling for this deployment, or nulls when no paid provider is configured
 * and there is therefore nothing to spend.
 */
export function spendCeiling(env = process.env) {
  const configured = String(env.PRI_HANDWRITING_API_KEY || '').trim().length > 0;
  return Object.freeze({
    required: configured,
    perHour: positiveInt(env.PRI_PAID_CALLS_PER_HOUR),
    perDay: positiveInt(env.PRI_PAID_CALLS_PER_DAY)
  });
}

/** What is missing before this deployment may spend money. */
export function spendCeilingMissing(env = process.env) {
  const ceiling = spendCeiling(env);
  if (!ceiling.required) return [];
  const missing = [];
  if (ceiling.perHour === null) missing.push('PRI_PAID_CALLS_PER_HOUR');
  if (ceiling.perDay === null) missing.push('PRI_PAID_CALLS_PER_DAY');
  return missing;
}

/**
 * Spend one paid call, or say why not.
 *
 * A function rather than middleware, and called from inside the handler AFTER
 * the body has been validated, because middleware runs before a route can tell
 * a real request from a malformed one — and a request that was never going to
 * reach the provider must not spend from a budget shared by every student.
 *
 * Returns null when the call may proceed.
 */
export async function consumePaidCall(db, options = {}) {
  return (await reservePaidCall(db, options)).verdict;
}

const WINDOWS = Object.freeze({ hour: 60 * 60 * 1000, day: 24 * 60 * 60 * 1000 });

/**
 * consumePaidCall, and what was taken: `{ verdict, units }`. `verdict` is null
 * when the call may proceed; `units` names the window rows that were counted,
 * so refundPaidCall can give back exactly that unit and no other.
 *
 * A refusal counts nothing in EITHER window. The day window is checked after
 * the hour window has been counted, so a day refusal takes the hour's unit
 * back inside the same transaction; otherwise every refused request would
 * still fill the hourly window, and a deployment whose day had just reset
 * could stay closed for up to an hour on refusals alone.
 */
export async function reservePaidCall(db, { env = process.env, now = Date.now() } = {}) {
  const ceiling = spendCeiling(env);
  if (!ceiling.required) return { verdict: null, units: [] };

  // Unconfigured is not unlimited. assertPlatformConfig refuses to boot without
  // these, so arriving here without them means something is wrong, and refusing
  // to spend is the only safe reading of that.
  if (ceiling.perHour === null || ceiling.perDay === null) {
    return { verdict: { status: 503, code: 'PAID_CAPACITY_NOT_CONFIGURED', message: 'Server reading is unavailable on this deployment.' }, units: [] };
  }

  // Both buckets in one transaction, as when this ran synchronously: two
  // concurrent calls can never both take the last unit of either budget.
  const store = asStore(db);
  return store.transaction(async () => {
    const hourBucket = `${PAID_BUDGET}:hour`;
    const dayBucket = `${PAID_BUDGET}:day`;
    const hour = await consumeRateLimit(store, hourBucket, { limit: ceiling.perHour, windowMs: WINDOWS.hour }, now);
    if (!hour.allowed) return { verdict: { ...spent(hour.resetAt), window: 'hour' }, units: [] };
    const hourUnit = { bucket: hourBucket, windowStart: hour.resetAt - WINDOWS.hour };
    const day = await consumeRateLimit(store, dayBucket, { limit: ceiling.perDay, windowMs: WINDOWS.day }, now);
    if (!day.allowed) {
      await giveBack(store, hourUnit);
      return { verdict: { ...spent(day.resetAt), window: 'day' }, units: [] };
    }
    return { verdict: null, units: [hourUnit, { bucket: dayBucket, windowStart: day.resetAt - WINDOWS.day }] };
  });
}

function giveBack(store, unit) {
  // Only inside the window the unit was counted in, and never below zero.
  return store.run('UPDATE rate_limits SET count = count - 1 WHERE bucket = ? AND window_start = ? AND count > 0', [unit.bucket, unit.windowStart]);
}

/**
 * Give one reserved unit back. For the callers that can prove the provider was
 * sent nothing (docs/operations/recognition-cost.md §4) — never for a timeout
 * or a provider error, where the provider may have done billable work.
 */
export async function refundPaidCall(db, reservation) {
  if (!reservation?.units?.length) return;
  const store = asStore(db);
  await store.transaction(async () => {
    for (const unit of reservation.units) await giveBack(store, unit);
  });
}

function spent(resetAt) {
  return {
    // 503 rather than 429: this is not the student asking too often, and telling
    // them to slow down would be a lie. The deployment is out of capacity.
    status: 503,
    code: 'PAID_CAPACITY_REACHED',
    // Reading and marking are online-only: nothing is read on the device, so
    // this must not say so. The work is not lost; it is not read until the
    // limit lifts (resetAt, also sent as RateLimit-Reset).
    message: 'Handwriting and photo checking has reached its usage limit for now. Your work has not been read or marked; type your answer, or try again when the limit resets.',
    retryable: true,
    resetAt
  };
}

/** Send a refusal in the shape both paid routes already use. */
export function refusePaidCall(res, verdict) {
  if (verdict.resetAt) res.set('RateLimit-Reset', String(Math.ceil(verdict.resetAt / 1000)));
  const error = { code: verdict.code, message: verdict.message };
  if (verdict.retryable) error.retryable = true;
  // Machine-readable: when capacity returns (epoch ms) and which window is full.
  if (verdict.resetAt) error.resetAt = verdict.resetAt;
  if (verdict.window) error.window = verdict.window;
  return res.status(verdict.status).json({ error });
}
