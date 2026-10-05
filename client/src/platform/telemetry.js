// Pri Learning · privacy-safe operational telemetry
//
// Telemetry is opt-in by capability: it is sent only when a cloud account
// session exists, never blocks local learning, and accepts only structured
// low-cardinality metadata. No answers, email addresses, free-form error
// messages, component stacks, strokes, handwriting images or screenshots enter
// this module.

import { cloud, cloudAvailable } from './cloudTransport.js';
import { priNative } from './native/index.js';
import { currentReleaseIdentity } from './releaseIdentity.js';

const TYPES = new Set([
  'client-error', 'sync-failure', 'api-failure', 'recognition-failure',
  'bad-question-opened', 'exam-completed', 'feature-used', 'trial-started',
  'subscription-state', 'performance-sample'
]);
const META_KEYS = new Set([
  'code', 'surface', 'feature', 'track', 'grade', 'questionType', 'mode',
  'durationMs', 'status', 'provider', 'network', 'version', 'build', 'scope'
]);
let queue = [];
let flushJob = null;

function scalar(value) {
  if (value == null || typeof value === 'boolean') return value;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string') return value.slice(0, 120);
  return undefined;
}

function cleanMetadata(raw) {
  const out = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  for (const [key, value] of Object.entries(raw)) {
    if (!META_KEYS.has(key)) continue;
    const safe = scalar(value);
    if (safe !== undefined) out[key] = safe;
  }
  return out;
}

export function telemetryEvent(type, { surface = null, metadata = {}, at = Date.now() } = {}) {
  if (!TYPES.has(type)) throw new Error('Telemetry event type is not allowed');
  return Object.freeze({
    type,
    surface: surface == null ? null : String(surface).slice(0, 80),
    metadata: Object.freeze(cleanMetadata(metadata)),
    at: Number.isFinite(Number(at)) ? Number(at) : Date.now()
  });
}

export function queueTelemetry(type, options = {}) {
  if (!cloudAvailable()) return false;
  let event;
  try { event = telemetryEvent(type, options); } catch { return false; }
  queue.push(event);
  if (queue.length > 60) queue = queue.slice(-60);
  scheduleFlush();
  return true;
}

function scheduleFlush() {
  if (flushJob) return;
  flushJob = Promise.resolve().then(async () => {
    await new Promise(resolve => setTimeout(resolve, 250));
    const batch = queue.splice(0, 30);
    if (!batch.length) return;
    try { await cloud.telemetry(batch); }
    catch {
      // Operational telemetry is best effort and must never become a durable
      // shadow copy of student behaviour. Failed events are dropped rather than
      // persisted with learning data or retried forever.
    }
  }).finally(() => {
    flushJob = null;
    if (queue.length) scheduleFlush();
  });
}

export function reportClientError({ surface = 'unknown', code = 'RENDER_ERROR', scope = 'route' } = {}) {
  return queueTelemetry('client-error', { surface, metadata: { code, scope } });
}

// ── Crash reports (POST /v1/telemetry/error) ─────────────────────────────────
// What the error boundaries and the native shells send when something broke
// (ledger 1.7). Coded only: platform, a surface slug, an upper-case code, a
// scope and a short fingerprint of the error — a hash, so two students
// hitting the same crash group together while the message, the stack, the URL
// and anything typed stay on the device. Three gates, all of which must open:
//   · a cloud account session exists (cloudAvailable, and the server's own
//     session + guardian-consent checks);
//   · the device's crash-report preference is on (Settings → Data & Backup;
//     on by default for a signed-in account, off with one tap, remembered
//     per device);
//   · the report passes the same shape rules the server enforces, so a report
//     that would be refused is never sent.
export const ERROR_REPORTS_KEY = 'pri.errorReports.v1';
const CODE = /^[A-Z][A-Z0-9_]{1,63}$/;
const SURFACE = /^[a-z][a-z0-9-]{0,39}$/;
const SCOPES = new Set(['app', 'route', 'shell', 'worker']);
const RELEASE = /^[0-9a-f]{40}$/;
const errorReportListeners = new Set();

function storage() {
  try { return globalThis.localStorage || null; } catch { return null; }
}

/** The device preference: on unless the person turned it off. */
export function errorReportsEnabled() {
  try { return storage()?.getItem(ERROR_REPORTS_KEY) !== 'off'; } catch { return true; }
}

