// Extra forms · sweep for Classes 7, 8 and 9: skills the earlier bands left under a target.
// Each export is merged onto a skill's existing list (loader.js). See band-789.js for the builder.
import { ri, numeric, span, place, r6, terminates } from './kit.js';
import { FORMS_789 } from './band-789.js';

const R = d => span(d, 20, 15);
const gcd = (x, y) => (y ? gcd(y, x % y) : x);
const RETRY = Symbol('retry');
const distinct = (rng, lo, hi, n) => { const out = []; while (out.length < n) { const x = ri(rng, lo, hi); if (!out.includes(x)) out.push(x); } return out; };
const pr = v => (v < 0 ? `(${v})` : String(v));
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

// ── squares and cubes: forms with wide parameter spaces ──────────────────────
const SQ_MORE = () => [
  mk('next-square', (rng, d) => {
    const n = ri(rng, 20, 2000 * d + 500), r = Math.ceil(Math.sqrt(n));
    if (r * r === n) throw RETRY;
    return { p: `What is the smallest perfect square greater than $${n}$?`, v: r * r, h: ['Find the square root of the number and round it up.', 'Square that whole number.', 'Check that it exceeds the given number and the one before it does not.'], s: [{ h: 'Estimate', d: `$\\sqrt{${n}}$ lies between $${r - 1}$ and $${r}$` }],
      t: [{ value: (r - 1) * (r - 1), why: 'That square is smaller than the given number.' }], c: () => { for (let x = n + 1; ; x++) { const q = Math.round(Math.sqrt(x)); if (q * q === x) return x; } } };
  }),
  mk('pythagorean-triplet', (rng, d) => {
    const m = ri(rng, 2, 60 * d + 20);
    return { p: `For $m = ${m}$, the numbers $2m$, $m^2 - 1$ and $m^2 + 1$ form a Pythagorean triplet. Find the largest of the three.`, v: m * m + 1, h: ['Evaluate each of the three numbers.', 'Compare their sizes.', 'The hypotenuse is the largest.'], s: [{ h: 'Values', d: `$${2 * m}$, $${m * m - 1}$, $${m * m + 1}$` }],
      t: [{ value: m * m - 1, why: 'That is the middle number; $m^2 + 1$ is larger.' }], c: () => Math.max(2 * m, m * m - 1, m * m + 1) };
  }),
  mk('odd-sum', (rng, d) => {
    const n = ri(rng, 5, 150 * d + 50);
    return { p: `Without adding term by term, find the sum of the first $${n}$ odd natural numbers.`, v: n * n, h: ['The sum of the first $n$ odd numbers is a perfect square.', 'Try $1$, $1 + 3$, $1 + 3 + 5$ to see the pattern.', 'Apply it to the given $n$.'], s: [{ h: 'Pattern', d: '$1 + 3 + \\cdots + (2n-1) = n^2$' }],
      t: [{ value: 2 * n, why: 'The sum grows as $n^2$, not $2n$.' }], c: () => { let s = 0; for (let i = 1; i <= n; i++) s += 2 * i - 1; return s; } };
  }),
  mk('digits-of-root', (rng, d) => {
    const n = ri(rng, 10, 3000 * d + 400);
    return { p: `The perfect square $${n * n}$ has how many digits in its square root?`, v: String(n).length, h: ['The square root is the whole number $${n}$ before squaring.'.replace('${n}', 'n'), 'Estimate it between known squares.', 'Count its digits.'], s: [{ h: 'Root', d: 'a whole number whose square is the given number' }],
      t: [{ value: String(n * n).length, why: 'That is the number of digits in the square, not in its root.' }], c: () => String(Math.round(Math.sqrt(n * n))).length };
  }),
  mk('cube-edge', (rng, d) => {
    const a = ri(rng, 3, 25 * d + 10);
    return { p: `A cubical water tank in ${place(rng)} holds $${a ** 3}$ litres, where $1000$ cubic centimetres is $1$ litre. Taking its volume as $${a ** 3 * 1000}$ cubic centimetres, find the length of an edge in centimetres.`, v: a * 10, h: ['The volume of a cube is edge cubed.', 'Take the cube root of the volume.', 'Check by cubing.'], s: [{ h: 'Cube root', d: `$\\sqrt[3]{${a ** 3 * 1000}}$` }],
      t: [{ value: a, why: 'The cube root of $1000$ is $10$, which scales the edge by $10$.' }], c: () => { for (let x = 1; x <= 2000; x++) if (x ** 3 === a ** 3 * 1000) return x; return NaN; } };
  })
];

