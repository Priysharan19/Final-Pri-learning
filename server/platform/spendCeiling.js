// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · a ceiling on what the paid reader can cost in a day
//
// Two routes call a metered third party: /v1/handwriting/transcribe and
// /v1/working/check. Both are rate limited per account — 240 and 120 an hour —
// and that is the wrong unit for the thing that actually hurts. Per-account
// limits bound one student. They do not bound the bill.
//
// A thousand accounts at those limits is 360,000 paid calls an hour. Nobody
// running this is watching a dashboard at three in the morning, and the first
// sign of trouble would be an invoice. So there is a second limit here, counted
// across the whole deployment rather than per student, and the two routes share
// it because they share one API key and one bill.
//
// It is required whenever a key is configured, with no default. A default is a
// number somebody else guessed about somebody else's budget: too low and the
// feature dies quietly under load, too high and it is not a ceiling. Neither
// failure shows up in a response, which is the same argument the proxy-hops
// setting makes, so the server refuses to start rather than guess.
//
// When the ceiling is reached the route refuses. That is safe by construction:
// the client publishes its on-device reading first and always, and treats a
// refusal as "carry on with the local reading" — so a student meets a slightly
// worse reader, not a broken app.
// ─────────────────────────────────────────────────────────────────────────────
import { consumeRateLimit } from './security.js';

/** One budget for both routes: one key, one bill. */
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
export function consumePaidCall(db, { env = process.env, now = Date.now() } = {}) {
  const ceiling = spendCeiling(env);
  if (!ceiling.required) return null;

  // Unconfigured is not unlimited. assertPlatformConfig refuses to boot without
  // these, so arriving here without them means something is wrong, and refusing
  // to spend is the only safe reading of that.
  if (ceiling.perHour === null || ceiling.perDay === null) {
    return { status: 503, code: 'PAID_CAPACITY_NOT_CONFIGURED', message: 'Server reading is unavailable on this deployment.' };
  }

  const hour = consumeRateLimit(db, `${PAID_BUDGET}:hour`, { limit: ceiling.perHour, windowMs: 60 * 60 * 1000 }, now);
  if (!hour.allowed) return spent(hour.resetAt);
  const day = consumeRateLimit(db, `${PAID_BUDGET}:day`, { limit: ceiling.perDay, windowMs: 24 * 60 * 60 * 1000 }, now);
  if (!day.allowed) return spent(day.resetAt);
  return null;
}

function spent(resetAt) {
  return {
    // 503 rather than 429: this is not the student asking too often, and telling
    // them to slow down would be a lie. The deployment is out of capacity.
    status: 503,
    code: 'PAID_CAPACITY_REACHED',
    message: "Server reading has reached this service's limit for now. Your work is still being read on your device.",
    retryable: true,
    resetAt
  };
}

/** Send a refusal in the shape both paid routes already use. */
export function refusePaidCall(res, verdict) {
  if (verdict.resetAt) res.set('RateLimit-Reset', String(Math.ceil(verdict.resetAt / 1000)));
  const error = { code: verdict.code, message: verdict.message };
  if (verdict.retryable) error.retryable = true;
  return res.status(verdict.status).json({ error });
}
