import './support/hermetic.mjs';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';

// Billing provider per edition (ADR-0002, plan E5).
//
// The same requests are sent to the real /v1 router twice: once built for
// Priyabhata and once for Prithagoras, with the same deployment variables, the
// real Razorpay adapter (its provider faked at the network) and adapters for
// Apple and Google that would grant Premium if they were ever reached.
//
//   Priyabhata   every route behaves as it does on main: /billing/config is
//                byte for byte main's reply, checkout reaches the provider, a
//                signed webhook activates Premium.
//   Prithagoras  nothing can be bought: /billing/config offers no price,
//                product or checkout, every purchase route answers 404
//                BILLING_NOT_AVAILABLE_IN_EDITION with or without a session,
//                a correctly signed Razorpay webhook is refused and changes
//                no row, no adapter runs and no provider call leaves the
//                process. What an account already holds is still honoured.
//
// Then start-up: a Prithagoras server refuses, in production, a variable of a
// provider it does not sell through and a display currency that is not its own.
//
//   node server/test/billing-edition-check.mjs                    SQLite
//   node server/test/billing-edition-check.mjs --engine=postgres  Postgres
//   node server/test/billing-edition-check.mjs --edition=priyabhata
//     only the Priyabhata half, which needs nothing this mission added: run
//     against main's server it is the regression proof for India.
const ONLY = (process.argv.find(arg => arg.startsWith('--edition=')) || '').slice('--edition='.length) || null;

const ENV = {
  NODE_ENV: 'test',
  PRI_AUTH_DELIVERY_KEY: '55'.repeat(32),
  PRI_DISPLAY_CURRENCY: 'INR', PRI_DISPLAY_MONTHLY_PRICE: '199', PRI_DISPLAY_ANNUAL_PRICE: '1499', PRI_DISPLAY_TRIAL_DAYS: '7',
  PRI_RAZORPAY_KEY_ID: 'rzp_test_public_id', PRI_RAZORPAY_KEY_SECRET: 'rzp-test-secret', PRI_RAZORPAY_WEBHOOK_SECRET: 'whsec-test',
  PRI_RAZORPAY_MONTHLY_PLAN_ID: 'plan_Monthly123456', PRI_RAZORPAY_ANNUAL_PLAN_ID: 'plan_Annual1234567',
  PRI_RAZORPAY_MONTHLY_TOTAL_COUNT: '120', PRI_RAZORPAY_ANNUAL_TOTAL_COUNT: '10',
  PRI_APPLE_MONTHLY_PRODUCT_ID: 'com.prilearning.app.premium.monthly', PRI_APPLE_ANNUAL_PRODUCT_ID: 'com.prilearning.app.premium.annual',
  PRI_GOOGLE_MONTHLY_PRODUCT_ID: 'pri_premium:monthly', PRI_GOOGLE_ANNUAL_PRODUCT_ID: 'pri_premium:annual'
};
const UNSET = ['PRI_EDITION', 'PRI_PUBLIC_ORIGIN', 'PRI_WEB_MONTHLY_PRICE_ID', 'PRI_WEB_ANNUAL_PRICE_ID', 'PRI_WEB_GRACE_DAYS'];
const previous = Object.fromEntries([...Object.keys(ENV), ...UNSET].map(name => [name, process.env[name]]));
Object.assign(process.env, ENV);
for (const name of UNSET) delete process.env[name];

// GET /v1/billing/config as origin/main (7452deada) answers it for the
// variables above, captured from main's commercialConfig() before this change.
const MAIN_CONFIG = '{"display":{"currency":"INR","monthly":199,"annual":1499,"trialDays":7,"advisoryOnly":true},"products":{"appleMonthly":"com.prilearning.app.premium.monthly","appleAnnual":"com.prilearning.app.premium.annual","googleMonthly":"pri_premium:monthly","googleAnnual":"pri_premium:annual","webMonthly":"plan_Monthly123456","webAnnual":"plan_Annual1234567"},"webCheckout":{"provider":"razorpay","configured":true},"platformRule":"Native iOS/Android purchases must use the platform billing mechanism required for that storefront. The server consumes verified provider events and never trusts client premium flags."}';
// …and with no commercial variable set at all.
const MAIN_CONFIG_BARE = '{"display":{"currency":"INR","monthly":null,"annual":null,"trialDays":null,"advisoryOnly":true},"products":{"appleMonthly":null,"appleAnnual":null,"googleMonthly":null,"googleAnnual":null,"webMonthly":null,"webAnnual":null},"webCheckout":{"provider":"razorpay","configured":false},"platformRule":"Native iOS/Android purchases must use the platform billing mechanism required for that storefront. The server consumes verified provider events and never trusts client premium flags."}';
const PRITHAGORAS_CONFIG = '{"available":false,"display":{"currency":"AUD","monthly":null,"annual":null,"trialDays":null,"advisoryOnly":true},"products":{"appleMonthly":null,"appleAnnual":null,"googleMonthly":null,"googleAnnual":null,"webMonthly":null,"webAnnual":null},"webCheckout":{"provider":null,"configured":false},"platformRule":"Premium is not on sale in this edition yet. The server consumes verified provider events and never trusts client premium flags."}';
const REFUSED = 'BILLING_NOT_AVAILABLE_IN_EDITION';