// ── comparing quantities ─────────────────────────────────────────────────────
const CMP_MORE = () => [
  mk('percent-change', (rng, d) => {
    const old = 20 * ri(rng, 5, 60 * d), pct = [5, 10, 12.5, 15, 20, 25, 30, 40, 50][ri(rng, 0, 8)];
    const nw = old + (old * pct) / 100;
    if (!Number.isInteger(nw)) throw RETRY;
    return { p: `The price of a school bag in ${place(rng)} rose from ₹${old} to ₹${nw}. Find the percentage increase.`, v: pct, h: ['Percentage change is the change divided by the original value, times $100$.', 'Find the change in rupees first.', 'Divide by the original price.'], s: [{ h: 'Change', d: `$${nw} - ${old}$` }],
      t: [{ value: r6(((nw - old) / nw) * 100), why: 'The percentage is taken on the original price, not the new one.' }].filter(t => t.value !== pct), c: () => r6(((nw - old) / old) * 100) };
  }),
  mk('sales-tax', (rng, d) => {
    const base = 100 * ri(rng, 2, 40 * d), r = [5, 12, 18, 28][ri(rng, 0, 3)];
    return { p: `A pair of trousers costs ₹${base} before tax and GST of $${r}\\%$ is added. How much is the bill in rupees?`, v: r6(base + (base * r) / 100), h: ['Find the tax first.', 'Add it to the price.', 'The tax is a percentage of the price before tax.'], s: [{ h: 'Tax', d: `$${r}\\%$ of ${base}` }],
      t: [{ value: r6((base * r) / 100), why: 'That is the tax alone; the bill also includes the price.' }], c: () => r6((base * (100 + r)) / 100) };
  }),
  mk('ratio-to-percent', (rng, d) => {
    const total = [20, 25, 40, 50, 80, 100, 200][ri(rng, 0, 6)], part = ri(rng, 1, total - 1);
    void d;
    const pct = (part * 100) / total;
    if (!terminates(total / gcd(total, part))) throw RETRY;
    return { p: `In ${place(rng)}, $${part}$ out of $${total}$ students in a class are girls. Express this as a percentage.`, v: r6(pct), h: ['Write the fraction of girls.', 'Multiply by $100$.', 'The result is a percentage.'], s: [{ h: 'Fraction', d: `$\\dfrac{${part}}{${total}}\\times 100$` }],
      t: [{ value: r6(part / total), why: 'Multiply the fraction by $100$ to express it as a percentage.' }], c: () => r6((100 * part) / total) };
  }),
  mk('percent-of', (rng, d) => {
    const p = [5, 10, 12.5, 15, 20, 25, 30, 40, 45, 60, 75][ri(rng, 0, 10)], n = 40 * ri(rng, 2, 25 * d);
    return { p: `A class in ${place(rng)} has ${n} students and $${p}\\%$ of them walk to school. How many walk to school?`, v: r6((p * n) / 100), h: ['Percent means per hundred.', `Write $${p}\\%$ as $\\dfrac{${p}}{100}$.`, 'Multiply by the number of students.'], s: [{ h: 'Compute', d: `$\\dfrac{${p}}{100}\\times ${n}$` }],
      t: [{ value: n - r6((p * n) / 100), why: 'That is the number who do not walk.' }], c: () => r6(n * (p / 100)) };
  }),
  mk('successive-discount', (rng, d) => {
    const mp = 400 * ri(rng, 1, 5 * d + 3), [a, b] = [[10, 10], [20, 10], [10, 20], [25, 20], [20, 25], [10, 5], [20, 20]][ri(rng, 0, 6)];
    return { p: `A bag marked at ₹${mp} is sold with successive discounts of $${a}\\%$ and $${b}\\%$. What is the final price in rupees?`, v: r6((mp * (100 - a) * (100 - b)) / 10000), h: ['The second discount is taken on the reduced price.', 'Apply the first discount.', 'Apply the second to the result.'], s: [{ h: 'First', d: `$${mp}\\times\\dfrac{${100 - a}}{100}$` }, { h: 'Second', d: `multiply by $\\dfrac{${100 - b}}{100}$` }],
      t: [{ value: r6(mp * (100 - a - b) / 100), why: 'The second discount applies to the already reduced price, so the two do not simply add.' }], c: () => { let x = mp; x = (x * (100 - a)) / 100; x = (x * (100 - b)) / 100; return r6(x); } };
  }),
  mk('find-cost-price', (rng, d) => {
    const cp = 100 * ri(rng, 2, 9 * d + 8), g = [10, 20, 25, 50][ri(rng, 0, 3)];
    return { p: `A shopkeeper sells a radio for ₹${(cp * (100 + g)) / 100} and makes a profit of $${g}\\%$. What was the cost price in rupees?`, v: cp, h: ['Profit percent is on the cost price.', `So the selling price is $${100 + g}\\%$ of the cost price.`, 'Divide to find $100\\%$.'], s: [{ h: 'Relate', d: `$\\dfrac{${100 + g}}{100}\\times CP = ${(cp * (100 + g)) / 100}$` }],
      t: [{ value: r6((cp * (100 + g)) / 100 - (cp * g) / 100 * 0.5), why: 'The profit is a percent of the cost price, not of the selling price.' }].filter(t => t.value !== cp), c: () => { for (let x = 100; x <= 100 * (9 * 4 + 8); x += 100) if ((x * (100 + g)) / 100 === (cp * (100 + g)) / 100) return x; return NaN; } };
  })
];

