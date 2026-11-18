// Extra forms · Classes 7, 8 and 9. See forms/kit.js. Skills in the same topic share a
// factory so each skill still carries its own list of forms. Written with a compact
// builder: g(rng, d) returns { p prompt, v key, h hints, s steps, t traps, c check }.
import { ri, numeric, choice, span, person, place, r6, terminates } from './kit.js';
import * as D from './diagrams.js';

const R = d => span(d, 20, 15);
const gcd = (x, y) => (y ? gcd(y, x % y) : x);
const RETRY = Symbol('retry');
const nzs = (rng, hi) => ri(rng, 1, hi) * (ri(rng, 0, 1) ? -1 : 1);
const distinct = (rng, lo, hi, n) => { const out = []; while (out.length < n) { const x = ri(rng, lo, hi); if (!out.includes(x)) out.push(x); } return out; };
const pr = v => (v < 0 ? `(${v})` : String(v));
const mk = (name, gen) => ({
  form: name,
  make(rng, d) {
    for (let i = 0; i < 500; i++) {
      let g;
      try { g = gen(rng, d); } catch (e) { if (e === RETRY) continue; throw e; }
      return { payload: numeric(name, g.p, g.v, { hints: g.h, steps: g.s, traps: g.t || [], figure: g.f ? g.f.svg : null }), check: g.c };
    }
    throw new Error(`${name}: retry exhausted`);
  }
});
const DEN = [2, 4, 5, 8, 10, 20, 25];

// ── integers ────────────────────────────────────────────────────────────────
const INTS = () => [
  mk('mixed', (rng, d) => {
    const [a, b] = distinct(rng, -R(d), R(d), 2), c = nzs(rng, 12), e = nzs(rng, R(d));
    if (Math.abs(c) === 1 || (a - b) * c + e === 0 || b === 0) throw RETRY;   // no "- 0" term in the bracket
    const inner = `${a} ${b < 0 ? '+' : '-'} ${Math.abs(b)}`, tail = e < 0 ? `- ${-e}` : `+ ${e}`;
    return { p: `Find the value of $(${inner}) \\times ${pr(c)} ${tail}$.`, v: (a - b) * c + e,
      h: ['Work out the bracket first.', 'Then multiply, keeping track of signs.', 'Add or subtract the last number.'], s: [{ h: 'Bracket', d: `$${inner} = ${a - b}$` }, { h: 'Multiply', d: `$${a - b}\\times ${pr(c)}$` }],
      t: [{ value: a - b * c + e, why: 'The bracket is multiplied as a whole, not just its last number.' }], c: () => a * c - b * c + e };
  }),
  mk('temperature', (rng, d) => {
    const t0 = ri(rng, -5, 15), r = ri(rng, 2, 9), h = ri(rng, 2, 6 + d);
    return { p: `At 6 a.m. the temperature in ${place(rng)} is $${t0}^\\circ$C. It falls by $${r}^\\circ$C every hour for $${h}$ hours. What is the temperature then, in $^\\circ$C?`, v: t0 - r * h,
      h: ['A fall of $r$ degrees each hour is repeated subtraction.', 'Multiply the fall per hour by the hours.', 'Subtract from the starting temperature.'], s: [{ h: 'Total fall', d: `$${r}\\times ${h}$` }, { h: 'New temperature', d: `$${t0} - ${r * h}$` }],
      t: [{ value: t0 + r * h, why: 'The temperature falls, so subtract.' }], c: () => { let t = t0; for (let i = 0; i < h; i++) t -= r; return t; } };
  }),
  mk('division', (rng, d) => {
    const q = nzs(rng, R(d)), b = nzs(rng, 12);
    if (Math.abs(q) === 1 || Math.abs(b) === 1) throw RETRY;
    return { p: `Find $${q * b} \\div ${pr(b)}$.`, v: q, h: ['Divide the numbers, then fix the sign.', 'Two numbers with the same sign give a positive quotient.', 'Different signs give a negative quotient.'], s: [{ h: 'Sign', d: 'same signs: positive; different signs: negative' }],
      t: [{ value: -q, why: 'Check the sign rule: a negative divided by a negative is positive.' }], c: () => { for (let x = -R(d) - 1; x <= R(d) + 1; x++) if (x * b === q * b) return x; return NaN; } };
  }),
  mk('reverse', (rng, d) => {
    const a = nzs(rng, 12), x = nzs(rng, R(d));
    if (Math.abs(a) === 1 || Math.abs(x) === 1) throw RETRY;
    return { p: `What number multiplied by $${pr(a)}$ gives $${a * x}$?`, v: x, h: ['Divide the product by the known factor.', 'Watch the signs.', 'Check by multiplying back.'], s: [{ h: 'Divide', d: `$${a * x}\\div ${pr(a)}$` }],
      t: [{ value: a * x - a, why: 'Subtracting does not undo multiplication; divide.' }], c: () => { for (let t = -R(d) - 1; t <= R(d) + 1; t++) if (a * t === a * x) return t; return NaN; } };
  })
];

// ── fractions and rational numbers (answers as terminating decimals) ─────────
const fracs = (b, a) => a / b;
const FRACS = () => [
  mk('add', (rng, d) => {
    const q1 = DEN[ri(rng, 0, 6)], q2 = DEN[ri(rng, 0, 6)], p1 = ri(rng, 1, 3 * q1), p2 = ri(rng, 1, 3 * q2);
    if (p1 % q1 === 0 || p2 % q2 === 0 || gcd(p1, q1) > 1 || gcd(p2, q2) > 1 || (p1 === p2 && q1 === q2)) throw RETRY;
    return { p: `Find $\\dfrac{${p1}}{${q1}} + \\dfrac{${p2}}{${q2}}$ as a decimal.`, v: r6(p1 / q1 + p2 / q2), h: ['Make the denominators equal, or convert each fraction to a decimal.', 'Add.', 'Check the answer is a terminating decimal.'], s: [{ h: 'Decimals', d: `$${r6(p1 / q1)} + ${r6(p2 / q2)}$` }],
      t: [{ value: r6((p1 + p2) / (q1 + q2)), why: 'Add numerators and denominators separately is not how fractions add.' }], c: () => r6((p1 * q2 + p2 * q1) / (q1 * q2)) };
  }),
  mk('product', (rng, d) => {
    const q1 = DEN[ri(rng, 0, 6)], q2 = DEN[ri(rng, 0, 6)], p1 = ri(rng, 1, 2 * q1), p2 = ri(rng, 1, 2 * q2);
    if (p1 % q1 === 0 || p2 % q2 === 0 || gcd(p1, q1) > 1 || gcd(p2, q2) > 1 || (p1 === p2 && q1 === q2)) throw RETRY;
    if (Math.abs((p1 * p2) / (q1 * q2) - 1) < 1e-9) throw RETRY;
    return { p: `Find $\\dfrac{${p1}}{${q1}} \\times \\dfrac{${p2}}{${q2}}$ as a decimal.`, v: r6((p1 * p2) / (q1 * q2)), h: ['Multiply the numerators and the denominators.', 'Then divide.', 'Or convert each to a decimal first.'], s: [{ h: 'Multiply', d: `$\\dfrac{${p1 * p2}}{${q1 * q2}}$` }],
      t: [{ value: r6(p1 / q1 + p2 / q2), why: 'The question asks for the product, not the sum.' }], c: () => r6((p1 / q1) * (p2 / q2)) };
  }),
  mk('division', (rng, d) => {
    const q1 = DEN[ri(rng, 0, 6)], q2 = DEN[ri(rng, 0, 6)], p1 = ri(rng, 1, 2 * q1), p2 = ri(rng, 1, 2 * q2);
    if (p1 % q1 === 0 || p2 % q2 === 0 || gcd(p1, q1) > 1 || gcd(p2, q2) > 1 || (p1 === p2 && q1 === q2)) throw RETRY;
    const val = (p1 * q2) / (q1 * p2);
    if (!terminates((q1 * p2) / gcd(p1 * q2, q1 * p2)) || Math.abs(val * 1e6 - Math.round(val * 1e6)) > 1e-6 || Math.abs(val - 1) < 1e-9) throw RETRY;
    return { p: `Find $\\dfrac{${p1}}{${q1}} \\div \\dfrac{${p2}}{${q2}}$ as a decimal.`, v: r6(val), h: ['Dividing by a fraction means multiplying by its reciprocal.', 'Flip the second fraction.', 'Multiply and simplify.'], s: [{ h: 'Reciprocal', d: `$\\dfrac{${p1}}{${q1}}\\times\\dfrac{${q2}}{${p2}}$` }],
      t: [{ value: r6((p1 * p2) / (q1 * q2)), why: 'Divide means multiply by the reciprocal; do not multiply straight across.' }], c: () => r6((p1 / q1) / (p2 / q2)) };
  }),
  mk('between', (rng, d) => {
    const q = DEN[ri(rng, 0, 6)], p1 = ri(rng, 1, 3 * q), p2 = ri(rng, 1, 3 * q);
    if (p1 === p2 || gcd(p1, q) > 1 || gcd(p2, q) > 1) throw RETRY;
    return { p: `Find the rational number exactly halfway between $\\dfrac{${p1}}{${q}}$ and $\\dfrac{${p2}}{${q}}$, as a decimal.`, v: r6((p1 + p2) / (2 * q)), h: ['The number halfway between two numbers is their mean.', 'Add them and halve.', 'Write the result as a decimal.'], s: [{ h: 'Mean', d: `$\\dfrac{${p1} + ${p2}}{2\\times ${q}}$` }],
      t: [{ value: r6((p1 + p2) / q), why: 'Halve the sum: the midpoint is the mean.' }], c: () => r6(((p1 / q) + (p2 / q)) / 2) };
  })
];

