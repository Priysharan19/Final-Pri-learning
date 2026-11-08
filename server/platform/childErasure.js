// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · a child's cloud account that no guardian stands behind is erased
//
// Owner default D18 (docs/release/V1_DECISIONS_2026-11-01.md): the account of an
// under-18 whose guardian never confirmed, or withdrew, is erased after 30
// days, and a guardian can ask for erasure without the child's login. The
// period is counsel's to set; it lives in one constant below.
//
// WHICH ACCOUNTS. Only a student account recorded as a child at creation
// (accounts.age_basis = 'child', role 'student') is ever selected, and only on
// one of two facts:
//   · never confirmed: no guardian confirmation was ever recorded (the consent
//     row is missing, or its confirmed_at is NULL) and it is not withdrawn,
//     counted from the account's creation. A re-request does not restart the
//     clock: a child asking again and again is still a child nobody confirmed.
//   · withdrawn: counted from the withdrawal.
// An adult, a 'legacy' account, an account with no age on record, a staff
// account, and a child whose guardian confirmed an older notice (renewal
// pending: a guardian DID confirm) are never selected.
//
// HOW. Two steps, so nothing is destroyed by the pass that decides:
//   1. Soft delete. accounts.deleted_at is set (every lookup that admits an
//      account already requires deleted_at IS NULL, so it can no longer sign
//      in), its sessions are revoked, its live links and codes are spent and
//      its unsent mail is dropped, and an `account.erasure.scheduled` audit row
//      records the reason and the date after which it may be erased. The
//      eligibility is re-read inside the same transaction, with the consent
//      row locked on Postgres, so a guardian confirming at the same moment
//      wins.
//   2. Erasure, ERASURE_GRACE_MS later: the one deletion transaction every
//      deletion uses (accounts.js deleteAccountRows: the schema's cascade, the
//      retained-but-unlinked rows, the billing hook), with an `account.erase`
//      receipt that names the reason and nothing personal. Only an account
//      that step 1 scheduled is erased: the purge requires both deleted_at and
//      the scheduling audit row, so no other use of deleted_at can lead here.
// The grace is an operator's window to see the counts (/v1/health's
// housekeeping record) and restore a wrongly scheduled account (clear
// deleted_at) before anything is gone. It is not more time for consent: a
// confirmation after step 1 does nothing (confirmConsent refuses a
// soft-deleted account).
//
// WHEN IT IS ON. The automatic retention step (1 for the 30-day rule) is
// destructive production behaviour on a provisional default, so it runs only
// when the operator sets PRI_CHILD_ERASURE=enforce. Without it the pass only
// counts what it would schedule (`candidates`). A guardian's own request is
// a data principal's request, like account deletion: it is always honoured,
// and step 2 always runs for what was scheduled.
// ─────────────────────────────────────────────────────────────────────────────
import { asStore } from './store.js';
import { consentState } from './guardianConsent.js';
import { ensureOtpSchema } from './otpCore.js';
import { deleteAccountRows } from './accounts.js';
import { logEvent, safeCode } from './observability.js';
import { ensureBillingSchema } from './billingSchema.js';
import { createRazorpayBilling } from './razorpay.js';

const DAY_MS = 24 * 60 * 60 * 1000;
/** How long an unconfirmed (or withdrawn) child account is kept. Counsel sets it. */
export const UNCONSENTED_CHILD_RETENTION_MS = 30 * DAY_MS;
/** Between the soft delete and the erasure: the operator's window to restore. */
export const ERASURE_GRACE_MS = 7 * DAY_MS;
/** Bound on accounts handled per housekeeping pass, so one pass stays short. */
export const ERASURE_BATCH = 200;

export const ERASURE_REASONS = Object.freeze({
  neverConfirmed: 'guardian-never-confirmed',
  withdrawn: 'guardian-withdrew',
  guardianRequest: 'guardian-request'
});

/** 'enforce' only when the operator said so; anything else counts and changes nothing. */
export function childErasureMode(env = process.env) {
  return String(env.PRI_CHILD_ERASURE || '').trim().toLowerCase() === 'enforce' ? 'enforce' : 'report';
}

