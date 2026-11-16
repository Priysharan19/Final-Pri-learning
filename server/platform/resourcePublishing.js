// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · publishing library resources (ADR-0002, plan mission F3)
//
//   /v1/resources/admin/…   staff only; mounted only when PRI_RESOURCE_PUBLISHING=on
//
// Replaces "generate a package and commit it". A resource's life is a list of
// immutable REVISIONS (resource_revisions); the library the students read
// (resources, resource_editions — resources.js) is written only by publishing a
// revision, and only withdrawing one takes it out.
//
//   draft → in_review → approved → published → withdrawn      (and → superseded
//   when a later revision is published). A withdrawn resource comes back only as
//   a NEW revision (revise); a rollback publishes an earlier reviewed body as a
//   new revision. Nothing is edited in place after it leaves draft.
//
// Who may do what — every route needs a staff session (support or admin) and an
// MFA-verified session; publishing, withdrawing and rolling back need the admin
// role and a FRESH second factor (step-up). The author of a revision can never
// approve it (the database refuses a reviewer equal to the author too).
//
// RIGHTS. A revision cannot leave draft without source, attribution, a rights
// note, a rights basis and a disclaimer. A hosted file needs a basis of
// own-work, licensed or public-domain; one whose source names NESA needs a
// permission reference on record. The software records that permission; it
// cannot obtain it. A reviewer's approval is a person's act — the software only
// proves two different people were involved.
//
// FILES. A hosted PDF is uploaded in parts of at most 512 KiB, each inside the
// platform's 1 MiB JSON transport limit (no route carries a bigger body), and
// assembled on the server: PDF only (`%PDF-` at byte 0, `%%EOF` in the last
// KiB, no obvious script, launch action or embedded file — a heuristic filter, not
// a sanitiser: the real containment is that files are only ever downloaded), at most 25 MiB, sha256 computed
// here. It is stored under a server-made key in the deployment's own region
// (objectStorage.js) and handed to students only as a short-lived signed URL
// that forces a download. No caller-supplied name ever reaches storage.
// ─────────────────────────────────────────────────────────────────────────────
import { createHash } from 'node:crypto';
import { asyncRouter } from './asyncRouter.js';
import { asStore } from './store.js';
import { id as newId, rateLimit, requireMfa, requireRole, requireSession } from './security.js';
import { serverEdition } from './edition.js';
import { EDITION_IDS } from '../../client/edition.config.mjs';
import { RIGHTS_BASES, REVISION_STATES, resourceProblems, resourceRowValues } from './resourceCatalog.js';
import { assetKey, partKey } from './objectStorage.js';

export const PART_BYTES = 512 * 1024;
export const MAX_PARTS = 50;
export const MAX_ASSET_BYTES = PART_BYTES * MAX_PARTS; // 25 MiB
const RESOURCE_ID = /^[a-z0-9][a-z0-9-]{2,119}$/;
const STEP_UP_MS = 5 * 60 * 1000;
const BODY_KEYS = Object.freeze(['title', 'subtitle', 'description', 'type', 'subject', 'year', 'grade', 'marks', 'durationMinutes', 'readingMinutes',
  'questionCount', 'sections', 'tags', 'editions', 'course', 'syllabusVersion', 'certificationState', 'availability', 'url', 'source', 'attribution',
  'rightsNote', 'disclaimer', 'rightsBasis', 'permissionReference', 'assetSha256']);
const MAX_BODY_BYTES = 64 * 1024;
const OPEN = ['draft', 'in_review', 'approved'];

const fail = (status, code, message) => Object.assign(new Error(message), { status, code });
const plain = v => !!v && typeof v === 'object' && !Array.isArray(v) && (Object.getPrototypeOf(v) === Object.prototype || Object.getPrototypeOf(v) === null);
const sha256hex = bytes => createHash('sha256').update(bytes).digest('hex');

