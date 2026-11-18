// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Prithagoras capacity overlay — Advanced Year 12, slot B
// y12-explogcalc, y12-trigcalc, y12-motion, y12-series.
// Every key is computed by deterministic code from the numbers shown in the
// prompt. Each variant is built by a `gen(rng, diff)` that returns the payload
// AND an independent truth (a numeric differentiation / quadrature / direct
// recomputation, never the closed form the key came from) so the sweep can
// check the key against something written differently. `make` is gen()[0].
// Variants are chosen by au-forms-apply.js.
// ─────────────────────────────────────────────────────────────────────────────
import { ri, rc, nz, mcq, Frac, gcd, poly } from '../qhelpers.js';

/** An exponent m x written without a stray 1: 1 -> x, -1 -> -x. */
const et = m => (m === 1 ? 't' : m === -1 ? '-t' : `${m}t`);
const ex = m => (m === 1 ? 'x' : m === -1 ? '-x' : `${m}x`);
const fin = v => typeof v === 'number' && Number.isFinite(v);
const D = v => `\\$${String(v).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;

/** A coefficient written in front of a symbol: 1 -> '', -1 -> '-'. */
const cf = c => (c === 1 ? '' : c === -1 ? '-' : String(c));
/** The argument a x + b in LaTeX / as typed (b may be 0). */
const lin = (a, b, v = 'x') => `${cf(a)}${v}${b > 0 ? ` + ${b}` : b < 0 ? ` - ${-b}` : ''}`;
const linS = (a, b) => `${a}*x${b > 0 ? `+${b}` : b < 0 ? `-${-b}` : ''}`;
/** A signed term for appending: ' + 3' / ' - 3'. */
const sg = v => (v < 0 ? ` - ${-v}` : ` + ${v}`);

/** Typographic clean-up: no 1x / 1k / 1t / 1e^, no ^{1}, no '+ -' or '- -', no dangling \cdot. */
function tidyStr(t) {
  if (typeof t !== 'string') return t;
  return t
    .replace(/(^|[^\d.\w\\])1(?=[xkt](?![a-zA-Z{]))/g, '$1')
    .replace(/(^|[^\d.\w\\])1(?=e\^)/g, '$1')
    .replace(/\^\{1\}(?!\d)/g, '')
    .replace(/\+ -(?=\d|\\|[a-z])/g, '- ')
    .replace(/- -(?=\d|\\|[a-z])/g, '+ ')
    .replace(/\\cdot\s*(?=[$}),.])/g, '');
}
function tidy(q) {
  if (!q) return;
  q.prompt = tidyStr(q.prompt);
  if (Array.isArray(q.hints)) q.hints = q.hints.map(tidyStr);
  if (Array.isArray(q.steps)) q.steps = q.steps.map(st => ({ ...st, h: tidyStr(st.h), d: tidyStr(st.d) }));
  if (Array.isArray(q.mcqOptions)) q.mcqOptions = q.mcqOptions.map(tidyStr);
  if (q.answer?.optionTraps) for (const k of Object.keys(q.answer.optionTraps)) q.answer.optionTraps[k] = tidyStr(q.answer.optionTraps[k]);
  if (Array.isArray(q.traps)) for (const t of q.traps) if (t.why) t.why = tidyStr(t.why);
}

/** Wrap a generator: make = payload only; gen carries the independent truth. */
const V = (name, diffs, raw) => {
  // a draw that lands on a degenerate case is redrawn from the same rng (never thrown to the caller)
  const gen = (rng, diff) => { let last; for (let i = 0; i < 80; i++) { try { return raw(rng, diff); } catch (e) { last = e; } } throw last; };
  return { name, diffs, gen: (rng, diff) => { const out = gen(rng, diff); tidy(out[0]); return out; }, make: (rng, diff) => { const out = gen(rng, diff); tidy(out[0]); return out[0]; } };
};

/** Numeric payload; a trap that equals the key (or repeats) is not a misconception. */
function numQ(prompt, value, { suffix, prefix, traps = [], hints, steps, tol, inputHint, exact, figure } = {}) {
  const seen = new Set([value]);
  const tr = [];
  for (const t of traps) if (fin(t.value) && !seen.has(t.value)) { seen.add(t.value); tr.push(t); }
  const answer = { value };
  if (tol != null) answer.tol = tol;
  if (exact) { answer.requireExact = true; answer.canonicalInput = exact; if (tol == null) answer.tol = 0.0005; }
  const q = { prompt, answerType: 'numeric', answer, traps: tr, hints, steps };
  if (suffix) q.answerSuffix = suffix;
  if (prefix) q.answerPrefix = prefix;
  if (inputHint) q.inputHint = inputHint;
  if (figure) q.figure = figure;
  return q;
}
/** A rational key, in simplest form, with the fraction demanded when it is not a whole number. */
function fracQ(prompt, f, opts = {}) {
  const q = numQ(prompt, f.value, { ...opts, tol: 0.001, traps: (opts.traps || []).map(t => (t instanceof Frac ? t : t)) });
  if (f.d !== 1) { q.answer.simplestFraction = { n: f.n, d: f.d }; q.inputHint = opts.inputHint || 'a fraction in simplest form, e.g. 3/4'; }
  else { delete q.answer.tol; q.inputHint = opts.inputHint || 'a whole number'; }
  return q;
}
function exprQ(prompt, expr, { traps = [], hints, steps, inputHint, prefix, stripC, positiveOnly } = {}) {
  const answer = { expr };
  if (stripC) answer.stripC = true;
  if (positiveOnly) answer.positiveOnly = true;
  const q = { prompt, answerType: 'expression', answer, traps: traps.filter(t => t.expr !== expr), hints, steps };
  if (inputHint) q.inputHint = inputHint;
  if (prefix) q.answerPrefix = prefix;
  return q;
}
function mcQ(rng, prompt, correct, ds, hints, steps) {
  const m = mcq(rng, correct, ds);
  return { prompt, answerType: 'mcq', answer: { correctIndex: m.correctIndex, optionTraps: m.optionTraps }, mcqOptions: m.options, hints, steps };
}

// ── Independent numerics (never the closed forms the keys use) ───────────────
const numD = (f, x) => { const h = 1e-5; return (f(x + h) - f(x - h)) / (2 * h); };
function simpson(f, lo, hi, n = 2000) {
  const h = (hi - lo) / n;
  let s = f(lo) + f(hi);
  for (let i = 1; i < n; i++) s += f(lo + i * h) * (i % 2 ? 4 : 2);
  return s * h / 3;
}
const DEG = Math.PI / 180;

/** π·deg/(180·a) as LaTeX, a typed string and a number. */
function piAng(deg, a = 1) {
  const n0 = deg, d0 = 180 * a;
  const g = gcd(n0, d0);
  const p = n0 / g, q = d0 / g;
  if (p === 0) return { tex: '0', typed: '0', val: 0 };
  const head = p === 1 ? '\\pi' : `${p}\\pi`;
  const headT = p === 1 ? 'pi' : `${p}pi`;
  return { tex: q === 1 ? head : `\\dfrac{${head}}{${q}}`, typed: q === 1 ? headT : `${headT}/${q}`, val: p * Math.PI / q };
}
// sin and cos at the angles where each is rational (degrees -> Frac)
const SIN_R = { 0: [0, 1], 30: [1, 2], 90: [1, 1], 150: [1, 2], 180: [0, 1], 210: [-1, 2], 270: [-1, 1], 330: [-1, 2], 360: [0, 1] };
const COS_R = { 0: [1, 1], 60: [1, 2], 90: [0, 1], 120: [-1, 2], 180: [-1, 1], 240: [-1, 2], 270: [0, 1], 300: [1, 2], 360: [1, 1] };
const fr = ([n, d]) => new Frac(n, d);
const SIN_DEGS = Object.keys(SIN_R).map(Number);
const COS_DEGS = Object.keys(COS_R).map(Number);

// ═════════════════════════════════════════════════════════════════════════════
// y12-trigcalc
// ═════════════════════════════════════════════════════════════════════════════
const trigForms = [];

// Differentiate k fn(ax + b) — sin, cos, tan with a linear argument (expression)
trigForms.push(V('trig-diff-linear-arg', [1, 2], (rng) => {
  const fn = rc(rng, ['sin', 'cos', 'tan']);
  const k = nz(rng, -9, 9), a = ri(rng, 2, 9), b = rc(rng, [0, ...[-9, -8, -7, -6, -5, -4, -3, -2, -1, 1, 2, 3, 4, 5, 6, 7, 8, 9]]);
  const arg = lin(a, b), argS = linS(a, b);
  const ka = k * a;
  const keyTex = fn === 'sin' ? `${cf(ka)}\\cos(${arg})` : fn === 'cos' ? `${cf(-ka)}\\sin(${arg})` : `${cf(ka)}\\sec^2(${arg})`;
  const expr = fn === 'sin' ? `${ka}*cos(${argS})` : fn === 'cos' ? `${-ka}*sin(${argS})` : `${ka}*sec(${argS})^2`;
  const traps = fn === 'sin' ? [
    { expr: `${k}*cos(${argS})`, why: `Chain rule: the derivative of the inside, $${arg}$, is $${a}$ — it multiplies the whole result.` },
    { expr: `${-ka}*cos(${argS})`, why: 'The derivative of sine is +cosine — there is no sign change.' }
  ] : fn === 'cos' ? [
    { expr: `${ka}*sin(${argS})`, why: 'The derivative of cosine is **negative** sine — the sign flips.' },
    { expr: `${-k}*sin(${argS})`, why: `Chain rule: the derivative of the inside, $${arg}$, is $${a}$ — it multiplies the whole result.` }
  ] : [
    { expr: `${ka}*sec(${argS})`, why: 'The derivative of $\\tan u$ is $\\sec^2 u$ — the secant is squared.' },
    { expr: `${k}*sec(${argS})^2`, why: `Chain rule: the derivative of the inside, $${arg}$, is $${a}$ — it multiplies the whole result.` }
  ];
  const std = fn === 'sin' ? '\\cos u' : fn === 'cos' ? '-\\sin u' : '\\sec^2 u';
  const q = exprQ(`Differentiate $y = ${cf(k)}\\${fn}(${arg})$ with respect to $x$.`, expr, {
    inputHint: `e.g. ${fn === 'tan' ? `${ka}sec(${argS})^2` : `${ka}${fn === 'sin' ? 'cos' : 'sin'}(${argS})`}`,
    prefix: 'dy/dx =', traps,
    hints: [`$\\dfrac{d}{du}\\${fn}\\,u = ${std}$ with $u = ${arg}$.`, `The inside $${arg}$ differentiates to $${a}$.`, `Multiply: $${k} \\times ${a} = ${ka}$.`],
    steps: [
      { h: 'Standard derivative', d: `$\\dfrac{d}{du}\\${fn}\\,u = ${std}$` },
      { h: 'Chain rule', d: `$u = ${arg}$, so $\\dfrac{du}{dx} = ${a}$` },
      { h: 'Combine', d: `$\\dfrac{dy}{dx} = ${k} \\times ${a} \\times (${std.replace('u', arg)}) = ${keyTex}$` }
    ]
  });
  const f = x => k * (fn === 'sin' ? Math.sin(a * x + b) : fn === 'cos' ? Math.cos(a * x + b) : Math.tan(a * x + b));
  return [q, { kind: 'deriv', f, expr }];
}));

// Antiderivative of k fn(ax + b): sin, cos, sec^2 (expression)
trigForms.push(V('trig-int-linear-arg', [1, 2], (rng) => {
  const fn = rc(rng, ['sin', 'cos', 'sec2']);
  const k = nz(rng, -9, 9), a = ri(rng, 2, 8), b = rc(rng, [0, -7, -5, -3, -2, -1, 1, 2, 3, 4, 5, 6, 9]);
  const arg = lin(a, b), argS = linS(a, b);
  const body = fn === 'sec2' ? `\\sec^2(${arg})` : `\\${fn}(${arg})`;
  const expr = fn === 'sin' ? `${-k}/${a}*cos(${argS})` : fn === 'cos' ? `${k}/${a}*sin(${argS})` : `${k}/${a}*tan(${argS})`;
  const traps = fn === 'sin' ? [
    { expr: `${-k * a}*cos(${argS})`, why: `Integrating **divides** by the inner coefficient $${a}$; it does not multiply by it.` },
    { expr: `${k}/${a}*cos(${argS})`, why: '$\\int \\sin u\\,du = -\\cos u + C$ — keep the negative sign.' }
  ] : fn === 'cos' ? [
    { expr: `${k * a}*sin(${argS})`, why: `Integrating **divides** by the inner coefficient $${a}$; it does not multiply by it.` },
    { expr: `${-k}/${a}*sin(${argS})`, why: '$\\int \\cos u\\,du = +\\sin u + C$ — there is no negative sign.' }
  ] : [
    { expr: `${k * a}*tan(${argS})`, why: `Integrating **divides** by the inner coefficient $${a}$; it does not multiply by it.` },
    { expr: `${k}/${a}*sec(${argS})`, why: 'The antiderivative of $\\sec^2 u$ is $\\tan u$, not a secant.' }
  ];
  const stdInt = fn === 'sin' ? '-\\cos u' : fn === 'cos' ? '\\sin u' : '\\tan u';
  const half = `\\dfrac{${k}}{${a}}`;
  const q = exprQ(`Find $\\displaystyle\\int ${cf(k)}${body}\\,dx$. (You may omit the $+C$.)`, expr, {
    stripC: true, prefix: '∫ =', inputHint: `e.g. ${fn === 'sin' ? `-${k}/${a}cos(${argS})` : `${k}/${a}${fn === 'cos' ? 'sin' : 'tan'}(${argS})`} + C`, traps,
    hints: [`$\\displaystyle\\int ${fn === 'sec2' ? '\\sec^2' : `\\${fn}`}\\,u\\,du = ${stdInt} + C$.`, `The inside $${arg}$ has derivative $${a}$, so divide by $${a}$.`, 'Check by differentiating your answer.'],
    steps: [
      { h: 'Standard integral', d: `$\\displaystyle\\int ${fn === 'sec2' ? '\\sec^2' : `\\${fn}`}\\,u\\,du = ${stdInt} + C$` },
      { h: 'Reverse the chain rule', d: `Divide by the inside derivative: $\\dfrac{1}{${a}}$` },
      { h: 'Answer', d: `$${half}\\,(${stdInt.replace('u', arg)}) + C$` }
    ]
  });
  const g = x => k * (fn === 'sin' ? Math.sin(a * x + b) : fn === 'cos' ? Math.cos(a * x + b) : 1 / Math.cos(a * x + b) ** 2);
  return [q, { kind: 'anti', f: g, expr }];
}));

// MCQ: derivative or antiderivative of a function of ax + b, with the usual slips as options
trigForms.push(V('trig-mcq-chain', [1, 2, 3], (rng) => {
  const integral = rng() < 0.5;
  const fn = rc(rng, ['sin', 'cos']);
  const k = rc(rng, [1, 2, 3, 4, 5, 6, -2, -3, -4]), a = ri(rng, 2, 7), b = rc(rng, [0, 1, 2, 3, -1, -2, -4]);
  const arg = lin(a, b);
  if (!integral) {
    const ka = k * a, sgnTrue = fn === 'sin' ? 1 : -1;
    const t = (c, f) => `$${cf(c)}\\${f}(${arg})$`;
    const good = t(sgnTrue * ka, fn === 'sin' ? 'cos' : 'sin');
    const q = mcQ(rng, `Which expression is the derivative of $y = ${cf(k)}\\${fn}(${arg})$?`, good, [
      { text: t(sgnTrue * k, fn === 'sin' ? 'cos' : 'sin'), why: `The inside $${arg}$ has derivative $${a}$, which multiplies the result (chain rule).` },
      { text: t(-sgnTrue * ka, fn === 'sin' ? 'cos' : 'sin'), why: fn === 'sin' ? 'The derivative of sine is +cosine.' : 'The derivative of cosine is **negative** sine.' },
      { text: `$${cf(sgnTrue * ka)}\\${fn}(${arg})$`, why: `Differentiating changes sine to cosine (or cosine to sine); the function does not stay the same.` },
      { text: `$${cf(sgnTrue * ka)}\\${fn === 'sin' ? 'cos' : 'sin'}(${a})$`, why: 'The inside stays as it is: $(' + arg + ')$ is not replaced by its derivative.' }
    ], [`$\\dfrac{d}{du}\\${fn}\\,u = ${fn === 'sin' ? '\\cos u' : '-\\sin u'}$.`, `Chain rule: multiply by $${a}$.`, 'Check the sign.'],
    [{ h: 'Outer derivative', d: `$\\dfrac{d}{du}\\${fn}\\,u = ${fn === 'sin' ? '\\cos u' : '-\\sin u'}$` }, { h: 'Inside derivative', d: `$\\dfrac{d}{dx}(${arg}) = ${a}$` }, { h: 'Combine', d: `$${k} \\times ${a} = ${ka}$, so $y' = ${t(sgnTrue * ka, fn === 'sin' ? 'cos' : 'sin').slice(1, -1)}$` }]);
    return [q, { kind: 'mcq' }];
  }
  const c = k * 0 + (rc(rng, [1, 2, 3, 4, 6, 8, 9]) * a) * rc(rng, [1, -1]);   // the integrand's coefficient is a multiple of a
  const m = c / a;
  const sgnTrue = fn === 'sin' ? -1 : 1, F = fn === 'sin' ? 'cos' : 'sin';
  const t = (cc, f) => `$${cf(cc)}\\${f}(${arg}) + C$`;
  const q = mcQ(rng, `Which expression is $\\displaystyle\\int ${cf(c)}\\${fn}(${arg})\\,dx$?`, t(sgnTrue * m, F), [
    { text: t(sgnTrue * c * a, F), why: `Integrating **divides** by the inside coefficient $${a}$, so $${c} \\div ${a} = ${m}$ — not $${c} \\times ${a}$.` },
    { text: t(sgnTrue * c, F), why: `The $\\dfrac{1}{${a}}$ from reversing the chain rule is missing: $${c} \\div ${a} = ${m}$.` },
    { text: t(-sgnTrue * m, F), why: fn === 'sin' ? '$\\int \\sin u\\,du = -\\cos u$ — keep the negative.' : '$\\int \\cos u\\,du = +\\sin u$ — there is no negative.' },
    { text: t(sgnTrue * m, fn), why: 'Integrating sine gives cosine and integrating cosine gives sine — the function changes.' }
  ], [`$\\displaystyle\\int \\${fn}\\,u\\,du = ${fn === 'sin' ? '-\\cos u' : '\\sin u'} + C$.`, `Divide by the inside coefficient $${a}$.`, 'Differentiate each option to check.'],
  [{ h: 'Standard integral', d: `$\\displaystyle\\int \\${fn}\\,u\\,du = ${fn === 'sin' ? '-\\cos u' : '\\sin u'} + C$` }, { h: 'Divide by inside derivative', d: `$\\dfrac{${c}}{${a}} = ${m}$` }, { h: 'Answer', d: t(sgnTrue * m, F) }]);
  return [q, { kind: 'mcq' }];
}));

