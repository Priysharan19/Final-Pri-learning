import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Razorpay subscription cancellation (student: cancel at cycle end; account
// deletion: cancel immediately or abort) and the payment / refund / invoice
// webhook mapping (cloud-03, cloud-11, commercial-14). Provider HTTP is faked;
// webhook signatures are real HMACs over the raw body.
const envNames = [
  'PRI_PLATFORM_DB', 'PRI_RAZORPAY_KEY_ID', 'PRI_RAZORPAY_KEY_SECRET', 'PRI_RAZORPAY_WEBHOOK_SECRET',
  'PRI_RAZORPAY_MONTHLY_PLAN_ID', 'PRI_RAZORPAY_ANNUAL_PLAN_ID',
  'PRI_RAZORPAY_MONTHLY_TOTAL_COUNT', 'PRI_RAZORPAY_ANNUAL_TOTAL_COUNT',
  'PRI_DISPLAY_TRIAL_DAYS', 'PRI_WEB_GRACE_DAYS'
];
const previous = Object.fromEntries(envNames.map(name => [name, process.env[name]]));
const scratch = mkdtempSync(join(tmpdir(), 'pri-billing-cancel-'));
process.env.PRI_PLATFORM_DB = join(scratch, 'platform.db');
process.env.PRI_RAZORPAY_KEY_ID = 'rzp_test_cancel_id';
process.env.PRI_RAZORPAY_KEY_SECRET = 'rzp-test-secret-cancel';
process.env.PRI_RAZORPAY_WEBHOOK_SECRET = 'webhook-secret-cancel-refund';
process.env.PRI_RAZORPAY_MONTHLY_PLAN_ID = 'plan_Monthly123456';
process.env.PRI_RAZORPAY_ANNUAL_PLAN_ID = 'plan_Annual1234567';
process.env.PRI_RAZORPAY_MONTHLY_TOTAL_COUNT = '120';
process.env.PRI_RAZORPAY_ANNUAL_TOTAL_COUNT = '10';
delete process.env.PRI_DISPLAY_TRIAL_DAYS;
delete process.env.PRI_WEB_GRACE_DAYS;

const [
  { createPlatformDb },
  { ensureBillingSchema },
  { applyVerifiedEntitlement, publicEntitlement },
  { createRazorpayBilling },
  { webSubscriptionManageState }
] = await Promise.all([
  import('../platform/db.js'),
  import('../platform/billingSchema.js'),
  import('../platform/entitlements.js'),
  import('../platform/razorpay.js'),
  import('../platform/billing.js')
]);

let checks = 0;
function check(condition, message) { checks++; assert.ok(condition, message); }

const MONTHLY = process.env.PRI_RAZORPAY_MONTHLY_PLAN_ID;
const db = createPlatformDb(':memory:');
ensureBillingSchema(db);
const now = Date.now();
const sec = ms => Math.floor(ms / 1000);
const periodEnd = sec(now + 30 * 24 * 60 * 60 * 1000);
for (const id of ['acct-cycle', 'acct-refund', 'acct-delete', 'acct-outage', 'acct-reject', 'acct-none']) {
  db.prepare(`INSERT INTO accounts(id,email,name,password_hash,role,created_at,updated_at) VALUES (?,?,?,'hash','student',?,?)`).run(id, `${id}@example.test`, id, now, now);
  db.prepare(`INSERT INTO entitlement_snapshots(account_id,plan,status,provider,source_version,updated_at) VALUES (?,'free','free','none',0,?)`).run(id, now);
}

const requests = [];
const cancelBehaviour = new Map(); // subscription id -> 'outage' | 'reject'
const providerStatus = new Map();  // subscription id -> status Razorpay reports on GET
let created = 0;
const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });

