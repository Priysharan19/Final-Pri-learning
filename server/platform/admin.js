import { asyncRouter } from './asyncRouter.js';
import { asStore, sqliteHandle } from './store.js';
import { currentSyncCursor } from './db.js';
import { MFA_STEP_UP_MS, rateLimit, requireMfa, requireRole, requireSession } from './security.js';
import { INVITE_MAX_TTL_DAYS, inviteTtlDays, listTeacherInvites, mintTeacherInvite } from './teacherInvites.js';
import { operatorHealthDetail } from './operatorHealth.js';
import { aiUsageSummary } from './aiUsage.js';

function ensureAdminTables(db) {
  // SQLite builds its schema at boot; Postgres is migrated (supabase/migrations).
  const raw = sqliteHandle(db);
  if (!raw) return;
  raw.exec(`
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

async function audit(db, actor, action, targetKind, targetId, metadata = {}, now = Date.now()) {
  await db.run(`INSERT INTO audit_log(actor_account_id,action,target_kind,target_id,metadata_json,created_at) VALUES (?,?,?,?,?,?)`, [actor, action, targetKind, targetId, JSON.stringify(metadata), now]);
}

export function createAdminRouter(db) {
  db = asStore(db);
  ensureAdminTables(db);
  const router = asyncRouter();
  router.use(requireSession(db));
  router.use(requireRole('admin'));
  // Every admin route needs a second factor verified on this session (mfa.js);
  // role changes additionally need one presented in the last 15 minutes.
  router.use(requireMfa());
  router.use(rateLimit(db, 'admin', { limit: 300, windowMs: 60 * 1000 }));

  router.get('/health', async (req, res) => {
    const one = async sql => Number((await db.get(sql))?.n || 0);
    const cursor = await currentSyncCursor(db);
    res.json({
      ok: true,
      schemaVersion: (await db.get("SELECT value FROM platform_meta WHERE key='schema_version'"))?.value || null,
      accounts: await one('SELECT COUNT(*) AS n FROM accounts WHERE deleted_at IS NULL'),
      activeSessions: Number((await db.get('SELECT COUNT(*) AS n FROM account_sessions WHERE revoked_at IS NULL AND expires_at>?', [Date.now()]))?.n || 0),
      classes: await one('SELECT COUNT(*) AS n FROM classes WHERE archived_at IS NULL'),
      openReports: await one("SELECT COUNT(*) AS n FROM issue_reports WHERE status='open'"),
      publishedContent: await one("SELECT COUNT(*) AS n FROM content_revisions WHERE status='published'"),
      pendingDelivery: await one('SELECT COUNT(*) AS n FROM auth_delivery_outbox WHERE delivered_at IS NULL'),
      syncCursor: cursor,
      // Provider configuration flags, backlog counts and the last housekeeping
      // pass: operator detail that /v1/health no longer answers anonymously.
      ...await operatorHealthDetail(db),
      checkedAt: Date.now()
    });
  });

  // Cost telemetry (aiUsage.js, ledger 1.9): this month's and today's model
  // calls and tokens, by kind and by the heaviest accounts, with the rupee
  // estimate against PRI_MONTHLY_BUDGET_INR. Admin + second factor, like
  // every admin route; the student-facing surfaces never see it.
  router.get('/ai-usage', async (req, res) => {
    res.json({ aiUsage: await aiUsageSummary(db) });
  });

  router.get('/users', async (req, res) => {
    const q = String(req.query?.q || '').trim().toLowerCase().slice(0, 120);
    const rows = q
      ? await db.all(`SELECT a.id,a.email,a.name,a.role,a.email_verified_at,a.created_at,a.updated_at,e.plan,e.status,e.provider,e.current_period_end
          FROM accounts a LEFT JOIN entitlement_snapshots e ON e.account_id=a.id
          WHERE a.deleted_at IS NULL AND (LOWER(a.email) LIKE ?${db.likeEscape()} OR LOWER(a.name) LIKE ?${db.likeEscape()} OR a.id=?)
          ORDER BY a.created_at DESC LIMIT 100`, [`%${q}%`, `%${q}%`, q])
      : await db.all(`SELECT a.id,a.email,a.name,a.role,a.email_verified_at,a.created_at,a.updated_at,e.plan,e.status,e.provider,e.current_period_end
          FROM accounts a LEFT JOIN entitlement_snapshots e ON e.account_id=a.id WHERE a.deleted_at IS NULL
          ORDER BY a.created_at DESC LIMIT 100`);
    res.json({ users: rows.map(row => ({
      id: row.id, email: row.email, name: row.name, role: row.role, emailVerified: !!row.email_verified_at,
      createdAt: row.created_at, updatedAt: row.updated_at,
      entitlement: { plan: row.plan || 'free', status: row.status || 'free', provider: row.provider || 'none', currentPeriodEnd: row.current_period_end || null }
    })) });
  });

  router.patch('/users/:accountId/role', requireMfa({ stepUpMs: MFA_STEP_UP_MS }), async (req, res) => {
    const accountId = String(req.params.accountId || '');
    const role = String(req.body?.role || '');
    if (!['student', 'teacher', 'support', 'admin'].includes(role)) return res.status(400).json({ error: { code: 'ROLE_INVALID', message: 'Role is invalid.' } });
    if (accountId === req.platformSession.account_id && role !== 'admin') return res.status(409).json({ error: { code: 'SELF_DEMOTION_BLOCKED', message: 'Administrators cannot remove their own admin role.' } });
    const now = Date.now();
    const info = await db.run('UPDATE accounts SET role=?,updated_at=? WHERE id=? AND deleted_at IS NULL', [role, now, accountId]);
    if (!info.changes) return res.status(404).json({ error: { code: 'ACCOUNT_NOT_FOUND', message: 'Account not found.' } });
    await audit(db, req.platformSession.account_id, 'account.role', 'account', accountId, { role }, now);
    res.json({ accountId, role, updatedAt: now });
  });

  // Teacher onboarding: an admin mints a single-use, expiring invite code and
  // hands it to the teacher out of band; registration with the code creates the
  // account with role 'teacher'. Only the hash and a display prefix are kept.
  router.post('/teacher-invites', async (req, res) => {
    const ttlDays = inviteTtlDays(req.body?.ttlDays);
    if (ttlDays === null) return res.status(400).json({ error: { code: 'INVITE_TTL_INVALID', message: `ttlDays must be a whole number from 1 to ${INVITE_MAX_TTL_DAYS}.` } });
    const now = Date.now();
    const invite = await mintTeacherInvite(db, { createdBy: req.platformSession.account_id, ttlDays, now });
    await audit(db, req.platformSession.account_id, 'teacher-invite.mint', 'teacher-invite', invite.id, { ttlDays, codePrefix: invite.code.slice(0, 8) }, now);
    res.status(201).json({ code: invite.code, expiresAt: invite.expiresAt });
  });

  router.get('/teacher-invites', async (req, res) => {
    res.json({ invites: await listTeacherInvites(db) });
  });

  router.get('/feature-flags', async (req, res) => {
    const rows = await db.all(`SELECT key,enabled,audience,config_json,updated_by,updated_at FROM feature_flags ORDER BY ${db.binaryText('key')}`);
    res.json({ flags: rows.map(row => ({ key: row.key, enabled: !!row.enabled, audience: row.audience, config: JSON.parse(row.config_json || '{}'), updatedBy: row.updated_by, updatedAt: row.updated_at })) });
  });

  router.put('/feature-flags/:key', async (req, res) => {
    const key = String(req.params.key || '');
    if (!/^[a-z0-9._-]{2,80}$/.test(key)) return res.status(400).json({ error: { code: 'FLAG_KEY_INVALID', message: 'Feature flag key is invalid.' } });
    const audience = ['all', 'staff', 'teachers', 'students', 'premium'].includes(req.body?.audience) ? req.body.audience : 'all';
    const enabled = req.body?.enabled === true;
    const config = req.body?.config && typeof req.body.config === 'object' && !Array.isArray(req.body.config) ? req.body.config : {};
    const configJson = JSON.stringify(config);
    if (Buffer.byteLength(configJson) > 32 * 1024) return res.status(413).json({ error: { code: 'FLAG_CONFIG_TOO_LARGE', message: 'Feature flag configuration is too large.' } });
    const now = Date.now();
    await db.run(`INSERT INTO feature_flags(key,enabled,audience,config_json,updated_by,updated_at) VALUES (?,?,?,?,?,?)
      ON CONFLICT(key) DO UPDATE SET enabled=excluded.enabled,audience=excluded.audience,config_json=excluded.config_json,updated_by=excluded.updated_by,updated_at=excluded.updated_at`, [key, enabled ? 1 : 0, audience, configJson, req.platformSession.account_id, now]);
    await audit(db, req.platformSession.account_id, 'feature-flag.update', 'feature-flag', key, { enabled, audience }, now);
    res.json({ key, enabled, audience, config, updatedAt: now });
  });

  router.get('/audit', async (req, res) => {
    const rows = await db.all(`SELECT id,actor_account_id,action,target_kind,target_id,metadata_json,created_at
      FROM audit_log ORDER BY id DESC LIMIT 250`);
    res.json({ entries: rows.map(row => ({ id: row.id, actorAccountId: row.actor_account_id, action: row.action, targetKind: row.target_kind, targetId: row.target_id, metadata: JSON.parse(row.metadata_json || '{}'), createdAt: row.created_at })) });
  });

  return router;
}
