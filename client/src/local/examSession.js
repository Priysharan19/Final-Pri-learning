// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Exam session authority — the clock, the autosave and the
// moment a paper is finalised.
//
// Both exam backends (local/indiaExamBackend.js for CBSE/JEE/IOQM papers and
// local/backend.js for the legacy practice paper) store a paper as one row in
// the `exams` store. This module owns the rules every such row obeys while it
// is being sat, so the two backends cannot drift apart:
//
//   · THE DEADLINE IS A TIMESTAMP. It is written once, when the paper starts
//     (`startedAt` + `durationMin`), as an absolute `deadlineAt`. Nothing ever
//     counts it down. A reload, a backgrounded tab, a killed app or a device
//     that slept through the last ten minutes all read the same instant back,
//     so a crash is never extra time. A paper stored before this existed gets
//     its deadline from `createdAt` on first read — the most conservative
//     reading of when it began.
//
//   · RESPONSES ARE SAVED TO THE DEVICE STORE, NOT TO THE PAGE. The room
//     autosaves answers, working, per-question time and handwriting strokes
//     through POST /exams/:id/responses. Those writes are refused once the
//     deadline has passed or the paper is finalised, so nothing a student does
//     after time is up can reach the paper.
//
//   · THE CLOCK ONLY MOVES FORWARD. Every read, save and submit records the
//     latest time it has seen on the row (`latestSeenAt`). A device clock that
//     is wound back is corrected by a forward-only offset (`clockOffsetMs`):
//     the paper resumes from the latest time seen and real time elapsed after
//     the rollback still counts, so rolling the clock back can neither reopen
//     an expired paper nor buy more time. The frozen record notes it.
//
//   · THE MARK INPUTS ARE DECIDED HERE. A submit that arrives inside the
//     deadline, or within SUBMIT_GRACE_MS (5 seconds) after it — the time the
//     deadline's own automatic submit needs to land — marks what it carries. A submit that arrives later — the app relaunched an hour
//     after time ran out, or a late request — marks only what was autosaved
//     before the deadline, never what it carries.
//
//   · FINALISATION FREEZES. The paper's version, the exact responses marked,
//     who finalised it and when are written into `final` in the same put as the
//     score. A replay of the same submission (same `submissionKey`) returns that
//     frozen result instead of marking again; any other resubmission is refused
//     by the backend as before.
//
// Handwriting is stored as the student's strokes plus the text the recogniser
// transcribed. Recognition is answer-blind: nothing in this module, or in the
// room that feeds it, ever passes a question's expected answer to a reader.
// ─────────────────────────────────────────────────────────────────────────────
import { sanitizeText } from '../lib/sanitize.js';

/** How long after the deadline a submit may still carry its own responses. */
export const SUBMIT_GRACE_MS = 5000;

const MAX_ANSWER = 4000;
const MAX_WORKING = 8000;
const MAX_KEYS = 240;
const MAX_STROKES = 600;
const MAX_POINTS = 8000;   // keeps one question's autosave inside the gateway's node budget
const MAX_LINES = 40;

function examError(message, status, code) {
  return Object.assign(new Error(message), { status, code });
}

const finite = v => typeof v === 'number' && Number.isFinite(v);
const durationMs = exam => Math.max(1, Number(exam?.durationMin) || 60) * 60000;

/**
 * The time this paper is at: the device's "now", never earlier than the latest
 * time the paper has already seen. A clock wound back is recorded, and read as
 * the latest time seen, so it cannot reopen an expired paper or add time.
 */
export function observeClock(exam, now = Date.now()) {
  // The paper's time is the device time plus a correction (`clockOffsetMs`)
  // that is only ever increased. When the device reads earlier than a time the
  // paper has already seen, the correction grows by exactly the gap, so the
  // paper resumes from where it was — and every millisecond the device clock
  // advances AFTER the rollback still counts toward the deadline. A rollback
  // freezes nothing; it is simply undone.
  const offset = finite(exam?.clockOffsetMs) ? exam.clockOffsetMs : 0;
  let at = now + offset;
  const seen = finite(exam?.latestSeenAt) ? exam.latestSeenAt : null;
  if (seen !== null && at < seen) {
    exam.clockRollbacks = (Number(exam.clockRollbacks) || 0) + 1;
    exam.clockOffsetMs = offset + (seen - at);
    at = seen;
  }
  exam.latestSeenAt = at;
  return at;
}

