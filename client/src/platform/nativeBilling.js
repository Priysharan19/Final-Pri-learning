// Pri Learning · native store billing client (via priNative, CP-02)
//
// This module never grants Premium and never opens a network connection. It is
// only the typed boundary between the React UI and the shell's store bridge
// (StoreKit 2 on Apple today). Store-signed proofs (Apple JWS) are handed to
// cloudTransport.js; the server is the sole entitlement authority.
//
// Late results are never lost: a purchase or restore that answers after the UI
// stopped waiting is re-emitted through onNativeBillingUpdate() by priNative,
// and StoreKit itself re-delivers unfinished transactions on the next launch.
import { priNative } from './native/index.js';

export function nativeBillingAvailable() {
  return priNative.billing.available();
}

/** Which store sheet the shell presents: 'app-store', 'google-play' or null.
 * It selects the purchase flow and copy only — never entitlement. */
export function nativeBillingStore() {
  return priNative.billing.available() ? priNative.billing.store() : null;
}

function request(action, body = {}, timeoutMs = 30_000) {
  return priNative.billing.request(action, body, { timeoutMs });
}

function ids(values) {
  return [...new Set((Array.isArray(values) ? values : [])
    .map(value => String(value || '').trim())
    .filter(value => value && value.length <= 200))].slice(0, 12);
}

function replayUnfinished(productIds) {
  // StoreKit's Transaction.updates observer starts before React. Sweep the
  // unfinished queue after bootstrap so an update emitted during page startup
  // is replayed through the normal server-verification handler, not lost.
  request('unfinished', { productIds }, 60_000).then(result => {
    for (const transaction of Array.isArray(result.transactions) ? result.transactions : []) {
      replayToListeners({ status: 'verified', ...transaction });
    }
  }).catch(() => {});
}

const localListeners = new Set();
function replayToListeners(transaction) {
  for (const fn of [...localListeners]) { try { fn(transaction); } catch { /* isolate */ } }
}

export async function getNativeProducts(productIds) {
  const wanted = ids(productIds);
  const result = await request('products', { productIds: wanted }, 30_000);
  replayUnfinished(wanted);
  return Array.isArray(result.products) ? result.products : [];
}

export function purchaseNativeProduct(productId, appAccountToken) {
  return request('purchase', {
    productId: String(productId || ''),
    appAccountToken: String(appAccountToken || '')
  }, 5 * 60_000);
}

/** Google Play: the server-issued obfuscatedAccountId travels with the purchase
 * and comes back inside Google's record, which is how the server binds it. */
export function purchaseGoogleSubscription({ productId, basePlanId, obfuscatedAccountId }) {
  return request('purchase', {
    productId: String(productId || ''),
    basePlanId: String(basePlanId || ''),
    obfuscatedAccountId: String(obfuscatedAccountId || '')
  }, 5 * 60_000);
}

export async function unfinishedNativeTransactions(productIds) {
  const result = await request('unfinished', { productIds: ids(productIds) }, 60_000);
  return Array.isArray(result.transactions) ? result.transactions : [];
}

export async function restoreNativePurchases(productIds) {
  const result = await request('restore', { productIds: ids(productIds) }, 2 * 60_000);
  return Array.isArray(result.transactions) ? result.transactions : [];
}

export function finishNativeTransaction(transactionId) {
  return request('finish', { transactionId: String(transactionId || '') }, 30_000);
}

/**
 * Store transactions that need server verification: external updates, replays
 * of unfinished transactions, and late purchase/restore results. Callers must
 * submit the signed proof to the server and finish only after it accepts.
 * Returns an unsubscribe function so component lifetimes stay explicit.
 */
export function onNativeBillingUpdate(listener) {
  if (typeof listener !== 'function') return () => {};
  localListeners.add(listener);
  const off = priNative.billing.onTransactionUpdate(listener);
  return () => { localListeners.delete(listener); off(); };
}
