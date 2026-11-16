// Pri Learning — windowed report figures (GET /report/series) and the History
// filter definitions (POST /history/list). Pure: no store, clock or network;
// the caller passes the profile's answered rows, already reduced to the facts
// below, and `now`.
//
// Every figure is a count or a sum over stored records. Nothing is estimated:
//   · marks come only from the server-certified receipt stored on the row
//     (backend.js certifiedMarksOfRow); a row without one counts as a question
//     answered and nothing else;
//   · "method marks" are the certified marks on the receipt's `working` rows,
//     "accuracy marks" the marks on its `answer` row (server/platform/
//     markRows.js). A receipt without step rows cannot be split, so it adds to
//     the certified totals but to neither split total (`unsplit` counts them);
//   · a repeat (the server's `repeat` finding, or a row re-issued as a repeat)
//     is left out of every figure except `repeats` and days practised — it was
//     sat, so the day stays practised, exactly as the streak rule says
//     (backend.js resolve, store.js streakFor);
//   · game rounds (rush, match) are not marked answers and are left out;
//   · a percentage is null until the window (or chart point) holds at least
//     the evidence floor of certified, non-repeat questions
//     (engine/progressTruth.js PROGRESS_THRESHOLDS).
//
// Windows are calendar days in the profile's timezone, ending today:
//   week  — the 7 local days ending today; chart: one point per day (7).
//   month — the 28 local days ending today (four whole weeks, so it compares
//           like with like against the 28 days before); chart: one point per
//           7-day block (4).
//   term  — no profile records a school term, so "term" is a fixed rolling
//           window: the 91 local days (13 weeks) ending today, named
//           `rolling-13-weeks`; chart: one point per 7-day block (13).
// The previous window is the same number of days immediately before.

import { dayKey } from '../lib/locale.js';
import { PROGRESS_THRESHOLDS, GAME_MODES } from './progressTruth.js';

export const REPORT_PERIODS = Object.freeze({
  week: { days: 7, bucketDays: 1, name: 'rolling-7-days' },
  month: { days: 28, bucketDays: 7, name: 'rolling-28-days' },
  term: { days: 91, bucketDays: 7, name: 'rolling-13-weeks' }
});

/** Floors: a whole window's percentage, and one chart point's. */
export const REPORT_FLOORS = Object.freeze({
  window: PROGRESS_THRESHOLDS.overallAccuracy,
  point: PROGRESS_THRESHOLDS.chapterAccuracy
});

/** The calendar date `n` days after a YYYY-MM-DD key (n may be negative). */
export function addDays(key, n) {
  const [y, m, d] = String(key).split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d) + n * 86400000).toISOString().slice(0, 10);
}

const utc = key => { const [y, m, d] = String(key).split('-').map(Number); return Date.UTC(y, m - 1, d); };
const daysBetween = (a, b) => Math.round((utc(b) - utc(a)) / 86400000);

const pct = (earned, possible, n, floor) =>
  n >= floor && possible > 0 ? Math.round(1000 * earned / possible) / 10 : null;

const isGameRow = r => GAME_MODES.includes(String(r?.mode || ''));
const isRepeatRow = r => r?.marks?.repeat === true || !!r?.repeatOf;

function splitOf(markRows) {
  const rows = Array.isArray(markRows?.rows) ? markRows.rows : null;
  if (!rows || !rows.length) return null;
  const out = { methodEarned: 0, methodPossible: 0, accuracyEarned: 0, accuracyPossible: 0 };
  for (const r of rows) {
    const e = Number(r.earned) || 0; const o = Number(r.outOf) || 0;
    if (r.kind === 'working') { out.methodEarned += e; out.methodPossible += o; }
    else if (r.kind === 'answer') { out.accuracyEarned += e; out.accuracyPossible += o; }
  }
  return out;
}

function emptyTotals() {
  return {
    questions: 0, repeats: 0, certifiedQuestions: 0, marksEarned: 0, marksPossible: 0,
    methodMarksEarned: 0, methodMarksPossible: 0, accuracyMarksEarned: 0, accuracyMarksPossible: 0,
    splitQuestions: 0, unsplit: 0
  };
}

function add(t, r) {
  if (isRepeatRow(r)) { t.repeats += 1; return; }
  t.questions += 1;
  const m = r.marks;
  if (!m) return;
  t.certifiedQuestions += 1;
  t.marksEarned += m.earned; t.marksPossible += m.possible;
  const s = splitOf(m.markRows);
  if (!s || s.methodEarned + s.accuracyEarned !== m.earned) { t.unsplit += 1; return; }
  t.splitQuestions += 1;
  t.methodMarksEarned += s.methodEarned; t.methodMarksPossible += s.methodPossible;
  t.accuracyMarksEarned += s.accuracyEarned; t.accuracyMarksPossible += s.accuracyPossible;
}

function finish(t, floor) {
  return {
    ...t,
    marksPct: pct(t.marksEarned, t.marksPossible, t.certifiedQuestions, floor),
    methodPct: pct(t.methodMarksEarned, t.methodMarksPossible, t.splitQuestions, floor),
    accuracyPct: pct(t.accuracyMarksEarned, t.accuracyMarksPossible, t.splitQuestions, floor)
  };
}

/** Consecutive practised days ending on `endKey` (or the day before, if `endKey` had none). */
export function streakEndingOn(dates, endKey) {
  let cursor = endKey;
  if (!dates.has(cursor)) cursor = addDays(cursor, -1);
  let n = 0;
  while (dates.has(cursor)) { n++; cursor = addDays(cursor, -1); }
  return n;
}

