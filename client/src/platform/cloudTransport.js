// Pri Learning · audited cloud transport boundary
//
// This is the only client module permitted to open production HTTP connections.
// In a browser it uses fetch. In the bundled iOS shell it delegates the same
// bounded request contract to NativeCloudBridge, which owns HTTPS cookies/CSRF
// outside the `prilearning://` WKWebView. All learning UI remains offline-first.

const DEFAULT_TIMEOUT_MS = 12_000;
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;
const PATH = /^\/v1\/[A-Za-z0-9/_-]{1,180}$/;
const SAFE_ID = /^[A-Za-z0-9._:-]{1,160}$/;
const NATIVE_RESPONSE_EVENT = 'pri:native-cloud-response';
const nativePending = new Map();
let nativeListenerInstalled = false;

function envOrigin() {
  const vite = import.meta?.env?.VITE_PRI_CLOUD_ORIGIN;
  const injected = globalThis.__PRI_CLOUD_ORIGIN__;
  return String(vite || injected || '').trim();
}

export function normalizeCloudOrigin(raw = envOrigin()) {
  if (!raw) return null;
  let url;
  try { url = new URL(raw, globalThis.location?.origin || 'https://pri.invalid'); }
  catch { throw new Error('PRI cloud origin is invalid'); }
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (url.protocol !== 'https:' && !(local && url.protocol === 'http:')) throw new Error('PRI cloud origin must use HTTPS');
  if (url.username || url.password || url.search || url.hash) throw new Error('PRI cloud origin must not contain credentials, query or fragment');
  return url.origin;
}

function nativeCloudHandler() {
  return globalThis?.webkit?.messageHandlers?.priCloud || null;
}

export function nativeCloudAvailable() {
  return globalThis.__PRI_NATIVE_CLOUD__ === true &&
    globalThis.__PRI_NATIVE_CLOUD_CONFIGURED__ === true &&
    typeof nativeCloudHandler()?.postMessage === 'function';
}

export function cloudAvailable() {
  if (nativeCloudAvailable()) return true;
  try { return !!normalizeCloudOrigin(); } catch { return false; }
}

function cookie(name) {
  if (typeof document === 'undefined') return '';
  const prefix = `${name}=`;
  const hit = String(document.cookie || '').split(';').map(x => x.trim()).find(x => x.startsWith(prefix));
  return hit ? decodeURIComponent(hit.slice(prefix.length)) : '';
}

function requestId() {
  try { return globalThis.crypto?.randomUUID?.() || `req-${Date.now()}-${Math.random().toString(36).slice(2)}`; }
  catch { return `req-${Date.now()}`; }
}

function byteLength(text) {
  try { return new TextEncoder().encode(text).byteLength; } catch { return text.length * 2; }
}

function pathId(value, label = 'id') {
  const id = String(value || '');
  if (!SAFE_ID.test(id)) throw new Error(`${label} is invalid`);
  return id;
}

function parseJson(text) {
  if (!text) return null;
  try { return JSON.parse(text); }
  catch {
    const err = new Error('Cloud returned invalid JSON');
    err.code = 'CLOUD_BAD_RESPONSE';
    throw err;
  }
}

function installNativeListener() {
  if (nativeListenerInstalled || typeof window === 'undefined') return;
  nativeListenerInstalled = true;
  window.addEventListener(NATIVE_RESPONSE_EVENT, event => {
    const detail = event?.detail;
    const id = String(detail?.id || '');
    const waiting = nativePending.get(id);
    if (!waiting) return;
    nativePending.delete(id);
    clearTimeout(waiting.timer);
    if (waiting.signal) waiting.signal.removeEventListener('abort', waiting.abort);
    if (detail?.error) {
      const err = new Error(detail.error.message || 'Native cloud request failed.');
      err.code = detail.error.code || 'NATIVE_CLOUD_ERROR';
      waiting.reject(err);
      return;
    }
    waiting.resolve(detail || {});
  });
}

