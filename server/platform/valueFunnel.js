// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the product funnel, aggregate only (packaging proposal §5)
//
// GET /v1/admin/funnel (admin role + verified second factor, admin.js) reads
// the funnel from rows the server already keeps — no new tracking, no third
// party, no device identifier, nothing a student sees:
//
//   cohort        student accounts created in the window (not deleted);
//   activation    of the cohort, accounts with at least one server-checked
//                 answer (learning_events kind 'graded-attempt' written by
//                 the server grader);
//   D1 / D7 / D30 of activated accounts whose first checked answer is at least
//                 N days old, those with another checked answer N or more days
//                 after the first ("returned on or after day N");
//   trial → paid  trials claimed in the window (billing_trial_claims), and of
//                 those, accounts with a payment of more than zero after the
//                 claim (billing_payments);
//   cancellations student-requested cancellations in the window, and the
//                 optional one-tap reasons given after them (audit_log
//                 'billing.cancel-feedback', a closed set).
//
// The learning outcome that matters — delayed independent success — is not
// computed here: it is the primary outcome of the tutor-policy experiment
// readout (PR #996), which owns its definition, delay and statistics. This
// readout names where it lives so the two are read together.
//
// Small cells are suppressed: any count from 1 to K−1 is returned as null, a
// count published beside its total is also null when the remainder is 1 to
// K−1, and a rate is returned only when its numerator, denominator and
// complement are each at least K. The 7, 30 and 90-day windows overlap, so one
// window's figures could in principle be subtracted from another's: the
// readout is admin + second factor only, and carries no identifier. Every figure is a count over many accounts; no account id,
// email, name or timestamp ever leaves this module. Definitions:
// docs/product/value-metrics.md.
// ─────────────────────────────────────────────────────────────────────────────
import { asStore } from './store.js';
import { CANCEL_REASONS } from './billing.js';

export const FUNNEL_K = 10;
export const FUNNEL_WINDOWS_DAYS = Object.freeze([7, 30, 90]);
export const RETENTION_DAYS = Object.freeze([1, 7, 30]);
const DAY = 24 * 60 * 60 * 1000;

/** A count, or null when it is small enough to point at a person. */
export function cell(n, k = FUNNEL_K) {
  const v = Math.max(0, Math.floor(Number(n) || 0));
  return v > 0 && v < k ? null : v;
}

/**
 * A count that is part of a published total: null when it, or what is left of
 * the total without it, is small enough to point at a person.
 */
export function partOf(num, den, k = FUNNEL_K) {
  const a = Math.max(0, Math.floor(Number(num) || 0));
  const b = Math.max(0, Math.floor(Number(den) || 0));
  if (a > 0 && a < k) return null;
  if (b - a > 0 && b - a < k) return null;
  return a;
}

/** num / den to three places, or null unless num, den and den − num are each ≥ k. */
export function rate(num, den, k = FUNNEL_K) {
  const a = Math.floor(Number(num) || 0);
  const b = Math.floor(Number(den) || 0);
  if (b < k || a < k || b - a < k) return null;
  return Math.round((a / b) * 1000) / 1000;
}

export function funnelWindow(days, now = Date.now()) {
  const d = FUNNEL_WINDOWS_DAYS.includes(Number(days)) ? Number(days) : 30;
  return { days: d, from: now - d * DAY, to: now };
}

/** The aggregate funnel for one window. Pure counts; see the header for definitions. */
export async function valueFunnel(db, { days = 30, now = Date.now(), edition = null, k = FUNNEL_K } = {}) {
  db = asStore(db);
  const w = funnelWindow(days, now);
  const cohort = Number((await db.get(
    "SELECT COUNT(*) AS n FROM accounts WHERE deleted_at IS NULL AND role='student' AND created_at>=? AND created_at<?",
    [w.from, w.to]))?.n || 0);
  const activity = await db.all(
    `SELECT e.account_id AS account, MIN(e.created_at) AS first_at, MAX(e.created_at) AS last_at
       FROM learning_events e JOIN accounts a ON a.id=e.account_id
      WHERE a.deleted_at IS NULL AND a.role='student' AND a.created_at>=? AND a.created_at<?
        AND e.kind='graded-attempt' AND e.device_id='server-grader'
      GROUP BY e.account_id`, [w.from, w.to]);
  const activated = activity.length;
  const retention = {};
  for (const n of RETENTION_DAYS) {
    const eligible = activity.filter(r => Number(r.first_at) <= now - n * DAY);
    const returned = eligible.filter(r => Number(r.last_at) - Number(r.first_at) >= n * DAY).length;
    retention[`d${n}`] = { eligible: cell(eligible.length, k), returned: partOf(returned, eligible.length, k), rate: rate(returned, eligible.length, k) };
  }
  const trials = await db.all(
    `SELECT t.account_id AS account,
            (SELECT COUNT(*) FROM billing_payments p WHERE p.account_id=t.account_id AND p.amount>0 AND p.captured_at>=t.claimed_at) AS paid
       FROM billing_trial_claims t WHERE t.claimed_at>=? AND t.claimed_at<?`, [w.from, w.to]);
  const trialPaid = trials.filter(r => Number(r.paid) > 0).length;
  const cancels = Number((await db.get(
    "SELECT COUNT(*) AS n FROM billing_subscriptions WHERE cancel_requested_at>=? AND cancel_requested_at<? AND cancel_reason='user'",
    [w.from, w.to]))?.n || 0);
  const feedback = await db.all("SELECT metadata_json FROM audit_log WHERE action='billing.cancel-feedback' AND created_at>=? AND created_at<?", [w.from, w.to]);
  const counts = Object.fromEntries(CANCEL_REASONS.map(r => [r, 0]));
  for (const row of feedback) {
    let reason = null;
    try { reason = JSON.parse(row.metadata_json)?.reason; } catch { /* a malformed row counts as nothing */ }
    if (Object.hasOwn(counts, reason)) counts[reason] += 1;
  }
  const answered = Object.values(counts).reduce((a, b) => a + b, 0);
  return {
    edition,
    window: { days: w.days, from: w.from, to: w.to },
    k,
    cohort: { accounts: cell(cohort, k) },
    activation: { activated: partOf(activated, cohort, k), rate: rate(activated, cohort, k) },
    retention,
    trial: { started: cell(trials.length, k), paid: partOf(trialPaid, trials.length, k), rate: rate(trialPaid, trials.length, k) },
    cancellations: {
      requested: cell(cancels, k),
      reasonsGiven: cell(answered, k),
      reasons: Object.fromEntries(Object.entries(counts).map(([r, n]) => [r, cell(n, k)]))
    },
    learningOutcome: {
      metric: 'delayed independent success',
      source: 'tutor-policy experiment readout (server/platform/experimentReadout.js, PR #996)',
      note: 'Read with this funnel: engagement and conversion are not learning.'
    },
    definitions: 'docs/product/value-metrics.md'
  };
}
