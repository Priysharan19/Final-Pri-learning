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
//   · the handwriting on the question still being answered is NOT here any
//     more: it is in the sealed `inkDrafts` IndexedDB store (local/inkDrafts.js),
//     re-exported below, so a reload or an iPad that evicted the web view does
//     not throw away a page of working and the page is never in plaintext.
//
// Neither ever holds the expected answer, a solution or a mark.
// ─────────────────────────────────────────────────────────────────────────────
import { clearDraft, draftIdsIn, readDraft, saveDraft } from './drafts.js';

const PENDING = 'submit';
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
    // Persist provenance without persisting a plaintext photo or PDF. An
    // interrupted Photo request must never restart as a typed grade.
    sourceMode: rec.sourceMode === 'photo' ? 'photo' : rec.viaInk === true ? 'ink' : 'typed',
    ms: Math.max(0, Math.round(Number(rec.ms) || 0)),
    lines: cleanLines(rec.lines),
    ...(rec.refused === true ? { refused: true } : {}),
    ...(rec.edited === true ? { edited: true } : {})
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
    // Old builds omitted the source authority. A legacy pending answer could
    // have come from a Photo; never silently replay unknown provenance as typed.
    sourceMode: ['photo', 'ink', 'typed'].includes(d.sourceMode)
      ? d.sourceMode : (d.viaInk === true ? 'ink' : 'unknown'),
    ms: Math.max(0, Number(d.ms) || 0),
    lines: cleanLines(d.lines),
    refused: d.refused === true,
    edited: d.edited === true
  };
}

/**
 * The submission was refused before anything could be marked (no account, an
 * expired session). Its key and content are kept so the student's own next
 * Submit is the same submission — but it is no longer "in flight": nothing may
 * send it again on its own.
 */
export function holdPendingSubmission(questionId, meta = {}) {
  const pending = readPendingSubmission(questionId);
  return pending ? savePendingSubmission(questionId, { ...pending, sourceMode: pending.sourceMode, refused: true }, meta) : false;
}

/**
 * Whether a failed Submit is proof that nothing was marked.
 *
 * The local backend stamps `beforeMarking` on every refusal raised before the
 * marking request left the device (no account, a question that could not be
 * bound, a reading that failed, a device that knows it is offline) and on the
 * server's own refusal to mark (no session, account not yet eligible). A
 * timeout, a dropped connection or a server fault is not stamped: the request
 * may have been marked, so that submission stays in flight.
 */
export function refusedBeforeMarking(error) {
  return error?.beforeMarking === true || error?.code === 'SIGN_IN_TO_CHECK' || Number(error?.status) === 401;
}

/**
 * What becomes of the pending record after a Submit failed. One rule, used by
 * the card for a tap and for a relaunch replay alike:
 *
 *   'cleared'   — `definitive`: the server gave a final answer that is not a
 *                 mark (the question is finished, the key was reused). Nothing
 *                 is left to replay.
 *   'held'      — proven not marked. Key and content are kept for the
 *                 student's own next Submit; nothing sends them again.
 *   'in-flight' — sent, outcome unknown. Kept as it is, so an identical retry
 *                 or a relaunch replays the same key and it lands once.
 */
export function settleFailedSubmission(questionId, error, { definitive = false, meta = {} } = {}) {
  if (definitive) { clearPendingSubmission(questionId); return 'cleared'; }
  if (refusedBeforeMarking(error)) return holdPendingSubmission(questionId, meta) ? 'held' : 'in-flight';
  return 'in-flight';
}

