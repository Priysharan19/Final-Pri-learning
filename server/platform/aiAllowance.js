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
import { READ_ALLOWANCE } from '../../client/src/engine/practiceAllowance.js';

// A rolling 24-hour window per account and kind. Housekeeping purges
// rate_limits rows older than 24 hours (housekeeping.js
// RATE_BUCKET_MAX_WINDOW_MS); a longer window here would need that raised too.
export const AI_WINDOW_MS = 24 * 60 * 60 * 1000;
export const AI_KINDS = Object.freeze(['handwriting', 'working', 'question-photo']);
// Handwriting (the `handwriting` kind): the unit is one ANSWER, not one read
// (owner decision, 18 November 2026). The first paid read of an issued
// question's answer in the day spends the unit; re-reads of the same answer
// are free, up to ANSWER_READ_CAP, counted by the server on the server-issued
// question id (see chargeForRead). A read with no valid issued id is one unit.
// For the other kinds, the unit is one REQUEST the student asked for (one "read my writing" of the
// page or of a photo of it, one "Practise this" photo, one working check), not
// one provider call: a request that escalates to the fallback model still
// costs one unit, and a kept or in-flight read reused by Submit costs nothing
// (recognitionOps.js). The deployment-wide paid-call ceiling counts provider
// calls and is unchanged (D21: 120 an hour, 300 a day, spendCeiling.js).
//
// Owner decision 2026-11-18 (docs/product/packaging-2026-11.md, packaging
// value-2026-11; it replaced owner default D20's 5 / 25): handwriting and photo
// reads are Free 5 a day and Premium 50 a day, PER KIND. The figures follow
// the measured cost (docs/operations/recognition-cost.md), and each is
// configurable. "Handwriting" is every read of the student's own writing —
// ink, or a photo of written working, both read by /v1/handwriting/transcribe.
// "Photo" is the "Practise this" photo of a printed question
// (/v1/question-photo). The working check is not a read and is not named by
// the packaging; it keeps the allowance it had.
export const AI_ALLOWANCE_DEFAULTS = Object.freeze({
  handwriting: Object.freeze({ free: READ_ALLOWANCE.free, premium: READ_ALLOWANCE.premium }),
  'question-photo': Object.freeze({ free: READ_ALLOWANCE.free, premium: READ_ALLOWANCE.premium }),
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

const WHAT = Object.freeze({ handwriting: 'handwritten answers', 'question-photo': 'question photos', working: 'working checks' });

/** "in about 23 hours" / "in about 40 minutes": how long until a window renews. */
export function renewsIn(resetAt, now = Date.now()) {
  const ms = Math.max(0, Number(resetAt) - now);
  const minutes = Math.max(1, Math.ceil(ms / 60_000));
  if (minutes < 60) return `in about ${minutes} minute${minutes === 1 ? '' : 's'}`;
  const hours = Math.round(ms / 3_600_000);
  return `in about ${hours} hour${hours === 1 ? '' : 's'}`;
}

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
      // The server does not know the student's timezone, so it says how long
      // (never a bare clock time that could read as "already passed").
      message: `You have used today's ${verdict.limit} ${what}. They renew ${renewsIn(verdict.resetAt)}; you can type your answer meanwhile.${more}`,
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

/** The most paid reads of ONE answer (one issued question) in the rolling day.
 * The client's own AUTO_READ_MAX (12) is a courtesy; this is the enforcement. */
export const ANSWER_READ_CAP = 12;

/**
 * Charge a handwriting read. `answerKey` is the id of a question the SERVER
 * issued to this account (the route verifies that before passing it; it is
 * never a free-form client value). With one, the first paid read of that
 * answer in the window spends a unit and re-reads are free up to
 * ANSWER_READ_CAP; past the cap the read is refused (`cap`). Without one it is
 * one unit per read, as before. Returns the allowance verdict (allowed, or
 * the refusal) plus `charged` (a unit was spent) and a `counter` to undo.
 */
export async function chargeForRead(db, { accountId, answerKey = null, env = process.env, now = Date.now() }) {
  db = asStore(db);
  if (!answerKey) {
    const unit = await consumeAiAllowance(db, { accountId, kind: 'handwriting', env, now });
    return { ...unit, charged: unit.allowed, counter: null };
  }
  const counter = { bucket: `hw-answer:${sha256(`${accountId}:${answerKey}`).slice(0, 32)}`, windowStart: null };
  const seen = await consumeRateLimit(db, counter.bucket, { limit: ANSWER_READ_CAP, windowMs: AI_WINDOW_MS }, now);
  if (!seen.allowed) return { allowed: false, cap: true, kind: 'handwriting', resetAt: seen.resetAt, charged: false, counter: null };
  counter.windowStart = seen.resetAt - AI_WINDOW_MS;
  // The first read in this answer's window is the one that costs a unit.
  const first = seen.remaining === ANSWER_READ_CAP - 1;
  if (!first) return { allowed: true, free: true, kind: 'handwriting', charged: false, counter, bucket: null };
  const unit = await consumeAiAllowance(db, { accountId, kind: 'handwriting', env, now });
  if (!unit.allowed) {
    await asStore(db).run('UPDATE rate_limits SET count = count - 1 WHERE bucket = ? AND window_start = ? AND count > 0', [counter.bucket, counter.windowStart]);
    return { ...unit, charged: false, counter: null };
  }
  return { ...unit, charged: true, counter };
}

/** Undo a charge when the read delivered nothing and cost nothing (refund paths). */
export async function refundRead(db, verdict) {
  if (!verdict) return;
  if (verdict.charged) await refundAiAllowance(db, verdict);
  if (verdict.counter?.windowStart != null) {
    await asStore(db).run('UPDATE rate_limits SET count = count - 1 WHERE bucket = ? AND window_start = ? AND count > 0', [verdict.counter.bucket, verdict.counter.windowStart]);
  }
}
