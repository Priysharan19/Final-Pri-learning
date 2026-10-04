// Per-account login lockout with a sliding failure window.
//
// Failures are counted per submitted email (hashed), whether or not an account
// exists for it, so the lockout response can never be used to discover which
// emails are registered. The per-IP rate limit in accounts.js is unchanged and
// applies on top of this.
//
// The window slides: every failure extends it, and the counter only resets
// once LOCKOUT_WINDOW_MS has passed since the most recent failure. Ten failures
// inside one window lock the email for LOCKOUT_LOCK_MS; a successful sign-in
// clears the record.

import { sha256 } from './security.js';
import { asStore } from './store.js';

export const LOCKOUT_MAX_FAILURES = 10;
export const LOCKOUT_WINDOW_MS = 15 * 60 * 1000;
export const LOCKOUT_LOCK_MS = 15 * 60 * 1000;

export function loginAttemptKey(email) {
  return sha256(`login:${String(email || '').trim().toLowerCase()}`);
}

export async function loginLockStatus(db, email, now = Date.now()) {
  db = asStore(db);
  const row = await db.get('SELECT failures, last_failed_at, locked_until FROM login_attempts WHERE email_hash = ?', [loginAttemptKey(email)]);
  if (!row) return { locked: false, failures: 0, retryAfterMs: 0 };
  if (row.locked_until && row.locked_until > now) {
    return { locked: true, failures: row.failures, retryAfterMs: row.locked_until - now };
  }
  const inWindow = now - row.last_failed_at < LOCKOUT_WINDOW_MS;
  return { locked: false, failures: inWindow ? row.failures : 0, retryAfterMs: 0 };
}

export async function recordLoginFailure(db, email, now = Date.now()) {
  db = asStore(db);
  const key = loginAttemptKey(email);
  return await db.transaction(async () => {
    const row = await db.get('SELECT failures, window_start, last_failed_at, locked_until FROM login_attempts WHERE email_hash = ?', [key]);
    let failures = 1;
    let windowStart = now;
    if (row && now - row.last_failed_at < LOCKOUT_WINDOW_MS) {
      failures = row.failures + 1;
      windowStart = row.window_start;
    }
    const lockedUntil = failures >= LOCKOUT_MAX_FAILURES ? now + LOCKOUT_LOCK_MS : null;
    await db.run(`INSERT INTO login_attempts(email_hash, failures, window_start, last_failed_at, locked_until)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(email_hash) DO UPDATE SET failures = excluded.failures, window_start = excluded.window_start,
        last_failed_at = excluded.last_failed_at, locked_until = excluded.locked_until`, [key, failures, windowStart, now, lockedUntil]);
    return { failures, locked: !!lockedUntil, lockedUntil };
  });
}

export async function clearLoginFailures(db, email) {
  db = asStore(db);
  await db.run('DELETE FROM login_attempts WHERE email_hash = ?', [loginAttemptKey(email)]);
}

export async function purgeStaleLoginAttempts(db, now = Date.now()) {
  db = asStore(db);
  const horizon = now - Math.max(LOCKOUT_WINDOW_MS, LOCKOUT_LOCK_MS);
  return (await db.run('DELETE FROM login_attempts WHERE last_failed_at < ? AND (locked_until IS NULL OR locked_until < ?)', [horizon, now])).changes;
}
