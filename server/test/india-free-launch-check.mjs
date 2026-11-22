// Real authenticated free-launch negative controls. Run on SQLite and disposable Postgres.
import './support/hermetic.mjs';
import assert from 'node:assert/strict';
import { indiaFreeLaunch } from '../../client/src/engine/launchPolicy.js';
assert.equal(indiaFreeLaunch('priyabhata', { NODE_ENV: 'production', PRI_TEST_PAID_MODE: '1' }), true);
assert.equal(indiaFreeLaunch('priyabhata', { NODE_ENV: 'test', PRI_TEST_PAID_MODE: '1' }), false);
assert.equal(indiaFreeLaunch('priyabhata', {}), true);
assert.equal(indiaFreeLaunch('prithagoras', {}), false);
process.env.NODE_ENV = 'test';
delete process.env.PRI_TEST_PAID_MODE;
process.env.PRI_EDITION = 'priyabhata';
process.env.PRI_AUTH_DELIVERY_KEY = '7a'.repeat(32);
process.env.PRI_AUTH_EMAIL_PROVIDER = 'test';
delete process.env.PRI_PUBLIC_ORIGIN;
const { startApp, registerAccount, verifyEmail } = await import('./support/app-harness.mjs');
const { requestedEngine } = await import('./support/engine.mjs');
const { commercialConfig } = await import('../platform/billing.js');
const { freeLaunchActive } = await import('../platform/launchPolicy.js');
const { premiumContentRefusal } = await import('../platform/practiceAllowance.js');
const { entitlementRefusal } = await import('../platform/exams.js');
const engine = requestedEngine();
const h = await startApp({ engine });
if (engine === 'postgres') console.log('engine: postgres'); // Must satisfy the real-Postgres gate after successfully opening the selected engine.
try {
  assert.equal(freeLaunchActive(), true);
  const free = await registerAccount(h, { email: 'free.launch@example.test', deviceId: 'free-launch-1012' });
  assert.equal((await verifyEmail(h, free.account.id)).status, 200);
  const cfg = commercialConfig('priyabhata');
  assert.equal(cfg.available, false);
  assert.equal(cfg.display.monthly, null);
  assert.equal(cfg.display.annual, null);
  assert.equal(cfg.webCheckout.configured, false);
  for (const [method, path] of [['POST','/v1/billing/checkout/web'],['GET','/v1/billing/apple/bootstrap'],['GET','/v1/billing/google/bootstrap']]) {
    const r = await h.request(path, { method, jar: free.jar, ...(method === 'POST' ? {body:{cadence:'monthly'}} : {}) });
    assert.equal(r.status, 404, path);
    assert.equal(r.data.error.code, 'BILLING_NOT_AVAILABLE_IN_EDITION');
  }
  const referral = await h.request('/v1/referral', { jar: free.jar });
  assert.equal(referral.data.available, false);
  const claim = await h.request('/v1/referral/claim', { method: 'POST', jar: free.jar, body:{code:'ABCDEFGHJK'} });
  assert.equal(claim.status, 404);
  assert.equal(claim.data.error.code, 'REFERRAL_NOT_AVAILABLE');
  assert.equal(await premiumContentRefusal(h.db, { accountId: free.account.id, generator: 'jee-advanced-c11-binomial-theorem' }), null);
  assert.equal((await premiumContentRefusal(h.db, { accountId: free.account.id, generator: 'pyq-jee-advanced-c11-conic-sections' })).capability, 'jee-advanced-content');
  assert.equal(await entitlementRefusal(h.db, free.account.id, { blueprint: { track: 'jee-advanced' } }, Date.now()), null);
  const r = await h.request('/v1/practice/issue', { method: 'POST', jar: free.jar, body: {generator:'c11-binomial-theorem',difficulty:4,curriculum:'in',mode:'practice'} });
  assert.equal(r.status, 201);
  const advance = await h.request('/v1/practice/issue', { method:'POST',jar:free.jar,body:{generator:'jee-advanced-c11-binomial-theorem',difficulty:3,curriculum:'in',mode:'practice'} });
  // The eligibility of this particular authored bank is separate from the
  // commercial gate; the gate must not refuse it solely for being unpaid.
  assert.notEqual(advance.data?.error?.code,'PREMIUM_REQUIRED');
  const snapshot = await h.db.get('SELECT plan FROM entitlement_snapshots WHERE account_id=?', [free.account.id]);
  assert.notEqual(snapshot?.plan, 'premium', 'free launch must never forge a paid snapshot');
  console.log('INDIA FREE LAUNCH: PASS — production policy, direct sale refusal, no referral, JEE access gate, ordinary issuance, no fake entitlement');
} finally { await h.close(); }
