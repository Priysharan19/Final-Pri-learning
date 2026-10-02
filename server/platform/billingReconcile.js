// Pri Learning · App Store entitlement reconciliation (§19)
//
// Recomputes one account's Apple entitlement from the Apple-signed data the
// server already verified and stored (billing_apple_signed_events), and
// reports where the stored subscription states or the entitlement snapshot
// drifted from it. Read-only: it never writes, and it never calls Apple. When
// it reports drift, the operator fetches Apple's own history (App Store Server
// API, Get Transaction History) and submits it through the normal verified
// path — docs/operations/billing-reconciliation.md.
//
// Every stored JWS is re-verified against the configured Apple roots and
// re-interpreted with the same pure functions the live webhook and device
// paths use (appleEventFromSigned), then replayed through the same ordering
// rules as applyVerifiedEntitlement: newer signed time wins, a tie goes to the
// higher rank, and an advisory event (a transaction's own period lapsing)
// never ends a paid lifecycle nor moves the ordering clock.
import { appleBillingConfig, appleEventFromSigned } from './appleBilling.js';
import { PAID, lifecycleEnd, paidAt, publicEntitlement, staleSubscriptionEvent } from './entitlements.js';
import { asStore } from './store.js';

function appleTransactionToken(jws) {
  try { return String(JSON.parse(Buffer.from(jws.split('.')[1], 'base64url').toString('utf8'))?.appAccountToken || '') || null; }
  catch { return null; }
}

/** What a lifecycle means at `now`: a paid status whose end has passed is lapsed. */
export function effectiveStatus(state, now) {
  if (!state) return 'none';
  if (state.plan === 'premium' && PAID.has(state.status) && !paidAt(state, now)) return 'expired';
  return state.status;
}

function stateFromRow(row) {
  if (!row?.state_plan || !row?.state_status) return null;
  return {
    plan: row.state_plan, status: row.state_status,
    currentPeriodEnd: Number(row.state_period_end) || null,
    graceUntil: Number(row.state_grace_until) || null
  };
}

/** Replay verified events for one subscription; the same rules as the live path. */
export function replaySubscription(events) {
  const ordered = [...events].sort((a, b) => a.effectiveAt - b.effectiveAt || a.eventRank - b.eventRank || String(a.eventId).localeCompare(String(b.eventId)));
  let marker = null;
  let state = null;
  const trail = [];
  for (const event of ordered) {
    if (marker && staleSubscriptionEvent(marker, event.effectiveAt, event.eventRank)) {
      trail.push({ eventId: event.eventId, eventType: event.eventType, outcome: 'stale' });
      continue;
    }
    if (event.advisory && event.plan !== 'premium' && state?.plan === 'premium' && PAID.has(state.status)) {
      trail.push({ eventId: event.eventId, eventType: event.eventType, outcome: 'advisory-superseded' });
      continue;
    }
    state = {
      plan: event.plan, status: event.status, currentPeriodEnd: event.currentPeriodEnd,
      graceUntil: event.status === 'grace' ? event.graceUntil : null, productId: event.productId
    };
    if (!event.advisory) marker = { last_effective_at: event.effectiveAt, last_event_rank: event.eventRank };
    trail.push({ eventId: event.eventId, eventType: event.eventType, outcome: 'applied', status: event.status });
  }
  return { state, trail };
}

function sameLifecycle(a, b, now) {
  if (!a || !b) return a === b;
  const effA = effectiveStatus(a, now);
  const effB = effectiveStatus(b, now);
  if (effA !== effB) return false;
  // Only the end of a lifecycle that still entitles is load-bearing.
  if (paidAt(a, now)) return lifecycleEnd(a) === lifecycleEnd(b);
  return true;
}

/**
 * Reconcile one account. Returns a JSON-safe report; `ok` is false when any
 * finding is critical or a warning.
 */