const [
  { default: express },
  { default: cookieParser },
  { openTestStore },
  { createRazorpayBilling },
  { createPlatformRouter },
  { commercialConfig },
  { metrics }
] = await Promise.all([
  import('express'),
  import('cookie-parser'),
  import('./support/engine.mjs'),
  import('../platform/razorpay.js'),
  import('../platform/router.js'),
  import('../platform/billing.js'),
  import('../platform/metrics.js')
]);

let checks = 0;
function check(condition, message) { checks++; assert.ok(condition, message); }
function same(actual, expected, message) { checks++; assert.deepEqual(actual, expected, message); }
const now = Date.now();
const sec = ms => Math.floor(ms / 1000);
const periodEnd = sec(now + 30 * 24 * 60 * 60 * 1000);
const SUBSCRIPTION = 'sub_Edition1234567';

const TABLES = [
  'entitlement_snapshots', 'entitlement_support_grants', 'billing_events', 'billing_subscriptions', 'billing_payments',
  'billing_refunds', 'billing_trial_claims', 'billing_apple_accounts', 'billing_apple_signed_events',
  'billing_google_accounts', 'billing_google_purchases', 'billing_google_notifications', 'audit_log', 'rate_limits'
];

/** One server of one edition: its own database, router, adapters and counters. */
async function serve(edition) {
  if (edition === 'priyabhata') delete process.env.PRI_EDITION; else process.env.PRI_EDITION = edition;
  const testStore = await openTestStore(undefined, { label: `edition-${edition}` });
  const db = testStore.store;
  const calls = { provider: 0, adapters: 0 };
  const providerSubscription = accountId => ({
    id: SUBSCRIPTION, entity: 'subscription', plan_id: ENV.PRI_RAZORPAY_MONTHLY_PLAN_ID, status: 'active',
    current_start: sec(now), current_end: periodEnd, ended_at: null, start_at: sec(now), total_count: 120,
    notes: { pri_account_id: accountId, pri_cadence: 'monthly', pri_trial: '0' },
    short_url: 'https://rzp.io/i/edition', created_at: sec(now)
  });
  let checkoutAccount = null;
  const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });
  async function fakeFetch(url, options = {}) {
    calls.provider++;
    const parsed = new URL(url);
    assert.equal(parsed.origin, 'https://api.razorpay.com');
    const method = String(options.method || 'GET').toUpperCase();
    if (method === 'POST' && parsed.pathname === '/v1/subscriptions') {
      checkoutAccount = JSON.parse(options.body || '{}').notes?.pri_account_id || null;
      return json({ ...providerSubscription(checkoutAccount), status: 'created', current_start: null, current_end: null });
    }
    if (method === 'GET' && parsed.pathname.startsWith('/v1/subscriptions/')) return json(providerSubscription(checkoutAccount));
    if (method === 'POST' && /\/cancel$/.test(parsed.pathname)) return json(providerSubscription(checkoutAccount));
    return json({ error: { description: 'unexpected test request' } }, 404);
  }
  const web = createRazorpayBilling(db, { fetchImpl: fakeFetch });
  // Apple and Google adapters that would hand over Premium to whoever asks.
  // On an edition that does not sell through them they must never run.
  const grant = provider => async ({ accountId }) => {
    calls.adapters++;
    return {
      verified: true, provider, eventId: `evt-${provider}-${calls.adapters}`, accountId, eventType: 'subscription.activated',
      productId: `${provider}-product`, plan: 'premium', status: 'active', currentPeriodEnd: now + 86_400_000,
      effectiveAt: Date.now(), eventRank: 50, payloadDigest: 'test-only'
    };
  };
  const count = fn => async (...args) => { calls.adapters++; return fn(...args); };
  const spied = adapters => Object.fromEntries(Object.entries(adapters || {}).map(([name, fn]) => [name, typeof fn === 'function' ? count(fn) : fn]));
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '1mb', verify(req, res, buffer) { req.rawBody = Buffer.from(buffer); } }));
  app.use(cookieParser());
  app.use('/v1', createPlatformRouter(db, {
    billingVerifiers: {
      web: spied(web.verifiers.web),
      apple: { restore: grant('apple'), webhook: async () => { calls.adapters++; return []; } },
      google: { restore: grant('google'), webhook: async () => { calls.adapters++; return []; } }
    },
    billingCheckout: { web: spied(web.checkout.web) },
    billingLifecycle: { web: spied(web.lifecycle.web) },
    billingNative: {
      apple: { bootstrap: async () => { calls.adapters++; return { appAccountToken: 'token', products: { monthly: ENV.PRI_APPLE_MONTHLY_PRODUCT_ID } }; }, transaction: grant('apple') },
      google: { bootstrap: async () => { calls.adapters++; return { obfuscatedAccountId: 'opaque', products: {} }; }, purchase: async () => { calls.adapters++; return { pending: true }; } }
    }
  }));
  const server = await new Promise(resolve => { const listener = app.listen(0, '127.0.0.1', () => resolve(listener)); });
  const origin = `http://127.0.0.1:${server.address().port}`;

  async function call(path, { method = 'GET', body, raw, jar = null, headers = {} } = {}) {
    const requestHeaders = { Accept: 'application/json', ...headers };
    if (jar) {
      const cookies = Object.entries(jar).map(([name, value]) => `${name}=${value}`).join('; ');
      if (cookies) requestHeaders.Cookie = cookies;
      if (jar.pri_csrf && !['GET', 'HEAD'].includes(method)) requestHeaders['x-pri-csrf'] = jar.pri_csrf;
    }
    let payload;
    if (raw !== undefined) { payload = raw; requestHeaders['Content-Type'] = 'application/json'; }
    else if (body !== undefined) { payload = JSON.stringify(body); requestHeaders['Content-Type'] = 'application/json'; }
    const response = await fetch(`${origin}/v1${path}`, { method, headers: requestHeaders, body: payload, redirect: 'error' });
    if (jar) {
      for (const cookie of response.headers.getSetCookie()) {
        const first = cookie.split(';', 1)[0];
        const index = first.indexOf('=');
        if (index > 0) jar[first.slice(0, index)] = first.slice(index + 1);
      }
    }
    const text = await response.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = null; }
    return { status: response.status, data, text, code: data?.error?.code || null };
  }
  const jar = {};
  const registered = await call('/account/register', { method: 'POST', jar, body: { name: 'Edition Student', email: `student@${edition}.example.test`, password: 'edition-pass-123', deviceId: `device-${edition}`, isAdult: true } });
  assert.equal(registered.status, 201, registered.text);
  const accountId = registered.data.account.id;
  await db.run('UPDATE accounts SET email_verified_at=? WHERE id=?', [Date.now(), accountId]);

  // Row counts as the database owner: on Postgres the server role's own
  // unscoped reads are confined by Row-Level Security and would count nothing.
  async function rows() {
    const out = {};
    for (const table of TABLES) {
      out[table] = testStore.scratch
        ? Number((await testStore.scratch.client.query(`SELECT COUNT(*) AS n FROM ${table}`)).rows[0].n)
        : Number(testStore.raw.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get().n);
    }
    return out;
  }
  async function owner(sql) {
    if (testStore.scratch) await testStore.scratch.client.query(sql); else testStore.raw.exec(sql);
  }
  function signedWebhook(eventId) {
    const raw = JSON.stringify({
      entity: 'event', event: 'subscription.activated', contains: ['subscription'],
      payload: { subscription: { entity: providerSubscription(accountId) } }, created_at: sec(now)
    });
    const signature = createHmac('sha256', ENV.PRI_RAZORPAY_WEBHOOK_SECRET).update(Buffer.from(raw)).digest('hex');
    return { raw, headers: { 'x-razorpay-event-id': eventId, 'x-razorpay-signature': signature } };
  }
  async function close() {
    await new Promise(resolve => { server.closeAllConnections?.(); server.close(resolve); });
    await testStore.close();
  }
  return { edition, engine: testStore.engine, db, call, jar, accountId, calls, rows, owner, signedWebhook, close };
}

