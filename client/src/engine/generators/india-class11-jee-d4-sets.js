// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · NCERT Class 11 Sets — JEE D4 forms, one per dot point
//
// The JEE Main and JEE Advanced tracks reached the hardest level (D4) of Sets
// through the whole-chapter generator, whose D4 rung was one routine template:
// "how many proper subsets / k-element subsets does an n-set have" — a single
// formula, and about the first dot point only. That rung is retired (issue
// #408); the three forms below replace it, one per dot point. Each one joins
// at least two separate ideas, so the step up from the chapter's D3 (a
// three-set survey read straight off the formula) is in the reasoning, not in
// the size of the numbers:
//
//   0 · Notation, subsets, power sets — the sets are given in set-builder
//       form and must be listed first; then
//       · sandwich: A ⊆ X ⊆ B is a free choice of a subset of B − A, joined
//         to a size condition AND "at least one element with a property A
//         lacks" (by complement), a parity split with A and B themselves
//         excluded, or "exactly j elements with a property" where the ones
//         inside A are forced in;
//       · pairs: ordered pairs (X, Y) of subsets with X ⊆ Y or X ∩ Y = ∅ —
//         three states per element — joined to casework on n(X) + n(Y), a
//         size condition on n(Y − X), or the removal of empty members or of
//         X = Y;
//       · collections: subsets 𝒮 of P(A) — the allowed members counted
//         first, then collections of them with at least two members; P(A)
//         split into complementary pairs {X, A − X} with three choices per
//         pair; or exactly k members whose union is A, by inclusion–exclusion
//         over the elements missed.
//       An independent review (2026-10-22) judged three earlier variants
//       single-formula D3 — ∅ and A forced into 𝒮, k non-empty members, and
//       X ⊆ Y with n(Y) = k — and they were replaced by the ones above.
//   1 · Operations — two archetypes:
//       · extremal: given n(U), n(A), n(B) and a condition on n((A ∪ B)′),
//         every region is a function of the overlap n(A ∩ B); the condition
//         and the containment bound fix its range, and the target (exactly
//         one, A − B, …) is read at the binding end, which is attained;
//       · subset count: conditions on X such as X ∩ A = X ∩ B, X ∩ A ≠ ∅ with
//         X ∩ B = ∅, or X ∩ A = ∅ with X ∪ B = U are rewritten through the
//         operations (symmetric difference, complement) into "these elements
//         are forced in / out, the rest are free", then counted.
//   2 · Inclusion–exclusion on three sets — two archetypes:
//       · exactly: counting with multiplicity, n(A) + n(B) + n(C) =
//         E₁ + 2E₂ + 3E₃, joined to the total E₁ + E₂ + E₃ (from the number in
//         none) to recover "exactly one", "exactly two", "all three" or
//         "none" from partial data;
//       · least: the least possible number in all three (and the greatest
//         number in exactly two) from the singles alone — a bound from
//         E₁ ≥ 0 and an explicit Venn diagram that attains it.
//   The "integers divisible by a, b or c" archetype is deliberately not used
//   (it already appears elsewhere in the bank).
//
// Scope is NCERT Class 11 Sets as JEE Main 2026 / JEE Advanced 2026 examine
// it: set-builder and roster notation, subsets, power sets, the universal set,
// the operations and complements, and n(A ∪ B ∪ C). Only nCr is borrowed, as
// every JEE candidate meets it in the same year.
//
// Provenance. Original, parameterised forms written for Pri Learning; not
// transcribed from NCERT exercises, the exemplar or past papers. Every keyed
// answer is computed from the drawn parameters, never typed, and
// client/test/support/india-jee-d4-sets-solvers.mjs re-derives each one from
// the rendered prompt by brute-force enumeration (of subsets, of pairs of
// subsets, of collections of subsets, of Venn-region counts). No human maths
// review yet; no board or examiner approval is claimed.
//
// Asked for any rung other than D4, each generator returns its D4 form.
// ─────────────────────────────────────────────────────────────────────────────
import { ri, rc, makeRng } from '../qhelpers.js';
import { traps as keepTraps, IN_CITIES } from './india-native-helpers.js';

/** Traps, keeping only positive whole counts (a count of sets is never 0 or negative here). */
const traps = (value, list) => keepTraps(value, list.filter(t => Number.isInteger(t.value) && t.value > 0));

const FALLBACK_SEED = 0x53455453;   // "SETS"

// ── Counting ─────────────────────────────────────────────────────────────────
const nCr = (n, r) => {
  if (r < 0 || r > n) return 0;
  let out = 1;
  for (let i = 1; i <= r; i++) out = (out * (n - r + i)) / i;
  return Math.round(out);
};
const range = (lo, hi) => Array.from({ length: hi - lo + 1 }, (_, i) => lo + i);
const rosterTex = els => (els.length ? `\\{${els.join(', ')}\\}` : '\\emptyset');
const pl = (n, one, many) => (n === 1 ? one : many);
/** 2^e as it is written: 1, 2, 2^{3}. */
const p2 = e => (e === 0 ? '1' : e === 1 ? '2' : `2^{${e}}`);
/** "each of the other $3$ elements" / "the other element". */
const eachOther = n => (n === 1 ? 'the other element' : `each of the other $${n}$ elements`);

// ── Sets in set-builder form ─────────────────────────────────────────────────
// Each returns { tex, els } with els in increasing order.
const divisors = n => range(1, n).filter(d => n % d === 0);
const SB = {
  div: n => ({ tex: `\\{x \\in \\mathbb{N} : x \\text{ divides } ${n}\\}`, els: divisors(n) }),
  le: n => ({ tex: `\\{x \\in \\mathbb{N} : x \\le ${n}\\}`, els: range(1, n) }),
  sq: (strict, c) => ({
    tex: `\\{x \\in \\mathbb{Z} : x^2 ${strict ? '<' : '\\le'} ${c}\\}`,
    els: range(-10, 10).filter(x => (strict ? x * x < c : x * x <= c))
  }),
  abs: (h, r) => ({ tex: `\\{x \\in \\mathbb{Z} : |x - ${h}| \\le ${r}\\}`, els: range(h - r, h + r) }),
  cube: () => ({ tex: '\\{x \\in \\mathbb{Z} : x^3 = x\\}', els: [-1, 0, 1] })
};

const isPrime = n => n >= 2 && range(2, Math.floor(Math.sqrt(n))).every(d => n % d !== 0);

/** Properties of a number, phrased for "has exactly j elements that are …". */
const PROPS = {
  even: { one: 'even', many: 'even', test: x => x % 2 === 0 },
  odd: { one: 'odd', many: 'odd', test: x => Math.abs(x % 2) === 1 },
  prime: { one: 'prime', many: 'prime', test: isPrime },
  mult3: { one: 'a multiple of $3$', many: 'multiples of $3$', test: x => x % 3 === 0 },
  mult4: { one: 'a multiple of $4$', many: 'multiples of $4$', test: x => x % 4 === 0 },
  mult5: { one: 'a multiple of $5$', many: 'multiples of $5$', test: x => x % 5 === 0 },
  negative: { one: 'negative', many: 'negative', test: x => x < 0 },
  positive: { one: 'positive', many: 'positive', test: x => x > 0 }
};

// ═════════════════════════════════════════════════════════════════════════════
// 0 · Set notation, subsets, power sets and the universal set
// ═════════════════════════════════════════════════════════════════════════════

const DIV_N = [12, 18, 20, 24, 28, 30, 36, 40, 42, 44, 45, 48, 50, 52, 54, 56, 63, 66, 70, 75, 80, 88];

/** A ⊊ B, both in set-builder form, with n(B) ≤ 10. Natural-number pairs get natural properties. */
function sandwichPair(rng) {
  const fam = rc(rng, ['div', 'div', 'sq', 'le-div', 'le-abs']);
  if (fam === 'div') {
    const N = rc(rng, DIV_N);
    const d = rc(rng, divisors(N).filter(x => x > 1 && x < N));
    return { A: SB.div(d), B: SB.div(N), natural: true };
  }
  if (fam === 'sq') {
    const B = SB.sq(rng() < 0.5, ri(rng, 4, 24));
    const A = SB.sq(rng() < 0.5, ri(rng, 1, 15));
    return { A, B, natural: false };
  }
  if (fam === 'le-div') {
    const n = ri(rng, 6, 10);
    return { A: SB.div(ri(rng, 4, n)), B: SB.le(n), natural: true };
  }
  const n = ri(rng, 7, 10), r = ri(rng, 1, 2), h = ri(rng, r + 1, n - r);
  return { A: SB.abs(h, r), B: SB.le(n), natural: true };
}

