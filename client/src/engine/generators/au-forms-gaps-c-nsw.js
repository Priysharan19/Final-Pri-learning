// Prithagoras content-gap forms (Further Calculus, Extension 1 Year 12). Variants are chosen by au-forms-apply.js.
// me12-calc, dot point 0 (integration by substitution): five extra structures each for
//   D1 (indefinite integral, answer an expression) and D2 (definite integral, exact value).
// Every key is computed in code from the numbers the prompt shows. All forms are original.
import { ri, rc, Frac } from '../qhelpers.js';

const REJ = Symbol('reject');
const rej = cond => { if (cond) throw REJ; };
const R = fn => (rng, diff) => {
  for (let i = 0; i < 200; i++) {
    try { return fn(rng, diff); } catch (e) { if (e !== REJ) throw e; }
  }
  throw new Error('gaps-c variant: no acceptable draw');
};
const V = (diffs, fn) => ({ diffs, make: R(fn) });

const lin = (k) => `x ${k < 0 ? '-' : '+'} ${Math.abs(k)}`;       // x + k, k != 0
const co = m => (m === 1 ? '' : String(m));
const fr = f => f.latex();

/** Expression-answer payload. Traps equal to the key are dropped by the caller via rej. */
function expr(prompt, key, hint, traps, hints, steps) {
  return { dotpoint: 0, prompt, answerType: 'expression', answer: { expr: key, stripC: true }, inputHint: hint, traps, hints, steps };
}
/** Exact-value payload. */
function exact(prompt, f, traps, hints, steps, hint = 'e.g. 128/3 or 42') {
  const tr = traps.filter(t => Number.isFinite(t.value) && Math.abs(t.value - f.value) > 0.002).map(t => ({ ...t, tol: 0.0005 }));
  rej(tr.length < 1);
  return { dotpoint: 0, prompt, answerType: 'numeric', answer: { value: f.value, requireExact: true, canonicalInput: f.str(), tol: 0.0005 }, inputHint: hint, traps: tr, hints, steps };
}

