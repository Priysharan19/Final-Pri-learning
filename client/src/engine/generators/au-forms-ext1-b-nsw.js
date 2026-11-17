// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Prithagoras capacity overlay — Extension 1, slot B
// me12-induction, me12-binomial, me12-projectile, me12-vectors.
// Every key is computed by deterministic code from the numbers shown in the
// prompt (series keys by explicit summation, then checked against the closed
// form). Forms are placed by difficulty so each stays on the dot point the
// curriculum assigns to that cell. Variants are chosen by au-forms-apply.js.
// ─────────────────────────────────────────────────────────────────────────────
import { ri, rc, nz, mcq } from '../qhelpers.js';

const fin = v => typeof v === 'number' && Number.isFinite(v);
const rnd = (v, dp) => Math.round(v * 10 ** dp) / 10 ** dp;
/** true when rounding v to dp places does not sit on a half-way boundary. */
const safe = (v, dp) => { const s = Math.abs(v) * 10 ** dp; return Math.abs((s - Math.floor(s)) - 0.5) > 0.03; };
const rad = d => d * Math.PI / 180;
const deg = r => r * 180 / Math.PI;
const go = f => { for (let i = 0; i < 400; i++) { const q = f(); if (q) return q; } throw new Error('au-forms ext1-b: no valid draw'); };

/** A numeric payload; a trap that equals the key (or repeats) is not a misconception, so it is dropped. */
function num(prompt, value, { tol, suffix, traps = [], hints, steps } = {}) {
  const seen = [value];
  const tr = [];
  for (const t of traps) {
    if (!fin(t.value)) continue;
    if (seen.some(s => Math.abs(s - t.value) <= Math.max(2 * (tol || 0), 1e-9))) continue;
    seen.push(t.value);
    tr.push(tol ? { ...t, tol } : t);
  }
  const answer = tol ? { value, tol } : { value };
  const q = { prompt, answerType: 'numeric', answer, traps: tr, hints, steps };
  if (suffix) q.answerSuffix = suffix;
  return q;
}
function mc(rng, prompt, correct, ds, hints, steps) {
  const m = mcq(rng, correct, ds);
  return { prompt, answerType: 'mcq', answer: { correctIndex: m.correctIndex, optionTraps: m.optionTraps }, mcqOptions: m.options, hints, steps };
}
const pv = v => (/^\w$/.test(v) ? v : `(${v})`);
const cn = (c, v) => (c === 1 ? v : c === -1 ? `-${v}` : `${c}${v}`);
/** Singular/plural noun for a count, and English ordinals (1st, 2nd, 3rd, 4th, 11th, 21st…). */
const pl = (n, w) => (n === 1 ? w : `${w}s`);
const ord = n => { const t = n % 100, u = n % 10; return `${n}${t >= 11 && t <= 13 ? 'th' : u === 1 ? 'st' : u === 2 ? 'nd' : u === 3 ? 'rd' : 'th'}`; };
/** (base) raised to e, with no ^{1}. */
const pw = (b, e) => (e === 1 ? `(${b})` : `(${b})^{${e}}`);
/** c·v + k and k + c·v written without 1k or '+ -'. */
const lin = (c, v, k) => `${cn(c, v)} ${k < 0 ? '-' : '+'} ${Math.abs(k)}`;
const cl = (k, c, v) => `${k} ${c < 0 ? '-' : '+'} ${Math.abs(c) === 1 ? '' : Math.abs(c)}${v}`;
/** true when every value differs from every other by more than 1e-9 (MCQ options must not coincide). */
const distinct = vals => vals.every((x, i) => vals.every((y, j) => i === j || Math.abs(x - y) > 1e-9));
const sc = (k, s) => (k === 1 ? s : k === -1 ? `-${s}` : `${k}${s}`);
const col = (x, y) => `\\begin{pmatrix} ${x} \\\\ ${y} \\end{pmatrix}`;
const A = '\\underset{\\sim}{a}';
const B = '\\underset{\\sim}{b}';
const hyp = (x, y) => Math.hypot(x, y);
const TRIP = [[3, 4, 5], [5, 12, 13], [8, 15, 17], [7, 24, 25], [20, 21, 29], [6, 8, 10], [9, 12, 15], [12, 16, 20], [10, 24, 26], [15, 20, 25], [9, 40, 41], [12, 35, 37]];
const trip = rng => { const [x, y, m] = rc(rng, TRIP); return rng() < 0.5 ? [x, y, m] : [y, x, m]; };

// ═════════════════════════════ INDUCTION ═════════════════════════════════════

/** A summation identity with its terms, closed form and the closed form as LaTeX at any argument. */
function sumFam(rng) {
  const kind = ri(rng, 1, 4);
  let F;
  if (kind === 1) {
    const a = ri(rng, 1, 9), b = ri(rng, 1, 15);
    F = {
      term: i => a * i + b, rhs: n => n * (a * n + a + 2 * b) / 2,
      claim: `${a + b} + ${2 * a + b} + \\cdots + (${cn(a, 'n')} + ${b}) = \\dfrac{n\\left(${cn(a, 'n')} + ${a + 2 * b}\\right)}{2}`,
      rhsTex: v => `\\dfrac{${pv(v)}\\left(${a === 1 ? v : a + pv(v)} + ${a + 2 * b}\\right)}{2}`
    };
  } else if (kind === 2) {
    const a = ri(rng, 1, 9), r = ri(rng, 2, 6);
    const ac = a === 1 ? '' : a;
    F = {
      term: i => a * r ** (i - 1), rhs: n => a * (r ** n - 1) / (r - 1),
      claim: `${a} + ${a * r} + ${a * r * r} + \\cdots + ${a === 1 ? '' : a + '\\cdot '}${r}^{n-1} = ${r === 2 ? `${ac}\\left(${r}^n - 1\\right)` : `\\dfrac{${ac}\\left(${r}^n - 1\\right)}{${r - 1}}`}`,
      rhsTex: v => (r === 2 ? `${ac}\\left(${r}^{${v}} - 1\\right)` : `\\dfrac{${ac}\\left(${r}^{${v}} - 1\\right)}{${r - 1}}`)
    };
  } else if (kind === 3) {
    const c = ri(rng, 1, 8);
    F = {
      term: i => i * (i + c), rhs: n => n * (n + 1) * (2 * n + 1 + 3 * c) / 6,
      claim: `1\\cdot ${1 + c} + 2\\cdot ${2 + c} + \\cdots + n(n + ${c}) = \\dfrac{n(n+1)(2n + ${1 + 3 * c})}{6}`,
      rhsTex: v => `\\dfrac{${pv(v)}(${v} + 1)\\left(2${pv(v)} + ${1 + 3 * c}\\right)}{6}`
    };
  } else {
    const a = ri(rng, 2, 9);
    F = {
      term: i => a * i * i, rhs: n => a * n * (n + 1) * (2 * n + 1) / 6,
      claim: `${a}\\cdot 1^2 + ${a}\\cdot 2^2 + \\cdots + ${a}n^2 = \\dfrac{${a}n(n+1)(2n+1)}{6}`,
      rhsTex: v => `\\dfrac{${a}${pv(v)}(${v} + 1)\\left(2${pv(v)} + 1\\right)}{6}`
    };
  }
  F.sum = n => { let s = 0; for (let i = 1; i <= n; i++) s += F.term(i); return s; };
  for (let n = 1; n <= 9; n++) if (F.sum(n) !== F.rhs(n)) throw new Error('induction family: closed form disagrees with the sum');
  return F;
}

const makeI1a = (rng) => go(() => {
  const F = sumFam(rng), m = ri(rng, 3, 25);
  if (F.rhs(m + 2) > 1e12) return null;
  const v = F.term(m + 1);
  return num(`Mathematical induction is used to prove that $${F.claim}$ for all positive integers $n$. In the step from $n = ${m}$ to $n = ${m + 1}$, what is the value of the term added to the left side?`, v, {
    traps: [{ value: F.term(m), why: `The term added going to $n = ${m + 1}$ is the ${ord(m + 1)} term, not the ${ord(m)}.` }, { value: F.term(m + 2), why: `Stop at the ${ord(m + 1)} term — that is the one the step adds.` }],
    hints: ['The step adds exactly one new term to the left side.', `The new term is the ${ord(m + 1)} term of the series.`, 'Substitute that position into the general term.'],
    steps: [{ h: 'Identify the new term', d: `The left side gains its ${ord(m + 1)} term.` }, { h: 'Evaluate', d: `$${v}$` }]
  });
});
const makeI1b = (rng) => {
  const F = sumFam(rng), m = ri(rng, 2, 9);
  const v = F.sum(m);
  return num(`A proof by induction of $${F.claim}$ checks the claim at $n = ${m}$. Find the common value of the two sides there.`, v, {
    traps: [{ value: F.sum(m + 1), why: `Use $n = ${m}$, not the next case.` }, { value: F.sum(m - 1), why: `Use $n = ${m}$, not the case before it.` }],
    hints: [`Add the first ${m} terms of the left side.`, `Then substitute $n = ${m}$ into the right side.`, 'The two must agree.'],
    steps: [{ h: 'Left side at n = ' + m, d: `Sum of the first ${m} terms $= ${v}$` }, { h: 'Right side at n = ' + m, d: `Closed form $= ${v}$` }, { h: 'Base case holds', d: `Both sides equal $${v}$ ✓` }]
  });
};
const makeI1c = (rng) => {
  const F = sumFam(rng);
  return mc(rng, `To prove $${F.claim}$ for all integers $n \\ge 1$ by induction, which statement is the **inductive hypothesis** (the assumption made in the inductive step)?`,
    'Assume the result is true for $n = k$, for some integer $k \\ge 1$',
    [{ text: 'Assume the result is true for $n = k + 1$', why: 'The $n = k + 1$ case is what the step must deduce, not assume.' },
      { text: 'Assume the result is true for every positive integer $n$', why: 'That assumes the very thing to be proved.' },
      { text: 'Assume the result is true for $n = 1$', why: 'That is the base case, which is checked, not assumed.' }],
    ['The step shows: if it holds for one value, it holds for the next.', 'The assumed case is written with a general integer $k$.', 'The case after it is the target.'],
    [{ h: 'Inductive hypothesis', d: 'Assume the statement is true for $n = k$ (some $k \\ge 1$), then show it is true for $n = k + 1$.' }]);
};
const makeI1d = (rng) => {
  const a = ri(rng, 1, 30), d = ri(rng, 2, 12), m = ri(rng, 3, 12);
  let V = 0; for (let i = 0; i < m; i++) V += a + i * d;
  const found = (2 * V / m - d * (m - 1)) / 2;
  if (found !== a) throw new Error('induction I1d: solved first term disagrees');
  return num(`Induction proves that $a + (a + ${d}) + (a + ${2 * d}) + \\cdots$ with $n$ terms has sum $\\dfrac{n\\left(2a + ${d}(n-1)\\right)}{2}$. The sum of the first $${m}$ terms is $${V}$. Find the first term $a$.`, a, {
    traps: [{ value: V / m, why: `$${V}\\div ${m}$ is the mean of the terms, not the first term.` }],
    hints: [`Substitute $n = ${m}$ into the formula.`, `$\\dfrac{${m}(2a + ${d * (m - 1)})}{2} = ${V}$.`, 'Solve the linear equation for $a$.'],
    steps: [{ h: 'Set up', d: `$\\dfrac{${m}\\left(2a + ${d}(${m - 1})\\right)}{2} = ${V}$` }, { h: 'Solve', d: `$2a + ${d * (m - 1)} = ${2 * V / m}$, so $a = ${a}$` }]
  });
};
const makeI1e = (rng) => {
  const a = ri(rng, 12, 40), d = ri(rng, 2, 8), m = ri(rng, 5, 20);
  let V = 0; for (let i = 0; i < m; i++) V += a + i * d;
  return num(`The first row of a grandstand at a Sydney cricket ground has $${a}$ seats and each later row has $${d}$ more seats than the row before. Induction proves that the first $n$ rows hold $\\dfrac{n\\left(${2 * a} + ${d}(n-1)\\right)}{2}$ seats. How many seats are in the first $${m}$ rows?`, V, {
    traps: [{ value: a + (m - 1) * d, why: `That is only the ${m}th row — the question asks for the total of all ${m} rows.` }],
    hints: ['Use the proven formula with $n$ equal to the number of rows.', `$n = ${m}$.`, 'Evaluate carefully.'],
    steps: [{ h: 'Substitute', d: `$\\dfrac{${m}\\left(${2 * a} + ${d}(${m - 1})\\right)}{2}$` }, { h: 'Evaluate', d: `$${V}$ seats` }]
  });
};