export async function reconcileAppleAccount(db, accountId, { now = Date.now(), cfg = appleBillingConfig(), includeUnbound = false, evidence = null } = {}) {
  db = asStore(db);
  const account = await db.get('SELECT id FROM accounts WHERE id=?', [accountId]);
  if (!account) throw Object.assign(new Error('Account does not exist.'), { code: 'RECONCILE_ACCOUNT_UNKNOWN' });
  const drift = [];
  const subscriptions = await db.all(`SELECT * FROM billing_subscriptions WHERE account_id=? ORDER BY provider, provider_subscription_id`, [accountId]);
  const appleSubs = subscriptions.filter(row => row.provider === 'apple');
  const stored = await db.all(`SELECT * FROM billing_apple_signed_events WHERE account_id=? ORDER BY signed_date, event_id`, [accountId]);
  const byOriginal = new Map();

  // Owner-supplied evidence: signed data the owner fetched from Apple (App
  // Store Server API Get Transaction History → signedTransactions, Get
  // Notification History → signedPayload). It is verified exactly like stored
  // data and replayed alongside it, so the report shows what the entitlement
  // WOULD be with it — nothing is written. Only data for this account counts:
  // its appAccountToken, or a subscription already bound to it.
  const tokenRow = await db.get('SELECT app_account_token FROM billing_apple_accounts WHERE account_id=?', [accountId]);
  const boundOriginals = new Set((await db.all("SELECT provider_subscription_id FROM billing_subscriptions WHERE account_id=? AND provider='apple'", [accountId])).map(row => row.provider_subscription_id));
  const supplied = [
    ...(Array.isArray(evidence?.signedTransactions) ? evidence.signedTransactions : []).map(value => ({ kind: 'transaction', value })),
    ...(Array.isArray(evidence?.signedPayloads) ? evidence.signedPayloads : []).map(value => ({ kind: 'notification', value }))
  ];
  const storedIds = new Set(stored.map(row => row.event_id));
  let evidenceUsed = 0;
  for (const item of supplied) {
    let event;
    try {
      event = appleEventFromSigned(cfg, { kind: item.kind, signedPayload: String(item.value || ''), accountId, now });
    } catch (error) {
      drift.push({ severity: 'warning', kind: 'evidence-invalid', code: error?.code || 'APPLE_SIGNED_DATA_INVALID', message: 'Supplied signed data did not verify; it was ignored.' });
      continue;
    }
    if (!event) continue;
    const token = item.kind === 'transaction' ? appleTransactionToken(String(item.value)) : null;
    const forAccount = boundOriginals.has(event.providerSubscriptionId) || (token && tokenRow && token.toLowerCase() === String(tokenRow.app_account_token).toLowerCase());
    if (!forAccount) { drift.push({ severity: 'info', kind: 'evidence-other-account', originalTransactionId: event.providerSubscriptionId }); continue; }
    const ledgerId = item.kind === 'notification' ? `n:${event.eventId}` : event.eventId;
    if (storedIds.has(ledgerId)) continue;
    evidenceUsed++;
    drift.push({ severity: 'warning', kind: 'evidence-not-stored', eventId: event.eventId, eventType: event.eventType, originalTransactionId: event.providerSubscriptionId, message: 'Apple has signed data for this account that the server never applied.' });
    if (!byOriginal.has(event.providerSubscriptionId)) byOriginal.set(event.providerSubscriptionId, []);
    byOriginal.get(event.providerSubscriptionId).push(event);
  }

  for (const row of stored) {
    let event;
    try {
      event = appleEventFromSigned(cfg, { kind: row.kind, signedPayload: row.signed_payload, accountId, now });
    } catch (error) {
      drift.push({ severity: 'critical', kind: 'signature-invalid', eventId: row.event_id, code: error?.code || 'APPLE_SIGNED_DATA_INVALID', message: 'Stored signed data no longer verifies against the configured Apple roots or app identity.' });
      continue;
    }
    if (!event) continue;
    if (event.providerSubscriptionId !== row.original_transaction_id) {
      drift.push({ severity: 'critical', kind: 'ledger-mismatch', eventId: row.event_id, message: 'Stored ledger row names a different subscription than its signed payload.' });
      continue;
    }
    if (!byOriginal.has(event.providerSubscriptionId)) byOriginal.set(event.providerSubscriptionId, []);
    byOriginal.get(event.providerSubscriptionId).push(event);
  }

  const report = [];
  const recomputedStates = new Map();
  for (const sub of appleSubs) {
    const events = byOriginal.get(sub.provider_subscription_id) || [];
    byOriginal.delete(sub.provider_subscription_id);
    const { state, trail } = replaySubscription(events);
    const storedState = stateFromRow(sub);
    recomputedStates.set(sub.provider_subscription_id, state ? { ...state, provider: 'apple' } : null);
    const entry = {
      provider: 'apple', originalTransactionId: sub.provider_subscription_id, productId: sub.product_id,
      stored: storedState ? { ...storedState, effectiveStatus: effectiveStatus(storedState, now) } : null,
      recomputed: state ? { ...state, effectiveStatus: effectiveStatus(state, now) } : null,
      events: trail
    };
    if (!events.length) {
      drift.push({ severity: storedState && paidAt(storedState, now) ? 'critical' : 'info', kind: 'no-signed-evidence', originalTransactionId: sub.provider_subscription_id, message: 'No stored Apple-signed data backs this subscription (bound before the ledger existed, or never applied).' });
    } else if (!sameLifecycle(storedState, state, now)) {
      drift.push({ severity: 'warning', kind: 'subscription-state', originalTransactionId: sub.provider_subscription_id, stored: entry.stored, recomputed: entry.recomputed });
    }
    report.push(entry);
  }
  for (const [original] of byOriginal) {
    drift.push({ severity: 'warning', kind: 'missing-subscription-binding', originalTransactionId: original, message: 'Signed data for this account names a subscription with no billing_subscriptions binding.' });
  }

  const knownOriginals = appleSubs.map(row => row.provider_subscription_id);
  const unbound = includeUnbound
    ? await db.all('SELECT event_id,original_transaction_id,notification_type,signed_date FROM billing_apple_signed_events WHERE account_id IS NULL ORDER BY signed_date')
    : [];
  for (const row of unbound.filter(r => knownOriginals.includes(r.original_transaction_id))) {
    drift.push({ severity: 'warning', kind: 'unbound-notification-for-account', eventId: row.event_id, originalTransactionId: row.original_transaction_id, notificationType: row.notification_type, message: 'Apple notified about this subscription while no account was bound to it.' });
  }

  // The account entitlement the recomputed subscriptions imply, with the
  // stored non-Apple sources (web/Google subscriptions, a support grant)
  // taken as they are.
  const snapshotRow = await db.get('SELECT * FROM entitlement_snapshots WHERE account_id=?', [accountId]);
  const candidates = [...recomputedStates.values()].filter(Boolean);
  for (const sub of subscriptions.filter(row => row.provider !== 'apple')) {
    const state = stateFromRow(sub);
    if (state) candidates.push({ ...state, provider: sub.provider });
  }
  if (snapshotRow?.provider === 'admin') {
    candidates.push({ plan: snapshotRow.plan, status: snapshotRow.status, provider: 'admin', currentPeriodEnd: Number(snapshotRow.current_period_end) || null, graceUntil: Number(snapshotRow.grace_until) || null });
  }
  const expectedPremium = candidates.some(candidate => paidAt(candidate, now));
  const storedPublic = publicEntitlement(snapshotRow || { plan: 'free', status: 'free', provider: 'none' }, now);
  // The offline window is a delivery bound, not entitlement truth: compare the
  // server-side lifecycle only.
  const storedPremium = paidAt({
    plan: snapshotRow?.plan, status: snapshotRow?.status,
    currentPeriodEnd: Number(snapshotRow?.current_period_end) || null, graceUntil: Number(snapshotRow?.grace_until) || null
  }, now);
  if (expectedPremium !== storedPremium) {
    drift.push({
      severity: 'critical', kind: 'entitlement-plan',
      stored: storedPremium ? 'premium' : 'free', expected: expectedPremium ? 'premium' : 'free',
      message: expectedPremium
        ? 'Signed evidence shows a paid subscription but the account is not entitled.'
        : 'The account is entitled but no verified source supports Premium now.'
    });
  }

  return {
    accountId,
    at: now,
    appAccountTokenBound: !!tokenRow,
    snapshot: { stored: storedPublic, storedLifecyclePremium: storedPremium, expectedPremium },
    subscriptions: report,
    unboundNotifications: unbound.length,
    evidenceApplied: evidenceUsed,
    drift,
    ok: !drift.some(item => item.severity === 'critical' || item.severity === 'warning')
  };
}
