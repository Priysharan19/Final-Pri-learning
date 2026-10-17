// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · CBSE/NCERT Class X — hardest-level (D3) forms, tranche 1
//
// The CBSE track serves D1–D3, and sixteen Class X dot points had no authored
// form at D3: the picker could not offer the hardest level for them, and a
// request that named it was refused (docs/release/evidence/
// india-difficulty-coverage.md). Each generator below authors exactly one rung —
// the D3 form for one dot point — and the coverage table
// (curriculum-in-hardest-covers.js) claims it at D3 and nowhere else.
//
// What makes these D3 rather than another D2 is the reasoning, not the size of
// the numbers: every form needs two connected steps or two chapter ideas —
// factorising a cubic by grouping before reading its zeroes, an inverse use of a
// formula (the frequency that produces a stated mean, the number of terms that
// produces a stated sum), a construction applied twice (BPT through two
// parallels), or a relation derived before it is used (cone height from the
// total height of the toy).
//
// Scope is the 2026–27 rationalised Class X syllabus and nothing beyond it:
// no polynomial division, no coordinate area of a triangle, no recasting of
// solids, no ogives, no equations reducible to linear form, real roots only,
// heights-and-distances angles only from the standard table.
//
// Provenance. These are original, parameterised forms written for Pri
// Learning. They are not transcribed from a textbook exercise or a past paper:
// the question shapes are the standard ones of the chapter, and every number
// is drawn from the seed. Every keyed answer is computed from the parameters,
// never typed, and client/test/india-hardest-forms-check.mjs recomputes each
// one by a second route. None of this is a human maths review, and nothing
// here claims board approval.
//
// Asked for any rung other than D3, each generator returns its D3 form. No
// coverage entry claims these generators below or above D3, and the check
// fails if one ever does, so the label a student sees is always D3.
// ─────────────────────────────────────────────────────────────────────────────
import { ri, rc, nz, gcd, makeRng } from '../qhelpers.js';
import { exact as exactForm, frac, fracTex, traps, twoNames } from './india-native-helpers.js';

/**
 * An exact answer that also accepts its exact decimal. The marker reads any
 * \dfrac in a prompt as a demand for a fraction answer, and these prompts carry
 * \dfrac in their GIVEN data (π = 22/7, sec A = 13/12, a codomain value), not
 * in what they ask for — so the demand is switched off explicitly. The keyed
 * simplest fraction is unchanged and is still accepted.
 */
function exact(f, suffix) {
  const out = exactForm(f, suffix);
  if (out.answer.simplestFraction) out.answer = { ...out.answer, requireFraction: false };
  return out;
}

// ── Formatting ───────────────────────────────────────────────────────────────

/** "+ 3" / "- 3" — a signed constant written after another term. */
const sg = k => (k >= 0 ? `+ ${k}` : `- ${Math.abs(k)}`);
/** "x + 3", "x - 2", "x". */
const lin = (k, v = 'x') => (k === 0 ? v : `${v} ${sg(k)}`);

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

/** A fraction as text for a value the student is given (₹, cm, a mean). */
function decimalText(f) {
  const v = f.n / f.d;
  return Number.isInteger(v) ? String(v) : String(Number(v.toFixed(2)));
}

/** Does n/d terminate within two decimal places? */
const twoPlaces = f => (100 * f.n) % f.d === 0;

// A loop below that exhausts its guard (it does not happen for any seed the
// checks have tried) starts again from this fixed seed rather than returning a
// half-built question.
const FALLBACK_SEED = 0x2f6b9e31;
const PI_NOTE = 'Take $\\pi = \\dfrac{22}{7}$.';

// ── 1 · Polynomials — zeroes of a cubic found by grouping ───────────────────
// p(x) = c(x − r)(x² − s²). Grouping the first two and the last two terms
// exposes (x − r) twice; what is left is a difference of two squares.
function polynomialZeroesGrouping(rng) {
  let r = nz(rng, -6, 6), s = ri(rng, 1, 6);
  if (s === Math.abs(r)) s = s === 6 ? 5 : s + 1;
  const c = rc(rng, [1, 1, 2, 3]);
  const coeffs = [c, -c * r, -c * s * s, c * r * s * s];
  const zeroes = [-s, s, r].sort((a, b) => a - b);
  const grouped = `${c === 1 ? '' : c}\\left[x^2(${lin(-r)}) - ${s * s}(${lin(-r)})\\right]`;
  return {
    prompt: `Find all the zeroes of the cubic polynomial $p(x) = ${polyTex(coeffs)}$. These are the $x$-coordinates of the points where the graph of $y = p(x)$ meets the $x$-axis.`,
    answerType: 'set', answer: { values: zeroes },
    traps: traps(zeroes[0], [
      { value: -r, why: `The factor $(${lin(-r)})$ is zero at $x = ${r}$, not at $x = ${-r}$: solving a factor flips the sign of the number written in it.` },
      { value: s * s, why: `$${s * s}$ is $${s}^2$. The factor $x^2 - ${s * s}$ is zero when $x = \\pm ${s}$, not when $x = ${s * s}$.` }
    ]),
    hints: [
      ...(c === 1 ? [] : [`Every coefficient is a multiple of $${c}$; take that common factor out first — it does not change the zeroes.`]),
      'Group the first two terms together and the last two terms together.',
      'Take out a common factor from each group: the same linear factor should appear in both.',
      'What is left beside that linear factor is a difference of two squares, and a product is zero when one of its factors is zero.'
    ],
    steps: [
      ...(c === 1 ? [] : [{ h: 'Take out the common factor', d: `$p(x) = ${c}(${polyTex([1, -r, -s * s, r * s * s])})$` }]),
      { h: 'Group in pairs', d: `$p(x) = ${grouped}$` },
      { h: 'Factorise fully', d: `$p(x) = ${c === 1 ? '' : c}(${lin(-r)})(x - ${s})(x + ${s})$` },
      { h: 'Read off the zeroes', d: `$x = ${zeroes.join(',\\ ')}$ — the graph meets the $x$-axis three times.` }
    ]
  };
}

// ── 2 · Pair of linear equations — situations set up by the student ─────────
// Two shapes, each built from its solution outwards: ages related at two
// different times, and a two-digit number described by its digits.
function agesSituation(rng) {
  const [older, younger] = twoNames(rng);
  for (let guard = 0; guard < 400; guard++) {
    const ago = ri(rng, 2, 8), k = ri(rng, 3, 5), thenAge = ri(rng, 3, 12);
    const B = thenAge + ago, A = k * thenAge + ago;
    const later = [];
    for (let b = 2; b <= 30; b++) {
      const m = (A + b) / (B + b);
      if (Number.isInteger(m) && m >= 2 && m < k) later.push([b, m]);
    }
    if (!later.length) continue;
    const [ahead, m] = rc(rng, later);
    if ([ago, k, ahead, m].includes(A) || [ago, k, ahead, m].includes(B)) continue;
    return {
      prompt: `${ago} years ago, ${older} was ${k} times as old as ${younger}. In ${ahead} years' time, ${older} will be ${m} times as old as ${younger}. Form a pair of linear equations and find ${older}'s present age.`,
      answerType: 'numeric', answer: { value: A }, answerSuffix: 'years',
      traps: traps(A, [
        { value: B, why: `That is ${younger}'s present age. Both ages come out of the pair — read off the one the question asks for.` },
        { value: A - ago, why: `That is ${older}'s age ${ago} years ago. The equations are in the present ages; the question wants the present age.` },
        { value: A + ahead, why: `That is ${older}'s age in ${ahead} years.` }
      ]),
      hints: [
        `Let ${older}'s present age be $x$ years and ${younger}'s be $y$ years.`,
        `${ago} years ago their ages were $x - ${ago}$ and $y - ${ago}$; in ${ahead} years they will be $x + ${ahead}$ and $y + ${ahead}$.`,
        'Write one equation for each sentence, simplify both to the form $ax + by = c$, and eliminate $y$.'
      ],
      steps: [
        { h: 'First condition', d: `$x - ${ago} = ${k}(y - ${ago})$, so $x - ${k}y = ${ago - k * ago}$` },
        { h: 'Second condition', d: `$x + ${ahead} = ${m}(y + ${ahead})$, so $x - ${m}y = ${m * ahead - ahead}$` },
        { h: 'Eliminate x', d: `Subtracting: $${k - m}y = ${m * ahead - ahead - (ago - k * ago)}$, so $y = ${B}$` },
        { h: 'Back-substitute', d: `$x = ${k}(${B} - ${ago}) + ${ago} = ${A}$` },
        { h: 'Answer', d: `${older} is ${A} years old now (and ${younger} is ${B}).` }
      ],
      situation: 'ages'
    };
  }
  // Unreachable in practice: the search above always finds a configuration.
  return digitsSituation(rng);
}

function digitsSituation(rng) {
  for (let guard = 0; guard < 400; guard++) {
    const x = ri(rng, 1, 9), y = ri(rng, 1, 9);
    if (x === y) continue;
    const N = 10 * x + y, R = 10 * y + x, D = Math.abs(R - N);
    const k = N / (x + y);
    const byMultiple = Number.isInteger(k) && rng() < 0.6;
    const first = byMultiple
      ? `A two-digit number is ${k} times the sum of its digits.`
      : `The sum of the digits of a two-digit number is ${x + y}.`;
    const second = `The number obtained by reversing its digits is ${D} ${R > N ? 'more' : 'less'} than the original number.`;
    const eq1 = byMultiple ? `${10 - k}x - ${k - 1}y = 0` : `x + y = ${x + y}`;
    const eq1Raw = byMultiple ? `10x + y = ${k}(x + y)` : `x + y = ${x + y}`;
    const eq2 = R > N ? `y - x = ${D / 9}` : `x - y = ${D / 9}`;
    if (byMultiple && k === 1) continue;
    return {
      prompt: `${first} ${second} Form a pair of linear equations and find the original number.`,
      answerType: 'numeric', answer: { value: N },
      traps: traps(N, [
        { value: R, why: 'That is the number with its digits reversed. The question asks for the original number.' },
        { value: D, why: 'That is the difference between the number and its reverse, not the number itself.' },
        { value: x + y, why: 'That is the sum of the digits, not the number. A two-digit number with tens digit $x$ and units digit $y$ is $10x + y$.' }
      ]),
      hints: [
        'Let the tens digit be $x$ and the units digit be $y$, so the number is $10x + y$ and the reversed number is $10y + x$.',
        'Turn each sentence into an equation in $x$ and $y$.',
        'The reversal condition simplifies to a difference of the digits once you divide through by 9.'
      ],
      steps: [
        { h: 'Name the digits', d: 'Number $= 10x + y$; reversed $= 10y + x$' },
        { h: 'First condition', d: byMultiple ? `$${eq1Raw}$, so $${eq1}$` : `$${eq1}$` },
        { h: 'Second condition', d: `$${R > N ? '(10y + x) - (10x + y)' : '(10x + y) - (10y + x)'} = ${D}$, so $${eq2}$` },
        { h: 'Solve the pair', d: `$x = ${x}$ and $y = ${y}$` },
        { h: 'Answer', d: `The number is $${N}$.` }
      ],
      situation: 'digits'
    };
  }
  return agesSituation(rng);
}

