import { Router } from 'express';
import { id, rateLimit, requireRole, requireSession } from './security.js';

const KEY = /^[A-Za-z0-9._:/-]{3,200}$/;
const CURRICULUM = /^[A-Za-z0-9._:/ -]{2,120}$/;

function plain(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value) && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
}

function encodedObject(value, label, limit) {
  if (!plain(value)) throw Object.assign(new Error(`${label} must be an object.`), { status: 400, code: 'CONTENT_INVALID' });
  const json = JSON.stringify(value);
  if (Buffer.byteLength(json) > limit) throw Object.assign(new Error(`${label} is too large.`), { status: 413, code: 'CONTENT_TOO_LARGE' });
  return json;
}

function revisionPublic(row, includeBody = true) {
  if (!row) return null;
  return {
    id: row.id,
    contentKey: row.content_key,
    curriculumVersion: row.curriculum_version,
    status: row.status,
    revision: row.revision,
    authorAccountId: row.author_account_id,
    reviewerAccountId: row.reviewer_account_id,
    source: JSON.parse(row.source_json || '{}'),
    ...(includeBody ? { body: JSON.parse(row.body_json || '{}') } : {}),
    createdAt: row.created_at,
    publishedAt: row.published_at
  };
}

function rowFor(db, idValue) {
  return db.prepare('SELECT * FROM content_revisions WHERE id=?').get(String(idValue || ''));
}

function audit(db, actor, action, targetId, metadata = {}, now = Date.now()) {
  db.prepare(`INSERT INTO audit_log(actor_account_id,action,target_kind,target_id,metadata_json,created_at) VALUES (?,?,?,?,?,?)`)
    .run(actor, action, 'content-revision', targetId, JSON.stringify(metadata), now);
}

export function independentReviewAllowed(row, reviewerAccountId) {
  return !!row?.author_account_id && !!reviewerAccountId && row.author_account_id !== reviewerAccountId;
}

