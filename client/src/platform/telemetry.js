// Pri Learning · privacy-safe operational telemetry
//
// Telemetry is opt-in by capability: it is sent only when a cloud account
// session exists, never blocks local learning, and accepts only structured
// low-cardinality metadata. No answers, email addresses, free-form error
// messages, component stacks, strokes, handwriting images or screenshots enter
// this module.

import { cloud, cloudAvailable } from './cloudTransport.js';

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

export function reportSyncFailure(code = 'SYNC_FAILED') {
  return queueTelemetry('sync-failure', { surface: 'sync', metadata: { code } });
}
