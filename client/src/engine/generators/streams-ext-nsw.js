// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Extension 1 and Extension 2 generators for the NSW Mathematics
// (2024) outcomes that had no, or too few, approved forms. Original to Pri; no
// NESA paper, question or marking guideline is used. Every answer is exact
// (whole numbers; areas of the inverse-trigonometric kind are the coefficient of π).
//
//   me11-binomial       ME1-11-05  The binomial theorem
//   me12-further-calc   ME1-12-04  Further calculus skills
//   mex-vectors-lines   ME2-12-02  Further work with vectors
// ─────────────────────────────────────────────────────────────────────────────
import { ri, rc, nz } from '../qhelpers.js';

const C = (n, k) => { let r = 1; for (let i = 1; i <= k; i++) r = r * (n - k + i) / i; return Math.round(r); };
const sg = c => (c >= 0 ? `+ ${c}` : `- ${Math.abs(c)}`);

export const streamsExtNsw = {
  // ── The binomial theorem ───────────────────────────────────────────────────
  'me11-binomial': (rng, diff) => {
    if (diff === 1) {
      const n = ri(rng, 4, 10), k = ri(rng, 2, n - 2);
      return {
        prompt: `Evaluate $\\dbinom{${n}}{${k}}$.`,
        answerType: 'numeric', answer: { value: C(n, k) },
        traps: [{ value: n * k, why: '$\\binom{n}{k} = \\dfrac{n!}{k!(n-k)!}$, the number of ways to choose $k$ from $n$.' }].filter(t => t.value !== C(n, k)),
        hints: ['$\\binom{n}{k} = \\dfrac{n!}{k!\\,(n-k)!}$.', `$\\binom{${n}}{${k}} = \\binom{${n}}{${n - k}}$.`, 'Cancel before multiplying.'],
        steps: [{ h: 'Formula', d: `$\\dbinom{${n}}{${k}} = \\dfrac{${n}!}{${k}!\\,${n - k}!} = ${C(n, k)}$` }]
      };
    }
    if (diff === 2) {
      const n = ri(rng, 5, 9), k = ri(rng, 2, 4);
      return {
        prompt: `Find the coefficient of $x^{${k}}$ in the expansion of $(1 + x)^{${n}}$.`,
        answerType: 'numeric', answer: { value: C(n, k) },
        traps: [{ value: C(n, k) * 2, why: 'The coefficient of $x^k$ in $(1+x)^n$ is exactly $\\binom{n}{k}$.' }],
        hints: ['$(1 + x)^n = \\sum \\binom{n}{k} x^k$.', `The coefficient of $x^{${k}}$ is $\\binom{${n}}{${k}}$.`, 'Evaluate it.'],
        steps: [{ h: 'General term', d: `$\\dbinom{${n}}{${k}}x^{${k}}$, so the coefficient is $${C(n, k)}$` }]
      };
    }
    if (diff === 3) {
      const n = ri(rng, 4, 7), k = ri(rng, 2, 3), a = nz(rng, -3, 3);
      return {
        prompt: `Find the coefficient of $x^{${k}}$ in the expansion of $(x ${sg(a)})^{${n}}$.`,
        answerType: 'numeric', answer: { value: C(n, k) * a ** (n - k) },
        traps: [{ value: C(n, k) * a, why: 'The term with $x^{k}$ has the constant raised to the power $n - k$.' }].filter(t => t.value !== C(n, k) * a ** (n - k)),
        hints: [`The general term is $\\binom{${n}}{r}x^{r}(${a})^{${n}-r}$.`, `For $x^{${k}}$, $r = ${k}$ and the constant has power $${n - k}$.`, `$\\binom{${n}}{${k}}\\times(${a})^{${n - k}}$.`],
        steps: [{ h: 'Term', d: `$\\dbinom{${n}}{${k}}x^{${k}}(${a})^{${n - k}}$` }, { h: 'Coefficient', d: `$${C(n, k)}\\times ${a ** (n - k)} = ${C(n, k) * a ** (n - k)}$` }]
      };
    }
    const a = ri(rng, 1, 4), b = ri(rng, 1, 3), n = ri(rng, 3, 6);
    return {
      prompt: `Find the sum of all the coefficients in the expansion of $(${a}x + ${b})^{${n}}$.`,
      answerType: 'numeric', answer: { value: (a + b) ** n },
      traps: [{ value: a ** n + b ** n, why: 'Put $x = 1$: the sum of the coefficients is $(a + b)^n$, not $a^n + b^n$.' }].filter(t => t.value !== (a + b) ** n),
      hints: ['Substitute $x = 1$ into the expansion.', `The sum of the coefficients is $(${a} + ${b})^{${n}}$.`, 'Evaluate the power.'],
      steps: [{ h: 'Put x = 1', d: `$(${a} + ${b})^{${n}} = ${(a + b) ** n}$` }]
    };
  },

  // ── Further calculus skills ────────────────────────────────────────────────
  'me12-further-calc': (rng, diff) => {
    const a = ri(rng, 1, 6);
    if (diff === 1) {
      return {
        prompt: `Find $\\dfrac{d}{dx}\\left(\\sin^{-1}(${a === 1 ? '' : a}x)\\right)$ at $x = 0$.`,
        answerType: 'numeric', answer: { value: a },
        traps: [{ value: 1, why: 'Use the chain rule: $\\dfrac{d}{dx}\\sin^{-1}(ax) = \\dfrac{a}{\\sqrt{1 - a^2x^2}}$.' }].filter(t => t.value !== a),
        hints: ['$\\dfrac{d}{dx}\\sin^{-1}(ax) = \\dfrac{a}{\\sqrt{1 - a^2x^2}}$.', 'At $x = 0$ the square root is $1$.', 'So the value is $a$.'],
        steps: [{ h: 'Derivative', d: `$\\dfrac{${a}}{\\sqrt{1 - ${a * a}x^2}}$` }, { h: 'At x = 0', d: `$${a}$` }]
      };
    }
    if (diff === 2) {
      return {
        prompt: `Find $\\dfrac{d}{dx}\\left(\\tan^{-1}(${a === 1 ? '' : a}x)\\right)$ at $x = 0$.`,
        answerType: 'numeric', answer: { value: a },
        traps: [{ value: 1, why: 'Use the chain rule: $\\dfrac{d}{dx}\\tan^{-1}(ax) = \\dfrac{a}{1 + a^2x^2}$.' }].filter(t => t.value !== a),
        hints: ['$\\dfrac{d}{dx}\\tan^{-1}(ax) = \\dfrac{a}{1 + a^2x^2}$.', 'At $x = 0$ the denominator is $1$.', 'So the value is $a$.'],
        steps: [{ h: 'Derivative', d: `$\\dfrac{${a}}{1 + ${a * a}x^2}$` }, { h: 'At x = 0', d: `$${a}$` }]
      };
    }
    if (diff === 3) {
      const k = 4 * ri(rng, 1, 9);
      return {
        prompt: `Evaluate $\\displaystyle\\int_0^1 \\dfrac{${k}}{1 + x^2}\\,dx$. Give the answer as $c\\pi$ and enter $c$.`,
        answerType: 'numeric', answer: { value: k / 4 },
        traps: [{ value: k, why: '$\\int_0^1 \\dfrac{dx}{1 + x^2} = \\tan^{-1}1 - \\tan^{-1}0 = \\dfrac{\\pi}{4}$, so the factor $\\dfrac14$ matters.' }],
        hints: ['$\\displaystyle\\int \\dfrac{dx}{1 + x^2} = \\tan^{-1}x$.', '$\\tan^{-1}1 = \\dfrac{\\pi}{4}$ and $\\tan^{-1}0 = 0$.', `Multiply by $${k}$.`],
        steps: [{ h: 'Integrate', d: `$${k}\\left[\\tan^{-1}x\\right]_0^1 = ${k}\\cdot\\dfrac{\\pi}{4} = ${k / 4}\\pi$` }]
      };
    }
    const k = 6 * ri(rng, 1, 9);
    return {
      prompt: `Evaluate $\\displaystyle\\int_0^{1/2} \\dfrac{${k}}{\\sqrt{1 - x^2}}\\,dx$. Give the answer as $c\\pi$ and enter $c$.`,
      answerType: 'numeric', answer: { value: k / 6 },
      traps: [{ value: k, why: '$\\int_0^{1/2}\\dfrac{dx}{\\sqrt{1 - x^2}} = \\sin^{-1}\\tfrac12 = \\dfrac{\\pi}{6}$.' }],
      hints: ['$\\displaystyle\\int \\dfrac{dx}{\\sqrt{1 - x^2}} = \\sin^{-1}x$.', '$\\sin^{-1}\\tfrac12 = \\dfrac{\\pi}{6}$.', `Multiply by $${k}$.`],
      steps: [{ h: 'Integrate', d: `$${k}\\left[\\sin^{-1}x\\right]_0^{1/2} = ${k}\\cdot\\dfrac{\\pi}{6} = ${k / 6}\\pi$` }]
    };
  },

  // ── Further work with vectors (lines and spheres in three dimensions) ─────
  'mex-vectors-lines': (rng, diff) => {
    const v = () => [nz(rng, -4, 4), nz(rng, -4, 4), nz(rng, -4, 4)];
    const tex = u => `\\begin{pmatrix}${u.join('\\\\')}\\end{pmatrix}`;
    const A = [ri(rng, -5, 5), ri(rng, -5, 5), ri(rng, -5, 5)], u = v();
    if (diff === 1) {
      const t = nz(rng, -3, 4);
      const P = A.map((c, i) => c + t * u[i]);
      return {
        prompt: `A line has vector equation $\\mathbf{r} = ${tex(A)} + t${tex(u)}$. The point $P(${P.join(', ')})$ lies on it. Find the value of $t$ at $P$.`,
        answerType: 'numeric', answer: { value: t },
        traps: [{ value: -t, why: 'Solve $\\mathbf{a} + t\\mathbf{d} = \\mathbf{p}$ component by component.' }],
        hints: ['Equate one component: $a_1 + t d_1 = p_1$.', `$${A[0]} + t(${u[0]}) = ${P[0]}$.`, 'Check that the other components agree.'],
        steps: [{ h: 'First component', d: `$${A[0]} + ${u[0]}t = ${P[0]} \\Rightarrow t = ${t}$` }]
      };
    }
    if (diff === 2) {
      const t = nz(rng, -3, 4);
      const P = A.map((c, i) => c + t * u[i]);
      return {
        prompt: `A line has vector equation $\\mathbf{r} = ${tex(A)} + t${tex(u)}$. The point $Q(${P[0]}, ${P[1]}, m)$ lies on the line. Find $m$.`,
        answerType: 'numeric', answer: { value: P[2] },
        traps: [{ value: A[2] + u[2], why: 'First find $t$ from the other coordinates, then use it in the third.' }].filter(x => x.value !== P[2]),
        hints: ['Find $t$ from the $x$-coordinate.', `$${A[0]} + ${u[0]}t = ${P[0]}$ gives $t = ${t}$.`, `Then $m = ${A[2]} + ${t}(${u[2]})$.`],
        steps: [{ h: 'Find t', d: `$t = ${t}$` }, { h: 'Third coordinate', d: `$m = ${A[2]} + ${t}(${u[2]}) = ${P[2]}$` }]
      };
    }
    if (diff === 3) {
      let w = v();
      const s0 = nz(rng, -3, 3), t0 = nz(rng, -3, 3);
      const X = A.map((c, i) => c + s0 * u[i]);
      const B = X.map((c, i) => c - t0 * w[i]);
      return {
        prompt: `Two lines are $\\mathbf{r}_1 = ${tex(A)} + s${tex(u)}$ and $\\mathbf{r}_2 = ${tex(B)} + t${tex(w)}$. They intersect. Find the value of $s$ at the point of intersection.`,
        answerType: 'numeric', answer: { value: s0 },
        traps: [{ value: t0, why: 'The question asks for the parameter $s$ on the first line, not $t$ on the second.' }].filter(x => x.value !== s0),
        hints: ['Equate the two lines component by component.', 'Solve two of the three equations for $s$ and $t$.', 'Check the third equation.'],
        steps: [{ h: 'Equate', d: `$${tex(A)} + s${tex(u)} = ${tex(B)} + t${tex(w)}$` }, { h: 'Solve', d: `$s = ${s0}$ and $t = ${t0}$; the point is $(${X.join(', ')})$` }]
      };
    }
    const [p, q, r, d] = rc(rng, [[2, 3, 6, 7], [1, 4, 8, 9], [2, 6, 9, 11], [4, 4, 7, 9]]), m = ri(rng, 1, 3);
    const C0 = [ri(rng, -4, 4), ri(rng, -4, 4), ri(rng, -4, 4)];
    const S = [C0[0] + p * m, C0[1] + q * m, C0[2] + r * m];
    return {
      prompt: `A sphere has centre $C(${C0.join(', ')})$ and passes through the point $S(${S.join(', ')})$. Find its radius.`,
      answerType: 'numeric', answer: { value: d * m },
      traps: [{ value: (p + q + r) * m, why: 'The radius is the distance $|\\overrightarrow{CS}|$: square the components, add, then take the square root.' }],
      hints: [`$\\overrightarrow{CS} = (${p * m}, ${q * m}, ${r * m})$.`, `$|\\overrightarrow{CS}|^2 = ${(p * m) ** 2} + ${(q * m) ** 2} + ${(r * m) ** 2}$.`, 'Take the square root.'],
      steps: [{ h: 'Displacement', d: `$\\overrightarrow{CS} = (${p * m}, ${q * m}, ${r * m})$` }, { h: 'Length', d: `$\\sqrt{${(p * m) ** 2 + (q * m) ** 2 + (r * m) ** 2}} = ${d * m}$` }]
    };
  }
};
