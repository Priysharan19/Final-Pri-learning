import assert from 'node:assert/strict';

const prior = {
  NODE_ENV: process.env.NODE_ENV,
  PRI_PUBLIC_ORIGIN: process.env.PRI_PUBLIC_ORIGIN,
  PRI_CSRF_SECRET: process.env.PRI_CSRF_SECRET,
  PRI_AUTH_DELIVERY_KEY: process.env.PRI_AUTH_DELIVERY_KEY
};
process.env.NODE_ENV = 'production';
process.env.PRI_PUBLIC_ORIGIN = 'https://app.pri.example';
process.env.PRI_CSRF_SECRET = 'test-csrf-secret-not-production';
process.env.PRI_AUTH_DELIVERY_KEY = '22'.repeat(32);

const [
  { default: express },
  { default: cookieParser },
  { createPlatformDb },
  { ensureBillingSchema },
  { createPlatformRouter }
] = await Promise.all([
  import('express'),
  import('cookie-parser'),
  import('../platform/db.js'),
  import('../platform/billingSchema.js'),
  import('../platform/router.js')
]);

const db = createPlatformDb(':memory:');
ensureBillingSchema(db);
const now = Date.now();
db.prepare(`INSERT INTO accounts(id,email,name,password_hash,role,created_at,updated_at)
  VALUES ('acct-hook','hook@example.test','Hook Student','hash','student',?,?)`).run(now, now);
db.prepare(`INSERT INTO entitlement_snapshots(account_id,plan,status,provider,source_version,updated_at)
  VALUES ('acct-hook','free','free','none',0,?)`).run(now);

let verifierCalls = 0;
const billingVerifiers = {
  web: {
    async webhook({ request }) {
      verifierCalls++;
      assert.ok(Buffer.isBuffer(request.rawBody));
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

const app = express();
app.use(express.json({
  verify(req, res, buffer) { req.rawBody = Buffer.from(buffer); }
}));
app.use(cookieParser());
app.use('/v1', createPlatformRouter(db, { billingVerifiers }));
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
  assert.equal(webhook.status, 200);
  assert.equal(verifierCalls, 1);
  const webhookBody = await webhook.json();
  assert.equal(webhookBody.applied, 1);
  assert.equal(db.prepare('SELECT status FROM entitlement_snapshots WHERE account_id=?').get('acct-hook').status, 'active');

  // The exception is deliberately path-specific. A browser checkout mutation
  // without the configured app Origin is still rejected before authentication.
  const checkout = await fetch(`${origin}/v1/billing/checkout/web`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ cadence: 'monthly' })
  });
  assert.equal(checkout.status, 403);
  const checkoutBody = await checkout.json();
  assert.equal(checkoutBody.error.code, 'ORIGIN_REJECTED');

  console.log('PASS — provider webhooks bypass browser Origin checks only on the signed server endpoint; browser billing mutations remain origin-protected.');
} finally {
  await new Promise(resolve => server.close(resolve));
  db.close();
  for (const [name, value] of Object.entries(prior)) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
}