function sandwich(rng) {
  const cond = rc(rng, ['size', 'parity', 'prop']);
  for (let guard = 0; guard < 400; guard++) {
    const { A, B, natural } = sandwichPair(rng);
    const nA = A.els.length, nB = B.els.length;
    if (!A.els.every(x => B.els.includes(x)) || nB > 10) continue;
    const free = B.els.filter(x => !A.els.includes(x));
    const m = free.length;
    if (m < 3 || nA < 1) continue;
    const listSteps = [
      { h: 'List the sets', d: `$A = ${rosterTex(A.els)}$ and $B = ${rosterTex(B.els)}$, so $A \\subseteq B$, $n(A) = ${nA}$, $n(B) = ${nB}$` },
      { h: 'What is free', d: `Every such $X$ is $A \\cup Y$ with $Y \\subseteq B - A = ${rosterTex(free)}$, and different $Y$ give different $X$: there are $${m}$ free elements` }
    ];
    const hints = [
      'Write both sets in roster form first and check that every element of $A$ is in $B$.',
      'A set $X$ with $A \\subseteq X \\subseteq B$ must contain all of $A$; the only choice is which elements of $B - A$ to add.'
    ];
    const head = `Let $A = ${A.tex}$ and $B = ${B.tex}$.`;
    if (cond === 'size') {
      // n(X) = k AND X has at least one element with a property that A lacks:
      // all the k-element choices minus those drawn from the elements without it.
      const lacking = (natural ? ['even', 'odd', 'prime', 'mult3', 'mult4', 'mult5'] : ['negative', 'positive'])
        .filter(key => !A.els.some(PROPS[key].test) && free.some(PROPS[key].test));
      if (!lacking.length) continue;
      const P = PROPS[rc(rng, lacking)];
      const p = free.filter(P.test).length;
      const r = ri(rng, 1, Math.min(m - 1, m - p)), k = nA + r;
      if (p < 1 || m - p < 1) continue;                  // the complement must be non-empty
      const all = nCr(m, r), none = nCr(m - p, r), value = all - none;
      if (value < 6) continue;
      const allB = B.els.filter(P.test).length;
      return {
        prompt: `${head} How many sets $X$ with $A \\subseteq X \\subseteq B$ and $n(X) = ${k}$ contain at least one element that is ${P.one}?`,
        answerType: 'numeric', answer: { value },
        traps: traps(value, [
          { value: all, why: `That counts every such $X$ with $n(X) = ${k}$, including those with no element that is ${P.one}; none of the elements of $A$ is ${P.one}, so those sets must be removed.` },
          { value: nCr(nB, k) - nCr(nB - allB, k), why: `That counts subsets of $B$ with $${k}$ elements and at least one that is ${P.one}, without requiring $A \\subseteq X$.` },
          { value: p * nCr(m - 1, r - 1), why: 'Choosing one such element first and then any others counts a set with several such elements more than once.' },
          { value: nCr(m, k) - nCr(m - p, k), why: `$n(X)$ includes the $${nA}$ element${nA === 1 ? '' : 's'} forced in from $A$; only $${r}$ ${pl(r, 'is', 'are')} chosen from $B - A$.` }
        ]),
        hints: [...hints, '"At least one" is easiest by complement: count all the sets of the right size, then remove those with no element of the required kind.'],
        steps: [
          ...listSteps,
          { h: 'Right size', d: `$n(X) = ${k}$ means $Y$ has $${k} - ${nA} = ${r}$ of the $${m}$ free elements: $\\binom{${m}}{${r}} = ${all}$` },
          { h: 'Complement', d: `No element of $A$ is ${P.one}, and $${p}$ of the free elements ${pl(p, 'is', 'are')}; the sets with none of them take ${r === 1 ? 'their free element' : `all $${r}$ free elements`} from ${m - p === 1 ? 'the one remaining element' : `the other $${m - p}$`}: $\\binom{${m - p}}{${r}} = ${none}$` },
          { h: 'Subtract', d: `$${all} - ${none} = ${value}$` },
          { h: 'Answer', d: `$${value}$` }
        ],
        reasoning: 'sandwich-size-at-least-one'
      };
    }
    if (cond === 'parity') {
      const par = rc(rng, [0, 1]);
      const word = par ? 'odd' : 'even';
      const dropA = nA % 2 === par ? 1 : 0, dropB = nB % 2 === par ? 1 : 0;
      const value = 2 ** (m - 1) - dropA - dropB;
      if (value < 3) continue;
      return {
        prompt: `${head} How many sets $X$ satisfy $A \\subsetneq X \\subsetneq B$ (that is, $X$ is different from both $A$ and $B$) and have $n(X)$ ${word}?`,
        answerType: 'numeric', answer: { value },
        traps: traps(value, [
          { value: 2 ** (m - 1), why: `That counts every $X$ between $A$ and $B$ with $n(X)$ ${word}, including $A$ or $B$ themselves, which the question excludes.` },
          { value: 2 ** m - 2, why: 'That counts every $X$ strictly between $A$ and $B$, ignoring the parity of $n(X)$.' },
          { value: 2 ** (m - 1) - 1, why: `Check $A$ and $B$ separately: ${dropA ? `$n(A)$ is ${word}` : `$n(A)$ is not ${word}`} and ${dropB ? `$n(B)$ is ${word}` : `$n(B)$ is not ${word}`}.` }
        ]),
        hints: [...hints, 'Pairing each subset of $B - A$ with the one that differs by a single fixed element splits the subsets equally into odd and even sizes; then deal with $X = A$ and $X = B$.'],
        steps: [
          ...listSteps,
          { h: 'Half have each parity', d: `Toggling one fixed element of $B - A$ pairs the subsets $Y$ so that the sizes in each pair differ by $1$; so $${p2(m)}/2 = ${2 ** (m - 1)}$ of the sets $X$ have $n(X)$ ${word}` },
          { h: 'Remove A and B', d: `$n(A) = ${nA}$ is ${nA % 2 === par ? word : `not ${word}`} and $n(B) = ${nB}$ is ${nB % 2 === par ? word : `not ${word}`}: subtract $${dropA + dropB}$` },
          { h: 'Answer', d: `$${value}$` }
        ],
        reasoning: 'sandwich-parity'
      };
    }
    const key = rc(rng, natural ? ['even', 'odd', 'prime', 'mult3'] : ['negative', 'positive']);
    const P = PROPS[key];
    const forced = A.els.filter(P.test).length;
    const pFree = free.filter(P.test).length;
    const rest = m - pFree;
    if (forced < 1 || pFree < 2 || rest < 1) continue;   // some free element must lack the property
    const j = forced + ri(rng, 0, pFree);
    const value = nCr(pFree, j - forced) * 2 ** rest;
    if (value < 4) continue;
    const allB = B.els.filter(P.test).length;
    return {
      prompt: `${head} How many sets $X$ satisfy $A \\subseteq X \\subseteq B$ and have exactly $${j}$ ${pl(j, `element that is ${P.one}`, `elements that are ${P.many}`)}?`,
      answerType: 'numeric', answer: { value },
      traps: traps(value, [
        { value: nCr(pFree, j) * 2 ** rest, why: `The ${pl(forced, `element of $A$ that is ${P.one} is`, `$${forced}$ elements of $A$ that are ${P.many} are`)} already in every $X$, so fewer have to be chosen from $B - A$.` },
        { value: nCr(allB, j) * 2 ** (nB - allB), why: 'That counts subsets of $B$ with the right number of such elements, without requiring $A \\subseteq X$.' },
        { value: nCr(pFree, j - forced), why: `The elements of $B - A$ that are not ${P.many} may be put in $X$ or left out freely.` },
        { value: nCr(m, j - forced), why: `Only the free elements that are ${P.many} change how many such elements $X$ has; the others are free and do not use up the count.` }
      ]),
      hints: [...hints, 'Split $B - A$ into elements with the property and elements without it; count how many with the property $A$ already supplies.'],
      steps: [
        ...listSteps,
        { h: 'Forced and free', d: `$A$ already gives $${forced}$ element${forced === 1 ? '' : 's'} with the property; $B - A$ has $${pFree}$ with it and $${rest}$ without it` },
        { h: 'Choose', d: `Pick $${j} - ${forced} = ${j - forced}$ of the $${pFree}$, and any subset of ${rest === 1 ? 'the other element' : `the other $${rest}$ elements`}: $\\binom{${pFree}}{${j - forced}} \\times ${p2(rest)}$` },
        { h: 'Answer', d: `$${value}$` }
      ],
      reasoning: 'sandwich-property'
    };
  }
  return sandwich(makeRng(FALLBACK_SEED));
}

