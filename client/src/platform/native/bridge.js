// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · priNative envelope transport core (CP-02)
//
// Transport-agnostic request/response/event machinery for envelope-v1 hosts.
// The host-specific part is only `post(envelope)` (how a message leaves the
// page) and the global receiver the shell calls (`__priNativeReceive`).
//
// Semantics (docs/cross-platform/CROSS_PLATFORM_ARCHITECTURE.md §4.3):
//   · JavaScript owns timeouts; on timeout/abort it rejects and sends `cancel`;
//   · a late reply is dropped — except recoverable billing ops, whose late
//     result is re-emitted as `billing.transactionUpdated` so a paid
//     transaction is never lost on the JavaScript side;
//   · duplicate, unknown and malformed replies never reach product code;
//   · at most MAX_IN_FLIGHT_PER_CAPABILITY requests per capability;
//   · envelopes over the size limit fail with TOO_LARGE before posting;
//   · events carry a per-document `seq`; stale/duplicate seq is dropped;
//     `billing.*` events are buffered (bounded) until someone subscribes;
//   · a throwing subscriber never breaks delivery to the others;
//   · dispose()/reload cancels everything in flight.
// ─────────────────────────────────────────────────────────────────────────────
import {
  MAX_BUFFERED_EVENTS, MAX_IN_FLIGHT_PER_CAPABILITY, byteLength, classifyInbound,
  envelopeLimit, makeRequest, newRequestId, validateReply, PROTOCOL,
} from './envelope.js';
import { PriNativeError, fromWireError } from './errors.js';

const DEFAULT_TIMEOUT_MS = 12_000;
const MAX_TIMEOUT_MS = 5 * 60_000;
const LATE_RECOVERY_MS = 30 * 60_000;
const RECENT_IDS = 256;

/** Ops whose late result carries value and must be recovered, not dropped. */
const RECOVERABLE = new Set(['billing.purchase', 'billing.restore']);
const BUFFERED_EVENT = name => name.startsWith('billing.');

export function createEventBus({ onListenerError } = {}) {
  const listeners = new Map();
  const buffered = new Map();
  const latest = new Map();
  let lastSeq = -1;

  function deliver(event, payload) {
    // Billing payloads carry signed store proofs; never retain them as "latest".
    if (!BUFFERED_EVENT(event)) latest.set(event, payload);
    const set = listeners.get(event);
    if (!set || set.size === 0) {
      if (BUFFERED_EVENT(event)) {
        const queue = buffered.get(event) || [];
        queue.push(payload);
        while (queue.length > MAX_BUFFERED_EVENTS) queue.shift();
        buffered.set(event, queue);
      }
      return;
    }
    for (const fn of [...set]) {
      try { fn(payload); } catch (error) { onListenerError?.(event, error); }
    }
  }

  return {
    /** Native event with a sequence number. Returns false when dropped as stale. */
    receive(event, seq, payload) {
      if (Number.isSafeInteger(seq)) {
        if (seq <= lastSeq) return false;
        lastSeq = seq;
      }
      deliver(event, payload);
      return true;
    },
    /** Locally-originated event (legacy adapters, late-reply recovery). */
    emit(event, payload) { deliver(event, payload); },
    on(event, fn) {
      if (typeof fn !== 'function') return () => {};
      const set = listeners.get(event) || new Set();
      set.add(fn);
      listeners.set(event, set);
      const queue = buffered.get(event);
      if (queue?.length) {
        buffered.delete(event);
        for (const payload of queue) {
          try { fn(payload); } catch (error) { onListenerError?.(event, error); }
        }
      }
      return () => { set.delete(fn); };
    },
    latest: event => latest.get(event),
    reset() { listeners.clear(); buffered.clear(); latest.clear(); lastSeq = -1; },
    bufferedCount: event => (buffered.get(event) || []).length,
  };
}

