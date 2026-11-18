// Pri Learning · audited cloud transport boundary
//
// This is the only client module permitted to open production HTTP connections.
// In a browser it uses fetch. Inside a native shell it delegates the same
// bounded request contract to the shell's cloud capability through priNative
// (CP-02) — on Apple that is NativeCloudBridge, which owns HTTPS cookies/CSRF
// outside the `prilearning://` WKWebView. JavaScript never sees those cookies.
import { priNative } from './native/index.js';
import { EDITION, EDITION_HEADER, editionConflict } from './edition.js';

const DEFAULT_TIMEOUT_MS = 12_000;
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;
const PATH = /^\/v1\/[A-Za-z0-9/_-]{1,180}$/;
const SAFE_ID = /^[A-Za-z0-9._:-]{1,160}$/;
// An IANA zone name, as an entitlement refusal says whose midnight it lifts at.
const TIME_ZONE = /^[A-Za-z_]+(?:\/[A-Za-z0-9_+-]+){0,2}$/;

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
let lastRediscovery = 0;

function metaOrigin() {
  try { return String(globalThis.document?.querySelector?.(`meta[name="${ORIGIN_META}"]`)?.getAttribute('content') || '').trim(); }
  catch { return ''; }
}

function envOrigin() {
  const injected = globalThis.__PRI_CLOUD_ORIGIN__;
  const vite = import.meta?.env?.VITE_PRI_CLOUD_ORIGIN;
  return String(injected || vite || metaOrigin() || '').trim();
}

/**
 * The live app shell, read from the network as a Response; or null when it cannot be read as HTML.
 *
 * The service worker answers every same-origin GET from its precache first, and "/" is precached, so a plain
 * request for "/" (even with cache: 'reload') would be answered with the very shell being replaced. The request
 * therefore carries a search string naming the live build ("/?shell=<sha>"): it never matches a precache key, and
 * the worker does not keep a response for a path that is not a build asset (public/sw.js CACHEABLE). Used only to
 * refresh the offline shell before a release reload (platform/freshBuild.js).
 */
export function liveShellUrl(origin, liveSha) {
  return `${origin}/?shell=${encodeURIComponent(String(liveSha || '').toLowerCase())}`;
}

