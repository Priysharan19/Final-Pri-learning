// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · priNative — the one platform-neutral native boundary (CP-02)
//
// Product code asks "can this host do X?" and calls X here. It never touches
// window.webkit, never reads injected `__PRI_*` globals, and never branches on
// OS identity. Swift and Kotlin shells implement the same contract:
//   docs/cross-platform/CROSS_PLATFORM_ARCHITECTURE.md §4
//
// Transport per capability is chosen by the host descriptor (host.js):
//   'bridge' → envelope v1 over priBridge (bridge.js)
//   'legacy' → pre-envelope Apple handlers (legacyApple.js), migration only
// Exactly one transport is used per capability, so an operation can never be
// sent twice. A capability the host does not advertise is UNSUPPORTED.
// ─────────────────────────────────────────────────────────────────────────────
import { discoverHost, hostReleaseIdentity } from './host.js';
import { createBridge, createEventBus } from './bridge.js';
import { createLegacyApple } from './legacyApple.js';
import { PriNativeError } from './errors.js';

export { PriNativeError, CODES, isPriNativeError } from './errors.js';

let runtime = null;
const listenedBridges = new WeakSet();
const LIFECYCLE_STATES = new Set(['active', 'inactive', 'background']);

// In browsers and WebViews `window === globalThis`; Node tests stub `window`.
function scopeOf() { return typeof window !== 'undefined' && window ? window : globalThis; }

function bridgePoster(scope) {
  return envelope => {
    const apple = scope?.webkit?.messageHandlers?.priBridge;
    if (apple && typeof apple.postMessage === 'function') { apple.postMessage(JSON.parse(JSON.stringify(envelope))); return true; }
    const android = scope?.priBridge;
    if (android && typeof android.postMessage === 'function') { android.postMessage(JSON.stringify(envelope)); return true; }
    return false;
  };
}

function getRuntime() {
  const scope = scopeOf();
  if (runtime && runtime.scope === scope && !runtime.bridge?.disposed) return runtime;
  const bus = createEventBus();
  const legacy = createLegacyApple({ scope, emit: bus.emit });
  const bridge = createBridge({ post: bridgePoster(scope), events: bus });
  runtime = { scope, bus, legacy, bridge, readySent: false, lifecycleState: null };
  const rt = runtime;
  bus.on('lifecycle.state', payload => {
    if (LIFECYCLE_STATES.has(payload?.state)) rt.lifecycleState = payload.state;
  });
  const host = discoverHost(scope);
  if (host.native && !host.legacy && scope && typeof scope === 'object') {
    scope.__priNativeReceive = raw => runtime?.bridge.receive(raw);
    // Android WebMessageListener: replies arrive as `message` events on the
    // injected priBridge object (JavaScriptReplyProxy.postMessage).
    if (typeof scope.priBridge?.addEventListener === 'function' && !listenedBridges.has(scope.priBridge)) {
      listenedBridges.add(scope.priBridge);
      scope.priBridge.addEventListener('message', event => runtime?.bridge.receive(event?.data));
    }
    runtime.readySent = true;
    // host.ready lets the shell flush buffered billing events; our own bus
    // buffers them again until a subscriber appears.
    bridge.request('host', 'ready', {}, { timeoutMs: 5_000 }).catch(() => {});
  }
  if (host.capabilities.billing?.transport === 'legacy') legacy.billing.listen();
  return runtime;
}

// Starting the runtime is idempotent: on an envelope host it installs the
// receiver and announces host.ready the first time anything asks.
// Envelope hosts inject one immutable descriptor, so its negotiation can be
// cached per object; legacy flag hosts are re-read (flags are plain globals).
let cachedHost = null;
function hostNow() {
  const scope = scopeOf();
  const raw = scope?.__PRI_HOST__;
  if (raw && typeof raw === 'object' && cachedHost?.raw === raw && cachedHost.scope === scope) return cachedHost.host;
  const host = discoverHost(scope);
  cachedHost = raw && typeof raw === 'object' ? { raw, scope, host } : null;
  return host;
}
const capOf = cap => { getRuntime(); return hostNow().capabilities[cap] || null; };
const unsupported = (cap, what = '') => Promise.reject(new PriNativeError('UNSUPPORTED', `${cap}${what ? `.${what}` : ''} is not available on this host`));

function viaBridge(cap, op, payload, opts) {
  return getRuntime().bridge.request(cap, op, payload, opts);
}

