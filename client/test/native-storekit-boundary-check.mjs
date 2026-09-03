import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const swift = readFileSync(new URL('../../ios/PriLearning.swiftpm/StoreKitBillingBridge.swift', import.meta.url), 'utf8');
const shell = readFileSync(new URL('../../ios/PriLearning.swiftpm/WebShell.swift', import.meta.url), 'utf8');
const native = readFileSync(new URL('../src/platform/nativeBilling.js', import.meta.url), 'utf8');
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
assert.match(native, /messageHandlers\?\.priBilling/, 'browser/native boundary must target only priBilling');
assert.match(native, /request\('unfinished'/, 'client bootstrap must sweep StoreKit unfinished transactions');
assert.match(native, /pri:native-billing-update/, 'client must replay unfinished transactions through the normal update path');

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
assert.match(panel, /nativeShell && !nativeStoreKit/,
  'native builds without StoreKit bridge must fail closed instead of exposing web checkout');
assert.equal(/set(?:Premium|Entitlement)\s*\(/.test(native), false,
  'native bridge must never contain a client-side Premium mutation');

console.log('PASS — StoreKit purchase/restore keeps Apple JWS intact, recovers unfinished transactions, binds appAccountToken, and finishes only after Pri server acceptance.');
