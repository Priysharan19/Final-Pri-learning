// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Prithagoras Extension 1 bank variety, forms (calculus, binomial, functions, vectors and induction)
//   me12-further-calc (all four levels), me11-binomial (all four levels),
//   me11-functions D1 and D3, me12-vectors-forms D1.
//
// The audit found one remembered recipe could carry a student through the top
// level of these cells (every further-calculus D4 draw was an integral from 0 to
// 1/2 of k over the root of 1 minus x squared). Each form below makes the student
// take a different DECISION (which inverse function; which substitution; which
// limits; split a numerator; read a y-value back to an x-value; undo a function in
// the right order), not read different numbers. Original wording; every key is
// computed in code from the numbers the prompt shows; the AI never sets a mark.
// Verified by an independent route in client/test/ext1-bank-forms-check.mjs.
// Writer's own assessment: not reviewed by a teacher. SYNTHETIC: no student evidence.
// ─────────────────────────────────────────────────────────────────────────────
import { ri, rc, nz, mcq } from '../qhelpers.js';

// ── shared helpers (an NSW-authored module may import only ../qhelpers.js, so they live here) ──

const REJ = Symbol('reject');
const rej = cond => { if (cond) throw REJ; };
/** A variant for au-forms-apply.js: re-draws (same rng, so still deterministic) until the numbers are acceptable. */
const V = (diffs, fn) => ({
  diffs,
  make: (rng, diff) => {
    for (let i = 0; i < 300; i++) {
      try { return fn(rng, diff); } catch (e) { if (e !== REJ) throw e; }
    }
    throw new Error('ext1-bank variant: no acceptable draw');
  }
});
/** Attach the drawn parameters for the independent check. Not enumerable: never part of a served question. */
const spec = (payload, form, data = {}) => {
  Object.defineProperty(payload, '__spec', { value: { form, ...data }, enumerable: false });
  return payload;
};

const fin = v => typeof v === 'number' && Number.isFinite(v);
const gcd = (a, b) => { a = Math.abs(a); b = Math.abs(b); while (b) [a, b] = [b, a % b]; return a || 1; };
/** A coefficient written before a variable: 1 -> v, -1 -> -v. */
const co = (c, v) => (c === 1 ? v : c === -1 ? `-${v}` : `${c}${v}`);
/** "+ n" or "- n" for a non-zero n. */
const sg = n => (n < 0 ? `- ${-n}` : `+ ${n}`);
/** ax + b written for a non-zero b. */
const lin = (a, b, v = 'x') => `${co(a, v)} ${sg(b)}`;
/** Round to 3 places; reject a value sitting near a rounding boundary so the keyed band is unambiguous. */
const r3 = v => Math.round(v * 1000) / 1000;
const safe3 = v => { const s = Math.abs(v) * 1000; return Math.abs((s - Math.floor(s)) - 0.5) > 0.04; };

const checkLadder = (hints, steps) => {
  if (!Array.isArray(hints) || hints.length !== 4) throw new Error('ext1-bank: a form needs a four-rung hint ladder');
  if (!Array.isArray(steps) || steps.length < 2 || steps.some(s => !s.h || !s.d)) throw new Error('ext1-bank: a form needs headed worked steps');
};

/** A numeric payload. A trap that equals the key (or repeats) is not a misconception, so it is dropped. */
function numQ(prompt, value, { dp, tol, prefix, suffix, traps = [], hints, steps, hint } = {}) {
  rej(!fin(value));
  checkLadder(hints, steps);
  const seen = [value], tr = [];
  for (const t of traps) {
    if (!fin(t.value) || seen.some(s => Math.abs(s - t.value) <= Math.max(2 * (tol || 0), 1e-9))) continue;
    seen.push(t.value);
    tr.push(tol ? { ...t, tol } : t);
  }
  const q = { prompt, answerType: 'numeric', answer: tol ? { value, tol } : { value }, traps: tr, hints, steps };
  if (prefix) q.answerPrefix = prefix;
  if (suffix) q.answerSuffix = suffix;
  if (hint) q.inputHint = hint;
  return q;
}
/** A fraction n/d, reduced, as an exact key ("type c as a fraction"). */
function exactQ(prompt, n, d, { dp, prefix, traps = [], hints, steps, hint = 'e.g. 5/12' } = {}) {
  checkLadder(hints, steps);
  const g = gcd(n, d), nn = n / g, dd = d / g, value = nn / dd;
  const tr = traps.filter(t => fin(t.value) && Math.abs(t.value - value) > 0.002).map(t => ({ ...t, tol: 0.0005 }));
  rej(tr.length < 1);
  const q = {
    prompt, answerType: 'numeric',
    answer: { value, requireExact: true, canonicalInput: dd === 1 ? `${nn}` : `${nn}/${dd}`, tol: 0.0005 },
    traps: tr, hints, steps, inputHint: hint
  };
  if (prefix) q.answerPrefix = prefix;
  return q;
}
/** An expression payload; `key` and each trap expression are in the engine's expression syntax. */
function exprQ(prompt, key, { dp, prefix, traps = [], hints, steps, hint = 'e.g. 5k - 4' } = {}) {
  checkLadder(hints, steps);
  const q = { prompt, answerType: 'expression', answer: { expr: key }, inputHint: hint, traps, hints, steps };
  if (prefix) q.answerPrefix = prefix;
  return q;
}
/** A multiple-choice payload: `correct` and `ds` are { text, why? }; ds carry the named mistake. */
function mcQ(rng, prompt, correct, ds, { dp, hints, steps } = {}) {
  checkLadder(hints, steps);
  const m = mcq(rng, correct, ds);
  const q = { prompt, answerType: 'mcq', answer: { correctIndex: m.correctIndex, optionTraps: m.optionTraps }, mcqOptions: m.options, hints, steps };
  // the options as authored (the key first), for the independent check; not enumerable, never served
  Object.defineProperty(q, '__texts', { value: [correct, ...ds.map(d => (typeof d === 'string' ? d : d.text))], enumerable: false });
  return q;
}


// ═══════════════════════════ calculus, binomial, functions, vectors ═════════════════════
const asinTex = String.raw`\sin^{-1}`;
const atanTex = String.raw`\tan^{-1}`;
const C = (n, k) => { let r = 1; for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i; return Math.round(r); };
const frac = (n, d) => (d === 1 ? `${n}` : String.raw`\dfrac{${n}}{${d}}`);
/** n/d in lowest terms. */
const fr = (n, d) => { const g = gcd(n, d), s = d < 0 ? -1 : 1; return frac((s * n) / g, (s * d) / g); };
/** x over a, with the denominator left out when it is 1. */
const xover = a => (a === 1 ? 'x' : String.raw`\dfrac{x}{${a}}`);
/** (n * pi) / d in lowest terms. */
const cpi = (n, d) => { const g = gcd(n, d), n1 = n / g, d1 = d / g, top = n1 === 1 ? String.raw`\pi` : String.raw`${n1}\pi`; return d1 === 1 ? top : String.raw`\dfrac{${top}}{${d1}}`; };
/** (a * sqrt(r)) / d in lowest terms; a coefficient of 1 is not printed. */
const rad = (a, r, d) => { const g = gcd(a, d), a1 = a / g, d1 = d / g, top = a1 === 1 ? String.raw`\sqrt${r}` : String.raw`${a1}\sqrt${r}`; return d1 === 1 ? top : String.raw`\dfrac{${top}}{${d1}}`; };

// ═══════════════════════════ me12-further-calc ═══════════════════════════════
// Cell dot points: D1 = 0 (differentiate inverse sine), D2 = 1 (inverse tangent), D3 and D4 = 2 (integrate).