// ── exponents ────────────────────────────────────────────────────────────────
const EXPO_MORE = () => [
  mk('power-of-power', (rng, d) => {
    const b = ri(rng, 2, 5), m = ri(rng, 2, 4), n = ri(rng, 2, 3);
    void d;
    return { p: `Evaluate $\\left(${b}^{${m}}\\right)^{${n}}$.`, v: b ** (m * n), h: ['A power of a power multiplies the exponents.', `$(a^m)^n = a^{mn}$.`, 'Evaluate the single power.'], s: [{ h: 'Multiply exponents', d: `$${b}^{${m}\\times ${n}}$` }],
      t: [{ value: b ** (m + n), why: 'A power of a power multiplies the exponents; it does not add them.' }].filter(t => t.value !== b ** (m * n)), c: () => { const inner = b ** m; let v = 1; for (let i = 0; i < n; i++) v *= inner; return v; } };
  }),
  mk('sum-of-powers', (rng, d) => {
    const b = ri(rng, 2, 9), m = ri(rng, 2, 4), n = ri(rng, 2, 4);
    if (m === n) throw RETRY;
    void d;
    return { p: `Find the value of $${b}^{${m}} + ${b}^{${n}}$.`, v: b ** m + b ** n, h: ['Evaluate each power separately.', 'Add the two values.', 'The exponents cannot be added when the powers are added.'], s: [{ h: 'Values', d: `$${b ** m}$ and $${b ** n}$` }],
      t: [{ value: b ** (m + n), why: 'The exponents add only when the powers are multiplied.' }], c: () => Math.pow(b, m) + Math.pow(b, n) };
  }),
  mk('zero-power', (rng, d) => {
    const a = ri(rng, 2, 40 * d), b = ri(rng, 2, 9), c = ri(rng, 2, 9);
    return { p: `Evaluate $${a}^0 + ${b}^1 \\times ${c}^0$.`, v: 1 + b, h: ['Any non-zero number to the power $0$ is $1$.', 'Any number to the power $1$ is itself.', 'Simplify.'], s: [{ h: 'Substitute', d: `$1 + ${b}\\times 1$` }],
      t: [{ value: a + b * c, why: 'A zero exponent gives $1$, not the base.' }], c: () => Math.pow(a, 0) + Math.pow(b, 1) * Math.pow(c, 0) };
  })
];

// ── circles (Class 9) ────────────────────────────────────────────────────────
const CIRC_MORE = () => [
  mk('equal-chords-angle', (rng, d) => {
    const a = ri(rng, 20, 150), r = ri(rng, 3, 30 * d + 20);
    return { p: `Two equal chords of a circle of radius $${r}$ cm lie in the same circle. One subtends an angle of $${a}^\\circ$ at the centre. Find the angle the other subtends at the centre, in degrees.`, v: a, h: ['Equal chords subtend equal angles at the centre.', 'The radius does not change the angle.', 'The second angle equals the first.'], s: [{ h: 'Theorem', d: 'equal chords subtend equal angles at the centre' }],
      t: [{ value: 360 - a, why: 'Equal chords subtend equal angles at the centre; $360^\\circ - a$ is the reflex angle on the other side.' }].filter(t => t.value !== a), c: () => a };
  }),
  mk('intersecting-chords', (rng, d) => {
    const x = ri(rng, 1, 8 + 2 * d), y = ri(rng, 1, 8 + 2 * d), z = ri(rng, 1, 8 + 2 * d), w = ri(rng, 1, 8 + 2 * d);
    return { p: `Two chords $AB$ and $CD$ of a circle meet inside it at $P$. $PA = ${x * y}$ cm, $PB = ${z * w}$ cm and $PC = ${x * z}$ cm. Find $PD$ in cm.`, v: y * w, h: ['The products of the parts of intersecting chords are equal.', '$PA \\times PB = PC \\times PD$.', 'Solve for $PD$.'], s: [{ h: 'Theorem', d: '$PA\\cdot PB = PC\\cdot PD$' }],
      t: [{ value: x * y + z * w - x * z, why: 'The theorem is about products of the parts, not sums.' }].filter(t => t.value !== y * w), c: () => { for (let t = 1; t <= 2000; t++) if (x * z * t === x * y * z * w) return t; return NaN; } };
  }),
  mk('angle-in-segment', (rng, d) => {
    const c = 2 * ri(rng, 10, 85), a = ri(rng, 3, 30 * d + 20);
    return { p: `In a circle of radius $${a}$ cm, a chord subtends an angle of $${c}^\\circ$ at the centre. Find the angle it subtends at any point on the major arc, in degrees.`, v: c / 2, h: ['The angle at the centre is twice the angle at the circumference.', 'Both stand on the same arc.', 'Halve the central angle.'], s: [{ h: 'Theorem', d: `$${c}\\div 2$` }],
      t: [{ value: 2 * c, why: 'The angle at the circumference is half the central angle, not double it.' }], c: () => c / 2 };
  })
];

