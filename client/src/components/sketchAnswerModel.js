// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the graph-sketch answer, as a form
//
// A sketch question is answered by stating the features of the graph: the
// x-intercepts, the y-intercept and the turning points. This module is the pure
// part of that form: it reads what a student typed into the labelled fields and
// writes the FEATURE SET the marker takes (engine/graphFeatures.js
// readFeatureSet), and the other way round for a restored draft. It marks
// nothing: the server's engine compares the set with the features it derives
// from the function.
//
//   { intercepts: { x: [number…], y: number | null }, turning: [{ x, y, kind }] }
//
// Only the features the question asks for (`question.sketchAsk`) are written.
// A field left empty is "not stated" and earns nothing; the word "none" is the
// student's statement that there are none.
// ─────────────────────────────────────────────────────────────────────────────

/** The features this form can take. A question asking for anything else is not offered a form for it. */
export const SKETCH_FEATURES = Object.freeze(['xIntercepts', 'yIntercept', 'turning']);
export const MAX_TURNING_ROWS = 6;
const NONE = /^(?:none|no|nil|n\/a)$/i;

/** The asked features this form can take, in a fixed order (never the order of an unvalidated list). */
export function askedFeatures(ask) {
  const list = Array.isArray(ask) ? ask : [];
  return SKETCH_FEATURES.filter(k => list.includes(k));
}

/** One number as typed: 3, -2.5, −2.5 (a true minus sign), +4, 3/2. Null when it is not one. */
export function parseNumber(text) {
  const s = String(text ?? '').trim().replace(/[−–]/g, '-').replace(/\s+/g, '');
  if (!s) return null;
  let m = /^([+-]?\d+(?:\.\d+)?)$/.exec(s);
  if (m) return Number(m[1]);
  m = /^([+-]?\d+)\/(\d+)$/.exec(s);
  if (m && Number(m[2]) !== 0) return Number(m[1]) / Number(m[2]);
  return null;
}

/** A list as typed: "1, 5", "1 and 5", "1; 5", or "none". */
export function parseList(text) {
  const s = String(text ?? '').trim();
  if (!s) return { status: 'empty', values: [] };
  if (NONE.test(s)) return { status: 'none', values: [] };
  const parts = s.split(/\s*(?:,|;|\band\b)\s*|\s+/i).filter(Boolean);
  const values = parts.map(parseNumber);
  if (!values.length || values.some(v => v === null)) return { status: 'error', values: [] };
  return { status: 'ok', values };
}

export const emptyRow = () => ({ x: '', y: '', kind: '' });
export const emptyFields = () => ({ xs: '', y: '', turning: [emptyRow()], noTurning: false });

/**
 * The feature set the fields state, for the asked features, and what is wrong with any field.
 * `set` holds only features that were stated and could be read. `errors` maps a feature to
 * 'list' | 'number' | 'row'. `stated` is true when the student has put anything in the form.
 */
export function buildFeatureSet(fields, ask) {
  const wanted = askedFeatures(ask);
  const set = {};
  const errors = {};
  let stated = false;
  if (wanted.includes('xIntercepts')) {
    const l = parseList(fields.xs);
    if (l.status === 'error') { errors.xIntercepts = 'list'; stated = true; }
    else if (l.status !== 'empty') { set.intercepts = { ...(set.intercepts || {}), x: l.values }; stated = true; }
  }
  if (wanted.includes('yIntercept')) {
    const raw = String(fields.y ?? '').trim();
    if (raw) {
      stated = true;
      if (NONE.test(raw)) set.intercepts = { ...(set.intercepts || {}), y: null };
      else {
        const v = parseNumber(raw);
        if (v === null) errors.yIntercept = 'number';
        else set.intercepts = { ...(set.intercepts || {}), y: v };
      }
    }
  }
  if (wanted.includes('turning')) {
    if (fields.noTurning) { set.turning = []; stated = true; }
    else {
      const rows = (Array.isArray(fields.turning) ? fields.turning : []).slice(0, MAX_TURNING_ROWS);
      const out = [];
      for (const r of rows) {
        const touched = String(r.x ?? '').trim() || String(r.y ?? '').trim() || r.kind;
        if (!touched) continue;
        stated = true;
        const x = parseNumber(r.x), y = parseNumber(r.y);
        if (x === null || y === null || (r.kind !== 'max' && r.kind !== 'min')) { errors.turning = 'row'; continue; }
        out.push({ x, y, kind: r.kind });
      }
      if (out.length) set.turning = out;
    }
  }
  return { set, errors, stated };
}