// Definite integral of k sin(ax) or k cos(ax) between multiples of pi, exact rational
trigForms.push(V('trig-definite-rational', [2, 3, 4], (rng) => {
  for (let tries = 0; tries < 200; tries++) {
    const fn = rc(rng, ['sin', 'cos']);
    const degs = fn === 'sin' ? COS_DEGS : SIN_DEGS;
    const lo = rc(rng, degs), hi = rc(rng, degs);
    if (lo >= hi) continue;
    const a = ri(rng, 1, 4), k = nz(rng, -9, 9);
    const tab = fn === 'sin' ? COS_R : SIN_R;
    const diffF = fn === 'sin' ? fr(tab[lo]).sub(fr(tab[hi])) : fr(tab[hi]).sub(fr(tab[lo]));
    const val = diffF.mul(new Frac(k, a));
    if (val.n === 0) continue;
    const L = piAng(lo, a), H = piAng(hi, a);
    const inner = a === 1 ? 'x' : `${a}x`;
    const trapSwap = val.mul(new Frac(-1));
    const q = fracQ(`Evaluate $\\displaystyle\\int_{${L.tex}}^{${H.tex}} ${cf(k)}\\${fn}(${inner})\\,dx$ exactly.`, val, {
      traps: [
        { value: trapSwap.value, why: `Substitute the **upper** limit first, then subtract the lower: $F(b) - F(a)$.` },
        { value: val.mul(new Frac(a)).value, why: a === 1 ? 'Check the arithmetic of $F(b) - F(a)$.' : `Divide by the inside coefficient $${a}$ when integrating, do not multiply.` }
      ].filter(t => t.value !== val.value),
      hints: [`$\\displaystyle\\int \\${fn}(${inner})\\,dx = ${fn === 'sin' ? `-\\dfrac{1}{${a}}\\cos` : `\\dfrac{1}{${a}}\\sin`}(${inner}) + C$.`, `Evaluate at $x = ${H.tex}$ and $x = ${L.tex}$ — in each case $${inner}$ is a multiple of $\\pi$ with a familiar value.`, 'Upper minus lower.'],
      steps: [
        { h: 'Antiderivative', d: `$F(x) = ${fn === 'sin' ? `-\\dfrac{${k}}{${a}}\\cos(${inner})` : `\\dfrac{${k}}{${a}}\\sin(${inner})`}$` },
        { h: 'Evaluate the limits', d: `$${inner}$ becomes $${piAng(lo).tex}$ and $${piAng(hi).tex}$` },
        { h: 'Subtract', d: `$F(${H.tex}) - F(${L.tex}) = ${val.latex()}$` }
      ]
    });
    const f = x => k * Math[fn](a * x);
    return [q, { kind: 'num', value: simpson(f, lo * DEG / a, hi * DEG / a) }];
  }
  throw new Error('trig-definite-rational: no case');
}));

// Reverse: f'(x) given and f(0); find f at a rational point
trigForms.push(V('trig-reverse-fvalue', [2, 3, 4], (rng) => {
  const fn = rc(rng, ['sin', 'cos']);
  const a = ri(rng, 2, 6), k = nz(rng, -9, 9), f0 = nz(rng, -9, 9);
  const degs = fn === 'cos' ? [30, 90, 150, 210, 270, 330] : [60, 90, 120, 180, 240, 270, 300];
  const th = rc(rng, degs);
  const tab = fn === 'cos' ? SIN_R : COS_R;
  const val = fn === 'cos'
    ? new Frac(k, a).mul(fr(tab[th])).add(new Frac(f0))
    : new Frac(k, a).mul(new Frac(1).sub(fr(tab[th]))).add(new Frac(f0));
  const X = piAng(th, a);
  const q = fracQ(`A function satisfies $f'(x) = ${cf(k)}\\${fn}(${a}x)$ and $f(0) = ${f0}$. Find $f\\left(${X.tex}\\right)$ exactly.`, val, {
    traps: [
      { value: (fn === 'cos' ? new Frac(k, a).mul(fr(tab[th])) : new Frac(k, a).mul(new Frac(0).sub(fr(tab[th])))).value, why: 'The constant of integration has been left out — use $f(0)$ to find it.' },
      { value: (fn === 'cos' ? new Frac(k).mul(fr(tab[th])).add(new Frac(f0)) : new Frac(k).mul(new Frac(1).sub(fr(tab[th]))).add(new Frac(f0))).value, why: `The antiderivative divides by the inside coefficient $${a}$.` }
    ].filter(t => Math.abs(t.value - val.value) > 1e-9),
    hints: [`Integrate: $f(x) = ${fn === 'cos' ? `\\dfrac{${k}}{${a}}\\sin(${a}x)` : `-\\dfrac{${k}}{${a}}\\cos(${a}x)`} + C$.`, `Use $f(0) = ${f0}$ to find $C$.`, `Then substitute $x = ${X.tex}$, where $${a}x = ${piAng(th).tex}$.`],
    steps: [
      { h: 'Integrate', d: `$f(x) = ${fn === 'cos' ? `\\dfrac{${k}}{${a}}\\sin(${a}x)` : `-\\dfrac{${k}}{${a}}\\cos(${a}x)`} + C$` },
      { h: 'Find C', d: fn === 'cos' ? `$f(0) = ${f0}$ gives $C = ${f0}$` : `$f(0) = -\\dfrac{${k}}{${a}} + C = ${f0}$, so $C = ${new Frac(k, a).add(new Frac(f0)).latex()}$` },
      { h: 'Substitute', d: `$f\\left(${X.tex}\\right) = ${val.latex()}$` }
    ]
  });
  const g = x => k * Math[fn](a * x);
  return [q, { kind: 'num', value: f0 + simpson(g, 0, th * DEG / a) }];
}));

// "Show that" identity: constant k in d/dx[P sin^2(bx) + Q cos^2(bx)] = k sin(2bx)
trigForms.push(V('trig-show-identity-k', [2, 3, 4], (rng) => {
  let P, Q;
  do { P = nz(rng, -9, 9); Q = nz(rng, -9, 9); } while (P === Q);
  const b = ri(rng, 1, 7);
  const k = (P - Q) * b;
  const bx = b === 1 ? 'x' : `${b}x`;
  const body = `${cf(P)}\\sin^2(${bx})${Q > 0 ? ' + ' : ' - '}${Math.abs(Q) === 1 ? '' : Math.abs(Q)}\\cos^2(${bx})`;
  const q = numQ(`Show that if $y = ${body}$, then $\\dfrac{dy}{dx} = k\\sin(${b === 1 ? '2x' : `${2 * b}x`})$ for a constant $k$. Find $k$.`, k, {
    prefix: 'k =',
    traps: [
      { value: (P + Q) * b, why: 'The derivative of $\\cos^2$ carries a negative sign, so the cosine term **subtracts**.' },
      { value: (P - Q) * 2 * b, why: 'The double-angle identity $2\\sin u\\cos u = \\sin 2u$ absorbs the factor of 2 — it is not extra.' }
    ],
    hints: [`Chain rule: $\\dfrac{d}{dx}\\sin^2 u = 2\\sin u\\cos u \\cdot u'$ and $\\dfrac{d}{dx}\\cos^2 u = -2\\sin u\\cos u \\cdot u'$ with $u = ${bx}$.`, `Both give a multiple of $2\\sin ${bx}\\cos ${bx} = \\sin ${2 * b}x$.`, `Collect: $k = (${P} - (${Q}))\\times ${b}$.`],
    steps: [
      { h: 'Differentiate each term', d: `$\\dfrac{dy}{dx} = ${P}\\cdot 2\\sin(${bx})\\cos(${bx})\\cdot ${b} + ${Q}\\cdot(-2)\\sin(${bx})\\cos(${bx})\\cdot ${b}$` },
      { h: 'Use $2\\sin u\\cos u = \\sin 2u$', d: `$\\dfrac{dy}{dx} = ${P * b}\\sin(${2 * b}x) - (${Q * b})\\sin(${2 * b}x)$` },
      { h: 'Collect', d: `$k = ${k}$` }
    ]
  });
  const f = x => P * Math.sin(b * x) ** 2 + Q * Math.cos(b * x) ** 2;
  const x0 = 0.37;
  return [q, { kind: 'num', value: numD(f, x0) / Math.sin(2 * b * x0) }];
}));

// u-substitution, evaluated: ∫ p cos(ax) sin^n(ax) dx or ∫ p sin(ax) cos^n(ax) dx with exact rational result
trigForms.push(V('trig-usub-definite', [2, 3, 4], (rng) => {
  const cosFirst = rng() < 0.5;
  const a = ri(rng, 1, 4), n = ri(rng, 2, 5), p = ri(rng, 1, 18);
  const inner = a === 1 ? 'x' : `${a}x`;
  // upper limit: u reaches 1 (angle 90°) or 1/2
  let upperDeg, uHi, uLo;
  if (cosFirst) { upperDeg = rc(rng, [30, 90]); uHi = new Frac(upperDeg === 30 ? 1 : 1, upperDeg === 30 ? 2 : 1); uLo = new Frac(0); }
  else { upperDeg = rc(rng, [60, 90]); uHi = new Frac(upperDeg === 60 ? 1 : 0, upperDeg === 60 ? 2 : 1); uLo = new Frac(1); }
  const pow = (f, e) => { let r = new Frac(1); for (let i = 0; i < e; i++) r = r.mul(f); return r; };
  const hiN = pow(uHi, n + 1), loN = pow(uLo, n + 1);
  const val = (cosFirst ? hiN.sub(loN) : loN.sub(hiN)).mul(new Frac(p, a * (n + 1)));
  if (val.n === 0) throw new Error('zero');
  const sub = cosFirst ? `u = \\sin(${inner})` : `u = \\cos(${inner})`;
  const integrand = cosFirst ? `${cf(p)}\\cos(${inner})\\sin^{${n}}(${inner})` : `${cf(p)}\\sin(${inner})\\cos^{${n}}(${inner})`;
  const U = piAng(upperDeg, a);
  const q = fracQ(`Use the substitution $${sub}$ to evaluate $\\displaystyle\\int_{0}^{${U.tex}} ${integrand}\\,dx$ exactly.`, val, {
    traps: [
      { value: val.mul(new Frac(a)).value, why: `$du = ${cosFirst ? '' : '-'}${a === 1 ? '' : a}\\${cosFirst ? 'cos' : 'sin'}(${inner})\\,dx$, so the integral picks up a factor of $\\dfrac{1}{${a}}$ — not $${a}$.` },
      { value: val.mul(new Frac(-1)).value, why: cosFirst ? 'Check the signs of the limits you substitute.' : `With $u = \\cos(${inner})$ we have $du = -${a === 1 ? '' : a}\\sin(${inner})\\,dx$ — the negative reverses the limits.` },
      { value: (cosFirst ? hiN.sub(loN) : loN.sub(hiN)).mul(new Frac(p, a)).value, why: `Integrating $u^{${n}}$ gives $\\dfrac{u^{${n + 1}}}{${n + 1}}$ — divide by the new power.` }
    ].filter(t => Math.abs(t.value - val.value) > 1e-9),
    hints: [cosFirst ? `$du = ${a === 1 ? '' : a}\\cos(${inner})\\,dx$.` : `$du = -${a === 1 ? '' : a}\\sin(${inner})\\,dx$.`, 'Change the limits to $u$-values before integrating.', `Integrate $u^{${n}}$ to get $\\dfrac{u^{${n + 1}}}{${n + 1}}$.`],
    steps: [
      { h: 'Substitute', d: `$${sub}$, $du = ${cosFirst ? '' : '-'}${a === 1 ? '' : a}\\${cosFirst ? 'cos' : 'sin'}(${inner})\\,dx$` },
      { h: 'New limits', d: `$u$ runs from $${uLo.latex()}$ to $${uHi.latex()}$` },
      { h: 'Integrate', d: `$${cosFirst ? '' : '-'}\\dfrac{${p}}{${a}}\\left[\\dfrac{u^{${n + 1}}}{${n + 1}}\\right]_{${uLo.latex()}}^{${uHi.latex()}} = ${val.latex()}$` }
    ]
  });
  const f = x => p * (cosFirst ? Math.cos(a * x) * Math.sin(a * x) ** n : Math.sin(a * x) * Math.cos(a * x) ** n);
  return [q, { kind: 'num', value: simpson(f, 0, upperDeg * DEG / a) }];
}));

// u-substitution set-up: find the constant c in ∫ p sin(ax) cos^n(ax) dx = c ∫ u^n du
trigForms.push(V('trig-usub-constant', [3, 4], (rng) => {
  const useSin = rng() < 0.5;
  const a = ri(rng, 2, 7), n = ri(rng, 2, 6), p = nz(rng, -12, 12);
  const inner = `${a}x`;
  const c = useSin ? new Frac(-p, a) : new Frac(p, a);   // u = cos(ax) -> du = -a sin(ax) dx
  const integrand = useSin ? `${cf(p)}\\sin(${inner})\\cos^{${n}}(${inner})` : `${cf(p)}\\cos(${inner})\\sin^{${n}}(${inner})`;
  const q = fracQ(`The substitution $u = \\${useSin ? 'cos' : 'sin'}(${inner})$ turns $\\displaystyle\\int ${integrand}\\,dx$ into $c\\displaystyle\\int u^{${n}}\\,du$. Find $c$.`, c, {
    prefix: 'c =',
    traps: [
      { value: (useSin ? new Frac(p, a) : new Frac(-p, a)).value, why: useSin ? `$\\dfrac{d}{dx}\\cos(${inner}) = -${a}\\sin(${inner})$ — the negative sign matters.` : `$\\dfrac{d}{dx}\\sin(${inner}) = ${a}\\cos(${inner})$ — no negative sign.` },
      { value: p * a, why: `$du = ${useSin ? '-' : ''}${a}\\${useSin ? 'sin' : 'cos'}(${inner})\\,dx$, so $dx$ contributes $\\dfrac{1}{${a}}$ — divide, do not multiply.` }
    ].filter(t => Math.abs(t.value - c.value) > 1e-9),
    hints: [`Differentiate: $du = ${useSin ? '-' : ''}${a}\\${useSin ? 'sin' : 'cos'}(${inner})\\,dx$.`, `So $\\${useSin ? 'sin' : 'cos'}(${inner})\\,dx = ${useSin ? '-' : ''}\\dfrac{1}{${a}}\\,du$.`, `Multiply by the $${p}$ in front.`],
    steps: [
      { h: 'Differentiate u', d: `$du = ${useSin ? '-' : ''}${a}\\${useSin ? 'sin' : 'cos'}(${inner})\\,dx$` },
      { h: 'Rewrite dx', d: `$\\${useSin ? 'sin' : 'cos'}(${inner})\\,dx = ${useSin ? '-' : ''}\\dfrac{du}{${a}}$` },
      { h: 'Collect the constant', d: `$c = ${c.latex()}$` }
    ]
  });
  const g = x => p * (useSin ? Math.sin(a * x) * Math.cos(a * x) ** n : Math.cos(a * x) * Math.sin(a * x) ** n);
  // d/dx[c u^(n+1)/(n+1)] must equal g
  const F = x => c.value * (useSin ? Math.cos(a * x) : Math.sin(a * x)) ** (n + 1) / (n + 1);
  return [q, { kind: 'num', value: c.value, aux: [[g, F]] }];
}));

// Second derivative at a point, or the first point of inflection
trigForms.push(V('trig-second-derivative', [3, 4], (rng) => {
  if (rng() < 0.5) {
    const fn = rc(rng, ['sin', 'cos']);
    const A = nz(rng, -9, 9), b = ri(rng, 2, 6);
    const degs = fn === 'sin' ? [30, 90, 150, 210, 270, 330] : [60, 120, 180, 240, 300];
    const th = rc(rng, degs);
    const base = fn === 'sin' ? fr(SIN_R[th]) : fr(COS_R[th]);
    const val = base.mul(new Frac(-A * b * b));
    if (val.n === 0) throw new Error('zero');
    const X = piAng(th, b);
    const q = fracQ(`Find the value of $\\dfrac{d^2y}{dx^2}$ at $x = ${X.tex}$ for $y = ${cf(A)}\\${fn}(${b}x)$.`, val, {
      traps: [
        { value: base.mul(new Frac(-A * b)).value, why: `Each differentiation brings down a factor of $${b}$ — twice, so $${b}^2 = ${b * b}$.` },
        { value: base.mul(new Frac(A * b * b)).value, why: 'Differentiating twice turns $\\sin$ into $-\\sin$ (and $\\cos$ into $-\\cos$): the sign is negative.' }
      ].filter(t => Math.abs(t.value - val.value) > 1e-9),
      hints: [fn === 'sin' ? `$y' = ${A * b}\\cos(${b}x)$.` : `$y' = ${-A * b}\\sin(${b}x)$.`, `Differentiate again: $y'' = ${-A * b * b}\\${fn}(${b}x)$.`, `At $x = ${X.tex}$, $${b}x = ${piAng(th).tex}$.`],
      steps: [
        { h: 'First derivative', d: fn === 'sin' ? `$y' = ${A * b}\\cos(${b}x)$` : `$y' = ${-A * b}\\sin(${b}x)$` },
        { h: 'Second derivative', d: `$y'' = ${-A * b * b}\\${fn}(${b}x)$` },
        { h: 'Evaluate', d: `$y''\\left(${X.tex}\\right) = ${val.latex()}$` }
      ]
    });
    const f = x => A * Math[fn](b * x);
    const x0 = th * DEG / b;
    const h = 1e-3;
    return [q, { kind: 'num', value: (f(x0 + h) - 2 * f(x0) + f(x0 - h)) / (h * h) }];
  }
  const fn = rc(rng, ['sin', 'cos']);
  const A = nz(rng, -9, 9), b = ri(rng, 1, 6), C = nz(rng, -9, 9);
  const first = piAng(fn === 'sin' ? 180 : 90, b);
  const q = numQ(`Find the **smallest positive** value of $x$ at which the curve $y = ${cf(A)}\\${fn}(${b === 1 ? '' : b}x) ${C < 0 ? '-' : '+'} ${Math.abs(C) === 1 ? '' : Math.abs(C)}x$ has a point of inflection. Give an exact answer.`, first.val, {
    exact: first.typed, inputHint: b === 1 && fn === 'sin' ? 'e.g. pi' : 'e.g. pi/4',
    traps: [{ value: piAng(fn === 'sin' ? 90 : 180, b).val, why: `A point of inflection needs $y'' = 0$ with a sign change — the second derivative is $${-A * b * b}\\${fn}(${b === 1 ? '' : b}x)$, which vanishes where $${fn === 'sin' ? '\\sin' : '\\cos'}$ is zero, not where it is $\\pm 1$.`, tol: 0.0005 }],
    hints: [`Differentiate twice: the linear term $${C}x$ disappears.`, `$y'' = ${-A * b * b}\\${fn}(${b === 1 ? '' : b}x)$.`, `Solve $\\${fn}(${b === 1 ? '' : b}x) = 0$ and take the smallest positive solution.`],
    steps: [
      { h: 'Second derivative', d: `$y'' = ${-A * b * b}\\${fn}(${b === 1 ? '' : b}x)$ — the term $${C}x$ contributes nothing` },
      { h: 'Set the second derivative to zero', d: `$\\${fn}(${b === 1 ? '' : b}x) = 0$` },
      { h: 'Smallest positive solution', d: `$x = ${first.tex}$ (and the sign of $y''$ changes there)` }
    ]
  });
  const f = x => A * Math[fn](b * x) + C * x;
  const h = 1e-3, d2 = x => (f(x + h) - 2 * f(x) + f(x - h)) / (h * h);
  return [q, { kind: 'num', value: first.val, aux2: [d2, first.val] }];
}));

// Gradient of k tan(ax) at a rational point (exact)
trigForms.push(V('trig-tan-gradient', [3, 4], (rng) => {
  const k = nz(rng, -6, 6), a = ri(rng, 1, 5);
  const th = rc(rng, [0, 30, 45, 60, 120, 135, 150, 180]);
  const sec2 = { 0: new Frac(1), 30: new Frac(4, 3), 45: new Frac(2), 60: new Frac(4), 120: new Frac(4), 135: new Frac(2), 150: new Frac(4, 3), 180: new Frac(1) }[th];
  const val = sec2.mul(new Frac(k * a));
  const X = piAng(th, a);
  const inner = a === 1 ? 'x' : `${a}x`;
  const q = fracQ(`Find the exact gradient of the curve $y = ${cf(k)}\\tan(${inner})$ at the point where $x = ${X.tex}$.`, val, {
    traps: [
      { value: Math.round(k * a * 1e9) / 1e9 * (1 / Math.cos(th * DEG)), why: '$\\dfrac{d}{du}\\tan u = \\sec^2 u$ — the secant is **squared**.' },
      { value: sec2.mul(new Frac(k)).value, why: a === 1 ? 'Check the value of $\\sec^2$ of the angle.' : `The inside $${inner}$ differentiates to $${a}$ — multiply by it (chain rule).` }
    ].filter(t => Number.isFinite(t.value) && Math.abs(t.value - val.value) > 1e-9),
    hints: [`$\\dfrac{dy}{dx} = ${k * a}\\sec^2(${inner})$.`, `At $x = ${X.tex}$ the angle is $${inner} = ${piAng(th).tex}$ and $\\sec\\theta = \\dfrac{1}{\\cos\\theta}$.`, `$\\sec^2\\theta = ${sec2.latex()}$.`],
    steps: [
      { h: 'Differentiate', d: `$y' = ${k * a}\\sec^2(${inner})$` },
      { h: 'Evaluate $\\sec^2$', d: `$\\cos ${piAng(th).tex === '0' ? '0' : piAng(th).tex}$ gives $\\sec^2 = ${sec2.latex()}$` },
      { h: 'Gradient', d: `$${k * a} \\times ${sec2.latex()} = ${val.latex()}$` }
    ]
  });
  const f = x => k * Math.tan(a * x);
  return [q, { kind: 'num', value: numD(f, th * DEG / a) }];
}));

