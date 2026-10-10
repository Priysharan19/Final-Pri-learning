// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Ink drafts — the handwriting of a question still being
// answered, kept on this device until it has been read and marked.
//
// Handwriting is read only by Pri's server reader (owner decision). A page
// written offline, signed out, or while the reader is down therefore waits:
// the strokes are kept here, the student is told "Saved. It will be read when
// you are back online", and the ink surface reads the page by itself the
// moment the reason goes away. This store is that queue — one row per
// question, in the profile's own sealed IndexedDB store, never in plaintext
// localStorage (review of the earlier draft store: a page of working is the
// student's private work and belongs under the same protection as their
// attempts).
//
//   · `inkDrafts` is a sealed store (local/idb.js SEALED_STORES): with the
//     profile's data key held the strokes are ciphertext at rest; the row
//     keeps only its id and pid in the clear so the index can find it.
//   · One row per (profile, question). Saving coalesces bursts of pen-lifts
//     into one write every COALESCE_MS, flushed early on page-hide, tab-hide
//     and the native shell's background signal.
//   · The row says when it was queued for reading. Reading it is idempotent
//     by construction: the surface reads one stroke signature once
//     (InkAnswer `sentRef`), marks one reading once (QuestionCard
//     `autoMarkedRef` on `readKey`), and the submission itself carries an
//     idempotency key (practiceRecovery.js). The row is cleared when the
//     question is resolved, revealed or discarded.
//   · Never holds the expected answer, a solution, a reading or a mark —
//     strokes only.
// ─────────────────────────────────────────────────────────────────────────────
import { byIndex, del, get, getFresh, put } from './idb.js';
import { currentPid } from './store.js';
import { priNative } from '../platform/native/index.js';

export const INK_DRAFT_STORE = 'inkDrafts';
// A whole page of working is a few tens of kB compacted. Past this the record
// would be a copy of something that should have been submitted; it is not kept.
export const MAX_INK_CHARS = 300_000;
export const MAX_INK_STROKES = 4000;
const COALESCE_MS = 400;
const MAX_AGE_MS = 21 * 86400000;

let activePid = null;
let pending = new Map();        // id → row waiting to be written
let timer = null;
let flushHooked = false;
let inFlight = Promise.resolve();
const refused = new Set();    // ids whose last write the store refused

const pid = () => activePid || safeCurrentPid() || 'anon';
function safeCurrentPid() {
  try { return currentPid(); } catch { return null; }
}
const idFor = (questionId, who = pid()) => `${who}:${questionId}`;
const offlineNow = () => typeof navigator !== 'undefined' && navigator.onLine === false;

/** Integer [x, y] points — the same compact shape a submission carries. */
export function compactStrokes(strokes) {
  return (Array.isArray(strokes) ? strokes : []).slice(0, MAX_INK_STROKES).map(st => ({
    points: (Array.isArray(st?.points) ? st.points : []).map(p => (Array.isArray(p)
      ? [Math.round(Number(p[0]) || 0), Math.round(Number(p[1]) || 0)]
      : [Math.round(Number(p?.x) || 0), Math.round(Number(p?.y) || 0)]))
  })).filter(st => st.points.length);
}

/** Compact strokes back to canvas strokes ({ points: [{ x, y }] }), or null. */
export function expandStrokes(compact) {
  const strokes = compactStrokes(compact);
  if (!strokes.length) return null;
  return strokes.map(st => ({ points: st.points.map(([x, y]) => ({ x, y })) }));
}

function hookFlush() {
  if (flushHooked || typeof window === 'undefined') return;
  flushHooked = true;
  try {
    window.addEventListener?.('pagehide', () => { flushInkDrafts(); });
    document?.addEventListener?.('visibilitychange', () => {
      if (document.visibilityState === 'hidden') flushInkDrafts();
    });
    // Native shells may suspend and then kill a backgrounded app without a
    // pagehide (CP-02), so flush on the shell's own signal too.
    priNative.lifecycle?.on?.(state => {
      if (state === 'background' || state === 'inactive') flushInkDrafts();
    });
  } catch { /* keeping ink is best-effort; the coalesce timer still writes */ }
}

/** Retarget the namespace on profile switch — one student never sees another's. */
export function setInkDraftProfile(id) {
  flushInkDrafts();
  activePid = id || null;
}

/**
 * Keep the handwriting of a question still being answered. Synchronous in its
 * verdict (kept or not), coalesced in its write. Returns false only when the
 * page is too large to keep.
 */
export function saveInkDraft(questionId, strokes, meta = {}) {
  if (!questionId) return false;
  const compact = compactStrokes(strokes);
  const who = pid();
  const id = idFor(questionId, who);
  if (!compact.length) {
    pending.delete(id);
    refused.delete(id);
    inFlight = inFlight.then(() => del(INK_DRAFT_STORE, id)).catch(() => { });
    return true;
  }
  if (JSON.stringify(compact).length > MAX_INK_CHARS) { pending.delete(id); return false; }
  hookFlush();
  const prior = pending.get(id);
  pending.set(id, {
    id, pid: who, questionId: String(questionId),
    strokes: compact,
    label: String(meta.label || '').slice(0, 120),
    savedAt: Date.now(),
    // The moment the page first had to wait for a reader, kept across saves.
    queuedAt: prior?.queuedAt ?? (offlineNow() ? Date.now() : null)
  });
  if (timer === null) timer = setTimeout(() => { flushInkDrafts(); }, COALESCE_MS);
  return true;
}

