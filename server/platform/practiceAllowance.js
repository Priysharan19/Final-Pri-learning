// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the free plan's daily practice cap, enforced where questions
// are issued (#537)
//
// Since #418 every creditable question is issued by this server, so the cap on
// the free plan — 20 practice questions a day — is decided here, per ACCOUNT,
// from the server's own entitlement record (entitlement_snapshots, written only
// by verified billing events and support grants). A modified client, a second
// device or a cleared IndexedDB changes nothing: the device's counter is a
// courtesy to the student (local/entitlementGate.js), not the limit. Premium's
// `unlimited-practice` lifts it; nothing the device sends is read here.
//
// THE DAY is the calendar day of the deployment's edition (plan H7, ADR-0002):
// Priyabhata counts the Indian day — Asia/Kolkata, UTC+05:30, no daylight
// saving — and Prithagoras the Sydney day, daylight saving included. Each
// matches the device's own gate for that edition's profiles by default
// (local/entitlementGate.js profileTimeZone). Priyabhata's day is computed as
// it always was, from a fixed offset, not Intl: deterministic on every runtime,
// and the instant a cap lifts is exactly local midnight, which is what the
// student is told. A zone with daylight saving has no fixed offset, so its day
// is found with Intl, bounded by its two real local midnights (a 23- or
// 25-hour day when the clocks change).
//
// THE COUNT is one row per account and day in idempotency_keys (scope
// 'practice-daily', key the day), written in the SAME transaction as the
// question it counts, under the account's issue lock. Only a question that is
// actually issued is counted: a replayed issue (same Idempotency-Key, or the
// same account re-binding a prepared question) returns the stored reply and
// counts nothing; a refusal writes nothing and never burns a prepared token.
// Rush, Match and the placement check are not counted, on either side: the
// free plan's copy is "20 practice questions a day, and everything else
// unlimited" (CAPPED_PRACTICE_MODES).
// ─────────────────────────────────────────────────────────────────────────────
import { CAPPED_PRACTICE_MODES, FREE_PRACTICE_ALLOWANCE, practiceDayTimeZone, premiumCapabilityForGenerator } from '../../client/src/engine/practiceAllowance.js';
import { serverEdition } from './edition.js';
import { serverEntitlementCapabilities } from './entitlements.js';
import { asStore } from './store.js';

/** Priyabhata's practice day (the default edition); practiceDayTimeZone(edition) for any other. */
export const PRACTICE_DAY_TIME_ZONE = FREE_PRACTICE_ALLOWANCE.timeZone;
export const PRACTICE_DAILY_SCOPE = 'practice-daily';
const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
// A day's counter outlives its day by one more, so a student's "used today" can
// still be read by a late replay; housekeeping then purges it with every other
// expired idempotency row.
const COUNTER_TTL_MS = DAY_MS;

const pad = n => String(n).padStart(2, '0');

/**
 * The edition's calendar day `now` falls in: its key and its exact bounds.
 * `edition` is the deployment's (serverEdition()); nothing a request carries
 * chooses it.
 */
export function practiceDay(now = Date.now(), edition = serverEdition()) {
  const timeZone = practiceDayTimeZone(edition);
  return timeZone === PRACTICE_DAY_TIME_ZONE ? indianDay(now) : zonedDay(now, timeZone);
}

// Priyabhata's day, exactly as it was computed before editions existed.
function indianDay(now) {
  const start = Math.floor((now + IST_OFFSET_MS) / DAY_MS) * DAY_MS - IST_OFFSET_MS;
  const local = new Date(start + IST_OFFSET_MS);
  return {
    key: `${local.getUTCFullYear()}-${pad(local.getUTCMonth() + 1)}-${pad(local.getUTCDate())}`,
    start,
    end: start + DAY_MS,
    timeZone: PRACTICE_DAY_TIME_ZONE
  };
}

const wallClocks = new Map();
function wallClock(timeZone) {
  let format = wallClocks.get(timeZone);
  if (!format) {
    format = new Intl.DateTimeFormat('en-US', {
      timeZone, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric'
    });
    wallClocks.set(timeZone, format);
  }
  return format;
}

