// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Year 12 generators (HSC Advanced)
// ─────────────────────────────────────────────────────────────────────────────
import { ri, rc, rs, nz, gcd, Frac, mcq, term, poly, sgn, moneyPlain, r1, r2, r3, NAMES } from '../qhelpers.js';

// ── Motion graph ─────────────────────────────────────────────────────────────
// engine/figures.js has no time-series builder, so the piecewise-linear graph
// below is drawn here. It emits only the tags and attributes the figure
// sanitiser allows — svg, g, line, polyline, circle, text.

const MOTION_ACCENT = '#3987e5';
const MN = v => Math.round(v * 100) / 100;

function figMotion({ pts, yLabel, tMax, vMin, vMax }) {
  const W = 360, H = 250, L = 46, B = 40;
  const X = t => L + t / tMax * (W - L - 18);
  const Y = v => (H - B) - (v - vMin) / (vMax - vMin) * (H - B - 22);
  const zero = Y(0);
  let inner = `<line x1="${L}" y1="${MN(zero)}" x2="${W - 12}" y2="${MN(zero)}"/><line x1="${L}" y1="16" x2="${L}" y2="${H - B}"/>`;
  const tStep = tMax > 12 ? 2 : 1;
  for (let t = tStep; t <= tMax; t += tStep) {
    inner += `<line x1="${MN(X(t))}" y1="${MN(zero - 4)}" x2="${MN(X(t))}" y2="${MN(zero + 4)}"/>`;
    if (t % (tStep * 2) === 0) inner += `<text x="${MN(X(t))}" y="${MN(zero + 18)}" fill="currentColor" stroke="none" font-size="11" font-family="Inter, system-ui, sans-serif" text-anchor="middle">${t}</text>`;
  }
  const vStep = (vMax - vMin) > 24 ? 5 : 2;
  for (let v = Math.ceil(vMin / vStep) * vStep; v <= vMax; v += vStep) {
    if (v === 0) continue;
    inner += `<line x1="${L - 4}" y1="${MN(Y(v))}" x2="${L + 4}" y2="${MN(Y(v))}"/>`;
    inner += `<text x="${L - 14}" y="${MN(Y(v) + 4)}" fill="currentColor" stroke="none" font-size="11" font-family="Inter, system-ui, sans-serif" text-anchor="middle">${v}</text>`;
  }
  inner += `<polyline points="${pts.map(([t, v]) => `${MN(X(t))},${MN(Y(v))}`).join(' ')}" stroke="${MOTION_ACCENT}" stroke-width="2.2"/>`;
  for (const [t, v] of pts) inner += `<circle cx="${MN(X(t))}" cy="${MN(Y(v))}" r="3.4" fill="${MOTION_ACCENT}" stroke="none"/>`;
  inner += `<text x="${W - 22}" y="${MN(zero - 9)}" fill="currentColor" stroke="none" font-size="12" font-family="Inter, system-ui, sans-serif" text-anchor="middle">t (s)</text>`;
  inner += `<text x="${L + 26}" y="13" fill="currentColor" stroke="none" font-size="12" font-family="Inter, system-ui, sans-serif" text-anchor="middle">${yLabel}</text>`;
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Motion graph" style="max-width:360px;width:100%;height:auto;display:block">` +
    `<g fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round">${inner}</g></svg>`;
}

// ── Exact values for trigonometric calculus ─────────────────────────────────

/** Bracket a negative value so a generated expression string stays parseable. */
const pn12 = v => v < 0 ? `(${v})` : String(v);

/** An exact value p√r / q, reduced, as a typed answer, LaTeX and number. */
function exactSurd(p, r, q) {
  if (p === 0) return { typed: '0', tex: '0', val: 0 };
  const g = gcd(Math.abs(p), q);
  const n = p / g, d = q / g;
  const base = r === 1 ? `${n}` : n === 1 ? `sqrt(${r})` : n === -1 ? `-sqrt(${r})` : `${n}sqrt(${r})`;
  const baseTex = r === 1 ? `${n}` : n === 1 ? `\\sqrt{${r}}` : n === -1 ? `-\\sqrt{${r}}` : `${n}\\sqrt{${r}}`;
  return {
    typed: d === 1 ? base : `${base}/${d}`,
    tex: d === 1 ? baseTex : `\\dfrac{${baseTex}}{${d}}`,
    val: n * Math.sqrt(r) / d
  };
}

/** sin and cos of the special angles, as {p, r, q} meaning p√r / q. */
const EXACT_ANGLES = {
  0: { sin: [0, 1, 1], cos: [1, 1, 1] },
  30: { sin: [1, 1, 2], cos: [1, 3, 2] },
  45: { sin: [1, 2, 2], cos: [1, 2, 2] },
  60: { sin: [1, 3, 2], cos: [1, 1, 2] },
  90: { sin: [1, 1, 1], cos: [0, 1, 1] },
  120: { sin: [1, 3, 2], cos: [-1, 1, 2] },
  135: { sin: [1, 2, 2], cos: [-1, 2, 2] },
  150: { sin: [1, 1, 2], cos: [-1, 3, 2] },
  180: { sin: [0, 1, 1], cos: [-1, 1, 1] }
};

/** An angle of `deg` degrees written exactly as a multiple of π. */
function piDeg(deg, scale = 1) {
  const n = deg, d = 180 * scale;
  const g = gcd(n, d) || 1;
  const p = n / g, q = d / g;
  if (p === 0) return { typed: '0', tex: '0', val: 0 };
  const head = p === 1 ? 'pi' : `${p}pi`;
  const headTex = p === 1 ? '\\pi' : `${p}\\pi`;
  return {
    typed: q === 1 ? head : `${head}/${q}`,
    tex: q === 1 ? headTex : `\\dfrac{${headTex}}{${q}}`,
    val: p * Math.PI / q
  };
}

