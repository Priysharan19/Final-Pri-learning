// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · NCERT Class 11 — JEE Main hardest-level (D4) forms, tranche 2
//
// The JEE Main track serves D2–D4 on the Class 11 and Class 12 chapters, and
// sixteen Class 11 dot points had no authored form at D4 — two of them had no
// form anywhere in D2–D4 — so the picker could not offer the track's hardest
// level for them and a request that named it was refused
// (docs/release/evidence/india-difficulty-coverage.md, issue #408). Each
// generator below authors exactly one rung — the D4 form for one dot point —
// and the coverage table (curriculum-in-hardest-covers.js) claims it at D4 and
// nowhere else.
//
// What makes these D4 rather than another D3 is the idea each one needs, not
// the size of its numbers: a sign scheme with the denominator's zeros left
// out, a range read off a discriminant, the symmetry of a reflected parabola,
// a weighted median, angles reduced through whole turns, a telescoping
// product of cosines, a quadratic form rewritten in double angles, the
// triangle inequality on |z − a/z|, arguments that add under multiplication,
// casework on the first and last digits with a boundary number, counting by
// complement, a dictionary rank, the gap method, an inverse use of the ratio
// of two sums, inclusion–exclusion on arithmetic progressions, intercepts
// fixed by a section ratio, a minimum by AM–GM, a reflected ray, the two lines
// at a given angle, an orthocentre, a mirror image, limits that need two
// standard limits at once, a derivative from a functional equation, and
// statistics recovered backwards from a mean, a variance or a correction.
//
// Scope is the NCERT Class 11 book as JEE Main examines it — nothing from
// beyond the syllabus: no L'Hôpital's rule is needed for any limit here, and
// every probability-chapter form stays with sample spaces and events.
//
// Provenance. These are original, parameterised forms written for Pri
// Learning. They are not transcribed from a textbook exercise or a past paper;
// recovered past-paper material is study content and is not used here. Every
// keyed answer is computed from the drawn parameters, never typed, and
// client/test/india-hardest-jee-main-check.mjs re-derives each one from the
// rendered prompt by a second route and probes the near misses. None of this
// is a human maths review, and nothing here claims board or examiner approval.
//
// Asked for any rung other than D4, each generator returns its D4 form. No
// coverage entry claims these generators anywhere but D4, and the check fails
// if one ever does, so the label a student sees is always D4.
// ─────────────────────────────────────────────────────────────────────────────
import { ri, rc, rs, nz, gcd, makeRng } from '../qhelpers.js';
import { exact as exactForm, frac, fracTex, traps } from './india-native-helpers.js';

/**
 * An exact answer that also accepts its exact decimal. The marker demands a
 * fraction only when the wording asks for one (#527); these prompts never do,
 * and saying so on the key keeps a \dfrac in the GIVEN data from ever being
 * read as a demand. The keyed simplest fraction is unchanged and accepted.
 */
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
const div = (x, y) => R(x.n * y.d, x.d * y.n);
const rTex = f => fracTex(f.n, f.d);

// ── Formatting ───────────────────────────────────────────────────────────────
/** "+ 3" / "- 3" — a signed constant written after another term. */
const sg = k => (k >= 0 ? `+ ${k}` : `- ${Math.abs(k)}`);
/** cx written the way it is read: x, -x, 3x. */
const cx = (c, v = 'x') => (c === 1 ? v : c === -1 ? `-${v}` : `${c}${v}`);
/** "ax + b", with a zero term left out. */
function lin(a, b, v = 'x') {
  if (a === 0) return String(b);
  return b === 0 ? cx(a, v) : `${cx(a, v)} ${sg(b)}`;
}
/** "x + k", "x - k", "x". */
const shift = (k, v = 'x') => (k === 0 ? v : `${v} ${sg(k)}`);
/** Brackets a negative number: 6 stays 6, −4 becomes (−4). */
const par = v => (v < 0 ? `(${v})` : String(v));

/** Descending-power polynomial from integer coefficients [a_n, …, a_0]. */
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

/** A multiple of π as it is written: π, -π, 3π, \dfrac{5π}{6}, -\dfrac{π}{4}, 0. */
function piTex(n, d = 1) {
  const f = R(n, d);
  if (f.n === 0) return '0';
  const sign = f.n < 0 ? '-' : '';
  const top = Math.abs(f.n) === 1 ? '\\pi' : `${Math.abs(f.n)}\\pi`;
  return f.d === 1 ? `${sign}${top}` : `${sign}\\dfrac{${top}}{${f.d}}`;
}

/** A rational written for a sentence: 3, -\dfrac{2}{5}. */

const FALLBACK_SEED = 0x4d41494e;   // "MAIN"

// ═════════════════════════════════════════════════════════════════════════════
// 1 · Relations and Functions — domain by a sign scheme, range by a discriminant
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Quotients (x² + bx + c)/(x² + dx + e) with a denominator that never vanishes
 * and a range [α, β] whose end points are rational. The range is where the
 * discriminant of (y − 1)x² + (dy − b)x + (ey − c) = 0 is non-negative:
 * A y² + B y + C ≥ 0 with A = d² − 4e < 0.
 */
const RANGE_QUOTIENTS = (() => {
  const out = [];
  for (let b = -6; b <= 6; b++) for (let c = -6; c <= 9; c++) for (let d = -4; d <= 4; d++) for (let e = 1; e <= 12; e++) {
    if (d * d >= 4 * e || b === d) continue;
    const A = d * d - 4 * e, B = 4 * c + 4 * e - 2 * b * d, C = b * b - 4 * c;
    const disc = B * B - 4 * A * C;
    if (disc <= 0) continue;
    const root = Math.round(Math.sqrt(disc));
    if (root * root !== disc) continue;
    const lo = R(-B + root, 2 * A), hi = R(-B - root, 2 * A);
    if (lo.d > 12 || hi.d > 12 || Math.abs(lo.n) > 60 || Math.abs(hi.n) > 60) continue;
    out.push(Object.freeze({ b, c, d, e, A, B, C, lo, hi }));
  }
  return Object.freeze(out);
})();

function domainRangeReasoning(rng) {
  if (rng() < 0.5) {
    for (let guard = 0; guard < 400; guard++) {
      const [a, b, c, e] = rs(rng, [-8, -7, -6, -5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5, 6, 7, 8]).slice(0, 4);
      const sorted = [a, b, c, e].sort((x, y) => x - y);
      const [p1, p2, p3, p4] = sorted;
      if (p2 - p1 < 2 && p4 - p3 < 2) continue;      // an empty gap on both sides is too thin
      const between = (lo, hi) => { const xs = []; for (let x = lo + 1; x < hi; x++) xs.push(x); return xs; };
      const gaps = [...between(p1, p2), ...between(p3, p4)];
      const excluded = [...gaps, c, e].sort((x, y) => x - y);
      const sum = excluded.reduce((s, x) => s + x, 0);
      const wrongGap = between(p2, p3);
      const bracket = (p, left) => ([c, e].includes(p) ? (left ? '(' : ')') : (left ? '[' : ']'));
      const domainTex = `(-\\infty, ${p1}${bracket(p1, false)} \\cup ${bracket(p2, true)}${p2}, ${p3}${bracket(p3, false)} \\cup ${bracket(p4, true)}${p4}, \\infty)`;
      const num = polyTex([1, -(a + b), a * b]), den = polyTex([1, -(c + e), c * e]);
      return {
        prompt: `Let $f(x) = \\sqrt{\\dfrac{${num}}{${den}}}$. Find the sum of all the integers that do not belong to the domain of $f$.`,
        answerType: 'numeric', answer: { value: sum },
        traps: traps(sum, [
          { value: sum + a + b, why: `A zero of the numerator makes the radicand $0$, and $\\sqrt{0} = 0$ is defined — $x = ${a}$ and $x = ${b}$ are in the domain.` },
          { value: sum - c - e, why: `A zero of the denominator is never in the domain: $x = ${c}$ and $x = ${e}$ must be left out as well.` },
          { value: wrongGap.reduce((s, x) => s + x, 0) + c + e, why: 'The quotient is positive for large $|x|$ and changes sign at each of the four zeros, so it is negative on the first and third gaps, not on the middle one.' }
        ]),
        hints: [
          'Factorise the numerator and the denominator into linear factors.',
          'Mark all four zeros on a number line. The quotient is positive when $|x|$ is large and changes sign at each simple zero.',
          'The radicand may be zero but never negative, and the denominator may never be zero.'
        ],
        steps: [
          { h: 'Factorise', d: `$f(x) = \\sqrt{\\dfrac{(${shift(-a)})(${shift(-b)})}{(${shift(-c)})(${shift(-e)})}}$` },
          { h: 'Sign scheme', d: `The zeros in order are $${p1} < ${p2} < ${p3} < ${p4}$. The quotient is negative on $(${p1}, ${p2})$ and on $(${p3}, ${p4})$, and positive elsewhere` },
          { h: 'Domain', d: `Quotient $\\ge 0$ and denominator $\\ne 0$: the domain is $${domainTex}$, with $${c}$ and $${e}$ left out because they are zeros of the denominator` },
          { h: 'Integers left out', d: `$${excluded.join(',\\ ')}$` },
          { h: 'Sum', d: `$${excluded.map(par).join(' + ')} = ${sum}$` }
        ],
        reasoning: 'sign-scheme'
      };
    }
  }
  const t = rc(rng, RANGE_QUOTIENTS);
  const askHigh = rng() < 0.5;
  const value = askHigh ? t.hi : t.lo;
  const other = askHigh ? t.lo : t.hi;
  const fx = `\\dfrac{${polyTex([1, t.b, t.c])}}{${polyTex([1, t.d, t.e])}}`;
  const deltaTex = polyTex([-t.A, -t.B, -t.C], 'y');
  const linear = t.e - t.c === 0 ? 'x = 0' : `x = ${rTex(R(-(t.e - t.c), t.d - t.b))}`;
  return {
    prompt: `The range of the real function $f(x) = ${fx}$, $x \\in \\mathbb{R}$, is the closed interval $[\\alpha, \\beta]$. Find $${askHigh ? '\\beta' : '\\alpha'}$.`,
    answerType: 'numeric', ...exact(value),
    traps: traps(value.value, [
      { value: other.value, why: `That is the ${askHigh ? 'least' : 'greatest'} value of $f$, the other end of the range.` },
      { value: t.c / t.e, why: 'That is $f(0)$, one value in the range — not an end of it.' },
      { value: 1, why: '$f(x) \\to 1$ as $|x| \\to \\infty$, but $1$ lies strictly inside the range here; the ends come from the discriminant condition.' }
    ]),
    hints: [
      'Put $y = f(x)$ and clear the denominator to get a quadratic equation in $x$ whose coefficients involve $y$.',
      'A value $y$ is in the range exactly when that equation has a real root, so its discriminant must be non-negative.',
      'That gives a quadratic inequality in $y$. Check $y = 1$ separately, because there the equation in $x$ is no longer quadratic.'
    ],
    steps: [
      { h: 'The denominator never vanishes', d: `$${polyTex([1, t.d, t.e])}$ has discriminant $${t.d * t.d - 4 * t.e} < 0$, so $f$ is defined for every real $x$` },
      { h: 'Rearrange', d: `$y(${polyTex([1, t.d, t.e])}) = ${polyTex([1, t.b, t.c])} \\Rightarrow (y - 1)x^2 + (${lin(t.d, -t.b, 'y')})x + (${lin(t.e, -t.c, 'y')}) = 0$` },
      { h: 'Real x needs a non-negative discriminant', d: `$(${lin(t.d, -t.b, 'y')})^2 - 4(y - 1)(${lin(t.e, -t.c, 'y')}) \\ge 0 \\iff ${deltaTex} \\le 0$` },
      { h: 'Solve the inequality', d: `$${deltaTex} \\le 0$ for $${rTex(t.lo)} \\le y \\le ${rTex(t.hi)}$` },
      { h: 'The value y = 1', d: `At $y = 1$ the equation is linear with root $${linear}$, so $1$ is in the range too — it already lies inside the interval` },
      { h: 'Answer', d: `The range is $\\left[${rTex(t.lo)}, ${rTex(t.hi)}\\right]$, so $${askHigh ? '\\beta' : '\\alpha'} = ${rTex(value)}$` }
    ],
    reasoning: 'discriminant-range'
  };
}

// ═════════════════════════════════════════════════════════════════════════════
// 2 · Relations and Functions — the modulus function at work
// ═════════════════════════════════════════════════════════════════════════════

function realFunctionReasoning(rng) {
  if (rng() < 0.5) {
    for (let guard = 0; guard < 400; guard++) {
      const p = ri(rng, -6, 6), qq = p + ri(rng, 2, 9);
      const s = p + qq, t = p * qq;
      const four = (qq - p) * (qq - p);          // 4 × the height of the reflected arch
      const mode = rc(rng, ['four', 'three', 'two']);
      let k;
      if (mode === 'three') { if (four % 4) continue; k = four / 4; }
      else if (mode === 'four') { const top = Math.ceil(four / 4) - 1; if (top < 1) continue; k = ri(rng, 1, top); }
      else k = Math.floor(four / 4) + ri(rng, 1, 8);
      const count = mode === 'four' ? 4 : mode === 'three' ? 3 : 2;
      const sum = R(count * s, 2);
      if (sum.d !== 1) continue;
      const h = R(four, 4), axis = R(s, 2);
      return {
        prompt: `Find the sum of all the real solutions of the equation $\\left|${polyTex([1, -s, t])}\\right| = ${k}$.`,
        answerType: 'numeric', answer: { value: sum.n },
        traps: traps(sum.n, [
          { value: 2 * s, why: `That counts four solutions. The reflected arch rises only to height $${rTex(h)}$ above the axis, so the line $y = ${k}$ ${mode === 'two' ? 'misses it' : 'only touches it'}.` },
          { value: s, why: 'That counts only the two solutions of $x^2 - sx + t = k$; the reflected part of the graph can give more.' },
          { value: R(3 * s, 2).value, why: 'Three solutions happen only when the line just touches the top of the reflected arch.' }
        ]),
        hints: [
          'Sketch the graph: the part of the parabola below the $x$-axis is reflected above it.',
          'The reflected arch is highest at the vertex. Compare that height with the right-hand side.',
          'The graph is symmetric about the vertical line through the vertex, so the solutions pair up around it.'
        ],
        steps: [
          { h: 'Factorise', d: `$${polyTex([1, -s, t])} = (${shift(-p)})(${shift(-qq)})$; the vertex is at $x = ${rTex(axis)}$, where the quadratic equals $-${rTex(h)}$` },
          { h: 'Compare heights', d: `The reflected arch peaks at height $${rTex(h)}$, and $${k}$ is ${mode === 'four' ? 'less than' : mode === 'three' ? 'equal to' : 'greater than'} that` },
          { h: 'Count the solutions', d: `$${polyTex([1, -s, t])} = ${k}$ has two roots; $${polyTex([1, -s, t])} = -${k}$ has ${mode === 'four' ? 'two more' : mode === 'three' ? 'one (a double root at the vertex)' : 'none'} — $${count}$ solutions in all` },
          { h: 'Symmetry', d: `The solutions are symmetric about $x = ${rTex(axis)}$, so their sum is $${count} \\times ${rTex(axis)} = ${sum.n}$` }
        ],
        reasoning: 'reflected-parabola'
      };
    }
  }
  for (let guard = 0; guard < 400; guard++) {
    const pts = rs(rng, [-9, -8, -7, -6, -5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9]).slice(0, 3).sort((x, y) => x - y);
    const w = [ri(rng, 1, 4), ri(rng, 1, 4), ri(rng, 1, 4)];
    const f = x => pts.reduce((s, p, i) => s + w[i] * Math.abs(x - p), 0);
    const values = pts.map(f);
    const min = Math.min(...values);
    const unweighted = pts[2] - pts[0];
    if (w[0] === w[1] && w[1] === w[2]) continue;
    if (min === f(pts[1]) && rng() < 0.6) continue;   // most draws should move off the plain median
    const total = w[0] + w[1] + w[2];
    const order = rs(rng, [0, 1, 2]);
    const termTex = i => (rng() < 0.5 && w[i] > 1
      ? `|${lin(w[i], -w[i] * pts[i])}|`
      : `${w[i] === 1 ? '' : w[i]}|${shift(-pts[i])}|`);
    const terms = order.map(termTex);
    const slopes = [-total, -total + 2 * w[0], -total + 2 * (w[0] + w[1]), total];
    const at = pts.find(p => f(p) === min);
    return {
      prompt: `Find the least value of $f(x) = ${terms.join(' + ')}$ for real $x$.`,
      answerType: 'numeric', answer: { value: min },
      traps: traps(min, [
        { value: f(pts[1]), why: `That is $f$ at the middle point, $x = ${pts[1]}$. With unequal weights the least value need not be there: follow the slope.` },
        { value: unweighted, why: 'That would be the least value if every modulus carried weight 1.' },
        { value: 0, why: 'The three moduli cannot all vanish at once, so $f$ never reaches $0$.' }
      ]),
      hints: [
        'Write each term as a multiple of $|x - p|$, so that every corner of the graph is visible.',
        'On each piece between corners $f$ is linear. Far to the left its slope is minus the total weight; far to the right it is the total weight.',
        'The least value is at the corner where the slope changes from negative to non-negative.'
      ],
      steps: [
        { h: 'Corners', d: `$f(x) = ${pts.map((p, i) => `${w[i] === 1 ? '' : w[i]}|${shift(-p)}|`).join(' + ')}$, with corners at $${pts.join(',\\ ')}$` },
        { h: 'Slopes of the pieces', d: `From left to right: $${slopes.join(',\\ ')}$` },
        { h: 'Where the slope turns', d: `The slope changes from negative to non-negative at $x = ${at}$, so $f$ is least there` },
        { h: 'Evaluate', d: `$f(${at}) = ${pts.map((p, i) => `${w[i]}(${Math.abs(at - p)})`).join(' + ')} = ${min}$` }
      ],
      reasoning: 'weighted-median'
    };
  }
  return realFunctionReasoning(makeRng(FALLBACK_SEED));
}

// ═════════════════════════════════════════════════════════════════════════════
// 3 · Trigonometric Functions — radian measure and the unit circle
// ═════════════════════════════════════════════════════════════════════════════

/** sin(mπ/6) for m mod 12, as [numerator, denominator, carries √3]. */
const SIN_SIXTHS = [[0, 1, 0], [1, 2, 0], [1, 2, 1], [1, 1, 0], [1, 2, 1], [1, 2, 0], [0, 1, 0], [-1, 2, 0], [-1, 2, 1], [-1, 1, 0], [-1, 2, 1], [-1, 2, 0]];
const mod = (a, m) => ((a % m) + m) % m;
const sinSixth = m => SIN_SIXTHS[mod(m, 12)];
const cosSixth = m => SIN_SIXTHS[mod(m + 3, 12)];
const TAN_QUARTER = { 0: 0, 1: 1, 3: -1 };
const ratioTex = ([n, d, r3]) => {
  if (n === 0) return '0';
  const sign = n < 0 ? '-' : '';
  if (!r3) return d === 1 ? `${n}` : `${sign}\\dfrac{1}{${d}}`;
  return `${sign}\\dfrac{\\sqrt{3}}{${d}}`;
};

const TRIPLES = [[3, 4, 5], [5, 12, 13], [8, 15, 17], [7, 24, 25], [20, 21, 29], [12, 35, 37], [9, 40, 41]];
const RATIO_NAME = { sin: '\\sin', cos: '\\cos', tan: '\\tan', sec: '\\sec', cosec: '\\operatorname{cosec}', cot: '\\cot' };

