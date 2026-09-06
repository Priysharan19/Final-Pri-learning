// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · NCERT Class 11 — the eight chapters that were on NSW banks
//
// Relations and Functions, Trigonometric Functions, Complex Numbers,
// Permutations and Combinations, Sequences and Series, Straight Lines, Limits
// and Derivatives and Probability were all pointed at a Year 10/11/12 or
// Extension generator written for the NSW syllabus. The mathematics overlaps,
// but the cut does not, and the places where it does not are the places a
// student loses marks:
//
//   · NSW Year 11 differentiation is a full first-course ladder — chain rule,
//     stationary points, curve sketching. NCERT's Limits and Derivatives is
//     limits first (algebraic limits, the standard trigonometric limits), then
//     the derivative from FIRST PRINCIPLES, then sums, products and quotients
//     of polynomials and trigonometric functions. The chain rule is formative
//     only. A Class 11 student handed the NSW ladder meets the chain rule
//     before first principles, which is the wrong way round for their exam;
//   · Sequences and Series in NSW leads with arithmetic series; NCERT Class 11
//     assumes AP from Class 10 and spends the chapter on GP, the infinite GP
//     and the means;
//   · NSW straight-line work leans on the general form; the CBSE bullet is
//     slope, angle between two lines, the five standard forms and the distance
//     of a point from a line;
//   · and the money was in dollars.
//
// Source: CBSE Secondary Curriculum 2026–27, Mathematics (041), Classes XI–XII
// https://cbseacademic.nic.in/web_material/CurriculumMain27/SecPart2/Maths_SecP2_2026-27.pdf
// Class XI, verbatim where it decided a design here:
//   Relations & Functions — "Cartesian product of sets. Number of elements in
//     the Cartesian product of two finite sets… Real valued functions, domain
//     and range of these functions, constant, identity, polynomial, rational,
//     modulus, signum, exponential, logarithmic and greatest integer functions".
//   Trigonometric Functions — "Measuring angles in radians and in degrees and
//     conversion from one measure to another… Expressing sin(x ± y) and
//     cos(x ± y)…". The general solution of a trigonometric equation is listed
//     under the formative-only topics, so it sits at D4 alone rather than
//     carrying a third of the chapter.
//   Sequence and Series — "Arithmetic Mean (A.M.) Geometric Progression (G.P.),
//     general term of a G.P., sum of n terms of a G.P., infinite G.P. and its
//     sum, geometric mean (G.M.)".
//   Straight Lines — "Slope of a line and angle between two lines. Various
//     forms of equations of a line… Distance of a point from a line."
//   Limits and Derivatives — "Intuitive idea of limit. Limits of polynomials
//     and rational functions trigonometric, exponential and logarithmic
//     functions. Definition of derivative relate it to slope of tangent…
//     derivative of sum, difference, product and quotient".
//   Probability — "Events; occurrence of events, 'not', 'and' and 'or' events,
//     exhaustive events, mutually exclusive events, Axiomatic (set theoretic)
//     probability… Probability of an event, probability of 'not', 'and' and
//     'or' events."
//
// Every answer is exact. Limits land on integers or keyed simplest fractions,
// compound angles are built from Pythagorean triples so the sine of a sum is a
// fraction rather than 0.8615384615384616, and every probability is reduced.
// ─────────────────────────────────────────────────────────────────────────────
import { ri, rc, rs, nz } from '../qhelpers.js';
import {
  exact, frac, fracTex, traps, twoCities, twoNames,
  IN_CITIES, IN_FESTIVALS, IN_TRAINS
} from './india-native-helpers.js';

/** ax written the way it is read. */
const cx = (c, v = 'x') => (c === 1 ? v : c === -1 ? `-${v}` : `${c}${v}`);
/** A signed constant for appending to a term: "+ 5" / "- 5". */
const sg = k => (k >= 0 ? `+ ${k}` : `- ${Math.abs(k)}`);
/** A set written the way NCERT writes it. */
const setTex = xs => `\\{${xs.join(',\\ ')}\\}`;
/** Brackets a value only when it needs them — 6 stays 6, −4 becomes (−4). */
const par = v => (v < 0 ? `(${v})` : String(v));

const fact = n => (n <= 1 ? 1 : n * fact(n - 1));
const nCr = (n, r) => (r < 0 || r > n ? 0 : Math.round(fact(n) / (fact(r) * fact(n - r))));
const nPr = (n, r) => (r < 0 || r > n ? 0 : Math.round(fact(n) / fact(n - r)));

/** Right-triangle side triples, so a compound angle stays a fraction. */
const TRIPLES = [[3, 4, 5], [5, 12, 13], [8, 15, 17], [7, 24, 25], [20, 21, 29], [9, 40, 41]];

/**
 * The standard angles whose sine, cosine or tangent is a rational number. NCERT
 * builds the whole unit-circle section on exactly these, and keeping to them is
 * what lets the answer be keyed as $-\tfrac12$ rather than as -0.5000000000001.
 */
const UNIT_CIRCLE = [
  { deg: 30, fn: 'sin', n: 1, d: 2, quad: 'first' },
  { deg: 150, fn: 'sin', n: 1, d: 2, quad: 'second' },
  { deg: 210, fn: 'sin', n: -1, d: 2, quad: 'third' },
  { deg: 330, fn: 'sin', n: -1, d: 2, quad: 'fourth' },
  { deg: 90, fn: 'sin', n: 1, d: 1, quad: 'first' },
  { deg: 270, fn: 'sin', n: -1, d: 1, quad: 'third' },
  { deg: 60, fn: 'cos', n: 1, d: 2, quad: 'first' },
  { deg: 120, fn: 'cos', n: -1, d: 2, quad: 'second' },
  { deg: 240, fn: 'cos', n: -1, d: 2, quad: 'third' },
  { deg: 300, fn: 'cos', n: 1, d: 2, quad: 'fourth' },
  { deg: 180, fn: 'cos', n: -1, d: 1, quad: 'second' },
  { deg: 45, fn: 'tan', n: 1, d: 1, quad: 'first' },
  { deg: 135, fn: 'tan', n: -1, d: 1, quad: 'second' },
  { deg: 225, fn: 'tan', n: 1, d: 1, quad: 'third' },
  { deg: 315, fn: 'tan', n: -1, d: 1, quad: 'fourth' }
];

/** Words whose letters a Class 11 arrangement question can be set on. */
// Counted from the spelling rather than written down beside it. Hand-written
// letter tallies are exactly the kind of thing that is wrong in one entry out of
// twenty and produces a confidently wrong answer — MUMBAI has two Ms and KERALA
// has two As, and both are easy to miss when typing a table.
function wordProfile(word) {
  const counts = new Map();
  for (const letter of word) counts.set(letter, (counts.get(letter) || 0) + 1);
  return {
    word,
    total: word.length,
    repeats: [...counts.entries()].filter(([, k]) => k > 1).sort((a, b) => (b[1] - a[1]) || a[0].localeCompare(b[0]))
  };
}

const WORDS = [
  'PATNA', 'KOLKATA', 'CHENNAI', 'AGRA', 'INDIA', 'SHIMLA', 'JAIPUR', 'MUMBAI',
  'RANCHI', 'MYSORE', 'KANPUR', 'MADURAI', 'NAGALAND', 'GANGA', 'KERALA',
  'ODISHA', 'ALLAHABAD'
].map(wordProfile);

const arrangements = w => Math.round(fact(w.total) / w.repeats.reduce((p, [, k]) => p * fact(k), 1));

