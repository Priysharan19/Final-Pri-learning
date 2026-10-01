// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · priNative closed error model (CP-02)
//
// Every native failure that reaches product code has one of these codes, on
// every host. Provider-specific detail (a StoreKit or URLSession code) is kept
// in `detail.providerCode`, so telemetry keeps its meaning without letting a
// shell invent new top-level codes that product code would have to learn.
// docs/cross-platform/CROSS_PLATFORM_ARCHITECTURE.md §4.3 is the authority.
// ─────────────────────────────────────────────────────────────────────────────

export const CODES = Object.freeze([
  'UNSUPPORTED',       // the host does not offer this capability/op/version
  'BAD_REQUEST',       // the request (or a native reply) failed validation
  'TIMEOUT',           // JavaScript stopped waiting
  'CANCELLED',         // AbortSignal, dispose, or reload
  'USER_CANCELLED',    // the person dismissed a sheet/picker
  'PERMISSION_DENIED',
  'UNAVAILABLE',       // offline, store unavailable, cloud not configured, too busy
  'TOO_LARGE',
  'PROVIDER_ERROR',    // the platform service (StoreKit, Vision, URLSession) failed
  'UNVERIFIED',        // a store transaction failed local signature verification
  'INTERNAL',
]);

const KNOWN = new Set(CODES);

// Legacy Apple bridge codes → the closed set. Unknown codes become INTERNAL.
const PROVIDER_MAP = Object.freeze({
  NATIVE_BILLING_BAD_REQUEST: 'BAD_REQUEST',
  NATIVE_BILLING_UNAVAILABLE: 'UNSUPPORTED',
  NATIVE_BILLING_TIMEOUT: 'TIMEOUT',
  NATIVE_BILLING_ERROR: 'PROVIDER_ERROR',
  STOREKIT_PRODUCT_UNAVAILABLE: 'UNAVAILABLE',
  STOREKIT_TRANSACTION_NOT_PENDING: 'PROVIDER_ERROR',
  STOREKIT_TRANSACTION_UNVERIFIED: 'UNVERIFIED',
  STOREKIT_UNKNOWN_RESULT: 'PROVIDER_ERROR',
  STOREKIT_USER_CANCELLED: 'USER_CANCELLED',
  STOREKIT_PENDING: 'PROVIDER_ERROR',
  STOREKIT_ERROR: 'PROVIDER_ERROR',
  NATIVE_CLOUD_BAD_REQUEST: 'BAD_REQUEST',
  CLOUD_DISABLED: 'UNAVAILABLE',
  CLOUD_REQUEST_TOO_LARGE: 'TOO_LARGE',
  CLOUD_RESPONSE_TOO_LARGE: 'TOO_LARGE',
  CLOUD_BAD_RESPONSE: 'PROVIDER_ERROR',
  CLOUD_NETWORK_ERROR: 'UNAVAILABLE',
  NATIVE_CLOUD_ERROR: 'PROVIDER_ERROR',
});

export function normalizeCode(code) {
  const raw = String(code || '');
  if (KNOWN.has(raw)) return raw;
  return PROVIDER_MAP[raw] || 'INTERNAL';
}

const RETRYABLE = new Set(['TIMEOUT', 'UNAVAILABLE']);

export class PriNativeError extends Error {
  constructor(code, message, { retryable, providerCode, cause } = {}) {
    const normalized = normalizeCode(code);
    super(String(message || normalized));
    this.name = 'PriNativeError';
    this.code = normalized;
    this.retryable = typeof retryable === 'boolean' ? retryable : RETRYABLE.has(normalized);
    const provider = providerCode ?? (KNOWN.has(String(code || '')) ? undefined : (code ? String(code) : undefined));
    this.detail = provider ? Object.freeze({ providerCode: String(provider).slice(0, 80) }) : undefined;
    if (cause !== undefined) this.cause = cause;
  }
}

/** Build a PriNativeError from an envelope `error` object (untrusted). */
export function fromWireError(error) {
  const e = error && typeof error === 'object' ? error : {};
  const providerCode = e.detail && typeof e.detail === 'object' ? e.detail.providerCode : undefined;
  return new PriNativeError(e.code, typeof e.message === 'string' ? e.message.slice(0, 500) : undefined, {
    retryable: typeof e.retryable === 'boolean' ? e.retryable : undefined,
    providerCode: providerCode ?? (KNOWN.has(String(e.code || '')) ? undefined : e.code),
  });
}

export const isPriNativeError = value => value instanceof PriNativeError;
