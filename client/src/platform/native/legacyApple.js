// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · legacy Apple bridge adapters (CP-02 migration window)
//
// The Apple shell's five pre-envelope WKScriptMessageHandlers (priInk,
// priPhoto, priBilling, priCloud, priShare) keep their wire formats during the
// migration. This file is the ONLY place that talks to them; product code goes
// through priNative, which picks exactly one transport per capability (the
// host descriptor says which), so nothing is ever sent over both.
//
// The adapters add the contract's semantics on top of the old wire format:
// closed error codes, AbortSignal cancellation, and late-result recovery for
// billing (a purchase that answers after JavaScript gave up is re-emitted as
// `billing.transactionUpdated`, never dropped).
// ─────────────────────────────────────────────────────────────────────────────
import { PriNativeError } from './errors.js';
import { newRequestId } from './envelope.js';

const LATE_RECOVERY_MS = 30 * 60_000;

export function createLegacyApple({ scope = globalThis, emit = () => {}, now = () => Date.now() } = {}) {
  const handlers = () => scope?.webkit?.messageHandlers || null;
  const handler = name => {
    const h = handlers()?.[name];
    return h && typeof h.postMessage === 'function' ? h : null;
  };

  // ── ink ────────────────────────────────────────────────────────────────────
  const inkListeners = new Set();
  let inkReceiverInstalled = false;
  function installInkReceiver() {
    if (inkReceiverInstalled || !scope) return;
    inkReceiverInstalled = true;
    scope.__priInkReceive = payload => {
      if (!payload || typeof payload !== 'object') return;
      for (const fn of [...inkListeners]) { try { fn(payload); } catch { /* isolate subscribers */ } }
    };
  }
  const ink = {
    available: () => !!handler('priInk'),
    post(message) {
      const h = handler('priInk');
      if (!h) return false;
      try { h.postMessage(message); return true; } catch { return false; }
    },
    onMessage(fn) {
      installInkReceiver();
      if (typeof fn !== 'function') return () => {};
      inkListeners.add(fn);
      return () => inkListeners.delete(fn);
    },
  };

  // ── photo ──────────────────────────────────────────────────────────────────
  let nextPhotoId = 1;
  const photoPending = new Map();
  let photoReceiverInstalled = false;
  function installPhotoReceiver() {
    if (photoReceiverInstalled || !scope) return;
    photoReceiverInstalled = true;
    scope.__priPhotoReceive = payload => {
      if (!payload || typeof payload !== 'object') return;
      const entry = photoPending.get(payload.reqId);
      if (!entry) return; // late, duplicate or unknown
      photoPending.delete(payload.reqId);
      entry.cleanup();
      if (payload.ok === false) entry.reject(new PriNativeError('PROVIDER_ERROR', payload.error || 'Photo handwriting could not be read.'));
      else entry.resolve(payload);
    };
  }
  const photo = {
    available: () => !!handler('priPhoto'),
    recognize(dataURL, { timeoutMs = 12_000, signal = null } = {}) {
      const h = handler('priPhoto');
      if (!h) return Promise.reject(new PriNativeError('UNSUPPORTED', 'Native photo handwriting OCR is unavailable in this build.'));
      if (signal?.aborted) return Promise.reject(new PriNativeError('CANCELLED', 'Photo recognition was cancelled.'));
      installPhotoReceiver();
      return new Promise((resolve, reject) => {
        const reqId = nextPhotoId++;
        let timer = null;
        const onAbort = () => {
          if (!photoPending.delete(reqId)) return;
          entry.cleanup();
          reject(new PriNativeError('CANCELLED', 'Photo recognition was cancelled.'));
        };
        const entry = {
          resolve, reject,
          cleanup() { clearTimeout(timer); signal?.removeEventListener('abort', onAbort); },
        };
        photoPending.set(reqId, entry);
        signal?.addEventListener('abort', onAbort, { once: true });
        timer = setTimeout(() => {
          if (!photoPending.delete(reqId)) return;
          entry.cleanup();
          reject(new PriNativeError('TIMEOUT', 'Photo handwriting recognition timed out.'));
        }, Math.max(1, Number(timeoutMs) || 12_000));
        try { h.postMessage({ reqId, dataURL }); } catch (error) {
          photoPending.delete(reqId);
          entry.cleanup();
          reject(new PriNativeError('UNAVAILABLE', 'Could not start photo handwriting recognition.', { cause: error }));
        }
      });
    },
  };

  // ── billing (StoreKit 2) ──────────────────────────────────────────────────
  const billingPending = new Map();
  const billingLate = new Map();
  let billingListening = false;
  function recoverLateBilling(id, detail) {
    const record = billingLate.get(id);
    billingLate.delete(id);
    if (!record || record.expires < now() || detail?.ok !== true) return;
    const result = detail.result || {};
    const transactions = record.action === 'restore'
      ? (Array.isArray(result.transactions) ? result.transactions : [])
      : (result.status === 'verified' ? [result] : []);
    for (const transaction of transactions) emit('billing.transactionUpdated', { status: 'verified', ...transaction });
  }
  function installBillingListener() {
    if (billingListening || typeof scope?.addEventListener !== 'function') return;
    billingListening = true;
    scope.addEventListener('pri:native-billing-response', event => {
      const detail = event?.detail;
      const id = String(detail?.id || '');
      const waiting = billingPending.get(id);
      if (!waiting) { if (billingLate.has(id)) recoverLateBilling(id, detail); return; }
      billingPending.delete(id);
      waiting.cleanup();
      if (detail?.ok === true) { waiting.resolve(detail.result || {}); return; }
      waiting.reject(new PriNativeError(detail?.error?.code || 'NATIVE_BILLING_ERROR',
        detail?.error?.message || 'Native billing request failed.'));
    });
    scope.addEventListener('pri:native-billing-update', event => {
      if (event?.detail && typeof event.detail === 'object') emit('billing.transactionUpdated', event.detail);
    });
  }
  const billing = {
    available: () => !!handler('priBilling'),
    listen: installBillingListener,
    request(action, body = {}, { timeoutMs = 30_000, signal = null } = {}) {
      const h = handler('priBilling');
      if (!h) return Promise.reject(new PriNativeError('UNSUPPORTED', 'App Store billing is not available in this build.'));
      if (signal?.aborted) return Promise.reject(new PriNativeError('CANCELLED', 'Billing request was cancelled.'));
      installBillingListener();
      const id = newRequestId();
      const recoverable = action === 'purchase' || action === 'restore';
      return new Promise((resolve, reject) => {
        let timer = null;
        const giveUp = code => {
          if (!billingPending.delete(id)) return;
          waiting.cleanup();
          if (recoverable) billingLate.set(id, { action, expires: now() + LATE_RECOVERY_MS });
          reject(new PriNativeError(code, code === 'TIMEOUT'
            ? 'App Store billing did not respond in time.'
            : 'Billing request was cancelled.'));
        };
        const onAbort = () => giveUp('CANCELLED');
        const waiting = {
          resolve, reject,
          cleanup() { clearTimeout(timer); signal?.removeEventListener('abort', onAbort); },
        };
        billingPending.set(id, waiting);
        signal?.addEventListener('abort', onAbort, { once: true });
        timer = setTimeout(() => giveUp('TIMEOUT'), Math.max(1_000, Math.min(5 * 60_000, Number(timeoutMs) || 30_000)));
        try { h.postMessage({ id, action, ...body }); } catch (error) {
          billingPending.delete(id);
          waiting.cleanup();
          reject(new PriNativeError('UNAVAILABLE', 'Could not reach App Store billing.', { cause: error }));
        }
      });
    },
  };

  // ── cloud (URLSession, native cookie jar) ─────────────────────────────────
  const cloudPending = new Map();
  let cloudListening = false;
  function installCloudListener() {
    if (cloudListening || typeof scope?.addEventListener !== 'function') return;
    cloudListening = true;
    scope.addEventListener('pri:native-cloud-response', event => {
      const detail = event?.detail;
      const id = String(detail?.id || '');
      const waiting = cloudPending.get(id);
      if (!waiting) return; // late/duplicate replies are dropped: mutations carry idempotency keys where enforced
      cloudPending.delete(id);
      waiting.cleanup();
      if (detail?.error) {
        waiting.reject(new PriNativeError(detail.error.code || 'NATIVE_CLOUD_ERROR', detail.error.message || 'Native cloud request failed.'));
        return;
      }
      waiting.resolve(detail || {});
    });
  }
  const cloud = {
    available: () => !!handler('priCloud'),
    request({ path, method, body, requestId, idempotencyKey }, { timeoutMs = 12_000, signal = null } = {}) {
      const bridge = handler('priCloud');
      if (!bridge) return Promise.reject(new PriNativeError('UNAVAILABLE', 'Native Pri cloud transport is not configured.'));
      installCloudListener();
      const id = `native-${newRequestId()}`.slice(0, 120);
      return new Promise((resolve, reject) => {
        let timer = null;
        const cancel = code => {
          if (!cloudPending.delete(id)) return;
          waiting.cleanup();
          try { bridge.postMessage({ id, action: 'cancel' }); } catch { /* best effort */ }
          reject(new PriNativeError(code, code === 'TIMEOUT' ? 'Cloud request timed out.' : 'Cloud request was cancelled.'));
        };
        const onAbort = () => cancel('CANCELLED');
        const waiting = {
          resolve, reject,
          cleanup() { clearTimeout(timer); signal?.removeEventListener('abort', onAbort); },
        };
        cloudPending.set(id, waiting);
        if (signal?.aborted) { cancel('CANCELLED'); return; }
        signal?.addEventListener('abort', onAbort, { once: true });
        timer = setTimeout(() => cancel('TIMEOUT'), Math.max(1000, Math.min(60_000, Number(timeoutMs) || 12_000)));
        try {
          bridge.postMessage({
            id, action: 'request', path, method, requestId,
            ...(idempotencyKey ? { idempotencyKey: String(idempotencyKey).slice(0, 160) } : {}),
            ...(body === undefined ? {} : { body }),
          });
        } catch (error) {
          cloudPending.delete(id);
          waiting.cleanup();
          reject(new PriNativeError('UNAVAILABLE', 'Could not reach the native cloud bridge.', { cause: error }));
        }
      });
    },
  };

  // ── share (text only, fire-and-forget) ─────────────────────────────────────
  const share = {
    available: () => !!handler('priShare'),
    file({ filename, text }) {
      const h = handler('priShare');
      if (!h) return Promise.reject(new PriNativeError('UNSUPPORTED', 'Native sharing is unavailable.'));
      if (typeof text !== 'string') return Promise.reject(new PriNativeError('UNSUPPORTED', 'This app version can only share text files.'));
      try { h.postMessage({ filename, content: text }); } catch (error) {
        return Promise.reject(new PriNativeError('UNAVAILABLE', 'Could not open the share sheet.', { cause: error }));
      }
      // The legacy handler never replies; presenting the sheet is the outcome.
      return Promise.resolve({ completed: false, presented: true });
    },
  };

  return { ink, photo, billing, cloud, share };
}