const forms = {
  'me12-calc': [
    // ───────────── D1: indefinite integrals ─────────────
    // (1) linear shift u = x + k, integrand x(x+k)^n
    V([1], rng => {
      const k = rc(rng, [-4, -3, -2, -1, 1, 2, 3, 4, 5]), n = ri(rng, 2, 4);
      const inner = lin(k);
      const key = `(${inner})^${n + 2}/${n + 2} ${k < 0 ? '+' : '-'} ${Math.abs(k)}*(${inner})^${n + 1}/${n + 1}`;
      return expr(
        `Use the substitution $u = ${inner}$ to find $\\displaystyle\\int x\\,(${inner})^{${n}}\\,dx$. (You may omit +C.)`, key, `e.g. (${inner})^${n + 2}/${n + 2} + ...`,
        [{ expr: `x*(${inner})^${n + 1}/${n + 1}`, why: 'Every $x$ must be rewritten in terms of $u$: $x = u - k$. Leaving a bare $x$ beside $u^{n+1}$ is not an integral in one variable.' },
         { expr: `(${inner})^${n + 2}/${n + 2}`, why: `Writing $x = u ${k < 0 ? '+' : '-'} ${Math.abs(k)}$ gives two terms, $u^{${n + 1}} ${k < 0 ? '+' : '-'} ${Math.abs(k)}u^{${n}}$. The second term cannot be dropped.` }],
        [`With $u = ${inner}$, $du = dx$ and $x = u ${k < 0 ? '+' : '-'} ${Math.abs(k)}$.`, `The integral becomes $\\int (u ${k < 0 ? '+' : '-'} ${Math.abs(k)})\\,u^{${n}}\\,du$. Expand before integrating.`, `Integrate $u^{${n + 1}}$ and $u^{${n}}$ separately, then replace $u$.`],
        [{ h: 'Substitute', d: `$u = ${inner}$, $du = dx$, $x = u ${k < 0 ? '+' : '-'} ${Math.abs(k)}$` },
         { h: 'Expand in u', d: `$\\int (u ${k < 0 ? '+' : '-'} ${Math.abs(k)})u^{${n}}\\,du = \\int u^{${n + 1}} ${k < 0 ? '+' : '-'} ${Math.abs(k)}u^{${n}}\\,du$` },
         { h: 'Integrate', d: `$\\dfrac{u^{${n + 2}}}{${n + 2}} ${k < 0 ? '+' : '-'} \\dfrac{${Math.abs(k)}u^{${n + 1}}}{${n + 1}}$` },
         { h: 'Back-substitute', d: `$\\dfrac{(${inner})^{${n + 2}}}{${n + 2}} ${k < 0 ? '+' : '-'} \\dfrac{${Math.abs(k)}(${inner})^{${n + 1}}}{${n + 1}} + C$` }]
      );
    }),
    // (2) x/(x^2 + c) -> logarithm, substitution not given
    V([1], rng => {
      const m = rc(rng, [1, 3, 4, 5, 6, 7, 8, 9, 10]), c = ri(rng, 1, 9);
      const f = new Frac(m, 2);
      const key = `${f.str()}*ln(x^2 + ${c})`;
      return expr(
        `Find $\\displaystyle\\int \\frac{${co(m)}x}{x^2 + ${c}}\\,dx$. (You may omit +C. Note that $x^2 + ${c} > 0$ for all real $x$, so no absolute value is needed.)`, key, `e.g. 3/2*ln(x^2 + ${c})`,
        [{ expr: `${m}*ln(x^2 + ${c})`, why: `$\\dfrac{d}{dx}(x^2 + ${c}) = 2x$, so the numerator $${co(m)}x$ is only $\\dfrac{${m}}{2}$ of that. The factor $\\frac12$ has to appear.` },
         { expr: `ln(x^2 + ${c})`, why: `The constant multiple $${m}$ in the numerator stays outside the integral.` }].filter(t => !(m === 2)),
        [`Look for a function whose derivative is in the numerator: try $u = x^2 + ${c}$.`, `$du = 2x\\,dx$, so $${co(m)}x\\,dx = \\frac{${m}}{2}\\,du$.`, `The integral becomes $\\frac{${m}}{2}\\int \\frac{1}{u}\\,du$; integrate and substitute back.`],
        [{ h: 'Choose the substitution', d: `$u = x^2 + ${c}$, so $du = 2x\\,dx$` },
         { h: 'Rewrite', d: `$\\int \\dfrac{${co(m)}x}{x^2+${c}}dx = \\dfrac{${m}}{2}\\int \\dfrac{du}{u}$` },
         { h: 'Integrate', d: `$\\dfrac{${m}}{2}\\ln|u| = \\dfrac{${m}}{2}\\ln(x^2 + ${c}) + C$ since $u > 0$` }]
      );
    }),
    // (3) exponential of a quadratic
    V([1], rng => {
      const k = rc(rng, [-3, -2, -1, 1, 2, 3, 4]), m = ri(rng, 1, 9);
      const e = `${k === 1 ? '' : k === -1 ? '-' : k}x^2`;
      const eIn = `${k === 1 ? '' : k === -1 ? '-' : `${k}*`}x^2`;
      const f = new Frac(m, 2 * k);
      const key = `${f.str()}*e^(${eIn})`;
      return expr(
        `Find $\\displaystyle\\int ${co(m)}x\\,e^{${e}}\\,dx$. (You may omit +C.)`, key, 'e.g. 3/4*e^(2*x^2)',
        [{ expr: `${m}*e^(${eIn})`, why: `$u = ${e}$ gives $du = ${2 * k}x\\,dx$, so $x\\,dx = \\dfrac{du}{${2 * k}}$. The factor $\\dfrac{1}{${2 * k}}$ is part of the answer.` },
         { expr: `${new Frac(m, k).str()}*e^(${eIn})`, why: `Differentiating $${e}$ gives $${2 * k}x$, not $${k}x$ — the factor of 2 from the power must be accounted for.` }].filter(t => t.expr !== key),
        [`Let $u = ${e}$ and find $du$.`, `$du = ${2 * k}x\\,dx$, so $x\\,dx = \\dfrac{du}{${2 * k}}$.`, `The integral is $\\dfrac{${m}}{${2 * k}}\\int e^{u}\\,du$.`],
        [{ h: 'Substitute', d: `$u = ${e}$, $du = ${2 * k}x\\,dx$` },
         { h: 'Rewrite', d: `$\\int ${co(m)}x\\,e^{${e}}dx = \\dfrac{${m}}{${2 * k}}\\int e^{u}du$` },
         { h: 'Integrate and substitute back', d: `$${f.latex()}\\,e^{${e}} + C$` }]
      );
    }),
    // (4) powers of sine / cosine times the other
    V([1], rng => {
      const useSin = rng() < 0.5, m = ri(rng, 1, 6), n = ri(rng, 2, 5);
      const f = new Frac(useSin ? m : -m, n + 1);
      const A = useSin ? 'sin' : 'cos', B = useSin ? 'cos' : 'sin';
      const key = `${f.str()}*${A}(x)^${n + 1}`;
      const wrongSign = `${new Frac(useSin ? -m : m, n + 1).str()}*${A}(x)^${n + 1}`;
      return expr(
        `Find $\\displaystyle\\int ${co(m)}\\${A}^{${n}}x\\,\\${B}x\\,dx$. (You may omit +C.)`, key, `e.g. 2*${A}(x)^${n + 1}/${n + 1}`,
        [{ expr: `${m}*${A}(x)^${n + 1}`, why: `After substituting $u = \\${A}x$ the integral is $\\int u^{${n}}\\,du = \\dfrac{u^{${n + 1}}}{${n + 1}}$. The division by the new power is missing.` },
         useSin ? { expr: `${new Frac(m, n).str()}*sin(x)^${n}`, why: 'Integrating raises the power by 1 and divides by the new power; do not lower it.' }
                : { expr: wrongSign, why: `With $u = \\cos x$, $du = -\\sin x\\,dx$, so the sign is negative. $\\dfrac{d}{dx}\\cos x = -\\sin x$.` }],
        [`Choose $u = \\${A}x$ so that the other factor is its derivative${useSin ? '' : ', apart from a sign'}.`, `$du = ${useSin ? '' : '-'}\\${B}x\\,dx$, so the integral becomes $${useSin ? '' : '-'}${co(m)}\\int u^{${n}}\\,du$.`, `Integrate in $u$ and replace $u$ with $\\${A}x$.`],
        [{ h: 'Substitute', d: `$u = \\${A}x$, $du = ${useSin ? '' : '-'}\\${B}x\\,dx$` },
         { h: 'Rewrite', d: `$\\int ${co(m)}\\${A}^{${n}}x\\,\\${B}x\\,dx = ${useSin ? '' : '-'}${co(m)}\\int u^{${n}}du$` },
         { h: 'Integrate and substitute back', d: `$${f.latex()}\\,\\${A}^{${n + 1}}x + C$` }]
      );
    }),
    // (5) u = sqrt(x) + c, integrand (sqrt(x)+c)^n / sqrt(x)
    V([1], rng => {
      const m = ri(rng, 1, 4), c = ri(rng, 1, 5), n = ri(rng, 2, 4);
      const key = `${2 * m}*(sqrt(x) + ${c})^${n + 1}/${n + 1}`;
      return expr(
        `For $x > 0$, use the substitution $u = \\sqrt{x} + ${c}$ to find $\\displaystyle\\int \\frac{${co(m)}(\\sqrt{x} + ${c})^{${n}}}{\\sqrt{x}}\\,dx$. (You may omit +C.)`, key, `e.g. 4*(sqrt(x) + ${c})^${n + 1}/${n + 1}`,
        [{ expr: `${m}*(sqrt(x) + ${c})^${n + 1}/${n + 1}`, why: `$du = \\dfrac{1}{2\\sqrt{x}}\\,dx$, so $\\dfrac{dx}{\\sqrt{x}} = 2\\,du$. The factor 2 must be carried through.` },
         { expr: `${2 * m}*(sqrt(x) + ${c})^${n + 1}`, why: 'After integrating $u^n$ the result is divided by the new power.' }],
        [`$u = \\sqrt{x} + ${c}$ means $du = \\dfrac{1}{2\\sqrt{x}}\\,dx$.`, `So $\\dfrac{dx}{\\sqrt{x}} = 2\\,du$ and the integral is $${2 * m}\\int u^{${n}}\\,du$.`, 'Integrate in $u$, then replace $u$.'],
        [{ h: 'Differentiate', d: `$du = \\dfrac{dx}{2\\sqrt{x}}$, so $\\dfrac{dx}{\\sqrt{x}} = 2\\,du$` },
         { h: 'Rewrite', d: `$${2 * m}\\int u^{${n}}\\,du$` },
         { h: 'Integrate and substitute back', d: `$\\dfrac{${2 * m}(\\sqrt{x} + ${c})^{${n + 1}}}{${n + 1}} + C$` }]
      );
    }),

    // ───────────── D2: definite integrals, limits changed ─────────────
    // (1) linear shift: x(x+k)^n
    V([2], rng => {
      const k = rc(rng, [-3, -2, -1, 1, 2, 3, 4]), n = ri(rng, 2, 3), p = ri(rng, 0, 1), q = p + ri(rng, 1, 3);
      const inner = lin(k), lo = p + k, hi = q + k;
      const G = u => new Frac((n + 1) * u ** (n + 2) - k * (n + 2) * u ** (n + 1), (n + 1) * (n + 2));
      const val = G(hi).sub(G(lo));
      const keepX = G(q).sub(G(p));
      const noK = new Frac(hi ** (n + 2) - lo ** (n + 2), n + 2);
      return exact(
        `Using the substitution $u = ${inner}$, evaluate $\\displaystyle\\int_{${p}}^{${q}} x\\,(${inner})^{${n}}\\,dx$.`, val,
        [{ value: keepX.value, why: `The limits must change with the variable: $x = ${p} \\to u = ${lo}$ and $x = ${q} \\to u = ${hi}$.` },
         { value: noK.value, why: `$x = u ${k < 0 ? '+' : '-'} ${Math.abs(k)}$, so the integrand in $u$ has two terms; the second one cannot be dropped.` }],
        [`New limits: $x = ${p} \\to u = ${lo}$, $x = ${q} \\to u = ${hi}$.`, `Write $x = u ${k < 0 ? '+' : '-'} ${Math.abs(k)}$, so the integrand is $(u ${k < 0 ? '+' : '-'} ${Math.abs(k)})u^{${n}}$ with $du = dx$.`, `Expand, integrate term by term and evaluate between $u = ${lo}$ and $u = ${hi}$.`],
        [{ h: 'New limits', d: `$u: ${lo} \\to ${hi}$` },
         { h: 'Rewrite', d: `$\\int_{${lo}}^{${hi}} (u ${k < 0 ? '+' : '-'} ${Math.abs(k)})u^{${n}}\\,du = \\int_{${lo}}^{${hi}} u^{${n + 1}} ${k < 0 ? '+' : '-'} ${Math.abs(k)}u^{${n}}\\,du$` },
         { h: 'Integrate', d: `$\\left[\\dfrac{u^{${n + 2}}}{${n + 2}} ${k < 0 ? '+' : '-'} \\dfrac{${Math.abs(k)}u^{${n + 1}}}{${n + 1}}\\right]_{${lo}}^{${hi}}$` },
         { h: 'Evaluate', d: `$${fr(val)}$` }]
      );
    }),
    // (2) trigonometric: sin^n x cos x or cos^n x sin x
    V([2], rng => {
      const sinType = rng() < 0.5, n = ri(rng, 2, 4), m = ri(rng, 1, 4);
      const opts = sinType
        ? [{ t: '\\frac{\\pi}{2}', u: new Frac(1) }, { t: '\\frac{\\pi}{6}', u: new Frac(1, 2) }]
        : [{ t: '\\frac{\\pi}{2}', u: new Frac(1) }, { t: '\\frac{\\pi}{3}', u: new Frac(1, 2) }];
      const o = rc(rng, opts);
      const A = sinType ? 'sin' : 'cos', B = sinType ? 'cos' : 'sin';
      const pw = f => { let r = new Frac(1); for (let i = 0; i < n + 1; i++) r = r.mul(f); return r; };
      const val = (sinType ? pw(o.u) : new Frac(1).sub(pw(o.u))).mul(new Frac(m, n + 1));
      const uLo = sinType ? '0' : '1', uHi = o.u.str();
      return exact(
        `Evaluate $\\displaystyle\\int_0^{${o.t}} ${co(m)}\\${A}^{${n}}x\\,\\${B}x\\,dx$ using $u = \\${A}x$. Give the exact value.`, val,
        [{ value: m * (sinType ? pw(o.u).value : 1 - pw(o.u).value), why: 'Dividing by the new power, $n + 1$, is part of integrating $u^n$.' },
         { value: sinType ? (m * (Math.PI / (o.t.includes('6') ? 6 : 2)) ** (n + 1)) / (n + 1) : -val.value, why: sinType ? 'Substitute the new limits in $u$, not the old limits in $x$.' : 'With $u = \\cos x$, $du = -\\sin x\\,dx$. Keep track of the sign and swap the limits, which run from 1 down to the new value.' }],
        [`When $x = 0$, $u = ${uLo}$; at the upper limit $u = ${uHi}$.`, `$du = ${sinType ? '' : '-'}\\${B}x\\,dx$, so the integral is $${co(m)}\\int u^{${n}}\\,du$ over the new limits${sinType ? '' : ' (the sign is absorbed by swapping the limits)'}.`, `Integrate $u^{${n}}$ to $\\dfrac{u^{${n + 1}}}{${n + 1}}$ and substitute the limits.`],
        [{ h: 'New limits', d: `$x = 0 \\to u = ${uLo}$; upper limit gives $u = ${uHi}$` },
         { h: 'Rewrite', d: sinType ? `$${co(m)}\\int_{0}^{${uHi}} u^{${n}}du$` : `$${co(m)}\\int_{${uHi}}^{1} u^{${n}}du$` },
         { h: 'Integrate and evaluate', d: sinType ? `$${co(m)}\\left[\\dfrac{u^{${n + 1}}}{${n + 1}}\\right]_0^{${uHi}} = ${val.latex()}$` : `$${co(m)}\\left[\\dfrac{u^{${n + 1}}}{${n + 1}}\\right]_{${uHi}}^{1} = ${val.latex()}$` }],
        'e.g. 7/48'
      );
    }),
    // (3) negative power: x/(x^2+c)^n
    V([2], rng => {
      const n = rc(rng, [2, 3]), c = ri(rng, 1, 4), b = ri(rng, 1, 3), m = ri(rng, 1, 4);
      const hi = b * b + c, q = n - 1;
      const val = new Frac(m * (hi ** q - c ** q), 2 * q * c ** q * hi ** q);
      const noHalf = val.mul(new Frac(2));
      const swapped = new Frac(-1).mul(val);
      return exact(
        `Evaluate $\\displaystyle\\int_0^{${b}} \\frac{${co(m)}x}{(x^2 + ${c})^{${n}}}\\,dx$.`, val,
        [{ value: noHalf.value, why: `$u = x^2 + ${c}$ gives $du = 2x\\,dx$, so $x\\,dx = \\tfrac12\\,du$. The $\\frac12$ is missing.` },
         { value: swapped.value, why: `$\\int u^{-${n}}\\,du = -\\dfrac{u^{-${q}}}{${q}}$. The negative sign from integrating a negative power flips the order of subtraction.` }],
        [`Let $u = x^2 + ${c}$. When $x = 0$, $u = ${c}$; when $x = ${b}$, $u = ${hi}$.`, `$x\\,dx = \\tfrac12\\,du$, so the integral is $\\dfrac{${m}}{2}\\int_{${c}}^{${hi}} u^{-${n}}\\,du$.`, `Integrate $u^{-${n}}$ (raise the power by 1 and divide by the new power) and substitute the limits.`],
        [{ h: 'Substitute and change limits', d: `$u = x^2 + ${c}$, $du = 2x\\,dx$; $x: 0 \\to ${b}$ becomes $u: ${c} \\to ${hi}$` },
         { h: 'Rewrite', d: `$\\dfrac{${m}}{2}\\int_{${c}}^{${hi}} u^{-${n}}\\,du$` },
         { h: 'Integrate', d: `$\\dfrac{${m}}{2}\\left[-\\dfrac{1}{${q === 1 ? '' : `${q}`}${q === 1 ? 'u' : `u^{${q}}`}}\\right]_{${c}}^{${hi}}$` },
         { h: 'Evaluate', d: `$${val.latex()}$` }]
      );
    }),
    // (4) logarithm substitution u = ln x
    V([2], rng => {
      const k = ri(rng, 2, 4), n = ri(rng, 2, 3), m = ri(rng, 1, 4);
      const val = new Frac(m * k ** (n + 1), n + 1);
      const eK = Math.exp(k);
      return exact(
        `Using $u = \\ln x$, evaluate $\\displaystyle\\int_{1}^{e^{${k}}} \\frac{${co(m)}(\\ln x)^{${n}}}{x}\\,dx$.`, val,
        [{ value: (m * (eK ** (n + 1) - 1)) / (n + 1), why: `The limits change with the variable: $x = 1 \\to u = 0$ and $x = e^{${k}} \\to u = ${k}$. Do not put $e^{${k}}$ into the antiderivative in $u$.` },
         { value: m * k ** (n + 1), why: `After integrating $u^{${n}}$ the result is divided by $${n + 1}$.` }],
        [`$u = \\ln x$ gives $du = \\dfrac{1}{x}\\,dx$. When $x = 1$, $u = 0$.`, `When $x = e^{${k}}$, $u = \\ln e^{${k}} = ${k}$.`, `The integral becomes $${co(m)}\\int_0^{${k}} u^{${n}}\\,du$.`],
        [{ h: 'Substitute', d: `$u = \\ln x$, $du = \\dfrac{dx}{x}$` },
         { h: 'New limits', d: `$x: 1 \\to e^{${k}}$ becomes $u: 0 \\to ${k}$` },
         { h: 'Integrate', d: `$${co(m)}\\left[\\dfrac{u^{${n + 1}}}{${n + 1}}\\right]_0^{${k}} = ${val.latex()}$` }]
      );
    }),
    // (5) u = sqrt(x) + c with limits that are perfect squares
    V([2], rng => {
      const m = ri(rng, 1, 3), c = ri(rng, 1, 4), n = ri(rng, 2, 3), p = ri(rng, 1, 2), q = p + ri(rng, 1, 2);
      const val = new Frac(2 * m * ((q + c) ** (n + 1) - (p + c) ** (n + 1)), n + 1);
      const wrongLim = new Frac(2 * m * ((q * q) ** (n + 1) - (p * p) ** (n + 1)), n + 1);
      const noTwo = val.mul(new Frac(1, 2));
      return exact(
        `Using the substitution $u = \\sqrt{x} + ${c}$, evaluate $\\displaystyle\\int_{${p * p}}^{${q * q}} \\frac{${co(m)}(\\sqrt{x} + ${c})^{${n}}}{\\sqrt{x}}\\,dx$.`, val,
        [{ value: noTwo.value, why: `$du = \\dfrac{dx}{2\\sqrt{x}}$, so $\\dfrac{dx}{\\sqrt{x}} = 2\\,du$. The factor 2 is missing.` },
         { value: wrongLim.value, why: `The limits are in $x$ and must be converted: $u = \\sqrt{x} + ${c}$, so $x = ${p * p} \\to u = ${p + c}$ and $x = ${q * q} \\to u = ${q + c}$.` }],
        [`$u = \\sqrt{x} + ${c}$: $x = ${p * p} \\to u = ${p + c}$ and $x = ${q * q} \\to u = ${q + c}$.`, `$\\dfrac{dx}{\\sqrt{x}} = 2\\,du$, so the integral is $${2 * m}\\int u^{${n}}\\,du$ over the new limits.`, `Integrate to $\\dfrac{${2 * m}u^{${n + 1}}}{${n + 1}}$ and substitute.`],
        [{ h: 'New limits', d: `$u: ${p + c} \\to ${q + c}$` },
         { h: 'Rewrite', d: `$${2 * m}\\int_{${p + c}}^{${q + c}} u^{${n}}\\,du$` },
         { h: 'Integrate and evaluate', d: `$${2 * m}\\left[\\dfrac{u^{${n + 1}}}{${n + 1}}\\right]_{${p + c}}^{${q + c}} = ${val.latex()}$` }]
      );
    })
  ]
};
export { forms };
