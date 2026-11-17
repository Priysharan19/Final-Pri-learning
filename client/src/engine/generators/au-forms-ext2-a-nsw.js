// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Prithagoras capacity overlay — Extension 2, slot A
// mex-proof, mex-integration, mex-demoivre, mex-mechanics, mex-vectors.
// Proof and "show that" styles are machine-keyed: the item asks for the number
// or choice that completes a step of the argument (a base-case value, the
// term added in an inductive step, the first faulty line, the constant k of a
// substitution), never a free-form proof. Every key is computed by code from
// the numbers shown in the prompt. Variants are chosen by au-forms-apply.js.
// ─────────────────────────────────────────────────────────────────────────────
import { ri, rc, rs, nz, gcd, Frac, mcq, sgn, r2, r3 } from '../qhelpers.js';

const fin = v => typeof v === 'number' && Number.isFinite(v);
const lcx = (c, v) => (c === 1 ? v : c === -1 ? `-${v}` : `${c}${v}`);          // coefficient on a variable, never "1x"
const lin = (p, q) => `${lcx(p, 'x')}${q === 0 ? '' : ` ${q < 0 ? '-' : '+'} ${Math.abs(q)}`}`; // px + q
const fac = (a) => (a === 0 ? 'x' : `(x ${a < 0 ? '+' : '-'} ${Math.abs(a)})`);   // (x - a)
const xp = p => (p === 1 ? 'x' : `x^{${p}}`);
const D = v => `\\$${String(v).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
const bigRound = (v, dp) => Math.round(v * 10 ** dp) / 10 ** dp;

/** A numeric payload; a trap equal to the key (or repeated) is not a misconception, so it is dropped. */
function num(prompt, value, { suffix, prefix, tol, traps = [], hints, steps, inputHint, extra } = {}) {
  if (!fin(value)) throw new Error('ext2-a: non-finite key');
  const seen = new Set([value]);
  const tr = [];
  for (const t of traps) if (fin(t.value) && !seen.has(t.value)) { seen.add(t.value); tr.push(tol && !t.tol ? { ...t, tol } : t); }
  const answer = { value, ...(tol ? { tol } : {}), ...(extra || {}) };
  const q = { prompt, answerType: 'numeric', answer, traps: tr, hints, steps };
  if (suffix) q.answerSuffix = suffix;
  if (prefix) q.answerPrefix = prefix;
  if (inputHint) q.inputHint = inputHint;
  return q;
}
/** A numeric payload keyed by an exact fraction (typed as a/b). */
function frac(prompt, f, { traps = [], hints, steps, suffix } = {}) {
  const extra = f.d === 1 ? {} : { simplestFraction: { n: f.n, d: f.d } };
  const trapVals = traps.map(t => (t.frac ? { value: t.frac.value, why: t.why } : t));
  return num(prompt, f.value, { traps: trapVals, hints, steps, suffix, extra, inputHint: f.d === 1 ? 'a whole number' : 'e.g. 3/13' });
}
function mc(rng, prompt, correct, ds, hints, steps) {
  const m = mcq(rng, correct, ds);
  return { prompt, answerType: 'mcq', answer: { correctIndex: m.correctIndex, optionTraps: m.optionTraps }, mcqOptions: m.options, hints, steps };
}

const isPrime = v => { if (v < 2) return false; for (let d = 2; d * d <= v; d++) if (v % d === 0) return false; return true; };
const spf = n => { for (let d = 2; d * d <= n; d++) if (n % d === 0) return d; return n; };

/** π-multiple helper: (n/d)π, reduced, with the typed form the engine accepts. */
function piFrac(n, d) {
  const f = new Frac(n, d);
  const p = f.n, q = f.d;
  if (p === 0) return { typed: '0', tex: '0', val: 0 };
  const head = p === 1 ? 'pi' : p === -1 ? '-pi' : `${p}pi`;
  const texHead = p === 1 ? '\\pi' : p === -1 ? '-\\pi' : `${p}\\pi`;
  return q === 1
    ? { typed: head, tex: texHead, val: p * Math.PI }
    : { typed: `${head}/${q}`, tex: `\\dfrac{${texHead}}{${q}}`, val: (p * Math.PI) / q };
}

// ═════════════════════════════════════════════════════════════════════════════
// MEX-P1 / P2 · The nature of proof
// ═════════════════════════════════════════════════════════════════════════════

/** Sum families for induction: closed form (numerator over denominator) and term, all integer-valued. */
function sumFamily(rng, diff) {
  const hi = 6 + 5 * diff;
  const kind = ri(rng, 1, 3);
  if (kind === 1) {
    const a = ri(rng, 1, hi);
    return { lhs: `\\displaystyle\\sum_{j=1}^{n} j(j + ${a})`, rhs: `\\dfrac{n(n+1)(2n + ${1 + 3 * a})}{6}`,
      term: j => j * (j + a), closed: n => (n * (n + 1) * (2 * n + 1 + 3 * a)) / 6, termTex: j => `${j}(${j} + ${a})`, termN: `(k+1)(k + ${a + 1})` };
  }
  if (kind === 2) {
    const a = ri(rng, 2, hi);
    return { lhs: `\\displaystyle\\sum_{j=1}^{n} \\left(3j^2 + ${a}j\\right)`, rhs: `\\dfrac{n(n+1)(2n + ${1 + a})}{2}`,
      term: j => 3 * j * j + a * j, closed: n => (n * (n + 1) * (2 * n + 1 + a)) / 2, termTex: j => `3(${j})^2 + ${a}(${j})`, termN: `3(k+1)^2 + ${a}(k+1)` };
  }
  const a = ri(rng, 2, 5 + diff * 2), b = ri(rng, 1, 5 + diff * 2);
  return { lhs: `\\displaystyle\\sum_{j=1}^{n} (${a}j + ${b})`, rhs: `\\dfrac{n(${a}n + ${a + 2 * b})}{2}`,
    term: j => a * j + b, closed: n => (n * (a * n + a + 2 * b)) / 2, termTex: j => `${a}(${j}) + ${b}`, termN: `${a}(k+1) + ${b}` };
}
const sumDirect = (f, n) => { let s = 0; for (let j = 1; j <= n; j++) s += f.term(j); return s; };

const proofForms = [
  // Base-case / early-case check of an identity to be proved by induction.
  { make: (rng, diff) => {
    const f = sumFamily(rng, diff);
    const m = ri(rng, 1, 3 + 2 * diff);
    const lhs = sumDirect(f, m), rhs = f.closed(m);
    if (lhs !== rhs) throw new Error('proof: identity mismatch');
    return num(
      `To prove by mathematical induction that $${f.lhs} = ${f.rhs}$ for all positive integers $n$, a student first checks the statement at $n = ${m}$. What common value do the two sides take?`,
      rhs,
      { traps: [{ value: f.term(m), why: `That is only the last term; the left-hand side is the SUM of the first ${m} term${m === 1 ? '' : 's'}.` }, { value: lhs + f.term(m + 1), why: `That adds the term for $j = ${m + 1}$ as well — the sum stops at $j = ${m}$.` }],
        hints: [`Substitute $n = ${m}$ into the right-hand side.`, `The left-hand side adds the terms for $j = 1$ up to $j = ${m}$.`, `Both sides equal $${rhs}$.`],
        steps: [{ h: 'Right-hand side', d: `$${rhs}$` }, { h: 'Left-hand side', d: `$${Array.from({ length: m }, (_, i) => f.term(i + 1)).join(' + ')} = ${lhs}$` }, { h: 'Conclusion', d: `The sides agree, so the base case holds.` }] });
  } },
  // Inductive step: the term added to both sides.
  { make: (rng, diff) => {
    const f = sumFamily(rng, diff);
    const k = ri(rng, 2, 6 + 3 * diff);
    const added = f.closed(k + 1) - f.closed(k);
    if (added !== f.term(k + 1)) throw new Error('proof: step mismatch');
    return num(
      `In the inductive step for $${f.lhs} = ${f.rhs}$, assume the statement is true for $n = k$ and add the next term to both sides. For $k = ${k}$, what is the value of that next term?`,
      added,
      { traps: [{ value: f.term(k), why: `The next term is the one for $j = k + 1 = ${k + 1}$, not $j = ${k}$.` }, { value: f.closed(k), why: `That is the assumed sum for $n = ${k}$; the question asks for the single term added to reach $n = ${k + 1}$.` }],
        hints: ['Going from $n = k$ to $n = k + 1$ adds one term to the sum.', `That term is the general term evaluated at $j = ${k + 1}$.`, `$${f.termTex(k + 1)} = ${added}$.`],
        steps: [{ h: 'Next term', d: `$j = k + 1 = ${k + 1}$` }, { h: 'Evaluate', d: `$${f.termTex(k + 1)} = ${added}$` }, { h: 'Check', d: `It equals $S(${k + 1}) - S(${k}) = ${f.closed(k + 1)} - ${f.closed(k)} = ${added}$.` }] });
  } },
  // Divisibility: the coefficient that makes the inductive step work.
  { make: (rng, diff) => {
    const a = ri(rng, 3 + diff, 12 + 6 * diff), c = ri(rng, 1, a - 1);
    const key = a - c;
    // a^(k+1) - c^(k+1) = a(a^k - c^k) + m c^k
    const k = 3, lhs = a ** (k + 1) - c ** (k + 1), rest = a * (a ** k - c ** k) + key * c ** k;
    if (lhs !== rest) throw new Error('proof: divisibility identity');
    return num(
      `To prove that $${a}^n - ${c}^n$ is divisible by $${a - c}$ for every positive integer $n$ by induction, the inductive step rewrites $${a}^{k+1} - ${c}^{k+1}$ as $${a}\\left(${a}^{k} - ${c}^{k}\\right) + m \\cdot ${c}^{k}$. Find $m$.`,
      key,
      { prefix: 'm =', traps: [{ value: a, why: `$${a}$ is the multiplier on the first bracket; the leftover multiple of $${c}^k$ is $${a} - ${c}$.` }, { value: c - a, why: 'Check the sign: $a^{k+1} - c^{k+1} = a(a^k - c^k) + (a - c)c^k$.' }],
        hints: [`Expand $${a}(${a}^k - ${c}^k) = ${a}^{k+1} - ${a}\\cdot${c}^k$.`, `What must be added to get $-${c}^{k+1} = -${c}\\cdot${c}^k$ ?`, `$m = ${a} - ${c} = ${key}$.`],
        steps: [{ h: 'Expand the bracket', d: `$${a}\\left(${a}^k - ${c}^k\\right) = ${a}^{k+1} - ${a}\\cdot${c}^k$` }, { h: 'Match the target', d: `$${a}^{k+1} - ${c}\\cdot${c}^k = \\left[${a}^{k+1} - ${a}\\cdot${c}^k\\right] + (${a} - ${c})${c}^k$` }, { h: 'Read off m', d: `$m = ${key}$, a multiple of $${key}$ ✓` }] });
  } },
  // Inequality by induction: from which n does the statement hold for ever after?
  { make: (rng, diff) => {
    const fam = ri(rng, 1, 3);
    let stmt, holds, hintLine;
    if (fam === 1) { const b = ri(rng, 2, 5 + diff * 2); stmt = `n! > ${b}^n`; holds = n => { let f = 1n; for (let i = 2n; i <= BigInt(n); i++) f *= i; return f > BigInt(b) ** BigInt(n); }; hintLine = `Each step multiplies the left side by $k + 1$ and the right side by $${b}$.`; }
    else if (fam === 2) { const b = ri(rng, 2, 4), c = ri(rng, 2, 4 + (diff > 2 ? 1 : 0)); stmt = `${b}^n > n^${c}`; holds = n => BigInt(b) ** BigInt(n) > BigInt(n) ** BigInt(c); hintLine = `Compare how fast $${b}^n$ and $n^{${c}}$ grow.`; }
    else { const b = ri(rng, 2, 4), c = ri(rng, 2, 8 * diff + 4); stmt = `${b}^n > ${c}n^2`; holds = n => BigInt(b) ** BigInt(n) > BigInt(c) * BigInt(n) ** 2n; hintLine = `Try successive values of $n$ and watch the two sides cross.`; }
    let last = 0; for (let n = 1; n <= 90; n++) if (!holds(n)) last = n;
    if (last < 1 || last > 80) return proofForms[0].make(rng, diff);
    const N = last + 1;
    return num(
      `A student wants to prove by induction that $${stmt}$ for all integers $n \\ge N$. Find the smallest positive integer $N$ for which the statement is true for $n = N$ and every integer after it.`,
      N,
      { traps: [{ value: last, why: `The statement fails at $n = ${last}$, so it cannot be the starting value.` }, { value: N + 1, why: `The statement is already true at $n = ${N}$ — that is the smallest starting value.` }],
        hints: [hintLine, 'Test $n = 1, 2, 3, \\ldots$ and find the LAST value where the statement fails.', `It fails at $n = ${last}$ and holds from $n = ${N}$ on.`],
        steps: [{ h: 'Test small cases', d: `The statement is false at $n = ${last}$ and true for every $n \\ge ${N}$ (checked directly, then secured by the inductive step).` }, { h: 'Base case', d: `$N = ${N}$` }] });
  } },
  // First faulty line of an algebraic "show that".
  { make: (rng, diff) => {
    const A = ri(rng, 2, 4 + diff), b = ri(rng, 1, 3 + diff);
    const mode = rc(rng, [0, 2, 3, 4]);   // 0 = no error, 2/3/4 = faulty line
    const w = `${A * A}n^2`;
    const L = [
      `(${A}n + ${b})^2 - (${A}n - ${b})^2`,
      mode === 2 ? `(${w} + ${2 * A * b}n + ${b * b}) - (${w} + ${b * b})` : `(${w} + ${2 * A * b}n + ${b * b}) - (${w} - ${2 * A * b}n + ${b * b})`,
      mode === 2 ? `${w} + ${2 * A * b}n + ${b * b} - ${w} - ${b * b}`
        : mode === 3 ? `${w} + ${2 * A * b}n + ${b * b} - ${w} - ${2 * A * b}n - ${b * b}` : `${w} + ${2 * A * b}n + ${b * b} - ${w} + ${2 * A * b}n - ${b * b}`,
      mode === 2 ? `${2 * A * b}n` : mode === 3 ? '0' : mode === 4 ? `${2 * A * b}n` : `${4 * A * b}n`
    ];
    const first = mode === 0 ? 'none' : mode;
    const text = i => `Line ${i}`;
    const opts = [text(2), text(3), text(4), 'There is no error'];
    const correct = first === 'none' ? opts[3] : opts[first - 2];
    const why = { 'Line 2': 'Line 2 expands both squares correctly — check each bracket against $(p \\pm q)^2 = p^2 \\pm 2pq + q^2$.', 'Line 3': 'Line 3 only removes the brackets; check that the minus sign reaches every term of the second bracket.', 'Line 4': 'Line 4 only collects like terms; recount the $n$ terms.', 'There is no error': 'Check each line once more: a sign slip is easy to miss.' };
    const m = mc(rng, `A student shows that $(${A}n + ${b})^2 - (${A}n - ${b})^2$ is a multiple of $${4 * A * b}$ for every integer $n$:\n\nLine 1: $${L[0]}$\nLine 2: $= ${L[1]}$\nLine 3: $= ${L[2]}$\nLine 4: $= ${L[3]}$\n\nWhich line contains the **first** error, if any?`, correct,
      opts.filter(o => o !== correct).map(o => ({ text: o, why: why[o] })),
      ['Check each line against the previous one, starting at the top.', 'Look at signs when a bracket is removed after a minus sign.', 'The correct result is $' + 4 * A * b + 'n$.'],
      [{ h: 'Correct expansion', d: `$(${A}n + ${b})^2 = ${w} + ${2 * A * b}n + ${b * b}$ and $(${A}n - ${b})^2 = ${w} - ${2 * A * b}n + ${b * b}$` }, { h: 'Subtract', d: `$= ${4 * A * b}n$, a multiple of $${4 * A * b}$ ∎` }, { h: 'The faulty line', d: first === 'none' ? 'Every line is correct.' : `The first error is in Line ${first}.` }]);
    return m;
  } },
  // Euclid-style: N = product of listed primes ± 1 has a prime factor outside the list.
  { make: (rng, diff) => {
    const pool = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29];
    const size = ri(rng, 3, 3 + Math.min(diff, 2));
    const set = []; const bag = pool.slice();
    while (set.length < size) set.push(bag.splice(ri(rng, 0, bag.length - 1), 1)[0]);
    set.sort((x, y) => x - y);
    const plus = rng() < 0.6;
    const N = set.reduce((x, y) => x * y, 1) + (plus ? 1 : -1);
    const key = spf(N);
    if (set.includes(key)) throw new Error('proof: euclid');
    return num(
      `In a proof that there are infinitely many primes, suppose the only primes were $${set.join(', ')}$, and form $N = ${set.join(' \\times ')} ${plus ? '+' : '-'} 1 = ${N}$. Find the smallest prime factor of $N$ — it cannot be on the list.`,
      key,
      { traps: [{ value: N, why: `$${N}$ is only prime if it has no smaller prime factor — check by division.` }, { value: set[set.length - 1], why: `Every listed prime leaves remainder $${plus ? 1 : set[0] - 1}$ or similar when dividing $N$, so none of them divides $N$.` }],
        hints: ['$N$ leaves remainder $\\pm 1$ on division by each listed prime.', 'So its prime factors are all different from the listed primes.', `Test the primes in order; the smallest to divide $${N}$ is $${key}$.`],
        steps: [{ h: 'Compute N', d: `$N = ${N}$` }, { h: 'Divide by primes in order', d: `The smallest prime factor is $${key}$${key === N ? ' ($N$ is itself prime)' : ''}` }, { h: 'Conclusion', d: `$${key}$ is a prime not on the list, contradicting the assumption ∎` }] });
  } },
  // Counterexample to "m | a^2 implies m | a".
  { make: (rng, diff) => {
    const sqfree = v => { for (let d = 2; d * d <= v; d++) if (v % (d * d) === 0) return false; return true; };
    let M = 0;
    for (let i = 0; i < 80 && !M; i++) { const c = ri(rng, 4, 30 + 30 * diff); if (!sqfree(c)) M = c; }
    if (!M) M = 12;
    let a = 1; while (!((a * a) % M === 0 && a % M !== 0)) a++;
    return num(
      `A student claims: "if $${M}$ divides $a^2$ then $${M}$ divides $a$". Find the smallest positive integer $a$ that is a **counterexample**.`,
      a,
      { traps: [{ value: M, why: `$${M}$ divides itself, so it satisfies both parts of the claim and is no counterexample.` }, { value: a * a, why: 'The counterexample is the value of $a$, not of $a^2$.' }],
        hints: ['A counterexample makes the first part true and the second part false.', `Test $a = 1, 2, 3, \\ldots$ and check $${M} \\mid a^2$ and $${M} \\nmid a$.`, `$${a}^2 = ${a * a}$ is divisible by $${M}$, but $${a}$ is not.`],
        steps: [{ h: 'Search', d: `For $a < ${a}$ either $${M} \\nmid a^2$ or $${M} \\mid a$.` }, { h: 'The counterexample', d: `$a = ${a}$: $${a * a} = ${M} \\times ${(a * a) / M}$, yet $${M} \\nmid ${a}$.` }] });
  } },
  // AM–GM: minimum of px + N/x.
  { make: (rng, diff) => {
    const p = ri(rng, 1, 2 + diff), N = ri(rng, 2, 20 * diff + 10);
    const lo = 2 * Math.sqrt(p * N), at = Math.sqrt(N / p);
    if (Number.isInteger(lo) && Number.isInteger(at)) return proofForms[0].make(rng, diff);
    const wantMin = rng() < 0.55;
    const ex = `${p === 1 ? '' : p}x + \\dfrac{${N}}{x}`;
    return wantMin
      ? num(`Using the inequality $\\dfrac{u + v}{2} \\ge \\sqrt{uv}$ (for $u, v > 0$), find the minimum value of $${ex}$ for $x > 0$, correct to 2 decimal places.`, r2(lo),
        { tol: 0.011, traps: [{ value: r2(Math.sqrt(p * N)), why: 'The inequality gives $u + v \\ge 2\\sqrt{uv}$ — the factor of 2 is part of the bound.' }, { value: r2(p + N), why: 'That is the value at $x = 1$, not the minimum.' }],
          hints: ['Take $u = ' + `${p === 1 ? '' : p}x` + '$ and $v = ' + `\\dfrac{${N}}{x}` + '$.', `$uv = ${p * N}$ is constant.`, `So $u + v \\ge 2\\sqrt{${p * N}}$.`],
          steps: [{ h: 'Apply AM–GM', d: `$${ex} \\ge 2\\sqrt{${p === 1 ? '' : `${p}x \\cdot `}${p === 1 ? `x \\cdot ` : ''}\\dfrac{${N}}{x}} = 2\\sqrt{${p * N}}$` }, { h: 'Evaluate', d: `$\\approx ${r2(lo)}$` }] })
      : num(`Using the inequality $\\dfrac{u + v}{2} \\ge \\sqrt{uv}$ (for $u, v > 0$), the expression $${ex}$ for $x > 0$ is smallest when $u = v$. Find that value of $x$, correct to 2 decimal places.`, r2(at),
        { tol: 0.011, traps: [{ value: r2(lo), why: 'That is the minimum VALUE of the expression, not the $x$ at which it occurs.' }, { value: r2(N / p), why: `Setting the two terms equal gives $${p === 1 ? '' : p}x^2 = ${N}$, so $x = \\sqrt{${N}/${p}}$, not $\\dfrac{${N}}{${p}}$.` }],
          hints: ['Equality in AM–GM needs $u = v$.', `$${p === 1 ? '' : p}x = \\dfrac{${N}}{x}$.`, `$x^2 = \\dfrac{${N}}{${p}}$.`],
          steps: [{ h: 'Equality case', d: `$${p === 1 ? '' : p}x = \\dfrac{${N}}{x} \\Rightarrow x^2 = \\dfrac{${N}}{${p}}$` }, { h: 'Solve for x > 0', d: `$x \\approx ${r2(at)}$` }] });
  } },
  // "Show that" the product of three consecutive integers is divisible by 6.
  { make: (rng, diff) => {
    const m = ri(rng, 3, 30 * diff + 20);
    const key = ((m - 1) * m * (m + 1)) / 6;
    if ((m - 1) * m * (m + 1) % 6 !== 0) throw new Error('proof: 6 | product');
    return num(
      `To show that $n^3 - n$ is divisible by $6$ for every integer $n$, a student factorises it as $(n - 1)n(n + 1)$ — three consecutive integers. For $n = ${m}$, find the quotient $\\dfrac{n^3 - n}{6}$.`,
      key,
      { traps: [{ value: m ** 3 - m, why: 'That is $n^3 - n$ itself; the question asks for the result AFTER dividing by $6$.' }, { value: Math.round((m * m * m) / 6), why: `Do not drop the $-n$: $n^3 - n = ${m ** 3} - ${m}$.` }],
        hints: ['Evaluate $n^3 - n$ first.', `$${m}^3 - ${m} = ${m ** 3 - m}$.`, 'Divide by $6$.'],
        steps: [{ h: 'Factorise', d: `$n^3 - n = (n-1)\\,n\\,(n+1) = ${m - 1} \\times ${m} \\times ${m + 1}$` }, { h: 'Divide', d: `$\\dfrac{${(m - 1) * m * (m + 1)}}{6} = ${key}$` }, { h: 'Why it always works', d: 'Among three consecutive integers one is a multiple of $3$ and at least one is even ∎' }] });
  } }
];

// ═════════════════════════════════════════════════════════════════════════════
// MEX-N1 · De Moivre
// ═════════════════════════════════════════════════════════════════════════════
const DIV360 = [3, 4, 5, 6, 8, 9, 10, 12, 15, 18, 20, 24, 30, 36, 40, 45, 60, 72, 90, 120, 180];
const POLAR_BASES = [
  { tex: '1 + i', t: 3, root2: true }, { tex: '1 - i', t: -3, root2: true }, { tex: '-1 + i', t: 9, root2: true },
  { tex: '\\sqrt{3} + i', t: 2 }, { tex: '1 + \\sqrt{3}i', t: 4 }, { tex: '\\sqrt{3} - i', t: -2 }, { tex: '-\\sqrt{3} + i', t: 10 }
];
const demoivreForms = [
  // Smallest n with (cis θ)^n = 1.
  { make: (rng, diff) => {
    const m = rc(rng, DIV360);
    const j = ri(rng, 1, m - 1);
    const th = (360 * j) / m;
    let n = 1; while ((n * th) % 360 !== 0) n++;
    const key = m / gcd(j, m);
    if (n !== key) throw new Error('demoivre: order');
    return num(`Find the smallest positive integer $n$ for which $\\left(\\cos ${th}° + i\\sin ${th}°\\right)^{n} = 1$.`, key,
      { traps: [{ value: m, why: `That works, but it is not the smallest unless $\\gcd(${j}, ${m}) = 1$ — look for a smaller multiple of $360°$.` }, { value: 360 / th, why: `$\\dfrac{360}{${th}}$ is not a whole number here — you need $n\\theta$ to be a whole multiple of $360°$.` }],
        hints: ['De Moivre: the argument of the power is $n\\theta$.', `You need $n \\times ${th}°$ to be a multiple of $360°$.`, `$n = ${key}$ gives $${key * th}° = ${(key * th) / 360} \\times 360°$.`],
        steps: [{ h: "De Moivre's theorem", d: `$\\left(\\text{cis}\\,${th}°\\right)^n = \\text{cis}\\,(${th}n)°$` }, { h: 'Return to 1', d: `Need $${th}n$ to be a multiple of $360$; the smallest $n$ is $${key}$.` }] });
  } },
  // A power that is real: its value by De Moivre.
  { make: (rng, diff) => {
    for (let tries = 0; tries < 40; tries++) {
      const b = rc(rng, POLAR_BASES);
      const k = ri(rng, 1, 1 + diff);
      const n = ri(rng, 2, 12);
      if ((b.t * n) % 12 !== 0) continue;
      const modPow = b.root2 ? 2 ** (n / 2) : 2 ** n;
      if (b.root2 && n % 2) continue;
      const sign = ((b.t * n) / 12) % 2 === 0 ? 1 : -1;
      const val = sign * k ** n * modPow;
      if (Math.abs(val) > 4e6) continue;
      const zt = k === 1 ? `(${b.tex})` : `${k}(${b.tex})`;
      const modTex = b.root2 ? `${k === 1 ? '' : `${k}`}\\sqrt{2}` : String(2 * k);
      return num(`Use De Moivre's theorem to show that $${zt}^{${n}}$ is a real number, and find its value.`, val,
        { traps: [{ value: -val, why: `Check the sign: the argument of the power is $${n} \\times ${piFrac(b.t, 12).tex} = ${piFrac(b.t * n, 12).tex}$, which gives $\\cos = ${sign}$.` }, { value: sign * k ** n * Math.abs(b.root2 ? 2 * n : 2 * n), why: 'The modulus is RAISED to the power $n$, not multiplied by $n$.' }],
          hints: [`$|z| = ${modTex}$ and $\\arg z = ${piFrac(b.t, 12).tex}$.`, `$|z^{${n}}| = (${modTex})^{${n}}$ and $\\arg z^{${n}} = ${piFrac(b.t * n, 12).tex}$.`, `The argument is a multiple of $\\pi$, so the power is real.`],
          steps: [{ h: 'Polar form', d: `$z = ${modTex}\\,\\text{cis}\\left(${piFrac(b.t, 12).tex}\\right)$` }, { h: "De Moivre's theorem", d: `$z^{${n}} = ${bigRound(Math.abs(val), 0)}\\,\\text{cis}\\left(${piFrac(b.t * n, 12).tex}\\right)$` }, { h: 'Real value', d: `$\\text{cis}(${piFrac(b.t * n, 12).tex}) = ${sign}$, so $z^{${n}} = ${val}$` }] });
    }
    return demoivreForms[0].make(rng, diff);
  } },
  // Re or Im of a power of a polar-form number, 2 dp.
  { make: (rng, diff) => {
    for (let tries = 0; tries < 60; tries++) {
      const r = ri(rng, 2, 3 + diff), th = rc(rng, [10, 12, 15, 18, 20, 24, 25, 28, 32, 35, 36, 40, 42, 50, 55, 65, 70]), n = ri(rng, 2, 9);
      const wantRe = rng() < 0.5;
      const ang = (n * th * Math.PI) / 180;
      const val = r ** n * (wantRe ? Math.cos(ang) : Math.sin(ang));
      if (Math.abs(val) < 0.5 || Math.abs(val) > 1e5) continue;
      return num(`Given $z = ${r}\\left(\\cos ${th}° + i\\sin ${th}°\\right)$, find the ${wantRe ? '**real**' : '**imaginary**'} part of $z^{${n}}$, correct to 2 decimal places.`, r2(val),
        { tol: 0.011, traps: [{ value: r2((r * n) * (wantRe ? Math.cos(ang) : Math.sin(ang))), why: `The modulus becomes $${r}^{${n}}$, not $${r} \\times ${n}$.` }, { value: r2(r ** n * (wantRe ? Math.cos((th + n) * Math.PI / 180) : Math.sin((th + n) * Math.PI / 180))), why: `The argument is MULTIPLIED by $${n}$: $${n} \\times ${th}° = ${n * th}°$.` }],
          hints: [`$|z^{${n}}| = ${r}^{${n}} = ${r ** n}$ and $\\arg z^{${n}} = ${n * th}°$.`, `${wantRe ? 'Re' : 'Im'}$(z^{${n}}) = ${r ** n}\\${wantRe ? 'cos' : 'sin'}(${n * th}°)$.`, 'Make sure the calculator is in degrees.'],
          steps: [{ h: "De Moivre's theorem", d: `$z^{${n}} = ${r ** n}\\left(\\cos ${n * th}° + i\\sin ${n * th}°\\right)$` }, { h: wantRe ? 'Real part' : 'Imaginary part', d: `$${r ** n}\\${wantRe ? 'cos' : 'sin'}(${n * th}°) \\approx ${r2(val)}$` }] });
    }
    return demoivreForms[0].make(rng, diff);
  } },
  // Argument of the k-th root of z^n = w.
  { make: (rng, diff) => {
    const n = ri(rng, 3, 4 + 2 * diff);
    const arg = rc(rng, [[1, 6], [1, 4], [1, 3], [1, 2], [2, 3], [3, 4], [5, 6], [-1, 6], [-1, 4], [-1, 3], [-1, 2], [-2, 3], [-3, 4], [-5, 6], [1, 1]]);
    const kk = ri(rng, 1, n - 1);
    const argF = piFrac(0, 1);
    const f = new Frac(arg[0] + 2 * kk * arg[1], arg[1] * n);   // (θ + 2πk)/n in units of π
    const key = piFrac(f.n, f.d);
    const th = piFrac(arg[0], arg[1]);
    const r = ri(rng, 2, 3);
    void argF;
    return num(`The complex number $w$ has modulus $${r ** n}$ and argument $${th.tex}$. The $${n}$ roots of $z^{${n}} = w$ have arguments $\\dfrac{\\theta + 2k\\pi}{${n}}$ for $k = 0, 1, \\ldots, ${n - 1}$. Find the argument of the root with $k = ${kk}$, exactly, in radians.`, key.val,
      { extra: { requireExact: true, canonicalInput: key.typed }, inputHint: 'e.g. 3pi/4',
        traps: [{ value: piFrac(arg[0], arg[1] * n).val, why: `That is the $k = 0$ root. Add $\\dfrac{2\\pi k}{${n}}$ for $k = ${kk}$.`, tol: 0.001 }, { value: piFrac(2 * kk + arg[0] / arg[1], 1).val === undefined ? 0 : (arg[0] / arg[1] + 2 * kk) * Math.PI, why: `Divide by $n = ${n}$ after adding $2k\\pi$ — the whole argument is shared among the roots.`, tol: 0.001 }],
        hints: [`Substitute $\\theta = ${th.tex}$ and $k = ${kk}$.`, `$\\dfrac{${th.tex} + ${2 * kk}\\pi}{${n}}$.`, `$= ${key.tex}$.`],
        steps: [{ h: 'Roots formula', d: `$\\arg z = \\dfrac{\\theta + 2k\\pi}{${n}}$` }, { h: 'Substitute', d: `$\\dfrac{${th.tex} + ${2 * kk}\\pi}{${n}} = ${key.tex}$` }, { h: 'Modulus (for reference)', d: `Every root has modulus $${r}$.` }] });
  } },
  // How many roots of z^n = ±c lie in the upper half-plane?
  { make: (rng, diff) => {
    const n = ri(rng, 3, 8 + 4 * diff), neg = rng() < 0.5, c = ri(rng, 2, 9);
    let key = 0; const s = neg ? 1 : 0;
    for (let k = 0; k < n; k++) { const v = (2 * k + s) % (2 * n); if (v > 0 && v < n) key++; }
    if (key === 0) return demoivreForms[0].make(rng, diff);
    return num(`The $${n}$ roots of $z^{${n}} = ${neg ? '-' : ''}${c}$ are equally spaced around a circle in the Argand plane. How many of them have a **positive** imaginary part?`, key,
      { traps: [{ value: n, why: 'Only roots strictly above the real axis count.' }, { value: Math.floor(n / 2), why: neg ? `Because $${n}$ roots of a negative number sit at odd multiples of $\\dfrac{\\pi}{${n}}$, the count is not simply $\\lfloor n/2 \\rfloor$ — list the arguments.` : 'Roots on the real axis have zero imaginary part and are excluded; check whether one lies on the axis.' }],
        hints: [`The arguments are $\\dfrac{${neg ? '(2k + 1)' : '2k'}\\pi}{${n}}$ for $k = 0, \\ldots, ${n - 1}$.`, 'Positive imaginary part means the argument lies strictly between $0$ and $\\pi$.', `Counting gives $${key}$.`],
        steps: [{ h: 'List the arguments', d: `$\\dfrac{${neg ? '(2k + 1)' : '2k'}\\pi}{${n}}$, $k = 0, \\ldots, ${n - 1}$` }, { h: 'Those in (0, π)', d: `${key} of them` }] });
  } },
  // MCQ: which expression is z^n in polar form?
  { make: (rng, diff) => {
    const r = ri(rng, 2, 3 + diff), th = rc(rng, [20, 24, 25, 30, 36, 40, 45, 50, 60]), n = ri(rng, 3, 8);
    const cis = (m, a) => `${m}\\left(\\cos ${a}° + i\\sin ${a}°\\right)`;
    const correct = `$${cis(r ** n, n * th)}$`;
    return mc(rng, `Using De Moivre's theorem, which expression equals $\\left[${cis(r, th)}\\right]^{${n}}$?`, correct, [
      { text: `$${cis(r * n, n * th)}$`, why: `The modulus is raised to the power $${n}$ — it is not multiplied by $${n}$.` },
      { text: `$${cis(r ** n, th ** 1 + n)}$`, why: `The argument is multiplied by $${n}$, not increased by $${n}$.` },
      { text: `$${cis(r, n * th)}$`, why: `The modulus must also be raised to the power $${n}$.` }
    ], ['De Moivre: $(r\\,\\text{cis}\\,\\theta)^n = r^n\\,\\text{cis}\\,n\\theta$.', `Raise the modulus $${r}$ to the power $${n}$.`, `Multiply the argument $${th}°$ by $${n}$.`],
    [{ h: "De Moivre's theorem", d: `$(r\\,\\text{cis}\\,\\theta)^n = r^n\\,\\text{cis}\\,n\\theta$` }, { h: 'Apply', d: `$= ${cis(r ** n, n * th)}$` }]);
  } },
  // Area of the regular polygon formed by the roots of z^n = r^n.
  { make: (rng, diff) => {
    const n = ri(rng, 3, 10 + 6 * diff), r = ri(rng, 1, 2 + diff);
    const area = 0.5 * n * r * r * Math.sin((2 * Math.PI) / n);
    const rhs = r ** n;
    if (rhs > 1e9) return demoivreForms[0].make(rng, diff);
    return num(`The $${n}$ roots of $z^{${n}} = ${rhs}$ lie at the vertices of a regular polygon in the Argand plane. Find its area, correct to 2 decimal places.`, r2(area),
      { tol: 0.011, suffix: 'square units', traps: [{ value: r2(0.5 * n * r * Math.sin((2 * Math.PI) / n)), why: `Each triangle from the origin has two sides of length $${r}$ — the radius is squared in the area.` }, { value: r2(0.5 * n * r * r * Math.sin(Math.PI / n)), why: `The angle at the origin between neighbouring roots is $\\dfrac{2\\pi}{${n}}$, not $\\dfrac{\\pi}{${n}}$.` }],
        hints: [`Every root has modulus $\\sqrt[${n}]{${rhs}} = ${r}$.`, `Join the origin to the vertices to make ${n} congruent triangles with angle $\\dfrac{2\\pi}{${n}}$ at the origin.`, `Area $= ${n} \\times \\tfrac{1}{2}(${r})^2\\sin\\dfrac{2\\pi}{${n}}$.`],
        steps: [{ h: 'Radius', d: `$|z| = ${r}$` }, { h: 'Triangles', d: `${n} triangles, each $\\tfrac{1}{2}\\cdot${r}\\cdot${r}\\sin\\dfrac{2\\pi}{${n}}$` }, { h: 'Total', d: `$\\approx ${r2(area)}$` }] });
  } }
];