// Area between a sine or cosine curve and the x-axis (net integral is a trap)
trigForms.push(V('trig-area-total', [3, 4], (rng) => {
  const fn = rc(rng, ['sin', 'cos']);
  const k = nz(rng, -9, 9), a = ri(rng, 1, 4);
  // sin over [0, 2π/a]: two equal arches; cos over [0, π/a]: one positive and one negative lobe
  const upper = fn === 'sin' ? piAng(360, a) : piAng(180, a);
  const area = new Frac(Math.abs(k) * 4, a * (fn === 'sin' ? 1 : 2));
  const inner = a === 1 ? 'x' : `${a}x`;
  const q = fracQ(`Find the total area enclosed between the curve $y = ${cf(k)}\\${fn}(${inner})$ and the $x$-axis from $x = 0$ to $x = ${upper.tex}$.`, area, {
    traps: [
      { value: 0, why: 'Areas above and below the axis cancel in the **integral**, but an area is always positive — split at the zeros and add the sizes.' },
      { value: area.value / 2, why: 'There are two lobes, one above and one below the axis — both count.' }
    ].filter(t => Math.abs(t.value - area.value) > 1e-9),
    hints: ['Find where the curve crosses the axis in the interval.', 'Integrate over each lobe separately and take absolute values.', fn === 'sin' ? `Each arch has area $\\dfrac{2 \\times ${Math.abs(k)}}{${a}}$.` : `Each lobe has area $\\dfrac{${Math.abs(k)}}{${a}}$.`],
    steps: [
      { h: 'Locate the zeros', d: fn === 'sin' ? `$\\sin(${inner}) = 0$ at $x = 0, ${piAng(180, a).tex}, ${upper.tex}$` : `$\\cos(${inner}) = 0$ at $x = ${piAng(90, a).tex}$` },
      { h: 'One lobe', d: fn === 'sin' ? `$\\left|\\displaystyle\\int_0^{${piAng(180, a).tex}} ${cf(k)}\\sin(${inner})\\,dx\\right| = \\dfrac{${2 * Math.abs(k)}}{${a}}$` : `$\\left|\\displaystyle\\int_0^{${piAng(90, a).tex}} ${cf(k)}\\cos(${inner})\\,dx\\right| = \\dfrac{${Math.abs(k)}}{${a}}$` },
      { h: 'Add the lobes', d: `Total area $= ${area.latex()}$ square units` }
    ]
  });
  const g = x => Math.abs(k * Math[fn](a * x));
  return [q, { kind: 'num', value: simpson(g, 0, upper.val, 40000) }];
}));

// ═════════════════════════════════════════════════════════════════════════════
// y12-explogcalc
// ═════════════════════════════════════════════════════════════════════════════
const expForms = [];

// Differentiate k e^(ax+b) or k ln(ax+b) (expression)
expForms.push(V('exp-diff-linear-arg', [1, 2], (rng) => {
  const isExp = rng() < 0.5;
  const k = nz(rng, -9, 9), a = ri(rng, 2, 9), b = rc(rng, [0, -8, -6, -5, -4, -3, -2, -1, 1, 2, 3, 4, 5, 7, 9]);
  const arg = lin(a, b), argS = linS(a, b);
  if (isExp) {
    const q = exprQ(`Differentiate $y = ${cf(k)}e^{${arg}}$ with respect to $x$.`, `${k * a}*e^(${argS})`, {
      prefix: 'dy/dx =', inputHint: `e.g. ${k * a}e^(${argS})`,
      traps: [
        { expr: `${k}*e^(${argS})`, why: `Chain rule: the inside $${arg}$ differentiates to $${a}$, which multiplies the result.` },
        { expr: `${k * a}*(${argS})*e^(${a}*x${b >= 0 ? '+' : '-'}${Math.abs(b) - 1 < 0 ? 0 : Math.abs(b)})`, why: 'Exponentials are not differentiated with the power rule: $\\dfrac{d}{dx}e^u = u\' e^u$.' }
      ],
      hints: [`$\\dfrac{d}{dx}e^{u} = u' e^{u}$.`, `Here $u = ${arg}$ and $u' = ${a}$.`, `Multiply: $${k} \\times ${a} = ${k * a}$.`],
      steps: [{ h: 'Standard derivative', d: `$\\dfrac{d}{dx}e^u = u'e^u$` }, { h: 'Inside derivative', d: `$u = ${arg}$, so $u' = ${a}$` }, { h: 'Combine', d: `$\\dfrac{dy}{dx} = ${cf(k * a)}e^{${arg}}$` }]
    });
    return [q, { kind: 'deriv', f: x => k * Math.exp(a * x + b), expr: `${k * a}*e^(${argS})` }];
  }
  const expr = `${k * a}/(${argS})`;
  const q = exprQ(`Differentiate $y = ${cf(k)}\\ln(${arg})$ with respect to $x$, for $${arg} > 0$.`, expr, {
    prefix: 'dy/dx =', inputHint: `e.g. ${k * a}/(${argS})`, positiveOnly: false,
    traps: [
      { expr: `${k}/(${argS})`, why: `Chain rule: the inside $${arg}$ differentiates to $${a}$, which multiplies the numerator.` },
      { expr: `${k * a}*ln(${argS})`, why: '$\\dfrac{d}{dx}\\ln u = \\dfrac{u\'}{u}$ — the result is a fraction, not another logarithm.' }
    ],
    hints: [`$\\dfrac{d}{dx}\\ln u = \\dfrac{u'}{u}$.`, `Here $u = ${arg}$ and $u' = ${a}$.`, `Multiply the constant $${k}$ by $${a}$.`],
    steps: [{ h: 'Standard derivative', d: `$\\dfrac{d}{dx}\\ln u = \\dfrac{u'}{u}$` }, { h: 'Inside derivative', d: `$u = ${arg}$, so $u' = ${a}$` }, { h: 'Combine', d: `$\\dfrac{dy}{dx} = \\dfrac{${k * a}}{${arg}}$` }]
  });
  return [q, { kind: 'deriv', f: x => k * Math.log(a * x + b), expr, lo: Math.max(0.5, (-b + 0.5) / a) }];
}));

// Product rule with an exponential: d/dx[x^n e^(ax)]
expForms.push(V('exp-product-rule', [2, 3, 4], (rng) => {
  const n = ri(rng, 2, 5), a = nz(rng, -6, 6);
  const brS = `${n}${a < 0 ? '-' : '+'}${Math.abs(a)}*x`;
  const xn = n - 1 === 1 ? 'x' : `x^{${n - 1}}`;
  const expr = `x^${n - 1}*e^(${a}*x)*(${brS})`;
  const q = exprQ(`Use the product rule to differentiate $y = x^{${n}}e^{${ex(a)}}$. Give your answer as a product of factors.`, expr, {
    prefix: 'dy/dx =', inputHint: `e.g. x^${n - 1}e^(${a}x)(${n}${a < 0 ? ' - ' : ' + '}${Math.abs(a)}x)`,
    traps: [
      { expr: `${n}*x^${n - 1}*${a}*e^(${a}*x)`, why: 'The product rule is $u\'v + uv\'$ — a sum of two terms, not the product of the derivatives.' },
      { expr: `x^${n - 1}*e^(${a}*x)*(${n}${a === 1 ? '-' : '+'}x)`, why: `$\\dfrac{d}{dx}e^{${ex(a)}} = ${cf(a)}e^{${ex(a)}}$, so the second term carries the factor $${a}$.` }
    ],
    hints: [`Product rule: $y' = u'v + uv'$ with $u = x^{${n}}$ and $v = e^{${ex(a)}}$.`, `$u' = ${n}${xn}$ and $v' = ${cf(a)}e^{${ex(a)}}$.`, `Take the common factor $${xn}e^{${ex(a)}}$ out.`],
    steps: [{ h: 'Derivatives of each factor', d: `$u' = ${n}${xn}$, $v' = ${cf(a)}e^{${ex(a)}}$` }, { h: 'Product rule', d: `$y' = ${n}${xn}e^{${ex(a)}} ${a < 0 ? '-' : '+'} ${Math.abs(a) === 1 ? '' : Math.abs(a)}x^{${n}}e^{${ex(a)}}$` }, { h: 'Factorise', d: `$y' = ${xn}e^{${ex(a)}}(${n} ${a < 0 ? '-' : '+'} ${Math.abs(a) === 1 ? '' : Math.abs(a)}x)$` }]
  });
  return [q, { kind: 'deriv', f: x => x ** n * Math.exp(a * x), expr }];
}));

// Antiderivatives: k e^(ax+b); k/(ax+b); f'/f forms (expression)
expForms.push(V('exp-int-forms', [1, 2, 3], (rng) => {
  const shape = ri(rng, 1, 4);
  if (shape === 1) {
    const k = nz(rng, -9, 9), a = ri(rng, 2, 8), b = rc(rng, [0, -5, -3, -2, -1, 1, 2, 3, 4, 6]);
    const arg = lin(a, b), argS = linS(a, b);
    const expr = `${k}/${a}*e^(${argS})`;
    const q = exprQ(`Find $\\displaystyle\\int ${cf(k)}e^{${arg}}\\,dx$. (You may omit the $+C$.)`, expr, {
      stripC: true, prefix: '∫ =', inputHint: `e.g. ${k}/${a}e^(${argS}) + C`,
      traps: [{ expr: `${k * a}*e^(${argS})`, why: `Integrating **divides** by the inside coefficient $${a}$; it does not multiply.` }, { expr: `${k}*e^(${argS})`, why: `The factor $\\dfrac{1}{${a}}$ from reversing the chain rule is missing.` }],
      hints: ['$\\displaystyle\\int e^{u}\\,dx$ with $u = ax + b$ gives $\\dfrac{1}{a}e^{u}$.', `The inside coefficient is $${a}$.`, 'Check by differentiating.'],
      steps: [{ h: 'Reverse the chain rule', d: `$\\displaystyle\\int e^{${arg}}\\,dx = \\dfrac{1}{${a}}e^{${arg}} + C$` }, { h: 'Keep the constant', d: `$${k} \\times \\dfrac{1}{${a}}$` }, { h: 'Answer', d: `$\\dfrac{${k}}{${a}}e^{${arg}} + C$` }]
    });
    return [q, { kind: 'anti', f: x => k * Math.exp(a * x + b), expr }];
  }
  if (shape === 2) {
    const k = nz(rng, -9, 9), a = ri(rng, 2, 8), b = ri(rng, 1, 9);
    const arg = lin(a, b), argS = linS(a, b);
    const expr = `${k}/${a}*ln(${argS})`;
    const q = exprQ(`Find $\\displaystyle\\int \\dfrac{${k}}{${arg}}\\,dx$ for $x > 0$. (You may omit the $+C$.)`, expr, {
      stripC: true, positiveOnly: true, prefix: '∫ =', inputHint: `e.g. ${k}/${a}ln(${argS}) + C`,
      traps: [{ expr: `${k * a}*ln(${argS})`, why: `Integrating **divides** by the derivative $${a}$ of the denominator.` }, { expr: `${k}*ln(x)`, why: 'The whole denominator belongs inside the logarithm.' }],
      hints: ['$\\displaystyle\\int \\dfrac{u\'}{u}\\,dx = \\ln u + C$.', `The derivative of the denominator is $${a}$.`, 'Write the numerator as a multiple of that.'],
      steps: [{ h: 'Spot the form', d: `$\\dfrac{${k}}{${arg}} = \\dfrac{${k}}{${a}}\\times\\dfrac{${a}}{${arg}}$` }, { h: 'Integrate', d: `$\\displaystyle\\int\\dfrac{${a}}{${arg}}\\,dx = \\ln(${arg}) + C$` }, { h: 'Answer', d: `$\\dfrac{${k}}{${a}}\\ln(${arg}) + C$` }]
    });
    return [q, { kind: 'anti', f: x => k / (a * x + b), expr, lo: 0.3 }];
  }
  if (shape === 3) {
    // f'(x)/f(x) with f = x^2 + c  (always positive)
    const k = nz(rng, -9, 9), c = ri(rng, 1, 12);
    const expr = `${k}/2*ln(x^2+${c})`;
    const q = exprQ(`Find $\\displaystyle\\int \\dfrac{${cf(k)}x}{x^{2} + ${c}}\\,dx$. (You may omit the $+C$.)`, expr, {
      stripC: true, prefix: '∫ =', inputHint: `e.g. ${k}/2 ln(x^2 + ${c}) + C`,
      traps: [{ expr: `${k}*ln(x^2+${c})`, why: 'The derivative of $x^2 + ' + c + '$ is $2x$, so the numerator $' + cf(k) + 'x$ is only **half** of $' + 2 * k + 'x$.' }, { expr: `${k}*x/(x^2+${c})`, why: 'This is not an antiderivative — differentiating it gives something with $(x^2 + ' + c + ')^2$ on the bottom.' }],
      hints: ['Is the numerator a multiple of the derivative of the denominator?', `$\\dfrac{d}{dx}(x^2 + ${c}) = 2x$.`, `$${cf(k)}x = \\dfrac{${k}}{2} \\times 2x$.`],
      steps: [{ h: 'Match $f\'/f$', d: `$f(x) = x^2 + ${c}$, $f'(x) = 2x$` }, { h: 'Adjust the constant', d: `$\\dfrac{${cf(k)}x}{x^2+${c}} = \\dfrac{${k}}{2}\\times\\dfrac{2x}{x^2+${c}}$` }, { h: 'Integrate', d: `$\\dfrac{${k}}{2}\\ln(x^2 + ${c}) + C$` }]
    });
    return [q, { kind: 'anti', f: x => k * x / (x * x + c), expr }];
  }
  const k = nz(rng, -9, 9), c = ri(rng, 1, 9);
  const expr = `${k}*ln(e^x+${c})`;
  const q = exprQ(`Find $\\displaystyle\\int \\dfrac{${cf(k)}e^{x}}{e^{x} + ${c}}\\,dx$. (You may omit the $+C$.)`, expr, {
    stripC: true, prefix: '∫ =', inputHint: `e.g. ${k}ln(e^x + ${c}) + C`,
    traps: [{ expr: `${k}*e^x/(e^x+${c})`, why: 'The numerator is exactly the derivative of the denominator — the result is a logarithm, not a fraction.' }, { expr: `${k}*ln(e^x)`, why: 'The whole denominator $e^x + ' + c + '$ goes inside the logarithm.' }],
    hints: [`$\\dfrac{d}{dx}(e^x + ${c}) = e^x$ — the numerator.`, '$\\displaystyle\\int\\dfrac{f\'(x)}{f(x)}\\,dx = \\ln f(x) + C$.', 'Keep the constant multiplier.'],
    steps: [{ h: 'Match $f\'/f$', d: `$f(x) = e^x + ${c}$ and $f'(x) = e^x$` }, { h: 'Integrate', d: `$\\displaystyle\\int \\dfrac{f'(x)}{f(x)}\\,dx = \\ln(e^x + ${c})$` }, { h: 'Answer', d: `$${k}\\ln(e^x + ${c}) + C$` }]
  });
  return [q, { kind: 'anti', f: x => k * Math.exp(x) / (Math.exp(x) + c), expr }];
}));

// Definite integral with a rational result: upper limit ln(m)/a
expForms.push(V('exp-definite-rational', [2, 3, 4], (rng) => {
  const m = rc(rng, [2, 3, 4, 5, 6, 8, 9, 10]), a = ri(rng, 1, 6), k = nz(rng, -9, 9);
  const decay = rng() < 0.5;
  const up = a === 1 ? `\\ln ${m}` : `\\dfrac{\\ln ${m}}{${a}}`;
  const val = decay ? new Frac(k, a).mul(new Frac(1).sub(new Frac(1, m))) : new Frac(k, a).mul(new Frac(m - 1));
  const q = fracQ(`Evaluate $\\displaystyle\\int_{0}^{${up}} ${cf(k)}e^{${decay ? '-' : ''}${a === 1 ? '' : a}x}\\,dx$ exactly.`, val, {
    traps: [
      { value: (decay ? new Frac(k, a).mul(new Frac(1, m).sub(new Frac(1))) : new Frac(k, a).mul(new Frac(1 - m))).value, why: decay ? `$\\displaystyle\\int e^{-${a === 1 ? '' : a}x}\\,dx = -\\dfrac{1}{${a}}e^{-${a === 1 ? '' : a}x}$ — keep the negative and then subtract $F(0)$.` : 'Upper minus lower: $F(b) - F(a)$.' },
      { value: (decay ? new Frac(k).mul(new Frac(1).sub(new Frac(1, m))) : new Frac(k).mul(new Frac(m - 1))).value, why: a === 1 ? 'Check $e^{\\ln m} = m$.' : `Divide by the inside coefficient $${a}$.` }
    ].filter(t => Math.abs(t.value - val.value) > 1e-9),
    hints: [`Antiderivative: $${decay ? '-' : ''}\\dfrac{${k}}{${a}}e^{${decay ? '-' : ''}${a === 1 ? '' : a}x}$.`, `At the upper limit, $e^{${decay ? '-' : ''}${a === 1 ? '' : a}x} = e^{${decay ? '-' : ''}\\ln ${m}} = ${decay ? `\\dfrac{1}{${m}}` : m}$.`, 'At the lower limit it equals $1$.'],
    steps: [
      { h: 'Antiderivative', d: `$F(x) = ${decay ? '-' : ''}\\dfrac{${k}}{${a}}e^{${decay ? '-' : ''}${a === 1 ? '' : a}x}$` },
      { h: 'Upper and lower values of the exponential', d: `$${decay ? `\\dfrac{1}{${m}}` : m}$ and $1$` },
      { h: 'Subtract', d: `$F(\\text{upper}) - F(0) = ${val.latex()}$` }
    ]
  });
  const f = x => k * Math.exp((decay ? -a : a) * x);
  return [q, { kind: 'num', value: simpson(f, 0, Math.log(m) / a) }];
}));

// Definite integral of k/(ax+b) giving c ln r with whole c and r
expForms.push(V('exp-definite-ln', [2, 3, 4], (rng) => {
  for (let t = 0; t < 400; t++) {
    const a = ri(rng, 1, 5), c = nz(rng, -8, 8), r = ri(rng, 2, 9), b = ri(rng, 0, 6), lo = ri(rng, 1, 6);
    // choose upper so that (a*hi + b) = r * (a*lo + b)
    const top = r * (a * lo + b) - b;
    if (top % a !== 0) continue;
    const hi = top / a;
    if (hi <= lo || hi > 120) continue;
    const k = c * a;
    const den = lin(a, b);
    const q = numQ(`Find the exact value of $\\displaystyle\\int_{${lo}}^{${hi}} \\dfrac{${k}}{${den}}\\,dx$, written in the form $c\\ln r$ where $c$ and $r$ are integers.`, c * Math.log(r), {
      exact: `${c}ln(${r})`, inputHint: `e.g. ${c}ln(${r})`, tol: 0.0005,
      traps: [{ value: k * Math.log(r), why: `Integrating $\\dfrac{${k}}{${den}}$ divides by the derivative $${a}$ of the denominator: $\\dfrac{${k}}{${a}} = ${c}$.`, tol: 0.0005 }, { value: c * Math.log(hi - lo), why: 'Evaluate the logarithm at each limit: $\\ln(\\text{upper}) - \\ln(\\text{lower})$ combine to $\\ln$ of a **ratio**.', tol: 0.0005 }],
      hints: [`$\\displaystyle\\int \\dfrac{${k}}{${den}}\\,dx = ${c}\\ln(${den}) + C$.`, `Evaluate the denominator at each limit: $${a}(${hi}) + ${b} = ${a * hi + b}$ and $${a}(${lo}) + ${b} = ${a * lo + b}$.`, 'Use $\\ln p - \\ln q = \\ln\\dfrac{p}{q}$.'],
      steps: [
        { h: 'Antiderivative', d: `$${c}\\ln(${den})$` },
        { h: 'Substitute the limits', d: `$${c}\\ln ${a * hi + b} - ${c}\\ln ${a * lo + b}$` },
        { h: 'Combine', d: `$${c}\\ln\\dfrac{${a * hi + b}}{${a * lo + b}} = ${c}\\ln ${r}$` }
      ]
    });
    return [q, { kind: 'num', value: simpson(x => k / (a * x + b), lo, hi) }];
  }
  throw new Error('exp-definite-ln: no case');
}));

