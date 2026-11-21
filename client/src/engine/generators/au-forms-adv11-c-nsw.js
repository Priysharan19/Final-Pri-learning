// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Prithagoras variety overlay · Advanced Year 11 (slot adv11-c)
//   y11-explog-more   logarithm laws, exponential equations, logarithms as inverse functions
//   y11-trig-ident    Pythagorean identity, solving trigonometric equations, counting solutions
// Each form asks the student to make a different DECISION (which law, which method, which quantity,
// which solutions to keep), not to read different numbers. Every key is computed in code from the
// numbers the prompt shows; the AI never sets a key. Original wording. SYNTHETIC: no student or
// examiner evidence. The difficulty each form serves is the writer's own assessment
// (docs/content/advanced-form-decisions-2026-11-22.md), not reviewed by a teacher.
// ─────────────────────────────────────────────────────────────────────────────
import { ri, rc, nz, rs, gcd, mcq } from '../qhelpers.js';

// Builders: every key is computed in code from the numbers the prompt shows. A form's `audit` (kind + raw
// parameters) is attached as a NON-ENUMERABLE property, so it is never spread into a served question;
// client/test/adv-variety-forms-check.mjs reads it to recompute each answer by a different route.
const REJ = Symbol('reject');

const rej = cond => { if (cond) throw REJ; };

/** One variant: re-draw from the same rng (so still deterministic) until the numbers are acceptable. */
const V = (diffs, fn) => ({
  diffs,
  make: (rng, diff) => {
    for (let i = 0; i < 400; i++) {
      try { return fn(rng, diff); } catch (e) { if (e !== REJ) throw e; }
    }
    throw new Error('advanced variety form: no acceptable draw');
  }
});

const fin = v => typeof v === 'number' && Number.isFinite(v);

function attach(q, audit) {
  if (audit) Object.defineProperty(q, '__audit', { value: audit, enumerable: false });
  return q;
}

const cleanTraps = (traps, value, band) => {
  const keep = [value], out = [];
  for (const [v, why] of traps || []) {
    if (!fin(v) || keep.some(k => Math.abs(k - v) <= band + 1e-9)) continue;
    keep.push(v);
    out.push({ value: v, why, ...(band > 0 ? { tol: band } : {}) });
  }
  return out;
};

const steps4 = a => (a || []).map(([h, d]) => ({ h, d }));

/** numeric key. o: { hints[4], steps[[h,d]], traps[[value, why]], tol, suffix, prefix, frac:{n,d}, audit } */
function N(prompt, value, o) {
  rej(!fin(value));
  const answer = { value };
  if (o.tol != null) answer.tol = o.tol;
  if (o.frac && o.frac.d !== 1) answer.simplestFraction = { n: o.frac.n, d: o.frac.d };
  const q = { prompt, answerType: 'numeric', answer, traps: cleanTraps(o.traps, value, o.tol || 0), hints: o.hints, steps: steps4(o.steps) };
  if (o.suffix) q.answerSuffix = o.suffix;
  if (o.prefix) q.answerPrefix = o.prefix;
  if (o.dotpoint != null) q.dotpoint = o.dotpoint;
  if (o.figure) q.figure = o.figure;
  return attach(q, o.audit);
}

/** an exact rational n/d (reduced here). */
function Fr(prompt, n, d, o) {
  const g = gcd(n, d) || 1;
  const nn = n / g, dd = d / g;
  const sg = dd < 0 ? -1 : 1;
  return N(prompt, n / d, { ...o, frac: { n: sg * nn, d: sg * dd } });
}

/** a set of values (any order). */
function S(prompt, values, o) {
  const traps = (o.traps || []).filter(([v]) => fin(v) && !values.some(x => Math.abs(x - v) < 1e-9)).map(([v, why]) => ({ value: v, why }));
  const q = { prompt, answerType: 'set', answer: { values }, traps, hints: o.hints, steps: steps4(o.steps) };
  if (o.suffix) q.answerSuffix = o.suffix;
  if (o.dotpoint != null) q.dotpoint = o.dotpoint;
  if (o.figure) q.figure = o.figure;
  return attach(q, o.audit);
}

/** an expression key; traps are [expr, why]. */
function E(prompt, expr, o) {
  const answer = { expr };
  if (o.stripC) answer.stripC = true;
  const q = { prompt, answerType: 'expression', answer, traps: (o.traps || []).filter(([e]) => e !== expr).map(([e, why]) => ({ expr: e, why })), hints: o.hints, steps: steps4(o.steps) };
  if (o.dotpoint != null) q.dotpoint = o.dotpoint;
  if (o.figure) q.figure = o.figure;
  return attach(q, o.audit);
}

/** multiple choice: correct text and distractors [{text, why}]. */
function M(rng, prompt, correct, ds, o) {
  const m = mcq(rng, correct, ds);
  const q = { prompt, answerType: 'mcq', answer: { correctIndex: m.correctIndex, optionTraps: m.optionTraps }, mcqOptions: m.options, hints: o.hints, steps: steps4(o.steps) };
  if (o.dotpoint != null) q.dotpoint = o.dotpoint;
  if (o.figure) q.figure = o.figure;
  return attach(q, o.audit);
}

/** Signed term for a constant: sg(3) = "+ 3", sg(-3) = "- 3". */
const sg = c => (c >= 0 ? `+ ${c}` : `- ${Math.abs(c)}`);

/** LaTeX for a reduced fraction. */
const fr = (n, d) => {
  const g = gcd(n, d) || 1;
  let a = n / g, b = d / g;
  if (b < 0) { a = -a; b = -b; }
  return b === 1 ? String(a) : `${a < 0 ? '-' : ''}\\dfrac{${Math.abs(a)}}{${b}}`;
};

/** Decimal places check: is v within `eps` of a rounding boundary at `places`? (avoid ambiguous keys). */
const nearBoundary = (v, places, eps = 0.06) => {
  const s = v * 10 ** places;
  return Math.abs(s - Math.floor(s) - 0.5) < eps;
};

const rnd = (v, places) => Math.round(v * 10 ** places) / 10 ** places;

const lg = (b, x) => Math.log(x) / Math.log(b);
const pw = (v, e) => (e === 1 ? v : `${v}^{${e}}`);
const gcdI = (a, b) => { a = Math.abs(a); b = Math.abs(b); while (b) [a, b] = [b, a % b]; return a || 1; };
const isPowerOf = (b, n) => { while (n > 1 && n % b === 0) n /= b; return n === 1; };