function radianCircleReasoning(rng) {
  const kind = rc(rng, ['reduce', 'clock', 'quadrant']);
  if (kind === 'reduce') {
    for (let guard = 0; guard < 400; guard++) {
      const m1 = (rng() < 0.5 ? -1 : 1) * ri(rng, 13, 47);
      const m2 = (rng() < 0.5 ? -1 : 1) * ri(rng, 13, 47);
      const m3 = (rng() < 0.5 ? -1 : 1) * rc(rng, [5, 7, 9, 11, 13, 15, 17, 19, 21, 23, 25, 27, 29, 31]);
      const s1 = sinSixth(m1), c2 = cosSixth(m2);
      if (!s1[0] || !c2[0] || s1[2] !== c2[2]) continue;
      if (mod(m1, 12) === mod(m2 + 3, 12) && rng() < 0.7) continue;
      const k = rc(rng, [1, 2, 4]);
      const plus = rng() < 0.5;
      const prod = R(k * s1[0] * c2[0] * (s1[2] ? 3 : 1), s1[1] * c2[1]);
      const t3 = TAN_QUARTER[mod(m3, 4)];
      const value = plus ? add(prod, R(t3)) : sub(prod, R(t3));
      if (value.n === 0) continue;
      const absProd = R(Math.abs(prod.n), prod.d);
      const naive = plus ? add(absProd, R(1)) : sub(absProd, R(1));
      const red1 = mod(m1, 12), red2 = mod(m2, 12), red3 = mod(m3, 4);
      return {
        prompt: `Find the exact value of $${k === 1 ? '' : k}\\sin\\left(${piTex(m1, 6)}\\right)\\cos\\left(${piTex(m2, 6)}\\right) ${plus ? '+' : '-'} \\tan\\left(${piTex(m3, 4)}\\right)$.`,
        answerType: 'numeric', ...exact(value),
        traps: traps(value.value, [
          { value: naive.value, why: 'Every ratio has been taken as positive. The quadrant of each reduced angle decides its sign.' },
          { value: plus ? sub(prod, R(t3)).value : add(prod, R(t3)).value, why: `Check the sign of $\\tan\\left(${piTex(m3, 4)}\\right)$: the tangent repeats every $\\pi$, so reduce by multiples of $\\pi$ and look at the quadrant.` },
          { value: (plus ? add(R(-prod.n, prod.d), R(t3)) : sub(R(-prod.n, prod.d), R(t3))).value, why: 'The sign of the sine–cosine product is wrong — recheck the quadrant of each of those two angles after removing whole turns.' }
        ]),
        hints: [
          'Remove whole turns ($2\\pi$) from the angles of the sine and the cosine, and whole multiples of $\\pi$ from the angle of the tangent.',
          'Decide the quadrant of each reduced angle; it fixes the sign of the ratio.',
          'Read the size of each ratio from its reference angle.'
        ],
        steps: [
          { h: 'Reduce the sine angle', d: `$${piTex(m1, 6)} = ${piTex(red1, 6)} ${(m1 - red1) / 12 >= 0 ? '+' : '-'} ${Math.abs((m1 - red1) / 12) === 1 ? '' : Math.abs((m1 - red1) / 12)}(2\\pi)$, so $\\sin\\left(${piTex(m1, 6)}\\right) = ${ratioTex(s1)}$` },
          { h: 'Reduce the cosine angle', d: `$${piTex(m2, 6)} = ${piTex(red2, 6)} ${(m2 - red2) / 12 >= 0 ? '+' : '-'} ${Math.abs((m2 - red2) / 12) === 1 ? '' : Math.abs((m2 - red2) / 12)}(2\\pi)$, so $\\cos\\left(${piTex(m2, 6)}\\right) = ${ratioTex(c2)}$` },
          { h: 'Reduce the tangent angle', d: `$${piTex(m3, 4)} = ${piTex(red3, 4)} ${(m3 - red3) / 4 >= 0 ? '+' : '-'} ${Math.abs((m3 - red3) / 4) === 1 ? '' : Math.abs((m3 - red3) / 4)}\\pi$, so $\\tan\\left(${piTex(m3, 4)}\\right) = ${t3}$` },
          { h: 'Combine', d: `$${k === 1 ? '' : `${k} \\times `}\\left(${ratioTex(s1)}\\right)\\left(${ratioTex(c2)}\\right) ${plus ? '+' : '-'} (${t3}) = ${rTex(prod)} ${plus ? '+' : '-'} (${t3}) = ${rTex(value)}$` }
        ],
        reasoning: 'reduce-by-turns'
      };
    }
  }
  if (kind === 'clock') {
    for (let guard = 0; guard < 400; guard++) {
      const h = ri(rng, 1, 12), mm = ri(rng, 1, 59);
      let twice = mod(60 * (h % 12) - 11 * mm, 720);      // twice the angle in degrees
      if (twice > 360) twice = 720 - twice;
      if (twice === 0) continue;
      const k = R(twice, 360);
      const naiveTwice = (() => { let x = mod(60 * (h % 12) - 12 * mm, 720); return x > 360 ? 720 - x : x; })();
      const time = `${h}:${String(mm).padStart(2, '0')}`;
      return {
        prompt: `At ${time} the hour hand and the minute hand of a clock make an angle of $k\\pi$ radians with each other, where $0 \\le k \\le 1$. Find $k$.`,
        answerType: 'numeric', ...exact(k),
        traps: traps(k.value, [
          { value: R(naiveTwice, 360).value, why: `The hour hand does not wait at the ${h % 12 || 12}: it moves on by $\\dfrac{\\pi}{360}$ radians every minute.` },
          { value: R(720 - twice, 360).value, why: 'That is the reflex angle. The angle between the hands is the smaller one, at most $\\pi$.' },
          { value: R(twice, 720).value, why: 'A full turn is $2\\pi$ radians, but $180^\\circ$ is $\\pi$ radians — divide the degree measure by $180$, not $360$.' }
        ]),
        hints: [
          'Measure both hands from the 12 o\'clock position, in radians.',
          'In one minute the minute hand turns through $\\dfrac{\\pi}{30}$ radians and the hour hand through $\\dfrac{\\pi}{360}$ radians.',
          'If the difference is more than $\\pi$, the angle between the hands is $2\\pi$ minus it.'
        ],
        steps: [
          { h: 'Minute hand', d: `$${mm} \\times \\dfrac{\\pi}{30} = ${piTex(mm, 30)}$ from 12` },
          { h: 'Hour hand', d: `$${60 * (h % 12) + mm}$ minutes after 12 o'clock: $${60 * (h % 12) + mm} \\times \\dfrac{\\pi}{360} = ${piTex(60 * (h % 12) + mm, 360)}$ from 12` },
          { h: 'Difference', d: `$\\left|${piTex(mm, 30)} - ${piTex(60 * (h % 12) + mm, 360)}\\right| = ${piTex(Math.abs(12 * mm - 60 * (h % 12) - mm), 360)}$` },
          { h: 'The smaller angle', d: `$k\\pi = ${piTex(twice, 360)}$, so $k = ${rTex(k)}$` }
        ],
        reasoning: 'clock-hands'
      };
    }
  }
  for (let guard = 0; guard < 400; guard++) {
    const [p, b0, c] = rc(rng, TRIPLES);
    const [o, a] = rng() < 0.5 ? [p, b0] : [b0, p];       // opposite and adjacent legs of the reference angle
    const quad = ri(rng, 1, 4);
    const ss = quad <= 2 ? 1 : -1, cs = quad === 1 || quad === 4 ? 1 : -1;
    const sin = R(ss * o, c), cos = R(cs * a, c), tan = div(sin, cos);
    const given = rc(rng, ['sin', 'cos', 'tan', 'sec', 'cosec', 'cot']);
    const gv = { sin, cos, tan, sec: div(R(1), cos), cosec: div(R(1), sin), cot: div(cos, sin) }[given];
    const asks = [
      { tex: '\\sin\\theta + \\cos\\theta', v: add(sin, cos), naive: R(o + a, c) },
      { tex: '\\tan\\theta + \\sec\\theta', v: add(tan, div(R(1), cos)), naive: add(R(o, a), R(c, a)) },
      { tex: '\\operatorname{cosec}\\theta - \\cot\\theta', v: sub(div(R(1), sin), div(cos, sin)), naive: sub(R(c, o), R(a, o)) },
      { tex: '\\sec\\theta - \\tan\\theta', v: sub(div(R(1), cos), tan), naive: sub(R(c, a), R(o, a)) }
    ];
    const ask = rc(rng, asks);
    if (ask.v.n === 0 || ask.v.value === ask.naive.value) continue;
    const j = rc(rng, [-1, 0, 1, 2]);
    const lo = 4 * j + quad - 1, hi = 4 * j + quad;
    return {
      prompt: `If $${RATIO_NAME[given]}\\,\\theta = ${rTex(gv)}$ and $${piTex(lo, 2)} < \\theta < ${piTex(hi, 2)}$, find the value of $${ask.tex}$.`,
      answerType: 'numeric', ...exact(ask.v),
      traps: traps(ask.v.value, [
        { value: ask.naive.value, why: 'Every ratio has been taken as positive. The interval places $\\theta$ in a quadrant where some of them are negative.' },
        { value: -ask.v.value, why: 'Every sign has been reversed — recheck which quadrant the interval describes once whole turns are removed.' }
      ]),
      hints: [
        'Remove whole turns from the interval to see which quadrant $\\theta$ lies in.',
        'Use a right triangle with the given ratio to find the sizes of the other ratios.',
        'Give each ratio the sign its quadrant demands, then substitute.'
      ],
      steps: [
        { h: 'The quadrant', d: `$${piTex(lo, 2)} < \\theta < ${piTex(hi, 2)}$ is the ${['first', 'second', 'third', 'fourth'][quad - 1]} quadrant after removing ${j === 0 ? 'no' : `$${Math.abs(j)}$`} whole turn${Math.abs(j) === 1 ? '' : 's'}` },
        { h: 'Sizes from a triangle', d: `Sides $${o}$, $${a}$ and $${c}$: $|\\sin\\theta| = ${fracTex(o, c)}$, $|\\cos\\theta| = ${fracTex(a, c)}$, $|\\tan\\theta| = ${fracTex(o, a)}$` },
        { h: 'Signs', d: `$\\sin\\theta = ${rTex(sin)}$, $\\cos\\theta = ${rTex(cos)}$, $\\tan\\theta = ${rTex(tan)}$` },
        { h: 'Substitute', d: `$${ask.tex} = ${rTex(ask.v)}$` }
      ],
      reasoning: 'quadrant-signs'
    };
  }
  return radianCircleReasoning(makeRng(FALLBACK_SEED));
}

// ═════════════════════════════════════════════════════════════════════════════
// 4 · Trigonometric Functions — compound, double and product identities
// ═════════════════════════════════════════════════════════════════════════════

const AMPLITUDE_PAIRS = [[3, 4, 5], [4, 3, 5], [6, 8, 10], [8, 6, 10], [5, 12, 13], [12, 5, 13], [8, 15, 17], [15, 8, 17]];
const TRIPLE_PRODUCTS = [
  { fn: 'sin', theta: 10, angles: [10, 50, 70], value: [1, 8] },
  { fn: 'sin', theta: 50, angles: [50, 10, 110], value: [1, 8] },
  { fn: 'cos', theta: 20, angles: [20, 40, 80], value: [1, 8] },
  { fn: 'cos', theta: 40, angles: [40, 20, 100], value: [-1, 8] }
];

function trigIdentityReasoning(rng) {
  const kind = rc(rng, ['doubling', 'quadratic-form', 'triple']);
  if (kind === 'doubling') {
    // n ≥ 3: with n = 2 the angles are thirds of π, whose cosines are known outright.
    const n = ri(rng, 3, 5);
    const top = rc(rng, [1, 2]), plus = rng() < 0.5;
    const den = 2 ** n + (plus ? 1 : -1);
    // sin(2ⁿθ) = ± sin θ for θ = top·π/den, so the product is ± 1/2ⁿ.
    const sign = top === 1 ? (plus ? 1 : -1) : (plus ? -1 : 1);
    const value = R(sign, 2 ** n);
    const factors = [];
    let flips = 0;
    for (let i = 0; i < n; i++) {
      const num = top * 2 ** i;
      // An angle in (π/2, π) is sometimes written as π minus it, with the sign moved out.
      if (2 * num > den && num < den && rng() < 0.5) { factors.push(`\\cos ${piTex(den - num, den)}`); flips++; }
      else factors.push(`\\cos ${piTex(num, den)}`);
    }
    const shown = flips % 2 ? R(-value.n, value.d) : value;
    const order = rs(rng, factors.map((_, i) => i));
    return {
      prompt: `Find the exact value of $${order.map(i => factors[i]).join('\\,')}$.`,
      answerType: 'numeric', ...exact(shown),
      traps: traps(shown.value, [
        { value: -shown.value, why: 'The size is right but the sign is not. Check whether $\\sin(2^n\\theta)$ equals $\\sin\\theta$ or $-\\sin\\theta$, and whether any factor is a cosine of an angle beyond $\\dfrac{\\pi}{2}$.' },
        { value: R(1, 2 ** (n - 1)).value, why: `Each application of $2\\sin\\theta\\cos\\theta = \\sin 2\\theta$ brings a factor $\\dfrac{1}{2}$, and there are $${n}$ of them.` }
      ]),
      hints: [
        'Multiply and divide by $\\sin$ of the smallest angle.',
        'Use $2\\sin A\\cos A = \\sin 2A$ again and again: the angles double each time.',
        'At the end compare the sine of the largest angle with the sine you divided by — they are equal or opposite.'
      ],
      steps: [
        { h: 'Rewrite', d: flips ? `Use $\\cos(\\pi - \\phi) = -\\cos\\phi$ to write the product as $${flips % 2 ? '-' : ''}${factors.map((f, i) => `\\cos ${piTex(top * 2 ** i, den)}`).join('\\,')}$` : `The angles are $\\theta, 2\\theta, \\ldots$ with $\\theta = ${piTex(top, den)}$` },
        { h: 'Telescope', d: `$\\cos\\theta\\cos 2\\theta\\cdots\\cos ${2 ** (n - 1)}\\theta = \\dfrac{\\sin ${2 ** n}\\theta}{${2 ** n}\\sin\\theta}$` },
        { h: 'Compare the sines', d: `$${2 ** n}\\theta = ${piTex(top * 2 ** n, den)}$ and $\\sin ${piTex(top * 2 ** n, den)} = ${sign > 0 ? '' : '-'}\\sin ${piTex(top, den)}$` },
        { h: 'Answer', d: `$${flips % 2 ? `-\\left(${rTex(value)}\\right)` : rTex(value)} = ${rTex(shown)}$` }
      ],
      reasoning: 'telescoping-product'
    };
  }
  if (kind === 'quadratic-form') {
    for (let guard = 0; guard < 400; guard++) {
      const [u, v, w] = rc(rng, AMPLITUDE_PAIRS);
      const diff = (rng() < 0.5 ? -1 : 1) * u, qq = (rng() < 0.5 ? -1 : 1) * v;
      const p = ri(rng, -5, 6), r = p + diff;
      const askMax = rng() < 0.5;
      const value = R(p + r + (askMax ? w : -w), 2);
      const term = (c, body, first) => {
        if (c === 0) return '';
        const mag = Math.abs(c) === 1 ? '' : Math.abs(c);
        return first ? `${c < 0 ? '-' : ''}${mag}${body}` : ` ${c < 0 ? '-' : '+'} ${mag}${body}`;
      };
      let fx = term(p, '\\sin^2 x', true);
      fx += term(qq, '\\sin x\\cos x', fx === '');
      fx += term(r, '\\cos^2 x', fx === '');
      return {
        prompt: `Find the ${askMax ? 'greatest' : 'least'} value of $f(x) = ${fx}$ for real $x$.`,
        answerType: 'numeric', ...exact(value),
        traps: traps(value.value, [
          { value: R(p + r + (askMax ? -w : w), 2).value, why: `That is the ${askMax ? 'least' : 'greatest'} value.` },
          { value: p + r + (askMax ? w : -w), why: 'Halving the angle halves the coefficients: the constant is $\\dfrac{p + r}{2}$ and the amplitude is $\\dfrac{1}{2}\\sqrt{(r - p)^2 + q^2}$.' },
          { value: askMax ? Math.max(p, r) + Math.abs(qq) : Math.min(p, r) - Math.abs(qq), why: 'The three terms do not reach their extremes at the same $x$; combine them into one sinusoid first.' }
        ]),
        hints: [
          'Rewrite $\\sin^2 x$, $\\cos^2 x$ and $\\sin x\\cos x$ in terms of $\\cos 2x$ and $\\sin 2x$.',
          '$f$ becomes a constant plus $A\\cos 2x + B\\sin 2x$.',
          '$A\\cos 2x + B\\sin 2x$ takes every value between $-\\sqrt{A^2 + B^2}$ and $\\sqrt{A^2 + B^2}$.'
        ],
        steps: [
          { h: 'Double angles', d: '$\\sin^2 x = \\dfrac{1 - \\cos 2x}{2}$, $\\cos^2 x = \\dfrac{1 + \\cos 2x}{2}$, $\\sin x\\cos x = \\dfrac{\\sin 2x}{2}$' },
          { h: 'Collect', d: `$f(x) = ${rTex(R(p + r, 2))} ${diff >= 0 ? '+' : '-'} ${rTex(R(Math.abs(diff), 2))}\\cos 2x ${qq >= 0 ? '+' : '-'} ${rTex(R(Math.abs(qq), 2))}\\sin 2x$` },
          { h: 'Amplitude', d: `$\\sqrt{\\left(${rTex(R(diff, 2))}\\right)^2 + \\left(${rTex(R(qq, 2))}\\right)^2} = ${rTex(R(w, 2))}$` },
          { h: 'Answer', d: `${askMax ? 'Greatest' : 'Least'} value $= ${rTex(R(p + r, 2))} ${askMax ? '+' : '-'} ${rTex(R(w, 2))} = ${rTex(value)}$` }
        ],
        reasoning: 'double-angle-amplitude'
      };
    }
  }
  const t = rc(rng, TRIPLE_PRODUCTS);
  const K = rc(rng, [1, 2, 4, 8, 16, 24, 32]);
  const value = R(K * t.value[0], t.value[1]);
  const order = rs(rng, [0, 1, 2]);
  const fn = `\\${t.fn}`;
  const expr = `${K === 1 ? '' : K}${order.map(i => `${fn} ${t.angles[i]}^\\circ`).join('\\,')}`;
  return {
    prompt: `Find the exact value of $${expr}$.`,
    answerType: 'numeric', ...exact(value),
    traps: traps(value.value, [
      { value: -value.value, why: `Check the sign of $\\${t.fn} ${3 * t.theta}^\\circ$.` },
      { value: R(K * t.value[0], 4).value, why: 'The identity has a factor $\\dfrac{1}{4}$, and $\\sin 3\\theta$ or $\\cos 3\\theta$ still has to be evaluated.' },
      { value: R(K * t.value[0], 2).value, why: 'Each product-to-sum step halves; two of them give a factor $\\dfrac{1}{4}$ in front of the triple-angle ratio.' }
    ]),
    hints: [
      'Pair two of the factors and use a product-to-sum identity.',
      `The three angles are $\\theta$, $60^\\circ - \\theta$ and $60^\\circ + \\theta$ for a suitable $\\theta$ (an angle beyond $90^\\circ$ may need rewriting first).`,
      `$4\\${t.fn}\\theta\\,\\${t.fn}(60^\\circ - \\theta)\\,\\${t.fn}(60^\\circ + \\theta) = \\${t.fn} 3\\theta$.`
    ],
    steps: [
      { h: 'Spot the pattern', d: `$\\theta = ${t.theta}^\\circ$: the angles are $\\theta = ${t.theta}^\\circ$, $60^\\circ - \\theta = ${60 - t.theta}^\\circ$ and $60^\\circ + \\theta = ${60 + t.theta}^\\circ$` },
      { h: 'Product to sum', d: `$${fn}(60^\\circ - \\theta)\\,${fn}(60^\\circ + \\theta) = ${t.fn === 'sin' ? '\\sin^2 60^\\circ - \\sin^2\\theta' : '\\cos^2\\theta - \\sin^2 60^\\circ'}$, and multiplying by $${fn}\\theta$ gives $\\dfrac{1}{4}${fn} 3\\theta$` },
      { h: 'Triple angle', d: `$${fn} ${3 * t.theta}^\\circ = ${t.value[0] < 0 ? '-' : ''}\\dfrac{1}{2}$` },
      { h: 'Answer', d: `$${K} \\times \\dfrac{1}{4} \\times \\left(${t.value[0] < 0 ? '-' : ''}\\dfrac{1}{2}\\right) = ${rTex(value)}$` }
    ],
    reasoning: 'triple-product'
  };
}

