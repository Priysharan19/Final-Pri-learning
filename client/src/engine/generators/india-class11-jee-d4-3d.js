// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · NCERT Class 11 Introduction to Three-dimensional Geometry —
// JEE D4 forms, one per dot point (issue #408 follow-on)
//
// The JEE tracks reached this chapter's hardest level (D4) for all three dot
// points through one whole-chapter template, "the x-coordinate of the centroid
// of a triangle". That rung is retired; each form below is the D4 form for one
// dot point, and each archetype joins at least two separate ideas:
//
//   dot point 0 · locating a point
//     reflection-triangle images in planes, axes or the origin — chained or
//                        separate (idea 1) — then the right angle found by
//                        Pythagoras on the three sides gives the area (idea 2);
//     parallelogram-octant three given vertices complete a parallelogram in
//                        three ways, since the diagonals bisect each other
//                        (idea 1); the named octant's strict signs pick exactly
//                        one, then a coordinate sum or an axis distance (idea 2);
//     lattice-octant     (minor share, small radii) an octant named X'OY'Z…
//                        fixes strict signs, so points on the coordinate planes
//                        are out (idea 1), and the distance from an axis is
//                        √(sum of the other two squares) while the distance
//                        from a plane is one |coordinate| (idea 2).
//   dot point 1 · the distance formula
//     equidistant-circle points of a coordinate plane equidistant from A and B
//                        lie on a line (idea 1); a given distance from O adds a
//                        quadratic, so there are two such points, both counted
//                        (idea 2);
//     right-angle-k      a right angle at C(k) is CA² + CB² = AB², a quadratic in
//                        k (idea 1), and a root that puts C on A or B gives no
//                        triangle and must be rejected (idea 2).
//   dot point 2 · the section formula
//     planes-meet        the ratio in which each of two coordinate planes divides
//                        AB, internal or external (idea 1), then the distance
//                        between the two points of division (idea 2);
//     two-positions      AC : CB = m : n on the LINE AB has an internal and an
//                        external solution (idea 1), each by the section formula,
//                        then a coordinate sum or the AC² values added (idea 2);
//     ratio-equidistant  P divides AB in an unknown ratio λ : 1 (idea 1) and is
//                        equidistant from C and D, which is linear in P and fixes
//                        λ; its sign says internal or external (idea 2).
//
// Scope is the NCERT Class 11 chapter as JEE Main and Advanced examine it:
// coordinates and octants, the distance formula and the section formula. No
// direction cosines, vectors, equations of planes or spheres (Class 12) are
// used in any prompt, hint or step.
//
// Provenance. Original, parameterised forms written for Pri Learning — not
// transcribed from NCERT exercises, the exemplar or past papers. Every key is
// computed from the drawn parameters, and
// client/test/support/india-jee-d4-3d-solvers.mjs re-derives each one from the
// rendered prompt by an independent route (brute-force lattice search,
// parametric lines, Heron's formula, numeric root scans). No human maths review
// yet; nothing here claims board or examiner approval.
//
// Asked for any rung other than D4, each generator returns its D4 form.
// ─────────────────────────────────────────────────────────────────────────────
import { ri, rc, nz, gcd, makeRng } from '../qhelpers.js';
import { exact as exactForm, frac, fracTex, traps } from './india-native-helpers.js';

/** An exact answer that also accepts its exact decimal (see india-class11-jee-hardest.js). */
function exact(f, suffix) {
  const out = exactForm(f, suffix);
  if (out.answer.simplestFraction) out.answer = { ...out.answer, requireFraction: false };
  return out;
}

// ── Exact rationals ──────────────────────────────────────────────────────────
const R = (n, d = 1) => frac(n, d);
const add = (x, y) => R(x.n * y.d + y.n * x.d, x.d * y.d);
const sub = (x, y) => R(x.n * y.d - y.n * x.d, x.d * y.d);
const mul = (x, y) => R(x.n * y.n, x.d * y.d);
const rTex = f => fracTex(f.n, f.d);

// ── Formatting ───────────────────────────────────────────────────────────────
const sg = k => (k >= 0 ? `+ ${k}` : `- ${Math.abs(k)}`);
const cx = (c, v = 'x') => (c === 1 ? v : c === -1 ? `-${v}` : `${c}${v}`);
function lin(a, b, v = 'x') {
  if (a === 0) return String(b);
  return b === 0 ? cx(a, v) : `${cx(a, v)} ${sg(b)}`;
}
function polyTex(coeffs, v = 'x') {
  const n = coeffs.length - 1;
  let out = '';
  coeffs.forEach((c, i) => {
    if (c === 0) return;
    const p = n - i;
    const body = p === 0 ? String(Math.abs(c)) : `${Math.abs(c) === 1 ? '' : Math.abs(c)}${v}${p === 1 ? '' : `^${p}`}`;
    if (!out) out = `${c < 0 ? '-' : ''}${body}`;
    else out += ` ${c < 0 ? '-' : '+'} ${body}`;
  });
  return out || '0';
}
/** "a·u + b·v" with zero terms left out. */
function lin2(a, u, b, v) {
  if (a === 0) return cx(b, v);
  if (b === 0) return cx(a, u);
  return `${cx(a, u)} ${b < 0 ? '-' : '+'} ${cx(Math.abs(b), v)}`;
}
const pt = (name, p) => `${name}(${p.join(', ')})`;
const ptR = (name, p) => `${name}\\left(${p.map(rTex).join(', ')}\\right)`;
const par = v => (v < 0 ? `(${v})` : String(v));
const isSq = n => n >= 0 && Math.round(Math.sqrt(n)) ** 2 === n;
/** √n simplified: 6, 2\sqrt{3}, \sqrt{41}. */
function surdTex(n) {
  let k = 1, r = n;
  for (let f = 2; f * f <= r; f++) while (r % (f * f) === 0) { r /= f * f; k *= f; }
  if (r === 1) return String(k);
  return k === 1 ? `\\sqrt{${r}}` : `${k}\\sqrt{${r}}`;
}
const AX = ['x', 'y', 'z'];
/** (a)² for a squared term: 13^2, (-6)^2, \left(\dfrac{13}{2}\right)^2. */
const sqTerm = f => (f.d === 1 ? `${par(f.n)}^2` : `\\left(${rTex(f)}\\right)^2`);
/** A rational written after "+": 3, (-6), \left(-\dfrac{9}{2}\right). */
const addend = f => (f.n >= 0 ? rTex(f) : f.d === 1 ? `(${f.n})` : `\\left(${rTex(f)}\\right)`);
/** "a + bλ", with a zero term left out. */
const lamLin = (a, b) => (b === 0 ? String(a) : a === 0 ? cx(b, '\\lambda') : `${a} ${b < 0 ? '-' : '+'} ${Math.abs(b) === 1 ? '' : Math.abs(b)}\\lambda`);
const sumSq = p => p.reduce((s, v) => s + v * v, 0);
const d2 = (p, q) => p.reduce((s, v, i) => s + (v - q[i]) ** 2, 0);

