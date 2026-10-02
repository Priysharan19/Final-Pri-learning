// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · StoreKit entitlement state machine (§19, V1 hard blocker #7)
//
//   node server/test/storekit-entitlement-state-machine-check.mjs                    (SQLite)
//   node server/test/storekit-entitlement-state-machine-check.mjs --engine=postgres  (scripts/with-postgres.mjs)
//
// Claim under test: the Premium entitlement always derives from authoritative,
// Apple-signed payment state — across retries, duplicates, cancellation,
// expiry, refunds, upgrades, restores, account switches and reordering.
//
// Every fixture is a real ES256/x5c JWS signed by a throwaway test chain this
// process generates (support/apple-signing.mjs) and trusts only through its own
// PRI_APPLE_ROOT_CA_PEM. Production trust roots are not touched and Apple is
// never contacted. Each scenario asserts the resulting entitlement AND its
// audit trail: the billing_events row, the verified signed-data ledger row,
// and what an operator's reconciliation recomputes from that ledger.
//
// Part 1 drives the verifiers and applyVerifiedEntitlement directly on a
// simulated clock (renewals a month apart). Part 2 drives the same flows over
// HTTP through the production app (session, CSRF, webhook route, native-client
// checkout refusal). Part 3 runs the operator reconciliation CLI (SQLite).
// ─────────────────────────────────────────────────────────────────────────────
import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createAppleSigner } from './support/apple-signing.mjs';
import { openTestStore, requestedEngine } from './support/engine.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const MONTHLY = 'com.prilearning.premium.monthly';
const ANNUAL = 'com.prilearning.premium.annual';
const BUNDLE = 'com.prilearning.app';
const APP_ID = 1234567890;
const DAY = 24 * 60 * 60 * 1000;

const signer = createAppleSigner();
const APPLE_ENV = {
  PRI_APPLE_ROOT_CA_PEM: signer.rootPem,
  PRI_APPLE_APP_ID: String(APP_ID),
  PRI_APPLE_BUNDLE_ID: BUNDLE,
  PRI_APPLE_MONTHLY_PRODUCT_ID: MONTHLY,
  PRI_APPLE_ANNUAL_PRODUCT_ID: ANNUAL,
  PRI_APPLE_ENVIRONMENTS: 'Production',
  PRI_APPLE_ALLOW_SANDBOX: ''
};
const previousEnv = Object.fromEntries(Object.keys(APPLE_ENV).concat('PRI_APPLE_ROOT_CA_FILE').map(name => [name, process.env[name]]));
Object.assign(process.env, APPLE_ENV);
delete process.env.PRI_APPLE_ROOT_CA_FILE;

const { createAppleBilling } = await import('../platform/appleBilling.js');
const { applyVerifiedEntitlement, publicEntitlement, supportGrantEventId } = await import('../platform/entitlements.js');
const { reconcileAppleAccount } = await import('../platform/billingReconcile.js');
const { tutorDailyLimit } = await import('../platform/tutor.js');

let checks = 0;
const failures = [];
function ok(condition, label) { checks++; if (!condition) failures.push(label); }
function eq(actual, expected, label) { ok(actual === expected, `${label} (expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)})`); }
async function rejectsWith(fn, code, label) {
  try { await fn(); ok(false, `${label} (did not reject)`); }
  catch (error) { eq(error?.code, code, label); }
}

// ── Fixture builders ─────────────────────────────────────────────────────────
const T0 = Date.now() + 1000;
let txSerial = 300_000_000_000_000;
let origSerial = 100_000_000_000_000;
const nextTxId = () => String(++txSerial);
const nextOriginal = () => String(++origSerial);

function tx({ token, original, id = nextTxId(), product = MONTHLY, signedDate, expires, revoked = null, upgraded = false, environment = 'Production', bundleId = BUNDLE }) {
  return {
    transactionId: id, originalTransactionId: original, productId: product, appAccountToken: token,
    bundleId, environment, purchaseDate: signedDate - 1000, originalPurchaseDate: signedDate - 1000,
    expiresDate: expires, signedDate, type: 'Auto-Renewable Subscription', inAppOwnershipType: 'PURCHASED',
    revocationDate: revoked, ...(upgraded ? { isUpgraded: true } : {})
  };
}

function renewalInfo({ original, signedDate, graceUntil = null, environment = 'Production', product = MONTHLY, autoRenew = 1 }) {
  return {
    originalTransactionId: original, autoRenewProductId: product, productId: product, autoRenewStatus: autoRenew,
    environment, signedDate, ...(graceUntil ? { gracePeriodExpiresDate: graceUntil, isInBillingRetryPeriod: true } : {})
  };
}

function notification({ type, subtype = null, signedDate, transaction, renewal = null, uuid = randomUUID(), environment = 'Production', bundleId = BUNDLE, appAppleId = APP_ID, chain }) {
  const signedTransactionInfo = signer.jws(transaction, chain ? { chain } : undefined);
  const signedRenewalInfo = renewal ? signer.jws(renewal) : undefined;
  const payload = {
    notificationType: type, subtype, notificationUUID: uuid, version: '2.0', signedDate,
    data: { appAppleId, bundleId, environment, signedTransactionInfo, ...(signedRenewalInfo ? { signedRenewalInfo } : {}) }
  };
  return { signedPayload: signer.jws(payload, chain ? { chain } : undefined), uuid };
}

// ── Part 1: the state machine on a simulated clock ───────────────────────────
const engine = requestedEngine();
const testStore = await openTestStore(engine, { label: 'storekit' });
const db = testStore.store;
let clock = T0;
const apple = createAppleBilling(db, { clock: () => clock });

async function newAccount(label) {
  const id = `acct-sk-${label}`;
  await db.run(`INSERT INTO accounts(id,email,name,password_hash,role,created_at,updated_at) VALUES (?,?,?,'hash','student',?,?)`,
    [id, `${label}@storekit.example.test`, label, T0, T0]);
  await db.run(`INSERT INTO entitlement_snapshots(account_id,plan,status,provider,source_version,updated_at) VALUES (?,'free','free','none',0,?)`, [id, T0]);
  const { appAccountToken } = await apple.native.apple.bootstrap({ accountId: id });
  return { id, token: appAccountToken };
}

async function entitlement(accountId, at = clock) {
  return publicEntitlement(await db.get('SELECT * FROM entitlement_snapshots WHERE account_id=?', [accountId]), at);
}
const version = async accountId => Number((await db.get('SELECT source_version FROM entitlement_snapshots WHERE account_id=?', [accountId])).source_version);

/** Device path: StoreKit hands the app a signed transaction, the app submits it. */
async function device(account, payload, { restore = false } = {}) {
  const signed = signer.jws(payload);
  const result = restore
    ? await apple.verifiers.apple.restore({ accountId: account.id, body: { transactions: [signed] } })
    : await apple.native.apple.transaction({ accountId: account.id, body: { signedTransaction: signed } });
  return { signed, result, applied: await applyVerifiedEntitlement(db, result) };
}

