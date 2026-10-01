import { asyncRouter } from './asyncRouter.js';
import { asStore } from './store.js';
import { opaqueToken, rateLimit, requireRole, requireSession, sha256 } from './security.js';

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

async function subscriptionState(db, provider, providerSubscriptionId) {
  if (!providerSubscriptionId) return null;
  return await db.get(`SELECT account_id,last_effective_at,last_event_rank,last_event_id
    FROM billing_subscriptions WHERE provider=? AND provider_subscription_id=?`, [provider, providerSubscriptionId]);
}

function staleSubscriptionEvent(prior, effectiveAt, eventRank) {
  if (!prior) return false;
  const previousAt = Math.max(0, Number(prior.last_effective_at) || 0);
  const previousRank = Math.max(0, Number(prior.last_event_rank) || 0);
  if (effectiveAt < previousAt) return true;
  return effectiveAt === previousAt && eventRank < previousRank;
}

export async function applyVerifiedEntitlement(db, {
  verified, provider, eventId, accountId, eventType, productId = null,
  plan = 'free', status = 'free', currentPeriodEnd = null, graceUntil = null,
  offlineUntil = null, payloadDigest = '', now = Date.now(),
  providerSubscriptionId = null, effectiveAt = now, eventRank = 0
}) {
  if (verified !== true) throw new Error('Unverified billing events cannot change entitlements');
  if (!PROVIDER.has(provider) || provider === 'none' || !eventId || !eventType || !accountId) throw new Error('Billing event metadata is incomplete');
  if (!STATUS.has(status) || !['free', 'premium'].includes(plan)) throw new Error('Billing lifecycle is invalid');
  db = asStore(db);
  const eventTime = Math.max(0, Number(effectiveAt) || 0);
  const rank = Math.max(0, Math.floor(Number(eventRank) || 0));

  // One transaction from the replay check to applied_at: a provider that
  // delivers the same event twice at once (webhook retry racing the first
  // delivery) applies it exactly once. SQLite serialises the two; on Postgres
  // the loser's SERIALIZABLE transaction fails, re-runs, and finds it applied.
  return await db.transaction(async () => {
    if (!await db.get('SELECT id FROM accounts WHERE id=? AND deleted_at IS NULL', [accountId])) throw new Error('Billing event account does not exist');
    const existing = await db.get('SELECT applied_at FROM billing_events WHERE provider=? AND event_id=?', [provider, eventId]);
    if (existing?.applied_at) return {
      replayed: true,
      stale: false,
      snapshot: publicEntitlement(await db.get('SELECT * FROM entitlement_snapshots WHERE account_id=?', [accountId]), now)
    };
    if (!existing) {
      await db.run(`INSERT INTO billing_events(provider,event_id,account_id,event_type,verified,payload_digest,received_at)
        VALUES (?,?,?,?,1,?,?)`, [provider, eventId, accountId, eventType, payloadDigest || sha256(`${provider}:${eventId}`), now]);
    }

    const subscription = await subscriptionState(db, provider, providerSubscriptionId);
    if (subscription && subscription.account_id !== accountId) throw new Error('Billing subscription is bound to another account');
    if (subscription && staleSubscriptionEvent(subscription, eventTime, rank)) {
      await db.run('UPDATE billing_events SET applied_at=? WHERE provider=? AND event_id=?', [now, provider, eventId]);
      return {
        replayed: false,
        stale: true,
        snapshot: publicEntitlement(await db.get('SELECT * FROM entitlement_snapshots WHERE account_id=?', [accountId]), now)
      };
    }

    const prior = await db.get('SELECT source_version FROM entitlement_snapshots WHERE account_id=?', [accountId]);
    const version = Math.max(0, Number(prior?.source_version) || 0) + 1;
    const lifecycleEnd = status === 'grace' ? Number(graceUntil) || null : Number(currentPeriodEnd) || null;
    const safeOffline = plan === 'premium' && PAID.has(status) && lifecycleEnd
      ? Math.min(Number(offlineUntil) || (now + MAX_OFFLINE_MS), lifecycleEnd, now + MAX_OFFLINE_MS)
      : null;
    await db.run(`INSERT INTO entitlement_snapshots
      (account_id,plan,status,provider,product_id,current_period_end,grace_until,offline_until,source_version,updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?)
      ON CONFLICT(account_id) DO UPDATE SET plan=excluded.plan,status=excluded.status,provider=excluded.provider,
        product_id=excluded.product_id,current_period_end=excluded.current_period_end,grace_until=excluded.grace_until,
        offline_until=excluded.offline_until,source_version=excluded.source_version,updated_at=excluded.updated_at`, [accountId, plan, status, provider, productId, currentPeriodEnd, graceUntil, safeOffline, version, now]);

    if (subscription && providerSubscriptionId) {
      await db.run(`UPDATE billing_subscriptions SET product_id=COALESCE(?,product_id),updated_at=?,last_effective_at=?,last_event_rank=?,last_event_id=?
        WHERE provider=? AND provider_subscription_id=?`, [productId || null, now, eventTime, rank, eventId, provider, providerSubscriptionId]);
    }
    await db.run('UPDATE billing_events SET applied_at=? WHERE provider=? AND event_id=?', [now, provider, eventId]);
    return {
      replayed: false,
      stale: false,
      snapshot: publicEntitlement(await db.get('SELECT * FROM entitlement_snapshots WHERE account_id=?', [accountId]), now)
    };
  });
}

