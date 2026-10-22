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
//     axis-distances     distances from the three axes give a system in x², y², z²
//                        (idea 1), and the named octant fixes the signs (idea 2);
//     lattice-octant     an octant named X'OY'Z… fixes strict signs, so points on
//                        the coordinate planes are out (idea 1), and the distance
//                        from an axis is √(sum of the other two squares) while the
//                        distance from a plane is one |coordinate| (idea 2);
//     reflection-triangle images in planes, axes or the origin — chained or
//                        separate (idea 1) — then the right angle found by
//                        Pythagoras on the three sides gives the area (idea 2).
//   dot point 1 · the distance formula
//     equidistant-plane  PA = PB and PA = PC are each linear once the squares
//                        cancel (idea 1), solved on a coordinate plane (idea 2);
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
//     tetrahedron        the centroid of a tetrahedron averages four vertices and
//                        divides the line from a vertex to the centroid of the
//                        opposite face in 3 : 1 (idea 1), then a distance (idea 2).
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
/** "a + bλ" with b ≠ 0. */
const lamLin = (a, b) => `${a} ${b < 0 ? '-' : '+'} ${Math.abs(b) === 1 ? '' : Math.abs(b)}\\lambda`;
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
  const kind = rc(rng, ['axis-distances', 'lattice-octant', 'reflection-triangle']);
  for (let guard = 0; guard < 2000; guard++) {
    if (kind === 'axis-distances') {
      const oct = rc(rng, OCTANTS);
      const mag = [ri(rng, 1, 9), ri(rng, 1, 9), ri(rng, 1, 9)];
      if (mag[0] === mag[1] && mag[1] === mag[2]) continue;
      const P = mag.map((v, i) => v * oct.s[i]);
      const [x, y, z] = P;
      const m = y * y + z * z, n = z * z + x * x, p = x * x + y * y;
      const askSum = rng() < 0.6;
      const c = ri(rng, 0, 2);                   // the coordinate asked for otherwise
      const value = askSum ? x + y + z : P[c];
      if (value === 0) continue;
      const absVal = askSum ? mag[0] + mag[1] + mag[2] : mag[c];
      const wrongOct = OCTANTS.find(o => o.s.every((s, i) => s === -oct.s[i]));
      // Pairing each distance with its own axis (|x| from √(n + p − m)… taken as √(m + n − p)…).
      const pm = [mag[2], mag[0], mag[1]].map((v, i) => v * oct.s[i]);
      const pairSlip = askSum ? pm[0] + pm[1] + pm[2] : pm[c];
      return {
        prompt: `A point $P$ lies in the octant $${oct.name}$. Its distances from the $x$-axis, the $y$-axis and the $z$-axis are $${surdTex(m)}$, $${surdTex(n)}$ and $${surdTex(p)}$ respectively. Find ${askSum ? 'the sum of the coordinates of $P$' : `the $${AX[c]}$-coordinate of $P$`}.`,
        answerType: 'numeric', answer: { value },
        traps: traps(value, [
          { value: absVal, why: `In the octant $${oct.name}$ the coordinates are ${oct.s.map((s, i) => `$${AX[i]}$ ${signWord(s)}`).join(', ')}; the signs cannot all be taken as positive unless the octant is $XOYZ$.` },
          { value: pairSlip, why: 'The squares are matched to the wrong coordinates: the distance from the $x$-axis involves $y$ and $z$ only, so $x^2$ is half of (the squares of the distances from the $y$- and $z$-axes, minus the square of the distance from the $x$-axis).' },
          { value: (m + n + p) / 2, why: `That is $OP^2 = x^2 + y^2 + z^2$, the square of the distance from the origin, not ${askSum ? 'the sum of the coordinates' : `the $${AX[c]}$-coordinate`}.` },
          { value: -value, why: `That is the point in the opposite octant $${wrongOct.name}$; recheck which of the axes are the negative ones.` }
        ]),
        hints: [
          'The distance of $(x, y, z)$ from the $x$-axis is $\\sqrt{y^2 + z^2}$; the other two axes are alike.',
          'Square the three distances and add: each of $x^2$, $y^2$, $z^2$ appears twice.',
          'Each square gives a coordinate up to sign; the octant decides the sign.'
        ],
        steps: [
          { h: 'Three equations', d: `$y^2 + z^2 = ${m}$, $z^2 + x^2 = ${n}$, $x^2 + y^2 = ${p}$` },
          { h: 'Add them', d: `$2(x^2 + y^2 + z^2) = ${m + n + p}$, so $x^2 + y^2 + z^2 = ${(m + n + p) / 2}$` },
          { h: 'Each square', d: `$x^2 = ${x * x}$, $y^2 = ${y * y}$, $z^2 = ${z * z}$` },
          { h: 'Signs from the octant', d: `In $${oct.name}$: ${oct.s.map((s, i) => `$${AX[i]}$ ${signWord(s)}`).join(', ')}, so $${pt('P', P)}$` },
          { h: 'Answer', d: askSum ? `$${x} ${sg(y)} ${sg(z)} = ${value}$` : `$${AX[c]} = ${value}$` }
        ],
        reasoning: 'axis-distances'
      };
    }
    if (kind === 'lattice-octant') {
      const oct = rc(rng, OCTANTS);
      const ax = ri(rng, 0, 2);
      const r = ri(rng, 4, 9), h = ri(rng, 2, 7);
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

const NORMS = [9, 11, 14, 17, 18, 21, 22, 26, 27, 29, 30, 33, 34, 35, 38, 41];
const VECS = Object.fromEntries(NORMS.map(N => {
  const out = [];
  for (let a = -6; a <= 6; a++) for (let b = -6; b <= 6; b++) for (let c = -6; c <= 6; c++) if (a * a + b * b + c * c === N) out.push([a, b, c]);
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
  const kind = rc(rng, ['equidistant-plane', 'right-angle-k']);
  for (let guard = 0; guard < 2000; guard++) {
    if (kind === 'equidistant-plane') {
      const plane = rc(rng, PLANES);
      const [i, j] = [0, 1, 2].filter(t => t !== plane.zero);
      const P = [0, 0, 0];
      P[i] = ri(rng, -5, 5); P[j] = ri(rng, -5, 5);
      const N = rc(rng, NORMS);
      const vs = VECS[N];
      const pick = [rc(rng, vs), rc(rng, vs), rc(rng, vs)];
      const [A, B, C] = pick.map(d => d.map((v, t) => v + P[t]));
      if (new Set([A, B, C].map(String)).size < 3) continue;
      if ([A, B, C].some(X => X.every(v => v === 0))) continue;
      // PA² = PB²  ⇔  2(B − A)·X = |B|² − |A|², with X on the plane.
      const eq = (U, V) => [2 * (V[i] - U[i]), 2 * (V[j] - U[j]), sumSq(V) - sumSq(U)];
      const e1 = eq(A, B), e2 = eq(A, C);
      const det = e1[0] * e2[1] - e1[1] * e2[0];
      if (det === 0) continue;
      const askDist = rng() < 0.5;
      const value = askDist ? N : P[i] + P[j];
      if (value === 0) continue;
      const red = e => { const g = gcd(gcd(e[0], e[1]), e[2]) * ((e[0] || e[1]) < 0 ? -1 : 1); return e.map(v => v / g); };
      const r1 = red(e1), r2 = red(e2);
      const vi = AX[i], vj = AX[j];
      const cen = [i, j].map(t => R(A[t] + B[t] + C[t], 3));
      const linStep = (e, r) => `$${lin2(e[0], vi, e[1], vj)} = ${e[2]}$${r[0] === e[0] && r[1] === e[1] ? '' : `, i.e. $${lin2(r[0], vi, r[1], vj)} = ${r[2]}$`}`;
      return {
        prompt: `Find the point in the ${plane.tex} that is equidistant from $${pt('A', A)}$, $${pt('B', B)}$ and $${pt('C', C)}$. Give ${askDist ? 'the square of its distance from $A$' : 'the sum of its coordinates'}.`,
        answerType: 'numeric', answer: { value },
        traps: traps(value, askDist
          ? [{ value: sumSq(P), why: 'That is the square of its distance from the origin, not from $A$.' },
            { value: P[i] + P[j], why: 'That is the sum of the coordinates of the point, not the square of its distance from $A$.' }]
          : [{ value: add(cen[0], cen[1]).value, why: 'That is the projection of the centroid of triangle $ABC$; the centroid is not, in general, equidistant from the three vertices.' },
            { value: N, why: 'That is the square of the common distance, not the sum of the coordinates.' },
            { value: sumSq(P), why: 'That is the square of the distance of the point from the origin, not the sum of its coordinates.' }]),
        hints: [
          `On the ${plane.tex} the point is $P$ with $${AX[plane.zero]} = 0$; call its other coordinates $${vi}$ and $${vj}$.`,
          '$PA = PB$ is the same as $PA^2 = PB^2$; the squared terms in the unknowns cancel and a linear equation is left.',
          'Do the same with $PA = PC$, and solve the two linear equations together.'
        ],
        steps: [
          { h: 'PA² = PB²', d: linStep(e1, r1) },
          { h: 'PA² = PC²', d: linStep(e2, r2) },
          { h: 'Solve', d: `$${vi} = ${P[i]}$, $${vj} = ${P[j]}$, so the point is $${pt('P', P)}$` },
          { h: 'Answer', d: askDist ? `$PA^2 = ${A.map((v, t) => `${par(v - P[t])}^2`).join(' + ')} = ${N}$` : `$${P[i]} ${sg(P[j])} = ${value}$` }
        ],
        reasoning: 'equidistant-plane'
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
  const kind = rc(rng, ['planes-meet', 'two-positions', 'tetrahedron']);
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
    // tetrahedron
    if (rng() < 0.5) {
      const A = [ri(rng, -9, 9), ri(rng, -9, 9), ri(rng, -9, 9)];
      const B = [ri(rng, -9, 9), ri(rng, -9, 9), ri(rng, -9, 9)];
      const C = [ri(rng, -9, 9), ri(rng, -9, 9), ri(rng, -9, 9)];
      const G = [ri(rng, -4, 4), ri(rng, -4, 4), ri(rng, -4, 4)];
      const D = G.map((g, t) => 4 * g - A[t] - B[t] - C[t]);
      if (D.some(d => Math.abs(d) > 20 || d === 0)) continue;
      if (new Set([A, B, C, D].map(String)).size < 4) continue;
      const target = rc(rng, ['origin', 0, 1, 2]);
      const meas = X => (target === 'origin' ? sumSq(X) : sumSq(X) - X[target] ** 2);
      const value = meas(D);
      const D3 = G.map((g, t) => 3 * g - A[t] - B[t] - C[t]);
      const what = target === 'origin' ? 'the origin' : `the $${AX[target]}$-axis`;
      return {
        prompt: `In the tetrahedron $ABCD$, $${pt('A', A)}$, $${pt('B', B)}$, $${pt('C', C)}$, and the centroid of the tetrahedron is $${pt('G', G)}$. Find the square of the distance of $D$ from ${what}.`,
        answerType: 'numeric', answer: { value },
        traps: traps(value, [
          { value: meas(D3), why: 'That treats $G$ as the centroid of a triangle; the centroid of a tetrahedron is the average of its FOUR vertices.' },
          { value: meas(G), why: 'That measures the centroid $G$, not the vertex $D$.' },
          ...(target === 'origin' ? [] : [{ value: sumSq(D), why: `That is the distance from the origin; the distance from the $${AX[target]}$-axis leaves out the $${AX[target]}$-coordinate.` }])
        ]),
        hints: [
          'The centroid of a tetrahedron is $\\left(\\dfrac{x_1 + x_2 + x_3 + x_4}{4}, \\ldots\\right)$, the average of all four vertices.',
          'Use it backwards to find each coordinate of $D$.',
          target === 'origin' ? 'Then use the distance formula from $(0, 0, 0)$.' : `The distance of $(x, y, z)$ from the $${AX[target]}$-axis is the square root of the sum of the squares of the OTHER two coordinates.`
        ],
        steps: [
          { h: 'Centroid', d: `$G = \\dfrac{A + B + C + D}{4}$ coordinate by coordinate, so $D = 4G - A - B - C$` },
          { h: 'D', d: `$${pt('D', D)}$` },
          { h: 'Answer', d: target === 'origin' ? `$OD^2 = ${D.map(d => `${par(d)}^2`).join(' + ')} = ${value}$` : `$${D.filter((_, t) => t !== target).map(d => `${par(d)}^2`).join(' + ')} = ${value}$` }
        ],
        reasoning: 'tetrahedron-vertex'
      };
    }
    const G1 = [ri(rng, -7, 7), ri(rng, -7, 7), ri(rng, -7, 7)];
    const D = [ri(rng, -9, 9), ri(rng, -9, 9), ri(rng, -9, 9)];
    const L = d2(D, G1);
    if (L === 0) continue;
    const value = R(9 * L, 16);
    return {
      prompt: `In the tetrahedron $ABCD$, the vertex $D$ is $${pt('D', D)}$ and the centroid of the face $ABC$ is $${pt('G_1', G1)}$. If $G$ is the centroid of the tetrahedron, find $DG^2$.`,
      answerType: 'numeric', ...exact(value),
      traps: traps(value.value, [
        { value: L, why: 'That is $DG_1^2$; $G$ lies on $DG_1$ but only three quarters of the way from $D$.' },
        { value: R(4 * L, 9).value, why: 'Two-thirds of the way along a median is the rule for a triangle; for a tetrahedron the centroid is three quarters of the way from the vertex.' },
        { value: R(L, 16).value, why: 'That is $GG_1^2$, from the centroid to the face, not from $D$.' }
      ]),
      hints: [
        'The centroid of a tetrahedron averages its four vertices; write $A + B + C$ in terms of $G_1$.',
        'This shows $G$ divides $DG_1$ in a fixed ratio — find it by the section formula.',
        'Then $DG$ is a fixed fraction of $DG_1$; square it.'
      ],
      steps: [
        { h: 'Face centroid', d: '$A + B + C = 3G_1$ coordinate by coordinate' },
        { h: 'Tetrahedron centroid', d: '$G = \\dfrac{A + B + C + D}{4} = \\dfrac{3G_1 + 1 \\cdot D}{3 + 1}$, so $G$ divides $DG_1$ internally in the ratio $3 : 1$' },
        { h: 'Length', d: `$DG = \\dfrac{3}{4} DG_1$ and $DG_1^2 = ${D.map((d, t) => `${par(d - G1[t])}^2`).join(' + ')} = ${L}$` },
        { h: 'Answer', d: `$DG^2 = \\dfrac{9}{16} \\times ${L} = ${rTex(value)}$` }
      ],
      reasoning: 'tetrahedron-median'
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
