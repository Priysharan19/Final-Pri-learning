// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · NCERT Class 11 Conic Sections — JEE D4 forms, one per dot point
//
// The JEE tracks reached Conic Sections at D4 for all three dot points through
// the whole-chapter generator, whose D4 rung is one routine template: "the
// eccentricity of x²/a² − y²/b² = 1". That rung is retired at D4 (issue #408)
// and each dot point below gets its own form instead. Each form joins at least
// two separate ideas, never one formula with bigger numbers:
//
//   · circle (dot point 0)
//       three-points — the circle through three lattice points (a linear
//         system in g, f, c), THEN its second crossing of an axis from the sum
//         of the roots of the axis quadratic;
//       chord — the centre and radius read from the general form, THEN the
//         perpendicular from the centre bisecting a chord (r² = d² + ℓ²) to
//         recover the constant term or the chord's length;
//       tangent — distance-from-centre = radius gives two values of k, THEN a
//         side-of-a-line sign test keeps exactly one.
//   · parabola (dot point 1)
//       focal-distance — completing the square to find the vertex and a, THEN
//         the focal distance as the distance to the directrix (or the triangle
//         on the latus rectum);
//       opening — the focus written in terms of an unknown coefficient gives a
//         quadratic in t, THEN the direction the parabola opens rejects a root;
//       focal-chord — completing the square, THEN the other end of a chord
//         through the focus from the product of the roots (−4a²), and its
//         length as the sum of two focal distances.
//   · ellipse and hyperbola (dot point 2)
//       focal-definition — 2a from the sum (ellipse) or difference
//         (hyperbola) of the focal distances of a given point, THEN b² from
//         a and c, then the axis, eccentricity or latus rectum asked;
//       lr-ratio — the latus rectum compared with an axis fixes b/a (or
//         b²/a²), THEN the foci fix the scale;
//       confocal — c² read from an ellipse, THEN a hyperbola with the same
//         foci through a point (a quadratic with one root rejected because
//         it makes β negative) or with a given product of eccentricities.
//
// Scope is the NCERT Class 11 chapter as JEE Main and Advanced examine it:
// standard positions, shifts by completing the square, the focal-distance
// definitions, b² = a² ∓ c², e = c/a and the latus rectum 2b²/a. Nothing uses
// parametric forms, tangent or normal equations, or the directrices of an
// ellipse or hyperbola. The perpendicular distance of a point from a line
// (Straight Lines) and the sum and product of the roots of a quadratic are the
// only tools borrowed from other chapters.
//
// Provenance. Original, parameterised forms written for Pri Learning; nothing
// is transcribed from NCERT exercises, the exemplar or past papers. Every key
// is computed from the drawn parameters, never typed, and
// client/test/support/india-jee-d4-conics-solvers.mjs re-derives each one
// from the rendered prompt by a different route (circumcentre by Cramer's
// rule, line–conic intersections by substitution, numeric scans and
// bisection, the standard-form equation solved for a²). None of this is a
// human maths review — that is pending — and no board or examiner approval
// is claimed.
// ─────────────────────────────────────────────────────────────────────────────
import { ri, rc, nz, makeRng } from '../qhelpers.js';
import { exact as exactForm, frac, fracTex, traps } from './india-native-helpers.js';

/** An exact answer that also accepts its exact decimal (see india-class11-jee-hardest.js). */
function exact(f, suffix) {
  const out = exactForm(f, suffix);
  if (out.answer.simplestFraction) out.answer = { ...out.answer, requireFraction: false };
  return out;
}

// ── Exact rationals and formatting ───────────────────────────────────────────
const R = (n, d = 1) => frac(n, d);
const rTex = f => fracTex(f.n, f.d);
/** "+ 3" / "- 3" — a signed constant written after another term. */
const sg = k => (k >= 0 ? `+ ${k}` : `- ${Math.abs(k)}`);
/** Brackets a negative number: 6 stays 6, −4 becomes (−4). */
const par = v => (v < 0 ? `(${v})` : String(v));
/** A sum of terms [[coef, monomial]], '' for the constant: "x^2 + y^2 - 6x + 4y - 12". */
function termsTex(terms) {
  let out = '';
  for (const [c, m] of terms) {
    if (c === 0) continue;
    const abs = Math.abs(c);
    const body = m === '' ? String(abs) : `${abs === 1 ? '' : abs}${m}`;
    out += out ? ` ${c < 0 ? '-' : '+'} ${body}` : `${c < 0 ? '-' : ''}${body}`;
  }
  return out || '0';
}
/** "x - 3", "x + 2", "x" — the variable less k. */
const less = (v, k) => (k === 0 ? v : `${v} ${sg(-k)}`);
/** "(x - 3)^2" or "x^2". */
const sqTex = (v, k) => (k === 0 ? `${v}^2` : `(${less(v, k)})^2`);
const pt = (x, y) => `(${x}, ${y})`;
const ptR = (x, y) => `\\left(${rTex(x)}, ${rTex(y)}\\right)`;
const absR = f => R(Math.abs(f.n), f.d);
const addR = (x, y) => R(x.n * y.d + y.n * x.d, x.d * y.d);
const mulR = (x, y) => R(x.n * y.n, x.d * y.d);
/** "3(2) - 4(-1) + 7": the left side of ax + by + c with (x, y) substituted. */
function substTex(a, x, b, y, c) {
  const parts = [];
  for (const [co, v] of [[a, x], [b, y]]) {
    if (co === 0) continue;
    const abs = Math.abs(co), body = abs === 1 ? par(v) : `${abs}(${v})`;
    parts.push(parts.length ? `${co < 0 ? '-' : '+'} ${body}` : `${co < 0 ? '-' : ''}${body}`);
  }
  if (c !== 0) parts.push(sg(c));
  return parts.join(' ');
}
/** "|x - y|", or "|x|" when y is zero. */
const gapTex = (x, y) => (y === 0 ? `|${x}|` : `|${x} - ${par(y)}|`);
const isSquare = n => n >= 0 && Math.round(Math.sqrt(n)) ** 2 === n;

const FALLBACK_SEED = 0x434f4e49;   // "CONI"

// ═════════════════════════════════════════════════════════════════════════════
// Dot point 0 · Circle — centre, radius and equation
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Circles with an integer centre (h, k), k ≠ 0, that cross the x-axis at two
 * integer points h ± s, with every lattice point on them off the x-axis
 * listed. A second axis crossing is then a whole number.
 */
