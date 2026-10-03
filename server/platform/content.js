import { asyncRouter } from './asyncRouter.js';
import { asStore } from './store.js';
import { id, rateLimit, requireMfa, requireRole, requireSession } from './security.js';

const KEY = /^[A-Za-z0-9._:/-]{3,200}$/;
const CURRICULUM = /^[A-Za-z0-9._:/ -]{2,120}$/;
const INDEX_PAGE = 100;
const INDEX_MAX_PAGE = 500;

function plain(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value) && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
}

function encodedObject(value, label, limit) {
  if (!plain(value)) throw Object.assign(new Error(`${label} must be an object.`), { status: 400, code: 'CONTENT_INVALID' });
  const json = JSON.stringify(value);
  if (Buffer.byteLength(json) > limit) throw Object.assign(new Error(`${label} is too large.`), { status: 413, code: 'CONTENT_TOO_LARGE' });
  return json;
}

function revisionPublic(row, { includeBody = true, includeSource = true } = {}) {
  if (!row) return null;
  return {
    id: row.id,
    contentKey: row.content_key,
    curriculumVersion: row.curriculum_version,
    status: row.status,
    revision: row.revision,
    authorAccountId: row.author_account_id,
    reviewerAccountId: row.reviewer_account_id,
    ...(includeSource ? { source: JSON.parse(row.source_json || '{}') } : {}),
    ...(includeBody ? { body: JSON.parse(row.body_json || '{}') } : {}),
    createdAt: row.created_at,
    publishedAt: row.published_at
  };
}

async function rowFor(db, idValue) {
  return await db.get('SELECT * FROM content_revisions WHERE id=?', [String(idValue || '')]);
}

async function audit(db, actor, action, targetId, metadata = {}, now = Date.now()) {
  await db.run(`INSERT INTO audit_log(actor_account_id,action,target_kind,target_id,metadata_json,created_at) VALUES (?,?,?,?,?,?)`, [actor, action, 'content-revision', targetId, JSON.stringify(metadata), now]);
}

export function independentReviewAllowed(row, reviewerAccountId) {
  return !!row?.author_account_id && !!reviewerAccountId && row.author_account_id !== reviewerAccountId;
}

