// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Extension 1 & Extension 2 generators (ME / MEX)
// ─────────────────────────────────────────────────────────────────────────────
import { ri, rc, rs, nz, gcd, Frac, mcq, poly, sgn, r1, r2, r3, rad } from '../qhelpers.js';

const factorial = n => n <= 1 ? 1 : n * factorial(n - 1);
const nCr = (n, r) => Math.round(factorial(n) / (factorial(r) * factorial(n - r)));
const nPr = (n, r) => Math.round(factorial(n) / factorial(n - r));

// ── Shared parameter pools ───────────────────────────────────────────────────

/** Bracket a negative value so a generated expression string stays parseable. */
const pn = v => v < 0 ? `(${v})` : String(v);

/** Right-triangle side sets (opposite, adjacent, hypotenuse) for exact ratios. */
const TRIPLES = [[3, 4, 5], [5, 12, 13], [8, 15, 17], [7, 24, 25], [20, 21, 29], [9, 40, 41],
[12, 35, 37], [28, 45, 53], [11, 60, 61], [33, 56, 65], [16, 63, 65], [48, 55, 73]];

/** Exact special-angle values as [typed, LaTeX], keyed by function then degrees. */
const SPECIAL_TRIG = {
  sin: {
    0: ['0', '0'], 30: ['1/2', '\\frac{1}{2}'], 45: ['sqrt(2)/2', '\\frac{\\sqrt{2}}{2}'],
    60: ['sqrt(3)/2', '\\frac{\\sqrt{3}}{2}'], 90: ['1', '1'], 120: ['sqrt(3)/2', '\\frac{\\sqrt{3}}{2}'],
    135: ['sqrt(2)/2', '\\frac{\\sqrt{2}}{2}'], 150: ['1/2', '\\frac{1}{2}'], 180: ['0', '0']
  },
  cos: {
    0: ['1', '1'], 30: ['sqrt(3)/2', '\\frac{\\sqrt{3}}{2}'], 45: ['sqrt(2)/2', '\\frac{\\sqrt{2}}{2}'],
    60: ['1/2', '\\frac{1}{2}'], 90: ['0', '0'], 120: ['-1/2', '-\\frac{1}{2}'],
    135: ['-sqrt(2)/2', '-\\frac{\\sqrt{2}}{2}'], 150: ['-sqrt(3)/2', '-\\frac{\\sqrt{3}}{2}'], 180: ['-1', '-1']
  }
};

/** A rational multiple of π, reduced, as typed answer + LaTeX + numeric value. */
function piFrac(n, d) {
  const f = new Frac(n, d);
  const p = f.n, q = f.d;
  if (p === 0) return { typed: '0', tex: '0', val: 0 };
  const head = p === 1 ? 'pi' : p === -1 ? '-pi' : `${p}pi`;
  const texHead = p === 1 ? '\\pi' : p === -1 ? '-\\pi' : `${p}\\pi`;
  return {
    typed: q === 1 ? head : `${head}/${q}`,
    tex: q === 1 ? texHead : `\\frac{${texHead}}{${q}}`,
    val: p * Math.PI / q
  };
}

// ── Trigonometric equations ──────────────────────────────────────────────────

const R2 = Math.SQRT1_2, R3 = Math.sqrt(3), R3H = Math.sqrt(3) / 2, R3T = Math.sqrt(3) / 3;

/** Exact right-hand sides for a simple trig equation, with a printable form. */
const RATIO_POOL = {
  sin: [
    { eq: '2\\sin\\theta = 1', v: 0.5, tex: '\\tfrac{1}{2}' },
    { eq: '2\\sin\\theta + 1 = 0', v: -0.5, tex: '-\\tfrac{1}{2}' },
    { eq: '\\sqrt{2}\\sin\\theta = 1', v: R2, tex: '\\tfrac{1}{\\sqrt{2}}' },
    { eq: '\\sqrt{2}\\sin\\theta + 1 = 0', v: -R2, tex: '-\\tfrac{1}{\\sqrt{2}}' },
    { eq: '2\\sin\\theta = \\sqrt{3}', v: R3H, tex: '\\tfrac{\\sqrt{3}}{2}' },
    { eq: '2\\sin\\theta + \\sqrt{3} = 0', v: -R3H, tex: '-\\tfrac{\\sqrt{3}}{2}' },
    { eq: '\\sin\\theta = 1', v: 1, tex: '1' },
    { eq: '\\sin\\theta + 1 = 0', v: -1, tex: '-1' },
    { eq: '3\\sin\\theta = 0', v: 0, tex: '0' }
  ],
  cos: [
    { eq: '2\\cos\\theta = 1', v: 0.5, tex: '\\tfrac{1}{2}' },
    { eq: '2\\cos\\theta + 1 = 0', v: -0.5, tex: '-\\tfrac{1}{2}' },
    { eq: '\\sqrt{2}\\cos\\theta = 1', v: R2, tex: '\\tfrac{1}{\\sqrt{2}}' },
    { eq: '\\sqrt{2}\\cos\\theta + 1 = 0', v: -R2, tex: '-\\tfrac{1}{\\sqrt{2}}' },
    { eq: '2\\cos\\theta = \\sqrt{3}', v: R3H, tex: '\\tfrac{\\sqrt{3}}{2}' },
    { eq: '2\\cos\\theta + \\sqrt{3} = 0', v: -R3H, tex: '-\\tfrac{\\sqrt{3}}{2}' },
    { eq: '\\cos\\theta = 1', v: 1, tex: '1' },
    { eq: '\\cos\\theta + 1 = 0', v: -1, tex: '-1' },
    { eq: '3\\cos\\theta = 0', v: 0, tex: '0' }
  ],
  tan: [
    { eq: '\\tan\\theta = 1', v: 1, tex: '1' },
    { eq: '\\tan\\theta + 1 = 0', v: -1, tex: '-1' },
    { eq: '\\tan\\theta = \\sqrt{3}', v: R3, tex: '\\sqrt{3}' },
    { eq: '\\tan\\theta + \\sqrt{3} = 0', v: -R3, tex: '-\\sqrt{3}' },
    { eq: '\\sqrt{3}\\tan\\theta = 1', v: R3T, tex: '\\tfrac{1}{\\sqrt{3}}' },
    { eq: '\\sqrt{3}\\tan\\theta + 1 = 0', v: -R3T, tex: '-\\tfrac{1}{\\sqrt{3}}' },
    { eq: '4\\tan\\theta = 0', v: 0, tex: '0' }
  ]
};

const TRIG_DOMAINS = [[0, 360], [-180, 180], [0, 720], [-360, 0]];

/** Every solution of sin/cos/tan θ = v in [lo, hi], scanned in half-degrees. */
function trigSolutionsDeg(fn, v, lo, hi) {
  const out = [];
  for (let half = Math.round(lo * 2); half <= Math.round(hi * 2); half++) {
    const d = half / 2;
    if (fn === 'tan' && Math.abs(((d % 180) + 180) % 180 - 90) < 1e-9) continue;
    const y = fn === 'sin' ? Math.sin(rad(d)) : fn === 'cos' ? Math.cos(rad(d)) : Math.tan(rad(d));
    if (Math.abs(y - v) < 1e-9) out.push(d);
  }
  return out;
}

const domainTex = ([lo, hi]) => `${lo}° \\le \\theta \\le ${hi}°`;

/**
 * A summation identity to prove by induction. Carries the claim, a way to
 * evaluate either side at n, and the inductive-step algebra as a chain of
 * equivalent expressions in k (start → mid → end).
 */
function inductionFamily(rng) {
  const kind = ri(rng, 1, 7);
  if (kind === 1) return {
    claimTex: '1 + 2 + \\cdots + n = \\dfrac{n(n+1)}{2}', maxCheck: 6,
    valueAt: n => n * (n + 1) / 2,
    lhsAt: n => Array.from({ length: n }, (_, i) => i + 1).join(' + '),
    rhsAt: n => `\\dfrac{${n}(${n + 1})}{2}`,
    startTex: '\\dfrac{k(k+1)}{2} + (k+1)', midTex: '(k+1)\\left(\\dfrac{k}{2} + 1\\right)', endTex: '\\dfrac{(k+1)(k+2)}{2}',
    stepStart: 'k(k+1)/2 + (k+1)', stepMid: '(k+1)(k/2 + 1)', stepEnd: '(k+1)(k+2)/2',
    inputHint: '(k+1)(k+2)/2',
    hint1: 'Factor out the common $(k+1)$.', hint2: 'Inside the bracket, $\\frac{k}{2} + 1 = \\frac{k+2}{2}$.'
  };
  if (kind === 2) return {
    claimTex: '1 + 3 + 5 + \\cdots + (2n - 1) = n^2', maxCheck: 6,
    valueAt: n => n * n,
    lhsAt: n => Array.from({ length: n }, (_, i) => 2 * i + 1).join(' + '),
    rhsAt: n => `${n}^2`,
    startTex: 'k^2 + (2k + 1)', midTex: 'k^2 + 2k + 1', endTex: '(k+1)^2',
    stepStart: 'k^2 + (2k + 1)', stepMid: 'k^2 + 2k + 1', stepEnd: '(k+1)^2',
    inputHint: '(k+1)^2',
    hint1: 'The next odd number after $2k - 1$ is $2k + 1$.', hint2: 'You are looking at a perfect square trinomial.'
  };
  if (kind === 3) return {
    claimTex: '1^2 + 2^2 + \\cdots + n^2 = \\dfrac{n(n+1)(2n+1)}{6}', maxCheck: 5,
    valueAt: n => n * (n + 1) * (2 * n + 1) / 6,
    lhsAt: n => Array.from({ length: n }, (_, i) => `${i + 1}^2`).join(' + '),
    rhsAt: n => `\\dfrac{${n}(${n + 1})(${2 * n + 1})}{6}`,
    startTex: '\\dfrac{k(k+1)(2k+1)}{6} + (k+1)^2', midTex: '\\dfrac{(k+1)\\left[k(2k+1) + 6(k+1)\\right]}{6}', endTex: '\\dfrac{(k+1)(k+2)(2k+3)}{6}',
    stepStart: 'k(k+1)(2k+1)/6 + (k+1)^2', stepMid: '(k+1)(k(2k+1) + 6(k+1))/6', stepEnd: '(k+1)(k+2)(2k+3)/6',
    inputHint: '(k+1)(k+2)(2k+3)/6',
    hint1: 'Factor out $\\frac{k+1}{6}$.', hint2: 'The bracket becomes $2k^2 + 7k + 6 = (k+2)(2k+3)$.'
  };
  if (kind === 4) return {
    claimTex: '1^3 + 2^3 + \\cdots + n^3 = \\dfrac{n^2(n+1)^2}{4}', maxCheck: 5,
    valueAt: n => n * n * (n + 1) * (n + 1) / 4,
    lhsAt: n => Array.from({ length: n }, (_, i) => `${i + 1}^3`).join(' + '),
    rhsAt: n => `\\dfrac{${n}^2(${n + 1})^2}{4}`,
    startTex: '\\dfrac{k^2(k+1)^2}{4} + (k+1)^3', midTex: '\\dfrac{(k+1)^2\\left[k^2 + 4(k+1)\\right]}{4}', endTex: '\\dfrac{(k+1)^2(k+2)^2}{4}',
    stepStart: 'k^2(k+1)^2/4 + (k+1)^3', stepMid: '(k+1)^2(k^2 + 4(k+1))/4', stepEnd: '(k+1)^2(k+2)^2/4',
    inputHint: '(k+1)^2(k+2)^2/4',
    hint1: 'Factor out $\\frac{(k+1)^2}{4}$.', hint2: 'The bracket $k^2 + 4k + 4$ is $(k+2)^2$.'
  };
  if (kind === 5) return {
    claimTex: '1\\cdot 2 + 2\\cdot 3 + \\cdots + n(n+1) = \\dfrac{n(n+1)(n+2)}{3}', maxCheck: 5,
    valueAt: n => n * (n + 1) * (n + 2) / 3,
    lhsAt: n => Array.from({ length: n }, (_, i) => `${i + 1}\\cdot ${i + 2}`).join(' + '),
    rhsAt: n => `\\dfrac{${n}(${n + 1})(${n + 2})}{3}`,
    startTex: '\\dfrac{k(k+1)(k+2)}{3} + (k+1)(k+2)', midTex: '(k+1)(k+2)\\left(\\dfrac{k}{3} + 1\\right)', endTex: '\\dfrac{(k+1)(k+2)(k+3)}{3}',
    stepStart: 'k(k+1)(k+2)/3 + (k+1)(k+2)', stepMid: '(k+1)(k+2)(k/3 + 1)', stepEnd: '(k+1)(k+2)(k+3)/3',
    inputHint: '(k+1)(k+2)(k+3)/3',
    hint1: 'Factor out the common $(k+1)(k+2)$.', hint2: '$\\frac{k}{3} + 1 = \\frac{k+3}{3}$.'
  };
  if (kind === 6) {
    const a = ri(rng, 1, 9), d = ri(rng, 2, 8);
    return {
      claimTex: `${a} + ${a + d} + \\cdots + \\left(${a} + (n-1)\\cdot ${d}\\right) = \\dfrac{n\\left(${2 * a} + ${d}(n-1)\\right)}{2}`, maxCheck: 5,
      valueAt: n => n * (2 * a + d * (n - 1)) / 2,
      lhsAt: n => Array.from({ length: n }, (_, i) => a + i * d).join(' + '),
      rhsAt: n => `\\dfrac{${n}\\left(${2 * a} + ${d}(${n - 1})\\right)}{2}`,
      startTex: `\\dfrac{k\\left(${2 * a} + ${d}(k-1)\\right)}{2} + (${a} + ${d}k)`,
      midTex: `\\dfrac{${d}k^2 + ${2 * a + d}k + ${2 * a}}{2}`,
      endTex: `\\dfrac{(k+1)\\left(${2 * a} + ${d}k\\right)}{2}`,
      stepStart: `k*(${2 * a} + ${d}*(k-1))/2 + (${a} + ${d}*k)`,
      stepMid: `(${d}*k^2 + ${2 * a + d}*k + ${2 * a})/2`,
      stepEnd: `(k+1)*(${2 * a} + ${d}*k)/2`,
      inputHint: `(k+1)(${2 * a} + ${d}k)/2`,
      hint1: 'Expand everything over the common denominator 2.', hint2: `The numerator $${d}k^2 + ${2 * a + d}k + ${2 * a}$ factors as $(k+1)(${2 * a} + ${d}k)$.`
    };
  }
  const r = ri(rng, 2, 6);
  return {
    claimTex: `${r} + ${r}^2 + \\cdots + ${r}^n = \\dfrac{${r}\\left(${r}^n - 1\\right)}{${r - 1}}`, maxCheck: 4,
    valueAt: n => Math.round(r * (r ** n - 1) / (r - 1)),
    lhsAt: n => Array.from({ length: n }, (_, i) => `${r}^{${i + 1}}`).join(' + '),
    rhsAt: n => `\\dfrac{${r}\\left(${r}^{${n}} - 1\\right)}{${r - 1}}`,
    startTex: `\\dfrac{${r}\\left(${r}^k - 1\\right)}{${r - 1}} + ${r}^{k+1}`,
    midTex: `\\dfrac{${r}^{k+2} - ${r}}{${r - 1}}`,
    endTex: `\\dfrac{${r}\\left(${r}^{k+1} - 1\\right)}{${r - 1}}`,
    stepStart: `${r}*(${r}^k - 1)/${r - 1} + ${r}^(k+1)`,
    stepMid: `(${r}^(k+2) - ${r})/${r - 1}`,
    stepEnd: `${r}*(${r}^(k+1) - 1)/${r - 1}`,
    inputHint: `${r}(${r}^(k+1) - 1)/${r - 1}`,
    hint1: `Put both terms over the denominator $${r - 1}$.`, hint2: `$${r}^{k+1} - ${r} + (${r - 1})${r}^{k+1} = ${r}^{k+2} - ${r}$.`
  };
}

/** Principal value of asin/acos/atan applied to an angle of t twelfths of π. */
function principalTwelfths(fn, t) {
  if (fn === 'tan') {
    let v = ((t % 12) + 12) % 12;
    if (v === 6) return null;
    return v > 6 ? v - 12 : v;
  }
  let v = ((t % 24) + 24) % 24;
  if (fn === 'cos') return v > 12 ? 24 - v : v;
  if (v > 18) return v - 24;
  return v > 6 ? 12 - v : v;
}