// Exponential models: half-life, Newton cooling, rate of change
expForms.push(V('exp-model-context', [2, 3, 4], (rng) => {
  const kind = ri(rng, 1, 4);
  if (kind === 1) {
    // half-life -> decay constant k
    const T = ri(rng, 2, 40);
    const M0 = rc(rng, [20, 40, 50, 80, 100, 120, 250, 500]);
    const k = Math.log(2) / T;
    const val = Math.round(k * 1000) / 1000;
    const q = numQ(`The mass of a radioactive sample is modelled by $M(t) = ${M0}e^{-kt}$ grams, where $t$ is in days. The half-life is $${T}$ days. Find $k$, correct to 3 decimal places.`, val, {
      tol: 0.0006, prefix: 'k =',
      traps: [{ value: Math.round(Math.log(2) * T * 1000) / 1000, why: 'Half the mass means $e^{-kT} = \\tfrac{1}{2}$, so $k = \\dfrac{\\ln 2}{T}$ — divide by the half-life.', tol: 0.0006 }, { value: Math.round(1000 / (2 * T)) / 1000, why: 'The decay is exponential, not linear: solve $e^{-kT} = \\tfrac12$ with logarithms.', tol: 0.0006 }].filter(t => Math.abs(t.value - val) > 0.002),
      hints: [`After $${T}$ days the mass is $${M0 / 2}$ g.`, `$${M0}e^{-${T}k} = ${M0 / 2}$, so $e^{-${T}k} = \\tfrac12$.`, `$k = \\dfrac{\\ln 2}{${T}}$.`],
      steps: [{ h: 'Half-life condition', d: `$e^{-${T}k} = \\dfrac{1}{2}$` }, { h: 'Take logarithms', d: `$-${T}k = -\\ln 2$` }, { h: 'Solve', d: `$k = \\dfrac{\\ln 2}{${T}} \\approx ${val}$` }]
    });
    return [q, { kind: 'num', value: -Math.log(0.5) / T }];
  }
  if (kind === 2) {
    // Newton cooling: temperature after t minutes
    const Ta = ri(rng, 18, 26), T0 = rc(rng, [70, 75, 80, 85, 90, 95]), kk = rc(rng, [0.03, 0.04, 0.05, 0.06, 0.08, 0.1]), t = ri(rng, 5, 30);
    const temp = Ta + (T0 - Ta) * Math.exp(-kk * t);
    const val = Math.round(temp * 10) / 10;
    const q = numQ(`A cup of tea at $${T0}^\\circ\\text{C}$ is left in a room kept at $${Ta}^\\circ\\text{C}$. Its temperature after $t$ minutes is $T(t) = ${Ta} + ${T0 - Ta}e^{-${kk}t}$. Find the temperature after $${t}$ minutes, correct to 1 decimal place.`, val, {
      tol: 0.06, suffix: '°C',
      traps: [{ value: Math.round((T0 * Math.exp(-kk * t)) * 10) / 10, why: `The room temperature $${Ta}^\\circ\\text{C}$ is a floor the tea cools towards — it is **added** to the decaying part.`, tol: 0.06 }, { value: Math.round((Ta + (T0 - Ta) * (1 - kk * t)) * 10) / 10, why: 'Evaluate $e^{-kt}$ itself; do not approximate it with a straight line.', tol: 0.06 }].filter(x => Number.isFinite(x.value) && Math.abs(x.value - val) > 0.2),
      hints: [`Substitute $t = ${t}$.`, `$e^{-${kk}\\times${t}} = e^{-${Math.round(kk * t * 1000) / 1000}}$.`, `$T = ${Ta} + ${T0 - Ta}\\times${Math.round(Math.exp(-kk * t) * 10000) / 10000}$.`],
      steps: [{ h: 'Substitute', d: `$T(${t}) = ${Ta} + ${T0 - Ta}e^{-${Math.round(kk * t * 1000) / 1000}}$` }, { h: 'Evaluate $e^{-kt}$', d: `$e^{-${Math.round(kk * t * 1000) / 1000}} \\approx ${Math.round(Math.exp(-kk * t) * 10000) / 10000}$` }, { h: 'Add', d: `$T \\approx ${val}^\\circ\\text{C}$` }]
    });
    return [q, { kind: 'num', value: Ta + (T0 - Ta) * Math.exp(-kk * t) }];
  }
  if (kind === 3) {
    // rate of change of a growing population at a given time
    const N0 = rc(rng, [100, 200, 250, 400, 500, 800, 1000]), kk = rc(rng, [0.05, 0.08, 0.1, 0.12, 0.15, 0.2, 0.25]), t = ri(rng, 2, 12);
    const rate = kk * N0 * Math.exp(kk * t);
    const val = Math.round(rate * 10) / 10;
    const q = numQ(`The number of cells in a culture is $N(t) = ${N0}e^{${kk}t}$, where $t$ is in hours. Find the rate at which the number of cells is increasing after $${t}$ hours, in cells per hour, correct to 1 decimal place.`, val, {
      tol: 0.06, suffix: 'cells per hour',
      traps: [{ value: Math.round(N0 * Math.exp(kk * t) * 10) / 10, why: 'That is the number of cells, $N(t)$. The **rate** is the derivative $\\dfrac{dN}{dt} = kN$.', tol: 0.06 }, { value: Math.round(kk * N0 * 10) / 10, why: 'That is the initial rate ($t = 0$). The rate grows with the population: $\\dfrac{dN}{dt} = kN(t)$.', tol: 0.06 }].filter(x => Math.abs(x.value - val) > 0.2),
      hints: [`$\\dfrac{dN}{dt} = ${kk} \\times ${N0}e^{${kk}t}$.`, `Substitute $t = ${t}$.`, `$e^{${Math.round(kk * t * 1000) / 1000}} \\approx ${Math.round(Math.exp(kk * t) * 10000) / 10000}$.`],
      steps: [{ h: 'Differentiate', d: `$\\dfrac{dN}{dt} = ${Math.round(kk * N0 * 1000) / 1000}e^{${kk}t}$` }, { h: 'Substitute', d: `$t = ${t}$ gives $${Math.round(kk * N0 * 1000) / 1000}e^{${Math.round(kk * t * 1000) / 1000}}$` }, { h: 'Evaluate', d: `$\\approx ${val}$` }]
    });
    return [q, { kind: 'num', value: numD(x => N0 * Math.exp(kk * x), t) }];
  }
  // time for an investment/decay to reach a stated value
  const A0 = rc(rng, [2000, 5000, 8000, 10000, 20000, 25000]), kk = rc(rng, [0.03, 0.04, 0.05, 0.06, 0.07, 0.08]), mult = rc(rng, [1.5, 2, 2.5, 3, 4]);
  const tt = Math.log(mult) / kk;
  const val = Math.round(tt * 10) / 10;
  const q = numQ(`The value of a managed fund is $V(t) = ${D(A0)}\\,e^{${kk}t}$ dollars, where $t$ is in years. After how many years will its value first reach ${D(A0 * mult)}? Give your answer correct to 1 decimal place.`, val, {
    tol: 0.06, suffix: 'years',
    traps: [{ value: Math.round(Math.log(mult * A0) / kk * 10) / 10, why: `Divide by the starting value first: $e^{${kk}t} = ${mult}$, not $${A0 * mult}$.`, tol: 0.06 }, { value: Math.round((mult - 1) / kk * 10) / 10, why: 'Growth is exponential, not linear — use a logarithm.', tol: 0.06 }].filter(x => Number.isFinite(x.value) && Math.abs(x.value - val) > 0.2),
    hints: [`Set $${D(A0)}e^{${kk}t} = ${D(A0 * mult)}$ and divide.`, `$e^{${kk}t} = ${mult}$.`, `$t = \\dfrac{\\ln ${mult}}{${kk}}$.`],
    steps: [{ h: 'Equation', d: `$${A0}e^{${kk}t} = ${A0 * mult}$` }, { h: 'Isolate the exponential', d: `$e^{${kk}t} = ${mult}$` }, { h: 'Take logarithms', d: `$t = \\dfrac{\\ln ${mult}}{${kk}} \\approx ${val}$ years` }]
  });
  return [q, { kind: 'num', value: Math.log(A0 * mult / A0) / kk }];
}));

// Table / ratio reasoning for exponential growth: N(2t) from N(0) and N(t)
expForms.push(V('exp-ratio-table', [2, 3, 4], (rng) => {
  const N0 = ri(rng, 2, 40) * 5, m = ri(rng, 2, 4), t1 = ri(rng, 2, 8), j = ri(rng, 2, 4);
  const Nt = N0 * m;
  const ask = N0 * m ** j;

  const q = numQ(`A colony grows according to $N(t) = N_0e^{kt}$, where $t$ is in hours. At $t = 0$ there are $${N0}$ cells, and at $t = ${t1}$ hours there are $${Nt}$ cells. Find $N(${j * t1})$ exactly.`, ask, {
    traps: [{ value: N0 + (Nt - N0) * j, why: `The growth is exponential: each further $${t1}$ hours multiplies the number by the same factor $${m}$, so it does not add the same amount.` }, { value: Nt * j, why: `Every $${t1}$ hours multiplies by $${m}$: after $${j}$ such periods the factor is $${m}^{${j}}$.` }],
    hints: [`$N(${t1}) = ${N0}e^{${t1}k} = ${Nt}$, so $e^{${t1}k} = ${m}$.`, `$N(${j * t1}) = ${N0}\\left(e^{${t1}k}\\right)^{${j}}$.`, `$${N0} \\times ${m}^{${j}}$.`],
    steps: [{ h: 'Growth factor per period', d: `$e^{${t1}k} = \\dfrac{${Nt}}{${N0}} = ${m}$` }, { h: 'Repeat the period', d: `$e^{${j * t1}k} = ${m}^{${j}} = ${m ** j}$` }, { h: 'Scale', d: `$N(${j * t1}) = ${N0} \\times ${m ** j} = ${ask}$` }]
  });
  const kk = Math.log(m) / t1;
  return [q, { kind: 'num', value: N0 * Math.exp(kk * j * t1) }];
}));

// Stationary point of x^n e^(-ax) and similar
expForms.push(V('exp-stationary', [3, 4], (rng) => {
  const shape = ri(rng, 1, 3);
  const n = ri(rng, 2, 4), a = ri(rng, 2, 9);
  if (shape === 1) {
    const val = new Frac(n, a);
    const q = fracQ(`Find the $x$-coordinate of the stationary point of $y = x^{${n}}e^{-${a}x}$ for $x > 0$.`, val, {
      traps: [{ value: new Frac(a, n).value, why: `$\\dfrac{dy}{dx} = x^{${n - 1}}e^{-${a}x}(${n} - ${a}x)$; the stationary point comes from $${n} - ${a}x = 0$, so $x = \\dfrac{${n}}{${a}}$.` }, { value: -val.value, why: `Both $x^{${n - 1}}$ and $e^{-${a}x}$ are positive for $x>0$; only the bracket $${n} - ${a}x$ can be zero.` }].filter(t => Math.abs(t.value - val.value) > 1e-9),
      hints: ['Product rule, then factorise.', `$\\dfrac{dy}{dx} = x^{${n - 1}}e^{-${a}x}\\,(${n} - ${a}x)$.`, 'The exponential is never zero, and $x > 0$.'],
      steps: [{ h: 'Differentiate', d: `$y' = ${n}x^{${n - 1}}e^{-${a}x} - ${a}x^{${n}}e^{-${a}x}$` }, { h: 'Factorise', d: `$y' = x^{${n - 1}}e^{-${a}x}(${n} - ${a}x)$` }, { h: 'Solve', d: `$${n} - ${a}x = 0 \\Rightarrow x = ${val.latex()}$` }]
    });
    const f = x => x ** n * Math.exp(-a * x);
    return [q, { kind: 'num', value: n / a, aux2: [x => numD(f, x), n / a] }];
  }
  if (shape === 2) {
    const val = new Frac(1, a);
    const q = fracQ(`The curve $y = ${a}x - \\ln x$ is defined for $x > 0$. Find the $x$-coordinate of its stationary point.`, val, {
      traps: [{ value: a, why: `$\\dfrac{dy}{dx} = ${a} - \\dfrac{1}{x}$ — set this to zero and solve for $x$.` }, { value: 0, why: '$\\ln x$ is not defined at $x = 0$.' }],
      hints: [`$\\dfrac{d}{dx}\\ln x = \\dfrac{1}{x}$.`, `$y' = ${a} - \\dfrac{1}{x}$.`, `Set $${a} = \\dfrac{1}{x}$.`],
      steps: [{ h: 'Differentiate', d: `$y' = ${a} - \\dfrac{1}{x}$` }, { h: 'Set to zero', d: `$${a} = \\dfrac{1}{x}$` }, { h: 'Solve', d: `$x = ${val.latex()}$` }]
    });
    return [q, { kind: 'num', value: 1 / a, aux2: [x => numD(t => a * t - Math.log(t), x), 1 / a] }];
  }
  // minimum value of y = e^x - a x : at x = ln a
  const q = numQ(`Find the minimum value of $y = e^{x} - ${a}x$, giving your answer in the form $p - ${a}\\ln ${a}$ where $p$ is an integer. State the value of $p$.`, a, {
    prefix: 'p =',
    traps: [{ value: 1, why: `At the stationary point $x = \\ln ${a}$, so $e^{x} = ${a}$ — that gives $p = ${a}$.` }, { value: 0, why: 'The value of $e^{x}$ at the stationary point is not zero ($e^x$ is never zero).' }],
    hints: [`$y' = e^{x} - ${a}$, so $e^{x} = ${a}$ and $x = \\ln ${a}$.`, `Substitute: $y = e^{\\ln ${a}} - ${a}\\ln ${a}$.`, `$e^{\\ln ${a}} = ${a}$.`],
    steps: [{ h: 'Stationary point', d: `$y' = e^x - ${a} = 0 \\Rightarrow x = \\ln ${a}$` }, { h: 'Substitute', d: `$y = e^{\\ln ${a}} - ${a}\\ln ${a} = ${a} - ${a}\\ln ${a}$` }, { h: 'Read $p$', d: `$p = ${a}$` }]
  });
  const f = x => Math.exp(x) - a * x;
  const xm = Math.log(a);
  return [q, { kind: 'num', value: f(xm) + a * Math.log(a) }];
}));

// Show that y = A e^(mx) + B e^(nx) satisfies y'' + p y' + q y = 0; find p or q
expForms.push(V('exp-show-ode', [3, 4], (rng) => {
  let m, n;
  do { m = nz(rng, -5, 5); n = nz(rng, -5, 5); } while (m === n);
  const A = ri(rng, 1, 9), B = ri(rng, 1, 9);
  const askQ = rng() < 0.5;
  const p = -(m + n), qq = m * n;
  const val = askQ ? qq : p;
  const q = numQ(`Show that $y = ${cf(A)}e^{${ex(m)}} + ${cf(B)}e^{${ex(n)}}$ satisfies $\\dfrac{d^2y}{dx^2} + p\\dfrac{dy}{dx} + q\\,y = 0$ for constants $p$ and $q$. Find the value of $${askQ ? 'q' : 'p'}$.`, val, {
    prefix: askQ ? 'q =' : 'p =',
    traps: askQ ? [{ value: -qq, why: `Substituting gives $(${m}^2 + p(${m}) + q) = 0$ and $(${n}^2 + p(${n}) + q) = 0$; $q$ is the **product** $${m} \\times ${n}$.` }, { value: m + n, why: 'The sum of the exponents gives $-p$, not $q$.' }] : [{ value: m + n, why: `The equation is $y'' + py' + qy = 0$, so $p = -(${m} + ${n})$ — check the sign.` }, { value: m * n, why: 'The product of the exponents gives $q$; $p$ comes from their sum.' }],
    hints: [`$y' = ${A * m}e^{${m}x} + ${B * n}e^{${n}x}$ and $y'' = ${A * m * m}e^{${m}x} + ${B * n * n}e^{${n}x}$.`, `For the equation to hold for every $A$ and $B$: $r^2 + pr + q = 0$ must hold for $r = ${m}$ and $r = ${n}$.`, 'So $r^2 + pr + q = (r - ' + m + ')(r - ' + n + ')$.'],
    steps: [{ h: 'Differentiate twice', d: `$y'' = ${A * m * m}e^{${m}x} + ${B * n * n}e^{${n}x}$` }, { h: 'Substitute and group', d: `$${A}e^{${m}x}(${m}^2 + p(${m}) + q) + ${B}e^{${n}x}(${n}^2 + p(${n}) + q) = 0$` }, { h: 'Both brackets vanish', d: `$r^2 + pr + q = (r - ${m})(r - ${n})$, so $p = ${p}$ and $q = ${qq}$` }]
  });
  const f = x => A * Math.exp(m * x) + B * Math.exp(n * x);
  return [q, { kind: 'num', value: val, ode: { f, p, q: qq } }];
}));

// u-substitution with a logarithm: ∫ k (ln x)^n / x dx (expression)
expForms.push(V('exp-usub-log', [3, 4], (rng) => {
  const k = nz(rng, -9, 9), n = ri(rng, 1, 5);
  const expr = `${k}/${n + 1}*ln(x)^${n + 1}`;
  const q = exprQ(`Use the substitution $u = \\ln x$ to find $\\displaystyle\\int \\dfrac{${k}(\\ln x)^{${n}}}{x}\\,dx$ for $x > 0$. (You may omit the $+C$.)`, expr, {
    stripC: true, positiveOnly: true, prefix: '∫ =', inputHint: `e.g. ${k}/${n + 1} (ln x)^${n + 1} + C`,
    traps: [{ expr: `${k}*ln(x)^${n + 1}`, why: `Integrating $u^{${n}}$ divides by the new power $${n + 1}$.` }, { expr: `${k}/${n + 1}*ln(x)^${n}`, why: `Integrating raises the power: $u^{${n}}$ becomes $u^{${n + 1}}$.` }],
    hints: ['$u = \\ln x$ gives $du = \\dfrac{1}{x}\\,dx$.', `The integral becomes $\\displaystyle\\int ${k}u^{${n}}\\,du$.`, 'Substitute back $u = \\ln x$.'],
    steps: [{ h: 'Substitute', d: `$u = \\ln x$, $du = \\dfrac{dx}{x}$` }, { h: 'Integrate', d: `$\\displaystyle\\int ${k}u^{${n}}\\,du = \\dfrac{${k}}{${n + 1}}u^{${n + 1}} + C$` }, { h: 'Back-substitute', d: `$\\dfrac{${k}}{${n + 1}}(\\ln x)^{${n + 1}} + C$` }]
  });
  return [q, { kind: 'anti', f: x => k * Math.log(x) ** n / x, expr, lo: 0.4 }];
}));