function providerSubscription(id, status) {
  const terminal = ['cancelled', 'completed', 'expired'].includes(status);
  return {
    id, entity: 'subscription', plan_id: MONTHLY, status,
    current_start: sec(now), current_end: periodEnd, ended_at: terminal ? sec(now) : null,
    start_at: sec(now), has_scheduled_changes: false, notes: {}
  };
}

async function fakeFetch(url, options = {}) {
  const parsed = new URL(url);
  const method = String(options.method || 'GET').toUpperCase();
  const body = options.body ? JSON.parse(options.body) : null;
  requests.push({ path: parsed.pathname, method, body });
  assert.equal(parsed.origin, 'https://api.razorpay.com');
  assert.match(String(options.headers?.Authorization || ''), /^Basic /);
  if (method === 'POST' && parsed.pathname === '/v1/subscriptions') {
    created++;
    const id = `sub_Created${String(created).padStart(8, '0')}`;
    providerStatus.set(id, 'active');
    return json({
      ...providerSubscription(id, 'created'), plan_id: body.plan_id, current_end: null, total_count: body.total_count,
      notes: body.notes, short_url: `https://rzp.io/i/c${created}`, created_at: sec(now)
    });
  }
  const cancel = parsed.pathname.match(/^\/v1\/subscriptions\/(sub_[A-Za-z0-9]+)\/cancel$/);
  if (method === 'POST' && cancel) {
    const id = cancel[1];
    const behaviour = cancelBehaviour.get(id);
    if (behaviour === 'outage') return json({ error: { description: 'Razorpay is temporarily down' } }, 503);
    if (behaviour === 'reject') return json({ error: { code: 'BAD_REQUEST_ERROR', description: 'The subscription cannot be cancelled' } }, 400);
    const immediate = body?.cancel_at_cycle_end === 0;
    if (immediate) providerStatus.set(id, 'cancelled');
    return json({ ...providerSubscription(id, immediate ? 'cancelled' : 'active'), has_scheduled_changes: !immediate });
  }
  const get = parsed.pathname.match(/^\/v1\/subscriptions\/(sub_[A-Za-z0-9]+)$/);
  if (method === 'GET' && get) return json(providerSubscription(get[1], providerStatus.get(get[1]) || 'active'));
  return json({ error: { description: 'unexpected test request' } }, 404);
}

function signedRequest(payload, eventId) {
  const rawBody = Buffer.from(JSON.stringify(payload));
  const signature = createHmac('sha256', process.env.PRI_RAZORPAY_WEBHOOK_SECRET).update(rawBody).digest('hex');
  const headers = { 'x-razorpay-event-id': eventId, 'x-razorpay-signature': signature };
  return { rawBody, get(name) { return headers[String(name).toLowerCase()] || ''; } };
}
function subscriptionEntity(id, accountId, status = 'active') {
  return { ...providerSubscription(id, status), notes: { pri_account_id: accountId, pri_cadence: 'monthly', pri_trial: '0' } };
}
function paymentEntity(id, { amount = 99900, subscriptionId = null, status = 'captured', createdAt = sec(now) } = {}) {
  return { id, entity: 'payment', amount, currency: 'INR', status, method: 'upi', created_at: createdAt, ...(subscriptionId ? { subscription_id: subscriptionId } : {}) };
}
function refundEntity(id, paymentId, amount, status = 'processed') {
  return { id, entity: 'refund', amount, currency: 'INR', payment_id: paymentId, status, created_at: sec(now) };
}
function webhookPayload(event, entities, createdAt = sec(now)) {
  return {
    entity: 'event', event, contains: Object.keys(entities),
    payload: Object.fromEntries(Object.entries(entities).map(([key, entity]) => [key, { entity }])),
    created_at: createdAt
  };
}