const calcForms = [
  // ───────────── D1 · differentiate an inverse sine ─────────────
  // the argument is x over a constant and the point is chosen so the root is rational
  V([1], rng => {
    const t = rc(rng, [1, 2, 4, 5]), m = 5 * t, x0 = 3 * t;
    return spec(numQ(String.raw`Find the gradient of the curve $y = ${asinTex}\left(\dfrac{x}{${m}}\right)$ at the point where $x = ${x0}$.`, 1 / (4 * t), {
      dp: 0,
      traps: [{ value: 5 / 4, why: String.raw`The argument is $\dfrac{x}{${m}}$, so the chain rule brings a factor $\dfrac{1}{${m}}$ as well.` }],
      hints: [
        String.raw`Write $y = ${asinTex}u$ with $u = \dfrac{x}{${m}}$ and use $\dfrac{d}{du}${asinTex}u = \dfrac{1}{\sqrt{1-u^2}}$.`,
        String.raw`Apply the chain rule: $\dfrac{dy}{dx} = \dfrac{du}{dx}\times\dfrac{1}{\sqrt{1-u^2}}$.`,
        `Find $u$ at $x = ${x0}$, then the value of $\\sqrt{1-u^2}$.`,
        `$u = \\frac35$ gives $\\sqrt{1-u^2} = \\frac45$, so the gradient is $\\frac{1}{${m}}\\div\\frac45 = ${1 / (4 * t)}$.`],
      steps: [
        { h: 'Differentiate', d: String.raw`$\dfrac{dy}{dx} = \dfrac{1}{${m}}\cdot\dfrac{1}{\sqrt{1-\left(\frac{x}{${m}}\right)^2}}$` },
        { h: 'Evaluate the argument', d: String.raw`At $x = ${x0}$, $\dfrac{x}{${m}} = \dfrac35$ and $\sqrt{1-\frac{9}{25}} = \dfrac45$` },
        { h: 'Gradient', d: String.raw`$\dfrac{1}{${m}}\times\dfrac54 = ${1 / (4 * t)}$` }]
    }), 'fc-sin-grad', { t });
  }),
  // simplify the derivative of sin^-1(x/m) to one root
  V([1], rng => {
    const m = ri(rng, 2, 9), m2 = m * m;
    return spec(mcQ(rng, String.raw`Differentiate $y = ${asinTex}\left(\dfrac{x}{${m}}\right)$ for $-${m} < x < ${m}$. Which expression is $\dfrac{dy}{dx}$ once it is simplified so that the only root is a single square root of a difference?`, String.raw`$\dfrac{1}{\sqrt{${m2} - x^2}}$`, [
      { text: String.raw`$\dfrac{${m}}{\sqrt{${m2} - x^2}}$`, why: String.raw`The chain rule gives a factor $\dfrac{1}{${m}}$; leaving it out gives $\dfrac{${m}}{\sqrt{${m2}-x^2}}$.` },
      { text: String.raw`$\dfrac{1}{\sqrt{${m} - x^2}}$`, why: `The constant under the root is $${m}^2 = ${m2}$, not $${m}$.` },
      { text: String.raw`$\dfrac{1}{${m}\sqrt{${m2} - x^2}}$`, why: String.raw`The factor $\dfrac{1}{${m}}$ cancels against the $${m}$ that comes out of $\sqrt{1-\frac{x^2}{${m2}}} = \dfrac{\sqrt{${m2}-x^2}}{${m}}$.` }], {
      dp: 0,
      hints: [
        String.raw`Use $\dfrac{d}{dx}${asinTex}\left(\dfrac{x}{a}\right) = \dfrac{1}{a}\cdot\dfrac{1}{\sqrt{1-x^2/a^2}}$.`,
        'Write the root over a common denominator: $1 - \\dfrac{x^2}{a^2} = \\dfrac{a^2 - x^2}{a^2}$.',
        'The factor $a$ that comes out of the root cancels the $\\dfrac{1}{a}$ in front.',
        `The derivative is $\\dfrac{1}{\\sqrt{${m2} - x^2}}$.`],
      steps: [
        { h: 'Chain rule', d: String.raw`$\dfrac{dy}{dx} = \dfrac{1}{${m}}\cdot\dfrac{1}{\sqrt{1-\frac{x^2}{${m2}}}}$` },
        { h: 'Common denominator', d: String.raw`$\sqrt{1-\frac{x^2}{${m2}}} = \dfrac{\sqrt{${m2}-x^2}}{${m}}$` },
        { h: 'Cancel', d: String.raw`$\dfrac{dy}{dx} = \dfrac{1}{\sqrt{${m2}-x^2}}$` }]
    }), 'fc-sin-simplify', { m });
  }),
  // choose the derivative of sin^-1(ax+b)
  V([1], rng => {
    const a = ri(rng, 2, 5), b = nz(rng, -3, 3), u = `(${lin(a, b)})`;
    const correct = { text: String.raw`$\dfrac{${a}}{\sqrt{1-${u}^2}}$` };
    return spec(mcQ(rng, String.raw`Which expression is $\dfrac{d}{dx}\,${asinTex}(${lin(a, b)})$?`, correct.text, [
      { text: String.raw`$\dfrac{1}{\sqrt{1-${u}^2}}$`, why: `The chain rule is missing: the inner function $${lin(a, b)}$ has derivative $${a}$.` },
      { text: String.raw`$\dfrac{${a}}{\sqrt{1-${u}}}$`, why: String.raw`The root contains $1 - u^2$, so the argument is squared.` },
      { text: String.raw`$\dfrac{${a}}{1+${u}^2}$`, why: String.raw`That is the rule for $${atanTex}$, not for $${asinTex}$.` }], {
      dp: 0,
      hints: ['Name the inner function $u$ and find $\\dfrac{du}{dx}$.', String.raw`Recall $\dfrac{d}{du}${asinTex}u = \dfrac{1}{\sqrt{1-u^2}}$: which sign and which power?`, 'Multiply the two parts of the chain rule.', `The derivative is $\\dfrac{${a}}{\\sqrt{1-${u}^2}}$.`],
      steps: [
        { h: 'Inner function', d: `$u = ${lin(a, b)}$, so $\\dfrac{du}{dx} = ${a}$` },
        { h: 'Outer derivative', d: String.raw`$\dfrac{d}{du}${asinTex}u = \dfrac{1}{\sqrt{1-u^2}}$` },
        { h: 'Chain rule', d: String.raw`$\dfrac{${a}}{\sqrt{1-${u}^2}}$` }]
    }), 'fc-sin-mcq', { a, b });
  }),
  // where the derivative exists: the upper end of the open interval
  V([1], rng => {
    const a = rc(rng, [2, 4, 5, 8]), b = nz(rng, -4, 4), q = (1 - b) / a, p = (-1 - b) / a;
    return spec(numQ(String.raw`The curve $y = ${asinTex}(${lin(a, b)})$ has a gradient at every $x$ with $p < x < q$ and at no other $x$. Find $q$.`, q, {
      dp: 0, prefix: 'q =',
      traps: [{ value: 1 / a, why: `The argument is $${lin(a, b)}$, not $${co(a, 'x')}$: the shift $${b}$ moves the end of the interval.` }, { value: p, why: '$p$ is the lower end; the question asks for the upper end $q$.' }],
      hints: [
        String.raw`$\dfrac{dy}{dx} = \dfrac{${a}}{\sqrt{1-(${lin(a, b)})^2}}$: when is this a real, finite number?`,
        'The root must be real and the denominator must not be zero, so $1 - u^2 > 0$.',
        `That means $-1 < ${lin(a, b)} < 1$. Solve for $x$.`,
        `The upper end is where $${lin(a, b)} = 1$, so $q = ${q}$.`],
      steps: [
        { h: 'Gradient', d: String.raw`$\dfrac{dy}{dx} = \dfrac{${a}}{\sqrt{1-(${lin(a, b)})^2}}$` },
        { h: 'Condition', d: `The root is real and non-zero only when $-1 < ${lin(a, b)} < 1$` },
        { h: 'Solve for x', d: `$${p} < x < ${q}$, so $q = ${q}$` }]
    }), 'fc-sin-domain', { a, b });
  }),
  // equation of the tangent at x = 0 for p sin^-1(x/q) + r
  V([1], rng => {
    const q = rc(rng, [2, 3, 4, 5]), p = ri(rng, 2, 6), r = nz(rng, -5, 5);
    return spec(exprQ(String.raw`Find the equation of the tangent to $y = ${p}${asinTex}\left(\dfrac{x}{${q}}\right) ${sg(r)}$ at the point where $x = 0$. Give $y$ in terms of $x$.`, `(${p}/${q})*x + (${r})`, {
      dp: 0, prefix: 'y =',
      traps: [
        { expr: `${p}*x + (${r})`, why: String.raw`The argument $\dfrac{x}{${q}}$ contributes a factor $\dfrac{1}{${q}}$ to the gradient.` },
        { expr: `(${p}/${q})*x`, why: `The tangent passes through $(0, ${r})$, so it keeps the constant $${r}$.` }],
      hints: [
        'A tangent needs a point and a gradient. Find the point first: put $x = 0$ in the curve.',
        String.raw`Differentiate: $\dfrac{dy}{dx} = ${p}\cdot\dfrac{1}{${q}}\cdot\dfrac{1}{\sqrt{1-x^2/${q * q}}}$.`,
        'Evaluate the gradient at $x = 0$ and use $y - y_1 = m(x - x_1)$.',
        `The point is $(0, ${r})$ and the gradient is $\\frac{${p}}{${q}}$, so $y = \\frac{${p}}{${q}}x ${sg(r)}$.`],
      steps: [
        { h: 'Point', d: `At $x = 0$: $y = ${p}(0) ${sg(r)} = ${r}$` },
        { h: 'Gradient', d: String.raw`$\dfrac{dy}{dx} = \dfrac{${p}}{${q}}\cdot\dfrac{1}{\sqrt{1-x^2/${q * q}}} = \dfrac{${p}}{${q}}$ at $x = 0$` },
        { h: 'Tangent', d: String.raw`$y = \dfrac{${p}}{${q}}x ${sg(r)}$` }]
    }), 'fc-sin-tangent', { p, q, r });
  }),

  // ───────────── D2 · differentiate an inverse tangent ─────────────
  V([2], rng => {
    const m = rc(rng, [2, 4, 5, 8, 10]), t = ri(rng, 1, 3), x0 = m * t, den = m * (1 + t * t);
    return spec(numQ(String.raw`Find the gradient of the curve $y = ${atanTex}\left(\dfrac{x}{${m}}\right)$ at the point where $x = ${x0}$.`, 1 / den, {
      dp: 1,
      traps: [{ value: 1 / (1 + t * t), why: String.raw`The chain rule also brings the factor $\dfrac{1}{${m}}$ from the argument $\dfrac{x}{${m}}$.` }],
      hints: [
        String.raw`Write $y = ${atanTex}u$ with $u = \dfrac{x}{${m}}$; then $\dfrac{dy}{dx} = \dfrac{du}{dx}\cdot\dfrac{1}{1+u^2}$.`,
        'Find $\\dfrac{du}{dx}$.',
        `Evaluate $u$ at $x = ${x0}$ and then $1 + u^2$.`,
        `$u = ${t}$, so the gradient is $\\dfrac{1}{${m}}\\times\\dfrac{1}{${1 + t * t}} = ${1 / den}$.`],
      steps: [
        { h: 'Differentiate', d: String.raw`$\dfrac{dy}{dx} = \dfrac{1}{${m}}\cdot\dfrac{1}{1+\left(\frac{x}{${m}}\right)^2}$` },
        { h: 'Argument', d: `At $x = ${x0}$, $u = ${t}$ and $1 + u^2 = ${1 + t * t}$` },
        { h: 'Gradient', d: String.raw`$\dfrac{1}{${m}\times ${1 + t * t}} = ${1 / den}$` }]
    }), 'fc-tan-grad', { m, t });
  }),
  // product rule with an inverse tangent
  V([2], rng => {
    const c = ri(rng, 2, 5), T = String.raw`${atanTex}x`;
    return spec(mcQ(rng, String.raw`Which expression is $\dfrac{d}{dx}\left(${c}x${T}\right)$?`, String.raw`$${c}${T} + \dfrac{${c}x}{1+x^2}$`, [
      { text: String.raw`$\dfrac{${c}}{1+x^2}$`, why: 'That differentiates $\\tan^{-1}x$ alone and drops the product rule: $x$ is also a function of $x$.' },
      { text: String.raw`$${c}${T} + \dfrac{${c}}{1+x^2}$`, why: 'The second term of the product rule is $x$ times the derivative of $\\tan^{-1}x$, so it has a factor $x$.' },
      { text: String.raw`$\dfrac{${c}${T}}{1+x^2}$`, why: 'A product is not differentiated by dividing: use $u\\,v\' + v\\,u\'$.' }], {
      dp: 1,
      hints: ['The function is a product of $x$ and $\\tan^{-1}x$ (times a constant).', 'Use $\\dfrac{d}{dx}(uv) = u\\dfrac{dv}{dx} + v\\dfrac{du}{dx}$.', String.raw`Recall $\dfrac{d}{dx}${atanTex}x = \dfrac{1}{1+x^2}$.`, String.raw`The result is $${c}${T} + \dfrac{${c}x}{1+x^2}$.`],
      steps: [
        { h: 'Product rule', d: String.raw`$u = ${c}x,\ v = ${T}$` },
        { h: 'Derivatives', d: String.raw`$u' = ${c},\ v' = \dfrac{1}{1+x^2}$` },
        { h: 'Combine', d: String.raw`$${c}x\cdot\dfrac{1}{1+x^2} + ${T}\cdot ${c} = ${c}${T} + \dfrac{${c}x}{1+x^2}$` }]
    }), 'fc-tan-product', { c });
  }),
  // choose the derivative of tan^-1(x/m)
  V([2], rng => {
    const m = ri(rng, 2, 7), m2 = m * m;
    return spec(mcQ(rng, String.raw`Which expression is $\dfrac{d}{dx}\,${atanTex}\left(\dfrac{x}{${m}}\right)$?`, String.raw`$\dfrac{${m}}{${m2}+x^2}$`, [
      { text: String.raw`$\dfrac{1}{1+\frac{x^2}{${m2}}}$`, why: String.raw`The chain rule factor $\dfrac{1}{${m}}$ is missing.` },
      { text: String.raw`$\dfrac{1}{${m2}+x^2}$`, why: String.raw`$\dfrac{1}{${m}}\cdot\dfrac{1}{1+x^2/${m2}}$ simplifies to $\dfrac{${m}}{${m2}+x^2}$, not $\dfrac{1}{${m2}+x^2}$.` },
      { text: String.raw`$\dfrac{${m}}{${m2}-x^2}$`, why: String.raw`The denominator of the $${atanTex}$ rule is $1 + u^2$, a sum.` }], {
      dp: 1,
      hints: ['Name the inner function $u = \\dfrac{x}{a}$ and find its derivative.', String.raw`Recall $\dfrac{d}{du}${atanTex}u = \dfrac{1}{1+u^2}$.`, 'Multiply, then put the result over a common denominator.', String.raw`The derivative is $\dfrac{${m}}{${m2}+x^2}$.`],
      steps: [
        { h: 'Chain rule', d: String.raw`$\dfrac{1}{${m}}\cdot\dfrac{1}{1+\frac{x^2}{${m2}}}$` },
        { h: 'Clear the inner fraction', d: String.raw`$\dfrac{1}{${m}}\cdot\dfrac{${m2}}{${m2}+x^2}$` },
        { h: 'Simplify', d: String.raw`$\dfrac{${m}}{${m2}+x^2}$` }]
    }), 'fc-tan-mcq', { m });
  }),
  // the y-value is given: read the argument back from it
  V([2], rng => {
    const a = rc(rng, [4, 8, 12, 16]), b = nz(rng, -5, 5);
    const [th, tex, k] = rc(rng, [['pi/4', String.raw`\dfrac{\pi}{4}`, 1 / 2], ['pi/3', String.raw`\dfrac{\pi}{3}`, 1 / 4], ['pi/6', String.raw`\dfrac{\pi}{6}`, 3 / 4]]);
    return spec(numQ(String.raw`Find the gradient of the curve $y = ${atanTex}(${lin(a, b)})$ at the point where $y = ${tex}$.`, a * k, {
      dp: 1,
      traps: [{ value: a, why: String.raw`The gradient is $\dfrac{${a}}{1+u^2}$ where $u = \tan y$, not $u = 1$.` }],
      hints: [
        String.raw`$\dfrac{dy}{dx} = \dfrac{${a}}{1+u^2}$ where $u = ${lin(a, b)}$.`,
        `You are given $y$, not $x$. Since $y = ${atanTex}u$, $u = \\tan y$.`,
        `Find $\\tan ${tex}$ and square it.`,
        `Dividing $${a}$ by $1 + \\tan^2 ${tex}$ gives the gradient $${a * k}$.`],
      steps: [
        { h: 'Gradient in terms of u', d: String.raw`$\dfrac{dy}{dx} = \dfrac{${a}}{1+u^2}$ with $u = ${lin(a, b)}$` },
        { h: 'Read u from y', d: `$u = \\tan y = \\tan ${tex}$` },
        { h: 'Evaluate', d: `$\\dfrac{${a}}{1 + \\tan^2 ${tex}} = ${a * k}$` }]
    }), 'fc-tan-yvalue', { a, b, th });
  }),
  // tangent at the point where the argument is 1
  V([2], rng => {
    const a = ri(rng, 2, 6);
    return spec(exprQ(String.raw`Find the equation of the tangent to $y = ${atanTex}(${co(a, 'x')})$ at the point where $x = \dfrac{1}{${a}}$. Give $y$ in terms of $x$ (write $\pi$ as pi).`, `(${a}/2)*x - 1/2 + pi/4`, {
      dp: 1, prefix: 'y =', hint: 'e.g. 3x/4 + pi/6',
      traps: [
        { expr: `${a}*x - 1/2 + pi/4`, why: String.raw`At $x = \dfrac{1}{${a}}$ the argument is $1$ and the gradient is $\dfrac{${a}}{1+1} = \dfrac{${a}}{2}$.` },
        { expr: `(${a}/2)*x`, why: String.raw`The tangent passes through $\left(\dfrac{1}{${a}}, \dfrac{\pi}{4}\right)$, not through the origin.` }],
      hints: [
        String.raw`Find the point: put $x = \dfrac{1}{${a}}$ into the curve. What is $${atanTex}1$?`,
        String.raw`Differentiate: $\dfrac{dy}{dx} = \dfrac{${a}}{1+${a * a}x^2}$. Evaluate at the point.`,
        'Use $y - y_1 = m(x - x_1)$ and expand.',
        `The point is $\\left(\\frac{1}{${a}}, \\frac{\\pi}{4}\\right)$ and the gradient is $\\frac{${a}}{2}$, so $y = \\frac{${a}}{2}x - \\frac12 + \\frac{\\pi}{4}$.`],
      steps: [
        { h: 'Point', d: String.raw`$y = ${atanTex}(1) = \dfrac{\pi}{4}$` },
        { h: 'Gradient', d: String.raw`$\dfrac{${a}}{1+${a * a}\cdot\frac{1}{${a * a}}} = \dfrac{${a}}{2}$` },
        { h: 'Tangent', d: String.raw`$y - \dfrac{\pi}{4} = \dfrac{${a}}{2}\left(x - \dfrac{1}{${a}}\right)$, so $y = \dfrac{${a}}{2}x - \dfrac12 + \dfrac{\pi}{4}$` }]
    }), 'fc-tan-tangent', { a });
  }),
  // a second derivative
  V([2], rng => {
    const c = ri(rng, 2, 6), t = ri(rng, 1, 3), val = (-2 * c * t) / (1 + t * t) ** 2;
    rej(!Number.isFinite(val) || Math.abs(val * 10000 - Math.round(val * 10000)) > 1e-6);
    return spec(numQ(String.raw`For $y = ${c}${atanTex}x$, find $\dfrac{d^2y}{dx^2}$ at $x = ${t}$.`, val, {
      dp: 1,
      traps: [{ value: c / (1 + t * t), why: 'That is the first derivative at the point. Differentiate once more.' }],
      hints: [
        String.raw`First derivative: $\dfrac{dy}{dx} = \dfrac{${c}}{1+x^2} = ${c}(1+x^2)^{-1}$.`,
        'Differentiate again with the chain rule.',
        `The second derivative is $\\dfrac{-${2 * c}x}{(1+x^2)^2}$. Substitute $x = ${t}$.`,
        `$\\dfrac{-${2 * c}\\times ${t}}{${1 + t * t}^2} = ${val}$.`],
      steps: [
        { h: 'First derivative', d: String.raw`$\dfrac{dy}{dx} = ${c}(1+x^2)^{-1}$` },
        { h: 'Second derivative', d: String.raw`$\dfrac{d^2y}{dx^2} = -${c}(1+x^2)^{-2}\cdot 2x = \dfrac{-${2 * c}x}{(1+x^2)^2}$` },
        { h: 'Evaluate', d: String.raw`At $x = ${t}$: $\dfrac{-${2 * c * t}}{${(1 + t * t) ** 2}} = ${val}$` }]
    }), 'fc-tan-second', { c, t });
  }),

  // ───────────── D3 · integrate to an inverse trigonometric function ─────────────
  // upper limit root 3
  V([3], rng => {
    const k = ri(rng, 2, 12);
    return spec(exactQ(String.raw`Evaluate $\displaystyle\int_0^{\sqrt3}\dfrac{${k}}{1+x^2}\,dx$. The answer is $c\pi$: type $c$ as a fraction in lowest terms (not $\pi$).`, k, 3, {
      dp: 2, prefix: 'c =',
      traps: [{ value: k / 4, why: String.raw`The upper limit is $\sqrt3$, so use $${atanTex}\sqrt3 = \dfrac{\pi}{3}$; $\dfrac{\pi}{4}$ belongs to the limit $1$.` }, { value: k, why: String.raw`The answer is $${k}\times\dfrac{\pi}{3}$: type the multiple of $\pi$.` }],
      hints: [
        String.raw`The integrand is the derivative of $${atanTex}x$.`,
        String.raw`Write the antiderivative and substitute both limits.`,
        String.raw`Which angle in $(0, \frac{\pi}{2})$ has tangent $\sqrt3$?`,
        String.raw`$${k}\left(\dfrac{\pi}{3} - 0\right) = \dfrac{${k}\pi}{3}$.`],
      steps: [
        { h: 'Antiderivative', d: String.raw`$${k}\left[${atanTex}x\right]_0^{\sqrt3}$` },
        { h: 'Limits', d: String.raw`$${atanTex}\sqrt3 = \dfrac{\pi}{3}$ and $${atanTex}0 = 0$` },
        { h: 'Value', d: String.raw`$\dfrac{${k}\pi}{3}$, so $c = ${frac(k / gcdI(k, 3), 3 / gcdI(k, 3))}$` }]
    }), 'fc-int-tan-root3', { k });
  }),
  // the a^2 + x^2 form
  V([3], rng => {
    const a = ri(rng, 2, 6), m = ri(rng, 2, 9);
    return spec(exactQ(String.raw`Evaluate $\displaystyle\int_0^{${a}}\dfrac{${m}}{${a * a}+x^2}\,dx$. The answer is $c\pi$: type $c$ as a fraction in lowest terms (not $\pi$).`, m, 4 * a, {
      dp: 2, prefix: 'c =',
      traps: [{ value: m / a, why: String.raw`$${atanTex}\left(\dfrac{${a}}{${a}}\right) = ${atanTex}1 = \dfrac{\pi}{4}$, so the integral also carries the factor $\dfrac14$.` }, { value: m / 4, why: String.raw`$\int\dfrac{dx}{a^2+x^2} = \dfrac{1}{a}${atanTex}\dfrac{x}{a}$: the factor $\dfrac{1}{a}$ must stay.` }],
      hints: [
        String.raw`Compare with $\int\dfrac{dx}{a^2+x^2}$: what is $a$ here?`,
        String.raw`Use $\int\dfrac{dx}{a^2+x^2} = \dfrac{1}{a}${atanTex}\dfrac{x}{a}$.`,
        'Substitute the limits and use an exact value for the angle.',
        String.raw`$\dfrac{${m}}{${a}}\cdot\dfrac{\pi}{4} = \dfrac{${m}\pi}{${4 * a}}$.`],
      steps: [
        { h: 'Recognise the form', d: `$${a * a} + x^2 = ${a}^2 + x^2$, so $a = ${a}$` },
        { h: 'Antiderivative', d: String.raw`$${m}\cdot\dfrac{1}{${a}}\left[${atanTex}\dfrac{x}{${a}}\right]_0^{${a}}$` },
        { h: 'Limits', d: String.raw`$\dfrac{${m}}{${a}}\left(${atanTex}1 - 0\right) = \dfrac{${m}}{${a}}\cdot\dfrac{\pi}{4}$` }]
    }), 'fc-int-a2x2', { a, m });
  }),
  // which antiderivative: the sine form
  V([3], rng => {
    const a = ri(rng, 2, 9);
    return spec(mcQ(rng, String.raw`Which function has derivative $\dfrac{1}{\sqrt{${a * a}-x^2}}$ for $-${a} < x < ${a}$?`, String.raw`$${asinTex}\left(\dfrac{x}{${a}}\right)$`, [
      { text: String.raw`$${a}${asinTex}\left(\dfrac{x}{${a}}\right)$`, why: String.raw`Differentiating gives $\dfrac{${a}}{\sqrt{${a * a}-x^2}}$: the factor $${a}$ is extra.` },
      { text: String.raw`$\dfrac{1}{${a}}${atanTex}\left(\dfrac{x}{${a}}\right)$`, why: String.raw`A square root of a difference leads to $${asinTex}$; $${atanTex}$ goes with a sum in the denominator.` },
      { text: String.raw`$${asinTex}x$`, why: String.raw`The constant $${a * a}$ under the root is $a^2$ with $a = ${a}$, so the argument is $\dfrac{x}{${a}}$.` }], {
      dp: 2,
      hints: ['Look at the shape: a square root of $a^2 - x^2$ in the denominator.', String.raw`Recall $\int\dfrac{dx}{\sqrt{a^2-x^2}} = ${asinTex}\dfrac{x}{a} + C$.`, `Find $a$ from $${a * a} = a^2$.`, String.raw`The antiderivative is $${asinTex}\left(\dfrac{x}{${a}}\right)$.`],
      steps: [
        { h: 'Match the form', d: `$${a * a} - x^2 = ${a}^2 - x^2$, so $a = ${a}$` },
        { h: 'Standard integral', d: String.raw`$\int\dfrac{dx}{\sqrt{a^2-x^2}} = ${asinTex}\dfrac{x}{a} + C$` },
        { h: 'Result', d: String.raw`$${asinTex}\left(\dfrac{x}{${a}}\right)$` }]
    }), 'fc-anti-sin', { a });
  }),
  // which antiderivative: the tangent form
  V([3], rng => {
    const a = ri(rng, 2, 9);
    return spec(mcQ(rng, String.raw`Which function has derivative $\dfrac{1}{${a * a}+x^2}$?`, String.raw`$\dfrac{1}{${a}}${atanTex}\left(\dfrac{x}{${a}}\right)$`, [
      { text: String.raw`$${atanTex}\left(\dfrac{x}{${a}}\right)$`, why: String.raw`That has derivative $\dfrac{${a}}{${a * a}+x^2}$: the factor $\dfrac{1}{${a}}$ is missing.` },
      { text: String.raw`$\dfrac{1}{${a * a}}${atanTex}\left(\dfrac{x}{${a}}\right)$`, why: String.raw`The factor is $\dfrac{1}{a}$, not $\dfrac{1}{a^2}$.` },
      { text: String.raw`$\dfrac{1}{${a}}${asinTex}\left(\dfrac{x}{${a}}\right)$`, why: String.raw`A sum in the denominator goes with $${atanTex}$; $${asinTex}$ needs a square root of a difference.` }], {
      dp: 2,
      hints: ['Look at the shape: a sum $a^2 + x^2$ in the denominator, no root.', String.raw`Recall $\int\dfrac{dx}{a^2+x^2} = \dfrac{1}{a}${atanTex}\dfrac{x}{a} + C$.`, `Find $a$ from $${a * a} = a^2$.`, String.raw`The antiderivative is $\dfrac{1}{${a}}${atanTex}\left(\dfrac{x}{${a}}\right)$.`],
      steps: [
        { h: 'Match the form', d: `$${a * a} + x^2 = ${a}^2 + x^2$, so $a = ${a}$` },
        { h: 'Standard integral', d: String.raw`$\int\dfrac{dx}{a^2+x^2} = \dfrac{1}{a}${atanTex}\dfrac{x}{a} + C$` },
        { h: 'Result', d: String.raw`$\dfrac{1}{${a}}${atanTex}\left(\dfrac{x}{${a}}\right)$` }]
    }), 'fc-anti-tan', { a });
  }),
  // limits that do not start at 0
  V([3], rng => {
    const a = ri(rng, 1, 4), k = ri(rng, 2, 9);
    const L = { h: [fr(a, 2), String.raw`\dfrac12`, 6], s2: [rad(a, 2, 2), String.raw`\dfrac{\sqrt2}{2}`, 4], s3: [rad(a, 3, 2), String.raw`\dfrac{\sqrt3}{2}`, 3] };
    const [lo, hi] = rc(rng, [['h', 's3'], ['s2', 's3'], ['h', 's2']]);
    const den = Math.round(1 / (1 / L[hi][2] - 1 / L[lo][2]));
    return spec(exactQ(String.raw`Evaluate $\displaystyle\int_{${L[lo][0]}}^{${L[hi][0]}}\dfrac{${k}}{\sqrt{${a * a}-x^2}}\,dx$. The answer is $c\pi$: type $c$ as a fraction in lowest terms (not $\pi$).`, k, den, {
      dp: 2, prefix: 'c =',
      traps: [{ value: k / L[hi][2], why: 'Subtract the value at the lower limit: it is not zero here.' }, { value: k / (L[hi][2] + L[lo][2]), why: 'The definite integral is the value at the upper limit **minus** the value at the lower limit.' }],
      hints: [
        String.raw`The integrand is $\dfrac{k}{\sqrt{a^2-x^2}}$ with $a = ${a}$: use $\int\dfrac{dx}{\sqrt{a^2-x^2}} = ${asinTex}\dfrac{x}{a}$.`,
        String.raw`Neither limit is $0$. Work out $${xover(a)}$ at each limit.`,
        String.raw`Use the exact angles whose sine is $\dfrac12$, $\dfrac{\sqrt2}{2}$ and $\dfrac{\sqrt3}{2}$.`,
        String.raw`$${k}\left(\dfrac{\pi}{${L[hi][2]}} - \dfrac{\pi}{${L[lo][2]}}\right) = ${cpi(k, den)}$.`],
      steps: [
        { h: 'Antiderivative', d: String.raw`$${k}\left[${asinTex}${xover(a)}\right]$ between the two limits` },
        { h: 'Arguments at the limits', d: String.raw`$${xover(a)}$ is $${L[lo][1]}$ at the lower limit and $${L[hi][1]}$ at the upper limit` },
        { h: 'Subtract', d: String.raw`$${k}\left(\dfrac{\pi}{${L[hi][2]}} - \dfrac{\pi}{${L[lo][2]}}\right) = ${cpi(k, den)}$` }]
    }), 'fc-int-sin-limits', { a, k, lo: L[lo][2], hi: L[hi][2] });
  }),
  // a value that is not a multiple of pi
  V([3], rng => {
    const a = ri(rng, 1, 3), b = ri(rng, 2, 7), k = ri(rng, 2, 9);
    rej(b === a || b === a * Math.sqrt(3));
    const v = (k / a) * Math.atan(b / a);
    rej(!safe3(v));
    return spec(numQ(String.raw`Evaluate $\displaystyle\int_0^{${b}}\dfrac{${k}}{${a * a}+x^2}\,dx$, correct to 3 decimal places (the angle is in radians).`, r3(v), {
      dp: 2, tol: 0.0005,
      traps: [{ value: r3(k * Math.atan(b / a)), why: String.raw`The antiderivative of $\dfrac{1}{a^2+x^2}$ is $\dfrac{1}{a}${atanTex}\dfrac{x}{a}$: the factor $\dfrac{1}{a}$ is missing.` }, { value: r3((k / a) * Math.atan(b)), why: String.raw`The argument is $\dfrac{x}{a}$, so at the upper limit it is $${fr(b, a)}$.` }],
      hints: [
        String.raw`The integrand has the form $\dfrac{k}{a^2+x^2}$ with $a = ${a}$.`,
        String.raw`The antiderivative is $\dfrac{k}{a}${atanTex}\dfrac{x}{a}$.`,
        String.raw`The upper limit gives $${atanTex}${fr(b, a)}$, which has no exact value: use a calculator in radian mode.`,
        `The value is $${fr(k, a)}\\times ${atanTex}${fr(b, a)} \\approx ${r3(v)}$.`],
      steps: [
        { h: 'Antiderivative', d: String.raw`$${fr(k, a)}\left[${atanTex}${xover(a)}\right]_0^{${b}}$` },
        { h: 'Upper limit', d: String.raw`$${atanTex}${fr(b, a)} \approx ${(Math.atan(b / a)).toFixed(4)}$ and $${atanTex}0 = 0$` },
        { h: 'Value', d: String.raw`$${fr(k, a)}\times ${(Math.atan(b / a)).toFixed(4)} \approx ${r3(v)}$` }]
    }), 'fc-int-decimal', { a, b, k });
  }),
  // find the constant from the value of the integral
  V([3], rng => {
    const a = ri(rng, 1, 4), c = ri(rng, 1, 5), k = 6 * c;
    return spec(numQ(String.raw`It is given that $\displaystyle\int_0^{${a % 2 === 0 ? a / 2 : a === 1 ? '\\tfrac12' : String.raw`\tfrac{${a}}{2}`}}\dfrac{k}{\sqrt{${a * a}-x^2}}\,dx = ${c === 1 ? '' : c}\pi$. Find the constant $k$.`, k, {
      dp: 2, prefix: 'k =',
      traps: [{ value: c, why: String.raw`$${asinTex}\dfrac12 = \dfrac{\pi}{6}$, so the integral equals $\dfrac{k\pi}{6}$, not $k\pi$.` }, { value: c / 6, why: String.raw`Solve $\dfrac{k\pi}{6} = ${c === 1 ? '' : c}\pi$ for $k$: multiply by $6$, do not divide.` }],
      hints: [
        String.raw`Integrate with $${asinTex}${xover(a)}$ and keep $k$ as a factor.`,
        String.raw`The upper limit gives $${asinTex}\dfrac12$.`,
        'Write the integral as a multiple of $\\pi$, then equate with the given value.',
        `$\\dfrac{k\\pi}{6} = ${c === 1 ? '' : c}\\pi$ gives $k = ${k}$.`],
      steps: [
        { h: 'Integrate', d: String.raw`$k\left[${asinTex}${xover(a)}\right]_0^{${a % 2 === 0 ? a / 2 : `${a}/2`}}$` },
        { h: 'Limits', d: String.raw`$k\left(${asinTex}\dfrac12 - 0\right) = \dfrac{k\pi}{6}$` },
        { h: 'Solve', d: `$\\dfrac{k\\pi}{6} = ${c === 1 ? '' : c}\\pi$, so $k = ${k}$` }]
    }), 'fc-int-find-k', { a, c });
  }),

  // ───────────── D4 · more decisions: factor, substitute, split, complete the square ─────────────
  // factor a perfect square out of the root
  V([4], rng => {
    const r = ri(rng, 2, 5), s = ri(rng, 1, 3);
    const [lim, limTex, ang] = rc(rng, [['h', fr(s, 2), 6], ['r2', rad(s, 2, 2), 4], ['r3', rad(s, 3, 2), 3]]);
    const A = r * r * s * s, B = r * r;
    return spec(exactQ(String.raw`Evaluate $\displaystyle\int_0^{${limTex}}\dfrac{dx}{\sqrt{${A}-${B}x^2}}$. The answer is $c\pi$: type $c$ as a fraction in lowest terms (not $\pi$).`, 1, ang * r, {
      dp: 2, prefix: 'c =',
      traps: [{ value: 1 / ang, why: String.raw`Factor $${B}$ out of the root first: $\sqrt{${A}-${B}x^2} = ${r}\sqrt{${s * s}-x^2}$, which leaves a factor $\dfrac{1}{${r}}$.` }, { value: 1 / (ang * B), why: String.raw`Taking $${B}$ out of the root gives $\sqrt{${B}} = ${r}$, not $${B}$.` }],
      hints: [
        `The coefficient of $x^2$ is not $1$. Factor $${B}$ out of **both** terms under the root.`,
        String.raw`$\sqrt{${A}-${B}x^2} = \sqrt{${B}}\sqrt{${s * s}-x^2}$: take $\sqrt{${B}}$ outside the integral as $\dfrac{1}{\sqrt{${B}}}$.`,
        String.raw`Integrate $\dfrac{1}{\sqrt{${s * s}-x^2}}$ to $${asinTex}${xover(s)}$ and substitute the limit.`,
        String.raw`$\dfrac{1}{${r}}\cdot\dfrac{\pi}{${ang}} = \dfrac{\pi}{${ang * r}}$.`],
      steps: [
        { h: 'Factor', d: String.raw`$\sqrt{${A}-${B}x^2} = ${r}\sqrt{${s * s}-x^2}$` },
        { h: 'Standard integral', d: String.raw`$\dfrac{1}{${r}}\left[${asinTex}${xover(s)}\right]_0^{${limTex}}$` },
        { h: 'Limit', d: String.raw`$${asinTex}\left(\dfrac{\text{limit}}{${s}}\right) = \dfrac{\pi}{${ang}}$, so the value is $\dfrac{\pi}{${ang * r}}$` }]
    }), 'fc-int-factor', { r, s, lim });
  }),
  // substitution u = sin x or u = cos x
  V([4], rng => {
    const k = ri(rng, 2, 9), useSin = rng() < 0.5;
    const integrand = useSin ? String.raw`\dfrac{${k}\cos x}{1+\sin^2 x}` : String.raw`\dfrac{${k}\sin x}{1+\cos^2 x}`;
    const [lo, hi] = useSin ? ['0', String.raw`\dfrac{\pi}{2}`] : ['0', String.raw`\dfrac{\pi}{2}`];
    return spec(exactQ(String.raw`Evaluate $\displaystyle\int_{${lo}}^{${hi}} ${integrand}\,dx$ using a substitution. The answer is $c\pi$: type $c$ as a fraction in lowest terms (not $\pi$).`, k, 4, {
      dp: 2, prefix: 'c =',
      traps: [{ value: k / 2, why: String.raw`After the substitution the limits become $0$ and $1$, and $${atanTex}1 = \dfrac{\pi}{4}$.` }, { value: k, why: String.raw`The new integral is $\int_0^1\dfrac{${k}\,du}{1+u^2} = ${k}${atanTex}1$ and $${atanTex}1 = \dfrac{\pi}{4}$.` }],
      hints: [
        `Which part of the integrand is the derivative of another part? Let $u$ be that other part.`,
        useSin ? `Let $u = \\sin x$, so $du = \\cos x\\,dx$.` : `Let $u = \\cos x$, so $du = -\\sin x\\,dx$ (watch the sign, then swap the limits back).`,
        'Change the limits to values of $u$ and integrate with respect to $u$.',
        String.raw`$${k}\left[${atanTex}u\right]_0^1 = \dfrac{${k}\pi}{4}$.`],
      steps: [
        { h: 'Substitute', d: useSin ? String.raw`$u = \sin x$, $du = \cos x\,dx$; limits $0 \to 1$` : String.raw`$u = \cos x$, $du = -\sin x\,dx$; limits $1 \to 0$` },
        { h: 'New integral', d: String.raw`$\int_0^1\dfrac{${k}\,du}{1+u^2}$` },
        { h: 'Integrate', d: String.raw`$${k}\left[${atanTex}u\right]_0^1 = \dfrac{${k}\pi}{4}$` }]
    }), 'fc-int-trigsub', { k, useSin });
  }),
  // substitution u = e^x
  V([4], rng => {
    const k = ri(rng, 2, 9), tanForm = rng() < 0.5;
    const prompt = tanForm
      ? String.raw`Evaluate $\displaystyle\int_0^{\ln\sqrt3}\dfrac{${k}e^x}{1+e^{2x}}\,dx$ using the substitution $u = e^x$. The answer is $c\pi$: type $c$ as a fraction in lowest terms (not $\pi$).`
      : String.raw`Evaluate $\displaystyle\int_{-\ln 2}^{-\frac12\ln 2}\dfrac{${k}e^x}{\sqrt{1-e^{2x}}}\,dx$ using the substitution $u = e^x$. The answer is $c\pi$: type $c$ as a fraction in lowest terms (not $\pi$).`;
    return spec(exactQ(prompt, k, 12, {
      dp: 2, prefix: 'c =',
      traps: [{ value: k / 4, why: tanForm ? String.raw`The limits become $u = 1$ and $u = \sqrt3$: subtract $${atanTex}1 = \dfrac{\pi}{4}$ from $${atanTex}\sqrt3 = \dfrac{\pi}{3}$.` : String.raw`The limits become $u = \frac12$ and $u = \frac{\sqrt2}{2}$: subtract $\dfrac{\pi}{6}$ from $\dfrac{\pi}{4}$.` }, { value: k / 3, why: 'Both limits matter: the value at the lower limit is not zero.' }],
      hints: [
        `With $u = e^x$, what is $du$? It should match the numerator.`,
        'Change both limits from $x$ to $u$ (use $e^{\\ln a} = a$).',
        tanForm ? String.raw`The new integral is $\int\dfrac{${k}\,du}{1+u^2}$: it integrates to $${k}${atanTex}u$.` : String.raw`The new integral is $\int\dfrac{${k}\,du}{\sqrt{1-u^2}}$: it integrates to $${k}${asinTex}u$.`,
        String.raw`$${k}\left(\dfrac{\pi}{${tanForm ? 3 : 4}} - \dfrac{\pi}{${tanForm ? 4 : 6}}\right) = \dfrac{${k}\pi}{12}$.`],
      steps: [
        { h: 'Substitute', d: `$u = e^x$, $du = e^x\\,dx$` },
        { h: 'New limits', d: tanForm ? String.raw`$x = 0 \to u = 1$ and $x = \ln\sqrt3 \to u = \sqrt3$` : String.raw`$x = -\ln 2 \to u = \frac12$ and $x = -\frac12\ln 2 \to u = \frac{\sqrt2}{2}$` },
        { h: 'Integrate', d: tanForm ? String.raw`$${k}\left[${atanTex}u\right]_1^{\sqrt3} = ${k}\left(\dfrac{\pi}{3}-\dfrac{\pi}{4}\right) = \dfrac{${k}\pi}{12}$` : String.raw`$${k}\left[${asinTex}u\right]_{1/2}^{\sqrt2/2} = ${k}\left(\dfrac{\pi}{4}-\dfrac{\pi}{6}\right) = \dfrac{${k}\pi}{12}$` }]
    }), 'fc-int-expsub', { k, tanForm });
  }),
  // substitution u = x^2
  V([4], rng => {
    const k = ri(rng, 2, 9), sinForm = rng() < 0.5;
    const prompt = sinForm
      ? String.raw`Evaluate $\displaystyle\int_0^{1/\sqrt2}\dfrac{${k}x}{\sqrt{1-x^4}}\,dx$ using the substitution $u = x^2$. The answer is $c\pi$: type $c$ as a fraction in lowest terms (not $\pi$).`
      : String.raw`Evaluate $\displaystyle\int_0^{1}\dfrac{${k}x}{1+x^4}\,dx$ using the substitution $u = x^2$. The answer is $c\pi$: type $c$ as a fraction in lowest terms (not $\pi$).`;
    return spec(exactQ(prompt, k, sinForm ? 12 : 8, {
      dp: 2, prefix: 'c =',
      traps: [{ value: sinForm ? k / 6 : k / 4, why: 'The substitution gives $du = 2x\\,dx$, so $x\\,dx = \\tfrac12\\,du$: keep the factor $\\tfrac12$.' }],
      hints: [
        'Let $u = x^2$. What is $du$ in terms of $x\\,dx$?',
        'Rewrite the whole integral in $u$, including the limits.',
        sinForm ? String.raw`The new integral is $\dfrac{${k}}{2}\int_0^{1/2}\dfrac{du}{\sqrt{1-u^2}}$.` : String.raw`The new integral is $\dfrac{${k}}{2}\int_0^{1}\dfrac{du}{1+u^2}$.`,
        sinForm ? String.raw`$\dfrac{${k}}{2}\cdot\dfrac{\pi}{6} = \dfrac{${k}\pi}{12}$.` : String.raw`$\dfrac{${k}}{2}\cdot\dfrac{\pi}{4} = \dfrac{${k}\pi}{8}$.`],
      steps: [
        { h: 'Substitute', d: String.raw`$u = x^2$, $x\,dx = \tfrac12\,du$` },
        { h: 'New limits', d: sinForm ? String.raw`$x = 0 \to u = 0$ and $x = \dfrac{1}{\sqrt2} \to u = \dfrac12$` : String.raw`$x = 0 \to u = 0$ and $x = 1 \to u = 1$` },
        { h: 'Integrate', d: sinForm ? String.raw`$\dfrac{${k}}{2}\left[${asinTex}u\right]_0^{1/2} = \dfrac{${k}\pi}{12}$` : String.raw`$\dfrac{${k}}{2}\left[${atanTex}u\right]_0^1 = \dfrac{${k}\pi}{8}$` }]
    }), 'fc-int-xsq', { k, sinForm });
  }),
  // an area
  V([4], rng => {
    const a = ri(rng, 1, 4), k = ri(rng, 3, 12), v = (k / a) * (Math.PI / 3);
    rej(!safe3(v));
    return spec(numQ(String.raw`The region $R$ is bounded by the curve $y = \dfrac{${k}}{${a * a}+x^2}$, the $x$-axis, the $y$-axis and the line $x = ${a === 1 ? '' : a}\sqrt3$. Find the area of $R$ in square units, correct to 3 decimal places.`, r3(v), {
      dp: 2, tol: 0.0005,
      traps: [{ value: r3((k / a) * (Math.PI / 4)), why: String.raw`The upper limit is $${a === 1 ? '' : a}\sqrt3$, so the argument is $\sqrt3$ and $${atanTex}\sqrt3 = \dfrac{\pi}{3}$.` }, { value: r3(k * (Math.PI / 3)), why: String.raw`The antiderivative of $\dfrac{1}{a^2+x^2}$ has the factor $\dfrac{1}{a}$.` }],
      hints: [
        'The area under a curve from $x = 0$ is a definite integral: write it down with its limits.',
        String.raw`The integrand has the form $\dfrac{k}{a^2+x^2}$; find $a$.`,
        'Integrate, substitute the limits and use an exact angle.',
        String.raw`Area $= ${fr(k, a)}\cdot\dfrac{\pi}{3} \approx ${r3(v)}$.`],
      steps: [
        { h: 'Set up', d: String.raw`$A = \int_0^{${a === 1 ? '' : a}\sqrt3}\dfrac{${k}}{${a * a}+x^2}\,dx$` },
        { h: 'Integrate', d: String.raw`$${fr(k, a)}\left[${atanTex}${xover(a)}\right]_0^{${a === 1 ? '' : a}\sqrt3} = ${fr(k, a)}\left(${atanTex}\sqrt3 - 0\right)$` },
        { h: 'Value', d: String.raw`$${fr(k, a)}\cdot\dfrac{\pi}{3} \approx ${r3(v)}$` }]
    }), 'fc-int-area', { a, k });
  }),
  // which substitution
  V([4], rng => {
    const sinCase = rng() < 0.5;
    const integrand = sinCase ? String.raw`\dfrac{\cos x}{1+\sin^2 x}` : String.raw`\dfrac{e^x}{1+e^{2x}}`;
    const ok = sinCase ? '$u = \\sin x$' : '$u = e^x$';
    const ds = sinCase
      ? [{ text: '$u = \\cos x$', why: 'Then $du = -\\sin x\\,dx$, but the numerator holds $\\cos x$, not $\\sin x$.' }, { text: '$u = 1 + \\sin^2 x$', why: 'Then $du = 2\\sin x\\cos x\\,dx$: the numerator does not match, and the result is not a standard form.' }, { text: '$u = \\tan x$', why: 'Then $du = \\sec^2 x\\,dx$, which is not in the integrand.' }]
      : [{ text: '$u = e^{2x}$', why: 'Then $du = 2e^{2x}\\,dx$, but the numerator is $e^x$.' }, { text: '$u = 1 + e^{2x}$', why: 'Then $du = 2e^{2x}\\,dx$: the numerator does not match.' }, { text: '$u = x$', why: 'That changes nothing: the integrand is still in $x$.' }];
    return spec(mcQ(rng, String.raw`Which substitution turns $\displaystyle\int ${integrand}\,dx$ into the standard form $\displaystyle\int\dfrac{du}{1+u^2}$?`, ok, ds, {
      dp: 2,
      hints: ['The substitution must turn the denominator into $1 + u^2$ **and** absorb the numerator as $du$.', 'Which part of the denominator is a square, and what is that square of?', 'Differentiate your candidate $u$: does $du$ match the numerator?', sinCase ? 'With $u = \\sin x$, $du = \\cos x\\,dx$ and the denominator is $1 + u^2$.' : 'With $u = e^x$, $du = e^x\\,dx$ and the denominator is $1 + u^2$.'],
      steps: [
        { h: 'Look for the square', d: sinCase ? '$1 + \\sin^2 x$ is $1 + u^2$ for $u = \\sin x$' : '$1 + e^{2x}$ is $1 + u^2$ for $u = e^x$' },
        { h: 'Check the numerator', d: sinCase ? '$du = \\cos x\\,dx$ is exactly the numerator' : '$du = e^x\\,dx$ is exactly the numerator' },
        { h: 'Result', d: String.raw`$\int\dfrac{du}{1+u^2}$` }]
    }), 'fc-sub-mcq', { sinCase });
  }),
  // split the numerator: a log part and an inverse tangent part
  V([4], rng => {
    const p = rc(rng, [2, 4, 6]), q = ri(rng, 1, 5), v = (p / 2) * Math.log(2) + (q * Math.PI) / 4;
    const P2 = p / 2 === 1 ? '' : p / 2, Q = q === 1 ? '' : q;
    rej(!safe3(v));
    return spec(numQ(String.raw`Evaluate $\displaystyle\int_0^1\dfrac{${p}x + ${q}}{1+x^2}\,dx$, correct to 3 decimal places.`, r3(v), {
      dp: 2, tol: 0.0005,
      traps: [{ value: r3((q * Math.PI) / 4), why: String.raw`The term $\dfrac{${p}x}{1+x^2}$ is not zero: it is of the form $\dfrac{f'(x)}{f(x)}$ and integrates to a logarithm.` }, { value: r3((p / 2) * Math.log(2)), why: String.raw`The constant part $\dfrac{${q}}{1+x^2}$ also contributes: it integrates to $${Q}${atanTex}x$.` }],
      hints: [
        'Split the numerator into two integrals with the same denominator.',
        String.raw`One integrand is $\dfrac{${p}x}{1+x^2}$: the numerator is a multiple of the derivative of $1 + x^2$.`,
        String.raw`The other is $\dfrac{${q}}{1+x^2}$, a standard $${atanTex}$ form. Integrate each and use a calculator for the decimal.`,
        `The value is $${P2}\\ln 2 + ${cpi(q, 4)} \\approx ${r3(v)}$.`],
      steps: [
        { h: 'Split', d: String.raw`$\int_0^1\dfrac{${p}x}{1+x^2}\,dx + \int_0^1\dfrac{${q}}{1+x^2}\,dx$` },
        { h: 'Logarithm part', d: String.raw`$${P2}\left[\ln(1+x^2)\right]_0^1 = ${P2}\ln 2$` },
        { h: 'Inverse tangent part', d: String.raw`$${Q}\left[${atanTex}x\right]_0^1 = ${cpi(q, 4)}$` },
        { h: 'Add', d: `$${r3((p / 2) * Math.log(2))} + ${r3((q * Math.PI) / 4)} \\approx ${r3(v)}$` }]
    }), 'fc-int-split', { p, q });
  })
];
function gcdI(a, b) { while (b) [a, b] = [b, a % b]; return a || 1; }