export const streamsExt = {

  // ── ME-F2 · Polynomials ──────────────────────────────────────────────────
  'me11-poly': (rng, diff) => {
    if (diff === 1) {
      const b = nz(rng, -4, 4), c = nz(rng, -6, 6), d = nz(rng, -8, 8), a = nz(rng, -3, 3);
      const rem = a ** 3 + b * a * a + c * a + d;
      return {
        prompt: `Find the remainder when $P(x) = ${poly([1, b, c, d])}$ is divided by $(x ${sgn(-a)})$.`,
        answerType: 'numeric', answer: { value: rem },
        traps: [{ value: (-a) ** 3 + b * a * a - c * a + d, why: `Evaluate at the root of the divisor: $x = ${a}$.` }].filter(t => t.value !== rem),
        hints: ['Remainder theorem: remainder = P(root of divisor).', `Evaluate $P(${a})$.`, `$(${a})^3 = ${a ** 3}$.`],
        steps: [
          { h: 'Remainder theorem', d: `remainder $= P(${a})$` },
          { h: 'Evaluate', d: `$${a ** 3} ${sgn(b * a * a)} ${sgn(c * a)} ${sgn(d)} = ${rem}$` }
        ]
      };
    }
    if (diff === 2) {
      const root = nz(rng, -3, 3), b = nz(rng, -4, 4), c = nz(rng, -6, 6);
      const k = -(root ** 3 + b * root * root + c * root);
      return {
        prompt: `Find $k$ such that $(x ${sgn(-root)})$ is a factor of $x^3 ${sgn(b)}x^2 ${sgn(c)}x + k$.`,
        answerType: 'numeric', answer: { value: k }, answerPrefix: 'k =',
        traps: [{ value: -k, why: `Set $P(${root}) = 0$ and watch the sign when isolating k.` }].filter(t => t.value !== k),
        hints: ['Factor theorem: P(root) = 0.', `$P(${root}) = 0$.`, `Solve for k.`],
        steps: [
          { h: 'Factor theorem', d: `$P(${root}) = ${root ** 3 + b * root * root + c * root} + k = 0$` },
          { h: 'Solve', d: `$k = ${k}$` }
        ]
      };
    }
    if (diff === 3) {
      // monic cubic with roots p, q, r: ask sum of roots or sum of pairwise products
      const p = nz(rng, -4, 4), q = nz(rng, -4, 4), rr = nz(rng, -4, 4);
      const B = -(p + q + rr), C = p * q + p * rr + q * rr, D = -p * q * rr;
      const which = rc(rng, ['sum', 'product']);
      const val = which === 'sum' ? p + q + rr : p * q * rr;
      return {
        prompt: `For the cubic $x^3 ${sgn(B)}x^2 ${sgn(C)}x ${sgn(D)} = 0$ with roots $\\alpha, \\beta, \\gamma$, find $${which === 'sum' ? '\\alpha + \\beta + \\gamma' : '\\alpha\\beta\\gamma'}$ without solving.`,
        answerType: 'numeric', answer: { value: val },
        traps: [
          which === 'sum' ? { value: B, why: 'Sum of roots $= -\\frac{b}{a}$ — flip the sign of the $x^2$ coefficient.' } : { value: D, why: 'Product of roots of a cubic $= -\\frac{d}{a}$ — flip the constant’s sign.' }
        ].filter(t => t.value !== val),
        hints: ['Use the root–coefficient relationships for cubics.', which === 'sum' ? '$\\alpha+\\beta+\\gamma = -b/a$.' : '$\\alpha\\beta\\gamma = -d/a$.', `Coefficients: $b = ${B}$, $d = ${D}$.`],
        steps: [
          { h: 'Vieta for cubics', d: `$\\alpha+\\beta+\\gamma = -\\dfrac{b}{a}, \\qquad \\alpha\\beta\\gamma = -\\dfrac{d}{a}$` },
          { h: 'Apply', d: which === 'sum' ? `$-(${B}) = ${val}$` : `$-(${D}) = ${val}$` },
          { h: 'Check', d: `The roots are $${p}, ${q}, ${rr}$ ✓` }
        ]
      };
    }
    const root = nz(rng, -3, 3), b2 = nz(rng, -3, 3), c2 = nz(rng, -5, 5);
    // P(x) = (x - root)(x² + b2 x + c2)
    const B = b2 - root, C = c2 - root * b2, D = -root * c2;
    return {
      prompt: `Given that $(x ${sgn(-root)})$ is a factor of $P(x) = ${poly([1, B, C, D])}$, find the **quotient** when $P(x)$ is divided by it.`,
      answerType: 'expression', answer: { expr: `x^2 + ${b2}x + ${c2}` },
      inputHint: 'e.g. x^2 + 3x - 2',
      traps: [{ expr: `x^2 + ${B}x + ${C}`, why: 'Divide properly (or equate coefficients) — the quotient’s coefficients change when the factor is removed.' }],
      hints: ['Write $P(x) = (x ' + sgn(-root) + ')(x^2 + bx + c)$ and equate coefficients.', `Matching $x^2$: $b ${sgn(-root)}$ gives $b = ${b2}$.`, `Matching constants: $${-root} \\times c = ${D}$, so $c = ${c2}$.`],
      steps: [
        { h: 'Set up the product', d: `$P(x) = (x ${sgn(-root)})(x^2 + bx + c)$` },
        { h: 'Equate coefficients', d: `$b = ${b2}$, $\\ c = ${c2}$` },
        { h: 'Quotient', d: `$x^2 ${sgn(b2)}x ${sgn(c2)}$` }
      ]
    };
  },

  // ── ME-F1 · Inverse functions ────────────────────────────────────────────
  'me11-functions': (rng, diff) => {
    if (diff === 1) {
      const a = nz(rng, 2, 5), b = nz(rng, -8, 8);
      return {
        prompt: `Find the inverse function of $f(x) = ${a}x ${sgn(b)}$.`,
        answerType: 'expression', answer: { expr: `(x - ${b})/${a}` },
        inputHint: 'e.g. (x - 3)/2',
        answerPrefix: 'f⁻¹(x) =',
        traps: [{ expr: `1/(${a}x + ${b})`, why: 'The inverse function reverses the mapping — it is not the reciprocal $\\frac{1}{f(x)}$.' }],
        hints: ['Swap x and y, then solve for y.', `$x = ${a}y ${sgn(b)}$.`, `${b >= 0 ? 'Subtract' : 'Add'} ${Math.abs(b)}, then divide by ${a}.`],
        steps: [
          { h: 'Swap x and y', d: `$x = ${a}y ${sgn(b)}$` },
          { h: 'Solve for y', d: `$y = \\dfrac{x ${sgn(-b)}}{${a}}$` },
          { h: 'Inverse', d: `$f^{-1}(x) = \\dfrac{x ${sgn(-b)}}{${a}}$` }
        ]
      };
    }
    if (diff === 2) {
      const a = nz(rng, 2, 4), b = nz(rng, -6, 6), target = nz(rng, -5, 8);
      const x = a * target + b;
      return {
        prompt: `If $f(x) = ${a}x ${sgn(b)}$, evaluate $f^{-1}(${x})$.`,
        answerType: 'numeric', answer: { value: target },
        traps: [{ value: a * x + b, why: `That's $f(${x})$ — the inverse asks which input gives ${x}.` }],
        hints: [`$f^{-1}(${x})$ asks: what input makes $f$ output ${x}?`, `Solve $${a}x ${sgn(b)} = ${x}$.`, `$x = ${target}$.`],
        steps: [
          { h: 'Set up', d: `$${a}t ${sgn(b)} = ${x}$` },
          { h: 'Solve', d: `$t = ${target}$, so $f^{-1}(${x}) = ${target}$` }
        ]
      };
    }
    if (diff === 3) {
      const k = nz(rng, -6, 6), x0 = nz(rng, -3, 3);
      const y0 = x0 ** 3 + k;
      return {
        prompt: `For $f(x) = x^3 ${sgn(k)}$, evaluate $f^{-1}(${y0})$.`,
        answerType: 'numeric', answer: { value: x0 },
        traps: [{ value: y0 ** 3 + k, why: `Undo f in reverse order: subtract ${k}, then take the cube root.` }].filter(t => t.value !== x0),
        hints: ['Undo the operations in reverse.', `${k >= 0 ? 'Subtract' : 'Add'} ${Math.abs(k)} first: ${y0 - k}.`, `Cube root: $\\sqrt[3]{${y0 - k}} = ${x0}$.`],
        steps: [
          { h: 'Reverse the operations', d: `$f^{-1}(x) = \\sqrt[3]{x ${sgn(-k)}}$` },
          { h: 'Evaluate', d: `$\\sqrt[3]{${y0 - k}} = ${x0}$` }
        ]
      };
    }
    const shape = ri(rng, 1, 3);
    if (shape === 1) {
      const a = nz(rng, -5, 5), c = nz(rng, -6, 6);
      let b = nz(rng, -9, 9);
      while (b === a * c) b = nz(rng, -9, 9);          // b = ac makes f constant
      const numTex = a === 1 ? `x ${sgn(b)}` : a === -1 ? `-x ${sgn(b)}` : `${a}x ${sgn(b)}`;
      return {
        prompt: `Find the inverse function of $f(x) = \\dfrac{${numTex}}{x ${sgn(c)}}$.`,
        answerType: 'expression', answer: { expr: `(${pn(b)} - ${pn(c)}*x)/(x - ${pn(a)})`, anyOf: [`(${pn(c)}*x - ${pn(b)})/(${pn(a)} - x)`] },
        inputHint: 'e.g. (5 - 2x)/(x - 3)',
        answerPrefix: 'f⁻¹(x) =',
        traps: [{ expr: `(x ${sgn(c)})/(${pn(a)}*x + ${pn(b)})`, why: 'The inverse is not the reciprocal — swap $x$ and $y$, then make $y$ the subject.' }],
        hints: ['Write $y = f(x)$, swap $x$ and $y$, then solve for $y$.', `$x(y ${sgn(c)}) = ${a === 1 ? 'y' : a === -1 ? '-y' : `${a}y`} ${sgn(b)}$ — gather the $y$ terms on one side.`, `$y(x - ${a}) = ${b} - ${c}x$.`],
        steps: [
          { h: 'Swap x and y', d: `$x = \\dfrac{${a === 1 ? 'y' : a === -1 ? '-y' : `${a}y`} ${sgn(b)}}{y ${sgn(c)}}$` },
          { h: 'Clear the fraction', d: `$xy ${sgn(c)}x = ${a === 1 ? 'y' : a === -1 ? '-y' : `${a}y`} ${sgn(b)}$` },
          { h: 'Gather the y terms', d: `$y(x - ${a}) = ${b} - ${c}x$` },
          { h: 'Inverse', d: `$f^{-1}(x) = \\dfrac{${b} - ${c}x}{x - ${a}}$, $x \\ne ${a}$` }
        ]
      };
    }
    if (shape === 2) {
      const a = ri(rng, 2, 5), h = nz(rng, -4, 4), k = nz(rng, -6, 6);
      return {
        prompt: `The function $f(x) = ${a}\\sqrt{x ${sgn(-h)}} ${sgn(k)}$ has domain $x \\ge ${h}$. Find $f^{-1}(x)$.`,
        answerType: 'expression', answer: { expr: `((x - ${pn(k)})/${a})^2 + ${pn(h)}`, anyOf: [`(x - ${pn(k)})^2/${a * a} + ${pn(h)}`] },
        inputHint: 'e.g. ((x - 1)/2)^2 + 3',
        answerPrefix: 'f⁻¹(x) =',
        traps: [{ expr: `sqrt((x - ${pn(k)})/${a}) + ${pn(h)}`, why: 'Undo a square root by squaring — the inverse of $\\sqrt{\\ }$ is not another $\\sqrt{\\ }$.' }],
        hints: ['Swap $x$ and $y$, then peel the operations off in reverse.', `${k >= 0 ? 'Subtract' : 'Add'} ${Math.abs(k)}, then divide by ${a}.`, 'Square last, then undo the horizontal shift.'],
        steps: [
          { h: 'Swap x and y', d: `$x = ${a}\\sqrt{y ${sgn(-h)}} ${sgn(k)}$` },
          { h: 'Isolate the surd', d: `$\\sqrt{y ${sgn(-h)}} = \\dfrac{x ${sgn(-k)}}{${a}}$` },
          { h: 'Square and rearrange', d: `$f^{-1}(x) = \\left(\\dfrac{x ${sgn(-k)}}{${a}}\\right)^2 ${sgn(h)}$, $x \\ge ${k}$` }
        ]
      };
    }
    const a = nz(rng, -6, 6), h = nz(rng, -5, 5), k = nz(rng, -5, 5);
    return {
      prompt: `Find the inverse function of $f(x) = \\dfrac{${a}}{x ${sgn(-h)}} ${sgn(k)}$, $x \\ne ${h}$.`,
      answerType: 'expression', answer: { expr: `${pn(a)}/(x - ${pn(k)}) + ${pn(h)}` },
      inputHint: 'e.g. 4/(x - 1) + 2',
      answerPrefix: 'f⁻¹(x) =',
      traps: [{ expr: `(x - ${pn(k)})/${pn(a)} + ${pn(h)}`, why: 'A reciprocal is undone by another reciprocal, not by dividing.' }],
      hints: ['Swap $x$ and $y$, then unwrap: subtract the constant, take reciprocals, shift back.', `$x ${sgn(-k)} = \\dfrac{${a}}{y ${sgn(-h)}}$.`, `$y ${sgn(-h)} = \\dfrac{${a}}{x ${sgn(-k)}}$.`],
      steps: [
        { h: 'Swap x and y', d: `$x = \\dfrac{${a}}{y ${sgn(-h)}} ${sgn(k)}$` },
        { h: 'Isolate the fraction', d: `$x ${sgn(-k)} = \\dfrac{${a}}{y ${sgn(-h)}}$` },
        { h: 'Take reciprocals', d: `$y ${sgn(-h)} = \\dfrac{${a}}{x ${sgn(-k)}}$` },
        { h: 'Inverse', d: `$f^{-1}(x) = \\dfrac{${a}}{x ${sgn(-k)}} ${sgn(h)}$, $x \\ne ${k}$` }
      ]
    };
  },

  // ── ME-T2 · Compound angles ──────────────────────────────────────────────
  'me11-trigid': (rng, diff) => {
    if (diff === 1) {
      const fn = rc(rng, ['sin', 'cos']);
      const sum = rc(rng, [true, false]);
      const target = rc(rng, sum ? [30, 45, 60, 90, 120, 135, 150] : [30, 45, 60, 90]);
      const parts = [7, 11, 13, 14, 17, 19, 23, 26, 29, 31, 34, 37, 41, 43, 47, 53].filter(p => sum ? p < target && target - p !== p : true);
      const B = rc(rng, parts);
      const A = sum ? target - B : target + B;
      const inner = sum ? '+' : '-';
      const lhs = fn === 'sin'
        ? `\\sin ${A}°\\cos ${B}° ${inner} \\cos ${A}°\\sin ${B}°`
        : `\\cos ${A}°\\cos ${B}° ${sum ? '-' : '+'} \\sin ${A}°\\sin ${B}°`;
      const [typed, tex] = SPECIAL_TRIG[fn][target];
      const val = fn === 'sin' ? Math.sin(rad(target)) : Math.cos(rad(target));
      const wrongAngle = sum ? A - B : A + B;
      const wrongVal = fn === 'sin' ? Math.sin(rad(wrongAngle)) : Math.cos(rad(wrongAngle));
      return {
        prompt: `Collapse $${lhs}$ with a compound-angle formula, then state its **exact value**.`,
        answerType: 'numeric', answer: { value: val, requireExact: true, canonicalInput: typed },
        inputHint: 'e.g. sqrt(3)/2 or 1/2',
        traps: [{ value: wrongVal, why: `The middle sign tells you whether the angle is $${A}° + ${B}°$ or $${A}° - ${B}°$ — check the formula for $\\${fn}$.`, tol: 0.001 }].filter(t => Math.abs(t.value - val) > 0.002),
        hints: [`This is the expansion of $\\${fn}(A ${inner} B)$.`, `Here $A = ${A}°$ and $B = ${B}°$, so the angle is $${target}°$.`, `$\\${fn} ${target}° = ${tex}$.`],
        steps: [
          { h: 'Recognise the pattern', d: `$${lhs} = \\${fn}(${A}° ${inner} ${B}°)$` },
          { h: 'Combine the angles', d: `$= \\${fn} ${target}°$` },
          { h: 'Exact value', d: `$= ${tex}$` }
        ]
      };
    }
    if (diff === 2) {
      if (rng() < 0.35) {
        const pick = rc(rng, [
          { fn: '\\sin', ang: 75, parts: '45° + 30°', typed: 'sqrt(6)/4 + sqrt(2)/4', tex: '\\frac{\\sqrt{6} + \\sqrt{2}}{4}', val: (Math.sqrt(6) + Math.sqrt(2)) / 4 },
          { fn: '\\cos', ang: 75, parts: '45° + 30°', typed: 'sqrt(6)/4 - sqrt(2)/4', tex: '\\frac{\\sqrt{6} - \\sqrt{2}}{4}', val: (Math.sqrt(6) - Math.sqrt(2)) / 4 },
          { fn: '\\sin', ang: 15, parts: '45° − 30°', typed: 'sqrt(6)/4 - sqrt(2)/4', tex: '\\frac{\\sqrt{6} - \\sqrt{2}}{4}', val: (Math.sqrt(6) - Math.sqrt(2)) / 4 },
          { fn: '\\cos', ang: 15, parts: '45° − 30°', typed: 'sqrt(6)/4 + sqrt(2)/4', tex: '\\frac{\\sqrt{6} + \\sqrt{2}}{4}', val: (Math.sqrt(6) + Math.sqrt(2)) / 4 },
          { fn: '\\sin', ang: 105, parts: '60° + 45°', typed: 'sqrt(6)/4 + sqrt(2)/4', tex: '\\frac{\\sqrt{6} + \\sqrt{2}}{4}', val: (Math.sqrt(6) + Math.sqrt(2)) / 4 },
          { fn: '\\cos', ang: 105, parts: '60° + 45°', typed: 'sqrt(2)/4 - sqrt(6)/4', tex: '\\frac{\\sqrt{2} - \\sqrt{6}}{4}', val: (Math.sqrt(2) - Math.sqrt(6)) / 4 },
          { fn: '\\sin', ang: 165, parts: '120° + 45°', typed: 'sqrt(6)/4 - sqrt(2)/4', tex: '\\frac{\\sqrt{6} - \\sqrt{2}}{4}', val: (Math.sqrt(6) - Math.sqrt(2)) / 4 },
          { fn: '\\cos', ang: 165, parts: '120° + 45°', typed: '-sqrt(6)/4 - sqrt(2)/4', tex: '-\\frac{\\sqrt{6} + \\sqrt{2}}{4}', val: -(Math.sqrt(6) + Math.sqrt(2)) / 4 },
          { fn: '\\tan', ang: 75, parts: '45° + 30°', typed: '2 + sqrt(3)', tex: '2 + \\sqrt{3}', val: 2 + Math.sqrt(3) },
          { fn: '\\tan', ang: 15, parts: '45° − 30°', typed: '2 - sqrt(3)', tex: '2 - \\sqrt{3}', val: 2 - Math.sqrt(3) },
          { fn: '\\tan', ang: 105, parts: '60° + 45°', typed: '-2 - sqrt(3)', tex: '-(2 + \\sqrt{3})', val: -2 - Math.sqrt(3) }
        ]);
        return {
          prompt: `Using $${pick.ang}° = ${pick.parts}$, find the **exact value** of $${pick.fn}(${pick.ang}°)$.`,
          answerType: 'numeric', answer: { value: pick.val, requireExact: true, canonicalInput: pick.typed },
          inputHint: 'e.g. sqrt(6)/4 + sqrt(2)/4',
          traps: [{ value: -pick.val, why: 'Watch the signs the compound-angle formula produces — and the quadrant of the final angle.', tol: 0.001 }],
          hints: [`Expand $${pick.fn}(${pick.parts})$ with the compound-angle formula.`, 'Substitute the exact values for 30°, 45°, 60° and 120°.', `$= ${pick.tex}$.`],
          steps: [
            { h: 'Split the angle', d: `$${pick.ang}° = ${pick.parts}$` },
            { h: 'Compound-angle expansion', d: `Expand $${pick.fn}(${pick.parts})$ and insert the exact ratios` },
            { h: 'Simplify', d: `$= ${pick.tex}$` }
          ]
        };
      }
      let i1 = ri(rng, 0, TRIPLES.length - 1), i2 = ri(rng, 0, TRIPLES.length - 1);
      while (i2 === i1) i2 = ri(rng, 0, TRIPLES.length - 1);
      const [o1, a1, h1] = TRIPLES[i1], [o2, a2, h2] = TRIPLES[i2];
      const fn = rc(rng, ['sin', 'cos']);
      const plus = rc(rng, [true, false]);
      const n = fn === 'sin'
        ? o1 * a2 + (plus ? 1 : -1) * a1 * o2
        : a1 * a2 - (plus ? 1 : -1) * o1 * o2;
      const f = new Frac(n, h1 * h2);
      const wrong = fn === 'sin' ? o1 * o2 + a1 * a2 : a1 * a2 + o1 * o2;
      return {
        prompt: `$A$ and $B$ are acute angles with $\\sin A = \\dfrac{${o1}}{${h1}}$ and $\\cos B = \\dfrac{${a2}}{${h2}}$. Find $\\${fn}(A ${plus ? '+' : '-'} B)$ as a fraction in simplest form.`,
        answerType: 'numeric', answer: { value: f.value, simplestFraction: { n: f.n, d: f.d } },
        inputHint: 'e.g. 56/65',
        traps: [{ value: wrong / (h1 * h2), why: `Use the formula exactly: $\\${fn}(A ${plus ? '+' : '-'} B) = ${fn === 'sin' ? `\\sin A\\cos B ${plus ? '+' : '-'} \\cos A\\sin B` : `\\cos A\\cos B ${plus ? '-' : '+'} \\sin A\\sin B`}$.` }].filter(t => Math.abs(t.value - f.value) > 1e-9),
        hints: [
          `Both angles are acute, so $\\cos A = \\dfrac{${a1}}{${h1}}$ and $\\sin B = \\dfrac{${o2}}{${h2}}$.`,
          `$\\${fn}(A ${plus ? '+' : '-'} B) = ${fn === 'sin' ? `\\sin A\\cos B ${plus ? '+' : '-'} \\cos A\\sin B` : `\\cos A\\cos B ${plus ? '-' : '+'} \\sin A\\sin B`}$.`,
          `Everything lands over $${h1} \\times ${h2} = ${h1 * h2}$.`
        ],
        steps: [
          { h: 'Complete both triangles', d: `$\\cos A = \\dfrac{${a1}}{${h1}}$, $\\sin B = \\dfrac{${o2}}{${h2}}$` },
          { h: 'Apply the formula', d: `$= \\dfrac{${fn === 'sin' ? `${o1}\\times${a2} ${plus ? '+' : '-'} ${a1}\\times${o2}` : `${a1}\\times${a2} ${plus ? '-' : '+'} ${o1}\\times${o2}`}}{${h1 * h2}}$` },
          { h: 'Simplify', d: `$= ${f.latex()}$` }
        ]
      };
    }
    if (diff === 3) {
      const [o, a, h] = rc(rng, TRIPLES);
      const given = rc(rng, ['sin', 'cos', 'tan']);
      const want = rc(rng, ['sin', 'cos', 'tan']);
      const givenTex = given === 'sin' ? `\\sin\\theta = \\dfrac{${o}}{${h}}` : given === 'cos' ? `\\cos\\theta = \\dfrac{${a}}{${h}}` : `\\tan\\theta = \\dfrac{${o}}{${a}}`;
      const res = want === 'sin' ? new Frac(2 * o * a, h * h)
        : want === 'cos' ? new Frac(a * a - o * o, h * h)
          : new Frac(2 * o * a, a * a - o * o);
      const naive = want === 'sin' ? 2 * o / h : want === 'cos' ? 2 * a / h : 2 * o / a;
      return {
        prompt: `Given $${givenTex}$ with $\\theta$ acute, use a double-angle formula to find $\\${want} 2\\theta$ as a fraction in simplest form.`,
        answerType: 'numeric', answer: { value: res.value, simplestFraction: { n: res.n, d: res.d } },
        inputHint: 'e.g. -7/25',
        traps: [{ value: naive, why: `Doubling the angle is not doubling the ratio — use $\\${want} 2\\theta = ${want === 'sin' ? '2\\sin\\theta\\cos\\theta' : want === 'cos' ? '\\cos^2\\theta - \\sin^2\\theta' : '\\frac{2\\tan\\theta}{1 - \\tan^2\\theta}'}$.` }].filter(t => Math.abs(t.value - res.value) > 1e-9),
        hints: [
          `The right triangle has sides ${o}, ${a}, ${h}.`,
          `$\\${want} 2\\theta = ${want === 'sin' ? '2\\sin\\theta\\cos\\theta' : want === 'cos' ? '\\cos^2\\theta - \\sin^2\\theta' : '\\dfrac{2\\tan\\theta}{1 - \\tan^2\\theta}'}$.`,
          `Substitute $\\sin\\theta = \\frac{${o}}{${h}}$, $\\cos\\theta = \\frac{${a}}{${h}}$.`
        ],
        steps: [
          { h: 'Complete the triangle', d: `opposite ${o}, adjacent ${a}, hypotenuse ${h}` },
          { h: 'Double-angle formula', d: `$\\${want} 2\\theta = ${want === 'sin' ? `2\\cdot\\frac{${o}}{${h}}\\cdot\\frac{${a}}{${h}}` : want === 'cos' ? `\\frac{${a}^2 - ${o}^2}{${h}^2}` : `\\frac{2(${o})(${a})}{${a}^2 - ${o}^2}`}$` },
          { h: 'Simplify', d: `$= ${res.latex()}$` }
        ]
      };
    }
    const [o, a, h] = rc(rng, TRIPLES);
    const quad = rc(rng, [2, 3, 4]);
    const sS = quad === 2 ? 1 : -1;
    const sC = quad === 4 ? 1 : -1;
    const given = rc(rng, ['sin', 'cos']);
    const want = rc(rng, ['sin', 'cos', 'tan']);
    const givenTex = given === 'sin' ? `\\sin\\theta = ${new Frac(sS * o, h).latex()}` : `\\cos\\theta = ${new Frac(sC * a, h).latex()}`;
    const res = want === 'sin' ? new Frac(2 * sS * sC * o * a, h * h)
      : want === 'cos' ? new Frac(a * a - o * o, h * h)
        : new Frac(2 * sS * sC * o * a, a * a - o * o);
    const flipped = want === 'cos' ? new Frac(o * o - a * a, h * h) : new Frac(-res.n, res.d);
    const quadName = quad === 2 ? 'second' : quad === 3 ? 'third' : 'fourth';
    return {
      prompt: `$\\theta$ lies in the **${quadName} quadrant** and $${givenTex}$. Find $\\${want} 2\\theta$ as a fraction in simplest form.`,
      answerType: 'numeric', answer: { value: res.value, simplestFraction: { n: res.n, d: res.d } },
      inputHint: 'e.g. -7/25',
      traps: [{ value: flipped.value, why: `In the ${quadName} quadrant $\\sin\\theta$ is ${sS > 0 ? 'positive' : 'negative'} and $\\cos\\theta$ is ${sC > 0 ? 'positive' : 'negative'} — that sign pair decides the sign of the answer.` }].filter(t => Math.abs(t.value - res.value) > 1e-9),
      hints: [
        `Sketch the ${quadName} quadrant: $\\sin\\theta$ is ${sS > 0 ? 'positive' : 'negative'}, $\\cos\\theta$ is ${sC > 0 ? 'positive' : 'negative'}.`,
        `The reference triangle has sides ${o}, ${a}, ${h}, so $\\sin\\theta = ${new Frac(sS * o, h).latex()}$ and $\\cos\\theta = ${new Frac(sC * a, h).latex()}$.`,
        `$\\${want} 2\\theta = ${want === 'sin' ? '2\\sin\\theta\\cos\\theta' : want === 'cos' ? '\\cos^2\\theta - \\sin^2\\theta' : '\\dfrac{\\sin 2\\theta}{\\cos 2\\theta}'}$.`
      ],
      steps: [
        { h: 'Fix the signs', d: `${quadName} quadrant → $\\sin\\theta = ${new Frac(sS * o, h).latex()}$, $\\cos\\theta = ${new Frac(sC * a, h).latex()}$` },
        { h: 'Double-angle formula', d: `$\\${want} 2\\theta = ${want === 'sin' ? `2\\left(${new Frac(sS * o, h).latex()}\\right)\\left(${new Frac(sC * a, h).latex()}\\right)` : want === 'cos' ? `\\frac{${a}^2 - ${o}^2}{${h}^2}` : `\\frac{${new Frac(2 * sS * sC * o * a, h * h).latex()}}{${new Frac(a * a - o * o, h * h).latex()}}`}$` },
        { h: 'Simplify', d: `$= ${res.latex()}$` }
      ]
    };
  },
  // ── ME-T1 · Inverse trig ─────────────────────────────────────────────────
  'me11-inversetrig': (rng, diff) => {
    // Special arguments as [typed value, LaTeX, principal angle in twelfths of π, value].
    const H2 = Math.SQRT2 / 2, H3 = Math.sqrt(3) / 2, T3 = Math.sqrt(3) / 3, S3 = Math.sqrt(3);
    const ARG = {
      sin: [['0', '0', 0, 0], ['1/2', '\\frac{1}{2}', 2, 0.5], ['sqrt(2)/2', '\\frac{\\sqrt{2}}{2}', 3, H2], ['sqrt(3)/2', '\\frac{\\sqrt{3}}{2}', 4, H3], ['1', '1', 6, 1]],
      cos: [['1', '1', 0, 1], ['sqrt(3)/2', '\\frac{\\sqrt{3}}{2}', 2, H3], ['sqrt(2)/2', '\\frac{\\sqrt{2}}{2}', 3, H2], ['1/2', '\\frac{1}{2}', 4, 0.5], ['0', '0', 6, 0]],
      tan: [['0', '0', 0, 0], ['sqrt(3)/3', '\\frac{\\sqrt{3}}{3}', 2, T3], ['1', '1', 3, 1], ['sqrt(3)', '\\sqrt{3}', 4, S3]]
    };
    const NEG = {
      sin: [['-1/2', '-\\frac{1}{2}', -2, -0.5], ['-sqrt(2)/2', '-\\frac{\\sqrt{2}}{2}', -3, -H2], ['-sqrt(3)/2', '-\\frac{\\sqrt{3}}{2}', -4, -H3], ['-1', '-1', -6, -1]],
      cos: [['-1/2', '-\\frac{1}{2}', 8, -0.5], ['-sqrt(2)/2', '-\\frac{\\sqrt{2}}{2}', 9, -H2], ['-sqrt(3)/2', '-\\frac{\\sqrt{3}}{2}', 10, -H3], ['-1', '-1', 12, -1]],
      tan: [['-sqrt(3)/3', '-\\frac{\\sqrt{3}}{3}', -2, -T3], ['-1', '-1', -3, -1], ['-sqrt(3)', '-\\sqrt{3}', -4, -S3]]
    };
    const NAME = { sin: '\\sin^{-1}', cos: '\\cos^{-1}', tan: '\\tan^{-1}' };
    const RANGE = { sin: '$[-\\frac{\\pi}{2}, \\frac{\\pi}{2}]$', cos: '$[0, \\pi]$', tan: '$(-\\frac{\\pi}{2}, \\frac{\\pi}{2})$' };

    if (diff === 1) {
      const fn = rc(rng, ['sin', 'cos', 'tan']);
      const [typed, tex, t, val] = rc(rng, ARG[fn]);
      const pf = piFrac(t, 12);
      if (rng() < 0.42) {
        const inDeg = rc(rng, [true, false]);
        const deg = t * 15;
        return {
          prompt: `Find $x$, the exact value that satisfies $${NAME[fn]}(x) = ${inDeg ? `${deg}°` : pf.tex}$.`,
          answerType: 'numeric', answer: { value: val, requireExact: true, canonicalInput: typed },
          inputHint: 'e.g. sqrt(3)/2',
          traps: [],
          hints: [`$${NAME[fn]}(x) = \\theta$ means $\\${fn}\\theta = x$.`, `So $x = \\${fn}(${inDeg ? `${deg}°` : pf.tex})$.`, `$x = ${tex}$.`],
          steps: [
            { h: 'Undo the inverse', d: `$${NAME[fn]}(x) = ${inDeg ? `${deg}°` : pf.tex} \\Rightarrow x = \\${fn}(${inDeg ? `${deg}°` : pf.tex})$` },
            { h: 'Exact value', d: `$x = ${tex}$` }
          ]
        };
      }
      const shape = rc(rng, ['deg', 'rad', 'dp']);
      const asked = shape === 'deg' ? 'degrees' : shape === 'rad' ? 'radians' : 'radians, correct to 3 decimal places';
      return {
        prompt: `Find the ${shape === 'dp' ? 'value' : 'exact value'} of $${NAME[fn]}\\left(${tex}\\right)$, in ${asked}.`,
        answerType: 'numeric',
        answer: shape === 'deg' ? { value: t * 15 }
          : shape === 'rad' ? { value: pf.val, requireExact: true, canonicalInput: pf.typed }
            : { value: r3(pf.val), tol: 0.0006 },
        ...(shape === 'deg' ? { answerSuffix: '°' } : {}),
        inputHint: shape === 'deg' ? 'e.g. 45' : shape === 'rad' ? 'e.g. pi/6' : 'e.g. 0.524',
        traps: [],
        hints: ['Which special angle produces this ratio?', `The principal range of $${NAME[fn]}$ is ${RANGE[fn]}.`, `$= ${shape === 'deg' ? `${t * 15}°` : pf.tex}$.`],
        steps: [
          { h: 'Special angles', d: `$${NAME[fn]}\\left(${tex}\\right) = ${shape === 'deg' ? `${t * 15}°` : pf.tex}$` },
          ...(shape === 'dp' ? [{ h: 'As a decimal', d: `$${pf.tex} \\approx ${r3(pf.val)}$` }] : [])
        ]
      };
    }

    if (diff === 2) {
      if (rng() < 0.4) {
        const fn = rc(rng, ['sin', 'cos', 'tan']);
        const [typed, tex, t] = rc(rng, NEG[fn]);
        const pf = piFrac(t, 12);
        const inDeg = rc(rng, [true, false]);
        return {
          prompt: `Find the exact value of $${NAME[fn]}\\left(${tex}\\right)$, in ${inDeg ? 'degrees' : 'radians'} (principal value).`,
          answerType: 'numeric',
          answer: inDeg ? { value: t * 15 } : { value: pf.val, requireExact: true, canonicalInput: pf.typed },
          ...(inDeg ? { answerSuffix: '°' } : {}),
          inputHint: inDeg ? 'e.g. 120' : 'e.g. 2pi/3',
          traps: [{ value: inDeg ? -t * 15 : -pf.val, why: `The principal range of $${NAME[fn]}$ is ${RANGE[fn]} — a negative input does not simply flip the sign of the answer for every inverse function.`, tol: 0.001 }].filter(x => Math.abs(x.value - (inDeg ? t * 15 : pf.val)) > 0.002),
          hints: [`The reference angle comes from $${typed.replace('-', '')}$.`, `Now place it inside ${RANGE[fn]}.`, `$= ${inDeg ? `${t * 15}°` : pf.tex}$.`],
          steps: [
            { h: 'Reference angle', d: `$\\${fn}$ of ${Math.abs(t) * 15}° gives $${typed.replace('-', '')}$` },
            { h: 'Principal value', d: `$${NAME[fn]}\\left(${tex}\\right) = ${inDeg ? `${t * 15}°` : pf.tex}$` }
          ]
        };
      }
      const f1 = rc(rng, ['sin', 'cos', 'tan']), f2 = rc(rng, ['sin', 'cos', 'tan']);
      const pool1 = rng() < 0.5 ? ARG[f1] : NEG[f1];
      const pool2 = rng() < 0.5 ? ARG[f2] : NEG[f2];
      const [, tx1, t1] = rc(rng, pool1);
      const [, tx2, t2] = rc(rng, pool2);
      const add = rc(rng, [true, false]);
      const total = add ? t1 + t2 : t1 - t2;
      const wrongT = add ? t1 - t2 : t1 + t2;
      const pf = piFrac(total, 12);
      const p1 = piFrac(t1, 12), p2 = piFrac(t2, 12);
      return {
        prompt: `Find the exact value of $${NAME[f1]}\\left(${tx1}\\right) ${add ? '+' : '-'} ${NAME[f2]}\\left(${tx2}\\right)$, in radians.`,
        answerType: 'numeric', answer: { value: pf.val, requireExact: true, canonicalInput: pf.typed },
        inputHint: 'e.g. 5pi/12',
        traps: [{ value: wrongT * Math.PI / 12, why: 'Evaluate each inverse to its principal value first, then combine — the signs matter.', tol: 0.001 }].filter(x => Math.abs(x.value - pf.val) > 0.002),
        hints: [`$${NAME[f1]}\\left(${tx1}\\right) = ${p1.tex}$.`, `$${NAME[f2]}\\left(${tx2}\\right) = ${p2.tex}$.`, `Combine over a common denominator of 12.`],
        steps: [
          { h: 'First principal value', d: `$${NAME[f1]}\\left(${tx1}\\right) = ${p1.tex}$` },
          { h: 'Second principal value', d: `$${NAME[f2]}\\left(${tx2}\\right) = ${p2.tex}$` },
          { h: 'Combine', d: `$${p1.tex} ${add ? '+' : '-'} ${p2.tex} = ${pf.tex}$` }
        ]
      };
    }

    if (diff === 3) {
      const [o, a, h] = rc(rng, TRIPLES);
      const combo = rc(rng, [
        { outer: 'sin', inner: 'cos', argTex: `\\dfrac{${a}}{${h}}`, n: o, d: h, wrong: a / h },
        { outer: 'tan', inner: 'cos', argTex: `\\dfrac{${a}}{${h}}`, n: o, d: a, wrong: a / o },
        { outer: 'cos', inner: 'sin', argTex: `\\dfrac{${o}}{${h}}`, n: a, d: h, wrong: o / h },
        { outer: 'tan', inner: 'sin', argTex: `\\dfrac{${o}}{${h}}`, n: o, d: a, wrong: h / a },
        { outer: 'sin', inner: 'tan', argTex: `\\dfrac{${o}}{${a}}`, n: o, d: h, wrong: o / a },
        { outer: 'cos', inner: 'tan', argTex: `\\dfrac{${o}}{${a}}`, n: a, d: h, wrong: a / o }
      ]);
      const f = new Frac(combo.n, combo.d);
      return {
        prompt: `Find the exact value of $\\${combo.outer}\\left(${NAME[combo.inner]}\\left(${combo.argTex}\\right)\\right)$ as a fraction in simplest form.`,
        answerType: 'numeric', answer: { value: f.value, simplestFraction: { n: f.n, d: f.d } },
        inputHint: 'e.g. 3/5',
        traps: [{ value: combo.wrong, why: `Draw the right triangle for $\\theta = ${NAME[combo.inner]}\\left(${combo.argTex}\\right)$ — sides ${o}, ${a}, ${h} — then read off $\\${combo.outer}\\theta$.` }].filter(t => Math.abs(t.value - f.value) > 1e-9),
        hints: [`Let $\\theta = ${NAME[combo.inner]}\\left(${combo.argTex}\\right)$, so $\\${combo.inner}\\theta = ${combo.argTex}$.`, `The third side follows from Pythagoras: the triangle is ${o}–${a}–${h}.`, `$\\${combo.outer}\\theta = ${f.latex()}$.`],
        steps: [
          { h: 'Build the triangle', d: `$\\${combo.inner}\\theta = ${combo.argTex}$ → sides ${o}, ${a}, ${h}` },
          { h: 'Read off the ratio', d: `$\\${combo.outer}\\theta = ${f.latex()}$` }
        ]
      };
    }

    const fn = rc(rng, ['sin', 'cos', 'tan']);
    const step = rc(rng, [2, 3]);          // twelfths per 30° or 45° family
    let t = 0, r = null;
    for (let guard = 0; guard < 60; guard++) {
      t = step * ri(rng, -11, 11);
      if (t === 0) continue;
      r = principalTwelfths(fn, t);
      if (r !== null && r !== t) break;
      r = null;
    }
    if (r === null) { t = fn === 'cos' ? 14 : 10; r = principalTwelfths(fn, t); }
    const inner = piFrac(t, 12), out = piFrac(r, 12);
    return {
      prompt: `Evaluate $${NAME[fn]}\\left(\\${fn}\\left(${inner.tex}\\right)\\right)$ exactly. (Careful — the answer is **not** $${inner.tex}$.)`,
      answerType: 'numeric', answer: { value: out.val, requireExact: true, canonicalInput: out.typed },
      inputHint: 'e.g. pi/6',
      traps: [{ value: inner.val, why: `$${inner.tex}$ is outside the principal range ${RANGE[fn]} — the inverse returns the angle **inside** that range with the same $\\${fn}$ value.`, tol: 0.001 }],
      hints: [`$${NAME[fn]}$ only ever returns angles in ${RANGE[fn]}.`, `Work out $\\${fn}\\left(${inner.tex}\\right)$ first.`, `Then find the in-range angle with that same $\\${fn}$ value.`],
      steps: [
        { h: 'Inner value', d: `$\\${fn}\\left(${inner.tex}\\right) = \\${fn}\\left(${out.tex}\\right)$` },
        { h: 'Principal range', d: `$${out.tex}$ lies in ${RANGE[fn]}, so that is the answer` }
      ]
    };
  },
  // ── ME-A1 · Combinatorics ────────────────────────────────────────────────
  'me11-comb': (rng, diff) => {
    const GROUP = ['friends', 'cousins', 'teammates', 'band members', 'debaters', 'cyclists', 'chess players', 'volunteers'];
    if (diff === 1) {
      const n = ri(rng, 5, 10);
      const kind = ri(rng, 1, 4);
      const who = rc(rng, GROUP);
      if (kind === 1) {
        const val = 2 * factorial(n - 1);
        return {
          prompt: `$${n}$ ${who} sit in a row for a photo. Two of them insist on sitting **together**. How many arrangements are possible?`,
          answerType: 'numeric', answer: { value: val },
          traps: [
            { value: factorial(n), why: 'Gluing the pair together changes the count — treat them as one unit, then arrange the pair internally.' },
            { value: factorial(n - 1), why: 'The glued pair can sit in 2 internal orders — multiply by 2.' }
          ],
          hints: ['Treat the inseparable pair as a single unit.', `That gives ${n - 1} units → $(${n - 1})!$ arrangements.`, 'Multiply by 2 for the pair’s internal order.'],
          steps: [
            { h: 'Glue the pair', d: `${n - 1} units → $(${n - 1})! = ${factorial(n - 1)}$` },
            { h: 'Internal order', d: `× 2 → $${val}$` }
          ]
        };
      }
      if (kind === 2) {
        const val = factorial(n - 1);
        return {
          prompt: `$${n}$ ${who} sit around a **circular** table. How many seating arrangements are there, counting rotations of the same order as identical?`,
          answerType: 'numeric', answer: { value: val },
          traps: [{ value: factorial(n), why: `A circle has no fixed first seat — fix one person, then arrange the other ${n - 1} around them.` }],
          hints: ['Rotations of a circle give the same arrangement.', 'Anchor one person in place.', `The remaining ${n - 1} can be ordered in $(${n - 1})!$ ways.`],
          steps: [
            { h: 'Remove the rotations', d: `Fix one person; ${n - 1} seats remain` },
            { h: 'Arrange the rest', d: `$(${n - 1})! = ${val}$` }
          ]
        };
      }
      if (kind === 3) {
        const r = ri(rng, 2, Math.min(4, n - 1));
        const val = nPr(n, r);
        return {
          prompt: `From $${n}$ ${who}, a captain, a vice-captain${r >= 3 ? ', a secretary' : ''}${r >= 4 ? ' and a treasurer' : ''} are chosen — all different people, and the roles are distinct. In how many ways can this be done?`,
          answerType: 'numeric', answer: { value: val },
          traps: [{ value: nCr(n, r), why: 'The roles are different, so order matters — this is $^{n}P_{r}$, not $^{n}C_{r}$.' }],
          hints: ['Different roles means order matters.', `$^{${n}}P_{${r}} = \\frac{${n}!}{(${n} - ${r})!}$.`, `Multiply ${Array.from({ length: r }, (_, i) => n - i).join(' × ')}.`],
          steps: [
            { h: 'Ordered selection', d: `$^{${n}}P_{${r}} = ${Array.from({ length: r }, (_, i) => n - i).join(' \\times ')}$` },
            { h: 'Evaluate', d: `$= ${val}$` }
          ]
        };
      }
      const r = ri(rng, 2, Math.min(4, n - 1));
      const val = nCr(n, r);
      return {
        prompt: `A team of $${r}$ is chosen from $${n}$ ${who}, with no roles attached. How many different teams are possible?`,
        answerType: 'numeric', answer: { value: val },
        traps: [{ value: nPr(n, r), why: `The team has no roles, so order does not matter — divide the ordered count by $${r}!$ to get $^{${n}}C_{${r}}$.` }],
        hints: ['No roles means order does not matter.', `$\\binom{${n}}{${r}} = \\frac{${n}!}{${r}!\\,(${n - r})!}$.`, `$= ${val}$.`],
        steps: [
          { h: 'Unordered selection', d: `$\\binom{${n}}{${r}} = \\dfrac{^{${n}}P_{${r}}}{${r}!}$` },
          { h: 'Evaluate', d: `$= ${val}$` }
        ]
      };
    }
    if (diff === 2) {
      if (rng() < 0.45) {
        const word = rc(rng, [
          ['COFFEE', 6, [2, 2]], ['BANANA', 6, [3, 2]], ['SUCCESS', 7, [3, 2]], ['NEEDED', 6, [3, 2]],
          ['LEVEL', 5, [2, 2]], ['PEPPER', 6, [3, 2]], ['ALGEBRA', 7, [2]], ['MINIMUM', 7, [3, 2]],
          ['TATTOO', 6, [3, 2]], ['ASSESS', 6, [4]], ['PARALLEL', 8, [3, 2]], ['BOOKKEEPER', 10, [3, 2, 2]]
        ]);
        const [w, n, reps] = word;
        const val = Math.round(factorial(n) / reps.reduce((s, r) => s * factorial(r), 1));
        return {
          prompt: `How many distinct arrangements are there of the letters of **${w}**?`,
          answerType: 'numeric', answer: { value: val },
          traps: [{ value: factorial(n), why: `${w} has repeated letters — divide by the factorial of each repeat count.` }],
          hints: [`${w} has ${n} letters with repeats.`, `Divide $${n}!$ by ${reps.map(r => `${r}!`).join(' and ')}.`, `$\\frac{${n}!}{${reps.map(r => `${r}!`).join('\\,')}}$.`],
          steps: [
            { h: 'Repeated letters', d: `$\\dfrac{${n}!}{${reps.map(r => r + '!').join(' \\cdot ')}}$` },
            { h: 'Evaluate', d: `$\\dfrac{${factorial(n)}}{${reps.reduce((s, r) => s * factorial(r), 1)}} = ${val}$` }
          ]
        };
      }
      const n = ri(rng, 5, 9);
      const blockSize = ri(rng, 2, 3);
      const together = rc(rng, [true, false]);
      const val = together
        ? factorial(n - blockSize + 1) * factorial(blockSize)
        : factorial(n) - factorial(n - blockSize + 1) * factorial(blockSize);
      const who = rc(rng, GROUP);
      return {
        prompt: `$${n}$ ${who} line up for a photo. $${blockSize}$ of them are siblings. In how many arrangements are the siblings **${together ? 'all together' : 'not all together'}**?`,
        answerType: 'numeric', answer: { value: val },
        traps: [{ value: together ? factorial(n) - val : factorial(n - blockSize + 1) * factorial(blockSize), why: `“All together” and “not all together” add to $${n}! = ${factorial(n)}$ — make sure you report the one asked for.` }],
        hints: [
          `Treat the ${blockSize} siblings as one block: $(${n - blockSize + 1})!$ ways to place the units.`,
          `The block can be internally ordered in $${blockSize}! = ${factorial(blockSize)}$ ways, giving $${factorial(n - blockSize + 1) * factorial(blockSize)}$ “together” arrangements.`,
          together ? 'That is the answer.' : `Subtract from the unrestricted total $${n}! = ${factorial(n)}$.`
        ],
        steps: [
          { h: 'Glue the block', d: `$(${n - blockSize + 1})! \\times ${blockSize}! = ${factorial(n - blockSize + 1) * factorial(blockSize)}$ arrangements with them together` },
          together
            ? { h: 'Answer', d: `$${val}$` }
            : { h: 'Complement', d: `$${n}! - ${factorial(n - blockSize + 1) * factorial(blockSize)} = ${val}$` }
        ]
      };
    }
    if (diff === 3) {
      const boys = ri(rng, 4, 8), girls = ri(rng, 4, 8);
      if (rng() < 0.4) {
        const size = ri(rng, 3, 5);
        const minB = ri(rng, 1, 2);
        let val = 0;
        for (let b = minB; b <= Math.min(boys, size); b++) val += nCr(boys, b) * nCr(girls, size - b);
        return {
          prompt: `A committee of $${size}$ is chosen from $${boys}$ boys and $${girls}$ girls, and must contain **at least $${minB}$** boy${minB > 1 ? 's' : ''}. How many committees are possible?`,
          answerType: 'numeric', answer: { value: val },
          traps: [{ value: nCr(boys + girls, size), why: 'That counts every committee, including those with too few boys — subtract the ones that fail the condition.' }],
          hints: ['Count the total, then remove the committees with too few boys.', `Total $= \\binom{${boys + girls}}{${size}} = ${nCr(boys + girls, size)}$.`, `Or add the cases $b = ${minB}$ up to $b = ${Math.min(boys, size)}$.`],
          steps: [
            { h: 'Case by case', d: `$\\sum_{b=${minB}}^{${Math.min(boys, size)}} \\binom{${boys}}{b}\\binom{${girls}}{${size} - b}$` },
            { h: 'Evaluate', d: `$= ${val}$` }
          ]
        };
      }
      const nb = ri(rng, 2, 3), ng = ri(rng, 2, 3);
      const val = nCr(boys, nb) * nCr(girls, ng);
      return {
        prompt: `A committee of $${nb + ng}$ is chosen from $${boys}$ boys and $${girls}$ girls, and must contain exactly $${nb}$ boys and $${ng}$ girls. How many committees are possible?`,
        answerType: 'numeric', answer: { value: val },
        traps: [{ value: nCr(boys + girls, nb + ng), why: 'The gender split is fixed — choose the boys and girls separately, then multiply.' }],
        hints: ['Choose the boys and the girls independently.', `$\\binom{${boys}}{${nb}} \\times \\binom{${girls}}{${ng}}$.`, `$${nCr(boys, nb)} \\times ${nCr(girls, ng)}$.`],
        steps: [
          { h: 'Choose boys', d: `$\\binom{${boys}}{${nb}} = ${nCr(boys, nb)}$` },
          { h: 'Choose girls', d: `$\\binom{${girls}}{${ng}} = ${nCr(girls, ng)}$` },
          { h: 'Multiply', d: `$${val}$` }
        ]
      };
    }
    const kind = ri(rng, 1, 3);
    if (kind === 1) {
      const k = ri(rng, 4, 20);
      return {
        prompt: `Socks come in $${k}$ colours, thoroughly mixed in a drawer in the dark. What is the **minimum** number of socks you must take to *guarantee* a matching pair? (Pigeonhole principle.)`,
        answerType: 'numeric', answer: { value: k + 1 },
        traps: [
          { value: 2, why: 'Two socks might be different colours — you need to beat the worst case.' },
          { value: k, why: `With ${k} socks you might have one of each colour — one more forces a repeat.` }
        ],
        hints: ['Think worst case: how many can you draw with all different colours?', `${k} socks could be all different.`, 'One more must repeat a colour.'],
        steps: [
          { h: 'Worst case', d: `${k} draws could give one of each colour` },
          { h: 'Pigeonhole', d: `The $${k + 1}$th sock must match one already drawn` }
        ]
      };
    }
    if (kind === 2) {
      const boxes = ri(rng, 3, 10), copies = ri(rng, 2, 5);
      const val = boxes * (copies - 1) + 1;
      return {
        prompt: `A bag holds a large number of tiles in $${boxes}$ different colours. What is the **minimum** number of tiles you must draw to *guarantee* $${copies}$ of the same colour? (Pigeonhole principle.)`,
        answerType: 'numeric', answer: { value: val },
        traps: [{ value: boxes * copies, why: `The worst case stops one short in every colour: $${boxes} \\times ${copies - 1} = ${boxes * (copies - 1)}$ — then one more tile forces a ${copies}th.` }],
        hints: [`Worst case: ${copies - 1} of every colour and no more.`, `That is $${boxes} \\times ${copies - 1} = ${boxes * (copies - 1)}$ tiles.`, 'One further tile must complete a set.'],
        steps: [
          { h: 'Worst case', d: `$${boxes} \\times (${copies} - 1) = ${boxes * (copies - 1)}$ tiles with no colour reaching ${copies}` },
          { h: 'Pigeonhole', d: `Draw one more: $${val}$` }
        ]
      };
    }
    const n = ri(rng, 5, 12), r = ri(rng, 3, 6);
    const val = nCr(n + r - 1, r);
    return {
      prompt: `A bakery sells $${n}$ kinds of muffin and has plenty of each. In how many ways can you fill a box with $${r}$ muffins, if only the number of each kind matters?`,
      answerType: 'numeric', answer: { value: val },
      traps: [
        { value: nCr(n, r), why: 'Repeats are allowed here, so this is a selection *with* repetition: $\\binom{n + r - 1}{r}$.' },
        { value: n ** r, why: 'The muffins in the box are not ordered — counting $n^r$ sequences counts the same box many times.' }
      ],
      hints: ['Repetition is allowed and order does not matter.', `Stars and bars: ${r} stars and ${n - 1} bars in a row.`, `$\\binom{${n + r - 1}}{${r}}$.`],
      steps: [
        { h: 'Stars and bars', d: `${r} muffins (stars) split by ${n - 1} dividers (bars)` },
        { h: 'Count the layouts', d: `$\\binom{${n} + ${r} - 1}{${r}} = ${val}$` }
      ]
    };
  },
  // ── ME-C1 · Rates of change ──────────────────────────────────────────────
  'me11-rates': (rng, diff) => {
    if (diff === 1) {
      const N0 = rc(rng, [150, 200, 250, 400, 500, 750, 800, 1000, 1200, 2000]);
      const k = rc(rng, [0.03, 0.04, 0.05, 0.06, 0.08, 0.1, 0.12, 0.15]);
      const t = ri(rng, 3, 16);
      const val = N0 * Math.exp(k * t);
      return {
        prompt: `A culture grows so that $\\dfrac{dN}{dt} = ${k}N$, giving $N = ${N0}e^{${k}t}$. Find $N$ after $${t}$ hours, to the nearest whole number.`,
        answerType: 'numeric', answer: { value: Math.round(val), tol: 1.01 },
        traps: [{ value: Math.round(N0 * (1 + k * t)), why: 'Exponential growth compounds continuously — evaluate $e^{kt}$.', tol: 1.01 }],
        hints: ['Substitute t into the model.', `$e^{${r2(k * t)}} = ${r3(Math.exp(k * t))}$.`, `Multiply by ${N0}.`],
        steps: [{ h: 'Evaluate', d: `$N = ${N0}e^{${r2(k * t)}} \\approx ${Math.round(val)}$` }]
      };
    }
    if (diff === 2) {
      const grow = rc(rng, [true, false]);
      const k = rc(rng, [0.02, 0.025, 0.03, 0.04, 0.05, 0.06, 0.07, 0.08, 0.09, 0.1, 0.12, 0.15]);
      const mult = grow ? rc(rng, [2, 3, 4, 5, 10]) : rc(rng, [2, 4, 5, 10]);
      const t = Math.log(mult) / k;
      const word = grow ? (mult === 2 ? 'doubles' : mult === 3 ? 'triples' : `grows ${mult}-fold`) : (mult === 2 ? 'halves' : `falls to $\\frac{1}{${mult}}$ of its present size`);
      return {
        prompt: `A population satisfies $\\dfrac{dP}{dt} = ${grow ? '' : '-'}${k}P$. How long until it **${word}**? Answer in years, correct to 1 decimal place.`,
        answerType: 'numeric', answer: { value: r1(t), tol: 0.06 }, answerSuffix: 'years',
        traps: [{ value: r1(1 / k), why: `The time is $\\frac{\\ln ${mult}}{k}$, not $\\frac{1}{k}$.`, tol: 0.06 }].filter(tr => Math.abs(tr.value - r1(t)) > 0.15),
        hints: [`Solve $e^{${grow ? '' : '-'}${k}t} = ${grow ? mult : `\\frac{1}{${mult}}`}$.`, 'Take ln of both sides.', `$t = \\frac{\\ln ${mult}}{${k}}$.`],
        steps: [
          { h: 'Set up the condition', d: `$e^{${grow ? '' : '-'}${k}t} = ${grow ? mult : `\\frac{1}{${mult}}`}$` },
          { h: 'Solve', d: `$t = \\dfrac{\\ln ${mult}}{${k}} \\approx ${r1(t)}$ years` }
        ]
      };
    }
    if (diff === 3) {
      const rate = rc(rng, [0.2, 0.25, 0.5, 0.8, 1, 1.5, 2, 2.5, 3]);
      const x = ri(rng, 2, 12);
      const shape = ri(rng, 1, 4);
      const setup = shape === 1
        ? { body: `A spherical balloon is inflated so its radius grows at $${rate}$ cm/s`, ask: 'the rate of change of **volume**', formula: 'V = \\frac{4}{3}\\pi r^3', rhs: '\\frac{4}{3}\\pi r^3', deriv: '4\\pi r^2', at: `r = ${x}`, val: 4 * Math.PI * x * x * rate, unit: 'cm³/s', wrong: 4 / 3 * Math.PI * x ** 3, wrongWhy: 'That is the volume itself — differentiate first, then apply the chain rule.' }
        : shape === 2
          ? { body: `A spherical bubble expands with its radius growing at $${rate}$ cm/s`, ask: 'the rate of change of **surface area**', formula: 'S = 4\\pi r^2', rhs: '4\\pi r^2', deriv: '8\\pi r', at: `r = ${x}`, val: 8 * Math.PI * x * rate, unit: 'cm²/s', wrong: 4 * Math.PI * x * x, wrongWhy: 'That is the surface area itself — you need $\\frac{dS}{dr}\\cdot\\frac{dr}{dt}$.' }
          : shape === 3
            ? { body: `A cube's edge length grows at $${rate}$ cm/s`, ask: 'the rate of change of **volume**', formula: 'V = x^3', rhs: 'x^3', deriv: '3x^2', at: `x = ${x}`, val: 3 * x * x * rate, unit: 'cm³/s', wrong: x ** 3, wrongWhy: 'That is the volume itself — differentiate, then multiply by $\\frac{dx}{dt}$.' }
            : { body: `Oil spreads in a circular slick whose radius grows at $${rate}$ m/s`, ask: 'the rate of change of **area**', formula: 'A = \\pi r^2', rhs: '\\pi r^2', deriv: '2\\pi r', at: `r = ${x}`, val: 2 * Math.PI * x * rate, unit: 'm²/s', wrong: Math.PI * x * x, wrongWhy: 'That is the area itself — the chain rule gives $\\frac{dA}{dt} = 2\\pi r\\frac{dr}{dt}$.' };
      return {
        prompt: `${setup.body}. Using $${setup.formula}$, find ${setup.ask} when $${setup.at}$, correct to 1 decimal place.`,
        answerType: 'numeric', answer: { value: r1(setup.val), tol: 0.06 }, answerSuffix: setup.unit,
        traps: [{ value: r1(setup.wrong), why: setup.wrongWhy, tol: 0.06 }].filter(t => Math.abs(t.value - r1(setup.val)) > 0.12),
        hints: ['Chain rule: multiply the derivative of the formula by the given rate.', `$\\dfrac{d}{d\\text{(size)}}\\left(${setup.rhs}\\right) = ${setup.deriv}$.`, `Substitute $${setup.at}$ and multiply by $${rate}$.`],
        steps: [
          { h: 'Differentiate the formula', d: `$${setup.formula} \\Rightarrow ${setup.deriv}$` },
          { h: 'Chain rule', d: `$${setup.deriv}$ at $${setup.at}$, times $${rate}$, gives $\\approx ${r1(setup.val)}$ ${setup.unit}` }
        ]
      };
    }
    const half = rc(rng, [4, 5, 6, 8, 10, 12, 15, 20, 24, 30]);
    const k = Math.log(2) / half;
    const t = ri(rng, 7, 45);
    const frac = Math.exp(-k * t);
    return {
      prompt: `A radioactive isotope has a half-life of $${half}$ years (so $M = M_0e^{-kt}$ with $k = \\frac{\\ln 2}{${half}}$). What **fraction** of the original mass remains after $${t}$ years, correct to 3 decimal places?`,
      answerType: 'numeric', answer: { value: r3(frac), tol: 0.002 },
      traps: [{ value: r3(1 - t / half / 10), why: 'Decay is exponential, not linear — evaluate $e^{-kt}$.', tol: 0.002 }].filter(tr => Math.abs(tr.value - r3(frac)) > 0.01),
      hints: [`$k = \\frac{\\ln 2}{${half}} = ${r3(k)}$.`, `Fraction left $= e^{-${r3(k)} \\times ${t}}$.`, 'Evaluate to 3 dp.'],
      steps: [
        { h: 'Decay constant', d: `$k = \\frac{\\ln 2}{${half}} = ${r3(k)}$` },
        { h: 'Fraction remaining', d: `$e^{-${r3(k)}(${t})} \\approx ${r3(frac)}$` }
      ]
    };
  },
  // ── ME-P1 · Proof by induction ───────────────────────────────────────────
  'me12-induction': (rng, diff) => {
    if (diff === 1) {
      const F = inductionFamily(rng);
      const m = ri(rng, 1, F.maxCheck);
      const val = F.valueAt(m);
      return {
        prompt: `A proof by induction of $${F.claimTex}$ begins by checking the claim at $n = ${m}$. What value do **both sides** take there?`,
        answerType: 'numeric', answer: { value: val },
        traps: [{ value: F.valueAt(m + 1), why: `Substitute $n = ${m}$ — not $n = ${m + 1}$ — into both sides.` }].filter(t => t.value !== val),
        hints: [`Write out the left side up to the $n = ${m}$ term.`, `Then substitute $n = ${m}$ into the right side.`, 'The two must agree, and that shared value is the answer.'],
        steps: [
          { h: `Left side at n = ${m}`, d: `$${F.lhsAt(m)} = ${val}$` },
          { h: `Right side at n = ${m}`, d: `$${F.rhsAt(m)} = ${val}$` },
          { h: 'Base case holds', d: `Both sides give $${val}$ ✓` }
        ]
      };
    }
    if (diff === 2) {
      const F = inductionFamily(rng);
      return {
        prompt: `In the inductive step for $${F.claimTex}$, assume the result for $n = k$ and add the next term. Simplify $${F.startTex}$ into factored form.`,
        answerType: 'expression', answer: { expr: F.stepEnd, anyOf: [F.stepMid, F.stepStart] },
        inputHint: `e.g. ${F.inputHint}`,
        traps: [{ expr: F.stepStart, why: 'That is the unsimplified sum — factor it so it matches the claim with $n = k+1$.' }],
        hints: [F.hint1, F.hint2, `It should land on $${F.endTex}$ — the claim with $n = k+1$.`],
        steps: [
          { h: 'Add the next term', d: `$${F.startTex}$` },
          { h: 'Factor and tidy', d: `$= ${F.midTex}$` },
          { h: 'Conclusion', d: `$= ${F.endTex}$ — the claim at $n = k+1$, so the induction closes.` }
        ]
      };
    }
    if (diff === 3) {
      if (rng() < 0.55) {
        const b = ri(rng, 3, 20), d = b - 1;
        return {
          prompt: `To prove $${b}^n - 1$ is divisible by $${d}$ by induction, assume $${b}^k - 1 = ${d}m$. Then $${b}^{k+1} - 1 = ${b}\\cdot${b}^k - 1 = ${b}(${d}m + 1) - 1 = ${d}(\\;?\\;)$. Find the bracket.`,
          answerType: 'expression', answer: { expr: `${b}m + 1` },
          inputHint: `e.g. ${b}m + 1`,
          traps: [{ expr: `${b}m`, why: `Expand carefully: $${b}(${d}m + 1) - 1 = ${b * d}m + ${b} - 1 = ${d}(${b}m) + ${d}$, and that trailing $${d}$ folds into the bracket as $+1$.` }],
          hints: [`Expand $${b}(${d}m + 1) - 1$.`, `$= ${b * d}m + ${b - 1}$.`, `Take out ${d}: $${d}(${b}m + 1)$.`],
          steps: [
            { h: 'Substitute the assumption', d: `$${b}^{k+1} - 1 = ${b}(${d}m + 1) - 1$` },
            { h: 'Expand', d: `$= ${b * d}m + ${b} - 1 = ${b * d}m + ${d}$` },
            { h: 'Factor', d: `$= ${d}(${b}m + 1)$ — divisible by ${d} ✓` }
          ]
        };
      }
      const c = ri(rng, 2, 8);
      const b = c + ri(rng, 1, 9);
      const d = b - c;
      return {
        prompt: `To prove $${b}^n - ${c}^n$ is divisible by $${d}$ by induction, assume $${b}^k - ${c}^k = ${d}m$. Then $${b}^{k+1} - ${c}^{k+1} = ${b}(${b}^k - ${c}^k) + ${c}^k(${b} - ${c}) = ${d}(\\;?\\;)$. Find the bracket.`,
        answerType: 'expression', answer: { expr: `${b}m + ${c}^k`, anyOf: [`${b}*m + ${c}^k`] },
        inputHint: `e.g. ${b}m + ${c}^k`,
        traps: [{ expr: `${b}m`, why: `The term $${c}^k(${b} - ${c}) = ${d}\\cdot${c}^k$ also carries a factor of ${d} — it belongs inside the bracket.` }],
        hints: [`Split it as $${b}(${b}^k - ${c}^k) + ${c}^k(${b} - ${c})$.`, `The first piece is $${b}\\cdot${d}m$; the second is $${d}\\cdot${c}^k$.`, `Take out the common factor ${d}.`],
        steps: [
          { h: 'Rewrite the next case', d: `$${b}^{k+1} - ${c}^{k+1} = ${b}(${b}^k - ${c}^k) + ${c}^k(${b} - ${c})$` },
          { h: 'Substitute the assumption', d: `$= ${b}(${d}m) + ${d}\\cdot${c}^k$` },
          { h: 'Factor', d: `$= ${d}(${b}m + ${c}^k)$ — divisible by ${d} ✓` }
        ]
      };
    }
    const F = inductionFamily(rng);
    return {
      prompt: `**Show your working** for the inductive step of $${F.claimTex}$: starting from $${F.startTex}$, transform it (one step per line) into $${F.endTex}$. Every line must stay equivalent.`,
      answerType: 'working',
      answer: {
        stepMeta: { kind: 'expression', canonical: F.stepStart },
        minLines: 2,
        final: { kind: 'expr', expr: F.stepEnd },
        canonicalWorking: `${F.stepStart}\n${F.stepMid}\n${F.stepEnd}`
      },
      inputHint: `One line per step, e.g.\n${F.stepStart}\n${F.stepMid}\n${F.stepEnd}`,
      traps: [],
      hints: [F.hint1, F.hint2, `Finish on $${F.endTex}$.`],
      steps: [
        { h: 'Factor', d: `$${F.startTex} = ${F.midTex}$` },
        { h: 'Tidy', d: `$= ${F.endTex}$` },
        { h: 'Why it matters', d: `This is exactly the claim at $n = k+1$, so the induction closes.` }
      ]
    };
  },
  // ── ME-V1 · Vectors (2D) ─────────────────────────────────────────────────
  'me12-vectors': (rng, diff) => {
    const trip = rc(rng, [[3, 4, 5], [6, 8, 10], [5, 12, 13], [8, 15, 17]]);
    if (diff === 1) {
      const swap = rc(rng, [true, false]);
      const base = rc(rng, TRIPLES);
      const [x, y, m] = swap ? [base[1], base[0], base[2]] : base;
      const sx = rc(rng, [1, -1]), sy = rc(rng, [1, -1]);
      const cx = sx * x, cy = sy * y;
      if (rng() < 0.4) {
        const ax = ri(rng, -6, 6), ay = ri(rng, -6, 6);
        const bx = ax + cx, by = ay + cy;
        return {
          prompt: `$A$ is the point $(${ax}, ${ay})$ and $B$ is the point $(${bx}, ${by})$. Find $\\left|\\overrightarrow{AB}\\right|$.`,
          answerType: 'numeric', answer: { value: m },
          traps: [{ value: Math.abs(cx) + Math.abs(cy), why: 'Distance is not the sum of the steps — square each component, add, then take the square root.' }].filter(t => t.value !== m),
          hints: [`$\\overrightarrow{AB} = \\begin{pmatrix} ${bx} - ${ax} \\\\ ${by} - ${ay} \\end{pmatrix} = \\begin{pmatrix} ${cx} \\\\ ${cy} \\end{pmatrix}$.`, `$\\left|\\overrightarrow{AB}\\right| = \\sqrt{x^2 + y^2}$.`, `$\\sqrt{${cx * cx} + ${cy * cy}} = ${m}$.`],
          steps: [
            { h: 'Subtract the position vectors', d: `$\\overrightarrow{AB} = \\begin{pmatrix} ${cx} \\\\ ${cy} \\end{pmatrix}$` },
            { h: 'Magnitude', d: `$\\sqrt{(${cx})^2 + (${cy})^2} = \\sqrt{${m * m}} = ${m}$` }
          ]
        };
      }
      const ij = rc(rng, [true, false]);
      const shown = ij
        ? `${cx === 1 ? '' : cx === -1 ? '-' : cx}\\underset{\\sim}{i} ${sgn(cy)}${Math.abs(cy) === 1 ? '' : Math.abs(cy)}\\underset{\\sim}{j}`
        : `\\begin{pmatrix} ${cx} \\\\ ${cy} \\end{pmatrix}`;
      return {
        prompt: `Find the magnitude of the vector $\\underset{\\sim}{a} = ${shown}$.`,
        answerType: 'numeric', answer: { value: m },
        traps: [{ value: cx + cy, why: 'Magnitude uses Pythagoras: $\\sqrt{x^2 + y^2}$ — signs vanish when squared.' }].filter(t => t.value !== m),
        hints: ['$|a| = \\sqrt{x^2 + y^2}$.', `$\\sqrt{${x * x} + ${y * y}}$.`, `$= ${m}$.`],
        steps: [{ h: 'Magnitude', d: `$\\sqrt{(${cx})^2 + (${cy})^2} = \\sqrt{${m * m}} = ${m}$` }]
      };
    }
    if (diff === 2) {
      const a = [nz(rng, -6, 6), nz(rng, -6, 6)], b = [nz(rng, -6, 6), nz(rng, -6, 6)];
      const dot = a[0] * b[0] + a[1] * b[1];
      return {
        prompt: `Find the scalar (dot) product $\\underset{\\sim}{a}\\cdot\\underset{\\sim}{b}$ for $\\underset{\\sim}{a} = \\begin{pmatrix} ${a[0]} \\\\ ${a[1]} \\end{pmatrix}$, $\\underset{\\sim}{b} = \\begin{pmatrix} ${b[0]} \\\\ ${b[1]} \\end{pmatrix}$.`,
        answerType: 'numeric', answer: { value: dot },
        traps: [{ value: a[0] * b[1] + a[1] * b[0], why: 'Match components: $x_1x_2 + y_1y_2$.' }].filter(t => t.value !== dot),
        hints: ['Multiply matching components and add.', `$${a[0]}\\times${b[0]} + ${a[1]}\\times${b[1]}$.`, `= ${dot}.`],
        steps: [{ h: 'Dot product', d: `$(${a[0]})(${b[0]}) + (${a[1]})(${b[1]}) = ${dot}$` }]
      };
    }
    if (diff === 3) {
      const a = [ri(rng, 1, 5), ri(rng, 1, 5)], b = [ri(rng, 1, 5), nz(rng, -5, 5)];
      const dot = a[0] * b[0] + a[1] * b[1];
      const ma = Math.hypot(...a), mb = Math.hypot(...b);
      const ang = Math.acos(Math.max(-1, Math.min(1, dot / (ma * mb)))) * 180 / Math.PI;
      return {
        prompt: `Find the angle between $\\underset{\\sim}{a} = \\begin{pmatrix} ${a[0]} \\\\ ${a[1]} \\end{pmatrix}$ and $\\underset{\\sim}{b} = \\begin{pmatrix} ${b[0]} \\\\ ${b[1]} \\end{pmatrix}$, to the nearest degree.`,
        answerType: 'numeric', answer: { value: Math.round(ang), tol: 0.51 }, answerSuffix: '°',
        traps: [{ value: Math.round(Math.acos(Math.max(-1, Math.min(1, dot / (ma * ma)))) * 180 / Math.PI), why: 'Divide by |a||b| — the product of *both* magnitudes.', tol: 0.51 }].filter(t => Math.abs(t.value - Math.round(ang)) > 1),
        hints: ['$\\cos\\theta = \\frac{a\\cdot b}{|a||b|}$.', `Dot: ${dot}; $|a| = ${r3(ma)}$, $|b| = ${r3(mb)}$.`, 'Apply cos⁻¹.'],
        steps: [
          { h: 'Dot product', d: `$${dot}$` },
          { h: 'Magnitudes', d: `$|a| = ${r3(ma)}, \\ |b| = ${r3(mb)}$` },
          { h: 'Angle', d: `$\\theta = \\cos^{-1}\\left(${r3(dot / (ma * mb))}\\right) \\approx ${Math.round(ang)}°$` }
        ]
      };
    }
    const a = [nz(rng, 2, 6), nz(rng, -6, 6)];
    const b = [trip[0], trip[1]];
    const dot = a[0] * b[0] + a[1] * b[1];
    const proj = dot / trip[2];
    return {
      prompt: `Find the **scalar projection** of $\\underset{\\sim}{a} = \\begin{pmatrix} ${a[0]} \\\\ ${a[1]} \\end{pmatrix}$ onto $\\underset{\\sim}{b} = \\begin{pmatrix} ${b[0]} \\\\ ${b[1]} \\end{pmatrix}$, correct to 2 decimal places.`,
      answerType: 'numeric', answer: { value: r2(proj), tol: 0.011 },
      traps: [{ value: r2(dot / (Math.hypot(...a))), why: 'Project onto b: divide the dot product by $|b|$, not $|a|$.', tol: 0.011 }].filter(t => Math.abs(t.value - r2(proj)) > 0.02),
      hints: ['Scalar projection $= \\frac{a\\cdot b}{|b|}$.', `Dot: ${dot}; $|b| = ${trip[2]}$.`, `$${dot}/${trip[2]}$.`],
      steps: [
        { h: 'Dot product', d: `$${dot}$` },
        { h: 'Divide by |b|', d: `$\\dfrac{${dot}}{${trip[2]}} = ${r2(proj)}$` }
      ]
    };
  },

  // ── ME-T3 · Trig equations ───────────────────────────────────────────────
  'me12-trigeq': (rng, diff) => {
    if (diff === 1) {
      const fn = rc(rng, ['sin', 'cos', 'tan']);
      const pick = rc(rng, RATIO_POOL[fn]);
      const dom = rc(rng, TRIG_DOMAINS);
      const sols = trigSolutionsDeg(fn, pick.v, dom[0], dom[1]);
      const wrong = trigSolutionsDeg(fn, -pick.v, dom[0], dom[1]).filter(x => !sols.includes(x));
      return {
        prompt: `Solve $${pick.eq}$ for $${domainTex(dom)}$. Give **all** solutions in degrees.`,
        answerType: 'set', answer: { values: sols, tol: 0.01 }, answerSuffix: '°',
        inputHint: 'e.g. 30, 150',
        traps: wrong.length ? [{ value: wrong[0], why: `$\\${fn}\\theta = ${pick.tex}$ is ${pick.v < 0 ? 'negative' : 'positive'}, so only the quadrants where $\\${fn}$ takes that sign can supply solutions.` }] : [],
        hints: ['Isolate the trig ratio first.', `$\\${fn}\\theta = ${pick.tex}$ — find the reference angle, then use ASTC.`, `Sweep the whole interval: $\\theta = ${sols.join('°, ')}°$.`],
        steps: [
          { h: 'Isolate the ratio', d: `$${pick.eq} \\Rightarrow \\${fn}\\theta = ${pick.tex}$` },
          { h: 'Reference angle and quadrants', d: `Place the reference angle in every quadrant where $\\${fn}$ is ${pick.v < 0 ? 'negative' : pick.v === 0 ? 'zero' : 'positive'}` },
          { h: 'Solutions in range', d: `$\\theta = ${sols.join('°, ')}°$` }
        ]
      };
    }
    if (diff === 2) {
      const fn = rc(rng, ['sin', 'cos', 'tan']);
      const sq = fn === 'tan'
        ? rc(rng, [
          { eq: '3\\tan^2\\theta = 1', root: '\\pm\\tfrac{1}{\\sqrt{3}}', v: R3T },
          { eq: '\\tan^2\\theta = 1', root: '\\pm 1', v: 1 },
          { eq: '\\tan^2\\theta = 3', root: '\\pm\\sqrt{3}', v: R3 },
          { eq: '5\\tan^2\\theta = 0', root: '0', v: 0 }
        ])
        : rc(rng, [
          { eq: `4\\${fn}^2\\theta = 1`, root: '\\pm\\tfrac{1}{2}', v: 0.5 },
          { eq: `2\\${fn}^2\\theta = 1`, root: '\\pm\\tfrac{1}{\\sqrt{2}}', v: R2 },
          { eq: `4\\${fn}^2\\theta = 3`, root: '\\pm\\tfrac{\\sqrt{3}}{2}', v: R3H },
          { eq: `\\${fn}^2\\theta = 1`, root: '\\pm 1', v: 1 },
          { eq: `5\\${fn}^2\\theta = 0`, root: '0', v: 0 }
        ]);
      const dom = rc(rng, TRIG_DOMAINS);
      const sols = [...new Set([...trigSolutionsDeg(fn, sq.v, dom[0], dom[1]), ...trigSolutionsDeg(fn, -sq.v, dom[0], dom[1])])].sort((a, b) => a - b);
      return {
        prompt: `Solve $${sq.eq}$ for $${domainTex(dom)}$.`,
        answerType: 'set', answer: { values: sols, tol: 0.01 }, answerSuffix: '°',
        inputHint: 'e.g. 45, 135, 225, 315',
        traps: [],
        hints: ['Make the squared ratio the subject, then take the square root.', `$\\${fn}\\theta = ${sq.root}$.`, `Solve each case across the interval: $\\theta = ${sols.join('°, ')}°$.`],
        steps: [
          { h: 'Square root (±)', d: `$\\${fn}\\theta = ${sq.root}$` },
          { h: 'Solve each case', d: `Every quadrant supplying $${sq.root}$ contributes a solution` },
          { h: 'Solutions in range', d: `$\\theta = ${sols.join('°, ')}°$` }
        ]
      };
    }
    if (diff === 3) {
      if (rng() < 0.5) {
        const fn = rc(rng, ['sin', 'cos', 'tan']);
        const m = rc(rng, [2, 3]);
        const pick = rc(rng, RATIO_POOL[fn].filter(p => p.v !== 0));
        const dom = rc(rng, [[0, 180], [0, 90], [-90, 90]]);
        const inner = trigSolutionsDeg(fn, pick.v, m * dom[0], m * dom[1]);
        if (inner.length) {
          const sols = inner.map(u => u / m);
          const eqTex = pick.eq.replace(/\\theta/g, `${m}\\theta`);
          return {
            prompt: `Solve $${eqTex}$ for $${domainTex(dom)}$.`,
            answerType: 'set', answer: { values: sols, tol: 0.01 }, answerSuffix: '°',
            inputHint: 'e.g. 15, 75',
            traps: [{ value: inner[0], why: `Solve for $${m}\\theta$ first, then divide **every** solution by ${m}.` }].filter(t => !sols.includes(t.value)),
            hints: [`Let $u = ${m}\\theta$; as $\\theta$ runs over $${domainTex(dom)}$, $u$ runs from $${m * dom[0]}°$ to $${m * dom[1]}°$.`, `Solve $\\${fn} u = ${pick.tex}$ over that wider interval: $u = ${inner.join('°, ')}°$.`, `Divide each by ${m}: $\\theta = ${sols.join('°, ')}°$.`],
            steps: [
              { h: 'Widen the domain', d: `$u = ${m}\\theta$ runs over $${m * dom[0]}° \\le u \\le ${m * dom[1]}°$` },
              { h: 'Solve for u', d: `$u = ${inner.join('°, ')}°$` },
              { h: 'Divide by the multiplier', d: `$\\theta = ${sols.join('°, ')}°$` }
            ]
          };
        }
      }
      const fn = rc(rng, ['sin', 'cos']);
      const pick = rc(rng, RATIO_POOL[fn].filter(p => p.v !== 0 && Math.abs(p.v) !== 1));
      const dom = rc(rng, TRIG_DOMAINS);
      const zeros = trigSolutionsDeg(fn, 0, dom[0], dom[1]);
      const others = trigSolutionsDeg(fn, pick.v, dom[0], dom[1]);
      const sols = [...new Set([...zeros, ...others])].sort((x, y) => x - y);
      return {
        prompt: `Solve $\\${fn}^2\\theta = ${pick.tex}\\,\\${fn}\\theta$ for $${domainTex(dom)}$.`,
        answerType: 'set', answer: { values: sols, tol: 0.01 }, answerSuffix: '°',
        inputHint: 'e.g. 0, 60, 180, 300, 360',
        traps: [],
        hints: [`Bring everything to one side: $\\${fn}^2\\theta - ${pick.tex}\\,\\${fn}\\theta = 0$.`, `Factor: $\\${fn}\\theta\\left(\\${fn}\\theta - ${pick.tex}\\right) = 0$.`, `So $\\${fn}\\theta = 0$ or $\\${fn}\\theta = ${pick.tex}$: $\\theta = ${sols.join('°, ')}°$.`],
        steps: [
          { h: 'Move everything to one side', d: `$\\${fn}^2\\theta - ${pick.tex}\\,\\${fn}\\theta = 0$` },
          { h: 'Factorise', d: `$\\${fn}\\theta\\left(\\${fn}\\theta - ${pick.tex}\\right) = 0$` },
          { h: 'Solve both factors', d: `$\\${fn}\\theta = 0$ gives $${zeros.join('°, ')}°$; $\\${fn}\\theta = ${pick.tex}$ gives $${others.join('°, ')}°$` },
          { h: 'All solutions', d: `$\\theta = ${sols.join('°, ')}°$` }
        ]
      };
    }
    const dom = rc(rng, TRIG_DOMAINS);
    const coefTex = (c, body) => `${c > 0 ? '+' : '-'} ${Math.abs(c) === 1 ? '' : Math.abs(c)}${body}`;
    const rootTex = v => v === 0.5 ? '\\tfrac{1}{2}' : v === -0.5 ? '-\\tfrac{1}{2}' : String(v);
    if (rng() < 0.5) {
      const r1 = rc(rng, [1, -1, 0]);
      const r2 = rc(rng, [1, -1, 0.5, -0.5, 0].filter(v => v !== r1));
      const p = -2 * (r1 + r2), q = 1 + 2 * r1 * r2;
      const sols = [...new Set([...trigSolutionsDeg('cos', r1, dom[0], dom[1]), ...trigSolutionsDeg('cos', r2, dom[0], dom[1])])].sort((x, y) => x - y);
      const disc = p * p - 8 * q;
      const naive = disc < 0 ? [] : [(-p + Math.sqrt(disc)) / 4, (-p - Math.sqrt(disc)) / 4]
        .filter(c => Math.abs(c) <= 1)
        .flatMap(c => trigSolutionsDeg('cos', c, dom[0], dom[1]))
        .filter(x => !sols.includes(x));
      const lhs = `\\cos 2\\theta ${p === 0 ? '' : coefTex(p, '\\cos\\theta') + ' '}${q === 0 ? '' : sgn(q) + ' '}= 0`;
      const quad = `2c^2 ${p === 0 ? '' : coefTex(p, 'c') + ' '}${q - 1 === 0 ? '' : sgn(q - 1) + ' '}= 0`;
      return {
        prompt: `Solve $${lhs}$ for $${domainTex(dom)}$, using $\\cos 2\\theta = 2\\cos^2\\theta - 1$.`,
        answerType: 'set', answer: { values: sols, tol: 0.01 }, answerSuffix: '°',
        inputHint: 'e.g. 0, 120, 240, 360',
        traps: naive.length ? [{ value: naive[0], why: 'Do not drop the $-1$ in $\\cos 2\\theta = 2\\cos^2\\theta - 1$ — it changes the constant term of the quadratic and therefore both roots.' }] : [],
        hints: ['Replace $\\cos 2\\theta$ with $2\\cos^2\\theta - 1$ and let $c = \\cos\\theta$.', `The quadratic $${quad}$ has roots $c = ${rootTex(r1)}$ and $c = ${rootTex(r2)}$.`, `Solve each across the interval: $\\theta = ${sols.join('°, ')}°$.`],
        steps: [
          { h: 'Substitute the identity', d: `$2\\cos^2\\theta - 1 ${p === 0 ? '' : coefTex(p, '\\cos\\theta') + ' '}${q === 0 ? '' : sgn(q) + ' '}= 0$` },
          { h: 'Solve the quadratic', d: `$${quad}$ → $c = ${rootTex(r1)}$ or $c = ${rootTex(r2)}$` },
          { h: 'Back to angles', d: `$\\theta = ${sols.join('°, ')}°$` }
        ]
      };
    }
    const outer = rc(rng, ['sin', 'cos']);
    const inner = outer === 'sin' ? 'cos' : 'sin';
    const pick = rc(rng, [
      { v: 0.5, abs: '' }, { v: -0.5, abs: '' },
      { v: R2, abs: '\\sqrt{2}' }, { v: -R2, abs: '\\sqrt{2}' },
      { v: R3H, abs: '\\sqrt{3}' }, { v: -R3H, abs: '\\sqrt{3}' }
    ]);
    const neg = pick.v < 0;
    const rhsTex = `${neg ? '-' : ''}${pick.abs}\\${outer}\\theta`;
    const facTex = `2\\${inner}\\theta ${neg ? '+' : '-'} ${pick.abs || '1'}`;
    const zeros = trigSolutionsDeg(outer, 0, dom[0], dom[1]);
    const others = trigSolutionsDeg(inner, pick.v, dom[0], dom[1]);
    const sols = [...new Set([...zeros, ...others])].sort((x, y) => x - y);
    return {
      prompt: `Solve $\\sin 2\\theta = ${rhsTex}$ for $${domainTex(dom)}$, using $\\sin 2\\theta = 2\\sin\\theta\\cos\\theta$.`,
      answerType: 'set', answer: { values: sols, tol: 0.01 }, answerSuffix: '°',
      inputHint: 'e.g. 0, 60, 180, 300, 360',
      traps: [],
      hints: [`Substitute the identity: $2\\sin\\theta\\cos\\theta = ${rhsTex}$.`, `Factor out $\\${outer}\\theta$: $\\${outer}\\theta\\left(${facTex}\\right) = 0$.`, `So $\\${outer}\\theta = 0$ or $\\${inner}\\theta = ${neg ? '-' : ''}${pick.abs ? `\\tfrac{${pick.abs}}{2}` : '\\tfrac{1}{2}'}$: $\\theta = ${sols.join('°, ')}°$.`],
      steps: [
        { h: 'Substitute the identity', d: `$2\\sin\\theta\\cos\\theta ${neg ? '+' : '-'} ${pick.abs || '1'}\\${outer}\\theta = 0$` },
        { h: 'Factorise', d: `$\\${outer}\\theta\\left(${facTex}\\right) = 0$` },
        { h: 'Solve both factors', d: `$\\${outer}\\theta = 0$ gives $${zeros.join('°, ')}°$; $\\${inner}\\theta = ${neg ? '-' : ''}${pick.abs ? `\\tfrac{${pick.abs}}{2}` : '\\tfrac{1}{2}'}$ gives $${others.join('°, ')}°$` },
        { h: 'All solutions', d: `$\\theta = ${sols.join('°, ')}°$` }
      ]
    };
  },
  // ── ME-C2/C3 · Further calculus ──────────────────────────────────────────
  'me12-calc': (rng, diff) => {
    if (diff === 1) {
      const c = ri(rng, 1, 9), n = ri(rng, 2, 5), a = ri(rng, 2, 6);
      const inner = `x^2 ${sgn(c)}`;
      return {
        prompt: `Use the substitution $u = ${inner}$ to find $\\displaystyle\\int ${2 * a}x\\,(${inner})^{${n}}\\,dx$. (You may omit +C.)`,
        answerType: 'expression', answer: { expr: `${a}*(x^2 + ${c})^${n + 1}/${n + 1}`, stripC: true },
        inputHint: `e.g. (x^2 + ${c})^${n + 1}/${n + 1}`,
        traps: [{ expr: `${2 * a}x(x^2 + ${c})^${n + 1}/${n + 1}`, why: `The $${2 * a}x$ IS $\\frac{du}{dx}$ up to a constant — it disappears into the substitution.` }],
        hints: [`With $u = ${inner}$, $du = 2x\\,dx$.`, `The integral becomes $${a}\\int u^{${n}}\\,du$.`, `$= \\frac{${a}u^{${n + 1}}}{${n + 1}}$, then substitute back.`],
        steps: [
          { h: 'Substitute', d: `$u = ${inner} \\Rightarrow du = 2x\\,dx$` },
          { h: 'Integrate in u', d: `$${a}\\int u^{${n}}du = \\dfrac{${a}u^{${n + 1}}}{${n + 1}}$` },
          { h: 'Back-substitute', d: `$\\dfrac{${a}(${inner})^{${n + 1}}}{${n + 1}} + C$` }
        ]
      };
    }
    if (diff === 2) {
      const c = ri(rng, 1, 6), hi = ri(rng, 1, 4), n = ri(rng, 1, 3);
      const uLo = c, uHi = hi * hi + c;
      const exact = (uHi ** (n + 1) - uLo ** (n + 1)) / (n + 1);
      return {
        prompt: `Evaluate $\\displaystyle\\int_0^{${hi}} 2x(x^2 + ${c})^{${n}}\\,dx$ using the substitution $u = x^2 + ${c}$.`,
        answerType: 'numeric', answer: { value: exact },
        traps: [{ value: (uHi ** (n + 1) - 0) / (n + 1), why: `Change the limits too: when $x = 0$, $u = ${c}$ — not 0.` }].filter(t => t.value !== exact),
        hints: [`Change the limits: $x = 0 \\to u = ${uLo}$; $x = ${hi} \\to u = ${uHi}$.`, `$\\int_{${uLo}}^{${uHi}} u^{${n}}\\,du$.`, `$= \\left[\\frac{u^{${n + 1}}}{${n + 1}}\\right]_{${uLo}}^{${uHi}}$.`],
        steps: [
          { h: 'New limits', d: `$x: 0 \\to ${hi}$ becomes $u: ${uLo} \\to ${uHi}$` },
          { h: 'Integrate', d: `$\\int_{${uLo}}^{${uHi}} u^{${n}}du = \\left[\\tfrac{u^{${n + 1}}}{${n + 1}}\\right]_{${uLo}}^{${uHi}} = ${exact}$` }
        ]
      };
    }
    if (diff === 3) {
      const shape = ri(rng, 1, 3);
      if (shape === 1) {
        const b = rc(rng, [2, 4, 6, 8, 9, 10, 12]);
        const k = ri(rng, 1, 4);
        const coef = piFrac(k * b * b, 2);
        return {
          prompt: `The region under $y = ${k === 1 ? '' : `\\sqrt{${k}}`}\\sqrt{x}$ from $x = 0$ to $x = ${b}$ is rotated about the $x$-axis. Find the **exact** volume of the solid formed.`,
          answerType: 'numeric', answer: { value: coef.val, requireExact: true, canonicalInput: coef.typed },
          inputHint: 'e.g. 8pi',
          traps: [{ value: k * b * b / 2, why: 'Volumes of revolution carry a factor of π: $V = \\pi\\int y^2\\,dx$.', tol: 0.01 }],
          hints: [`$V = \\pi\\int_0^{${b}} y^2\\,dx$ with $y^2 = ${k === 1 ? 'x' : `${k}x`}$.`, `$\\pi\\int_0^{${b}} ${k === 1 ? 'x' : `${k}x`}\\,dx = \\pi\\left[\\frac{${k === 1 ? '' : k}x^2}{2}\\right]_0^{${b}}$.`, `$= ${coef.tex}$.`],
          steps: [
            { h: 'Volume formula', d: `$V = \\pi\\displaystyle\\int_0^{${b}} ${k === 1 ? 'x' : `${k}x`}\\,dx$` },
            { h: 'Evaluate', d: `$V = ${coef.tex}$` }
          ]
        };
      }
      if (shape === 2) {
        const m = ri(rng, 1, 5), b = ri(rng, 1, 4);
        const coef = piFrac(m * m * b ** 3, 3);
        return {
          prompt: `The region under $y = ${m === 1 ? '' : m}x$ from $x = 0$ to $x = ${b}$ is rotated about the $x$-axis, forming a cone. Find its **exact** volume.`,
          answerType: 'numeric', answer: { value: coef.val, requireExact: true, canonicalInput: coef.typed },
          inputHint: 'e.g. 9pi',
          traps: [{ value: m * m * b ** 3 / 3, why: 'Volumes of revolution carry a factor of π: $V = \\pi\\int y^2\\,dx$.', tol: 0.01 }],
          hints: [`$V = \\pi\\int_0^{${b}} (${m === 1 ? 'x' : `${m}x`})^2\\,dx$.`, `$= \\pi\\left[\\frac{${m * m}x^3}{3}\\right]_0^{${b}}$.`, `$= ${coef.tex}$.`],
          steps: [
            { h: 'Volume formula', d: `$V = \\pi\\displaystyle\\int_0^{${b}} ${m * m}x^2\\,dx$` },
            { h: 'Evaluate', d: `$V = ${coef.tex}$` }
          ]
        };
      }
      const r = ri(rng, 1, 5), lo = ri(rng, 1, 3), hi = lo + ri(rng, 1, 3);
      const coef = piFrac(r * r * (hi ** 3 - lo ** 3), 3);
      return {
        prompt: `The region between $y = ${r === 1 ? '' : r}x$ and the $x$-axis from $x = ${lo}$ to $x = ${hi}$ is rotated about the $x$-axis. Find the **exact** volume of the solid formed.`,
        answerType: 'numeric', answer: { value: coef.val, requireExact: true, canonicalInput: coef.typed },
        inputHint: 'e.g. 21pi',
        traps: [{ value: r * r * (hi ** 3 - lo ** 3) / 3, why: 'Do not lose the π: $V = \\pi\\int y^2\\,dx$.', tol: 0.01 }],
        hints: [`$V = \\pi\\int_{${lo}}^{${hi}} ${r * r}x^2\\,dx$.`, `$= \\pi\\left[\\frac{${r * r}x^3}{3}\\right]_{${lo}}^{${hi}}$.`, `$= ${coef.tex}$.`],
        steps: [
          { h: 'Volume formula', d: `$V = \\pi\\displaystyle\\int_{${lo}}^{${hi}} ${r * r}x^2\\,dx$` },
          { h: 'Evaluate', d: `$V = \\dfrac{${r * r}\\left(${hi}^3 - ${lo}^3\\right)\\pi}{3} = ${coef.tex}$` }
        ]
      };
    }
    const k = ri(rng, 1, 20);
    const a = ri(rng, 1, 4);
    const hi = ri(rng, 1, 4);
    const exact = 0.5 * a * Math.log((hi * hi + k) / k);
    return {
      prompt: `Evaluate $\\displaystyle\\int_0^{${hi}} \\dfrac{${a === 1 ? '' : a}x}{x^2 + ${k}}\\,dx$, correct to 3 decimal places. (Hint: the top is almost the derivative of the bottom.)`,
      answerType: 'numeric', answer: { value: r3(exact), tol: 0.002 },
      traps: [{ value: r3(a * Math.log((hi * hi + k) / k)), why: `The derivative of $x^2 + ${k}$ is $2x$ — you need a factor of $\\frac{1}{2}$ out the front.`, tol: 0.002 }].filter(t => Math.abs(t.value - r3(exact)) > 0.004),
      hints: [`$\\frac{d}{dx}(x^2 + ${k}) = 2x$, so write the top as $\\frac{${a}}{2}(2x)$.`, `$\\frac{${a}}{2}\\left[\\ln(x^2 + ${k})\\right]_0^{${hi}}$.`, `$= \\frac{${a}}{2}\\ln\\frac{${hi * hi + k}}{${k}}$.`],
      steps: [
        { h: 'Recognise the log form', d: `$\\int\\frac{f'(x)}{f(x)}dx = \\ln|f(x)|$` },
        { h: 'Adjust the constant', d: `$\\frac{${a}}{2}\\left[\\ln(x^2 + ${k})\\right]_0^{${hi}} = \\frac{${a}}{2}\\ln\\dfrac{${hi * hi + k}}{${k}}$` },
        { h: 'Evaluate', d: `$\\approx ${r3(exact)}$` }
      ]
    };
  },
  // ── ME-S1 · Binomial distribution ────────────────────────────────────────
  'me12-binomial': (rng, diff) => {
    const p = rc(rng, [0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4, 0.45, 0.5, 0.55, 0.6, 0.65, 0.7, 0.75, 0.8]);
    const n = ri(rng, 4, 12);
    if (diff === 1) {
      const k = ri(rng, 1, n - 1);
      const val = nCr(n, k) * p ** k * (1 - p) ** (n - k);
      return {
        prompt: `A free-throw shooter scores with probability $${p}$. In $${n}$ independent shots, find $P(\\text{exactly } ${k} \\text{ scores})$, correct to 4 decimal places.`,
        answerType: 'numeric', answer: { value: Math.round(val * 10000) / 10000, tol: 0.0006 },
        traps: [{ value: Math.round(p ** k * (1 - p) ** (n - k) * 10000) / 10000, why: `Include the $\\binom{${n}}{${k}}$ ways to choose WHICH shots score.`, tol: 0.0006 }],
        hints: ['Binomial: $P(X{=}k) = \\binom{n}{k}p^k(1-p)^{n-k}$.', `$\\binom{${n}}{${k}} = ${nCr(n, k)}$.`, `$${nCr(n, k)} \\times ${p}^{${k}} \\times ${1 - p}^{${n - k}}$.`],
        steps: [
          { h: 'Binomial formula', d: `$P = \\binom{${n}}{${k}}(${p})^{${k}}(${r2(1 - p)})^{${n - k}}$` },
          { h: 'Evaluate', d: `$\\approx ${Math.round(val * 10000) / 10000}$` }
        ]
      };
    }
    if (diff === 2) {
      return {
        prompt: `$X$ is binomial with $n = ${n}$ trials and success probability $p = ${p}$. Find the **mean** $E(X)$.`,
        answerType: 'numeric', answer: { value: r2(n * p), tol: 0.011 },
        traps: [{ value: r2(n * p * (1 - p)), why: '$np(1-p)$ is the *variance* — the mean is $np$.', tol: 0.011 }],
        hints: ['Mean of a binomial: $np$.', `$${n} \\times ${p}$.`, `= ${r2(n * p)}.`],
        steps: [{ h: 'Mean', d: `$E(X) = np = ${n} \\times ${p} = ${r2(n * p)}$` }]
      };
    }
    if (diff === 3) {
      const sd = Math.sqrt(n * p * (1 - p));
      return {
        prompt: `For a binomial variable with $n = ${n}$, $p = ${p}$, find the **standard deviation**, correct to 2 decimal places.`,
        answerType: 'numeric', answer: { value: r2(sd), tol: 0.011 },
        traps: [{ value: r2(n * p * (1 - p)), why: 'That’s the variance — take its square root for σ.', tol: 0.011 }],
        hints: ['Variance $= np(1-p)$.', `$= ${r2(n * p * (1 - p))}$.`, 'σ = √variance.'],
        steps: [
          { h: 'Variance', d: `$np(1-p) = ${r2(n * p * (1 - p))}$` },
          { h: 'Standard deviation', d: `$\\sqrt{${r2(n * p * (1 - p))}} \\approx ${r2(sd)}$` }
        ]
      };
    }
    const val = 1 - (1 - p) ** n;
    return {
      prompt: `A archer hits gold with probability $${p}$ per arrow. Over $${n}$ arrows, find $P(\\text{at least one gold})$, correct to 4 decimal places.`,
      answerType: 'numeric', answer: { value: Math.round(val * 10000) / 10000, tol: 0.0006 },
      traps: [{ value: Math.round(p ** n * 10000) / 10000, why: '“At least one” is 1 − P(none): $1 - (1-p)^n$.', tol: 0.0006 }],
      hints: ['Use the complement: P(at least one) = 1 − P(none).', `P(none) $= (${r2(1 - p)})^{${n}}$.`, 'Subtract from 1.'],
      steps: [
        { h: 'Complement', d: `$P(\\text{none}) = (${r2(1 - p)})^{${n}} = ${Math.round((1 - p) ** n * 10000) / 10000}$` },
        { h: 'At least one', d: `$1 - ${Math.round((1 - p) ** n * 10000) / 10000} = ${Math.round(val * 10000) / 10000}$` }
      ]
    };
  },

  // ── ME-V1 · Projectile motion (g = 10) ───────────────────────────────────
  'me12-projectile': (rng, diff) => {
    const v = ri(rng, 12, 45);
    const th = rc(rng, [15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75]);
    const g = 10;
    if (diff === 1) {
      const vx = v * Math.cos(rad(th));
      return {
        prompt: `A ball is kicked at $${v}$ m/s at $${th}°$ above the horizontal. Taking $g = 10$ m/s², find the **horizontal** component of its initial velocity, correct to 1 decimal place.`,
        answerType: 'numeric', answer: { value: r1(vx), tol: 0.06 }, answerSuffix: 'm/s',
        traps: [{ value: r1(v * Math.sin(rad(th))), why: 'Horizontal uses cos; vertical uses sin.', tol: 0.06 }],
        hints: ['Resolve: $v_x = v\\cos\\theta$.', `$${v}\\cos(${th}°)$.`, 'Evaluate.'],
        steps: [{ h: 'Resolve horizontally', d: `$v_x = ${v}\\cos(${th}°) \\approx ${r1(vx)}$ m/s` }]
      };
    }
    if (diff === 2) {
      const t = 2 * v * Math.sin(rad(th)) / g;
      return {
        prompt: `For the same projectile ($${v}$ m/s at $${th}°$, $g = 10$), find the **time of flight** on level ground, correct to 2 decimal places.`,
        answerType: 'numeric', answer: { value: r2(t), tol: 0.011 }, answerSuffix: 's',
        traps: [{ value: r2(v * Math.sin(rad(th)) / g), why: 'That’s the time to the TOP — flight time is twice that.', tol: 0.011 }],
        hints: ['Flight ends when the vertical velocity has fully reversed.', `$T = \\frac{2v\\sin\\theta}{g}$.`, `$\\frac{2 \\times ${v}\\sin(${th}°)}{10}$.`],
        steps: [{ h: 'Time of flight', d: `$T = \\dfrac{2(${v})\\sin(${th}°)}{10} \\approx ${r2(t)}$ s` }]
      };
    }
    if (diff === 3) {
      const range = v * v * Math.sin(rad(2 * th)) / g;
      return {
        prompt: `Find the **range** of the projectile ($${v}$ m/s at $${th}°$, $g = 10$) on level ground, correct to 1 decimal place.`,
        answerType: 'numeric', answer: { value: r1(range), tol: 0.07 }, answerSuffix: 'm',
        traps: [{ value: r1(v * v * Math.sin(rad(th)) / g), why: 'The range formula uses $\\sin 2\\theta$.', tol: 0.07 }],
        hints: ['$R = \\frac{v^2\\sin 2\\theta}{g}$.', `$\\sin(${2 * th}°) = ${r3(Math.sin(rad(2 * th)))}$.`, 'Evaluate.'],
        steps: [{ h: 'Range', d: `$R = \\dfrac{${v}^2\\sin(${2 * th}°)}{10} \\approx ${r1(range)}$ m` }]
      };
    }
    const H = (v * Math.sin(rad(th))) ** 2 / (2 * g);
    return {
      prompt: `Find the **greatest height** reached by the projectile ($${v}$ m/s at $${th}°$, $g = 10$), correct to 1 decimal place.`,
      answerType: 'numeric', answer: { value: r1(H), tol: 0.07 }, answerSuffix: 'm',
      traps: [{ value: r1(v * v / (2 * g)), why: 'Only the *vertical* component climbs: $H = \\frac{(v\\sin\\theta)^2}{2g}$.', tol: 0.07 }],
      hints: ['At the top, vertical velocity is zero.', `$H = \\frac{(v\\sin\\theta)^2}{2g}$.`, `$v\\sin\\theta = ${r2(v * Math.sin(rad(th)))}$.`],
      steps: [
        { h: 'Vertical component', d: `$v_y = ${v}\\sin(${th}°) = ${r2(v * Math.sin(rad(th)))}$` },
        { h: 'Greatest height', d: `$H = \\dfrac{(${r2(v * Math.sin(rad(th)))})^2}{20} \\approx ${r1(H)}$ m` }
      ]
    };
  },

  // ── MEX-P1/P2 · Nature of proof ──────────────────────────────────────────
  'mex-proof': (rng, diff) => {
    const isPrime = v => {
      if (v < 2) return false;
      for (let d = 2; d * d <= v; d++) if (v % d === 0) return false;
      return true;
    };
    if (diff === 1) {
      if (rng() < 0.18) {
        const m = mcq(rng, `$n = 41$ — then $n^2 + n + 41 = 41 \\times 43$, which is composite`, [
          { text: '$n = 1$ — it gives 43, which is prime', why: 'A prime output doesn’t disprove anything — you need a case where the claim FAILS.' },
          { text: 'No counterexample exists; the statement is true', why: 'Try n = 41: every term is divisible by 41.' },
          { text: '$n = 0$ — it gives 41, which is prime' }
        ]);
        return {
          prompt: `A student claims "$n^2 + n + 41$ is prime for every positive integer $n$". Which choice of $n$ provides a **counterexample**?`,
          answerType: 'mcq', answer: { correctIndex: m.correctIndex, optionTraps: m.optionTraps }, mcqOptions: m.options,
          hints: ['A counterexample makes the statement false.', 'Look for a value making every term share a factor.', 'n = 41 gives 41² + 41 + 41 = 41(41 + 1 + 1).'],
          steps: [{ h: 'Counterexample', d: `At $n = 41$: $41^2 + 41 + 41 = 41(43)$ — composite, so the claim is false.` }]
        };
      }
      const q = rc(rng, [5, 11, 17, 41]);
      const minus = rc(rng, [true, false]);
      const expr = n => n * n + (minus ? -n : n) + q;
      const exprTex = `n^2 ${minus ? '-' : '+'} n + ${q}`;
      if (rng() < 0.55) {
        const m = ri(rng, 1, 16);
        const val = expr(m);
        return {
          prompt: `A student claims "$${exprTex}$ is prime for every positive integer $n$". Test the claim at $n = ${m}$: what value does $${exprTex}$ take there?`,
          answerType: 'numeric', answer: { value: val },
          traps: [{ value: m * m + q, why: `Do not skip the middle term — remember to ${minus ? 'subtract' : 'add'} $n = ${m}$ as well.` }].filter(t => t.value !== val),
          hints: [`Substitute $n = ${m}$ one term at a time.`, `$${m}^2 = ${m * m}$.`, `$${m * m} ${minus ? '-' : '+'} ${m} + ${q} = ${val}$.`],
          steps: [
            { h: 'Substitute', d: `$${m}^2 ${minus ? '-' : '+'} ${m} + ${q} = ${val}$` },
            { h: 'Is it prime?', d: isPrime(val) ? `$${val}$ is prime, so $n = ${m}$ is **not** a counterexample — one case can never prove the claim either.` : `$${val}$ is composite, so $n = ${m}$ **is** a counterexample and the claim is false.` }
          ]
        };
      }
      let first = 1;
      while (isPrime(expr(first)) && first < 200) first++;
      return {
        prompt: `A student claims "$${exprTex}$ is prime for every positive integer $n$". Find the **smallest** positive integer $n$ for which the claim fails.`,
        answerType: 'numeric', answer: { value: first },
        traps: [{ value: expr(first), why: `That is the composite *value* — the question asks for the input $n$ that produces it.` }],
        hints: ['Work upwards from $n = 1$, testing each output for primality.', `A value of $n$ that makes every term share a factor is a good suspect.`, `The first failure is at $n = ${first}$, where the expression is $${expr(first)}$.`],
        steps: [
          { h: 'Test small values', d: `$n = 1, 2, 3, \\ldots$ all give primes until $n = ${first}$` },
          { h: 'The counterexample', d: `At $n = ${first}$: $${exprTex} = ${expr(first)}$, which is composite` }
        ]
      };
    }
    if (diff === 2) {
      if (rng() < 0.18) {
        const m = mcq(rng, `Assume $\\sqrt{2} = \\frac{p}{q}$ in lowest terms, then derive that both p and q are even — contradiction`, [
          { text: 'Assume √2 is rational and show the assumption is never used', why: 'The contradiction must FOLLOW from the assumption — both p, q even contradicts "lowest terms".' },
          { text: 'Check √2 on a calculator and observe the decimals never repeat', why: 'A finite decimal check can never prove irrationality.' },
          { text: 'Assume √2 is irrational and find a contradiction' }
        ]);
        return {
          prompt: `Which outline correctly describes the classic **proof by contradiction** that $\\sqrt{2}$ is irrational?`,
          answerType: 'mcq', answer: { correctIndex: m.correctIndex, optionTraps: m.optionTraps }, mcqOptions: m.options,
          hints: ['Contradiction: assume the OPPOSITE of what you want.', 'Assume rational, in lowest terms.', 'Derive both p and q even → contradicts lowest terms.'],
          steps: [
            { h: 'Assume the opposite', d: `$\\sqrt{2} = \\frac{p}{q}$, $\\gcd(p, q) = 1$` },
            { h: 'Derive', d: `$p^2 = 2q^2$ → p even → q even — contradicting lowest terms ∎` }
          ]
        };
      }
      if (rng() < 0.5) {
        const a = ri(rng, 2, 7), b = ri(rng, 1, 9);
        return {
          prompt: `A direct proof about the squares of the numbers $${a}n + ${b}$ begins by expanding. Write $(${a}n + ${b})^2$ in expanded, simplified form.`,
          answerType: 'expression', answer: { expr: `${a * a}*n^2 + ${2 * a * b}*n + ${b * b}` },
          inputHint: `e.g. ${a * a}n^2 + ${2 * a * b}n + ${b * b}`,
          traps: [{ expr: `${a * a}*n^2 + ${b * b}`, why: `Squaring a sum is not squaring each part — the cross term $2\\times${a}n\\times${b} = ${2 * a * b}n$ belongs there too.` }],
          hints: ['Use $(A + B)^2 = A^2 + 2AB + B^2$.', `$A = ${a}n$, $B = ${b}$.`, `$A^2 = ${a * a}n^2$, $2AB = ${2 * a * b}n$, $B^2 = ${b * b}$.`],
          steps: [
            { h: 'Square the binomial', d: `$(${a}n + ${b})^2 = (${a}n)^2 + 2(${a}n)(${b}) + ${b}^2$` },
            { h: 'Simplify', d: `$= ${a * a}n^2 + ${2 * a * b}n + ${b * b}$` },
            { h: 'What it shows', d: `Every term but $${b * b}$ carries a factor of $n$, which is what the divisibility argument needs.` }
          ]
        };
      }
      const m = ri(rng, 2, 9);
      const c = m * (m - 1) / 2;
      return {
        prompt: `A direct proof starts by writing the sum of $${m}$ consecutive integers, the smallest being $n$. Write that sum as a simplified expression in $n$.`,
        answerType: 'expression', answer: { expr: `${m}*n + ${c}` },
        inputHint: `e.g. ${m}n + ${c}`,
        traps: [{ expr: `${m}*n`, why: `The terms are $n, n+1, \\ldots, n+${m - 1}$ — the constants add to $1 + 2 + \\cdots + ${m - 1} = ${c}$.` }],
        hints: [`The terms are $n, n+1, \\ldots, n + ${m - 1}$.`, `There are ${m} copies of $n$.`, `The constants sum to $\\frac{${m - 1}\\times${m}}{2} = ${c}$.`],
        steps: [
          { h: 'List the terms', d: `$n + (n+1) + \\cdots + (n + ${m - 1})$` },
          { h: 'Collect', d: `$= ${m}n + (1 + 2 + \\cdots + ${m - 1}) = ${m}n + ${c}$` },
          { h: 'What it shows', d: c % m === 0 ? `Every such sum is a multiple of $${m}$ ∎` : `The sum is $${m}n + ${c}$ — a multiple of $${m}$ only when $${c}$ is, so the claim needs care.` }
        ]
      };
    }
    if (diff === 3) {
      const shape = ri(rng, 1, 3);
      if (shape === 1) {
        const a = ri(rng, 1, 4), k = ri(rng, 1, 9);
        const lead = a === 1 ? '' : a;
        return {
          prompt: `A divisibility proof hinges on factoring $${lead}n^3 - ${a * k * k === 1 ? '' : a * k * k}n$ completely. Write it as a product of ${a === 1 ? 'three' : 'a constant and three'} factors.`,
          answerType: 'expression', answer: { expr: `${a}*(n - ${k})*n*(n + ${k})`, anyOf: [`${a}*n*(n^2 - ${k * k})`] },
          inputHint: `e.g. ${a === 1 ? '' : a}(n - ${k})n(n + ${k})`,
          traps: [{ expr: `${a}*n*(n^2 + ${k * k})`, why: 'The expression has a minus sign, so the bracket is a **difference** of two squares.' }],
          hints: [`Take out the common factor $${a === 1 ? 'n' : `${a}n`}$ first.`, `$${lead}n(n^2 - ${k * k})$.`, 'Now apply the difference of two squares.'],
          steps: [
            { h: 'Common factor', d: `$${lead}n^3 - ${a * k * k}n = ${lead}n(n^2 - ${k * k})$` },
            { h: 'Difference of squares', d: `$= ${lead}(n - ${k})\\,n\\,(n + ${k})$` },
            { h: 'Why it helps', d: k === 1 ? 'Three consecutive integers always contain a multiple of 2 and a multiple of 3, so the product is divisible by 6.' : `The three factors are spaced ${k} apart, which is what the divisibility argument exploits.` }
          ]
        };
      }
      if (shape === 2) {
        const a = ri(rng, 2, 6), b = ri(rng, 1, 6);
        return {
          prompt: `Simplify $(${a}n + ${b})^2 - (${a}n - ${b})^2$ into the form $kn$, the key step in showing the expression is always a multiple of $${4 * a * b}$.`,
          answerType: 'expression', answer: { expr: `${4 * a * b}*n` },
          inputHint: `e.g. ${4 * a * b}n`,
          traps: [{ expr: `${2 * a * b}*n`, why: 'Both cross terms survive: $(A+B)^2 - (A-B)^2 = 4AB$, not $2AB$.' }],
          hints: ['Use the difference of two squares on the whole expression.', `$\\left[(${a}n + ${b}) - (${a}n - ${b})\\right]\\left[(${a}n + ${b}) + (${a}n - ${b})\\right]$.`, `$= (${2 * b})(${2 * a}n) = ${4 * a * b}n$.`],
          steps: [
            { h: 'Difference of two squares', d: `$= \\left[${2 * b}\\right]\\left[${2 * a}n\\right]$` },
            { h: 'Simplify', d: `$= ${4 * a * b}n$ — a multiple of $${4 * a * b}$ for every integer $n$ ∎` }
          ]
        };
      }
      const a = ri(rng, 1, 8);
      return {
        prompt: `Factor $n^3 + ${3 * a}n^2 + ${3 * a * a}n + ${a ** 3}$ completely — the identity behind a proof about perfect cubes.`,
        answerType: 'expression', answer: { expr: `(n + ${a})^3`, anyOf: [`(n + ${a})*(n + ${a})*(n + ${a})`] },
        inputHint: `e.g. (n + ${a})^3`,
        traps: [{ expr: `(n + ${a * a * a})^3`, why: `The constant term is $${a}^3$, so the repeated factor is $(n + ${a})$, not $(n + ${a ** 3})$.` }],
        hints: ['Compare with the expansion $(n + c)^3 = n^3 + 3cn^2 + 3c^2n + c^3$.', `Here $3c = ${3 * a}$.`, `So $c = ${a}$.`],
        steps: [
          { h: 'Match the cube expansion', d: `$(n + c)^3 = n^3 + 3cn^2 + 3c^2n + c^3$` },
          { h: 'Read off c', d: `$3c = ${3 * a} \\Rightarrow c = ${a}$, and $c^3 = ${a ** 3}$ ✓` },
          { h: 'Factored form', d: `$(n + ${a})^3$` }
        ]
      };
    }
    const a = ri(rng, 2, 12), b = ri(rng, 2, 12);
    const gap = (a + b) / 2 - Math.sqrt(a * b);
    return {
      prompt: `The AM–GM inequality says $\\frac{a+b}{2} \\ge \\sqrt{ab}$. Verify it for $a = ${a}$, $b = ${b}$: compute $\\frac{a+b}{2} - \\sqrt{ab}$, correct to 3 decimal places.`,
      answerType: 'numeric', answer: { value: r3(gap), tol: 0.002 },
      traps: [{ value: r3(Math.sqrt(a * b) - (a + b) / 2), why: 'AM − GM should be ≥ 0 — subtract the geometric mean FROM the arithmetic mean.', tol: 0.002 }].filter(t => Math.abs(t.value - r3(gap)) > 0.004),
      hints: [`AM $= \\frac{${a} + ${b}}{2} = ${(a + b) / 2}$.`, `GM $= \\sqrt{${a * b}} = ${r3(Math.sqrt(a * b))}$.`, 'Subtract.'],
      steps: [
        { h: 'Arithmetic mean', d: `$${(a + b) / 2}$` },
        { h: 'Geometric mean', d: `$\\sqrt{${a * b}} \\approx ${r3(Math.sqrt(a * b))}$` },
        { h: 'Gap (≥ 0 ✓)', d: `$${r3(gap)}$` }
      ]
    };
  },
  // ── MEX-N1 · Complex numbers ─────────────────────────────────────────────
  'mex-complex': (rng, diff) => {
    const a = nz(rng, -5, 5), b = nz(rng, -5, 5), c = nz(rng, -5, 5), d = nz(rng, -5, 5);
    if (diff === 1) {
      return {
        prompt: `Let $z = ${a} ${sgn(b)}i$ and $w = ${c} ${sgn(d)}i$. Find $z + w$, as a point $(\\text{Re}, \\text{Im})$.`,
        answerType: 'point', answer: { x: a + c, y: b + d },
        inputHint: 'e.g. (3, -2)',
        traps: [{ why: 'Add real parts together and imaginary parts together.' }],
        hints: ['Real with real, imaginary with imaginary.', `Re: $${a} + ${c}$; Im: $${b} + ${d}$.`, `$(${a + c}, ${b + d})$.`],
        steps: [{ h: 'Add componentwise', d: `$z + w = ${a + c} ${sgn(b + d)}i$ → $(${a + c}, ${b + d})$` }]
      };
    }
    if (diff === 2) {
      const re = a * c - b * d, im = a * d + b * c;
      return {
        prompt: `Let $z = ${a} ${sgn(b)}i$ and $w = ${c} ${sgn(d)}i$. Find $zw$, as a point $(\\text{Re}, \\text{Im})$.`,
        answerType: 'point', answer: { x: re, y: im },
        inputHint: 'e.g. (3, -2)',
        traps: [{ why: 'Expand with FOIL and use $i^2 = -1$: Re $= ac - bd$, Im $= ad + bc$.' }],
        hints: ['Expand like binomials, then use $i^2 = -1$.', `Re: $${a}\\cdot${c} - ${b}\\cdot${d} = ${re}$.`, `Im: $${a}\\cdot${d} + ${b}\\cdot${c} = ${im}$.`],
        steps: [
          { h: 'Expand', d: `$(${a} ${sgn(b)}i)(${c} ${sgn(d)}i) = ${a * c} ${sgn(a * d)}i ${sgn(b * c)}i ${sgn(b * d)}i^2$` },
          { h: 'Use i² = −1', d: `Re $= ${a * c} - (${b * d}) = ${re}$, Im $= ${a * d} + ${b * c} = ${im}$` }
        ]
      };
    }
    if (diff === 3) {
      const k = ri(rng, 1, 6);
      const shape = rc(rng, [
        { re: `${k}`, im: `${k === 1 ? '' : k}`, reV: k, imV: k, mod: k === 1 ? 'sqrt(2)' : `${k}sqrt(2)`, modTex: k === 1 ? '\\sqrt{2}' : `${k}\\sqrt{2}`, modV: k * Math.SQRT2, t: 3 },
        { re: `${k}`, im: `${k === 1 ? '' : k}\\sqrt{3}`, reV: k, imV: k * Math.sqrt(3), mod: `${2 * k}`, modTex: `${2 * k}`, modV: 2 * k, t: 4 },
        { re: `${k === 1 ? '' : k}\\sqrt{3}`, im: `${k}`, reV: k * Math.sqrt(3), imV: k, mod: `${2 * k}`, modTex: `${2 * k}`, modV: 2 * k, t: 2 }
      ]);
      const sRe = rc(rng, [1, -1]), sIm = rc(rng, [1, -1]);
      const t = sRe > 0 ? (sIm > 0 ? shape.t : -shape.t) : (sIm > 0 ? 12 - shape.t : shape.t - 12);
      const argF = piFrac(t, 12);
      const zTex = `${sRe < 0 ? '-' : ''}${shape.re} ${sIm < 0 ? '-' : '+'} ${shape.im}i`;
      const wantArg = rc(rng, [true, false]);
      const quad = sRe > 0 ? (sIm > 0 ? 'first' : 'fourth') : (sIm > 0 ? 'second' : 'third');
      return {
        prompt: `Find the ${wantArg ? 'principal **argument**' : '**modulus**'} of $z = ${zTex}$, exactly${wantArg ? ' (in radians)' : ''}.`,
        answerType: 'numeric',
        answer: wantArg
          ? { value: argF.val, requireExact: true, canonicalInput: argF.typed }
          : { value: shape.modV, requireExact: true, canonicalInput: shape.mod },
        inputHint: wantArg ? 'e.g. 3pi/4' : 'e.g. 2sqrt(2)',
        traps: wantArg
          ? [{ value: piFrac(shape.t, 12).val, why: `That is only the reference angle — $z$ lies in the ${quad} quadrant, so adjust it.`, tol: 0.001 }].filter(x => Math.abs(x.value - argF.val) > 0.002)
          : [{ value: Math.abs(shape.reV) + Math.abs(shape.imV), why: 'The modulus is $\\sqrt{x^2 + y^2}$, not $|x| + |y|$.', tol: 0.001 }],
        hints: [
          wantArg ? 'The argument is the angle from the positive real axis, taken in $(-\\pi, \\pi]$.' : '$|z| = \\sqrt{x^2 + y^2}$.',
          `Plot $${zTex}$ — it lies in the ${quad} quadrant.`,
          wantArg ? `$\\arg z = ${argF.tex}$.` : `$|z| = ${shape.modTex}$.`
        ],
        steps: [
          { h: 'Plot z', d: `$z = ${zTex}$ sits in the ${quad} quadrant` },
          wantArg
            ? { h: 'Argument', d: `Reference angle $${piFrac(shape.t, 12).tex}$ → $\\arg z = ${argF.tex}$` }
            : { h: 'Modulus', d: `$|z| = ${shape.modTex}$` }
        ]
      };
    }
    const den = c * c + d * d;
    const re = new Frac(a * c + b * d, den), im = new Frac(b * c - a * d, den);
    return {
      prompt: `Find $\\dfrac{${a} ${sgn(b)}i}{${c} ${sgn(d)}i}$ in the form $x + yi$. Enter the **real part** as a fraction in simplest form.`,
      answerType: 'numeric', answer: { value: re.value, simplestFraction: re.d === 1 ? undefined : { n: re.n, d: re.d } },
      inputHint: re.d === 1 ? 'a whole number' : 'e.g. 3/13',
      traps: [{ value: a / c, why: 'Multiply top and bottom by the conjugate of the denominator first.' }].filter(t => Math.abs(t.value - re.value) > 0.01),
      hints: ['Multiply by the conjugate over itself.', `$\\times \\frac{${c} ${sgn(-d)}i}{${c} ${sgn(-d)}i}$; denominator becomes $${den}$.`, `Real part: $\\frac{${a * c + b * d}}{${den}}$.`],
      steps: [
        { h: 'Multiply by the conjugate', d: `denominator $= ${c}^2 + ${d}^2 = ${den}$` },
        { h: 'Numerator real part', d: `$${a}\\cdot${c} + ${b}\\cdot${d} = ${a * c + b * d}$` },
        { h: 'Real part', d: `$${re.latex()}$` }
      ]
    };
  },

  // ── MEX-N1 · De Moivre ───────────────────────────────────────────────────
  'mex-demoivre': (rng, diff) => {
    // Complex numbers with an exact modulus and an argument in twelfths of π.
    const EXACT_Z = [
      { z: '1 + i', mod: 'sqrt(2)', modTex: '\\sqrt{2}', modV: Math.SQRT2, t: 3 },
      { z: '1 - i', mod: 'sqrt(2)', modTex: '\\sqrt{2}', modV: Math.SQRT2, t: -3 },
      { z: '-1 + i', mod: 'sqrt(2)', modTex: '\\sqrt{2}', modV: Math.SQRT2, t: 9 },
      { z: '\\sqrt{3} + i', mod: '2', modTex: '2', modV: 2, t: 2 },
      { z: '1 + \\sqrt{3}i', mod: '2', modTex: '2', modV: 2, t: 4 },
      { z: '\\sqrt{3} - i', mod: '2', modTex: '2', modV: 2, t: -2 },
      { z: '-\\sqrt{3} + i', mod: '2', modTex: '2', modV: 2, t: 10 },
      { z: '2 + 2i', mod: '2sqrt(2)', modTex: '2\\sqrt{2}', modV: 2 * Math.SQRT2, t: 3 },
      { z: '3 + 3i', mod: '3sqrt(2)', modTex: '3\\sqrt{2}', modV: 3 * Math.SQRT2, t: 3 }
    ];
    if (diff === 1) {
      const th = rc(rng, [10, 12, 15, 18, 20, 24, 25, 30, 36, 40, 45]);
      const n = ri(rng, 2, 8);
      const wantArg = rng() < 0.6;
      const r = ri(rng, 2, 5);
      return wantArg ? {
        prompt: `Using De Moivre's theorem, $\\left(\\cos ${th}° + i\\sin ${th}°\\right)^{${n}}$ has argument equal to how many **degrees**?`,
        answerType: 'numeric', answer: { value: th * n }, answerSuffix: '°',
        traps: [{ value: th + n, why: 'De Moivre MULTIPLIES the argument by the power: $n\\theta$.' }],
        hints: ["De Moivre: $(\\text{cis}\\,\\theta)^n = \\text{cis}(n\\theta)$.", `$${n} \\times ${th}°$.`, `= ${th * n}°.`],
        steps: [{ h: "De Moivre's theorem", d: `argument $= ${n}\\theta = ${th * n}°$` }]
      } : {
        prompt: `Using De Moivre's theorem, find the **modulus** of $\\left[${r}\\left(\\cos ${th}° + i\\sin ${th}°\\right)\\right]^{${n}}$.`,
        answerType: 'numeric', answer: { value: r ** n },
        traps: [{ value: r * n, why: 'The modulus is raised to the power, not multiplied by it: $|z^n| = |z|^n$.' }],
        hints: ['De Moivre raises the modulus to the power and multiplies the argument.', `$|z| = ${r}$, so $|z^{${n}}| = ${r}^{${n}}$.`, `$= ${r ** n}$.`],
        steps: [{ h: "De Moivre's theorem", d: `$|z^{${n}}| = ${r}^{${n}} = ${r ** n}$` }]
      };
    }
    if (diff === 2) {
      const pick = rc(rng, EXACT_Z);
      const n = ri(rng, 2, 8);
      const wantArg = rng() < 0.5;
      const argF = piFrac(pick.t * n, 12);
      const modV = pick.modV ** n;
      const modTyped = pick.mod === '2' ? String(2 ** n)
        : pick.mod.includes('sqrt') ? `(${pick.mod})^${n}` : `${pick.mod}^${n}`;
      return wantArg ? {
        prompt: `Write $z = ${pick.z}$ in polar form and hence find the argument of $z^{${n}}$, in radians (this may lie outside $(-\\pi, \\pi]$).`,
        answerType: 'numeric', answer: { value: argF.val, requireExact: true, canonicalInput: argF.typed },
        inputHint: 'e.g. 3pi/4',
        traps: [{ value: piFrac(pick.t, 12).val, why: `De Moivre multiplies the argument by the index: $\\arg(z^{${n}}) = ${n}\\arg z$.`, tol: 0.001 }],
        hints: [`$\\arg z = ${piFrac(pick.t, 12).tex}$.`, `$\\arg(z^{${n}}) = ${n}\\arg z$.`, `$= ${argF.tex}$.`],
        steps: [
          { h: 'Polar form', d: `$z = ${pick.modTex}\\,\\text{cis}\\left(${piFrac(pick.t, 12).tex}\\right)$` },
          { h: "De Moivre's theorem", d: `$\\arg(z^{${n}}) = ${n} \\times ${piFrac(pick.t, 12).tex} = ${argF.tex}$` }
        ]
      } : {
        prompt: `Using polar form, find $\\left|\\,(${pick.z})^{${n}}\\,\\right|$ — the modulus of $(${pick.z})^{${n}}$.`,
        answerType: 'numeric', answer: { value: modV, requireExact: true, canonicalInput: modTyped },
        inputHint: 'e.g. 16 or (2sqrt(2))^3',
        traps: [{ value: pick.modV * n, why: `Moduli RAISE to the power: $|z^n| = |z|^n = (${pick.modTex})^{${n}}$.`, tol: 0.01 }],
        hints: [`$|${pick.z}| = ${pick.modTex}$.`, `$|z^n| = |z|^n = (${pick.modTex})^{${n}}$.`, `Evaluate it.`],
        steps: [
          { h: 'Modulus of z', d: `$${pick.modTex}$` },
          { h: 'Raise to the power', d: `$(${pick.modTex})^{${n}} = ${r3(modV)}$` }
        ]
      };
    }
    if (diff === 3) {
      const n = ri(rng, 3, 12);
      const j = ri(rng, 1, n - 1);
      const argF = piFrac(2 * j, n);
      return {
        prompt: `The $${n}$ roots of $z^{${n}} = 1$ are evenly spaced around the unit circle, starting at $z = 1$. Turning $${j}$ ${j === 1 ? 'step' : 'steps'} anticlockwise from $z = 1$ reaches another root — how far have you turned, exactly, in radians?`,
        answerType: 'numeric', answer: { value: argF.val, requireExact: true, canonicalInput: argF.typed },
        inputHint: 'e.g. 2pi/3',
        traps: [{ value: piFrac(j, n).val, why: `The roots are spaced $\\frac{2\\pi}{${n}}$ apart — a full turn shared between ${n} roots, not half a turn.`, tol: 0.001 }].filter(t => Math.abs(t.value - argF.val) > 0.002),
        hints: [`The ${n} roots sit at arguments $0, \\frac{2\\pi}{${n}}, \\frac{4\\pi}{${n}}, \\ldots$`, `Step ${j} is $${j} \\times \\frac{2\\pi}{${n}}$.`, `$= ${argF.tex}$.`],
        steps: [
          { h: `Roots of $z^{${n}} = 1$`, d: `arguments $\\frac{2k\\pi}{${n}}$ for $k = 0, 1, \\ldots, ${n - 1}$` },
          { h: 'The requested root', d: `$k = ${j}$ gives $${argF.tex}$` }
        ]
      };
    }
    const n = ri(rng, 2, 6);
    const base = ri(rng, 2, 15);
    const w = base ** n;
    return {
      prompt: `Solve $z^{${n}} = ${w}$ over the complex numbers. All $${n}$ solutions share the same **modulus** — what is it?`,
      answerType: 'numeric', answer: { value: base },
      traps: [
        { value: w / n, why: `Do not divide by ${n} — the modulus of every root of $z^{${n}} = ${w}$ is the ${n}th root of $|${w}|$.` },
        { value: w, why: `That is $|z^{${n}}|$, not $|z|$ — take the ${n}th root.` }
      ].filter(t => t.value !== base),
      hints: [`Take moduli of both sides: $|z|^{${n}} = ${w}$.`, `$|z| = \\sqrt[${n}]{${w}}$.`, `$= ${base}$.`],
      steps: [
        { h: 'Moduli', d: `$|z|^{${n}} = ${w}$` },
        { h: 'Take the root', d: `$|z| = ${base}$ (all ${n} roots, spaced $\\frac{2\\pi}{${n}}$ apart)` }
      ]
    };
  },

  // ── MEX-C1 · Further integration ─────────────────────────────────────────
  'mex-integration': (rng, diff) => {
    if (diff === 1) {
      const a = ri(rng, 1, 4), b = ri(rng, -4, 4), c = ri(rng, 1, 3);
      const lin = b === 0 ? 'x' : `(x ${sgn(b)})`;
      const aTex = a === 1 ? '' : a;
      const cTex = c === 1 ? '' : c;
      return {
        prompt: `Use integration by parts to find $\\displaystyle\\int ${cTex}${lin} e^{${aTex}x}\\,dx$. (Omit +C.)`,
        answerType: 'expression',
        answer: {
          expr: `${c}*e^(${a}*x)*((x + ${pn(b)})/${a} - 1/${a * a})`,
          anyOf: [`${c}*(${a}*x + ${pn(a * b - 1)})*e^(${a}*x)/${a * a}`],
          stripC: true
        },
        inputHint: 'e.g. (x - 1)e^x',
        traps: [{ expr: `${c}*(x + ${pn(b)})*e^(${a}*x)/${a}`, why: 'Parts leaves a second integral behind — the $-\\int v\\,du$ term is still missing.' }],
        hints: [`Parts: $u = ${cTex}${lin}$, $dv = e^{${aTex}x}dx$.`, `$v = \\frac{1}{${a}}e^{${aTex}x}$, so $uv = \\frac{${cTex}${lin}}{${a}}e^{${aTex}x}$.`, `Subtract $\\int \\frac{${c}}{${a}}e^{${aTex}x}dx = \\frac{${c}}{${a * a}}e^{${aTex}x}$.`],
        steps: [
          { h: 'Choose parts', d: `$u = ${cTex}${lin},\\ dv = e^{${aTex}x}dx \\Rightarrow du = ${c}\\,dx,\\ v = \\frac{1}{${a}}e^{${aTex}x}$` },
          { h: 'Apply the rule', d: `$uv - \\int v\\,du = \\frac{${cTex}${lin}}{${a}}e^{${aTex}x} - \\frac{${c}}{${a}}\\int e^{${aTex}x}dx$` },
          { h: 'Finish', d: `$= ${cTex}e^{${aTex}x}\\left(\\frac{x ${sgn(b)}}{${a}} - \\frac{1}{${a * a}}\\right)$` }
        ]
      };
    }
    if (diff === 2) {
      const a = rc(rng, [1, 2]);
      const hi = ri(rng, 1, a === 1 ? 4 : 2);
      const c = ri(rng, 1, 12);
      const F = x => c * Math.exp(a * x) * (x / a - 1 / (a * a));
      const val = F(hi) - F(0);
      const aTex = a === 1 ? '' : a;
      const cTex = c === 1 ? '' : c;
      return {
        prompt: `Evaluate $\\displaystyle\\int_0^{${hi}} ${cTex}x e^{${aTex}x}\\,dx$, correct to 3 decimal places.`,
        answerType: 'numeric', answer: { value: r3(val), tol: 0.002 },
        traps: [{ value: r3(F(hi)), why: 'Both limits matter — subtract the value of the antiderivative at $x = 0$, which is not zero here.', tol: 0.002 }].filter(t => Math.abs(t.value - r3(val)) > 0.004),
        hints: [`Integrate by parts to get $${cTex}e^{${aTex}x}\\left(\\frac{x}{${a}} - \\frac{1}{${a * a}}\\right)$.`, `At $x = 0$ the antiderivative is $-\\frac{${c}}{${a * a}}$.`, `Subtract that from the value at $x = ${hi}$.`],
        steps: [
          { h: 'Antiderivative', d: `$${cTex}e^{${aTex}x}\\left(\\frac{x}{${a}} - \\frac{1}{${a * a}}\\right)$` },
          { h: 'Evaluate', d: `$${r3(F(hi))} - (${r3(F(0))}) \\approx ${r3(val)}$` }
        ]
      };
    }
    if (diff === 3) {
      const p = ri(rng, 1, 5);
      const q = p + ri(rng, 1, 5);
      const hi = ri(rng, 1, 4);
      const val = 1 / (q - p) * Math.log(((hi + p) * q) / (p * (hi + q)));
      const naive = Math.log(((hi + p) * q) / (p * (hi + q)));
      return {
        prompt: `Using partial fractions, evaluate $\\displaystyle\\int_0^{${hi}} \\dfrac{1}{(x + ${p})(x + ${q})}\\,dx$, correct to 4 decimal places.`,
        answerType: 'numeric', answer: { value: Math.round(val * 10000) / 10000, tol: 0.0006 },
        traps: [{ value: Math.round(naive * 10000) / 10000, why: `Partial fractions bring a factor $\\frac{1}{${q} - ${p}}$ out the front.`, tol: 0.0006 }].filter(t => Math.abs(t.value - Math.round(val * 10000) / 10000) > 0.001),
        hints: [`$\\frac{1}{(x+${p})(x+${q})} = \\frac{1}{${q - p}}\\left(\\frac{1}{x+${p}} - \\frac{1}{x+${q}}\\right)$.`, `Integrate to logs and evaluate $0 \\to ${hi}$.`, `$\\frac{1}{${q - p}}\\ln\\frac{(${hi + p})\\,${q}}{${p}\\,(${hi + q})}$.`],
        steps: [
          { h: 'Partial fractions', d: `$\\frac{1}{${q - p}}\\left(\\frac{1}{x+${p}} - \\frac{1}{x+${q}}\\right)$` },
          { h: 'Integrate', d: `$\\frac{1}{${q - p}}\\left[\\ln\\frac{x+${p}}{x+${q}}\\right]_0^{${hi}}$` },
          { h: 'Evaluate', d: `$\\approx ${Math.round(val * 10000) / 10000}$` }
        ]
      };
    }
    const c = ri(rng, 1, 9);
    const cTex = c === 1 ? '' : c;
    if (rng() < 0.6) {
      const n = ri(rng, 1, 4);
      const m = n === 1 ? rc(rng, [1, 2]) : 1;
      const top = Math.exp(m * (n + 1));
      const val = c * (top * (m * (n + 1) - 1) + 1) / ((n + 1) * (n + 1));
      const upper = m === 1 ? 'e' : `e^{${m}}`;
      return {
        prompt: `Using integration by parts, evaluate $\\displaystyle\\int_1^{${upper}} ${cTex}x^{${n}}\\ln x\\,dx$, correct to 3 decimal places.`,
        answerType: 'numeric', answer: { value: r3(val), tol: 0.002 },
        traps: [{ value: r3(c * top * m / (n + 1)), why: `Parts with $u = \\ln x$ leaves a second integral $\\int \\frac{x^{${n}}}{${n + 1}}dx$ to subtract.`, tol: 0.002 }].filter(t => Math.abs(t.value - r3(val)) > 0.004),
        hints: [`$u = \\ln x$, $dv = ${cTex}x^{${n}}dx$.`, `Antiderivative: $${cTex}\\left(\\frac{x^{${n + 1}}}{${n + 1}}\\ln x - \\frac{x^{${n + 1}}}{${(n + 1) ** 2}}\\right)$.`, `Evaluate between $1$ and $${upper}$.`],
        steps: [
          { h: 'Parts', d: `$u = \\ln x,\\ dv = ${cTex}x^{${n}}dx$` },
          { h: 'Antiderivative', d: `$${cTex}\\left(\\frac{x^{${n + 1}}}{${n + 1}}\\ln x - \\frac{x^{${n + 1}}}{${(n + 1) ** 2}}\\right)$` },
          { h: 'Evaluate', d: `$\\approx ${r3(val)}$` }
        ]
      };
    }
    const h = ri(rng, 1, 3);
    const val = c * (Math.exp(h) * (h * h - 2 * h + 2) - 2);
    return {
      prompt: `Integration by parts twice: evaluate $\\displaystyle\\int_0^{${h}} ${cTex}x^2 e^{x}\\,dx$, correct to 3 decimal places.`,
      answerType: 'numeric', answer: { value: r3(val), tol: 0.002 },
      traps: [{ value: r3(c * Math.exp(h) * (h * h - 2 * h)), why: 'Applying parts twice leaves three terms: $x^2e^x - 2xe^x + 2e^x$ — the last one is easy to lose.', tol: 0.002 }].filter(t => Math.abs(t.value - r3(val)) > 0.004),
      hints: ['First pass: $u = x^2$, $dv = e^x dx$ leaves $-2\\int xe^x dx$.', 'Second pass on $\\int xe^x dx = (x-1)e^x$.', `Antiderivative: $${cTex}e^x(x^2 - 2x + 2)$.`],
      steps: [
        { h: 'Parts, first pass', d: `$x^2e^x - 2\\displaystyle\\int xe^x\\,dx$` },
        { h: 'Parts, second pass', d: `$\\int xe^x dx = (x - 1)e^x$, so the antiderivative is $${cTex}e^x(x^2 - 2x + 2)$` },
        { h: 'Evaluate', d: `$${cTex}\\left[e^{${h}}(${h * h - 2 * h + 2}) - 2\\right] \\approx ${r3(val)}$` }
      ]
    };
  },

  // ── MEX-V1 · Vectors in 3D ───────────────────────────────────────────────
  'mex-vectors': (rng, diff) => {
    if (diff === 1) {
      const v = [nz(rng, -4, 4), nz(rng, -4, 4), nz(rng, -4, 4)];
      const mag = Math.hypot(...v);
      return {
        prompt: `Find the magnitude of $\\underset{\\sim}{v} = \\begin{pmatrix} ${v[0]} \\\\ ${v[1]} \\\\ ${v[2]} \\end{pmatrix}$, correct to 2 decimal places.`,
        answerType: 'numeric', answer: { value: r2(mag), tol: 0.011 },
        traps: [{ value: Math.abs(v[0]) + Math.abs(v[1]) + Math.abs(v[2]), why: 'Use the 3D Pythagoras: $\\sqrt{x^2 + y^2 + z^2}$.' }].filter(t => Math.abs(t.value - r2(mag)) > 0.02),
        hints: ['$|v| = \\sqrt{x^2 + y^2 + z^2}$.', `$\\sqrt{${v[0] ** 2} + ${v[1] ** 2} + ${v[2] ** 2}}$.`, 'Round to 2 dp.'],
        steps: [{ h: '3D magnitude', d: `$\\sqrt{${v[0] ** 2 + v[1] ** 2 + v[2] ** 2}} \\approx ${r2(mag)}$` }]
      };
    }
    if (diff === 2) {
      const a = [nz(rng, -4, 4), nz(rng, -4, 4), nz(rng, -4, 4)];
      const b = [nz(rng, -4, 4), nz(rng, -4, 4), nz(rng, -4, 4)];
      const dot = a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
      return {
        prompt: `Find $\\underset{\\sim}{a}\\cdot\\underset{\\sim}{b}$ for $\\underset{\\sim}{a} = \\begin{pmatrix} ${a[0]} \\\\ ${a[1]} \\\\ ${a[2]} \\end{pmatrix}$, $\\underset{\\sim}{b} = \\begin{pmatrix} ${b[0]} \\\\ ${b[1]} \\\\ ${b[2]} \\end{pmatrix}$.`,
        answerType: 'numeric', answer: { value: dot },
        traps: [],
        hints: ['Multiply matching components; add all three.', `$${a[0]}·${b[0]} + ${a[1]}·${b[1]} + ${a[2]}·${b[2]}$.`, `= ${dot}.`],
        steps: [{ h: 'Dot product', d: `$${a[0] * b[0]} + ${a[1] * b[1]} + ${a[2] * b[2]} = ${dot}$` }]
      };
    }
    if (diff === 3) {
      const a = [ri(rng, 1, 4), ri(rng, 1, 4), nz(rng, -4, 4)];
      const b = [ri(rng, 1, 4), nz(rng, -4, 4), ri(rng, 1, 4)];
      const dot = a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
      const ang = Math.acos(Math.max(-1, Math.min(1, dot / (Math.hypot(...a) * Math.hypot(...b))))) * 180 / Math.PI;
      return {
        prompt: `Find the angle between $\\begin{pmatrix} ${a[0]} \\\\ ${a[1]} \\\\ ${a[2]} \\end{pmatrix}$ and $\\begin{pmatrix} ${b[0]} \\\\ ${b[1]} \\\\ ${b[2]} \\end{pmatrix}$, to the nearest degree.`,
        answerType: 'numeric', answer: { value: Math.round(ang), tol: 0.51 }, answerSuffix: '°',
        traps: [],
        hints: ['$\\cos\\theta = \\frac{a\\cdot b}{|a||b|}$.', `Dot $= ${dot}$.`, 'cos⁻¹ of the ratio.'],
        steps: [
          { h: 'Dot and magnitudes', d: `$a\\cdot b = ${dot}$; $|a| = ${r3(Math.hypot(...a))}$, $|b| = ${r3(Math.hypot(...b))}$` },
          { h: 'Angle', d: `$\\approx ${Math.round(ang)}°$` }
        ]
      };
    }
    const a = [nz(rng, 1, 5), nz(rng, -5, 5), nz(rng, 1, 4)];
    const b0 = nz(rng, -4, 4), b1 = nz(rng, 1, 4);
    // choose k so that a·b = 0: a0*b0 + a1*b1 + a2*k = 0
    const num = -(a[0] * b0 + a[1] * b1);
    if (num % a[2] !== 0) return streamsExt['mex-vectors'](rng, diff);
    const k = num / a[2];
    return {
      prompt: `Find $k$ so that $\\begin{pmatrix} ${a[0]} \\\\ ${a[1]} \\\\ ${a[2]} \\end{pmatrix}$ and $\\begin{pmatrix} ${b0} \\\\ ${b1} \\\\ k \\end{pmatrix}$ are **perpendicular**.`,
      answerType: 'numeric', answer: { value: k }, answerPrefix: 'k =',
      traps: [{ value: -k, why: 'Set the dot product to zero and solve — mind the sign when isolating k.' }].filter(t => t.value !== k),
      hints: ['Perpendicular ⇔ dot product = 0.', `$${a[0]}(${b0}) + ${a[1]}(${b1}) + ${a[2]}k = 0$.`, `$k = ${k}$.`],
      steps: [
        { h: 'Dot product = 0', d: `$${a[0] * b0} + ${a[1] * b1} + ${a[2]}k = 0$` },
        { h: 'Solve', d: `$k = ${k}$` }
      ]
    };
  },

  // ── MEX-M1 · Mechanics ───────────────────────────────────────────────────
  'mex-mechanics': (rng, diff) => {
    const A = ri(rng, 2, 12), n = ri(rng, 2, 7);
    if (diff === 1) {
      const ask = ri(rng, 1, 3);
      if (ask === 1) return {
        prompt: `A particle moves in simple harmonic motion $x = ${A}\\cos(${n}t)$. State its **period**, correct to 2 decimal places.`,
        answerType: 'numeric', answer: { value: r2(2 * Math.PI / n), tol: 0.011 }, answerSuffix: 's',
        traps: [{ value: r2(n / (2 * Math.PI)), why: 'Period $T = \\frac{2\\pi}{n}$ — n is the angular frequency.', tol: 0.011 }],
        hints: ['$T = \\frac{2\\pi}{n}$.', `$\\frac{2\\pi}{${n}}$.`, 'Evaluate.'],
        steps: [{ h: 'Period', d: `$T = \\dfrac{2\\pi}{${n}} \\approx ${r2(2 * Math.PI / n)}$ s` }]
      };
      if (ask === 2) return {
        prompt: `A particle moves in simple harmonic motion $x = ${A}\\cos(${n}t)$. State the **amplitude** and hence the greatest distance it reaches from the centre of motion.`,
        answerType: 'numeric', answer: { value: A }, answerSuffix: 'm',
        traps: [{ value: 2 * A, why: 'The amplitude is the greatest displacement from the centre — $2A$ is the full width of the motion.' }],
        hints: ['Compare with $x = A\\cos(nt)$.', 'The amplitude is the coefficient of the cosine.', `$A = ${A}$.`],
        steps: [{ h: 'Read off the amplitude', d: `$x = ${A}\\cos(${n}t) \\Rightarrow A = ${A}$ m` }]
      };
      return {
        prompt: `A particle moves in simple harmonic motion $x = ${A}\\cos(${n}t)$. How many complete oscillations does it make in $2\\pi$ seconds?`,
        answerType: 'numeric', answer: { value: n },
        traps: [{ value: r2(2 * Math.PI / n), why: 'That is the period in seconds — the number of oscillations in $2\\pi$ s is $\\frac{2\\pi}{T} = n$.', tol: 0.011 }],
        hints: [`$T = \\frac{2\\pi}{${n}}$ seconds per oscillation.`, `Oscillations $= \\frac{2\\pi}{T}$.`, `$= ${n}$.`],
        steps: [
          { h: 'Period', d: `$T = \\dfrac{2\\pi}{${n}}$ s` },
          { h: 'Count them', d: `$\\dfrac{2\\pi}{T} = ${n}$ oscillations` }
        ]
      };
    }
    if (diff === 2) {
      const t = rc(rng, [0.2, 0.25, 0.4, 0.5, 0.75, 1, 1.25, 1.5, 2]);
      const wantAcc = rng() < 0.4;
      const v = -A * n * Math.sin(n * t);
      const acc = -A * n * n * Math.cos(n * t);
      return wantAcc ? {
        prompt: `For the SHM $x = ${A}\\cos(${n}t)$, find the acceleration $\\ddot{x}$ at $t = ${t}$, correct to 2 decimal places.`,
        answerType: 'numeric', answer: { value: r2(acc), tol: 0.011 }, answerSuffix: 'm/s²',
        traps: [{ value: r2(-A * Math.cos(n * t)), why: 'Differentiating twice brings out a factor of $n^2$: $\\ddot{x} = -An^2\\cos(nt)$.', tol: 0.011 }].filter(t2 => Math.abs(t2.value - r2(acc)) > 0.02),
        hints: ['$\\ddot{x} = -n^2 x$.', `$= -${n * n} \\times ${A}\\cos(${n} \\times ${t})$.`, 'Radians!'],
        steps: [{ h: 'Differentiate twice', d: `$\\ddot{x} = -${A * n * n}\\cos(${n}t)$; at $t = ${t}$: $\\approx ${r2(acc)}$ m/s²` }]
      } : {
        prompt: `For the SHM $x = ${A}\\cos(${n}t)$, find the velocity $\\dot{x}$ at $t = ${t}$, correct to 2 decimal places.`,
        answerType: 'numeric', answer: { value: r2(v), tol: 0.011 }, answerSuffix: 'm/s',
        traps: [{ value: r2(-A * Math.sin(n * t)), why: 'The chain rule brings out a factor of n: $\\dot{x} = -An\\sin(nt)$.', tol: 0.011 }].filter(t2 => Math.abs(t2.value - r2(v)) > 0.02),
        hints: ['Differentiate: $\\dot{x} = -An\\sin(nt)$.', `$-${A}\\times${n}\\sin(${n}\\times${t})$.`, 'Radians!'],
        steps: [{ h: 'Differentiate', d: `$\\dot{x} = -${A * n}\\sin(${n}t)$; at $t = ${t}$: $\\approx ${r2(v)}$ m/s` }]
      };
    }
    if (diff === 3) {
      const wantSpeed = rng() < 0.45;
      return wantSpeed ? {
        prompt: `For SHM $x = ${A}\\cos(${n}t)$, find the **maximum speed** of the particle.`,
        answerType: 'numeric', answer: { value: A * n }, answerSuffix: 'm/s',
        traps: [
          { value: A * n * n, why: 'That is the maximum acceleration — speed differentiates the displacement only once.' },
          { value: A, why: 'A is the maximum displacement; the maximum speed scales it by $n$.' }
        ],
        hints: ['$\\dot{x} = -An\\sin(nt)$.', 'The sine factor peaks at 1.', `Maximum speed $= ${A}\\times${n}$.`],
        steps: [
          { h: 'Velocity', d: `$\\dot{x} = -${A * n}\\sin(${n}t)$` },
          { h: 'Maximum', d: `$|\\dot{x}|_{max} = ${A * n}$ m/s (at the centre of motion)` }
        ]
      } : {
        prompt: `For SHM $x = ${A}\\cos(${n}t)$, find the **maximum acceleration** magnitude.`,
        answerType: 'numeric', answer: { value: A * n * n }, answerSuffix: 'm/s²',
        traps: [
          { value: A * n, why: 'Acceleration differentiates twice: $\\ddot{x} = -An^2\\cos(nt)$, so the maximum is $An^2$.' },
          { value: A, why: 'A is the max displacement — acceleration scales it by $n^2$.' }
        ],
        hints: ['$\\ddot{x} = -n^2x$.', `Max $|x| = ${A}$.`, `Max accel $= ${A}\\times${n}^2$.`],
        steps: [
          { h: 'SHM property', d: `$\\ddot{x} = -n^2 x$` },
          { h: 'Maximum', d: `$|\\ddot{x}|_{max} = n^2 A = ${A * n * n}$ m/s²` }
        ]
      };
    }
    const m = ri(rng, 40, 110);
    const kk = rc(rng, [2, 4, 5, 8, 10, 16, 20, 25]);
    const vt = m * 10 / kk;
    return {
      prompt: `A $${m}$ kg skydiver falls with resistance $R = ${kk}v$ (newtons), so $m\\ddot{x} = mg - ${kk}v$ with $g = 10$. Find the **terminal velocity** (where acceleration is zero), correct to 1 decimal place.`,
      answerType: 'numeric', answer: { value: r1(vt), tol: 0.06 }, answerSuffix: 'm/s',
      traps: [{ value: m * 10, why: 'Set the acceleration to zero: $mg = kv$, so $v = \\frac{mg}{k}$.' }].filter(t => Math.abs(t.value - r1(vt)) > 0.12),
      hints: ['Terminal velocity: the forces balance.', `$mg = ${kk}v$.`, `$v = \\frac{${m} \\times 10}{${kk}}$.`],
      steps: [
        { h: 'Balance forces', d: `$mg = ${kk}v$` },
        { h: 'Solve', d: `$v = \\dfrac{${m * 10}}{${kk}} \\approx ${r1(vt)}$ m/s` }
      ]
    };
  }
};
