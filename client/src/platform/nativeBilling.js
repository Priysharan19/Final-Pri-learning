// Pri Learning · native StoreKit bridge client
//
// This module never grants Premium and never opens a network connection. It is
// only the typed message boundary between the React UI and the iOS StoreKit 2
// bridge. Apple-signed transaction JWS values are handed to cloudTransport.js;
// the server is the sole entitlement authority.

const RESPONSE_EVENT = 'pri:native-billing-response';
const UPDATE_EVENT = 'pri:native-billing-update';
const pending = new Map();
let listening = false;

function handler() {
  return globalThis?.webkit?.messageHandlers?.priBilling || null;
}

export function nativeBillingAvailable() {
  return globalThis.__PRI_NATIVE_BILLING__ === true && typeof handler()?.postMessage === 'function';
}

function installListener() {
  if (listening || typeof window === 'undefined') return;
  listening = true;
  window.addEventListener(RESPONSE_EVENT, event => {
    const detail = event?.detail;
    const id = String(detail?.id || '');
    const waiting = pending.get(id);
    if (!waiting) return;
    pending.delete(id);
    clearTimeout(waiting.timer);
    if (detail?.ok === true) {
      waiting.resolve(detail.result || {});
      return;
    }
    const err = new Error(detail?.error?.message || 'Native billing request failed.');
    err.code = detail?.error?.code || 'NATIVE_BILLING_ERROR';
    waiting.reject(err);
  });
}

function request(action, body = {}, timeoutMs = 30_000) {
  if (!nativeBillingAvailable()) {
    const err = new Error('App Store billing is not available in this build.');
    err.code = 'NATIVE_BILLING_UNAVAILABLE';
    return Promise.reject(err);
  }
  installListener();
  const id = globalThis.crypto?.randomUUID?.() || `billing-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      const err = new Error('App Store billing did not respond in time.');
      err.code = 'NATIVE_BILLING_TIMEOUT';
      reject(err);
    }, Math.max(1_000, Math.min(5 * 60_000, Number(timeoutMs) || 30_000)));
    pending.set(id, { resolve, reject, timer });
    try {
      handler().postMessage({ id, action, ...body });
    } catch (error) {
      clearTimeout(timer);
      pending.delete(id);
      reject(error);
    }
  });
}

function ids(values) {
  return [...new Set((Array.isArray(values) ? values : [])
    .map(value => String(value || '').trim())
    .filter(value => value && value.length <= 200))].slice(0, 12);
}

export async function getNativeProducts(productIds) {
  const result = await request('products', { productIds: ids(productIds) }, 30_000);
  return Array.isArray(result.products) ? result.products : [];
}

export function purchaseNativeProduct(productId, appAccountToken) {
  return request('purchase', {
    productId: String(productId || ''),
    appAccountToken: String(appAccountToken || '')
  }, 5 * 60_000);
}

export async function restoreNativePurchases(productIds) {
  const result = await request('restore', { productIds: ids(productIds) }, 2 * 60_000);
  return Array.isArray(result.transactions) ? result.transactions : [];
}

export function finishNativeTransaction(transactionId) {
  return request('finish', { transactionId: String(transactionId || '') }, 30_000);
}

/**
 * Unfinished StoreKit transactions are replayed here after purchase or on a
 * later launch. Callers must submit the JWS to the server and finish only after
 * the server accepts it. Returning an unsubscribe function keeps component
 * lifetimes explicit.
 */
export function onNativeBillingUpdate(listener) {
  if (typeof window === 'undefined' || typeof listener !== 'function') return () => {};
  const wrapped = event => listener(event?.detail || {});
  window.addEventListener(UPDATE_EVENT, wrapped);
  return () => window.removeEventListener(UPDATE_EVENT, wrapped);
}