// ═══════════════════════════ me11-binomial ═══════════════════════════════════
// Cell dot points: D1 = 0 (evaluate a coefficient), D2 and D3 = 1 (coefficient of a term), D4 = 2 (sum of coefficients).
const P = (n, k) => { let r = 1; for (let i = 0; i < k; i++) r *= n - i; return r; };

const binForms = [
  // ───────────── D1 · evaluate and use binomial coefficients ─────────────
  V([1], rng => {
    const n = ri(rng, 6, 12), k = ri(rng, 2, 4);
    return spec(numQ(`A netball club has ${n} players available and the coach picks a team of ${k}. The order in which the players are picked does not matter. How many different teams can be picked?`, C(n, k), {
      dp: 0,
      traps: [{ value: P(n, k), why: `Order does not matter, so divide the ${P(n, k)} ordered selections by $${k}!$.` }],
      hints: ['Choosing a group where order does not matter is a combination.', 'The number of ways is $\\dbinom{n}{k}$.', `Write $\\dbinom{${n}}{${k}} = \\dfrac{${n}!}{${k}!\\,${n - k}!}$ and cancel before multiplying.`, `$\\dbinom{${n}}{${k}} = ${C(n, k)}$.`],
      steps: [{ h: 'Combination', d: `Teams: $\\dbinom{${n}}{${k}}$` }, { h: 'Expand', d: `$\\dfrac{${n}!}{${k}!\\,${n - k}!}$` }, { h: 'Evaluate', d: `$${C(n, k)}$` }]
    }), 'bin-context', { n, k });
  }),
  V([1], rng => {
    const n = ri(rng, 6, 25), m = (n * (n - 1)) / 2;
    return spec(numQ(`The positive integer $n$ satisfies $\\dbinom{n}{2} = ${m}$. Find $n$.`, n, {
      dp: 0, prefix: 'n =',
      traps: [{ value: n - 1, why: `$\\dbinom{n}{2} = \\dfrac{n(n-1)}{2}$: both factors matter, so $n(n-1) = ${2 * m}$ and $n$ is the larger factor.` }, { value: m / 2, why: `$\\dbinom{n}{2}$ is $\\dfrac{n(n-1)}{2}$, not $\\dfrac{n}{2}$.` }],
      hints: ['Write $\\dbinom{n}{2}$ without factorials.', '$\\dbinom{n}{2} = \\dfrac{n(n-1)}{2}$, so $n(n-1)$ equals twice the given value.', `Find two consecutive integers with product $${2 * m}$.`, `$${n} \\times ${n - 1} = ${2 * m}$, so $n = ${n}$.`],
      steps: [{ h: 'Expand', d: `$\\dfrac{n(n-1)}{2} = ${m}$` }, { h: 'Clear the fraction', d: `$n(n-1) = ${2 * m}$` }, { h: 'Consecutive integers', d: `$${n} \\times ${n - 1} = ${2 * m}$, so $n = ${n}$` }]
    }), 'bin-find-n', { n });
  }),
  V([1], rng => {
    const n = ri(rng, 5, 12), k = ri(rng, 2, n - 3);
    return spec(numQ(`Evaluate $\\dbinom{${n}}{${k}} + \\dbinom{${n}}{${k + 1}}$.`, C(n + 1, k + 1), {
      dp: 0,
      traps: [{ value: C(n, k) * C(n, k + 1), why: 'The two coefficients are added, not multiplied.' }, { value: C(n + 1, k), why: String.raw`Pascal's identity gives $\dbinom{n}{k} + \dbinom{n}{k+1} = \dbinom{n+1}{k+1}$: the lower number is $k + 1$.` }],
      hints: ['Both terms are in the same row of Pascal\'s triangle, side by side.', 'Two neighbours add to the entry below them.', `The entry below is in row $${n + 1}$.`, `$\\dbinom{${n}}{${k}} + \\dbinom{${n}}{${k + 1}} = \\dbinom{${n + 1}}{${k + 1}} = ${C(n + 1, k + 1)}$.`],
      steps: [{ h: 'Pascal\'s identity', d: `$\\dbinom{${n}}{${k}} + \\dbinom{${n}}{${k + 1}} = \\dbinom{${n + 1}}{${k + 1}}$` }, { h: 'Evaluate', d: `$\\dfrac{${n + 1}!}{${k + 1}!\\,${n - k}!} = ${C(n + 1, k + 1)}$` }, { h: 'Check', d: `$${C(n, k)} + ${C(n, k + 1)} = ${C(n, k) + C(n, k + 1)}$` }]
    }), 'bin-pascal', { n, k });
  }),
  V([1], rng => {
    const n = ri(rng, 7, 14), k = ri(rng, 2, Math.floor((n - 1) / 2));
    rej([k + 1, k - 1].some(j => C(n, j) === C(n, k)) || C(n - k, k) === C(n, k));
    const opts = [
      { text: `$\\dbinom{${n}}{${n - k}}$` },
      { text: `$\\dbinom{${n}}{${k + 1}}$`, why: 'Neighbouring entries in a row differ; the equal partner is the one the same distance from the other end.' },
      { text: `$\\dbinom{${n - k}}{${k}}$`, why: 'Changing the top number changes the row, so the value changes.' },
      { text: `$\\dbinom{${n}}{${k - 1}}$`, why: 'Neighbouring entries in a row differ; the equal partner is the one the same distance from the other end.' }];
    return spec(mcQ(rng, `Which of these is equal to $\\dbinom{${n}}{${k}}$?`, opts[0].text, opts.slice(1), {
      dp: 0,
      hints: ['Think of choosing the $k$ players to include, or the players to leave out.', 'Choosing $k$ to include is the same as choosing $n - k$ to leave out.', 'So the entries $\\dbinom{n}{k}$ and $\\dbinom{n}{n-k}$ are mirror images in row $n$.', `The partner is $\\dbinom{${n}}{${n - k}}$.`],
      steps: [{ h: 'Symmetry', d: '$\\dbinom{n}{k} = \\dfrac{n!}{k!(n-k)!} = \\dbinom{n}{n-k}$' }, { h: 'Substitute', d: `$n = ${n}$, $k = ${k}$ gives $\\dbinom{${n}}{${n - k}}$` }]
    }), 'bin-symmetry', { n, k, opts: [[n, n - k], [n, k + 1], [n - k, k], [n, k - 1]] });
  }),
  V([1], rng => {
    const n = ri(rng, 8, 20), k = ri(rng, 2, Math.floor((n - 1) / 2) - 0);
    rej(2 * k >= n);
    return spec(numQ(`The coefficient of $x^{r}$ in $(1+x)^{${n}}$ is the same for $r = ${k}$ and for exactly one other value of $r$. Find that other value of $r$.`, n - k, {
      dp: 0,
      traps: [{ value: k, why: `$r = ${k}$ is the value you were given; the question asks for the other one.` }, { value: n - k + 1, why: `Count from the start of the row: the entry in position $r$ has the same value as the one in position $n - r$.` }],
      hints: ['The coefficients of $(1+x)^n$ are $\\dbinom{n}{0}, \\dbinom{n}{1}, \\dots, \\dbinom{n}{n}$.', 'The row reads the same forwards and backwards.', `Match $\\dbinom{${n}}{${k}}$ with its mirror image.`, `The other value is $${n} - ${k} = ${n - k}$.`],
      steps: [{ h: 'Coefficients', d: `The coefficient of $x^{r}$ is $\\dbinom{${n}}{r}$` }, { h: 'Symmetry', d: `$\\dbinom{${n}}{r} = \\dbinom{${n}}{${n} - r}$` }, { h: 'Other value', d: `$r = ${n} - ${k} = ${n - k}$` }]
    }), 'bin-mirror', { n, k });
  }),

  // ───────────── D2 · the coefficient of a term ─────────────
  V([2], rng => {
    const n = ri(rng, 5, 9), k = ri(rng, 2, 4), a = rc(rng, [2, 3, 4, -2, -3]);
    return spec(numQ(`Find the coefficient of $x^{${k}}$ in the expansion of $(1 ${sg(a)}x)^{${n}}$.`, C(n, k) * a ** k, {
      dp: 1,
      traps: [{ value: C(n, k) * a, why: `The term is $\\dbinom{${n}}{${k}}(${a}x)^{${k}}$: the constant is raised to the power $${k}$ along with $x$.` }, { value: C(n, k), why: `The coefficient of $x^{${k}}$ is not $\\dbinom{${n}}{${k}}$ alone: the term is $(${a}x)^{${k}}$.` }],
      hints: ['Treat $ax$ as a single quantity in $(1 + \\text{that})^n$.', `The term in $x^{${k}}$ is $\\dbinom{${n}}{${k}}(${a}x)^{${k}}$.`, `Expand $(${a}x)^{${k}}$, including the sign, then multiply by $\\dbinom{${n}}{${k}}$.`, `$${C(n, k)}\\times(${a})^{${k}} = ${C(n, k) * a ** k}$.`],
      steps: [{ h: 'General term', d: `$\\dbinom{${n}}{r}(${a}x)^{r}$` }, { h: `Take r = ${k}`, d: `$\\dbinom{${n}}{${k}}(${a})^{${k}}x^{${k}}$` }, { h: 'Coefficient', d: `$${C(n, k)}\\times ${a ** k} = ${C(n, k) * a ** k}$` }]
    }), 'bin-ax', { n, k, a });
  }),
  V([2], rng => {
    const n = ri(rng, 5, 9), m = ri(rng, 4, 8), k = ri(rng, 2, 4);
    rej(n === m);
    return spec(numQ(`Find the coefficient of $x^{${k}}$ in the expansion of $(1+x)^{${n}} + (1+x)^{${m}}$.`, C(n, k) + C(m, k), {
      dp: 1,
      traps: [{ value: C(n + m, k), why: 'The two expansions are **added**: add their coefficients. (A product would combine the powers.)' }, { value: C(n, k), why: 'Both brackets contribute a term in $x^{k}$.' }],
      hints: ['Each bracket has its own expansion; the coefficients of $x^k$ add.', `In $(1+x)^{${n}}$ the coefficient is $\\dbinom{${n}}{${k}}$.`, `In $(1+x)^{${m}}$ it is $\\dbinom{${m}}{${k}}$.`, `$${C(n, k)} + ${C(m, k)} = ${C(n, k) + C(m, k)}$.`],
      steps: [{ h: 'First bracket', d: `$\\dbinom{${n}}{${k}} = ${C(n, k)}$` }, { h: 'Second bracket', d: `$\\dbinom{${m}}{${k}} = ${C(m, k)}$` }, { h: 'Add', d: `$${C(n, k) + C(m, k)}$` }]
    }), 'bin-sum-two', { n, m, k });
  }),
  V([2], rng => {
    const p = ri(rng, 1, 6), q = ri(rng, p + 1, 8);
    return spec(numQ(`In the expansion of $(1+x)^{n}$ the coefficients of $x^{${p}}$ and $x^{${q}}$ are equal. Find $n$.`, p + q, {
      dp: 1, prefix: 'n =',
      traps: [{ value: q - p, why: `Equal coefficients are mirror images in the row, so the two powers add up to $n$, they do not subtract.` }, { value: p + q - 1, why: `The entries $\\dbinom{n}{${p}}$ and $\\dbinom{n}{${q}}$ are equal when $${p} + ${q} = n$.` }],
      hints: ['The coefficient of $x^r$ is $\\dbinom{n}{r}$.', 'Two entries of the same row are equal when they are the same distance from the two ends.', `So $\\dbinom{n}{${p}} = \\dbinom{n}{n-${p}}$, and $n - ${p}$ must be $${q}$.`, `$n = ${p} + ${q} = ${p + q}$.`],
      steps: [{ h: 'Coefficients', d: `$\\dbinom{n}{${p}} = \\dbinom{n}{${q}}$` }, { h: 'Symmetry', d: `Equal entries satisfy $${p} + ${q} = n$` }, { h: 'Answer', d: `$n = ${p + q}$` }]
    }), 'bin-equal-coeffs', { p, q });
  }),
  V([2], rng => {
    const a = ri(rng, 2, 5), n = ri(rng, 5, 9);
    const correct = { text: `$\\dbinom{n}{r}${a}^{r}x^{r}$` };
    return spec(mcQ(rng, `The general term in $x^{r}$ of $(1 + ${a}x)^{n}$ is:`, correct.text, [
      { text: `$\\dbinom{n}{r}\\cdot ${a}\\,x^{r}$`, why: `The whole of $${a}x$ is raised to the power $r$, so the constant becomes $${a}^{r}$.` },
      { text: `$\\dbinom{n}{r}${a}^{n-r}x^{r}$`, why: `The power of the constant matches the power of $x$: $(${a}x)^{r}$ gives $${a}^{r}$, while $1^{n-r}$ stays $1$.` },
      { text: `$\\dbinom{n}{r+1}${a}^{r}x^{r}$`, why: 'The binomial coefficient for the power $x^{r}$ is $\\dbinom{n}{r}$.' }], {
      dp: 1,
      hints: ['Write $(1 + ax)^n$ as $(1 + y)^n$ with $y = ax$.', 'The general term of $(1+y)^n$ is $\\dbinom{n}{r}y^{r}$.', 'Substitute $y = ax$ and expand $(ax)^{r}$.', `The general term is $\\dbinom{n}{r}${a}^{r}x^{r}$.`],
      steps: [{ h: 'Rename', d: `$y = ${a}x$` }, { h: 'General term of $(1+y)^n$', d: '$\\dbinom{n}{r}y^{r}$' }, { h: 'Substitute', d: `$\\dbinom{n}{r}(${a}x)^{r} = \\dbinom{n}{r}${a}^{r}x^{r}$` }]
    }), 'bin-general-term', { a, n });
  }),
  V([2], rng => {
    const m = ri(rng, 2, 6), n = ri(rng, 2, 6), k = ri(rng, 2, 5);
    rej(k > m + n || C(m, k) + C(n, k) === C(m + n, k));
    return spec(numQ(`Find the coefficient of $x^{${k}}$ in the expansion of $(1+x)^{${m}}(1+x)^{${n}}$.`, C(m + n, k), {
      dp: 1,
      traps: [{ value: C(m, k) + C(n, k), why: 'The brackets are **multiplied**, so terms of different powers from each bracket combine: do not just add the two coefficients.' }, { value: C(m, k) * C(n, k), why: 'Multiplying the two coefficients mixes powers: $x^{k}\\times x^{k}$ is $x^{2k}$.' }],
      hints: ['Two brackets with the same base multiply by adding their powers.', `$(1+x)^{${m}}(1+x)^{${n}} = (1+x)^{?}$.`, 'Now find the coefficient in the single power.', `The product is $(1+x)^{${m + n}}$ and the coefficient is $\\dbinom{${m + n}}{${k}} = ${C(m + n, k)}$.`],
      steps: [{ h: 'Combine the powers', d: `$(1+x)^{${m}}(1+x)^{${n}} = (1+x)^{${m + n}}$` }, { h: 'Coefficient', d: `$\\dbinom{${m + n}}{${k}}$` }, { h: 'Evaluate', d: `$${C(m + n, k)}$` }]
    }), 'bin-product-powers', { m, n, k });
  }),
  V([2], rng => {
    const n = rc(rng, [6, 8, 10, 12, 14, 16]);
    return spec(numQ(`In the expansion of $(1+x)^{${n}}$, the coefficient of $x^{r}$ is largest for exactly one value of $r$. Find $r$.`, n / 2, {
      dp: 1, prefix: 'r =',
      traps: [{ value: n, why: `The coefficients rise to a peak and then fall: $\\dbinom{${n}}{${n}} = 1$ is the smallest, not the largest.` }, { value: n / 2 + 1, why: `The row is symmetric about its middle entry, which is at $r = \\dfrac{n}{2}$.` }],
      hints: ['List a few rows of Pascal\'s triangle and see where the largest entry sits.', 'The row is symmetric, so the largest entry is in the middle.', `The row has $${n} + 1$ entries.`, `The middle entry is at $r = ${n / 2}$.`],
      steps: [{ h: 'Symmetry', d: `$\\dbinom{${n}}{r} = \\dbinom{${n}}{${n}-r}$` }, { h: 'Peak', d: `The row rises to its centre and then falls` }, { h: 'Middle', d: `$r = \\dfrac{${n}}{2} = ${n / 2}$` }]
    }), 'bin-middle', { n });
  }),

  // ───────────── D3 · terms of (ax + b)^n and other expansions ─────────────
  V([3], rng => {
    const n = ri(rng, 4, 6), k = ri(rng, 2, 3), a = rc(rng, [2, 3]), b = nz(rng, -3, 4);
    const v = C(n, k) * a ** k * b ** (n - k);
    return spec(numQ(`Find the coefficient of $x^{${k}}$ in the expansion of $(${a}x ${sg(b)})^{${n}}$.`, v, {
      dp: 1,
      traps: [{ value: C(n, k) * a ** (n - k) * b ** k, why: `The power of $x$ is the power of the first term, so $(${a}x)^{${k}}$ goes with $(${b})^{${n - k}}$.` }, { value: C(n, k) * b ** (n - k), why: `$(${a}x)^{${k}}$ contributes $${a}^{${k}}$ to the coefficient.` }],
      hints: [`The general term is $\\dbinom{${n}}{r}(${a}x)^{r}(${b})^{${n}-r}$.`, `For $x^{${k}}$ take $r = ${k}$.`, 'Evaluate the three factors: the binomial coefficient, the power of the $x$-coefficient and the power of the constant.', `$${C(n, k)}\\times ${a ** k}\\times(${b})^{${n - k}} = ${v}$.`],
      steps: [{ h: 'General term', d: `$\\dbinom{${n}}{r}(${a}x)^{r}(${b})^{${n}-r}$` }, { h: `r = ${k}`, d: `$\\dbinom{${n}}{${k}}(${a})^{${k}}(${b})^{${n - k}}x^{${k}}$` }, { h: 'Coefficient', d: `$${C(n, k)}\\times ${a ** k}\\times ${b ** (n - k)} = ${v}$` }]
    }), 'bin-axb', { n, k, a, b });
  }),
  V([3], rng => {
    const branch = rng() < 0.5;
    if (branch) {
      const m = ri(rng, 2, 4), c = rc(rng, [1, 2, 3, -1, -2]);
      return spec(numQ(`Find the term independent of $x$ in the expansion of $\\left(x + \\dfrac{${c}}{x}\\right)^{${2 * m}}$.`, C(2 * m, m) * c ** m, {
        dp: 1,
        traps: [{ value: C(2 * m, m), why: `The constant $${c}$ is raised to the same power as $\\dfrac1x$: here $${m}$.` }, { value: c ** m, why: `Include the binomial coefficient $\\dbinom{${2 * m}}{${m}}$.` }],
        hints: [`The general term is $\\dbinom{${2 * m}}{r}x^{${2 * m}-r}\\left(\\dfrac{${c}}{x}\\right)^{r}$.`, 'Combine the powers of $x$ in that term.', 'The term is independent of $x$ when the power of $x$ is $0$. Solve for $r$.', `The power of $x$ is $${2 * m} - 2r$, so $r = ${m}$ and the term is $\\dbinom{${2 * m}}{${m}}(${c})^{${m}}$.`],
        steps: [{ h: 'Power of x', d: `$x^{${2 * m}-r}\\cdot x^{-r} = x^{${2 * m}-2r}$` }, { h: 'Set to zero', d: `$${2 * m} - 2r = 0$, so $r = ${m}$` }, { h: 'Term', d: `$\\dbinom{${2 * m}}{${m}}(${c})^{${m}} = ${C(2 * m, m) * c ** m}$` }]
      }), 'bin-independent', { branch, m, c });
    }
    const nn = rc(rng, [3, 6, 9]), c = rc(rng, [1, 2, 3, -1, -2]), r = (2 * nn) / 3;
    return spec(numQ(`Find the term independent of $x$ in the expansion of $\\left(x^{2} + \\dfrac{${c}}{x}\\right)^{${nn}}$.`, C(nn, r) * c ** r, {
      dp: 1,
      traps: [{ value: C(nn, r), why: `The constant $${c}$ is raised to the power of the number of $\\dfrac1x$ factors, $r = ${r}$.` }, { value: C(nn, nn / 3) * c ** (nn / 3), why: `With $x^{2}$ the powers of $x$ are $${2 * nn}-3r$: solve $${2 * nn} - 3r = 0$ for $r$.` }].filter(t => t.value !== C(nn, r) * c ** r),
      hints: [`The general term is $\\dbinom{${nn}}{r}(x^{2})^{${nn}-r}\\left(\\dfrac{${c}}{x}\\right)^{r}$.`, 'Collect the power of $x$ in that term.', 'Set the power equal to $0$ and solve for $r$.', `The power of $x$ is $${2 * nn} - 3r$, so $r = ${r}$ and the term is $\\dbinom{${nn}}{${r}}(${c})^{${r}}$.`],
      steps: [{ h: 'Power of x', d: `$x^{${2 * nn}-2r}\\cdot x^{-r} = x^{${2 * nn}-3r}$` }, { h: 'Set to zero', d: `$${2 * nn} - 3r = 0$, so $r = ${r}$` }, { h: 'Term', d: `$\\dbinom{${nn}}{${r}}(${c})^{${r}} = ${C(nn, r) * c ** r}$` }]
    }), 'bin-independent', { branch, m: nn, c });
  }),
  V([3], rng => {
    const p = ri(rng, 2, 5), n = ri(rng, 4, 8), k = ri(rng, 2, 4);
    return spec(numQ(`Find the coefficient of $x^{${k}}$ in the expansion of $(${p} + x)(1+x)^{${n}}$.`, p * C(n, k) + C(n, k - 1), {
      dp: 1,
      traps: [{ value: p * C(n, k), why: `The $x$ in the first bracket multiplies the term in $x^{${k - 1}}$ of the expansion, which also gives $x^{${k}}$.` }, { value: C(n, k) + C(n, k - 1), why: `The constant $${p}$ multiplies the whole coefficient of $x^{${k}}$.` }],
      hints: ['Two things in the first bracket can combine with terms of the expansion.', `The constant $${p}$ must meet the term in $x^{${k}}$.`, `The term $x$ must meet the term in $x^{${k - 1}}$.`, `$${p}\\times ${C(n, k)} + ${C(n, k - 1)} = ${p * C(n, k) + C(n, k - 1)}$.`],
      steps: [{ h: 'Constant times $x^{k}$', d: `$${p}\\dbinom{${n}}{${k}} = ${p * C(n, k)}$` }, { h: '$x$ times $x^{k-1}$', d: `$\\dbinom{${n}}{${k - 1}} = ${C(n, k - 1)}$` }, { h: 'Add', d: `$${p * C(n, k) + C(n, k - 1)}$` }]
    }), 'bin-extra-factor', { p, n, k });
  }),
  V([3], rng => {
    const n = ri(rng, 4, 7), k = ri(rng, 2, 3), a = ri(rng, 2, 4), N = C(n, k) * a ** k;
    return spec(numQ(`The coefficient of $x^{${k}}$ in the expansion of $(1 + ax)^{${n}}$ is $${N}$, where $a$ is a positive integer. Find $a$.`, a, {
      dp: 1, prefix: 'a =',
      traps: [{ value: N / C(n, k), why: `That is $a^{${k}}$: take the ${k === 2 ? 'square root' : 'cube root'} to find $a$.` }],
      hints: [`The term in $x^{${k}}$ is $\\dbinom{${n}}{${k}}(ax)^{${k}}$.`, `Its coefficient is $\\dbinom{${n}}{${k}}a^{${k}}$. Set it equal to $${N}$.`, `Divide by $\\dbinom{${n}}{${k}}$, then undo the power.`, `$a^{${k}} = ${a ** k}$, so $a = ${a}$.`],
      steps: [{ h: 'Coefficient', d: `$\\dbinom{${n}}{${k}}a^{${k}} = ${C(n, k)}a^{${k}}$` }, { h: 'Equation', d: `$${C(n, k)}a^{${k}} = ${N}$, so $a^{${k}} = ${a ** k}$` }, { h: 'Solve', d: `$a = ${a}$` }]
    }), 'bin-find-a', { n, k, a });
  }),
  V([3], rng => {
    const p = ri(rng, 2, 3), k = ri(rng, 3, 5), n = (p + 1) * k - 1;
    return spec(numQ(`In the expansion of $(1+x)^{n}$ the coefficient of $x^{${k}}$ is exactly ${p === 2 ? 'twice' : 'three times'} the coefficient of $x^{${k - 1}}$. Find $n$.`, n, {
      dp: 1, prefix: 'n =',
      traps: [{ value: p * k, why: `$\\dfrac{\\binom{n}{${k}}}{\\binom{n}{${k - 1}}} = \\dfrac{n - ${k - 1}}{${k}}$, so $n - ${k - 1} = ${p}\\times ${k}$.` }],
      hints: [`The coefficients are $\\dbinom{n}{${k}}$ and $\\dbinom{n}{${k - 1}}$.`, 'Find their ratio: consecutive coefficients differ by the factor $\\dfrac{n-k+1}{k}$.', `Set $\\dfrac{n - ${k - 1}}{${k}} = ${p}$.`, `$n = ${p}\\times ${k} + ${k - 1} = ${n}$.`],
      steps: [{ h: 'Ratio', d: `$\\dfrac{\\binom{n}{${k}}}{\\binom{n}{${k - 1}}} = \\dfrac{n - ${k - 1}}{${k}}$` }, { h: 'Equation', d: `$\\dfrac{n - ${k - 1}}{${k}} = ${p}$` }, { h: 'Solve', d: `$n = ${n}$` }]
    }), 'bin-ratio', { p, k });
  }),
  V([3], rng => {
    const a = rc(rng, [2, 3]), b = ri(rng, 1, 3), n = ri(rng, 4, 5), k = ri(rng, 2, 3);
    const v = C(n, k) * a ** k * (-b) ** (n - k), t = x => `$${x}x^{${k}}$`;
    const wrongs = [
      { text: t(-v), why: `The sign of $(-${b})^{${n - k}}$ is ${(n - k) % 2 === 0 ? 'positive' : 'negative'}: an ${(n - k) % 2 === 0 ? 'even' : 'odd'} power.` },
      { text: t(C(n, k) * a ** (n - k) * b ** k * (-1) ** k), why: `The power of $${a}x$ is $${k}$ (the power of $x$) and the power of $-${b}$ is $${n - k}$.` },
      { text: t(C(n, k + 1) * a ** k * (-b) ** (n - k)), why: `The binomial coefficient for the term in $x^{${k}}$ is $\\dbinom{${n}}{${k}}$, not $\\dbinom{${n}}{${k + 1}}$.` }];
    rej(v === 0 || wrongs.some(w => w.text === t(v)) || new Set(wrongs.map(w => w.text)).size < 3);
    return spec(mcQ(rng, `Which is the term in $x^{${k}}$ in the expansion of $(${a}x - ${b})^{${n}}$?`, t(v), wrongs, {
      dp: 1,
      hints: [`Write the bracket as $(${a}x + (-${b}))^{${n}}$ so the sign travels with the constant.`, `The general term is $\\dbinom{${n}}{r}(${a}x)^{r}(-${b})^{${n}-r}$.`, `Take $r = ${k}$ and evaluate each factor, keeping the sign of $(-${b})^{${n - k}}$.`, `The term is $${v}x^{${k}}$.`],
      steps: [{ h: 'General term', d: `$\\dbinom{${n}}{r}(${a}x)^{r}(-${b})^{${n}-r}$` }, { h: `r = ${k}`, d: `$${C(n, k)}\\times ${a ** k}\\times(-${b})^{${n - k}} = ${v}$` }, { h: 'Term', d: `$${v}x^{${k}}$` }]
    }), 'bin-signs', { n, k, a, b });
  }),

  // ───────────── D4 · sums of coefficients ─────────────
  V([4], rng => {
    const a = ri(rng, 2, 5), b = ri(rng, 1, 6), n = ri(rng, 3, 6);
    rej(a === b);
    return spec(numQ(`Find the sum of all the coefficients in the expansion of $(${co(a, 'x')} - ${b})^{${n}}$.`, (a - b) ** n, {
      dp: 2,
      traps: [{ value: (a + b) ** n, why: `Put $x = 1$ in $(${a}x - ${b})^{${n}}$: the minus sign stays, giving $(${a} - ${b})^{${n}}$.` }, { value: a ** n - b ** n, why: 'The sum of the coefficients is the value of the **whole bracket** raised to the power, not a difference of powers.' }],
      hints: ['The sum of the coefficients is what you get by putting $x = 1$.', `Substitute $x = 1$ into $(${a}x - ${b})^{${n}}$.`, 'Evaluate the bracket first, then the power. Watch the sign.', `$(${a} - ${b})^{${n}} = (${a - b})^{${n}} = ${(a - b) ** n}$.`],
      steps: [{ h: 'Put x = 1', d: `Sum of coefficients $= (${a} - ${b})^{${n}}$` }, { h: 'Bracket', d: `$${a} - ${b} = ${a - b}$` }, { h: 'Power', d: `$(${a - b})^{${n}} = ${(a - b) ** n}$` }]
    }), 'bin-sum-sign', { a, b, n });
  }),
  V([4], rng => {
    const a = ri(rng, 2, 4), n = ri(rng, 4, 7), v = ((1 + a) ** n + (1 - a) ** n) / 2;
    return spec(numQ(`Find the sum of the coefficients of the even powers of $x$ (including the constant term) in the expansion of $(1 + ${a}x)^{${n}}$.`, v, {
      dp: 2,
      traps: [{ value: (1 + a) ** n / 2, why: 'Half of the total is only right when the odd and even sums are equal. Use $x = 1$ **and** $x = -1$.' }, { value: (1 + a) ** n, why: 'That is the sum of **all** the coefficients; the question asks only for the even powers.' }],
      hints: ['Put $x = 1$ to get the sum of all coefficients, $E + O$.', 'Put $x = -1$ to get $E - O$, because odd powers change sign.', 'Add the two results: $2E = f(1) + f(-1)$.', `$E = \\dfrac{${(1 + a) ** n} + (${(1 - a) ** n})}{2} = ${v}$.`],
      steps: [{ h: 'x = 1', d: `$E + O = (1 + ${a})^{${n}} = ${(1 + a) ** n}$` }, { h: 'x = -1', d: `$E - O = (1 - ${a})^{${n}} = ${(1 - a) ** n}$` }, { h: 'Add and halve', d: `$E = \\dfrac{${(1 + a) ** n} + (${(1 - a) ** n})}{2} = ${v}$` }]
    }), 'bin-even-sum', { a, n });
  }),
  V([4], rng => {
    const a = ri(rng, 2, 4), n = ri(rng, 3, 7), N = (1 + a) ** n;
    return spec(numQ(`Given that $\\displaystyle\\sum_{k=0}^{n}\\dbinom{n}{k}${a}^{k} = ${N}$, find $n$.`, n, {
      dp: 2, prefix: 'n =',
      traps: [{ value: n - 1, why: `Recognise the binomial theorem for $(1 + ${a})^{n}$: the sum is $${1 + a}^{n}$, so count the power that gives $${N}$.` }],
      hints: ['Compare the sum with the expansion of $(1 + x)^{n} = \\sum\\binom{n}{k}x^{k}$.', `Here $x = ${a}$, so the sum is a power of a single number.`, `Solve $${1 + a}^{n} = ${N}$ by testing powers.`, `$${1 + a}^{${n}} = ${N}$, so $n = ${n}$.`],
      steps: [{ h: 'Recognise the theorem', d: `$\\sum\\dbinom{n}{k}${a}^{k} = (1 + ${a})^{n}$` }, { h: 'Equation', d: `$${1 + a}^{n} = ${N}$` }, { h: 'Solve', d: `$n = ${n}$` }]
    }), 'bin-find-n-sum', { a, n });
  }),
  V([4], rng => {
    const m = ri(rng, 2, 4), n = ri(rng, 2, 4);
    return spec(numQ(`Find the sum of all the coefficients in the expansion of $(1+x)^{${m}}(2+x)^{${n}}$.`, 2 ** m * 3 ** n, {
      dp: 2,
      traps: [{ value: 2 ** m + 3 ** n, why: 'Put $x = 1$ in the **product**: the two sums multiply.' }],
      hints: ['The sum of all the coefficients is the value of the whole expression at $x = 1$.', 'Substitute $x = 1$ into each bracket separately.', 'The expansions multiply, so the sums multiply too.', `$2^{${m}}\\times 3^{${n}} = ${2 ** m * 3 ** n}$.`],
      steps: [{ h: 'Put x = 1', d: `$(1+1)^{${m}}(2+1)^{${n}}$` }, { h: 'Powers', d: `$2^{${m}} = ${2 ** m}$ and $3^{${n}} = ${3 ** n}$` }, { h: 'Multiply', d: `$${2 ** m * 3 ** n}$` }]
    }), 'bin-sum-product', { m, n });
  }),
  V([4], rng => {
    const a = ri(rng, 2, 5), n = ri(rng, 3, 5);
    return spec(numQ(`The sum of the coefficients in the expansion of $(x + a)^{${n}}$ is $${(1 + a) ** n}$, where $a$ is a positive integer. Find $a$.`, a, {
      dp: 2, prefix: 'a =',
      traps: [{ value: 1 + a, why: `$(1 + a)^{${n}} = ${(1 + a) ** n}$ gives $1 + a = ${1 + a}$: subtract the $1$ to find $a$.` }],
      hints: ['Put $x = 1$ to express the sum of the coefficients in terms of $a$.', `The sum is $(1 + a)^{${n}}$. Set it equal to $${(1 + a) ** n}$.`, `Take the ${n === 3 ? 'cube' : n === 4 ? 'fourth' : 'fifth'} root, then solve for $a$.`, `$1 + a = ${1 + a}$, so $a = ${a}$.`],
      steps: [{ h: 'Put x = 1', d: `$(1 + a)^{${n}} = ${(1 + a) ** n}$` }, { h: 'Root', d: `$1 + a = ${1 + a}$` }, { h: 'Solve', d: `$a = ${a}$` }]
    }), 'bin-find-a-sum', { a, n });
  }),
  V([4], rng => {
    const a = ri(rng, 1, 4), b = ri(rng, 1, 4), n = ri(rng, 3, 5);
    return spec(numQ(`Find the sum of the coefficients of the terms in $x$, $x^{2}$, $\\dots$, $x^{${n}}$ (every term except the constant term) in the expansion of $(${co(a, 'x')} + ${b})^{${n}}$.`, (a + b) ** n - b ** n, {
      dp: 2,
      traps: [{ value: (a + b) ** n, why: `That sum includes the constant term $${b}^{${n}} = ${b ** n}$, which the question leaves out.` }, { value: a ** n, why: 'That is only the coefficient of $x^{n}$; the other terms with $x$ count as well.' }],
      hints: ['First find the sum of **all** the coefficients: put $x = 1$.', 'Which term is the constant term? It is the value at $x = 0$.', 'Subtract the constant term from the total.', `$(${a} + ${b})^{${n}} - ${b}^{${n}} = ${(a + b) ** n} - ${b ** n} = ${(a + b) ** n - b ** n}$.`],
      steps: [{ h: 'Total', d: `$x = 1$: $(${a} + ${b})^{${n}} = ${(a + b) ** n}$` }, { h: 'Constant term', d: `$x = 0$: $${b}^{${n}} = ${b ** n}$` }, { h: 'Difference', d: `$${(a + b) ** n} - ${b ** n} = ${(a + b) ** n - b ** n}$` }]
    }), 'bin-sum-no-constant', { a, b, n });
  }),
  V([4], rng => {
    const a = ri(rng, 2, 4), n = rc(rng, [3, 5]), v = (1 - a) ** n;
    return spec(mcQ(rng, `Which is the value of $\\displaystyle\\sum_{k=0}^{${n}}\\dbinom{${n}}{k}(-${a})^{k}$?`, `$${v}$`, [
      { text: `$${(1 + a) ** n}$`, why: `The terms $(-${a})^{k}$ alternate in sign: the sum is $(1 - ${a})^{${n}}$, not $(1 + ${a})^{${n}}$.` },
      { text: `$${(a - 1) ** n}$`, why: `The sum is $(1 + (-${a}))^{${n}} = (1 - ${a})^{${n}}$: the bracket is $${1 - a}$, negative, and the power is odd.` },
      { text: `$${-(a ** n)}$`, why: 'The binomial theorem gives a power of the whole bracket $1 + x$, not just $x^{n}$.' }], {
      dp: 2,
      hints: ['Compare with $(1 + x)^{n} = \\sum\\binom{n}{k}x^{k}$.', `Here $x = -${a}$.`, 'Evaluate the bracket $1 + x$, then raise it to the power $n$.', `$(1 - ${a})^{${n}} = (${1 - a})^{${n}} = ${v}$.`],
      steps: [{ h: 'Binomial theorem', d: `$\\sum\\dbinom{${n}}{k}x^{k} = (1 + x)^{${n}}$` }, { h: 'Substitute', d: `$x = -${a}$: $(1 - ${a})^{${n}}$` }, { h: 'Evaluate', d: `$(${1 - a})^{${n}} = ${v}$` }]
    }), 'bin-sum-mcq', { a, n });
  })
];