// ── capabilities ─────────────────────────────────────────────────────────────

// Answer-blind by construction: only these keys may reach a native
// recogniser/surface. Expected answers, solutions, marks or any question
// metadata cannot be posted, whatever a caller passes (docs §4.4 item 7).
const INK_OPS = new Set(['mount', 'layout', 'unmount', 'appearance', 'tool', 'enabled', 'undo', 'redo', 'clear', 'setStrokes', 'foundationRecognize', 'recognize']);
const INK_KEYS = new Set(['op', 'reqId', 'frame', 'clip', 'scrollX', 'scrollY', 'ink', 'penWidth', 'tool', 'finger', 'enabled', 'strokes', 'overrides']);
// Overrides are the student's own symbol corrections, keyed by stroke-group id
// (e.g. `h3_101_102_103`, `w0_s12`). Validate each entry by shape and drop a
// malformed one rather than refusing the whole message: refusing would silently
// switch native recognition off for the rest of the sheet.
const OVERRIDE_KEY = /^[A-Za-z0-9_]{1,256}$/;
const MAX_OVERRIDES = 512;
function sanitizeOverrides(overrides) {
  if (!overrides || typeof overrides !== 'object' || Array.isArray(overrides)) return {};
  const out = {};
  let n = 0;
  for (const [key, value] of Object.entries(overrides)) {
    if (n >= MAX_OVERRIDES) break;
    if (OVERRIDE_KEY.test(key) && typeof value === 'string' && value.length <= 32) { out[key] = value; n += 1; }
  }
  return out;
}
/** Returns the message to post, or null when it may not be posted at all. */
function answerBlindInkMessage(message) {
  if (!message || typeof message !== 'object' || !INK_OPS.has(message.op)) return null;
  if (!Object.keys(message).every(key => INK_KEYS.has(key))) return null;
  return message.overrides === undefined ? message : { ...message, overrides: sanitizeOverrides(message.overrides) };
}

const ink = Object.freeze({
  available: () => {
    const c = capOf('ink');
    return !!c && c.transport === 'legacy' && getRuntime().legacy.ink.available();
  },
  facts: () => {
    const c = capOf('ink');
    return c ? { stylus: c.stylus === true, finger: c.finger === true, fingerDefault: c.fingerDefault === true } : null;
  },
  /** Fire-and-forget surface message (mount/layout/tool/...). Ink v1 is only
   * defined over the legacy Apple transport; no envelope host advertises it. */
  post(message) {
    const c = capOf('ink');
    if (!c || c.transport !== 'legacy') return false;
    const safe = answerBlindInkMessage(message);
    if (!safe) return false;
    return getRuntime().legacy.ink.post(safe);
  },
  onMessage(fn) {
    return getRuntime().legacy.ink.onMessage(fn);
  },
});

const photo = Object.freeze({
  available: () => !!capOf('photo'),
  ocr: () => capOf('photo')?.ocr === true,
  recognize(dataURL, { timeoutMs = 12_000, signal = null } = {}) {
    const c = capOf('photo');
    if (!c) return unsupported('photo', 'recognize');
    if (typeof dataURL !== 'string' || !/^data:image\//.test(dataURL)) {
      return Promise.reject(new PriNativeError('BAD_REQUEST', 'The selected photo could not be prepared for handwriting recognition.'));
    }
    if (c.transport === 'legacy') return getRuntime().legacy.photo.recognize(dataURL, { timeoutMs, signal });
    return viaBridge('photo', 'recognize', { dataURL }, { timeoutMs, signal });
  },
});

const BILLING_ACTIONS = new Set(['products', 'purchase', 'unfinished', 'restore', 'finish']);
const billing = Object.freeze({
  available: () => {
    const c = capOf('billing');
    if (!c) return false;
    return c.transport === 'legacy' ? getRuntime().legacy.billing.available() : true;
  },
  /** Which store sheet to present — selects copy/SDK flow only, never logic. */
  store: () => capOf('billing')?.store || null,
  request(action, body = {}, { timeoutMs = 30_000, signal = null } = {}) {
    const c = capOf('billing');
    if (!c) return unsupported('billing', action);
    if (!BILLING_ACTIONS.has(action)) return Promise.reject(new PriNativeError('BAD_REQUEST', `unknown billing action ${action}`));
    if (c.transport === 'legacy') return getRuntime().legacy.billing.request(action, body, { timeoutMs, signal });
    // A purchase cannot be cancelled once the store sheet is up; aborting only
    // stops JavaScript waiting, and the late result is recovered as an event.
    return viaBridge('billing', action, body, { timeoutMs, signal, cancellable: action !== 'purchase' });
  },
  onTransactionUpdate(fn) {
    const rt = getRuntime();
    if (capOf('billing')?.transport === 'legacy') rt.legacy.billing.listen();
    return rt.bus.on('billing.transactionUpdated', fn);
  },
});