// ── comparing quantities ─────────────────────────────────────────────────────
const CMP = () => [
  mk('discount', (rng, d) => {
    const mp = 100 * ri(rng, 2, 10 * d + 8), dr = [5, 10, 15, 20, 25, 30, 40][ri(rng, 0, 6)];
    return { p: `A pair of shoes in ${place(rng)} is marked at ₹${mp}. The shopkeeper offers a discount of $${dr}\\%$. What is the selling price in rupees?`, v: mp - (mp * dr) / 100, h: ['Find the discount amount first.', 'Subtract it from the marked price.', 'A discount is taken off the marked price.'], s: [{ h: 'Discount', d: `$${dr}\\%$ of ${mp}` }, { h: 'Selling price', d: `$${mp} - $ discount` }],
      t: [{ value: mp + (mp * dr) / 100, why: 'A discount reduces the price.' }], c: () => mp * (100 - dr) / 100 };
  }),
  mk('profit', (rng, d) => {
    const cp = 100 * ri(rng, 2, 10 * d + 8), g = [5, 10, 20, 25, 30, 40, 50][ri(rng, 0, 6)];
    return { p: `A shopkeeper buys sweets for ₹${cp} and sells them at a profit of $${g}\\%$. At what price, in rupees, are they sold?`, v: cp + (cp * g) / 100, h: ['Profit percent is taken on the cost price.', 'Find the profit in rupees.', 'Add it to the cost price.'], s: [{ h: 'Profit', d: `$${g}\\%$ of ${cp}` }],
      t: [{ value: cp - (cp * g) / 100, why: 'A profit means selling for more than the cost.' }], c: () => cp * (100 + g) / 100 };
  }),
  mk('simple-interest', (rng, d) => {
    const P = 100 * ri(rng, 2, 10 * d + 8), r = ri(rng, 2, 12), t = ri(rng, 2, 6);
    return { p: `Find the simple interest, in rupees, on ₹${P} at $${r}\\%$ per year for $${t}$ years.`, v: (P * r * t) / 100, h: ['Use $I = \\dfrac{P r t}{100}$.', 'Substitute the principal, rate and time.', 'Evaluate.'], s: [{ h: 'Formula', d: `$\\dfrac{${P}\\times ${r}\\times ${t}}{100}$` }],
      t: [{ value: P + (P * r * t) / 100, why: 'That is the amount, which includes the principal.' }], c: () => { let i = 0; for (let y = 0; y < t; y++) i += (P * r) / 100; return i; } };
  }),
  mk('compound-two-years', (rng, d) => {
    const P = 400 * ri(rng, 1, 5 * d + 5), r = [5, 10, 20, 25][ri(rng, 0, 3)];
    return { p: `Find the amount, in rupees, when ₹${P} is invested for $2$ years at $${r}\\%$ per year compounded annually.`, v: (P * (100 + r) * (100 + r)) / 10000, h: ['After one year the amount is the new principal for the second year.', `Multiply by $1 + \\dfrac{${r}}{100}$ twice.`, 'Evaluate.'], s: [{ h: 'Year 1', d: `$${P}\\times\\dfrac{${100 + r}}{100}$` }, { h: 'Year 2', d: 'multiply again' }],
      t: [{ value: P + (P * r * 2) / 100, why: 'That is the simple-interest amount; interest earns interest when compounded.' }], c: () => { let a = P; for (let y = 0; y < 2; y++) a = (a * (100 + r)) / 100; return a; } };
  })
];

// ── squares, cubes and their roots ───────────────────────────────────────────
const SQC = () => [
  mk('square-root', (rng, d) => {
    const n = ri(rng, 12, 40 * d + 60);
    return { p: `Find the square root of $${n * n}$.`, v: n, h: ['Look at the last digit to narrow the choices.', 'Estimate between two known squares.', 'Check by squaring.'], s: [{ h: 'Estimate', d: 'between two perfect squares you know' }],
      t: [{ value: n * 2, why: 'Doubling a number is not the same as squaring it, so halving the square does not give the root.' }], c: () => { for (let x = 1; x <= 400; x++) if (x * x === n * n) return x; return NaN; } };
  }),
  mk('cube-root', (rng, d) => {
    const n = ri(rng, 3, 10 * d + 15);
    return { p: `Find the cube root of $${n ** 3}$.`, v: n, h: ['Use the last digit of the cube to find the last digit of the root.', 'Estimate with cubes of multiples of $10$.', 'Check by cubing.'], s: [{ h: 'Last digit', d: 'a cube ending in this digit comes from a unique last digit' }],
      t: [{ value: n * n, why: 'Squaring is not cubing.' }], c: () => { for (let x = 1; x <= 100; x++) if (x ** 3 === n ** 3) return x; return NaN; } };
  }),
  mk('multiplier-square', (rng, d) => {
    const sf = [2, 3, 5, 6, 7, 10, 11, 13, 14, 15][ri(rng, 0, 9)], m = ri(rng, 2, 6 + 2 * d);
    return { p: `By what smallest number must $${sf * m * m}$ be multiplied to get a perfect square?`, v: sf, h: ['Write the number as a product of primes.', 'A perfect square has every prime in pairs.', 'Multiply by each unpaired prime.'], s: [{ h: 'Factorise', d: `$${sf * m * m} = ${sf}\\times ${m * m}$` }],
      t: [{ value: sf * m * m, why: 'Only the unpaired primes are needed, not the whole number.' }], c: () => { for (let k = 1; k <= 400; k++) { const v = sf * m * m * k, r = Math.round(Math.sqrt(v)); if (r * r === v) return k; } return NaN; } };
  }),
  mk('multiplier-cube', (rng, d) => {
    const e = [1, 2, 4, 5], e2 = e[ri(rng, 0, 3)], e3 = e[ri(rng, 0, 3)], e5 = e[ri(rng, 0, 1)];
    const n = 2 ** e2 * 3 ** e3 * 5 ** e5, need = 2 ** ((3 - (e2 % 3)) % 3) * 3 ** ((3 - (e3 % 3)) % 3) * 5 ** ((3 - (e5 % 3)) % 3);
    void d;
    if (need === 1) throw RETRY;
    return { p: `By what smallest number must $${n}$ be multiplied to get a perfect cube?`, v: need, h: ['Write the number as a product of primes.', 'A perfect cube has every prime in triples.', 'Multiply by what completes each triple.'], s: [{ h: 'Factorise', d: `$${n} = 2^{${e2}}\\cdot 3^{${e3}}\\cdot 5^{${e5}}$` }],
      t: [{ value: n, why: 'Only the missing primes are needed, not the whole number.' }], c: () => { for (let k = 1; k <= 20000; k++) { const v = n * k, r = Math.round(Math.cbrt(v)); if (r * r * r === v) return k; } return NaN; } };
  }),
  mk('count-squares', (rng, d) => {
    const a = ri(rng, 10, 100 * d), b = a + ri(rng, 80, 400 * d);
    const v = Math.floor(Math.sqrt(b)) - Math.ceil(Math.sqrt(a)) + 1;
    if (v < 2) throw RETRY;
    return { p: `How many perfect squares lie between $${a}$ and $${b}$ (including both if they are squares)?`, v, h: ['Find the smallest square that is at least the lower number.', 'Find the largest square that is at most the upper number.', 'Count the squares between them.'], s: [{ h: 'Roots', d: `$\\lceil\\sqrt{${a}}\\rceil$ to $\\lfloor\\sqrt{${b}}\\rfloor$` }],
      t: [{ value: b - a, why: 'That counts all the numbers, not only the squares.' }], c: () => { let c = 0; for (let x = a; x <= b; x++) { const r = Math.round(Math.sqrt(x)); if (r * r === x) c += 1; } return c; } };
  })
];

// ── exponents ────────────────────────────────────────────────────────────────
const EXPO = () => [
  mk('laws', (rng, d) => {
    const base = ri(rng, 2, 5), m = ri(rng, 3, 9), n = ri(rng, 3, 9), k = ri(rng, 1, m + n - 1);
    if (base ** (m + n - k) > 100000) throw RETRY;
    return { p: `Evaluate $\\dfrac{${base}^{${m}} \\times ${base}^{${n}}}{${base}^{${k}}}$.`, v: base ** (m + n - k), h: ['When multiplying powers of the same base, add the exponents.', 'When dividing, subtract.', 'Then evaluate the single power.'], s: [{ h: 'Combine', d: `$${base}^{${m} + ${n} - ${k}}$` }],
      t: [{ value: base ** (m * n - k), why: 'Multiplying powers adds the exponents; it does not multiply them.' }].filter(t => Number.isSafeInteger(t.value)), c: () => { let top = 1; for (let i = 0; i < m + n; i++) top *= base; let bot = 1; for (let i = 0; i < k; i++) bot *= base; return top / bot; } };
  }),
  mk('negative-power', (rng, d) => {
    const b = [2, 5, 10][ri(rng, 0, 2)], n = ri(rng, 1, b === 5 ? 4 : 5);
    void d;
    return { p: `Write $${b}^{-${n}}$ as a decimal.`, v: r6(1 / b ** n), h: ['A negative exponent means a reciprocal.', `$${b}^{-${n}} = \\dfrac{1}{${b}^{${n}}}$.`, 'Divide to get the decimal.'], s: [{ h: 'Reciprocal', d: `$\\dfrac{1}{${b ** n}}$` }],
      t: [{ value: -(b ** n), why: 'A negative exponent does not make the number negative; it takes the reciprocal.' }], c: () => r6(Math.pow(b, -n)) };
  }),
  mk('find-exponent', (rng, d) => {
    const b = ri(rng, 2, 7), x = ri(rng, 3, 12 + d);
    if (b ** x > 9e15) throw RETRY;
    return { p: `Find $x$ if $${b}^x = ${b ** x}$.`, v: x, h: ['Write the number as repeated multiplication of the base.', 'Count how many times the base appears.', 'Check by computing the power.'], s: [{ h: 'Count', d: `divide by $${b}$ repeatedly` }],
      t: [{ value: b ** x / b, why: 'The unknown is the exponent, not the number before the last multiplication.' }].filter(t => Number.isSafeInteger(t.value)), c: () => { let v = 1, i = 0; while (v < b ** x) { v *= b; i += 1; } return i; } };
  }),
  mk('standard-form', (rng, d) => {
    const e = ri(rng, 3, 5 + d), mant = ri(rng, 11, 99) / 10;
    return { p: `The distance between two cities is $${r6(mant * 10 ** e)}$ metres. Written as $a \\times 10^n$ with $1 \\le a < 10$, what is $n$?`, v: e, h: ['Move the decimal point until the number is between $1$ and $10$.', 'Count the places moved.', 'That count is the power of $10$.'], s: [{ h: 'Mantissa', d: `$${mant}$ is between $1$ and $10$` }],
      t: [{ value: e + 1, why: 'The decimal point of the mantissa already sits after the first digit.' }], c: () => Math.floor(Math.log10(mant * 10 ** e)) };
  })
];

