// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · priNative host discovery and negotiation (CP-02)
//
// The ONLY module that reads what a native shell injects into the page
// (`__PRI_HOST__`, and the legacy `__PRI_NATIVE*__` flags of Apple shells that
// predate it). Everything else asks for capabilities through priNative.
//
// Rules (docs/cross-platform/CROSS_PLATFORM_ARCHITECTURE.md §4.2):
//   · no OS identity is exposed to product code — only capabilities;
//   · protocol newer than MAX_PROTOCOL ⇒ treat as a browser host (fail closed);
//   · each capability negotiates the highest version both sides support;
//   · the descriptor is deep-frozen; flags are hints, native still enforces;
//   · each capability names exactly one transport, so nothing is double-sent.
// ─────────────────────────────────────────────────────────────────────────────
import { MAX_PROTOCOL, isPlainObject } from './envelope.js';

/** Capability versions this build of the shared product understands. */
export const SUPPORTED = Object.freeze({
  ink: [1], photo: [1], billing: [1], cloud: [1], share: [1],
  files: [1], lifecycle: [1], storage: [1], device: [1], identity: [1], notifications: [1],
});

export const CAPABILITIES = Object.freeze(Object.keys(SUPPORTED));
const TRANSPORTS = new Set(['bridge', 'legacy']);

export function deepFreeze(value, seen = new WeakSet()) {
  if (!value || typeof value !== 'object' || seen.has(value)) return value;
  seen.add(value);
  for (const key of Object.keys(value)) deepFreeze(value[key], seen);
  return Object.freeze(value);
}

function highestCommon(offered, supported) {
  const mine = new Set(supported);
  const common = (Array.isArray(offered) ? offered : [])
    .filter(v => Number.isSafeInteger(v) && v > 0 && mine.has(v));
  return common.length ? Math.max(...common) : 0;
}

function negotiateCapabilities(raw, defaultTransport) {
  const out = {};
  if (!isPlainObject(raw)) return out;
  for (const cap of CAPABILITIES) {
    const entry = raw[cap];
    if (!isPlainObject(entry)) continue;
    const version = highestCommon(entry.versions, SUPPORTED[cap]);
    if (!version) continue; // capability-version mismatch ⇒ unsupported, never a crash
    const transport = TRANSPORTS.has(entry.transport) ? entry.transport : defaultTransport;
    const facts = {};
    for (const [key, value] of Object.entries(entry)) {
      if (key === 'versions' || key === 'transport') continue;
      if (['string', 'number', 'boolean'].includes(typeof value)) facts[key] = value;
    }
    out[cap] = { version, transport, ...facts };
  }
  return out;
}

const BROWSER = deepFreeze({
  kind: 'browser', native: false, bundledAssets: false, protocol: 0,
  shell: null, release: null, capabilities: {}, diagnostics: { protocolUnsupported: false },
});

function looksLikeRelease(value) {
  return isPlainObject(value) && value.schemaVersion === 1 && /^[0-9a-f]{40}$/.test(String(value.releaseSha || ''));
}

/**
 * Pre-CP-02 Apple shells inject boolean flags instead of `__PRI_HOST__`.
 * Synthesize the equivalent descriptor; every capability uses the legacy
 * transport. Kept only for the migration window (see §4.2 "Migration").
 */
function legacyAppleHost(scope) {
  const flags = ['__PRI_NATIVE__', '__PRI_NATIVE_INK__', '__PRI_NATIVE_PHOTO__', '__PRI_NATIVE_BILLING__', '__PRI_NATIVE_CLOUD__'];
  if (!flags.some(flag => scope[flag] === true)) return null;
  const caps = {};
  const webkit = scope.webkit?.messageHandlers;
  if (scope.__PRI_NATIVE_INK__ && webkit?.priInk) caps.ink = { versions: [1], transport: 'legacy', stylus: true, finger: true };
  if (scope.__PRI_NATIVE_PHOTO__ && webkit?.priPhoto) caps.photo = { versions: [1], transport: 'legacy', ocr: true };
  if (scope.__PRI_NATIVE_BILLING__ === true && webkit?.priBilling) caps.billing = { versions: [1], transport: 'legacy', store: 'app-store' };
  if (scope.__PRI_NATIVE_CLOUD__ === true && webkit?.priCloud) {
    caps.cloud = { versions: [1], transport: 'legacy', configured: scope.__PRI_NATIVE_CLOUD_CONFIGURED__ === true };
  }
  if (scope.__PRI_NATIVE__ === true && webkit?.priShare) caps.share = { versions: [1], transport: 'legacy', binary: false, print: false };
  if (scope.__PRI_NATIVE__ === true) caps.storage = { versions: [1], transport: 'legacy', durable: true };
  return {
    kind: 'native', native: scope.__PRI_NATIVE__ === true, bundledAssets: scope.__PRI_NATIVE__ === true,
    protocol: 0, legacy: true, shell: null,
    release: looksLikeRelease(scope.__PRI_NATIVE_RELEASE_IDENTITY__) ? { ...scope.__PRI_NATIVE_RELEASE_IDENTITY__ } : null,
    capabilities: negotiateCapabilities(caps, 'legacy'),
    diagnostics: { protocolUnsupported: false },
  };
}

/**
 * Read the host descriptor afresh. Callers must not cache the result at module
 * scope: a shell may inject after an early import, and tests swap hosts.
 */
export function discoverHost(scope = globalThis) {
  if (!scope || typeof scope !== 'object') return BROWSER;
  const raw = scope.__PRI_HOST__;
  if (isPlainObject(raw)) {
    const protocol = Number(raw.protocol);
    if (!Number.isSafeInteger(protocol) || protocol < 1 || protocol > MAX_PROTOCOL) {
      // A newer (or garbage) protocol: fail closed to a browser host and say so.
      return deepFreeze({ ...BROWSER, diagnostics: { protocolUnsupported: true, offeredProtocol: String(raw.protocol).slice(0, 16) } });
    }
    return deepFreeze({
      kind: 'native', native: true, bundledAssets: raw.bundledAssets !== false,
      protocol, legacy: false,
      shell: isPlainObject(raw.shell) ? {
        version: String(raw.shell.version || '').slice(0, 32),
        build: String(raw.shell.build || '').slice(0, 32),
        id: String(raw.shell.id || '').slice(0, 120),
      } : null,
      release: looksLikeRelease(raw.release) ? { ...raw.release } : null,
      capabilities: negotiateCapabilities(raw.capabilities, 'bridge'),
      diagnostics: { protocolUnsupported: false },
    });
  }
  const legacy = legacyAppleHost(scope);
  return legacy ? deepFreeze(legacy) : BROWSER;
}

/** The bundled release identity the shell reports, if any (diagnostics only). */
export function hostReleaseIdentity(scope = globalThis) {
  const host = discoverHost(scope);
  if (host.release) return host.release;
  // Legacy shells may set the identity without the ink/native flags.
  return looksLikeRelease(scope?.__PRI_NATIVE_RELEASE_IDENTITY__) ? { ...scope.__PRI_NATIVE_RELEASE_IDENTITY__ } : null;
}