/** Webhook path: an App Store Server Notification v2 delivery. */
async function deliver(signedPayload) {
  const result = await apple.verifiers.apple.webhook({ body: { signedPayload } });
  if (Array.isArray(result)) return { result, applied: null };
  return { result, applied: await applyVerifiedEntitlement(db, result) };
}

async function auditRow(eventId) {
  return db.get('SELECT provider,account_id,event_type,verified,applied_at FROM billing_events WHERE provider=? AND event_id=?', ['apple', eventId]);
}
async function ledgerRow(eventId) {
  return db.get('SELECT kind,account_id,original_transaction_id,notification_type FROM billing_apple_signed_events WHERE event_id=?', [eventId]);
}
async function reconciled(accountId, label, at = clock) {
  const report = await reconcileAppleAccount(db, accountId, { now: at });
  ok(report.ok, `${label}: reconciliation from the signed ledger finds no drift (${JSON.stringify(report.drift)})`);
  return report;
}

try {
  // ── S1 purchase → active → renewal → lapse by time ─────────────────────────
  {
    const a = await newAccount('s1');
    const original = nextOriginal();
    const purchase = await device(a, tx({ token: a.token, original, signedDate: T0, expires: T0 + 30 * DAY }));
    eq(purchase.applied.snapshot.plan, 'premium', 'S1 purchase: Premium is active');
    eq(purchase.applied.snapshot.provider, 'apple', 'S1 purchase: provider is apple');
    const audit = await auditRow(purchase.result.eventId);
    ok(audit && audit.verified === 1 && audit.applied_at && audit.event_type === 'transaction.device' && audit.account_id === a.id, 'S1 purchase: billing_events records the verified, applied device transaction for the account');
    const ledger = await ledgerRow(purchase.result.eventId);
    ok(ledger?.kind === 'transaction' && ledger.account_id === a.id && ledger.original_transaction_id === original, 'S1 purchase: the signed transaction is kept in the verified ledger');

    clock = T0 + 30 * DAY - 60_000;
    const renewTx = tx({ token: a.token, original, signedDate: clock, expires: T0 + 60 * DAY });
    const renew = await deliver(notification({ type: 'DID_RENEW', signedDate: clock, transaction: renewTx }).signedPayload);
    eq(renew.applied.stale, false, 'S1 renewal: DID_RENEW applies');
    eq(renew.applied.snapshot.currentPeriodEnd, T0 + 60 * DAY, 'S1 renewal: the period moves to the renewed expiresDate');
    eq((await ledgerRow(`n:${renew.result.eventId}`))?.notification_type, 'DID_RENEW', 'S1 renewal: the notification is kept in the verified ledger');
    eq((await entitlement(a.id, T0 + 45 * DAY)).plan, 'premium', 'S1 renewal: Premium mid-way through the renewed period');
    await reconciled(a.id, 'S1', T0 + 45 * DAY);
    eq((await entitlement(a.id, T0 + 61 * DAY)).plan, 'free', 'S1 lapse: with no further event Premium ends at the period end (time bound, no notification needed)');
    await reconciled(a.id, 'S1 after lapse', T0 + 61 * DAY);
  }

  // ── S2 billing retry: grace period, recovery, grace expiry, no-grace failure ─
  {
    clock = T0;
    const a = await newAccount('s2');
    const original = nextOriginal();
    const first = tx({ token: a.token, original, signedDate: T0, expires: T0 + 30 * DAY });
    await device(a, first);
    clock = T0 + 30 * DAY + 60_000;
    const grace = await deliver(notification({
      type: 'DID_FAIL_TO_RENEW', subtype: 'GRACE_PERIOD', signedDate: clock,
      transaction: { ...first, signedDate: clock }, renewal: renewalInfo({ original, signedDate: clock, graceUntil: T0 + 36 * DAY })
    }).signedPayload);
    eq(grace.applied.snapshot.status, 'grace', 'S2 grace: billing retry with a grace period is status grace');
    eq(grace.applied.snapshot.plan, 'premium', 'S2 grace: Premium continues inside the grace period');
    eq(grace.applied.snapshot.graceUntil, T0 + 36 * DAY, 'S2 grace: graceUntil comes from Apple-signed renewal info');

    // Regression (defect D3): a restore during grace submits the lapsed
    // transaction (its expiresDate is in the past). It used to apply as
    // "expired" and cut a paying student off mid-grace.
    clock = T0 + 33 * DAY;
    const lapsed = await device(a, { ...first, signedDate: clock }, { restore: true });
    eq(lapsed.result.advisory, true, 'S2 grace: a lapsed transaction from the device is advisory');
    eq(lapsed.applied.superseded, 'advisory', 'S2 grace: it does not end the grace period');
    eq((await entitlement(a.id)).plan, 'premium', 'S2 grace: Premium survives a restore during grace');

    clock = T0 + 35 * DAY;
    const recovered = await deliver(notification({
      type: 'DID_RENEW', subtype: 'BILLING_RECOVERY', signedDate: clock,
      transaction: tx({ token: a.token, original, signedDate: clock, expires: T0 + 65 * DAY })
    }).signedPayload);
    eq(recovered.applied.snapshot.status, 'active', 'S2 recovery: DID_RENEW:BILLING_RECOVERY restores active');
    eq(recovered.applied.snapshot.currentPeriodEnd, T0 + 65 * DAY, 'S2 recovery: with the recovered period');
    await reconciled(a.id, 'S2 recovery');

    // Grace that runs out.
    clock = T0;
    const b = await newAccount('s2b');
    const ob = nextOriginal();
    const bt = tx({ token: b.token, original: ob, signedDate: T0, expires: T0 + 30 * DAY });
    await device(b, bt);
    clock = T0 + 30 * DAY + 1000;
    await deliver(notification({ type: 'DID_FAIL_TO_RENEW', subtype: 'GRACE_PERIOD', signedDate: clock, transaction: { ...bt, signedDate: clock }, renewal: renewalInfo({ original: ob, signedDate: clock, graceUntil: T0 + 36 * DAY }) }).signedPayload);
    eq((await entitlement(b.id, T0 + 37 * DAY)).plan, 'free', 'S2 grace expiry: Premium ends at graceUntil even before Apple says so');
    clock = T0 + 36 * DAY + 1000;
    const gone = await deliver(notification({ type: 'GRACE_PERIOD_EXPIRED', signedDate: clock, transaction: { ...bt, signedDate: clock } }).signedPayload);
    eq(gone.applied.snapshot.status, 'expired', 'S2 grace expiry: GRACE_PERIOD_EXPIRED is expired');
    eq(gone.applied.snapshot.plan, 'free', 'S2 grace expiry: and free');
    await reconciled(b.id, 'S2 grace expiry');

    // Billing retry with no grace period configured: no access.
    clock = T0;
    const c = await newAccount('s2c');
    const oc = nextOriginal();
    const ct = tx({ token: c.token, original: oc, signedDate: T0, expires: T0 + 30 * DAY });
    await device(c, ct);
    clock = T0 + 30 * DAY + 1000;
    const failed = await deliver(notification({ type: 'DID_FAIL_TO_RENEW', signedDate: clock, transaction: { ...ct, signedDate: clock }, renewal: renewalInfo({ original: oc, signedDate: clock }) }).signedPayload);
    eq(failed.applied.snapshot.status, 'past_due', 'S2 no-grace: DID_FAIL_TO_RENEW without a grace period is past_due');
    eq(failed.applied.snapshot.plan, 'free', 'S2 no-grace: and not entitled');

    // Regression (defect D4): Apple first reports a billing failure without
    // grace (past_due), the device then submits the lapsed transaction
    // (signed later), and Apple's grace notification — signed between the two
    // — arrives last. The advisory device event used to advance the ordering
    // clock and make the authoritative grace notification "stale".
    clock = T0;
    const d = await newAccount('s2d');
    const od = nextOriginal();
    const dt = tx({ token: d.token, original: od, signedDate: T0, expires: T0 + 30 * DAY });
    await device(d, dt);
    clock = T0 + 30 * DAY + 60_000;
    await deliver(notification({ type: 'DID_FAIL_TO_RENEW', signedDate: clock, transaction: { ...dt, signedDate: clock } }).signedPayload);
    eq((await entitlement(d.id)).status, 'past_due', 'S2 reorder: billing failure first');
    clock = T0 + 30 * DAY + 5 * 60_000;
    const early = await device(d, { ...dt, signedDate: clock });
    eq(early.applied.snapshot.status, 'expired', 'S2 reorder: the lapsed device transaction (signed later) applies over a non-paid state');
    const graceAt = T0 + 30 * DAY + 2 * 60_000;
    const lateGrace = await deliver(notification({ type: 'DID_FAIL_TO_RENEW', subtype: 'GRACE_PERIOD', signedDate: graceAt, transaction: { ...dt, signedDate: graceAt }, renewal: renewalInfo({ original: od, signedDate: graceAt, graceUntil: T0 + 36 * DAY }) }).signedPayload);
    eq(lateGrace.applied.stale, false, 'S2 reorder: the older, authoritative grace notification still applies');
    eq((await entitlement(d.id)).status, 'grace', 'S2 reorder: the account is in grace');
    eq((await entitlement(d.id)).plan, 'premium', 'S2 reorder: and entitled');
    await reconciled(d.id, 'S2 reorder');
  }

  // ── S3 voluntary cancellation: auto-renew off → active to period end → expired
  {
    clock = T0;
    const a = await newAccount('s3');
    const original = nextOriginal();
    const t = tx({ token: a.token, original, signedDate: T0, expires: T0 + 30 * DAY });
    await device(a, t);
    clock = T0 + 10 * DAY;
    const off = notification({ type: 'DID_CHANGE_RENEWAL_STATUS', subtype: 'AUTO_RENEW_DISABLED', signedDate: clock, transaction: { ...t, signedDate: clock }, renewal: renewalInfo({ original, signedDate: clock, autoRenew: 0 }) });
    const cancelled = await deliver(off.signedPayload);
    eq(cancelled.applied.snapshot.status, 'active', 'S3 cancel: turning auto-renew off keeps the subscription active');
    eq((await entitlement(a.id, T0 + 29 * DAY)).plan, 'premium', 'S3 cancel: Premium until the paid period ends');
    const before = await version(a.id);
    const dup = await deliver(off.signedPayload);
    eq(dup.applied.replayed, true, 'S3 duplicate: the same notification delivered again is a replay');
    eq(await version(a.id), before, 'S3 duplicate: and changes nothing');
    clock = T0 + 30 * DAY + 1000;
    const expired = await deliver(notification({ type: 'EXPIRED', subtype: 'VOLUNTARY', signedDate: clock, transaction: { ...t, signedDate: clock } }).signedPayload);
    eq(expired.applied.snapshot.status, 'expired', 'S3 expiry: EXPIRED:VOLUNTARY ends the subscription');
    eq(expired.applied.snapshot.plan, 'free', 'S3 expiry: free');
    // A redelivery of the cancellation under a new id, signed earlier, is stale.
    const lateOff = await deliver(notification({ type: 'DID_CHANGE_RENEWAL_STATUS', subtype: 'AUTO_RENEW_DISABLED', signedDate: T0 + 10 * DAY, transaction: { ...t, signedDate: T0 + 10 * DAY } }).signedPayload);
    eq(lateOff.applied.stale, true, 'S3 out-of-order: an older notification after expiry is stale');
    eq((await entitlement(a.id)).plan, 'free', 'S3 out-of-order: and does not resurrect Premium');
    await reconciled(a.id, 'S3');
    // Resubscribe later: same originalTransactionId, new transaction.
    clock = T0 + 40 * DAY;
    const back = await deliver(notification({ type: 'SUBSCRIBED', subtype: 'RESUBSCRIBE', signedDate: clock, transaction: tx({ token: a.token, original, signedDate: clock, expires: T0 + 70 * DAY }) }).signedPayload);
    eq(back.applied.snapshot.plan, 'premium', 'S3 resubscribe: a newer SUBSCRIBED:RESUBSCRIBE restores Premium');
    await reconciled(a.id, 'S3 resubscribe');
  }

  // ── S4 refund / revocation: immediate loss; reversal ───────────────────────
  {
    clock = T0;
    const a = await newAccount('s4');
    const original = nextOriginal();
    const t = tx({ token: a.token, original, signedDate: T0, expires: T0 + 30 * DAY });
    await device(a, t);
    clock = T0 + 5 * DAY;
    const refund = await deliver(notification({ type: 'REFUND', signedDate: clock, transaction: { ...t, signedDate: clock, revocationDate: clock } }).signedPayload);
    eq(refund.applied.snapshot.status, 'revoked', 'S4 refund: REFUND revokes');
    eq(refund.applied.snapshot.plan, 'free', 'S4 refund: Premium is lost immediately, before the period end');
    const lateRenew = await deliver(notification({ type: 'DID_RENEW', signedDate: T0 + 1000, transaction: { ...t, signedDate: T0 + 1000 } }).signedPayload);
    eq(lateRenew.applied.stale, true, 'S4 out-of-order: a delayed older DID_RENEW after the refund is stale');
    eq((await entitlement(a.id)).plan, 'free', 'S4 out-of-order: no resurrection');
    clock = T0 + 6 * DAY;
    const reversed = await deliver(notification({ type: 'REFUND_REVERSED', signedDate: clock, transaction: { ...t, signedDate: clock } }).signedPayload);
    eq(reversed.applied.snapshot.plan, 'premium', 'S4 reversal: REFUND_REVERSED restores Premium');
    clock = T0 + 7 * DAY;
    const revoke = await deliver(notification({ type: 'REVOKE', signedDate: clock, transaction: { ...t, signedDate: clock, revocationDate: clock } }).signedPayload);
    eq(revoke.applied.snapshot.status, 'revoked', 'S4 REVOKE (Family Sharing) revokes');
    await reconciled(a.id, 'S4');

    // Regression (defect D1): the webhook is lost; the device later submits
    // the SAME transaction re-signed with revocationDate. Keyed on
    // transactionId alone, that was a "replay" of the purchase and ignored.
    clock = T0;
    const b = await newAccount('s4b');
    const ob = nextOriginal();
    const bt = tx({ token: b.token, original: ob, signedDate: T0, expires: T0 + 30 * DAY });
    await device(b, bt);
    clock = T0 + 3 * DAY;
    const resigned = await device(b, { ...bt, signedDate: clock, revocationDate: clock });
    eq(resigned.applied.replayed, false, 'S4 device revocation: a re-signed transaction is a new event, not a replay');
    eq(resigned.applied.snapshot.status, 'revoked', 'S4 device revocation: the refund the device reports revokes Premium');
    await reconciled(b.id, 'S4 device revocation');
  }

  // ── S5 upgrade / downgrade within the subscription group ───────────────────
  {
    clock = T0;
    const a = await newAccount('s5');
    const original = nextOriginal();
    const monthly = tx({ token: a.token, original, signedDate: T0, expires: T0 + 30 * DAY });
    await device(a, monthly);
    clock = T0 + 2 * DAY;
    const annual = tx({ token: a.token, original, product: ANNUAL, signedDate: clock, expires: T0 + 367 * DAY });
    const up = await deliver(notification({ type: 'DID_CHANGE_RENEWAL_PREF', subtype: 'UPGRADE', signedDate: clock, transaction: annual }).signedPayload);
    eq(up.applied.snapshot.productId, ANNUAL, 'S5 upgrade: the annual product is now the entitlement');
    eq(up.applied.snapshot.currentPeriodEnd, T0 + 367 * DAY, 'S5 upgrade: with the annual period');
    // Regression (defect D5): Transaction.updates then delivers the old monthly
    // transaction marked isUpgraded, signed after the upgrade. It used to apply
    // as "expired" and remove the annual Premium the student just paid for.
    clock = T0 + 2 * DAY + 60_000;
    const superseded = await device(a, { ...monthly, signedDate: clock, isUpgraded: true });
    eq(superseded.applied.superseded, 'advisory', 'S5 upgrade: the superseded monthly transaction is advisory');
    eq((await entitlement(a.id)).plan, 'premium', 'S5 upgrade: Premium is kept');
    eq((await entitlement(a.id)).productId, ANNUAL, 'S5 upgrade: still on the annual product');
    clock = T0 + 20 * DAY;
    const down = await deliver(notification({ type: 'DID_CHANGE_RENEWAL_PREF', subtype: 'DOWNGRADE', signedDate: clock, transaction: { ...annual, signedDate: clock }, renewal: renewalInfo({ original, signedDate: clock, product: MONTHLY }) }).signedPayload);
    eq(down.applied.snapshot.productId, ANNUAL, 'S5 downgrade: the downgrade takes effect at renewal; the current product stays');
    eq(down.applied.snapshot.plan, 'premium', 'S5 downgrade: Premium continues to the annual period end');
    await reconciled(a.id, 'S5');
  }

  // ── S6 restore on a new device / reinstall ─────────────────────────────────
  {
    clock = T0;
    const a = await newAccount('s6');
    const original = nextOriginal();
    const t = tx({ token: a.token, original, signedDate: T0, expires: T0 + 30 * DAY });
    const bought = await device(a, t);
    // New iPad: the server state survives; restore re-proves the purchase.
    await db.run("UPDATE entitlement_snapshots SET plan='free',status='free',provider='none',current_period_end=NULL,offline_until=NULL WHERE account_id=?", [a.id]);
    const restored = await apple.verifiers.apple.restore({ accountId: a.id, body: { transactions: [bought.signed] } });
    eq(restored.eventType, 'transaction.restore', 'S6 restore: event type is restore');
    const re = await applyVerifiedEntitlement(db, restored);
    eq(re.replayed, true, 'S6 restore: the identical signed transaction is an idempotent replay');
    clock = T0 + 1 * DAY;
    const fresh = await device(a, { ...t, signedDate: clock }, { restore: true });
    eq(fresh.applied.snapshot.plan, 'premium', 'S6 reinstall: a freshly signed transaction from AppStore.sync() restores Premium');
    // Regression (defect D2): restore with a revoked transaction whose
    // expiresDate is later than the live one used to pick the revoked one.
    const oldOriginal = nextOriginal();
    const revokedOld = signer.jws(tx({ token: a.token, original: oldOriginal, product: ANNUAL, signedDate: clock, expires: T0 + 300 * DAY, revoked: clock - DAY }));
    const live = signer.jws(tx({ token: a.token, original, signedDate: clock + 1, expires: T0 + 30 * DAY }));
    const pick = await apple.verifiers.apple.restore({ accountId: a.id, body: { transactions: [revokedOld, live] } });
    eq(pick.plan, 'premium', 'S6 restore: a paid transaction wins over a revoked one with a later expiry');
    eq(pick.providerSubscriptionId, original, 'S6 restore: the live subscription is the one applied');
    await applyVerifiedEntitlement(db, pick);
    eq((await entitlement(a.id)).plan, 'premium', 'S6 restore: Premium after mixed restore');
  }

  // ── S7 account switch on one iPad (same Apple ID, different Pri accounts) ──
  {
    clock = T0;
    const a = await newAccount('s7a');
    const b = await newAccount('s7b');
    ok(a.token !== b.token, 'S7: each Pri account has its own appAccountToken');
    const original = nextOriginal();
    const t = tx({ token: a.token, original, signedDate: T0, expires: T0 + 30 * DAY });
    const bought = await device(a, t);
    const eventsBefore = (await db.all('SELECT event_id FROM billing_events WHERE account_id=?', [b.id])).length;
    await rejectsWith(() => apple.native.apple.transaction({ accountId: b.id, body: { signedTransaction: bought.signed } }), 'APPLE_ACCOUNT_TOKEN_MISMATCH', 'S7 switch: B cannot claim A\'s purchase from Transaction.updates');
    await rejectsWith(() => apple.verifiers.apple.restore({ accountId: b.id, body: { transactions: [bought.signed] } }), 'APPLE_NO_VERIFIED_ENTITLEMENT', 'S7 switch: B\'s restore on the same Apple ID finds nothing for B');
    eq((await entitlement(b.id)).plan, 'free', 'S7 switch: Premium does not leak to B');
    eq((await db.all('SELECT event_id FROM billing_events WHERE account_id=?', [b.id])).length, eventsBefore, 'S7 switch: no billing event is recorded for B');
    eq((await db.all('SELECT event_id FROM billing_apple_signed_events WHERE account_id=?', [b.id])).length, 0, 'S7 switch: no signed data is filed under B');
    // B buys under the same Apple ID: StoreKit crossgrades inside the same
    // subscription group (same originalTransactionId) with B's token.
    clock = T0 + DAY;
    const crossgrade = tx({ token: b.token, original, product: ANNUAL, signedDate: clock, expires: T0 + 366 * DAY });
    await rejectsWith(() => apple.native.apple.transaction({ accountId: b.id, body: { signedTransaction: signer.jws(crossgrade) } }), 'BILLING_ACCOUNT_MISMATCH', 'S7 switch: a subscription bound to A cannot be re-bound to B');
    await rejectsWith(() => deliver(notification({ type: 'DID_CHANGE_RENEWAL_PREF', subtype: 'UPGRADE', signedDate: clock, transaction: crossgrade }).signedPayload), 'BILLING_ACCOUNT_MISMATCH', 'S7 switch: nor through a notification');
    eq((await entitlement(b.id)).plan, 'free', 'S7 switch: B stays free');
    eq((await entitlement(a.id)).plan, 'premium', 'S7 switch: A keeps its Premium');
    await reconciled(a.id, 'S7 A');
    await reconciled(b.id, 'S7 B');
  }

  // ── S8 duplicate deliveries racing ─────────────────────────────────────────
  {
    clock = T0;
    const a = await newAccount('s8');
    const original = nextOriginal();
    await device(a, tx({ token: a.token, original, signedDate: T0, expires: T0 + 30 * DAY }));
    clock = T0 + 30 * DAY - 1000;
    const renewal = notification({ type: 'DID_RENEW', signedDate: clock, transaction: tx({ token: a.token, original, signedDate: clock, expires: T0 + 60 * DAY }) });
    const before = await version(a.id);
    const results = await Promise.all(Array.from({ length: 5 }, () => deliver(renewal.signedPayload)));
    eq(results.filter(r => !r.applied.replayed).length, 1, 'S8 duplicates: five concurrent deliveries apply exactly once');
    eq(await version(a.id), before + 1, 'S8 duplicates: the entitlement version moves by one');
    eq((await db.all('SELECT event_id FROM billing_events WHERE provider=? AND event_id=?', ['apple', renewal.uuid])).length, 1, 'S8 duplicates: one audit row');
    eq((await db.all('SELECT event_id FROM billing_apple_signed_events WHERE event_id=?', [`n:${renewal.uuid}`])).length, 1, 'S8 duplicates: one ledger row');
  }

  // ── S9 out-of-order: EXPIRED before the older DID_RENEW ─────────────────────
  {
    clock = T0;
    const a = await newAccount('s9');
    const original = nextOriginal();
    const t = tx({ token: a.token, original, signedDate: T0, expires: T0 + 30 * DAY });
    await device(a, t);
    clock = T0 + 31 * DAY;
    await deliver(notification({ type: 'EXPIRED', subtype: 'AUTO_RENEW_DISABLED', signedDate: clock, transaction: { ...t, signedDate: clock } }).signedPayload);
    const older = await deliver(notification({ type: 'DID_RENEW', signedDate: T0 + 29 * DAY, transaction: tx({ token: a.token, original, signedDate: T0 + 29 * DAY, expires: T0 + 59 * DAY }) }).signedPayload);
    eq(older.applied.stale, true, 'S9 reorder: an older DID_RENEW arriving after EXPIRED is stale');
    eq((await entitlement(a.id)).status, 'expired', 'S9 reorder: the newer signed state stands');
    // Equal signed time: the higher-ranked statement wins regardless of order.
    clock = T0 + 40 * DAY;
    const sameTime = T0 + 40 * DAY;
    await deliver(notification({ type: 'REFUND', signedDate: sameTime, transaction: { ...t, signedDate: sameTime, revocationDate: sameTime } }).signedPayload);
    const tie = await deliver(notification({ type: 'DID_RENEW', signedDate: sameTime, transaction: tx({ token: a.token, original, signedDate: sameTime, expires: T0 + 70 * DAY }) }).signedPayload);
    eq(tie.applied.stale, true, 'S9 tie: a DID_RENEW signed in the same millisecond as a REFUND loses to it');
    eq((await entitlement(a.id)).status, 'revoked', 'S9 tie: revoked');
    await reconciled(a.id, 'S9');
  }

  // ── S10 replayed notification after the state moved on ─────────────────────
  {
    clock = T0;
    const a = await newAccount('s10');
    const original = nextOriginal();
    const t = tx({ token: a.token, original, signedDate: T0, expires: T0 + 30 * DAY });
    const sub = notification({ type: 'SUBSCRIBED', subtype: 'INITIAL_BUY', signedDate: T0, transaction: t });
    await deliver(sub.signedPayload);
    clock = T0 + 2 * DAY;
    await deliver(notification({ type: 'REFUND', signedDate: clock, transaction: { ...t, signedDate: clock, revocationDate: clock } }).signedPayload);
    const replay = await deliver(sub.signedPayload);
    eq(replay.applied.replayed, true, 'S10 replay: an attacker re-posting a captured SUBSCRIBED payload is a replay');
    eq((await entitlement(a.id)).plan, 'free', 'S10 replay: it cannot restore Premium');
  }

  // ── S11 notification for no / an unknown account ──────────────────────────
  {
    clock = T0 + DAY;
    const before = (await db.all('SELECT event_id FROM billing_events')).length;
    const strangerToken = randomUUID();
    const unknown = notification({ type: 'SUBSCRIBED', subtype: 'INITIAL_BUY', signedDate: clock, transaction: tx({ token: strangerToken, original: nextOriginal(), signedDate: clock, expires: clock + 30 * DAY }) });
    const result = await deliver(unknown.signedPayload);
    ok(Array.isArray(result.result) && result.result.length === 0, 'S11 unknown token: acknowledged with no entitlement change (Apple stops retrying)');
    const row = await ledgerRow(`n:${unknown.uuid}`);
    ok(row && row.account_id === null, 'S11 unknown token: kept in the ledger with no account for the operator');
    const noToken = notification({ type: 'OFFER_REDEEMED', signedDate: clock, transaction: { ...tx({ token: undefined, original: nextOriginal(), signedDate: clock, expires: clock + 30 * DAY }) } });
    const r2 = await deliver(noToken.signedPayload);
    ok(Array.isArray(r2.result) && r2.result.length === 0, 'S11 no token: an App Store offer-code redemption naming no account changes nothing');
    eq((await db.all('SELECT event_id FROM billing_events')).length, before, 'S11: no billing event is attributed to any account');
  }

  // ── S12 forged / invalid signatures ────────────────────────────────────────
  {
    clock = T0;
    const a = await newAccount('s12');
    const original = nextOriginal();
    const t = tx({ token: a.token, original, signedDate: T0, expires: T0 + 30 * DAY });
    const ledgerBefore = (await db.all('SELECT event_id FROM billing_apple_signed_events')).length;
    const good = notification({ type: 'SUBSCRIBED', signedDate: T0, transaction: t });
    const [h, p, s] = good.signedPayload.split('.');
    const flipped = `${h}.${p}.${s.slice(0, -4)}${s.slice(-4) === 'AAAA' ? 'BBBB' : 'AAAA'}`;
    await rejectsWith(() => deliver(flipped), 'APPLE_JWS_SIGNATURE_INVALID', 'S12 forged: a tampered outer signature is refused');
    const swapped = JSON.parse(Buffer.from(p, 'base64url').toString());
    swapped.notificationType = 'REFUND_REVERSED';
    await rejectsWith(() => deliver(`${h}.${Buffer.from(JSON.stringify(swapped)).toString('base64url')}.${s}`), 'APPLE_JWS_SIGNATURE_INVALID', 'S12 forged: an edited payload under the original signature is refused');
    await rejectsWith(() => deliver(notification({ type: 'SUBSCRIBED', signedDate: T0, transaction: t, chain: signer.rogue }).signedPayload), 'APPLE_CERTIFICATE_CHAIN_INVALID', 'S12 forged: a chain from an untrusted root is refused');
    await rejectsWith(() => apple.native.apple.transaction({ accountId: a.id, body: { signedTransaction: signer.jws(t, { chain: signer.rogue }) } }), 'APPLE_CERTIFICATE_CHAIN_INVALID', 'S12 forged: a device transaction from an untrusted root is refused');
    // Valid outer notification wrapping an inner transaction signed by the rogue chain.
    const innerForged = {
      notificationType: 'SUBSCRIBED', notificationUUID: randomUUID(), version: '2.0', signedDate: T0,
      data: { appAppleId: APP_ID, bundleId: BUNDLE, environment: 'Production', signedTransactionInfo: signer.jws(t, { chain: signer.rogue }) }
    };
    await rejectsWith(() => deliver(signer.jws(innerForged)), 'APPLE_CERTIFICATE_CHAIN_INVALID', 'S12 forged: a genuine outer envelope cannot carry a forged inner transaction');
    await rejectsWith(() => deliver(notification({ type: 'DID_RENEW', signedDate: T0, transaction: t, renewal: renewalInfo({ original: nextOriginal(), signedDate: T0 }) }).signedPayload), 'APPLE_NOTIFICATION_MISMATCH', 'S12: renewal info for another subscription is refused');
    await rejectsWith(() => apple.native.apple.transaction({ accountId: a.id, body: { signedTransaction: 'not-a-jws' } }), 'APPLE_JWS_INVALID', 'S12: a non-JWS body is refused');
    eq((await entitlement(a.id)).plan, 'free', 'S12: nothing forged changed the entitlement');
    eq((await db.all('SELECT event_id FROM billing_apple_signed_events')).length, ledgerBefore, 'S12: nothing forged entered the ledger');
  }

  // ── S13 wrong bundle id / app id / environment ─────────────────────────────
  {
    clock = T0;
    const a = await newAccount('s13');
    const original = nextOriginal();
    const t = tx({ token: a.token, original, signedDate: T0, expires: T0 + 30 * DAY });
    await rejectsWith(() => deliver(notification({ type: 'SUBSCRIBED', signedDate: T0, transaction: t, bundleId: 'com.attacker.app' }).signedPayload), 'APPLE_APP_MISMATCH', 'S13: a notification for another bundle id is refused');
    await rejectsWith(() => apple.native.apple.transaction({ accountId: a.id, body: { signedTransaction: signer.jws({ ...t, bundleId: 'com.attacker.app' }) } }), 'APPLE_APP_MISMATCH', 'S13: a transaction for another bundle id is refused');
    await rejectsWith(() => deliver(notification({ type: 'SUBSCRIBED', signedDate: T0, transaction: t, appAppleId: 42 }).signedPayload), 'APPLE_APP_MISMATCH', 'S13: a production notification for another App Apple ID is refused');
    const sandboxTx = { ...t, environment: 'Sandbox' };
    await rejectsWith(() => apple.native.apple.transaction({ accountId: a.id, body: { signedTransaction: signer.jws(sandboxTx) } }), 'APPLE_ENVIRONMENT_MISMATCH', 'S13: a Sandbox transaction is refused by a production-only deployment');
    await rejectsWith(() => deliver(notification({ type: 'SUBSCRIBED', signedDate: T0, transaction: sandboxTx, environment: 'Sandbox' }).signedPayload), 'APPLE_ENVIRONMENT_MISMATCH', 'S13: a Sandbox notification is refused by a production-only deployment');
    process.env.PRI_APPLE_ENVIRONMENTS = 'Production,Sandbox';
    process.env.PRI_APPLE_ALLOW_SANDBOX = 'true';
    const both = createAppleBilling(db, { clock: () => clock });
    await rejectsWith(() => both.verifiers.apple.webhook({ body: { signedPayload: notification({ type: 'SUBSCRIBED', signedDate: T0, transaction: sandboxTx, environment: 'Production' }).signedPayload } }), 'APPLE_NOTIFICATION_MISMATCH', 'S13: a Production envelope cannot carry a Sandbox transaction');
    process.env.PRI_APPLE_ENVIRONMENTS = APPLE_ENV.PRI_APPLE_ENVIRONMENTS;
    process.env.PRI_APPLE_ALLOW_SANDBOX = '';
    eq((await entitlement(a.id)).plan, 'free', 'S13: no mismatched app or environment changed the entitlement');
  }

  // ── S14 one account, several sources: Premium follows the live one ─────────
  {
    // Regression (defect D6): the account entitlement was whatever the last
    // event said. A refund of one subscription removed Premium a second,
    // still-paid subscription (another Apple ID on the same Pri account) was
    // providing.
    clock = T0;
    const a = await newAccount('s14');
    const first = nextOriginal();
    const second = nextOriginal();
    const t1 = tx({ token: a.token, original: first, signedDate: T0, expires: T0 + 30 * DAY });
    await device(a, t1);
    clock = T0 + DAY;
    await device(a, tx({ token: a.token, original: second, product: ANNUAL, signedDate: clock, expires: T0 + 365 * DAY }));
    clock = T0 + 2 * DAY;
    const refund = await deliver(notification({ type: 'REFUND', signedDate: clock, transaction: { ...t1, signedDate: clock, revocationDate: clock } }).signedPayload);
    eq(refund.applied.snapshot.plan, 'premium', 'S14: refunding one subscription keeps Premium from the other');
    eq(refund.applied.snapshot.productId, ANNUAL, 'S14: the entitlement now names the subscription that pays for it');
    eq((await db.get('SELECT state_status FROM billing_subscriptions WHERE provider=? AND provider_subscription_id=?', ['apple', first])).state_status, 'revoked', 'S14: the refunded subscription itself is recorded revoked');
    await reconciled(a.id, 'S14');

    // A support grant is not overwritten by an unrelated subscription expiring.
    clock = T0;
    const g = await newAccount('s14g');
    const og = nextOriginal();
    const gt = tx({ token: g.token, original: og, signedDate: T0, expires: T0 + 30 * DAY });
    await device(g, gt);
    await applyVerifiedEntitlement(db, {
      verified: true, provider: 'admin', eventId: supportGrantEventId({ actorAccountId: 'support', accountId: g.id, now: T0 }),
      accountId: g.id, eventType: 'support-grant', productId: 'pri-premium-support', plan: 'premium', status: 'active',
      currentPeriodEnd: T0 + 90 * DAY, offlineUntil: T0 + 7 * DAY, now: T0
    });
    clock = T0 + 31 * DAY;
    const exp = await deliver(notification({ type: 'EXPIRED', subtype: 'VOLUNTARY', signedDate: clock, transaction: { ...gt, signedDate: clock } }).signedPayload);
    eq(exp.applied.snapshot.plan, 'premium', 'S14: an Apple expiry does not cancel a live support grant');
    eq(exp.applied.snapshot.provider, 'admin', 'S14: the support grant is the source');
  }

  // ── S15 server-gated Premium reads only the server entitlement ─────────────
  {
    clock = T0;
    const a = await newAccount('s15');
    const original = nextOriginal();
    const env = { PRI_TUTOR_CALLS_PER_ACCOUNT_DAY: '5', PRI_TUTOR_CALLS_PER_ACCOUNT_DAY_PREMIUM: '50' };
    eq(await tutorDailyLimit(db, a.id, env), 5, 'S15: a free account gets the free tutor allowance');
    const t = tx({ token: a.token, original, signedDate: T0, expires: Date.now() + 30 * DAY });
    await device(a, t);
    eq(await tutorDailyLimit(db, a.id, env), 50, 'S15: verified Premium raises the server-side allowance');
    clock = Date.now() + 1000;
    await deliver(notification({ type: 'REFUND', signedDate: clock, transaction: { ...t, signedDate: clock, revocationDate: clock } }).signedPayload);
    eq(await tutorDailyLimit(db, a.id, env), 5, 'S15: a refund takes the server-side allowance away at once');
  }

  // ── S16 reconciliation reports drift ───────────────────────────────────────
  {
    clock = T0;
    const a = await newAccount('s16');
    const original = nextOriginal();
    const t = tx({ token: a.token, original, signedDate: T0, expires: T0 + 30 * DAY });
    await device(a, t);
    clock = T0 + DAY;
    await deliver(notification({ type: 'REFUND', signedDate: clock, transaction: { ...t, signedDate: clock, revocationDate: clock } }).signedPayload);
    await reconciled(a.id, 'S16 clean');
    // A bad deploy, a manual edit or a lost write re-grants Premium.
    await db.run("UPDATE entitlement_snapshots SET plan='premium',status='active',current_period_end=?,offline_until=? WHERE account_id=?", [T0 + 300 * DAY, clock + 7 * DAY, a.id]);
    const report = await reconcileAppleAccount(db, a.id, { now: clock });
    eq(report.ok, false, 'S16 drift: a snapshot the signed ledger does not support is reported');
    ok(report.drift.some(d => d.kind === 'entitlement-plan' && d.severity === 'critical' && d.expected === 'free'), 'S16 drift: as a critical entitlement-plan finding (expected free)');
    // A tampered ledger row no longer verifies.
    const row = await db.get('SELECT event_id,signed_payload FROM billing_apple_signed_events WHERE account_id=? ORDER BY signed_date LIMIT 1', [a.id]);
    await db.run('UPDATE billing_apple_signed_events SET signed_payload=? WHERE event_id=?', [`${row.signed_payload.slice(0, -4)}AAAA`, row.event_id]);
    const tampered = await reconcileAppleAccount(db, a.id, { now: clock });
    ok(tampered.drift.some(d => d.kind === 'signature-invalid' && d.eventId === row.event_id), 'S16 drift: a stored payload that no longer verifies is reported');
    // A subscription state that disagrees with the evidence.
    const b = await newAccount('s16b');
    const ob = nextOriginal();
    await device(b, tx({ token: b.token, original: ob, signedDate: T0 + DAY, expires: T0 + 31 * DAY }));
    await db.run("UPDATE billing_subscriptions SET state_status='revoked',state_plan='free' WHERE provider='apple' AND provider_subscription_id=?", [ob]);
    const subDrift = await reconcileAppleAccount(db, b.id, { now: clock });
    ok(subDrift.drift.some(d => d.kind === 'subscription-state' && d.originalTransactionId === ob), 'S16 drift: a subscription state that disagrees with its signed events is reported');
    const unbound = await reconcileAppleAccount(db, b.id, { now: clock, includeUnbound: true });
    ok(unbound.unboundNotifications >= 2, 'S16: --unbound lists notifications that named no account');
  }

  console.log(`engine: ${testStore.engine}`);
} finally {
  await testStore.close();
}

