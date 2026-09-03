import { createHash, createHmac, randomUUID, timingSafeEqual } from 'node:crypto';

const API_ORIGIN = 'https://api.razorpay.com';
const API_PATH = '/v1/subscriptions';
const SAFE_ID = /^[A-Za-z0-9._:-]{1,160}$/;
const RAZORPAY_SUBSCRIPTION = /^sub_[A-Za-z0-9]{8,80}$/;
const RAZORPAY_PLAN = /^plan_[A-Za-z0-9]{8,80}$/;
const SIGNATURE = /^[a-f0-9]{64}$/i;

function configError(message) {
  return Object.assign(new Error(message), { code: 'BILLING_PROVIDER_NOT_CONFIGURED', status: 503 });
}

function billingError(code, message, status = 400) {
  return Object.assign(new Error(message), { code, status });
}

function positiveInt(name, fallback = null) {
  const raw = String(process.env[name] || '').trim();
  if (!raw) return fallback;
  const value = Number(raw);
  return Number.isSafeInteger(value) && value > 0 ? value : fallback;
}

function planId(cadence) {
  const specific = cadence === 'monthly' ? process.env.PRI_RAZORPAY_MONTHLY_PLAN_ID : process.env.PRI_RAZORPAY_ANNUAL_PLAN_ID;
  const generic = cadence === 'monthly' ? process.env.PRI_WEB_MONTHLY_PRICE_ID : process.env.PRI_WEB_ANNUAL_PRICE_ID;
  const value = String(specific || generic || '').trim();
  return value || null;
}

function totalCount(cadence) {
  return positiveInt(cadence === 'monthly' ? 'PRI_RAZORPAY_MONTHLY_TOTAL_COUNT' : 'PRI_RAZORPAY_ANNUAL_TOTAL_COUNT');
}

function readConfig() {
  return Object.freeze({
    keyId: String(process.env.PRI_RAZORPAY_KEY_ID || '').trim(),
    keySecret: String(process.env.PRI_RAZORPAY_KEY_SECRET || '').trim(),
    webhookSecret: String(process.env.PRI_RAZORPAY_WEBHOOK_SECRET || '').trim(),
    monthlyPlanId: planId('monthly'),
    annualPlanId: planId('annual'),
    monthlyTotalCount: totalCount('monthly'),
    annualTotalCount: totalCount('annual'),
    trialDays: positiveInt('PRI_DISPLAY_TRIAL_DAYS', 0) || 0,
    graceDays: positiveInt('PRI_WEB_GRACE_DAYS', 0) || 0
  });
}

export function razorpayConfigStatus() {
  const cfg = readConfig();
  const productConfigured = !!(cfg.monthlyPlanId || cfg.annualPlanId);
  const credentialsConfigured = !!(cfg.keyId && cfg.keySecret && cfg.webhookSecret);
  const countsConfigured = (!cfg.monthlyPlanId || !!cfg.monthlyTotalCount) && (!cfg.annualPlanId || !!cfg.annualTotalCount);
  const planIdsValid = (!cfg.monthlyPlanId || RAZORPAY_PLAN.test(cfg.monthlyPlanId)) && (!cfg.annualPlanId || RAZORPAY_PLAN.test(cfg.annualPlanId));
  return Object.freeze({
    productConfigured,
    credentialsConfigured,
    countsConfigured,
    planIdsValid,
    configured: productConfigured && credentialsConfigured && countsConfigured && planIdsValid
  });
}

function requireConfigured(cfg) {
  const status = razorpayConfigStatus();
  if (!status.configured) {
    throw configError('Razorpay web subscriptions require valid plan ids, API credentials, a webhook secret and total billing-cycle counts.');
  }
  return cfg;
}

function digest(value) {
  return createHash('sha256').update(value).digest('hex');
}

function safeSignatureEqual(expectedHex, receivedHex) {
  if (!SIGNATURE.test(String(receivedHex || ''))) return false;
  const expected = Buffer.from(expectedHex, 'hex');
  const received = Buffer.from(String(receivedHex), 'hex');
  return expected.length === received.length && timingSafeEqual(expected, received);
}

function verifyWebhookSignature(rawBody, signature, secret) {
  const raw = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(rawBody || '');
  if (!raw.length) throw billingError('BILLING_WEBHOOK_BODY_REQUIRED', 'Webhook raw body is missing.');
  const expected = createHmac('sha256', secret).update(raw).digest('hex');
  if (!safeSignatureEqual(expected, signature)) throw billingError('BILLING_WEBHOOK_SIGNATURE_INVALID', 'Billing webhook signature is invalid.', 401);
  return raw;
}

function cadenceForPlan(cfg, value) {
  if (value === cfg.monthlyPlanId) return 'monthly';
  if (value === cfg.annualPlanId) return 'annual';
  return null;
}