export function createContentRouter(db) {
  const router = Router();

  // Published content is readable without a cloud account so downloaded packs
  // can be refreshed before login and then remain usable offline.
  router.get('/published/:contentKey(*)', (req, res) => {
    const contentKey = String(req.params.contentKey || '');
    if (!KEY.test(contentKey)) return res.status(400).json({ error: { code: 'CONTENT_KEY_INVALID', message: 'Content key is invalid.' } });
    const row = db.prepare(`SELECT * FROM content_revisions WHERE content_key=? AND status='published'
      ORDER BY revision DESC LIMIT 1`).get(contentKey);
    if (!row) return res.status(404).json({ error: { code: 'CONTENT_NOT_FOUND', message: 'No published content exists for this key.' } });
    res.set('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
    res.json({ revision: revisionPublic(row) });
  });

  router.get('/published-index', (req, res) => {
    const curriculumVersion = String(req.query?.curriculumVersion || '').trim();
    const rows = curriculumVersion
      ? db.prepare(`SELECT c.* FROM content_revisions c JOIN (
          SELECT content_key,MAX(revision) AS revision FROM content_revisions WHERE status='published' AND curriculum_version=? GROUP BY content_key
        ) x ON x.content_key=c.content_key AND x.revision=c.revision WHERE c.status='published' ORDER BY c.content_key`).all(curriculumVersion)
      : db.prepare(`SELECT c.* FROM content_revisions c JOIN (
          SELECT content_key,MAX(revision) AS revision FROM content_revisions WHERE status='published' GROUP BY content_key
        ) x ON x.content_key=c.content_key AND x.revision=c.revision WHERE c.status='published' ORDER BY c.content_key`).all();
    res.json({ revisions: rows.map(row => revisionPublic(row, false)) });
  });

  router.use(requireSession(db));
  router.use(requireRole('support', 'admin'));

  router.post('/drafts', rateLimit(db, 'content-draft', { limit: 120, windowMs: 60 * 60 * 1000 }), (req, res) => {
    const contentKey = String(req.body?.contentKey || '').trim();
    const curriculumVersion = String(req.body?.curriculumVersion || '').trim();
    if (!KEY.test(contentKey) || !CURRICULUM.test(curriculumVersion)) return res.status(400).json({ error: { code: 'CONTENT_KEY_INVALID', message: 'Content key or curriculum version is invalid.' } });
    let sourceJson;
    let bodyJson;
    try {
      sourceJson = encodedObject(req.body?.source, 'Content source', 128 * 1024);
      bodyJson = encodedObject(req.body?.body, 'Content body', 2 * 1024 * 1024);
    } catch (err) {
      return res.status(err.status || 400).json({ error: { code: err.code || 'CONTENT_INVALID', message: err.message } });
    }
    const revisionId = id('content');
    const now = Date.now();
    let revision;
    // Serialize revision allocation with the insert. SQLite's transaction keeps
    // two simultaneous authors from both publishing "revision N+1".
    db.transaction(() => {
      const prior = db.prepare('SELECT MAX(revision) AS n FROM content_revisions WHERE content_key=?').get(contentKey)?.n || 0;
      revision = Number(prior) + 1;
      db.prepare(`INSERT INTO content_revisions(id,content_key,curriculum_version,status,author_account_id,source_json,body_json,revision,created_at)
        VALUES (?,?,?,'draft',?,?,?,?,?)`).run(revisionId, contentKey, curriculumVersion, req.platformSession.account_id, sourceJson, bodyJson, revision, now);
      audit(db, req.platformSession.account_id, 'content.draft.create', revisionId, { contentKey, revision }, now);
    })();
    res.status(201).json({ revision: revisionPublic(rowFor(db, revisionId)) });
  });

  router.patch('/drafts/:revisionId', (req, res) => {
    const row = rowFor(db, req.params.revisionId);
    if (!row || row.status !== 'draft') return res.status(409).json({ error: { code: 'CONTENT_NOT_DRAFT', message: 'Only draft content can be edited.' } });
    if (row.author_account_id !== req.platformSession.account_id && req.platformSession.role !== 'admin') return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Only the draft author or an administrator can edit this revision.' } });
    let sourceJson = row.source_json;
    let bodyJson = row.body_json;
    try {
      if (req.body?.source !== undefined) sourceJson = encodedObject(req.body.source, 'Content source', 128 * 1024);
      if (req.body?.body !== undefined) bodyJson = encodedObject(req.body.body, 'Content body', 2 * 1024 * 1024);
    } catch (err) {
      return res.status(err.status || 400).json({ error: { code: err.code || 'CONTENT_INVALID', message: err.message } });
    }
    db.prepare('UPDATE content_revisions SET source_json=?,body_json=? WHERE id=?').run(sourceJson, bodyJson, row.id);
    audit(db, req.platformSession.account_id, 'content.draft.edit', row.id);
    res.json({ revision: revisionPublic(rowFor(db, row.id)) });
  });

  router.post('/:revisionId/submit-review', (req, res) => {
    const row = rowFor(db, req.params.revisionId);
    if (!row || row.status !== 'draft') return res.status(409).json({ error: { code: 'CONTENT_TRANSITION_INVALID', message: 'Only drafts can enter review.' } });
    if (row.author_account_id !== req.platformSession.account_id && req.platformSession.role !== 'admin') return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Only the author or an administrator can submit this revision.' } });
    db.prepare("UPDATE content_revisions SET status='review' WHERE id=?").run(row.id);
    audit(db, req.platformSession.account_id, 'content.submit-review', row.id);
    res.json({ revision: revisionPublic(rowFor(db, row.id)) });
  });

  router.post('/:revisionId/approve', (req, res) => {
    const row = rowFor(db, req.params.revisionId);
    if (!row || row.status !== 'review') return res.status(409).json({ error: { code: 'CONTENT_TRANSITION_INVALID', message: 'Only content in review can be approved.' } });
    if (!independentReviewAllowed(row, req.platformSession.account_id)) {
      return res.status(409).json({ error: { code: 'INDEPENDENT_REVIEW_REQUIRED', message: 'The author cannot approve their own revision. A different authorised reviewer is required.' } });
    }
    db.prepare("UPDATE content_revisions SET status='approved',reviewer_account_id=? WHERE id=?").run(req.platformSession.account_id, row.id);
    audit(db, req.platformSession.account_id, 'content.approve', row.id);
    res.json({ revision: revisionPublic(rowFor(db, row.id)) });
  });

  router.post('/:revisionId/publish', requireRole('admin'), (req, res) => {
    const row = rowFor(db, req.params.revisionId);
    if (!row || row.status !== 'approved' || !row.reviewer_account_id || !independentReviewAllowed(row, row.reviewer_account_id)) {
      return res.status(409).json({ error: { code: 'CONTENT_NOT_APPROVED', message: 'Only independently reviewed and approved content can be published.' } });
    }
    const now = Date.now();
    db.transaction(() => {
      db.prepare("UPDATE content_revisions SET status='retired' WHERE content_key=? AND status='published'").run(row.content_key);
      db.prepare("UPDATE content_revisions SET status='published',published_at=? WHERE id=?").run(now, row.id);
      audit(db, req.platformSession.account_id, 'content.publish', row.id, { contentKey: row.content_key, revision: row.revision }, now);
    })();
    res.json({ revision: revisionPublic(rowFor(db, row.id)) });
  });

  router.post('/:revisionId/rollback', requireRole('admin'), (req, res) => {
    const source = rowFor(db, req.params.revisionId);
    if (!source || !['published', 'retired'].includes(source.status)) return res.status(409).json({ error: { code: 'ROLLBACK_SOURCE_INVALID', message: 'Rollback source must be a previously published revision.' } });
    const now = Date.now();
    const revisionId = id('content');
    let revision;
    db.transaction(() => {
      revision = Number(db.prepare('SELECT MAX(revision) AS n FROM content_revisions WHERE content_key=?').get(source.content_key)?.n || 0) + 1;
      db.prepare("UPDATE content_revisions SET status='retired' WHERE content_key=? AND status='published'").run(source.content_key);
      // A rollback restores bytes that already passed independent review. It is an
      // explicit admin recovery action, not a new self-reviewed content approval;
      // audit metadata points back to the reviewed source revision.
      db.prepare(`INSERT INTO content_revisions(id,content_key,curriculum_version,status,author_account_id,reviewer_account_id,source_json,body_json,revision,created_at,published_at)
        VALUES (?,?,?,'published',?,?,?,?,?,?,?)`)
        .run(revisionId, source.content_key, source.curriculum_version, source.author_account_id, source.reviewer_account_id, source.source_json, source.body_json, revision, now, now);
      audit(db, req.platformSession.account_id, 'content.rollback', revisionId, { fromRevisionId: source.id, fromRevision: source.revision, revision }, now);
    })();
    res.json({ revision: revisionPublic(rowFor(db, revisionId)), rolledBackFrom: source.id });
  });

  router.get('/admin/revisions', (req, res) => {
    const status = ['draft', 'review', 'approved', 'published', 'retired'].includes(req.query?.status) ? req.query.status : null;
    const rows = status
      ? db.prepare('SELECT * FROM content_revisions WHERE status=? ORDER BY created_at DESC LIMIT 250').all(status)
      : db.prepare('SELECT * FROM content_revisions ORDER BY created_at DESC LIMIT 250').all();
    res.json({ revisions: rows.map(row => revisionPublic(row, false)) });
  });

  return router;
}