const makeI2a = (rng) => {
  if (rng() < 0.5) {
    const a = ri(rng, 1, 12), b = ri(rng, 1, 25);
    const c = a + 2 * b;
    for (let n = 1; n <= 8; n++) { let s = 0; for (let i = 1; i <= n; i++) s += a * i + b; if (s !== n * (a * n + c) / 2) throw new Error('induction I2a'); }
    return num(`Show that $${a + b} + ${2 * a + b} + \\cdots + (${cn(a, 'n')} + ${b}) = \\dfrac{n}{2}\\left(${cn(a, 'n')} + c\\right)$ for all positive integers $n$. Find the constant $c$.`, c, {
      traps: [{ value: a + b, why: `$${a + b}$ is only the first term. Check $n = 1$: the right side must equal $${a + b}$.` }, { value: 2 * b, why: 'Test $n = 1$ and $n = 2$ to pin down the constant.' }],
      hints: ['Put $n = 1$: the right side must equal the first term.', `$\\dfrac{1}{2}(${a} + c) = ${a + b}$.`, 'Solve for $c$.'],
      steps: [{ h: 'Test n = 1', d: `$\\dfrac{1}{2}(${a} + c) = ${a + b}$` }, { h: 'Solve', d: `$c = ${2 * (a + b)} - ${a} = ${c}$` }, { h: 'Check n = 2', d: `$\\dfrac{2}{2}(${2 * a} + ${c}) = ${2 * a + c}$ and $${a + b} + ${2 * a + b} = ${3 * a + 2 * b}$ ✓` }]
    });
  }
  const k = ri(rng, 1, 20), e = 1 + 3 * k;
  return num(`Show that $1\\cdot ${1 + k} + 2\\cdot ${2 + k} + \\cdots + n(n + ${k}) = \\dfrac{n(n+1)(2n + c)}{6}$ for all positive integers $n$. Find the constant $c$.`, e, {
    traps: [{ value: k, why: `Substitute $n = 1$: $\\dfrac{1\\cdot 2\\cdot(2 + c)}{6}$ must equal $${1 + k}$.` }, { value: 1 + k, why: `Substitute $n = 1$ and solve $\\dfrac{2(2 + c)}{6} = ${1 + k}$.` }],
    hints: ['Put $n = 1$: the right side must equal the first term.', `$\\dfrac{1\\cdot 2\\cdot(2 + c)}{6} = ${1 + k}$.`, 'Solve for $c$.'],
    steps: [{ h: 'Test n = 1', d: `$\\dfrac{2(2 + c)}{6} = ${1 + k}$` }, { h: 'Solve', d: `$2 + c = ${3 * (1 + k)}$, so $c = ${e}$` }]
  });
};
const makeI2b = (rng) => go(() => {
  const F = sumFam(rng), m = ri(rng, 3, 20);
  if (F.rhs(m + 2) > 1e12) return null;
  const v = F.rhs(m + 1) - F.rhs(m);
  if (v !== F.term(m + 1)) throw new Error('induction I2b');
  return num(`In an inductive proof of $${F.claim}$, the target is the right side at $n = k + 1$. When $k = ${m}$, how much larger is the right side at $n = ${m + 1}$ than at $n = ${m}$?`, v, {
    traps: [{ value: F.rhs(m + 1), why: 'The question asks for the difference of the two values, not the larger value.' }],
    hints: ['Evaluate the closed form at both values of $n$.', 'The difference should be the term the step adds.', `Right side at $n = ${m + 1}$ minus right side at $n = ${m}$.`],
    steps: [{ h: 'Closed form at n = ' + m, d: `$${F.rhs(m)}$` }, { h: 'Closed form at n = ' + (m + 1), d: `$${F.rhs(m + 1)}$` }, { h: 'Difference', d: `$${F.rhs(m + 1)} - ${F.rhs(m)} = ${v}$` }]
  });
});
const makeI2c = (rng) => go(() => {
  const F = sumFam(rng), m = ri(rng, 3, 20);
  if (F.rhs(m + 2) > 1e12) return null;
  const v = F.rhs(m) + F.term(m + 1);
  if (v !== F.rhs(m + 1)) throw new Error('induction I2c');
  return num(`In the inductive step for $${F.claim}$, assume the result for $n = k$ and add the $(k + 1)$th term to the right side. When $k = ${m}$, evaluate this sum.`, v, {
    traps: [{ value: F.rhs(m), why: 'You must add the next term to the assumed right side.' }],
    hints: [`Evaluate the closed form at $n = ${m}$.`, `Find the term added next: the ${ord(m + 1)} term.`, 'Add the two values; the total should match the closed form at $n = k + 1$.'],
    steps: [{ h: 'Assumed value', d: `$${F.rhs(m)}$` }, { h: 'Next term', d: `$${F.term(m + 1)}$` }, { h: 'Sum', d: `$${v}$ — equal to the closed form at $n = ${m + 1}$ ✓` }]
  });
});
const makeI2d = (rng) => {
  const F = sumFam(rng);
  return mc(rng, `To prove $${F.claim}$ by induction, the inductive step assumes the result for $n = k$ and adds the $(k + 1)$th term. What must the result be shown to equal?`,
    `$${F.rhsTex('k + 1')}$`,
    [{ text: `$${F.rhsTex('k')}$`, why: 'That is the assumed right side at $n = k$, which is the starting point, not the target.' },
      { text: `$${F.rhsTex('k + 2')}$`, why: 'The step goes from $n = k$ to $n = k + 1$, not to $k + 2$.' },
      { text: `$${F.rhsTex('k')} + 1$`, why: 'Adding the constant 1 is not the same as adding the next term of the series.' }],
    ['The goal is the claim itself at the next value of $n$.', 'Replace every $n$ in the right side with $k + 1$.', 'The left side after adding one term is the sum to $k + 1$ terms.'],
    [{ h: 'Target', d: `$${F.rhsTex('k + 1')}$` }]);
};
const makeI2e = (rng) => {
  const c = ri(rng, 1, 30), e = 1 + 3 * c, f = e + 2;
  return num(`Assume that $1\\cdot ${1 + c} + 2\\cdot ${2 + c} + \\cdots + k(k + ${c}) = \\dfrac{k(k+1)(2k + ${e})}{6}$. Adding the next term $(k+1)(k + ${1 + c})$ and simplifying gives $\\dfrac{(k+1)(k+2)(2k + f)}{6}$. Find the constant $f$.`, f, {
    traps: [{ value: e, why: 'Compare with the claim at $n = k + 1$: replace $n$ by $k + 1$ in $2n + ' + e + '$.' }],
    hints: ['The result should be the claim with $n$ replaced by $k + 1$.', `$2(k + 1) + ${e} = 2k + ${e + 2}$.`, 'Read off $f$.'],
    steps: [{ h: 'Target form', d: `$\\dfrac{(k+1)(k+2)\\left(2(k+1) + ${e}\\right)}{6}$` }, { h: 'Simplify', d: `$2(k+1) + ${e} = 2k + ${f}$` }, { h: 'Constant', d: `$f = ${f}$` }]
  });
};

const makeT3a = (rng) => {
  const t = ri(rng, 1, 25), c = 3 * t - 1, m = ri(rng, 1, 30);
  const diff = (m + 1) ** 3 + c * (m + 1) - m ** 3 - c * m;
  if (diff % 3 !== 0) throw new Error('induction T3a');
  const v = diff / 3;
  return num(`To prove $n^3 + ${c}n$ is divisible by $3$ for every positive integer $n$, assume $k^3 + ${c}k = 3p$. Then $(k+1)^3 + ${c}(k+1) = (k^3 + ${c}k) + 3\\,(\\;?\\;)$, where the bracket is an expression in $k$. Find the value of the bracket when $k = ${m}$.`, v, {
    traps: [{ value: m * m + m, why: `Do not drop the constant: $${c} + 1 = ${c + 1}$ also contributes a multiple of 3.` }, { value: diff, why: 'That is the whole difference; the bracket is the difference divided by 3.' }],
    hints: [`Expand $(k+1)^3 = k^3 + 3k^2 + 3k + 1$.`, `The leftover is $3k^2 + 3k + ${c + 1}$.`, `Factor out 3: $3(k^2 + k + ${t})$.`],
    steps: [{ h: 'Expand', d: `$(k+1)^3 + ${c}(k+1) - (k^3 + ${c}k) = 3k^2 + 3k + ${c + 1}$` }, { h: 'Factor', d: `$= 3(k^2 + k + ${t})$` }, { h: `At k = ${m}`, d: `$${m}^2 + ${m} + ${t} = ${v}$` }]
  });
};
const makeT3b = (rng) => {
  const b = ri(rng, 4, 15), c = ri(rng, 1, b - 2), d = b - c, m = ri(rng, 2, 6);
  const val = b ** m - c ** m;
  if (val % d !== 0) throw new Error('induction T3b');
  return num(`To prove $${b}^n - ${c}^n$ is divisible by $${d}$ for every positive integer $n$ by induction, the proof must be checked at $n = ${m}$. Write $${b}^{${m}} - ${c}^{${m}} = ${d}p$ and find the integer $p$.`, val / d, {
    traps: [{ value: val, why: `That is the value of $${b}^{${m}} - ${c}^{${m}}$ itself; divide it by ${d}.` }],
    hints: [`Evaluate $${b}^{${m}}$ and $${c}^{${m}}$.`, `$${b ** m} - ${c ** m} = ${val}$.`, `Divide by ${d}.`],
    steps: [{ h: 'Evaluate', d: `$${b}^{${m}} - ${c}^{${m}} = ${b ** m} - ${c ** m} = ${val}$` }, { h: 'Divide', d: `$${val} \\div ${d} = ${val / d}$, so $p = ${val / d}$ ✓` }]
  });
};
const makeT3c = (rng) => {
  const m = ri(rng, 1, 40);
  if (rng() < 0.5) {
    const diff = (m + 1) * (m + 2) * (m + 3) - m * (m + 1) * (m + 2);
    if (diff % 6 !== 0) throw new Error('induction T3c');
    return num(`To prove $n(n+1)(n+2)$ is divisible by $6$ by induction, show $(k+1)(k+2)(k+3) - k(k+1)(k+2) = 6q$. Find the integer $q$ when $k = ${m}$.`, diff / 6, {
      traps: [{ value: diff, why: 'That is the difference; divide it by 6 to find $q$.' }],
      hints: ['Factor $(k+1)(k+2)$ out of the difference.', '$(k+1)(k+2)\\big[(k+3) - k\\big] = 3(k+1)(k+2)$.', `At $k = ${m}$ the difference is $${diff}$.`],
      steps: [{ h: 'Difference', d: `$3(k+1)(k+2) = 3(${m + 1})(${m + 2}) = ${diff}$` }, { h: 'Divide by 6', d: `$q = ${diff / 6}$` }]
    });
  }
  const diff = (m + 1) * (m + 2) * (m + 3) * (m + 4) - m * (m + 1) * (m + 2) * (m + 3);
  if (diff % 24 !== 0) throw new Error('induction T3c');
  return num(`To prove $n(n+1)(n+2)(n+3)$ is divisible by $24$ by induction, show $(k+1)(k+2)(k+3)(k+4) - k(k+1)(k+2)(k+3) = 24q$. Find the integer $q$ when $k = ${m}$.`, diff / 24, {
    traps: [{ value: diff, why: 'That is the difference; divide it by 24 to find $q$.' }],
    hints: ['Factor $(k+1)(k+2)(k+3)$ out of the difference.', '$(k+1)(k+2)(k+3)\\big[(k+4) - k\\big] = 4(k+1)(k+2)(k+3)$.', `At $k = ${m}$ evaluate and divide by 24.`],
    steps: [{ h: 'Difference', d: `$4(${m + 1})(${m + 2})(${m + 3}) = ${diff}$` }, { h: 'Divide by 24', d: `$q = ${diff / 24}$` }]
  });
};
const makeT3d = (rng) => {
  const b = ri(rng, 3, 9), c = ri(rng, 1, b - 1), m = ri(rng, 1, 3);
  const val = b ** (2 * m + 2) - c ** (2 * m + 2);
  if (val % (b + c) !== 0) throw new Error('induction T3d');
  return num(`To prove $${b}^{2n} - ${c}^{2n}$ is divisible by $${b + c}$ by induction, assume $${b}^{2k} - ${c}^{2k} = ${b + c}p$. The inductive step writes $${b}^{2k+2} - ${c}^{2k+2} = ${b + c}(\\;?\\;)$. Find the value of the bracket when $k = ${m}$.`, val / (b + c), {
    traps: [{ value: val, why: `That is $${b}^{${2 * m + 2}} - ${c}^{${2 * m + 2}}$ itself; divide it by ${b + c}.` }],
    hints: [`$${b}^{2k+2} - ${c}^{2k+2} = ${b * b}(${b}^{2k} - ${c}^{2k}) + ${c}^{2k}(${b * b} - ${c * c})$.`, `$${b * b} - ${c * c} = ${b + c}(${b - c})$.`, `At $k = ${m}$, the bracket equals $\\dfrac{${b}^{${2 * m + 2}} - ${c}^{${2 * m + 2}}}{${b + c}}$.`],
    steps: [{ h: 'Split', d: `$${b}^{2k+2} - ${c}^{2k+2} = ${b * b}(${b + c}p) + ${c}^{2k}(${b + c})(${b - c})$` }, { h: 'Factor', d: `$= ${b + c}\\left(${b * b}p + ${c}^{2k}(${b - c})\\right)$` }, { h: `At k = ${m}`, d: `Bracket $= ${val} \\div ${b + c} = ${val / (b + c)}$` }]
  });
};
const makeT3e = (rng) => {
  const t = ri(rng, 1, 25), c = 3 * t - 1;
  return mc(rng, `In the inductive step proving $n^3 + ${c}n$ is divisible by $3$, a student shows $(k+1)^3 + ${c}(k+1) = (k^3 + ${c}k) + 3(k^2 + k + ${t})$. Which statement completes the proof correctly?`,
    `$k^3 + ${c}k$ is a multiple of 3 by the assumption, and $3(k^2 + k + ${t})$ is a multiple of 3, so the sum is a multiple of 3`,
    [{ text: `$3(k^2 + k + ${t})$ is a multiple of 3, so the result is true without using the assumption`, why: 'The first part, $k^3 + ' + c + 'k$, is only known to be a multiple of 3 because of the inductive hypothesis.' },
      { text: `The result is true for $n = 1$, so it is true for $n = k + 1$`, why: 'One true case does not prove the next; the step must use the assumption for $n = k$.' },
      { text: `$k^3 + ${c}k$ is a multiple of 3 for all $k$, so there is nothing more to prove`, why: 'That assumes the statement for every $k$, which is circular.' }],
    ['Both parts of the sum need to be multiples of 3.', 'One part is covered by the assumption for $n = k$.', 'The other is visibly $3\\times$ an integer.'],
    [{ h: 'Conclusion', d: 'Hypothesis covers $k^3 + ' + c + 'k$; the other part is $3\\times$ an integer. The sum is divisible by 3, so $P(k) \\Rightarrow P(k+1)$.' }]);
};

// ═════════════════════════════ BINOMIAL ══════════════════════════════════════

const nCr = (n, k) => { let r = 1; for (let i = 1; i <= k; i++) r = r * (n - k + i) / i; return Math.round(r); };
const pmf = (n, k, p) => nCr(n, k) * p ** k * (1 - p) ** (n - k);
const P4 = v => rnd(v, 4);
const T4 = 0.000005;
const pr = rng => ri(rng, 5, 95) / 100;
const q2 = p => rnd(1 - p, 2);
const okP = v => v >= 0.002 && v <= 0.998 && safe(v, 4);
const eps = 0.001;

