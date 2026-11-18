// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Stripe web subscriptions (AUD), for the Prithagoras edition
//
// The Australian counterpart of razorpay.js, with the same shape and the same
// rules, behind the same `web` route family (billing.js; the edition table in
// client/edition.config.mjs decides which provider that family is):
//
//   · Checkout is created server-side: a hosted Stripe Checkout Session for the
//     monthly or annual price, bound to the account by client_reference_id and
//     metadata only this server writes. Premium changes only on a VERIFIED
//     webhook (or a restore the server re-reads from Stripe): never on what the
//     browser says after it returns.
//   · The webhook is authenticated by the Stripe-Signature header: a t=<unix>
//     timestamp and one or more v1 HMAC-SHA256 values over `<t>.<raw body>`
//     with the endpoint secret, compared in constant time, and refused outside
//     a five-minute tolerance (a captured delivery cannot be replayed later).
//     It is idempotent on the Stripe event id (applyVerifiedEntitlement keys
//     billing_events on it) and refuses any currency other than AUD.
//   · Events map onto the existing entitlement model exactly as Razorpay's do:
//       checkout.session.completed      bind the subscription to the account; a
//                                       paid session bridges Premium for one day
//                                       until the subscription's own events
//                                       carry the real period (fail closed)
//       customer.subscription.created/updated   active / trialing / past_due →
//                                       grace / paused / expired
//       customer.subscription.deleted   expired
//       invoice.paid                    the paid period (records the payment a
//                                       refund will be matched to)
//       invoice.payment_failed          grace (if PRI_WEB_GRACE_DAYS) else past_due
//       charge.refunded                 a FULL refund of the CURRENT period's
//                                       payment revokes at once (rank 100);
//                                       partial / older refunds are recorded only
//   · Cancel: at the cycle end by the student's choice (Premium stays until the
//     period ends), immediately for account erasure; a definitive provider
//     refusal is never taken as proof the mandate stopped.
//   · No SDK: fetch against the REST API, form-encoded, with the secret key only
//     in a server variable. No network call ever runs inside a transaction.
// ─────────────────────────────────────────────────────────────────────────────
import { createHash, createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { applyVerifiedEntitlement } from './entitlements.js';
import { asStore, assertNoOpenTransaction } from './store.js';

const API_ORIGIN = 'https://api.stripe.com';
const CHECKOUT_HOST = 'checkout.stripe.com';
const CURRENCY = 'aud';
export const WEBHOOK_TOLERANCE_SECONDS = 300;
const SAFE_ID = /^[A-Za-z0-9._:-]{1,160}$/;
const STRIPE_SUBSCRIPTION = /^sub_[A-Za-z0-9_]{6,120}$/;
const STRIPE_PRICE = /^price_[A-Za-z0-9_]{6,120}$/;
const STRIPE_EVENT = /^evt_[A-Za-z0-9_]{6,120}$/;
const STRIPE_SESSION = /^cs_[A-Za-z0-9_]{6,200}$/;
const STRIPE_PAYMENT = /^(pi|ch|in)_[A-Za-z0-9_]{6,120}$/;
const SECRET_KEY = /^(sk|rk)_(test|live)_[A-Za-z0-9]{8,200}$/;
const WEBHOOK_SECRET = /^whsec_[A-Za-z0-9+/=_-]{8,200}$/;
const HEX = /^[a-f0-9]{64}$/i;
const TERMINAL_STATUS = new Set(['canceled', 'incomplete_expired']);
const CANCELLABLE_SNAPSHOT = new Set(['trialing', 'active', 'grace', 'past_due', 'paused']);
const TERMINAL_RANK = 90;
const BRIDGE_MS = 24 * 60 * 60 * 1000;
const DAY = 24 * 60 * 60 * 1000;

const configError = message => Object.assign(new Error(message), { code: 'BILLING_PROVIDER_NOT_CONFIGURED', status: 503 });
const billingError = (code, message, status = 400) => Object.assign(new Error(message), { code, status });

function positiveInt(name, fallback = null) {
  const raw = String(process.env[name] || '').trim();
  if (!raw) return fallback;
  const value = Number(raw);
  return Number.isSafeInteger(value) && value > 0 ? value : fallback;
}

function readConfig() {
  return Object.freeze({
    secretKey: String(process.env.PRI_STRIPE_SECRET_KEY || '').trim(),
    webhookSecret: String(process.env.PRI_STRIPE_WEBHOOK_SECRET || '').trim(),
    monthlyPriceId: String(process.env.PRI_STRIPE_MONTHLY_PRICE_ID || '').trim() || null,
    annualPriceId: String(process.env.PRI_STRIPE_ANNUAL_PRICE_ID || '').trim() || null,
    publicOrigin: String(process.env.PRI_PUBLIC_ORIGIN || '').trim().replace(/\/+$/, ''),
    trialDays: positiveInt('PRI_DISPLAY_TRIAL_DAYS', 0) || 0,
    // Owner option (packaging proposal): a trial that asks for no card. Stripe
    // collects a payment method only if one is needed, and a trial that ends
    // with none on file cancels (the subscription's own events then expire
    // Premium) instead of becoming an unpaid invoice. Off unless set to 1.
    trialWithoutCard: String(process.env.PRI_STRIPE_TRIAL_NO_CARD || '').trim() === '1',
    graceDays: positiveInt('PRI_WEB_GRACE_DAYS', 0) || 0
  });
}

export function stripeConfigStatus() {
  const cfg = readConfig();
  const productConfigured = !!(cfg.monthlyPriceId || cfg.annualPriceId);
  const credentialsConfigured = SECRET_KEY.test(cfg.secretKey) && WEBHOOK_SECRET.test(cfg.webhookSecret);
  const priceIdsValid = (!cfg.monthlyPriceId || STRIPE_PRICE.test(cfg.monthlyPriceId)) && (!cfg.annualPriceId || STRIPE_PRICE.test(cfg.annualPriceId));
  let originValid = false;
  try { const u = new URL(cfg.publicOrigin); originValid = u.protocol === 'https:' || (u.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(u.hostname)); } catch { /* invalid */ }
  return Object.freeze({
    productConfigured, credentialsConfigured, priceIdsValid, originValid,
    configured: productConfigured && credentialsConfigured && priceIdsValid && originValid
  });
}

function requireConfigured() {
  if (!stripeConfigStatus().configured) {
    throw configError('Stripe web subscriptions require valid price ids, an API key, a webhook secret and the public origin.');
  }
}

const digest = value => createHash('sha256').update(value).digest('hex');
const seconds = value => { const n = Number(value); return Number.isFinite(n) && n > 0 ? Math.floor(n * 1000) : null; };
const minorUnits = value => { const n = Number(value); return Number.isSafeInteger(n) && n >= 0 ? n : 0; };

/**
 * Verify a Stripe-Signature header over the raw body. Returns the raw body.
 * `now` is epoch milliseconds (injectable for tests).
 */
export function verifyStripeSignature(rawBody, header, secret, now = Date.now(), tolerance = WEBHOOK_TOLERANCE_SECONDS) {
  const raw = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(rawBody || '');
  if (!raw.length) throw billingError('BILLING_WEBHOOK_BODY_REQUIRED', 'Webhook raw body is missing.');
  const parts = String(header || '').split(',').map(p => p.trim()).filter(Boolean);
  const timestamp = parts.find(p => p.startsWith('t='))?.slice(2) || '';
  const candidates = parts.filter(p => p.startsWith('v1=')).map(p => p.slice(3)).filter(v => HEX.test(v));
  if (!/^[0-9]{1,12}$/.test(timestamp) || !candidates.length) throw billingError('BILLING_WEBHOOK_SIGNATURE_INVALID', 'Billing webhook signature is invalid.', 401);
  const expected = createHmac('sha256', secret).update(`${timestamp}.`).update(raw).digest();
  // Every v1 value is compared (Stripe sends several while a secret rotates), each in constant time.
  let match = false;
  for (const candidate of candidates) {
    const received = Buffer.from(candidate, 'hex');
    if (received.length === expected.length && timingSafeEqual(received, expected)) match = true;
  }
  if (!match) throw billingError('BILLING_WEBHOOK_SIGNATURE_INVALID', 'Billing webhook signature is invalid.', 401);
  // A signature that is valid but old is a replay of a captured delivery.
  if (Math.abs(Math.floor(now / 1000) - Number(timestamp)) > tolerance) throw billingError('BILLING_WEBHOOK_TIMESTAMP_STALE', 'Billing webhook timestamp is outside the tolerance.', 401);
  return raw;
}

function form(data, prefix = '', out = new URLSearchParams()) {
  for (const [key, value] of Object.entries(data)) {
    if (value === undefined || value === null) continue;
    const name = prefix ? `${prefix}[${key}]` : key;
    if (Array.isArray(value)) value.forEach((v, i) => (v && typeof v === 'object' ? form(v, `${name}[${i}]`, out) : out.append(`${name}[${i}]`, String(v))));
    else if (typeof value === 'object') form(value, name, out);
    else out.append(name, String(value));
  }
  return out;
}

async function providerRequest(cfg, path, { method = 'GET', body, idempotencyKey, fetchImpl = globalThis.fetch } = {}) {
  // Never inside a database transaction: a webhook verifier runs inside one
  // (billing.js) and may be re-run on a serialization retry.
  assertNoOpenTransaction('A Stripe API call');
  if (typeof fetchImpl !== 'function') throw configError('No HTTP implementation is available for Stripe.');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetchImpl(`${API_ORIGIN}${path}`, {
      method,
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${cfg.secretKey}`,
        ...(body === undefined ? {} : { 'Content-Type': 'application/x-www-form-urlencoded' }),
        ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {})
      },
      body: body === undefined ? undefined : form(body).toString(),
      signal: controller.signal,
      redirect: 'error'
    });
    const text = await response.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch { throw billingError('BILLING_PROVIDER_BAD_RESPONSE', 'Stripe returned invalid JSON.', 502); }
    if (!response.ok) {
      const error = billingError('BILLING_PROVIDER_REQUEST_FAILED', data?.error?.message || 'Stripe request failed.', response.status >= 500 ? 502 : 400);
      error.providerStatus = response.status;
      error.definitiveFailure = response.status >= 400 && response.status < 500 && ![408, 409, 429].includes(response.status);
      throw error;
    }
    return data;
  } catch (error) {
    if (error?.code) throw error;
    throw billingError('BILLING_PROVIDER_UNAVAILABLE', 'Stripe is temporarily unavailable.', 502);
  } finally {
    clearTimeout(timer);
  }
}

function cadenceForPrice(cfg, price) {
  if (price && price === cfg.monthlyPriceId) return 'monthly';
  if (price && price === cfg.annualPriceId) return 'annual';
  return null;
}

const subscriptionPrice = sub => String(sub?.items?.data?.[0]?.price?.id || sub?.plan?.id || '');
const subscriptionPeriodEnd = sub => seconds(sub?.current_period_end ?? sub?.items?.data?.[0]?.current_period_end);
const invoiceSubscription = inv => String(inv?.subscription || inv?.parent?.subscription_details?.subscription || '');
const accountFromMetadata = obj => {
  const v = String(obj?.metadata?.pri_account_id || '');
  return SAFE_ID.test(v) ? v : null;
};

function refuseCurrency(value) {
  if (value !== undefined && value !== null && String(value).toLowerCase() !== CURRENCY) {
    throw billingError('BILLING_CURRENCY_MISMATCH', 'This event is not in Australian dollars; the Prithagoras edition sells in AUD only.', 409);
  }
}

// Stripe subscription → the entitlement model (same states, same ranks as razorpay.js).
function normalizeSubscription(cfg, sub, { accountId, eventId, eventType, payloadDigest, effectiveAt = Date.now(), restore = false }) {
  const id = String(sub?.id || '');
  if (!STRIPE_SUBSCRIPTION.test(id)) throw billingError('BILLING_SUBSCRIPTION_INVALID', 'Stripe subscription payload is invalid.');
  const price = subscriptionPrice(sub);
  const cadence = cadenceForPrice(cfg, price);
  if (!cadence) throw billingError('BILLING_PRODUCT_UNKNOWN', 'Stripe subscription uses an unrecognised Pri Learning price.');
  refuseCurrency(sub.currency);
  if (!SAFE_ID.test(String(accountId || ''))) throw billingError('BILLING_ACCOUNT_INVALID', 'Billing account binding is invalid.');
  const now = Date.now();
  const end = subscriptionPeriodEnd(sub);
  const status = String(sub.status || '');
  let plan = 'free', normalized = 'free', periodEnd = null, graceUntil = null, rank = 10;
  if (status === 'active') { plan = 'premium'; normalized = 'active'; periodEnd = end; rank = 50; }
  else if (status === 'trialing') { plan = 'premium'; normalized = 'trialing'; periodEnd = seconds(sub.trial_end) || end; rank = 40; }
  else if (status === 'past_due' && end && cfg.graceDays > 0) {
    plan = 'premium'; normalized = 'grace'; periodEnd = end; graceUntil = end + cfg.graceDays * DAY; rank = 65;
  } else if (status === 'past_due' || status === 'unpaid') {
    // 'unpaid': Stripe has stopped collecting. Premium runs to the paid period's end and no further (no grace).
    plan = 'premium'; normalized = 'past_due'; periodEnd = end; rank = 60;
  }
  else if (status === 'paused') { plan = 'premium'; normalized = 'paused'; periodEnd = end; rank = 70; }
  else if (TERMINAL_STATUS.has(status)) { plan = 'premium'; normalized = 'expired'; periodEnd = seconds(sub.ended_at) || seconds(sub.canceled_at) || end; rank = 90; }
  // 'incomplete' (first payment not yet made) stays free until invoice.paid.
  return {
    verified: true, provider: 'web', eventId, accountId: String(accountId), eventType, providerSubscriptionId: id, productId: price,
    billingCadence: cadence, plan, status: normalized, currentPeriodEnd: periodEnd, graceUntil, payloadDigest,
    effectiveAt: Number.isFinite(Number(effectiveAt)) ? Number(effectiveAt) : now, eventRank: rank, restore: !!restore
  };
}

async function storeBinding(db, { subscriptionId, accountId, priceId, cadence, trialClaimed, now = Date.now() }) {
  await db.run(`INSERT INTO billing_subscriptions
    (provider,provider_subscription_id,account_id,product_id,cadence,trial_claimed,created_at,updated_at,last_effective_at,last_event_rank,last_event_id)
    VALUES ('web',?,?,?,?,?,?,?,0,0,NULL)
    ON CONFLICT(provider,provider_subscription_id) DO UPDATE SET
      product_id=excluded.product_id,cadence=excluded.cadence,
      trial_claimed=${db.greatest('billing_subscriptions.trial_claimed', 'excluded.trial_claimed')},updated_at=excluded.updated_at`,
  [subscriptionId, accountId, priceId, cadence, trialClaimed ? 1 : 0, now, now]);
}
const boundSubscription = (db, id) => db.get("SELECT * FROM billing_subscriptions WHERE provider='web' AND provider_subscription_id=?", [id]);

async function reserveTrial(db, accountId, reservationId, now) {
  const info = await db.run(`INSERT INTO billing_trial_claims(account_id,provider,provider_subscription_id,claimed_at)
    VALUES (?,'web',?,?) ON CONFLICT(account_id) DO NOTHING`, [accountId, reservationId, now]);
  return info.changes === 1;
}
const releaseTrialReservation = (db, accountId, reservationId) =>
  db.run("DELETE FROM billing_trial_claims WHERE account_id=? AND provider='web' AND provider_subscription_id=?", [accountId, reservationId]);
const attachTrialSubscription = (db, accountId, reservationId, subscriptionId) =>
  db.run("UPDATE billing_trial_claims SET provider_subscription_id=? WHERE account_id=? AND provider='web' AND provider_subscription_id=?", [subscriptionId, accountId, reservationId]);

const audit = (db, actor, action, targetKind, targetId, metadata = {}, now = Date.now()) =>
  db.run('INSERT INTO audit_log(actor_account_id,action,target_kind,target_id,metadata_json,created_at) VALUES (?,?,?,?,?,?)', [actor, action, targetKind, targetId, JSON.stringify(metadata), now]);

async function acknowledgeEvent(db, { eventId, eventType, accountId = null, payloadDigest, now = Date.now() }) {
  await db.run(`INSERT INTO billing_events(provider,event_id,account_id,event_type,verified,payload_digest,received_at,applied_at)
    VALUES ('web',?,?,?,1,?,?,?) ON CONFLICT(provider,event_id) DO NOTHING`, [eventId, accountId, eventType, payloadDigest, now, now]);
  return [];
}

async function recordPayment(db, { paymentId, subscriptionId, accountId, amount, currency, status, capturedAt, now = Date.now() }) {
  if (!STRIPE_PAYMENT.test(String(paymentId || '')) || !STRIPE_SUBSCRIPTION.test(String(subscriptionId || ''))) return false;
  await db.run(`INSERT INTO billing_payments(provider,payment_id,provider_subscription_id,account_id,amount,currency,status,captured_at,created_at,updated_at)
    VALUES ('web',?,?,?,?,?,?,?,?,?)
    ON CONFLICT(provider,payment_id) DO UPDATE SET amount=${db.greatest('billing_payments.amount', 'excluded.amount')},
      status=excluded.status,currency=COALESCE(excluded.currency,billing_payments.currency),updated_at=excluded.updated_at`,
  [String(paymentId), String(subscriptionId), accountId, minorUnits(amount), currency ? String(currency).toLowerCase().slice(0, 8) : null,
    status ? String(status).slice(0, 40) : null, capturedAt || now, now, now]);
  return true;
}

/**
 * charge.refunded → an entitlement decision, with Razorpay's rules: a refund
 * counts only for a payment seen on a bound subscription (invoice.paid records
 * it); a FULL refund of the payment covering the CURRENT period revokes Premium
 * at once (rank 100, no grace); a partial refund or an older period's refund is
 * recorded and acknowledged only. Stripe's charge carries the cumulative
 * amount_refunded, kept as one running row per payment.
 */
async function refundEvent(db, { charge, eventId, eventType, payloadDigest, effectiveAt, now }) {
  const chargeId = String(charge?.id || '');
  const candidates = [charge?.payment_intent, chargeId].map(v => String(v || '')).filter(v => STRIPE_PAYMENT.test(v));
  let payment = null;
  for (const id of candidates) { payment = await db.get("SELECT * FROM billing_payments WHERE provider='web' AND payment_id=?", [id]); if (payment) break; }
  if (!payment) return acknowledgeEvent(db, { eventId, eventType, payloadDigest, now });
  refuseCurrency(charge.currency);
  const paymentId = payment.payment_id;
  const total = minorUnits(charge.amount_refunded);
  await db.run(`INSERT INTO billing_refunds(provider,refund_id,payment_id,amount,status,created_at,updated_at)
    VALUES ('web',?,?,?,'processed',?,?)
    ON CONFLICT(provider,refund_id) DO UPDATE SET amount=excluded.amount,status=excluded.status,updated_at=excluded.updated_at`,
  [`cumulative:${paymentId}`, paymentId, total, effectiveAt, now]);
  const latest = await db.get(`SELECT payment_id FROM billing_payments WHERE provider='web' AND provider_subscription_id=?
    ORDER BY captured_at DESC, created_at DESC LIMIT 1`, [payment.provider_subscription_id]);
  const binding = await boundSubscription(db, payment.provider_subscription_id);
  const full = payment.amount > 0 && total >= payment.amount;
  const current = latest?.payment_id === paymentId;
  const accountId = binding?.account_id || payment.account_id || null;
  await audit(db, null, 'billing.refund', 'subscription', payment.provider_subscription_id,
    { paymentId, refundedTotal: total, full, currentPeriod: current, eventType }, now);
  if (!binding || !full || !current) return acknowledgeEvent(db, { eventId, eventType, accountId, payloadDigest, now });
  return {
    verified: true, provider: 'web', eventId, accountId: binding.account_id, eventType, providerSubscriptionId: payment.provider_subscription_id,
    productId: binding.product_id, billingCadence: binding.cadence, plan: 'free', status: 'revoked', currentPeriodEnd: effectiveAt, graceUntil: null,
    payloadDigest, effectiveAt, eventRank: 100, refund: { paymentId, refundedTotal: total }
  };
}

export function createStripeBilling(db, { fetchImpl = globalThis.fetch, now: clock = Date.now } = {}) {
  db = asStore(db);
  const cfg = readConfig();

  async function createCheckout({ accountId, cadence }) {
    requireConfigured();
    if (!['monthly', 'annual'].includes(cadence)) throw billingError('BILLING_CADENCE_INVALID', 'Choose a monthly or annual subscription.');
    const account = await db.get('SELECT id,email FROM accounts WHERE id=? AND deleted_at IS NULL', [accountId]);
    if (!account) throw billingError('BILLING_ACCOUNT_INVALID', 'Billing account does not exist.', 404);
    const priceId = cadence === 'monthly' ? cfg.monthlyPriceId : cfg.annualPriceId;
    if (!priceId) throw configError(`The ${cadence} Stripe price is not configured.`);
    const now = clock();
    const reservationId = `trial-reservation:${randomUUID()}`;
    const trialApplied = cfg.trialDays > 0 && await reserveTrial(db, accountId, reservationId, now);
    const meta = { pri_account_id: accountId, pri_cadence: cadence, pri_trial: trialApplied ? '1' : '0' };
    let session;
    try {
      session = await providerRequest(cfg, '/v1/checkout/sessions', {
        method: 'POST', fetchImpl, idempotencyKey: `pri-checkout-${randomUUID()}`,
        body: {
          mode: 'subscription',
          line_items: [{ price: priceId, quantity: 1 }],
          client_reference_id: accountId,
          customer_email: account.email,
          success_url: `${cfg.publicOrigin}/?billing=success`,
          cancel_url: `${cfg.publicOrigin}/?billing=cancelled`,
          metadata: meta,
          ...(trialApplied && cfg.trialWithoutCard ? { payment_method_collection: 'if_required' } : {}),
          subscription_data: {
            metadata: meta,
            ...(trialApplied ? { trial_period_days: cfg.trialDays } : {}),
            ...(trialApplied && cfg.trialWithoutCard ? { trial_settings: { end_behavior: { missing_payment_method: 'cancel' } } } : {})
          }
        }
      });
    } catch (error) {
      // Release only on a definitive rejection; an ambiguous failure keeps the
      // reservation so a retry cannot manufacture a second free trial.
      if (trialApplied && error?.definitiveFailure) await releaseTrialReservation(db, accountId, reservationId);
      throw error;
    }
    if (!STRIPE_SESSION.test(String(session?.id || ''))) throw billingError('BILLING_PROVIDER_BAD_RESPONSE', 'Stripe returned an invalid checkout session.', 502);
    let url;
    try {
      url = new URL(String(session.url || ''));
      if (url.protocol !== 'https:' || url.hostname !== CHECKOUT_HOST) throw new Error('bad checkout url');
    } catch { throw billingError('BILLING_PROVIDER_BAD_RESPONSE', 'Stripe did not return a valid hosted checkout URL.', 502); }
    if (trialApplied) await attachTrialSubscription(db, accountId, reservationId, session.id);
    return { provider: 'web', checkoutProvider: 'stripe', sessionId: session.id, checkoutUrl: url.toString(), cadence, trialApplied, trialDays: trialApplied ? cfg.trialDays : 0 };
  }

  async function webhook({ request }) {
    requireConfigured();
    const raw = verifyStripeSignature(request.rawBody, request.get('stripe-signature'), cfg.webhookSecret, clock());
    let payload;
    try { payload = JSON.parse(raw.toString('utf8')); } catch { throw billingError('BILLING_WEBHOOK_BODY_INVALID', 'Stripe webhook body is invalid JSON.'); }
    const eventId = String(payload?.id || '');
    if (!STRIPE_EVENT.test(eventId)) throw billingError('BILLING_EVENT_ID_INVALID', 'Stripe event id is missing or invalid.');
    const type = String(payload?.type || '').slice(0, 160);
    const object = payload?.data?.object;
    const now = clock();
    const payloadDigest = digest(raw);
    const effectiveAt = seconds(payload?.created) || now;

    return db.transaction(async () => {
      const authoritative = ['checkout.session.completed', 'customer.subscription.created', 'customer.subscription.updated', 'customer.subscription.deleted',
        'invoice.paid', 'invoice.payment_failed'].includes(type);
      // Informational events are acknowledged exactly once; authoritative ones
      // are replay-safe inside applyVerifiedEntitlement (billing_events is keyed
      // on the event id).
      if (!authoritative && (await db.get("SELECT applied_at FROM billing_events WHERE provider='web' AND event_id=?", [eventId]))?.applied_at) return [];

      if (type === 'checkout.session.completed') {
        const subscriptionId = String(object?.subscription || '');
        const accountId = String(object?.client_reference_id || '');
        if (object?.mode !== 'subscription' || !STRIPE_SUBSCRIPTION.test(subscriptionId) || !SAFE_ID.test(accountId)) {
          return acknowledgeEvent(db, { eventId, eventType: type, payloadDigest, now });
        }
        if (accountFromMetadata(object) !== accountId) throw billingError('BILLING_ACCOUNT_MISMATCH', 'Stripe session account binding does not match.', 409);
        refuseCurrency(object.currency);
        const cadence = String(object?.metadata?.pri_cadence || '');
        if (!['monthly', 'annual'].includes(cadence)) throw billingError('BILLING_PRODUCT_UNKNOWN', 'Stripe session names no known Pri Learning plan.');
        const priceId = cadence === 'monthly' ? cfg.monthlyPriceId : cfg.annualPriceId;
        if (!priceId) throw billingError('BILLING_PRODUCT_UNKNOWN', 'That Pri Learning plan is not configured.');
        const existing = await boundSubscription(db, subscriptionId);
        if (existing && existing.account_id !== accountId) throw billingError('BILLING_ACCOUNT_MISMATCH', 'This subscription belongs to another Pri Learning account.', 409);
        await storeBinding(db, { subscriptionId, accountId, priceId, cadence, trialClaimed: String(object?.metadata?.pri_trial || '') === '1', now });
        if (String(object?.metadata?.pri_trial || '') === '1') {
          await db.run(`UPDATE billing_trial_claims SET provider_subscription_id=? WHERE account_id=? AND provider='web' AND provider_subscription_id=?`,
            [subscriptionId, accountId, String(object?.id || '')]);
        }
        // A paid session bridges Premium for one day; the subscription's own
        // events carry the real period and replace it. If they never arrive the
        // bridge lapses: the entitlement fails closed.
        if (object.payment_status !== 'paid') return acknowledgeEvent(db, { eventId, eventType: type, accountId, payloadDigest, now });
        return {
          verified: true, provider: 'web', eventId, accountId, eventType: type, providerSubscriptionId: subscriptionId, productId: priceId, billingCadence: cadence,
          plan: 'premium', status: 'active', currentPeriodEnd: effectiveAt + BRIDGE_MS, graceUntil: null, payloadDigest, effectiveAt, eventRank: 45
        };
      }

      if (type.startsWith('customer.subscription.')) {
        const subscriptionId = String(object?.id || '');
        const binding = STRIPE_SUBSCRIPTION.test(subscriptionId) ? await boundSubscription(db, subscriptionId) : null;
        // An unbound subscription is a genuine mismatch (409): Stripe retries
        // (delivery can precede checkout.session.completed) and support notices.
        if (!binding) throw billingError('BILLING_SUBSCRIPTION_UNKNOWN', 'Stripe subscription is not bound to a Pri Learning account.', 409);
        const noteAccount = accountFromMetadata(object);
        if (noteAccount && noteAccount !== binding.account_id) throw billingError('BILLING_ACCOUNT_MISMATCH', 'Stripe subscription account binding does not match.', 409);
        if (subscriptionPrice(object) !== binding.product_id) throw billingError('BILLING_PRODUCT_MISMATCH', 'Stripe subscription price does not match its Pri Learning binding.', 409);
        if (object.cancel_at_period_end === true && !binding.cancel_requested_at) {
          await db.run("UPDATE billing_subscriptions SET cancel_requested_at=?,cancel_mode='cycle-end',cancel_reason='provider',updated_at=? WHERE provider='web' AND provider_subscription_id=?", [now, now, subscriptionId]);
        }
        const forced = type === 'customer.subscription.deleted' ? { ...object, status: 'canceled' } : object;
        return normalizeSubscription(cfg, forced, { accountId: binding.account_id, eventId, eventType: type, payloadDigest, effectiveAt });
      }

      if (type === 'invoice.paid' || type === 'invoice.payment_failed') {
        const subscriptionId = invoiceSubscription(object);
        const binding = STRIPE_SUBSCRIPTION.test(subscriptionId) ? await boundSubscription(db, subscriptionId) : null;
        if (!binding) throw billingError('BILLING_SUBSCRIPTION_UNKNOWN', 'Stripe subscription is not bound to a Pri Learning account.', 409);
        refuseCurrency(object.currency);
        const lines = Array.isArray(object?.lines?.data) ? object.lines.data : [];
        const lineEnd = Math.max(0, ...lines.map(l => seconds(l?.period?.end) || 0)) || null;
        if (type === 'invoice.paid') {
          const paymentId = [object.payment_intent, object.charge, object.id].map(v => String(v || '')).find(v => STRIPE_PAYMENT.test(v));
          await recordPayment(db, { paymentId, subscriptionId, accountId: binding.account_id, amount: object.amount_paid, currency: object.currency, status: 'paid', capturedAt: seconds(object.status_transitions?.paid_at) || effectiveAt, now });
          // No period on any line: nothing says how long this paid for, so it grants nothing (the subscription events will).
          if (!lineEnd) return acknowledgeEvent(db, { eventId, eventType: type, accountId: binding.account_id, payloadDigest, now });
          const free = minorUnits(object.amount_paid) === 0;
          return {
            verified: true, provider: 'web', eventId, accountId: binding.account_id, eventType: type, providerSubscriptionId: subscriptionId, productId: binding.product_id,
            billingCadence: binding.cadence, plan: 'premium', status: free ? 'trialing' : 'active', currentPeriodEnd: lineEnd, graceUntil: null, payloadDigest, effectiveAt, eventRank: free ? 40 : 50
          };
        }
        // A failed FIRST invoice (subscription_create) means nothing was ever paid:
        // there is no paid period to extend, so it grants nothing.
        if (object.billing_reason === 'subscription_create') return acknowledgeEvent(db, { eventId, eventType: type, accountId: binding.account_id, payloadDigest, now });
        // The failed invoice's period_start is the end of the last PAID period.
        const paidEnd = seconds(object.period_start) || lineEnd;
        const grace = cfg.graceDays > 0 && paidEnd;
        return {
          verified: true, provider: 'web', eventId, accountId: binding.account_id, eventType: type, providerSubscriptionId: subscriptionId, productId: binding.product_id,
          billingCadence: binding.cadence, plan: 'premium', status: grace ? 'grace' : 'past_due', currentPeriodEnd: paidEnd,
          graceUntil: grace ? paidEnd + cfg.graceDays * DAY : null, payloadDigest, effectiveAt, eventRank: grace ? 65 : 60
        };
      }

      if (type === 'charge.refunded') return refundEvent(db, { charge: object, eventId, eventType: type, payloadDigest, effectiveAt, now });
      return acknowledgeEvent(db, { eventId, eventType: type, payloadDigest, now });
    });
  }

  const providerCancel = (id, atCycleEnd) => (atCycleEnd
    ? providerRequest(cfg, `/v1/subscriptions/${id}`, { method: 'POST', body: { cancel_at_period_end: true }, fetchImpl })
    : providerRequest(cfg, `/v1/subscriptions/${id}`, { method: 'DELETE', fetchImpl }));

  async function markCancelled({ subscriptionId, accountId, mode, reason, currentPeriodEnd, providerStatus, now }) {
    await db.transaction(async () => {
      await db.run("UPDATE billing_subscriptions SET cancel_requested_at=?,cancel_mode=?,cancel_reason=?,updated_at=? WHERE provider='web' AND provider_subscription_id=?", [now, mode, reason, now, subscriptionId]);
      await audit(db, accountId, 'billing.cancel', 'subscription', subscriptionId, { provider: 'web', mode, reason, currentPeriodEnd, providerStatus }, now);
    });
  }

  // A definitive 4xx is never proof the mandate stopped (rotated key, bad request):
  // ask Stripe for the subscription itself and trust only a terminal status.
  async function providerTerminalState(subscriptionId) {
    let sub = null;
    try { sub = await providerRequest(cfg, `/v1/subscriptions/${subscriptionId}`, { fetchImpl }); } catch { return null; }
    return sub && TERMINAL_STATUS.has(String(sub.status || '')) ? sub : null;
  }

  async function applyTerminalState(sub, accountId, now, eventType) {
    try {
      return await applyVerifiedEntitlement(db, normalizeSubscription(cfg, sub, {
        accountId, eventId: `${eventType}:${sub.id}:${now}`, eventType,
        payloadDigest: digest(JSON.stringify({ id: sub.id, status: sub.status, at: now })), effectiveAt: now
      }));
    } catch { return null; }
  }

  /** Same contract as razorpay.js cancel(): at the cycle end for a student, at once for erasure. */
  async function cancel({ accountId, atCycleEnd = true, reason = 'user' }) {
    if (!SAFE_ID.test(String(accountId || ''))) throw billingError('BILLING_ACCOUNT_INVALID', 'Billing account binding is invalid.');
    const now = clock();
    const snapshot = await db.get('SELECT status,provider,current_period_end,grace_until FROM entitlement_snapshots WHERE account_id=?', [accountId]);
    const bindings = await db.all(`SELECT * FROM billing_subscriptions
      WHERE provider='web' AND account_id=? AND cancel_requested_at IS NULL AND last_event_rank < ?
      ORDER BY last_effective_at DESC, created_at DESC`, [accountId, TERMINAL_RANK]);
    const safeReason = String(reason || 'user').slice(0, 40);

    if (atCycleEnd) {
      const live = snapshot?.provider === 'web' && CANCELLABLE_SNAPSHOT.has(snapshot.status);
      const periodEnd = (snapshot?.status === 'grace' ? snapshot.grace_until : snapshot?.current_period_end) || null;
      if (!live) return { provider: 'web', status: 'none', subscriptionId: null, currentPeriodEnd: null };
      const pending = await db.get(`SELECT provider_subscription_id,cancel_requested_at FROM billing_subscriptions
        WHERE provider='web' AND account_id=? AND cancel_requested_at IS NOT NULL AND cancel_mode='cycle-end'
        ORDER BY cancel_requested_at DESC LIMIT 1`, [accountId]);
      if (!bindings.length && pending) return { provider: 'web', status: 'cancelling', subscriptionId: pending.provider_subscription_id, currentPeriodEnd: periodEnd, requestedAt: pending.cancel_requested_at, replayed: true };
      if (!bindings.length) return { provider: 'web', status: 'none', subscriptionId: null, currentPeriodEnd: null };
      requireConfigured();
      const target = bindings[0];
      let sub;
      try { sub = await providerCancel(target.provider_subscription_id, true); } catch (error) {
        if (!error?.definitiveFailure) throw error;
        const terminal = await providerTerminalState(target.provider_subscription_id);
        if (!terminal) throw billingError('BILLING_SUBSCRIPTION_NOT_CANCELLABLE', error.message || 'Stripe declined the cancellation.', 409);
        await applyTerminalState(terminal, accountId, now, 'subscription.reconcile');
        await audit(db, accountId, 'billing.cancel.reconciled', 'subscription', target.provider_subscription_id, { provider: 'web', providerStatus: String(terminal.status || '') }, now);
        return { provider: 'web', status: 'none', subscriptionId: target.provider_subscription_id, currentPeriodEnd: null, reconciled: true };
      }
      const currentPeriodEnd = subscriptionPeriodEnd(sub) || periodEnd;
      await markCancelled({ subscriptionId: target.provider_subscription_id, accountId, mode: 'cycle-end', reason: safeReason, currentPeriodEnd, providerStatus: String(sub?.status || ''), now });
      return { provider: 'web', status: 'cancelling', subscriptionId: target.provider_subscription_id, currentPeriodEnd, requestedAt: now, replayed: false };
    }

    if (!bindings.length) return { provider: 'web', status: 'none', subscriptionId: null, currentPeriodEnd: null, cancelled: [] };
    requireConfigured();
    const cancelled = [];
    for (const binding of bindings) {
      let sub = null;
      try { sub = await providerCancel(binding.provider_subscription_id, false); } catch (error) {
        if (!error?.definitiveFailure) throw error;
        sub = await providerTerminalState(binding.provider_subscription_id);
        if (!sub) throw billingError('BILLING_SUBSCRIPTION_NOT_CANCELLABLE', error.message || 'Stripe declined the cancellation.', 409);
      }
      await markCancelled({ subscriptionId: binding.provider_subscription_id, accountId, mode: 'immediate', reason: safeReason, currentPeriodEnd: subscriptionPeriodEnd(sub) || null, providerStatus: String(sub?.status || ''), now });
      if (TERMINAL_STATUS.has(String(sub?.status || ''))) await applyTerminalState(sub, accountId, now, 'subscription.cancel-request');
      cancelled.push(binding.provider_subscription_id);
    }
    return { provider: 'web', status: 'cancelled', subscriptionId: cancelled[0] || null, currentPeriodEnd: null, cancelled };
  }

  async function restore({ accountId, body }) {
    requireConfigured();
    let subscriptionId = String(body?.subscriptionId || '');
    if (!subscriptionId) {
      subscriptionId = String((await db.get("SELECT provider_subscription_id FROM billing_subscriptions WHERE provider='web' AND account_id=? ORDER BY created_at DESC LIMIT 1", [accountId]))?.provider_subscription_id || '');
    }
    if (!STRIPE_SUBSCRIPTION.test(subscriptionId)) throw billingError('BILLING_SUBSCRIPTION_REQUIRED', 'No Stripe subscription is linked to this account.', 404);
    const sub = await providerRequest(cfg, `/v1/subscriptions/${subscriptionId}`, { fetchImpl });
    const noteAccount = accountFromMetadata(sub);
    const price = subscriptionPrice(sub);
    const cadence = cadenceForPrice(cfg, price);
    await db.transaction(async () => {
      const existing = await boundSubscription(db, subscriptionId);
      if (existing && existing.account_id !== accountId) throw billingError('BILLING_ACCOUNT_MISMATCH', 'This subscription belongs to another Pri Learning account.', 409);
      if (!existing && noteAccount !== accountId) throw billingError('BILLING_ACCOUNT_MISMATCH', 'Stripe subscription is not bound to this Pri Learning account.', 409);
      if (!cadence) throw billingError('BILLING_PRODUCT_UNKNOWN', 'Stripe subscription uses an unrecognised Pri Learning price.');
      if (!existing) await storeBinding(db, { subscriptionId, accountId, priceId: price, cadence, trialClaimed: String(sub?.metadata?.pri_trial || '') === '1' });
    });
    const stateDigest = digest(JSON.stringify({ id: sub.id, status: sub.status, price, end: subscriptionPeriodEnd(sub), ended: sub.ended_at }));
    return normalizeSubscription(cfg, sub, {
      accountId, eventId: `restore:${sub.id}:${stateDigest.slice(0, 24)}`, eventType: 'subscription.restore',
      payloadDigest: stateDigest, effectiveAt: clock(), restore: true
    });
  }

  return Object.freeze({
    provider: 'stripe',
    configured: stripeConfigStatus().configured,
    verifiers: Object.freeze({ web: Object.freeze({ webhook, restore }) }),
    checkout: Object.freeze({ web: Object.freeze({ create: createCheckout }) }),
    lifecycle: Object.freeze({ web: Object.freeze({ cancel }) })
  });
}
