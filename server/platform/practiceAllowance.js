// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the free plan's daily MARKING allowance, enforced where a
// practice answer is marked (#537, re-scoped by the notebook/paywall split)
//
// Practice is unlimited on the free plan: every question is issued. What the
// free plan rations is examiner marking — 5 marked scripts a day — decided
// here, per ACCOUNT, from the server's own entitlement record
// (entitlement_snapshots, written only by verified billing events and support
// grants). A modified client, a second device or a cleared IndexedDB changes
// nothing; nothing the device sends is read here. Premium's
// `unlimited-marking` lifts it.
//
// THE DAY is the Indian calendar day — Asia/Kolkata, UTC+05:30, no daylight
// saving. A fixed offset, not Intl: deterministic on every runtime, and the
// instant the allowance lifts is exactly local midnight.
//
// A SCRIPT is one question marked by the deterministic engine. The day's
// count is one row per account and day in idempotency_keys (scope
// 'marking-daily', key the day) holding the question ids marked that day,
// written in the SAME transaction as the mark it counts, under the account's
// sync lock. So:
//   · the second try on a question already counted today is not counted again
//     and is never refused;
//   · a replayed submission returns its stored reply and counts nothing;
//   · an unreadable entry (no try spent, nothing written) counts nothing;
//   · a refusal is decided BEFORE the marker runs and writes nothing.
// Rush, Match and the placement check are not counted (CAPPED_PRACTICE_MODES).
// ─────────────────────────────────────────────────────────────────────────────
import { CAPPED_PRACTICE_MODES, FREE_MARKING_ALLOWANCE } from '../../client/src/engine/practiceAllowance.js';
import { serverEntitlementCapabilities } from './entitlements.js';
import { asStore } from './store.js';

export const PRACTICE_DAY_TIME_ZONE = FREE_MARKING_ALLOWANCE.timeZone;
export const MARKING_DAILY_SCOPE = 'marking-daily';
const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
// A day's counter outlives its day by one more, so a student's "used today" can
// still be read by a late replay; housekeeping then purges it with every other
// expired idempotency row.
const COUNTER_TTL_MS = DAY_MS;

const pad = n => String(n).padStart(2, '0');

/** The Indian calendar day `now` falls in: its key and its exact bounds. */
export function practiceDay(now = Date.now()) {
  const start = Math.floor((now + IST_OFFSET_MS) / DAY_MS) * DAY_MS - IST_OFFSET_MS;
  const local = new Date(start + IST_OFFSET_MS);
  return {
    key: `${local.getUTCFullYear()}-${pad(local.getUTCMonth() + 1)}-${pad(local.getUTCDate())}`,
    start,
    end: start + DAY_MS,
    timeZone: PRACTICE_DAY_TIME_ZONE
  };
}

function parse(raw) {
  const text = String(raw ?? '').trim();
  if (!text) return { set: false, value: null };
  const n = Number(text);
  return { set: true, value: Number.isSafeInteger(n) && n > 0 && n <= 100_000 ? n : null };
}

/** Configuration mistakes production must not boot with (config.js). */
export function practiceAllowanceConfigProblems(env = process.env) {
  const free = parse(env.PRI_FREE_MARKED_PER_DAY);
  return free.set && free.value === null ? ['PRI_FREE_MARKED_PER_DAY (a positive integer up to 100000)'] : [];
}

/** Marked scripts a free account may have per day (deployment-tunable). */
export function freeMarkedPerDay(env = process.env) {
  return parse(env.PRI_FREE_MARKED_PER_DAY).value ?? FREE_MARKING_ALLOWANCE.scriptsPerDay;
}

/** Whether marking an answer issued in `mode` counts toward (and is refused by) the allowance. */
export const practiceModeCounted = mode => CAPPED_PRACTICE_MODES.includes(mode);

function markedOf(row) {
  if (!row) return [];
  try {
    const list = JSON.parse(row.response_json).marked;
    return Array.isArray(list) ? list.filter(id => typeof id === 'string') : [];
  } catch { return []; }
}

const COUNTER = 'SELECT response_json FROM idempotency_keys WHERE account_id=? AND scope=? AND key=?';