// ── algebra: identities, factorising, linear equations ───────────────────────
const ALGB = () => [
  mk('square-identity', (rng, d) => {
    const h = 100 * ri(rng, 1, 5 + d), s = ri(rng, 1, 9);
    return { p: `Using $(a + b)^2 = a^2 + 2ab + b^2$, evaluate $${h + s}^2$.`, v: (h + s) ** 2, h: [`Write $${h + s}$ as $${h} + ${s}$.`, 'Expand with the identity.', 'Add the three terms.'], s: [{ h: 'Expand', d: `$${h}^2 + 2(${h})(${s}) + ${s}^2$` }],
      t: [{ value: h * h + s * s, why: 'The middle term $2ab$ is part of the expansion.' }], c: () => (h + s) * (h + s) };
  }),
  mk('difference-squares', (rng, d) => {
    const m = 10 * ri(rng, 2, 9 * d), s = ri(rng, 1, 9);
    return { p: `Using $a^2 - b^2 = (a + b)(a - b)$, evaluate $${m + s} \\times ${m - s}$.`, v: m * m - s * s, h: [`The numbers are $${m}$ plus and minus $${s}$.`, 'Their product is a difference of squares.', 'Evaluate $a^2 - b^2$.'], s: [{ h: 'Identity', d: `$${m}^2 - ${s}^2$` }],
      t: [{ value: m * m + s * s, why: 'The identity gives a difference, not a sum.' }], c: () => (m + s) * (m - s) };
  }),
  mk('linear-both-sides', (rng, d) => {
    const x = nzs(rng, R(d)), a = ri(rng, 2, 9), c = ri(rng, 1, a - 1), b = ri(rng, -R(d), R(d)), e = a * x + b - c * x;
    return { p: `Solve $${a}x ${b < 0 ? '-' : '+'} ${Math.abs(b)} = ${c}x ${e < 0 ? '-' : '+'} ${Math.abs(e)}$.`.replace(/ \+ 0\b/g, '').replace(/ - 0\b/g, ''), v: x, h: ['Collect the $x$ terms on one side.', 'Collect the numbers on the other.', 'Divide by the coefficient of $x$.'], s: [{ h: 'Collect', d: `$${a - c}x = ${e - b}$` }],
      t: [{ value: e - b, why: 'The coefficient $' + (a - c) + '$ must still be divided out.' }], c: () => { for (let t = -R(d) - 1; t <= R(d) + 1; t++) if (a * t + b === c * t + e) return t; return NaN; } };
  }),
  mk('common-factor', (rng, d) => {
    const n = ri(rng, 12, 90), p = ri(rng, 11, 60), q = ri(rng, 11, 60);
    if (p === q) throw RETRY;
    return { p: `Using the common factor, evaluate $${n} \\times ${p} + ${n} \\times ${q}$ without multiplying each product separately.`, v: n * (p + q), h: ['Factorise: $ab + ac = a(b + c)$.', 'Add the two numbers first.', 'Multiply once.'], s: [{ h: 'Factor', d: `$${n}(${p} + ${q})$` }],
      t: [{ value: n + p + q, why: 'The common factor multiplies the sum.' }], c: () => n * p + n * q };
  })
];

// ── proportion ───────────────────────────────────────────────────────────────
const PROPF = () => [
  mk('direct', (rng, d) => {
    const u = ri(rng, 2, 12), n1 = ri(rng, 2, 9), n2 = ri(rng, 10, 30 + 10 * d);
    return { p: `${n1} notebooks cost ₹${n1 * u} at a shop in ${place(rng)}. How much do ${n2} notebooks cost, in rupees?`, v: n2 * u, h: ['The cost is directly proportional to the number of notebooks.', 'Find the cost of one.', 'Multiply by the new number.'], s: [{ h: 'One notebook', d: `$${n1 * u}\\div ${n1}$` }],
      t: [{ value: n1 * u + n2, why: 'Cost grows in proportion; it does not add the extra count.' }], c: () => { const one = (n1 * u) / n1; return one * n2; } };
  }),
  mk('inverse', (rng, d) => {
    const w1 = ri(rng, 2, 12), days = ri(rng, 4, 20), f = [2, 3, 4, 5][ri(rng, 0, 3)];
    return { p: `${w1} workers can build a wall in $${days * f}$ days. How many days would ${w1 * f} workers take, working at the same rate?`, v: days, h: ['More workers means fewer days: the quantities are inversely proportional.', 'Workers times days is the same for both groups.', 'Divide the total by the new number of workers.'], s: [{ h: 'Total work', d: `$${w1}\\times ${days * f}$` }],
      t: [{ value: days * f * f, why: 'More workers take fewer days, not more.' }], c: () => (w1 * days * f) / (w1 * f) };
  }),
  mk('speed-time', (rng, d) => {
    const f = [2, 3, 4][ri(rng, 0, 2)], v1 = ri(rng, 15, Math.floor(100 / f)), t1 = ri(rng, 2, 10 + d);
    return { p: `A bus travelling at $${v1 * f}$ km/h covers a journey in $${t1}$ hours. How long would it take at $${v1}$ km/h, in hours?`, v: t1 * f, h: ['For a fixed distance, speed and time are inversely proportional.', 'Distance equals speed times time.', 'Divide the distance by the new speed.'], s: [{ h: 'Distance', d: `$${v1 * f}\\times ${t1}$` }],
      t: [{ value: t1, why: 'A lower speed means a longer time.' }], c: () => (v1 * f * t1) / v1 };
  }),
  mk('reverse-rate', (rng, d) => {
    const u = ri(rng, 3, 20), n = ri(rng, 3, 15 + d), c = u * n;
    return { p: `A packet of $${n}$ pencils costs ₹${c}. Find the cost of one pencil, in rupees.`, v: u, h: ['Divide the total cost by the number of pencils.', 'Check by multiplying back.', 'The unit price is a rate.'], s: [{ h: 'Divide', d: `$${c}\\div ${n}$` }],
      t: [{ value: c - n, why: 'Rates come from division, not subtraction.' }], c: () => { for (let x = 1; x <= 200; x++) if (x * n === c) return x; return NaN; } };
  })
];

// ── mensuration ──────────────────────────────────────────────────────────────
const TRI_H = [[13, 14, 15, 84], [5, 5, 6, 12], [10, 13, 13, 60], [9, 10, 17, 36], [6, 25, 29, 60], [17, 25, 26, 204]];
const MENS2 = () => [
  mk('trapezium', (rng, d) => {
    const [a, b] = distinct(rng, 3, R(d), 2), h = 2 * ri(rng, 1, 10 + 3 * d);
    return { p: `A trapezium-shaped field in ${place(rng)} has parallel sides $${a}$ m and $${b}$ m, and the distance between them is $${h}$ m. Find its area in square metres.`, v: ((a + b) * h) / 2, h: ['Area of a trapezium is $\\dfrac12(a + b)h$.', 'Add the parallel sides.', 'Multiply by the height and halve.'], s: [{ h: 'Formula', d: `$\\dfrac12(${a} + ${b})(${h})$` }],
      f: D.trapeziumFigure({ a, b, h, shown: { a: `${a} m`, b: `${b} m`, h: `${h} m` } }),
      t: [{ value: (a + b) * h, why: 'The factor $\\frac12$ is part of the formula.' }], c: () => { let s = 0; for (let y = 0; y < h; y++) s += (a + b) / 2; return s; } };
  }),
  mk('rhombus', (rng, d) => {
    const [p, q] = distinct(rng, 2, 10 + 3 * d, 2);
    return { p: `The diagonals of a rhombus are $${2 * p}$ cm and $${2 * q}$ cm. Find its area in square centimetres.`, v: 2 * p * q, h: ['Area of a rhombus is half the product of its diagonals.', 'Multiply the diagonals.', 'Halve.'], s: [{ h: 'Formula', d: `$\\dfrac12\\times ${2 * p}\\times ${2 * q}$` }],
      f: D.rhombusFigure({ d1: 2 * p, d2: 2 * q, shown: { d1: `${2 * p} cm`, d2: `${2 * q} cm` } }),
      t: [{ value: 4 * p * q, why: 'The area is half the product of the diagonals.' }], c: () => (2 * p * 2 * q) / 2 };
  }),
  mk('cuboid-surface', (rng, d) => {
    const [l, b, h] = distinct(rng, 2, 8 + 4 * d, 3);
    return { p: `A closed cuboid-shaped box has length $${l}$ cm, breadth $${b}$ cm and height $${h}$ cm. Find its total surface area in square centimetres.`, v: 2 * (l * b + b * h + h * l), h: ['A cuboid has three pairs of equal faces.', 'Add the areas of the three different faces.', 'Double the sum.'], s: [{ h: 'Formula', d: '$2(lb + bh + hl)$' }],
      t: [{ value: l * b * h, why: 'That is the volume, not the surface area.' }], c: () => l * b * 2 + b * h * 2 + h * l * 2 };
  }),
  mk('heron', (rng, d) => {
    const t = TRI_H[ri(rng, 0, 5)], k = ri(rng, 1, 3 + d);
    return { p: `The sides of a triangle are $${t[0] * k}$ cm, $${t[1] * k}$ cm and $${t[2] * k}$ cm. Use Heron's formula to find its area in square centimetres.`, v: t[3] * k * k, h: ["Heron's formula needs the semi-perimeter $s$.", '$A = \\sqrt{s(s-a)(s-b)(s-c)}$.', 'The product under the root is a perfect square.'], s: [{ h: 'Semi-perimeter', d: `$s = ${(t[0] + t[1] + t[2]) * k / 2}$` }],
      f: D.triangle({ a: t[0] * k, b: t[1] * k, c: t[2] * k, shown: { a: `${t[0] * k} cm`, b: `${t[1] * k} cm`, c: `${t[2] * k} cm` } }),
      t: [{ value: t[3] * k, why: 'Area scales with the square of the scale factor.' }].filter(x => k > 1), c: () => { const s0 = ((t[0] + t[1] + t[2]) * k) / 2; return Math.round(Math.sqrt(s0 * (s0 - t[0] * k) * (s0 - t[1] * k) * (s0 - t[2] * k))); } };
  })
];

