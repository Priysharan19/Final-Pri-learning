import { asyncRouter } from './asyncRouter.js';
import { asStore } from './store.js';
import { opaqueToken, rateLimit, requireRole, requireSession, sha256 } from './security.js';

export const PAID = new Set(['trialing', 'active', 'grace']);
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
  // The offline window is issued afresh on every read: a device may run up to
  // seven days (never past the paid lifecycle) on the snapshot it fetched now.
  // It used to be capped by the offline_until stored when the last billing
  // event was applied, so the server itself stopped reporting Premium seven
  // days after a purchase or renewal — three weeks of every monthly period —
  // for the device AND for server-gated features (tutor allowance).
  const offlineUntil = paid ? Math.min(lifecycleEnd, now + MAX_OFFLINE_MS) : null;
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
  return await db.get(`SELECT account_id,last_effective_at,last_event_rank,last_event_id,
      state_plan,state_status,state_period_end,state_grace_until
    FROM billing_subscriptions WHERE provider=? AND provider_subscription_id=?`, [provider, providerSubscriptionId]);
}

/**
 * Whether a verified event is older than what its subscription already applied.
 * Order is the provider's signed time; an equal time is broken by rank so a
 * refund signed in the same millisecond as a renewal still wins.
 */
export function staleSubscriptionEvent(prior, effectiveAt, eventRank) {
  if (!prior) return false;
  const previousAt = Math.max(0, Number(prior.last_effective_at) || 0);
  const previousRank = Math.max(0, Number(prior.last_event_rank) || 0);
  if (effectiveAt < previousAt) return true;
  return effectiveAt === previousAt && eventRank < previousRank;
}

/** The instant a paid lifecycle ends: the grace deadline in grace, else the period end. */
export function lifecycleEnd({ status, currentPeriodEnd, graceUntil }) {
  return status === 'grace' ? Number(graceUntil) || null : Number(currentPeriodEnd) || null;
}

/** A lifecycle that entitles the account to Premium at `now`. */
export function paidAt(state, now) {
  if (!state || state.plan !== 'premium' || !PAID.has(state.status)) return false;
  const end = lifecycleEnd(state);
  return end != null && end >= now;
}

function subscriptionRowState(row) {
  if (!row?.state_plan || !row?.state_status) return null;
  return {
    plan: row.state_plan,
    status: row.state_status,
    currentPeriodEnd: Number(row.state_period_end) || null,
    graceUntil: Number(row.state_grace_until) || null
  };
}

/**
 * The account entitlement after one subscription's lifecycle changed.
 *
 * The event's own lifecycle wins when it is paid. When it is not (expiry,
 * refund, billing failure), Premium that the account still holds from another
 * source is kept: another subscription whose last verified lifecycle is still
 * paid, or a support grant already in the snapshot. Without this an expired
 * or refunded subscription on one Apple ID silently removed Premium that a
 * second, live subscription was paying for. Pure, so the reconciliation tool
 * derives the same answer from stored signed data.
 */
export function selectEntitlementSource(eventState, alternatives, now) {
  if (paidAt(eventState, now)) return eventState;
  const live = alternatives.filter(candidate => paidAt(candidate, now))
    .sort((a, b) => (lifecycleEnd(b) || 0) - (lifecycleEnd(a) || 0));
  return live[0] || eventState;
}

async function alternativeSources(db, accountId, provider, providerSubscriptionId) {
  const rows = await db.all(`SELECT provider,provider_subscription_id,product_id,state_plan,state_status,state_period_end,state_grace_until
    FROM billing_subscriptions WHERE account_id=? AND state_plan IS NOT NULL`, [accountId]);
  const out = [];
  for (const row of rows) {
    if (row.provider === provider && row.provider_subscription_id === providerSubscriptionId) continue;
    const state = subscriptionRowState(row);
    if (state) out.push({ ...state, provider: row.provider, productId: row.product_id, offlineUntil: null });
  }
  // A support grant has no subscription row; the snapshot is its only record.
  const snapshot = await db.get('SELECT * FROM entitlement_snapshots WHERE account_id=?', [accountId]);
  if (snapshot?.provider === 'admin') {
    out.push({
      plan: snapshot.plan, status: snapshot.status, provider: 'admin', productId: snapshot.product_id,
      currentPeriodEnd: Number(snapshot.current_period_end) || null, graceUntil: Number(snapshot.grace_until) || null,
      offlineUntil: Number(snapshot.offline_until) || null
    });
  }
  return out;
}