/**
 * Read only: whether this account may have question `questionId` marked at
 * `now`. Decided from the server's entitlement record and the server's own
 * count. Call it inside the commit transaction (account scope, under the
 * account's sync lock) so the verdict and the count it leads to cannot be split
 * by a concurrent submission from another device; it may also be called before
 * marking as a forecast, so a refused script never costs a marker run.
 */
export async function markingAllowanceVerdict(db, { accountId, questionId, now = Date.now(), env = process.env }) {
  db = asStore(db);
  const day = practiceDay(now);
  // One statement: the entitlement record and today's count together.
  const row = await db.get(`SELECT s.plan AS plan, s.status AS status, s.current_period_end AS current_period_end, s.grace_until AS grace_until,
      (SELECT k.response_json FROM idempotency_keys k WHERE k.account_id=? AND k.scope=? AND k.key=?) AS response_json
    FROM (SELECT 1 AS one) base LEFT JOIN entitlement_snapshots s ON s.account_id=?`, [accountId, MARKING_DAILY_SCOPE, day.key, accountId]);
  const premium = serverEntitlementCapabilities(row?.plan ? row : null, now).includes('unlimited-marking');
  const marked = markedOf(row?.response_json ? row : null);
  const base = { used: marked.length, resetsAt: day.end, timeZone: day.timeZone, day: day.key, marked };
  if (premium) return { ...base, allowed: true, plan: 'premium', unlimited: true, limit: null, counted: false };
  const limit = freeMarkedPerDay(env);
  const already = marked.includes(questionId);
  return { ...base, allowed: already || marked.length < limit, plan: 'free', unlimited: false, limit, counted: already };
}

/**
 * Count question `questionId` as one of today's marked scripts for a free
 * account. In the same transaction as the mark it counts, after every replay
 * check has returned. Idempotent per question and day. `verdict` is the
 * decision this transaction already read (markingAllowanceVerdict), so the
 * count is not read twice; without it the count is read here. Returns the
 * day's count.
 */
export async function recordMarkedScript(db, { accountId, questionId, now = Date.now(), verdict = null }) {
  db = asStore(db);
  const day = practiceDay(now);
  if (verdict && (verdict.unlimited || verdict.day !== day.key)) {
    if (verdict.unlimited) return verdict.used;
    verdict = null;
  }
  const marked = verdict ? [...verdict.marked] : markedOf(await db.get(COUNTER, [accountId, MARKING_DAILY_SCOPE, day.key]));
  if (marked.includes(questionId)) return marked.length;
  marked.push(questionId);
  await db.run(`INSERT INTO idempotency_keys(account_id,scope,key,response_json,request_digest,created_at,expires_at) VALUES (?,?,?,?,?,?,?)
    ON CONFLICT(account_id,scope,key) DO UPDATE SET response_json=excluded.response_json`,
  [accountId, MARKING_DAILY_SCOPE, day.key, JSON.stringify({ marked }), 'marking-daily', now, day.end + COUNTER_TTL_MS]);
  return marked.length;
}

/**
 * The refusal, in the code the device's own gate uses (402 FREE_CAP_REACHED,
 * local/entitlementGate.js) so the same paywall applies, plus RFC 9110
 * Retry-After at the day's end. Nothing about the answer is disclosed: the
 * refusal is decided before marking and is the same whatever was written.
 */
export function refuseMarkingCap(res, verdict, now = Date.now()) {
  res.set('Retry-After', String(Math.max(1, Math.ceil((verdict.resetsAt - now) / 1000))));
  res.set('RateLimit-Remaining', '0');
  res.set('RateLimit-Reset', String(Math.ceil(verdict.resetsAt / 1000)));
  res.set('Cache-Control', 'no-store');
  return res.status(402).json({
    error: {
      code: 'FREE_CAP_REACHED',
      message: `You have used today's ${verdict.limit} free marked answers. Practice stays unlimited and your work is kept on this device; marking resets at midnight (${verdict.timeZone}), and Premium removes the daily limit.`,
      capability: 'unlimited-marking',
      plan: 'free',
      used: verdict.used,
      limit: verdict.limit,
      resetAt: verdict.resetsAt,
      timeZone: verdict.timeZone,
      retryable: true,
      window: 'day'
    }
  });
}