/** The recorded body a request may carry: known keys only, bounded. Drafts may be incomplete. */
export function cleanBody(body) {
  if (!plain(body)) throw fail(400, 'RESOURCE_BODY_INVALID', 'The resource must be an object.');
  const unknown = Object.keys(body).filter(k => !BODY_KEYS.includes(k));
  if (unknown.length) throw fail(400, 'RESOURCE_BODY_INVALID', `Unknown fields: ${unknown.join(', ')}.`);
  if (Buffer.byteLength(JSON.stringify(body)) > MAX_BODY_BYTES) throw fail(413, 'RESOURCE_BODY_TOO_LARGE', 'The resource record is too large.');
  return body;
}

/**
 * Every way a revision's body cannot be published, as strings. `asset` is the
 * revision's file record (or null). Includes the F1 contract and F3's rights rules.
 */
export function publishingProblems(resourceId, body, asset, { edition } = {}) {
  const now = Date.now();
  const p = [];
  if (!RIGHTS_BASES.includes(body.rightsBasis)) p.push(`rightsBasis must be one of ${RIGHTS_BASES.join(', ')}`);
  if (body.availability === 'hosted' && body.rightsBasis === 'external-link-only') p.push('a hosted file cannot have the rights basis external-link-only');
  if (body.availability === 'hosted' && edition && Array.isArray(body.editions) && body.editions.some(e => e !== edition)) {
    p.push(`a hosted file lives in the ${edition} edition's own region and may be offered to that edition only`);
  }
  p.push(...resourceProblems({ ...body, id: resourceId, url: body.availability === 'hosted' ? null : body.url, reviewState: 'published', createdAt: now, updatedAt: now, publishedAt: now }, { asset }));
  return [...new Set(p)];
}

const revisionPublic = (row, { body = true } = {}) => row && ({
  resourceId: row.resource_id, revision: Number(row.revision), state: row.state,
  authorAccountId: row.author_account_id, reviewerAccountId: row.reviewer_account_id ?? null, reason: row.reason ?? null,
  createdAt: Number(row.created_at), submittedAt: row.submitted_at == null ? null : Number(row.submitted_at),
  reviewedAt: row.reviewed_at == null ? null : Number(row.reviewed_at), publishedAt: row.published_at == null ? null : Number(row.published_at),
  withdrawnAt: row.withdrawn_at == null ? null : Number(row.withdrawn_at),
  ...(body ? { body: JSON.parse(row.body_json) } : { title: JSON.parse(row.body_json).title ?? null })
});
const assetPublic = row => row && ({ sha256: row.sha256, byteLength: Number(row.byte_length), region: row.region, createdAt: Number(row.created_at) });