function milliseconds(seconds) {
  const value = Number(seconds);
  return Number.isFinite(value) && value > 0 ? Math.floor(value * 1000) : null;
}

function normalizeSubscription(cfg, subscription, {
  accountId, eventId, eventType, payloadDigest, effectiveAt = Date.now(), restore = false
}) {
  if (!subscription || subscription.entity !== 'subscription' || !RAZORPAY_SUBSCRIPTION.test(String(subscription.id || ''))) {
    throw billingError('BILLING_SUBSCRIPTION_INVALID', 'Razorpay subscription payload is invalid.');
  }
  const cadence = cadenceForPlan(cfg, String(subscription.plan_id || ''));
  if (!cadence) throw billingError('BILLING_PRODUCT_UNKNOWN', 'Razorpay subscription uses an unrecognised Pri Learning plan.');
  if (!SAFE_ID.test(String(accountId || ''))) throw billingError('BILLING_ACCOUNT_INVALID', 'Billing account binding is invalid.');

  const now = Date.now();
  const currentEnd = milliseconds(subscription.current_end);
  const startAt = milliseconds(subscription.start_at);
  const status = String(subscription.status || '');
  let normalizedStatus = 'free';
  let plan = 'free';
  let periodEnd = null;
  let graceUntil = null;
  let eventRank = 10;

  if (status === 'active') {
    plan = 'premium';
    normalizedStatus = 'active';
    periodEnd = currentEnd;
    eventRank = 50;
  } else if (status === 'authenticated' && startAt && startAt > now) {
    plan = 'premium';
    normalizedStatus = 'trialing';
    periodEnd = startAt;
    eventRank = 40;
  } else if ((status === 'pending' || status === 'halted') && currentEnd && cfg.graceDays > 0) {
    plan = 'premium';
    normalizedStatus = 'grace';
    periodEnd = currentEnd;
    graceUntil = currentEnd + cfg.graceDays * 24 * 60 * 60 * 1000;
    eventRank = 65;
  } else if (status === 'pending' || status === 'halted') {
    plan = 'premium';
    normalizedStatus = 'past_due';
    periodEnd = currentEnd;
    eventRank = 60;
  } else if (status === 'paused') {
    plan = 'premium';
    normalizedStatus = 'paused';
    periodEnd = currentEnd;
    eventRank = 70;
  } else if (['cancelled', 'completed', 'expired'].includes(status)) {
    plan = 'premium';
    normalizedStatus = 'expired';
    periodEnd = currentEnd || milliseconds(subscription.ended_at);
    eventRank = 90;
  }

  return {
    verified: true,
    provider: 'web',
    eventId,
    accountId: String(accountId),
    eventType,
    providerSubscriptionId: String(subscription.id),
    productId: String(subscription.plan_id),
    billingCadence: cadence,
    plan,
    status: normalizedStatus,
    currentPeriodEnd: periodEnd,
    graceUntil,
    payloadDigest,
    effectiveAt: Number.isFinite(Number(effectiveAt)) ? Number(effectiveAt) : now,
    eventRank,
    restore: !!restore
  };
}

function accountBindingFromNotes(subscription) {
  const notes = subscription?.notes;
  if (!notes || typeof notes !== 'object' || Array.isArray(notes)) return null;
  const value = String(notes.pri_account_id || '');
  return SAFE_ID.test(value) ? value : null;
}

async function providerRequest(cfg, path, { method = 'GET', body, fetchImpl = globalThis.fetch } = {}) {
  if (typeof fetchImpl !== 'function') throw configError('No HTTP implementation is available for Razorpay verification.');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetchImpl(`${API_ORIGIN}${path}`, {
      method,
      headers: {
        Accept: 'application/json',
        Authorization: `Basic ${Buffer.from(`${cfg.keyId}:${cfg.keySecret}`).toString('base64')}`,
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' })
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
      redirect: 'error'
    });
    const text = await response.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; }
    catch { throw billingError('BILLING_PROVIDER_BAD_RESPONSE', 'Razorpay returned invalid JSON.', 502); }
    if (!response.ok) {
      const message = data?.error?.description || data?.error?.reason || 'Razorpay request failed.';
      const error = billingError('BILLING_PROVIDER_REQUEST_FAILED', message, response.status >= 500 ? 502 : 400);
      error.providerStatus = response.status;
      error.definitiveFailure = response.status >= 400 && response.status < 500 && ![408, 429].includes(response.status);
      throw error;
    }
    return data;
  } catch (error) {
    if (error?.code) throw error;
    throw billingError('BILLING_PROVIDER_UNAVAILABLE', 'Razorpay is temporarily unavailable.', 502);
  } finally {
    clearTimeout(timer);
  }
}