// ── Part 2: the same rules over HTTP through the production app ──────────────
{
  const { startApp, registerAccount, verifyEmail } = await import('./support/app-harness.mjs');
  const h = await startApp({ engine, log: () => {} });
  try {
    const made = await registerAccount(h, { email: 'storekit.http@example.test', deviceId: 'ipad-storekit' });
    eq(made.status, 201, 'HTTP: account registered');
    const jar = made.jar;
    const accountId = made.account.id;
    const boot = await h.request('/v1/billing/apple/bootstrap', { jar });
    eq(boot.status, 200, 'HTTP: StoreKit bootstrap');
    const token = boot.data.apple.appAccountToken;
    const now = Date.now();
    const original = nextOriginal();
    const t = tx({ token, original, signedDate: now, expires: now + 30 * DAY });

    const selfUpgrade = await h.request('/v1/billing/apple/transaction', { method: 'POST', jar, body: { plan: 'premium', status: 'active', currentPeriodEnd: now + 365 * DAY } });
    ok(selfUpgrade.status >= 400, `HTTP: a client claiming Premium without Apple-signed proof is refused (${selfUpgrade.status})`);
    const forgedRestore = await h.request('/v1/billing/restore/apple', { method: 'POST', jar, body: { transactions: [signer.jws(t, { chain: signer.rogue })] } });
    ok(forgedRestore.status === 401, `HTTP: a restore with forged signed data is refused (${forgedRestore.status})`);
    eq((await h.request('/v1/entitlements', { jar })).data.entitlement.plan, 'free', 'HTTP: still free after both');

    const accepted = await h.request('/v1/billing/apple/transaction', { method: 'POST', jar, body: { signedTransaction: signer.jws(t) } });
    eq(accepted.status, 200, 'HTTP: the device transaction is accepted');
    const ent = await h.request('/v1/entitlements', { jar });
    eq(ent.data.entitlement.plan, 'premium', 'HTTP: GET /v1/entitlements reports Premium');
    eq(ent.data.accountId, accountId, 'HTTP: and names the account it belongs to');

    const refund = notification({ type: 'REFUND', signedDate: now + 1000, transaction: { ...t, signedDate: now + 1000, revocationDate: now + 1000 } });
    const hook = await h.request('/v1/billing/webhook/apple', { method: 'POST', body: { signedPayload: refund.signedPayload } });
    eq(hook.status, 200, 'HTTP: the signed REFUND webhook is applied');
    eq((await h.request('/v1/entitlements', { jar })).data.entitlement.plan, 'free', 'HTTP: Premium is gone after the refund');
    const again = await h.request('/v1/billing/webhook/apple', { method: 'POST', body: { signedPayload: refund.signedPayload } });
    eq(again.status, 200, 'HTTP: a redelivered webhook is acknowledged');
    eq((await h.db.all('SELECT event_id FROM billing_events WHERE provider=? AND event_id=?', ['apple', refund.uuid])).length, 1, 'HTTP: and recorded once');
    const forged = await h.request('/v1/billing/webhook/apple', { method: 'POST', body: { signedPayload: notification({ type: 'REFUND_REVERSED', signedDate: now + 2000, transaction: t, chain: signer.rogue }).signedPayload } });
    eq(forged.status, 401, 'HTTP: a forged webhook is refused');
    const stranger = await h.request('/v1/billing/webhook/apple', { method: 'POST', body: { signedPayload: notification({ type: 'SUBSCRIBED', signedDate: now, transaction: tx({ token: randomUUID(), original: nextOriginal(), signedDate: now, expires: now + DAY }) }).signedPayload } });
    eq(stranger.status, 200, 'HTTP: a notification for no Pri account is acknowledged (no endless Apple retries)');
    eq(stranger.data?.applied, 0, 'HTTP: and applies nothing');

    // Web (Razorpay) checkout is unreachable from the native app.
    await verifyEmail(h, accountId);
    const nativeCheckout = await h.request('/v1/billing/checkout/web', { method: 'POST', jar, body: { cadence: 'monthly' }, headers: { 'X-Pri-Client': 'ios-native-v1' } });
    eq(nativeCheckout.status, 403, 'HTTP: web checkout is refused for the iPad app');
    eq(nativeCheckout.data?.error?.code, 'BILLING_WEB_CHECKOUT_NATIVE_REFUSED', 'HTTP: with its own code');
    const androidCheckout = await h.request('/v1/billing/checkout/web', { method: 'POST', jar, body: { cadence: 'monthly' }, headers: { 'X-Pri-Client': 'android-native-v1' } });
    eq(androidCheckout.data?.error?.code, 'BILLING_WEB_CHECKOUT_NATIVE_REFUSED', 'HTTP: and for the Android app');
    const webCheckout = await h.request('/v1/billing/checkout/web', { method: 'POST', jar, body: { cadence: 'monthly' }, headers: { 'X-Pri-Client': 'web-v1' } });
    ok(webCheckout.data?.error?.code !== 'BILLING_WEB_CHECKOUT_NATIVE_REFUSED', 'HTTP: the browser is not refused by the native rule');
    const nativeConfig = await h.request('/v1/billing/config', { headers: { 'X-Pri-Client': 'ios-native-v1' } });
    eq(nativeConfig.data?.webCheckout?.configured, false, 'HTTP: billing config tells the iPad app web checkout does not exist');
    console.log(`http engine: ${h.engine}`);
  } finally {
    await h.close();
  }
}

