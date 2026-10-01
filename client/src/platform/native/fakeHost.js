// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · priNative fake host (CP-02 test double)
//
// Installs an envelope-v1 host on a scope (globalThis by default): a
// deep-frozen, non-writable `__PRI_HOST__` and a scriptable `priBridge`. Tests
// script per-op behaviour (reply, error, delay, late, duplicate, malformed,
// silence), push events with sequence numbers, and ask JavaScript questions as
// a shell would (Android Back). It mirrors what the Swift and Kotlin shells
// must do, so the contract is executable without a device.
// ─────────────────────────────────────────────────────────────────────────────
import { deepFreeze } from './host.js';

export function createFakeHost({
  scope = globalThis,
  protocol = 1,
  capabilities = {},
  shell = { version: '0.0', build: '0', id: 'test.fake' },
  release = null,
  handlers = {},
} = {}) {
  const sent = [];
  const nativeReplies = new Map();
  let seq = 0;
  let nativeId = 0;

  const receive = message => {
    if (typeof scope.__priNativeReceive === 'function') scope.__priNativeReceive(message);
  };

  const behaviour = new Map(Object.entries(handlers));
  const api = {
    sent,
    /** Script `cap.op`: fn(payload, envelope, tools) may return a result, throw
     * {code,message}, or return tools.SILENT to never answer. */
    on(key, fn) { behaviour.set(key, fn); return api; },
    reply(id, result) { receive({ v: 1, id, ok: true, result }); },
    fail(id, code, message = code) { receive({ v: 1, id, ok: false, error: { code, message, retryable: false } }); },
    raw(message) { receive(message); },
    event(event, payload = {}, explicitSeq) {
      const s = explicitSeq ?? seq++;
      if (explicitSeq !== undefined) seq = Math.max(seq, explicitSeq + 1);
      receive({ v: 1, event, seq: s, payload });
    },
    /** Ask JavaScript a question; resolves with its reply envelope. */
    ask(req, payload = {}) {
      const id = `n:${++nativeId}`;
      return new Promise(resolve => {
        nativeReplies.set(id, resolve);
        receive({ v: 1, id, req, payload });
      });
    },
    lastRequest(cap, op) {
      for (let i = sent.length - 1; i >= 0; i--) if (sent[i].cap === cap && sent[i].op === op) return sent[i];
      return null;
    },
    uninstall() {
      try { delete scope.__PRI_HOST__; } catch { /* non-configurable in real shells; tests use a fresh scope */ }
      delete scope.priBridge;
      delete scope.__priNativeReceive;
    },
  };

  const SILENT = Symbol('silent');
  const tools = { SILENT, reply: api.reply, fail: api.fail, raw: api.raw };

  scope.priBridge = {
    postMessage(json) {
      const envelope = typeof json === 'string' ? JSON.parse(json) : json;
      // Replies to native → JS requests.
      if (typeof envelope.id === 'string' && envelope.id.startsWith('n:') && nativeReplies.has(envelope.id)) {
        const done = nativeReplies.get(envelope.id);
        nativeReplies.delete(envelope.id);
        done(envelope);
        return;
      }
      sent.push(envelope);
      const fn = behaviour.get(`${envelope.cap}.${envelope.op}`);
      if (envelope.op === 'cancel') return;
      if (!fn) { queueMicrotask(() => api.fail(envelope.id, 'UNSUPPORTED', `${envelope.cap}.${envelope.op}`)); return; }
      queueMicrotask(async () => {
        try {
          const result = await fn(envelope.payload, envelope, tools);
          if (result === SILENT) return;
          api.reply(envelope.id, result ?? {});
        } catch (error) {
          api.fail(envelope.id, error?.code || 'INTERNAL', error?.message || 'fake host failure');
        }
      });
    },
  };

  const descriptor = deepFreeze({ protocol, shell, release, capabilities });
  Object.defineProperty(scope, '__PRI_HOST__', { value: descriptor, writable: false, configurable: true, enumerable: false });
  api.SILENT = SILENT;
  return api;
}
