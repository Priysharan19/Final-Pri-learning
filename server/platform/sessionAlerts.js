// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · "a device this account has never used just signed in"
//
// Called by security.js createSession after every sign-in. A device is new
// when the account already had a session and none of its sessions — live,
// expired or revoked — carried this device id. The very first sign-in of an
// account is not news; a second device, or a copied credential used from
// somewhere else, is.
//
// Two things happen, in this order: an audit row (session.new-device, with no
// personal data in its metadata), then the notice to the account's own email
// through securityEmail.js. Neither can fail the sign-in: a provider outage
// is logged as a coded warning and the student is signed in regardless. An
// account that signed up by phone has no deliverable address (otp.js writes
// an @phone.invalid placeholder) and gets the audit row only.
//
// The sender is configured once at router mount (configureSessionAlerts):
// no sender, no email, which is what a build with no email provider wants.
// ─────────────────────────────────────────────────────────────────────────────
import { asStore } from './store.js';
import { logEvent, safeCode } from './observability.js';

let sender = null;

/** Install (or clear) the notice sender. Returns the previous one. */
export function configureSessionAlerts({ send = null } = {}) {
  const previous = sender;
  sender = typeof send === 'function' ? send : null;
  return previous;
}

/** True when `deviceId` has never had a session on this account before `sessionId`. */
export async function isNewDevice(db, { accountId, sessionId, deviceId }) {
  db = asStore(db);
  const prior = await db.get('SELECT COUNT(*) AS n FROM account_sessions WHERE account_id = ? AND id <> ?', [accountId, sessionId]);
  if (!Number(prior?.n)) return false;
  const seen = await db.get('SELECT 1 AS x FROM account_sessions WHERE account_id = ? AND id <> ? AND device_id = ? LIMIT 1', [accountId, sessionId, deviceId]);
  return !seen;
}

export async function noteNewDeviceSignIn(db, { accountId, sessionId, deviceId, now = Date.now() }) {
  db = asStore(db);
  let fresh = false;
  try {
    fresh = await isNewDevice(db, { accountId, sessionId, deviceId });
  } catch (error) {
    logEvent('warn', 'session_new_device_check_failed', { code: safeCode(error?.code, 'CHECK_FAILED') });
    return { newDevice: false, notified: false };
  }
  if (!fresh) return { newDevice: false, notified: false };
  // The receipt names nothing a reader could act on: no device label, no
  // address, no session id — the session id is the account's own to list.
  try {
    await db.run('INSERT INTO audit_log(actor_account_id,action,target_kind,target_id,metadata_json,created_at) VALUES (?,?,?,?,?,?)',
      [accountId, 'session.new-device', 'account', accountId, '{}', now]);
  } catch (error) {
    logEvent('warn', 'session_new_device_audit_failed', { code: safeCode(error?.code, 'AUDIT_FAILED') });
  }
  if (!sender) return { newDevice: true, notified: false };
  const account = await db.get('SELECT email FROM accounts WHERE id = ? AND deleted_at IS NULL', [accountId]).catch(() => null);
  const to = String(account?.email || '');
  if (!to || to.endsWith('@phone.invalid')) return { newDevice: true, notified: false };
  try {
    await sender({ to, kind: 'new-device', deviceId, at: now, dedupeKey: sessionId });
    return { newDevice: true, notified: true };
  } catch (error) {
    logEvent('warn', 'session_new_device_notice_failed', { code: safeCode(error?.code, 'NOTICE_FAILED') });
    return { newDevice: true, notified: false };
  }
}