// ── angles, triangles and polygons ───────────────────────────────────────────
const ANGLES = () => [
  mk('triangle-sum', (rng, d) => {
    const a = ri(rng, 20, 80), b = ri(rng, 20, 160 - a - 20);
    return { p: `Two angles of a triangle are $${a}^\\circ$ and $${b}^\\circ$. Find the third angle in degrees.`, v: 180 - a - b, h: ['The angles of a triangle add to $180^\\circ$.', 'Add the two known angles.', 'Subtract from $180^\\circ$.'], s: [{ h: 'Subtract', d: `$180 - ${a} - ${b}$` }],
      t: [{ value: a + b, why: 'That is the sum of the two known angles, not the third.' }], c: () => 180 - (a + b) };
  }),
  mk('exterior-angle', (rng, d) => {
    const [a, b] = distinct(rng, 20, 75, 2);
    return { p: `A side of a triangle is produced. The two interior opposite angles measure $${a}^\\circ$ and $${b}^\\circ$. Find the exterior angle formed, in degrees.`, v: a + b, h: ['An exterior angle equals the sum of the two interior opposite angles.', 'Add them.', 'Check: it is also $180^\\circ$ minus the adjacent interior angle.'], s: [{ h: 'Sum', d: `$${a} + ${b}$` }],
      t: [{ value: 180 - a - b, why: 'That is the third interior angle, not the exterior angle.' }], c: () => 180 - (180 - a - b) };
  }),
  mk('polygon-sum', (rng, d) => {
    const n = ri(rng, 5, 12 + 8 * d);
    return { p: `Find the sum of the interior angles of a polygon with $${n}$ sides, in degrees.`, v: (n - 2) * 180, h: ['Split the polygon into triangles from one vertex.', 'There are $n - 2$ triangles.', 'Each contributes $180^\\circ$.'], s: [{ h: 'Formula', d: `$(${n} - 2)\\times 180$` }],
      t: [{ value: n * 180, why: 'Triangulating from one vertex gives $n - 2$ triangles, not $n$.' }], c: () => { let t = 0; for (let v = 1; v < n - 1; v++) t += 180; return t; } };
  }),
  mk('regular-exterior', (rng, d) => {
    const n = [3, 4, 5, 6, 8, 9, 10, 12, 15, 18, 20, 24, 30, 36, 40, 45, 60, 72][ri(rng, 0, 17)];
    return { p: `Each exterior angle of a regular polygon is $${360 / n}^\\circ$. How many sides does it have?`, v: n, h: ['The exterior angles of any polygon add to $360^\\circ$.', 'All exterior angles of a regular polygon are equal.', 'Divide $360^\\circ$ by one exterior angle.'], s: [{ h: 'Divide', d: `$360\\div ${360 / n}$` }],
      t: [{ value: 180 / n * 2 - 2 > 0 ? 180 - 360 / n : 0, why: 'That is the interior angle, not the number of sides.' }], c: () => { for (let s = 3; s <= 360; s++) if (360 / s === 360 / n) return s; return NaN; } };
  }),
  mk('third-side-count', (rng, d) => {
    const [a, b] = distinct(rng, 2, 10 + 5 * d, 2);
    return { p: `Two sides of a triangle are $${a}$ cm and $${b}$ cm. How many different whole-number lengths can the third side have?`, v: 2 * Math.min(a, b) - 1, h: ['The third side must be less than the sum of the other two.', 'It must also be greater than their difference.', 'Count the whole numbers strictly between.'], s: [{ h: 'Range', d: `$${Math.abs(a - b)} < x < ${a + b}$` }],
      t: [{ value: 2 * Math.min(a, b), why: 'Both end values are excluded; count only the whole numbers strictly between them.' }], c: () => { let c = 0; for (let x = 1; x <= a + b; x++) if (x + a > b && x + b > a && a + b > x) c += 1; return c; } };
  }),
  mk('parallel-lines', (rng, d) => {
    const a = ri(rng, 30, 150);
    if (a === 90) throw RETRY;
    return { p: `A transversal cuts two parallel lines. At the first line, the interior angle on the left of the transversal is $${a}^\\circ$. Find the interior angle on the left of the transversal at the second line, in degrees.`, v: 180 - a, h: ['Interior angles on the same side of a transversal between parallel lines are supplementary.', 'They add to $180^\\circ$.', 'Subtract.'], s: [{ h: 'Supplementary', d: `$180 - ${a}$` }],
      t: [{ value: a, why: 'Those would be alternate or corresponding angles, which are equal; co-interior angles add to $180^\\circ$.' }], c: () => 180 - a };
  })
];

// ── quadrilaterals ───────────────────────────────────────────────────────────
const POLYQ = () => [
  mk('parallelogram-angle', (rng, d) => {
    const a = ri(rng, 40, 140), b = 180 - a;
    if (a === 90) throw RETRY;
    return { p: `One angle of a parallelogram is $${a}^\\circ$. Find the adjacent angle in degrees.`, v: b, h: ['Adjacent angles of a parallelogram are supplementary.', 'They add to $180^\\circ$.', 'Subtract.'], s: [{ h: 'Supplementary', d: `$180 - ${a}$` }],
      t: [{ value: a, why: 'Opposite angles are equal; adjacent angles add to $180^\\circ$.' }], c: () => 180 - a };
  }),
  mk('rhombus-side', (rng, d) => {
    const t = [[3, 4, 5], [5, 12, 13], [8, 15, 17], [7, 24, 25]][ri(rng, 0, 3)], k = ri(rng, 1, 4 + d);
    return { p: `The diagonals of a rhombus are $${2 * t[0] * k}$ cm and $${2 * t[1] * k}$ cm. Find its side in cm.`, v: t[2] * k, h: ['The diagonals of a rhombus bisect each other at right angles.', 'Half the diagonals and a side form a right triangle.', 'Use Pythagoras.'], s: [{ h: 'Half diagonals', d: `$${t[0] * k}$ and $${t[1] * k}$` }],
      f: D.rhombusFigure({ d1: 2 * t[0] * k, d2: 2 * t[1] * k, shown: { d1: `${2 * t[0] * k} cm`, d2: `${2 * t[1] * k} cm`, side: '?' } }),
      t: [{ value: (t[0] + t[1]) * k, why: 'The side is the hypotenuse, not the sum of the half-diagonals.' }], c: () => Math.round(Math.hypot(t[0] * k, t[1] * k)) };
  }),
  mk('angle-sum', (rng, d) => {
    const [a, b, c] = distinct(rng, 60, 130, 3);
    if (a + b + c >= 350) throw RETRY;
    return { p: `Three angles of a quadrilateral are $${a}^\\circ$, $${b}^\\circ$ and $${c}^\\circ$. Find the fourth angle in degrees.`, v: 360 - a - b - c, h: ['The angles of a quadrilateral add to $360^\\circ$.', 'Add the three known angles.', 'Subtract from $360^\\circ$.'], s: [{ h: 'Subtract', d: `$360 - ${a} - ${b} - ${c}$` }],
      t: [{ value: 180 - (a + b + c), why: 'The angles of a quadrilateral add to $360^\\circ$, not $180^\\circ$.' }], c: () => 360 - (a + b + c) };
  }),
  mk('rectangle-diagonal', (rng, d) => {
    const t = [[3, 4, 5], [5, 12, 13], [8, 15, 17], [20, 21, 29]][ri(rng, 0, 3)], k = ri(rng, 1, 5 + d);
    return { p: `A rectangular plot in ${place(rng)} measures $${t[0] * k}$ m by $${t[1] * k}$ m. Find the length of its diagonal in metres.`, v: t[2] * k, h: ['The diagonal splits the rectangle into two right triangles.', 'Use Pythagoras.', 'Take the square root.'], s: [{ h: 'Pythagoras', d: `$\\sqrt{${t[0] * k}^2 + ${t[1] * k}^2}$` }],
      t: [{ value: (t[0] + t[1]) * k, why: 'The diagonal is shorter than going round two sides.' }], c: () => Math.round(Math.sqrt((t[0] * k) ** 2 + (t[1] * k) ** 2)) };
  })
];

// ── circles (Class 9) ────────────────────────────────────────────────────────
const CIRC9 = () => [
  mk('centre-angle', (rng, d) => {
    const a = ri(rng, 15, 85);
    return { p: `An arc subtends an angle of $${a}^\\circ$ at a point on the circle. Find the angle it subtends at the centre, in degrees.`, v: 2 * a, h: ['The angle at the centre is twice the angle at the circumference.', 'Both stand on the same arc.', 'Double it.'], s: [{ h: 'Theorem', d: `$2\\times ${a}$` }],
      t: [{ value: a / 2, why: 'The central angle is double, not half.' }], c: () => a + a };
  }),
  mk('semicircle', (rng, d) => {
    const a = ri(rng, 20, 70);
    return { p: `$AB$ is a diameter of a circle and $C$ is a point on the circle. If $\\angle CAB = ${a}^\\circ$, find $\\angle CBA$ in degrees.`, v: 90 - a, h: ['The angle in a semicircle is $90^\\circ$.', 'So triangle $ABC$ has a right angle at $C$.', 'The other two angles add to $90^\\circ$.'], s: [{ h: 'Right angle', d: '$\\angle ACB = 90^\\circ$' }],
      t: [{ value: 180 - a, why: 'The triangle has a right angle, so the other two angles add to $90^\\circ$.' }], c: () => 180 - 90 - a };
  }),
  mk('cyclic-quadrilateral', (rng, d) => {
    const a = ri(rng, 50, 130);
    if (a === 90) throw RETRY;
    return { p: `$ABCD$ is a cyclic quadrilateral with $\\angle A = ${a}^\\circ$. Find $\\angle C$ in degrees.`, v: 180 - a, h: ['Opposite angles of a cyclic quadrilateral are supplementary.', '$\\angle A + \\angle C = 180^\\circ$.', 'Subtract.'], s: [{ h: 'Supplementary', d: `$180 - ${a}$` }],
      t: [{ value: a, why: 'Opposite angles of a cyclic quadrilateral add to $180^\\circ$; they are not equal unless both are $90^\\circ$.' }], c: () => 180 - a };
  }),
  mk('chord-distance', (rng, d) => {
    const t = [[3, 4, 5], [5, 12, 13], [8, 15, 17], [7, 24, 25]][ri(rng, 0, 3)], k = ri(rng, 1, 5 + d);
    return { p: `A chord $${2 * t[0] * k}$ cm long lies in a circle of radius $${t[2] * k}$ cm. Find its distance from the centre in cm.`, v: t[1] * k, h: ['The perpendicular from the centre bisects the chord.', 'Half the chord, the distance and the radius form a right triangle.', 'Use Pythagoras.'], s: [{ h: 'Half chord', d: `$${t[0] * k}$` }],
      f: D.chordFigure({ r: t[2] * k, dist: t[1] * k, shown: { r: `${t[2] * k} cm`, chord: `${2 * t[0] * k} cm`, dist: '?' } }),
      t: [{ value: t[0] * k, why: 'That is half the chord, not its distance from the centre.' }], c: () => Math.round(Math.sqrt((t[2] * k) ** 2 - (t[0] * k) ** 2)) };
  })
];