/** The text sent as the answer: the feature set as JSON, or '' while nothing has been stated. */
export function sketchAnswerText(fields, ask) {
  const { set, stated } = buildFeatureSet(fields, ask);
  return stated && Object.keys(set).length ? JSON.stringify(set) : '';
}

const show = v => (Number.isInteger(v) ? String(v) : String(Math.round(v * 1e6) / 1e6));

/** The fields a stored answer text stands for (a restored draft). Anything unreadable gives the empty form. */
export function fieldsFromAnswer(text) {
  const f = emptyFields();
  let set;
  try { set = JSON.parse(String(text || '')); } catch { return f; }
  if (!set || typeof set !== 'object' || Array.isArray(set)) return f;
  const x = set.intercepts?.x;
  if (Array.isArray(x)) f.xs = x.length ? x.map(show).join(', ') : 'none';
  if (set.intercepts && 'y' in set.intercepts) f.y = set.intercepts.y === null ? 'none' : show(set.intercepts.y);
  if (Array.isArray(set.turning)) {
    if (!set.turning.length) f.noTurning = true;
    else f.turning = set.turning.slice(0, MAX_TURNING_ROWS).map(t => ({ x: show(t?.x), y: show(t?.y), kind: t?.kind === 'max' || t?.kind === 'min' ? t.kind : '' }));
  }
  return f;
}

/** The points a feature set marks on the axes: { kind: 'x' | 'y' | 'max' | 'min', x, y }. */
export function pointsOfSet(set) {
  const out = [];
  const ic = set?.intercepts;
  if (Array.isArray(ic?.x)) for (const x of ic.x) if (Number.isFinite(x)) out.push({ kind: 'x', x, y: 0 });
  if (Number.isFinite(ic?.y)) out.push({ kind: 'y', x: 0, y: ic.y });
  if (Array.isArray(set?.turning)) for (const t of set.turning) if (Number.isFinite(t?.x) && Number.isFinite(t?.y)) out.push({ kind: t.kind === 'max' ? 'max' : 'min', x: t.x, y: t.y });
  return out;
}

/** The points of the true graph's features, in the same shape (for the marked view). */
export function pointsOfFeatures(f, ask) {
  const wanted = askedFeatures(ask);
  const set = {};
  if (wanted.includes('xIntercepts')) set.intercepts = { x: f.intercepts?.x || [] };
  if (wanted.includes('yIntercept')) set.intercepts = { ...(set.intercepts || {}), y: f.intercepts?.y };
  if (wanted.includes('turning')) set.turning = f.turning || [];
  return pointsOfSet(set);
}

/**
 * An axes window that holds the given points and the origin, with room around them. It is
 * chosen from the points alone, so it says nothing about a graph the student has not marked.
 */
export function windowFor(points, { minSpan = 6 } = {}) {
  let xMin = 0, xMax = 0, yMin = 0, yMax = 0;
  for (const p of points) { xMin = Math.min(xMin, p.x); xMax = Math.max(xMax, p.x); yMin = Math.min(yMin, p.y); yMax = Math.max(yMax, p.y); }
  const widen = (lo, hi) => {
    let a = lo, b = hi;
    if (b - a < minSpan) { const mid = (a + b) / 2; a = mid - minSpan / 2; b = mid + minSpan / 2; }
    const pad = (b - a) * 0.15;
    return [a - pad, b + pad];
  };
  const [x0, x1] = widen(xMin, xMax), [y0, y1] = widen(yMin, yMax);
  return { xMin: x0, xMax: x1, yMin: y0, yMax: y1 };
}

/** What the marker said about each asked feature: [{ feature, verdict, detail }] in the form's order. */
export function resultRows(sketch, ask) {
  const wanted = askedFeatures(ask);
  const by = new Map((Array.isArray(sketch?.verdicts) ? sketch.verdicts : []).map(v => [v.feature, v]));
  return wanted.map(feature => {
    const v = by.get(feature);
    return { feature, verdict: v?.verdict || null, detail: v?.detail || null };
  });
}
