/**
 * The mistake notebook, as a pure function of an account's server-graded
 * attempts. ONE definition: the server builds the notebook it returns from it
 * (server/platform/practice.js GET /v1/practice/notebook) and the tests replay
 * it deterministically. Nothing here is stored: a mistake is a wrong graded
 * attempt, and it is fixed by a later graded attempt.
 *
 *   · FILED — every wrong resolution of a marked practice question (practice,
 *     notebook retry, task). A revealed solution is not a mistake. Each entry
 *     carries what the deterministic engine reported when it committed the
 *     mark: the first broken line and the examiner's note on it, and the
 *     misconception it diagnosed when it named one. Nothing is inferred here:
 *     a wrong answer with no diagnosis is filed under its topic alone.
 *   · GROUPED by topic (subtopic) and misconception.
 *   · FIXED once a notebook retry ("twin") of this mistake is answered
 *     correctly (`twinOf` on the graded attempt).
 *   · REVIEW — an unfixed mistake comes due on a widening schedule (1, 3, 7,
 *     14, 30 days) counted from its last attempt; each failed retry moves it
 *     one step along, so a mistake that keeps recurring is not nagged daily.
 *
 * The notebook is the same on every plan (owner default D19 names questions,
 * papers and JEE Advanced as Premium, not the notebook; D22 ships it).
 *
 * Each filed entry is a hypothesis about a slip, not a verdict on the student
 * (docs/research/MISCONCEPTION_ERROR_ONTOLOGY_DIAGNOSTIC_EVIDENCE_V7.md §4).
 */
export const NOTEBOOK_MODES = Object.freeze(['practice', 'review', 'task']);
export const REVIEW_INTERVALS_DAYS = Object.freeze([1, 3, 7, 14, 30]);
export const UNCLASSIFIED = 'unclassified';
// What one notebook response carries at most: the newest entries first.
export const NOTEBOOK_ENTRY_LIMIT = 200;
const DAY_MS = 24 * 60 * 60 * 1000;

const text = (v, max) => String(v ?? '').slice(0, max);

/** Whether a graded attempt is a mistake the notebook files. */
export function isMistake(a) {
  return !!a && a.correct !== true && a.revealed !== true && a.resolved !== false &&
    NOTEBOOK_MODES.includes(a.mode || 'practice') && typeof a.subtopic === 'string' && !!a.subtopic &&
    typeof a.attemptId === 'string' && !!a.attemptId;
}

/**
 * The first broken line of a step report and the examiner's note on it, as
 * the deterministic step check reported them; {} when it found no break (a
 * wrong final answer under sound working, or no working at all).
 */
export function firstErrorOf(stepReport) {
  const lines = Array.isArray(stepReport?.lines) ? stepReport.lines : [];
  const index = Number.isInteger(stepReport?.firstBreak) ? stepReport.firstBreak : -1;
  const line = index >= 0 ? lines[index] : null;
  if (!line || line.status !== 'break') return {};
  return { firstError: { line: index + 1, text: text(line.text, 400), note: text(line.note, 600) } };
}

/** The review schedule of one mistake given its failed retries. */
export function reviewFor({ answeredAt, retries, fixed, now }) {
  if (fixed) return { stage: null, dueAt: null, due: false };
  const failed = retries.filter(r => !r.correct);
  const stage = Math.min(failed.length, REVIEW_INTERVALS_DAYS.length - 1);
  const anchor = Math.max(answeredAt, ...failed.map(r => r.at));
  const dueAt = anchor + REVIEW_INTERVALS_DAYS[stage] * DAY_MS;
  return { stage, dueAt, due: dueAt <= now };
}

/**
 * attempts: graded-attempt payloads ({ attemptId, at, correct, subtopic, ... }),
 * any order. Returns { total, shown, dueCount, nextDueAt, groups, entries }.
 */
export function buildNotebook(attempts, { now = Date.now(), limit = NOTEBOOK_ENTRY_LIMIT } = {}) {
  const list = (Array.isArray(attempts) ? attempts : []).filter(a => a && typeof a === 'object');
  const retriesOf = new Map();
  for (const a of list) {
    if (typeof a.twinOf !== 'string' || !a.twinOf) continue;
    if (a.resolved === false || a.revealed === true) continue;
    const r = retriesOf.get(a.twinOf) || [];
    r.push({ correct: a.correct === true, at: Number(a.at) || 0, attemptId: a.attemptId });
    retriesOf.set(a.twinOf, r);
  }
  const all = list.filter(isMistake).map(a => {
    const retries = (retriesOf.get(a.attemptId) || []).sort((x, y) => x.at - y.at);
    const fix = retries.find(r => r.correct) || null;
    const answeredAt = Number(a.at) || 0;
    const fe = a.firstError && typeof a.firstError === 'object' ? a.firstError : null;
    return {
      id: a.attemptId,
      questionId: typeof a.questionId === 'string' ? a.questionId : null,
      subtopic: a.subtopic,
      dotpoint: typeof a.dotpoint === 'string' ? a.dotpoint : null,
      difficulty: Number(a.difficulty) || 2,
      answeredAt,
      marksEarned: Number(a.marksEarned) || 0,
      marksPossible: Number(a.marksPossible) || 0,
      misconception: typeof a.misconception === 'string' && a.misconception
        ? { id: a.misconception, label: a.misconceptionLabel || null, source: a.misconceptionSource || null } : null,
      firstError: fe && fe.text ? { line: Number.isInteger(fe.line) && fe.line > 0 ? fe.line : null, text: text(fe.text, 400), note: text(fe.note, 600) } : null,
      retries: retries.length,
      fixed: !!fix,
      fixedAt: fix ? fix.at : null,
      review: reviewFor({ answeredAt, retries, fixed: !!fix, now })
    };
  }).sort((x, y) => y.answeredAt - x.answeredAt || (x.id < y.id ? -1 : 1));

  const cap = Number.isInteger(limit) && limit >= 0 ? limit : NOTEBOOK_ENTRY_LIMIT;
  const entries = all.slice(0, cap);
  const groups = new Map();
  for (const e of entries) {
    const key = `${e.subtopic}::${e.misconception?.id || UNCLASSIFIED}`;
    const g = groups.get(key) || groups.set(key, {
      key, subtopic: e.subtopic, misconception: e.misconception, count: 0, open: 0, lastAt: 0, items: []
    }).get(key);
    g.count++;
    if (!e.fixed) g.open++;
    g.lastAt = Math.max(g.lastAt, e.answeredAt);
    g.items.push(e);
  }
  const scheduled = entries.filter(e => e.review.dueAt != null).map(e => e.review.dueAt);
  return {
    total: all.length,
    shown: entries.length,
    dueCount: entries.filter(e => e.review.due).length,
    nextDueAt: scheduled.length ? Math.min(...scheduled) : null,
    groups: [...groups.values()].sort((a, b) => b.open - a.open || b.lastAt - a.lastAt || (a.key < b.key ? -1 : 1)),
    entries
  };
}