/**
 * Give an exam row its start and deadline if it does not have them yet, and
 * move its latest-seen time forward. Returns true when the row changed and
 * needs writing back.
 */
export function ensureExamClock(exam, now = Date.now()) {
  if (!exam) return false;
  // A finalised paper's clock is history; reading it changes nothing.
  const before = `${exam.latestSeenAt}:${exam.clockRollbacks}:${exam.clockOffsetMs}`;
  if (!exam.finishedAt) now = observeClock(exam, now);
  let changed = before !== `${exam.latestSeenAt}:${exam.clockRollbacks}:${exam.clockOffsetMs}`;
  if (!finite(exam.startedAt)) {
    exam.startedAt = finite(exam.createdAt) ? exam.createdAt : now;
    changed = true;
  }
  if (!finite(exam.deadlineAt)) {
    exam.deadlineAt = exam.startedAt + durationMs(exam);
    changed = true;
  }
  return changed;
}

/** Start a brand-new paper's clock at `now`. */
export function startExamClock(exam, now = Date.now()) {
  exam.latestSeenAt = now;
  exam.startedAt = now;
  exam.deadlineAt = now + durationMs(exam);
  return exam;
}

export const deadlinePassed = (exam, now = Date.now()) =>
  finite(exam?.deadlineAt) && now >= exam.deadlineAt;

/** Which top-level question a response key belongs to: `qid`, `qid::a`, `qid::a::or`, `qid::or`. */
const questionOfKey = key => String(key).split('::')[0];

function allowedKeys(exam) {
  return new Set((exam?.questionIds || []).map(String));
}

function cleanTextMap(map, allowed, max) {
  const out = {};
  if (!map || typeof map !== 'object' || Array.isArray(map)) return out;
  let n = 0;
  for (const [key, value] of Object.entries(map)) {
    if (n >= MAX_KEYS) break;
    if (!allowed.has(questionOfKey(key)) || key.length > 160) continue;
    if (value === null || value === undefined) continue;
    const text = sanitizeText(value, max);
    if (!text) continue;
    out[key] = text;
    n++;
  }
  return out;
}

function cleanTimes(map, allowed) {
  const out = {};
  if (!map || typeof map !== 'object' || Array.isArray(map)) return out;
  for (const [key, value] of Object.entries(map)) {
    if (!allowed.has(String(key))) continue;
    const ms = Number(value);
    if (Number.isFinite(ms) && ms > 0) out[key] = Math.min(Math.round(ms), 24 * 3600000);
  }
  return out;
}

const round = (v, places) => {
  const f = 10 ** places;
  return Math.round(Number(v) * f) / f;
};

/**
 * Strokes as the canvas reports them, reduced to what redraws and re-reads
 * them — position and time — in the wire shape the gateway's key budget
 * allows: each point is `[x, y, t]`, not an object. Pressure, width and tilt
 * are not kept for an exam autosave; the recogniser reads geometry.
 */
export function compactStrokes(strokes) {
  const out = [];
  let points = 0;
  for (const stroke of Array.isArray(strokes) ? strokes.slice(0, MAX_STROKES) : []) {
    const pts = [];
    for (const p of Array.isArray(stroke?.points) ? stroke.points : []) {
      if (points >= MAX_POINTS) break;
      const x = Number(Array.isArray(p) ? p[0] : p?.x);
      const y = Number(Array.isArray(p) ? p[1] : p?.y);
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
      const t = Number(Array.isArray(p) ? p[2] : p?.t);
      pts.push(Number.isFinite(t) ? [round(x, 1), round(y, 1), round(t, 3)] : [round(x, 1), round(y, 1)]);
      points++;
    }
    if (pts.length) out.push({ points: pts });
    if (points >= MAX_POINTS) break;
  }
  return out;
}

