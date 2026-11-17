// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · what help a server-graded attempt actually had (`support`)
//
// Until support version 2 every server-graded attempt was written
// `support: 'supported'`, because tutor help was only observed on the device:
// "on your own" evidence (Standard #01, independent mastery) could never come
// from the server. The server now decides it from its OWN records of THIS
// question, never from anything the device says:
//
//   revealed        the solution was shown (Show solution, or the ladder's
//                   last rung): the attempt is a reveal, never a success
//   supported       any help on this item: a hint rung charged, tutor help
//                   served for this issued question (the marker below), a
//                   line check or step-coach reading that ran, a tutor-policy
//                   help request or a shown cause kind (PR #996's
//                   practice-help-plan scope, light assistance), or a repeat
//                   of content whose solution the account has already seen, or
//                   help the DEVICE declares it showed (`deviceHelp`: the tutor's
//                   offline fallback) — a one-way signal that can only lower the
//                   claim, so the device's word suffices; nothing claims independence
//   after-feedback  no help, but resolved on a later try: the student saw the
//                   verdict (and the first break, where Step Check named one)
//                   on an earlier try of THIS question and re-submitted
//   independent     none of the above: the first try, unaided
//
// The order is that list's order: the first that applies wins. Every event
// written this way carries `supportVersion: 2` and `supportSources`, the
// records that decided it (never shown to a student; for evidence audits).
//
// OLD RECORDS ARE LEFT AS THEY ARE. A graded-attempt event with no
// `supportVersion` was written under the old rule, where `supported` meant
// "help unknown", not "help seen". It is not rewritten — events are
// append-only learning evidence — and a reader must not read it as
// independent. See docs/product/attempt-support.md.
//
// Outside help the server cannot see (a calculator, a friend, another tab) is
// not covered by any version: `independent` means "no help this product gave
// on this item", and says no more than that.
// ─────────────────────────────────────────────────────────────────────────────

import { sha256 } from './security.js';
import { triedKeysOf } from './contentSeen.js';

export const SUPPORT_VERSION = 2;
export const SUPPORT_VALUES = Object.freeze(['independent', 'after-feedback', 'supported', 'revealed']);
/** The values that are NOT independent work. Readers treat each as supported evidence. */
export const NOT_INDEPENDENT = Object.freeze(['after-feedback', 'supported', 'revealed']);

const MARKER_SCOPE = 'practice-tutor-help';
const CONTENT_SCOPE = 'practice-content-helped';
const MARKER_TTL_MS = 90 * 24 * 60 * 60 * 1000;

/** The per-question rate-limit buckets the tutor routes spend (tutor.js); one name each. */
export const lineCheckBucket = (accountId, questionId) => `line-check:${sha256(`${accountId}:${questionId}`).slice(0, 32)}`;
export const stepCoachBucket = (accountId, questionId) => `step-coach:${sha256(`${accountId}:${questionId}`).slice(0, 32)}`;

/**
 * Record DURABLY that help of `kind` was served on a server-issued question of
 * this account: `tutor:<level>` (tutor.js /help, /stream), `line-check`,
 * `step-coach` (a check that ran), `hint:<rung>` (a ladder rung served). Kept
 * per question AND per content (the question's tried-content keys), so help on
 * one copy of a bank item follows the content to any other copy issued to the
 * same account. Lives as long as an escrowed question (90 days) — unlike the
 * rate-limit buckets, which housekeeping sweeps after a day.
 */
export async function markHelp(db, accountId, questionId, kind, at = Date.now()) {
  if (typeof questionId !== 'string' || !questionId) return;
  const k = String(kind || 'help').slice(0, 32);
  const row = await db.get('SELECT response_json FROM idempotency_keys WHERE account_id=? AND scope=? AND key=?', [accountId, MARKER_SCOPE, questionId]);
  let kinds = [];
  try { const was = row ? JSON.parse(row.response_json) : {}; kinds = was.kinds || (was.levels || []).map(l => `tutor:${l}`); } catch { kinds = []; }
  const next = [...new Set([...kinds, k])].slice(0, 16);
  await db.run(`INSERT INTO idempotency_keys(account_id,scope,key,response_json,request_digest,created_at,expires_at) VALUES (?,?,?,?,?,?,?)
    ON CONFLICT(account_id,scope,key) DO UPDATE SET response_json=excluded.response_json`,
    [accountId, MARKER_SCOPE, questionId, JSON.stringify({ kinds: next, at }), sha256(`${questionId}:${next.join(',')}`), at, at + MARKER_TTL_MS]);
  const escrow = await db.get("SELECT response_json FROM idempotency_keys WHERE account_id=? AND scope='practice-question' AND key=?", [accountId, questionId]);
  let q = null;
  try { q = escrow ? JSON.parse(escrow.response_json) : null; } catch { q = null; }
  for (const key of q ? triedKeysOf(q) : []) {
    await db.run(`INSERT INTO idempotency_keys(account_id,scope,key,response_json,request_digest,created_at,expires_at) VALUES (?,?,?,?,?,?,?)
      ON CONFLICT(account_id,scope,key) DO UPDATE SET response_json=excluded.response_json, expires_at=excluded.expires_at`,
      [accountId, CONTENT_SCOPE, key, JSON.stringify({ questionId, at }), sha256(`${key}:${questionId}`), at, at + MARKER_TTL_MS]);
  }
}