/** A set with 4 to 7 elements in set-builder form. */
function mediumSet(rng) {
  const fam = rc(rng, ['div', 'sq', 'abs', 'le']);
  if (fam === 'div') return SB.div(rc(rng, [6, 8, 10, 12, 14, 15, 16, 18, 20, 21, 22, 27, 28, 32, 44, 45, 50, 64]));
  if (fam === 'sq') return SB.sq(rng() < 0.5, ri(rng, 4, 15));
  if (fam === 'abs') return SB.abs(ri(rng, 1, 6), rc(rng, [2, 3]));
  return SB.le(ri(rng, 4, 7));
}

function pairs(rng) {
  for (let guard = 0; guard < 400; guard++) {
    const S = mediumSet(rng);
    const n = S.els.length;
    if (n < 4 || n > 7) continue;
    const kind = rc(rng, ['sub-sum', 'sub-gap', 'disjoint-nonempty', 'proper', 'disjoint-size']);
    const k = ri(rng, 2, n - 1);
    const head = `Let $S = ${S.tex}$. How many ordered pairs $(X, Y)$ of subsets of $S$ satisfy`;
    const list = { h: 'List S', d: `$S = ${rosterTex(S.els)}$, so $n(S) = ${n}$` };
    const three = kind.startsWith('disjoint')
      ? 'For $X \\cap Y = \\emptyset$ each element of $S$ is in $X$ only, in $Y$ only, or in neither: three choices'
      : 'For $X \\subseteq Y$ each element of $S$ is in both, in $Y$ only, or in neither: three choices';
    const hints = [
      'List $S$ first, then decide element by element where each one goes.',
      kind.startsWith('disjoint')
        ? 'When $X \\cap Y = \\emptyset$, an element can be in $X$, in $Y$, or in neither, but never in both.'
        : 'When $X \\subseteq Y$, an element can be in both, in $Y$ only, or in neither, but never in $X$ alone.'
    ];
    let value, prompt, tr, steps, reasoning;
    if (kind === 'sub-sum') {
      // X ⊆ Y: an element in both adds 2 to n(X) + n(Y), one in Y only adds 1.
      // Casework on the number b of elements in both.
      const K = ri(rng, 3, 2 * n - 3);
      const cases = [];
      for (let bb = 0; 2 * bb <= K; bb++) if (K - 2 * bb <= n - bb) cases.push({ bb, c: nCr(n, bb) * nCr(n - bb, K - 2 * bb) });
      value = cases.reduce((acc, c) => acc + c.c, 0);
      if (cases.length < 2) continue;
      prompt = `${head} $X \\subseteq Y$ and $n(X) + n(Y) = ${K}$?`;
      tr = [
        { value: nCr(2 * n, K), why: `That treats $X$ and $Y$ as two unrelated subsets of $S$; here $X$ must lie inside $Y$.` },
        { value: nCr(n, K), why: 'That is only the case with no element in both sets, i.e. $X = \\emptyset$; elements in both sets count twice.' },
        { value: 3 ** n, why: `That counts every pair with $X \\subseteq Y$, without the condition $n(X) + n(Y) = ${K}$.` }
      ];
      steps = [list,
        { h: 'Three states', d: `${three}. An element in both adds $2$ to $n(X) + n(Y)$, one in $Y$ only adds $1$, one in neither adds $0$` },
        { h: 'Cases', d: `With $b$ elements in both and $${K} - 2b$ in $Y$ only: ${cases.map(c => `$b = ${c.bb}$: $\\binom{${n}}{${c.bb}}\\binom{${n - c.bb}}{${K - 2 * c.bb}} = ${c.c}$`).join('; ')}` },
        { h: 'Add', d: `$${cases.map(c => c.c).join(' + ')} = ${value}$` },
        { h: 'Answer', d: `$${value}$` }];
      reasoning = 'pairs-subset-sum';
    } else if (kind === 'sub-gap') {
      value = nCr(n, k) * 2 ** (n - k);
      prompt = `${head} $X \\subseteq Y$ and $n(Y - X) = ${k}$?`;
      tr = [
        { value: nCr(n, k) * 2 ** k, why: `The $${k}$ elements of $Y - X$ are fixed once chosen; it is ${eachOther(n - k)} that has two options (in both $X$ and $Y$, or in neither).` },
        { value: nCr(n, k), why: `Once $Y - X$ is chosen, ${eachOther(n - k)} can still be in both sets or in neither.` },
        { value: 3 ** n, why: `That counts every pair with $X \\subseteq Y$, without the condition $n(Y - X) = ${k}$.` }
      ];
      steps = [list, { h: 'Three states', d: three }, { h: 'Fix Y − X', d: `Choose the $${k}$ elements that are in $Y$ only: $\\binom{${n}}{${k}} = ${nCr(n, k)}$; ${eachOther(n - k)} is in both or in neither: $${p2(n - k)}$` }, { h: 'Answer', d: `$${nCr(n, k)} \\times ${2 ** (n - k)} = ${value}$` }];
      reasoning = 'pairs-subset-gap';
    } else if (kind === 'disjoint-nonempty') {
      value = 3 ** n - 2 * 2 ** n + 1;
      prompt = `${head} $X \\cap Y = \\emptyset$, $X \\ne \\emptyset$ and $Y \\ne \\emptyset$?`;
      tr = [
        { value: 3 ** n, why: 'That includes the pairs in which $X$ or $Y$ is empty.' },
        { value: 3 ** n - 2 * 2 ** n, why: 'The pair $(\\emptyset, \\emptyset)$ was removed twice — once with $X$ empty and once with $Y$ empty — so add it back once.' },
        { value: 3 ** n - 2 * 2 ** n + 2, why: 'Only one pair, $(\\emptyset, \\emptyset)$, has both sets empty.' }
      ];
      steps = [list, { h: 'Three states', d: `${three}: $3^{${n}} = ${3 ** n}$ pairs` }, { h: 'Remove empty members', d: `$X = \\emptyset$ in $${p2(n)}$ pairs, $Y = \\emptyset$ in $${p2(n)}$ pairs, both in $1$: remove $2 \\times ${2 ** n} - 1 = ${2 * 2 ** n - 1}$` }, { h: 'Answer', d: `$${3 ** n} - ${2 * 2 ** n - 1} = ${value}$` }];
      reasoning = 'pairs-disjoint-nonempty';
    } else if (kind === 'proper') {
      value = 3 ** n - 2 ** n;
      prompt = `${head} $X \\subseteq Y$ and $X \\ne Y$?`;
      tr = [
        { value: 3 ** n, why: 'That includes the pairs with $X = Y$.' },
        { value: 4 ** n - 2 ** n, why: 'That counts all pairs with $X \\ne Y$, not only those with $X \\subseteq Y$.' },
        { value: 3 ** n - 1, why: `Every subset of $S$ gives a pair with $X = Y$, and there are $${p2(n)}$ of them.` }
      ];
      steps = [list, { h: 'Three states', d: `${three}: $3^{${n}} = ${3 ** n}$ pairs` }, { h: 'Remove X = Y', d: `$X = Y$ for each of the $${p2(n)} = ${2 ** n}$ subsets` }, { h: 'Answer', d: `$${3 ** n} - ${2 ** n} = ${value}$` }];
      reasoning = 'pairs-proper';
    } else {
      value = nCr(n, k) * (2 ** k - 2);
      prompt = `${head} $X \\cap Y = \\emptyset$, $n(X \\cup Y) = ${k}$, $X \\ne \\emptyset$ and $Y \\ne \\emptyset$?`;
      tr = [
        { value: nCr(n, k) * 2 ** k, why: 'That includes the splits in which all the chosen elements go to one set, leaving the other empty.' },
        { value: nCr(n, k) * (2 ** k - 1), why: 'Two splits leave a set empty: everything in $X$, or everything in $Y$.' },
        { value: nCr(n, k), why: `That only chooses $X \\cup Y$; its $${k}$ elements must still be split between $X$ and $Y$.` }
      ];
      steps = [list, { h: 'Choose X ∪ Y', d: `$\\binom{${n}}{${k}} = ${nCr(n, k)}$ ways` }, { h: 'Split it', d: `Each of the $${k}$ elements goes to $X$ or to $Y$: $${p2(k)}$ ways, of which $2$ leave a set empty — $${2 ** k - 2}$ ways` }, { h: 'Answer', d: `$${nCr(n, k)} \\times ${2 ** k - 2} = ${value}$` }];
      reasoning = 'pairs-disjoint-size';
    }
    if (value < 4 || value > 100000) continue;
    return {
      prompt, answerType: 'numeric', answer: { value },
      traps: traps(value, tr),
      hints: [...hints, 'Remove the pairs that break the extra condition, or fix the elements it pins down before counting the rest.'],
      steps, reasoning
    };
  }
  return pairs(makeRng(FALLBACK_SEED));
}