// ═════════════════════════════════════════════════════════════════════════════
// 5 · Complex Numbers — operations, modulus and conjugate
// ═════════════════════════════════════════════════════════════════════════════

/** Pairs (b, k) with k² − b² = 4a: |z − a/z| = b then confines |z| to [(k − b)/2, (k + b)/2]. */
const MODULUS_BOUNDS = (() => {
  const out = [];
  for (let b = 1; b <= 7; b++) for (let k = b + 2; k <= 13; k += 2) {
    const a = (k * k - b * b) / 4;
    if (Number.isInteger(a) && a >= 2 && a <= 40) out.push(Object.freeze({ a, b, k }));
  }
  return Object.freeze(out);
})();

function complexAlgebraReasoning(rng) {
  const kind = rc(rng, ['modulus-equation', 'modulus-bound', 'square-root']);
  if (kind === 'modulus-equation') {
    for (let guard = 0; guard < 400; guard++) {
      const a = ri(rng, 1, 12), b = nz(rng, -12, 12);
      const plus = rng() < 0.5;                 // |z| + z = a + bi, or |z| − z = a + bi
      const y = plus ? b : -b;
      const x = plus ? R(a * a - b * b, 2 * a) : R(b * b - a * a, 2 * a);
      const modulus = R(a * a + b * b, 2 * a);
      const askModulus = rng() < 0.5;
      const value = askModulus ? modulus : x;
      if (value.n === 0) continue;
      return {
        prompt: `Find ${askModulus ? '$|z|$' : 'the real part of $z$'} for the complex number $z$ that satisfies $|z| ${plus ? '+' : '-'} z = ${a} ${sg(b)}i$.`,
        answerType: 'numeric', ...exact(value),
        traps: traps(value.value, [
          { value: askModulus ? Math.hypot(a, b) : a, why: askModulus ? `That is $|${a} ${sg(b)}i|$, the modulus of the right-hand side, not of $z$.` : 'The real part of the right-hand side also contains $|z|$; it is not the real part of $z$.' },
          { value: -value.value, why: 'Check the sign when the square root is isolated: the real part satisfies a linear equation once both sides are squared.' },
          { value: askModulus ? R(a * a + b * b, a).value : R(Math.abs(a * a - b * b), a).value, why: 'Expanding $(a \\mp x)^2$ gives a cross term $2ax$, so the division at the end is by $2a$.' }
        ]),
        hints: [
          'Write $z = x + iy$ and compare real and imaginary parts on the two sides.',
          'The imaginary parts fix $y$ at once; the real parts give an equation with $\\sqrt{x^2 + y^2}$ in it.',
          'Isolate the square root before squaring, and check that what it equals is not negative.'
        ],
        steps: [
          { h: 'Compare parts', d: `$\\sqrt{x^2 + y^2} ${plus ? '+' : '-'} x = ${a}$ and $${plus ? '' : '-'}y = ${b}$, so $y = ${y}$` },
          { h: 'Isolate the root', d: `$\\sqrt{x^2 + ${y * y}} = ${a} ${plus ? '-' : '+'} x$` },
          { h: 'Square', d: `$x^2 + ${y * y} = ${a * a} ${plus ? '-' : '+'} ${2 * a}x + x^2 \\Rightarrow x = ${rTex(x)}$` },
          { h: 'Modulus', d: `$|z| = ${a} ${plus ? '-' : '+'} \\left(${rTex(x)}\\right) = ${rTex(modulus)}$, which is positive, so the root is genuine` },
          { h: 'Answer', d: `${askModulus ? '$|z|' : '$\\operatorname{Re} z'} = ${rTex(value)}$` }
        ],
        reasoning: 'modulus-equation'
      };
    }
  }
  if (kind === 'modulus-bound') {
    const { a, b, k } = rc(rng, MODULUS_BOUNDS);
    const askMax = rng() < 0.5;
    const value = askMax ? (k + b) / 2 : (k - b) / 2;
    return {
      prompt: `A complex number $z$ satisfies $\\left|z - \\dfrac{${a}}{z}\\right| = ${b}$. Find the ${askMax ? 'greatest' : 'least'} possible value of $|z|$.`,
      answerType: 'numeric', answer: { value },
      traps: traps(value, [
        { value: askMax ? (k - b) / 2 : (k + b) / 2, why: `That is the ${askMax ? 'least' : 'greatest'} value of $|z|$.` },
        { value: b, why: 'That is $|z - a/z|$ itself. The bound on $|z|$ comes from the triangle inequality.' },
        { value: (b + Math.sqrt(b * b + a)) / 2, why: 'With $r = |z|$, the inequality $r - \\dfrac{a}{r} \\le b$ becomes $r^2 - br - a \\le 0$; its discriminant is $b^2 + 4a$.' }
      ]),
      hints: [
        'Use the triangle inequality $\\big||u| - |v|\\big| \\le |u - v|$ with $u = z$.',
        'With $r = |z|$, this gives quadratic inequalities in $r$.',
        'Check that the bound is actually reached by a suitable real value of $z$.'
      ],
      steps: [
        { h: 'Triangle inequality', d: `$\\left|r - \\dfrac{${a}}{r}\\right| \\le \\left|z - \\dfrac{${a}}{z}\\right| = ${b}$, where $r = |z|$` },
        { h: 'Upper bound', d: `$r - \\dfrac{${a}}{r} \\le ${b} \\Rightarrow r^2 - ${b}r - ${a} \\le 0 \\Rightarrow r \\le \\dfrac{${b} + \\sqrt{${b * b + 4 * a}}}{2} = ${(k + b) / 2}$` },
        { h: 'Lower bound', d: `$\\dfrac{${a}}{r} - r \\le ${b} \\Rightarrow r^2 + ${b}r - ${a} \\ge 0 \\Rightarrow r \\ge \\dfrac{-${b} + \\sqrt{${b * b + 4 * a}}}{2} = ${(k - b) / 2}$` },
        { h: 'Both are reached', d: `$z = ${(k + b) / 2}$ gives $\\left|${(k + b) / 2} - ${rTex(R(a, (k + b) / 2))}\\right| = ${b}$, and $z = ${(k - b) / 2}$ gives $\\left|${(k - b) / 2} - ${rTex(R(a, (k - b) / 2))}\\right| = ${b}$` },
        { h: 'Answer', d: `The ${askMax ? 'greatest' : 'least'} value of $|z|$ is $${value}$` }
      ],
      reasoning: 'triangle-inequality'
    };
  }
  for (let guard = 0; guard < 400; guard++) {
    const x = ri(rng, 1, 9), y = nz(rng, -9, 9);
    if (x === Math.abs(y)) continue;
    const a = x * x - y * y, b = 2 * x * y;
    const askIm = rng() < 0.5;
    const value = askIm ? y : x;
    return {
      prompt: `Of the two square roots of $${a} ${sg(b)}i$, take the one with positive real part. Find its ${askIm ? 'imaginary' : 'real'} part.`,
      answerType: 'numeric', answer: { value },
      traps: traps(value, [
        { value: askIm ? x : y, why: `That is the ${askIm ? 'real' : 'imaginary'} part.` },
        { value: askIm ? -y : -x, why: 'That belongs to the other square root, the one with negative real part.' },
        { value: askIm ? b / 2 : a, why: 'The parts of the square root are not read off the number itself; solve $x^2 - y^2 = a$ and $2xy = b$.' }
      ]),
      hints: [
        'Let $(x + iy)^2$ equal the given number and compare real and imaginary parts.',
        'A third equation comes from moduli: $x^2 + y^2$ is the modulus of the given number.',
        'Solve for $x^2$ and $y^2$, then choose signs that agree with the imaginary part.'
      ],
      steps: [
        { h: 'Compare parts', d: `$x^2 - y^2 = ${a}$ and $2xy = ${b}$` },
        { h: 'Moduli', d: `$x^2 + y^2 = \\sqrt{${a}^2 + ${b}^2} = ${x * x + y * y}$` },
        { h: 'Solve', d: `$x^2 = ${x * x}$ and $y^2 = ${y * y}$; with $x > 0$, $x = ${x}$, and $2xy = ${b}$ makes $y = ${y}$` },
        { h: 'Answer', d: `The root is $${x} ${sg(y)}i$; its ${askIm ? 'imaginary' : 'real'} part is $${value}$` }
      ],
      reasoning: 'square-root'
    };
  }
  return complexAlgebraReasoning(makeRng(FALLBACK_SEED));
}

// ═════════════════════════════════════════════════════════════════════════════
// 6 · Complex Numbers — polar form and the argument
// ═════════════════════════════════════════════════════════════════════════════

/** Numbers whose argument is a whole number of degrees from the standard table; lg = log₂|z|². */
const POLAR = [
  { tex: '1 + i', lg: 1, arg: 45 }, { tex: '1 - i', lg: 1, arg: -45 }, { tex: '-1 + i', lg: 1, arg: 135 }, { tex: '-1 - i', lg: 1, arg: -135 },
  { tex: '\\sqrt{3} + i', lg: 2, arg: 30 }, { tex: '\\sqrt{3} - i', lg: 2, arg: -30 }, { tex: '-\\sqrt{3} + i', lg: 2, arg: 150 }, { tex: '-\\sqrt{3} - i', lg: 2, arg: -150 },
  { tex: '1 + i\\sqrt{3}', lg: 2, arg: 60 }, { tex: '1 - i\\sqrt{3}', lg: 2, arg: -60 }, { tex: '-1 + i\\sqrt{3}', lg: 2, arg: 120 }, { tex: '-1 - i\\sqrt{3}', lg: 2, arg: -120 }
];
const pow = (u, p) => (p === 1 ? `(${u.tex})` : `(${u.tex})^{${p}}`);
const principalDeg = t => { const r = mod(t, 360); return r > 180 ? r - 360 : r; };

function complexPolarReasoning(rng) {
  const kind = rc(rng, ['least-power', 'principal-argument', 'real-part']);
  for (let guard = 0; guard < 400; guard++) {
    const u = rc(rng, POLAR), v = rc(rng, POLAR);
    if (u === v) continue;
    if (kind === 'least-power') {
      const p = ri(rng, 1, 3), qq = ri(rng, 1, 3);
      const quotient = rng() < 0.5;
      const arg = p * u.arg + (quotient ? -1 : 1) * qq * v.arg;
      const cond = rc(rng, ['real', 'positive', 'imaginary']);
      const holds = n => (cond === 'real' ? mod(n * arg, 180) === 0 : cond === 'positive' ? mod(n * arg, 360) === 0 : mod(n * arg, 180) === 90);
      let n = 1;
      while (n <= 720 && !holds(n)) n++;
      if (n > 720 || n < 2) continue;
      const realN = (() => { let m = 1; while (m <= 720 && mod(m * arg, 180) !== 0) m++; return m; })();
      const zTex = quotient ? `\\dfrac{${pow(u, p)}}{${pow(v, qq)}}` : `${pow(u, p)}${pow(v, qq)}`;
      const phrase = cond === 'real' ? 'a real number' : cond === 'positive' ? 'a positive real number' : 'purely imaginary';
      return {
        prompt: `Let $z = ${zTex}$. Find the least positive integer $n$ for which $z^n$ is ${phrase}.`,
        answerType: 'numeric', answer: { value: n },
        traps: traps(n, [
          { value: cond === 'positive' ? realN : 2 * n, why: cond === 'positive' ? 'That makes $z^n$ real, but possibly negative: a positive real number needs $n\\arg z$ to be a multiple of $2\\pi$.' : 'That works, but a smaller $n$ already does.' },
          { value: Math.round(360 / gcd(mod(p * u.arg, 360) || 360, 360)), why: 'Both factors contribute to the argument of $z$, not only the first.' }
        ]),
        hints: [
          'Write each base in polar form $r(\\cos\\theta + i\\sin\\theta)$.',
          'Arguments add under multiplication, subtract under division, and multiply under powers (De Moivre).',
          `$z^n$ is ${phrase} exactly when $n\\arg z$ is ${cond === 'real' ? 'a multiple of $\\pi$' : cond === 'positive' ? 'a multiple of $2\\pi$' : 'an odd multiple of $\\dfrac{\\pi}{2}$'}.`
        ],
        steps: [
          { h: 'Arguments', d: `$\\arg(${u.tex}) = ${piTex(u.arg, 180)}$ and $\\arg(${v.tex}) = ${piTex(v.arg, 180)}$` },
          { h: 'Argument of z', d: `$\\arg z = ${p}\\left(${piTex(u.arg, 180)}\\right) ${quotient ? '-' : '+'} ${qq}\\left(${piTex(v.arg, 180)}\\right) = ${piTex(arg, 180)}$ (up to whole turns)` },
          { h: 'Condition', d: `Need $n \\times ${piTex(arg, 180)}$ to be ${cond === 'real' ? 'a multiple of $\\pi$' : cond === 'positive' ? 'a multiple of $2\\pi$' : 'an odd multiple of $\\dfrac{\\pi}{2}$'}` },
          { h: 'Least n', d: `The smallest positive $n$ that works is $${n}$` }
        ],
        reasoning: 'least-power'
      };
    }
    if (kind === 'principal-argument') {
      const p = ri(rng, 1, 5), qq = ri(rng, 1, 5);
      const quotient = rng() < 0.5;
      const raw = p * u.arg + (quotient ? -1 : 1) * qq * v.arg;
      const value = principalDeg(raw);
      if (value === raw || value === 0 || Math.abs(value) === 180) continue;
      const zTex = quotient ? `\\dfrac{${pow(u, p)}}{${pow(v, qq)}}` : `${pow(u, p)}${pow(v, qq)}`;
      return {
        prompt: `Find the principal argument of $z = ${zTex}$, in degrees. The principal argument lies in $(-180^\\circ, 180^\\circ]$.`,
        answerType: 'numeric', answer: { value }, answerSuffix: 'degrees',
        traps: traps(value, [
          { value: raw, why: `$${raw}^\\circ$ is an argument of $z$, but not the principal one: add or subtract whole turns of $360^\\circ$.` },
          { value: mod(raw, 360), why: 'That is in $[0^\\circ, 360^\\circ)$; the principal argument is taken in $(-180^\\circ, 180^\\circ]$.' }
        ]),
        hints: [
          'Find the argument of each base from its position in the Argand plane.',
          'Multiply each argument by its power, then add (product) or subtract (quotient).',
          'Bring the total into $(-180^\\circ, 180^\\circ]$ by whole turns.'
        ],
        steps: [
          { h: 'Arguments of the bases', d: `$\\arg(${u.tex}) = ${u.arg}^\\circ$ and $\\arg(${v.tex}) = ${v.arg}^\\circ$` },
          { h: 'Combine', d: `$${p}(${u.arg}^\\circ) ${quotient ? '-' : '+'} ${qq}(${v.arg}^\\circ) = ${raw}^\\circ$` },
          { h: 'Reduce', d: `$${raw}^\\circ ${value > raw ? '+' : '-'} ${Math.abs(value - raw)}^\\circ = ${value}^\\circ$` },
          { h: 'Answer', d: `$${value}^\\circ$` }
        ],
        reasoning: 'principal-argument'
      };
    }
    const m = ri(rng, 1, 6), n = ri(rng, 1, 6);
    const E = m * u.lg + n * v.lg;               // |w|² = 2^E
    if (E > 16) continue;
    const arg = mod(m * u.arg + n * v.arg, 360);
    const COS = { 0: [1, 1], 60: [1, 2], 120: [-1, 2], 180: [-1, 1], 240: [-1, 2], 300: [1, 2] };
    const ROOT2 = { 45: 1, 135: -1, 225: -1, 315: 1 };
    let value;
    if (E % 2 === 0 && COS[arg]) value = R(COS[arg][0] * 2 ** (E / 2), COS[arg][1]);
    else if (E % 2 === 1 && ROOT2[arg]) value = R(ROOT2[arg] * 2 ** ((E - 1) / 2));
    else continue;
    const modulus = E % 2 === 0 ? `${2 ** (E / 2)}` : `${2 ** ((E - 1) / 2) === 1 ? '' : 2 ** ((E - 1) / 2)}\\sqrt{2}`;
    return {
      prompt: `Find the real part of $${pow(u, m)}${pow(v, n)}$.`,
      answerType: 'numeric', ...exact(value),
      traps: traps(value.value, [
        { value: -value.value, why: 'The size is right; recheck the quadrant of the total argument.' },
        { value: E % 2 === 0 ? 2 ** (E / 2) : 2 ** ((E - 1) / 2), why: 'That is the modulus (or its rational part); the real part is the modulus times the cosine of the argument.' }
      ]),
      hints: [
        'Write each base in polar form.',
        'Raise to the powers with De Moivre\'s theorem and multiply: moduli multiply, arguments add.',
        'The real part is the modulus times the cosine of the total argument.'
      ],
      steps: [
        { h: 'Polar forms', d: `$${u.tex} = ${u.lg === 1 ? '\\sqrt{2}' : '2'}\\left(\\cos(${u.arg}^\\circ) + i\\sin(${u.arg}^\\circ)\\right)$, $${v.tex} = ${v.lg === 1 ? '\\sqrt{2}' : '2'}\\left(\\cos(${v.arg}^\\circ) + i\\sin(${v.arg}^\\circ)\\right)$` },
        { h: 'Modulus', d: `$${u.lg === 1 ? '(\\sqrt{2})' : '2'}^{${m}} \\times ${v.lg === 1 ? '(\\sqrt{2})' : '2'}^{${n}} = ${modulus}$` },
        { h: 'Argument', d: `$${m}(${u.arg}^\\circ) + ${n}(${v.arg}^\\circ) = ${m * u.arg + n * v.arg}^\\circ$, which is $${arg}^\\circ$ after whole turns` },
        { h: 'Real part', d: `$${modulus}\\cos ${arg}^\\circ = ${rTex(value)}$` }
      ],
      reasoning: 'de-moivre'
    };
  }
  return complexPolarReasoning(makeRng(FALLBACK_SEED));
}

// ═════════════════════════════════════════════════════════════════════════════
// 7 · Permutations and Combinations — the fundamental principle of counting
// ═════════════════════════════════════════════════════════════════════════════

const nPr = (n, r) => { let p = 1; for (let i = 0; i < r; i++) p *= n - i; return r < 0 || r > n ? 0 : p; };
const nCr = (n, r) => (r < 0 || r > n ? 0 : Math.round(nPr(n, r) / nPr(r, r)));