const makeB1a = (rng) => go(() => {
  const q = ri(rng, 5, 95) / 100, p = q2(q), n = ri(rng, 4, 15), k = ri(rng, 1, n - 1);
  const v = pmf(n, k, p);
  if (!okP(v)) return null;
  return num(`In netball, a goal shooter misses on any attempt with probability $${q}$, independently of other attempts. In $${n}$ attempts, find the probability that she scores exactly $${k}$ ${pl(k, "goal")}, correct to 4 decimal places.`, P4(v), {
    tol: T4, traps: [{ value: P4(pmf(n, k, q)), why: `The probability of a success is $1 - ${q} = ${p}$, not ${q}.` }, { value: P4(p ** k * q ** (n - k)), why: `Include the $\\binom{${n}}{${k}}$ ways to choose which attempts score.` }],
    hints: [`A goal has probability $1 - ${q} = ${p}$.`, `$P = \\binom{${n}}{${k}}${pw(p, k)}${pw(q, n - k)}$.`, 'Evaluate and round to 4 decimal places.'],
    steps: [{ h: 'Success probability', d: `$p = 1 - ${q} = ${p}$` }, { h: 'Binomial formula', d: `$P(X = ${k}) = \\binom{${n}}{${k}}${pw(p, k)}${pw(q, n - k)}$` }, { h: 'Evaluate', d: `$\\approx ${P4(v)}$` }]
  });
});
const makeB1b = (rng) => go(() => {
  const pc = ri(rng, 20, 90), p = pc / 100, n = ri(rng, 4, 14), k = ri(rng, 1, n - 1);
  const v = pmf(n, k, p);
  if (!okP(v)) return null;
  return num(`An AFL player converts $${pc}\\%$ of his set shots at goal, independently. Of his next $${n}$ set shots, find the probability that exactly $${k}$ are converted, correct to 4 decimal places.`, P4(v), {
    tol: T4, traps: [{ value: P4(p ** k), why: 'Include the failures and the number of arrangements too.' }, { value: P4(pmf(n, n - k, p)), why: `Exactly $${k}$ ${k === 1 ? "success" : "successes"} needs the exponent $${k}$ on $p$, not $${n - k}$.` }],
    hints: [`Write the percentage as a probability: $p = ${p}$.`, `$P = \\binom{${n}}{${k}}${pw(p, k)}${pw(q2(p), n - k)}$.`, 'Evaluate and round.'],
    steps: [{ h: 'Probability', d: `$p = ${p}$, $q = ${q2(p)}$` }, { h: 'Binomial formula', d: `$\\binom{${n}}{${k}}${pw(p, k)}${pw(q2(p), n - k)}$` }, { h: 'Evaluate', d: `$\\approx ${P4(v)}$` }]
  });
});
const makeB1c = (rng) => go(() => {
  const n = ri(rng, 3, 9);
  if (rng() < 0.5) {
    const p = ri(rng, 55, 95) / 100, v = p ** n;
    if (!okP(v)) return null;
    return num(`Each of $${n}$ independent trials succeeds with probability $${p}$. Find the probability that **every** trial succeeds, correct to 4 decimal places.`, P4(v), {
      tol: T4, traps: [{ value: P4(n * p), why: 'Independent probabilities multiply; they are not added.' }],
      hints: ['All trials succeeding is the case $X = n$.', `$\\binom{${n}}{${n}} = 1$, so $P = ${p}^{${n}}$.`, 'Evaluate.'],
      steps: [{ h: 'All succeed', d: `$P(X = ${n}) = \\binom{${n}}{${n}}(${p})^{${n}} = ${p}^{${n}}$` }, { h: 'Evaluate', d: `$\\approx ${P4(v)}$` }]
    });
  }
  const p = ri(rng, 5, 40) / 100, v = (1 - p) ** n;
  if (!okP(v)) return null;
  return num(`Each of $${n}$ independent trials succeeds with probability $${p}$. Find the probability that **no** trial succeeds, correct to 4 decimal places.`, P4(v), {
    tol: T4, traps: [{ value: P4(p ** n), why: `No success means every trial fails, each with probability $1 - ${p} = ${q2(p)}$.` }],
    hints: ['No successes is the case $X = 0$.', `$\\binom{${n}}{0} = 1$, so $P = (${q2(p)})^{${n}}$.`, 'Evaluate.'],
    steps: [{ h: 'None succeed', d: `$P(X = 0) = (1 - ${p})^{${n}} = ${q2(p)}^{${n}}$` }, { h: 'Evaluate', d: `$\\approx ${P4(v)}$` }]
  });
});
const makeB1d = (rng) => {
  const n = ri(rng, 6, 24), k = ri(rng, 2, Math.floor(n / 2)), p = ri(rng, 10, 90) / 100;
  const v = nCr(n, k);
  return num(`A binomial random variable has $n = ${n}$ trials and success probability $p = ${p}$. In the formula $P(X = ${k}) = \\binom{n}{k}p^k(1 - p)^{n - k}$, evaluate the binomial coefficient $\\binom{${n}}{${k}}$.`, v, {
    traps: [{ value: nCr(n, k - 1), why: `$\\binom{${n}}{${k}} = \\dfrac{${n}!}{${k}!\\,${n - k}!}$.` }, { value: Math.round(v * p ** k * (1 - p) ** (n - k) * 1e4) / 1e4 === v ? v + 1 : v * k, why: `Evaluate the coefficient only — not the whole probability.` }],
    hints: ['Use $\\binom{n}{k} = \\dfrac{n!}{k!(n-k)!}$.', `$\\binom{${n}}{${k}} = \\dfrac{${n}!}{${k}!\\,${n - k}!}$.`, 'Cancel before multiplying out.'],
    steps: [{ h: 'Formula', d: `$\\binom{${n}}{${k}} = \\dfrac{${n}!}{${k}!\\,${n - k}!}$` }, { h: 'Evaluate', d: `$= ${v}$` }]
  });
};
const makeB1e = (rng) => go(() => {
  const n = ri(rng, 5, 15), k = ri(rng, 1, n - 1), p = ri(rng, 10, 90) / 100, q = q2(p);
  if (k === n - k || p === 0.5) return null;
  return mc(rng, `A fair-minded umpire records that each ball in a cricket over is a dot ball with probability $${p}$, independently. In $${n}$ balls, which expression gives $P(\\text{exactly } ${k} \\text{ ${pl(k, 'dot ball')}})$?`,
    `$\\dbinom{${n}}{${k}}${pw(p, k)}${pw(q, n - k)}$`,
    [{ text: `$${pw(p, k)}${pw(q, n - k)}$`, why: 'This omits the number of ways of choosing which balls are dot balls.' },
      { text: `$\\dbinom{${n}}{${k}}${pw(p, n - k)}${pw(q, k)}$`, why: 'The exponents are swapped: $p$ goes with the number of successes.' },
      { text: `$\\dbinom{${n}}{${k}}${pw(p, k)}${pw(q, k)}$`, why: `The failure exponent is $n - k = ${n - k}$, not ${k}.` }],
    ['Binomial: $\\binom{n}{k}p^k(1-p)^{n-k}$.', `Here $n = ${n}$ and $k = ${k}$.`, `$1 - p = ${q}$.`],
    [{ h: 'Formula', d: `$\\binom{${n}}{${k}}${pw(p, k)}${pw(q, n - k)}$` }]);
});

const makeB3a = (rng) => go(() => {
  const n = ri(rng, 5, 60), p = ri(rng, 10, 90) / 100;
  const raw = n * p * (1 - p), v = rnd(raw, 2);
  if (!safe(raw, 2)) return null;
  return num(`$X$ is binomial with $n = ${n}$ trials and $p = ${p}$. Find the **variance** $\\text{Var}(X)$, correct to 2 decimal places.`, v, {
    tol: 0.0005, traps: [{ value: rnd(n * p, 2), why: '$np$ is the mean, not the variance.' }, { value: rnd(Math.sqrt(raw), 2), why: 'That is the standard deviation; the variance is $np(1 - p)$.' }],
    hints: ['$\\text{Var}(X) = np(1 - p)$.', `$1 - p = ${q2(p)}$.`, `$${n} \\times ${p} \\times ${q2(p)}$.`],
    steps: [{ h: 'Formula', d: `$\\text{Var}(X) = np(1 - p) = ${n}(${p})(${q2(p)})$` }, { h: 'Evaluate', d: `$\\approx ${v}$` }]
  });
});
const makeB3b = (rng) => go(() => {
  const n = ri(rng, 5, 80), p = ri(rng, 10, 90) / 100;
  const mu = rnd(n * p, 4), s2 = P4(n * p * (1 - p));
  const nn = Math.round(mu / (1 - s2 / mu));
  if (nn !== n || Math.abs(mu / (1 - s2 / mu) - n) > 1e-6) return null;
  return num(`A binomial random variable has mean $${mu}$ and variance $${s2}$. Find the number of trials $n$.`, n, {
    traps: [{ value: Math.round(mu * 2), why: 'First find $1 - p = \\text{variance} \\div \\text{mean}$, then $p$, then $n = \\text{mean} \\div p$.' }],
    hints: ['Mean $= np$, variance $= np(1 - p)$.', `Divide: $1 - p = ${s2} \\div ${mu}$.`, 'Then $n = \\text{mean} \\div p$.'],
    steps: [{ h: 'Find 1 − p', d: `$1 - p = \\dfrac{${s2}}{${mu}} = ${q2(p)}$` }, { h: 'Find p', d: `$p = ${p}$` }, { h: 'Find n', d: `$n = \\dfrac{${mu}}{${p}} = ${n}$` }]
  });
});
const makeB3c = (rng) => go(() => {
  const n = ri(rng, 10, 80), p = ri(rng, 10, 90) / 100, mu = rnd(n * p, 4);
  const sd = Math.sqrt(mu * (1 - mu / n));
  if (!safe(sd, 2)) return null;
  return num(`A binomial random variable has $n = ${n}$ trials and mean $${mu}$. Find its standard deviation, correct to 2 decimal places.`, rnd(sd, 2), {
    tol: 0.0005, traps: [{ value: rnd(mu * (1 - mu / n), 2), why: 'That is the variance — take the square root.' }],
    hints: [`Mean $= np$, so $p = ${mu} \\div ${n}$.`, `$p = ${p}$.`, 'Then $\\sigma = \\sqrt{np(1 - p)}$.'],
    steps: [{ h: 'Find p', d: `$p = \\dfrac{${mu}}{${n}} = ${p}$` }, { h: 'Variance', d: `$np(1 - p) = ${P4(n * p * (1 - p))}$` }, { h: 'Standard deviation', d: `$\\sigma \\approx ${rnd(sd, 2)}$` }]
  });
});
const makeB3d = (rng) => go(() => {
  const n = ri(rng, 20, 250), d = ri(rng, 2, 30), p = d / 100;
  const sd = Math.sqrt(n * p * (1 - p));
  if (!safe(sd, 2)) return null;
  return num(`A factory knows that $${d}\\%$ of the phone cases it makes have a surface flaw, independently. In a box of $${n}$ cases, find the standard deviation of the number of flawed cases, correct to 2 decimal places.`, rnd(sd, 2), {
    tol: 0.0005, traps: [{ value: rnd(n * p * (1 - p), 2), why: 'That is the variance — take the square root.' }, { value: rnd(Math.sqrt(n * p), 2), why: 'Include the factor $(1 - p)$ inside the square root.' }],
    hints: [`$p = ${p}$.`, `Variance $= np(1 - p) = ${P4(n * p * (1 - p))}$.`, 'Take the square root.'],
    steps: [{ h: 'Variance', d: `$${n}(${p})(${q2(p)}) = ${P4(n * p * (1 - p))}$` }, { h: 'Standard deviation', d: `$\\sqrt{${P4(n * p * (1 - p))}} \\approx ${rnd(sd, 2)}$` }]
  });
});
const makeB3f = (rng) => go(() => {
  const n = ri(rng, 6, 60), p = ri(rng, 10, 90) / 100;
  const v = P4(n * p * (1 - p)), mu = rnd(n * p, 4), sd = P4(Math.sqrt(v));
  const opts = [String(v), String(mu), String(sd), String(P4(n * p * p))];
  if (new Set(opts).size < 4) return null;
  return mc(rng, `For a binomial random variable with $n = ${n}$ and $p = ${p}$, which value is the **variance**?`, `$${v}$`,
    [{ text: `$${mu}$`, why: '$np$ is the mean.' }, { text: `$${sd}$`, why: 'That is the standard deviation, $\\sqrt{np(1-p)}$.' }, { text: `$${P4(n * p * p)}$`, why: 'The variance uses $np(1 - p)$, not $np^2$.' }],
    ['Variance of a binomial: $np(1 - p)$.', `$1 - p = ${q2(p)}$.`, `$${n} \\times ${p} \\times ${q2(p)}$.`],
    [{ h: 'Variance', d: `$np(1-p) = ${n}(${p})(${q2(p)}) = ${v}$` }]);
});

const makeB4a = (rng) => go(() => {
  const n = ri(rng, 4, 14), p = ri(rng, 5, 50) / 100;
  const v = 1 - pmf(n, 0, p) - pmf(n, 1, p);
  if (!okP(v)) return null;
  return num(`A batch of $${n}$ seedlings is planted; each survives with probability $${p}$, independently. Find the probability that **at least 2** survive, correct to 4 decimal places.`, P4(v), {
    tol: T4, traps: [{ value: P4(1 - pmf(n, 0, p)), why: '“At least 2” excludes both 0 and 1 survivors.' }, { value: P4(pmf(n, 0, p) + pmf(n, 1, p)), why: 'That is $P(X \\le 1)$ — the complement of what is asked.' }],
    hints: ['Use the complement: $P(X \\ge 2) = 1 - P(X = 0) - P(X = 1)$.', `$P(X = 0) = ${P4(pmf(n, 0, p))}$ and $P(X = 1) = ${P4(pmf(n, 1, p))}$.`, 'Subtract both from 1.'],
    steps: [{ h: 'Complement', d: `$P(X \\ge 2) = 1 - P(0) - P(1)$` }, { h: 'Values', d: `$P(0) \\approx ${P4(pmf(n, 0, p))}$, $P(1) \\approx ${P4(pmf(n, 1, p))}$` }, { h: 'Result', d: `$\\approx ${P4(v)}$` }]
  });
});
const makeB4b = (rng) => go(() => {
  const n = ri(rng, 5, 16), p = ri(rng, 10, 70) / 100, k = ri(rng, 1, 3);
  let v = 0; for (let i = 0; i <= k; i++) v += pmf(n, i, p);
  if (!okP(v)) return null;
  return num(`Each of $${n}$ players in a social cricket team independently turns up with probability $${p}$. Find the probability that **at most ${k}** turn up, correct to 4 decimal places.`, P4(v), {
    tol: T4, traps: [{ value: P4(pmf(n, k, p)), why: `“At most ${k}” includes every case from 0 to ${k}.` }],
    hints: [`$P(X \\le ${k}) = P(0) + \\cdots + P(${k})$.`, 'Use $\\binom{n}{r}p^r(1 - p)^{n - r}$ for each term.', 'Add and round.'],
    steps: [{ h: 'Sum the cases', d: `$P(X \\le ${k}) = P(X = 0) + \\cdots + P(X = ${k})$, each term $\\binom{${n}}{r}(${p})^r(${q2(p)})^{${n} - r}$` }, { h: 'Evaluate', d: `$\\approx ${P4(v)}$` }]
  });
});
const makeB4c = (rng) => go(() => {
  const p = ri(rng, 5, 60) / 100, target = rc(rng, [0.9, 0.95, 0.99]);
  let n = 1; while (1 - (1 - p) ** n <= target && n < 200) n++;
  if (n < 3 || n > 80) return null;
  if (Math.abs(1 - (1 - p) ** n - target) < 1e-6 || Math.abs(1 - (1 - p) ** (n - 1) - target) < 1e-6) return null;
  return num(`Each attempt at a free kick succeeds with probability $${p}$, independently. Find the smallest number of attempts $n$ so that the probability of **at least one** success is greater than $${target}$.`, n, {
    traps: [{ value: n - 1, why: `With ${n - 1} attempts the probability is still not greater than ${target}.` }],
    hints: ['$P(\\text{at least one}) = 1 - (1 - p)^n$.', `Solve $1 - ${q2(p)}^n > ${target}$.`, 'Test whole numbers of attempts (or use logarithms and round up).'],
    steps: [{ h: 'Set up', d: `$1 - ${q2(p)}^{n} > ${target}$, so $${q2(p)}^{n} < ${rnd(1 - target, 2)}$` }, { h: 'Test', d: `$n = ${n - 1}$ gives $${P4(1 - (1 - p) ** (n - 1))}$; $n = ${n}$ gives $${P4(1 - (1 - p) ** n)}$` }, { h: 'Smallest n', d: `$n = ${n}$` }]
  });
});
const makeB4d = (rng) => go(() => {
  const n = ri(rng, 6, 16), p = ri(rng, 20, 80) / 100, a = ri(rng, 1, Math.floor(n / 2)), b = a + ri(rng, 1, 3);
  if (b > n) return null;
  let v = 0; for (let i = a; i <= b; i++) v += pmf(n, i, p);
  if (!okP(v)) return null;
  return num(`$X$ is the number of successes in $${n}$ independent trials, each with probability $${p}$. Find $P(${a} \\le X \\le ${b})$, correct to 4 decimal places.`, P4(v), {
    tol: T4, traps: [{ value: P4(pmf(n, a, p) + pmf(n, b, p)), why: `Include every value from ${a} to ${b}, not just the endpoints.` }],
    hints: [`Add $P(X = r)$ for $r = ${a}, \\ldots, ${b}$.`, 'Each term is $\\binom{n}{r}p^r(1-p)^{n-r}$.', 'Add and round.'],
    steps: [{ h: 'Sum the terms', d: `$\\sum_{r=${a}}^{${b}}\\binom{${n}}{r}(${p})^r(${q2(p)})^{${n} - r}$` }, { h: 'Evaluate', d: `$\\approx ${P4(v)}$` }]
  });
});
const makeB4e = (rng) => go(() => {
  const n = ri(rng, 50, 2000), p = ri(rng, 5, 95) / 100;
  const sd = Math.sqrt(p * (1 - p) / n);
  if (!safe(sd, 4)) return null;
  return num(`In a large population a proportion $${p}$ support a new local park. Random samples of size $${n}$ are taken and the sample proportion $\\hat{p}$ is found each time. Find the standard deviation of $\\hat{p}$, correct to 4 decimal places.`, P4(sd), {
    tol: 0.000005, traps: [{ value: P4(Math.sqrt(p * (1 - p))), why: `Divide $p(1 - p)$ by the sample size $${n}$ before taking the square root.` }, { value: P4(p * (1 - p) / n), why: 'That is the variance of $\\hat{p}$; take the square root.' }],
    hints: ['The sample proportion has standard deviation $\\sqrt{\\dfrac{p(1 - p)}{n}}$.', `$p(1 - p) = ${P4(p * (1 - p))}$.`, `Divide by ${n}, then take the square root.`],
    steps: [{ h: 'Formula', d: `$\\sigma_{\\hat{p}} = \\sqrt{\\dfrac{${p}(${q2(p)})}{${n}}}$` }, { h: 'Evaluate', d: `$\\approx ${P4(sd)}$` }]
  });
});
const makeB4f = (rng) => go(() => {
  const n = ri(rng, 3, 12), p = ri(rng, 10, 60) / 100, q = q2(p);
  if (p === 0.5) return null;
  return mc(rng, `A trainee surfer stands up on a wave with probability $${p}$, independently, on each of $${n}$ waves. Which expression gives $P(\\text{at least one stand-up})$?`,
    `$1 - (${q})^{${n}}$`,
    [{ text: `$(${q})^{${n}}$`, why: 'That is the probability of **no** stand-ups.' }, { text: `$1 - (${p})^{${n}}$`, why: `The probability of no success each time is $${q}$, not $${p}$.` }, { text: `$${n}(${p})$`, why: 'That is the expected number of stand-ups, not a probability.' }],
    ['“At least one” is the complement of “none”.', `P(none) $= (${q})^{${n}}$.`, 'Subtract from 1.'],
    [{ h: 'Complement', d: `$1 - (${q})^{${n}}$` }]);
});

