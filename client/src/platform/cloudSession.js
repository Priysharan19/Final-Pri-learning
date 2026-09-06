// Pri Learning · cloud session lifecycle signal
//
// Settings hosts several independently mounted cloud-backed panels. A successful
// account link/unlink must refresh all of them immediately; relying on a route
// remount leaves assignments/classrooms/staff controls stale after sign-in.

export const CLOUD_SESSION_EVENT = 'pri:cloud-session-change';

export function announceCloudSessionChange(detail = {}) {
  if (typeof globalThis.dispatchEvent !== 'function' || typeof globalThis.CustomEvent !== 'function') return;
  globalThis.dispatchEvent(new globalThis.CustomEvent(CLOUD_SESSION_EVENT, { detail }));
}

export function onCloudSessionChange(listener) {
  if (typeof listener !== 'function' || typeof globalThis.addEventListener !== 'function') return () => {};
  globalThis.addEventListener(CLOUD_SESSION_EVENT, listener);
  return () => globalThis.removeEventListener?.(CLOUD_SESSION_EVENT, listener);
}

// A refreshed Premium snapshot must reach every gate that is already mounted
// (the paywall, the plan card, Pri Explain) without a route remount. The event
// carries the normalized public snapshot only — never a receipt or token.
export const ENTITLEMENT_EVENT = 'pri:entitlement-change';

export function announceEntitlementChange(detail = {}) {
  if (typeof globalThis.dispatchEvent !== 'function' || typeof globalThis.CustomEvent !== 'function') return;
  globalThis.dispatchEvent(new globalThis.CustomEvent(ENTITLEMENT_EVENT, { detail }));
}

export function onEntitlementChange(listener) {
  if (typeof listener !== 'function' || typeof globalThis.addEventListener !== 'function') return () => {};
  globalThis.addEventListener(ENTITLEMENT_EVENT, listener);
  return () => globalThis.removeEventListener?.(ENTITLEMENT_EVENT, listener);
}