const THREE_POINT_CIRCLES = Object.freeze((() => {
  const out = [];
  for (let h = -5; h <= 5; h++) for (let k = -6; k <= 6; k++) {
    if (k === 0) continue;
    for (let r2 = 2; r2 <= 85; r2++) {
      const s2 = r2 - k * k;
      if (s2 <= 0 || !isSquare(s2)) continue;
      const s = Math.round(Math.sqrt(s2));
      const pts = [];
      const top = Math.floor(Math.sqrt(r2));
      for (let dx = -top; dx <= top; dx++) {
        const dy2 = r2 - dx * dx;
        if (!isSquare(dy2)) continue;
        const dy = Math.round(Math.sqrt(dy2));
        for (const y of dy === 0 ? [k] : [k + dy, k - dy]) if (y !== 0) pts.push([h + dx, y]);
      }
      if (pts.length >= 2) out.push(Object.freeze({ h, k, r2, s, pts: Object.freeze(pts) }));
    }
  }
  return out;
})());

/** Line normals (a, b) with √(a² + b²) whole, and some without. */
const PYTHAGOREAN_NORMALS = [[3, 4], [4, 3], [3, -4], [4, -3], [5, 12], [12, 5], [5, -12], [12, -5]];
const AXIS_NORMALS = [[1, 0], [0, 1]];
const SLANT_NORMALS = [[1, 2], [2, 1], [1, -2], [2, -1], [1, 1], [1, -1], [1, 3], [3, 1], [1, -3], [3, -1], [2, 3], [3, -2]];
const lineTex = (a, b, c, k = '') => `${termsTex([[a, 'x'], [b, 'y']])}${k ? ` + ${k}` : c === 0 ? '' : ` ${sg(c)}`} = 0`;
const circleTex = (h, k, p) => `${termsTex([[1, 'x^2'], [1, 'y^2'], [-2 * h, 'x'], [-2 * k, 'y']])}${p === 'p' ? ' + p' : p === 0 ? '' : ` ${sg(p)}`} = 0`;
const centreForm = (h, k, r2) => `${sqTex('x', h)} + ${sqTex('y', k)} = ${r2}`;