// ═════════════════════════════ PROJECTILE ════════════════════════════════════

const G = 'Take $g = 10$ m/s².';
const sn = th => Math.sin(rad(th)), cs = th => Math.cos(rad(th));
const vTh = (rng, ok = () => true) => { for (let i = 0; i < 400; i++) { const r = [ri(rng, 10, 60), ri(rng, 10, 80)]; if (ok(r[0], r[1])) return r; } throw new Error("vTh: no valid draw"); };

const makeP1a = (rng) => go(() => {
  const [v, th] = vTh(rng), y = v * sn(th);
  if (!safe(y, 1)) return null;
  return num(`A netball is thrown at $${v}$ m/s at $${th}°$ above the horizontal. ${G} Find the **vertical** component of its initial velocity, correct to 1 decimal place.`, rnd(y, 1), {
    tol: 0.005, suffix: 'm/s', traps: [{ value: rnd(v * cs(th), 1), why: 'Vertical uses sin; horizontal uses cos.' }, { value: rnd(v * Math.tan(rad(th)), 1), why: 'The component is $v\\sin\\theta$, not $v\\tan\\theta$.' }],
    hints: ['Resolve: $v_y = v\\sin\\theta$.', `$${v}\\sin(${th}°)$.`, 'Evaluate to 1 decimal place.'],
    steps: [{ h: 'Resolve vertically', d: `$v_y = ${v}\\sin(${th}°) \\approx ${rnd(y, 1)}$ m/s` }]
  });
});
const makeP1b = (rng) => {
  const [x, y, m] = rc(rng, [[3, 4, 5], [5, 12, 13], [8, 15, 17], [7, 24, 25], [20, 21, 29]]);
  const s = ri(rng, 1, 3), vx = (rng() < 0.5 ? x : y) * s, vy = (vx === x * s ? y : x) * s;
  if (!Number.isInteger(hyp(vx, vy))) throw new Error('projectile P1b');
  return num(`A cricket ball leaves the bat with horizontal velocity component $${vx}$ m/s and vertical component $${vy}$ m/s. Find its launch speed.`, hyp(vx, vy), {
    suffix: 'm/s', traps: [{ value: vx + vy, why: 'Speed combines the components with Pythagoras, not addition.' }],
    hints: ['The two components are at right angles.', '$v = \\sqrt{v_x^2 + v_y^2}$.', `$\\sqrt{${vx * vx} + ${vy * vy}}$.`],
    steps: [{ h: 'Pythagoras', d: `$v = \\sqrt{${vx}^2 + ${vy}^2} = \\sqrt{${vx * vx + vy * vy}} = ${hyp(vx, vy)}$ m/s` }]
  });
};
const makeP1c = (rng) => go(() => {
  const vx = ri(rng, 4, 40), vy = ri(rng, 4, 40), a = deg(Math.atan2(vy, vx));
  if (!safe(a, 0)) return null;
  return num(`A rugby ball leaves the boot with horizontal component $${vx}$ m/s and vertical component $${vy}$ m/s. Find its launch angle above the horizontal, to the nearest degree.`, Math.round(a), {
    tol: 0.005, suffix: '°', traps: [{ value: Math.round(deg(Math.atan2(vx, vy))), why: '$\\tan\\theta = \\dfrac{v_y}{v_x}$ — opposite over adjacent.' }],
    hints: ['$\\tan\\theta = \\dfrac{\\text{vertical}}{\\text{horizontal}}$.', `$\\tan\\theta = \\dfrac{${vy}}{${vx}}$.`, 'Apply $\\tan^{-1}$.'],
    steps: [{ h: 'Ratio', d: `$\\tan\\theta = \\dfrac{${vy}}{${vx}}$` }, { h: 'Angle', d: `$\\theta = \\tan^{-1}\\left(\\dfrac{${vy}}{${vx}}\\right) \\approx ${Math.round(a)}°$` }]
  });
});
const makeP1d = (rng) => go(() => {
  const [v, th] = vTh(rng), t = ri(rng, 2, 8), x = v * cs(th) * t;
  if (!safe(x, 1)) return null;
  return num(`A ball is kicked at $${v}$ m/s at $${th}°$ above the horizontal. ${G} Ignoring air resistance, how far has it travelled horizontally after $${t}$ ${pl(t, "second")}? Give your answer correct to 1 decimal place.`, rnd(x, 1), {
    tol: 0.005, suffix: 'm', traps: [{ value: rnd(v * sn(th) * t, 1), why: 'Horizontal motion uses the cosine component.' }, { value: rnd(v * t, 1), why: 'Only the horizontal component carries the ball sideways.' }],
    hints: ['The horizontal velocity stays constant.', `$v_x = ${v}\\cos(${th}°)$.`, `$x = v_x \\times ${t}$.`],
    steps: [{ h: 'Horizontal velocity', d: `$v_x = ${v}\\cos(${th}°) \\approx ${rnd(v * cs(th), 2)}$ m/s` }, { h: 'Distance', d: `$x = v_x t \\approx ${rnd(x, 1)}$ m` }]
  });
});
const makeP1e = (rng) => {
  const [v, th] = vTh(rng, (v, th) => th !== 45);
  return mc(rng, `A ball is kicked at $${v}$ m/s at $${th}°$ above the horizontal. Which pair gives the (horizontal, vertical) components of its initial velocity?`,
    `$\\left(${v}\\cos ${th}°,\\ ${v}\\sin ${th}°\\right)$`,
    [{ text: `$\\left(${v}\\sin ${th}°,\\ ${v}\\cos ${th}°\\right)$`, why: 'The components are swapped: horizontal uses cos, vertical uses sin.' },
      { text: `$\\left(${v}\\cos ${th}°,\\ ${v}\\tan ${th}°\\right)$`, why: 'The vertical component is $v\\sin\\theta$.' },
      { text: `$\\left(${v}\\cos ${th}°,\\ ${v}\\cos ${th}°\\right)$`, why: 'The two components use different ratios.' }],
    ['The angle is measured from the horizontal.', 'Adjacent side $\\to$ cosine; opposite side $\\to$ sine.', 'Horizontal is adjacent, vertical is opposite.'],
    [{ h: 'Components', d: `$v_x = ${v}\\cos ${th}°$, $v_y = ${v}\\sin ${th}°$` }]);
};
const makeP1f = (rng) => {
  const v = ri(rng, 10, 80);
  if (rng() < 0.5) {
    return num(`A ball is launched at $60°$ above the horizontal. Its horizontal velocity component is $${v / 2}$ m/s. Find the launch speed.`, v, {
      suffix: 'm/s', traps: [{ value: v / 4, why: '$v_x = v\\cos 60° = \\dfrac{v}{2}$, so divide by $\\tfrac{1}{2}$, not multiply.' }],
      hints: ['$v_x = v\\cos\\theta$.', '$\\cos 60° = \\dfrac{1}{2}$.', `$v = ${v / 2} \\div \\dfrac{1}{2}$.`],
      steps: [{ h: 'Relate', d: `$${v / 2} = v\\cos 60° = \\dfrac{v}{2}$` }, { h: 'Solve', d: `$v = ${v}$ m/s` }]
    });
  }
  return num(`A ball is launched at $30°$ above the horizontal. Its initial vertical velocity component is $${v / 2}$ m/s. Find the launch speed.`, v, {
    suffix: 'm/s', traps: [{ value: v / 4, why: '$v_y = v\\sin 30° = \\dfrac{v}{2}$, so $v$ is double the component.' }],
    hints: ['$v_y = v\\sin\\theta$.', '$\\sin 30° = \\dfrac{1}{2}$.', `$v = ${v / 2} \\div \\dfrac{1}{2}$.`],
    steps: [{ h: 'Relate', d: `$${v / 2} = v\\sin 30° = \\dfrac{v}{2}$` }, { h: 'Solve', d: `$v = ${v}$ m/s` }]
  });
};

const makeP2a = (rng) => go(() => {
  const [v, th] = vTh(rng), t = v * sn(th) / 10;
  if (!safe(t, 2)) return null;
  return num(`A water-polo ball is thrown from the surface of a pool at $${v}$ m/s at $${th}°$ above the horizontal. ${G} Find the time taken to reach its greatest height, correct to 2 decimal places.`, rnd(t, 2), {
    tol: 0.0005, suffix: 's', traps: [{ value: rnd(2 * t, 2), why: 'That is the whole time of flight; the top is reached at half of it.' }],
    hints: ['At the top the vertical velocity is zero.', '$0 = v\\sin\\theta - gt$.', `$t = \\dfrac{${v}\\sin(${th}°)}{10}$.`],
    steps: [{ h: 'Vertical velocity zero', d: `$0 = ${v}\\sin(${th}°) - 10t$` }, { h: 'Solve', d: `$t \\approx ${rnd(t, 2)}$ s` }]
  });
});
const makeP2b = (rng) => go(() => {
  const [v, th] = vTh(rng), t = ri(rng, 1, 6), y = v * sn(th) - 10 * t;
  if (Math.abs(y) < 0.5 || !safe(y, 1)) return null;
  return num(`A projectile is launched at $${v}$ m/s at $${th}°$ above the horizontal. ${G} Find its vertical velocity component after $${t}$ ${pl(t, "second")}, correct to 1 decimal place. Take upwards as positive.`, rnd(y, 1), {
    tol: 0.005, suffix: 'm/s', traps: [{ value: rnd(-y, 1), why: 'Take upwards as positive: a downward velocity is negative.' }, { value: rnd(v * sn(th) + 10 * t, 1), why: 'Gravity reduces the upward velocity: $v_y = v\\sin\\theta - gt$.' }],
    hints: ['Constant acceleration $-10$ m/s² vertically.', '$v_y = v\\sin\\theta - gt$.', `$${v}\\sin(${th}°) - 10(${t})$.`],
    steps: [{ h: 'Initial vertical', d: `$${v}\\sin(${th}°) \\approx ${rnd(v * sn(th), 2)}$` }, { h: 'After ' + t + ' s', d: `$v_y \\approx ${rnd(y, 1)}$ m/s` }]
  });
});
const makeP2c = (rng) => {
  const vx = ri(rng, 5, 40), vy = ri(rng, 5, 60), T = vy / 5;
  return num(`A ball leaves level ground with horizontal velocity component $${vx}$ m/s and vertical component $${vy}$ m/s. ${G} Find the time of flight in seconds.`, T, {
    suffix: 's', traps: [{ value: vy / 10, why: 'That is the time to the top; double it for the full flight.' }, { value: rnd(2 * vx / 10, 4), why: 'Time of flight depends on the vertical component, not the horizontal one.' }],
    hints: ['Only the vertical motion decides how long it stays up.', '$T = \\dfrac{2v_y}{g}$.', `$\\dfrac{2 \\times ${vy}}{10}$.`],
    steps: [{ h: 'Time of flight', d: `$T = \\dfrac{2(${vy})}{10} = ${T}$ s` }]
  });
};
const makeP2d = (rng) => {
  const v = ri(rng, 12, 80), T = v / 10;
  return num(`A ball is fired from level ground at $30°$ above the horizontal and is in the air for exactly $${T}$ seconds. ${G} Find its launch speed.`, v, {
    suffix: 'm/s', traps: [{ value: v / 2, why: '$T = \\dfrac{2v\\sin 30°}{g} = \\dfrac{v}{10}$, so $v = 10T$.' }],
    hints: ['$T = \\dfrac{2v\\sin\\theta}{g}$.', '$\\sin 30° = \\dfrac{1}{2}$, so $T = \\dfrac{v}{10}$.', `$v = 10 \\times ${T}$.`],
    steps: [{ h: 'Time of flight formula', d: `$${T} = \\dfrac{2v\\sin 30°}{10} = \\dfrac{v}{10}$` }, { h: 'Solve', d: `$v = ${v}$ m/s` }]
  });
};
const makeP2e = (rng) => go(() => {
  const [v1, t1] = vTh(rng), [v2, t2] = vTh(rng);
  const T1 = 2 * v1 * sn(t1) / 10, T2 = 2 * v2 * sn(t2) / 10, d = Math.abs(T1 - T2);
  if (d < 0.3 || !safe(d, 2)) return null;
  const hiA = T1 > T2;
  return num(`Two balls are kicked from level ground. Ball A is kicked at $${hiA ? v1 : v2}$ m/s at $${hiA ? t1 : t2}°$; ball B at $${hiA ? v2 : v1}$ m/s at $${hiA ? t2 : t1}°$ (both above the horizontal). ${G} How much longer than ball B is ball A in the air? Give your answer in seconds, correct to 2 decimal places.`, rnd(d, 2), {
    tol: 0.0005, suffix: 's', traps: [{ value: rnd(T1 + T2, 2), why: 'Subtract the two flight times to compare them.' }],
    hints: ['Use $T = \\dfrac{2v\\sin\\theta}{g}$ for each ball.', 'Compute both times separately.', 'Subtract the smaller from the larger.'],
    steps: [{ h: 'Ball A', d: `$T_A = \\dfrac{2(${hiA ? v1 : v2})\\sin(${hiA ? t1 : t2}°)}{10} \\approx ${rnd(Math.max(T1, T2), 3)}$ s` }, { h: 'Ball B', d: `$T_B \\approx ${rnd(Math.min(T1, T2), 3)}$ s` }, { h: 'Difference', d: `$\\approx ${rnd(d, 2)}$ s` }]
  });
});
const makeP2f = (rng) => {
  const [v, th] = vTh(rng, (v, th) => distinct([2 * sn(th), sn(th), 2 * cs(th), sn(2 * th)]));
  return mc(rng, `A ball is kicked from level ground at $${v}$ m/s at $${th}°$ above the horizontal. ${G} Which calculation gives its time of flight in seconds?`,
    `$\\dfrac{2 \\times ${v}\\sin ${th}°}{10}$`,
    [{ text: `$\\dfrac{${v}\\sin ${th}°}{10}$`, why: 'That is the time to the top of the flight only.' },
      { text: `$\\dfrac{2 \\times ${v}\\cos ${th}°}{10}$`, why: 'Flight time depends on the vertical component, $v\\sin\\theta$.' },
      { text: `$\\dfrac{${v}\\sin ${2 * th}°}{10}$`, why: 'The $\\sin 2\\theta$ belongs to the range formula, not to time of flight.' }],
    ['The ball returns to its starting height when vertical displacement is zero.', 'Time up equals time down.', '$T = \\dfrac{2v\\sin\\theta}{g}$.'],
    [{ h: 'Time of flight', d: `$T = \\dfrac{2v\\sin\\theta}{g}$` }]);
};

