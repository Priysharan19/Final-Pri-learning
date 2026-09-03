import { Router } from 'express';
import { rateLimit, requireRole, requireSession } from './security.js';

function ensureAdminTables(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS feature_flags (
      key TEXT PRIMARY KEY,
      enabled INTEGER NOT NULL DEFAULT 0,
      audience TEXT NOT NULL DEFAULT 'all',
      config_json TEXT NOT NULL DEFAULT '{}',
      updated_by TEXT REFERENCES accounts(id) ON DELETE SET NULL,
      updated_at INTEGER NOT NULL
    );
  `);
}

function audit(db, actor, action, targetKind, targetId, metadata = {}, now = Date.now()) {
  db.prepare(`INSERT INTO audit_log(actor_account_id,action,target_kind,target_id,metadata_json,created_at) VALUES (?,?,?,?,?,?)`)
    .run(actor, action, targetKind, targetId, JSON.stringify(metadata), now);
}

export function createAdminRouter(db) {
  ensureAdminTables(db);
  const router = Router();
  router.use(requireSession(db));
  router.use(requireRole('admin'));
  router.use(rateLimit(db, 'admin', { limit: 300, windowMs: 60 * 1000 }));

  router.get('/health', (req, res) => {
    const one = sql => Number(db.prepare(sql).get()?.n || 0);
    const cursor = Number(db.prepare('SELECT value FROM sync_cursors WHERE id=1').get()?.value || 0);
    res.json({
      ok: true,
      schemaVersion: db.prepare("SELECT value FROM platform_meta WHERE key='schema_version'").get()?.value || null,
      accounts: one('SELECT COUNT(*) AS n FROM accounts WHERE deleted_at IS NULL'),
      activeSessions: Number(db.prepare('SELECT COUNT(*) AS n FROM account_sessions WHERE revoked_at IS NULL AND expires_at>?').get(Date.now())?.n || 0),
      classes: one('SELECT COUNT(*) AS n FROM classes WHERE archived_at IS NULL'),
      openReports: one("SELECT COUNT(*) AS n FROM issue_reports WHERE status='open'"),
      publishedContent: one("SELECT COUNT(*) AS n FROM content_revisions WHERE status='published'"),
      pendingDelivery: one('SELECT COUNT(*) AS n FROM auth_delivery_outbox WHERE delivered_at IS NULL'),
      syncCursor: cursor,
      checkedAt: Date.now()
    });
  });

  router.get('/users', (req, res) => {
    const q = String(req.query?.q || '').trim().toLowerCase().slice(0, 120);
    const rows = q
      ? db.prepare(`SELECT a.id,a.email,a.name,a.role,a.email_verified_at,a.created_at,a.updated_at,e.plan,e.status,e.provider,e.current_period_end
          FROM accounts a LEFT JOIN entitlement_snapshots e ON e.account_id=a.id
          WHERE a.deleted_at IS NULL AND (LOWER(a.email) LIKE ? OR LOWER(a.name) LIKE ? OR a.id=?)
          ORDER BY a.created_at DESC LIMIT 100`).all(`%${q}%`, `%${q}%`, q)
      : db.prepare(`SELECT a.id,a.email,a.name,a.role,a.email_verified_at,a.created_at,a.updated_at,e.plan,e.status,e.provider,e.current_period_end
          FROM accounts a LEFT JOIN entitlement_snapshots e ON e.account_id=a.id WHERE a.deleted_at IS NULL
          ORDER BY a.created_at DESC LIMIT 100`).all();
    res.json({ users: rows.map(row => ({
      id: row.id, email: row.email, name: row.name, role: row.role, emailVerified: !!row.email_verified_at,
      createdAt: row.created_at, updatedAt: row.updated_at,
      entitlement: { plan: row.plan || 'free', status: row.status || 'free', provider: row.provider || 'none', currentPeriodEnd: row.current_period_end || null }
    })) });
  });

  router.patch('/users/:accountId/role', (req, res) => {
    const accountId = String(req.params.accountId || '');
    const role = String(req.body?.role || '');
    if (!['student', 'teacher', 'support', 'admin'].includes(role)) return res.status(400).json({ error: { code: 'ROLE_INVALID', message: 'Role is invalid.' } });
    if (accountId === req.platformSession.account_id && role !== 'admin') return res.status(409).json({ error: { code: 'SELF_DEMOTION_BLOCKED', message: 'Administrators cannot remove their own admin role.' } });
    const now = Date.now();
    const info = db.prepare('UPDATE accounts SET role=?,updated_at=? WHERE id=? AND deleted_at IS NULL').run(role, now, accountId);
    if (!info.changes) return res.status(404).json({ error: { code: 'ACCOUNT_NOT_FOUND', message: 'Account not found.' } });
    audit(db, req.platformSession.account_id, 'account.role', 'account', accountId, { role }, now);
    res.json({ accountId, role, updatedAt: now });
  });

  router.get('/feature-flags', (req, res) => {
    const rows = db.prepare('SELECT key,enabled,audience,config_json,updated_by,updated_at FROM feature_flags ORDER BY key').all();
    res.json({ flags: rows.map(row => ({ key: row.key, enabled: !!row.enabled, audience: row.audience, config: JSON.parse(row.config_json || '{}'), updatedBy: row.updated_by, updatedAt: row.updated_at })) });
  });

  router.put('/feature-flags/:key', (req, res) => {
    const key = String(req.params.key || '');
    if (!/^[a-z0-9._-]{2,80}$/.test(key)) return res.status(400).json({ error: { code: 'FLAG_KEY_INVALID', message: 'Feature flag key is invalid.' } });
    const audience = ['all', 'staff', 'teachers', 'students', 'premium'].includes(req.body?.audience) ? req.body.audience : 'all';
    const enabled = req.body?.enabled === true;
    const config = req.body?.config && typeof req.body.config === 'object' && !Array.isArray(req.body.config) ? req.body.config : {};
    const configJson = JSON.stringify(config);
    if (Buffer.byteLength(configJson) > 32 * 1024) return res.status(413).json({ error: { code: 'FLAG_CONFIG_TOO_LARGE', message: 'Feature flag configuration is too large.' } });
    const now = Date.now();
    db.prepare(`INSERT INTO feature_flags(key,enabled,audience,config_json,updated_by,updated_at) VALUES (?,?,?,?,?,?)
      ON CONFLICT(key) DO UPDATE SET enabled=excluded.enabled,audience=excluded.audience,config_json=excluded.config_json,updated_by=excluded.updated_by,updated_at=excluded.updated_at`)
      .run(key, enabled ? 1 : 0, audience, configJson, req.platformSession.account_id, now);
    audit(db, req.platformSession.account_id, 'feature-flag.update', 'feature-flag', key, { enabled, audience }, now);
    res.json({ key, enabled, audience, config, updatedAt: now });
  });

  router.get('/audit', (req, res) => {
    const rows = db.prepare(`SELECT id,actor_account_id,action,target_kind,target_id,metadata_json,created_at
      FROM audit_log ORDER BY id DESC LIMIT 250`).all();
    res.json({ entries: rows.map(row => ({ id: row.id, actorAccountId: row.actor_account_id, action: row.action, targetKind: row.target_kind, targetId: row.target_id, metadata: JSON.parse(row.metadata_json || '{}'), createdAt: row.created_at })) });
  });

  return router;
}
