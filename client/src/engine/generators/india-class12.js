// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · NCERT Class 12 — the six chapters that were on NSW banks
//
// Relations and Functions, Inverse Trigonometric Functions, Continuity and
// Differentiability, Application of Derivatives, Integrals, Vector Algebra and
// Probability each had at least one dot point served by an NSW Year 12 or
// Extension generator. Where the two syllabuses diverge, they diverge in ways
// that decide what a Class 12 student should be practising:
//
//   · NSW Year 12 "applications of differentiation" is a curve-sketching
//     course. The CBSE bullet is short and specific — "rate of change of
//     quantities, increasing/decreasing functions, maxima and minima (first
//     derivative test motivated geometrically and second derivative test given
//     as a provable tool)" — so the ladder here is rate of change, then the
//     turning point that separates decreasing from increasing, then tangents
//     and normals, then an optimisation;
//   · NSW integration leads with areas. NCERT Chapter 7 leads with method:
//     substitution, partial fractions, by parts, and a fixed list of standard
//     forms including $\int\frac{dx}{x^2+a^2}$. Those are what D1–D4 ask about;
//   · Class 12 probability in CBSE is conditional probability, the
//     multiplication theorem, independence, total probability and Bayes — the
//     Extension 1 binomial generator was answering a different question.
//
// Source: CBSE Secondary Curriculum 2026–27, Mathematics (041), Class XII
// https://cbseacademic.nic.in/web_material/CurriculumMain27/SecPart2/Maths_SecP2_2026-27.pdf
//   Relations and Functions — "Types of relations… One to one and onto functions."
//   Inverse Trigonometric Functions — "Definition, range, domain, principal
//     value branch."
//   Continuity and Differentiability — "chain rule, derivative of composite
//     functions, derivatives of inverse trigonometric functions like sin⁻¹x,
//     cos⁻¹x and tan⁻¹x, derivative of implicit functions… Derivatives of
//     logarithmic and exponential functions."
//   Applications of Derivatives — "rate of change of quantities,
//     increasing/decreasing functions, maxima and minima".
//   Integrals — "Integration of a variety of functions by substitution, by
//     partial fractions and by parts… ∫dx/(x²±a²)… Fundamental Theorem of
//     Calculus (without proof). Basic properties of definite integrals."
//   Vectors — "Definition, Geometrical Interpretation, properties and
//     application of scalar (dot) product of vectors".
//   Probability — "Conditional probability, multiplication theorem on
//     probability, independent events, total probability, Bayes' theorem."
//
// One honest note lives in the code rather than only in a report: tangents and
// normals were rationalised out of the CBSE Class XII syllabus, but the product
// dot point this bank has to cover still names them, so they hold exactly one
// rung (D3 of `c12-applications-derivatives`) beside the increasing/decreasing
// work that the syllabus does ask for. The same is true of the random variable
// and the binomial distribution in `c12-random-variable`. Neither is padded out
// to look like more of the chapter than it is.
// ─────────────────────────────────────────────────────────────────────────────
import { ri, rc, nz } from '../qhelpers.js';
import { exact, frac, fracTex, traps, twoNames, IN_CITIES } from './india-native-helpers.js';

const cx = (c, v = 'x') => (c === 1 ? v : c === -1 ? `-${v}` : `${c}${v}`);
const sg = k => (k >= 0 ? `+ ${k}` : `- ${Math.abs(k)}`);
/** A power, written the way it is read: x rather than x^{1}. */
const pw = (base, e) => (e === 1 ? base : `${base}^{${e}}`);

const fact = n => (n <= 1 ? 1 : n * fact(n - 1));
const nCr = (n, r) => (r < 0 || r > n ? 0 : Math.round(fact(n) / (fact(r) * fact(n - r))));
const nPr = (n, r) => (r < 0 || r > n ? 0 : Math.round(fact(n) / fact(n - r)));

/** Vectors written the way Class 12 writes them, in î, ĵ, k̂. */
function vecTex([a, b, c]) {
  const parts = [];
  const push = (v, unit) => {
    if (v === 0) return;
    const sign = parts.length === 0 ? (v < 0 ? '-' : '') : (v < 0 ? ' - ' : ' + ');
    const size = Math.abs(v) === 1 ? '' : String(Math.abs(v));
    parts.push(`${sign}${size}${unit}`);
  };
  push(a, '\\hat{i}'); push(b, '\\hat{j}'); push(c, '\\hat{k}');
  return parts.length ? parts.join('') : '\\vec{0}';
}

const dot = (u, v) => u[0] * v[0] + u[1] * v[1] + u[2] * v[2];

/** (x, y, z) triples whose length is a whole number. */
const VEC_LENGTHS = [[1, 2, 2, 3], [2, 3, 6, 7], [1, 4, 8, 9], [2, 6, 9, 11], [3, 4, 12, 13], [4, 4, 7, 9]];

/**
 * Pairs of directions whose angle is one of the exact ones. Both magnitudes and
 * the dot product are whole, so $\cos\theta$ comes out as $\pm\tfrac12$,
 * $\pm\tfrac{1}{\sqrt2}$, $0$ or $\pm 1$ and the angle is a whole number of
 * degrees rather than 63.43494882292201.
 */
const ANGLE_PAIRS = [
  { u: [1, 0, 0], v: [0, 1, 0], deg: 90, note: 'the dot product is zero, so the vectors are perpendicular' },
  { u: [1, 1, 0], v: [1, -1, 0], deg: 90, note: 'the dot product is zero, so the vectors are perpendicular' },
  { u: [1, 0, 0], v: [1, 1, 0], deg: 45, note: '$\\cos\\theta = \\dfrac{1}{\\sqrt2}$' },
  { u: [0, 1, 0], v: [0, 1, 1], deg: 45, note: '$\\cos\\theta = \\dfrac{1}{\\sqrt2}$' },
  { u: [1, 0, 0], v: [-1, 1, 0], deg: 135, note: '$\\cos\\theta = -\\dfrac{1}{\\sqrt2}$' },
  { u: [1, 1, 0], v: [1, 0, 1], deg: 60, note: '$\\cos\\theta = \\dfrac{1}{2}$' },
  { u: [1, 1, 0], v: [0, 1, 1], deg: 60, note: '$\\cos\\theta = \\dfrac{1}{2}$' },
  { u: [1, 1, 0], v: [-1, 0, 1], deg: 120, note: '$\\cos\\theta = -\\dfrac{1}{2}$' },
  { u: [1, 2, 2], v: [1, 2, 2], deg: 0, note: 'the vectors point the same way' },
  { u: [1, 2, 2], v: [-1, -2, -2], deg: 180, note: 'the vectors point in exactly opposite directions' }
];

/** The exact inverse-trigonometric values, in degrees, inside each branch. */
const INVERSE_VALUES = [
  { fn: 'sin', arg: '\\dfrac{1}{2}', deg: 30, branch: '[-90°,\\ 90°]', outside: 150 },
  { fn: 'sin', arg: '-\\dfrac{1}{2}', deg: -30, branch: '[-90°,\\ 90°]', outside: 210 },
  { fn: 'sin', arg: '1', deg: 90, branch: '[-90°,\\ 90°]', outside: 450 },
  { fn: 'sin', arg: '0', deg: 0, branch: '[-90°,\\ 90°]', outside: 180 },
  { fn: 'sin', arg: '-1', deg: -90, branch: '[-90°,\\ 90°]', outside: 270 },
  { fn: 'cos', arg: '\\dfrac{1}{2}', deg: 60, branch: '[0°,\\ 180°]', outside: 300 },
  { fn: 'cos', arg: '-\\dfrac{1}{2}', deg: 120, branch: '[0°,\\ 180°]', outside: 240 },
  { fn: 'cos', arg: '0', deg: 90, branch: '[0°,\\ 180°]', outside: 270 },
  { fn: 'cos', arg: '-1', deg: 180, branch: '[0°,\\ 180°]', outside: -180 },
  { fn: 'tan', arg: '1', deg: 45, branch: '(-90°,\\ 90°)', outside: 225 },
  { fn: 'tan', arg: '-1', deg: -45, branch: '(-90°,\\ 90°)', outside: 135 },
  { fn: 'tan', arg: '0', deg: 0, branch: '(-90°,\\ 90°)', outside: 180 }
];

