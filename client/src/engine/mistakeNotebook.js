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
 *   · FIXED once a similar question — a notebook retry of this mistake — is
 *     answered correctly (`twinOf` on the graded attempt).
 *   · REVIEW — an unfixed mistake comes due on a widening schedule (1, 3, 7,
 *     14, 30 days) counted from its last attempt; each failed retry moves it
 *     one step along, so a mistake that keeps recurring is not nagged daily.
 *   · FREE PLAN — the newest `preview` mistakes are returned in full and the
 *     rest only as a count; Premium (`full-notebook`) returns all of them.
 *     Hidden entries are never sent, so the limit cannot be lifted by a client.
 *
 * Each filed entry is a hypothesis about a slip, not a verdict on the student
 * (docs/research/MISCONCEPTION_ERROR_ONTOLOGY_DIAGNOSTIC_EVIDENCE_V7.md §4).
 */
export const NOTEBOOK_MODES = Object.freeze(['practice', 'review', 'task']);
export const REVIEW_INTERVALS_DAYS = Object.freeze([1, 3, 7, 14, 30]);
const DAY_MS = 24 * 60 * 60 * 1000;
export const UNCLASSIFIED = 'unclassified';

/** Whether a graded attempt is a mistake the notebook files. */
export function isMistake(a) {
  return !!a && a.correct !== true && a.revealed !== true && a.resolved !== false &&
    NOTEBOOK_MODES.includes(a.mode || 'practice') && typeof a.subtopic === 'string' && !!a.subtopic &&
    typeof a.attemptId === 'string' && !!a.attemptId;
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
 * any order. Returns { total, shown, hidden, dueCount, groups, entries }.
 * `preview` null means the full notebook.
 */
export function buildNotebook(attempts, { now = Date.now(), preview = null } = {}) {
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
    return {
      id: a.attemptId,
      questionId: a.questionId || null,
      subtopic: a.subtopic,
      dotpoint: typeof a.dotpoint === 'string' ? a.dotpoint : null,
      difficulty: Number(a.difficulty) || 2,
      answeredAt,
      marksEarned: Number(a.marksEarned) || 0,
      marksPossible: Number(a.marksPossible) || 0,
      misconception: typeof a.misconception === 'string' && a.misconception
        ? { id: a.misconception, label: a.misconceptionLabel || null, source: a.misconceptionSource || null } : null,
      firstError: a.firstError && typeof a.firstError === 'object'
        ? { line: Number(a.firstError.line) || null, text: String(a.firstError.text || ''), note: String(a.firstError.note || '') } : null,
      retries: retries.length,
      fixed: !!fix,
      fixedAt: fix ? fix.at : null,
      review: reviewFor({ answeredAt, retries, fixed: !!fix, now })
    };
  }).sort((x, y) => y.answeredAt - x.answeredAt || (x.id < y.id ? -1 : 1));

  const limit = Number.isInteger(preview) && preview >= 0 ? preview : null;
  const entries = limit == null ? all : all.slice(0, limit);
  const groups = new Map();
  for (const e of entries) {
    const misconceptionKey = e.misconception?.id || UNCLASSIFIED;
    const key = `${e.subtopic}::${misconceptionKey}`;
    const g = groups.get(key) || groups.set(key, {
      key, subtopic: e.subtopic, misconception: e.misconception, count: 0, open: 0, lastAt: 0, items: []
    }).get(key);
    g.count++;
    if (!e.fixed) g.open++;
    g.lastAt = Math.max(g.lastAt, e.answeredAt);
    g.items.push(e);
  }
  return {
    total: all.length,
    shown: entries.length,
    hidden: all.length - entries.length,
    dueCount: entries.filter(e => e.review.due).length,
    nextDueAt: entries.filter(e => e.review.dueAt != null).reduce((m, e) => m == null ? e.review.dueAt : Math.min(m, e.review.dueAt), null),
    groups: [...groups.values()].sort((a, b) => b.open - a.open || b.lastAt - a.lastAt || (a.key < b.key ? -1 : 1)),
    entries
  };
}