// u-substitution constant for exponentials: ∫ k x e^(a x^2 + b) dx = c ∫ e^u du
expForms.push(V('exp-usub-constant', [3, 4], (rng) => {
  const k = nz(rng, -12, 12), a = nz(rng, -5, 5), b = nz(rng, -6, 6);
  const c = new Frac(k, 2 * a);
  const inner = `${cf(a)}x^{2}${sg(b)}`;
  const q = fracQ(`The substitution $u = ${inner}$ turns $\\displaystyle\\int ${cf(k)}x\\,e^{${inner}}\\,dx$ into $c\\displaystyle\\int e^{u}\\,du$. Find $c$.`, c, {
    prefix: 'c =',
    traps: [{ value: new Frac(k, a).value, why: `$du = ${2 * a}x\\,dx$ — the derivative of $${inner}$ includes the factor $2$ from $x^2$.` }, { value: new Frac(k * 2 * a).value, why: `$du = ${2 * a}x\\,dx$, so $x\\,dx = \\dfrac{du}{${2 * a}}$ — divide, do not multiply.` }].filter(t => Math.abs(t.value - c.value) > 1e-9),
    hints: [`$du = ${2 * a}x\\,dx$.`, `So $x\\,dx = \\dfrac{1}{${2 * a}}\\,du$.`, `Multiply by the $${k}$ in front.`],
    steps: [{ h: 'Differentiate u', d: `$du = ${2 * a}x\\,dx$` }, { h: 'Rewrite $x\\,dx$', d: `$x\\,dx = \\dfrac{du}{${2 * a}}$` }, { h: 'Constant', d: `$c = \\dfrac{${k}}{${2 * a}} = ${c.latex()}$` }]
  });
  const g = x => k * x * Math.exp(a * x * x + b);
  const F = x => c.value * Math.exp(a * x * x + b);
  return [q, { kind: 'num', value: c.value, aux: [[g, F]] }];
}));

// MCQ: first error in an integration working (representation + misconception distractors)
expForms.push(V('exp-mcq-integral-error', [2, 3, 4], (rng) => {
  const a = ri(rng, 2, 7), c = ri(rng, 1, 6) * a, kind = ri(rng, 1, 3);
  if (kind === 1) {
    const m = c / a;
    const good = `$${cf(m)}e^{${a}x} + C$`;
    const q = mcQ(rng, `Which is $\\displaystyle\\int ${cf(c)}e^{${a}x}\\,dx$?`, good, [
      { text: `$${cf(c * a)}e^{${a}x} + C$`, why: 'That differentiates instead of integrating: reversing the chain rule **divides** by ' + a + '.' },
      { text: `$${cf(c)}e^{${a}x} + C$`, why: `The factor $\\dfrac{1}{${a}}$ is missing.` },
      { text: `$\\dfrac{${c}e^{${a}x + 1}}{${a}x + 1} + C$`, why: 'The power rule is for $x^n$; it does not apply to an exponential function.' }
    ], ['$\\int e^{ax}\\,dx = \\dfrac{1}{a}e^{ax} + C$.', `Divide ${c} by ${a}.`, 'Differentiate to check.'],
    [{ h: 'Standard integral', d: `$\\int e^{ax}dx = \\dfrac{1}{a}e^{ax}$` }, { h: 'Divide', d: `$\\dfrac{${c}}{${a}} = ${m}$` }, { h: 'Answer', d: good }]);
    return [q, { kind: 'mcq' }];
  }
  if (kind === 2) {
    const m = c / a;
    const good = `$${cf(m)}\\ln(${a}x + 3) + C$`;
    const q = mcQ(rng, `Which is $\\displaystyle\\int \\dfrac{${c}}{${a}x + 3}\\,dx$, for $${a}x + 3 > 0$?`, good, [
      { text: `$${cf(c)}\\ln(${a}x + 3) + C$`, why: `The derivative of the denominator is $${a}$, so $\\dfrac{${c}}{${a}} = ${m}$ must replace the $${c}$.` },
      { text: `$${cf(m)}(${a}x + 3)^{-1} + C$`, why: '$\\int \\dfrac{1}{u}\\,du = \\ln u + C$ — the power rule fails for $u^{-1}$.' },
      { text: `$-${cf(m)}(${a}x + 3)^{-2} + C$`, why: 'That is the derivative of $\\dfrac{1}{u}$ — it differentiates instead of integrating.' }
    ], ['$\\int \\dfrac{u\'}{u}\\,dx = \\ln u + C$.', `The denominator differentiates to $${a}$.`, `$\\dfrac{${c}}{${a}} = ${m}$.`],
    [{ h: 'Match $f\'/f$', d: `$f = ${a}x + 3$, $f' = ${a}$` }, { h: 'Constant', d: `$\\dfrac{${c}}{${a}} = ${m}$` }, { h: 'Answer', d: good }]);
    return [q, { kind: 'mcq' }];
  }
  // locate the first wrong line in a working for d/dx[ x e^{ax} ] = (1 + a x) e^{ax}
  const wrong = ri(rng, 1, 4);   // the first faulty line; every faulty line differs from its correct version
  const L = [
    [`$u = x,\\ v = e^{${a}x}$`, `$u = x,\\ v = e^{x}$`],
    [`$u' = 1,\\ v' = ${a}e^{${a}x}$`, `$u' = 1,\\ v' = e^{${a}x}$`],
    [`$y' = u'v + uv' = e^{${a}x} + ${a}xe^{${a}x}$`, `$y' = u'v \\times uv' = ${a}xe^{${2 * a}x}$`],
    [`$y' = (1 + ${a}x)e^{${a}x}$`, `$y' = (1 + x)${a}e^{${a}x}$`]
  ];
  for (const pr of L) if (pr[0] === pr[1]) throw new Error('faulty line equals correct line');
  const show = L.map((pair, i) => (i + 1 === wrong ? pair[1] : pair[0]));
  const lines = show.map((t, i) => `Line ${i + 1}: ${t}`).join('\n');
  const optionsText = ['Line 1', 'Line 2', 'Line 3', 'Line 4'];
  const correctText = optionsText[wrong - 1];
  const q = mcQ(rng, `A student differentiates $y = xe^{${a}x}$ using the product rule:\n\n${lines}\n\nWhich line contains the **first** error?`, correctText,
    optionsText.filter(t => t !== correctText).map(t => ({ text: t })),
    ["Check each line against the product rule $y' = u'v + uv'$.", `$\\dfrac{d}{dx}e^{${a}x} = ${a}e^{${a}x}$.`, 'Work down the lines in order.'],
    [{ h: 'Correct working', d: `$u = x$, $v = e^{${a}x}$, $u' = 1$, $v' = ${a}e^{${a}x}$` }, { h: 'Product rule', d: `$y' = e^{${a}x} + ${a}xe^{${a}x} = (1 + ${a}x)e^{${a}x}$` }, { h: 'Compare', d: `The faulty line is Line ${wrong}: it differs from the correct working shown here.` }]);
  return [q, { kind: 'mcq' }];
}));


// ═════════════════════════════════════════════════════════════════════════════
// y12-motion
// ═════════════════════════════════════════════════════════════════════════════
const motionForms = [];

// Acceleration from a cubic displacement function
motionForms.push(V('motion-accel-from-x', [1, 2], (rng) => {
  const a = nz(rng, -4, 4), b = nz(rng, -9, 9), c = nz(rng, -9, 9), T = ri(rng, 1, 6);
  const acc = 6 * a * T + 2 * b;
  if (acc === 0) throw new Error('zero');
  const xs = poly3(a, b, c);
  const q = numQ(`A particle moves along a straight line so that its displacement from the origin is $x(t) = ${xs}$ metres after $t$ seconds. Find its **acceleration** when $t = ${T}$.`, acc, {
    suffix: 'm/s²',
    traps: [
      { value: 3 * a * T * T + 2 * b * T + c, why: 'That is the **velocity** (first derivative). Acceleration is the derivative of velocity — differentiate twice.' },
      { value: 6 * a + 2 * b, why: `The acceleration $a(t) = ${poly3b(6 * a, 2 * b)}$ depends on $t$ — substitute $t = ${T}$.` }
    ],
    hints: ['Velocity is $\\dfrac{dx}{dt}$ and acceleration is $\\dfrac{d^2x}{dt^2}$.', `$v(t) = ${poly3b(3 * a, 2 * b, c)}$.`, `$a(t) = ${poly3b(6 * a, 2 * b)}$; substitute $t = ${T}$.`],
    steps: [{ h: 'Velocity', d: `$v(t) = ${poly3b(3 * a, 2 * b, c)}$` }, { h: 'Acceleration', d: `$a(t) = ${poly3b(6 * a, 2 * b)}$` }, { h: `Substitute $t = ${T}$`, d: `$a(${T}) = ${acc}$ m/s²` }]
  });
  const x = t => a * t ** 3 + b * t * t + c * t;
  const h = 1e-3;
  return [q, { kind: 'num', value: (x(T + h) - 2 * x(T) + x(T - h)) / (h * h) }];
}));
/** a t^3 + b t^2 + c t as LaTeX. */
function poly3(a, b, c) { return poly([a, b, c, 0], 't'); }
/** coefficients (descending powers, highest `top`) as LaTeX in t. */
function poly3b(...cs) { return poly(cs, 't'); }

// Total distance vs displacement when the particle reverses
motionForms.push(V('motion-distance-reversal', [3, 4], (rng) => {
  const p = ri(rng, 1, 5), qq = ri(rng, p + 1, p + 5), T = ri(rng, qq + 1, qq + 3);
  // x(t) = 2t^3 - 3(p+q)t^2 + 6pq t, so v = 6(t-p)(t-q)
  const c2 = -3 * (p + qq), c1 = 6 * p * qq;
  const x = t => 2 * t ** 3 + c2 * t * t + c1 * t;
  const xs = poly([2, c2, c1, 0], 't');
  const dist = Math.abs(x(p) - x(0)) + Math.abs(x(qq) - x(p)) + Math.abs(x(T) - x(qq));
  const disp = x(T) - x(0);
  const ask = rng() < 0.5;
  const q = numQ(`A particle moves along a straight line with displacement $x(t) = ${xs}$ metres from the origin after $t$ seconds. Find the **${ask ? 'total distance travelled' : 'displacement'}** during the first $${T}$ seconds.`, ask ? dist : disp, {
    suffix: 'm',
    traps: ask
      ? [{ value: disp, why: `That is the **displacement**. The particle reverses at $t = ${p}$ and $t = ${qq}$, so the distance is the sum of the sizes of each leg.` }, { value: dist - 2 * Math.abs(x(qq) - x(p)), why: 'Each time the velocity changes sign the particle turns around — add up **every** leg, including the middle one.' }]
      : [{ value: dist, why: 'That is the **total distance**. Displacement is the net change in position: $x(T) - x(0)$.' }, { value: x(T) - x(p), why: 'Displacement over the first $' + T + '$ seconds starts from $t = 0$, not from the first stop.' }],
    hints: ask ? ['Find when $v = 0$: the particle turns around there.', `$v(t) = ${poly([6, -6 * (p + qq), 6 * p * qq], 't')} = 6(t - ${p})(t - ${qq})$, so it turns at $t = ${p}$ and $t = ${qq}$.`, `Find $|x(${p}) - x(0)|$, $|x(${qq}) - x(${p})|$ and $|x(${T}) - x(${qq})|$ and add.`] : [`Displacement is $x(${T}) - x(0)$.`, `$x(0) = 0$.`, `Substitute $t = ${T}$ into $x(t)$.`],
    steps: ask ? [
      { h: 'Turning points', d: `$v(t) = 6(t - ${p})(t - ${qq}) = 0$ at $t = ${p}$ and $t = ${qq}$` },
      { h: 'Positions', d: `$x(0) = 0$, $x(${p}) = ${x(p)}$, $x(${qq}) = ${x(qq)}$, $x(${T}) = ${x(T)}$` },
      { h: 'Add the legs', d: `$${Math.abs(x(p) - x(0))} + ${Math.abs(x(qq) - x(p))} + ${Math.abs(x(T) - x(qq))} = ${dist}$ m` }
    ] : [
      { h: 'Position at the end', d: `$x(${T}) = ${x(T)}$` },
      { h: 'Position at the start', d: `$x(0) = 0$` },
      { h: 'Displacement', d: `$${x(T)} - 0 = ${disp}$ m` }
    ]
  });
  // independent: integrate |v| with Simpson, split at the zeros
  const v = t => 6 * (t - p) * (t - qq);
  const truthDist = simpson(t => Math.abs(v(t)), 0, p) + simpson(t => Math.abs(v(t)), p, qq) + simpson(t => Math.abs(v(t)), qq, T);
  const truthDisp = simpson(v, 0, T);
  return [q, { kind: 'num', value: ask ? truthDist : truthDisp }];
}));

// Speed when the acceleration is zero
motionForms.push(V('motion-speed-at-zero-accel', [3, 4], (rng) => {
  const m = ri(rng, 1, 5), c = nz(rng, -20, 20);
  if (c === 3 * m * m) throw new Error('zero');
  const xs = poly([1, -3 * m, c, 0], 't');
  const speed = Math.abs(c - 3 * m * m);
  const q = numQ(`The displacement of a particle from the origin is $x(t) = ${xs}$ metres at time $t$ seconds, for $t \\ge 0$. Find the **speed** of the particle at the instant its acceleration is zero.`, speed, {
    suffix: 'm/s',
    traps: [{ value: c - 3 * m * m, why: 'Speed is the **magnitude** of velocity, so it cannot be negative.' }, { value: m, why: `$t = ${m}$ is the time at which the acceleration is zero — the question asks for the speed then.` }, { value: c, why: `$v(t) = ${poly([3, -6 * m, c], 't')}$ — substitute $t = ${m}$ into the whole expression.` }].filter(t => t.value !== speed),
    hints: [`$v(t) = ${poly([3, -6 * m, c], 't')}$ and $a(t) = ${poly([6, -6 * m], 't')}$.`, `Solve $a(t) = 0$: $t = ${m}$.`, `Evaluate $|v(${m})|$.`],
    steps: [{ h: 'Velocity and acceleration', d: `$v = ${poly([3, -6 * m, c], 't')}$, $a = ${poly([6, -6 * m], 't')}$` }, { h: 'When $a = 0$', d: `$t = ${m}$` }, { h: 'Speed', d: `$v(${m}) = ${c - 3 * m * m}$, so the speed is $${speed}$ m/s` }]
  });
  const x = t => t ** 3 - 3 * m * t * t + c * t;
  const h = 1e-3, vel = t => (x(t + h) - x(t - h)) / (2 * h);
  const tz = bisect(t => (vel(t + h) - vel(t - h)) / (2 * h), 0.01, 20);
  return [q, { kind: 'num', value: Math.abs(vel(tz)), tolOverride: 1e-4 }];
}));
function bisect(f, lo, hi) { for (let i = 0; i < 200; i++) { const mid = (lo + hi) / 2; if (f(lo) * f(mid) <= 0) hi = mid; else lo = mid; } return (lo + hi) / 2; }

// Vertical projectile context: AFL kick, cricket throw
motionForms.push(V('motion-projectile', [2, 3, 4], (rng) => {
  // believable launch speeds and heights: kicks and skyers leave the ground; a throw from a platform starts 15-40 m up
  const ctx0 = rc(rng, [
    { who: 'A kicker at the Sydney Cricket Ground punts a football straight up', ground: true, mMax: 2 },
    { who: 'A batter at the Gabba skies a cricket ball almost vertically', ground: true, mMax: 3 },
    { who: 'A netball is thrown straight up in a Perth gym', ground: true, mMax: 1 },
    { who: 'A ball is thrown straight up from a viewing platform at Bondi', ground: false, mMax: 2 }
  ]);
  let m, s, a0;
  if (ctx0.ground) { m = ri(rng, 1, ctx0.mMax); s = m; a0 = 0; }
  else { const pr = rc(rng, [[1, 2], [1, 3], [2, 3]]); m = pr[0]; s = pr[1]; a0 = 5 * (s * s - m * m); }
  const hs = `${a0 > 0 ? `${a0} + ` : ''}${cf(10 * m)}t - 5t^2`;
  const ctx = { who: ctx0.ground ? ctx0.who : `${ctx0.who}, ${a0} m above the ground`, obj: 'The ball' };
  const lead = `${ctx.who}. Its height above the ground is $h(t) = ${hs}$ metres, $t$ seconds after release.`;
  const ask = ri(rng, 1, 4);
  const maxH = a0 + 5 * m * m, tg = m + s, vImp = 10 * s;
  const common = { 1: [maxH, 'm', `${ctx.obj}'s greatest height`], 2: [m, 's', 'time to reach its greatest height'], 3: [tg, 's', 'time to hit the ground'], 4: [vImp, 'm/s', 'speed on hitting the ground'] };
  const prompts = {
    1: `Find the **maximum height** reached by the ball.`,
    2: `Find the time at which the ball reaches its **greatest height**.`,
    3: `Find the time at which the ball **hits the ground**.`,
    4: `Find the **speed** of the ball when it hits the ground.`
  };
  const traps = {
    1: [{ value: m, why: `$t = ${m}$ is the **time** of the greatest height — substitute it into $h(t)$ to get the height.` }, { value: a0 === 0 ? 5 * m : a0, why: a0 === 0 ? `$${5 * m}$ is not the greatest height; evaluate $h$ at the time its velocity is zero.` : `$h(0) = ${a0}$ is the height at release, not the maximum.` }],
    2: [{ value: maxH, why: `$${maxH}$ is the maximum **height**; the question asks when it happens.` }, { value: 2 * m, why: `The velocity is $v = ${10 * m} - 10t$, which is zero at $t = ${m}$ — not at twice that.` }],
    3: [{ value: m, why: `$t = ${m}$ is when the ball is at its highest. It still has to fall back to the ground.` }, { value: s + 1, why: `Solve $h(t) = 0$ carefully: the positive root is $t = ${tg}$.` }].filter(t => t.value !== tg),
    4: [{ value: -vImp, why: 'Speed is the **magnitude** of the velocity, so it is positive.' }, { value: 10 * tg, why: `Velocity is $v(t) = ${10 * m} - 10t$, not $10t$ — the ball was thrown up first.` }, { value: 10 * m, why: `That is the initial speed. At $t = ${tg}$ the speed is larger because the ball has been falling.` }]
  };
  const hints = {
    1: ['At the greatest height the velocity is zero.', `$v(t) = h'(t) = ${10 * m} - 10t = 0$ gives $t = ${m}$.`, `Substitute $t = ${m}$ into $h(t)$.`],
    2: ['The ball is momentarily at rest at its highest point.', `$h'(t) = ${10 * m} - 10t$.`, 'Solve $h\'(t) = 0$.'],
    3: ['The ball is on the ground when $h(t) = 0$.', `Divide by $-5$: $t^2 - ${2 * m}t${s > m ? ` - ${s * s - m * m}` : ''} = 0$.`, s > m ? `Factorise: $(t - ${tg})(t + ${s - m}) = 0$; reject the negative root.` : `Factorise: $t(t - ${tg}) = 0$; $t = 0$ is the release, so the landing time is the other root.`],
    4: [`First find when the ball lands: solve $h(t) = 0$ for $t > 0$.`, `$v(t) = ${10 * m} - 10t$.`, `Evaluate $v(${tg})$ and take the magnitude.`]
  };
  const steps = {
    1: [{ h: 'Velocity', d: `$v(t) = ${10 * m} - 10t$` }, { h: 'Time of greatest height', d: `$t = ${m}$` }, { h: 'Height', d: `$h(${m}) = ${maxH}$ m` }],
    2: [{ h: 'Velocity', d: `$v(t) = ${10 * m} - 10t$` }, { h: 'Set to zero', d: `$${10 * m} - 10t = 0$` }, { h: 'Solve', d: `$t = ${m}$ s` }],
    3: [{ h: 'Set height to zero', d: `$${hs} = 0$` }, { h: 'Factorise', d: s > m ? `$(t - ${tg})(t + ${s - m}) = 0$` : `$t(t - ${tg}) = 0$` }, { h: 'Landing time', d: `$t = ${tg}$ s` }],
    4: [{ h: 'Landing time', d: `$h(t) = 0$ at $t = ${tg}$ s` }, { h: 'Velocity then', d: `$v(${tg}) = ${10 * m} - ${10 * tg} = ${10 * m - 10 * tg}$ m/s` }, { h: 'Speed', d: `$${vImp}$ m/s` }]
  };
  const q = numQ(`${lead} ${prompts[ask]}`, common[ask][0], { suffix: common[ask][1], traps: traps[ask], hints: hints[ask], steps: steps[ask] });
  const h = t => a0 + 10 * m * t - 5 * t * t;
  let lo = 0, hi = 50;
  for (let i = 0; i < 200; i++) { const m1 = lo + (hi - lo) / 3, m2 = hi - (hi - lo) / 3; if (h(m1) < h(m2)) lo = m1; else hi = m2; }
  const tPeak = (lo + hi) / 2;
  const tGround = bisect(t => h(t), tPeak, 100);
  const truth = { 1: h(tPeak), 2: tPeak, 3: tGround, 4: Math.abs(numD(h, tGround)) }[ask];
  return [q, { kind: 'num', value: truth, tolOverride: 1e-4 }];
}));

