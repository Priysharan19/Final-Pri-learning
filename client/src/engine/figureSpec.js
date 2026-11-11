// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · constructed figures from the lengths a question gives
//
// Like plotSpec.js this is deliberately narrow. A figure is only offered when
// the text states every length it needs: a triangle needs three sides (SSS), a
// circle needs a radius or a diameter. The figure is then CONSTRUCTED — the
// third vertex comes from the cosine rule — so the picture is to scale and is
// the maths, not an illustration. Anything impossible (the triangle inequality
// fails, a non-positive length) gets no figure: that is the honest outcome.
// Nothing here marks, and nothing here comes from a model.
// ─────────────────────────────────────────────────────────────────────────────
import { plainMath } from './plotSpec.js';

const NUM = '(\\d+(?:\\.\\d+)?)';
const UNIT = '\\s*(cm|mm|m|km|units?)?';
const SEP = '\\s*(?:,|and|,\\s*and)\\s*';
const TRIANGLE_SIDES = new RegExp(`\\btriangle\\b[^.]*?\\bsides?\\b[^.\\d]*?${NUM}${UNIT}${SEP}${NUM}${UNIT}${SEP}${NUM}${UNIT}`, 'i');
const SIDE = name => new RegExp(`\\b${name}\\s*=\\s*${NUM}${UNIT}`, 'i');
const CIRCLE = new RegExp(`\\bcircle\\b[^.]*?\\b(radius|diameter)\\b\\s*(?:of|is|=)?\\s*${NUM}${UNIT}`, 'i');

const round = v => Math.round(v * 100) / 100;
const fmt = v => String(round(v));

/** The triangle with sides a = BC, b = CA, c = AB, or null if it cannot exist. */
export function constructTriangle(a, b, c) {
  if (![a, b, c].every(v => Number.isFinite(v) && v > 0)) return null;
  if (a + b <= c || a + c <= b || b + c <= a) return null;
  // A at the origin, B along the base, C from the cosine rule.
  const cx = (b * b + c * c - a * a) / (2 * c);
  const cy = Math.sqrt(Math.max(0, b * b - cx * cx));
  const angle = (opp, s1, s2) => Math.acos((s1 * s1 + s2 * s2 - opp * opp) / (2 * s1 * s2)) * 180 / Math.PI;
  return {
    points: { A: [0, 0], B: [c, 0], C: [cx, cy] },
    angles: { A: angle(a, b, c), B: angle(b, a, c), C: angle(c, a, b) }
  };
}

function triangleFrom(text) {
  let sides = null, unit = '';
  const named = ['AB', 'BC', '(?:CA|AC)'].map(n => text.match(SIDE(n)));
  if (named.every(Boolean)) {
    const [ab, bc, ca] = named;
    sides = { a: +bc[1], b: +ca[1], c: +ab[1] };
    unit = ab[2] || bc[2] || ca[2] || '';
  } else {
    const m = text.match(TRIANGLE_SIDES);
    if (!m) return null;
    // Listed in order: the first is the base AB, then BC, then CA.
    sides = { c: +m[1], a: +m[3], b: +m[5] };
    unit = m[2] || m[4] || m[6] || '';
  }
  const built = constructTriangle(sides.a, sides.b, sides.c);
  if (!built) return null;
  return { kind: 'triangle', unit: unit.toLowerCase(), sides, ...built };
}

// A part of a circle (quarter circle, semicircle) drawn as a whole circle
// would misdescribe the shape; those get no figure.
const PART_CIRCLE = /\b(?:quarter|semi)[\s-]?circle|\bquadrant\b/i;

function circleFrom(text) {
  if (PART_CIRCLE.test(text)) return null;
  const m = text.match(CIRCLE);
  if (!m) return null;
  const value = +m[2];
  if (!(value > 0)) return null;
  const radius = m[1].toLowerCase() === 'diameter' ? value / 2 : value;
  return { kind: 'circle', unit: (m[3] || '').toLowerCase(), radius, given: m[1].toLowerCase() };
}

/** A figure for a question, or null. Reads only the question's own words. */
export function figureSpecFor({ prompt = '', hasFigure = false } = {}) {
  if (hasFigure) return null; // the question already draws its own
  const text = plainMath(prompt);
  return triangleFrom(text) || circleFrom(text);
}

/** The plain-words text alternative: what a screen reader gets instead. */
export function figureAlt(spec, t) {
  if (!spec) return '';
  const u = spec.unit ? ` ${spec.unit}` : '';
  if (spec.kind === 'triangle') {
    const { a, b, c } = spec.sides;
    const { A, B, C } = spec.angles;
    return t('figure.triangle.alt', {
      ab: fmt(c) + u, bc: fmt(a) + u, ca: fmt(b) + u,
      a: fmt(A), b: fmt(B), c: fmt(C)
    });
  }
  return t('figure.circle.alt', { r: fmt(spec.radius) + u, d: fmt(spec.radius * 2) + u });
}

/** SVG geometry for a spec in a fixed viewBox, kept to scale. */
export function figureGeometry(spec, size = 240, pad = 28) {
  if (!spec) return null;
  if (spec.kind === 'circle') {
    const c = size / 2;
    return { size, circle: { cx: c, cy: c, r: c - pad }, label: fmt(spec.radius) + (spec.unit ? ` ${spec.unit}` : '') };
  }
  const pts = Object.values(spec.points);
  const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
  const w = Math.max(...xs) - Math.min(...xs), h = Math.max(...ys) - Math.min(...ys);
  const scale = (size - 2 * pad) / Math.max(w, h);
  const x0 = Math.min(...xs);
  // y grows downward in SVG: flip so the base sits at the bottom.
  const map = ([x, y]) => [pad + (x - x0) * scale, size - pad - y * scale - ((size - 2 * pad) - h * scale) / 2];
  const P = Object.fromEntries(Object.entries(spec.points).map(([k, v]) => [k, map(v)]));
  const u = spec.unit ? ` ${spec.unit}` : '';
  const mid = (p, q) => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
  return {
    size,
    points: P,
    edges: [
      { from: 'A', to: 'B', at: mid(P.A, P.B), label: fmt(spec.sides.c) + u },
      { from: 'B', to: 'C', at: mid(P.B, P.C), label: fmt(spec.sides.a) + u },
      { from: 'C', to: 'A', at: mid(P.C, P.A), label: fmt(spec.sides.b) + u }
    ]
  };
}
