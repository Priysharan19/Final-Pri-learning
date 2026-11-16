// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · reading a prithagoras-web Exam Desk export (plan F4)
//
// A student who practised on the Prithagoras website's desk
// (priysharan19.github.io/prithagoras-web/desk.html) can bring that practice
// into their account. The website keeps it in its own origin's localStorage,
// which no other origin can read, so it moves the only honest way: the student
// presses the desk's own "Export attempt" and gives this app the file
// (exportVersion 1, desk.js exportSession at prithagoras-web 46e1476). Owner
// decision F4 Q2: file import only.
//
// Pure and shared: the device reads the file for its preview, and the server
// reads it again and decides (server/platform/desk.js). It lives in
// client/src/engine because that is the only client source the server's
// runtime image carries (Dockerfile).
//
// WHAT IS NEVER BROUGHT ACROSS: the timer. `session.phase`, `running`,
// `remainingTimeSeconds` (and a stored `deadline`/`remainingMs`, should a file
// carry them) are a device clock on another site; importing them would invent
// a sitting. The plan keeps only the export's own date and phase name, for the
// student's reference. `counts` are recomputed, never trusted. The file holds
// no answers and the plan has nowhere to put a mark.
// ─────────────────────────────────────────────────────────────────────────────
import { NOTE_MAX, validNote } from './deskClock.js';

export const EXPORT_VERSION = 1;
export const MAX_EXPORT_BYTES = 256 * 1024;
const RESOURCE_ID = /^[a-z0-9-]{1,120}$/;
const QUESTION_KEY = /^[1-9]\d{0,2}$/;
const STATUSES = ['done', 'flagged'];
const PHASES = ['idle', 'reading', 'ready', 'working', 'finished'];

const plain = v => !!v && typeof v === 'object' && !Array.isArray(v);
const refuse = (refused, detail) => ({ refused, detail });

/** The library resource id an export names, or null. The caller looks it up in its own edition's library. */
export function exportResourceId(obj) {
  const id = plain(obj) && plain(obj.resource) ? obj.resource.id : null;
  return typeof id === 'string' && RESOURCE_ID.test(id) ? id : null;
}

/** Size of an export as JSON text, in UTF-8 bytes. */
function bytesOf(obj) {
  try {
    const text = JSON.stringify(obj);
    return typeof TextEncoder === 'function' ? new TextEncoder().encode(text).length : text.length * 3;
  } catch { return Infinity; }
}

/**
 * Read one desk export against the library resource it names (`resource`:
 * the resource as this edition's library serves it, or null when the library
 * does not offer it). Returns `{ ok: true, plan }` or `{ refused, detail }`.
 *
 * Refusals (codes are the API's):
 *   DESK_IMPORT_NOT_A_DESK_FILE  not an object, or over 256 KB
 *   DESK_IMPORT_VERSION          not exportVersion 1
 *   DESK_IMPORT_UNKNOWN_PAPER    no such paper in THIS edition's library (the
 *                                other edition's paper is the same answer)
 *   DESK_IMPORT_PAPER_CHANGED    made for a different question count
 *   DESK_IMPORT_MALFORMED        a status or note outside the paper, or not text
 *   DESK_IMPORT_EMPTY            nothing to bring across
 */
export function readDeskExport(obj, resource) {
  if (!plain(obj) || bytesOf(obj) > MAX_EXPORT_BYTES) return refuse('DESK_IMPORT_NOT_A_DESK_FILE', 'This isn\'t an Exam Desk export.');
  if (obj.exportVersion !== EXPORT_VERSION) return refuse('DESK_IMPORT_VERSION', 'This export is from a newer or older desk we can\'t read.');
  const resourceId = exportResourceId(obj);
  if (!resourceId || !resource || resource.id !== resourceId || resource.type !== 'paper') {
    return refuse('DESK_IMPORT_UNKNOWN_PAPER', 'This paper isn\'t in your library.');
  }
  const total = Number(resource.questionCount);
  if (!Number.isInteger(total) || total < 1 || total > 200 || !plain(obj.exam) || obj.exam.questions !== total) {
    return refuse('DESK_IMPORT_PAPER_CHANGED', 'This export was made for a different version of the paper.');
  }
  const statuses = obj.statuses === undefined ? {} : obj.statuses;
  const notes = obj.notes === undefined ? {} : obj.notes;
  if (!plain(statuses) || !plain(notes)) return refuse('DESK_IMPORT_MALFORMED', 'The statuses or notes in this export can\'t be read.');
  const inRange = key => QUESTION_KEY.test(key) && Number(key) <= total;
  const questions = {};
  for (const [key, value] of Object.entries(statuses)) {
    if (!inRange(key) || !STATUSES.includes(value)) return refuse('DESK_IMPORT_MALFORMED', `Question ${String(key).slice(0, 8)} has a status this paper can't hold.`);
    questions[key] = { ...(questions[key] || {}), [value]: true };
  }
  for (const [key, value] of Object.entries(notes)) {
    if (!inRange(key) || !validNote(value)) return refuse('DESK_IMPORT_MALFORMED', `The note for question ${String(key).slice(0, 8)} can't be read (at most ${NOTE_MAX} characters of text).`);
    if (value.trim()) questions[key] = { ...(questions[key] || {}), note: value };
  }
  const keys = Object.keys(questions).sort((a, b) => Number(a) - Number(b));
  if (!keys.length) return refuse('DESK_IMPORT_EMPTY', 'There\'s nothing in this export to bring across.');
  const ordered = {};
  for (const key of keys) {
    const q = questions[key];
    ordered[key] = { done: q.done === true, flagged: q.flagged === true, note: q.note || '' };
  }
  const exportedAt = typeof obj.createdAt === 'string' && Number.isFinite(Date.parse(obj.createdAt)) ? Date.parse(obj.createdAt) : null;
  const phase = plain(obj.session) && PHASES.includes(obj.session.phase) ? obj.session.phase : null;
  return {
    ok: true,
    plan: {
      resourceId,
      title: String(resource.title || ''),
      questionCount: total,
      exportedAt,
      phase,
      questions: ordered,
      tallies: {
        done: keys.filter(k => ordered[k].done).length,
        flagged: keys.filter(k => ordered[k].flagged).length,
        notes: keys.filter(k => ordered[k].note).length
      }
    }
  };
}

/**
 * The canonical text of what an import brings across: the paper, the
 * statuses and the non-empty notes, keys sorted. Its SHA-256 identifies the
 * import, so the same content twice (two devices, a second press) is one
 * record. The export's date, phase and anything of the timer are not part of
 * it.
 */
export function canonicalImport(plan) {
  const statuses = {};
  const notes = {};
  for (const key of Object.keys(plan.questions).sort((a, b) => Number(a) - Number(b))) {
    const q = plan.questions[key];
    if (q.done && q.flagged) statuses[key] = ['done', 'flagged'];
    else if (q.done) statuses[key] = ['done'];
    else if (q.flagged) statuses[key] = ['flagged'];
    if (q.note) notes[key] = q.note;
  }
  return JSON.stringify({ v: 1, resourceId: plan.resourceId, statuses, notes });
}
