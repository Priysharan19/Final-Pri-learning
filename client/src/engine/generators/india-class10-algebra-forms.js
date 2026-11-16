// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · CBSE/NCERT Class X Algebra — additional question forms
//
// Algebra is the heaviest unit of the Class X paper (20 of 80 marks,
// indiaExams.js CBSE_CLASS10_UNITS). The coverage report showed its dot points
// reachable but thin: the nth-term and sum generators wrote three question
// shapes between them, the discriminant and solution-condition generators one
// each, the zero–coefficient relation two. A student practising a chapter saw
// the same sentence again and again with new numbers.
//
// Each generator below adds two further shapes at each of D1, D2 and D3 — the
// CBSE track's rungs — for one dot point, so thirty forms in all. Every shape
// is a standard one of the chapter (nth term from the end, sum of the multiples
// of m between two numbers, k for equal roots, k for no solution, …); none is
// transcribed from a textbook exercise or a past paper, and every number is
// drawn from the seed.
//
// What each item carries besides the question:
//   · steps — the full worked solution, each line computed from the parameters;
//   · blueprint — chapter, dot point, unit, the CBSE question type the item has
//     the shape of, its marks and its rung (a mapping by shape, NOT a claim
//     that CBSE set it);
//   · markScheme — the marks split over the worked steps, method then answer;
//   · provenance — agent-authored, software-checked, never human-reviewed, no
//     examiner review, never a previous-year question.
//
// client/test/india-class10-algebra-forms-check.mjs re-derives every keyed
// answer from the PROMPT TEXT by a second route, checks the steps and mark
// scheme, the provenance flags and reproducibility. That is software checking,
// not a human maths review, and nothing here claims board approval or syllabus
// completeness.
// ─────────────────────────────────────────────────────────────────────────────
import { ri, rc, nz } from '../qhelpers.js';
import { exact, frac, fracTex, traps } from './india-native-helpers.js';

// ── Formatting ───────────────────────────────────────────────────────────────
const sg = k => (k >= 0 ? `+ ${k}` : `- ${Math.abs(k)}`);
/** a·v with the coefficient written the way a textbook does: x, -x, 3x. */
const cv = (a, v) => (a === 1 ? v : a === -1 ? `-${v}` : `${a}${v}`);
/** ax + by, written cleanly. */
const lin2 = (a, b) => `${cv(a, 'x')} ${b < 0 ? '-' : '+'} ${cv(Math.abs(b), 'y')}`;
/** ax^2 + bx + c, written cleanly (a, b, c integers, a ≠ 0). */
function quad(a, b, c, v = 'x') {
  let out = `${cv(a, `${v}^2`)}`;
  if (b) out += ` ${b < 0 ? '-' : '+'} ${cv(Math.abs(b), v)}`;
  if (c) out += ` ${sg(c)}`;
  return out;
}
/** A signed term after another: + k, - 3k, or nothing when the coefficient is 0. */
const sgv = (c, v) => (c === 0 ? '' : `${c < 0 ? '-' : '+'} ${cv(Math.abs(c), v)}`);
/** pk + q, written cleanly: 3k - 5, k, -2k + 1. */
const kTerm = (p, q) => (q ? `${cv(p, 'k')} ${sg(q)}` : cv(p, 'k'));
/** k + p, k - p, or k. */
const kp = p => (p === 0 ? 'k' : `k ${sg(p)}`);
/** The first three terms of an AP, then the ellipsis. */
const apHead = (a, d) => `${a},\\ ${a + d},\\ ${a + 2 * d},\\ \\ldots`;
const ordinal = n => {
  const s = n % 100 >= 11 && n % 100 <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' })[n % 10] || 'th';
  return `${n}^{\\text{${s}}}`;
};

// ── Blueprint, mark scheme and provenance ───────────────────────────────────

const PROVENANCE = Object.freeze({
  authoredBy: 'agent',
  checkedBy: 'software',
  humanReviewed: false,
  examinerReviewed: false,
  previousYearQuestion: false,
  source: 'Original parameterised form written for Pri Learning; not transcribed from a textbook or a past paper.'
});

// The CBSE Class X sections an item has the SHAPE of (indiaExams.js
// cbseSections): Section B 2-mark very short answer, Section C 3-mark short
// answer. A one-answer item is never filed as a 5-mark long answer.
const RUNG = Object.freeze({
  1: Object.freeze({ questionType: 'very-short-answer', section: 'B', marks: 2 }),
  2: Object.freeze({ questionType: 'short-answer', section: 'C', marks: 3 }),
  3: Object.freeze({ questionType: 'short-answer', section: 'C', marks: 3 })
});

/**
 * Marks over the worked steps: the last step is the answer mark (A1); the
 * method marks (M1) go to the steps before it, earliest first, and when there
 * are more method marks than steps the last method step carries the rest.
 */
export function markSchemeFor(steps, marks) {
  const method = steps.slice(0, -1);
  const out = method.map(s => ({ step: s.h, marks: 0, kind: 'method' }));
  let left = marks - 1;
  for (let i = 0; i < out.length && left > 0; i++) { out[i].marks = 1; left -= 1; }
  if (left > 0 && out.length) out[out.length - 1].marks += left;
  out.push({ step: steps[steps.length - 1].h, marks: 1, kind: 'answer' });
  return out.filter(row => row.marks > 0);
}

/**
 * Wrap a form-writer so every item it returns carries its dot point, blueprint
 * mapping, mark scheme and provenance. D4 (JEE rungs) is never claimed by a
 * cover; asked for it, the generator serves its D3 forms.
 */
function bank(id, chapter, dotpoint, forms) {
  return (rng, diff) => {
    const rung = Math.min(3, Math.max(1, Number(diff) || 1));
    const q = rc(rng, forms[rung])(rng);
    const { questionType, section, marks } = RUNG[rung];
    return {
      ...q,
      dotpoint,
      blueprint: { chapter, dotpoint, unit: 'algebra', unitMarks: 20, questionType, section, marks, difficulty: rung, generator: id },
      markScheme: markSchemeFor(q.steps, marks),
      provenance: PROVENANCE
    };
  };
}