function circleReasoning(rng) {
  const kind = rc(rng, ['three-points', 'chord', 'tangent']);
  for (let guard = 0; guard < 400; guard++) {
    if (kind === 'three-points') {
      const e = rc(rng, THREE_POINT_CIRCLES);
      const lower = rng() < 0.5;
      const p = lower ? e.h - e.s : e.h + e.s, q = lower ? e.h + e.s : e.h - e.s;
      if (q === 0) continue;
      const cand = e.pts.filter(([x, y]) => Math.abs(x) <= 12 && Math.abs(y) <= 12);
      if (cand.length < 2) continue;
      const i = ri(rng, 0, cand.length - 1);
      let j = ri(rng, 0, cand.length - 2);
      if (j >= i) j++;
      const B0 = cand[i], C0 = cand[j];
      // A horizontal chord BC hands over the centre's abscissa at once.
      if (B0[1] === C0[1] && rng() < 0.75) continue;
      const onX = rng() < 0.5;
      const ax = onX ? 'x' : 'y', other = onX ? 'y' : 'x';
      const flip = ([x, y]) => (onX ? [x, y] : [y, x]);
      const A = flip([p, 0]), B = flip(B0), C = flip(C0);
      const [H, K] = flip([e.h, e.k]);
      const g = -H, f = -K, c = H * H + K * K - e.r2;
      const coefAx = onX ? g : f;            // the axis quadratic is t² + 2(coef)t + c
      const eqFor = ([x, y]) => `${termsTex([[2 * x, 'g'], [2 * y, 'f'], [1, 'c']])} = ${-(x * x + y * y)}`;
      return {
        prompt: `A circle passes through the points $A${pt(...A)}$, $B${pt(...B)}$ and $C${pt(...C)}$. It meets the $${ax}$-axis again at a point $D$ other than $A$. Find the $${ax}$-coordinate of $D$.`,
        answerType: 'numeric', answer: { value: q },
        traps: traps(q, [
          { value: e.h, why: `That is the $${ax}$-coordinate of the centre, which is the midpoint of $AD$, not $D$ itself.` },
          { value: p * q, why: `That is the product of the two $${ax}$-intercepts (the constant term of the circle's equation), not the second intercept.` },
          { value: 2 * e.h + p, why: 'The two roots add up to the sum read off the equation; the known root is subtracted from that sum, not added to it.' },
          { value: -q, why: 'Check the sign: the sum of the roots of $t^2 + Bt + C = 0$ is $-B$.' }
        ]).slice(0, 3),
        hints: [
          'Write the circle as $x^2 + y^2 + 2gx + 2fy + c = 0$ and substitute each of the three points: that gives three linear equations in $g$, $f$ and $c$.',
          'Subtracting the equations in pairs removes $c$ and leaves two equations in $g$ and $f$.',
          `On the $${ax}$-axis put $${other} = 0$: the two crossings are the roots of a quadratic, and one root is already known, so use the sum of the roots.`
        ],
        steps: [
          { h: 'General form', d: 'Let the circle be $x^2 + y^2 + 2gx + 2fy + c = 0$.' },
          { h: 'Substitute A, B, C', d: `$${eqFor(A)}$, $\\;${eqFor(B)}$, $\\;${eqFor(C)}$` },
          { h: 'Solve', d: `Subtracting in pairs and solving: $g = ${g}$, $f = ${f}$, $c = ${c}$; the centre is $${pt(H, K)}$ and $r^2 = ${e.r2}$.` },
          { h: `On the ${ax}-axis`, d: `Put $${other} = 0$: $${termsTex([[1, `${ax}^2`], [2 * coefAx, ax], [c, '']])} = 0$. Its roots add up to $${-2 * coefAx}$, and one of them is $${p}$ (the point $A$).` },
          { h: 'Answer', d: `The other root is $${p === 0 ? q : `${-2 * coefAx} - ${par(p)} = ${q}`}$, so $D = ${pt(...flip([q, 0]))}$.` }
        ],
        reasoning: 'circle-three-points'
      };
    }
    if (kind === 'chord') {
      const h = ri(rng, -6, 6), k = ri(rng, -6, 6);
      if (h === 0 && k === 0) continue;
      if ((h === 0 || k === 0) && rng() < 0.6) continue;
      if (rng() < 0.65) {
        // Find the constant term p from the chord's length.
        const [a, b] = rc(rng, rng() < 0.85 ? PYTHAGOREAN_NORMALS : AXIS_NORMALS);
        const n = Math.round(Math.hypot(a, b));
        const d = ri(rng, 1, 5), half = ri(rng, 2, 8);
        const side = rng() < 0.5 ? 1 : -1;
        const c = side * d * n - (a * h + b * k);
        if (Math.abs(c) > 90) continue;
        const r2 = d * d + half * half;
        const value = h * h + k * k - r2;
        if (value === 0) continue;
        const line = lineTex(a, b, c);
        return {
          prompt: `The line $${line}$ cuts off a chord of length $${2 * half}$ from the circle $${circleTex(h, k, 'p')}$. Find $p$.`,
          answerType: 'numeric', answer: { value },
          traps: traps(value, [
            { value: h * h + k * k + r2, why: 'The radius satisfies $r^2 = g^2 + f^2 - p$, so $p = g^2 + f^2 - r^2$: the square of the radius is subtracted, not added.' },
            { value: h * h + k * k - d * d - 4 * half * half, why: 'The perpendicular from the centre bisects the chord, so the right triangle uses half the chord, not the whole chord.' },
            { value: h * h + k * k - half * half, why: 'The radius is the hypotenuse of a right triangle whose legs are the half-chord and the distance from the centre to the line; that distance has been left out.' }
          ]),
          hints: [
            'Complete the squares to read off the centre; the radius satisfies $r^2 = g^2 + f^2 - p$.',
            'The perpendicular from the centre to a chord bisects the chord.',
            'Find the distance of the centre from the line, then use Pythagoras with half the chord to get $r^2$.'
          ],
          steps: [
            { h: 'Centre and radius', d: `$${centreForm(h, k, `${h * h + k * k} - p`)}$, so the centre is $${pt(h, k)}$ and $r^2 = ${h * h + k * k} - p$.` },
            { h: 'Distance of the centre from the line', d: n === 1 ? `$|${substTex(a, h, b, k, c)}| = ${d}$` : `$\\dfrac{|${substTex(a, h, b, k, c)}|}{\\sqrt{${a * a} + ${b * b}}} = \\dfrac{${Math.abs(a * h + b * k + c)}}{${n}} = ${d}$` },
            { h: 'Half the chord', d: `The perpendicular from the centre bisects the chord, so $r^2 = ${d}^2 + ${half}^2 = ${r2}$.` },
            { h: 'Answer', d: `$${h * h + k * k} - p = ${r2}$, so $p = ${value}$.` }
          ],
          reasoning: 'circle-chord-constant'
        };
      }
      // The chord's length², with a normal whose length is a surd.
      const [a, b] = rc(rng, SLANT_NORMALS);
      const n2 = a * a + b * b;
      const c = ri(rng, -12, 12);
      const N = a * h + b * k + c;
      if (N === 0) continue;
      const r2 = Math.floor((N * N) / n2) + ri(rng, 1, 30);
      const pConst = h * h + k * k - r2;
      const value = R(4 * (r2 * n2 - N * N), n2);
      if (value.n <= 0) continue;
      const half2 = R(r2 * n2 - N * N, n2), d2 = R(N * N, n2);
      return {
        prompt: `Find the square of the length of the chord that the line $${lineTex(a, b, c)}$ cuts off from the circle $${circleTex(h, k, pConst)}$.`,
        answerType: 'numeric', ...exact(value),
        traps: traps(value.value, [
          { value: half2.value, why: 'That is the square of HALF the chord; the chord is twice the half-chord, so its square is four times as large.' },
          { value: 4 * (r2 - N * N), why: 'The distance of the centre from the line has $\\sqrt{a^2 + b^2}$ in its denominator, so its square is divided by $a^2 + b^2$.' },
          { value: addR(R(4 * r2), mulR(R(4), d2)).value, why: 'The radius is the hypotenuse: the square of the half-chord is $r^2 - d^2$, not $r^2 + d^2$.' }
        ]),
        hints: [
          'Complete the squares to read off the centre and the square of the radius.',
          'Find the square of the perpendicular distance of the centre from the line.',
          'The perpendicular from the centre bisects the chord: the half-chord, that distance and the radius form a right triangle.'
        ],
        steps: [
          { h: 'Centre and radius', d: `$${centreForm(h, k, r2)}$: centre $${pt(h, k)}$, $r^2 = ${r2}$.` },
          { h: 'Distance squared', d: `$d^2 = \\dfrac{(${substTex(a, h, b, k, c)})^2}{${a * a} + ${b * b}} = ${rTex(d2)}$` },
          { h: 'Half the chord', d: `$\\left(\\tfrac{\\ell}{2}\\right)^2 = r^2 - d^2 = ${r2} - ${rTex(d2)} = ${rTex(half2)}$` },
          { h: 'Answer', d: `$\\ell^2 = 4 \\times ${rTex(half2)} = ${rTex(value)}$` }
        ],
        reasoning: 'circle-chord-length'
      };
    }
    // Tangent: distance = radius gives two k; a side condition keeps one.
    const h = ri(rng, -6, 6), k = ri(rng, -6, 6), r = ri(rng, 1, 6);
    if (h === 0 && k === 0) continue;
    const [a, b] = rc(rng, PYTHAGOREAN_NORMALS);
    const n = Math.round(Math.hypot(a, b));
    const s = a * h + b * k;
    if (Math.abs(s) <= n * r) continue;   // only then does exactly one tangent fit the side condition
    const same = rng() < 0.5;
    const lamPlus = n * r - s, lamMinus = -n * r - s;
    // At the centre ax + by + k is +nr for lamPlus, −nr for lamMinus; at the origin it is k.
    const keep = [lamPlus, lamMinus].filter(l => (Math.sign(l) === Math.sign(l + s)) === same);
    if (keep.length !== 1) continue;
    const value = keep[0], rejected = value === lamPlus ? lamMinus : lamPlus;
    if (Math.abs(value) > 120) continue;
    const pConst = h * h + k * k - r * r;
    const where = same ? 'on the same side of the line' : 'on opposite sides of the line';
    const signWord = v => (v > 0 ? 'positive' : 'negative');
    return {
      prompt: `The line $${lineTex(a, b, 0, 'k')}$ touches the circle $${circleTex(h, k, pConst)}$, and the origin and the centre of the circle lie ${where}. Find $k$.`,
      answerType: 'numeric', answer: { value },
      traps: traps(value, [
        { value: rejected, why: `That line also touches the circle, but it puts the origin and the centre ${same ? 'on opposite sides' : 'on the same side'}.` },
        { value: -s, why: 'That line passes through the centre; a tangent is at a distance equal to the radius from the centre.' }
      ]),
      hints: [
        'Complete the squares to find the centre and the radius.',
        'A line touches a circle exactly when its perpendicular distance from the centre equals the radius; this gives two values.',
        'Two points lie on the same side of $ax + by + k = 0$ when the expression has the same sign at both; test each value.'
      ],
      steps: [
        { h: 'Centre and radius', d: `$${centreForm(h, k, r * r)}$: centre $${pt(h, k)}$, radius $${r}$.` },
        { h: 'Touching', d: `$\\dfrac{|${substTex(a, h, b, k, 0) || '0'} + k|}{${n}} = ${r}$, so $|k ${sg(s)}| = ${n * r}$ and $k = ${lamPlus}$ or $k = ${lamMinus}$.` },
        { h: 'Sides', d: `$${termsTex([[a, 'x'], [b, 'y']])} + k$ is $k$ at the origin and $${s} + k$ at the centre. For $k = ${lamPlus}$: $${lamPlus}$ and $${n * r}$ (${signWord(lamPlus)}, positive). For $k = ${lamMinus}$: $${lamMinus}$ and $${-n * r}$ (${signWord(lamMinus)}, negative).` },
        { h: 'Answer', d: `The points are ${same ? 'on the same side' : 'on opposite sides'} only for $k = ${value}$.` }
      ],
      reasoning: 'circle-tangent-side'
    };
  }
  return circleReasoning(makeRng(FALLBACK_SEED));
}