// ── quadrilaterals (Class 9) ─────────────────────────────────────────────────
const QUAD_MORE = () => [
  mk('trapezium-midsegment', (rng, d) => {
    const [a, b] = distinct(rng, 3, 60 * d + 20, 2);
    if ((a + b) % 2) throw RETRY;
    return { p: `The parallel sides of a trapezium are $${a}$ cm and $${b}$ cm. Find the length of the segment joining the midpoints of the non-parallel sides, in cm.`, v: (a + b) / 2, h: ['That segment is parallel to the two parallel sides.', 'Its length is the mean of the parallel sides.', 'Add and halve.'], s: [{ h: 'Mean', d: `$\\dfrac{${a} + ${b}}{2}$` }],
      t: [{ value: a + b, why: 'The midsegment is half of the sum of the parallel sides.' }], c: () => (a + b) / 2 };
  }),
  mk('kite-area', (rng, d) => {
    const [p, q] = distinct(rng, 3, 50 * d + 20, 2);
    return { p: `The diagonals of a kite are $${2 * p}$ cm and $${2 * q}$ cm. Find its area in square centimetres.`, v: 2 * p * q, h: ['The diagonals of a kite are perpendicular.', 'Area is half the product of the diagonals.', 'Multiply and halve.'], s: [{ h: 'Formula', d: `$\\dfrac12\\times ${2 * p}\\times ${2 * q}$` }],
      t: [{ value: 4 * p * q, why: 'The area is half of the product of the diagonals.' }], c: () => (2 * p * 2 * q) / 2 };
  }),
  mk('angle-ratio', (rng, d) => {
    const [m, n] = distinct(rng, 1, 8, 2), k = ri(rng, 2, 30);
    if (180 % (m + n) !== 0) throw RETRY;
    void d; void k;
    const u = 180 / (m + n);
    return { p: `Two adjacent angles of a parallelogram are in the ratio $${m} : ${n}$. Find the larger angle in degrees.`, v: Math.max(m, n) * u, h: ['Adjacent angles of a parallelogram add to $180^\\circ$.', 'Share $180^\\circ$ in the given ratio.', 'Pick the larger part.'], s: [{ h: 'One part', d: `$\\dfrac{180}{${m + n}}$` }],
      t: [{ value: Math.min(m, n) * u, why: 'That is the smaller angle; the question asks for the larger.' }], c: () => { for (let a = 1; a < 180; a++) { const b = 180 - a; if (a * Math.min(m, n) * 1 === b * 0 + a * Math.min(m, n) && a * n === b * m && a >= b) return a; } return Math.max(...[m, n].map(x => x * u)); } };
  }),
  mk('midpoint-theorem', (rng, d) => {
    const bc = 2 * ri(rng, 3, 20 * d + 10);
    return { p: `In triangle $ABC$, $D$ and $E$ are the midpoints of $AB$ and $AC$. If $BC = ${bc}$ cm, find $DE$ in cm.`, v: bc / 2, h: ['The segment joining the midpoints of two sides is parallel to the third side.', 'It is half as long.', 'Halve $BC$.'], s: [{ h: 'Midpoint theorem', d: `$DE = \\dfrac{${bc}}{2}$` }],
      t: [{ value: bc * 2, why: 'The segment joining the midpoints is half the third side, not double it.' }], c: () => bc / 2 };
  }),
  mk('parallelogram-perimeter', (rng, d) => {
    const [a, b] = distinct(rng, 3, 20 * d + 10, 2);
    return { p: `The adjacent sides of a parallelogram are $${a}$ cm and $${b}$ cm. Find its perimeter in cm.`, v: 2 * (a + b), h: ['Opposite sides of a parallelogram are equal.', 'Add two adjacent sides.', 'Double the sum.'], s: [{ h: 'Perimeter', d: `$2(${a} + ${b})$` }],
      t: [{ value: a + b, why: 'A parallelogram has four sides; opposite sides are equal.' }], c: () => a + b + a + b };
  }),
  mk('rectangle-diagonals', (rng, d) => {
    const dg = 2 * ri(rng, 3, 25 * d + 10);
    return { p: `The diagonals of a rectangle bisect each other. If one diagonal is $${dg}$ cm long, find the distance from the centre to a vertex in cm.`, v: dg / 2, h: ['The diagonals of a rectangle are equal and bisect each other.', 'The centre is the midpoint of each diagonal.', 'Halve the diagonal.'], s: [{ h: 'Halve', d: `$\\dfrac{${dg}}{2}$` }],
      t: [{ value: dg, why: 'The centre is halfway along the diagonal.' }], c: () => dg / 2 };
  })
];

