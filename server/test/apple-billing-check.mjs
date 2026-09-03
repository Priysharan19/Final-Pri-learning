import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { X509Certificate, createPrivateKey, sign } from 'node:crypto';
import { createPlatformDb } from '../platform/db.js';
import { ensureBillingSchema } from '../platform/billingSchema.js';
import { createAppleBilling } from '../platform/appleBilling.js';
import { applyVerifiedEntitlement } from '../platform/entitlements.js';

const envNames = [
  'PRI_APPLE_ROOT_CA_PEM', 'PRI_APPLE_ROOT_CA_FILE', 'PRI_APPLE_APP_ID',
  'PRI_APPLE_BUNDLE_ID', 'PRI_APPLE_MONTHLY_PRODUCT_ID',
  'PRI_APPLE_ANNUAL_PRODUCT_ID', 'PRI_APPLE_ENVIRONMENTS'
];
const previous = Object.fromEntries(envNames.map(name => [name, process.env[name]]));
const dir = mkdtempSync(join(tmpdir(), 'pri-apple-billing-'));
const file = name => join(dir, name);

function openssl(...args) {
  execFileSync('openssl', args, { stdio: ['ignore', 'pipe', 'pipe'] });
}

function makeCertificates() {
  openssl('ecparam', '-name', 'prime256v1', '-genkey', '-noout', '-out', file('root.key'));
  openssl('req', '-x509', '-new', '-key', file('root.key'), '-sha256', '-days', '2',
    '-subj', '/CN=Pri Test Apple Root',
    '-addext', 'basicConstraints=critical,CA:TRUE',
    '-addext', 'keyUsage=critical,keyCertSign,cRLSign',
    '-out', file('root.pem'));

  openssl('ecparam', '-name', 'prime256v1', '-genkey', '-noout', '-out', file('intermediate.key'));
  openssl('req', '-new', '-key', file('intermediate.key'), '-subj', '/CN=Pri Test Apple Intermediate', '-out', file('intermediate.csr'));
  writeFileSync(file('intermediate.ext'), [
    'basicConstraints=critical,CA:TRUE,pathlen:0',
    'keyUsage=critical,keyCertSign,cRLSign',
    'subjectKeyIdentifier=hash',
    'authorityKeyIdentifier=keyid,issuer',
    '1.2.840.113635.100.6.2.1=ASN1:NULL',
    ''
  ].join('\n'));
  openssl('x509', '-req', '-in', file('intermediate.csr'), '-CA', file('root.pem'), '-CAkey', file('root.key'),
    '-CAcreateserial', '-days', '2', '-sha256', '-extfile', file('intermediate.ext'), '-out', file('intermediate.pem'));

  openssl('ecparam', '-name', 'prime256v1', '-genkey', '-noout', '-out', file('leaf.key'));
  openssl('req', '-new', '-key', file('leaf.key'), '-subj', '/CN=Pri Test App Store Signing', '-out', file('leaf.csr'));
  writeFileSync(file('leaf.ext'), [
    'basicConstraints=critical,CA:FALSE',
    'keyUsage=critical,digitalSignature',
    'subjectKeyIdentifier=hash',
    'authorityKeyIdentifier=keyid,issuer',
    '1.2.840.113635.100.6.11.1=ASN1:NULL',
    ''
  ].join('\n'));
  openssl('x509', '-req', '-in', file('leaf.csr'), '-CA', file('intermediate.pem'), '-CAkey', file('intermediate.key'),
    '-CAcreateserial', '-days', '2', '-sha256', '-extfile', file('leaf.ext'), '-out', file('leaf.pem'));
}

makeCertificates();
const rootPem = readFileSync(file('root.pem'), 'utf8');
const leaf = new X509Certificate(readFileSync(file('leaf.pem')));
const intermediate = new X509Certificate(readFileSync(file('intermediate.pem')));
const root = new X509Certificate(rootPem);
const leafKey = createPrivateKey(readFileSync(file('leaf.key')));
const x5c = [leaf, intermediate, root].map(cert => cert.raw.toString('base64'));

process.env.PRI_APPLE_ROOT_CA_PEM = rootPem;
delete process.env.PRI_APPLE_ROOT_CA_FILE;
process.env.PRI_APPLE_APP_ID = '1234567890';
process.env.PRI_APPLE_BUNDLE_ID = 'com.prilearning.app';
process.env.PRI_APPLE_MONTHLY_PRODUCT_ID = 'com.prilearning.premium.monthly';
process.env.PRI_APPLE_ANNUAL_PRODUCT_ID = 'com.prilearning.premium.annual';
process.env.PRI_APPLE_ENVIRONMENTS = 'Production,Sandbox';

