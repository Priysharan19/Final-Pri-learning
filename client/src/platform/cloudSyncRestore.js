// Pri Learning · cloud restore — remote learning events into the local stores
//
// A student who signs into an existing account on a new device used to get
// their profile and bookmarks back and nothing else: syncWorker cached the other
// devices' practice events in the `device` store and never wrote them into the
// ratings/attempts/reviews/activity stores the product reads. This module is
// where a pulled append-only learning event becomes local learning state.
//
// Rules this keeps:
//   · The deterministic engine decides. A remote event carries facts about one
//     answer (which idea, how hard, right or wrong, how much help, when). The
//     rating, the FSRS review schedule and the streak calendar are re-derived
//     here with the same engine functions resolve() in backend.js uses — the
//     event's own `ratingAfter` is recorded on the attempt row as history and
//     never written into a rating row.
//   · Exactly once. Every restored row carries a key derived from the cloud
//     event id (`<pid>:remote:<eventId>`), and the attempt is written with an
//     exclusive `add` inside one atomic batch with the rating/review/activity
//     puts. A second pull of the same event collides on that key and changes
//     nothing. The caller filters this device's own events first; a reinstall
//     under a new device id that pulls its own old events lands here with
//     empty stores, which is exactly a restore.
//   · Privacy boundary unchanged. Only the append-only learning kinds the
//     generic replica already carries are applied (practice, exam, Rush,
//     Match). Shared class/assignment records never enter through here.

import { add, atomicBatch, byIndex, get, put } from '../local/idb.js';
import { blindHash } from '../local/auth.js';
import { dayKey, timezoneOf } from '../lib/locale.js';
import { START_RATING, gradeFor, scheduleReview, updateRating, xpFor } from '../engine/adaptive.js';

// backend.js's RECENT_WINDOW: the rolling right/wrong window a rating row keeps.
const RECENT_WINDOW = 8;
const ID = /^[A-Za-z0-9._:-]{1,160}$/;
const LEARNING_MODES = new Set(['practice', 'review', 'task']);
const GAME_MODES = new Set(['rush', 'match']);
// Only a canonical server-created event may alter mastery, reviews, XP or
// resolved attempt history. Old client-supplied practice-progress and
// practice-attempt remain visible as archived sync data but are not marks.
const PRACTICE_KINDS = new Set(['graded-attempt']);

export const RESTORABLE_EVENT_KINDS = Object.freeze(['graded-attempt', 'exam-attempt', 'rush-history', 'match-history']);

function plain(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value) &&
    (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
}

const num = (value, fallback = 0) => (Number.isFinite(Number(value)) ? Number(value) : fallback);
const clampInt = (value, lo, hi, fallback) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(lo, Math.min(hi, Math.round(n)));
};
const safeId = value => (ID.test(String(value ?? '')) ? String(value) : null);

/** The local row key one cloud event owns. Stable, so a re-pull is a no-op. */
export function restoredRowId(pid, eventId) {
  return `${pid}:remote:${eventId}`;
}

/**
 * True for a local row that came from the cloud rather than from this device.
 * The full rescan must never republish one: the account already holds the
 * event it came from, and a second copy under this device's id would count the
 * same answer twice on every other device.
 */
export function isRestoredRow(pid, row) {
  if (typeof row?.remoteEventId === 'string') return true;
  return String(row?.id ?? '').startsWith(`${pid}:remote:`);
}

/** When the answer happened: the payload's own clock first, the event's second. */
export function eventTime(event) {
  const created = num(event?.payload?.createdAt, 0);
  if (created > 0) return created;
  const occurred = num(event?.occurredAt, 0);
  return occurred > 0 ? occurred : 0;
}

/**
 * The help an attempt had, in the units updateRating/gradeFor count.
 *
 * resolve() adds the wrong tries already spent to hints and tutor levels. The
 * event payload does not carry the try count, but an attempt filed as
 * `supported` with no hint and no tutor help can only have got there through a
 * spent try — so it is credited one, never zero.
 */