const makeP3a = (rng) => {
  const v = ri(rng, 10, 60), th = rc(rng, [15, 45, 75]);
  const R = rnd(v * v * sn(2 * th) / 10, 4);
  const back = Math.round(Math.sqrt(R * 10 / sn(2 * th)));
  if (back !== v) throw new Error('projectile P3a');
  return num(`A javelin is thrown from level ground at $${th}°$ above the horizontal and lands $${R}$ m away. ${G} Find its launch speed in m/s.`, v, {
    suffix: 'm/s', traps: [{ value: rnd(Math.sqrt(R * 10), 2), why: 'Include $\\sin 2\\theta$: $R = \\dfrac{v^2\\sin 2\\theta}{g}$.' }],
    hints: ['$R = \\dfrac{v^2\\sin 2\\theta}{g}$.', `$\\sin ${2 * th}° = ${rnd(sn(2 * th), 3)}$.`, `$v^2 = \\dfrac{${R} \\times 10}{${rnd(sn(2 * th), 3)}}$.`],
    steps: [{ h: 'Rearrange', d: `$v^2 = \\dfrac{10R}{\\sin ${2 * th}°} = \\dfrac{${rnd(R * 10, 4)}}{${rnd(sn(2 * th), 3)}} = ${v * v}$` }, { h: 'Square root', d: `$v = ${v}$ m/s` }]
  });
};
const makeP3b = (rng) => {
  const vx = ri(rng, 5, 40), vy = ri(rng, 5, 40), R = vx * vy / 5;
  return num(`A ball is kicked from level ground with horizontal component $${vx}$ m/s and vertical component $${vy}$ m/s. ${G} Find the range in metres.`, rnd(R, 4), {
    tol: 0.001, suffix: 'm', traps: [{ value: rnd(vx * vy / 10, 4), why: 'The flight time is $\\dfrac{2v_y}{g}$ — twice the time to the top.' }, { value: rnd(vx * vy, 4), why: 'Multiply the horizontal velocity by the time of flight, $\\dfrac{2v_y}{10}$.' }],
    hints: ['Time of flight $T = \\dfrac{2v_y}{g}$.', `$T = \\dfrac{2(${vy})}{10} = ${vy / 5}$ s.`, 'Range $= v_x \\times T$.'],
    steps: [{ h: 'Time of flight', d: `$T = ${vy / 5}$ s` }, { h: 'Range', d: `$R = ${vx} \\times ${vy / 5} = ${rnd(R, 4)}$ m` }]
  });
};
const makeP3c = (rng) => go(() => {
  const [v, th] = vTh(rng);
  if (th === 45) return null;
  const R = v * v * sn(2 * th) / 10;
  if (!safe(R, 1)) return null;
  return num(`A projectile launched from level ground at $${v}$ m/s and $${th}°$ above the horizontal has a range of $${rnd(R, 1)}$ m. ${G} At what other launch angle, with the same speed, would the range be the same? Give the angle in degrees above the horizontal.`, 90 - th, {
    suffix: '°', traps: [{ value: 180 - th, why: 'Range is symmetric about $45°$: the pair of angles add to $90°$.' }],
    hints: ['$R = \\dfrac{v^2\\sin 2\\theta}{g}$, and $\\sin 2\\theta = \\sin(180° - 2\\theta)$.', 'So $2\\theta$ and $180° - 2\\theta$ give the same range.', 'Halve to find the other launch angle.'],
    steps: [{ h: 'Same sine', d: `$\\sin ${2 * th}° = \\sin ${180 - 2 * th}°$` }, { h: 'Other angle', d: `$\\theta = ${90 - th}°$` }]
  });
});
const makeP3d = (rng) => {
  const v = ri(rng, 8, 80);
  return num(`A shot-putter can launch the shot at $${v}$ m/s at any angle. ${G} Ignoring the height of release, what is the greatest possible range on level ground, in metres?`, rnd(v * v / 10, 4), {
    tol: 0.001, suffix: 'm', traps: [{ value: rnd(v * v / 20, 4), why: 'The range is greatest when $\\sin 2\\theta = 1$, giving $\\dfrac{v^2}{g}$.' }],
    hints: ['$R = \\dfrac{v^2\\sin 2\\theta}{g}$.', 'The sine is largest when $2\\theta = 90°$.', '$R_{\\max} = \\dfrac{v^2}{g}$.'],
    steps: [{ h: 'Maximise', d: `$\\sin 2\\theta = 1$ when $\\theta = 45°$` }, { h: 'Range', d: `$R_{\\max} = \\dfrac{${v}^2}{10} = ${rnd(v * v / 10, 4)}$ m` }]
  });
};
const makeP3e = (rng) => go(() => {
  const [v, th] = vTh(rng), R = v * v * sn(2 * th) / 10;
  if (R < 10) return null;
  const x = ri(rng, Math.ceil(R * 0.2), Math.floor(R * 0.8)), y = x * Math.tan(rad(th)) - 5 * x * x / (v * v * cs(th) ** 2);
  if (y < 0.5 || !safe(y, 2)) return null;
  return num(`A ball is struck from level ground at $${v}$ m/s at $${th}°$ above the horizontal, and its path is $y = x\\tan\\theta - \\dfrac{gx^2}{2v^2\\cos^2\\theta}$. ${G} Find its height above the ground when it has travelled $${x}$ m horizontally, correct to 2 decimal places.`, rnd(y, 2), {
    tol: 0.0005, suffix: 'm', traps: [{ value: rnd(x * Math.tan(rad(th)), 2), why: 'Subtract the gravity term $\\dfrac{gx^2}{2v^2\\cos^2\\theta}$.' }],
    hints: [`Substitute $x = ${x}$, $v = ${v}$, $\\theta = ${th}°$.`, `$x\\tan\\theta \\approx ${rnd(x * Math.tan(rad(th)), 3)}$.`, `$\\dfrac{10x^2}{2v^2\\cos^2\\theta} \\approx ${rnd(5 * x * x / (v * v * cs(th) ** 2), 3)}$.`],
    steps: [{ h: 'First term', d: `$${x}\\tan ${th}° \\approx ${rnd(x * Math.tan(rad(th)), 3)}$` }, { h: 'Second term', d: `$\\dfrac{5(${x})^2}{${v}^2\\cos^2 ${th}°} \\approx ${rnd(5 * x * x / (v * v * cs(th) ** 2), 3)}$` }, { h: 'Height', d: `$y \\approx ${rnd(y, 2)}$ m` }]
  });
});
const makeP3f = (rng) => {
  const [v, th] = vTh(rng, (v, th) => distinct([v * v * sn(2 * th), v * v * sn(th), v * sn(2 * th), 2 * v * sn(th)]));
  return mc(rng, `A ball is kicked from level ground at $${v}$ m/s at $${th}°$ above the horizontal. ${G} Which calculation gives the range in metres?`,
    `$\\dfrac{${v}^2\\sin ${2 * th}°}{10}$`,
    [{ text: `$\\dfrac{${v}^2\\sin ${th}°}{10}$`, why: 'The range formula uses $\\sin 2\\theta$.' },
      { text: `$\\dfrac{${v}\\sin ${2 * th}°}{10}$`, why: 'The speed must be squared: $v^2$.' },
      { text: `$\\dfrac{2 \\times ${v}\\sin ${th}°}{10}$`, why: 'That is the time of flight in seconds, not the range.' }],
    ['Range $=$ horizontal velocity $\\times$ time of flight.', '$R = v\\cos\\theta \\times \\dfrac{2v\\sin\\theta}{g}$.', 'Use $2\\sin\\theta\\cos\\theta = \\sin 2\\theta$.'],
    [{ h: 'Range formula', d: `$R = \\dfrac{v^2\\sin 2\\theta}{g}$` }]);
};

const makeP4a = (rng) => {
  const vy = ri(rng, 5, 60), H = rnd(vy * vy / 20, 4);
  if (rng() < 0.5) {
    if (Math.round(Math.sqrt(2 * 10 * H)) !== vy) throw new Error('projectile P4a');
    return num(`A ball is thrown upwards and outwards and reaches a greatest height of $${H}$ m above its launch point. ${G} Find the vertical component of its initial velocity in m/s.`, vy, {
      suffix: 'm/s', traps: [{ value: rnd(Math.sqrt(H * 10), 2), why: 'Use $v_y^2 = 2gH$, so $v_y = \\sqrt{20H}$.' }],
      hints: ['At the top the vertical velocity is zero.', '$0 = v_y^2 - 2gH$.', `$v_y = \\sqrt{20 \\times ${H}}$.`],
      steps: [{ h: 'Rearrange', d: `$v_y^2 = 20H = ${rnd(20 * H, 4)}$` }, { h: 'Square root', d: `$v_y = ${vy}$ m/s` }]
    });
  }
  return num(`A ball is launched at $30°$ above the horizontal and reaches a greatest height of $${H}$ m above its launch point. ${G} Find the launch speed in m/s.`, 2 * vy, {
    suffix: 'm/s', traps: [{ value: vy, why: 'That is only the vertical component; $v = \\dfrac{v_y}{\\sin 30°}$.' }],
    hints: ['Find the vertical component first from $v_y^2 = 2gH$.', `$v_y = \\sqrt{20 \\times ${H}} = ${vy}$.`, '$v = \\dfrac{v_y}{\\sin 30°}$.'],
    steps: [{ h: 'Vertical component', d: `$v_y = \\sqrt{20(${H})} = ${vy}$ m/s` }, { h: 'Launch speed', d: `$v = \\dfrac{${vy}}{0.5} = ${2 * vy}$ m/s` }]
  });
};
const makeP4b = (rng) => go(() => {
  const [v, th] = vTh(rng), T = 2 * v * sn(th) / 10, t = ri(rng, 1, Math.max(1, Math.floor(T) - 1));
  if (t >= T) return null;
  const y = v * sn(th) * t - 5 * t * t;
  if (y < 1 || !safe(y, 1)) return null;
  return num(`A ball is thrown from level ground at $${v}$ m/s at $${th}°$ above the horizontal. ${G} How high above the ground is it after $${t}$ ${pl(t, "second")}? Give your answer correct to 1 decimal place.`, rnd(y, 1), {
    tol: 0.005, suffix: 'm', traps: [{ value: rnd(v * sn(th) * t, 1), why: 'Gravity pulls it down: subtract $\\dfrac{1}{2}gt^2 = 5t^2$.' }],
    hints: ['Vertical displacement: $y = v\\sin\\theta\\,t - \\dfrac{1}{2}gt^2$.', `$y = ${v}\\sin(${th}°)(${t}) - 5(${t})^2$.`, 'Evaluate.'],
    steps: [{ h: 'Vertical displacement', d: `$y = ${v}\\sin(${th}°)(${t}) - 5(${t * t})$` }, { h: 'Evaluate', d: `$\\approx ${rnd(y, 1)}$ m` }]
  });
});
const makeP4c = (rng) => go(() => {
  const [v, th] = vTh(rng), h0 = ri(rng, 1, 40), H = h0 + (v * sn(th)) ** 2 / 20;
  if (!safe(H, 1)) return null;
  return num(`A cricketer standing on a balcony throws a ball from $${h0}$ m above the ground at $${v}$ m/s at $${th}°$ above the horizontal. ${G} Find the greatest height of the ball above the ground, correct to 1 decimal place.`, rnd(H, 1), {
    tol: 0.005, suffix: 'm', traps: [{ value: rnd((v * sn(th)) ** 2 / 20, 1), why: `The rise is measured from the launch point; add the ${h0} m of the balcony.` }],
    hints: ['Find the rise above the launch point first.', `Rise $= \\dfrac{(v\\sin\\theta)^2}{2g}$.`, `Add the launch height of ${h0} m.`],
    steps: [{ h: 'Rise', d: `$\\dfrac{(${v}\\sin ${th}°)^2}{20} \\approx ${rnd((v * sn(th)) ** 2 / 20, 2)}$ m` }, { h: 'Above ground', d: `$${h0} + ${rnd((v * sn(th)) ** 2 / 20, 2)} \\approx ${rnd(H, 1)}$ m` }]
  });
});
const makeP4d = (rng) => go(() => {
  const p = ri(rng, 5, 30) / 10, ps = p.toFixed(1), q = ri(rng, 5, 50) / 1000, H = p * p / (4 * q);
  if (H < 1 || H > 200 || !safe(H, 1)) return null;
  return num(`The path of a thrown ball is $y = ${ps}x - ${q}x^2$, where $x$ is the horizontal distance and $y$ the height, both in metres. Find the greatest height reached, correct to 1 decimal place.`, rnd(H, 1), {
    tol: 0.005, suffix: 'm', traps: [{ value: rnd(p / (2 * q), 1), why: 'That is the $x$-value of the vertex, not the height.' }],
    hints: ['The path is a downward parabola.', `The vertex is at $x = \\dfrac{${p}}{2(${q})}$.`, 'Substitute that $x$ back to find $y$.'],
    steps: [{ h: 'Vertex x', d: `$x = \\dfrac{${p}}{${rnd(2 * q, 3)}} \\approx ${rnd(p / (2 * q), 2)}$` }, { h: 'Greatest height', d: `$y = \\dfrac{${p}^2}{4(${q})} \\approx ${rnd(H, 1)}$ m` }]
  });
});
const makeP4e = (rng) => go(() => {
  const [v, th] = vTh(rng), x = v * cs(th);
  if (!safe(x, 1)) return null;
  return num(`A ball is kicked at $${v}$ m/s at $${th}°$ above the horizontal. ${G} Ignoring air resistance, what is its speed at the highest point of its flight? Give your answer correct to 1 decimal place.`, rnd(x, 1), {
    tol: 0.005, suffix: 'm/s', traps: [{ value: 0, why: 'At the top only the *vertical* velocity is zero; the horizontal motion continues.' }, { value: rnd(v * sn(th), 1), why: 'The speed at the top equals the constant horizontal component, $v\\cos\\theta$.' }],
    hints: ['At the top the vertical velocity is zero.', 'The horizontal velocity never changes.', `Speed $= ${v}\\cos(${th}°)$.`],
    steps: [{ h: 'At the top', d: `$v_y = 0$` }, { h: 'Speed', d: `Speed $= v_x = ${v}\\cos(${th}°) \\approx ${rnd(x, 1)}$ m/s` }]
  });
});
const makeP4f = (rng) => go(() => {
  const [v, th] = vTh(rng), x = rnd(v * cs(th), 1), y = rnd(v * sn(th), 1);
  if (new Set([x, y, v]).size < 3) return null;
  return mc(rng, `A ball is kicked at $${v}$ m/s at $${th}°$ above the horizontal. ${G} Which statement is correct at the highest point of its flight?`,
    `The vertical velocity is $0$ and the speed is about $${x}$ m/s`,
    [{ text: 'The speed is $0$ m/s', why: 'Only the vertical component is zero at the top; the horizontal component is unchanged.' },
      { text: `The vertical velocity is $0$ and the speed is about $${y}$ m/s`, why: 'The speed at the top is the horizontal component, $v\\cos\\theta$.' },
      { text: `The speed is still $${v}$ m/s`, why: 'Speed falls as the ball climbs, then rises again as it descends.' }],
    ['Gravity acts only vertically.', 'So the horizontal velocity stays constant.', 'At the top the vertical velocity is zero.'],
    [{ h: 'At the top', d: `$v_y = 0$, speed $= v\\cos\\theta = ${v}\\cos ${th}° \\approx ${x}$ m/s` }]);
});