const FALLBACK_SEED = 0x33444434;   // "3DD4"

// ═════════════════════════════════════════════════════════════════════════════
// Dot point 0 · Locate a point by its coordinates in three dimensions
// ═════════════════════════════════════════════════════════════════════════════

/** The eight octants as NCERT names them, with the signs of (x, y, z). */
const OCTANTS = [
  { name: "XOYZ", s: [1, 1, 1] }, { name: "X'OYZ", s: [-1, 1, 1] }, { name: "X'OY'Z", s: [-1, -1, 1] }, { name: "XOY'Z", s: [1, -1, 1] },
  { name: "XOYZ'", s: [1, 1, -1] }, { name: "X'OYZ'", s: [-1, 1, -1] }, { name: "X'OY'Z'", s: [-1, -1, -1] }, { name: "XOY'Z'", s: [1, -1, -1] }
];
const signWord = s => (s > 0 ? 'positive' : 'negative');

/** Mirrors: the coordinates each one changes the sign of (bit 0 = x, 1 = y, 2 = z). */
const MIRRORS = [
  { tex: 'the $xy$-plane', mask: 0b100 }, { tex: 'the $yz$-plane', mask: 0b001 }, { tex: 'the $zx$-plane', mask: 0b010 },
  { tex: 'the $x$-axis', mask: 0b110, axis: 0 }, { tex: 'the $y$-axis', mask: 0b101, axis: 1 }, { tex: 'the $z$-axis', mask: 0b011, axis: 2 },
  { tex: 'the origin', mask: 0b111 }
];
const flip = (p, mask) => p.map((v, i) => (mask >> i & 1 ? -v : v));
const maskSq = (p, mask) => p.reduce((s, v, i) => s + (mask >> i & 1 ? v * v : 0), 0);

/** Exact area of a triangle from its squared sides, or null when it is not rational. */
function heronArea(a2, b2, c2) {
  const N = 4 * a2 * b2 - (a2 + b2 - c2) ** 2;     // 16·Area²
  if (N <= 0 || !isSq(N)) return null;
  return Math.round(Math.sqrt(N)) / 4;
}

/** At least two traps on every draw; the kind is redrawn otherwise. */
function pointReasoning(rng) {
  let q = null;
  for (let tries = 0; tries < 60; tries++) {
    q = pointCore(rng);
    if (q.traps.length >= 2) return { ...q, traps: q.traps.slice(0, 3) };
  }
  return q;
}

