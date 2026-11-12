// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the Exam Desk clock (ADR-0002 §8, plan F4)
//
// The one examination system has two modes. This module is the clock of the
// UNMARKED mode, the Exam Desk: a student sits a library paper (plan F1) under
// reading and working time, with notes and flags, and nothing is ever marked.
// It is pure and shared: the server (server/platform/desk.js) decides with it,
// and the client (plan F4b) only displays what it derives.
//
// THE SERVER STAMPS EVERY TIME. An attempt's clock is a log of events
// {t, at}, where `at` is always the server's own clock when the event was
// accepted. The device sends intents ("pause"), never a time, a deadline or a
// remaining time. Phase and remaining time are a function of the log and of
// `now` alone, so a reload, a slept iPad or a changed device clock cannot move
// them.
//
// Semantics are those of the prithagoras-web desk (session-core.mjs at
// Priysharan19/prithagoras-web 46e1476), restated over an event log:
//   · deadline-based, not a countdown: a running phase ends at
//     `start + remaining-at-start`, and remaining is always `endsAt − now`;
//   · reading time ends by itself into `ready`; working time never starts by
//     itself;
//   · pause freezes the remaining time; resume restarts it unchanged;
//   · a zero-reading paper's "begin reading" begins working time;
//   · a finished attempt never restarts.
// One deliberate change (owner decision F4 Q5): when WORKING time reaches zero
// the attempt does not close itself. The clock goes on counting overtime and
// the student closes the paper. There is no strict mode yet.
//
// Nothing here is a mark, a score or a result: the paper's printed total
// (`marks`) is carried only so pacing can be stated as a fact later (F4b).
// ─────────────────────────────────────────────────────────────────────────────

export const CLOCK_VERSION = 1;
export const PHASES = Object.freeze(['idle', 'reading', 'ready', 'working', 'finished']);
/** What a device may ask the clock to do. */
export const INTENTS = Object.freeze(['begin-reading', 'begin-working', 'pause', 'resume', 'finish']);
/** Every event the log may hold: the intents, plus the end of reading the server records when it was due. */
export const EVENT_TYPES = Object.freeze([...INTENTS, 'reading-ended']);
/** The desk's caps (prithagoras-web durationConfig, questionGroups). */
export const MAX_QUESTIONS = 200;
export const MAX_WORKING_MINUTES = 600;
export const MAX_READING_MINUTES = 90;
export const DEFAULT_WORKING_MINUTES = 60;
export const MAX_EVENTS = 2000;

const MINUTE = 60000;
const clampInt = (v, lo, hi) => Math.min(hi, Math.max(lo, Math.round(v)));
const positive = v => v !== null && v !== undefined && v !== '' && Number.isFinite(Number(v)) && Number(v) > 0;
const nonNegative = v => v !== null && v !== undefined && v !== '' && Number.isFinite(Number(v)) && Number(v) >= 0;

/**
 * Working and reading minutes of a paper, with the desk's clamps (port of
 * `durationConfig`). Reads a library resource (durationMinutes) or a
 * prithagoras-web resource (workingMinutes, or a duration like "3 hours").
 */
export function durationOf(resource) {
  const parsed = /^(\d+(?:\.\d+)?)\s*(?:hours?|hrs?|h)\b/i.exec(String(resource?.duration || ''));
  const given = positive(resource?.workingMinutes) ? Number(resource.workingMinutes)
    : positive(resource?.durationMinutes) ? Number(resource.durationMinutes) : null;
  const working = given ?? (parsed ? Number(parsed[1]) * 60 : DEFAULT_WORKING_MINUTES);
  const reading = nonNegative(resource?.readingMinutes) ? Number(resource.readingMinutes) : 0;
  return {
    workingMinutes: clampInt(working, 1, MAX_WORKING_MINUTES),
    readingMinutes: clampInt(reading, 0, MAX_READING_MINUTES)
  };
}

/** How many questions a paper has, within 1..200 (null when it does not say). */
export function questionCountOf(resource) {
  const n = Number.parseInt(resource?.questionCount ?? resource?.questions, 10);
  return Number.isInteger(n) && n >= 1 ? Math.min(MAX_QUESTIONS, n) : null;
}