// ═════════════════════════════ VECTORS ═══════════════════════════════════════

const makeV1a = (rng) => go(() => {
  const [bx, by, m] = trip(rng), x = bx * rc(rng, [1, -1]), y = by * rc(rng, [1, -1]), u = x / m;
  if (!safe(u, 2)) return null;
  return num(`Find the $x$-component of the unit vector in the direction of $${A} = ${col(x, y)}$, correct to 2 decimal places.`, rnd(u, 2), {
    tol: 0.0005, traps: [{ value: x, why: 'Divide by the magnitude to make the vector length 1.' }, { value: rnd(y / m, 2), why: 'The $x$-component divides $x$, not $y$, by the magnitude.' }],
    hints: ['A unit vector is $\\dfrac{\\underset{\\sim}{a}}{|\\underset{\\sim}{a}|}$.', `$|\\underset{\\sim}{a}| = \\sqrt{${x * x} + ${y * y}} = ${m}$.`, `$x$-component $= \\dfrac{${x}}{${m}}$.`],
    steps: [{ h: 'Magnitude', d: `$|\\underset{\\sim}{a}| = \\sqrt{${x * x + y * y}} = ${m}$` }, { h: 'Unit vector', d: `$\\hat{a} = ${col(`\\frac{${x}}{${m}}`, `\\frac{${y}}{${m}}`)}$; $x$-component $\\approx ${rnd(u, 2)}$` }]
  });
});
const makeV1b = (rng) => go(() => {
  const x = nz(rng, -12, 12), y = nz(rng, -12, 12);
  let a = deg(Math.atan2(y, x)); if (a < 0) a += 360;
  if (!safe(a, 0)) return null;
  const ref = Math.round(deg(Math.atan(Math.abs(y / x))));
  return num(`The vector $${A} = ${col(x, y)}$ is drawn from the origin. Find the angle it makes with the positive $x$-axis, to the nearest degree, turning anticlockwise from the axis. Give $\\theta$ in the range $0° \\le \\theta < 360°$.`, Math.round(a), {
    tol: 0.005, suffix: '°', traps: [{ value: ref, why: `That is the acute reference angle. The vector lies in a quadrant that needs $${x < 0 ? (y > 0 ? '180° - ' : '180° + ') : '360° - '}$ the reference.` }],
    hints: ['Sketch the vector to see which quadrant it is in.', `Reference angle $= \\tan^{-1}\\left|\\dfrac{${y}}{${x}}\\right|$.`, 'Adjust for the quadrant.'],
    steps: [{ h: 'Reference angle', d: `$\\tan^{-1}\\left(\\dfrac{${Math.abs(y)}}{${Math.abs(x)}}\\right) \\approx ${ref}°$` }, { h: 'Quadrant', d: `$\\theta \\approx ${Math.round(a)}°$` }]
  });
});
const makeV1c = (rng) => go(() => {
  const a = [nz(rng, -6, 6), nz(rng, -6, 6)], b = [nz(rng, -6, 6), nz(rng, -6, 6)], p = nz(rng, -4, 4), q = nz(rng, -4, 4);
  const cx = p * a[0] + q * b[0], cy = p * a[1] + q * b[1], m = hyp(cx, cy);
  if (m < 1 || !safe(m, 2)) return null;
  return num(`Given $${A} = ${col(a[0], a[1])}$ and $${B} = ${col(b[0], b[1])}$, find $\\left|${sc(p, A)} ${q < 0 ? "-" : "+"} ${Math.abs(q) === 1 ? "" : Math.abs(q)}${B}\\right|$, correct to 2 decimal places.`, rnd(m, 2), {
    tol: 0.0005, traps: [{ value: rnd(Math.abs(p) * hyp(...a) + Math.abs(q) * hyp(...b), 2), why: 'The magnitude of a sum is not the sum of the magnitudes — combine the components first.' }],
    hints: ['Find the combined vector component by component.', `$x$: $${p}(${a[0]}) + (${q})(${b[0]}) = ${cx}$.`, `Then $\\sqrt{x^2 + y^2}$.`],
    steps: [{ h: 'Combine', d: `$${col(cx, cy)}$` }, { h: 'Magnitude', d: `$\\sqrt{${cx * cx} + ${cy * cy}} \\approx ${rnd(m, 2)}$` }]
  });
});
const makeV1d = (rng) => {
  const [x, y, m] = trip(rng), s = rc(rng, [1, -1]);
  return num(`The vector $\\begin{pmatrix} k \\\\ ${s * y} \\end{pmatrix}$ has magnitude $${m}$ and $k > 0$. Find $k$.`, x, {
    traps: [{ value: m - y, why: 'Use $k^2 + y^2 = |\\underset{\\sim}{v}|^2$, not subtraction of the lengths.' }, { value: -x, why: 'The question states $k > 0$.' }],
    hints: ['$\\sqrt{k^2 + y^2} = m$.', `$k^2 + ${y * y} = ${m * m}$.`, 'Take the positive root.'],
    steps: [{ h: 'Set up', d: `$k^2 + (${s * y})^2 = ${m}^2$` }, { h: 'Solve', d: `$k^2 = ${m * m - y * y}$, so $k = ${x}$` }]
  });
};
const makeV1e = (rng) => go(() => {
  const P = [ri(rng, -6, 6), ri(rng, -6, 6)], Q = [ri(rng, -6, 6), ri(rng, -6, 6)], R = [ri(rng, -6, 6), ri(rng, -6, 6)];
  const cross = (Q[0] - P[0]) * (R[1] - Q[1]) - (Q[1] - P[1]) * (R[0] - Q[0]);
  if (cross === 0) return null;
  const S = [P[0] + R[0] - Q[0], P[1] + R[1] - Q[1]], ix = rng() < 0.5, k = ix ? 0 : 1;
  if (S[k] === 0) return null;
  return num(`$PQRS$ is a parallelogram with vertices in that order, where $P(${P[0]}, ${P[1]})$, $Q(${Q[0]}, ${Q[1]})$ and $R(${R[0]}, ${R[1]})$. Find the ${ix ? '$x$' : '$y$'}-coordinate of $S$.`, S[k], {
    traps: [{ value: Q[k] + R[k] - P[k], why: 'In $PQRS$, $\\overrightarrow{PS} = \\overrightarrow{QR}$, so $S = P + (R - Q)$.' }],
    hints: ['Opposite sides of a parallelogram are equal vectors: $\\overrightarrow{PS} = \\overrightarrow{QR}$.', `$\\overrightarrow{QR} = ${col(R[0] - Q[0], R[1] - Q[1])}$.`, 'Add this to $P$.'],
    steps: [{ h: 'Equal vectors', d: `$\\overrightarrow{QR} = ${col(R[0] - Q[0], R[1] - Q[1])}$` }, { h: 'Find S', d: `$S = P + \\overrightarrow{QR} = (${S[0]}, ${S[1]})$` }]
  });
});
const makeV1f = (rng) => go(() => {
  const x = nz(rng, -9, 9), y = nz(rng, -9, 9), k = rc(rng, [2, 3, -2, -3, 4]);
  const par = (u, v) => u * y - v * x === 0;
  const cands = [[y, x], [-y, x], [x, -y], [x + 2, y + 2], [x + 1, y]].filter(c => !par(c[0], c[1]) && !(c[0] === 0 && c[1] === 0));
  if (cands.length < 3) return null;
  const tex = c => `$${col(c[0], c[1])}$`;
  const opts = new Set([tex([k * x, k * y]), ...cands.map(tex)]);
  if (opts.size < 4) return null;
  return mc(rng, `Which of these vectors is parallel to $${A} = ${col(x, y)}$?`, tex([k * x, k * y]),
    cands.slice(0, 3).map(c => ({ text: tex(c), why: c[0] === y && c[1] === x ? 'Swapping the components does not give a parallel vector.' : c[0] === -y ? 'That is perpendicular to $\\underset{\\sim}{a}$, not parallel.' : 'Parallel vectors are scalar multiples: both components scale by the same factor.' })),
    ['Parallel vectors are scalar multiples of each other.', 'Both components must be multiplied by the same number.', `Try multiplying $\\underset{\\sim}{a}$ by ${k}.`],
    [{ h: 'Scalar multiple', d: `$${k}\\underset{\\sim}{a} = ${col(k * x, k * y)}$` }]);
});
const makeV1g = (rng) => {
  const [x, y, m] = rc(rng, [[3, 4, 5], [5, 12, 13], [8, 15, 17], [7, 24, 25], [6, 8, 10], [9, 12, 15], [12, 16, 20]]);
  const s = ri(rng, 1, 3), ew = rc(rng, ['east', 'west']), ns = rc(rng, ['north', 'south']);
  return num(`A hiker in the Blue Mountains walks $${x * s}$ km ${ew} and then $${y * s}$ km ${ns}. Find her straight-line distance from the start, in kilometres.`, m * s, {
    suffix: 'km', traps: [{ value: (x + y) * s, why: 'The straight-line distance is the vector magnitude, not the length of the walk.' }],
    hints: ['The two legs are at right angles.', 'Distance $= \\sqrt{x^2 + y^2}$.', `$\\sqrt{${(x * s) ** 2} + ${(y * s) ** 2}}$.`],
    steps: [{ h: 'Displacement vector', d: `$${col(`${x * s}`, `${y * s}`)}$ (up to direction)` }, { h: 'Magnitude', d: `$\\sqrt{${(x * s) ** 2} + ${(y * s) ** 2}} = ${m * s}$ km` }]
  });
};