// ── Arithmetic progressions · the nth term (dot point 0) ────────────────────

function nthFromEnd(rng) {
  const a = ri(rng, -12, 30), d = nz(rng, -7, 9), n = ri(rng, 12, 30), k = ri(rng, 2, 8);
  const L = a + (n - 1) * d, ans = L - (k - 1) * d;
  return {
    prompt: `Find the $${ordinal(k)}$ term from the end of the arithmetic progression $${apHead(a, d)},\\ ${L}$.`,
    answerType: 'numeric', answer: { value: ans },
    traps: traps(ans, [
      { value: a + (k - 1) * d, why: `That is the ${k}th term from the START. From the end, count back from the last term.` },
      { value: L - k * d, why: `Counting back ${k} steps from the last term lands on the ${k + 1}th term from the end.` }
    ]),
    hints: ['Read the last term and the common difference.', 'Counting from the end is an AP with first term $l$ and common difference $-d$.'],
    steps: [
      { h: 'Read the AP', d: `Last term $l = ${L}$, common difference $d = ${a + d} - (${a}) = ${d}$` },
      { h: 'Reverse the progression', d: `From the end the terms are $l,\\ l-d,\\ l-2d,\\ \\ldots$, so the $${ordinal(k)}$ term from the end is $l-(${k}-1)d$` },
      { h: 'Answer', d: `$${L} - ${k - 1}(${d}) = ${ans}$` }
    ],
    form: 'nth-from-end'
  };
}

function numberOfTerms(rng) {
  const a = ri(rng, -15, 25), d = nz(rng, -6, 8), n = ri(rng, 10, 40);
  const L = a + (n - 1) * d;
  return {
    prompt: `How many terms are there in the arithmetic progression $${apHead(a, d)},\\ ${L}$?`,
    answerType: 'numeric', answer: { value: n },
    traps: traps(n, [
      { value: n - 1, why: 'That counts the steps between the first and last terms; the number of terms is one more.' },
      { value: Math.round(L / d), why: 'Dividing the last term by $d$ ignores the first term.' }
    ]),
    hints: ['Use $a_n = a + (n-1)d$ with $a_n$ equal to the last term.'],
    steps: [
      { h: 'Read the AP', d: `$a = ${a}$, $d = ${d}$, last term $a_n = ${L}$` },
      { h: 'Set up the nth term', d: `$${a} + (n-1)(${d}) = ${L}$, so $(n-1)(${d}) = ${L - a}$` },
      { h: 'Solve', d: `$n - 1 = ${n - 1}$, so $n = ${n}$` }
    ],
    form: 'number-of-terms'
  };
}

function kForThreeTerms(rng) {
  for (let guard = 0; guard < 400; guard++) {
    const k = nz(rng, -6, 9), p = nz(rng, 1, 5), s = nz(rng, 1, 6), q = ri(rng, -9, 9), t = ri(rng, -9, 9);
    const twice = (p + s) * k + q + t;
    if (twice % 2 !== 0 || p === s) continue;
    const r = twice / 2;
    return {
      prompt: `For what value of $k$ are $${kTerm(p, q)}$, $${r}$ and $${kTerm(s, t)}$ three consecutive terms of an arithmetic progression?`,
      answerType: 'numeric', answer: { value: k },
      traps: traps(k, [{ value: r, why: 'That is the middle term itself, not the value of $k$.' }]),
      hints: ['Three terms $a, b, c$ are in AP exactly when $b - a = c - b$, that is $2b = a + c$.'],
      steps: [
        { h: 'Condition for an AP', d: `$2 \\times ${r < 0 ? `(${r})` : r} = (${kTerm(p, q)}) + (${kTerm(s, t)})$` },
        { h: 'Simplify', d: `$${2 * r} = ${cv(p + s, 'k')} ${sg(q + t)}$, so $${cv(p + s, 'k')} = ${2 * r - q - t}$` },
        { h: 'Answer', d: `$k = ${k}$` }
      ],
      form: 'k-three-terms'
    };
  }
  throw new Error('c10-ap-term-forms: no three-term fixture');
}

function termFromTwoTerms(rng) {
  for (let guard = 0; guard < 400; guard++) {
    const a = ri(rng, -20, 30), d = nz(rng, -6, 7);
    const m = ri(rng, 2, 9), n = m + ri(rng, 3, 12), p = ri(rng, 15, 40);
    if (p === m || p === n) continue;
    const Am = a + (m - 1) * d, An = a + (n - 1) * d, Ap = a + (p - 1) * d;
    return {
      prompt: `The $${ordinal(m)}$ term of an arithmetic progression is $${Am}$ and its $${ordinal(n)}$ term is $${An}$. Find its $${ordinal(p)}$ term.`,
      answerType: 'numeric', answer: { value: Ap },
      traps: traps(Ap, [{ value: a + p * d, why: 'The pth term is $a + (p-1)d$, not $a + pd$.' }]),
      hints: ['Write both given terms as $a + (n-1)d$ and subtract to find $d$.'],
      steps: [
        { h: 'Two equations', d: `$a + ${cv(m - 1, 'd')} = ${Am}$ and $a + ${cv(n - 1, 'd')} = ${An}$` },
        { h: 'Common difference', d: `Subtracting, $${cv(n - m, 'd')} = ${An - Am}$, so $d = ${d}$` },
        { h: 'First term', d: `$a = ${Am} - ${m - 1}(${d}) = ${a}$` },
        { h: 'Answer', d: `$a_{${p}} = ${a} + ${p - 1}(${d}) = ${Ap}$` }
      ],
      form: 'term-from-two-terms'
    };
  }
  throw new Error('c10-ap-term-forms: no two-term fixture');
}

