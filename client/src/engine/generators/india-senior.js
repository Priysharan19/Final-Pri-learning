// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Indian curriculum — the Class 11–12 dot points nothing covered
//
// Seven generators for the corners of otherwise well-served senior chapters: the
// means-and-standard-sums end of Sequences and Series, the whole of Class 11
// Statistics, equivalence relations, continuity and the mean value theorems,
// the properties of definite integrals, the cross product, and Bayes' theorem.
//
// Data sets here are constructed so the statistics come out exact — five values
// either side of the mean makes the standard deviation a whole number rather
// than a surd — and every integral, cross product and probability is keyed as an
// integer or an exact fraction.
// ─────────────────────────────────────────────────────────────────────────────
import { ri, rc, nz, Frac, mcq } from '../qhelpers.js';

/** A numeric answer that stays exact. */
function exact(f, suffix) {
  return {
    answer: f.d === 1 ? { value: f.value } : { value: f.value, simplestFraction: { n: f.n, d: f.d } },
    ...(f.d === 1 ? {} : { inputHint: `e.g. ${f.n}/${f.d}` }),
    ...(suffix ? { answerSuffix: suffix } : {})
  };
}

/** (a, b, c, d) with a² + b² + c² = d². */
const QUADS = [[1, 2, 2, 3], [2, 3, 6, 7], [1, 4, 8, 9], [2, 6, 9, 11], [4, 4, 7, 9], [2, 4, 4, 6], [6, 6, 7, 11], [3, 4, 12, 13]];