// ── statistics (Class 7) ─────────────────────────────────────────────────────
const STAT7 = () => [
  mk('mean', (rng, d) => {
    const n = [4, 5, 8, 10][ri(rng, 0, 3)], mean = ri(rng, 10, 60), xs = [];
    for (;;) { xs.length = 0; for (let i = 0; i < n - 1; i++) xs.push(mean + ri(rng, -8, 8)); xs.push(mean * n - xs.reduce((s, x) => s + x, 0)); if (xs.every(x => x > 0) && new Set(xs).size === n) break; }
    return { p: `The runs scored by a batter in ${n} matches were ${xs.join(', ')}. Find the mean score.`, v: mean, h: ['The mean is the sum divided by the number of values.', 'Add all the scores.', 'Divide by ' + n + '.'], s: [{ h: 'Sum', d: `$${xs.reduce((s, x) => s + x, 0)}$` }],
      t: [{ value: Math.max(...xs), why: 'The mean is not the largest value.' }], c: () => xs.reduce((s, x) => s + x, 0) / n };
  }),
  mk('median', (rng, d) => {
    const n = [5, 7, 9][ri(rng, 0, 2)], xs = distinct(rng, 1, 40 + 20 * d, n), sorted = [...xs].sort((a, b) => a - b);
    return { p: `Find the median of ${xs.join(', ')}.`, v: sorted[(n - 1) / 2], h: ['Arrange the numbers in order.', 'With an odd count, the median is the middle number.', 'Count in from both ends.'], s: [{ h: 'Order', d: sorted.join(', ') }],
      t: [{ value: xs[(n - 1) / 2], why: 'The values must be arranged in order before taking the middle one.' }].filter(t => t.value !== sorted[(n - 1) / 2]), c: () => { const s = [...xs].sort((a, b) => a - b); return s[Math.floor(n / 2)]; } };
  }),
  mk('mode', (rng, d) => {
    const m = ri(rng, 1, 30), others = distinct(rng, 31, 60, 4), xs = [m, ...others, m, others[0], m].sort(() => rng() - 0.5);
    return { p: `The marks of a few students are ${xs.join(', ')}. Find the mode.`, v: m, h: ['The mode is the value that occurs most often.', 'Tally each value.', 'Pick the one with the highest tally.'], s: [{ h: 'Tally', d: 'count how often each value occurs' }],
      t: [{ value: others[0], why: 'That value occurs twice, but ' + m + ' occurs three times.' }], c: () => { const c = new Map(); for (const x of xs) c.set(x, (c.get(x) || 0) + 1); return [...c.entries()].sort((a, b) => b[1] - a[1])[0][0]; } };
  }),
  mk('range', (rng, d) => {
    const xs = distinct(rng, 1, 90 + 10 * d, 6);
    return { p: `Find the range of ${xs.join(', ')}.`, v: Math.max(...xs) - Math.min(...xs), h: ['The range is the largest value minus the smallest.', 'Find both.', 'Subtract.'], s: [{ h: 'Subtract', d: `$${Math.max(...xs)} - ${Math.min(...xs)}$` }],
      t: [{ value: Math.max(...xs), why: 'The range is a difference, not the largest value.' }], c: () => { let lo = Infinity, hi = -Infinity; for (const x of xs) { lo = Math.min(lo, x); hi = Math.max(hi, x); } return hi - lo; } };
  })
];

// ── solids and symmetry (Class 7) ────────────────────────────────────────────
const SOLID = () => [
  mk('prism-edges', (rng, d) => {
    const n = ri(rng, 3, 12 + 3 * d);
    return { p: `A prism has a base with $${n}$ sides. How many edges does the prism have?`, v: 3 * n, h: ['A prism has two bases and $n$ side faces.', 'Each base has $n$ edges, and there are $n$ vertical edges.', 'Add them.'], s: [{ h: 'Count', d: `$${n} + ${n} + ${n}$` }],
      t: [{ value: 2 * n, why: 'Do not forget the vertical edges joining the two bases.' }], c: () => { let e = 0; e += n; e += n; e += n; return e; } };
  }),
  mk('euler-faces', (rng, d) => {
    const [F2, V] = distinct(rng, 4, 12 + 4 * d, 2);
    return { p: `A solid has $${F2}$ faces and $${V}$ vertices. Using Euler's formula $F + V - E = 2$, find the number of edges.`, v: F2 + V - 2, h: ["Euler's formula: $F + V - E = 2$.", 'Substitute the faces and vertices.', 'Solve for $E$.'], s: [{ h: 'Solve', d: `$E = ${F2} + ${V} - 2$` }],
      t: [{ value: F2 + V, why: 'Euler\'s formula subtracts $2$ from $F + V$ to give $E$.' }], c: () => { for (let E = 1; E <= 100; E++) if (F2 + V - E === 2) return E; return NaN; } };
  }),
  mk('lines-of-symmetry', (rng, d) => {
    const [n1, n2] = distinct(rng, 3, 12 + 8 * d, 2);
    return { p: `A regular polygon has $${n1}$ sides and another has $${n2}$ sides. How many lines of symmetry do the two have in all?`, v: n1 + n2, h: ['A regular polygon has one line of symmetry for each side.', 'Count the lines of each polygon.', 'Add them.'], s: [{ h: 'Rule', d: 'as many lines as sides' }],
      t: [{ value: 2 * (n1 + n2), why: 'Each line of symmetry is counted once; a line is not counted separately for each end.' }], c: () => { let c = 0; for (let i = 0; i < n1; i++) c += 1; for (let i = 0; i < n2; i++) c += 1; return c; } };
  }),
  mk('turns', (rng, d) => {
    const n = [3, 4, 5, 6, 8, 9, 10, 12][ri(rng, 0, 7)], k = ri(rng, 2, 20 * d);
    return { p: `A regular polygon with $${n}$ sides is turned about its centre in steps of $\\dfrac{360^\\circ}{${n}}$. Through what total angle, in degrees, has it turned after $${k}$ steps?`, v: (360 * k) / n, h: ['One step is $360^\\circ$ divided by the number of sides.', 'Multiply by the number of steps.', 'The total can exceed $360^\\circ$.'], s: [{ h: 'Multiply', d: `$${k}\\times\\dfrac{360}{${n}}$` }],
      t: [{ value: 360 / n, why: 'That is only one step.' }], c: () => { let t = 0; for (let i = 0; i < k; i++) t += 360 / n; return t; } };
  }),
  mk('rotation-angle', (rng, d) => {
    const n = [3, 4, 5, 6, 8, 9, 10, 12, 15, 18, 20, 24, 30, 36, 40, 45, 60, 72][ri(rng, 0, 17)];
    return { p: `A regular polygon with $${n}$ sides is turned about its centre until it looks the same for the first time. Through what smallest angle, in degrees, is it turned?`, v: 360 / n, h: ['A full turn is $360^\\circ$.', 'The polygon looks the same after $n$ equal turns.', 'Divide.'], s: [{ h: 'Divide', d: `$360\\div ${n}$` }],
      t: [{ value: 180 - 360 / n, why: 'That is the interior angle, not the angle of rotation.' }].filter(t => t.value !== 360 / n), c: () => { for (let a = 1; a <= 360; a++) if (a * n === 360) return a; return NaN; } };
  })
];

// ── LCM and HCF in context (Class 7) ─────────────────────────────────────────
const LCMF = () => [
  mk('bells', (rng, d) => {
    const [a, b] = distinct(rng, 4, 20 + 5 * d, 2);
    if (a % b === 0 || b % a === 0) throw RETRY;
    return { p: `Two temple bells in ${place(rng)} ring every $${a}$ minutes and every $${b}$ minutes. They ring together at $6$ a.m. After how many minutes will they next ring together?`, v: (a * b) / gcd(a, b), h: ['They ring together at common multiples of both intervals.', 'The first time again is the lowest common multiple.', 'Find the LCM of the two numbers.'], s: [{ h: 'LCM', d: `$\\operatorname{lcm}(${a}, ${b})$` }],
      t: [{ value: a * b, why: 'The product is a common multiple, but not always the lowest.' }].filter(t => t.value !== (a * b) / gcd(a, b)), c: () => { for (let t = Math.max(a, b); ; t += Math.max(a, b)) if (t % a === 0 && t % b === 0) return t; } };
  }),
  mk('tiles', (rng, d) => {
    const g = ri(rng, 2, 12 + 2 * d), [u, v] = distinct(rng, 2, 14, 2);
    let x = u, y = v; while (y) [x, y] = [y, x % y];
    const l = (g * u) / x, w = (g * v) / x;
    return { p: `A floor measures $${l}$ dm by $${w}$ dm. What is the side, in dm, of the largest square tile that exactly covers it without cutting?`, v: g, h: ['The side must divide both lengths exactly.', 'The largest such number is the HCF.', 'Find the HCF of the two lengths.'], s: [{ h: 'HCF', d: `$\\gcd(${l}, ${w})$` }],
      t: [{ value: (l * w) / g, why: 'That is the LCM; the tile side is the highest common factor.' }], c: () => { let a = l, b = w; while (b) [a, b] = [b, a % b]; return a; } };
  }),
  mk('lcm-built', (rng, d) => {
    const h = ri(rng, 2, 9), [u, v] = distinct(rng, 2, 12, 2);
    let x = u, y = v; while (y) [x, y] = [y, x % y];
    const A = (h * u) / x, B = (h * v) / x;
    if (A % B === 0 || B % A === 0) throw RETRY;
    return { p: `Find the LCM of $${A}$ and $${B}$.`, v: (A * B) / h, h: ['List multiples of the larger number.', 'Stop at the first that is also a multiple of the smaller.', 'Or use HCF $\\times$ LCM $=$ product.'], s: [{ h: 'Multiples', d: 'of the larger number' }],
      t: [{ value: A * B, why: 'The product of the numbers is a common multiple, but not the lowest.' }].filter(t => t.value !== (A * B) / h), c: () => { for (let t = Math.max(A, B); ; t += Math.max(A, B)) if (t % A === 0 && t % B === 0) return t; } };
  }),
  mk('reverse-hcf', (rng, d) => {
    const h = ri(rng, 2, 9), [u, v] = distinct(rng, 2, 12, 2);
    let x = u, y = v; while (y) [x, y] = [y, x % y];
    const A = (h * u) / x, B = (h * v) / x, l = (A * B) / h;
    if (A === h || B === h || A === B) throw RETRY;
    return { p: `The HCF of two numbers is $${h}$ and their LCM is $${l}$. One of the numbers is $${A}$. Find the other.`, v: B, h: ['For two numbers, HCF $\\times$ LCM $=$ their product.', 'Multiply the HCF and the LCM.', 'Divide by the known number.'], s: [{ h: 'Product', d: `$${h}\\times ${l}$` }],
      t: [{ value: l - A, why: 'Use the relation HCF $\\times$ LCM $=$ product, not a difference.' }].filter(t => t.value !== B), c: () => { for (let t = 1; t <= 1000; t++) if (A * t === h * l) return t; return NaN; } };
  })
];