export function effectiveHelp(payload) {
  const hints = Math.max(0, num(payload?.hintsUsed, 0));
  const tutor = Math.max(0, Math.min(3, num(payload?.tutorLevel, 0)));
  const supported = payload?.support === 'supported';
  return { hints, tutor, tries: supported && hints + tutor === 0 ? 1 : 0, help: hints + tutor };
}

function attemptRowFrom(pid, event, at) {
  const p = event.payload;
  const { hints, tutor, tries, help } = effectiveHelp(p);
  return {
    id: restoredRowId(pid, event.id),
    pid,
    questionId: safeId(event.entityId) || restoredRowId(pid, event.id),
    subtopic: safeId(p.subtopic) || 'custom',
    generator: safeId(p.subtopic) || 'custom',
    difficulty: clampInt(p.difficulty, 1, 4, 2),
    ...(typeof p.contentId === 'string' && p.contentId ? {
      contentId: String(p.contentId).slice(0, 200),
      contentVersion: p.contentVersion == null ? null : String(p.contentVersion).slice(0, 40),
      contentHash: typeof p.contentHash === 'string' ? p.contentHash.slice(0, 32) : null
    } : {}),
    correct: p.correct ? 1 : 0,
    // Only a real, server-grader-origin progress event reaches this path.
    // Legacy events missing the two certified numeric fields remain valid
    // historical attempts, but their marks are UNKNOWN, not inferred as
    // zero/full from the boolean correct verdict.
    ...(Number.isInteger(p.marksEarned) && Number.isInteger(p.marksPossible) &&
      p.marksPossible >= 1 && p.marksPossible <= 4 &&
      p.marksEarned >= 0 && p.marksEarned <= p.marksPossible &&
      (p.correct !== true || p.marksEarned === p.marksPossible) &&
      (p.correct !== false || p.marksEarned < p.marksPossible) &&
      (p.revealed !== true || p.marksEarned === 0)
      ? { marksEarned: p.marksEarned, marksPossible: p.marksPossible }
      : {}),
    // The student's written answer never travels through the generic replica.
    answerGiven: '',
    ms: Math.max(0, num(p.ms, 0)),
    hintsUsed: hints,
    mode: String(p.mode || 'practice').slice(0, 30),
    viaInk: !!p.viaInk,
    tutorLevel: tutor,
    support: help || tries ? 'supported' : 'independent',
    evidenceKey: null,
    ratingBefore: Number.isFinite(Number(p.ratingBefore)) ? Number(p.ratingBefore) : null,
    ratingAfter: Number.isFinite(Number(p.ratingAfter)) ? Number(p.ratingAfter) : null,
    createdAt: at,
    remoteEventId: event.id,
    remoteDeviceId: event.deviceId
  };
}

async function alreadyRestored(store, id) {
  return !!(await get(store, id).catch(() => null));
}

/**
 * One practice answer from another device becomes: an attempt row, the rating
 * row the engine derives from it, the review row the engine schedules from it,
 * the activity row for the day it happened and the XP it earned. Returns
 * 'applied' or 'duplicate'.
 */
