#!/usr/bin/env node
// Operator CLI: remove a staff account's second factor so it can enrol again.
//
//   PRI_PLATFORM_DB=/data/pri-learning-platform.db node server/tools/reset-mfa.mjs <email>
//   PRI_DATABASE_URL=postgres://… node server/tools/reset-mfa.mjs <email>
//
// For an administrator who has lost both their authenticator and their
// recovery codes. It is deliberately NOT a route: a stolen staff session must
// never be able to swap the factor for one the thief holds. Every live session
// of the account is revoked, so the next sign-in has to enrol before it can do
// anything, and the reset is written to audit_log with a null actor.
import { closePlatformStore } from '../platform/db.js';
import { openPlatformStore } from '../platform/store.js';

function fail(message, code = 2) {
  console.error(message);
  process.exit(code);
}

const [email] = process.argv.slice(2).map(value => String(value || '').trim());
if (!email) fail('Usage: reset-mfa.mjs <email>');

const now = Date.now();
const store = await openPlatformStore();
const account = await store.get(`SELECT id, role FROM accounts WHERE ${store.emailEquals('email')} AND deleted_at IS NULL`, [email.toLowerCase()]);
if (!account) {
  await closePlatformStore(store);
  fail('No active account matches that email.', 3);
}

const result = await store.transaction(async tx => {
  const removed = (await tx.run('DELETE FROM account_mfa WHERE account_id = ?', [account.id])).changes;
  await tx.run('DELETE FROM account_mfa_recovery_codes WHERE account_id = ?', [account.id]);
  const revoked = (await tx.run('UPDATE account_sessions SET revoked_at = ? WHERE account_id = ? AND revoked_at IS NULL', [now, account.id])).changes;
  await tx.run(`INSERT INTO audit_log(actor_account_id, action, target_kind, target_id, metadata_json, created_at)
    VALUES (NULL, 'mfa.reset', 'account', ?, ?, ?)`, [account.id, JSON.stringify({ via: 'cli', revokedSessions: revoked }), now]);
  return { removed, revoked };
});
await closePlatformStore(store);
console.log(JSON.stringify({ accountId: account.id, role: account.role, mfaRemoved: result.removed === 1, revokedSessions: result.revoked, resetAt: now }));
