// Pri Learning · audited cloud transport boundary
//
// This is the only client module permitted to open production HTTP connections.
// In a browser it uses fetch. Inside a native shell it delegates the same
// bounded request contract to the shell's cloud capability through priNative
// (CP-02) — on Apple that is NativeCloudBridge, which owns HTTPS cookies/CSRF
// outside the `prilearning://` WKWebView. JavaScript never sees those cookies.
import { priNative } from './native/index.js';

const DEFAULT_TIMEOUT_MS = 12_000;
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;
const PATH = /^\/v1\/[A-Za-z0-9/_-]{1,180}$/;
const SAFE_ID = /^[A-Za-z0-9._:-]{1,160}$/;

// Cloud origin discovery, in order of authority:
//   1. the origin that served this page, when it is the Pri platform server
//      (its /v1/health identifies `pri-learning-platform`) — set on
//      globalThis.__PRI_CLOUD_ORIGIN__ by discoverCloudOrigin() at boot, which
//      is also where the iOS shell and the browser tours inject an origin;
//   2. VITE_PRI_CLOUD_ORIGIN, baked in at build time;
//   3. <meta name="pri-cloud-origin"> in index.html, which a static host can
//      stamp into an already-built bundle.
// docs/production-deployment.md (Client) documents the same order.
const ORIGIN_META = 'pri-cloud-origin';
const HEALTH_SERVICE = 'pri-learning-platform';
let discovery = null;

function metaOrigin() {
  try { return String(globalThis.document?.querySelector?.(`meta[name="${ORIGIN_META}"]`)?.getAttribute('content') || '').trim(); }
  catch { return ''; }
}

function envOrigin() {
  const injected = globalThis.__PRI_CLOUD_ORIGIN__;
  const vite = import.meta?.env?.VITE_PRI_CLOUD_ORIGIN;
  return String(injected || vite || metaOrigin() || '').trim();
}