const makeV2a = (rng) => go(() => {
  const F = [nz(rng, -8, 12), nz(rng, -8, 12)], d = [ri(rng, 2, 15), ri(rng, 2, 15)], W = F[0] * d[0] + F[1] * d[1];
  if (W === 0) return null;
  return num(`A constant force $\\underset{\\sim}{F} = ${col(F[0], F[1])}$ N moves a trolley through the displacement $\\underset{\\sim}{d} = ${col(d[0], d[1])}$ m. The work done is $\\underset{\\sim}{F}\\cdot\\underset{\\sim}{d}$. Find the work done in joules.`, W, {
    suffix: 'J', traps: [{ value: F[0] * d[1] + F[1] * d[0], why: 'Multiply matching components: $F_xd_x + F_yd_y$.' }],
    hints: ['Work done is the dot product of force and displacement.', '$F_xd_x + F_yd_y$.', `$(${F[0]})(${d[0]}) + (${F[1]})(${d[1]})$.`],
    steps: [{ h: 'Dot product', d: `$(${F[0]})(${d[0]}) + (${F[1]})(${d[1]}) = ${W}$ J` }]
  });
});
const makeV2b = (rng) => go(() => {
  const k = nz(rng, -8, 8), b = [nz(rng, -6, 6), nz(rng, -6, 6)];
  if ((k * b[0]) % b[1] !== 0) return null;
  const a2 = -(k * b[0]) / b[1];
  if (a2 === 0 || k * b[0] + a2 * b[1] !== 0) return null;
  return num(`The vectors $\\underset{\\sim}{p} = \\begin{pmatrix} k \\\\ ${a2} \\end{pmatrix}$ and $\\underset{\\sim}{q} = ${col(b[0], b[1])}$ are perpendicular. Find $k$.`, k, {
    traps: [{ value: -k, why: 'Perpendicular vectors have dot product zero: $kq_x + ' + a2 + 'q_y = 0$.' }],
    hints: ['Perpendicular means the dot product is $0$.', `$k(${b[0]}) + (${a2})(${b[1]}) = 0$.`, 'Solve for $k$.'],
    steps: [{ h: 'Dot product zero', d: `$${lin(b[0], "k", a2 * b[1])} = 0$` }, { h: 'Solve', d: `$k = ${k}$` }]
  });
});
const makeV2c = (rng) => go(() => {
  const a = [nz(rng, -7, 7), nz(rng, -7, 7)], b1 = nz(rng, -7, 7), k = nz(rng, -9, 9), D = a[0] * b1 + a[1] * k;
  return num(`$${A} = ${col(a[0], a[1])}$ and $${B} = \\begin{pmatrix} ${b1} \\\\ k \\end{pmatrix}$ satisfy $\\underset{\\sim}{a}\\cdot\\underset{\\sim}{b} = ${D}$. Find $k$.`, k, {
    traps: [{ value: D - a[0] * b1, why: `Divide by the $y$-component of $\\underset{\\sim}{a}$, which is ${a[1]}.` }],
    hints: ['Write out the dot product with the unknown.', `$${cl(`${a[0]}(${b1})`, a[1], 'k')} = ${D}$.`, 'Solve the linear equation.'],
    steps: [{ h: 'Dot product', d: `$${cl(a[0] * b1, a[1], "k")} = ${D}$` }, { h: 'Solve', d: `$k = \\dfrac{${D - a[0] * b1}}{${a[1]}} = ${k}$` }]
  });
});
const makeV2d = (rng) => go(() => {
  const a = [nz(rng, -6, 6), nz(rng, -6, 6)], b = [nz(rng, -6, 6), nz(rng, -6, 6)];
  if (rng() < 0.5) {
    const p = nz(rng, -4, 4), q = nz(rng, -4, 4), v = (p * a[0]) * (q * b[0]) + (p * a[1]) * (q * b[1]);
    if (v === 0) return null;
    return num(`Given $${A} = ${col(a[0], a[1])}$ and $${B} = ${col(b[0], b[1])}$, find $(${sc(p, A)})\\cdot(${sc(q, B)})$.`, v, {
      traps: [{ value: p + q + (a[0] * b[0] + a[1] * b[1]), why: 'Scalars multiply the dot product: $(p\\underset{\\sim}{a})\\cdot(q\\underset{\\sim}{b}) = pq(\\underset{\\sim}{a}\\cdot\\underset{\\sim}{b})$.' }],
      hints: ['Scalar multiples can be taken outside the dot product.', `$\\underset{\\sim}{a}\\cdot\\underset{\\sim}{b} = ${a[0] * b[0] + a[1] * b[1]}$.`, `Multiply by $${p}\\times ${q}$.`],
      steps: [{ h: 'Dot product', d: `$\\underset{\\sim}{a}\\cdot\\underset{\\sim}{b} = ${a[0] * b[0] + a[1] * b[1]}$` }, { h: 'Scale', d: `$(${p})(${q})(${a[0] * b[0] + a[1] * b[1]}) = ${v}$` }]
    });
  }
  const v = (a[0] + b[0]) * (a[0] - b[0]) + (a[1] + b[1]) * (a[1] - b[1]);
  if (v === 0) return null;
  return num(`Given $${A} = ${col(a[0], a[1])}$ and $${B} = ${col(b[0], b[1])}$, find $(\\underset{\\sim}{a} + \\underset{\\sim}{b})\\cdot(\\underset{\\sim}{a} - \\underset{\\sim}{b})$.`, v, {
    traps: [{ value: Math.abs(a[0] * b[0] + a[1] * b[1]), why: 'Find each bracket as a vector first, then dot them.' }],
    hints: ['Find $\\underset{\\sim}{a} + \\underset{\\sim}{b}$ and $\\underset{\\sim}{a} - \\underset{\\sim}{b}$ first.', `$${col(a[0] + b[0], a[1] + b[1])}$ and $${col(a[0] - b[0], a[1] - b[1])}$.`, 'Then take the dot product.'],
    steps: [{ h: 'Sum and difference', d: `$${col(a[0] + b[0], a[1] + b[1])},\\ ${col(a[0] - b[0], a[1] - b[1])}$` }, { h: 'Dot product', d: `$${v}$` }]
  });
});
const makeV2e = (rng) => go(() => {
  const a = [nz(rng, -8, 8), nz(rng, -8, 8)];
  let b;
  if (rng() < 0.3) { const k = nz(rng, -2, 2); b = [-a[1] * k, a[0] * k]; } else b = [nz(rng, -8, 8), nz(rng, -8, 8)];
  const D = a[0] * b[0] + a[1] * b[1], cr = a[0] * b[1] - a[1] * b[0];
  if (cr === 0) return null;
  const ans = D > 0 ? 'acute' : D < 0 ? 'obtuse' : 'a right angle';
  const all = ['acute', 'obtuse', 'a right angle', 'zero (the vectors are parallel)'];
  const why = { acute: 'A positive dot product means an acute angle.', obtuse: 'A negative dot product means an obtuse angle.', 'a right angle': 'A zero dot product means perpendicular.', 'zero (the vectors are parallel)': 'These vectors are not scalar multiples, so they are not parallel.' };
  return mc(rng, `For $${A} = ${col(a[0], a[1])}$ and $${B} = ${col(b[0], b[1])}$, the angle between the vectors is...`, ans,
    all.filter(t => t !== ans).map(t => ({ text: t, why: why[t] })),
    ['The sign of the dot product tells the type of angle.', `$\\underset{\\sim}{a}\\cdot\\underset{\\sim}{b} = ${a[0]}(${b[0]}) + ${a[1]}(${b[1]})$.`, 'Positive: acute; zero: right angle; negative: obtuse.'],
    [{ h: 'Dot product', d: `$${a[0] * b[0]} + ${a[1] * b[1]} = ${D}$` }, { h: 'Conclude', d: `${D > 0 ? 'positive' : D < 0 ? 'negative' : 'zero'}, so the angle is ${ans}.` }]);
});
const makeV2f = (rng) => go(() => {
  const p = ri(rng, 2, 15), q = ri(rng, 2, 15);
  if (p === q) return null;
  return num(`$ABCD$ is a parallelogram with $\\overrightarrow{AB} = \\underset{\\sim}{u}$ and $\\overrightarrow{AD} = \\underset{\\sim}{v}$, where $|\\underset{\\sim}{u}| = ${p}$ and $|\\underset{\\sim}{v}| = ${q}$. The diagonals are $\\underset{\\sim}{u} + \\underset{\\sim}{v}$ and $\\underset{\\sim}{u} - \\underset{\\sim}{v}$. Find $(\\underset{\\sim}{u} + \\underset{\\sim}{v})\\cdot(\\underset{\\sim}{u} - \\underset{\\sim}{v})$.`, p * p - q * q, {
    traps: [{ value: (p - q) * (p - q), why: 'Expand: $\\underset{\\sim}{u}\\cdot\\underset{\\sim}{u} - \\underset{\\sim}{v}\\cdot\\underset{\\sim}{v} = |u|^2 - |v|^2$; the cross terms cancel.' }],
    hints: ['Expand like a difference of squares.', '$\\underset{\\sim}{u}\\cdot\\underset{\\sim}{v}$ cancels with $\\underset{\\sim}{v}\\cdot\\underset{\\sim}{u}$.', '$|\\underset{\\sim}{u}|^2 - |\\underset{\\sim}{v}|^2$.'],
    steps: [{ h: 'Expand', d: `$= |\\underset{\\sim}{u}|^2 - |\\underset{\\sim}{v}|^2$` }, { h: 'Evaluate', d: `$${p}^2 - ${q}^2 = ${p * p - q * q}$ — zero exactly when the sides are equal (rhombus).` }]
  });
});
const makeV2g = (rng) => go(() => {
  const a = [nz(rng, -9, 9), nz(rng, -9, 9)], b = [nz(rng, -9, 9), nz(rng, -9, 9)], v = a[0] * b[0] + a[1] * b[1];
  if (v === 0) return null;
  const ij = (x, y) => `${cn(x, '\\underset{\\sim}{i}')} ${y < 0 ? '-' : '+'} ${Math.abs(y) === 1 ? '' : Math.abs(y)}\\underset{\\sim}{j}`;
  return num(`Find $\\underset{\\sim}{p}\\cdot\\underset{\\sim}{q}$ where $\\underset{\\sim}{p} = ${ij(a[0], a[1])}$ and $\\underset{\\sim}{q} = ${ij(b[0], b[1])}$.`, v, {
    traps: [{ value: a[0] * b[1] + a[1] * b[0], why: 'Multiply $i$-components together and $j$-components together.' }],
    hints: ['$\\underset{\\sim}{i}\\cdot\\underset{\\sim}{i} = 1$, $\\underset{\\sim}{j}\\cdot\\underset{\\sim}{j} = 1$, $\\underset{\\sim}{i}\\cdot\\underset{\\sim}{j} = 0$.', 'So multiply matching coefficients and add.', `$(${a[0]})(${b[0]}) + (${a[1]})(${b[1]})$.`],
    steps: [{ h: 'Matching coefficients', d: `$(${a[0]})(${b[0]}) + (${a[1]})(${b[1]}) = ${v}$` }]
  });
});

const makeV3a = (rng) => go(() => {
  const ma = ri(rng, 2, 12), mb = ri(rng, 2, 12), th = rc(rng, [30, 45, 60, 120, 135, 150]), v = ma * mb * cs(th);
  if (!safe(v, 2)) return null;
  return num(`Two vectors have magnitudes $${ma}$ and $${mb}$, and the angle between them is $${th}°$. Find their scalar product, correct to 2 decimal places.`, rnd(v, 2), {
    tol: 0.0005, traps: [{ value: rnd(ma * mb * sn(th), 2), why: 'The scalar product uses cosine: $|a||b|\\cos\\theta$.' }],
    hints: ['$\\underset{\\sim}{a}\\cdot\\underset{\\sim}{b} = |a||b|\\cos\\theta$.', `$${ma} \\times ${mb} \\times \\cos ${th}°$.`, 'Watch the sign for obtuse angles.'],
    steps: [{ h: 'Formula', d: `$${ma}\\times ${mb}\\times\\cos ${th}°$` }, { h: 'Evaluate', d: `$\\approx ${rnd(v, 2)}$` }]
  });
});
const makeV3b = (rng) => go(() => {
  const ma = ri(rng, 2, 12), mb = ri(rng, 2, 12), D = ri(rng, -ma * mb + 1, ma * mb - 1);
  const a = deg(Math.acos(D / (ma * mb)));
  if (!safe(a, 0) || a < 5 || a > 175) return null;
  return num(`The vectors $\\underset{\\sim}{a}$ and $\\underset{\\sim}{b}$ have $|\\underset{\\sim}{a}| = ${ma}$, $|\\underset{\\sim}{b}| = ${mb}$ and $\\underset{\\sim}{a}\\cdot\\underset{\\sim}{b} = ${D}$. Find the angle between them, to the nearest degree.`, Math.round(a), {
    tol: 0.005, suffix: '°', traps: [{ value: Math.round(deg(Math.acos(D / (ma + mb)))), why: 'Divide by the product $|a||b|$, not the sum.' }],
    hints: ['$\\cos\\theta = \\dfrac{\\underset{\\sim}{a}\\cdot\\underset{\\sim}{b}}{|a||b|}$.', `$\\cos\\theta = \\dfrac{${D}}{${ma * mb}}$.`, 'Apply $\\cos^{-1}$.'],
    steps: [{ h: 'cos θ', d: `$\\dfrac{${D}}{${ma} \\times ${mb}} = ${rnd(D / (ma * mb), 4)}$` }, { h: 'Angle', d: `$\\theta \\approx ${Math.round(a)}°$` }]
  });
});
const makeV3c = (rng) => go(() => {
  const P = () => [ri(rng, -8, 8), ri(rng, -8, 8)], Ap = P(), Bp = P(), Cp = P();
  const u = [Ap[0] - Bp[0], Ap[1] - Bp[1]], w = [Cp[0] - Bp[0], Cp[1] - Bp[1]];
  const cr = u[0] * w[1] - u[1] * w[0];
  if (cr === 0 || (!u[0] && !u[1]) || (!w[0] && !w[1])) return null;
  const a = deg(Math.acos((u[0] * w[0] + u[1] * w[1]) / (hyp(...u) * hyp(...w))));
  if (!safe(a, 0) || a < 5 || a > 175) return null;
  return num(`In triangle $ABC$, $A(${Ap[0]}, ${Ap[1]})$, $B(${Bp[0]}, ${Bp[1]})$ and $C(${Cp[0]}, ${Cp[1]})$. Find angle $ABC$, to the nearest degree.`, Math.round(a), {
    tol: 0.005, suffix: '°', traps: [{ value: Math.round(180 - a), why: 'Use vectors $\\overrightarrow{BA}$ and $\\overrightarrow{BC}$, both pointing away from $B$.' }],
    hints: ['The angle at $B$ is between $\\overrightarrow{BA}$ and $\\overrightarrow{BC}$.', `$\\overrightarrow{BA} = ${col(u[0], u[1])}$, $\\overrightarrow{BC} = ${col(w[0], w[1])}$.`, '$\\cos\\theta = \\dfrac{\\overrightarrow{BA}\\cdot\\overrightarrow{BC}}{|BA||BC|}$.'],
    steps: [{ h: 'Vectors from B', d: `$${col(u[0], u[1])},\\ ${col(w[0], w[1])}$` }, { h: 'Dot product', d: `$${u[0] * w[0] + u[1] * w[1]}$` }, { h: 'Angle', d: `$\\theta \\approx ${Math.round(a)}°$` }]
  });
});
const makeV3d = (rng) => go(() => {
  const a = [ri(rng, 1, 6), ri(rng, 1, 6)], b = [ri(rng, 1, 6), nz(rng, -6, 6)];
  if (a[0] * b[1] - a[1] * b[0] === 0) return null;
  const th = Math.acos((a[0] * b[0] + a[1] * b[1]) / (hyp(...a) * hyp(...b)));
  if (!safe(th, 2)) return null;
  return num(`Find the angle between $${A} = ${col(a[0], a[1])}$ and $${B} = ${col(b[0], b[1])}$ in **radians**, correct to 2 decimal places.`, rnd(th, 2), {
    tol: 0.0005, suffix: 'rad', traps: [{ value: Math.round(deg(th)), why: 'That is the angle in degrees; the question asks for radians.' }],
    hints: ['Use $\\cos\\theta = \\dfrac{\\underset{\\sim}{a}\\cdot\\underset{\\sim}{b}}{|a||b|}$.', 'Set your calculator to radians.', 'Apply $\\cos^{-1}$.'],
    steps: [{ h: 'Dot and magnitudes', d: `$${a[0] * b[0] + a[1] * b[1]}$; $|a| \\approx ${rnd(hyp(...a), 3)}$, $|b| \\approx ${rnd(hyp(...b), 3)}$` }, { h: 'Angle', d: `$\\theta \\approx ${rnd(th, 2)}$ rad` }]
  });
});
const makeV3e = (rng) => go(() => {
  const a = [nz(rng, -6, 6), nz(rng, -6, 6)], b = [nz(rng, -6, 6), nz(rng, -6, 6)];
  const s = [a[0] + b[0], a[1] + b[1]], d = [a[0] - b[0], a[1] - b[1]];
  if ((!s[0] && !s[1]) || (!d[0] && !d[1]) || s[0] * d[1] - s[1] * d[0] === 0) return null;
  const th = deg(Math.acos((s[0] * d[0] + s[1] * d[1]) / (hyp(...s) * hyp(...d))));
  if (!safe(th, 0)) return null;
  return num(`A parallelogram has adjacent sides $${A} = ${col(a[0], a[1])}$ and $${B} = ${col(b[0], b[1])}$. Find the angle between its diagonals $\\underset{\\sim}{a} + \\underset{\\sim}{b}$ and $\\underset{\\sim}{a} - \\underset{\\sim}{b}$, to the nearest degree.`, Math.round(th), {
    tol: 0.005, suffix: '°', traps: [{ value: Math.round(deg(Math.acos((a[0] * b[0] + a[1] * b[1]) / (hyp(...a) * hyp(...b))))), why: 'That is the angle between the sides; the question concerns the diagonals.' }],
    hints: [`Diagonals: $${col(s[0], s[1])}$ and $${col(d[0], d[1])}$.`, 'Take their dot product and magnitudes.', 'Apply $\\cos^{-1}$.'],
    steps: [{ h: 'Diagonal vectors', d: `$${col(s[0], s[1])},\\ ${col(d[0], d[1])}$` }, { h: 'Dot product', d: `$${s[0] * d[0] + s[1] * d[1]}$` }, { h: 'Angle', d: `$\\theta \\approx ${Math.round(th)}°$` }]
  });
});
const makeV3f = (rng) => go(() => {
  const a = [nz(rng, -6, 6), nz(rng, -6, 6)], b = [nz(rng, -6, 6), nz(rng, -6, 6)];
  const D = a[0] * b[0] + a[1] * b[1], A2 = a[0] ** 2 + a[1] ** 2, B2 = b[0] ** 2 + b[1] ** 2;
  if (D === 0 || a[0] * b[1] - a[1] * b[0] === 0) return null;
  if (!distinct([Math.acos(D / Math.sqrt(A2 * B2)), Math.acos(D / (Math.sqrt(A2) + Math.sqrt(B2))), Math.asin(D / Math.sqrt(A2 * B2)), Math.acos(D / (A2 * B2))])) return null;
  return mc(rng, `For $${A} = ${col(a[0], a[1])}$ and $${B} = ${col(b[0], b[1])}$, which expression gives the angle $\\theta$ between them?`,
    `$\\cos^{-1}\\!\\left(\\dfrac{${D}}{\\sqrt{${A2}}\\,\\sqrt{${B2}}}\\right)$`,
    [{ text: `$\\cos^{-1}\\!\\left(\\dfrac{${D}}{\\sqrt{${A2}} + \\sqrt{${B2}}}\\right)$`, why: 'Divide by the product of the magnitudes, not their sum.' },
      { text: `$\\sin^{-1}\\!\\left(\\dfrac{${D}}{\\sqrt{${A2}}\\,\\sqrt{${B2}}}\\right)$`, why: 'The dot-product formula gives $\\cos\\theta$, not $\\sin\\theta$.' },
      { text: `$\\cos^{-1}\\!\\left(\\dfrac{${D}}{${A2}\\cdot ${B2}}\\right)$`, why: 'Use the magnitudes $|a|$ and $|b|$, not their squares.' }],
    ['$\\underset{\\sim}{a}\\cdot\\underset{\\sim}{b} = |a||b|\\cos\\theta$.', `$\\underset{\\sim}{a}\\cdot\\underset{\\sim}{b} = ${D}$.`, `$|a| = \\sqrt{${A2}}$ and $|b| = \\sqrt{${B2}}$.`],
    [{ h: 'Angle formula', d: `$\\theta = \\cos^{-1}\\left(\\dfrac{${D}}{\\sqrt{${A2}}\\sqrt{${B2}}}\\right)$` }]);
});