const provider = createRazorpayBilling(db, { fetchImpl: fakeFetch });
const deliver = (event, entities, eventId, createdAt) => provider.verifiers.web.webhook({ request: signedRequest(webhookPayload(event, entities, createdAt), eventId) });
const snapshot = accountId => publicEntitlement(db.prepare('SELECT * FROM entitlement_snapshots WHERE account_id=?').get(accountId));
const binding = subscriptionId => db.prepare(`SELECT * FROM billing_subscriptions WHERE provider='web' AND provider_subscription_id=?`).get(subscriptionId);
const auditActions = target => db.prepare('SELECT action FROM audit_log WHERE target_id=? ORDER BY id').all(target).map(row => row.action);
const cancelCalls = subscriptionId => requests.filter(r => r.method === 'POST' && r.path === `/v1/subscriptions/${subscriptionId}/cancel`);

async function subscribe(accountId, tag, createdAt = sec(now) - 100) {
  const checkout = await provider.checkout.web.create({ accountId, cadence: 'monthly' });
  const subscriptionId = checkout.subscriptionId;
  const payment = paymentEntity(`pay_${tag}00000001`, { subscriptionId, createdAt });
  const verified = await deliver('subscription.charged', { subscription: subscriptionEntity(subscriptionId, accountId), payment }, `evt-${tag}-charged`, createdAt);
  const applied = applyVerifiedEntitlement(db, verified);
  return { subscriptionId, payment, applied };
}

