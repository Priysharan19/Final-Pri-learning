// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Prithagoras capacity overlay · Advanced Year 12 (slot adv12-a)
// y12-diff, y12-appdiff, y12-integration, y12-stats.
//
// Extra structural forms beside the base generators in year12.js: direct,
// reverse, missing-parameter, multi-step, context, representation, MCQ with
// misconception distractors, and machine-keyed "show that" / "first error"
// proof styles (the engine marks a final keyed answer, never working).
// Every key is computed in code from the numbers shown, then re-derived by a
// second, differently-written route (central difference, Simpson, a scan, a
// direct enumeration) in `agree`; a disagreement throws, so no wrong key can
// be issued. SYNTHETIC: no student or examiner evidence.
// ─────────────────────────────────────────────────────────────────────────────
import { ri, rc, nz, mcq, term, poly, sgn, r2, r3, gcd } from '../qhelpers.js';

// ── Local helpers ───────────────────────────────────────────────────────────
const lin = (a, b, v = 'x') => (b === 0 ? term(a, v) : `${term(a, v)} ${sgn(b)}`);
const ex = (a, b) => `${a}*x ${b < 0 ? '-' : '+'} ${Math.abs(b)}`;
const pl = (n, s, p = `${s}s`) => `${n} ${n === 1 ? s : p}`;
const pw = (inner, e) => (e === 1 ? `(${inner})` : `(${inner})^{${e}}`);
const xp = e => (e === 1 ? 'x' : `x^{${e}}`);
const cf = (c, inner) => (c === 1 ? `(${inner})` : c === -1 ? `-(${inner})` : `${c}(${inner})`);
const addT = (c, tex) => `${c < 0 ? '-' : '+'} ${Math.abs(c) === 1 ? '' : Math.abs(c)}${tex}`;
const lead = a => (a === 1 ? '' : a === -1 ? '-' : String(a));
const coefs = (m, A, B) => { const arr = new Array(m + 1).fill(0); arr[0] = A; arr[1] = B; return arr; };

const agree = (key, check, what) => {
  if (!(Math.abs(key - check) <= Math.max(1e-3, 1e-5 * Math.abs(key)))) throw new Error(`adv12-a ${what}: key ${key} != check ${check}`);
  return key;
};
const dnum = (f, x) => { const h = 1e-4; return (f(x + h) - f(x - h)) / (2 * h); };
const simpson = (f, a, b, n = 2000) => {
  const h = (b - a) / n; let s = f(a) + f(b);
  for (let i = 1; i < n; i++) s += f(a + i * h) * (i % 2 ? 4 : 2);
  return (s * h) / 3;
};
const keepT = (arr, val) => { const seen = new Set(); return arr.filter(t => { const ok = Number.isFinite(t.value) && Math.abs(t.value - val) > 1e-6 && !seen.has(t.value); seen.add(t.value); return ok; }); };

/** A three-line worked solution with an injected (or no) error; the key is the first erroneous line. */
function firstError(rng, { intro, versions, because, rule }) {
  const k = rc(rng, [0, 1, 2, 3]);
  const lines = versions[k];
  const labels = ['Line 1', 'Line 2', 'Line 3'];
  const correctText = k === 0 ? 'There is no error' : labels[k - 1];
  const wrongs = labels.map((t, i) => ({ t, i: i + 1 })).filter(o => o.i !== k).map(o => ({
    text: o.t,
    why: k === 0 || o.i < k ? `${o.t} follows correctly from the line before it.` : `An error already appears earlier, at Line ${k}: the question asks for the *first* error.`
  }));
  if (k !== 0) wrongs.push({ text: 'There is no error', why: `Check each line against the rule: Line ${k} does not follow from the line above it.` });
  const m = mcq(rng, correctText, wrongs);
  const upto = k === 0 ? 3 : k;
  return {
    prompt: `${intro}\n\n**Line 1:** $${lines[0]}$\n\n**Line 2:** $${lines[1]}$\n\n**Line 3:** $${lines[2]}$\n\nWhich line contains the first error?`,
    answerType: 'mcq', answer: { correctIndex: m.correctIndex, optionTraps: m.optionTraps }, mcqOptions: m.options,
    hints: [rule, 'Check each line using only the line directly above it.', 'Stop at the first line that does not follow.'],
    steps: [
      ...lines.slice(0, upto).map((l, i) => ({ h: labels[i], d: `$${l}$ — ${i + 1 === k ? because[k] : 'this line is correct'}` })),
      ...(k === 0 ? [{ h: 'Verdict', d: 'Every line follows from the one before: there is no error.' }] : [{ h: 'Corrected line', d: `$${versions[0][k - 1]}$` }])
    ]
  };
}

/** Chain-rule first-error versions for y = u^n with an inner function (D1 and D4 share it). */
function chainVersions({ n, L, d, dBad, coef, coefBad }) {
  const l1 = dd => `u = ${L} \\;\\Rightarrow\\; \\dfrac{du}{dx} = ${dd}`;
  const l2 = (e, c) => `y = u^{${n}} \\;\\Rightarrow\\; \\dfrac{dy}{du} = ${c}${up(e)}`;
  const up = e => (e === 1 ? 'u' : `u^{${e}}`);
  const l3 = body => `\\dfrac{dy}{dx} = \\dfrac{dy}{du}\\times\\dfrac{du}{dx} = ${body}`;
  const prod = (c, e) => `${c}${pw(L, e)}`;
  return [
    [l1(d), l2(n - 1, n), l3(prod(coef, n - 1))],
    [l1(dBad), l2(n - 1, n), l3(prod(coefBad, n - 1))],
    [l1(d), `y = u^{${n}} \\;\\Rightarrow\\; \\dfrac{dy}{du} = ${n}u^{${n}}`, l3(prod(coef, n))],
    [l1(d), l2(n - 1, n), l3(`${n}${pw(L, n - 1)} + ${d}`)]
  ];
}
const chainBecause = [null, 'the derivative of the inner function is wrong', 'the power must drop by one when differentiating $u^n$', 'the chain rule *multiplies* the two derivatives, it does not add them'];

// ═════════════════════════════════════════════════════════════════════════════
// y12-diff
// ═════════════════════════════════════════════════════════════════════════════
const diffForms = [];

// D1 — chain rule with a linear inner function ──────────────────────────────
diffForms.push({ diffs: [1], make: (rng) => {
  let a, b, n, x0, s;
  do { a = ri(rng, 2, 9); b = nz(rng, -9, 9); n = ri(rng, 3, 6); x0 = ri(rng, -3, 3); s = a * x0 + b; } while (s === 0 || Math.abs(s) > 6);
  const L = lin(a, b);
  const val = agree(n * a * s ** (n - 1), dnum(x => (a * x + b) ** n, x0), 'chain point');
  return {
    prompt: `Let $y = ${pw(L, n)}$. Find the gradient of the curve at the point where $x = ${x0}$.`,
    answerType: 'numeric', answer: { value: val },
    traps: keepT([
      { value: n * s ** (n - 1), why: `Chain rule: also multiply by the derivative of the inside, which is $${a}$.` },
      { value: n * a * s ** n, why: 'Reduce the power by 1 as well as multiplying down.' },
      { value: n * a * (a * x0) ** (n - 1), why: `Substitute $x = ${x0}$ into the whole bracket $${L}$, including the constant.` }
    ], val),
    hints: ['Differentiate with the chain rule, then substitute $x$.', `$\\dfrac{dy}{dx} = ${n}\\times ${a}\\times ${pw(L, n - 1)}$.`, `At $x = ${x0}$ the bracket equals $${s}$.`],
    steps: [
      { h: 'Chain rule', d: `$\\dfrac{dy}{dx} = ${n * a}${pw(L, n - 1)}$` },
      { h: 'Evaluate the bracket', d: `$${a}(${x0}) ${sgn(b)} = ${s}$` },
      { h: 'Substitute', d: `$${n * a}\\times ${s}^{${n - 1}} = ${val}$` }
    ]
  };
} });

diffForms.push({ diffs: [1], make: (rng) => {
  let a, k, x0, s;
  do { a = ri(rng, 2, 9); k = nz(rng, -9, 9); x0 = ri(rng, -3, 3); s = a * x0 + k; } while (s === 0);
  const V = 2 * a * s;
  agree(dnum(x => (a * x + k) ** 2, x0), V, 'chain missing k');
  return {
    prompt: `The curve $y = (${term(a)} + k)^2$ has gradient $${V}$ at the point where $x = ${x0}$. Find the value of the constant $k$.`,
    answerType: 'numeric', answer: { value: k }, answerPrefix: 'k =',
    traps: keepT([
      { value: V / (2 * a), why: `Substitute $x = ${x0}$ into the bracket: $${a}(${x0}) + k$, not just $k$.` },
      { value: V / 2 - x0, why: 'The chain rule multiplies by the inner derivative, so divide by $2a$, not just by 2.' }
    ], k),
    hints: ['Find $\\dfrac{dy}{dx}$ in terms of $k$ first.', `$\\dfrac{dy}{dx} = 2\\times ${a}(${term(a)} + k) = ${2 * a}(${term(a)} + k)$.`, `Put $x = ${x0}$ and set it equal to $${V}$.`],
    steps: [
      { h: 'Differentiate', d: `$\\dfrac{dy}{dx} = ${2 * a}(${term(a)} + k)$` },
      { h: 'Use the gradient', d: `$${2 * a}(${a * x0} + k) = ${V}$` },
      { h: 'Solve', d: `$${a * x0} + k = ${V / (2 * a)} \\Rightarrow k = ${k}$` }
    ]
  };
} });

diffForms.push({ diffs: [1], make: (rng) => {
  const a = ri(rng, 1, 4), b = ri(rng, 1, 8), n = ri(rng, 2, 3), t0 = ri(rng, 1, 5);
  const s = a * t0 + b;
  const val = agree(n * a * s ** (n - 1), dnum(t => (a * t + b) ** n, t0), 'chain context');
  const L = lin(a, b, 't');
  return {
    prompt: `The volume of gas in an inflating balloon is $V = ${pw(L, n)}$ cm³ at $t$ seconds. Find the rate at which the volume is increasing after ${pl(t0, 'second')}.`,
    answerType: 'numeric', answer: { value: val }, answerSuffix: 'cm³/s',
    traps: keepT([
      { value: s ** n, why: 'That is the volume, not its rate of change: differentiate first.' },
      { value: n * s ** (n - 1), why: `Multiply by the inner derivative $${a}$ as well.` }
    ], val),
    hints: ['A rate of change means $\\dfrac{dV}{dt}$.', `$\\dfrac{dV}{dt} = ${n * a}${pw(L, n - 1)}$.`, `Substitute $t = ${t0}$.`],
    steps: [
      { h: 'Differentiate', d: `$\\dfrac{dV}{dt} = ${n * a}${pw(L, n - 1)}$` },
      { h: 'Substitute', d: `$t = ${t0}$: bracket $= ${s}$` },
      { h: 'Rate', d: `$${n * a}\\times ${s}^{${n - 1}} = ${val}$ cm³/s` }
    ]
  };
} });

diffForms.push({ diffs: [1], make: (rng) => {
  const a = ri(rng, 2, 9), b = nz(rng, -9, 9), n = ri(rng, 3, 7);
  const L = lin(a, b);
  const m = mcq(rng, `$${n * a}${pw(L, n - 1)}$`, [
    { text: `$${n}${pw(L, n - 1)}$`, why: `Multiply by the derivative of the inside, $${a}$.` },
    { text: `$${n * a}${pw(L, n)}$`, why: 'Reduce the power by 1.' },
    { text: `$${a}${pw(L, n - 1)}$`, why: `Bring the power $${n}$ down as well.` }
  ]);
  return {
    prompt: `Which expression is $\\dfrac{dy}{dx}$ when $y = ${pw(L, n)}$?`,
    answerType: 'mcq', answer: { correctIndex: m.correctIndex, optionTraps: m.optionTraps }, mcqOptions: m.options,
    hints: ['Chain rule: outer derivative times inner derivative.', `Outer: $${n}(\\ldots)^{${n - 1}}$.`, `Inner: $\\dfrac{d}{dx}(${L}) = ${a}$.`],
    steps: [
      { h: 'Outer derivative', d: `$${n}${pw(L, n - 1)}$` },
      { h: 'Inner derivative', d: `$${a}$` },
      { h: 'Multiply', d: `$\\dfrac{dy}{dx} = ${n * a}${pw(L, n - 1)}$` }
    ]
  };
} });

diffForms.push({ diffs: [1], make: (rng) => {
  const n = ri(rng, 1, 3), a = ri(rng, 2, 7), b = nz(rng, -9, 9);
  const L = lin(a, b);
  const den = n === 1 ? `${L}` : pw(L, n);
  const key = `${-n * a}*(${ex(a, b)})^(-${n + 1})`;
  return {
    prompt: `Differentiate $y = \\dfrac{1}{${den}}$.`,
    answerType: 'expression', answer: { expr: key },
    inputHint: `e.g. ${-n * a}/(${a}x ${sgn(b)})^${n + 1}`, answerPrefix: 'dy/dx =',
    traps: [
      { expr: `${-n}*(${ex(a, b)})^(-${n + 1})`, why: `Chain rule: multiply by the derivative of the inside, $${a}$.` },
      { expr: `${-n * a}*(${ex(a, b)})^(-${n})`, why: 'Write $y = (\\ldots)^{-n}$ and *subtract* 1 from the power: $-n - 1$.' }
    ],
    hints: [`Rewrite as $y = (${L})^{-${n}}$.`, `Power rule and chain rule: $-${n}\\times ${a}\\times (${L})^{-${n + 1}}$.`, 'Leave the answer with a negative power, or as a fraction.'],
    steps: [
      { h: 'Rewrite', d: `$y = (${L})^{-${n}}$` },
      { h: 'Chain rule', d: `$\\dfrac{dy}{dx} = -${n}(${L})^{-${n + 1}}\\times ${a}$` },
      { h: 'Simplify', d: `$= -\\dfrac{${n * a}}{(${L})^{${n + 1}}}$` }
    ]
  };
} });

diffForms.push({ diffs: [1], make: (rng) => {
  let a, b, n;
  do { a = ri(rng, 2, 8); b = nz(rng, -8, 8); n = ri(rng, 3, 6); } while (a === b);
  const L = lin(a, b);
  const v = chainVersions({ n, L, d: a, dBad: b, coef: n * a, coefBad: n * b });
  return firstError(rng, {
    intro: `A student differentiates $y = ${pw(L, n)}$ using the chain rule.`,
    versions: v, because: chainBecause, rule: 'Chain rule: $\\dfrac{dy}{dx} = \\dfrac{dy}{du}\\times\\dfrac{du}{dx}$.'
  });
} });