export async function readLiveShell(liveSha, { timeoutMs = 8000 } = {}) {
  const loc = globalThis.location;
  if (!loc || !/^https?:$/.test(String(loc.protocol || '')) || typeof fetch !== 'function') return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new DOMException('Timed out', 'TimeoutError')), Math.max(500, Math.min(20_000, Number(timeoutMs) || 8000)));
  try {
    const response = await fetch(liveShellUrl(loc.origin, liveSha), {
      method: 'GET', headers: { Accept: 'text/html' }, credentials: 'same-origin', cache: 'reload', redirect: 'error', signal: controller.signal
    });
    if (response.status !== 200 || !/html/i.test(response.headers.get('content-type') || '')) return null;
    return response;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
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
 *
 * That last promise is kept here and not by the request: the time limit both
 * aborts the request and settles the probe. Aborting alone left the bound in
 * the hands of whatever was answering the request — a service worker, a
 * captive portal, an in-app browser — and the first render waits on this.
 */
// What the last health probe heard: `answered` is true when ANY HTTP answer
// came back (a 503, a non-JSON page, another service), false when none did
// (a network error or the time limit). The activation gate's offline grace is
// for "nothing answered" only: a live server that answered is not offline.
let lastProbe = { answered: null, at: 0 };
export const lastCloudProbe = () => ({ ...lastProbe });

export function discoverCloudOrigin({ timeoutMs = 1500 } = {}) {
  if (discovery) return discovery;
  discovery = (async () => {
    // Each attempt says only what IT heard: a probe that never runs (an
    // injected origin, a native shell, no web origin) leaves "unknown".
    lastProbe = { answered: null, at: 0 };
    const injected = String(globalThis.__PRI_CLOUD_ORIGIN__ || '').trim();
    if (injected) return injected;
    if (nativeCloudAvailable()) return null;
    const loc = globalThis.location;
    if (!loc || !/^https?:$/.test(String(loc.protocol || '')) || typeof fetch !== 'function') return null;
    const controller = new AbortController();
    let answered = false;
    let timer;
    const limit = new Promise(resolve => {
      timer = setTimeout(() => {
        resolve(null);
        try { controller.abort(new DOMException('Timed out', 'TimeoutError')); } catch { /* nothing left to abort */ }
      }, Math.max(200, Math.min(10_000, Number(timeoutMs) || 1500)));
    });
    const asked = (async () => {
      const response = await fetch(`${loc.origin}/v1/health`, {
        method: 'GET',
        headers: { Accept: 'application/json', 'X-Pri-Client': 'web-v1' },
        credentials: 'omit',
        cache: 'no-store',
        redirect: 'error',
        signal: controller.signal
      });
      answered = true;
      if (!response.ok || !/json/i.test(response.headers.get('content-type') || '')) return null;
      const text = await response.text();
      if (byteLength(text) > 64 * 1024) return null;
      const data = parseJson(text);
      if (data?.service !== HEALTH_SERVICE) return null;
      serverEditionAsked = true;
      hearServerEdition(data.edition);
      const origin = normalizeCloudOrigin(loc.origin);
      globalThis.__PRI_CLOUD_ORIGIN__ = origin;
      return origin;
    })().catch(() => null);
    try {
      return await Promise.race([asked, limit]);
    } finally {
      clearTimeout(timer);
      lastProbe = { answered, at: Date.now() };
    }
  })();
  // A page loaded while the server was unreachable must find it again once it
  // is back: only a successful probe is remembered.
  const attempt = discovery;
  attempt.then(found => { if (!found && discovery === attempt) discovery = null; });
  return discovery;
}

// ── One app, one edition (ADR-0002, plan E2) ────────────────────────────────
// This build is one edition (platform/edition.js) and so is the server it
// reaches. Every /v1 request from a browser declares the build's edition in
// X-Pri-Edition, which the server uses only to refuse (409 EDITION_MISMATCH);
// a native shell's own HTTP stack sends no such header, so the health reply's
// `edition` is compared here instead. Either way the outcome is one remembered
// conflict that main.jsx turns into the blocking screen. A server that names
// no edition (one from before editions) is not a conflict.
let editionMismatchState = null;
let serverEditionAsked = false;
let editionListener = null;

function hearServerEdition(serverEdition) {
  const conflict = editionConflict(serverEdition);
  if (!conflict || editionMismatchState) return;
  editionMismatchState = conflict;
  editionListener?.(conflict);
}

/** The conflict found so far ({ service }), or null. */
export const editionMismatch = () => editionMismatchState;

/** Call `listener(conflict)` once, when a conflict is found (one listener: the app root). */
export function onEditionMismatch(listener) { editionListener = listener; }

// A refusal's own field, on the error a caller sees: the server's edition id,
// or null when the body did not carry a plain one (the caller still gets the
// coded error; only a named service becomes the blocking screen).
function editionRefusal(err, data) {
  if (err.code !== 'EDITION_MISMATCH') return;
  err.serverEdition = editionConflict(data?.error?.serverEdition)?.service ?? null;
  hearServerEdition(err.serverEdition);
}

/**
 * Once per start: learn the server's edition and compare. In a browser served
 * by the platform the boot probe has already heard it and this asks nothing;
 * otherwise (a native shell, an injected origin) it reads /v1/health once.
 * Resolves to the conflict or null; never throws. An unreachable server is no
 * answer, and is asked again on the next start.
 */
export async function checkServerEdition() {
  if (!serverEditionAsked && cloudAvailable()) {
    serverEditionAsked = true;
    try { hearServerEdition((await cloudRequest('/v1/health'))?.edition); } catch { /* not reachable now */ }
  }
  return editionMismatchState;
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
  // A request correlation ID travels across the native/Web API boundary.
  // Never downgrade its unpredictability to Math.random or a timestamp if
  // randomUUID is unavailable in a supported WebView.
  const crypto = globalThis.crypto;
  try {
    if (typeof crypto?.randomUUID === 'function') return crypto.randomUUID();
    if (typeof crypto?.getRandomValues === 'function') {
      const bytes = new Uint8Array(16);
      crypto.getRandomValues(bytes);
      return 'req-' + Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
    }
  } catch { /* fail closed below when secure randomness is unavailable */ }
  const error = new Error('Secure cloud request identifiers are unavailable.');
  error.code = 'SECURE_RANDOM_UNAVAILABLE';
  throw error;
}

function byteLength(text) {
  try { return new TextEncoder().encode(text).byteLength; } catch { return text.length * 2; }
}

function pathId(value, label = 'id') {
  const id = String(value || '');
  if (!SAFE_ID.test(id)) throw new Error(`${label} is invalid`);
  return id;
}

const QUERY_KEY = /^[a-z]{1,16}$/;
/** `?k=v&…` (or `.csv`) for a browser GET: plain-id keys and values only, or it throws. */
function webOnlySuffix(verb, query, csv) {
  if (verb !== 'GET') throw new Error('Cloud query is not allowed');
  let out = csv ? '.csv' : '';
  const pairs = Object.entries(query || {});
  if (pairs.length > 4) throw new Error('Cloud query is not allowed');
  for (const [k, v] of pairs) {
    if (!QUERY_KEY.test(k) || !SAFE_ID.test(String(v ?? ''))) throw new Error('Cloud query is not allowed');
  }
  if (pairs.length) out += '?' + pairs.map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join('&');
  return out;
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

// The proofs a REAUTH_REQUIRED refusal names (server/platform/accounts.js
// proofMethods): only the known kinds, so a hostile body cannot grow the list.
const PROOF_KINDS = new Set(['password', 'otp', 'google', 'apple']);
const proofList = list => list.filter(kind => typeof kind === 'string' && PROOF_KINDS.has(kind)).slice(0, PROOF_KINDS.size);

export async function cloudRequest(path, {
  method = 'GET', body = undefined, idempotencyKey = null, timeoutMs = DEFAULT_TIMEOUT_MS, signal = null,
  query = null, csv = false, keepalive = false
} = {}) {
  if (!PATH.test(String(path || '')) || String(path).includes('..')) throw new Error('Cloud path is not allowed');
  const verb = String(method || 'GET').toUpperCase();
  if (!['GET', 'POST', 'PATCH', 'DELETE'].includes(verb)) throw new Error('Cloud method is not allowed');
  // A query string and a CSV export are never part of PATH (the native bridges
  // refuse both): they are added here, to a GET in a browser only, from named
  // parameters whose keys and values are plain ids.
  const extra = (query || csv) ? webOnlySuffix(verb, query, csv) : '';

  let payload;
  if (body !== undefined) {
    payload = JSON.stringify(body);
    if (byteLength(payload) > 1024 * 1024) throw new Error('Cloud request is too large');
  }

  const rid = requestId();
  if (nativeCloudAvailable()) {
    if (extra) {
      const err = new Error('This needs Pri in a web browser for now.');
      err.code = 'CLOUD_WEB_ONLY';
      throw err;
    }
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
      // An entitlement refusal names what it is about and when it lifts.
      if (typeof data?.error?.capability === 'string') err.capability = data.error.capability.slice(0, 60);
      for (const k of ['nextAt', 'used', 'limit', 'windowDays', 'attemptsRemaining']) if (Number.isFinite(Number(data?.error?.[k]))) err[k] = Number(data.error[k]);
      if (typeof data?.error?.timeZone === 'string' && TIME_ZONE.test(data.error.timeZone)) err.timeZone = data.error.timeZone;
      if (typeof data?.error?.openExamId === 'string' && SAFE_ID.test(data.error.openExamId)) err.openExamId = data.error.openExamId;
      // The Paper Generator's nearest valid paper when the banks cannot fill a request: numbers and a mix name only.
      if (data?.error?.code === 'PAPER_BANK_INSUFFICIENT') {
        const n = data.error.nearest;
        err.nearest = n && Number.isInteger(n.marks) && /^[a-z]{4,12}$/.test(String(n.mix)) ? { marks: n.marks, minutes: Number(n.minutes) || 0, mix: String(n.mix), questions: Number(n.questions) || 0 } : null;
      }
      if (Array.isArray(data?.error?.proofs)) err.proofs = proofList(data.error.proofs);
      // The plain-text reasons a publishing step was refused (plan F3), bounded.
      if (Array.isArray(data?.error?.problems)) err.problems = data.error.problems.filter(p => typeof p === 'string').slice(0, 12).map(p => p.slice(0, 300));
      editionRefusal(err, data);
      err.requestId = result?.requestId || rid;
      throw err;
    }
    return data;
  }

  // No server was found when the page loaded: look once more (briefly, and
  // not more than every few seconds) before saying there is none.
  if (!normalizeCloudOrigin() && Date.now() - lastRediscovery > 4000) {
    lastRediscovery = Date.now();
    await discoverCloudOrigin({ timeoutMs: 1500 });
  }
  const origin = normalizeCloudOrigin();
  if (!origin) {
    const err = new Error('Pri\'s server cannot be reached from this device right now.');
    err.code = 'CLOUD_DISABLED';
    throw err;
  }

  const headers = { Accept: csv ? 'text/csv, application/json' : 'application/json', 'X-Pri-Request-Id': rid, 'X-Pri-Client': 'web-v1', [EDITION_HEADER]: EDITION };
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
    const response = await fetch(`${origin}${path}${extra}`, {
      method: verb,
      headers,
      body: payload,
      credentials: 'include',
      cache: 'no-store',
      redirect: 'error',
      // A small request may outlive the page (a save sent as the tab closes); the browser refuses more than 64 kB.
      ...(keepalive && byteLength(payload || '') < 60_000 ? { keepalive: true } : {}),
      signal: controller.signal
    });
    const text = await response.text();
    if (byteLength(text) > MAX_RESPONSE_BYTES) throw new Error('Cloud response exceeded safety limit');
    // A CSV export answers with the file itself; its refusals are JSON like any other.
    if (csv && response.ok) return text;
    const data = parseJson(text);
    if (!response.ok) {
      const err = new Error(data?.error?.message || data?.error || `Cloud request failed (${response.status})`);
      err.status = response.status;
      err.code = data?.error?.code || 'CLOUD_REQUEST_FAILED';
      if (Number.isFinite(Number(data?.error?.resetAt))) err.resetAt = Number(data.error.resetAt);
      else {
        // When a limit lifts: the body's resetAt (epoch ms) first; the
        // standard RateLimit-Reset header (epoch seconds) when the body has none.
        const reset = Number(response.headers?.get?.('ratelimit-reset'));
        if ((response.status === 429 || response.status === 503) && Number.isFinite(reset) && reset > 0) err.resetAt = reset * 1000;
      }
      // A one-time-code cooldown answers with Retry-After (seconds): how long
      // until another code may be asked for.
      const retryAfter = Number(response.headers?.get?.('retry-after'));
      if (response.status === 429 && Number.isFinite(retryAfter) && retryAfter > 0) err.retryAfterMs = Math.min(retryAfter, 3600) * 1000;
      if (data?.error?.quota && typeof data.error.quota === 'object') err.quota = data.error.quota;
      // An entitlement refusal names what it is about and when it lifts.
      if (typeof data?.error?.capability === 'string') err.capability = data.error.capability.slice(0, 60);
      for (const k of ['nextAt', 'used', 'limit', 'windowDays', 'attemptsRemaining']) if (Number.isFinite(Number(data?.error?.[k]))) err[k] = Number(data.error[k]);
      if (typeof data?.error?.timeZone === 'string' && TIME_ZONE.test(data.error.timeZone)) err.timeZone = data.error.timeZone;
      if (typeof data?.error?.openExamId === 'string' && SAFE_ID.test(data.error.openExamId)) err.openExamId = data.error.openExamId;
      // The Paper Generator's nearest valid paper when the banks cannot fill a request: numbers and a mix name only.
      if (data?.error?.code === 'PAPER_BANK_INSUFFICIENT') {
        const n = data.error.nearest;
        err.nearest = n && Number.isInteger(n.marks) && /^[a-z]{4,12}$/.test(String(n.mix)) ? { marks: n.marks, minutes: Number(n.minutes) || 0, mix: String(n.mix), questions: Number(n.questions) || 0 } : null;
      }
      if (Array.isArray(data?.error?.proofs)) err.proofs = proofList(data.error.proofs);
      // The plain-text reasons a publishing step was refused (plan F3), bounded.
      if (Array.isArray(data?.error?.problems)) err.problems = data.error.problems.filter(p => typeof p === 'string').slice(0, 12).map(p => p.slice(0, 300));
      editionRefusal(err, data);
      err.requestId = response.headers.get('x-pri-request-id') || rid;
      throw err;
    }
    return data;
  } finally {
    clearTimeout(timer);
    if (signal) signal.removeEventListener('abort', abort);
  }
}