function firstNegativeTerm(rng) {
  const d = -ri(rng, 2, 9), a = ri(rng, 20, 160);
  let n = 1; while (a + (n - 1) * d >= 0) n += 1;
  return {
    prompt: `Which term of the arithmetic progression $${apHead(a, d)}$ is its first negative term?`,
    answerType: 'numeric', answer: { value: n },
    traps: traps(n, [
      { value: n - 1, why: `The ${n - 1}th term is $${a + (n - 2) * d}$, which is not negative.` },
      { value: Math.floor(a / -d), why: 'Solve $a + (n-1)d < 0$ for $n$ and take the least whole number that satisfies it.' }
    ]),
    hints: ['Solve $a + (n-1)d < 0$ and take the least whole number $n$ that satisfies it.'],
    steps: [
      { h: 'Read the AP', d: `$a = ${a}$, $d = ${d}$` },
      { h: 'Inequality', d: `$${a} + (n-1)(${d}) < 0 \\iff n - 1 > \\dfrac{${a}}{${-d}}$` },
      { h: 'Least n', d: `$\\dfrac{${a}}{${-d}} = ${(a / -d).toFixed(2).replace(/\.?0+$/, '')}$, so the least whole $n - 1$ is $${n - 1}$; check $a_{${n}} = ${a + (n - 1) * d}$` },
      { h: 'Answer', d: `The $${ordinal(n)}$ term` }
    ],
    form: 'first-negative-term'
  };
}

function zeroTerm(rng) {
  for (let guard = 0; guard < 400; guard++) {
    const p = ri(rng, 8, 30), d = nz(rng, -6, 6), a = -(p - 1) * d;
    const m = ri(rng, 2, 7), n = m + ri(rng, 2, 9);
    if (m === p || n === p) continue;
    const Am = a + (m - 1) * d, An = a + (n - 1) * d;
    return {
      prompt: `The $${ordinal(m)}$ term of an arithmetic progression is $${Am}$ and its $${ordinal(n)}$ term is $${An}$. Which term of the progression is zero?`,
      answerType: 'numeric', answer: { value: p },
      traps: traps(p, [{ value: p - 1, why: 'Solve $a + (n-1)d = 0$ for $n$, not for $n - 1$.' }]),
      hints: ['Find $a$ and $d$ from the two terms, then solve $a + (n-1)d = 0$.'],
      steps: [
        { h: 'Common difference', d: `$${cv(n - m, 'd')} = ${An} - (${Am}) = ${An - Am}$, so $d = ${d}$` },
        { h: 'First term', d: `$a = ${Am} - ${m - 1}(${d}) = ${a}$` },
        { h: 'Zero term', d: `$${a} + (n-1)(${d}) = 0 \\Rightarrow n - 1 = ${p - 1}$` },
        { h: 'Answer', d: `The $${ordinal(p)}$ term is zero` }
      ],
      form: 'zero-term'
    };
  }
  throw new Error('c10-ap-term-forms: no zero-term fixture');
}

// ── Arithmetic progressions · the sum of n terms (dot point 1) ──────────────

function sumFirstLast(rng) {
  for (let guard = 0; guard < 400; guard++) {
    const n = ri(rng, 8, 40), a = ri(rng, -20, 40), l = ri(rng, -20, 160);
    if (l === a || (n * (a + l)) % 2) continue;
    if ((l - a) % (n - 1)) continue;
    const S = (n * (a + l)) / 2;
    return {
      prompt: `An arithmetic progression has $${n}$ terms. Its first term is $${a}$ and its last term is $${l}$. Find the sum of all its terms.`,
      answerType: 'numeric', answer: { value: S },
      traps: traps(S, [{ value: n * (a + l), why: 'The sum is $\\dfrac{n}{2}(a + l)$ — half of $n(a + l)$.' }]),
      hints: ['$S_n = \\dfrac{n}{2}(a + l)$.'],
      steps: [
        { h: 'Formula', d: '$S_n = \\dfrac{n}{2}(a + l)$' },
        { h: 'Substitute', d: `$S_{${n}} = \\dfrac{${n}}{2}(${a} + ${l < 0 ? `(${l})` : l})$` },
        { h: 'Answer', d: `$S_{${n}} = ${S}$` }
      ],
      form: 'sum-first-last'
    };
  }
  throw new Error('c10-ap-sum-forms: no first/last fixture');
}

function sumOfMultiples(rng) {
  const m = ri(rng, 3, 13), n = ri(rng, 10, 40);
  const S = (m * n * (n + 1)) / 2;
  return {
    prompt: `Find the sum of the first $${n}$ positive multiples of $${m}$.`,
    answerType: 'numeric', answer: { value: S },
    traps: traps(S, [{ value: m * n, why: `That is the ${n}th multiple, not the sum of the first ${n}.` }]),
    hints: [`The multiples $${m}, ${2 * m}, ${3 * m}, \\ldots$ form an AP with $a = d = ${m}$.`],
    steps: [
      { h: 'The AP', d: `$a = ${m}$, $d = ${m}$, $n = ${n}$` },
      { h: 'Sum formula', d: `$S_{${n}} = \\dfrac{${n}}{2}\\left(2(${m}) + ${n - 1}(${m})\\right)$` },
      { h: 'Answer', d: `$S_{${n}} = ${S}$` }
    ],
    form: 'sum-of-multiples'
  };
}

