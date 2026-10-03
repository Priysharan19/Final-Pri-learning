// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · concurrent requests cannot both win (ADR-0001 phase 2)
//
//   node server/test/platform-concurrency-check.mjs                    → SQLite
//   node server/test/platform-concurrency-check.mjs --engine=postgres  → Postgres
//
// With better-sqlite3 every handler ran to completion before the next began,
// so "read, check, write" was atomic for free. Async handlers lose that. Each
// case below sends the same one-time thing several times AT ONCE through the
// real /v1 app and requires exactly one winner, with the database showing
// exactly one effect:
//
//   · an email-verification link, a password-reset link, a guardian consent
//     link, a teacher invite code and an OIDC nonce — each redeemable once;
//   · a billing webhook event id, and a refund event id — applied, ledgered and
//     audited once;
//   · a sync push retried under one Idempotency-Key — written once, answered
//     identically;
//   · a rate-limit bucket and the deployment's paid-call budget — never
//     overspent.
// ─────────────────────────────────────────────────────────────────────────────
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const envNames = [
  'NODE_ENV', 'PRI_PUBLIC_ORIGIN', 'PRI_PLATFORM_DB', 'PRI_AUTH_DELIVERY_KEY',
  'PRI_RAZORPAY_KEY_ID', 'PRI_RAZORPAY_KEY_SECRET', 'PRI_RAZORPAY_WEBHOOK_SECRET',
  'PRI_RAZORPAY_MONTHLY_PLAN_ID', 'PRI_RAZORPAY_MONTHLY_TOTAL_COUNT', 'PRI_DISPLAY_TRIAL_DAYS'
];
const prior = Object.fromEntries(envNames.map(name => [name, process.env[name]]));
const scratch = mkdtempSync(join(tmpdir(), 'pri-concurrency-'));
process.env.NODE_ENV = 'test';
delete process.env.PRI_PUBLIC_ORIGIN;
process.env.PRI_PLATFORM_DB = join(scratch, 'platform.db');
process.env.PRI_AUTH_DELIVERY_KEY = '77'.repeat(32);
process.env.PRI_RAZORPAY_KEY_ID = 'rzp_test_concurrency';
process.env.PRI_RAZORPAY_KEY_SECRET = 'rzp-test-secret-concurrency';
process.env.PRI_RAZORPAY_WEBHOOK_SECRET = 'webhook-secret-concurrency';
process.env.PRI_RAZORPAY_MONTHLY_PLAN_ID = 'plan_Concurrent1234';
process.env.PRI_RAZORPAY_MONTHLY_TOTAL_COUNT = '12';
delete process.env.PRI_DISPLAY_TRIAL_DAYS;

const { startApp, registerAccount, verifyEmail, checks, promoteRole } = await import('./support/app-harness.mjs');
const { requestedEngine } = await import('./support/engine.mjs');
const { decryptDeliveryToken } = await import('../platform/deliveryCrypto.js');
const { consumeOidcNonce, issueOidcNonce } = await import('../platform/oidcNonce.js');
const { consumeRateLimit } = await import('../platform/security.js');
const { consumePaidCall } = await import('../platform/spendCeiling.js');

const c = checks();
const h = await startApp({ engine: requestedEngine() });
const db = h.db;
const ATTEMPTS = 6;
const at = (n, fn) => Promise.all(Array.from({ length: n }, (_, i) => fn(i)));
const count = async (sql, params) => Number((await db.get(sql, params)).n);
const clearRateLimits = () => db.run('DELETE FROM rate_limits');

async function deliveryToken(accountId, kind) {
  const row = await db.get(`SELECT token_id, token_ciphertext FROM auth_delivery_outbox
    WHERE account_id=? AND kind=? AND delivered_at IS NULL ORDER BY created_at DESC`, [accountId, kind]);
  assert.ok(row, `a ${kind} envelope is queued`);
  return decryptDeliveryToken(row.token_ciphertext, `${accountId}:${kind}:${row.token_id}`);
}

const sec = ms => Math.floor(ms / 1000);
function signedWebhook(event, entities, eventId) {
  const raw = JSON.stringify({
    entity: 'event', event, contains: Object.keys(entities),
    payload: Object.fromEntries(Object.entries(entities).map(([key, entity]) => [key, { entity }])),
    created_at: sec(Date.now()) - 60
  });
  const signature = createHmac('sha256', process.env.PRI_RAZORPAY_WEBHOOK_SECRET).update(Buffer.from(raw)).digest('hex');
  return { raw, headers: { 'Content-Type': 'application/json', 'x-razorpay-event-id': eventId, 'x-razorpay-signature': signature } };
}