// Two integrations: from acceleration to displacement (or velocity)
motionForms.push(V('motion-integrate-twice', [3, 4], (rng) => {
  const al = nz(rng, -3, 4), be = nz(rng, -6, 6), v0 = nz(rng, -9, 9), x0 = ri(rng, -8, 8), T = ri(rng, 2, 6);
  const aT = `${poly([6 * al, 2 * be], 't')}`;
  const xv = al * T ** 3 + be * T * T + v0 * T + x0;
  const vv = 3 * al * T * T + 2 * be * T + v0;
  const askX = rng() < 0.5;
  const start = `$v(0) = ${v0}$ m/s${askX ? ` and $x(0) = ${x0}$ m` : ''}`;
  const q = numQ(`A particle moves in a straight line with acceleration $a(t) = ${aT}$ m/s². Initially ${start}. Find its ${askX ? '**displacement** $x$' : '**velocity** $v$'} when $t = ${T}$.`, askX ? xv : vv, {
    suffix: askX ? 'm' : 'm/s',
    traps: askX ? [{ value: vv, why: 'That is the velocity at $t = ' + T + '$. Integrate once more to reach displacement.' }, { value: xv - x0, why: `The constant of integration for $x$ is the initial position $x(0) = ${x0}$.` }, { value: xv - v0 * T, why: `The constant in $v$ is $v(0) = ${v0}$, which integrates to $${v0}t$ in the displacement.` }].filter(t => t.value !== xv)
      : [{ value: vv - v0, why: `The constant of integration for $v$ is the initial velocity $v(0) = ${v0}$.` }, { value: 3 * al * T * T + 2 * be * T, why: `Add the constant of integration: $v(0) = ${v0}$.` }].filter(t => t.value !== vv),
    hints: ['Integrate acceleration to get velocity, using $v(0)$ to find the constant.', `$v(t) = ${poly([3 * al, 2 * be, v0], 't')}$.`, askX ? `Integrate again: $x(t) = ${poly([al, be, v0, x0], 't')}$ (using $x(0) = ${x0}$).` : `Substitute $t = ${T}$.`],
    steps: askX ? [
      { h: 'Velocity', d: `$v(t) = \\displaystyle\\int a\\,dt = ${poly([3 * al, 2 * be, v0], 't')}$` },
      { h: 'Displacement', d: `$x(t) = \\displaystyle\\int v\\,dt = ${poly([al, be, v0, x0], 't')}$` },
      { h: `Substitute $t = ${T}$`, d: `$x(${T}) = ${xv}$ m` }
    ] : [
      { h: 'Integrate', d: `$v(t) = ${poly([3 * al, 2 * be], 't')} + C$` },
      { h: 'Use $v(0)$', d: `$C = ${v0}$, so $v(t) = ${poly([3 * al, 2 * be, v0], 't')}$` },
      { h: `Substitute $t = ${T}$`, d: `$v(${T}) = ${vv}$ m/s` }
    ]
  });
  const acc = t => 6 * al * t + 2 * be;
  const velT = t => v0 + simpson(acc, 0, t, 200);
  const truth = askX ? x0 + simpson(velT, 0, T, 100) : velT(T);
  return [q, { kind: 'num', value: truth, tolOverride: 1e-4 }];
}));

// Table of velocities (representation change): distance with uniform change between readings
motionForms.push(V('motion-table-distance', [2, 3], (rng) => {
  const n = ri(rng, 3, 4);
  const ts = [0];
  for (let i = 1; i <= n; i++) ts.push(ts[i - 1] + ri(rng, 1, 4));
  const vs = [0];
  for (let i = 1; i < n; i++) vs.push(ri(rng, 2, 16));
  vs.push(0);
  let tot = new Frac(0);
  for (let i = 0; i < n; i++) tot = tot.add(new Frac((ts[i + 1] - ts[i]) * (vs[i] + vs[i + 1]), 2));
  const readings = ts.map((t, i) => `$${t}$ s: $${vs[i]}$ m/s`).join('; ');
  const q = fracQ(`A cyclist's velocity is recorded during a short sprint at the Sydney Olympic Park velodrome: ${readings}. Assume the velocity changes at a constant rate between consecutive readings and the cyclist never reverses. Find the total distance travelled, in metres.`, tot, {
    suffix: 'm', inputHint: 'a whole number or decimal, e.g. 37.5',
    traps: [{ value: Math.max(...vs) * ts[n], why: 'That assumes the top speed was held for the whole time — use the area under the graph instead.' }, { value: vs.reduce((s, v, i) => s + v * (i ? ts[i] - ts[i - 1] : 0), 0), why: 'Each interval is a trapezium: use the **average** of the two readings, not just the later one.' }].filter(t => Math.abs(t.value - tot.value) > 1e-9),
    hints: ['Distance is the area under the velocity–time graph.', 'Each pair of readings gives a trapezium of width $\\Delta t$ and parallel sides $v_i$ and $v_{i+1}$.', 'Area $= \\tfrac{1}{2}(v_i + v_{i+1})\\,\\Delta t$.'],
    steps: ts.slice(0, n).map((t, i) => ({ h: `Interval ${i + 1}`, d: `$\\tfrac{1}{2}(${vs[i]} + ${vs[i + 1]})\\times ${ts[i + 1] - t} = ${new Frac((ts[i + 1] - t) * (vs[i] + vs[i + 1]), 2).latex()}$` })).concat([{ h: 'Total', d: `$${tot.latex()}$ m` }])
  });
  q.answer.tol = 0.0005;
  if (tot.d !== 1) { delete q.answer.simplestFraction; q.inputHint = 'a decimal or fraction, e.g. 37.5'; }
  let sum = 0;
  for (let i = 0; i < n; i++) sum += simpson(t => vs[i] + (vs[i + 1] - vs[i]) * (t - ts[i]) / (ts[i + 1] - ts[i]), ts[i], ts[i + 1], 10);
  return [q, { kind: 'num', value: sum, tolOverride: 1e-6 }];
}));

// MCQ: direction and speeding up / slowing down from the signs of v and a
motionForms.push(V('motion-mcq-speeding', [1, 2, 3, 4], (rng) => {
  let a, b, c, T, vv, aa;
  do { a = nz(rng, -3, 3); b = nz(rng, -8, 8); c = nz(rng, -12, 12); T = ri(rng, 1, 6); vv = 3 * a * T * T + 2 * b * T + c; aa = 6 * a * T + 2 * b; } while (vv === 0 || aa === 0);
  const dirTxt = vv > 0 ? 'positive' : 'negative';
  const speedUp = vv * aa > 0;
  const mk = (dPos, up) => `Moving in the ${dPos ? 'positive' : 'negative'} direction and ${up ? 'speeding up' : 'slowing down'}`;
  const good = mk(vv > 0, speedUp);
  const q = mcQ(rng, `A particle's displacement is $x(t) = ${poly3(a, b, c)}$ metres after $t$ seconds. At $t = ${T}$, which statement is correct?`, good, [
    { text: mk(vv > 0, !speedUp), why: 'The particle speeds up when velocity and acceleration have the **same** sign, and slows down when the signs differ.' },
    { text: mk(vv < 0, speedUp), why: 'The direction of motion is given by the sign of the **velocity**, not the acceleration.' },
    { text: mk(vv < 0, !speedUp), why: 'Check both signs: direction from $v$, speeding up or slowing down from $v$ and $a$ together.' }
  ], ['Direction: the sign of $v$. Speeding up: $v$ and $a$ have the same sign.', `$v(t) = ${poly3b(3 * a, 2 * b, c)}$, $a(t) = ${poly3b(6 * a, 2 * b)}$.`, `Evaluate both at $t = ${T}$.`],
  [{ h: 'Velocity and acceleration', d: `$v(${T}) = ${vv}$, $a(${T}) = ${aa}$` }, { h: 'Direction', d: `$v ${vv > 0 ? '>' : '<'} 0$: ${dirTxt} direction` }, { h: 'Speed', d: `$v$ and $a$ have ${speedUp ? 'the same sign' : 'opposite signs'}, so the particle is ${speedUp ? 'speeding up' : 'slowing down'}` }]);
  return [q, { kind: 'mcq' }];
}));

// Minimum rate of change (a context for the cubic)
motionForms.push(V('motion-min-rate', [3, 4], (rng) => {
  const al = ri(rng, 1, 3), m = ri(rng, 1, 4), g = nz(rng, -15, 25);
  const minRate = g - 3 * al * m * m;
  if (minRate === 0) throw new Error('zero');
  const askTime = rng() < 0.5;
  const Vs = poly([al, -3 * al * m, g, 0], 't');
  const q = numQ(`The volume of water in a rainwater tank is $V(t) = ${Vs}$ litres, $t$ minutes after a pump is switched on, for $0 \\le t \\le ${3 * m}$. Find the ${askTime ? 'time at which the **rate of change** of volume is a minimum' : '**minimum rate of change** of the volume, in litres per minute'}.`, askTime ? m : minRate, {
    suffix: askTime ? 'minutes' : 'L/min',
    traps: askTime ? [{ value: 2 * m, why: `The rate $V'(t) = ${poly([3 * al, -6 * al * m, g], 't')}$ is a quadratic: its minimum is at the vertex $t = \\dfrac{6${al === 1 ? '' : `\\times${al}`}${m === 1 ? '' : `\\times ${m}`}}{2\\times ${3 * al}}$, not where $V = 0$.` }, { value: minRate, why: 'That is the **value** of the minimum rate; the question asks for the time at which it happens.' }].filter(t => t.value !== m)
      : [{ value: m, why: `$t = ${m}$ is the **time** of the minimum rate; substitute it into $V'(t)$.` }, { value: g, why: `$V'(0) = ${g}$ is the rate at $t = 0$ — the minimum of the quadratic $V'$ is at its vertex.` }, { value: -minRate, why: `Evaluate $V'(${m}) = ${poly([3 * al, -6 * al * m, g], 't').replace(/t/g, `(${m})`)}$ carefully.` }].filter(t => t.value !== minRate),
    hints: [`The rate of change is $V'(t) = ${poly([3 * al, -6 * al * m, g], 't')}$.`, 'This is an upward parabola in $t$, so its minimum is at the vertex (or where its derivative $V\'\'$ is zero).', `$V''(t) = ${poly([6 * al, -6 * al * m], 't')} = 0$ gives $t = ${m}$.`],
    steps: [{ h: 'Rate of change', d: `$V'(t) = ${poly([3 * al, -6 * al * m, g], 't')}$` }, { h: 'Minimise', d: `$V''(t) = ${poly([6 * al, -6 * al * m], 't')} = 0 \\Rightarrow t = ${m}$` }, { h: 'Answer', d: askTime ? `$t = ${m}$ minutes` : `$V'(${m}) = ${minRate}$ L/min` }]
  });
  const V0 = t => al * t ** 3 - 3 * al * m * t * t + g * t;
  const rate = t => numD(V0, t);
  let lo = 0, hi = 3 * m;
  for (let i = 0; i < 200; i++) { const m1 = lo + (hi - lo) / 3, m2 = hi - (hi - lo) / 3; if (rate(m1) < rate(m2)) hi = m2; else lo = m1; }
  const tm = (lo + hi) / 2;
  return [q, { kind: 'num', value: askTime ? tm : rate(tm), tolOverride: 1e-3 }];
}));

// Trigonometric motion: exact velocity or acceleration
motionForms.push(V('motion-trig-exact', [3, 4], (rng) => {
  const fn = rc(rng, ['sin', 'cos']), wantV = rng() < 0.5;
  const A = nz(rng, -6, 6), b = ri(rng, 2, 6);
  // the trig function that appears in the answer
  const usesSin = (fn === 'sin') !== wantV;   // v of sin -> cos; a of sin -> sin; v of cos -> sin; a of cos -> cos
  const degs = usesSin ? SIN_DEGS.filter(d => d > 0 && d < 360) : COS_DEGS.filter(d => d > 0 && d < 360);
  const th = rc(rng, degs);
  const tv = (usesSin ? fr(SIN_R[th]) : fr(COS_R[th]));
  let coef;
  if (wantV) coef = fn === 'sin' ? A * b : -A * b; else coef = -A * b * b;
  const val = tv.mul(new Frac(coef));
  if (val.n === 0) throw new Error('zero');
  const X = piAng(th, b);
  const ctx = rc(rng, ['A buoy off Bondi Beach', 'A float on a Sydney Harbour swell', 'A surf-lifesaving flag on a wave']);
  const q = fracQ(`${ctx} bobs vertically so that its height above the mean water level is $x(t) = ${cf(A)}\\${fn}(${b}t)$ metres after $t$ seconds. Find its exact ${wantV ? 'velocity' : 'acceleration'} when $t = ${X.tex}$ seconds.`, val, {
    suffix: wantV ? 'm/s' : 'm/s²',
    traps: [{ value: tv.mul(new Frac(wantV ? A : -A * b)).value, why: wantV ? `The chain rule multiplies by the inner coefficient $${b}$.` : `Differentiate twice: the inner coefficient $${b}$ contributes $${b}^2$.` }, { value: val.mul(new Frac(-1)).value, why: 'Check the sign: $\\dfrac{d}{dt}\\sin = +\\cos$ but $\\dfrac{d}{dt}\\cos = -\\sin$.' }].filter(t => Math.abs(t.value - val.value) > 1e-9),
    hints: wantV ? [`$v(t) = ${cf(fn === 'sin' ? A * b : -A * b)}\\${fn === 'sin' ? 'cos' : 'sin'}(${b}t)$.`, `At $t = ${X.tex}$, $${b}t = ${piAng(th).tex}$.`, 'Use the exact value of that ratio.'] : [`$a(t) = ${cf(-A * b * b)}\\${fn}(${b}t)$.`, `At $t = ${X.tex}$, $${b}t = ${piAng(th).tex}$.`, 'Use the exact value of that ratio.'],
    steps: wantV ? [{ h: 'Velocity', d: `$v(t) = ${cf(fn === 'sin' ? A * b : -A * b)}\\${fn === 'sin' ? 'cos' : 'sin'}(${b}t)$` }, { h: 'Angle', d: `$${b}t = ${piAng(th).tex}$` }, { h: 'Evaluate', d: `$v = ${val.latex()}$ m/s` }] : [{ h: 'Acceleration', d: `$a(t) = ${cf(-A * b * b)}\\${fn}(${b}t)$` }, { h: 'Angle', d: `$${b}t = ${piAng(th).tex}$` }, { h: 'Evaluate', d: `$a = ${val.latex()}$ m/s²` }]
  });
  const f = t => A * Math[fn](b * t);
  const t0 = th * DEG / b, h = 1e-3;
  return [q, { kind: 'num', value: wantV ? numD(f, t0) : (f(t0 + h) - 2 * f(t0) + f(t0 - h)) / (h * h), tolOverride: 1e-4 }];
}));

// Exponential motion: initial velocity / acceleration / exact velocity at ln(m)/a
motionForms.push(V('motion-exponential', [2, 3, 4], (rng) => {
  const kk = ri(rng, 2, 20), a = ri(rng, 1, 5), kind = ri(rng, 1, 3);
  const xs = `${kk}e^{-${a === 1 ? '' : a}t}`;
  const lead = `A particle's displacement from the origin is $x(t) = ${xs}$ metres after $t$ seconds, for $t \\ge 0$.`;
  const x = t => kk * Math.exp(-a * t);
  if (kind === 1) {
    const q = numQ(`${lead} Find its **initial velocity**.`, -kk * a, { suffix: 'm/s', traps: [{ value: kk, why: `$x(0) = ${kk}$ is the initial **position**. Velocity is the derivative.` }, { value: kk * a, why: 'The exponent is negative, so the velocity is negative: the particle moves back towards the origin.' }], hints: [`$v(t) = \\dfrac{dx}{dt} = ${-kk * a}e^{-${a === 1 ? '' : a}t}$.`, 'Substitute $t = 0$.', '$e^0 = 1$.'], steps: [{ h: 'Differentiate', d: `$v(t) = ${-kk * a}e^{-${a === 1 ? '' : a}t}$` }, { h: 'At $t = 0$', d: `$v(0) = ${-kk * a}$ m/s` }] });
    return [q, { kind: 'num', value: numD(x, 1e-5), tolOverride: 1e-3 }];
  }
  if (kind === 2) {
    const q = numQ(`${lead} Find its **initial acceleration**.`, kk * a * a, { suffix: 'm/s²', traps: [{ value: -kk * a, why: 'That is the initial velocity. Differentiate once more for the acceleration.' }, { value: -kk * a * a, why: `Differentiating $e^{-${a === 1 ? '' : a}t}$ twice gives $(-${a})^2 = ${a * a}$ — the signs cancel.` }], hints: [`$v(t) = ${-kk * a}e^{-${a === 1 ? '' : a}t}$.`, `$a(t) = ${kk * a * a}e^{-${a === 1 ? '' : a}t}$.`, 'Substitute $t = 0$.'], steps: [{ h: 'Velocity', d: `$v = ${-kk * a}e^{-${a === 1 ? '' : a}t}$` }, { h: 'Acceleration', d: `$a = ${kk * a * a}e^{-${a === 1 ? '' : a}t}$` }, { h: 'At $t = 0$', d: `$a(0) = ${kk * a * a}$ m/s²` }] });
    const h = 1e-3, t0 = 0.5, acc0 = (x(t0 + h) - 2 * x(t0) + x(t0 - h)) / (h * h) / Math.exp(-a * t0);
    return [q, { kind: 'num', value: acc0, tolOverride: 1e-3 }];
  }
  const m = rc(rng, [2, 3, 4, 5, 6, 8, 10]);
  const val = new Frac(-kk * a, m);
  const T = a === 1 ? `\\ln ${m}` : `\\dfrac{\\ln ${m}}{${a}}`;
  const q = fracQ(`${lead} Find its exact velocity when $t = ${T}$ seconds.`, val, { suffix: 'm/s', traps: [{ value: -kk * a * m, why: `$e^{-${a === 1 ? '' : a}t}$ at this time equals $e^{-\\ln ${m}} = \\dfrac{1}{${m}}$, so divide by $${m}$ rather than multiply.` }, { value: (-kk * a) / (m * m), why: `$e^{-\\ln ${m}} = \\dfrac{1}{${m}}$, not $\\dfrac{1}{${m}^2}$.` }].filter(t => Math.abs(t.value - val.value) > 1e-9), hints: [`$v(t) = ${-kk * a}e^{-${a === 1 ? '' : a}t}$.`, `At $t = ${T}$, $${a === 1 ? '' : a}t = \\ln ${m}$.`, `$e^{-\\ln ${m}} = \\dfrac{1}{${m}}$.`], steps: [{ h: 'Velocity', d: `$v = ${-kk * a}e^{-${a === 1 ? '' : a}t}$` }, { h: 'Exponent', d: `$-${a === 1 ? '' : a}t = -\\ln ${m}$, so $e^{-${a === 1 ? '' : a}t} = \\dfrac{1}{${m}}$` }, { h: 'Velocity', d: `$v = ${val.latex()}$ m/s` }] });
  return [q, { kind: 'num', value: numD(x, Math.log(m) / a) }];
}));