const linearPairSituations = rng => (rng() < 0.5 ? agesSituation(rng) : digitsSituation(rng));

// ── 3 · Quadratic equations — factorise after rearranging ───────────────────
// Neither equation arrives as ax² + bx + c = 0: one is a product equal to a
// constant, the other a difference of reciprocals. Both reduce to a quadratic
// whose roots were chosen first.
function quadraticFactorRearranged(rng) {
  const rational = rng() < 0.5;
  for (let guard = 0; guard < 600; guard++) {
    const r1 = ri(rng, -9, 9), r2 = ri(rng, -9, 9);
    if (r1 === r2) continue;
    const a = nz(rng, -7, 7);
    const b = -(r1 + r2) - a;
    if (b === 0 || b === a) continue;
    const k = a * b - r1 * r2;               // (x + a)(x + b) = k  ⇔  (x − r1)(x − r2) = 0
    if (k === 0) continue;
    const roots = [r1, r2].sort((m, n) => m - n);
    const S = -(r1 + r2), P = r1 * r2;
    const standard = `x^2 ${S === 0 ? '' : `${S < 0 ? '-' : '+'} ${Math.abs(S) === 1 ? '' : Math.abs(S)}x`} ${P === 0 ? '' : sg(P)} = 0`.replace(/\s+/g, ' ');
    const factored = `(${lin(-r1)})(${lin(-r2)}) = 0`;
    if (!rational) {
      return {
        prompt: `Solve by factorisation: $(${lin(a)})(${lin(b)}) = ${k}$.`,
        answerType: 'set', answer: { values: roots },
        traps: traps(roots[0], [
          { value: -a, why: `$x = ${-a}$ makes the bracket $(${lin(a)})$ zero, but the product has to equal $${k}$, not $0$. Expand and bring $${k}$ across first.` },
          { value: -roots[0], why: 'A root is the value that makes a factor zero — the sign flips back when you solve each bracket.' }
        ]),
        hints: [
          `The zero-product rule only works when one side is $0$ — and here the right-hand side is $${k}$.`,
          'Expand the brackets and bring every term to one side to reach the form $x^2 + bx + c = 0$.',
          'Then factorise by finding two numbers with the right sum and product.'
        ],
        steps: [
          { h: 'Expand', d: `$x^2 ${a + b === 0 ? '' : `${a + b < 0 ? '-' : '+'} ${Math.abs(a + b) === 1 ? '' : Math.abs(a + b)}x`} ${a * b === 0 ? '' : sg(a * b)} = ${k}$`.replace(/\s+/g, ' ') },
          { h: 'Standard form', d: `$${standard}$` },
          { h: 'Factorise', d: `$${factored}$` },
          { h: 'Roots', d: `$x = ${roots.join('$ or $x = ')}$` }
        ],
        rearranged: 'product'
      };
    }
    // 1/(x + p) − 1/(x + q) = 1/c  ⇔  (x + p)(x + q) = c(q − p), with q > p.
    const [p, q] = a < b ? [a, b] : [b, a];
    if (k % (q - p) !== 0) continue;
    const c = k / (q - p);
    if (roots.includes(-p) || roots.includes(-q)) continue;
    const rhs = c > 0 ? `\\dfrac{1}{${c}}` : `-\\dfrac{1}{${-c}}`;
    return {
      prompt: `Solve by factorisation: $\\dfrac{1}{${lin(p)}} - \\dfrac{1}{${lin(q)}} = ${rhs}$, where $x \\ne ${-p}$ and $x \\ne ${-q}$.`,
      answerType: 'set', answer: { values: roots },
      traps: traps(roots[0], [
        { value: -p, why: `$x = ${-p}$ is excluded: it makes the denominator $${lin(p)}$ zero.` },
        { value: -roots[0], why: 'A root is the value that makes a factor zero — the sign flips back when you solve each bracket.' }
      ]),
      hints: [
        'Combine the two fractions on the left over a common denominator — the product of the two denominators.',
        'Cross-multiply to clear every denominator, then bring all terms to one side.',
        'Factorise the quadratic, and check that neither root is one of the excluded values.'
      ],
      steps: [
        { h: 'Combine the left side', d: `$\\dfrac{(${lin(q)}) - (${lin(p)})}{(${lin(p)})(${lin(q)})} = \\dfrac{${q - p}}{(${lin(p)})(${lin(q)})}$` },
        { h: 'Clear the denominators', d: `$(${lin(p)})(${lin(q)}) = ${c}\\times${q - p} = ${k}$` },
        { h: 'Standard form', d: `$${standard}$` },
        { h: 'Factorise', d: `$${factored}$` },
        { h: 'Roots', d: `$x = ${roots.join('$ or $x = ')}$; neither is excluded.` }
      ],
      rearranged: 'reciprocal'
    };
  }
  // The product form above succeeds within a handful of draws for any seed.
  return quadraticFactorRearranged(makeRng(FALLBACK_SEED));
}

// ── 4 · Arithmetic progressions — sums used in reverse ──────────────────────
const apSum = (a, d, n) => (n * (2 * a + (n - 1) * d)) / 2;

function apSumReasoning(rng) {
  if (rng() < 0.5) {
    // Two partial sums fix a and d; a third sum is then asked for.
    for (let guard = 0; guard < 400; guard++) {
      const a = nz(rng, -10, 15), d = nz(rng, -5, 8);
      const m = ri(rng, 4, 9), k = m + ri(rng, 3, 8), n = k + ri(rng, 2, 10);
      const Sm = apSum(a, d, m), Sk = apSum(a, d, k), Sn = apSum(a, d, n);
      if (Sn === Sm || Sn === Sk || [m, k, n].includes(Sn) || Sm === Sk) continue;
      return {
        prompt: `The sum of the first $${m}$ terms of an arithmetic progression is $${Sm}$ and the sum of its first $${k}$ terms is $${Sk}$. Find the sum of its first $${n}$ terms.`,
        answerType: 'numeric', answer: { value: Sn },
        traps: traps(Sn, [
          { value: Sk + (Sk - Sm), why: 'Sums of an AP do not grow by equal steps — the terms do. Find $a$ and $d$ first.' },
          { value: a + (n - 1) * d, why: `That is the ${n}th term, not the sum of the first ${n} terms.` },
          { value: apSum(a, d, n - 1), why: `That is the sum of the first ${n - 1} terms — count the terms again.` }
        ]),
        hints: [
          '$S_n = \\dfrac{n}{2}\\left(2a + (n-1)d\\right)$.',
          `Substitute $n = ${m}$ and $n = ${k}$ to get two linear equations in $a$ and $d$.`,
          `Solve the pair for $a$ and $d$, then use the formula once more with $n = ${n}$.`
        ],
        steps: [
          { h: 'First sum', d: `$\\dfrac{${m}}{2}(2a + ${m - 1}d) = ${Sm}$, so $2a + ${m - 1}d = ${(2 * Sm) / m}$` },
          { h: 'Second sum', d: `$\\dfrac{${k}}{2}(2a + ${k - 1}d) = ${Sk}$, so $2a + ${k - 1}d = ${(2 * Sk) / k}$` },
          { h: 'Solve the pair', d: `$${k - m}d = ${(2 * Sk) / k - (2 * Sm) / m}$, so $d = ${d}$ and $a = ${a}$` },
          { h: 'Required sum', d: `$S_{${n}} = \\dfrac{${n}}{2}(2(${a}) + ${n - 1}(${d})) = ${Sn}$` }
        ],
        reasoning: 'two-sums'
      };
    }
  }
  // How many terms give a stated sum? A quadratic in n with one positive root.
  for (let guard = 0; guard < 400; guard++) {
    const a = ri(rng, 2, 30), d = ri(rng, 2, 9), n = ri(rng, 6, 25);
    const S = apSum(a, d, n);
    const shown = [a, a + d, a + 2 * d, S];
    if (shown.includes(n)) continue;
    return {
      prompt: `How many terms of the arithmetic progression $${a},\\ ${a + d},\\ ${a + 2 * d},\\ \\ldots$ must be taken so that their sum is $${S}$?`,
      answerType: 'numeric', answer: { value: n },
      traps: traps(n, [
        { value: Math.round(S / a), why: 'Dividing the sum by the first term assumes every term equals the first; the terms grow by the common difference.' },
        { value: Math.round((S - a) / d) + 1, why: `That treats $${S}$ as the last term. Here $${S}$ is the SUM of the terms, so use $S_n$, not $a_n$.` }
      ]),
      hints: [
        `Read off $a$ and $d$ from the first terms.`,
        `Set $\\dfrac{n}{2}\\left(2a + (n-1)d\\right) = ${S}$ — this is a quadratic equation in $n$.`,
        'Solve it; the number of terms must be a positive whole number, so reject any root that is not.'
      ],
      steps: [
        { h: 'Identify a and d', d: `$a = ${a}$, $d = ${d}$` },
        { h: 'Form the equation', d: `$\\dfrac{n}{2}(${2 * a} + ${d}(n - 1)) = ${S}$, so $${d}n^2 ${sg(2 * a - d)}n - ${2 * S} = 0$` },
        { h: 'Solve', d: `The roots are $n = ${n}$ and $n = ${fracTex(-2 * S, d * n)}$; only the positive whole number is a count of terms.` },
        { h: 'Answer', d: `$${n}$ terms` }
      ],
      reasoning: 'number-of-terms'
    };
  }
  return apSumReasoning(makeRng(FALLBACK_SEED));
}