// D2 — product rule ───────────────────────────────────────────────────────────
diffForms.push({ diffs: [2], make: (rng) => {
  let a, b, c, d, x0, val;
  do { a = nz(rng, -6, 6); b = nz(rng, -9, 9); c = nz(rng, -6, 6); d = nz(rng, -9, 9); x0 = ri(rng, -4, 4); val = a * (c * x0 + d) + c * (a * x0 + b); } while (val === 0 || a === 1 || c === 1);
  agree(val, dnum(x => (a * x + b) * (c * x + d), x0), 'product point');
  const A = lin(a, b), C = lin(c, d);
  return {
    prompt: `Use the product rule to find the gradient of $y = (${A})(${C})$ at the point where $x = ${x0}$.`,
    answerType: 'numeric', answer: { value: val },
    traps: keepT([
      { value: a * c, why: 'Product rule: $u\'v + uv\'$ — not the product of the two derivatives.' },
      { value: a * (c * x0 + d), why: 'Product rule has two terms: add $u v\'$ as well.' }
    ], val),
    hints: ['$(uv)\' = u\'v + uv\'$.', `$u' = ${a}$ and $v' = ${c}$.`, `At $x = ${x0}$: $u = ${a * x0 + b}$ and $v = ${c * x0 + d}$.`],
    steps: [
      { h: 'Identify', d: `$u = ${A},\\; v = ${C}$, so $u' = ${a},\\; v' = ${c}$` },
      { h: 'Product rule', d: `$y' = ${a}(${C}) + ${c}(${A})$` },
      { h: 'Substitute', d: `$${a}(${c * x0 + d}) + ${c}(${a * x0 + b}) = ${val}$` }
    ]
  };
} });

diffForms.push({ diffs: [2], make: (rng) => {
  let m, n, a, b, x0, s, val;
  do {
    m = ri(rng, 1, 3); n = ri(rng, 2, 4); a = ri(rng, 1, 4); b = nz(rng, -5, 5); x0 = rc(rng, [-2, -1, 1, 2, 3]); s = a * x0 + b;
    val = m * x0 ** (m - 1) * s ** n + n * a * x0 ** m * s ** (n - 1);
  } while (s === 0 || Math.abs(s) > 7 || val === 0);
  agree(val, dnum(x => x ** m * (a * x + b) ** n, x0), 'product-chain point');
  const L = lin(a, b);
  return {
    prompt: `Find the gradient of $y = ${xp(m)}${pw(L, n)}$ at the point where $x = ${x0}$.`,
    answerType: 'numeric', answer: { value: val },
    traps: keepT([
      { value: m * x0 ** (m - 1) * s ** n, why: `The bracket needs the chain rule too, and the product rule adds a second term: $x^{${m}}\\times${n}\\times ${a}\\times(\\ldots)^{${n - 1}}$.` },
      { value: n * a * x0 ** m * s ** (n - 1), why: 'Product rule: do not forget $u\'v$, the term from differentiating the power of $x$.' }
    ], val),
    hints: ['Use the product rule with the chain rule inside it.', `$u = ${xp(m)}$, $v = ${pw(L, n)}$, so $v' = ${n * a}${pw(L, n - 1)}$.`, `At $x = ${x0}$ the bracket $${L}$ equals $${s}$.`],
    steps: [
      { h: 'Parts', d: `$u = ${xp(m)} \\Rightarrow u' = ${m}${m === 1 ? '' : xp(m - 1)}$; $v = ${pw(L, n)} \\Rightarrow v' = ${n * a}${pw(L, n - 1)}$` },
      { h: 'Product rule', d: `$y' = u'v + uv'$` },
      { h: 'Substitute $x = ' + x0 + '$', d: `$${m * x0 ** (m - 1)}\\times ${s ** n} + ${x0 ** m}\\times ${n * a}\\times ${s ** (n - 1)} = ${val}$` }
    ]
  };
} });

diffForms.push({ diffs: [2], make: (rng) => {
  const m = ri(rng, 2, 4), t = nz(rng, -5, 5), c = (m + 1) * t;
  const key = m * t;
  const f = x => x ** m * (x - c);
  agree(0, dnum(f, key), 'product stationary');
  return {
    prompt: `The curve $y = ${xp(m)}(${lin(1, -c)})$ has two stationary points. Find the $x$-coordinate of the one that is **not** at $x = 0$.`,
    answerType: 'numeric', answer: { value: key },
    traps: keepT([
      { value: c, why: `$x = ${c}$ is an $x$-intercept, not a stationary point.` },
      { value: 0, why: 'The question asks for the stationary point other than $x = 0$.' }
    ], key),
    hints: ['Differentiate with the product rule and set $y\' = 0$.', `$y' = ${m}${xp(m - 1)}(${lin(1, -c)}) + ${xp(m)}$.`, 'Factor out the common power of $x$ and solve the remaining linear factor.'],
    steps: [
      { h: 'Differentiate', d: `$y' = ${m}${xp(m - 1)}(${lin(1, -c)}) + ${xp(m)} = ${xp(m - 1)}(${lin(m + 1, -m * c)})$` },
      { h: 'Set to zero', d: `$x = 0$ or $${lin(m + 1, -m * c)} = 0$` },
      { h: 'Solve', d: `$x = ${key}$` }
    ]
  };
} });

diffForms.push({ diffs: [2], make: (rng) => {
  let m, a, k, x0, V;
  do { m = ri(rng, 2, 4); a = ri(rng, 1, 6); k = nz(rng, -9, 9); x0 = rc(rng, [-2, -1, 1, 2]); V = m * x0 ** (m - 1) * (a * x0 + k) + a * x0 ** m; } while (V === 0);
  agree(dnum(x => x ** m * (a * x + k), x0), V, 'product missing k');
  return {
    prompt: `The curve $y = ${xp(m)}(${term(a)} + k)$ has gradient $${V}$ at the point where $x = ${x0}$. Find the value of the constant $k$.`,
    answerType: 'numeric', answer: { value: k }, answerPrefix: 'k =',
    traps: keepT([
      { value: (V - a * x0 ** m) / (m * x0 ** (m - 1)), why: 'That is $ax + k$ at the point: subtract $a x$ to leave $k$.' },
      { value: V / (m * x0 ** (m - 1)) - a * x0 ** m, why: 'Product rule: both terms $u\'v$ and $uv\'$ contain the unknown or $a$ — substitute carefully.' }
    ], k),
    hints: ['Differentiate with the product rule first.', `$y' = ${m}${xp(m - 1)}(${term(a)} + k) + ${term(a, 'x', m)}$.`, `Substitute $x = ${x0}$ and $y' = ${V}$, then solve for $k$.`],
    steps: [
      { h: 'Differentiate', d: `$y' = ${m}${xp(m - 1)}(${term(a)} + k) + ${term(a, 'x', m)}$` },
      { h: 'Substitute', d: `$${m * x0 ** (m - 1)}(${a * x0} + k) + ${a * x0 ** m} = ${V}$` },
      { h: 'Solve', d: `$${a * x0} + k = ${(V - a * x0 ** m) / (m * x0 ** (m - 1))} \\Rightarrow k = ${k}$` }
    ]
  };
} });

diffForms.push({ diffs: [2], make: (rng) => {
  const a = ri(rng, 1, 5), b = ri(rng, 1, 9), c = ri(rng, 1, 5), d = ri(rng, 1, 9), t0 = ri(rng, 1, 6);
  const val = agree(a * (c * t0 + d) + c * (a * t0 + b), dnum(t => (a * t + b) * (c * t + d), t0), 'product context');
  return {
    prompt: `A rectangular pond is being enlarged. At time $t$ days its length is $(${lin(a, b, 't')})$ m and its width is $(${lin(c, d, 't')})$ m. Find the rate at which its area is increasing after ${pl(t0, 'day')}.`,
    answerType: 'numeric', answer: { value: val }, answerSuffix: 'm²/day',
    traps: keepT([
      { value: (a * t0 + b) * (c * t0 + d), why: 'That is the area itself, not its rate of change.' },
      { value: a * c, why: 'Product rule: $A\' = l\'w + lw\'$, not $l\'w\'$.' }
    ], val),
    hints: ['Area $A = l \\times w$; differentiate with the product rule.', `$l' = ${a}$ and $w' = ${c}$.`, `At $t = ${t0}$: $l = ${a * t0 + b}$ and $w = ${c * t0 + d}$.`],
    steps: [
      { h: 'Area', d: `$A = (${lin(a, b, 't')})(${lin(c, d, 't')})$` },
      { h: 'Product rule', d: `$A' = ${a}(${lin(c, d, 't')}) + ${c}(${lin(a, b, 't')})$` },
      { h: 'Substitute', d: `$${a}(${c * t0 + d}) + ${c}(${a * t0 + b}) = ${val}$ m²/day` }
    ]
  };
} });

diffForms.push({ diffs: [2], make: (rng) => {
  const m = ri(rng, 2, 5), a = ri(rng, 2, 7), b = nz(rng, -9, 9);
  const L = lin(a, b);
  const mc = mcq(rng, `$${m}${xp(m - 1)}(${L}) + ${a}${xp(m)}$`, [
    { text: `$${m * a}${xp(m - 1)}$`, why: 'Product rule: $u\'v + uv\'$ — not $u\'v\'$.' },
    { text: `$${m}${xp(m - 1)}(${L})$`, why: 'Add the second term $uv\'$ as well.' },
    { text: `$${m}${xp(m - 1)}(${L}) - ${a}${xp(m)}$`, why: 'The product rule *adds* the two terms.' }
  ]);
  return {
    prompt: `Which expression is $\\dfrac{dy}{dx}$ for $y = ${xp(m)}(${L})$?`,
    answerType: 'mcq', answer: { correctIndex: mc.correctIndex, optionTraps: mc.optionTraps }, mcqOptions: mc.options,
    hints: ['$(uv)\' = u\'v + uv\'$.', `$u = ${xp(m)}$, $v = ${L}$.`, `$u' = ${m}${xp(m - 1)}$, $v' = ${a}$.`],
    steps: [
      { h: 'Derivatives', d: `$u' = ${m}${xp(m - 1)},\\; v' = ${a}$` },
      { h: 'Product rule', d: `$y' = ${m}${xp(m - 1)}(${L}) + ${a}${xp(m)}$` }
    ]
  };
} });

diffForms.push({ diffs: [2], make: (rng) => {
  const m = ri(rng, 2, 4), a = ri(rng, 2, 6), b = nz(rng, -6, 6);
  const L = lin(a, b);
  const good = [
    `u = ${xp(m)},\\; v = ${L} \\;\\Rightarrow\\; u' = ${m}${xp(m - 1)},\\; v' = ${a}`,
    `y' = u'v + uv' = ${m}${xp(m - 1)}(${L}) + ${a}${xp(m)}`,
    `y' = ${poly(coefs(m, (m + 1) * a, m * b))}`
  ];
  const versions = [
    good,
    [`u = ${xp(m)},\\; v = ${L} \\;\\Rightarrow\\; u' = ${m}${xp(m - 1)},\\; v' = ${b}`, `y' = u'v + uv' = ${m}${xp(m - 1)}(${L}) ${addT(b, xp(m))}`, `y' = ${poly(coefs(m, m * a + b, m * b))}`],
    [good[0], `y' = u'v - uv' = ${m}${xp(m - 1)}(${L}) - ${a}${xp(m)}`, `y' = ${poly(coefs(m, (m - 1) * a, m * b))}`],
    [good[0], good[1], `y' = ${poly(coefs(m, m * a, m * b))}`]
  ];
  return firstError(rng, {
    intro: `A student differentiates $y = ${xp(m)}(${L})$ using the product rule.`,
    versions, because: [null, 'the derivative of $ax + b$ is $a$, not $b$', 'the product rule is $u\'v + uv\'$ (a sum)', 'expanding, the $x^{' + m + '}$ terms are $' + m + 'a + a$, so the term $uv\'$ was dropped'],
    rule: 'Product rule: $(uv)\' = u\'v + uv\'$, then expand carefully.'
  });
} });

// D3 — quotient rule ──────────────────────────────────────────────────────────
function quotientNums(rng, denChoices) {
  let a, b, c, d, x0, den, num;
  do {
    a = nz(rng, -6, 6); b = nz(rng, -7, 7); c = ri(rng, 1, 5); x0 = ri(rng, -3, 3); den = rc(rng, denChoices);
    d = den - c * x0; num = a * d - b * c;
  } while (num === 0 || d === 0);
  return { a, b, c, d, x0, den, num };
}
diffForms.push({ diffs: [3], make: (rng) => {
  const { a, b, c, d, x0, den, num } = quotientNums(rng, [1, -1, 2, -2, 5, -5]);
  const val = r3(num / (den * den));
  agree(val, dnum(x => (a * x + b) / (c * x + d), x0), 'quotient point');
  return {
    prompt: `Find the gradient of $y = \\dfrac{${lin(a, b)}}{${lin(c, d)}}$ at the point where $x = ${x0}$. Give your answer as a decimal.`,
    answerType: 'numeric', answer: { value: val, tol: 0.0011 },
    traps: keepT([
      { value: r3(num / den), why: 'Quotient rule: divide by $v^2$, the *square* of the denominator.' },
      { value: r3(-num / (den * den)), why: 'Order matters: $\\frac{u\'v - uv\'}{v^2}$.' }
    ], val),
    hints: ['Quotient rule: $\\dfrac{u\'v - uv\'}{v^2}$.', `The numerator simplifies to $${a}(${d}) - ${b}(${c}) = ${num}$.`, `The denominator is $(${c * x0 + d})^2$ at $x = ${x0}$.`],
    steps: [
      { h: 'Quotient rule', d: `$y' = \\dfrac{${num}}{(${lin(c, d)})^2}$` },
      { h: 'Substitute', d: `At $x = ${x0}$: $(${lin(c, d)}) = ${den}$` },
      { h: 'Evaluate', d: `$\\dfrac{${num}}{${den * den}} = ${val}$` }
    ]
  };
} });