function pointCore(rng) {
  // Mostly the two genuinely two-idea archetypes; the lattice count, which is
  // tedious for large radii, keeps small radii and a minor share.
  const u0 = rng();
  const kind = u0 < 0.4 ? 'reflection-triangle' : u0 < 0.8 ? 'parallelogram-octant' : 'lattice-octant';
  for (let guard = 0; guard < 2000; guard++) {
    if (kind === 'parallelogram-octant') {
      const A = [ri(rng, -6, 6), ri(rng, -6, 6), ri(rng, -6, 6)];
      const B = [ri(rng, -6, 6), ri(rng, -6, 6), ri(rng, -6, 6)];
      const C = [ri(rng, -6, 6), ri(rng, -6, 6), ri(rng, -6, 6)];
      const u = B.map((b, t) => b - A[t]), v = C.map((c, t) => c - A[t]);
      const cross = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
      if (cross.every(t => t === 0)) continue;              // collinear: no parallelogram
      // The diagonals bisect each other, so the fourth vertex is the sum of the
      // ends of a diagonal minus the opposite vertex — three possibilities.
      const cand = [
        { tex: 'A + B - C', D: A.map((a, t) => a + B[t] - C[t]), diag: 'AB' },
        { tex: 'A + C - B', D: A.map((a, t) => a + C[t] - B[t]), diag: 'AC' },
        { tex: 'B + C - A', D: B.map((b, t) => b + C[t] - A[t]), diag: 'BC' }
      ];
      const ti = ri(rng, 0, 2), T = cand[ti].D;
      if (T.some(t => t === 0)) continue;
      const s = T.map(Math.sign);
      const oct = OCTANTS.find(o => o.s.every((x, k) => x === s[k]));
      const inOct = X => X.every((t, k) => Math.sign(t) === s[k]);
      const others = cand.filter((_, k) => k !== ti);
      if (others.some(c => inOct(c.D))) continue;
      // Prefer a decoy that misses the octant by one sign or by a zero coordinate.
      const near = others.some(c => c.D.filter((t, k) => Math.sign(t) === s[k]).length === 2);
      if (!near && rng() < 0.75) continue;
      const target = rc(rng, ['sum', 0, 1, 2]);
      const meas = X => (target === 'sum' ? X[0] + X[1] + X[2] : sumSq(X) - X[target] ** 2);
      const value = meas(T);
      if (value === 0) continue;
      const asked = target === 'sum' ? 'the sum of the coordinates of the fourth vertex' : `the square of the distance of the fourth vertex from the $${AX[target]}$-axis`;
      return {
        prompt: `Three of the vertices of a parallelogram are $${pt('A', A)}$, $${pt('B', B)}$ and $${pt('C', C)}$, and its fourth vertex lies in the octant $${oct.name}$. Find ${asked}.`,
        answerType: 'numeric', answer: { value },
        traps: traps(value, [
          ...others.map(c => ({ value: meas(c.D), why: `That is $${c.tex}$, the fourth vertex when $${c.diag}$ is a diagonal, and that point does not lie in the octant $${oct.name}$.` })),
          ...(target === 'sum' ? [] : [{ value: sumSq(T), why: `That is the square of the distance from the origin; the distance from the $${AX[target]}$-axis leaves out the $${AX[target]}$-coordinate.` }])
        ]),
        hints: [
          'The three given vertices need not be consecutive in the order they are named.',
          'The diagonals of a parallelogram bisect each other, so the fourth vertex is (one end of a diagonal) + (the other end) − (the opposite vertex). There are three ways to choose the diagonal.',
          'Read the signs of the coordinates off the name of the octant, and keep the one candidate that fits; a point with a zero coordinate lies in no octant.'
        ],
        steps: [
          { h: 'Three parallelograms', d: 'The fourth vertex is $A + B - C$, $A + C - B$ or $B + C - A$, coordinate by coordinate, according as $AB$, $AC$ or $BC$ is a diagonal' },
          { h: 'Candidates', d: cand.map(c => `$${c.tex} = (${c.D.join(', ')})$`).join(', ') },
          { h: 'The octant', d: `In $${oct.name}$: ${oct.s.map((x, k) => `$${AX[k]}$ ${signWord(x)}`).join(', ')}; only $(${T.join(', ')})$ fits` },
          { h: 'Answer', d: target === 'sum' ? `$${T[0]} ${sg(T[1])} ${sg(T[2])} = ${value}$` : `$${T.filter((_, k) => k !== target).map(t => `${par(t)}^2`).join(' + ')} = ${value}$` }
        ],
        reasoning: 'parallelogram-octant'
      };
    }
    if (kind === 'lattice-octant') {
      const oct = rc(rng, OCTANTS);
      const ax = ri(rng, 0, 2);
      const r = ri(rng, 3, 5), h = ri(rng, 2, 6);
      const strict = rng() < 0.5;
      const ok2 = (a, b) => (strict ? a * a + b * b < r * r : a * a + b * b <= r * r);
      let pairs = 0, pairs0 = 0;
      const perA = [];
      for (let a = 0; a <= r; a++) {
        let c = 0;
        for (let b = 0; b <= r; b++) if (ok2(a, b)) { pairs0++; if (a > 0 && b > 0) { pairs++; c++; } }
        if (a > 0 && c > 0) perA.push([a, c]);
      }
      if (pairs < 3) continue;
      const value = pairs * h;
      const other = AX.filter((_, i) => i !== ax);
      const plane = ['yz', 'zx', 'xy'][ax];
      let flipPairs = 0;
      for (let a = 1; a <= r; a++) for (let b = 1; b <= r; b++) if (strict ? a * a + b * b <= r * r : a * a + b * b < r * r) flipPairs++;
      return {
        prompt: `How many points with integer coordinates lie in the octant $${oct.name}$, are at a distance ${strict ? 'less than' : 'of at most'} $${r}$ from the $${AX[ax]}$-axis, and are at a distance of at most $${h}$ from the $${plane}$-plane?`,
        answerType: 'numeric', answer: { value },
        traps: traps(value, [
          { value: pairs0 * (h + 1), why: 'Points with a zero coordinate lie on a coordinate plane, and a coordinate plane belongs to no octant.' },
          { value: 8 * value, why: `That counts all eight octants, not just $${oct.name}$.` },
          { value: flipPairs * h, why: strict ? `"Less than $${r}$" leaves out the points exactly $${r}$ from the axis.` : `"At most $${r}$" keeps the points exactly $${r}$ from the axis.` }
        ]),
        hints: [
          `Read the signs of $x$, $y$, $z$ off the name of the octant; a point of an octant has no zero coordinate.`,
          `The distance of $(x, y, z)$ from the $${AX[ax]}$-axis is $\\sqrt{${other[0]}^2 + ${other[1]}^2}$, and its distance from the $${plane}$-plane is $|${AX[ax]}|$.`,
          `Count the pairs $(|${other[0]}|, |${other[1]}|)$ of positive integers first, then multiply by the number of choices for $${AX[ax]}$.`
        ],
        steps: [
          { h: 'Signs', d: `In $${oct.name}$: ${oct.s.map((s, i) => `$${AX[i]}$ ${signWord(s)}`).join(', ')} — every coordinate non-zero` },
          { h: 'Distance from the axis', d: `$${other[0]}^2 + ${other[1]}^2 ${strict ? '<' : '\\le'} ${r * r}$ with $|${other[0]}|, |${other[1]}| \\ge 1$` },
          { h: 'Count the pairs', d: `${perA.map(([a, c]) => `$|${other[0]}| = ${a}$: ${c}`).join('; ')} — in all ${pairs} pairs` },
          { h: 'Distance from the plane', d: `$1 \\le |${AX[ax]}| \\le ${h}$ with the sign fixed: ${h} choices` },
          { h: 'Answer', d: `$${pairs} \\times ${h} = ${value}$` }
        ],
        reasoning: 'lattice-octant'
      };
    }
    // reflection-triangle
    const P = [nz(rng, -9, 9), nz(rng, -9, 9), nz(rng, -9, 9)];
    const e1 = rc(rng, MIRRORS);
    let e2 = rc(rng, MIRRORS);
    if (e2 === e1) continue;
    const chain = rng() < 0.5;
    const fQ = e1.mask, fR = chain ? e1.mask ^ e2.mask : e2.mask;
    if (fR === 0 || fR === fQ) continue;
    const fQR = fQ ^ fR;
    // Right angle where the two sides through a vertex change disjoint coordinates.
    let at, legs;
    if ((fQ & fR) === 0) { at = 'P'; legs = [['PQ', fQ], ['PR', fR]]; }
    else if ((fQ & ~fR & 7) === 0) { at = 'Q'; legs = [['PQ', fQ], ['QR', fQR]]; }
    else if ((fR & ~fQ & 7) === 0) { at = 'R'; legs = [['PR', fR], ['QR', fQR]]; }
    else continue;
    const S1 = maskSq(P, legs[0][1]), S2 = maskSq(P, legs[1][1]);
    if (!isSq(S1 * S2)) continue;
    const value = 2 * Math.round(Math.sqrt(S1 * S2));
    const Q = flip(P, fQ), Rp = flip(P, fR);
    const PQ2 = 4 * maskSq(P, fQ), PR2 = 4 * maskSq(P, fR), QR2 = 4 * maskSq(P, fQR);
    const side2 = { PQ: PQ2, PR: PR2, QR: QR2 };
    const hyp = ['PQ', 'PR', 'QR'].find(s => !legs.some(l => l[0] === s));
    // Misreadings, each a definite slip.
    const axisSlip = [e1, e2].some(e => e.axis !== undefined);
    const slipMask = e => (e.axis !== undefined ? 1 << e.axis : e.mask);
    let slipArea = null;
    if (axisSlip) {
      const sQ = slipMask(e1), sR = chain ? slipMask(e1) ^ slipMask(e2) : slipMask(e2);
      if (sQ && sR && sQ !== sR) slipArea = heronArea(4 * maskSq(P, sQ), 4 * maskSq(P, sR), 4 * maskSq(P, sQ ^ sR));
    }
    const forkArea = chain && e2.mask !== e1.mask ? heronArea(4 * maskSq(P, e1.mask), 4 * maskSq(P, e2.mask), 4 * maskSq(P, e1.mask ^ e2.mask)) : null;
    const prompt = chain
      ? `The point $${pt('P', P)}$ is reflected in ${e1.tex} to give $Q$, and $Q$ is then reflected in ${e2.tex} to give $R$. Find the area of triangle $PQR$.`
      : `$Q$ is the image of the point $${pt('P', P)}$ in ${e1.tex}, and $R$ is the image of $P$ in ${e2.tex}. Find the area of triangle $PQR$.`;
    return {
      prompt,
      answerType: 'numeric', answer: { value },
      traps: traps(value, [
        { value: 2 * value, why: 'That is the product of the two perpendicular sides; the area of a right triangle is half of it.' },
        { value: value / 2, why: 'Only one factor of $\\dfrac{1}{2}$ belongs in the area: half the product of the two perpendicular sides.' },
        ...(slipArea !== null ? [{ value: slipArea, why: 'Reflecting in an axis keeps the coordinate along that axis and changes the sign of the other two.' }] : []),
        ...(forkArea !== null ? [{ value: forkArea, why: '$R$ is the image of $Q$, not of $P$: the two reflections are applied one after the other.' }] : [])
      ]),
      hints: [
        'The image in a coordinate plane changes the sign of one coordinate; the image in an axis keeps that axis\'s coordinate and changes the other two; the image in the origin changes all three.',
        'Find $PQ^2$, $QR^2$ and $PR^2$ by the distance formula.',
        'If the squares of two sides add up to the square of the third, the triangle is right-angled and its area is half the product of the two shorter sides.'
      ],
      steps: [
        { h: 'The images', d: `$${pt('Q', Q)}$ and $${pt('R', Rp)}$` },
        { h: 'Squares of the sides', d: `$PQ^2 = ${PQ2}$, $QR^2 = ${QR2}$, $PR^2 = ${PR2}$` },
        { h: 'Right angle', d: `$${legs[0][0]}^2 + ${legs[1][0]}^2 = ${side2[legs[0][0]]} + ${side2[legs[1][0]]} = ${side2[hyp]} = ${hyp}^2$, so the right angle is at $${at}$` },
        { h: 'Area', d: `$\\dfrac{1}{2} \\times ${surdTex(side2[legs[0][0]])} \\times ${surdTex(side2[legs[1][0]])} = ${value}$` }
      ],
      reasoning: 'reflection-triangle'
    };
  }
  return pointCore(makeRng(FALLBACK_SEED));
}

