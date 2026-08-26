// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Indian curriculum — Class 11/12 algebra
//
// The five chapters in this bank are the ones the NSW syllabus never had, so
// nothing in the existing 84 generators could be pointed at them: Sets, Linear
// Inequalities, Binomial Theorem, Matrices and Determinants. Between them they
// carry a large share of JEE Main's algebra section, and until now a student
// selecting any of them got nothing back.
//
// Same contract as every other bank: (rng, diff) → a question payload whose own
// keyed answer passes the real marker, at all four difficulties.
// ─────────────────────────────────────────────────────────────────────────────
import { ri, rc, rs, nz, mcq, gcd } from '../qhelpers.js';

const fact = n => (n <= 1 ? 1 : n * fact(n - 1));
const nCr = (n, r) => (r < 0 || r > n ? 0 : Math.round(fact(n) / (fact(r) * fact(n - r))));

/** A 2×2 matrix in KaTeX. */
const M2 = (a, b, c, d) => `\\begin{pmatrix} ${a} & ${b} \\\\ ${c} & ${d} \\end{pmatrix}`;
/** A 3×3 determinant in KaTeX. */
const D3 = m => `\\begin{vmatrix} ${m[0][0]} & ${m[0][1]} & ${m[0][2]} \\\\ ${m[1][0]} & ${m[1][1]} & ${m[1][2]} \\\\ ${m[2][0]} & ${m[2][1]} & ${m[2][2]} \\end{vmatrix}`;

const det2 = (a, b, c, d) => a * d - b * c;
const det3 = m =>
  m[0][0] * det2(m[1][1], m[1][2], m[2][1], m[2][2])
  - m[0][1] * det2(m[1][0], m[1][2], m[2][0], m[2][2])
  + m[0][2] * det2(m[1][0], m[1][1], m[2][0], m[2][1]);

/**
 * An exact fraction in KaTeX. Solving a modulus inequality lands on thirds and
 * sevenths far more often than on integers, and writing 1.3333333333333333 into
 * a worked step is both wrong-looking and caught by the well-formedness
 * inspection — the bound is exact, so it is shown exactly.
 */
function fracTex(n, d) {
  if (d < 0) { n = -n; d = -d; }
  const g = gcd(Math.abs(n), d) || 1;
  const p2 = n / g, q2 = d / g;
  if (q2 === 1) return String(p2);
  return p2 < 0 ? `-\\dfrac{${-p2}}{${q2}}` : `\\dfrac{${p2}}{${q2}}`;
}

/** A power, written the way it is read: x rather than x^{1}. */
const pw = (base, e) => (e === 1 ? base : `${base}^{${e}}`);

/** A set written the way NCERT writes it. */
const setTex = xs => `\\{${xs.join(', ')}\\}`;

/** Distinct integers drawn from a range, sorted. */
function pick(rng, lo, hi, n) {
  const pool = [];
  for (let v = lo; v <= hi; v++) pool.push(v);
  return rs(rng, pool).slice(0, n).sort((a, b) => a - b);
}