export async function readReleaseIdentityManifest({ timeoutMs = 1500 } = {}) {
  const loc = globalThis.location;
  if (!loc || !/^https?:$/.test(String(loc.protocol || '')) || typeof fetch !== 'function') return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new DOMException('Timed out', 'TimeoutError')), Math.max(200, Math.min(10_000, Number(timeoutMs) || 1500)));
  try {
    const response = await fetch(`${loc.origin}/release.json`, {
      method: 'GET',
      headers: { Accept: 'application/json', 'X-Pri-Client': 'web-v1' },
      credentials: 'same-origin',
      cache: 'no-store',
      redirect: 'error',
      signal: controller.signal
    });
    if (!response.ok || !/json/i.test(response.headers.get('content-type') || '')) return null;
    const text = await response.text();
    if (byteLength(text) > 64 * 1024) return null;
    return parseJson(text);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Probe the serving origin once for the platform health signature and, when it
 * answers, make that origin the cloud authority. Resolves to the origin or
 * null; never throws, never delays boot for more than `timeoutMs`.
 */
export function discoverCloudOrigin({ timeoutMs = 1500 } = {}) {
  if (discovery) return discovery;
  discovery = (async () => {
    const injected = String(globalThis.__PRI_CLOUD_ORIGIN__ || '').trim();
    if (injected) return injected;
    if (nativeCloudAvailable()) return null;
    const loc = globalThis.location;
    if (!loc || !/^https?:$/.test(String(loc.protocol || '')) || typeof fetch !== 'function') return null;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(new DOMException('Timed out', 'TimeoutError')), Math.max(200, Math.min(10_000, Number(timeoutMs) || 1500)));
    try {
      const response = await fetch(`${loc.origin}/v1/health`, {
        method: 'GET',
        headers: { Accept: 'application/json', 'X-Pri-Client': 'web-v1' },
        credentials: 'omit',
        cache: 'no-store',
        redirect: 'error',
        signal: controller.signal
      });
      if (!response.ok || !/json/i.test(response.headers.get('content-type') || '')) return null;
      const text = await response.text();
      if (byteLength(text) > 64 * 1024) return null;
      const data = parseJson(text);
      if (data?.service !== HEALTH_SERVICE) return null;
      const origin = normalizeCloudOrigin(loc.origin);
      globalThis.__PRI_CLOUD_ORIGIN__ = origin;
      return origin;
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  })();
  return discovery;
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

// Fails closed: the shell advertises `cloud` only with `configured: true` when
// its signed release metadata names an HTTPS cloud origin.
/** Disconnect: drop the session the native shell holds (no-op in a browser,
 * where the HttpOnly session cookie belongs to the browser and logout clears it). */
export function forgetNativeCloudSession() {
  return priNative.isNativeShell() ? priNative.cloud.forgetSession() : Promise.resolve(false);
}

export function nativeCloudAvailable() {
  return priNative.cloud.available();
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

// Native errors arrive in the closed priNative model; keep this module's
// long-standing contract for callers: DOMException TimeoutError/AbortError for
// timeouts and aborts, and CLOUD_* / provider codes on everything else.
function nativeFailure(error, signal) {
  if (error?.code === 'TIMEOUT') return new DOMException('Timed out', 'TimeoutError');
  if (error?.code === 'CANCELLED') return signal?.reason instanceof Error ? signal.reason : new DOMException('Aborted', 'AbortError');
  const err = new Error(error?.message || 'Native cloud request failed.');
  err.code = error?.code === 'UNAVAILABLE' && !error?.detail?.providerCode
    ? 'CLOUD_DISABLED'
    : (error?.detail?.providerCode || 'NATIVE_CLOUD_ERROR');
  return err;
}

async function nativeRequest(path, {
  method, payload, idempotencyKey, timeoutMs, signal, serverRequestId
}) {
  if (!nativeCloudAvailable()) {
    const err = new Error('Native Pri cloud transport is not configured. Offline learning remains available.');
    err.code = 'CLOUD_DISABLED';
    throw err;
  }
  try {
    return await priNative.cloud.request(
      { path, method, body: payload, requestId: serverRequestId, idempotencyKey: idempotencyKey || undefined },
      { timeoutMs: Math.max(1000, Math.min(60_000, Number(timeoutMs) || DEFAULT_TIMEOUT_MS)), signal }
    );
  } catch (error) {
    throw nativeFailure(error, signal);
  }
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
      if (Number.isFinite(Number(data?.error?.resetAt))) err.resetAt = Number(data.error.resetAt);
      if (data?.error?.quota && typeof data.error.quota === 'object') err.quota = data.error.quota;
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
      if (Number.isFinite(Number(data?.error?.resetAt))) err.resetAt = Number(data.error.resetAt);
      if (data?.error?.quota && typeof data.error.quota === 'object') err.quota = data.error.quota;
      err.requestId = response.headers.get('x-pri-request-id') || rid;
      throw err;
    }
    return data;
  } finally {
    clearTimeout(timer);
    if (signal) signal.removeEventListener('abort', abort);
  }
}

// ── The tutor's streamed turn ────────────────────────────────────────────────
//
// The one streamed request this boundary makes: POST /v1/tutor/stream answers
// as server-sent events (text/event-stream), read here with a ReadableStream
// reader so each guarded sentence reaches the student as the server releases
// it. Same cookie, CSRF, origin, redirect and cache discipline as cloudRequest;
// the response is bounded in bytes and in time like any other. Inside a native
// shell there is no streaming channel (priNative.cloud is request/response), so
// the caller is told to use /v1/tutor/help instead; the same code is thrown
// when an older server answers 404, which is how the compatibility fallback
// (docs/release/release-policy.md CP-11) is driven.
const MAX_STREAM_BYTES = 256 * 1024;

/** Split an SSE byte buffer into complete events; `state.tail` carries the rest. */
export function parseSseChunk(text, state) {
  const all = (state.tail || '') + text;
  const blocks = all.split(/\r?\n\r?\n/);
  state.tail = blocks.pop() || '';
  const events = [];
  for (const block of blocks) {
    let event = 'message';
    const data = [];
    for (const line of block.split(/\r?\n/)) {
      if (line.startsWith('event:')) event = line.slice(6).trim();
      else if (line.startsWith('data:')) data.push(line.slice(5).trim());
    }
    if (!data.length) continue;
    let parsed = null;
    try { parsed = JSON.parse(data.join('\n')); } catch { continue; }
    events.push({ event, data: parsed });
  }
  return events;
}

function streamUnsupported(status) {
  const err = new Error('The streaming tutor is not available here; use the request route.');
  err.code = 'TUTOR_STREAM_UNSUPPORTED';
  if (status) err.status = status;
  return err;
}

/**
 * POST a tutor turn and read its event stream. `onEvent({ event, data })` is
 * called for every event in order; the promise resolves when the stream ends.
 * Throws TUTOR_STREAM_UNSUPPORTED in a native shell or when the server has no
 * /v1/tutor/stream (404), and the ordinary coded errors for any JSON refusal.
 */
export async function cloudStreamRequest(path, { body, onEvent, timeoutMs = 45_000, signal = null } = {}) {
  if (!PATH.test(String(path || '')) || String(path).includes('..')) throw new Error('Cloud path is not allowed');
  if (nativeCloudAvailable()) throw streamUnsupported();
  const origin = normalizeCloudOrigin();
  if (!origin) {
    const err = new Error('Cloud is not configured; local Pri Learning remains available offline.');
    err.code = 'CLOUD_DISABLED';
    throw err;
  }
  const payload = JSON.stringify(body ?? {});
  if (byteLength(payload) > 1024 * 1024) throw new Error('Cloud request is too large');
  const rid = requestId();
  const headers = { Accept: 'text/event-stream', 'Content-Type': 'application/json', 'X-Pri-Request-Id': rid, 'X-Pri-Client': 'web-v1' };
  const csrf = cookie('pri_csrf');
  if (csrf) headers['X-Pri-CSRF'] = csrf;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new DOMException('Timed out', 'TimeoutError')), Math.max(1000, Math.min(120_000, Number(timeoutMs) || 45_000)));
  const abort = () => controller.abort(signal?.reason || new DOMException('Aborted', 'AbortError'));
  if (signal) {
    if (signal.aborted) abort();
    else signal.addEventListener('abort', abort, { once: true });
  }
  try {
    const response = await fetch(`${origin}${path}`, {
      method: 'POST',
      headers,
      body: payload,
      credentials: 'include',
      cache: 'no-store',
      redirect: 'error',
      signal: controller.signal
    });
    const type = response.headers.get('content-type') || '';
    if (!/text\/event-stream/i.test(type)) {
      const text = await response.text();
      if (byteLength(text) > MAX_RESPONSE_BYTES) throw new Error('Cloud response exceeded safety limit');
      const data = parseJson(text);
      if (response.status === 404) throw streamUnsupported(404);
      const err = new Error(data?.error?.message || data?.error || `Cloud request failed (${response.status})`);
      err.status = response.status;
      err.code = data?.error?.code || 'CLOUD_REQUEST_FAILED';
      if (Number.isFinite(Number(data?.error?.resetAt))) err.resetAt = Number(data.error.resetAt);
      if (data?.error?.quota && typeof data.error.quota === 'object') err.quota = data.error.quota;
      err.requestId = response.headers.get('x-pri-request-id') || rid;
      throw err;
    }
    if (!response.body?.getReader) throw streamUnsupported();
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    const state = { tail: '' };
    let received = 0;
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      received += value?.byteLength || 0;
      if (received > MAX_STREAM_BYTES) { await reader.cancel().catch(() => {}); throw new Error('Cloud response exceeded safety limit'); }
      for (const event of parseSseChunk(decoder.decode(value, { stream: true }), state)) onEvent?.(event);
    }
    for (const event of parseSseChunk('\n\n', state)) onEvent?.(event);
    return { requestId: response.headers.get('x-pri-request-id') || rid };
  } finally {
    clearTimeout(timer);
    if (signal) signal.removeEventListener('abort', abort);
  }
}