// ── 5 · Arithmetic progressions in daily life — the unknown is the count ────
function apDailyLifeReasoning(rng) {
  const kind = rc(rng, ['penalty', 'savings', 'stack']);
  if (kind === 'penalty') {
    for (let guard = 0; guard < 400; guard++) {
      const a = 50 * ri(rng, 3, 8), d = 25 * ri(rng, 1, 4), n = ri(rng, 8, 30);
      const T = apSum(a, d, n);
      if ([a, d, a + d, a + 2 * d, T].includes(n)) continue;
      return {
        prompt: `A contract carries a penalty for delay: $₹${a}$ for the first day, $₹${a + d}$ for the second day, $₹${a + 2 * d}$ for the third day, and so on, the penalty rising by the same amount each day. The contractor paid $₹${T}$ in penalties in all. For how many days was the work delayed?`,
        answerType: 'numeric', answer: { value: n }, answerSuffix: 'days',
        traps: traps(n, [
          { value: Math.round((T - a) / d) + 1, why: `That treats $₹${T}$ as the penalty on the last day. It is the TOTAL, so the sum formula is needed.` },
          { value: Math.round(T / a), why: 'Dividing the total by the first day\'s penalty ignores the daily increase.' }
        ]),
        hints: [
          'The daily penalties form an arithmetic progression.',
          `With $a = ${a}$ and $d = ${d}$, set $S_n$ equal to the total paid.`,
          'That is a quadratic in $n$; the number of days is its positive whole-number root.'
        ],
        steps: [
          { h: 'Model', d: `$\\dfrac{n}{2}(2(${a}) + (n-1)${d}) = ${T}$` },
          { h: 'Simplify', d: `$${d}n^2 + ${2 * a - d}n - ${2 * T} = 0$` },
          { h: 'Solve', d: `$n = ${n}$ (the other root is negative)` },
          { h: 'Answer', d: `The work was delayed by $${n}$ days.` }
        ],
        situation: 'penalty'
      };
    }
  }
  if (kind === 'savings') {
    const [saver] = twoNames(rng);
    for (let guard = 0; guard < 400; guard++) {
      const a = 10 * ri(rng, 5, 30), d = 5 * ri(rng, 2, 10), n = ri(rng, 6, 24);
      const before = apSum(a, d, n - 1), at = apSum(a, d, n);
      const gap = at - before;
      if (gap < 20) continue;
      const T = before + 10 * ri(rng, 1, Math.floor((gap - 1) / 10));
      if (T <= before || T >= at || [a, a + d, T].includes(n)) continue;
      return {
        prompt: `${saver} saves $₹${a}$ in the first week of the year and $₹${d}$ more each week than in the week before. In which week do ${saver}'s total savings first exceed $₹${T}$? Give the week number.`,
        answerType: 'numeric', answer: { value: n },
        traps: traps(n, [
          { value: n - 1, why: `After that week the total is $₹${before}$, which has not yet passed $₹${T}$.` },
          { value: Math.round((T - a) / d) + 1, why: `That is the week in which a SINGLE week's saving reaches $₹${T}$; the question is about the running total.` }
        ]),
        hints: [
          'The weekly savings form an AP; the total after $n$ weeks is $S_n$.',
          `You need the smallest whole $n$ with $S_n > ${T}$.`,
          'Solve $S_n = $ the target as a quadratic to see roughly where $n$ lies, then check the whole numbers either side.'
        ],
        steps: [
          { h: 'Running total', d: `$S_n = \\dfrac{n}{2}(${2 * a} + ${d}(n-1))$` },
          { h: 'Check the boundary', d: `$S_{${n - 1}} = ${before}$ and $S_{${n}} = ${at}$` },
          { h: 'Compare', d: `$${before} \\le ${T} < ${at}$` },
          { h: 'Answer', d: `Week $${n}$` }
        ],
        situation: 'savings'
      };
    }
  }
  // A stack whose rows shrink by a fixed amount: the quadratic for the number
  // of rows has two positive roots, and only one leaves a positive top row.
  for (let guard = 0; guard < 600; guard++) {
    const step = rc(rng, [1, 2]), bottom = ri(rng, 12, 30), n = ri(rng, 4, 14);
    const top = bottom - (n - 1) * step;
    if (top < 1) continue;
    const T = apSum(bottom, -step, n);
    const valid = [];
    for (let m = 1; m <= 80; m++) if (apSum(bottom, -step, m) === T && bottom - (m - 1) * step >= 1) valid.push(m);
    if (valid.length !== 1 || [bottom, step, T, n].includes(top)) continue;
    const item = rc(rng, [['logs', 'log'], ['flower pots', 'flower pot'], ['bricks', 'brick']]);
    return {
      prompt: `${item[0][0].toUpperCase()}${item[0].slice(1)} are stacked in rows: $${bottom}$ in the bottom row, $${bottom - step}$ in the next row, $${bottom - 2 * step}$ in the row above that, and so on. The stack holds $${T}$ ${item[0]} in all. How many ${item[0]} are in the top row?`,
      answerType: 'numeric', answer: { value: top },
      traps: traps(top, [
        { value: n, why: 'That is the number of rows. The question asks how many are in the top row.' },
        { value: bottom - n * step, why: `With $n$ rows the top row is the ${n}th term, $a + (n - 1)d$, not $a + nd$.` }
      ]),
      hints: [
        `The rows form an AP with $a = ${bottom}$ and $d = ${-step}$.`,
        `Set $S_n = ${T}$ and solve the quadratic for the number of rows $n$.`,
        'A row cannot hold zero or a negative number of items — use that to choose between the roots, then find the last term.'
      ],
      steps: [
        { h: 'Model', d: `$\\dfrac{n}{2}(2(${bottom}) + (n-1)(${-step})) = ${T}$` },
        { h: 'Solve for n', d: `The admissible root is $n = ${n}$; the other root would make the top row zero or negative.` },
        { h: 'Top row', d: `$a_{${n}} = ${bottom} + ${n - 1}(${-step}) = ${top}$` }
      ],
      situation: 'stack'
    };
  }
  return apDailyLifeReasoning(makeRng(FALLBACK_SEED));
}

// ── 6 · Triangles — the Basic Proportionality Theorem with an unknown ───────
function bptReasoning(rng) {
  if (rng() < 0.5) {
    // AD, DB, AE, EC are x + p, x + q, x + r, x + s; BPT gives a linear
    // equation once the x² terms cancel.
    for (let guard = 0; guard < 600; guard++) {
      const x = ri(rng, 3, 12), p = ri(rng, -2, 6), q = ri(rng, -2, 6), r = ri(rng, -2, 6);
      const num = (x + q) * (x + r);
      if (num % (x + p) !== 0) continue;
      const s = num / (x + p) - x;
      if (p + s - q - r === 0 || [p, q, r, s].some(v => x + v <= 0) || p === q || s < -2 || s > 12) continue;
      const askAC = rng() < 0.5;
      const answer = askAC ? 2 * x + r + s : x;
      const shown = [p, q, r, s].map(Math.abs);
      if (shown.includes(answer)) continue;
      const len = v => lin(v);
      return {
        prompt: `In $\\triangle ABC$, $D$ lies on $AB$ and $E$ lies on $AC$ with $DE \\parallel BC$. If $AD = ${len(p)}$, $DB = ${len(q)}$, $AE = ${len(r)}$ and $EC = ${len(s)}$ (all in cm), find ${askAC ? 'the length of $AC$' : 'the value of $x$'}.`,
        answerType: 'numeric', answer: { value: answer }, ...(askAC ? { answerSuffix: 'cm' } : {}),
        traps: traps(answer, [
          ...(askAC ? [{ value: x, why: `That is $x$. $AC = AE + EC$, so substitute $x$ back into both lengths.` }, { value: x + s, why: 'That is $EC$ alone; $AC$ is the whole side $AE + EC$.' }] : [{ value: 2 * x + r + s, why: 'That is the length of $AC$, not $x$.' }])
        ]),
        hints: [
          'Since $DE \\parallel BC$, the Basic Proportionality Theorem gives $\\dfrac{AD}{DB} = \\dfrac{AE}{EC}$.',
          'Cross-multiply; the $x^2$ terms cancel and a linear equation is left.',
          askAC ? 'Solve for $x$, then add $AE$ and $EC$.' : 'Solve for $x$ and check that every length is positive.'
        ],
        steps: [
          { h: 'Apply BPT', d: `$\\dfrac{${len(p)}}{${len(q)}} = \\dfrac{${len(r)}}{${len(s)}}$` },
          { h: 'Cross-multiply', d: `$(${len(p)})(${len(s)}) = (${len(q)})(${len(r)})$` },
          { h: 'Solve', d: `$${p + s - q - r}x = ${q * r - p * s}$, so $x = ${x}$` },
          ...(askAC ? [{ h: 'Find AC', d: `$AC = (${x} ${sg(r)}) + (${x} ${sg(s)}) = ${answer}$ cm` }] : [])
        ],
        reasoning: 'algebraic'
      };
    }
  }
  // BPT twice: DE ∥ BC gives AD/DB = AE/EC and EF ∥ CD (F on AD) gives
  // AF/FD = AE/EC, so AF/FD = AD/DB and AD² = AF · AB.
  const u = ri(rng, 2, 5), v = u + ri(rng, 1, 5), t = rc(rng, [1, 1, 2]);
  const AF = t * u * u, AD = t * u * v, AB = t * v * v;
  const FD = AD - AF, DB = AB - AD;
  return {
    prompt: `In $\\triangle ABC$, $D$ is a point on $AB$ and $E$ is a point on $AC$ such that $DE \\parallel BC$. A point $F$ on $AD$ is chosen so that $EF \\parallel CD$. If $AF = ${AF}$ cm and $FD = ${FD}$ cm, find $DB$.`,
    answerType: 'numeric', answer: { value: DB }, answerSuffix: 'cm',
    traps: traps(DB, [
      { value: AB, why: 'That is $AB$, the whole side. $DB = AB - AD$.' },
      { value: FD, why: 'Copying $FD$ assumes the two segments are equal; the theorem gives equal RATIOS, not equal lengths.' },
      { value: AD, why: `That is $AD = AF + FD$. Use it in $\\dfrac{AF}{FD} = \\dfrac{AD}{DB}$.` }
    ]),
    hints: [
      'Apply the Basic Proportionality Theorem in $\\triangle ABC$ (with $DE \\parallel BC$) and again in $\\triangle ACD$ (with $EF \\parallel CD$).',
      'Both give a ratio equal to $\\dfrac{AE}{EC}$, so the two ratios on $AB$ are equal to each other.',
      'Write $AD = AF + FD$ and solve for the unknown segment.'
    ],
    steps: [
      { h: 'In △ABC', d: '$DE \\parallel BC \\Rightarrow \\dfrac{AD}{DB} = \\dfrac{AE}{EC}$' },
      { h: 'In △ACD', d: '$EF \\parallel CD \\Rightarrow \\dfrac{AF}{FD} = \\dfrac{AE}{EC}$' },
      { h: 'Equate', d: `$\\dfrac{AF}{FD} = \\dfrac{AD}{DB}$ with $AD = ${AF} + ${FD} = ${AD}$` },
      { h: 'Solve', d: `$DB = \\dfrac{AD \\times FD}{AF} = \\dfrac{${AD} \\times ${FD}}{${AF}} = ${DB}$ cm` }
    ],
    reasoning: 'double-bpt'
  };
}

// ── 7 · Coordinate geometry — the distance formula used to find a point ─────
const TRIPLES = [[3, 4, 5], [6, 8, 10], [5, 12, 13], [8, 15, 17], [9, 12, 15], [7, 24, 25], [12, 16, 20]];

