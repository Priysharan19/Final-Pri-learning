// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the Exam Desk's page state, as pure functions (F4 spec §2, §3)
//
// The desk page holds: the attempt as the server last sent it, the student's
// edits the server has not confirmed (`pending`, per question) and the clock
// presses it has not received (`intents`, in order). These functions are the
// rules for moving between them; DeskPage.jsx only wires them to the screen.
// client/test/desk-ui-check.mjs runs them in Node.
//
// Nothing here is, or can become, a mark: a question has `done`, `flagged`, a
// note and a time, all the student's own.
// ─────────────────────────────────────────────────────────────────────────────
import { MS_MAX, NOTE_MAX, applyIntent, readEvents, readQuestions } from '../engine/deskClock.js';

// What the server's note rule refuses (deskClock.js validNote): control
// characters other than tab and line breaks. A paste from a word processor can
// carry one (a vertical tab for a soft line break); it is dropped as it is
// typed, so one stray character can never block every later save.
const NOTE_CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g;
export const cleanNote = text => String(text ?? '').replace(NOTE_CONTROL, '').slice(0, NOTE_MAX);

const BLANK = Object.freeze({ done: false, flagged: false, note: '', noteRev: 0, ms: 0 });
export const entryOf = (questions, q) => ({ ...BLANK, ...(questions?.[q] || {}) });
const FIELDS = ['done', 'flagged', 'note', 'noteRev', 'ms'];
const sendable = change => Object.fromEntries(FIELDS.filter(k => change[k] !== undefined).map(k => [k, change[k]]));
const same = (a, b) => FIELDS.every(k => a?.[k] === b?.[k]);

/** The questions on screen: the server's, with the unconfirmed edits laid over them. */
export function overlay(serverQuestions, pending, questionCount) {
  const out = { ...readQuestions(serverQuestions, questionCount) };
  for (const [q, change] of Object.entries(pending || {})) {
    if (Number(q) > questionCount) continue;
    const base = entryOf(out, q);
    out[q] = { ...base, ...sendable(change), ms: Math.max(base.ms, change.ms ?? 0) };
  }
  return out;
}

/**
 * One edit by the student, to one question: { done }, { flagged }, { note } or
 * { ms }. Returns the new questions and pending. A note's revision goes up
 * with every edit, so the server can tell a newer note from an older one.
 */
export function editQuestion(questions, pending, q, change) {
  const cur = entryOf(questions, q);
  const next = { ...cur };
  const out = { ...sendable(pending?.[q] || {}) };
  if (change.done !== undefined) { next.done = change.done === true; out.done = next.done; }
  if (change.flagged !== undefined) { next.flagged = change.flagged === true; out.flagged = next.flagged; }
  if (change.note !== undefined) {
    next.note = cleanNote(change.note);
    next.noteRev = cur.noteRev + 1;
    out.note = next.note; out.noteRev = next.noteRev;
  }
  if (change.ms !== undefined) { next.ms = Math.min(MS_MAX, Math.max(cur.ms, Math.round(change.ms))); out.ms = next.ms; }
  return { questions: { ...questions, [q]: next }, pending: { ...pending, [q]: out } };
}

/** What to send: every pending question's changed fields. */
export const changesOf = pending => Object.fromEntries(Object.entries(pending || {}).map(([q, change]) => [q, sendable(change)]).filter(([, c]) => Object.keys(c).length));

/** Pending edits read back from the device cache: unsent work from an earlier visit. */
export const fromCache = pending => Object.fromEntries(Object.entries(pending || {}).map(([q, change]) => [q, { ...sendable(change), cached: true }]));

/**
 * After the server answered a save of `sent` with { questions, stale }.
 *   · a question not edited since it was sent is confirmed: the server's entry
 *     is now the one on screen;
 *   · a note the server refused as stale (a newer one exists from another
 *     device): if it was typed in this visit it is sent again above the
 *     server's revision — it is the most recent writing; if it came from the
 *     device cache of an earlier visit, the server's newer note stands;
 *   · a question edited again while the save was in flight stays pending.
 */
