// Pri Learning · premium entitlement contract
//
// UI code must ask hasEntitlement(snapshot, capability). It must never infer
// Premium from a local toggle, receipt-shaped object, plan label or price.
// The cloud authority issues a bounded offline_until so paid access can survive
// travel/network loss without becoming a permanent forgeable local flag.

export const ENTITLEMENTS = Object.freeze({
  UNLIMITED_PRACTICE: 'unlimited-practice',
  ADVANCED_EXPLAIN: 'advanced-pri-explain',
  PREMIUM_EXAMS: 'premium-exams',
  JEE_ADVANCED: 'jee-advanced-content',
  ADVANCED_ANALYTICS: 'advanced-analytics',
  EXTRA_AI: 'additional-ai-usage'
});

export const PLAN_CAPABILITIES = Object.freeze({
  free: Object.freeze([]),
  premium: Object.freeze(Object.values(ENTITLEMENTS))
});

export const BILLING_STATUS = Object.freeze(new Set([
  'free', 'trialing', 'active', 'grace', 'paused', 'past_due', 'expired', 'revoked'
]));

export const DEFAULT_PUBLIC_PRICING = Object.freeze({
  currency: 'INR',
  monthlyDisplay: 1000,
  annualDisplay: 10000,
  trialDaysDisplay: 7,
  // Store/provider product identifiers and authoritative prices are deliberately
  // absent. They come from server configuration/storefront APIs, not this client.
  advisoryOnly: true
});

function finiteMs(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
}

export function normalizeEntitlementSnapshot(raw, now = Date.now()) {
  const source = raw && typeof raw === 'object' ? raw : {};
  const status = BILLING_STATUS.has(source.status) ? source.status : 'free';
  const plan = source.plan === 'premium' ? 'premium' : 'free';
  const currentPeriodEnd = finiteMs(source.currentPeriodEnd);
  const graceUntil = finiteMs(source.graceUntil);
  const offlineUntil = finiteMs(source.offlineUntil);
  const issuedAt = finiteMs(source.issuedAt);
  const sourceVersion = Math.max(0, Math.floor(Number(source.sourceVersion) || 0));
  const provider = ['apple', 'google', 'web', 'admin', 'none'].includes(source.provider) ? source.provider : 'none';

  // Entitlement becomes usable only when a server-issued paid lifecycle is
  // currently valid. A stale local plan='premium' is insufficient by design.
  const paidLifecycle = plan === 'premium' && ['trialing', 'active', 'grace'].includes(status);
  const lifecycleEnd = status === 'grace' ? graceUntil : currentPeriodEnd;
  const serverWindowValid = paidLifecycle && lifecycleEnd != null && lifecycleEnd >= now;
  const offlineWindowValid = paidLifecycle && offlineUntil != null && offlineUntil >= now;
  const active = serverWindowValid && offlineWindowValid;

  const capabilities = active ? PLAN_CAPABILITIES.premium : PLAN_CAPABILITIES.free;
  return Object.freeze({
    plan: active ? 'premium' : 'free',
    billingPlan: plan,
    status,
    provider,
    currentPeriodEnd,
    graceUntil,
    offlineUntil,
    issuedAt,
    sourceVersion,
    active,
    capabilities,
    stale: paidLifecycle && !active
  });
}

export function hasEntitlement(snapshot, capability, now = Date.now()) {
  if (!Object.values(ENTITLEMENTS).includes(capability)) return false;
  return normalizeEntitlementSnapshot(snapshot, now).capabilities.includes(capability);
}

export function entitlementDecision(snapshot, capability, { online = true, now = Date.now() } = {}) {
  const normalized = normalizeEntitlementSnapshot(snapshot, now);
  if (normalized.capabilities.includes(capability)) {
    return Object.freeze({ allowed: true, reason: online ? 'authoritative-cache-valid' : 'offline-cache-valid', snapshot: normalized });
  }
  if (!online && normalized.billingPlan === 'premium') {
    return Object.freeze({ allowed: false, reason: 'offline-entitlement-expired', refreshRequired: true, snapshot: normalized });
  }
  return Object.freeze({ allowed: false, reason: normalized.status === 'past_due' ? 'payment-recovery-required' : 'not-entitled', snapshot: normalized });
}
