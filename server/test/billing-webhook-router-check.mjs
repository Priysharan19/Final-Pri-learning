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
  PRI_PLATFORM_DB: process.env.PRI_PLATFORM_DB
};
const scratch = mkdtempSync(join(tmpdir(), 'pri-webhook-router-'));
process.env.NODE_ENV = 'production';
process.env.PRI_PUBLIC_ORIGIN = 'https://app.pri.example';
process.env.PRI_CSRF_SECRET = 'test-csrf-secret-not-production';
process.env.PRI_AUTH_DELIVERY_KEY = '22'.repeat(32);
process.env.PRI_PLATFORM_DB = join(scratch, 'platform.db');

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
const billingVerifiers = {
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
