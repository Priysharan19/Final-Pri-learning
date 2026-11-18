// Extra forms · sweep for Classes 11 and 12: the skills the earlier bands left under a target.
import { ri, numeric, span, person } from './kit.js';

const R = d => span(d, 20, 15);
const RETRY = Symbol('retry');
const mk = (name, gen) => ({
  form: name,
  make(rng, d) {
    for (let i = 0; i < 500; i++) {
      let g;
      try { g = gen(rng, d); } catch (e) { if (e === RETRY) continue; throw e; }
      return { payload: numeric(name, g.p, g.v, { hints: g.h, steps: g.s, traps: g.t || [] }), check: g.c };
    }
    throw new Error(`${name}: retry exhausted`);
  }
});
const sg = v => (v < 0 ? `- ${-v}` : `+ ${v}`);
const lin = (a, b) => `${a === 1 ? '' : a}x ${sg(b)}`;
const nzs = (rng, hi) => ri(rng, 1, hi) * (ri(rng, 0, 1) ? -1 : 1);
const QUADS = [[1, 2, 2, 3], [2, 3, 6, 7], [1, 4, 8, 9], [4, 4, 7, 9], [2, 6, 9, 11], [6, 6, 7, 11], [3, 4, 12, 13], [2, 10, 11, 15], [4, 13, 16, 21], [6, 10, 15, 19]];

// ── Class 11: linear inequalities ────────────────────────────────────────────
const INEQ = () => [
  mk('integer-count', (rng, d) => {
    const a = ri(rng, 2, 9), lo = ri(rng, -R(d), R(d)), hi = lo + ri(rng, 3, 4 * R(d));
    return { p: `How many integer values of $x$ satisfy $${lo * a} \\le ${a}x \\le ${hi * a}$?`, v: hi - lo + 1, h: ['Divide every part by the positive coefficient.', 'The direction of the inequalities does not change.', 'Count the integers in the closed interval.'], s: [{ h: 'Divide', d: `$${lo} \\le x \\le ${hi}$` }],
      t: [{ value: hi - lo, why: 'Both end points are included, so add one to the difference.' }], c: () => { let c = 0; for (let x = lo - 3; x <= hi + 3; x++) if (a * x >= lo * a && a * x <= hi * a) c += 1; return c; } };
  }),
  mk('largest-solution', (rng, d) => {
    const a = ri(rng, 2, 9), b = nzs(rng, R(d)), k = ri(rng, -R(d), R(d)), c = a * k + b + ri(rng, 1, a - 1);
    return { p: `Find the largest integer $x$ satisfying $${lin(a, b)} < ${c}$.`, v: k, h: ['Subtract the constant from both sides.', 'Divide by the positive coefficient.', 'Take the largest integer strictly below the bound.'], s: [{ h: 'Solve', d: `$x < \\dfrac{${c - b}}{${a}}$` }],
      t: [{ value: k + 1, why: 'The inequality is strict, so the bound itself is not a solution.' }], c: () => { let best = -Infinity; for (let x = k - 5; x <= k + 5; x++) if (a * x + b < c) best = Math.max(best, x); return best; } };
  }),
  mk('negative-coefficient', (rng, d) => {
    const a = ri(rng, 2, 9), k = ri(rng, -R(d), R(d)), c = -a * k;
    return { p: `Find the smallest integer $x$ satisfying $-${a}x \\le ${c}$.`, v: k, h: ['Divide both sides by the negative coefficient.', 'Dividing by a negative number reverses the inequality.', 'Take the smallest integer allowed.'], s: [{ h: 'Reverse', d: `$x \\ge ${k}$` }],
      t: [{ value: k - 1, why: 'Dividing by a negative number reverses the inequality sign.' }], c: () => { for (let x = k - 5; x <= k + 5; x++) if (-a * x <= c) return x; return NaN; } };
  }),
  mk('two-conditions', (rng, d) => {
    const p = ri(rng, -R(d), 0), q = ri(rng, 3, R(d)), r = ri(rng, p, q);
    const lo = Math.max(p + 1, r), count = q - lo + 1;
    if (count < 1) throw RETRY;
    return { p: `How many integers $x$ satisfy $x > ${p}$, $x \\le ${q}$ and $x \\ge ${r}$ all at once?`, v: count, h: ['Find the interval that satisfies every condition.', 'Take the larger lower bound and the smaller upper bound.', 'Count the integers in it.'], s: [{ h: 'Combine', d: 'intersect the three conditions' }],
      t: [{ value: q - p, why: 'Use all three conditions, not just the first two.' }].filter(t => t.value !== count), c: () => { let c = 0; for (let x = p - 3; x <= q + 3; x++) if (x > p && x <= q && x >= r) c += 1; return c; } };
  })
];

