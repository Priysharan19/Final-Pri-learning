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

const DAY = 24 * 60 * 60 * 1000;
export const AI_KINDS = Object.freeze(['handwriting', 'working']);
export const AI_ALLOWANCE_DEFAULTS = Object.freeze({ free: 40, premium: 400 });

function positive(raw, fallback) {
  const n = Number(String(raw ?? '').trim());
  return Number.isSafeInteger(n) && n > 0 && n <= 100_000 ? n : fallback;
}

/** Daily calls per kind for free and Premium accounts (deployment-tunable). */
export function aiAllowance(env = process.env) {
  return Object.freeze({
    free: positive(env.PRI_AI_DAILY_FREE, AI_ALLOWANCE_DEFAULTS.free),
    premium: positive(env.PRI_AI_DAILY_PREMIUM, AI_ALLOWANCE_DEFAULTS.premium)
  });
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
  const verdict = await consumeRateLimit(db, `ai-daily:${kind}:${sha256(String(accountId)).slice(0, 24)}`, { limit, windowMs: DAY }, now);
  return { ...verdict, limit, plan: premium ? 'premium' : 'free' };
}

export function refuseAiAllowance(res, verdict) {
  res.set('RateLimit-Remaining', '0');
  res.set('RateLimit-Reset', String(Math.ceil(verdict.resetAt / 1000)));
  res.set('Retry-After', String(Math.max(1, Math.ceil((verdict.resetAt - Date.now()) / 1000))));
  return res.status(429).json({
    error: {
      code: 'AI_ALLOWANCE_EXHAUSTED',
      message: verdict.plan === 'premium'
        ? 'Today’s cloud reading allowance is used up. On-device reading keeps working.'
        : 'Today’s free cloud reading allowance is used up. On-device reading keeps working; Premium includes more.',
      plan: verdict.plan,
      limit: verdict.limit,
      resetAt: verdict.resetAt
    }
  });
}