/**
 * The id of one support grant.
 *
 * It names the actor, the target and the moment, and carries a random tail.
 * Keyed on actor and clock alone, two grants issued in the same millisecond — a
 * bulk grant loop, two support staff, one script — produced the same id, and
 * the second was then indistinguishable from a replay of the first: the second
 * student got no entitlement while the audit log recorded a grant that never
 * happened.
 */
export function supportGrantEventId({ actorAccountId, accountId, now }) {
  return `admin-${actorAccountId}-${accountId}-${now}-${opaqueToken(9)}`;
}

export function createEntitlementRouter(db, { grantEventId = supportGrantEventId } = {}) {
  db = asStore(db);
  const router = asyncRouter();
  router.get('/', requireSession(db), rateLimit(db, 'entitlements', { limit: 120, windowMs: 60 * 1000 }), async (req, res) => {
    const row = await db.get('SELECT * FROM entitlement_snapshots WHERE account_id=?', [req.platformSession.account_id]) || { plan: 'free', status: 'free', provider: 'none' };
    res.set('Cache-Control', 'no-store');
    res.json({ entitlement: publicEntitlement(row) });
  });

  // Support/admin override is intentionally server-authorised and audited. This
  // is not a payment bypass: it exists for support grants/testing and is never
  // callable by a student client role.
  router.post('/admin/grant', requireSession(db), requireRole('admin'), rateLimit(db, 'entitlement-admin', { limit: 30, windowMs: 60 * 1000 }), async (req, res) => {
    const accountId = String(req.body?.accountId || '');
    const durationMs = Math.max(60_000, Math.min(365 * 24 * 60 * 60 * 1000, Number(req.body?.durationMs) || 0));
    const now = Date.now();
    // Injectable only so a contract can force the replay branch below; production
    // always uses supportGrantEventId.
    const eventId = grantEventId({ actorAccountId: req.platformSession.account_id, accountId, now });
    const result = await applyVerifiedEntitlement(db, {
      verified: true, provider: 'admin', eventId,
      accountId, eventType: 'support-grant', productId: 'pri-premium-support', plan: 'premium', status: 'active',
      currentPeriodEnd: now + durationMs, offlineUntil: now + Math.min(durationMs, MAX_OFFLINE_MS),
      payloadDigest: sha256(JSON.stringify({ actor: req.platformSession.account_id, accountId, durationMs })), now
    });
    // Nothing was applied, so nothing is recorded as applied. A grant the audit
    // log claims but the entitlement table never received is worse than a
    // failure the operator can see and retry.
    if (result.replayed) {
      return res.status(409).json({ error: { code: 'ENTITLEMENT_GRANT_REPLAYED', message: 'This grant was already applied and was not applied again.' } });
    }
    await db.run(`INSERT INTO audit_log(actor_account_id,action,target_kind,target_id,metadata_json,created_at)
      VALUES (?,?,?,?,?,?)`, [req.platformSession.account_id, 'entitlement.grant', 'account', accountId, JSON.stringify({ durationMs }), now]);
    res.json(result);
  });
  return router;
}