// ═══════════════════════════ me11-functions ══════════════════════════════════
// Cell dot points: D1 = 0, D3 = 0 (find and use inverse functions).
const fnForms = [
  // ───────────── D1 · linear inverses ─────────────
  V([1], rng => {
    const a = rc(rng, [2, 3, 4, 5, -2, -3]), b = nz(rng, -9, 9), t = nz(rng, -6, 6), c = a * t + b;
    return spec(numQ(`The function $f(x) = ${lin(a, b)}$ is one-to-one. Evaluate $f^{-1}(${c})$.`, t, {
      dp: 0,
      traps: [{ value: a * c + b, why: `$f^{-1}(${c})$ asks which input gives the output $${c}$: that is not $f(${c})$.` }, { value: (c + b) / a, why: `To undo $${sg(b)}$ you ${b > 0 ? 'subtract' : 'add'}: check the sign of $${b}$.` }],
      hints: ['$f^{-1}(c)$ is the input $x$ for which $f(x) = c$.', `Set up the equation $${lin(a, b)} = ${c}$.`, 'Solve for $x$.', `$x = ${t}$.`],
      steps: [{ h: 'Meaning', d: `$f^{-1}(${c}) = x$ where $f(x) = ${c}$` }, { h: 'Equation', d: `$${lin(a, b)} = ${c}$` }, { h: 'Solve', d: `$x = ${t}$` }]
    }), 'fn-eval-inverse', { a, b, c });
  }),
  V([1], rng => {
    const a = nz(rng, -9, 9), b = ri(rng, 2, 5);
    const key = `(${a} - x)/${b}`;
    return spec(exprQ(`Find the inverse function of $f(x) = ${a} - ${b}x$.`, key, {
      dp: 0, prefix: 'f⁻¹(x) =', hint: 'e.g. (x + 3)/4',
      traps: [{ expr: `(x - ${a})/${b}`, why: `Swapping gives $x = ${a} - ${b}y$: the $y$ term is **negative**, so $y = \\dfrac{${a} - x}{${b}}$.` }, { expr: `1/(${a} - ${b}*x)`, why: 'The inverse function reverses the mapping: it is not the reciprocal.' }],
      hints: ['Swap $x$ and $y$.', `Now $x = ${a} - ${b}y$. Get the $y$ term on its own.`, 'Rearrange, watching the sign of the $y$ term.', `$y = \\dfrac{${a} - x}{${b}}$.`],
      steps: [{ h: 'Swap', d: `$x = ${a} - ${b}y$` }, { h: 'Isolate the y term', d: `$${b}y = ${a} - x$` }, { h: 'Inverse', d: `$f^{-1}(x) = \\dfrac{${a} - x}{${b}}$` }]
    }), 'fn-inverse-negative', { a, b });
  }),
  V([1], rng => {
    const a = rc(rng, [2, 3, 4, 5]), b = nz(rng, -6, 6);
    const ok = { text: `$f^{-1}(x) = \\dfrac{x ${sg(-b)}}{${a}}$` };
    return spec(mcQ(rng, `Which is the inverse of $f(x) = ${lin(a, b)}$?`, ok.text, [
      { text: `$f^{-1}(x) = \\dfrac{1}{${lin(a, b)}}$`, why: 'The inverse is not the reciprocal: it undoes the operations.' },
      { text: `$f^{-1}(x) = \\dfrac{x}{${a}} ${sg(b)}$`, why: `Undo in reverse order: first remove the $${sg(b)}$, **then** divide by $${a}$, so the whole numerator is divided.` },
      { text: `$f^{-1}(x) = \\dfrac{x ${sg(b)}}{${a}}$`, why: `$f$ ${b > 0 ? 'adds' : 'subtracts'} $${Math.abs(b)}$ last, so the inverse first ${b > 0 ? 'subtracts' : 'adds'} $${Math.abs(b)}$.` }], {
      dp: 0,
      hints: ['$f$ multiplies by a number, then adds a number. What does the inverse do?', 'Undo the operations in the **reverse** order.', 'Check by substituting your candidate into $f$: you should get $x$.', `The inverse is $\\dfrac{x ${sg(-b)}}{${a}}$.`],
      steps: [{ h: 'Operations of f', d: `multiply by $${a}$, then ${b > 0 ? 'add' : 'subtract'} $${Math.abs(b)}$` }, { h: 'Undo in reverse', d: `${b > 0 ? 'subtract' : 'add'} $${Math.abs(b)}$, then divide by $${a}$` }, { h: 'Inverse', d: `$f^{-1}(x) = \\dfrac{x ${sg(-b)}}{${a}}$` }]
    }), 'fn-inverse-mcq', { a, b });
  }),
  V([1], rng => {
    const p = ri(rng, -4, 6), q = ri(rng, -9, 12), r = ri(rng, p + 1, p + 7), s = ri(rng, -9, 12);
    rej(q === s);
    return spec(numQ(`$f$ is a one-to-one function with $f(${p}) = ${q}$ and $f(${r}) = ${s}$. Evaluate $f^{-1}(${q}) + f^{-1}(${s})$.`, p + r, {
      dp: 0,
      traps: [{ value: q + s, why: `$f^{-1}(${q})$ is the **input** that $f$ sends to $${q}$, not the output.` }, { value: p * q + r * s, why: 'Add the two inputs: do not multiply by the outputs.' }],
      hints: ['A one-to-one function and its inverse reverse each other: if $f(a) = b$ then $f^{-1}(b) = a$.', `Use $f(${p}) = ${q}$ to find $f^{-1}(${q})$.`, `Use $f(${r}) = ${s}$ to find $f^{-1}(${s})$.`, `$f^{-1}(${q}) + f^{-1}(${s}) = ${p} ${sg(r)} = ${p + r}$.`],
      steps: [{ h: 'First', d: `$f(${p}) = ${q}$, so $f^{-1}(${q}) = ${p}$` }, { h: 'Second', d: `$f(${r}) = ${s}$, so $f^{-1}(${s}) = ${r}$` }, { h: 'Add', d: `$${p} ${sg(r)} = ${p + r}$` }]
    }), 'fn-reverse-pairs', { p, q, r, s });
  }),
  V([1], rng => {
    const a = ri(rng, 2, 7), b = nz(rng, -9, 9), t = nz(rng, -5, 6), c = a * t + b;
    return spec(numQ(`The function $f(x) = ax ${sg(b)}$ has $f^{-1}(${c}) = ${t}$. Find the constant $a$.`, a, {
      dp: 0, prefix: 'a =',
      traps: [{ value: (c + b) / t, why: `Check the sign when moving $${b}$: $f(${t}) = ${c}$ means $${co(t, 'a')} ${sg(b)} = ${c}$.` }, { value: c / t, why: `The constant $${b}$ also contributes: $${co(t, 'a')} ${sg(b)} = ${c}$.` }].filter(x => x.value !== a),
      hints: [`$f^{-1}(${c}) = ${t}$ means the input $${t}$ gives the output $${c}$.`, `So $f(${t}) = ${c}$.`, `Substitute into $ax ${sg(b)}$ and solve for $a$.`, `$${co(t, 'a')} ${sg(b)} = ${c}$ gives $a = ${a}$.`],
      steps: [{ h: 'Reverse the statement', d: `$f(${t}) = ${c}$` }, { h: 'Equation', d: `$${co(t, 'a')} ${sg(b)} = ${c}$` }, { h: 'Solve', d: `$a = ${a}$` }]
    }), 'fn-find-constant', { a, b, t });
  }),

  // ───────────── D3 · inverses with restricted domains, exponentials and composites ─────────────
  V([3], rng => {
    const a = nz(rng, -5, 5), b = nz(rng, -4, 4), s = ri(rng, 1, 6), c = s + b;
    return spec(numQ(`For $f(x) = \\sqrt{x ${sg(-a)}} ${sg(b)}$ with domain $x \\ge ${a}$, evaluate $f^{-1}(${c})$.`, s * s + a, {
      dp: 0,
      traps: [{ value: s + a, why: `Undo the square root by **squaring**: $\\sqrt{x ${sg(-a)}} = ${s}$ means $x ${sg(-a)} = ${s * s}$.` }, { value: (c - a) ** 2 + b, why: `Undo in reverse order: ${b > 0 ? 'subtract' : 'add'} $${Math.abs(b)}$ first, then square, then ${a > 0 ? 'add' : 'subtract'} $${Math.abs(a)}$.` }],
      hints: [`$f^{-1}(${c})$ is the $x$ with $f(x) = ${c}$.`, `Set $\\sqrt{x ${sg(-a)}} ${sg(b)} = ${c}$ and isolate the root.`, 'Undo the root by squaring both sides.', `$x ${sg(-a)} = ${s * s}$, so $x = ${s * s + a}$.`],
      steps: [{ h: 'Equation', d: `$\\sqrt{x ${sg(-a)}} ${sg(b)} = ${c}$` }, { h: 'Isolate the root', d: `$\\sqrt{x ${sg(-a)}} = ${s}$` }, { h: 'Square', d: `$x ${sg(-a)} = ${s * s}$, so $x = ${s * s + a}$` }]
    }), 'fn-sqrt-eval', { a, b, c });
  }),
  V([3], rng => {
    const a = rc(rng, [1, 2, 3, 5]), b = nz(rng, -6, 6), t = ri(rng, 0, 5), c = a * 2 ** t + b;
    return spec(numQ(`For $f(x) = ${a === 1 ? '' : `${a}\\cdot `}2^{x} ${sg(b)}$, evaluate $f^{-1}(${c})$.`, t, {
      dp: 0,
      traps: [{ value: (c - b) / a, why: `That is $2^{x}$, not $x$: undo the power with a logarithm to base $2$.` }, { value: t + 1, why: `Check the arithmetic: $2^{x} = ${2 ** t}$ gives a single value of $x$.` }],
      hints: [`$f^{-1}(${c})$ is the $x$ for which $f(x) = ${c}$.`, 'Undo the added constant and the multiplier to isolate $2^{x}$.', 'Then ask: which power of $2$ is that?', `$2^{x} = ${2 ** t}$, so $x = ${t}$.`],
      steps: [{ h: 'Equation', d: `$${a === 1 ? '' : `${a}\\cdot `}2^{x} ${sg(b)} = ${c}$` }, { h: 'Isolate the power', d: `$2^{x} = ${2 ** t}$` }, { h: 'Solve', d: `$x = ${t}$` }]
    }), 'fn-exp-eval', { a, b, c });
  }),
  V([3], rng => {
    const a = rc(rng, [2, 3, 4, 5, -2, -3]), s = nz(rng, -6, 6), b = (1 - a) * s;
    rej(b === 0);
    return spec(numQ(`The graphs of $y = f(x)$ and $y = f^{-1}(x)$ for $f(x) = ${lin(a, b)}$ meet at exactly one point. Find its $x$-coordinate.`, s, {
      dp: 0, prefix: 'x =',
      traps: [{ value: -b / a, why: 'That is the $x$-intercept of $f$. The graphs of $f$ and $f^{-1}$ meet where $f(x) = x$, on the line $y = x$.' }, { value: b, why: `Solve $${lin(a, b)} = x$: collect the $x$ terms on one side.` }].filter(t => t.value !== s),
      hints: ['The graph of $f^{-1}$ is the reflection of the graph of $f$ in the line $y = x$.', 'A point where the two graphs meet is unchanged by the reflection, so it lies on $y = x$.', `So solve $f(x) = x$, that is $${lin(a, b)} = x$.`, `$${co(a - 1, 'x')} = ${-b}$, so $x = ${s}$.`],
      steps: [{ h: 'Reflection in y = x', d: 'Common points of $f$ and $f^{-1}$ lie on $y = x$' }, { h: 'Equation', d: `$${lin(a, b)} = x$` }, { h: 'Solve', d: `$x = ${s}$` }]
    }), 'fn-fixed-point', { a, b });
  }),
  V([3], rng => {
    const a = rc(rng, [2, 3, 4, -2, -3]), b = nz(rng, -8, 8), c = ri(rng, -4, 6), inner = rng() < 0.5;
    const tVal = inner ? (c * c - b) / a : ((c - b) / a);
    rej(!Number.isInteger(tVal));
    const val = inner ? tVal : tVal * tVal;
    const prompt = inner
      ? `Let $f(x) = ${lin(a, b)}$ and $g(x) = x^{2}$. Evaluate $(f^{-1}\\circ g)(${c})$.`
      : `Let $f(x) = ${lin(a, b)}$ and $g(x) = x^{2}$. Evaluate $(g\\circ f^{-1})(${c})$.`;
    return spec(numQ(prompt, val, {
      dp: 0,
      traps: inner ? [{ value: (c - b) * (c - b) / (a * a), why: '$(f^{-1}\\circ g)(x) = f^{-1}(g(x))$: square **first**, then apply the inverse.' }] : [{ value: (c * c - b) / a, why: '$(g\\circ f^{-1})(x) = g(f^{-1}(x))$: apply the inverse **first**, then square.' }],
      hints: ['Read the composite from the inside out: the function on the right acts first.', inner ? 'Find $g(' + c + ')$ first.' : `Find $f^{-1}(${c})$ first.`, inner ? 'Now apply $f^{-1}$ to that result.' : 'Now apply $g$ to that result.', `The value is $${val}$.`],
      steps: inner
        ? [{ h: 'Inner function', d: `$g(${c}) = ${c * c}$` }, { h: 'Inverse of f', d: `$f^{-1}(x) = \\dfrac{x ${sg(-b)}}{${a}}$` }, { h: 'Outer function', d: `$f^{-1}(${c * c}) = ${val}$` }]
        : [{ h: 'Inverse of f', d: `$f^{-1}(x) = \\dfrac{x ${sg(-b)}}{${a}}$, so $f^{-1}(${c}) = ${tVal}$` }, { h: 'Outer function', d: `$g(${tVal}) = ${tVal < 0 ? `(${tVal})` : tVal}^{2}$` }, { h: 'Value', d: `$${val}$` }]
    }), 'fn-composite-inverse', { a, b, c, inner });
  }),
  V([3], rng => {
    const a = nz(rng, -5, 5), b = nz(rng, -4, 4);
    rej(a === b);
    return spec(exprQ(`The function $f(x) = \\sqrt{x ${sg(-a)}} ${sg(b)}$ is defined for $x \\ge ${a}$. Find $f^{-1}(x)$ for $x \\ge ${b}$.`, `(x - (${b}))^2 + (${a})`, {
      dp: 0, prefix: 'f⁻¹(x) =', hint: 'e.g. (x - 2)^2 + 7',
      traps: [{ expr: `(x - (${a}))^2 + (${b})`, why: `The roles are swapped: the constant outside the root is $${b}$ and the one inside is $${a}$.` }, { expr: `sqrt(x - (${b})) + (${a})`, why: 'To undo a square root you **square**; taking another root does not undo it.' }],
      hints: ['Swap $x$ and $y$.', `Now $x = \\sqrt{y ${sg(-a)}} ${sg(b)}$. Isolate the root.`, 'Square both sides, then solve for $y$.', `$y = (x ${sg(-b)})^{2} ${sg(a)}$.`],
      steps: [{ h: 'Swap', d: `$x = \\sqrt{y ${sg(-a)}} ${sg(b)}$` }, { h: 'Isolate and square', d: `$(x ${sg(-b)})^{2} = y ${sg(-a)}$` }, { h: 'Solve for y', d: `$f^{-1}(x) = (x ${sg(-b)})^{2} ${sg(a)}$` }]
    }), 'fn-sqrt-inverse', { a, b });
  }),
  V([3], rng => {
    const d = rc(rng, [1, 2, 3, 4, 6, -1, -2, -3]), a = d * ri(rng, 1, 3) * rc(rng, [1, 2]), h = nz(rng, -4, 4), k = nz(rng, -4, 4), c = k + d;
    rej(a === 0 || c === k);
    return spec(numQ(`For $f(x) = \\dfrac{${a}}{x ${sg(-h)}} ${sg(k)}$, evaluate $f^{-1}(${c})$.`, a / d + h, {
      dp: 0,
      traps: [{ value: a / (c - h) + k, why: `Undo in reverse: subtract the constant $${k}$ from $${c}$ first, then invert the fraction.` }, { value: a / d, why: `The fraction $\\dfrac{${a}}{x ${sg(-h)}}$ equals $${d}$ when $x ${sg(-h)} = ${fr(a, d)}$: ${h > 0 ? 'add' : 'subtract'} $${Math.abs(h)}$ to find $x$.` }].filter(t => t.value !== a / d + h),
      hints: [`$f^{-1}(${c})$ is the $x$ with $f(x) = ${c}$.`, `${k > 0 ? 'Subtract' : 'Add'} $${Math.abs(k)}$ ${k > 0 ? 'from' : 'to'} both sides to isolate the fraction.`, 'Invert the fraction, then undo the shift inside the bracket.', `$\\dfrac{${a}}{x ${sg(-h)}} = ${d}$ gives $x = ${a / d + h}$.`],
      steps: [{ h: 'Equation', d: `$\\dfrac{${a}}{x ${sg(-h)}} ${sg(k)} = ${c}$` }, { h: 'Isolate the fraction', d: `$\\dfrac{${a}}{x ${sg(-h)}} = ${d}$` }, { h: 'Solve', d: `$x ${sg(-h)} = ${a / d}$, so $x = ${a / d + h}$` }]
    }), 'fn-reciprocal-eval', { a, h, k, c });
  })
];