function storeBinding(db, { subscriptionId, accountId, planId, cadence, trialClaimed, now = Date.now() }) {
  db.prepare(`INSERT INTO billing_subscriptions
    (provider,provider_subscription_id,account_id,product_id,cadence,trial_claimed,created_at,updated_at,last_effective_at,last_event_rank,last_event_id)
    VALUES ('web',?,?,?,?,?,?,?,0,0,NULL)
    ON CONFLICT(provider,provider_subscription_id) DO UPDATE SET
      account_id=excluded.account_id,product_id=excluded.product_id,cadence=excluded.cadence,
      trial_claimed=MAX(billing_subscriptions.trial_claimed,excluded.trial_claimed),updated_at=excluded.updated_at`)
    .run(subscriptionId, accountId, planId, cadence, trialClaimed ? 1 : 0, now, now);
}

function boundSubscription(db, subscriptionId) {
  return db.prepare(`SELECT * FROM billing_subscriptions WHERE provider='web' AND provider_subscription_id=?`).get(subscriptionId);
}

function reserveTrial(db, accountId, reservationId, now) {
  const info = db.prepare(`INSERT OR IGNORE INTO billing_trial_claims(account_id,provider,provider_subscription_id,claimed_at)
    VALUES (?,'web',?,?)`).run(accountId, reservationId, now);
  return info.changes === 1;
}

function releaseTrialReservation(db, accountId, reservationId) {
  db.prepare(`DELETE FROM billing_trial_claims WHERE account_id=? AND provider='web' AND provider_subscription_id=?`).run(accountId, reservationId);
}

function attachTrialSubscription(db, accountId, reservationId, subscriptionId) {
  db.prepare(`UPDATE billing_trial_claims SET provider_subscription_id=?
    WHERE account_id=? AND provider='web' AND provider_subscription_id=?`).run(subscriptionId, accountId, reservationId);
}

