// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the student's original work, kept with the mark (standard #08)
//
// Owner rule: "the final marking must check the human's handwriting, not the
// computer's." The work being marked and shown is what the student wrote. A
// marked handwritten or photographed answer therefore carries its ORIGINAL —
// the pen strokes as the device captured them (client/src/engine/originalInk.js,
// pri-ink-v1) or the photographed / PDF page exactly as sent — and the server
// keeps it in the SAME transaction as the mark, bound to it by SHA-256:
//
//   · the grade reply (the receipt the device keeps) names the original's
//     digest, and so does the graded-attempt event, so the mark is recorded
//     with that exact handwriting. For a photo, the original IS the picture
//     that was read (same bytes, samePicture). For strokes, the server checks
//     the bytes against their digest and the page against the format; the
//     picture that was read is rendered by the device from the same strokes,
//     which the server cannot re-render to compare;
//   · the original is stored as received and never rewritten: no smoothing,
//     no beautifying, no typeset version. A row is inserted once and never
//     updated (a replay under the same submission finds the row it wrote);
//   · the reading — "what Pri read", the text the student confirmed, and the
//     student's edits — is a separate, secondary layer kept beside it
//     (reading_json), never in place of it. The mark rests on the confirmed
//     reading; a teacher can see where it differs from what Pri read;
//   · each confirmed reading line names the strokes it came from (lines_json),
//     so marked work and the teacher's review draw boxes on the student's ink.
//
// Reading stays ANSWER-BLIND: nothing here is sent to any reader, and the
// original arrives on the marking request, after the reading was done.
//
// STORAGE. Postgres `bytea` (SQLite BLOB in tests). No object store is
// provisioned for either edition (owner rule: free tier), so every original
// lives in the edition's own database, which is in the edition's region.
// Strokes are gzip-compressed as the device sent them (the digest is over the
// canonical bytes inside); an image is kept as its own compressed bytes. Size:
// a page of strokes is typically 5–40 kB stored, a photo up to 750 kB. Neon's
// Free plan gives 0.5 GB per project, so per-account quotas below bound what
// one account can take, and a page over quota is refused for the SERVER copy
// only — the reply says so (saved: false, reason 'quota'); the device keeps
// the strokes in its own history as before.
//
// PRIVACY. Account-owned under RLS (pri_scope_required + RESTRICTIVE
// pri_account_scope) and server authorization on every read: the student, or a
// teacher of an active class the student belongs to. Cascades with the account
// (deleted with it), listed with its bytes in the account export, and expired
// by housekeeping after the edition's retention period (purpose-bound raw-data
// retention: docs/research/LONG_HORIZON_LEARNER_MEMORY_DATA_GOVERNANCE_V7.md §5).
// ─────────────────────────────────────────────────────────────────────────────
import { createHash, randomUUID } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { asyncRouter } from './asyncRouter.js';
import { asStore } from './store.js';
import { rateLimit, requireRole, requireSession, requireVerifiedEmail } from './security.js';
import { serverEdition } from './edition.js';
import { validateImage } from './handwritingProvider.js';
import { consentBlockerCode, consentState } from './guardianConsent.js';
import { INK_FORMAT, INK_LIMITS, InkFormatError, cleanLineRegions, decodeInk } from '../../client/src/engine/originalInk.js';

const DAY = 24 * 60 * 60 * 1000;
/**
 * How long an original is kept, per edition. Purpose-bound: long enough for a
 * student and their teacher to look back over a school year and the next (a
 * mark can be questioned, revision draws on old work), then expired. The
 * learning record (the mark, the verified first break) outlives it. A counsel
 * decision may shorten either; it is one number here and in the privacy doc.
 */