export function settleSave(questions, pending, sent, reply) {
  const nextQuestions = { ...questions };
  const nextPending = { ...pending };
  const stale = new Set((reply?.stale || []).map(String));
  for (const [q, sentChange] of Object.entries(sent)) {
    const server = { ...BLANK, ...(reply?.questions?.[q] || {}) };
    const now = nextPending[q];
    const untouched = now && same(sendable(now), sentChange);
    if (stale.has(q) && now?.note !== undefined && !(untouched && now.cached) && now.note !== server.note) {
      const noteRev = server.noteRev + 1;
      nextPending[q] = { ...sendable(now), noteRev };
      nextQuestions[q] = { ...entryOf(nextQuestions, q), noteRev };
    } else if (untouched) {
      delete nextPending[q];
      nextQuestions[q] = server;
    } else if (now?.note !== undefined && now.noteRev <= server.noteRev) {
      nextPending[q] = { ...sendable(now), noteRev: server.noteRev + 1 };
      nextQuestions[q] = { ...entryOf(nextQuestions, q), noteRev: server.noteRev + 1 };
    }
  }
  return { questions: nextQuestions, pending: nextPending };
}

/** The server's own questions after it confirmed a save: its entries replace the kept ones. */
export function confirmQuestions(serverQuestions, confirmed) {
  const out = { ...(serverQuestions || {}) };
  for (const [q, entry] of Object.entries(confirmed || {})) { if (entry) out[q] = entry; else delete out[q]; }
  return out;
}

/**
 * The event log as it would stand if the queued clock presses had been
 * received when they were pressed. FOR DISPLAY ONLY ("offline estimate"): the
 * server stamps each press with its own time when it actually arrives.
 */
export function projectEvents(paper, events, intents) {
  let log = readEvents(events);
  for (const press of intents || []) {
    const applied = applyIntent(paper, log, press.intent, press.at, { early: press.early === true });
    if (applied.events) log = applied.events;
  }
  return log;
}

/** The navigator's groups for a frozen paper: its sections, or one group. */
export function groupsOf(paper, formatOf = () => '', oneLabel = 'Questions') {
  const sections = Array.isArray(paper?.sections) && paper.sections.length ? paper.sections : [{ firstQuestion: 1, lastQuestion: paper?.questionCount || 1 }];
  const one = sections.length === 1;
  return sections.map(s => ({ label: one ? oneLabel : String(s.label || ''), format: formatOf(s.kind), start: s.firstQuestion, end: s.lastQuestion }));
}

export const sectionOf = (groups, q) => groups.find(g => q >= g.start && q <= g.end) || null;

/**
 * The time ledger of a sitting: figures only. Where the time went, how long it
 * was paused, how far past the allotment it ran. No judgement is derived.
 */
export function timeLedger(paper, clock, questions, groups) {
  const timed = [];
  for (let q = 1; q <= paper.questionCount; q++) {
    const ms = entryOf(questions, q).ms;
    if (ms > 0) timed.push({ q, ms });
  }
  return {
    allottedMs: paper.workingMinutes * 60000,
    workingMs: clock.elapsedWorkingMs || 0,
    readingMs: clock.elapsedReadingMs || 0,
    pausedMs: clock.pausedMs || 0,
    overtimeMs: clock.overtimeMs || 0,
    sections: groups.length > 1 ? groups.map(g => ({ label: g.label, ms: timed.filter(x => x.q >= g.start && x.q <= g.end).reduce((n, x) => n + x.ms, 0) })) : [],
    longest: [...timed].sort((a, b) => b.ms - a.ms || a.q - b.q).slice(0, 3)
  };
}

/** The next flagged question after `q`, wrapping round; null when none is flagged. */
export function nextFlagged(questions, questionCount, q) {
  for (let step = 1; step <= questionCount; step++) {
    const at = ((q - 1 + step) % questionCount) + 1;
    if (entryOf(questions, at).flagged) return at;
  }
  return null;
}