function distanceReasoning(rng) {
  if (rng() < 0.5) {
    const onX = rng() < 0.5;
    for (let guard = 0; guard < 600; guard++) {
      const x1 = ri(rng, -8, 8), y1 = ri(rng, -8, 8), x2 = ri(rng, -8, 8), y2 = ri(rng, -8, 8);
      // On the x-axis, P = (t, 0) is equidistant when 2t(x2 − x1) = x2² + y2² − x1² − y1².
      const [u1, w1, u2, w2] = onX ? [x1, y1, x2, y2] : [y1, x1, y2, x2];
      if (u1 === u2) continue;
      const num = u2 * u2 + w2 * w2 - u1 * u1 - w1 * w1, den = 2 * (u2 - u1);
      if (num % den !== 0) continue;
      const tpos = num / den;
      if ((x1 === x2 && y1 === y2) || Math.abs(tpos) > 15) continue;
      const point = onX ? { x: tpos, y: 0 } : { x: 0, y: tpos };
      return {
        prompt: `Find the point on the ${onX ? '$x$' : '$y$'}-axis that is equidistant from $A(${x1}, ${y1})$ and $B(${x2}, ${y2})$. Give it as a point.`,
        answerType: 'point', answer: point,
        hints: [
          `A point on the ${onX ? '$x$' : '$y$'}-axis has the form ${onX ? '$P(t, 0)$' : '$P(0, t)$'}.`,
          'Set $PA^2 = PB^2$ using the distance formula — squaring removes the square roots.',
          `The $t^2$ terms cancel, leaving a linear equation in $t$.`
        ],
        steps: [
          { h: 'Let the point be', d: onX ? '$P(t, 0)$' : '$P(0, t)$' },
          { h: 'Equate squared distances', d: onX ? `$(t ${sg(-x1)})^2 + ${y1 * y1} = (t ${sg(-x2)})^2 + ${y2 * y2}$` : `$${x1 * x1} + (t ${sg(-y1)})^2 = ${x2 * x2} + (t ${sg(-y2)})^2$` },
          { h: 'Simplify', d: `$${den}t = ${num}$, so $t = ${tpos}$` },
          { h: 'Answer', d: `$P(${point.x}, ${point.y})$` }
        ],
        reasoning: 'equidistant'
      };
    }
  }
  const [p, q, h] = rc(rng, TRIPLES);
  const [dx, dy] = rng() < 0.5 ? [p, q] : [q, p];
  const x1 = ri(rng, -6, 6), y1 = ri(rng, -6, 6);
  const x2 = x1 + (rng() < 0.5 ? dx : -dx);
  const values = [y1 - dy, y1 + dy];
  return {
    prompt: `The distance between the points $P(${x1}, ${y1})$ and $Q(${x2}, k)$ is $${h}$ units. Find all possible values of $k$.`,
    answerType: 'set', answer: { values },
    traps: traps(values[0], [
      { value: y1 + h, why: `Adding the distance to the $y$-coordinate ignores the horizontal gap of $${dx}$ between the points.` }
    ]),
    hints: [
      'Write the distance formula for $PQ$ and square both sides to remove the square root.',
      'Isolate $(k - y_1)^2$.',
      'A square has two square roots, so there are two values of $k$.'
    ],
    steps: [
      { h: 'Distance formula', d: `$${dx * dx} + (k ${sg(-y1)})^2 = ${h * h}$` },
      { h: 'Isolate the square', d: `$(k ${sg(-y1)})^2 = ${h * h - dx * dx}$` },
      { h: 'Take both roots', d: `$k ${sg(-y1)} = \\pm ${dy}$` },
      { h: 'Answer', d: `$k = ${values[0]}$ or $k = ${values[1]}$` }
    ],
    reasoning: 'two-values'
  };
}

// ── 8 · Coordinate geometry — the section formula run backwards ─────────────
function sectionReasoning(rng) {
  for (let guard = 0; guard < 600; guard++) {
    const m = ri(rng, 1, 5), n = ri(rng, 1, 5);
    if (m === n || gcd(m, n) !== 1) continue;
    if (rng() < 0.5) {
      const x1 = ri(rng, -8, 8), y1 = ri(rng, -8, 8), s = nz(rng, -3, 3), w = nz(rng, -3, 3);
      const x2 = x1 + (m + n) * s, y2 = y1 + (m + n) * w;
      const xp = x1 + m * s, t = y1 + m * w;
      if ([x1, y1, x2, y2, xp].includes(t)) continue;
      return {
        prompt: `The point $P(${xp}, t)$ lies on the line segment joining $A(${x1}, ${y1})$ and $B(${x2}, ${y2})$. Find the ratio in which $P$ divides $AB$, and hence find $t$.`,
        answerType: 'numeric', answer: { value: t },
        traps: traps(t, [
          { value: y1 + n * w, why: `That uses the ratio the wrong way round: with $AP : PB = ${m} : ${n}$ the section formula weights $B$ by $${m}$ and $A$ by $${n}$.` },
          { value: (y1 + y2) / 2, why: 'That is the midpoint, which is only right when the ratio is $1:1$.' }
        ]),
        hints: [
          'Let $P$ divide $AB$ in the ratio $k : 1$, and apply the section formula to the $x$-coordinates — those are all known.',
          'Solve that equation for $k$ and write the ratio in whole numbers.',
          'Now use the same ratio in the section formula for the $y$-coordinate.'
        ],
        steps: [
          { h: 'Use the x-coordinates', d: `$\\dfrac{${x2}k + ${x1 < 0 ? `(${x1})` : x1}}{k + 1} = ${xp}$, so $k = ${fracTex(m, n)}$` },
          { h: 'The ratio', d: `$AP : PB = ${m} : ${n}$` },
          { h: 'Use the y-coordinates', d: `$t = \\dfrac{${m}(${y2}) + ${n}(${y1})}{${m + n}} = ${t}$` }
        ],
        reasoning: 'collinear-point'
      };
    }
    // The x-axis cuts AB where y = 0: the ratio is −y1 : y2.
    const u = ri(rng, 1, 3), x1 = ri(rng, -8, 8), s = nz(rng, -3, 3);
    const y1 = -m * u, y2 = n * u, x2 = x1 + (m + n) * s, xp = x1 + m * s;
    const flip = rng() < 0.5;
    const A = flip ? [x1, -y1] : [x1, y1], B = flip ? [x2, -y2] : [x2, y2];
    return {
      prompt: `Find the ratio in which the $x$-axis divides the line segment joining $A(${A[0]}, ${A[1]})$ and $B(${B[0]}, ${B[1]})$, and hence find the point where $AB$ meets the $x$-axis.`,
      answerType: 'point', answer: { x: xp, y: 0 },
      hints: [
        'Every point on the $x$-axis has $y$-coordinate $0$.',
        'Let the ratio be $k : 1$ and set the $y$-coordinate from the section formula equal to $0$.',
        'Use the ratio you found in the section formula for the $x$-coordinate.'
      ],
      steps: [
        { h: 'Set y = 0', d: `$\\dfrac{${B[1]}k ${sg(A[1])}}{k + 1} = 0$, so $k = ${fracTex(m, n)}$` },
        { h: 'The ratio', d: `$${m} : ${n}$` },
        { h: 'The x-coordinate', d: `$x = \\dfrac{${m}(${x2}) + ${n}(${x1})}{${m + n}} = ${xp}$` },
        { h: 'Answer', d: `$(${xp}, 0)$` }
      ],
      reasoning: 'axis-crossing'
    };
  }
  return sectionReasoning(makeRng(FALLBACK_SEED));
}

// ── 9 · Trigonometric ratios — one ratio given, an expression evaluated ─────
const RATIO_TRIPLES = [[3, 4, 5], [5, 12, 13], [8, 15, 17], [7, 24, 25], [20, 21, 29], [9, 40, 41], [12, 35, 37]];

function trigRatioReasoning(rng) {
  for (let guard = 0; guard < 400; guard++) {
    const [p, q, h] = rc(rng, RATIO_TRIPLES);
    const [o, a] = rng() < 0.5 ? [p, q] : [q, p];          // opposite, adjacent
    const given = rc(rng, [
      { tex: `\\sec A = \\dfrac{${h}}{${a}}`, how: `$\\sec A = \\dfrac{\\text{hyp}}{\\text{adj}}$, so take adjacent $= ${a}$, hypotenuse $= ${h}$` },
      { tex: `\\operatorname{cosec} A = \\dfrac{${h}}{${o}}`, how: `$\\operatorname{cosec} A = \\dfrac{\\text{hyp}}{\\text{opp}}$, so take opposite $= ${o}$, hypotenuse $= ${h}$` },
      { tex: `${o}\\cot A = ${a}`, how: `$\\cot A = \\dfrac{${a}}{${o}} = \\dfrac{\\text{adj}}{\\text{opp}}$, so take adjacent $= ${a}$, opposite $= ${o}$` },
      { tex: `${a}\\tan A = ${o}`, how: `$\\tan A = \\dfrac{${o}}{${a}} = \\dfrac{\\text{opp}}{\\text{adj}}$, so take opposite $= ${o}$, adjacent $= ${a}$` }
    ]);
    let value, expr, work;
    if (rng() < 0.6) {
      const c1 = ri(rng, 1, 5), c2 = ri(rng, 1, 5), c3 = ri(rng, 1, 5), c4 = ri(rng, 1, 5);
      const den = c3 * o - c4 * a;
      if (den === 0) continue;
      value = frac(c1 * o + c2 * a, den);
      expr = `\\dfrac{${c1 === 1 ? '' : c1}\\sin A + ${c2 === 1 ? '' : c2}\\cos A}{${c3 === 1 ? '' : c3}\\sin A - ${c4 === 1 ? '' : c4}\\cos A}`;
      work = `Dividing every term by $\\cos A$, or substituting $\\sin A = \\dfrac{${o}}{${h}}$ and $\\cos A = \\dfrac{${a}}{${h}}$: $\\dfrac{${c1}(${o}) + ${c2}(${a})}{${c3}(${o}) - ${c4}(${a})}$`;
    } else {
      value = frac(a * a - o * o, h * h);
      expr = '\\dfrac{1 - \\tan^2 A}{1 + \\tan^2 A}';
      work = `$\\tan A = \\dfrac{${o}}{${a}}$, so $\\dfrac{1 - \\frac{${o * o}}{${a * a}}}{1 + \\frac{${o * o}}{${a * a}}} = \\dfrac{${a * a - o * o}}{${a * a + o * o}}$`;
    }
    if (value.n === 0) continue;
    return {
      prompt: `For an acute angle $A$, $${given.tex}$. Evaluate $${expr}$ exactly.`,
      answerType: 'numeric', ...exact(value),
      hints: [
        'Draw a right triangle with angle $A$ and label two sides from the ratio you are given.',
        'Find the third side by Pythagoras, then write $\\sin A$, $\\cos A$ and $\\tan A$ as fractions.',
        'Substitute into the expression and simplify — the hypotenuse often cancels.'
      ],
      steps: [
        { h: 'Label the triangle', d: given.how },
        { h: 'Third side', d: `Pythagoras: ${o * o} + ${a * a} = ${h * h}, so the sides are opposite $${o}$, adjacent $${a}$, hypotenuse $${h}$` },
        { h: 'Substitute', d: work },
        { h: 'Simplify', d: `$${fracTex(value.n, value.d)}$` }
      ]
    };
  }
  return trigRatioReasoning(makeRng(FALLBACK_SEED));
}