// ── y11-explog-more ──────────────────────────────────────────────────────────
const explog = [
  // E1 · D1, D2 · which single logarithm equals this combination? (spot which law applies)
  V([1, 2], (rng, d) => {
    const b = rc(rng, ['2', '3', '5', '10', 'a']);
    const letters = rc(rng, [['x', 'y', 'z'], ['a', 'b', 'c'], ['p', 'q', 'r'], ['m', 'n', 'k']]);
    const base = b === 'a' && letters[0] === 'a' ? 'k' : b;
    const nt = d === 1 ? 2 : 3;
    const items = [];
    for (let i = 0; i < nt; i++) {
      const c = i === 0 ? ri(rng, 1, 3) : (rng() < 0.5 ? -1 : 1) * ri(rng, 1, 3);
      items.push({ v: letters[i], c });
    }
    rej(!items.some(t => Math.abs(t.c) > 1));
    rej(d === 2 && !items.some(t => t.c < 0));
    rej(d === 1 && !items.some(t => t.c < 0) && rng() < 0.5);
    const argTex = its => {
      const top = its.filter(t => t.c > 0), bot = its.filter(t => t.c < 0);
      const f = arr => arr.map(t => pw(t.v, Math.abs(t.c))).join('');
      return bot.length ? `\\dfrac{${top.length ? f(top) : '1'}}{${f(bot)}}` : f(top);
    };
    const expr = items.map((t, i) => `${i === 0 ? '' : (t.c < 0 ? '- ' : '+ ')}${Math.abs(t.c) === 1 ? '' : Math.abs(t.c)}\\log_{${base}} ${t.v}`).join(' ');
    const key = `$\\log_{${base}} ${argTex(items)}$`;
    const flipLast = items.map((t, i) => (i === items.length - 1 ? { ...t, c: -t.c } : t));
    const facTxt = t => `${Math.abs(t.c) === 1 ? '' : Math.abs(t.c)}${t.v}`;
    const factorArg = () => {
      const top = items.filter(t => t.c > 0).map(facTxt).join('\\cdot '), bot = items.filter(t => t.c < 0).map(facTxt).join('\\cdot ');
      return bot ? `\\dfrac{${top}}{${bot}}` : top;
    };
    const allTop = items.map(t => ({ ...t, c: Math.abs(t.c) }));
    return M(rng, `Which expression is equal to $${expr}$?`, key, [
      { text: `$\\log_{${base}} ${factorArg()}$`, why: 'A coefficient is a power inside the logarithm ($n\\log x = \\log x^n$), not a multiplier of the variable.' },
      { text: `$\\log_{${base}} ${argTex(flipLast)}$`, why: 'A subtracted logarithm divides (it goes below the line); an added one multiplies.' },
      { text: `$\\log_{${base}} ${argTex(allTop)}$`, why: 'Only added terms multiply. A subtracted logarithm becomes a quotient.' }
    ], {
      hints: ['Apply the power law first: each coefficient becomes a power of its variable inside the logarithm.', 'Added logarithms multiply their arguments; a subtracted logarithm divides.', 'Collect everything that is added on top and everything subtracted below.', 'Check each option against both laws, one term at a time.'],
      steps: [['Power law', items.filter(t => Math.abs(t.c) > 1).map(t => `$${Math.abs(t.c)}\\log_{${base}} ${t.v} = \\log_{${base}} ${pw(t.v, Math.abs(t.c))}$`).join(', ')], ['Product and quotient laws', 'Added terms multiply, subtracted terms divide.'], ['Single logarithm', key]],
      audit: { kind: 'logcombine', items, num: items.filter(t => t.c > 0).map(t => [t.v, t.c]), den: items.filter(t => t.c < 0).map(t => [t.v, -t.c]) }
    });
  }),

  // E2 · D1, D2 · evaluate when the numbers are not powers of the base: use the law that cancels
  V([1, 2], (rng, d) => {
    const br = d === 1 ? rc(rng, [0, 1]) : rc(rng, [1, 2]);
    if (br === 0) {
      const k = ri(rng, 2, 4), T = 10 ** k, ds = [];
      for (let i = 2; i < T; i++) if (T % i === 0 && !isPowerOf(10, i)) ds.push(i);
      const m = rc(rng, ds), n = T / m;
      return N(`Evaluate $\\log_{10} ${m} + \\log_{10} ${n}$.`, k, {
        traps: [[m * n, 'That is the number inside the logarithm. The sum of the two logarithms is $\\log_{10}$ of that product, and it still has to be evaluated.']],
        hints: ['Neither number is a power of $10$, so evaluating each logarithm separately will not work.', 'Use $\\log a + \\log b = \\log (ab)$.', `Multiply $${m}$ and $${n}$ first.`, `The product is $${T}$, a power of $10$.`],
        steps: [['Combine', `$\\log_{10} ${m} + \\log_{10} ${n} = \\log_{10} (${m}\\times ${n}) = \\log_{10} ${T}$`], ['Evaluate', `$${T} = 10^{${k}}$, so the value is $${k}$`]],
        audit: { kind: 'logexpr', b: 10, terms: [[1, m], [1, n]], expect: k }
      });
    }
    if (br === 1) {
      const b = rc(rng, [2, 3, 5, 6, 7]), k = ri(rng, 1, 4), dd = ri(rng, 2, 9), c = dd * b ** k;
      rej(dd === b || c > 20000);
      return N(`Evaluate $\\log_{${b}} ${c} - \\log_{${b}} ${dd}$.`, k, {
        traps: [[c - dd, 'Subtracting the logarithms divides the numbers inside; it does not subtract them.'], [b ** k, `That is $${c} \\div ${dd}$. The answer is the logarithm of that quotient.`]],
        hints: [`Is $${c}$ a power of $${b}$? Is $${dd}$?`, 'Use $\\log a - \\log b = \\log \\dfrac{a}{b}$.', `Divide $${c}$ by $${dd}$.`, `The quotient is a power of $${b}$.`],
        steps: [['Quotient law', `$\\log_{${b}} ${c} - \\log_{${b}} ${dd} = \\log_{${b}} \\dfrac{${c}}{${dd}} = \\log_{${b}} ${b ** k}$`], ['Evaluate', `$${b ** k} = ${b}^{${k}}$, so the value is $${k}$`]],
        audit: { kind: 'logexpr', b, terms: [[1, c], [-1, dd]], expect: k }
      });
    }
    const b = rc(rng, [2, 3, 6, 10]), k = ri(rng, 1, 4), p = ri(rng, 2, 3), X = ri(rng, 3, 14), Y = X ** p / b ** k;
    rej(!Number.isInteger(Y) || Y < 2 || isPowerOf(b, X) || X === b);
    return N(`Evaluate $${p}\\log_{${b}} ${X} - \\log_{${b}} ${Y}$.`, k, {
      traps: [[p * X - Y, 'The coefficient is a power inside the logarithm, and subtraction becomes division. Neither can be done to the numbers directly.'], [b ** k, `That is the number inside the single logarithm, $\\dfrac{${X}^{${p}}}{${Y}}$; take its logarithm.`]],
      hints: [`Move the coefficient inside: $${p}\\log_{${b}} ${X} = \\log_{${b}} ${X}^{${p}}$.`, 'Then subtract the logarithms by dividing the arguments.', `Work out $\\dfrac{${X ** p}}{${Y}}$.`, `The quotient is a power of $${b}$.`],
      steps: [['Power law', `$${p}\\log_{${b}} ${X} = \\log_{${b}} ${X ** p}$`], ['Quotient law', `$\\log_{${b}} \\dfrac{${X ** p}}{${Y}} = \\log_{${b}} ${b ** k}$`], ['Evaluate', `$${b ** k} = ${b}^{${k}}$, so the value is $${k}$`]],
      audit: { kind: 'logexpr', b, terms: [[p, X], [-1, Y]], expect: k }
    });
  }),

  // E3 · D1, D2 · a logarithm whose base is a power of the argument's base: choose a common base
  V([1, 2], rng => {
    const b = rc(rng, [2, 2, 3, 5]), p = ri(rng, 2, b === 2 ? 4 : b === 3 ? 3 : 2), q = ri(rng, 1, 5);
    rej(q % p === 0 || q === p);
    const B = b ** p, A = b ** q;
    return Fr(`Evaluate $\\log_{${B}} ${A}$. Give the answer as a fraction in simplest form.`, q, p, {
      traps: [[p / q, 'The logarithm is the power of the BASE that gives the argument, so it is the index of the argument over the index of the base, not the other way round.']],
      hints: [`Write $${B}$ and $${A}$ as powers of the same small number.`, `$${B} = ${b}^{${p}}$ and $${A} = ${b}^{${q}}$.`, `If $\\log_{${B}} ${A} = t$ then $(${b}^{${p}})^t = ${b}^{${q}}$.`, `Equate indices: $${p}t = ${q}$.`],
      steps: [['Common base', `$${B} = ${b}^{${p}}$, $${A} = ${b}^{${q}}$`], ['Index form', `Let $t = \\log_{${B}} ${A}$: $(${b}^{${p}})^t = ${b}^{${q}}$, so $${p}t = ${q}$`], ['Solve', `$t = ${fr(q, p)}$`]],
      audit: { kind: 'logexpr', b: B, terms: [[1, A]], expectFrac: [q, p] }
    });
  }),

  // E4 · D1 · the unknown is the base
  V([1], rng => {
    const b = ri(rng, 2, 12), k = ri(rng, 2, 4), Nn = b ** k, ph = ri(rng, 0, 2);
    const prompt = ph === 0 ? `Find the base $x$ if $\\log_{x} ${Nn} = ${k}$.`
      : ph === 1 ? `A logarithm to an unknown base $x$ satisfies $\\log_{x} ${Nn} = ${k}$. What is $x$?`
        : `Solve $\\log_{x} ${Nn} = ${k}$ for $x$, where $x > 0$ and $x \\ne 1$.`;
    return N(prompt, b, {
      traps: [[Nn / k, 'Rewrite in index form: $x^{' + k + '} = ' + Nn + '$. The index ' + k + ' is a power of $x$, not a divisor of ' + Nn + '.']],
      hints: ['Rewrite the statement in index form.', `$\\log_{x} ${Nn} = ${k}$ means $x^{${k}} = ${Nn}$.`, `Which positive number raised to the power ${k} gives $${Nn}$?`, `Take the ${k === 2 ? 'square' : k === 3 ? 'cube' : 'fourth'} root of $${Nn}$.`],
      steps: [['Index form', `$x^{${k}} = ${Nn}$`], ['Solve', `$x = ${b}$ (the base must be positive)`]],
      audit: { kind: 'unknownbase', N: Nn, k, expect: b }
    });
  }),

  // E5 · D1, D2 · negative and fractional logarithms: roots and reciprocals as indices
  V([1, 2], (rng, d) => {
    const b = rc(rng, [2, 3, 5]), m = ri(rng, 1, b === 5 ? 3 : 5), B = b ** m;
    const br = d === 1 ? rc(rng, [0, 1]) : rc(rng, [1, 2, 3]);
    if (br === 0) {
      return Fr(`Evaluate $\\log_{${b}} \\dfrac{1}{${B}}$.`, -m, 1, {
        traps: [[m, `A reciprocal is a negative power: $\\dfrac{1}{${B}} = ${b}^{-${m}}$.`]],
        hints: [`Write $${B}$ as a power of $${b}$.`, `A reciprocal is a negative index: $\\dfrac{1}{${b}^{${m}}} = ${b}^{-${m}}$.`, 'The logarithm is the index.', `The index is $-${m}$.`],
        steps: [['Index form', `$\\dfrac{1}{${B}} = ${b}^{-${m}}$`], ['Read the index', `$\\log_{${b}} ${b}^{-${m}} = -${m}$`]],
        audit: { kind: 'logexpr', b, terms: [[1, 1 / B]], expect: -m }
      });
    }
    if (br === 1) {
      return Fr(`Evaluate $\\log_{${b}} \\sqrt{${B}}$.`, m, 2, {
        traps: [[m, 'A square root is the power $\\tfrac12$, so the index is halved.'], [B / 2, 'That is half of the number. The answer is the index.']],
        hints: [`Write $${B}$ as a power of $${b}$.`, 'A square root is the index $\\tfrac12$.', `$\\sqrt{${b}^{${m}}} = ${b}^{${m}/2}$.`, 'The logarithm is that index.'],
        steps: [['Index form', `$\\sqrt{${B}} = (${b}^{${m}})^{1/2} = ${b}^{${fr(m, 2)}}$`], ['Read the index', `$\\log_{${b}} ${b}^{${fr(m, 2)}} = ${fr(m, 2)}$`]],
        audit: { kind: 'logexpr', b, terms: [[1, Math.sqrt(B)]], expectFrac: [m, 2] }
      });
    }
    if (br === 2) {
      return Fr(`Evaluate $\\log_{${b}} \\sqrt[3]{${B}}$.`, m, 3, {
        traps: [[m, 'A cube root is the power $\\tfrac13$, so the index is divided by 3.'], [m * 3, 'A cube root divides the index by 3; it does not multiply.']],
        hints: [`Write $${B}$ as a power of $${b}$.`, 'A cube root is the index $\\tfrac13$.', `$\\sqrt[3]{${b}^{${m}}} = ${b}^{${m}/3}$.`, 'The logarithm is that index.'],
        steps: [['Index form', `$\\sqrt[3]{${B}} = ${b}^{${fr(m, 3)}}$`], ['Read the index', `$\\log_{${b}} ${b}^{${fr(m, 3)}} = ${fr(m, 3)}$`]],
        audit: { kind: 'logexpr', b, terms: [[1, Math.cbrt(B)]], expectFrac: [m, 3] }
      });
    }
    return Fr(`Evaluate $\\log_{${b}} \\dfrac{1}{\\sqrt{${B}}}$.`, -m, 2, {
      traps: [[m / 2, 'The reciprocal makes the index negative.'], [-m, 'The square root halves the index as well as the reciprocal changing its sign.']],
      hints: [`Write $${B}$ as a power of $${b}$.`, 'A square root is the index $\\tfrac12$ and a reciprocal makes an index negative.', `$\\dfrac{1}{\\sqrt{${b}^{${m}}}} = ${b}^{-${m}/2}$.`, 'The logarithm is that index.'],
      steps: [['Index form', `$\\dfrac{1}{\\sqrt{${B}}} = ${b}^{-${fr(m, 2)}}$`], ['Read the index', `$\\log_{${b}} ${b}^{-${fr(m, 2)}} = -${fr(m, 2)}$`]],
      audit: { kind: 'logexpr', b, terms: [[1, 1 / Math.sqrt(B)]], expectFrac: [-m, 2] }
    });
  }),

  // X1 · D2, D3 · the base cannot be matched: take logarithms
  V([2, 3], (rng, d) => {
    const a = rc(rng, [2, 3, 5, 6, 7]);
    const br = d === 2 ? 0 : rc(rng, [1, 2]);
    if (br === 0) {
      const c = ri(rng, 3, 150);
      rej(isPowerOf(a, c));
      const v = lg(a, c);
      rej(nearBoundary(v, 2));
      return N(`Solve $${a}^{x} = ${c}$. Give $x$ correct to 2 decimal places.`, rnd(v, 2), {
        tol: 0.005,
        traps: [[rnd(c / a, 2), 'The unknown is an index. Take logarithms: $x = \\dfrac{\\log c}{\\log a}$.']],
        hints: [`$${c}$ is not a power of $${a}$, so the bases cannot be matched.`, 'Take logarithms of both sides (any base): $x\\log a = \\log c$.', `$x = \\dfrac{\\log ${c}}{\\log ${a}}$.`, 'Evaluate on a calculator and round last.'],
        steps: [['Take logarithms', `$x\\log ${a} = \\log ${c}$`], ['Solve', `$x = \\dfrac{\\log ${c}}{\\log ${a}}$`], ['Evaluate', `$x \\approx ${rnd(v, 2)}$`]],
        audit: { kind: 'expsolve', a, form: 'plain', c }
      });
    }
    if (br === 1) {
      const c = ri(rng, 20, 300), s = ri(rng, 1, 3);
      rej(isPowerOf(a, c));
      const v = lg(a, c) - s;
      rej(nearBoundary(v, 2));
      return N(`Solve $${a}^{x + ${s}} = ${c}$. Give $x$ correct to 2 decimal places.`, rnd(v, 2), {
        tol: 0.005,
        traps: [[rnd(lg(a, c), 2), `Do not forget the $+ ${s}$ in the index: after taking logarithms, subtract ${s}.`], [rnd(lg(a, c) + s, 2), `The ${s} is added to $x$ in the index, so it is subtracted at the end.`]],
        hints: ['The unknown is inside an index that is not a power of the base, so take logarithms.', `$(x + ${s})\\log ${a} = \\log ${c}$.`, `Divide by $\\log ${a}$ before moving the ${s}.`, `$x = \\dfrac{\\log ${c}}{\\log ${a}} - ${s}$.`],
        steps: [['Take logarithms', `$(x + ${s})\\log ${a} = \\log ${c}$`], ['Divide', `$x + ${s} = \\dfrac{\\log ${c}}{\\log ${a}}$`], ['Solve', `$x \\approx ${rnd(v, 2)}$`]],
        audit: { kind: 'expsolve', a, form: 'shift', c, s }
      });
    }
    const p = ri(rng, 2, 6), c = p * ri(rng, 3, 40);
    const v = lg(a, c / p);
    rej(isPowerOf(a, c / p) || nearBoundary(v, 2));
    return N(`Solve $${p}\\times ${a}^{x} = ${c}$. Give $x$ correct to 2 decimal places.`, rnd(v, 2), {
      tol: 0.005,
      traps: [[rnd(lg(a, c), 2), `The ${p} multiplies the power: divide both sides by ${p} before taking logarithms.`], [rnd(lg(a * p, c), 2), `The ${p} is not part of the base. Isolate $${a}^{x}$ first.`]],
      hints: [`First isolate the power: divide both sides by $${p}$.`, `$${a}^{x} = ${c / p}$.`, 'Now take logarithms of both sides.', `$x = \\dfrac{\\log ${c / p}}{\\log ${a}}$.`],
      steps: [['Isolate the power', `$${a}^{x} = \\dfrac{${c}}{${p}} = ${c / p}$`], ['Take logarithms', `$x\\log ${a} = \\log ${c / p}$`], ['Solve', `$x \\approx ${rnd(v, 2)}$`]],
      audit: { kind: 'expsolve', a, form: 'coef', c, p }
    });
  }),

  // X3 · D2 · how many steps of growth or decay (match the factor)
  V([2], rng => {
    if (rng() < 0.6) {
      const f = rc(rng, [2, 3, 4, 5, 10]), t = ri(rng, 2, 6), n0 = rc(rng, [3, 5, 10, 20, 25, 50, 100, 200]);
      rej(n0 * f ** t > 5e6);
      const word = { 2: 'doubles', 3: 'triples', 4: 'quadruples', 5: 'multiplies by 5', 10: 'multiplies by 10' }[f];
      return N(`A culture starts with ${n0} bacteria. The number of bacteria ${word} every hour. After how many hours will there be ${n0 * f ** t} bacteria?`, t, {
        traps: [[f ** t, 'That is the factor the number has grown by in total. The question asks for the number of hours, the index.'], [(n0 * f ** t) / n0 / f, 'Count how many times the factor has been applied.']],
        hints: ['Find the total growth factor: new number divided by starting number.', `$\\dfrac{${n0 * f ** t}}{${n0}} = ${f ** t}$.`, `Write $${f ** t}$ as a power of $${f}$.`, 'The index is the number of hours.'],
        steps: [['Total factor', `$${n0 * f ** t} \\div ${n0} = ${f ** t}$`], ['As a power', `$${f ** t} = ${f}^{${t}}$`], ['Hours', `$${t}$ hours`]],
        audit: { kind: 'steps', start: n0, factor: f, target: n0 * f ** t, expect: t }
      });
    }
    const f = rc(rng, [2, 3]), t = ri(rng, 2, 6), m = rc(rng, [1, 2, 3, 5, 10, 15, 20, 25]);
    const word = f === 2 ? 'halves' : 'falls to one third';
    return N(`A sample of ${m * f ** t} g of a substance ${word} in mass every day. After how many days will ${m} g remain?`, t, {
      traps: [[f ** t, 'That is the total factor the mass has fallen by. The question asks for the number of days.'], [m, 'That is the remaining mass.']],
      hints: ['Find the total factor by which the mass has fallen.', `$\\dfrac{${m * f ** t}}{${m}} = ${f ** t}$.`, `Write $${f ** t}$ as a power of $${f}$.`, 'The index is the number of days.'],
      steps: [['Total factor', `$${m * f ** t} \\div ${m} = ${f ** t}$`], ['As a power', `$${f ** t} = ${f}^{${t}}$`], ['Days', `$${t}$ days`]],
      audit: { kind: 'steps', start: m * f ** t, factor: 1 / f, target: m, expect: t }
    });
  }),

  // X8 · D2, D3 · locate a logarithm between consecutive integers without a calculator
  V([2, 3], (rng, d) => {
    const b = rc(rng, [2, 3, 5, 7, 10]);
    if (d === 2) {
      const e = ri(rng, 1, 4), n = ri(rng, b ** e + 1, b ** (e + 1) - 1);
      const v = lg(b, n);
      rej(v - Math.floor(v) < 0.06 || v - Math.floor(v) > 0.94 || n > 60000);
      return N(`The value of $\\log_{${b}} ${n}$ lies between two consecutive whole numbers. What is the smaller of them?`, e, {
        traps: [[e + 1, 'That is the larger whole number. The question asks for the smaller.']],
        hints: [`List powers of $${b}$.`, `$${b}^{${e}} = ${b ** e}$ and $${b}^{${e + 1}} = ${b ** (e + 1)}$.`, `Where does $${n}$ sit between those?`, 'The logarithm is between the two indices.'],
        steps: [['Bracket by powers', `$${b ** e} < ${n} < ${b ** (e + 1)}$`], ['Indices', `$${b}^{${e}} < ${n} < ${b}^{${e + 1}}$, so $${e} < \\log_{${b}} ${n} < ${e + 1}$`], ['Smaller whole number', `$${e}$`]],
        audit: { kind: 'bracket', b, num: n, den: 1, expect: e }
      });
    }
    const q = ri(rng, 5, 40), p = ri(rng, 1, q - 1);
    const v = lg(b, p / q), fl = Math.floor(v);
    rej(v - fl < 0.06 || v - fl > 0.94 || p / q > 0.9 || gcdI(p, q) !== 1);
    return N(`The value of $\\log_{${b}} \\dfrac{${p}}{${q}}$ lies between two consecutive whole numbers. What is the smaller of them?`, fl, {
      traps: [[fl + 1, 'That is the larger whole number (closer to zero). The question asks for the smaller.'], [-fl, 'The fraction is less than 1, so its logarithm is negative.']],
      hints: [`The fraction is less than $1$, so the logarithm is negative. List negative powers of $${b}$.`, `$${b}^{${fl}} = \\dfrac{1}{${b ** -fl}}$ and $${b}^{${fl + 1}}$ is the next.`, `Compare $\\dfrac{${p}}{${q}} \\approx ${rnd(p / q, 3)}$ with those.`, 'The logarithm is between the two indices.'],
      steps: [['Decimal value', `$\\dfrac{${p}}{${q}} \\approx ${rnd(p / q, 3)}$`], ['Bracket by powers', `$${b}^{${fl}} < \\dfrac{${p}}{${q}} < ${b}^{${fl + 1}}$`], ['Smaller whole number', `$${fl}$`]],
      audit: { kind: 'bracket', b, num: p, den: q, expect: fl }
    });
  }),

  // X5 · D3, D4 · an exponential equation that is a hidden quadratic in b^x
  V([3, 4], (rng, d) => {
    const b = rc(rng, [2, 3, 5]);
    const tm = (c, e) => `${Math.abs(c) === 1 ? '' : `${Math.abs(c)}\\times `}${b}^{${e}}`;
    if (d === 3) {
      const a = ri(rng, 0, 3), c = ri(rng, 0, 3);
      rej(a >= c || b ** c > 130);
      const Sm = b ** a + b ** c, Pr = b ** (a + c);
      return S(`Solve $${b}^{2x} - ${tm(Sm, 'x')} + ${Pr} = 0$. Give all real solutions.`, [a, c], {
        traps: [[b ** a, `That is a value of $${b}^x$, not of $x$. Solve $${b}^x = ${b ** a}$.`]],
        hints: [`Notice $${b}^{2x} = (${b}^{x})^2$. Let $u = ${b}^{x}$.`, `You get $u^2 - ${Sm}u + ${Pr} = 0$.`, 'Factorise and solve for $u$.', `Then solve $${b}^x = u$ for each value of $u$.`],
        steps: [['Substitute', `$u = ${b}^{x}$ gives $u^2 - ${Sm}u + ${Pr} = 0$`], ['Solve for u', `$(u - ${b ** a})(u - ${b ** c}) = 0$, so $u = ${b ** a}$ or $u = ${b ** c}$`], ['Back to x', `$${b}^{x} = ${b ** a} \\Rightarrow x = ${a}$ and $${b}^{x} = ${b ** c} \\Rightarrow x = ${c}$`]],
        audit: { kind: 'hiddenquad', b, B: -Sm, C: Pr }
      });
    }
    const a = ri(rng, 0, 3), m = ri(rng, 1, 12), u1 = b ** a;
    rej(m === u1 || b ** a * m > 300);
    const B1 = m - u1, C = -m * u1;
    const lead = B1 === 0 ? '' : ` ${B1 > 0 ? '+' : '-'} ${tm(B1, 'x')}`;
    return S(`Solve $${b}^{2x}${lead} - ${m * u1} = 0$. Give all real solutions.`, [a], {
      traps: [[u1, `That is the value of $${b}^x$. Solve $${b}^x = ${u1}$ for $x$.`]],
      hints: [`Let $u = ${b}^{x}$, so $${b}^{2x} = u^2$.`, `Factorise $u^2 ${B1 >= 0 ? '+' : '-'} ${Math.abs(B1)}u - ${m * u1} = 0$.`, `One of the two values of $u$ is negative. Can $${b}^{x}$ be negative?`, 'Solve $b^x = u$ only for the value that is possible.'],
      steps: [['Substitute', `$u = ${b}^{x}$ gives $u^2 ${B1 >= 0 ? '+' : '-'} ${Math.abs(B1)}u - ${m * u1} = 0$`], ['Factorise', `$(u - ${u1})(u + ${m}) = 0$, so $u = ${u1}$ or $u = -${m}$`], ['Reject', `$${b}^x > 0$ for every $x$, so $u = -${m}$ gives no solution`], ['Back to x', `$${b}^{x} = ${u1}$, so $x = ${a}$`]],
      audit: { kind: 'hiddenquad', b, B: B1, C }
    });
  }),

  // X6 · D4 · a logarithmic equation with an extraneous root: check the domain
  V([4], rng => {
    const b = rc(rng, [2, 3, 5]), k = ri(rng, 1, 3), p = ri(rng, 1, 7), q = ri(rng, 1, 7);
    const T = b ** k, disc = (p + q) ** 2 + 4 * T, root = Math.sqrt(disc);
    rej(!Number.isInteger(root));
    const x1 = (-(p - q) + root) / 2, x2 = (-(p - q) - root) / 2;
    rej(!(x1 > q) || !Number.isInteger(x1));
    return N(`Solve $\\log_{${b}}(x + ${p}) + \\log_{${b}}(x - ${q}) = ${k}$ for $x$.`, x1, {
      traps: [[x2, `That root makes $x - ${q}$ negative, and a logarithm of a negative number does not exist. Reject it.`]],
      hints: ['Combine the two logarithms into one using the product law.', `Rewrite in index form: $(x + ${p})(x - ${q}) = ${b}^{${k}}$.`, 'Expand and solve the quadratic. You will find two roots.', 'Both brackets must be positive for the logarithms to exist. Reject any root that fails this.'],
      steps: [['Product law', `$\\log_{${b}}\\big[(x + ${p})(x - ${q})\\big] = ${k}$`], ['Index form', `$(x + ${p})(x - ${q}) = ${T}$, so $x^2 ${sg(p - q)}x - ${p * q + T} = 0$`], ['Solve', `$x = ${x1}$ or $x = ${x2}$`], ['Check the domain', `The logarithms need $x > ${q}$, so only $x = ${x1}$ is valid`]],
      audit: { kind: 'logeqext', b, k, p, q }
    });
  }),

  // X7 · D3, D4 · reading a logarithmic graph: intercept, or an unknown coefficient from a point
  V([3, 4], (rng, d) => {
    const b = rc(rng, [2, 3, 5, 10]);
    if (d === 3) {
      const h = nz(rng, -5, 5), j = ri(rng, 1, 3);
      rej(b ** j > 1100);
      return N(`The graph of $y = \\log_{${b}}(x ${sg(-h)}) - ${j}$ crosses the $x$-axis at one point. Find the $x$-coordinate of that point.`, h + b ** j, {
        traps: [[h + j, `Set $y = 0$ and rewrite in index form: $x ${sg(-h)} = ${b}^{${j}}$.`], [b ** j, `Do not forget the shift: $x ${sg(-h)} = ${b ** j}$.`]],
        hints: ['On the $x$-axis, $y = 0$.', `$\\log_{${b}}(x ${sg(-h)}) = ${j}$.`, 'Rewrite in index form.', `$x ${sg(-h)} = ${b}^{${j}}$.`],
        steps: [['Set y = 0', `$\\log_{${b}}(x ${sg(-h)}) = ${j}$`], ['Index form', `$x ${sg(-h)} = ${b}^{${j}} = ${b ** j}$`], ['Solve', `$x = ${h + b ** j}$`]],
        audit: { kind: 'logintercept', b, h, j, expect: h + b ** j }
      });
    }
    const k = nz(rng, -5, 5), i = ri(rng, 1, 3), h = ri(rng, -4, 4);
    const X = b ** i - h;
    rej(b ** i > 130 || X === 0);
    return N(`The curve $y = k\\log_{${b}}(x ${sg(h)})$ passes through the point $(${X}, ${k * i})$. Find $k$.`, k, {
      traps: [[(k * i) / X, 'Substitute the point first. $\\log_{' + b + '}(' + (X + h) + ')$ is an exact number you can evaluate.'], [k * i, 'This is the $y$-coordinate. Divide it by the value of the logarithm.']],
      hints: ['Substitute $x$ and $y$ from the point into the equation.', `$x ${sg(h)} = ${X + h}$, so you need $\\log_{${b}} ${X + h}$.`, `Evaluate it: $${X + h} = ${b}^{${i}}$.`, `Then solve $${k * i} = k \\times ${i}$.`],
      steps: [['Substitute', `$${k * i} = k\\log_{${b}}(${X} ${sg(h)})$`], ['Evaluate the logarithm', `$\\log_{${b}} ${X + h} = ${i}$`], ['Solve for k', `$${k * i} = ${i}k$, so $k = ${k}$`]],
      audit: { kind: 'logcoef', b, h, X, Y: k * i, expect: k }
    });
  }),

  // X9 · D3, D4 · write a logarithm in terms of two given logarithms
  V([3, 4], (rng, d) => {
    const B = rc(rng, [5, 7]);
    let i = ri(rng, 0, 3), j = ri(rng, 0, 3), l = ri(rng, 0, 2);
    if (d === 4) { i = ri(rng, -3, 3); j = ri(rng, -3, 3); l = ri(rng, -2, 2); rej(i >= 0 && j >= 0 && l >= 0); }
    rej((i === 0 && j === 0) || (d === 3 && i + j + l < 2));
    const top = 2 ** Math.max(i, 0) * 3 ** Math.max(j, 0) * B ** Math.max(l, 0), bot = 2 ** Math.max(-i, 0) * 3 ** Math.max(-j, 0) * B ** Math.max(-l, 0);
    rej(top > 5000 || bot > 5000);
    const arg = bot === 1 ? `${top}` : `\\dfrac{${top}}{${bot}}`;
    const term = (c, v) => (c === 0 ? '' : `+(${c})*${v}`);
    const key = `${term(i, 'p')}${term(j, 'q')}${l === 0 ? '' : `+(${l})`}`.replace(/^\+/, '');
    const noL = `${term(i, 'p')}${term(j, 'q')}`.replace(/^\+/, '');
    return E(`Given that $\\log_{${B}} 2 = p$ and $\\log_{${B}} 3 = q$, write $\\log_{${B}} ${bot === 1 ? arg : `\\left(${arg}\\right)`}$ in terms of $p$ and $q$.`, key, {
      traps: l !== 0 ? [[noL, `$\\log_{${B}} ${B} = 1$, so the factors of ${B} contribute their own constant.`]] : [[`(${-i})*p+(${-j})*q`, 'A factor in the denominator subtracts its logarithm.']],
      hints: [`Break the number into prime factors: only $2$, $3$ and $${B}$ appear.`, 'Use the product law to split the logarithm, and the power law for repeated factors.', `A factor in the denominator subtracts. Remember $\\log_{${B}} ${B} = 1$.`, `Replace $\\log_{${B}} 2$ by $p$ and $\\log_{${B}} 3$ by $q$.`],
      steps: [['Prime factors', `$${top}${bot === 1 ? '' : `\\div ${bot}`}$ is built from $2^{${i}}\\times 3^{${j}}\\times ${B}^{${l}}$`], ['Laws', `$\\log_{${B}}(2^{${i}}3^{${j}}${B}^{${l}}) = ${i}\\log_{${B}} 2 + ${j}\\log_{${B}} 3 + ${l}\\log_{${B}} ${B}$`], ['Substitute', `$${i}p + ${j}q + ${l}$`]],
      audit: { kind: 'logexprsym', B, i, j, l }
    });
  }),

  // X11 · D3, D4 · the unknown is the rate
  V([3, 4], (rng, d) => {
    const pairs = [[9, 10], [4, 5], [3, 4], [3, 5], [1, 2], [11, 10], [6, 5], [5, 4], [3, 2], [7, 10]];
    const [a, b] = rc(rng, pairs), n = ri(rng, 2, d === 3 ? 3 : 4), k = ri(rng, 1, 6);
    const A = k * b ** n, B = k * a ** n, decay = a < b;
    rej(Math.max(A, B) > 200000 || (a === 1 && b === 2 && n === 4 && d === 3));
    const pct = Math.round(Math.abs(1 - a / b) * 100);
    const prompt = decay
      ? `A machine falls in value by the same percentage each year. It was worth \\$${A} when new and \\$${B} after ${n} years. By what percentage does its value fall each year?`
      : `A town's population grew by the same percentage each year, from ${A} to ${B} in ${n} years. What is the annual percentage growth?`;
    return N(prompt, pct, {
      suffix: '%',
      traps: [[Math.round((Math.abs(B - A) / A) * 100 / n), 'Percentage changes compound, so dividing the total change by the number of years is not valid. Find the yearly factor from an $n$th root.'], [Math.round(Math.abs(B - A) / A * 100), 'That is the change over the whole period. Find the yearly factor.']],
      hints: ['Let the yearly multiplier be $m$, so $A \\times m^{n} = B$.', `$m^{${n}} = \\dfrac{${B}}{${A}}$.`, `Take the ${n === 2 ? 'square' : n === 3 ? 'cube' : 'fourth'} root of the ratio.`, decay ? 'The percentage fall is $(1 - m)\\times 100$.' : 'The percentage growth is $(m - 1)\\times 100$.'],
      steps: [['Model', `$${A}\\times m^{${n}} = ${B}$`], ['Ratio', `$m^{${n}} = \\dfrac{${B}}{${A}} = ${rnd(B / A, 5)}$`], ['Root', `$m = ${rnd(a / b, 4)}$`], ['Rate', `${decay ? `$(1 - ${rnd(a / b, 4)})\\times 100 = ${pct}\\%$` : `$(${rnd(a / b, 4)} - 1)\\times 100 = ${pct}\\%$`}`]],
      audit: { kind: 'solverate', A, B, n, expect: pct, decay }
    });
  }),

  // X12 · D3, D4 · the first whole period for which a model passes a target
  V([3, 4], (rng, d) => {
    const r = rc(rng, [3, 4, 5, 6, 8, 10, 12]);
    if (d === 3) {
      const P = rc(rng, [1000, 2000, 2500, 5000, 8000, 10000]), mult = rc(rng, [1.5, 2, 2.5, 3]);
      const T = P * mult, nf = lg(1 + r / 100, T / P), n = Math.ceil(nf);
      rej(nf - Math.floor(nf) < 0.03 || n > 40 || n < 4);
      return N(`\\$${P.toLocaleString('en-AU')} is invested at ${r}% p.a. interest, compounded annually. In which whole number of years does the balance first exceed \\$${T.toLocaleString('en-AU')}? (Enter the smallest whole number of years.)`, n, {
        traps: [[n - 1, 'After that many years the balance is still below the target. Round UP to the next whole year.'], [Math.round(nf), 'Round up, not to the nearest year: the balance must actually exceed the target.']],
        hints: ['Set up $P(1 + r)^n > T$.', `$${1 + r / 100}^{n} > ${mult}$.`, 'Take logarithms and divide, remembering $\\log 1.0\\ldots$ is positive so the inequality does not flip.', 'Round up to the next whole number.'],
        steps: [['Inequality', `$${1 + r / 100}^{n} > ${mult}$`], ['Logarithms', `$n > \\dfrac{\\log ${mult}}{\\log ${1 + r / 100}} \\approx ${rnd(nf, 2)}$`], ['Whole years', `$n = ${n}$`]],
        audit: { kind: 'firstpast', P, rate: 1 + r / 100, T, up: true, expect: n }
      });
    }
    const C = rc(rng, [80, 100, 200, 400, 500, 800]), frac = rc(rng, [0.5, 0.25, 0.1, 0.05]);
    const rr = rc(rng, [10, 15, 20, 25, 30]);
    const T = C * frac, nf = lg(1 - rr / 100, frac), n = Math.ceil(nf);
    rej(nf - Math.floor(nf) < 0.03 || n > 40 || n < 3);
    return N(`The concentration of a drug in the blood starts at ${C} mg/L and falls by ${rr}% each hour. After how many whole hours is it first below ${T} mg/L? (Enter the smallest whole number of hours.)`, n, {
      traps: [[n - 1, 'After that many hours the concentration is still at or above the target. Round UP.'], [Math.round(nf), 'The concentration must actually be below the target, so round up.']],
      hints: [`The hourly multiplier is $1 - ${rr / 100} = ${1 - rr / 100}$.`, `Solve $${1 - rr / 100}^{n} < ${frac}$.`, `$\\log ${1 - rr / 100}$ is NEGATIVE, so dividing by it reverses the inequality.`, 'Round up to the next whole hour.'],
      steps: [['Model', `$${C}(${1 - rr / 100})^{n} < ${T}$, so $${1 - rr / 100}^{n} < ${frac}$`], ['Logarithms', `$n\\log ${1 - rr / 100} < \\log ${frac}$; dividing by the negative $\\log ${1 - rr / 100}$ gives $n > ${rnd(nf, 2)}$`], ['Whole hours', `$n = ${n}$`]],
      audit: { kind: 'firstpast', P: C, rate: 1 - rr / 100, T, up: false, expect: n }
    });
  })
];

