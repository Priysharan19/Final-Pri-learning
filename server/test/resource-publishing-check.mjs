// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · publishing library resources (ADR-0002 plan F3)
//
// Over real HTTP: the whole state machine through two staff accounts with MFA,
// the two-person rule, step-up for publish/withdraw/rollback, history, hosted
// PDFs (upload negatives included) through the local storage adapter, the
// region rule, the S3 signer against AWS's published example, and the schema-17
// migration with its rollback (Postgres).
//
//   node server/test/resource-publishing-check.mjs [--engine=postgres]
// ─────────────────────────────────────────────────────────────────────────────
import './support/hermetic.mjs';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { checks, enrolMfa, promoteRole, registerAccount, startApp, verifyMfa } from './support/app-harness.mjs';
import { requestedEngine } from './support/engine.mjs';
import { createLocalStorage, createObjectStorage, presignGetUrl, storageConfigProblems, assetKey } from '../platform/objectStorage.js';
import { PART_BYTES, pdfProblems, publishingProblems } from '../platform/resourcePublishing.js';
import { resourceProblems } from '../platform/resourceCatalog.js';
import { SCHEMA_VERSION } from '../platform/schemaVersions.js';

const c = checks();
const scratch = mkdtempSync(join(tmpdir(), 'pri-resource-publishing-'));
const MIGRATION_NAME = '20261114000000_resource_publishing.sql';
const MIGRATION = readFileSync(new URL(`../../supabase/migrations/${MIGRATION_NAME}`, import.meta.url), 'utf8');
const ROLLBACK = readFileSync(new URL('../../docs/release/rollback/20261114000000_resource_publishing.rollback.sql', import.meta.url), 'utf8');
const engine = requestedEngine();
const sha = b => createHash('sha256').update(b).digest('hex');

const body = (over = {}) => ({
  title: 'Practice paper', description: 'An original practice paper.', type: 'paper', subject: 'Mathematics Advanced', year: 2027, grade: 'Year 12',
  marks: 100, questionCount: 27, tags: ['practice'], editions: ['prithagoras'], course: 'nsw', certificationState: 'uploaded', availability: 'external',
  url: 'https://example.org/paper', source: 'Example Press', attribution: 'By Example Press.', rightsNote: 'Linked, not copied.',
  disclaimer: 'Independent practice; not an official examination.', rightsBasis: 'external-link-only', ...over
});
const pdf = (size = 2048, head = '%PDF-1.4\n', tail = '\n%%EOF\n') => Buffer.concat([Buffer.from(head), Buffer.alloc(Math.max(0, size - head.length - tail.length), 0x20), Buffer.from(tail)]);