async function applyPracticeEvent(pid, profile, event, issuedRow = null) {
  // A question this device was issued is recorded under the SAME exactly-once
  // claim its own resolution uses (backend.js resolve()). Whichever of the two
  // writes first wins the exclusive add; the other is a duplicate. So an
  // answer is never counted twice, and one the server marked but this device
  // never wrote (a lost reply, then the student moved on) is not lost either.
  const id = issuedRow
    ? `${pid}:resolved:${await blindHash(`practice-resolution:${issuedRow.id}`)}`
    : restoredRowId(pid, event.id);
  const taken = async () => (issuedRow ? !!(await get('attempts', id).catch(() => null)) : alreadyRestored('attempts', id));
  if (await taken()) return 'duplicate';
  const p = event.payload;
  const at = eventTime(event) || Date.now();
  const attempt = { ...attemptRowFrom(pid, event, at), ...(issuedRow ? { id, questionId: issuedRow.id, serverAttemptId: event.id } : {}) };
  const owner = attempt.subtopic;
  const correct = !!p.correct;
  const mode = attempt.mode;
  const { tries, help } = effectiveHelp(p);
  const effHints = help + tries;
  const isGame = GAME_MODES.has(mode);

  const ops = [{ type: 'add', store: 'attempts', value: attempt }];
  let xp = isGame ? (correct ? 6 : 0) : xpFor(attempt.difficulty, correct, 0, effHints);

  if (!isGame && owner !== 'custom') {
    const st = (await get('ratings', `${pid}:${owner}`).catch(() => null))
      || { key: `${pid}:${owner}`, pid, subtopic: owner, rating: START_RATING, attempts: 0, correct: 0, last_at: null, dp: {}, traps: {}, recent: [] };
    const ratingNext = {
      ...st, key: `${pid}:${owner}`, pid, subtopic: owner,
      rating: updateRating(num(st.rating, START_RATING), num(st.attempts, 0), attempt.difficulty, correct, effHints),
      attempts: num(st.attempts, 0) + 1,
      correct: num(st.correct, 0) + (correct ? 1 : 0),
      last_at: Math.max(num(st.last_at, 0), at),
      dp: plain(st.dp) ? st.dp : {},
      traps: plain(st.traps) ? st.traps : {},
      recent: [correct ? 1 : 0, ...(Array.isArray(st.recent) ? st.recent : [])].slice(0, RECENT_WINDOW)
    };
    ops.push({ type: 'put', store: 'ratings', value: ratingNext });

    if (LEARNING_MODES.has(mode)) {
      const key = `${pid}:${owner}`;
      const rev = await get('reviews', key).catch(() => null);
      const grade = gradeFor({ correct, hintsUsed: help, tries, ms: attempt.ms, difficulty: attempt.difficulty });
      let reviewNext = null;
      if (rev) reviewNext = { ...rev, key, pid, subtopic: owner, ...scheduleReview(rev, grade, at) };
      else if (ratingNext.attempts >= 3) reviewNext = { key, pid, subtopic: owner, ...scheduleReview(null, grade, at) };
      if (reviewNext) ops.push({ type: 'put', store: 'reviews', value: reviewNext });
    }
  }

  const tz = timezoneOf(profile || 'nsw');
  const date = dayKey(at, tz);
  const activityKey = `${pid}:${date}`;
  const activity = (await get('activity', activityKey).catch(() => null))
    || { key: activityKey, pid, date, questions: 0, correct: 0, xp: 0, ms: 0, predicted: null };
  ops.push({
    type: 'put', store: 'activity',
    value: {
      ...activity, key: activityKey, pid, date,
      questions: num(activity.questions, 0) + 1,
      correct: num(activity.correct, 0) + (correct ? 1 : 0),
      xp: num(activity.xp, 0) + xp,
      ms: num(activity.ms, 0) + attempt.ms
    }
  });

  try {
    await atomicBatch(ops);
  } catch (error) {
    // The exclusive `add` is the exactly-once claim: a collision means another
    // pull (or this device's own resolution) already recorded it, and the
    // whole batch was rolled back.
    if (await taken()) return 'duplicate';
    throw error;
  }
  return { applied: true, xp };
}

async function applyExamEvent(pid, event) {
  const p = event.payload;
  // An exam another device started and never finished cannot be resumed here:
  // the paper itself does not travel. Finished results are history worth keeping.
  if (p.state !== 'finished') return 'unsupported';
  const id = restoredRowId(pid, event.id);
  if (await alreadyRestored('exams', id)) return 'duplicate';
  const at = eventTime(event) || Date.now();
  try {
    await add('exams', {
      id, pid,
      title: String(p.title || '').slice(0, 120),
      year: Number.isFinite(Number(p.year)) ? Number(p.year) : null,
      questionIds: [],
      createdAt: at,
      finishedAt: num(p.finishedAt, 0) || at,
      score: p.score == null ? null : num(p.score, 0),
      total: p.total == null ? null : num(p.total, 0),
      indiaExam: plain(p.indiaExam) ? { ...p.indiaExam } : null,
      remoteEventId: event.id,
      remoteDeviceId: event.deviceId
    });
  } catch (error) {
    if (await alreadyRestored('exams', id)) return 'duplicate';
    throw error;
  }
  return { applied: true, xp: 0 };
}