function countingPrincipleReasoning(rng) {
  const kind = rc(rng, ['digits', 'complement', 'functions']);
  if (kind === 'digits') {
    for (let guard = 0; guard < 400; guard++) {
      const size = ri(rng, 5, 7);
      let S = rs(rng, [1, 2, 3, 4, 5, 6, 7, 8, 9]).slice(0, size - 1);
      S.push(rng() < 0.65 ? 0 : rc(rng, [1, 2, 3, 4, 5, 6, 7, 8, 9].filter(d => !S.includes(d))));
      S = [...new Set(S)].sort((x, y) => x - y);
      if (S.length !== size) continue;
      const k = rc(rng, [3, 4]), rep = rng() < 0.5;
      const cond = rc(rng, ['even', 'odd', 'div5']);
      const L = S.filter(d => (cond === 'even' ? d % 2 === 0 : cond === 'odd' ? d % 2 === 1 : d % 5 === 0));
      if (!L.length) continue;
      const D = rc(rng, S.filter(d => d >= 2));
      if (D === undefined) continue;
      const T = D * 10 ** (k - 1);
      const F = S.filter(d => d >= D);
      let count;
      if (rep) count = F.length * L.length * S.length ** (k - 2);
      else count = F.reduce((s, f) => s + L.filter(l => l !== f).length, 0) * nPr(S.length - 2, k - 2);
      const boundary = rep && S.includes(0) && cond !== 'odd' ? 1 : 0;   // T itself: first digit D, the rest zeros
      count -= boundary;
      if (count < 2) continue;
      const condText = cond === 'even' ? 'even' : cond === 'odd' ? 'odd' : 'divisible by $5$';
      const noOverlap = rep ? count : F.length * L.length * nPr(S.length - 2, k - 2);
      return {
        prompt: `How many ${k}-digit numbers greater than $${T}$ can be formed from the digits $${S.join(',\\ ')}$ ${rep ? '(a digit may be used more than once)' : '(no digit may be used more than once)'} that are ${condText}?`,
        answerType: 'numeric', answer: { value: count },
        traps: traps(count, [
          ...(boundary ? [{ value: count + 1, why: `$${T}$ itself can be formed and passes the divisibility test, but it is not greater than $${T}$.` }] : []),
          ...(!rep && noOverlap !== count ? [{ value: noOverlap, why: 'Without repetition, the last digit cannot repeat the first: when the first digit is itself one of the allowed last digits, there is one choice fewer for the last place.' }] : []),
          { value: S.filter(d => d !== 0).length * L.length * (rep ? S.length ** (k - 2) : nPr(S.length - 2, k - 2)), why: `Only first digits from $${D}$ upwards give a number greater than $${T}$.` }
        ]),
        hints: [
          'Fill the most restricted places first: the first digit (it decides how large the number is) and the last digit (it decides the divisibility).',
          rep ? 'With repetition allowed, every other place can take any of the digits.' : 'Without repetition, split into cases according to whether the first digit could also serve as the last digit.',
          'Check the boundary: is the number named in the question itself one that can be formed?'
        ],
        steps: [
          { h: 'First digit', d: `It must be at least $${D}$: $${F.join(',\\ ')}$ (${F.length} choices)` },
          { h: 'Last digit', d: `For a number that is ${condText}: $${L.join(',\\ ')}$` },
          rep
            ? { h: 'Middle places', d: `$${k - 2}$ place${k - 2 === 1 ? '' : 's'}, each with $${S.length}$ choices: $${F.length} \\times ${L.length} \\times ${S.length}^{${k - 2}} = ${count + boundary}$` }
            : { h: 'Cases', d: `First and last digits different: $${F.reduce((s, f) => s + L.filter(l => l !== f).length, 0)}$ pairs; the middle $${k - 2}$ place${k - 2 === 1 ? '' : 's'} from the remaining $${S.length - 2}$ digits in $${nPr(S.length - 2, k - 2)}$ ways — $${count}$ numbers` },
          { h: 'Boundary', d: boundary ? `$${T}$ itself was counted but is not greater than $${T}$: subtract $1$` : `$${T}$ itself ${rep && S.includes(0) ? 'is not counted' : 'cannot be formed'}, so nothing is subtracted` },
          { h: 'Answer', d: `$${count}$` }
        ],
        reasoning: 'first-and-last-digit'
      };
    }
  }
  if (kind === 'complement') {
    const k = rc(rng, [3, 4]);
    const total = 9 * 10 ** (k - 1);
    const d = ri(rng, 1, 9);
    const options = [
      { text: `contain at least one digit $${d}$`, none: 8 * 9 ** (k - 1), noneText: `with no digit $${d}$: $8 \\times 9^{${k - 1}}$`, loose: 10 ** k - 9 ** k },
      { text: 'contain at least one digit $0$', none: 9 ** k, noneText: `with no digit $0$: $9^{${k}}$`, loose: 10 ** k - 9 ** k },
      { text: 'contain at least one even digit', none: 5 ** k, noneText: `with every digit odd: $5^{${k}}$`, loose: 10 ** k - 5 ** k },
      { text: 'contain at least one odd digit', none: 4 * 5 ** (k - 1), noneText: `with every digit even (the first not $0$): $4 \\times 5^{${k - 1}}$`, loose: 10 ** k - 5 ** k },
      { text: 'do not have all their digits the same', none: 9, noneText: 'with all digits the same: $9$', loose: 10 ** k - 10 },
      { text: 'have no two neighbouring digits equal', none: null, loose: 10 * 9 ** (k - 1) }
    ];
    const o = rc(rng, options);
    const count = o.none === null ? 9 ** k : total - o.none;
    const direct = o.none === null;
    return {
      prompt: `How many ${k}-digit natural numbers ${o.text}?`,
      answerType: 'numeric', answer: { value: count },
      traps: traps(count, [
        { value: o.loose, why: `A ${k}-digit number cannot start with $0$; the count of digit strings of length $${k}$ includes ones that do.` },
        ...(direct ? [{ value: 9 * 10 ** (k - 1), why: 'That is every number with this many digits, with no restriction.' }]
          : [{ value: o.none, why: 'That counts the numbers WITHOUT the property — subtract it from the total.' }, { value: total, why: 'That is every number with this many digits.' }])
      ]),
      hints: [
        'The first digit of a number cannot be $0$; count place by place from the left.',
        direct ? 'Each place after the first only has to avoid the digit just before it.' : 'It is easier to count the numbers that do NOT have the property.',
        direct ? 'Multiply the numbers of choices for the places.' : 'Subtract that count from the count of all the numbers with this many digits.'
      ],
      steps: direct
        ? [
          { h: 'First digit', d: 'Any of $1$ to $9$: $9$ choices' },
          { h: 'Each later digit', d: 'Any digit except the one just before it: $9$ choices' },
          { h: 'Multiply', d: `$9 \\times 9^{${k - 1}} = 9^{${k}}$` },
          { h: 'Answer', d: `$${count}$` }
        ]
        : [
          { h: 'All the numbers', d: `$9 \\times 10^{${k - 1}} = ${total}$` },
          { h: 'The complement', d: `Numbers ${o.noneText} $= ${o.none}$` },
          { h: 'Subtract', d: `$${total} - ${o.none} = ${count}$` },
          { h: 'Answer', d: `$${count}$` }
        ],
      reasoning: direct ? 'product-rule' : 'complement'
    };
  }
  for (let guard = 0; guard < 400; guard++) {
    const m = ri(rng, 2, 4), n = ri(rng, m, 6);
    if (n ** m > 1296) continue;
    const forms = [
      { text: 'not one-one', count: n ** m - nPr(n, m), how: `All functions $${n}^{${m}} = ${n ** m}$; one-one functions $${n}\\times${n - 1}${m > 2 ? `\\times\\cdots\\times${n - m + 1}` : ''} = ${nPr(n, m)}$`, minus: true },
      { text: 'not constant', count: n ** m - n, how: `All functions $${n ** m}$; constant functions $${n}$`, minus: true },
      { text: 'one-one with $f(1) \\ne 1$', count: nPr(n, m) - nPr(n - 1, m - 1), how: `One-one functions $${nPr(n, m)}$; one-one with $f(1) = 1$: $${nPr(n - 1, m - 1)}$`, minus: true },
      {
        text: `one-one with $f(i) \\ne i$ for every $i$ in $A$`,
        count: Array.from({ length: m + 1 }, (_, j) => (j % 2 ? -1 : 1) * nCr(m, j) * nPr(n - j, m - j)).reduce((s, v) => s + v, 0),
        how: `Inclusion–exclusion over the elements fixed: $${Array.from({ length: m + 1 }, (_, j) => `${j % 2 ? '-' : j ? '+' : ''} ${nCr(m, j)} \\times ${nPr(n - j, m - j)}`).join(' ')}$`,
        minus: false
      }
    ];
    const f = rc(rng, forms);
    if (f.count < 2) continue;
    return {
      prompt: `Let $A = \\{1, 2, \\ldots, ${m}\\}$ and $B = \\{1, 2, \\ldots, ${n}\\}$. How many functions $f : A \\to B$ are ${f.text}?`,
      answerType: 'numeric', answer: { value: f.count },
      traps: traps(f.count, [
        { value: n ** m, why: `$${n}^{${m}}$ counts every function from $A$ to $B$.` },
        { value: m ** n, why: 'Each element of $A$ chooses an image in $B$, so the base is $n(B)$ and the exponent $n(A)$.' },
        { value: nPr(n, m), why: 'That is the number of one-one functions.' }
      ]),
      hints: [
        'A function assigns each element of $A$ one image in $B$; count the choices element by element.',
        'Counting the opposite of the condition is often easier — then subtract.',
        'For a condition on several elements at once, use inclusion–exclusion.'
      ],
      steps: [
        { h: 'All functions', d: `Each of the $${m}$ elements of $A$ has $${n}$ images: $${n}^{${m}} = ${n ** m}$` },
        { h: 'Count', d: f.how },
        { h: 'Combine', d: f.minus ? `Subtract to get $${f.count}$` : `Total $${f.count}$` },
        { h: 'Answer', d: `$${f.count}$` }
      ],
      reasoning: 'functions'
    };
  }
  return countingPrincipleReasoning(makeRng(FALLBACK_SEED));
}

// ═════════════════════════════════════════════════════════════════════════════
// 8 · Permutations and Combinations — arrangements with restrictions
// ═════════════════════════════════════════════════════════════════════════════

const PLACE_WORDS = ['DELHI', 'SURAT', 'KOCHI', 'INDORE', 'KANPUR', 'MYSORE', 'BHOPAL', 'RANCHI', 'JAIPUR', 'NAGPUR',
  'SHIMLA', 'ODISHA', 'PATNA', 'INDIA', 'MUMBAI', 'KERALA', 'GANGA', 'CHENNAI', 'MADURAI', 'KOLKATA', 'LUCKNOW', 'ASSAM', 'BIHAR', 'GOA', 'PUNE', 'TRIPURA', 'MANIPUR', 'NASHIK'];
const VOWELS = new Set(['A', 'E', 'I', 'O', 'U']);
const fact = n => (n <= 1 ? 1 : n * fact(n - 1));
/** Distinct arrangements of a multiset of letters. */
const multisetPerms = letters => {
  const counts = new Map();
  for (const l of letters) counts.set(l, (counts.get(l) || 0) + 1);
  return Math.round(fact(letters.length) / [...counts.values()].reduce((p, c) => p * fact(c), 1));
};
const repeatsTex = letters => {
  const counts = new Map();
  for (const l of letters) counts.set(l, (counts.get(l) || 0) + 1);
  const reps = [...counts.values()].filter(c => c > 1);
  return reps.length ? reps.map(c => `${c}!`).join('\\,') : '';
};
const permTex = letters => { const r = repeatsTex(letters); return r ? `\\dfrac{${letters.length}!}{${r}}` : `${letters.length}!`; };

function arrangementReasoning(rng) {
  const kind = rc(rng, ['rank', 'vowels', 'order']);
  for (let guard = 0; guard < 400; guard++) {
    const base = rc(rng, PLACE_WORDS);
    const letters = [...base];
    if (kind === 'rank') {
      if (letters.length < 5 || letters.length > 7) continue;
      const word = rs(rng, letters).join('');
      let rank = 1;
      const rest = [...word];
      const pieces = [];
      for (let i = 0; i < word.length; i++) {
        const here = rest.splice(rest.indexOf(word[i]), 1)[0];
        const smaller = [...new Set(rest.concat([here]).filter(l => l < here))].sort();
        let add = 0;
        for (const l of smaller) {
          const remaining = rest.concat([here]);
          remaining.splice(remaining.indexOf(l), 1);
          add += multisetPerms(remaining);
        }
        if (add) pieces.push({ at: i + 1, letter: here, smaller, add });
        rank += add;
      }
      if (rank < 3 || pieces.length < 2) continue;
      const total = multisetPerms(letters);
      const distinct = new Set(letters).size === letters.length;
      return {
        prompt: `All the arrangements of the letters of the word ${word}, with or without meaning, are written in dictionary order. What is the rank of ${word} in that list?`,
        answerType: 'numeric', answer: { value: rank },
        traps: traps(rank, [
          { value: rank - 1, why: `That is the number of arrangements that come BEFORE ${word}; its own rank is one more.` },
          { value: total - rank + 1, why: 'That counts from the end of the list. Dictionary order starts with the alphabetically smallest arrangement.' },
          ...(distinct ? [] : [{ value: 1 + pieces.reduce((s, p) => s + p.smaller.length * fact(word.length - p.at), 0), why: 'Repeated letters give identical arrangements; divide by the factorial of each repeat count.' }])
        ]),
        hints: [
          'Write the letters in alphabetical order.',
          'Count the arrangements that begin with a letter earlier than the first letter of the word; then fix the first letter and repeat for the second place, and so on.',
          'When letters repeat, divide by the factorial of each repeat count. Add one at the end for the word itself.'
        ],
        steps: [
          { h: 'Letters in order', d: `$${[...letters].sort().join(',\\ ')}$` },
          ...pieces.slice(0, 4).map(p => ({ h: `Place ${p.at}`, d: `Before $${p.letter}$: starting with $${p.smaller.join(',\\ ')}$ gives $${p.add}$ arrangements` })),
          ...(pieces.length > 4 ? [{ h: 'Later places', d: `$${pieces.slice(4).map(p => p.add).join(' + ')}$ more` }] : []),
          { h: 'Answer', d: `$${pieces.map(p => p.add).join(' + ')} + 1 = ${rank}$` }
        ],
        reasoning: 'dictionary-rank'
      };
    }
    const vowels = letters.filter(l => VOWELS.has(l)), cons = letters.filter(l => !VOWELS.has(l));
    if (vowels.length < 2 || letters.length < 5 || letters.length > 7) continue;
    const total = multisetPerms(letters);
    if (kind === 'vowels') {
      const apart = rng() < 0.6;
      if (apart && vowels.length > cons.length + 1) continue;
      const count = apart
        ? multisetPerms(cons) * nCr(cons.length + 1, vowels.length) * multisetPerms(vowels)
        : multisetPerms([...cons, '#']) * multisetPerms(vowels);
      if (count < 2) continue;
      return {
        prompt: `In how many of the distinct arrangements of the letters of the word ${base} are ${apart ? 'no two vowels next to each other' : 'all the vowels together'}?`,
        answerType: 'numeric', answer: { value: count },
        traps: traps(count, [
          { value: total, why: 'That is every distinct arrangement, with no restriction.' },
          { value: apart ? total - multisetPerms([...cons, '#']) * multisetPerms(vowels) : multisetPerms([...cons, '#']), why: apart ? '"Not all together" is not the same as "no two together": two vowels can sit side by side while a third is apart.' : 'The vowels inside the block can also be arranged among themselves.' },
          { value: apart ? fact(cons.length) * nPr(cons.length + 1, vowels.length) : fact(cons.length + 1) * fact(vowels.length), why: 'Repeated letters give identical arrangements; divide by the factorial of each repeat count.' }
        ]),
        hints: [
          `Sort the letters into vowels and consonants.`,
          apart ? 'Arrange the consonants first; the vowels then go into the gaps between and around them, at most one vowel to a gap.' : 'Glue the vowels into one block and arrange the block with the consonants.',
          'Arrange the vowels among themselves, and divide by the factorial of any repeated letter.'
        ],
        steps: [
          { h: 'Split the letters', d: `Vowels $${vowels.join(',\\ ')}$; consonants $${cons.join(',\\ ')}$` },
          apart
            ? { h: 'Consonants, then gaps', d: `Consonants: $${permTex(cons)} = ${multisetPerms(cons)}$ ways; they leave $${cons.length + 1}$ gaps, of which $${vowels.length}$ are chosen in $\\binom{${cons.length + 1}}{${vowels.length}} = ${nCr(cons.length + 1, vowels.length)}$ ways` }
            : { h: 'The block', d: `The vowel block and $${cons.length}$ consonants: $${permTex([...cons, '#'])} = ${multisetPerms([...cons, '#'])}$ ways` },
          { h: 'Vowels among themselves', d: `$${permTex(vowels)} = ${multisetPerms(vowels)}$` },
          { h: 'Answer', d: apart ? `$${multisetPerms(cons)} \\times ${nCr(cons.length + 1, vowels.length)} \\times ${multisetPerms(vowels)} = ${count}$` : `$${multisetPerms([...cons, '#'])} \\times ${multisetPerms(vowels)} = ${count}$` }
        ],
        reasoning: apart ? 'gap-method' : 'block-method'
      };
    }
    const orders = multisetPerms(vowels);
    if (orders < 2) continue;
    const count = total / orders;
    return {
      prompt: `In how many of the distinct arrangements of the letters of the word ${base} do the vowels appear in alphabetical order from left to right (not necessarily next to each other)?`,
      answerType: 'numeric', answer: { value: count },
      traps: traps(count, [
        { value: total, why: 'That is every distinct arrangement; only one ordering of the vowels is allowed.' },
        ...(Number.isInteger(total / fact(vowels.length)) ? [{ value: total / fact(vowels.length), why: 'When a vowel repeats, the vowels have fewer than $v!$ different orders among themselves — divide by the number of DISTINCT orders.' }] : []),
        { value: multisetPerms([...cons, '#']) * 1, why: 'The vowels need not be together; they only have to keep their order.' }
      ]),
      hints: [
        'Group the arrangements by where the vowels sit, ignoring which vowel is which.',
        'Each such group contains every possible order of the vowels exactly once.',
        'Only one of those orders is alphabetical, so divide the total by the number of distinct vowel orders.'
      ],
      steps: [
        { h: 'All arrangements', d: `$${permTex(letters)} = ${total}$` },
        { h: 'Orders of the vowels', d: `The vowels $${vowels.join(',\\ ')}$ can be ordered in $${permTex(vowels)} = ${orders}$ distinct ways` },
        { h: 'One order is alphabetical', d: `Each placement of the vowels occurs once in every vowel order` },
        { h: 'Answer', d: `$\\dfrac{${total}}{${orders}} = ${count}$` }
      ],
      reasoning: 'fixed-order'
    };
  }
  return arrangementReasoning(makeRng(FALLBACK_SEED));
}

// ═════════════════════════════════════════════════════════════════════════════
// 9 · Sequences and Series — arithmetic progressions used backwards
// ═════════════════════════════════════════════════════════════════════════════

const ORD = n => `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] || 'th'}`;
const lcmOf = (a, b) => Math.abs(a * b) / gcd(a, b);
/** Sum of the multiples of p from L to U inclusive, with the AP's first, last and count. */
function multiplesIn(p, L, U) {
  const first = Math.ceil(L / p) * p, last = Math.floor(U / p) * p;
  if (last < first) return { first, last, count: 0, sum: 0 };
  const count = (last - first) / p + 1;
  return { first, last, count, sum: (count * (first + last)) / 2 };
}