diffForms.push({ diffs: [3], make: (rng) => {
  const a = ri(rng, 1, 6), s = ri(rng, 1, 9), b = a * s * s;
  const f = x => (a * x * x + b) / x;
  agree(0, dnum(f, s), 'quotient stationary');
  return {
    prompt: `Find the positive $x$-coordinate of the stationary point of $y = \\dfrac{${term(a, 'x', 2)} + ${b}}{x}$.`,
    answerType: 'numeric', answer: { value: s }, answerPrefix: 'x =',
    traps: keepT([
      { value: s * s, why: `Solve $${a}x^2 = ${b}$ and take the square root.` },
      { value: b / a, why: `$x^2 = ${s * s}$: take the square root to find $x$.` }
    ], s),
    hints: ['Quotient rule, then set $y\' = 0$.', `$y' = \\dfrac{${2 * a}x\\cdot x - (${term(a, 'x', 2)} + ${b})}{x^2} = \\dfrac{${term(a, 'x', 2)} - ${b}}{x^2}$.`, 'The numerator must be zero.'],
    steps: [
      { h: 'Quotient rule', d: `$y' = \\dfrac{${term(a, 'x', 2)} - ${b}}{x^2}$` },
      { h: 'Set to zero', d: `$${term(a, 'x', 2)} = ${b} \\Rightarrow x^2 = ${s * s}$` },
      { h: 'Positive root', d: `$x = ${s}$` }
    ]
  };
} });

diffForms.push({ diffs: [3], make: (rng) => {
  const { a, b, c, d, x0, den, num } = quotientNums(rng, [1, -1, 2, -2, 3, -3, 4, -4, 5, -5]);
  agree(dnum(x => (a * x + b) / (c * x + d), x0), num / (den * den), 'quotient missing k');
  return {
    prompt: `The curve $y = \\dfrac{${term(a)} + k}{${lin(c, d)}}$ has gradient $\\dfrac{${a * d - b * c}}{${den * den}}$ at the point where $x = ${x0}$. Find the value of the constant $k$.`,
    answerType: 'numeric', answer: { value: b }, answerPrefix: 'k =',
    traps: keepT([
      { value: -b, why: 'Quotient rule numerator is $u\'v - uv\'$: $a d - k c$.' },
      { value: a * d - b * c, why: 'That is the numerator $ad - kc$, not $k$: solve for $k$.' }
    ], b),
    hints: ['Quotient rule gives $\\dfrac{ad - kc}{(cx + d)^2}$.', `So $\\dfrac{${a}(${d}) - ${c}k}{(${c * x0 + d})^2} = \\dfrac{${a * d - b * c}}{${den * den}}$.`, `The denominators match, so $${a * d} - ${c}k = ${a * d - b * c}$.`],
    steps: [
      { h: 'Quotient rule', d: `$y' = \\dfrac{${a}(${lin(c, d)}) - ${c}(${term(a)} + k)}{(${lin(c, d)})^2} = \\dfrac{${a * d} - ${c}k}{(${lin(c, d)})^2}$` },
      { h: 'Substitute', d: `At $x = ${x0}$ the denominator is $(${den})^2 = ${den * den}$` },
      { h: 'Solve', d: `$${a * d} - ${c}k = ${a * d - b * c} \\Rightarrow k = ${b}$` }
    ]
  };
} });

diffForms.push({ diffs: [3], make: (rng) => {
  let a, b, c, d, t0, den, num;
  do {
    c = ri(rng, 1, 3); t0 = ri(rng, 1, 3); den = rc(rng, [5, 10]); d = den - c * t0;
    a = ri(rng, 1, 9); b = ri(rng, 1, 9); num = a * d - b * c;
  } while (d < 1 || num === 0);
  const val = r3(num / (den * den));
  agree(val, dnum(t => (a * t + b) / (c * t + d), t0), 'quotient context');
  return {
    prompt: `The concentration of a drug in the blood is $C = \\dfrac{${lin(a, b, 't')}}{${lin(c, d, 't')}}$ mg/L, $t$ hours after it is given. Find the rate of change of the concentration after ${pl(t0, 'hour')}, as a decimal. (A negative answer means the concentration is falling.)`,
    answerType: 'numeric', answer: { value: val, tol: 0.0011 }, answerSuffix: 'mg/L per hour',
    traps: keepT([
      { value: r3((a * t0 + b) / den), why: 'That is the concentration itself, not its rate of change.' },
      { value: r3(-num / (den * den)), why: 'Order matters in the quotient rule: $u\'v - uv\'$.' }
    ], val),
    hints: ['Differentiate with the quotient rule.', `$C' = \\dfrac{${a}(${lin(c, d, 't')}) - ${c}(${lin(a, b, 't')})}{(${lin(c, d, 't')})^2} = \\dfrac{${num}}{(${lin(c, d, 't')})^2}$.`, `At $t = ${t0}$ the denominator bracket is $${den}$.`],
    steps: [
      { h: 'Quotient rule', d: `$C' = \\dfrac{${num}}{(${lin(c, d, 't')})^2}$` },
      { h: 'Substitute', d: `$t = ${t0}$: $(${den})^2 = ${den * den}$` },
      { h: 'Rate', d: `$\\dfrac{${num}}{${den * den}} = ${val}$ mg/L per hour` }
    ]
  };
} });

diffForms.push({ diffs: [3], make: (rng) => {
  let a, b, c, d;
  do { a = ri(rng, 2, 7); b = nz(rng, -7, 7); c = ri(rng, 2, 6); d = nz(rng, -7, 7); } while (a * d === b * c);
  const A = lin(a, b), C = lin(c, d);
  const m = mcq(rng, `$\\dfrac{${a * d - b * c}}{(${C})^2}$`, [
    { text: `$\\dfrac{${b * c - a * d}}{(${C})^2}$`, why: 'Order matters: the numerator is $u\'v - uv\'$, not $uv\' - u\'v$.' },
    { text: `$\\dfrac{${a * d + b * c}}{(${C})^2}$`, why: 'The quotient rule *subtracts*: $u\'v - uv\'$.' },
    { text: `$\\dfrac{${a}}{${c}}$`, why: 'Quotient rule is not the quotient of the derivatives.' }
  ]);
  return {
    prompt: `Which expression is $\\dfrac{dy}{dx}$ when $y = \\dfrac{${A}}{${C}}$?`,
    answerType: 'mcq', answer: { correctIndex: m.correctIndex, optionTraps: m.optionTraps }, mcqOptions: m.options,
    hints: ['Quotient rule: $\\dfrac{u\'v - uv\'}{v^2}$.', `$u' = ${a}$, $v' = ${c}$.`, `Numerator: $${a}(${C}) - ${c}(${A})$.`],
    steps: [
      { h: 'Rule', d: `$y' = \\dfrac{u'v - uv'}{v^2}$` },
      { h: 'Numerator', d: `$${a}(${C}) - ${c}(${A}) = ${a * d - b * c}$` },
      { h: 'Result', d: `$y' = \\dfrac{${a * d - b * c}}{(${C})^2}$` }
    ]
  };
} });

diffForms.push({ diffs: [3], make: (rng) => {
  let a, b, c, d;
  do { a = ri(rng, 2, 6); b = nz(rng, -7, 7); c = ri(rng, 2, 6); d = nz(rng, -7, 7); } while (a * d === b * c || (a * c - a * d === 0 && a * d - b * d === 0) || (a * c - a === 0 && a * d - b === 0));
  const A = lin(a, b), C = lin(c, d);
  const l1 = (vp) => `u = ${A},\\; v = ${C} \\;\\Rightarrow\\; u' = ${a},\\; v' = ${vp}`;
  const l2g = `y' = \\dfrac{u'v - uv'}{v^2} = \\dfrac{${cf(a, C)} - ${cf(c, A)}}{(${C})^2}`;
  const l3 = n => `y' = \\dfrac{${n}}{(${C})^2}`;
  const versions = [
    [l1(c), l2g, l3(String(a * d - b * c))],
    [l1(d), `y' = \\dfrac{u'v - uv'}{v^2} = \\dfrac{${cf(a, C)} ${d < 0 ? '+' : '-'} ${cf(Math.abs(d), A)}}{(${C})^2}`, l3(poly([a * c - a * d, a * d - b * d]))],
    [l1(c), `y' = \\dfrac{uv' - u'v}{v^2} = \\dfrac{${cf(c, A)} - ${cf(a, C)}}{(${C})^2}`, l3(String(b * c - a * d))],
    [l1(c), l2g, l3(String(a * d + b * c))]
  ];
  return firstError(rng, {
    intro: `A student differentiates $y = \\dfrac{${A}}{${C}}$ using the quotient rule.`,
    versions, because: [null, 'the derivative of $cx + d$ is $c$, not $d$', 'the numerator is $u\'v - uv\'$, in that order', 'in the numerator $acx + ad - acx - bc$, so the result is $ad - bc$ (subtract, do not add)'],
    rule: 'Quotient rule: $\\left(\\dfrac{u}{v}\\right)\' = \\dfrac{u\'v - uv\'}{v^2}$.'
  });
} });

// D4 — chain rule with a quadratic inner function ──────────────────────────────
diffForms.push({ diffs: [4], make: (rng) => {
  let a, b, c, n, x0, s, val;
  do { a = ri(rng, 1, 3); b = nz(rng, -4, 4); c = nz(rng, -6, 6); n = ri(rng, 2, 4); x0 = ri(rng, -3, 3); s = a * x0 * x0 + b * x0 + c; val = n * s ** (n - 1) * (2 * a * x0 + b); } while (s === 0 || val === 0 || Math.abs(s) > 9);
  agree(val, dnum(x => (a * x * x + b * x + c) ** n, x0), 'chain quad point');
  const L = poly([a, b, c]);
  return {
    prompt: `Find the gradient of the curve $y = ${pw(L, n)}$ at the point where $x = ${x0}$.`,
    answerType: 'numeric', answer: { value: val },
    traps: keepT([
      { value: n * s ** (n - 1), why: `Chain rule: multiply by the inner derivative $${2 * a}x ${sgn(b)}$ evaluated at $x = ${x0}$.` },
      { value: n * s ** (n - 1) * (2 * a), why: `The inner derivative is $${2 * a}x ${sgn(b)}$ — substitute $x = ${x0}$ into it as well.` }
    ], val),
    hints: ['Chain rule with a quadratic inside.', `$y' = ${n}${pw(L, n - 1)}\\times(${lin(2 * a, b)})$.`, `At $x = ${x0}$: bracket $= ${s}$ and inner derivative $= ${2 * a * x0 + b}$.`],
    steps: [
      { h: 'Chain rule', d: `$y' = ${n}${pw(L, n - 1)}(${lin(2 * a, b)})$` },
      { h: 'Evaluate the parts', d: `bracket $= ${s}$, inner derivative $= ${2 * a * x0 + b}$` },
      { h: 'Substitute', d: `$${n}\\times ${s}^{${n - 1}}\\times ${2 * a * x0 + b} = ${val}$` }
    ]
  };
} });

diffForms.push({ diffs: [4], make: (rng) => {
  let a, b, x0, s, sRoot;
  do { a = ri(rng, 1, 5); x0 = nz(rng, -6, 6); sRoot = rc(rng, [1, 2, 4, 5, 8, 10]); b = sRoot * sRoot - a * x0 * x0; } while (b === 0);
  const val = r3(a * x0 / sRoot);
  agree(val, dnum(x => Math.sqrt(a * x * x + b), x0), 'sqrt point');
  s = sRoot;
  return {
    prompt: `Find the gradient of $y = \\sqrt{${poly([a, 0, b])}}$ at the point where $x = ${x0}$. Give your answer as a decimal.`,
    answerType: 'numeric', answer: { value: val, tol: 0.0011 },
    traps: keepT([
      { value: r3(a * x0 / (s * s)), why: `$\\sqrt{${s * s}} = ${s}$: halve the $2$ with the $\\dfrac{1}{2\\sqrt{\\ }}$ rule, giving $\\dfrac{${2 * a * x0}}{${2 * s}}$.` },
      { value: r3(2 * a * x0 / s), why: 'The derivative of $\\sqrt{u}$ is $\\dfrac{u\'}{2\\sqrt{u}}$ — do not forget the 2 in the denominator.' }
    ], val),
    hints: ['Write $y = (\\ldots)^{1/2}$ and use the chain rule.', `$y' = \\dfrac{${2 * a}x}{2\\sqrt{${poly([a, 0, b])}}}$.`, `At $x = ${x0}$ the square root equals $${s}$.`],
    steps: [
      { h: 'Chain rule', d: `$y' = \\dfrac{1}{2}(${poly([a, 0, b])})^{-1/2}\\times ${2 * a}x = \\dfrac{${a}x}{\\sqrt{${poly([a, 0, b])}}}$` },
      { h: 'Substitute', d: `$\\sqrt{${a * x0 * x0 + b}} = ${s}$` },
      { h: 'Evaluate', d: `$y'(${x0}) = \\dfrac{${a * x0}}{${s}} = ${val}$` }
    ]
  };
} });

diffForms.push({ diffs: [4], make: (rng) => {
  let a, b, n, x0, s, val;
  do { a = ri(rng, 1, 4); b = nz(rng, -6, 6); n = ri(rng, 2, 3); x0 = nz(rng, -3, 3); s = a * x0 * x0 + b; val = s ** n + 2 * n * a * x0 * x0 * s ** (n - 1); } while (s === 0 || val === 0 || Math.abs(s) > 8);
  agree(val, dnum(x => x * (a * x * x + b) ** n, x0), 'x chain point');
  const L = poly([a, 0, b]);
  return {
    prompt: `Find the gradient of $y = x${pw(L, n)}$ at the point where $x = ${x0}$.`,
    answerType: 'numeric', answer: { value: val },
    traps: keepT([
      { value: x0 * n * s ** (n - 1) * 2 * a * x0, why: 'Product rule: add the term $u\'v$ — from differentiating the factor $x$.' },
      { value: s ** n + n * s ** (n - 1) * 2 * a * x0, why: `In $uv'$ the factor $x$ multiplies the chain-rule term $${n}${pw(L, n - 1)}\\times ${2 * a}x$.` }
    ], val),
    hints: ['Product rule, with the chain rule for the bracket.', `$y' = ${pw(L, n)} + x\\times ${n}${pw(L, n - 1)}\\times ${2 * a}x$.`, `At $x = ${x0}$ the bracket equals $${s}$.`],
    steps: [
      { h: 'Product rule', d: `$y' = 1\\cdot${pw(L, n)} + x\\cdot ${n}${pw(L, n - 1)}(${2 * a}x)$` },
      { h: 'Substitute', d: `bracket $= ${s}$, $x = ${x0}$` },
      { h: 'Evaluate', d: `$${s}^{${n}} + ${2 * n * a * x0 * x0}\\times ${s}^{${n - 1}} = ${val}$` }
    ]
  };
} });