function nativeRequest(path, {
  method, payload, idempotencyKey, timeoutMs, signal, serverRequestId
}) {
  const bridge = nativeCloudHandler();
  if (!nativeCloudAvailable() || !bridge) {
    const err = new Error('Native Pri cloud transport is not configured. Offline learning remains available.');
    err.code = 'CLOUD_DISABLED';
    return Promise.reject(err);
  }
  installNativeListener();
  const id = `native-${requestId()}`.slice(0, 120);
  return new Promise((resolve, reject) => {
    const timeout = Math.max(1000, Math.min(60_000, Number(timeoutMs) || DEFAULT_TIMEOUT_MS));
    const abort = () => {
      if (!nativePending.has(id)) return;
      nativePending.delete(id);
      clearTimeout(timer);
      try { bridge.postMessage({ id, action: 'cancel' }); } catch {}
      const err = signal?.reason instanceof Error ? signal.reason : new DOMException('Aborted', 'AbortError');
      reject(err);
    };
    const timer = setTimeout(() => {
      if (!nativePending.has(id)) return;
      nativePending.delete(id);
      try { bridge.postMessage({ id, action: 'cancel' }); } catch {}
      const err = new DOMException('Timed out', 'TimeoutError');
      reject(err);
    }, timeout);
    nativePending.set(id, { resolve, reject, timer, signal, abort });
    if (signal) {
      if (signal.aborted) {
        abort();
        return;
      }
      signal.addEventListener('abort', abort, { once: true });
    }
    try {
      bridge.postMessage({
        id,
        action: 'request',
        path,
        method,
        requestId: serverRequestId,
        ...(idempotencyKey ? { idempotencyKey: String(idempotencyKey).slice(0, 160) } : {}),
        ...(payload === undefined ? {} : { body: payload })
      });
    } catch (error) {
      nativePending.delete(id);
      clearTimeout(timer);
      if (signal) signal.removeEventListener('abort', abort);
      reject(error);
    }
  });
}

export async function cloudRequest(path, {
  method = 'GET', body = undefined, idempotencyKey = null, timeoutMs = DEFAULT_TIMEOUT_MS, signal = null
} = {}) {
  if (!PATH.test(String(path || '')) || String(path).includes('..')) throw new Error('Cloud path is not allowed');
  const verb = String(method || 'GET').toUpperCase();
  if (!['GET', 'POST', 'PATCH', 'DELETE'].includes(verb)) throw new Error('Cloud method is not allowed');

  let payload;
  if (body !== undefined) {
    payload = JSON.stringify(body);
    if (byteLength(payload) > 1024 * 1024) throw new Error('Cloud request is too large');
  }

  const rid = requestId();
  if (nativeCloudAvailable()) {
    const result = await nativeRequest(path, {
      method: verb, payload, idempotencyKey, timeoutMs, signal, serverRequestId: rid
    });
    const text = String(result?.body || '');
    if (byteLength(text) > MAX_RESPONSE_BYTES) throw new Error('Cloud response exceeded safety limit');
    const data = parseJson(text);
    const status = Number(result?.status) || 0;
    if (status < 200 || status >= 300) {
      const err = new Error(data?.error?.message || data?.error || `Cloud request failed (${status || 'native'})`);
      err.status = status || undefined;
      err.code = data?.error?.code || 'CLOUD_REQUEST_FAILED';
      err.requestId = result?.requestId || rid;
      throw err;
    }
    return data;
  }

  const origin = normalizeCloudOrigin();
  if (!origin) {
    const err = new Error('Cloud is not configured; local Pri Learning remains available offline.');
    err.code = 'CLOUD_DISABLED';
    throw err;
  }

  const headers = { Accept: 'application/json', 'X-Pri-Request-Id': rid, 'X-Pri-Client': 'web-v1' };
  const csrf = cookie('pri_csrf');
  if (csrf && verb !== 'GET') headers['X-Pri-CSRF'] = csrf;
  if (idempotencyKey) headers['Idempotency-Key'] = String(idempotencyKey).slice(0, 160);
  if (payload !== undefined) headers['Content-Type'] = 'application/json';

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new DOMException('Timed out', 'TimeoutError')), Math.max(1000, Math.min(60_000, Number(timeoutMs) || DEFAULT_TIMEOUT_MS)));
  const abort = () => controller.abort(signal?.reason || new DOMException('Aborted', 'AbortError'));
  if (signal) {
    if (signal.aborted) abort();
    else signal.addEventListener('abort', abort, { once: true });
  }

  try {
    const response = await fetch(`${origin}${path}`, {
      method: verb,
      headers,
      body: payload,
      credentials: 'include',
      cache: 'no-store',
      redirect: 'error',
      signal: controller.signal
    });
    const text = await response.text();
    if (byteLength(text) > MAX_RESPONSE_BYTES) throw new Error('Cloud response exceeded safety limit');
    const data = parseJson(text);
    if (!response.ok) {
      const err = new Error(data?.error?.message || data?.error || `Cloud request failed (${response.status})`);
      err.status = response.status;
      err.code = data?.error?.code || 'CLOUD_REQUEST_FAILED';
      err.requestId = response.headers.get('x-pri-request-id') || rid;
      throw err;
    }
    return data;
  } finally {
    clearTimeout(timer);
    if (signal) signal.removeEventListener('abort', abort);
  }
}