// ═══════════════════════════ me12-vectors-forms ══════════════════════════════
// Cell dot point: D1 = 0 (dot product, magnitude, perpendicular and parallel).
const col = (x, y) => String.raw`\begin{pmatrix}${x}\\${y}\end{pmatrix}`;
const TRIPLES = [[3, 4, 5], [6, 8, 10], [9, 12, 15], [12, 16, 20], [15, 20, 25], [5, 12, 13], [8, 15, 17], [7, 24, 25]];
const vecForms = [
  V([1], rng => {
    const [p, q, r] = rc(rng, TRIPLES), A = [ri(rng, -6, 6), ri(rng, -6, 6)], sx = rc(rng, [-1, 1]), sy = rc(rng, [-1, 1]);
    const B = [A[0] + sx * p, A[1] + sy * q];
    return spec(numQ(`The points $A(${A[0]}, ${A[1]})$ and $B(${B[0]}, ${B[1]})$ are given. Find the magnitude of the vector $\\overrightarrow{AB}$.`, r, {
      dp: 0,
      traps: [{ value: Math.hypot(B[0], B[1]), why: '$\\overrightarrow{AB}$ is the position vector of $B$ minus that of $A$: it is not $\\overrightarrow{OB}$.' }, { value: p + q, why: 'Use $\\sqrt{x^2 + y^2}$, not $|x| + |y|$.' }],
      hints: ['First find the vector $\\overrightarrow{AB}$ from the coordinates.', '$\\overrightarrow{AB} = \\overrightarrow{OB} - \\overrightarrow{OA}$: subtract matching coordinates.', 'Then use $|\\underline{v}| = \\sqrt{x^2 + y^2}$.', `$\\overrightarrow{AB} = ${col(sx * p, sy * q)}$ and $|\\overrightarrow{AB}| = ${r}$.`],
      steps: [{ h: 'Vector AB', d: `$\\overrightarrow{AB} = ${col(B[0] - A[0], B[1] - A[1])}$` }, { h: 'Squares', d: `$${p * p} + ${q * q} = ${r * r}$` }, { h: 'Magnitude', d: `$\\sqrt{${r * r}} = ${r}$` }]
    }), 'vec-distance', { A, B });
  }),
  V([1], rng => {
    const base = [ri(rng, 2, 7), ri(rng, 2, 7)], u = base, perp = [-base[1], base[0]];
    const mk = (v, m) => [v[0] * m, v[1] * m];
    const pairs = [
      { text: `$${col(u[0], u[1])}$ and $${col(...mk(perp, ri(rng, 1, 3)))}$` },
      { text: `$${col(u[0], u[1])}$ and $${col(...mk(u, ri(rng, 2, 3)))}$`, why: 'These vectors are parallel (one is a multiple of the other); perpendicular vectors have dot product $0$.' },
      { text: `$${col(u[0], u[1])}$ and $${col(u[1], u[0])}$`, why: 'Swapping the components does not give a perpendicular vector: the dot product is $2xy$, not $0$.' },
      { text: `$${col(u[0], u[1])}$ and $${col(u[0], -u[1])}$`, why: 'Changing one sign does not give a perpendicular vector: the dot product is $x^2 - y^2$, not $0$ unless $|x| = |y|$.' }];
    rej(u[0] === u[1]);
    return spec(mcQ(rng, 'Which pair of vectors is perpendicular?', pairs[0].text, pairs.slice(1), {
      dp: 0,
      hints: ['Perpendicular vectors have a dot product of $0$.', 'Work out the dot product of each pair.', 'Multiply matching components and add.', 'Only one pair gives $0$.'],
      steps: [{ h: 'Test', d: 'Perpendicular means $\\underline{a}\\cdot\\underline{b} = 0$' }, { h: 'Compute each dot product', d: 'Multiply the top components, multiply the bottom components, add' }, { h: 'Select', d: `The pair $${pairs[0].text.slice(1, -1)}$ has dot product $0$` }]
    }), 'vec-perp-mcq', { u, p0: pairs[0].text, pairs: pairs.map(x => x.text) });
  }),
  V([1], rng => {
    const [p, q, r] = rc(rng, [[3, 4, 5], [6, 8, 10], [9, 12, 15], [12, 16, 20], [15, 20, 25], [7, 24, 25]]);
    const sw = rng() < 0.5, x = (sw ? q : p) * rc(rng, [-1, 1]), y = (sw ? p : q) * rc(rng, [-1, 1]), comp = rng() < 0.5;
    return spec(numQ(`Find the ${comp ? '$x$' : '$y$'}-component of the unit vector in the direction of $\\underline{v} = ${col(x, y)}$.`, (comp ? x : y) / r, {
      dp: 0,
      traps: [{ value: comp ? x : y, why: 'A unit vector has length $1$: divide the component by the magnitude $|\\underline{v}|$.' }, { value: (comp ? x : y) / (Math.abs(x) + Math.abs(y)), why: 'The length is $\\sqrt{x^2 + y^2}$, not $|x| + |y|$.' }],
      hints: ['A unit vector in the direction of $\\underline{v}$ is $\\dfrac{\\underline{v}}{|\\underline{v}|}$.', 'Find $|\\underline{v}|$ first.', 'Divide each component by $|\\underline{v}|$.', `$|\\underline{v}| = ${r}$, so the ${comp ? 'x' : 'y'}-component is $\\dfrac{${comp ? x : y}}{${r}} = ${(comp ? x : y) / r}$.`],
      steps: [{ h: 'Magnitude', d: `$|\\underline{v}| = \\sqrt{${x * x} + ${y * y}} = ${r}$` }, { h: 'Unit vector', d: `$\\dfrac{1}{${r}}${col(x, y)}$` }, { h: 'Component', d: `$${(comp ? x : y) / r}$` }]
    }), 'vec-unit', { x, y, comp });
  }),
  V([1], rng => {
    const [p, q, r] = rc(rng, TRIPLES), sw = rng() < 0.5, k = sw ? q : p, m = sw ? p : q;
    return spec(numQ(`The vector $\\underline{v} = ${col('k', m * rc(rng, [-1, 1]))}$ has magnitude $${r}$, and $k > 0$. Find $k$.`, k, {
      dp: 0, prefix: 'k =',
      traps: [{ value: r - m, why: `Use $|\\underline{v}|^2 = k^2 + ${m * m} = ${r * r}$: magnitudes do not subtract component by component.` }, { value: k * k, why: `$k^2 = ${k * k}$ is the square of the value you want: take the square root.` }],
      hints: ['Write $|\\underline{v}|^2$ in terms of $k$.', `$k^2 + ${m * m} = ${r * r}$.`, 'Solve for $k$, taking the positive root.', `$k^2 = ${k * k}$, so $k = ${k}$.`],
      steps: [{ h: 'Magnitude squared', d: `$k^2 + ${m * m} = ${r}^2 = ${r * r}$` }, { h: 'Solve for $k^2$', d: `$k^2 = ${k * k}$` }, { h: 'Positive root', d: `$k = ${k}$` }]
    }), 'vec-find-k', { m, r });
  }),
  V([1], rng => {
    const a = [nz(rng, -6, 6), nz(rng, -6, 6)], b = [nz(rng, -6, 6), nz(rng, -6, 6)];
    const v = (a[0] ** 2 + a[1] ** 2) - (b[0] ** 2 + b[1] ** 2);
    rej(v === 0);
    return spec(numQ(`Given $\\underline{a} = ${col(a[0], a[1])}$ and $\\underline{b} = ${col(b[0], b[1])}$, evaluate $(\\underline{a} + \\underline{b})\\cdot(\\underline{a} - \\underline{b})$.`, v, {
      dp: 0,
      traps: [{ value: a[0] * b[0] + a[1] * b[1], why: 'The dot product here is of the sum with the difference, not of $\\underline{a}$ with $\\underline{b}$.' }, { value: (a[0] ** 2 + a[1] ** 2) + (b[0] ** 2 + b[1] ** 2), why: 'Expanding gives $|\\underline{a}|^2 - |\\underline{b}|^2$: the middle terms cancel and the sign is a minus.' }],
      hints: ['Either find the two new vectors, or expand the product.', 'Find $\\underline{a} + \\underline{b}$ and $\\underline{a} - \\underline{b}$ as column vectors.', 'Then take their dot product.', `The value is $${v}$ (it equals $|\\underline{a}|^2 - |\\underline{b}|^2$).`],
      steps: [{ h: 'Sum', d: `$\\underline{a} + \\underline{b} = ${col(a[0] + b[0], a[1] + b[1])}$` }, { h: 'Difference', d: `$\\underline{a} - \\underline{b} = ${col(a[0] - b[0], a[1] - b[1])}$` }, { h: 'Dot product', d: `$${(a[0] + b[0]) * (a[0] - b[0])} + ${(a[1] + b[1]) * (a[1] - b[1])} = ${v}$`.replace('+ -', '- ') }]
    }), 'vec-sum-diff', { a, b });
  }),
  V([1], rng => {
    const b = [nz(rng, -5, 5), nz(rng, -5, 5)], lam = rc(rng, [-4, -3, -2, 3, 4, 5]);
    const a = [lam * b[0], lam * b[1]];
    return spec(numQ(`The vector $\\underline{a} = ${col(a[0], a[1])}$ is parallel to $\\underline{b} = ${col(b[0], b[1])}$, with $\\underline{a} = \\lambda\\underline{b}$. Find the scalar $\\lambda$.`, lam, {
      dp: 0,
      traps: [{ value: Math.abs(lam), why: `Compare the signs: $\\underline{a}$ points ${lam < 0 ? 'opposite to' : 'the same way as'} $\\underline{b}$, so $\\lambda$ is ${lam < 0 ? 'negative' : 'positive'}.` }, { value: 1 / lam, why: '$\\underline{a} = \\lambda\\underline{b}$: divide the components of $\\underline{a}$ by those of $\\underline{b}$, not the other way round.' }],
      hints: ['$\\underline{a} = \\lambda\\underline{b}$ means each component of $\\underline{a}$ is $\\lambda$ times the matching component of $\\underline{b}$.', 'Divide the first components.', 'Check the second components give the same ratio, and look at the sign.', `$\\lambda = ${a[0]} \\div ${b[0] < 0 ? `(${b[0]})` : b[0]} = ${lam}$.`],
      steps: [{ h: 'Equate components', d: `$${a[0]} = \\lambda(${b[0]})$ and $${a[1]} = \\lambda(${b[1]})$` }, { h: 'Solve', d: `$\\lambda = ${lam}$` }, { h: 'Check', d: `$${lam}\\times ${b[1]} = ${a[1]}$ ✓` }]
    }), 'vec-lambda', { a, b });
  })
];

