import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// This contract runs under production rules on purpose: the Origin/CSRF policy
// that must NOT block a provider webhook is only enforced in production. The
// production platform refuses to open without an absolute persistent database
// path, so point the module-level platform DB at a throwaway file before any
// platform module is imported. The contract itself uses an in-memory database.
const prior = {
  NODE_ENV: process.env.NODE_ENV,
  PRI_PUBLIC_ORIGIN: process.env.PRI_PUBLIC_ORIGIN,
  PRI_CSRF_SECRET: process.env.PRI_CSRF_SECRET,
  PRI_AUTH_DELIVERY_KEY: process.env.PRI_AUTH_DELIVERY_KEY,
  PRI_PLATFORM_DB: process.env.PRI_PLATFORM_DB,
  PRI_TRUSTED_PROXY_HOPS: process.env.PRI_TRUSTED_PROXY_HOPS
};
const scratch = mkdtempSync(join(tmpdir(), 'pri-webhook-router-'));
process.env.NODE_ENV = 'production';
process.env.PRI_PUBLIC_ORIGIN = 'https://app.pri.example';
process.env.PRI_CSRF_SECRET = 'test-csrf-secret-not-production-32chars';
process.env.PRI_AUTH_DELIVERY_KEY = '22'.repeat(32);
process.env.PRI_PLATFORM_DB = join(scratch, 'platform.db');
// Requests are made straight to the router here; nothing forwards for it.
process.env.PRI_TRUSTED_PROXY_HOPS = '0';

const [
  { default: express },
  { default: cookieParser },
  { createPlatformDb },
  { ensureBillingSchema },
  { createPlatformRouter },
  { createResendAuthEmailTransport },
  { asStore, assertNoOpenTransaction },
  { createGoogleBilling }
] = await Promise.all([
  import('express'),
  import('cookie-parser'),
  import('../platform/db.js'),
  import('../platform/billingSchema.js'),
  import('../platform/router.js'),
  import('../platform/authDelivery.js'),
  import('../platform/store.js'),
  import('../platform/googleBilling.js')
]);

let checks = 0;
function check(condition, message) {
  checks++;
  assert.ok(condition, message);
}

const db = createPlatformDb(':memory:');
ensureBillingSchema(db);
const now = Date.now();
db.prepare(`INSERT INTO accounts(id,email,name,password_hash,role,created_at,updated_at)
  VALUES ('acct-hook','hook@example.test','Hook Student','hash','student',?,?)`).run(now, now);
db.prepare(`INSERT INTO entitlement_snapshots(account_id,plan,status,provider,source_version,updated_at)
  VALUES ('acct-hook','free','free','none',0,?)`).run(now);

let verifierCalls = 0;
// A verifier that breaks the contract: it writes, then makes an outbound call.
let outboundSent = 0;
const sendMail = createResendAuthEmailTransport({
  apiKey: 'test-key-never-sent', from: 'auth@pri.example',
  fetchImpl: async () => { outboundSent++; return new Response('{}', { status: 200 }); }
});
const billingVerifiers = {
  apple: {
    async webhook() {
      await asStore(db).run(`INSERT INTO audit_log(actor_account_id,action,target_kind,target_id,metadata_json,created_at)
        VALUES (NULL,'test.verifier-side-effect','test','x','{}',?)`, [Date.now()]);
      await sendMail({ outboxId: 'o1', to: 'someone@example.test', kind: 'verify-email', actionUrl: 'https://app.pri.example/verify' });
      return [];
    }
  },
  web: {
    async webhook({ request }) {
      verifierCalls++;
      assert.ok(Buffer.isBuffer(request.rawBody));
      // A verified-but-unrelated provider event returns no entitlement change.
      if (request.get('x-test-unrelated') === '1') return [];
      return {
        verified: true,
        provider: 'web',
        eventId: 'evt-server-hook-1',
        accountId: 'acct-hook',
        eventType: 'subscription.activated',
        productId: 'plan-test',
        plan: 'premium',
        status: 'active',
        currentPeriodEnd: Date.now() + 24 * 60 * 60 * 1000,
        effectiveAt: Date.now(),
        eventRank: 50,
        payloadDigest: 'test-only'
      };
    }
  }
};

