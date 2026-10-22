// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · NCERT Class 11 Binomial Theorem — JEE D4 forms, one per dot
// point (issue #408)
//
// The JEE Main and JEE Advanced tracks reached this chapter's hardest level
// (D4) for all three dot points through the whole-chapter generator, whose D4
// rung is one routine template: the term independent of x in
// (x^a + c/x^b)^n. That rung is retired here; each form below replaces it at
// one dot point. A single formula with bigger numbers is a D3 question, so
// every archetype joins two separate ideas:
//
//   0 · Expansion (c11-binomial-expansion-jee-reasoning)
//       integer-part     — (a + √b)ⁿ + (a − √b)ⁿ is an integer because the odd
//                          powers of √b cancel in pairs, AND 0 < a − √b < 1
//                          bounds the conjugate, which fixes the greatest
//                          (or least) integer next to (a + √b)ⁿ.
//       product-coefficient — the coefficient of xᵏ in (1 + αx)ᵐ(1 − αx)ⁿ:
//                          regroup into (1 − α²x²)^p times a leftover binomial,
//                          THEN add over every split of k between the two.
//       parity-sum       — n recovered from the sum of all coefficients
//                          (x = 1), THEN the even- or odd-power sum separated
//                          by x = −1.
//   1 · General term (c11-binomial-general-term-jee-reasoning)
//       consecutive-ratio — n and r recovered from the ratio of three
//                          consecutive coefficients (two simultaneous
//                          equations), THEN the middle coefficient evaluated.
//       two-case         — the coefficient of xᵏ in (p + q·xᵗ)(xᵃ + c/xᵇ)ⁿ:
//                          the power condition on the general term, solved
//                          twice (once per term of the first factor), and the
//                          two contributions added.
//       rational-terms   — the number of rational (or irrational) terms of
//                          (p^{1/a} + q^{1/b})ⁿ: rationality of the general term
//                          becomes two divisibility conditions on r, THEN the
//                          solutions are counted as an arithmetic progression.
//   2 · Middle term / independent term (c11-binomial-middle-term-jee-reasoning)
//       least-n          — the least n (or the least n above a bound) for which
//                          (αxᵃ + c/xᵇ)ⁿ has a term independent of x, from a
//                          divisibility condition with gcd(a, b) cancelled,
//                          THEN that term.
//       parameter-then-coefficient — k found from the value of the term
//                          independent of x (a sign argument when the power
//                          of k is odd), THEN reused for another coefficient.
//       middle-from-sum  — n found from the sum of all coefficients, THEN the
//                          parity of n decides whether there is one middle
//                          term or two.
//
// Scope is the NCERT Class 11 chapter as JEE Main 2026 and JEE Advanced 2026
// examine it: positive integral indices only, the general term, the middle
// term(s), the sum of coefficients by substitution. Nothing beyond it.
//
// Provenance. These are original, parameterised forms written for Pri
// Learning, not transcribed from NCERT exercises, the exemplar or past papers.
// Every keyed answer is computed from the drawn parameters, never typed, and
// client/test/support/india-jee-d4-binomial-solvers.mjs re-derives each one
// from the rendered prompt by a second route (exact BigInt expansion,
// enumeration). Human maths review is pending; no board or examiner approval is
// claimed.
//
// Asked for any rung other than D4, each generator returns its D4 form.
// ─────────────────────────────────────────────────────────────────────────────
import { ri, rc, nz, gcd, makeRng } from '../qhelpers.js';
import { traps } from './india-native-helpers.js';

const FALLBACK_SEED = 0x42494e4f;   // "BINO"

// ── Arithmetic ───────────────────────────────────────────────────────────────
function nCr(n, r) {
  if (r < 0 || r > n) return 0;
  r = Math.min(r, n - r);
  let out = 1;
  for (let i = 1; i <= r; i++) out = (out * (n - r + i)) / i;
  return Math.round(out);
}
const lcm = (a, b) => (a / gcd(a, b)) * b;
const mod = (a, m) => ((a % m) + m) % m;