const b64url = value => Buffer.from(JSON.stringify(value)).toString('base64url');
function jws(payload, { key = leafKey, chain = x5c } = {}) {
  const encodedHeader = b64url({ alg: 'ES256', x5c: chain });
  const encodedPayload = b64url(payload);
  const data = Buffer.from(`${encodedHeader}.${encodedPayload}`);
  const signature = sign('sha256', data, { key, dsaEncoding: 'ieee-p1363' });
  return `${encodedHeader}.${encodedPayload}.${signature.toString('base64url')}`;
}

function transactionPayload({
  appAccountToken, transactionId = '200000000000001', originalTransactionId = '100000000000001',
  productId = process.env.PRI_APPLE_MONTHLY_PRODUCT_ID, expiresDate = Date.now() + 30 * 24 * 60 * 60 * 1000,
  environment = 'Production', signedDate = Date.now(), bundleId = process.env.PRI_APPLE_BUNDLE_ID,
  revocationDate = null
} = {}) {
  return {
    transactionId, originalTransactionId, productId, appAccountToken,
    bundleId, environment, purchaseDate: signedDate - 2_000,
    originalPurchaseDate: signedDate - 2_000, expiresDate, signedDate,
    type: 'Auto-Renewable Subscription', inAppOwnershipType: 'PURCHASED',
    revocationDate
  };
}

function notificationPayload({
  signedTransactionInfo, notificationUUID, notificationType = 'DID_RENEW', subtype = null,
  signedDate = Date.now(), environment = 'Production', bundleId = process.env.PRI_APPLE_BUNDLE_ID,
  appAppleId = Number(process.env.PRI_APPLE_APP_ID), signedRenewalInfo = null
}) {
  return {
    notificationType, subtype, notificationUUID, version: '2.0', signedDate,
    data: { appAppleId, bundleId, environment, signedTransactionInfo, signedRenewalInfo }
  };
}

const db = createPlatformDb(':memory:');
ensureBillingSchema(db);
const now = Date.now();
for (const [id, email] of [['acct-apple-a', 'apple-a@example.test'], ['acct-apple-b', 'apple-b@example.test']]) {
  db.prepare(`INSERT INTO accounts(id,email,name,password_hash,role,created_at,updated_at)
    VALUES (?,?,?,'hash','student',?,?)`).run(id, email, id, now, now);
  db.prepare(`INSERT INTO entitlement_snapshots(account_id,plan,status,provider,source_version,updated_at)
    VALUES (?,'free','free','none',0,?)`).run(id, now);
}