export const indiaSenior = {

  // ── Class 11 · means and standard sums ───────────────────────────────────
  'c11-sequence-means': (rng, diff) => {
    if (diff === 1) {
      const a = ri(rng, 2, 40), b = ri(rng, 2, 40);
      const am = new Frac(a + b, 2);
      return {
        prompt: `Find the arithmetic mean of $${a}$ and $${b}$.`,
        answerType: 'numeric', ...exact(am),
        traps: [{ value: a + b, why: 'The arithmetic mean is the sum *divided by two* — inserting one term between them makes an arithmetic progression of three.' }].filter(t => t.value !== am.value),
        hints: [
          'The arithmetic mean of two numbers is the number that sits between them in an AP.',
          `$A = \\dfrac{a + b}{2}$.`,
          `$\\dfrac{${a} + ${b}}{2}$.`
        ],
        steps: [
          { h: 'Definition', d: '$A = \\dfrac{a+b}{2}$' },
          { h: 'Substitute', d: `$= \\dfrac{${a + b}}{2}$` },
          { h: 'Answer', d: `$${am.latex()}$` }
        ]
      };
    }
    if (diff === 2) {
      const k = ri(rng, 2, 12), m = ri(rng, 1, 6);
      const a = k * m * m, b = k;   // product = k²m², so GM = km
      const gm = k * m;
      return {
        prompt: `Find the geometric mean of $${a}$ and $${b}$.`,
        answerType: 'numeric', answer: { value: gm },
        traps: [{ value: (a + b) / 2, why: 'That is the *arithmetic* mean. The geometric mean is the square root of the product.' }].filter(t => t.value !== gm),
        hints: [
          'The geometric mean sits between the two in a *geometric* progression.',
          `$G = \\sqrt{ab}$.`,
          `$ab = ${a} \\times ${b} = ${a * b}$.`
        ],
        steps: [
          { h: 'Definition', d: '$G = \\sqrt{ab}$' },
          { h: 'Multiply', d: `$${a} \\times ${b} = ${a * b}$` },
          { h: 'Answer', d: `$\\sqrt{${a * b}} = ${gm}$` }
        ]
      };
    }
    if (diff === 3) {
      const n = ri(rng, 5, 25);
      const askSquares = rng() < 0.5;
      const want = askSquares ? (n * (n + 1) * (2 * n + 1)) / 6 : (n * (n + 1)) / 2;
      return {
        prompt: askSquares
          ? `Find $1^2 + 2^2 + 3^2 + \\dots + ${n}^2$.`
          : `Find $1 + 2 + 3 + \\dots + ${n}$.`,
        answerType: 'numeric', answer: { value: want },
        traps: [{
          value: askSquares ? Math.pow((n * (n + 1)) / 2, 2) : n * (n + 1),
          why: askSquares
            ? `$\\left(\\sum n\\right)^2$ is the formula for $\\sum n^3$, not $\\sum n^2$. Use $\\dfrac{n(n+1)(2n+1)}{6}$.`
            : 'The formula halves the product — $\\dfrac{n(n+1)}{2}$.'
        }].filter(t => t.value !== want),
        hints: [
          'These standard sums have closed forms worth knowing by heart.',
          askSquares ? '$\\sum_{r=1}^{n} r^2 = \\dfrac{n(n+1)(2n+1)}{6}$.' : '$\\sum_{r=1}^{n} r = \\dfrac{n(n+1)}{2}$.',
          `Here $n = ${n}$.`
        ],
        steps: [
          { h: 'The standard sum', d: askSquares ? '$\\dfrac{n(n+1)(2n+1)}{6}$' : '$\\dfrac{n(n+1)}{2}$' },
          { h: 'Substitute', d: askSquares ? `$\\dfrac{${n} \\times ${n + 1} \\times ${2 * n + 1}}{6}$` : `$\\dfrac{${n} \\times ${n + 1}}{2}$` },
          { h: 'Answer', d: `$${want}$` }
        ]
      };
    }
    // D4 — the harmonic mean, and G² = AH
    const p = ri(rng, 2, 12), q = ri(rng, 2, 12);
    const a = p * q, b = p * q;
    const x = 2 * ri(rng, 1, 8), y = 2 * ri(rng, 1, 8);
    const hm = new Frac(2 * x * y, x + y);
    return {
      prompt: `Find the harmonic mean of $${x}$ and $${y}$.`,
      answerType: 'numeric', ...exact(hm),
      traps: [{ value: new Frac(x + y, 2).value, why: 'That is the arithmetic mean. The harmonic mean averages the *reciprocals*: $H = \\dfrac{2ab}{a+b}$.' }].filter(t => t.value !== hm.value),
      hints: [
        'The harmonic mean is the reciprocal of the average of the reciprocals.',
        `$H = \\dfrac{2ab}{a+b}$.`,
        `$\\dfrac{2 \\times ${x} \\times ${y}}{${x} + ${y}}$.`
      ],
      steps: [
        { h: 'Definition', d: '$\\dfrac{1}{H} = \\dfrac{1}{2}\\left(\\dfrac{1}{a} + \\dfrac{1}{b}\\right)$, so $H = \\dfrac{2ab}{a+b}$' },
        { h: 'Substitute', d: `$\\dfrac{${2 * x * y}}{${x + y}}$` },
        { h: 'Answer', d: `$${hm.latex()}$ — and note $G^2 = AH$ always holds` }
      ]
    };
  },

  // ── Class 11 · Statistics: mean deviation, variance, coefficient of variation
  // Data is built as five values below the mean and five above, so the standard
  // deviation is a whole number instead of a surd.
  'c11-statistics': (rng, diff) => {
    const m = rc(rng, [20, 25, 30, 40, 50, 60, 80, 100]);
    const k = rc(rng, [2, 4, 5, 6, 8, 10]);
    const data = [...Array(5).fill(m - k), ...Array(5).fill(m + k)];
    if (diff === 1) {
      const small = [m - 2 * k, m - k, m, m + k, m + 2 * k];
      const md = new Frac(2 * k + k + 0 + k + 2 * k, 5);
      return {
        prompt: `Find the mean deviation about the mean for the data $${small.join(',\\ ')}$.`,
        answerType: 'numeric', ...exact(md),
        traps: [{ value: 0, why: 'The signed deviations always add to zero — that is why the mean deviation takes their *absolute* values first.' }],
        hints: [
          `The mean of these five values is $${m}$.`,
          'Find each deviation from the mean, then take absolute values.',
          `$\\dfrac{\\sum |x_i - \\bar{x}|}{n} = \\dfrac{${2 * k} + ${k} + 0 + ${k} + ${2 * k}}{5}$.`
        ],
        steps: [
          { h: 'Mean', d: `$\\bar{x} = ${m}$` },
          { h: 'Absolute deviations', d: `$${2 * k},\\ ${k},\\ 0,\\ ${k},\\ ${2 * k}$` },
          { h: 'Answer', d: `$\\dfrac{${6 * k}}{5} = ${md.latex()}$` }
        ]
      };
    }
    if (diff === 2) {
      const variance = k * k;
      return {
        prompt: `A data set of ten values consists of five values equal to $${m - k}$ and five equal to $${m + k}$. Find its variance.`,
        answerType: 'numeric', answer: { value: variance },
        traps: [{ value: k, why: `$${k}$ is the standard *deviation*; the variance is its square.` }].filter(t => t.value !== variance),
        hints: [
          `The mean is halfway between, at $${m}$.`,
          `Every value is $${k}$ away from it, so every squared deviation is $${k}^2$.`,
          `$\\sigma^2 = \\dfrac{\\sum (x_i - \\bar{x})^2}{n}$.`
        ],
        steps: [
          { h: 'Mean', d: `$\\bar{x} = ${m}$` },
          { h: 'Every squared deviation', d: `$(\\pm ${k})^2 = ${k * k}$, ten times over` },
          { h: 'Answer', d: `$\\sigma^2 = \\dfrac{10 \\times ${k * k}}{10} = ${variance}$` }
        ]
      };
    }
    if (diff === 3) {
      return {
        prompt: `A data set of ten values consists of five values equal to $${m - k}$ and five equal to $${m + k}$. Find its standard deviation.`,
        answerType: 'numeric', answer: { value: k },
        traps: [{ value: k * k, why: 'That is the variance. The standard deviation is its square root, which puts it back in the units of the data.' }].filter(t => t.value !== k),
        hints: [
          `The mean is $${m}$ and every value is $${k}$ from it.`,
          `So the variance is $${k}^2 = ${k * k}$.`,
          'The standard deviation is the square root of the variance.'
        ],
        steps: [
          { h: 'Variance', d: `$\\sigma^2 = ${k * k}$` },
          { h: 'Take the root', d: `$\\sigma = \\sqrt{${k * k}}$` },
          { h: 'Answer', d: `$\\sigma = ${k}$` }
        ]
      };
    }
    // D4 — coefficient of variation
    const cv = new Frac(100 * k, m);
    return {
      prompt: `A data set has mean $${m}$ and standard deviation $${k}$. Find its coefficient of variation, as a percentage.`,
      answerType: 'numeric', ...exact(cv, '%'),
      traps: [{ value: new Frac(100 * m, k).value, why: `The coefficient of variation is $\\dfrac{\\sigma}{\\bar{x}} \\times 100$ — the standard deviation goes on top.` }].filter(t => t.value !== cv.value),
      hints: [
        'The coefficient of variation expresses the spread as a percentage of the mean.',
        `$\\text{CV} = \\dfrac{\\sigma}{\\bar{x}} \\times 100$.`,
        `$\\dfrac{${k}}{${m}} \\times 100$.`
      ],
      steps: [
        { h: 'Definition', d: `$\\text{CV} = \\dfrac{\\sigma}{\\bar{x}} \\times 100$` },
        { h: 'Substitute', d: `$\\dfrac{${k}}{${m}} \\times 100$` },
        { h: 'Answer', d: `$${cv.latex()}\\%$ — it has no units, which is what lets two different data sets be compared` }
      ]
    };
  },

  // ── Class 12 · equivalence relations ─────────────────────────────────────
  'c12-relations-equivalence': (rng, diff) => {
    if (diff === 1) {
      const m = mcq(rng, 'Reflexive, symmetric and transitive', [
        { text: 'Reflexive and symmetric only', why: 'Transitivity is the third requirement — without it the relation does not partition the set into classes.' },
        { text: 'Symmetric and transitive only', why: 'Reflexivity is required too: every element must be related to itself.' },
        { text: 'One-one and onto', why: 'Those describe a *function*, not a relation on a set.' }
      ]);
      return {
        prompt: 'Which three properties must a relation have to be an equivalence relation?',
        answerType: 'mcq', answer: { correctIndex: m.correctIndex, optionTraps: m.optionTraps }, mcqOptions: m.options,
        hints: [
          'An equivalence relation behaves like "is the same as" in some respect.',
          'Everything is the same as itself, and sameness works both ways.',
          'And it carries along a chain.'
        ],
        steps: [
          { h: 'Reflexive', d: '$aRa$ for every $a$' },
          { h: 'Symmetric', d: '$aRb \\Rightarrow bRa$' },
          { h: 'Transitive', d: '$aRb$ and $bRc \\Rightarrow aRc$' }
        ]
      };
    }
    if (diff === 2) {
      const kind = ri(rng, 0, 2);
      const rel = ['$a < b$ on the integers', '$a \\ne b$ on the integers', '$a$ divides $b$ on the positive integers'][kind];
      const fails = ['Reflexivity — no number is less than itself', 'Reflexivity — no number differs from itself, and transitivity also fails', 'Symmetry — 2 divides 4 but 4 does not divide 2'][kind];
      const answer = ['Reflexivity', 'Reflexivity', 'Symmetry'][kind];
      const m = mcq(rng, answer, [
        { text: answer === 'Reflexivity' ? 'Symmetry' : 'Reflexivity', why: fails },
        { text: 'Transitivity', why: kind === 2 ? 'Divisibility *is* transitive: if a divides b and b divides c then a divides c.' : fails },
        { text: 'None — it is an equivalence relation', why: fails }
      ]);
      return {
        prompt: `Which property does the relation ${rel} fail?`,
        answerType: 'mcq', answer: { correctIndex: m.correctIndex, optionTraps: m.optionTraps }, mcqOptions: m.options,
        hints: [
          'Test the three properties one at a time.',
          'Reflexive: is every element related to itself?',
          'Symmetric: does $aRb$ always force $bRa$?'
        ],
        steps: [
          { h: 'Check reflexivity', d: kind === 2 ? 'Every number divides itself ✓' : 'Fails — an element is not related to itself' },
          { h: 'Check symmetry', d: kind === 2 ? 'Fails — 2 divides 4, but 4 does not divide 2' : 'Not the first failure' },
          { h: 'Answer', d: fails }
        ]
      };
    }
    if (diff === 3) {
      const n = ri(rng, 2, 4);
      const count = Math.pow(2, n * n - n);
      return {
        prompt: `How many reflexive relations are there on a set with $${n}$ elements?`,
        answerType: 'numeric', answer: { value: count },
        traps: [{ value: Math.pow(2, n * n), why: `$2^{n^2}$ counts *all* relations. A reflexive one has the $${n}$ diagonal pairs forced, leaving $${n * n} - ${n} = ${n * n - n}$ free choices.` }].filter(t => t.value !== count),
        hints: [
          `A relation on a set of $${n}$ elements is any subset of the $${n * n}$ ordered pairs.`,
          `Reflexivity forces the $${n}$ pairs $(a, a)$ to be present.`,
          `The remaining $${n * n - n}$ pairs are each free to be in or out.`
        ],
        steps: [
          { h: 'Count the pairs', d: `$${n}^2 = ${n * n}$ ordered pairs in all` },
          { h: 'Reflexivity fixes the diagonal', d: `$${n}$ pairs forced in, $${n * n - n}$ still free` },
          { h: 'Answer', d: `$2^{${n * n - n}} = ${count}$` }
        ]
      };
    }
    // D4 — equivalence classes of congruence modulo n
    const n = ri(rng, 2, 9);
    return {
      prompt: `On the integers, define $a \\sim b$ when $a - b$ is divisible by $${n}$. This is an equivalence relation. How many equivalence classes does it have?`,
      answerType: 'numeric', answer: { value: n },
      traps: [{ value: n - 1, why: `The possible remainders on division by $${n}$ run from $0$ to $${n - 1}$ — that is $${n}$ values, because $0$ counts.` }].filter(t => t.value !== n),
      hints: [
        'Two integers are related exactly when they leave the same remainder on division by the modulus.',
        `So each class is "the integers with remainder $r$".`,
        `The possible remainders are $0, 1, \\dots, ${n - 1}$.`
      ],
      steps: [
        { h: 'What the relation says', d: `$a \\sim b$ exactly when $a$ and $b$ have the same remainder mod $${n}$` },
        { h: 'One class per remainder', d: `Remainders $0$ to $${n - 1}$` },
        { h: 'Answer', d: `$${n}$ classes` }
      ]
    };
  },

  // ── Class 12 · continuity, and Rolle / mean value ────────────────────────
  'c12-continuity-mvt': (rng, diff) => {
    if (diff === 1) {
      const a = nz(rng, 2, 6), b = nz(rng, -8, 8), c = nz(rng, -6, 6);
      const k = a * c + b;   // k chosen so the two pieces agree at x = c
      return {
        prompt: `The function $f(x) = ${a}x ${b >= 0 ? '+' : '-'} ${Math.abs(b)}$ for $x \\le ${c}$, and $f(x) = k$ for $x > ${c}$, is continuous at $x = ${c}$. Find $k$.`,
        answerType: 'numeric', answer: { value: k },
        traps: [{ value: a + b, why: `Continuity at $x = ${c}$ needs the two pieces to agree *there*, so substitute $x = ${c}$ — not $x = 1$.` }].filter(t => t.value !== k),
        hints: [
          'Continuity at a point means the two one-sided values agree with the value there.',
          `So the linear piece at $x = ${c}$ must equal $k$.`,
          `$${a}(${c}) ${b >= 0 ? '+' : '-'} ${Math.abs(b)}$.`
        ],
        steps: [
          { h: 'What continuity requires', d: `$\\lim_{x \\to ${c}^-} f(x) = \\lim_{x \\to ${c}^+} f(x) = f(${c})$` },
          { h: 'Evaluate the left piece', d: `$${a}(${c}) ${b >= 0 ? '+' : '-'} ${Math.abs(b)} = ${k}$` },
          { h: 'Answer', d: `$k = ${k}$` }
        ]
      };
    }
    if (diff === 2) {
      const r = nz(rng, 2, 8);
      const value = 2 * r;
      return {
        prompt: `The function $f(x) = \\dfrac{x^2 - ${r * r}}{x - ${r}}$ is undefined at $x = ${r}$. What value must be given to $f(${r})$ to make $f$ continuous there?`,
        answerType: 'numeric', answer: { value },
        traps: [{ value: r * r, why: `Factorising the numerator as $(x - ${r})(x + ${r})$ and cancelling leaves $x + ${r}$, whose value at $x = ${r}$ is $${value}$.` }].filter(t => t.value !== value),
        hints: [
          'Factorise the numerator — it is a difference of two squares.',
          `$\\dfrac{(x - ${r})(x + ${r})}{x - ${r}} = x + ${r}$ for $x \\ne ${r}$.`,
          `Now take the limit as $x \\to ${r}$.`
        ],
        steps: [
          { h: 'Factorise and cancel', d: `$f(x) = x + ${r}$ everywhere except $x = ${r}$` },
          { h: 'Take the limit', d: `$\\lim_{x \\to ${r}} (x + ${r}) = ${value}$` },
          { h: 'Answer', d: `Define $f(${r}) = ${value}$ — the discontinuity is removable` }
        ]
      };
    }
    if (diff === 3) {
      // Rolle on f(x) = (x − p)(x − q): f(p) = f(q) = 0, and c is the midpoint
      const p = nz(rng, -8, 4);
      const q = p + 2 * ri(rng, 1, 6);
      const c = (p + q) / 2;
      return {
        prompt: `Rolle's theorem applies to $f(x) = (x - ${p})(x - ${q})$ on $[${p}, ${q}]$. Find the value of $c$ in $(${p}, ${q})$ with $f'(c) = 0$.`,
        answerType: 'numeric', answer: { value: c },
        traps: [{ value: p, why: `$x = ${p}$ is an endpoint, where $f$ is zero — Rolle promises a point strictly inside where the *derivative* is zero.` }].filter(t => t.value !== c),
        hints: [
          `$f(${p}) = f(${q}) = 0$, so Rolle's theorem applies.`,
          `Expand: $f(x) = x^2 - ${p + q}x + ${p * q}$, so $f'(x) = 2x - ${p + q}$.`,
          'Set the derivative to zero.'
        ],
        steps: [
          { h: 'Check the hypothesis', d: `$f$ is a polynomial, and $f(${p}) = f(${q}) = 0$` },
          { h: 'Differentiate', d: `$f'(x) = 2x - ${p + q}$` },
          { h: 'Answer', d: `$2c = ${p + q}$, so $c = ${c}$ — the midpoint, as it always is for a quadratic` }
        ]
      };
    }
    // D4 — the mean value theorem on a quadratic
    const a = ri(rng, 1, 5);
    const lo = nz(rng, -6, 3);
    const hi = lo + 2 * ri(rng, 1, 5);
    const c = (lo + hi) / 2;
    return {
      prompt: `The mean value theorem applies to $f(x) = ${a === 1 ? '' : a}x^2$ on $[${lo}, ${hi}]$. Find the value of $c$ in $(${lo}, ${hi})$ where $f'(c)$ equals the average rate of change.`,
      answerType: 'numeric', answer: { value: c },
      traps: [{ value: hi, why: `$x = ${hi}$ is an endpoint. The mean value theorem promises a point strictly inside the interval.` }].filter(t => t.value !== c),
      hints: [
        `The average rate of change is $\\dfrac{f(${hi}) - f(${lo})}{${hi} - ${lo}}$.`,
        `$f(x) = ${a}x^2$ gives $f'(x) = ${2 * a}x$.`,
        'Set the two equal and solve for $c$.'
      ],
      steps: [
        { h: 'Average rate of change', d: `$\\dfrac{${a}(${hi})^2 - ${a}(${lo})^2}{${hi} - ${lo}} = ${a}(${hi} + ${lo}) = ${a * (hi + lo)}$` },
        { h: 'Set the derivative equal to it', d: `$${2 * a}c = ${a * (hi + lo)}$` },
        { h: 'Answer', d: `$c = ${c}$ — the midpoint, as it always is for a quadratic` }
      ]
    };
  },

  // ── Class 12 · properties of definite integrals ──────────────────────────
  'c12-integral-properties': (rng, diff) => {
    if (diff === 1) {
      const a = ri(rng, 1, 6);
      const n = rc(rng, [1, 3, 5]);
      const k = nz(rng, 2, 9);
      return {
        prompt: `Evaluate $\\displaystyle\\int_{-${a}}^{${a}} ${k === 1 ? '' : k}x^{${n}}\\,dx$ using the symmetry of the integrand.`,
        answerType: 'numeric', answer: { value: 0 },
        traps: [{ value: (k * (Math.pow(a, n + 1) - Math.pow(-a, n + 1))) / (n + 1), why: `The integrand is odd, so the areas either side of the origin cancel exactly — the answer is $0$ without any antidifferentiation.` }].filter(t => t.value !== 0),
        hints: [
          `Check whether the integrand is odd or even: replace $x$ by $-x$.`,
          `$${k}(-x)^{${n}} = -${k}x^{${n}}$, so the function is **odd**.`,
          '$\\displaystyle\\int_{-a}^{a} f(x)\\,dx = 0$ whenever $f$ is odd.'
        ],
        steps: [
          { h: 'Test the symmetry', d: `$f(-x) = -f(x)$ — the integrand is odd` },
          { h: 'Apply the property', d: '$\\displaystyle\\int_{-a}^{a} (\\text{odd})\\,dx = 0$' },
          { h: 'Answer', d: '$0$' }
        ]
      };
    }
    if (diff === 2) {
      const a = ri(rng, 1, 4);
      const n = rc(rng, [2, 4]);
      const k = ri(rng, 1, 5) * (n + 1);
      const half = (k * Math.pow(a, n + 1)) / (n + 1);
      return {
        prompt: `Evaluate $\\displaystyle\\int_{-${a}}^{${a}} ${k === 1 ? '' : k}x^{${n}}\\,dx$ using the symmetry of the integrand.`,
        answerType: 'numeric', answer: { value: 2 * half },
        traps: [{ value: half, why: `The integrand is even, so the integral is *twice* the half from $0$ to $${a}$ — that half alone is $${half}$.` }].filter(t => t.value !== 2 * half),
        hints: [
          `Replace $x$ by $-x$: $${k}(-x)^{${n}} = ${k}x^{${n}}$, so the function is **even**.`,
          '$\\displaystyle\\int_{-a}^{a} f = 2\\displaystyle\\int_{0}^{a} f$ for an even $f$.',
          `$\\displaystyle\\int_0^{${a}} ${k}x^{${n}}\\,dx = ${half}$.`
        ],
        steps: [
          { h: 'Test the symmetry', d: `$f(-x) = f(x)$ — even` },
          { h: 'Halve the work', d: `$2\\displaystyle\\int_0^{${a}} ${k}x^{${n}}\\,dx = 2\\left[\\dfrac{${k}x^{${n + 1}}}{${n + 1}}\\right]_0^{${a}}$` },
          { h: 'Answer', d: `$2 \\times ${half} = ${2 * half}$` }
        ]
      };
    }
    if (diff === 3) {
      const p = ri(rng, 2, 20), q = ri(rng, 2, 20);
      return {
        prompt: `Given $\\displaystyle\\int_{1}^{4} f(x)\\,dx = ${p}$ and $\\displaystyle\\int_{4}^{9} f(x)\\,dx = ${q}$, find $\\displaystyle\\int_{1}^{9} f(x)\\,dx$.`,
        answerType: 'numeric', answer: { value: p + q },
        traps: [{ value: q - p, why: 'The two intervals join end to end at $x = 4$, so the integrals add — subtraction would be for reversing a limit.' }].filter(t => t.value !== p + q),
        hints: [
          'The two intervals meet at $x = 4$ and do not overlap.',
          '$\\displaystyle\\int_a^b + \\displaystyle\\int_b^c = \\displaystyle\\int_a^c$.',
          `$${p} + ${q}$.`
        ],
        steps: [
          { h: 'Additivity over intervals', d: '$\\displaystyle\\int_1^4 + \\displaystyle\\int_4^9 = \\displaystyle\\int_1^9$' },
          { h: 'Substitute', d: `$${p} + ${q}$` },
          { h: 'Answer', d: `$${p + q}$` }
        ]
      };
    }
    // D4 — reversing the limits
    const v = nz(rng, 2, 30);
    return {
      prompt: `Given $\\displaystyle\\int_{2}^{7} g(x)\\,dx = ${v}$, find $\\displaystyle\\int_{7}^{2} g(x)\\,dx$.`,
      answerType: 'numeric', answer: { value: -v },
      traps: [{ value: v, why: 'Swapping the limits of a definite integral reverses its sign — that is the property being tested.' }],
      hints: [
        'Look at what changed: only the order of the limits.',
        '$\\displaystyle\\int_a^b f = -\\displaystyle\\int_b^a f$.',
        `So the answer is $-(${v})$.`
      ],
      steps: [
        { h: 'The property', d: '$\\displaystyle\\int_a^b f(x)\\,dx = -\\displaystyle\\int_b^a f(x)\\,dx$' },
        { h: 'Apply it', d: `$-(${v})$` },
        { h: 'Answer', d: `$${-v}$` }
      ]
    };
  },

  // ── Class 12 · vectors: magnitude, direction cosines, cross product ───────
  'c12-vector-algebra': (rng, diff) => {
    const [a, b, c, len] = rc(rng, QUADS);
    if (diff === 1) {
      const sx = rng() < 0.5 ? 1 : -1, sy = rng() < 0.5 ? 1 : -1, sz = rng() < 0.5 ? 1 : -1;
      const v = [sx * a, sy * b, sz * c];
      return {
        prompt: `Find the magnitude of the vector $${v[0]}\\hat{i} ${v[1] >= 0 ? '+' : '-'} ${Math.abs(v[1])}\\hat{j} ${v[2] >= 0 ? '+' : '-'} ${Math.abs(v[2])}\\hat{k}$.`,
        answerType: 'numeric', answer: { value: len },
        traps: [{ value: Math.abs(v[0]) + Math.abs(v[1]) + Math.abs(v[2]), why: 'Components do not add along the axes — square them, add, then take the square root.' }].filter(t => t.value !== len),
        hints: [
          'The magnitude is Pythagoras in three dimensions.',
          '$|\\vec{v}| = \\sqrt{x^2 + y^2 + z^2}$.',
          `$${a * a} + ${b * b} + ${c * c} = ${len * len}$.`
        ],
        steps: [
          { h: 'Square each component', d: `$${a * a},\\ ${b * b},\\ ${c * c}$` },
          { h: 'Add', d: `$${len * len}$` },
          { h: 'Answer', d: `$\\sqrt{${len * len}} = ${len}$` }
        ]
      };
    }
    if (diff === 2) {
      const dc = new Frac(a, len);
      return {
        prompt: `Find the direction cosine $l$ (the cosine of the angle with the $x$-axis) of the vector $${a}\\hat{i} + ${b}\\hat{j} + ${c}\\hat{k}$.`,
        answerType: 'numeric', ...exact(dc),
        traps: [{ value: a, why: `A direction cosine is the component *divided by the magnitude*: $\\dfrac{${a}}{${len}}$. It always lies between $-1$ and $1$.` }].filter(t => t.value !== dc.value),
        hints: [
          'Direction cosines are the components of the unit vector.',
          `The magnitude is $\\sqrt{${a * a} + ${b * b} + ${c * c}} = ${len}$.`,
          `$l = \\dfrac{x}{|\\vec{v}|}$.`
        ],
        steps: [
          { h: 'Magnitude', d: `$${len}$` },
          { h: 'Divide the x-component by it', d: `$\\dfrac{${a}}{${len}}$` },
          { h: 'Answer', d: `$l = ${dc.latex()}$ — and $l^2 + m^2 + n^2 = 1$ always` }
        ]
      };
    }
    const u = [nz(rng, -5, 5), nz(rng, -5, 5), nz(rng, -5, 5)];
    const w = [nz(rng, -5, 5), nz(rng, -5, 5), nz(rng, -5, 5)];
    const cross = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]];
    const vec = (v, s = ['\\hat{i}', '\\hat{j}', '\\hat{k}']) =>
      `${v[0]}${s[0]} ${v[1] >= 0 ? '+' : '-'} ${Math.abs(v[1])}${s[1]} ${v[2] >= 0 ? '+' : '-'} ${Math.abs(v[2])}${s[2]}`;
    if (diff === 3) {
      return {
        prompt: `For $\\vec{a} = ${vec(u)}$ and $\\vec{b} = ${vec(w)}$, find the $\\hat{i}$ component of $\\vec{a} \\times \\vec{b}$.`,
        answerType: 'numeric', answer: { value: cross[0] },
        traps: [
          { value: u[0] * w[0], why: 'The cross product is not componentwise multiplication — each component comes from a $2 \\times 2$ determinant of the *other* two components.' },
          { value: -cross[0], why: 'The order matters: $\\vec{a} \\times \\vec{b} = -\\vec{b} \\times \\vec{a}$. Take the rows in the order given.' }
        ].filter(t => t.value !== cross[0]),
        hints: [
          'Set it out as a determinant with $\\hat{i}, \\hat{j}, \\hat{k}$ along the top row.',
          `The $\\hat{i}$ component is $\\begin{vmatrix} ${u[1]} & ${u[2]} \\\\ ${w[1]} & ${w[2]} \\end{vmatrix}$ — the columns under $\\hat{i}$ are deleted.`,
          `$(${u[1]})(${w[2]}) - (${u[2]})(${w[1]})$.`
        ],
        steps: [
          { h: 'Determinant form', d: `$\\vec{a} \\times \\vec{b} = \\begin{vmatrix} \\hat{i} & \\hat{j} & \\hat{k} \\\\ ${u.join(' & ')} \\\\ ${w.join(' & ')} \\end{vmatrix}$` },
          { h: 'Expand along the top row', d: `$\\hat{i}\\left[(${u[1]})(${w[2]}) - (${u[2]})(${w[1]})\\right]$` },
          { h: 'Answer', d: `$${cross[0]}$` }
        ]
      };
    }
    // D4 — a cross product is zero exactly when the vectors are parallel
    const k = ri(rng, 2, 5);
    const par = [u[0] * k, u[1] * k, u[2] * k];
    return {
      prompt: `For $\\vec{a} = ${vec(u)}$ and $\\vec{b} = ${vec(par)}$, find the magnitude of $\\vec{a} \\times \\vec{b}$.`,
      answerType: 'numeric', answer: { value: 0 },
      traps: [{ value: k, why: `$\\vec{b} = ${k}\\vec{a}$, so the two are parallel — the parallelogram they span has no width, and the cross product is the zero vector.` }],
      hints: [
        'Compare the two vectors component by component before calculating anything.',
        `Each component of $\\vec{b}$ is $${k}$ times the matching one of $\\vec{a}$.`,
        '$|\\vec{a} \\times \\vec{b}| = |\\vec{a}||\\vec{b}|\\sin\\theta$, and parallel vectors have $\\theta = 0$.'
      ],
      steps: [
        { h: 'Spot the multiple', d: `$\\vec{b} = ${k}\\vec{a}$, so the vectors are parallel` },
        { h: 'What the cross product measures', d: 'The area of the parallelogram they span — zero when they line up' },
        { h: 'Answer', d: '$0$' }
      ]
    };
  },

  // ── Class 12 · total probability and Bayes ───────────────────────────────
  'c12-probability-bayes': (rng, diff) => {
    const nA = ri(rng, 2, 6), nB = ri(rng, 2, 6);
    const rA = ri(rng, 1, nA), rB = ri(rng, 1, nB);
    const totalA = nA + ri(rng, 1, 5), totalB = nB + ri(rng, 1, 5);
    // Bag I: rA red of totalA;  Bag II: rB red of totalB;  a bag is chosen at random
    const pE = new Frac(rA, totalA).add(new Frac(rB, totalB)).div(new Frac(2, 1));
    if (diff === 1 || diff === 2) {
      return {
        prompt: `Bag I holds $${rA}$ red balls out of $${totalA}$, and Bag II holds $${rB}$ red out of $${totalB}$. A bag is chosen at random and one ball drawn. Find the probability that it is red.`,
        answerType: 'numeric', ...exact(pE),
        traps: [{ value: new Frac(rA + rB, totalA + totalB).value, why: 'Pooling the balls treats every ball as equally likely, but the *bags* are equally likely — a ball in the smaller bag is more likely to be picked.' }].filter(t => t.value !== pE.value),
        hints: [
          'This is the theorem of total probability: split by which bag was chosen.',
          `$P(R) = P(\\text{I})P(R \\mid \\text{I}) + P(\\text{II})P(R \\mid \\text{II})$.`,
          `$= \\dfrac{1}{2} \\times \\dfrac{${rA}}{${totalA}} + \\dfrac{1}{2} \\times \\dfrac{${rB}}{${totalB}}$.`
        ],
        steps: [
          { h: 'Split by the bag', d: `Each bag has probability $\\dfrac{1}{2}$` },
          { h: 'Total probability', d: `$\\dfrac{1}{2}\\left(\\dfrac{${rA}}{${totalA}} + \\dfrac{${rB}}{${totalB}}\\right)$` },
          { h: 'Answer', d: `$${pE.latex()}$` }
        ]
      };
    }
    const post = new Frac(rA, totalA).div(new Frac(2, 1)).div(pE);
    if (diff === 3) {
      return {
        prompt: `Bag I holds $${rA}$ red out of $${totalA}$, and Bag II holds $${rB}$ red out of $${totalB}$. A bag is chosen at random and the ball drawn is red. Find the probability it came from Bag I.`,
        answerType: 'numeric', ...exact(post),
        traps: [{ value: new Frac(rA, totalA).value, why: `$\\dfrac{${rA}}{${totalA}}$ is $P(\\text{red} \\mid \\text{Bag I})$ — the *reverse* conditional. Bayes' theorem turns it around.` }].filter(t => t.value !== post.value),
        hints: [
          "This asks for the probability of the *cause* given the effect — that is Bayes' theorem.",
          `$P(\\text{I} \\mid R) = \\dfrac{P(\\text{I})P(R \\mid \\text{I})}{P(R)}$.`,
          `The denominator is the total probability, $${pE.latex()}$.`
        ],
        steps: [
          { h: 'Total probability first', d: `$P(R) = ${pE.latex()}$` },
          { h: "Bayes' theorem", d: `$P(\\text{I} \\mid R) = \\dfrac{\\frac{1}{2} \\times \\frac{${rA}}{${totalA}}}{${pE.latex()}}$` },
          { h: 'Answer', d: `$${post.latex()}$` }
        ]
      };
    }
    // D4 — a diagnostic test, where the base rate does the surprising work
    const prev = rc(rng, [1, 2, 4, 5]);
    const sens = rc(rng, [90, 95, 98]);
    const spec = rc(rng, [90, 95, 96]);
    const pD = new Frac(prev, 100);
    const pND = new Frac(100 - prev, 100);
    const pPos = pD.mul(new Frac(sens, 100)).add(pND.mul(new Frac(100 - spec, 100)));
    const answer = pD.mul(new Frac(sens, 100)).div(pPos);
    return {
      prompt: `A condition affects $${prev}\\%$ of a population. A test detects it in $${sens}\\%$ of those who have it, and correctly clears $${spec}\\%$ of those who do not. A randomly chosen person tests positive. Find the probability they have the condition.`,
      answerType: 'numeric', ...exact(answer),
      traps: [{ value: new Frac(sens, 100).value, why: `$${sens}\\%$ is $P(\\text{positive} \\mid \\text{condition})$ — the reverse of what is asked. With a rare condition most positives come from the much larger healthy group.` }].filter(t => t.value !== answer.value),
      hints: [
        'Work out the probability of testing positive at all, from both groups.',
        `$P(+) = ${prev}\\% \\times ${sens}\\% + ${100 - prev}\\% \\times ${100 - spec}\\%$.`,
        `Then $P(\\text{condition} \\mid +) = \\dfrac{P(\\text{condition})P(+ \\mid \\text{condition})}{P(+)}$.`
      ],
      steps: [
        { h: 'Total probability of a positive', d: `$${pPos.latex()}$ — true positives plus false positives` },
        { h: "Bayes' theorem", d: `$\\dfrac{${pD.mul(new Frac(sens, 100)).latex()}}{${pPos.latex()}}$` },
        { h: 'Answer', d: `$${answer.latex()}$ — lower than most people expect, because the healthy group is so much larger` }
      ]
    };
  }
};