async function applyRunEvent(pid, event, store, fields) {
  const id = restoredRowId(pid, event.id);
  if (await alreadyRestored(store, id)) return 'duplicate';
  const row = { id, pid, remoteEventId: event.id, remoteDeviceId: event.deviceId };
  for (const field of fields) if (event.payload[field] !== undefined) row[field] = event.payload[field];
  row.createdAt = num(row.createdAt, 0) || eventTime(event) || Date.now();
  try {
    await add(store, row);
  } catch (error) {
    if (await alreadyRestored(store, id)) return 'duplicate';
    throw error;
  }
  return { applied: true, xp: 0 };
}

/**
 * Add XP to the profile row as it is at write time. Browsers with Web Locks
 * (every shipped target) take the same lock backend.js's withProfileRow takes,
 * so a concurrent answer's XP and this restore's XP cannot roll each other back.
 */
async function creditXp(pid, xp) {
  if (!xp) return;
  const work = async () => {
    const row = await get('profiles', pid).catch(() => null);
    if (!row) return;
    await put('profiles', { ...row, xp: num(row.xp, 0) + xp });
  };
  const locks = globalThis.navigator?.locks;
  if (locks?.request) return locks.request(`pri-learning:profile-row:${pid}`, work);
  return work();
}

/**
 * Apply remote learning events to this profile's local stores, idempotently.
 *
 * `events` are pull-envelope events (validated by syncContract) that did NOT
 * originate on this device. They are replayed in the order the answers
 * happened, so the engine sees the same sequence the student produced.
 */
// How long a grade request may still be running before its server event is
// taken as abandoned by this device.
const GRADE_IN_FLIGHT_MS = 2 * 60 * 1000;
const gradeInFlight = row => !row.answered && !!row.pendingGrade && Date.now() - num(row.pendingGrade.at, 0) < GRADE_IN_FLIGHT_MS;

/**
 * Record server-marked attempts that were deferred because this device's own
 * submit was in flight, once it is clear that submit never recorded them.
 * Run on every sync pass, with or without new events.
 */
export async function reconcileDeferredGrades(pid) {
  let applied = 0;
  const profile = await get('profiles', pid).catch(() => null);
  if (!profile) return applied;
  for (const row of await byIndex('questions', 'pid', pid)) {
    if (!row.deferredGrade) continue;
    if (!row.answered && Date.now() - num(row.deferredGrade.at, 0) < GRADE_IN_FLIGHT_MS && gradeInFlight(row)) continue;
    const event = row.deferredGrade.event;
    const { deferredGrade: _dropped, ...rest } = row;
    if (!row.answered && plain(event) && event.kind === 'graded-attempt') {
      const outcome = await applyPracticeEvent(pid, profile, { ...event, payload: plain(event.payload) ? event.payload : {} }, row);
      if (outcome && outcome !== 'duplicate' && outcome !== 'unsupported') applied++;
    }
    await put('questions', rest);
  }
  return applied;
}

