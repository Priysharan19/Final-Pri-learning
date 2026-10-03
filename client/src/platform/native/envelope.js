// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · priNative envelope v1 (CP-02)
//
// Shapes, limits and validation for every message that crosses the native
// boundary. Everything arriving from a shell is untrusted input: a reply that
// does not match its schema is never handed to product code.
// ─────────────────────────────────────────────────────────────────────────────

export const PROTOCOL = 1;
export const MAX_PROTOCOL = 1;
export const MAX_ID_LENGTH = 120;
export const MAX_IN_FLIGHT_PER_CAPABILITY = 32;
export const MAX_ENVELOPE_BYTES = 1024 * 1024;           // 1 MB
export const MAX_PHOTO_ENVELOPE_BYTES = 8 * 1024 * 1024; // photo/share payloads
export const MAX_BUFFERED_EVENTS = 64;
export const NATIVE_ID_PREFIX = 'n:';

const CAP = /^[a-z][a-z0-9]{1,23}$/;
const OP = /^[a-zA-Z][a-zA-Z0-9.]{0,47}$/;
const EVENT = /^[a-z][a-z0-9]{1,23}\.[a-zA-Z][a-zA-Z0-9]{0,47}$/;

export const isPlainObject = v => !!v && typeof v === 'object' && !Array.isArray(v);

export function byteLength(text) {
  try { return new TextEncoder().encode(text).byteLength; } catch { return String(text).length * 2; }
}

let counter = 0;
export function newRequestId() {
  let id = '';
  try { id = globalThis.crypto?.randomUUID?.() || ''; } catch { id = ''; }
  if (!id) id = `${Date.now().toString(36)}-${(counter++).toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  return id.slice(0, MAX_ID_LENGTH);
}

export function envelopeLimit(cap) {
  return cap === 'photo' || cap === 'share' ? MAX_PHOTO_ENVELOPE_BYTES : MAX_ENVELOPE_BYTES;
}

export function makeRequest({ id, cap, op, payload = {}, timeoutMs }) {
  if (!CAP.test(String(cap || ''))) throw new TypeError('invalid capability');
  if (!OP.test(String(op || ''))) throw new TypeError('invalid op');
  const env = { v: PROTOCOL, id, cap, op, payload: isPlainObject(payload) ? payload : {} };
  if (Number.isFinite(timeoutMs)) env.timeoutMs = Math.round(timeoutMs);
  return env;
}

/**
 * Classify an inbound message. Returns one of:
 *   { kind: 'response', id, ok, result | error }
 *   { kind: 'event', event, seq, payload }
 *   { kind: 'request', id, req, payload }        (native → JS request)
 *   { kind: 'invalid', reason }
 */
export function classifyInbound(raw) {
  let msg = raw;
  if (typeof msg === 'string') {
    if (byteLength(msg) > MAX_PHOTO_ENVELOPE_BYTES) return { kind: 'invalid', reason: 'too-large' };
    try { msg = JSON.parse(msg); } catch { return { kind: 'invalid', reason: 'not-json' }; }
  }
  if (!isPlainObject(msg)) return { kind: 'invalid', reason: 'not-object' };
  if (msg.v !== PROTOCOL) return { kind: 'invalid', reason: 'protocol' };

  if (typeof msg.event === 'string') {
    if (!EVENT.test(msg.event)) return { kind: 'invalid', reason: 'event-name' };
    if (!Number.isSafeInteger(msg.seq) || msg.seq < 0) return { kind: 'invalid', reason: 'event-seq' };
    return { kind: 'event', event: msg.event, seq: msg.seq, payload: isPlainObject(msg.payload) ? msg.payload : {} };
  }

  if (typeof msg.id !== 'string' || !msg.id || msg.id.length > MAX_ID_LENGTH) return { kind: 'invalid', reason: 'id' };

  if (typeof msg.req === 'string') {
    if (!msg.id.startsWith(NATIVE_ID_PREFIX)) return { kind: 'invalid', reason: 'native-id-prefix' };
    if (!EVENT.test(msg.req)) return { kind: 'invalid', reason: 'req-name' };
    return { kind: 'request', id: msg.id, req: msg.req, payload: isPlainObject(msg.payload) ? msg.payload : {} };
  }

  if (msg.id.startsWith(NATIVE_ID_PREFIX)) return { kind: 'invalid', reason: 'response-to-native-id' };
  if (msg.ok === true) {
    return { kind: 'response', id: msg.id, ok: true, result: isPlainObject(msg.result) ? msg.result : {} };
  }
  if (msg.ok === false) {
    if (!isPlainObject(msg.error)) return { kind: 'invalid', reason: 'error-shape' };
    return { kind: 'response', id: msg.id, ok: false, error: msg.error };
  }
  return { kind: 'invalid', reason: 'ok-flag' };
}

// ── Per-op reply schemas ─────────────────────────────────────────────────────
// A conforming reply is required before a result reaches product code. The
// schemas are deliberately small: they pin types and bounds, not every field.
const str = (max = 2000) => v => typeof v === 'string' && v.length <= max;
const bool = v => typeof v === 'boolean';
const optional = check => v => v === undefined || v === null || check(v);
const arrayOf = (check, max = 256) => v => Array.isArray(v) && v.length <= max && v.every(check);

const REPLY_SCHEMAS = Object.freeze({
  'host.ready': {},
  'host.diagnostics': { platform: str(32), os: optional(str(64)), model: optional(str(64)) },
  'share.file': { completed: bool },
  'share.print': { completed: bool },
  'storage.status': { durable: bool },
  'device.facts': { stylusSeen: optional(bool), stylusCapable: optional(bool), safeAreaApplied: optional(bool) },
  'lifecycle.state': { state: v => ['active', 'inactive', 'background'].includes(v) },
  'billing.products': { products: arrayOf(v => isPlainObject(v), 24) },
  'billing.purchase': { status: str(32) },
  'billing.unfinished': { transactions: arrayOf(v => isPlainObject(v), 100) },
  'billing.restore': { transactions: arrayOf(v => isPlainObject(v), 100) },
  'billing.finish': {},
  'cloud.forgetSession': {},
  'cloud.request': { status: v => Number.isInteger(v) && v >= 100 && v <= 599, body: optional(str(2 * 1024 * 1024)) },
  'photo.recognize': { text: optional(str(20000)), answer: optional(str(2000)), confidence: optional(v => typeof v === 'number') },
});

export function validateReply(cap, op, result) {
  const schema = REPLY_SCHEMAS[`${cap}.${op}`];
  if (!schema) return true; // ops without a schema accept any plain-object result
  if (!isPlainObject(result)) return false;
  for (const [key, check] of Object.entries(schema)) {
    if (!check(result[key])) return false;
  }
  return true;
}

export const hasReplySchema = (cap, op) => Object.prototype.hasOwnProperty.call(REPLY_SCHEMAS, `${cap}.${op}`);