export const cloud = Object.freeze({
  health: () => cloudRequest('/v1/health'),
  me: () => cloudRequest('/v1/account/me'),
  register: body => cloudRequest('/v1/account/register', { method: 'POST', body }),
  login: body => cloudRequest('/v1/account/login', { method: 'POST', body }),
  logout: () => cloudRequest('/v1/account/logout', { method: 'POST', body: {} }),
  requestEmailVerification: () => cloudRequest('/v1/account/email/verification-request', { method: 'POST', body: {} }),
  requestPasswordReset: body => cloudRequest('/v1/account/password/reset-request', { method: 'POST', body }),
  resetPassword: body => cloudRequest('/v1/account/password/reset', { method: 'POST', body }),
  changePassword: body => cloudRequest('/v1/account/password', { method: 'PATCH', body }),
  verifyEmail: body => cloudRequest('/v1/account/email/verify', { method: 'POST', body }),
  devices: () => cloudRequest('/v1/account/devices'),
  revokeDevice: sessionId => cloudRequest(`/v1/account/devices/${pathId(sessionId, 'session id')}`, { method: 'DELETE' }),
  exportAccount: () => cloudRequest('/v1/account/export'),
  deleteAccount: body => cloudRequest('/v1/account', { method: 'DELETE', body }),
  identities: () => cloudRequest('/v1/account/identity'),
  socialSignIn: (provider, body) => cloudRequest(`/v1/account/identity/${pathId(provider, 'provider')}/sign-in`, { method: 'POST', body }),
  linkIdentity: (provider, body) => cloudRequest(`/v1/account/identity/${pathId(provider, 'provider')}/link`, { method: 'POST', body }),
  syncPush: (body, idempotencyKey) => cloudRequest('/v1/sync/push', { method: 'POST', body, idempotencyKey }),
  syncPull: cursor => cloudRequest(`/v1/sync/pull/${Math.max(0, Number(cursor) || 0)}`),
  entitlements: () => cloudRequest('/v1/entitlements'),
  billingConfig: () => cloudRequest('/v1/billing/config'),
  billingStatus: () => cloudRequest('/v1/billing/status'),
  createWebBillingCheckout: cadence => cloudRequest('/v1/billing/checkout/web', { method: 'POST', body: { cadence } }),
  appleBillingBootstrap: () => cloudRequest('/v1/billing/apple/bootstrap'),
  submitAppleTransaction: signedTransaction => cloudRequest('/v1/billing/apple/transaction', {
    method: 'POST', body: { signedTransaction: String(signedTransaction || '') }
  }),
  restoreBilling: (provider, body = {}) => cloudRequest(`/v1/billing/restore/${pathId(provider, 'provider')}`, { method: 'POST', body }),
  classes: () => cloudRequest('/v1/classes'),
  reportIssue: (body, idempotencyKey) => cloudRequest('/v1/reports', { method: 'POST', body, idempotencyKey }),
  telemetry: events => cloudRequest('/v1/telemetry', { method: 'POST', body: { events } })
});