// ═════════════════════════════════════════════════════════════════════════════
// Dot point 1 · Find the distance between two points in space
// ═════════════════════════════════════════════════════════════════════════════

/** Radii² with several lattice points on the circle u² + v² = N. */
const CIRCLE_NORMS = [5, 10, 13, 17, 25, 26, 29, 34, 37, 41, 50, 65, 85];
const CIRCLE_PTS = Object.fromEntries(CIRCLE_NORMS.map(N => {
  const out = [];
  for (let a = -10; a <= 10; a++) for (let b = -10; b <= 10; b++) if (a * a + b * b === N) out.push([a, b]);
  return [N, out];
}));
const PLANES = [{ tex: '$yz$-plane', zero: 0 }, { tex: '$zx$-plane', zero: 1 }, { tex: '$xy$-plane', zero: 2 }];

/** At least two traps on every draw; the kind is redrawn otherwise. */
function distanceReasoning(rng) {
  let q = null;
  for (let tries = 0; tries < 60; tries++) {
    q = distanceCore(rng);
    if (q.traps.length >= 2) return { ...q, traps: q.traps.slice(0, 3) };
  }
  return q;
}

function distanceCore(rng) {
  // The right angle with a rejected root and the two-condition point carry the
  // form in equal shares.
  const kind = rng() < 0.5 ? 'equidistant-circle' : 'right-angle-k';
  for (let guard = 0; guard < 2000; guard++) {
    if (kind === 'equidistant-circle') {
      // Points of a coordinate plane equidistant from A and B lie on a line
      // there (idea 1); a given distance from O adds a circle, so there are two
      // such points (idea 2). Built from two lattice points P1, P2 of the circle.
      const plane = rc(rng, PLANES);
      const [i, j] = [0, 1, 2].filter(t => t !== plane.zero);
      const N = rc(rng, CIRCLE_NORMS);
      const q1 = rc(rng, CIRCLE_PTS[N]), q2 = rc(rng, CIRCLE_PTS[N]);
      if (q1[0] === q2[0] && q1[1] === q2[1]) continue;
      const P1 = [0, 0, 0], P2 = [0, 0, 0];
      P1[i] = q1[0]; P1[j] = q1[1]; P2[i] = q2[0]; P2[j] = q2[1];
      // w = B − A: its in-plane part is perpendicular to P1P2.
      const dx = q1[0] - q2[0], dy = q1[1] - q2[1], g0 = gcd(dx, dy);
      const sc = rc(rng, [1, -1, 2, -2]);
      const w = [0, 0, 0];
      w[i] = (-dy / g0) * sc; w[j] = (dx / g0) * sc; w[plane.zero] = ri(rng, -3, 3);
      if (w.some(t => Math.abs(t) > 6)) continue;
      const W2 = sumSq(w);
      if (W2 % 2) continue;
      // PA = PB at P1: A·w = P1·w − |w|²/2.
      const rhs = P1.reduce((acc, p, t) => acc + p * w[t], 0) - W2 / 2;
      const ts = rc(rng, [0, 1, 2].filter(t => w[t] !== 0));
      const A = [ri(rng, -8, 8), ri(rng, -8, 8), ri(rng, -8, 8)];
      const rest = A.reduce((acc, a, t) => (t === ts ? acc : acc + a * w[t]), 0);
      if ((rhs - rest) % w[ts] !== 0) continue;
      A[ts] = (rhs - rest) / w[ts];
      const B = A.map((a, t) => a + w[t]);
      if ([...A, ...B].some(t => Math.abs(t) > 12)) continue;
      const askPA = rng() < 0.5;
      const c = rc(rng, [i, j]);
      const value = askPA ? d2(P1, A) + d2(P2, A) : P1[c] + P2[c];
      if (value === 0) continue;
      // The line on the plane: a·u + b·v = e, reduced.
      let a = 2 * w[i], b = 2 * w[j], e = sumSq(B) - sumSq(A);
      const g1 = gcd(gcd(a, b), e) * ((a || b) < 0 ? -1 : 1);
      a /= g1; b /= g1; e /= g1;
      const vi = AX[i], vj = AX[j];
      // Eliminate v (or u when b = 0) and show the quadratic.
      let elim;
      if (b !== 0) {
        const Qc = [a * a + b * b, -2 * a * e, e * e - b * b * N];
        const gq = gcd(gcd(Qc[0], Qc[1]), Qc[2]);
        const vSub = Math.abs(b) === 1 ? lin(-a * b, e * b, vi) : `\\dfrac{${lin(-a, e, vi)}}{${b}}`;
        elim = `Substituting $${vj} = ${vSub}$: $${polyTex(Qc.map(t => t / gq), vi)} = 0$, so $${vi} = ${P1[i]}$ or $${vi} = ${P2[i]}$`;
      } else {
        elim = `$${vi} = ${rTex(R(e, a))}$, so $${vj}^2 = ${N - (e / a) ** 2}$ and $${vj} = ${P1[j]}$ or $${vj} = ${P2[j]}$`;
      }
      const asked = askPA ? 'the sum of the values of $PA^2$ over all such points $P$' : `the sum of the $${AX[c]}$-coordinates of all such points $P$`;
      return {
        prompt: `Find every point $P$ of the ${plane.tex} that is equidistant from $${pt('A', A)}$ and $${pt('B', B)}$ and is at a distance $${surdTex(N)}$ from the origin. Give ${asked}.`,
        answerType: 'numeric', answer: { value },
        traps: traps(value, [
          { value: askPA ? d2(P1, A) : P1[c], why: 'That counts only one point: the points equidistant from $A$ and $B$ form a line on the plane, and it meets the circle about $O$ twice.' },
          { value: askPA ? d2(P2, A) : P2[c], why: 'That counts only one point: there are two points satisfying both conditions.' },
          askPA ? { value: 2 * N, why: 'That adds $OP^2$ for the two points, not $PA^2$.' }
            : { value: P1[i] + P1[j] + P2[i] + P2[j], why: `That adds every coordinate of both points; the question asks only for the $${AX[c]}$-coordinates.` }
        ]),
        hints: [
          `On the ${plane.tex}, $${AX[plane.zero]} = 0$; write $P$ with its other two coordinates unknown.`,
          '$PA = PB$ is the same as $PA^2 = PB^2$; the squared terms cancel, leaving a linear equation.',
          'The distance from the origin gives a second, quadratic, equation; solve the two together and keep every solution.'
        ],
        steps: [
          { h: 'PA² = PB²', d: `$${lin2(a, vi, b, vj)} = ${e}$` },
          { h: 'Distance from O', d: `$${vi}^2 + ${vj}^2 = ${N}$` },
          { h: 'Solve together', d: elim },
          { h: 'The points', d: `$${pt('P_1', P1)}$ and $${pt('P_2', P2)}$` },
          { h: 'Answer', d: askPA ? `$${d2(P1, A)} + ${d2(P2, A)} = ${value}$` : `$${P1[c]} ${sg(P2[c])} = ${value}$` }
        ],
        reasoning: 'equidistant-circle'
      };
    }
    // right-angle-k. A right angle at C puts C on the sphere with diameter AB,
    // so build the line through two lattice points C1, C2 of that sphere: the
    // quadratic then has the integer roots k1, k2 by construction. Choosing C1
    // to be A or B gives a root with no triangle, to be rejected.
    const A = [ri(rng, -6, 6), ri(rng, -6, 6), ri(rng, -6, 6)];
    const B = [ri(rng, -6, 6), ri(rng, -6, 6), ri(rng, -6, 6)];
    if (d2(A, B) < 6) continue;
    const onSphere = [];
    const lo = A.map((a, t) => Math.min(a, B[t]) - 6), hi = A.map((a, t) => Math.max(a, B[t]) + 6);
    for (let x = lo[0]; x <= hi[0]; x++) for (let y = lo[1]; y <= hi[1]; y++) for (let z = lo[2]; z <= hi[2]; z++) {
      const c = [x, y, z];
      if (c.reduce((s, ct, t) => s + (ct - A[t]) * (ct - B[t]), 0) === 0) onSphere.push(c);
    }
    const isVertex = c => c.every((t, s) => t === A[s]) || c.every((t, s) => t === B[s]);
    const others = onSphere.filter(c => !isVertex(c));
    if (others.length < 2) continue;
    const reject = rng() < 0.5;
    const C1 = reject ? rc(rng, [A, B]) : rc(rng, others), C2 = rc(rng, others);
    if (C1 === C2) continue;
    const delta = C2.map((c, t) => c - C1[t]);
    const g = gcd(gcd(delta[0], delta[1]), delta[2]);
    const u = delta.map(t => t / g);
    if (u.filter(Boolean).length < 2 || u.some(t => Math.abs(t) > 3)) continue;
    const k1 = ri(rng, -5, 5), dir = rng() < 0.5 ? 1 : -1;
    const uu = u.map(t => t * dir);           // C(k1) = C1; C2 is reached at k1 ± g
    const v = C1.map((c, t) => c - uu[t] * k1);
    if (v.some(t => Math.abs(t) > 14)) continue;
    const U = sumSq(uu);
    const V = uu.reduce((s, us, t) => s + us * (2 * v[t] - A[t] - B[t]), 0);
    const W = v.reduce((s, vs, t) => s + (vs - A[t]) * (vs - B[t]), 0);
    const disc = V * V - 4 * U * W;
    if (disc <= 0 || !isSq(disc)) continue;
    const sq = Math.round(Math.sqrt(disc));
    if ((-V + sq) % (2 * U) !== 0 || (-V - sq) % (2 * U) !== 0) continue;
    const roots = [(-V - sq) / (2 * U), (-V + sq) / (2 * U)];
    if (roots.some(k => Math.abs(k) > 15)) continue;
    const C = k => uu.map((us, t) => us * k + v[t]);
    const onVertex = k => { const c = C(k); return c.every((t, s) => t === A[s]) ? 'A' : c.every((t, s) => t === B[s]) ? 'B' : null; };
    const valid = roots.filter(k => !onVertex(k));
    if (!valid.length) continue;
    const value = valid.reduce((s, k) => s + k, 0);
    if (value === 0) continue;
    const Ck = uu.map((us, t) => lin(us, v[t], 'k'));
    // CA², CB² as quadratics in k.
    const qA = [U, 2 * uu.reduce((s, us, t) => s + us * (v[t] - A[t]), 0), v.reduce((s, vs, t) => s + (vs - A[t]) ** 2, 0)];
    const qB = [U, 2 * uu.reduce((s, us, t) => s + us * (v[t] - B[t]), 0), v.reduce((s, vs, t) => s + (vs - B[t]) ** 2, 0)];
    const AB2 = d2(A, B);
    const bad = roots.filter(k => onVertex(k));
    // Right angle at A instead: AB² + AC² = BC² is linear in k.
    const linA = (() => {
      const c1 = qB[1] - qA[1], c0 = qB[2] - qA[2] - AB2;   // BC² − AC² − AB² = c1 k + c0 = 0
      return c1 === 0 ? null : -c0 / c1;
    })();
    return {
      prompt: `Let $${pt('A', A)}$ and $${pt('B', B)}$ be fixed points, and let $C(${Ck.join(', ')})$, where $k$ is real. Find the sum of all values of $k$ for which $A$, $B$ and $C$ are the vertices of a triangle with a right angle at $C$.`,
      answerType: 'numeric', answer: { value },
      traps: traps(value, [
        ...(bad.length ? [{ value: roots[0] + roots[1], why: `At $k = ${bad[0]}$ the point $C$ coincides with $${onVertex(bad[0])}$, so there is no triangle and that root is rejected.` }] : []),
        ...(valid.length === 2 ? [{ value: valid[0], why: 'The quadratic has two roots, and neither puts $C$ on $A$ or $B$: both count.' }] : []),
        { value: roots[0] * roots[1], why: 'That is the product of the roots of the quadratic, not the sum of the admissible values of $k$.' },
        ...(linA !== null && Number.isFinite(linA) ? [{ value: linA, why: 'That puts the right angle at $A$ ($AB^2 + AC^2 = BC^2$); the question puts it at $C$.' }] : [])
      ]),
      hints: [
        'A right angle at $C$ means $CA^2 + CB^2 = AB^2$ (Pythagoras and its converse).',
        'Write $CA^2$ and $CB^2$ in terms of $k$ by the distance formula; the condition becomes a quadratic in $k$.',
        'Check each root: if it puts $C$ on $A$ or on $B$ there is no triangle.'
      ],
      steps: [
        { h: 'Distances', d: `$CA^2 = ${polyTex(qA, 'k')}$, $CB^2 = ${polyTex(qB, 'k')}$, $AB^2 = ${AB2}$` },
        { h: 'Pythagoras at C', d: `$CA^2 + CB^2 = AB^2 \\iff ${polyTex([2 * U, qA[1] + qB[1], qA[2] + qB[2] - AB2], 'k')} = 0 \\iff ${polyTex([U, V, W], 'k')} = 0$` },
        { h: 'Roots', d: `$k = ${roots[0]}$ or $k = ${roots[1]}$` },
        { h: 'Reject degenerate', d: bad.length ? `At $k = ${bad[0]}$, $C = ${onVertex(bad[0])}$ — no triangle; keep $k = ${valid[0]}$` : `Neither root puts $C$ on $A$ or $B$; both give a triangle` },
        { h: 'Answer', d: valid.length === 2 ? `$${valid[0]} ${sg(valid[1])} = ${value}$` : `$${value}$` }
      ],
      reasoning: bad.length ? 'right-angle-reject' : 'right-angle-k'
    };
  }
  return distanceCore(makeRng(FALLBACK_SEED));
}

