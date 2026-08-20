// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Draft store — durable scratch space for work a screen is still
// holding in React state. A thrown render unmounts the whole subtree and takes
// that state with it, so anything a screen expects to see again after a crash
// has to be written here first.
// localStorage rather than IndexedDB on purpose: writes are synchronous, so a
// draft saved inside a keystroke handler is already on disk even if the very
// next render is the one that throws. Records are small by contract — answer
// maps and typed working, never strokes or images.
// Keys: pri.draft.<profileId>.<scope>.<id>
// ─────────────────────────────────────────────────────────────────────────────
import { currentPid } from '../local/store.js';

const PREFIX = 'pri.draft.';
const VERSION = 1;
const MAX_AGE_MS = 21 * 86400000;
const COALESCE_MS = 400;

let activePid = null;
let pending = new Map();
let timer = null;
let flushHooked = false;

const pid = () => activePid || currentPid() || 'anon';
const keyFor = (scope, id) => `${PREFIX}${pid()}.${scope}.${id}`;

function store() {
  try { return window.localStorage; } catch { return null; }
}

function record(scope, id, data, meta) {
  return {
    v: VERSION, scope: String(scope), id: String(id), data,
    label: meta.label || '', note: meta.note || '', path: meta.path || '',
    savedAt: Date.now()
  };
}

/** Every live draft under `prefix`, dropping anything corrupt or expired. */
function scan(prefix) {
  const ls = store();
  const out = [];
  if (!ls) return out;
  const keys = [];
  for (let i = 0; i < ls.length; i++) {
    const k = ls.key(i);
    if (k && k.startsWith(prefix)) keys.push(k);
  }
  const now = Date.now();
  for (const k of keys) {
    let rec = null;
    try { rec = JSON.parse(ls.getItem(k)); } catch { rec = null; }
    if (!rec || rec.v !== VERSION || !rec.savedAt || now - rec.savedAt > MAX_AGE_MS) {
      try { ls.removeItem(k); } catch { }
      continue;
    }
    out.push({ key: k, ...rec });
  }
  return out;
}

/** Last-resort room-maker: expired drafts are already gone, so drop the eldest. */
function evictOldest() {
  const ls = store();
  const rows = scan(PREFIX);
  if (!ls || !rows.length) return;
  const oldest = rows.reduce((a, b) => (a.savedAt <= b.savedAt ? a : b));
  try { ls.removeItem(oldest.key); } catch { }
}

function writeRecord(key, rec) {
  const ls = store();
  if (!ls) return false;
  const json = JSON.stringify(rec);
  try { ls.setItem(key, json); return true; }
  catch {
    evictOldest();
    try { ls.setItem(key, json); return true; } catch { return false; }
  }
}

function hookFlush() {
  if (flushHooked || typeof window === 'undefined') return;
  flushHooked = true;
  window.addEventListener('pagehide', flushDrafts);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushDrafts();
  });
}

// ── Public API ───────────────────────────────────────────────────────────────

/** Retarget the namespace on profile switch — one student never sees another's. */
export function setDraftProfile(id) {
  flushDrafts();
  activePid = id || null;
}

/** Write now. Use for milestones (page leave, submit, question change). */
export function saveDraft(scope, id, data, meta = {}) {
  const key = keyFor(scope, id);
  pending.delete(key);
  return writeRecord(key, record(scope, id, data, meta));
}

/**
 * Write soon, coalescing bursts. Use for keystrokes: at most one write every
 * COALESCE_MS, flushed early when the tab hides or the page goes away.
 */
export function queueDraft(scope, id, data, meta = {}) {
  hookFlush();
  pending.set(keyFor(scope, id), record(scope, id, data, meta));
  if (timer === null) timer = setTimeout(flushDrafts, COALESCE_MS);
}

export function flushDrafts() {
  if (timer !== null) { clearTimeout(timer); timer = null; }
  if (!pending.size) return;
  const batch = pending;
  pending = new Map();
  for (const [key, rec] of batch) writeRecord(key, rec);
}

/** The saved payload, or null. Reads through a not-yet-flushed queued write. */
export function readDraft(scope, id) {
  const key = keyFor(scope, id);
  const held = pending.get(key);
  if (held) return held.data;
  const ls = store();
  if (!ls) return null;
  let rec = null;
  try { rec = JSON.parse(ls.getItem(key)); } catch { rec = null; }
  if (!rec || rec.v !== VERSION || !rec.savedAt) return null;
  if (Date.now() - rec.savedAt > MAX_AGE_MS) { try { ls.removeItem(key); } catch { } return null; }
  return rec.data;
}

/** When this draft was last written, or 0 — for "saved 40 seconds ago" copy. */
export function draftSavedAt(scope, id) {
  const key = keyFor(scope, id);
  const held = pending.get(key);
  if (held) return held.savedAt;
  const ls = store();
  if (!ls) return 0;
  try { return JSON.parse(ls.getItem(key))?.savedAt || 0; } catch { return 0; }
}

export function clearDraft(scope, id) {
  const key = keyFor(scope, id);
  pending.delete(key);
  const ls = store();
  if (ls) { try { ls.removeItem(key); } catch { } }
}

/** Metadata for this profile's drafts, newest first. Payloads stay on disk. */
export function listDrafts() {
  return scan(`${PREFIX}${pid()}.`)
    .map(r => ({ scope: r.scope, id: r.id, label: r.label, note: r.note, path: r.path, savedAt: r.savedAt }))
    .sort((a, b) => b.savedAt - a.savedAt);
}

export function clearDrafts() {
  const ls = store();
  if (!ls) return;
  for (const r of scan(`${PREFIX}${pid()}.`)) {
    pending.delete(r.key);
    try { ls.removeItem(r.key); } catch { }
  }
}

// ── Call sites — for the pass that owns ExamRoom.jsx and QuestionCard.jsx ────
// Nothing writes drafts yet, so the recovery card is honest about finding none.
// Wiring is three lines per screen; the shapes below are the contract this
// store and ErrorBoundary's copy were built against.
//
// ExamRoom.jsx — a whole timed paper lives in `answers`/`workings` until one
// api.post at submit; that is the state a crash destroys.
//   1. after the exam loads and BEFORE the first taking-view render, rehydrate:
//        const d = readDraft('exam', id);
//        if (d && !r.exam.finishedAt) {
//          setAnswers(d.answers || {}); setWorkings(d.workings || {});
//          setCur(d.cur || 0); startRef.current = d.startedAt || Date.now();
//        }
//   2. in an effect on [answers, workings, cur] while `!result`:
//        queueDraft('exam', id, { answers, workings, cur, startedAt: startRef.current }, {
//          label: exam.title,
//          note: `${answeredCount} of ${exam.questions.length} answered`,
//          path: `/exams/${id}`
//        });
//   3. immediately after a successful submit(): clearDraft('exam', id).
//      Also clear when the loaded exam already has `finishedAt`.
//
// QuestionCard.jsx — the typed answer and working of the question on screen:
//   queueDraft('question', question.id, { typed, working }, {
//     label: question.subtopicName, note: 'Answer in progress', path: '/practice'
//   });
//   clearDraft('question', question.id) once the attempt is marked.
//
// Rules: keep payloads JSON-small (no ink strokes, no data URLs), always clear
// on successful submit, and never write a draft for a finished attempt — a
// stale draft that resurrects a submitted paper is worse than no draft at all.