// ── Formatting ───────────────────────────────────────────────────────────────
/** x, x^{3}: a positive power of x as it is written. */
const pw = (p, v = 'x') => (p === 1 ? v : `${v}^{${p}}`);
/** x^{3}, x, 1, x^{-2}: any integer power of x. */
const xPow = p => (p === 0 ? '1' : p === 1 ? 'x' : `x^{${p}}`);
/** Brackets a negative number: 6 stays 6, −4 becomes (−4). */
const par = v => (v < 0 ? `(${v})` : String(v));
/** αxᵃ written as read: x^{2}, 3x^{2}. */
const lead = (alpha, a) => `${alpha === 1 ? '' : alpha}${pw(a)}`;
/** " + \dfrac{c}{x^b}" / " - \dfrac{|c|}{x^b}". */
const recip = (c, b) => ` ${c < 0 ? '-' : '+'} \\dfrac{${Math.abs(c)}}{${pw(b)}}`;
/** \left(αxᵃ ± \dfrac{|c|}{xᵇ}\right)^{n} */
const bracket = (alpha, a, c, b, n) => `\\left(${lead(alpha, a)}${recip(c, b)}\\right)^{${n}}`;
/** ax + b with a > 0. */
const linX = (a, b) => `${a === 1 ? '' : a}x ${b < 0 ? '-' : '+'} ${Math.abs(b)}`;
/** \sqrt{p}, \sqrt[3]{p}. */
const root = (p, a) => (a === 2 ? `\\sqrt{${p}}` : `\\sqrt[${a}]{${p}}`);
/** c^{r} as a factor: nothing for c = 1, (−2)^{r} for a negative c. */
const cPow = (c, r) => (c === 1 ? '' : `${par(c)}^{${r}}`);
/** A list of numbers joined by +, with negatives written as "- 5". */
function sumTex(values) {
  let out = '';
  values.forEach((v, i) => {
    if (i === 0) out = String(v);
    else out += ` ${v < 0 ? '-' : '+'} ${Math.abs(v)}`;
  });
  return out || '0';
}

// ═════════════════════════════════════════════════════════════════════════════
// 0 · Expand a binomial using the binomial theorem
// ═════════════════════════════════════════════════════════════════════════════

/** (a, b) with b not a square and a − 1 < √b < a, so 0 < a − √b < 1. */
const SURD_PAIRS = Object.freeze((() => {
  const out = [];
  for (let a = 2; a <= 6; a++) for (let b = (a - 1) ** 2 + 1; b < a * a; b++) out.push(Object.freeze({ a, b }));
  return out;
})());

/** (a + √b)ⁿ + (a − √b)ⁿ as 2 × the sum of the even-index terms. */
function conjugateSum(a, b, n) {
  const terms = [];
  for (let j = 0; 2 * j <= n; j++) terms.push(nCr(n, 2 * j) * a ** (n - 2 * j) * b ** j);
  return { terms, total: 2 * terms.reduce((s, t) => s + t, 0) };
}