export const ORIGINAL_RETENTION_MS = Object.freeze({ priyabhata: 730 * DAY, prithagoras: 730 * DAY });
/** Per-account ceilings on what the server keeps (stored bytes). */
export const ORIGINAL_QUOTA = Object.freeze({ strokesBytes: 40 * 1024 * 1024, imageBytes: 24 * 1024 * 1024 });
/** The largest wire payload for strokes (base64 of gzip or of the canonical bytes). */
export const MAX_STROKES_WIRE_CHARS = Math.ceil((INK_LIMITS.maxBytes * 4) / 3) + 8;
const MAX_EDITS = 20;
const MAX_EDIT_CHARS = 12000;
const MAX_EDITS_CHARS = 48000;
const SHA = /^[0-9a-f]{64}$/;
const ID = /^[0-9a-f-]{36}$/;
const ORIGIN = new Set(['ink', 'photo', 'pdf-page']);
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const plain = v => !!v && typeof v === 'object' && !Array.isArray(v);

export class OriginalRefused extends Error {
  constructor(code, message, status = 400) { super(message); this.code = code; this.status = status; }
}

/**
 * Validate the `original` a submission carries. `picture` is the submission's
 * own `image` (a photo's original may be named as that same picture rather
 * than sent twice). Returns { kind, origin, format, sha256, stored, encoding,
 * canonicalBytes, lines, edits, page? } or throws OriginalRefused. Every check
 * fails closed: a digest that does not match the bytes, a page that does not
 * decode, a line naming a stroke not on the page — refused, nothing marked.
 */
export function parseOriginal(original, { mode, picture = null } = {}) {
  if (!plain(original)) throw new OriginalRefused('ORIGINAL_INVALID', 'The original must be an object.');
  const allowed = new Set(['kind', 'origin', 'encoding', 'data', 'sha256', 'lines', 'edits', 'samePicture']);
  const unknown = Object.keys(original).filter(k => !allowed.has(k));
  if (unknown.length) throw new OriginalRefused('ORIGINAL_INVALID', `Unexpected original field: ${unknown.join(', ')}.`);
  if (typeof original.sha256 !== 'string' || !SHA.test(original.sha256)) throw new OriginalRefused('ORIGINAL_INVALID', 'The original needs its SHA-256.');
  const edits = cleanEdits(original.edits);
  if (original.kind === 'strokes') {
    if (mode !== 'ink') throw new OriginalRefused('ORIGINAL_INVALID', 'Strokes belong to a handwritten answer.');
    if (original.origin !== undefined && original.origin !== 'ink') throw new OriginalRefused('ORIGINAL_INVALID', 'Strokes are ink.');
    if (!['gzip', 'identity'].includes(original.encoding)) throw new OriginalRefused('ORIGINAL_INVALID', 'Strokes are sent gzip or identity encoded.');
    if (typeof original.data !== 'string' || !original.data || original.data.length > MAX_STROKES_WIRE_CHARS || !/^[A-Za-z0-9+/]+={0,2}$/.test(original.data)) {
      throw new OriginalRefused('ORIGINAL_TOO_LARGE', 'This page of writing is larger than can be kept.', 413);
    }
    const wire = Buffer.from(original.data, 'base64');
    let canonical;
    try {
      canonical = original.encoding === 'gzip' ? gunzipSync(wire, { maxOutputLength: INK_LIMITS.maxBytes }) : wire;
    } catch { throw new OriginalRefused('ORIGINAL_INVALID', 'The strokes do not decompress within the page limit.'); }
    if (sha256(canonical) !== original.sha256) throw new OriginalRefused('ORIGINAL_DIGEST_MISMATCH', 'The strokes do not match their digest.');
    let page;
    try { page = decodeInk(new Uint8Array(canonical.buffer, canonical.byteOffset, canonical.byteLength)); } catch (error) {
      if (error instanceof InkFormatError) throw new OriginalRefused(error.code === 'INK_TOO_LARGE' ? 'ORIGINAL_TOO_LARGE' : 'ORIGINAL_INVALID', error.message, error.code === 'INK_TOO_LARGE' ? 413 : 400);
      throw error;
    }
    if (!page.strokes.length) throw new OriginalRefused('ORIGINAL_INVALID', 'There is no writing on this page.');
    let lines;
    try { lines = cleanLineRegions(original.lines, page.strokes.length); } catch (error) { throw new OriginalRefused('ORIGINAL_INVALID', error.message); }
    // Kept as the device sent it when gzip (the digest is over what is inside);
    // identity bytes are kept as they are. Nothing is re-encoded.
    return { kind: 'strokes', origin: 'ink', format: INK_FORMAT, sha256: original.sha256, stored: wire, encoding: original.encoding,
      canonicalBytes: canonical.byteLength, lines, edits, page: { source: page.source, strokes: page.strokes.length, removed: page.removed.length } };
  }
  if (original.kind === 'image') {
    if (mode !== 'photo') throw new OriginalRefused('ORIGINAL_INVALID', 'An image belongs to a photographed answer.');
    if (!ORIGIN.has(original.origin) || original.origin === 'ink') throw new OriginalRefused('ORIGINAL_INVALID', 'Name where the image came from: photo or pdf-page.');
    if (original.encoding !== undefined) throw new OriginalRefused('ORIGINAL_INVALID', 'An image is kept as its own bytes.');
    if (original.lines !== undefined) throw new OriginalRefused('ORIGINAL_INVALID', 'Line regions are stroke indices; an image has none.');
    // A photo's original is the very picture this request sends to be read
    // (samePicture): never a separate image that was not read.
    if (original.samePicture !== true || original.data !== undefined) throw new OriginalRefused('ORIGINAL_INVALID', 'A photographed original is the picture this answer was read from.');
    const dataUrl = picture;
    if (typeof dataUrl !== 'string') throw new OriginalRefused('ORIGINAL_INVALID', 'The original image is missing.');
    let format;
    try { ({ mime: format } = validateImage(dataUrl)); } catch (error) { throw new OriginalRefused(error.code || 'ORIGINAL_INVALID', error.message, error.status || 400); }
    const bytes = Buffer.from(dataUrl.slice(dataUrl.indexOf(',') + 1), 'base64');
    if (sha256(bytes) !== original.sha256) throw new OriginalRefused('ORIGINAL_DIGEST_MISMATCH', 'The image does not match its digest.');
    return { kind: 'image', origin: original.origin, format, sha256: original.sha256, stored: bytes, encoding: 'identity', canonicalBytes: bytes.byteLength, lines: [], edits };
  }
  throw new OriginalRefused('ORIGINAL_INVALID', 'An original is strokes or an image.');
}