function multiplesBetween(rng) {
  for (let guard = 0; guard < 400; guard++) {
    const m = ri(rng, 3, 13), L = ri(rng, 10, 120), U = L + ri(rng, 60, 400);
    if (L % m === 0 || U % m === 0) continue;   // "between" stays unambiguous
    const first = Math.ceil(L / m) * m, last = Math.floor(U / m) * m;
    const n = (last - first) / m + 1;
    if (n < 5) continue;
    const S = (n * (first + last)) / 2;
    return {
      prompt: `Find the sum of all the integers between $${L}$ and $${U}$ that are divisible by $${m}$.`,
      answerType: 'numeric', answer: { value: S },
      traps: traps(S, [{ value: ((n - 1) * (first + last - m)) / 2, why: 'Count the terms with $l = a + (n-1)d$; one multiple has been left out.' }]),
      hints: [`List the first and the last multiple of $${m}$ in the range.`, 'They form an AP with common difference $' + m + '$.'],
      steps: [
        { h: 'First and last multiples', d: `The first multiple of $${m}$ above $${L}$ is $${first}$; the last below $${U}$ is $${last}$` },
        { h: 'Number of terms', d: `$${first} + (n-1)(${m}) = ${last} \\Rightarrow n = ${n}$` },
        { h: 'Sum', d: `$S = \\dfrac{${n}}{2}(${first} + ${last})$` },
        { h: 'Answer', d: `$S = ${S}$` }
      ],
      form: 'multiples-between'
    };
  }
  throw new Error('c10-ap-sum-forms: no multiples fixture');
}

function differenceFromSum(rng) {
  const a = ri(rng, -10, 25), d = nz(rng, -6, 9), n = ri(rng, 6, 25);
  const S = (n * (2 * a + (n - 1) * d)) / 2;
  return {
    prompt: `The sum of the first $${n}$ terms of an arithmetic progression is $${S}$ and its first term is $${a}$. Find its common difference.`,
    answerType: 'numeric', answer: { value: d },
    traps: traps(d, [{ value: (2 * S / n - 2 * a) / n, why: 'The bracket is $2a + (n-1)d$: divide by $n - 1$, not by $n$.' }].filter(t => Number.isFinite(t.value))),
    hints: ['$S_n = \\dfrac{n}{2}\\left(2a + (n-1)d\\right)$; substitute and solve for $d$.'],
    steps: [
      { h: 'Substitute', d: `$${S} = \\dfrac{${n}}{2}\\left(2(${a}) + ${cv(n - 1, 'd')}\\right)$` },
      { h: 'Simplify', d: `$${(2 * S) / n} = ${2 * a} + ${cv(n - 1, 'd')}$, so $${cv(n - 1, 'd')} = ${(2 * S) / n - 2 * a}$` },
      { h: 'Answer', d: `$d = ${d}$` }
    ],
    form: 'difference-from-sum'
  };
}

function termFromSumFormula(rng) {
  const p = nz(rng, -4, 5), q = ri(rng, -9, 9), r = ri(rng, 6, 30);
  const term = p * (2 * r - 1) + q;
  const S = n => p * n * n + q * n;
  return {
    prompt: `The sum of the first $n$ terms of an arithmetic progression is $${quad(p, q, 0, 'n')}$ for every $n$. Find its $${ordinal(r)}$ term.`,
    answerType: 'numeric', answer: { value: term },
    traps: traps(term, [{ value: S(r), why: `That is the sum of the first ${r} terms; the ${r}th term is $S_{${r}} - S_{${r - 1}}$.` }]),
    hints: ['$a_r = S_r - S_{r-1}$.'],
    steps: [
      { h: 'Term from sums', d: `$a_{${r}} = S_{${r}} - S_{${r - 1}}$` },
      { h: 'Two sums', d: `$S_{${r}} = ${S(r)}$ and $S_{${r - 1}} = ${S(r - 1)}$` },
      { h: 'Answer', d: `$a_{${r}} = ${S(r)} - (${S(r - 1)}) = ${term}$` }
    ],
    form: 'term-from-sum-formula'
  };
}

function differenceFromEnds(rng) {
  for (let guard = 0; guard < 400; guard++) {
    const a = ri(rng, -10, 30), d = nz(rng, -5, 8), n = ri(rng, 8, 30);
    const l = a + (n - 1) * d, S = (n * (a + l)) / 2;
    if (!Number.isInteger(S) || a + l === 0) continue;
    return {
      prompt: `The first term of an arithmetic progression is $${a}$, its last term is $${l}$ and the sum of all its terms is $${S}$. Find its common difference.`,
      answerType: 'numeric', answer: { value: d },
      traps: traps(d, [{ value: Math.round((l - a) / n), why: 'There are $n - 1$ steps of $d$ from the first term to the last.' }]),
      hints: ['Find $n$ from $S = \\dfrac{n}{2}(a + l)$ first.', 'Then $l = a + (n-1)d$.'],
      steps: [
        { h: 'Number of terms', d: `$${S} = \\dfrac{n}{2}(${a} + ${l < 0 ? `(${l})` : l})$, so $n = \\dfrac{2 \\times ${S}}{${a + l}} = ${n}$` },
        { h: 'Last term', d: `$${l} = ${a} + ${cv(n - 1, 'd')}$, so $${cv(n - 1, 'd')} = ${l - a}$` },
        { h: 'Answer', d: `$d = ${d}$` }
      ],
      form: 'difference-from-ends'
    };
  }
  throw new Error('c10-ap-sum-forms: no ends fixture');
}

// ── Polynomials · zeroes and coefficients (dot point 1) ─────────────────────

/** ax^2 + bx + c with real zeroes (b^2 >= 4ac) and c != 0. */
function realQuad(rng) {
  for (let guard = 0; guard < 400; guard++) {
    const a = nz(rng, -5, 6), b = nz(rng, -12, 12), c = nz(rng, -12, 12);
    if (b * b - 4 * a * c >= 0) return { a, b, c };
  }
  return { a: 1, b: -5, c: 6 };
}