const calcMap = {
  'me12-further-calc': calcForms,
  'me11-binomial': binForms,
  'me11-functions': fnForms,
  'me12-vectors-forms': vecForms
};

// ═══════════════════════════ proof by induction ═════════════════════════════════════════
const pv = v => (/^\w$/.test(v) ? v : `(${v})`);
const nth = n => `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10 > 3 ? 0 : n % 10]}`;

/** A summation family with its terms, closed form and every rendering the forms need. */
function family(rng, kinds) {
  const kind = rc(rng, kinds);
  const out = { kind };
  if (kind === 'lin') {
    const a = ri(rng, 2, 9), b = ri(rng, 1, 9);
    Object.assign(out, {
      a, b, term: i => a * i + b, sum: n => (n * (a * n + a + 2 * b)) / 2,
      termTex: `${a}i+${b}`, T: v => `(${a}${pv(v)}+${b})`, termExpr: v => `(${a}*(${v})+${b})`,
      baseTex: `\\dfrac{n(${a}n+${a + 2 * b})}{2}`, baseExpr: `n*(${a}*n+${a + 2 * b})/2`, denom: 2
    });
  } else if (kind === 'sq') {
    Object.assign(out, {
      term: i => i * i, sum: n => (n * (n + 1) * (2 * n + 1)) / 6, termTex: 'i^{2}', T: v => `${pv(v)}^{2}`, termExpr: v => `(${v})^2`,
      baseTex: '\\dfrac{n(n+1)(2n+1)}{6}', baseExpr: 'n*(n+1)*(2*n+1)/6', denom: 6
    });
  } else if (kind === 'pr') {
    const c = ri(rng, 1, 8);
    Object.assign(out, {
      c, term: i => i * (i + c), sum: n => (n * (n + 1) * (2 * n + 1 + 3 * c)) / 6, termTex: `i(i+${c})`, T: v => `${pv(v)}(${pv(v)}+${c})`, termExpr: v => `(${v})*((${v})+${c})`,
      baseTex: `\\dfrac{n(n+1)(2n+${1 + 3 * c})}{6}`, baseExpr: `n*(n+1)*(2*n+${1 + 3 * c})/6`, denom: 6
    });
  } else if (kind === 'cube') {
    Object.assign(out, {
      term: i => i ** 3, sum: n => (n * n * (n + 1) * (n + 1)) / 4, termTex: 'i^{3}', T: v => `${pv(v)}^{3}`, termExpr: v => `(${v})^3`,
      baseTex: '\\dfrac{n^{2}(n+1)^{2}}{4}', baseExpr: 'n^2*(n+1)^2/4', denom: 4
    });
  } else {
    const r = ri(rng, 3, 6);
    Object.assign(out, {
      r, term: i => r ** (i - 1), sum: n => (r ** n - 1) / (r - 1), termTex: `${r}^{i-1}`, T: v => (v === 'k+1' ? `${r}^{k}` : `${r}^{${v}-1}`), termExpr: v => `${r}^((${v})-1)`,
      baseTex: `\\dfrac{${r}^{n}-1}{${r - 1}}`, baseExpr: `(${r}^n-1)/${r - 1}`, denom: r - 1
    });
  }
  out.rhsTex = v => out.baseTex.replace(/n/g, kind === 'geo' ? v : pv(v));
  out.rhsExpr = v => out.baseExpr.replace(/n/g, `(${v})`);
  out.claim = `\\sum_{i=1}^{n}${kind === 'lin' || kind === 'pr' ? `(${out.termTex})` : out.termTex} = ${out.baseTex}`;
  for (let n = 1; n <= 8; n++) { let s = 0; for (let i = 1; i <= n; i++) s += out.term(i); if (s !== out.sum(n)) throw new Error('induction family: closed form disagrees with the sum'); }
  return out;
}
const sumLine = (F, upper) => `\\sum_{i=1}^{${upper}}${F.kind === 'lin' || F.kind === 'pr' ? `(${F.termTex})` : F.termTex}`;