function cleanEdits(edits) {
  if (edits === undefined) return [];
  if (!Array.isArray(edits) || edits.length > MAX_EDITS) throw new OriginalRefused('ORIGINAL_INVALID', 'The reading edits are not a short list.');
  let total = 0;
  return edits.map(edit => {
    if (!plain(edit) || typeof edit.text !== 'string' || edit.text.length > MAX_EDIT_CHARS || !Number.isSafeInteger(edit.at) || edit.at < 0) {
      throw new OriginalRefused('ORIGINAL_INVALID', 'Each reading edit is { text, at }.');
    }
    total += edit.text.length;
    if (total > MAX_EDITS_CHARS) throw new OriginalRefused('ORIGINAL_INVALID', 'The reading edits are too long.');
    return { text: edit.text, at: edit.at };
  });
}

/** What the reply and the graded-attempt event say about the original: its proof, never its bytes. */
export const originalProof = row => ({ id: row.id, kind: row.kind, origin: row.origin, format: row.format, sha256: row.sha256 });

/**
 * Keep the original. Called INSIDE the transaction that commits the mark,
 * under the account's lock and scope. Insert-once: a row already written for
 * this submission is returned as it is (and must hold the same digest — the
 * grade's request digest includes it, so a different one never gets here).
 * Over quota: nothing is written; { saved: false, reason: 'quota' } — the mark
 * still commits, and the device keeps its copy.
 */