diffForms.push({ diffs: [4], make: (rng) => {
  const a = ri(rng, 1, 7), b = nz(rng, -9, 9), n = ri(rng, 3, 6);
  const L = poly([a, 0, b]);
  const m = mcq(rng, `$${2 * n * a}x${pw(L, n - 1)}$`, [
    { text: `$${n}${pw(L, n - 1)}$`, why: `Multiply by the inner derivative $${2 * a}x$.` },
    { text: `$${n * a}x${pw(L, n - 1)}$`, why: `The derivative of $${term(a, 'x', 2)}$ is $${2 * a}x$, not $${a}x$.` },
    { text: `$${2 * a}x${pw(L, n - 1)}$`, why: `Bring the power $${n}$ down as well.` }
  ]);
  return {
    prompt: `Which expression is $\\dfrac{dy}{dx}$ for $y = ${pw(L, n)}$?`,
    answerType: 'mcq', answer: { correctIndex: m.correctIndex, optionTraps: m.optionTraps }, mcqOptions: m.options,
    hints: ['Outer derivative times inner derivative.', `Inner: $\\dfrac{d}{dx}(${L}) = ${2 * a}x$.`, `Outer: $${n}(\\ldots)^{${n - 1}}$.`],
    steps: [
      { h: 'Outer', d: `$${n}${pw(L, n - 1)}$` },
      { h: 'Inner', d: `$${2 * a}x$` },
      { h: 'Multiply', d: `$\\dfrac{dy}{dx} = ${2 * n * a}x${pw(L, n - 1)}$` }
    ]
  };
} });

diffForms.push({ diffs: [4], make: (rng) => {
  let a, k, x0, V;
  do { a = ri(rng, 1, 3); k = nz(rng, -9, 9); x0 = nz(rng, -4, 4); V = 4 * a * x0 * (a * x0 * x0 + k); } while (a * x0 * x0 + k === 0);
  agree(dnum(x => (a * x * x + k) ** 2, x0), V, 'chain quad missing k');
  return {
    prompt: `The curve $y = (${term(a, 'x', 2)} + k)^2$ has gradient $${V}$ at the point where $x = ${x0}$. Find the value of the constant $k$.`,
    answerType: 'numeric', answer: { value: k }, answerPrefix: 'k =',
    traps: keepT([
      { value: V / (4 * a * x0), why: `That is $${term(a, 'x', 2)} + k$ at the point: subtract $${a * x0 * x0}$ to leave $k$.` },
      { value: V / (2 * a * x0) - a * x0 * x0, why: 'Chain rule: $y\' = 2(\\ldots)\\times 2ax$, so the factor is $4ax$, not $2ax$.' }
    ], k),
    hints: ['Differentiate first, in terms of $k$.', `$y' = 2(${term(a, 'x', 2)} + k)(${2 * a}x) = ${4 * a}x(${term(a, 'x', 2)} + k)$.`, `Substitute $x = ${x0}$ and $y' = ${V}$.`],
    steps: [
      { h: 'Differentiate', d: `$y' = ${4 * a}x(${term(a, 'x', 2)} + k)$` },
      { h: 'Substitute', d: `$${4 * a * x0}(${a * x0 * x0} + k) = ${V}$` },
      { h: 'Solve', d: `$${a * x0 * x0} + k = ${V / (4 * a * x0)} \\Rightarrow k = ${k}$` }
    ]
  };
} });

diffForms.push({ diffs: [4], make: (rng) => {
  const a = ri(rng, 1, 9), b = ri(rng, 1, 20), t0 = ri(rng, 1, 9), n = ri(rng, 2, 3);
  const s = a * t0 * t0 + b;
  const val = agree(2 * n * a * t0 * s ** (n - 1), dnum(t => (a * t * t + b) ** n, t0), 'chain quad context');
  const L = poly([a, 0, b], 't');
  return {
    prompt: `The number of bacteria in a culture, in thousands, is $N = ${pw(L, n)}$, where $t$ is the time in hours. Find the rate at which the population is growing after ${pl(t0, 'hour')}, in thousands of bacteria per hour.`,
    answerType: 'numeric', answer: { value: val }, answerSuffix: 'thousand per hour',
    traps: keepT([
      { value: n * s ** (n - 1), why: `Multiply by the inner derivative $${2 * a}t$.` },
      { value: s ** n, why: 'That is the population, not its rate of growth.' }
    ], val),
    hints: ['The rate of growth is $\\dfrac{dN}{dt}$.', `$\\dfrac{dN}{dt} = ${2 * n * a}t${pw(L, n - 1)}$.`, `At $t = ${t0}$ the bracket equals $${s}$.`],
    steps: [
      { h: 'Differentiate', d: `$\\dfrac{dN}{dt} = ${n}${pw(L, n - 1)}\\times ${2 * a}t$` },
      { h: 'Substitute', d: `$t = ${t0}$: bracket $= ${s}$` },
      { h: 'Rate', d: `$${2 * n * a * t0}\\times ${s}^{${n - 1}} = ${val}$ thousand per hour` }
    ]
  };
} });

diffForms.push({ diffs: [4], make: (rng) => {
  let a, b, n;
  do { a = ri(rng, 2, 6); b = nz(rng, -9, 9); n = ri(rng, 3, 5); } while (a === 2 * a);
  const L = poly([a, 0, b]);
  const v = chainVersions({ n, L, d: `${2 * a}x`, dBad: `${a}x`, coef: `${2 * n * a}x`, coefBad: `${n * a}x` });
  return firstError(rng, {
    intro: `A student differentiates $y = ${pw(L, n)}$ using the chain rule.`,
    versions: v, because: chainBecause, rule: 'Chain rule: $\\dfrac{dy}{dx} = \\dfrac{dy}{du}\\times\\dfrac{du}{dx}$.'
  });
} });

// ═════════════════════════════════════════════════════════════════════════════
// y12-appdiff
// ═════════════════════════════════════════════════════════════════════════════
const appForms = [];

// D1 — stationary points ─────────────────────────────────────────────────────
appForms.push({ diffs: [1], make: (rng) => {
  let a, h, c, val;
  do { a = nz(rng, -4, 4); h = nz(rng, -6, 6); c = ri(rng, -12, 12); val = c - a * h * h; } while (val === 0);
  const f = x => a * x * x - 2 * a * h * x + c;
  agree(0, dnum(f, h), 'vertex x');
  agree(val, f(h), 'vertex y');
  return {
    prompt: `The curve $y = ${poly([a, -2 * a * h, c])}$ has one stationary point. Find its $y$-coordinate.`,
    answerType: 'numeric', answer: { value: val }, answerPrefix: 'y =',
    traps: keepT([
      { value: h, why: 'That is the $x$-coordinate of the stationary point: substitute it back into the curve.' },
      { value: c, why: 'That is the $y$-intercept, not the value at the stationary point.' }
    ], val),
    hints: ['Solve $y\' = 0$ for $x$ first.', `$y' = ${lin(2 * a, -2 * a * h)} = 0$ gives $x = ${h}$.`, `Substitute $x = ${h}$ into $y$.`],
    steps: [
      { h: 'Differentiate', d: `$y' = ${lin(2 * a, -2 * a * h)}$` },
      { h: 'Stationary $x$', d: `$x = ${h}$` },
      { h: 'Find $y$', d: `$y(${h}) = ${val}$` }
    ]
  };
} });

const cubicParts = rng => {
  let A, p, q;
  do { A = rc(rng, [2, 4, 6]); p = ri(rng, -7, 7); q = ri(rng, -7, 7); } while (p === q);
  return { A, p, q, B: (-3 * A * (p + q)) / 2, C: 3 * A * p * q };
};
appForms.push({ diffs: [1], make: (rng) => {
  const { A, p, q, B, C } = cubicParts(rng);
  const f = x => A * x ** 3 + B * x * x + C * x;
  agree(0, dnum(f, p), 'cubic p'); agree(0, dnum(f, q), 'cubic q');
  const key = Math.max(p, q);
  return {
    prompt: `The curve $y = ${poly([A, B, C, 0])}$ has two stationary points. Find the **larger** $x$-coordinate.`,
    answerType: 'numeric', answer: { value: key }, answerPrefix: 'x =',
    traps: keepT([
      { value: Math.min(p, q), why: 'That is the smaller $x$-coordinate: the question asks for the larger one.' },
      { value: p + q, why: 'That is the sum of the $x$-coordinates, not the larger one.' }
    ], key),
    hints: ['Stationary points: solve $y\' = 0$.', `$y' = ${poly([3 * A, 2 * B, C])} = 0$; divide by ${3 * A}.`, `$(x ${sgn(-p)})(x ${sgn(-q)}) = 0$.`],
    steps: [
      { h: 'Differentiate', d: `$y' = ${poly([3 * A, 2 * B, C])}$` },
      { h: 'Factorise', d: `$${3 * A}(x ${sgn(-p)})(x ${sgn(-q)}) = 0$` },
      { h: 'Larger root', d: `$x = ${key}$` }
    ]
  };
} });

appForms.push({ diffs: [1], make: (rng) => {
  let A, p, q, B, C, which, key;
  do {
    ({ A, p, q, B, C } = cubicParts(rng)); A = rc(rng, [2, 4]); B = (-3 * A * (p + q)) / 2; C = 3 * A * p * q;
    p = ri(rng, -4, 4); q = ri(rng, -4, 4); B = (-3 * A * (p + q)) / 2; C = 3 * A * p * q;
    which = rc(rng, ['larger', 'smaller']); const xs = which === 'larger' ? Math.max(p, q) : Math.min(p, q);
    key = A * xs ** 3 + B * xs * xs + C * xs;
  } while (p === q || key === 0);
  const xs = which === 'larger' ? Math.max(p, q) : Math.min(p, q);
  agree(key, simpson(t => 3 * A * (t - p) * (t - q), 0, xs), 'cubic stationary value');
  return {
    prompt: `The curve $y = ${poly([A, B, C, 0])}$ has two stationary points. Find the $y$-coordinate of the one with the ${which} $x$-coordinate.`,
    answerType: 'numeric', answer: { value: key }, answerPrefix: 'y =',
    traps: keepT([
      { value: xs, why: 'That is the $x$-coordinate: substitute it into the curve to get $y$.' },
      { value: A * (which === 'larger' ? Math.min(p, q) : Math.max(p, q)) ** 3 + B * (which === 'larger' ? Math.min(p, q) : Math.max(p, q)) ** 2 + C * (which === 'larger' ? Math.min(p, q) : Math.max(p, q)), why: `Use the ${which} $x$-coordinate, $x = ${xs}$.` }
    ], key),
    hints: ['Find the stationary $x$-values from $y\' = 0$.', `They are $x = ${p}$ and $x = ${q}$.`, `Substitute $x = ${xs}$ into $y$.`],
    steps: [
      { h: 'Stationary $x$-values', d: `$y' = ${poly([3 * A, 2 * B, C])} = 0 \\Rightarrow x = ${p}, ${q}$` },
      { h: 'Choose', d: `The ${which} is $x = ${xs}$` },
      { h: 'Substitute', d: `$y(${xs}) = ${key}$` }
    ]
  };
} });

appForms.push({ diffs: [1], make: (rng) => {
  let b, p, k;
  do { b = nz(rng, -6, 6); p = nz(rng, -4, 4); k = -3 * p * p - 2 * b * p; } while (k === 0);
  agree(0, dnum(x => x ** 3 + b * x * x + k * x, p), 'missing k stationary');
  return {
    prompt: `The curve $y = x^3 ${addT(b, 'x^2')} + kx$ has a stationary point at $x = ${p}$. Find the value of $k$.`,
    answerType: 'numeric', answer: { value: k }, answerPrefix: 'k =',
    traps: keepT([
      { value: 3 * p * p + 2 * b * p, why: 'Set $y\' = 0$: $3p^2 + 2bp + k = 0$, so $k$ is the *negative* of $3p^2 + 2bp$.' },
      { value: -2 * b * p, why: `The derivative of $x^3$ also contributes: $3(${p})^2$.` }
    ], k),
    hints: ['A stationary point means $\\dfrac{dy}{dx} = 0$.', `$y' = 3x^2 ${sgn(2 * b)}x + k$.`, `Substitute $x = ${p}$ and set it to zero.`],
    steps: [
      { h: 'Differentiate', d: `$y' = 3x^2 ${sgn(2 * b)}x + k$` },
      { h: 'Substitute $x = ' + p + '$', d: `$${3 * p * p} ${sgn(2 * b * p)} + k = 0$` },
      { h: 'Solve', d: `$k = ${k}$` }
    ]
  };
} });

appForms.push({ diffs: [1], make: (rng) => {
  const A = nz(rng, -4, 4), p = nz(rng, -6, 6), k = nz(rng, -9, 9);
  const m = mcq(rng, 'A horizontal point of inflexion', [
    { text: 'A local minimum', why: `$y'' = ${6 * A}(x ${sgn(-p)})$ is zero at $x = ${p}$ and changes sign: the concavity changes, so it is not a turning point.` },
    { text: 'A local maximum', why: 'The gradient does not change sign through the stationary point, so it is not a turning point.' },
    { text: 'A vertical point of inflexion', why: 'The tangent is horizontal here ($y\' = 0$), not vertical.' }
  ]);
  return {
    prompt: `The curve $y = ${lead(A)}(x ${sgn(-p)})^3 ${sgn(k)}$ has $\\dfrac{dy}{dx} = 0$ at $x = ${p}$. What is the nature of this stationary point?`,
    answerType: 'mcq', answer: { correctIndex: m.correctIndex, optionTraps: m.optionTraps }, mcqOptions: m.options,
    hints: ['Test the sign of $\\dfrac{dy}{dx}$ either side, or look at $\\dfrac{d^2y}{dx^2}$.', `$y' = ${3 * A}(x ${sgn(-p)})^2 \\ge 0$ on both sides.`, `$y'' = ${6 * A}(x ${sgn(-p)})$ changes sign at $x = ${p}$.`],
    steps: [
      { h: 'Gradient either side', d: `$y' = ${3 * A}(x ${sgn(-p)})^2$ has the same sign on both sides of $x = ${p}$` },
      { h: 'Concavity', d: `$y'' = ${6 * A}(x ${sgn(-p)})$ changes sign at $x = ${p}$` },
      { h: 'Conclusion', d: 'Horizontal point of inflexion' }
    ]
  };
} });