export const indiaAlgebra = {

  // ── Class 11 · Sets ───────────────────────────────────────────────────────
  'c11-sets': (rng, diff) => {
    if (diff === 1) {
      const A = pick(rng, 1, 12, ri(rng, 4, 5));
      const B = pick(rng, 1, 12, ri(rng, 4, 5));
      const union = [...new Set([...A, ...B])].sort((a, b) => a - b);
      const inter = A.filter(x => B.includes(x));
      const askUnion = rng() < 0.5 && union.length <= 8;
      const want = askUnion ? union : inter;
      if (!want.length) return indiaAlgebra['c11-sets'](rng, 2);
      return {
        prompt: `Let $A = ${setTex(A)}$ and $B = ${setTex(B)}$. Write down $A ${askUnion ? '\\cup' : '\\cap'} B$.`,
        answerType: 'set', answer: { values: want },
        hints: [
          askUnion ? 'The union holds every element that is in A, in B, or in both.' : 'The intersection holds only the elements that appear in both lists.',
          askUnion ? 'Write out A, then add anything from B that is not already there.' : 'Go through A one element at a time and keep it only if B has it too.',
          'List each element once, in increasing order.'
        ],
        steps: [
          { h: 'Read both sets', d: `$A = ${setTex(A)}$, $B = ${setTex(B)}$` },
          { h: askUnion ? 'Take everything in either' : 'Keep only what is in both', d: `$A ${askUnion ? '\\cup' : '\\cap'} B = ${setTex(want)}$` },
          { h: 'No repeats', d: 'An element belongs to a set once, however many of the original sets it came from.' }
        ]
      };
    }
    if (diff === 2) {
      const nA = ri(rng, 12, 30), nB = ri(rng, 10, 28);
      const nBoth = ri(rng, 3, Math.min(nA, nB) - 2);
      const nUnion = nA + nB - nBoth;
      return {
        prompt: `In a class, $n(A) = ${nA}$, $n(B) = ${nB}$ and $n(A \\cap B) = ${nBoth}$. Find $n(A \\cup B)$.`,
        answerType: 'numeric', answer: { value: nUnion },
        traps: [{ value: nA + nB, why: `Adding $${nA}$ and $${nB}$ counts the $${nBoth}$ in both sets twice — subtract the overlap once.` }],
        hints: [
          'Adding the two totals counts the overlap twice.',
          '$n(A \\cup B) = n(A) + n(B) - n(A \\cap B)$.',
          `$${nA} + ${nB} - ${nBoth}$.`
        ],
        steps: [
          { h: 'The addition rule for sets', d: '$n(A \\cup B) = n(A) + n(B) - n(A \\cap B)$' },
          { h: 'Substitute', d: `$= ${nA} + ${nB} - ${nBoth}$` },
          { h: 'Evaluate', d: `$= ${nUnion}$` }
        ]
      };
    }
    if (diff === 3) {
      const a = ri(rng, 18, 30), b = ri(rng, 16, 28), c = ri(rng, 14, 26);
      const ab = ri(rng, 5, 12), bc = ri(rng, 4, 11), ca = ri(rng, 4, 11);
      const abc = ri(rng, 1, Math.min(ab, bc, ca));
      const total = a + b + c - ab - bc - ca + abc;
      return {
        prompt: `In a survey, $n(A) = ${a}$, $n(B) = ${b}$, $n(C) = ${c}$, $n(A \\cap B) = ${ab}$, $n(B \\cap C) = ${bc}$, $n(A \\cap C) = ${ca}$ and $n(A \\cap B \\cap C) = ${abc}$. How many people are in at least one of the three sets?`,
        answerType: 'numeric', answer: { value: total },
        traps: [
          { value: a + b + c, why: 'That counts everyone in two sets twice and everyone in three sets three times.' },
          { value: a + b + c - ab - bc - ca, why: `Subtracting all three pairs removes the $${abc}$ in all three sets one time too many — add them back.` }
        ],
        hints: [
          'Inclusion–exclusion: add the singles, subtract the pairs, add the triple back.',
          '$n(A \\cup B \\cup C) = \\Sigma n(A) - \\Sigma n(A \\cap B) + n(A \\cap B \\cap C)$.',
          `$${a} + ${b} + ${c} - ${ab} - ${bc} - ${ca} + ${abc}$.`
        ],
        steps: [
          { h: 'Inclusion–exclusion for three sets', d: '$n(A \\cup B \\cup C) = n(A) + n(B) + n(C) - n(A \\cap B) - n(B \\cap C) - n(A \\cap C) + n(A \\cap B \\cap C)$' },
          { h: 'Substitute', d: `$= ${a} + ${b} + ${c} - ${ab} - ${bc} - ${ca} + ${abc}$` },
          { h: 'Evaluate', d: `$= ${total}$` }
        ]
      };
    }
    // D4 — subsets and power sets
    const n = ri(rng, 4, 7);
    const branch = ri(rng, 0, 1);
    if (branch === 0) {
      const k = ri(rng, 2, n - 1);
      const want = nCr(n, k);
      return {
        prompt: `A set $S$ has $${n}$ elements. How many subsets of $S$ contain exactly $${k}$ elements?`,
        answerType: 'numeric', answer: { value: want },
        traps: [
          { value: Math.pow(2, n), why: `$2^{${n}}$ counts *every* subset, not only those of size $${k}$.` },
          { value: Math.round(fact(n) / fact(n - k)), why: 'That counts ordered selections. A subset has no order, so divide by $k!$.' }
        ],
        hints: [
          'A subset is a selection, not an arrangement — order does not matter.',
          `The number of $${k}$-element subsets of an $${n}$-element set is $\\binom{${n}}{${k}}$.`,
          `$\\binom{${n}}{${k}} = \\dfrac{${n}!}{${k}!\\,${n - k}!}$.`
        ],
        steps: [
          { h: 'Subsets are selections', d: `Choosing $${k}$ elements from $${n}$ with no regard to order is $\\binom{${n}}{${k}}$` },
          { h: 'Expand', d: `$\\binom{${n}}{${k}} = \\dfrac{${n}!}{${k}!\\,${n - k}!}$` },
          { h: 'Evaluate', d: `$= ${want}$` }
        ]
      };
    }
    const proper = Math.pow(2, n) - 1;
    return {
      prompt: `A set has $${n}$ elements. How many proper subsets does it have?`,
      answerType: 'numeric', answer: { value: proper },
      traps: [{ value: Math.pow(2, n), why: 'That is every subset. A proper subset excludes the set itself, so take one away.' }],
      hints: [
        'Every element is either in a subset or out of it.',
        `That gives $2^{${n}}$ subsets in all.`,
        'A proper subset is any subset except the whole set.'
      ],
      steps: [
        { h: 'Count all subsets', d: `Each of the $${n}$ elements is in or out, so there are $2^{${n}} = ${Math.pow(2, n)}$ subsets` },
        { h: 'Exclude the set itself', d: 'A proper subset is not allowed to be the whole set' },
        { h: 'Answer', d: `$2^{${n}} - 1 = ${proper}$` }
      ]
    };
  },

  // ── Class 11 · Linear Inequalities ────────────────────────────────────────
  'c11-linear-inequalities': (rng, diff) => {
    if (diff === 1) {
      const a = ri(rng, 2, 9), b = nz(rng, -12, 12), k = a * ri(rng, 2, 9) + b;
      const bound = (k - b) / a;
      const dir = rc(rng, ['>', '<']);
      const m = mcq(rng, `$x ${dir} ${bound}$`, [
        { text: `$x ${dir === '>' ? '<' : '>'} ${bound}$`, why: 'The inequality only reverses when both sides are multiplied or divided by a negative number. Dividing by a positive leaves it alone.' },
        { text: `$x ${dir} ${k - b}$`, why: `After moving the $${Math.abs(b)}$ you still have to divide both sides by $${a}$.` },
        { text: `$x ${dir} ${bound + 1}$`, why: 'Check the arithmetic on the right-hand side.' }
      ]);
      return {
        prompt: `Solve $${a}x ${b >= 0 ? '+' : '-'} ${Math.abs(b)} ${dir} ${k}$.`,
        answerType: 'mcq', answer: { correctIndex: m.correctIndex, optionTraps: m.optionTraps }, mcqOptions: m.options,
        hints: [
          'Treat it exactly like an equation, one step at a time.',
          `Move the $${Math.abs(b)}$ across first, then divide by $${a}$.`,
          `Dividing by $${a}$, a positive number, does not flip the sign.`
        ],
        steps: [
          { h: 'Isolate the x term', d: `$${a}x ${dir} ${k} ${b >= 0 ? '-' : '+'} ${Math.abs(b)} = ${k - b}$` },
          { h: 'Divide by the coefficient', d: `$x ${dir} \\dfrac{${k - b}}{${a}} = ${bound}$` },
          { h: 'The sign stays', d: `$${a} > 0$, so the direction of the inequality is unchanged` }
        ]
      };
    }
    if (diff === 2) {
      const a = -ri(rng, 2, 7), b = nz(rng, -10, 10), k = a * ri(rng, -6, 6) + b;
      const bound = (k - b) / a;
      const dir = rc(rng, ['>', '<']);
      const flipped = dir === '>' ? '<' : '>';
      const m = mcq(rng, `$x ${flipped} ${bound}$`, [
        { text: `$x ${dir} ${bound}$`, why: `Dividing both sides by $${a}$, a negative number, reverses the inequality — this is the single most common slip in the chapter.` },
        { text: `$x ${flipped} ${-bound}$`, why: 'The direction is right but the sign of the boundary is not — check the division.' },
        { text: `$x ${dir} ${k - b}$`, why: `You still have to divide by $${a}$.` }
      ]);
      return {
        prompt: `Solve $${a}x ${b >= 0 ? '+' : '-'} ${Math.abs(b)} ${dir} ${k}$.`,
        answerType: 'mcq', answer: { correctIndex: m.correctIndex, optionTraps: m.optionTraps }, mcqOptions: m.options,
        hints: [
          'Move the constant across first.',
          `Now divide both sides by $${a}$ — and look at its sign before you write the answer.`,
          'Multiplying or dividing an inequality by a negative number reverses it.'
        ],
        steps: [
          { h: 'Isolate the x term', d: `$${a}x ${dir} ${k - b}$` },
          { h: 'Divide by a negative', d: `Dividing by $${a}$ reverses the inequality` },
          { h: 'Solution', d: `$x ${flipped} ${bound}$` }
        ]
      };
    }
    if (diff === 3) {
      const a = ri(rng, 2, 6), lo = ri(rng, -8, 2), hi = lo + ri(rng, 2, 6);
      const b = nz(rng, -9, 9);
      const L = a * lo + b, H = a * hi + b;
      const count = hi - lo + 1;
      return {
        prompt: `How many integers $x$ satisfy $${L} \\le ${a}x ${b >= 0 ? '+' : '-'} ${Math.abs(b)} \\le ${H}$?`,
        answerType: 'numeric', answer: { value: count },
        traps: [{ value: hi - lo, why: `Both endpoints are included, so the count is $${hi} - (${lo}) + 1$, not $${hi} - (${lo})$.` }],
        hints: [
          'Solve the double inequality for x, keeping both ends.',
          `Subtract $${b}$ throughout, then divide throughout by $${a}$.`,
          'Then count the integers from one end to the other, including both.'
        ],
        steps: [
          { h: 'Subtract throughout', d: `$${L - b} \\le ${a}x \\le ${H - b}$` },
          { h: 'Divide throughout', d: `$${lo} \\le x \\le ${hi}$` },
          { h: 'Count inclusively', d: `$${hi} - (${lo}) + 1 = ${count}$ integers` }
        ]
      };
    }
    // D4 — a modulus inequality
    const c = ri(rng, 2, 6), d = nz(rng, -9, 9), r = ri(rng, 3, 12);
    const loTex = fracTex(-r - d, c), hiTex = fracTex(r - d, c);
    const lo = (-r - d) / c, hi = (r - d) / c;
    const loI = Math.ceil(lo), hiI = Math.floor(hi);
    const count = Math.max(0, hiI - loI + 1);
    if (count < 2) return indiaAlgebra['c11-linear-inequalities'](rng, 3);
    return {
      prompt: `How many integers $x$ satisfy $|${c}x ${d >= 0 ? '+' : '-'} ${Math.abs(d)}| < ${r}$?`,
      answerType: 'numeric', answer: { value: count },
      traps: [{ value: count + 2, why: `The inequality is strict, so the endpoints of $-${r} < ${c}x ${d >= 0 ? '+' : '-'} ${Math.abs(d)} < ${r}$ are not included.` }],
      hints: [
        '$|u| < r$ is the same as $-r < u < r$.',
        `So $-${r} < ${c}x ${d >= 0 ? '+' : '-'} ${Math.abs(d)} < ${r}$.`,
        'Solve for x, then count only the integers strictly inside.'
      ],
      steps: [
        { h: 'Unfold the modulus', d: `$-${r} < ${c}x ${d >= 0 ? '+' : '-'} ${Math.abs(d)} < ${r}$` },
        { h: 'Solve throughout', d: `$${loTex} < x < ${hiTex}$` },
        { h: 'Count the integers strictly inside', d: `$x$ runs from $${loI}$ to $${hiI}$ — that is $${count}$ values` }
      ]
    };
  },

  // ── Class 11 · Binomial Theorem ───────────────────────────────────────────
  'c11-binomial-theorem': (rng, diff) => {
    if (diff === 1) {
      const n = ri(rng, 4, 8), k = ri(rng, 1, n - 1), a = nz(rng, -3, 3);
      const coeff = nCr(n, k) * Math.pow(a, k);
      return {
        prompt: `Find the coefficient of $x^{${n - k}}$ in the expansion of $(x ${a >= 0 ? '+' : '-'} ${Math.abs(a)})^{${n}}$.`,
        answerType: 'numeric', answer: { value: coeff },
        traps: [
          { value: nCr(n, k), why: `$\\binom{${n}}{${k}}$ is only part of it — the $${a}$ is raised to the power $${k}$ as well.` },
          { value: nCr(n, k) * Math.abs(Math.pow(a, k)), why: `Watch the sign: $(${a})^{${k}} = ${Math.pow(a, k)}$.` }
        ].filter(t => t.value !== coeff),
        hints: [
          `The general term of $(x + a)^n$ is $\\binom{n}{r} x^{n-r} a^{r}$.`,
          `You want $x^{${n - k}}$, so $n - r = ${n - k}$ and $r = ${k}$.`,
          `The coefficient is $\\binom{${n}}{${k}}(${a})^{${k}}$.`
        ],
        steps: [
          { h: 'General term', d: `$T_{r+1} = \\binom{${n}}{r} x^{${n}-r} (${a})^{r}$` },
          { h: 'Match the power', d: `$${n} - r = ${n - k}$, so $r = ${k}$` },
          { h: 'Evaluate', d: `$\\binom{${n}}{${k}}(${a})^{${k}} = ${nCr(n, k)} \\times ${Math.pow(a, k)} = ${coeff}$` }
        ]
      };
    }
    if (diff === 2) {
      const n = ri(rng, 5, 9), r = ri(rng, 2, n - 2), a = ri(rng, 2, 4);
      const coeff = nCr(n, r) * Math.pow(a, r);
      return {
        prompt: `Find the coefficient of $x^{${n - r}}$ in the expansion of $(x + ${a})^{${n}}$.`,
        answerType: 'numeric', answer: { value: coeff },
        traps: [
          { value: nCr(n, r), why: `The binomial coefficient alone leaves out $${a}^{${r}} = ${Math.pow(a, r)}$.` },
          { value: nCr(n, n - r) * Math.pow(a, n - r), why: `$\\binom{${n}}{${r}}$ and $\\binom{${n}}{${n - r}}$ are equal, but the power of $${a}$ is not — it is $${r}$, not $${n - r}$.` }
        ].filter(t => t.value !== coeff),
        hints: [
          `$T_{r+1} = \\binom{${n}}{r} x^{${n}-r} ${a}^{r}$.`,
          `Set $${n} - r = ${n - r}$.`,
          `So the coefficient is $\\binom{${n}}{${r}} \\times ${a}^{${r}}$.`
        ],
        steps: [
          { h: 'General term', d: `$T_{r+1} = \\binom{${n}}{r} x^{${n}-r} ${a}^{r}$` },
          { h: 'Find r', d: `$${n} - r = ${n - r} \\Rightarrow r = ${r}$` },
          { h: 'Evaluate', d: `$\\binom{${n}}{${r}} \\times ${a}^{${r}} = ${nCr(n, r)} \\times ${Math.pow(a, r)} = ${coeff}$` }
        ]
      };
    }
    if (diff === 3) {
      const n = 2 * ri(rng, 2, 5);           // even, so the middle term is single
      const a = nz(rng, -3, 3);
      const m = n / 2;
      const coeff = nCr(n, m) * Math.pow(a, m);
      return {
        prompt: `Find the coefficient of the middle term in the expansion of $(x ${a >= 0 ? '+' : '-'} ${Math.abs(a)})^{${n}}$.`,
        answerType: 'numeric', answer: { value: coeff },
        traps: [
          { value: nCr(n, m), why: `The middle term is $\\binom{${n}}{${m}} x^{${m}} (${a})^{${m}}$ — the $(${a})^{${m}}$ is part of the coefficient.` },
          { value: nCr(n, m + 1) * Math.pow(a, m + 1), why: `With $n = ${n}$ even there are $${n + 1}$ terms, so the middle one is term $${m + 1}$, meaning $r = ${m}$.` }
        ].filter(t => t.value !== coeff),
        hints: [
          `$(x + a)^{${n}}$ has $${n + 1}$ terms.`,
          `An odd number of terms has a single middle one — term number $${m + 1}$, so $r = ${m}$.`,
          `The coefficient is $\\binom{${n}}{${m}}(${a})^{${m}}$.`
        ],
        steps: [
          { h: 'Count the terms', d: `$(x + a)^{${n}}$ expands to $${n + 1}$ terms` },
          { h: 'Locate the middle', d: `Term $${m + 1}$, which is $r = ${m}$` },
          { h: 'Evaluate', d: `$\\binom{${n}}{${m}}(${a})^{${m}} = ${nCr(n, m)} \\times ${Math.pow(a, m)} = ${coeff}$` }
        ]
      };
    }
    // D4 — the term independent of x, the JEE staple
    const p = ri(rng, 1, 3), q = ri(rng, 1, 3), a = ri(rng, 2, 3);
    // need r with p(n - r) = q r  →  r = pn/(p+q); choose n so r is a whole number
    const mult = (p + q) / gcd(p, q + p);
    const n = (p + q) * ri(rng, 1, Math.max(1, Math.floor(9 / (p + q)))) * (mult >= 1 ? 1 : 1);
    if (n < p + q || n > 12) return indiaAlgebra['c11-binomial-theorem'](rng, 3);
    const r = (p * n) / (p + q);
    if (!Number.isInteger(r) || r < 1 || r > n - 1) return indiaAlgebra['c11-binomial-theorem'](rng, 3);
    const value = nCr(n, r) * Math.pow(a, r);
    return {
      prompt: `Find the term independent of $x$ in the expansion of $\\left(${pw('x', p)} + \\dfrac{${a}}{${pw('x', q)}}\\right)^{${n}}$.`,
      answerType: 'numeric', answer: { value },
      traps: [
        { value: nCr(n, r), why: `The $\\left(\\dfrac{${a}}{x^{${q}}}\\right)^{${r}}$ contributes $${a}^{${r}} = ${Math.pow(a, r)}$ as well as the power of x.` },
        { value: n - r, why: 'That is the value of $r$ or its complement, not the term.' }
      ].filter(t => t.value !== value),
      hints: [
        `$T_{r+1} = \\binom{${n}}{r}\\left(${pw('x', p)}\\right)^{${n}-r}\\left(\\dfrac{${a}}{${pw('x', q)}}\\right)^{r}$.`,
        `Collect the powers of x: $x^{${p}(${n}-r) - ${q}r}$.`,
        `Independent of x means that exponent is zero: $${p}(${n} - r) = ${q}r$.`
      ],
      steps: [
        { h: 'General term', d: `$T_{r+1} = \\binom{${n}}{r} x^{${p}(${n}-r)} \\cdot \\dfrac{${a}^{r}}{x^{${q}r}}$` },
        { h: 'Set the exponent to zero', d: `$${p}(${n} - r) - ${q}r = 0 \\Rightarrow r = ${r}$` },
        { h: 'Evaluate that term', d: `$\\binom{${n}}{${r}} \\times ${a}^{${r}} = ${nCr(n, r)} \\times ${Math.pow(a, r)} = ${value}$` }
      ]
    };
  },

  // ── Class 12 · Matrices ───────────────────────────────────────────────────
  'c12-matrices': (rng, diff) => {
    const A = [nz(rng, -6, 6), nz(rng, -6, 6), nz(rng, -6, 6), nz(rng, -6, 6)];
    const B = [nz(rng, -6, 6), nz(rng, -6, 6), nz(rng, -6, 6), nz(rng, -6, 6)];
    if (diff === 1) {
      const k = nz(rng, -4, 4);
      const pos = ri(rng, 0, 3);
      const NAME = ['a_{11}', 'a_{12}', 'a_{21}', 'a_{22}'][pos];
      const value = A[pos] + k * B[pos];
      return {
        prompt: `Let $A = ${M2(A[0], A[1], A[2], A[3])}$ and $B = ${M2(B[0], B[1], B[2], B[3])}$. Find the entry $${NAME}$ of $A ${k >= 0 ? '+' : '-'} ${Math.abs(k)}B$.`,
        answerType: 'numeric', answer: { value },
        traps: [{ value: A[pos] + B[pos], why: `Every entry of $B$ is multiplied by $${k}$ before it is added.` }].filter(t => t.value !== value),
        hints: [
          'Matrices of the same order are added entry by entry.',
          `A scalar multiplies every entry, so $${k}B$ has entry $${k} \\times ${B[pos]}$ in that position.`,
          `$${A[pos]} + (${k})(${B[pos]})$.`
        ],
        steps: [
          { h: 'Scalar first', d: `The entry of $${k}B$ in that position is $${k} \\times ${B[pos]} = ${k * B[pos]}$` },
          { h: 'Then add entrywise', d: `$${A[pos]} + ${k * B[pos]}$` },
          { h: 'Answer', d: `$= ${value}$` }
        ]
      };
    }
    if (diff === 2) {
      const i = ri(rng, 0, 1), j = ri(rng, 0, 1);
      const value = A[i * 2] * B[j] + A[i * 2 + 1] * B[2 + j];
      return {
        prompt: `Let $A = ${M2(A[0], A[1], A[2], A[3])}$ and $B = ${M2(B[0], B[1], B[2], B[3])}$. Find the entry in row $${i + 1}$, column $${j + 1}$ of $AB$.`,
        answerType: 'numeric', answer: { value },
        traps: [
          { value: A[i * 2 + j] * B[i * 2 + j], why: 'Matrix multiplication is not entrywise — the entry is a row of A dotted with a column of B.' },
          { value: A[j] * B[i * 2] + A[2 + j] * B[i * 2 + 1], why: 'Row of the first matrix with column of the second, in that order — $AB$ is not $BA$.' }
        ].filter(t => t.value !== value),
        hints: [
          `The $(${i + 1},${j + 1})$ entry of $AB$ is row $${i + 1}$ of $A$ against column $${j + 1}$ of $B$.`,
          `Row $${i + 1}$ of $A$ is $(${A[i * 2]},\\ ${A[i * 2 + 1]})$; column $${j + 1}$ of $B$ is $(${B[j]},\\ ${B[2 + j]})$.`,
          `Multiply matching entries and add: $${A[i * 2]}\\times${B[j]} + ${A[i * 2 + 1]}\\times${B[2 + j]}$.`
        ],
        steps: [
          { h: 'Row against column', d: `Row $${i + 1}$ of $A$ is $(${A[i * 2]},\\ ${A[i * 2 + 1]})$, column $${j + 1}$ of $B$ is $(${B[j]},\\ ${B[2 + j]})$` },
          { h: 'Multiply and add', d: `$(${A[i * 2]})(${B[j]}) + (${A[i * 2 + 1]})(${B[2 + j]})$` },
          { h: 'Answer', d: `$= ${value}$` }
        ]
      };
    }
    if (diff === 3) {
      // Symmetric / skew-symmetric: solve for the unknown entry
      const p = nz(rng, -8, 8), q = nz(rng, -8, 8);
      const skew = rng() < 0.5;
      const want = skew ? -p : p;
      return {
        prompt: `The matrix $${M2(q, p, 'x', -q)}$ is ${skew ? 'skew-symmetric' : 'symmetric'}. Find $x$.`,
        answerType: 'numeric', answer: { value: want },
        traps: [{ value: -want, why: skew ? 'Skew-symmetric means $A^{T} = -A$, so the entry below the diagonal is the negative of the one above it.' : 'Symmetric means $A^{T} = A$, so the two off-diagonal entries are equal — not opposite.' }].filter(t => t.value !== want),
        hints: [
          skew ? 'Skew-symmetric means $A^{T} = -A$.' : 'Symmetric means $A^{T} = A$.',
          'Transposing swaps the two off-diagonal entries.',
          skew ? `So $x = -(${p})$.` : `So $x = ${p}$.`
        ],
        steps: [
          { h: 'What the condition says', d: skew ? '$a_{ji} = -a_{ij}$ for every entry' : '$a_{ji} = a_{ij}$ for every entry' },
          { h: 'Apply it off the diagonal', d: `$x = ${skew ? `-(${p})` : p}$` },
          { h: 'Answer', d: `$x = ${want}$` }
        ]
      };
    }
    // D4 — the inverse of a 2×2, one entry of it
    let a = nz(rng, -5, 5), b = nz(rng, -5, 5), c = nz(rng, -5, 5), d = nz(rng, -5, 5);
    let det = det2(a, b, c, d);
    let guard = 0;
    while ((det === 0 || Math.abs(det) > 12 || d % det !== 0) && guard++ < 60) {
      a = nz(rng, -5, 5); b = nz(rng, -5, 5); c = nz(rng, -5, 5); d = nz(rng, -5, 5);
      det = det2(a, b, c, d);
    }
    if (det === 0 || d % det !== 0) return indiaAlgebra['c12-matrices'](rng, 3);
    const value = d / det;
    return {
      prompt: `Let $A = ${M2(a, b, c, d)}$. Find the entry in row $1$, column $1$ of $A^{-1}$.`,
      answerType: 'numeric', answer: { value },
      traps: [
        { value: d, why: `The adjugate puts $${d}$ there, but $A^{-1} = \\dfrac{1}{\\det A}\\,\\mathrm{adj}\\,A$ — it still has to be divided by $\\det A = ${det}$.` },
        { value: a / det, why: 'For a $2\\times2$ the diagonal entries swap in the adjugate — the top-left of the adjugate is $d$, not $a$.' }
      ].filter(t => t.value !== value),
      hints: [
        `For $A = \\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}$, $A^{-1} = \\dfrac{1}{ad - bc}\\begin{pmatrix} d & -b \\\\ -c & a \\end{pmatrix}$.`,
        `Here $\\det A = (${a})(${d}) - (${b})(${c}) = ${det}$.`,
        `The top-left entry of the adjugate is $d = ${d}$.`
      ],
      steps: [
        { h: 'Determinant', d: `$\\det A = (${a})(${d}) - (${b})(${c}) = ${det}$` },
        { h: 'Adjugate swaps the diagonal', d: `$\\mathrm{adj}\\,A = ${M2(d, -b, -c, a)}$` },
        { h: 'Divide by the determinant', d: `$(A^{-1})_{11} = \\dfrac{${d}}{${det}} = ${value}$` }
      ]
    };
  },

  // ── Class 12 · Determinants ───────────────────────────────────────────────
  'c12-determinants': (rng, diff) => {
    if (diff === 1) {
      const a = nz(rng, -9, 9), b = nz(rng, -9, 9), c = nz(rng, -9, 9), d = nz(rng, -9, 9);
      const value = det2(a, b, c, d);
      return {
        prompt: `Evaluate $\\begin{vmatrix} ${a} & ${b} \\\\ ${c} & ${d} \\end{vmatrix}$.`,
        answerType: 'numeric', answer: { value },
        traps: [
          { value: a * d + b * c, why: 'The two products are subtracted, not added.' },
          { value: a * c - b * d, why: 'It is the two diagonals: $ad$ (top-left to bottom-right) minus $bc$.' }
        ].filter(t => t.value !== value),
        hints: [
          'For a $2\\times2$ determinant, multiply the leading diagonal and subtract the other one.',
          `$= (${a})(${d}) - (${b})(${c})$.`,
          `$(${a})(${d}) = ${a * d}$ and $(${b})(${c}) = ${b * c}$.`
        ],
        steps: [
          { h: 'The rule', d: '$\\begin{vmatrix} a & b \\\\ c & d \\end{vmatrix} = ad - bc$' },
          { h: 'Substitute', d: `$= (${a})(${d}) - (${b})(${c}) = ${a * d} - (${b * c})$` },
          { h: 'Answer', d: `$= ${value}$` }
        ]
      };
    }
    if (diff === 2) {
      const m = [
        [nz(rng, -4, 4), nz(rng, -4, 4), nz(rng, -4, 4)],
        [nz(rng, -4, 4), nz(rng, -4, 4), nz(rng, -4, 4)],
        [nz(rng, -4, 4), nz(rng, -4, 4), nz(rng, -4, 4)]
      ];
      const value = det3(m);
      const wrongSign = m[0][0] * det2(m[1][1], m[1][2], m[2][1], m[2][2])
        + m[0][1] * det2(m[1][0], m[1][2], m[2][0], m[2][2])
        + m[0][2] * det2(m[1][0], m[1][1], m[2][0], m[2][1]);
      return {
        prompt: `Evaluate $${D3(m)}$.`,
        answerType: 'numeric', answer: { value },
        traps: [{ value: wrongSign, why: 'The cofactor signs alternate $+\\,-\\,+$ along the top row — the middle term is subtracted.' }].filter(t => t.value !== value),
        hints: [
          'Expand along the first row.',
          'The signs alternate: $+a_{11}M_{11} - a_{12}M_{12} + a_{13}M_{13}$.',
          'Each minor is the $2\\times2$ determinant left after deleting that entry’s row and column.'
        ],
        steps: [
          { h: 'Expand along row 1', d: `$= ${m[0][0]}\\begin{vmatrix} ${m[1][1]} & ${m[1][2]} \\\\ ${m[2][1]} & ${m[2][2]} \\end{vmatrix} - ${m[0][1]}\\begin{vmatrix} ${m[1][0]} & ${m[1][2]} \\\\ ${m[2][0]} & ${m[2][2]} \\end{vmatrix} + ${m[0][2]}\\begin{vmatrix} ${m[1][0]} & ${m[1][1]} \\\\ ${m[2][0]} & ${m[2][1]} \\end{vmatrix}$` },
          { h: 'Evaluate the minors', d: `$= ${m[0][0]}(${det2(m[1][1], m[1][2], m[2][1], m[2][2])}) - ${m[0][1]}(${det2(m[1][0], m[1][2], m[2][0], m[2][2])}) + ${m[0][2]}(${det2(m[1][0], m[1][1], m[2][0], m[2][1])})$` },
          { h: 'Answer', d: `$= ${value}$` }
        ]
      };
    }
    if (diff === 3) {
      // det = 0 solved for x, kept linear so the answer is exact
      const b = nz(rng, -6, 6), c = nz(rng, -6, 6), d = nz(rng, -6, 6);
      const x = nz(rng, -8, 8);
      // | x  b |
      // | c  d |  = xd - bc = 0  →  x = bc/d
      const dd = nz(rng, -6, 6);
      const bb = dd * ri(rng, 1, 4), cc = ri(rng, 2, 5);
      const sol = (bb * cc) / dd;
      if (!Number.isInteger(sol)) return indiaAlgebra['c12-determinants'](rng, 2);
      return {
        prompt: `Find $x$ if $\\begin{vmatrix} x & ${bb} \\\\ ${cc} & ${dd} \\end{vmatrix} = 0$.`,
        answerType: 'numeric', answer: { value: sol },
        traps: [{ value: -sol, why: `Expanding gives $${dd}x - (${bb})(${cc}) = 0$, so $x = \\dfrac{(${bb})(${cc})}{${dd}}$ — check the sign.` }].filter(t => t.value !== sol),
        hints: [
          'Expand the determinant first, then set it equal to zero.',
          `$${dd}x - (${bb})(${cc}) = 0$.`,
          `So $${dd}x = ${bb * cc}$.`
        ],
        steps: [
          { h: 'Expand', d: `$x(${dd}) - (${bb})(${cc}) = ${dd}x - ${bb * cc}$` },
          { h: 'Set to zero', d: `$${dd}x = ${bb * cc}$` },
          { h: 'Solve', d: `$x = ${sol}$` }
        ]
      };
    }
    // D4 — area of a triangle from its vertices, by determinant
    const [x1, y1] = [nz(rng, -7, 7), nz(rng, -7, 7)];
    const [x2, y2] = [nz(rng, -7, 7), nz(rng, -7, 7)];
    const [x3, y3] = [nz(rng, -7, 7), nz(rng, -7, 7)];
    const twice = x1 * (y2 - y3) + x2 * (y3 - y1) + x3 * (y1 - y2);
    if (twice === 0 || Math.abs(twice) % 2 !== 0) {
      const area2 = Math.abs(twice);
      if (area2 === 0) return indiaAlgebra['c12-determinants'](rng, 2);
      return {
        prompt: `Find twice the area of the triangle with vertices $(${x1}, ${y1})$, $(${x2}, ${y2})$ and $(${x3}, ${y3})$.`,
        answerType: 'numeric', answer: { value: area2 },
        traps: [{ value: twice, why: 'The determinant can come out negative depending on the order of the vertices — an area is its absolute value.' }].filter(t => t.value !== area2),
        hints: [
          'Area $= \\dfrac{1}{2}\\begin{vmatrix} x_1 & y_1 & 1 \\\\ x_2 & y_2 & 1 \\\\ x_3 & y_3 & 1 \\end{vmatrix}$, so twice the area is the determinant itself.',
          `Expanding gives $x_1(y_2 - y_3) + x_2(y_3 - y_1) + x_3(y_1 - y_2)$.`,
          'Take the absolute value at the end.'
        ],
        steps: [
          { h: 'The determinant form', d: `$2\\,\\text{Area} = \\left|\\,${D3([[x1, y1, 1], [x2, y2, 1], [x3, y3, 1]])}\\,\\right|$` },
          { h: 'Expand', d: `$= |${x1}(${y2} - ${y3}) + ${x2}(${y3} - ${y1}) + ${x3}(${y1} - ${y2})|$` },
          { h: 'Answer', d: `$= ${area2}$` }
        ]
      };
    }
    const area = Math.abs(twice) / 2;
    return {
      prompt: `Find the area of the triangle with vertices $(${x1}, ${y1})$, $(${x2}, ${y2})$ and $(${x3}, ${y3})$.`,
      answerType: 'numeric', answer: { value: area }, answerSuffix: 'square units',
      traps: [{ value: Math.abs(twice), why: 'That is the determinant — the area is half of it.' }].filter(t => t.value !== area),
      hints: [
        'Area $= \\dfrac{1}{2}\\begin{vmatrix} x_1 & y_1 & 1 \\\\ x_2 & y_2 & 1 \\\\ x_3 & y_3 & 1 \\end{vmatrix}$.',
        `Expanding gives $\\dfrac{1}{2}|x_1(y_2 - y_3) + x_2(y_3 - y_1) + x_3(y_1 - y_2)|$.`,
        `That is $\\dfrac{1}{2}|${twice}|$.`
      ],
      steps: [
        { h: 'The determinant form', d: `$\\text{Area} = \\dfrac{1}{2}\\left|\\,${D3([[x1, y1, 1], [x2, y2, 1], [x3, y3, 1]])}\\,\\right|$` },
        { h: 'Expand', d: `$= \\dfrac{1}{2}|${x1}(${y2} - ${y3}) + ${x2}(${y3} - ${y1}) + ${x3}(${y1} - ${y2})| = \\dfrac{1}{2}|${twice}|$` },
        { h: 'Answer', d: `$= ${area}$ square units` }
      ]
    };
  }
};