// ═════════════════════════════════════════════════════════════════════════════
// MEX-C1 · Further integration
// ═════════════════════════════════════════════════════════════════════════════
const integrationForms = [
  // Parts with a trig factor over an exact limit.
  { make: (rng, diff) => {
    const n = ri(rng, 1, 2 + 2 * diff), c = ri(rng, 1, 6 * diff + 3);
    const useSin = rng() < 0.5;
    const lead = c === 1 ? '' : c;
    const nx = n === 1 ? 'x' : `${n}x`;
    const up = n === 1 ? '\\dfrac{\\pi}{2}' : `\\dfrac{\\pi}{${2 * n}}`;
    if (useSin) {
      const f = new Frac(c, n * n);
      return frac(`Use integration by parts to evaluate $\\displaystyle\\int_0^{${up}} ${lead}x\\sin(${nx})\\,dx$ exactly.`, f,
        { traps: [{ frac: new Frac(c, n), why: `After parts the remaining integral $\\dfrac{1}{${n}}\\int\\cos(${nx})\\,dx$ brings a second factor of $\\dfrac{1}{${n}}$.` }, { frac: new Frac(-c, n * n), why: 'Check the sign of the first term: $\\left[-\\dfrac{x\\cos(nx)}{n}\\right]$ vanishes at both limits here, leaving a positive result.' }],
          hints: [`Parts with $u = x$ and $dv = \\sin(${nx})\\,dx$.`, `Antiderivative: $${lead}\\left[-\\dfrac{x\\cos(${nx})}{${n}} + \\dfrac{\\sin(${nx})}{${n * n}}\\right]$.`, `At $x = ${up.replace('\\dfrac', '')}$ the cosine is $0$ and the sine is $1$.`],
          steps: [{ h: 'Integrate by parts', d: `$${lead}\\left[-\\dfrac{x\\cos(${nx})}{${n}} + \\dfrac{\\sin(${nx})}{${n * n}}\\right]_0^{${up}}$` }, { h: 'Evaluate at the limits', d: `The first term is $0$ at both limits; $\\sin$ gives $\\dfrac{1}{${n * n}}$ at the top and $0$ at the bottom.` }, { h: 'Result', d: `$${f.latex()}$` }] });
    }
    const val = c * (Math.PI / 2 - 1) / (n * n);
    return num(`Use integration by parts to evaluate $\\displaystyle\\int_0^{${up}} ${lead}x\\cos(${nx})\\,dx$, correct to 3 decimal places.`, r3(val),
      { tol: 0.002, traps: [{ value: r3(c * (Math.PI / 2) / (n * n)), why: `The $\\cos$ term of the antiderivative does not vanish at $x = 0$: it contributes $-\\dfrac{${c}}{${n * n}}$.` }, { value: r3(c * (1 - Math.PI / 2) / (n * n)), why: 'Check the order of subtraction: upper limit minus lower limit.' }],
        hints: [`Parts with $u = x$ and $dv = \\cos(${nx})\\,dx$.`, `Antiderivative: $${lead}\\left[\\dfrac{x\\sin(${nx})}{${n}} + \\dfrac{\\cos(${nx})}{${n * n}}\\right]$.`, 'Evaluate at both limits.'],
        steps: [{ h: 'Integrate by parts', d: `$${lead}\\left[\\dfrac{x\\sin(${nx})}{${n}} + \\dfrac{\\cos(${nx})}{${n * n}}\\right]_0^{${up}}$` }, { h: 'Upper limit', d: `$${lead}\\cdot\\dfrac{\\pi}{${2 * n * n}}$` }, { h: 'Lower limit and result', d: `$\\approx ${r3(val)}$` }] });
  } },
  // Logarithms by parts.
  { make: (rng, diff) => {
    if (rng() < 0.5) {
      const p = ri(rng, 1, 2 + diff), c = ri(rng, 1, 4 * diff + 2);
      const val = c * (p * Math.E ** (p + 1) + 1) / (p + 1) ** 2;
      return num(`Evaluate $\\displaystyle\\int_1^{e} ${c === 1 ? '' : c}${xp(p)}\\ln x\\,dx$, correct to 3 decimal places.`, r3(val),
        { tol: 0.002, traps: [{ value: r3(c * (p * Math.E ** (p + 1) - 1) / (p + 1) ** 2), why: `The lower limit gives $-\\left(-\\dfrac{1}{${p + 1}^2}\\right) = +\\dfrac{1}{${(p + 1) ** 2}}$ — mind the double negative.` }, { value: r3(c * Math.E ** (p + 1) / (p + 1)), why: 'Parts leaves $-\\int \\dfrac{x^{p}}{p+1}\\,dx$ behind; the first term alone is not the integral.' }],
          hints: [`Parts with $u = \\ln x$ and $dv = ${xp(p)}\\,dx$.`, `Antiderivative: $\\dfrac{x^{${p + 1}}\\ln x}{${p + 1}} - \\dfrac{x^{${p + 1}}}{${(p + 1) ** 2}}$.`, 'Substitute $x = e$ then $x = 1$ and subtract.'],
          steps: [{ h: 'Integrate by parts', d: `$${c === 1 ? '' : c}\\left[\\dfrac{x^{${p + 1}}\\ln x}{${p + 1}} - \\dfrac{x^{${p + 1}}}{${(p + 1) ** 2}}\\right]_1^{e}$` }, { h: 'Evaluate', d: `$${c === 1 ? '' : c}\\cdot\\dfrac{${p}e^{${p + 1}} + 1}{${(p + 1) ** 2}} \\approx ${r3(val)}$` }] });
    }
    const a = ri(rng, 2, 6 + 3 * diff), c = ri(rng, 1, 3 * diff + 2);
    const val = c * (a * Math.log(a) - a + 1);
    return num(`Evaluate $\\displaystyle\\int_1^{${a}} ${c === 1 ? '' : c}\\ln x\\,dx$, correct to 3 decimal places. (Hint: write $\\ln x$ as $1 \\times \\ln x$.)`, r3(val),
      { tol: 0.002, traps: [{ value: r3(c * (a * Math.log(a) - a)), why: 'At the lower limit the antiderivative $x\\ln x - x$ equals $-1$, which must be subtracted.' }, { value: r3(c * Math.log(a)), why: '$\\ln x$ does not integrate to $\\ln$ of something simple — use parts with $u = \\ln x$, $dv = dx$.' }],
        hints: ['Parts: $u = \\ln x$, $dv = 1\\,dx$.', 'Antiderivative: $x\\ln x - x$.', `Evaluate from $1$ to $${a}$.`],
        steps: [{ h: 'Integrate by parts', d: `$${c === 1 ? '' : c}\\left[x\\ln x - x\\right]_1^{${a}}$` }, { h: 'Evaluate', d: `$${c === 1 ? '' : c}\\left[(${a}\\ln ${a} - ${a}) - (-1)\\right] \\approx ${r3(val)}$` }] });
  } },
  // Substitution: find the constant k (a "show that" step).
  { make: (rng, diff) => {
    const kind = ri(rng, 1, 6), c = ri(rng, 1, 5 + 3 * diff), a = ri(rng, 1, 2 + diff), b = ri(rng, 1, 7), n = ri(rng, 2, 4 + diff);
    let uTex, intTex, f, pw = n;
    const cl = c === 1 ? '' : c;
    if (kind === 1) { uTex = `${a === 1 ? '' : a}x^2 + ${b}`; intTex = `${cl}x\\left(${uTex}\\right)^{${n}}`; f = new Frac(c, 2 * a); }
    else if (kind === 2) { uTex = `${a === 1 ? '' : a}x^3 + ${b}`; intTex = `${cl}x^2\\left(${uTex}\\right)^{${n}}`; f = new Frac(c, 3 * a); }
    else if (kind === 3) { uTex = '\\sin x'; intTex = `${cl}\\cos x\\,\\sin^{${n}} x`; f = new Frac(c, 1); }
    else if (kind === 4) { uTex = `e^{${a === 1 ? '' : a}x} + ${b}`; intTex = `${cl}e^{${a === 1 ? '' : a}x}\\left(${uTex}\\right)^{${n}}`; f = new Frac(c, a); }
    else if (kind === 5) { uTex = '\\ln x'; intTex = `\\dfrac{${cl}(\\ln x)^{${n}}}{x}`; f = new Frac(c, 1); }
    else { uTex = `x^2 + ${b}`; intTex = `\\dfrac{${cl}x}{x^2 + ${b}}`; f = new Frac(c, 2); pw = -1; }
    const wrong1 = kind === 1 ? new Frac(c, a) : kind === 2 ? new Frac(c, a) : kind === 4 ? new Frac(c, 1) : new Frac(c, 2);
    return frac(`The substitution $u = ${uTex}$ turns $\\displaystyle\\int ${intTex}\\,dx$ into $k\\displaystyle\\int u^{${pw}}\\,du$. Find $k$.`, f,
      { traps: [{ frac: wrong1, why: 'Find $du$ first: the factor that comes from differentiating $u$ must be divided out.' }, { frac: new Frac(c * (pw + 1 === 0 ? 1 : pw + 1), 1), why: 'The integration of $u^{p}$ has NOT been carried out yet — $k$ is the constant multiplying $u^{p}\\,du$.' }],
        hints: [`Differentiate: $du = \\dfrac{du}{dx}\\,dx$ for $u = ${uTex}$.`, 'Rewrite the integrand using $u$ and $du$ so that only $u$ remains.', `The constant that is left in front is $k = ${f.latex()}$.`],
        steps: [{ h: 'Differentiate', d: `$u = ${uTex}$ gives $du = ${kind === 1 ? `${2 * a}x` : kind === 2 ? `${3 * a}x^2` : kind === 3 ? '\\cos x' : kind === 4 ? `${a === 1 ? '' : a}e^{${a === 1 ? '' : a}x}` : kind === 5 ? '\\dfrac{1}{x}' : '2x'}\\,dx$` }, { h: 'Rewrite', d: `$\\displaystyle\\int ${intTex}\\,dx = ${f.latex()}\\displaystyle\\int u^{${pw}}\\,du$` }, { h: 'Constant', d: `$k = ${f.latex()}$` }] });
  } },
  // New limit after a substitution.
  { make: (rng, diff) => {
    const type = ri(rng, 1, 3), a = ri(rng, 1, 3 + diff), b = ri(rng, 1, 9), L = ri(rng, -2, 2), H = L + ri(rng, 1, 3);
    const wantUpper = rng() < 0.5;
    let uTex, uOf, intTex;
    if (type === 1) { uTex = `${a === 1 ? '' : a}x^2 + ${b}`; uOf = x => a * x * x + b; intTex = `x\\left(${uTex}\\right)^{3}`; }
    else if (type === 2) { uTex = `${a + 1}x ${sgn(-b).replace('+ -', '- ')}`; uOf = x => (a + 1) * x - b; intTex = `\\left(${uTex}\\right)^{4}`; }
    else { uTex = `${a === 1 ? '' : a}x^3 + ${b}`; uOf = x => a * x ** 3 + b; intTex = `x^2\\left(${uTex}\\right)^{2}`; }
    const key = wantUpper ? uOf(H) : uOf(L);
    if (type !== 3 && type !== 1) { /* linear: any limits fine */ }
    return num(`In $\\displaystyle\\int_{${L}}^{${H}} ${intTex}\\,dx$ the substitution $u = ${uTex}$ is made. What is the new ${wantUpper ? '**upper**' : '**lower**'} limit of integration?`, key,
      { traps: [{ value: wantUpper ? H : L, why: 'The limits are values of $x$; they must be converted into values of $u$.' }, { value: wantUpper ? uOf(L) : uOf(H), why: `The ${wantUpper ? 'upper' : 'lower'} limit comes from the ${wantUpper ? 'upper' : 'lower'} value of $x$, namely $x = ${wantUpper ? H : L}$.` }],
        hints: ['Substitute each limit for $x$ in $u = ' + uTex + '$.', `The ${wantUpper ? 'upper' : 'lower'} limit is $x = ${wantUpper ? H : L}$.`, `$u = ${key}$.`],
        steps: [{ h: 'Convert the limit', d: `$x = ${wantUpper ? H : L}$ gives $u = ${key}$` }, { h: 'Other limit', d: `$x = ${wantUpper ? L : H}$ gives $u = ${wantUpper ? uOf(L) : uOf(H)}$` }] });
  } },
  // Partial fractions: find a coefficient.
  { make: (rng, diff) => {
    for (let tries = 0; tries < 60; tries++) {
      const a = ri(rng, -3 - diff, 3 + diff), b = ri(rng, -3 - diff, 3 + diff), p = nz(rng, -4, 4 + diff), q = ri(rng, -8, 8);
      if (a === b) continue;
      const A = new Frac(p * a + q, a - b), B = new Frac(p * b + q, b - a);
      if (A.n === 0 || B.n === 0) continue;
      const wantA = rng() < 0.5;
      const target = wantA ? A : B;
      const den = `${fac(a)}${fac(b)}`;
      return frac(`Express $\\dfrac{${lin(p, q)}}{${den}}$ in the form $\\dfrac{A}{${fac(a)}} + \\dfrac{B}{${fac(b)}}$. Find ${wantA ? '$A$' : '$B$'}.`, target,
        { traps: [{ frac: wantA ? B : A, why: `${wantA ? '$A$' : '$B$'} belongs to the factor $${wantA ? fac(a) : fac(b)}$ — cover it up and substitute $x = ${wantA ? a : b}$.` }, { frac: new Frac(wantA ? p * a + q : p * b + q, 1), why: `Divide by the other factor evaluated at $x = ${wantA ? a : b}$: $${wantA ? a : b} - ${wantA ? b : a}$ is not $1$.` }],
          hints: ['Multiply through by the denominator.', `Substitute $x = ${wantA ? a : b}$ to isolate ${wantA ? '$A$' : '$B$'}.`, `${wantA ? 'A' : 'B'}$ = ${target.latex()}$.`],
          steps: [{ h: 'Clear the fractions', d: `$${lin(p, q)} = A${fac(b)} + B${fac(a)}$` }, { h: `Let $x = ${wantA ? a : b}$`, d: `$${p * (wantA ? a : b) + q} = ${wantA ? 'A' : 'B'}(${wantA ? a - b : b - a})$` }, { h: 'Solve', d: `$${wantA ? 'A' : 'B'} = ${target.latex()}$` }] });
    }
    return integrationForms[0].make(rng, diff);
  } },
  // Reduction (recurrence) formulae.
  { make: (rng, diff) => {
    const kindR = ri(rng, 1, 3);
    if (kindR === 1) {
      // I_n = ∫_0^{π/2} sin^n x dx, I_n = ((n-1)/n) I_{n-2}
      const odd = rng() < 0.5;
      const n = odd ? rc(rng, [3, 5, 7, 9, 11, 13]) : rc(rng, [2, 4, 6, 8, 10, 12, 14]);
      let f = new Frac(1, 1); for (let m = n; m >= 2; m -= 2) f = f.mul ? f.mul(new Frac(m - 1, m)) : new Frac(f.n * (m - 1), f.d * m);
      const c = ri(rng, 1, 6 * diff + 2);
      if (odd) {
        const g = new Frac(c * f.n, f.d);
        return frac(`Let $I_n = \\displaystyle\\int_0^{\\pi/2}\\sin^n x\\,dx$. Given the reduction formula $I_n = \\dfrac{n-1}{n}I_{n-2}$ and $I_1 = 1$, evaluate $\\displaystyle\\int_0^{\\pi/2} ${c === 1 ? '' : c}\\sin^{${n}} x\\,dx$ exactly.`, g,
          { traps: [{ frac: new Frac(c * (n - 1), n), why: `Apply the reduction formula repeatedly: $I_{${n}}$ needs $I_{${n - 2}}$, $I_{${n - 4}}$, … down to $I_1$.` }, { frac: new Frac(c, 1), why: '$I_1 = 1$ is only the starting value of the recurrence.' }],
            hints: [`$I_{${n}} = \\dfrac{${n - 1}}{${n}}I_{${n - 2}}$.`, 'Keep stepping down by 2 until you reach $I_1 = 1$.', `$I_{${n}} = ${f.latex()}$, then multiply by $${c}$.`],
            steps: [{ h: 'Apply the recurrence', d: `$I_{${n}} = ${f.latex()}\\,I_1$` }, { h: 'Use I₁ = 1', d: `$I_{${n}} = ${f.latex()}$` }, { h: 'Multiply by the constant', d: `$${c} \\times ${f.latex()} = ${g.latex()}$` }] });
      }
      const val = c * f.value * Math.PI / 2;
      return num(`Let $I_n = \\displaystyle\\int_0^{\\pi/2}\\sin^n x\\,dx$. Given the reduction formula $I_n = \\dfrac{n-1}{n}I_{n-2}$ and $I_0 = \\dfrac{\\pi}{2}$, evaluate $\\displaystyle\\int_0^{\\pi/2} ${c === 1 ? '' : c}\\sin^{${n}} x\\,dx$, correct to 3 decimal places.`, r3(val),
        { tol: 0.002, traps: [{ value: r3(c * f.value), why: '$I_0 = \\dfrac{\\pi}{2}$, not $1$ — the factor $\\dfrac{\\pi}{2}$ remains for even $n$.' }, { value: r3(c * (n - 1) / n * Math.PI / 2), why: `Apply the recurrence repeatedly down to $I_0$, not just once.` }],
          hints: [`$I_{${n}} = \\dfrac{${n - 1}}{${n}}I_{${n - 2}}$.`, 'Step down by 2 until you reach $I_0 = \\dfrac{\\pi}{2}$.', `$I_{${n}} = ${f.latex()}\\cdot\\dfrac{\\pi}{2}$.`],
          steps: [{ h: 'Apply the recurrence', d: `$I_{${n}} = ${f.latex()}\\,I_0$` }, { h: 'Use I₀', d: `$I_{${n}} = ${f.latex()}\\times\\dfrac{\\pi}{2}$` }, { h: 'Scale and round', d: `$${c} \\times I_{${n}} \\approx ${r3(val)}$` }] });
    }
    if (kindR === 2) {
      // J_n = ∫_0^1 x^n e^x dx, J_n = e - n J_{n-1}, J_0 = e - 1.
      const n = ri(rng, 2, 4 + 2 * diff), c = ri(rng, 1, 5 * diff + 3);
      let J = Math.E - 1; for (let m = 1; m <= n; m++) J = Math.E - m * J;
      return num(`Let $J_n = \\displaystyle\\int_0^1 x^n e^{x}\\,dx$. Using the reduction formula $J_n = e - nJ_{n-1}$ with $J_0 = e - 1$, evaluate $${c === 1 ? '' : c}J_{${n}}$, correct to 3 decimal places.`, r3(c * J),
        { tol: 0.002, traps: [{ value: r3(c * (Math.E - n * (Math.E - 1))), why: `Apply the formula repeatedly — $J_{${n - 1}}$ is not $J_0$.` }, { value: r3(c * (Math.E + J * n)), why: 'The recurrence SUBTRACTS $nJ_{n-1}$ from $e$.' }],
          hints: ['Build up: $J_1 = e - 1\\cdot J_0$, then $J_2 = e - 2J_1$, and so on.', `Carry full calculator precision between steps up to $J_{${n}}$.`, `$J_{${n}} \\approx ${r3(J)}$.`],
          steps: [{ h: 'Start', d: `$J_0 = e - 1 \\approx ${r3(Math.E - 1)}$` }, { h: 'Recur', d: `Apply $J_m = e - mJ_{m-1}$ for $m = 1, \\ldots, ${n}$` }, { h: 'Result', d: `$${c}J_{${n}} \\approx ${r3(c * J)}$` }] });
    }
    // L_n = ∫_1^e (ln x)^n dx, L_n = e - n L_{n-1}, L_0 = e - 1
    const n = ri(rng, 2, 3 + 2 * diff), c = ri(rng, 1, 4 * diff + 2);
    let Lv = Math.E - 1; for (let m = 1; m <= n; m++) Lv = Math.E - m * Lv;
    return num(`Let $L_n = \\displaystyle\\int_1^{e}(\\ln x)^n\\,dx$. Parts gives $L_n = e - nL_{n-1}$, and $L_0 = e - 1$. Evaluate $${c === 1 ? '' : c}L_{${n}}$, correct to 3 decimal places.`, r3(c * Lv),
      { tol: 0.002, traps: [{ value: r3(c * (Math.E - n * (Math.E - 1))), why: `Apply the formula repeatedly — each step uses the previous $L$, not $L_0$.` }, { value: r3(c * (Math.E + n * Lv)), why: 'The recurrence SUBTRACTS $nL_{n-1}$ from $e$.' }],
        hints: ['Build up from $L_0$: $L_1 = e - L_0$, then $L_2 = e - 2L_1$, …', 'Keep full calculator precision between steps.', `$L_{${n}} \\approx ${r3(Lv)}$.`],
        steps: [{ h: 'Start', d: `$L_0 = e - 1 \\approx ${r3(Math.E - 1)}$` }, { h: 'Recur', d: `Apply $L_m = e - mL_{m-1}$ for $m = 1, \\ldots, ${n}$` }, { h: 'Result', d: `$${c}L_{${n}} \\approx ${r3(c * Lv)}$` }] });
  } },
  // Context: distance from a velocity involving a parts integral.
  { make: (rng, diff) => {
    const k = rc(rng, [0.2, 0.25, 0.4, 0.5, 0.8, 1, 2]), T = ri(rng, 2, 6 + 2 * diff), c = ri(rng, 2, 4 + 4 * diff);
    const dist = (c * (1 - Math.exp(-k * T) * (1 + k * T))) / (k * k);
    const who = rc(rng, ['cyclist on a Sydney bike path', 'netball ball rolling across the court after a pass', 'surf ski paddler leaving the beach', 'kangaroo accelerating across a paddock']);
    return num(`A ${who} has velocity $v = ${c}t\\,e^{-${k}t}$ metres per second, $t$ seconds after starting from rest at the origin. Use integration by parts to find the distance travelled in the first $${T}$ seconds, correct to 3 decimal places.`, r3(dist),
      { tol: 0.002, suffix: 'm', traps: [{ value: r3((c * T * Math.exp(-k * T)) / k), why: 'Parts leaves a second integral; the first term alone is not the distance.' }, { value: r3(c * (1 - Math.exp(-k * T)) / (k * k)), why: `The $-te^{-kt}/k$ term must be kept: the antiderivative is $-\\dfrac{${c}}{${k}}te^{-${k}t} - \\dfrac{${c}}{${k * k}}e^{-${k}t}$.` }],
        hints: ['Distance $= \\displaystyle\\int_0^{T} v\\,dt$.', `Parts with $u = t$ and $dv = e^{-${k}t}\\,dt$.`, 'Evaluate between $0$ and $T$.'],
        steps: [{ h: 'Set up', d: `$s = \\displaystyle\\int_0^{${T}} ${c}t\\,e^{-${k}t}\\,dt$` }, { h: 'Integrate by parts', d: `$\\dfrac{${c}}{${k * k}}\\left[1 - e^{-${k}t}(1 + ${k}t)\\right]$ evaluated at $t = ${T}$` }, { h: 'Result', d: `$\\approx ${r3(dist)}$ m` }] });
  } },
  // Double-angle then integrate.
  { make: (rng, diff) => {
    const n = ri(rng, 2, 5 + diff), c = ri(rng, 1, 6 * diff + 2), useSin = rng() < 0.5;
    const val = (c * Math.PI) / (4 * n);
    return num(`Using the identity $${useSin ? '\\sin^2' : '\\cos^2'}\\theta = \\dfrac{1 ${useSin ? '-' : '+'} \\cos 2\\theta}{2}$, evaluate $\\displaystyle\\int_0^{\\pi/${2 * n}} ${c === 1 ? '' : c}${useSin ? '\\sin^2' : '\\cos^2'}(${n}x)\\,dx$, correct to 3 decimal places.`, r3(val),
      { tol: 0.002, traps: [{ value: r3(val * 2), why: `The half in the identity gives $\\tfrac{1}{2}$ of the width $\\dfrac{\\pi}{${2 * n}}$; the $\\cos(${2 * n}x)$ term then integrates to $\\sin$, which is $0$ at both limits.` }, { value: r3(c * Math.PI / (2 * n)), why: 'Include the factor of $\\tfrac{1}{2}$ from the identity.' }],
        hints: [`$${useSin ? '\\sin^2' : '\\cos^2'}(${n}x) = \\dfrac{1 ${useSin ? '-' : '+'} \\cos(${2 * n}x)}{2}$.`, `The $\\cos(${2 * n}x)$ term integrates to $\\dfrac{\\sin(${2 * n}x)}{${2 * n}}$, which is $0$ at $x = 0$ and $x = \\dfrac{\\pi}{${2 * n}}$.`, 'Only $\\dfrac{1}{2}x$ survives.'],
        steps: [{ h: 'Rewrite', d: `$${c === 1 ? '' : c}\\left[\\dfrac{x}{2} ${useSin ? '-' : '+'} \\dfrac{\\sin(${2 * n}x)}{${4 * n}}\\right]_0^{\\pi/${2 * n}}$` }, { h: 'Evaluate', d: `$${c}\\cdot\\dfrac{\\pi}{${4 * n}} \\approx ${r3(val)}$` }] });
  } }
];