// ── coordinates (Class 9) ────────────────────────────────────────────────────
const COORD9 = () => [
  mk('rectangle-area', (rng, d) => {
    const x1 = ri(rng, -9, 0), y1 = ri(rng, -9, 0), w = ri(rng, 2, 10 + 3 * d), h = ri(rng, 2, 10 + 3 * d);
    if (w === h) throw RETRY;
    return { p: `A rectangle has vertices $(${x1}, ${y1})$, $(${x1 + w}, ${y1})$, $(${x1 + w}, ${y1 + h})$ and $(${x1}, ${y1 + h})$. Find its area in square units.`, v: w * h, h: ['The sides are parallel to the axes.', 'Find the width and the height from the coordinates.', 'Multiply.'], s: [{ h: 'Sides', d: `$${w}$ and $${h}$` }],
      f: D.coordPlane({ points: [{ x: x1, y: y1, label: `A(${x1}, ${y1})` }, { x: x1 + w, y: y1, label: `B(${x1 + w}, ${y1})` }, { x: x1 + w, y: y1 + h, label: `C(${x1 + w}, ${y1 + h})` }, { x: x1, y: y1 + h, label: `D(${x1}, ${y1 + h})` }], polygon: true }),
      t: [{ value: 2 * (w + h), why: 'That is the perimeter.' }], c: () => Math.abs((x1 + w) - x1) * Math.abs((y1 + h) - y1) };
  }),
  mk('reflection', (rng, d) => {
    const x = nzs(rng, R(d)), y = nzs(rng, R(d));
    return { p: `The point $(${x}, ${y})$ is reflected in the $x$-axis. Find the sum of the coordinates of its image.`, v: x - y, h: ['Reflection in the $x$-axis keeps $x$ and changes the sign of $y$.', 'Write the image.', 'Add its coordinates.'], s: [{ h: 'Image', d: `$(${x}, ${-y})$` }],
      t: [{ value: x + y, why: 'The sign of $y$ changes under reflection in the $x$-axis.' }].filter(t => t.value !== x - y), c: () => x + (-y) };
  }),
  mk('distance-from-axes', (rng, d) => {
    const x = nzs(rng, R(d)), y = nzs(rng, R(d));
    if (Math.abs(x) === Math.abs(y)) throw RETRY;
    return { p: `A point has coordinates $(${x}, ${y})$. Find the sum of its distances from the $x$-axis and from the $y$-axis, in units.`, v: Math.abs(x) + Math.abs(y), h: ['The distance from the $y$-axis is $|x|$.', 'The distance from the $x$-axis is $|y|$.', 'Distances are never negative; add them.'], s: [{ h: 'Absolute values', d: `$|${x}| + |${y}|$` }],
      f: D.coordPlane({ points: [{ x, y, label: `P(${x}, ${y})` }] }),
      t: [{ value: x + y, why: 'Distances are positive; use the absolute values before adding.' }].filter(t => t.value !== Math.abs(x) + Math.abs(y)), c: () => Math.sqrt(x * x) + Math.sqrt(y * y) };
  }),
  mk('same-line-distance', (rng, d) => {
    const x1 = nzs(rng, R(d)), x2 = nzs(rng, R(d)), y = nzs(rng, R(d));
    if (x1 === x2) throw RETRY;
    return { p: `Find the distance between the points $(${x1}, ${y})$ and $(${x2}, ${y})$.`, v: Math.abs(x1 - x2), h: ['The two points have the same $y$-coordinate, so they lie on a horizontal line.', 'The distance is the difference of the $x$-coordinates.', 'Distance is never negative.'], s: [{ h: 'Subtract', d: `$|${x1} - ${pr(x2)}|$` }],
      f: D.coordPlane({ points: [{ x: x1, y, label: `A(${x1}, ${y})` }, { x: x2, y, label: `B(${x2}, ${y})` }], segments: [[0, 1]] }),
      t: [{ value: Math.abs(x1 + x2), why: 'Subtract the $x$-coordinates; adding them gives something else.' }].filter(t => t.value !== Math.abs(x1 - x2)), c: () => Math.max(x1, x2) - Math.min(x1, x2) };
  }),
  mk('midpoint', (rng, d) => {
    const x1 = ri(rng, -R(d), R(d)), k = ri(rng, -R(d), R(d)), x2 = 2 * k - x1;
    if (x1 === x2) throw RETRY;
    return { p: `Find the $x$-coordinate of the midpoint of the segment joining $(${x1}, 3)$ and $(${x2}, 7)$.`, v: k, h: ['The midpoint is the average of the endpoints.', 'Add the two $x$-coordinates.', 'Halve.'], s: [{ h: 'Average', d: `$\\dfrac{${x1} + ${pr(x2)}}{2}$` }],
      t: [{ value: x1 + x2, why: 'Halve the sum to get the average.' }].filter(t => t.value !== k), c: () => (x1 + x2) / 2 };
  })
];

// ── puzzles: missing digits ──────────────────────────────────────────────────
const CRYPT = () => [
  mk('addition-missing', (rng, d) => {
    const a = ri(rng, 100, 899), b = ri(rng, 100, 999 - a), pos = ri(rng, 0, 2), s = String(a);
    const digit = Number(s[pos]), masked = s.slice(0, pos) + '?' + s.slice(pos + 1);
    return { p: `Find the missing digit: $${masked} + ${b} = ${a + b}$.`, v: digit, h: ['Work from the units place.', 'Use the sum to find what the missing digit must be.', 'Check by adding.'], s: [{ h: 'Subtract', d: `$${a + b} - ${b}$ gives the first number` }],
      t: [{ value: (digit + 1) % 10, why: 'Check the carry from the place on the right.' }], c: () => { for (let x = 0; x <= 9; x++) { const t = Number(s.slice(0, pos) + x + s.slice(pos + 1)); if (t + b === a + b) return x; } return NaN; } };
  }),
  mk('multiplication-missing', (rng, d) => {
    const a = ri(rng, 12, 99), m = ri(rng, 3, 9), pos = ri(rng, 0, 1), s = String(a), digit = Number(s[pos]);
    return { p: `Find the missing digit: $${pos === 0 ? '?' + s[1] : s[0] + '?'} \\times ${m} = ${a * m}$.`, v: digit, h: ['Divide the product by the multiplier.', 'The quotient shows the whole number.', 'Read off the missing digit.'], s: [{ h: 'Divide', d: `$${a * m}\\div ${m}$` }],
      t: [{ value: (digit + 1) % 10, why: 'Divide the product to find the number, then read the digit.' }], c: () => { for (let x = 0; x <= 9; x++) { const t = Number(pos === 0 ? `${x}${s[1]}` : `${s[0]}${x}`); if (t * m === a * m) return x; } return NaN; } };
  }),
  mk('digit-sum', (rng, d) => {
    const n = ri(rng, 100, 9999 * d);
    return { p: `Find the sum of the digits of $${n}$.`, v: String(n).split('').reduce((s, x) => s + Number(x), 0), h: ['Add each digit separately.', 'Do not add the place values.', 'Check each digit.'], s: [{ h: 'Add', d: String(n).split('').join(' + ') }],
      t: [{ value: n % 9, why: 'The remainder on division by $9$ is not the digit sum itself.' }].filter(t => t.value !== String(n).split('').reduce((s, x) => s + Number(x), 0)), c: () => { let s = 0, m = n; while (m) { s += m % 10; m = Math.floor(m / 10); } return s; } };
  }),
  mk('divisible-digit', (rng, d) => {
    const k = [3, 9][ri(rng, 0, 1)], base = ri(rng, 10, 999);
    ri(rng, 0, 9);   // the draw stays: the seed's stream is part of the content
    const s = `${base}?`, total = String(base).split('').reduce((a, x) => a + Number(x), 0);
    let ans = -1;
    for (let x = 0; x <= 9; x++) if ((total + x) % k === 0) { ans = x; break; }
    return { p: `What is the smallest digit that can replace the ? in $${s}$ so that the number is divisible by $${k}$?`.replace(/\$([^$]*)\?\$/, '$$$1\\square$$'), v: ans, h: [`A number is divisible by $${k}$ when the sum of its digits is.`, 'Add the digits you can see.', 'Find the smallest digit that makes the total a multiple.'], s: [{ h: 'Digit sum', d: `$${total} + ?$` }],
      t: [{ value: (ans + 1) % 10, why: 'Check the digit sum, not the last digit alone.' }].filter(t => t.value !== ans), c: () => { for (let x = 0; x <= 9; x++) if (Number(`${base}${x}`) % k === 0) return x; return NaN; } };
  })
];


