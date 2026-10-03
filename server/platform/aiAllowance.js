// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · paid AI allowance (SEC-COMM-01)
//
// Cloud handwriting reading and working checks are the server operations that
// cost money per call. Each signed-in account gets a daily allowance per kind,
// decided ONLY from the server's own entitlement record (entitlement_snapshots,
// written by verified billing events and support grants). Premium's
// `additional-ai-usage` capability raises the allowance. Nothing the device
// sends — a plan label, a cached snapshot in IndexedDB, a header — is read here.
//
// This sits in front of the deployment-wide spend ceiling (spendCeiling.js):
// the ceiling protects the deployment, the allowance stops one account (or one
// tampered device) from spending everyone's capacity.
// ─────────────────────────────────────────────────────────────────────────────
import { serverEntitlementCapabilities } from './entitlements.js';
import { consumeRateLimit, sha256 } from './security.js';
import { asStore } from './store.js';

// A rolling 24-hour window per account and kind. Housekeeping purges
// rate_limits rows older than 24 hours (housekeeping.js
// RATE_BUCKET_MAX_WINDOW_MS); a longer window here would need that raised too.
export const AI_WINDOW_MS = 24 * 60 * 60 * 1000;
export const AI_KINDS = Object.freeze(['handwriting', 'working', 'question-photo']);
// The unit is one REQUEST (one reading of the ink when the writing settles, or
// one working check), not one provider call: a request that escalates to the
// fallback model still costs one unit. The free figure leaves room for the
// 20 free practice questions a day with several readings each.
export const AI_ALLOWANCE_DEFAULTS = Object.freeze({ free: 120, premium: 1200 });

function parse(raw) {
  const text = String(raw ?? '').trim();
  if (!text) return { set: false, value: null };
  const n = Number(text);
  return { set: true, value: Number.isSafeInteger(n) && n > 0 && n <= 100_000 ? n : null };
}

/** Configuration mistakes production must not boot with (config.js). */
export function aiAllowanceConfigProblems(env = process.env) {
  const problems = [];
  const free = parse(env.PRI_AI_DAILY_FREE);
  const premium = parse(env.PRI_AI_DAILY_PREMIUM);
  if (free.set && free.value === null) problems.push('PRI_AI_DAILY_FREE (a positive integer up to 100000)');
  if (premium.set && premium.value === null) problems.push('PRI_AI_DAILY_PREMIUM (a positive integer up to 100000)');
  const f = free.value ?? AI_ALLOWANCE_DEFAULTS.free;
  const p = premium.value ?? AI_ALLOWANCE_DEFAULTS.premium;
  if (f > p) problems.push('PRI_AI_DAILY_PREMIUM (must not be below PRI_AI_DAILY_FREE)');
  return problems;
}

/** Daily requests per kind for free and Premium accounts (deployment-tunable).
 * Premium is never below free, whatever the configuration says. */
export function aiAllowance(env = process.env) {
  const free = parse(env.PRI_AI_DAILY_FREE).value ?? AI_ALLOWANCE_DEFAULTS.free;
  const premium = parse(env.PRI_AI_DAILY_PREMIUM).value ?? AI_ALLOWANCE_DEFAULTS.premium;
  return Object.freeze({ free, premium: Math.max(premium, free) });
}

/**
 * Consume one call of `kind` for `accountId`. Returns the verdict; the caller
 * refuses the request when `allowed` is false. Counted after the request has
 * been validated and before anything is sent to the provider.
 */
export async function consumeAiAllowance(db, { accountId, kind, env = process.env, now = Date.now() }) {
  if (!AI_KINDS.includes(kind)) throw new Error(`unknown AI allowance kind ${kind}`);
  db = asStore(db);
  const snapshot = await db.get('SELECT plan,status,current_period_end,grace_until FROM entitlement_snapshots WHERE account_id=?', [accountId]);
  const premium = serverEntitlementCapabilities(snapshot, now).includes('additional-ai-usage');
  const limits = aiAllowance(env);
  const limit = premium ? limits.premium : limits.free;
  const bucket = `ai-daily:${kind}:${sha256(String(accountId)).slice(0, 24)}`;
  const verdict = await consumeRateLimit(db, bucket, { limit, windowMs: AI_WINDOW_MS }, now);
  return { ...verdict, limit, plan: premium ? 'premium' : 'free', bucket, windowStart: verdict.resetAt - AI_WINDOW_MS };
}

/**
 * Give the unit back when the request delivered nothing and cost nothing: the
 * deployment ceiling refused it, or the provider is not configured. Only within
 * the same window, never below zero.
 */
export async function refundAiAllowance(db, verdict) {
  if (!verdict?.allowed || !verdict.bucket) return;
  await asStore(db).run('UPDATE rate_limits SET count = count - 1 WHERE bucket = ? AND window_start = ? AND count > 0', [verdict.bucket, verdict.windowStart]);
}

export function refuseAiAllowance(res, verdict) {
  res.set('RateLimit-Remaining', '0');
  res.set('RateLimit-Reset', String(Math.ceil(verdict.resetAt / 1000)));
  res.set('Retry-After', String(Math.max(1, Math.ceil((verdict.resetAt - Date.now()) / 1000))));
  return res.status(429).json({
    error: {
      code: 'AI_ALLOWANCE_EXHAUSTED',
      message: verdict.plan === 'premium'
        ? 'The daily cloud reading allowance is used up; it resets within 24 hours. On-device handwriting reading keeps working.'
        : 'The free daily cloud reading allowance is used up; it resets within 24 hours. On-device handwriting reading keeps working, and Premium includes more.',
      plan: verdict.plan,
      limit: verdict.limit,
      resetAt: verdict.resetAt
    }
  });
}