export async function applyVerifiedEntitlement(db, {
  verified, provider, eventId, accountId, eventType, productId = null,
  plan = 'free', status = 'free', currentPeriodEnd = null, graceUntil = null,
  offlineUntil = null, payloadDigest = '', now = Date.now(),
  providerSubscriptionId = null, effectiveAt = now, eventRank = 0, advisory = false
}) {
  if (verified !== true) throw new Error('Unverified billing events cannot change entitlements');
  if (!PROVIDER.has(provider) || provider === 'none' || !eventId || !eventType || !accountId) throw new Error('Billing event metadata is incomplete');
  if (!STATUS.has(status) || !['free', 'premium'].includes(plan)) throw new Error('Billing lifecycle is invalid');
  db = asStore(db);
  const eventTime = Math.max(0, Number(effectiveAt) || 0);
  const rank = Math.max(0, Math.floor(Number(eventRank) || 0));
  const snapshotNow = async () => publicEntitlement(await db.get('SELECT * FROM entitlement_snapshots WHERE account_id=?', [accountId]), now);

  // One transaction from the replay check to applied_at: a provider that
  // delivers the same event twice at once (webhook retry racing the first
  // delivery) applies it exactly once. SQLite serialises the two; on Postgres
  // the loser's SERIALIZABLE transaction fails, re-runs, and finds it applied.
  return await db.transaction(async () => {
    if (!await db.get('SELECT id FROM accounts WHERE id=? AND deleted_at IS NULL', [accountId])) throw new Error('Billing event account does not exist');
    const existing = await db.get('SELECT applied_at FROM billing_events WHERE provider=? AND event_id=?', [provider, eventId]);
    if (existing?.applied_at) return { replayed: true, stale: false, snapshot: await snapshotNow() };
    if (!existing) {
      await db.run(`INSERT INTO billing_events(provider,event_id,account_id,event_type,verified,payload_digest,received_at)
        VALUES (?,?,?,?,1,?,?)`, [provider, eventId, accountId, eventType, payloadDigest || sha256(`${provider}:${eventId}`), now]);
    }
    const markApplied = () => db.run('UPDATE billing_events SET applied_at=? WHERE provider=? AND event_id=?', [now, provider, eventId]);

    const subscription = await subscriptionState(db, provider, providerSubscriptionId);
    if (subscription && subscription.account_id !== accountId) throw new Error('Billing subscription is bound to another account');
    if (subscription && staleSubscriptionEvent(subscription, eventTime, rank)) {
      await markApplied();
      return { replayed: false, stale: true, snapshot: await snapshotNow() };
    }
    // An advisory event only reports that a transaction's own period is over
    // (its expiresDate passed, or it was superseded by an upgrade). It carries
    // no renewal information, so it never ends a lifecycle the subscription
    // last verified as paid: a grace period granted by Apple's billing-retry
    // notification, or the upgraded transaction that replaced it, still
    // stands. Time alone ends a paid lifecycle at its own end (publicEntitlement).
    if (subscription && advisory && plan !== 'premium') {
      const prior = subscriptionRowState(subscription);
      if (prior && prior.plan === 'premium' && PAID.has(prior.status)) {
        await markApplied();
        return { replayed: false, stale: true, superseded: 'advisory', snapshot: await snapshotNow() };
      }
    }

    const eventState = { plan, status, provider, productId, currentPeriodEnd, graceUntil, offlineUntil };
    const source = subscription && providerSubscriptionId
      ? selectEntitlementSource(eventState, await alternativeSources(db, accountId, provider, providerSubscriptionId), now)
      : eventState;

    const prior = await db.get('SELECT source_version FROM entitlement_snapshots WHERE account_id=?', [accountId]);
    const version = Math.max(0, Number(prior?.source_version) || 0) + 1;
    const sourceEnd = lifecycleEnd(source);
    const safeOffline = source.plan === 'premium' && PAID.has(source.status) && sourceEnd
      ? Math.min(Number(source.offlineUntil) || (now + MAX_OFFLINE_MS), sourceEnd, now + MAX_OFFLINE_MS)
      : null;
    await db.run(`INSERT INTO entitlement_snapshots
      (account_id,plan,status,provider,product_id,current_period_end,grace_until,offline_until,source_version,updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?)
      ON CONFLICT(account_id) DO UPDATE SET plan=excluded.plan,status=excluded.status,provider=excluded.provider,
        product_id=excluded.product_id,current_period_end=excluded.current_period_end,grace_until=excluded.grace_until,
        offline_until=excluded.offline_until,source_version=excluded.source_version,updated_at=excluded.updated_at`,
    [accountId, source.plan, source.status, source.provider, source.productId, source.currentPeriodEnd, source.graceUntil, safeOffline, version, now]);

    if (subscription && providerSubscriptionId) {
      // An advisory event changes the lifecycle but not the ordering clock: it
      // is derived from time, not a newer signed statement, so an older
      // authoritative notification that arrives after it (a delayed grace or
      // refund) must still apply.
      const orderAt = advisory ? Math.max(0, Number(subscription.last_effective_at) || 0) : eventTime;
      const orderRank = advisory ? Math.max(0, Number(subscription.last_event_rank) || 0) : rank;
      await db.run(`UPDATE billing_subscriptions SET product_id=COALESCE(?,product_id),updated_at=?,last_effective_at=?,last_event_rank=?,last_event_id=?,
          state_plan=?,state_status=?,state_period_end=?,state_grace_until=?
        WHERE provider=? AND provider_subscription_id=?`,
      [productId || null, now, orderAt, orderRank, eventId, plan, status, currentPeriodEnd, status === 'grace' ? graceUntil : null, provider, providerSubscriptionId]);
    }
    await markApplied();
    return { replayed: false, stale: false, snapshot: await snapshotNow() };
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
    // The account id lets a device refuse to file this snapshot under a
    // different local profile's account when the device-wide session belongs
    // to someone else (client/src/platform/cloudAccount.js).
    res.json({ accountId: req.platformSession.account_id, entitlement: publicEntitlement(row) });
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