// ═══ the forms; each takes the dot point the host generator assigns it ═════════
/** The right-hand side with only the first n replaced by k + 1 (the common slip), or for a power the denominator dropped. */
const partialTex = F => (F.kind === 'geo' ? `${F.r}^{k+1}-1` : F.baseTex.replace('n', '(k+1)').replace(/n/g, 'k'));
// Multiple choice, not an expression: an expression check accepts anything algebraically equal, so the unsubstituted
// work (the right side of P(k) plus the new term, which equals the right side of P(k+1) for every k) would be accepted as
// "P(k+1)". No option may be equal to the key for any k: every distractor below differs from it at every k tested.
const iRhsNext = dp => V([1], rng => {
  const F = family(rng, ['lin', 'sq', 'pr', 'cube', 'geo']);
  const ok = `$${F.rhsTex('k+1')}$`;
  const ds = [
    { text: `$${F.rhsTex('k')}$`, why: 'That is the right-hand side of $P(k)$, unchanged. $P(k+1)$ is the same formula with $n$ replaced by $k + 1$.' },
    { text: `$${F.rhsTex('k')} + 1$`, why: '$P(k+1)$ is the **same formula** with $n$ replaced by $k + 1$ everywhere; it is not the formula for $k$ with $1$ added.' },
    { text: `$${partialTex(F)}$`, why: 'Replace $n$ in **every** place it appears, not only the first.' }];
  return spec(mcQ(rng, `The statement $P(n)$ is $${F.claim}$ for all integers $n \\ge 1$. In the inductive step we must prove $P(k+1)$. Which expression is the **right-hand side of $P(k+1)$**, that is, the right-hand side of $P(n)$ with $n$ replaced by $k + 1$?`, ok, ds, {
    dp,
    hints: ['$P(k+1)$ is the statement $P(n)$ with $n = k + 1$.', 'Every $n$ in the right-hand side becomes $k + 1$.', 'Put brackets round $k + 1$ so that products and powers are read correctly.', `The right-hand side of $P(k+1)$ is $${F.rhsTex('k+1')}$.`],
    steps: [{ h: 'State P(n)', d: `$${F.claim}$` }, { h: 'Replace n by k + 1', d: `Right-hand side: $${F.rhsTex('k+1')}$` }, { h: 'Use', d: 'This is the target the inductive step must reach.' }]
  }), 'ind-rhs-next', { kind: F.kind, F: F });
});

const iLhsNext = dp => V([1], rng => {
  const F = family(rng, ['lin', 'sq', 'pr', 'cube', 'geo']), m = ri(rng, 3, 7);
  const ok = `$${sumLine(F, 'k')} + ${F.T('k+1')}$`;
  const ds = [
    { text: `$${sumLine(F, 'k')} + ${F.T('k')}$`, why: `The term for $i = k$ is already inside the sum to $k$: the new term is the one with $i = k + 1$.` },
    { text: `$${sumLine(F, 'k')} + ${F.T('k+2')}$`, why: 'That skips a term: going from $n = k$ to $n = k + 1$ adds exactly one term, the one with $i = k + 1$.' },
    { text: `$${sumLine(F, 'k+1')} + ${F.T('k+1')}$`, why: 'The sum to $k + 1$ already includes the new term, so adding it again counts it twice.' }];
  return spec(mcQ(rng, `In the inductive step for $P(n)$: $${F.claim}$, the left-hand side of $P(k+1)$ is written using the left-hand side of $P(k)$. Which expression is correct?`, ok, ds, {
    dp,
    hints: ['The sum to $k + 1$ terms is the sum to $k$ terms with one more term added.', 'Find the position of the extra term: it is the $(k+1)$th term.', 'Substitute $i = k + 1$ into the general term.', `The left-hand side of $P(k+1)$ is $${sumLine(F, 'k')} + ${F.T('k+1')}$.`],
    steps: [{ h: 'One more term', d: `$${sumLine(F, 'k+1')} = ${sumLine(F, 'k')} + (\\text{the } (k+1)\\text{th term})$` }, { h: 'General term at i = k + 1', d: `$${F.T('k+1')}$` }, { h: 'Left-hand side of P(k+1)', d: `$${sumLine(F, 'k')} + ${F.T('k+1')}$` }]
  }), 'ind-lhs-next', { F: F, m });
});

const iFactorOut = dp => V([2], rng => {
  const F = family(rng, ['lin', 'sq', 'pr', 'cube']);
  const k1 = F.T('k+1');
  let target, key, wrong, lead;
  if (F.kind === 'lin') { target = `\\dfrac{(k+1)\\,Q}{2}`; key = `${F.a}*k+${2 * F.a + 2 * F.b}`; wrong = `${F.a}*k+${F.a + 2 * F.b}`; lead = 'common factor'; }
  else if (F.kind === 'cube') { target = `\\dfrac{(k+1)^{2}\\,Q}{4}`; key = 'k^2+4*(k+1)'; wrong = 'k^2+(k+1)'; lead = 'common factor'; }
  else if (F.kind === 'sq') { target = `\\dfrac{(k+1)\\,Q}{6}`; key = 'k*(2*k+1)+6*(k+1)'; wrong = 'k*(2*k+1)+(k+1)'; lead = 'common factor'; }
  else { target = `\\dfrac{(k+1)\\,Q}{6}`; key = `k*(2*k+${1 + 3 * F.c})+6*(k+${1 + F.c})`; wrong = `k*(2*k+${1 + 3 * F.c})+(k+${1 + F.c})`; lead = 'common factor'; }
  const assumed = F.rhsTex('k');
  const keyTex = { lin: `${F.a}k+${2 * F.a + 2 * F.b}`, cube: 'k^{2}+4(k+1)', sq: 'k(2k+1)+6(k+1)', pr: `k(2k+${1 + 3 * F.c})+6(k+${1 + F.c})` }[F.kind];
  void lead;
  return spec(exprQ(`Assume $P(k)$: $${sumLine(F, 'k')} = ${assumed}$. Add the next term $${k1}$ to both sides. The right-hand side becomes $${assumed} + ${k1}$, and this equals $${target}$ once the common factor $(k+1)$ is taken out. Find $Q$ as an expression in $k$.`, key, {
    dp, prefix: 'Q =',
    traps: [{ expr: wrong, why: `Put the new term over the same denominator first: it must be multiplied by $${F.denom}$ before $(k+1)$ is taken out.` }],
    hints: ['Write both parts of the right-hand side over the same denominator.', `Multiply the new term $${k1}$ by $${F.denom}$ so that it sits over $${F.denom}$ too.`, 'Both parts now contain the factor $(k+1)$ (or a power of it): take it out and read what is left.', `$Q = ${keyTex}$.`],
    steps: [{ h: 'Common denominator', d: `$${assumed} + ${k1} = \\dfrac{\\text{(first part)} + ${F.denom}${k1}}{${F.denom}}$` }, { h: 'Take out the common factor', d: `Both parts contain $(k+1)$` }, { h: 'What remains', d: `$Q = ${keyTex}$` }]
  }), 'ind-factor-out', { F });
});

const iFinalFactor = dp => V([3, 4], rng => {
  const sq = rng() < 0.5, c = ri(rng, 1, 8);
  const claim = sq ? '\\sum_{i=1}^{n} i^{2} = \\dfrac{n(n+1)(2n+1)}{6}' : `\\sum_{i=1}^{n} i(i+${c}) = \\dfrac{n(n+1)(2n+${1 + 3 * c})}{6}`;
  const sk = sq ? 'k(k+1)(2k+1)' : `k(k+1)(2k+${1 + 3 * c})`, nxt = sq ? '(k+1)^{2}' : `(k+1)(k+${1 + c})`;
  const m = sq ? 3 : 3 + 3 * c;
  return spec(exprQ(`Assume $P(k)$ for the result $${claim}$. Adding the next term $${nxt}$ to the right-hand side gives $\\dfrac{${sk}}{6} + ${nxt}$. This simplifies to $\\dfrac{(k+1)(k+2)\\,R}{6}$, where $R$ is a linear expression in $k$. Find $R$.`, `2*k+${m}`, {
    dp, prefix: 'R =',
    traps: [{ expr: `2*k+${sq ? 1 : 1 + 3 * c}`, why: 'The assumed numerator has $2k + \\ldots$ but the result is the statement at $n = k + 1$: the last factor is $2(k+1) + \\ldots$ in the same pattern.' }, { expr: `k+${m}`, why: 'The last factor keeps the coefficient $2$ of $k$: it is $2(k+1)$ plus the constant of the claim.' }],
    hints: ['Take out the common factor $(k+1)$ and write what remains over $6$.', 'The bracket that remains is a quadratic in $k$: expand it.', 'Factorise the quadratic: one factor is $(k+2)$.', `$R = 2k + ${m}$.`],
    steps: [{ h: 'Common factor', d: `$\\dfrac{(k+1)\\left[${sq ? 'k(2k+1)' : `k(2k+${1 + 3 * c})`} + 6${sq ? '(k+1)' : `(k+${1 + c})`}\\right]}{6}$` }, { h: 'Expand the bracket', d: `$\\dfrac{(k+1)(2k^{2} + ${sq ? 7 : 7 + 3 * c}k + ${sq ? 6 : 6 + 6 * c})}{6}$` }, { h: 'Factorise the quadratic', d: `$\\dfrac{(k+1)(k+2)(2k + ${m})}{6}$, so $R = 2k + ${m}$` }]
  }), 'ind-final-factor', { sq, c });
});

const iGeoNumerator = dp => V([4], rng => {
  const r = ri(rng, 3, 7);
  return spec(exprQ(`Assume $\\displaystyle\\sum_{i=1}^{k} ${r}^{i-1} = \\dfrac{${r}^{k}-1}{${r - 1}}$. Adding the next term $${r}^{k}$ to both sides gives $\\dfrac{${r}^{k}-1}{${r - 1}} + ${r}^{k} = \\dfrac{N}{${r - 1}}$. Find the numerator $N$ as an expression in $k$, written with a single power of $${r}$.`, `${r}^(k+1) - 1`, {
    dp, prefix: 'N =',
    traps: [{ expr: `2*${r}^k - 1`, why: `Put $${r}^{k}$ over the denominator $${r - 1}$ by multiplying it by $${r - 1}$ (not by $1$).` }, { expr: `${r}^(k+1) + 1`, why: 'Keep the $-1$ from the assumed numerator: it does not change sign.' }],
    hints: [`Write $${r}^{k}$ as a fraction over $${r - 1}$.`, `$${r}^{k} = \\dfrac{${r - 1}\\times ${r}^{k}}{${r - 1}}$: add the numerators.`, `Collect the powers: $${r}^{k} + ${r - 1}\\times ${r}^{k} = ${r}\\times ${r}^{k}$.`, `$N = ${r}^{k+1} - 1$.`],
    steps: [{ h: 'Common denominator', d: `$${r}^{k} = \\dfrac{${r - 1}\\cdot ${r}^{k}}{${r - 1}}$` }, { h: 'Add the numerators', d: `$${r}^{k} - 1 + ${r - 1}\\cdot ${r}^{k}$` }, { h: 'Collect', d: `$${r}\\cdot ${r}^{k} - 1 = ${r}^{k+1} - 1$, which is the numerator of $P(k+1)$` }]
  }), 'ind-geo-numerator', { r });
});

const iDivM = dp => V([2, 3], rng => {
  const a = ri(rng, 3, 9), d = a - 1;
  return spec(exprQ(`In an induction proof that $${a}^{n} - 1$ is divisible by $${d}$ for all integers $n \\ge 1$, the assumption is $${a}^{k} - 1 = ${d}p$ for some integer $p$. Write $${a}^{k+1} - 1$ in terms of $p$.`, `${a * d}*p + ${d}`, {
    dp, hint: 'e.g. 12p + 5',
    traps: [{ expr: `${a * d}*p - 1`, why: `From the assumption $${a}^{k} = ${d}p + 1$, so $${a}^{k+1} - 1 = ${a}(${d}p + 1) - 1$: the $+1$ is multiplied by $${a}$ too.` }, { expr: `${a * d}*p`, why: `Substitute $${a}^{k} = ${d}p + 1$ and keep the remaining constant: $${a}(${d}p + 1) - 1 = ${a * d}p + ${d}$.` }],
    hints: [`Use the assumption to write $${a}^{k}$ in terms of $p$.`, `$${a}^{k+1} = ${a}\\times ${a}^{k}$.`, `Substitute $${a}^{k} = ${d}p + 1$ into $${a}\\times ${a}^{k} - 1$ and expand.`, `$${a}(${d}p + 1) - 1 = ${a * d}p + ${d} = ${d}(${a}p + 1)$.`],
    steps: [{ h: 'From the assumption', d: `$${a}^{k} = ${d}p + 1$` }, { h: 'Next power', d: `$${a}^{k+1} - 1 = ${a}(${d}p + 1) - 1$` }, { h: 'Expand', d: `$= ${a * d}p + ${d} = ${d}(${a}p + 1)$, a multiple of $${d}$` }]
  }), 'ind-div-m', { a });
});

