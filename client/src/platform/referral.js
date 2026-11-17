// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the invite link on the device (server/platform/referral.js)
//
// A friend opens `/?invite=CODE` on the website. The code is kept on this
// device only until this browser's account is admitted (signed in, email
// verified, a guardian's approval where one is needed); then it is presented
// ONCE to the server, which alone decides whether a 7-day trial is granted.
// Nothing about a friend is ever collected here: the code is all there is.
// The store apps neither capture nor claim an invite (web only, store rules).
// ─────────────────────────────────────────────────────────────────────────────
import { cloud, cloudAvailable } from './cloudTransport.js';
import { priNative } from './native/index.js';

const KEY = 'pri-invite-v1';
export const INVITE_PARAM = 'invite';
export const INVITE_CODE = /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{10}$/;
const KEEP_MS = 14 * 24 * 60 * 60 * 1000;

const storage = () => { try { return typeof window !== 'undefined' ? window.localStorage : null; } catch { return null; } };
const web = () => { try { return !priNative.isNativeShell(); } catch { return true; } };

/** Keep an invite code from the address bar, and take it out of the address. */
export function captureInvite(loc = typeof window !== 'undefined' ? window.location : null) {
  if (!loc || !web()) return null;
  let url;
  try { url = new URL(loc.href); } catch { return null; }
  const code = String(url.searchParams.get(INVITE_PARAM) || '').trim().toUpperCase();
  if (!url.searchParams.has(INVITE_PARAM)) return null;
  url.searchParams.delete(INVITE_PARAM);
  try { window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`); } catch { /* keep going */ }
  if (!INVITE_CODE.test(code)) return null;
  try { storage()?.setItem(KEY, JSON.stringify({ code, at: Date.now() })); } catch { /* private mode: no invite */ }
  return code;
}

export function pendingInvite(now = Date.now()) {
  try {
    const row = JSON.parse(storage()?.getItem(KEY) || 'null');
    if (row && INVITE_CODE.test(row.code) && now - Number(row.at) < KEEP_MS) return row.code;
  } catch { /* nothing kept */ }
  return null;
}

const forget = () => { try { storage()?.removeItem(KEY); } catch { /* nothing kept */ } };

/**
 * Present a kept invite once the account is admitted. Returns the server's
 * answer ({ granted, endsAt }) or null. A definite refusal forgets the code; a
 * network failure keeps it for the next admission.
 */
export async function claimPendingInvite() {
  if (!web() || !cloudAvailable()) return null;
  const code = pendingInvite();
  if (!code) return null;
  try {
    const result = await cloud.claimReferral(code);
    forget();
    return result;
  } catch (error) {
    if (Number(error?.status) >= 400 && Number(error?.status) < 500 && error?.status !== 429) forget();
    return null;
  }
}

/** The account's invite code and trial dates, or null where none is offered. */
export async function referralState() {
  if (!cloudAvailable()) return null;
  try { return await cloud.referral(); } catch { return null; }
}

/** The full invite link for this site. */
export function inviteLink(code, origin = typeof window !== 'undefined' ? window.location.origin : '') {
  return INVITE_CODE.test(String(code || '')) ? `${origin}/?${INVITE_PARAM}=${code}` : null;
}