/** A set with 3 or 4 elements in set-builder form. */
function smallSet(rng) {
  if (rng() < 0.55) {                                   // four elements
    return rng() < 0.75 ? SB.div(rc(rng, [6, 8, 10, 14, 15, 21, 22, 26, 27, 33, 35, 39, 51, 55])) : SB.le(4);
  }
  const fam = rc(rng, ['div', 'sq', 'abs', 'cube', 'le']);
  if (fam === 'div') return SB.div(rc(rng, [4, 9, 25, 49]));
  if (fam === 'sq') return rng() < 0.5 ? SB.sq(false, ri(rng, 1, 3)) : SB.sq(true, ri(rng, 2, 4));
  if (fam === 'abs') return SB.abs(ri(rng, 1, 9), 1);
  if (fam === 'cube') return SB.cube();
  return SB.le(3);
}

function collections(rng) {
  for (let guard = 0; guard < 400; guard++) {
    const A = smallSet(rng);
    const n = A.els.length;
    if (n < 3 || n > 4) continue;
    const kind = rc(rng, ['size', 'contains', 'no-complements', 'cover']);
    const head = `Let $A = ${A.tex}$ and let $P(A)$ be its power set. How many sets $\\mathcal{S}$ with $\\mathcal{S} \\subseteq P(A)$ are there such that`;
    const list = { h: 'List A', d: `$A = ${rosterTex(A.els)}$, so $n(A) = ${n}$ and $P(A)$ has $${p2(n)} = ${2 ** n}$ members` };
    const hints = [
      'Write $A$ in roster form and count the members of $P(A)$.',
      'A set $\\mathcal{S} \\subseteq P(A)$ is a collection of subsets of $A$: decide, for each member of $P(A)$, whether it is in $\\mathcal{S}$.',
      kind === 'cover'
        ? 'Count the collections whose union misses a given element of $A$, and combine those counts by inclusion–exclusion.'
        : 'First sort out which members of $P(A)$ may appear and how they constrain one another, then count the collections.'
    ];
    let value, prompt, tr, steps, reasoning;
    if (kind === 'size' || kind === 'contains') {
      // Allowed members, then collections of them with at least two members.
      let q, what, allowedStep;
      if (kind === 'size') {
        const j = ri(rng, 1, n - 1);
        q = nCr(n, j);
        what = `every member of $\\mathcal{S}$ has exactly $${j}$ element${j === 1 ? '' : 's'}`;
        allowedStep = `Subsets of $A$ with $${j}$ element${j === 1 ? '' : 's'}: $\\binom{${n}}{${j}} = ${q}$`;
      } else {
        const e = rc(rng, A.els);
        q = 2 ** (n - 1);
        what = `every member of $\\mathcal{S}$ contains the element $${e}$`;
        allowedStep = `Subsets of $A$ containing $${e}$: choose freely among the other $${n - 1}$ elements, $${p2(n - 1)} = ${q}$`;
      }
      if (q < 4) continue;
      value = 2 ** q - q - 1;
      prompt = `${head} ${what} and $\\mathcal{S}$ has at least two members?`;
      tr = [
        { value: 2 ** q - 1, why: `That still includes the $${q}$ collections with exactly one member.` },
        { value: 2 ** q - q, why: 'The empty collection also has fewer than two members; remove it too.' },
        { value: 2 ** q, why: 'That counts every collection of the allowed subsets, including the empty one and those with one member.' },
        { value: 2 ** (2 ** n) - 2 ** n - 1, why: 'Only the subsets of $A$ that meet the condition may be members, not every member of $P(A)$.' }
      ];
      steps = [list,
        { h: 'Allowed members', d: allowedStep },
        { h: 'Collections of them', d: `Any of the $${p2(q)}$ subsets of these $${q}$, except the empty collection and the $${q}$ one-member collections: $${p2(q)} - ${q} - 1$` },
        { h: 'Answer', d: `$${value}$` }];
      reasoning = kind === 'size' ? 'collections-size' : 'collections-contains';
    } else if (kind === 'no-complements') {
      // P(A) splits into 2^(n−1) pairs {X, A − X}; each pair gives 3 choices,
      // except the pair {∅, A} when ∅ is barred (2 choices).
      const h = 2 ** (n - 1);
      const noEmpty = rng() < 0.5;
      value = noEmpty ? 2 * 3 ** (h - 1) - 1 : 3 ** h - 1;
      prompt = `${head} $\\mathcal{S} \\ne \\emptyset$${noEmpty ? ', $\\emptyset \\notin \\mathcal{S}$' : ''} and there is no $X \\in \\mathcal{S}$ with $A - X \\in \\mathcal{S}$?`;
      tr = [
        { value: value + 1, why: 'That includes the empty collection, which the question excludes.' },
        { value: noEmpty ? 2 ** (h - 1) - 1 : 2 ** h - 1, why: 'From each complementary pair, $\\mathcal{S}$ may take one member or neither; a pair is not limited to exactly one choice.' },
        noEmpty
          ? { value: 3 ** h - 1, why: 'That still allows $\\emptyset$ as a member; in the pair $\\{\\emptyset, A\\}$ only $A$ or neither may be taken.' }
          : { value: 2 ** (2 ** n) - 1, why: 'That ignores the complement condition: every non-empty collection is counted.' },
        { value: noEmpty ? 2 ** (h - 1) : 2 ** h, why: `That only takes exactly one member from each of the $${h}$ pairs.` }
      ];
      steps = [list,
        { h: 'Complementary pairs', d: `$X \\ne A - X$ for every $X \\subseteq A$, so the $${2 ** n}$ members of $P(A)$ fall into $${h}$ pairs $\\{X, A - X\\}$` },
        { h: 'Each pair', d: noEmpty
          ? `From the pair $\\{\\emptyset, A\\}$, $\\mathcal{S}$ may hold $A$ or neither: $2$ choices; from each of the other $${h - 1}$ pairs, neither, the first or the second: $3$ choices — $2 \\times 3^{${h - 1}}$ collections`
          : `$\\mathcal{S}$ may hold neither member, the first, or the second, but not both: $3$ choices, so $3^{${h}}$ collections` },
        { h: 'Non-empty', d: noEmpty ? `$2 \\times 3^{${h - 1}} - 1$` : `$3^{${h}} - 1$` },
        { h: 'Answer', d: `$${value}$` }];
      reasoning = 'collections-no-complements';
    } else {
      // Exactly k members whose union is A: inclusion–exclusion over the elements missed.
      const k = rc(rng, [2, 3]);
      const terms = range(0, n).map(i => ({ i, c: nCr(n, i), t: nCr(2 ** (n - i), k) }));
      value = terms.reduce((acc, x) => acc + (x.i % 2 ? -1 : 1) * x.c * x.t, 0);
      const live = terms.filter(x => x.t > 0);
      prompt = `${head} $\\mathcal{S}$ has exactly $${k}$ members and the union of the members of $\\mathcal{S}$ is $A$?`;
      tr = [
        { value: nCr(2 ** n, k), why: 'That counts every collection with this many members, whether or not their union is all of $A$.' },
        { value: nCr(2 ** n, k) - n * nCr(2 ** (n - 1), k), why: 'The collections whose union misses two elements were subtracted twice; add them back.' },
        { value: nCr(2 ** n - 1, k), why: 'That only removes $\\emptyset$ as a member; a collection of non-empty subsets can still fail to cover $A$.' }
      ];
      steps = [list,
        { h: 'All collections', d: `Choosing $${k}$ different members of $P(A)$: $\\binom{${2 ** n}}{${k}} = ${nCr(2 ** n, k)}$` },
        { h: 'Missing an element', d: `If the union misses $i$ given elements, every member is a subset of the other $${n} - i$ elements: $\\binom{2^{${n} - i}}{${k}}$ collections` },
        { h: 'Inclusion–exclusion', d: `$${live.map(x => `${x.i === 0 ? '' : x.i % 2 ? '- ' : '+ '}\\binom{${n}}{${x.i}}\\binom{${2 ** (n - x.i)}}{${k}}`).join(' ')} = ${live.map(x => `${x.i === 0 ? '' : x.i % 2 ? '- ' : '+ '}${x.c * x.t}`).join(' ')}$` },
        { h: 'Answer', d: `$${value}$` }];
      reasoning = 'collections-cover';
    }
    if (value < 4 || value > 100000) continue;
    return { prompt, answerType: 'numeric', answer: { value }, traps: traps(value, tr), hints, steps, reasoning };
  }
  return collections(makeRng(FALLBACK_SEED));
}