// ── Class 12: matrices and determinants ──────────────────────────────────────
const MAT = () => [
  mk('det-2x2', (rng, d) => {
    const a = nzs(rng, R(d)), b = nzs(rng, R(d)), c = nzs(rng, R(d)), e = nzs(rng, R(d));
    return { p: `Find the determinant of $\\begin{vmatrix} ${a} & ${b} \\\\ ${c} & ${e} \\end{vmatrix}$.`, v: a * e - b * c, h: ['For a $2\\times 2$ determinant, multiply the main diagonal and subtract the product of the other diagonal.', '$ps - qr$.', 'Take care with the signs.'], s: [{ h: 'Expand', d: `$(${a})(${e}) - (${b})(${c})$` }],
      t: [{ value: a * e + b * c, why: 'The second product is subtracted.' }].filter(t => t.value !== a * e - b * c), c: () => { const m = [[a, b], [c, e]]; return m[0][0] * m[1][1] - m[0][1] * m[1][0]; } };
  }),
  mk('det-3x3', (rng, d) => {
    const m = Array.from({ length: 3 }, () => Array.from({ length: 3 }, () => ri(rng, -4 - d, 4 + d)));
    const det = m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);
    const row = r => r.map(x => x).join(' & ');
    return { p: `Find the determinant of $\\begin{vmatrix} ${row(m[0])} \\\\ ${row(m[1])} \\\\ ${row(m[2])} \\end{vmatrix}$.`, v: det, h: ['Expand along the first row.', 'Use the signs $+, -, +$.', 'Each minor is a $2\\times 2$ determinant.'], s: [{ h: 'Expand', d: '$a_{11}M_{11} - a_{12}M_{12} + a_{13}M_{13}$' }],
      t: [{ value: m[0][0] * m[1][1] * m[2][2], why: 'That is only the main diagonal product, not the determinant.' }].filter(t => t.value !== det), c: () => { const [a, b, c] = m[0], [dd, e, f] = m[1], [g, h, i] = m[2]; return a * e * i + b * f * g + c * dd * h - c * e * g - b * dd * i - a * f * h; } };
  }),
  mk('product-entry', (rng, d) => {
    const A = [[ri(rng, -R(d), R(d)), ri(rng, -R(d), R(d))], [ri(rng, -R(d), R(d)), ri(rng, -R(d), R(d))]], B = [[ri(rng, -9, 9), ri(rng, -9, 9)], [ri(rng, -9, 9), ri(rng, -9, 9)]];
    const i = ri(rng, 0, 1), j = ri(rng, 0, 1);
    const f = M => M.map(r => r.join(' & ')).join(' \\\\ ');
    return { p: `If $A = \\begin{pmatrix} ${f(A)} \\end{pmatrix}$ and $B = \\begin{pmatrix} ${f(B)} \\end{pmatrix}$, find the entry in row ${i + 1}, column ${j + 1} of $AB$.`, v: A[i][0] * B[0][j] + A[i][1] * B[1][j], h: ['An entry of $AB$ is a row of $A$ times a column of $B$.', 'Multiply matching entries and add.', 'Use row ' + (i + 1) + ' of $A$ and column ' + (j + 1) + ' of $B$.'], s: [{ h: 'Row times column', d: 'sum of products of matching entries' }],
      t: [{ value: A[i][0] * B[i][0] + A[i][1] * B[i][1], why: 'Take the row of $A$ with the column of $B$, not the row of $B$.' }], c: () => { const AB = [[0, 0], [0, 0]]; for (let r = 0; r < 2; r++) for (let c = 0; c < 2; c++) for (let k = 0; k < 2; k++) AB[r][c] += A[r][k] * B[k][c]; return AB[i][j]; } };
  }),
  mk('trace-scalar', (rng, d) => {
    const k = ri(rng, 2, 9), a = ri(rng, -R(d), R(d)), e = ri(rng, -R(d), R(d));
    if (a + e === 0) throw RETRY;
    return { p: `Let $A = \\begin{pmatrix} ${a} & 3 \\\\ 5 & ${e} \\end{pmatrix}$ and let $B = ${k}A$. Find the sum of the diagonal entries of $B$.`, v: k * (a + e), h: ['Multiplying a matrix by a number multiplies every entry.', 'The diagonal entries are the top-left and bottom-right.', 'Add them after multiplying.'], s: [{ h: 'Scale', d: `$${k}a + ${k}e$` }],
      t: [{ value: a + e, why: 'Every entry is multiplied, including the diagonal ones.' }], c: () => k * a + k * e };
  }),
  mk('order-of-product', (rng, d) => {
    const m = ri(rng, 2, 6 + d), n = ri(rng, 2, 6 + d), p = ri(rng, 2, 6 + d);
    return { p: `$A$ is a $${m}\\times ${n}$ matrix and $B$ is a $${n}\\times ${p}$ matrix. How many entries does $AB$ have?`, v: m * p, h: ['The product has as many rows as $A$ and as many columns as $B$.', 'The inner dimensions must match and then disappear.', 'Multiply rows by columns.'], s: [{ h: 'Order', d: `$${m}\\times ${p}$` }],
      t: [{ value: m * n * p, why: 'The inner dimension $n$ is summed over, not counted in the size of the product.' }], c: () => m * p };
  })
];

