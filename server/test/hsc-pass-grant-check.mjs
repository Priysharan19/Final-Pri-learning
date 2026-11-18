// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the HSC Pass in the entitlement lifecycle (server/platform/hscPassGrant.js)
//
// A one-off, non-renewing, dated grant of Premium, server-authoritative, refundable.
// Accounts are SYNTHETIC. No payment provider, checkout or webhook is touched.
// ─────────────────────────────────────────────────────────────────────────────
import './support/hermetic.mjs';
const { startApp, registerAccount, verifyEmail, checks } = await import('./support/app-harness.mjs');
const { asStore } = await import('../platform/store.js');
const { serverEntitlementCapabilities, applyVerifiedEntitlement } = await import('../platform/entitlements.js');
const { grantHscPass, revokeHscPass, sydneyMidnightMs, HSC_PASS_PRODUCT } = await import('../platform/hscPassGrant.js');

const c = checks();
const DAY = 86_400_000;
const h = await startApp({});
const store = asStore(h.db);
let n = 0;
async function account() {
  n += 1;
  await store.run("DELETE FROM rate_limits WHERE bucket LIKE 'register:%'");
  const r = await registerAccount(h, { email: `hsc.pass.${n}@example.test`, deviceId: `hsc-pass-${n}` });
  await verifyEmail(h, r.account.id);
  return { id: r.account.id, jar: r.jar };
}
const row = id => store.get('SELECT * FROM entitlement_snapshots WHERE account_id=?', [id]);
const caps = async (id, at) => serverEntitlementCapabilities(await row(id), at);

try {
  // 1 · the end instant: midnight at the start of the day after the last exam, Sydney time
  c.eq(new Date(sydneyMidnightMs('2027-11-01')).toISOString(), '2027-10-31T13:00:00.000Z', '1 Nov 2027 00:00 in Sydney (AEDT, +11) is 31 Oct 13:00 UTC');
  c.eq(new Date(sydneyMidnightMs('2027-07-01')).toISOString(), '2027-06-30T14:00:00.000Z', 'and in winter (AEST, +10) 14:00 UTC the day before');

  const now = Date.UTC(2027, 3, 1);
  const A = await account();
  c.deq(await caps(A.id, now), [], 'before a purchase: Free');
  const end = sydneyMidnightMs('2027-11-01');
  const g = await grantHscPass(store, { accountId: A.id, examYear: 2027, paymentRef: 'pi_test_00000001', now });
  c.deq([g.granted, g.endsAt], [true, end], 'a verified payment grants the pass until the configured end instant');
  const r1 = await row(A.id);
  c.deq([r1.plan, r1.status, r1.product_id, Number(r1.current_period_end)], ['premium', 'active', HSC_PASS_PRODUCT, end - 1], 'the server\'s own entitlement row carries it');
  c.ok((await caps(A.id, now + 30 * DAY)).includes('premium-exams'), 'it grants premium-exams (and the Premium capabilities) in the middle of the period');
  c.ok((await caps(A.id, end - 1)).includes('premium-exams'), 'right up to the last millisecond before the end');
  c.deq(await caps(A.id, end), [], 'and not at the end instant: it never renews');
  c.deq(await caps(A.id, end + 400 * DAY), [], 'and never again, whatever the date');
  const again = await grantHscPass(store, { accountId: A.id, examYear: 2027, paymentRef: 'pi_test_00000001', now });
  c.deq([again.granted, again.replayed], [false, true], 'the same payment applies once');
  c.eq((await store.all('SELECT * FROM entitlement_support_grants WHERE account_id=?', [A.id])).length, 1, 'one grant row');

  // 2 · nothing the client sends grants it
  const viaHttp = await h.request('/v1/entitlements/admin/grant', { method: 'POST', jar: A.jar, body: { accountId: A.id, durationMs: 365 * DAY } });
  c.ok([401, 403].includes(viaHttp.status), 'a student cannot grant themselves anything over HTTP');
  const claimed = await h.request('/v1/entitlements', { jar: (await account()).jar, headers: { 'x-pri-plan': 'premium', 'x-pri-capabilities': 'premium-exams' } });
  c.eq(claimed.data.entitlement.plan, 'free', 'a Premium claim in a header changes nothing');

  // 3 · a pass for a year with no configured date, or one that has already ended, grants nothing
  const B = await account();
  await c.rejects(() => grantHscPass(store, { accountId: B.id, examYear: 2031, paymentRef: 'pi_test_00000002', now }), /no end date/, 'an exam year with no configured end date cannot be sold');
  const late = await grantHscPass(store, { accountId: B.id, examYear: 2027, paymentRef: 'pi_test_00000003', now: end + DAY });
  c.deq([late.granted, late.reason], [false, 'ended'], 'a pass whose end has passed grants nothing');
  await c.rejects(() => grantHscPass(store, { accountId: B.id, examYear: 2027, paymentRef: '../x', now }), /payment reference/, 'a malformed payment reference is refused');
  c.deq(await caps(B.id, now), [], 'and the account stays Free');

  // 4 · a longer paid source is never shortened by the pass, and the pass is not shortened by a shorter one
  const C = await account();
  await applyVerifiedEntitlement(store, { verified: true, provider: 'admin', eventId: 'long-grant-1', accountId: C.id, eventType: 'support-grant', productId: 'pri-premium-support', plan: 'premium', status: 'active', currentPeriodEnd: end + 100 * DAY, now });
  await grantHscPass(store, { accountId: C.id, examYear: 2027, paymentRef: 'pi_test_00000004', now });
  c.eq(Number((await row(C.id)).current_period_end), end + 100 * DAY, 'a longer support grant still pays: the pass does not shorten it');
  await applyVerifiedEntitlement(store, { verified: true, provider: 'admin', eventId: 'short-grant-1', accountId: A.id, eventType: 'support-grant', productId: 'pri-premium-support', plan: 'premium', status: 'active', currentPeriodEnd: now + 7 * DAY, now });
  c.eq(Number((await row(A.id)).current_period_end), end - 1, 'a shorter source arriving later does not shorten the pass');

  // 5 · refunds
  const R = await revokeHscPass(store, { accountId: C.id, paymentRef: 'pi_test_00000004', now: now + 5 * DAY });
  c.eq(R.revoked, true, 'a full refund removes the pass grant');
  c.eq(Number((await row(C.id)).current_period_end), end + 100 * DAY, 'and whatever else pays still does');
  const D = await account();
  await grantHscPass(store, { accountId: D.id, examYear: 2027, paymentRef: 'pi_test_00000005', now });
  c.ok((await caps(D.id, now + DAY)).length > 0, 'before the refund: Premium');
  const R2 = await revokeHscPass(store, { accountId: D.id, paymentRef: 'pi_test_00000005', now: now + 2 * DAY });
  c.deq([R2.revoked, await caps(D.id, now + 2 * DAY)], [true, []], 'a refund ends Premium at once when nothing else pays');
  c.eq((await row(D.id)).status, 'revoked', 'the row says so');
  c.eq((await revokeHscPass(store, { accountId: D.id, paymentRef: 'pi_test_00000005', now: now + 3 * DAY })).revoked, false, 'a second refund event changes nothing');
  const other = await account();
  c.eq((await revokeHscPass(store, { accountId: other.id, paymentRef: 'pi_test_00000005', now })).revoked, false, 'a refund reference for another account removes nothing');
} finally {
  await h.close();
}
console.log(`HSC PASS GRANT: PASS — ${c.count()}/${c.count()} checks [SYNTHETIC accounts; no payment provider touched; checkout stays off]`);