function setNotationReasoning(rng) {
  const kind = rc(rng, ['sandwich', 'pairs', 'collections']);
  if (kind === 'sandwich') return sandwich(rng);
  if (kind === 'pairs') return pairs(rng);
  return collections(rng);
}

// ═════════════════════════════════════════════════════════════════════════════
// 1 · Unions, intersections, differences and complements
// ═════════════════════════════════════════════════════════════════════════════

const GAMES = [['chess', 'carrom'], ['cricket', 'kabaddi'], ['badminton', 'table tennis'], ['football', 'hockey'], ['kho-kho', 'volleyball']];
const PLACES = ['hostel', 'school', 'college'];

/**
 * Two sets inside a universe of u, with one condition on the number in
 * neither. Every region is a function of x = n(A ∩ B):
 * A only a − x, B only b − x, neither u − a − b + x.
 */
function extremal(rng) {
  for (let guard = 0; guard < 400; guard++) {
    const u = ri(rng, 30, 120);
    const a = ri(rng, Math.ceil(u * 0.3), Math.floor(u * 0.85));
    const b = ri(rng, Math.ceil(u * 0.3), Math.floor(u * 0.85));
    const side = rc(rng, ['atLeast', 'atMost']);
    const lo0 = Math.max(0, a + b - u), hi0 = Math.min(a, b);
    let lo = lo0, hi = hi0, w;
    if (side === 'atLeast') {
      w = ri(rng, 1, Math.floor(u * 0.3));
      lo = a + b - u + w;
      if (lo <= lo0 || lo >= hi) continue;              // the condition binds, and leaves room
    } else {
      w = ri(rng, 1, Math.floor(u * 0.4));
      hi = a + b - u + w;
      if (hi >= hi0 || hi <= lo) continue;
    }
    const [g1, g2] = rc(rng, GAMES);
    const city = rc(rng, IN_CITIES), place = rc(rng, PLACES);
    // Targets, each a linear function of x, with the direction asked.
    const T = side === 'atLeast'
      ? [
        { text: `play both games`, f: x => x, ask: 'least' },
        { text: `play exactly one of the two games`, f: x => a + b - 2 * x, ask: 'greatest' },
        { text: `play ${g1} but not ${g2}`, f: x => a - x, ask: 'greatest' },
        { text: `play ${g2} but not ${g1}`, f: x => b - x, ask: 'greatest' }
      ]
      : [
        { text: `play both games`, f: x => x, ask: 'greatest' },
        { text: `play exactly one of the two games`, f: x => a + b - 2 * x, ask: 'least' },
        { text: `play ${g1} but not ${g2}`, f: x => a - x, ask: 'least' },
        { text: `play ${g2} but not ${g1}`, f: x => b - x, ask: 'least' }
      ];
    const t = rc(rng, T);
    const xStar = side === 'atLeast' ? lo : hi;
    const value = t.f(xStar);
    const other = side === 'atLeast' ? hi : lo;
    const free = side === 'atLeast' ? lo0 : hi0;
    if (value < 1) continue;
    const condText = side === 'atLeast'
      ? `At least $${w}$ ${pl(w, 'student plays', 'students play')} neither game.`
      : `At most $${w}$ ${pl(w, 'student plays', 'students play')} neither game.`;
    const regions = x => `$${a - x}$ play only ${g1}, $${b - x}$ only ${g2}, $${x}$ both and $${u - a - b + x}$ neither`;
    return {
      prompt: `Of the $${u}$ students in a ${place} in ${city}, $${a}$ play ${g1} and $${b}$ play ${g2}. ${condText} What is the ${t.ask} possible number of students who ${t.text}?`,
      answerType: 'numeric', answer: { value },
      traps: traps(value, [
        { value: t.f(free), why: `That ignores the condition on the students who play neither game: it uses ${side === 'atLeast' ? 'the least overlap that the class size alone forces' : 'the greatest overlap that the two numbers alone allow'}.` },
        { value: t.f(other), why: `That puts the number who play both games at its other extreme; this quantity is ${t.ask} at the opposite end.` },
        { value: w, why: 'That is the number who play neither game at the extreme, not the number asked for.' },
        side === 'atLeast'
          ? { value: t.f(lo - 1), why: `With one student fewer in both games, only $${w - 1}$ would play neither game, breaking the condition.` }
          : { value: t.f(hi + 1), why: `With one student more in both games, $${w + 1}$ would play neither, breaking the condition.` }
      ]),
      hints: [
        'Call the sets of players of the two games $A$ and $B$, let $x = n(A \\cap B)$, and write every region of the Venn diagram — only the first game, only the second, both, neither — in terms of $x$.',
        'Each region must be a whole number, at least $0$, and the condition on "neither" is one more inequality in $x$.',
        'Write the quantity asked for in terms of $x$, decide whether it rises or falls with $x$, and check that the end value of $x$ can really occur.'
      ],
      steps: [
        { h: 'Name the sets', d: `Let $A$ be the set of students who play ${g1} and $B$ the set who play ${g2}, so $n(U) = ${u}$, $n(A) = ${a}$, $n(B) = ${b}$` },
        { h: 'Regions in terms of x', d: `With $x = n(A \\cap B)$: only ${g1} $${a} - x$, only ${g2} $${b} - x$, neither $${u} - ${a} - ${b} + x${a + b === u ? '' : ` = x ${a + b - u > 0 ? `- ${a + b - u}` : `+ ${u - a - b}`}`}$` },
        { h: 'Range of x', d: side === 'atLeast'
          ? `Neither $\\ge ${w}$ gives $x \\ge ${lo}$; also $x \\le \\min(${a}, ${b}) = ${hi}$`
          : `Neither $\\le ${w}$ gives $x \\le ${hi}$; also $x \\ge ${lo}$ and $x \\le \\min(${a}, ${b})$` },
        { h: 'Target', d: `The number who ${t.text} is ${t.f(1) - t.f(0) > 0 ? 'increasing' : 'decreasing'} in $x$, so its ${t.ask} value is at $x = ${xStar}$` },
        { h: 'Attained', d: `At $x = ${xStar}$: ${regions(xStar)} — every count is whole and non-negative` },
        { h: 'Answer', d: `$${value}$` }
      ],
      reasoning: `extremal-${side}`
    };
  }
  return extremal(makeRng(FALLBACK_SEED));
}

const UPROPS = {
  even: { tex: '\\text{ is even}', test: x => x % 2 === 0 },
  odd: { tex: '\\text{ is odd}', test: x => x % 2 === 1 },
  mult3: { tex: '\\text{ is a multiple of } 3', test: x => x % 3 === 0 },
  mult4: { tex: '\\text{ is a multiple of } 4', test: x => x % 4 === 0 },
  mult6: { tex: '\\text{ is a multiple of } 6', test: x => x % 6 === 0 },
  prime: { tex: '\\text{ is prime}', test: isPrime },
  square: { tex: '\\text{ is a perfect square}', test: x => Number.isInteger(Math.sqrt(x)) }
};
const NESTED = [['mult4', 'even'], ['mult6', 'even'], ['mult6', 'mult3']];