/** Write every queued row now. Resolves when the writes have settled. */
export function flushInkDrafts() {
  if (timer !== null) { clearTimeout(timer); timer = null; }
  if (!pending.size) return inFlight;
  const batch = pending;
  pending = new Map();
  inFlight = inFlight.then(async () => {
    for (const row of batch.values()) {
      // Storage refused: the ink is still on the page, and the row is noted so
      // confirmInkDraftSaved can say the write failed rather than guess.
      try { await put(INK_DRAFT_STORE, row); refused.delete(row.id); } catch { refused.add(row.id); }
    }
  });
  return inFlight;
}

/**
 * Whether exactly these strokes are durably kept for this question.
 *
 * The only thing a "Saved on this device" claim may rest on: the queued write
 * is flushed, then the row is read back through a fresh IndexedDB connection
 * (idb.js getFresh — not the handle that wrote it, and never the in-memory
 * queue) and compared stroke for stroke. Resolves, never rejects:
 *
 *   { saved: true }
 *   { saved: false, reason: 'superseded' }  newer strokes are queued; ask again for those
 *   { saved: false, reason: 'write' }       the store refused the write
 *   { saved: false, reason: 'read' }        the store could not be read back
 *   { saved: false, reason: 'missing' }     the write was acknowledged but no row is there
 *   { saved: false, reason: 'mismatch' }    a row is there, and it is not this page
 */
export async function confirmInkDraftSaved(questionId, strokes) {
  if (!questionId) return { saved: false, reason: 'missing' };
  const id = idFor(questionId);
  const expected = JSON.stringify(compactStrokes(strokes));
  try { await flushInkDrafts(); } catch { return { saved: false, reason: 'write' }; }
  if (pending.has(id)) return { saved: false, reason: 'superseded' };
  if (refused.has(id)) return { saved: false, reason: 'write' };
  let row;
  try { row = await getFresh(INK_DRAFT_STORE, id); } catch { return { saved: false, reason: 'read' }; }
  if (!row || typeof row !== 'object' || row.pid !== pid() || !Array.isArray(row.strokes)) return { saved: false, reason: 'missing' };
  return JSON.stringify(compactStrokes(row.strokes)) === expected ? { saved: true } : { saved: false, reason: 'mismatch' };
}

async function readRow(questionId) {
  const id = idFor(questionId);
  const held = pending.get(id);
  if (held) return held;
  await inFlight;
  let row = null;
  try { row = await get(INK_DRAFT_STORE, id); } catch { row = null; }
  if (!row || typeof row !== 'object' || row.pid !== pid()) return null;
  if (!row.savedAt || Date.now() - row.savedAt > MAX_AGE_MS) {
    try { await del(INK_DRAFT_STORE, id); } catch { /* expired either way */ }
    return null;
  }
  return row;
}

/** The kept handwriting as canvas strokes, or null. Reads through a queued write. */
export async function readInkDraft(questionId) {
  if (!questionId) return null;
  const row = await readRow(questionId);
  return row ? expandStrokes(row.strokes) : null;
}

/** When the kept page was first queued for reading, or null. */
export async function inkDraftQueuedAt(questionId) {
  const row = questionId ? await readRow(questionId) : null;
  return row?.queuedAt ?? null;
}

/** Mark the kept page as waiting for a reader (offline, signed out, reader down). */
export async function markInkDraftQueued(questionId) {
  const row = questionId ? await readRow(questionId) : null;
  if (!row || row.queuedAt) return;
  const next = { ...row, queuedAt: Date.now() };
  const held = pending.get(row.id);
  if (held) { pending.set(row.id, next); return; }
  try { await put(INK_DRAFT_STORE, next); } catch { /* informational */ }
}

export async function clearInkDraft(questionId) {
  if (!questionId) return;
  const id = idFor(questionId);
  pending.delete(id);
  await inFlight;
  try { await del(INK_DRAFT_STORE, id); } catch { /* nothing kept */ }
}

/**
 * This profile's pages still waiting to be read, newest first — the outbox
 * view. Strokes stay in the store; only what a status line needs comes out.
 */
export async function queuedInkDrafts() {
  await flushInkDrafts();
  let rows = [];
  try { rows = await byIndex(INK_DRAFT_STORE, 'pid', pid()); } catch { rows = []; }
  const now = Date.now();
  return rows
    .filter(r => r && typeof r === 'object' && r.savedAt && now - r.savedAt <= MAX_AGE_MS && Array.isArray(r.strokes) && r.strokes.length)
    .map(r => ({ questionId: String(r.questionId || String(r.id).slice(String(r.pid).length + 1)), label: r.label || '', savedAt: r.savedAt, queuedAt: r.queuedAt ?? null }))
    .sort((a, b) => b.savedAt - a.savedAt);
}