function sumOrProduct(which) {
  return rng => {
    const { a, b, c } = realQuad(rng);
    const f = which === 'sum' ? frac(-b, a) : frac(c, a);
    const name = which === 'sum' ? 'sum' : 'product';
    return {
      prompt: `Find the ${name} of the zeroes of the quadratic polynomial $p(x) = ${quad(a, b, c)}$.`,
      answerType: 'numeric', ...exact(f),
      traps: traps(f.value, [which === 'sum'
        ? { value: b / a, why: 'The sum of the zeroes is $-\\dfrac{b}{a}$ — mind the sign.' }
        : { value: -c / a, why: 'The product of the zeroes is $\\dfrac{c}{a}$, with no minus sign.' }]),
      hints: [which === 'sum' ? 'Sum of zeroes $= -\\dfrac{b}{a}$.' : 'Product of zeroes $= \\dfrac{c}{a}$.'],
      steps: [
        { h: 'Coefficients', d: `$a = ${a}$, $b = ${b}$, $c = ${c}$` },
        { h: 'Relation', d: which === 'sum' ? `$\\alpha + \\beta = -\\dfrac{b}{a} = -\\dfrac{${b}}{${a}}$` : `$\\alpha\\beta = \\dfrac{c}{a} = \\dfrac{${c}}{${a}}$` },
        { h: 'Answer', d: `$${fracTex(f.n, f.d)}$` }
      ],
      form: `zero-${name}`
    };
  };
}

function sumOfSquares(rng) {
  const { a, b, c } = realQuad(rng);
  const f = frac(b * b - 2 * a * c, a * a);
  return {
    prompt: `If $\\alpha$ and $\\beta$ are the zeroes of $p(x) = ${quad(a, b, c)}$, find the value of $\\alpha^2 + \\beta^2$.`,
    answerType: 'numeric', ...exact(f),
    traps: traps(f.value, [{ value: (b * b) / (a * a), why: '$\\alpha^2 + \\beta^2 = (\\alpha + \\beta)^2 - 2\\alpha\\beta$; the $2\\alpha\\beta$ term was left out.' }]),
    hints: ['$\\alpha^2 + \\beta^2 = (\\alpha + \\beta)^2 - 2\\alpha\\beta$.'],
    steps: [
      { h: 'Sum and product', d: `$\\alpha + \\beta = ${fracTex(-b, a)}$, $\\alpha\\beta = ${fracTex(c, a)}$` },
      { h: 'Identity', d: '$\\alpha^2 + \\beta^2 = (\\alpha + \\beta)^2 - 2\\alpha\\beta$' },
      { h: 'Substitute', d: `$\\left(${fracTex(-b, a)}\\right)^2 - 2\\left(${fracTex(c, a)}\\right)$` },
      { h: 'Answer', d: `$${fracTex(f.n, f.d)}$` }
    ],
    form: 'sum-of-squares'
  };
}

function sumOfReciprocals(rng) {
  const { a, b, c } = realQuad(rng);
  const f = frac(-b, c);
  return {
    prompt: `If $\\alpha$ and $\\beta$ are the zeroes of $p(x) = ${quad(a, b, c)}$, find the value of $\\dfrac{1}{\\alpha} + \\dfrac{1}{\\beta}$.`,
    answerType: 'numeric', ...exact(f),
    traps: traps(f.value, [{ value: -c / b, why: '$\\dfrac{1}{\\alpha} + \\dfrac{1}{\\beta} = \\dfrac{\\alpha + \\beta}{\\alpha\\beta}$ — the fraction is upside down.' }]),
    hints: ['$\\dfrac{1}{\\alpha} + \\dfrac{1}{\\beta} = \\dfrac{\\alpha + \\beta}{\\alpha\\beta}$.'],
    steps: [
      { h: 'Combine', d: '$\\dfrac{1}{\\alpha} + \\dfrac{1}{\\beta} = \\dfrac{\\alpha + \\beta}{\\alpha\\beta}$' },
      { h: 'Sum and product', d: `$\\alpha + \\beta = ${fracTex(-b, a)}$, $\\alpha\\beta = ${fracTex(c, a)}$` },
      { h: 'Answer', d: `$\\dfrac{${fracTex(-b, a)}}{${fracTex(c, a)}} = ${fracTex(f.n, f.d)}$` }
    ],
    form: 'sum-of-reciprocals'
  };
}

function kFromOneZero(rng) {
  const a = nz(rng, -4, 5), b = ri(rng, -10, 10), r = nz(rng, -6, 6);
  const k = -(a * r * r + b * r);
  return {
    prompt: `If $x = ${r}$ is a zero of the polynomial $${quad(a, b, 0)} + k$, find the value of $k$.`,
    answerType: 'numeric', answer: { value: k },
    traps: traps(k, [{ value: a * r * r + b * r, why: 'Setting $p(r) = 0$ gives $k = -(ar^2 + br)$; the sign is lost.' }]),
    hints: ['A zero $r$ makes $p(r) = 0$.'],
    steps: [
      { h: 'Substitute the zero', d: `$p(${r}) = ${a}(${r})^2 ${sg(b)}(${r}) + k = 0$` },
      { h: 'Simplify', d: `$${a * r * r + b * r} + k = 0$` },
      { h: 'Answer', d: `$k = ${k}$` }
    ],
    form: 'k-from-one-zero'
  };
}

function constantFromDifference(rng) {
  for (let guard = 0; guard < 400; guard++) {
    const al = ri(rng, -9, 12), be = ri(rng, -9, 12);
    if (al === be || al + be <= 0) continue;
    const p = al + be, q = al * be, gap = Math.abs(al - be);
    return {
      prompt: `The zeroes of the polynomial $x^2 - ${p}x + q$ differ by $${gap}$. Find the value of $q$.`.replace('- 1x', '- x'),
      answerType: 'numeric', answer: { value: q },
      traps: traps(q, [{ value: (p * p + gap * gap) / 4, why: '$(\\alpha - \\beta)^2 = (\\alpha + \\beta)^2 - 4\\alpha\\beta$: the $4\\alpha\\beta$ is SUBTRACTED.' }]),
      hints: ['$(\\alpha - \\beta)^2 = (\\alpha + \\beta)^2 - 4\\alpha\\beta$.', `Here $\\alpha + \\beta = ${p}$ and $\\alpha\\beta = q$.`],
      steps: [
        { h: 'Sum and product', d: `$\\alpha + \\beta = ${p}$, $\\alpha\\beta = q$` },
        { h: 'Identity', d: `$(\\alpha - \\beta)^2 = (\\alpha + \\beta)^2 - 4\\alpha\\beta \\Rightarrow ${gap * gap} = ${p * p} - 4q$` },
        { h: 'Answer', d: `$4q = ${p * p - gap * gap}$, so $q = ${q}$` }
      ],
      form: 'constant-from-difference'
    };
  }
  throw new Error('c10-zero-coefficient-forms: no difference fixture');
}