/**
 * A paper's question groups (port of `questionGroups`). Sections in the
 * library's shape ({label, firstQuestion, lastQuestion, kind, marks}) or the
 * prithagoras-web shape ({label, start, end, format, marks}) are accepted when
 * they cover 1..N exactly once; anything else is one group, "Questions".
 */
export function questionGroups(resource) {
  const count = questionCountOf(resource) ?? 1;
  const sections = Array.isArray(resource?.sections) ? resource.sections : [];
  const read = s => ({
    label: String(s?.label || 'Section').slice(0, 60),
    firstQuestion: s?.firstQuestion ?? s?.start,
    lastQuestion: s?.lastQuestion ?? s?.end,
    kind: String(s?.kind ?? s?.format ?? '').slice(0, 60),
    marks: Number.isInteger(s?.marks) && s.marks >= 0 ? s.marks : null
  });
  const one = [{ label: 'Questions', firstQuestion: 1, lastQuestion: count, kind: '', marks: null }];
  const groups = sections.map(read);
  const valid = groups.length > 0 && groups.every(g => Number.isInteger(g.firstQuestion) && Number.isInteger(g.lastQuestion)
    && g.firstQuestion >= 1 && g.lastQuestion >= g.firstQuestion && g.lastQuestion <= count);
  if (!valid) return one;
  const covered = new Set();
  for (const g of groups) {
    for (let q = g.firstQuestion; q <= g.lastQuestion; q++) {
      if (covered.has(q)) return one;
      covered.add(q);
    }
  }
  return covered.size === count ? groups : one;
}

/**
 * The paper an attempt is sat against, frozen when it starts (paper_json):
 * an edit to the library resource later cannot move notes onto other question
 * numbers. Null when the resource cannot be sat at the desk.
 */
export function paperConfigOf(resource) {
  const questionCount = questionCountOf(resource);
  if (!resource || typeof resource.id !== 'string' || !questionCount) return null;
  const { workingMinutes, readingMinutes } = durationOf(resource);
  return {
    resourceId: resource.id,
    resourceUpdatedAt: Number.isFinite(Number(resource.updatedAt)) ? Number(resource.updatedAt) : null,
    title: String(resource.title || '').slice(0, 300),
    questionCount,
    marks: Number.isInteger(resource.marks) && resource.marks >= 0 ? resource.marks : null,
    readingMinutes,
    workingMinutes,
    sections: questionGroups({ ...resource, questionCount })
  };
}

/** The events of a stored log that are well formed, in order; never trusts more than that. */
export function readEvents(raw) {
  const list = Array.isArray(raw?.events) ? raw.events : Array.isArray(raw) ? raw : [];
  const out = [];
  let last = -Infinity;
  for (const e of list.slice(0, MAX_EVENTS)) {
    if (!e || !EVENT_TYPES.includes(e.t) || !Number.isSafeInteger(e.at) || e.at < last) continue;
    out.push(e.t === 'finish' ? { t: e.t, at: e.at, reason: 'student' } : { t: e.t, at: e.at });
    last = e.at;
  }
  return out;
}