export async function keepOriginal(db, { accountId, edition, questionId, submissionId, attemptId, parsed, reading, now }) {
  const prior = await db.get('SELECT id,kind,origin,format,sha256 FROM attempt_originals WHERE account_id=? AND question_id=? AND submission_id=?',
    [accountId, questionId, submissionId]);
  if (prior) return prior.sha256 === parsed.sha256 ? { saved: true, row: prior } : { saved: false, reason: 'conflict' };
  const usage = await db.get('SELECT COALESCE(SUM(byte_length),0) AS used FROM attempt_originals WHERE account_id=? AND kind=?', [accountId, parsed.kind]);
  const quota = parsed.kind === 'strokes' ? ORIGINAL_QUOTA.strokesBytes : ORIGINAL_QUOTA.imageBytes;
  if (Number(usage?.used || 0) + parsed.stored.byteLength > quota) return { saved: false, reason: 'quota' };
  const retention = ORIGINAL_RETENTION_MS[edition] ?? ORIGINAL_RETENTION_MS.priyabhata;
  const row = { id: randomUUID(), kind: parsed.kind, origin: parsed.origin, format: parsed.format, sha256: parsed.sha256 };
  const readingJson = JSON.stringify({
    // What Pri read, as the server's own record of the read has it (null when
    // the server no longer holds that text), and the confirmed text the mark
    // was given. They differ exactly when the student corrected the reading.
    read: typeof reading?.read === 'string' ? reading.read : null,
    confirmed: String(reading?.confirmed ?? ''),
    corrected: reading?.corrected === true,
    receipt: typeof reading?.receipt === 'string' ? reading.receipt : null,
    edits: parsed.edits
  });
  await db.run(`INSERT INTO attempt_originals(id,account_id,edition,question_id,submission_id,attempt_id,kind,origin,format,encoding,sha256,byte_length,canonical_bytes,content,lines_json,reading_json,created_at,expires_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
  [row.id, accountId, edition, questionId, submissionId, attemptId, row.kind, row.origin, row.format, parsed.encoding, row.sha256,
    parsed.stored.byteLength, parsed.canonicalBytes, parsed.stored, JSON.stringify(parsed.lines), readingJson, now, now + retention]);
  return { saved: true, row };
}

/** The canonical bytes of a stored original (gunzipped strokes; an image as is), checked against its digest. */
export function originalBytes(row) {
  const stored = Buffer.isBuffer(row.content) ? row.content : Buffer.from(row.content || []);
  const bytes = row.encoding === 'gzip' ? gunzipSync(stored, { maxOutputLength: INK_LIMITS.maxBytes }) : stored;
  if (sha256(bytes) !== row.sha256) throw Object.assign(new Error('A stored original no longer matches its digest.'), { code: 'ORIGINAL_CORRUPT' });
  return bytes;
}

/**
 * The read view of one row: metadata, the reading layer, the line regions and
 * the original's bytes (base64, canonical). `stored: true` gives the bytes as
 * stored instead (gzip for strokes, with `encoding`), without decompressing —
 * what the account export uses, so a large export is not inflated in memory.
 */
export function originalView(row, { withBytes = true, stored = false } = {}) {
  let reading = null, lines = [];
  try { reading = JSON.parse(row.reading_json); } catch { reading = null; }
  try { lines = JSON.parse(row.lines_json); } catch { lines = []; }
  return {
    id: row.id, kind: row.kind, origin: row.origin, format: row.format, sha256: row.sha256,
    questionId: row.question_id, submissionId: row.submission_id, attemptId: row.attempt_id,
    createdAt: Number(row.created_at), expiresAt: Number(row.expires_at), byteLength: Number(row.canonical_bytes),
    lines, reading,
    ...(withBytes && stored ? { encoding: row.encoding, data: Buffer.from(row.content).toString('base64') } : {}),
    ...(withBytes && !stored ? { data: row.kind === 'image' ? `data:${row.format};base64,${originalBytes(row).toString('base64')}` : originalBytes(row).toString('base64') } : {})
  };
}

/** Whether `teacherId` teaches an active class `studentId` is an active member of. */
async function membershipOf(db, teacherId, classId, studentId) {
  return db.get(`SELECT m.joined_at FROM classes c JOIN class_members m ON m.class_id = c.id
    WHERE c.id=? AND c.teacher_account_id=? AND c.archived_at IS NULL AND m.student_account_id=? AND m.removed_at IS NULL`, [classId, teacherId, studentId]);
}

/**
 * /v1/originals — read the original work behind a mark.
 *   GET /v1/originals/:id                              the student's own
 *   GET /v1/originals?attemptId=… | ?questionId=…&submissionId=…
 *   GET /v1/originals/class/:classId/student/:studentId/:id   their teacher
 * Nothing here writes: an original is written only with its mark.
 */
export function createOriginalsRouter(db, { edition = serverEdition(process.env) } = {}) {
  db = asStore(db);
  const router = asyncRouter();
  router.use(requireSession(db), requireVerifiedEmail);
  router.use((req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
  const fail = (res, status, code, message) => res.status(status).json({ error: { code, message } });
  const own = (accountId, sql, params) => db.transaction(() => db.get(sql, params), { readOnly: true, accountScope: accountId });
  const send = (res, row) => {
    try { return res.json({ original: originalView(row) }); } catch (error) {
      if (error.code === 'ORIGINAL_CORRUPT') return fail(res, 500, 'ORIGINAL_CORRUPT', 'This original no longer matches its record.');
      throw error;
    }
  };
  const read = rateLimit(db, 'original-read', { limit: 600, windowMs: 60 * 60 * 1000 });

  router.get('/class/:classId/student/:studentId/:id', requireRole('teacher'), read, async (req, res) => {
    const session = req.platformSession;
    const { classId, studentId, id } = req.params;
    if (!ID.test(id)) return fail(res, 404, 'ORIGINAL_NOT_FOUND', 'No such work.');
    // Server authorization first: this teacher teaches this student in an
    // active class. Only then is the student's row read (system scope: RLS
    // confines account scope to the caller's own rows, and this row is the
    // student's, so the authorization above is the boundary).
    const member = await membershipOf(db, session.account_id, String(classId), String(studentId));
    if (!member) return fail(res, 404, 'ORIGINAL_NOT_FOUND', 'No such work.');
    // A child whose guardian has not given (or has withdrawn) consent shares
    // nothing with anyone, their teacher included.
    if (consentBlockerCode(await consentState(db, String(studentId)))) return fail(res, 404, 'ORIGINAL_NOT_FOUND', 'No such work.');
    // Only work the student did while in this teacher's class: nothing from
    // before they joined is opened to the teacher by joining.
    const row = await db.get('SELECT * FROM attempt_originals WHERE id=? AND account_id=? AND edition=? AND created_at >= ?', [id, String(studentId), edition, Number(member.joined_at)]);
    return row ? send(res, row) : fail(res, 404, 'ORIGINAL_NOT_FOUND', 'No such work.');
  });

  router.get('/:id', requireRole('student'), read, async (req, res) => {
    const accountId = req.platformSession.account_id;
    if (!ID.test(req.params.id)) return fail(res, 404, 'ORIGINAL_NOT_FOUND', 'No such work.');
    const row = await own(accountId, 'SELECT * FROM attempt_originals WHERE id=? AND account_id=? AND edition=?', [req.params.id, accountId, edition]);
    return row ? send(res, row) : fail(res, 404, 'ORIGINAL_NOT_FOUND', 'No such work.');
  });

  router.get('/', requireRole('student'), read, async (req, res) => {
    const accountId = req.platformSession.account_id;
    const { attemptId, questionId, submissionId } = req.query;
    let row = null;
    if (typeof attemptId === 'string' && ID.test(attemptId)) {
      row = await own(accountId, 'SELECT * FROM attempt_originals WHERE attempt_id=? AND account_id=? AND edition=?', [attemptId, accountId, edition]);
    } else if (typeof questionId === 'string' && typeof submissionId === 'string' && questionId.length <= 200 && submissionId.length <= 200) {
      row = await own(accountId, 'SELECT * FROM attempt_originals WHERE question_id=? AND submission_id=? AND account_id=? AND edition=?', [questionId, submissionId, accountId, edition]);
    } else return fail(res, 400, 'ORIGINAL_QUERY_INVALID', 'Name an attempt, or a question and submission.');
    return row ? send(res, row) : fail(res, 404, 'ORIGINAL_NOT_FOUND', 'No such work.');
  });
  return router;
}
