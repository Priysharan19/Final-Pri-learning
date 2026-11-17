// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Stripe web subscriptions for the Prithagoras edition (AUD)
//
// Deterministic: a fixed test signing secret, a fake fetch standing in for the
// Stripe REST API, an injected clock. No real key, no network.
//
//   1 · the Stripe-Signature check: valid; tampered body; wrong secret; stale
//       and future timestamps; missing / malformed headers; rotation (two v1);
//       constant-time compare; raw bytes
//   2 · checkout: server-bound session, form-encoded, Bearer auth, no secret in
//       the answer, hosted host check, trial reservation rules, unconfigured
//   3 · each event → entitlement transition, idempotent on the event id, stale
//       and out-of-order events, wrong account / price / currency refused,
//       refunds (full current revokes; partial / older recorded only)
//   4 · cancel (cycle end / immediate / reconcile / refusal) and restore
//   5 · the edition boundary, both ways
//   6 · over HTTP: the raw body is what is verified
// ─────────────────────────────────────────────────────────────────────────────
import './support/hermetic.mjs';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHmac } from 'node:crypto';
import { openTestStore } from './support/engine.mjs';
import { ensureBillingSchema } from '../platform/billingSchema.js';
import { applyVerifiedEntitlement } from '../platform/entitlements.js';
import { createStripeBilling, stripeConfigStatus, verifyStripeSignature, WEBHOOK_TOLERANCE_SECONDS } from '../platform/stripe.js';
import { editionBillingProblems, providerAllowed, webProviderOf } from '../platform/billingProviders.js';

// Test-only values, assembled so no scanner mistakes them for real credentials.
const SECRET_KEY = ['sk', 'test', 'AbCdEfGh12345678'].join('_');
const WEBHOOK_SECRET = ['whsec', 'TestOnlySigningSecret01'].join('_');
const MONTHLY = 'price_MonthlyAud0001';
const ANNUAL = 'price_AnnualAud00001';
const NAMES = ['PRI_STRIPE_SECRET_KEY', 'PRI_STRIPE_WEBHOOK_SECRET', 'PRI_STRIPE_MONTHLY_PRICE_ID', 'PRI_STRIPE_ANNUAL_PRICE_ID', 'PRI_PUBLIC_ORIGIN', 'PRI_DISPLAY_TRIAL_DAYS', 'PRI_WEB_GRACE_DAYS'];
const previous = Object.fromEntries(NAMES.map(n => [n, process.env[n]]));
Object.assign(process.env, {
  PRI_STRIPE_SECRET_KEY: SECRET_KEY, PRI_STRIPE_WEBHOOK_SECRET: WEBHOOK_SECRET, PRI_STRIPE_MONTHLY_PRICE_ID: MONTHLY, PRI_STRIPE_ANNUAL_PRICE_ID: ANNUAL,
  PRI_PUBLIC_ORIGIN: 'https://app.prithagoras.example', PRI_DISPLAY_TRIAL_DAYS: '7', PRI_WEB_GRACE_DAYS: '3'
});

let checks = 0;
const ok = (cond, label) => { checks++; assert.ok(cond, label); };
const eq = (a, b, label) => { checks++; assert.deepEqual(a, b, label); };
const rejects = async (fn, code, label) => { checks++; await assert.rejects(fn, e => e?.code === code, label); };

const testStore = await openTestStore(undefined, { label: 'stripe' });
const db = testStore.store;
ensureBillingSchema(db);
let clock = Date.UTC(2026, 10, 15, 3, 0, 0);
const ACCOUNT = 'acct-stripe';
await db.run(`INSERT INTO accounts(id,email,name,password_hash,role,created_at,updated_at) VALUES (?,?,?,?,?,?,?)`, [ACCOUNT, 'au@example.test', 'AU Student', 'hash', 'student', clock, clock]);
await db.run(`INSERT INTO accounts(id,email,name,password_hash,role,created_at,updated_at) VALUES (?,?,?,?,?,?,?)`, ['acct-other', 'other@example.test', 'Other', 'hash', 'student', clock, clock]);
await db.run(`INSERT INTO entitlement_snapshots(account_id,plan,status,provider,source_version,updated_at) VALUES (?,'free','free','none',0,?)`, [ACCOUNT, clock]);

// ── the fake Stripe ──────────────────────────────────────────────────────────
const calls = [];
let subscriptions = {};
let failNext = null;
const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });
async function fakeFetch(url, options = {}) {
  const u = new URL(url);
  const method = String(options.method || 'GET').toUpperCase();
  const body = options.body ? Object.fromEntries(new URLSearchParams(options.body)) : null;
  calls.push({ url: u.toString(), method, headers: options.headers || {}, body });
  assert.equal(u.origin, 'https://api.stripe.com');
  assert.equal(options.headers.Authorization, `Bearer ${SECRET_KEY}`, 'the server authenticates with the secret key');
  if (failNext) { const f = failNext; failNext = null; return f(); }
  if (method === 'POST' && u.pathname === '/v1/checkout/sessions') return json({ id: 'cs_test_SessionOne0001', url: 'https://checkout.stripe.com/c/pay/cs_test_SessionOne0001' });
  const m = u.pathname.match(/^\/v1\/subscriptions\/(sub_[A-Za-z0-9_]+)$/);
  if (m) {
    const sub = subscriptions[m[1]];
    if (!sub) return json({ error: { message: 'No such subscription' } }, 404);
    if (method === 'POST') { sub.cancel_at_period_end = body.cancel_at_period_end === 'true'; return json(sub); }
    if (method === 'DELETE') { sub.status = 'canceled'; sub.ended_at = Math.floor(clock / 1000); return json(sub); }
    return json(sub);
  }
  return json({ error: { message: 'unexpected' } }, 404);
}
const stripe = createStripeBilling(db, { fetchImpl: fakeFetch, now: () => clock });

