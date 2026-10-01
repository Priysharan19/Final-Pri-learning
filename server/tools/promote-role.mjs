#!/usr/bin/env node
// Operator CLI: change an account's role on the configured platform database.
//
//   PRI_PLATFORM_DB=/data/pri-learning-platform.db node server/tools/promote-role.mjs <email> <role>
//   PRI_DATABASE_URL=postgres://… node server/tools/promote-role.mjs <email> <role>
//
// Roles: student | teacher | support | admin. The change is written to
// audit_log with a null actor and metadata {via: 'cli'}. Use this to create the
// first administrator when PRI_BOOTSTRAP_ADMIN_EMAIL was not set at launch, or
// to recover an admin account.
import { closePlatformStore } from '../platform/db.js';
import { openPlatformStore } from '../platform/store.js';

const ROLES = new Set(['student', 'teacher', 'support', 'admin']);

function fail(message, code = 2) {
  console.error(message);
  process.exit(code);
}

const [email, role] = process.argv.slice(2).map(value => String(value || '').trim());
if (!email || !role) fail('Usage: promote-role.mjs <email> <student|teacher|support|admin>');
if (!ROLES.has(role)) fail(`Role must be one of ${[...ROLES].join(', ')}.`);

const now = Date.now();
const store = await openPlatformStore();
const account = await store.get(`SELECT id, role FROM accounts WHERE ${store.emailEquals('email')} AND deleted_at IS NULL`, [email.toLowerCase()]);
if (!account) {
  await closePlatformStore(store);
  fail('No active account matches that email.', 3);
}

await store.transaction(async tx => {
  await tx.run('UPDATE accounts SET role = ?, updated_at = ? WHERE id = ?', [role, now, account.id]);
  await tx.run(`INSERT INTO audit_log(actor_account_id, action, target_kind, target_id, metadata_json, created_at)
    VALUES (NULL, 'account.role', 'account', ?, ?, ?)`, [account.id, JSON.stringify({ role, previousRole: account.role, via: 'cli' }), now]);
});
await closePlatformStore(store);
console.log(JSON.stringify({ accountId: account.id, previousRole: account.role, role, updatedAt: now }));