// Show that: x(t) = A sin(bt) satisfies x'' = -k x; or A e^{kt} satisfies x' = c x
motionForms.push(V('motion-show-shm', [2, 3, 4], (rng) => {
  if (rng() < 0.6) {
    const A = ri(rng, 1, 9), b = ri(rng, 2, 9), fn = rc(rng, ['sin', 'cos']);
    const q = numQ(`Show that the displacement $x(t) = ${cf(A)}\\${fn}(${b}t)$ metres satisfies $\\dfrac{d^2x}{dt^2} = -kx$ for a constant $k$. Find $k$.`, b * b, {
      prefix: 'k =',
      traps: [{ value: b, why: `Differentiating twice brings down $${b}$ **twice**: $k = ${b}^2$.` }, { value: A * b * b, why: 'The amplitude $' + A + '$ appears on both sides of $x\'\' = -kx$ and cancels.' }, { value: -b * b, why: 'The equation is $x\'\' = -kx$, so $k$ is the positive number $' + b * b + '$.' }],
      hints: [fn === 'sin' ? `$\\dfrac{dx}{dt} = ${A * b}\\cos(${b}t)$.` : `$\\dfrac{dx}{dt} = ${-A * b}\\sin(${b}t)$.`, `$\\dfrac{d^2x}{dt^2} = ${-A * b * b}\\${fn}(${b}t) = -${b * b}\\,x$.`, 'Compare with $-kx$.'],
      steps: [{ h: 'First derivative', d: fn === 'sin' ? `$v = ${A * b}\\cos(${b}t)$` : `$v = ${-A * b}\\sin(${b}t)$` }, { h: 'Second derivative', d: `$a = ${-A * b * b}\\${fn}(${b}t)$` }, { h: 'Compare with $-kx$', d: `$a = -${b * b}\\,x$, so $k = ${b * b}$` }]
    });
    const x = t => A * Math[fn](b * t), h = 1e-3, t0 = 0.3;
    const acc = (x(t0 + h) - 2 * x(t0) + x(t0 - h)) / (h * h);
    return [q, { kind: 'num', value: -acc / x(t0), tolOverride: 1e-3 }];
  }
  const A = ri(rng, 2, 9), c = nz(rng, -5, 5);
  const q = numQ(`The distance of a drone from its base is $x(t) = ${A}e^{${et(c)}}$ metres after $t$ seconds. Show that $\\dfrac{dx}{dt} = c\\,x$ for a constant $c$, and find $c$.`, c, {
    prefix: 'c =',
    traps: [{ value: A * c, why: `$\\dfrac{dx}{dt} = ${A * c}e^{${et(c)}} = ${c}\\times ${A}e^{${et(c)}}$ — the constant $c$ is the multiplier of $x$, not of $e^{${et(c)}}$.` }, { value: -c, why: 'Check the sign of the exponent when differentiating.' }],
    hints: [`$\\dfrac{d}{dt}e^{${et(c)}} = ${c}e^{${et(c)}}$.`, `So $\\dfrac{dx}{dt} = ${A * c}e^{${et(c)}}$.`, `Write this as $c \\times ${A}e^{${et(c)}}$.`],
    steps: [{ h: 'Differentiate', d: `$\\dfrac{dx}{dt} = ${A * c}e^{${et(c)}}$` }, { h: 'Rewrite', d: `$= ${c} \\times ${A}e^{${et(c)}} = ${c}x$` }, { h: 'Constant', d: `$c = ${c}$` }]
  });
  const x = t => A * Math.exp(c * t), t0 = 0.4;
  return [q, { kind: 'num', value: numD(x, t0) / x(t0), tolOverride: 1e-6 }];
}));

// Position at the first stationary instant (multi-step)
motionForms.push(V('motion-first-rest-position', [3, 4], (rng) => {
  const p = ri(rng, 1, 5), qq = ri(rng, p + 1, p + 5);
  const c2 = -3 * (p + qq), c1 = 6 * p * qq, c0 = ri(rng, -9, 9);
  const x = t => 2 * t ** 3 + c2 * t * t + c1 * t + c0;
  const xs = poly([2, c2, c1, c0], 't');
  const q = numQ(`A particle's displacement from a fixed point is $x(t) = ${xs}$ metres after $t$ seconds, $t \\ge 0$. Find its displacement at the **first** instant it is momentarily at rest.`, x(p), {
    suffix: 'm',
    traps: [{ value: x(qq), why: `The particle is at rest at $t = ${p}$ **and** $t = ${qq}$; the question asks about the first.` }, { value: p, why: `$t = ${p}$ is the time. Substitute it into $x(t)$ for the displacement.` }, { value: 6 * (p * p - (p + qq) * p + p * qq) * 0 + x(0), why: `$x(0) = ${c0}$ is the starting position, not the position at rest.` }].filter(t => t.value !== x(p)),
    hints: ['At rest means $v = 0$.', `$v(t) = ${poly([6, -6 * (p + qq), 6 * p * qq], 't')} = 6(t - ${p})(t - ${qq})$.`, `The first zero is $t = ${p}$; substitute it into $x(t)$.`],
    steps: [{ h: 'Velocity', d: `$v(t) = ${poly([6, -6 * (p + qq), 6 * p * qq], 't')}$` }, { h: 'Rest times', d: `$t = ${p}$ and $t = ${qq}$; the first is $${p}$` }, { h: 'Displacement', d: `$x(${p}) = ${x(p)}$ m` }]
  });
  const v = t => numD(x, t);
  const tz = bisect(v, 0.01, (p + qq) / 2);
  return [q, { kind: 'num', value: x(tz), tolOverride: 1e-4 }];
}));

// ═════════════════════════════════════════════════════════════════════════════
// y12-series
// ═════════════════════════════════════════════════════════════════════════════
const seriesForms = [];
const ordinal = n => `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd', 'th', 'th', 'th', 'th', 'th', 'th'][n % 10]}`;
const termList = (a, d, n) => Array.from({ length: n }, (_, i) => a + i * d);

// Two terms given: find d, a or a later term (arithmetic)
seriesForms.push(V('series-ap-two-terms', [1, 2, 3], (rng) => {
  const a = ri(rng, -12, 25), d = nz(rng, -8, 9);
  const p = ri(rng, 2, 6), qi = ri(rng, p + 2, 13), r = ri(rng, qi + 1, qi + 8);
  const Tp = a + (p - 1) * d, Tq = a + (qi - 1) * d;
  const ask = ri(rng, 1, 3);
  const lead = `In an arithmetic sequence the ${ordinal(p)} term is $${Tp}$ and the ${ordinal(qi)} term is $${Tq}$.`;
  const gap = qi - p;
  const cfg = {
    1: { p: `${lead} Find the common difference.`, v: d, tr: [{ value: (Tq - Tp), why: `The difference between the two terms covers $${gap}$ steps, so divide by $${gap}$.` }, { value: Tq / qi, why: 'The common difference is the change per step: $\\dfrac{T_q - T_p}{q - p}$.' }], h: [`$T_${qi} - T_${p} = ${gap}d$.`, `$${Tq} - (${Tp}) = ${Tq - Tp}$.`, `$d = \\dfrac{${Tq - Tp}}{${gap}}$.`], st: [{ h: 'Difference of the terms', d: `$T_{${qi}} - T_{${p}} = ${gap}d$` }, { h: 'Substitute', d: `$${Tq - Tp} = ${gap}d$` }, { h: 'Solve', d: `$d = ${d}$` }] },
    2: { p: `${lead} Find the first term.`, v: a, tr: [{ value: Tp - d, why: `Work back $${p - 1}$ steps from $T_${p}$, not just one.` }, { value: Tp - p * d, why: `$T_n = a + (n - 1)d$, so go back $n - 1 = ${p - 1}$ steps.` }], h: [`First find $d = \\dfrac{T_${qi} - T_${p}}{${gap}}$.`, `$d = ${d}$.`, `$a = T_${p} - ${p - 1}d$.`], st: [{ h: 'Common difference', d: `$d = \\dfrac{${Tq - Tp}}{${gap}} = ${d}$` }, { h: 'Work back', d: `$a = ${Tp} - ${p - 1}(${d})$` }, { h: 'First term', d: `$a = ${a}$` }] },
    3: { p: `${lead} Find the ${ordinal(r)} term.`, v: a + (r - 1) * d, tr: [{ value: Tq + (r - qi + 1) * d, why: `From $T_${qi}$ to $T_${r}$ is $${r - qi}$ steps, not $${r - qi + 1}$.` }, { value: Tq + (r - qi) * (Tq - Tp), why: 'Add the common difference — not the whole difference between the two given terms — for each step.' }], h: [`$d = \\dfrac{${Tq} - (${Tp})}{${gap}} = ${d}$.`, `From $T_${qi}$ to $T_${r}$ is $${r - qi}$ steps.`, `$T_${r} = T_${qi} + ${r - qi}d$.`], st: [{ h: 'Common difference', d: `$d = ${d}$` }, { h: 'Steps to take', d: `$${r} - ${qi} = ${r - qi}$` }, { h: 'Term', d: `$T_{${r}} = ${Tq} + ${r - qi}(${d}) = ${a + (r - 1) * d}$` }] }
  }[ask];
  const traps = cfg.tr.filter(t => fin(t.value) && t.value !== cfg.v);
  const q = numQ(cfg.p, cfg.v, { traps, hints: cfg.h, steps: cfg.st });
  const seq = termList(a, d, r);
  return [q, { kind: 'num', value: ask === 1 ? seq[1] - seq[0] : ask === 2 ? seq[0] : seq[r - 1], seqCheck: [p, Tp, qi, Tq, seq] }];
}));

// Geometric: ratio from two terms (index gap odd so the real ratio is unique), or the next term
seriesForms.push(V('series-gp-two-terms', [2, 3, 4], (rng) => {
  const a = ri(rng, 1, 8), r = rc(rng, [2, 3, 4, 5, -2, -3, -4]);
  const p = ri(rng, 1, 3), gap = rc(rng, [1, 3]), qi = p + gap;
  const Tp = a * r ** (p - 1), Tq = a * r ** (qi - 1);
  const ask = rng() < 0.5;
  const lead = `In a geometric sequence the ${ordinal(p)} term is $${Tp}$ and the ${ordinal(qi)} term is $${Tq}$.`;
  const nxt = Tq * r;
  const q = numQ(ask ? `${lead} Find the common ratio.` : `${lead} Find the ${ordinal(qi + 1)} term.`, ask ? r : nxt, {
    traps: ask ? [{ value: Tq / Tp, why: `The two terms are $${gap}$ steps apart, so $\\dfrac{T_${qi}}{T_${p}} = r^{${gap}}$ — take the ${gap === 1 ? 'first' : 'third'} root.` }, { value: Tq - Tp, why: 'A geometric sequence multiplies by $r$ each step; divide the terms rather than subtracting.' }].filter(t => gap !== 1 || t.value !== r)
      : [{ value: Tq + (Tq - Tp), why: 'That treats the sequence as arithmetic. A geometric sequence **multiplies** by $r$.' }, { value: Tq * Tq / Tp, why: `Check the ratio: $r^{${gap}} = \\dfrac{${Tq}}{${Tp}}$, then multiply $T_${qi}$ by $r$ once.` }].filter(t => t.value !== nxt),
    hints: [`$\\dfrac{T_${qi}}{T_${p}} = r^{${gap}}$.`, `$\\dfrac{${Tq}}{${Tp}} = ${Tq / Tp}$.`, gap === 1 ? 'So $r$ is that ratio.' : `Take the cube root: $r = ${r}$.`],
    steps: [{ h: 'Ratio of terms', d: `$r^{${gap}} = \\dfrac{${Tq}}{${Tp}} = ${Tq / Tp}$` }, { h: 'Common ratio', d: `$r = ${r}$` }, ask ? { h: 'Answer', d: `$r = ${r}$` } : { h: 'Next term', d: `$T_{${qi + 1}} = ${Tq} \\times ${r < 0 ? `(${r})` : r} = ${nxt}$` }]
  });
  return [q, { kind: 'num', value: ask ? Math.cbrt(Tq / Tp) ** 1 * 0 + (gap === 1 ? Tq / Tp : Math.cbrt(Tq / Tp)) : Tq * (gap === 1 ? Tq / Tp : Math.cbrt(Tq / Tp)), tolOverride: 1e-9 }];
}));

// How many terms to reach a given arithmetic sum
seriesForms.push(V('series-ap-find-n', [2, 3, 4], (rng) => {
  const a = ri(rng, 1, 15), d = ri(rng, 1, 9), n = ri(rng, 5, 30);
  const S = n * (2 * a + (n - 1) * d) / 2;
  const q = numQ(`The arithmetic series $${a} + ${a + d} + ${a + 2 * d} + \\cdots$ is added term by term. How many terms are needed for the sum to reach exactly $${S}$?`, n, {
    prefix: 'n =',
    traps: [{ value: Math.round(S / (a + (n - 1) * d)), why: 'The sum is $\\dfrac{n}{2}\\big(2a + (n-1)d\\big)$ — solve that equation for $n$ rather than dividing by a single term.' }, { value: S - a, why: 'That is not a number of terms — substitute into $S_n$ and solve the quadratic in $n$.' }].filter(t => t.value !== n && fin(t.value)),
    hints: ['$S_n = \\dfrac{n}{2}\\big(2a + (n-1)d\\big)$.', `$a = ${a}$, $d = ${d}$: $\\dfrac{n}{2}\\big(${2 * a} + ${d}(n-1)\\big) = ${S}$.`, `Expand to a quadratic in $n$, then factorise; reject the negative root.`],
    steps: [{ h: 'Sum formula', d: `$\\dfrac{n}{2}\\big(${2 * a} + ${d}(n-1)\\big) = ${S}$` }, { h: 'Quadratic', d: `$${d}n^2 + ${2 * a - d}n - ${2 * S} = 0$` }, { h: 'Positive root', d: `$n = ${n}$` }]
  });
  let s = 0, k = 0; while (s < S) { k++; s += a + (k - 1) * d; }
  return [q, { kind: 'num', value: s === S ? k : NaN }];
}));

// Geometric sums
seriesForms.push(V('series-gp-sum-n', [2, 3, 4], (rng) => {
  const a = ri(rng, 1, 7), r = rc(rng, [2, 3, 4, 5, -2, -3]), n = ri(rng, 4, r > 3 ? 7 : 9);
  const S = a * (r ** n - 1) / (r - 1);
  const lead = `$${a} ${a * r < 0 ? '-' : '+'} ${Math.abs(a * r)} ${a * r * r < 0 ? '-' : '+'} ${Math.abs(a * r * r)} ${a * r ** 3 < 0 ? '-' : '+'} ${Math.abs(a * r ** 3)} + \\cdots$`;
  const q = numQ(`Find the sum of the first $${n}$ terms of the geometric series ${lead}`, S, {
    traps: [{ value: a * (r ** n - 1) / (r - 1) + a * r ** n, why: `The sum of $${n}$ terms stops at $T_{${n}} = ar^{${n - 1}}$; $r^{${n}}$ belongs in the formula only through $r^n - 1$.` }, { value: a * (r ** (n - 1) - 1) / (r - 1), why: `The sum formula uses $r^{n}$ with $n = ${n}$, not $n - 1$.` }].filter(t => t.value !== S),
    hints: ['$S_n = \\dfrac{a(r^n - 1)}{r - 1}$.', `$a = ${a}$, $r = ${r}$, $n = ${n}$.`, `$r^{${n}} = ${r ** n}$.`],
    steps: [{ h: 'Ratio', d: `$r = ${r}$` }, { h: 'Formula', d: `$S_{${n}} = \\dfrac{${a}\\big((${r})^{${n}} - 1\\big)}{${r} - 1}$` }, { h: 'Evaluate', d: `$S_{${n}} = \\dfrac{${a}(${r ** n - 1})}{${r - 1}} = ${S}$` }]
  });
  let s = 0, t = a; for (let i = 0; i < n; i++) { s += t; t *= r; }
  return [q, { kind: 'num', value: s }];
}));

// Context: arithmetic and geometric growth
seriesForms.push(V('series-context', [1, 2, 3, 4], (rng) => {
  const kind = ri(rng, 1, 4);
  if (kind === 1) {
    const a = ri(rng, 5, 40), d = ri(rng, 2, 15), n = ri(rng, 8, 30);
    const S = n * (2 * a + (n - 1) * d) / 2;
    const q = numQ(`Aarav starts saving for a surfboard. He puts ${D(a)} into his account in week 1 and increases the amount by ${D(d)} each week. How much has he saved in total after $${n}$ weeks?`, S, {
      prefix: '$',
      traps: [{ value: a + (n - 1) * d, why: `That is what he saves in week $${n}$ alone. The total is the **sum** of all $${n}$ deposits.` }, { value: n * a + n * d, why: 'The deposits grow each week, so use $S_n = \\dfrac{n}{2}\\big(2a + (n-1)d\\big)$.' }].filter(t => t.value !== S),
      hints: ['Weekly deposits form an arithmetic sequence.', `$a = ${a}$, $d = ${d}$, $n = ${n}$.`, '$S_n = \\dfrac{n}{2}\\big(2a + (n-1)d\\big)$.'],
      steps: [{ h: 'Identify', d: `$a = ${a}$, $d = ${d}$, $n = ${n}$` }, { h: 'Sum formula', d: `$S_{${n}} = \\dfrac{${n}}{2}\\big(${2 * a} + ${n - 1}\\times ${d}\\big)$` }, { h: 'Total', d: `${D(S)}` }]
    });
    return [q, { kind: 'num', value: termList(a, d, n).reduce((x, y) => x + y, 0) }];
  }
  if (kind === 2) {
    const a = ri(rng, 10, 30), d = ri(rng, 2, 6), n = ri(rng, 10, 25);
    const S = n * (2 * a + (n - 1) * d) / 2;
    const q = numQ(`A grandstand has $${a}$ seats in the front row and each row behind has $${d}$ more seats than the row in front. How many seats are there in total in the first $${n}$ rows?`, S, {
      traps: [{ value: n * (a + (n - 1) * d), why: 'The rows have different numbers of seats: use the **average** of the first and last rows, $\\dfrac{n}{2}(a + l)$.' }, { value: a + (n - 1) * d, why: `That is the number of seats in row $${n}$ only.` }].filter(t => t.value !== S),
      hints: ['The seats per row form an arithmetic sequence.', `Last row: $${a} + ${n - 1}\\times ${d} = ${a + (n - 1) * d}$.`, '$S_n = \\dfrac{n}{2}(a + l)$.'],
      steps: [{ h: 'Last row', d: `$l = ${a} + ${n - 1}(${d}) = ${a + (n - 1) * d}$` }, { h: 'Sum', d: `$S_{${n}} = \\dfrac{${n}}{2}(${a} + ${a + (n - 1) * d})$` }, { h: 'Total', d: `$${S}$ seats` }]
    });
    return [q, { kind: 'num', value: termList(a, d, n).reduce((x, y) => x + y, 0) }];
  }
  if (kind === 3) {
    const a = ri(rng, 2, 12), r = rc(rng, [2, 3]), n = ri(rng, 4, 8);
    const S = a * (r ** n - 1) / (r - 1);
    const q = numQ(`A club's video is watched by $${a}$ people on day 1. Each day the number of viewers is ${r === 2 ? 'double' : 'triple'} the number on the previous day. How many views has the video had in total at the end of day $${n}$?`, S, {
      traps: [{ value: a * r ** (n - 1), why: `That is the number of views on day $${n}$ only — the question asks for the running total.` }, { value: a * (r ** n - 1), why: 'Divide by $r - 1$ in $S_n = \\dfrac{a(r^n - 1)}{r - 1}$.' }].filter(t => t.value !== S && (r !== 2 || true)),
      hints: ['Daily views form a geometric sequence.', `$a = ${a}$, $r = ${r}$, $n = ${n}$.`, '$S_n = \\dfrac{a(r^n - 1)}{r - 1}$.'],
      steps: [{ h: 'Identify', d: `$a = ${a}$, $r = ${r}$, $n = ${n}$` }, { h: 'Formula', d: `$S_{${n}} = \\dfrac{${a}(${r}^{${n}} - 1)}{${r} - 1}$` }, { h: 'Evaluate', d: `$${S}$ views` }]
    });
    let s = 0, t = a; for (let i = 0; i < n; i++) { s += t; t *= r; }
    return [q, { kind: 'num', value: s }];
  }
  // bouncing ball: total distance
  const rr = rc(rng, [[1, 2], [1, 3], [2, 3], [3, 4], [3, 5], [4, 5], [2, 5]]);
  const [rn, rd] = rr;
  const h = (rd - rn) * ri(rng, 1, 4) * rc(rng, [1, 2, 3]);
  const total = new Frac(h * (rd + rn), rd - rn);
  const ball = rc(rng, ['A cricket ball', 'A netball', 'A tennis ball']);
  const q = numQ(`${ball} is dropped from a height of $${h}$ m onto a hard floor. After each bounce it rises to $\\dfrac{${rn}}{${rd}}$ of the height it fell from. Find the **total distance** the ball travels before it comes to rest.`, total.value, {
    suffix: 'm',
    traps: [{ value: new Frac(h * rd, rd - rn).value, why: 'That counts only the distance **falling**. After the first drop, the ball also travels the same distance **upwards** after each bounce.' }, { value: new Frac(2 * h * rn, rd - rn).value, why: 'The first drop of $' + h + '$ m has no matching upward leg — add it separately.' }, { value: h + new Frac(h * rn, rd - rn).value, why: 'Each rebound includes an upward **and** a downward leg: double the limiting sum of the rebounds.' }].filter(t => Math.abs(t.value - total.value) > 1e-9),
    hints: [`After the first drop of $${h}$ m, each bounce adds an up leg and a down leg of the same length.`, `Rebound heights form a geometric series with $a = ${new Frac(h * rn, rd).latex()}$ and $r = \\dfrac{${rn}}{${rd}}$.`, `Total $= ${h} + 2\\times\\dfrac{a}{1 - r}$.`],
    steps: [{ h: 'First drop', d: `$${h}$ m` }, { h: 'Rebounds (up and down)', d: `$2\\times\\dfrac{${new Frac(h * rn, rd).latex()}}{1 - \\frac{${rn}}{${rd}}} = ${new Frac(2 * h * rn, rd - rn).latex()}$` }, { h: 'Total', d: `$${h} + ${new Frac(2 * h * rn, rd - rn).latex()} = ${total.latex()}$ m` }]
  });
  q.answer.tol = 0.0005;
  if (total.d !== 1) q.inputHint = 'a decimal or fraction';
  let dist = h, up = h * rn / rd;
  for (let i = 0; i < 4000; i++) { dist += 2 * up; up *= rn / rd; }
  return [q, { kind: 'num', value: dist, tolOverride: 1e-6 }];
}));