// ── y11-trig-ident ───────────────────────────────────────────────────────────
// (a/c) Pythagorean triples: sin = a/c, cos = b/c
const TRIPLES = [[3, 4, 5], [5, 12, 13], [8, 15, 17], [7, 24, 25], [20, 21, 29], [9, 40, 41], [12, 35, 37]];
// special angle table: exact trig values with their solutions in 0..360
const SPEC = {
  sin: [{ t: '\\tfrac12', v: 0.5, s: [30, 150] }, { t: '-\\tfrac12', v: -0.5, s: [210, 330] }, { t: '\\tfrac{\\sqrt3}{2}', v: Math.sqrt(3) / 2, s: [60, 120] }, { t: '-\\tfrac{\\sqrt3}{2}', v: -Math.sqrt(3) / 2, s: [240, 300] }, { t: '\\tfrac{\\sqrt2}{2}', v: Math.SQRT1_2, s: [45, 135] }, { t: '-\\tfrac{\\sqrt2}{2}', v: -Math.SQRT1_2, s: [225, 315] }, { t: '1', v: 1, s: [90] }, { t: '-1', v: -1, s: [270] }, { t: '0', v: 0, s: [0, 180, 360] }],
  cos: [{ t: '\\tfrac12', v: 0.5, s: [60, 300] }, { t: '-\\tfrac12', v: -0.5, s: [120, 240] }, { t: '\\tfrac{\\sqrt3}{2}', v: Math.sqrt(3) / 2, s: [30, 330] }, { t: '-\\tfrac{\\sqrt3}{2}', v: -Math.sqrt(3) / 2, s: [150, 210] }, { t: '\\tfrac{\\sqrt2}{2}', v: Math.SQRT1_2, s: [45, 315] }, { t: '-\\tfrac{\\sqrt2}{2}', v: -Math.SQRT1_2, s: [135, 225] }, { t: '1', v: 1, s: [0, 360] }, { t: '-1', v: -1, s: [180] }, { t: '0', v: 0, s: [90, 270] }],
  tan: [{ t: '1', v: 1, s: [45, 225] }, { t: '-1', v: -1, s: [135, 315] }, { t: '\\sqrt3', v: Math.sqrt(3), s: [60, 240] }, { t: '-\\sqrt3', v: -Math.sqrt(3), s: [120, 300] }, { t: '\\tfrac{1}{\\sqrt3}', v: 1 / Math.sqrt(3), s: [30, 210] }, { t: '-\\tfrac{1}{\\sqrt3}', v: -1 / Math.sqrt(3), s: [150, 330] }, { t: '0', v: 0, s: [0, 180, 360] }]
};
const FN = { sin: Math.sin, cos: Math.cos, tan: Math.tan };
const rad = d => (d * Math.PI) / 180;
/** All solutions of f(theta) = v for theta in [lo, hi] (whole degrees only, from the special-angle table). */
const solveIn = (f, row, lo, hi) => {
  const out = [];
  for (const base of row.s) for (let k = -4; k <= 4; k++) { const th = base + 360 * k; if (th >= lo && th <= hi && !out.includes(th)) out.push(th); }
  return out.sort((a, b) => a - b);
};