function expansionReasoning(rng) {
  const kind = rc(rng, ['integer-part', 'product-coefficient', 'parity-sum']);
  for (let guard = 0; guard < 400; guard++) {
    if (kind === 'integer-part') {
      const { a, b } = rc(rng, SURD_PAIRS);
      const n = ri(rng, 3, 10);
      const { terms, total: I } = conjugateSum(a, b, n);
      if (I > 100000) continue;
      const floor = rng() < 0.6;
      const value = floor ? I - 1 : I;
      const u = `${a} + \\sqrt{${b}}`, v = `${a} - \\sqrt{${b}}`;
      return {
        prompt: floor
          ? `Find the greatest integer less than or equal to $\\left(${u}\\right)^{${n}}$.`
          : `Find the least integer greater than or equal to $\\left(${u}\\right)^{${n}}$.`,
        answerType: 'numeric', answer: { value },
        traps: traps(value, [
          floor
            ? { value: I, why: `That is $\\left(${u}\\right)^{${n}} + \\left(${v}\\right)^{${n}}$. The second power is positive, so $\\left(${u}\\right)^{${n}}$ is strictly less than that integer.` }
            : { value: I - 1, why: `That is the greatest integer below $\\left(${u}\\right)^{${n}}$; the question asks for the least integer at or above it.` },
          { value: I / 2, why: `That is only the rational part of $\\left(${u}\\right)^{${n}}$; the terms with odd powers of $\\sqrt{${b}}$ add much more than a fraction.` },
          ...(floor ? [] : [{ value: I + 1, why: `$\\left(${v}\\right)^{${n}}$ lies strictly between $0$ and $1$, so $\\left(${u}\\right)^{${n}}$ is within $1$ of the integer sum, not more.` }])
        ]),
        hints: [
          'Pair the power with the same power of the conjugate surd: in the sum of the two expansions the terms with odd powers of the root cancel, so the sum is an integer.',
          'Decide where the conjugate lies: compare the square root with the whole numbers on either side of it.',
          'If the conjugate is strictly between $0$ and $1$, so is any positive power of it. Your power is then that integer minus a positive proper fraction.'
        ],
        steps: [
          { h: 'Pair with the conjugate', d: `In $\\left(${u}\\right)^{${n}} + \\left(${v}\\right)^{${n}}$ the terms with odd powers of $\\sqrt{${b}}$ cancel, leaving twice the terms $\\binom{${n}}{2j}${a}^{${n}-2j}\\,${b}^{j}$` },
          { h: 'Evaluate the integer', d: `$2(${terms.join(' + ')}) = ${I}$` },
          { h: 'Bound the conjugate', d: `$${a - 1}^2 < ${b} < ${a}^2$, so $${a - 1} < \\sqrt{${b}} < ${a}$ and $0 < ${v} < 1$; hence $0 < \\left(${v}\\right)^{${n}} < 1$` },
          { h: 'Locate the power', d: `$\\left(${u}\\right)^{${n}} = ${I} - \\left(${v}\\right)^{${n}}$ lies strictly between $${I - 1}$ and $${I}$` },
          { h: 'Answer', d: `$${value}$` }
        ],
        reasoning: 'integer-part'
      };
    }
    if (kind === 'product-coefficient') {
      const alpha = rc(rng, [1, 1, 2, 3]);
      const m = ri(rng, 4, 14), n = ri(rng, 4, 14);
      if (m === n) continue;
      const k = ri(rng, 3, Math.min(10, m + n - 3));
      const p = Math.min(m, n), q = Math.abs(m - n), sgn = m > n ? 1 : -1;   // leftover (1 + sgn·αx)^q
      const parts = [];
      for (let j = 0; j <= p && 2 * j <= k; j++) {
        const s = k - 2 * j;
        if (s > q) continue;
        parts.push({ j, s, val: nCr(p, j) * (-1) ** j * nCr(q, s) * sgn ** s });
      }
      const base = parts.reduce((t, x) => t + x.val, 0);
      const value = base * alpha ** k;
      if (value === 0 || Math.abs(value) > 100000 || Math.abs(value) < 10 || parts.length < 2) continue;
      const ax = alpha === 1 ? 'x' : `${alpha}x`;
      const sum = nCr(m, k) * alpha ** k + nCr(n, k) * (-alpha) ** k;
      const allPlus = nCr(m + n, k) * alpha ** k;
      const left = `(1 ${sgn > 0 ? '+' : '-'} ${ax})^{${q}}`;
      return {
        prompt: `Find the coefficient of $${pw(k)}$ in the expansion of $(1 + ${ax})^{${m}}(1 - ${ax})^{${n}}$.`,
        answerType: 'numeric', answer: { value },
        traps: traps(value, [
          { value: allPlus, why: `That is the coefficient in $(1 + ${ax})^{${m + n}}$: the minus sign in the second factor changes the sign of every odd-power term there.` },
          { value: sum, why: `That adds the coefficients of $${pw(k)}$ in the two factors; a product needs every pair of terms whose powers add up to $${k}$.` },
          ...(alpha === 1 ? [] : [{ value: base, why: `That leaves out the factor $${alpha}^{${k}}$ carried by $${pw(k)}$ when $x$ is replaced by $${ax}$.` }])
        ]),
        hints: [
          'Multiply matching factors first: $(1 + t)(1 - t) = 1 - t^2$. Pair as many factors as there are in the smaller power.',
          'What is left is a power of $1 - t^2$ (only even powers) times one leftover binomial power.',
          'Write the power asked for as an even part plus a part from the leftover binomial, list every such split, and add the products with their signs.'
        ],
        steps: [
          { h: 'Regroup', d: `$(1 + ${ax})^{${m}}(1 - ${ax})^{${n}} = (1 - ${alpha === 1 ? '' : alpha * alpha}x^2)^{${p}}${q === 1 ? `(1 ${sgn > 0 ? '+' : '-'} ${ax})` : left}$` },
          { h: 'General terms', d: `$(1 - ${alpha === 1 ? '' : alpha * alpha}x^2)^{${p}}$ gives $\\binom{${p}}{j}(-1)^j${alpha === 1 ? '' : `\\,${alpha * alpha}^j`}x^{2j}$ and the other factor gives $\\binom{${q}}{s}${sgn > 0 ? '' : '(-1)^s'}${alpha === 1 ? '' : `\\,${alpha}^s`}x^{s}$` },
          { h: 'Splits of the power', d: `$2j + s = ${k}$: ${parts.map(x => `$(j, s) = (${x.j}, ${x.s})$`).join(', ')}` },
          { h: 'Add', d: `${alpha === 1 ? '' : `$${alpha}^{${k}}$ times `}$${sumTex(parts.map(x => x.val))} = ${base}$${alpha === 1 ? '' : `, so the coefficient is $${alpha ** k} \\times ${par(base)} = ${value}$`}` },
          { h: 'Answer', d: `$${value}$` }
        ],
        reasoning: 'product-coefficient'
      };
    }
    // parity-sum: (ax + b)^n with a known sum of coefficients.
    const a = ri(rng, 1, 4), b = nz(rng, -3, 5);
    if (a + b < 2 || b === a) continue;
    const n = ri(rng, 4, 10);
    const S = (a + b) ** n, D = (b - a) ** n;
    if (S > 2000000) continue;
    const even = rng() < 0.5;
    const value = even ? (S + D) / 2 : (S - D) / 2;
    if (value === 0 || Math.abs(value) > 100000 || Math.abs(value) < 10) continue;
    const other = even ? (S - D) / 2 : (S + D) / 2;
    const flipped = even ? (S + (a - b) ** n) / 2 : (S - (a - b) ** n) / 2;
    return {
      prompt: `In the expansion of $(${linX(a, b)})^{n}$ in powers of $x$, the sum of all the coefficients is $${S}$. Find the sum of the coefficients of the ${even ? 'even powers of $x$ (the constant term included)' : 'odd powers of $x$'}.`,
      answerType: 'numeric', answer: { value },
      traps: traps(value, [
        { value: S / 2, why: 'Halving the total assumes the even and odd parts are equal; the value at $x = -1$ says how they differ.' },
        { value: other, why: `That is the sum for the ${even ? 'odd' : 'even'} powers of $x$.` },
        ...(n % 2 === 1 ? [{ value: flipped, why: `At $x = -1$ the binomial is $${par(b - a)}$, not $${par(a - b)}$; with $n$ odd the sign matters.` }] : [])
      ]),
      hints: [
        'Putting $x = 1$ in the expansion adds up all its coefficients; that fixes $n$.',
        'Putting $x = -1$ keeps the coefficients of the even powers and reverses the sign of the odd ones.',
        'Add or subtract the two values and halve.'
      ],
      steps: [
        { h: 'Find n', d: `At $x = 1$: $${a + b}^{n} = ${S}$, so $n = ${n}$` },
        { h: 'Put x = −1', d: `$(${-a} ${b < 0 ? '-' : '+'} ${Math.abs(b)})^{${n}} = ${par(b - a)}^{${n}} = ${D}$` },
        { h: 'Separate', d: even ? `Even powers: $\\dfrac{${S} + ${par(D)}}{2}$` : `Odd powers: $\\dfrac{${S} - ${par(D)}}{2}$` },
        { h: 'Answer', d: `$${value}$` }
      ],
      reasoning: even ? 'parity-sum-even' : 'parity-sum-odd'
    };
  }
  return expansionReasoning(makeRng(FALLBACK_SEED));
}

