// First-admin bootstrap for a fresh deployment.
//
// PRI_BOOTSTRAP_ADMIN_EMAIL names one mailbox. The first account that proves
// control of that mailbox (email verification, or an identity provider that
// vouches for the address) becomes 'admin' while the deployment has no other
// admin. The promotion is written to audit_log. Once any admin exists the
// setting is inert, so it cannot be used to mint a second administrator later.

function configuredEmail() {
  const value = String(process.env.PRI_BOOTSTRAP_ADMIN_EMAIL || '').trim().toLowerCase();
  return value || null;
}

export function bootstrapAdminConfigured() {
  return !!configuredEmail();
}

export function maybeBootstrapAdmin(db, accountId, now = Date.now()) {
  const email = configuredEmail();
  if (!email || !accountId) return false;
  const account = db.prepare('SELECT id, email, role, email_verified_at FROM accounts WHERE id = ? AND deleted_at IS NULL').get(accountId);
  if (!account || account.role === 'admin' || !account.email_verified_at) return false;
  if (String(account.email).toLowerCase() !== email) return false;
  return db.transaction(() => {
    const existing = db.prepare("SELECT 1 FROM accounts WHERE role = 'admin' AND deleted_at IS NULL LIMIT 1").get();
    if (existing) return false;
    const info = db.prepare("UPDATE accounts SET role = 'admin', updated_at = ? WHERE id = ? AND role != 'admin' AND deleted_at IS NULL").run(now, accountId);
    if (!info.changes) return false;
    db.prepare(`INSERT INTO audit_log(actor_account_id, action, target_kind, target_id, metadata_json, created_at)
      VALUES (NULL, 'account.bootstrap-admin', 'account', ?, ?, ?)`)
      .run(accountId, JSON.stringify({ role: 'admin', source: 'PRI_BOOTSTRAP_ADMIN_EMAIL' }), now);
    return true;
  })();
}
