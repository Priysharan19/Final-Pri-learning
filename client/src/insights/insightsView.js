// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Insights (readiness estimate + Mistake DNA): pure view helpers
//
// Everything here shapes what the server already decided (server/platform/
// forecast.js, server/platform/mistakeDna.js). Nothing estimates, ranks or
// labels on its own. The trend's geometry is a plain function of the weekly
// points so the SVG is generated from the data and can be checked in Node.
//
// Honesty rules carried into the drawing:
//   · the band is drawn as a share of the marks PRACTISED at that week, never
//     of the whole paper (the server never scales to untouched marks);
//   · a week below the coverage floor (show === false) has no band and no
//     line through it: only its coverage tick is drawn;
//   · a habit always carries its chances ("7 of 12"), never a bare count.
// ─────────────────────────────────────────────────────────────────────────────

export const PLOT = Object.freeze({ width: 320, height: 132, padL: 30, padR: 8, padT: 10, padB: 22 });

/** The query the forecast route takes for this learner, or null outside the India tracks. */
export function paperQuery(user) {
  if (!user) return null;
  const track = user.indiaTrack || (user.course === 'in' || user.country === 'in' ? 'cbse' : null);
  const grade = Number(user.year);
  if (!['cbse', 'jee-main', 'jee-advanced'].includes(track) || !Number.isInteger(grade)) return null;
  const variant = user.indiaVariant === 'basic' ? 'basic' : 'standard';
  return `track=${encodeURIComponent(track)}&grade=${grade}&variant=${variant}`;
}

const pct = (v, of) => (of > 0 && Number.isFinite(v) ? Math.round((1000 * v) / of) / 10 : null);

/** A trend point in percent of the marks practised then, or with no band below the floor. */
export function trendPoint(p) {
  const banded = p.show === true && p.coveredMarks > 0 && [p.low, p.expected, p.high].every(Number.isFinite);
  return {
    weekEnding: p.weekEnding,
    coverage: Math.max(0, Math.min(1, Number(p.coverage) || 0)),
    banded,
    low: banded ? pct(p.low, p.coveredMarks) : null,
    mid: banded ? pct(p.expected, p.coveredMarks) : null,
    high: banded ? pct(p.high, p.coveredMarks) : null
  };
}

/**
 * The SVG paths for the weekly trend. x is evenly spaced by week; y is 0–100%
 * of marks practised. Runs of banded weeks are drawn as separate segments, so
 * a week under the floor breaks the band rather than being bridged.
 */
export function trendGeometry(points = [], plot = PLOT) {
  const pts = points.map(trendPoint);
  const w = plot.width - plot.padL - plot.padR;
  const h = plot.height - plot.padT - plot.padB;
  const x = i => Math.round((plot.padL + (pts.length > 1 ? (w * i) / (pts.length - 1) : w / 2)) * 10) / 10;
  const y = v => Math.round((plot.padT + h - (h * v) / 100) * 10) / 10;
  const runs = [];
  let run = [];
  pts.forEach((p, i) => {
    if (p.banded) run.push({ ...p, i });
    else if (run.length) { runs.push(run); run = []; }
  });
  if (run.length) runs.push(run);
  const bands = runs.map(r => {
    if (r.length === 1) {
      const p = r[0];
      return `M${x(p.i) - 3} ${y(p.high)}H${x(p.i) + 3}V${y(p.low)}H${x(p.i) - 3}Z`;
    }
    const top = r.map(p => `${x(p.i)} ${y(p.high)}`).join('L');
    const bottom = [...r].reverse().map(p => `${x(p.i)} ${y(p.low)}`).join('L');
    return `M${top}L${bottom}Z`;
  });
  const lines = runs.filter(r => r.length > 1).map(r => 'M' + r.map(p => `${x(p.i)} ${y(p.mid)}`).join('L'));
  const dots = pts.map((p, i) => ({ cx: x(i), cy: p.banded ? y(p.mid) : null, banded: p.banded }));
  const ticks = pts.map((p, i) => ({ x: x(i), h: Math.round(p.coverage * 6 * 10) / 10 }));
  const grid = [0, 50, 100].map(v => ({ v, y: y(v) }));
  return { width: plot.width, height: plot.height, bands, lines, dots, ticks, grid, baseline: plot.height - plot.padB, points: pts };
}

/** The forecast's headline, as i18n key + values. Never a number below the floor. */
export function headline(f) {
  if (!f || !f.show) return { key: 'insights.forecastNoBand', values: { pct: Math.round((f?.coverage || 0) * 100) } };
  return { key: 'insights.forecastBand', values: { covered: f.coveredMarks, total: f.totalMarks, expected: f.expected, low: f.low, high: f.high, unseen: f.unseenMarks } };
}

/** The chances phrase for a habit row: "7 of 12 chances" (always with its denominator). */
export function chancesValues(row) {
  const times = Math.max(0, Number(row?.times) || 0);
  const chances = Math.max(times, Number(row?.chances) || 0);
  return { times, chances, count: chances, n: chances };
}

/**
 * Cross-chapter view: chapters × habits, each cell the habit's presence in that
 * chapter. Only chapters a habit touched, in order of how many habits touch them.
 */
export function chapterMatrix(habits = []) {
  const counts = new Map();
  for (const h of habits) for (const c of h.chapters || []) counts.set(c, (counts.get(c) || 0) + 1);
  const chapters = [...counts.keys()].sort((a, b) => counts.get(b) - counts.get(a) || a.localeCompare(b));
  return { chapters, rows: habits.map(h => ({ id: h.id, cells: chapters.map(c => (h.chapters || []).includes(c)) })) };
}