// ═════════════════════════════════════════════════════════════════════════════
// 1 · Find a general term and a specified term of an expansion
// ═════════════════════════════════════════════════════════════════════════════

const PRIMES = [2, 3, 5, 7, 11];

function generalTermReasoning(rng) {
  const kind = rc(rng, ['consecutive-ratio', 'two-case', 'rational-terms']);
  for (let guard = 0; guard < 400; guard++) {
    if (kind === 'consecutive-ratio') {
      const n = ri(rng, 7, 18), r = ri(rng, 2, n - 2);
      const c0 = nCr(n, r - 1), c1 = nCr(n, r), c2 = nCr(n, r + 1);
      const g = gcd(gcd(c0, c1), c2);
      const [p, q, s] = [c0 / g, c1 / g, c2 / g];
      if (c1 > 100000 || Math.max(p, q, s) > 400 || p === q || q === s) continue;
      const value = c1;
      return {
        prompt: `Three consecutive coefficients in the expansion of $(1 + x)^{n}$ are in the ratio $${p} : ${q} : ${s}$, in that order. Find the middle one of these three coefficients.`,
        answerType: 'numeric', answer: { value },
        traps: traps(value, [
          { value: n, why: 'That is the index $n$; the question asks for the middle coefficient itself.' },
          { value: c0, why: 'That is the first of the three coefficients, not the middle one.' },
          { value: c2, why: 'That is the last of the three coefficients, not the middle one.' }
        ]),
        hints: [
          'Call the three coefficients $\\binom{n}{r-1}$, $\\binom{n}{r}$ and $\\binom{n}{r+1}$.',
          'The ratio of neighbouring coefficients is simple: $\\binom{n}{r} \\div \\binom{n}{r-1} = \\dfrac{n - r + 1}{r}$, and similarly for the next pair.',
          'The two ratios give two linear equations in $n$ and $r$; solve them together, then evaluate the middle coefficient.'
        ],
        steps: [
          { h: 'Neighbour ratios', d: '$\\dfrac{\\binom{n}{r}}{\\binom{n}{r-1}} = \\dfrac{n - r + 1}{r}$ and $\\dfrac{\\binom{n}{r+1}}{\\binom{n}{r}} = \\dfrac{n - r}{r + 1}$' },
          { h: 'Two equations', d: `$\\dfrac{n - r + 1}{r} = \\dfrac{${q}}{${p}}$ and $\\dfrac{n - r}{r + 1} = \\dfrac{${s}}{${q}}$, that is $${p}n - ${p + q}r = -${p}$ and $${q}n - ${q + s}r = ${s}$` },
          { h: 'Solve', d: `$n = ${n}$ and $r = ${r}$: the coefficients are $\\binom{${n}}{${r - 1}}$, $\\binom{${n}}{${r}}$, $\\binom{${n}}{${r + 1}}$` },
          { h: 'Check', d: `$${c0} : ${c1} : ${c2} = ${p} : ${q} : ${s}$` },
          { h: 'Answer', d: `$\\binom{${n}}{${r}} = ${value}$` }
        ],
        reasoning: 'consecutive-ratio'
      };
    }
    if (kind === 'two-case') {
      const a = ri(rng, 1, 3), b = ri(rng, 1, 3), c = rc(rng, [-2, -1, 1, 2]);
      const n = ri(rng, 5, 10);
      const step = rc(rng, [1, 1, 2]);
      const t = step * (a + b);
      const p = ri(rng, 1, 4), q = nz(rng, -4, 4);
      const r1 = ri(rng, 0, n - step), r2 = r1 + step;
      const e = r => a * n - (a + b) * r;
      const k = e(r1);
      if (k === 0 || e(r2) !== k - t) continue;
      const A = nCr(n, r1) * c ** r1, B = nCr(n, r2) * c ** r2;
      const value = p * A + q * B;
      if (value === 0 || Math.abs(value) > 100000 || Math.abs(value) < 10) continue;
      const first = `${p} ${q < 0 ? '-' : '+'} ${Math.abs(q) === 1 ? '' : Math.abs(q)}${pw(t)}`;
      const qTex = q === 1 ? '' : q === -1 ? '-' : String(q);
      return {
        prompt: `Find the coefficient of $${xPow(k)}$ in the expansion of $(${first})${bracket(1, a, c, b, n)}$.`,
        answerType: 'numeric', answer: { value },
        traps: traps(value, [
          { value: p * A, why: `That counts only the products with the constant $${p}$; the term $${qTex}${pw(t)}$ also meets a term of the expansion to make $${xPow(k)}$.` },
          { value: q * B, why: `That counts only the products with $${qTex}${pw(t)}$; the constant $${p}$ also meets a term of the expansion with exactly $${xPow(k)}$.` },
          { value: A + B, why: 'That adds the two coefficients from the expansion without multiplying each by its partner in the first factor.' }
        ]),
        hints: [
          'Write the general term of the bracketed power and collect its power of $x$ as a single expression in $r$.',
          'Each term of the first factor needs its own partner: the constant needs the power asked for, the other term needs that power lowered by its own exponent.',
          'Solve for $r$ in each case, keep only whole-number values in range, and add the two contributions with their multipliers.'
        ],
        steps: [
          { h: 'General term', d: `$T_{r+1} = \\binom{${n}}{r}${a === 1 ? `x^{${n} - r}` : `\\left(${pw(a)}\\right)^{${n} - r}`}\\left(\\dfrac{${c}}{${pw(b)}}\\right)^{r} = \\binom{${n}}{r}${cPow(c, 'r')}x^{${a * n} - ${a + b}r}$` },
          { h: `With the constant ${p}`, d: `$${a * n} - ${a + b}r = ${k}$ gives $r = ${r1}$; coefficient $\\binom{${n}}{${r1}}${cPow(c, r1)} = ${A}$` },
          { h: `With $${qTex}${pw(t)}$`, d: `$${a * n} - ${a + b}r = ${k - t}$ gives $r = ${r2}$; coefficient $\\binom{${n}}{${r2}}${cPow(c, r2)} = ${B}$` },
          { h: 'Add', d: `$${p}(${A}) ${q < 0 ? '-' : '+'} ${Math.abs(q)}(${B}) = ${value}$` },
          { h: 'Answer', d: `$${value}$` }
        ],
        reasoning: 'two-case'
      };
    }
    // rational-terms: (p^{1/a} + q^{1/b})^n, p ≠ q primes.
    const P = rc(rng, PRIMES), Q = rc(rng, PRIMES.filter(x => x !== P));
    const a = ri(rng, 2, 6), b = ri(rng, 2, 6);
    const L = lcm(a, b);
    const n = ri(rng, 20, 150);
    if (n % gcd(a, b) !== 0) continue;
    // r ≡ 0 (mod b), r ≡ n (mod a): the first such r, then every L.
    let r0 = -1;
    for (let r = 0; r < L; r++) if (r % b === 0 && mod(n - r, a) === 0) { r0 = r; break; }
    if (r0 < 0 || r0 > n) continue;
    const rational = Math.floor((n - r0) / L) + 1;
    if (rational < 2) continue;
    const askRational = rng() < 0.5;
    const value = askRational ? rational : n + 1 - rational;
    const naive = Math.floor(n / L) + 1;
    // The two conditions must really be two: equal root orders, or n a multiple
    // of the first order, would let "a | r" stand in for "a | n − r".
    if (a === b || naive === rational) continue;
    const rs = []; for (let r = r0; r <= n; r += L) rs.push(r);
    const shown = rs.length <= 8 ? rs.join(', ') : `${rs.slice(0, 3).join(', ')}, \\ldots, ${rs[rs.length - 1]}`;
    return {
      prompt: `How many terms of the expansion of $\\left(${root(P, a)} + ${root(Q, b)}\\right)^{${n}}$ are ${askRational ? 'rational' : 'irrational'} numbers?`,
      answerType: 'numeric', answer: { value },
      traps: traps(value, askRational ? [
        { value: naive, why: `That counts the $r$ that are multiples of both $${a}$ and $${b}$; the power of $${root(P, a)}$ is $${n} - r$, so it is $${n} - r$ that $${a}$ must divide.` },
        { value: n + 1 - rational, why: 'That is the number of irrational terms.' },
        { value: rational - 1, why: `Both ends count: $r$ runs from $0$ to $${n}$ inclusive, and every admissible $r$ in that range gives a rational term.` }
      ] : [
        { value: rational, why: 'That is the number of rational terms.' },
        { value: n - rational, why: `The expansion has $${n + 1}$ terms, not $${n}$.` },
        { value: n + 1 - naive, why: `That uses the $r$ that are multiples of both $${a}$ and $${b}$; the power of $${root(P, a)}$ is $${n} - r$, so it is $${n} - r$ that $${a}$ must divide.` }
      ]),
      hints: [
        'Write the general term with fractional powers of each prime.',
        'Because the two bases are different primes, the term is rational exactly when both fractional powers are whole numbers: two divisibility conditions on $r$.',
        'The admissible values of $r$ form an arithmetic progression whose common difference is the LCM of the two root orders; count its terms between $0$ and $n$.'
      ],
      steps: [
        { h: 'General term', d: `$T_{r+1} = \\binom{${n}}{r}\\,${P}^{\\frac{${n} - r}{${a}}}\\,${Q}^{\\frac{r}{${b}}}$, $0 \\le r \\le ${n}$` },
        { h: 'Rational when', d: `$${a} \\mid ${n} - r$ and $${b} \\mid r$ (the bases are distinct primes)` },
        { h: 'Admissible r', d: `The least is $r = ${r0}$ and they go up in steps of $\\operatorname{lcm}(${a}, ${b}) = ${L}$: $r = ${shown}$` },
        { h: 'Count', d: `$\\left\\lfloor \\dfrac{${n} - ${r0}}{${L}} \\right\\rfloor + 1 = ${rational}$ rational term${rational === 1 ? '' : 's'}${askRational ? '' : `, so $${n + 1} - ${rational} = ${value}$ irrational`}` },
        { h: 'Answer', d: `$${value}$` }
      ],
      reasoning: askRational ? 'rational-terms' : 'irrational-terms'
    };
  }
  return generalTermReasoning(makeRng(FALLBACK_SEED));
}

