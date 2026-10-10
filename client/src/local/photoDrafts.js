// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Photo drafts — a photographed page still being answered
//
// The photo used to live in component memory only: a reload, a crash or the
// tab being put to sleep lost the picture, the reading, every correction and
// the answer. It is kept here instead, the same way handwriting is
// (local/inkDrafts.js): one row per (profile, question) in the profile's sealed
// IndexedDB store, written on change and read back through a fresh connection
// before anything on screen is allowed to say "saved".
//
//   · The row lives in the sealed `inkDrafts` store under its own id
//     (`${pid}:photo:${questionId}`), so it is ciphertext at rest with the
//     profile's data key, is removed with the profile, and never collides with
//     a page of ink for the same question. Only `id` and `pid` are in the
//     clear. The ink queue skips it (it has no strokes).
//   · It holds the picture, the reader's lines with the student's edits and
//     exclusions, and the answer in the field. It never holds an expected
//     answer, a solution or a mark — none of those are on the device.
//   · The picture goes nowhere else: not localStorage, not a log, not
//     diagnostics. Nothing in this module prints or reports a row.
//   · It is removed when the question is resolved, revealed or the photo is
//     taken off, and expires with the same age limit as ink.
// ─────────────────────────────────────────────────────────────────────────────
import { del, get, getFresh, put } from './idb.js';
import { INK_DRAFT_STORE, inkDraftProfileId } from './inkDrafts.js';

/** A camera original as a data URL. Past this the picture as it was sent is kept instead. */
export const MAX_PHOTO_DRAFT_CHARS = 6_000_000;
export const MAX_ANSWER_CHARS = 2000;
const MAX_AGE_MS = 21 * 86400000;
const COALESCE_MS = 350;

const idFor = (questionId, who) => `${who}:photo:${questionId}`;
const isPicture = value => typeof value === 'string' && /^data:image\/[a-z0-9.+-]+;base64,/i.test(value);

let pending = new Map();       // id → row waiting to be written
let timer = null;
let inFlight = Promise.resolve();
const refused = new Set();     // ids whose last write the store refused
let hooked = false;

function hookFlush() {
  if (hooked || typeof window === 'undefined') return;
  hooked = true;
  try {
    window.addEventListener?.('pagehide', () => { flushPhotoDrafts(); });
    document?.addEventListener?.('visibilitychange', () => { if (document.visibilityState === 'hidden') flushPhotoDrafts(); });
  } catch { /* the coalesce timer still writes */ }
}

/** What is kept of the card's Photo state. Everything else is dropped. */
export function photoDraftPayload({ photo, transcript = null, answer = '', answerSource = null, engine = null, confidence = null, reduced = false } = {}) {
  return {
    photo: isPicture(photo) ? photo : null,
    transcript: transcript && Array.isArray(transcript.lines) ? transcript : null,
    answer: String(answer ?? '').slice(0, MAX_ANSWER_CHARS),
    answerSource: answerSource === 'proposed' || answerSource === 'student' ? answerSource : null,
    engine: typeof engine === 'string' ? engine.slice(0, 160) : null,
    confidence: Number.isFinite(Number(confidence)) ? Number(confidence) : null,
    reduced: reduced === true
  };
}
const signature = payload => JSON.stringify(photoDraftPayload(payload));

/**
 * Queue the Photo state of a question for writing. Returns false when the
 * picture is not one this store keeps (no picture, or larger than the limit):
 * the caller says "not saved" and keeps the work on screen.
 */
export function savePhotoDraft(questionId, state, meta = {}) {
  if (!questionId) return false;
  const payload = photoDraftPayload(state);
  if (!payload.photo || payload.photo.length > MAX_PHOTO_DRAFT_CHARS) return false;
  const who = inkDraftProfileId();
  const id = idFor(questionId, who);
  hookFlush();
  pending.set(id, {
    id, pid: who, kind: 'photo', questionId: String(questionId),
    label: String(meta.label || '').slice(0, 120), savedAt: Date.now(), ...payload
  });
  if (timer === null) timer = setTimeout(() => { flushPhotoDrafts(); }, COALESCE_MS);
  return true;
}

/** Write every queued row now. Resolves when the writes have settled. */
export function flushPhotoDrafts() {
  if (timer !== null) { clearTimeout(timer); timer = null; }
  if (!pending.size) return inFlight;
  const batch = pending;
  pending = new Map();
  inFlight = inFlight.then(async () => {
    for (const row of batch.values()) {
      try { await put(INK_DRAFT_STORE, row); refused.delete(row.id); } catch { refused.add(row.id); }
    }
  });
  return inFlight;
}

/**
 * Whether exactly this Photo state is durably kept. The only thing a "Saved on
 * this device" claim may rest on: the queued write is flushed, the row is read
 * back through a FRESH IndexedDB connection (never the queue, never the handle
 * that wrote it) and compared with what is on screen. Resolves, never rejects:
 * { saved: true } or { saved: false, reason: 'superseded' | 'write' | 'read' |
 * 'missing' | 'mismatch' }.
 */
export async function confirmPhotoDraftSaved(questionId, state) {
  if (!questionId) return { saved: false, reason: 'missing' };
  const who = inkDraftProfileId();
  const id = idFor(questionId, who);
  const expected = signature(state);
  try { await flushPhotoDrafts(); } catch { return { saved: false, reason: 'write' }; }
  if (pending.has(id)) return { saved: false, reason: 'superseded' };
  if (refused.has(id)) return { saved: false, reason: 'write' };
  let row;
  try { row = await getFresh(INK_DRAFT_STORE, id); } catch { return { saved: false, reason: 'read' }; }
  if (!row || typeof row !== 'object' || row.pid !== who || row.kind !== 'photo') return { saved: false, reason: 'missing' };
  return signature(row) === expected ? { saved: true } : { saved: false, reason: 'mismatch' };
}

/** The kept Photo state of this question for this profile, or null. */
export async function readPhotoDraft(questionId) {
  if (!questionId) return null;
  const who = inkDraftProfileId();
  const id = idFor(questionId, who);
  let row = pending.get(id) || null;
  if (!row) {
    await inFlight;
    try { row = await get(INK_DRAFT_STORE, id); } catch { row = null; }
  }
  if (!row || typeof row !== 'object' || row.pid !== who || row.kind !== 'photo' || !isPicture(row.photo)) return null;
  if (!row.savedAt || Date.now() - row.savedAt > MAX_AGE_MS) {
    try { await del(INK_DRAFT_STORE, id); } catch { /* expired either way */ }
    return null;
  }
  return photoDraftPayload(row);
}

/** Submitted, revealed or taken off the page: nothing of it stays on the device. */
export async function clearPhotoDraft(questionId) {
  if (!questionId) return;
  const id = idFor(questionId, inkDraftProfileId());
  pending.delete(id);
  refused.delete(id);
  await inFlight;
  try { await del(INK_DRAFT_STORE, id); } catch { /* nothing kept */ }
}