function subsetCount(rng) {
  for (let guard = 0; guard < 400; guard++) {
    const N = ri(rng, 8, 12);
    const cond = rc(rng, ['meet-avoid', 'equal-cap', 'meet-both', 'avoid-cover', 'equal-cup-size']);
    let ka, kb;
    if (cond === 'avoid-cover') [ka, kb] = rc(rng, NESTED);
    else {
      const keys = Object.keys(UPROPS);
      ka = rc(rng, keys); kb = rc(rng, keys);
      if (ka === kb) continue;
    }
    const U = range(1, N);
    const A = U.filter(UPROPS[ka].test), B = U.filter(UPROPS[kb].test);
    const AB = A.filter(x => B.includes(x)), AuB = U.filter(x => A.includes(x) || B.includes(x));
    const D = AuB.filter(x => !AB.includes(x));        // A Δ B
    const a = A.length, b = B.length;
    if (a < 2 || b < 2) continue;
    const head = `Let $U = \\{x \\in \\mathbb{N} : x \\le ${N}\\}$, $A = \\{x \\in U : x ${UPROPS[ka].tex}\\}$ and $B = \\{x \\in U : x ${UPROPS[kb].tex}\\}$. How many subsets $X$ of $U$ satisfy`;
    const list = { h: 'List the sets', d: `$A = ${rosterTex(A)}$ and $B = ${rosterTex(B)}$ in $U = \\{1, 2, \\ldots, ${N}\\}$` };
    const hints = [
      'List $A$ and $B$ in roster form inside $U$.',
      'Rewrite each condition on $X$ as "these elements of $U$ must be in $X$, these must be out, the rest are free".',
      'A condition of the form "meets a set" is easiest by complement: all the allowed $X$ minus those that miss the set.'
    ];
    let value, prompt, tr, steps, reasoning;
    if (cond === 'meet-avoid') {
      const AmB = A.filter(x => !B.includes(x));
      if (AmB.length < 1 || AB.length < 1) continue;
      const out = N - b, out2 = N - AuB.length;
      value = 2 ** out - 2 ** out2;
      prompt = `${head} $X \\cap A \\ne \\emptyset$ and $X \\cap B = \\emptyset$?`;
      tr = [
        { value: 2 ** out, why: '$X \\cap B = \\emptyset$ alone allows sets that miss $A$ as well; those must be removed.' },
        { value: 2 ** N - 2 ** (N - a), why: 'That counts every $X$ that meets $A$, without requiring $X \\cap B = \\emptyset$.' },
        { value: (2 ** a - 1) * 2 ** (N - a - b + AB.length), why: '$X$ must avoid $B$, so the elements of $A \\cap B$ cannot be used to meet $A$; only $A - B$ can.' }
      ];
      steps = [list, { h: 'Avoid B', d: `$X \\cap B = \\emptyset$ means $X \\subseteq U - B$, which has $${out}$ ${pl(out, 'element', 'elements')}: $${p2(out)}$ sets` }, { h: 'Meet A', d: `Inside $U - B$, the only elements of $A$ are $A - B = ${rosterTex(AmB)}$; the sets that miss them lie in $U - (A \\cup B)$, which has $${out2}$ ${pl(out2, 'element', 'elements')}: $${p2(out2)}$` }, { h: 'Subtract', d: `$${p2(out)} - ${p2(out2)}$` }, { h: 'Answer', d: `$${value}$` }];
      reasoning = 'subsets-meet-avoid';
    } else if (cond === 'equal-cap') {
      if (D.length < 2 || AB.length < 1) continue;
      value = 2 ** (N - D.length);
      prompt = `${head} $X \\cap A = X \\cap B$?`;
      tr = [
        { value: 2 ** (N - AuB.length), why: 'Elements of $A \\cap B$ may be in $X$: they then lie in both $X \\cap A$ and $X \\cap B$.' },
        { value: 2 ** (N - D.length) - 1, why: 'The empty set satisfies the condition and is a subset of $U$, so it is counted.' },
        { value: 2 ** N - 2 ** (N - D.length), why: 'That counts the sets for which $X \\cap A \\ne X \\cap B$.' }
      ];
      steps = [list, { h: 'Rewrite', d: `$X \\cap A = X \\cap B$ exactly when $X$ contains no element of $(A - B) \\cup (B - A) = ${rosterTex(D)}$` }, { h: 'Free elements', d: `The other $${N} - ${D.length} = ${N - D.length}$ elements of $U$ are free: $${p2(N - D.length)}$` }, { h: 'Answer', d: `$${value}$` }];
      reasoning = 'subsets-equal-intersections';
    } else if (cond === 'meet-both') {
      if (AB.length < 1) continue;
      const c = N - AuB.length;
      value = 2 ** N - 2 ** (N - a) - 2 ** (N - b) + 2 ** c;
      prompt = `${head} $X \\cap A \\ne \\emptyset$ and $X \\cap B \\ne \\emptyset$?`;
      tr = [
        { value: 2 ** N - 2 ** (N - a) - 2 ** (N - b), why: 'The sets that miss both $A$ and $B$ were subtracted twice; add them back once.' },
        { value: (2 ** a - 1) * (2 ** b - 1) * 2 ** c, why: '$A$ and $B$ overlap, so choosing a non-empty part of each separately counts some sets more than once.' },
        { value: 2 ** N - 2 ** c, why: 'That counts the sets that meet $A \\cup B$ — meeting one of the two sets is not enough.' }
      ];
      steps = [list, { h: 'Complements', d: `Missing $A$: $${p2(N - a)}$; missing $B$: $${p2(N - b)}$; missing both, i.e. inside $U - (A \\cup B)$: $${p2(c)}$` }, { h: 'Inclusion–exclusion', d: `$${p2(N)} - ${p2(N - a)} - ${p2(N - b)} + ${p2(c)}$` }, { h: 'Answer', d: `$${value}$` }];
      reasoning = 'subsets-meet-both';
    } else if (cond === 'avoid-cover') {
      if (b >= N) continue;
      value = 2 ** (b - a);
      prompt = `${head} $X \\cap A = \\emptyset$ and $X \\cup B = U$?`;
      tr = [
        { value: 2 ** (N - a), why: '$X \\cup B = U$ also forces every element outside $B$ into $X$.' },
        { value: 2 ** b, why: '$X \\cap A = \\emptyset$ keeps the elements of $A$ out of $X$, so they are not free.' },
        { value: 2 ** (N - b), why: 'The elements outside $B$ are forced in, not free; the free ones are in $B - A$.' }
      ];
      steps = [list, { h: 'Forced in', d: `$X \\cup B = U$ forces the $${N - b}$ element${N - b === 1 ? '' : 's'} of $U - B$ into $X$; none of them is in $A$, since $A \\subseteq B$` }, { h: 'Forced out', d: `$X \\cap A = \\emptyset$ keeps the $${a}$ elements of $A$ out` }, { h: 'Free', d: `The $${b} - ${a} = ${b - a}$ elements of $B - A$ are free: $${p2(b - a)}$` }, { h: 'Answer', d: `$${value}$` }];
      reasoning = 'subsets-avoid-cover';
    } else {
      const d = D.length;
      if (d < 2 || N - d < 3) continue;
      const k = d + ri(rng, 1, N - d - 1);
      value = nCr(N - d, k - d);
      prompt = `${head} $X \\cup A = X \\cup B$ and $n(X) = ${k}$?`;
      tr = [
        { value: nCr(N, k), why: `That counts every ${k}-element subset of $U$; $X \\cup A = X \\cup B$ forces some elements into $X$.` },
        { value: nCr(N - d, k), why: `The $${d}$ forced elements count towards $n(X) = ${k}$; only $${k - d}$ ${pl(k - d, 'is', 'are')} chosen freely.` },
        { value: 2 ** (N - d), why: `That counts every $X$ with $X \\cup A = X \\cup B$, of any size.` }
      ];
      steps = [list, { h: 'Rewrite', d: `$X \\cup A = X \\cup B$ exactly when $X$ contains every element of $(A - B) \\cup (B - A) = ${rosterTex(D)}$` }, { h: 'Choose the rest', d: `$${k} - ${d} = ${k - d}$ more from the other $${N - d}$ elements: $\\binom{${N - d}}{${k - d}}$` }, { h: 'Answer', d: `$${value}$` }];
      reasoning = 'subsets-equal-unions';
    }
    if (value < 4 || value > 100000) continue;
    return { prompt, answerType: 'numeric', answer: { value }, traps: traps(value, tr), hints, steps, reasoning };
  }
  return subsetCount(makeRng(FALLBACK_SEED));
}