function fold(paper, events, now) {
  const READ = paper.readingMinutes * MINUTE;
  const WORK = paper.workingMinutes * MINUTE;
  const s = {
    phase: 'idle', running: false, endsAt: null, left: null, runFrom: null, pausedSince: null,
    elapsedReadingMs: 0, elapsedWorkingMs: 0, pausedMs: 0,
    readingEndedAt: null, readingEndRecorded: false, finishedAt: null, finishReason: null,
    // Working time left (negative: overtime) when the paper was closed in working time.
    leftAtFinish: null
  };
  const stop = t => {
    if (s.running) {
      if (s.phase === 'reading') s.elapsedReadingMs += t - s.runFrom;
      if (s.phase === 'working') s.elapsedWorkingMs += t - s.runFrom;
    } else if (s.pausedSince !== null) {
      s.pausedMs += t - s.pausedSince;
    }
    s.running = false; s.runFrom = null; s.pausedSince = null;
  };
  // Reading time ends by itself, at its own deadline (not when anyone looked).
  const settle = t => {
    if (s.phase === 'reading' && s.running && t >= s.endsAt) {
      const at = s.endsAt;
      stop(at);
      s.phase = 'ready'; s.endsAt = null; s.left = null; s.readingEndedAt = at;
    }
  };
  const start = (phase, t, ms) => {
    stop(t);
    s.phase = phase; s.running = true; s.runFrom = t; s.endsAt = t + ms; s.left = null;
  };
  for (const e of events) {
    settle(e.at);
    if (s.phase === 'finished') continue;
    if (e.t === 'reading-ended') { if (s.phase === 'ready' && s.readingEndedAt === e.at) s.readingEndRecorded = true; continue; }
    if (e.t === 'begin-reading' && s.phase === 'idle') {
      if (READ === 0) start('working', e.at, WORK); else start('reading', e.at, READ);
    } else if (e.t === 'begin-working' && ['idle', 'reading', 'ready'].includes(s.phase)) {
      start('working', e.at, WORK);
    } else if (e.t === 'pause' && s.running && ['reading', 'working'].includes(s.phase)) {
      s.left = s.endsAt - e.at;
      stop(e.at);
      s.endsAt = null; s.pausedSince = e.at;
    } else if (e.t === 'resume' && !s.running && ['reading', 'working'].includes(s.phase) && s.left !== null) {
      stop(e.at);
      s.running = true; s.runFrom = e.at; s.endsAt = e.at + s.left; s.left = null;
    } else if (e.t === 'finish' && ['idle', 'reading', 'ready', 'working'].includes(s.phase)) {
      s.leftAtFinish = s.phase === 'working' ? (s.running ? s.endsAt - e.at : s.left) : null;
      stop(e.at);
      s.phase = 'finished'; s.endsAt = null; s.left = null; s.finishedAt = e.at; s.finishReason = 'student';
    }
  }
  settle(now);
  return { s, READ, WORK };
}

/**
 * Where an attempt's clock stands at `now` (the server's time, or the
 * display's estimate of it). Pure: the same log and `now` give the same answer.
 *
 *   phase          idle | reading | ready | working | finished
 *   running        whether time is passing in this phase
 *   remainingMs    time left in this phase (never negative)
 *   phaseEndsAt    when the running phase ends, or null
 *   overtimeMs     working time used past the allotment (it keeps counting)
 *   elapsed…Ms     reading / working time actually run
 *   pausedMs       total time paused (an attempt with pauses was not continuous)
 */
export function deriveClock(paper, events, now) {
  const { s, WORK } = fold(paper, readEvents(events), now);
  const running = s.running;
  const run = running ? now - s.runFrom : 0;
  let remainingMs = 0;
  let overtimeMs = 0;
  if (s.phase === 'reading') remainingMs = Math.max(0, running ? s.endsAt - now : s.left);
  else if (s.phase === 'working') {
    const signed = running ? s.endsAt - now : s.left;
    remainingMs = Math.max(0, signed);
    overtimeMs = Math.max(0, -signed);
  } else if (s.phase === 'finished') overtimeMs = s.leftAtFinish === null ? 0 : Math.max(0, -s.leftAtFinish);
  else remainingMs = WORK; // idle, ready: the working allotment still to come
  return {
    phase: s.phase,
    running,
    remainingMs,
    phaseEndsAt: running ? s.endsAt : null,
    overtimeMs,
    elapsedReadingMs: s.elapsedReadingMs + (s.phase === 'reading' ? run : 0),
    elapsedWorkingMs: s.elapsedWorkingMs + (s.phase === 'working' ? run : 0),
    pausedMs: s.pausedMs + (!running && s.pausedSince !== null ? now - s.pausedSince : 0),
    readingEndedAt: s.readingEndedAt,
    finishedAt: s.finishedAt,
    finishReason: s.finishReason
  };
}

