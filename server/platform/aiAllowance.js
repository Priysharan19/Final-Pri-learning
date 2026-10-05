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
//
// Ledger 1.8 adds one more bound on top of the per-kind allowances: a single
// daily AI BUDGET per account across every paid kind (handwriting, working,
// question photo and the tutor), PRI_AI_DAILY_BUDGET_CALLS. When it is spent
// the route answers 429 AI_DAILY_BUDGET_EXHAUSTED and the client carries on
// with what runs without the provider: the on-device recogniser, the
// deterministic marking engine and the authored hints. Nothing is lost — the
// engine was always the authority — only the server's second reading and the
// tutor's model replies wait for tomorrow.
// ─────────────────────────────────────────────────────────────────────────────
import { serverEntitlementCapabilities } from './entitlements.js';
import { consumeRateLimit, sha256 } from './security.js';
import { asStore } from './store.js';

// A rolling 24-hour window per account and kind. Housekeeping purges
// rate_limits rows older than 24 hours (housekeeping.js
// RATE_BUCKET_MAX_WINDOW_MS); a longer window here would need that raised too.
export const AI_WINDOW_MS = 24 * 60 * 60 * 1000;
export const AI_KINDS = Object.freeze(['handwriting', 'working', 'question-photo']);
/** Every paid kind the daily budget counts; the tutor keeps its own per-kind limit (tutor.js). */
export const AI_BUDGET_KINDS = Object.freeze([...AI_KINDS, 'tutor']);
// The unit is one REQUEST (one reading of the ink when the writing settles, or
// one working check), not one provider call: a request that escalates to the
// fallback model still costs one unit. The free figure leaves room for the
// 20 free practice questions a day with several readings each.
export const AI_ALLOWANCE_DEFAULTS = Object.freeze({ free: 120, premium: 1200 });
// The combined daily budget, in requests across every kind. Above the free
// per-kind allowances added together would make it no bound at all; this is
// high enough that a Premium student working all day meets it rarely, and low
// enough that one runaway device cannot spend a month of budget in a night.
export const AI_DAILY_BUDGET_DEFAULT = 400;
export const AI_DAILY_BUDGET_CODE = 'AI_DAILY_BUDGET_EXHAUSTED';
export const AI_ALLOWANCE_CODE = 'AI_ALLOWANCE_EXHAUSTED';
/** What the student is told, once, honestly: what stops and what carries on. */
export const AI_DAILY_BUDGET_MESSAGE = "Today's AI budget for this account is used up; it resets within 24 hours. Pri keeps marking your work with its built-in engine and on-device reading, and the question's own hints still work.";

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
  const budget = parse(env.PRI_AI_DAILY_BUDGET_CALLS);
  if (budget.set && budget.value === null) problems.push('PRI_AI_DAILY_BUDGET_CALLS (a positive integer up to 100000)');
  return problems;
}

/** The per-account daily budget across every paid kind (deployment-tunable). */
export function aiDailyBudget(env = process.env) {
  return parse(env.PRI_AI_DAILY_BUDGET_CALLS).value ?? AI_DAILY_BUDGET_DEFAULT;
}

function budgetBucket(accountId) {
  return `ai-daily-budget:${sha256(String(accountId)).slice(0, 24)}`;
}

/**
 * Spend one unit of the account's combined daily budget. The tutor calls this
 * directly (its per-kind limit lives in tutor.js); the other paid routes reach
 * it through consumeAiAllowance below.
 */
export async function consumeAiDailyBudget(db, { accountId, env = process.env, now = Date.now() }) {
  const limit = aiDailyBudget(env);
  const bucket = budgetBucket(accountId);
  const verdict = await consumeRateLimit(asStore(db), bucket, { limit, windowMs: AI_WINDOW_MS }, now);
  return { ...verdict, code: verdict.allowed ? null : AI_DAILY_BUDGET_CODE, limit, budgetBucket: bucket, budgetWindowStart: verdict.resetAt - AI_WINDOW_MS };
}

/** Give a budget unit back (same window only, never below zero). */
export async function refundAiDailyBudget(db, verdict) {
  if (!verdict?.allowed || !verdict.budgetBucket) return;
  await asStore(db).run('UPDATE rate_limits SET count = count - 1 WHERE bucket = ? AND window_start = ? AND count > 0', [verdict.budgetBucket, verdict.budgetWindowStart]);
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
  const perKind = { ...verdict, code: verdict.allowed ? null : AI_ALLOWANCE_CODE, limit, plan: premium ? 'premium' : 'free', kind, bucket, windowStart: verdict.resetAt - AI_WINDOW_MS };
  if (!perKind.allowed) return perKind;
  // Then the combined budget. A unit refused here is given back to the
  // per-kind bucket: the request spent nothing.
  const budget = await consumeAiDailyBudget(db, { accountId, env, now });
  if (!budget.allowed) {
    await refundAiAllowance(db, { ...perKind, budgetBucket: null });
    return { ...perKind, allowed: false, remaining: 0, resetAt: budget.resetAt, code: AI_DAILY_BUDGET_CODE, budgetLimit: budget.limit };
  }
  return { ...perKind, budgetBucket: budget.budgetBucket, budgetWindowStart: budget.budgetWindowStart, budgetLimit: budget.limit, budgetRemaining: budget.remaining };
}

/**
 * Give the unit back when the request delivered nothing and cost nothing: the
 * deployment ceiling refused it, or the provider is not configured. Only within
 * the same window, never below zero.
 */
export async function refundAiAllowance(db, verdict) {
  if (!verdict?.allowed) return;
  const store = asStore(db);
  if (verdict.bucket) await store.run('UPDATE rate_limits SET count = count - 1 WHERE bucket = ? AND window_start = ? AND count > 0', [verdict.bucket, verdict.windowStart]);
  await refundAiDailyBudget(store, verdict);
}

export function refuseAiAllowance(res, verdict) {
  res.set('RateLimit-Remaining', '0');
  res.set('RateLimit-Reset', String(Math.ceil(verdict.resetAt / 1000)));
  res.set('Retry-After', String(Math.max(1, Math.ceil((verdict.resetAt - Date.now()) / 1000))));
  if (verdict.code === AI_DAILY_BUDGET_CODE) {
    return res.status(429).json({
      error: {
        code: AI_DAILY_BUDGET_CODE,
        message: AI_DAILY_BUDGET_MESSAGE,
        // What still works without the provider, so a client can say so
        // without guessing: the deterministic engine marks, the on-device
        // recogniser reads, the authored hints help.
        fallback: 'engine-only',
        limit: verdict.budgetLimit ?? verdict.limit,
        resetAt: verdict.resetAt
      }
    });
  }
  return res.status(429).json({
    error: {
      code: AI_ALLOWANCE_CODE,
      message: verdict.plan === 'premium'
        ? 'The daily cloud reading allowance is used up; it resets within 24 hours. On-device handwriting reading keeps working.'
        : 'The free daily cloud reading allowance is used up; it resets within 24 hours. On-device handwriting reading keeps working, and Premium includes more.',
      plan: verdict.plan,
      limit: verdict.limit,
      resetAt: verdict.resetAt
    }
  });
}