export const indiaClass11 = {

  // ── Class 11 · Relations and Functions ───────────────────────────────────
  // D1 counts a Cartesian product, D2 reads a domain off a rational function,
  // D3 asks for the range of one of NCERT's standard real functions, D4 counts
  // relations. Nothing here is dressed in a context: a Cartesian product is a
  // Cartesian product, and a story about a railway timetable would only put two
  // sentences between the student and the question.
  'c11-relations-functions': (rng, diff) => {
    if (diff === 1) {
      const p = ri(rng, 2, 5), q = ri(rng, 2, 5);
      const A = rs(rng, [1, 2, 3, 4, 5, 6, 7, 8]).slice(0, p).sort((a, b) => a - b);
      const B = rs(rng, ['a', 'b', 'c', 'd', 'e', 'f']).slice(0, q).sort();
      const want = p * q;
      return {
        prompt: `Let $A = ${setTex(A)}$ and $B = ${setTex(B)}$. How many ordered pairs are there in $A \\times B$?`,
        answerType: 'numeric', answer: { value: want },
        traps: traps(want, [
          { value: p + q, why: `$A \\times B$ pairs *every* element of $A$ with *every* element of $B$, so the counts multiply: $n(A \\times B) = n(A)\\,n(B) = ${p} \\times ${q}$.` },
          { value: Math.pow(2, p * q), why: `$2^{${p * q}}$ counts the *relations* from $A$ to $B$ — that is the number of subsets of $A \\times B$, not the size of $A \\times B$ itself.` },
          { value: Math.max(p, q), why: 'A product has one entry for each pair, not one for each element of the larger set.' }
        ]),
        hints: [
          'An element of $A \\times B$ is an ordered pair $(a,\\ b)$ with $a \\in A$ and $b \\in B$.',
          `Each of the $${p}$ choices of $a$ can be paired with each of the $${q}$ choices of $b$.`,
          `$n(A \\times B) = n(A) \\times n(B)$.`
        ],
        steps: [
          { h: 'Count each set', d: `$n(A) = ${p}$, $n(B) = ${q}$` },
          { h: 'Pair every element with every element', d: `Each of the $${p}$ first coordinates takes $${q}$ second coordinates` },
          { h: 'Multiply', d: `$n(A \\times B) = ${p} \\times ${q} = ${want}$` }
        ]
      };
    }
    if (diff === 2) {
      const a = nz(rng, -9, 9);
      let b = nz(rng, -9, 9);
      if (b === -a) b = -a + 1 || 2;
      return {
        prompt: `The real function $f(x) = \\dfrac{x ${sg(a)}}{x ${sg(-b)}}$ is defined for every real number except one. Find that number.`,
        answerType: 'numeric', answer: { value: b }, answerPrefix: 'x =',
        traps: traps(b, [
          { value: -a, why: 'That value makes the *numerator* zero, which gives $f(x) = 0$ — a perfectly good output. The domain is broken where the denominator is zero.' },
          { value: -b, why: `Solve $x ${sg(-b)} = 0$: adding $${b}$ to both sides gives $x = ${b}$, not $x = ${-b}$.` },
          { value: 0, why: 'Zero is only excluded when the denominator is $x$ itself. Here the denominator vanishes somewhere else.' }
        ]),
        hints: [
          'A rational function is defined wherever its denominator is not zero.',
          `Set the denominator to zero: $x ${sg(-b)} = 0$.`,
          'The domain is every real number except that solution.'
        ],
        steps: [
          { h: 'Find where the denominator vanishes', d: `$x ${sg(-b)} = 0$` },
          { h: 'Solve', d: `$x = ${b}$` },
          { h: 'State the domain', d: `$f$ is defined on $\\mathbb{R} \\setminus \\{${b}\\}$, so the excluded number is $${b}$` }
        ]
      };
    }
    if (diff === 3) {
      const a = nz(rng, -7, 7), b = nz(rng, -9, 9);
      const modulus = rng() < 0.5;
      const name = modulus ? 'modulus' : 'quadratic';
      const body = modulus ? `|x ${sg(-a)}|` : `(x ${sg(-a)})^2`;
      return {
        prompt: `Find the least value taken by the real function $f(x) = ${body} ${sg(b)}$.`,
        answerType: 'numeric', answer: { value: b },
        traps: traps(b, [
          { value: a, why: `$x = ${a}$ is where the least value happens, not the least value itself. Put it back into $f$ to find what $f$ is worth there.` },
          { value: a + b, why: `At $x = ${a}$ the ${name} part is zero, not $${a}$ — so what is left is the $${b}$ alone.` },
          { value: 0, why: `The ${name} part cannot go below zero, but the whole function still carries the $${b}$ added to it.` }
        ]),
        hints: [
          `The ${name} part of $f$ is never negative.`,
          `$${body} \\ge 0$ for every real $x$, and it is $0$ when $x = ${a}$.`,
          `So the smallest $f$ can be is $0 ${sg(b)}$.`
        ],
        steps: [
          { h: 'Bound the standard function', d: `$${body} \\ge 0$ for all real $x$` },
          { h: 'Find where the bound is reached', d: `$${body} = 0$ when $x = ${a}$` },
          { h: 'Evaluate f there', d: `$f(${a}) = 0 ${sg(b)} = ${b}$` },
          { h: 'State the range', d: `$f(x) \\ge ${b}$, so the least value is $${b}$` }
        ]
      };
    }
    // D4 — relations are the subsets of the Cartesian product, so there are 2^pq.
    const p = ri(rng, 2, 4), q = ri(rng, 2, 4);
    const want = Math.pow(2, p * q);
    const named = rng() < 0.5;
    const A = rs(rng, [1, 2, 3, 4, 5, 6, 7, 8]).slice(0, p).sort((a, b) => a - b);
    const B = rs(rng, ['a', 'b', 'c', 'd', 'e', 'f']).slice(0, q).sort();
    return {
      prompt: named
        ? `Let $A = ${setTex(A)}$ and $B = ${setTex(B)}$. How many relations are there from $A$ to $B$?`
        : `A set $A$ has $${p}$ elements and a set $B$ has $${q}$ elements. How many relations are there from $A$ to $B$?`,
      answerType: 'numeric', answer: { value: want },
      traps: traps(want, [
        { value: p * q, why: `$${p * q}$ is $n(A \\times B)$ — the number of *pairs*. A relation is a whole subset of those pairs, and each pair is in it or out of it.` },
        { value: Math.pow(2, p + q), why: 'The exponent counts the pairs available, which is $n(A)\\,n(B)$, not $n(A) + n(B)$.' },
        { value: Math.pow(p, q), why: `$p^q$ counts functions from $B$ to $A$ if anything; a relation is any subset of $A \\times B$, so the base is $2$.` }
      ]),
      hints: [
        'A relation from $A$ to $B$ is any subset of $A \\times B$.',
        `$A \\times B$ has $${p} \\times ${q} = ${p * q}$ ordered pairs.`,
        `A set of $${p * q}$ things has $2^{${p * q}}$ subsets.`
      ],
      steps: [
        { h: 'A relation is a subset of the product', d: 'Every relation from $A$ to $B$ is a subset of $A \\times B$, and every subset is a relation' },
        { h: 'Count the pairs', d: `$n(A \\times B) = ${p} \\times ${q} = ${p * q}$` },
        { h: 'Count the subsets', d: `Each pair is in or out: $2^{${p * q}} = ${want}$` }
      ]
    };
  },

  // ── Class 11 · Trigonometric Functions ───────────────────────────────────
  // D1–D2 are radian measure and the unit circle, D3 is the compound-angle
  // identity, D4 is the general solution — the last of which the 2026–27 CBSE
  // syllabus lists as formative only, which is why it holds one rung and not a
  // third of the chapter.
  'c11-trig-functions': (rng, diff) => {
    if (diff === 1) {
      const deg = rc(rng, [30, 45, 60, 90, 120, 135, 150, 180, 210, 225, 240, 270, 300, 315, 330]);
      const k = frac(deg, 180);
      return {
        prompt: `Express $${deg}°$ in radian measure. Writing the answer as $k\\pi$ radians, find $k$.`,
        answerType: 'numeric', ...exact(k),
        traps: traps(k.value, [
          { value: frac(deg, 360).value, why: 'A full turn is $2\\pi$ radians and $360°$, so $180°$ matches $\\pi$ — the conversion factor is $\\dfrac{\\pi}{180}$, not $\\dfrac{\\pi}{360}$.' },
          { value: frac(180, deg).value, why: `Degrees are converted by *multiplying* by $\\dfrac{\\pi}{180}$, so the $${deg}$ ends up on top: $${deg} \\times \\dfrac{\\pi}{180}$.` },
          { value: deg, why: 'That is still the degree measure. Multiply it by $\\dfrac{\\pi}{180}$ to change units.' }
        ]),
        hints: [
          '$180° = \\pi$ radians.',
          `So $1° = \\dfrac{\\pi}{180}$ radians, and $${deg}° = ${deg} \\times \\dfrac{\\pi}{180}$.`,
          `Reduce $\\dfrac{${deg}}{180}$ to lowest terms.`
        ],
        steps: [
          { h: 'The conversion', d: '$180° = \\pi$ radians, so $1° = \\dfrac{\\pi}{180}$ radians' },
          { h: 'Substitute', d: `$${deg}° = \\dfrac{${deg}\\pi}{180}$` },
          { h: 'Reduce', d: `$= ${fracTex(k.n, k.d)}\\pi$ radians, so $k = ${fracTex(k.n, k.d)}$` }
        ]
      };
    }
    if (diff === 2) {
      const c = rc(rng, UNIT_CIRCLE);
      const want = frac(c.n, c.d);
      const ref = c.deg <= 90 ? c.deg : c.deg <= 180 ? 180 - c.deg : c.deg <= 270 ? c.deg - 180 : 360 - c.deg;
      return {
        prompt: `Use the unit circle to find the exact value of $\\${c.fn} ${c.deg}°$.`,
        answerType: 'numeric', ...exact(want),
        traps: traps(want.value, [
          { value: -want.value, why: `The magnitude is right but the sign is not: $${c.deg}°$ lies in the ${c.quad} quadrant, where $\\${c.fn}$ is ${want.value < 0 ? 'negative' : 'positive'}.` },
          { value: frac(c.d, Math.abs(c.n) || 1).value, why: 'The reference-angle value has been inverted. Read it straight off the unit circle rather than as a reciprocal.' },
          { value: ref, why: `$${ref}°$ is the *reference angle* — the acute angle to the $x$-axis. It is used to find the value, but it is not the value.` }
        ]),
        hints: [
          `$${c.deg}°$ lies in the ${c.quad} quadrant.`,
          `Its reference angle is $${ref}°$.`,
          `In the ${c.quad} quadrant $\\${c.fn}$ is ${want.value < 0 ? 'negative' : 'positive'}.`
        ],
        steps: [
          { h: 'Locate the angle', d: `$${c.deg}°$ is in the ${c.quad} quadrant` },
          { h: 'Take the reference angle', d: `$${ref}°$, whose $\\${c.fn}$ is $${fracTex(Math.abs(c.n), c.d)}$` },
          { h: 'Apply the quadrant sign', d: `$\\${c.fn}$ is ${want.value < 0 ? 'negative' : 'positive'} there` },
          { h: 'Answer', d: `$\\${c.fn} ${c.deg}° = ${fracTex(want.n, want.d)}$` }
        ]
      };
    }
    if (diff === 3) {
      const [pa, qa, ra] = rc(rng, TRIPLES);
      let second = rc(rng, TRIPLES);
      if (second[2] === ra) second = TRIPLES[(TRIPLES.findIndex(t => t[2] === ra) + 1) % TRIPLES.length];
      const [pb, qb, rb] = second;
      const plus = rng() < 0.5;
      // A and B are acute: sin A = pa/ra, cos A = qa/ra, sin B = pb/rb, cos B = qb/rb
      const want = plus
        ? frac(pa * qb + qa * pb, ra * rb)      // sin(A + B)
        : frac(qa * qb + pa * pb, ra * rb);     // cos(A − B)
      const wrong = plus
        ? frac(pa * qb - qa * pb, ra * rb)
        : frac(qa * qb - pa * pb, ra * rb);
      return {
        prompt: `$A$ and $B$ are acute angles with $\\sin A = ${fracTex(pa, ra)}$ and $\\sin B = ${fracTex(pb, rb)}$. Find the exact value of $\\${plus ? 'sin' : 'cos'}(A ${plus ? '+' : '-'} B)$.`,
        answerType: 'numeric', ...exact(want),
        traps: traps(want.value, [
          {
            value: wrong.value,
            why: plus
              ? '$\\sin(A+B) = \\sin A\\cos B + \\cos A\\sin B$ — the two products are *added*. The minus sign belongs to $\\sin(A-B)$.'
              : '$\\cos(A-B) = \\cos A\\cos B + \\sin A\\sin B$ — the sign flips relative to $\\cos(A+B)$, so the two products are added here.'
          },
          { value: frac(pa * pb, ra * rb).value, why: `$\\${plus ? 'sin' : 'cos'}$ of a sum is not $\\${plus ? 'sin' : 'cos'} A$ times $\\${plus ? 'sin' : 'cos'} B$ — that is the mistake the compound-angle formula exists to prevent.` },
          { value: frac(pa * rb + pb * ra, ra * rb).value, why: 'The formula mixes a sine with a *cosine* in each product. Find $\\cos A$ and $\\cos B$ from $\\sin^2 + \\cos^2 = 1$ first.' }
        ]),
        hints: [
          `Both angles are acute, so both cosines are positive: $\\cos A = ${fracTex(qa, ra)}$ and $\\cos B = ${fracTex(qb, rb)}$.`,
          plus
            ? '$\\sin(A+B) = \\sin A\\cos B + \\cos A\\sin B$.'
            : '$\\cos(A-B) = \\cos A\\cos B + \\sin A\\sin B$.',
          `Every term has denominator $${ra} \\times ${rb} = ${ra * rb}$.`
        ],
        steps: [
          { h: 'Find the missing ratios', d: `$\\cos A = \\sqrt{1 - \\left(${fracTex(pa, ra)}\\right)^2} = ${fracTex(qa, ra)}$ and $\\cos B = ${fracTex(qb, rb)}$ — both positive because $A$ and $B$ are acute` },
          { h: 'Write the compound-angle identity', d: plus ? '$\\sin(A+B) = \\sin A\\cos B + \\cos A\\sin B$' : '$\\cos(A-B) = \\cos A\\cos B + \\sin A\\sin B$' },
          { h: 'Substitute', d: plus
            ? `$= ${fracTex(pa, ra)} \\times ${fracTex(qb, rb)} + ${fracTex(qa, ra)} \\times ${fracTex(pb, rb)}$`
            : `$= ${fracTex(qa, ra)} \\times ${fracTex(qb, rb)} + ${fracTex(pa, ra)} \\times ${fracTex(pb, rb)}$` },
          { h: 'Evaluate', d: `$= \\dfrac{${plus ? `${pa * qb} + ${qa * pb}` : `${qa * qb} + ${pa * pb}`}}{${ra * rb}} = ${fracTex(want.n, want.d)}$` }
        ]
      };
    }
    // D4 — how many times a trigonometric equation is satisfied on one turn.
    const cases = [
      { eq: '\\sin x = \\dfrac{1}{2}', n: 2, why: 'a sine takes each value strictly between $-1$ and $1$ twice on one revolution' },
      { eq: '\\cos x = \\dfrac{1}{2}', n: 2, why: 'a cosine takes each value strictly between $-1$ and $1$ twice on one revolution' },
      { eq: '\\sin x = 1', n: 1, why: 'a sine reaches its maximum once on one revolution' },
      { eq: '\\cos x = -1', n: 1, why: 'a cosine reaches its minimum once on one revolution' },
      { eq: '\\tan x = 1', n: 2, why: 'a tangent repeats every $\\pi$, so it hits each value twice on an interval of length $2\\pi$' },
      { eq: '\\sin x = 0', n: 3, why: 'a sine is zero at $0$, $\\pi$ and $2\\pi$, and the interval is closed at both ends' },
      { eq: '\\sin 2x = 0', n: 5, why: 'as $x$ runs over $[0,\\ 2\\pi]$, $2x$ runs over $[0,\\ 4\\pi]$ and meets a zero five times' },
      { eq: '\\cos 2x = 1', n: 3, why: 'as $x$ runs over $[0,\\ 2\\pi]$, $2x$ runs over $[0,\\ 4\\pi]$, where the cosine is $1$ at $0$, $2\\pi$ and $4\\pi$' },
      { eq: '\\cos x = 0', n: 2, why: 'a cosine is zero at $\\dfrac{\\pi}{2}$ and at $\\dfrac{3\\pi}{2}$' },
      { eq: '\\sin x = -\\dfrac{1}{2}', n: 2, why: 'a sine takes each value strictly between $-1$ and $1$ twice on one revolution' },
      { eq: '\\cos x = -\\dfrac{1}{2}', n: 2, why: 'a cosine takes each value strictly between $-1$ and $1$ twice on one revolution' },
      { eq: '\\tan x = 0', n: 3, why: 'a tangent is zero at $0$, $\\pi$ and $2\\pi$, and the interval is closed at both ends' },
      { eq: '\\cos x = 1', n: 2, why: 'a cosine is $1$ at $0$ and again at $2\\pi$, and both endpoints are inside the closed interval' },
      { eq: '\\sin 2x = 1', n: 2, why: 'as $x$ runs over $[0,\\ 2\\pi]$, $2x$ runs over $[0,\\ 4\\pi]$, where the sine reaches its maximum twice' },
      { eq: '\\tan 2x = 0', n: 5, why: 'as $x$ runs over $[0,\\ 2\\pi]$, $2x$ runs over $[0,\\ 4\\pi]$ and the tangent is zero five times' },
      { eq: '\\sin 3x = 0', n: 7, why: 'as $x$ runs over $[0,\\ 2\\pi]$, $3x$ runs over $[0,\\ 6\\pi]$ and meets a zero seven times' },
      { eq: '\\cos 3x = -1', n: 3, why: 'as $x$ runs over $[0,\\ 2\\pi]$, $3x$ runs over $[0,\\ 6\\pi]$, where the cosine is $-1$ at $\\pi$, $3\\pi$ and $5\\pi$' },
      { eq: '\\sin x = -1', n: 1, why: 'a sine reaches its minimum once on one revolution' }
    ];
    const c = rc(rng, cases);
    return {
      prompt: `How many solutions does the equation $${c.eq}$ have for $0 \\le x \\le 2\\pi$?`,
      answerType: 'numeric', answer: { value: c.n },
      traps: traps(c.n, [
        { value: 1, why: `The principal value is only one of them — ${c.why}.` },
        { value: c.n + 1, why: 'Check the endpoints: $x = 0$ and $x = 2\\pi$ are the same point on the circle, so a solution there is counted once for each, but only when the equation actually holds at both.' },
        { value: 0, why: 'The equation does have solutions on this interval — sketch the graph over one revolution and count the crossings.' }
      ]),
      hints: [
        'Sketch the function over one revolution and draw the horizontal line.',
        'Each crossing of the line is a solution.',
        `Here ${c.why}.`
      ],
      steps: [
        { h: 'Sketch over one revolution', d: `Draw $y$ against $x$ for $0 \\le x \\le 2\\pi$ and the horizontal line the equation sets` },
        { h: 'Count the crossings', d: `${c.why[0].toUpperCase()}${c.why.slice(1)}` },
        { h: 'Answer', d: `$${c.n}$ solution${c.n === 1 ? '' : 's'}` }
      ]
    };
  },

  // ── Class 11 · Complex Numbers and Quadratic Equations ───────────────────
  // D1–D2 are the algebraic properties the current syllabus keeps, D3 the
  // Argand plane, D4 the complex roots of a real quadratic.
  'c11-complex-numbers': (rng, diff) => {
    if (diff === 1) {
      const a = nz(rng, -8, 8), b = nz(rng, -8, 8);
      const c = nz(rng, -8, 8), d = nz(rng, -8, 8);
      const askReal = rng() < 0.5;
      const re = a * c - b * d, im = a * d + b * c;
      const want = askReal ? re : im;
      return {
        prompt: `Let $z_1 = ${a} ${sg(b)}i$ and $z_2 = ${c} ${sg(d)}i$. Find the ${askReal ? 'real' : 'imaginary'} part of $z_1 z_2$.`,
        answerType: 'numeric', answer: { value: want },
        traps: traps(want, [
          { value: askReal ? a * c + b * d : a * d - b * c, why: askReal ? `$i^2 = -1$, so the $bd\\,i^2$ term *subtracts*: the real part is $ac - bd$.` : 'The two cross terms both carry a single $i$, so they add: the imaginary part is $ad + bc$.' },
          { value: askReal ? im : re, why: askReal ? 'That is the imaginary part — the coefficient of $i$.' : 'That is the real part. The imaginary part is the coefficient of $i$, not the term without one.' },
          { value: askReal ? a * c : b * d, why: 'Multiplying two binomials produces four terms, not one. Expand fully before collecting.' }
        ]),
        hints: [
          'Multiply as you would two binomials, then use $i^2 = -1$.',
          `$(${a} ${sg(b)}i)(${c} ${sg(d)}i) = ${a * c} ${sg(a * d)}i ${sg(b * c)}i ${sg(b * d)}i^2$.`,
          'Replace $i^2$ by $-1$ and collect the real and imaginary parts.'
        ],
        steps: [
          { h: 'Expand', d: `$(${a} ${sg(b)}i)(${c} ${sg(d)}i) = ${a * c} ${sg(a * d)}i ${sg(b * c)}i ${sg(b * d)}i^2$` },
          { h: 'Use i² = −1', d: `$${b * d}i^2 = ${-b * d}$` },
          { h: 'Collect', d: `$z_1z_2 = ${re} ${sg(im)}i$` },
          { h: 'Read off the part asked for', d: `${askReal ? 'Real' : 'Imaginary'} part $= ${want}$` }
        ]
      };
    }
    if (diff === 2) {
      const [p, q, r] = rc(rng, TRIPLES);
      const a = rng() < 0.5 ? p : -p;
      const b = rng() < 0.5 ? q : -q;
      return {
        prompt: `Find $|z|$ for $z = ${a} ${sg(b)}i$.`,
        answerType: 'numeric', answer: { value: r },
        traps: traps(r, [
          { value: Math.abs(a) + Math.abs(b), why: 'The modulus is the distance from the origin in the Argand plane, so it comes from Pythagoras — the parts are squared before they are added, not added directly.' },
          { value: a * a + b * b, why: `$a^2 + b^2 = ${a * a + b * b}$ is the square of the modulus. The square root is still to be taken.` },
          { value: Math.abs(a), why: 'The modulus uses both parts. Only the real part has been kept here.' }
        ]),
        hints: [
          'Plot $z$ in the Argand plane: the modulus is its distance from the origin.',
          '$|a + bi| = \\sqrt{a^2 + b^2}$.',
          `$${a * a} + ${b * b} = ${a * a + b * b}$.`
        ],
        steps: [
          { h: 'The modulus is a distance', d: '$|a + bi| = \\sqrt{a^2 + b^2}$' },
          { h: 'Square both parts', d: `$(${a})^2 + (${b})^2 = ${a * a} + ${b * b} = ${a * a + b * b}$` },
          { h: 'Take the square root', d: `$|z| = \\sqrt{${a * a + b * b}} = ${r}$` }
        ]
      };
    }
    if (diff === 3) {
      const cases = [
        { a: 1, b: 1, arg: 45, quad: 'first' },
        { a: -1, b: 1, arg: 135, quad: 'second' },
        { a: -1, b: -1, arg: -135, quad: 'third' },
        { a: 1, b: -1, arg: -45, quad: 'fourth' },
        { a: 0, b: 1, arg: 90, quad: 'positive imaginary axis' },
        { a: 0, b: -1, arg: -90, quad: 'negative imaginary axis' },
        { a: -1, b: 0, arg: 180, quad: 'negative real axis' }
      ];
      const c = rc(rng, cases);
      const k = ri(rng, 1, 9);
      const re = c.a * k, im = c.b * k;
      const zTex = im === 0 ? `${re}` : re === 0 ? `${im === 1 ? '' : im === -1 ? '-' : im}i` : `${re} ${sg(im)}i`;
      return {
        prompt: `Find the principal argument of $z = ${zTex}$, in degrees. The principal argument lies in $(-180°,\\ 180°]$.`,
        answerType: 'numeric', answer: { value: c.arg }, answerSuffix: 'degrees',
        traps: traps(c.arg, [
          { value: c.arg < 0 ? c.arg + 360 : c.arg - 360, why: `That angle names the same direction, but it is outside $(-180°,\\ 180°]$ — the principal argument is the one representative inside that interval.` },
          { value: Math.abs(c.arg), why: `$z$ lies on the ${c.quad}, so its argument is measured ${c.arg < 0 ? 'clockwise, and is negative' : 'anticlockwise, and is positive'}.` },
          { value: 90 - c.arg, why: 'The argument is measured from the positive real axis, not from the imaginary axis.' }
        ]),
        hints: [
          `Plot $z$ in the Argand plane: it lies on the ${c.quad}.`,
          'The argument is the angle from the positive real axis, anticlockwise positive.',
          'Bring it into $(-180°,\\ 180°]$ by adding or subtracting $360°$ if necessary.'
        ],
        steps: [
          { h: 'Plot z', d: `$z = ${zTex}$ lies on the ${c.quad}` },
          { h: 'Measure from the positive real axis', d: `The direction makes an angle of $${Math.abs(c.arg)}°$ with it` },
          { h: 'Choose the principal value', d: `Inside $(-180°,\\ 180°]$ that is $${c.arg}°$` }
        ]
      };
    }
    // D4 — a real quadratic with no real roots, solved in the complex numbers.
    const m = nz(rng, -6, 6), q = ri(rng, 1, 7);
    const b = -2 * m, c = m * m + q * q;
    return {
      prompt: `Solve $x^2 ${sg(b)}x ${sg(c)} = 0$ over the complex numbers. Writing the roots as $p \\pm qi$ with $q > 0$, find $q$.`,
      answerType: 'numeric', answer: { value: q }, answerPrefix: 'q =',
      traps: traps(q, [
        { value: m, why: `$${m}$ is $p$, the real part shared by both roots. The question asks for the imaginary part.` },
        { value: 2 * q, why: `The formula divides the whole numerator by $2a = 2$, so $\\sqrt{|b^2-4ac|} = ${2 * q}$ still has to be halved.` },
        { value: b * b - 4 * c, why: `That is the discriminant $b^2 - 4ac = ${b * b - 4 * c}$. It is negative, which is why the roots are complex; its size is not the imaginary part.` }
      ]),
      hints: [
        `Here $a = 1$, $b = ${b}$ and $c = ${c}$.`,
        `$b^2 - 4ac = ${b * b} - ${4 * c} = ${b * b - 4 * c}$, which is negative — so write $\\sqrt{${b * b - 4 * c}} = ${2 * q}i$.`,
        `$x = \\dfrac{${-b} \\pm ${2 * q}i}{2}$.`
      ],
      steps: [
        { h: 'Evaluate the discriminant', d: `$b^2 - 4ac = ${b * b} - ${4 * c} = ${b * b - 4 * c} < 0$` },
        { h: 'Take the square root in ℂ', d: `$\\sqrt{${b * b - 4 * c}} = \\sqrt{${4 * q * q}}\\,i = ${2 * q}i$` },
        { h: 'Apply the formula', d: `$x = \\dfrac{${-b} \\pm ${2 * q}i}{2} = ${m} \\pm ${q}i$` },
        { h: 'Read off q', d: `$q = ${q}$` }
      ]
    };
  },

  // ── Class 11 · Permutations and Combinations ─────────────────────────────
  // The fundamental principle of counting, arrangements of the letters of a
  // word, a selection with a restriction, and one of the combination identities
  // read backwards. The contexts are the ones NCERT sets: journeys, names of
  // places, and picking a cricket XI.
  'c11-permutations-combinations': (rng, diff) => {
    if (diff === 1) {
      const [from, to] = twoCities(rng);
      let via = rc(rng, IN_CITIES);
      let guard = 20;
      while ((via === from || via === to) && guard--) via = rc(rng, IN_CITIES);
      const trains = ri(rng, 2, 6), buses = ri(rng, 2, 6);
      const want = trains * buses;
      return {
        prompt: `There are $${trains}$ trains from ${from} to ${via} and $${buses}$ buses from ${via} to ${to}. In how many ways can a traveller go from ${from} to ${to} through ${via}?`,
        answerType: 'numeric', answer: { value: want },
        traps: traps(want, [
          { value: trains + buses, why: 'The two legs both happen, one after the other, so the counts multiply. Adding would be right if the traveller chose *either* a train *or* a bus for a single journey.' },
          { value: Math.max(trains, buses), why: 'Every train can be followed by every bus, so both numbers matter.' },
          { value: nPr(trains + buses, 2), why: 'Nothing here is being arranged in order; each leg is one independent choice.' }
        ]),
        hints: [
          'The journey is made of two independent choices, one after the other.',
          'The fundamental principle of counting: if one job can be done in $m$ ways and a second in $n$ ways, the pair can be done in $mn$ ways.',
          `$${trains} \\times ${buses}$.`
        ],
        steps: [
          { h: 'Break the journey into stages', d: `${from} → ${via} in $${trains}$ ways, then ${via} → ${to} in $${buses}$ ways` },
          { h: 'Apply the fundamental principle of counting', d: `Independent successive choices multiply` },
          { h: 'Evaluate', d: `$${trains} \\times ${buses} = ${want}$` }
        ]
      };
    }
    if (diff === 2) {
      const w = rc(rng, WORDS);
      const want = arrangements(w);
      const naive = fact(w.total);
      const repeatNote = w.repeats.length
        ? w.repeats.map(([letter, k]) => `${letter} appears $${k}$ times`).join(' and ')
        : 'every letter is different';
      return {
        prompt: `In how many distinct ways can the letters of the word ${w.word} be arranged?`,
        answerType: 'numeric', answer: { value: want },
        traps: traps(want, [
          {
            value: naive,
            why: w.repeats.length
              ? `$${w.total}! = ${naive}$ treats the repeated letters as if they were distinguishable. Divide by $${w.repeats.map(([, k]) => `${k}!`).join(' \\times ')}$ to undo that.`
              : 'That is the right count here — but check the letters for repeats before writing it down, because a repeat would make it too large.'
          },
          { value: w.total, why: 'That is how many letters there are, not how many orders they can be put in.' },
          { value: nCr(w.total, 2), why: 'An arrangement uses every letter and cares about order, so it is a permutation of all of them, not a selection of two.' }
        ].filter(t => t.value !== naive || w.repeats.length > 0)),
        hints: [
          `${w.word} has $${w.total}$ letters, and ${repeatNote}.`,
          w.repeats.length
            ? 'Arrangements of $n$ letters with repeats: $\\dfrac{n!}{p!\\,q!\\,\\dots}$, one factorial for each repeated letter.'
            : 'With all letters different the count is simply $n!$.',
          w.repeats.length
            ? `$\\dfrac{${w.total}!}{${w.repeats.map(([, k]) => `${k}!`).join(' \\times ')}}$.`
            : `$${w.total}!$.`
        ],
        steps: [
          { h: 'Count the letters', d: `${w.word} has $${w.total}$ letters` },
          { h: 'Find the repeats', d: `${repeatNote[0].toUpperCase()}${repeatNote.slice(1)}` },
          { h: 'Divide out the repeats', d: w.repeats.length ? `$\\dfrac{${w.total}!}{${w.repeats.map(([, k]) => `${k}!`).join(' \\times ')}} = \\dfrac{${naive}}{${w.repeats.reduce((p, [, k]) => p * fact(k), 1)}}$` : `$${w.total}!$ — nothing to divide out` },
          { h: 'Evaluate', d: `$= ${want}$` }
        ]
      };
    }
    if (diff === 3) {
      const squad = ri(rng, 14, 17);
      const bowlers = ri(rng, 4, 6);
      const others = squad - bowlers;
      const pickBowlers = ri(rng, 3, 4);
      if (pickBowlers > bowlers || 11 - pickBowlers > others) return indiaClass11['c11-permutations-combinations'](rng, 4);
      const want = nCr(bowlers, pickBowlers) * nCr(others, 11 - pickBowlers);
      return {
        prompt: `A cricket squad has $${squad}$ players, of whom $${bowlers}$ are bowlers. In how many ways can a team of $11$ be chosen so that it contains exactly $${pickBowlers}$ bowlers?`,
        answerType: 'numeric', answer: { value: want },
        traps: traps(want, [
          { value: nCr(squad, 11), why: `$\\binom{${squad}}{11}$ counts every team of $11$, with no condition on how many bowlers it has.` },
          { value: nCr(bowlers, pickBowlers) + nCr(others, 11 - pickBowlers), why: 'The bowlers and the rest are chosen together, so the two counts multiply. Adding would count a choice of bowlers *or* a choice of the others, not both.' },
          { value: nCr(bowlers, pickBowlers) * nCr(others, 11 - pickBowlers - 1), why: `The team has $11$ players in all, so once $${pickBowlers}$ bowlers are in, $11 - ${pickBowlers} = ${11 - pickBowlers}$ more come from the other $${others}$.` }
        ]),
        hints: [
          'Split the choice into two independent selections.',
          `Choose $${pickBowlers}$ of the $${bowlers}$ bowlers, then $${11 - pickBowlers}$ of the other $${others}$ players.`,
          `$\\binom{${bowlers}}{${pickBowlers}} \\times \\binom{${others}}{${11 - pickBowlers}}$.`
        ],
        steps: [
          { h: 'Split the selection', d: `Bowlers: $\\binom{${bowlers}}{${pickBowlers}}$; the rest: $\\binom{${others}}{${11 - pickBowlers}}$` },
          { h: 'Evaluate each', d: `$\\binom{${bowlers}}{${pickBowlers}} = ${nCr(bowlers, pickBowlers)}$ and $\\binom{${others}}{${11 - pickBowlers}} = ${nCr(others, 11 - pickBowlers)}$` },
          { h: 'Multiply', d: `$${nCr(bowlers, pickBowlers)} \\times ${nCr(others, 11 - pickBowlers)} = ${want}$` }
        ]
      };
    }
    // D4 — a combination identity read backwards.
    const n = ri(rng, 5, 20);
    const value = nCr(n, 2);
    return {
      prompt: `Given that $\\binom{n}{2} = ${value}$, find $n$.`,
      answerType: 'numeric', answer: { value: n }, answerPrefix: 'n =',
      traps: traps(n, [
        { value: value, why: `$${value}$ is $\\binom{n}{2}$ itself, not $n$. Solve $\\dfrac{n(n-1)}{2} = ${value}$ for $n$.` },
        { value: 2 * value, why: `Clearing the $2$ gives $n(n-1) = ${2 * value}$ — a product of two consecutive integers, not $n$ on its own.` },
        { value: n - 1, why: `$n$ and $n-1$ are the two consecutive factors; the larger of them is $n$.` }
      ]),
      hints: [
        '$\\binom{n}{2} = \\dfrac{n(n-1)}{2}$.',
        `So $n(n-1) = ${2 * value}$.`,
        'Look for two consecutive integers with that product.'
      ],
      steps: [
        { h: 'Expand the combination', d: `$\\binom{n}{2} = \\dfrac{n(n-1)}{2} = ${value}$` },
        { h: 'Clear the denominator', d: `$n(n-1) = ${2 * value}$` },
        { h: 'Solve', d: `$n^2 - n - ${2 * value} = 0$, so $n = ${n}$ (rejecting the negative root)` }
      ]
    };
  },

  // ── Class 11 · Sequences and Series ──────────────────────────────────────
  // Class 10 already owns the arithmetic progression, so D1–D2 recall it in the
  // savings-and-instalments contexts NCERT uses and D3–D4 do what Class 11 is
  // actually for: the geometric progression, finite and infinite.
  'c11-sequences-series': (rng, diff) => {
    if (diff === 1) {
      const a = 50 * ri(rng, 4, 18);
      const d = 50 * ri(rng, 1, 6);
      const n = ri(rng, 6, 20);
      const [saver] = twoNames(rng);
      const want = a + (n - 1) * d;
      return {
        prompt: `${saver} puts $₹${a}$ into a recurring deposit in the first month and increases the amount by $₹${d}$ every month after that. How much does ${saver} deposit in the $${n}$th month?`,
        answerType: 'numeric', answer: { value: want }, answerPrefix: '₹',
        traps: traps(want, [
          { value: a + n * d, why: `The first month already counts as a term, so the increase has happened $${n} - 1 = ${n - 1}$ times by the $${n}$th month, not $${n}$ times.` },
          { value: n * a + (n * (n - 1) / 2) * d, why: 'That is the *total* deposited over the whole period. The question asks for one month\'s deposit.' },
          { value: a * d, why: 'The deposits grow by addition, not multiplication — this is an arithmetic progression, not a geometric one.' }
        ]),
        hints: [
          'The deposits form an arithmetic progression.',
          `First term $a = ${a}$, common difference $d = ${d}$.`,
          `$a_n = a + (n-1)d$ with $n = ${n}$.`
        ],
        steps: [
          { h: 'Identify the progression', d: `Arithmetic, with $a = ${a}$ and $d = ${d}$` },
          { h: 'Write the nth term', d: '$a_n = a + (n-1)d$' },
          { h: 'Substitute', d: `$a_{${n}} = ${a} + ${n - 1} \\times ${d}$` },
          { h: 'Evaluate', d: `$= ₹${want}$` }
        ]
      };
    }
    if (diff === 2) {
      const a = ri(rng, 8, 30);
      const d = ri(rng, 2, 9);
      const n = ri(rng, 8, 24);
      const want = (n * (2 * a + (n - 1) * d)) / 2;
      const rows = n;
      return {
        prompt: `An auditorium in ${rc(rng, IN_CITIES)} has $${rows}$ rows. The first row has $${a}$ seats and each row after it has $${d}$ more seats than the row in front. How many seats does the auditorium have in all?`,
        answerType: 'numeric', answer: { value: want },
        traps: traps(want, [
          { value: a + (n - 1) * d, why: `That is the number of seats in the last row alone. The question asks for the sum of all $${n}$ rows.` },
          { value: n * a, why: `That would be right only if every row had $${a}$ seats. The rows grow by $${d}$ each time.` },
          { value: n * (2 * a + n * d) / 2, why: `The bracket is $2a + (n-1)d$: by the last row the increase has happened $${n - 1}$ times, not $${n}$.` }
        ]),
        hints: [
          'The seat counts form an arithmetic progression.',
          `$a = ${a}$, $d = ${d}$, $n = ${n}$.`,
          '$S_n = \\dfrac{n}{2}\\left[2a + (n-1)d\\right]$.'
        ],
        steps: [
          { h: 'Identify the progression', d: `Arithmetic, $a = ${a}$, $d = ${d}$, $n = ${n}$` },
          { h: 'Write the sum formula', d: '$S_n = \\dfrac{n}{2}\\left[2a + (n-1)d\\right]$' },
          { h: 'Substitute', d: `$S_{${n}} = \\dfrac{${n}}{2}\\left[${2 * a} + ${n - 1} \\times ${d}\\right] = \\dfrac{${n}}{2} \\times ${2 * a + (n - 1) * d}$` },
          { h: 'Evaluate', d: `$= ${want}$ seats` }
        ]
      };
    }
    if (diff === 3) {
      const a = ri(rng, 2, 9);
      const r = ri(rng, 2, 4);
      const n = ri(rng, 4, 8);
      const askSum = rng() < 0.5;
      const nth = a * Math.pow(r, n - 1);
      const sum = a * (Math.pow(r, n) - 1) / (r - 1);
      const want = askSum ? sum : nth;
      return {
        prompt: askSum
          ? `A geometric progression begins $${a},\\ ${a * r},\\ ${a * r * r},\\ \\dots$ Find the sum of its first $${n}$ terms.`
          : `A geometric progression begins $${a},\\ ${a * r},\\ ${a * r * r},\\ \\dots$ Find its $${n}$th term.`,
        answerType: 'numeric', answer: { value: want },
        traps: traps(want, [
          { value: askSum ? nth : sum, why: askSum ? `$${nth}$ is the $${n}$th term on its own. The sum adds all $${n}$ of them.` : `$${sum}$ is the sum of the first $${n}$ terms. The question asks for the $${n}$th term alone.` },
          { value: askSum ? a * (Math.pow(r, n) - 1) : a * Math.pow(r, n), why: askSum ? `The formula divides by $r - 1 = ${r - 1}$.` : `The exponent is $n - 1 = ${n - 1}$, because the first term is $ar^0$.` },
          { value: a + (n - 1) * (a * r - a), why: 'The terms are multiplied by a common *ratio*, not increased by a common difference — this is a GP, not an AP.' }
        ]),
        hints: [
          `The ratio between consecutive terms is $r = ${r}$.`,
          askSum ? '$S_n = \\dfrac{a(r^n - 1)}{r - 1}$ for $r \\ne 1$.' : '$a_n = ar^{\\,n-1}$.',
          askSum ? `$\\dfrac{${a}(${r}^{${n}} - 1)}{${r - 1}}$.` : `$${a} \\times ${r}^{${n - 1}}$.`
        ],
        steps: [
          { h: 'Identify the progression', d: `Geometric, $a = ${a}$, $r = ${r}$` },
          { h: askSum ? 'Write the sum formula' : 'Write the nth term', d: askSum ? '$S_n = \\dfrac{a(r^n - 1)}{r - 1}$' : '$a_n = ar^{\\,n-1}$' },
          { h: 'Substitute', d: askSum ? `$S_{${n}} = \\dfrac{${a}(${Math.pow(r, n)} - 1)}{${r - 1}}$` : `$a_{${n}} = ${a} \\times ${r}^{${n - 1}} = ${a} \\times ${Math.pow(r, n - 1)}$` },
          { h: 'Evaluate', d: `$= ${want}$` }
        ]
      };
    }
    // D4 — the infinite geometric progression, which is what Class 11 adds.
    const den = ri(rng, 2, 6);
    const negative = rng() < 0.4;
    const a = ri(rng, 2, 12) * den;
    const rN = negative ? -1 : 1, rD = den;
    const want = frac(a * rD, rD - rN);        // a / (1 − r)
    const rTex = fracTex(rN, rD);
    return {
      prompt: `Find the sum to infinity of the geometric progression with first term $${a}$ and common ratio $${rTex}$.`,
      answerType: 'numeric', ...exact(want),
      traps: traps(want.value, [
        { value: frac(a * rD, rD + rN).value, why: `The denominator of $S_\\infty$ is $1 - r$. With $r = ${rTex}$ that is $1 - \\left(${rTex}\\right)$, and subtracting a negative ratio adds it.` },
        { value: frac(a, rD - rN).value, why: 'The numerator of $S_\\infty = \\dfrac{a}{1-r}$ is the first term itself, undivided.' },
        { value: a, why: 'That is only the first term. An infinite GP with $|r| < 1$ sums to a finite total larger in size than its first term.' }
      ]),
      hints: [
        `$|r| = \\dfrac{1}{${den}} < 1$, so the sum to infinity exists.`,
        '$S_\\infty = \\dfrac{a}{1 - r}$.',
        `$1 - \\left(${rTex}\\right) = ${fracTex(rD - rN, rD)}$.`
      ],
      steps: [
        { h: 'Check the ratio', d: `$|r| = \\dfrac{1}{${den}} < 1$, so the series converges` },
        { h: 'Write the sum to infinity', d: '$S_\\infty = \\dfrac{a}{1-r}$' },
        { h: 'Substitute', d: `$= \\dfrac{${a}}{1 - \\left(${rTex}\\right)} = \\dfrac{${a}}{${fracTex(rD - rN, rD)}}$` },
        { h: 'Evaluate', d: `$= ${fracTex(want.n, want.d)}$` }
      ]
    };
  },

  // ── Class 11 · Straight Lines ────────────────────────────────────────────
  // Slope, the standard forms, the angle between two lines and the distance of
  // a point from a line — the four bullets the CBSE syllabus lists, in that
  // order. The coefficients of the D4 line are drawn from Pythagorean triples,
  // so $\sqrt{A^2+B^2}$ is a whole number and the distance is an exact fraction
  // rather than 2.9154759474226504.
  'c11-straight-lines': (rng, diff) => {
    if (diff === 1) {
      const x1 = nz(rng, -8, 8), y1 = nz(rng, -8, 8);
      let x2 = nz(rng, -8, 8), y2 = nz(rng, -8, 8);
      if (x2 === x1) x2 = x1 + 1;
      if (y2 === y1) y2 = y1 + 1;
      const m = frac(y2 - y1, x2 - x1);
      return {
        prompt: `Find the slope of the line joining $(${x1},\\ ${y1})$ and $(${x2},\\ ${y2})$.`,
        answerType: 'numeric', ...exact(m),
        traps: traps(m.value, [
          { value: frac(x2 - x1, y2 - y1).value, why: 'The slope is rise over run: the difference in $y$ goes on top.' },
          { value: frac(y1 - y2, x2 - x1).value, why: 'Both differences must be taken in the same order — either $(x_2,y_2)$ minus $(x_1,y_1)$ throughout, or the other way round throughout.' },
          // Offered only when the two x-coordinates do not cancel; a "slope"
          // built from sums has no meaning at all when its denominator is zero.
          ...(x1 + x2 !== 0 ? [{ value: frac(y2 + y1, x2 + x1).value, why: 'A slope is built from differences, not sums.' }] : [])
        ]),
        hints: [
          'Slope is the change in $y$ divided by the change in $x$.',
          `$m = \\dfrac{y_2 - y_1}{x_2 - x_1} = \\dfrac{${y2} - (${y1})}{${x2} - (${x1})}$.`,
          `That is $\\dfrac{${y2 - y1}}{${x2 - x1}}$ — reduce it.`
        ],
        steps: [
          { h: 'Write the slope formula', d: '$m = \\dfrac{y_2 - y_1}{x_2 - x_1}$' },
          { h: 'Substitute', d: `$= \\dfrac{${y2} - (${y1})}{${x2} - (${x1})} = \\dfrac{${y2 - y1}}{${x2 - x1}}$` },
          { h: 'Reduce', d: `$m = ${fracTex(m.n, m.d)}$` }
        ]
      };
    }
    if (diff === 2) {
      const m = nz(rng, -6, 6);
      const x1 = nz(rng, -8, 8), y1 = nz(rng, -9, 9);
      const c = y1 - m * x1;
      return {
        prompt: `A line of slope $${m}$ passes through $(${x1},\\ ${y1})$. Find its $y$-intercept.`,
        answerType: 'numeric', answer: { value: c }, answerPrefix: 'c =',
        traps: traps(c, [
          { value: y1 + m * x1, why: `The point-slope form is $y - y_1 = m(x - x_1)$, so $c = y_1 - mx_1$ — the product is subtracted.` },
          { value: y1, why: `$${y1}$ is the $y$-coordinate of the given point, which is only the intercept when that point is already on the $y$-axis.` },
          { value: -c, why: 'Check the sign when the equation is rearranged into $y = mx + c$.' }
        ]),
        hints: [
          'Start from the point-slope form $y - y_1 = m(x - x_1)$.',
          `$y - (${y1}) = ${m}(x - (${x1}))$.`,
          'Rearrange into $y = mx + c$ and read off $c$; it is the value of $y$ when $x = 0$.'
        ],
        steps: [
          { h: 'Point-slope form', d: `$y - (${y1}) = ${m}\\left(x - (${x1})\\right)$` },
          { h: 'Expand', d: `$y = ${cx(m)} ${sg(-m * x1)} ${sg(y1)}$` },
          { h: 'Collect into slope-intercept form', d: `$y = ${cx(m)} ${sg(c)}$` },
          { h: 'Read off the intercept', d: `$c = ${c}$` }
        ]
      };
    }
    if (diff === 3) {
      // Both slopes non-zero, different from each other, and not perpendicular:
      // a zero slope or a right angle would leave one of the misconception
      // values below with nothing to divide by, and a distractor that cannot be
      // computed is not a distractor.
      const m1 = nz(rng, -5, 5);
      let m2 = nz(rng, -5, 5);
      let guard = 30;
      while (guard-- > 0 && (m2 === m1 || 1 + m1 * m2 === 0)) m2 = nz(rng, -5, 5);
      if (m2 === m1 || 1 + m1 * m2 === 0) m2 = m1 === 3 ? 2 : 3;
      const t = frac(Math.abs(m1 - m2), Math.abs(1 + m1 * m2));
      return {
        prompt: `Find $\\tan\\theta$, where $\\theta$ is the acute angle between the lines $y = ${cx(m1)}$ and $y = ${cx(m2)}$.`,
        answerType: 'numeric', ...exact(t),
        traps: traps(t.value, [
          { value: Math.abs(m1 - m2), why: `$\\tan\\theta = \\left|\\dfrac{m_1 - m_2}{1 + m_1m_2}\\right|$ — the difference of the slopes is only the numerator, and $1 + m_1m_2 = ${1 + m1 * m2}$ still divides it.` },
          { value: frac(Math.abs(m1 - m2), Math.abs(m1 * m2)).value, why: 'The denominator is $1 + m_1m_2$, not $m_1m_2$ — the $1$ is part of the formula.' },
          { value: frac(Math.abs(1 + m1 * m2), Math.abs(m1 - m2)).value, why: 'The fraction is inverted; that would give $\\cot\\theta$.' }
        ]),
        hints: [
          'The angle between two lines comes from their slopes.',
          '$\\tan\\theta = \\left|\\dfrac{m_1 - m_2}{1 + m_1m_2}\\right|$ for the acute angle.',
          `$m_1 = ${m1}$, $m_2 = ${m2}$, so $1 + m_1m_2 = ${1 + m1 * m2}$.`
        ],
        steps: [
          { h: 'Read off the slopes', d: `$m_1 = ${m1}$, $m_2 = ${m2}$` },
          { h: 'Write the angle formula', d: '$\\tan\\theta = \\left|\\dfrac{m_1 - m_2}{1 + m_1m_2}\\right|$' },
          { h: 'Substitute', d: `$= \\left|\\dfrac{${m1} - (${m2})}{1 + (${m1})(${m2})}\\right| = \\left|\\dfrac{${m1 - m2}}{${1 + m1 * m2}}\\right|$` },
          { h: 'Evaluate', d: `$\\tan\\theta = ${fracTex(t.n, t.d)}$` }
        ]
      };
    }
    // D4 — the distance of a point from a line.
    const [A0, B0, R] = rc(rng, TRIPLES);
    const A = rng() < 0.5 ? A0 : -A0;
    const B = rng() < 0.5 ? B0 : -B0;
    const C = nz(rng, -12, 12);
    const x0 = nz(rng, -7, 7), y0 = nz(rng, -7, 7);
    const signed = A * x0 + B * y0 + C;
    if (signed === 0) return indiaClass11['c11-straight-lines'](rng, 1);
    const dist = frac(Math.abs(signed), R);
    return {
      prompt: `Find the perpendicular distance of the point $(${x0},\\ ${y0})$ from the line $${cx(A)} ${sg(B)}y ${sg(C)} = 0$.`,
      answerType: 'numeric', ...exact(dist, 'units'),
      traps: traps(dist.value, [
        { value: signed, why: `$Ax_0 + By_0 + C = ${signed}$ is the numerator before the modulus and before dividing by $\\sqrt{A^2+B^2} = ${R}$.` },
        { value: frac(Math.abs(signed), Math.abs(A) + Math.abs(B)).value, why: `The denominator is $\\sqrt{A^2+B^2} = \\sqrt{${A * A} + ${B * B}} = ${R}$, not $|A| + |B|$.` },
        { value: frac(Math.abs(signed), A * A + B * B).value, why: `$A^2 + B^2 = ${A * A + B * B}$ still needs its square root taken.` }
      ]),
      hints: [
        'The distance from $(x_0,y_0)$ to $Ax + By + C = 0$ is $\\dfrac{|Ax_0 + By_0 + C|}{\\sqrt{A^2+B^2}}$.',
        `$A = ${A}$, $B = ${B}$, $C = ${C}$, so $\\sqrt{A^2+B^2} = \\sqrt{${A * A + B * B}} = ${R}$.`,
        `$Ax_0 + By_0 + C = ${signed}$.`
      ],
      steps: [
        { h: 'Write the distance formula', d: '$d = \\dfrac{|Ax_0 + By_0 + C|}{\\sqrt{A^2+B^2}}$' },
        { h: 'Evaluate the numerator', d: `$|(${A})(${x0}) + (${B})(${y0}) ${sg(C)}| = ${Math.abs(signed)}$` },
        { h: 'Evaluate the denominator', d: `$\\sqrt{${A * A} + ${B * B}} = ${R}$` },
        { h: 'Divide', d: `$d = ${fracTex(dist.n, dist.d)}$ units` }
      ]
    };
  },

  // ── Class 11 · Limits and Derivatives ────────────────────────────────────
  // In NCERT's order: an algebraic limit, then the standard trigonometric
  // limit, then the derivative FROM FIRST PRINCIPLES, then the product and
  // quotient rules. The chain rule is deliberately absent — the 2026–27 CBSE
  // syllabus lists "Derivatives of composite functions (Chain rule)" among the
  // formative-only topics for Class XI, and a chapter that opens with it is an
  // NSW chapter wearing an NCERT title.
  'c11-limits-derivatives': (rng, diff) => {
    if (diff === 1) {
      const a = nz(rng, -6, 6);
      const n = ri(rng, 2, 5);
      const want = n * Math.pow(a, n - 1);
      return {
        prompt: `Evaluate $\\displaystyle\\lim_{x \\to ${a}} \\dfrac{x^{${n}} - ${par(a)}^{${n}}}{x - ${par(a)}}$.`,
        answerType: 'numeric', answer: { value: want },
        traps: traps(want, [
          { value: Math.pow(a, n - 1), why: `The standard limit is $\\displaystyle\\lim_{x\\to a}\\dfrac{x^n - a^n}{x-a} = na^{\\,n-1}$ — the factor of $n = ${n}$ is part of it.` },
          { value: Math.pow(a, n), why: `$a^n = ${Math.pow(a, n)}$ is what the numerator subtracts, not the value of the limit.` },
          { value: 0, why: 'Both numerator and denominator tend to zero, so the quotient is indeterminate rather than zero — factorise before substituting.' }
        ]),
        hints: [
          'Substituting directly gives $\\dfrac{0}{0}$, so the expression has to be simplified first.',
          '$x^n - a^n$ always has $x - a$ as a factor.',
          `The standard result is $\\displaystyle\\lim_{x\\to a}\\dfrac{x^n - a^n}{x-a} = na^{\\,n-1}$, with $n = ${n}$ and $a = ${a}$.`
        ],
        steps: [
          { h: 'Test by substitution', d: `Both parts vanish at $x = ${a}$, so the form is $\\dfrac{0}{0}$` },
          { h: 'Use the standard algebraic limit', d: '$\\displaystyle\\lim_{x\\to a}\\dfrac{x^n - a^n}{x - a} = na^{\\,n-1}$' },
          { h: 'Substitute', d: `$= ${n} \\times (${a})^{${n - 1}} = ${n} \\times ${Math.pow(a, n - 1)}$` },
          { h: 'Evaluate', d: `$= ${want}$` }
        ]
      };
    }
    if (diff === 2) {
      const p = ri(rng, 2, 9), q = ri(rng, 2, 9);
      const useTan = rng() < 0.5;
      const want = frac(p, q);
      return {
        prompt: `Evaluate $\\displaystyle\\lim_{x \\to 0} \\dfrac{\\${useTan ? 'tan' : 'sin'} ${p}x}{${q}x}$.`,
        answerType: 'numeric', ...exact(want),
        traps: traps(want.value, [
          { value: 1, why: `The standard limit is $\\displaystyle\\lim_{\\theta\\to 0}\\dfrac{\\${useTan ? 'tan' : 'sin'}\\theta}{\\theta} = 1$, and it needs the *same* multiple of $x$ above and below. Here they are $${p}x$ and $${q}x$.` },
          { value: frac(q, p).value, why: `Writing $\\dfrac{\\${useTan ? 'tan' : 'sin'} ${p}x}{${q}x} = \\dfrac{${p}}{${q}} \\cdot \\dfrac{\\${useTan ? 'tan' : 'sin'} ${p}x}{${p}x}$ puts $${p}$ on top.` },
          { value: 0, why: 'Numerator and denominator both tend to zero; the ratio does not.' }
        ]),
        hints: [
          `$\\displaystyle\\lim_{\\theta \\to 0}\\dfrac{\\${useTan ? 'tan' : 'sin'}\\theta}{\\theta} = 1$.`,
          `Make the angle and the denominator match: multiply and divide by $${p}$.`,
          `$\\dfrac{\\${useTan ? 'tan' : 'sin'} ${p}x}{${q}x} = \\dfrac{${p}}{${q}} \\times \\dfrac{\\${useTan ? 'tan' : 'sin'} ${p}x}{${p}x}$.`
        ],
        steps: [
          { h: 'Match the angle to the denominator', d: `$\\dfrac{\\${useTan ? 'tan' : 'sin'} ${p}x}{${q}x} = \\dfrac{${p}}{${q}} \\times \\dfrac{\\${useTan ? 'tan' : 'sin'} ${p}x}{${p}x}$` },
          { h: 'Apply the standard limit', d: `$\\displaystyle\\lim_{x\\to 0}\\dfrac{\\${useTan ? 'tan' : 'sin'} ${p}x}{${p}x} = 1$` },
          { h: 'Answer', d: `$= ${fracTex(want.n, want.d)}$` }
        ]
      };
    }
    if (diff === 3) {
      const a = nz(rng, -5, 5), b = nz(rng, -9, 9), c = nz(rng, -9, 9);
      const p = nz(rng, -5, 5);
      const want = 2 * a * p + b;
      return {
        prompt: `Let $f(x) = ${cx(a)}^2 ${sg(b)}x ${sg(c)}$. Using the definition $f'(x) = \\displaystyle\\lim_{h\\to 0}\\dfrac{f(x+h) - f(x)}{h}$, find $f'(${p})$.`,
        answerType: 'numeric', answer: { value: want },
        traps: traps(want, [
          { value: a * p * p + b * p + c, why: `That is $f(${p})$, the value of the function. The derivative is the limit of the difference quotient, not the function itself.` },
          { value: a * p + b, why: `Differentiating $${cx(a)}^2$ brings the power down as a factor: it gives $${2 * a}x$, not $${a}x$.` },
          { value: 2 * a * p + b + c, why: 'The constant term disappears when the difference $f(x+h) - f(x)$ is taken, so it cannot survive into $f\'$.' }
        ]),
        hints: [
          `Write out $f(x+h) = ${a}(x+h)^2 ${sg(b)}(x+h) ${sg(c)}$ and subtract $f(x)$.`,
          `The constant cancels and every surviving term has a factor of $h$: $f(x+h) - f(x) = h\\left(${2 * a}x ${sg(b)} ${a === 1 ? '' : a === -1 ? '-' : a}h\\right)$.`,
          `Divide by $h$, let $h \\to 0$, then substitute $x = ${p}$.`
        ],
        steps: [
          { h: 'Form f(x+h)', d: `$f(x+h) = ${a}(x+h)^2 ${sg(b)}(x+h) ${sg(c)}$` },
          { h: 'Subtract f(x)', d: `$f(x+h) - f(x) = ${2 * a}xh ${a === 1 ? '+' : a === -1 ? '-' : `+ ${a}`}h^2 ${sg(b)}h$` },
          { h: 'Divide by h', d: `$\\dfrac{f(x+h)-f(x)}{h} = ${2 * a}x ${a === 1 ? '+' : a === -1 ? '-' : `+ ${a}`}h ${sg(b)}$` },
          { h: 'Let h → 0', d: `$f'(x) = ${2 * a}x ${sg(b)}$` },
          { h: 'Substitute', d: `$f'(${p}) = ${2 * a} \\times (${p}) ${sg(b)} = ${want}$` }
        ]
      };
    }
    // D4 — the product and quotient rules, which is where the chapter ends.
    const a = nz(rng, -5, 5), b = nz(rng, -8, 8);
    const c = nz(rng, -5, 5), d = nz(rng, -8, 8);
    const p = nz(rng, -5, 5);
    const useQuotient = rng() < 0.5 && c * p + d !== 0;
    const u = a * p + b, v = c * p + d;
    if (useQuotient) {
      const want = frac(a * v - c * u, v * v);
      return {
        prompt: `Let $f(x) = \\dfrac{${cx(a)} ${sg(b)}}{${cx(c)} ${sg(d)}}$. Find $f'(${p})$.`,
        answerType: 'numeric', ...exact(want),
        traps: traps(want.value, [
          { value: frac(a, c).value, why: 'A quotient does not differentiate term by term — $\\dfrac{u}{v}$ has derivative $\\dfrac{u\'v - uv\'}{v^2}$, not $\\dfrac{u\'}{v\'}$.' },
          { value: frac(c * u - a * v, v * v).value, why: 'The numerator of the quotient rule is $u\'v - uv\'$ in that order; swapping the two terms flips the sign.' },
          { value: frac(a * v - c * u, v).value, why: `The denominator of the quotient rule is $v^2 = ${v * v}$, not $v$.` }
        ]),
        hints: [
          `Take $u = ${cx(a)} ${sg(b)}$ and $v = ${cx(c)} ${sg(d)}$, so $u' = ${a}$ and $v' = ${c}$.`,
          '$\\left(\\dfrac{u}{v}\\right)\' = \\dfrac{u\'v - uv\'}{v^2}$.',
          `At $x = ${p}$: $u = ${u}$ and $v = ${v}$.`
        ],
        steps: [
          { h: 'Name the parts', d: `$u = ${cx(a)} ${sg(b)}$, $v = ${cx(c)} ${sg(d)}$, so $u' = ${a}$, $v' = ${c}$` },
          { h: 'Write the quotient rule', d: '$f\'(x) = \\dfrac{u\'v - uv\'}{v^2}$' },
          { h: 'Evaluate the parts at the point', d: `$u(${p}) = ${u}$, $v(${p}) = ${v}$` },
          { h: 'Substitute', d: `$f'(${p}) = \\dfrac{(${a})(${v}) - (${u})(${c})}{${v}^2} = \\dfrac{${a * v - c * u}}{${v * v}}$` },
          { h: 'Reduce', d: `$= ${fracTex(want.n, want.d)}$` }
        ]
      };
    }
    const want = a * v + c * u;
    return {
      prompt: `Let $f(x) = (${cx(a)} ${sg(b)})(${cx(c)} ${sg(d)})$. Use the product rule to find $f'(${p})$.`,
      answerType: 'numeric', answer: { value: want },
      traps: traps(want, [
        { value: a * c, why: 'A product does not differentiate factor by factor. The product rule is $(uv)\' = u\'v + uv\'$, and both terms survive.' },
        { value: a * v, why: 'That is only the first term $u\'v$; the second term $uv\'$ has to be added.' },
        { value: u * v, why: `That is $f(${p})$ itself, not its derivative.` }
      ]),
      hints: [
        `Take $u = ${cx(a)} ${sg(b)}$ and $v = ${cx(c)} ${sg(d)}$, so $u' = ${a}$ and $v' = ${c}$.`,
        '$(uv)\' = u\'v + uv\'$.',
        `At $x = ${p}$: $u = ${u}$ and $v = ${v}$.`
      ],
      steps: [
        { h: 'Name the factors', d: `$u = ${cx(a)} ${sg(b)}$, $v = ${cx(c)} ${sg(d)}$, so $u' = ${a}$, $v' = ${c}$` },
        { h: 'Write the product rule', d: '$f\'(x) = u\'v + uv\'$' },
        { h: 'Evaluate the parts at the point', d: `$u(${p}) = ${u}$, $v(${p}) = ${v}$` },
        { h: 'Substitute', d: `$f'(${p}) = (${a})(${v}) + (${u})(${c}) = ${want}$` }
      ]
    };
  },

  // ── Class 11 · Probability ───────────────────────────────────────────────
  // The axiomatic chapter: sample spaces and events first, then 'not', 'and'
  // and 'or' — which is the addition rule and the complement, and is all the
  // current syllabus asks of Class 11.
  'c11-probability': (rng, diff) => {
    if (diff === 1) {
      // `added` is what the experiment's stage counts come to when they are
      // added instead of multiplied, and `stages` is how many stages there are:
      // the two mistakes this question is set to catch.
      const forms = [
        { text: 'a coin is tossed three times', n: 8, added: 6, stages: 3, how: '$2 \\times 2 \\times 2$ — two faces on each of three tosses' },
        { text: 'a coin is tossed four times', n: 16, added: 8, stages: 4, how: '$2 \\times 2 \\times 2 \\times 2$ — two faces on each of four tosses' },
        { text: 'two dice are thrown together', n: 36, added: 12, stages: 2, how: '$6 \\times 6$ — six faces on each die' },
        { text: 'a coin is tossed and a die is thrown', n: 12, added: 8, stages: 2, how: '$2 \\times 6$ — two faces, then six' },
        { text: 'a die is thrown twice', n: 36, added: 12, stages: 2, how: '$6 \\times 6$ — six faces on each throw' },
        { text: 'three coins are tossed together', n: 8, added: 6, stages: 3, how: '$2 \\times 2 \\times 2$ — two faces on each of three coins' },
        { text: 'two coins are tossed and a die is thrown', n: 24, added: 10, stages: 3, how: '$2 \\times 2 \\times 6$ — two faces, two faces, then six' },
        { text: 'a die is thrown three times', n: 216, added: 18, stages: 3, how: '$6 \\times 6 \\times 6$ — six faces on each of three throws' },
        { text: 'a coin is tossed five times', n: 32, added: 10, stages: 5, how: '$2 \\times 2 \\times 2 \\times 2 \\times 2$ — two faces on each of five tosses' },
        { text: 'one card is drawn from a deck and then a coin is tossed', n: 104, added: 54, stages: 2, how: '$52 \\times 2$ — fifty-two cards, then two faces' },
        { text: 'a coin is tossed twice', n: 4, added: 4, stages: 2, how: '$2 \\times 2$ — two faces on each toss' },
        { text: 'two dice are thrown and a coin is tossed', n: 72, added: 14, stages: 3, how: '$6 \\times 6 \\times 2$ — six faces, six faces, then two' }
      ];
      const f = rc(rng, forms);
      return {
        prompt: `In a random experiment ${f.text}. How many outcomes are there in the sample space?`,
        answerType: 'numeric', answer: { value: f.n },
        traps: traps(f.n, [
          { value: f.added, why: `The stages are combined by multiplying, not adding: the sample space is ${f.how}.` },
          { value: f.stages, why: 'That counts the stages of the experiment, not the outcomes they produce between them.' },
          { value: 1, why: 'The sample space lists every possible outcome, not one of them.' }
        ]),
        hints: [
          'The sample space is the set of all possible outcomes of the experiment.',
          'Each stage of the experiment multiplies the number of outcomes.',
          `Here that is ${f.how}.`
        ],
        steps: [
          { h: 'Describe the experiment in stages', d: f.text[0].toUpperCase() + f.text.slice(1) },
          { h: 'Multiply the outcomes of each stage', d: f.how },
          { h: 'Answer', d: `$n(S) = ${f.n}$` }
        ]
      };
    }
    if (diff === 2) {
      const sum = ri(rng, 3, 11);
      const ways = 6 - Math.abs(7 - sum);
      const events = [
        { text: `the sum of the two numbers is $${sum}$`, n: ways },
        { text: 'both dice show the same number', n: 6 },
        { text: 'the sum of the two numbers is at most $4$', n: 6 },
        { text: 'at least one die shows a six', n: 11 },
        { text: 'the two numbers differ by exactly $1$', n: 10 }
      ];
      const e = rc(rng, events);
      return {
        prompt: `Two dice are thrown together. The event $E$ is that ${e.text}. How many outcomes does $E$ contain?`,
        answerType: 'numeric', answer: { value: e.n },
        traps: traps(e.n, [
          { value: 36 - e.n, why: 'That counts the outcomes in the complement $E\'$ — the ones where the event does *not* happen.' },
          { value: 36, why: 'That is the whole sample space. An event is a subset of it.' },
          { value: Math.max(1, Math.round(e.n / 2)), why: 'The dice are distinguishable, so $(a,\\ b)$ and $(b,\\ a)$ are different outcomes and both belong to the event.' }
        ]),
        hints: [
          'Write the sample space as ordered pairs $(a,\\ b)$ — the first die, then the second.',
          'There are $36$ of them, all equally likely.',
          'Go through them and keep the ones the description picks out.'
        ],
        steps: [
          { h: 'Describe the sample space', d: '$S$ is the $36$ ordered pairs $(a,\\ b)$ with $a,\\ b \\in \\{1,\\dots,6\\}$' },
          { h: 'Select the outcomes in E', d: `Keep the pairs for which ${e.text}` },
          { h: 'Count them', d: `$n(E) = ${e.n}$` }
        ]
      };
    }
    if (diff === 3) {
      const n = rc(rng, [12, 15, 18, 20, 24, 30]);
      const a = ri(rng, 4, n - 6);
      const b = ri(rng, 4, n - 6);
      const both = ri(rng, 1, Math.min(a, b) - 1);
      const either = a + b - both;
      if (either > n) return indiaClass11['c11-probability'](rng, 2);
      const want = frac(either, n);
      return {
        prompt: `A card is drawn at random from $${n}$ cards numbered $1$ to $${n}$. The event $A$ has $${a}$ favourable outcomes, the event $B$ has $${b}$, and $${both}$ outcomes belong to both. Find $P(A \\text{ or } B)$.`,
        answerType: 'numeric', ...exact(want),
        traps: traps(want.value, [
          { value: frac(a + b, n).value, why: `Adding $P(A)$ and $P(B)$ counts the $${both}$ outcomes in both events twice. The addition rule subtracts $P(A \\cap B)$ once to correct it.` },
          { value: frac(both, n).value, why: 'That is $P(A \\text{ and } B)$ — the outcomes in both events, not in either.' },
          { value: frac(a + b + both, n).value, why: 'The overlap is subtracted, not added: $P(A \\cup B) = P(A) + P(B) - P(A \\cap B)$.' }
        ]),
        hints: [
          'The events overlap, so they are not mutually exclusive.',
          '$P(A \\cup B) = P(A) + P(B) - P(A \\cap B)$.',
          `$\\dfrac{${a}}{${n}} + \\dfrac{${b}}{${n}} - \\dfrac{${both}}{${n}}$.`
        ],
        steps: [
          { h: 'The addition rule', d: '$P(A \\cup B) = P(A) + P(B) - P(A \\cap B)$' },
          { h: 'Substitute', d: `$= \\dfrac{${a}}{${n}} + \\dfrac{${b}}{${n}} - \\dfrac{${both}}{${n}}$` },
          { h: 'Combine', d: `$= \\dfrac{${a} + ${b} - ${both}}{${n}} = \\dfrac{${either}}{${n}}$` },
          { h: 'Reduce', d: `$P(A \\cup B) = ${fracTex(want.n, want.d)}$` }
        ]
      };
    }
    // D4 — 'not' applied to an 'or': the complement of a union.
    const total = rc(rng, [40, 45, 50, 60, 75, 80]);
    const cricket = ri(rng, 12, Math.floor(total / 2));
    const kabaddi = ri(rng, 10, Math.floor(total / 2));
    const both = ri(rng, 2, Math.min(cricket, kabaddi) - 1);
    const either = cricket + kabaddi - both;
    if (either >= total) return indiaClass11['c11-probability'](rng, 3);
    const want = frac(total - either, total);
    const festival = rc(rng, IN_FESTIVALS);
    return {
      prompt: `At a school sports meet held after ${festival}, $${total}$ students take part. Of them $${cricket}$ play cricket, $${kabaddi}$ play kabaddi and $${both}$ play both. One student is chosen at random. Find the probability that the student plays neither game.`,
      answerType: 'numeric', ...exact(want),
      traps: traps(want.value, [
        { value: frac(either, total).value, why: 'That is the probability the student plays at least one of the games. "Neither" is the complement of that event.' },
        { value: frac(total - cricket - kabaddi, total).value, why: `Subtracting both totals removes the $${both}$ students who play both games twice; the addition rule adds them back once.` },
        { value: frac(both, total).value, why: 'That is the probability the student plays both games.' }
      ]),
      hints: [
        'First find the probability that the student plays at least one game.',
        `$n(C \\cup K) = ${cricket} + ${kabaddi} - ${both} = ${either}$, by the addition rule.`,
        '"Neither" is the complement: $P(\\text{neither}) = 1 - P(C \\cup K)$.'
      ],
      steps: [
        { h: 'Apply the addition rule', d: `$n(C \\cup K) = ${cricket} + ${kabaddi} - ${both} = ${either}$` },
        { h: 'Write the probability of the union', d: `$P(C \\cup K) = \\dfrac{${either}}{${total}}$` },
        { h: 'Take the complement', d: `$P(\\text{neither}) = 1 - \\dfrac{${either}}{${total}} = \\dfrac{${total - either}}{${total}}$` },
        { h: 'Reduce', d: `$= ${fracTex(want.n, want.d)}$` }
      ]
    };
  }
};
