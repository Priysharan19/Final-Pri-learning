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
// The unit is one REQUEST the student asked for (one "read my writing" of the
// page or of a photo of it, one "Practise this" photo, one working check), not
// one provider call: a request that escalates to the fallback model still
// costs one unit, and a kept or in-flight read reused by Submit costs nothing
// (recognitionOps.js). The deployment-wide paid-call ceiling counts provider
// calls and is unchanged (D21: 120 an hour, 300 a day, spendCeiling.js).
//
// Owner default D20 (docs/release/V1_DECISIONS_2026-11-01.md): handwriting and
// photo reads are Free 5 a day and Premium 25 a day, PER KIND. They are
// modelled defaults, to be revisited after real cost data, so each is
// configurable. "Handwriting" is every read of the student's own writing —
// ink, or a photo of written working, both read by /v1/handwriting/transcribe.
// "Photo" is the "Practise this" photo of a printed question
// (/v1/question-photo). The working check is not a read and is not named by
// D20; it keeps the allowance it had.
export const AI_ALLOWANCE_DEFAULTS = Object.freeze({
  handwriting: Object.freeze({ free: 5, premium: 25 }),
  'question-photo': Object.freeze({ free: 5, premium: 25 }),
  working: Object.freeze({ free: 120, premium: 1200 })
});
// Per-kind configuration. The older PRI_AI_DAILY_FREE / PRI_AI_DAILY_PREMIUM
// still apply to every kind a per-kind variable does not set, so a deployment
// (or a test suite) that raised them keeps what it set.
const KIND_ENV = Object.freeze({ handwriting: 'HANDWRITING', 'question-photo': 'PHOTO', working: 'WORKING' });
export const AI_ALLOWANCE_ENV = Object.freeze(Object.fromEntries(AI_KINDS.map(kind => [kind, Object.freeze({
  free: `PRI_AI_DAILY_FREE_${KIND_ENV[kind]}`, premium: `PRI_AI_DAILY_PREMIUM_${KIND_ENV[kind]}`
})])));

function parse(raw) {
  const text = String(raw ?? '').trim();
  if (!text) return { set: false, value: null };
  const n = Number(text);
  return { set: true, value: Number.isSafeInteger(n) && n > 0 && n <= 100_000 ? n : null };
}

function configured(env, kind) {
  const names = AI_ALLOWANCE_ENV[kind];
  const free = parse(env[names.free]).value ?? parse(env.PRI_AI_DAILY_FREE).value ?? AI_ALLOWANCE_DEFAULTS[kind].free;
  const premium = parse(env[names.premium]).value ?? parse(env.PRI_AI_DAILY_PREMIUM).value ?? AI_ALLOWANCE_DEFAULTS[kind].premium;
  return { free, premium };
}

/** Configuration mistakes production must not boot with (config.js). */
export function aiAllowanceConfigProblems(env = process.env) {
  const problems = [];
  const names = ['PRI_AI_DAILY_FREE', 'PRI_AI_DAILY_PREMIUM', ...AI_KINDS.flatMap(kind => [AI_ALLOWANCE_ENV[kind].free, AI_ALLOWANCE_ENV[kind].premium])];
  for (const name of names) {
    const v = parse(env[name]);
    if (v.set && v.value === null) problems.push(`${name} (a positive integer up to 100000)`);
  }
  if (problems.length) return problems;
  for (const kind of AI_KINDS) {
    const { free, premium } = configured(env, kind);
    if (free > premium) problems.push(`${AI_ALLOWANCE_ENV[kind].premium} (must not be below the free ${kind} allowance)`);
  }
  return problems;
}

/** Daily requests of `kind` for free and Premium accounts (deployment-tunable).
 * Premium is never below free, whatever the configuration says. */
export function aiAllowance(env = process.env, kind = 'handwriting') {
  if (!AI_KINDS.includes(kind)) throw new Error(`unknown AI allowance kind ${kind}`);
  const { free, premium } = configured(env, kind);
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
  const limits = aiAllowance(env, kind);
  const limit = premium ? limits.premium : limits.free;
  const bucket = `ai-daily:${kind}:${sha256(String(accountId)).slice(0, 24)}`;
  const verdict = await consumeRateLimit(db, bucket, { limit, windowMs: AI_WINDOW_MS }, now);
  return { ...verdict, kind, limit, premiumLimit: limits.premium, plan: premium ? 'premium' : 'free', bucket, windowStart: verdict.resetAt - AI_WINDOW_MS };
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

const WHAT = Object.freeze({ handwriting: 'readings of your writing', 'question-photo': 'question photos', working: 'working checks' });

export function refuseAiAllowance(res, verdict) {
  res.set('RateLimit-Remaining', '0');
  res.set('RateLimit-Reset', String(Math.ceil(verdict.resetAt / 1000)));
  res.set('Retry-After', String(Math.max(1, Math.ceil((verdict.resetAt - Date.now()) / 1000))));
  const what = WHAT[verdict.kind] || 'cloud readings';
  // Honest copy: there is no on-device reader on the shipped path (D16), so
  // the alternative named is typing the answer, which is never limited.
  const more = verdict.plan === 'free' && Number(verdict.premiumLimit) > Number(verdict.limit)
    ? ` Premium includes ${verdict.premiumLimit} a day.` : '';
  return res.status(429).json({
    error: {
      code: 'AI_ALLOWANCE_EXHAUSTED',
      message: `You have used today's ${verdict.limit} ${what}. They come back within 24 hours; you can type your answer meanwhile.${more}`,
      plan: verdict.plan,
      kind: verdict.kind || null,
      limit: verdict.limit,
      resetAt: verdict.resetAt,
      // Machine-readable, like the deployment ceiling's refusal: the request
      // will succeed again at resetAt; the window is this account's rolling day.
      retryable: true,
      window: 'day'
    }
  });
}