// The wall clock in `timeZone` at instant `ms`, to the second.
function wallAt(ms, timeZone) {
  const parts = Object.fromEntries(wallClock(timeZone).formatToParts(new Date(ms)).filter(p => p.type !== 'literal').map(p => [p.type, Number(p.value)]));
  return { y: parts.year, m: parts.month, d: parts.day, h: parts.hour % 24, mi: parts.minute, s: parts.second };
}

// How far `timeZone`'s wall clock is ahead of UTC at instant `ms`.
function offsetAt(ms, timeZone) {
  const w = wallAt(ms, timeZone);
  return Date.UTC(w.y, w.m - 1, w.d, w.h, w.mi, w.s) - (ms - (((ms % 1000) + 1000) % 1000));
}

// The instant the local date y-m-d begins in `timeZone`. Two passes settle
// the offset on either side of a daylight-saving change; every zone an
// edition uses changes its clocks away from midnight, so midnight exists.
function localMidnight(y, m, d, timeZone) {
  const wall = Date.UTC(y, m - 1, d);
  const guess = wall - offsetAt(wall, timeZone);
  return wall - offsetAt(guess, timeZone);
}

function zonedDay(now, timeZone) {
  const w = wallAt(now, timeZone);
  const start = localMidnight(w.y, w.m, w.d, timeZone);
  const next = new Date(Date.UTC(w.y, w.m - 1, w.d + 1));
  const end = localMidnight(next.getUTCFullYear(), next.getUTCMonth() + 1, next.getUTCDate(), timeZone);
  return { key: `${w.y}-${pad(w.m)}-${pad(w.d)}`, start, end, timeZone };
}

function parse(raw) {
  const text = String(raw ?? '').trim();
  if (!text) return { set: false, value: null };
  const n = Number(text);
  return { set: true, value: Number.isSafeInteger(n) && n > 0 && n <= 100_000 ? n : null };
}

/** Configuration mistakes production must not boot with (config.js). */
export function practiceAllowanceConfigProblems(env = process.env) {
  const free = parse(env.PRI_FREE_PRACTICE_PER_DAY);
  return free.set && free.value === null ? ['PRI_FREE_PRACTICE_PER_DAY (a positive integer up to 100000)'] : [];
}

/** Capped questions a free account may be issued per day (deployment-tunable). */
export function freePracticePerDay(env = process.env) {
  return parse(env.PRI_FREE_PRACTICE_PER_DAY).value ?? FREE_PRACTICE_ALLOWANCE.perDay;
}

/** Whether an issue in `mode` counts toward (and is refused by) the cap. */
export const practiceModeCounted = mode => CAPPED_PRACTICE_MODES.includes(mode);

function issuedOf(row) {
  if (!row) return 0;
  try { return Math.max(0, Math.floor(Number(JSON.parse(row.response_json).issued) || 0)); } catch { return 0; }
}

const COUNTER = 'SELECT response_json FROM idempotency_keys WHERE account_id=? AND scope=? AND key=?';

/**
 * Read only: this account's standing against the cap at `now`. Decided from
 * the server's entitlement record and the server's own count. Call it inside
 * the issue transaction (account scope, under the account's issue lock) so the
 * verdict and the count it leads to cannot be split by a concurrent issue
 * from another device.
 */
export async function practiceAllowanceVerdict(db, { accountId, now = Date.now(), env = process.env, edition = serverEdition(env) }) {
  db = asStore(db);
  const day = practiceDay(now, edition);
  const snapshot = await db.get('SELECT plan,status,current_period_end,grace_until FROM entitlement_snapshots WHERE account_id=?', [accountId]);
  const premium = serverEntitlementCapabilities(snapshot, now).includes('unlimited-practice');
  const used = issuedOf(await db.get(COUNTER, [accountId, PRACTICE_DAILY_SCOPE, day.key]));
  const base = { used, resetsAt: day.end, timeZone: day.timeZone, day: day.key };
  if (premium) return { ...base, allowed: true, plan: 'premium', unlimited: true, limit: null };
  const limit = freePracticePerDay(env);
  return { ...base, allowed: used < limit, plan: 'free', unlimited: false, limit };
}