/** Which intents the clock accepts from each phase (`finish` early needs `early: true`). */
function allowed(clock, intent, early) {
  const { phase, running } = clock;
  switch (intent) {
    case 'begin-reading': return phase === 'idle';
    case 'begin-working': return ['idle', 'reading', 'ready'].includes(phase);
    case 'pause': return running && ['reading', 'working'].includes(phase);
    case 'resume': return !running && ['reading', 'working'].includes(phase);
    case 'finish': return phase === 'working' || (early === true && ['reading', 'ready'].includes(phase));
    default: return false;
  }
}

/**
 * Apply a device's intent at the server's `now`. Returns the new log, or the
 * refusal: DESK_FINISHED (the attempt is closed — never restarted),
 * DESK_INTENT_NOT_ALLOWED (not from this phase). An end of reading that fell
 * due before `now` is recorded first, at the moment it was due.
 */
export function applyIntent(paper, events, intent, now, { early = false } = {}) {
  if (!INTENTS.includes(intent)) return { refused: 'DESK_INTENT_NOT_ALLOWED' };
  const log = readEvents(events);
  const at = Math.max(now, log.length ? log[log.length - 1].at : now);
  const clock = deriveClock(paper, log, at);
  if (clock.phase === 'finished') return { refused: 'DESK_FINISHED' };
  if (!allowed(clock, intent, early)) return { refused: 'DESK_INTENT_NOT_ALLOWED' };
  const next = [...log];
  const { s } = fold(paper, log, at);
  if (s.readingEndedAt !== null && !s.readingEndRecorded) next.push({ t: 'reading-ended', at: s.readingEndedAt });
  if (next.length >= MAX_EVENTS) return { refused: 'DESK_INTENT_NOT_ALLOWED' };
  // A zero-reading paper's "begin reading" begins working time, and the log says so.
  const t = intent === 'begin-reading' && paper.readingMinutes === 0 ? 'begin-working' : intent;
  next.push(t === 'finish' ? { t, at, reason: 'student' } : { t, at });
  return { events: next };
}

/** HH:MM:SS, rounded up to the second shown (port of `formatTime`). */
export function formatClock(ms) {
  const seconds = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(seconds / 3600), m = Math.floor((seconds % 3600) / 60), sec = seconds % 60;
  return [h, m, sec].map(n => String(n).padStart(2, '0')).join(':');
}

// ── Questions: flags, done and notes ────────────────────────────────────────
export const NOTE_MAX = 5000;
export const MS_MAX = 24 * 60 * 60 * 1000;
const NOTE_CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;
/** A note a student may keep: text up to 5,000 characters, no control characters but tab and line breaks. */
export const validNote = s => typeof s === 'string' && s.length <= NOTE_MAX && !NOTE_CONTROL.test(s);
const QUESTION_KEY = /^[1-9]\d{0,2}$/;

/** One question's stored entry, or null when it holds nothing. */
function readEntry(e) {
  if (!e || typeof e !== 'object' || Array.isArray(e)) return null;
  const out = {
    done: e.done === true,
    flagged: e.flagged === true,
    note: validNote(e.note) ? e.note : '',
    noteRev: Number.isSafeInteger(e.noteRev) && e.noteRev >= 0 ? e.noteRev : 0,
    ms: Number.isSafeInteger(e.ms) && e.ms >= 0 ? Math.min(MS_MAX, e.ms) : 0
  };
  return out.done || out.flagged || out.note || out.noteRev || out.ms ? out : null;
}

/**
 * The questions of a stored record (or a device cache) that are well formed
 * and on this paper: keys 1..N only, invalid entries dropped (port of
 * `restoreSession`'s rules).
 */
export function readQuestions(raw, questionCount) {
  const out = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  for (const [key, value] of Object.entries(raw)) {
    if (!QUESTION_KEY.test(key) || Number(key) > questionCount) continue;
    const entry = readEntry(value);
    if (entry) out[key] = entry;
  }
  return out;
}

/** Done, flagged and noted tallies of a paper's questions — counts of the student's own marks on the page, never a score. */
export function questionTallies(questions, questionCount) {
  let done = 0, flagged = 0, notes = 0;
  for (let q = 1; q <= questionCount; q++) {
    const e = questions?.[q];
    if (!e) continue;
    if (e.done) done++;
    if (e.flagged) flagged++;
    if (e.note) notes++;
  }
  return { done, flagged, notes };
}