export const indiaClass12 = {

  // ── Class 12 · Relations and Functions — one-one, onto, inverse ───────────
  // D1 and D3 invert and compose; D2 and D4 count the one-one and onto
  // functions between two finite sets, which is where the definitions stop
  // being vocabulary and start being usable.
  'c12-functions-onto-inverse': (rng, diff) => {
    if (diff === 1) {
      const a = nz(rng, -6, 6), b = nz(rng, -9, 9);
      // k must miss b, or the third distractor below has nothing to divide by
      // — and a question whose answer is 0 makes a weak inverse anyway.
      let k = nz(rng, -9, 9);
      if (k === b) k = b + 1 || 2;
      const want = frac(k - b, a);
      return {
        prompt: `The function $f:\\mathbb{R}\\to\\mathbb{R}$ is given by $f(x) = ${cx(a)} ${sg(b)}$. Find $f^{-1}(${k})$.`,
        answerType: 'numeric', ...exact(want),
        traps: traps(want.value, [
          { value: a * k + b, why: `That is $f(${k})$. The inverse undoes $f$: it answers "which input does $f$ send to $${k}$?"` },
          { value: frac(k + b, a).value, why: `Solving $${cx(a)} ${sg(b)} = ${k}$ takes the $${b}$ across by *subtracting* it: $${cx(a)} = ${k - b}$.` },
          { value: frac(a, k - b).value, why: `After $${cx(a)} = ${k - b}$ the division is by the coefficient: $x = \\dfrac{${k - b}}{${a}}$.` }
        ]),
        hints: [
          '$f^{-1}(y)$ is the $x$ for which $f(x) = y$.',
          `Solve $${cx(a)} ${sg(b)} = ${k}$.`,
          `$${cx(a)} = ${k - b}$, so divide by $${a}$.`
        ],
        steps: [
          { h: 'Set f(x) equal to the value', d: `$${cx(a)} ${sg(b)} = ${k}$` },
          { h: 'Isolate the x term', d: `$${cx(a)} = ${k - b}$` },
          { h: 'Divide by the coefficient', d: `$x = \\dfrac{${k - b}}{${a}} = ${fracTex(want.n, want.d)}$` },
          { h: 'Answer', d: `$f^{-1}(${k}) = ${fracTex(want.n, want.d)}$` }
        ]
      };
    }
    if (diff === 2) {
      const m = ri(rng, 2, 5);
      const n = m + ri(rng, 1, 4);
      const want = nPr(n, m);
      return {
        prompt: `A set $A$ has $${m}$ elements and a set $B$ has $${n}$ elements. How many one-one functions are there from $A$ to $B$?`,
        answerType: 'numeric', answer: { value: want },
        traps: traps(want, [
          { value: Math.pow(n, m), why: `$${n}^{${m}}$ counts *all* functions from $A$ to $B$. A one-one function may not reuse an image, so each choice reduces the pool by one.` },
          { value: nCr(n, m), why: 'A combination counts which $m$ images get used; a function also says which element of $A$ goes to which of them, so the arrangements matter.' },
          { value: m * n, why: 'That counts the pairs in $A \\times B$, not the functions.' }
        ]),
        hints: [
          'A one-one function sends different elements of $A$ to different elements of $B$.',
          `The first element of $A$ has $${n}$ possible images, the next has $${n - 1}$ left, and so on.`,
          `That is $^{${n}}P_{${m}} = ${n} \\times ${n - 1}${m >= 3 ? ` \\times ${n - 2}` : ''}${m >= 4 ? ` \\times ${n - 3}` : ''}$.`
        ],
        steps: [
          { h: 'One-one means no image is reused', d: `Each element of $A$ must take an image no earlier element has taken` },
          { h: 'Count the choices in order', d: `$${n}$ images, then $${n - 1}$, and so on for $${m}$ elements` },
          { h: 'That is a permutation', d: `$^{${n}}P_{${m}} = \\dfrac{${n}!}{${n - m}!}$` },
          { h: 'Evaluate', d: `$= ${want}$` }
        ]
      };
    }
    if (diff === 3) {
      // `a = 1` makes $f$ a pure shift, and then $f \circ g$ and $g \circ f$
      // agree for every choice of the other constants — which would leave the
      // "read the composition the wrong way round" distractor equal to the
      // answer, and the misconception the question exists to catch invisible.
      let a = nz(rng, -5, 5);
      if (a === 1) a = -1;
      const b = nz(rng, -8, 8);
      const c = nz(rng, -5, 5);
      const k = nz(rng, -6, 6);
      // With `a ≠ 1`, each of the two collisions below rules out exactly one
      // value of `d`, so one of the three fallbacks always survives.
      const collides = dd => a * (c * k + dd) + b === c * (a * k + b) + dd || a * (c * k + dd) + b === c * k + dd;
      let d = nz(rng, -8, 8);
      if (collides(d)) d = [1, 2, 3].find(candidate => !collides(candidate));
      const gk = c * k + d;
      const want = a * gk + b;                 // (f ∘ g)(k) = f(g(k))
      const other = c * (a * k + b) + d;       // (g ∘ f)(k)
      return {
        prompt: `Let $f(x) = ${cx(a)} ${sg(b)}$ and $g(x) = ${cx(c)} ${sg(d)}$. Find $(f \\circ g)(${k})$.`,
        answerType: 'numeric', answer: { value: want },
        traps: traps(want, [
          { value: other, why: `That is $(g \\circ f)(${k})$. In $f \\circ g$ the function $g$ acts first — the composition is read right to left.` },
          { value: (a * k + b) * gk, why: 'Composition is not multiplication: the output of $g$ becomes the *input* of $f$.' },
          { value: gk, why: `$${gk}$ is $g(${k})$, which is only the first half. It still has to be fed into $f$.` }
        ]),
        hints: [
          '$(f \\circ g)(x)$ means $f(g(x))$ — $g$ goes first.',
          `$g(${k}) = ${c} \\times (${k}) ${sg(d)} = ${gk}$.`,
          `Now find $f(${gk})$.`
        ],
        steps: [
          { h: 'Read the composition right to left', d: `$(f \\circ g)(${k}) = f\\left(g(${k})\\right)$` },
          { h: 'Apply g first', d: `$g(${k}) = ${c} \\times (${k}) ${sg(d)} = ${gk}$` },
          { h: 'Apply f to that', d: `$f(${gk}) = ${a} \\times (${gk}) ${sg(b)}$` },
          { h: 'Evaluate', d: `$= ${want}$` }
        ]
      };
    }
    // D4 — onto functions onto a two-element set: every function except the two
    // constant ones.
    const n = ri(rng, 3, 9);
    const pair = rc(rng, [['x', 'y'], ['a', 'b'], ['p', 'q'], ['0', '1'], ['u', 'v']]);
    const want = Math.pow(2, n) - 2;
    return {
      prompt: `A set $A$ has $${n}$ elements and $B = \\{${pair[0]},\\ ${pair[1]}\\}$. How many onto functions are there from $A$ to $B$?`,
      answerType: 'numeric', answer: { value: want },
      traps: traps(want, [
        { value: Math.pow(2, n), why: `$2^{${n}} = ${Math.pow(2, n)}$ counts every function from $A$ to $B$. Two of them miss a value of $B$ altogether — the one sending everything to $x$ and the one sending everything to $y$.` },
        { value: Math.pow(2, n) - 1, why: 'There are *two* constant functions to remove, one for each element of $B$, not one.' },
        { value: nPr(n, 2), why: 'This counts which two elements of $A$ are picked and in what order, which is not what an onto function is.' }
      ]),
      hints: [
        `Each of the $${n}$ elements of $A$ has $2$ possible images, so there are $2^{${n}} = ${Math.pow(2, n)}$ functions in all.`,
        'A function fails to be onto exactly when it misses one of the two values.',
        'Only the two constant functions miss a value, so subtract $2$.'
      ],
      steps: [
        { h: 'Count all functions', d: `Each of $${n}$ elements has $2$ images: $2^{${n}} = ${Math.pow(2, n)}$` },
        { h: 'Find the ones that are not onto', d: 'A function misses a value of $B$ only if it is constant — and there are two constants' },
        { h: 'Subtract them', d: `$${Math.pow(2, n)} - 2 = ${want}$` }
      ]
    };
  },

  // ── Class 12 · Inverse Trigonometric Functions ───────────────────────────
  // The chapter is the branch, first and last: D1 asks for the branch itself,
  // D2 evaluates inside it, D3 uses the complementary identity and D4 the
  // addition formula for two arctangents.
  'c12-inverse-trigonometric': (rng, diff) => {
    if (diff === 1) {
      // All six inverse ratios: NCERT's opening section defines the domain,
      // range and principal value branch of every one of them, and the branches
      // are not interchangeable — that is exactly the confusion the distractors
      // below name. `cosec` is written with \operatorname because it is the
      // Indian spelling and KaTeX has no \cosec.
      const branches = [
        { fn: 'sin', tex: '\\sin', lo: -90, hi: 90, interval: '[-90°,\\ 90°]', aside: '', other: 'cos', otherTex: '\\cos', otherLo: 0, otherHi: 180 },
        { fn: 'cos', tex: '\\cos', lo: 0, hi: 180, interval: '[0°,\\ 180°]', aside: '', other: 'sin', otherTex: '\\sin', otherLo: -90, otherHi: 90 },
        { fn: 'tan', tex: '\\tan', lo: -90, hi: 90, interval: '(-90°,\\ 90°)', aside: ', with the endpoints excluded', other: 'cos', otherTex: '\\cos', otherLo: 0, otherHi: 180 },
        { fn: 'cot', tex: '\\cot', lo: 0, hi: 180, interval: '(0°,\\ 180°)', aside: ', with the endpoints excluded', other: 'tan', otherTex: '\\tan', otherLo: -90, otherHi: 90 },
        { fn: 'sec', tex: '\\sec', lo: 0, hi: 180, interval: '[0°,\\ 180°]', aside: ', with $90°$ excluded', other: 'cosec', otherTex: '\\operatorname{cosec}', otherLo: -90, otherHi: 90 },
        { fn: 'cosec', tex: '\\operatorname{cosec}', lo: -90, hi: 90, interval: '[-90°,\\ 90°]', aside: ', with $0°$ excluded', other: 'sec', otherTex: '\\sec', otherLo: 0, otherHi: 180 }
      ];
      const b = rc(rng, branches);
      const askHigh = rng() < 0.5;
      const want = askHigh ? b.hi : b.lo;
      return {
        prompt: `Give the ${askHigh ? 'upper' : 'lower'} end, in degrees, of the principal value branch of $${b.tex}^{-1}$.`,
        answerType: 'numeric', answer: { value: want }, answerSuffix: 'degrees',
        traps: traps(want, [
          { value: askHigh ? b.otherHi : b.otherLo, why: `That is the ${askHigh ? 'upper' : 'lower'} end of the branch of $${b.otherTex}^{-1}$. Each inverse ratio is given its own branch, chosen so the original function is one-one on it.` },
          { value: -want, why: `The branch of $${b.tex}^{-1}$ is $${b.interval}$ — check which end the question asked for.` },
          { value: askHigh ? 360 : -360, why: 'A principal value branch is one interval of length at most a half turn, not a full revolution.' }
        ]),
        hints: [
          `$${b.tex}$ is not one-one on all of $\\mathbb{R}$, so its inverse is defined on one chosen interval.`,
          `That interval for $${b.tex}^{-1}$ is $${b.interval}$${b.aside}.`,
          `The ${askHigh ? 'upper' : 'lower'} end is the ${askHigh ? 'larger' : 'smaller'} of the two.`
        ],
        steps: [
          { h: 'Why a branch is needed', d: `$${b.tex}$ repeats, so it has no inverse until its domain is cut down to a piece on which it is one-one` },
          { h: 'The chosen branch', d: `$${b.tex}^{-1}$ takes values in $${b.interval}$${b.aside}` },
          { h: 'Read off the end asked for', d: `$${want}°$` }
        ]
      };
    }
    if (diff === 2) {
      const v = rc(rng, INVERSE_VALUES);
      return {
        prompt: `Find the principal value of $\\${v.fn}^{-1}\\left(${v.arg}\\right)$, in degrees.`,
        answerType: 'numeric', answer: { value: v.deg }, answerSuffix: 'degrees',
        traps: traps(v.deg, [
          { value: v.outside, why: `$\\${v.fn} ${v.outside}°$ does give that value, but $${v.outside}°$ is outside the principal value branch $${v.branch}$, and the principal value is the one representative inside it.` },
          { value: -v.deg, why: `Check the sign against the branch $${v.branch}$: only one of $${v.deg}°$ and $${-v.deg}°$ lies in it and satisfies the equation.` },
          { value: 90 - v.deg, why: `That is the complementary angle. $\\${v.fn}^{-1}$ asks for the angle whose $\\${v.fn}$ is the given number, not for what is left of a right angle.` }
        ]),
        hints: [
          `You are looking for the angle $\\theta$ with $\\${v.fn}\\theta = ${v.arg}$.`,
          `It has to lie in the principal value branch $${v.branch}$.`,
          'Exactly one angle in that branch works.'
        ],
        steps: [
          { h: 'Write the defining equation', d: `$\\${v.fn}\\theta = ${v.arg}$` },
          { h: 'Restrict to the principal branch', d: `$\\theta \\in ${v.branch}$` },
          { h: 'Identify the angle', d: `$\\theta = ${v.deg}°$` }
        ]
      };
    }
    if (diff === 3) {
      const t = rc(rng, [0, 30, 45, 60, 90, -30, -45, -60, -90]);
      const want = 90 - t;
      return {
        prompt: `For a number $x$ in $[-1,\\ 1]$, $\\sin^{-1}x = ${t}°$. Find $\\cos^{-1}x$, in degrees.`,
        answerType: 'numeric', answer: { value: want }, answerSuffix: 'degrees',
        traps: traps(want, [
          { value: 180 - t, why: '$\\sin^{-1}x + \\cos^{-1}x = 90°$, not $180°$ — the two angles are complementary, not supplementary.' },
          { value: t, why: 'The two inverse ratios agree only when both are $45°$; in general they add to a right angle.' },
          { value: -t, why: 'The identity fixes the *sum* at $90°$, so subtract from $90°$ rather than changing the sign.' }
        ]),
        hints: [
          'There is a standard identity connecting the two.',
          '$\\sin^{-1}x + \\cos^{-1}x = 90°$ for every $x$ in $[-1,\\ 1]$.',
          `So $\\cos^{-1}x = 90° - (${t}°)$.`
        ],
        steps: [
          { h: 'Use the complementary identity', d: '$\\sin^{-1}x + \\cos^{-1}x = 90°$' },
          { h: 'Substitute', d: `$${t}° + \\cos^{-1}x = 90°$` },
          { h: 'Solve', d: `$\\cos^{-1}x = ${want}°$` }
        ]
      };
    }
    // D4 — the addition formula for two arctangents.
    const p = ri(rng, 2, 6);
    let q = ri(rng, 2, 6);
    if (p * q <= 1) q = 2;
    const want = frac(p + q, p * q - 1);
    return {
      prompt: `Using $\\tan^{-1}x + \\tan^{-1}y = \\tan^{-1}\\dfrac{x+y}{1-xy}$ for $xy < 1$, write $\\tan^{-1}\\dfrac{1}{${p}} + \\tan^{-1}\\dfrac{1}{${q}}$ as $\\tan^{-1}k$. Find $k$.`,
      answerType: 'numeric', ...exact(want),
      traps: traps(want.value, [
        { value: frac(p + q, p * q + 1).value, why: `The denominator is $1 - xy$, and $xy = \\dfrac{1}{${p * q}}$, so it is $1 - \\dfrac{1}{${p * q}} = \\dfrac{${p * q - 1}}{${p * q}}$ — the product is subtracted, not added.` },
        { value: frac(p + q, p * q).value, why: 'The numerator $\\dfrac{1}{x} + \\dfrac{1}{y}$ has been divided by $xy$ alone; the $1$ in $1 - xy$ is part of the formula.' },
        { value: frac(1, p).value + frac(1, q).value, why: 'Adding the two arguments would only be right if the arctangent were additive, which is exactly what the formula says it is not.' }
      ]),
      hints: [
        `Here $x = \\dfrac{1}{${p}}$ and $y = \\dfrac{1}{${q}}$, so $xy = \\dfrac{1}{${p * q}} < 1$.`,
        `$x + y = \\dfrac{1}{${p}} + \\dfrac{1}{${q}} = \\dfrac{${p + q}}{${p * q}}$.`,
        `$1 - xy = \\dfrac{${p * q - 1}}{${p * q}}$ — now divide.`
      ],
      steps: [
        { h: 'Check the condition', d: `$xy = \\dfrac{1}{${p * q}} < 1$, so the formula applies` },
        { h: 'Add the arguments', d: `$x + y = \\dfrac{${p + q}}{${p * q}}$` },
        { h: 'Form the denominator', d: `$1 - xy = \\dfrac{${p * q - 1}}{${p * q}}$` },
        { h: 'Divide', d: `$k = \\dfrac{${p + q}}{${p * q}} \\div \\dfrac{${p * q - 1}}{${p * q}} = ${fracTex(want.n, want.d)}$` }
      ]
    };
  },

  // ── Class 12 · Continuity and Differentiability — the differentiation rules
  // Chain rule, logarithmic, implicit and inverse-trigonometric differentiation
  // — the four techniques the chapter's second half is made of, one per rung.
  'c12-differentiation-rules': (rng, diff) => {
    if (diff === 1) {
      const a = ri(rng, 1, 4);
      const n = ri(rng, 2, 3);
      const p = ri(rng, 0, 3);
      // The inside function is built backwards from the value it must take at
      // x = p, which keeps the arithmetic small; `u` is nudged when that would
      // leave a constant term of zero, because "(2x + 0)^2" reads like a bug.
      let u = ri(rng, 1, 3);
      if (u === a * p) u = a * p + 1;
      const b = u - a * p;                       // so that ap + b = u
      const want = n * a * Math.pow(u, n - 1);
      return {
        prompt: `Let $y = (${cx(a)} ${sg(b)})^{${n}}$. Find $\\dfrac{dy}{dx}$ at $x = ${p}$.`,
        answerType: 'numeric', answer: { value: want },
        traps: traps(want, [
          { value: n * Math.pow(u, n - 1), why: `The chain rule multiplies by the derivative of the inside, and the inside $${cx(a)} ${sg(b)}$ has derivative $${a}$.` },
          { value: a * Math.pow(u, n - 1), why: `The power $${n}$ comes down as a factor as well: $\\dfrac{d}{dx}u^{${n}} = ${n}u^{${n - 1}}\\dfrac{du}{dx}$.` },
          { value: Math.pow(u, n), why: `$${Math.pow(u, n)}$ is the value of $y$ at $x = ${p}$, not of its derivative.` }
        ]),
        hints: [
          `Put $u = ${cx(a)} ${sg(b)}$, so $y = u^{${n}}$.`,
          `$\\dfrac{dy}{dx} = ${n}u^{${n - 1}} \\times \\dfrac{du}{dx}$ and $\\dfrac{du}{dx} = ${a}$.`,
          `At $x = ${p}$, $u = ${u}$.`
        ],
        steps: [
          { h: 'Name the inside function', d: `$u = ${cx(a)} ${sg(b)}$, so $y = u^{${n}}$` },
          { h: 'Apply the chain rule', d: `$\\dfrac{dy}{dx} = ${n}u^{${n - 1}} \\cdot \\dfrac{du}{dx} = ${n}(${cx(a)} ${sg(b)})^{${n - 1}} \\times ${a}$` },
          { h: 'Substitute', d: `At $x = ${p}$ the inside is $${u}$, so $\\dfrac{dy}{dx} = ${n} \\times ${Math.pow(u, n - 1)} \\times ${a}$` },
          { h: 'Evaluate', d: `$= ${want}$` }
        ]
      };
    }
    if (diff === 2) {
      const a = ri(rng, 2, 7), p = ri(rng, 0, 5);
      const b = ri(rng, 1, 6);
      const want = frac(a, a * p + b);
      return {
        prompt: `Let $y = \\log_e(${cx(a)} + ${b})$. Find $\\dfrac{dy}{dx}$ at $x = ${p}$.`,
        answerType: 'numeric', ...exact(want),
        traps: traps(want.value, [
          { value: frac(1, a * p + b).value, why: `$\\dfrac{d}{dx}\\log_e u = \\dfrac{1}{u}\\dfrac{du}{dx}$ — the derivative of the inside, $${a}$, multiplies the result.` },
          { value: frac(a * p + b, a).value, why: 'The fraction is inverted: the inside function goes in the denominator.' },
          { value: a, why: 'That is only $\\dfrac{du}{dx}$; it still has to be divided by $u$.' }
        ]),
        hints: [
          `Put $u = ${cx(a)} + ${b}$.`,
          '$\\dfrac{d}{dx}\\log_e u = \\dfrac{1}{u} \\cdot \\dfrac{du}{dx}$.',
          `At $x = ${p}$, $u = ${a * p + b}$ and $\\dfrac{du}{dx} = ${a}$.`
        ],
        steps: [
          { h: 'Name the inside function', d: `$u = ${cx(a)} + ${b}$, so $\\dfrac{du}{dx} = ${a}$` },
          { h: 'Differentiate the logarithm', d: `$\\dfrac{dy}{dx} = \\dfrac{1}{u} \\cdot ${a} = \\dfrac{${a}}{${cx(a)} + ${b}}$` },
          { h: 'Substitute', d: `At $x = ${p}$: $\\dfrac{${a}}{${a * p + b}}$` },
          { h: 'Reduce', d: `$= ${fracTex(want.n, want.d)}$` }
        ]
      };
    }
    if (diff === 3) {
      const [x0, y0, r] = rc(rng, [[3, 4, 5], [4, 3, 5], [5, 12, 13], [12, 5, 13], [8, 15, 17], [15, 8, 17], [7, 24, 25], [20, 21, 29]]);
      const sx = rng() < 0.5 ? x0 : -x0;
      const sy = rng() < 0.5 ? y0 : -y0;
      const want = frac(-sx, sy);
      return {
        prompt: `The curve $x^2 + y^2 = ${r * r}$ passes through $(${sx},\\ ${sy})$. Using implicit differentiation, find $\\dfrac{dy}{dx}$ there.`,
        answerType: 'numeric', ...exact(want),
        traps: traps(want.value, [
          { value: frac(sx, sy).value, why: 'Differentiating gives $2x + 2y\\dfrac{dy}{dx} = 0$, so $\\dfrac{dy}{dx} = -\\dfrac{x}{y}$ — the minus sign comes from moving the $2x$ across.' },
          { value: frac(-sy, sx).value, why: 'The $x$ and $y$ are the wrong way round: $\\dfrac{dy}{dx} = -\\dfrac{x}{y}$.' },
          { value: frac(sy, sx).value, why: 'That is the slope of the radius to the point. The tangent is perpendicular to it, so its slope is the negative reciprocal.' }
        ]),
        hints: [
          'Differentiate both sides with respect to $x$, treating $y$ as a function of $x$.',
          `$2x + 2y\\dfrac{dy}{dx} = 0$.`,
          `Make $\\dfrac{dy}{dx}$ the subject, then substitute $(${sx},\\ ${sy})$.`
        ],
        steps: [
          { h: 'Differentiate both sides', d: `$\\dfrac{d}{dx}\\left(x^2 + y^2\\right) = 2x + 2y\\dfrac{dy}{dx}$, and the right-hand side is constant` },
          { h: 'Solve for dy/dx', d: '$2x + 2y\\dfrac{dy}{dx} = 0 \\Rightarrow \\dfrac{dy}{dx} = -\\dfrac{x}{y}$' },
          { h: 'Substitute the point', d: `$\\dfrac{dy}{dx} = -\\dfrac{${sx}}{${sy}}$` },
          { h: 'Simplify', d: `$= ${fracTex(want.n, want.d)}$` }
        ]
      };
    }
    // D4 — the derivative of an inverse trigonometric function.
    const a = ri(rng, 1, 5);
    let p = ri(rng, 0, 4);
    // Two evaluation points have to be avoided. $ax = 1$ makes the "$1 - u^2$"
    // misconception undefined rather than wrong, and $a = 1$ with $x = 0$ makes
    // every designed distractor equal to the answer — a question with no usable
    // wrong answer teaches nothing about why an answer is wrong.
    if (a * p === 1 || (a === 1 && p === 0)) p = 2;
    const want = frac(a, 1 + a * a * p * p);
    return {
      prompt: `Let $y = \\tan^{-1}(${cx(a)})$. Find $\\dfrac{dy}{dx}$ at $x = ${p}$.`,
      answerType: 'numeric', ...exact(want),
      traps: traps(want.value, [
        { value: frac(1, 1 + a * a * p * p).value, why: `$\\dfrac{d}{dx}\\tan^{-1}u = \\dfrac{1}{1+u^2}\\dfrac{du}{dx}$, and the inside $${cx(a)}$ has derivative $${a}$.` },
        { value: frac(a, 1 - a * a * p * p).value, why: 'The denominator of the arctangent derivative is $1 + u^2$. The minus belongs to $\\sin^{-1}$, under a square root.' },
        { value: 1 + a * a * p * p, why: 'That is the denominator on its own — the derivative is its reciprocal, times the derivative of the inside.' }
      ]),
      hints: [
        `Put $u = ${cx(a)}$, so $\\dfrac{du}{dx} = ${a}$.`,
        '$\\dfrac{d}{dx}\\tan^{-1}u = \\dfrac{1}{1+u^2} \\cdot \\dfrac{du}{dx}$.',
        `At $x = ${p}$, $u^2 = ${a * a * p * p}$.`
      ],
      steps: [
        { h: 'Name the inside function', d: `$u = ${cx(a)}$, so $\\dfrac{du}{dx} = ${a}$` },
        { h: 'Differentiate the arctangent', d: `$\\dfrac{dy}{dx} = \\dfrac{${a}}{1 + ${a * a}x^2}$` },
        { h: 'Substitute', d: `At $x = ${p}$: $\\dfrac{${a}}{1 + ${a * a * p * p}} = \\dfrac{${a}}{${1 + a * a * p * p}}$` },
        { h: 'Reduce', d: `$= ${fracTex(want.n, want.d)}$` }
      ]
    };
  },

  // ── Class 12 · Application of Derivatives ────────────────────────────────
  // Rate of change, then the point where a parabola turns from decreasing to
  // increasing, then a tangent or a normal, then an optimisation. The
  // optimisations are the two NCERT sets over and over — a sum split to
  // maximise a product, and a fixed length of fencing.
  'c12-applications-derivatives': (rng, diff) => {
    if (diff === 1) {
      const rate = ri(rng, 2, 9);
      const side = ri(rng, 3, 20);
      const want = 2 * side * rate;
      const [maker] = twoNames(rng);
      return {
        prompt: `A square sheet of steel in ${maker}'s workshop is being heated, and its side is increasing at $${rate}$ cm/s. Find the rate at which its area is increasing at the instant the side is $${side}$ cm.`,
        answerType: 'numeric', answer: { value: want }, answerSuffix: 'cm²/s',
        traps: traps(want, [
          { value: side * rate, why: `$A = x^2$, so $\\dfrac{dA}{dt} = 2x\\dfrac{dx}{dt}$ — the factor of $2$ comes from differentiating the square.` },
          { value: side * side, why: `$${side * side}$ is the area at that instant, not the rate at which it is changing.` },
          { value: 2 * side, why: `That is $\\dfrac{dA}{dx}$; the chain rule still multiplies it by $\\dfrac{dx}{dt} = ${rate}$.` }
        ]),
        hints: [
          'Write the area in terms of the side, then differentiate with respect to time.',
          `$A = x^2$, so $\\dfrac{dA}{dt} = 2x\\dfrac{dx}{dt}$.`,
          `Here $x = ${side}$ and $\\dfrac{dx}{dt} = ${rate}$.`
        ],
        steps: [
          { h: 'Relate the quantities', d: '$A = x^2$, where $x$ is the side in cm' },
          { h: 'Differentiate with respect to time', d: '$\\dfrac{dA}{dt} = 2x\\,\\dfrac{dx}{dt}$' },
          { h: 'Substitute', d: `$= 2 \\times ${side} \\times ${rate}$` },
          { h: 'Evaluate', d: `$= ${want}$ cm²/s` }
        ]
      };
    }
    if (diff === 2) {
      const a = ri(rng, 1, 5);
      const b = nz(rng, -18, 18);
      const c = nz(rng, -9, 9);
      const want = frac(-b, 2 * a);
      return {
        prompt: `The function $f(x) = ${cx(a)}^2 ${sg(b)}x ${sg(c)}$ is decreasing for $x < k$ and increasing for $x > k$. Find $k$.`,
        answerType: 'numeric', ...exact(want),
        traps: traps(want.value, [
          { value: frac(b, 2 * a).value, why: `$f'(x) = ${2 * a}x ${sg(b)}$, and setting it to zero gives $${2 * a}x = ${-b}$ — the sign changes when the term crosses over.` },
          { value: frac(-b, a).value, why: `Differentiating $${cx(a)}^2$ gives $${2 * a}x$, so the coefficient to divide by is $${2 * a}$, not $${a}$.` },
          { value: c, why: 'The constant term vanishes under differentiation, so it cannot decide where the function turns.' }
        ]),
        hints: [
          'A function changes from decreasing to increasing where its derivative changes sign.',
          `$f'(x) = ${2 * a}x ${sg(b)}$.`,
          `Solve $f'(x) = 0$; because $${a} > 0$ the derivative is negative to the left of it and positive to the right.`
        ],
        steps: [
          { h: 'Differentiate', d: `$f'(x) = ${2 * a}x ${sg(b)}$` },
          { h: 'Find where the derivative vanishes', d: `$${2 * a}x ${sg(b)} = 0 \\Rightarrow x = ${fracTex(-b, 2 * a)}$` },
          { h: 'Check the sign change', d: `$f'$ is negative for smaller $x$ and positive for larger $x$, because the coefficient $${a}$ is positive` },
          { h: 'Answer', d: `$k = ${fracTex(want.n, want.d)}$` }
        ]
      };
    }
    if (diff === 3) {
      const a = nz(rng, -4, 4), b = nz(rng, -6, 6), c = nz(rng, -9, 9);
      const p = nz(rng, -4, 4);
      const slope = 3 * a * p * p + 2 * b * p;
      if (slope === 0) return indiaClass12['c12-applications-derivatives'](rng, 2);
      const askNormal = rng() < 0.5;
      const want = askNormal ? frac(-1, slope) : frac(slope, 1);
      return {
        prompt: `Find the slope of the ${askNormal ? 'normal' : 'tangent'} to the curve $y = ${cx(a)}^3 ${sg(b)}x^2 ${sg(c)}$ at the point where $x = ${p}$.`,
        answerType: 'numeric', ...exact(want),
        traps: traps(want.value, [
          {
            value: askNormal ? slope : frac(-1, slope).value,
            why: askNormal
              ? 'That is the slope of the *tangent*. The normal is perpendicular to it, so its slope is the negative reciprocal.'
              : 'That is the slope of the *normal*, the negative reciprocal of what was asked for.'
          },
          { value: askNormal ? frac(1, slope).value : -slope, why: 'The normal\'s slope is $-\\dfrac{1}{m}$: both the reciprocal and the sign change.' },
          { value: a * p * p * p + b * p * p + c, why: `That is the $y$-coordinate of the point, not a slope.` }
        ]),
        hints: [
          'The slope of the tangent at a point is the derivative there.',
          `$\\dfrac{dy}{dx} = ${3 * a}x^2 ${sg(2 * b)}x$, so at $x = ${p}$ the tangent has slope $${slope}$.`,
          askNormal ? 'The normal is perpendicular to the tangent, so its slope is $-\\dfrac{1}{m}$.' : 'That derivative is the answer.'
        ],
        steps: [
          { h: 'Differentiate', d: `$\\dfrac{dy}{dx} = ${3 * a}x^2 ${sg(2 * b)}x$` },
          { h: 'Evaluate at the point', d: `$\\left.\\dfrac{dy}{dx}\\right|_{x=${p}} = ${slope}$ — the slope of the tangent` },
          ...(askNormal
            ? [{ h: 'Take the perpendicular slope', d: `Normal slope $= -\\dfrac{1}{${slope}} = ${fracTex(want.n, want.d)}$` }]
            : [{ h: 'Answer', d: `Tangent slope $= ${slope}$` }])
        ]
      };
    }
    // D4 — an optimisation, in the two shapes NCERT sets again and again.
    const fencing = rng() < 0.5;
    if (fencing) {
      const half = 2 * ri(rng, 6, 30);
      const L = 2 * half;                          // divisible by 4
      const want = (L * L) / 8;
      const [farmer] = twoNames(rng);
      return {
        prompt: `${farmer} has $${L}$ m of fencing and wants to enclose a rectangular vegetable plot beside a straight canal in ${rc(rng, IN_CITIES)}, fencing only the three sides away from the water. Find the greatest area that can be enclosed.`,
        answerType: 'numeric', answer: { value: want }, answerSuffix: 'square metres',
        traps: traps(want, [
          { value: (L * L) / 16, why: `That is the largest area when all *four* sides are fenced. Here the canal supplies one side, so the same fencing reaches further.` },
          { value: L * L, why: 'A length of fencing is not an area — the area comes out of maximising $x(L - 2x)$.' },
          { value: L / 4, why: 'That is a length. The question asks for the area it encloses.' }
        ]),
        hints: [
          `Let the two sides perpendicular to the canal be $x$ m each; the side parallel to it is then $${L} - 2x$ m.`,
          `$A(x) = x(${L} - 2x)$.`,
          `$A'(x) = ${L} - 4x$, which is zero at $x = ${L / 4}$.`
        ],
        steps: [
          { h: 'Set up the model', d: `Two sides of $x$ m and one of $${L} - 2x$ m, so $A(x) = x(${L} - 2x)$` },
          { h: 'Differentiate', d: `$A'(x) = ${L} - 4x$` },
          { h: 'Find the stationary point', d: `$A'(x) = 0$ at $x = ${L / 4}$, and $A''(x) = -4 < 0$, so it is a maximum` },
          { h: 'Evaluate the maximum', d: `$A(${L / 4}) = ${L / 4} \\times ${L - 2 * (L / 4)} = ${want}$ square metres` }
        ]
      };
    }
    const S = 2 * ri(rng, 4, 30);
    const want = (S * S) / 4;
    return {
      prompt: `Two positive numbers add up to $${S}$. Find the greatest possible value of their product.`,
      answerType: 'numeric', answer: { value: want },
      traps: traps(want, [
        { value: S / 2, why: `$${S / 2}$ is each of the two numbers at the maximum. Their *product* is what the question asks for.` },
        { value: (S * S) / 2, why: `The product is $x(${S} - x)$, largest at $x = ${S / 2}$, which gives $${S / 2} \\times ${S / 2}$.` },
        { value: S, why: 'That is the sum they start from, which is fixed.' }
      ]),
      hints: [
        `Let the numbers be $x$ and $${S} - x$.`,
        `$P(x) = x(${S} - x) = ${S}x - x^2$.`,
        `$P'(x) = ${S} - 2x$, which is zero at $x = ${S / 2}$.`
      ],
      steps: [
        { h: 'Set up the model', d: `$P(x) = x(${S} - x)$ for $0 < x < ${S}$` },
        { h: 'Differentiate', d: `$P'(x) = ${S} - 2x$` },
        { h: 'Find the stationary point', d: `$P'(x) = 0$ at $x = ${S / 2}$, and $P''(x) = -2 < 0$, so it is a maximum` },
        { h: 'Evaluate the maximum', d: `$P(${S / 2}) = ${S / 2} \\times ${S / 2} = ${want}$` }
      ]
    };
  },

  // ── Class 12 · Integrals — the methods ───────────────────────────────────
  // Substitution, partial fractions, integration by parts and the standard form
  // $\int\frac{dx}{x^2+a^2}$, all asked as "here is the answer with one number
  // taken out of it — put it back", which is what a marker can check exactly.
  'c12-integrals-methods': (rng, diff) => {
    if (diff === 1) {
      const a = ri(rng, 2, 9), b = nz(rng, -9, 9), n = ri(rng, 2, 6);
      const want = a * (n + 1);
      return {
        prompt: `By substitution, $\\displaystyle\\int (${cx(a)} ${sg(b)})^{${n}}\\,dx = \\dfrac{(${cx(a)} ${sg(b)})^{${n + 1}}}{k} + C$. Find $k$.`,
        answerType: 'numeric', answer: { value: want }, answerPrefix: 'k =',
        traps: traps(want, [
          { value: n + 1, why: `The substitution $u = ${cx(a)} ${sg(b)}$ gives $du = ${a}\\,dx$, so a factor of $\\dfrac{1}{${a}}$ comes out as well: the denominator is $${a} \\times ${n + 1}$.` },
          { value: a, why: `The power rule contributes the $${n + 1}$ in the denominator; the substitution contributes the $${a}$. Both are there.` },
          { value: n, why: `Integrating raises the power to $${n + 1}$, and it is the *new* power that divides.` }
        ]),
        hints: [
          `Substitute $u = ${cx(a)} ${sg(b)}$, so $du = ${a}\\,dx$ and $dx = \\dfrac{du}{${a}}$.`,
          `The integral becomes $\\dfrac{1}{${a}}\\displaystyle\\int u^{${n}}\\,du = \\dfrac{1}{${a}} \\cdot \\dfrac{u^{${n + 1}}}{${n + 1}}$.`,
          `So the denominator is $${a} \\times ${n + 1}$.`
        ],
        steps: [
          { h: 'Substitute', d: `$u = ${cx(a)} ${sg(b)}$, $du = ${a}\\,dx$` },
          { h: 'Rewrite the integral', d: `$\\displaystyle\\int u^{${n}}\\,\\dfrac{du}{${a}} = \\dfrac{1}{${a}}\\displaystyle\\int u^{${n}}\\,du$` },
          { h: 'Apply the power rule', d: `$= \\dfrac{1}{${a}} \\cdot \\dfrac{u^{${n + 1}}}{${n + 1}} = \\dfrac{u^{${n + 1}}}{${want}}$` },
          { h: 'Read off k', d: `$k = ${want}$` }
        ]
      };
    }
    if (diff === 2) {
      // The two roots are kept at least 2 apart. At a distance of 1 the answer
      // is $\pm 1$ and every designed distractor collapses onto it, leaving a
      // question whose wrong answers say nothing about why they are wrong.
      const a = nz(rng, -8, 8);
      let b = nz(rng, -8, 8);
      let guard = 30;
      while (guard-- > 0 && Math.abs(a - b) < 2) b = nz(rng, -8, 8);
      if (Math.abs(a - b) < 2) b = a > 0 ? -2 : 2;
      const want = frac(1, a - b);
      return {
        prompt: `In the partial-fraction decomposition $\\dfrac{1}{(x ${sg(-a)})(x ${sg(-b)})} = \\dfrac{A}{x ${sg(-a)}} + \\dfrac{B}{x ${sg(-b)}}$, find $A$.`,
        answerType: 'numeric', ...exact(want),
        traps: traps(want.value, [
          { value: frac(1, b - a).value, why: `That is $B$. Covering up $(x ${sg(-a)})$ and putting $x = ${a}$ into what is left gives $A = \\dfrac{1}{${a} - (${b})}$.` },
          { value: a - b, why: `$${a - b}$ is the denominator of $A$; $A$ itself is its reciprocal.` },
          { value: 1, why: 'Multiplying up gives $1 = A(x - b) + B(x - a)$, so $A$ is what makes that identity hold, not the constant on the left.' }
        ]),
        hints: [
          `Multiply both sides by $(x ${sg(-a)})(x ${sg(-b)})$ to get $1 = A(x ${sg(-b)}) + B(x ${sg(-a)})$.`,
          `Choose $x = ${a}$, which kills the $B$ term.`,
          `Then $1 = A(${a} - (${b})) = A \\times ${a - b}$.`
        ],
        steps: [
          { h: 'Clear the denominators', d: `$1 = A(x ${sg(-b)}) + B(x ${sg(-a)})$` },
          { h: 'Substitute the root that kills B', d: `$x = ${a}$ gives $1 = A(${a} ${sg(-b)})$` },
          { h: 'Solve', d: `$A = \\dfrac{1}{${a - b}} = ${fracTex(want.n, want.d)}$` }
        ]
      };
    }
    if (diff === 3) {
      const m = nz(rng, -9, 9);
      const want = m - 1;
      return {
        prompt: `Integrating by parts, $\\displaystyle\\int (x ${sg(m)})e^{x}\\,dx = (x + k)e^{x} + C$. Find $k$.`,
        answerType: 'numeric', answer: { value: want }, answerPrefix: 'k =',
        traps: traps(want, [
          { value: m, why: `By parts gives $(x ${sg(m)})e^x - \\displaystyle\\int e^x\\,dx = (x ${sg(m)})e^x - e^x$, and that leftover $-e^x$ takes the constant down by one.` },
          { value: m + 1, why: 'The second integral is *subtracted*, so the constant goes down by one rather than up.' },
          { value: -m, why: 'The sign of the constant inside the bracket is unchanged by the integration; only the $-1$ is new.' }
        ]),
        hints: [
          `Take $u = x ${sg(m)}$ and $dv = e^x\\,dx$, so $du = dx$ and $v = e^x$.`,
          '$\\displaystyle\\int u\\,dv = uv - \\displaystyle\\int v\\,du$.',
          `That gives $(x ${sg(m)})e^x - \\displaystyle\\int e^x\\,dx$.`
        ],
        steps: [
          { h: 'Choose u and dv', d: `$u = x ${sg(m)}$, $dv = e^x\\,dx$, so $du = dx$ and $v = e^x$` },
          { h: 'Apply integration by parts', d: `$= (x ${sg(m)})e^x - \\displaystyle\\int e^x\\,dx$` },
          { h: 'Integrate what is left', d: `$= (x ${sg(m)})e^x - e^x = (x ${sg(want)})e^x$` },
          { h: 'Read off k', d: `$k = ${want}$` }
        ]
      };
    }
    // D4 — one of the standard forms the syllabus lists by name.
    const a = ri(rng, 2, 20);
    return {
      prompt: `The standard integral $\\displaystyle\\int \\dfrac{dx}{x^2 + ${a * a}} = \\dfrac{1}{k}\\tan^{-1}\\left(\\dfrac{x}{${a}}\\right) + C$. Find $k$.`,
      answerType: 'numeric', answer: { value: a }, answerPrefix: 'k =',
      traps: traps(a, [
        { value: a * a, why: `The standard form is $\\displaystyle\\int\\dfrac{dx}{x^2+a^2} = \\dfrac{1}{a}\\tan^{-1}\\dfrac{x}{a} + C$ — the constant in front is $\\dfrac{1}{a}$, and here $a = ${a}$, not $a^2 = ${a * a}$.` },
        { value: 2 * a, why: 'The $2$ belongs to $\\displaystyle\\int\\dfrac{dx}{x^2-a^2}$, which gives a logarithm with $\\dfrac{1}{2a}$ in front — not this form.' },
        { value: 1, why: `$\\displaystyle\\int\\dfrac{dx}{x^2+1} = \\tan^{-1}x + C$ only when $a = 1$. Here $a = ${a}$.` }
      ]),
      hints: [
        'Compare with the standard form $\\displaystyle\\int\\dfrac{dx}{x^2+a^2} = \\dfrac{1}{a}\\tan^{-1}\\dfrac{x}{a} + C$.',
        `Here $a^2 = ${a * a}$.`,
        `So $a = ${a}$ and the constant in front is $\\dfrac{1}{${a}}$.`
      ],
      steps: [
        { h: 'Recognise the standard form', d: '$\\displaystyle\\int\\dfrac{dx}{x^2+a^2} = \\dfrac{1}{a}\\tan^{-1}\\dfrac{x}{a} + C$' },
        { h: 'Match the constant', d: `$a^2 = ${a * a}$, so $a = ${a}$` },
        { h: 'Read off k', d: `$k = ${a}$` }
      ]
    };
  },

  // ── Class 12 · Integrals — the definite integral ─────────────────────────
  // The fundamental theorem, used forwards on D1–D3 and backwards on D4.
  'c12-definite-integrals': (rng, diff) => {
    if (diff === 1) {
      const k = nz(rng, -9, 9);
      const a = nz(rng, -6, 6);
      const b = a + ri(rng, 1, 7);
      const want = k * (b - a);
      return {
        prompt: `Evaluate $\\displaystyle\\int_{${a}}^{${b}} ${k}\\,dx$.`,
        answerType: 'numeric', answer: { value: want },
        traps: traps(want, [
          { value: k * (b + a), why: `The fundamental theorem *subtracts* the value at the lower limit: $[${k}x]_{${a}}^{${b}} = ${k}(${b}) - ${k}(${a})$.` },
          { value: b - a, why: `$${b - a}$ is the width of the interval; the integrand $${k}$ still multiplies it.` },
          { value: k, why: 'The integrand alone is not the integral; it has to be accumulated across the interval.' }
        ]),
        hints: [
          'An antiderivative of a constant $k$ is $kx$.',
          `$\\displaystyle\\int_{${a}}^{${b}} ${k}\\,dx = \\left[${k}x\\right]_{${a}}^{${b}}$.`,
          `That is $${k} \\times (${b} - (${a}))$.`
        ],
        steps: [
          { h: 'Find an antiderivative', d: `$\\displaystyle\\int ${k}\\,dx = ${k}x$` },
          { h: 'Apply the fundamental theorem', d: `$\\left[${k}x\\right]_{${a}}^{${b}} = ${k}(${b}) - ${k}(${a})$` },
          { h: 'Evaluate', d: `$= ${want}$` }
        ]
      };
    }
    if (diff === 2) {
      const n = ri(rng, 1, 4);
      const b = ri(rng, 1, 5);
      const want = frac(Math.pow(b, n + 1), n + 1);
      return {
        prompt: `Evaluate $\\displaystyle\\int_{0}^{${b}} ${pw('x', n)}\\,dx$.`,
        answerType: 'numeric', ...exact(want),
        traps: traps(want.value, [
          { value: Math.pow(b, n + 1), why: `The antiderivative of $${pw('x', n)}$ is $\\dfrac{x^{${n + 1}}}{${n + 1}}$ — the division by $${n + 1}$ stays.` },
          { value: Math.pow(b, n), why: `That is the value of the integrand at $x = ${b}$, not the accumulated area.` },
          { value: frac(Math.pow(b, n), n).value, why: `Integrating *raises* the power to $${n + 1}$ and divides by the new power, not the old one.` }
        ]),
        hints: [
          `An antiderivative of $${pw('x', n)}$ is $\\dfrac{x^{${n + 1}}}{${n + 1}}$.`,
          `$\\left[\\dfrac{x^{${n + 1}}}{${n + 1}}\\right]_{0}^{${b}}$.`,
          `At the lower limit the antiderivative is $0$.`
        ],
        steps: [
          { h: 'Find an antiderivative', d: `$\\displaystyle\\int ${pw('x', n)}\\,dx = \\dfrac{x^{${n + 1}}}{${n + 1}}$` },
          { h: 'Apply the fundamental theorem', d: `$\\left[\\dfrac{x^{${n + 1}}}{${n + 1}}\\right]_{0}^{${b}} = \\dfrac{${b}^{${n + 1}}}{${n + 1}} - 0$` },
          { h: 'Evaluate', d: `$= \\dfrac{${Math.pow(b, n + 1)}}{${n + 1}} = ${fracTex(want.n, want.d)}$` }
        ]
      };
    }
    if (diff === 3) {
      const p = nz(rng, -6, 6), q = nz(rng, -9, 9);
      const a = nz(rng, -4, 4);
      const b = a + ri(rng, 1, 6);
      const F = x => frac(p * x * x, 2).value + q * x;
      const want = frac(p * (b * b - a * a) + 2 * q * (b - a), 2);
      return {
        prompt: `Evaluate $\\displaystyle\\int_{${a}}^{${b}} (${cx(p)} ${sg(q)})\\,dx$.`,
        answerType: 'numeric', ...exact(want),
        traps: traps(want.value, [
          { value: F(b), why: `$${F(b)}$ is the antiderivative at the upper limit alone; the value at $x = ${a}$ still has to be subtracted.` },
          { value: frac(p * (b * b - a * a), 2).value, why: `The $${q}$ integrates to $${q}x$, which contributes $${q}(${b} - (${a}))$ as well.` },
          { value: p * (b - a) + q, why: 'Each term is integrated first and then evaluated; the integrand itself is not the thing being subtracted.' }
        ]),
        hints: [
          `An antiderivative is $\\dfrac{${p}x^2}{2} ${sg(q)}x$.`,
          `Evaluate it at $x = ${b}$ and at $x = ${a}$.`,
          'Subtract the second from the first.'
        ],
        steps: [
          { h: 'Find an antiderivative', d: `$F(x) = \\dfrac{${p}x^2}{2} ${sg(q)}x$` },
          { h: 'Evaluate at the upper limit', d: `$F(${b}) = ${fracTex(p * b * b, 2)} ${sg(q * b)} = ${fracTex(p * b * b + 2 * q * b, 2)}$` },
          { h: 'Evaluate at the lower limit', d: `$F(${a}) = ${fracTex(p * a * a + 2 * q * a, 2)}$` },
          { h: 'Subtract', d: `$F(${b}) - F(${a}) = ${fracTex(want.n, want.d)}$` }
        ]
      };
    }
    // D4 — the fundamental theorem read backwards: the limit is the unknown.
    const k = ri(rng, 2, 20);
    const value = k * k;
    return {
      prompt: `Given that $\\displaystyle\\int_{0}^{a} 2x\\,dx = ${value}$ and $a > 0$, find $a$.`,
      answerType: 'numeric', answer: { value: k }, answerPrefix: 'a =',
      traps: traps(k, [
        { value: value, why: `$${value}$ is the value of the integral, not of the limit. The integral comes to $a^2$, so $a^2 = ${value}$.` },
        { value: frac(value, 2).value, why: `$\\displaystyle\\int_0^a 2x\\,dx = \\left[x^2\\right]_0^a = a^2$ — the $2$ has already been used up by the integration.` },
        { value: 2 * k, why: `From $a^2 = ${value}$ the positive solution is $a = \\sqrt{${value}} = ${k}$.` }
      ]),
      hints: [
        'An antiderivative of $2x$ is $x^2$.',
        `$\\left[x^2\\right]_0^a = a^2$, so $a^2 = ${value}$.`,
        'Take the positive square root, because the question says $a > 0$.'
      ],
      steps: [
        { h: 'Find an antiderivative', d: '$\\displaystyle\\int 2x\\,dx = x^2$' },
        { h: 'Apply the fundamental theorem', d: `$\\left[x^2\\right]_{0}^{a} = a^2 - 0 = a^2$` },
        { h: 'Set it equal to the given value', d: `$a^2 = ${value}$` },
        { h: 'Solve for the positive root', d: `$a = ${k}$` }
      ]
    };
  },

  // ── Class 12 · Vector Algebra — the scalar (dot) product ─────────────────
  // The dot product itself, the perpendicularity condition it gives, the angle
  // it measures and the projection it defines. The angles are drawn from a
  // table of directions whose cosine is exact, so the answer is $60°$ and not
  // 59.99999999999999.
  'c12-vector-dot-product': (rng, diff) => {
    if (diff === 1) {
      const u = [nz(rng, -6, 6), nz(rng, -6, 6), nz(rng, -6, 6)];
      const v = [nz(rng, -6, 6), nz(rng, -6, 6), nz(rng, -6, 6)];
      const want = dot(u, v);
      return {
        prompt: `Find $\\vec{a} \\cdot \\vec{b}$ for $\\vec{a} = ${vecTex(u)}$ and $\\vec{b} = ${vecTex(v)}$.`,
        answerType: 'numeric', answer: { value: want },
        traps: traps(want, [
          { value: u[0] * v[0], why: 'Only the first pair of components has been multiplied. The scalar product adds the products of all three pairs.' },
          // This one can never collapse onto the answer: it differs from it by
          // $a_3b_3$, and neither third component is ever zero here. It is what
          // guarantees the question always has at least one usable distractor.
          { value: u[0] * v[0] + u[1] * v[1], why: 'The $\\hat{k}$ components have been dropped. In space the scalar product has three terms, not two.' },
          { value: u[0] + u[1] + u[2] + v[0] + v[1] + v[2], why: 'Matching components are multiplied first, and only then added.' },
          { value: u[1] * v[2] - u[2] * v[1], why: 'That is a component of the *cross* product. The scalar product multiplies matching components.' }
        ]),
        hints: [
          'The scalar product multiplies matching components and adds the results.',
          '$\\vec{a} \\cdot \\vec{b} = a_1b_1 + a_2b_2 + a_3b_3$.',
          `$(${u[0]})(${v[0]}) + (${u[1]})(${v[1]}) + (${u[2]})(${v[2]})$.`
        ],
        steps: [
          { h: 'Write the scalar product', d: '$\\vec{a} \\cdot \\vec{b} = a_1b_1 + a_2b_2 + a_3b_3$' },
          { h: 'Multiply matching components', d: `$(${u[0]})(${v[0]}) = ${u[0] * v[0]}$, $(${u[1]})(${v[1]}) = ${u[1] * v[1]}$, $(${u[2]})(${v[2]}) = ${u[2] * v[2]}$` },
          { h: 'Add', d: `$= ${want}$` }
        ]
      };
    }
    if (diff === 2) {
      const u = [nz(rng, -5, 5), nz(rng, -5, 5), nz(rng, -5, 5)];
      const v1 = nz(rng, -5, 5), v3 = nz(rng, -5, 5);
      const want = frac(-(u[0] * v1 + u[2] * v3), u[1]);
      return {
        prompt: `The vectors $\\vec{a} = ${vecTex(u)}$ and $\\vec{b} = ${v1 === 1 ? '' : v1 === -1 ? '-' : v1}\\hat{i} + \\lambda\\hat{j} ${v3 < 0 ? '-' : '+'} ${Math.abs(v3) === 1 ? '' : Math.abs(v3)}\\hat{k}$ are perpendicular. Find $\\lambda$.`,
        answerType: 'numeric', ...exact(want),
        traps: traps(want.value, [
          { value: frac(u[0] * v1 + u[2] * v3, u[1]).value, why: `Perpendicular means $\\vec{a}\\cdot\\vec{b} = 0$, so $${u[1]}\\lambda = ${-(u[0] * v1 + u[2] * v3)}$ — the known part moves across and changes sign.` },
          { value: -(u[0] * v1 + u[2] * v3), why: `That is $${u[1]}\\lambda$; it still has to be divided by $${u[1]}$.` },
          { value: u[1], why: 'The coefficient of $\\lambda$ is what you divide by, not the answer.' }
        ]),
        hints: [
          'Two vectors are perpendicular exactly when their scalar product is zero.',
          `$\\vec{a}\\cdot\\vec{b} = (${u[0]})(${v1}) + (${u[1]})\\lambda + (${u[2]})(${v3})$.`,
          `Set that to zero and solve for $\\lambda$.`
        ],
        steps: [
          { h: 'Use the perpendicularity condition', d: '$\\vec{a} \\cdot \\vec{b} = 0$' },
          { h: 'Expand the scalar product', d: `$${u[0] * v1} ${sg(u[2] * v3)} ${u[1] < 0 ? '-' : '+'} ${Math.abs(u[1])}\\lambda = 0$` },
          { h: 'Solve', d: `$${u[1]}\\lambda = ${-(u[0] * v1 + u[2] * v3)}$` },
          { h: 'Divide', d: `$\\lambda = ${fracTex(want.n, want.d)}$` }
        ]
      };
    }
    if (diff === 3) {
      const pair = rc(rng, ANGLE_PAIRS);
      const s = ri(rng, 1, 4);
      let t = ri(rng, 1, 4);
      // Parallel and antiparallel pairs are the same direction twice, so equal
      // scale factors would print the same vector for both and make the
      // question look like a typing mistake rather than a question.
      if (t === s && (pair.deg === 0 || pair.deg === 180)) t = s === 4 ? 2 : s + 1;
      const u = pair.u.map(c => c * s);
      const v = pair.v.map(c => c * t);
      return {
        prompt: `Find the angle between $\\vec{a} = ${vecTex(u)}$ and $\\vec{b} = ${vecTex(v)}$, in degrees.`,
        answerType: 'numeric', answer: { value: pair.deg }, answerSuffix: 'degrees',
        traps: traps(pair.deg, [
          { value: 180 - pair.deg, why: `$\\cos\\theta = \\dfrac{\\vec{a}\\cdot\\vec{b}}{|\\vec{a}||\\vec{b}|}$ fixes the angle between $0°$ and $180°$; check the sign of the scalar product, because it decides which side of $90°$ the angle falls.` },
          { value: 90, why: 'A right angle needs the scalar product to be exactly zero. Compute it before assuming.' },
          { value: dot(u, v), why: 'That is the scalar product itself. It has to be divided by the two magnitudes and then turned into an angle.' }
        ]),
        hints: [
          '$\\cos\\theta = \\dfrac{\\vec{a}\\cdot\\vec{b}}{|\\vec{a}|\\,|\\vec{b}|}$.',
          `$\\vec{a}\\cdot\\vec{b} = ${dot(u, v)}$.`,
          `Here ${pair.note}.`
        ],
        steps: [
          { h: 'Write the angle formula', d: '$\\cos\\theta = \\dfrac{\\vec{a} \\cdot \\vec{b}}{|\\vec{a}|\\,|\\vec{b}|}$' },
          { h: 'Evaluate the scalar product', d: `$\\vec{a} \\cdot \\vec{b} = ${dot(u, v)}$` },
          { h: 'Divide by the magnitudes', d: `${pair.note[0].toUpperCase()}${pair.note.slice(1)}` },
          { h: 'Read off the angle', d: `$\\theta = ${pair.deg}°$` }
        ]
      };
    }
    // D4 — the projection of one vector on another.
    const [b1, b2, b3, mag] = rc(rng, VEC_LENGTHS);
    const v = [rng() < 0.5 ? b1 : -b1, rng() < 0.5 ? b2 : -b2, rng() < 0.5 ? b3 : -b3];
    let u = [nz(rng, -6, 6), nz(rng, -6, 6), nz(rng, -6, 6)];
    // A projection of zero collapses every designed distractor onto the answer,
    // because they are all the same zero divided by something different. The
    // perpendicular case is a good question — it is D2's question, and it is
    // asked there with distractors that survive.
    let guard = 30;
    while (guard-- > 0 && dot(u, v) === 0) u = [nz(rng, -6, 6), nz(rng, -6, 6), nz(rng, -6, 6)];
    if (dot(u, v) === 0) u = [v[0], v[1], v[2]];
    const want = frac(dot(u, v), mag);
    return {
      prompt: `Find the projection of $\\vec{a} = ${vecTex(u)}$ on $\\vec{b} = ${vecTex(v)}$.`,
      answerType: 'numeric', ...exact(want),
      traps: traps(want.value, [
        { value: dot(u, v), why: `$${dot(u, v)}$ is $\\vec{a}\\cdot\\vec{b}$; the projection divides it by $|\\vec{b}| = ${mag}$.` },
        { value: frac(dot(u, v), u[0] * u[0] + u[1] * u[1] + u[2] * u[2]).value, why: 'The projection *on* $\\vec{b}$ divides by the magnitude of $\\vec{b}$, not of $\\vec{a}$.' },
        { value: frac(dot(u, v), mag * mag).value, why: `The divisor is $|\\vec{b}| = ${mag}$, not $|\\vec{b}|^2 = ${mag * mag}$ — that would give the scalar multiple in the vector projection.` }
      ]),
      hints: [
        'The projection of $\\vec{a}$ on $\\vec{b}$ is $\\dfrac{\\vec{a}\\cdot\\vec{b}}{|\\vec{b}|}$.',
        `$\\vec{a}\\cdot\\vec{b} = ${dot(u, v)}$.`,
        `$|\\vec{b}| = \\sqrt{${v[0] * v[0]} + ${v[1] * v[1]} + ${v[2] * v[2]}} = ${mag}$.`
      ],
      steps: [
        { h: 'Write the projection formula', d: '$\\text{proj} = \\dfrac{\\vec{a} \\cdot \\vec{b}}{|\\vec{b}|}$' },
        { h: 'Evaluate the scalar product', d: `$\\vec{a} \\cdot \\vec{b} = ${dot(u, v)}$` },
        { h: 'Find the magnitude', d: `$|\\vec{b}| = \\sqrt{${v[0] * v[0] + v[1] * v[1] + v[2] * v[2]}} = ${mag}$` },
        { h: 'Divide', d: `$= ${fracTex(want.n, want.d)}$` }
      ]
    };
  },

  // ── Class 12 · Probability — conditional probability ─────────────────────
  // The definition, the multiplication theorem on a draw without replacement,
  // independence, and a conditional probability read out of a two-way table.
  'c12-conditional-probability': (rng, diff) => {
    if (diff === 1) {
      const n = rc(rng, [12, 15, 18, 20, 24, 30]);
      const both = ri(rng, 2, 6);
      const b = both + ri(rng, 2, 8);
      if (b >= n) return indiaClass12['c12-conditional-probability'](rng, 2);
      const want = frac(both, b);
      return {
        prompt: `For two events $A$ and $B$, $P(A \\cap B) = \\dfrac{${both}}{${n}}$ and $P(B) = \\dfrac{${b}}{${n}}$. Find $P(A \\mid B)$.`,
        answerType: 'numeric', ...exact(want),
        traps: traps(want.value, [
          { value: frac(both, n).value, why: `$\\dfrac{${both}}{${n}}$ is $P(A \\cap B)$. Conditioning on $B$ makes $B$ the new sample space, so it is divided by $P(B)$.` },
          { value: frac(b, both).value, why: 'The conditional probability is $\\dfrac{P(A \\cap B)}{P(B)}$ — the intersection goes on top.' },
          { value: frac(b, n).value, why: 'That is $P(B)$ itself, which is the divisor rather than the answer.' }
        ]),
        hints: [
          'Conditioning on $B$ restricts attention to the outcomes in $B$.',
          '$P(A \\mid B) = \\dfrac{P(A \\cap B)}{P(B)}$.',
          `$\\dfrac{${both}/${n}}{${b}/${n}} = \\dfrac{${both}}{${b}}$.`
        ],
        steps: [
          { h: 'Write the definition', d: '$P(A \\mid B) = \\dfrac{P(A \\cap B)}{P(B)}$' },
          { h: 'Substitute', d: `$= \\dfrac{${both}/${n}}{${b}/${n}}$` },
          { h: 'The common denominator cancels', d: `$= \\dfrac{${both}}{${b}}$` },
          { h: 'Reduce', d: `$= ${fracTex(want.n, want.d)}$` }
        ]
      };
    }
    if (diff === 2) {
      const red = ri(rng, 4, 9), other = ri(rng, 4, 9);
      const total = red + other;
      const want = frac(red * (red - 1), total * (total - 1));
      return {
        prompt: `An urn holds $${red}$ red and $${other}$ white balls. Two balls are drawn one after the other without replacement. Find the probability that both are red.`,
        answerType: 'numeric', ...exact(want),
        traps: traps(want.value, [
          { value: frac(red * red, total * total).value, why: `Without replacement the first ball is not put back, so the second draw has $${red - 1}$ red balls left out of $${total - 1}$.` },
          { value: frac(red, total).value, why: 'That is the probability the *first* ball is red. The multiplication theorem multiplies it by the conditional probability of the second.' },
          { value: frac(red * (red - 1), total * total).value, why: `The total also drops by one after the first draw: the second denominator is $${total - 1}$.` }
        ]),
        hints: [
          'Use the multiplication theorem: $P(A \\cap B) = P(A)\\,P(B \\mid A)$.',
          `$P(\\text{first red}) = \\dfrac{${red}}{${total}}$.`,
          `Given that, $P(\\text{second red}) = \\dfrac{${red - 1}}{${total - 1}}$.`
        ],
        steps: [
          { h: 'Write the multiplication theorem', d: '$P(A \\cap B) = P(A)\\,P(B \\mid A)$' },
          { h: 'First draw', d: `$P(A) = \\dfrac{${red}}{${total}}$` },
          { h: 'Second draw, given the first', d: `$P(B \\mid A) = \\dfrac{${red - 1}}{${total - 1}}$ — one red ball and one ball in total have gone` },
          { h: 'Multiply and reduce', d: `$\\dfrac{${red}}{${total}} \\times \\dfrac{${red - 1}}{${total - 1}} = ${fracTex(want.n, want.d)}$` }
        ]
      };
    }
    if (diff === 3) {
      const pa = frac(ri(rng, 1, 4), ri(rng, 5, 9));
      const pb = frac(ri(rng, 1, 4), ri(rng, 5, 9));
      const want = frac(pa.n * pb.n, pa.d * pb.d);
      return {
        prompt: `$A$ and $B$ are independent events with $P(A) = ${fracTex(pa.n, pa.d)}$ and $P(B) = ${fracTex(pb.n, pb.d)}$. Find $P(A \\cap B)$.`,
        answerType: 'numeric', ...exact(want),
        traps: traps(want.value, [
          { value: frac(pa.n * pb.d + pb.n * pa.d, pa.d * pb.d).value, why: 'That is $P(A) + P(B)$, which would be $P(A \\cup B)$ only if the events were mutually exclusive. Independence multiplies.' },
          { value: pa.value, why: 'Independence means $P(A \\mid B) = P(A)$; the intersection still needs both probabilities.' },
          { value: frac(pa.n * pb.d + pb.n * pa.d - pa.n * pb.n, pa.d * pb.d).value, why: 'That is $P(A \\cup B)$ — the probability of *either* event, not of both together.' }
        ]),
        hints: [
          'Independence means the occurrence of one does not change the probability of the other.',
          'For independent events, $P(A \\cap B) = P(A)\\,P(B)$.',
          `$${fracTex(pa.n, pa.d)} \\times ${fracTex(pb.n, pb.d)}$.`
        ],
        steps: [
          { h: 'State the independence condition', d: '$P(A \\cap B) = P(A)\\,P(B)$' },
          { h: 'Substitute', d: `$= ${fracTex(pa.n, pa.d)} \\times ${fracTex(pb.n, pb.d)}$` },
          { h: 'Multiply', d: `$= \\dfrac{${pa.n * pb.n}}{${pa.d * pb.d}}$` },
          { h: 'Reduce', d: `$= ${fracTex(want.n, want.d)}$` }
        ]
      };
    }
    // D4 — a conditional probability read out of a two-way table.
    const boysHindi = ri(rng, 8, 20), boysNot = ri(rng, 5, 18);
    const girlsHindi = ri(rng, 8, 20), girlsNot = ri(rng, 5, 18);
    const boys = boysHindi + boysNot;
    const hindi = boysHindi + girlsHindi;
    const total = boys + girlsHindi + girlsNot;
    const givenBoy = rng() < 0.5;
    const want = givenBoy ? frac(boysHindi, boys) : frac(boysHindi, hindi);
    const city = rc(rng, IN_CITIES);
    return {
      prompt: `In a school in ${city}, $${boysHindi}$ boys and $${girlsHindi}$ girls have chosen Hindi as their third language, while $${boysNot}$ boys and $${girlsNot}$ girls have not. One of the $${total}$ students is chosen at random. Find the probability that the student ${givenBoy ? 'has chosen Hindi, given that the student is a boy' : 'is a boy, given that the student has chosen Hindi'}.`,
      answerType: 'numeric', ...exact(want),
      traps: traps(want.value, [
        { value: frac(boysHindi, total).value, why: `$\\dfrac{${boysHindi}}{${total}}$ is the probability of being a boy *and* choosing Hindi. Conditioning shrinks the sample space to ${givenBoy ? `the $${boys}$ boys` : `the $${hindi}$ students who chose Hindi`}.` },
        { value: givenBoy ? frac(boysHindi, hindi).value : frac(boysHindi, boys).value, why: `The condition is the *given* event, so the denominator is ${givenBoy ? `the number of boys, $${boys}$` : `the number who chose Hindi, $${hindi}$`}.` },
        { value: givenBoy ? frac(boys, total).value : frac(hindi, total).value, why: 'That is the probability of the condition itself, which is the divisor rather than the answer.' }
      ]),
      hints: [
        'Draw the two-way table before computing anything.',
        givenBoy
          ? `Given the student is a boy, the sample space is the $${boys}$ boys.`
          : `Given the student chose Hindi, the sample space is the $${hindi}$ students who did.`,
        `Of those, $${boysHindi}$ are ${givenBoy ? 'boys who chose Hindi' : 'boys'}.`
      ],
      steps: [
        { h: 'Write the definition', d: `$P(A \\mid B) = \\dfrac{n(A \\cap B)}{n(B)}$` },
        { h: 'Identify the condition', d: givenBoy ? `$n(\\text{boys}) = ${boysHindi} + ${boysNot} = ${boys}$` : `$n(\\text{Hindi}) = ${boysHindi} + ${girlsHindi} = ${hindi}$` },
        { h: 'Count the overlap', d: `$n(\\text{boy and Hindi}) = ${boysHindi}$` },
        { h: 'Divide and reduce', d: `$= \\dfrac{${boysHindi}}{${givenBoy ? boys : hindi}} = ${fracTex(want.n, want.d)}$` }
      ]
    };
  },

  // ── Class 12 · Probability — the random variable ─────────────────────────
  // The mean of a random variable and the binomial distribution. Both were
  // rationalised out of the 2026–27 CBSE syllabus, but the product dot point
  // still names them, so they are authored to NCERT's own depth and no deeper.
  'c12-random-variable': (rng, diff) => {
    if (diff === 1) {
      const den = rc(rng, [6, 8, 10, 12]);
      const a = ri(rng, 1, den - 3);
      const b = ri(rng, 1, den - a - 1);
      const c = den - a - b;
      const want = frac(0 * a + 1 * b + 2 * c, den);
      return {
        prompt: `A random variable $X$ takes the values $0$, $1$ and $2$ with probabilities $\\dfrac{${a}}{${den}}$, $\\dfrac{${b}}{${den}}$ and $\\dfrac{${c}}{${den}}$. Find the mean of $X$.`,
        answerType: 'numeric', ...exact(want),
        traps: traps(want.value, [
          { value: 1, why: 'The mean of a random variable is not the middle of its values — each value is weighted by how likely it is.' },
          { value: frac(3, den).value, why: 'The values $0$, $1$ and $2$ are weighted by their probabilities, not added and divided by three.' },
          { value: b + 2 * c, why: `The products $x_i p_i$ are already probabilities-weighted; the common denominator $${den}$ stays.` }
        ]),
        hints: [
          'The mean of a random variable is $E(X) = \\sum x_i\\,p_i$.',
          `$0 \\times \\dfrac{${a}}{${den}} + 1 \\times \\dfrac{${b}}{${den}} + 2 \\times \\dfrac{${c}}{${den}}$.`,
          `The probabilities add to $1$, which is a useful check: $${a} + ${b} + ${c} = ${den}$.`
        ],
        steps: [
          { h: 'Check the distribution', d: `$\\dfrac{${a}}{${den}} + \\dfrac{${b}}{${den}} + \\dfrac{${c}}{${den}} = 1$` },
          { h: 'Write the mean', d: '$E(X) = \\sum x_i\\,p_i$' },
          { h: 'Substitute', d: `$= 0 \\times \\dfrac{${a}}{${den}} + 1 \\times \\dfrac{${b}}{${den}} + 2 \\times \\dfrac{${c}}{${den}} = \\dfrac{${b + 2 * c}}{${den}}$` },
          { h: 'Reduce', d: `$= ${fracTex(want.n, want.d)}$` }
        ]
      };
    }
    if (diff === 2) {
      const n = ri(rng, 3, 6);
      const r = ri(rng, 1, n - 1);
      const want = frac(nCr(n, r), Math.pow(2, n));
      return {
        prompt: `A fair coin is tossed $${n}$ times. Find the probability of getting exactly $${r}$ heads.`,
        answerType: 'numeric', ...exact(want),
        traps: traps(want.value, [
          { value: frac(1, Math.pow(2, n)).value, why: `That is the probability of one particular sequence. There are $\\binom{${n}}{${r}} = ${nCr(n, r)}$ different sequences with exactly $${r}$ heads.` },
          { value: frac(r, n).value, why: 'The proportion of heads asked for is not the probability of obtaining it.' },
          { value: frac(nCr(n, r), Math.pow(2, n - 1)).value, why: `Each of the $${n}$ tosses halves the probability, so the denominator is $2^{${n}} = ${Math.pow(2, n)}$.` }
        ]),
        hints: [
          `Each toss is independent with $P(\\text{head}) = \\dfrac{1}{2}$.`,
          `$P(X = r) = \\binom{${n}}{r}\\left(\\dfrac{1}{2}\\right)^{r}\\left(\\dfrac{1}{2}\\right)^{${n}-r} = \\dfrac{\\binom{${n}}{r}}{2^{${n}}}$.`,
          `$\\binom{${n}}{${r}} = ${nCr(n, r)}$.`
        ],
        steps: [
          { h: 'Recognise the binomial distribution', d: `$${n}$ independent trials, each a head with probability $\\dfrac{1}{2}$` },
          { h: 'Write the binomial probability', d: `$P(X = ${r}) = \\binom{${n}}{${r}}\\left(\\dfrac{1}{2}\\right)^{${r}}\\left(\\dfrac{1}{2}\\right)^{${n - r}}$` },
          { h: 'Count the sequences', d: `$\\binom{${n}}{${r}} = ${nCr(n, r)}$, each with probability $\\dfrac{1}{${Math.pow(2, n)}}$` },
          { h: 'Reduce', d: `$= ${fracTex(want.n, want.d)}$` }
        ]
      };
    }
    if (diff === 3) {
      const n = rc(rng, [6, 8, 10, 12, 18, 24]);
      const den = rc(rng, [2, 3, 4, 6]);
      const want = frac(n, den);
      return {
        prompt: `A biased coin lands heads with probability $\\dfrac{1}{${den}}$ and is tossed $${n}$ times. Find the mean number of heads.`,
        answerType: 'numeric', ...exact(want),
        traps: traps(want.value, [
          { value: frac(n * (den - 1), den).value, why: `That is $nq$, the mean number of *tails*. The mean number of heads is $np$ with $p = \\dfrac{1}{${den}}$.` },
          { value: frac(n * (den - 1), den * den).value, why: 'That is the variance $npq$, not the mean.' },
          { value: n, why: 'That is the number of tosses. On average only a fraction of them land heads.' }
        ]),
        hints: [
          'For a binomial distribution the mean is $np$.',
          `Here $n = ${n}$ and $p = \\dfrac{1}{${den}}$.`,
          `$${n} \\times \\dfrac{1}{${den}}$.`
        ],
        steps: [
          { h: 'Recognise the binomial distribution', d: `$n = ${n}$ independent tosses, $p = \\dfrac{1}{${den}}$` },
          { h: 'Write the mean', d: '$E(X) = np$' },
          { h: 'Substitute', d: `$= ${n} \\times \\dfrac{1}{${den}} = \\dfrac{${n}}{${den}}$` },
          { h: 'Reduce', d: `$= ${fracTex(want.n, want.d)}$` }
        ]
      };
    }
    // D4 — "at least one", which is always the complement of "none".
    const n = ri(rng, 2, 5);
    const den = rc(rng, [2, 3, 4, 5]);
    const q = den - 1;
    const want = frac(Math.pow(den, n) - Math.pow(q, n), Math.pow(den, n));
    return {
      prompt: `A machine in a Coimbatore mill produces a defective spindle with probability $\\dfrac{1}{${den}}$, independently each time. Out of $${n}$ spindles, find the probability that at least one is defective.`,
      answerType: 'numeric', ...exact(want),
      traps: traps(want.value, [
        { value: frac(Math.pow(q, n), Math.pow(den, n)).value, why: '"At least one" is the complement of "none": subtract the probability that every spindle is good from $1$.' },
        { value: frac(n, den).value, why: 'Adding the probability for each spindle double-counts the cases where more than one is defective. Take the complement instead.' },
        { value: frac(1, den).value, why: 'That is the probability for a single spindle.' }
      ]),
      hints: [
        '"At least one" is awkward directly; its complement is not.',
        `$P(\\text{none defective}) = \\left(\\dfrac{${q}}{${den}}\\right)^{${n}} = \\dfrac{${Math.pow(q, n)}}{${Math.pow(den, n)}}$.`,
        '$P(\\text{at least one}) = 1 - P(\\text{none})$.'
      ],
      steps: [
        { h: 'Take the complement', d: '$P(\\text{at least one}) = 1 - P(\\text{none})$' },
        { h: 'Probability a single spindle is good', d: `$1 - \\dfrac{1}{${den}} = \\dfrac{${q}}{${den}}$` },
        { h: 'All independent', d: `$P(\\text{none defective}) = \\left(\\dfrac{${q}}{${den}}\\right)^{${n}} = \\dfrac{${Math.pow(q, n)}}{${Math.pow(den, n)}}$` },
        { h: 'Subtract from 1', d: `$= \\dfrac{${Math.pow(den, n) - Math.pow(q, n)}}{${Math.pow(den, n)}} = ${fracTex(want.n, want.d)}$` }
      ]
    };
  }
};