function setOperationsReasoning(rng) {
  return rng() < 0.5 ? extremal(rng) : subsetCount(rng);
}

// ═════════════════════════════════════════════════════════════════════════════
// 2 · Inclusion–exclusion for two and three sets
// ═════════════════════════════════════════════════════════════════════════════

const CLUBS = [['dance', 'music', 'robotics'], ['quiz', 'debate', 'drama'], ['chess', 'photography', 'eco']];
const SPORTS = [['cricket', 'football', 'hockey'], ['kabaddi', 'badminton', 'cricket'], ['yoga', 'swimming', 'athletics']];

/** Venn regions → the counts a survey reports. */
function survey(r) {
  const { oa, ob, oc, x, y, z, t, none } = r;   // x = A∩B only, y = B∩C only, z = A∩C only
  const a = oa + x + z + t, b = ob + x + y + t, c = oc + y + z + t;
  const E1 = oa + ob + oc, E2 = x + y + z, E3 = t;
  const T = E1 + E2 + E3;
  return { a, b, c, E1, E2, E3, T, N: T + none, none, S: a + b + c };
}

function exactly(rng) {
  for (let guard = 0; guard < 400; guard++) {
    const r = { oa: ri(rng, 2, 18), ob: ri(rng, 2, 18), oc: ri(rng, 2, 18), x: ri(rng, 1, 10), y: ri(rng, 1, 10), z: ri(rng, 1, 10), t: ri(rng, 1, 9), none: ri(rng, 0, 20) };
    const s = survey(r);
    const [c1, c2, c3] = rc(rng, CLUBS);
    const city = rc(rng, IN_CITIES);
    const variant = rc(rng, ['none-all', 'one-two', 'none-two']);
    const noneText = s.none === 0 ? 'Every student is in at least one of the three clubs' : `Exactly $${s.none}$ ${pl(s.none, 'student is', 'students are')} in none of the three clubs`;
    let facts, target, value, tr, steps, reasoning;
    const mult = { h: 'Count with multiplicity', d: `Let $A$, $B$, $C$ be the sets of students in the ${c1}, ${c2} and ${c3} clubs. $n(A) + n(B) + n(C) = ${s.a} + ${s.b} + ${s.c} = ${s.S}$ counts a student in exactly one club once, in exactly two clubs twice and in all three three times: $${s.S} = E_1 + 2E_2 + 3E_3$` };
    const total = { h: 'At least one club', d: s.none ? `$E_1 + E_2 + E_3 = ${s.N} - ${s.none} = ${s.T}$` : `Every student is in a club: $E_1 + E_2 + E_3 = ${s.T}$` };
    if (variant === 'none-all') {
      facts = `${noneText}, and $${s.E3}$ ${pl(s.E3, 'is', 'are')} in all three.`;
      const askTwo = rng() < 0.5;
      target = askTwo ? 'exactly two of the three clubs' : 'exactly one of the three clubs';
      value = askTwo ? s.E2 : s.E1;
      tr = askTwo
        ? [
          { value: s.S - s.T, why: `$n(A) + n(B) + n(C) - (E_1 + E_2 + E_3)$ is $E_2 + 2E_3$; the students in all three clubs are still in it twice.` },
          { value: s.S - s.T - s.E3, why: 'A student in all three clubs is counted three times in the sum, so remove them twice, not once.' },
          { value: s.T - s.E3, why: 'That is the number in exactly one or exactly two clubs together.' }
        ]
        : [
          { value: s.E1 + s.E3, why: 'That still includes the students in all three clubs.' },
          { value: s.S - s.T, why: `$n(A) + n(B) + n(C) - (E_1 + E_2 + E_3)$ is $E_2 + 2E_3$, not the number in exactly one club.` },
          { value: s.T - s.E3, why: 'That is the number in exactly one or exactly two clubs together.' }
        ];
      steps = [mult, total, { h: 'Exactly two', d: `Subtract: $E_2 + 2E_3 = ${s.S} - ${s.T} = ${s.S - s.T}$, so $E_2 = ${s.S - s.T} - 2 \\times ${s.E3} = ${s.E2}$` },
        ...(askTwo ? [] : [{ h: 'Exactly one', d: `$E_1 = ${s.T} - ${s.E2} - ${s.E3} = ${s.E1}$` }]), { h: 'Answer', d: `$${value}$` }];
      reasoning = askTwo ? 'exactly-two' : 'exactly-one';
    } else if (variant === 'one-two') {
      facts = `Altogether, $${s.E1}$ students are in exactly one of the clubs and $${s.E2}$ in exactly two.`;
      const askNone = rng() < 0.6;
      target = askNone ? 'none of the three clubs' : 'all three clubs';
      value = askNone ? s.none : s.E3;
      if (askNone && value < 1) continue;
      tr = askNone
        ? [
          { value: s.N - s.E1 - s.E2, why: 'That forgets the students in all three clubs, who are in at least one club.' },
          { value: s.N - s.E1 - s.E2 - (s.S - s.E1 - 2 * s.E2), why: '$n(A) + n(B) + n(C) - E_1 - 2E_2$ counts each student in all three clubs three times; divide by $3$.' },
          { value: s.E3, why: 'That is the number in all three clubs, a middle step; the question asks for the number in no club.' },
          { value: s.T, why: 'That is the number in at least one club; subtract it from the class size.' },
          { value: s.N - (s.S - s.E2 + s.E3), why: 'The pairwise intersections do not add up to $E_2$: a student in all three clubs lies in all three of them, so their sum is $E_2 + 3E_3$.' }
        ]
        : [
          { value: s.S - s.E1 - 2 * s.E2, why: '$n(A) + n(B) + n(C) - E_1 - 2E_2$ is $3E_3$; divide by $3$.' },
          { value: s.S - s.E1 - s.E2, why: 'A student in exactly two clubs is counted twice in the sum, so remove $2E_2$, not $E_2$.' },
          { value: s.N - s.E1 - s.E2, why: 'That also includes the students in no club.' }
        ];
      steps = [mult, { h: 'All three', d: `$3E_3 = ${s.S} - ${s.E1} - 2 \\times ${s.E2} = ${3 * s.E3}$, so $E_3 = ${s.E3}$` },
        ...(askNone ? [{ h: 'None', d: `$${s.N} - (${s.E1} + ${s.E2} + ${s.E3}) = ${s.none}$` }] : []), { h: 'Answer', d: `$${value}$` }];
      reasoning = askNone ? 'exactly-to-none' : 'exactly-to-all';
    } else {
      facts = `${noneText}, and $${s.E2}$ are in exactly two of the clubs.`;
      const askAll = rng() < 0.5;
      target = askAll ? 'all three clubs' : 'exactly one of the three clubs';
      value = askAll ? s.E3 : s.E1;
      tr = askAll
        ? [
          { value: s.S - s.T - s.E2, why: '$n(A) + n(B) + n(C) - (E_1 + E_2 + E_3) - E_2$ is $2E_3$; halve it.' },
          { value: s.S - s.T, why: 'That is $E_2 + 2E_3$, not the number in all three.' },
          { value: s.T - s.E2, why: 'That is the number in exactly one or all three clubs together.' }
        ]
        : [
          { value: s.T - s.E2, why: 'That still includes the students in all three clubs.' },
          { value: s.T - s.E2 - (s.S - s.T - s.E2), why: '$n(A) + n(B) + n(C) - (E_1 + E_2 + E_3) - E_2$ is $2E_3$, not $E_3$.' },
          { value: s.S - 2 * s.E2 - 3 * s.E3 + s.none, why: 'The students in no club are not in exactly one club.' }
        ];
      steps = [mult, total, { h: 'All three', d: `$E_2 + 2E_3 = ${s.S} - ${s.T} = ${s.S - s.T}$, so $2E_3 = ${s.S - s.T} - ${s.E2} = ${2 * s.E3}$ and $E_3 = ${s.E3}$` },
        ...(askAll ? [] : [{ h: 'Exactly one', d: `$E_1 = ${s.T} - ${s.E2} - ${s.E3} = ${s.E1}$` }]), { h: 'Answer', d: `$${value}$` }];
      reasoning = askAll ? 'two-to-all' : 'two-to-one';
    }
    if (value < 1) continue;
    return {
      prompt: `Of the $${s.N}$ students of a college in ${city}, $${s.a}$ are in the ${c1} club, $${s.b}$ in the ${c2} club and $${s.c}$ in the ${c3} club. ${facts} How many students are in ${target}?`,
      answerType: 'numeric', answer: { value },
      traps: traps(value, tr),
      hints: [
        'Let $E_1$, $E_2$, $E_3$ be the numbers of students in exactly one, exactly two and all three clubs.',
        'Adding the three club sizes counts each student once for every club they are in; write that sum in terms of $E_1$, $E_2$, $E_3$.',
        'The number in at least one club is $E_1 + E_2 + E_3$, and it is the class size minus those in no club; solve the two equations together.'
      ],
      steps, reasoning
    };
  }
  return exactly(makeRng(FALLBACK_SEED));
}