/** Is `bytes` a PDF this library will host? Returns a list of problems. */
export function pdfProblems(bytes) {
  const p = [];
  if (!Buffer.isBuffer(bytes) || bytes.length < 16) return ['the file is empty or far too small to be a PDF'];
  if (bytes.length > MAX_ASSET_BYTES) p.push('the file is larger than 25 MB');
  if (bytes.subarray(0, 5).toString('latin1') !== '%PDF-') p.push('the file does not start with %PDF- (nothing may come before it)');
  if (!bytes.subarray(Math.max(0, bytes.length - 1024)).toString('latin1').includes('%%EOF')) p.push('the file has no %%EOF trailer');
  const text = bytes.toString('latin1');
  if (/\/(JavaScript|JS|Launch|EmbeddedFile|OpenAction|SubmitForm|URI)\b|\/J#|\/Launc#/.test(text)) p.push('the file carries script, an automatic action, a launch action or an embedded file');
  return p;
}

export function createResourcePublishingRouter(db, { edition = serverEdition(process.env), storage = null, now = Date.now } = {}) {
  db = asStore(db);
  if (!EDITION_IDS.includes(edition)) throw new Error(`resource publishing: unknown edition ${JSON.stringify(edition)}`);
  const router = asyncRouter();
  const atomically = fn => db.transaction(fn);
  const writes = rateLimit(db, 'resource-publish', { limit: 240, windowMs: 60 * 60 * 1000 });
  const parts = rateLimit(db, 'resource-upload-part', { limit: 1200, windowMs: 60 * 60 * 1000 });

  router.use(requireSession(db));
  router.use(requireRole('support', 'admin'));
  router.use(requireMfa());

  const stepUp = [requireRole('admin'), requireMfa({ stepUpMs: STEP_UP_MS })];
  const audit = (actor, action, target, metadata = {}) => db.run(
    'INSERT INTO audit_log(actor_account_id,action,target_kind,target_id,metadata_json,created_at) VALUES (?,?,?,?,?,?)',
    [actor, action, 'resource-revision', target, JSON.stringify(metadata), now()]);
  const rid = req => (RESOURCE_ID.test(String(req.params.rid || '')) ? String(req.params.rid) : null);
  const rev = req => (/^[0-9]{1,6}$/.test(String(req.params.n || '')) ? Number(req.params.n) : null);
  const bad = (res, status, code, message) => res.status(status).json({ error: { code, message } });
  const rowOf = (resourceId, n) => db.get('SELECT * FROM resource_revisions WHERE resource_id=? AND revision=?', [resourceId, n]);
  const assetOf = (resourceId, n) => db.get('SELECT * FROM resource_assets WHERE resource_id=? AND revision=?', [resourceId, n]);
  // Whoever last changes a draft's content (edit, file) becomes its author, so an
  // administrator who edits someone else's draft cannot then also approve it:
  // the two-person rule holds over the bytes that are published, not the first draft.
  const takeOver = async (row, req) => {
    if (row.author_account_id !== req.platformSession.account_id) {
      await db.run("UPDATE resource_revisions SET author_account_id=? WHERE resource_id=? AND revision=? AND state='draft'", [req.platformSession.account_id, row.resource_id, row.revision]);
      await audit(req.platformSession.account_id, 'resource.author.change', `${row.resource_id}@${row.revision}`, { from: row.author_account_id });
    }
  };
  const canEdit = (row, req) => row.author_account_id === req.platformSession.account_id || req.platformSession.role === 'admin';
  // Answers are decided inside the transaction and sent after COMMIT.
  const run = (fn) => async (req, res) => {
    const resourceId = rid(req);
    if (!resourceId) return bad(res, 404, 'RESOURCE_NOT_FOUND', 'No such resource.');
    const n = req.params.n === undefined ? undefined : rev(req);
    if (n === null) return bad(res, 404, 'REVISION_NOT_FOUND', 'No such revision.');
    const [status, body] = await atomically(() => fn(req, resourceId, n));
    res.status(status).json(body);
  };
  const err = (status, code, message) => [status, { error: { code, message } }];

  router.get('/', async (req, res) => {
    const state = REVISION_STATES.includes(req.query?.state) ? req.query.state : null;
    const rows = await db.all(`SELECT * FROM resource_revisions ${state ? 'WHERE state=?' : ''} ORDER BY created_at DESC, resource_id LIMIT 250`, state ? [state] : []);
    res.set('Cache-Control', 'private, no-store');
    res.json({ revisions: rows.map(r => revisionPublic(r, { body: false })), storage: storage ? { kind: storage.kind, region: storage.region } : null, edition });
  });

  router.get('/:rid/revisions', run(async (req, resourceId) => {
    const rows = await db.all('SELECT * FROM resource_revisions WHERE resource_id=? ORDER BY revision DESC', [resourceId]);
    return [200, { revisions: rows.map(r => revisionPublic(r, { body: false })) }];
  }));

  router.get('/:rid/revisions/:n', run(async (req, resourceId, n) => {
    const row = await rowOf(resourceId, n);
    if (!row) return err(404, 'REVISION_NOT_FOUND', 'No such revision.');
    return [200, { revision: revisionPublic(row), asset: assetPublic(await assetOf(resourceId, n)) }];
  }));

  // A new resource, or the next revision of one with no open revision. The first
  // revision of a new id needs the id to be new in the library too.
  router.post('/:rid/drafts', writes, run(async (req, resourceId) => {
    let body;
    try { body = cleanBody(req.body?.body ?? {}); } catch (e) { return err(e.status, e.code, e.message); }
    if (await db.get("SELECT 1 FROM resource_revisions WHERE resource_id=? AND state IN ('draft','in_review','approved')", [resourceId])) {
      return err(409, 'REVISION_OPEN', 'This resource already has a revision being prepared. Finish or reject it first.');
    }
    const next = Number((await db.get('SELECT MAX(revision) AS n FROM resource_revisions WHERE resource_id=?', [resourceId]))?.n || 0) + 1;
    if (next === 1 && await db.get('SELECT 1 FROM resources WHERE id=?', [resourceId])) {
      return err(409, 'RESOURCE_EXISTS', 'This id is already in the library. Revise an existing revision, or choose a new id.');
    }
    await db.run("INSERT INTO resource_revisions(id,resource_id,revision,state,body_json,author_account_id,created_at) VALUES (?,?,?,'draft',?,?,?)",
      [newId('rrev'), resourceId, next, JSON.stringify(body), req.platformSession.account_id, now()]);
    await audit(req.platformSession.account_id, 'resource.draft.create', `${resourceId}@${next}`, { revision: next });
    return [201, { revision: revisionPublic(await rowOf(resourceId, next)) }];
  }));

  // A new draft from an earlier revision's body (the way back from withdrawn, and the way to change a published resource).
  router.post('/:rid/revisions/:n/revise', writes, run(async (req, resourceId, n) => {
    const source = await rowOf(resourceId, n);
    if (!source) return err(404, 'REVISION_NOT_FOUND', 'No such revision.');
    if (OPEN.includes(source.state)) return err(409, 'REVISION_OPEN', 'This revision is still being prepared; edit it instead.');
    if (await db.get("SELECT 1 FROM resource_revisions WHERE resource_id=? AND state IN ('draft','in_review','approved')", [resourceId])) {
      return err(409, 'REVISION_OPEN', 'This resource already has a revision being prepared.');
    }
    const next = Number((await db.get('SELECT MAX(revision) AS n FROM resource_revisions WHERE resource_id=?', [resourceId]))?.n || 0) + 1;
    // The new draft starts without the old file's hash: a hosted body must have its own upload (or the same one copied in).
    const body = { ...JSON.parse(source.body_json) };
    delete body.assetSha256;
    if (body.availability === 'hosted') body.availability = 'external';
    await db.run("INSERT INTO resource_revisions(id,resource_id,revision,state,body_json,author_account_id,reason,created_at) VALUES (?,?,?,'draft',?,?,?,?)",
      [newId('rrev'), resourceId, next, JSON.stringify(body), req.platformSession.account_id, `revised from ${n}`, now()]);
    await audit(req.platformSession.account_id, 'resource.revise', `${resourceId}@${next}`, { from: n });
    return [201, { revision: revisionPublic(await rowOf(resourceId, next)) }];
  }));

  router.patch('/:rid/revisions/:n', writes, run(async (req, resourceId, n) => {
    const row = await rowOf(resourceId, n);
    if (!row || row.state !== 'draft') return err(409, 'REVISION_NOT_DRAFT', 'Only a draft can be edited.');
    if (!canEdit(row, req)) return err(403, 'FORBIDDEN', 'Only the author or an administrator can edit this draft.');
    let body;
    try { body = cleanBody(req.body?.body); } catch (e) { return err(e.status, e.code, e.message); }
    await takeOver(row, req);
    await db.run("UPDATE resource_revisions SET body_json=? WHERE resource_id=? AND revision=? AND state='draft'", [JSON.stringify(body), resourceId, n]);
    await audit(req.platformSession.account_id, 'resource.draft.edit', `${resourceId}@${n}`);
    return [200, { revision: revisionPublic(await rowOf(resourceId, n)) }];
  }));

  router.post('/:rid/revisions/:n/submit', writes, run(async (req, resourceId, n) => {
    const row = await rowOf(resourceId, n);
    if (!row || row.state !== 'draft') return err(409, 'REVISION_TRANSITION_INVALID', 'Only a draft can be submitted for review.');
    if (!canEdit(row, req)) return err(403, 'FORBIDDEN', 'Only the author or an administrator can submit this draft.');
    const problems = publishingProblems(resourceId, JSON.parse(row.body_json), assetPublic(await assetOf(resourceId, n)), { edition });
    if (problems.length) return [400, { error: { code: 'RESOURCE_INCOMPLETE', message: 'The resource cannot leave draft yet.', problems } }];
    await takeOver(row, req);
    await db.run("UPDATE resource_revisions SET state='in_review', submitted_at=? WHERE resource_id=? AND revision=? AND state='draft'", [now(), resourceId, n]);
    await audit(req.platformSession.account_id, 'resource.submit', `${resourceId}@${n}`);
    return [200, { revision: revisionPublic(await rowOf(resourceId, n)) }];
  }));

  // Back to draft, by the reviewer who found something to fix (or the author withdrawing the request).
  router.post('/:rid/revisions/:n/reject', writes, run(async (req, resourceId, n) => {
    const row = await rowOf(resourceId, n);
    if (!row || !['in_review', 'approved'].includes(row.state)) return err(409, 'REVISION_TRANSITION_INVALID', 'Only a revision in review or approved can be sent back.');
    const reason = String(req.body?.reason || '').trim().slice(0, 500);
    if (!reason) return err(400, 'REASON_REQUIRED', 'Say why it is being sent back.');
    await db.run("UPDATE resource_revisions SET state='draft', reviewer_account_id=NULL, reviewed_at=NULL, submitted_at=NULL, reason=? WHERE resource_id=? AND revision=? AND state IN ('in_review','approved')", [reason, resourceId, n]);
    await audit(req.platformSession.account_id, 'resource.reject', `${resourceId}@${n}`, { reason });
    return [200, { revision: revisionPublic(await rowOf(resourceId, n)) }];
  }));

  router.post('/:rid/revisions/:n/approve', writes, run(async (req, resourceId, n) => {
    const row = await rowOf(resourceId, n);
    if (!row || row.state !== 'in_review') return err(409, 'REVISION_TRANSITION_INVALID', 'Only a revision in review can be approved.');
    if (row.author_account_id === req.platformSession.account_id) {
      return err(409, 'INDEPENDENT_REVIEW_REQUIRED', 'The author cannot approve their own revision. A different reviewer is required.');
    }
    await db.run("UPDATE resource_revisions SET state='approved', reviewer_account_id=?, reviewed_at=? WHERE resource_id=? AND revision=? AND state='in_review'", [req.platformSession.account_id, now(), resourceId, n]);
    await audit(req.platformSession.account_id, 'resource.approve', `${resourceId}@${n}`);
    return [200, { revision: revisionPublic(await rowOf(resourceId, n)) }];
  }));

  /** Write the library rows for a revision (inside the caller's transaction). */
  async function release(resourceId, row, at) {
    const body = JSON.parse(row.body_json);
    const existing = await db.get('SELECT created_at FROM resources WHERE id=?', [resourceId]);
    const record = { ...body, id: resourceId, url: body.availability === 'hosted' ? null : body.url, reviewState: 'published', createdAt: Number(existing?.created_at || at), updatedAt: at, publishedAt: at };
    const v = resourceRowValues(record);
    await db.run(`INSERT INTO resources(id,title,subtitle,description,type,subject,year,grade,marks,duration_minutes,reading_minutes,question_count,sections_json,tags_json,course,
      syllabus_version,certification_state,availability,url,source,attribution,rights_note,disclaimer,review_state,created_at,updated_at,published_at)
      VALUES (${v.map(() => '?').join(',')})
      ON CONFLICT(id) DO UPDATE SET title=excluded.title,subtitle=excluded.subtitle,description=excluded.description,type=excluded.type,subject=excluded.subject,year=excluded.year,
        grade=excluded.grade,marks=excluded.marks,duration_minutes=excluded.duration_minutes,reading_minutes=excluded.reading_minutes,question_count=excluded.question_count,
        sections_json=excluded.sections_json,tags_json=excluded.tags_json,course=excluded.course,syllabus_version=excluded.syllabus_version,certification_state=excluded.certification_state,
        availability=excluded.availability,url=excluded.url,source=excluded.source,attribution=excluded.attribution,rights_note=excluded.rights_note,disclaimer=excluded.disclaimer,
        review_state='published',updated_at=excluded.updated_at,published_at=excluded.published_at`, v);
    await db.run('DELETE FROM resource_editions WHERE resource_id=?', [resourceId]);
    for (const e of body.editions) await db.run('INSERT INTO resource_editions(resource_id, edition) VALUES (?,?)', [resourceId, e]);
  }

  router.post('/:rid/revisions/:n/publish', ...stepUp, writes, run(async (req, resourceId, n) => {
    const row = await rowOf(resourceId, n);
    if (!row || row.state !== 'approved' || !row.reviewer_account_id || row.reviewer_account_id === row.author_account_id) {
      return err(409, 'REVISION_NOT_APPROVED', 'Only a revision approved by someone other than its author can be published.');
    }
    const problems = publishingProblems(resourceId, JSON.parse(row.body_json), assetPublic(await assetOf(resourceId, n)), { edition });
    if (problems.length) return [400, { error: { code: 'RESOURCE_INCOMPLETE', message: 'The resource cannot be published as it stands.', problems } }];
    const at = now();
    await db.run("UPDATE resource_revisions SET state='superseded' WHERE resource_id=? AND state='published'", [resourceId]);
    await db.run("UPDATE resource_revisions SET state='published', published_at=? WHERE resource_id=? AND revision=? AND state='approved'", [at, resourceId, n]);
    await release(resourceId, row, at);
    await audit(req.platformSession.account_id, 'resource.publish', `${resourceId}@${n}`, { revision: n });
    return [200, { revision: revisionPublic(await rowOf(resourceId, n)) }];
  }));

  // The library stops serving it at once; the history keeps it.
  router.post('/:rid/withdraw', ...stepUp, writes, run(async (req, resourceId) => {
    const reason = String(req.body?.reason || '').trim().slice(0, 500);
    if (!reason) return err(400, 'REASON_REQUIRED', 'Say why it is being withdrawn.');
    const row = await db.get("SELECT * FROM resource_revisions WHERE resource_id=? AND state='published'", [resourceId]);
    if (!row) return err(409, 'REVISION_TRANSITION_INVALID', 'Only a published resource can be withdrawn.');
    const at = now();
    await db.run("UPDATE resource_revisions SET state='withdrawn', withdrawn_at=?, reason=? WHERE resource_id=? AND revision=?", [at, reason, resourceId, row.revision]);
    await db.run("UPDATE resources SET review_state='withdrawn', updated_at=? WHERE id=?", [at, resourceId]);
    await audit(req.platformSession.account_id, 'resource.withdraw', `${resourceId}@${row.revision}`, { reason });
    return [200, { revision: revisionPublic(await rowOf(resourceId, Number(row.revision))) }];
  }));

  // Publish an earlier, already-reviewed body again, as a NEW revision. No new approval: the bytes passed independent review; the admin's step-up is the act.
  router.post('/:rid/revisions/:n/rollback', ...stepUp, writes, run(async (req, resourceId, n) => {
    const source = await rowOf(resourceId, n);
    if (!source || !['published', 'superseded', 'withdrawn'].includes(source.state) || !source.reviewer_account_id) {
      return err(409, 'ROLLBACK_SOURCE_INVALID', 'The source must be a revision that was published after independent review.');
    }
    if (await db.get("SELECT 1 FROM resource_revisions WHERE resource_id=? AND state IN ('draft','in_review','approved')", [resourceId])) {
      return err(409, 'REVISION_OPEN', 'Finish or reject the revision being prepared first.');
    }
    // A withdrawn revision was taken down for a reason that may still stand: it returns only as a new, reviewed revision.
    if (source.state === 'withdrawn') return err(409, 'ROLLBACK_SOURCE_WITHDRAWN', 'A withdrawn revision cannot be rolled back to; start a new revision from it and have it reviewed.');
    const body = JSON.parse(source.body_json);
    const sourceAsset = await assetOf(resourceId, n);
    const stale = publishingProblems(resourceId, body, assetPublic(sourceAsset), { edition });
    if (stale.length) return [400, { error: { code: 'RESOURCE_INCOMPLETE', message: 'That revision no longer meets the publishing rules.', problems: stale } }];
    if (body.availability === 'hosted' && (!sourceAsset || !storage)) return err(409, 'ROLLBACK_FILE_UNAVAILABLE', 'The hosted file for that revision is not available.');
    const next = Number((await db.get('SELECT MAX(revision) AS n FROM resource_revisions WHERE resource_id=?', [resourceId]))?.n || 0) + 1;
    const at = now();
    await db.run("UPDATE resource_revisions SET state='superseded' WHERE resource_id=? AND state='published'", [resourceId]);
    await db.run("INSERT INTO resource_revisions(id,resource_id,revision,state,body_json,author_account_id,reviewer_account_id,reason,created_at,submitted_at,reviewed_at,published_at) VALUES (?,?,?,'published',?,?,?,?,?,?,?,?)",
      [newId('rrev'), resourceId, next, source.body_json, source.author_account_id, source.reviewer_account_id, `rollback to ${n}`, at, at, at, at]);
    if (sourceAsset) {
      const bytes = await storage.get(sourceAsset.storage_key);
      if (!bytes || sha256hex(bytes) !== sourceAsset.sha256) throw fail(409, 'ROLLBACK_FILE_UNAVAILABLE', 'The hosted file for that revision is not available.');
      const key = assetKey(resourceId, next);
      await storage.put(key, bytes);
      await db.run('INSERT INTO resource_assets(id,resource_id,revision,sha256,byte_length,storage_key,region,uploaded_by,created_at) VALUES (?,?,?,?,?,?,?,?,?)',
        [newId('rast'), resourceId, next, sourceAsset.sha256, sourceAsset.byte_length, key, sourceAsset.region, req.platformSession.account_id, at]);
    }
    await release(resourceId, await rowOf(resourceId, next), at);
    await audit(req.platformSession.account_id, 'resource.rollback', `${resourceId}@${next}`, { from: n });
    return [200, { revision: revisionPublic(await rowOf(resourceId, next)), rolledBackFrom: n }];
  }));

  // ── Hosted files ──────────────────────────────────────────────────────────
  const needStorage = (res) => (storage ? false : (bad(res, 409, 'STORAGE_NOT_CONFIGURED', 'File hosting is not configured for this deployment.'), true));

  async function draftOf(req, resourceId, n) {
    const row = await rowOf(resourceId, n);
    if (!row || row.state !== 'draft') return [null, err(409, 'REVISION_NOT_DRAFT', 'Files can be changed on a draft only.')];
    if (!canEdit(row, req)) return [null, err(403, 'FORBIDDEN', 'Only the author or an administrator can change this draft.')];
    return [row, null];
  }

  router.post('/:rid/revisions/:n/asset/start', writes, async (req, res) => {
    if (needStorage(res)) return;
    const resourceId = rid(req); const n = rev(req);
    if (!resourceId || n === null) return bad(res, 404, 'REVISION_NOT_FOUND', 'No such revision.');
    const [row, e] = await draftOf(req, resourceId, n);
    if (e) return res.status(e[0]).json(e[1]);
    for (let i = 0; i < MAX_PARTS; i++) await storage.delete(partKey(resourceId, n, i));
    res.json({ partBytes: PART_BYTES, maxParts: MAX_PARTS, maxBytes: MAX_ASSET_BYTES });
  });

  router.post('/:rid/revisions/:n/asset/parts/:i', parts, async (req, res) => {
    if (needStorage(res)) return;
    const resourceId = rid(req); const n = rev(req);
    const i = /^[0-9]{1,2}$/.test(String(req.params.i)) ? Number(req.params.i) : -1;
    if (!resourceId || n === null || i < 0 || i >= MAX_PARTS) return bad(res, 400, 'UPLOAD_PART_INVALID', 'That part number is not valid.');
    const [row, e] = await draftOf(req, resourceId, n);
    if (e) return res.status(e[0]).json(e[1]);
    const data = req.body?.data;
    if (typeof data !== 'string' || !/^[A-Za-z0-9+/]*={0,2}$/.test(data) || data.length > Math.ceil(PART_BYTES / 3) * 4) return bad(res, 400, 'UPLOAD_PART_INVALID', 'The part is not valid base64 or is too large.');
    const bytes = Buffer.from(data, 'base64');
    if (!bytes.length || bytes.length > PART_BYTES) return bad(res, 400, 'UPLOAD_PART_INVALID', 'The part is empty or larger than 512 KiB.');
    await storage.put(partKey(resourceId, n, i), bytes);
    res.json({ stored: i, bytes: bytes.length });
  });

  router.post('/:rid/revisions/:n/asset/complete', writes, async (req, res) => {
    if (needStorage(res)) return;
    const resourceId = rid(req); const n = rev(req);
    if (!resourceId || n === null) return bad(res, 404, 'REVISION_NOT_FOUND', 'No such revision.');
    const [row, e] = await draftOf(req, resourceId, n);
    if (e) return res.status(e[0]).json(e[1]);
    const count = req.body?.parts;
    if (!Number.isInteger(count) || count < 1 || count > MAX_PARTS) return bad(res, 400, 'UPLOAD_INVALID', 'Say how many parts were sent.');
    const chunks = [];
    for (let i = 0; i < count; i++) {
      const chunk = await storage.get(partKey(resourceId, n, i));
      // Every part but the last is a full part, so the declared length cannot lie about the middle.
      if (!chunk || (i < count - 1 && chunk.length !== PART_BYTES)) return bad(res, 409, 'UPLOAD_INCOMPLETE', 'A part is missing or the wrong size. Upload the file again.');
      chunks.push(chunk);
    }
    const bytes = Buffer.concat(chunks);
    const digest = sha256hex(bytes);
    const problems = pdfProblems(bytes);
    if (req.body?.byteLength !== bytes.length) problems.push(`the declared length ${req.body?.byteLength} is not the file's ${bytes.length} bytes`);
    if (String(req.body?.sha256 || '').toLowerCase() !== digest) problems.push('the declared sha256 is not the file\'s');
    if (problems.length) {
      for (let i = 0; i < count; i++) await storage.delete(partKey(resourceId, n, i));
      return res.status(400).json({ error: { code: 'UPLOAD_REFUSED', message: 'That file cannot be hosted.', problems } });
    }
    const key = assetKey(resourceId, n);
    const stillDraft = await atomically(async () => {
      const again = await rowOf(resourceId, n);
      if (!again || again.state !== 'draft') return false;
      await takeOver(again, req);
      await db.run('DELETE FROM resource_assets WHERE resource_id=? AND revision=?', [resourceId, n]);
      await storage.put(key, bytes);
      await db.run('INSERT INTO resource_assets(id,resource_id,revision,sha256,byte_length,storage_key,region,uploaded_by,created_at) VALUES (?,?,?,?,?,?,?,?,?)',
        [newId('rast'), resourceId, n, digest, bytes.length, key, storage.region, req.platformSession.account_id, now()]);
      await audit(req.platformSession.account_id, 'resource.asset.upload', `${resourceId}@${n}`, { sha256: digest, bytes: bytes.length });
      return true;
    });
    for (let i = 0; i < count; i++) await storage.delete(partKey(resourceId, n, i));
    if (!stillDraft) { await storage.delete(key); return bad(res, 409, 'REVISION_NOT_DRAFT', 'Files can be changed on a draft only.'); }
    res.status(201).json({ asset: assetPublic(await assetOf(resourceId, n)) });
  });

  router.delete('/:rid/revisions/:n/asset', writes, async (req, res) => {
    if (needStorage(res)) return;
    const resourceId = rid(req); const n = rev(req);
    if (!resourceId || n === null) return bad(res, 404, 'REVISION_NOT_FOUND', 'No such revision.');
    const [row, e] = await draftOf(req, resourceId, n);
    if (e) return res.status(e[0]).json(e[1]);
    const asset = await assetOf(resourceId, n);
    if (!asset) return bad(res, 404, 'ASSET_NOT_FOUND', 'This revision has no file.');
    await storage.delete(asset.storage_key);
    await db.run('DELETE FROM resource_assets WHERE resource_id=? AND revision=?', [resourceId, n]);
    await audit(req.platformSession.account_id, 'resource.asset.delete', `${resourceId}@${n}`);
    res.json({ deleted: true });
  });

  return router;
}