// ═════════════════════════════════════════════════════════════════════════════
// MEX-V1 · Vectors in three dimensions
// ═════════════════════════════════════════════════════════════════════════════
const QUADS = [[1, 2, 2, 3], [2, 3, 6, 7], [1, 4, 8, 9], [4, 4, 7, 9], [2, 6, 9, 11], [6, 6, 7, 11], [3, 4, 12, 13], [2, 10, 11, 15], [2, 5, 14, 15], [8, 9, 12, 17], [1, 12, 12, 17]];
const vecTex = v => `\\begin{pmatrix} ${v[0]} \\\\ ${v[1]} \\\\ ${v[2]} \\end{pmatrix}`;
const vtex = (name, v) => `\\underset{\\sim}{${name}} = ${vecTex(v)}`;
const pt = p => `(${p[0]}, ${p[1]}, ${p[2]})`;
const dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const sub3 = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const quad = (rng, scaleMax = 1) => {
  const q = rc(rng, QUADS), s = ri(rng, 1, scaleMax);
  const v = rs(rng, [q[0] * s, q[1] * s, q[2] * s]).map(x => x * rc(rng, [1, -1]));
  const m = q[3] * s;
  if (Math.hypot(...v) !== m) throw new Error('vectors: quad');
  return { v, m };
};
const vectorForms = [
  // Unit-vector component (exact).
  { make: (rng, diff) => {
    const { v, m } = quad(rng, diff > 2 ? 2 : 1);
    const idx = ri(rng, 0, 2), axis = ['x', 'y', 'z'][idx];
    const f = new Frac(v[idx], m);
    return frac(`Find the ${axis}-component of the **unit vector** in the direction of $${vtex('v', v)}$, as a fraction in simplest form.`, f,
      { traps: [{ frac: new Frac(v[idx], 1), why: 'Divide by the magnitude $|v|$ to make the vector length $1$.' }, { frac: new Frac(v[idx], m * m), why: 'Divide by $|v|$, not by $|v|^2$.' }],
        hints: ['A unit vector is $\\hat{v} = \\dfrac{1}{|v|}v$.', `$|v| = \\sqrt{${v[0] ** 2} + ${v[1] ** 2} + ${v[2] ** 2}} = ${m}$.`, `The ${axis}-component is $\\dfrac{${v[idx]}}{${m}}$.`],
        steps: [{ h: 'Magnitude', d: `$|v| = \\sqrt{${v[0] ** 2 + v[1] ** 2 + v[2] ** 2}} = ${m}$` }, { h: 'Divide', d: `${axis}-component $= \\dfrac{${v[idx]}}{${m}} = ${f.latex()}$` }] });
  } },
  // Distance between two points in space.
  { make: (rng, diff) => {
    const { v, m } = quad(rng, diff > 1 ? 2 : 1);
    const A = [ri(rng, -6, 6), ri(rng, -6, 6), ri(rng, -6, 6)];
    const B = [A[0] + v[0], A[1] + v[1], A[2] + v[2]];
    if (Math.hypot(...sub3(B, A)) !== m) throw new Error('vectors: distance');
    return num(`Find the distance between the points $A${pt(A)}$ and $B${pt(B)}$ in three-dimensional space.`, m,
      { traps: [{ value: Math.abs(v[0]) + Math.abs(v[1]) + Math.abs(v[2]), why: 'Distance is $\\sqrt{(\\Delta x)^2 + (\\Delta y)^2 + (\\Delta z)^2}$, not the sum of the differences.' }, { value: m * m, why: 'Take the square root of the sum of squares.' }],
        hints: ['Find the vector $\\overrightarrow{AB} = B - A$.', `$\\overrightarrow{AB} = ${pt(v)}$.`, `$|AB| = \\sqrt{${v[0] ** 2} + ${v[1] ** 2} + ${v[2] ** 2}}$.`],
        steps: [{ h: 'Vector AB', d: `$\\overrightarrow{AB} = ${pt(v)}$` }, { h: 'Magnitude', d: `$\\sqrt{${v[0] ** 2 + v[1] ** 2 + v[2] ** 2}} = ${m}$` }], suffix: 'units' });
  } },
  // Point dividing a segment in a ratio.
  { make: (rng, diff) => {
    const m1 = ri(rng, 1, 3), n1 = ri(rng, 1, 3 + diff), s = m1 + n1;
    const A = [ri(rng, -8, 8), ri(rng, -8, 8), ri(rng, -8, 8)];
    const d = [nz(rng, -4, 4) * s, nz(rng, -4, 4) * s, nz(rng, -4, 4) * s];
    const B = [A[0] + d[0], A[1] + d[1], A[2] + d[2]];
    const idx = ri(rng, 0, 2), axis = ['x', 'y', 'z'][idx];
    const P = [0, 1, 2].map(i => (n1 * A[i] + m1 * B[i]) / s);
    if (!P.every(Number.isInteger)) throw new Error('vectors: ratio');
    return num(`The point $P$ divides the segment from $A${pt(A)}$ to $B${pt(B)}$ internally in the ratio $${m1} : ${n1}$ ($AP : PB$). Find the ${axis}-coordinate of $P$.`, P[idx],
      { traps: [{ value: (m1 * A[idx] + n1 * B[idx]) / s, why: `With $AP : PB = ${m1} : ${n1}$, the FAR end $B$ is weighted by $${m1}$ and $A$ by $${n1}$.` }, { value: (A[idx] + B[idx]) / 2, why: 'That is the midpoint, which only applies when the ratio is $1 : 1$.' }],
        hints: [`$\\overrightarrow{OP} = \\dfrac{${n1}\\,\\overrightarrow{OA} + ${m1}\\,\\overrightarrow{OB}}{${s}}$.`, `Use the ${axis}-coordinates $${A[idx]}$ and $${B[idx]}$.`, `$\\dfrac{${n1}(${A[idx]}) + ${m1}(${B[idx]})}{${s}}$.`],
        steps: [{ h: 'Section formula', d: `$P = \\dfrac{${n1}A + ${m1}B}{${s}}$` }, { h: `${axis}-coordinate`, d: `$\\dfrac{${n1 * A[idx]} + ${m1 * B[idx]}}{${s}} = ${P[idx]}$` }] });
  } },
  // Perpendicular pair as MCQ.
  { diffs: [2, 3, 4], make: (rng, diff) => {
    const mk = () => [nz(rng, -5, 5), nz(rng, -5, 5), nz(rng, -5, 5)];
    for (let tries = 0; tries < 200; tries++) {
      const a = mk();
      const b = mk(); b[2] = -(a[0] * b[0] + a[1] * b[1]) / a[2];
      if (!Number.isInteger(b[2]) || b[2] === 0 || Math.abs(b[2]) > 12) continue;
      const wrongs = [0, 1, 2].map(() => { const c = mk(); return dot3(a, c) === 0 ? null : c; });
      if (wrongs.some(w => !w)) continue;
      const optTex = (x, y) => `$${vecTex(x).replace(/\\begin\{pmatrix\}|\\end\{pmatrix\}/g, '')}$`;
      void optTex;
      const label = w => `$${vtex('b', w).split('=')[1].trim()}$`;
      const sign = [b[0], b[1], -b[2]];
      const par = [2 * a[0], 2 * a[1], 2 * a[2]];
      const options = [
        { vec: b, ok: true },
        { vec: dot3(a, sign) === 0 ? wrongs[0] : sign, why: 'Changing one sign does not keep the dot product at $0$ — compute $a\\cdot b$ for each option.' },
        { vec: par, why: 'A multiple of $a$ is PARALLEL to $a$; its dot product with $a$ is $2|a|^2 \\ne 0$.' },
        { vec: wrongs[1], why: 'Compute the dot product: it is not $0$.' }
      ];
      const seen = new Set(); let bad = false;
      for (const o of options) { const key = o.vec.join(','); if (seen.has(key)) bad = true; seen.add(key); }
      if (bad || options.filter(o => dot3(a, o.vec) === 0).length !== 1) continue;
      const m = mcq(rng, label(b), options.slice(1).map(o => ({ text: label(o.vec), why: o.why })));
      return { prompt: `Which of the following vectors is **perpendicular** to $${vtex('a', a)}$?`, answerType: 'mcq', answer: { correctIndex: m.correctIndex, optionTraps: m.optionTraps }, mcqOptions: m.options,
        hints: ['Two vectors are perpendicular exactly when their dot product is $0$.', 'Compute $a \\cdot b$ for each option.', `Only one option gives $${a[0]}b_1 + ${a[1]}b_2 + ${a[2]}b_3 = 0$.`],
        steps: [{ h: 'Test each option', d: `$a\\cdot b = ${dot3(a, b)}$ for the correct option; the others are non-zero.` }, { h: 'Conclusion', d: `The perpendicular vector is $${vecTex(b)}$.` }] };
    }
    return vectorForms[0].make(rng, diff);
  } },
  // Scalar projection (exact).
  { diffs: [2, 3, 4], make: (rng, diff) => {
    const { v: b, m } = quad(rng, diff > 2 ? 2 : 1);
    const a = [nz(rng, -5, 5), nz(rng, -5, 5), nz(rng, -5, 5)];
    const d = dot3(a, b);
    if (d === 0) throw new Error('vectors: projection zero');
    const f = new Frac(d, m);
    return frac(`Find the **scalar projection** of $${vtex('a', a)}$ onto $${vtex('b', b)}$, as a fraction in simplest form (or a whole number).`, f,
      { traps: [{ frac: new Frac(d, m * m), why: 'The scalar projection divides by $|b|$, not $|b|^2$ (that is the factor in the VECTOR projection).' }, { frac: new Frac(d, 1), why: 'Divide the dot product by $|b|$.' }],
        hints: ['Scalar projection of $a$ onto $b$: $\\dfrac{a\\cdot b}{|b|}$.', `$a\\cdot b = ${d}$ and $|b| = ${m}$.`, `$\\dfrac{${d}}{${m}}$.`],
        steps: [{ h: 'Dot product', d: `$a\\cdot b = ${d}$` }, { h: 'Magnitude of b', d: `$|b| = ${m}$` }, { h: 'Divide', d: `$\\dfrac{${d}}{${m}} = ${f.latex()}$` }] });
  } },
  // Parallel vectors: find the missing component.
  { make: (rng, diff) => {
    const u = [nz(rng, -4, 4), nz(rng, -4, 4), nz(rng, -4, 4)];
    const t = rc(rng, [-3, -2, 2, 3, 4]);
    const w = [t * u[0], t * u[1], t * u[2]];
    const idx = ri(rng, 0, 2), axis = ['x', 'y', 'z'][idx];
    const shown = w.map((x, i) => (i === idx ? 'k' : String(x)));
    return num(`The vectors $${vtex('u', u)}$ and $\\begin{pmatrix} ${shown[0]} \\\\ ${shown[1]} \\\\ ${shown[2]} \\end{pmatrix}$ are **parallel**. Find $k$.`, w[idx],
      { prefix: 'k =', traps: [{ value: u[idx], why: 'Parallel vectors are scalar multiples, not equal — find the multiplier from the known components first.' }, { value: -w[idx], why: `Check the sign of the multiplier $${t}$.` }],
        hints: ['Parallel means one vector is a scalar multiple of the other.', `Compare a pair of known components to find the multiplier.`, `$k = ${t} \\times ${u[idx]}$.`],
        steps: [{ h: 'Find the multiplier', d: `$${t}$ (from the components that do not involve $k$)` }, { h: `${axis}-component`, d: `$k = ${t} \\times ${u[idx]} = ${w[idx]}$` }] });
  } },
  // Right angle in a triangle of points.
  { diffs: [2, 3, 4], make: (rng, diff) => {
    for (let tries = 0; tries < 80; tries++) {
      const B = [ri(rng, -4, 4), ri(rng, -4, 4), ri(rng, -4, 4)];
      const BA = [nz(rng, -4, 4), nz(rng, -4, 4), nz(rng, 1, 4)];
      const c0 = nz(rng, -4, 4), c1 = nz(rng, -4, 4);
      const num0 = -(BA[0] * c0 + BA[1] * c1);
      if (num0 % BA[2] !== 0) continue;
      const k = num0 / BA[2];
      if (k === 0) continue;
      const A = [B[0] + BA[0], B[1] + BA[1], B[2] + BA[2]];
      const C = [B[0] + c0, B[1] + c1, 'k'];
      const kk = B[2] + k; const Cs = `(${C[0]}, ${C[1]}, k)`;
      const BC = [c0, c1, kk - B[2]];
      if (dot3(BA, BC) !== 0) throw new Error('vectors: right angle');
      return num(`The points are $A${pt(A)}$, $B${pt(B)}$ and $C${Cs}$. Find the value of $k$ for which $\\angle ABC = 90°$.`, kk,
        { prefix: 'k =', traps: [{ value: k, why: 'The vector $\\overrightarrow{BC}$ has third component $k - ' + B[2] + '$ — do not forget to add $' + B[2] + '$ back.' }, { value: B[2] - k, why: 'Solve $\\overrightarrow{BA}\\cdot\\overrightarrow{BC} = 0$ carefully; mind the sign of each component.' }].filter(t => t.value !== kk),
          hints: ['A right angle at $B$ means $\\overrightarrow{BA}\\cdot\\overrightarrow{BC} = 0$.', `$\\overrightarrow{BA} = ${pt(BA)}$ and $\\overrightarrow{BC} = (${c0}, ${c1}, k - ${B[2]})$.`, `$${BA[0] * c0} + ${BA[1] * c1} + ${BA[2]}(k - ${B[2]}) = 0$.`],
          steps: [{ h: 'Vectors from B', d: `$\\overrightarrow{BA} = ${pt(BA)}$, $\\overrightarrow{BC} = (${c0}, ${c1}, k - ${B[2]})$` }, { h: 'Dot product = 0', d: `$${BA[0] * c0 + BA[1] * c1} + ${BA[2]}(k - ${B[2]}) = 0$` }, { h: 'Solve', d: `$k = ${kk}$` }] });
    }
    return vectorForms[0].make(rng, diff);
  } },
  // Sphere: complete the expanded equation.
  { make: (rng, diff) => {
    const cx = ri(rng, -6, 6), cy = ri(rng, -6, 6), cz = ri(rng, -6, 6), r = ri(rng, 2, 6 + diff);
    const dd = cx * cx + cy * cy + cz * cz - r * r;
    const term = (c, v) => (c === 0 ? '' : ` ${c < 0 ? '+' : '-'} ${Math.abs(2 * c) === 1 ? '' : Math.abs(2 * c)}${v}`);
    const eq = `x^2 + y^2 + z^2${term(cx, 'x')}${term(cy, 'y')}${term(cz, 'z')} ${dd < 0 ? '-' : '+'} ${Math.abs(dd)} = 0`;
    if (dd === 0) throw new Error('vectors: sphere d');
    if (rng() < 0.5) return num(`The sphere $${eq}$ has its centre at $${pt([cx, cy, cz])}$. Complete the square to find its **radius**.`, r,
      { suffix: 'units', traps: [{ value: r * r, why: 'Completing the square gives $(x - a)^2 + \\ldots = r^2$; take the square root for the radius.' }, { value: Math.abs(dd), why: 'Move $' + (dd < 0 ? '' : '-') + Math.abs(dd) + '$ across AFTER adding the squares of the half-coefficients.' }].filter(t => t.value !== r),
        hints: ['Complete the square in each variable.', `$r^2 = a^2 + b^2 + c^2 - d = ${cx * cx + cy * cy + cz * cz} - (${dd})$.`, `$r^2 = ${r * r}$.`],
        steps: [{ h: 'Complete the squares', d: `$(x ${cx > 0 ? '-' : '+'} ${Math.abs(cx)})^2 + (y ${cy > 0 ? '-' : '+'} ${Math.abs(cy)})^2 + (z ${cz > 0 ? '-' : '+'} ${Math.abs(cz)})^2 = ${r * r}$`.replace(/\(([xyz]) [-+] 0\)/g, '$1') }, { h: 'Radius', d: `$r = ${r}$` }] });
    return num(`A sphere has centre $${pt([cx, cy, cz])}$ and radius $${r}$. Its equation can be written $x^2 + y^2 + z^2 + \\ldots + d = 0$ (after expanding). Find the constant $d$.`, dd,
      { prefix: 'd =', traps: [{ value: cx * cx + cy * cy + cz * cz + r * r, why: 'The constant is $a^2 + b^2 + c^2 - r^2$: the radius squared is SUBTRACTED.' }, { value: -dd, why: 'Check the sign of the constant after expanding.' }].filter(t => t.value !== dd),
        hints: ['$(x - a)^2 + (y - b)^2 + (z - c)^2 = r^2$.', 'Expand each bracket and move $r^2$ across.', `$d = ${cx * cx} + ${cy * cy} + ${cz * cz} - ${r * r}$.`],
        steps: [{ h: 'Expand', d: `The constant terms are $${cx * cx}$, $${cy * cy}$, $${cz * cz}$ and $-${r * r}$` }, { h: 'Add', d: `$d = ${dd}$` }] });
  } },
  // Line in 3D: where does it reach a coordinate plane?
  { diffs: [2, 3, 4], make: (rng, diff) => {
    const a = [ri(rng, -6, 6), ri(rng, -6, 6), ri(rng, -6, 6)], d = [nz(rng, -4, 4), nz(rng, -4, 4), nz(rng, -4, 4)];
    const t = nz(rng, -5, 5), idx = ri(rng, 0, 2), axis = ['x', 'y', 'z'][idx];
    const target = a[idx] + t * d[idx];
    return num(`A line has vector equation $\\underset{\\sim}{r} = ${vecTex(a)} + t${vecTex(d)}$. At what value of $t$ does the line reach the plane ${axis}${' '}$= ${target}$?`.replace(`${axis} $=`, `$${axis} =`), t,
      { prefix: 't =', traps: [{ value: target, why: 'The plane value is the coordinate, not the parameter — solve for $t$.' }, { value: -t, why: `Rearrange carefully: $${a[idx]} + ${d[idx]}t = ${target}$.` }],
        hints: [`The ${axis}-coordinate on the line is $${a[idx]} + ${d[idx]}t$.`, `Set $${a[idx]} + ${d[idx]}t = ${target}$.`, `$t = ${t}$.`],
        steps: [{ h: `${axis}-coordinate`, d: `$${axis} = ${a[idx]} + ${d[idx]}t$` }, { h: 'Solve', d: `$${a[idx]} + ${d[idx]}t = ${target} \\Rightarrow t = ${t}$` }] });
  } }
];