try {
  // ── 1 · One email-verification link, redeemed at once ──────────────────────
  const verifying = await registerAccount(h, { email: 'race.verify@example.test', deviceId: 'ipad-race-1' });
  c.eq(verifying.status, 201, 'a student registers');
  const verifyToken = await deliveryToken(verifying.account.id, 'verify-email');
  const verifyResults = await at(ATTEMPTS, () => h.request('/v1/account/email/verify', { method: 'POST', body: { token: verifyToken } }));
  const spending = verifyResults.filter(r => r.status === 200 && r.data?.alreadyVerified === false);
  c.eq(spending.length, 1, `exactly one of ${ATTEMPTS} concurrent verifications spends the token`);
  c.ok(verifyResults.filter(r => !spending.includes(r)).every(r =>
    (r.status === 200 && r.data?.alreadyVerified === true) || (r.status === 400 && r.data?.error?.code === 'TOKEN_INVALID')),
  'every other one is told the account is already verified (or, mid-commit, that the link is spent)');
  c.eq(await count(`SELECT COUNT(*) AS n FROM account_tokens WHERE account_id=? AND purpose='verify-email' AND consumed_at IS NOT NULL`, [verifying.account.id]), 1, 'the token is consumed once');
  c.ok(!!(await db.get('SELECT email_verified_at FROM accounts WHERE id=?', [verifying.account.id])).email_verified_at, 'and the mailbox is verified');

  // ── 2 · One password-reset link, four different new passwords ─────────────
  await clearRateLimits();
  const resetting = await registerAccount(h, { email: 'race.reset@example.test', deviceId: 'ipad-race-2' });
  await h.request('/v1/account/password/reset-request', { method: 'POST', body: { email: 'race.reset@example.test' } });
  const resetToken = await deliveryToken(resetting.account.id, 'reset-password');
  const candidates = ['first-new-password', 'second-new-password', 'third-new-password', 'fourth-new-password'];
  const resetResults = await at(candidates.length, i => h.request('/v1/account/password/reset', { method: 'POST', body: { token: resetToken, password: candidates[i] } }));
  const winners = candidates.filter((_, i) => resetResults[i].status === 200);
  c.eq(winners.length, 1, 'exactly one of four concurrent resets with one link sets a password');
  c.ok(resetResults.filter(r => r.status !== 200).every(r => r.data?.error?.code === 'TOKEN_INVALID'), 'the others are refused as a spent link');
  await clearRateLimits();
  const logins = await at(candidates.length, i => h.request('/v1/account/login', { method: 'POST', body: { email: 'race.reset@example.test', password: candidates[i], deviceId: 'ipad-race-2' } }));
  c.deq(candidates.filter((_, i) => logins[i].status === 200), winners, 'only the winning password signs in — no loser overwrote it after the fact');

  // ── 3 · One guardian consent link, confirmed at once ──────────────────────
  await clearRateLimits();
  const child = await h.request('/v1/account/register', {
    method: 'POST', jar: {}, body: {
      name: 'Race Child', email: 'race.child@example.test', password: 'correct-horse-battery', deviceId: 'ipad-race-3',
      isAdult: false, year: '9', guardianName: 'Race Guardian', guardianEmail: 'race.guardian@example.test'
    }
  });
  c.eq(child.status, 201, 'a child registers with a guardian');
  const consentToken = await deliveryToken(child.data.account.id, 'guardian-consent');
  const consentResults = await at(ATTEMPTS, () => h.request('/v1/account/guardian/confirm', { method: 'POST', body: { token: consentToken } }));
  c.eq(consentResults.filter(r => r.status === 200).length, 1, `exactly one of ${ATTEMPTS} concurrent guardian confirmations is accepted`);
  c.eq(consentResults.find(r => r.status === 200)?.data?.confirmed, true, 'and it is the one that confirmed');
  c.eq(await count('SELECT COUNT(*) AS n FROM guardian_consents WHERE account_id=? AND confirmed_at IS NOT NULL', [child.data.account.id]), 1, 'consent is recorded once');

  // ── 4 · One teacher invite code, four registrations at once ────────────────
  await clearRateLimits();
  const admin = await registerAccount(h, { email: 'race.admin@example.test', deviceId: 'mac-race-admin' });
  await promoteRole(h, admin.jar, admin.account.id, 'admin');
  const minted = await h.request('/v1/admin/teacher-invites', { method: 'POST', jar: admin.jar, body: { ttlDays: 1 } });
  c.eq(minted.status, 201, 'an admin mints a teacher invite');
  await clearRateLimits();
  const inviteResults = await at(4, i => registerAccount(h, { email: `race.teacher${i}@example.test`, deviceId: `ipad-race-t${i}`, teacherInviteCode: minted.data.code }));
  c.eq(inviteResults.filter(r => r.status === 201).length, 1, 'exactly one of four concurrent registrations redeems the invite');
  c.eq(inviteResults.find(r => r.status === 201)?.account?.role, 'teacher', 'and becomes a teacher');
  c.ok(inviteResults.filter(r => r.status !== 201).every(r => r.data?.error?.code === 'TEACHER_INVITE_INVALID'), 'the others are told the code is used');
  c.eq(await count("SELECT COUNT(*) AS n FROM accounts WHERE role='teacher'"), 1, 'one teacher account exists');
  c.eq(await count('SELECT COUNT(*) AS n FROM teacher_invites WHERE used_at IS NOT NULL'), 1, 'the invite is used once');
  c.eq(await count("SELECT COUNT(*) AS n FROM accounts WHERE email LIKE 'race.teacher%'"), 1, 'no account is left behind by a losing registration');

  // ── 5 · One OIDC nonce, consumed at once ───────────────────────────────────
  const { nonce } = await issueOidcNonce(db);
  const nonceResults = await at(8, () => consumeOidcNonce(db, nonce));
  c.eq(nonceResults.filter(Boolean).length, 1, 'exactly one of eight concurrent consumers gets the nonce');

  // ── 6 · One billing webhook event id, delivered at once ───────────────────
  const payer = await registerAccount(h, { email: 'race.payer@example.test', deviceId: 'ipad-race-pay' });
  const plan = process.env.PRI_RAZORPAY_MONTHLY_PLAN_ID;
  const subscriptionId = 'sub_RaceConcurrent01';
  const t = Date.now();
  await db.run(`INSERT INTO billing_subscriptions(provider,provider_subscription_id,account_id,product_id,cadence,trial_claimed,created_at,updated_at)
    VALUES ('web',?,?,?,'monthly',0,?,?)`, [subscriptionId, payer.account.id, plan, t, t]);
  const subscription = {
    id: subscriptionId, entity: 'subscription', plan_id: plan, status: 'active',
    current_start: sec(t), current_end: sec(t + 30 * 86_400_000), start_at: sec(t), ended_at: null,
    notes: { pri_account_id: payer.account.id, pri_cadence: 'monthly', pri_trial: '0' }
  };
  const payment = { id: 'pay_RaceConcurrent01', entity: 'payment', amount: 99900, currency: 'INR', status: 'captured', created_at: sec(t), subscription_id: subscriptionId };
  const charged = signedWebhook('subscription.charged', { subscription, payment }, 'evt-race-charged');
  const hookResults = await at(ATTEMPTS, () => h.request('/v1/billing/webhook/web', { method: 'POST', rawBody: charged.raw, headers: charged.headers }));
  c.ok(hookResults.every(r => r.status === 200), `all ${ATTEMPTS} concurrent deliveries are acknowledged (${hookResults.map(r => r.status).join(',')})`);
  c.eq(await count(`SELECT COUNT(*) AS n FROM billing_events WHERE provider='web' AND event_id='evt-race-charged'`), 1, 'the event is recorded once');
  const snapshot = await db.get('SELECT plan,status,source_version FROM entitlement_snapshots WHERE account_id=?', [payer.account.id]);
  c.deq([snapshot.plan, snapshot.status, Number(snapshot.source_version)], ['premium', 'active', 1], 'and applied once: Premium at source version 1');
  c.eq(await count(`SELECT COUNT(*) AS n FROM billing_payments WHERE payment_id='pay_RaceConcurrent01'`), 1, 'the payment is ledgered once');

  const refund = { id: 'rfnd_RaceConcurrent01', entity: 'refund', payment_id: payment.id, amount: 99900, status: 'processed', created_at: sec(t) };
  const refunded = signedWebhook('refund.processed', { refund, payment }, 'evt-race-refund');
  const refundResults = await at(ATTEMPTS, () => h.request('/v1/billing/webhook/web', { method: 'POST', rawBody: refunded.raw, headers: refunded.headers }));
  c.ok(refundResults.every(r => r.status === 200), `all ${ATTEMPTS} concurrent refund deliveries are acknowledged`);
  c.eq(await count(`SELECT COUNT(*) AS n FROM audit_log WHERE action='billing.refund' AND target_id=?`, [subscriptionId]), 1, 'the refund decision is audited once');
  c.eq(await count(`SELECT COUNT(*) AS n FROM billing_events WHERE event_id='evt-race-refund' AND applied_at IS NOT NULL`), 1, 'the refund event is applied once');
  const revoked = await db.get('SELECT plan,status,source_version FROM entitlement_snapshots WHERE account_id=?', [payer.account.id]);
  c.deq([revoked.plan, revoked.status, Number(revoked.source_version)], ['free', 'revoked', 2], 'and revokes Premium exactly once');

  // The same verified event handed to the entitlement writer at once.
  const { applyVerifiedEntitlement } = await import('../platform/entitlements.js');
  const grant = {
    verified: true, provider: 'admin', eventId: 'race-grant-1', accountId: payer.account.id, eventType: 'support-grant',
    productId: 'pri-premium-support', plan: 'premium', status: 'active', currentPeriodEnd: Date.now() + 86_400_000
  };
  const grants = await at(ATTEMPTS, () => applyVerifiedEntitlement(db, grant));
  c.eq(grants.filter(g => g.replayed === false).length, 1, `exactly one of ${ATTEMPTS} concurrent applications of one event applies it; the rest are replays`);
  c.eq(Number((await db.get('SELECT source_version FROM entitlement_snapshots WHERE account_id=?', [payer.account.id])).source_version), 3, 'the snapshot advanced by exactly one version');

  // ── 7 · One sync batch, retried under one key at once ──────────────────────
  await db.run('UPDATE accounts SET email_verified_at=? WHERE id=?', [Date.now(), payer.account.id]);
  const batch = {
    schemaVersion: 1, deviceId: 'ipad-race-pay',
    events: [1, 2, 3].map(seq => ({ id: `race-evt-${seq}`, deviceId: 'ipad-race-pay', deviceSeq: seq, kind: 'practice-attempt', payload: { seq } })),
    entities: [{ kind: 'settings', entityId: 'race-settings', operation: 'upsert', baseVersion: 0, body: { theme: 'dark' } }]
  };
  const pushes = await at(ATTEMPTS, () => h.request('/v1/sync/push', { method: 'POST', jar: payer.jar, headers: { 'Idempotency-Key': 'race-batch-1' }, body: batch }));
  c.ok(pushes.every(r => r.status === 200), `all ${ATTEMPTS} concurrent retries of one batch succeed (${pushes.map(r => `${r.status}:${r.data?.error?.code || ''}`).join(',')})`);
  c.eq(new Set(pushes.map(r => JSON.stringify(r.data))).size, 1, 'and every one receives the same acknowledgement');
  c.eq(await count('SELECT COUNT(*) AS n FROM learning_events WHERE account_id=?', [payer.account.id]), 3, 'the three events are stored once');
  c.eq(Number((await db.get(`SELECT version FROM sync_entities WHERE account_id=? AND entity_id='race-settings'`, [payer.account.id])).version), 1, 'the entity is written once (version 1, not a phantom conflict)');
  c.eq(await count(`SELECT COUNT(*) AS n FROM idempotency_keys WHERE account_id=? AND key='race-batch-1'`, [payer.account.id]), 1, 'one idempotency record');
  const cursors = pushes[0].data.acceptedEvents.map(e => e.serverCursor);
  c.ok(cursors.every((value, i) => i === 0 || value > cursors[i - 1]), 'server cursors are strictly increasing within the batch');

  // ── 8 · Budgets are never overspent ───────────────────────────────────────
  const verdicts = await at(12, () => consumeRateLimit(db, 'race:bucket', { limit: 5, windowMs: 60_000 }));
  c.eq(verdicts.filter(v => v.allowed).length, 5, 'twelve concurrent requests against a limit of five admit exactly five');
  const env = { PRI_HANDWRITING_API_KEY: 'test-key-never-sent', PRI_PAID_CALLS_PER_HOUR: '3', PRI_PAID_CALLS_PER_DAY: '100' };
  const paid = await at(10, () => consumePaidCall(db, { env }));
  c.eq(paid.filter(v => v === null).length, 3, 'ten concurrent paid calls against an hourly budget of three spend exactly three');

  console.log(`engine: ${h.engine}`);
  console.log(`PLATFORM CONCURRENCY: PASS — ${c.count()}/${c.count()} checks — one-time links, invite codes, nonces, webhook and refund event ids, sync retries, rate buckets and the paid budget each have exactly one winner under concurrent requests on ${h.engine}.`);
} finally {
  await h.close();
  rmSync(scratch, { recursive: true, force: true });
  for (const name of envNames) {
    if (prior[name] === undefined) delete process.env[name];
    else process.env[name] = prior[name];
  }
}