// ═════════════════════════════════════════════════════════════════════════════
// Dot point 1 · Parabola — focus, directrix and latus rectum
// ═════════════════════════════════════════════════════════════════════════════

/**
 * A parabola (w − w₀)² = 4a(u − u₀) along one axis: orient 'y2' has the y² term
 * (axis horizontal, u = x, w = y); 'x2' has the x² term (axis vertical).
 */
function frame(orient) {
  const across = orient === 'y2' ? 'y' : 'x', along = orient === 'y2' ? 'x' : 'y';
  const point = (u, w) => (orient === 'y2' ? [u, w] : [w, u]);
  return { across, along, point };
}
function parabolaTex(orient, a, u0, w0) {
  const { across, along } = frame(orient);
  return `${termsTex([[1, `${across}^2`], [-2 * w0, across], [-4 * a, along], [w0 * w0 + 4 * a * u0, '']])} = 0`;
}
function standardTex(orient, a, u0, w0) {
  const { across, along } = frame(orient);
  return `${sqTex(across, w0)} = ${u0 === 0 ? `${4 * a}${along}` : `${4 * a}(${less(along, u0)})`}`;
}
/** A point given by (along, across) values as a rendered pair of rationals. */
const placed = (orient, u, w) => { const [x, y] = frame(orient).point(u, w); return ptR(x, y); };