// ═════════════════════════════════════════════════════════════════════════════
// MEX-M1 · Mechanics
// ═════════════════════════════════════════════════════════════════════════════
const TRIP = [[3, 4, 5], [5, 12, 13], [8, 15, 17], [7, 24, 25], [6, 8, 10], [9, 12, 15], [12, 16, 20], [15, 20, 25]];
const mechanicsForms = [
  // Speed at a given displacement.
  { make: (rng, diff) => {
    const t = rc(rng, TRIP), A = t[2], x = rc(rng, [t[0], t[1]]), n = ri(rng, 2, 3 + 2 * diff);
    const v = n * Math.sqrt(A * A - x * x);
    if (!Number.isInteger(v)) throw new Error('mech: speed');
    return num(`A particle moves in simple harmonic motion with amplitude $${A}$ m and $\\ddot{x} = -${n * n}x$. Using $v^2 = n^2(A^2 - x^2)$, find its speed when $x = ${x}$ m.`, v,
      { suffix: 'm/s', traps: [{ value: n * (A - x), why: 'Square before subtracting: $A^2 - x^2$ is not $(A - x)^2$.' }, { value: v * v, why: 'That is $v^2$ — take the square root.' }, { value: n * n * Math.sqrt(A * A - x * x), why: `Here $n^2 = ${n * n}$, so $n = ${n}$ multiplies the square root.` }],
        hints: [`$\\ddot{x} = -n^2x$ gives $n^2 = ${n * n}$.`, `$A^2 - x^2 = ${A * A} - ${x * x} = ${A * A - x * x}$.`, `$v = ${n}\\sqrt{${A * A - x * x}}$.`],
        steps: [{ h: 'Find n', d: `$n^2 = ${n * n} \\Rightarrow n = ${n}$` }, { h: 'Apply the formula', d: `$v^2 = ${n * n}(${A * A} - ${x * x}) = ${v * v}$` }, { h: 'Speed', d: `$v = ${v}$ m/s` }] });
  } },
  // Angular frequency from a count of oscillations.
  { make: (rng, diff) => {
    const N = ri(rng, 2, 9 + diff), T = ri(rng, 3, 20 + 5 * diff);
    const n = (2 * Math.PI * N) / T;
    const who = rc(rng, ['A buoy off Bondi bobs', 'A mass on a spring oscillates', 'A tuning fork prong vibrates', 'A piston moves']);
    return num(`${who} in simple harmonic motion, completing $${N}$ full oscillations in $${T}$ seconds. Find the angular frequency $n$ in $x = A\\cos(nt)$, correct to 2 decimal places.`, r2(n),
      { tol: 0.011, suffix: 'rad/s', traps: [{ value: r2(N / T), why: 'That is the frequency in oscillations per second; $n = 2\\pi f$.' }, { value: r2((2 * Math.PI * T) / N), why: `The period is $\\dfrac{${T}}{${N}}$ s, and $n = \\dfrac{2\\pi}{\\text{period}}$.` }],
        hints: [`Period $= \\dfrac{${T}}{${N}}$ seconds.`, '$n = \\dfrac{2\\pi}{\\text{period}}$.', `$n = \\dfrac{2\\pi \\times ${N}}{${T}}$.`],
        steps: [{ h: 'Period', d: `$T = \\dfrac{${T}}{${N}}$ s` }, { h: 'Angular frequency', d: `$n = \\dfrac{2\\pi}{T} = \\dfrac{${2 * N}\\pi}{${T}} \\approx ${r2(n)}$ rad/s` }] });
  } },
  // Centre of motion offset.
  { make: (rng, diff) => {
    const c = nz(rng, -9, 9), A = ri(rng, 2, 8 + 2 * diff), n = ri(rng, 2, 6);
    const askMax = rng() < 0.5;
    const eq = `x = ${c} + ${A}\\cos(${n}t)`.replace('+ -', '- ');
    const ans = askMax ? c + A : c - A;
    return num(`A particle moves with $${eq}$, where $x$ is in metres. Find the ${askMax ? '**greatest**' : '**least**'} value of $x$.`, ans,
      { suffix: 'm', traps: [{ value: askMax ? A : -A, why: `The centre of motion is $x = ${c}$, not $x = 0$: add the amplitude to ${c < 0 ? 'the negative centre' : 'the centre'}.` }, { value: askMax ? c - A : c + A, why: `The ${askMax ? 'greatest' : 'least'} value occurs when $\\cos(${n}t) = ${askMax ? 1 : -1}$.` }],
        hints: [`The centre of motion is $x = ${c}$ and the amplitude is $${A}$.`, `$\\cos(${n}t)$ ranges between $-1$ and $1$.`, `${askMax ? 'Greatest' : 'Least'} $x = ${c} ${askMax ? '+' : '-'} ${A}$.`],
        steps: [{ h: 'Centre and amplitude', d: `Centre $${c}$, amplitude $${A}$` }, { h: askMax ? 'Greatest value' : 'Least value', d: `$x = ${ans}$ m` }] });
  } },
  // Resisted motion: terminal velocity with quadratic drag.
  { make: (rng, diff) => {
    for (let tries = 0; tries < 60; tries++) {
      const k = ri(rng, 2, 5 + diff), v = ri(rng, 5, 20 + 5 * diff);
      const m = (k * v * v) / 10;
      if (!Number.isInteger(m) || m < 5) continue;
      return num(`An object of mass $${m}$ kg falls through air with resistance $R = ${k === 1 ? '' : k}v^2$ newtons. Taking $g = 10$ m/s², find its **terminal velocity** (where $\\ddot{x} = 0$).`, v,
        { suffix: 'm/s', traps: [{ value: (m * 10) / k, why: 'The resistance is proportional to $v^2$: $mg = kv^2$, so $v = \\sqrt{mg/k}$.' }, { value: v * v, why: 'That is $v^2$ — take the square root.' }].filter(t => t.value !== v),
          hints: ['At terminal velocity the resistance balances the weight.', `$${m} \\times 10 = ${k}v^2$.`, `$v^2 = ${(m * 10) / k}$.`],
          steps: [{ h: 'Balance forces', d: `$mg = ${k}v^2$` }, { h: 'Solve', d: `$v^2 = \\dfrac{${m * 10}}{${k}} = ${v * v}$, so $v = ${v}$ m/s` }] });
    }
    return mechanicsForms[0].make(rng, diff);
  } },
  // Resisted motion: speed after time (linear drag, horizontal).
  { make: (rng, diff) => {
    const v0 = ri(rng, 4, 15 + 5 * diff), k = rc(rng, [0.1, 0.2, 0.25, 0.4, 0.5, 0.8]), t = ri(rng, 1, 8);
    const v = v0 * Math.exp(-k * t);
    const who = rc(rng, ['A jet ski glides', 'A skateboarder rolls', 'A hockey puck slides', 'A canoe coasts']);
    return num(`${who} across the water with initial speed $${v0}$ m/s and a resistance that gives $\\dot{v} = -${k}v$. Find its speed after $${t}$ ${t === 1 ? 'second' : 'seconds'}, correct to 2 decimal places.`, r2(v),
      { tol: 0.011, suffix: 'm/s', traps: [{ value: r2(v0 - k * t), why: `The resistance is proportional to $v$, so the speed decays exponentially: $v = v_0e^{-${k}t}$, not linearly.` }, { value: r2(v0 * Math.exp(k * t)), why: 'The speed DECREASES: the exponent is negative.' }],
        hints: [`Solve $\\dfrac{dv}{dt} = -${k}v$ to get $v = v_0e^{-${k}t}$.`, `$v = ${v0}e^{-${k} \\times ${t}}$.`, 'Evaluate with a calculator.'],
        steps: [{ h: 'Solve the equation', d: `$v = ${v0}e^{-${k}t}$` }, { h: 'Substitute t', d: `$v(${t}) = ${v0}e^{-${bigRound(k * t, 3)}} \\approx ${r2(v)}$ m/s` }] });
  } },
  // Resisted motion: time for the speed to halve.
  { make: (rng, diff) => {
    const k = rc(rng, [0.1, 0.2, 0.25, 0.4, 0.5, 0.8, 1.5]), v0 = ri(rng, 5, 20 + 5 * diff);
    const t = Math.LN2 / k;
    return num(`A boat moving at $${v0}$ m/s in still water has its engine switched off. The resistance gives $\\dot{v} = -${k}v$. How long does it take for the speed to fall to half its initial value? Give the answer correct to 2 decimal places.`, r2(t),
      { tol: 0.011, suffix: 's', traps: [{ value: r2(1 / k), why: 'That is the time for the speed to fall to $\\dfrac{1}{e}$ of its initial value.' }, { value: r2(v0 / (2 * k)), why: 'The decay is exponential; solve $e^{-kt} = \\dfrac{1}{2}$ — the initial speed cancels.' }],
        hints: [`$v = ${v0}e^{-${k}t}$.`, `Solve $e^{-${k}t} = \\dfrac{1}{2}$.`, `$t = \\dfrac{\\ln 2}{${k}}$.`],
        steps: [{ h: 'Solve for v', d: `$v = ${v0}e^{-${k}t}$` }, { h: 'Halve', d: `$e^{-${k}t} = \\dfrac{1}{2} \\Rightarrow t = \\dfrac{\\ln 2}{${k}}$` }, { h: 'Evaluate', d: `$t \\approx ${r2(t)}$ s` }] });
  } },
  // Vertical resisted fall (linear drag): speed after t seconds.
  { diffs: [2, 3, 4], make: (rng, diff) => {
    const k = rc(rng, [0.2, 0.25, 0.4, 0.5, 0.8, 2]), t = ri(rng, 1, 8);
    const vT = 10 / k, v = vT * (1 - Math.exp(-k * t));
    return num(`A parachutist falls from rest with $\\ddot{x} = 10 - ${k}v$ (in m/s², with downward positive). It can be shown that $v = \\dfrac{10}{${k}}\\left(1 - e^{-${k}t}\\right)$. Find the speed after $${t}$ ${t === 1 ? 'second' : 'seconds'}, correct to 2 decimal places.`, r2(v),
      { tol: 0.011, suffix: 'm/s', traps: [{ value: r2(vT), why: 'That is the terminal velocity, which is only approached as $t \\to \\infty$.' }, { value: r2(10 * t), why: 'That ignores the resistance — free fall would give $10t$.' }],
        hints: [`The terminal velocity is $\\dfrac{10}{${k}} = ${bigRound(vT, 3)}$ m/s.`, `$e^{-${k} \\times ${t}} = e^{-${bigRound(k * t, 3)}}$.`, 'Multiply $v_T$ by $1 - e^{-kt}$.'],
        steps: [{ h: 'Terminal velocity', d: `$v_T = ${bigRound(vT, 3)}$ m/s` }, { h: 'Substitute', d: `$v(${t}) = ${bigRound(vT, 3)}\\left(1 - e^{-${bigRound(k * t, 3)}}\\right)$` }, { h: 'Evaluate', d: `$\\approx ${r2(v)}$ m/s` }] });
  } },
  // MCQ: which equation describes SHM?
  { diffs: [1, 2, 3], make: (rng, diff) => {
    const n2 = rc(rng, [4, 9, 16, 25, 36, 49, 64]), c = rc(rng, [0, 0, 2, 3, 5]);
    const form = (s, body) => `$\\ddot{x} = ${s}${body}$`.replace('= -+', '= -');
    const correct = c === 0 ? `$\\ddot{x} = -${n2}x$` : `$\\ddot{x} = -${n2}(x - ${c})$`;
    const ds = [
      { text: c === 0 ? `$\\ddot{x} = ${n2}x$` : `$\\ddot{x} = ${n2}(x - ${c})$`, why: 'The sign is wrong: SHM needs an acceleration that points back TOWARDS the centre, so $\\ddot{x}$ must be $-n^2$ times the displacement.' },
      { text: c === 0 ? `$\\ddot{x} = -${n2}x^2$` : `$\\ddot{x} = -${n2}(x - ${c})^2$`, why: 'The acceleration must be proportional to $x$ itself, not to $x^2$.' },
      { text: `$\\ddot{x} = -${n2}\\dot{x}$`, why: 'That makes the acceleration proportional to the VELOCITY (a resisted motion), not to the displacement.' }
    ];
    void form;
    const centreTxt = c === 0 ? '' : ` Its centre of motion is $x = ${c}$.`;
    return mc(rng, `Which equation describes simple harmonic motion with $n = ${Math.sqrt(n2)}$?${centreTxt}`, correct, ds,
      ['SHM: $\\ddot{x} = -n^2(x - c)$, where $c$ is the centre of motion.', `Here $n^2 = ${n2}$.`, 'The acceleration is proportional to the displacement from the centre, and opposite in direction.'],
      [{ h: 'SHM condition', d: `$\\ddot{x} = -n^2(x - c)$ with $n^2 = ${n2}$${c === 0 ? '' : ` and $c = ${c}$`}` }, { h: 'Conclusion', d: `${correct}` }]);
  } },
  // Total distance over complete oscillations.
  { diffs: [1, 2, 3], make: (rng, diff) => {
    const A = ri(rng, 2, 10 + 4 * diff), N = ri(rng, 2, 6 + diff), n = ri(rng, 2, 6);
    const who = rc(rng, ['A float at Manly wharf', 'A pendulum bob', 'A bungee tester', 'A speaker cone']);
    return num(`${who} moves in simple harmonic motion $x = ${A}\\cos(${n}t)$ with $x$ in centimetres. What **total distance** does it travel in $${N}$ complete oscillations?`, 4 * A * N,
      { suffix: 'cm', traps: [{ value: 2 * A * N, why: 'In ONE oscillation the particle goes from $+A$ to $-A$ and back: that is a distance of $4A$, not $2A$.' }, { value: A * N, why: 'The distance covered in one oscillation is four amplitudes.' }],
        hints: ['One oscillation: centre to one end, back through the centre to the other end, and back to the start.', `Distance per oscillation $= 4 \\times ${A}$.`, `Multiply by $${N}$.`],
        steps: [{ h: 'One oscillation', d: `$4A = ${4 * A}$ cm` }, { h: `${N} oscillations`, d: `$${N} \\times ${4 * A} = ${4 * A * N}$ cm` }] });
  } },
  // Tide model: depth at a time.
  { diffs: [2, 3, 4], make: (rng, diff) => {
    const Dm = ri(rng, 5, 12), A = ri(rng, 1, 3), t = ri(rng, 1, 11);
    const d = Dm + A * Math.cos((Math.PI * t) / 6);
    return num(`The depth of water at the end of a jetty is modelled by $d = ${Dm} + ${A === 1 ? '' : A}\\cos\\left(\\dfrac{\\pi t}{6}\\right)$ metres, where $t$ is the time in hours after high tide at midnight. Find the depth at $t = ${t}$ hours, correct to 2 decimal places.`, r2(d),
      { tol: 0.011, suffix: 'm', traps: [{ value: r2(Dm + A * Math.cos(t)), why: 'Use radians for the argument $\\dfrac{\\pi t}{6}$, with $t = ' + t + '$ giving $\\dfrac{' + t + '\\pi}{6}$.' }, { value: r2(Dm + A * Math.cos((t * 180) / 6)), why: 'Do not mix degrees and radians — $\\dfrac{\\pi t}{6}$ is already in radians.' }],
        hints: [`Substitute $t = ${t}$: the angle is $\\dfrac{${t}\\pi}{6}$ radians.`, `$\\cos\\left(\\dfrac{${t}\\pi}{6}\\right) \\approx ${r3(Math.cos((Math.PI * t) / 6))}$.`, `$d = ${Dm} + ${A}\\times(\\ldots)$.`],
        steps: [{ h: 'Substitute', d: `$d = ${Dm} + ${A === 1 ? '' : A}\\cos\\left(\\dfrac{${t}\\pi}{6}\\right)$` }, { h: 'Evaluate', d: `$\\approx ${r2(d)}$ m` }] });
  } },
  // Acceleration from a displacement (a = −n²x).
  { make: (rng, diff) => {
    const n = ri(rng, 2, 4 + 2 * diff), x = nz(rng, -12, 12);
    return num(`A particle moves in simple harmonic motion with $\\ddot{x} = -n^2x$ and period $\\dfrac{2\\pi}{${n}}$ seconds. Find its acceleration, in m/s², when its displacement from the centre is $x = ${x}$ m.`, -n * n * x,
      { suffix: 'm/s²', traps: [{ value: -n * x, why: `The acceleration involves $n^2 = ${n * n}$, not $n = ${n}$.` }, { value: n * n * x, why: 'The acceleration is directed towards the centre, opposite to the displacement.' }],
        hints: ['The period $\\dfrac{2\\pi}{n}$ tells you the value of $n$.', `$n = ${n}$, so $n^2 = ${n * n}$.`, `$\\ddot{x} = -${n * n}(${x})$.`],
        steps: [{ h: 'Read n', d: `Period $\\dfrac{2\\pi}{${n}}$ gives $n = ${n}$` }, { h: 'Acceleration', d: `$\\ddot{x} = -${n * n}(${x}) = ${-n * n * x}$ m/s²` }] });
  } }
];

// A draw that hits an excluded parameter combination (an unlucky ratio, a zero
// key) is redrawn from the same seeded stream, so a seed still reproduces.
export const SAFE_STATS = { retries: 0 };
const safe = list => list.map(v => ({
  ...v,
  make: (rng, diff) => {
    let last;
    for (let i = 0; i < 60; i++) {
      try { return v.make(rng, diff); } catch (e) { last = e; SAFE_STATS.retries++; }
    }
    throw last;
  }
}));

export const forms = {
  'mex-proof': safe(proofForms),
  'mex-demoivre': safe(demoivreForms),
  'mex-integration': safe(integrationForms),
  'mex-vectors': safe(vectorForms),
  'mex-mechanics': safe(mechanicsForms)
};
void D; void lcx; void isPrime; void rs;