try {
  const apple = createAppleBilling(db);
  assert.equal(apple.configured, true);

  const bootstrap = apple.native.apple.bootstrap({ accountId: 'acct-apple-a' });
  const bootstrapAgain = apple.native.apple.bootstrap({ accountId: 'acct-apple-a' });
  assert.match(bootstrap.appAccountToken, /^[0-9a-f-]{36}$/i);
  assert.equal(bootstrapAgain.appAccountToken, bootstrap.appAccountToken, 'appAccountToken must be stable per Pri account');
  assert.equal(bootstrap.products.monthly, process.env.PRI_APPLE_MONTHLY_PRODUCT_ID);

  const activePayload = transactionPayload({ appAccountToken: bootstrap.appAccountToken, signedDate: now + 100 });
  const activeJws = jws(activePayload);
  const verified = apple.native.apple.transaction({ accountId: 'acct-apple-a', body: { signedTransaction: activeJws } });
  assert.equal(verified.verified, true);
  assert.equal(verified.provider, 'apple');
  assert.equal(verified.accountId, 'acct-apple-a');
  assert.equal(verified.status, 'active');
  assert.equal(verified.providerSubscriptionId, activePayload.originalTransactionId);

  const applied = applyVerifiedEntitlement(db, verified);
  assert.equal(applied.replayed, false);
  assert.equal(applied.stale, false);
  assert.equal(applied.snapshot.plan, 'premium');
  assert.equal(applied.snapshot.provider, 'apple');
  assert.equal(applyVerifiedEntitlement(db, verified).replayed, true, 'same Apple transaction must be idempotent');

  await assert.rejects(async () => apple.native.apple.transaction({
    accountId: 'acct-apple-b', body: { signedTransaction: activeJws }
  }), error => error?.code === 'APPLE_ACCOUNT_TOKEN_MISMATCH' || error?.code === 'BILLING_ACCOUNT_MISMATCH');

  const wrongToken = jws(transactionPayload({ appAccountToken: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', transactionId: '200000000000002' }));
  await assert.rejects(async () => apple.native.apple.transaction({
    accountId: 'acct-apple-a', body: { signedTransaction: wrongToken }
  }), error => error?.code === 'APPLE_ACCOUNT_TOKEN_MISMATCH');

  const wrongProduct = jws(transactionPayload({
    appAccountToken: bootstrap.appAccountToken, transactionId: '200000000000003', productId: 'com.other.product'
  }));
  await assert.rejects(async () => apple.native.apple.transaction({
    accountId: 'acct-apple-a', body: { signedTransaction: wrongProduct }
  }), error => error?.code === 'BILLING_PRODUCT_UNKNOWN');

  const tampered = `${activeJws.slice(0, -2)}aa`;
  await assert.rejects(async () => apple.native.apple.transaction({
    accountId: 'acct-apple-a', body: { signedTransaction: tampered }
  }), error => error?.code === 'APPLE_JWS_SIGNATURE_INVALID');

  const restored = apple.verifiers.apple.restore({ accountId: 'acct-apple-a', body: { transactions: [activeJws] } });
  assert.equal(restored.verified, true);
  assert.equal(restored.eventType, 'transaction.restore');
  assert.equal(restored.accountId, 'acct-apple-a');

  const renewalTime = now + 5_000;
  const renewalTxPayload = transactionPayload({
    appAccountToken: bootstrap.appAccountToken,
    transactionId: '200000000000010',
    originalTransactionId: activePayload.originalTransactionId,
    signedDate: renewalTime,
    expiresDate: now + 60 * 24 * 60 * 60 * 1000
  });
  const renewalTx = jws(renewalTxPayload);
  const renewalUuid = '11111111-1111-4111-8111-111111111111';
  const renewalOuter = jws(notificationPayload({
    signedTransactionInfo: renewalTx, notificationUUID: renewalUuid,
    notificationType: 'DID_RENEW', signedDate: renewalTime
  }));
  const renewal = apple.verifiers.apple.webhook({ body: { signedPayload: renewalOuter } });
  assert.equal(renewal.eventId, renewalUuid);
  assert.equal(renewal.status, 'active');
  const renewalApplied = applyVerifiedEntitlement(db, renewal);
  assert.equal(renewalApplied.stale, false);
  assert.equal(renewalApplied.snapshot.plan, 'premium');
  assert.equal(applyVerifiedEntitlement(db, renewal).replayed, true, 'notificationUUID must de-duplicate delivery');

  const refundTime = now + 10_000;
  const refundTx = jws(transactionPayload({
    appAccountToken: bootstrap.appAccountToken,
    transactionId: '200000000000011',
    originalTransactionId: activePayload.originalTransactionId,
    signedDate: refundTime,
    revocationDate: refundTime,
    expiresDate: now + 60 * 24 * 60 * 60 * 1000
  }));
  const refund = apple.verifiers.apple.webhook({ body: { signedPayload: jws(notificationPayload({
    signedTransactionInfo: refundTx,
    notificationUUID: '22222222-2222-4222-8222-222222222222',
    notificationType: 'REFUND', signedDate: refundTime
  })) } });
  const refundApplied = applyVerifiedEntitlement(db, refund);
  assert.equal(refundApplied.snapshot.status, 'revoked');
  assert.equal(refundApplied.snapshot.plan, 'free');

  // A delayed older renewal after a newer refund is valid Apple-signed data, but
  // must be recorded as stale rather than resurrecting Premium.
  const lateOld = apple.verifiers.apple.webhook({ body: { signedPayload: jws(notificationPayload({
    signedTransactionInfo: renewalTx,
    notificationUUID: '33333333-3333-4333-8333-333333333333',
    notificationType: 'DID_RENEW', signedDate: renewalTime
  })) } });
  const stale = applyVerifiedEntitlement(db, lateOld);
  assert.equal(stale.stale, true);
  assert.equal(stale.snapshot.status, 'revoked');
  assert.equal(stale.snapshot.plan, 'free');

  const badBundleOuter = jws(notificationPayload({
    signedTransactionInfo: renewalTx,
    notificationUUID: '44444444-4444-4444-8444-444444444444',
    bundleId: 'com.attacker.app'
  }));
  await assert.rejects(async () => apple.verifiers.apple.webhook({ body: { signedPayload: badBundleOuter } }),
    error => error?.code === 'APPLE_APP_MISMATCH');

  const badAppIdOuter = jws(notificationPayload({
    signedTransactionInfo: renewalTx,
    notificationUUID: '55555555-5555-4555-8555-555555555555',
    appAppleId: 999
  }));
  await assert.rejects(async () => apple.verifiers.apple.webhook({ body: { signedPayload: badAppIdOuter } }),
    error => error?.code === 'APPLE_APP_MISMATCH');

  await assert.rejects(async () => apple.verifiers.apple.restore({ accountId: 'acct-apple-a', body: { transactions: [] } }),
    error => error?.code === 'APPLE_NO_VERIFIED_ENTITLEMENT');

  console.log('PASS — Apple ES256/x5c verification, appAccountToken binding, device transaction, restore, notification replay and stale-event suppression are enforced.');
} finally {
  db.close();
  rmSync(dir, { recursive: true, force: true });
  for (const name of envNames) {
    if (previous[name] === undefined) delete process.env[name];
    else process.env[name] = previous[name];
  }
}
