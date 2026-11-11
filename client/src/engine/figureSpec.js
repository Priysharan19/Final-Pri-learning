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
const NAMED_SIDE = new RegExp(`\\b([A-Z])([A-Z])\\s*=\\s*${NUM}${UNIT}`, 'g');
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

/** Three stated sides joining exactly three vertices, in the question's own letters. */
function namedSides(text) {
  const found = [];
  for (const m of text.matchAll(NAMED_SIDE)) if (m[1] !== m[2]) found.push({ p: m[1], q: m[2], value: +m[3], unit: m[4] || '' });
  for (let i = 0; i + 3 <= found.length; i++) {
    const three = found.slice(i, i + 3);
    const letters = [...new Set(three.flatMap(s => [s.p, s.q]))];
    if (letters.length !== 3) continue;
    const pairs = new Set(three.map(s => [s.p, s.q].sort().join('')));
    if (pairs.size !== 3) continue;
    // The first stated side is the base X→Y; Z is the remaining vertex.
    const X = three[0].p, Y = three[0].q, Z = letters.find(l => l !== X && l !== Y);
    const len = (u, v) => three.find(s => [s.p, s.q].sort().join('') === [u, v].sort().join('')).value;
    return { vertices: [X, Y, Z], sides: { c: len(X, Y), a: len(Y, Z), b: len(Z, X) }, unit: three.map(s => s.unit).find(Boolean) || '' };
  }
  return null;
}

function triangleFrom(text) {
  let found = namedSides(text);
  if (!found) {
    const m = text.match(TRIANGLE_SIDES);
    if (!m) return null;
    // Listed without names: drawn in the order given, and labelled by length only.
    found = { vertices: null, sides: { c: +m[1], a: +m[3], b: +m[5] }, unit: m[2] || m[4] || m[6] || '' };
  }
  const built = constructTriangle(found.sides.a, found.sides.b, found.sides.c);
  if (!built) return null;
  return { kind: 'triangle', unit: found.unit.toLowerCase(), sides: found.sides, vertices: found.vertices, listed: [found.sides.c, found.sides.a, found.sides.b], ...built };
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
    if (!spec.vertices) return t('figure.triangle.sides', { sides: spec.listed.map(fmt).join(', ') + u });
    const [X, Y, Z] = spec.vertices;
    const { a, b, c } = spec.sides;
    const { A, B, C } = spec.angles;
    return t('figure.triangle.named', {
      name: X + Y + Z,
      sides: `${X}${Y} ${fmt(c)}${u}, ${Y}${Z} ${fmt(a)}${u}, ${Z}${X} ${fmt(b)}${u}`,
      angles: `${X} ${fmt(A)}°, ${Y} ${fmt(B)}°, ${Z} ${fmt(C)}°`
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
  const names = spec.vertices || null;
  return {
    size,
    points: P,
    vertexLabels: names ? { A: names[0], B: names[1], C: names[2] } : null,
    edges: [
      { from: 'A', to: 'B', at: mid(P.A, P.B), label: fmt(spec.sides.c) + u },
      { from: 'B', to: 'C', at: mid(P.B, P.C), label: fmt(spec.sides.a) + u },
      { from: 'C', to: 'A', at: mid(P.C, P.A), label: fmt(spec.sides.b) + u }
    ]
  };
}