// ═════════════════════════════════════════════════════════════════════════════
// 2 · Find the middle term and the term independent of x
// ═════════════════════════════════════════════════════════════════════════════

function middleTermReasoning(rng) {
  const kind = rc(rng, ['least-n', 'parameter-then-coefficient', 'middle-from-sum']);
  for (let guard = 0; guard < 400; guard++) {
    if (kind === 'least-n') {
      const a = ri(rng, 1, 6), b = ri(rng, 1, 6);
      const g = gcd(a, b), ar = a / g, br = b / g, n0 = ar + br;
      const alpha = rc(rng, [1, 1, 2, 3]), c = rc(rng, [-3, -2, -1, 1, 2, 3]);
      const above = rng() < 0.4;
      // Without the bound, the gcd must matter: n = a + b would otherwise be the whole story.
      if (!above && g === 1) continue;
      const N0 = above ? ri(rng, n0 + 1, 13) : 0;
      if (above && N0 <= n0) continue;
      const n = above ? n0 * (Math.floor(N0 / n0) + 1) : n0;
      const r = (ar * n) / n0;
      const value = nCr(n, r) * alpha ** (n - r) * c ** r;
      if (Math.abs(value) > 100000 || Math.abs(value) < 10 || n > 16) continue;
      const wrongN = above ? (a + b) * (Math.floor(N0 / (a + b)) + 1) : a + b;
      const wrongR = (a * wrongN) / (a + b);
      const wrongVal = nCr(wrongN, wrongR) * alpha ** (wrongN - wrongR) * c ** wrongR;
      const expr = bracket(alpha, a, c, b, 'n');
      return {
        prompt: above
          ? `Let $n$ be the least integer greater than $${N0}$ for which the expansion of $${expr}$ has a term independent of $x$. Find that term.`
          : `Let $n$ be the least positive integer for which the expansion of $${expr}$ has a term independent of $x$. Find that term.`,
        answerType: 'numeric', answer: { value },
        traps: traps(value, [
          ...(g > 1 ? [{ value: wrongVal, why: `That takes $${a + b}$ as the step for $n$; $\\gcd(${a}, ${b}) = ${g}$ cancels, so $n$ need only be a multiple of $${n0}$.` }] : []),
          { value: nCr(n, r), why: 'That is the binomial coefficient alone; the powers of the constants in both terms belong to the term as well.' },
          { value: n, why: 'That is the least $n$; the question asks for the term itself.' }
        ]),
        hints: [
          'Write the general term and collect its power of $x$; independence of $x$ means that power is zero.',
          'That equation gives $r$ as a fraction times $n$. Cancel the common factor of the two exponents first: $r$ is a whole number exactly when the reduced denominator divides $n$.',
          'Take the least admissible $n$ allowed by the question, find $r$, and evaluate the whole term, constants and signs included.'
        ],
        steps: [
          { h: 'General term', d: `$T_{r+1} = \\binom{n}{r}${alpha === 1 ? '' : `${alpha}^{n-r}`}${cPow(c, 'r')}x^{${a === 1 ? 'n - r' : `${a}(n - r)`} - ${b === 1 ? '' : b}r}$` },
          { h: 'Power zero', d: `$${a === 1 ? 'n - r' : `${a}(n - r)`} = ${b === 1 ? '' : b}r \\Rightarrow r = \\dfrac{${a === 1 ? '' : a}n}{${a + b}}${g > 1 ? ` = \\dfrac{${ar === 1 ? '' : ar}n}{${n0}}` : ''}$, and since $\\gcd(${ar}, ${n0}) = 1$, $${n0} \\mid n$` },
          { h: 'Least n', d: above ? `The least multiple of $${n0}$ greater than $${N0}$ is $n = ${n}$, so $r = ${r}$` : `$n = ${n}$, so $r = ${r}$` },
          { h: 'The term', d: `$\\binom{${n}}{${r}}${alpha === 1 ? '' : ` \\cdot ${alpha}^{${n - r}}`}${c === 1 ? '' : ` \\cdot ${par(c)}^{${r}}`} = ${value}$` },
          { h: 'Answer', d: `$${value}$` }
        ],
        reasoning: above ? 'least-n-above' : 'least-n'
      };
    }
    if (kind === 'parameter-then-coefficient') {
      const a = ri(rng, 1, 3), b = ri(rng, 1, 3);
      if (a === b && rng() < 0.6) continue;
      const n = ri(rng, 4, 12);
      if ((a * n) % (a + b) !== 0) continue;
      const r = (a * n) / (a + b);
      if (r < 1 || r > n - 1) continue;
      const k = rc(rng, [-3, -2, 2, 3]);
      if (r % 2 === 0 && k < 0) continue;     // r even: k > 0 is stated, so k is positive
      const V = nCr(n, r) * k ** r;
      if (Math.abs(V) > 1000000) continue;
      const s = ri(rng, 0, n);
      if (s === r) continue;
      const e = a * n - (a + b) * s;
      const value = nCr(n, s) * k ** s;
      if (Math.abs(value) > 100000 || Math.abs(value) < 10) continue;
      const kTex = r % 2 === 0 ? 'k > 0' : 'k \\text{ real}';
      const expr = `\\left(${pw(a)} + \\dfrac{k}{${pw(b)}}\\right)^{${n}}`;
      return {
        prompt: `The term independent of $x$ in the expansion of $${expr}$, where ${r % 2 === 0 ? '$k$ is a positive real number' : '$k$ is a real number'}, is $${V}$. Find the coefficient of $${xPow(e)}$ in the same expansion.`,
        answerType: 'numeric', answer: { value },
        traps: traps(value, [
          { value: nCr(n, s), why: `That is the binomial coefficient alone; the term also carries $k^{${s}}$.` },
          ...(s % 2 === 1 && r % 2 === 1 ? [{ value: -value, why: `That takes $k$ with the wrong sign: the independent term carries an odd power of $k$, so its sign is the sign of $k$.` }] : []),
          ...(s !== n - s ? [{ value: nCr(n, n - s) * k ** (n - s), why: `That puts the power on the wrong factor: in $T_{r+1}$, $r$ counts the factors $\\dfrac{k}{${pw(b)}}$, not the factors $${pw(a)}$.` }] : [])
        ]),
        hints: [
          'Write the general term and set its power of $x$ to zero to find which term is independent of $x$.',
          `Equate that term to the given value and solve for $k$; a power equation needs care with the sign ($${kTex}$).`,
          'With $k$ known, set the power of $x$ in the general term equal to the power asked for, find that $r$, and evaluate.'
        ],
        steps: [
          { h: 'General term', d: `$T_{r+1} = \\binom{${n}}{r}k^{r}x^{${a * n} - ${a + b}r}$` },
          { h: 'Independent term', d: `$${a * n} - ${a + b}r = 0 \\Rightarrow r = ${r}$, so $\\binom{${n}}{${r}}k^{${r}} = ${V}$` },
          { h: 'Find k', d: `$k^{${r}} = \\dfrac{${V}}{${nCr(n, r)}} = ${k ** r}$, so $k = ${k}$${r % 2 === 0 ? ' (positive)' : ' (an odd power keeps the sign)'}` },
          { h: 'Target power', d: `$${a * n} - ${a + b}r = ${e}$ gives $r = ${s}$` },
          { h: 'Coefficient', d: `$\\binom{${n}}{${s}}${par(k)}^{${s}} = ${nCr(n, s)} \\times ${par(k ** s)} = ${value}$` }
        ],
        reasoning: 'parameter-then-coefficient'
      };
    }
    // middle-from-sum: (x^a + c/x^b)^n with the sum of the coefficients given.
    const a = ri(rng, 1, 3), b = ri(rng, 1, 3), c = rc(rng, [2, 3, 4, -3]);
    const n = ri(rng, 5, 12);
    const S = (1 + c) ** n;
    if (Math.abs(S) > 2000000) continue;
    const coef = r => nCr(n, r) * c ** r;
    const odd = n % 2 === 1, m = Math.floor(n / 2);
    const value = odd ? coef(m) + coef(m + 1) : coef(m);
    if (value === 0 || Math.abs(value) > 100000 || Math.abs(value) < 10) continue;
    return {
      prompt: `The sum of all the coefficients in the expansion of $${bracket(1, a, c, b, 'n')}$ is $${S}$. Find the coefficient of its middle term; if the expansion has two middle terms, give the sum of their coefficients.`,
      answerType: 'numeric', answer: { value },
      traps: traps(value, odd ? [
        { value: coef(m), why: `With $n$ odd there are two middle terms, $T_{${m + 1}}$ and $T_{${m + 2}}$; that is the coefficient of only the first.` },
        { value: coef(m + 1), why: `With $n$ odd there are two middle terms, $T_{${m + 1}}$ and $T_{${m + 2}}$; that is the coefficient of only the second.` },
        { value: 2 * nCr(n, m), why: 'That adds the binomial coefficients alone; each term also carries a power of the constant in the second term.' }
      ] : [
        { value: coef(m + 1), why: `That is $T_{${m + 2}}$; with $${n + 1}$ terms the middle one is $T_{${m + 1}}$.` },
        { value: coef(m - 1), why: `That is $T_{${m}}$; with $${n + 1}$ terms the middle one is $T_{${m + 1}}$.` },
        { value: nCr(n, m), why: 'That is the binomial coefficient alone; the term also carries a power of the constant in the second term.' }
      ]),
      hints: [
        'Putting $x = 1$ adds up every coefficient of the expansion; that equation fixes $n$.',
        'An expansion of power $n$ has $n + 1$ terms: one middle term when $n$ is even, two when $n$ is odd.',
        'Write the general term, read off the coefficient at the middle position or positions, and include the power of the constant.'
      ],
      steps: [
        { h: 'Find n', d: `At $x = 1$: $${par(1 + c)}^{n} = ${S}$, so $n = ${n}$` },
        { h: 'Count the terms', d: `$${n + 1}$ terms, so ${odd ? `two middle terms, $T_{${m + 1}}$ and $T_{${m + 2}}$ ($r = ${m}$ and $r = ${m + 1}$)` : `one middle term, $T_{${m + 1}}$ ($r = ${m}$)`}` },
        { h: 'General term', d: `$T_{r+1} = \\binom{${n}}{r}${cPow(c, 'r')}x^{${a * n} - ${a + b}r}$` },
        { h: 'Middle coefficient' + (odd ? 's' : ''), d: odd
          ? `$\\binom{${n}}{${m}}${cPow(c, m)} + \\binom{${n}}{${m + 1}}${cPow(c, m + 1)} = ${coef(m)} ${coef(m + 1) < 0 ? '-' : '+'} ${Math.abs(coef(m + 1))} = ${value}$`
          : `$\\binom{${n}}{${m}}${cPow(c, m)} = ${value}$` },
        { h: 'Answer', d: `$${value}$` }
      ],
      reasoning: odd ? 'middle-from-sum-odd' : 'middle-from-sum-even'
    };
  }
  return middleTermReasoning(makeRng(FALLBACK_SEED));
}

// ═════════════════════════════════════════════════════════════════════════════

/** One rung, D4: every other rung returns the same form (see the header). */
const d4 = form => (rng, _diff) => form(rng);

export const forms = Object.freeze({
  'c11-binomial-expansion-jee-reasoning': d4(expansionReasoning),
  'c11-binomial-general-term-jee-reasoning': d4(generalTermReasoning),
  'c11-binomial-middle-term-jee-reasoning': d4(middleTermReasoning)
});