// ── Quadratic equations · the discriminant (dot point 2) ────────────────────

function discriminantValue(rng) {
  const a = nz(rng, -5, 6), b = ri(rng, -12, 12), c = nz(rng, -12, 12);
  const D = b * b - 4 * a * c;
  return {
    prompt: `Find the discriminant of the quadratic equation $${quad(a, b, c)} = 0$.`,
    answerType: 'numeric', answer: { value: D },
    traps: traps(D, [{ value: b * b + 4 * a * c, why: '$D = b^2 - 4ac$ — the sign of $4ac$ was flipped.' }, { value: -b * b - 4 * a * c, why: '$b^2$ is never negative: square the whole of $b$.' }]),
    hints: ['$D = b^2 - 4ac$.'],
    steps: [
      { h: 'Coefficients', d: `$a = ${a}$, $b = ${b}$, $c = ${c}$` },
      { h: 'Substitute', d: `$D = (${b})^2 - 4(${a})(${c})$` },
      { h: 'Answer', d: `$D = ${D}$` }
    ],
    form: 'discriminant-value'
  };
}

function middleKEqualRoots(sign) {
  return rng => {
    const a = ri(rng, 1, 4), m = ri(rng, 1, 7), c = m * m * a;   // ac is a perfect square
    const k = sign * 2 * a * m;
    return {
      prompt: `Find the ${sign > 0 ? 'positive' : 'negative'} value of $k$ for which the equation $${cv(a, 'x^2')} + kx + ${c} = 0$ has two equal real roots.`,
      answerType: 'numeric', answer: { value: k },
      traps: traps(k, [{ value: -k, why: `$k^2 = ${k * k}$ has two roots; the question asks for the ${sign > 0 ? 'positive' : 'negative'} one.` }, { value: k * k, why: 'Solve $k^2 = 4ac$ for $k$ — take the square root.' }]),
      hints: ['Equal roots exactly when $D = b^2 - 4ac = 0$.'],
      steps: [
        { h: 'Equal-roots condition', d: `$D = k^2 - 4(${a})(${c}) = 0$` },
        { h: 'Solve for k', d: `$k^2 = ${4 * a * c}$, so $k = \\pm ${Math.abs(k)}$` },
        { h: 'Answer', d: `$k = ${k}$` }
      ],
      form: `middle-k-${sign > 0 ? 'positive' : 'negative'}`
    };
  };
}

function leadingKEqualRoots(rng) {
  const t = ri(rng, 1, 3), u = ri(rng, 1, 4), v = ri(rng, 1, 4);
  const k = t * u * u, c = t * v * v, b = rc(rng, [-1, 1]) * 2 * t * u * v;
  return {
    prompt: `Find the value of $k$ for which the quadratic equation $kx^2 ${b < 0 ? '-' : '+'} ${Math.abs(b)}x + ${c} = 0$ has two equal real roots.`,
    answerType: 'numeric', answer: { value: k },
    traps: traps(k, [{ value: (b * b) / c, why: 'Equal roots need $b^2 = 4kc$: divide $b^2$ by $4c$, not by $c$.' }]),
    hints: ['Equal roots exactly when $b^2 - 4ac = 0$; here $a = k$.'],
    steps: [
      { h: 'Equal-roots condition', d: `$(${b})^2 - 4(k)(${c}) = 0$` },
      { h: 'Simplify', d: `$${b * b} = ${cv(4 * c, 'k')}$` },
      { h: 'Answer', d: `$k = ${k}$ (and $k \\ne 0$, so the equation is quadratic)` }
    ],
    form: 'leading-k-equal-roots'
  };
}

function shiftedKEqualRoots(rng) {
  for (let guard = 0; guard < 400; guard++) {
    const k1 = ri(rng, 1, 9), k2 = ri(rng, -9, 0);
    if ((k1 + k2) % 2 === 0) continue;            // q must be whole
    const q = (1 - k1 - k2) / 2, p = q * q - k1 * k2;
    if (k1 + p === 0 || k2 + p === 0) continue;   // stays quadratic at both roots
    return {
      prompt: `Find the positive value of $k$ for which the equation $(${kp(p)})x^2 - 2(${kp(q)})x + 1 = 0$ has two equal real roots.`,
      answerType: 'numeric', answer: { value: k1 },
      traps: traps(k1, [{ value: k2, why: `$k = ${k2}$ also makes $D = 0$, but the question asks for the positive value.` }]),
      hints: ['Equal roots exactly when $D = 0$.', `$D = 4(${kp(q)})^2 - 4(${kp(p)})$.`],
      steps: [
        { h: 'Discriminant', d: `$D = 4(${kp(q)})^2 - 4(${kp(p)})(1)$` },
        { h: 'Set D = 0', d: `$(${kp(q)})^2 - (${kp(p)}) = 0 \\Rightarrow k^2 ${sgv(2 * q - 1, 'k')} ${sg(q * q - p)} = 0$` },
        { h: 'Factorise', d: `$(k - ${k1})(k ${sg(-k2)}) = 0$, so $k = ${k1}$ or $k = ${k2}$` },
        { h: 'Answer', d: `The positive value is $k = ${k1}$` }
      ].map(s => ({ ...s, d: s.d.replace(/k \+ 0\b/g, 'k').replace(/ \+ 0k/g, '').replace(/ \+ 0 = 0/g, ' = 0') })),
      form: 'shifted-k-equal-roots'
    };
  }
  throw new Error('c10-quadratic-k-forms: no shifted fixture');
}

