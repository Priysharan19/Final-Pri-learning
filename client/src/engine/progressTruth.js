// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · progress truth
//
// What every number on a student's progress surfaces means, as code. The
// attempts store is the append-only record of what a student actually
// answered; every count a progress page shows is derived from it here, and the
// rating rows the adaptive engine keeps (attempts/correct per chapter) are
// checked against it by client/test/progress-truth-check.mjs rather than
// trusted on their own. The definitions are written out for people in
// docs/product/progress-metrics.md — change one, change the other.
//
// Nothing here reads storage: it is pure arithmetic on attempt rows, so the
// route that serves a number and the suite that audits it run the same rules.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Timed games. A Rapid Fire or Match answer is a real, marked answer — it is
 * counted in "questions answered" and in the daily goal — but it is given in
 * seconds against a clock, so it is not evidence about a chapter and never
 * moves accuracy, mastery or the chapter table (the engine does not rate it
 * either: see resolve() in local/backend.js).
 */
export const GAME_MODES = Object.freeze(['rush', 'match']);

/**
 * Below these sample sizes a percentage is not shown at all. One right answer
 * is not "100% accuracy"; it is one right answer. The page says "not enough
 * evidence yet" and how many more answers it needs instead.
 */
export const PROGRESS_THRESHOLDS = Object.freeze({
  /** Learning-evidence answers before an overall accuracy is shown. */
  overallAccuracy: 10,
  /** Answers in one chapter before that chapter's accuracy is shown. */
  chapterAccuracy: 5,
  /** Answers in one chapter before it counts as "practised". */
  chapterPractised: 5
});

const isGame = a => GAME_MODES.includes(String(a?.mode || ''));

/**
 * Whether one attempt is evidence about a chapter: a marked answer in practice,
 * review, an assignment or an exam, on a curriculum question (a teacher's
 * custom question belongs to no chapter). A repeat of a question whose solution
 * the student has already been shown is recorded, and is not evidence: it
 * moves no rating, so it may not move an accuracy or a chapter count either.
 */
export function isLearningEvidence(a) {
  if (!a || isGame(a) || a.repeat === true) return false;
  const s = String(a.subtopic || '');
  return !!s && s !== 'custom';
}

/**
 * An answer that needed help — a hint, tutor help or a second try. Attempts
 * written before `support` existed are read from the help they recorded.
 */
export function isSupported(a) {
  if (a?.support === 'supported') return true;
  if (a?.support === 'independent') return false;
  return (Number(a?.hintsUsed) || 0) + (Number(a?.tutorLevel) || 0) > 0;
}

function bucket() {
  return { attempts: 0, correct: 0, independentCorrect: 0, supportedCorrect: 0 };
}

function count(b, a) {
  b.attempts++;
  if (a.correct) {
    b.correct++;
    if (isSupported(a)) b.supportedCorrect++;
    else b.independentCorrect++;
  }
}

/**
 * A percentage only where the sample can carry it.
 * Returns `{ value, enough, attempts, minimum, needed }`; `value` is null below
 * the minimum, so a surface cannot show it by accident.
 */
export function accuracyClaim(correct, attempts, minimum) {
  const n = Math.max(0, Number(attempts) || 0);
  const c = Math.max(0, Math.min(n, Number(correct) || 0));
  const min = Math.max(1, Number(minimum) || 1);
  const enough = n >= min;
  return {
    value: enough ? Math.round(1000 * c / n) / 10 : null,
    enough, attempts: n, minimum: min, needed: enough ? 0 : min - n
  };
}

/**
 * The headline totals for one profile's attempts.
 *
 *   answered  every marked answer in every mode, games included
 *   correct   correct answers among them
 *   ms        time spent answering, as the answer rows recorded it
 *   evidence  the learning-evidence subset: attempts, correct, and correct
 *             split into independent (no help) and supported (help used)
 *   accuracy  evidence correct / evidence attempts, gated by the threshold
 */
export function attemptTotals(attempts = [], thresholds = PROGRESS_THRESHOLDS) {
  const rows = (attempts || []).filter(Boolean);
  const evidence = bucket();
  let correct = 0;
  let ms = 0;
  for (const a of rows) {
    if (a.correct) correct++;
    ms += Math.max(0, Number(a.ms) || 0);
    if (isLearningEvidence(a)) count(evidence, a);
  }
  return {
    answered: rows.length,
    correct,
    ms,
    evidence,
    accuracy: accuracyClaim(evidence.correct, evidence.attempts, thresholds.overallAccuracy)
  };
}

/**
 * Learning evidence per rating key (an India chapter id, or an NSW subtopic).
 * `keyOf` maps an attempt to the key its evidence is filed under; the default
 * is the attempt's own `subtopic`, which resolve() writes as that key.
 */
export function evidenceByKey(attempts = [], keyOf = a => a.subtopic) {
  const out = {};
  for (const a of attempts || []) {
    if (!isLearningEvidence(a)) continue;
    const key = keyOf(a);
    if (!key) continue;
    count(out[key] || (out[key] = bucket()), a);
  }
  return out;
}

/**
 * Answers per calendar day in the student's own timezone. `dayKeyOf(ms)` is
 * passed in (lib/locale.js dayKey bound to the profile's zone) so this file
 * stays free of Intl.
 */
export function answersByDay(attempts = [], dayKeyOf) {
  const out = {};
  for (const a of attempts || []) {
    const at = Number(a?.createdAt);
    if (!Number.isFinite(at) || at <= 0) continue;
    const date = dayKeyOf(at);
    const d = out[date] || (out[date] = { questions: 0, correct: 0 });
    d.questions++;
    if (a.correct) d.correct++;
  }
  return out;
}

function previousDate(date) {
  const [y, m, d] = String(date).split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d) - 86400000).toISOString().slice(0, 10);
}

/**
 * Consecutive calendar days with at least one answer, ending today — or
 * yesterday, so a streak is not lost before today's first question.
 */
export function streakFromDays(dates, today) {
  const set = dates instanceof Set ? dates : new Set(dates || []);
  if (!set.size) return 0;
  let cursor = today;
  if (!set.has(cursor)) cursor = previousDate(cursor);
  let n = 0;
  while (set.has(cursor)) { n++; cursor = previousDate(cursor); }
  return n;
}