/** The canvas shape back from the compact one: `{ points: [{x, y, t}] }`. */
export function expandStrokes(strokes) {
  return (Array.isArray(strokes) ? strokes : []).map(st => ({
    points: (Array.isArray(st?.points) ? st.points : []).map(p => (Array.isArray(p)
      ? (p.length > 2 ? { x: p[0], y: p[1], t: p[2] } : { x: p[0], y: p[1] })
      : { x: p?.x, y: p?.y, ...(p?.t !== undefined ? { t: p.t } : {}) }))
  }));
}

function cleanInk(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const strokes = compactStrokes(value.strokes);
  const lines = (Array.isArray(value.lines) ? value.lines : []).slice(0, MAX_LINES)
    .map(l => sanitizeText(l, 400));
  return {
    strokes,
    lines,
    answerLine: sanitizeText(value.answerLine, 400),
    engine: sanitizeText(value.engine, 60) || null,
    // Which strokes the saved lines were read from (a content signature, no
    // content): lets a reload show the transcript without reading again, and
    // tells a transcript of earlier writing from a current one.
    readSig: /^[0-9a-z:]{3,48}$/.test(String(value.readSig || '')) ? String(value.readSig) : null
  };
}

/**
 * Autosave. Merges what the room sent into the row's `responses`. Answers,
 * working and times are sent whole and replace what was there; ink is sent
 * only for the questions whose writing changed and is merged key by key.
 */
export function saveExamResponses(exam, body = {}, now = Date.now()) {
  if (exam.finishedAt) throw examError('This paper has been submitted — it can no longer change.', 409, 'EXAM_FINALISED');
  ensureExamClock(exam, now);
  now = exam.latestSeenAt;
  if (deadlinePassed(exam, now)) throw examError('Time is up on this paper — nothing more can be saved to it.', 409, 'EXAM_DEADLINE_PASSED');
  const allowed = allowedKeys(exam);
  const prior = exam.responses || {};
  const next = {
    answers: body.answers !== undefined ? cleanTextMap(body.answers, allowed, MAX_ANSWER) : (prior.answers || {}),
    workings: body.workings !== undefined ? cleanTextMap(body.workings, allowed, MAX_WORKING) : (prior.workings || {}),
    times: body.times !== undefined ? cleanTimes(body.times, allowed) : (prior.times || {}),
    modes: prior.modes || {},
    inks: { ...(prior.inks || {}) },
    cur: Number.isInteger(Number(body.cur)) ? Math.max(0, Math.min((exam.questionIds || []).length - 1, Number(body.cur))) : (prior.cur || 0),
    rev: (Number(prior.rev) || 0) + 1,
    savedAt: now
  };
  if (body.modes && typeof body.modes === 'object' && !Array.isArray(body.modes)) {
    const modes = {};
    for (const [key, mode] of Object.entries(body.modes)) {
      if (allowed.has(questionOfKey(key)) && (mode === 'ink' || mode === 'type')) modes[key] = mode;
    }
    next.modes = modes;
  }
  if (body.inks && typeof body.inks === 'object' && !Array.isArray(body.inks)) {
    for (const [key, value] of Object.entries(body.inks).slice(0, MAX_KEYS)) {
      if (!allowed.has(questionOfKey(key))) continue;
      const ink = cleanInk(value);
      if (!ink || !ink.strokes.length) delete next.inks[key];
      else next.inks[key] = ink;
    }
  }
  exam.responses = next;
  // `now` is the paper's time, so the room can correct a wound-back device
  // clock without a reload.
  return { savedAt: now, now, rev: next.rev, deadlineAt: exam.deadlineAt };
}

/**
 * What a submit is marked on. Inside the deadline (and its grace) the
 * submission's own answers stand, falling back to the autosave for anything
 * it did not carry; after it, only the autosave written before the deadline.
 */