function apReasoning(rng) {
  const kind = rc(rng, ['ratio-of-terms', 'divisible-sum', 'common-terms']);
  for (let guard = 0; guard < 400; guard++) {
    if (kind === 'ratio-of-terms') {
      const a = ri(rng, 1, 9), c = ri(rng, 1, 9), b = ri(rng, -3, 30), d = ri(rng, -3, 30);
      if (a + b <= 0 || c + d <= 0 || a * d === b * c) continue;
      const m = ri(rng, 3, 20), n = 2 * m - 1;
      const value = R(a * n + b, c * n + d);
      const atM = R(a * m + b, c * m + d);
      if (value.value === atM.value) continue;
      return {
        prompt: `The sums of the first $n$ terms of two arithmetic progressions are in the ratio $(${lin(a, b, 'n')}) : (${lin(c, d, 'n')})$ for every $n$. If $t_{${m}}$ and $t'_{${m}}$ are their ${ORD(m)} terms, find $\\dfrac{t_{${m}}}{t'_{${m}}}$.`,
        answerType: 'numeric', ...exact(value),
        traps: traps(value.value, [
          { value: atM.value, why: `That is the ratio of the SUMS of the first $${m}$ terms. Terms and sums are matched at a different $n$.` },
          { value: R(a * (2 * m + 1) + b, c * (2 * m + 1) + d).value, why: `The $${m}$th term is $a + ${m - 1}d$, which matches $a + \\dfrac{n - 1}{2}d$ when $n = ${2 * m - 1}$, not $${2 * m + 1}$.` },
          { value: R(c * n + d, a * n + b).value, why: 'The ratio has been inverted.' }
        ]),
        hints: [
          'Write each sum as $\\dfrac{n}{2}\\left[2a + (n - 1)d\\right]$; the ratio of the sums is then the ratio of $a + \\dfrac{n - 1}{2}d$ for the two progressions.',
          'A term is $a + (m - 1)d$. Choose $n$ so that $\\dfrac{n - 1}{2} = m - 1$.',
          'Substitute that value of $n$ in the given ratio.'
        ],
        steps: [
          { h: 'Ratio of sums', d: `$\\dfrac{a + \\frac{n-1}{2}d}{a' + \\frac{n-1}{2}d'} = \\dfrac{${lin(a, b, 'n')}}{${lin(c, d, 'n')}}$` },
          { h: 'Ratio of terms', d: `$\\dfrac{t_{${m}}}{t'_{${m}}} = \\dfrac{a + ${m - 1}d}{a' + ${m - 1}d'}$, which is the left side with $\\dfrac{n - 1}{2} = ${m - 1}$` },
          { h: 'Choose n', d: `$n = ${n}$` },
          { h: 'Substitute', d: `$\\dfrac{${a}(${n}) ${sg(b)}}{${c}(${n}) ${sg(d)}} = \\dfrac{${a * n + b}}{${c * n + d}} = ${rTex(value)}$` }
        ],
        reasoning: 'ratio-of-terms'
      };
    }
    if (kind === 'divisible-sum') {
      const p = ri(rng, 2, 9);
      const qq = rng() < 0.5 ? p * ri(rng, 2, 5) : rc(rng, [2, 3, 4, 5, 6, 7, 8, 9].filter(x => x !== p && x % p !== 0 && p % x !== 0));
      if (!qq) continue;
      const L = ri(rng, 1, 60), U = ri(rng, 200, 600);
      const l = lcmOf(p, qq);
      const P = multiplesIn(p, L, U), B = multiplesIn(l, L, U), Qm = multiplesIn(qq, L, U);
      if (B.count < 2 || P.count < 4) continue;
      const value = P.sum - B.sum;
      return {
        prompt: `Find the sum of all the integers from $${L}$ to $${U}$, both included, that are divisible by $${p}$ but not by $${qq}$.`,
        answerType: 'numeric', answer: { value },
        traps: traps(value, [
          { value: P.sum, why: `That is every multiple of $${p}$; the ones divisible by $${qq}$ still have to be removed.` },
          ...(l !== qq ? [{ value: P.sum - Qm.sum, why: `Only the multiples of $${p}$ that are ALSO multiples of $${qq}$ are removed — those are the multiples of $${l}$, not every multiple of $${qq}$.` }] : []),
          { value: multiplesIn(p, L + 1, U - 1).sum - multiplesIn(l, L + 1, U - 1).sum, why: 'Both ends of the range are included: check whether they are multiples themselves.' }
        ]),
        hints: [
          'The multiples of a number between two limits form an arithmetic progression.',
          'A number divisible by both is a multiple of their least common multiple.',
          'Sum each progression with $\\dfrac{n}{2}(\\text{first} + \\text{last})$, then subtract.'
        ],
        steps: [
          { h: `Multiples of ${p}`, d: `$${P.first}, ${P.first + p}, \\ldots, ${P.last}$: $${P.count}$ terms, sum $\\dfrac{${P.count}}{2}(${P.first} + ${P.last}) = ${P.sum}$` },
          { h: 'Divisible by both', d: `Multiples of $\\operatorname{lcm}(${p}, ${qq}) = ${l}$: $${B.first}, \\ldots, ${B.last}$, $${B.count}$ terms, sum $${B.sum}$` },
          { h: 'Subtract', d: `$${P.sum} - ${B.sum} = ${value}$` },
          { h: 'Answer', d: `$${value}$` }
        ],
        reasoning: 'inclusion-exclusion'
      };
    }
    const a1 = ri(rng, 1, 20), d1 = ri(rng, 2, 9), a2 = ri(rng, 1, 20), d2 = ri(rng, 2, 9);
    if (d1 === d2) continue;
    const N1 = rc(rng, [40, 50, 60, 80, 100]), N2 = rc(rng, [40, 50, 60, 80, 100]);
    const last1 = a1 + (N1 - 1) * d1, last2 = a2 + (N2 - 1) * d2;
    let first = null;
    for (let i = 0; i < N1 && first === null; i++) {
      const v = a1 + i * d1;
      if (v >= a2 && (v - a2) % d2 === 0 && (v - a2) / d2 < N2) first = v;
    }
    if (first === null) continue;
    const l = lcmOf(d1, d2), bound = Math.min(last1, last2);
    const count = Math.floor((bound - first) / l) + 1;
    if (count < 3) continue;
    const askSum = rng() < 0.5;
    const sum = (count * (2 * first + (count - 1) * l)) / 2;
    const value = askSum ? sum : count;
    const naiveCount = Math.floor((Math.max(last1, last2) - first) / l) + 1;
    return {
      prompt: `The arithmetic progressions $${a1}, ${a1 + d1}, ${a1 + 2 * d1}, \\ldots$ and $${a2}, ${a2 + d2}, ${a2 + 2 * d2}, \\ldots$ have $${N1}$ and $${N2}$ terms respectively. ${askSum ? 'Find the sum of the terms common to both.' : 'How many terms do they have in common?'}`,
      answerType: 'numeric', answer: { value },
      traps: traps(value, [
        { value: askSum ? (naiveCount * (2 * first + (naiveCount - 1) * l)) / 2 : naiveCount, why: 'The last common term cannot exceed the SMALLER of the two last terms.' },
        { value: askSum ? sum - first : count - 1, why: 'Count both ends: from the first common term to the last there are (difference ÷ step) + 1 terms.' },
        { value: askSum ? (count * (2 * first + (count - 1) * d1 * d2)) / 2 : Math.floor((bound - first) / (d1 * d2)) + 1, why: `The common terms step by $\\operatorname{lcm}(${d1}, ${d2}) = ${l}$, not by $${d1} \\times ${d2}$.` }
      ]),
      hints: [
        'Find the first number that appears in both progressions.',
        'From there the common terms form an arithmetic progression whose common difference is the LCM of the two common differences.',
        'The last common term cannot exceed the smaller of the two last terms.'
      ],
      steps: [
        { h: 'Last terms', d: `$${a1} + ${N1 - 1}(${d1}) = ${last1}$ and $${a2} + ${N2 - 1}(${d2}) = ${last2}$` },
        { h: 'First common term', d: `$${first}$` },
        { h: 'Common difference', d: `$\\operatorname{lcm}(${d1}, ${d2}) = ${l}$; the common terms are $${first}, ${first + l}, \\ldots$ up to $${bound}$` },
        { h: 'Count', d: `$\\left\\lfloor\\dfrac{${bound} - ${first}}{${l}}\\right\\rfloor + 1 = ${count}$ terms` },
        { h: 'Answer', d: askSum ? `$\\dfrac{${count}}{2}\\left[2(${first}) + ${count - 1}(${l})\\right] = ${sum}$` : `$${count}$` }
      ],
      reasoning: 'common-terms'
    };
  }
  return apReasoning(makeRng(FALLBACK_SEED));
}

// ═════════════════════════════════════════════════════════════════════════════
// 10 · Straight Lines — equations fixed by a condition
// ═════════════════════════════════════════════════════════════════════════════

const ptTex = (name, x, y) => `${name}(${x}, ${y})`;

function lineEquationReasoning(rng) {
  const kind = rc(rng, ['section', 'least-area', 'reflection']);
  for (let guard = 0; guard < 400; guard++) {
    if (kind === 'section') {
      const h = nz(rng, -9, 9), k = nz(rng, -9, 9), m = ri(rng, 1, 5), n = ri(rng, 1, 5);
      if (m === n && rng() < 0.7) continue;
      const a = R(h * (m + n), n), b = R(k * (m + n), m);
      const askSlope = rng() < 0.5;
      const value = askSlope ? R(-b.n * a.d, b.d * a.n) : add(a, b);
      const swappedA = R(h * (m + n), m), swappedB = R(k * (m + n), n);
      if (value.n === 0) continue;
      return {
        prompt: `A straight line through $${ptTex('P', h, k)}$ meets the $x$-axis at $A$ and the $y$-axis at $B$, and $P$ divides $AB$ internally in the ratio $AP : PB = ${m} : ${n}$. Find ${askSlope ? 'the slope of the line' : 'the sum of the intercepts the line makes on the two axes'}.`,
        answerType: 'numeric', ...exact(value),
        traps: traps(value.value, [
          { value: askSlope ? R(-swappedB.n * swappedA.d, swappedB.d * swappedA.n).value : add(swappedA, swappedB).value, why: 'The ratio has been applied the wrong way round: in the section formula the weight on $A$ is the part next to $B$.' },
          { value: askSlope ? R(-k, h).value : 2 * (h + k), why: 'That would be right only if $P$ were the midpoint of $AB$.' },
          { value: -value.value, why: 'Check the signs of the intercepts against the quadrant of $P$.' }
        ]),
        hints: [
          'Let $A = (a, 0)$ and $B = (0, b)$, so the line is $bx + ay = ab$.',
          'Write the point dividing $AB$ in the given ratio by the section formula.',
          'Equate it to $P$ to find $a$ and $b$.'
        ],
        steps: [
          { h: 'Section formula', d: `The point dividing $AB$ in the ratio $${m} : ${n}$ is $\\left(\\dfrac{${n}a}{${m + n}}, \\dfrac{${m}b}{${m + n}}\\right)$` },
          { h: 'Equate with P', d: `$\\dfrac{${n}a}{${m + n}} = ${h} \\Rightarrow a = ${rTex(a)}$ and $\\dfrac{${m}b}{${m + n}} = ${k} \\Rightarrow b = ${rTex(b)}$` },
          { h: 'The line', d: `$\\dfrac{x}{${rTex(a)}} + \\dfrac{y}{${rTex(b)}} = 1$` },
          { h: 'Answer', d: askSlope ? `Slope $= -\\dfrac{b}{a} = ${rTex(value)}$` : `$a + b = ${rTex(a)} + ${rTex(b)} = ${rTex(value)}$` }
        ],
        reasoning: 'section-intercepts'
      };
    }
    if (kind === 'least-area') {
      const askArea = rng() < 0.5;
      const u = ri(rng, 1, 6), v = ri(rng, 1, 6);
      const h = askArea ? ri(rng, 1, 12) : u * u, k = askArea ? ri(rng, 1, 12) : v * v;
      if (h === k && rng() < 0.6) continue;
      const value = askArea ? 2 * h * k : (u + v) * (u + v);
      return {
        prompt: `A straight line passes through $${ptTex('P', h, k)}$ and meets the positive $x$-axis at $A$ and the positive $y$-axis at $B$. Find the least possible ${askArea ? 'area of triangle $OAB$, where $O$ is the origin' : 'value of $OA + OB$, where $O$ is the origin'}.`,
        answerType: 'numeric', answer: { value },
        traps: traps(value, askArea
          ? [{ value: h * k, why: 'That is half the least area — the triangle has legs $2h$ and $2k$ at the minimum, so its area is $\\dfrac{1}{2}(2h)(2k)$.' },
            { value: 4 * h * k, why: 'The area of a right triangle is half the product of its legs.' },
            { value: h + k, why: 'That is not an area; express the area through one variable and minimise it.' }]
          : [{ value: h + k, why: 'The intercepts are not $h$ and $k$; the sum is least when $a = h + \\sqrt{hk}$ and $b = k + \\sqrt{hk}$.' },
            { value: 2 * (h + k), why: 'Doubling the coordinates gives the least AREA, not the least sum of intercepts.' },
            { value: (u + v) * (u + v) + 2 * u * v, why: 'Recheck the AM–GM step: the cross term is $2\\sqrt{hk}$.' }]),
        hints: [
          'Write the line in intercept form $\\dfrac{x}{a} + \\dfrac{y}{b} = 1$ with $a, b > 0$; it passes through $P$.',
          askArea ? 'The area is $\\dfrac{1}{2}ab$. Use the condition from $P$ to bound $ab$ from below.' : 'Write $a + b = (a + b)\\left(\\dfrac{h}{a} + \\dfrac{k}{b}\\right)$ and expand.',
          'Apply the AM–GM inequality, and check when equality holds.'
        ],
        steps: askArea
          ? [
            { h: 'Condition', d: `$\\dfrac{${h}}{a} + \\dfrac{${k}}{b} = 1$` },
            { h: 'AM–GM', d: `$1 = \\dfrac{${h}}{a} + \\dfrac{${k}}{b} \\ge 2\\sqrt{\\dfrac{${h * k}}{ab}} \\Rightarrow ab \\ge ${4 * h * k}$` },
            { h: 'Equality', d: `when $\\dfrac{${h}}{a} = \\dfrac{${k}}{b} = \\dfrac{1}{2}$, i.e. $a = ${2 * h}$, $b = ${2 * k}$` },
            { h: 'Least area', d: `$\\dfrac{1}{2}ab = \\dfrac{1}{2}(${2 * h})(${2 * k}) = ${value}$` }
          ]
          : [
            { h: 'Condition', d: `$\\dfrac{${h}}{a} + \\dfrac{${k}}{b} = 1$` },
            { h: 'Rewrite the sum', d: `$a + b = (a + b)\\left(\\dfrac{${h}}{a} + \\dfrac{${k}}{b}\\right) = ${h} + ${k} + \\dfrac{${h}b}{a} + \\dfrac{${k}a}{b}$` },
            { h: 'AM–GM', d: `$\\dfrac{${h}b}{a} + \\dfrac{${k}a}{b} \\ge 2\\sqrt{${h * k}} = ${2 * u * v}$, with equality when $\\dfrac{b}{a} = ${rTex(R(v, u))}$` },
            { h: 'Least value', d: `$${h} + ${k} + ${2 * u * v} = ${value}$` }
          ],
        reasoning: askArea ? 'least-area' : 'least-intercept-sum'
      };
    }
    const onX = rng() < 0.5;
    const s1 = ri(rng, 1, 9), s2 = ri(rng, 1, 9), t1 = ri(rng, -9, 9), t2 = ri(rng, -9, 9);
    if (t1 === t2) continue;
    // On the x-axis mirror the coordinates are (t, s) with s > 0; on the y-axis, (s, t).
    const value = R(t1 * s2 + t2 * s1, s1 + s2);
    const A = onX ? [t1, s1] : [s1, t1], B = onX ? [t2, s2] : [s2, t2];
    const axis = onX ? 'x' : 'y';
    const mid = R(t1 + t2, 2);
    if (value.value === mid.value) continue;
    return {
      prompt: `A ray of light from $${ptTex('A', A[0], A[1])}$ is reflected at a point $R$ on the $${axis}$-axis, and the reflected ray passes through $${ptTex('B', B[0], B[1])}$. Find the $${axis}$-coordinate of $R$.`,
      answerType: 'numeric', ...exact(value),
      traps: traps(value.value, [
        { value: mid.value, why: 'The mirror point is not halfway along: it divides the gap in the ratio of the distances of $A$ and $B$ from the mirror.' },
        { value: R(t1 * s1 + t2 * s2, s1 + s2).value, why: 'The weights are the wrong way round: the point is closer to whichever of $A$ and $B$ is nearer the mirror.' }
      ]),
      hints: [
        'The angle of incidence equals the angle of reflection, so $R$, $A$ and the mirror image of $B$ are collinear.',
        `Reflect $B$ in the $${axis}$-axis by changing the sign of its ${onX ? '$y$' : '$x$'}-coordinate.`,
        `Find where the line through $A$ and that image crosses the $${axis}$-axis.`
      ],
      steps: [
        { h: 'Mirror image', d: `$B' = ${onX ? `(${t2}, ${-s2})` : `(${-s2}, ${t2})`}$` },
        { h: 'Line through A and B\'', d: `It crosses the $${axis}$-axis where it divides $AB'$ in the ratio $${s1} : ${s2}$` },
        { h: 'Section formula', d: `$${axis} = \\dfrac{${s2}(${t1}) + ${s1}(${t2})}{${s1} + ${s2}} = ${rTex(value)}$` },
        { h: 'Answer', d: `$R = ${onX ? `\\left(${rTex(value)}, 0\\right)` : `\\left(0, ${rTex(value)}\\right)`}$` }
      ],
      reasoning: 'reflected-ray'
    };
  }
  return lineEquationReasoning(makeRng(FALLBACK_SEED));
}

// ═════════════════════════════════════════════════════════════════════════════
// 11 · Straight Lines — angles, parallels and perpendiculars
// ═════════════════════════════════════════════════════════════════════════════

/** "ax + by + c = 0" written the way it is read. */
function lineTex(a, b, c) {
  let out = a === 0 ? '' : cx(a);
  if (b !== 0) out += out ? ` ${b < 0 ? '-' : '+'} ${Math.abs(b) === 1 ? '' : Math.abs(b)}y` : cx(b, 'y');
  if (c !== 0) out += ` ${sg(c)}`;
  return `${out} = 0`;
}
const TANS = [R(1), R(1, 2), R(1, 3), R(2), R(3), R(2, 3), R(3, 4), R(3, 2), R(4, 3)];