export function createBridge({ post, events: sharedEvents = null, now = () => Date.now(), setTimer = setTimeout, clearTimer = clearTimeout } = {}) {
  if (typeof post !== 'function') throw new TypeError('createBridge needs a post function');

  const pending = new Map();      // id → entry
  const inFlight = new Map();     // cap → count
  const late = new Map();         // id → { key, expires }
  const recent = [];              // recently settled ids (duplicate detection)
  const requestHandlers = new Map();
  const stats = { malformed: 0, unknown: 0, duplicate: 0, lateDropped: 0, lateRecovered: 0, listenerErrors: 0, staleEvents: 0 };
  let disposed = false;

  const events = sharedEvents || createEventBus({ onListenerError: () => { stats.listenerErrors += 1; } });

  function remember(id) {
    recent.push(id);
    if (recent.length > RECENT_IDS) recent.shift();
  }

  function settle(id) {
    const entry = pending.get(id);
    if (!entry) return null;
    pending.delete(id);
    clearTimer(entry.timer);
    if (entry.signal && entry.onAbort) entry.signal.removeEventListener('abort', entry.onAbort);
    inFlight.set(entry.cap, Math.max(0, (inFlight.get(entry.cap) || 1) - 1));
    remember(id);
    return entry;
  }

  function sendCancel(entry) {
    if (!entry.cancellable) return;
    try { post(makeRequest({ id: newRequestId(), cap: entry.cap, op: 'cancel', payload: { target: entry.id } })); } catch { /* best effort */ }
  }

  function abandon(entry, code) {
    const t = now();
    for (const [id, record] of late) if (record.expires < t) late.delete(id);
    if (RECOVERABLE.has(`${entry.cap}.${entry.op}`)) {
      late.set(entry.id, { key: `${entry.cap}.${entry.op}`, expires: now() + LATE_RECOVERY_MS });
    }
    sendCancel(entry);
    entry.reject(new PriNativeError(code, code === 'TIMEOUT'
      ? `${entry.cap}.${entry.op} did not respond in time`
      : `${entry.cap}.${entry.op} was cancelled`));
  }

  function recoverLate(id, response) {
    const record = late.get(id);
    late.delete(id);
    if (!record || record.expires < now() || !response.ok) { stats.lateDropped += 1; return; }
    const result = response.result || {};
    const transactions = record.key === 'billing.restore'
      ? (Array.isArray(result.transactions) ? result.transactions : [])
      // A paid result from either store: StoreKit says 'verified' (a signed
      // JWS), Google Play says 'purchased' (a purchase token). Neither grants
      // anything — the server verifies each with its store.
      : (result.status === 'verified' || result.status === 'purchased' ? [result] : []);
    for (const transaction of transactions) events.emit('billing.transactionUpdated', { status: 'verified', ...transaction });
    stats.lateRecovered += 1;
  }

  function handleResponse(msg) {
    const entry = settle(msg.id);
    if (!entry) {
      if (late.has(msg.id)) return recoverLate(msg.id, msg);
      if (recent.includes(msg.id)) stats.duplicate += 1; else stats.unknown += 1;
      return;
    }
    if (!msg.ok) return entry.reject(fromWireError(msg.error));
    if (!validateReply(entry.cap, entry.op, msg.result)) {
      return entry.reject(new PriNativeError('INTERNAL', `${entry.cap}.${entry.op} returned a malformed reply`));
    }
    entry.resolve(msg.result);
  }

  async function handleNativeRequest(msg) {
    const handler = requestHandlers.get(msg.req);
    let reply;
    if (!handler) {
      reply = { v: PROTOCOL, id: msg.id, ok: false, error: { code: 'UNSUPPORTED', message: `no handler for ${msg.req}`, retryable: false } };
    } else {
      try {
        const result = await handler(msg.payload);
        reply = { v: PROTOCOL, id: msg.id, ok: true, result: result && typeof result === 'object' ? result : {} };
      } catch (error) {
        const e = error instanceof PriNativeError ? error : new PriNativeError('INTERNAL', 'request handler failed');
        reply = { v: PROTOCOL, id: msg.id, ok: false, error: { code: e.code, message: e.message, retryable: e.retryable } };
      }
    }
    if (!disposed) { try { post(reply); } catch { /* host gone */ } }
  }

  function receive(raw) {
    if (disposed) return;
    const msg = classifyInbound(raw);
    switch (msg.kind) {
      case 'response': return handleResponse(msg);
      case 'event':
        if (!events.receive(msg.event, msg.seq, msg.payload)) stats.staleEvents += 1;
        return;
      case 'request': void handleNativeRequest(msg); return;
      default: stats.malformed += 1;
    }
  }

  function request(cap, op, payload = {}, { timeoutMs = DEFAULT_TIMEOUT_MS, signal = null, cancellable = true } = {}) {
    if (disposed) return Promise.reject(new PriNativeError('CANCELLED', 'native bridge was disposed'));
    if (signal?.aborted) return Promise.reject(new PriNativeError('CANCELLED', `${cap}.${op} was cancelled`));
    const timeout = Math.max(1, Math.min(MAX_TIMEOUT_MS, Number(timeoutMs) || DEFAULT_TIMEOUT_MS));
    let envelope;
    try {
      envelope = makeRequest({ id: newRequestId(), cap, op, payload, timeoutMs: timeout });
    } catch {
      return Promise.reject(new PriNativeError('BAD_REQUEST', `invalid ${cap}.${op} request`));
    }
    let size;
    try { size = byteLength(JSON.stringify(envelope)); } catch {
      return Promise.reject(new PriNativeError('BAD_REQUEST', `${cap}.${op} payload is not serialisable`));
    }
    if (size > envelopeLimit(cap)) return Promise.reject(new PriNativeError('TOO_LARGE', `${cap}.${op} payload is too large`));
    if ((inFlight.get(cap) || 0) >= MAX_IN_FLIGHT_PER_CAPABILITY) {
      return Promise.reject(new PriNativeError('UNAVAILABLE', `too many ${cap} requests in flight`, { retryable: true }));
    }

    return new Promise((resolve, reject) => {
      const entry = { id: envelope.id, cap, op, resolve, reject, signal, cancellable, timer: null, onAbort: null };
      entry.timer = setTimer(() => { if (settle(entry.id)) abandon(entry, 'TIMEOUT'); }, timeout);
      if (signal) {
        entry.onAbort = () => { if (settle(entry.id)) abandon(entry, 'CANCELLED'); };
        signal.addEventListener('abort', entry.onAbort, { once: true });
      }
      pending.set(entry.id, entry);
      inFlight.set(cap, (inFlight.get(cap) || 0) + 1);
      let sent = false;
      try { sent = post(envelope) !== false; } catch { sent = false; }
      if (!sent && settle(entry.id)) reject(new PriNativeError('UNAVAILABLE', 'native bridge is not reachable'));
    });
  }

  function dispose(reason = 'native bridge was disposed') {
    if (disposed) return;
    disposed = true;
    for (const id of [...pending.keys()]) {
      const entry = settle(id);
      entry?.reject(new PriNativeError('CANCELLED', reason));
    }
    late.clear();
    if (!sharedEvents) events.reset();
    requestHandlers.clear();
  }

  return {
    request,
    receive,
    dispose,
    on: events.on,
    emit: events.emit,
    latest: events.latest,
    onRequest(name, fn) {
      if (typeof fn !== 'function') return () => {};
      requestHandlers.set(name, fn);
      return () => { if (requestHandlers.get(name) === fn) requestHandlers.delete(name); };
    },
    stats: () => ({ ...stats, inFlight: Object.fromEntries(inFlight), pending: pending.size, late: late.size }),
    get disposed() { return disposed; },
  };
}