/** Tutor help served (tutor.js). */
export const markTutorHelp = (db, accountId, questionId, level, at = Date.now()) => markHelp(db, accountId, questionId, `tutor:${String(level || 'help')}`, at);

/**
 * Everything the server itself recorded about help on this question (and on
 * any other copy of its content) for this account. Read inside the committing
 * transaction, under the account's lock.
 */
export async function helpRecordsFor(db, accountId, questionId, q = null) {
  // One after another: a transaction's store runs one statement at a time.
  const marker = await db.get('SELECT response_json FROM idempotency_keys WHERE account_id=? AND scope=? AND key=?', [accountId, MARKER_SCOPE, questionId]);
  const lineCheck = await db.get('SELECT count FROM rate_limits WHERE bucket = ?', [lineCheckBucket(accountId, questionId)]);
  const stepCoach = await db.get('SELECT count FROM rate_limits WHERE bucket = ?', [stepCoachBucket(accountId, questionId)]);
  const plan = await db.get("SELECT response_json FROM idempotency_keys WHERE account_id=? AND scope='practice-help-plan' AND key=?", [accountId, questionId]);
  let kinds = [];
  try { const was = marker ? JSON.parse(marker.response_json) : {}; kinds = was.kinds || (was.levels || []).map(l => `tutor:${l}`); } catch { kinds = []; }
  let onCopy = false;
  for (const key of q ? triedKeysOf(q) : []) {
    const row = await db.get('SELECT response_json FROM idempotency_keys WHERE account_id=? AND scope=? AND key=?', [accountId, CONTENT_SCOPE, key]);
    try { if (row && JSON.parse(row.response_json).questionId !== questionId) onCopy = true; } catch { onCopy = true; }
  }
  let served = [];
  try { served = plan ? JSON.parse(plan.response_json).served || [] : []; } catch { served = []; }
  return {
    tutor: kinds.some(k => k.startsWith('tutor:')),
    // The durable marker first; the per-question bucket (swept after a day) as a second witness.
    lineChecks: Math.max(kinds.includes('line-check') ? 1 : 0, Number(lineCheck?.count) || 0),
    stepCoach: Math.max(kinds.includes('step-coach') ? 1 : 0, Number(stepCoach?.count) || 0),
    helpOnCopy: onCopy,
    helpPlanRequests: Array.isArray(served) ? served.length : 0,
    causeShown: Array.isArray(served) && served.some(x => x?.causeShown === true)
  };
}

/**
 * The support of one attempt. Pure.
 *
 * @param {object} p
 *   revealed       the attempt is a reveal
 *   hintLevel      ladder rungs the server charged on this question (0–4)
 *   records        from helpRecordsFor
 *   solutionSeen   the content was a repeat of something already shown solved
 *   priorTries     wrong tries already spent on this question before this one
 * @returns {{ support: string, supportSources: string[], supportVersion: number }}
 */
export function deriveSupport({ revealed = false, hintLevel = 0, records = {}, solutionSeen = false, priorTries = 0 } = {}) {
  const sources = [];
  if (revealed) sources.push('reveal');
  if (Number(hintLevel) > 0) sources.push('hint');
  if (records.tutor) sources.push('tutor');
  if (records.lineChecks > 0) sources.push('line-check');
  if (records.stepCoach > 0) sources.push('step-coach');
  if (records.helpPlanRequests > 0) sources.push('help-plan');
  if (records.causeShown) sources.push('cause-shown');
  if (records.helpOnCopy) sources.push('help-on-copy');
  // Help the device declared (offline tutor fallback): one-way, towards supported only.
  if (records.deviceHelp) sources.push('device-help');
  if (solutionSeen) sources.push('solution-seen');
  if (Number(priorTries) > 0) sources.push('retry');
  const support = revealed ? 'revealed'
    : sources.some(s => s !== 'retry') ? 'supported'
      : sources.includes('retry') ? 'after-feedback'
        : 'independent';
  return { support, supportSources: sources, supportVersion: SUPPORT_VERSION };
}