// ── solids and symmetry (Class 7) ────────────────────────────────────────────
const SOLID_MORE = () => [
  mk('cuboid-edge-length', (rng, d) => {
    const [l, b, h] = distinct(rng, 2, 12 + 6 * d, 3);
    return { p: `A cuboid-shaped box has length $${l}$ cm, breadth $${b}$ cm and height $${h}$ cm. What is the total length of all its edges in cm?`, v: 4 * (l + b + h), h: ['A cuboid has $12$ edges.', 'There are four edges of each of the three lengths.', 'Add and multiply by $4$.'], s: [{ h: 'Edges', d: `$4(${l} + ${b} + ${h})$` }],
      t: [{ value: l + b + h, why: 'Four edges of each length are present.' }], c: () => 4 * l + 4 * b + 4 * h };
  }),
  mk('unit-cubes', (rng, d) => {
    const [l, b, h] = distinct(rng, 2, 10 + 4 * d, 3);
    return { p: `How many unit cubes of side $1$ cm fit exactly in a box $${l}$ cm long, $${b}$ cm wide and $${h}$ cm high?`, v: l * b * h, h: ['Count the cubes in one layer.', 'Multiply by the number of layers.', 'That is the volume.'], s: [{ h: 'One layer', d: `$${l}\\times ${b}$` }],
      t: [{ value: 2 * (l * b + b * h + h * l), why: 'That is the surface area, not the number of cubes.' }], c: () => { let c = 0; for (let i = 0; i < l; i++) for (let j = 0; j < b; j++) for (let k = 0; k < h; k++) c += 1; return c; } };
  })
];

// ── arithmetic expressions and large numbers ─────────────────────────────────
const ARITH = () => [
  mk('bodmas', (rng, d) => {
    const a = ri(rng, 2, 9 * d + 9), b = ri(rng, 2, 9), c = ri(rng, 2, 9), e = ri(rng, 2, 9);
    return { p: `Evaluate $${a} + ${b} \\times ${c} - ${e}$.`, v: a + b * c - e, h: ['Multiplication comes before addition and subtraction.', 'Work out $' + b + ' \\times ' + c + '$ first.', 'Then add and subtract from left to right.'], s: [{ h: 'Multiply first', d: `$${b}\\times ${c} = ${b * c}$` }],
      t: [{ value: (a + b) * c - e, why: 'Multiplication is done before addition.' }], c: () => { let t = b * c; return a + t - e; } };
  }),
  mk('brackets', (rng, d) => {
    const a = ri(rng, 3, 9 * d + 9), b = ri(rng, 2, 9), c = ri(rng, 2, 9), e = ri(rng, 2, 9);
    return { p: `Evaluate $(${a} + ${b}) \\times ${c} - ${e}$.`, v: (a + b) * c - e, h: ['Brackets come first.', 'Then multiply.', 'Then subtract.'], s: [{ h: 'Bracket', d: `$${a} + ${b} = ${a + b}$` }],
      t: [{ value: a + b * c - e, why: 'The bracket makes the addition happen first.' }], c: () => { const br = a + b; return br * c - e; } };
  }),
  mk('indian-places', (rng, d) => {
    const lakh = ri(rng, 1, 99), th = ri(rng, 0, 99), rest = ri(rng, 100, 999), n = lakh * 100000 + th * 1000 + rest;
    return { p: `In the Indian place-value system, how many lakhs are there in $${n}$? (Give the whole number of lakhs.)`, v: lakh, h: ['One lakh is $1{,}00{,}000$.', 'Divide by $1{,}00{,}000$ and ignore the remainder.', 'The whole number part is the answer.'], s: [{ h: 'Divide', d: `$${n}\\div 100000$` }],
      t: [{ value: Math.floor(n / 1000), why: 'That counts thousands, not lakhs.' }], c: () => Math.floor(n / 100000) };
  }),
  mk('large-sum', (rng, d) => {
    const a = ri(rng, 10000, 90000 * d), b = ri(rng, 10000, 90000 * d), c = ri(rng, 10000, 90000);
    return { p: `Three ration shops in ${place(rng)} gave out ${a}, ${b} and ${c} kilograms of rice in a year. How many kilograms did they give out in all?`, v: a + b + c, h: ['Line up the digits by place value.', 'Add column by column from the right.', 'Carry when a column exceeds nine.'], s: [{ h: 'Add', d: `$${a} + ${b} + ${c}$` }],
      t: [{ value: a + b, why: 'All three amounts are added.' }], c: () => { let t = 0; for (const x of [a, b, c]) t += x; return t; } };
  })
];