// ── A file the server sends (the Extension 1 practice papers) ────────────────
//
// GET a path and read the body as bytes, for a PDF attachment. Web only: the
// native bridges carry text, so inside a shell it answers CLOUD_WEB_ONLY, as a
// query string does. Same path rule, cookie, edition declaration, redirect and
// cache discipline as cloudRequest; bounded in bytes and time. A refusal is
// JSON and is thrown with the same code, status and capability.
const MAX_FILE_BYTES = 8 * 1024 * 1024;

// `type`: the one media type that is accepted (a paper's PDF, or a paper's diagram as an SVG).
export async function cloudDownload(path, { timeoutMs = 60_000, signal = null, type = 'application/pdf' } = {}) {
  if (!['application/pdf', 'image/svg+xml'].includes(type)) throw new Error('Cloud download type is not allowed');
  if (!PATH.test(String(path || '')) || String(path).includes('..')) throw new Error('Cloud path is not allowed');
  if (nativeCloudAvailable()) {
    const err = new Error('This needs Pri in a web browser for now.');
    err.code = 'CLOUD_WEB_ONLY';
    throw err;
  }
  if (!normalizeCloudOrigin() && Date.now() - lastRediscovery > 4000) {
    lastRediscovery = Date.now();
    await discoverCloudOrigin({ timeoutMs: 1500 });
  }
  const origin = normalizeCloudOrigin();
  if (!origin) {
    const err = new Error('Pri\'s server cannot be reached from this device right now.');
    err.code = 'CLOUD_DISABLED';
    throw err;
  }
  const rid = requestId();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new DOMException('Timed out', 'TimeoutError')), Math.max(1000, Math.min(120_000, Number(timeoutMs) || 60_000)));
  const abort = () => controller.abort(signal?.reason || new DOMException('Aborted', 'AbortError'));
  if (signal) {
    if (signal.aborted) abort();
    else signal.addEventListener('abort', abort, { once: true });
  }
  try {
    const response = await fetch(`${origin}${path}`, {
      method: 'GET',
      headers: { Accept: `${type}, application/json`, 'X-Pri-Request-Id': rid, 'X-Pri-Client': 'web-v1', [EDITION_HEADER]: EDITION },
      credentials: 'include',
      cache: 'no-store',
      redirect: 'error',
      signal: controller.signal
    });
    if (!response.ok) {
      const data = parseJson(await response.text());
      const err = new Error(data?.error?.message || `Cloud request failed (${response.status})`);
      err.status = response.status;
      err.code = data?.error?.code || 'CLOUD_REQUEST_FAILED';
      if (typeof data?.error?.capability === 'string') err.capability = data.error.capability.slice(0, 60);
      editionRefusal(err, data);
      err.requestId = response.headers.get('x-pri-request-id') || rid;
      throw err;
    }
    if (!(response.headers.get('content-type') || '').toLowerCase().startsWith(type)) throw new Error('Cloud returned an unexpected file type');
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.length > MAX_FILE_BYTES) throw new Error('Cloud response exceeded safety limit');
    return bytes;
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
  // No server was found when the page loaded: look once more (briefly, and
  // not more than every few seconds) before saying there is none.
  if (!normalizeCloudOrigin() && Date.now() - lastRediscovery > 4000) {
    lastRediscovery = Date.now();
    await discoverCloudOrigin({ timeoutMs: 1500 });
  }
  const origin = normalizeCloudOrigin();
  if (!origin) {
    const err = new Error('Pri\'s server cannot be reached from this device right now.');
    err.code = 'CLOUD_DISABLED';
    throw err;
  }
  const payload = JSON.stringify(body ?? {});
  if (byteLength(payload) > 1024 * 1024) throw new Error('Cloud request is too large');
  const rid = requestId();
  const headers = { Accept: 'text/event-stream', 'Content-Type': 'application/json', 'X-Pri-Request-Id': rid, 'X-Pri-Client': 'web-v1', [EDITION_HEADER]: EDITION };
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
      editionRefusal(err, data);
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
  // The student's original work kept with a mark (standard #08): their own,
  // by the id the grade reply named; or, for their teacher, through the class.
  original: id => cloudRequest('/v1/originals/' + pathId(id, 'original id')),
  teacherOriginal: (classId, studentId, id) => cloudRequest('/v1/originals/class/' + pathId(classId, 'class id') + '/student/'
    + pathId(studentId, 'student id') + '/' + pathId(id, 'original id')),
  // The device never computes a grade: question and attempt authority are on
  // the authenticated server. Transport failures are propagated, not converted
  // into local answers or queued pseudo-receipts.
  issuePractice: body => cloudRequest('/v1/practice/issue', { method: 'POST', body }),
  // Needs no session: the question a signed-out student may start working on.
  preparePractice: body => cloudRequest('/v1/practice/prepare', { method: 'POST', body }),
  gradePractice: (questionId, body) => cloudRequest('/v1/practice/' + pathId(questionId, 'question id') + '/submit', {
    method: 'POST', body, idempotencyKey: body.submissionId,
    // A submission that carries its picture is read by the server before it
    // is marked: the same budget as the separate reading request.
    ...(typeof body?.image === 'string' ? { timeoutMs: 55000 } : {})
  }),
  // Examination papers are issued, collected and marked by the server
  // (server/platform/exams.js). The device sends a paper spec and answers; it
  // never receives an answer key before the paper is finalised.
  // The layout of a blueprint paper is the server's choice: the device asks for
  // the seed, composes for it, and a create under any other seed is refused.
  examLayout: body => cloudRequest('/v1/exams/layout', { method: 'POST', body }),
  examTargets: () => cloudRequest('/v1/exams/targets'),
  // The NSW papers this server lists (Prithagoras, plan G4): released or not, and why.
  nswExams: () => cloudRequest('/v1/exams/nsw'),
  // The Paper Generator (both editions): the choices, a feasibility check, a printable paper, and the marking guide once the paper is submitted.
  examGeneratorOptions: body => cloudRequest('/v1/exams/generator/options', { method: 'POST', body }),
  examGeneratorCheck: body => cloudRequest('/v1/exams/generator/check', { method: 'POST', body }),
  examGeneratorPdf: body => cloudRequest('/v1/exams/generator/pdf', { method: 'POST', body, timeoutMs: 30000 }),
  examGuide: examId => cloudRequest('/v1/exams/' + pathId(examId, 'exam id') + '/guide'),
  createExam: (body, idempotencyKey) => cloudRequest('/v1/exams', { method: 'POST', body, idempotencyKey, timeoutMs: 30000 }),
  // PATCH, not PUT: the native iOS and Android bridges carry GET/POST/PATCH/DELETE.
  saveExamAnswers: (examId, body) => cloudRequest('/v1/exams/' + pathId(examId, 'exam id') + '/answers', { method: 'PATCH', body }),
  finishExam: (examId, body, idempotencyKey, timeoutMs = 30000) => cloudRequest('/v1/exams/' + pathId(examId, 'exam id') + '/finish', {
    method: 'POST', body, idempotencyKey, timeoutMs
  }),
  getExam: (examId, timeoutMs = undefined) => cloudRequest('/v1/exams/' + pathId(examId, 'exam id'), { timeoutMs }),
  // One page of handwriting frozen, unread, when the paper closed. The server
  // reads it only if its picture is the frozen one, and bounds how often.
  resolveExamHandwriting: (examId, body, timeoutMs = 60000) => cloudRequest('/v1/exams/' + pathId(examId, 'exam id') + '/handwriting', { method: 'POST', body, timeoutMs }),
  repeatPractice: questionId => cloudRequest('/v1/practice/' + pathId(questionId, 'question id') + '/repeat', { method: 'POST', body: {} }),
  revealPractice: questionId => cloudRequest('/v1/practice/' + pathId(questionId, 'question id') + '/reveal', { method: 'POST', body: {} }),
  // The hint ladder is served and charged by the server, one named rung at a
  // time; the error notebook and the per-dot-point review queue are derived
  // there from this account's server-marked attempts.
  hintPractice: (questionId, rung) => cloudRequest('/v1/practice/' + pathId(questionId, 'question id') + '/hint', { method: 'POST', body: { rung } }),
  // The tutor policy's smallest next step (server/platform/helpPlan.js). Dark: 404 unless the server sets PRI_FEATURE_TUTOR_POLICY=1.
  helpPlanPractice: (questionId, body) => cloudRequest('/v1/practice/' + pathId(questionId, 'question id') + '/help-plan', { method: 'POST', body }),
  practiceNotebook: () => cloudRequest('/v1/practice/notebook'),
  notebookTwin: attemptId => cloudRequest('/v1/practice/notebook/' + pathId(attemptId, 'attempt id') + '/twin', { method: 'POST', body: {} }),
  reviewQueue: () => cloudRequest('/v1/practice/review-queue'),
  // Submit never reads: it binds a read the student asked for. `attested`
  // is the read receipt and the text that was read (readReceipt.js on the
  // server), sent so the read is proven even after the server's short kept
  // record of it has gone.
  recognizePractice: (questionId, mode, image, attested = null) =>
    cloudRequest('/v1/practice/' + pathId(questionId, 'question id') + '/recognize', {
      method: 'POST', timeoutMs: 55000,
      body: { mode, image, ...(attested && typeof attested.receipt === 'string' && typeof attested.text === 'string' ? { receipt: attested.receipt, text: attested.text } : {}) }
    }),
  confirmPracticeRecognition: (questionId, receipt, text) =>
    cloudRequest('/v1/practice/' + pathId(questionId, 'question id') +
      '/recognition/' + pathId(receipt, 'receipt') + '/confirm', {
      method: 'POST', body: { text }
    }),
  me: () => cloudRequest('/v1/account/me'),
  register: body => cloudRequest('/v1/account/register', { method: 'POST', body }),
  // A guardian answering the email has no account and no session — the token in
  // their link is the whole authority, which is why it is single-use, hashed at
  // rest and expires in an hour.
  guardianConfirm: (token, noticeVersion) => cloudRequest('/v1/account/guardian/confirm', { method: 'POST', body: { token, approve: true, noticeVersion } }),
  guardianWithdraw: token => cloudRequest('/v1/account/guardian/withdraw', { method: 'POST', body: { token } }),
  // Decision D18: the same bearer asks for the child's account to be erased.
  guardianErase: token => cloudRequest('/v1/account/guardian/erase', { method: 'POST', body: { token } }),
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
  // Which code channels this deployment can send on (email, sms): configuration only.
  otpChannels: () => cloudRequest('/v1/account/otp/channels'),
  otpReauthRequest: () => cloudRequest('/v1/account/otp/reauth-request', { method: 'POST', body: {} }),
  // Deletion from the public page (/account/delete-request), no session: a code
  // to the account's own email, then the same deletion as DELETE /v1/account.
  deleteRequestCode: body => cloudRequest('/v1/account/otp/delete-request', { method: 'POST', body }),
  deleteConfirmCode: body => cloudRequest('/v1/account/otp/delete-confirm', { method: 'POST', body }),
  guardianOtpRequest: body => cloudRequest('/v1/account/otp/guardian/request', { method: 'POST', body }),
  guardianOtpApprove: body => cloudRequest('/v1/account/otp/guardian/approve', { method: 'POST', body }),
  guardianWithdrawRequest: body => cloudRequest('/v1/account/otp/guardian/withdraw-request', { method: 'POST', body }),
  guardianWithdrawByPhone: body => cloudRequest('/v1/account/otp/guardian/withdraw', { method: 'POST', body }),
  logout: () => cloudRequest('/v1/account/logout', { method: 'POST', body: {} }),
  // Every session of this account, on every device, this one included.
  // `accountId` names the account meant: the server refuses a session for any
  // other one (409 ACCOUNT_MISMATCH) before revoking anything (#481, as #521).
  logoutAll: ({ accountId = null } = {}) => cloudRequest('/v1/account/logout-all', { method: 'POST', body: accountId != null ? { accountId: String(accountId) } : {} }),
  requestEmailVerification: () => cloudRequest('/v1/account/email/verification-request', { method: 'POST', body: {} }),
  requestPasswordReset: body => cloudRequest('/v1/account/password/reset-request', { method: 'POST', body }),
  resetPassword: body => cloudRequest('/v1/account/password/reset', { method: 'POST', body }),
  changePassword: body => cloudRequest('/v1/account/password', { method: 'PATCH', body }),
  // A first password for an account made without one (server/platform/
  // accounts.js POST /password): needs fresh proof, like the export.
  setPassword: body => cloudRequest('/v1/account/password', { method: 'POST', body }),
  verifyEmail: body => cloudRequest('/v1/account/email/verify', { method: 'POST', body }),
  devices: () => cloudRequest('/v1/account/devices'),
  revokeDevice: sessionId => cloudRequest(`/v1/account/devices/${pathId(sessionId, 'session id')}`, { method: 'DELETE' }),
  exportAccount: () => cloudRequest('/v1/account/export'),
  // Fresh proof of the credential for the export (server/platform/accounts.js
  // POST /reauth): the same proofs deletion takes. The server answers with a
  // session-bound step-up cookie the browser or native jar holds for 10 minutes;
  // the page keeps nothing.
  reauth: body => cloudRequest('/v1/account/reauth', { method: 'POST', body }),
  // Server-side handwriting reading. The body carries the student's own ink as
  // a picture and nothing else: no question, no expected answer, no profile.
  handwritingStatus: ({ signal = null, timeoutMs = 7000 } = {}) =>
    cloudRequest('/v1/handwriting/status', { signal, timeoutMs }),
  // Longer than the server's own reading budget (PRI_HANDWRITING_TIMEOUT_MS,
  // 45 s by default) so the server answers before the client gives up.
  // `questionId` (the server's id of the issued question) only lets the
  // server bind its read receipt to that question; the reader is sent the
  // picture alone.
  transcribeHandwriting: (image, { signal = null, timeoutMs = 55000, questionId = null } = {}) =>
    cloudRequest('/v1/handwriting/transcribe', { method: 'POST', body: { image, ...(questionId ? { questionId } : {}) }, signal, timeoutMs }),
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
  // "Check this line so far": the server's Step Check of an open issued
  // question's lines; names a step, never a value. Sends only the id and lines.
  tutorLineCheck: (body, { signal = null, timeoutMs = 20000 } = {}) =>
    cloudRequest('/v1/tutor/line-check', { method: 'POST', body, signal, timeoutMs }),
  // The live step coach (F1): one status per finished line, never a value.
  // Sends only the issued question's id and the student's own read lines.
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
  syncPull: (cursor, accountId = null) => cloudRequest(`/v1/sync/pull/${accountId == null ? '' : `${pathId(accountId, 'account id')}/`}${Math.max(0, Number(cursor) || 0)}`),
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
  cancelFeedback: reason => cloudRequest('/v1/billing/cancel-feedback', { method: 'POST', body: { reason } }),
  referral: () => cloudRequest('/v1/referral/'),
  claimReferral: code => cloudRequest('/v1/referral/claim', { method: 'POST', body: { code } }),
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
  classJoinCode: classId => cloudRequest(`/v1/classes/${pathId(classId, 'class id')}/join-code`),
  // The teacher workspace (server/platform/classroom.js, classBoard.js). Engine
  // marks and teacher marks arrive in separate fields and stay separate here.
  classroomVisibility: () => cloudRequest('/v1/classroom/visibility'),
  classroomMine: () => cloudRequest('/v1/classroom/mine'),
  handInPaper: (classId, assignmentId, examId) => cloudRequest(`/v1/classroom/classes/${pathId(classId, 'class id')}/assignments/${pathId(assignmentId, 'assignment id')}/hand-in`, { method: 'POST', body: { examId: String(examId || '') } }),
  boardCourses: () => cloudRequest('/v1/classroom/board/courses'),
  classBoard: (classId, course, node = null) => cloudRequest(`/v1/classroom/classes/${pathId(classId, 'class id')}/board`, { query: node ? { course, node } : { course } }),
  paperResults: (classId, assignmentId) => cloudRequest(`/v1/classroom/classes/${pathId(classId, 'class id')}/assignments/${pathId(assignmentId, 'assignment id')}/results`),
  paperResultsCsv: (classId, assignmentId) => cloudRequest(`/v1/classroom/classes/${pathId(classId, 'class id')}/assignments/${pathId(assignmentId, 'assignment id')}/results`, { csv: true }),
  classReviewQueue: (classId, state = 'open') => cloudRequest(`/v1/classroom/classes/${pathId(classId, 'class id')}/review`, ['decided', 'all'].includes(state) ? { query: { state } } : {}),
  classReviewDecide: (classId, itemId, body) => cloudRequest(`/v1/classroom/classes/${pathId(classId, 'class id')}/review/${pathId(itemId, 'review item id')}`, { method: 'POST', body }),
  classReviewHistory: (classId, itemId) => cloudRequest(`/v1/classroom/classes/${pathId(classId, 'class id')}/review/${pathId(itemId, 'review item id')}/history`),
  contentRevisions: () => cloudRequest('/v1/content/admin/revisions'),
  createContentDraft: body => cloudRequest('/v1/content/drafts', { method: 'POST', body }),
  updateContentDraft: (revisionId, body) => cloudRequest(`/v1/content/drafts/${pathId(revisionId, 'revision id')}`, { method: 'PATCH', body }),
  submitContentReview: revisionId => cloudRequest(`/v1/content/${pathId(revisionId, 'revision id')}/submit-review`, { method: 'POST', body: {} }),
  approveContent: revisionId => cloudRequest(`/v1/content/${pathId(revisionId, 'revision id')}/approve`, { method: 'POST', body: {} }),
  publishContent: revisionId => cloudRequest(`/v1/content/${pathId(revisionId, 'revision id')}/publish`, { method: 'POST', body: {} }),
  // Library publishing (plan F3). Staff only, and only where the server has
  // PRI_RESOURCE_PUBLISHING=on (otherwise every one of these answers 404). Every
  // body is JSON inside the 1 MiB transport limit: a file goes up in 512 KiB
  // parts (client/src/library/assetUpload.js), never as one binary request.
  resourceAdminList: () => cloudRequest('/v1/resources/admin'),
  resourceAdminHistory: rid => cloudRequest(`/v1/resources/admin/${pathId(rid, 'resource id')}/revisions`),
  resourceAdminRead: (rid, n) => cloudRequest(`/v1/resources/admin/${pathId(rid, 'resource id')}/revisions/${pathId(n, 'revision')}`),
  resourceAdminDraft: (rid, body) => cloudRequest(`/v1/resources/admin/${pathId(rid, 'resource id')}/drafts`, { method: 'POST', body: { body } }),
  resourceAdminEdit: (rid, n, body) => cloudRequest(`/v1/resources/admin/${pathId(rid, 'resource id')}/revisions/${pathId(n, 'revision')}`, { method: 'PATCH', body: { body } }),
  resourceAdminStep: (rid, n, step, body = {}) => {
    if (!['submit', 'approve', 'reject', 'publish', 'rollback', 'revise'].includes(step)) throw new Error('step is invalid');
    return cloudRequest(`/v1/resources/admin/${pathId(rid, 'resource id')}/revisions/${pathId(n, 'revision')}/${step}`, { method: 'POST', body });
  },
  resourceAdminWithdraw: (rid, reason) => cloudRequest(`/v1/resources/admin/${pathId(rid, 'resource id')}/withdraw`, { method: 'POST', body: { reason } }),
  resourceAdminAssetStart: (rid, n) => cloudRequest(`/v1/resources/admin/${pathId(rid, 'resource id')}/revisions/${pathId(n, 'revision')}/asset/start`, { method: 'POST', body: {} }),
  resourceAdminAssetPart: (rid, n, i, data) => cloudRequest(`/v1/resources/admin/${pathId(rid, 'resource id')}/revisions/${pathId(n, 'revision')}/asset/parts/${pathId(i, 'part')}`, { method: 'POST', body: { data } }),
  resourceAdminAssetComplete: (rid, n, body) => cloudRequest(`/v1/resources/admin/${pathId(rid, 'resource id')}/revisions/${pathId(n, 'revision')}/asset/complete`, { method: 'POST', body }),
  resourceAdminAssetDelete: (rid, n) => cloudRequest(`/v1/resources/admin/${pathId(rid, 'resource id')}/revisions/${pathId(n, 'revision')}/asset`, { method: 'DELETE' }),
  adminHealth: () => cloudRequest('/v1/admin/health'),
  adminUsers: () => cloudRequest('/v1/admin/users'),
  updateUserRole: (accountId, role) => cloudRequest(`/v1/admin/users/${pathId(accountId, 'account id')}/role`, { method: 'PATCH', body: { role } }),
  adminAudit: () => cloudRequest('/v1/admin/audit'),
  reportIssue: (body, idempotencyKey) => cloudRequest('/v1/reports', { method: 'POST', body, idempotencyKey }),
  telemetry: events => cloudRequest('/v1/telemetry', { method: 'POST', body: { events } }),
  // A coded crash report (platform/telemetry.js reportCrash): no message, stack or URL.
  reportError: report => cloudRequest('/v1/telemetry/error', { method: 'POST', body: report, timeoutMs: 8000 })
});