// ── 10 · Standard angles — expressions and angle pairs ──────────────────────
// Squared ratios at 0°, 30°, 45°, 60°, 90° are rational, so any combination of
// them is an exact fraction. null marks a ratio that is undefined there.
const SQUARED = {
  sin: { 0: [0, 1], 30: [1, 4], 45: [1, 2], 60: [3, 4], 90: [1, 1] },
  cos: { 0: [1, 1], 30: [3, 4], 45: [1, 2], 60: [1, 4], 90: [0, 1] },
  tan: { 0: [0, 1], 30: [1, 3], 45: [1, 1], 60: [3, 1], 90: null },
  sec: { 0: [1, 1], 30: [4, 3], 45: [2, 1], 60: [4, 1], 90: null },
  cosec: { 0: null, 30: [4, 1], 45: [2, 1], 60: [4, 3], 90: [1, 1] },
  cot: { 0: null, 30: [3, 1], 45: [1, 1], 60: [1, 3], 90: [0, 1] }
};
const fnTex = f => (f === 'cosec' ? '\\operatorname{cosec}' : `\\${f}`);
const addF = (x, y) => frac(x.n * y.d + y.n * x.d, x.d * y.d);
const mulF = (x, k) => frac(x.n * k, x.d);

const EXACT_VALUE = {
  sin: { 30: ['\\dfrac{1}{2}', 0.5], 60: ['\\dfrac{\\sqrt{3}}{2}', Math.sqrt(3) / 2], 90: ['1', 1], 45: ['\\dfrac{1}{\\sqrt{2}}', Math.SQRT1_2] },
  cos: { 30: ['\\dfrac{\\sqrt{3}}{2}', Math.sqrt(3) / 2], 60: ['\\dfrac{1}{2}', 0.5], 90: ['0', 0], 45: ['\\dfrac{1}{\\sqrt{2}}', Math.SQRT1_2] },
  tan: { 30: ['\\dfrac{1}{\\sqrt{3}}', 1 / Math.sqrt(3)], 60: ['\\sqrt{3}', Math.sqrt(3)], 45: ['1', 1] }
};
// A + B = α and A − B = β with A > B > 0 and A + B ≤ 90°.
const ANGLE_PAIRS = [[60, 30], [90, 30], [90, 60]];

function trigStandardReasoning(rng) {
  if (rng() < 0.55) {
    for (let guard = 0; guard < 400; guard++) {
      const terms = [];
      for (let i = 0; i < 3; i++) {
        const f = rc(rng, Object.keys(SQUARED)), ang = rc(rng, [0, 30, 45, 60, 90]);
        if (!SQUARED[f][ang] || terms.some(t => t.f === f && t.ang === ang)) { i--; continue; }
        terms.push({ f, ang, c: i === 2 ? -ri(rng, 1, 4) : ri(rng, 1, 5), v: frac(...SQUARED[f][ang]) });
      }
      const dens = [];
      for (let i = 0; i < 2; i++) {
        const f = rc(rng, ['sin', 'cos', 'tan', 'sec', 'cot']), ang = rc(rng, [30, 45, 60]);
        if (dens.some(t => t.f === f && t.ang === ang)) { i--; continue; }
        dens.push({ f, ang, c: ri(rng, 1, 4), v: frac(...SQUARED[f][ang]) });
      }
      const top = terms.reduce((s, t) => addF(s, mulF(t.v, t.c)), frac(0, 1));
      const bottom = dens.reduce((s, t) => addF(s, mulF(t.v, t.c)), frac(0, 1));
      if (bottom.n === 0 || top.n === 0) continue;
      const value = frac(top.n * bottom.d, top.d * bottom.n);
      // The hints list the standard angles; a whole-number answer equal to one
      // of them would read as if a hint had stated it.
      if (value.d === 1 && [30, 45, 60, 90].includes(Math.abs(value.n))) continue;
      const term = (t, first) => `${first ? (t.c < 0 ? '-' : '') : t.c < 0 ? ' - ' : ' + '}${Math.abs(t.c) === 1 ? '' : Math.abs(t.c)}${fnTex(t.f)}^2 ${t.ang}^\\circ`;
      const numTex = terms.map((t, i) => term(t, i === 0)).join('');
      const denTex = dens.map((t, i) => term(t, i === 0)).join('');
      return {
        prompt: `Evaluate exactly: $\\dfrac{${numTex}}{${denTex}}$.`,
        answerType: 'numeric', ...exact(value),
        hints: [
          'Replace each ratio by its exact value from the standard table for 0°, 30°, 45°, 60° and 90°.',
          'Square each value before multiplying by its coefficient — the squares are all fractions without surds.',
          'Simplify the numerator and the denominator separately, then divide.'
        ],
        steps: [
          { h: 'Squared values', d: [...terms, ...dens].map(t => `$${fnTex(t.f)}^2 ${t.ang}^\\circ = ${fracTex(t.v.n, t.v.d)}$`).join(', ') },
          { h: 'Numerator', d: `$${fracTex(top.n, top.d)}$` },
          { h: 'Denominator', d: `$${fracTex(bottom.n, bottom.d)}$` },
          { h: 'Divide', d: `$${fracTex(value.n, value.d)}$` }
        ],
        reasoning: 'expression'
      };
    }
  }
  const [alpha, beta] = rc(rng, ANGLE_PAIRS);
  const fa = rc(rng, Object.keys(EXACT_VALUE).filter(f => EXACT_VALUE[f][alpha]));
  const fb = rc(rng, Object.keys(EXACT_VALUE).filter(f => EXACT_VALUE[f][beta]));
  const A = (alpha + beta) / 2, B = (alpha - beta) / 2;
  const askA = rng() < 0.5;
  const answer = askA ? A : B;
  return {
    prompt: `If $${fnTex(fa)}(A + B) = ${EXACT_VALUE[fa][alpha][0]}$ and $${fnTex(fb)}(A - B) = ${EXACT_VALUE[fb][beta][0]}$, where $0^\\circ < A + B \\le 90^\\circ$ and $A > B$, find $${askA ? 'A' : 'B'}$ in degrees.`,
    answerType: 'numeric', answer: { value: answer }, answerSuffix: 'degrees',
    traps: traps(answer, [
      { value: askA ? B : A, why: `That is $${askA ? 'B' : 'A'}$. Adding the two equations gives $2A$; subtracting gives $2B$.` },
      { value: alpha, why: 'That is $A + B$, not a single angle.' },
      { value: beta, why: 'That is $A - B$, not a single angle.' }
    ]),
    hints: [
      'Use the standard table to turn each equation into a statement about an angle.',
      'Both $A + B$ and $A - B$ lie between $0^\\circ$ and $90^\\circ$, so each value fixes exactly one angle.',
      'That leaves a pair of linear equations in $A$ and $B$ — add or subtract them.'
    ],
    steps: [
      { h: 'First equation', d: `$${fnTex(fa)}(A + B) = ${EXACT_VALUE[fa][alpha][0]} \\Rightarrow A + B = ${alpha}^\\circ$` },
      { h: 'Second equation', d: `$${fnTex(fb)}(A - B) = ${EXACT_VALUE[fb][beta][0]} \\Rightarrow A - B = ${beta}^\\circ$` },
      { h: 'Solve the pair', d: `$2A = ${alpha + beta}^\\circ$, $2B = ${alpha - beta}^\\circ$` },
      { h: 'Answer', d: `$A = ${A}^\\circ$, $B = ${B}^\\circ$` }
    ],
    reasoning: 'angle-pair'
  };
}