const makeV4a = (rng) => go(() => {
  const [bx, by, m] = trip(rng), b = [bx * rc(rng, [1, -1]), by * rc(rng, [1, -1])], a = [nz(rng, -9, 9), nz(rng, -9, 9)];
  const D = a[0] * b[0] + a[1] * b[1], v = D / (m * m) * b[0];
  if (D === 0 || !safe(v, 2)) return null;
  return num(`Find the $x$-component of the **vector projection** of $${A} = ${col(a[0], a[1])}$ onto $${B} = ${col(b[0], b[1])}$, correct to 2 decimal places.`, rnd(v, 2), {
    tol: 0.0005, traps: [{ value: rnd(D / m, 2), why: 'That is the scalar projection; the vector projection is a vector in the direction of $\\underset{\\sim}{b}$.' }, { value: rnd(D / (m * m) * b[1], 2), why: 'Take the $x$-component of the result.' }],
    hints: ['$\\text{proj}_b\\,a = \\dfrac{\\underset{\\sim}{a}\\cdot\\underset{\\sim}{b}}{|b|^2}\\underset{\\sim}{b}$.', `$\\underset{\\sim}{a}\\cdot\\underset{\\sim}{b} = ${D}$, $|b|^2 = ${m * m}$.`, `Multiply $\\dfrac{${D}}{${m * m}}$ by $${b[0]}$.`],
    steps: [{ h: 'Dot product', d: `$${D}$` }, { h: 'Scale b', d: `$\\dfrac{${D}}{${m * m}}${col(b[0], b[1])}$` }, { h: 'x-component', d: `$\\approx ${rnd(v, 2)}$` }]
  });
});
const makeV4b = (rng) => go(() => {
  const [bx, by, m] = trip(rng), b = [bx * rc(rng, [1, -1]), by * rc(rng, [1, -1])], a2 = nz(rng, -9, 9), p = nz(rng, -6, 6);
  const num_ = p * m - a2 * b[1];
  if (num_ % b[0] !== 0) return null;
  const k = num_ / b[0];
  if (k === 0 || (k * b[0] + a2 * b[1]) / m !== p) return null;
  return num(`The scalar projection of $\\underset{\\sim}{a} = \\begin{pmatrix} k \\\\ ${a2} \\end{pmatrix}$ onto $${B} = ${col(b[0], b[1])}$ is $${p}$. Find $k$.`, k, {
    traps: [{ value: p, why: `Write $\\dfrac{\\underset{\\sim}{a}\\cdot\\underset{\\sim}{b}}{|b|} = ${p}$ and solve for $k$.` }],
    hints: [`$|\\underset{\\sim}{b}| = ${m}$.`, `$\\dfrac{${b[0]}k + ${a2 * b[1]}}{${m}} = ${p}$.`, 'Solve for $k$.'],
    steps: [{ h: 'Set up', d: `$\\dfrac{${b[0]}k + (${a2})(${b[1]})}{${m}} = ${p}$` }, { h: 'Solve', d: `$${b[0]}k = ${num_}$, so $k = ${k}$` }]
  });
});
const makeV4c = (rng) => go(() => {
  const [bx, by, m] = trip(rng), b = [bx * rc(rng, [1, -1]), by * rc(rng, [1, -1])], a = [nz(rng, -9, 9), nz(rng, -9, 9)];
  const cr = Math.abs(a[0] * b[1] - a[1] * b[0]);
  if (cr === 0 || !safe(cr / m, 2)) return null;
  return num(`Find the shortest distance from the point $(${a[0]}, ${a[1]})$ to the line through the origin in the direction of $${B} = ${col(b[0], b[1])}$, correct to 2 decimal places.`, rnd(cr / m, 2), {
    tol: 0.0005, traps: [{ value: rnd(Math.abs(a[0] * b[0] + a[1] * b[1]) / m, 2), why: 'That is the length along the line (the projection). The shortest distance is the perpendicular part.' }],
    hints: ['The perpendicular distance is the length of $\\underset{\\sim}{a}$ minus its projection onto the line.', `$|a|^2 = ${a[0] ** 2 + a[1] ** 2}$ and the scalar projection is $\\dfrac{${a[0] * b[0] + a[1] * b[1]}}{${m}}$.`, 'Use $d = \\sqrt{|a|^2 - \\text{proj}^2}$.'],
    steps: [{ h: 'Projection', d: `$\\dfrac{${a[0] * b[0] + a[1] * b[1]}}{${m}} \\approx ${rnd((a[0] * b[0] + a[1] * b[1]) / m, 3)}$` }, { h: 'Perpendicular distance', d: `$\\sqrt{${a[0] ** 2 + a[1] ** 2} - \\text{proj}^2} \\approx ${rnd(cr / m, 2)}$` }]
  });
});
const makeV4d = (rng) => go(() => {
  const [bx, by, m] = trip(rng), b = [bx, by], F = [ri(rng, 2, 20), nz(rng, -12, 12)];
  const D = F[0] * b[0] + F[1] * b[1], v = D / m;
  if (D === 0 || !safe(v, 2)) return null;
  return num(`A trolley is pushed along a track in the direction $${col(b[0], b[1])}$ by a force $\\underset{\\sim}{F} = ${col(F[0], F[1])}$ N. Find the component of the force acting along the track, correct to 2 decimal places.`, rnd(v, 2), {
    tol: 0.0005, suffix: 'N', traps: [{ value: D, why: 'Divide the dot product by the length of the track direction vector, $|b|$.' }, { value: rnd(hyp(...F), 2), why: 'The component along the track is the scalar projection, not the size of $\\underset{\\sim}{F}$.' }],
    hints: ['The component along the track is the scalar projection of $\\underset{\\sim}{F}$ onto the direction vector.', `$\\dfrac{\\underset{\\sim}{F}\\cdot\\underset{\\sim}{d}}{|d|}$ with $|d| = ${m}$.`, `$\\underset{\\sim}{F}\\cdot\\underset{\\sim}{d} = ${D}$.`],
    steps: [{ h: 'Dot product', d: `$${D}$` }, { h: 'Divide by |d|', d: `$\\dfrac{${D}}{${m}} \\approx ${rnd(v, 2)}$ N` }]
  });
});
const makeV4e = (rng) => go(() => {
  const a = [nz(rng, -9, 9), nz(rng, -9, 9)], b = [nz(rng, -9, 9), nz(rng, -9, 9)];
  const D = a[0] * b[0] + a[1] * b[1], mb = hyp(...b), v = D / mb;
  if (D === 0 || Number.isInteger(mb) || !safe(v, 2)) return null;
  return num(`Find the component of $${A} = ${col(a[0], a[1])}$ in the direction of $${B} = ${col(b[0], b[1])}$ (the scalar projection), correct to 2 decimal places.`, rnd(v, 2), {
    tol: 0.0005, traps: [{ value: rnd(D / hyp(...a), 2), why: 'Divide by $|\\underset{\\sim}{b}|$, the vector being projected onto.' }],
    hints: ['Scalar projection $= \\dfrac{\\underset{\\sim}{a}\\cdot\\underset{\\sim}{b}}{|b|}$.', `$\\underset{\\sim}{a}\\cdot\\underset{\\sim}{b} = ${D}$, $|b| = \\sqrt{${b[0] ** 2 + b[1] ** 2}}$.`, 'Divide and round.'],
    steps: [{ h: 'Dot product', d: `$${D}$` }, { h: 'Divide by |b|', d: `$\\dfrac{${D}}{\\sqrt{${b[0] ** 2 + b[1] ** 2}}} \\approx ${rnd(v, 2)}$` }]
  });
});
const makeV4f = (rng) => go(() => {
  const a = [nz(rng, -7, 7), nz(rng, -7, 7)], b = [nz(rng, -7, 7), nz(rng, -7, 7)];
  const D = a[0] * b[0] + a[1] * b[1], A2 = a[0] ** 2 + a[1] ** 2, B2 = b[0] ** 2 + b[1] ** 2;
  if (D === 0) return null;
  return mc(rng, `For $${A} = ${col(a[0], a[1])}$ and $${B} = ${col(b[0], b[1])}$, which expression gives the scalar projection of $\\underset{\\sim}{a}$ onto $\\underset{\\sim}{b}$?`,
    `$\\dfrac{${D}}{\\sqrt{${B2}}}$`,
    [{ text: `$\\dfrac{${D}}{\\sqrt{${A2}}}$`, why: 'Divide by the length of the vector being projected **onto**, $|b|$.' },
      { text: `$\\dfrac{${D}}{${B2}}$`, why: 'That is the scalar multiplying $\\underset{\\sim}{b}$ in the vector projection, not the scalar projection.' },
      { text: `$\\dfrac{${D}}{\\sqrt{${A2}}\\sqrt{${B2}}}$`, why: 'That is $\\cos\\theta$ — a ratio, not a length along $\\underset{\\sim}{b}$.' }],
    ['Scalar projection of $a$ onto $b$ $= |a|\\cos\\theta$.', 'That equals $\\dfrac{\\underset{\\sim}{a}\\cdot\\underset{\\sim}{b}}{|b|}$.', `$\\underset{\\sim}{a}\\cdot\\underset{\\sim}{b} = ${D}$ and $|b| = \\sqrt{${B2}}$.`],
    [{ h: 'Formula', d: `$\\dfrac{\\underset{\\sim}{a}\\cdot\\underset{\\sim}{b}}{|b|} = \\dfrac{${D}}{\\sqrt{${B2}}}$` }]);
});

export const forms = {
  'me12-induction': [
    { diffs: [1], make: makeI1a }, { diffs: [1], make: makeI1b }, { diffs: [1], make: makeI1c }, { diffs: [1], make: makeI1d }, { diffs: [1], make: makeI1e },
    { diffs: [2], make: makeI2a }, { diffs: [2], make: makeI2b }, { diffs: [2], make: makeI2c }, { diffs: [2], make: makeI2d }, { diffs: [2], make: makeI2e },
    { diffs: [3], make: makeT3a }, { diffs: [3], make: makeT3b }, { diffs: [3], make: makeT3c }, { diffs: [3], make: makeT3d }, { diffs: [3], make: makeT3e }
  ],
  'me12-binomial': [
    { diffs: [1], make: makeB1a }, { diffs: [1], make: makeB1b }, { diffs: [1], make: makeB1c }, { diffs: [1], make: makeB1d }, { diffs: [1], make: makeB1e },
    { diffs: [2, 3], make: makeB3a }, { diffs: [3], make: makeB3b }, { diffs: [3], make: makeB3c }, { diffs: [3], make: makeB3d }, { diffs: [2, 3], make: makeB3f },
    { diffs: [4], make: makeB4a }, { diffs: [4], make: makeB4b }, { diffs: [4], make: makeB4c }, { diffs: [4], make: makeB4d }, { diffs: [4], make: makeB4e }, { diffs: [4], make: makeB4f }
  ],
  'me12-projectile': [
    { diffs: [1], make: makeP1a }, { diffs: [1], make: makeP1b }, { diffs: [1], make: makeP1c }, { diffs: [1], make: makeP1d }, { diffs: [1], make: makeP1e }, { diffs: [1], make: makeP1f },
    { diffs: [4], make: makeP2a }, { diffs: [2], make: makeP2c }, { diffs: [2], make: makeP2d }, { diffs: [2], make: makeP2e }, { diffs: [2], make: makeP2f },
    { diffs: [3], make: makeP3a }, { diffs: [3], make: makeP3b }, { diffs: [3], make: makeP3c }, { diffs: [3], make: makeP3d }, { diffs: [4], make: makeP3e }, { diffs: [3], make: makeP3f },
    { diffs: [4], make: makeP4a }, { diffs: [4], make: makeP4b }, { diffs: [4], make: makeP4c }, { diffs: [4], make: makeP4d }, { diffs: [4], make: makeP4e }, { diffs: [4], make: makeP4f }
  ],
  'me12-vectors': [
    { diffs: [1], make: makeV1a }, { diffs: [1], make: makeV1b }, { diffs: [1], make: makeV1c }, { diffs: [1], make: makeV1d }, { diffs: [1], make: makeV1e }, { diffs: [1], make: makeV1f }, { diffs: [1], make: makeV1g },
    { diffs: [2], make: makeV2a }, { diffs: [2], make: makeV2b }, { diffs: [2], make: makeV2c }, { diffs: [2], make: makeV2d }, { diffs: [2], make: makeV2e }, { diffs: [2], make: makeV2f }, { diffs: [2], make: makeV2g },
    { diffs: [3], make: makeV3a }, { diffs: [3], make: makeV3b }, { diffs: [3], make: makeV3c }, { diffs: [3], make: makeV3d }, { diffs: [3], make: makeV3e }, { diffs: [3], make: makeV3f },
    { diffs: [4], make: makeV4a }, { diffs: [4], make: makeV4b }, { diffs: [4], make: makeV4c }, { diffs: [4], make: makeV4d }, { diffs: [4], make: makeV4e }, { diffs: [4], make: makeV4f }
  ]
};