// ── Part 3: the operator CLI (SQLite file; the CLI is engine-agnostic) ───────
if (engine === 'sqlite') {
  const dir = mkdtempSync(join(tmpdir(), 'pri-reconcile-cli-'));
  try {
    const dbPath = join(dir, 'platform.db');
    const { createPlatformDb } = await import('../platform/db.js');
    const { ensureBillingSchema } = await import('../platform/billingSchema.js');
    const { asStore } = await import('../platform/store.js');
    const raw = createPlatformDb(dbPath);
    ensureBillingSchema(raw);
    const store = asStore(raw);
    const cli = createAppleBilling(store, { clock: () => T0 });
    await store.run(`INSERT INTO accounts(id,email,name,password_hash,role,created_at,updated_at) VALUES ('acct-cli','cli@example.test','cli','hash','student',?,?)`, [T0, T0]);
    await store.run(`INSERT INTO entitlement_snapshots(account_id,plan,status,provider,source_version,updated_at) VALUES ('acct-cli','free','free','none',0,?)`, [T0]);
    const { appAccountToken } = await cli.native.apple.bootstrap({ accountId: 'acct-cli' });
    const live = await cli.native.apple.transaction({ accountId: 'acct-cli', body: { signedTransaction: signer.jws(tx({ token: appAccountToken, original: nextOriginal(), signedDate: T0, expires: Date.now() + 30 * DAY })) } });
    await applyVerifiedEntitlement(store, live);
    raw.close();
    const env = { ...process.env, PRI_PLATFORM_DB: dbPath, PRI_DATABASE_URL: '', NODE_ENV: 'development' };
    const run = args => spawnSync(process.execPath, [join(ROOT, 'server', 'tools', 'billing-reconcile.mjs'), ...args], { env, encoding: 'utf8' });
    const clean = run(['--account', 'acct-cli']);
    eq(clean.status, 0, `CLI: a consistent account exits 0 (${clean.stderr.trim().slice(0, 200)})`);
    ok(JSON.parse(clean.stdout).ok === true, 'CLI: and reports ok');
    const reopened = createPlatformDb(dbPath);
    reopened.prepare("UPDATE entitlement_snapshots SET plan='free',status='expired' WHERE account_id='acct-cli'").run();
    reopened.close();
    const drifted = run(['--account', 'acct-cli']);
    eq(drifted.status, 2, 'CLI: drift exits 2');
    ok(JSON.parse(drifted.stdout).drift.some(d => d.kind === 'entitlement-plan' && d.expected === 'premium'), 'CLI: a paid subscription the snapshot lost is reported');
    eq(run([]).status, 1, 'CLI: missing --account is a usage error');
    // Owner-fetched evidence (Get Notification History) that the server never
    // received: a refund. The report shows it and what it implies; nothing is written.
    const evidencePath = join(dir, 'apple-history.json');
    const refundAt = Date.now() + 1000;
    const missed = notification({ type: 'REFUND', signedDate: refundAt, transaction: tx({ token: appAccountToken, original: live.providerSubscriptionId, id: String(++txSerial), signedDate: refundAt, expires: Date.now() + 30 * DAY, revoked: refundAt }) });
    writeFileSync(evidencePath, JSON.stringify({ signedPayloads: [missed.signedPayload], signedTransactions: [signer.jws(tx({ token: randomUUID(), original: nextOriginal(), signedDate: refundAt, expires: refundAt + DAY }))] }));
    const fix = createPlatformDb(dbPath);
    fix.prepare("UPDATE entitlement_snapshots SET plan='premium',status='active' WHERE account_id='acct-cli'").run();
    fix.close();
    const withEvidence = run(['--account', 'acct-cli', '--evidence', evidencePath]);
    const evReport = JSON.parse(withEvidence.stdout || '{}');
    eq(withEvidence.status, 2, 'CLI evidence: a refund Apple signed but the server never applied is drift');
    ok(evReport.drift?.some(d => d.kind === 'evidence-not-stored' && d.eventType === 'REFUND'), 'CLI evidence: reported as evidence-not-stored');
    ok(evReport.drift?.some(d => d.kind === 'entitlement-plan' && d.expected === 'free'), 'CLI evidence: and the entitlement it implies (free) is shown');
    ok(evReport.drift?.some(d => d.kind === 'evidence-other-account'), 'CLI evidence: another account\'s signed data is not counted');
    const after = createPlatformDb(dbPath);
    eq(after.prepare("SELECT plan FROM entitlement_snapshots WHERE account_id='acct-cli'").get().plan, 'premium', 'CLI evidence: the tool wrote nothing');
    after.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

for (const [name, value] of Object.entries(previousEnv)) {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}

if (failures.length) {
  console.error(`STOREKIT ENTITLEMENT STATE MACHINE: FAIL — ${failures.length} of ${checks} checks\n  · ${failures.join('\n  · ')}`);
  process.exit(1);
}
console.log(`STOREKIT ENTITLEMENT STATE MACHINE: PASS — ${checks}/${checks} checks — purchase, renewal, grace/billing retry, voluntary cancellation, expiry, refund/revoke/reversal, upgrade/downgrade, restore/reinstall, account switch, duplicate/racing/replayed/out-of-order notifications, unknown accounts, forged signatures and wrong app/environment each end in the entitlement Apple's signed state implies, with an audit trail the reconciliation tool re-derives.`);