export const cloud = Object.freeze({
  health: () => cloudRequest('/v1/health'),
  me: () => cloudRequest('/v1/account/me'),
  register: body => cloudRequest('/v1/account/register', { method: 'POST', body }),
  // A guardian answering the email has no account and no session — the token in
  // their link is the whole authority, which is why it is single-use, hashed at
  // rest and expires in an hour.
  guardianConfirm: token => cloudRequest('/v1/account/guardian/confirm', { method: 'POST', body: { token } }),
  guardianWithdraw: token => cloudRequest('/v1/account/guardian/withdraw', { method: 'POST', body: { token } }),
  guardianState: () => cloudRequest('/v1/account/guardian/state'),
  // Staff second factor (server/platform/mfa.js). The secret and the recovery
  // codes pass through here once, to the panel, and are never persisted.
  mfaStatus: () => cloudRequest('/v1/account/mfa/status'),
  mfaEnrol: () => cloudRequest('/v1/account/mfa/totp/enrol', { method: 'POST', body: {} }),
  mfaConfirm: code => cloudRequest('/v1/account/mfa/totp/confirm', { method: 'POST', body: { code } }),
  mfaVerify: body => cloudRequest('/v1/account/mfa/verify', { method: 'POST', body }),
  login: body => cloudRequest('/v1/account/login', { method: 'POST', body }),
  // One-time codes (server/platform/otp.js). /request answers the same for an
  // address with or without an account; /verify proves it.
  otpRequest: body => cloudRequest('/v1/account/otp/request', { method: 'POST', body }),
  otpVerify: body => cloudRequest('/v1/account/otp/verify', { method: 'POST', body }),
  otpReauthRequest: () => cloudRequest('/v1/account/otp/reauth-request', { method: 'POST', body: {} }),
  guardianOtpRequest: body => cloudRequest('/v1/account/otp/guardian/request', { method: 'POST', body }),
  guardianOtpApprove: body => cloudRequest('/v1/account/otp/guardian/approve', { method: 'POST', body }),
  guardianWithdrawRequest: body => cloudRequest('/v1/account/otp/guardian/withdraw-request', { method: 'POST', body }),
  guardianWithdrawByPhone: body => cloudRequest('/v1/account/otp/guardian/withdraw', { method: 'POST', body }),
  logout: () => cloudRequest('/v1/account/logout', { method: 'POST', body: {} }),
  requestEmailVerification: () => cloudRequest('/v1/account/email/verification-request', { method: 'POST', body: {} }),
  requestPasswordReset: body => cloudRequest('/v1/account/password/reset-request', { method: 'POST', body }),
  resetPassword: body => cloudRequest('/v1/account/password/reset', { method: 'POST', body }),
  changePassword: body => cloudRequest('/v1/account/password', { method: 'PATCH', body }),
  verifyEmail: body => cloudRequest('/v1/account/email/verify', { method: 'POST', body }),
  devices: () => cloudRequest('/v1/account/devices'),
  revokeDevice: sessionId => cloudRequest(`/v1/account/devices/${pathId(sessionId, 'session id')}`, { method: 'DELETE' }),
  exportAccount: () => cloudRequest('/v1/account/export'),
  // Server-side handwriting reading. The body carries the student's own ink as
  // a picture and nothing else: no question, no expected answer, no profile.
  handwritingStatus: ({ signal = null, timeoutMs = 7000 } = {}) =>
    cloudRequest('/v1/handwriting/status', { signal, timeoutMs }),
  // Longer than the server's own reading budget (PRI_HANDWRITING_TIMEOUT_MS,
  // 45 s by default) so the server answers before the client gives up.
  transcribeHandwriting: (image, { signal = null, timeoutMs = 55000 } = {}) =>
    cloudRequest('/v1/handwriting/transcribe', { method: 'POST', body: { image }, signal, timeoutMs }),
  workingStatus: () => cloudRequest('/v1/working/status'),
  // The question is sent; the expected answer never is, and the route refuses
  // a body that carries one.
  checkWorking: (prompt, lines, { signal = null, timeoutMs = 35000 } = {}) =>
    cloudRequest('/v1/working/check', { method: 'POST', body: { prompt, lines }, signal, timeoutMs }),
  // "Practise this": one photo of a printed question, nothing else. The reply
  // proposes a chapter and skill; it never carries a mark or an answer.
  identifyQuestionPhoto: (image, { signal = null, timeoutMs = 25000 } = {}) =>
    cloudRequest('/v1/question-photo/identify', { method: 'POST', body: { image }, signal, timeoutMs }),
  // The AI tutor is sent the verified solution it must stay grounded in — it
  // is not a reader, and /v1/handwriting never receives one. Exam rows never
  // reach here: the local backend refuses them first.
  tutorHelp: (body, { signal = null, timeoutMs = 25000 } = {}) =>
    cloudRequest('/v1/tutor/help', { method: 'POST', body, signal, timeoutMs }),
  // The same body, answered as server-sent events (see cloudStreamRequest).
  tutorStream: (body, { onEvent, signal = null, timeoutMs = 45000 } = {}) =>
    cloudStreamRequest('/v1/tutor/stream', { body, onEvent, signal, timeoutMs }),
  deleteAccount: body => cloudRequest('/v1/account', { method: 'DELETE', body }),
  identities: () => cloudRequest('/v1/account/identity'),
  // Provider sign-in: Google/Apple in the browser (platform/socialSignIn.js)
  // and Sign in with Apple through the native shell (platform/native/
  // appleSignIn.js). The server says which providers this deployment offers,
  // and issues the nonce the provider token must carry back; it is stored
  // hashed, accepted once and expires.
  identityProviders: () => cloudRequest('/v1/account/identity/providers'),
  identityNonce: () => cloudRequest('/v1/account/identity/nonce', { method: 'POST', body: {} }),
  socialSignIn: (provider, body) => cloudRequest(`/v1/account/identity/${pathId(provider, 'provider')}/sign-in`, { method: 'POST', body }),
  linkIdentity: (provider, body) => cloudRequest(`/v1/account/identity/${pathId(provider, 'provider')}/link`, { method: 'POST', body }),
  syncPush: (body, idempotencyKey) => cloudRequest('/v1/sync/push', { method: 'POST', body, idempotencyKey }),
  syncPull: cursor => cloudRequest(`/v1/sync/pull/${Math.max(0, Number(cursor) || 0)}`),
  entitlements: () => cloudRequest('/v1/entitlements'),
  billingConfig: () => cloudRequest('/v1/billing/config'),
  billingStatus: () => cloudRequest('/v1/billing/status'),
  // Web (Razorpay) checkout is never opened from a native shell: there the
  // App Store is the only purchase path (PRI_V1_RELEASE_SCOPE §12). The server
  // refuses it for native clients as well.
  createWebBillingCheckout: cadence => (priNative.isNativeShell()
    ? Promise.reject(Object.assign(new Error('Purchases in the app use the App Store.'), { code: 'BILLING_WEB_CHECKOUT_NATIVE_REFUSED' }))
    : cloudRequest('/v1/billing/checkout/web', { method: 'POST', body: { cadence } })),
  appleBillingBootstrap: () => cloudRequest('/v1/billing/apple/bootstrap'),
  submitAppleTransaction: signedTransaction => cloudRequest('/v1/billing/apple/transaction', {
    method: 'POST', body: { signedTransaction: String(signedTransaction || '') }
  }),
  googleBillingBootstrap: () => cloudRequest('/v1/billing/google/bootstrap'),
  submitGooglePurchase: purchaseToken => cloudRequest('/v1/billing/google/purchase', {
    method: 'POST', body: { purchaseToken: String(purchaseToken || '') }
  }),
  restoreBilling: (provider, body = {}) => cloudRequest(`/v1/billing/restore/${pathId(provider, 'provider')}`, { method: 'POST', body }),
  // Cancel/manage contract (server: wp/server-commerce-classes). Web cancels at
  // the end of the paid cycle; Apple subscriptions are managed in the App Store.
  cancelWebBilling: () => cloudRequest('/v1/billing/web/cancel', { method: 'POST', body: {} }),
  billingManage: () => cloudRequest('/v1/billing/manage'),
  classes: () => cloudRequest('/v1/classes'),
  classDetails: classId => cloudRequest(`/v1/classes/${pathId(classId, 'class id')}`),
  classStudents: classId => cloudRequest(`/v1/classes/${pathId(classId, 'class id')}/students`),
  createClass: name => cloudRequest('/v1/classes', { method: 'POST', body: { name } }),
  joinClass: code => cloudRequest('/v1/classes/join', { method: 'POST', body: { code } }),
  createAssignment: (classId, body) => cloudRequest(`/v1/classes/${pathId(classId, 'class id')}/assignments`, { method: 'POST', body }),
  assignments: () => cloudRequest('/v1/assignments'),
  assignmentDetails: (classId, assignmentId) => cloudRequest(`/v1/assignments/${pathId(classId, 'class id')}/${pathId(assignmentId, 'assignment id')}`),
  updateSubmission: (classId, assignmentId, body) => cloudRequest(`/v1/classes/${pathId(classId, 'class id')}/assignments/${pathId(assignmentId, 'assignment id')}/submission`, { method: 'PATCH', body }),
  returnSubmission: (classId, assignmentId, studentId, feedback = {}) => cloudRequest(`/v1/classes/${pathId(classId, 'class id')}/assignments/${pathId(assignmentId, 'assignment id')}/submissions/${pathId(studentId, 'student id')}/return`, { method: 'POST', body: { feedback } }),
  contentRevisions: () => cloudRequest('/v1/content/admin/revisions'),
  createContentDraft: body => cloudRequest('/v1/content/drafts', { method: 'POST', body }),
  updateContentDraft: (revisionId, body) => cloudRequest(`/v1/content/drafts/${pathId(revisionId, 'revision id')}`, { method: 'PATCH', body }),
  submitContentReview: revisionId => cloudRequest(`/v1/content/${pathId(revisionId, 'revision id')}/submit-review`, { method: 'POST', body: {} }),
  approveContent: revisionId => cloudRequest(`/v1/content/${pathId(revisionId, 'revision id')}/approve`, { method: 'POST', body: {} }),
  publishContent: revisionId => cloudRequest(`/v1/content/${pathId(revisionId, 'revision id')}/publish`, { method: 'POST', body: {} }),
  adminHealth: () => cloudRequest('/v1/admin/health'),
  adminUsers: () => cloudRequest('/v1/admin/users'),
  updateUserRole: (accountId, role) => cloudRequest(`/v1/admin/users/${pathId(accountId, 'account id')}/role`, { method: 'PATCH', body: { role } }),
  adminAudit: () => cloudRequest('/v1/admin/audit'),
  reportIssue: (body, idempotencyKey) => cloudRequest('/v1/reports', { method: 'POST', body, idempotencyKey }),
  telemetry: events => cloudRequest('/v1/telemetry', { method: 'POST', body: { events } })
});