function leastKNoRealRoots(rng) {
  const b = nz(rng, -15, 15);
  const k = Math.floor((b * b) / 4) + 1;
  return {
    prompt: `Find the least positive integer $k$ for which the equation $x^2 ${b < 0 ? '-' : '+'} ${Math.abs(b)}x + k = 0$ has no real roots.`.replace(/([+-]) 1x/, '$1 x'),
    answerType: 'numeric', answer: { value: k },
    traps: traps(k, [{ value: (b * b) / 4, why: 'At $k = \\dfrac{b^2}{4}$ the roots are equal and real; no real roots needs $D < 0$ strictly.' }].filter(t => Number.isInteger(t.value))),
    hints: ['No real roots exactly when $D = b^2 - 4ac < 0$.'],
    steps: [
      { h: 'Condition', d: `$D = (${b})^2 - 4(1)(k) < 0$` },
      { h: 'Solve', d: `$4k > ${b * b}$, so $k > ${(b * b) / 4}$` },
      { h: 'Answer', d: `The least integer is $k = ${k}$` }
    ],
    form: 'least-k-no-real-roots'
  };
}

// ── Pair of linear equations · conditions on the coefficients (dot point 1) ─

function kNoSolution(rng) {
  for (let guard = 0; guard < 400; guard++) {
    const a = nz(rng, -6, 7), b = nz(rng, -6, 7), c = ri(rng, -12, 12), m = nz(rng, -4, 4);
    if (m === 1) continue;
    const k = m * a, c2 = m * c + nz(rng, -5, 5);
    return {
      prompt: `For what value of $k$ does the pair of linear equations $${lin2(a, b)} = ${c}$ and $kx ${m * b < 0 ? '-' : '+'} ${cv(Math.abs(m * b), 'y')} = ${c2}$ have no solution?`,
      answerType: 'numeric', answer: { value: k },
      traps: traps(k, [{ value: a, why: 'The ratio of the $y$-coefficients is ' + m + ', so the $x$-coefficients must be in the same ratio.' }]),
      hints: ['No solution exactly when $\\dfrac{a_1}{a_2} = \\dfrac{b_1}{b_2} \\ne \\dfrac{c_1}{c_2}$.'],
      steps: [
        { h: 'Condition', d: '$\\dfrac{a_1}{a_2} = \\dfrac{b_1}{b_2} \\ne \\dfrac{c_1}{c_2}$' },
        { h: 'Equate the first two ratios', d: `$\\dfrac{${a}}{k} = \\dfrac{${b}}{${m * b}}$, so $k = ${k}$` },
        { h: 'Check the third ratio', d: `$\\dfrac{${c}}{${c2}} \\ne \\dfrac{1}{${m}}$, so the lines are parallel and distinct` },
        { h: 'Answer', d: `$k = ${k}$` }
      ],
      form: 'k-no-solution'
    };
  }
  throw new Error('c10-linear-condition-forms: no fixture');
}

function kInfinitelyMany(rng) {
  const a = nz(rng, -6, 7), b = nz(rng, -6, 7), c = nz(rng, -12, 12), m = rc(rng, [-3, -2, 2, 3, 4]);
  const k = m * c;
  return {
    prompt: `For what value of $k$ does the pair of linear equations $${lin2(a, b)} = ${c}$ and $${lin2(m * a, m * b)} = k$ have infinitely many solutions?`,
    answerType: 'numeric', answer: { value: k },
    traps: traps(k, [{ value: c, why: `The second equation is ${m} times the first on the left, so the right side must be ${m} times too.` }]),
    hints: ['Infinitely many solutions exactly when $\\dfrac{a_1}{a_2} = \\dfrac{b_1}{b_2} = \\dfrac{c_1}{c_2}$.'],
    steps: [
      { h: 'Condition', d: '$\\dfrac{a_1}{a_2} = \\dfrac{b_1}{b_2} = \\dfrac{c_1}{c_2}$' },
      { h: 'Common ratio', d: `$\\dfrac{${a}}{${m * a}} = \\dfrac{${b}}{${m * b}} = ${fracTex(1, m)}$` },
      { h: 'Answer', d: `$\\dfrac{${c}}{k} = ${fracTex(1, m)}$, so $k = ${k}$` }
    ],
    form: 'k-infinitely-many'
  };
}

/** (k + u)x + (k + v)y = w k + z, built so the pair is m × the first line at k. */
function kBothSides(kind) {
  return rng => {
    for (let guard = 0; guard < 400; guard++) {
      const a = nz(rng, -5, 6), b = nz(rng, -5, 6), c = nz(rng, -9, 9), m = rc(rng, [-2, 2, 3]), k = nz(rng, -7, 8);
      if (a === b) continue;
      const u = m * a - k, v = m * b - k, w = nz(rng, -3, 3);
      const z = m * c - w * k + (kind === 'none' ? nz(rng, -4, 4) : 0);
      if (w * k + z === 0) continue;
      const rhs = `${cv(w, 'k')} ${z ? sg(z) : ''}`.trim();
      return {
        prompt: `Find the value of $k$ for which the pair of linear equations $${lin2(a, b)} = ${c}$ and $(${kp(u)})x + (${kp(v)})y = ${rhs}$ has ${kind === 'none' ? 'no solution' : 'infinitely many solutions'}.`,
        answerType: 'numeric', answer: { value: k },
        traps: [],
        hints: ['Equate $\\dfrac{a_1}{a_2}$ and $\\dfrac{b_1}{b_2}$ to find $k$, then test $\\dfrac{c_1}{c_2}$.'],
        steps: [
          { h: 'First two ratios', d: `$\\dfrac{${a}}{${kp(u)}} = \\dfrac{${b}}{${kp(v)}}$` },
          { h: 'Cross-multiply', d: `$${a}(${kp(v)}) = ${b}(${kp(u)}) \\Rightarrow ${cv(a - b, 'k')} = ${b * u - a * v}$, so $k = ${k}$` },
          { h: 'Third ratio', d: `At $k = ${k}$ the second equation is $${lin2(m * a, m * b)} = ${w * k + z}$; $\\dfrac{c_1}{c_2} = \\dfrac{${c}}{${w * k + z}} ${kind === 'none' ? '\\ne' : '='} ${fracTex(1, m)}$, ${kind === 'none' ? 'so the lines are parallel and distinct' : 'so the two equations describe the same line'}` },
          { h: 'Answer', d: `$k = ${k}$` }
        ].map(s => ({ ...s, d: s.d.replace(/\(k \+ 0\)/g, 'k') })),
        form: kind === 'none' ? 'k-both-sides-none' : 'k-both-sides-infinite'
      };
    }
    throw new Error('c10-linear-condition-forms: no both-sides fixture');
  };
}