// Limiting-sum conditions
seriesForms.push(V('series-limit-conditions', [3, 4], (rng) => {
  const kind = ri(rng, 1, 3);
  if (kind === 1) {
    const p = ri(rng, 3, 15);
    const q = numQ(`The geometric series $1 + \\dfrac{x}{${p}} + \\dfrac{x^2}{${p * p}} + \\cdots$ has a limiting sum. What is the largest **integer** value of $x$ for which this is true?`, p - 1, {
      traps: [{ value: p, why: `A limiting sum needs $|r| < 1$ with a strict inequality: $|x| < ${p}$ excludes $x = ${p}$.` }, { value: 1, why: `The common ratio is $\\dfrac{x}{${p}}$, so the condition is $\\left|\\dfrac{x}{${p}}\\right| < 1$.` }],
      hints: [`The common ratio is $r = \\dfrac{x}{${p}}$.`, `A limiting sum exists when $|r| < 1$, so $|x| < ${p}$.`, 'The largest integer **strictly** less than the bound.'],
      steps: [{ h: 'Ratio', d: `$r = \\dfrac{x}{${p}}$` }, { h: 'Condition', d: `$\\left|\\dfrac{x}{${p}}\\right| < 1 \\Rightarrow -${p} < x < ${p}$` }, { h: 'Largest integer', d: `$x = ${p - 1}$` }]
    });
    let best = null; for (let x = -50; x <= 50; x++) if (Math.abs(x / p) < 1) best = x;
    return [q, { kind: 'num', value: best }];
  }
  if (kind === 2) {
    const [rn, rd] = rc(rng, [[1, 2], [1, 3], [2, 3], [1, 4], [3, 4], [1, 5], [2, 5], [3, 5]]);
    const neg = rng() < 0.4;
    const den = neg ? rd + rn : rd - rn;
    const c0 = ri(rng, 1, 6);
    const a = den * c0, S = rd * c0;
    const rv = new Frac(neg ? -rn : rn, rd);
    const q = fracQ(`The first term of a geometric series is $${a}$ and its limiting sum is $${S}$. Find the common ratio.`, rv, {
      prefix: 'r =',
      traps: [{ value: a / S, why: `$S_\\infty = \\dfrac{a}{1 - r}$, so $1 - r = \\dfrac{a}{S}$ — then solve for $r$.` }, { value: new Frac(S - a, S).mul(new Frac(-1)).value, why: 'Check the sign: $r = 1 - \\dfrac{a}{S}$.' }].filter(t => Math.abs(t.value - rv.value) > 1e-9),
      hints: ['$S_\\infty = \\dfrac{a}{1 - r}$.', `$${S} = \\dfrac{${a}}{1 - r}$.`, `$1 - r = \\dfrac{${a}}{${S}}$.`],
      steps: [{ h: 'Limiting sum', d: `$\\dfrac{${a}}{1 - r} = ${S}$` }, { h: 'Rearrange', d: `$1 - r = \\dfrac{${a}}{${S}} = ${new Frac(a, S).latex()}$` }, { h: 'Solve', d: `$r = ${rv.latex()}$` }]
    });
    return [q, { kind: 'num', value: 1 - a / S }];
  }
  const [rn, rd] = rc(rng, [[1, 2], [1, 3], [2, 3], [1, 4], [3, 4], [1, 5]]);
  const c0 = ri(rng, 1, 5), a = rd * rd * c0;
  const q = fracQ(`Find the limiting sum of the geometric series $${a} + ${a * rn / rd} + ${a * rn * rn / (rd * rd)} + \\cdots$, given that each term is $\\dfrac{${rn}}{${rd}}$ of the one before.`, new Frac(a * rd, rd - rn), {
    traps: [{ value: a / (rn / rd), why: '$S_\\infty = \\dfrac{a}{1 - r}$ — divide by $1 - r$, not by $r$.' }, { value: new Frac(a * rd, rd + rn).value, why: 'The denominator is $1 - r$; subtract.' }],
    hints: ['$S_\\infty = \\dfrac{a}{1 - r}$.', `$r = \\dfrac{${rn}}{${rd}}$ has $|r| < 1$.`, `$1 - r = ${new Frac(rd - rn, rd).latex()}$.`],
    steps: [{ h: 'Check', d: `$|r| = \\dfrac{${rn}}{${rd}} < 1$` }, { h: 'Formula', d: `$S_\\infty = \\dfrac{${a}}{${new Frac(rd - rn, rd).latex()}}$` }, { h: 'Evaluate', d: `$${new Frac(a * rd, rd - rn).latex()}$` }] });
  let s = 0, t = a; for (let i = 0; i < 4000; i++) { s += t; t *= rn / rd; }
  return [q, { kind: 'num', value: s, tolOverride: 1e-6 }];
}));

// Recurring decimals as limiting sums
seriesForms.push(V('series-recurring-decimal', [3, 4], (rng) => {
  let d1, d2;
  do { d1 = ri(rng, 0, 9); d2 = ri(rng, 0, 9); } while (d1 === d2 || (d1 === 0 && d2 === 0));
  const three = rng() < 0.4;
  let d3 = 0; if (three) { do { d3 = ri(rng, 0, 9); } while (d3 === d1 && d3 === d2); }
  const digits = three ? [d1, d2, d3] : [d1, d2];
  const num = digits.reduce((s, x) => s * 10 + x, 0), den = three ? 999 : 99;
  const f = new Frac(num, den);
  const dots = three ? `\\dot{${d1}}${d2}\\dot{${d3}}` : `\\dot{${d1}}\\dot{${d2}}`;
  const q = fracQ(`Write the recurring decimal $0.${dots}$ as a limiting sum of a geometric series, and hence as a fraction in simplest form.`, f, {
    traps: [{ value: num / (three ? 1000 : 100), why: 'The decimal repeats forever — the limiting sum adds an infinite number of terms.' }, { value: new Frac(num, den + 1).value, why: `With first term $\\dfrac{${num}}{${den + 1}}$ and ratio $\\dfrac{1}{${den + 1}}$, the sum is $\\dfrac{a}{1 - r}$.` }].filter(t => Math.abs(t.value - f.value) > 1e-9),
    hints: [`$0.${dots} = \\dfrac{${num}}{${three ? 1000 : 100}} + \\dfrac{${num}}{${three ? '1000^2' : '100^2'}} + \\cdots$.`, `First term $a = \\dfrac{${num}}{${three ? 1000 : 100}}$ and ratio $r = \\dfrac{1}{${three ? 1000 : 100}}$.`, '$S_\\infty = \\dfrac{a}{1 - r}$; simplify the fraction.'],
    steps: [{ h: 'Geometric series', d: `$a = \\dfrac{${num}}{${three ? 1000 : 100}}$, $r = \\dfrac{1}{${three ? 1000 : 100}}$` }, { h: 'Limiting sum', d: `$S_\\infty = \\dfrac{${num}/${three ? 1000 : 100}}{1 - 1/${three ? 1000 : 100}} = \\dfrac{${num}}{${den}}$` }, { h: 'Simplify', d: `$${f.latex()}$` }]
  });
  const blk = three ? 1000 : 100; let s = 0, t = num / blk; for (let i = 0; i < 400; i++) { s += t; t /= blk; }
  return [q, { kind: 'num', value: s, tolOverride: 1e-9 }];
}));

// Sigma notation
seriesForms.push(V('series-sigma', [2, 3, 4], (rng) => {
  if (rng() < 0.5) {
    const al = nz(rng, -5, 9), be = nz(rng, -9, 12), n = ri(rng, 6, 25);
    const val = al * n * (n + 1) / 2 + be * n;
    const q = numQ(`Evaluate $\\displaystyle\\sum_{k=1}^{${n}} \\left(${cf(al)}k ${be < 0 ? '-' : '+'} ${Math.abs(be)}\\right)$.`, val, {
      traps: [{ value: al * n * (n + 1) / 2 + be, why: `The constant $${be}$ is added $${n}$ times — once for each term.` }, { value: al * n * (n + 1) + be * n, why: '$\\sum k = \\dfrac{n(n+1)}{2}$ — the factor of $\\tfrac12$ matters.' }].filter(t => t.value !== val),
      hints: [`Split the sum: $${al}\\sum k + ${be}\\sum 1$.`, `$\\sum_{k=1}^{${n}} k = \\dfrac{${n}\\times ${n + 1}}{2} = ${n * (n + 1) / 2}$ and $\\sum 1 = ${n}$.`, 'Combine.'],
      steps: [{ h: 'Split', d: `$${al}\\sum k + ${be}\\sum 1$` }, { h: 'Standard sums', d: `$\\sum k = ${n * (n + 1) / 2}$, $\\sum 1 = ${n}$` }, { h: 'Total', d: `$${al}(${n * (n + 1) / 2}) + ${be}(${n}) = ${val}$` }]
    });
    let s = 0; for (let k = 1; k <= n; k++) s += al * k + be;
    return [q, { kind: 'num', value: s }];
  }
  const A = ri(rng, 1, 9), r = rc(rng, [2, 3]), n = ri(rng, 3, 8);
  const val = A * r * (r ** n - 1) / (r - 1);
  const q = numQ(`Evaluate $\\displaystyle\\sum_{k=1}^{${n}} ${A === 1 ? '' : `${A}\\cdot `}${r}^{k}$.`, val, {
    traps: [{ value: A * (r ** n - 1) / (r - 1), why: `The first term is $${A}\\cdot ${r}^1 = ${A * r}$ (not $${A}$) — the series starts at $k = 1$.` }, { value: A * r * (r ** (n + 1) - 1) / (r - 1), why: `There are exactly $${n}$ terms, from $k = 1$ to $k = ${n}$.` }].filter(t => t.value !== val),
    hints: [`Write out the first terms: $${A * r} + ${A * r * r} + \\cdots$.`, `This is geometric with $a = ${A * r}$, $r = ${r}$ and $${n}$ terms.`, '$S_n = \\dfrac{a(r^n - 1)}{r - 1}$.'],
    steps: [{ h: 'First term and ratio', d: `$a = ${A * r}$, $r = ${r}$, $n = ${n}$` }, { h: 'Formula', d: `$S_{${n}} = \\dfrac{${A * r}(${r}^{${n}} - 1)}{${r} - 1}$` }, { h: 'Evaluate', d: `$${val}$` }]
  });
  let s = 0; for (let k = 1; k <= n; k++) s += A * r ** k;
  return [q, { kind: 'num', value: s }];
}));

// MCQ: which geometric series has a limiting sum
const seriesTex = (a, rn, rd) => {
  const terms = [a, a * rn / rd, a * rn * rn / (rd * rd)];
  return `$${terms.map((t, i) => (i === 0 ? `${t}` : t < 0 ? `- ${Math.abs(t)}` : `+ ${t}`)).join(' ')} + \\cdots$`;
};
seriesForms.push(V('series-mcq-limit', [2, 3, 4], (rng) => {
  const goodR = rc(rng, [[1, 2], [1, 3], [2, 3], [3, 4], [-1, 2], [-1, 3], [-2, 3], [-3, 4]]);
  const bads = [[2, 1], [3, 1], [-2, 1], [-3, 1], [3, 2], [-3, 2], [4, 3], [1, 1], [-1, 1]];
  const picks = [];
  const pool = bads.slice();
  while (picks.length < 3) picks.push(pool.splice(Math.floor(rng() * pool.length), 1)[0]);
  const mkA = ([n, d]) => d * d * ri(rng, 1, 3);
  const good = seriesTex(mkA(goodR), goodR[0], goodR[1]);
  const why = ([n, d]) => (Math.abs(n) === d ? `The common ratio has $|r| = 1$ — the terms do not get smaller, so there is no limiting sum.` : n < 0 ? `The common ratio is $${new Frac(n, d).latex()}$ — negative, but $|r| > 1$, so the terms grow and there is no limiting sum.` : `The common ratio is $${new Frac(n, d).latex()}$ which is greater than $1$, so the terms grow.`);
  const q = mcQ(rng, 'Which of these geometric series has a limiting sum?', good, picks.map(p => ({ text: seriesTex(mkA(p), p[0], p[1]), why: why(p) })),
    ['A limiting sum exists only when $|r| < 1$.', 'Find the common ratio of each series by dividing a term by the one before.', 'A negative ratio is fine as long as $|r| < 1$.'],
    [{ h: 'Condition', d: '$|r| < 1$' }, { h: 'Ratios', d: 'Divide each second term by the first' }, { h: 'Answer', d: `The series with $r = ${new Frac(goodR[0], goodR[1]).latex()}$` }]);
  return [q, { kind: 'mcq' }];
}));

// Show that: S_n given -> T_k, or the common difference
seriesForms.push(V('series-show-tn', [2, 3, 4], (rng) => {
  const al = nz(rng, -5, 7), be = nz(rng, -9, 12), k = ri(rng, 4, 20);
  const Sn = n => al * n * n + be * n;
  const poly2 = `${cf(al)}n^2 ${be < 0 ? '-' : '+'} ${Math.abs(be) === 1 ? '' : Math.abs(be)}n`;
  if (rng() < 0.6) {
    const val = Sn(k) - Sn(k - 1);
    const q = numQ(`The sum of the first $n$ terms of a series is $S_n = ${poly2}$. Show that $T_n = S_n - S_{n-1}$ and use it to find $T_{${k}}$.`, val, {
      traps: [{ value: Sn(k), why: `$S_{${k}}$ is the sum of the first $${k}$ terms. The term itself is the difference $S_{${k}} - S_{${k - 1}}$.` }, { value: Sn(k) - Sn(k - 2), why: `$T_{${k}} = S_{${k}} - S_{${k - 1}}$ — subtract the sum of the **previous** terms (one fewer).` }],
      hints: [`$T_n = S_n - S_{n-1}$.`, `$S_{${k}} = ${Sn(k)}$ and $S_{${k - 1}} = ${Sn(k - 1)}$.`, 'Subtract.'],
      steps: [{ h: 'Term as a difference', d: `$T_{${k}} = S_{${k}} - S_{${k - 1}}$` }, { h: 'Evaluate each sum', d: `$S_{${k}} = ${Sn(k)}$, $S_{${k - 1}} = ${Sn(k - 1)}$` }, { h: 'Subtract', d: `$T_{${k}} = ${val}$` }]
    });
    return [q, { kind: 'num', value: val, sCheck: [al, be, k] }];
  }
  const dd = 2 * al;
  const q = numQ(`The sum of the first $n$ terms of an arithmetic series is $S_n = ${poly2}$. Show that $T_n = S_n - S_{n-1}$ and use it to find the common difference.`, dd, {
    prefix: 'd =',
    traps: [{ value: al, why: `$T_n = S_n - S_{n-1} = ${2 * al}n ${sgn1(be - al)}$, so the common difference is the coefficient of $n$: $${2 * al}$.` }, { value: be, why: 'The common difference is the **change** in $T_n$ per step, i.e. the coefficient of $n$ in $T_n$.' }],
    hints: [`$T_n = S_n - S_{n-1}$ with $S_{n-1} = ${al}(n-1)^2 ${be < 0 ? '-' : '+'} ${Math.abs(be)}(n-1)$.`, `Expand: $T_n = ${2 * al}n ${sgn1(be - al)}$.`, '$d = T_{n+1} - T_n$ — the coefficient of $n$.'],
    steps: [{ h: 'Difference of sums', d: `$T_n = S_n - S_{n-1} = ${2 * al}n ${sgn1(be - al)}$` }, { h: 'Check it is linear in $n$', d: 'So the series is arithmetic' }, { h: 'Common difference', d: `$d = ${dd}$` }]
  });
  return [q, { kind: 'num', value: (Sn(5) - Sn(4)) - (Sn(4) - Sn(3)) }];
}));
function sgn1(v) { return v < 0 ? `- ${-v}` : `+ ${v}`; }

// Three expressions in k are consecutive terms of an arithmetic sequence
seriesForms.push(V('series-ap-find-k', [2, 3, 4], (rng) => {
  for (let t = 0; t < 300; t++) {
    const k0 = nz(rng, -6, 9), a1 = nz(rng, -4, 6), a2 = nz(rng, -4, 6), a3 = nz(rng, -4, 6);
    const E = 2 * a2 - a1 - a3;
    if (E === 0) continue;
    const b1 = ri(rng, -9, 9), b2 = ri(rng, -9, 9), b3 = 2 * b2 - b1 + E * k0;
    if (Math.abs(b3) > 40) continue;
    const ex1 = lin(a1, b1, 'k'), ex2 = lin(a2, b2, 'k'), ex3 = lin(a3, b3, 'k');
    const q = numQ(`The expressions $${ex1}$, $${ex2}$ and $${ex3}$ are three consecutive terms of an arithmetic sequence. Find the value of $k$.`, k0, {
      prefix: 'k =',
      traps: [{ value: -k0, why: 'Check the signs when you collect the $k$ terms on one side.' }, { value: (b1 + b3 - 2 * b2) / E * 0 + (2 * b2 - b1 - b3) / E, why: 'In an arithmetic sequence $2T_2 = T_1 + T_3$ — make sure you subtract the constants in the right order.' }].filter(t => t.value !== k0 && fin(t.value)),
      hints: ['In an arithmetic sequence consecutive differences are equal, so $T_2 - T_1 = T_3 - T_2$ (or $2T_2 = T_1 + T_3$).', `$2(${ex2}) = (${ex1}) + (${ex3})$.`, 'Collect the $k$ terms and solve the linear equation.'],
      steps: [{ h: 'Equal differences', d: `$2(${ex2}) = (${ex1}) + (${ex3})$` }, { h: 'Expand and collect', d: `$${2 * a2}k ${sgn1(2 * b2)} = ${a1 + a3}k ${sgn1(b1 + b3)}$` }, { h: 'Solve', d: `$k = ${k0}$` }]
    });
    const T = k => [a1 * k + b1, a2 * k + b2, a3 * k + b3];
    const tt = T(k0);
    return [q, { kind: 'num', value: tt[1] - tt[0] === tt[2] - tt[1] ? k0 : NaN }];
  }
  throw new Error('no case');
}));

export const forms = {
  'y12-trigcalc': trigForms,
  'y12-explogcalc': expForms,
  'y12-motion': motionForms,
  // D3 of y12-series is an excluded cell (nswBanks.js): keep the variants off it so the exclusion record stays true.
  'y12-series': seriesForms.map(v => ({ ...v, diffs: (v.diffs || [1, 2, 3, 4]).filter(d => d !== 3) }))
};