appForms.push({ diffs: [1], make: (rng) => {
  const b = ri(rng, -6, 6), c = ri(rng, -12, 12), d = nz(rng, -9, 9);
  const disc = 4 * b * b - 12 * c;
  const f1 = x => 3 * x * x + 2 * b * x + c;
  let changes = 0, prev = Math.sign(f1(-60.0001));
  for (let x = -60; x <= 60; x += 0.001) { const sg = Math.sign(f1(x + 1e-7)); if (sg !== 0 && prev !== 0 && sg !== prev) changes++; if (sg !== 0) prev = sg; }
  const count = disc > 0 ? 2 : disc === 0 ? 1 : 0;
  const words = ['None', 'One', 'Two', 'Three'];
  if (disc === 0 ? f1(-b / 3) !== 0 : changes !== count) throw new Error('adv12-a stationary count mismatch');
  const m = mcq(rng, words[count], words.filter((_, i) => i !== count).map(t => ({
    text: t,
    why: t === 'Three' ? 'A cubic has a *quadratic* derivative, so at most two stationary points.' : `$y' = ${poly([3, 2 * b, c])}$ has discriminant $${disc}$: ${disc > 0 ? 'two real roots' : disc === 0 ? 'one repeated root' : 'no real roots'}.`
  })));
  return {
    prompt: `How many stationary points does the curve $y = ${poly([1, b, c, d])}$ have?`,
    answerType: 'mcq', answer: { correctIndex: m.correctIndex, optionTraps: m.optionTraps }, mcqOptions: m.options,
    hints: ['Stationary points are the real solutions of $y\' = 0$.', `$y' = ${poly([3, 2 * b, c])}$.`, 'Use the discriminant $\\Delta = b^2 - 4ac$ of this quadratic.'],
    steps: [
      { h: 'Differentiate', d: `$y' = ${poly([3, 2 * b, c])}$` },
      { h: 'Discriminant', d: `$\\Delta = (${2 * b})^2 - 4(3)(${c}) = ${disc}$` },
      { h: 'Count', d: `${disc > 0 ? '$\\Delta > 0$: two real roots' : disc === 0 ? '$\\Delta = 0$: one repeated root' : '$\\Delta < 0$: no real roots'}, so **${words[count].toLowerCase()}** stationary point${count === 1 ? '' : 's'}` }
    ]
  };
} });

appForms.push({ diffs: [1], make: (rng) => {
  const v = ri(rng, 1, 8) * 10, h0 = ri(rng, 1, 30), key = v / 10;
  const h = t => -5 * t * t + v * t + h0;
  agree(0, dnum(h, key), 'ball time');
  return {
    prompt: `A ball is thrown upward so that its height is $h = ${poly([-5, v, h0], 't')}$ metres after $t$ seconds. At what time does the ball reach its maximum height?`,
    answerType: 'numeric', answer: { value: key }, answerSuffix: 's',
    traps: keepT([
      { value: h(key), why: 'That is the maximum height, not the time at which it occurs.' },
      { value: v, why: `Set $h' = ${v} - 10t = 0$ and solve for $t$.` }
    ], key),
    hints: ['Maximum height occurs where $\\dfrac{dh}{dt} = 0$.', `$\\dfrac{dh}{dt} = ${v} - 10t$.`, 'Solve for $t$.'],
    steps: [
      { h: 'Differentiate', d: `$h' = ${v} - 10t$` },
      { h: 'Set to zero', d: `$${v} - 10t = 0$` },
      { h: 'Solve', d: `$t = ${key}$ seconds` }
    ]
  };
} });

// D2 — nature of stationary points ──────────────────────────────────────────────
appForms.push({ diffs: [2], make: (rng) => {
  const a = rc(rng, [-3, -2, -1, 1, 2, 3]), mm = nz(rng, -5, 5), c = ri(rng, -9, 9), d = ri(rng, -9, 9);
  const b = 3 * a * mm;
  agree(0, 6 * a * -mm + 2 * b, 'inflexion');
  return {
    prompt: `Find the $x$-coordinate of the point of inflexion of the curve $y = ${poly([a, b, c, d])}$.`,
    answerType: 'numeric', answer: { value: -mm }, answerPrefix: 'x =',
    traps: keepT([
      { value: mm, why: `Solve $y'' = ${6 * a}x ${sgn(2 * b)} = 0$: the sign matters.` },
      { value: -b / a, why: `$y'' = ${6 * a}x ${sgn(2 * b)}$, so $x = -\\dfrac{${2 * b}}{${6 * a}}$.` }
    ], -mm),
    hints: ['A point of inflexion is where $y\'\'= 0$ and the concavity changes.', `$y'' = ${lin(6 * a, 2 * b)}$.`, 'Solve $y\'\' = 0$.'],
    steps: [
      { h: 'First derivative', d: `$y' = ${poly([3 * a, 2 * b, c])}$` },
      { h: 'Second derivative', d: `$y'' = ${lin(6 * a, 2 * b)}$` },
      { h: 'Solve $y\'\' = 0$', d: `$x = ${-mm}$ (the sign of $y''$ changes here)` }
    ]
  };
} });

appForms.push({ diffs: [2], make: (rng) => {
  const p = nz(rng, -8, 8);
  const pat = rc(rng, [['negative', 'positive', 'A local minimum'], ['positive', 'negative', 'A local maximum'], ['positive', 'positive', 'A horizontal point of inflexion'], ['negative', 'negative', 'A horizontal point of inflexion']]);
  const names = ['A local minimum', 'A local maximum', 'A horizontal point of inflexion'];
  const m = mcq(rng, pat[2], names.filter(n => n !== pat[2]).map(n => ({
    text: n,
    why: n === 'A horizontal point of inflexion' ? 'The gradient changes sign through a turning point; here it does not change sign at all in the other cases — check the signs given.' : 'Check the direction of the sign change: negative to positive is a minimum, positive to negative is a maximum.'
  })));
  return {
    prompt: `For a function $f$, $f'(${p}) = 0$. The gradient $f'(x)$ is ${pat[0]} just to the left of $x = ${p}$ and ${pat[1]} just to the right. What is the nature of the stationary point at $x = ${p}$?`,
    answerType: 'mcq', answer: { correctIndex: m.correctIndex, optionTraps: m.optionTraps }, mcqOptions: m.options,
    hints: ['Look at how the sign of $f\'$ changes through the point.', 'Negative then positive: the curve falls then rises.', 'No sign change: the curve keeps rising (or falling) through a flat point.'],
    steps: [
      { h: 'Sign pattern', d: `Left of $x = ${p}$: ${pat[0]}; right: ${pat[1]}` },
      { h: 'Interpret', d: pat[2] }
    ]
  };
} });

appForms.push({ diffs: [2], make: (rng) => {
  const p = nz(rng, -6, 6), v = rc(rng, [-6, -4, -3, -2, -1, 0, 1, 2, 3, 4, 6]);
  const correct = v > 0 ? 'A local minimum' : v < 0 ? 'A local maximum' : 'The test is inconclusive: check the sign of $f\'$ either side';
  const all = ['A local minimum', 'A local maximum', 'A horizontal point of inflexion', 'The test is inconclusive: check the sign of $f\'$ either side'];
  const m = mcq(rng, correct, all.filter(t => t !== correct).map(t => ({
    text: t,
    why: v === 0 ? '$f\'\'(x) = 0$ does not decide the nature: the second derivative test fails, so look at the sign of $f\'$ either side.' : `$f''(${p}) = ${v}$ is ${v > 0 ? 'positive, so the curve is concave up' : 'negative, so the curve is concave down'}.`
  })));
  return {
    prompt: `A function $f$ satisfies $f'(${p}) = 0$ and $f''(${p}) = ${v}$. What can be concluded about the stationary point at $x = ${p}$?`,
    answerType: 'mcq', answer: { correctIndex: m.correctIndex, optionTraps: m.optionTraps }, mcqOptions: m.options,
    hints: ['Use the second derivative test.', '$f\'\'>0$: concave up (minimum). $f\'\'<0$: concave down (maximum).', '$f\'\'= 0$ is inconclusive.'],
    steps: [
      { h: 'Second derivative', d: `$f''(${p}) = ${v}$` },
      { h: 'Interpret', d: v === 0 ? 'Zero: the test is inconclusive' : v > 0 ? 'Positive: concave up, a minimum' : 'Negative: concave down, a maximum' }
    ]
  };
} });

appForms.push({ diffs: [2], make: (rng) => {
  const a = ri(rng, 1, 5), h = nz(rng, -8, 8), c = ri(rng, -9, 9);
  agree(0, dnum(x => a * x * x - 2 * a * h * x + c, h), 'increasing for x>k');
  return {
    prompt: `The curve $y = ${poly([a, -2 * a * h, c])}$ is increasing for all $x > k$ and decreasing for all $x < k$. Find the value of $k$.`,
    answerType: 'numeric', answer: { value: h }, answerPrefix: 'k =',
    traps: keepT([
      { value: -h, why: `Solve $y' = ${lin(2 * a, -2 * a * h)} = 0$; check the sign.` },
      { value: a * h * h * -1 + c, why: 'That is the minimum value of $y$, not the $x$-value where the gradient changes sign.' }
    ], h),
    hints: ['The gradient changes sign where $y\' = 0$.', `$y' = ${lin(2 * a, -2 * a * h)}$.`, 'Solve $y\' = 0$.'],
    steps: [
      { h: 'Differentiate', d: `$y' = ${lin(2 * a, -2 * a * h)}$` },
      { h: 'Gradient is zero', d: `$x = ${h}$` },
      { h: 'Check', d: `$y' < 0$ for $x < ${h}$ and $y' > 0$ for $x > ${h}$, so $k = ${h}$` }
    ]
  };
} });

appForms.push({ diffs: [2], make: (rng) => {
  let a, x0, mSlope, b;
  do { a = nz(rng, -4, 4); x0 = ri(rng, -4, 4); mSlope = rc(rng, [-5, -4, -2, -1, 1, 2, 4, 5]); b = mSlope - 2 * a * x0; } while (b === 0);
  const c = ri(rng, -9, 9);
  const key = r3(-1 / mSlope);
  agree(dnum(x => a * x * x + b * x + c, x0), mSlope, 'normal slope');
  return {
    prompt: `Find the gradient of the normal to the curve $y = ${poly([a, b, c])}$ at the point where $x = ${x0}$. Give your answer as a decimal.`,
    answerType: 'numeric', answer: { value: key, tol: 0.0011 },
    traps: keepT([
      { value: mSlope, why: 'That is the gradient of the tangent: the normal is perpendicular to it.' },
      { value: r3(1 / mSlope), why: 'Perpendicular gradients multiply to $-1$: negate the reciprocal.' },
      { value: -mSlope, why: 'The normal gradient is $-\\dfrac{1}{m}$, not $-m$.' }
    ], key),
    hints: ['Find the gradient of the tangent first.', `$y' = ${lin(2 * a, b)}$, so $m = ${mSlope}$ at $x = ${x0}$.`, 'Normal gradient $= -\\dfrac{1}{m}$.'],
    steps: [
      { h: 'Tangent gradient', d: `$y' = ${lin(2 * a, b)} \\Rightarrow m = ${mSlope}$` },
      { h: 'Perpendicular', d: `$m_{\\text{normal}} = -\\dfrac{1}{${mSlope}}$` },
      { h: 'Decimal', d: `$${key}$` }
    ]
  };
} });

appForms.push({ diffs: [2], make: (rng) => {
  let a, b, c, x0, val;
  do { a = nz(rng, -3, 3); b = nz(rng, -5, 5); c = nz(rng, -6, 6); x0 = ri(rng, -3, 3); val = 12 * a * x0 * x0 + 6 * b * x0 + 2 * c; } while (val === 0);
  agree(val, dnum(x => 4 * a * x ** 3 + 3 * b * x * x + 2 * c * x, x0), 'second derivative');
  return {
    prompt: `Find the value of $\\dfrac{d^2y}{dx^2}$ at $x = ${x0}$ for $y = ${poly([a, b, c, 0, 0])}$.`,
    answerType: 'numeric', answer: { value: val },
    traps: keepT([
      { value: 4 * a * x0 ** 3 + 3 * b * x0 * x0 + 2 * c * x0, why: 'That is the first derivative: differentiate once more.' },
      { value: a * x0 ** 4 + b * x0 ** 3 + c * x0 * x0, why: 'That is $y$ itself: differentiate twice, then substitute.' }
    ], val),
    hints: ['Differentiate twice, then substitute $x$.', `$y' = ${poly([4 * a, 3 * b, 2 * c, 0])}$.`, `$y'' = ${poly([12 * a, 6 * b, 2 * c])}$.`],
    steps: [
      { h: 'First derivative', d: `$y' = ${poly([4 * a, 3 * b, 2 * c, 0])}$` },
      { h: 'Second derivative', d: `$y'' = ${poly([12 * a, 6 * b, 2 * c])}$` },
      { h: 'Substitute', d: `$y''(${x0}) = ${val}$` }
    ]
  };
} });

// D4 — optimisation ─────────────────────────────────────────────────────────────
appForms.push({ diffs: [4], make: (rng) => {
  const k = ri(rng, 2, 15), L = 6 * k, key = 16 * k ** 3;
  let best = 0; for (let x = 0.01; x < L / 2; x += 0.01) best = Math.max(best, x * (L - 2 * x) ** 2);
  agree(key, best, 'open box');
  return {
    prompt: `A square sheet of cardboard has side $${L}$ cm. A square of side $x$ cm is cut from each corner and the sides are folded up to make an open box. Find the **maximum volume** of the box, in cm³.`,
    answerType: 'numeric', answer: { value: key }, answerSuffix: 'cm³',
    traps: keepT([
      { value: k, why: `$x = ${k}$ is the side of the cut-out square, not the volume.` },
      { value: L * L * k, why: 'The base of the box is $(L - 2x)$ by $(L - 2x)$, not the whole sheet.' }
    ], key),
    hints: [`The base is $(${L} - 2x)$ by $(${L} - 2x)$ and the height is $x$.`, `$V = x(${L} - 2x)^2$.`, `$V' = (${L} - 2x)(${L} - 6x) = 0$ gives $x = ${k}$ (the other root gives zero volume).`],
    steps: [
      { h: 'Model', d: `$V(x) = x(${L} - 2x)^2$` },
      { h: 'Differentiate', d: `$V'(x) = (${L} - 2x)(${L} - 6x)$` },
      { h: 'Stationary point', d: `$x = ${k}$ (since $x = ${L / 2}$ gives $V = 0$)` },
      { h: 'Volume', d: `$V = ${k}(${L - 2 * k})^2 = ${key}$ cm³` }
    ]
  };
} });

