// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Practice recovery — what a question card needs to survive the
// app going away mid-question (§09).
//
// Two records, both in the profile-scoped draft store (drafts.js), so profile
// switching, expiry and "clear my drafts" already cover them:
//
//   · submit/<questionId> — a submission that has been sent and has not yet
//     had a definitive answer. It holds the submission's idempotency key and
//     exactly what was submitted, written synchronously BEFORE the request
//     leaves, so a relaunch can replay the same submission under the same key.
//     The backend answers a replay with the verdict it already recorded, or
//     marks it now if the first delivery never landed: either way exactly one
//     attempt, and the student sees its result instead of wondering.
//
//   · ink/<questionId> — the handwriting on the question still being answered,
//     compacted to integer [x, y] points, so a reload or an iPad that evicted
//     the web view does not throw away a page of working.
//
// Neither ever holds the expected answer, a solution or a mark.
// ─────────────────────────────────────────────────────────────────────────────
import { clearDraft, draftIdsIn, queueDraft, readDraft, saveDraft } from './drafts.js';

const PENDING = 'submit';
const INK = 'ink';
// A whole page of working is a few tens of kB compacted. Past this the record
// would crowd out every other draft, so the ink is simply not kept.
const MAX_INK_CHARS = 300_000;
const MAX_INK_STROKES = 4000;
const SUBMISSION_ID = /^[A-Za-z0-9_-]{8,80}$/;

/** A fresh idempotency key for one tap of Submit. */
export function newSubmissionId() {
  const bytes = new Uint8Array(16);
  const c = globalThis.crypto;
  if (c?.getRandomValues) c.getRandomValues(bytes);
  else for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  return `sub_${[...bytes].map(b => b.toString(16).padStart(2, '0')).join('')}`;
}

/** What makes two submissions "the same submission": the answer and working sent. */
export function submissionContentKey(answer, steps) {
  return JSON.stringify([String(answer ?? ''), steps === undefined || steps === null ? '' : String(steps)]);
}

function cleanLines(lines) {
  return Array.isArray(lines) ? lines.slice(0, 40).map(l => String(l ?? '').slice(0, 400)) : null;
}

/**
 * Record a submission as in flight. Synchronous on purpose: it has to be on
 * disk before the request can possibly be answered or the app be killed.
 */
export function savePendingSubmission(questionId, rec, meta = {}) {
  if (!questionId || !SUBMISSION_ID.test(String(rec?.submissionId || ''))) return false;
  return saveDraft(PENDING, questionId, {
    submissionId: rec.submissionId,
    answer: String(rec.answer ?? '').slice(0, 4000),
    steps: rec.steps === undefined || rec.steps === null ? undefined : String(rec.steps).slice(0, 20000),
    viaInk: rec.viaInk === true,
    ms: Math.max(0, Math.round(Number(rec.ms) || 0)),
    lines: cleanLines(rec.lines)
  }, { label: meta.label || '', note: 'Answer being marked', path: '/practice' });
}

/** The in-flight submission for this question, or null. */
export function readPendingSubmission(questionId) {
  if (!questionId) return null;
  const d = readDraft(PENDING, questionId);
  if (!d || typeof d !== 'object' || !SUBMISSION_ID.test(String(d.submissionId || ''))) return null;
  return {
    submissionId: d.submissionId,
    answer: String(d.answer ?? ''),
    steps: d.steps === undefined || d.steps === null ? undefined : String(d.steps),
    viaInk: d.viaInk === true,
    ms: Math.max(0, Number(d.ms) || 0),
    lines: cleanLines(d.lines)
  };
}

export function clearPendingSubmission(questionId) {
  if (questionId) clearDraft(PENDING, questionId);
}

/** The question whose submission was most recently left in flight, or null. */
export function pendingSubmissionQuestionId() {
  for (const id of draftIdsIn(PENDING)) {
    if (readPendingSubmission(id)) return id;
  }
  return null;
}

/** Integer [x, y] points — the same compact shape a submission carries. */
export function compactStrokes(strokes) {
  return (Array.isArray(strokes) ? strokes : []).slice(0, MAX_INK_STROKES).map(st => ({
    points: (Array.isArray(st?.points) ? st.points : []).map(p => (Array.isArray(p)
      ? [Math.round(Number(p[0]) || 0), Math.round(Number(p[1]) || 0)]
      : [Math.round(Number(p?.x) || 0), Math.round(Number(p?.y) || 0)]))
  })).filter(st => st.points.length);
}

/** Keep the handwriting of a question still being answered. Coalesced. */
export function saveInkDraft(questionId, strokes, meta = {}) {
  if (!questionId) return false;
  const compact = compactStrokes(strokes);
  if (!compact.length) { clearDraft(INK, questionId); return true; }
  if (JSON.stringify(compact).length > MAX_INK_CHARS) return false;
  queueDraft(INK, questionId, { strokes: compact }, { label: meta.label || '', note: 'Handwriting in progress', path: '/practice' });
  return true;
}

/** The kept handwriting as canvas strokes ({ points: [{ x, y }] }), or null. */
export function readInkDraft(questionId) {
  if (!questionId) return null;
  const d = readDraft(INK, questionId);
  const strokes = compactStrokes(d?.strokes);
  if (!strokes.length) return null;
  return strokes.map(st => ({ points: st.points.map(([x, y]) => ({ x, y })) }));
}

export function clearInkDraft(questionId) {
  if (questionId) clearDraft(INK, questionId);
}