const cloud = Object.freeze({
  available: () => {
    const c = capOf('cloud');
    if (!c || c.configured !== true) return false;
    return c.transport === 'legacy' ? getRuntime().legacy.cloud.available() : true;
  },
  /** One bounded /v1 request through the native cookie jar. Resolves
   * `{ status, body, requestId }`; HTTP status handling stays in cloudTransport. */
  request({ path, method, body, requestId, idempotencyKey }, { timeoutMs = 12_000, signal = null } = {}) {
    const c = capOf('cloud');
    if (!c || c.configured !== true) return Promise.reject(new PriNativeError('UNAVAILABLE', 'Native Pri cloud transport is not configured.'));
    const req = { path, method, body, requestId, idempotencyKey };
    if (c.transport === 'legacy') return getRuntime().legacy.cloud.request(req, { timeoutMs, signal });
    return viaBridge('cloud', 'request', req, { timeoutMs, signal });
  },
  /** Forget the cloud session held by the shell's native jar (Disconnect),
   * whether or not the server logout succeeded. Resolves true/false; never throws. */
  forgetSession() {
    const c = capOf('cloud');
    if (!c) return Promise.resolve(false);
    const done = c.transport === 'legacy'
      ? getRuntime().legacy.cloud.forget()
      : viaBridge('cloud', 'forgetSession', {}, { timeoutMs: 5_000 }).then(() => true);
    return done.catch(() => false);
  },
});

