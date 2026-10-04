// First-admin bootstrap for a fresh deployment.
//
// PRI_BOOTSTRAP_ADMIN_EMAIL names one mailbox. The first account that proves
// control of that mailbox (email verification, or an identity provider that
// vouches for the address) becomes 'admin' while the deployment has no other
// admin. The promotion is written to audit_log. Once any admin exists the
// setting is inert, so it cannot be used to mint a second administrator later.

import { asStore } from './store.js';

function configuredEmail() {
  const value = String(process.env.PRI_BOOTSTRAP_ADMIN_EMAIL || '').trim().toLowerCase();
  return value || null;
}

export function bootstrapAdminConfigured() {
  return !!configuredEmail();
}

export async function maybeBootstrapAdmin(db, accountId, now = Date.now()) {
  db = asStore(db);
  const email = configuredEmail();
  if (!email || !accountId) return false;
  const account = await db.get('SELECT id, email, role, email_verified_at FROM accounts WHERE id = ? AND deleted_at IS NULL', [accountId]);
  if (!account || account.role === 'admin' || !account.email_verified_at) return false;
  if (String(account.email).toLowerCase() !== email) return false;
  return await db.transaction(async () => {
    const existing = await db.get("SELECT 1 FROM accounts WHERE role = 'admin' AND deleted_at IS NULL LIMIT 1");
    if (existing) return false;
    const info = await db.run("UPDATE accounts SET role = 'admin', updated_at = ? WHERE id = ? AND role != 'admin' AND deleted_at IS NULL", [now, accountId]);
    if (!info.changes) return false;
    await db.run(`INSERT INTO audit_log(actor_account_id, action, target_kind, target_id, metadata_json, created_at)
      VALUES (NULL, 'account.bootstrap-admin', 'account', ?, ?, ?)`, [accountId, JSON.stringify({ role: 'admin', source: 'PRI_BOOTSTRAP_ADMIN_EMAIL' }), now]);
    return true;
  });
}