export const year12 = {

  // ── Differentiation rules ────────────────────────────────────────────────
  'y12-diff': (rng, diff) => {
    if (diff === 1) {
      const a = ri(rng, 2, 5), b = nz(rng, -6, 6), n = ri(rng, 3, 6);
      return {
        prompt: `Differentiate $y = (${a}x ${sgn(b)})^{${n}}$ using the chain rule.`,
        answerType: 'expression', answer: { expr: `${n * a}(${a}x + ${b})^${n - 1}` },
        inputHint: `e.g. ${n * a}(${a}x ${sgn(b)})^${n - 1}`,
        answerPrefix: 'dy/dx =',
        traps: [
          { expr: `${n}(${a}x + ${b})^${n - 1}`, why: `Chain rule: multiply by the derivative of the *inside*, which is ${a}.` },
          { expr: `${n * a}(${a}x + ${b})^${n}`, why: 'Reduce the power by 1 as well as multiplying down.' }
        ],
        hints: ['Chain rule: outer derivative × inner derivative.', `Outer: $${n}(\\ldots)^{${n - 1}}$. Inner: $\\frac{d}{dx}(${a}x ${sgn(b)}) = ${a}$.`, `Multiply: $${n} \\times ${a} = ${n * a}$.`],
        steps: [
          { h: 'Outer function', d: `$\\dfrac{d}{du}u^{${n}} = ${n}u^{${n - 1}}$ with $u = ${a}x ${sgn(b)}$` },
          { h: 'Inner derivative', d: `$u' = ${a}$` },
          { h: 'Chain rule', d: `$\\dfrac{dy}{dx} = ${n}(${a}x ${sgn(b)})^{${n - 1}} \\times ${a} = ${n * a}(${a}x ${sgn(b)})^{${n - 1}}$` }
        ]
      };
    }
    if (diff === 2) {
      const a = ri(rng, 1, 3), b = nz(rng, -5, 5), m = ri(rng, 2, 3);
      // y = x^m (a x + b)  →  y' = m x^(m-1)(ax+b) + a x^m = (m+1)a x^m + m b x^(m-1)
      const c1 = (m + 1) * a, c2 = m * b;
      return {
        prompt: `Use the product rule to differentiate $y = x^{${m}}(${a === 1 ? '' : a}x ${sgn(b)})$, giving your answer expanded and simplified.`,
        answerType: 'expression', answer: { expr: `${c1}x^${m} + ${c2}x^${m - 1}` },
        inputHint: `e.g. ${c1}x^${m} ${sgn(c2)}x^${m - 1}`,
        answerPrefix: 'dy/dx =',
        traps: [
          { expr: `${m}x^${m - 1}(${a})`.replace('(', '*(').replace('*', ''), why: 'Product rule: $u\'v + uv\'$ — two terms, not the product of the derivatives.' },
          { expr: `${m * a}x^${m - 1}`, why: 'Product rule: $u\'v + uv\'$ — differentiate each factor in turn and add.' }
        ],
        hints: ['Product rule: $(uv)\' = u\'v + uv\'$.', `$u = x^{${m}} → u' = ${m}x^{${m - 1}}$; $v = ${a === 1 ? '' : a}x ${sgn(b)} → v' = ${a}$.`, `Combine: $${m}x^{${m - 1}}(${a === 1 ? '' : a}x ${sgn(b)}) + ${a}x^{${m}}$, then expand.`],
        steps: [
          { h: 'Identify u and v', d: `$u = x^{${m}}, \\quad v = ${a === 1 ? '' : a}x ${sgn(b)}$` },
          { h: 'Differentiate each', d: `$u' = ${m}x^{${m - 1}}, \\quad v' = ${a}$` },
          { h: 'Product rule', d: `$y' = ${m}x^{${m - 1}}(${a === 1 ? '' : a}x ${sgn(b)}) + ${a}x^{${m}}$` },
          { h: 'Expand and collect', d: `$y' = ${c1}x^{${m}} ${sgn(c2)}x^{${m - 1}}$` }
        ]
      };
    }
    if (diff === 3) {
      const a = ri(rng, 1, 3), b = nz(rng, -4, 4), c = ri(rng, 1, 2), d = nz(rng, 1, 5);
      const x0 = ri(rng, 0, 3);
      const den = c * x0 + d;
      if (den === 0) return year12['y12-diff'](rng, diff);
      const num = a * d - b * c; // derivative of (ax+b)/(cx+d) = (ad - bc)/(cx+d)^2
      const val = num / (den * den);
      const valR = r3(val);
      return {
        prompt: `If $y = \\dfrac{${a === 1 ? '' : a}x ${sgn(b)}}{${c === 1 ? '' : c}x ${sgn(d)}}$, find the gradient $\\dfrac{dy}{dx}$ at $x = ${x0}$, correct to 3 decimal places where needed.`,
        answerType: 'numeric', answer: { value: valR, tol: 0.0011 },
        traps: [{ value: r3(-num / (den * den)), why: 'Quotient rule: $\\frac{u\'v - uv\'}{v^2}$ — the order of the top matters.', tol: 0.0011 }].filter(t => Math.abs(t.value - valR) > 0.002),
        hints: ['Quotient rule: $\\left(\\frac{u}{v}\\right)\' = \\frac{u\'v - uv\'}{v^2}$.', `Here it simplifies to $\\dfrac{${a}(${c}x ${sgn(d)}) - ${c}(${a}x ${sgn(b)})}{(${c}x ${sgn(d)})^2} = \\dfrac{${num}}{(${c}x ${sgn(d)})^2}$.`, `Substitute $x = ${x0}$: denominator $(${den})^2 = ${den * den}$.`],
        steps: [
          { h: 'Quotient rule', d: `$y' = \\dfrac{${a}(${c === 1 ? '' : c}x ${sgn(d)}) - ${c}(${a === 1 ? '' : a}x ${sgn(b)})}{(${c === 1 ? '' : c}x ${sgn(d)})^2}$` },
          { h: 'Simplify the numerator', d: `$${a * d} - ${b * c} = ${num}$, so $y' = \\dfrac{${num}}{(${c === 1 ? '' : c}x ${sgn(d)})^2}$` },
          { h: 'Substitute', d: `$y'(${x0}) = \\dfrac{${num}}{${den * den}} = ${valR}$` }
        ]
      };
    }
    const a = ri(rng, 1, 3), b = nz(rng, -6, 6), n = ri(rng, 2, 4), x0 = ri(rng, 1, 3);
    const inner = a * x0 * x0 + b;
    if (inner === 0) return year12['y12-diff'](rng, diff);
    const val = n * Math.pow(inner, n - 1) * 2 * a * x0;
    return {
      prompt: `If $y = (${a === 1 ? '' : a}x^2 ${sgn(b)})^{${n}}$, find $\\dfrac{dy}{dx}$ at $x = ${x0}$.`,
      answerType: 'numeric', answer: { value: val },
      traps: [
        { value: n * Math.pow(inner, n - 1), why: `Chain rule: also multiply by the inner derivative $${2 * a}x$ evaluated at $x = ${x0}$.` },
        { value: n * Math.pow(inner, n - 1) * 2 * a, why: `The inner derivative is $${2 * a}x$ — substitute $x = ${x0}$ into it as well.` }
      ].filter(t => t.value !== val),
      hints: ['Chain rule with an $x^2$ inside.', `$y' = ${n}(${a === 1 ? '' : a}x^2 ${sgn(b)})^{${n - 1}} \\times ${2 * a}x$.`, `At $x = ${x0}$: inner $= ${inner}$.`],
      steps: [
        { h: 'Chain rule', d: `$y' = ${n}(${a === 1 ? '' : a}x^2 ${sgn(b)})^{${n - 1}} \\cdot ${2 * a}x$` },
        { h: 'Evaluate the inside', d: `at $x = ${x0}$: $${a === 1 ? '' : a}(${x0})^2 ${sgn(b)} = ${inner}$` },
        { h: 'Substitute', d: `$y'(${x0}) = ${n}(${inner})^{${n - 1}} \\times ${2 * a * x0} = ${val}$` }
      ]
    };
  },

  // ── Applications of differentiation ──────────────────────────────────────
  'y12-appdiff': (rng, diff) => {
    if (diff === 1) {
      const p = nz(rng, -7, 7);
      let q = nz(rng, -7, 7);
      while (q === p) q = nz(rng, -7, 7);
      // y' = 3(x-p)(x-q) → y = x^3 - (3(p+q)/2)x^2 + 3pq x ; use scaled version y = 2x^3 - 3(p+q)x^2 + 6pq x for integer coefficients
      const A = 2, B = -3 * (p + q), C = 6 * p * q;
      return {
        prompt: `Find the x-coordinates of the stationary points of $y = ${poly([A, B, C, 0]).replace(/ \+ 0$/, '')}$.`,
        answerType: 'set', answer: { values: [p, q].sort((x, y) => x - y) },
        inputHint: 'e.g. x = -1, 2',
        traps: [{ value: p * q, why: 'Stationary points: solve $y\' = 0$ (a quadratic here), giving *two* x-values.' }],
        hints: ['Stationary points occur where $\\frac{dy}{dx} = 0$.', `$y' = ${poly([6, 2 * B, C])} = 0$.`, `Divide by 6: $${poly([1, -(p + q), p * q])} = 0$ and factorise.`],
        steps: [
          { h: 'Differentiate', d: `$y' = ${poly([3 * A, 2 * B, C])}$` },
          { h: 'Set to zero and simplify', d: `$${poly([1, -(p + q), p * q])} = 0$` },
          { h: 'Factorise', d: `$(x ${sgn(-p)})(x ${sgn(-q)}) = 0$` },
          { h: 'Solutions', d: `$x = ${Math.min(p, q)}$ and $x = ${Math.max(p, q)}$` }
        ]
      };
    }
    if (diff === 2) {
      const p = nz(rng, -3, 3);
      const min = rc(rng, [true, false]);
      const a = min ? 1 : -1;
      const k = nz(rng, -6, 6);
      const m = mcq(rng, min ? `A minimum turning point` : `A maximum turning point`, [
        { text: min ? 'A maximum turning point' : 'A minimum turning point', why: `Check the second derivative: $y'' = ${2 * a}$ is ${a > 0 ? 'positive → concave up → minimum' : 'negative → concave down → maximum'}.` },
        { text: 'A point of inflexion', why: 'A point of inflexion needs $y\'\' = 0$ with a concavity change — here $y\'\'$ is a non-zero constant.' },
        { text: 'Not a stationary point at all' }
      ]);
      return {
        prompt: `The curve $y = ${a === 1 ? '' : '-'}(x ${sgn(-p)})^2 ${sgn(k)}$ has a stationary point at $x = ${p}$. What is its nature?`,
        answerType: 'mcq', answer: { correctIndex: m.correctIndex, optionTraps: m.optionTraps }, mcqOptions: m.options,
        hints: ['Look at the sign of the squared term (or the second derivative).', `$y'' = ${2 * a}$.`, a > 0 ? 'Concave up → minimum.' : 'Concave down → maximum.'],
        steps: [
          { h: 'Second derivative', d: `$y'' = ${2 * a}$` },
          { h: 'Concavity test', d: `$y'' ${a > 0 ? '> 0$ → concave up → **minimum**' : '< 0$ → concave down → **maximum**'}` }
        ]
      };
    }
    if (diff === 3) {
      const a = 1, b = nz(rng, -5, 5), c = nz(rng, -6, 6), x0 = nz(rng, -3, 3);
      const y0 = x0 * x0 + b * x0 + c;
      const mGrad = 2 * x0 + b;
      const cc = y0 - mGrad * x0;
      return {
        prompt: `Find the equation of the **tangent** to $y = ${poly([1, b, c])}$ at the point where $x = ${x0}$. Answer in the form $y = mx + c$.`,
        answerType: 'expression', answer: { expr: `${mGrad}x + ${cc}` },
        inputHint: 'e.g. y = 4x - 3   (type 4x - 3)',
        traps: [{ expr: `${mGrad}x + ${y0}`, why: 'The tangent passes through the point of contact — find its intercept from $y - y_1 = m(x - x_1)$, not by reusing $y_1$.' }],
        hints: ['You need the gradient at the point and the point itself.', `$y' = 2x ${sgn(b)}$, so $m = ${mGrad}$; and $y(${x0}) = ${y0}$.`, `Use $y - ${y0} = ${mGrad}(x - ${x0})$.`],
        steps: [
          { h: 'Point of contact', d: `$y(${x0}) = ${y0}$ → point $(${x0}, ${y0})$` },
          { h: 'Gradient there', d: `$y' = 2x ${sgn(b)}$ gives $m = ${mGrad}$` },
          { h: 'Point–gradient form', d: `$y - ${y0} = ${mGrad}(x ${sgn(-x0)})$` },
          { h: 'Simplify', d: `$y = ${term(mGrad)} ${sgn(cc)}$` }
        ]
      };
    }
    const shape = ri(rng, 1, 3);
    if (shape === 1) {
      const per = ri(rng, 5, 50) * 4;
      const side = per / 4;
      return {
        prompt: `A farmer has $${per}$ m of fencing to enclose a rectangular paddock. Using calculus (or otherwise), find the **maximum area** that can be enclosed.`,
        answerType: 'numeric', answer: { value: side * side }, answerSuffix: 'm²',
        traps: [
          { value: per, why: `The perimeter is fixed at ${per} m — the answer is an *area*, maximised when the rectangle is a square.` },
          { value: (per / 2) * (per / 2), why: `Width + length $= ${per / 2}$ (half the perimeter) — each side of the optimal square is $${side}$, not $${per / 2}$.` }
        ],
        hints: [`If the width is x, the length is $\\frac{${per} - 2x}{2} = ${per / 2} - x$.`, `Area $A(x) = x(${per / 2} - x)$. Differentiate and set to zero.`, `$A' = ${per / 2} - 2x = 0$ gives $x = ${side}$.`],
        steps: [
          { h: 'Model', d: `$A(x) = x(${per / 2} - x) = ${per / 2}x - x^2$` },
          { h: 'Differentiate', d: `$A'(x) = ${per / 2} - 2x$` },
          { h: 'Stationary point', d: `$${per / 2} - 2x = 0 \\Rightarrow x = ${side}$ (a maximum since $A'' = -2 < 0$)` },
          { h: 'Maximum area', d: `$A = ${side} \\times ${side} = ${side * side}$ m² — a square` }
        ]
      };
    }
    if (shape === 2) {
      const L = ri(rng, 5, 50) * 4;
      const x = L / 4;
      const area = x * (L - 2 * x);
      return {
        prompt: `A rectangular yard is fenced on three sides, the fourth being an existing brick wall. There is $${L}$ m of fencing available. Find the **maximum area** that can be enclosed.`,
        answerType: 'numeric', answer: { value: area }, answerSuffix: 'm²',
        traps: [
          { value: (L / 4) ** 2, why: 'Only three sides are fenced, so the optimal shape is not a square — the side parallel to the wall is twice each of the others.' },
          { value: L, why: 'That is the length of fencing, not an area.' }
        ],
        hints: [`Let the two sides perpendicular to the wall be $x$; the third side is $${L} - 2x$.`, `Area $A(x) = x(${L} - 2x)$. Differentiate and set to zero.`, `$A' = ${L} - 4x = 0$ gives $x = ${x}$.`],
        steps: [
          { h: 'Model', d: `$A(x) = x(${L} - 2x) = ${L}x - 2x^2$` },
          { h: 'Differentiate', d: `$A'(x) = ${L} - 4x$` },
          { h: 'Stationary point', d: `$x = ${x}$ (a maximum since $A'' = -4 < 0$)` },
          { h: 'Maximum area', d: `$A = ${x} \\times ${L - 2 * x} = ${area}$ m²` }
        ]
      };
    }
    const S = ri(rng, 6, 60) * 2;
    const half = S / 2;
    return {
      prompt: `Two positive numbers add to $${S}$. Using calculus, find the **greatest possible value of their product**.`,
      answerType: 'numeric', answer: { value: half * half },
      traps: [
        { value: S, why: 'That is the fixed sum — the question asks for the largest product.' },
        { value: S * S, why: `The two numbers are $x$ and $${S} - x$; the product peaks at $x = ${half}$, giving $${half} \\times ${half}$.` }
      ],
      hints: [`Call the numbers $x$ and $${S} - x$.`, `$P(x) = x(${S} - x) = ${S}x - x^2$. Differentiate and set to zero.`, `$P' = ${S} - 2x = 0$ gives $x = ${half}$.`],
      steps: [
        { h: 'Model', d: `$P(x) = x(${S} - x) = ${S}x - x^2$` },
        { h: 'Differentiate', d: `$P'(x) = ${S} - 2x$` },
        { h: 'Stationary point', d: `$x = ${half}$ (a maximum since $P'' = -2 < 0$)` },
        { h: 'Greatest product', d: `$${half} \\times ${half} = ${half * half}$` }
      ]
    };
  },
  // ── Integration ──────────────────────────────────────────────────────────
  'y12-integration': (rng, diff) => {
    if (diff === 1) {
      const n = ri(rng, 1, 7);
      const a = (n + 1) * ri(rng, 1, 6);
      const k = a / (n + 1);
      const b = rng() < 0.5 ? nz(rng, -9, 9) : 0;
      const tail = b === 0 ? '' : ` ${sgn(b)}`;
      const ansTail = b === 0 ? '' : ` + ${b}*x`;
      return {
        prompt: `Find $\\displaystyle\\int \\left(${a}x^{${n}}${tail}\\right)\\,dx$. (You may omit the $+C$.)`,
        answerType: 'expression', answer: { expr: `${k}*x^${n + 1}${ansTail}`, stripC: true },
        inputHint: `e.g. ${k}x^${n + 1}${b === 0 ? '' : ` ${sgn(b)}x`} + C`,
        traps: [
          { expr: `${a * n}*x^${n - 1}`, why: 'That’s the *derivative* — integration goes the other way: raise the power, divide by the new power.' },
          { expr: `${a}*x^${n + 1}${ansTail}`, why: `Divide by the new power: $\\frac{${a}}{${n + 1}} = ${k}$.` }
        ],
        hints: ['Reverse the power rule: raise each power by 1, divide by the new power.', `$\\int x^{${n}} dx = \\frac{x^{${n + 1}}}{${n + 1}}$.`, b === 0 ? `$\\frac{${a}}{${n + 1}} = ${k}$.` : `The constant $${b}$ integrates to $${b}x$.`],
        steps: [
          { h: 'Raise the power', d: `$x^{${n}} \\to \\dfrac{x^{${n + 1}}}{${n + 1}}$` },
          { h: 'Keep the coefficient', d: `$\\displaystyle\\int ${a}x^{${n}} dx = \\dfrac{${a}}{${n + 1}}x^{${n + 1}} = ${k}x^{${n + 1}}$` },
          ...(b === 0 ? [] : [{ h: 'Integrate the constant', d: `$\\displaystyle\\int ${b}\\,dx = ${b}x$` }])
        ]
      };
    }
    if (diff === 2) {
      const a = ri(rng, 1, 3), b = nz(rng, -4, 6);
      const lo = 0, hi = ri(rng, 1, 3);
      const F = x => a * x * x * x / 3 + b * x * x / 2;
      const val = F(hi) - F(lo);
      return {
        prompt: `Evaluate $\\displaystyle\\int_{${lo}}^{${hi}} (${poly([a, b, 0]).replace(/ \+ 0$/, '')})\\,dx$.`,
        answerType: 'numeric', answer: { value: r3(val), tol: 0.002 },
        traps: [{ value: r3(a * hi * hi + b * hi), why: 'Integrate first (raise powers), *then* substitute the limits — don’t just plug the limit into the original.' }].filter(t => Math.abs(t.value - r3(val)) > 0.01),
        hints: ['Find the antiderivative first.', `$F(x) = \\frac{${a}}{3}x^3 + \\frac{${b}}{2}x^2$.`, `Compute $F(${hi}) - F(${lo})$.`],
        steps: [
          { h: 'Antiderivative', d: `$F(x) = \\dfrac{${a}}{3}x^3 ${b >= 0 ? '+' : '-'} \\dfrac{${Math.abs(b)}}{2}x^2$` },
          { h: 'Evaluate at the limits', d: `$F(${hi}) = ${r3(F(hi))}, \\quad F(${lo}) = ${r3(F(lo))}$` },
          { h: 'Subtract', d: `$${r3(F(hi))} - ${r3(F(lo))} = ${r3(val)}$` }
        ]
      };
    }
    if (diff === 3) {
      const k = ri(rng, 1, 6), w = ri(rng, 2, 12);
      // area under y = k x (w - x) from 0 to w  = k w^3/6
      const area = k * w ** 3 / 6;
      return {
        prompt: `Find the area enclosed between the curve $y = ${k === 1 ? '' : k}x(${w} - x)$ and the x-axis.`,
        answerType: 'numeric', answer: { value: r3(area), tol: 0.002 }, answerSuffix: 'units²',
        traps: [{ value: r3(k * w ** 3 / 3), why: 'Expand carefully: $\\int_0^{' + w + '} (' + (k * w) + 'x - ' + k + 'x^2)dx$ — both terms matter.' }].filter(t => Math.abs(t.value - r3(area)) > 0.01),
        hints: ['First find where the curve meets the x-axis.', `$y = 0$ at $x = 0$ and $x = ${w}$ — integrate between them.`, `$\\int_0^{${w}} (${k * w}x - ${k}x^2)\\,dx$.`],
        steps: [
          { h: 'x-intercepts', d: `$${k === 1 ? '' : k}x(${w} - x) = 0$ at $x = 0, ${w}$` },
          { h: 'Set up the integral', d: `$A = \\displaystyle\\int_0^{${w}} (${k * w}x - ${k}x^2)\\,dx$` },
          { h: 'Antiderivative', d: `$\\dfrac{${k * w}}{2}x^2 - \\dfrac{${k}}{3}x^3$` },
          { h: 'Evaluate', d: `$\\dfrac{${k * w}}{2}(${w * w}) - \\dfrac{${k}}{3}(${w ** 3}) = ${r3(area)}$ units²` }
        ]
      };
    }
    const r1x = ri(rng, -6, 4);
    const r2x = r1x + ri(rng, 1, 6);
    const m = r1x + r2x, cc = -r1x * r2x;
    const width = r2x - r1x;
    const area = width ** 3 / 6;
    const lineTex = m === 0 ? `${cc}` : `${term(m)}${cc === 0 ? '' : ` ${sgn(cc)}`}`;
    return {
      prompt: `Find the area enclosed between the line $y = ${lineTex}$ and the parabola $y = x^2$.`,
      answerType: 'numeric', answer: { value: r3(area), tol: 0.002 }, answerSuffix: 'units²',
      traps: [{ value: r3(width ** 3 / 3), why: 'Integrate (top − bottom) across the interval between the intersections — halve nothing and double nothing.', tol: 0.002 }].filter(t => Math.abs(t.value - r3(area)) > 0.01),
      hints: ['Find the intersection points first.', `$x^2 = ${lineTex}$ gives $x = ${r1x}$ and $x = ${r2x}$.`, `Area $= \\displaystyle\\int_{${r1x}}^{${r2x}} \\left(${lineTex} - x^2\\right)dx$.`],
      steps: [
        { h: 'Intersections', d: `$x^2 ${sgn(-m)}x ${sgn(-cc)} = 0 \\Rightarrow (x ${sgn(-r1x)})(x ${sgn(-r2x)}) = 0$, so $x = ${r1x}, ${r2x}$` },
        { h: 'Top minus bottom', d: `Between the roots the line is above: $A = \\displaystyle\\int_{${r1x}}^{${r2x}}\\left(${lineTex} - x^2\\right)dx$` },
        { h: 'Evaluate', d: `$A = \\dfrac{(${r2x} - ${r1x})^3}{6} = \\dfrac{${width ** 3}}{6} = ${r3(area)}$ units²` }
      ]
    };
  },

  // ── Trigonometric calculus ───────────────────────────────────────────────
  'y12-trigcalc': (rng, diff) => {
    if (diff === 1) {
      const a = ri(rng, 2, 5);
      const fn = rc(rng, ['sin', 'cos']);
      const correct = fn === 'sin' ? `$${a}\\cos(${a}x)$` : `$-${a}\\sin(${a}x)$`;
      const m = mcq(rng, correct, [
        { text: fn === 'sin' ? `$\\cos(${a}x)$` : `$-\\sin(${a}x)$`, why: `Chain rule: the inner derivative ${a} multiplies out the front.` },
        { text: fn === 'sin' ? `$-${a}\\cos(${a}x)$` : `$${a}\\sin(${a}x)$`, why: fn === 'sin' ? 'The derivative of sin is +cos — no sign flip.' : 'The derivative of cos is −sin — the sign flips.' },
        { text: fn === 'sin' ? `$${a}\\sin(${a}x)$` : `$${a}\\cos(${a}x)$` }
      ]);
      return {
        prompt: `Differentiate $y = \\${fn}(${a}x)$.`,
        answerType: 'mcq', answer: { correctIndex: m.correctIndex, optionTraps: m.optionTraps }, mcqOptions: m.options,
        hints: [`$\\frac{d}{dx}\\${fn}(x) = ${fn === 'sin' ? '\\cos(x)' : '-\\sin(x)'}$.`, 'Apply the chain rule for the inner ' + a + 'x.', `Multiply by the inner derivative ${a}.`],
        steps: [
          { h: 'Standard derivative', d: `$\\dfrac{d}{dx}\\${fn}(u) = ${fn === 'sin' ? '\\cos(u)' : '-\\sin(u)'} \\cdot u'$` },
          { h: 'Chain rule', d: `$u = ${a}x → u' = ${a}$, so $y' = ${fn === 'sin' ? `${a}\\cos(${a}x)` : `-${a}\\sin(${a}x)`}$` }
        ]
      };
    }
    if (diff === 2) {
      const a = ri(rng, 2, 5);
      const fn = rc(rng, ['cos', 'sin']);
      const correct = fn === 'cos' ? `$\\dfrac{1}{${a}}\\sin(${a}x) + C$` : `$-\\dfrac{1}{${a}}\\cos(${a}x) + C$`;
      const m = mcq(rng, correct, [
        { text: fn === 'cos' ? `$${a}\\sin(${a}x) + C$` : `$-${a}\\cos(${a}x) + C$`, why: `Integrating *divides* by the inner coefficient: $\\frac{1}{${a}}$, not ×${a}.` },
        { text: fn === 'cos' ? `$-\\dfrac{1}{${a}}\\sin(${a}x) + C$` : `$\\dfrac{1}{${a}}\\cos(${a}x) + C$`, why: fn === 'cos' ? '$\\int\\cos = +\\sin$ — differentiate your answer to check the sign.' : '$\\int\\sin = -\\cos$ — differentiate your answer to check the sign.' },
        { text: fn === 'cos' ? `$\\dfrac{1}{${a}}\\cos(${a}x) + C$` : `$-\\dfrac{1}{${a}}\\sin(${a}x) + C$` }
      ]);
      return {
        prompt: `Find $\\displaystyle\\int \\${fn}(${a}x)\\,dx$.`,
        answerType: 'mcq', answer: { correctIndex: m.correctIndex, optionTraps: m.optionTraps }, mcqOptions: m.options,
        hints: [`$\\int \\${fn}(x) dx = ${fn === 'cos' ? '\\sin(x)' : '-\\cos(x)'} + C$.`, `For $\\${fn}(${a}x)$, divide by the inner coefficient.`, `Check by differentiating your answer.`],
        steps: [
          { h: 'Standard integral', d: `$\\int \\${fn}(ax)dx = ${fn === 'cos' ? `\\frac{1}{a}\\sin(ax)` : `-\\frac{1}{a}\\cos(ax)`} + C$` },
          { h: 'Apply with a = ' + a, d: correct }
        ]
      };
    }
    if (diff === 3) {
      const fn = rc(rng, ['sin', 'cos']);
      const m = ri(rng, 1, 4);
      const A = rc(rng, [0, 30, 45, 60, 90, 120, 135, 150, 180]);
      const x0 = piDeg(A, m);
      // d/dx sin(mx) = m cos(mx);  d/dx cos(mx) = -m sin(mx)
      const [p, r, q] = fn === 'sin' ? EXACT_ANGLES[A].cos : EXACT_ANGLES[A].sin;
      const grad = exactSurd(fn === 'sin' ? m * p : -m * p, r, q);
      const raw = exactSurd(fn === 'sin' ? EXACT_ANGLES[A].sin[0] : EXACT_ANGLES[A].cos[0], fn === 'sin' ? EXACT_ANGLES[A].sin[1] : EXACT_ANGLES[A].cos[1], fn === 'sin' ? EXACT_ANGLES[A].sin[2] : EXACT_ANGLES[A].cos[2]);
      return {
        prompt: `If $y = \\${fn}(${m === 1 ? '' : m}x)$, find the **exact** gradient of the curve at $x = ${x0.tex}$.`,
        answerType: 'numeric', answer: { value: grad.val, requireExact: true, canonicalInput: grad.typed },
        inputHint: 'e.g. 1/2 or -sqrt(3)/2',
        traps: [{ value: raw.val, why: `The gradient comes from the *derivative* $y' = ${fn === 'sin' ? `${m === 1 ? '' : m}\\cos` : `-${m === 1 ? '' : m}\\sin`}(${m === 1 ? '' : m}x)$ — not from the original function.`, tol: 0.001 }].filter(t => Math.abs(t.value - grad.val) > 0.002),
        hints: [
          `Differentiate: $y' = ${fn === 'sin' ? `${m === 1 ? '' : m}\\cos(${m === 1 ? '' : m}x)` : `-${m === 1 ? '' : m}\\sin(${m === 1 ? '' : m}x)`}$.`,
          `At $x = ${x0.tex}$ the inner angle is $${m === 1 ? '' : m} \\times ${x0.tex} = ${A}°$.`,
          `Use the exact value of $\\${fn === 'sin' ? 'cos' : 'sin'} ${A}°$.`
        ],
        steps: [
          { h: 'Differentiate', d: `$y' = ${fn === 'sin' ? `${m === 1 ? '' : m}\\cos(${m === 1 ? '' : m}x)` : `-${m === 1 ? '' : m}\\sin(${m === 1 ? '' : m}x)`}$` },
          { h: 'Inner angle', d: `$${m === 1 ? '' : m}\\left(${x0.tex}\\right) = ${A}°$` },
          { h: 'Exact gradient', d: `$y' = ${grad.tex}$` }
        ]
      };
    }
    // Stationary points and horizontal tangents: the calculus produces a trig
    // equation, and solving it exactly is the work.
    const branch = ri(rng, 0, 2);
    if (branch === 0) {
      const pair = rc(rng, [
        { cTex: '2', bTex: '', cosDeg: 60, sinDeg: 30, ratio: '\\dfrac{1}{2}' },
        { cTex: '\\sqrt{2}', bTex: '', cosDeg: 45, sinDeg: 45, ratio: '\\dfrac{1}{\\sqrt{2}}' },
        { cTex: '2', bTex: '\\sqrt{3}', cosDeg: 30, sinDeg: 60, ratio: '\\dfrac{\\sqrt{3}}{2}' }
      ]);
      const trig = rc(rng, ['sin', 'cos']);
      const plus = rc(rng, [true, false]);
      const c0 = nz(rng, -9, 9);
      const eqFn = trig === 'sin' ? 'cos' : 'sin';
      const negRhs = trig === 'sin' ? plus : !plus;
      const acute = trig === 'sin' ? pair.cosDeg : pair.sinDeg;
      const deg = trig === 'sin' ? (negRhs ? 180 - acute : acute) : (negRhs ? 180 + acute : acute);
      const other = trig === 'sin' ? 360 - deg : (deg <= 180 ? 180 - deg : 540 - deg);
      const root = piDeg(deg), alt = piDeg(other);
      const rhs = `${negRhs ? '-' : ''}${pair.ratio}`;
      return {
        prompt: `The curve $y = ${pair.cTex}\\${trig} x ${plus ? '+' : '-'} ${pair.bTex}x ${sgn(c0)}$ has horizontal tangents. Find the **smallest positive** value of $x$ at which this happens, giving an exact answer.`,
        answerType: 'numeric', answer: { value: root.val, requireExact: true, canonicalInput: root.typed, tol: 0.0005 },
        inputHint: 'e.g. pi/3',
        traps: [
          { value: alt.val, why: `That is a genuine solution of the equation, but a larger one — the question asks for the **smallest** positive value, which is $${root.tex}$.`, tol: 0.0005 },
          { value: piDeg(trig === 'sin' ? (negRhs ? acute : 180 - acute) : (negRhs ? acute : 180 + acute)).val, why: `Check the sign when you move the $${pair.bTex || ''}x$ term across: the equation is $\\${eqFn} x = ${rhs}$.`, tol: 0.0005 }
        ].filter(t => Math.abs(t.value - root.val) > 0.001),
        hints: [`A horizontal tangent means $\\dfrac{dy}{dx} = 0$.`,
          `$\\dfrac{dy}{dx} = ${trig === 'sin' ? `${pair.cTex}\\cos x ${plus ? '+' : '-'} ${pair.bTex || '1'}` : `-${pair.cTex}\\sin x ${plus ? '+' : '-'} ${pair.bTex || '1'}`}$ — the constant $${c0}$ differentiates away.`,
          `Setting that to zero gives $\\${eqFn} x = ${rhs}$.`],
        steps: [
          { h: 'Differentiate', d: `$\\dfrac{dy}{dx} = ${trig === 'sin' ? `${pair.cTex}\\cos x ${plus ? '+' : '-'} ${pair.bTex || '1'}` : `-${pair.cTex}\\sin x ${plus ? '+' : '-'} ${pair.bTex || '1'}`}$` },
          { h: 'Set the derivative to zero', d: `$\\${eqFn} x = ${rhs}$` },
          { h: 'Solve over the positive reals', d: `$x = ${root.tex}$ or $x = ${alt.tex}$, and so on every $2\\pi$` },
          { h: 'Smallest positive solution', d: `$x = ${root.tex}$` }
        ]
      };
    }
    if (branch === 1) {
      const a = ri(rng, 1, 6), m0 = ri(rng, 1, 4);
      const trig = rc(rng, ['sin', 'cos']);
      const deg = trig === 'sin' ? 90 : 180;
      const root = piDeg(deg, m0);
      const alt = piDeg(deg + 180, m0);
      return {
        prompt: `Find the **smallest positive** value of $x$ at which the curve $y = ${a === 1 ? '' : a}\\${trig}(${m0 === 1 ? '' : m0}x)$ has a stationary point. Give an exact answer.`,
        answerType: 'numeric', answer: { value: root.val, requireExact: true, canonicalInput: root.typed, tol: 0.0005 },
        inputHint: 'e.g. pi/4',
        traps: [
          { value: alt.val, why: `That is the *next* stationary point. Between them the curve turns once, so the smallest positive one is $${root.tex}$.`, tol: 0.0005 },
          { value: piDeg(deg).val, why: `The inner $${m0 === 1 ? '' : m0}x$ matters: the derivative vanishes when $${m0 === 1 ? 'x' : `${m0}x`} = ${piDeg(deg).tex}$, so divide by $${m0}$.`, tol: 0.0005 }
        ].filter(t => Math.abs(t.value - root.val) > 0.001),
        hints: [`$\\dfrac{dy}{dx} = ${trig === 'sin' ? `${a * m0}\\cos(${m0 === 1 ? '' : m0}x)` : `-${a * m0}\\sin(${m0 === 1 ? '' : m0}x)`}$.`,
          `Set it to zero: $\\${trig === 'sin' ? 'cos' : 'sin'}(${m0 === 1 ? '' : m0}x) = 0$.`,
          `The smallest positive solution of $\\${trig === 'sin' ? 'cos' : 'sin'}\\theta = 0$ is $\\theta = ${piDeg(deg).tex}$${m0 === 1 ? '.' : ` — now divide by $${m0}$.`}`],
        steps: [
          { h: 'Differentiate', d: `$\\dfrac{dy}{dx} = ${trig === 'sin' ? `${a * m0}\\cos(${m0 === 1 ? '' : m0}x)` : `-${a * m0}\\sin(${m0 === 1 ? '' : m0}x)`}$` },
          { h: 'Solve the trig equation', d: `$\\${trig === 'sin' ? 'cos' : 'sin'}(${m0 === 1 ? '' : m0}x) = 0 \\Rightarrow ${m0 === 1 ? 'x' : `${m0}x`} = ${piDeg(deg).tex}$` },
          { h: m0 === 1 ? 'Read off the solution' : 'Divide by the inner coefficient', d: `$x = ${root.tex}$` }
        ]
      };
    }
    const a = ri(rng, 1, 6), m0 = ri(rng, 1, 4);
    const trig = rc(rng, ['sin', 'cos']);
    const count = trig === 'sin' ? 2 * m0 : 2 * m0 + 1;
    return {
      prompt: `How many stationary points does $y = ${a === 1 ? '' : a}\\${trig}(${m0 === 1 ? '' : m0}x)$ have in the domain $0 \\le x \\le 2\\pi$?`,
      answerType: 'numeric', answer: { value: count },
      traps: [
        { value: trig === 'sin' ? 2 * m0 + 1 : 2 * m0, why: trig === 'sin' ? `$\\cos(${m0 === 1 ? '' : m0}x) = 0$ has no solution at either endpoint, so there are exactly $${2 * m0}$.` : `$\\sin(${m0 === 1 ? '' : m0}x) = 0$ is satisfied at **both** endpoints $x = 0$ and $x = 2\\pi$, so both count.` },
        { value: m0, why: `Over $0 \\le x \\le 2\\pi$ the inner angle $${m0 === 1 ? 'x' : `${m0}x`}$ sweeps through $${2 * m0}\\pi$, which is $${m0}$ full turns — and each turn contains more than one stationary point.` }
      ],
      hints: [`$\\dfrac{dy}{dx} = ${trig === 'sin' ? `${a * m0}\\cos(${m0 === 1 ? '' : m0}x)` : `-${a * m0}\\sin(${m0 === 1 ? '' : m0}x)`}$.`,
        `Let $\\theta = ${m0 === 1 ? 'x' : `${m0}x`}$. As $x$ runs from $0$ to $2\\pi$, $\\theta$ runs from $0$ to $${2 * m0}\\pi$.`,
        `Count the solutions of $\\${trig === 'sin' ? 'cos' : 'sin'}\\theta = 0$ in that range — including the endpoints if they qualify.`],
      steps: [
        { h: 'Differentiate', d: `$\\dfrac{dy}{dx} = ${trig === 'sin' ? `${a * m0}\\cos(${m0 === 1 ? '' : m0}x)` : `-${a * m0}\\sin(${m0 === 1 ? '' : m0}x)`}$` },
        { h: 'Substitute θ', d: `$\\theta = ${m0 === 1 ? 'x' : `${m0}x`}$ runs over $0 \\le \\theta \\le ${2 * m0}\\pi$` },
        { h: 'Count the zeros', d: trig === 'sin' ? `$\\cos\\theta = 0$ at $\\theta = \\dfrac{\\pi}{2}, \\dfrac{3\\pi}{2}, \\ldots$ — $${count}$ of them` : `$\\sin\\theta = 0$ at $\\theta = 0, \\pi, 2\\pi, \\ldots, ${2 * m0}\\pi$ — $${count}$ of them` },
        { h: 'Answer', d: `$${count}$ stationary points` }
      ]
    };
  },

  // ── Exponential & log calculus ───────────────────────────────────────────
  'y12-explogcalc': (rng, diff) => {
    if (diff === 1) {
      const a = ri(rng, 2, 6);
      const m = mcq(rng, `$${a}e^{${a}x}$`, [
        { text: `$e^{${a}x}$`, why: `Chain rule: the inner derivative ${a} comes out the front.` },
        { text: `$${a}x e^{${a}x - 1}$`, why: 'The power rule is for $x^n$ — exponentials $e^{ax}$ differentiate to $ae^{ax}$ instead.' },
        { text: `$\\dfrac{e^{${a}x}}{${a}}$`, why: 'Dividing by ' + a + ' is what happens when you *integrate* — differentiation multiplies.' }
      ]);
      return {
        prompt: `Differentiate $y = e^{${a}x}$.`,
        answerType: 'mcq', answer: { correctIndex: m.correctIndex, optionTraps: m.optionTraps }, mcqOptions: m.options,
        hints: ['$e^x$ is its own derivative; add the chain rule.', `Inner derivative of ${a}x is ${a}.`, `$y' = ${a}e^{${a}x}$.`],
        steps: [
          { h: 'Standard form', d: `$\\dfrac{d}{dx}e^{ax} = ae^{ax}$` },
          { h: 'Apply', d: `$y' = ${a}e^{${a}x}$` }
        ]
      };
    }
    if (diff === 2) {
      // Integrating the exponential and reciprocal families — the two standard
      // results, with the chain rule running backwards.
      const shape = ri(rng, 1, 4);
      if (shape === 1) {
        const a = ri(rng, 2, 7), m = ri(rng, 1, 9);
        const mTex = m === 1 ? '' : m;
        return {
          prompt: `Find $\\displaystyle\\int ${a * m}e^{${a}x}\\,dx$. (You may omit the $+C$.)`,
          answerType: 'expression', answer: { expr: `${m}*e^(${a}*x)`, stripC: true },
          inputHint: `e.g. ${mTex}e^(${a}x) + C`,
          answerPrefix: '∫ =',
          traps: [
            { expr: `${a * a * m}*e^(${a}*x)`, why: `That is the *derivative*. Integrating $e^{${a}x}$ **divides** by $${a}$ rather than multiplying by it.` },
            { expr: `${a * m}*e^(${a}*x)`, why: `The $\\dfrac{1}{${a}}$ from the inner coefficient has been left out: $${a * m} \\div ${a} = ${m}$.` }
          ],
          hints: [`$\\displaystyle\\int e^{ax}\\,dx = \\dfrac{1}{a}e^{ax} + C$.`,
            `Here $a = ${a}$, so the integral picks up a factor of $\\dfrac{1}{${a}}$.`,
            `$${a * m} \\times \\dfrac{1}{${a}} = ${m}$.`],
          steps: [
            { h: 'Standard integral', d: `$\\displaystyle\\int e^{${a}x}\\,dx = \\dfrac{1}{${a}}e^{${a}x} + C$` },
            { h: 'Keep the coefficient', d: `$\\displaystyle\\int ${a * m}e^{${a}x}\\,dx = \\dfrac{${a * m}}{${a}}e^{${a}x} + C$` },
            { h: 'Simplify', d: `$= ${mTex}e^{${a}x} + C$` },
            { h: 'Check by differentiating', d: `$\\dfrac{d}{dx}\\left(${mTex}e^{${a}x}\\right) = ${a * m}e^{${a}x}$ ✓` }
          ]
        };
      }
      if (shape === 2) {
        const k = ri(rng, 2, 12), m = nz(rng, -9, 9);
        const mx = `${m >= 0 ? '+' : '-'} ${term(Math.abs(m))}`;
        return {
          prompt: `Find $\\displaystyle\\int \\left(\\dfrac{${k}}{x} ${sgn(m)}\\right)\\,dx$ for $x > 0$. (You may omit the $+C$.)`,
          answerType: 'expression', answer: { expr: `${k}*ln(x) + ${pn12(m)}*x`, stripC: true, positiveOnly: true },
          inputHint: `e.g. ${k}ln(x) ${mx} + C`,
          answerPrefix: '∫ =',
          traps: [
            { expr: `${k}*ln(x) + ${pn12(m)}`, why: `The constant $${m}$ integrates to $${term(m)}$, not to $${m}$ — every term gains a power of $x$ except the $\\dfrac{1}{x}$.` },
            { expr: `-${k}/(x^2) + ${pn12(m)}*x`, why: `That differentiates $\\dfrac{${k}}{x}$ instead of integrating it. The standard result is $\\displaystyle\\int \\dfrac{1}{x}\\,dx = \\ln x + C$.` }
          ],
          hints: [`$\\displaystyle\\int \\dfrac{1}{x}\\,dx = \\ln x + C$ — the one power the reverse power rule cannot handle.`,
            `So $\\displaystyle\\int \\dfrac{${k}}{x}\\,dx = ${k}\\ln x$.`,
            `And $\\displaystyle\\int ${m}\\,dx = ${term(m)}$.`],
          steps: [
            { h: 'The reciprocal term', d: `$\\displaystyle\\int \\dfrac{${k}}{x}\\,dx = ${k}\\ln x$` },
            { h: 'The constant term', d: `$\\displaystyle\\int ${m}\\,dx = ${term(m)}$` },
            { h: 'Add them', d: `$${k}\\ln x ${mx} + C$` }
          ]
        };
      }
      if (shape === 3) {
        const a = ri(rng, 2, 6), m = ri(rng, 1, 6), b = ri(rng, 1, 9);
        const mTex = m === 1 ? '' : m;
        return {
          prompt: `Find $\\displaystyle\\int \\dfrac{${a * m}}{${a}x + ${b}}\\,dx$ for $x > 0$. (You may omit the $+C$.)`,
          answerType: 'expression', answer: { expr: `${m}*ln(${a}*x + ${b})`, stripC: true, positiveOnly: true },
          inputHint: `e.g. ${mTex}ln(${a}x + ${b}) + C`,
          answerPrefix: '∫ =',
          traps: [
            { expr: `${a * m}*ln(${a}*x + ${b})`, why: `Reversing the chain rule divides by the inner derivative $${a}$: $${a * m} \\div ${a} = ${m}$.` },
            { expr: `${a * m}*ln(x)`, why: `The whole bracket $${a}x + ${b}$ goes inside the logarithm — it cannot be reduced to $\\ln x$.` }
          ],
          hints: [`$\\displaystyle\\int \\dfrac{f'(x)}{f(x)}\\,dx = \\ln f(x) + C$.`,
            `Here $f(x) = ${a}x + ${b}$ and $f'(x) = ${a}$.`,
            m === 1 ? `The top is already exactly $f'(x)$, so the integral is $\\ln f(x) + C$ straight away.` : `Rewrite the top as $${m} \\times ${a}$ so that $f'(x)$ is visible on top.`],
          steps: [
            { h: 'Spot the form', d: m === 1 ? `The top, $${a}$, is exactly the derivative of the bottom` : `$\\dfrac{${a * m}}{${a}x + ${b}} = ${m} \\times \\dfrac{${a}}{${a}x + ${b}}$` },
            { h: 'Apply the standard result', d: `$\\displaystyle\\int \\dfrac{${a}}{${a}x + ${b}}\\,dx = \\ln(${a}x + ${b}) + C$` },
            { h: m === 1 ? 'Answer' : 'Restore the coefficient', d: `$= ${mTex}\\ln(${a}x + ${b}) + C$` }
          ]
        };
      }
      const k = ri(rng, 2, 9), p = ri(rng, 2, 9);
      return {
        prompt: `Evaluate $\\displaystyle\\int_{1}^{${p}} \\dfrac{${k}}{x}\\,dx$, giving an exact answer.`,
        answerType: 'numeric', answer: { value: k * Math.log(p), requireExact: true, canonicalInput: `${k}ln(${p})`, tol: 0.0005 },
        inputHint: `e.g. ${k}ln(${p})`,
        traps: [
          { value: k * Math.log(p) / p, why: `The antiderivative of $\\dfrac{${k}}{x}$ is $${k}\\ln x$ — there is no extra division by the limit.`, tol: 0.0005 },
          { value: k * (p - 1), why: `$\\displaystyle\\int \\dfrac{1}{x}\\,dx$ is $\\ln x$, not $x$ — the reverse power rule breaks down for the power $-1$.`, tol: 0.0005 }
        ],
        hints: [`$\\displaystyle\\int \\dfrac{${k}}{x}\\,dx = ${k}\\ln x + C$.`,
          `So the value is $\\left[${k}\\ln x\\right]_{1}^{${p}} = ${k}\\ln ${p} - ${k}\\ln 1$.`,
          `$\\ln 1 = 0$.`],
        steps: [
          { h: 'Antiderivative', d: `$\\displaystyle\\int \\dfrac{${k}}{x}\\,dx = ${k}\\ln x$` },
          { h: 'Substitute the limits', d: `$${k}\\ln ${p} - ${k}\\ln 1$` },
          { h: 'Simplify', d: `$\\ln 1 = 0$, so the integral is $${k}\\ln ${p}$` }
        ]
      };
    }
    if (diff === 3) {
      const P0 = rc(rng, [150, 200, 250, 400, 500, 800, 1000, 1500, 2000, 4000, 5000]);
      const kPct = rc(rng, [4, 5, 6, 8, 10, 12, 15, 20]);
      const t = ri(rng, 2, 14);
      const val = P0 * Math.exp(kPct / 100 * t);
      return {
        prompt: `A bacteria population grows according to $N(t) = ${P0}e^{${kPct / 100}t}$ (t in hours). Find the population after $${t}$ hours, to the nearest whole number.`,
        answerType: 'numeric', answer: { value: Math.round(val), tol: 1.01 },
        traps: [{ value: Math.round(P0 * (1 + kPct / 100 * t)), why: 'Exponential growth compounds continuously — evaluate $e^{kt}$, don’t linearise it.', tol: 1.01 }],
        hints: ['Substitute t into the model.', `$N(${t}) = ${P0}e^{${kPct / 100} \\times ${t}} = ${P0}e^{${r2(kPct / 100 * t)}}$.`, `$e^{${r2(kPct / 100 * t)}} \\approx ${r3(Math.exp(kPct / 100 * t))}$.`],
        steps: [
          { h: 'Substitute', d: `$N(${t}) = ${P0}e^{${r2(kPct / 100 * t)}}$` },
          { h: 'Evaluate', d: `$= ${P0} \\times ${r3(Math.exp(kPct / 100 * t))} \\approx ${Math.round(val)}$` }
        ]
      };
    }
    const kPct = rc(rng, [2, 2.5, 3, 3.5, 4, 4.5, 5, 6, 7, 8, 9, 10, 12, 15]);
    const mult = rc(rng, [2, 3, 4, 5, 10]);
    const k = kPct / 100;
    const tGrow = Math.log(mult) / k;
    const word = mult === 2 ? 'double' : mult === 3 ? 'triple' : `grow to $${mult}$ times its starting value`;
    return {
      prompt: `An investment grows continuously at rate $k = ${k}$ per year: $A(t) = A_0 e^{${k}t}$. How long until it **${word}**? Answer in years, correct to 1 decimal place.`,
      answerType: 'numeric', answer: { value: r1(tGrow), tol: 0.06 }, answerSuffix: 'years',
      traps: [{ value: r1(100 * (mult - 1) / kPct), why: `That's the simple-interest estimate — with continuous growth, solve $e^{${k}t} = ${mult}$ using ln.`, tol: 0.5 }].filter(t => Math.abs(t.value - r1(tGrow)) > 1),
      hints: [`Set $A(t) = ${mult}A_0$.`, `$e^{${k}t} = ${mult}$ — take ln of both sides.`, `$t = \\dfrac{\\ln ${mult}}{${k}}$.`],
      steps: [
        { h: 'Growth condition', d: `$A_0e^{${k}t} = ${mult}A_0 \\Rightarrow e^{${k}t} = ${mult}$` },
        { h: 'Take ln', d: `$${k}t = \\ln ${mult} = ${r3(Math.log(mult))}$` },
        { h: 'Solve', d: `$t = \\dfrac{${r3(Math.log(mult))}}{${k}} \\approx ${r1(tGrow)}$ years` }
      ]
    };
  },

  // ── Sequences & series ───────────────────────────────────────────────────
  'y12-series': (rng, diff) => {
    if (diff === 1) {
      const a = ri(rng, -5, 12), d = nz(rng, -6, 8), n = ri(rng, 10, 40);
      const val = a + (n - 1) * d;
      return {
        prompt: `An arithmetic sequence has first term $a = ${a}$ and common difference $d = ${d}$. Find the $${n}$th term.`,
        answerType: 'numeric', answer: { value: val },
        traps: [{ value: a + n * d, why: `The nth term adds the difference $n - 1$ times (the first term uses none): $T_n = a + (n-1)d$.` }],
        hints: ['$T_n = a + (n - 1)d$.', `$T_{${n}} = ${a} + ${n - 1} \\times ${d < 0 ? `(${d})` : d}$.`, `$${n - 1} \\times ${d} = ${(n - 1) * d}$.`],
        steps: [
          { h: 'Formula', d: `$T_n = a + (n-1)d$` },
          { h: 'Substitute', d: `$T_{${n}} = ${a} + (${n - 1})(${d}) = ${a} ${sgn((n - 1) * d)}$` },
          { h: 'Evaluate', d: `$T_{${n}} = ${val}$` }
        ]
      };
    }
    if (diff === 2) {
      const a = ri(rng, 2, 15), d = nz(rng, 2, 8), n = ri(rng, 10, 30);
      const val = n / 2 * (2 * a + (n - 1) * d);
      return {
        prompt: `Find the sum of the first $${n}$ terms of the arithmetic series $${a} + ${a + d} + ${a + 2 * d} + \\cdots$`,
        answerType: 'numeric', answer: { value: val },
        traps: [
          { value: a + (n - 1) * d, why: `That's the ${n}th *term* — the question asks for the *sum* of the first ${n} terms.` },
          { value: n * (a + (n - 1) * d), why: 'Sum formula: $\\frac{n}{2}(2a + (n-1)d)$ — the average of first and last, times n.' }
        ],
        hints: ['$S_n = \\frac{n}{2}\\left(2a + (n-1)d\\right)$.', `$a = ${a}$, $d = ${d}$, $n = ${n}$.`, `$S_{${n}} = \\frac{${n}}{2}(${2 * a} + ${(n - 1) * d})$.`],
        steps: [
          { h: 'Identify a and d', d: `$a = ${a}, \\quad d = ${d}$` },
          { h: 'Sum formula', d: `$S_{${n}} = \\dfrac{${n}}{2}\\left(2(${a}) + (${n - 1})(${d})\\right) = \\dfrac{${n}}{2}(${2 * a + (n - 1) * d})$` },
          { h: 'Evaluate', d: `$S_{${n}} = ${val}$` }
        ]
      };
    }
    if (diff === 3) {
      const a = ri(rng, 1, 6), r = rc(rng, [2, 3, -2, 0.5]);
      const n = r === 0.5 ? ri(rng, 4, 7) : ri(rng, 4, 8);
      const val = a * Math.pow(r, n - 1);
      return {
        prompt: `A geometric sequence has first term $${a}$ and common ratio $${r}$. Find the $${n}$th term${r === 0.5 ? ' (as a decimal or fraction)' : ''}.`,
        answerType: 'numeric', answer: { value: val, tol: Math.abs(val) * 1e-6 + 1e-9 },
        traps: [
          { value: a * Math.pow(r, n), why: `The exponent is $n - 1$: the first term has no factor of r yet.` },
          { value: a + r * (n - 1), why: 'Geometric sequences *multiply* by r each step — this used the arithmetic formula.' }
        ].filter(t => Math.abs(t.value - val) > 1e-9),
        hints: ['$T_n = ar^{n-1}$.', `$T_{${n}} = ${a} \\times (${r})^{${n - 1}}$.`, `$(${r})^{${n - 1}} = ${r3(Math.pow(r, n - 1))}$.`],
        steps: [
          { h: 'Formula', d: `$T_n = ar^{n-1}$` },
          { h: 'Substitute', d: `$T_{${n}} = ${a} \\times (${r})^{${n - 1}}$` },
          { h: 'Evaluate', d: `$= ${a} \\times ${r3(Math.pow(r, n - 1))} = ${r3(val)}$` }
        ]
      };
    }
    const a = ri(rng, 2, 24);
    const rPick = rc(rng, [[1, 2], [1, 3], [2, 3], [1, 4], [3, 4], [1, 5]]);
    const rf = new Frac(rPick[0], rPick[1]);
    const sum = new Frac(a * rf.d, rf.d - rf.n);
    return {
      prompt: `Find the limiting sum of the geometric series $${a} + ${new Frac(a * rf.n, rf.d).latex()} + ${new Frac(a * rf.n * rf.n, rf.d * rf.d).latex()} + \\cdots$`,
      answerType: 'numeric', answer: { value: sum.value, simplestFraction: sum.d === 1 ? undefined : { n: sum.n, d: sum.d }, tol: 0.001 },
      inputHint: sum.d === 1 ? 'a whole number' : 'e.g. 32/3',
      traps: [
        { value: a / rf.value, why: 'Limiting sum: $S_\\infty = \\frac{a}{1 - r}$ — divide by $1 - r$, not by r.' },
        { value: a * rf.d / (rf.n + rf.d), why: 'The denominator is $1 - r$, so subtract: check the sign in $\\frac{a}{1-r}$.' }
      ].filter(t => Math.abs(t.value - sum.value) > 0.01),
      hints: ['First find the common ratio.', `$r = ${rf.latex()}$ (each term × ${rf.latex()}); since $|r| < 1$ a limiting sum exists.`, `$S_\\infty = \\dfrac{${a}}{1 - ${rf.latex()}}$.`],
      steps: [
        { h: 'Common ratio', d: `$r = ${rf.latex()}$` },
        { h: 'Limiting sum formula', d: `$S_\\infty = \\dfrac{a}{1 - r} = \\dfrac{${a}}{1 - ${rf.latex()}} = \\dfrac{${a}}{${new Frac(rf.d - rf.n, rf.d).latex()}}$` },
        { h: 'Evaluate', d: `$S_\\infty = ${sum.latex()}$` }
      ]
    };
  },

  // ── Financial maths & annuities ──────────────────────────────────────────
  'y12-financial': (rng, diff) => {
    if (diff === 1) {
      const P = ri(rng, 4, 20) * 1000;
      const rr = rc(rng, [4, 5, 6]);
      const n = ri(rng, 5, 15);
      const A = P * (1 + rr / 100) ** n;
      return {
        prompt: `${moneyPlain(P)} is invested at $${rr}\\%$ p.a., compounding annually, for $${n}$ years. Find the future value, to the nearest dollar.`,
        answerType: 'numeric', answer: { value: Math.round(A), tol: 1.01 }, answerPrefix: '$',
        traps: [{ value: Math.round(P * (1 + rr * n / 100)), why: 'That’s simple growth — compound growth uses the multiplier $(1+r)^n$.', tol: 1.01 }],
        hints: ['$FV = P(1 + r)^n$.', `$FV = ${P}(${1 + rr / 100})^{${n}}$.`, `$(${1 + rr / 100})^{${n}} \\approx ${r3((1 + rr / 100) ** n)}$.`],
        steps: [
          { h: 'Formula', d: `$FV = P(1+r)^n = ${P}(${1 + rr / 100})^{${n}}$` },
          { h: 'Evaluate', d: `$\\approx ${moneyPlain(Math.round(A))}$` }
        ]
      };
    }
    if (diff === 2) {
      const dep = rc(rng, [250, 400, 500, 600, 750, 1000, 1200, 1500, 2000, 2500, 3000]);
      const rr = rc(rng, [3, 4, 4.5, 5, 5.5, 6, 7, 8, 9, 10]);
      const g = 1 + rr / 100;
      const total = dep * (g ** 3 + g ** 2 + g);
      return {
        prompt: `${moneyPlain(dep)} is deposited at the **start** of each year for 3 years into an account paying $${rr}\\%$ p.a. compounded annually. What is the balance at the end of the third year, to the nearest cent?`,
        answerType: 'numeric', answer: { value: r2(total), tol: 0.02 }, answerPrefix: '$',
        traps: [
          { value: r2(dep * 3 * g), why: 'Each deposit compounds for a *different* number of years (3, 2 and 1) — track them separately.', tol: 0.02 },
          { value: r2(dep * (g ** 2 + g + 1)), why: 'Start-of-year deposits earn interest in their first year too: the powers are 3, 2, 1 — not 2, 1, 0.', tol: 0.02 }
        ],
        hints: ['Follow each deposit separately.', `1st deposit compounds 3 years: $${dep}(${g})^3$. 2nd: 2 years. 3rd: 1 year.`, `Sum: $${dep}(${g}^3 + ${g}^2 + ${g})$.`],
        steps: [
          { h: 'Each deposit grows', d: `$${dep}(${g})^3 + ${dep}(${g})^2 + ${dep}(${g})^1$` },
          { h: 'Evaluate each', d: `$${r2(dep * g ** 3)} + ${r2(dep * g ** 2)} + ${r2(dep * g)}$` },
          { h: 'Total', d: `$${r2(total)}$ → ${moneyPlain(r2(total))}` }
        ]
      };
    }
    if (diff === 3) {
      const a = rc(rng, [1000, 1500, 2000, 3000]);
      const rr = rc(rng, [4, 5, 6, 7]);
      const n = ri(rng, 8, 20);
      const g = 1 + rr / 100;
      const FV = a * (g ** n - 1) / (rr / 100);
      return {
        prompt: `${moneyPlain(a)} is deposited at the **end** of each year for $${n}$ years, earning $${rr}\\%$ p.a. compounded annually. Using the annuity formula $FV = a\\dfrac{(1+r)^n - 1}{r}$, find the future value to the nearest dollar.`,
        answerType: 'numeric', answer: { value: Math.round(FV), tol: 1.51 }, answerPrefix: '$',
        traps: [{ value: a * n, why: `${moneyPlain(a * n)} is just the deposits with *no interest* — the annuity formula adds the compound growth of every deposit.`, tol: 1.01 }],
        hints: ['This is a geometric series of compounded deposits.', `$FV = ${a} \\times \\dfrac{(${g})^{${n}} - 1}{${rr / 100}}$.`, `$(${g})^{${n}} = ${r3(g ** n)}$.`],
        steps: [
          { h: 'Annuity formula', d: `$FV = a\\dfrac{(1+r)^n - 1}{r} = ${a}\\dfrac{(${g})^{${n}} - 1}{${rr / 100}}$` },
          { h: 'Growth factor', d: `$(${g})^{${n}} = ${r3(g ** n)}$` },
          { h: 'Evaluate', d: `$FV = ${a} \\times ${r3((g ** n - 1) / (rr / 100))} \\approx ${moneyPlain(Math.round(FV))}$` }
        ]
      };
    }
    const L = rc(rng, [8000, 10000, 12000, 15000, 18000, 20000, 25000, 30000]);
    const rr = rc(rng, [6, 9, 12, 15, 18]);
    const rMonthly = rr / 1200;
    const M = rc(rng, [250, 300, 350, 400, 450, 500, 600, 750]);
    const b1 = L * (1 + rMonthly) - M;
    const b2 = b1 * (1 + rMonthly) - M;
    return {
      prompt: `A ${moneyPlain(L)} loan charges interest at $${rr}\\%$ p.a. compounded **monthly** (${rr / 12}\\% per month), with repayments of ${moneyPlain(M)} at the end of each month. Find the balance owing after the **second** repayment, to the nearest cent.`,
      answerType: 'numeric', answer: { value: r2(b2), tol: 0.02 }, answerPrefix: '$',
      traps: [
        { value: r2(L - 2 * M), why: 'Interest accrues before each repayment — the balance grows by ' + (rr / 12) + '% each month before the payment comes off.', tol: 0.02 },
        { value: r2(b1), why: 'That’s the balance after the *first* repayment — apply one more month of interest and one more payment.', tol: 0.02 }
      ],
      hints: ['Each month: balance × (1 + r) − repayment.', `Month 1: $${L} \\times ${1 + rMonthly} - ${M} = ${r2(b1)}$.`, `Month 2: repeat on ${r2(b1)}.`],
      steps: [
        { h: 'Recurrence', d: `$B_{k+1} = B_k(1 + ${rMonthly}) - ${M}$` },
        { h: 'After month 1', d: `$${L} \\times ${1 + rMonthly} - ${M} = ${r2(b1)}$` },
        { h: 'After month 2', d: `$${r2(b1)} \\times ${1 + rMonthly} - ${M} = ${r2(b2)}$ → ${moneyPlain(r2(b2))}` }
      ]
    };
  },

  // ── Random variables & the normal curve ──────────────────────────────────
  'y12-stats': (rng, diff) => {
    if (diff === 1) {
      const vals = [0, 1, 2, 3];
      const den = 20;
      let p1 = ri(rng, 1, 9), p2 = ri(rng, 1, 9), p3 = ri(rng, 1, 8);
      while (p1 + p2 + p3 >= den) { p1 = ri(rng, 1, 9); p2 = ri(rng, 1, 9); p3 = ri(rng, 1, 8); }
      const p0 = den - p1 - p2 - p3;
      const probs = [p0, p1, p2, p3];
      const E = vals.reduce((s, v, i) => s + v * probs[i] / den, 0);
      return {
        prompt: `A discrete random variable $X$ has $P(X=0) = ${p0 / den}$, $P(X=1) = ${p1 / den}$, $P(X=2) = ${p2 / den}$, $P(X=3) = ${p3 / den}$. Find $E(X)$.`,
        answerType: 'numeric', answer: { value: r2(E), tol: 0.011 },
        traps: [{ value: 1.5, why: 'E(X) weights each value by its probability: $\\sum x\\,P(X=x)$ — not the midpoint of the values.', tol: 0.011 }].filter(t => Math.abs(t.value - r2(E)) > 0.03),
        hints: ['$E(X) = \\sum x \\cdot P(X = x)$.', `$0(${p0 / den}) + 1(${p1 / den}) + 2(${p2 / den}) + 3(${p3 / den})$.`, `$= ${r3(p1 / den)} + ${r3(2 * p2 / den)} + ${r3(3 * p3 / den)}$.`],
        steps: [
          { h: 'Expected value formula', d: `$E(X) = \\sum x\\,P(X{=}x)$` },
          { h: 'Substitute', d: `$0 \\times ${p0 / den} + 1 \\times ${p1 / den} + 2 \\times ${p2 / den} + 3 \\times ${p3 / den}$` },
          { h: 'Evaluate', d: `$E(X) = ${r2(E)}$` }
        ]
      };
    }
    if (diff === 2) {
      const den = 20;
      let a = ri(rng, 1, 12), c = ri(rng, 1, 12);
      while (a + c >= den) { a = ri(rng, 1, 12); c = ri(rng, 1, 12); }
      const b = den - a - c;
      const E = (0 * a + 1 * b + 2 * c) / den;
      const EX2 = (0 * a + 1 * b + 4 * c) / den;
      const V = EX2 - E * E;
      return {
        prompt: `$X$ takes values $0, 1, 2$ with $P(X=0) = ${a / den}$, $P(X=1) = ${b / den}$, $P(X=2) = ${c / den}$. Find $\\text{Var}(X)$, correct to 2 decimal places.`,
        answerType: 'numeric', answer: { value: r2(V), tol: 0.011 },
        traps: [
          { value: r2(EX2), why: `$${r2(EX2)}$ is $E(X^2)$ — subtract $[E(X)]^2 = ${r2(E * E)}$ for the variance.`, tol: 0.011 },
          { value: r2(EX2 - E), why: 'Var(X) subtracts the *square* of the mean: $E(X^2) - [E(X)]^2$.', tol: 0.011 }
        ].filter(t => Math.abs(t.value - r2(V)) > 0.02),
        hints: ['$\\text{Var}(X) = E(X^2) - [E(X)]^2$.', `$E(X) = ${r2(E)}$.`, `$E(X^2) = 0^2(${a / den}) + 1^2(${b / den}) + 2^2(${c / den}) = ${r2(EX2)}$.`],
        steps: [
          { h: 'Mean', d: `$E(X) = ${r2(E)}$` },
          { h: 'Second moment', d: `$E(X^2) = ${r2(EX2)}$` },
          { h: 'Variance', d: `$${r2(EX2)} - (${r2(E)})^2 = ${r2(V)}$` }
        ]
      };
    }
    if (diff === 3) {
      const mu = rc(rng, [40, 45, 50, 55, 60, 65, 70, 75, 80, 90, 100, 110]);
      const sd = rc(rng, [2, 4, 5, 6, 8, 10, 12, 15, 20]);
      const z = rc(rng, [-2.5, -2, -1.5, -1, -0.5, 0.5, 1, 1.5, 2, 2.5]);
      const x = mu + z * sd;
      return {
        prompt: `Test scores are normally distributed with mean $${mu}$ and standard deviation $${sd}$. Find the **z-score** of a mark of $${x}$.`,
        answerType: 'numeric', answer: { value: z, tol: 0.011 }, answerPrefix: 'z =',
        traps: [
          { value: x - mu, why: `$${x - mu}$ is the raw distance from the mean — divide by the standard deviation ${sd} to standardise.`, tol: 0.011 },
          { value: -z, why: 'Order matters: $z = \\frac{x - \\mu}{\\sigma}$ — a mark ' + (z > 0 ? 'above' : 'below') + ' the mean gives a ' + (z > 0 ? 'positive' : 'negative') + ' z.', tol: 0.011 }
        ].filter(t => Math.abs(t.value - z) > 0.02),
        hints: ['$z = \\dfrac{x - \\mu}{\\sigma}$.', `$z = \\dfrac{${x} - ${mu}}{${sd}}$.`, `$= \\dfrac{${x - mu}}{${sd}}$.`],
        steps: [
          { h: 'Formula', d: `$z = \\dfrac{x - \\mu}{\\sigma}$` },
          { h: 'Substitute', d: `$z = \\dfrac{${x} - ${mu}}{${sd}} = \\dfrac{${x - mu}}{${sd}}$` },
          { h: 'Evaluate', d: `$z = ${z}$` }
        ]
      };
    }
    const mu = rc(rng, [40, 45, 50, 55, 60, 64, 70, 75, 80, 90, 100, 120]);
    const sd = rc(rng, [2, 3, 4, 5, 6, 8, 10, 12, 15]);
    const pick = rc(rng, [
      { lo: mu - sd, hi: mu + sd, pct: 68 },
      { lo: mu - 2 * sd, hi: mu + 2 * sd, pct: 95 },
      { lo: mu - 3 * sd, hi: mu + 3 * sd, pct: 99.7 },
      { lo: mu, hi: mu + sd, pct: 34 },
      { lo: mu - sd, hi: mu, pct: 34 },
      { lo: mu, hi: mu + 2 * sd, pct: 47.5 },
      { lo: mu - 2 * sd, hi: mu, pct: 47.5 },
      { lo: mu + sd, hi: mu + 2 * sd, pct: 13.5 },
      { lo: mu - 2 * sd, hi: mu - sd, pct: 13.5 },
      { lo: mu - sd, hi: mu + 2 * sd, pct: 81.5 },
      { lo: mu + 2 * sd, hi: mu + 3 * sd, pct: 2.35 }
    ]);
    return {
      prompt: `Heights are normally distributed with mean $${mu}$ and standard deviation $${sd}$. Using the empirical (68–95–99.7) rule, what **percentage** of values lie between $${pick.lo}$ and $${pick.hi}$?`,
      answerType: 'numeric', answer: { value: pick.pct, tol: 0.11, percent: true }, answerSuffix: '%',
      traps: [
        { value: pick.pct === 68 ? 95 : 68, why: '68% covers ±1σ; 95% covers ±2σ — count how many standard deviations each bound is from the mean.', tol: 0.11 }
      ].filter(t => Math.abs(t.value - pick.pct) > 1),
      hints: ['Convert the bounds to “number of σ from the mean”.', `${pick.lo} is $${(pick.lo - mu) / sd}σ$ and ${pick.hi} is $${(pick.hi - mu) / sd}σ$ from the mean.`, 'Use symmetry: ±1σ ↔ 68%, ±2σ ↔ 95%.'],
      steps: [
        { h: 'Standardise the bounds', d: `$${pick.lo} → ${(pick.lo - mu) / sd}\\sigma, \\quad ${pick.hi} → ${(pick.hi - mu) / sd}\\sigma$` },
        { h: 'Empirical rule', d: `Between these bounds: $${pick.pct}\\%$` }
      ]
    };
  },

  // ── Motion & rates of change ─────────────────────────────────────────────
  'y12-motion': (rng, diff) => {
    if (diff === 1) {
      const a = nz(rng, 1, 3), b = nz(rng, -6, 6), c = nz(rng, -8, 8), t = ri(rng, 1, 4);
      const v = 3 * a * t * t + 2 * b * t + c;
      return {
        prompt: `A particle moves along a line with displacement $x(t) = ${poly([a, b, c, 0], 't').replace(/ \+ 0$/, '')}$ metres after $t$ seconds. Find its **velocity** at $t = ${t}$.`,
        answerType: 'numeric', answer: { value: v }, answerSuffix: 'm/s',
        traps: [{ value: a * t ** 3 + b * t * t + c * t, why: 'That’s the displacement at t — velocity is the *derivative* of displacement.' }].filter(tr => tr.value !== v),
        hints: ['Velocity = derivative of displacement.', `$v(t) = ${poly([3 * a, 2 * b, c], 't')}$.`, `Substitute $t = ${t}$.`],
        steps: [
          { h: 'Differentiate', d: `$v(t) = \\dot{x}(t) = ${poly([3 * a, 2 * b, c], 't')}$` },
          { h: 'Substitute', d: `$v(${t}) = ${3 * a}(${t * t}) ${sgn(2 * b * t)} ${sgn(c)} = ${v}$ m/s` }
        ]
      };
    }
    if (diff === 2) {
      // Reading a velocity–time graph: gradients are accelerations, areas are
      // distances, and the height has to come off the vertical scale.
      const ask = ri(rng, 0, 3);
      const t1 = ri(rng, 2, 4);
      const acc1 = ri(rng, 1, 4);
      const vTop = t1 * acc1;
      const t2 = t1 + ri(rng, 2, 5);
      const d3 = rc(rng, [1, 2, 3, 4].filter(d => vTop % d === 0));
      const t3 = t2 + d3;
      const back = ask === 3 ? true : rc(rng, [true, false]);
      const d4 = ri(rng, 2, 4);
      const t4 = t3 + d4;
      const vEnd = back ? -ri(rng, 2, 6) : 0;
      const figure = figMotion({
        pts: [[0, 0], [t1, vTop], [t2, vTop], [t3, 0], [t4, vEnd]],
        yLabel: 'v (m/s)', tMax: t4, vMin: Math.min(0, vEnd) - 2, vMax: vTop + 2
      });
      const lead = `The velocity–time graph shows a particle over the first $${t4}$ seconds of its motion. It accelerates uniformly from rest until $t = ${t1}$, travels at constant velocity until $t = ${t2}$, slows uniformly to rest at $t = ${t3}$${back ? `, then moves in the negative direction until $t = ${t4}$` : ` and stays at rest until $t = ${t4}$`}.`;
      const areaUp = vTop * (t1 + d3) / 2 + (t2 - t1) * vTop;
      if (ask === 0) {
        return {
          prompt: `${lead}\n\nFind the particle's **acceleration** during the first $${t1}$ seconds.`,
          figure,
          answerType: 'numeric', answer: { value: acc1 }, answerSuffix: 'm/s²',
          traps: [
            { value: vTop, why: `$${vTop}$ m/s is the velocity the particle reaches. Acceleration is the **gradient** of the graph, so divide that rise by the $${t1}$ seconds it took.` },
            { value: vTop * t1 / 2, why: 'That is the area under the first segment, which gives a distance in metres — the gradient is what gives acceleration.' }
          ],
          hints: ['On a velocity–time graph, acceleration is the gradient of the line.',
            `Read the velocity the particle reaches at $t = ${t1}$ off the vertical axis.`,
            `Gradient $= \\dfrac{${vTop} - 0}{${t1} - 0}$.`],
          steps: [
            { h: 'Read the rise', d: `The velocity climbs from $0$ to $${vTop}$ m/s` },
            { h: 'Read the run', d: `It takes $${t1}$ s` },
            { h: 'Gradient', d: `$a = \\dfrac{${vTop}}{${t1}} = ${acc1}$ m/s²` }
          ]
        };
      }
      if (ask === 1) {
        return {
          prompt: `${lead}\n\nFind the particle's **acceleration** between $t = ${t2}$ and $t = ${t3}$.`,
          figure,
          answerType: 'numeric', answer: { value: -vTop / d3 }, answerSuffix: 'm/s²',
          traps: [
            { value: vTop / d3, why: 'The velocity is *falling* over this interval, so the gradient — and the acceleration — is negative.' },
            { value: 0, why: `The graph is only flat between $t = ${t1}$ and $t = ${t2}$. From $t = ${t2}$ onwards it slopes down towards the axis.` }
          ],
          hints: ['Acceleration is again the gradient, and a falling line has a negative gradient.',
            `Over this interval the velocity drops from $${vTop}$ m/s to $0$.`,
            `Gradient $= \\dfrac{0 - ${vTop}}{${t3} - ${t2}}$.`],
          steps: [
            { h: 'Change in velocity', d: `$0 - ${vTop} = -${vTop}$ m/s` },
            { h: 'Time taken', d: `$${t3} - ${t2} = ${d3}$ s` },
            { h: 'Gradient', d: `$a = \\dfrac{-${vTop}}{${d3}} = ${-vTop / d3}$ m/s²` }
          ]
        };
      }
      if (ask === 2) {
        return {
          prompt: `${lead}\n\nHow far does the particle travel in the first $${t3}$ seconds?`,
          figure,
          answerType: 'numeric', answer: { value: areaUp }, answerSuffix: 'm',
          traps: [
            { value: vTop * t3, why: 'That treats the whole $' + t3 + '$ seconds as though the particle were at top speed. It only reaches $' + vTop + '$ m/s at $t = ' + t1 + '$, and slows again after $t = ' + t2 + '$.' },
            { value: vTop / t1, why: 'That is the acceleration. Distance is the **area** under a velocity–time graph, not its gradient.' }
          ],
          hints: ['Distance travelled is the area under a velocity–time graph.',
            `Split it into a triangle, a rectangle and a triangle: bases $${t1}$, $${t2 - t1}$ and $${d3}$, all at height $${vTop}$ m/s.`,
            `$\\tfrac{1}{2}(${t1})(${vTop}) + (${t2 - t1})(${vTop}) + \\tfrac{1}{2}(${d3})(${vTop})$.`],
          steps: [
            { h: 'Speeding-up triangle', d: `$\\tfrac{1}{2} \\times ${t1} \\times ${vTop} = ${t1 * vTop / 2}$ m` },
            { h: 'Constant-speed rectangle', d: `$${t2 - t1} \\times ${vTop} = ${(t2 - t1) * vTop}$ m` },
            { h: 'Slowing-down triangle', d: `$\\tfrac{1}{2} \\times ${d3} \\times ${vTop} = ${d3 * vTop / 2}$ m` },
            { h: 'Total distance', d: `$${t1 * vTop / 2} + ${(t2 - t1) * vTop} + ${d3 * vTop / 2} = ${areaUp}$ m` }
          ]
        };
      }
      const areaDown = d4 * Math.abs(vEnd) / 2;
      return {
        prompt: `${lead}\n\nFind the particle's **displacement** over the whole $${t4}$ seconds.`,
        figure,
        answerType: 'numeric', answer: { value: areaUp - areaDown }, answerSuffix: 'm',
        traps: [
          { value: areaUp + areaDown, why: `That is the total **distance** travelled. Displacement counts the area below the axis as negative, because the particle is heading back the way it came.` },
          { value: areaUp, why: `The final $${d4}$ seconds still move the particle — backwards. That area has to be subtracted, not ignored.` }
        ],
        hints: ['Displacement is the *signed* area: above the axis counts as positive, below as negative.',
          `The area above the axis, up to $t = ${t3}$, is $${areaUp}$ m.`,
          `Below the axis you have a triangle of base $${d4}$ and height $${Math.abs(vEnd)}$.`],
        steps: [
          { h: 'Area above the axis', d: `$${areaUp}$ m (forwards)` },
          { h: 'Area below the axis', d: `$\\tfrac{1}{2} \\times ${d4} \\times ${Math.abs(vEnd)} = ${areaDown}$ m (backwards)` },
          { h: 'Signed total', d: `$${areaUp} - ${areaDown} = ${areaUp - areaDown}$ m` }
        ]
      };
    }
    if (diff === 3) {
      const p = ri(rng, 1, 12);
      let q = ri(rng, 1, 12);
      while (q === p) q = ri(rng, 1, 12);
      // v(t) = 3(t-p)(t-q) = 3t^2 -3(p+q)t + 3pq
      const B = -3 * (p + q), C = 3 * p * q;
      return {
        prompt: `A particle's velocity is $v(t) = ${poly([3, B, C], 't')}$ m/s. At what times is the particle **at rest**?`,
        answerType: 'set', answer: { values: [p, q].sort((x, y) => x - y) }, answerSuffix: 's',
        inputHint: 'e.g. t = 1, 3',
        traps: [{ value: (p + q) / 2, why: 'At rest means $v = 0$ — solve the quadratic; there are two such times.' }],
        hints: ['“At rest” means velocity = 0.', `Divide by 3: $t^2 ${sgn(-(p + q))}t ${sgn(p * q)} = 0$.`, `Factorise: $(t - ${p})(t - ${q}) = 0$.`],
        steps: [
          { h: 'Set v = 0', d: `$${poly([3, B, C], 't')} = 0$` },
          { h: 'Divide by 3 and factorise', d: `$(t ${sgn(-p)})(t ${sgn(-q)}) = 0$` },
          { h: 'Times', d: `$t = ${Math.min(p, q)}$ s and $t = ${Math.max(p, q)}$ s` }
        ]
      };
    }
    const a = ri(rng, 1, 12) * 2, x0 = ri(rng, 1, 20), T = ri(rng, 2, 6);
    // v(t) = a t  → x = a t²/2 + x0
    const xT = a * T * T / 2 + x0;
    return {
      prompt: `A particle starts at $x(0) = ${x0}$ m and moves with velocity $v(t) = ${a}t$ m/s. Find its displacement $x$ at $t = ${T}$ seconds.`,
      answerType: 'numeric', answer: { value: xT }, answerSuffix: 'm',
      traps: [
        { value: a * T * T / 2, why: `Integration gives $x = ${a / 2}t^2 + C$ — use $x(0) = ${x0}$ to find $C$, then add it.` },
        { value: a * T + x0, why: 'Displacement is the *integral* of velocity: $x = \\int v\\,dt = ' + a / 2 + 't^2 + C$, not $v \\cdot 1 + x_0$.' }
      ].filter(t => t.value !== xT),
      hints: ['Integrate velocity to get displacement.', `$x(t) = \\int ${a}t\\,dt = ${a / 2}t^2 + C$.`, `$x(0) = ${x0}$ gives $C = ${x0}$; now substitute $t = ${T}$.`],
      steps: [
        { h: 'Integrate', d: `$x(t) = \\displaystyle\\int ${a}t\\,dt = ${a / 2}t^2 + C$` },
        { h: 'Initial condition', d: `$x(0) = ${x0} \\Rightarrow C = ${x0}$` },
        { h: 'Substitute t = ' + T, d: `$x(${T}) = ${a / 2}(${T * T}) + ${x0} = ${xT}$ m` }
      ]
    };
  }
};