appForms.push({ diffs: [4], make: (rng) => {
  const s = ri(rng, 3, 40), A = s * s, key = 4 * s;
  let best = 1e9; for (let x = 0.05; x < 2 * s + 20; x += 0.05) best = Math.min(best, 2 * (x + A / x));
  agree(key, best, 'min perimeter');
  return {
    prompt: `A rectangular enclosure must have area $${A}$ m². Find the **minimum** perimeter, in metres.`,
    answerType: 'numeric', answer: { value: key }, answerSuffix: 'm',
    traps: keepT([
      { value: A, why: 'That is the fixed area, not the perimeter.' },
      { value: 2 * (A + 1), why: 'Do not use a $1\\times$ length rectangle: minimise $P = 2x + \\dfrac{2' + A + '}{x}$ using calculus.' }
    ], key),
    hints: [`If the width is $x$ then the length is $\\dfrac{${A}}{x}$.`, `$P = 2x + \\dfrac{${2 * A}}{x}$.`, `$P' = 2 - \\dfrac{${2 * A}}{x^2} = 0$ gives $x = ${s}$.`],
    steps: [
      { h: 'Model', d: `$P(x) = 2x + \\dfrac{${2 * A}}{x}$` },
      { h: 'Differentiate', d: `$P'(x) = 2 - \\dfrac{${2 * A}}{x^2}$` },
      { h: 'Stationary point', d: `$x^2 = ${A} \\Rightarrow x = ${s}$ (a minimum since $P'' > 0$)` },
      { h: 'Minimum perimeter', d: `$P = 2(${s}) + 2(${s}) = ${key}$ m` }
    ]
  };
} });

appForms.push({ diffs: [4], make: (rng) => {
  const v = 2 * ri(rng, 2, 20), h0 = ri(rng, 0, 30), key = r2(h0 + (v * v) / 20);
  const h = t => -5 * t * t + v * t + h0;
  let best = -1e9; for (let t = 0; t < v / 5 + 1; t += 0.001) best = Math.max(best, h(t));
  agree(key, best, 'ball max height');
  return {
    prompt: `A ball is thrown upward so that its height above the ground is $h = ${poly([-5, v, h0], 't')}$ metres after $t$ seconds. Find the maximum height reached, in metres.`,
    answerType: 'numeric', answer: { value: key }, answerSuffix: 'm',
    traps: keepT([
      { value: v / 10, why: 'That is the *time* of the maximum, not the height.' },
      { value: h0, why: 'That is the starting height, not the maximum.' }
    ], key),
    hints: ['The maximum occurs where $\\dfrac{dh}{dt} = 0$.', `$h' = ${v} - 10t = 0$ gives $t = ${v / 10}$.`, 'Substitute that time into $h$.'],
    steps: [
      { h: 'Differentiate', d: `$h' = ${v} - 10t$` },
      { h: 'Time of maximum', d: `$t = ${v / 10}$` },
      { h: 'Height', d: `$h(${v / 10}) = ${key}$ m` }
    ]
  };
} });

appForms.push({ diffs: [4], make: (rng) => {
  let a, k, c, key;
  do { a = ri(rng, 1, 9); k = ri(rng, 2, 20); c = ri(rng, 1, 400); key = a * k * k - c; } while (key <= 0);
  const b = 2 * a * k;
  let best = -1e12; for (let x = 0; x <= 4 * k; x += 0.01) best = Math.max(best, -a * x * x + b * x - c);
  agree(key, best, 'profit');
  return {
    prompt: `A shop's weekly profit from selling $x$ items is $P = ${poly([-a, b, -c])}$ dollars. Find the **maximum** weekly profit, in dollars.`,
    answerType: 'numeric', answer: { value: key }, answerPrefix: '$',
    traps: keepT([
      { value: k, why: `$x = ${k}$ is the number of items that maximises profit, not the profit itself.` },
      { value: -c, why: 'That is the profit when $x = 0$, not the maximum.' }
    ], key),
    hints: ['Maximise $P$: solve $P\' = 0$.', `$P' = ${b} - ${2 * a}x = 0$ gives $x = ${k}$.`, `Substitute $x = ${k}$ into $P$.`],
    steps: [
      { h: 'Differentiate', d: `$P' = ${b} - ${2 * a}x$` },
      { h: 'Optimal quantity', d: `$x = ${k}$ (a maximum since $P'' = ${-2 * a} < 0$)` },
      { h: 'Maximum profit', d: `$P(${k}) = ${key}$ dollars` }
    ]
  };
} });

appForms.push({ diffs: [4], make: (rng) => {
  const h = ri(rng, 2, 60), S = 2 * h, key = 2 * h * h;
  let best = 1e12; for (let x = 0; x <= S; x += 0.01) best = Math.min(best, x * x + (S - x) ** 2);
  agree(key, best, 'min sum of squares');
  return {
    prompt: `Two numbers $x$ and $y$ satisfy $x + y = ${S}$. Find the **minimum** value of $x^2 + y^2$.`,
    answerType: 'numeric', answer: { value: key },
    traps: keepT([
      { value: S * S, why: `$(x + y)^2 = ${S * S}$ is not $x^2 + y^2$; minimise using $y = ${S} - x$.` },
      { value: h * h, why: `That is $x^2$ at the optimum: add $y^2$ as well, with $y = ${h}$.` }
    ], key),
    hints: [`Substitute $y = ${S} - x$.`, `$f(x) = x^2 + (${S} - x)^2$ and $f'(x) = 4x - ${2 * S}$.`, `$f'(x) = 0$ gives $x = ${h}$.`],
    steps: [
      { h: 'Model', d: `$f(x) = x^2 + (${S} - x)^2$` },
      { h: 'Differentiate', d: `$f'(x) = 4x - ${2 * S}$` },
      { h: 'Stationary point', d: `$x = ${h}$, so $y = ${h}$ (a minimum since $f'' = 4 > 0$)` },
      { h: 'Minimum', d: `$${h}^2 + ${h}^2 = ${key}$` }
    ]
  };
} });

appForms.push({ diffs: [4], make: (rng) => {
  const k = ri(rng, 3, 40), L = 4 * k, A = 2 * k * k;
  let best = 0; for (let x = 0.01; x < L / 2; x += 0.01) best = Math.max(best, x * (L - 2 * x));
  agree(A, best, 'three-sided area');
  return {
    prompt: `A rectangular yard is fenced on three sides, the fourth side being an existing brick wall. The greatest area that can be enclosed is $${A}$ m². How many metres of fencing are used?`,
    answerType: 'numeric', answer: { value: L }, answerSuffix: 'm',
    traps: keepT([
      { value: 4 * Math.sqrt(A), why: 'That would be the fencing for a square on all four sides. With the wall on one side the optimal shape is not a square.' },
      { value: A / 2, why: `Let the fencing be $F$: the maximum area is $\\dfrac{F^2}{8}$, so solve $\\dfrac{F^2}{8} = ${A}$.` }
    ], L),
    hints: ['Let the fencing be $F$ and the two short sides be $x$.', `$A(x) = x(F - 2x)$ has maximum $\\dfrac{F^2}{8}$ at $x = \\dfrac{F}{4}$.`, `Solve $\\dfrac{F^2}{8} = ${A}$.`],
    steps: [
      { h: 'Model', d: `$A(x) = x(F - 2x)$, with $A'(x) = F - 4x$` },
      { h: 'Maximum', d: `$x = \\dfrac{F}{4}$, so $A_{\\max} = \\dfrac{F}{4}\\times\\dfrac{F}{2} = \\dfrac{F^2}{8}$` },
      { h: 'Solve', d: `$F^2 = ${8 * A} \\Rightarrow F = ${L}$ m` }
    ]
  };
} });

appForms.push({ diffs: [4], make: (rng) => {
  const a = ri(rng, 1, 9), p = ri(rng, 2, 25), c = ri(rng, 1, 90), b = 2 * a * p;
  const things = [['weekly profit', 'P', 'dollars'], ['daily revenue', 'R', 'dollars'], ['yield of a crop', 'Y', 'tonnes']];
  const [name, sym, unit] = rc(rng, things);
  const m = mcq(rng, `$${sym}''(${p}) = ${-2 * a}$, which is negative`, [
    { text: `$${sym}'(${p}) = 0$, which is neither positive nor negative`, why: 'That only shows the point is stationary; it does not say whether it is a maximum.' },
    { text: `$${sym}''(${p}) = ${2 * a}$, which is positive`, why: `Differentiate twice: $${sym}'' = ${-2 * a}$, not $${2 * a}$.` },
    { text: `$${sym}(${p}) > 0$`, why: 'The value of the function says nothing about whether the stationary point is a maximum.' }
  ]);
  return {
    prompt: `The ${name} is $${sym} = ${poly([-a, b, -c], 'x')}$ ${unit}, where $x$ is the quantity produced. The stationary point is at $x = ${p}$. Which statement shows that it gives a **maximum**?`,
    answerType: 'mcq', answer: { correctIndex: m.correctIndex, optionTraps: m.optionTraps }, mcqOptions: m.options,
    hints: ['Use the second derivative test.', `$${sym}' = ${b} - ${2 * a}x$.`, `$${sym}'' = ${-2 * a}$.`],
    steps: [
      { h: 'First derivative', d: `$${sym}' = ${b} - ${2 * a}x$, zero at $x = ${p}$` },
      { h: 'Second derivative', d: `$${sym}'' = ${-2 * a}$` },
      { h: 'Conclusion', d: 'Negative: concave down, so a maximum' }
    ]
  };
} });

// ═════════════════════════════════════════════════════════════════════════════
// y12-integration
// ═════════════════════════════════════════════════════════════════════════════
const intForms = [];

intForms.push({ diffs: [1], make: (rng) => {
  const a = ri(rng, 2, 6), b = nz(rng, -9, 9), n = ri(rng, 2, 5), k = ri(rng, 1, 4), c = a * (n + 1) * k;
  const L = lin(a, b);
  return {
    prompt: `Find $\\displaystyle\\int ${c}${pw(L, n)}\\,dx$. (You may omit the $+C$.)`,
    answerType: 'expression', answer: { expr: `${k}*(${ex(a, b)})^${n + 1}`, stripC: true },
    inputHint: `e.g. ${k}(${L})^${n + 1} + C`,
    traps: [
      { expr: `${a * k}*(${ex(a, b)})^${n + 1}`, why: `Divide by the inner derivative $${a}$ as well as by the new power $${n + 1}$.` },
      { expr: `${c * n * a}*(${ex(a, b)})^${n - 1}`, why: 'That is a derivative: integration raises the power.' }
    ],
    hints: ['Reverse the chain rule: raise the power, divide by the new power *and* by the inner derivative.', `$\\int (${L})^{${n}}dx = \\dfrac{(${L})^{${n + 1}}}{${a}(${n + 1})}$.`, `$\\dfrac{${c}}{${a * (n + 1)}} = ${k}$.`],
    steps: [
      { h: 'Raise the power', d: `$(${L})^{${n}} \\to \\dfrac{(${L})^{${n + 1}}}{${n + 1}}$` },
      { h: 'Divide by the inner derivative', d: `$\\dfrac{(${L})^{${n + 1}}}{${a}(${n + 1})}$` },
      { h: 'Coefficient', d: `$\\dfrac{${c}}{${a * (n + 1)}} = ${k}$, so $${k}(${L})^{${n + 1}}$` }
    ]
  };
} });

const intPoly = rng => {
  let A, B, C;
  do { A = nz(rng, -4, 4); B = ri(rng, -5, 5); C = ri(rng, -9, 9); } while (A === 0);
  return { A, B, C, fp: poly([3 * A, 2 * B, C]) };
};
intForms.push({ diffs: [1], make: (rng) => {
  const { A, B, C, fp } = intPoly(rng);
  const x0 = ri(rng, -2, 2), y0 = ri(rng, -9, 9), x1 = rc(rng, [-3, -2, -1, 1, 2, 3].filter(v => v !== x0));
  const F = x => A * x ** 3 + B * x * x + C * x;
  const D = y0 - F(x0), key = F(x1) + D;
  agree(key, y0 + simpson(t => 3 * A * t * t + 2 * B * t + C, x0, x1), 'f from f-prime');
  return {
    prompt: `The gradient function of a curve is $f'(x) = ${fp}$, and the curve passes through the point $(${x0}, ${y0})$. Find $f(${x1})$.`,
    answerType: 'numeric', answer: { value: key },
    traps: keepT([
      { value: F(x1), why: 'Find the constant of integration from the given point first: it is not zero here.' },
      { value: 3 * A * x1 * x1 + 2 * B * x1 + C, why: `That is $f'(${x1})$, the gradient, not the value of $f$.` }
    ], key),
    hints: ['Integrate to find $f(x) + C$, then use the point to find $C$.', `$f(x) = ${poly([A, B, C, 0])} + c$.`, `Substitute $(${x0}, ${y0})$ to find $c = ${D}$.`],
    steps: [
      { h: 'Integrate', d: `$f(x) = ${poly([A, B, C, 0])} + c$` },
      { h: 'Use the point', d: `$f(${x0}) = ${y0} \\Rightarrow c = ${D}$` },
      { h: 'Evaluate', d: `$f(${x1}) = ${key}$` }
    ]
  };
} });

intForms.push({ diffs: [1], make: (rng) => {
  const { A, B, C, fp } = intPoly(rng);
  const x0 = nz(rng, -3, 3), y0 = ri(rng, -20, 20);
  const D = y0 - (A * x0 ** 3 + B * x0 * x0 + C * x0);
  if (D === 0) return intForms[1].make(rng);
  agree(D, y0 - simpson(t => 3 * A * t * t + 2 * B * t + C, 0, x0), 'constant term');
  return {
    prompt: `A curve has gradient function $\\dfrac{dy}{dx} = ${fp}$ and passes through the point $(${x0}, ${y0})$. Find the $y$-intercept of the curve.`,
    answerType: 'numeric', answer: { value: D }, answerPrefix: 'y =',
    traps: keepT([
      { value: y0, why: `$${y0}$ is the $y$-value at $x = ${x0}$, not at $x = 0$.` },
      { value: -D, why: 'The constant is found from $y - F(x_0)$: check the sign.' }
    ], D),
    hints: ['Integrate, include $+C$, then use the point.', `$y = ${poly([A, B, C, 0])} + C$.`, 'The $y$-intercept is the constant term, the value at $x = 0$.'],
    steps: [
      { h: 'Integrate', d: `$y = ${poly([A, B, C, 0])} + C$` },
      { h: 'Use the point', d: `$${y0} = ${A * x0 ** 3 + B * x0 * x0 + C * x0} + C$` },
      { h: 'Solve', d: `$C = ${D}$, the value at $x = 0$` }
    ]
  };
} });