// Google Play (CP-08): the real module, with Google's OIDC check stubbed by
// one that — like the real one — refuses to run inside a transaction.
const { generateKeyPairSync } = await import('node:crypto');
const googleEnv = {
  PRI_GOOGLE_PACKAGE_NAME: 'com.prilearning.app',
  PRI_GOOGLE_MONTHLY_PRODUCT_ID: 'pri_premium:monthly',
  PRI_GOOGLE_SERVICE_ACCOUNT_JSON: JSON.stringify({
    client_email: 'play@pri-test.iam.gserviceaccount.com',
    private_key: generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey.export({ type: 'pkcs8', format: 'pem' })
  }),
  PRI_GOOGLE_RTDN_AUDIENCE: 'https://app.pri.example/v1/billing/webhook/google',
  PRI_GOOGLE_RTDN_SERVICE_ACCOUNT: 'push@pri-test.iam.gserviceaccount.com'
};
let oidcCalls = 0;
const google = createGoogleBilling(db, {
  env: googleEnv,
  client: { async getSubscription() { throw new Error('the route test never reaches Google'); }, async acknowledge() { return true; } },
  verifyOidc: async token => {
    assertNoOpenTransaction('Fetching Google signing keys');
    oidcCalls++;
    if (token !== 'aaa.bbb.ccc') throw Object.assign(new Error('bad'), { code: 'GOOGLE_NOTIFICATION_UNAUTHENTICATED', status: 401 });
    return { iss: 'https://accounts.google.com', aud: googleEnv.PRI_GOOGLE_RTDN_AUDIENCE, email: googleEnv.PRI_GOOGLE_RTDN_SERVICE_ACCOUNT, email_verified: true };
  }
});
billingVerifiers.google = google.verifiers.google;

const app = express();
app.use(express.json({
  verify(req, res, buffer) { req.rawBody = Buffer.from(buffer); }
}));
app.use(cookieParser());
app.use('/v1', createPlatformRouter(db, { billingVerifiers, billingNative: google.native }));
const server = await new Promise(resolve => {
  const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
});
const origin = `http://127.0.0.1:${server.address().port}`;