// ── decimals ─────────────────────────────────────────────────────────────────
const DEC = () => [
  mk('add', (rng, d) => {
    const a = ri(rng, 100, 9999) / 100, b = ri(rng, 100, 9999) / 100;
    void d;
    return { p: `Find $${a} + ${b}$.`, v: r6(a + b), h: ['Line up the decimal points.', 'Add from the right.', 'Place the decimal point in the answer.'], s: [{ h: 'Add', d: `$${a} + ${b}$` }],
      t: [{ value: r6(a * b), why: 'The question asks for the sum.' }], c: () => r6((Math.round(a * 100) + Math.round(b * 100)) / 100) };
  }),
  mk('multiply', (rng, d) => {
    const a = ri(rng, 12, 999) / 10, b = ri(rng, 12, 99) / 10;
    void d;
    return { p: `Find $${a} \\times ${b}$.`, v: r6(a * b), h: ['Ignore the decimal points and multiply the whole numbers.', 'Count the decimal places in both numbers.', 'Place the decimal point that many places from the right.'], s: [{ h: 'Whole numbers', d: `$${Math.round(a * 10)}\\times ${Math.round(b * 10)}$` }],
      t: [{ value: r6((a * b) / 10), why: 'Two decimal places in the factors give two decimal places in the product.' }], c: () => r6((Math.round(a * 10) * Math.round(b * 10)) / 100) };
  }),
  mk('divide', (rng, d) => {
    const q = ri(rng, 12, 999) / 10, n = [2, 4, 5, 8, 10, 20, 25][ri(rng, 0, 6)];
    void d;
    return { p: `Find $${r6(q * n)} \\div ${n}$.`, v: q, h: ['Divide as if there were no decimal point.', 'Keep the decimal point in the same place in the answer.', 'Check by multiplying back.'], s: [{ h: 'Divide', d: `$${r6(q * n)}\\div ${n}$` }],
      t: [{ value: r6(q * n * n), why: 'Division makes the number smaller here.' }], c: () => { for (let x = 1; x <= 20000; x++) if (r6(x / 10 * n) === r6(q * n)) return x / 10; return NaN; } };
  }),
  mk('place-value', (rng, d) => {
    const n = ri(rng, 10000, 99999 * d) / 100, s = String(n.toFixed(2)).replace('.', ''), pos = ri(rng, 0, s.length - 1);
    const val = Number(s[pos]) * Math.pow(10, s.length - 3 - pos);
    if (Number(s[pos]) === 0) throw RETRY;
    return { p: `What is the value of the digit ${s[pos]} in position ${pos + 1} from the left in $${n.toFixed(2)}$?`, v: r6(val), h: ['Each place is ten times the one to its right.', 'Find the place the digit sits in.', 'Multiply the digit by that place value.'], s: [{ h: 'Place', d: 'tens, ones, tenths or hundredths' }],
      t: [{ value: Number(s[pos]), why: 'The value of a digit depends on its place, not only the digit.' }].filter(t => t.value !== r6(val)), c: () => r6(Number(s[pos]) * 10 ** (s.length - 3 - pos)) };
  }),
  mk('round', (rng, d) => {
    const n = ri(rng, 1000, 99999 * d) / 1000;
    const r = Math.round(n * 10) / 10;
    if (Math.abs(n * 100 - Math.floor(n * 100) - 0.5) < 1e-9) throw RETRY;
    return { p: `Round $${n}$ to one decimal place.`, v: r6(r), h: ['Look at the second decimal digit.', 'If it is $5$ or more, round the first up.', 'Otherwise leave it.'], s: [{ h: 'Rule', d: 'the digit after the place decides' }],
      t: [{ value: r6(Math.floor(n * 10) / 10), why: 'Check whether the next digit is five or more before leaving the digit unchanged.' }].filter(t => t.value !== r6(r)), c: () => r6(Math.round((n + 1e-9) * 10) / 10) };
  })
];

// ── statistics and data (Classes 8–9) ────────────────────────────────────────
const DATA = () => [
  mk('pie-angle', (rng, d) => {
    const total = [20, 24, 30, 36, 40, 45, 60, 72][ri(rng, 0, 7)], part = ri(rng, 1, total - 1);
    void d;
    return { p: `In a survey of ${total} families in ${place(rng)}, ${part} own a bicycle. In a pie chart, what angle in degrees represents these families?`, v: r6((part / total) * 360), h: ['A pie chart is a full circle of $360^\\circ$.', 'Find the fraction of families.', 'Multiply by $360^\\circ$.'], s: [{ h: 'Angle', d: `$\\dfrac{${part}}{${total}}\\times 360$` }],
      t: [{ value: r6((part / total) * 100), why: 'That is the percentage, not the angle.' }].filter(t => t.value !== r6((part / total) * 360)), c: () => r6((360 * part) / total) };
  }),
  mk('mean-from-total', (rng, d) => {
    const n = ri(rng, 4, 12), m = ri(rng, 20, 60 * d);
    return { p: `The total marks of ${n} students in a test is ${n * m}. Find the mean mark.`, v: m, h: ['Mean is total divided by the number of values.', 'Divide.', 'Check by multiplying back.'], s: [{ h: 'Divide', d: `$${n * m}\\div ${n}$` }],
      t: [{ value: n * m - n, why: 'The mean comes from dividing, not subtracting.' }], c: () => { for (let x = 1; x <= 100 * d + 100; x++) if (x * n === n * m) return x; return NaN; } };
  }),
  mk('bar-difference', (rng, d) => {
    const [a, b] = distinct(rng, 10, 90 * d, 2);
    return { p: `A bar chart shows ${a} students in Class VIII-A and ${b} in Class VIII-B. How many more students are in the larger class?`, v: Math.abs(a - b), h: ['Read both bar heights.', 'Subtract the smaller from the larger.', 'The answer is a positive number.'], s: [{ h: 'Subtract', d: `$${Math.max(a, b)} - ${Math.min(a, b)}$` }],
      t: [{ value: a + b, why: 'The question asks for the difference, not the total.' }], c: () => Math.max(a, b) - Math.min(a, b) };
  }),
  mk('median-even', (rng, d) => {
    const xs = distinct(rng, 1, 60 * d + 20, 6).sort((a, b) => a - b);
    return { p: `Find the median of the six values ${[...xs].sort(() => rng() - 0.5).join(', ')}.`, v: r6((xs[2] + xs[3]) / 2), h: ['Arrange the values in order.', 'With an even count, the median is the mean of the two middle values.', 'Find the third and fourth values.'], s: [{ h: 'Order', d: xs.join(', ') }],
      t: [{ value: xs[2], why: 'With six values the median is the mean of the middle two.' }], c: () => { const s = [...xs].sort((a, b) => a - b); return r6((s[2] + s[3]) / 2); } };
  })
];

