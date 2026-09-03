import { Router } from 'express';
import { id, rateLimit, requireRole, requireSession } from './security.js';

const CATEGORIES = new Set([
  'wrong-answer', 'bad-solution', 'ambiguous-wording', 'incorrect-diagram',
  'curriculum-mismatch', 'impossible-question', 'recognition-problem', 'other'
]);
const FORBIDDEN_CONTEXT_KEYS = new Set([
  'ink', 'strokes', 'rawInk', 'rawHandwriting', 'handwritingImage', 'image',
  'photo', 'screenshot', 'password', 'token', 'authorization', 'cookie'
]);

function cleanContext(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out = {};
  for (const [key, value] of Object.entries(raw)) {
    if (FORBIDDEN_CONTEXT_KEYS.has(key)) continue;
    if (Object.keys(out).length >= 30) break;
    if (!/^[A-Za-z0-9_.-]{1,60}$/.test(key)) continue;
    if (typeof value === 'string') out[key] = value.slice(0, 1000);
    else if (typeof value === 'number' && Number.isFinite(value)) out[key] = value;
    else if (typeof value === 'boolean' || value === null) out[key] = value;
  }
  return out;
}

export function createReportRouter(db) {
  const router = Router();
  router.use(requireSession(db));

  router.post('/', rateLimit(db, 'issue-report', { limit: 30, windowMs: 60 * 60 * 1000 }), (req, res) => {
    const category = String(req.body?.category || '');
    if (!CATEGORIES.has(category)) return res.status(400).json({ error: { code: 'REPORT_CATEGORY_INVALID', message: 'Choose a valid report category.' } });
    const note = String(req.body?.note || '').trim().slice(0, 4000) || null;
    const contentId = String(req.body?.contentId || '').slice(0, 160) || null;
    const questionId = String(req.body?.questionId || '').slice(0, 160) || null;
    const appVersion = String(req.body?.appVersion || '').slice(0, 80) || null;
    const curriculumVersion = String(req.body?.curriculumVersion || '').slice(0, 120) || null;
    const context = cleanContext(req.body?.context);
    const encoded = JSON.stringify(context);
    if (Buffer.byteLength(encoded) > 32 * 1024) return res.status(413).json({ error: { code: 'REPORT_CONTEXT_TOO_LARGE', message: 'Report context is too large.' } });
    const reportId = id('rpt');
    const now = Date.now();
    db.prepare(`INSERT INTO issue_reports
      (id,account_id,category,content_id,question_id,app_version,curriculum_version,context_json,note,status,created_at)
      VALUES (?,?,?,?,?,?,?,?,?,'open',?)`)
      .run(reportId, req.platformSession.account_id, category, contentId, questionId, appVersion, curriculumVersion, encoded, note, now);
    res.status(201).json({ report: { id: reportId, status: 'open', createdAt: now } });
  });

  router.get('/mine', (req, res) => {
    const rows = db.prepare(`SELECT id,category,content_id,question_id,status,created_at,resolved_at
      FROM issue_reports WHERE account_id=? ORDER BY created_at DESC LIMIT 100`).all(req.platformSession.account_id);
    res.json({ reports: rows.map(row => ({ id: row.id, category: row.category, contentId: row.content_id, questionId: row.question_id, status: row.status, createdAt: row.created_at, resolvedAt: row.resolved_at })) });
  });

  router.get('/admin', requireRole('support', 'admin'), (req, res) => {
    const status = ['open', 'triaged', 'resolved', 'dismissed'].includes(req.query?.status) ? req.query.status : 'open';
    const rows = db.prepare(`SELECT r.*,a.email,a.name FROM issue_reports r LEFT JOIN accounts a ON a.id=r.account_id
      WHERE r.status=? ORDER BY r.created_at ASC LIMIT 250`).all(status);
    res.json({ reports: rows.map(row => ({
      id: row.id, category: row.category, contentId: row.content_id, questionId: row.question_id,
      appVersion: row.app_version, curriculumVersion: row.curriculum_version,
      context: JSON.parse(row.context_json || '{}'), note: row.note, status: row.status,
      createdAt: row.created_at, resolvedAt: row.resolved_at,
      reporter: row.account_id ? { id: row.account_id, name: row.name, email: row.email } : null
    })) });
  });

  router.patch('/admin/:reportId', requireRole('support', 'admin'), (req, res) => {
    const reportId = String(req.params.reportId || '');
    const status = String(req.body?.status || '');
    if (!['triaged', 'resolved', 'dismissed'].includes(status)) return res.status(400).json({ error: { code: 'REPORT_STATUS_INVALID', message: 'Report status is invalid.' } });
    const now = Date.now();
    const info = db.prepare(`UPDATE issue_reports SET status=?,resolved_at=CASE WHEN ? IN ('resolved','dismissed') THEN ? ELSE NULL END WHERE id=?`)
      .run(status, status, now, reportId);
    if (!info.changes) return res.status(404).json({ error: { code: 'REPORT_NOT_FOUND', message: 'Report not found.' } });
    db.prepare(`INSERT INTO audit_log(actor_account_id,action,target_kind,target_id,metadata_json,created_at) VALUES (?,?,?,?,?,?)`)
      .run(req.platformSession.account_id, 'report.status', 'report', reportId, JSON.stringify({ status }), now);
    res.json({ id: reportId, status, updatedAt: now });
  });

  return router;
}
