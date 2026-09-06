#!/usr/bin/env node
// Operator CLI: change an account's role on the configured platform database.
//
//   PRI_PLATFORM_DB=/data/pri-learning-platform.db node server/tools/promote-role.mjs <email> <role>
//
// Roles: student | teacher | support | admin. The change is written to
// audit_log with a null actor and metadata {via: 'cli'}. Use this to create the
// first administrator when PRI_BOOTSTRAP_ADMIN_EMAIL was not set at launch, or
// to recover an admin account.
import { platformDb } from '../platform/db.js';

const ROLES = new Set(['student', 'teacher', 'support', 'admin']);

function fail(message, code = 2) {
  console.error(message);
  process.exit(code);
}

const [email, role] = process.argv.slice(2).map(value => String(value || '').trim());
if (!email || !role) fail('Usage: promote-role.mjs <email> <student|teacher|support|admin>');
if (!ROLES.has(role)) fail(`Role must be one of ${[...ROLES].join(', ')}.`);

const now = Date.now();
const account = platformDb.prepare('SELECT id, role FROM accounts WHERE email = ? AND deleted_at IS NULL').get(email.toLowerCase());
if (!account) {
  platformDb.close();
  fail('No active account matches that email.', 3);
}

platformDb.transaction(() => {
  platformDb.prepare('UPDATE accounts SET role = ?, updated_at = ? WHERE id = ?').run(role, now, account.id);
  platformDb.prepare(`INSERT INTO audit_log(actor_account_id, action, target_kind, target_id, metadata_json, created_at)
    VALUES (NULL, 'account.role', 'account', ?, ?, ?)`)
    .run(account.id, JSON.stringify({ role, previousRole: account.role, via: 'cli' }), now);
})();
platformDb.close();
console.log(JSON.stringify({ accountId: account.id, previousRole: account.role, role, updatedAt: now }));