function parabolaReasoning(rng) {
  const kind = rc(rng, ['focal-distance', 'opening', 'focal-chord']);
  for (let guard = 0; guard < 400; guard++) {
    const orient = rng() < 0.5 ? 'y2' : 'x2';
    const { across, along } = frame(orient);
    if (kind === 'focal-distance') {
      const a = nz(rng, -4, 4), u0 = ri(rng, -6, 6), w0 = ri(rng, -6, 6);
      const t = nz(rng, -14, 14);
      if ((t * t) % (4 * Math.abs(a)) !== 0 || t * t === 4 * a * a) continue;
      const off = (t * t) / (4 * a);                       // u_P − u₀, same sign as a
      const uP = u0 + off, wP = w0 + t;
      const A = Math.abs(a);
      const askArea = rng() < 0.45;
      const value = askArea ? 2 * A * Math.abs(Math.abs(off) - A) : Math.abs(off) + A;
      const eq = parabolaTex(orient, a, u0, w0);
      return {
        prompt: `The point $P$ on the parabola $${eq}$ has $${across}$-coordinate $${wP}$. ${askArea ? 'Find the area of the triangle whose vertices are $P$ and the two end points of the latus rectum of the parabola.' : 'Find the distance of $P$ from the focus of the parabola.'}`,
        answerType: 'numeric', answer: { value },
        traps: traps(value, askArea
          ? [{ value: 2 * value, why: 'The area of a triangle is half the base times the height.' },
            { value: 2 * A * Math.abs(off), why: 'The height is the distance of $P$ from the latus rectum, which passes through the focus, not through the vertex.' }]
          : [{ value: Math.abs(off), why: 'That is the distance of $P$ from the line through the vertex parallel to the directrix; the directrix is a further $|a|$ beyond the vertex.' },
            { value: Math.abs(uP) + A, why: 'That treats the vertex as the origin; this parabola is shifted, so measure from its own directrix.' },
            { value: Math.abs(off) + 4 * A, why: '$4|a|$ is the length of the latus rectum; the directrix is only $|a|$ from the vertex.' }]),
        hints: [
          `Complete the square in $${across}$ to write the equation as $(${across} - k)^2 = 4a(${along} - h)$; read off the vertex and $a$.`,
          askArea
            ? 'The latus rectum is the chord through the focus perpendicular to the axis, of length $4|a|$; it is the base of the triangle.'
            : 'Every point of a parabola is as far from the focus as from the directrix.',
          `Find the other coordinate of $P$ from the equation, then measure ${askArea ? 'its distance from the latus rectum' : 'its distance from the directrix'}.`
        ],
        steps: [
          { h: 'Complete the square', d: `$${standardTex(orient, a, u0, w0)}$: vertex $${placed(orient, R(u0), R(w0))}$ and $4a = ${4 * a}$, so $a = ${a}$.` },
          { h: 'Focus and directrix', d: `Focus $${placed(orient, R(u0 + a), R(w0))}$; directrix $${along} = ${u0 - a}$; the latus rectum lies on $${along} = ${u0 + a}$ with ends $${placed(orient, R(u0 + a), R(w0 + 2 * a))}$ and $${placed(orient, R(u0 + a), R(w0 - 2 * a))}$.` },
          { h: 'The point P', d: `$${across} = ${wP}$ gives $${w0 === 0 ? par(wP) : `(${wP} ${sg(-w0)})`}^2 = ${4 * a}(${less(along, u0)})$, so $${along} = ${uP}$ and $P = ${placed(orient, R(uP), R(wP))}$.` },
          askArea
            ? { h: 'Area', d: `Base $= 4|a| = ${4 * A}$, height $= ${gapTex(uP, u0 + a)} = ${Math.abs(uP - u0 - a)}$, area $= \\dfrac{1}{2} \\times ${4 * A} \\times ${Math.abs(uP - u0 - a)} = ${value}$` }
            : { h: 'Focal distance', d: `$PS$ = distance of $P$ from the directrix $= ${gapTex(uP, u0 - a)} = ${value}$` }
        ],
        reasoning: askArea ? 'parabola-latus-triangle' : 'parabola-focal-distance'
      };
    }
    if (kind === 'opening') {
      // The coefficient T of the linear term solves T² + 4c₀T − 4K = 0, K = D²/4 − F,
      // with roots 2s > 0 and 2t < 0 (s, t drawn here; the prompt calls the coefficient t).
      const s = ri(rng, 1, 8), t = -ri(rng, 1, 8);
      if ((s + t) % 2 !== 0 || s + t === 0) continue;     // c₀ = 0 would make the rejected root just −answer
      const D = 2 * ri(rng, -4, 4);
      const K = -s * t, F = (D * D) / 4 + s * t, c0 = -(s + t) / 2;
      const positiveA = rng() < 0.5;                    // a = −T/4 > 0 ⇔ T < 0
      const value = positiveA ? 2 * t : 2 * s, rejected = positiveA ? 2 * s : 2 * t;
      const dir = orient === 'y2' ? (positiveA ? 'opens to the right' : 'opens to the left') : (positiveA ? 'opens upwards' : 'opens downwards');
      const eq = `${termsTex([[1, `${across}^2`], [D, across]])} + t${along}${F === 0 ? '' : ` ${sg(F)}`} = 0`;
      const lineText = `the line $${along} = ${c0}$`;
      const half = -D / 2;
      return {
        prompt: `For a non-zero real number $t$, the parabola $${eq}$ ${dir} and its focus lies on ${lineText}. Find $t$.`,
        answerType: 'numeric', answer: { value },
        traps: traps(value, [
          { value: rejected, why: `That value also puts the focus on ${lineText}, but then $a = -\\dfrac{t}{4}$ has the other sign and the parabola opens the other way.` },
          { value: -value, why: 'Moving the $t$ term to the other side changes its sign: here $4a = -t$.' },
          { value: -rejected, why: 'The focus is $a$ beyond the vertex in the direction the parabola opens: add $a$ to the vertex coordinate, do not subtract it.' }
        ]),
        hints: [
          `Complete the square in $${across}$ and write the equation as $(${across} - k)^2 = 4a(${along} - h)$, with $a$ and $h$ in terms of $t$.`,
          `The focus is $a$ beyond the vertex along the axis; setting its $${along}$-coordinate gives a quadratic in $t$.`,
          'Of the two roots, keep the one whose sign of $a$ matches the direction in which the parabola opens.'
        ],
        steps: [
          { h: 'Complete the square', d: `$${sqTex(across, half)} = -t${along} ${sg(K)} = -t\\left(${along} - \\dfrac{${K}}{t}\\right)$, so $4a = -t$ and the vertex has $${along} = \\dfrac{${K}}{t}$.` },
          { h: 'Focus', d: `The focus has $${along} = \\dfrac{${K}}{t} + a = \\dfrac{${K}}{t} - \\dfrac{t}{4}$.` },
          { h: 'Quadratic in t', d: `$\\dfrac{${K}}{t} - \\dfrac{t}{4} = ${c0} \\Rightarrow ${termsTex([[1, 't^2'], [4 * c0, 't'], [-4 * K, '']])} = 0 \\Rightarrow (t ${sg(-2 * s)})(t ${sg(-2 * t)}) = 0$, so $t = ${2 * s}$ or $t = ${2 * t}$.` },
          { h: 'Direction', d: `The parabola ${dir}, so $a ${positiveA ? '>' : '<'} 0$, i.e. $t ${positiveA ? '<' : '>'} 0$.` },
          { h: 'Answer', d: `$t = ${value}$` }
        ],
        reasoning: 'parabola-opening-parameter'
      };
    }
    // Focal chord: the other end from Y_P·Y_Q = −4a², the length from two focal distances.
    const a = nz(rng, -6, 6), u0 = ri(rng, -5, 5), w0 = ri(rng, -5, 5);
    const t = nz(rng, -16, 16);
    if ((t * t) % (4 * Math.abs(a)) !== 0 || t * t === 4 * a * a) continue;
    const A = Math.abs(a);
    const offP = (t * t) / (4 * a);
    const tQ = R(-4 * a * a, t), offQ = R(4 * a * a * a, t * t);
    if (offQ.d > 16 || tQ.d > 16) continue;
    const uP = u0 + offP, wP = w0 + t;
    if (Math.abs(uP) > 40 || Math.abs(wP) > 25) continue;
    const askLength = rng() < 0.55;
    const length = addR(R(Math.abs(offP) + 2 * A), absR(offQ));
    const uQ = addR(R(u0), offQ), wQ = addR(R(w0), tQ);
    const value = askLength ? length : uQ;
    const eq = parabolaTex(orient, a, u0, w0);
    const Ptext = pt(...frame(orient).point(uP, wP));
    return {
      prompt: `For the parabola $${eq}$, the chord $PQ$ passes through the focus, and $P = ${Ptext}$. ${askLength ? 'Find the length of $PQ$.' : `Find the $${along}$-coordinate of $Q$.`}`,
      answerType: 'numeric', ...exact(value),
      traps: traps(value.value, askLength
        ? [{ value: 2 * (Math.abs(offP) + A), why: 'The focus does not bisect a focal chord unless it is the latus rectum; add the two focal distances separately.' },
          { value: 4 * A, why: 'That is the length of the latus rectum, the focal chord perpendicular to the axis — this chord is not perpendicular to it.' }]
        : [{ value: u0 + a, why: 'That is the focus; $Q$ lies on the parabola beyond it.' },
          { value: uP, why: 'That is the same coordinate of $P$; $Q$ is the other end of the chord.' }]),
      hints: [
        `Complete the square in $${across}$ to find the vertex, $a$ and the focus.`,
        'Measure from the vertex along and across the axis, so the parabola is $Y^2 = 4aX$ with focus $(a, 0)$; a line through the focus meets it where the product of the two $Y$-values is $-4a^2$.',
        askLength ? 'The length of a focal chord is the sum of the focal distances of its ends, and each focal distance is the distance from the directrix.' : 'Find the $Y$-value of $Q$, then its $X$-value from $Y^2 = 4aX$, and shift back.'
      ],
      steps: [
        { h: 'Complete the square', d: `$${standardTex(orient, a, u0, w0)}$: vertex $${placed(orient, R(u0), R(w0))}$, $a = ${a}$, focus $${placed(orient, R(u0 + a), R(w0))}$.` },
        { h: 'Shifted coordinates', d: `With $X = ${less(along, u0)}$ and $Y = ${less(across, w0)}$ the parabola is $Y^2 = ${4 * a}X$ and $P$ has $Y = ${t}$, $X = ${offP}$.` },
        { h: 'Other end', d: `Through the focus $X = ${a} + mY$, so $Y^2 ${sg(-4 * a)}mY - ${4 * a * a} = 0$ and $Y_P Y_Q = -${4 * a * a}$: $Y_Q = ${rTex(tQ)}$, $X_Q = \\dfrac{Y_Q^2}{${4 * a}} = ${rTex(offQ)}$, so $Q = ${placed(orient, uQ, wQ)}$.` },
        askLength
          ? { h: 'Length', d: `$PQ = PS + QS = (|X_P| + |a|) + (|X_Q| + |a|) = ${Math.abs(offP) + A} + ${rTex(addR(absR(offQ), R(A)))} = ${rTex(length)}$` }
          : { h: 'Answer', d: `$${along}_Q = ${u0} + X_Q = ${u0} ${offQ.n < 0 ? '-' : '+'} ${rTex(absR(offQ))} = ${rTex(uQ)}$` }
      ],
      reasoning: askLength ? 'parabola-focal-chord-length' : 'parabola-focal-chord-end'
    };
  }
  return parabolaReasoning(makeRng(FALLBACK_SEED));
}