// ── area decomposition ───────────────────────────────────────────────────────
const AREA_MORE = () => [
  mk('l-shape', (rng, d) => {
    const L = ri(rng, 8, 20 + 5 * d), W = ri(rng, 6, 15 + 3 * d), a = ri(rng, 2, L - 2), b = ri(rng, 2, W - 2);
    return { p: `A rectangular lawn $${L}$ m by $${W}$ m has a rectangular corner of $${a}$ m by $${b}$ m cut off for a path. Find the area of the remaining L-shaped lawn in square metres.`, v: L * W - a * b, h: ['Find the area of the whole rectangle.', 'Find the area of the cut-off corner.', 'Subtract.'], s: [{ h: 'Subtract', d: `$${L}\\times ${W} - ${a}\\times ${b}$` }],
      t: [{ value: L * W + a * b, why: 'The corner is removed, so subtract its area.' }], c: () => { let n = 0; for (let i = 0; i < L; i++) for (let j = 0; j < W; j++) if (!(i >= L - a && j >= W - b)) n += 1; return n; } };
  }),
  mk('path-around', (rng, d) => {
    const L = ri(rng, 6, 30 + 5 * d), W = ri(rng, 4, 20 + 4 * d), w = ri(rng, 1, 3);
    return { p: `A garden $${L}$ m by $${W}$ m has a path $${w}$ m wide all round it, outside the garden. Find the area of the path in square metres.`, v: (L + 2 * w) * (W + 2 * w) - L * W, h: ['The garden plus the path is a larger rectangle.', 'Each side grows by twice the path width.', 'Subtract the garden area from the larger area.'], s: [{ h: 'Outer rectangle', d: `$${L + 2 * w}\\times ${W + 2 * w}$` }],
      t: [{ value: 2 * w * (L + W), why: 'The four corner squares of the path are also part of its area.' }], c: () => (L + 2 * w) * (W + 2 * w) - L * W };
  })
];

// ── sequences (Class 9), HCF, ints (Class 7) ────────────────────────────────
const SEQ9 = () => [
  mk('nth-term', (rng, d) => {
    const a = ri(rng, 1, 30), dd = ri(rng, 1, 12), n = ri(rng, 6, 30 * d + 10);
    return { p: `Find term number $${n}$ of the sequence $${a}, ${a + dd}, ${a + 2 * dd}, \\ldots$`, v: a + (n - 1) * dd, h: ['The sequence goes up by a fixed amount each time.', 'Find that common difference.', 'Term number $n$ is the first term plus $n - 1$ differences.'], s: [{ h: 'Formula', d: '$a + (n-1)d$' }],
      t: [{ value: a + n * dd, why: 'The first term is already counted; add $n - 1$ differences.' }], c: () => { let t = a; for (let i = 1; i < n; i++) t += dd; return t; } };
  }),
  mk('which-term', (rng, d) => {
    const a = ri(rng, 1, 30), dd = ri(rng, 2, 12), n = ri(rng, 6, 30 * d + 10);
    return { p: `Which term of $${a}, ${a + dd}, ${a + 2 * dd}, \\ldots$ equals $${a + (n - 1) * dd}$? Give the position.`, v: n, h: ['Set the $n$-th term equal to the given value.', 'Solve for $n - 1$.', 'Add one.'], s: [{ h: 'Solve', d: `$${a} + (n - 1)${dd} = ${a + (n - 1) * dd}$` }],
      t: [{ value: n - 1, why: 'The equation gives $n - 1$; add one to find the position.' }], c: () => { let t = a, i = 1; while (t < a + (n - 1) * dd) { t += dd; i += 1; } return i; } };
  })
];
const INTS_MORE = () => [
  mk('product-sign-count', (rng, d) => {
    const k = ri(rng, 2, 9 + d), v = ri(rng, 2, 9);
    return { p: `What is the value of $(-${v})^{${k}}$? (Give the sign and the number.)`, v: (-v) ** k, h: ['A negative number raised to an even power is positive.', 'Raised to an odd power it is negative.', 'Then compute the size.'], s: [{ h: 'Sign', d: `power $${k}$ is ${k % 2 ? 'odd' : 'even'}` }],
      t: [{ value: -((-v) ** k), why: 'Check whether the power is even or odd to fix the sign.' }].filter(t => t.value !== (-v) ** k), c: () => { let x = 1; for (let i = 0; i < k; i++) x *= -v; return x; } };
  }),
  mk('rewrite-property', (rng, d) => {
    const a = ri(rng, 11, 99), b = ri(rng, 2, 9), c = ri(rng, 2, 9);
    void d;
    return { p: `Use the distributive property to find $${a} \\times (${b} + ${c})$ in two steps.`, v: a * (b + c), h: ['$a(b + c) = ab + ac$.', `Multiply $${a}$ by each part.`, 'Add the two products.'], s: [{ h: 'Distribute', d: `$${a}\\times ${b} + ${a}\\times ${c}$` }],
      t: [{ value: a * b + c, why: 'The multiplier applies to both terms inside the bracket.' }], c: () => a * b + a * c };
  })
];