function lineAngleReasoning(rng) {
  const kind = rc(rng, ['angle', 'orthocentre', 'image']);
  for (let guard = 0; guard < 2000; guard++) {
    if (kind === 'angle') {
      const a = nz(rng, -6, 6), b = nz(rng, -6, 6), c = ri(rng, -9, 9);
      if (gcd(gcd(a, b), c || a) !== 1) continue;
      const m = R(-a, b), t = rc(rng, TANS);
      const mt = mul(m, t);
      if (Math.abs(mt.value) === 1 || m.n === 0) continue;
      const s1 = div(add(m, t), sub(R(1), mt)), s2 = div(sub(m, t), add(R(1), mt));
      const h = ri(rng, -6, 6), k = ri(rng, -6, 6);
      const askProduct = rng() < 0.5;
      const value = askProduct ? mul(s1, s2) : sub(R(2 * k), mul(R(h), add(s1, s2)));
      if (value.n === 0 && !askProduct) continue;
      const thetaTex = t.n === 1 && t.d === 1 ? '\\theta = 45^\\circ' : `\\tan\\theta = ${rTex(t)}`;
      return {
        prompt: `Two straight lines pass through $${ptTex('P', h, k)}$, and each makes an angle $\\theta$ with the line $${lineTex(a, b, c)}$, where $${thetaTex}$. Find ${askProduct ? 'the product of their slopes' : 'the sum of their $y$-intercepts'}.`,
        answerType: 'numeric', ...exact(value),
        traps: traps(value.value, askProduct
          ? [{ value: sub(mul(m, m), mul(t, t)).value, why: 'The slopes are not $m \\pm \\tan\\theta$; they come from $\\tan\\theta = \\left|\\dfrac{s - m}{1 + sm}\\right|$.' },
            { value: mul(m, m).value, why: 'Both lines cannot have the slope of the given line; that line makes angle $0$ with itself.' },
            { value: -1, why: 'The two lines are not perpendicular to each other in general.' }]
          : [{ value: R(2 * k).value, why: 'The intercept of each line is $k - sh$, not $k$; the slopes matter.' },
            { value: add(R(2 * k), mul(R(h), add(s1, s2))).value, why: 'A line of slope $s$ through $(h, k)$ is $y - k = s(x - h)$: its $y$-intercept is $k - sh$.' }]),
        hints: [
          'Find the slope $m$ of the given line from its equation.',
          'A line of slope $s$ makes angle $\\theta$ with it when $\\tan\\theta = \\left|\\dfrac{s - m}{1 + sm}\\right|$; the two signs give two slopes.',
          askProduct ? 'Multiply the two slopes you find.' : 'A line of slope $s$ through $(h, k)$ has $y$-intercept $k - sh$; add the two.'
        ],
        steps: [
          { h: 'Slope of the given line', d: `$m = ${rTex(m)}$` },
          { h: 'The two slopes', d: `$\\dfrac{s - m}{1 + sm} = \\pm${rTex(t)}$ gives $s_1 = \\dfrac{m + ${rTex(t)}}{1 - ${rTex(t)}m} = ${rTex(s1)}$ and $s_2 = \\dfrac{m - ${rTex(t)}}{1 + ${rTex(t)}m} = ${rTex(s2)}$` },
          { h: askProduct ? 'Product' : 'Intercepts', d: askProduct ? `$s_1 s_2 = ${rTex(value)}$` : `$(${k} - ${par(h)}s_1) + (${k} - ${par(h)}s_2) = ${2 * k} - ${par(h)}(s_1 + s_2)$` },
          { h: 'Answer', d: `$${rTex(value)}$` }
        ],
        reasoning: 'angle-between-lines'
      };
    }
    if (kind === 'orthocentre') {
      const A = [ri(rng, -6, 6), ri(rng, -6, 6)], B = [ri(rng, -6, 6), ri(rng, -6, 6)], C = [ri(rng, -6, 6), ri(rng, -6, 6)];
      const cross = (B[0] - A[0]) * (C[1] - A[1]) - (B[1] - A[1]) * (C[0] - A[0]);
      if (cross === 0) continue;
      // (H − A)·(B − C) = 0 and (H − B)·(C − A) = 0, by Cramer's rule.
      const u = [B[0] - C[0], B[1] - C[1]], w = [C[0] - A[0], C[1] - A[1]];
      const r1 = u[0] * A[0] + u[1] * A[1], r2 = w[0] * B[0] + w[1] * B[1];
      const det = u[0] * w[1] - u[1] * w[0];
      const hx = (r1 * w[1] - u[1] * r2) / det, hy = (u[0] * r2 - r1 * w[0]) / det;
      if (!Number.isInteger(hx) || !Number.isInteger(hy)) continue;
      if ([A, B, C].some(P => P[0] === hx && P[1] === hy)) continue;
      return {
        prompt: `Find the orthocentre of the triangle with vertices $${ptTex('A', A[0], A[1])}$, $${ptTex('B', B[0], B[1])}$ and $${ptTex('C', C[0], C[1])}$. Give it as a point.`,
        answerType: 'point', answer: { x: hx, y: hy },
        hints: [
          'The orthocentre is the point where the altitudes meet.',
          'The altitude from $A$ is perpendicular to $BC$: the vector from $A$ to any point on it has zero dot product with $\\overrightarrow{BC}$.',
          'Write two altitudes as equations and solve them together.'
        ],
        steps: [
          { h: 'Altitude from A', d: `$\\overrightarrow{AH} \\cdot \\overrightarrow{CB} = 0$ with $\\overrightarrow{CB} = (${u[0]}, ${u[1]})$: $${lineTex(u[0], u[1], -r1)}$` },
          { h: 'Altitude from B', d: `$\\overrightarrow{BH} \\cdot \\overrightarrow{AC} = 0$ with $\\overrightarrow{AC} = (${w[0]}, ${w[1]})$: $${lineTex(w[0], w[1], -r2)}$` },
          { h: 'Solve together', d: `$x = ${hx}$, $y = ${hy}$` },
          { h: 'Answer', d: `$H(${hx}, ${hy})$` }
        ],
        reasoning: 'orthocentre'
      };
    }
    const a = nz(rng, -4, 4), b = nz(rng, -4, 4);
    if (gcd(a, b) !== 1) continue;
    const t = nz(rng, -3, 3);
    if ((t * (a * a + b * b)) % 2) continue;
    const x0 = ri(rng, -6, 6), y0 = ri(rng, -6, 6);
    const c = (t * (a * a + b * b)) / 2 - (a * x0 + b * y0);
    if (Math.abs(c) > 30) continue;
    const ix = x0 - t * a, iy = y0 - t * b;
    const fx = x0 - (t * a) / 2, fy = y0 - (t * b) / 2;
    return {
      prompt: `Find the image of the point $${ptTex('P', x0, y0)}$ in the line $${lineTex(a, b, c)}$. Give it as a point.`,
      answerType: 'point', answer: { x: ix, y: iy },
      hints: [
        'The segment joining $P$ to its image is perpendicular to the line, so it runs along the normal direction $(a, b)$.',
        'Its midpoint lies on the line.',
        'Write the image as $P - \\lambda(a, b)$, put the midpoint into the equation of the line, and solve for $\\lambda$.'
      ],
      steps: [
        { h: 'Along the normal', d: `The normal direction is $(${a}, ${b})$, so the image is $(${x0} ${sg(-a)}\\lambda,\\ ${y0} ${sg(-b)}\\lambda)$ for some $\\lambda$` },
        { h: 'Midpoint on the line', d: `Putting the midpoint $\\left(${x0} - \\dfrac{${a}\\lambda}{2},\\ ${y0} - \\dfrac{${b}\\lambda}{2}\\right)$ into the line gives $\\lambda = \\dfrac{2(${a * x0 + b * y0 + c})}{${a * a + b * b}} = ${t}$` },
        { h: 'Foot of the perpendicular', d: `$\\left(${rTex(R(2 * fx, 2))}, ${rTex(R(2 * fy, 2))}\\right)$` },
        { h: 'Answer', d: `$(${ix}, ${iy})$` }
      ],
      reasoning: 'mirror-image'
    };
  }
  return lineAngleReasoning(makeRng(FALLBACK_SEED));
}

// ═════════════════════════════════════════════════════════════════════════════
// 12 · Limits and Derivatives — limits that need two standard results at once
// ═════════════════════════════════════════════════════════════════════════════

const cosTex = (k, v = 'x') => `\\cos ${k === 1 ? '' : k}${v}`;
const sinTex = (k, v = 'x') => `\\sin ${k === 1 ? '' : k}${v}`;
const tanTex = (k, v = 'x') => `\\tan ${k === 1 ? '' : k}${v}`;
const LIM0 = '\\displaystyle\\lim_{x \\to 0}';

function limitReasoning(rng) {
  const kind = rc(rng, ['cosines', 'tan-minus-sin', 'infinity', 'rationalise']);
  for (let guard = 0; guard < 400; guard++) {
    if (kind === 'cosines') {
      const form = rc(rng, ['two', 'three', 'over-sin', 'difference']);
      const [a, b, c] = rs(rng, [1, 2, 3, 4, 5, 6]).slice(0, 3);
      let tex, value, wrong, steps;
      if (form === 'two') {
        tex = `\\dfrac{1 - ${cosTex(a)}${cosTex(b)}}{x^2}`;
        value = R(a * a + b * b, 2); wrong = R((a + b) * (a + b), 2);
        steps = [
          { h: 'Split', d: `$1 - ${cosTex(a)}${cosTex(b)} = (1 - ${cosTex(a)}) + ${cosTex(a)}(1 - ${cosTex(b)})$` },
          { h: 'Standard limit', d: '$\\dfrac{1 - \\cos kx}{x^2} \\to \\dfrac{k^2}{2}$ as $x \\to 0$, and $\\cos kx \\to 1$' },
          { h: 'Add', d: `$\\dfrac{${a * a}}{2} + 1 \\times \\dfrac{${b * b}}{2}$` },
          { h: 'Answer', d: `$${rTex(value)}$` }
        ];
      } else if (form === 'three') {
        tex = `\\dfrac{1 - ${cosTex(a)}${cosTex(b)}${cosTex(c)}}{x^2}`;
        value = R(a * a + b * b + c * c, 2); wrong = R(a * a * b * b * c * c, 2);
        steps = [
          { h: 'Split', d: `$1 - ${cosTex(a)}${cosTex(b)}${cosTex(c)} = (1 - ${cosTex(a)}) + ${cosTex(a)}(1 - ${cosTex(b)}) + ${cosTex(a)}${cosTex(b)}(1 - ${cosTex(c)})$` },
          { h: 'Standard limit', d: '$\\dfrac{1 - \\cos kx}{x^2} \\to \\dfrac{k^2}{2}$ as $x \\to 0$, and each $\\cos kx \\to 1$' },
          { h: 'Add', d: `$\\dfrac{${a * a}}{2} + \\dfrac{${b * b}}{2} + \\dfrac{${c * c}}{2}$` },
          { h: 'Answer', d: `$${rTex(value)}$` }
        ];
      } else if (form === 'over-sin') {
        tex = `\\dfrac{1 - ${cosTex(a)}}{x\\,${sinTex(b)}}`;
        value = R(a * a, 2 * b); wrong = R(a, 2 * b);
        steps = [
          { h: 'Rearrange', d: `$\\dfrac{1 - ${cosTex(a)}}{x^2} \\cdot \\dfrac{x}{${sinTex(b)}}$` },
          { h: 'First factor', d: `$\\to \\dfrac{${a * a}}{2}$` },
          { h: 'Second factor', d: `$\\dfrac{x}{${sinTex(b)}} \\to \\dfrac{1}{${b}}$` },
          { h: 'Answer', d: `$\\dfrac{${a * a}}{2} \\times \\dfrac{1}{${b}} = ${rTex(value)}$` }
        ];
      } else {
        tex = `\\dfrac{${cosTex(a)} - ${cosTex(b)}}{x^2}`;
        value = R(b * b - a * a, 2); wrong = R(a * a - b * b, 2);
        steps = [
          { h: 'Rewrite', d: `$${cosTex(a)} - ${cosTex(b)} = (1 - ${cosTex(b)}) - (1 - ${cosTex(a)})$` },
          { h: 'Standard limit', d: '$\\dfrac{1 - \\cos kx}{x^2} \\to \\dfrac{k^2}{2}$ as $x \\to 0$' },
          { h: 'Subtract', d: `$\\dfrac{${b * b}}{2} - \\dfrac{${a * a}}{2}$` },
          { h: 'Answer', d: `$${rTex(value)}$` }
        ];
      }
      // The hints quote the standard limits 1/2 and 1: a draw whose answer is
      // one of them would have a hint state the result, so it is redrawn.
      if (value.value === 0.5 || value.value === 1) continue;
      return {
        prompt: `Evaluate $${LIM0} ${tex}$.`,
        answerType: 'numeric', ...exact(value),
        traps: traps(value.value, [
          { value: wrong.value, why: 'Split the numerator so that each piece is $1 - \\cos kx$ times something that tends to $1$; the pieces then add.' },
          { value: 2 * value.value, why: '$\\dfrac{1 - \\cos kx}{x^2} \\to \\dfrac{k^2}{2}$, not $k^2$: remember $1 - \\cos\\theta = 2\\sin^2\\dfrac{\\theta}{2}$.' },
          { value: 0, why: 'Numerator and denominator both tend to $0$; the limit is found from the standard limits, not by substituting.' }
        ]),
        hints: [
          'Substituting $x = 0$ gives $\\dfrac{0}{0}$, so the expression has to be rearranged first.',
          'Use $\\displaystyle\\lim_{\\theta \\to 0}\\dfrac{1 - \\cos\\theta}{\\theta^2} = \\dfrac{1}{2}$ and $\\displaystyle\\lim_{\\theta \\to 0}\\dfrac{\\sin\\theta}{\\theta} = 1$.',
          'Write the numerator as a sum of pieces of the form $1 - \\cos kx$, each multiplied by something that tends to $1$.'
        ],
        steps,
        reasoning: `cosines-${form}`
      };
    }
    if (kind === 'tan-minus-sin') {
      const a = ri(rng, 1, 4), b = ri(rng, 1, 5);
      const form = rc(rng, ['cube', 'with-sin', 'with-sin-squared']);
      const tex = form === 'cube' ? `\\dfrac{${tanTex(a)} - ${sinTex(a)}}{x^3}`
        : form === 'with-sin' ? `\\dfrac{${tanTex(a)} - ${sinTex(a)}}{x^2\\,${sinTex(b)}}`
          : `\\dfrac{${tanTex(a)} - ${sinTex(a)}}{x\\sin^2 ${b === 1 ? '' : b}x}`;
      const den = form === 'cube' ? 2 : form === 'with-sin' ? 2 * b : 2 * b * b;
      const value = R(a ** 3, den);
      return {
        prompt: `Evaluate $${LIM0} ${tex}$.`,
        answerType: 'numeric', ...exact(value),
        traps: traps(value.value, [
          { value: 0, why: '$\\tan$ and $\\sin$ agree to first order, but the question divides by a third power of $x$ — the difference survives.' },
          { value: R(a ** 3, den / 2).value, why: 'Factor $\\tan ax - \\sin ax = \\tan ax\\,(1 - \\cos ax)$; the factor $1 - \\cos ax$ brings $\\dfrac{a^2}{2}$, with its $\\dfrac{1}{2}$.' },
          { value: R(a, den).value, why: 'Each standard limit carries its own power of $a$: $\\tan ax$ gives $a$ and $1 - \\cos ax$ gives $\\dfrac{a^2}{2}$.' }
        ]),
        hints: [
          'Factorise the numerator: $\\tan\\theta - \\sin\\theta = \\tan\\theta\\,(1 - \\cos\\theta)$.',
          'Split the expression into factors, each of which tends to a standard limit.',
          'Use $\\dfrac{\\tan kx}{x} \\to k$, $\\dfrac{1 - \\cos kx}{x^2} \\to \\dfrac{k^2}{2}$ and $\\dfrac{\\sin kx}{x} \\to k$.'
        ],
        steps: [
          { h: 'Factorise', d: `$${tanTex(a)} - ${sinTex(a)} = ${tanTex(a)}\\,(1 - ${cosTex(a)})$` },
          { h: 'Split', d: form === 'cube' ? `$\\dfrac{${tanTex(a)}}{x} \\cdot \\dfrac{1 - ${cosTex(a)}}{x^2}$` : form === 'with-sin' ? `$\\dfrac{${tanTex(a)}}{x} \\cdot \\dfrac{1 - ${cosTex(a)}}{x^2} \\cdot \\dfrac{x}{${sinTex(b)}}$` : `$\\dfrac{${tanTex(a)}}{x} \\cdot \\dfrac{1 - ${cosTex(a)}}{x^2} \\cdot \\dfrac{x^2}{\\sin^2 ${b === 1 ? '' : b}x}$` },
          { h: 'Limits of the factors', d: `$${a}$, $\\dfrac{${a * a}}{2}$${form === 'cube' ? '' : form === 'with-sin' ? `, $\\dfrac{1}{${b}}$` : `, $\\dfrac{1}{${b * b}}$`}` },
          { h: 'Answer', d: `$${rTex(value)}$` }
        ],
        reasoning: `tan-minus-sin-${form}`
      };
    }
    if (kind === 'infinity') {
      if (rng() < 0.5) {
        const p = ri(rng, -9, 9), r = ri(rng, -9, 9), qq = ri(rng, 1, 20), s = ri(rng, 1, 20);
        if (p === r) continue;
        const value = R(p - r, 2);
        return {
          prompt: `Evaluate $\\displaystyle\\lim_{x \\to \\infty}\\left(\\sqrt{${polyTex([1, p, qq])}} - \\sqrt{${polyTex([1, r, s])}}\\right)$.`,
          answerType: 'numeric', ...exact(value),
          traps: traps(value.value, [
            { value: 0, why: 'Both roots grow like $x$, but their difference does not tend to $0$ — rationalise to see what is left.' },
            { value: p - r, why: 'After rationalising, the denominator is $\\sqrt{\\cdots} + \\sqrt{\\cdots} \\approx 2x$, which halves the result.' },
            { value: R(p - r + qq - s, 2).value, why: 'The constant terms vanish in the limit once divided by $x$.' }
          ]),
          hints: [
            'Substitution gives $\\infty - \\infty$, which is not a value.',
            'Multiply and divide by the sum of the two square roots.',
            'Divide numerator and denominator by $x$ and let $x \\to \\infty$.'
          ],
          steps: [
            { h: 'Rationalise', d: `$\\dfrac{(${polyTex([1, p, qq])}) - (${polyTex([1, r, s])})}{\\sqrt{${polyTex([1, p, qq])}} + \\sqrt{${polyTex([1, r, s])}}} = \\dfrac{${lin(p - r, qq - s)}}{\\sqrt{${polyTex([1, p, qq])}} + \\sqrt{${polyTex([1, r, s])}}}$` },
            { h: 'Divide by x', d: `$\\dfrac{${p - r} ${qq - s >= 0 ? '+' : '-'} \\frac{${Math.abs(qq - s)}}{x}}{\\sqrt{1 ${sg(p)}/x + \\cdots} + \\sqrt{1 ${sg(r)}/x + \\cdots}}$` },
            { h: 'Limit', d: `$\\dfrac{${p - r}}{1 + 1}$` },
            { h: 'Answer', d: `$${rTex(value)}$` }
          ],
          reasoning: 'difference-of-roots'
        };
      }
      const a = ri(rng, 1, 4), p = nz(rng, -12, 12), qq = ri(rng, 1, 20);
      const value = R(p, 2 * a);
      return {
        prompt: `Evaluate $\\displaystyle\\lim_{x \\to \\infty}\\left(\\sqrt{${polyTex([a * a, p, qq])}} - ${cx(a)}\\right)$.`,
        answerType: 'numeric', ...exact(value),
        traps: traps(value.value, [
          { value: 0, why: 'The root and the linear term both grow, but their difference settles at a nonzero value — rationalise.' },
          { value: R(p, a).value, why: `The denominator after rationalising is about $${2 * a}x$, not $${a}x$.` },
          { value: R(p, 2).value, why: `$\\sqrt{${a * a}x^2} = ${cx(a)}$, so the denominator is $${2 * a}x$ to first order.` }
        ]),
        hints: [
          'Substitution gives $\\infty - \\infty$.',
          'Multiply and divide by the sum of the square root and the linear term.',
          'Divide numerator and denominator by $x$ and let $x \\to \\infty$.'
        ],
        steps: [
          { h: 'Rationalise', d: `$\\dfrac{(${polyTex([a * a, p, qq])}) - ${a * a}x^2}{\\sqrt{${polyTex([a * a, p, qq])}} + ${cx(a)}} = \\dfrac{${lin(p, qq)}}{\\sqrt{${polyTex([a * a, p, qq])}} + ${cx(a)}}$` },
          { h: 'Divide by x', d: `$\\dfrac{${p} + \\frac{${qq}}{x}}{\\sqrt{${a * a} ${sg(p)}/x + ${qq}/x^2} + ${a}}$` },
          { h: 'Limit', d: `$\\dfrac{${p}}{${a} + ${a}}$` },
          { h: 'Answer', d: `$${rTex(value)}$` }
        ],
        reasoning: 'root-minus-linear'
      };
    }
    const u = ri(rng, 1, 6), v = ri(rng, 1, 6), c = ri(rng, -5, 9);
    if (u === v) continue;
    const p = u * u - c, qq = v * v - c;
    if (p === 0 || qq === 0) continue;
    const value = R(v, u);
    return {
      prompt: `Evaluate $\\displaystyle\\lim_{x \\to ${c}} \\dfrac{\\sqrt{${shift(p)}} - ${u}}{\\sqrt{${shift(qq)}} - ${v}}$.`,
      answerType: 'numeric', ...exact(value),
      traps: traps(value.value, [
        { value: R(u, v).value, why: 'The ratio has been inverted: rationalising the numerator puts $\\sqrt{\\cdot} + ' + u + '$ in the DENOMINATOR.' },
        { value: 1, why: 'After both rationalisations the factors $(x - c)$ cancel, but the conjugates do not: they tend to $2' + u + '$ and $2' + v + '$.' },
        { value: R(v * v, u * u).value, why: 'The conjugates contribute $\\sqrt{\\cdot} + \\text{constant}$, which tend to twice the constants, not their squares.' }
      ]),
      hints: [
        'Substitution gives $\\dfrac{0}{0}$.',
        'Rationalise the numerator and the denominator, each with its own conjugate.',
        'The factor that made both zero cancels; then substitute.'
      ],
      steps: [
        { h: 'Rationalise both', d: `$\\dfrac{(x ${sg(p)}) - ${u * u}}{(x ${sg(qq)}) - ${v * v}} \\cdot \\dfrac{\\sqrt{${shift(qq)}} + ${v}}{\\sqrt{${shift(p)}} + ${u}}$` },
        { h: 'Cancel', d: `Both brackets equal $${shift(-c)}$, which cancels` },
        { h: 'Substitute', d: `$\\dfrac{\\sqrt{${c + qq}} + ${v}}{\\sqrt{${c + p}} + ${u}} = \\dfrac{${2 * v}}{${2 * u}}$` },
        { h: 'Answer', d: `$${rTex(value)}$` }
      ],
      reasoning: 'double-rationalise'
    };
  }
  return limitReasoning(makeRng(FALLBACK_SEED));
}

// ═════════════════════════════════════════════════════════════════════════════
// 13 · Limits and Derivatives — the derivative from its definition
// ═════════════════════════════════════════════════════════════════════════════