// ── 11 · Circles — equal tangents from an external point ────────────────────
function tangentLengthReasoning(rng) {
  const kind = rc(rng, ['quadrilateral', 'incircle', 'kite']);
  if (kind === 'quadrilateral') {
    for (let guard = 0; guard < 200; guard++) {
      const [w, x, y, z] = [ri(rng, 2, 9), ri(rng, 2, 9), ri(rng, 2, 9), ri(rng, 2, 9)];
      const AB = w + x, BC = x + y, CD = y + z, DA = z + w;
      if ([AB, BC, CD].includes(DA)) continue;
      return {
        prompt: `A circle touches all four sides of the quadrilateral $ABCD$. If $AB = ${AB}$ cm, $BC = ${BC}$ cm and $CD = ${CD}$ cm, find $AD$.`,
        answerType: 'numeric', answer: { value: DA }, answerSuffix: 'cm',
        traps: traps(DA, [
          { value: AB + BC - CD, why: 'Pair the OPPOSITE sides: the property is $AB + CD = BC + AD$.' },
          { value: BC, why: 'The sides are not equal in general — it is the sums of opposite sides that are equal.' }
        ]),
        hints: [
          'The two tangents drawn to a circle from an external point are equal in length.',
          'Each vertex therefore contributes the same tangent length to both sides that meet there.',
          'Add the tangent lengths for $AB + CD$ and for $BC + AD$ and compare.'
        ],
        steps: [
          { h: 'Equal tangents', d: 'From each vertex the two tangent segments are equal: call them $p, q, r, s$ at $A, B, C, D$.' },
          { h: 'Sum opposite sides', d: '$AB + CD = (p + q) + (r + s) = (q + r) + (s + p) = BC + AD$' },
          { h: 'Solve', d: `$AD = ${AB} + ${CD} - ${BC} = ${DA}$ cm` }
        ],
        kind
      };
    }
  }
  if (kind === 'incircle') {
    for (let guard = 0; guard < 200; guard++) {
      const x = ri(rng, 2, 12), y = ri(rng, 2, 12), z = ri(rng, 2, 12);
      const a = y + z, b = z + x, c = x + y;
      if ([a, b, c].includes(y) || a === b || b === c || a === c) continue;
      return {
        prompt: `The incircle of $\\triangle ABC$ touches $BC$ at $D$, $CA$ at $E$ and $AB$ at $F$. If $AB = ${c}$ cm, $BC = ${a}$ cm and $CA = ${b}$ cm, find $BD$.`,
        answerType: 'numeric', answer: { value: y }, answerSuffix: 'cm',
        traps: traps(y, [
          { value: a / 2, why: 'The incircle does not touch $BC$ at its midpoint unless $AB = AC$.' },
          { value: z, why: 'That is $CD$, the tangent length from $C$.' },
          { value: x, why: 'That is $AF$, the tangent length from $A$.' }
        ]),
        hints: [
          'From each vertex the two tangents to the incircle are equal: $AF = AE$, $BF = BD$, $CD = CE$.',
          'Write each side as a sum of two of these tangent lengths.',
          'Adding $AB$ and $BC$ and subtracting $CA$ leaves twice the length you want.'
        ],
        steps: [
          { h: 'Name the tangent lengths', d: '$AF = AE = p$, $BF = BD = q$, $CD = CE = r$' },
          { h: 'Write the sides', d: `$p + q = ${c}$, $q + r = ${a}$, $r + p = ${b}$` },
          { h: 'Solve', d: `$2q = ${c} + ${a} - ${b} = ${2 * y}$, so $BD = q = ${y}$ cm` }
        ],
        kind
      };
    }
  }
  // Two tangents from T; OP ⊥ TP and OQ ⊥ TQ make TPOQ a kite of two right
  // triangles, so it combines both tangent theorems with Pythagoras.
  const [r, t, d] = (() => {
    const [p, q, h] = rc(rng, TRIPLES);
    return rng() < 0.5 ? [p, q, h] : [q, p, h];
  })();
  const askArea = rng() < 0.5;
  const answer = askArea ? r * t : 2 * (r + t);
  return {
    prompt: `From a point $T$ at a distance of $${d}$ cm from the centre $O$ of a circle of radius $${r}$ cm, tangents $TP$ and $TQ$ are drawn to the circle. Find the ${askArea ? 'area' : 'perimeter'} of the quadrilateral $TPOQ$.`,
    answerType: 'numeric', answer: { value: answer }, answerSuffix: askArea ? 'cm²' : 'cm',
    traps: traps(answer, askArea
      ? [{ value: (r * t) / 2, why: 'That is the area of ONE of the two right triangles $OPT$ and $OQT$.' }, { value: r * d, why: `$OT$ is the hypotenuse, not a side of the quadrilateral; the legs are $${r}$ and the tangent length.` }]
      : [{ value: 2 * r + 2 * d, why: '$OT$ is a diagonal of $TPOQ$, not a side. The sides are two radii and two tangents.' }, { value: r + t, why: 'That is half the perimeter — there are two radii and two tangents.' }]),
    hints: [
      'The radius to the point of contact is perpendicular to the tangent, so $\\triangle OPT$ is right-angled at $P$.',
      'Find the tangent length $TP$ by Pythagoras; $TQ$ is equal to it.',
      askArea ? 'The quadrilateral is made of two congruent right triangles.' : 'The sides of $TPOQ$ are $TP$, $PO$, $OQ$ and $QT$.'
    ],
    steps: [
      { h: 'Right angle at P', d: '$OP \\perp TP$' },
      { h: 'Tangent length', d: `$TP = \\sqrt{${d}^2 - ${r}^2} = ${t}$ cm, and $TQ = TP$` },
      askArea
        ? { h: 'Area', d: `$2 \\times \\dfrac{1}{2} \\times ${r} \\times ${t} = ${answer}$ cm²` }
        : { h: 'Perimeter', d: `$2(${r}) + 2(${t}) = ${answer}$ cm` }
    ],
    kind
  };
}

// ── 12 · Sectors — perimeter or area given, the rest recovered ──────────────
const SECTOR_ANGLES = [18, 30, 36, 40, 45, 54, 60, 72, 80, 90, 100, 108, 120, 135, 140, 144, 150, 160, 210, 240, 270];

function sectorReasoning(rng) {
  if (rng() < 0.3) {
    // A clock's minute hand: the angle has to be worked out from the time first.
    for (let guard = 0; guard < 400; guard++) {
      const r = rc(rng, [7, 10, 12, 14, 15, 18, 21, 28, 35]), t = ri(rng, 5, 55);
      const area = frac(22 * 6 * t * r * r, 7 * 360);       // θ = 6t degrees
      if (t % 15 === 0) continue;
      const arc = frac(44 * 6 * t * r, 7 * 360);
      const askArc = rng() < 0.4;
      const ans = askArc ? arc : area;
      return {
        prompt: `The minute hand of a clock is $${r}$ cm long. Find the ${askArc ? 'distance travelled by its tip' : 'area swept by it'} in $${t}$ minutes. ${PI_NOTE}`,
        answerType: 'numeric', ...exact(ans, askArc ? 'cm' : 'cm²'),
        traps: traps(ans.value, [
          { value: askArc ? frac(44 * t * r, 7 * 360).value : frac(22 * t * r * r, 7 * 360).value, why: `In ${t} minutes the hand turns through $6^\\circ$ per minute, not $1^\\circ$ per minute.` },
          { value: askArc ? area.value : arc.value, why: askArc ? 'That is the area swept, not the distance moved by the tip.' : 'That is the length of the arc, not the area.' }
        ]),
        hints: [
          'The minute hand turns through $360^\\circ$ in 60 minutes, so find the angle it turns through first.',
          'The hand sweeps out a sector whose radius is the length of the hand.',
          askArc ? 'The tip moves along the arc: arc length $= \\dfrac{\\theta}{360^\\circ} \\times 2\\pi r$.' : 'Area of a sector $= \\dfrac{\\theta}{360^\\circ}\\pi r^2$.'
        ],
        steps: [
          { h: 'Angle turned', d: `$${t} \\times 6^\\circ = ${6 * t}^\\circ$` },
          { h: 'Sector', d: `radius $${r}$ cm, angle $${6 * t}^\\circ$` },
          askArc
            ? { h: 'Arc length', d: `$\\dfrac{${6 * t}}{360} \\times 2 \\times \\dfrac{22}{7} \\times ${r} = ${fracTex(arc.n, arc.d)}$ cm` }
            : { h: 'Area', d: `$\\dfrac{${6 * t}}{360} \\times \\dfrac{22}{7} \\times ${r * r} = ${fracTex(area.n, area.d)}$ cm²` }
        ],
        reasoning: 'minute-hand'
      };
    }
  }
  for (let guard = 0; guard < 400; guard++) {
    const theta = rc(rng, SECTOR_ANGLES);
    const ks = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].filter(k => (k * theta) % 90 === 0);
    if (!ks.length) continue;
    const k = rc(rng, ks), r = 7 * k;
    const arc = (11 * k * theta) / 90;            // θ/360 · 2 · 22/7 · 7k
    if (rng() < 0.5) {
      const P = arc + 2 * r;
      const area = frac(r * arc, 2);
      return {
        prompt: `The perimeter of a sector of a circle of radius $${r}$ cm is $${P}$ cm. Find the area of the sector. ${PI_NOTE}`,
        answerType: 'numeric', ...exact(area, 'cm²'),
        traps: traps(area.value, [
          { value: (r * P) / 2, why: 'The perimeter includes the two radii. Subtract them to get the arc before using it.' },
          { value: (22 * r * r) / 7, why: 'That is the area of the whole circle.' }
        ]),
        hints: [
          'The perimeter of a sector is its arc plus two radii.',
          'Use the arc length to find the angle of the sector (or go straight to the area).',
          'Area of a sector $= \\dfrac{\\theta}{360^\\circ}\\pi r^2$, which also equals $\\dfrac{1}{2} \\times \\text{arc} \\times r$.'
        ],
        steps: [
          { h: 'Arc length', d: `$${P} - 2(${r}) = ${arc}$ cm` },
          { h: 'Angle', d: `$\\dfrac{\\theta}{360} \\times 2 \\times \\dfrac{22}{7} \\times ${r} = ${arc}$, so $\\theta = ${theta}^\\circ$` },
          { h: 'Area', d: `$\\dfrac{${theta}}{360} \\times \\dfrac{22}{7} \\times ${r * r} = ${fracTex(area.n, area.d)}$ cm²` }
        ],
        reasoning: 'from-perimeter'
      };
    }
    const area = frac(22 * theta * r * r, 7 * 360);
    if (area.d !== 1) continue;
    const askArc = rng() < 0.6;
    const arcF = frac(11 * k * theta, 90);
    if (askArc && [area.value, r].includes(arcF.value)) continue;
    return {
      prompt: `A sector of a circle of radius $${r}$ cm has an area of $${area.value}$ cm². Find ${askArc ? 'the length of its arc' : 'the angle of the sector, in degrees'}. ${PI_NOTE}`,
      answerType: 'numeric', ...(askArc ? exact(arcF, 'cm') : { answer: { value: theta }, answerSuffix: 'degrees' }),
      traps: traps(askArc ? arcF.value : theta, askArc
        ? [{ value: (2 * area.value) / r + 2 * r, why: 'That is the perimeter of the sector — the arc plus two radii.' }]
        : [{ value: Math.round((360 * area.value) / (r * r)), why: 'The formula needs $\\pi r^2$, not $r^2$.' }]),
      hints: [
        'Area of a sector $= \\dfrac{\\theta}{360^\\circ}\\pi r^2$.',
        'Substitute the area and the radius and solve for $\\theta$.',
        askArc ? 'Then arc length $= \\dfrac{\\theta}{360^\\circ} \\times 2\\pi r$ — or use area $= \\dfrac{1}{2} \\times \\text{arc} \\times r$.' : 'Check that the angle you get is less than $360^\\circ$.'
      ],
      steps: [
        { h: 'Set up', d: `$\\dfrac{\\theta}{360} \\times \\dfrac{22}{7} \\times ${r * r} = ${area.value}$` },
        { h: 'Angle', d: `$\\theta = ${theta}^\\circ$` },
        askArc
          ? { h: 'Arc length', d: `$\\dfrac{${theta}}{360} \\times 2 \\times \\dfrac{22}{7} \\times ${r} = ${fracTex(arcF.n, arcF.d)}$ cm` }
          : { h: 'Check', d: `$${theta}^\\circ$ is less than $360^\\circ$, so a sector with this area exists.` }
      ],
      reasoning: 'from-area'
    };
  }
  return sectorReasoning(makeRng(FALLBACK_SEED));
}