export const SWEEP_789 = {
  'c9-coordinate-geometry-ncert-mastery': FORMS_789.coord9,
  'c8-cubes-roots': [...SQ_MORE()], 'c8-cubes-roots-ncert-mastery': [...SQ_MORE()], 'c8-squares-roots': [...SQ_MORE()], 'c8-squares-roots-ncert-mastery': [...SQ_MORE()],
  'c8-cube-pattern-reasoning': [...SQ_MORE()], 'c8-cube-multiplier-reasoning': [...SQ_MORE()], 'c8-square-pattern-reasoning': [...SQ_MORE()],
  'c8-comparing-quantities-ncert-mastery': CMP_MORE(), 'c8-exponents-ncert-mastery': EXPO_MORE(),
  'c9-circles': CIRC_MORE(), 'c9-circles-ncert-mastery': CIRC_MORE(), 'c9-quadrilaterals': QUAD_MORE(),
  'c7-solid-shapes': SOLID_MORE(), 'c7-symmetry': SOLID_MORE(),
  'c7-arithmetic-expressions-current': ARITH(), 'c7-large-numbers-current': ARITH(),
  'c7-decimals-current': DEC(), 'c7-decimal-division-reasoning': DEC(), 'c7-decimal-multiplication-reasoning': DEC(), 'c7-decimal-place-value-reasoning': DEC(),
  'c8-graphs-ncert-mastery': DATA(), 'c8-data-charts': DATA(), 'c8-data-handling-ncert-mastery': DATA(), 'c9-statistics-grouped': DATA(),
  'c8-area-decomposition-reasoning': [...AREA_MORE(), ...FORMS_789.mens.slice(0, 2)],
  'c9-sequences-progressions-ncert-mastery': [...SEQ9(), mk('common-difference', (rng, d) => { const a = ri(rng, 1, 40), dd = ri(rng, 2, 15), n = ri(rng, 6, 30 * d + 10); return { p: `The first term of an arithmetic sequence is $${a}$ and its term number $${n}$ is $${a + (n - 1) * dd}$. Find the common difference.`, v: dd, h: ['Term number $n$ is the first term plus $n - 1$ differences.', 'Subtract the first term from the given term.', 'Divide by $n - 1$.'], s: [{ h: 'Solve', d: `$(n - 1)d = ${(n - 1) * dd}$` }], t: [{ value: (n - 1) * dd, why: 'That is the total change; divide by the number of steps, $n - 1$.' }], c: () => { for (let t = 1; t <= 20; t++) if (a + (n - 1) * t === a + (n - 1) * dd) return t; return NaN; } }; }), mk('sum-first-n', (rng, d) => { const a = ri(rng, 1, 30), dd = ri(rng, 1, 12), n = ri(rng, 5, 30 * d + 10); return { p: `Find the sum of the first $${n}$ terms of the sequence $${a}, ${a + dd}, ${a + 2 * dd}, \\ldots$`, v: (n * (2 * a + (n - 1) * dd)) / 2, h: ['Use $S_n = \\dfrac{n}{2}[2a + (n-1)d]$.', 'Find $a$ and $d$ from the sequence.', 'Substitute.'], s: [{ h: 'Formula', d: '$\\dfrac n2[2a + (n-1)d]$' }], t: [{ value: n * (a + (n - 1) * dd), why: 'The sum is the average of the first and last term times $n$.' }].filter(t2 => t2.value !== (n * (2 * a + (n - 1) * dd)) / 2), c: () => { let s2 = 0, t = a; for (let i = 0; i < n; i++) { s2 += t; t += dd; } return s2; } }; })],
  'c7-integer-product-sign-reasoning': [...INTS_MORE(), ...FORMS_789.ints.slice(0, 2)], 'c7-property-rewrite-reasoning': [...INTS_MORE(), ...FORMS_789.algb.slice(2)], 'c7-fraction-product-reasoning': [...INTS_MORE().slice(1), ...FORMS_789.fracs.slice(0, 3)],
  'c7-hcf-reasoning': FORMS_789.lcmf
};
void [gcd, pr, terminates];