/**
 * @param rows  [{ answeredAt, mode, repeatOf, marks: {earned, possible, repeat, markRows} | null }]
 * @param activeDates  YYYY-MM-DD keys of days with at least one question sat
 */
export function reportSeries({ rows = [], activeDates = [], period = 'week', now = Date.now(), timezone }) {
  const spec = REPORT_PERIODS[period];
  if (!spec) throw Object.assign(new Error('period must be week, month or term'), { status: 400 });
  const today = dayKey(now, timezone);
  const from = addDays(today, -(spec.days - 1));
  const prevTo = addDays(from, -1);
  const prevFrom = addDays(from, -spec.days);
  const dates = new Set(activeDates);

  const cur = emptyTotals(); const prev = emptyTotals();
  const buckets = [];
  for (let i = 0; i < spec.days / spec.bucketDays; i++) {
    const bFrom = addDays(from, i * spec.bucketDays);
    buckets.push({ from: bFrom, to: addDays(bFrom, spec.bucketDays - 1), t: emptyTotals() });
  }
  for (const r of rows) {
    if (isGameRow(r)) continue;
    const day = dayKey(Number(r.answeredAt) || 0, timezone);
    if (day >= from && day <= today) {
      add(cur, r);
      const b = buckets[Math.floor(daysBetween(from, day) / spec.bucketDays)];
      if (b) add(b.t, r);
    } else if (day >= prevFrom && day <= prevTo) add(prev, r);
  }
  const daysIn = (a, b) => [...dates].filter(d => d >= a && d <= b).length;
  const current = { from, to: today, ...finish(cur, REPORT_FLOORS.window), daysPractised: daysIn(from, today), streak: streakEndingOn(dates, today) };
  const previous = { from: prevFrom, to: prevTo, ...finish(prev, REPORT_FLOORS.window), daysPractised: daysIn(prevFrom, prevTo), streak: streakEndingOn(dates, prevTo) };
  const diff = k => current[k] - previous[k];
  const pdiff = k => current[k] == null || previous[k] == null ? null : Math.round(10 * (current[k] - previous[k])) / 10;
  return {
    period, window: spec.name, timezone, days: spec.days,
    floors: { ...REPORT_FLOORS },
    current, previous,
    delta: {
      questions: diff('questions'), marksEarned: diff('marksEarned'), marksPossible: diff('marksPossible'),
      methodMarksEarned: diff('methodMarksEarned'), accuracyMarksEarned: diff('accuracyMarksEarned'),
      daysPractised: diff('daysPractised'), streak: diff('streak'),
      marksPct: pdiff('marksPct'), methodPct: pdiff('methodPct'), accuracyPct: pdiff('accuracyPct')
    },
    series: buckets.map(b => {
      const f = finish(b.t, REPORT_FLOORS.point);
      return { from: b.from, to: b.to, questions: f.questions, splitQuestions: f.splitQuestions, methodPct: f.methodPct, accuracyPct: f.accuracyPct };
    }),
    source: 'server-certified-receipts'
  };
}

/**
 * A slip: a non-repeat answered row that was marked wrong, or whose certified
 * mark is below its possible.
 */
export const isSlip = r => !isRepeatRow(r) && (r.correct === false || (!!r.marks && r.marks.earned < r.marks.possible));

const isCorrectRedo = c => !!c.answered && c.correct === true && !isRepeatRow(c) &&
  (!c.marks || c.marks.earned === c.marks.possible);

/**
 * "Needs another look": a slip that has not been correctly redone since. It is
 * redone when a later answered row reached from it through History's retry
 * (`retryOf`, or `repeatOf` for the server re-issuing the same question,
 * followed transitively) is a correct redo:
 *   · marked correct, and
 *   · not a repeat — a repeat is a question whose solution the student had
 *     already been shown, so getting it right is not evidence the slip is
 *     fixed. The chain still continues through a repeat to its own retries;
 *   · and, when it carries a certified mark, full marks. A correct answer
 *     whose certified mark is below its possible is itself a slip, so it does
 *     not clear its parent (and needs another look itself).
 */
export function needsAnotherLookIds(rows) {
  const children = new Map();
  for (const r of rows) {
    for (const parent of new Set([r.retryOf, r.repeatOf].filter(Boolean))) {
      if (!children.has(parent)) children.set(parent, []);
      children.get(parent).push(r);
    }
  }
  const redone = (id, seen = new Set()) => {
    if (seen.has(id)) return false;
    seen.add(id);
    return (children.get(id) || []).some(c => isCorrectRedo(c) || redone(c.id, seen));
  };
  return new Set(rows.filter(r => r.answered && isSlip(r) && !redone(r.id)).map(r => r.id));
}

/** Filters POST /history/list understands, and the predicate for each. */
export const HISTORY_FILTERS = Object.freeze({
  all: () => true,
  wrong: x => x.correct === false,
  correct: x => x.correct === true,
  bookmarked: x => x.bookmarked,
  ink: x => x.hasInk || x.hasScribble || x.hasPhoto,
  needsLook: x => x.needsLook === true
});

export const HISTORY_SORTS = Object.freeze({
  newest: (a, b) => b.answeredAt - a.answeredAt,
  oldest: (a, b) => a.answeredAt - b.answeredAt,
  // Most marks lost first; certified rows before uncertified, newest breaks ties.
  marks: (a, b) => {
    const lost = x => Number.isInteger(x.marksPossible) && !x.repeat ? x.marksPossible - x.marksEarned : -1;
    return lost(b) - lost(a) || b.answeredAt - a.answeredAt;
  }
});