const atTex = (a, p, sign) => `${a === 0 ? '' : `${a} `}${a === 0 ? (sign < 0 ? '-' : '') : sign < 0 ? '- ' : '+ '}${p === 1 ? '' : p}h`;

function firstPrinciplesReasoning(rng) {
  const kind = rc(rng, ['functional', 'symmetric', 'radical']);
  for (let guard = 0; guard < 400; guard++) {
    if (kind === 'functional') {
      const k = nz(rng, -6, 6), c = ri(rng, -5, 9), x0 = nz(rng, -5, 5);
      const cubic = rng() < 0.4;
      const value = cubic ? c + k * x0 * x0 : c + k * x0;
      if (value === c) continue;
      const extra = cubic ? `${k < 0 ? '-' : '+'} ${Math.abs(k) === 1 ? '' : Math.abs(k)}xy(x + y)` : `${k < 0 ? '-' : '+'} ${Math.abs(k) === 1 ? '' : Math.abs(k)}xy`;
      return {
        prompt: `A function $f : \\mathbb{R} \\to \\mathbb{R}$ satisfies $f(x + y) = f(x) + f(y) ${extra}$ for all real $x$ and $y$, and $\\displaystyle\\lim_{h \\to 0}\\dfrac{f(h)}{h} = ${c}$. Find $f'(${x0})$.`,
        answerType: 'numeric', answer: { value },
        traps: traps(value, [
          { value: c, why: `That is $f'(0)$. At $x = ${x0}$ the extra term in the equation adds to the difference quotient.` },
          { value: cubic ? c + 2 * k * x0 * x0 : c + 2 * k * x0, why: `Put $y = h$: the extra term is $${cubic ? `${k}xh(x + h)` : `${k}xh`}$, and dividing by $h$ leaves $${cubic ? `${k}x(x + h)` : `${k}x`}$ — there is no factor $2$.` },
          { value: cubic ? k * x0 * x0 : k * x0, why: `The limit $\\dfrac{f(h)}{h} \\to ${c}$ is part of the derivative too.` }
        ]),
        hints: [
          'Put both $x$ and $y$ equal to zero in the equation to find $f(0)$.',
          'Write $f(x + h) - f(x)$ using the equation with $y = h$.',
          'Divide by $h$ and let $h \\to 0$, using the limit you are given.'
        ],
        steps: [
          { h: 'f(0)', d: '$x = y = 0$ gives $f(0) = 2f(0)$, so $f(0) = 0$' },
          { h: 'Difference', d: `$f(x + h) - f(x) = f(h) ${cubic ? `${k < 0 ? '-' : '+'} ${Math.abs(k)}xh(x + h)` : `${k < 0 ? '-' : '+'} ${Math.abs(k)}xh`}$` },
          { h: 'Divide and let h → 0', d: `$f'(x) = \\displaystyle\\lim_{h \\to 0}\\left(\\dfrac{f(h)}{h} ${cubic ? `${k < 0 ? '-' : '+'} ${Math.abs(k)}x(x + h)` : `${k < 0 ? '-' : '+'} ${Math.abs(k)}x`}\\right) = ${c} ${cubic ? `${k < 0 ? '-' : '+'} ${Math.abs(k)}x^2` : `${k < 0 ? '-' : '+'} ${Math.abs(k)}x`}$` },
          { h: 'Evaluate', d: `$f'(${x0}) = ${c} ${k < 0 ? '-' : '+'} ${Math.abs(k)}${cubic ? `(${x0})^2` : `(${x0})`} = ${value}$` }
        ],
        reasoning: cubic ? 'functional-cubic' : 'functional-quadratic'
      };
    }
    if (kind === 'symmetric') {
      const co = [nz(rng, -3, 3), ri(rng, -6, 6), ri(rng, -9, 9), ri(rng, -9, 9)];
      const a = ri(rng, -3, 3), p = ri(rng, 1, 4), qq = ri(rng, 1, 4);
      const fp = 3 * co[0] * a * a + 2 * co[1] * a + co[2];
      const oneSided = rng() < 0.3;
      const value = oneSided ? R(p * fp, qq) : R((p + qq) * fp);
      if (fp === 0) continue;
      const limTex = oneSided
        ? `\\dfrac{f(${atTex(a, p, 1)}) - f(${a})}{${qq === 1 ? '' : qq}h}`
        : `\\dfrac{f(${atTex(a, p, 1)}) - f(${atTex(a, qq, -1)})}{h}`;
      return {
        prompt: `Let $f(x) = ${polyTex(co)}$. Find $\\displaystyle\\lim_{h \\to 0} ${limTex}$.`,
        answerType: 'numeric', ...exact(value),
        traps: traps(value.value, oneSided
          ? [{ value: fp, why: `That is $f'(${a})$; the step is $${p}h$ while the division is by $${qq}h$.` },
            { value: R(qq * fp, p).value, why: 'The ratio of the step to the divisor has been inverted.' }]
          : [{ value: fp, why: `That is $f'(${a})$ itself. The two points are $${p}h$ and $${qq}h$ away from $${a}$, so the quotient is a sum of two difference quotients.` },
            { value: (p - qq) * fp, why: `$f(a - ${qq}h)$ is subtracted, so its difference quotient enters with a plus sign: $(${p} + ${qq})f'(a)$.` },
            { value: p * qq * fp, why: 'The two pieces add; they do not multiply.' }]),
        hints: [
          oneSided ? 'Write the quotient as a constant multiple of a difference quotient of $f$ at the point.' : 'Add and subtract $f(a)$ in the numerator, where $a$ is the point the arguments approach.',
          'Each piece is a constant times a difference quotient whose limit is the derivative at that point.',
          'Find that derivative by differentiating $f$.'
        ],
        steps: oneSided
          ? [
            { h: 'Rewrite', d: `$\\dfrac{f(${atTex(a, p, 1)}) - f(${a})}{${qq === 1 ? '' : qq}h} = \\dfrac{${p}}{${qq}} \\cdot \\dfrac{f(${atTex(a, p, 1)}) - f(${a})}{${p}h}$` },
            { h: 'Limit of the quotient', d: `$\\to \\dfrac{${p}}{${qq}}f'(${a})$` },
            { h: 'Differentiate', d: `$f'(x) = ${polyTex([3 * co[0], 2 * co[1], co[2]])}$, so $f'(${a}) = ${fp}$` },
            { h: 'Answer', d: `$\\dfrac{${p}}{${qq}} \\times ${par(fp)} = ${rTex(value)}$` }
          ]
          : [
            { h: 'Add and subtract f(a)', d: `$\\dfrac{f(${atTex(a, p, 1)}) - f(${a})}{h} + \\dfrac{f(${a}) - f(${atTex(a, qq, -1)})}{h}$` },
            { h: 'Each piece', d: `$\\to ${p}f'(${a}) + ${qq}f'(${a}) = ${p + qq}f'(${a})$` },
            { h: 'Differentiate', d: `$f'(x) = ${polyTex([3 * co[0], 2 * co[1], co[2]])}$, so $f'(${a}) = ${fp}$` },
            { h: 'Answer', d: `$${p + qq} \\times ${par(fp)} = ${rTex(value)}$` }
          ],
        reasoning: oneSided ? 'scaled-quotient' : 'two-sided-quotient'
      };
    }
    const a = nz(rng, -6, 6), u = ri(rng, 1, 6), x0 = ri(rng, -6, 6);
    const b = u * u - a * x0;
    if (b === 0 || Math.abs(b) > 40) continue;
    const reciprocal = rng() < 0.4;
    const value = reciprocal ? R(-a, 2 * u * u * u) : R(a, 2 * u);
    const fx = reciprocal ? `\\dfrac{1}{\\sqrt{${lin(a, b)}}}` : `\\sqrt{${lin(a, b)}}`;
    return {
      prompt: `Using the definition $f'(a) = \\displaystyle\\lim_{h \\to 0}\\dfrac{f(a + h) - f(a)}{h}$, find $f'(${x0})$ for $f(x) = ${fx}$.`,
      answerType: 'numeric', ...exact(value),
      traps: traps(value.value, reciprocal
        ? [{ value: R(a, 2 * u * u * u).value, why: 'The derivative of a reciprocal is negative where the function inside increases.' },
          { value: R(-1, 2 * u * u * u).value, why: `The inner expression changes $${a}$ times as fast as $x$; that factor stays in the answer.` }]
        : [{ value: R(1, 2 * u).value, why: `The inner expression changes $${a}$ times as fast as $x$; that factor stays in the answer.` },
          { value: R(a, u).value, why: 'Rationalising produces a sum of two square roots in the denominator, which tends to twice the root.' }]),
      hints: [
        'Write the difference quotient with the square roots in it.',
        'Multiply numerator and denominator by the conjugate (the sum of the two square roots).',
        'The $h$ cancels; then let $h \\to 0$.'
      ],
      steps: reciprocal
        ? [
          { h: 'Quotient', d: `$\\dfrac{1}{h}\\left(\\dfrac{1}{\\sqrt{${lin(a, b)} + ${a}h}} - \\dfrac{1}{\\sqrt{${lin(a, b)}}}\\right) = \\dfrac{\\sqrt{${lin(a, b)}} - \\sqrt{${lin(a, b)} + ${a}h}}{h\\sqrt{${lin(a, b)}}\\sqrt{${lin(a, b)} + ${a}h}}$` },
          { h: 'Rationalise', d: `The numerator times its conjugate is $-${a}h$, so the quotient is $\\dfrac{-${par(a)}}{\\sqrt{\\cdots}\\sqrt{\\cdots}\\left(\\sqrt{\\cdots} + \\sqrt{\\cdots}\\right)}$` },
          { h: 'Let h → 0', d: `$f'(x) = \\dfrac{-${par(a)}}{2(${lin(a, b)})^{3/2}}$` },
          { h: 'At the point', d: `$${lin(a, b).replace('x', `(${x0})`)} = ${u * u}$, so $f'(${x0}) = \\dfrac{-${par(a)}}{2 \\times ${u}^3} = ${rTex(value)}$` }
        ]
        : [
          { h: 'Quotient', d: `$\\dfrac{\\sqrt{${a}(${x0} + h) ${sg(b)}} - \\sqrt{${u * u}}}{h}$` },
          { h: 'Rationalise', d: `$\\dfrac{${a}h}{h\\left(\\sqrt{${u * u} ${sg(a)}h} + ${u}\\right)}$` },
          { h: 'Let h → 0', d: `$\\dfrac{${a}}{${u} + ${u}}$` },
          { h: 'Answer', d: `$${rTex(value)}$` }
        ],
      reasoning: reciprocal ? 'first-principles-reciprocal-root' : 'first-principles-root'
    };
  }
  return firstPrinciplesReasoning(makeRng(FALLBACK_SEED));
}

// ═════════════════════════════════════════════════════════════════════════════
// 14 · Statistics — mean deviation
// ═════════════════════════════════════════════════════════════════════════════

/** A terminating fraction written as a decimal: 39/5 → "7.8". */
function decimalOf(f) {
  let d = f.d, twos = 0, fives = 0;
  while (d % 2 === 0) { d /= 2; twos++; }
  while (d % 5 === 0) { d /= 5; fives++; }
  if (d !== 1) return null;
  const places = Math.max(twos, fives);
  return (f.n / f.d).toFixed(places);
}

function meanDeviationReasoning(rng) {
  const kind = rc(rng, ['inverse', 'table', 'naturals']);
  for (let guard = 0; guard < 400; guard++) {
    if (kind === 'inverse') {
      const n = rc(rng, [5, 25, 4, 6, 8, 10, 12, 20, 30, 40, 50]);
      const r = Math.floor(n / 2);
      const total = n % 2 ? r * (r + 1) : r * r;          // Σ|i − centre| for i = 1..n, in steps of d
      const d = ri(rng, 1, 12);
      const md = R(d * total, n);
      const mdText = decimalOf(md);
      if (!mdText) continue;
      const about = rng() < 0.5 ? 'mean' : 'median';
      return {
        prompt: `The mean deviation about the ${about} of the ${n} observations $a,\\ a + d,\\ a + 2d,\\ \\ldots,\\ a + ${n - 1}d$, where $d > 0$, is $${mdText}$. Find $d$.`,
        answerType: 'numeric', answer: { value: d },
        traps: traps(d, [
          { value: R(n * md.n, md.d * (n % 2 ? r * r : r * (r + 1))).value, why: `The pattern of deviations differs for odd and even $n$: here $n = ${n}$.` },
          { value: R(md.n * 4, md.d * n).value, why: 'The deviations are $d, 2d, 3d, \\ldots$ on each side of the middle, not all equal to half the spread.' },
          { value: md.value, why: 'The mean deviation is $d$ times an average of whole numbers, not $d$ itself.' }
        ].filter(t => Number.isFinite(t.value))),
        hints: [
          'For equally spaced observations the mean and the median are both at the middle of the list.',
          n % 2 ? 'The absolute deviations from the middle observation are $0, d, 2d, \\ldots$, repeated on both sides.' : 'With an even number of observations the centre is between the two middle ones, so the deviations are $\\dfrac{d}{2}, \\dfrac{3d}{2}, \\ldots$ on each side.',
          'Add the deviations, divide by the number of observations, and solve for $d$.'
        ],
        steps: [
          { h: 'Centre', d: n % 2 ? `The ${about} is the middle observation, $a + ${r}d$` : `The ${about} is halfway between $a + ${r - 1}d$ and $a + ${r}d$, i.e. $a + ${rTex(R(2 * r - 1, 2))}d$` },
          { h: 'Sum of deviations', d: n % 2 ? `$2(1 + 2 + \\cdots + ${r})d = ${total}d$` : `$2\\left(\\dfrac{1}{2} + \\dfrac{3}{2} + \\cdots + \\dfrac{${2 * r - 1}}{2}\\right)d = ${total}d$` },
          { h: 'Mean deviation', d: `$\\dfrac{${total}d}{${n}} = ${rTex(R(total, n))}d$` },
          { h: 'Solve', d: `$${rTex(R(total, n))}d = ${mdText} \\Rightarrow d = ${d}$` }
        ],
        reasoning: 'inverse-mean-deviation'
      };
    }
    if (kind === 'table') {
      const xs = rs(rng, Array.from({ length: 36 }, (_, i) => i + 2)).slice(0, ri(rng, 5, 6)).sort((x, y) => x - y);
      const fs = xs.map(() => ri(rng, 1, 9));
      const N = fs.reduce((s, f) => s + f, 0);
      const list = xs.flatMap((x, i) => Array(fs[i]).fill(x));
      const med = N % 2 ? R(list[(N - 1) / 2]) : R(list[N / 2 - 1] + list[N / 2], 2);
      let sum = R(0);
      xs.forEach((x, i) => { sum = add(sum, mul(R(fs[i]), R(Math.abs(x * med.d - med.n), med.d))); });
      const value = div(sum, R(N));
      if (value.n === 0) continue;
      let cf = 0;
      const cum = fs.map(f => (cf += f));
      const mean = R(xs.reduce((s, x, i) => s + x * fs[i], 0), N);
      let aboutMean = R(0);
      xs.forEach((x, i) => { aboutMean = add(aboutMean, mul(R(fs[i]), R(Math.abs(x * mean.d - mean.n), mean.d))); });
      return {
        prompt: `Find the mean deviation about the median for the following data. Values $x_i$: $${xs.join(',\\ ')}$; frequencies $f_i$: $${fs.join(',\\ ')}$.`,
        answerType: 'numeric', ...exact(value),
        traps: traps(value.value, [
          { value: div(aboutMean, R(N)).value, why: 'That is the mean deviation about the MEAN; this question asks about the median.' },
          { value: div(sum, R(xs.length)).value, why: `Divide by the total frequency $${N}$, not by the number of distinct values.` },
          { value: R(xs.reduce((s, x) => s + Math.abs(x * med.d - med.n), 0), med.d * xs.length).value, why: 'Each deviation has to be weighted by its frequency.' }
        ]),
        hints: [
          'Find the median from the cumulative frequencies.',
          N % 2 ? 'With an odd total frequency the median is the middle observation.' : 'With an even total frequency the median is the average of the two middle observations.',
          'Weight each absolute deviation from the median by its frequency, add, and divide by the total frequency.'
        ],
        steps: [
          { h: 'Cumulative frequencies', d: `$${cum.join(',\\ ')}$; total $N = ${N}$` },
          { h: 'Median', d: N % 2 ? `The $${(N + 1) / 2}$th observation: $${rTex(med)}$` : `The average of the $${N / 2}$th and $${N / 2 + 1}$th observations: $${rTex(med)}$` },
          { h: 'Weighted deviations', d: `$\\sum f_i|x_i - M| = ${xs.map((x, i) => `${fs[i]}(${rTex(R(Math.abs(x * med.d - med.n), med.d))})`).join(' + ')} = ${rTex(sum)}$` },
          { h: 'Divide', d: `$\\dfrac{${rTex(sum)}}{${N}} = ${rTex(value)}$` }
        ],
        reasoning: 'median-table'
      };
    }
    const n = ri(rng, 11, 60);
    const kindOf = rc(rng, ['natural', 'odd', 'multiples']);
    const k = kindOf === 'multiples' ? ri(rng, 2, 9) : 1;
    const base = n % 2 ? R(n * n - 1, 4 * n) : R(n, 4);       // first n natural numbers
    const scale = kindOf === 'odd' ? 2 : kindOf === 'multiples' ? k : 1;
    const value = mul(base, R(scale));
    const what = kindOf === 'natural' ? `the first $${n}$ natural numbers` : kindOf === 'odd' ? `the first $${n}$ odd natural numbers` : `the first $${n}$ positive multiples of $${k}$`;
    const r = Math.floor(n / 2);
    return {
      prompt: `Find the mean deviation about the mean of ${what}.`,
      answerType: 'numeric', ...exact(value),
      traps: traps(value.value, [
        { value: mul(n % 2 ? R(n, 4) : R(n * n - 1, 4 * n), R(scale)).value, why: `Odd and even counts behave differently: here $n = ${n}$ is ${n % 2 ? 'odd, so the middle value has deviation $0$' : 'even, so every deviation is a half-integer multiple'}.` },
        { value: mul(R(n + 1, 2), R(scale)).value, why: 'That is the mean, not the mean deviation.' },
        { value: mul(R(n * n - 1, 12), R(scale)).value, why: 'That is the variance of the first $n$ natural numbers (times the scale); the mean deviation averages absolute deviations.' }
      ]),
      hints: [
        'The observations are equally spaced, so the mean is the middle of the list.',
        'The absolute deviations from the mean form arithmetic progressions on each side of the middle.',
        'Add them with the formula for the sum of an AP and divide by the number of observations.'
      ],
      steps: [
        { h: 'Mean', d: `$${rTex(mul(R(n + 1, 2), R(scale)))}${kindOf === 'odd' ? ' - 1' : ''}$`.replace(`${rTex(mul(R(n + 1, 2), R(scale)))} - 1`, `${rTex(sub(mul(R(n + 1, 2), R(scale)), R(1)))}`) },
        { h: 'Deviations', d: n % 2 ? `$0$ once, and $${scale === 1 ? '' : scale}, ${2 * scale}, \\ldots, ${r * scale}$ on each side` : `$${rTex(R(scale, 2))}, ${rTex(R(3 * scale, 2))}, \\ldots, ${rTex(R((2 * r - 1) * scale, 2))}$ on each side` },
        { h: 'Sum', d: `$${rTex(mul(R(n % 2 ? r * (r + 1) : r * r), R(scale)))}$` },
        { h: 'Divide by n', d: `$\\dfrac{${rTex(mul(R(n % 2 ? r * (r + 1) : r * r), R(scale)))}}{${n}} = ${rTex(value)}$` }
      ],
      reasoning: `consecutive-${kindOf}`
    };
  }
  return meanDeviationReasoning(makeRng(FALLBACK_SEED));
}

// ═════════════════════════════════════════════════════════════════════════════
// 15 · Statistics — variance and standard deviation recovered and corrected
// ═════════════════════════════════════════════════════════════════════════════

