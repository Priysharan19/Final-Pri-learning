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
