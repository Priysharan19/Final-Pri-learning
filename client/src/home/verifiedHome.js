// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Home, "the verified page" §5 — the pure parts
//
// The Next card is the one next action home/recommendation.js already picks
// (KALP-04); nothing here chooses differently. These helpers only read what
// that action, the Exam Desk list and the history list already carry:
//
//   nextMeta(action)        the question count and time the action itself
//                           carries — none is estimated;
//   papersTrend(exams)      finished timed papers' scores, oldest first; null
//                           with fewer than two, so no line is drawn from one;
//   latestMarked(row)       the newest marked question with its certified marks;
//   marksAtStake(...)       hsc-forecast's figures for the action's outcome,
//                           or null — never a placeholder number.
// ─────────────────────────────────────────────────────────────────────────────

const MINUTE = 60_000;
const count = v => (Number.isInteger(v) && v > 0 ? v : null);

/**
 * { questions, minutes, minutesLeft } — each null unless the action carries it.
 * Assignments, tasks and the daily goal carry how many questions remain; due
 * reviews carry how many are due; an exam in progress carries its deadline, so
 * the minutes left are real. Nothing else carries a count or a time, and none
 * is invented for it.
 */
export function nextMeta(action, now = Date.now()) {
  const d = action?.data || {};
  let questions = null;
  if (['assignment', 'task', 'daily-goal'].includes(action?.kind)) questions = count(d.remaining);
  else if (action?.kind === 'reviews' && d.unit !== 'dotpoint') questions = count(d.count);
  const minutes = count(d.minutes);
  let minutesLeft = null;
  if (action?.kind === 'exam' && Number.isFinite(action.dueAt) && action.dueAt > now) {
    minutesLeft = Math.max(1, Math.ceil((action.dueAt - now) / MINUTE));
  }
  return { questions, minutes, minutesLeft };
}

/**
 * The timed-paper trend from GET /exams: finished papers the server marked in
 * full (not pending, not provisional, a positive total), as whole percentages,
 * oldest first, the last `max`. Null with fewer than two.
 */
export function papersTrend(exams, max = 6) {
  if (!Array.isArray(exams)) return null;
  const done = exams.filter(e => e
    && Number.isFinite(Number(e.finished_at)) && Number(e.finished_at) > 0
    && !e.pending && !e.provisional && !(Number(e.pending_marks) > 0)
    && Number.isFinite(Number(e.score)) && Number(e.total) > 0)
    .sort((a, b) => Number(a.finished_at) - Number(b.finished_at))
    .slice(-max)
    .map(e => ({ id: String(e.id), title: e.title || '', at: Number(e.finished_at), pct: Math.round((100 * Number(e.score)) / Number(e.total)) }));
  return done.length >= 2 ? done : null;
}

/** An SVG path through the trend, on a fixed 50–100 % band clamped to [0, 100]. */
export function sparkPath(points, { width = 92, height = 32, pad = 4 } = {}) {
  if (!points || points.length < 2) return null;
  const lo = Math.min(50, ...points.map(p => p.pct));
  const hi = 100;
  const x = i => pad + (i * (width - 2 * pad)) / (points.length - 1);
  const y = v => pad + ((hi - v) / Math.max(1, hi - lo)) * (height - 2 * pad);
  const coords = points.map((p, i) => [Number(x(i).toFixed(1)), Number(y(p.pct).toFixed(1))]);
  return { d: coords.map(([a, b], i) => `${i ? 'L' : 'M'}${a} ${b}`).join(''), last: coords[coords.length - 1] };
}

/** The newest history row with server-certified marks, or null. */
export function latestMarked(row) {
  if (!row || row.repeat) return null;
  const possible = Number(row.marksPossible);
  if (!Number.isInteger(possible) || possible <= 0) return null;
  const earned = Math.max(0, Math.min(possible, Number(row.marksEarned) || 0));
  return { id: String(row.id), chapter: row.subtopicName || '', earned, possible };
}

/**
 * Marks at stake for the action's 2024 outcome, from hsc-forecast's
 * topicWeights and forecastMeta (task/hsc-priorities). `forecast` is
 * { weights, meta } or null; the action must name its outcome code
 * (data.outcome). Without all of that: null, and Home shows nothing.
 * The disclaimer travels with the figure, always.
 */
export function marksAtStake(action, forecast) {
  const code = action?.data?.outcome;
  if (!code || !forecast?.weights || !forecast?.meta) return null;
  const band = forecast.meta.bands?.[code];
  const total = Number(forecast.meta.paperMarks);
  const disclaimer = forecast.meta.disclaimer;
  if (!Array.isArray(band) || band.length !== 2 || !(total > 0) || typeof disclaimer !== 'string' || !disclaimer) return null;
  // A share times the paper's marks, rounded outwards — with a hair of
  // tolerance so 0.14 × 100 is 14, not 15 (binary floating point).
  const lo = Math.floor(Number(band[0]) * total + 1e-9);
  const hi = Math.ceil(Number(band[1]) * total - 1e-9);
  if (!Number.isFinite(lo) || !Number.isFinite(hi) || hi <= 0 || lo > hi) return null;
  return { lo, hi, disclaimer };
}

/**
 * The forecast Home reads, or null. hsc-forecast's engine is not on main yet;
 * until it is, this is null and "Marks at stake" stays hidden. When it lands,
 * this returns { weights: topicWeights(course), meta: forecastMeta(course) }
 * for a Prithagoras Mathematics Advanced or Extension 1 student.
 */
export function homeForecast() {
  return null;
}
