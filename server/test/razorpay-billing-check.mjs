import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { createPlatformDb } from '../platform/db.js';
import { ensureBillingSchema } from '../platform/billingSchema.js';
import { applyVerifiedEntitlement } from '../platform/entitlements.js';
import { createRazorpayBilling, razorpayConfigStatus } from '../platform/razorpay.js';

const envNames = [
  'PRI_RAZORPAY_KEY_ID', 'PRI_RAZORPAY_KEY_SECRET', 'PRI_RAZORPAY_WEBHOOK_SECRET',
  'PRI_RAZORPAY_MONTHLY_PLAN_ID', 'PRI_RAZORPAY_ANNUAL_PLAN_ID',
  'PRI_RAZORPAY_MONTHLY_TOTAL_COUNT', 'PRI_RAZORPAY_ANNUAL_TOTAL_COUNT',
  'PRI_DISPLAY_TRIAL_DAYS', 'PRI_WEB_GRACE_DAYS'
];
const previous = Object.fromEntries(envNames.map(name => [name, process.env[name]]));

process.env.PRI_RAZORPAY_KEY_ID = 'rzp_test_public_id';
process.env.PRI_RAZORPAY_KEY_SECRET = 'rzp-test-secret-never-client-side';
process.env.PRI_RAZORPAY_WEBHOOK_SECRET = 'webhook-secret-test-only';
process.env.PRI_RAZORPAY_MONTHLY_PLAN_ID = 'plan_Monthly123456';
process.env.PRI_RAZORPAY_ANNUAL_PLAN_ID = 'plan_Annual1234567';
process.env.PRI_RAZORPAY_MONTHLY_TOTAL_COUNT = '120';
process.env.PRI_RAZORPAY_ANNUAL_TOTAL_COUNT = '10';
process.env.PRI_DISPLAY_TRIAL_DAYS = '7';
process.env.PRI_WEB_GRACE_DAYS = '3';

const db = createPlatformDb(':memory:');
ensureBillingSchema(db);
const now = Date.now();
db.prepare(`INSERT INTO accounts(id,email,name,password_hash,role,created_at,updated_at)
  VALUES ('acct-billing','billing@example.test','Billing Student','hash','student',?,?)`).run(now, now);
db.prepare(`INSERT INTO entitlement_snapshots(account_id,plan,status,provider,source_version,updated_at)
  VALUES ('acct-billing','free','free','none',0,?)`).run(now);

let createCount = 0;
let getSubscription = null;
const requests = [];
const jsonResponse = (data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { 'content-type': 'application/json' }
});

async function fakeFetch(url, options = {}) {
  const parsed = new URL(url);
  const method = String(options.method || 'GET').toUpperCase();
  requests.push({ url: parsed.toString(), method, headers: { ...(options.headers || {}) }, body: options.body || null });
  assert.equal(parsed.origin, 'https://api.razorpay.com');
  assert.match(String(options.headers?.Authorization || ''), /^Basic /, 'server must authenticate Razorpay API calls without exposing the secret');

  if (method === 'POST' && parsed.pathname === '/v1/subscriptions') {
    createCount++;
    const body = JSON.parse(options.body || '{}');
    return jsonResponse({
      id: createCount === 1 ? 'sub_First12345678' : 'sub_Second1234567',
      entity: 'subscription',
      plan_id: body.plan_id,
      status: 'created',
      current_start: null,
      current_end: null,
      ended_at: null,
      start_at: body.start_at || Math.floor(Date.now() / 1000),
      total_count: body.total_count,
      notes: body.notes,
      short_url: `https://rzp.io/i/test${createCount}`,
      created_at: Math.floor(Date.now() / 1000)
    });
  }

  if (method === 'GET' && parsed.pathname.startsWith('/v1/subscriptions/')) {
    return jsonResponse(getSubscription);
  }
  return jsonResponse({ error: { description: 'unexpected test request' } }, 404);
}

function signedRequest(payload, eventId, secret = process.env.PRI_RAZORPAY_WEBHOOK_SECRET) {
  const rawBody = Buffer.from(JSON.stringify(payload));
  const signature = createHmac('sha256', secret).update(rawBody).digest('hex');
  const headers = {
    'x-razorpay-event-id': eventId,
    'x-razorpay-signature': signature
  };
  return {
    rawBody,
    get(name) { return headers[String(name).toLowerCase()] || ''; }
  };
}

function subscriptionEntity({
  id = 'sub_First12345678', plan = process.env.PRI_RAZORPAY_MONTHLY_PLAN_ID,
  status = 'active', currentEnd = Math.floor((Date.now() + 30 * 24 * 60 * 60 * 1000) / 1000),
  startAt = Math.floor(Date.now() / 1000), accountId = 'acct-billing'
} = {}) {
  return {
    id, entity: 'subscription', plan_id: plan, status,
    current_start: Math.floor(Date.now() / 1000), current_end: currentEnd,
    ended_at: ['cancelled', 'completed', 'expired'].includes(status) ? Math.floor(Date.now() / 1000) : null,
    start_at: startAt,
    notes: { pri_account_id: accountId, pri_cadence: plan === process.env.PRI_RAZORPAY_MONTHLY_PLAN_ID ? 'monthly' : 'annual' }
  };
}

function event(subscription, event, createdAt) {
  return {
    entity: 'event', event, contains: ['subscription'],
    payload: { subscription: { entity: subscription } },
    created_at: createdAt
  };
}