// ═════════════════════════════════════════════════════════════════════════════
// Dot point 2 · Ellipse and hyperbola — foci, axes and eccentricity
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Offsets (u, v), v > 0, of a point from the centre, with half focal distance
 * c, for which both focal distances √((u ± c)² + v²) are whole.
 */
const FOCAL_POINTS = Object.freeze((() => {
  const out = [];
  for (let c = 1; c <= 12; c++) for (let u = -16; u <= 16; u++) for (let v = 1; v <= 16; v++) {
    const q1 = (u + c) ** 2 + v * v, q2 = (u - c) ** 2 + v * v;
    if (!isSquare(q1) || !isSquare(q2)) continue;
    out.push(Object.freeze({ c, u, v, d1: Math.round(Math.sqrt(q1)), d2: Math.round(Math.sqrt(q2)) }));
  }
  return out;
})());

/**
 * Confocal pairs: a hyperbola x²/α − y²/β = 1 with α + β = c² through (x₀, y₀).
 * α solves α² − (c² + x₀² + y₀²)α + c²x₀² = 0; one root lies below c² (the
 * hyperbola), the other above it (the ellipse with the same foci).
 */
const CONFOCAL_POINTS = Object.freeze((() => {
  const out = [];
  for (let c = 2; c <= 9; c++) for (let x0 = 1; x0 <= 12; x0++) {
    const prod = c * c * x0 * x0;
    for (let P1 = 1; P1 < c * c; P1++) {
      if (prod % P1 !== 0) continue;
      const P2 = prod / P1;
      if (P2 <= c * c) continue;
      const y2 = P1 + P2 - c * c - x0 * x0;
      if (y2 <= 0 || !isSquare(y2)) continue;
      const y0 = Math.round(Math.sqrt(y2));
      if (y0 > 24) continue;
      out.push(Object.freeze({ c, x0, y0, P1, P2 }));
    }
  }
  return out;
})());

const RATIO_FRACTIONS = [[1, 2], [1, 3], [2, 3], [1, 4], [3, 4], [2, 5], [3, 5], [4, 5], [1, 5], [5, 6], [1, 6]];
const RATIO_ANY = [...RATIO_FRACTIONS, [2, 1], [3, 1], [3, 2], [4, 3], [5, 2], [5, 3]];
const ratioText = ([p, q]) => (q === 1 ? `$${p}$ times` : `$\\dfrac{${p}}{${q}}$ of`);