// ── helpers: signing and delivering exactly as the router does ───────────────
const sign = (raw, { secret = WEBHOOK_SECRET, t = Math.floor(clock / 1000) } = {}) => `t=${t},v1=${createHmac('sha256', secret).update(`${t}.`).update(raw).digest('hex')}`;
let eventSeq = 0;
const evt = (type, object, { id = `evt_test_${String(++eventSeq).padStart(6, '0')}`, created = Math.floor(clock / 1000) } = {}) => ({ id, object: 'event', type, created, data: { object } });
async function deliver(payload, { header, raw = Buffer.from(JSON.stringify(payload)), secret, t } = {}) {
  const request = { rawBody: raw, get: name => (name.toLowerCase() === 'stripe-signature' ? (header ?? sign(raw, { secret, t })) : undefined) };
  try {
    const applied = await db.transaction(async () => {
      const events = await stripe.verifiers.web.webhook({ request });
      const list = Array.isArray(events) ? events : [events];
      const out = [];
      for (const e of list) out.push(await applyVerifiedEntitlement(db, e));
      return out;
    });
    return { status: 200, applied };
  } catch (err) { return { status: err.status || 500, code: err.code, message: err.message }; }
}
const snapshot = () => db.get('SELECT plan,status,provider,product_id,current_period_end,grace_until FROM entitlement_snapshots WHERE account_id=?', [ACCOUNT]);
const SUB = 'sub_AuMonthly0001';
const T0 = Math.floor(clock / 1000);
const DAY = 86400;
const subObject = (over = {}) => ({
  id: SUB, object: 'subscription', status: 'active', currency: 'aud', cancel_at_period_end: false,
  current_period_end: T0 + 30 * DAY, items: { data: [{ price: { id: MONTHLY } }] }, metadata: { pri_account_id: ACCOUNT, pri_cadence: 'monthly', pri_trial: '0' }, ...over
});
const session = (over = {}) => ({
  id: 'cs_test_SessionOne0001', object: 'checkout.session', mode: 'subscription', subscription: SUB, client_reference_id: ACCOUNT, payment_status: 'paid', currency: 'aud',
  metadata: { pri_account_id: ACCOUNT, pri_cadence: 'monthly', pri_trial: '0' }, ...over
});
const invoice = (over = {}) => ({
  id: 'in_AuInvoice0001', object: 'invoice', subscription: SUB, currency: 'aud', amount_paid: 1999, payment_intent: 'pi_AuPayment0001',
  period_start: T0, lines: { data: [{ period: { start: T0, end: T0 + 30 * DAY } }] }, status_transitions: { paid_at: T0 }, ...over
});