export function examMarkingInputs(exam, body = {}, now = Date.now()) {
  ensureExamClock(exam, now);
  now = exam.latestSeenAt;
  const allowed = allowedKeys(exam);
  const saved = exam.responses || {};
  const inTime = now <= exam.deadlineAt + SUBMIT_GRACE_MS;
  const pick = (field, clean) => (inTime && body[field] !== undefined && body[field] !== null)
    ? clean(body[field])
    : (saved[field] || {});
  const answers = pick('answers', m => cleanTextMap(m, allowed, MAX_ANSWER));
  const workings = pick('workings', m => cleanTextMap(m, allowed, MAX_WORKING));
  const times = pick('times', m => cleanTimes(m, allowed));
  const elapsed = Math.max(0, Math.min(now, exam.deadlineAt) - exam.startedAt);
  const ms = inTime && Number.isFinite(Number(body.ms)) && Number(body.ms) > 0 ? Number(body.ms) : elapsed;
  return {
    answers, workings, times, ms,
    source: inTime ? 'submission' : 'autosave-before-deadline',
    clockRolledBack: (Number(exam.clockRollbacks) || 0) > 0,
    late: !inTime,
    finalisedBy: inTime ? (body.reason === 'deadline' ? 'deadline' : 'student') : 'deadline'
  };
}

// ── Paper version ────────────────────────────────────────────────────────────

function stable(value) {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${stable(value[k])}`).join(',')}}`;
  }
  return JSON.stringify(value ?? null);
}

/**
 * A short, stable fingerprint of what the paper asks and how it is marked —
 * each question's payload and marking grid, in paper order. Question ids are
 * left out so a restored paper (whose ids are re-minted) keeps its version.
 */
export function paperFingerprint(rows) {
  let h = 0x811c9dc5;
  const text = stable((rows || []).map(r => [r?.payload ?? null, r?.examMarking ?? null]));
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return `pv1-${h.toString(16).padStart(8, '0')}-${(rows || []).length}`;
}

/** Write the frozen record of a finalised paper onto its row. */
export function freezeExam(exam, { inputs, paperVersion, submissionKey = null, now = Date.now() }) {
  // `now` is already the paper's time (the caller read it through observeClock).
  const inks = exam.responses?.inks || {};
  exam.final = {
    submittedAt: now,
    finalisedBy: inputs.finalisedBy,
    late: inputs.late,
    inputSource: inputs.source,
    clockRolledBack: !!inputs.clockRolledBack,
    submissionKey: typeof submissionKey === 'string' ? submissionKey.slice(0, 100) : null,
    paperVersion,
    startedPaperVersion: exam.paperVersion || null,
    paperVersionChanged: !!exam.paperVersion && exam.paperVersion !== paperVersion,
    deadlineAt: exam.deadlineAt,
    startedAt: exam.startedAt,
    responses: { answers: { ...inputs.answers }, workings: { ...inputs.workings }, times: { ...inputs.times } },
    // What the reader transcribed from each handwritten answer, kept with the
    // strokes so the review can show the student their own writing.
    inks: Object.fromEntries(Object.entries(inks).map(([k, v]) => [k, { strokes: v.strokes, lines: v.lines, answerLine: v.answerLine, engine: v.engine }]))
  };
  // The draft is gone: the frozen record is the only copy from here on.
  delete exam.responses;
  return exam.final;
}

/** True when this submit is a replay of the one that finalised the paper. */
export function isReplayOf(exam, body = {}) {
  return !!exam?.finishedAt && !!exam?.final?.submissionKey
    && typeof body.submissionKey === 'string' && body.submissionKey === exam.final.submissionKey;
}

/** The clock and saved responses the room reads back. */
export function examSessionView(exam, now = Date.now()) {
  ensureExamClock(exam, now);
  if (!exam.finishedAt && finite(exam.latestSeenAt)) now = exam.latestSeenAt;
  const finished = !!exam.finishedAt;
  return {
    startedAt: exam.startedAt,
    deadlineAt: exam.deadlineAt,
    now,
    remainingMs: finished ? 0 : Math.max(0, exam.deadlineAt - now),
    expired: !finished && deadlinePassed(exam, now),
    finalised: finished,
    responses: finished ? null : (exam.responses || null),
    final: finished && exam.final ? {
      submittedAt: exam.final.submittedAt,
      finalisedBy: exam.final.finalisedBy,
      late: exam.final.late,
      paperVersion: exam.final.paperVersion,
      inks: exam.final.inks || {}
    } : null
  };
}