/**
 * Count one issued capped question for `accountId`'s day. In the same
 * transaction as the question it counts, after every replay check has
 * returned, so a counted question is one the account was really issued now.
 * Returns the day's count including this one.
 */
export async function recordPracticeIssue(db, { accountId, now = Date.now(), env = process.env, edition = serverEdition(env) }) {
  db = asStore(db);
  const day = practiceDay(now, edition);
  const issued = issuedOf(await db.get(COUNTER, [accountId, PRACTICE_DAILY_SCOPE, day.key])) + 1;
  await db.run(`INSERT INTO idempotency_keys(account_id,scope,key,response_json,request_digest,created_at,expires_at) VALUES (?,?,?,?,?,?,?)
    ON CONFLICT(account_id,scope,key) DO UPDATE SET response_json=excluded.response_json`,
  [accountId, PRACTICE_DAILY_SCOPE, day.key, JSON.stringify({ issued }), 'practice-daily', now, day.end + COUNTER_TTL_MS]);
  return issued;
}

/**
 * The refusal, in the code and fields the device's own gate uses (402
 * FREE_CAP_REACHED, local/entitlementGate.js) so the same paywall copy
 * applies, plus RFC 9110 Retry-After at the day's end. The reset instant is
 * the end of the edition's day, so the device can name it in the student's
 * own clock; `timeZone` says which calendar the server counted in. `resetAt` is the
 * transport's name for "when a refusal lifts" (cloudTransport.js copies it);
 * the device maps it onto its gate's `resetsAt`.
 */
export function refusePracticeCap(res, verdict, now = Date.now()) {
  res.set('Retry-After', String(Math.max(1, Math.ceil((verdict.resetsAt - now) / 1000))));
  res.set('RateLimit-Remaining', '0');
  res.set('RateLimit-Reset', String(Math.ceil(verdict.resetsAt / 1000)));
  res.set('Cache-Control', 'no-store');
  return res.status(402).json({
    error: {
      code: 'FREE_CAP_REACHED',
      message: `You have used today's ${verdict.limit} free practice questions. They reset at midnight (${verdict.timeZone}), and Premium removes the daily cap.`,
      capability: 'unlimited-practice',
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

// ── Premium-only practice content (D19: JEE Advanced, server-enforced) ───────
// A question from a generator that exists only for the JEE Advanced track is
// issued to an account whose server entitlement record grants
// `jee-advanced-content`, and to no one else: at issue, at the bind of a
// prepared question, at "the same question again" and at a notebook twin. It
// is decided before anything is generated or written (a refused bind never
// burns a prepared token), and never at submission (a question issued while
// Premium was live is still marked after it lapses).
//
// What this does NOT cover, stated so nobody relies on it: the JEE Advanced
// track's ordinary chapter questions at difficulty 3–4 are the same items JEE
// Main serves on the free plan, so they are free content and are issued to
// anyone; only the device's track gate keeps a free student out of the track
// itself. The track's papers are gated by the exam router (exams.js).

export { premiumCapabilityForGenerator };

/**
 * Null when `generator`'s questions may be issued to this account now;
 * otherwise the refusal. Read only. Nothing the device sends is consulted.
 */
export async function premiumContentRefusal(db, { accountId, generator, now = Date.now() }) {
  const capability = premiumCapabilityForGenerator(generator);
  if (!capability) return null;
  db = asStore(db);
  const snapshot = await db.get('SELECT plan,status,current_period_end,grace_until FROM entitlement_snapshots WHERE account_id=?', [accountId]);
  if (serverEntitlementCapabilities(snapshot, now).includes(capability)) return null;
  return { capability };
}

/**
 * The refusal, in the code and copy the device's own gate uses (402
 * PREMIUM_REQUIRED, local/entitlementGate.js CAPABILITY_COPY and the exam
 * router's JEE Advanced refusal), so the one paywall explains it.
 */
export function refusePremiumContent(res, refusal) {
  res.set('Cache-Control', 'no-store');
  return res.status(402).json({
    error: {
      code: 'PREMIUM_REQUIRED',
      message: 'The JEE Advanced track is part of Pri Learning Premium. JEE Main and the CBSE / NCERT chapters stay on the free plan.',
      capability: refusal.capability,
      plan: 'free',
      retryable: false
    }
  });
}