export function setErrorReportsEnabled(on) {
  try { if (on) storage()?.removeItem(ERROR_REPORTS_KEY); else storage()?.setItem(ERROR_REPORTS_KEY, 'off'); } catch { /* preference is best effort */ }
  for (const fn of errorReportListeners) { try { fn(!!on); } catch { /* listeners never break the toggle */ } }
  return errorReportsEnabled();
}

export function onErrorReportsChange(fn) {
  if (typeof fn !== 'function') return () => {};
  errorReportListeners.add(fn);
  return () => errorReportListeners.delete(fn);
}

/** A slug the server accepts, from whatever a boundary called its scope. */
export function surfaceSlug(value) {
  const slug = String(value || 'unknown').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
  return SURFACE.test(slug) ? slug : 'unknown';
}

/**
 * A short, stable hex fingerprint of an error: its name, the first line of
 * its message with digits and quoted strings removed, and the first stack
 * frame's file (never the whole stack). FNV-1a, so it is synchronous and
 * identical across devices for the same crash.
 */
export function crashFingerprint(error) {
  const name = String(error?.name || 'Error');
  // Quoted strings, angle-bracketed tokens, email-like tokens and digits are
  // the parts of a message that carry data rather than the fault.
  const message = String(error?.message || '').split('\n', 1)[0]
    .replace(/["'`][^"'`]*["'`]/g, '"…"')
    .replace(/<[^>]*>/g, '<…>')
    .replace(/\S+@\S+/g, '@')
    .replace(/\d+/g, '#')
    .slice(0, 160);
  const frame = String(error?.stack || '').split('\n').map(line => line.trim()).find(line => /^at\s|@/.test(line)) || '';
  const file = (frame.match(/([A-Za-z0-9_.-]+\.(?:m?js|jsx|ts|tsx))(?=[:?)]|$)/) || [])[1] || '';
  let hash = 0x811c9dc5;
  for (const ch of `${name}|${message}|${file}`) {
    hash ^= ch.codePointAt(0);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

/** Which shell is running: the server's closed platform set. */
export function clientPlatform() {
  let host = null;
  try { host = priNative.host(); } catch { host = null; }
  if (!host?.native) return 'web';
  return host.shell === 'android' || host.platform === 'android' ? 'android-shell' : 'ios-shell';
}

/** The report as it would be sent, or null when it would be refused (exported for the contract test). */
export function crashReport({ surface, code = 'RENDER_ERROR', scope = 'route', error = null, platform = clientPlatform(), at = Date.now() } = {}) {
  const safeCode = CODE.test(String(code || '')) ? String(code) : 'CLIENT_ERROR';
  if (!SCOPES.has(scope)) return null;
  const report = { platform, surface: surfaceSlug(surface), code: safeCode, scope, at };
  if (error) report.fingerprint = crashFingerprint(error);
  const release = String(currentReleaseIdentity()?.releaseSha || '');
  if (RELEASE.test(release)) report.release = release;
  return report;
}

/**
 * Send a crash report. Resolves true when it was handed to the transport,
 * false when a gate was closed or the send failed; never throws and never
 * blocks the boundary that called it. Also queues the coarse client-error
 * event for the 90-day operational record.
 */
export async function reportCrash(options = {}) {
  const report = crashReport(options);
  if (!report) return false;
  reportClientError({ surface: report.surface, code: report.code, scope: report.scope });
  if (!errorReportsEnabled() || !cloudAvailable()) return false;
  try { await cloud.reportError(report); return true; }
  catch { return false; }
}

/**
 * The native shell's own failures (the WebContent process was killed, a
 * navigation failed) arrive as `shell.error` events from the host; report them
 * under scope `shell`. Returns the unsubscribe function.
 */
export function installShellErrorReporting() {
  try {
    if (!priNative.isNativeShell()) return () => {};
    return priNative.shell.onError(payload => {
      reportCrash({ surface: 'shell', code: payload?.code || 'SHELL_ERROR', scope: 'shell', platform: clientPlatform() });
    });
  } catch {
    return () => {};
  }
}

export function reportSyncFailure(code = 'SYNC_FAILED') {
  return queueTelemetry('sync-failure', { surface: 'sync', metadata: { code } });
}