// ── 13 · Volumes of combined solids — a dimension derived first ─────────────
// All three use π = 22/7 and a radius that is a multiple of 7, and the height
// or length is chosen so the volume is a whole number of cm³.
function volumeComboReasoning(rng) {
  const kind = rc(rng, ['cone-hemisphere', 'cylinder-scooped', 'capsule']);
  for (let guard = 0; guard < 400; guard++) {
    const r = 7 * ri(rng, 1, 3);
    if (kind === 'cone-hemisphere') {
      const H = r + ri(rng, 1, 3 * r);                      // V = 22 r² (H + r) / 21
      const V = frac(22 * r * r * (H + r), 21);
      if (V.d !== 1) continue;
      return {
        prompt: `A solid toy is in the form of a hemisphere of radius $${r}$ cm surmounted by a right circular cone of the same radius. The total height of the toy is $${H}$ cm. Find the volume of the toy. ${PI_NOTE}`,
        answerType: 'numeric', answer: { value: V.value }, answerSuffix: 'cm³',
        traps: traps(V.value, [
          { value: (22 * r * r * (H + 2 * r)) / 21, why: `The cone's height is the total height minus the radius of the hemisphere, $${H} - ${r}$, not the total height.` },
          { value: (22 * r * r * (H - r)) / 21, why: 'That is the cone alone; add the hemisphere.' }
        ]),
        hints: [
          'The hemisphere takes up $r$ of the total height, so the cone\'s height is what is left.',
          'Volume of a cone $= \\dfrac{1}{3}\\pi r^2 h$; volume of a hemisphere $= \\dfrac{2}{3}\\pi r^3$.',
          'Add the two volumes — factorising out $\\dfrac{1}{3}\\pi r^2$ keeps the arithmetic short.'
        ],
        steps: [
          { h: 'Cone height', d: `$h = ${H} - ${r} = ${H - r}$ cm` },
          { h: 'Add the volumes', d: `$\\dfrac{1}{3}\\pi r^2 h + \\dfrac{2}{3}\\pi r^3 = \\dfrac{1}{3}\\pi r^2 (h + 2r)$` },
          { h: 'Substitute', d: `$\\dfrac{1}{3} \\times \\dfrac{22}{7} \\times ${r * r} \\times ${H + r} = ${V.value}$ cm³` }
        ],
        kind
      };
    }
    if (kind === 'cylinder-scooped') {
      const h = 2 * r + ri(rng, 1, 3 * r);                  // V = 22 r² (3h − 4r) / 21
      const V = frac(22 * r * r * (3 * h - 4 * r), 21);
      if (V.d !== 1) continue;
      return {
        prompt: `A wooden article is made by scooping out a hemisphere of radius $${r}$ cm from each end of a solid cylinder of radius $${r}$ cm and height $${h}$ cm. Find the volume of wood left in the article. ${PI_NOTE}`,
        answerType: 'numeric', answer: { value: V.value }, answerSuffix: 'cm³',
        traps: traps(V.value, [
          { value: (22 * r * r * (3 * h - 2 * r)) / 21, why: 'Two hemispheres are removed — one from each end — which together make a whole sphere.' },
          { value: (22 * r * r * h) / 7, why: 'That is the cylinder before anything is scooped out.' }
        ]),
        hints: [
          'Removing material subtracts volume.',
          'The two hemispheres removed together make one sphere of the same radius.',
          'Volume left $= \\pi r^2 h - \\dfrac{4}{3}\\pi r^3$.'
        ],
        steps: [
          { h: 'Cylinder', d: `$\\pi r^2 h = \\dfrac{22}{7} \\times ${r * r} \\times ${h} = ${frac(22 * r * r * h, 7).value}$ cm³` },
          { h: 'Two hemispheres', d: `$\\dfrac{4}{3}\\pi r^3 = ${fracTex(88 * r * r * r, 21)}$ cm³` },
          { h: 'Subtract', d: `$${V.value}$ cm³` }
        ],
        kind
      };
    }
    const L = 2 * r + ri(rng, 1, 4 * r);                    // V = 22 r² (3L − 2r) / 21
    const V = frac(22 * r * r * (3 * L - 2 * r), 21);
    if (V.d !== 1) continue;
    return {
      prompt: `A capsule is in the shape of a cylinder with a hemisphere of the same radius at each end. Its radius is $${r}$ mm and its total length, end to end, is $${L}$ mm. Find its volume. ${PI_NOTE}`,
      answerType: 'numeric', answer: { value: V.value }, answerSuffix: 'mm³',
      traps: traps(V.value, [
        { value: (22 * r * r * (3 * L + 4 * r)) / 21, why: `The cylinder's length is the total length minus the two hemispherical ends: $${L} - 2(${r})$.` },
        { value: (22 * r * r * L) / 7, why: 'That treats the whole capsule as a cylinder; the rounded ends hold less.' }
      ]),
      hints: [
        'The two hemispherical ends take up $2r$ of the total length, so the cylinder is shorter than the capsule.',
        'The two hemispheres together form one sphere.',
        'Volume $= \\pi r^2 \\ell + \\dfrac{4}{3}\\pi r^3$, where $\\ell$ is the length of the cylinder.'
      ],
      steps: [
        { h: 'Cylinder length', d: `$\\ell = ${L} - 2(${r}) = ${L - 2 * r}$ mm` },
        { h: 'Cylinder', d: `$\\dfrac{22}{7} \\times ${r * r} \\times ${L - 2 * r} = ${frac(22 * r * r * (L - 2 * r), 7).value}$ mm³` },
        { h: 'Sphere', d: `$\\dfrac{4}{3} \\times \\dfrac{22}{7} \\times ${r * r * r} = ${fracTex(88 * r * r * r, 21)}$ mm³` },
        { h: 'Total', d: `$${V.value}$ mm³` }
      ],
      kind
    };
  }
  return volumeComboReasoning(makeRng(FALLBACK_SEED));
}

// ── 14 · Mean of grouped data — the missing frequency ───────────────────────
function classTable(rng) {
  const width = rc(rng, [10, 20]);
  const start = width * ri(rng, 0, 4);
  const count = 5;
  const classes = Array.from({ length: count }, (_, i) => [start + i * width, start + (i + 1) * width]);
  return { width, classes, marks: classes.map(([l, u]) => (l + u) / 2) };
}
const tableText = (classes, freqs) => classes.map(([l, u], i) => `$${l}$–$${u}$: $${freqs[i]}$`).join(', ');

function groupedMeanReasoning(rng) {
  const two = rng() < 0.45;
  for (let guard = 0; guard < 800; guard++) {
    const { classes, marks } = classTable(rng);
    const f = classes.map(() => ri(rng, 2, 16));
    if (!two) {
      const i = ri(rng, 0, 4);
      const N = f.reduce((s, v) => s + v, 0);
      const S = f.reduce((s, v, j) => s + v * marks[j], 0);
      const mean = frac(S, N);
      if (!twoPlaces(mean) || mean.value === marks[i] || mean.value === f[i]) continue;
      const shown = f.map((v, j) => (j === i ? 'f' : v));
      const Sx = S - f[i] * marks[i], Nx = N - f[i];
      const meanText = decimalText(mean);
      return {
        prompt: `The mean of the following grouped frequency distribution is $${meanText}$. Find the missing frequency $f$. — ${tableText(classes, shown)}.`,
        answerType: 'numeric', answer: { value: f[i] },
        traps: traps(f[i], [
          { value: Math.round(N / 5), why: 'The missing frequency is fixed by the mean, not by an average of the other frequencies.' }
        ]),
        hints: [
          'Use the class marks (midpoints) as the values $x_i$.',
          `Write $\\sum f_i x_i$ and $\\sum f_i$ with $f$ left in them, and set $\\dfrac{\\sum f_i x_i}{\\sum f_i} = ${meanText}$.`,
          'That is a linear equation in $f$ — the assumed-mean or step-deviation method keeps the numbers smaller if you prefer.'
        ],
        steps: [
          { h: 'Class marks', d: `$${marks.join(',\\ ')}$` },
          { h: 'Sums with f', d: `$\\sum f_i = ${Nx} + f$, $\\sum f_i x_i = ${Sx} + ${marks[i]}f$` },
          { h: 'Set up', d: `$\\dfrac{${Sx} + ${marks[i]}f}{${Nx} + f} = ${meanText}$` },
          { h: 'Solve', d: `$f = ${f[i]}$` }
        ],
        unknowns: 1
      };
    }
    // Two missing frequencies, the total and the mean both given: a pair of
    // linear equations inside a statistics question.
    const i = ri(rng, 0, 3), j = ri(rng, i + 1, 4);
    const N = f.reduce((s, v) => s + v, 0);
    const S = f.reduce((s, v, k) => s + v * marks[k], 0);
    const mean = frac(S, N);
    if (!twoPlaces(mean) || f[i] === f[j]) continue;
    const shown = f.map((v, k) => (k === i ? 'p' : k === j ? 'q' : v));
    const ask = rng() < 0.5 ? 'p' : 'q';
    const answer = ask === 'p' ? f[i] : f[j];
    const meanText = decimalText(mean);
    if (answer === N || answer === mean.value) continue;
    const Nrest = N - f[i] - f[j], Srest = S - f[i] * marks[i] - f[j] * marks[j];
    return {
      prompt: `The following distribution has $${N}$ observations in all and its mean is $${meanText}$. Find the value of $${ask}$. — ${tableText(classes, shown)}.`,
      answerType: 'numeric', answer: { value: answer },
      traps: traps(answer, [
        { value: ask === 'p' ? f[j] : f[i], why: `That is $${ask === 'p' ? 'q' : 'p'}$. Both come out of the pair — read off the one the question asks for.` },
        { value: N - Nrest, why: '$p + q$ is fixed by the total, but that is the SUM of the two missing frequencies.' }
      ]),
      hints: [
        'The total number of observations gives one equation in $p$ and $q$.',
        'The mean gives a second: $\\dfrac{\\sum f_i x_i}{\\sum f_i}$ with the class marks as $x_i$.',
        'Solve the pair of linear equations.'
      ],
      steps: [
        { h: 'Total', d: `$${Nrest} + p + q = ${N}$, so $p + q = ${N - Nrest}$` },
        { h: 'Mean', d: `$${Srest} + ${marks[i]}p + ${marks[j]}q = ${meanText} \\times ${N} = ${S}$` },
        { h: 'Solve the pair', d: `$p = ${f[i]}$, $q = ${f[j]}$` }
      ],
      unknowns: 2
    };
  }
  return groupedMeanReasoning(makeRng(FALLBACK_SEED));
}

// ── 15 · Mode of grouped data — a neighbouring frequency recovered ──────────
function modeOf(classes, freqs, h) {
  const top = Math.max(...freqs);
  const at = freqs.map((v, i) => (v === top ? i : -1)).filter(i => i >= 0);
  if (at.length !== 1) return null;
  const i = at[0];
  const f1 = freqs[i], f0 = i > 0 ? freqs[i - 1] : 0, f2 = i < freqs.length - 1 ? freqs[i + 1] : 0;
  const den = 2 * f1 - f0 - f2;
  if (den === 0) return null;
  return { i, value: frac(classes[i][0] * den + (f1 - f0) * h, den) };
}