try {
  assert.equal(razorpayConfigStatus().configured, true);
  const provider = createRazorpayBilling(db, { fetchImpl: fakeFetch });
  assert.equal(provider.configured, true);

  const first = await provider.checkout.web.create({ accountId: 'acct-billing', cadence: 'monthly' });
  assert.equal(first.provider, 'web');
  assert.equal(first.checkoutProvider, 'razorpay');
  assert.equal(first.subscriptionId, 'sub_First12345678');
  assert.equal(first.checkoutUrl, 'https://rzp.io/i/test1');
  assert.equal(first.trialApplied, true);
  assert.equal(first.trialDays, 7);
  const firstBody = JSON.parse(requests[0].body);
  assert.equal(firstBody.notes.pri_account_id, 'acct-billing');
  assert.equal(firstBody.plan_id, process.env.PRI_RAZORPAY_MONTHLY_PLAN_ID);
  assert.equal(firstBody.total_count, 120);
  assert.ok(firstBody.start_at * 1000 >= now + 6 * 24 * 60 * 60 * 1000, 'trial must be represented by a future provider start date');

  const second = await provider.checkout.web.create({ accountId: 'acct-billing', cadence: 'annual' });
  assert.equal(second.trialApplied, false, 'one account must never mint a second introductory trial');
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM billing_trial_claims WHERE account_id=?').get('acct-billing').n, 1);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM billing_subscriptions WHERE account_id=?').get('acct-billing').n, 2);

  const nowSec = Math.floor(Date.now() / 1000);
  const activePayload = event(subscriptionEntity(), 'subscription.activated', nowSec - 100);
  const activeVerified = await provider.verifiers.web.webhook({ request: signedRequest(activePayload, 'evt-active-1') });
  assert.equal(activeVerified.verified, true);
  assert.equal(activeVerified.provider, 'web');
  assert.equal(activeVerified.accountId, 'acct-billing');
  assert.equal(activeVerified.status, 'active');
  const activeApplied = applyVerifiedEntitlement(db, activeVerified);
  assert.equal(activeApplied.replayed, false);
  assert.equal(activeApplied.stale, false);
  assert.equal(activeApplied.snapshot.plan, 'premium');

  const replay = applyVerifiedEntitlement(db, activeVerified);
  assert.equal(replay.replayed, true, 'same x-razorpay-event-id must be idempotent');
  assert.equal(db.prepare(`SELECT COUNT(*) AS n FROM billing_events WHERE provider='web' AND event_id='evt-active-1'`).get().n, 1);

  const cancelledPayload = event(subscriptionEntity({ status: 'cancelled' }), 'subscription.cancelled', nowSec - 50);
  const cancelled = await provider.verifiers.web.webhook({ request: signedRequest(cancelledPayload, 'evt-cancel-1') });
  const cancelledApplied = applyVerifiedEntitlement(db, cancelled);
  assert.equal(cancelledApplied.snapshot.status, 'expired');
  assert.equal(cancelledApplied.snapshot.plan, 'free');

  // Razorpay documents that webhook ordering is not guaranteed. A delayed older
  // active event must therefore be recorded but never resurrect Premium.
  const oldActivePayload = event(subscriptionEntity(), 'subscription.charged', nowSec - 80);
  const oldActive = await provider.verifiers.web.webhook({ request: signedRequest(oldActivePayload, 'evt-active-old') });
  const stale = applyVerifiedEntitlement(db, oldActive);
  assert.equal(stale.stale, true);
  assert.equal(stale.snapshot.status, 'expired');
  assert.equal(stale.snapshot.plan, 'free');

  await assert.rejects(
    () => provider.verifiers.web.webhook({ request: signedRequest(activePayload, 'evt-bad-signature', 'wrong-secret') }),
    error => error?.code === 'BILLING_WEBHOOK_SIGNATURE_INVALID' && error?.status === 401
  );

  const unknownPayload = event(subscriptionEntity({ id: 'sub_Unknown1234567' }), 'subscription.activated', nowSec);
  await assert.rejects(
    () => provider.verifiers.web.webhook({ request: signedRequest(unknownPayload, 'evt-unknown') }),
    error => error?.code === 'BILLING_SUBSCRIPTION_UNKNOWN'
  );

  // Restore performs an authenticated provider fetch and may re-establish the
  // current entitlement without accepting a client-provided Premium flag. Empty
  // restore uses the account's most recently created (annual) binding.
  getSubscription = subscriptionEntity({
    id: 'sub_Second1234567', plan: process.env.PRI_RAZORPAY_ANNUAL_PLAN_ID, status: 'active'
  });
  const restored = await provider.verifiers.web.restore({ accountId: 'acct-billing', body: {} });
  assert.equal(restored.verified, true);
  assert.equal(restored.eventType, 'subscription.restore');
  assert.equal(restored.providerSubscriptionId, 'sub_Second1234567');
  const restoreApplied = applyVerifiedEntitlement(db, restored);
  assert.equal(restoreApplied.stale, false);
  assert.equal(restoreApplied.snapshot.plan, 'premium');
  assert.equal(restoreApplied.snapshot.provider, 'web');

  console.log('PASS — Razorpay checkout is server-bound; raw-body signatures, duplicate delivery, out-of-order events, trials and authoritative restore are enforced.');
} finally {
  db.close();
  for (const name of envNames) {
    if (previous[name] === undefined) delete process.env[name];
    else process.env[name] = previous[name];
  }
}
