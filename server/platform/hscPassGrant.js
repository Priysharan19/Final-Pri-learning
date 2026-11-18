// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · "HSC Pass to the exams" in the entitlement lifecycle (Prithagoras)
//
// A one-off, NON-RENEWING pass that ends the day after the last HSC Mathematics exam of
// its exam year (client/src/engine/hscPass.js holds the dates and the price). It is a DATED
// GRANT of Premium, using the machinery that already carries the referral trial: a durable
// row in entitlement_support_grants (product 'hsc-pass-to-the-exams'), applied through
// applyVerifiedEntitlement. So, with no schema change:
//
//   · it is SERVER-AUTHORITATIVE: only server code with a verified payment reference calls
//     grantHscPass; no client request, header or query can;
//   · it NEVER RENEWS: nothing extends it, and Premium simply lapses at its end instant;
//   · Premium comes from whichever source pays longest (selectEntitlementSource): a pass
//     never shortens a longer subscription, and a monthly plan bought during the pass is
//     not shortened by it either;
//   · it is idempotent: the same payment reference applies once;
//   · it grants the capabilities of Premium (premium-exams and the Premium read allowance),
//     exactly as the entitlement does; no new capability exists.
//
// REFUNDS. A refund of the pass payment, per the refund policy (docs/legal/au/refund-policy.md),
// ends the grant at once: revokeHscPass deletes that grant row and recomputes the entitlement
// from what remains (another grant or a subscription still pays; otherwise Free).
//
// NOT CONNECTED TO CHECKOUT. Australian payments are OFF. Nothing here creates a Stripe
// session or reads a webhook; a later, reviewed change calls grantHscPass from a verified
// `checkout.session.completed` (mode payment) and revokeHscPass from a verified full
// `charge.refunded` (docs/release/au-payments-switch-on.md).
// ─────────────────────────────────────────────────────────────────────────────
import { applyVerifiedEntitlement } from './entitlements.js';
import { asStore } from './store.js';
import { HSC_PASS, passEndDate } from '../../client/src/engine/hscPass.js';

export const HSC_PASS_PRODUCT = HSC_PASS.toTheExams.id;
const SAFE_REF = /^[A-Za-z0-9_.:-]{6,120}$/;

/** The instant a pass ends: midnight at the START of `endsOn` in Sydney (the day after the last exam). */
export function sydneyMidnightMs(isoDate) {
  const [y, m, d] = isoDate.split('-').map(Number);
  // Midnight Sydney = 00:00 local; find the offset in force that day (AEST +10, AEDT +11) from Intl.
  const guess = Date.UTC(y, m - 1, d, 0, 0, 0);
  const parts = new Intl.DateTimeFormat('en-AU', { timeZone: 'Australia/Sydney', timeZoneName: 'shortOffset', hour: '2-digit', hour12: false }).formatToParts(new Date(guess));
  const tz = parts.find(p => p.type === 'timeZoneName')?.value || 'GMT+10';
  const hours = Number(/GMT([+-]\d+)/.exec(tz)?.[1] ?? 10);
  return guess - hours * 3_600_000;
}

/** Grant the pass for `examYear` from a verified payment. Returns { granted, endsAt, replayed }. The last paid millisecond is endsAt - 1 (entitlements treat a period end as inclusive). */
export async function grantHscPass(db, { accountId, examYear, paymentRef, now = Date.now() }) {
  if (!accountId || !SAFE_REF.test(String(paymentRef || ''))) throw new Error('HSC Pass grant needs an account and a payment reference');
  const end = passEndDate(examYear);
  if (!end) throw new Error(`HSC Pass: no end date is configured for exam year ${examYear}`);
  const endsAt = sydneyMidnightMs(end.endsOn);
  if (endsAt <= now) return { granted: false, reason: 'ended', endsAt };
  db = asStore(db);
  const result = await applyVerifiedEntitlement(db, {
    verified: true, provider: 'admin', eventId: `hsc-pass-${paymentRef}`, accountId, eventType: 'hsc-pass.purchase',
    productId: HSC_PASS_PRODUCT, plan: 'premium', status: 'active', currentPeriodEnd: endsAt - 1, now
  });
  return { granted: !result.replayed, replayed: !!result.replayed, endsAt, snapshot: result.snapshot };
}

/** A full refund of the pass: the grant ends at once; whatever else pays still does. */
export async function revokeHscPass(db, { accountId, paymentRef, now = Date.now() }) {
  if (!accountId || !SAFE_REF.test(String(paymentRef || ''))) throw new Error('HSC Pass refund needs an account and a payment reference');
  db = asStore(db);
  const removed = await db.run('DELETE FROM entitlement_support_grants WHERE event_id=? AND account_id=? AND product_id=?', [`hsc-pass-${paymentRef}`, accountId, HSC_PASS_PRODUCT]);
  // With no grant row left, entitlements.js falls back to a grant that exists only in the snapshot (made before billing schema v5):
  // clear the pass from the snapshot first, or the removed pass would be read back as that old grant.
  await db.run("UPDATE entitlement_snapshots SET plan='free', status='revoked', current_period_end=NULL, offline_until=NULL WHERE account_id=? AND provider='admin' AND product_id=?", [accountId, HSC_PASS_PRODUCT]);
  const result = await applyVerifiedEntitlement(db, {
    verified: true, provider: 'admin', eventId: `hsc-pass-refund-${paymentRef}`, accountId, eventType: 'hsc-pass.refund',
    productId: HSC_PASS_PRODUCT, plan: 'free', status: 'revoked', currentPeriodEnd: null, now
  });
  return { revoked: removed.changes === 1, snapshot: result.snapshot };
}