// Every way to start, complete, restore or cancel a purchase.
const PURCHASE_ROUTES = [
  ['POST', '/billing/checkout/web', { cadence: 'monthly' }],
  ['POST', '/billing/web/cancel', {}],
  ['GET', '/billing/apple/bootstrap'],
  ['POST', '/billing/apple/transaction', { signedTransaction: 'a.b.c' }],
  ['GET', '/billing/google/bootstrap'],
  ['POST', '/billing/google/purchase', { purchaseToken: 'token-0123456789' }],
  ['POST', '/billing/restore/web', {}],
  ['POST', '/billing/restore/apple', {}],
  ['POST', '/billing/restore/google', {}]
];
const webhookMetric = (provider, outcome) => metrics.snapshot().counters[`webhook_total{outcome=${outcome},provider=${provider}}`]?.total || 0;

let engine = 'sqlite';
const open = [];
try {
  // ── Priyabhata: exactly main ─────────────────────────────────────────────
  if (ONLY !== 'prithagoras') {
    const india = await serve('priyabhata');
    open.push(india);
    engine = india.engine;
    const { call, jar } = india;

    const config = await call('/billing/config');
    check(config.status === 200 && config.text === MAIN_CONFIG, `Priyabhata: /billing/config is byte for byte main's reply (${config.text})`);
    const nativeConfig = await call('/billing/config', { headers: { 'x-pri-client': 'ios-native-v1' } });
    const mainNative = JSON.parse(MAIN_CONFIG);
    mainNative.webCheckout = { ...mainNative.webCheckout, configured: false, refusedForNativeClient: true };
    check(nativeConfig.text === JSON.stringify(mainNative), `Priyabhata: a native shell is told web checkout is refused, as on main (${nativeConfig.text})`);
    {
      const saved = {};
      for (const name of Object.keys(ENV)) if (/^PRI_(DISPLAY|RAZORPAY|APPLE|GOOGLE)_/.test(name)) { saved[name] = process.env[name]; delete process.env[name]; }
      check(JSON.stringify(commercialConfig('priyabhata')) === MAIN_CONFIG_BARE && JSON.stringify(commercialConfig()) === MAIN_CONFIG_BARE, 'Priyabhata: with no commercial variable set the reply is main\'s too');
      Object.assign(process.env, saved);
    }

    for (const [method, path, body] of PURCHASE_ROUTES) {
      const anonymous = await call(path, { method, body });
      check(anonymous.status === 401 && anonymous.code !== REFUSED, `Priyabhata: ${method} ${path} without a session asks for one, as on main (${anonymous.status} ${anonymous.code})`);
    }
    const before = india.calls.provider;
    const checkout = await call('/billing/checkout/web', { method: 'POST', jar, body: { cadence: 'monthly' } });
    check(checkout.status === 201 && checkout.data.checkout.checkoutUrl === 'https://rzp.io/i/edition' && india.calls.provider === before + 1, `Priyabhata: web checkout is created at the provider (${checkout.status} ${checkout.text})`);
    const nativeCheckout = await call('/billing/checkout/web', { method: 'POST', jar, body: { cadence: 'monthly' }, headers: { 'x-pri-client': 'ios-native-v1' } });
    check(nativeCheckout.status === 403 && nativeCheckout.code === 'BILLING_WEB_CHECKOUT_NATIVE_REFUSED', 'Priyabhata: web checkout from a native shell is refused as before');
    const hook = india.signedWebhook('evt-india-activated');
    const activated = await call('/billing/webhook/web', { method: 'POST', raw: hook.raw, headers: hook.headers });
    check(activated.status === 200 && activated.data.applied === 1, `Priyabhata: a signed Razorpay webhook is applied (${activated.status} ${activated.text})`);
    const status = await call('/billing/status', { jar });
    check(status.data.billing.plan === 'premium' && status.data.billing.status === 'active' && status.data.billing.provider === 'web', 'Priyabhata: Premium is active from the verified event');
    const forged = await call('/billing/webhook/web', { method: 'POST', raw: hook.raw, headers: { ...hook.headers, 'x-razorpay-signature': 'ab'.repeat(32) } });
    check(forged.status >= 400 && forged.status < 500 && forged.code !== REFUSED, `Priyabhata: a forged signature is still refused by the verifier (${forged.status} ${forged.code})`);
    const manage = await call('/billing/manage', { jar });
    same(Object.keys(manage.data), ['web', 'apple'], 'Priyabhata: /billing/manage has main\'s shape');
    check(manage.data.web.provider === 'razorpay' && manage.data.web.cancellable === true && manage.data.apple.manageUrl === 'https://apps.apple.com/account/subscriptions', 'Priyabhata: the web subscription is Razorpay\'s and cancellable');
    const appleBootstrap = await call('/billing/apple/bootstrap', { jar });
    check(appleBootstrap.status === 200 && appleBootstrap.data.apple.appAccountToken === 'token', 'Priyabhata: the App Store bootstrap answers');
    const appleTransaction = await call('/billing/apple/transaction', { method: 'POST', jar, body: { signedTransaction: 'a.b.c' } });
    check(appleTransaction.status === 200 && appleTransaction.data.accepted === true, `Priyabhata: a verified App Store transaction is accepted (${appleTransaction.status})`);
    const googleBootstrap = await call('/billing/google/bootstrap', { jar });
    check(googleBootstrap.status === 200 && googleBootstrap.data.google.obfuscatedAccountId === 'opaque', 'Priyabhata: the Google Play bootstrap answers');
    const googlePurchase = await call('/billing/google/purchase', { method: 'POST', jar, body: { purchaseToken: 'token-0123456789' } });
    check(googlePurchase.status === 202 && googlePurchase.data.pending === true, 'Priyabhata: a pending Google purchase is reported as pending');
    for (const provider of ['apple', 'google']) {
      const restored = await call(`/billing/restore/${provider}`, { method: 'POST', jar, body: {} });
      check(restored.status === 200 && restored.code !== REFUSED, `Priyabhata: restore/${provider} reaches its verifier (${restored.status} ${restored.text})`);
    }
    const restoredWeb = await call('/billing/restore/web', { method: 'POST', jar, body: {} });
    check(restoredWeb.status === 200 && restoredWeb.code !== REFUSED, `Priyabhata: restore/web asks the provider (${restoredWeb.status} ${restoredWeb.text})`);
    const cancel = await call('/billing/web/cancel', { method: 'POST', jar, body: {} });
    check(cancel.status === 200 && cancel.data.status === 'cancelling', `Priyabhata: the web subscription cancels at cycle end (${cancel.status} ${cancel.text})`);
    const unknown = await call('/billing/restore/stripe', { method: 'POST', jar, body: {} });
    check(unknown.status === 404 && unknown.code === 'BILLING_PROVIDER_UNSUPPORTED', 'Priyabhata: an unknown provider is unsupported, as on main');
    check(india.calls.adapters > 0 && india.calls.provider > 1, 'Priyabhata: the adapters and the provider were really reached');
    await india.close();
    open.pop();
  }

  // ── Prithagoras: nothing to buy, nothing applied ─────────────────────────
  if (ONLY !== 'priyabhata') {
    const { BILLING_NOT_AVAILABLE, ROUTE_FAMILY_PROVIDER, editionBilling, editionBillingProblems, providerAllowed } = await import('../platform/billingProviders.js');
    const { EDITIONS, BILLING_PROVIDERS, editionProblems } = await import('../../client/edition.config.mjs');
    const { platformConfigStatus, assertPlatformConfig } = await import('../platform/config.js');
    check(BILLING_NOT_AVAILABLE === REFUSED, 'the refusal code is BILLING_NOT_AVAILABLE_IN_EDITION');

    // The table.
    same([...editionBilling('priyabhata').providers], ['razorpay', 'apple', 'google'], 'Priyabhata sells through Razorpay, Apple and Google');
    same({ ...editionBilling('priyabhata'), providers: null }, { edition: 'priyabhata', providers: null, currency: 'INR', available: true }, 'Priyabhata: INR, available');
    same({ ...editionBilling('prithagoras'), providers: [...editionBilling('prithagoras').providers] }, { edition: 'prithagoras', providers: [], currency: 'AUD', available: false }, 'Prithagoras: no provider, AUD, not available');
    same(ROUTE_FAMILY_PROVIDER, { web: 'razorpay', apple: 'apple', google: 'google' }, 'the web route family is Razorpay\'s');
    for (const name of ['web', 'razorpay', 'apple', 'google']) {
      check(providerAllowed('priyabhata', name) === true && providerAllowed('prithagoras', name) === false, `${name}: sold by Priyabhata, not by Prithagoras`);
    }
    check(providerAllowed('priyabhata', 'stripe') === false, 'a provider no edition lists is not allowed');
    assert.throws(() => editionBilling('typo'), /Unknown edition/); checks++;
    same(editionProblems(), [], 'the edition table has no problems');
    const broken = (id, billing) => editionProblems({ ...EDITIONS, [id]: { ...EDITIONS[id], billing } });
    check(broken('prithagoras', { providers: ['stripe'], currency: 'AUD' }).some(p => /billing provider "stripe"/.test(p)), 'an unknown provider id is a problem');
    check(broken('prithagoras', { providers: ['apple', 'apple'], currency: 'AUD' }).some(p => /twice/.test(p)), 'a provider listed twice is a problem');
    check(broken('prithagoras', { providers: [], currency: 'INR' }).some(p => /billing\.currency/.test(p)), 'a billing currency that is not the edition\'s is a problem');
    check(broken('priyabhata', undefined).some(p => /billing\.providers must be a list/.test(p)), 'an edition with no billing block is a problem');
    same([...BILLING_PROVIDERS], ['razorpay', 'apple', 'google'], 'the platform has three provider adapters');

    const au = await serve('prithagoras');
    open.push(au);
    engine = au.engine;
    const { call, jar } = au;

    const config = await call('/billing/config');
    check(config.status === 200 && config.text === PRITHAGORAS_CONFIG, `Prithagoras: /billing/config says nothing is on sale (${config.text})`);
    check(config.data.available === false && config.data.display.currency === 'AUD', 'Prithagoras: available is false and the currency is AUD');
    check(Object.values(config.data.products).every(v => v === null) && config.data.display.monthly === null && config.data.display.annual === null && config.data.display.trialDays === null,
      'Prithagoras: no product id, price or trial, although the deployment variables hold all of them');
    check(!/INR|₹|razorpay|plan_|com\.prilearning|pri_premium|199|1499/i.test(config.text), 'Prithagoras: no Indian currency, provider, plan or product appears in the reply');
    const nativeConfig = await call('/billing/config', { headers: { 'x-pri-client': 'ios-native-v1' } });
    check(nativeConfig.text === PRITHAGORAS_CONFIG, 'Prithagoras: a native shell is told the same');
    check(JSON.stringify(commercialConfig('prithagoras')) === PRITHAGORAS_CONFIG, 'commercialConfig(prithagoras) is that reply');

    const baseline = await au.rows();
    const metricBefore = { web: webhookMetric('web', 'rejected'), apple: webhookMetric('apple', 'rejected'), google: webhookMetric('google', 'rejected') };
    for (const [method, path, body] of PURCHASE_ROUTES) {
      const anonymous = await call(path, { method, body });
      check(anonymous.status === 404 && anonymous.code === REFUSED, `Prithagoras: ${method} ${path} without a session is 404 ${REFUSED} (${anonymous.status} ${anonymous.code})`);
      const signedIn = await call(path, { method, jar, body });
      check(signedIn.status === 404 && signedIn.code === REFUSED, `Prithagoras: ${method} ${path} signed in and verified is 404 ${REFUSED} (${signedIn.status} ${signedIn.code})`);
      const native = await call(path, { method, jar, body, headers: { 'x-pri-client': 'ios-native-v1' } });
      check(native.status === 404 && native.code === REFUSED, `Prithagoras: ${method} ${path} from a native shell is 404 ${REFUSED} (${native.status} ${native.code})`);
    }
    // A correctly signed Razorpay event for this very account.
    const hook = au.signedWebhook('evt-au-activated');
    const refused = await call('/billing/webhook/web', { method: 'POST', raw: hook.raw, headers: hook.headers });
    check(refused.status === 404 && refused.code === REFUSED, `Prithagoras: a correctly signed Razorpay webhook is refused (${refused.status} ${refused.code})`);
    for (const provider of ['apple', 'google']) {
      const other = await call(`/billing/webhook/${provider}`, { method: 'POST', body: { signedPayload: 'x' }, headers: { authorization: 'Bearer aaa.bbb.ccc' } });
      check(other.status === 404 && other.code === REFUSED, `Prithagoras: a ${provider} payment event is refused (${other.status} ${other.code})`);
    }
    same([webhookMetric('web', 'rejected') - metricBefore.web, webhookMetric('apple', 'rejected') - metricBefore.apple, webhookMetric('google', 'rejected') - metricBefore.google], [1, 1, 1],
      'Prithagoras: each refused event is counted as rejected');
    same(['web', 'apple', 'google'].map(provider => webhookMetric(provider, 'failed')), [0, 0, 0], 'Prithagoras: and never as failed, so it cannot page an operator');
    check(metrics.snapshot().counters[`webhook_failures_total{code=${REFUSED},provider=web}`]?.total === 1, 'Prithagoras: the rejection carries the edition code');
    same(await au.rows(), baseline, 'Prithagoras: none of it wrote a row: no entitlement, event, subscription, payment, audit or rate-limit row');
    same(au.calls, { provider: 0, adapters: 0 }, 'Prithagoras: no adapter ran and no provider call left the process');
    const status = await call('/billing/status', { jar });
    check(status.status === 200 && status.data.billing.plan === 'free', 'Prithagoras: the account is still on the free plan');
    const unknown = await call('/billing/restore/stripe', { method: 'POST', jar, body: {} });
    check(unknown.status === 404 && unknown.code === 'BILLING_PROVIDER_UNSUPPORTED', 'Prithagoras: an unknown provider is unsupported, as everywhere');

    // What an account already holds is not a purchase.
    const manage = await call('/billing/manage', { jar });
    same(manage.data, { web: { provider: null, cancellable: false, cancelling: false, status: 'none', currentPeriodEnd: null, cancelRequestedAt: null } }, 'Prithagoras: /billing/manage answers, names no provider and offers nothing to cancel');
    await au.owner(`UPDATE entitlement_snapshots SET plan='premium', status='active', provider='support', current_period_end=${now + 86_400_000}, source_version=source_version+1 WHERE account_id='${au.accountId}'`);
    const granted = await call('/billing/status', { jar });
    check(granted.status === 200 && granted.data.billing.plan === 'premium' && granted.data.billing.provider === 'support', 'Prithagoras: an entitlement the account already holds is still reported');
    const entitlement = await call('/entitlements', { jar });
    check(entitlement.status === 200 && entitlement.data.entitlement.plan === 'premium', 'Prithagoras: and still honoured by the entitlement route');
    const stillRefused = await call('/billing/checkout/web', { method: 'POST', jar, body: { cadence: 'monthly' } });
    check(stillRefused.status === 404 && stillRefused.code === REFUSED, 'Prithagoras: and buying is still unavailable');
    await au.close();
    open.pop();

    // ── Start-up ───────────────────────────────────────────────────────────
    const NAMES = ['NODE_ENV', 'PRI_EDITION', ...Object.keys(ENV).filter(name => /^PRI_(DISPLAY|RAZORPAY|APPLE|GOOGLE)_/.test(name))];
    const saved = Object.fromEntries(NAMES.map(name => [name, process.env[name]]));
    const withEnv = (env, fn) => {
      for (const name of NAMES) delete process.env[name];
      Object.assign(process.env, env);
      try { return fn(); } finally {
        for (const name of Object.keys(env)) delete process.env[name];
        for (const name of NAMES) { if (saved[name] === undefined) delete process.env[name]; else process.env[name] = saved[name]; }
      }
    };
    const editionMissing = env => withEnv(env, () => platformConfigStatus().missing.filter(line => /edition/.test(line)));
    const AU = { NODE_ENV: 'production', PRI_EDITION: 'prithagoras' };
    const IN = { NODE_ENV: 'production' };
    same(editionMissing(AU), [], 'a Prithagoras production server with no payment variable has no billing problem');
    same(editionMissing({ ...AU, PRI_RAZORPAY_KEY_ID: 'rzp_live_x' }), ['PRI_RAZORPAY_KEY_ID must be unset (the prithagoras edition does not sell through razorpay)'],
      'a Razorpay key on a Prithagoras production server is named');
    const everyRazorpay = Object.fromEntries(Object.entries(ENV).filter(([name]) => name.startsWith('PRI_RAZORPAY_')));
    same(editionMissing({ ...AU, ...everyRazorpay }).map(line => line.split(' ')[0]).sort(), Object.keys(everyRazorpay).sort(), 'every Razorpay variable is named, not just the first');
    check(editionMissing({ ...AU, PRI_WEB_MONTHLY_PRICE_ID: 'price_1' }).length === 1, 'the older web price variable counts as Razorpay\'s');
    check(editionMissing({ ...AU, PRI_APPLE_MONTHLY_PRODUCT_ID: 'x' }).length === 1 && editionMissing({ ...AU, PRI_GOOGLE_ANNUAL_PRODUCT_ID: 'x' }).length === 1, 'so do App Store and Google Play product variables');
    check(!withEnv({ ...AU, PRI_GOOGLE_ANNUAL_PRODUCT_ID: 'x', PRI_APPLE_ANNUAL_PRODUCT_ID: 'y', PRI_RAZORPAY_MONTHLY_PLAN_ID: 'z' }, () => platformConfigStatus().missing)
      .some(line => /SERVICE_ACCOUNT|RTDN|ROOT_CA|PRI_APPLE_APP_ID|TOTAL_COUNT must|^PRI_RAZORPAY_KEY_ID$/.test(line)), 'and the operator is not also asked to complete a provider this edition cannot use');
    withEnv({ ...AU, PRI_RAZORPAY_KEY_SECRET: 'secret-value-never-printed' }, () => {
      assert.throws(() => assertPlatformConfig(), error => /PRI_RAZORPAY_KEY_SECRET must be unset/.test(error.message) && !/secret-value-never-printed/.test(error.message));
      checks++;
      check(platformConfigStatus().ok === false, 'the configuration is not ok, so the server does not start');
    });
    same(editionMissing({ ...AU, PRI_DISPLAY_CURRENCY: 'INR' }), ['PRI_DISPLAY_CURRENCY must be AUD or unset for the prithagoras edition'], 'PRI_DISPLAY_CURRENCY=INR on Prithagoras refuses');
    same(editionMissing({ ...AU, PRI_DISPLAY_CURRENCY: ' aud ' }), [], 'PRI_DISPLAY_CURRENCY=AUD on Prithagoras is fine');
    same(editionMissing({ ...IN, ...ENV, NODE_ENV: 'production' }), [], 'Priyabhata production with Razorpay, Apple, Google and INR has no edition problem');
    same(editionMissing({ ...IN, PRI_DISPLAY_CURRENCY: 'AUD' }), ['PRI_DISPLAY_CURRENCY must be INR or unset for the priyabhata edition'], 'PRI_DISPLAY_CURRENCY=AUD on Priyabhata refuses');
    same(editionMissing({ NODE_ENV: 'test', PRI_EDITION: 'prithagoras', ...everyRazorpay, PRI_DISPLAY_CURRENCY: 'INR' }), [], 'outside production nothing stops the boot (the routes still refuse, above)');
    same(editionBillingProblems('prithagoras', { PRI_APPLE_CLIENT_IDS: 'x', PRI_GOOGLE_CLIENT_IDS: 'y' }), [], 'sign-in identifiers are not payment variables');
    withEnv({ NODE_ENV: 'test', PRI_EDITION: 'prithagoras', ...ENV }, () => {
      const status = platformConfigStatus();
      same([status.edition, [...status.billingProviders]], ['prithagoras', []], 'the configuration status reports the edition and its providers');
      same([status.webBillingProviderConfigured, status.appleBillingProviderConfigured, status.googleBillingProviderConfigured, status.googleBillingNotificationsConfigured], [false, false, false, false],
        'no provider is reported as configured on Prithagoras, whatever is set');
    });
    withEnv({ NODE_ENV: 'test', ...ENV }, () => {
      const status = platformConfigStatus();
      same([status.edition, [...status.billingProviders], status.webBillingProviderConfigured], ['priyabhata', ['razorpay', 'apple', 'google'], true], 'Priyabhata reports its three providers and Razorpay configured');
    });
    withEnv({ NODE_ENV: 'test', PRI_EDITION: 'typo' }, () => { assert.throws(() => platformConfigStatus(), /is not an edition/); checks++; });
  }

  console.log(`engine: ${engine}`);
  const scope = ONLY ? ` (${ONLY} half only)` : '';
  console.log(`BILLING PER EDITION: PASS — ${checks}/${checks} checks${scope} — Priyabhata answers /billing/config byte for byte as main and still buys, restores and cancels through Razorpay, Apple and Google; Prithagoras offers no price, product or checkout, refuses every purchase route and every payment event with 404 ${REFUSED} without running an adapter or writing a row, and its production server refuses another edition's payment variables and currency.`);
} finally {
  for (const server of open) await server.close().catch(() => {});
  for (const [name, value] of Object.entries(previous)) {
    if (value === undefined) delete process.env[name]; else process.env[name] = value;
  }
}