export function createContentRouter(db) {
  db = asStore(db);
  const router = asyncRouter();
  // A content state change reads the revision, checks the transition and
  // writes it as one transaction, as it was when every handler was synchronous:
  // a concurrent edit, approval or publish cannot land between check and write.
  const atomically = fn => db.transaction(fn);

  // Published content is readable without a cloud account so downloaded packs
  // can be refreshed before login and then remain usable offline.
  router.get('/published/:contentKey(*)', async (req, res) => {
    const contentKey = String(req.params.contentKey || '');
    if (!KEY.test(contentKey)) return res.status(400).json({ error: { code: 'CONTENT_KEY_INVALID', message: 'Content key is invalid.' } });
    const row = await db.get(`SELECT * FROM content_revisions WHERE content_key=? AND status='published'
      ORDER BY revision DESC LIMIT 1`, [contentKey]);
    if (!row) return res.status(404).json({ error: { code: 'CONTENT_NOT_FOUND', message: 'No published content exists for this key.' } });
    res.set('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
    res.json({ revision: revisionPublic(row) });
  });

  // The catalogue of what is published, for a device deciding what to download.
  // It is anonymous like the route above, which makes it the cheapest thing on
  // the server to point a script at, so it is bounded three ways: one page at a
  // time, keys only, and a limit per caller.
  //
  // `source` is the reviewed input a revision was built from — the largest field
  // on the row and of no use to a client choosing what to fetch. Serialising it
  // for every published key turned a listing into a multi-megabyte anonymous
  // download; the index now drops it exactly as it already drops `body`, and a
  // client that wants either asks for the one key it needs.
  router.get('/published-index', rateLimit(db, 'content-index', { limit: 60, windowMs: 60 * 1000 }), async (req, res) => {
    const curriculumVersion = String(req.query?.curriculumVersion || '').trim();
    const requested = Math.floor(Number(req.query?.limit));
    const limit = Number.isFinite(requested) && requested > 0 ? Math.min(INDEX_MAX_PAGE, requested) : INDEX_PAGE;
    // Keyset pagination on the ordering column: a page is "the keys after this
    // one", which stays correct while content is published underneath it.
    const after = String(req.query?.after || '');
    const latest = curriculumVersion
      ? { filter: "WHERE status='published' AND curriculum_version=?", params: [curriculumVersion] }
      : { filter: "WHERE status='published'", params: [] };
    const rows = await db.all(`SELECT c.* FROM content_revisions c JOIN (
        SELECT content_key,MAX(revision) AS revision FROM content_revisions ${latest.filter} GROUP BY content_key
      ) x ON x.content_key=c.content_key AND x.revision=c.revision
      WHERE c.status='published' AND ${db.binaryText('c.content_key')}>? ORDER BY ${db.binaryText('c.content_key')} LIMIT ?`, [...latest.params, after, limit + 1]);
    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    res.json({
      revisions: page.map(row => revisionPublic(row, { includeBody: false, includeSource: false })),
      hasMore,
      nextCursor: hasMore ? page[page.length - 1].content_key : null
    });
  });

  router.use(requireSession(db));
  router.use(requireRole('support', 'admin'));
  // Content reaches every student: every authoring and release action needs the
  // staff member's second factor verified on this session (mfa.js).
  router.use(requireMfa());

  router.post('/drafts', rateLimit(db, 'content-draft', { limit: 120, windowMs: 60 * 60 * 1000 }), async (req, res) => {
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
    await db.transaction(async () => {
      const prior = (await db.get('SELECT MAX(revision) AS n FROM content_revisions WHERE content_key=?', [contentKey]))?.n || 0;
      revision = Number(prior) + 1;
      await db.run(`INSERT INTO content_revisions(id,content_key,curriculum_version,status,author_account_id,source_json,body_json,revision,created_at)
        VALUES (?,?,?,'draft',?,?,?,?,?)`, [revisionId, contentKey, curriculumVersion, req.platformSession.account_id, sourceJson, bodyJson, revision, now]);
      await audit(db, req.platformSession.account_id, 'content.draft.create', revisionId, { contentKey, revision }, now);
    });
    res.status(201).json({ revision: revisionPublic(await rowFor(db, revisionId)) });
  });

  router.patch('/drafts/:revisionId', async (req, res) => {
    // The answer is computed inside the transaction and sent after COMMIT:
    // never before the write is durable, and never twice if Postgres re-runs
    // the transaction after a serialization failure.
    const [status, body] = await atomically(async () => {
      const row = await rowFor(db, req.params.revisionId);
      if (!row || row.status !== 'draft') return [409, { error: { code: 'CONTENT_NOT_DRAFT', message: 'Only draft content can be edited.' } }];
      if (row.author_account_id !== req.platformSession.account_id && req.platformSession.role !== 'admin') return [403, { error: { code: 'FORBIDDEN', message: 'Only the draft author or an administrator can edit this revision.' } }];
      let sourceJson = row.source_json;
      let bodyJson = row.body_json;
      try {
        if (req.body?.source !== undefined) sourceJson = encodedObject(req.body.source, 'Content source', 128 * 1024);
        if (req.body?.body !== undefined) bodyJson = encodedObject(req.body.body, 'Content body', 2 * 1024 * 1024);
      } catch (err) {
        return [err.status || 400, { error: { code: err.code || 'CONTENT_INVALID', message: err.message } }];
      }
      await db.run('UPDATE content_revisions SET source_json=?,body_json=? WHERE id=?', [sourceJson, bodyJson, row.id]);
      await audit(db, req.platformSession.account_id, 'content.draft.edit', row.id);
      return [200, { revision: revisionPublic(await rowFor(db, row.id)) }];
    });
    res.status(status).json(body);
  });

  router.post('/:revisionId/submit-review', async (req, res) => {
    // The answer is computed inside the transaction and sent after COMMIT:
    // never before the write is durable, and never twice if Postgres re-runs
    // the transaction after a serialization failure.
    const [status, body] = await atomically(async () => {
      const row = await rowFor(db, req.params.revisionId);
      if (!row || row.status !== 'draft') return [409, { error: { code: 'CONTENT_TRANSITION_INVALID', message: 'Only drafts can enter review.' } }];
      if (row.author_account_id !== req.platformSession.account_id && req.platformSession.role !== 'admin') return [403, { error: { code: 'FORBIDDEN', message: 'Only the author or an administrator can submit this revision.' } }];
      await db.run("UPDATE content_revisions SET status='review' WHERE id=?", [row.id]);
      await audit(db, req.platformSession.account_id, 'content.submit-review', row.id);
      return [200, { revision: revisionPublic(await rowFor(db, row.id)) }];
    });
    res.status(status).json(body);
  });

  router.post('/:revisionId/approve', async (req, res) => {
    // The answer is computed inside the transaction and sent after COMMIT:
    // never before the write is durable, and never twice if Postgres re-runs
    // the transaction after a serialization failure.
    const [status, body] = await atomically(async () => {
      const row = await rowFor(db, req.params.revisionId);
      if (!row || row.status !== 'review') return [409, { error: { code: 'CONTENT_TRANSITION_INVALID', message: 'Only content in review can be approved.' } }];
      if (!independentReviewAllowed(row, req.platformSession.account_id)) {
        return [409, { error: { code: 'INDEPENDENT_REVIEW_REQUIRED', message: 'The author cannot approve their own revision. A different authorised reviewer is required.' } }];
      }
      await db.run("UPDATE content_revisions SET status='approved',reviewer_account_id=? WHERE id=?", [req.platformSession.account_id, row.id]);
      await audit(db, req.platformSession.account_id, 'content.approve', row.id);
      return [200, { revision: revisionPublic(await rowFor(db, row.id)) }];
    });
    res.status(status).json(body);
  });

  router.post('/:revisionId/publish', requireRole('admin'), async (req, res) => {
    // The answer is computed inside the transaction and sent after COMMIT:
    // never before the write is durable, and never twice if Postgres re-runs
    // the transaction after a serialization failure.
    const [status, body] = await atomically(async () => {
      const row = await rowFor(db, req.params.revisionId);
      if (!row || row.status !== 'approved' || !row.reviewer_account_id || !independentReviewAllowed(row, row.reviewer_account_id)) {
        return [409, { error: { code: 'CONTENT_NOT_APPROVED', message: 'Only independently reviewed and approved content can be published.' } }];
      }
      const now = Date.now();
      await (async () => {
        await db.run("UPDATE content_revisions SET status='retired' WHERE content_key=? AND status='published'", [row.content_key]);
        await db.run("UPDATE content_revisions SET status='published',published_at=? WHERE id=?", [now, row.id]);
        await audit(db, req.platformSession.account_id, 'content.publish', row.id, { contentKey: row.content_key, revision: row.revision }, now);
      })();
      return [200, { revision: revisionPublic(await rowFor(db, row.id)) }];
    });
    res.status(status).json(body);
  });

  router.post('/:revisionId/rollback', requireRole('admin'), async (req, res) => {
    // The answer is computed inside the transaction and sent after COMMIT:
    // never before the write is durable, and never twice if Postgres re-runs
    // the transaction after a serialization failure.
    const [status, body] = await atomically(async () => {
      const source = await rowFor(db, req.params.revisionId);
      if (!source || !['published', 'retired'].includes(source.status)) return [409, { error: { code: 'ROLLBACK_SOURCE_INVALID', message: 'Rollback source must be a previously published revision.' } }];
      const now = Date.now();
      const revisionId = id('content');
      let revision;
      await (async () => {
        revision = Number((await db.get('SELECT MAX(revision) AS n FROM content_revisions WHERE content_key=?', [source.content_key]))?.n || 0) + 1;
        await db.run("UPDATE content_revisions SET status='retired' WHERE content_key=? AND status='published'", [source.content_key]);
        // A rollback restores bytes that already passed independent review. It is an
        // explicit admin recovery action, not a new self-reviewed content approval;
        // audit metadata points back to the reviewed source revision.
        await db.run(`INSERT INTO content_revisions(id,content_key,curriculum_version,status,author_account_id,reviewer_account_id,source_json,body_json,revision,created_at,published_at)
          VALUES (?,?,?,'published',?,?,?,?,?,?,?)`, [revisionId, source.content_key, source.curriculum_version, source.author_account_id, source.reviewer_account_id, source.source_json, source.body_json, revision, now, now]);
        await audit(db, req.platformSession.account_id, 'content.rollback', revisionId, { fromRevisionId: source.id, fromRevision: source.revision, revision }, now);
      })();
      return [200, { revision: revisionPublic(await rowFor(db, revisionId)), rolledBackFrom: source.id }];
    });
    res.status(status).json(body);
  });

  router.get('/admin/revisions', async (req, res) => {
    const status = ['draft', 'review', 'approved', 'published', 'retired'].includes(req.query?.status) ? req.query.status : null;
    const rows = status
      ? await db.all('SELECT * FROM content_revisions WHERE status=? ORDER BY created_at DESC LIMIT 250', [status])
      : await db.all('SELECT * FROM content_revisions ORDER BY created_at DESC LIMIT 250');
    res.json({ revisions: rows.map(row => revisionPublic(row, { includeBody: false })) });
  });

  return router;
}
