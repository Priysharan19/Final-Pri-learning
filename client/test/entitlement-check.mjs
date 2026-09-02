import assert from 'node:assert/strict';
import { ENTITLEMENTS, entitlementDecision, hasEntitlement, normalizeEntitlementSnapshot } from '../src/platform/entitlements.js';

const now = 2_000_000_000_000;

const forged = normalizeEntitlementSnapshot({ plan: 'premium', status: 'active' }, now);
assert.equal(forged.active, false, 'premium label without bounded authority must fail closed');
assert.equal(hasEntitlement(forged, ENTITLEMENTS.UNLIMITED_PRACTICE, now), false);

const active = normalizeEntitlementSnapshot({
  plan: 'premium', status: 'active', provider: 'apple',
  currentPeriodEnd: now + 86_400_000,
  offlineUntil: now + 43_200_000,
  issuedAt: now - 1000,
  sourceVersion: 7
}, now);
assert.equal(active.active, true);
for (const capability of Object.values(ENTITLEMENTS)) assert.equal(hasEntitlement(active, capability, now), true);

const expiredOffline = {
  plan: 'premium', status: 'active', provider: 'google',
  currentPeriodEnd: now + 86_400_000,
  offlineUntil: now - 1,
  sourceVersion: 4
};
assert.equal(hasEntitlement(expiredOffline, ENTITLEMENTS.PREMIUM_EXAMS, now), false);
assert.equal(entitlementDecision(expiredOffline, ENTITLEMENTS.PREMIUM_EXAMS, { online: false, now }).reason, 'offline-entitlement-expired');

const grace = normalizeEntitlementSnapshot({
  plan: 'premium', status: 'grace', provider: 'web',
  graceUntil: now + 10_000,
  currentPeriodEnd: now - 10_000,
  offlineUntil: now + 10_000
}, now);
assert.equal(grace.active, true, 'grace period should retain entitlements only inside the authoritative grace window');
assert.equal(normalizeEntitlementSnapshot({ ...grace, graceUntil: now - 1 }, now).active, false);

for (const status of ['past_due', 'expired', 'revoked', 'paused', 'free']) {
  assert.equal(normalizeEntitlementSnapshot({ plan: 'premium', status, currentPeriodEnd: now + 1e9, offlineUntil: now + 1e9 }, now).active, false, `${status} must not unlock paid capabilities`);
}

console.log('PASS — premium entitlements are server-authoritative, time-bounded and fail closed when offline authority expires.');