// ── 1 · the signature ────────────────────────────────────────────────────────
{
  const raw = Buffer.from('{"id":"evt_x"}');
  const now = clock;
  const good = sign(raw);
  ok(verifyStripeSignature(raw, good, WEBHOOK_SECRET, now).equals(raw), 'a valid signature over the raw body verifies');
  const throwsCode = (fn, code, label) => { checks++; assert.throws(fn, e => e.code === code && e.status === 401, label); };
  throwsCode(() => verifyStripeSignature(Buffer.from('{"id":"evt_y"}'), good, WEBHOOK_SECRET, now), 'BILLING_WEBHOOK_SIGNATURE_INVALID', 'a tampered body is refused');
  throwsCode(() => verifyStripeSignature(raw, sign(raw, { secret: 'whsec_wrong_secret_value' }), WEBHOOK_SECRET, now), 'BILLING_WEBHOOK_SIGNATURE_INVALID', 'a signature from another secret is refused');
  throwsCode(() => verifyStripeSignature(raw, sign(raw, { t: Math.floor(now / 1000) - WEBHOOK_TOLERANCE_SECONDS - 1 }), WEBHOOK_SECRET, now), 'BILLING_WEBHOOK_TIMESTAMP_STALE', 'a correctly signed but stale delivery is refused (replay)');
  throwsCode(() => verifyStripeSignature(raw, sign(raw, { t: Math.floor(now / 1000) + WEBHOOK_TOLERANCE_SECONDS + 1 }), WEBHOOK_SECRET, now), 'BILLING_WEBHOOK_TIMESTAMP_STALE', 'and one dated in the future');
  ok(verifyStripeSignature(raw, sign(raw, { t: Math.floor(now / 1000) - WEBHOOK_TOLERANCE_SECONDS }), WEBHOOK_SECRET, now), 'a delivery at the edge of the tolerance still verifies');
  // Changing the timestamp changes what was signed.
  const t = Math.floor(now / 1000) - 5;
  throwsCode(() => verifyStripeSignature(raw, `t=${t + 1},v1=${good.split('v1=')[1]}`, WEBHOOK_SECRET, now), 'BILLING_WEBHOOK_SIGNATURE_INVALID', 'a signature cannot be moved to another timestamp');
  for (const [label, header] of [['no header', undefined], ['empty', ''], ['no v1', 't=1'], ['no t', `v1=${good.split('v1=')[1]}`], ['non-hex v1', 't=1,v1=zz'], ['short v1', 't=1,v1=abcd']]) {
    throwsCode(() => verifyStripeSignature(raw, header, WEBHOOK_SECRET, now), 'BILLING_WEBHOOK_SIGNATURE_INVALID', `a malformed header (${label}) is refused`);
  }
  const rotated = `${good},v1=${'0'.repeat(64)}`;
  ok(verifyStripeSignature(raw, rotated, WEBHOOK_SECRET, now), 'with two v1 values (secret rotation) either may match');
  checks++; assert.throws(() => verifyStripeSignature(Buffer.alloc(0), good, WEBHOOK_SECRET, now), e => e.code === 'BILLING_WEBHOOK_BODY_REQUIRED');
  const src = readFileSync(new URL('../platform/stripe.js', import.meta.url), 'utf8');
  const verifier = src.slice(src.indexOf('export function verifyStripeSignature'), src.indexOf('function form('));
  ok(/timingSafeEqual\(received, expected\)/.test(verifier) && !/(candidate|received)\s*===|===\s*(candidate|received)\b(?!\.)|\.equals\(expected/.test(verifier), 'the compare is timingSafeEqual, never ===');
  eq([stripeConfigStatus().configured, stripeConfigStatus().credentialsConfigured], [true, true], 'the test configuration is complete');
}

// ── 2 · checkout ─────────────────────────────────────────────────────────────
{
  const made = await stripe.checkout.web.create({ accountId: ACCOUNT, cadence: 'monthly' });
  const call = calls.at(-1);
  eq([made.provider, made.checkoutProvider, made.sessionId, made.checkoutUrl, made.trialApplied, made.trialDays], ['web', 'stripe', 'cs_test_SessionOne0001', 'https://checkout.stripe.com/c/pay/cs_test_SessionOne0001', true, 7], 'checkout answers with the hosted Stripe URL and the trial');
  ok(call.method === 'POST' && call.url === 'https://api.stripe.com/v1/checkout/sessions' && call.headers['Content-Type'] === 'application/x-www-form-urlencoded' && /^pri-checkout-/.test(call.headers['Idempotency-Key']), 'a form-encoded POST with an idempotency key');
  eq([call.body.mode, call.body['line_items[0][price]'], call.body['line_items[0][quantity]'], call.body.client_reference_id, call.body['metadata[pri_account_id]'], call.body['metadata[pri_cadence]'], call.body['subscription_data[metadata][pri_account_id]'], call.body['subscription_data[trial_period_days]']],
    ['subscription', MONTHLY, '1', ACCOUNT, ACCOUNT, 'monthly', ACCOUNT, '7'], 'the session is bound to the account and the configured price, with the trial');
  ok(call.body.success_url === 'https://app.prithagoras.example/?billing=success' && call.body.cancel_url === 'https://app.prithagoras.example/?billing=cancelled', 'it returns to the configured public origin');
  ok(!JSON.stringify(made).includes(SECRET_KEY) && !JSON.stringify(made).includes(WEBHOOK_SECRET), 'no secret is in the answer');
  const again = await stripe.checkout.web.create({ accountId: ACCOUNT, cadence: 'annual' });
  eq([again.trialApplied, calls.at(-1).body['line_items[0][price]'], calls.at(-1).body['subscription_data[trial_period_days]']], [false, ANNUAL, undefined], 'a second checkout gets no second trial, and the annual price');
  await rejects(() => stripe.checkout.web.create({ accountId: ACCOUNT, cadence: 'weekly' }), 'BILLING_CADENCE_INVALID', 'an unknown cadence is refused');
  await rejects(() => stripe.checkout.web.create({ accountId: 'nobody', cadence: 'monthly' }), 'BILLING_ACCOUNT_INVALID', 'an unknown account is refused');
  const before = calls.length;
  failNext = () => json({ id: 'cs_test_SessionTwo0002', url: 'https://evil.example/checkout' });
  await rejects(() => stripe.checkout.web.create({ accountId: 'acct-other', cadence: 'monthly' }), 'BILLING_PROVIDER_BAD_RESPONSE', 'a checkout URL off checkout.stripe.com is refused');
  eq(await db.get("SELECT COUNT(*) AS n FROM billing_trial_claims WHERE account_id='acct-other'").then(r => Number(r.n)), 1, 'an ambiguous failure keeps the trial reservation (a retry cannot mint a second trial)');
  await db.run("DELETE FROM billing_trial_claims WHERE account_id='acct-other'");
  failNext = () => json({ error: { message: 'Invalid price' } }, 400);
  await rejects(() => stripe.checkout.web.create({ accountId: 'acct-other', cadence: 'monthly' }), 'BILLING_PROVIDER_REQUEST_FAILED', 'a definitive Stripe rejection surfaces');
  eq(await db.get("SELECT COUNT(*) AS n FROM billing_trial_claims WHERE account_id='acct-other'").then(r => Number(r.n)), 0, 'and releases the trial reservation');
  failNext = () => json({ error: { message: 'down' } }, 503);
  await rejects(() => stripe.checkout.web.create({ accountId: 'acct-other', cadence: 'annual' }), 'BILLING_PROVIDER_REQUEST_FAILED', 'a 5xx is not taken as a definitive failure');
  ok(calls.length > before, 'the provider was reached');
  await db.run("DELETE FROM billing_trial_claims WHERE account_id='acct-other'");
  const saved = process.env.PRI_STRIPE_SECRET_KEY; process.env.PRI_STRIPE_SECRET_KEY = '';
  const bare = createStripeBilling(db, { fetchImpl: fakeFetch });
  await rejects(() => bare.checkout.web.create({ accountId: ACCOUNT, cadence: 'monthly' }), 'BILLING_PROVIDER_NOT_CONFIGURED', 'unconfigured Stripe refuses checkout (503)');
  eq((await deliver(evt('invoice.paid', invoice()))).code, 'BILLING_PROVIDER_NOT_CONFIGURED', 'and unconfigured Stripe refuses its webhook too (503), applying nothing');
  process.env.PRI_STRIPE_SECRET_KEY = saved;
  await db.run('DELETE FROM billing_events'); await db.run('DELETE FROM billing_payments'); await db.run('DELETE FROM billing_subscriptions');
  await db.run("UPDATE entitlement_snapshots SET plan='free',status='free',provider='none'");
}

// ── 3 · events → entitlement ─────────────────────────────────────────────────
subscriptions = {};
{
  // An event before the subscription is bound is a mismatch Stripe will retry.
  const early = await deliver(evt('customer.subscription.updated', subObject()));
  eq([early.status, early.code], [409, 'BILLING_SUBSCRIPTION_UNKNOWN'], 'a subscription event before checkout.session.completed is a retryable 409');

  const completed = evt('checkout.session.completed', session());
  let r = await deliver(completed);
  eq(r.status, 200, 'checkout.session.completed is applied');
  let s = await snapshot();
  eq([s.plan, s.status, s.provider, s.product_id], ['premium', 'active', 'web', MONTHLY], 'it binds the subscription and bridges Premium');
  ok(s.current_period_end === clock + 24 * 3600 * 1000, 'for one day only, until the subscription\'s own events carry the real period');
  ok((await db.get("SELECT account_id FROM billing_subscriptions WHERE provider='web' AND provider_subscription_id=?", [SUB])).account_id === ACCOUNT, 'the binding names the account');
  eq((await db.get("SELECT trial_claimed FROM billing_subscriptions WHERE provider_subscription_id=?", [SUB])).trial_claimed, 0, 'and records no trial for a no-trial session');

  r = await deliver(completed);
  eq([r.status, r.applied[0].replayed], [200, true], 'the same event id again is a replay, applied once');
  eq(Number((await db.get("SELECT COUNT(*) AS n FROM billing_events WHERE event_id=?", [completed.id])).n), 1, 'one ledger row');

  clock += 60_000;
  const paid = evt('invoice.paid', invoice());
  r = await deliver(paid);
  s = await snapshot();
  eq([r.status, s.status, s.current_period_end], [200, 'active', (T0 + 30 * DAY) * 1000], 'invoice.paid carries the paid period');
  ok((await db.get("SELECT amount,currency FROM billing_payments WHERE provider='web' AND payment_id='pi_AuPayment0001'")).amount === 1999, 'and records the payment a refund will match');

  clock += 60_000;
  r = await deliver(evt('customer.subscription.updated', subObject({ current_period_end: T0 + 31 * DAY })));
  s = await snapshot();
  eq([r.status, s.status, s.current_period_end], [200, 'active', (T0 + 31 * DAY) * 1000], 'customer.subscription.updated active keeps Premium to the period end');

  clock += 60_000;
  r = await deliver(evt('customer.subscription.updated', subObject({ cancel_at_period_end: true, current_period_end: T0 + 31 * DAY })));
  s = await snapshot();
  eq([s.status, s.plan], ['active', 'premium'], 'a cancel at period end leaves Premium on until the period ends');
  ok((await db.get("SELECT cancel_mode FROM billing_subscriptions WHERE provider_subscription_id=?", [SUB])).cancel_mode === 'cycle-end', 'and is recorded on the binding');

  clock += 60_000;
  r = await deliver(evt('invoice.payment_failed', invoice({ id: 'in_AuInvoice0002', period_start: T0 + 31 * DAY, lines: { data: [{ period: { start: T0 + 31 * DAY, end: T0 + 61 * DAY } }] } })));
  s = await snapshot();
  eq([r.status, s.status, s.current_period_end, s.grace_until], [200, 'grace', (T0 + 31 * DAY) * 1000, (T0 + 34 * DAY) * 1000], 'invoice.payment_failed enters grace from the last PAID period\'s end');

  clock += 60_000;
  r = await deliver(evt('customer.subscription.updated', subObject({ status: 'past_due', current_period_end: T0 + 31 * DAY })));
  s = await snapshot();
  eq(s.status, 'grace', 'a past_due subscription is grace (PRI_WEB_GRACE_DAYS) while it lasts');

  clock += 60_000;
  const wasGrace = process.env.PRI_WEB_GRACE_DAYS; process.env.PRI_WEB_GRACE_DAYS = '0';
  const noGrace = createStripeBilling(db, { fetchImpl: fakeFetch, now: () => clock });
  const nr = await db.transaction(() => noGrace.verifiers.web.webhook({ request: { rawBody: Buffer.from(JSON.stringify(evt('customer.subscription.updated', subObject({ status: 'unpaid', current_period_end: T0 + 31 * DAY })))), get: () => undefined } }).catch(e => e));
  process.env.PRI_WEB_GRACE_DAYS = wasGrace;
  eq(nr.code, 'BILLING_WEBHOOK_SIGNATURE_INVALID', '(an unsigned delivery to a second adapter is refused)');

  clock += 60_000;
  r = await deliver(evt('invoice.paid', invoice({ id: 'in_AuInvoice0003', payment_intent: 'pi_AuPayment0002', period_start: T0 + 31 * DAY, lines: { data: [{ period: { start: T0 + 31 * DAY, end: T0 + 61 * DAY } }] } })));
  s = await snapshot();
  eq([s.status, s.grace_until], ['active', null], 'a later paid invoice restores active and clears grace');

  // Out of order: an older event arriving after a newer one changes nothing.
  const old = evt('customer.subscription.updated', subObject({ status: 'past_due' }), { created: T0 + 60 });
  r = await deliver(old);
  eq([r.status, r.applied[0].stale, (await snapshot()).status], [200, true, 'active'], 'an out-of-order older event is stale and changes nothing');

  clock += 60_000;
  r = await deliver(evt('customer.subscription.deleted', subObject({ status: 'active', ended_at: T0 + 62 * DAY })));
  s = await snapshot();
  eq([r.status, s.status, s.current_period_end], [200, 'expired', (T0 + 62 * DAY) * 1000], 'customer.subscription.deleted expires it at its end');
  ok(s.plan === 'premium' && s.current_period_end < clock + 365 * 86400000, 'with the period it ended on');
}

// Mismatches are refused, not applied.
{
  const base = Number((await db.get('SELECT COUNT(*) AS n FROM billing_events')).n);
  clock += 60_000;
  const other = 'sub_Unbound00001';
  const checks409 = [
    ['an unbound subscription', evt('customer.subscription.updated', subObject({ id: other })), 'BILLING_SUBSCRIPTION_UNKNOWN'],
    ['another account\'s metadata', evt('customer.subscription.updated', subObject({ metadata: { pri_account_id: 'acct-other' } })), 'BILLING_ACCOUNT_MISMATCH'],
    ['another price', evt('customer.subscription.updated', subObject({ items: { data: [{ price: { id: ANNUAL } }] } })), 'BILLING_PRODUCT_MISMATCH'],
    ['a non-AUD subscription', evt('customer.subscription.updated', subObject({ currency: 'inr' })), 'BILLING_CURRENCY_MISMATCH'],
    ['a non-AUD invoice', evt('invoice.paid', invoice({ currency: 'usd', id: 'in_UsdInvoice001' })), 'BILLING_CURRENCY_MISMATCH'],
    ['a non-AUD session', evt('checkout.session.completed', session({ currency: 'eur', subscription: 'sub_EuroSession01' })), 'BILLING_CURRENCY_MISMATCH'],
    ['a session whose metadata names another account', evt('checkout.session.completed', session({ subscription: 'sub_Hijack000001', metadata: { pri_account_id: 'acct-other', pri_cadence: 'monthly' } })), 'BILLING_ACCOUNT_MISMATCH'],
    ['a session for an account that holds the subscription already', evt('checkout.session.completed', session({ client_reference_id: 'acct-other', metadata: { pri_account_id: 'acct-other', pri_cadence: 'monthly' } })), 'BILLING_ACCOUNT_MISMATCH'],
    ['a session naming no plan', evt('checkout.session.completed', session({ subscription: 'sub_NoPlan000001', metadata: { pri_account_id: ACCOUNT } })), 'BILLING_PRODUCT_UNKNOWN']
  ];
  for (const [label, payload, code] of checks409) {
    const r = await deliver(payload);
    eq([r.status >= 400 && r.status < 500, r.code], [true, code], `${label} is refused (${code})`);
  }
  eq(Number((await db.get('SELECT COUNT(*) AS n FROM billing_events')).n), base, 'and none of them left a ledger row');
}

// Trials, unpaid sessions, informational events, refunds.
{
  clock += 60_000;
  const SUB2 = 'sub_AuTrial000001';
  const trialSession = evt('checkout.session.completed', session({ id: 'cs_test_TrialSession1', subscription: SUB2, payment_status: 'no_payment_required', metadata: { pri_account_id: ACCOUNT, pri_cadence: 'monthly', pri_trial: '1' } }));
  let r = await deliver(trialSession);
  eq([r.status, (await db.get('SELECT trial_claimed FROM billing_subscriptions WHERE provider_subscription_id=?', [SUB2])).trial_claimed], [200, 1], 'a trial session binds with the trial recorded (and grants nothing until paid)');
  clock += 60_000;
  const trialing = evt('customer.subscription.updated', subObject({ id: SUB2, status: 'trialing', trial_end: T0 + 7 * DAY, current_period_end: T0 + 7 * DAY }));
  r = await deliver(trialing);
  let s = await snapshot();
  eq([s.status, s.current_period_end], ['trialing', (T0 + 7 * DAY) * 1000], 'a trialing subscription is trialing until the trial end');
  clock += 60_000;
  r = await deliver(evt('invoice.paid', invoice({ id: 'in_TrialInv0001', subscription: SUB2, amount_paid: 0, payment_intent: null, lines: { data: [{ period: { start: T0, end: T0 + 7 * DAY } }] } })));
  eq((await snapshot()).status, 'trialing', 'a zero-amount paid invoice is the trial, not a payment');
  eq(Number((await db.get("SELECT COUNT(*) AS n FROM billing_payments WHERE provider_subscription_id=?", [SUB2])).n), 1, '(and is recorded under its invoice id)');
  clock += 60_000;
  r = await deliver(evt('customer.subscription.updated', subObject({ id: SUB2, status: 'paused', current_period_end: T0 + 40 * DAY })));
  eq((await snapshot()).status, 'paused', 'a paused subscription is paused');
  clock += 60_000;
  r = await deliver(evt('customer.subscription.updated', subObject({ id: SUB2, status: 'incomplete', current_period_end: T0 + 40 * DAY })));
  eq([r.status, (await snapshot()).plan], [200, 'free'], 'an incomplete subscription (first payment not made) grants nothing');

  const info = evt('customer.created', { id: 'cus_AuCustomer0001' });
  r = await deliver(info);
  eq([r.status, (await deliver(info)).status, Number((await db.get('SELECT COUNT(*) AS n FROM billing_events WHERE event_id=?', [info.id])).n)], [200, 200, 1], 'an unrelated verified event is acknowledged once');
  const unpaid = evt('checkout.session.completed', session({ id: 'cs_test_Unpaid00001', subscription: 'sub_AuUnpaid00001', payment_status: 'unpaid' }));
  const before = await snapshot();
  r = await deliver(unpaid);
  eq([r.status, await snapshot()], [200, before], 'an unpaid session binds but grants nothing');

  // Refunds. Premium is on from the trial subscription; use the first subscription's payments.
  clock += 60_000;
  const SUB3 = 'sub_AuRefund00001';
  await deliver(evt('checkout.session.completed', session({ id: 'cs_test_Refund00001', subscription: SUB3 })));
  await deliver(evt('invoice.paid', invoice({ id: 'in_Refund00001', subscription: SUB3, payment_intent: 'pi_RefundOld0001', amount_paid: 1999, status_transitions: { paid_at: T0 + 1 } })));
  await deliver(evt('invoice.paid', invoice({ id: 'in_Refund00002', subscription: SUB3, payment_intent: 'pi_RefundNew0001', amount_paid: 1999, status_transitions: { paid_at: T0 + 31 * DAY }, lines: { data: [{ period: { start: T0 + 30 * DAY, end: T0 + 60 * DAY } }] } })));
  eq((await snapshot()).plan, 'premium', 'Premium is on from the current payment');
  const refund = (intent, amount, over = {}) => evt('charge.refunded', { id: `ch_${intent.slice(3)}`, object: 'charge', payment_intent: intent, currency: 'aud', amount: 1999, amount_refunded: amount, ...over });
  r = await deliver(refund('pi_RefundNew0001', 500));
  eq([r.status, (await snapshot()).plan], [200, 'premium'], 'a partial refund is recorded and changes nothing');
  r = await deliver(refund('pi_RefundOld0001', 1999));
  eq([r.status, (await snapshot()).plan], [200, 'premium'], 'a full refund of an OLDER period\'s payment changes nothing');
  r = await deliver(refund('pi_RefundNew0001', 1999));
  s = await snapshot();
  eq([r.status, s.plan, s.status], [200, 'free', 'revoked'], 'a FULL refund of the current period\'s payment revokes at once');
  ok((await db.get("SELECT amount FROM billing_refunds WHERE provider='web' AND payment_id='pi_RefundNew0001'")).amount === 1999, 'and the refund is in the ledger');
  r = await deliver(refund('pi_RefundNew0001', 1999));
  eq(r.status, 200, 'a replayed refund is acknowledged once');
  r = await deliver(refund('pi_Unknown000001', 1999));
  eq(r.status, 200, 'a refund for a payment never seen is acknowledged and changes nothing');
  r = await deliver(refund('pi_RefundNew0001', 1999, { currency: 'usd' }));
  eq([r.status, r.code], [409, 'BILLING_CURRENCY_MISMATCH'], 'a non-AUD refund is refused');
}

// ── signatures through the delivery path ─────────────────────────────────────
{
  const payload = evt('customer.created', { id: 'cus_Sig0000001' });
  const raw = Buffer.from(JSON.stringify(payload));
  const tampered = Buffer.from(JSON.stringify({ ...payload, id: 'evt_test_tampered0' }));
  let r = await deliver(payload, { raw: tampered, header: sign(raw) });
  eq([r.status, r.code], [401, 'BILLING_WEBHOOK_SIGNATURE_INVALID'], 'a tampered body is refused in the delivery path (401)');
  r = await deliver(payload, { t: Math.floor(clock / 1000) - 600 });
  eq([r.status, r.code], [401, 'BILLING_WEBHOOK_TIMESTAMP_STALE'], 'a stale timestamp is refused (401)');
  r = await deliver(payload, { secret: 'whsec_not_our_secret_00' });
  eq(r.status, 401, 'a signature from another secret is refused');
  r = await deliver(payload, { header: 'garbage' });
  eq(r.status, 401, 'a malformed header is refused');
  eq(Number((await db.get('SELECT COUNT(*) AS n FROM billing_events WHERE event_id=?', [payload.id])).n), 0, 'and none of them was recorded');
  const bad = Buffer.from('not json');
  r = await deliver(payload, { raw: bad, header: sign(bad) });
  eq([r.status, r.code], [400, 'BILLING_WEBHOOK_BODY_INVALID'], 'a signed non-JSON body is refused');
  const noId = Buffer.from(JSON.stringify({ type: 'x', data: { object: {} } }));
  r = await deliver(payload, { raw: noId, header: sign(noId) });
  eq([r.status, r.code], [400, 'BILLING_EVENT_ID_INVALID'], 'a signed event with no id is refused');
}

// ── 4 · cancel and restore ───────────────────────────────────────────────────
{
  // A clean ledger: the subscriptions above are not known to the fake Stripe.
  for (const table of ['billing_refunds', 'billing_payments', 'billing_subscriptions', 'billing_events']) await db.run(`DELETE FROM ${table}`);
  const CS = 'sub_AuCancel00001';
  subscriptions[CS] = subObject({ id: CS, status: 'active', current_period_end: T0 + 60 * DAY });
  await db.run("UPDATE entitlement_snapshots SET plan='free',status='free',provider='none'");
  await deliver(evt('checkout.session.completed', session({ id: 'cs_test_Cancel00001', subscription: CS })));
  clock += 60_000;
  await deliver(evt('invoice.paid', invoice({ id: 'in_Cancel00001', subscription: CS, payment_intent: 'pi_Cancel000001', lines: { data: [{ period: { start: T0, end: T0 + 60 * DAY } }] } })));
  eq((await snapshot()).status, 'active', 'an account with a live Stripe subscription');
  const none = await stripe.lifecycle.web.cancel({ accountId: 'acct-other', atCycleEnd: true });
  eq(none.status, 'none', 'an account with nothing to cancel gets "none"');
  const cancelled = await stripe.lifecycle.web.cancel({ accountId: ACCOUNT, atCycleEnd: true, reason: 'user' });
  eq([cancelled.status, cancelled.subscriptionId, cancelled.currentPeriodEnd, cancelled.replayed], ['cancelling', CS, (T0 + 60 * DAY) * 1000, false], 'cancel at the cycle end: cancelling, to the period end');
  const call = calls.at(-1);
  ok(call.method === 'POST' && call.url.endsWith(`/v1/subscriptions/${CS}`) && call.body.cancel_at_period_end === 'true', 'by cancel_at_period_end=true at Stripe');
  eq((await snapshot()).status, 'active', 'the entitlement is untouched: Premium stays to the period end');
  const replay = await stripe.lifecycle.web.cancel({ accountId: ACCOUNT, atCycleEnd: true });
  eq([replay.status, replay.replayed], ['cancelling', true], 'repeating it replays the same answer without a second Stripe call');
  eq(calls.at(-1), call, '(no further call was made)');
  // The boundary event is what expires it.
  clock += 60_000;
  await deliver(evt('customer.subscription.deleted', subObject({ id: CS, status: 'canceled', ended_at: T0 + 60 * DAY })));
  eq((await snapshot()).status, 'expired', 'the deleted event at the boundary expires it');

  // Immediate (account erasure).
  const IM = 'sub_AuImmediate001';
  subscriptions[IM] = subObject({ id: IM });
  await db.run("UPDATE entitlement_snapshots SET plan='free',status='free',provider='none'");
  await deliver(evt('checkout.session.completed', session({ id: 'cs_test_Immediate001', subscription: IM })));
  const imm = await stripe.lifecycle.web.cancel({ accountId: ACCOUNT, atCycleEnd: false, reason: 'account-erasure' });
  eq([imm.status, imm.cancelled], ['cancelled', [IM]], 'erasure cancels at once');
  ok(calls.at(-1).method === 'DELETE' || calls.some(c => c.method === 'DELETE' && c.url.endsWith(IM)), 'by DELETE /v1/subscriptions/{id}');
  eq((await snapshot()).status, 'expired', 'and the entitlement is expired from the provider\'s terminal answer');

  // Outage aborts erasure; a definitive refusal is not proof the mandate stopped.
  const OUT = 'sub_AuOutage00001';
  subscriptions[OUT] = subObject({ id: OUT });
  await deliver(evt('checkout.session.completed', session({ id: 'cs_test_Outage00001', subscription: OUT })));
  failNext = () => json({ error: { message: 'down' } }, 503);
  await rejects(() => stripe.lifecycle.web.cancel({ accountId: ACCOUNT, atCycleEnd: false }), 'BILLING_PROVIDER_REQUEST_FAILED', 'a provider outage aborts the cancellation (retryable)');
  failNext = () => json({ error: { message: 'key revoked' } }, 401);
  await rejects(() => stripe.lifecycle.web.cancel({ accountId: ACCOUNT, atCycleEnd: false }), 'BILLING_SUBSCRIPTION_NOT_CANCELLABLE', 'a definitive 401 is NOT proof the mandate stopped: the cancellation fails, so the account is not erased');
  // A subscription Stripe says already ended reconciles to "none".
  subscriptions[OUT].status = 'canceled';
  failNext = () => json({ error: { message: 'already canceled' } }, 400);
  const rec = await stripe.lifecycle.web.cancel({ accountId: ACCOUNT, atCycleEnd: true });
  ok(['none', 'cancelling'].includes(rec.status), 'a cancel of one Stripe reports finished is reconciled, not left half-done');

  // Restore re-reads the subscription from Stripe and is bound to the account.
  const RS = 'sub_AuRestore00001';
  subscriptions[RS] = subObject({ id: RS, current_period_end: T0 + 90 * DAY });
  await db.run("UPDATE entitlement_snapshots SET plan='free',status='free',provider='none'");
  const restored = await stripe.verifiers.web.restore({ accountId: ACCOUNT, body: { subscriptionId: RS } });
  eq([restored.verified, restored.provider, restored.status, restored.currentPeriodEnd, restored.restore], [true, 'web', 'active', (T0 + 90 * DAY) * 1000, true], 'restore reads the subscription from Stripe and normalises it');
  await rejects(() => stripe.verifiers.web.restore({ accountId: 'acct-other', body: { subscriptionId: RS } }), 'BILLING_ACCOUNT_MISMATCH', 'restore refuses a subscription bound to another account');
  subscriptions.sub_Foreign00001 = subObject({ id: 'sub_Foreign00001', metadata: { pri_account_id: 'acct-other' } });
  await rejects(() => stripe.verifiers.web.restore({ accountId: ACCOUNT, body: { subscriptionId: 'sub_Foreign00001' } }), 'BILLING_ACCOUNT_MISMATCH', 'and one whose metadata names someone else');
  await rejects(() => stripe.verifiers.web.restore({ accountId: ACCOUNT, body: { subscriptionId: 'not-a-sub' } }), 'BILLING_SUBSCRIPTION_REQUIRED', 'and a malformed id');
}

// ── 5 · the edition boundary, both ways ──────────────────────────────────────
{
  const STRIPE_VARS = { PRI_STRIPE_SECRET_KEY: SECRET_KEY, PRI_STRIPE_WEBHOOK_SECRET: WEBHOOK_SECRET, PRI_STRIPE_MONTHLY_PRICE_ID: MONTHLY, PRI_STRIPE_ANNUAL_PRICE_ID: ANNUAL };
  eq(editionBillingProblems('prithagoras', STRIPE_VARS), [], 'Prithagoras accepts Stripe\'s variables');
  eq(editionBillingProblems('priyabhata', STRIPE_VARS).length, 4, 'Priyabhata refuses every Stripe variable');
  eq(editionBillingProblems('prithagoras', { PRI_RAZORPAY_KEY_ID: 'rzp_test_x', PRI_RAZORPAY_WEBHOOK_SECRET: 'x' }).length, 2, 'Prithagoras refuses Razorpay\'s variables');
  ok(providerAllowed('prithagoras', 'stripe') && !providerAllowed('priyabhata', 'stripe') && !providerAllowed('prithagoras', 'razorpay') && providerAllowed('priyabhata', 'razorpay'), 'the provider table allows each edition its own web provider only');
  eq([webProviderOf('priyabhata'), webProviderOf('prithagoras')], ['razorpay', 'stripe'], 'the web family resolves to Razorpay for Priyabhata and Stripe for Prithagoras');
  const { createWebBilling } = await import('../platform/webBilling.js');
  ok(createWebBilling(db, { edition: 'prithagoras' }).provider === 'stripe' && createWebBilling(db, { edition: 'priyabhata' }).provider !== 'stripe', 'the adapter built for an edition is its own provider\'s');
  // A Razorpay-signed delivery to the Stripe adapter is never applied.
  const razorRaw = Buffer.from(JSON.stringify({ entity: 'event', event: 'subscription.activated', payload: { subscription: { entity: { id: 'sub_Razor000001' } } } }));
  const razorSig = createHmac('sha256', 'razorpay-webhook-secret').update(razorRaw).digest('hex');
  const r = await db.transaction(() => stripe.verifiers.web.webhook({ request: { rawBody: razorRaw, get: n => (n.toLowerCase() === 'x-razorpay-signature' ? razorSig : undefined) } }).catch(e => e));
  eq([r.status, r.code], [401, 'BILLING_WEBHOOK_SIGNATURE_INVALID'], 'a Razorpay-signed delivery is refused by the Stripe adapter');
}

// ── 6 · over HTTP: the raw bytes are what is verified ────────────────────────
{
  const { default: express } = await import('express');
  const { createBillingRouter } = await import('../platform/billing.js');
  const app = express();
  app.use(express.json({ limit: '1mb', verify(req, res, buffer) { req.rawBody = Buffer.from(buffer); } }));
  app.use('/v1/billing', createBillingRouter(db, { verifiers: stripe.verifiers, checkout: stripe.checkout, lifecycle: stripe.lifecycle, edition: 'prithagoras' }));
  app.use((err, req, res, next) => res.status(err.status || 500).json({ error: { code: err.code || 'ERR' } })); // eslint-disable-line no-unused-vars
  const server = await new Promise(resolve => { const l = app.listen(0, '127.0.0.1', () => resolve(l)); });
  const post = async (raw, header) => {
    const res = await fetch(`http://127.0.0.1:${server.address().port}/v1/billing/webhook/web`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Stripe-Signature': header }, body: raw });
    return { status: res.status, data: await res.json().catch(() => null) };
  };
  try {
    const payload = evt('customer.created', { id: 'cus_Http000001' });
    const raw = JSON.stringify(payload, null, 2); // whitespace the verifier must not normalise
    let r = await post(raw, sign(Buffer.from(raw)));
    eq([r.status, r.data?.ok], [200, true], 'over HTTP a correctly signed delivery is applied (webhook/web on Prithagoras)');
    r = await post(JSON.stringify(payload), sign(Buffer.from(raw)));
    eq(r.status, 401, 'the same JSON re-serialised differently fails: the verified bytes are the raw body');
    r = await post(raw, sign(Buffer.from(raw), { t: Math.floor(clock / 1000) - 3600 }));
    eq(r.status, 401, 'a stale delivery is 401 over HTTP');
    const razorHook = await fetch(`http://127.0.0.1:${server.address().port}/v1/billing/webhook/web`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-razorpay-signature': 'ab'.repeat(32), 'x-razorpay-event-id': 'evt_rzp_1' }, body: raw });
    eq(razorHook.status, 401, 'a Razorpay-style delivery to Prithagoras is 401');
  } finally { await new Promise(resolve => { server.closeAllConnections?.(); server.close(resolve); }); }
}

const engineName = testStore.engine;
await testStore.close();
for (const [name, value] of Object.entries(previous)) { if (value === undefined) delete process.env[name]; else process.env[name] = value; }
console.log(`engine: ${engineName}`);
console.log(`STRIPE BILLING: PASS — ${checks}/${checks} checks — Stripe-Signature (raw bytes, constant-time, five-minute tolerance), server-bound AUD checkout, every event mapped onto the entitlement model and idempotent on the event id, refunds, cancel and restore as Razorpay's, and an edition never accepts the other's provider.`);