const iDivMk = dp => V([3], rng => {
  const a = ri(rng, 4, 9), b = ri(rng, 2, a - 2), d = a - b;
  return spec(exprQ(`In an induction proof that $${a}^{n} - ${b}^{n}$ is divisible by $${d}$ for all integers $n \\ge 1$, the assumption is $${a}^{k} - ${b}^{k} = ${d}p$ for some integer $p$. Then $${a}^{k+1} - ${b}^{k+1} = ${a}(${a}^{k} - ${b}^{k}) + (\\ldots)$. Write $${a}^{k+1} - ${b}^{k+1}$ in terms of $p$ and $k$.`, `${a * d}*p + ${d}*${b}^k`, {
    dp, hint: 'e.g. 15p + 4*3^k',
    traps: [{ expr: `${a * d}*p`, why: `$${a}^{k+1} - ${b}^{k+1} = ${a}\\left(${a}^{k} - ${b}^{k}\\right) + ${b}^{k}(${a} - ${b})$: the second part is not zero.` }, { expr: `${a * d}*p + ${b}^k`, why: `The leftover is $${b}^{k}(${a} - ${b}) = ${d}\\times ${b}^{k}$: keep the factor $${d}$.` }],
    hints: [`Write $${a}^{k+1} - ${b}^{k+1}$ so that $(${a}^{k} - ${b}^{k})$ appears.`, `Add and subtract $${a}\\times ${b}^{k}$ so that the bracket appears: $${a}^{k+1} - ${b}^{k+1} = ${a}(${a}^{k} - ${b}^{k}) + ${b}^{k}(${a} - ${b})$.`, `Replace $${a}^{k} - ${b}^{k}$ by $${d}p$.`, `The result is $${a * d}p + ${d}\\times ${b}^{k} = ${d}(${a}p + ${b}^{k})$.`],
    steps: [{ h: 'Split', d: `$${a}^{k+1} - ${b}^{k+1} = ${a}(${a}^{k} - ${b}^{k}) + ${b}^{k}(${a} - ${b})$` }, { h: 'Use the assumption', d: `$= ${a}(${d}p) + ${d}\\times ${b}^{k}$` }, { h: 'Factor', d: `$= ${d}(${a}p + ${b}^{k})$, a multiple of $${d}$` }]
  }), 'ind-div-mk', { a, b });
});

const iDivCubic = dp => V([2, 3], rng => {
  const t = ri(rng, 1, 6), c = 3 * t - 1;
  return spec(exprQ(`In an induction proof that $n^{3} + ${c}n$ is divisible by $3$ for all integers $n \\ge 1$, the assumption is $k^{3} + ${c}k = 3p$ for some integer $p$. Write $(k+1)^{3} + ${c}(k+1)$ in terms of $p$ and $k$ (the form $3p + 3(\\ldots)$ shows divisibility by $3$).`, `3*p + 3*(k^2 + k + ${t})`, {
    dp, hint: 'e.g. 3p + 3(k^2 + 2)',
    traps: [{ expr: `3*p + 3*(k^2 + k)`, why: `Do not drop the constant: $1 + ${c} = ${3 * t}$ also contributes a multiple of $3$.` }, { expr: `3*p + k^2 + k + ${t}`, why: 'The whole remainder $3k^{2} + 3k + ' + 3 * t + '$ must be written with the common factor $3$.' }],
    hints: ['Expand $(k+1)^{3}$.', `Find what is left after removing $k^{3} + ${c}k$ from $(k+1)^{3} + ${c}(k+1)$.`, 'Replace $k^{3} + ' + c + 'k$ by $3p$ and take $3$ out of the rest.', `The result is $3p + 3(k^{2} + k + ${t})$.`],
    steps: [{ h: 'Expand', d: `$(k+1)^{3} + ${c}(k+1) = k^{3} + 3k^{2} + 3k + 1 + ${c}k + ${c}$` }, { h: 'Group', d: `$= (k^{3} + ${c}k) + 3k^{2} + 3k + ${3 * t}$` }, { h: 'Use the assumption', d: `$= 3p + 3(k^{2} + k + ${t})$` }]
  }), 'ind-div-cubic', { t });
});

// base case of an inequality that starts above 1
const POWERS = [[2, 2], [2, 3], [3, 3], [4, 4], [2, 4], [3, 4]];
function ineqFamily(rng) {
  const [b, p] = rc(rng, POWERS);
  const holds = n => BigInt(b) ** BigInt(n) > BigInt(n) ** BigInt(p);
  let last = 0;
  for (let n = 1; n <= 40; n++) if (!holds(n)) last = n;
  const N = last + 1;
  rej(N < 3 || N > 12 || !holds(N));
  return { b, p, N, holds };
}
const iBaseCase = dp => V([1], rng => {
  const { b, p, N } = ineqFamily(rng);
  const lhs = b ** N, rhs = N ** p, lhs1 = b, rhs1 = 1;
  const wrongL = lhs + b * N;
  const ok = `$n = ${N}$: $${b}^{${N}} = ${lhs}$ and $${N}^{${p}} = ${rhs}$, and $${lhs} > ${rhs}$, so $P(${N})$ is true.`;
  const ds = [
    { text: `$n = 1$: $${b}^{1} = ${lhs1}$ and $1^{${p}} = ${rhs1}$, and $${lhs1} > ${rhs1}$, so $P(1)$ is true.`, why: `The statement is only claimed for $n \\ge ${N}$: the base case must be the **first value in the range**, $n = ${N}$.` },
    { text: `$n = ${N - 1}$: $${b}^{${N - 1}} = ${b ** (N - 1)}$ and $${N - 1}^{${p}} = ${(N - 1) ** p}$, and $${b ** (N - 1)} \\le ${(N - 1) ** p}$, so $P(${N - 1})$ is false.`, why: `$n = ${N - 1}$ is outside the range $n \\ge ${N}$, so it neither proves nor disproves the base case.` },
    { text: `$n = ${N}$: $${b}^{${N}} = ${wrongL}$ and $${N}^{${p}} = ${rhs}$, and $${wrongL} > ${rhs}$, so $P(${N})$ is true.`, why: `Check the arithmetic: $${b}^{${N}} = ${lhs}$, not $${wrongL}$. A base case must be calculated correctly.` }];
  return spec(mcQ(rng, `A proof by induction that $${b}^{n} > n^{${p}}$ is to be given for all integers $n \\ge ${N}$ (the statement is true for those $n$). Which line is a correct **base case** check?`, ok, ds, {
    dp,
    hints: ['The base case checks the statement at the first value in the stated range.', `Which value of $n$ is that here?`, 'Both sides must be calculated correctly and compared with the right inequality sign.', `Check $n = ${N}$: $${b}^{${N}} = ${lhs}$ and $${N}^{${p}} = ${rhs}$.`],
    steps: [{ h: 'First value', d: `The range starts at $n = ${N}$` }, { h: 'Left side', d: `$${b}^{${N}} = ${lhs}$` }, { h: 'Right side', d: `$${N}^{${p}} = ${rhs}$` }, { h: 'Compare', d: `$${lhs} > ${rhs}$, so $P(${N})$ is true` }]
  }), 'ind-base-case', { b, p, N, opts: [{ n: N, l: lhs, r: rhs }, { n: 1, l: lhs1, r: rhs1 }, { n: N - 1, l: b ** (N - 1), r: (N - 1) ** p }, { n: N, l: wrongL, r: rhs }] });
});

// find the flawed line: arithmetic or term slip in a series argument
const iFlawSeries = dp => V([2], rng => {
  const a = ri(rng, 2, 9), b = ri(rng, 1, 9), flawLine = rc(rng, [1, 3]);
  const claim = `\\sum_{i=1}^{n}(${a}i+${b}) = \\dfrac{n(${a}n+${a + 2 * b})}{2}`, rhs1 = (a + a + 2 * b) / 2;
  const L1 = flawLine === 1 ? `When $n = 1$: left side $= ${a + b}$ and right side $= \\dfrac{1(${a}+${a + 2 * b})}{2} = ${rhs1 + b}$, so $P(1)$ is true.` : `When $n = 1$: left side $= ${a + b}$ and right side $= \\dfrac{1(${a}+${a + 2 * b})}{2} = ${rhs1}$, so $P(1)$ is true.`;
  const L2 = `Assume $P(k)$: $\\sum_{i=1}^{k}(${a}i+${b}) = \\dfrac{k(${a}k+${a + 2 * b})}{2}$ for some integer $k \\ge 1$.`;
  const term = flawLine === 3 ? `(${a}k+${b})` : `(${a}(k+1)+${b})`;
  const L3 = `Then $\\sum_{i=1}^{k+1}(${a}i+${b}) = \\dfrac{k(${a}k+${a + 2 * b})}{2} + ${term}$, which simplifies to $\\dfrac{(k+1)(${a}(k+1)+${a + 2 * b})}{2}$.`;
  const L4 = 'So $P(k)$ implies $P(k+1)$. Since $P(1)$ is true, $P(n)$ is true for all integers $n \\ge 1$.';
  const names = ['Line 1 (the base case)', 'Line 2 (the assumption)', 'Line 3 (adding the next term)', 'Line 4 (the conclusion)'];
  const why = [
    'Line 1 is correct: both sides are $' + (a + b) + '$ at $n = 1$.',
    'Line 2 is correct: the assumption is $P(k)$, written for a general $k$.',
    `Line 3 is correct: the term added is the one for $i = k + 1$.`,
    'Line 4 is correct: base case plus the step gives the result for every $n \\ge 1$.'];
  const ok = names[flawLine - 1];
  const ds = names.filter((_, i) => i !== flawLine - 1).map(text => ({ text, why: why[names.indexOf(text)] }));
  return spec(mcQ(rng, `A student writes this induction proof of $P(n)$: $${claim}$ for all integers $n \\ge 1$.\n\n**Line 1:** ${L1}\n\n**Line 2:** ${L2}\n\n**Line 3:** ${L3}\n\n**Line 4:** ${L4}\n\nOne line contains an error.\nWhich line is it?`, ok, ds, {
    dp,
    hints: ['Check each line on its own: is every claim in it true?', 'In the base case, evaluate both sides yourself. In the step, check which term is added.', 'The new term when going from $k$ to $k + 1$ terms is the one with $i = k + 1$.', flawLine === 1 ? `The right side at $n = 1$ is $${rhs1}$, not $${rhs1 + b}$.` : `Line 3 adds the $k$th term instead of the $(k+1)$th.`],
    steps: [{ h: 'Base case', d: `At $n = 1$ both sides should equal $${a + b}$` }, { h: 'Step', d: 'The term added is $i = k + 1$' }, { h: 'Error', d: `The faulty line is ${ok}` }]
  }), 'ind-flaw-series', { a, b, flawLine, shownRhs1: flawLine === 1 ? rhs1 + b : rhs1, termUsed: flawLine === 3 ? 'k' : 'k+1' });
});

// find the flawed line: a logical gap in the structure
const iFlawLogic = dp => V([4], rng => {
  const tri = rng() < 0.5, flaw = rc(rng, ['all', 'start', 'term']);
  const claim = tri ? '\\sum_{i=1}^{n} i = \\dfrac{n(n+1)}{2}' : '\\sum_{i=1}^{n}(2i-1) = n^{2}';
  const S = k => (tri ? `\\dfrac{${k}(${k}+1)}{2}` : `${k}^{2}`);
  const next = tri ? '(k+1)' : '(2k+1)', wrongNext = tri ? 'k' : '(2k-1)';
  const base = flaw === 'start'
    ? `When $n = 2$: left side $= ${tri ? 3 : 4}$ and right side $= ${tri ? '\\dfrac{2\\times 3}{2} = 3' : '2^{2} = 4'}$, so $P(2)$ is true.`
    : `When $n = 1$: left side $= 1$ and right side $= ${tri ? '\\dfrac{1\\times 2}{2} = 1' : '1^{2} = 1'}$, so $P(1)$ is true.`;
  const assume = flaw === 'all' ? 'Assume $P(n)$ is true for **every** integer $n \\ge 1$.' : 'Assume $P(k)$ is true for some integer $k \\ge 1$.';
  const step = `Then $\\sum_{i=1}^{k+1}${tri ? 'i' : '(2i-1)'} = ${S('k')} + ${flaw === 'term' ? wrongNext : next} = ${S('(k+1)')}$.`;
  const concl = 'So $P(k)$ implies $P(k+1)$, and by the principle of induction $P(n)$ is true for all integers $n \\ge 1$.';
  const names = ['Line 1 (the base case)', 'Line 2 (the assumption)', 'Line 3 (the step)', 'Line 4 (the conclusion)'];
  const idx = { start: 0, all: 1, term: 2 }[flaw];
  const why = [
    'Line 1 is correct: it checks $P(1)$, the first case of the statement.',
    'Line 2 is correct: it assumes one case, $P(k)$, only.',
    'Line 3 is correct: the term added is the $(k+1)$th term and the algebra is right.',
    'Line 4 is correct given the lines before it.'];
  const ds = names.filter((_, i) => i !== idx).map(text => ({ text, why: why[names.indexOf(text)] }));
  const reasons = { start: 'the base case must be the first value in the statement, $n = 1$, not $n = 2$', all: 'assuming the result for every $n$ is assuming what is to be proved: the step assumes only $P(k)$', term: `the new term is $${next}$, not $${wrongNext}$, and the algebra does not give $${S('(k+1)')}$` };
  return spec(mcQ(rng, `A student writes this induction proof of $P(n)$: $${claim}$ for all integers $n \\ge 1$.\n\n**Line 1:** ${base}\n\n**Line 2:** ${assume}\n\n**Line 3:** ${step}\n\n**Line 4:** ${concl}\n\nOne line is flawed.\nWhich line is it?`, names[idx], ds, {
    dp,
    hints: ['Check the three parts of a proof by induction in turn: base case, assumption, step.', 'The base case is the first value of $n$ in the statement; the assumption covers a single $k$.', 'In the step, the term added must be the $(k+1)$th term and the algebra must reach $P(k+1)$.', `The flaw is in ${names[idx]}: ${reasons[flaw]}.`],
    steps: [{ h: 'Base case', d: 'Must verify the first value, $n = 1$' }, { h: 'Assumption and step', d: 'Assume $P(k)$ for one $k$; add the $(k+1)$th term to reach $P(k+1)$' }, { h: 'Flaw', d: `${names[idx]}: ${reasons[flaw]}` }]
  }), 'ind-flaw-logic', { tri, flaw });
});

// which inequality must be shown
const iIneqShow = dp => V([4], rng => {
  const [b, p] = rc(rng, [[2, 2], [2, 3], [3, 2], [3, 3], [4, 3]]);
  const ok = `$${b}k^{${p}} \\ge (k+1)^{${p}}$`;
  const ds = [
    { text: `$k^{${p}} \\ge (k+1)^{${p}}$`, why: `The assumption gives $${b}^{k+1} > ${b}\\times k^{${p}}$: the factor $${b}$ must stay.` },
    { text: `$${b}k^{${p}} \\ge k^{${p}} + 1$`, why: `$(k+1)^{${p}}$ is not $k^{${p}} + 1$: the target is $(k+1)^{${p}}$ itself.` },
    { text: `$${b}^{k+1} \\ge ${b}k^{${p}}$`, why: `That already follows from the assumption; it does not reach the target $(k+1)^{${p}}$.` }];
  return spec(mcQ(rng, `In an induction proof of $${b}^{n} > n^{${p}}$, assume $P(k)$: $${b}^{k} > k^{${p}}$. To prove $P(k+1)$ we need $${b}^{k+1} > (k+1)^{${p}}$. Using the assumption, $${b}^{k+1} = ${b}\\times ${b}^{k} > ${b}k^{${p}}$. Which inequality must now be shown (for the relevant $k$) to complete the step?`, ok, ds, {
    dp,
    hints: ['The step chains two inequalities: $\\text{target left side} > \\text{something} \\ge \\text{target right side}$.', 'The "something" is what the assumption produced.', 'So the missing link compares that expression with the right side of the target.', `The link to show is $${b}k^{${p}} \\ge (k+1)^{${p}}$.`],
    steps: [{ h: 'From the assumption', d: `$${b}^{k+1} > ${b}k^{${p}}$` }, { h: 'Target', d: `$${b}^{k+1} > (k+1)^{${p}}$` }, { h: 'Missing link', d: `$${b}k^{${p}} \\ge (k+1)^{${p}}$` }]
  }), 'ind-ineq-show', { b, p });
});

// the difference that must be positive
const iIneqDiff = dp => V([4], rng => {
  const b = ri(rng, 2, 4), c = ri(rng, 2, 6), d = ri(rng, 1, 3);
  const holds = n => BigInt(b) ** BigInt(n) > BigInt(c * n + d);
  let last = 0;
  for (let n = 1; n <= 40; n++) if (!holds(n)) last = n;
  const N = last + 1;
  rej(N > 10);
  const ck = c === 1 ? 'k' : `${c}k`;
  return spec(exprQ(`The statement $P(n)$: $${b}^{n} > ${c}n + ${d}$ is proved by induction for all integers $n \\ge ${N}$. In the step, assume $P(k)$: $${b}^{k} > ${ck} + ${d}$, so $${b}^{k+1} > ${b}(${ck} + ${d})$. To reach $P(k+1)$ it is enough that $${b}(${ck} + ${d}) - \\left(${c}(k+1) + ${d}\\right) \\ge 0$. Simplify the left-hand side to a linear expression in $k$.`, `${(b - 1) * c}*k + ${(b - 1) * d - c}`, {
    dp, hint: 'e.g. 9k - 2',
    traps: [{ expr: `${(b - 1) * c}*k + ${(b - 1) * d}`, why: `Expand $${c}(k+1)$ fully: it contributes $${c}k + ${c}$, so the constant has $-${c}$ in it.` }, { expr: `${(b - 1) * c}*k + ${b * d - c}`, why: `The constant $${d}$ appears in both brackets: $${b}\\times ${d} - ${d}$, not $${b}\\times ${d}$ alone.` }],
    hints: ['Expand both brackets.', `$${b}(${ck} + ${d}) = ${b * c}k + ${b * d}$ and $${c}(k+1) + ${d} = ${c}k + ${c + d}$.`, 'Subtract: collect the $k$ terms and the constants separately.', `The difference is $${(b - 1) * c}k ${sg((b - 1) * d - c)}$.`],
    steps: [{ h: 'Expand', d: `$${b}(${ck} + ${d}) = ${b * c}k + ${b * d}$` }, { h: 'Target side', d: `$${c}(k+1) + ${d} = ${c}k + ${c + d}$` }, { h: 'Subtract', d: `$${(b - 1) * c}k ${sg((b - 1) * d - c)}$, which is $\\ge 0$ for the $k$ in the range` }]
  }), 'ind-ineq-diff', { b, c, d });
});

// ═══ registration: each form with the dot point and difficulties of its host ═══
// me12-induction dot points: 0 series, 1 divisibility, 2 structure.
// me12-induction-forms dot points: 0 base case / next term in a series proof, 1 constant in a divisibility step.
const at = (variant, diffs) => ({ diffs, make: variant.make });
const indMap = {
  'me12-induction': [
    at(iRhsNext(0), [1]), at(iLhsNext(0), [1]), at(iBaseCase(2), [1]),
    at(iFactorOut(0), [2]), at(iFlawSeries(2), [2]),
    at(iDivM(1), [3]), at(iDivMk(1), [3]), at(iDivCubic(1), [3]),
    at(iFinalFactor(0), [4]), at(iGeoNumerator(0), [4]), at(iFlawLogic(2), [4]), at(iIneqShow(2), [4]), at(iIneqDiff(2), [4])
  ],
  'me12-induction-forms': [
    at(iRhsNext(0), [1]), at(iLhsNext(0), [1]), at(iBaseCase(0), [1]),
    at(iFactorOut(0), [2, 3]), at(iDivM(1), [2]), at(iDivCubic(1), [2]),
    at(iFinalFactor(0), [3, 4]), at(iGeoNumerator(0), [4])
  ]
};



export const forms = { ...calcMap, ...indMap };