// ═════════════════════════════════════════════════════════════════════════════
// Dot point 2 · Apply the section formula in three dimensions
// ═════════════════════════════════════════════════════════════════════════════

/** The point dividing AB in the ratio λ : 1 (λ = p/q exact, λ ≠ −1): (A + λB)/(1 + λ). */
const divide = (A, B, p, q) => A.map((a, t) => R(q * a + p * B[t], q + p));
const dist2R = (X, Y) => X.reduce((s, x, t) => add(s, mul(sub(x, Y[t]), sub(x, Y[t]))), R(0));

/** At least two traps on every draw; the kind is redrawn otherwise. */
function sectionReasoning(rng) {
  let q = null;
  for (let tries = 0; tries < 60; tries++) {
    q = sectionCore(rng);
    if (q.traps.length >= 2) return { ...q, traps: q.traps.slice(0, 3) };
  }
  return q;
}

function sectionCore(rng) {
  const u0 = rng();
  const kind = u0 < 0.3 ? 'planes-meet' : u0 < 0.7 ? 'two-positions' : 'ratio-equidistant';
  for (let guard = 0; guard < 2000; guard++) {
    if (kind === 'planes-meet') {
      const A = [nz(rng, -8, 8), nz(rng, -8, 8), nz(rng, -8, 8)];
      const B = [nz(rng, -8, 8), nz(rng, -8, 8), nz(rng, -8, 8)];
      const [p1, p2] = [rc(rng, PLANES), rc(rng, PLANES)];
      if (p1 === p2) continue;
      const i = p1.zero, j = p2.zero;
      if (A[i] === B[i] || A[j] === B[j]) continue;
      // λ : 1 with A + λB having zero i-th coordinate: λ = −A_i / B_i.
      const lamP = R(-A[i], B[i]), lamQ = R(-A[j], B[j]);
      const P = divide(A, B, lamP.n, lamP.d), Q = divide(A, B, lamQ.n, lamQ.d);
      const value = dist2R(P, Q);
      if (value.n === 0 || value.d > 25 || value.value > 600) continue;
      // Inverting both ratios reflects P and Q through the midpoint of AB and
      // leaves PQ unchanged, so that is no trap. Taking an external ratio as
      // internal is one.
      const absP = divide(A, B, Math.abs(lamP.n), lamP.d), absQ = divide(A, B, Math.abs(lamQ.n), lamQ.d);
      const anyExternal = lamP.n < 0 || lamQ.n < 0;
      // λ taken as +A_i/B_i (the minus sign dropped).
      const signSlip = A[i] + B[i] !== 0 && A[j] + B[j] !== 0 ? dist2R(divide(A, B, A[i], B[i]), divide(A, B, A[j], B[j])).value : null;
      const way = l => (l.n > 0 ? 'internally' : 'externally');
      const lamTex = l => `${Math.abs(l.n)} : ${l.d}`;
      return {
        prompt: `The line through $${pt('A', A)}$ and $${pt('B', B)}$ meets the ${p1.tex} at $P$ and the ${p2.tex} at $Q$. Find $PQ^2$.`,
        answerType: 'numeric', ...exact(value),
        traps: traps(value.value, [
          ...(anyExternal ? [{ value: dist2R(absP, absQ).value, why: 'A plane that does not cross the segment $AB$ divides it externally: $\\lambda$ is negative and the point lies outside the segment.' }] : []),
          { value: d2(A, B), why: 'That is $AB^2$, the whole segment; $P$ and $Q$ are not $A$ and $B$.' },
          ...(signSlip !== null ? [{ value: signSlip, why: 'On the plane the coordinate is $0$, so $x_A + \\lambda x_B = 0$ (or its $y$ or $z$ form) gives $\\lambda$ with a minus sign.' }] : [])
        ]),
        hints: [
          `Let $P$ divide $AB$ in the ratio $\\lambda : 1$; on the ${p1.tex} its $${AX[i]}$-coordinate is $0$.`,
          'A positive $\\lambda$ means the plane cuts the segment between $A$ and $B$ (internal division); a negative one, outside it (external division).',
          `Find $Q$ the same way from the ${p2.tex}, then use the distance formula.`
        ],
        steps: [
          { h: `Ratio for the ${p1.tex.replace(/\$/g, '')}`, d: `$\\dfrac{${lamLin(A[i], B[i])}}{\\lambda + 1} = 0 \\Rightarrow \\lambda = ${rTex(lamP)}$: $P$ divides $AB$ ${way(lamP)} in the ratio $${lamTex(lamP)}$` },
          { h: 'P', d: `$${ptR('P', P)}$` },
          { h: `Ratio for the ${p2.tex.replace(/\$/g, '')}`, d: `$\\dfrac{${lamLin(A[j], B[j])}}{\\lambda + 1} = 0 \\Rightarrow \\lambda = ${rTex(lamQ)}$: $Q$ divides $AB$ ${way(lamQ)} in the ratio $${lamTex(lamQ)}$, and $${ptR('Q', Q)}$` },
          { h: 'Distance', d: `$PQ^2 = ${P.map((x, t) => sqTerm(sub(x, Q[t]))).join(' + ')} = ${rTex(value)}$` }
        ],
        reasoning: 'planes-meet'
      };
    }
    if (kind === 'two-positions') {
      const A = [ri(rng, -9, 9), ri(rng, -9, 9), ri(rng, -9, 9)];
      const B = [ri(rng, -9, 9), ri(rng, -9, 9), ri(rng, -9, 9)];
      const m = ri(rng, 1, 5), n = ri(rng, 1, 5);
      if (m === n || gcd(m, n) !== 1 || d2(A, B) === 0) continue;
      const Ci = A.map((a, t) => R(n * a + m * B[t], m + n));
      const Ce = A.map((a, t) => R(m * B[t] - n * a, m - n));
      const askGap = rng() < 0.4;
      const c = ri(rng, 0, 2);
      if (!askGap && A[c] === B[c]) continue;
      const Ar = A.map(a => R(a));
      const ACi = dist2R(Ar, Ci), ACe = dist2R(Ar, Ce);
      const value = askGap ? add(ACi, ACe) : add(Ci[c], Ce[c]);
      if (value.n === 0 || value.d > 30 || Math.abs(value.value) > 800) continue;
      const CeSlip = A.map((a, t) => R(m * B[t] + n * a, m - n));
      return {
        prompt: `The point $C$ lies on the line through $${pt('A', A)}$ and $${pt('B', B)}$, and $AC : CB = ${m} : ${n}$. ${askGap ? 'Find the sum of the values of $AC^2$ over all such points $C$.' : `Find the sum of the $${AX[c]}$-coordinates of all such points $C$.`}`,
        answerType: 'numeric', ...exact(value),
        traps: traps(value.value, askGap
          ? [{ value: ACi.value, why: `That counts only the point between $A$ and $B$; a point outside the segment, dividing $AB$ externally in the ratio $${m} : ${n}$, also has $AC : CB = ${m} : ${n}$.` },
            { value: ACe.value, why: `That counts only the external point; the point dividing $AB$ internally in the ratio $${m} : ${n}$ also qualifies.` },
            { value: add(ACi, dist2R(Ar, CeSlip)).value, why: 'The external division formula subtracts: $\\dfrac{mB - nA}{m - n}$.' }]
          : [{ value: Ci[c].value, why: `That counts only the point between $A$ and $B$; a point outside the segment, dividing $AB$ externally in the ratio $${m} : ${n}$, also has $AC : CB = ${m} : ${n}$.` },
            { value: Ce[c].value, why: `That counts only the external point; the point dividing $AB$ internally in the ratio $${m} : ${n}$ also qualifies.` },
            { value: value.value / 2, why: 'That is the average of the two coordinates (the midpoint of the two points), not their sum.' }]),
        hints: [
          '$AC : CB$ is a ratio of lengths, so $C$ may lie between $A$ and $B$ or outside the segment on the line.',
          'Internal division in $m : n$ gives $\\dfrac{mB + nA}{m + n}$; external division gives $\\dfrac{mB - nA}{m - n}$.',
          askGap ? 'Find every such point, then each value of $AC^2$ by the distance formula.' : 'Find every such point and add the required coordinates.'
        ],
        steps: [
          { h: 'Two positions', d: `On the line $AB$, $AC : CB = ${m} : ${n}$ holds for one point inside the segment and one outside it (since $${m} \\ne ${n}$)` },
          { h: 'Internal', d: `$${ptR('C_1', Ci)}$` },
          { h: 'External', d: `$${ptR('C_2', Ce)}$` },
          ...(askGap ? [{ h: 'Distances from A', d: `$AC_1^2 = ${Ci.map((x, t) => sqTerm(sub(x, Ar[t]))).join(' + ')} = ${rTex(ACi)}$ and $AC_2^2 = ${Ce.map((x, t) => sqTerm(sub(x, Ar[t]))).join(' + ')} = ${rTex(ACe)}$` }] : []),
          { h: 'Answer', d: askGap ? `$${rTex(ACi)} + ${rTex(ACe)} = ${rTex(value)}$` : `$${rTex(Ci[c])} + ${addend(Ce[c])} = ${rTex(value)}$` }
        ],
        reasoning: askGap ? 'two-positions-ac' : 'two-positions-sum'
      };
    }
    // ratio-equidistant: P divides AB in λ : 1 (idea 1, section formula with
    // an unknown ratio); PC = PD is linear in P's coordinates and fixes λ
    // (idea 2); the sign of λ says internal or external.
    const A = [ri(rng, -7, 7), ri(rng, -7, 7), ri(rng, -7, 7)];
    const B = [ri(rng, -7, 7), ri(rng, -7, 7), ri(rng, -7, 7)];
    const C = [ri(rng, -7, 7), ri(rng, -7, 7), ri(rng, -7, 7)];
    const D = [ri(rng, -7, 7), ri(rng, -7, 7), ri(rng, -7, 7)];
    if (d2(A, B) === 0 || d2(C, D) === 0) continue;
    const w = D.map((d, t) => d - C[t]);
    const cc = sumSq(D) - sumSq(C);
    const wA = 2 * w.reduce((acc, wt, t) => acc + wt * A[t], 0), wB = 2 * w.reduce((acc, wt, t) => acc + wt * B[t], 0);
    // 2w·(A + λB) = cc(1 + λ)  ⇔  λ(wB − cc) = cc − wA.
    const num = cc - wA, den = wB - cc;
    if (den === 0 || num === 0 || num === -den) continue;   // no point, P = A, or the line is parallel
    const lam = R(num, den);
    const value = R(Math.abs(lam.n), lam.d);
    if (value.d > 9 || value.n > 30) continue;
    if (lam.n > 0 && rng() < 0.4) continue;                 // external division in about half the draws
    const P = divide(A, B, lam.n, lam.d);
    const tA = R(Math.abs(lam.n), Math.abs(lam.n + lam.d));  // AP/AB
    const gEq = gcd(gcd(gcd(2 * w[0], 2 * w[1]), 2 * w[2]), cc);
    const eqTex = (() => {
      const co = w.map(t => (2 * t) / gEq);
      let out = '';
      co.forEach((k, t) => {
        if (k === 0) return;
        const body = `${Math.abs(k) === 1 ? '' : Math.abs(k)}${AX[t]}`;
        out += out ? ` ${k < 0 ? '-' : '+'} ${body}` : `${k < 0 ? '-' : ''}${body}`;
      });
      return `${out} = ${cc / gEq}`;
    })();
    return {
      prompt: `The point $P$ lies on the line through $${pt('A', A)}$ and $${pt('B', B)}$, and $P$ is equidistant from $${pt('C', C)}$ and $${pt('D', D)}$. Find $\\dfrac{AP}{PB}$.`,
      answerType: 'numeric', ...exact(value),
      traps: traps(value.value, [
        { value: R(value.d, value.n).value, why: 'That is $\\dfrac{PB}{AP}$: if $P$ divides $AB$ in the ratio $\\lambda : 1$, then $AP : PB = \\lambda : 1$.' },
        { value: tA.value, why: 'That is $\\dfrac{AP}{AB}$, the fraction of the whole of $AB$, not $\\dfrac{AP}{PB}$.' },
        ...(lam.n < 0 ? [{ value: lam.value, why: 'A ratio of lengths is positive; a negative $\\lambda$ only records that $P$ lies outside the segment $AB$.' }] : [])
      ]),
      hints: [
        'Let $P$ divide $AB$ in the ratio $\\lambda : 1$ and write its coordinates by the section formula.',
        '$PC = PD$ is the same as $PC^2 = PD^2$; the squares of the coordinates of $P$ cancel and a linear equation is left.',
        'Substitute the coordinates of $P$ and solve for $\\lambda$; a negative $\\lambda$ means external division, and the ratio of lengths is $|\\lambda|$.'
      ],
      steps: [
        { h: 'Section formula', d: `$P = \\left(${A.map((a, t) => `\\dfrac{${lamLin(a, B[t])}}{\\lambda + 1}`).join(', ')}\\right)$` },
        { h: 'PC² = PD²', d: `With $P = (x, y, z)$ the squares cancel: $${eqTex}$` },
        { h: 'Solve for λ', d: `Clearing $\\lambda + 1$: $${lin(den / gEq, 0, '\\lambda')} = ${num / gEq}$, so $\\lambda = ${rTex(lam)}$ and $${ptR('P', P)}$` },
        { h: 'Answer', d: `$P$ divides $AB$ ${lam.n > 0 ? 'internally' : 'externally'}, and $\\dfrac{AP}{PB} = |\\lambda| = ${rTex(value)}$` }
      ],
      reasoning: lam.n > 0 ? 'ratio-equidistant-internal' : 'ratio-equidistant-external'
    };
  }
  return sectionCore(makeRng(FALLBACK_SEED));
}

// ═════════════════════════════════════════════════════════════════════════════

/** One rung, D4: every other rung returns the same form. */
const d4 = form => (rng, _diff) => form(rng);

export const forms = Object.freeze({
  'c11-3d-point-jee-reasoning': d4(pointReasoning),
  'c11-3d-distance-jee-reasoning': d4(distanceReasoning),
  'c11-3d-section-jee-reasoning': d4(sectionReasoning)
});