function varianceReasoning(rng) {
  const kind = rc(rng, ['missing-two', 'corrected', 'combined']);
  for (let guard = 0; guard < 400; guard++) {
    if (kind === 'missing-two') {
      const n = rc(rng, [5, 5, 10]);
      const data = Array.from({ length: n }, () => ri(rng, 1, 20));
      const [a, b] = [data[n - 2], data[n - 1]].sort((x, y) => x - y);
      if (a === b) continue;
      const S = data.reduce((s, x) => s + x, 0), S2 = data.reduce((s, x) => s + x * x, 0);
      const mean = R(S, n), variance = R(n * S2 - S * S, n * n);
      const meanText = decimalOf(mean), varText = decimalOf(variance);
      if (!meanText || !varText || variance.n === 0) continue;
      const listed = rs(rng, data.slice(0, n - 2));
      const ask = rc(rng, ['larger', 'smaller', 'difference', 'product']);
      const value = ask === 'larger' ? b : ask === 'smaller' ? a : ask === 'difference' ? b - a : a * b;
      const askText = { larger: 'the larger of the two remaining observations', smaller: 'the smaller of the two remaining observations', difference: 'the positive difference between the two remaining observations', product: 'the product of the two remaining observations' }[ask];
      const sumAB = a + b, sqAB = a * a + b * b;
      const sampleSq = Math.round(((n - 1) * variance.value + n * mean.value * mean.value) * 1e6) / 1e6 - (S2 - sqAB);
      return {
        prompt: `The mean and the variance of ${n} observations are $${meanText}$ and $${varText}$. ${n - 2} of the observations are $${listed.join(',\\ ')}$. Find ${askText}.`,
        answerType: 'numeric', answer: { value },
        traps: traps(value, [
          { value: ask === 'larger' ? a : ask === 'smaller' ? b : ask === 'difference' ? a + b : a * a + b * b, why: ask === 'larger' || ask === 'smaller' ? `That is the ${ask === 'larger' ? 'smaller' : 'larger'} one.` : ask === 'difference' ? 'That is their sum, which the mean gives directly.' : 'That is the sum of their squares.' },
          ...(Number.isFinite(sampleSq) ? [{ value: Math.round(sampleSq), why: 'The variance here divides by $n$, the number of observations, not by $n - 1$.' }] : []),
          { value: sumAB, why: 'The mean fixes the SUM of the two missing observations; the variance is needed to separate them.' }
        ]),
        hints: [
          'Call the two missing observations $x$ and $y$.',
          'The mean gives $x + y$; the variance, through $\\sigma^2 = \\dfrac{\\sum x_i^2}{n} - \\bar{x}^2$, gives $x^2 + y^2$.',
          'Use $(x - y)^2 = 2(x^2 + y^2) - (x + y)^2$ to separate them.'
        ],
        steps: [
          { h: 'From the mean', d: `$\\sum x_i = ${n} \\times ${meanText} = ${S}$, so $x + y = ${S} - ${S - sumAB} = ${sumAB}$` },
          { h: 'From the variance', d: `$\\sum x_i^2 = ${n}\\left(${varText} + ${meanText}^2\\right) = ${S2}$, so $x^2 + y^2 = ${S2} - ${S2 - sqAB} = ${sqAB}$` },
          { h: 'Separate', d: `$(x - y)^2 = 2(${sqAB}) - ${sumAB}^2 = ${(b - a) * (b - a)}$, so the two are $${a}$ and $${b}$` },
          { h: 'Answer', d: `$${value}$` }
        ],
        reasoning: 'missing-observations'
      };
    }
    if (kind === 'corrected') {
      const n = rc(rng, [10, 20, 25, 40, 50]), mu = ri(rng, 10, 60), sd = ri(rng, 2, 9);
      const w = mu + nz(rng, -sd, sd), r = mu + nz(rng, -2 * sd, 2 * sd);
      if (w === r || (w - mu) ** 2 > n * sd * sd) continue;
      const S = n * mu - w + r, S2 = n * (sd * sd + mu * mu) - w * w + r * r;
      const value = R(n * S2 - S * S, n * n);
      if (value.n <= 0) continue;
      const meanOnly = R(n * sd * sd + r * r - w * w, n);
      return {
        prompt: `The mean and the standard deviation of ${n} observations were found to be $${mu}$ and $${sd}$. Later it was discovered that one observation had been copied as $${w}$ instead of $${r}$. Find the correct variance.`,
        answerType: 'numeric', ...exact(value),
        traps: traps(value.value, [
          { value: sd * sd, why: 'That is the variance before the correction.' },
          { value: meanOnly.value, why: 'Correcting $\\sum x^2$ is not enough: the mean changes too, and the new mean must be squared and subtracted.' },
          { value: Math.sqrt(Math.max(0, value.value)), why: 'That is the corrected standard deviation; the question asks for the variance.' }
        ]),
        hints: [
          'Recover $\\sum x$ from the mean and $\\sum x^2$ from $\\sigma^2 = \\dfrac{\\sum x^2}{n} - \\bar{x}^2$.',
          'Remove the wrong value from both sums and put the right one in.',
          'Recompute the mean and the variance from the corrected sums.'
        ],
        steps: [
          { h: 'Recorded sums', d: `$\\sum x = ${n} \\times ${mu} = ${n * mu}$ and $\\sum x^2 = ${n}(${sd}^2 + ${mu}^2) = ${n * (sd * sd + mu * mu)}$` },
          { h: 'Correct them', d: `$\\sum x = ${n * mu} - ${w} + ${r} = ${S}$ and $\\sum x^2 = ${n * (sd * sd + mu * mu)} - ${w * w} + ${r * r} = ${S2}$` },
          { h: 'Corrected mean', d: `$\\bar{x} = ${rTex(R(S, n))}$` },
          { h: 'Corrected variance', d: `$\\dfrac{${S2}}{${n}} - \\left(${rTex(R(S, n))}\\right)^2 = ${rTex(value)}$` }
        ],
        reasoning: 'corrected-observation'
      };
    }
    const n1 = ri(rng, 5, 40), n2 = ri(rng, 5, 40), m1 = ri(rng, 10, 60), m2 = ri(rng, 10, 60), v1 = ri(rng, 1, 30), v2 = ri(rng, 1, 30);
    if (m1 === m2) continue;
    const N = n1 + n2;
    const S = n1 * m1 + n2 * m2, S2 = n1 * (v1 + m1 * m1) + n2 * (v2 + m2 * m2);
    const value = R(N * S2 - S * S, N * N);
    return {
      prompt: `One group of ${n1} observations has mean $${m1}$ and variance $${v1}$; another group of ${n2} observations has mean $${m2}$ and variance $${v2}$. Find the variance of all ${N} observations taken together.`,
      answerType: 'numeric', ...exact(value),
      traps: traps(value.value, [
        { value: R(n1 * v1 + n2 * v2, N).value, why: 'Averaging the variances ignores how far apart the two means are; that spread adds to the combined variance.' },
        { value: R(v1 + v2, 2).value, why: 'The groups have different sizes, and their means differ.' },
        { value: R(n1 * v1 + n2 * v2 + n1 * n2 * (m1 - m2) * (m1 - m2), N).value, why: 'The between-group term is $\\dfrac{n_1 n_2 (\\bar{x}_1 - \\bar{x}_2)^2}{(n_1 + n_2)^2}$ — divide by the square of the total.' }
      ]),
      hints: [
        'For each group, recover $\\sum x$ and $\\sum x^2$ from its mean and variance.',
        'Add the sums of the two groups.',
        'Compute the combined variance as $\\dfrac{\\sum x^2}{N} - \\bar{x}^2$ for all $N$ observations.'
      ],
      steps: [
        { h: 'First group', d: `$\\sum x = ${n1 * m1}$, $\\sum x^2 = ${n1}(${v1} + ${m1}^2) = ${n1 * (v1 + m1 * m1)}$` },
        { h: 'Second group', d: `$\\sum x = ${n2 * m2}$, $\\sum x^2 = ${n2}(${v2} + ${m2}^2) = ${n2 * (v2 + m2 * m2)}$` },
        { h: 'Combined mean', d: `$\\bar{x} = \\dfrac{${S}}{${N}} = ${rTex(R(S, N))}$` },
        { h: 'Combined variance', d: `$\\dfrac{${S2}}{${N}} - \\left(${rTex(R(S, N))}\\right)^2 = ${rTex(value)}$` }
      ],
      reasoning: 'combined-groups'
    };
  }
  return varianceReasoning(makeRng(FALLBACK_SEED));
}

// ═════════════════════════════════════════════════════════════════════════════
// 16 · Probability — sample spaces and events, counted
// ═════════════════════════════════════════════════════════════════════════════

const fib = n => { let a = 1, b = 1; for (let i = 2; i < n; i++) [a, b] = [b, a + b]; return n <= 2 ? 1 : b; };

function sampleSpaceReasoning(rng) {
  const kind = rc(rng, ['three-dice', 'coins', 'two-dice']);
  for (let guard = 0; guard < 400; guard++) {
    if (kind === 'three-dice') {
      const ev = rc(rng, ['sum', 'max', 'min', 'spread']);
      let text, count, how, naive;
      if (ev === 'sum') {
        const s = ri(rng, 4, 17);
        count = [0, 1, 2, 3].reduce((acc, j) => acc + (j % 2 ? -1 : 1) * nCr(3, j) * nCr(s - 6 * j - 1, 2), 0);
        text = `the sum of the three numbers is $${s}$`;
        how = `Solutions of $a + b + c = ${s}$ with $1 \\le a, b, c \\le 6$: $\\binom{${s - 1}}{2}${s >= 10 ? ` - 3\\binom{${s - 7}}{2}` : s >= 8 ? ` - 3\\binom{${s - 7}}{2}` : ''}${s >= 16 ? ` + 3\\binom{${s - 13}}{2}` : s >= 14 ? ` + 3\\binom{${s - 13}}{2}` : ''}$`;
        naive = nCr(s - 1, 2);
      } else if (ev === 'max') {
        const m = ri(rng, 2, 6);
        count = m ** 3 - (m - 1) ** 3;
        text = `the largest of the three numbers is $${m}$`;
        how = `All three at most $${m}$, minus all three at most $${m - 1}$: $${m}^3 - ${m - 1}^3$`;
        naive = m ** 3;
      } else if (ev === 'min') {
        const m = ri(rng, 1, 5);
        count = (7 - m) ** 3 - (6 - m) ** 3;
        text = `the smallest of the three numbers is $${m}$`;
        how = `All three at least $${m}$, minus all three at least $${m + 1}$: $${7 - m}^3 - ${6 - m}^3$`;
        naive = (7 - m) ** 3;
      } else {
        const k = ri(rng, 1, 5);
        count = 6 * k * (6 - k);
        text = `the largest and the smallest of the three numbers differ by exactly $${k}$`;
        how = `For each of the $${6 - k}$ choices of the smallest value $s$, triples inside $[s, s + ${k}]$ that use both ends: $${k + 1}^3 - 2 \\times ${k}^3 + ${k - 1}^3 = ${6 * k}$`;
        naive = (6 - k) * (k + 1) ** 3;
      }
      if (count < 2) continue;
      return {
        prompt: `Three dice are thrown, and an outcome is the ordered triple of numbers shown. Let $E$ be the event that ${text}. How many outcomes does $E$ contain?`,
        answerType: 'numeric', answer: { value: count },
        traps: traps(count, [
          { value: naive, why: 'Some of those triples do not satisfy the condition exactly — subtract the ones that overshoot.' },
          { value: count / 6 > 1 && Number.isInteger(count / 6) ? count / 6 : count + 1, why: 'Outcomes are ORDERED triples: $(1, 2, 3)$ and $(3, 2, 1)$ are different outcomes.' },
          { value: 216 - count, why: 'That counts the complement of $E$.' }
        ]),
        hints: [
          'The sample space has $6^3 = 216$ ordered outcomes.',
          'Count a larger, easier set first, then remove the outcomes that do not belong to $E$.',
          'Keep the order of the dice: $(a, b, c)$ and $(c, b, a)$ are different outcomes unless they are equal.'
        ],
        steps: [
          { h: 'Sample space', d: '$6 \\times 6 \\times 6 = 216$ ordered triples' },
          { h: 'Count', d: how },
          { h: 'Evaluate', d: `$${count}$` },
          { h: 'Answer', d: `$n(E) = ${count}$` }
        ],
        reasoning: `three-dice-${ev}`
      };
    }
    if (kind === 'coins') {
      const n = ri(rng, 4, 10);
      const ev = rc(rng, ['no-two-heads', 'two-heads-in-a-row', 'more-heads', ...(n % 2 ? [] : ['equal'])]);
      let text, count, how, naive;
      if (ev === 'no-two-heads') {
        count = fib(n + 2);
        text = 'no two consecutive tosses show heads';
        how = `If $a_n$ counts such sequences of length $n$, then $a_n = a_{n-1} + a_{n-2}$ (a sequence ends in T, or in TH), with $a_1 = 2$, $a_2 = 3$; so $a_{${n}} = ${count}$`;
        naive = 2 ** n - (n - 1) * 2 ** (n - 2);
      } else if (ev === 'two-heads-in-a-row') {
        count = 2 ** n - fib(n + 2);
        text = 'at least two consecutive tosses show heads';
        how = `Complement: sequences with no two consecutive heads satisfy $a_n = a_{n-1} + a_{n-2}$, $a_1 = 2$, $a_2 = 3$, so $a_{${n}} = ${fib(n + 2)}$; then $2^{${n}} - ${fib(n + 2)}$`;
        naive = (n - 1) * 2 ** (n - 2);
      } else if (ev === 'more-heads') {
        const ks = []; for (let r = Math.floor(n / 2) + 1; r <= n; r++) ks.push(r);
        count = ks.reduce((s, r) => s + nCr(n, r), 0);
        text = 'there are more heads than tails';
        how = `$${ks.map(r => `\\binom{${n}}{${r}}`).join(' + ')}$`;
        naive = 2 ** (n - 1);
      } else {
        count = nCr(n, n / 2);
        text = 'there are as many heads as tails';
        how = `Choose the positions of the $${n / 2}$ heads: $\\binom{${n}}{${n / 2}}$`;
        naive = n / 2;
      }
      return {
        prompt: `A coin is tossed ${n} times, and an outcome is the sequence of heads and tails. How many outcomes are in the event that ${text}?`,
        answerType: 'numeric', answer: { value: count },
        traps: traps(count, [
          { value: naive, why: ev === 'more-heads' && n % 2 === 0 ? 'Half of the sequences is too many when $n$ is even: the sequences with equal numbers are in neither half.' : 'That count either misses some sequences or counts some of them twice — check it on a small case.' },
          { value: 2 ** n - count, why: 'That counts the complement of the event.' },
          { value: 2 ** n, why: `That is the whole sample space of $2^{${n}}$ sequences.` }
        ]),
        hints: [
          `The sample space has $2^{${n}}$ sequences.`,
          ev === 'no-two-heads' || ev === 'two-heads-in-a-row' ? 'Build the sequences toss by toss: think about how a good sequence can end.' : 'Count the sequences by the number of heads they contain.',
          ev === 'two-heads-in-a-row' ? 'It is easier to count the complement — sequences with no two heads together.' : 'Add up the cases that belong to the event.'
        ],
        steps: [
          { h: 'Sample space', d: `$2^{${n}} = ${2 ** n}$ sequences` },
          { h: 'Count', d: how },
          { h: 'Evaluate', d: `$${count}$` },
          { h: 'Answer', d: `$${count}$ outcomes` }
        ],
        reasoning: `coins-${ev}`
      };
    }
    const p = ri(rng, 3, 5), qq = ri(rng, 1, 4);
    const sums = s => 6 - Math.abs(s - 7);
    const nE = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].filter(s => s % p === 0).reduce((acc, s) => acc + sums(s), 0);
    const nF = 6 * (6 - qq);
    let nEF = 0;
    for (let i = qq + 1; i <= 6; i++) {
      const first = ((p - (i % p)) % p) || p;            // the least j ≥ 1 with i + j ≡ 0 (mod p)
      nEF += first > 6 ? 0 : Math.floor((6 - first) / p) + 1;
    }
    const op = rc(rng, ['union', 'E-not-F', 'neither']);
    const value = op === 'union' ? nE + nF - nEF : op === 'E-not-F' ? nE - nEF : 36 - (nE + nF - nEF);
    if (value < 2) continue;
    const opTex = { union: 'E \\cup F', 'E-not-F': "E \\cap F'", neither: "E' \\cap F'" }[op];
    return {
      prompt: `Two dice are thrown, and an outcome is the ordered pair of numbers shown. Let $E$ be the event "the sum of the two numbers is a multiple of $${p}$" and $F$ the event "the first die shows a number greater than $${qq}$". How many outcomes are in $${opTex}$?`,
      answerType: 'numeric', answer: { value },
      traps: traps(value, [
        { value: op === 'union' ? nE + nF : op === 'E-not-F' ? nE : 36 - nE - nF, why: 'The outcomes in both $E$ and $F$ must not be counted twice — use $n(E \\cup F) = n(E) + n(F) - n(E \\cap F)$.' },
        { value: op === 'union' ? nEF : op === 'E-not-F' ? nE - nF : nE + nF - nEF, why: op === 'neither' ? "That is $n(E \\cup F)$; the event asked for is its complement." : 'Check which set operation the event describes.' },
        { value: 36 - value, why: 'That counts the complement.' }
      ]),
      hints: [
        'The sample space has $36$ ordered pairs.',
        'Count $E$, $F$ and $E \\cap F$ separately.',
        'Combine them with $n(E \\cup F) = n(E) + n(F) - n(E \\cap F)$ and complements.'
      ],
      steps: [
        { h: 'n(E)', d: `Sums ${[2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].filter(s => s % p === 0).map(s => `$${s}$`).join(', ')}: $${nE}$ outcomes` },
        { h: 'n(F)', d: `$${6 - qq} \\times 6 = ${nF}$` },
        { h: 'n(E ∩ F)', d: `First die from $${qq + 1}$ to $6$ with the sum a multiple of $${p}$: $${nEF}$` },
        { h: 'Combine', d: op === 'union' ? `$${nE} + ${nF} - ${nEF} = ${value}$` : op === 'E-not-F' ? `$n(E) - n(E \\cap F) = ${nE} - ${nEF} = ${value}$` : `$36 - (${nE} + ${nF} - ${nEF}) = ${value}$` }
      ],
      reasoning: `two-dice-${op}`
    };
  }
  return sampleSpaceReasoning(makeRng(FALLBACK_SEED));
}

// ═════════════════════════════════════════════════════════════════════════════

/** One rung, D4: every other rung returns the same form (see the header). */
const d4 = form => (rng, _diff) => form(rng);

export const class11JeeHardestForms = Object.freeze({
  'c11-domain-range-reasoning': d4(domainRangeReasoning),
  'c11-real-function-reasoning': d4(realFunctionReasoning),
  'c11-radian-circle-reasoning': d4(radianCircleReasoning),
  'c11-trig-identity-reasoning': d4(trigIdentityReasoning),
  'c11-complex-algebra-reasoning': d4(complexAlgebraReasoning),
  'c11-complex-polar-reasoning': d4(complexPolarReasoning),
  'c11-counting-principle-jee-reasoning': d4(countingPrincipleReasoning),
  'c11-arrangement-jee-reasoning': d4(arrangementReasoning),
  'c11-ap-jee-reasoning': d4(apReasoning),
  'c11-line-equation-jee-reasoning': d4(lineEquationReasoning),
  'c11-line-angle-reasoning': d4(lineAngleReasoning),
  'c11-limit-jee-reasoning': d4(limitReasoning),
  'c11-first-principles-reasoning': d4(firstPrinciplesReasoning),
  'c11-mean-deviation-jee-reasoning': d4(meanDeviationReasoning),
  'c11-variance-reasoning': d4(varianceReasoning),
  'c11-sample-space-jee-reasoning': d4(sampleSpaceReasoning)
});

// Exposed for the independent check, which asserts the tables are non-empty.
export const RANGE_QUOTIENTS_FOR_CHECK = RANGE_QUOTIENTS;
export const MODULUS_BOUNDS_FOR_CHECK = MODULUS_BOUNDS;
