import { Router } from 'express';
import { rateLimit, requireRole, requireSession, sha256 } from './security.js';

const PAID = new Set(['trialing', 'active', 'grace']);
const STATUS = new Set(['free', 'trialing', 'active', 'grace', 'paused', 'past_due', 'expired', 'revoked']);
const PROVIDER = new Set(['none', 'apple', 'google', 'web', 'admin']);
const MAX_OFFLINE_MS = 7 * 24 * 60 * 60 * 1000;

export const PREMIUM_CAPABILITIES = Object.freeze([
  'unlimited-practice', 'advanced-pri-explain', 'premium-exams',
  'jee-advanced-content', 'advanced-analytics', 'additional-ai-usage'
]);

export function publicEntitlement(row, now = Date.now()) {
  const status = STATUS.has(row?.status) ? row.status : 'free';
  const plan = row?.plan === 'premium' ? 'premium' : 'free';
  const periodEnd = Number(row?.current_period_end) || null;
  const graceUntil = Number(row?.grace_until) || null;
  const lifecycleEnd = status === 'grace' ? graceUntil : periodEnd;
  const paid = plan === 'premium' && PAID.has(status) && lifecycleEnd != null && lifecycleEnd >= now;
  const offlineUntil = paid ? Math.min(Number(row?.offline_until) || 0, lifecycleEnd, now + MAX_OFFLINE_MS) : null;
  const active = paid && offlineUntil >= now;
  return {
    plan: active ? 'premium' : 'free',
    billingPlan: plan,
    status,
    provider: PROVIDER.has(row?.provider) ? row.provider : 'none',
    productId: row?.product_id || null,
    currentPeriodEnd: periodEnd,
    graceUntil,
    offlineUntil,
    issuedAt: now,
    sourceVersion: Math.max(0, Number(row?.source_version) || 0),
    capabilities: active ? PREMIUM_CAPABILITIES : []
  };
}

function subscriptionState(db, provider, providerSubscriptionId) {
  if (!providerSubscriptionId) return null;
  return db.prepare(`SELECT account_id,last_effective_at,last_event_rank,last_event_id
    FROM billing_subscriptions WHERE provider=? AND provider_subscription_id=?`)
    .get(provider, providerSubscriptionId);
}

function staleSubscriptionEvent(prior, effectiveAt, eventRank) {
  if (!prior) return false;
  const previousAt = Math.max(0, Number(prior.last_effective_at) || 0);
  const previousRank = Math.max(0, Number(prior.last_event_rank) || 0);
  if (effectiveAt < previousAt) return true;
  return effectiveAt === previousAt && eventRank < previousRank;
}