/**
 * The student changed the answer or working of a question that has a pending
 * record. `contentKey` is submissionContentKey() of what is on screen now.
 * Returns the record that still stands (or null), for the card's own memo.
 *
 *   · unchanged content — nothing happens: the same answer is still the same
 *     submission, under the same key.
 *   · a HELD record (never sent) — dropped. It no longer says what the student
 *     will submit, so it must not be sendable, and the next Submit takes a new
 *     key. Safe because nothing under the old key ever left the device.
 *   · a record in flight (sent, outcome unknown) — kept, and flagged `edited`.
 *     The key and what was sent stay on disk, so typing the same answer again
 *     is still the same submission and still lands once; but a relaunch no
 *     longer sends it by itself, because it is not what the student left on
 *     screen.
 */
export function noteSubmissionEdited(questionId, contentKey, meta = {}) {
  const pending = readPendingSubmission(questionId);
  if (!pending) return null;
  if (submissionContentKey(pending.answer, pending.steps) === contentKey) return pending;
  if (pending.refused) { clearPendingSubmission(questionId); return null; }
  if (!pending.edited) savePendingSubmission(questionId, { ...pending, edited: true }, meta);
  return { ...pending, edited: true };
}

/**
 * What a card does with the pending record it finds when it mounts.
 *
 *   { action: 'none' }      no record.
 *   { action: 'replay' }    in flight, and still exactly what the student
 *                           submitted: sent again under its own key.
 *   { action: 'restore', …} put the work back and wait for the student's own
 *                           Submit. `fill` says whether the kept answer goes
 *                           back into the typed fields (false when the student
 *                           edited afterwards: their newer draft stands);
 *                           `mode` is the input to show; `reattach` asks for
 *                           the photo again (an image is never kept in a
 *                           plaintext draft).
 *
 * Nothing but 'replay' sends anything, and 'replay' is only ever a submission
 * the student pressed Submit on, unchanged, whose outcome is unknown.
 */
export function recoveryPlan(pending, { typedDraft = null, workingIsAnswer = false } = {}) {
  if (!pending) return { action: 'none' };
  const mode = pending.sourceMode === 'photo' ? 'photo' : pending.sourceMode === 'ink' ? 'write' : 'type';
  // Edited since it was sent: the student's newer draft is what is on screen.
  // The flag says so; the kept typed draft is checked as well, so a record
  // written before the flag existed (or a flag write that was lost) can still
  // never send an answer other than the one on screen.
  const shown = typedDraft && typeof typedDraft === 'object'
    ? String((workingIsAnswer ? typedDraft.working : typedDraft.typed) ?? '') : null;
  const draftDiffers = pending.sourceMode === 'typed' && shown !== null && !pending.refused &&
    (shown !== pending.answer || (!workingIsAnswer && pending.steps !== undefined && String(typedDraft.working ?? '') !== pending.steps));
  if (pending.edited || draftDiffers) return { action: 'restore', mode: null, fill: false, reattach: false };
  // Never sent to be marked: put the work back and wait for Submit.
  if (pending.refused) return { action: 'restore', mode, fill: pending.sourceMode !== 'ink', reattach: pending.sourceMode === 'photo' };
  // Pre-provenance versions stored Photo and typed attempts identically: never
  // automatically re-grade one as typed after a crash.
  if (pending.sourceMode === 'unknown') return { action: 'restore', mode: 'type', fill: true, reattach: false };
  // The image is never written to a plaintext draft, so an interrupted Photo
  // request needs a fresh attachment; replaying its transcript as typed work
  // would bypass the reading receipt.
  if (pending.sourceMode === 'photo') return { action: 'restore', mode: 'photo', fill: true, reattach: true };
  return { action: 'replay' };
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

// ── Handwriting ──────────────────────────────────────────────────────────────
// The ink of the question on screen lives in the profile's sealed IndexedDB
// store (local/inkDrafts.js), not in this localStorage draft store: a page of
// working is private work and sits under the same protection as attempts. The
// names are kept here so the card and the practice page have one recovery
// module to import; the reads are asynchronous now, which is why the card
// mounts its ink surface only once the kept page has been looked for.
export { compactStrokes, saveInkDraft, readInkDraft, clearInkDraft } from '../local/inkDrafts.js';