const MAX_SHARE_BYTES = 6 * 1024 * 1024;
function base64OfBytes(bytes) {
  let binary = '';
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  for (let i = 0; i < view.length; i += 0x8000) binary += String.fromCharCode(...view.subarray(i, i + 0x8000));
  return globalThis.btoa(binary);
}
function safeFilename(name) {
  const cleaned = String(name || 'pri-export').replace(/[\\/:*?"<>|\u0000-\u001f]/g, '-').replace(/^\.+/, '').slice(0, 120);
  return cleaned || 'pri-export';
}
const share = Object.freeze({
  available: () => {
    const c = capOf('share');
    if (!c) return false;
    return c.transport === 'legacy' ? getRuntime().legacy.share.available() : true;
  },
  binary: () => capOf('share')?.binary === true,
  printable: () => capOf('share')?.print === true,
  /** Share/export one file. `text` for text files, or `bytes` (Uint8Array). */
  file({ filename, mimeType = 'application/octet-stream', text, bytes } = {}) {
    const c = capOf('share');
    if (!c) return unsupported('share', 'file');
    const name = safeFilename(filename);
    const mime = /^[a-z]+\/[a-z0-9.+-]+$/i.test(String(mimeType)) ? String(mimeType) : 'application/octet-stream';
    if (typeof text !== 'string' && !(bytes instanceof Uint8Array)) return Promise.reject(new PriNativeError('BAD_REQUEST', 'share.file needs text or bytes'));
    const size = typeof text === 'string' ? text.length : bytes.byteLength;
    if (size > MAX_SHARE_BYTES) return Promise.reject(new PriNativeError('TOO_LARGE', 'That file is too large to share.'));
    if (c.transport === 'legacy') {
      return getRuntime().legacy.share.file({ filename: name, text: typeof text === 'string' ? text : undefined });
    }
    if (typeof text !== 'string' && c.binary !== true) return unsupported('share', 'file(binary)');
    const payload = typeof text === 'string' ? { filename: name, mimeType: mime, text } : { filename: name, mimeType: mime, base64: base64OfBytes(bytes) };
    return viaBridge('share', 'file', payload, { timeoutMs: 10 * 60_000, cancellable: false });
  },
  print() {
    const c = capOf('share');
    if (!c || c.print !== true || c.transport === 'legacy') return unsupported('share', 'print');
    return viaBridge('share', 'print', {}, { timeoutMs: 10 * 60_000, cancellable: false });
  },
});

/** Files are imported with the platform picker behind <input type=file> on
 * every host (WKWebView natively, Android via onShowFileChooser). This is the
 * one validated way to ask for a file. */
const files = Object.freeze({
  pick({ accept = '', multiple = false, maxBytes = 25 * 1024 * 1024 } = {}) {
    const doc = scopeOf().document;
    if (!doc?.createElement) return unsupported('files', 'pick');
    return new Promise((resolve, reject) => {
      const input = doc.createElement('input');
      input.type = 'file';
      if (accept) input.accept = String(accept).slice(0, 200);
      input.multiple = !!multiple;
      input.addEventListener('change', () => {
        const list = [...(input.files || [])];
        const tooBig = list.find(f => Number(f.size) > maxBytes);
        if (tooBig) reject(new PriNativeError('TOO_LARGE', `${tooBig.name} is too large.`));
        else resolve(list);
      }, { once: true });
      input.addEventListener('cancel', () => resolve([]), { once: true });
      input.click();
    });
  },
});

const lifecycle = Object.freeze({
  /** Latest known app state. Native hosts report it; browsers derive it. */
  state() {
    const latest = getRuntime().lifecycleState;
    if (latest) return latest;
    const doc = scopeOf().document;
    return doc?.visibilityState === 'hidden' ? 'background' : 'active';
  },
  /** Subscribe to app state changes. Supplements, never replaces,
   * `visibilitychange`/`pagehide`, which keep working in browsers. */
  on(fn) {
    if (typeof fn !== 'function') return () => {};
    const rt = getRuntime();
    const off = rt.bus.on('lifecycle.state', payload => {
      if (LIFECYCLE_STATES.has(payload?.state)) fn(payload.state);
    });
    return off;
  },
  /** True when the host has a hardware/gesture Back button (Android). */
  hasBackButton: () => capOf('lifecycle')?.backButton === true,
  /** Tell the shell whether the page wants the next Back (sheet open, or away
   * from home). The shell decides synchronously from this — no timeout race. */
  declareBack(wanted) {
    const c = capOf('lifecycle');
    if (!c || c.backButton !== true || c.transport === 'legacy') return Promise.resolve(false);
    return viaBridge('lifecycle', 'setBackHandled', { handled: wanted === true }, { timeoutMs: 5_000 }).then(() => true);
  },
  /** The shell passed Back to the page (it declared it wanted it). */
  onBack(fn) {
    if (typeof fn !== 'function') return () => {};
    return getRuntime().bus.on('lifecycle.back', () => fn());
  },
  /** Native → JS question, e.g. Android Back: handler returns { handled }. */
  onBackRequested(fn) {
    return getRuntime().bridge.onRequest('lifecycle.backRequested', async payload => {
      const handled = await fn(payload);
      return { handled: handled === true };
    });
  },
});

const storage = Object.freeze({
  /** True when the host guarantees app-sandbox storage the OS will not evict. */
  durable: () => capOf('storage')?.durable === true,
});

// Local reminders (notifications v1). The page asks permission only from the
// Settings toggle, sends generic copy (never a question or a mark) and the
// shell replaces its pending set each time; see client/src/reminders/.
const notifications = Object.freeze({
  available: () => { const c = capOf('notifications'); return !!c && c.transport !== 'legacy'; },
  requestPermission() { if (!capOf('notifications')) return unsupported('notifications', 'requestPermission'); return viaBridge('notifications', 'requestPermission', {}, { timeoutMs: 120_000, cancellable: false }); },
  schedule(payload) { if (!capOf('notifications')) return unsupported('notifications', 'schedule'); const items = Array.isArray(payload?.items) ? payload.items.slice(0, 64) : []; return viaBridge('notifications', 'schedule', { items }, { timeoutMs: 15_000 }); },
  cancelAll() { if (!capOf('notifications')) return Promise.resolve({}); return viaBridge('notifications', 'cancelAll', {}, { timeoutMs: 10_000 }); },
});

const device = Object.freeze({
  /** Facts the page cannot measure itself. Never an OS or model name. */
  facts: () => {
    const c = capOf('device');
    return { stylusSeen: c?.stylusSeen === true, stylusCapable: c?.stylusCapable === true, safeAreaApplied: c?.safeAreaApplied === true };
  },
});

// A one-time sign-in code from SMS (Android: the SMS User Consent API, since a
// WebView has no WebOTP). The person agrees to share one message in a system
// sheet; only the digits come back. The server still verifies the code.
//
// Play services listens for the message for a fixed five minutes
// (SmsRetriever.startSmsUserConsent). The page's own wait MUST be longer: the
// consent sheet can appear at 4:59 and the person may tap "Allow" after 5:00.
// If the page gave up at the same moment it would already have sent
// otp.cancel, and the code the person just agreed to share would be lost.
// Two extra minutes cover the sheet; a code typed by hand still wins instantly.
export const OTP_NATIVE_SMS_WAIT_MS = 5 * 60 * 1000;
export const OTP_WAIT_MS = 7 * 60 * 1000;
const otp = Object.freeze({
  smsAvailable: () => { const c = capOf('otp'); return c?.transport === 'bridge' && c?.sms === true; },
  /** Resolves with a six-digit string; rejects on cancel, timeout or refusal. */
  async smsCode({ signal = null } = {}) {
    if (!otp.smsAvailable()) return unsupported('otp', 'smsCode');
    const result = await viaBridge('otp', 'smsCode', {}, { timeoutMs: OTP_WAIT_MS, signal });
    const code = String(result?.code || '');
    if (!/^[0-9]{6}$/.test(code)) throw new PriNativeError('BAD_REQUEST', 'The shell returned no usable code');
    return code;
  },
});

// ── identity (Sign in with Apple) ────────────────────────────────────────────
// The shell runs the system sign-in sheet and hands back Apple's identity
// token; the Pri server (not the shell, not this page) verifies that token and
// issues the session. The nonce the token must carry is issued by the server
// and single-use, so a captured token cannot be replayed into a new session.
const NONCE_HASH = /^[0-9a-f]{64}$/;
const identity = Object.freeze({
  available: () => !!capOf('identity'),
  /** Which providers the shell can open a native sign-in sheet for. */
  providers: () => {
    const c = capOf('identity');
    return { apple: !!c && c.transport !== 'legacy' && c.apple === true };
  },
  /**
   * Open the shell's Sign in with Apple sheet. `nonceHash` is the lowercase
   * hex SHA-256 of the server-issued nonce (Apple's documented pattern: the
   * digest goes on the request and comes back in the token's `nonce` claim; the
   * raw nonce goes to the server, which accepts either form). Resolves
   * `{ identityToken, authorizationCode?, nonce, user? }`; the person dismissing
   * the sheet rejects with USER_CANCELLED. The system sheet cannot be dismissed
   * from JavaScript, so an abort only stops this page waiting.
   */
  appleSignIn({ nonceHash } = {}, { timeoutMs = 5 * 60_000, signal = null } = {}) {
    const c = capOf('identity');
    if (!c || c.apple !== true || c.transport === 'legacy') return unsupported('identity', 'appleSignIn');
    const digest = String(nonceHash || '');
    if (!NONCE_HASH.test(digest)) {
      return Promise.reject(new PriNativeError('BAD_REQUEST', 'identity.appleSignIn needs the SHA-256 hex digest of a server-issued nonce'));
    }
    return viaBridge('identity', 'appleSignIn', { nonce: digest }, { timeoutMs, signal, cancellable: false }).then(result => {
      if (result.nonce !== digest) throw new PriNativeError('INTERNAL', 'identity.appleSignIn answered for a different nonce');
      return result;
    });
  },
});

export const priNative = Object.freeze({
  /** Deep-frozen host descriptor: capabilities and shell/release facts, no OS. */
  host: () => { getRuntime(); return discoverHost(scopeOf()); },
  /** True inside any native shell (Apple or Android), false in a browser. */
  isNativeShell: () => { getRuntime(); return discoverHost(scopeOf()).native === true; },
  /** The web assets ship inside the app, so no service worker is needed. */
  bundledAssets: () => discoverHost(scopeOf()).bundledAssets === true,
  has: cap => !!capOf(cap),
  version: cap => capOf(cap)?.version || 0,
  releaseIdentity: () => hostReleaseIdentity(scopeOf()),
  ink, photo, billing, cloud, share, files, lifecycle, storage, device, identity, notifications, otp,
  /** Bridge counters for diagnostics (no user data). */
  stats: () => (runtime ? runtime.bridge.stats() : null),
  /** Cancel everything in flight (tests, explicit teardown). */
  dispose(reason) { runtime?.bridge.dispose(reason); runtime = null; },
  /** Start listening now (boot): installs the receiver and sends host.ready. */
  start() { getRuntime(); },
});

export default priNative;
