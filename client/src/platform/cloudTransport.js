// Pri Learning · audited cloud transport boundary
//
// This is the only client module permitted to open production HTTP connections.
// All learning UI remains offline-first and talks to the local backend first.
// Callers explicitly opt into cloud operations and must tolerate this transport
// being disabled/unavailable.

const DEFAULT_TIMEOUT_MS = 12_000;
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;
const PATH = /^\/v1\/[A-Za-z0-9/_-]{1,180}$/;
const SAFE_ID = /^[A-Za-z0-9._:-]{1,160}$/;

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

export function cloudAvailable() {
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

export async function cloudRequest(path, {
  method = 'GET', body = undefined, idempotencyKey = null, timeoutMs = DEFAULT_TIMEOUT_MS, signal = null
} = {}) {
  const origin = normalizeCloudOrigin();
  if (!origin) {
    const err = new Error('Cloud is not configured; local Pri Learning remains available offline.');
    err.code = 'CLOUD_DISABLED';
    throw err;
  }
  if (!PATH.test(String(path || '')) || String(path).includes('..')) throw new Error('Cloud path is not allowed');
  const verb = String(method || 'GET').toUpperCase();
  if (!['GET', 'POST', 'PATCH', 'DELETE'].includes(verb)) throw new Error('Cloud method is not allowed');

  const headers = { Accept: 'application/json', 'X-Pri-Request-Id': requestId(), 'X-Pri-Client': 'web-v1' };
  const csrf = cookie('pri_csrf');
  if (csrf && verb !== 'GET') headers['X-Pri-CSRF'] = csrf;
  if (idempotencyKey) headers['Idempotency-Key'] = String(idempotencyKey).slice(0, 160);

  let payload;
  if (body !== undefined) {
    payload = JSON.stringify(body);
    if (byteLength(payload) > 1024 * 1024) throw new Error('Cloud request is too large');
    headers['Content-Type'] = 'application/json';
  }

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
    let data = null;
    if (text) {
      try { data = JSON.parse(text); }
      catch {
        const err = new Error('Cloud returned invalid JSON');
        err.code = 'CLOUD_BAD_RESPONSE';
        throw err;
      }
    }
    if (!response.ok) {
      const err = new Error(data?.error?.message || data?.error || `Cloud request failed (${response.status})`);
      err.status = response.status;
      err.code = data?.error?.code || 'CLOUD_REQUEST_FAILED';
      err.requestId = response.headers.get('x-pri-request-id') || headers['X-Pri-Request-Id'];
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