function ellipseHyperbolaReasoning(rng) {
  const kind = rc(rng, ['focal-definition', 'lr-ratio', 'confocal']);
  const throughPoint = rng() < 0.55;
  for (let guard = 0; guard < 400; guard++) {
    if (kind === 'focal-definition') {
      const hyper = rng() < 0.5;
      const e = rc(rng, FOCAL_POINTS);
      if (hyper && e.u === 0) continue;
      const h = ri(rng, -5, 5), k = ri(rng, -5, 5);
      const horizontal = rng() < 0.5;
      const vs = rng() < 0.5 ? 1 : -1;
      const at = (u, v) => (horizontal ? [h + u, k + v] : [h + v, k + u]);
      const F1 = at(-e.c, 0), F2 = at(e.c, 0), P = at(e.u, vs * e.v);
      if ([...P].some(x => Math.abs(x) > 20)) continue;
      const c = e.c, S = hyper ? Math.abs(e.d1 - e.d2) : e.d1 + e.d2;   // S = 2a
      const conic = hyper ? 'hyperbola' : 'ellipse';
      const axisName = hyper ? 'conjugate axis' : 'minor axis';
      const ask = rc(rng, ['axis', 'axis', 'e', 'lr', 'lr']);
      const b2x4 = hyper ? 4 * c * c - S * S : S * S - 4 * c * c;     // (2b)²
      const value = ask === 'axis' ? R(b2x4) : ask === 'e' ? R(2 * c, S) : R(b2x4, S);
      const askText = ask === 'axis' ? `the square of the length of its ${axisName}` : ask === 'e' ? 'its eccentricity' : 'the length of its latus rectum';
      const trapList = ask === 'axis'
        ? [{ value: b2x4 / 4, why: `That is $b^2$; the ${axisName} has length $2b$, so its square is $4b^2$.` },
          hyper ? { value: S * S - 4 * c * c, why: 'For a hyperbola $b^2 = c^2 - a^2$; $a^2 - c^2$ is the ellipse\'s relation and comes out negative here.' }
            : { value: S * S + 4 * c * c, why: 'For an ellipse $b^2 = a^2 - c^2$; adding $c^2$ is the hyperbola\'s relation turned around.' }]
        : ask === 'e'
          ? [{ value: c / S, why: `The ${hyper ? 'difference' : 'sum'} of the focal distances is $2a$, not $a$.` },
            { value: S / (2 * c), why: 'Eccentricity is $\\dfrac{c}{a}$, not $\\dfrac{a}{c}$.' }]
          : [{ value: b2x4 / (2 * S), why: 'The latus rectum has length $\\dfrac{2b^2}{a}$; the factor $2$ has been lost.' },
            { value: b2x4 / 4, why: 'That is $b^2$; the latus rectum has length $\\dfrac{2b^2}{a}$.' },
            { value: b2x4 / (4 * c), why: 'The latus rectum is $\\dfrac{2b^2}{a}$, with $a$ (not $c$) in the denominator.' }];
      return {
        prompt: `A${hyper ? '' : 'n'} ${conic} has its foci at $F_1${pt(...F1)}$ and $F_2${pt(...F2)}$ and passes through the point $P${pt(...P)}$. Find ${askText}.`,
        answerType: 'numeric', ...exact(value),
        traps: traps(value.value, trapList),
        hints: [
          'The centre is the midpoint of the foci, and the distance between the foci is $2c$.',
          hyper ? 'For every point of a hyperbola the DIFFERENCE of its distances from the foci is $2a$.' : 'For every point of an ellipse the SUM of its distances from the foci is $2a$.',
          hyper ? 'Then $b^2 = c^2 - a^2$, $e = \\dfrac{c}{a}$, and the latus rectum has length $\\dfrac{2b^2}{a}$.' : 'Then $b^2 = a^2 - c^2$, $e = \\dfrac{c}{a}$, and the latus rectum has length $\\dfrac{2b^2}{a}$.'
        ],
        steps: [
          { h: 'Centre and c', d: `The centre is $${pt(h, k)}$ and $F_1F_2 = ${2 * c} = 2c$, so $c = ${c}$.` },
          { h: 'Focal distances', d: `$PF_1 = ${e.d1}$ and $PF_2 = ${e.d2}$.` },
          { h: hyper ? 'Difference' : 'Sum', d: `$2a = ${hyper ? `|${e.d1} - ${e.d2}|` : `${e.d1} + ${e.d2}`} = ${S}$, so $a = ${rTex(R(S, 2))}$ and $a^2 = ${rTex(R(S * S, 4))}$.` },
          { h: 'b²', d: `$b^2 = ${hyper ? `${c * c} - ${rTex(R(S * S, 4))}` : `${rTex(R(S * S, 4))} - ${c * c}`} = ${rTex(R(b2x4, 4))}$` },
          { h: 'Answer', d: ask === 'axis' ? `$(2b)^2 = 4b^2 = ${rTex(value)}$` : ask === 'e' ? `$e = \\dfrac{c}{a} = \\dfrac{${c}}{${rTex(R(S, 2))}} = ${rTex(value)}$` : `$\\dfrac{2b^2}{a} = \\dfrac{2 \\times ${rTex(R(b2x4, 4))}}{${rTex(R(S, 2))}} = ${rTex(value)}$` }
        ],
        reasoning: hyper ? 'hyperbola-focal-difference' : 'ellipse-focal-sum'
      };
    }
    if (kind === 'lr-ratio') {
      const hyper = rng() < 0.5;
      const vsMinor = rng() < 0.5;                 // compare with the minor/conjugate axis, else the major/transverse
      const [p, q] = rc(rng, hyper ? RATIO_ANY : RATIO_FRACTIONS);
      const c = ri(rng, 2, 12);
      const vertical = rng() < 0.4;
      // k = b²/a²: ρ² against the minor/conjugate axis (b/a = ρ), ρ against the major/transverse.
      const kRatio = vsMinor ? R(p * p, q * q) : R(p, q);
      const oneMinus = hyper ? R(kRatio.d + kRatio.n, kRatio.d) : R(kRatio.d - kRatio.n, kRatio.d);   // e² = 1 ± k
      const a2 = R(c * c * oneMinus.d, oneMinus.n);
      const b2 = mulR(kRatio, a2);
      const askA = rng() < 0.5;
      const value = askA ? a2 : b2;
      if (value.d > 1 && rng() < 0.75) continue;
      if (value.d > 40 || Math.abs(value.n) > 5000) continue;
      // Trap: the ratio read the other way (b/a against b²/a²).
      const kAlt = vsMinor ? R(p, q) : R(p * p, q * q);
      const altOne = hyper ? R(kAlt.d + kAlt.n, kAlt.d) : R(kAlt.d - kAlt.n, kAlt.d);
      const a2Alt = altOne.n > 0 ? R(c * c * altOne.d, altOne.n) : null;
      const altValue = a2Alt ? (askA ? a2Alt : mulR(kAlt, a2Alt)) : null;
      // Trap: the other conic's relation between a, b, c.
      const wrongOne = hyper ? R(kRatio.d - kRatio.n, kRatio.d) : R(kRatio.d + kRatio.n, kRatio.d);
      const a2Wrong = wrongOne.n > 0 ? R(c * c * wrongOne.d, wrongOne.n) : null;
      const wrongValue = a2Wrong ? (askA ? a2Wrong : mulR(kRatio, a2Wrong)) : null;
      const conicTex = hyper
        ? (vertical ? '\\dfrac{y^2}{a^2} - \\dfrac{x^2}{b^2} = 1' : '\\dfrac{x^2}{a^2} - \\dfrac{y^2}{b^2} = 1')
        : (vertical ? '\\dfrac{x^2}{b^2} + \\dfrac{y^2}{a^2} = 1' : '\\dfrac{x^2}{a^2} + \\dfrac{y^2}{b^2} = 1');
      const cond = hyper ? '$(a > 0,\\ b > 0)$' : '$(a > b > 0)$';
      const foci = vertical ? `(0, \\pm ${c})` : `(\\pm ${c}, 0)`;
      const axisName = hyper ? (vsMinor ? 'conjugate axis' : 'transverse axis') : (vsMinor ? 'minor axis' : 'major axis');
      const axisLen = vsMinor ? '2b' : '2a';
      const rho = rTex(R(p, q));
      return {
        prompt: `The ${hyper ? 'hyperbola' : 'ellipse'} $${conicTex}$ ${cond} has its foci at $${foci}$, and the length of its latus rectum is ${ratioText([p, q])} the length of its ${axisName}. Find $${askA ? 'a^2' : 'b^2'}$.`,
        answerType: 'numeric', ...exact(value),
        traps: traps(value.value, [
          ...(altValue ? [{ value: altValue.value, why: vsMinor ? 'Comparing $\\dfrac{2b^2}{a}$ with $2b$ gives $\\dfrac{b}{a}$, not $\\dfrac{b^2}{a^2}$.' : 'Comparing $\\dfrac{2b^2}{a}$ with $2a$ gives $\\dfrac{b^2}{a^2}$, not $\\dfrac{b}{a}$.' }] : []),
          ...(wrongValue ? [{ value: wrongValue.value, why: hyper ? 'For a hyperbola $c^2 = a^2 + b^2$; $a^2 - b^2$ is the ellipse\'s relation.' : 'For an ellipse $c^2 = a^2 - b^2$; $a^2 + b^2$ is the hyperbola\'s relation.' }] : []),
          { value: (askA ? b2 : a2).value, why: `That is $${askA ? 'b^2' : 'a^2'}$, not $${askA ? 'a^2' : 'b^2'}$.` },
          { value: c * c, why: `That is $c^2 = a^2 ${hyper ? '+' : '-'} b^2$, the square of the distance from the centre to a focus.` }
        ]).slice(0, 3),
        hints: [
          `The latus rectum has length $\\dfrac{2b^2}{a}$ and the ${axisName} has length $${axisLen}$; their ratio fixes ${vsMinor ? '$\\dfrac{b}{a}$' : '$\\dfrac{b^2}{a^2}$'}.`,
          hyper ? 'For a hyperbola the foci give $c^2 = a^2 + b^2$.' : 'For an ellipse the foci give $c^2 = a^2 - b^2$.',
          'Write $b^2$ as a multiple of $a^2$ and substitute into the relation for $c^2$.'
        ],
        steps: [
          { h: 'Ratio', d: `$\\dfrac{2b^2/a}{${axisLen}} = ${vsMinor ? '\\dfrac{b}{a}' : '\\dfrac{b^2}{a^2}'} = ${rho}$, so $b^2 = ${rTex(kRatio)}a^2$.` },
          { h: 'Foci', d: `$c = ${c}$ and $c^2 = a^2 ${hyper ? '+' : '-'} b^2 = ${rTex(oneMinus)}a^2$, so $${c * c} = ${rTex(oneMinus)}a^2$.` },
          { h: 'a² and b²', d: `$a^2 = ${rTex(a2)}$ and $b^2 = ${rTex(kRatio)} \\times ${rTex(a2)} = ${rTex(b2)}$` },
          { h: 'Answer', d: `$${askA ? 'a^2' : 'b^2'} = ${rTex(value)}$` }
        ],
        reasoning: hyper ? 'hyperbola-latus-ratio' : 'ellipse-latus-ratio'
      };
    }
    // Confocal: c² from an ellipse, then a hyperbola with the same foci.
    const askBeta = rng() < 0.6;
    if (throughPoint) {
      const e = rc(rng, CONFOCAL_POINTS);
      const c2 = e.c * e.c;
      const B = ri(rng, 1, 30), A = B + c2;
      if (A === e.P2) continue;                      // not the confocal ellipse through the point itself
      const xs = rng() < 0.5 ? 1 : -1, ys = rng() < 0.5 ? 1 : -1;
      const alpha = e.P1, beta = c2 - e.P1, value = askBeta ? beta : alpha;
      const sumRoots = c2 + e.x0 * e.x0 + e.y0 * e.y0;
      return {
        prompt: `The hyperbola $\\dfrac{x^2}{p} - \\dfrac{y^2}{q} = 1$, where $p > 0$ and $q > 0$, has the same foci as the ellipse $\\dfrac{x^2}{${A}} + \\dfrac{y^2}{${B}} = 1$ and passes through the point $${pt(xs * e.x0, ys * e.y0)}$. Find $${askBeta ? 'q' : 'p'}$.`,
        answerType: 'numeric', answer: { value },
        traps: traps(value, [
          { value: askBeta ? c2 - e.P2 : e.P2, why: 'That comes from the other root of the quadratic, which makes $q$ negative: it is the ellipse with the same foci through the point, not a hyperbola.' },
          { value: askBeta ? alpha : beta, why: `That is $${askBeta ? 'p' : 'q'}$, not $${askBeta ? 'q' : 'p'}$.` },
          { value: c2, why: 'That is $c^2 = p + q$, shared by the two curves, not one of the two denominators.' }
        ]),
        hints: [
          'For the ellipse, $c^2$ is the larger denominator minus the smaller; for the hyperbola, $c^2 = p + q$.',
          'Write $q$ in terms of $p$ and substitute the point: clearing fractions gives a quadratic in $p$.',
          'Both $p$ and $q$ must be positive; that rejects one root.'
        ],
        steps: [
          { h: 'Common foci', d: `Ellipse: $c^2 = ${A} - ${B} = ${c2}$, foci $(\\pm ${e.c}, 0)$. Hyperbola: $p + q = ${c2}$.` },
          { h: 'Through the point', d: `$\\dfrac{${e.x0 * e.x0}}{p} - \\dfrac{${e.y0 * e.y0}}{${c2} - p} = 1 \\Rightarrow p^2 - ${sumRoots}p + ${c2 * e.x0 * e.x0} = 0 \\Rightarrow (p - ${e.P1})(p - ${e.P2}) = 0$` },
          { h: 'Reject', d: `$p = ${e.P2}$ gives $q = ${c2 - e.P2} < 0$; so $p = ${e.P1}$ and $q = ${beta}$.` },
          { h: 'Answer', d: `$${askBeta ? 'q' : 'p'} = ${value}$` }
        ],
        reasoning: 'confocal-through-point'
      };
    }
    const c = ri(rng, 2, 9), c2 = c * c;
    const m = rc(rng, [1, 1, 2]);
    // Mostly an A with m²A dividing c⁴, so that α = c⁴/(m²A) comes out whole.
    const nice = [];
    for (let A0 = c2 + 1; A0 <= c2 + 40; A0++) if ((c2 * c2) % (m * m * A0) === 0) nice.push(A0);
    const A = nice.length && rng() < 0.6 ? rc(rng, nice) : c2 + ri(rng, 1, 40), B = A - c2;
    const alpha = R(c2 * c2, m * m * A), beta = R(c2 * A * m * m - c2 * c2, m * m * A);
    const value = askBeta ? beta : alpha;
    if (value.d > 60 || value.n > 6000) continue;
    if (value.d > 1 && rng() < 0.5) continue;
    return {
      prompt: `The hyperbola $\\dfrac{x^2}{p} - \\dfrac{y^2}{q} = 1$, where $p > 0$ and $q > 0$, has the same foci as the ellipse $\\dfrac{x^2}{${A}} + \\dfrac{y^2}{${B}} = 1$, and the product of the eccentricities of the two curves is $${m}$. Find $${askBeta ? 'q' : 'p'}$.`,
      answerType: 'numeric', ...exact(value),
      traps: traps(value.value, [
        { value: (askBeta ? alpha : beta).value, why: `That is $${askBeta ? 'p' : 'q'}$, not $${askBeta ? 'q' : 'p'}$.` },
        { value: c2, why: 'That is $c^2 = p + q$, shared by the two curves, not one of the two denominators.' },
        { value: askBeta ? c2 - m * m * A : m * m * A, why: 'For the hyperbola $e^2 = \\dfrac{c^2}{p}$, so $p = \\dfrac{c^2}{e^2}$, not $c^2e^2$.' }
      ]),
      hints: [
        'For the ellipse, $c^2$ is the larger denominator minus the smaller, and its eccentricity is $c$ divided by the square root of the larger denominator.',
        'The product condition gives the hyperbola\'s eccentricity; for the hyperbola $e^2 = \\dfrac{c^2}{p}$.',
        'With the same $c^2$, $p + q$ is known, which gives the other denominator.'
      ],
      steps: [
        { h: 'Ellipse', d: `$c^2 = ${A} - ${B} = ${c2}$ and $e_1^2 = ${rTex(R(c2, A))}$.` },
        { h: 'Hyperbola eccentricity', d: `$e_1 e_2 = ${m} \\Rightarrow e_2^2 = \\dfrac{${m * m}}{e_1^2} = ${rTex(R(m * m * A, c2))}$` },
        { h: 'p', d: `$p = \\dfrac{c^2}{e_2^2} = \\dfrac{${c2}}{${rTex(R(m * m * A, c2))}} = ${rTex(alpha)}$` },
        { h: 'q', d: `$q = c^2 - p = ${c2} - ${rTex(alpha)} = ${rTex(beta)}$` },
        { h: 'Answer', d: `$${askBeta ? 'q' : 'p'} = ${rTex(value)}$` }
      ],
      reasoning: 'confocal-eccentricity-product'
    };
  }
  return ellipseHyperbolaReasoning(makeRng(FALLBACK_SEED));
}

// ═════════════════════════════════════════════════════════════════════════════

/** One rung, D4: every other rung returns the same form. */
const d4 = form => (rng, _diff) => form(rng);

export const forms = Object.freeze({
  'c11-circle-jee-reasoning': d4(circleReasoning),
  'c11-parabola-jee-reasoning': d4(parabolaReasoning),
  'c11-ellipse-hyperbola-jee-reasoning': d4(ellipseHyperbolaReasoning)
});

// Exposed for the independent check, which asserts the tables are non-empty.
export const CONICS_TABLES_FOR_CHECK = Object.freeze({ THREE_POINT_CIRCLES, FOCAL_POINTS, CONFOCAL_POINTS });
