import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const swift = readFileSync(new URL('../../ios/PriLearning.swiftpm/StoreKitBillingBridge.swift', import.meta.url), 'utf8');
const shell = readFileSync(new URL('../../ios/PriLearning.swiftpm/WebShell.swift', import.meta.url), 'utf8');
const native = readFileSync(new URL('../src/platform/nativeBilling.js', import.meta.url), 'utf8');
const legacy = readFileSync(new URL('../src/platform/native/legacyApple.js', import.meta.url), 'utf8');
const transport = readFileSync(new URL('../src/platform/cloudTransport.js', import.meta.url), 'utf8');
const panel = readFileSync(new URL('../src/components/CloudAccountPanel.jsx', import.meta.url), 'utf8');

assert.match(shell, /__PRI_NATIVE_BILLING__\s*=\s*true/, 'native shell must explicitly advertise StoreKit capability');
assert.match(shell, /name:\s*"priBilling"/, 'WKWebView must install a dedicated billing message handler');
assert.match(shell, /billing\.handle\(message\.body\)/, 'billing messages must be routed only to the StoreKit bridge');

assert.match(swift, /import StoreKit/, 'native billing must use StoreKit');
assert.match(swift, /\.purchase\(options:\s*\[\.appAccountToken\(accountToken\)\]\)/,
  'purchase must bind Apple transaction to the server-generated appAccountToken');
assert.match(swift, /verification\.jwsRepresentation/,
  'verified StoreKit result must preserve Apple signed JWS for server verification');
assert.match(swift, /Transaction\.currentEntitlements/,
  'restore must enumerate StoreKit current entitlements');
assert.match(swift, /Transaction\.unfinished/,
  'launch recovery must explicitly enumerate unfinished StoreKit transactions');
assert.match(swift, /AppStore\.sync\(\)/,
  'restore must ask App Store to synchronize purchases');
assert.match(swift, /Transaction\.updates/,
  'new and externally updated transactions must be listened for');

const purchaseStart = swift.indexOf('case "purchase":');
const unfinishedStart = swift.indexOf('case "unfinished":');
const restoreStart = swift.indexOf('case "restore":');
const finishStart = swift.indexOf('case "finish":');
assert.ok(purchaseStart >= 0 && unfinishedStart > purchaseStart && restoreStart > unfinishedStart && finishStart > restoreStart,
  'StoreKit actions must have explicit purchase/unfinished/restore/finish branches');
assert.ok(!swift.slice(purchaseStart, finishStart).includes('.finish()'),
  'purchase, recovery and restore must not finish a transaction before cloud acceptance');
assert.match(swift.slice(finishStart), /await transaction\.finish\(\)/,
  'only the explicit finish action may acknowledge a StoreKit transaction');

assert.equal(native.includes('fetch('), false, 'native bridge client must not create a second network boundary');
assert.equal(native.includes('cloudRequest('), false, 'native bridge client must not call cloud directly');
assert.match(legacy, /handler\('priBilling'\)/, 'the native adapter must target only priBilling');
assert.equal(/webkit|messageHandlers/.test(native), false, 'nativeBilling must reach StoreKit only through priNative');
assert.match(native, /request\('unfinished'/, 'client bootstrap must sweep StoreKit unfinished transactions');
assert.match(legacy, /pri:native-billing-update/, 'native transaction updates must reach the normal update path');
assert.match(legacy, /billingLate\.set\(id/, 'a late purchase/restore result must be recovered, not dropped');
assert.equal(legacy.includes('fetch('), false, 'the native adapter must not create a second network boundary');

assert.match(transport, /\/v1\/billing\/apple\/bootstrap/, 'cloud transport must expose Apple account-token bootstrap');
assert.match(transport, /\/v1\/billing\/apple\/transaction/, 'cloud transport must expose server JWS verification');

const authority = panel.indexOf('await cloud.submitAppleTransaction(signedTransaction)');
const finish = panel.indexOf('await finishNativeTransaction(transactionId)');
assert.ok(authority >= 0 && finish > authority,
  'Settings must obtain server acceptance before finishing StoreKit transaction');
assert.match(panel, /purchaseNativeProduct\(product\.id, appleBootstrap\.appAccountToken\)/,
  'Settings must purchase with the server-generated appAccountToken');
assert.match(panel, /restoreNativePurchases\(productIds\)/,
  'Settings must use native StoreKit restore inside the iOS shell');
assert.match(panel, /nativeShell && !nativeStore &&/,
  'native builds without a store billing bridge must fail closed instead of exposing web checkout');
assert.match(panel, /const canUseWebBilling = canSync && webCheckout && !nativeShell;/,
  'web checkout is never offered inside a native shell (Apple or Android)');
assert.match(panel, /const nativeStoreKit = nativeStore === 'app-store';/,
  'the StoreKit flow runs only when the shell\'s store is the App Store');

// CP-08 · Google Play: the server re-fetches every purchase from Google.
const google = readFileSync(new URL('../src/components/GooglePlayBilling.jsx', import.meta.url), 'utf8');
assert.match(panel, /nativeShell && googlePlay && <GooglePlayBilling/, 'the Google Play flow runs only when the shell\'s store is Google Play');
assert.match(google, /purchaseGoogleSubscription\(\{ productId: plan\.id, basePlanId: plan\.basePlanId, obfuscatedAccountId: bootstrap\.obfuscatedAccountId \}\)/,
  'a Google purchase carries the server-issued obfuscatedAccountId');
const gAuthority = google.indexOf('await cloud.submitGooglePurchase(token)');
const gRefresh = google.indexOf('await refreshCloudEntitlement(user.id)');
assert.ok(gAuthority >= 0 && gRefresh > gAuthority, 'Premium is refreshed from the server only after it verified the Google purchase');
assert.equal(/set(?:Premium|Entitlement)\s*\(|acknowledge/i.test(google.replace(/\/\/.*$/gm, '')), false,
  'the Google flow never sets Premium and never acknowledges (the server does)');
assert.match(transport, /\/v1\/billing\/google\/purchase/, 'cloud transport exposes server-side Google purchase verification');
assert.match(google, /unfinishedNativeTransactions\(ids\)/, 'purchases the server never saw are swept and reported on load');
const bridgeSrc = readFileSync(new URL('../src/platform/native/bridge.js', import.meta.url), 'utf8');
assert.match(bridgeSrc, /result\.status === 'verified' \|\| result\.status === 'purchased'/, 'a late Google Play purchase is recovered like a late StoreKit one');
assert.equal(/fetch\(|cloudRequest\(/.test(google), false, 'the Google flow uses only the audited cloud transport');
assert.equal(/set(?:Premium|Entitlement)\s*\(/.test(native), false,
  'native bridge must never contain a client-side Premium mutation');

console.log('PASS — StoreKit purchase/restore keeps Apple JWS intact, recovers unfinished transactions, binds appAccountToken, and finishes only after Pri server acceptance.');