// The retention rule as one statement. A child's consent row may be missing
// (the guardian contact was never given), so the join is a LEFT JOIN and a
// missing row counts as never confirmed, from the account's creation.
const CANDIDATES_SQL = `SELECT a.id AS account_id,
    CASE WHEN g.withdrawn_at IS NOT NULL THEN 'withdrawn' ELSE 'never-confirmed' END AS basis
  FROM accounts a LEFT JOIN guardian_consents g ON g.account_id = a.id
  WHERE a.deleted_at IS NULL AND a.age_basis = 'child' AND a.role = 'student'
    AND (
      (g.withdrawn_at IS NOT NULL AND g.withdrawn_at <= ?)
      OR (g.withdrawn_at IS NULL AND g.confirmed_at IS NULL AND a.created_at <= ?)
    )
  ORDER BY a.created_at, a.id
  LIMIT ?`;

/** Accounts the retention rule selects at `now` (at most `limit`). */
export async function retentionCandidates(db, { now = Date.now(), limit = ERASURE_BATCH } = {}) {
  db = asStore(db);
  const cutoff = now - UNCONSENTED_CHILD_RETENTION_MS;
  return db.all(CANDIDATES_SQL, [cutoff, cutoff, limit]);
}

/**
 * Why the retention rule applies to this account at `now`, re-read from the
 * locked state, or null when it no longer does.
 */
async function retentionReason(db, account, now) {
  if (!account || account.deleted_at != null || account.age_basis !== 'child' || account.role !== 'student') return null;
  const state = await consentState(db, account.id, { lock: true });
  const cutoff = now - UNCONSENTED_CHILD_RETENTION_MS;
  if (state.state === 'withdrawn') {
    return Number(state.row?.withdrawn_at) <= cutoff ? ERASURE_REASONS.withdrawn : null;
  }
  // Any recorded confirmation, current or for an older notice, means a
  // guardian did confirm: never "never confirmed".
  if (state.row?.confirmed_at != null) return null;
  return Number(account.created_at) <= cutoff ? ERASURE_REASONS.neverConfirmed : null;
}

/**
 * Step 1 for one account. `reason` is ERASURE_REASONS.guardianRequest for a
 * guardian's own request (the caller has proved the guardian's credential and
 * withdrawn consent in the same transaction); otherwise the retention rule is
 * re-checked here. Returns { scheduled, eraseAfter, reason } — scheduled is
 * false when the account is gone, already scheduled or no longer eligible.
 * Runs inside the caller's transaction when there is one.
 */
export async function scheduleErasure(db, accountId, { reason = null, now = Date.now() } = {}) {
  db = asStore(db);
  let outcome = { scheduled: false, eraseAfter: null, reason: null };
  await db.transaction(async () => {
    const account = await db.get('SELECT id, role, age_basis, created_at, deleted_at FROM accounts WHERE id = ?', [accountId]);
    if (!account || account.deleted_at != null || account.age_basis !== 'child') return;
    let why = null;
    if (reason === ERASURE_REASONS.guardianRequest) why = reason;
    else why = await retentionReason(db, account, now);
    if (!why) return;
    const marked = await db.run('UPDATE accounts SET deleted_at = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL', [now, now, accountId]);
    if (marked.changes !== 1) return;
    const eraseAfter = now + ERASURE_GRACE_MS;
    // Nothing of the account can be used from here on: no session, no link,
    // no code, and no email still to be sent for it.
    await db.run('UPDATE account_sessions SET revoked_at = ? WHERE account_id = ? AND revoked_at IS NULL', [now, accountId]);
    await db.run('UPDATE account_tokens SET consumed_at = ? WHERE account_id = ? AND consumed_at IS NULL', [now, accountId]);
    await db.run('DELETE FROM auth_delivery_outbox WHERE account_id = ? AND delivered_at IS NULL', [accountId]);
    ensureOtpSchema(db);
    await db.run('UPDATE otp_challenges SET consumed_at = ? WHERE account_id = ? AND consumed_at IS NULL', [now, accountId]);
    // The schedule and its reason, with nothing personal: the account id is an
    // opaque id that stops resolving once the erasure has run.
    await db.run('INSERT INTO audit_log(actor_account_id,action,target_kind,target_id,metadata_json,created_at) VALUES (?,?,?,?,?,?)',
      [null, 'account.erasure.scheduled', 'account', accountId, JSON.stringify({ reason: why, eraseAfter }), now]);
    outcome = { scheduled: true, eraseAfter, reason: why };
  });
  return outcome;
}

