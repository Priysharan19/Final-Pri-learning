// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · a sign-in from a device the account has never used (#368 port)
//
// security.js createSession calls noteSessionCreated after it writes the
// session row. When the account already had a session and this device id has
// never had one, that is a new-device sign-in: one `session.new-device` row in
// audit_log (empty metadata — the audit trail carries no address, no agent, no
// token) and one notice to the account's own address through securityEmail.js.
// The audit row is written inside the sign-in; the mail is sent off the request
// and tracked (flushSessionAlerts) so a suite can wait for it. Neither can fail
// the sign-in: createSession swallows what this throws, and a failed send is a
// structured warning (security_email_failed) with a code and no address.
//
// What is NOT a new device: the account's first session (registration or a
// first one-time-code sign-in), and a sign-in on a device id the account has
// used before. Phone-only accounts (synthetic @phone.invalid address) get the
// audit row only. The device id is the client's opaque per-device id
// (client/src/platform/cloudAccount.js cloudDeviceId), or 'web'.
// ─────────────────────────────────────────────────────────────────────────────
import { asStore } from './store.js';
import { logEvent, safeCode } from './observability.js';
import { createSecurityEmailSenderFromEnv } from './securityEmail.js';

const PHONE_ACCOUNT_EMAIL_DOMAIN = 'phone.invalid';
export const NEW_DEVICE_ACTION = 'session.new-device';

const pending = new Set();
let configuredSender; // undefined until first use, then a sender or null
let senderOverride;   // tests

function sender() {
  if (senderOverride !== undefined) return senderOverride;
  if (configuredSender === undefined) {
    try { configuredSender = createSecurityEmailSenderFromEnv(); } catch { configuredSender = null; }
  }
  return configuredSender;
}

/** Tests: use this sender (null = none configured); `undefined` restores the environment's. */
export function setSessionAlertSenderForTests(fn) {
  senderOverride = fn;
  configuredSender = undefined;
}

/** Wait for every notice sent so far to settle (sent or failed). */
export function flushSessionAlerts() {
  return Promise.all([...pending]).then(() => undefined);
}

/**
 * Record (and notify) a new-device sign-in for the session just created.
 * Returns { newDevice, emailed } for the caller's and the tests' benefit.
 */
export async function noteSessionCreated(db, { accountId, sessionId, deviceId, now = Date.now() }) {
  db = asStore(db);
  const device = String(deviceId ?? 'web').slice(0, 160);
  const prior = await db.get('SELECT COUNT(*) AS n FROM account_sessions WHERE account_id = ? AND id <> ?', [accountId, sessionId]);
  if (!Number(prior?.n)) return { newDevice: false, reason: 'first-session', emailed: false };
  const seen = await db.get('SELECT 1 AS yes FROM account_sessions WHERE account_id = ? AND device_id = ? AND id <> ? LIMIT 1', [accountId, device, sessionId]);
  if (seen) return { newDevice: false, reason: 'known-device', emailed: false };

  await db.run('INSERT INTO audit_log(actor_account_id,action,target_kind,target_id,metadata_json,created_at) VALUES (?,?,?,?,?,?)',
    [accountId, NEW_DEVICE_ACTION, 'session', sessionId, '{}', now]);

  const account = await db.get('SELECT email FROM accounts WHERE id = ? AND deleted_at IS NULL', [accountId]);
  const to = String(account?.email || '').trim().toLowerCase();
  const send = sender();
  if (!send || !to || to.endsWith(`@${PHONE_ACCOUNT_EMAIL_DOMAIN}`)) return { newDevice: true, emailed: false };

  const task = Promise.resolve()
    .then(() => send({ to, kind: 'new-device', idempotencyKey: sessionId, at: now }))
    .then(() => true, error => {
      logEvent('warn', 'security_email_failed', { code: safeCode(error?.code, 'DELIVERY_FAILED') });
      return false;
    });
  pending.add(task);
  task.finally(() => pending.delete(task));
  return { newDevice: true, emailed: true, delivery: task };
}