/** A f^2 + B f + C written with signs and unit coefficients tidied; f is the ratio name. */
const ratioQuad = (fn, A, B, C) => {
  const parts = [];
  [[A, `\\${fn}^2\\theta`], [B, `\\${fn}\\theta`], [C, '']].forEach(([c, t]) => {
    if (!c) return;
    parts.push({ neg: c < 0, body: `${Math.abs(c) === 1 && t ? '' : Math.abs(c)}${t}` });
  });
  return parts.map((q, i) => (i === 0 ? `${q.neg ? '-' : ''}${q.body}` : ` ${q.neg ? '-' : '+'} ${q.body}`)).join('');
};
const facOf = r => (Number.isInteger(r.v) ? [1, -r.v] : [2, -2 * r.v]);
const QUAD = { 1: ['0^\\circ < \\theta < 90^\\circ', 'acute'], 2: ['90^\\circ < \\theta < 180^\\circ', 'obtuse'], 3: ['180^\\circ < \\theta < 270^\\circ', ''], 4: ['270^\\circ < \\theta < 360^\\circ', ''] };

const trig = [
  // T1 · D1 · given one ratio of an angle in a stated quadrant, find another (Pythagorean identity and the sign)
  V([1], rng => {
    const [a, b, c] = rc(rng, TRIPLES), sc = ri(rng, 1, 2);
    const A = a * sc, B = b * sc, C = c * sc;
    rej(sc > 1 && c > 17);
    const known = rc(rng, ['sin', 'cos']);
    const quad = ri(rng, 1, 2);
    const kv = known === 'sin' ? A : B, ov = known === 'sin' ? B : A;
    const sign = known === 'sin' ? (quad === 1 ? 1 : -1) : 1;
    // quad 1: both positive. quad 2: sin positive, cos negative.
    const given = known === 'sin' ? fr(A, C) : fr(quad === 1 ? B : -B, C);
    const want = known === 'sin' ? 'cos' : 'sin';
    const wantVal = known === 'sin' ? (quad === 1 ? B : -B) : A;
    void kv; void ov; void sign;
    return Fr(`The angle $\\theta$ satisfies $${QUAD[quad][0]}$ and $\\${known}\\theta = ${given}$. Find $\\${want}\\theta$.`, wantVal, C, {
      traps: [[-wantVal / C, `In the ${quad === 1 ? 'first' : 'second'} quadrant, ${want === 'cos' ? (quad === 1 ? 'cosine is positive' : 'cosine is negative') : 'sine is positive'}. Check the sign.`], [(known === 'sin' ? A : B) / C, 'This is the ratio you were given. Use $\\sin^2\\theta + \\cos^2\\theta = 1$ to find the other one.']],
      hints: ['Use $\\sin^2\\theta + \\cos^2\\theta = 1$.', `Substitute the given value and solve for $\\${want}^2\\theta$.`, `Take the square root. Both signs are possible: use the quadrant to choose.`, `In this quadrant $\\${want}\\theta$ is ${wantVal < 0 ? 'negative' : 'positive'}.`],
      steps: [['Pythagorean identity', `$\\${want}^2\\theta = 1 - \\left(${given}\\right)^2 = ${fr(wantVal * wantVal, C * C)}$`], ['Square root', `$\\${want}\\theta = \\pm ${fr(Math.abs(wantVal), C)}$`], ['Choose the sign', `${QUAD[quad][0] ? `$${QUAD[quad][0]}$` : ''}: $\\${want}\\theta = ${fr(wantVal, C)}$`]],
      audit: { kind: 'trigfrom', C, A, B, known, quad, want: wantVal / C, wantName: want }
    });
  }),

  // T2 · D1 · which expression is identical to this one? (choose the identity)
  V([1], rng => {
    const v = rc(rng, ['\\theta', 'x', '\\alpha', 'A']);
    const forms = [
      { e: `1 - \\cos^2 ${v}`, k: `\\sin^2 ${v}` },
      { e: `1 - \\sin^2 ${v}`, k: `\\cos^2 ${v}` },
      { e: `\\dfrac{\\sin ${v}}{\\cos ${v}}`, k: `\\tan ${v}` },
      { e: `\\sin ${v}\\cos ${v} \\times \\dfrac{\\sin ${v}}{\\cos ${v}}`, k: `\\sin^2 ${v}` },
      { e: `\\dfrac{1 - \\cos^2 ${v}}{\\sin ${v}}`, k: `\\sin ${v}` },
      { e: `\\dfrac{1 - \\sin^2 ${v}}{\\cos ${v}}`, k: `\\cos ${v}` },
      { e: `\\cos ${v}\\tan ${v}`, k: `\\sin ${v}` },
      { e: `\\sin^2 ${v} + \\cos^2 ${v} - \\cos^2 ${v}`, k: `\\sin^2 ${v}` }
    ];
    const f = rc(rng, forms);
    const pool = [`\\sin ${v}`, `\\cos ${v}`, `\\tan ${v}`, `\\sin^2 ${v}`, `\\cos^2 ${v}`, `1`, `\\tan^2 ${v}`, `-\\sin ${v}`].filter(x => x !== f.k);
    const ds = rs(rng, pool).slice(0, 3).map(t => ({ text: `$${t}$`, why: 'Test this against a value such as $\\theta = 30^\\circ$ or return to the identity: it does not simplify to this.' }));
    return M(rng, `Which expression is identical to $${f.e}$ for every angle for which both are defined?`, `$${f.k}$`, ds, {
      hints: ['Look for $\\sin^2 + \\cos^2 = 1$ or $\\tan = \\dfrac{\\sin}{\\cos}$ in the expression.', 'Rearrange the Pythagorean identity so that it gives the part you need.', 'Replace the matching part, then cancel common factors.', 'Check your result by substituting an angle such as $30^\\circ$.'],
      steps: [['Spot the identity', 'Use $1 - \\cos^2 = \\sin^2$, $1 - \\sin^2 = \\cos^2$ or $\\tan = \\dfrac{\\sin}{\\cos}$.'], ['Simplify', `$${f.e} = ${f.k}$`]],
      audit: { kind: 'trigsimplify', e: f.e, k: f.k }
    });
  }),

  // T11 · D1 · from a squared ratio to another squared ratio
  V([1], rng => {
    const [a, b, c] = rc(rng, TRIPLES);
    const br = ri(rng, 0, 2);
    const A2 = a * a, B2 = b * b, C2 = c * c;
    if (br === 0) {
      return Fr(`$\\sin^2\\theta = ${fr(A2, C2)}$. Find $\\cos^2\\theta$.`, B2, C2, {
        traps: [[A2 / C2 - 1, 'Subtract from 1: $\\cos^2\\theta = 1 - \\sin^2\\theta$ is positive.'], [b / c, 'This is $\\cos\\theta$. The question asks for $\\cos^2\\theta$.']],
        hints: ['Use $\\sin^2\\theta + \\cos^2\\theta = 1$.', 'Rearrange for $\\cos^2\\theta$.', `$\\cos^2\\theta = 1 - ${fr(A2, C2)}$.`, 'Write 1 with the same denominator.'],
        steps: [['Identity', '$\\cos^2\\theta = 1 - \\sin^2\\theta$'], ['Substitute', `$1 - ${fr(A2, C2)} = ${fr(B2, C2)}$`]],
        audit: { kind: 'trigsq', ask: 'cos2fromsin2', C2, A2, expect: B2 / C2 }
      });
    }
    if (br === 1) {
      const s = rc(rng, [-1, 1]);
      return Fr(`Given $\\cos\\theta = ${fr(s * b, c)}$, find the value of $1 - \\sin^2\\theta$.`, B2, C2, {
        traps: [[s * b / c, '$1 - \\sin^2\\theta$ equals $\\cos^2\\theta$, the square of the cosine, which cannot be negative.'], [A2 / C2, 'That is $\\sin^2\\theta$. The expression is $1 - \\sin^2\\theta$.']],
        hints: ['Is $1 - \\sin^2\\theta$ a familiar expression?', 'It equals $\\cos^2\\theta$.', `Square the given cosine: $\\left(${fr(s * b, c)}\\right)^2$.`, 'A negative number squared is positive.'],
        steps: [['Identity', '$1 - \\sin^2\\theta = \\cos^2\\theta$'], ['Square', `$\\left(${fr(s * b, c)}\\right)^2 = ${fr(B2, C2)}$`]],
        audit: { kind: 'trigsq', ask: 'oneminussin2', C2, A2, expect: B2 / C2 }
      });
    }
    const s = rc(rng, [-1, 1]);
    return Fr(`Given $\\sin\\theta = ${fr(s * a, c)}$, find the value of $\\cos^2\\theta + 2\\sin^2\\theta$.`, C2 + A2, C2, {
      traps: [[3 * A2 / C2, 'Replace $\\cos^2\\theta$ using $\\cos^2\\theta = 1 - \\sin^2\\theta$ rather than $\\sin^2\\theta$.'], [1, 'Only $\\sin^2\\theta + \\cos^2\\theta$ equals 1. Here there are two lots of $\\sin^2\\theta$.']],
      hints: ['Write $\\cos^2\\theta + 2\\sin^2\\theta = (\\cos^2\\theta + \\sin^2\\theta) + \\sin^2\\theta$.', 'The bracket equals 1.', `So the value is $1 + \\sin^2\\theta$.`, `$\\sin^2\\theta = \\left(${fr(s * a, c)}\\right)^2$.`],
      steps: [['Split', '$\\cos^2\\theta + 2\\sin^2\\theta = 1 + \\sin^2\\theta$'], ['Square', `$\\sin^2\\theta = ${fr(A2, C2)}$`], ['Add', `$1 + ${fr(A2, C2)} = ${fr(C2 + A2, C2)}$`]],
      audit: { kind: 'trigsq', ask: 'mixed', C2, A2, expect: (C2 + A2) / C2 }
    });
  }),

  // T12 · D1 · which statement is true for every angle? (distinguish an identity from a false rule)
  V([1], rng => {
    const v = rc(rng, ['\\theta', 'x', '\\alpha', '\\beta', 'A', 'B']);
    const TRUE = [`\\sin^2 ${v} + \\cos^2 ${v} = 1`, `\\sin^2 ${v} = 1 - \\cos^2 ${v}`, `\\cos^2 ${v} = 1 - \\sin^2 ${v}`, `\\tan ${v} = \\dfrac{\\sin ${v}}{\\cos ${v}}`];
    const FALSE = [`\\sin ${v} + \\cos ${v} = 1`, `\\sin^2 ${v} - \\cos^2 ${v} = 1`, `\\cos^2 ${v} = 1 + \\sin^2 ${v}`, `\\tan ${v} = \\dfrac{\\cos ${v}}{\\sin ${v}}`, `\\sin^2 ${v} = \\cos^2 ${v} - 1`, `\\tan ${v} = \\sin ${v}\\cos ${v}`];
    const key = rc(rng, TRUE);
    const ds = rs(rng, FALSE).slice(0, 3).map(t => ({ text: `$${t}$`, why: 'This fails for an angle such as $30^\\circ$. Only the Pythagorean and quotient identities hold for every angle.' }));
    return M(rng, `Which one of these statements is true for every angle $${v}$ for which it is defined?`, `$${key}$`, ds, {
      hints: ['Test each statement with an angle such as $30^\\circ$ or $0^\\circ$.', '$\\sin 30^\\circ = \\tfrac12$ and $\\cos 30^\\circ = \\tfrac{\\sqrt3}{2}$.', 'One counterexample is enough to rule a statement out.', 'The true one matches the Pythagorean identity or the definition of tangent.'],
      steps: [['Test with an angle', 'At $30^\\circ$: $\\sin^2 + \\cos^2 = \\tfrac14 + \\tfrac34 = 1$ works; the others do not.'], ['Identify', `$${key}$`]],
      audit: { kind: 'trigtrue', key, wrong: FALSE }
    });
  }),

  // T14 · D1 · recognise sin^2 + cos^2 (and sin/cos = tan) behind an awkward angle instead of calculating
  V([1], rng => {
    const ang = () => rc(rng, [17, 23, 28, 34, 41, 52, 67, 73, 79, 36, 58]);
    const br = ri(rng, 0, 2);
    if (br === 0) {
      const a = ang(), m = ri(rng, 2, 7), k = nz(rng, -9, 9);
      return N(`Evaluate $${m}\\sin^2 ${a}^\\circ + ${m}\\cos^2 ${a}^\\circ ${sg(k)}$ without using a calculator.`, m + k, {
        traps: [[k, '$\\sin^2 + \\cos^2 = 1$ for the same angle, so the first two terms are $' + m + '\\times 1$.']],
        hints: ['The two angles are the same.', `Factor out $${m}$.`, '$\\sin^2 A + \\cos^2 A = 1$ for every angle $A$.', 'Then add the constant.'],
        steps: [['Factor', `$${m}(\\sin^2 ${a}^\\circ + \\cos^2 ${a}^\\circ) ${sg(k)}$`], ['Identity', `$${m}(1) ${sg(k)} = ${m + k}$`]],
        audit: { kind: 'trigexpr', js: `${m}*sin(${a})**2+${m}*cos(${a})**2+(${k})`, expect: m + k }
      });
    }
    if (br === 1) {
      const a = rc(rng, [20, 25, 35, 40, 15]);
      return N(`Evaluate $\\sin^2 ${a}^\\circ + \\cos^2 ${a}^\\circ + \\sin^2 ${90 - a}^\\circ + \\cos^2 ${90 - a}^\\circ$.`, 2, {
        traps: [[1, 'There are two separate angles, and each pair sums to 1.'], [4, 'Each pair $\\sin^2 + \\cos^2$ is 1, not 2.']],
        hints: [`There are two angles here: $${a}^\\circ$ and $${90 - a}^\\circ$.`, 'Group the terms by angle.', 'Each group is $\\sin^2 A + \\cos^2 A$.', 'Add the two groups.'],
        steps: [['Group by angle', `$(\\sin^2 ${a}^\\circ + \\cos^2 ${a}^\\circ) + (\\sin^2 ${90 - a}^\\circ + \\cos^2 ${90 - a}^\\circ)$`], ['Identity', '$1 + 1 = 2$']],
        audit: { kind: 'trigexpr', js: `sin(${a})**2+cos(${a})**2+sin(${90 - a})**2+cos(${90 - a})**2`, expect: 2 }
      });
    }
    const a = ang(), m = ri(rng, 2, 9);
    return N(`Evaluate $${m}\\sin^2 ${a}^\\circ + ${m}\\cos^2 ${a}^\\circ + \\tan ${a}^\\circ \\times \\dfrac{\\cos ${a}^\\circ}{\\sin ${a}^\\circ}$ without using a calculator.`, m + 1, {
      traps: [[m, 'The product $\\tan A \\times \\dfrac{\\cos A}{\\sin A}$ is $1$ (tangent is sine over cosine), not $0$.'], [2 * m, 'The last term is $1$, not $' + m + '$.']],
      hints: ['Two different identities are hiding here.', `Factor $${m}$ from the first two terms.`, '$\\tan A = \\dfrac{\\sin A}{\\cos A}$, so the last term is a number.', 'Add the three pieces.'],
      steps: [['Pythagorean identity', `$${m}(\\sin^2 ${a}^\\circ + \\cos^2 ${a}^\\circ) = ${m}$`], ['Quotient identity', `$\\tan ${a}^\\circ \\times \\dfrac{\\cos ${a}^\\circ}{\\sin ${a}^\\circ} = \\dfrac{\\sin}{\\cos}\\times\\dfrac{\\cos}{\\sin} = 1$`], ['Add', `$${m} + 1 = ${m + 1}$`]],
      audit: { kind: 'trigexpr', js: `${m}*sin(${a})**2+${m}*cos(${a})**2+tan(${a})*cos(${a})/sin(${a})`, expect: m + 1 }
    });
  }),

  // S1 · D2, D4 · a linear equation in a trigonometric ratio: rearrange, then find every solution
  V([2, 4], (rng, d) => {
    const fn = rc(rng, d === 2 ? ['sin', 'cos', 'tan'] : ['sin', 'cos']);
    const rows = SPEC[fn].filter(r => ['\\tfrac12', '-\\tfrac12', '1', '-1', '0'].includes(r.t));
    const row = rc(rng, rows);
    const a = ri(rng, 2, 6), b = nz(rng, -7, 7);
    const c = a * row.v + b;
    rej(!Number.isInteger(c) || (d === 2 && row.s.length !== 2));
    const sol = solveIn(FN[fn], row, 0, 360);
    return S(`Solve $${a}\\${fn}\\theta ${sg(b)} = ${c}$ for $0^\\circ \\le \\theta \\le 360^\\circ$. Give every solution in degrees.`, sol, {
      suffix: '°',
      traps: [[sol[0], sol.length === 1 ? '' : 'There is more than one solution in the interval. Find them all.']].filter(t => sol.length > 1),
      hints: [`Isolate $\\${fn}\\theta$ first.`, `$${a}\\${fn}\\theta = ${c - b}$, so $\\${fn}\\theta = ${row.t.replace('\\tfrac', '\\dfrac')}$.`, 'Find the reference angle from the exact value.', `Use the quadrants where $\\${fn}$ has that sign, and check the ends of the interval.`],
      steps: [['Isolate', `$\\${fn}\\theta = ${row.t.replace('\\tfrac', '\\dfrac')}$`], ['Reference angle and quadrants', `Solutions: $${sol.map(x => `${x}^\\circ`).join(', ')}$`]],
      audit: { kind: 'trigsolve', fn, v: row.v, lo: 0, hi: 360, expect: sol, lin: [a, b, c] }
    });
  }),

  // S2 · D2, D4 · sine and cosine on opposite sides: divide to make a tangent
  V([2, 4], (rng, d) => {
    const OPT = [
      { t: '1', L: '\\sin\\theta', R: '\\cos\\theta', i: 0, lc: 1, rc: 1 }, { t: '-1', L: '\\sin\\theta', R: '-\\cos\\theta', i: 1, lc: 1, rc: -1 },
      { t: '\\sqrt3', L: '\\sin\\theta', R: '\\sqrt{3}\\cos\\theta', i: 2, lc: 1, rc: Math.sqrt(3) }, { t: '-\\sqrt3', L: '\\sin\\theta', R: '-\\sqrt{3}\\cos\\theta', i: 3, lc: 1, rc: -Math.sqrt(3) },
      { t: '\\tfrac{1}{\\sqrt3}', L: '\\sqrt{3}\\sin\\theta', R: '\\cos\\theta', i: 4, lc: Math.sqrt(3), rc: 1 }, { t: '-\\tfrac{1}{\\sqrt3}', L: '\\sqrt{3}\\sin\\theta', R: '-\\cos\\theta', i: 5, lc: Math.sqrt(3), rc: -1 }
    ];
    const o = d === 2 ? rc(rng, OPT.slice(0, 2)) : rc(rng, OPT);
    const row = SPEC.tan[o.i], k = ri(rng, 1, 5);
    const sol = solveIn(Math.tan, row, 0, 360).filter(x => x > 0 && x < 360);
    const kk = k === 1 ? '' : String(k);
    return S(`Solve $${kk}${o.L} = ${kk}${o.R}$ for $0^\\circ \\le \\theta \\le 360^\\circ$. Give every solution in degrees.`, sol, {
      suffix: '°',
      traps: [[sol[0], 'There are two solutions in the interval: tangent has period $180^\\circ$.']],
      hints: ['Divide both sides by $\\cos\\theta$ (it is not zero at any solution).', 'Use $\\dfrac{\\sin\\theta}{\\cos\\theta} = \\tan\\theta$.', 'Find the exact value of $\\tan\\theta$ and its reference angle.', 'Tangent repeats every $180^\\circ$, so add $180^\\circ$ for the second solution.'],
      steps: [['Divide by cosine', `$\\tan\\theta = ${o.t.replace('\\tfrac', '\\dfrac')}$`], ['Solutions', `$\\theta = ${sol.map(x => `${x}^\\circ`).join('$ or $')}$`]],
      audit: { kind: 'trigsolve2', lc: o.lc * k, rc: o.rc * k, expect: sol }
    });
  }),

  // S6 · D2, D4 · the interval is different: negative angles, or two full turns
  V([2, 4], (rng, d) => {
    const fn = rc(rng, ['sin', 'cos', 'tan']);
    const row = rc(rng, SPEC[fn].filter(r => r.s.length === 2));
    const wide = rc(rng, [0, 1]);
    const [lo, hi] = wide ? [-180, 180] : [0, 720];
    const sol = solveIn(FN[fn], row, lo, hi);
    const sorted = sol.slice();
    return S(`Solve $\\${fn}\\theta = ${row.t.replace('\\tfrac', '\\dfrac')}$ for $${lo}^\\circ \\le \\theta \\le ${hi}^\\circ$. Give every solution in degrees.`, sorted, {
      suffix: '°',
      traps: [[row.s[0], 'The interval is not $0^\\circ$ to $360^\\circ$. Extend the solutions in both directions using the period.']],
      hints: ['Find the solutions in $0^\\circ$ to $360^\\circ$ first.', `Add or subtract full turns ($360^\\circ$) to cover $${lo}^\\circ$ to $${hi}^\\circ$.`, wide ? 'For negative angles subtract $360^\\circ$ from a solution above $180^\\circ$.' : 'Add $360^\\circ$ to each solution to cover the second turn.', 'Check each answer lies inside the interval.'],
      steps: [['Principal solutions', `In $0^\\circ$ to $360^\\circ$: $${row.s.map(x => `${x}^\\circ`).join(', ')}$`], ['Move into the interval', `All solutions: $${sorted.map(x => `${x}^\\circ`).join(', ')}$`]],
      audit: { kind: 'trigsolve', fn, v: row.v, lo, hi, expect: sorted }
    });
  }),

  // S9 · D2 · reference angle
  V([2], rng => {
    const fn = rc(rng, ['sin', 'cos', 'tan']);
    const row = rc(rng, SPEC[fn].filter(r => r.v < 0 && r.s.length === 2));
    let ref = null;
    for (let dd = 1; dd < 90; dd++) if (Math.abs(FN[fn](rad(dd)) - Math.abs(row.v)) < 1e-9) ref = dd;
    rej(ref == null || (fn === 'tan' && Math.abs(row.v) === 1 && false));
    return N(`The equation $\\${fn}\\theta = ${row.t.replace('\\tfrac', '\\dfrac')}$ has solutions $${row.s.map(x => `${x}^\\circ`).join('$ and $')}$ for $0^\\circ \\le \\theta \\le 360^\\circ$. What is the acute reference angle?`, ref, {
      suffix: '°',
      traps: [[90 - ref, 'The reference angle uses the POSITIVE value $' + `\\${fn}` + '\\theta$: ignore the negative sign.'], [row.s[0], 'That is a solution, not the acute reference angle.']],
      hints: ['The reference angle is the acute angle with the same ratio, ignoring the sign.', 'Use the positive value of the ratio.', 'Recall the exact values of sine, cosine and tangent at the special angles.', 'Which special angle gives that value?'],
      steps: [['Ignore the sign', `$\\${fn}\\,\\alpha = ${row.t.replace('\\tfrac', '\\dfrac').replace('-', '')}$ with $\\alpha$ acute`], ['Special angle', `$\\alpha = ${ref}^\\circ$`]],
      audit: { kind: 'trigref', fn, v: row.v, expect: ref }
    });
  }),

  // S10 · D2 · the other solution from the first, by symmetry
  V([2], rng => {
    const fn = rc(rng, ['sin', 'cos', 'tan']);
    const row = rc(rng, SPEC[fn].filter(r => r.s.length === 2));
    const first = row.s[0], other = row.s[1];
    const how = fn === 'sin' ? 'sine is positive or negative in a pair of quadrants that mirror about the vertical axis: $180^\\circ - \\theta$' : fn === 'cos' ? 'cosine solutions mirror about the horizontal axis: $360^\\circ - \\theta$' : 'tangent repeats every $180^\\circ$: $\\theta + 180^\\circ$';
    return N(`One solution of $\\${fn}\\theta = ${row.t.replace('\\tfrac', '\\dfrac')}$ for $0^\\circ \\le \\theta \\le 360^\\circ$ is $\\theta = ${first}^\\circ$. Find the other solution in the interval.`, other, {
      suffix: '°',
      traps: [[fn === 'tan' ? 360 - first : fn === 'sin' ? 360 - first : 180 - first, 'Check which symmetry applies to this ratio: ' + (fn === 'sin' ? 'sine uses $180^\\circ - \\theta$' : fn === 'cos' ? 'cosine uses $360^\\circ - \\theta$' : 'tangent uses $\\theta + 180^\\circ$') + '.'].filter(Boolean)],
      hints: ['Think of the quadrants the ratio can have this sign in.', `For ${fn}: ${how}.`, `Apply it to $${first}^\\circ$.`, 'Check the result lies in $0^\\circ$ to $360^\\circ$ and gives the same ratio.'],
      steps: [['Symmetry', fn === 'sin' ? `$180^\\circ - ${first}^\\circ$` : fn === 'cos' ? `$360^\\circ - ${first}^\\circ$` : `$${first}^\\circ + 180^\\circ$`], ['Other solution', `$\\theta = ${other}^\\circ$`]],
      audit: { kind: 'trigother', fn, v: row.v, first, expect: other }
    });
  }),

  // S4 · D4 · a quadratic in a trigonometric ratio: factorise, then discard impossible values
  V([4], rng => {
    const fn = rc(rng, ['sin', 'cos']);
    const vals = [{ v: 0.5, t: '\\tfrac12' }, { v: -0.5, t: '-\\tfrac12' }, { v: 1, t: '1' }, { v: -1, t: '-1' }];
    const r1 = rc(rng, vals), r2 = rc(rng, vals);
    rej(r1.v === r2.v);
    const bad = rng() < 0.5 ? rc(rng, [{ v: 2, t: '2' }, { v: -2, t: '-2' }, { v: 1.5, t: '\\tfrac32' }]) : null;
    const rB = bad || r2;
    // (a s - p)(b s - q) with s = p/a etc.: use factors (2s - 1) style via fractions
    const [a1, c1] = facOf(r1), [a2, c2] = facOf(rB);
    const A = a1 * a2, Bc = a1 * c2 + a2 * c1, C = c1 * c2;
    const eqn = `${ratioQuad(fn, A, Bc, C)} = 0`;
    const rows = [r1, ...(bad ? [] : [r2])].map(r => SPEC[fn].find(x => Math.abs(x.v - r.v) < 1e-9));
    const sol = [...new Set(rows.flatMap(r => solveIn(FN[fn], r, 0, 360)))].sort((x, y) => x - y);
    return S(`Solve $${eqn}$ for $0^\\circ \\le \\theta \\le 360^\\circ$. Give every solution in degrees.`, sol, {
      suffix: '°',
      traps: [[sol[0], 'Check whether more than one value of the ratio is possible, and how many angles each gives.']],
      hints: [`Treat $\\${fn}\\theta$ as a single unknown and factorise the quadratic.`, 'Solve each factor for the ratio.', bad ? `A $\\${fn}$ ratio can never be outside $-1$ to $1$: reject any factor that gives such a value.` : 'Find every angle for each value of the ratio, including the ends of the interval.', 'Collect the solutions in order.'],
      steps: [['Factorise', `$(${a1 === 1 ? '' : a1}\\${fn}\\theta ${sg(c1)})(${a2 === 1 ? '' : a2}\\${fn}\\theta ${sg(c2)}) = 0$`], ['Values of the ratio', `$\\${fn}\\theta = ${r1.t}$ or $\\${fn}\\theta = ${rB.t}$`], ['Angles', `$${sol.map(x => `${x}^\\circ`).join(', ')}$${bad ? ' (the value outside $[-1, 1]$ gives none)' : ''}`]],
      audit: { kind: 'trigquad', fn, A, B: Bc, C, expect: sol }
    });
  }),

  // S5 · D4 · an equation with the other ratio squared: use the Pythagorean identity first
  V([4], rng => {
    const fn = rc(rng, ['sin', 'cos']);
    const other = fn === 'sin' ? 'cos' : 'sin';
    const vals = [{ v: 0.5, t: '\\tfrac12' }, { v: -0.5, t: '-\\tfrac12' }, { v: 1, t: '1' }, { v: -1, t: '-1' }, { v: 0, t: '0' }];
    const r1 = rc(rng, vals), r2 = rc(rng, vals);
    rej(r1.v === r2.v);
    const a = 4;
    const Bc = a * (r1.v + r2.v), Cc = a * (1 + r1.v * r2.v);
    rej(!Number.isInteger(Bc) || !Number.isInteger(Cc));
    const eqn = `${a}\\${other}^2\\theta ${Bc === 0 ? '' : `${Bc > 0 ? '+' : '-'} ${Math.abs(Bc) === 1 ? '' : Math.abs(Bc)}\\${fn}\\theta`} = ${Cc}`;
    const rows = [r1, r2].map(r => SPEC[fn].find(x => Math.abs(x.v - r.v) < 1e-9));
    const sol = [...new Set(rows.flatMap(r => solveIn(FN[fn], r, 0, 360)))].sort((x, y) => x - y);
    return S(`Solve $${eqn}$ for $0^\\circ \\le \\theta \\le 360^\\circ$. Give every solution in degrees.`, sol, {
      suffix: '°',
      traps: [[sol[0], 'Collect every angle from each value of the ratio.']],
      hints: [`The equation has $\\${other}^2\\theta$ but also $\\${fn}\\theta$. Replace $\\${other}^2\\theta$ using $\\${other}^2\\theta = 1 - \\${fn}^2\\theta$.`, `Rearrange into a quadratic in $\\${fn}\\theta$ and factorise.`, `Solve for $\\${fn}\\theta$ (two values).`, 'Find every angle for each value, including the ends of the interval.'],
      steps: [['Use the identity', `$${a}(1 - \\${fn}^2\\theta) ${Bc === 0 ? '' : `${Bc > 0 ? '+' : '-'} ${Math.abs(Bc)}\\${fn}\\theta`} = ${Cc}$`], ['Quadratic in ' + fn, `$\\${fn}\\theta = ${r1.t}$ or $\\${fn}\\theta = ${r2.t}$`], ['Angles', `$${sol.map(x => `${x}^\\circ`).join(', ')}$`]],
      audit: { kind: 'trigid', fn, other, a, B: Bc, C: Cc, expect: sol }
    });
  }),

  // S12 · D4 · a squared ratio: two signs, four solutions
  V([4], rng => {
    const fn = rc(rng, ['sin', 'cos', 'tan']);
    const opts = fn === 'tan' ? [{ n: 3, d: 1, t: '3', v: Math.sqrt(3) }, { n: 1, d: 3, t: '\\tfrac13', v: 1 / Math.sqrt(3) }, { n: 1, d: 1, t: '1', v: 1 }] : [{ n: 3, d: 4, t: '\\tfrac34', v: Math.sqrt(3) / 2 }, { n: 1, d: 4, t: '\\tfrac14', v: 0.5 }, { n: 1, d: 2, t: '\\tfrac12', v: Math.SQRT1_2 }];
    const o = rc(rng, opts), a = ri(rng, 2, 4);
    const rhs = fr(o.n * a, o.d);
    const rowP = SPEC[fn].find(r => Math.abs(r.v - o.v) < 1e-9), rowN = SPEC[fn].find(r => Math.abs(r.v + o.v) < 1e-9);
    const sol = [...solveIn(FN[fn], rowP, 0, 360), ...solveIn(FN[fn], rowN, 0, 360)].sort((x, y) => x - y);
    return S(`Solve $${a}\\${fn}^2\\theta = ${rhs}$ for $0^\\circ \\le \\theta \\le 360^\\circ$. Give every solution in degrees.`, sol, {
      suffix: '°',
      traps: [[rowP.s[0], 'Taking a square root gives a positive AND a negative value. There are four solutions here.']],
      hints: [`Divide by $${a}$ to isolate $\\${fn}^2\\theta$.`, `Take the square root of both sides: remember the $\\pm$.`, 'Solve each of the two equations in the interval.', 'Together there are four solutions: one in each quadrant.'],
      steps: [['Isolate', `$\\${fn}^2\\theta = ${fr(o.n, o.d)}$`], ['Square root', `$\\${fn}\\theta = \\pm ${fn === 'tan' ? (o.n === 1 && o.d === 1 ? '1' : o.n === 3 ? '\\sqrt3' : '\\dfrac{1}{\\sqrt3}') : (o.d === 4 && o.n === 3 ? '\\dfrac{\\sqrt3}{2}' : o.d === 4 ? '\\dfrac12' : '\\dfrac{\\sqrt2}{2}')}$`], ['Solutions', `$${sol.map(x => `${x}^\\circ`).join(', ')}$`]],
      audit: { kind: 'trigsq2', fn, a, n: o.n * a, d: o.d, expect: sol }
    });
  }),

  // C1 · D3 · how many solutions over a longer or different interval
  V([3], rng => {
    const fn = rc(rng, ['sin', 'cos', 'tan']);
    const row = rc(rng, SPEC[fn]);
    const turns = rc(rng, [2, 3]);
    const hi = 360 * turns;
    const cnt = solveIn(FN[fn], row, 0, hi).length;
    return N(`How many solutions does $\\${fn}\\theta = ${row.t.replace('\\tfrac', '\\dfrac')}$ have for $0^\\circ \\le \\theta \\le ${hi}^\\circ$?`, cnt, {
      traps: [[solveIn(FN[fn], row, 0, 360).length * turns, 'Count carefully at the ends of the interval: an angle at $0^\\circ$ or a multiple of $360^\\circ$ may be a solution that is shared by two turns.']].filter(t => t[0] !== cnt),
      hints: ['Count the solutions in one full turn first.', 'Each extra full turn repeats them.', 'Watch the ends: both $0^\\circ$ and the last multiple of $360^\\circ$ are included.', 'Add them up, taking care not to double count a shared end angle.'],
      steps: [['One turn', `$${solveIn(FN[fn], row, 0, 360).map(x => `${x}^\\circ`).join(', ')}$`], ['Whole interval', `$${solveIn(FN[fn], row, 0, hi).length}$ solutions`]],
      audit: { kind: 'trigcount', fn, v: row.v, lo: 0, hi, expect: cnt }
    });
  }),

  // C2 · D3 · count the solutions of a quadratic in a ratio
  V([3], rng => {
    const fn = rc(rng, ['sin', 'cos']);
    const vals = [{ v: 0.5, t: '\\tfrac12' }, { v: -0.5, t: '-\\tfrac12' }, { v: 1, t: '1' }, { v: -1, t: '-1' }, { v: 0, t: '0' }];
    const r1 = rc(rng, vals), r2 = rc(rng, vals);
    rej(r1.v === r2.v);
    const [a1, c1] = facOf(r1), [a2, c2] = facOf(r2);
    const A = a1 * a2, Bc = a1 * c2 + a2 * c1, C = c1 * c2;
    const eqn = `${ratioQuad(fn, A, Bc, C)} = 0`;
    const rows = [r1, r2].map(r => SPEC[fn].find(x => Math.abs(x.v - r.v) < 1e-9));
    const sol = [...new Set(rows.flatMap(r => solveIn(FN[fn], r, 0, 360)))];
    return N(`How many solutions does $${eqn}$ have for $0^\\circ \\le \\theta \\le 360^\\circ$?`, sol.length, {
      traps: [[rows.reduce((n, r) => n + (r.s.length > 0 ? 2 : 0), 0), 'Values of $\\pm 1$ give one angle and $0$ gives more than two in this interval, not two each.']].filter(t => t[0] !== sol.length),
      hints: [`Factorise as a quadratic in $\\${fn}\\theta$.`, `Find the two values of $\\${fn}\\theta$.`, `Count the angles for each value: $\\pm\\tfrac12$ gives 2, $\\pm 1$ gives 1 (or 2 for cosine at $0^\\circ$ and $360^\\circ$), $0$ gives 2 or 3.`, 'Add the counts, taking care if the two values share an angle.'],
      steps: [['Factorise', `$\\${fn}\\theta = ${r1.t}$ or $\\${fn}\\theta = ${r2.t}$`], ['Count', `$${rows.map(r => solveIn(FN[fn], r, 0, 360).length).join(' + ')} = ${sol.length}$`]],
      audit: { kind: 'trigquadcount', fn, A, B: Bc, C, expect: sol.length }
    });
  }),

  // C4 · D3 · which equation has exactly this many solutions? (spot the special values)
  V([3], rng => {
    const want = rc(rng, [0, 1, 2]);
    const pool = [
      ...SPEC.sin.map(r => ({ f: 'sin', r })), ...SPEC.cos.map(r => ({ f: 'cos', r })), ...SPEC.tan.map(r => ({ f: 'tan', r }))
    ].filter(x => x.r.t !== '\\tfrac{\\sqrt2}{2}' && x.r.t !== '-\\tfrac{\\sqrt2}{2}');
    const withCount = c => pool.filter(x => solveIn(FN[x.f], x.r, 0, 360).length === c);
    let cands = withCount(want);
    if (want === 0) cands = [{ f: 'sin', r: { t: '\\tfrac32', v: 1.5, s: [] } }, { f: 'cos', r: { t: '-2', v: -2, s: [] } }, { f: 'sin', r: { t: '-\\tfrac54', v: -1.25, s: [] } }];
    const key = rc(rng, cands);
    const others = rs(rng, pool.filter(x => solveIn(FN[x.f], x.r, 0, 360).length !== want)).slice(0, 3);
    const tex = x => `$\\${x.f}\\theta = ${x.r.t.replace('\\tfrac', '\\dfrac')}$`;
    return M(rng, `Exactly one of these equations has ${want === 0 ? 'no solutions' : want === 1 ? 'exactly one solution' : 'exactly two solutions'} for $0^\\circ \\le \\theta \\le 360^\\circ$. Which one? (The other three have a different number of solutions.)`, tex(key), others.map(x => ({ text: tex(x), why: `This has ${solveIn(FN[x.f], x.r, 0, 360).length} solution${solveIn(FN[x.f], x.r, 0, 360).length === 1 ? '' : 's'} in the interval.` })), {
      hints: ['A sine or cosine value strictly between $-1$ and $1$ is reached twice in one turn.', 'The values $1$ and $-1$ are reached once, except that $\\cos\\theta = 1$ is reached at both $0^\\circ$ and $360^\\circ$.', '$\\sin\\theta = 0$ is reached three times in the closed interval; a value outside $[-1, 1]$ is never reached.', 'Count the solutions for each option and match the number asked for.'],
      steps: [['Count', `${[key, ...others].map(x => `${tex(x)}: ${solveIn(FN[x.f], x.r, 0, 360).length}`).join('; ')}`], ['Answer', tex(key)]],
      audit: { kind: 'trigcountmc', want, key: { f: key.f, v: key.r.v }, others: others.map(x => ({ f: x.f, v: x.r.v })) }
    });
  }),

  // C5 · D3 · a multiple of the ratio equals a constant: check whether the value is even possible
  V([3], rng => {
    const fn = rc(rng, ['sin', 'cos']);
    const a = ri(rng, 2, 6);
    const ratio = rc(rng, [0, 1, -1, 0.5, -0.5, 1.5, -1.5, 2, -2]);
    const b = a * ratio;
    rej(!Number.isInteger(b));
    const row = ratio === 0 ? { v: 0, s: fn === 'sin' ? [0, 180, 360] : [90, 270] } : Math.abs(ratio) > 1 ? { v: ratio, s: [] } : SPEC[fn].find(r => Math.abs(r.v - ratio) < 1e-9);
    const cnt = row.s.length;
    return N(`How many solutions does $${a}\\${fn}\\theta = ${b}$ have for $0^\\circ \\le \\theta \\le 360^\\circ$?`, cnt, {
      traps: [[Math.abs(ratio) > 1 ? 2 : (cnt === 2 ? 1 : 2), 'Divide by the coefficient first, then ask whether the value is possible and how many angles reach it.']],
      hints: [`Divide both sides by $${a}$ to find the value of $\\${fn}\\theta$.`, `Is that value between $-1$ and $1$?`, 'A value outside that range is never reached. Inside it, count the angles in one turn.', 'Remember the special values $0$ and $\\pm 1$.'],
      steps: [['Isolate', `$\\${fn}\\theta = ${fr(b, a)}$`], ['Possible?', Math.abs(ratio) > 1 ? 'Outside $[-1, 1]$: no solutions' : `Inside $[-1, 1]$: ${cnt} angle${cnt === 1 ? '' : 's'} in the interval`], ['Count', `$${cnt}$`]],
      audit: { kind: 'trigcount', fn, v: ratio, lo: 0, hi: 360, expect: cnt }
    });
  }),

  // C3 · D3 · count solutions of an equation needing the identity first
  V([3], rng => {
    const fn = rc(rng, ['sin', 'cos']);
    const other = fn === 'sin' ? 'cos' : 'sin';
    const vals = [{ v: 0.5, t: '\\tfrac12' }, { v: -0.5, t: '-\\tfrac12' }, { v: 1, t: '1' }, { v: -1, t: '-1' }, { v: 0, t: '0' }];
    const r1 = rc(rng, vals), r2 = rc(rng, vals);
    rej(r1.v === r2.v);
    const a = 4, Bc = a * (r1.v + r2.v), Cc = a * (1 + r1.v * r2.v);
    rej(!Number.isInteger(Bc) || !Number.isInteger(Cc));
    const eqn = `${a}\\${other}^2\\theta ${Bc === 0 ? '' : `${Bc > 0 ? '+' : '-'} ${Math.abs(Bc) === 1 ? '' : Math.abs(Bc)}\\${fn}\\theta`} = ${Cc}`;
    const rows = [r1, r2].map(r => SPEC[fn].find(x => Math.abs(x.v - r.v) < 1e-9));
    const sol = [...new Set(rows.flatMap(r => solveIn(FN[fn], r, 0, 360)))];
    return N(`How many solutions does $${eqn}$ have for $0^\\circ \\le \\theta \\le 360^\\circ$?`, sol.length, {
      traps: [[2, 'Convert to a single ratio, factorise, then count the angles from each value.']].filter(t => t[0] !== sol.length),
      hints: [`Use $\\${other}^2\\theta = 1 - \\${fn}^2\\theta$ so only one ratio remains.`, `Rearrange to a quadratic in $\\${fn}\\theta$ and factorise.`, 'Find both values of the ratio.', 'Count the angles each value gives, and do not double count.'],
      steps: [['Use the identity', `$${a}(1 - \\${fn}^2\\theta) ${Bc === 0 ? '' : `${Bc > 0 ? '+' : '-'} ${Math.abs(Bc)}\\${fn}\\theta`} = ${Cc}$`], ['Values', `$\\${fn}\\theta = ${r1.t}$ or $${r2.t}$`], ['Count', `$${sol.length}$ solutions`]],
      audit: { kind: 'trigidcount', fn, other, a, B: Bc, C: Cc, expect: sol.length }
    });
  })
];

export const forms = { 'y11-explog-more': explog, 'y11-trig-ident': trig };