// ── constructions, congruence and Euclid's geometry (Class 7 and 9) ───────────
const CONSTR = () => [
  mk('bisect-angle', (rng, d) => {
    const x = 2 * ri(rng, 10, 85);
    return { p: `An angle of $${x}^\\circ$ is bisected with a compass and ruler. How large is each of the two equal parts, in degrees?`, v: x / 2, h: ['A bisector splits an angle into two equal parts.', 'Divide the angle by $2$.', 'The two parts add back to the whole angle.'], s: [{ h: 'Halve', d: `$${x}\\div 2$` }],
      t: [{ value: x * 2, why: 'Bisecting halves the angle; it does not double it.' }], c: () => { for (let a = 1; a <= 90; a++) if (a + a === x) return a; return NaN; } };
  }),
  mk('midpoint-length', (rng, d) => {
    const m = ri(rng, 3, 40 * d + 20);
    return { p: `The perpendicular bisector of segment $AB$ of length $${2 * m}$ cm meets it at $M$. Find $AM$ in cm.`, v: m, h: ['The perpendicular bisector passes through the midpoint.', 'So $AM = MB$.', 'Halve the length of $AB$.'], s: [{ h: 'Halve', d: `$${2 * m}\\div 2$` }],
      t: [{ value: 2 * m, why: '$M$ is the midpoint, so $AM$ is half of $AB$.' }], c: () => { for (let x = 1; x <= 80 * d + 40; x++) if (x + x === 2 * m) return x; return NaN; } };
  }),
  mk('equal-distance', (rng, d) => {
    const pa = ri(rng, 4, 40 * d + 20), ab = ri(rng, 6, 60);
    return { p: `$P$ lies on the perpendicular bisector of a segment $AB$ of length $${ab}$ cm, and $PA = ${pa}$ cm. Find $PB$ in cm.`, v: pa, h: ['Every point on the perpendicular bisector is the same distance from both ends.', 'So $PA = PB$.', 'The length of $AB$ is not needed.'], s: [{ h: 'Property', d: '$PA = PB$' }],
      t: [{ value: ab - pa, why: 'The distance from $P$ to each end is the same; it is not found by subtracting from $AB$.' }].filter(t => t.value !== pa && t.value > 0), c: () => pa };
  }),
  mk('corresponding-side', (rng, d) => {
    const [a, b, c] = distinct(rng, 3, 12 + 6 * d, 3);
    return { p: `Triangle $ABC$ is congruent to triangle $PQR$ with $A \\to P$, $B \\to Q$, $C \\to R$. If $AB = ${a}$ cm, $BC = ${b}$ cm and $CA = ${c}$ cm, find $QR$ in cm.`, v: b, h: ['Congruent triangles have equal corresponding sides.', '$QR$ corresponds to $BC$.', 'Read the correspondence from the order of the letters.'], s: [{ h: 'Correspondence', d: '$B \\to Q$ and $C \\to R$, so $BC \\to QR$' }],
      t: [{ value: a, why: '$QR$ corresponds to $BC$; $PQ$ corresponds to $AB$.' }], c: () => { const map = { A: 'P', B: 'Q', C: 'R' }; const len = { AB: a, BC: b, CA: c }; for (const k of Object.keys(len)) if (map[k[0]] + map[k[1]] === 'QR') return len[k]; return NaN; } };
  }),
  mk('perimeter-congruent', (rng, d) => {
    const [a, b, c] = distinct(rng, 3, 12 + 6 * d, 3);
    if (a + b <= c || a + c <= b || b + c <= a) throw RETRY;
    return { p: `Triangle $ABC$ with sides $${a}$ cm, $${b}$ cm and $${c}$ cm is congruent to triangle $PQR$. Find the perimeter of $PQR$ in cm.`, v: a + b + c, h: ['Congruent triangles are identical in size and shape.', 'So their perimeters are equal.', 'Add the sides of $ABC$.'], s: [{ h: 'Perimeter', d: `$${a} + ${b} + ${c}$` }],
      t: [{ value: a * b * c, why: 'The perimeter is the sum of the sides, not their product.' }], c: () => a + b + c };
  }),
  mk('angle-congruent', (rng, d) => {
    const a = ri(rng, 30, 80), b = ri(rng, 30, 80);
    if (a === b) throw RETRY;
    return { p: `Triangle $ABC$ is congruent to triangle $PQR$ with $A \\to P$, $B \\to Q$, $C \\to R$. If $\\angle A = ${a}^\\circ$ and $\\angle B = ${b}^\\circ$, find $\\angle R$ in degrees.`, v: 180 - a - b, h: ['$\\angle R$ corresponds to $\\angle C$.', 'Find $\\angle C$ from the angle sum of triangle $ABC$.', 'Equal corresponding angles carry across.'], s: [{ h: 'Angle $C$', d: `$180 - ${a} - ${b}$` }],
      t: [{ value: a, why: '$\\angle R$ corresponds to $\\angle C$, not $\\angle A$.' }], c: () => 180 - (a + b) };
  }),
  mk('tiling-count', (rng, d) => {
    const t = [[3, 60], [4, 90], [6, 120], [5, 108], [8, 135], [12, 150]][ri(rng, 0, 5)], k = ri(rng, 2, 10 + 5 * d);
    return { p: `A regular polygon with $${t[0]}$ sides has an interior angle of $${t[1]}^\\circ$. Find the sum of the interior angles, in degrees, of $${k}$ such polygons.`, v: t[1] * k, h: ['Each polygon contributes its interior angle at the corner.', 'Multiply by the number of polygons.', 'A full turn is $360^\\circ$.'], s: [{ h: 'Multiply', d: `$${k}\\times ${t[1]}$` }],
      t: [{ value: t[1] + k, why: 'Each polygon contributes its own interior angle, so multiply by the number of polygons.' }], c: () => { let s2 = 0; for (let i = 0; i < k; i++) s2 += ((t[0] - 2) * 180) / t[0]; return Math.round(s2); } };
  })
];
const EUCLID = () => [
  mk('segment-addition', (rng, d) => {
    const [ab, bc] = distinct(rng, 3, 30 * d + 20, 2);
    return { p: `$B$ lies on segment $AC$ between $A$ and $C$. If $AB = ${ab}$ cm and $BC = ${bc}$ cm, find $AC$ in cm.`, v: ab + bc, h: ['The whole is the sum of its parts.', 'Add the two segments.', 'This is one of Euclid\'s common notions.'], s: [{ h: 'Add', d: `$${ab} + ${bc}$` }],
      t: [{ value: Math.abs(ab - bc), why: '$B$ is between $A$ and $C$, so the segments add.' }], c: () => ab + bc };
  }),
  mk('lines-through-points', (rng, d) => {
    const n = ri(rng, 3, 20 * d + 10);
    return { p: `$${n}$ points are marked on a sheet so that no three of them are on one line. How many different straight lines can be drawn, each through exactly two of the points?`, v: (n * (n - 1)) / 2, h: ['Exactly one line passes through two points.', 'Count the pairs of points.', 'Each pair is counted twice if you multiply $n(n-1)$.'], s: [{ h: 'Pairs', d: `$\\dfrac{${n}\\times ${n - 1}}{2}$` }],
      t: [{ value: n * (n - 1), why: 'Each line has been counted twice, once from each of its two points.' }], c: () => { let c = 0; for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) c += 1; return c; } };
  }),
  mk('angles-at-point', (rng, d) => {
    const [a, b, c] = distinct(rng, 40, 120, 3);
    if (a + b + c >= 340) throw RETRY;
    return { p: `Three angles of $${a}^\\circ$, $${b}^\\circ$ and $${c}^\\circ$ and one more angle fill the space around a point. Find the fourth angle in degrees.`, v: 360 - a - b - c, h: ['Angles around a point add up to $360^\\circ$.', 'Add the three known angles.', 'Subtract from $360^\\circ$.'], s: [{ h: 'Subtract', d: `$360 - ${a} - ${b} - ${c}$` }],
      t: [{ value: 180 - (a + b + c), why: 'Angles around a point add to $360^\\circ$, not $180^\\circ$.' }], c: () => 360 - (a + b + c) };
  }),
  mk('linear-pair', (rng, d) => {
    const a = ri(rng, 20, 160);
    if (a === 90) throw RETRY;
    return { p: `Two angles form a linear pair on a straight line. One measures $${a}^\\circ$. Find the other in degrees.`, v: 180 - a, h: ['A linear pair adds to $180^\\circ$.', 'Subtract the known angle.', 'The two angles together make a straight angle.'], s: [{ h: 'Subtract', d: `$180 - ${a}$` }],
      t: [{ value: a, why: 'The two angles of a linear pair are equal only when each is $90^\\circ$.' }], c: () => 180 - a };
  })
];
const GEOM7 = () => [ANGLES().find(f => f.form === 'triangle-sum'), ANGLES().find(f => f.form === 'exterior-angle'), ANGLES().find(f => f.form === 'parallel-lines'), ANGLES().find(f => f.form === 'third-side-count')];