export function createRazorpayBilling(db, { fetchImpl = globalThis.fetch } = {}) {
  const cfg = readConfig();

  async function createCheckout({ accountId, cadence }) {
    requireConfigured(cfg);
    if (!['monthly', 'annual'].includes(cadence)) throw billingError('BILLING_CADENCE_INVALID', 'Choose a monthly or annual subscription.');
    const account = db.prepare('SELECT id,email FROM accounts WHERE id=? AND deleted_at IS NULL').get(accountId);
    if (!account) throw billingError('BILLING_ACCOUNT_INVALID', 'Billing account does not exist.', 404);
    const selectedPlan = cadence === 'monthly' ? cfg.monthlyPlanId : cfg.annualPlanId;
    const cycles = cadence === 'monthly' ? cfg.monthlyTotalCount : cfg.annualTotalCount;
    if (!selectedPlan || !cycles) throw configError(`The ${cadence} Razorpay plan is not configured.`);

    const now = Date.now();
    const reservationId = `trial-reservation:${randomUUID()}`;
    const trialApplied = cfg.trialDays > 0 && reserveTrial(db, accountId, reservationId, now);
    const payload = {
      plan_id: selectedPlan,
      total_count: cycles,
      quantity: 1,
      customer_notify: true,
      notes: {
        pri_account_id: accountId,
        pri_cadence: cadence,
        pri_trial: trialApplied ? '1' : '0'
      },
      notify_info: { notify_email: account.email }
    };
    if (trialApplied) payload.start_at = Math.ceil((now + cfg.trialDays * 24 * 60 * 60 * 1000) / 1000);

    let subscription;
    try {
      subscription = await providerRequest(cfg, API_PATH, { method: 'POST', body: payload, fetchImpl });
    } catch (error) {
      // Release only when Razorpay definitively rejected the request. Timeouts,
      // throttling and 5xx responses are ambiguous: retaining the reservation
      // prevents a retry from accidentally manufacturing a second free trial.
      if (trialApplied && error?.definitiveFailure) releaseTrialReservation(db, accountId, reservationId);
      throw error;
    }

    if (!RAZORPAY_SUBSCRIPTION.test(String(subscription?.id || '')) || subscription?.plan_id !== selectedPlan) {
      throw billingError('BILLING_PROVIDER_BAD_RESPONSE', 'Razorpay returned an invalid subscription.', 502);
    }
    let checkoutUrl;
    try {
      checkoutUrl = new URL(String(subscription.short_url || ''));
      if (checkoutUrl.protocol !== 'https:' || checkoutUrl.hostname !== 'rzp.io') throw new Error('bad checkout url');
    } catch {
      throw billingError('BILLING_PROVIDER_BAD_RESPONSE', 'Razorpay did not return a valid hosted subscription URL.', 502);
    }

    db.transaction(() => {
      storeBinding(db, {
        subscriptionId: subscription.id, accountId, planId: selectedPlan, cadence,
        trialClaimed: trialApplied, now
      });
      if (trialApplied) attachTrialSubscription(db, accountId, reservationId, subscription.id);
    })();

    return {
      provider: 'web', checkoutProvider: 'razorpay', subscriptionId: subscription.id,
      checkoutUrl: checkoutUrl.toString(), cadence, trialApplied,
      trialDays: trialApplied ? cfg.trialDays : 0
    };
  }

  async function webhook({ request }) {
    requireConfigured(cfg);
    const eventId = String(request.get('x-razorpay-event-id') || '');
    if (!SAFE_ID.test(eventId)) throw billingError('BILLING_EVENT_ID_INVALID', 'Razorpay event id is missing or invalid.');
    const raw = verifyWebhookSignature(request.rawBody, request.get('x-razorpay-signature'), cfg.webhookSecret);
    let payload;
    try { payload = JSON.parse(raw.toString('utf8')); }
    catch { throw billingError('BILLING_WEBHOOK_BODY_INVALID', 'Razorpay webhook body is invalid JSON.'); }
    const subscription = payload?.payload?.subscription?.entity;
    const subscriptionId = String(subscription?.id || '');
    const binding = RAZORPAY_SUBSCRIPTION.test(subscriptionId) ? boundSubscription(db, subscriptionId) : null;
    if (!binding) throw billingError('BILLING_SUBSCRIPTION_UNKNOWN', 'Razorpay subscription is not bound to a Pri Learning account.', 409);
    const noteAccount = accountBindingFromNotes(subscription);
    if (noteAccount && noteAccount !== binding.account_id) throw billingError('BILLING_ACCOUNT_MISMATCH', 'Razorpay subscription account binding does not match.', 409);
    if (String(subscription.plan_id || '') !== binding.product_id) throw billingError('BILLING_PRODUCT_MISMATCH', 'Razorpay subscription plan does not match its Pri Learning binding.', 409);

    return normalizeSubscription(cfg, subscription, {
      accountId: binding.account_id,
      eventId,
      eventType: String(payload?.event || 'subscription.updated').slice(0, 160),
      payloadDigest: digest(raw),
      effectiveAt: milliseconds(payload?.created_at) || Date.now()
    });
  }

  async function restore({ accountId, body }) {
    requireConfigured(cfg);
    let subscriptionId = String(body?.subscriptionId || '');
    if (!subscriptionId) {
      subscriptionId = String(db.prepare(`SELECT provider_subscription_id FROM billing_subscriptions
        WHERE provider='web' AND account_id=? ORDER BY created_at DESC LIMIT 1`).get(accountId)?.provider_subscription_id || '');
    }
    if (!RAZORPAY_SUBSCRIPTION.test(subscriptionId)) throw billingError('BILLING_SUBSCRIPTION_REQUIRED', 'No Razorpay subscription is linked to this account.', 404);
    const subscription = await providerRequest(cfg, `${API_PATH}/${subscriptionId}`, { fetchImpl });
    const noteAccount = accountBindingFromNotes(subscription);
    const existing = boundSubscription(db, subscriptionId);
    if (existing && existing.account_id !== accountId) throw billingError('BILLING_ACCOUNT_MISMATCH', 'This subscription belongs to another Pri Learning account.', 409);
    if (!existing && noteAccount !== accountId) throw billingError('BILLING_ACCOUNT_MISMATCH', 'Razorpay subscription is not bound to this Pri Learning account.', 409);
    const cadence = cadenceForPlan(cfg, String(subscription.plan_id || ''));
    if (!cadence) throw billingError('BILLING_PRODUCT_UNKNOWN', 'Razorpay subscription uses an unrecognised Pri Learning plan.');
    if (!existing) storeBinding(db, {
      subscriptionId, accountId, planId: subscription.plan_id, cadence,
      trialClaimed: String(subscription?.notes?.pri_trial || '') === '1'
    });

    const stateDigest = digest(JSON.stringify({
      id: subscription.id, status: subscription.status, plan: subscription.plan_id,
      currentEnd: subscription.current_end, startAt: subscription.start_at, endedAt: subscription.ended_at
    }));
    return normalizeSubscription(cfg, subscription, {
      accountId,
      eventId: `restore:${subscription.id}:${stateDigest.slice(0, 24)}`,
      eventType: 'subscription.restore',
      payloadDigest: stateDigest,
      effectiveAt: Date.now(),
      restore: true
    });
  }

  return Object.freeze({
    configured: razorpayConfigStatus().configured,
    verifiers: Object.freeze({ web: Object.freeze({ webhook, restore }) }),
    checkout: Object.freeze({ web: Object.freeze({ create: createCheckout }) })
  });
}