intForms.push({ diffs: [1], make: (rng) => {
  let n, k, p, q, key;
  do { n = ri(rng, 1, 5); k = nz(rng, -5, 6); p = ri(rng, -3, 3); q = ri(rng, -2, 4); key = k * (q ** (n + 1) - p ** (n + 1)); } while (q <= p || key === 0);
  const a = (n + 1) * k;
  agree(key, simpson(x => a * x ** n, p, q), 'definite power');
  return {
    prompt: `Evaluate $\\displaystyle\\int_{${p}}^{${q}} ${term(a, 'x', n)}\\,dx$.`,
    answerType: 'numeric', answer: { value: key },
    traps: keepT([
      { value: a * (q ** n - p ** n), why: 'Integrate first (raise the power and divide), *then* substitute the limits.' },
      { value: k * (q ** (n + 1) + p ** (n + 1)), why: 'Subtract: $F(q) - F(p)$.' }
    ], key),
    hints: ['Find the antiderivative, then evaluate $F(q) - F(p)$.', `$F(x) = ${term(k, 'x', n + 1)}$.`, `$F(${q}) - F(${p})$.`],
    steps: [
      { h: 'Antiderivative', d: `$F(x) = ${term(k, 'x', n + 1)}$` },
      { h: 'Limits', d: `$F(${q}) = ${k * q ** (n + 1)},\\; F(${p}) = ${k * p ** (n + 1)}$` },
      { h: 'Subtract', d: `$${k * q ** (n + 1)} - (${k * p ** (n + 1)}) = ${key}$` }
    ]
  };
} });

intForms.push({ diffs: [1], make: (rng) => {
  const a = ri(rng, 2, 7), b = nz(rng, -9, 9), n = ri(rng, 2, 6);
  const L = lin(a, b);
  const m = mcq(rng, `$\\dfrac{(${L})^{${n + 1}}}{${a * (n + 1)}} + C$`, [
    { text: `$\\dfrac{(${L})^{${n + 1}}}{${n + 1}} + C$`, why: `Also divide by the inner derivative $${a}$.` },
    { text: `$${a}\\dfrac{(${L})^{${n + 1}}}{${n + 1}} + C$`, why: `Reverse chain rule *divides* by the inner derivative $${a}$; it does not multiply.` },
    { text: `$${n}(${L})^{${n - 1}} + C$`, why: 'That is a derivative: integration raises the power.' }
  ]);
  return {
    prompt: `Which of the following is $\\displaystyle\\int ${pw(L, n)}\\,dx$?`,
    answerType: 'mcq', answer: { correctIndex: m.correctIndex, optionTraps: m.optionTraps }, mcqOptions: m.options,
    hints: ['Raise the power by 1 and divide by the new power.', `Because the inside is $${L}$, also divide by its derivative $${a}$.`, 'Check by differentiating your choice.'],
    steps: [
      { h: 'Raise the power', d: `$\\dfrac{(${L})^{${n + 1}}}{${n + 1}}$` },
      { h: 'Inner derivative', d: `Divide by $${a}$` },
      { h: 'Result', d: `$\\dfrac{(${L})^{${n + 1}}}{${a * (n + 1)}} + C$` }
    ]
  };
} });

// Proof style: substitution (machine-keyed)
intForms.push({ diffs: [1], make: (rng) => {
  const a = ri(rng, 2, 7), b = nz(rng, -9, 9), n = ri(rng, 2, 6), mm = nz(rng, -6, 9), c = a * mm;
  const L = lin(a, b);
  return {
    prompt: `Show that the substitution $u = ${L}$ turns $\\displaystyle\\int ${c}${pw(L, n)}\\,dx$ into $k\\displaystyle\\int u^{${n}}\\,du$. Find the constant $k$.`,
    answerType: 'numeric', answer: { value: mm }, answerPrefix: 'k =',
    traps: keepT([
      { value: c, why: `$du = ${a}\\,dx$, so $dx = \\dfrac{du}{${a}}$: the coefficient is divided by $${a}$.` },
      { value: c * a, why: `$dx = \\dfrac{du}{${a}}$: *divide* by $${a}$, do not multiply.` }
    ], mm),
    hints: [`Differentiate: $\\dfrac{du}{dx} = ${a}$, so $dx = \\dfrac{du}{${a}}$.`, `$\\int ${c}u^{${n}}\\,\\dfrac{du}{${a}}$.`, `$k = \\dfrac{${c}}{${a}}$.`],
    steps: [
      { h: 'Differentiate $u$', d: `$du = ${a}\\,dx \\Rightarrow dx = \\dfrac{du}{${a}}$` },
      { h: 'Substitute', d: `$\\int ${c}u^{${n}}\\,\\dfrac{du}{${a}}$` },
      { h: 'Constant', d: `$k = \\dfrac{${c}}{${a}} = ${mm}$` }
    ]
  };
} });

intForms.push({ diffs: [1], make: (rng) => {
  const a = ri(rng, 1, 5), b = nz(rng, -7, 7), n = ri(rng, 2, 5), mm = nz(rng, -6, 8), c = 2 * a * mm;
  const L = poly([a, 0, b]);
  return {
    prompt: `Using the substitution $u = ${L}$, the integral $\\displaystyle\\int ${c === 1 ? '' : c}x${pw(L, n)}\\,dx$ can be written as $k\\displaystyle\\int u^{${n}}\\,du$. Find the constant $k$.`,
    answerType: 'numeric', answer: { value: mm }, answerPrefix: 'k =',
    traps: keepT([
      { value: c, why: `$du = ${2 * a}x\\,dx$, so $x\\,dx = \\dfrac{du}{${2 * a}}$.` },
      { value: c / a, why: `The derivative of $${term(a, 'x', 2)}$ is $${2 * a}x$, not $${a}x$: divide by $${2 * a}$.` }
    ], mm),
    hints: [`$\\dfrac{du}{dx} = ${2 * a}x$, so $x\\,dx = \\dfrac{du}{${2 * a}}$.`, `$\\int ${c}u^{${n}}\\,\\dfrac{du}{${2 * a}}$.`, `$k = \\dfrac{${c}}{${2 * a}}$.`],
    steps: [
      { h: 'Differentiate $u$', d: `$du = ${2 * a}x\\,dx \\Rightarrow x\\,dx = \\dfrac{du}{${2 * a}}$` },
      { h: 'Substitute', d: `$\\int ${c}u^{${n}}\\,\\dfrac{du}{${2 * a}}$` },
      { h: 'Constant', d: `$k = \\dfrac{${c}}{${2 * a}} = ${mm}$` }
    ]
  };
} });

intForms.push({ diffs: [1], make: (rng) => {
  let n, a, b, p, t, c, u1, u2, key;
  do {
    n = ri(rng, 1, 3); a = ri(rng, 1, 3); b = ri(rng, -5, 5); p = ri(rng, 1, 3); t = nz(rng, -2, 2);
    c = 2 * a * (n + 1) * t; u1 = b; u2 = a * p * p + b; key = t * (u2 ** (n + 1) - u1 ** (n + 1));
  } while (key === 0);
  const L = poly([a, 0, b]);
  agree(key, simpson(x => c * x * (a * x * x + b) ** n, 0, p), 'u-sub definite');
  return {
    prompt: `Use the substitution $u = ${L}$ to evaluate $\\displaystyle\\int_0^{${p}} ${c}x${pw(L, n)}\\,dx$.`,
    answerType: 'numeric', answer: { value: key },
    traps: keepT([
      { value: t * u2 ** (n + 1), why: `Change the limits too: when $x = 0$, $u = ${u1}$, so subtract the value at the lower limit.` },
      { value: 2 * a * (n + 1) * t * (u2 ** (n + 1) - u1 ** (n + 1)), why: `$du = ${2 * a}x\\,dx$, so the coefficient reduces to $\\dfrac{${c}}{${2 * a}} = ${c / (2 * a)}$, then divide by $${n + 1}$.` }
    ], key),
    hints: [`$du = ${2 * a}x\\,dx$, so the integral is $${c / (2 * a)}\\int u^{${n}}\\,du$.`, `New limits: $x = 0 \\to u = ${u1}$; $x = ${p} \\to u = ${u2}$.`, `Integrate $u^{${n}}$ to get $\\dfrac{u^{${n + 1}}}{${n + 1}}$.`],
    steps: [
      { h: 'Substitute', d: `$\\displaystyle ${c / (2 * a)}\\int_{${u1}}^{${u2}} u^{${n}}\\,du$` },
      { h: 'Integrate', d: `$${c / (2 * a)}\\left[\\dfrac{u^{${n + 1}}}{${n + 1}}\\right]_{${u1}}^{${u2}}$` },
      { h: 'Evaluate', d: `$${t}\\left(${u2 ** (n + 1)} - ${u1 ** (n + 1)}\\right) = ${key}$` }
    ]
  };
} });

intForms.push({ diffs: [1], make: (rng) => {
  let a, b, n;
  do { a = ri(rng, 2, 6); b = nz(rng, -8, 8); n = ri(rng, 3, 6); } while (a === 1);
  const L = lin(a, b);
  const g = [`u = ${L} \\;\\Rightarrow\\; du = ${a}\\,dx`, `\\int ${pw(L, n)}\\,dx = \\dfrac{1}{${a}}\\int u^{${n}}\\,du`, `= \\dfrac{u^{${n + 1}}}{${a * (n + 1)}} + C = \\dfrac{(${L})^{${n + 1}}}{${a * (n + 1)}} + C`];
  const versions = [
    g,
    [`u = ${L} \\;\\Rightarrow\\; du = dx`, `\\int ${pw(L, n)}\\,dx = \\int u^{${n}}\\,du`, `= \\dfrac{u^{${n + 1}}}{${n + 1}} + C = \\dfrac{(${L})^{${n + 1}}}{${n + 1}} + C`],
    [g[0], `\\int ${pw(L, n)}\\,dx = ${a}\\int u^{${n}}\\,du`, `= \\dfrac{${a}u^{${n + 1}}}{${n + 1}} + C = \\dfrac{${a}(${L})^{${n + 1}}}{${n + 1}} + C`],
    [g[0], g[1], `= \\dfrac{u^{${n + 1}}}{${n}} + C = \\dfrac{(${L})^{${n + 1}}}{${n}} + C`]
  ];
  return firstError(rng, {
    intro: `A student evaluates $\\displaystyle\\int ${pw(L, n)}\\,dx$ by substitution.`,
    versions, because: [null, `$\\dfrac{du}{dx} = ${a}$, so $du = ${a}\\,dx$, not $dx$`, `$dx = \\dfrac{du}{${a}}$: the factor is $\\dfrac{1}{${a}}$, not $${a}$`, `integrating $u^{${n}}$ gives $\\dfrac{u^{${n + 1}}}{${n + 1}}$: divide by the *new* power`],
    rule: 'Substitution: $du = u\'(x)\\,dx$, replace $dx$, integrate, then substitute back.'
  });
} });

intForms.push({ diffs: [1], make: (rng) => {
  const A = ri(rng, 1, 4), B = ri(rng, 0, 6), C = ri(rng, 1, 9), T = ri(rng, 2, 8), V0 = ri(rng, 1, 30) * 10;
  const key = V0 + A * T ** 3 + B * T * T + C * T;
  agree(key, V0 + simpson(t => 3 * A * t * t + 2 * B * t + C, 0, T), 'tank volume');
  return {
    prompt: `Water flows into a tank at the rate $\\dfrac{dV}{dt} = ${poly([3 * A, 2 * B, C], 't')}$ litres per minute, where $t$ is the time in minutes. The tank holds $${V0}$ litres at $t = 0$. How much water is in the tank after ${pl(T, 'minute')}?`,
    answerType: 'numeric', answer: { value: key }, answerSuffix: pl(key, 'litre').replace(/^\d+ /, ''),
    traps: keepT([
      { value: A * T ** 3 + B * T * T + C * T, why: `Add the initial volume of $${V0}$ litres: that is the constant of integration.` },
      { value: 3 * A * T * T + 2 * B * T + C, why: 'That is the *rate* at that time, not the volume: integrate the rate.' }
    ], key),
    hints: ['Integrate the rate to find the volume, and use $V(0)$ to find the constant.', `$V = ${poly([A, B, C, 0], 't')} + c$ with $c = ${V0}$.`, `Substitute $t = ${T}$.`],
    steps: [
      { h: 'Integrate', d: `$V = ${poly([A, B, C, 0], 't')} + c$` },
      { h: 'Initial volume', d: `$V(0) = ${V0} \\Rightarrow c = ${V0}$` },
      { h: 'Evaluate', d: `$V(${T}) = ${key}$ litres` }
    ]
  };
} });

intForms.push({ diffs: [1], make: (rng) => {
  const n = ri(rng, 2, 5), k = ri(rng, 1, 9), a = (n - 1) * k;
  return {
    prompt: `Find $\\displaystyle\\int \\dfrac{${a}}{x^{${n}}}\\,dx$. (You may omit the $+C$.)`,
    answerType: 'expression', answer: { expr: `-${k}*x^(-${n - 1})`, stripC: true },
    inputHint: `e.g. -${k}x^(-${n - 1}) + C`,
    traps: [
      { expr: `${k}*x^(-${n - 1})`, why: 'Dividing by the new power $-' + (n - 1) + '$ gives a negative coefficient.' },
      { expr: `-${a}*x^(-${n + 1})`, why: 'Integration *raises* the power: $-' + n + ' + 1 = -' + (n - 1) + '$.' }
    ],
    hints: [`Write the integrand as $${a}x^{-${n}}$.`, `Raise the power: $-${n} + 1 = -${n - 1}$, then divide by $-${n - 1}$.`, `$\\dfrac{${a}}{-${n - 1}} = -${k}$.`],
    steps: [
      { h: 'Rewrite', d: `$${a}x^{-${n}}$` },
      { h: 'Integrate', d: `$\\dfrac{${a}x^{-${n - 1}}}{-${n - 1}}$` },
      { h: 'Simplify', d: `$-${k}x^{-${n - 1}}$` }
    ]
  };
} });