try {
  // ── Student cancellation at cycle end ────────────────────────────────────
  const cycle = await subscribe('acct-cycle', 'Cycle');
  check(cycle.applied.snapshot.plan === 'premium', 'subscription.charged activates Premium');
  const recorded = db.prepare(`SELECT amount,account_id,provider_subscription_id FROM billing_payments WHERE provider='web' AND payment_id=?`).get(cycle.payment.id);
  check(recorded?.amount === 99900 && recorded.account_id === 'acct-cycle' && recorded.provider_subscription_id === cycle.subscriptionId, 'subscription.charged records the period payment for refund mapping');
  const manageBefore = webSubscriptionManageState(db, 'acct-cycle', { adapterAvailable: true });
  check(manageBefore.cancellable === true && manageBefore.status === 'active' && manageBefore.cancelling === false, 'a live web subscription is cancellable');
  check(webSubscriptionManageState(db, 'acct-cycle', { adapterAvailable: false }).cancellable === false, 'without an adapter nothing is cancellable');

  const cancelled = await provider.lifecycle.web.cancel({ accountId: 'acct-cycle', atCycleEnd: true, reason: 'user' });
  check(cancelled.status === 'cancelling', `cycle-end cancel status ${cancelled.status}`);
  check(cancelled.currentPeriodEnd === periodEnd * 1000, 'currentPeriodEnd comes from the provider response');
  check(cancelled.subscriptionId === cycle.subscriptionId && cancelled.replayed === false, 'cancel names the bound subscription');
  check(cancelCalls(cycle.subscriptionId).length === 1 && cancelCalls(cycle.subscriptionId)[0].body.cancel_at_cycle_end === 1, 'student cancellation asks Razorpay to stop at cycle end');
  check(snapshot('acct-cycle').plan === 'premium' && snapshot('acct-cycle').status === 'active', 'Premium stays active until the cycle boundary');
  const cycleBinding = binding(cycle.subscriptionId);
  check(cycleBinding.cancel_requested_at > 0 && cycleBinding.cancel_mode === 'cycle-end' && cycleBinding.cancel_reason === 'user', 'binding carries the cancellation state');
  check(auditActions(cycle.subscriptionId).includes('billing.cancel'), 'cancellation is audited');
  const manageDuring = webSubscriptionManageState(db, 'acct-cycle', { adapterAvailable: true });
  check(manageDuring.cancellable === false && manageDuring.cancelling === true && manageDuring.currentPeriodEnd === periodEnd * 1000, 'manage state reports the pending cancellation');

  const replay = await provider.lifecycle.web.cancel({ accountId: 'acct-cycle', atCycleEnd: true });
  check(replay.status === 'cancelling' && replay.replayed === true, 'repeating the request replays the pending cancellation');
  check(cancelCalls(cycle.subscriptionId).length === 1, 'replay does not call the provider again');

  const ended = await deliver('subscription.cancelled', { subscription: subscriptionEntity(cycle.subscriptionId, 'acct-cycle', 'cancelled') }, 'evt-Cycle-cancelled', sec(now) - 50);
  const endedApplied = applyVerifiedEntitlement(db, ended);
  check(endedApplied.snapshot.status === 'expired' && endedApplied.snapshot.plan === 'free', 'the cycle-boundary webhook expires the entitlement');
  check(webSubscriptionManageState(db, 'acct-cycle', { adapterAvailable: true }).status === 'none', 'nothing is cancellable after expiry');
  check((await provider.lifecycle.web.cancel({ accountId: 'acct-cycle', atCycleEnd: true })).status === 'none', 'cancel after expiry reports none');
  check((await provider.lifecycle.web.cancel({ accountId: 'acct-none', atCycleEnd: true })).status === 'none', 'an account with no web subscription has nothing to cancel');

  // ── Refund mapping ───────────────────────────────────────────────────────
  const refund = await subscribe('acct-refund', 'Refund');
  check(refund.applied.snapshot.plan === 'premium', 'refund fixture is Premium');
  const partialRefund = refundEntity('rfnd_Partial00000001', refund.payment.id, 10000);
  const partial = await deliver('refund.processed', { refund: partialRefund, payment: refund.payment }, 'evt-Refund-partial', sec(now) - 40);
  check(Array.isArray(partial) && partial.length === 0, 'a partial refund is acknowledged without an entitlement change');
  check(snapshot('acct-refund').plan === 'premium', 'a partial refund keeps Premium');
  check(db.prepare(`SELECT amount FROM billing_refunds WHERE provider='web' AND refund_id='rfnd_Partial00000001'`).get()?.amount === 10000, 'the partial refund is recorded in the ledger');
  check(db.prepare(`SELECT applied_at FROM billing_events WHERE provider='web' AND event_id='evt-Refund-partial'`).get()?.applied_at > 0, 'acknowledged events are persisted for idempotency');
  const redelivered = await deliver('refund.processed', { refund: partialRefund, payment: refund.payment }, 'evt-Refund-partial', sec(now) - 40);
  check(redelivered.length === 0 && auditActions(refund.subscriptionId).filter(a => a === 'billing.refund').length === 1, 'redelivery of the same refund event is idempotent (no second audit row)');

  const remainder = await deliver('refund.processed', { refund: refundEntity('rfnd_Rest000000001', refund.payment.id, 89900), payment: refund.payment }, 'evt-Refund-full', sec(now) - 30);
  check(remainder?.verified === true && remainder.status === 'revoked' && remainder.plan === 'free' && remainder.eventRank === 100, 'a full refund of the current period revokes Premium');
  check(remainder.accountId === 'acct-refund' && remainder.providerSubscriptionId === refund.subscriptionId, 'the refund is mapped back to the bound account and subscription');
  const revoked = applyVerifiedEntitlement(db, remainder);
  check(revoked.snapshot.status === 'revoked' && revoked.snapshot.plan === 'free', 'revocation is applied to the snapshot');
  check(auditActions(refund.subscriptionId).filter(a => a === 'billing.refund').length === 2, 'each refund decision is audited once');

  const late = await deliver('subscription.charged', { subscription: subscriptionEntity(refund.subscriptionId, 'acct-refund'), payment: refund.payment }, 'evt-Refund-late', sec(now) - 35);
  const lateApplied = applyVerifiedEntitlement(db, late);
  check(lateApplied.stale === true && snapshot('acct-refund').status === 'revoked', 'an older charged event cannot resurrect a refunded subscription');

  const failed = await deliver('refund.failed', { refund: refundEntity('rfnd_Failed00000001', refund.payment.id, 99900, 'failed'), payment: refund.payment }, 'evt-Refund-failed', sec(now) - 20);
  check(failed.length === 0 && db.prepare(`SELECT status FROM billing_refunds WHERE refund_id='rfnd_Failed00000001'`).get()?.status === 'failed', 'refund.failed is recorded and changes nothing');
  const unknown = await deliver('refund.created', { refund: refundEntity('rfnd_Unknown0000001', 'pay_Unknown00000001', 5000, 'pending') }, 'evt-Refund-unknown', sec(now) - 10);
  check(unknown.length === 0 && !db.prepare(`SELECT 1 FROM billing_refunds WHERE refund_id='rfnd_Unknown0000001'`).get(), 'a refund for an unobserved payment is acknowledged, not recorded');

  // ── Payment / invoice / unrelated families ───────────────────────────────
  const invoice = await deliver('invoice.paid', { invoice: {
    id: 'inv_Test0000000001', entity: 'invoice', subscription_id: refund.subscriptionId, payment_id: 'pay_Invoice00000001',
    status: 'paid', amount: 99900, amount_paid: 99900, currency: 'INR', paid_at: sec(now)
  } }, 'evt-invoice-paid', sec(now));
  check(invoice.length === 0, 'invoice.paid is acknowledged');
  check(db.prepare(`SELECT account_id FROM billing_payments WHERE payment_id='pay_Invoice00000001'`).get()?.account_id === 'acct-refund', 'invoice.paid records the payment against the bound account');
  const captured = await deliver('payment.captured', { payment: paymentEntity('pay_Captured0000001', { subscriptionId: refund.subscriptionId }) }, 'evt-payment-captured', sec(now));
  check(captured.length === 0 && !!db.prepare(`SELECT 1 FROM billing_payments WHERE payment_id='pay_Captured0000001'`).get(), 'payment.captured for a bound subscription is recorded and acknowledged');
  const orphan = await deliver('payment.authorized', { payment: paymentEntity('pay_Orphan000000001') }, 'evt-payment-orphan', sec(now));
  check(orphan.length === 0 && !db.prepare(`SELECT 1 FROM billing_payments WHERE payment_id='pay_Orphan000000001'`).get(), 'a payment without a subscription is acknowledged and not recorded');
  for (const [event, entities, id] of [
    ['order.paid', { order: { id: 'order_Test000000001', entity: 'order', status: 'paid' } }, 'evt-order-paid'],
    ['settlement.processed', { settlement: { id: 'setl_Test000000001', entity: 'settlement' } }, 'evt-settlement'],
    ['payment_link.paid', { payment_link: { id: 'plink_Test00000001', entity: 'payment_link' } }, 'evt-plink']
  ]) {
    const result = await deliver(event, entities, id, sec(now));
    check(Array.isArray(result) && result.length === 0, `${event} is acknowledged rather than rejected`);
  }
  await assert.rejects(
    () => deliver('subscription.activated', { subscription: subscriptionEntity('sub_Unbound00000001', 'acct-refund') }, 'evt-unbound', sec(now)),
    error => error?.code === 'BILLING_SUBSCRIPTION_UNKNOWN' && error?.status === 409
  );
  checks++;
  await assert.rejects(
    () => provider.verifiers.web.webhook({ request: { rawBody: Buffer.from('{}'), get(name) { return name === 'x-razorpay-event-id' ? 'evt-bad' : 'deadbeef'; } } }),
    error => error?.code === 'BILLING_WEBHOOK_SIGNATURE_INVALID'
  );
  checks++;

  // ── Account deletion: immediate cancel ───────────────────────────────────
  const del = await subscribe('acct-delete', 'Delete');
  const deleted = await provider.lifecycle.web.cancel({ accountId: 'acct-delete', atCycleEnd: false, reason: 'account-deletion' });
  check(deleted.status === 'cancelled' && deleted.cancelled.includes(del.subscriptionId), 'account deletion cancels every live web binding');
  check(cancelCalls(del.subscriptionId)[0]?.body?.cancel_at_cycle_end === 0, 'deletion cancels immediately, not at cycle end');
  check(snapshot('acct-delete').plan === 'free' && snapshot('acct-delete').status === 'expired', 'immediate cancellation expires the entitlement');
  const delBinding = binding(del.subscriptionId);
  check(delBinding.cancel_mode === 'immediate' && delBinding.cancel_reason === 'account-deletion', 'the deletion cancel is recorded with its reason');

  // ── Provider outage: deletion must not proceed ───────────────────────────
  const outage = await subscribe('acct-outage', 'Outage');
  cancelBehaviour.set(outage.subscriptionId, 'outage');
  await assert.rejects(
    () => provider.lifecycle.web.cancel({ accountId: 'acct-outage', atCycleEnd: false, reason: 'account-deletion' }),
    error => error?.code === 'BILLING_PROVIDER_REQUEST_FAILED' && error?.status === 502
  );
  checks++;
  check(binding(outage.subscriptionId).cancel_requested_at == null && snapshot('acct-outage').plan === 'premium', 'an unreachable provider leaves the binding live so deletion can retry later');
  await assert.rejects(
    () => provider.lifecycle.web.cancel({ accountId: 'acct-outage', atCycleEnd: true }),
    error => error?.code === 'BILLING_PROVIDER_REQUEST_FAILED'
  );
  checks++;

  // ── Definitive provider rejection while still chargeable ─────────────────
  const reject = await subscribe('acct-reject', 'Reject');
  cancelBehaviour.set(reject.subscriptionId, 'reject');
  providerStatus.set(reject.subscriptionId, 'active');
  await assert.rejects(
    () => provider.lifecycle.web.cancel({ accountId: 'acct-reject', atCycleEnd: false, reason: 'account-deletion' }),
    error => error?.code === 'BILLING_SUBSCRIPTION_NOT_CANCELLABLE' && error?.status === 409
  );
  checks++;
  check(binding(reject.subscriptionId).cancel_requested_at == null, 'a 4xx from the provider on a live mandate never counts as cancelled');
  check(requests.some(r => r.method === 'GET' && r.path === `/v1/subscriptions/${reject.subscriptionId}`), 'the adapter asked Razorpay for the real subscription state');
  await assert.rejects(
    () => provider.lifecycle.web.cancel({ accountId: 'acct-reject', atCycleEnd: true }),
    error => error?.code === 'BILLING_SUBSCRIPTION_NOT_CANCELLABLE' && error?.status === 409
  );
  checks++;
  // The provider now says the subscription already ended (missed webhook):
  // the rejection is reconciled instead of blocking the student forever.
  providerStatus.set(reject.subscriptionId, 'cancelled');
  const reconciled = await provider.lifecycle.web.cancel({ accountId: 'acct-reject', atCycleEnd: true });
  check(reconciled.status === 'none' && reconciled.reconciled === true, 'a provider-terminal subscription reconciles to none');
  check(snapshot('acct-reject').status === 'expired' && snapshot('acct-reject').plan === 'free', 'reconciliation expires the stale Premium snapshot');
  check(auditActions(reject.subscriptionId).includes('billing.cancel.reconciled'), 'reconciliation is audited');

  console.log(`BILLING CANCEL + REFUND: PASS — ${checks}/${checks} checks — cycle-end cancellation keeps Premium until the boundary webhook, deletion cancels immediately or aborts on provider failure, refunds revoke only when the current period is fully refunded, and unrelated Razorpay events are acknowledged.`);
} finally {
  db.close();
  rmSync(scratch, { recursive: true, force: true });
  for (const name of envNames) {
    if (previous[name] === undefined) delete process.env[name];
    else process.env[name] = previous[name];
  }
}