// ── Class 11: three-dimensional geometry ─────────────────────────────────────
const THREE_D = () => [
  mk('distance-3d', (rng, d) => {
    const q = QUADS[ri(rng, 0, 9)], k = ri(rng, 1, 3 + d), x1 = ri(rng, -R(d), R(d)), y1 = ri(rng, -R(d), R(d)), z1 = ri(rng, -R(d), R(d));
    const sx = ri(rng, 0, 1) ? 1 : -1, sy = ri(rng, 0, 1) ? 1 : -1, sz = ri(rng, 0, 1) ? 1 : -1;
    return { p: `Find the distance between $(${x1}, ${y1}, ${z1})$ and $(${x1 + sx * q[0] * k}, ${y1 + sy * q[1] * k}, ${z1 + sz * q[2] * k})$.`, v: q[3] * k, h: ['The distance formula in three dimensions adds three squared differences.', 'Find each difference.', 'The sum of squares is a perfect square.'], s: [{ h: 'Differences', d: `$${q[0] * k}$, $${q[1] * k}$, $${q[2] * k}$` }],
      t: [{ value: (q[0] + q[1] + q[2]) * k, why: 'Square the differences before adding and then take the root.' }], c: () => Math.round(Math.sqrt((q[0] * k) ** 2 + (q[1] * k) ** 2 + (q[2] * k) ** 2)) };
  }),
  mk('midpoint-3d', (rng, d) => {
    const z1 = ri(rng, -R(d), R(d)), kz = ri(rng, -R(d), R(d)), z2 = 2 * kz - z1;
    if (z1 === z2) throw RETRY;
    return { p: `Find the $z$-coordinate of the midpoint of the segment joining $(2, 5, ${z1})$ and $(8, -3, ${z2})$.`.replace('+ -', '- '), v: kz, h: ['The midpoint averages each coordinate.', 'Add the two $z$-coordinates.', 'Halve.'], s: [{ h: 'Average', d: `$\\dfrac{${z1} + ${z2 < 0 ? `(${z2})` : z2}}{2}$` }],
      t: [{ value: z1 + z2, why: 'Halve the sum to get the average.' }].filter(t => t.value !== kz), c: () => (z1 + z2) / 2 };
  }),
  mk('distance-from-axis', (rng, d) => {
    const t = [[3, 4, 5], [5, 12, 13], [8, 15, 17], [7, 24, 25]][ri(rng, 0, 3)], k = ri(rng, 1, 3 + d), z = ri(rng, 1, R(d));
    return { p: `Find the distance of the point $(${t[0] * k}, ${t[1] * k}, ${z})$ from the $z$-axis.`, v: t[2] * k, h: ['The distance from the $z$-axis uses only the $x$ and $y$ coordinates.', 'Apply the two-dimensional distance formula from the origin.', `The $z$-coordinate $${z}$ does not matter.`], s: [{ h: 'Distance', d: `$\\sqrt{${t[0] * k}^2 + ${t[1] * k}^2}$` }],
      t: [{ value: Math.round(Math.sqrt((t[0] * k) ** 2 + (t[1] * k) ** 2 + z * z) * 1e6) / 1e6, why: 'That is the distance from the origin; the distance from the axis ignores $z$.' }].filter(x => Number.isInteger(x.value) && x.value !== t[2] * k), c: () => Math.round(Math.hypot(t[0] * k, t[1] * k)) };
  }),
  mk('octant-count', (rng, d) => {
    const n = ri(rng, 2, 4 + d);
    void n;
    const a = nzs(rng, R(d)), b = nzs(rng, R(d)), c = nzs(rng, R(d));
    return { p: `Count how many of the three coordinates of $(${a}, ${b}, ${c})$ are negative.`, v: [a, b, c].filter(x => x < 0).length, h: ['Look at each coordinate separately.', 'Count the ones with a minus sign.', 'The signs also tell you the octant.'], s: [{ h: 'Signs', d: 'one per coordinate' }],
      t: [{ value: [a, b, c].filter(x => x > 0).length, why: 'That counts the positive coordinates, not the negative ones.' }].filter(t => t.value !== [a, b, c].filter(x => x < 0).length), c: () => (a < 0) + (b < 0) + (c < 0) };
  })
];

export const SWEEP_HI = {
  'c11-linear-inequalities': INEQ(), 'c12-matrices': MAT(), 'c12-determinants': MAT(), 'c11-3d-introduction': THREE_D()
};
void [person];