// ═════════════════════════════════════════════════════════════════════════════
// y12-stats (variance of a discrete random variable; diff 2)
// ═════════════════════════════════════════════════════════════════════════════
const dec = v => String(r3(v));
function weights(rng, k, den) {
  for (;;) {
    const cuts = new Set(); while (cuts.size < k - 1) cuts.add(ri(rng, 1, den - 1));
    const s = [0, ...[...cuts].sort((x, y) => x - y), den]; const w = []; for (let i = 1; i < s.length; i++) w.push(s[i] - s[i - 1]);
    if (new Set(w).size > 1) return w;
  }
}
function dist(rng, k) {
  const den = rc(rng, [10, 20, 25, 40, 50, 100]), w = weights(rng, k, den);
  const s = ri(rng, 0, 5), d = ri(rng, 1, 3), vals = Array.from({ length: k }, (_, i) => s + d * i);
  const Sx = vals.reduce((t, v, i) => t + v * w[i], 0), Sxx = vals.reduce((t, v, i) => t + v * v * w[i], 0);
  const E = Sx / den, Var = (den * Sxx - Sx * Sx) / (den * den);
  const mu = E; const direct = vals.reduce((t, v, i) => t + (w[i] / den) * (v - mu) ** 2, 0);
  agree(Var, direct, 'variance');
  return { den, w, vals, E, E2: Sxx / den, Var, probs: w.map(x => dec(x / den)) };
}
const tableTex = (vals, probs) => `\\begin{array}{c|${'c'.repeat(vals.length)}} x & ${vals.join(' & ')} \\\\ \\hline P(X=x) & ${probs.join(' & ')} \\end{array}`;

const statsForms = [];
statsForms.push({ diffs: [2], make: (rng) => {
  let D; do { D = dist(rng, ri(rng, 3, 5)); } while (D.Var < 0.3);
  const key = r2(D.Var);
  return {
    prompt: `The probability distribution of a discrete random variable $X$ is shown.\n\n$${tableTex(D.vals, D.probs)}$\n\nFind $\\text{Var}(X)$, correct to 2 decimal places.`,
    answerType: 'numeric', answer: { value: key, tol: 0.011 },
    traps: keepT([
      { value: r2(D.E2), why: `$${r2(D.E2)}$ is $E(X^2)$: subtract $[E(X)]^2 = ${r2(D.E * D.E)}$.` },
      { value: r2(Math.sqrt(D.Var)), why: 'That is the standard deviation: the variance is its square.' },
      { value: r2(D.E2 - D.E), why: 'Var$(X) = E(X^2) - [E(X)]^2$: subtract the *square* of the mean.' }
    ].map(t => ({ ...t, tol: 0.011 })), key).filter(t => Math.abs(t.value - key) > 0.02),
    hints: ['$\\text{Var}(X) = E(X^2) - [E(X)]^2$.', `$E(X) = ${r3(D.E)}$.`, `$E(X^2) = ${r3(D.E2)}$.`],
    steps: [
      { h: 'Mean', d: `$E(X) = ${r3(D.E)}$` },
      { h: 'Second moment', d: `$E(X^2) = ${r3(D.E2)}$` },
      { h: 'Variance', d: `$${r3(D.E2)} - (${r3(D.E)})^2 = ${key}$` }
    ]
  };
} });

statsForms.push({ diffs: [2], make: (rng) => {
  const k = ri(rng, 3, 4), den = rc(rng, [20, 50, 100]);
  const w = weights(rng, k, den), pIdx = ri(rng, 0, k - 1), s0 = ri(rng, 0, 4);
  const vals = Array.from({ length: k }, (_, i) => i + s0);
  const E = vals.reduce((t, v, i) => t + v * w[i], 0) / den;
  const key = r2(E);
  const parts = vals.map((v, i) => `P(X=${v}) = ${i === pIdx ? 'p' : dec(w[i] / den)}`);
  return {
    prompt: `A discrete random variable $X$ has $${parts.join(',\\; ')}$. Find $E(X)$.`,
    answerType: 'numeric', answer: { value: key },
    traps: keepT([
      { value: r2(vals.reduce((t, v) => t + v, 0) / k), why: '$E(X)$ weights each value by its probability: it is not the mean of the values.' },
      { value: r2(vals.reduce((t, v, i) => t + (i === pIdx ? 0 : v * w[i] / den), 0)), why: `First find $p = 1 - \\sum \\text{other probabilities} = ${dec(w[pIdx] / den)}$, then include its term.` }
    ].map(t => ({ ...t, tol: 0.011 })), key),
    hints: ['The probabilities must sum to 1: find $p$ first.', `$p = ${dec(w[pIdx] / den)}$.`, '$E(X) = \\sum x\\,P(X=x)$.'],
    steps: [
      { h: 'Find $p$', d: `$p = 1 - (${w.filter((_, i) => i !== pIdx).map(x => dec(x / den)).join(' + ')}) = ${dec(w[pIdx] / den)}$` },
      { h: 'Expected value', d: `$E(X) = ${vals.map((v, i) => `${v}(${dec(w[i] / den)})`).join(' + ')}$` },
      { h: 'Evaluate', d: `$E(X) = ${key}$` }
    ]
  };
} });

statsForms.push({ diffs: [2], make: (rng) => {
  const v = ri(rng, 1, 25), mu = ri(rng, 1, 30), a = rc(rng, [-6, -5, -4, -3, -2, 2, 3, 4, 5, 6, 7, 8]), b = nz(rng, -9, 9);
  const key = a * a * v;
  agree(key, simpson(() => a * a * v, 0, 1), 'var linear');
  return {
    prompt: `A random variable $X$ has $E(X) = ${mu}$ and $\\text{Var}(X) = ${v}$. Find $\\text{Var}(${a}X ${sgn(b)})$.`,
    answerType: 'numeric', answer: { value: key },
    traps: keepT([
      { value: a * v, why: `Variance scales by the *square* of the multiplier: $${a}^2 = ${a * a}$.` },
      { value: a * a * v + b, why: 'Adding a constant shifts every value equally, so it does not change the variance.' },
      { value: a * mu + b, why: `That is $E(${a}X ${sgn(b)})$, not the variance.` }
    ], key),
    hints: ['$\\text{Var}(aX + b) = a^2\\,\\text{Var}(X)$.', 'The added constant does not change the spread.', `$${a}^2 \\times ${v}$.`],
    steps: [
      { h: 'Rule', d: `$\\text{Var}(aX + b) = a^2\\,\\text{Var}(X)$` },
      { h: 'Substitute', d: `$${a}^2 \\times ${v}$` },
      { h: 'Evaluate', d: `$${key}$` }
    ]
  };
} });

statsForms.push({ diffs: [2], make: (rng) => {
  let v1, v2, kk, w, den, E, key;
  do {
    den = rc(rng, [10, 20, 50, 100]); w = weights(rng, 3, den);
    v1 = ri(rng, 0, 4); v2 = v1 + ri(rng, 1, 3); kk = v2 + ri(rng, 1, 8);
    E = (v1 * w[0] + v2 * w[1] + kk * w[2]) / den;
  } while (Math.abs(r3(E) - E) > 1e-9);
  key = kk;
  return {
    prompt: `A random variable $X$ has $P(X=${v1}) = ${dec(w[0] / den)}$, $P(X=${v2}) = ${dec(w[1] / den)}$ and $P(X=k) = ${dec(w[2] / den)}$, where $k > ${v2}$. Given that $E(X) = ${dec(E)}$, find the value of $k$.`,
    answerType: 'numeric', answer: { value: key }, answerPrefix: 'k =',
    traps: keepT([
      { value: r3((E - v1 * w[0] / den - v2 * w[1] / den)), why: `Divide by the probability $${dec(w[2] / den)}$ of that value: $k \\times ${dec(w[2] / den)}$ is only its contribution.` }
    ].filter(t => t.value > 0), key),
    hints: ['Use $E(X) = \\sum x\\,P(X=x)$ and solve for $k$.', `$${v1}(${dec(w[0] / den)}) + ${v2}(${dec(w[1] / den)}) + k(${dec(w[2] / den)}) = ${dec(E)}$.`, 'Isolate the $k$ term.'],
    steps: [
      { h: 'Set up', d: `$${dec(v1 * w[0] / den)} + ${dec(v2 * w[1] / den)} + ${dec(w[2] / den)}k = ${dec(E)}$` },
      { h: 'Isolate', d: `$${dec(w[2] / den)}k = ${dec(E - (v1 * w[0] + v2 * w[1]) / den)}$` },
      { h: 'Solve', d: `$k = ${key}$` }
    ]
  };
} });

statsForms.push({ diffs: [2], make: (rng) => {
  const m = ri(rng, 6, 40) / 10, vr = ri(rng, 4, 400) / 100, s = r2(m * m + vr), key = r2(vr);
  const m2 = mcq(rng, `$${key}$`, [
    { text: `$${r2(s - m)}$`, why: 'Subtract the *square* of the mean: $[E(X)]^2$.' },
    { text: `$${r2(s + m * m)}$`, why: 'The variance *subtracts* $[E(X)]^2$.' },
    { text: `$${r2((s - m) * (s - m))}$`, why: 'Var$(X) = E(X^2) - [E(X)]^2$ — there is no extra squaring.' }
  ]);
  return {
    prompt: `For a random variable $X$, $E(X) = ${m}$ and $E(X^2) = ${s}$. What is $\\text{Var}(X)$?`,
    answerType: 'mcq', answer: { correctIndex: m2.correctIndex, optionTraps: m2.optionTraps }, mcqOptions: m2.options,
    hints: ['$\\text{Var}(X) = E(X^2) - [E(X)]^2$.', `$[E(X)]^2 = ${m}^2 = ${r2(m * m)}$.`, `Subtract: $${s} - ${r2(m * m)}$.`],
    steps: [
      { h: 'Formula', d: `$\\text{Var}(X) = E(X^2) - [E(X)]^2$` },
      { h: 'Substitute', d: `$${s} - ${m}^2 = ${s} - ${r2(m * m)}$` },
      { h: 'Evaluate', d: `$${key}$` }
    ]
  };
} });

statsForms.push({ diffs: [2], make: (rng) => {
  const m = ri(rng, 6, 40) / 10, r = ri(rng, 5, 50) / 10, s = r2(m * m + r * r);
  agree(r, Math.sqrt(s - m * m), 'sd');
  return {
    prompt: `A random variable $X$ has $E(X) = ${m}$ and $E(X^2) = ${s}$. Find the standard deviation of $X$.`,
    answerType: 'numeric', answer: { value: r },
    traps: keepT([
      { value: r2(r * r), why: 'That is the variance: take its square root for the standard deviation.' },
      { value: r2(Math.sqrt(s)), why: 'First subtract $[E(X)]^2$: $\\text{Var}(X) = E(X^2) - [E(X)]^2$.' }
    ].map(t => ({ ...t, tol: 0.011 })), r),
    hints: ['Find the variance, then take the square root.', `$\\text{Var}(X) = ${s} - ${m}^2 = ${r2(r * r)}$.`, `$\\sigma = \\sqrt{${r2(r * r)}}$.`],
    steps: [
      { h: 'Variance', d: `$\\text{Var}(X) = ${s} - (${m})^2 = ${r2(r * r)}$` },
      { h: 'Standard deviation', d: `$\\sigma = \\sqrt{${r2(r * r)}} = ${r}$` }
    ]
  };
} });

statsForms.push({ diffs: [2], make: (rng) => {
  const den = rc(rng, [10, 20, 25, 50, 100]), w = weights(rng, 3, den);
  const prizes = [0, ri(rng, 1, 5) * 2, ri(rng, 6, 30) * 2].sort((x, y) => x - y);
  const cost = ri(rng, 1, 6) * 2 + 1;
  let E; E = prizes.reduce((t, v, i) => t + v * w[i], 0) / den - cost;
  if (Math.abs(E) < 0.005) return statsForms[6].make(rng);
  const key = r2(E);
  const direct = [0, 1, 2].reduce((t, i) => t + (w[i] / den) * (prizes[i] - cost), 0);
  agree(key, direct, 'game gain');
  const money = v => `\\$${v}`;
  return {
    prompt: `A game costs ${money(cost)} to play. The prize is ${money(prizes[0])} with probability ${dec(w[0] / den)}, ${money(prizes[1])} with probability ${dec(w[1] / den)} and ${money(prizes[2])} with probability ${dec(w[2] / den)}. Find the expected net gain per game, in dollars. (A negative answer is an expected loss.)`,
    answerType: 'numeric', answer: { value: key },
    traps: keepT([
      { value: r2(key + cost), why: `That ignores the cost of ${money(cost)} to play: net gain = expected prize $-$ cost.` },
      { value: r2(-key), why: 'A positive net gain is a profit and a negative one a loss: check the sign.' }
    ].map(t => ({ ...t, tol: 0.011 })), key),
    hints: ['Expected net gain = expected prize minus the cost to play.', `Expected prize $= ${prizes.map((p, i) => `${p}(${dec(w[i] / den)})`).join(' + ')}$.`, `Subtract the cost, $${cost}$.`],
    steps: [
      { h: 'Expected prize', d: `$${prizes.map((p, i) => `${p}(${dec(w[i] / den)})`).join(' + ')} = ${r2(key + cost)}$` },
      { h: 'Subtract the cost', d: `$${r2(key + cost)} - ${cost} = ${key}$` }
    ]
  };
} });

statsForms.push({ diffs: [2], make: (rng) => {
  const n = ri(rng, 3, 12), d = ri(rng, 1, 5), s = ri(rng, 0, 9);
  const vals = Array.from({ length: n }, (_, i) => s + d * i);
  const mean = vals.reduce((t, v) => t + v, 0) / n, V = vals.reduce((t, v) => t + (v - mean) ** 2, 0) / n;
  const key = r2((d * d * (n * n - 1)) / 12);
  agree(key, r2(V), 'spinner var');
  if (key < 0.3) return statsForms[7].make(rng);
  return {
    prompt: `A fair spinner has $${n}$ equal sectors numbered $${vals.slice(0, 3).join(', ')}, \\ldots, ${vals[n - 1]}$ (each number is $${d}$ more than the one before). Let $X$ be the number it lands on. Find $\\text{Var}(X)$, correct to 2 decimal places.`,
    answerType: 'numeric', answer: { value: key, tol: 0.011 },
    traps: keepT([
      { value: r2(mean), why: 'That is $E(X)$, the mean: the variance measures the spread about the mean.' },
      { value: r2(Math.sqrt(V)), why: 'That is the standard deviation: the variance is its square.' }
    ].map(t => ({ ...t, tol: 0.011 })), key),
    hints: ['Each outcome has probability $\\dfrac{1}{' + n + '}$.', `The mean is $${dec(mean)}$.`, '$\\text{Var}(X) = \\sum (x - \\mu)^2 P(X=x)$.'],
    steps: [
      { h: 'Mean', d: `$E(X) = ${dec(mean)}$` },
      { h: 'Squared deviations', d: `$\\text{Var}(X) = \\dfrac{1}{${n}}\\sum (x - ${dec(mean)})^2$` },
      { h: 'Evaluate', d: `$\\text{Var}(X) = ${key}$` }
    ]
  };
} });

export const forms = {
  'y12-diff': diffForms,
  'y12-appdiff': appForms,
  'y12-integration': intForms,
  'y12-stats': statsForms
};