const storageDir = join(scratch, 'files');
const storage = createLocalStorage({ dir: storageDir });
let app;
// A code is single-use per time step: each presentation uses the next step.
let steps = 0;
const presentCode = who => verifyMfa(app, who.jar, who.mfa.secret, { now: Date.now() + 30000 * (++steps) });
try {
  // ── 1 · Off: the write routes do not exist; hosted is refused as on main ───
  const off = await startApp({ engine, resources: { edition: 'prithagoras', publishing: false } });
  try {
    const a = await registerAccount(off, { email: 'off-admin@example.test' });
    await off.db.run('UPDATE accounts SET email_verified_at=? WHERE id=?', [Date.now(), a.account.id]);
    await promoteRole(off, a.jar, a.account.id, 'admin');
    for (const [m, p] of [['POST', '/v1/resources/admin/x-paper-1/drafts'], ['GET', '/v1/resources/admin'], ['POST', '/v1/resources/admin/x-paper-1/revisions/1/publish']]) {
      c.eq((await off.request(p, { method: m, jar: a.jar, body: m === 'POST' ? {} : undefined })).status, 404, `switch off: ${m} ${p} is 404`);
    }
    c.eq((await off.request('/v1/resources/x-paper-1/file', { jar: a.jar })).status, 404, 'switch off: no file route answers');
    c.ok(resourceProblems({ ...body(), id: 'x-paper-1', availability: 'hosted', url: null, reviewState: 'published', createdAt: 1, updatedAt: 1, publishedAt: 1 }).some(p => /reserved for plan F3/.test(p)), 'switch off: hosted is refused by the validator exactly as on main');
  } finally { await off.close(); }

  // ── 2 · On: the state machine through two staff accounts ───────────────────
  app = await startApp({ engine, resources: { edition: 'prithagoras', publishing: true, storage } });
  const staff = async (label, role) => {
    const r = await registerAccount(app, { email: `${label}@example.test`, name: label });
    await app.db.run('UPDATE accounts SET email_verified_at=? WHERE id=?', [Date.now(), r.account.id]);
    const mfa = await promoteRole(app, r.jar, r.account.id, role);
    return { ...r, mfa, id: r.account.id };
  };
  const author = await staff('author-pub', 'support');
  const reviewer = await staff('reviewer-pub', 'admin');
  const student = await registerAccount(app, { email: 'student-pub@example.test' });
  await app.db.run('UPDATE accounts SET email_verified_at=? WHERE id=?', [Date.now(), student.account.id]);
  const teacher = await registerAccount(app, { email: 'teacher-pub@example.test' });
  await app.db.run("UPDATE accounts SET email_verified_at=?, role='teacher' WHERE id=?", [Date.now(), teacher.account.id]);

  const A = '/v1/resources/admin';
  const call = (who, method, path, payload) => app.request(`${A}${path}`, { method, jar: who.jar, body: payload });
  const R = 'practice-paper-2027';
  const library = who => app.request('/v1/resources', { jar: who.jar });
  const ids = r => (r.data.resources || []).map(x => x.id);

  c.eq((await call(student, 'GET', '')).status, 403, 'a student gets 403 on the staff list');
  c.eq((await call(teacher, 'POST', `/${R}/drafts`, { body: body() })).status, 403, 'a teacher gets 403 on creating a draft');
  c.eq((await app.request(`${A}`, {})).status, 401, 'no session gets 401');
  // MFA: a staff account that has not presented its second factor this session.
  const fresh = await registerAccount(app, { email: 'nomfa-pub@example.test' });
  await app.db.run("UPDATE accounts SET email_verified_at=?, role='support' WHERE id=?", [Date.now(), fresh.account.id]);
  c.eq((await call(fresh, 'GET', '')).data?.error?.code, 'MFA_ENROLMENT_REQUIRED', 'staff without an authenticator is told to enrol');

  let r = await call(author, 'POST', `/${R}/drafts`, { body: body({ unknownField: 1 }) });
  c.eq(r.status, 400, 'a draft with an unknown field is refused');
  r = await call(author, 'POST', '/Not_An_Id/drafts', { body: body() });
  c.eq(r.status, 404, 'a malformed resource id is 404');
  r = await call(author, 'POST', `/${R}/drafts`, { body: body() });
  c.deq([r.status, r.data.revision?.state, r.data.revision?.revision], [201, 'draft', 1], 'the author creates revision 1 as a draft');
  c.eq((await call(author, 'POST', `/${R}/drafts`, { body: body() })).data?.error?.code, 'REVISION_OPEN', 'a second open revision is refused');
  c.deq(ids(await library(student)).includes(R), false, 'a draft is not in the library');

  r = await call(author, 'PATCH', `/${R}/revisions/1`, { body: body({ rightsBasis: undefined }) });
  r = await call(author, 'POST', `/${R}/revisions/1/submit`);
  c.deq([r.status, r.data?.error?.code], [400, 'RESOURCE_INCOMPLETE'], 'a draft without a rights basis cannot leave draft');
  c.ok((r.data?.error?.problems || []).some(p => /rightsBasis/.test(p)), 'and the problem names it');
  await call(author, 'PATCH', `/${R}/revisions/1`, { body: body() });
  r = await call(reviewer, 'PATCH', `/${R}/revisions/1`, { body: body({ title: 'Edited by an admin' }) });
  c.eq(r.status, 200, 'an administrator may edit another author\'s draft');
  await call(author, 'PATCH', `/${R}/revisions/1`, { body: body() });
  c.eq((await call(author, 'POST', `/${R}/revisions/1/submit`)).data.revision.state, 'in_review', 'submit moves it to in_review');
  c.eq((await call(author, 'PATCH', `/${R}/revisions/1`, { body: body() })).data?.error?.code, 'REVISION_NOT_DRAFT', 'nothing is edited in place after it leaves draft');
  r = await call(author, 'POST', `/${R}/revisions/1/approve`);
  c.deq([r.status, r.data?.error?.code], [409, 'INDEPENDENT_REVIEW_REQUIRED'], 'the author cannot approve their own revision');
  c.eq((await call(reviewer, 'POST', `/${R}/revisions/1/publish`)).data?.error?.code, 'REVISION_NOT_APPROVED', 'an unapproved revision cannot be published');
  r = await call(reviewer, 'POST', `/${R}/revisions/1/approve`);
  c.deq([r.status, r.data.revision?.state, r.data.revision?.reviewerAccountId === reviewer.id], [200, 'approved', true], 'a different reviewer approves it');
  c.eq((await call(author, 'POST', `/${R}/revisions/1/publish`)).status, 403, 'publishing needs the admin role');
  // Step-up: a second factor older than five minutes is asked for again.
  await app.db.run('UPDATE account_sessions SET mfa_verified_at=? WHERE account_id=?', [Date.now() - 6 * 60 * 1000, reviewer.id]);
  r = await call(reviewer, 'POST', `/${R}/revisions/1/publish`);
  c.deq([r.status, r.data?.error?.code], [403, 'MFA_STEP_UP_REQUIRED'], 'publishing demands a fresh second factor');
  c.eq((await presentCode(reviewer)).status, 200, 'the reviewer presents the code');
  r = await call(reviewer, 'POST', `/${R}/revisions/1/publish`);
  c.deq([r.status, r.data.revision?.state], [200, 'published'], 'and then publishes');
  let lib = await library(student);
  c.ok(ids(lib).includes(R), 'the resource appears in the library');
  const got = lib.data.resources.find(x => x.id === R);
  c.ok(got.availability === 'external' && got.url === 'https://example.org/paper' && !('rightsBasis' in got) && !('authorAccountId' in got), 'and carries no review internals');
  c.eq((await app.request('/v1/resources', { jar: student.jar })).status, 200, 'students read it');

  // Edition isolation: the other edition's server never sees it.
  const other = await startApp({ db: app.db, resources: { edition: 'priyabhata' } });
  try {
    const s2 = await registerAccount(other, { email: 'student-other@example.test' });
    await other.db.run('UPDATE accounts SET email_verified_at=? WHERE id=?', [Date.now(), s2.account.id]);
    c.ok(!ids(await other.request('/v1/resources', { jar: s2.jar })).includes(R), 'the other edition does not see a Prithagoras resource');
    c.eq((await other.request(`/v1/resources/${R}`, { jar: s2.jar })).status, 404, 'nor read it by id');
  } finally { await other.close(); }

  // History: revise, review, publish revision 2; both remain.
  r = await call(author, 'POST', `/${R}/revisions/1/revise`);
  c.deq([r.status, r.data.revision?.revision, r.data.revision?.state], [201, 2, 'draft'], 'a revised draft is revision 2');
  await call(author, 'PATCH', `/${R}/revisions/2`, { body: body({ title: 'Practice paper (second edition)' }) });
  await call(author, 'POST', `/${R}/revisions/2/submit`);
  await call(reviewer, 'POST', `/${R}/revisions/2/approve`);
  await presentCode(reviewer);
  r = await call(reviewer, 'POST', `/${R}/revisions/2/publish`);
  c.eq(r.data.revision?.state, 'published', 'revision 2 is published');
  r = await call(reviewer, 'GET', `/${R}/revisions`);
  c.deq(r.data.revisions.map(x => [x.revision, x.state]), [[2, 'published'], [1, 'superseded']], 'the history shows both revisions, the first superseded');
  c.eq(lib = (await library(student)).data.resources.find(x => x.id === R).title, 'Practice paper (second edition)', 'the library serves revision 2');

  // Rollback: a new revision carrying revision 1's reviewed body.
  c.eq((await call(author, 'POST', `/${R}/revisions/1/rollback`)).status, 403, 'rollback is admin only');
  await presentCode(reviewer);
  r = await call(reviewer, 'POST', `/${R}/revisions/1/rollback`);
  c.deq([r.status, r.data.revision?.revision, r.data.revision?.state, r.data.rolledBackFrom], [200, 3, 'published', 1], 'rollback publishes revision 1\'s body as a new revision 3');
  c.eq((await library(student)).data.resources.find(x => x.id === R).title, 'Practice paper', 'the library serves the rolled-back body');
  c.deq((await call(reviewer, 'GET', `/${R}/revisions`)).data.revisions.map(x => [x.revision, x.state]), [[3, 'published'], [2, 'superseded'], [1, 'superseded']], 'history is append-only: three revisions');

  // Withdraw: gone at once; returns only as a new revision.
  r = await call(reviewer, 'POST', `/${R}/withdraw`, {});
  c.eq(r.data?.error?.code, 'REASON_REQUIRED', 'withdrawing needs a reason');
  await presentCode(reviewer);
  r = await call(reviewer, 'POST', `/${R}/withdraw`, { reason: 'Rights query from the publisher.' });
  c.eq(r.data.revision?.state, 'withdrawn', 'the revision is withdrawn');
  c.ok(!ids(await library(student)).includes(R) && (await app.request(`/v1/resources/${R}`, { jar: student.jar })).status === 404, 'a withdrawn resource is out of the library at once');
  r = await call(author, 'POST', `/${R}/revisions/3/revise`);
  c.deq([r.status, r.data.revision?.state], [201, 'draft'], 'a withdrawn resource returns only as a new draft revision');
  r = await call(author, 'POST', `/${R}/revisions/4/reject`, {});
  c.eq(r.data?.error?.code, 'REVISION_TRANSITION_INVALID', 'a draft cannot be rejected (it is already a draft)');
  await call(author, 'POST', `/${R}/revisions/4/submit`);
  r = await call(reviewer, 'POST', `/${R}/revisions/4/reject`, { reason: 'Needs another look at the disclaimer.' });
  c.eq(r.data.revision?.state, 'draft', 'a reviewer can send it back with a reason');
  const audits = await app.db.all("SELECT action FROM audit_log WHERE target_kind='resource-revision' ORDER BY id");
  c.ok(['resource.draft.create', 'resource.submit', 'resource.approve', 'resource.publish', 'resource.rollback', 'resource.withdraw', 'resource.reject'].every(a => audits.some(x => x.action === a)), 'every step wrote an audit row');
  c.eq(Number((await app.db.get("SELECT COUNT(*) AS n FROM resource_revisions WHERE reviewer_account_id=author_account_id")).n), 0, 'no revision was ever reviewed by its own author');

  // ── 3 · Hosted PDFs ───────────────────────────────────────────────────────
  const H = 'hosted-paper-2027';
  const hostedBody = (digest, over = {}) => body({ availability: 'hosted', url: undefined, rightsBasis: 'own-work', assetSha256: digest, source: 'Pri Learning', attribution: 'Written by Pri Learning staff.', rightsNote: 'Own work; hosted by Pri Learning.', ...over });
  await call(author, 'POST', `/${H}/drafts`, { body: hostedBody('0'.repeat(64)) });
  const upload = async (bytes, { declaredLength = bytes.length, declaredSha = sha(bytes), n = 1, resource = H, who = author } = {}) => {
    const start = await call(who, 'POST', `/${resource}/revisions/${n}/asset/start`, {});
    if (start.status !== 200) return start;
    const count = Math.ceil(bytes.length / PART_BYTES);
    for (let i = 0; i < count; i++) {
      const piece = bytes.subarray(i * PART_BYTES, (i + 1) * PART_BYTES);
      const p = await call(who, 'POST', `/${resource}/revisions/${n}/asset/parts/${i}`, { data: piece.toString('base64') });
      if (p.status !== 200) return p;
    }
    return call(who, 'POST', `/${resource}/revisions/${n}/asset/complete`, { parts: count, byteLength: declaredLength, sha256: declaredSha });
  };
  const good = pdf(PART_BYTES + 5000);
  c.eq((await call(author, 'POST', `/${H}/revisions/1/submit`)).data?.error?.code, 'RESOURCE_INCOMPLETE', 'a hosted draft with no file cannot be submitted');
  r = await upload(pdf(2000, '<html>x</html>%PDF-1.4\n'));
  c.ok(r.status === 400 && (r.data.error.problems || []).some(p => /start with %PDF-/.test(p)), 'a polyglot with HTML before %PDF- is refused');
  r = await upload(Buffer.from('not a pdf at all, just some text that is long enough'));
  c.eq(r.status, 400, 'a file that is not a PDF is refused');
  r = await upload(pdf(3000, '%PDF-1.4\n', '\n'));
  c.ok(r.status === 400 && (r.data.error.problems || []).some(p => /%%EOF/.test(p)), 'a PDF with no trailer is refused');
  r = await upload(pdf(3000, '%PDF-1.4\n/JS (app.alert(1))\n'));
  c.ok(r.status === 400 && (r.data.error.problems || []).some(p => /script/.test(p)), 'a PDF carrying script is refused');
  r = await upload(good, { declaredLength: good.length + 10 });
  c.ok(r.status === 400 && (r.data.error.problems || []).some(p => /declared length/.test(p)), 'a PDF whose declared length lies is refused');
  r = await upload(good, { declaredSha: '0'.repeat(64) });
  c.ok(r.status === 400 && (r.data.error.problems || []).some(p => /sha256/.test(p)), 'a PDF whose declared hash lies is refused');
  c.eq((await call(author, 'POST', `/${H}/revisions/1/asset/parts/50`, { data: 'AA==' })).status, 400, 'a part number past the limit is refused');
  c.eq((await call(author, 'POST', `/${H}/revisions/1/asset/parts/0`, { data: Buffer.alloc(PART_BYTES + 1).toString('base64') })).status, 400, 'an oversized part is refused');
  c.eq((await call(author, 'POST', `/${H}/revisions/1/asset/parts/0`, { data: '<script>' })).status, 400, 'a part that is not base64 is refused');
  c.eq((await app.request(`${A}/..%2F..%2Fetc/revisions/1/asset/start`, { method: 'POST', jar: author.jar, body: {} })).status, 404, 'path traversal in the resource id is 404');
  // A replay under another resource finds none of its parts.
  await call(author, 'POST', '/other-paper-2027/drafts', { body: body() });
  await call(author, 'POST', `/${H}/revisions/1/asset/start`, {});
  await call(author, 'POST', `/${H}/revisions/1/asset/parts/0`, { data: pdf(4000).toString('base64') });
  r = await call(author, 'POST', '/other-paper-2027/revisions/1/asset/complete', { parts: 1, byteLength: 4000, sha256: sha(pdf(4000)) });
  c.eq(r.data?.error?.code, 'UPLOAD_INCOMPLETE', 'replaying one resource\'s part against another finds nothing there');
  c.eq((await call(author, 'POST', `/${H}/revisions/1/asset/complete`, { parts: 3, byteLength: 1, sha256: '0'.repeat(64) })).data?.error?.code, 'UPLOAD_INCOMPLETE', 'a declared part count that was not uploaded is refused');

  r = await upload(good);
  c.deq([r.status, r.data.asset?.sha256, r.data.asset?.byteLength, r.data.asset?.region], [201, sha(good), good.length, 'local'], 'a good PDF is stored with the server\'s own hash, size and region');
  const stored = await storage.get(assetKey(H, 1));
  c.ok(stored && sha(stored) === sha(good), 'the stored object is the uploaded file');
  c.eq((await storage.get(`staging/${H}/1/0`)), null, 'the staging parts are gone');
  await call(author, 'PATCH', `/${H}/revisions/1`, { body: hostedBody(sha(good)) });
  r = await call(author, 'POST', `/${H}/revisions/1/submit`);
  c.eq(r.data?.revision?.state, 'in_review', 'a hosted draft whose body names the stored file\'s hash is submitted');
  await call(reviewer, 'POST', `/${H}/revisions/1/approve`);
  await presentCode(reviewer);
  r = await call(reviewer, 'POST', `/${H}/revisions/1/publish`);
  c.eq(r.data.revision?.state, 'published', 'the hosted resource is published');
  const hostedItem = (await library(student)).data.resources.find(x => x.id === H);
  c.ok(hostedItem && hostedItem.availability === 'hosted' && hostedItem.url === null && !JSON.stringify(hostedItem).includes('storage') && !JSON.stringify(hostedItem).includes('resources/'), 'the library lists it with no link and no storage key');
  r = await app.request(`/v1/resources/${H}/file`, { jar: student.jar });
  c.ok(r.status === 200 && /^file-storage:\/\/local\//.test(r.data.url) && r.data.contentType === 'application/pdf' && r.data.sha256 === sha(good) && !('storageKey' in r.data) && !JSON.stringify(r.data).includes('staging'), 'a student is handed a short-lived signed URL, never the key');
  c.ok(storage.verifyLocalUrl(r.data.url) && r.data.expiresAt - Date.now() <= 300000, 'the URL is signed and lasts five minutes at most');
  c.eq((await app.request(`/v1/resources/${R}/file`, { jar: student.jar })).status, 404, 'an external resource has no file');
  c.eq((await call(author, 'DELETE', `/${H}/revisions/1/asset`)).data?.error?.code, 'REVISION_NOT_DRAFT', 'a published revision\'s file cannot be deleted');
  await presentCode(reviewer);
  await call(reviewer, 'POST', `/${H}/withdraw`, { reason: 'Takedown rehearsal.' });
  c.eq((await app.request(`/v1/resources/${H}/file`, { jar: student.jar })).status, 404, 'a withdrawn resource\'s file is no longer handed out');

  // Rules: NESA, rights basis, region.
  const P = 'nesa-paper-2027';
  const nesaBody = hostedBody(sha(good), { source: 'NESA', attribution: 'NSW Education Standards Authority.' });
  c.ok(publishingProblems(P, nesaBody, { sha256: sha(good) }, { edition: 'prithagoras' }).some(x => /NESA needs permissionReference/.test(x)), 'a hosted NESA-sourced item without a permission reference is refused');
  c.deq(publishingProblems(P, { ...nesaBody, permissionReference: 'NESA letter 2026-11-01' }, { sha256: sha(good) }, { edition: 'prithagoras' }), [], 'with the permission recorded it is acceptable');
  c.ok(publishingProblems(P, hostedBody(sha(good), { rightsBasis: 'external-link-only' }), { sha256: sha(good) }, { edition: 'prithagoras' }).length > 0, 'a hosted file cannot be "external-link-only"');
  c.ok(publishingProblems(P, hostedBody(sha(good), { editions: ['priyabhata'] }), { sha256: sha(good) }, { edition: 'prithagoras' }).some(x => /own region/.test(x)), 'a hosted file may be offered only to the edition whose region holds it');
  c.ok(publishingProblems(P, body({ rightsBasis: 'made-up' }), null, {}).some(x => /rightsBasis/.test(x)), 'an unknown rights basis is refused');
  c.deq(pdfProblems(good), [], 'the PDF check accepts a well-formed file');

  // Storage region rule.
  const env = (over) => ({ PRI_RESOURCE_STORAGE: 's3', PRI_RESOURCE_STORAGE_ENDPOINT: 'https://s3.ap-south-1.amazonaws.com', PRI_RESOURCE_STORAGE_BUCKET: 'b', PRI_RESOURCE_STORAGE_REGION: 'ap-south-1', PRI_RESOURCE_STORAGE_ACCESS_KEY_ID: 'AK', PRI_RESOURCE_STORAGE_SECRET_ACCESS_KEY: 'SK', ...over });
  c.deq(storageConfigProblems(env(), 'priyabhata'), [], 'an India region is accepted for Priyabhata');
  c.ok(storageConfigProblems(env(), 'prithagoras').some(x => /not a region for the prithagoras edition/.test(x)), 'an India region is refused for Prithagoras (no Australian bucket yet)');
  c.ok(storageConfigProblems(env({ PRI_RESOURCE_STORAGE_REGION: 'ap-southeast-2' }), 'priyabhata').length === 1, 'an Australian region is refused for Priyabhata');
  c.ok(storageConfigProblems({ PRI_RESOURCE_STORAGE: 'local', PRI_RESOURCE_STORAGE_DIR: '/tmp/x', NODE_ENV: 'production' }, 'priyabhata').length === 1, 'local storage is refused in production');
  c.ok(storageConfigProblems(env({ PRI_RESOURCE_STORAGE_ENDPOINT: 'http://insecure.example' }), 'priyabhata').length === 1, 'an http endpoint is refused');
  let refused = null;
  try { createObjectStorage(env(), 'prithagoras'); } catch (e) { refused = e.code; }
  c.eq(refused, 'STORAGE_CONFIG', 'a region mismatch stops the adapter (and so start-up) from being built');
  c.eq(createObjectStorage({}, 'prithagoras'), null, 'with no storage variables there is no adapter: hosting stays off');
  // AWS's published presigned-URL example (Signature Version 4, S3 GET).
  const aws = presignGetUrl({ host: 'examplebucket.s3.amazonaws.com', path: '/test.txt', region: 'us-east-1', accessKeyId: 'AKIAIOSFODNN7EXAMPLE', secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY', now: Date.UTC(2013, 4, 24), expires: 86400 });
  c.ok(aws.endsWith('X-Amz-Signature=aeeed9bbccd4d02ee5c0109b86d86835f995330da4c265957d157751f604d404'), 'the S3 presigner reproduces the signature in AWS\'s documentation');
  const s3 = createObjectStorage(env(), 'priyabhata', { now: () => Date.UTC(2026, 10, 14) });
  const signed = s3.signedReadUrl('resources/some-paper-1/1.pdf').url;
  c.ok(/response-content-disposition=attachment/.test(signed) && /response-content-type=application%2Fpdf/.test(signed) && /X-Amz-Expires=300/.test(signed), 'a signed S3 URL forces an attachment, as a PDF, for five minutes');
  let unsafe = null;
  try { await storage.put('../../etc/passwd', Buffer.from('x')); } catch (e) { unsafe = e.code; }
  c.eq(unsafe, 'STORAGE_KEY_INVALID', 'a storage key that is not server-made is refused');

  // ── 4 · The migration (schema 17) ─────────────────────────────────────────
  c.ok(/^begin;$/m.test(ROLLBACK) && /^commit;$/m.test(ROLLBACK) && /update pri\.platform_meta set value = '16' where key = 'schema_version';/.test(ROLLBACK)
    && (ROLLBACK.match(/^drop table /gm) || []).length === 2, 'the documented rollback is one transaction: two tables dropped, schema_version back to 16');
  c.ok(/update pri\.platform_meta set value = '17' where key = 'schema_version';/.test(MIGRATION) && SCHEMA_VERSION >= 17, 'the migration sets schema 17 and the build is at 17 or later');
  if (app.engine === 'postgres') {
    const { scratchDatabase, migrationFiles } = await import('./support/postgres.mjs');
    const sdb = await scratchDatabase('publishing_upgrade', { migrations: migrationFiles().filter(m => m.name < MIGRATION_NAME) });
    const su = sdb.client;
    const version = async () => (await su.query("SELECT value FROM pri.platform_meta WHERE key='schema_version'")).rows[0].value;
    const tables = async () => (await su.query("SELECT tablename FROM pg_tables WHERE schemaname='pri' ORDER BY tablename")).rows.map(x => x.tablename);
    try {
      c.eq(await version(), '16', 'the upgrade starts from a schema-16 database');
      const before = await tables();
      await su.query(MIGRATION);
      c.eq(await version(), '17', 'forward: schema_version is 17');
      c.deq((await tables()).filter(t => !before.includes(t)), ['resource_assets', 'resource_revisions'], 'forward: exactly the two tables are added');
      for (const t of ['resource_assets', 'resource_revisions']) {
        const pol = (await su.query("SELECT policyname, permissive FROM pg_policies WHERE schemaname='pri' AND tablename=$1 ORDER BY policyname", [t])).rows.map(p => `${p.policyname}:${p.permissive}`);
        c.deq(pol, ['pri_scope_required:RESTRICTIVE', 'pri_server_all:PERMISSIVE'], `forward: ${t} fails closed`);
      }
      const bad = async sql => { try { await su.query(sql); return 'accepted'; } catch (e) { return e.code; } };
      const rev = (state, reviewer = 'null') => `INSERT INTO pri.resource_revisions(id,resource_id,revision,state,body_json,author_account_id,reviewer_account_id,created_at) VALUES ('${state}-${reviewer}','r-1',${Math.random() * 1e6 | 0},'${state}','{}','a',${reviewer},1)`;
      c.deq([await bad(rev('live')), await bad(rev('draft', "'a'"))], ['23514', '23514'], 'the table refuses an unknown state and a reviewer equal to the author');
      await su.query(rev('draft'));
      c.eq(await bad(rev('draft').replace("'draft-null'", "'x2'")), '23505', 'a second open revision of one resource is refused by the index');
      await su.query(ROLLBACK);
      c.eq(await version(), '16', 'rollback: schema_version is 16');
      c.deq(await tables(), before, 'rollback: exactly the two tables are gone');
      await su.query(MIGRATION);
      c.eq(await version(), '17', 're-apply after rollback: schema 17');
    } finally { await sdb.drop(); }
  } else {
    for (const t of ['resource_revisions', 'resource_assets']) c.ok(!!(await app.db.get("SELECT 1 AS x FROM sqlite_master WHERE name=?", [t])), `SQLite: the build has ${t}`);
    let selfReview = null;
    try { await app.db.run("INSERT INTO resource_revisions(id,resource_id,revision,state,body_json,author_account_id,reviewer_account_id,created_at) VALUES ('z','z-paper-1',1,'approved','{}','a','a',1)"); } catch (e) { selfReview = e.code || 'refused'; }
    c.ok(selfReview, 'SQLite: the table itself refuses a reviewer equal to the author');
  }
} finally {
  if (app) await app.close();
  rmSync(scratch, { recursive: true, force: true });
}
console.log(`engine: ${engine || 'sqlite'}`);
console.log(`resource-publishing-check (${engine || 'sqlite'}): ${c.count()} checks passed`);