try {
  // Real payment providers do not send the browser app's Origin. The webhook
  // must reach its signature verifier instead of being rejected by browser CSRF
  // policy first.
  const webhook = await fetch(`${origin}/v1/billing/webhook/web`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ signed: 'provider-payload' })
  });
  check(webhook.status === 200, `webhook status ${webhook.status}`);
  check(verifierCalls === 1, 'verifier must run exactly once');
  const webhookBody = await webhook.json();
  check(webhookBody.applied === 1, 'one verified event applied');
  check(db.prepare('SELECT status FROM entitlement_snapshots WHERE account_id=?').get('acct-hook').status === 'active', 'entitlement activated');

  // Verified events the adapter classifies as unrelated to a subscription are
  // acknowledged with 200 so the provider does not retry them forever.
  const unrelated = await fetch(`${origin}/v1/billing/webhook/web`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-test-unrelated': '1' },
    body: JSON.stringify({ signed: 'unrelated-provider-payload' })
  });
  check(unrelated.status === 200, `unrelated webhook status ${unrelated.status}`);
  check((await unrelated.json()).applied === 0, 'unrelated event applies nothing');

  // The verifier contract is enforced: a verifier that makes an outbound call
  // inside the webhook transaction fails closed, sends nothing and keeps nothing.
  const impure = await fetch(`${origin}/v1/billing/webhook/apple`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ signedPayload: 'x' })
  });
  check(impure.status === 500, `a verifier making an outbound call inside the transaction fails closed (${impure.status})`);
  check(outboundSent === 0, 'and nothing left the process');
  check(db.prepare(`SELECT COUNT(*) AS n FROM audit_log WHERE action='test.verifier-side-effect'`).get().n === 0, 'and its database write was rolled back');

  // The exception is deliberately path-specific. A browser checkout mutation
  // without the configured app Origin is still rejected before authentication.
  const checkout = await fetch(`${origin}/v1/billing/checkout/web`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ cadence: 'monthly' })
  });
  check(checkout.status === 403, `checkout status ${checkout.status}`);
  const checkoutBody = await checkout.json();
  check(checkoutBody.error.code === 'ORIGIN_REJECTED', 'checkout rejected by origin policy');

  // The same is true of the new subscription management mutation.
  const cancel = await fetch(`${origin}/v1/billing/web/cancel`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{}'
  });
  check(cancel.status === 403, `cancel status ${cancel.status}`);
  check((await cancel.json()).error.code === 'ORIGIN_REJECTED', 'cancel rejected by origin policy');

  // ── Google Play notifications: OIDC before the transaction, then only a queue ──
  const rtdnBody = JSON.stringify({ message: { messageId: 'route-m-1', data: Buffer.from(JSON.stringify({
    version: '1.0', packageName: 'com.prilearning.app', eventTimeMillis: String(Date.now()),
    subscriptionNotification: { version: '1.0', notificationType: 2, purchaseToken: 'route-token-0123456789', subscriptionId: 'pri_premium' }
  })).toString('base64') } });
  const queued = () => db.prepare('SELECT COUNT(*) AS n FROM billing_google_notifications').get().n;
  const noAuth = await fetch(`${origin}/v1/billing/webhook/google`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: rtdnBody });
  check(noAuth.status === 401 && queued() === 0, `a Google push without Google's OIDC token is refused and queues nothing (${noAuth.status})`);
  const forged = await fetch(`${origin}/v1/billing/webhook/google`, { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer xxx.yyy.zzz' }, body: rtdnBody });
  check(forged.status === 401 && queued() === 0, `a forged OIDC token is refused and queues nothing (${forged.status})`);
  const pushed = await fetch(`${origin}/v1/billing/webhook/google`, { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer aaa.bbb.ccc' }, body: rtdnBody });
  check(pushed.status === 200 && (await pushed.json()).applied === 0, `an authenticated push is acknowledged and applies nothing itself (${pushed.status})`);
  check(queued() === 1 && oidcCalls === 2, 'it is queued for the worker, and Google\'s keys were checked outside the transaction');

  // ── the purchase route: a session is required; browsers still need the Origin ──
  // A native shell's HTTP stack (raw node:http: no Origin, no Fetch Metadata —
  // Node's fetch adds Sec-Fetch-Mode itself and is correctly treated as a browser).
  const { request: httpRequest } = await import('node:http');
  const nativeNoSession = await new Promise((resolve, reject) => {
    const req = httpRequest(`${origin}/v1/billing/google/purchase`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-pri-client': 'android-native-v1' } }, res => {
      let body = ''; res.on('data', c => { body += c; }); res.on('end', () => resolve({ status: res.statusCode, body }));
    });
    req.on('error', reject); req.end(JSON.stringify({ purchaseToken: 'route-token-0123456789' }));
  });
  check(nativeNoSession.status === 401, `the Android shell without a session is refused at authentication, not by the browser Origin rule (${nativeNoSession.status} ${nativeNoSession.body})`);
  const browserNoOrigin = await fetch(`${origin}/v1/billing/google/purchase`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ purchaseToken: 'route-token-0123456789' })
  });
  check(browserNoOrigin.status === 403 && (await browserNoOrigin.json()).error.code === 'ORIGIN_REJECTED', 'a browser-shaped request without the app Origin never reaches the purchase verifier');
  const bootstrap = await fetch(`${origin}/v1/billing/google/bootstrap`);
  check(bootstrap.status === 401, `bootstrap needs a session (${bootstrap.status})`);

  console.log(`BILLING WEBHOOK ROUTER: PASS — ${checks}/${checks} checks — provider webhooks bypass browser Origin checks only on the signed server endpoint; unrelated verified events are acknowledged; browser billing mutations remain origin-protected.`);
} finally {
  await new Promise(resolve => server.close(resolve));
  db.close();
  rmSync(scratch, { recursive: true, force: true });
  for (const [name, value] of Object.entries(prior)) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
}