/**
 * The least possible number in all three, from the singles: each of the T
 * people in at least one set is counted at most twice unless in all three, so
 * S ≤ 2T + E₃ − E₁ ≤ 2T + E₃. The bound S − 2T is attained with E₁ = 0, the
 * pairwise-only regions T − c, T − a, T − b and E₃ = S − 2T (needs a, b, c ≤ T).
 */
function least(rng) {
  for (let guard = 0; guard < 400; guard++) {
    const pct = rng() < 0.3;
    if (pct) {
      const a = ri(rng, 55, 95), b = ri(rng, 55, 95), c = ri(rng, 55, 95);
      const S = a + b + c;
      if (S <= 205) continue;
      const value = S - 200;
      const [g1, g2, g3] = rc(rng, [['a two-wheeler', 'a car', 'a bicycle'], ['a smartphone', 'a laptop', 'a smart TV'], ['a gas connection', 'a water purifier', 'a refrigerator']]);
      const city = rc(rng, IN_CITIES);
      return {
        prompt: `In a survey of the households of ${city}, $${a}\\%$ own ${g1}, $${b}\\%$ own ${g2} and $${c}\\%$ own ${g3}. What is the least possible percentage of households that own all three?`,
        answerType: 'numeric', answer: { value }, answerSuffix: '%',
        traps: traps(value, [
          { value: S - 100, why: 'That is $E_2 + 2E_3$ when every household owns at least one item, not the number owning all three.' },
          { value: Math.min(a, b, c), why: 'The smallest of the three percentages is only an upper limit for the households owning all three.' },
          { value: Math.max(0, a + b - 100), why: 'That is the least overlap of two of the items; the third must be brought in as well.' }
        ]),
        hints: [
          'Work with $100$ households. Let $E_1$, $E_2$, $E_3$ be the numbers owning exactly one, exactly two and all three items.',
          'The three percentages add up to $E_1 + 2E_2 + 3E_3$, and $E_1 + E_2 + E_3$ is at most $100$.',
          'Turn that into a lower bound for $E_3$, then build a Venn diagram with every region a whole number that reaches the bound.'
        ],
        steps: [
          { h: 'Count with multiplicity', d: `Out of $100$: $${a} + ${b} + ${c} = ${S} = E_1 + 2E_2 + 3E_3$` },
          { h: 'Bound', d: `$E_1 + 2E_2 + 3E_3 \\le 2(E_1 + E_2 + E_3) + E_3 \\le 200 + E_3$, so $E_3 \\ge ${S} - 200$` },
          { h: 'Attained', d: `Out of $100$ households: none owns exactly one item; the first two items only $${100 - c}$, the second and third only $${100 - a}$, the first and third only $${100 - b}$, all three $${value}$ — these add to $100$ and give $${a}$, $${b}$, $${c}$` },
          { h: 'Answer', d: `$${value}\\%$` }
        ],
        reasoning: 'least-all-three-percent'
      };
    }
    const N = ri(rng, 40, 120);
    const w = rng() < 0.4 ? 0 : ri(rng, 1, Math.floor(N * 0.15));
    const T = N - w;
    const a = ri(rng, Math.ceil(T * 0.55), T), b = ri(rng, Math.ceil(T * 0.55), T), c = ri(rng, Math.ceil(T * 0.55), T);
    const S = a + b + c;
    if (S <= 2 * T + 1) continue;
    const askTwo = rng() < 0.4;
    const value = askTwo ? 3 * T - S : S - 2 * T;
    if (value < 2) continue;
    const [s1, s2, s3] = rc(rng, SPORTS);
    const city = rc(rng, IN_CITIES);
    const noneText = w === 0 ? 'Every student likes at least one of the three sports.' : `Exactly $${w}$ ${pl(w, 'student likes', 'students like')} none of the three sports.`;
    const target = askTwo ? 'greatest possible number of students who like exactly two of the three sports' : 'least possible number of students who like all three sports';
    return {
      prompt: `Of the $${N}$ students in a school in ${city}, $${a}$ like ${s1}, $${b}$ like ${s2} and $${c}$ like ${s3}. ${noneText} What is the ${target}?`,
      answerType: 'numeric', answer: { value },
      traps: traps(value, askTwo
        ? [
          { value: S - T, why: 'That is $E_2 + 2E_3$; the students in all three cannot all be removed, since $E_3$ has a least value.' },
          { value: 3 * N - S, why: `Only $${T}$ students like at least one sport; the $${w}$ who like none are not in any set.` },
          { value: T, why: 'If every student who likes a sport liked exactly two, the three numbers would add up to twice that count; they add up to more.' }
        ]
        : [
          { value: S - 2 * N, why: `Only $${T}$ students like at least one sport; the $${w}$ who like none are not in any set.` },
          { value: S - T, why: 'That is $E_2 + 2E_3$, not the number who like all three.' },
          { value: Math.min(a, b, c), why: 'The smallest of the three numbers is only an upper limit for the number who like all three.' }
        ]),
      hints: [
        'Let $E_1$, $E_2$, $E_3$ be the numbers who like exactly one, exactly two and all three sports.',
        'Adding the three numbers counts each student once per sport liked; and the number who like at least one sport is fixed by the data.',
        askTwo ? 'Write $E_2$ in terms of $E_3$, find the least possible $E_3$, and check with a Venn diagram that it can occur.' : 'Use $E_1 \\ge 0$ to bound $E_3$ from below, then build a Venn diagram with whole-number regions that reaches the bound.'
      ],
      steps: [
        { h: 'Two equations', d: `$E_1 + 2E_2 + 3E_3 = ${a} + ${b} + ${c} = ${S}$ and $E_1 + E_2 + E_3 = ${w ? `${N} - ${w} = ` : ''}${T}$` },
        { h: 'Eliminate', d: `Subtracting twice the second: $E_3 - E_1 = ${S} - ${2 * T} = ${S - 2 * T}$, so $E_3 \\ge ${S - 2 * T}$ with equality when $E_1 = 0$${askTwo ? `; and $E_2 = ${S - T} - 2E_3$ is largest when $E_3$ is least` : ''}` },
        { h: 'Attained', d: `Take nobody in exactly one sport, $${S - 2 * T}$ in all three, and in exactly two: ${s1} and ${s2} $${T - c}$, ${s2} and ${s3} $${T - a}$, ${s1} and ${s3} $${T - b}$ — the regions add to $${T}$ and give $${a}$, $${b}$, $${c}$` },
        { h: 'Answer', d: `$${value}$` }
      ],
      reasoning: askTwo ? 'greatest-exactly-two' : 'least-all-three'
    };
  }
  return least(makeRng(FALLBACK_SEED));
}

function inclusionExclusionReasoning(rng) {
  return rng() < 0.55 ? exactly(rng) : least(rng);
}

// ═════════════════════════════════════════════════════════════════════════════

/** One rung, D4: every other rung returns the same form (see the header). */
const d4 = form => (rng, _diff) => form(rng);

export const forms = Object.freeze({
  'c11-set-notation-jee-reasoning': d4(setNotationReasoning),
  'c11-set-operations-jee-reasoning': d4(setOperationsReasoning),
  'c11-inclusion-exclusion-jee-reasoning': d4(inclusionExclusionReasoning)
});