export async function applyRemoteLearningEvents(pid, events) {
  const summary = { applied: 0, duplicates: 0, unsupported: 0, byKind: {}, xp: 0 };
  const list = (Array.isArray(events) ? events : []).filter(event => plain(event) && plain(event.payload || {}) && safeId(event.id));
  if (!list.length) return summary;
  const profile = await get('profiles', pid).catch(() => null);
  if (!profile) return summary;
  // Server-owned events carry the reserved "server-grader" device identity,
  // even when the student's OWN device received and committed the grade.
  // Hence the normal sync deviceId filter cannot prevent double-awarding.
  // Our durable attempt row links the original local resolution to the exact
  // server attempt ID, without trusting a client-provided mark or event body.
  const locallyCommitted = new Set();
  // A question this device was issued is recorded by this device, in the same
  // write as its resolution, and by nothing else. Matching only on the attempt
  // id raced with a submit in flight: a pull landing between the server's
  // commit and the local write imported the same attempt a second time. The
  // question row carries the server question id before any grade is sent, so
  // it is already here for every event the server can have for it.
  const issuedHere = new Map();
  if (list.some(event => event.kind === 'graded-attempt')) {
    for (const attempt of await byIndex('attempts', 'pid', pid)) {
      if (typeof attempt.serverAttemptId === 'string' && safeId(attempt.serverAttemptId)) {
        locallyCommitted.add(attempt.serverAttemptId);
      }
    }
    for (const question of await byIndex('questions', 'pid', pid)) {
      if (typeof question.serverQuestionId === 'string' && question.serverQuestionId) issuedHere.set(question.serverQuestionId, question);
    }
  }

  list.sort((a, b) => (eventTime(a) - eventTime(b)) || (num(a.serverCursor) - num(b.serverCursor)) || String(a.id).localeCompare(String(b.id)));
  for (const raw of list) {
    const event = { ...raw, payload: plain(raw.payload) ? raw.payload : {} };
    let outcome;
    if (PRACTICE_KINDS.has(event.kind)) {
      const issuedRow = issuedHere.get(String(event.entityId || '')) || null;
      if (locallyCommitted.has(event.id) || issuedRow?.answered) {
        // Already committed locally in the same atomic batch as the source
        // question resolution. Cache/sync is still safe; progress is not.
        summary.duplicates++;
        continue;
      }
      if (issuedRow && gradeInFlight(issuedRow)) {
        // The submit that produced this event is still running here and will
        // record it itself. Keep the event on the row: if that write never
        // happens, reconcileDeferredGrades() records it on a later pass.
        await put('questions', { ...(await get('questions', issuedRow.id).catch(() => issuedRow) || issuedRow), deferredGrade: { event, at: Date.now() } });
        summary.duplicates++;
        continue;
      }
      // A client cannot publish graded-attempt through /sync/push: it is
      // excluded from server APPEND_EVENT. The server alone writes it, using
      // the reserved device identity in the same DB transaction as the grade.
      outcome = event.deviceId === 'server-grader' &&
          event.payload?.questionId === event.entityId &&
          event.payload?.attemptId === event.id &&
          (event.payload?.correct === true || event.payload?.correct === false) &&
          // A server-committed Reveal is an incorrect, supported attempt too;
          // local resolve() already records it, so restore must not omit it.
          (event.payload?.revealed !== true || event.payload?.correct === false) &&
          safeId(event.payload?.subtopic)
        ? await applyPracticeEvent(pid, profile, event, issuedRow) : 'unsupported';
    }
    else if (event.kind === 'exam-attempt') outcome = await applyExamEvent(pid, event);
    else if (event.kind === 'rush-history') outcome = await applyRunEvent(pid, event, 'rushRuns', ['score', 'correct', 'total', 'bestCombo', 'createdAt']);
    else if (event.kind === 'match-history') outcome = await applyRunEvent(pid, event, 'matchRuns', ['won', 'playerScore', 'rivalScore', 'rival', 'ms', 'createdAt']);
    else outcome = 'unsupported';

    if (outcome === 'duplicate') summary.duplicates++;
    else if (outcome === 'unsupported') summary.unsupported++;
    else {
      summary.applied++;
      summary.xp += outcome.xp || 0;
      summary.byKind[event.kind] = (summary.byKind[event.kind] || 0) + 1;
    }
  }
  if (summary.xp) await creditXp(pid, summary.xp);
  return summary;
}

/** How many of this profile's local rows came from the cloud rather than this device. */
export async function restoredRowCounts(pid) {
  const out = {};
  for (const store of ['attempts', 'exams', 'rushRuns', 'matchRuns']) {
    const rows = await byIndex(store, 'pid', pid).catch(() => []);
    out[store] = rows.filter(row => typeof row?.remoteEventId === 'string').length;
  }
  return out;
}