// ── Class 7 and 8 equations, rational properties and Heron's formula ─────────
const LIN7 = () => [
  ALGB().find(f => f.form === 'linear-both-sides'),
  mk('one-step', (rng, d) => {
    const x = ri(rng, 2, 20 * d + 20), a = ri(rng, 2, 50);
    return { p: `Solve $x + ${a} = ${x + a}$.`, v: x, h: ['Do the same to both sides to isolate $x$.', 'Subtract the constant from both sides.', 'Check by substituting back.'], s: [{ h: 'Subtract', d: `$x = ${x + a} - ${a}$` }],
      t: [{ value: x + 2 * a, why: 'To undo adding $' + a + '$, subtract it.' }], c: () => { for (let t = 1; t <= 20 * d + 25; t++) if (t + a === x + a) return t; return NaN; } };
  }),
  mk('two-step', (rng, d) => {
    const x = ri(rng, 2, 15 * d + 10), a = ri(rng, 2, 9), b = ri(rng, 1, 30);
    return { p: `Solve $${a}x + ${b} = ${a * x + b}$.`, v: x, h: ['Subtract the constant first.', 'Then divide by the coefficient of $x$.', 'Check by substituting back.'], s: [{ h: 'Subtract', d: `$${a}x = ${a * x}$` }, { h: 'Divide', d: `$x = ${x}$` }],
      t: [{ value: a * x, why: 'After subtracting the constant, divide by the coefficient of $x$ too.' }], c: () => { for (let t = 1; t <= 15 * d + 12; t++) if (a * t + b === a * x + b) return t; return NaN; } };
  }),
  mk('number-puzzle', (rng, d) => {
    const x = ri(rng, 2, 20 * d + 10), a = ri(rng, 2, 9), b = ri(rng, 1, 20), who = person(rng);
    return { p: `${who} thinks of a number, multiplies it by $${a}$ and adds $${b}$. The result is $${a * x + b}$. What number did ${who} think of?`, v: x, h: ['Write the steps as an equation.', 'Undo the addition, then the multiplication.', 'Check by following the steps with your answer.'], s: [{ h: 'Equation', d: `$${a}x + ${b} = ${a * x + b}$` }],
      t: [{ value: a * x, why: 'Undo both steps: subtract $' + b + '$, then divide by $' + a + '$.' }], c: () => { for (let t = 1; t <= 20 * d + 12; t++) if (t * a + b === a * x + b) return t; return NaN; } };
  })
];
const RATP = () => [
  mk('additive-inverse', (rng, d) => {
    const q = DEN[ri(rng, 0, 6)], p = ri(rng, 1, 3 * q);
    if (gcd(p, q) > 1) throw RETRY;
    return { p: `Find the additive inverse of $\\dfrac{${p}}{${q}}$ as a decimal.`, v: r6(-p / q), h: ['The additive inverse is the number that adds to the given one to give $0$.', 'It has the same size and the opposite sign.', 'Write it as a decimal.'], s: [{ h: 'Negate', d: `$-\\dfrac{${p}}{${q}}$` }],
      t: [{ value: r6(q / p), why: 'That is the reciprocal; the additive inverse changes the sign.' }].filter(t => Number.isFinite(t.value)), c: () => r6(0 - p / q) };
  }),
  mk('reciprocal', (rng, d) => {
    const q = ri(rng, 1, 9), p = [2, 4, 5, 8, 10, 20, 25][ri(rng, 0, 6)] * q;
    if (gcd(p, q) > 1) throw RETRY;
    return { p: `Find the multiplicative inverse (reciprocal) of $\\dfrac{${p}}{${q}}$ as a decimal.`, v: r6(q / p), h: ['The reciprocal is the number that multiplies the given one to give $1$.', 'Flip the numerator and the denominator.', 'Write it as a decimal.'], s: [{ h: 'Flip', d: `$\\dfrac{${q}}{${p}}$` }],
      t: [{ value: r6(-p / q), why: 'That is the additive inverse; the reciprocal flips the fraction.' }], c: () => r6(1 / (p / q)) };
  }),
  mk('distributive', (rng, d) => {
    const q1 = DEN[ri(rng, 0, 6)], q2 = DEN[ri(rng, 0, 6)], q3 = DEN[ri(rng, 0, 6)], a = ri(rng, 1, 3 * q1), b = ri(rng, 1, 3 * q2), c = ri(rng, 1, 3 * q3);
    if (gcd(a, q1) > 1 || gcd(b, q2) > 1 || gcd(c, q3) > 1) throw RETRY;
    const v = (a / q1) * (b / q2 + c / q3);
    if (Math.abs(v * 1e6 - Math.round(v * 1e6)) > 1e-6) throw RETRY;
    return { p: `Use $x(y + z) = xy + xz$ to find $\\dfrac{${a}}{${q1}}\\left(\\dfrac{${b}}{${q2}} + \\dfrac{${c}}{${q3}}\\right)$ as a decimal.`, v: r6(v), h: ['Multiply the first number by each term in the bracket.', 'Add the two products.', 'Write the sum as a decimal.'], s: [{ h: 'Distribute', d: 'multiply each term separately' }],
      t: [{ value: r6((a / q1) * (b / q2) + c / q3), why: 'The multiplier applies to both terms in the bracket.' }].filter(t => Math.abs(t.value - r6(v)) > 1e-9), c: () => r6((a / q1) * (b / q2) + (a / q1) * (c / q3)) };
  })
];
const HERON = () => [
  MENS2().find(f => f.form === 'heron'),
  mk('semi-perimeter', (rng, d) => {
    const t = TRI_H[ri(rng, 0, 5)], k = ri(rng, 1, 3 + d);
    return { p: `The sides of a triangle are $${t[0] * k}$ cm, $${t[1] * k}$ cm and $${t[2] * k}$ cm. Find its semi-perimeter in cm.`, v: ((t[0] + t[1] + t[2]) * k) / 2, h: ['The semi-perimeter is half the perimeter.', 'Add the three sides.', 'Halve.'], s: [{ h: 'Halve', d: 'perimeter divided by $2$' }],
      t: [{ value: (t[0] + t[1] + t[2]) * k, why: 'The semi-perimeter is half the perimeter.' }], c: () => ((t[0] * k) + (t[1] * k) + (t[2] * k)) / 2 };
  }),
  mk('isosceles-height', (rng, d) => {
    const t = [[3, 4, 5], [5, 12, 13], [8, 15, 17], [7, 24, 25]][ri(rng, 0, 3)], k = ri(rng, 1, 4 + d);
    return { p: `An isosceles triangle has two equal sides of $${t[2] * k}$ cm and a base of $${2 * t[0] * k}$ cm. Find its height on the base, in cm.`, v: t[1] * k, h: ['The height from the apex bisects the base.', 'Half the base, the height and an equal side form a right triangle.', 'Use Pythagoras.'], s: [{ h: 'Half base', d: `$${t[0] * k}$` }],
      t: [{ value: t[0] * k, why: 'That is half the base, not the height.' }], c: () => Math.round(Math.sqrt((t[2] * k) ** 2 - (t[0] * k) ** 2)) };
  }),
  mk('area-base-height', (rng, d) => {
    const [b, h] = distinct(rng, 4, 30 * d + 10, 2);
    return { p: `A triangular signboard has a base of $${2 * b}$ cm and a height of $${h}$ cm. Find its area in square centimetres.`, v: b * h, h: ['Area of a triangle is half base times height.', 'Multiply the base and the height.', 'Halve.'], s: [{ h: 'Formula', d: `$\\dfrac12\\times ${2 * b}\\times ${h}$` }],
      t: [{ value: 2 * b * h, why: 'The area of a triangle is half of base times height.' }], c: () => (2 * b * h) / 2 };
  })
];

const F = {
  ints: INTS(), fracs: FRACS(), cmp: CMP(), sqc: SQC(), expo: EXPO(), algb: ALGB(), prop: PROPF(), mens: MENS2(), angles: ANGLES(), polyq: POLYQ(), circ9: CIRC9(), stat7: STAT7(), solid: SOLID(), lcmf: LCMF(), coord9: COORD9(), crypt: CRYPT(), constr: CONSTR(), euclid: EUCLID(), geom7: GEOM7(), lin7: LIN7(), ratp: RATP(), heron: HERON()
};
void [choice, person, fracs];

export const FORMS_789 = F;

export const BAND_789 = {
  'c7-integer-operations-current': F.ints, 'c7-number-play-current': [...F.ints, ...F.lcmf.slice(0, 1)], 'c7-decimal-operations-current': F.fracs, 'c7-fractions-current': F.fracs,
  'c7-letter-numbers-current': F.lin7, 'c7-finding-unknown-current': F.lin7,
  'c7-lcm-reasoning': F.lcmf, 'c7-cryptarithm-reasoning': F.crypt,
  'c7-statistical-question-reasoning': F.stat7,
  'c7-solid-shapes': F.solid.filter(f => !['turns', 'rotation-angle', 'lines-of-symmetry'].includes(f.form)), 'c7-symmetry': F.solid.filter(f => ['lines-of-symmetry', 'turns', 'rotation-angle'].includes(f.form)).concat(F.angles.filter(f => f.form === 'regular-exterior')),
  'c7-triangle-angles': F.geom7, 'c7-triangles-current': F.geom7, 'c7-parallel-intersecting-lines-current': F.geom7, 'c7-triangle-inequality-reasoning': F.geom7,
  'c7-angle-construction-reasoning': F.constr, 'c7-congruence-inference-reasoning': F.constr, 'c7-geometric-twins-current': F.constr, 'c7-sss-sas-reasoning': F.constr,
  'c7-perpendicular-bisector-reasoning': F.constr, 'c7-constructions-tilings-current': F.constr, 'c7-connecting-dots-current': F.constr, 'c7-common-ground-current': F.constr,
  'c8-comparing-quantities-ncert-mastery': F.cmp,
  'c8-cubes-roots': F.sqc, 'c8-cubes-roots-ncert-mastery': F.sqc, 'c8-squares-roots': F.sqc, 'c8-squares-roots-ncert-mastery': F.sqc, 'c8-cube-pattern-reasoning': F.sqc, 'c8-cube-multiplier-reasoning': F.sqc, 'c8-square-pattern-reasoning': F.sqc,
  'c8-rational-numbers': F.fracs, 'c8-rational-numbers-foundations': F.fracs, 'c8-rational-numbers-between': F.fracs, 'c8-rational-numbers-identities': [...F.ratp, ...F.fracs.slice(0, 2)], 'c8-rational-numbers-closure': [...F.ratp, ...F.fracs.slice(0, 2)], 'c8-rational-numbers-commutativity': [...F.ratp, ...F.fracs.slice(0, 2)],
  'c8-exponents-ncert-mastery': F.expo,
  'c8-algebraic-identities-ncert-mastery': F.algb, 'c8-identity-factorisation-reasoning': F.algb, 'c8-factorisation-ncert-mastery': F.algb, 'c8-linear-equations-foundations': F.lin7,
  'c8-proportions-ncert-mastery': F.prop, 'c8-proportions-dir-inv': F.prop,
  'c8-mensuration-ncert-mastery': F.mens, 'c9-perimeter-area-ncert-mastery': F.mens, 'c9-herons-formula': F.heron,
  'c8-quadrilaterals-ncert-mastery': F.polyq, 'c9-quadrilaterals': F.polyq, 'c9-euclid-geometry': F.euclid, 'c9-triangles': F.geom7,
  'c9-circles': F.circ9, 'c9-circles-ncert-mastery': F.circ9,
  'c9-coordinate-geometry': F.coord9.filter(f => f.form !== 'midpoint')
};