function kSquaredNoSolution(rng) {
  for (let guard = 0; guard < 400; guard++) {
    const s = ri(rng, 2, 6), t = rc(rng, [1, 2, 3, 4]);
    const a = t, b = (s * s) / t;                  // ab = s^2
    if (a === b) continue;
    if (!Number.isInteger(b)) continue;
    const kStar = rc(rng, [s, -s]);
    // At -kStar the third ratio is equal (infinitely many), so only kStar gives none.
    const e = nz(rng, 1, 6) * kStar, c = -(a * e) / kStar;
    if (!Number.isInteger(c) || c === 0) continue;
    return {
      prompt: `Find the value of $k$ for which the pair of linear equations $kx + ${a}y = ${c}$ and $${b}x + ky = ${e}$ has no solution.`.replace(/\+ 1y/, '+ y').replace(/\$1x/, '$x'),
      answerType: 'numeric', answer: { value: kStar },
      traps: traps(kStar, [{ value: -kStar, why: `At $k = ${-kStar}$ all three ratios are equal, so the lines coincide — infinitely many solutions, not none.` }]),
      hints: ['Equate $\\dfrac{a_1}{a_2} = \\dfrac{b_1}{b_2}$ — it is quadratic in $k$.', 'Keep only the value at which $\\dfrac{b_1}{b_2} \\ne \\dfrac{c_1}{c_2}$.'],
      steps: [
        { h: 'First two ratios', d: `$\\dfrac{k}{${b}} = \\dfrac{${a}}{k} \\Rightarrow k^2 = ${a * b}$, so $k = \\pm ${s}$` },
        { h: `Test k = ${-kStar}`, d: `$\\dfrac{${a}}{${-kStar}} = \\dfrac{${c}}{${e}}$: all three ratios equal, infinitely many solutions` },
        { h: `Test k = ${kStar}`, d: `$\\dfrac{${a}}{${kStar}} \\ne \\dfrac{${c}}{${e}}$: parallel distinct lines, no solution` },
        { h: 'Answer', d: `$k = ${kStar}$` }
      ],
      form: 'k-squared-no-solution'
    };
  }
  throw new Error('c10-linear-condition-forms: no k-squared fixture');
}

// ── The bank ────────────────────────────────────────────────────────────────

export const CLASS10_ALGEBRA_FORMS = Object.freeze({
  'c10-ap-term-forms': bank('c10-ap-term-forms', 'c10-arithmetic-progressions', 0, {
    1: [nthFromEnd, numberOfTerms], 2: [kForThreeTerms, termFromTwoTerms], 3: [firstNegativeTerm, zeroTerm]
  }),
  'c10-ap-sum-forms': bank('c10-ap-sum-forms', 'c10-arithmetic-progressions', 1, {
    1: [sumFirstLast, sumOfMultiples], 2: [multiplesBetween, differenceFromSum], 3: [termFromSumFormula, differenceFromEnds]
  }),
  'c10-zero-coefficient-forms': bank('c10-zero-coefficient-forms', 'c10-polynomials', 1, {
    1: [sumOrProduct('sum'), sumOrProduct('product')], 2: [sumOfSquares, sumOfReciprocals], 3: [kFromOneZero, constantFromDifference]
  }),
  'c10-quadratic-k-forms': bank('c10-quadratic-k-forms', 'c10-quadratic-equations', 2, {
    1: [discriminantValue, middleKEqualRoots(1)], 2: [leadingKEqualRoots, middleKEqualRoots(-1)], 3: [shiftedKEqualRoots, leastKNoRealRoots]
  }),
  'c10-linear-condition-forms': bank('c10-linear-condition-forms', 'c10-pair-linear-equations', 1, {
    1: [kNoSolution, kInfinitelyMany], 2: [kBothSides('none'), kBothSides('infinite')], 3: [kSquaredNoSolution, kBothSides('none')]
  })
});

/** generator → { chapter, dotpoint } — the covers and the check read this. */
export const CLASS10_ALGEBRA_FORMS_MAP = Object.freeze({
  'c10-ap-term-forms': Object.freeze({ chapter: 'c10-arithmetic-progressions', dotpoint: 0 }),
  'c10-ap-sum-forms': Object.freeze({ chapter: 'c10-arithmetic-progressions', dotpoint: 1 }),
  'c10-zero-coefficient-forms': Object.freeze({ chapter: 'c10-polynomials', dotpoint: 1 }),
  'c10-quadratic-k-forms': Object.freeze({ chapter: 'c10-quadratic-equations', dotpoint: 2 }),
  'c10-linear-condition-forms': Object.freeze({ chapter: 'c10-pair-linear-equations', dotpoint: 1 })
});
