// Pri Learning · cloud session lifecycle signal
//
// Settings hosts several independently mounted cloud-backed panels. A successful
// account link/unlink must refresh all of them immediately; relying on a route
// remount leaves assignments/classrooms/staff controls stale after sign-in.

export const CLOUD_SESSION_EVENT = 'pri:cloud-session-change';

// ── Other tabs ───────────────────────────────────────────────────────────────
// The session cookie and the profile ↔ account link are shared by every tab of
// this origin, but a window event is not. Signing in (or out) in one tab is
// relayed to the others over a same-origin BroadcastChannel, where it is
// re-dispatched as the same local event — so a question left open in a second
// tab drops its "sign in" notice, or learns it was signed out, without a
// reload. The message carries the four public fields below and nothing else:
// never a token, a cookie, an email or anything typed. A tab that receives one
// re-reads its own state from the server and IndexedDB; the message itself is
// only a nudge and is trusted for nothing.
export const CLOUD_SESSION_CHANNEL = 'pri-cloud-session';
let relay = null;

function dispatchLocal(detail) {
  if (typeof globalThis.dispatchEvent !== 'function' || typeof globalThis.CustomEvent !== 'function') return;
  globalThis.dispatchEvent(new globalThis.CustomEvent(CLOUD_SESSION_EVENT, { detail }));
}

function publicDetail(detail = {}) {
  return {
    localProfileId: detail.localProfileId == null ? '' : String(detail.localProfileId).slice(0, 160),
    connected: detail.connected === true,
    accountId: detail.connected === true && detail.accountId != null ? String(detail.accountId).slice(0, 160) : null,
    role: detail.connected === true && detail.role != null ? String(detail.role).slice(0, 40) : null
  };
}

function sessionRelay() {
  if (relay) return relay;
  // A real page only: Node has a BroadcastChannel too, and one opened there
  // would hold a test process open.
  if (typeof window === 'undefined' || typeof document === 'undefined' || typeof globalThis.BroadcastChannel !== 'function') return null;
  try {
    relay = new globalThis.BroadcastChannel(CLOUD_SESSION_CHANNEL);
    relay.onmessage = event => {
      const data = event?.data;
      if (!data || typeof data !== 'object') return;
      dispatchLocal({ ...publicDetail(data), fromOtherTab: true });
    };
  } catch { relay = null; }
  return relay;
}

export function announceCloudSessionChange(detail = {}) {
  dispatchLocal(detail);
  try { sessionRelay()?.postMessage(publicDetail(detail)); } catch { /* the local event has already been delivered */ }
}

export function onCloudSessionChange(listener) {
  if (typeof listener !== 'function' || typeof globalThis.addEventListener !== 'function') return () => {};
  sessionRelay();
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