// Accounts step 1 scheduled whose grace has run out. Both facts are required.
const DUE_SQL = `SELECT a.id AS account_id FROM accounts a
  WHERE a.deleted_at IS NOT NULL AND a.deleted_at <= ?
    AND EXISTS (SELECT 1 FROM audit_log l
      WHERE l.action = 'account.erasure.scheduled' AND l.target_kind = 'account' AND l.target_id = a.id)
  ORDER BY a.deleted_at, a.id
  LIMIT ?`;

/** The reason step 1 recorded for this account (the latest schedule). */
async function scheduledReason(db, accountId) {
  const row = await db.get(`SELECT metadata_json FROM audit_log
    WHERE action = 'account.erasure.scheduled' AND target_kind = 'account' AND target_id = ?
    ORDER BY id DESC LIMIT 1`, [accountId]);
  try { return String(JSON.parse(row?.metadata_json || '{}').reason || '') || null; } catch { return null; }
}

/**
 * The billing hook every deletion runs (router.js): cancel a charging web
 * subscription at the provider, at once. With nothing to cancel it does
 * nothing; a provider that refuses throws, and the account waits for the next
 * pass. Built here so every caller of the erasure (the server's housekeeping,
 * server/tools/housekeeping.mjs) cancels first without wiring it in.
 */
export function webSubscriptionCancel(db) {
  let cancel = null;
  return async ({ accountId }) => {
    if (!cancel) {
      ensureBillingSchema(db);
      cancel = createRazorpayBilling(db).lifecycle.web.cancel;
    }
    return cancel({ accountId, atCycleEnd: false, reason: 'account-erasure' });
  };
}

/**
 * One housekeeping pass. Step 2 for every scheduled account whose grace has
 * run out, then step 1 for the retention rule (enforce mode) or a count of
 * what it would schedule (report mode). One account that fails does not stop
 * the others: it is counted (eraseFailed / scheduleFailed in the housekeeping
 * record), logged as a coded housekeeping_error, and tried again next pass.
 */
export async function runChildErasure(db, { now = Date.now(), mode = childErasureMode(), beforeDelete, limit = ERASURE_BATCH } = {}) {
  db = asStore(db);
  if (beforeDelete === undefined) beforeDelete = webSubscriptionCancel(db);
  const result = { mode, erased: 0, eraseFailed: 0, scheduled: 0, scheduleFailed: 0, candidates: 0 };

  const due = await db.all(DUE_SQL, [now - ERASURE_GRACE_MS, limit]);
  for (const { account_id: accountId } of due) {
    try {
      const reason = await scheduledReason(db, accountId);
      const erased = await deleteAccountRows(db, accountId, {
        beforeDelete,
        softDeletedBefore: now - ERASURE_GRACE_MS,
        receipt: { action: 'account.erase', metadata: { reason } }
      });
      if (erased) result.erased += 1;
    } catch (error) {
      result.eraseFailed += 1;
      logEvent('error', 'housekeeping_error', { code: safeCode(error?.code, 'CHILD_ERASURE_ERASE_FAILED') });
    }
  }

  const candidates = await retentionCandidates(db, { now, limit });
  result.candidates = candidates.length;
  if (mode !== 'enforce') return result;
  for (const { account_id: accountId } of candidates) {
    try {
      // Stop a charging web subscription first: a parent who withdrew is not
      // billed for an account that can no longer be used. (The erasure calls
      // the same hook again; with nothing left to cancel it does nothing.)
      if (typeof beforeDelete === 'function') await beforeDelete({ accountId, request: null });
      const outcome = await scheduleErasure(db, accountId, { now });
      if (outcome.scheduled) result.scheduled += 1;
    } catch (error) {
      result.scheduleFailed += 1;
      logEvent('error', 'housekeeping_error', { code: safeCode(error?.code, 'CHILD_ERASURE_SCHEDULE_FAILED') });
    }
  }
  return result;
}