export function applyVerifiedEntitlement(db, {
  verified, provider, eventId, accountId, eventType, productId = null,
  plan = 'free', status = 'free', currentPeriodEnd = null, graceUntil = null,
  offlineUntil = null, payloadDigest = '', now = Date.now(),
  providerSubscriptionId = null, effectiveAt = now, eventRank = 0
}) {
  if (verified !== true) throw new Error('Unverified billing events cannot change entitlements');
  if (!PROVIDER.has(provider) || provider === 'none' || !eventId || !eventType || !accountId) throw new Error('Billing event metadata is incomplete');
  if (!STATUS.has(status) || !['free', 'premium'].includes(plan)) throw new Error('Billing lifecycle is invalid');
  if (!db.prepare('SELECT id FROM accounts WHERE id=? AND deleted_at IS NULL').get(accountId)) throw new Error('Billing event account does not exist');
  const eventTime = Math.max(0, Number(effectiveAt) || 0);
  const rank = Math.max(0, Math.floor(Number(eventRank) || 0));

  return db.transaction(() => {
    const existing = db.prepare('SELECT applied_at FROM billing_events WHERE provider=? AND event_id=?').get(provider, eventId);
    if (existing?.applied_at) return {
      replayed: true,
      stale: false,
      snapshot: publicEntitlement(db.prepare('SELECT * FROM entitlement_snapshots WHERE account_id=?').get(accountId), now)
    };
    if (!existing) {
      db.prepare(`INSERT INTO billing_events(provider,event_id,account_id,event_type,verified,payload_digest,received_at)
        VALUES (?,?,?,?,1,?,?)`).run(provider, eventId, accountId, eventType, payloadDigest || sha256(`${provider}:${eventId}`), now);
    }

    const subscription = subscriptionState(db, provider, providerSubscriptionId);
    if (subscription && subscription.account_id !== accountId) throw new Error('Billing subscription is bound to another account');
    if (subscription && staleSubscriptionEvent(subscription, eventTime, rank)) {
      db.prepare('UPDATE billing_events SET applied_at=? WHERE provider=? AND event_id=?').run(now, provider, eventId);
      return {
        replayed: false,
        stale: true,
        snapshot: publicEntitlement(db.prepare('SELECT * FROM entitlement_snapshots WHERE account_id=?').get(accountId), now)
      };
    }

    const prior = db.prepare('SELECT source_version FROM entitlement_snapshots WHERE account_id=?').get(accountId);
    const version = Math.max(0, Number(prior?.source_version) || 0) + 1;
    const lifecycleEnd = status === 'grace' ? Number(graceUntil) || null : Number(currentPeriodEnd) || null;
    const safeOffline = plan === 'premium' && PAID.has(status) && lifecycleEnd
      ? Math.min(Number(offlineUntil) || (now + MAX_OFFLINE_MS), lifecycleEnd, now + MAX_OFFLINE_MS)
      : null;
    db.prepare(`INSERT INTO entitlement_snapshots
      (account_id,plan,status,provider,product_id,current_period_end,grace_until,offline_until,source_version,updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?)
      ON CONFLICT(account_id) DO UPDATE SET plan=excluded.plan,status=excluded.status,provider=excluded.provider,
        product_id=excluded.product_id,current_period_end=excluded.current_period_end,grace_until=excluded.grace_until,
        offline_until=excluded.offline_until,source_version=excluded.source_version,updated_at=excluded.updated_at`)
      .run(accountId, plan, status, provider, productId, currentPeriodEnd, graceUntil, safeOffline, version, now);

    if (subscription && providerSubscriptionId) {
      db.prepare(`UPDATE billing_subscriptions SET product_id=COALESCE(?,product_id),updated_at=?,last_effective_at=?,last_event_rank=?,last_event_id=?
        WHERE provider=? AND provider_subscription_id=?`)
        .run(productId || null, now, eventTime, rank, eventId, provider, providerSubscriptionId);
    }
    db.prepare('UPDATE billing_events SET applied_at=? WHERE provider=? AND event_id=?').run(now, provider, eventId);
    return {
      replayed: false,
      stale: false,
      snapshot: publicEntitlement(db.prepare('SELECT * FROM entitlement_snapshots WHERE account_id=?').get(accountId), now)
    };
  })();
}

export function createEntitlementRouter(db) {
  const router = Router();
  router.get('/', requireSession(db), rateLimit(db, 'entitlements', { limit: 120, windowMs: 60 * 1000 }), (req, res) => {
    const row = db.prepare('SELECT * FROM entitlement_snapshots WHERE account_id=?').get(req.platformSession.account_id) || { plan: 'free', status: 'free', provider: 'none' };
    res.set('Cache-Control', 'no-store');
    res.json({ entitlement: publicEntitlement(row) });
  });

  // Support/admin override is intentionally server-authorised and audited. This
  // is not a payment bypass: it exists for support grants/testing and is never
  // callable by a student client role.
  router.post('/admin/grant', requireSession(db), requireRole('admin'), rateLimit(db, 'entitlement-admin', { limit: 30, windowMs: 60 * 1000 }), (req, res) => {
    const accountId = String(req.body?.accountId || '');
    const durationMs = Math.max(60_000, Math.min(365 * 24 * 60 * 60 * 1000, Number(req.body?.durationMs) || 0));
    const now = Date.now();
    const result = applyVerifiedEntitlement(db, {
      verified: true, provider: 'admin', eventId: `admin-${req.platformSession.account_id}-${now}`,
      accountId, eventType: 'support-grant', productId: 'pri-premium-support', plan: 'premium', status: 'active',
      currentPeriodEnd: now + durationMs, offlineUntil: now + Math.min(durationMs, MAX_OFFLINE_MS),
      payloadDigest: sha256(JSON.stringify({ actor: req.platformSession.account_id, accountId, durationMs })), now
    });
    db.prepare(`INSERT INTO audit_log(actor_account_id,action,target_kind,target_id,metadata_json,created_at)
      VALUES (?,?,?,?,?,?)`).run(req.platformSession.account_id, 'entitlement.grant', 'account', accountId, JSON.stringify({ durationMs }), now);
    res.json(result);
  });
  return router;
}