function groupedModeReasoning(rng) {
  for (let guard = 0; guard < 800; guard++) {
    const { width, classes } = classTable(rng);
    const i = ri(rng, 1, 3);
    const f = classes.map(() => ri(rng, 2, 14));
    f[i] = Math.max(...f.filter((_, k) => k !== i)) + ri(rng, 1, 6);
    const unknown = rng() < 0.5 ? i - 1 : i + 1;
    const mode = modeOf(classes, f, width);
    if (!mode || mode.i !== i || !twoPlaces(mode.value)) continue;
    // The stated mode must pin the frequency down: no other value of it may
    // produce the same mode, whichever class that value makes modal.
    let matches = 0;
    for (let x = 0; x <= 60; x++) {
      const g = f.slice(); g[unknown] = x;
      const m = modeOf(classes, g, width);
      if (m && m.value.n === mode.value.n && m.value.d === mode.value.d) matches++;
    }
    if (matches !== 1 || mode.value.n === f[unknown] * mode.value.d) continue;
    const shown = f.map((v, k) => (k === unknown ? 'x' : v));
    const modeText = decimalText(mode.value);
    const f0 = f[i - 1], f2 = f[i + 1];
    return {
      prompt: `The mode of the following distribution is $${modeText}$. Find the missing frequency $x$. — ${tableText(classes, shown)}.`,
      answerType: 'numeric', answer: { value: f[unknown] },
      traps: traps(f[unknown], [
        { value: f[i], why: 'That is the frequency of the modal class itself, which is known.' },
        { value: unknown === i - 1 ? f2 : f0, why: 'That is the frequency of the class on the OTHER side of the modal class.' }
      ]),
      hints: [
        `The mode lies in the modal class, so the class containing $${modeText}$ is the modal class.`,
        '$\\text{Mode} = l + \\dfrac{f_1 - f_0}{2f_1 - f_0 - f_2} \\times h$.',
        `The unknown $x$ is ${unknown === i - 1 ? '$f_0$, the class before' : '$f_2$, the class after'} the modal class — substitute everything else and solve the linear equation.`
      ],
      steps: [
        { h: 'Modal class', d: `$${classes[i][0]}$–$${classes[i][1]}$, so $l = ${classes[i][0]}$, $h = ${width}$, $f_1 = ${f[i]}$` },
        { h: 'Substitute', d: unknown === i - 1
          ? `$${modeText} = ${classes[i][0]} + \\dfrac{${f[i]} - x}{${2 * f[i]} - x - ${f2}} \\times ${width}$`
          : `$${modeText} = ${classes[i][0]} + \\dfrac{${f[i] - f0}}{${2 * f[i] - f0} - x} \\times ${width}$` },
        { h: 'Solve', d: `$x = ${f[unknown]}$` }
      ]
    };
  }
  return groupedModeReasoning(makeRng(FALLBACK_SEED));
}

// ── 16 · Probability — classical definition with counting or algebra ────────
const PRIMES = new Set([2, 3, 5, 7, 11]);
/** Ways two dice sum to s: 6 − |s − 7| for 2 ≤ s ≤ 12. */
const sumWays = s => (s >= 2 && s <= 12 ? 6 - Math.abs(s - 7) : 0);

function probabilityReasoning(rng) {
  if (rng() < 0.55) {
    const event = rc(rng, ['prime', 'multiple', 'difference', 'face', 'face', 'product', 'sum-at-least', 'sum-less-than']);
    let text, favourable, how;
    if (event === 'prime') {
      text = 'the sum of the two numbers is a prime number';
      favourable = [...PRIMES].reduce((s, p) => s + sumWays(p), 0);
      how = 'Sums $2, 3, 5, 7, 11$ occur in $1, 2, 4, 6, 2$ ways.';
    } else if (event === 'multiple') {
      const k = rc(rng, [3, 4, 5]);
      text = `the sum of the two numbers is a multiple of $${k}$`;
      const sums = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].filter(s => s % k === 0);
      favourable = sums.reduce((s, v) => s + sumWays(v), 0);
      how = `Sums $${sums.join(', ')}$ occur in $${sums.map(sumWays).join(', ')}$ ways.`;
    } else if (event === 'difference') {
      const m = ri(rng, 1, 4);
      text = `the two numbers differ by exactly $${m}$`;
      favourable = 2 * (6 - m);
      how = `For each of the $${6 - m}$ ordered pairs with the first number larger, there is a mirror pair.`;
    } else if (event === 'face') {
      const k = ri(rng, 1, 6), kind = rc(rng, ['at least one', 'exactly one', 'neither']);
      text = kind === 'neither' ? `neither die shows a $${k}$` : `${kind} of the dice shows a $${k}$`;
      favourable = kind === 'neither' ? 25 : kind === 'exactly one' ? 10 : 11;
      how = kind === 'neither'
        ? `Each die avoids $${k}$ in 5 ways: $5 \\times 5 = 25$ outcomes.`
        : kind === 'exactly one'
          ? `The first die shows $${k}$ and the second does not (5 ways), or the other way round (5 ways).`
          : `Neither die shows $${k}$ in $5 \\times 5 = 25$ outcomes; the other $11$ have at least one $${k}$.`;
    } else if (event === 'product') {
      const even = rng() < 0.5;
      text = `the product of the two numbers is ${even ? 'even' : 'odd'}`;
      favourable = even ? 27 : 9;
      how = even ? 'The product is odd only when both numbers are odd ($3 \\times 3 = 9$ outcomes); the other $27$ are even.' : 'Both numbers must be odd: $3 \\times 3 = 9$ outcomes.';
    } else if (event === 'sum-less-than') {
      const s = ri(rng, 4, 7);
      const sums = [2, 3, 4, 5, 6].filter(v => v < s);
      text = `the sum of the two numbers is less than $${s}$`;
      favourable = sums.reduce((t, v) => t + sumWays(v), 0);
      how = `Sums $${sums.join(', ')}$ occur in $${sums.map(sumWays).join(', ')}$ ways.`;
    } else {
      const s = ri(rng, 8, 11);
      text = `the sum of the two numbers is at least $${s}$`;
      favourable = [8, 9, 10, 11, 12].filter(v => v >= s).reduce((t, v) => t + sumWays(v), 0);
      how = `Sums from $${s}$ to $12$ occur in $${[8, 9, 10, 11, 12].filter(v => v >= s).map(sumWays).join(', ')}$ ways.`;
    }
    const p = frac(favourable, 36);
    return {
      prompt: `Two dice are thrown at the same time. Find the probability that ${text}.`,
      answerType: 'numeric', ...exact(p),
      traps: traps(p.value, [
        { value: frac(36 - favourable, 36).value, why: 'That is the probability that the event does NOT happen.' },
        { value: frac(favourable, 6).value <= 1 ? frac(favourable, 6).value : frac(favourable, 12).value, why: 'Two dice give $6 \\times 6 = 36$ equally likely ordered outcomes — the denominator is 36, not 6 or 12.' }
      ]),
      hints: [
        'The equally likely outcomes are the 36 ordered pairs $(a, b)$, with $a$ on the first die and $b$ on the second.',
        'List or count the pairs that satisfy the condition — a $6 \\times 6$ grid helps.',
        'Probability $= \\dfrac{\\text{favourable outcomes}}{36}$, reduced to lowest terms.'
      ],
      steps: [
        { h: 'Sample space', d: '$6 \\times 6 = 36$ equally likely outcomes' },
        { h: 'Count', d: `${how} Total favourable: $${favourable}$` },
        { h: 'Probability', d: `$\\dfrac{${favourable}}{36} = ${fracTex(p.n, p.d)}$` }
      ],
      reasoning: 'two-dice'
    };
  }
  // Balls added to a bag change the probability; the two probabilities fix the
  // contents. x/N = a/b and (x + k)/(N + k) = c/d.
  for (let guard = 0; guard < 400; guard++) {
    const b = ri(rng, 3, 9), a = ri(rng, 1, b - 1);
    if (gcd(a, b) !== 1) continue;
    const t = ri(rng, 2, 6), k = ri(rng, 2, 12);
    const N = b * t, x = a * t;
    const after = frac(x + k, N + k);
    if (after.d === 1) continue;
    const colour = rc(rng, ['red', 'green', 'white']);
    if ([a, b, k, after.n, after.d].includes(x)) continue;
    return {
      prompt: `A bag contains only ${colour} and blue balls. The probability of drawing a ${colour} ball at random is $\\dfrac{${a}}{${b}}$. When $${k}$ more ${colour} balls are put into the bag, the probability of drawing a ${colour} ball becomes $\\dfrac{${after.n}}{${after.d}}$. How many ${colour} balls were in the bag at first?`,
      answerType: 'numeric', answer: { value: x },
      traps: traps(x, [
        { value: N, why: 'That is the total number of balls at first, not the number of ' + colour + ' ones.' },
        { value: x + k, why: `That is the number of ${colour} balls AFTER the extra ${k} were added.` },
        { value: a, why: `A probability of $\\dfrac{${a}}{${b}}$ fixes the RATIO of ${colour} balls to all balls, not the count.` }
      ]),
      hints: [
        `Let there be $x$ ${colour} balls and $n$ balls in all at first.`,
        'Each probability gives a linear equation in $x$ and $n$ once you cross-multiply.',
        'Solve the pair of equations.'
      ],
      steps: [
        { h: 'At first', d: `$\\dfrac{x}{n} = \\dfrac{${a}}{${b}}$, so $${b}x = ${a}n$` },
        { h: 'After adding', d: `$\\dfrac{x + ${k}}{n + ${k}} = \\dfrac{${after.n}}{${after.d}}$, so $${after.d}(x + ${k}) = ${after.n}(n + ${k})$` },
        { h: 'Solve', d: `$n = ${N}$ and $x = ${x}$` }
      ],
      reasoning: 'bag-algebra'
    };
  }
  return probabilityReasoning(makeRng(FALLBACK_SEED));
}

/** One rung, D3: every other rung returns the same form (see the header). */
const d3 = form => (rng, _diff) => form(rng);

export const class10HardestForms = Object.freeze({
  'c10-polynomial-zeroes-reasoning': d3(polynomialZeroesGrouping),
  'c10-linear-pair-situations-reasoning': d3(linearPairSituations),
  'c10-quadratic-factorisation-reasoning': d3(quadraticFactorRearranged),
  'c10-ap-sum-reasoning': d3(apSumReasoning),
  'c10-ap-daily-life-reasoning': d3(apDailyLifeReasoning),
  'c10-bpt-reasoning': d3(bptReasoning),
  'c10-distance-reasoning': d3(distanceReasoning),
  'c10-section-reasoning': d3(sectionReasoning),
  'c10-trig-ratio-reasoning': d3(trigRatioReasoning),
  'c10-trig-standard-reasoning': d3(trigStandardReasoning),
  'c10-tangent-length-reasoning': d3(tangentLengthReasoning),
  'c10-sector-reasoning': d3(sectorReasoning),
  'c10-volume-combination-reasoning': d3(volumeComboReasoning),
  'c10-grouped-mean-reasoning': d3(groupedMeanReasoning),
  'c10-grouped-mode-reasoning': d3(groupedModeReasoning),
  'c10-probability-reasoning': d3(probabilityReasoning)
});
