// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Year 11 generators (Advanced foundations)
// ─────────────────────────────────────────────────────────────────────────────
import { ri, rc, rs, nz, Frac, mcq, term, poly, sgn, r1, r2, r3, rad, NAMES } from '../qhelpers.js';

const factorial = n => n <= 1 ? 1 : n * factorial(n - 1);
const nCr = (n, r) => Math.round(factorial(n) / (factorial(r) * factorial(n - r)));
const nPr = (n, r) => Math.round(factorial(n) / factorial(n - r));

// Exact trig values: [deg, sin, cos, tan] with latex + typed forms
const EXACT = {
  30: { sin: ['\\frac{1}{2}', '1/2', 0.5], cos: ['\\frac{\\sqrt{3}}{2}', 'sqrt(3)/2', Math.sqrt(3) / 2], tan: ['\\frac{\\sqrt{3}}{3}', 'sqrt(3)/3', Math.sqrt(3) / 3] },
  45: { sin: ['\\frac{\\sqrt{2}}{2}', 'sqrt(2)/2', Math.SQRT2 / 2], cos: ['\\frac{\\sqrt{2}}{2}', 'sqrt(2)/2', Math.SQRT2 / 2], tan: ['1', '1', 1] },
  60: { sin: ['\\frac{\\sqrt{3}}{2}', 'sqrt(3)/2', Math.sqrt(3) / 2], cos: ['\\frac{1}{2}', '1/2', 0.5], tan: ['\\sqrt{3}', 'sqrt(3)', Math.sqrt(3)] }
};

/** Exact values at the quadrantal angles as well as the special triangles. */
const QUAD_EXACT = {
  0: { sin: ['0', '0', 0], cos: ['1', '1', 1], tan: ['0', '0', 0] },
  30: EXACT[30], 45: EXACT[45], 60: EXACT[60],
  90: { sin: ['1', '1', 1], cos: ['0', '0', 0], tan: null },
  180: { sin: ['0', '0', 0], cos: ['-1', '-1', -1], tan: ['0', '0', 0] },
  270: { sin: ['-1', '-1', -1], cos: ['0', '0', 0], tan: null },
  360: { sin: ['0', '0', 0], cos: ['1', '1', 1], tan: ['0', '0', 0] }
};

/** Every solution of sin/cos/tan θ = v in [lo, hi], scanned in whole degrees. */
function solveTrigDegY11(fn, v, lo, hi) {
  const out = [];
  for (let d = lo; d <= hi; d++) {
    if (fn === 'tan' && Math.abs(((d % 180) + 180) % 180 - 90) < 1e-9) continue;
    const y = fn === 'sin' ? Math.sin(rad(d)) : fn === 'cos' ? Math.cos(rad(d)) : Math.tan(rad(d));
    if (Math.abs(y - v) < 1e-9) out.push(d);
  }
  return out;
}

export const year11 = {

  // ── Functions & relations ────────────────────────────────────────────────
  'y11-functions': (rng, diff) => {
    if (diff === 1) {
      const a = nz(rng, -3, 3), b = nz(rng, -5, 5), c = nz(rng, -7, 7), x = nz(rng, -4, 4);
      const val = a * x * x + b * x + c;
      return {
        prompt: `If $f(x) = ${poly([a, b, c])}$, evaluate $f(${x})$.`,
        answerType: 'numeric', answer: { value: val },
        traps: [{ value: a * x * x * (x < 0 ? -1 : 1) + b * x + c, why: `Careful squaring a negative: $(${x})^2 = ${x * x}$ is positive.` }].filter(t => t.value !== val),
        hints: ['Substitute the value everywhere x appears.', `$f(${x}) = ${a}(${x})^2 ${sgn(b)}(${x}) ${sgn(c)}$.`, `$(${x})^2 = ${x * x}$.`],
        steps: [
          { h: 'Substitute', d: `$f(${x}) = ${a}(${x})^2 ${sgn(b)}(${x}) ${sgn(c)}$` },
          { h: 'Square first', d: `$(${x})^2 = ${x * x}$` },
          { h: 'Evaluate', d: `$${a}(${x * x}) + (${b * x}) + (${c}) = ${val}$` }
        ]
      };
    }
    if (diff === 2) {
      const k = nz(rng, -8, 8);
      const kind = rc(rng, ['sqrt', 'recip']);
      const correct = kind === 'sqrt' ? `$x \\ge ${-k}$` : `$x \\ne ${-k}$`;
      const m = mcq(rng, correct, [
        { text: kind === 'sqrt' ? `$x \\ne ${-k}$` : `$x \\ge ${-k}$`, why: kind === 'sqrt' ? 'Square roots need the *inside* to be ≥ 0 — it’s an inequality, not a single excluded point.' : 'A denominator only fails at the point where it is zero — exclude that single value.' },
        { text: kind === 'sqrt' ? `$x \\ge ${k}$` : `$x \\ne ${k}$`, why: `Solve ${kind === 'sqrt' ? `$x ${sgn(k)} \\ge 0$` : `$x ${sgn(k)} = 0$`} — mind the sign when moving ${k} across.` },
        { text: 'All real x' }
      ]);
      return {
        prompt: `State the domain of $f(x) = ${kind === 'sqrt' ? `\\sqrt{x ${sgn(k)}}` : `\\dfrac{1}{x ${sgn(k)}}`}$.`,
        answerType: 'mcq', answer: { correctIndex: m.correctIndex, optionTraps: m.optionTraps }, mcqOptions: m.options,
        hints: [kind === 'sqrt' ? 'What can’t you square-root (in the reals)?' : 'What can’t you divide by?', kind === 'sqrt' ? `Require $x ${sgn(k)} \\ge 0$.` : `Exclude $x ${sgn(k)} = 0$.`, `Solve for x: ${kind === 'sqrt' ? `$x \\ge ${-k}$` : `$x \\ne ${-k}$`}.`],
        steps: [
          { h: kind === 'sqrt' ? 'Radicand must be ≥ 0' : 'Denominator must be ≠ 0', d: kind === 'sqrt' ? `$x ${sgn(k)} \\ge 0$` : `$x ${sgn(k)} \\ne 0$` },
          { h: 'Solve', d: kind === 'sqrt' ? `$x \\ge ${-k}$` : `$x \\ne ${-k}$` }
        ]
      };
    }
    if (diff === 3) {
      const a = rc(rng, [1, 1, 2, -1]), h = nz(rng, -4, 4), k = nz(rng, -8, 8);
      const up = a > 0;
      const m = mcq(rng, `$y ${up ? '\\ge' : '\\le'} ${k}$`, [
        { text: `$y ${up ? '\\le' : '\\ge'} ${k}$`, why: `The parabola opens ${up ? 'upward, so the vertex is a *minimum*' : 'downward, so the vertex is a *maximum*'}.` },
        { text: `$y \\ge ${h}$`, why: 'The range is about y-values — the vertex’s y-coordinate is $' + k + '$, not $' + h + '$.' },
        { text: 'All real y' }
      ]);
      return {
        prompt: `State the range of $f(x) = ${a === 1 ? '' : a === -1 ? '-' : a}(x ${sgn(-h)})^2 ${sgn(k)}$.`,
        answerType: 'mcq', answer: { correctIndex: m.correctIndex, optionTraps: m.optionTraps }, mcqOptions: m.options,
        hints: ['Find the vertex and which way the parabola opens.', `Vertex at $(${h}, ${k})$; coefficient ${a} ${up ? '> 0 (opens up)' : '< 0 (opens down)'}.`, `So y-values run from ${k} ${up ? 'upward' : 'downward'}.`],
        steps: [
          { h: 'Vertex', d: `$(${h}, ${k})$` },
          { h: 'Direction', d: up ? 'Opens upward → minimum value at the vertex' : 'Opens downward → maximum value at the vertex' },
          { h: 'Range', d: `$y ${up ? '\\ge' : '\\le'} ${k}$` }
        ]
      };
    }
    const a = nz(rng, 2, 4), b = nz(rng, -5, 5), c = nz(rng, 1, 3), d = nz(rng, -4, 4), x = nz(rng, -3, 3);
    const inner = c * x + d;
    const val = a * inner + b;
    return {
      prompt: `If $f(x) = ${term(a)} ${sgn(b)}$ and $g(x) = ${term(c)} ${sgn(d)}$, evaluate $f(g(${x}))$.`,
      answerType: 'numeric', answer: { value: val },
      traps: [
        { value: c * (a * x + b) + d, why: 'That’s $g(f(x))$ — composition works inside-out, so apply g *first*.' },
        { value: (a * x + b) * (c * x + d), why: 'Composition means feeding one function into the other, not multiplying them.' }
      ],
      hints: ['Work from the inside out.', `First $g(${x}) = ${c}(${x}) ${sgn(d)} = ${inner}$.`, `Then $f(${inner})$.`],
      steps: [
        { h: 'Inner function', d: `$g(${x}) = ${c}(${x}) ${sgn(d)} = ${inner}$` },
        { h: 'Outer function', d: `$f(${inner}) = ${a}(${inner}) ${sgn(b)} = ${val}$` }
      ]
    };
  },

  // ── Quadratic functions & the discriminant ───────────────────────────────
  'y11-quadfunc': (rng, diff) => {
    if (diff === 1) {
      const a = nz(rng, -3, 3), b = nz(rng, -7, 7), c = nz(rng, -7, 7);
      const disc = b * b - 4 * a * c;
      return {
        prompt: `Find the discriminant of $${poly([a, b, c])} = 0$.`,
        answerType: 'numeric', answer: { value: disc }, answerPrefix: 'Δ =',
        traps: [
          { value: b * b + 4 * a * c, why: 'The discriminant is $b^2 - 4ac$: subtract, and mind the signs of a and c.' },
          { value: b - 4 * a * c, why: 'Square b first: $\\Delta = b^2 - 4ac$.' }
        ].filter(t => t.value !== disc),
        hints: ['$\\Delta = b^2 - 4ac$.', `Here $a = ${a}$, $b = ${b}$, $c = ${c}$.`, `$\\Delta = (${b})^2 - 4(${a})(${c})$.`],
        steps: [
          { h: 'Identify coefficients', d: `$a = ${a},\\ b = ${b},\\ c = ${c}$` },
          { h: 'Substitute', d: `$\\Delta = (${b})^2 - 4(${a})(${c}) = ${b * b} - (${4 * a * c})$` },
          { h: 'Evaluate', d: `$\\Delta = ${disc}$` }
        ]
      };
    }
    if (diff === 2) {
      const kind = rc(rng, ['two', 'one', 'none']);
      let a, b, c;
      if (kind === 'one') { const p = nz(rng, -5, 5); a = 1; b = -2 * p; c = p * p; }
      else if (kind === 'two') { a = 1; b = nz(rng, -6, 6); c = (b * b - ri(rng, 1, 12) - 4) / 4; c = Math.floor(c); if (b * b - 4 * c <= 0) c = Math.floor((b * b - 4) / 4) - 1; }
      else { a = 1; b = nz(rng, -4, 4); c = Math.ceil((b * b + 4) / 4) + ri(rng, 1, 5); }
      const disc = b * b - 4 * a * c;
      const label = disc > 0 ? 'Two distinct real roots' : disc === 0 ? 'Exactly one real root (a repeated root)' : 'No real roots';
      const m = mcq(rng, label, [
        { text: disc > 0 ? 'No real roots' : 'Two distinct real roots', why: `Check the sign of $\\Delta = ${disc}$: positive → two roots, zero → one, negative → none.` },
        { text: disc === 0 ? 'Two distinct real roots' : 'Exactly one real root (a repeated root)', why: `$\\Delta = ${disc}$ — only $\\Delta = 0$ gives a repeated single root.` },
        { text: 'Cannot tell without solving fully' }
      ]);
      return {
        prompt: `Without solving, determine the nature of the roots of $x^2 ${sgn(b)}x ${sgn(c)} = 0$.`,
        answerType: 'mcq', answer: { correctIndex: m.correctIndex, optionTraps: m.optionTraps }, mcqOptions: m.options,
        hints: ['Compute the discriminant.', `$\\Delta = (${b})^2 - 4(1)(${c}) = ${disc}$.`, disc > 0 ? 'Positive Δ → two distinct real roots.' : disc === 0 ? 'Zero Δ → one repeated root.' : 'Negative Δ → no real roots.'],
        steps: [
          { h: 'Discriminant', d: `$\\Delta = ${b * b} - ${4 * c} = ${disc}$` },
          { h: 'Interpret', d: `$\\Delta ${disc > 0 ? '> 0' : disc === 0 ? '= 0' : '< 0'}$ → ${label.toLowerCase()}` }
        ]
      };
    }
    if (diff === 3) {
      const p = nz(rng, -6, 6), q = nz(rng, -6, 6);
      const b = -(p + q), c = p * q; // roots p, q
      const sum = p + q, prod = p * q;
      const which = rc(rng, ['sum', 'product']);
      const val = which === 'sum' ? sum : prod;
      return {
        prompt: `Without solving, find the **${which}** of the roots of $x^2 ${sgn(b)}x ${sgn(c)} = 0$.`,
        answerType: 'numeric', answer: { value: val },
        traps: [
          which === 'sum' ? { value: b, why: 'Sum of roots $= -\\frac{b}{a}$ — flip the sign of b.' } : { value: -c, why: 'Product of roots $= +\\frac{c}{a}$ — no sign flip for the product.' }
        ].filter(t => t.value !== val),
        hints: ['Use Vieta’s formulas: $\\alpha + \\beta = -b/a$, $\\alpha\\beta = c/a$.', `Here $a = 1$, $b = ${b}$, $c = ${c}$.`, which === 'sum' ? `$-(${b})/1$.` : `$${c}/1$.`],
        steps: [
          { h: "Vieta's formulas", d: `$\\alpha + \\beta = -\\dfrac{b}{a}, \\qquad \\alpha\\beta = \\dfrac{c}{a}$` },
          { h: 'Apply', d: which === 'sum' ? `$\\alpha + \\beta = -(${b}) = ${sum}$` : `$\\alpha\\beta = ${prod}$` },
          { h: 'Check', d: `The roots are $${p}$ and $${q}$: sum $${sum}$, product $${prod}$ ✓` }
        ]
      };
    }
    const a = ri(rng, 1, 5);
    const p = nz(rng, -12, 12);
    const b = -2 * a * p, k = a * p * p;
    const lead = a === 1 ? '' : a;
    return {
      prompt: `Find the value of $k$ for which $${lead}x^2 ${sgn(b)}x + k = 0$ has **equal roots**.`,
      answerType: 'numeric', answer: { value: k }, answerPrefix: 'k =',
      traps: [
        { value: -k, why: `Equal roots need $\\Delta = b^2 - 4ak = 0$, so $k = \\frac{b^2}{4a} > 0$ here.` },
        { value: b * b / 4, why: `The discriminant is $b^2 - 4ak$ — divide by $4a = ${4 * a}$, not by 4.` }
      ].filter(t => t.value !== k),
      hints: ['Equal roots ⇔ discriminant = 0.', `$\\Delta = (${b})^2 - 4(${a})k = 0$.`, `$${4 * a}k = ${b * b}$.`],
      steps: [
        { h: 'Set Δ = 0', d: `$(${b})^2 - 4(${a})k = 0$` },
        { h: 'Solve', d: `$${4 * a}k = ${b * b}$, so $k = ${k}$` },
        { h: 'Check', d: `$${lead}x^2 ${sgn(b)}x + ${k} = ${lead}(x ${sgn(-p)})^2$ ✓` }
      ]
    };
  },

  // ── Polynomials ──────────────────────────────────────────────────────────
  'y11-polynomials': (rng, diff) => {
    if (diff === 1) {
      const a = nz(rng, -2, 2), b = nz(rng, -4, 4), c = nz(rng, -5, 5), d = nz(rng, -7, 7), x = nz(rng, -3, 3);
      const val = a * x ** 3 + b * x * x + c * x + d;
      return {
        prompt: `If $P(x) = ${poly([a, b, c, d])}$, evaluate $P(${x})$.`,
        answerType: 'numeric', answer: { value: val },
        traps: [{ value: a * Math.abs(x) ** 3 + b * x * x + c * x + d, why: `A negative number cubed stays negative: $(${x})^3 = ${x ** 3}$.` }].filter(t => t.value !== val),
        hints: ['Substitute carefully, powers first.', `$(${x})^3 = ${x ** 3}$ and $(${x})^2 = ${x * x}$.`, `Combine: $${a}(${x ** 3}) + ${b}(${x * x}) + ${c}(${x}) + ${d}$.`],
        steps: [
          { h: 'Powers', d: `$(${x})^3 = ${x ** 3}, \\quad (${x})^2 = ${x * x}$` },
          { h: 'Substitute', d: `$${a}(${x ** 3}) ${sgn(b)}(${x * x}) ${sgn(c)}(${x}) ${sgn(d)}$` },
          { h: 'Evaluate', d: `$= ${val}$` }
        ]
      };
    }
    if (diff === 2) {
      const b = nz(rng, -4, 4), c = nz(rng, -5, 5), d = nz(rng, -7, 7), a = nz(rng, -3, 3);
      const rem = a ** 3 + b * a * a + c * a + d;
      return {
        prompt: `Find the remainder when $P(x) = ${poly([1, b, c, d])}$ is divided by $(x ${sgn(-a)})$.`,
        answerType: 'numeric', answer: { value: rem },
        traps: [{ value: (-a) ** 3 + b * a * a - c * a + d, why: `The remainder theorem evaluates at the *root* of the divisor: $x ${sgn(-a)} = 0$ gives $x = ${a}$.` }].filter(t => t.value !== rem),
        hints: ['Use the remainder theorem — no long division needed.', `Dividing by $(x - r)$ leaves remainder $P(r)$; here $r = ${a}$.`, `Evaluate $P(${a})$.`],
        steps: [
          { h: 'Remainder theorem', d: `Remainder $= P(${a})$` },
          { h: 'Evaluate', d: `$P(${a}) = ${a ** 3} ${sgn(b * a * a)} ${sgn(c * a)} ${sgn(d)} = ${rem}$` }
        ]
      };
    }
    if (diff === 3) {
      const root = nz(rng, -4, 4);
      const b = nz(rng, -3, 3), c = nz(rng, -5, 5);
      // Build P with (x - root) as a factor: P = (x - root)(x^2 + bx + c)
      const B = b - root, C = c - root * b, D = -root * c;
      const wrong1 = root + 1 === 0 ? root + 2 : root + 1;
      const wrong2 = -root === root ? root - 1 : -root;
      const m = mcq(rng, `$(x ${sgn(-root)})$`, [
        { text: `$(x ${sgn(-wrong2)})$`, why: `Test it: $P(${wrong2}) \\ne 0$. A factor $(x - r)$ needs $P(r) = 0$.` },
        { text: `$(x ${sgn(-wrong1)})$`, why: `$P(${wrong1}) \\ne 0$, so this is not a factor.` },
        { text: `$(x ${sgn(root)})$`, why: `Careful with signs: $(x ${sgn(root)})$ is zero at $x = ${-root}$, and $P(${-root}) \\ne 0$.` }
      ]);
      return {
        prompt: `Which of these is a factor of $P(x) = ${poly([1, B, C, D])}$?`,
        answerType: 'mcq', answer: { correctIndex: m.correctIndex, optionTraps: m.optionTraps }, mcqOptions: m.options,
        hints: ['Factor theorem: $(x - r)$ is a factor iff $P(r) = 0$.', 'Test each option’s root quickly.', `Try $x = ${root}$: it gives 0.`],
        steps: [
          { h: 'Factor theorem', d: `$(x - r)$ is a factor $\\iff P(r) = 0$` },
          { h: 'Test the winner', d: `$P(${root}) = ${root ** 3} ${sgn(B * root * root)} ${sgn(C * root)} ${sgn(D)} = 0$ ✓` }
        ]
      };
    }
    const root = nz(rng, -3, 3);
    const b = nz(rng, -4, 4), c = nz(rng, -6, 6);
    const k = -(root ** 3 + b * root * root + c * root);
    return {
      prompt: `Find $k$ so that $(x ${sgn(-root)})$ is a factor of $P(x) = x^3 ${sgn(b)}x^2 ${sgn(c)}x + k$.`,
      answerType: 'numeric', answer: { value: k }, answerPrefix: 'k =',
      traps: [{ value: -k, why: `Set $P(${root}) = 0$ and solve — watch the sign when isolating k.` }].filter(t => t.value !== k),
      hints: ['Factor theorem: substitute the root and set the result to zero.', `$P(${root}) = 0$.`, `$${root ** 3 + b * root * root + c * root} + k = 0$.`],
      steps: [
        { h: 'Factor theorem', d: `$P(${root}) = 0$` },
        { h: 'Substitute', d: `$${root ** 3} ${sgn(b * root * root)} ${sgn(c * root)} + k = 0$` },
        { h: 'Solve', d: `$k = ${k}$` }
      ]
    };
  },

  // ── Further linear functions ─────────────────────────────────────────────
  'y11-lines': (rng, diff) => {
    if (diff === 1) {
      const p = nz(rng, -9, 9), q = ri(rng, 2, 9) * rc(rng, [1, -1]);
      const m = new Frac(p, q);
      const perp = new Frac(-q, p);
      return {
        prompt: `A line has gradient $${m.latex()}$. What is the gradient of a line **perpendicular** to it?`,
        answerType: 'numeric', answer: { value: perp.value, simplestFraction: perp.d === 1 ? undefined : { n: perp.n, d: perp.d } },
        inputHint: perp.d === 1 ? 'e.g. -2' : 'e.g. -3/2',
        traps: [
          { value: -m.value, why: 'Perpendicular gradients are *negative reciprocals* — flip the fraction as well as the sign.' },
          { value: new Frac(q, p).value, why: 'Almost — reciprocal yes, but you must also flip the sign: $m_1 m_2 = -1$.' }
        ].filter(t => Math.abs(t.value - perp.value) > 1e-9),
        hints: ['Perpendicular gradients multiply to −1.', `$m_2 = -\\dfrac{1}{m_1}$.`, `Flip $${m.latex()}$ and negate.`],
        steps: [
          { h: 'Rule', d: `$m_1 \\times m_2 = -1$` },
          { h: 'Negative reciprocal', d: `$m_2 = -\\dfrac{1}{${m.latex()}} = ${perp.latex()}$` },
          { h: 'Check', d: `$${m.latex()} \\times ${perp.latex()} = -1$ ✓` }
        ]
      };
    }
    if (diff === 2) {
      const m = nz(rng, -4, 4), c0 = nz(rng, -6, 6);
      const x1 = nz(rng, -4, 4), y1 = ri(rng, -6, 6);
      const c = y1 - m * x1;
      if (c === c0) return year11['y11-lines'](rng, diff);
      return {
        prompt: `Find the equation of the line **parallel** to $y = ${term(m)} ${sgn(c0)}$ passing through $(${x1}, ${y1})$. Answer in the form $y = mx + c$.`,
        answerType: 'expression', answer: { expr: `${m}x + ${c}` },
        inputHint: 'e.g. 3x - 2   (for y = 3x − 2)',
        traps: [{ expr: `${m}x + ${c0}`, why: 'Parallel means same gradient but *different* intercept — find c from the given point.' }],
        hints: ['Parallel lines share the same gradient.', `Use $y = ${m}x + c$ with the point $(${x1}, ${y1})$.`, `$${y1} = ${m}(${x1}) + c$.`],
        steps: [
          { h: 'Same gradient', d: `$m = ${m}$` },
          { h: 'Substitute the point', d: `$${y1} = ${m}(${x1}) + c \\Rightarrow c = ${c}$` },
          { h: 'Equation', d: `$y = ${term(m)} ${sgn(c)}$` }
        ]
      };
    }
    if (diff === 3) {
      const p = rc(rng, [1, 2, 3]), q = rc(rng, [2, 3, 4].filter(v => v !== p));
      const m = new Frac(p, q); // original gradient
      const perp = new Frac(-q, p);
      const x1 = p * ri(rng, 1, 3) * rc(rng, [1, -1]), y1 = ri(rng, -5, 5);
      const cNum = y1 - perp.value * x1;
      return {
        prompt: `Find the equation of the line through $(${x1}, ${y1})$ **perpendicular** to $y = ${m.latex()}x ${sgn(nz(rng, -5, 5))}$. Answer in the form $y = mx + c$.`,
        answerType: 'expression', answer: { expr: `(${perp.n}/${perp.d})x + ${cNum}`, anyOf: [`${perp.n}x/${perp.d} + ${cNum}`] },
        inputHint: 'e.g. -2x/3 + 4  or  (-2/3)x + 4',
        traps: [{ expr: `(${p}/${q})x + ${y1 - m.value * x1}`, why: 'Perpendicular needs the negative reciprocal gradient, not the same gradient.' }],
        hints: ['Perpendicular gradient = negative reciprocal.', `$m_\\perp = ${perp.latex()}$.`, `Then find c from $(${x1}, ${y1})$: $${y1} = ${perp.latex()}(${x1}) + c$.`],
        steps: [
          { h: 'Perpendicular gradient', d: `$m_\\perp = -\\dfrac{1}{${m.latex()}} = ${perp.latex()}$` },
          { h: 'Find c', d: `$${y1} = ${perp.latex()} \\times ${x1} + c \\Rightarrow c = ${cNum}$` },
          { h: 'Equation', d: `$y = ${perp.latex()}x ${sgn(cNum)}$` }
        ]
      };
    }
    const x = nz(rng, -4, 5), y = ri(rng, -5, 6);
    const m1 = nz(rng, -3, 3);
    let m2 = nz(rng, -3, 3);
    if (m2 === m1) m2 = m1 === 3 ? -3 : m1 + 1;
    const c1 = y - m1 * x, c2 = y - m2 * x;
    return {
      prompt: `Find the point of intersection of $y = ${term(m1)} ${sgn(c1)}$ and $y = ${term(m2)} ${sgn(c2)}$.`,
      answerType: 'point', answer: { x, y },
      inputHint: 'e.g. (1, -2)',
      traps: [{ why: 'Set the two right-hand sides equal (both equal y), solve for x, then substitute back.' }],
      hints: ['At the intersection the y-values agree.', `$${term(m1)} ${sgn(c1)} = ${term(m2)} ${sgn(c2)}$.`, `$${m1 - m2}x = ${c2 - c1}$.`],
      steps: [
        { h: 'Equate the lines', d: `$${term(m1)} ${sgn(c1)} = ${term(m2)} ${sgn(c2)}$` },
        { h: 'Solve for x', d: `$${m1 - m2}x = ${c2 - c1}$, so $x = ${x}$` },
        { h: 'Find y', d: `$y = ${m1}(${x}) ${sgn(c1)} = ${y}$ → $(${x}, ${y})$` }
      ]
    };
  },

  // ── Trig ratios & exact values ───────────────────────────────────────────
  'y11-trigfunc': (rng, diff) => {
    if (diff === 1) {
      const shape = ri(rng, 1, 3);
      if (shape === 1) {
        const ang = rc(rng, [0, 30, 45, 60, 90, 180, 270, 360]);
        const fns = QUAD_EXACT[ang].tan === null ? ['sin', 'cos'] : ['sin', 'cos', 'tan'];
        const fn = rc(rng, fns);
        const [ltx, typed, val] = QUAD_EXACT[ang][fn];
        return {
          prompt: `Write down the **exact value** of $\\${fn}(${ang}°)$.`,
          answerType: 'numeric', answer: { value: val, requireExact: true, canonicalInput: typed },
          inputHint: 'e.g. sqrt(3)/2 or 1/2',
          traps: [],
          hints: ['Picture the special triangles: 45–45–90 (sides 1,1,√2) and 30–60–90 (sides 1,√3,2), and the unit circle for 0°, 90°, 180°, 270°, 360°.', fn === 'tan' ? 'tan = opposite ÷ adjacent.' : `${fn} = ${fn === 'sin' ? 'opposite ÷ hypotenuse' : 'adjacent ÷ hypotenuse'}.`, `The exact value is $${ltx}$.`],
          steps: [
            { h: 'Where the angle sits', d: ang % 90 === 0 ? 'Read it straight off the unit circle' : ang === 45 ? 'Right isosceles triangle with sides $1, 1, \\sqrt{2}$' : 'Half an equilateral triangle: sides $1, \\sqrt{3}, 2$' },
            { h: 'Read the ratio', d: `$\\${fn}(${ang}°) = ${ltx}$` }
          ]
        };
      }
      if (shape === 2) {
        const ang = rc(rng, [0, 30, 45, 60, 90]);
        const fns = QUAD_EXACT[ang].tan === null ? ['sin', 'cos'] : ['sin', 'cos', 'tan'];
        const fn = rc(rng, fns);
        const [ltx, , val] = QUAD_EXACT[ang][fn];
        return {
          prompt: `For which angle $\\theta$ with $0° \\le \\theta \\le 90°$ does $\\${fn}(\\theta) = ${ltx}$? Give your answer in degrees.`,
          answerType: 'numeric', answer: { value: ang }, answerSuffix: '°',
          traps: [{ value: 90 - ang, why: `That is the complement — $\\${fn === 'sin' ? 'cos' : 'sin'}$ of it would give $${ltx}$ instead.` }].filter(t => t.value !== ang && fn !== 'tan'),
          hints: ['Work backwards through the special triangles.', `Which of 0°, 30°, 45°, 60°, 90° has $\\${fn} = ${ltx}$?`, `$\\theta = ${ang}°$.`],
          steps: [{ h: 'Read the table backwards', d: `$\\${fn}(${ang}°) = ${ltx}$, so $\\theta = ${ang}°$` }]
        };
      }
      const ang = rc(rng, [0, 30, 45, 60, 90, 180, 270, 360]);
      const fns = QUAD_EXACT[ang].tan === null ? ['sin', 'cos'] : ['sin', 'cos', 'tan'];
      const fn = rc(rng, fns);
      const [ltx, , val] = QUAD_EXACT[ang][fn];
      return {
        prompt: `Find $\\${fn}(${ang}°)$, correct to 3 decimal places.`,
        answerType: 'numeric', answer: { value: r3(val), tol: 0.0006 },
        traps: [],
        hints: ['Make sure your calculator is in degree mode.', `The exact value is $${ltx}$.`, 'Round to 3 decimal places.'],
        steps: [
          { h: 'Exact value', d: `$\\${fn}(${ang}°) = ${ltx}$` },
          { h: 'As a decimal', d: `$\\approx ${r3(val)}$` }
        ]
      };
    }
    if (diff === 2) {
      const base = rc(rng, [30, 45, 60]);
      const quad = rc(rng, [2, 3, 4]);
      const turn = rc(rng, [-360, 0, 360]);
      const principal = quad === 2 ? 180 - base : quad === 3 ? 180 + base : 360 - base;
      const ang = principal + turn;
      const fn = rc(rng, ['sin', 'cos', 'tan']);
      const sign = fn === 'sin' ? (quad === 2 ? 1 : -1) : fn === 'cos' ? (quad === 4 ? 1 : -1) : (quad === 3 ? 1 : -1);
      const [ltx, typed, val] = EXACT[base][fn];
      const signed = sign * val;
      const typedSigned = sign === 1 ? typed : `-${typed}`;
      return {
        prompt: `Find the **exact value** of $\\${fn}(${ang}°)$.`,
        answerType: 'numeric', answer: { value: signed, requireExact: true, canonicalInput: typedSigned },
        inputHint: 'e.g. -sqrt(3)/2',
        traps: [{ value: -signed, why: `Quadrant ${quad}: ${['', 'all ratios positive', 'only sin positive', 'only tan positive', 'only cos positive'][quad]} (ASTC).`, tol: 0.001 }],
        hints: [
          turn === 0 ? `$${ang}°$ lies in quadrant ${quad} — which ratios are positive there (ASTC)?` : `Add or subtract $360°$ first: $${ang}°$ is coterminal with $${principal}°$, in quadrant ${quad}.`,
          `Reference angle: $${base}°$.`,
          `$\\${fn}(${base}°) = ${ltx}$; apply the quadrant sign (${sign === 1 ? '+' : '−'}).`
        ],
        steps: [
          ...(turn === 0 ? [] : [{ h: 'Coterminal angle', d: `$${ang}° ${turn > 0 ? '-' : '+'} 360° = ${principal}°$` }]),
          { h: 'Reference angle', d: `$${principal}° → ${base}°$ (distance from the x-axis)` },
          { h: 'Quadrant sign (ASTC)', d: `Quadrant ${quad}: $\\${fn}$ is ${sign === 1 ? 'positive' : 'negative'}` },
          { h: 'Exact value', d: `$\\${fn}(${ang}°) = ${sign === -1 ? '-' : ''}${ltx}$` }
        ]
      };
    }
    if (diff === 3) {
      const fn = rc(rng, ['sin', 'cos', 'tan']);
      const base = rc(rng, [30, 45, 60]);
      const neg = rc(rng, [true, false]);
      const [ltx] = EXACT[base][fn];
      const valTex = `${neg ? '-' : ''}${ltx}`;
      const target = (neg ? -1 : 1) * EXACT[base][fn][2];
      const dom = rc(rng, [[0, 360], [-180, 180], [0, 720], [-360, 0]]);
      const sols = solveTrigDegY11(fn, target, dom[0], dom[1]);
      const quadNote = fn === 'sin' ? (neg ? 'sin is negative in quadrants 3 and 4' : 'sin is positive in quadrants 1 and 2')
        : fn === 'cos' ? (neg ? 'cos is negative in quadrants 2 and 3' : 'cos is positive in quadrants 1 and 4')
          : (neg ? 'tan is negative in quadrants 2 and 4' : 'tan is positive in quadrants 1 and 3');
      return {
        prompt: `Solve $\\${fn}(\\theta) = ${valTex}$ for $${dom[0]}° \\le \\theta \\le ${dom[1]}°$. Give all solutions in degrees.`,
        answerType: 'set', answer: { values: sols, tol: 0.01 }, answerSuffix: '°',
        inputHint: 'e.g. 30, 150',
        traps: [{ value: sols.length ? sols[0] + base : base, why: `Use the quadrant diagram (ASTC): ${quadNote}.` }].filter(t => !sols.includes(t.value)),
        hints: [`The reference angle is $${base}°$.`, quadNote + '.', `Sweep the whole interval: $\\theta = ${sols.join('°, ')}°$.`],
        steps: [
          { h: 'Reference angle', d: `$\\${fn}(${base}°) = ${ltx}$` },
          { h: 'Locate quadrants', d: quadNote },
          { h: 'Solutions', d: `$\\theta = ${sols.join('°, ')}°$` }
        ]
      };
    }
    const pick = rc(rng, [
      { p: '\\sin^2(\\theta) + \\cos^2(\\theta)', a: '$1$', d1: '$\\sin(2\\theta)$', d2: '$2$', why1: 'This is the Pythagorean identity — it collapses to a constant.' },
      { p: '1 - \\cos^2(\\theta)', a: '$\\sin^2(\\theta)$', d1: '$\\cos^2(\\theta)$', d2: '$1$', why1: 'Rearrange $\\sin^2\\theta + \\cos^2\\theta = 1$.' },
      { p: '1 - \\sin^2(\\theta)', a: '$\\cos^2(\\theta)$', d1: '$\\sin^2(\\theta)$', d2: '$1$', why1: 'Rearrange $\\sin^2\\theta + \\cos^2\\theta = 1$ the other way.' },
      { p: '\\tan(\\theta)\\cos(\\theta)', a: '$\\sin(\\theta)$', d1: '$\\cos(\\theta)$', d2: '$1$', why1: '$\\tan\\theta = \\frac{\\sin\\theta}{\\cos\\theta}$, so the cosines cancel.' },
      { p: '\\dfrac{\\sin(\\theta)}{\\tan(\\theta)}', a: '$\\cos(\\theta)$', d1: '$\\sin^2(\\theta)$', d2: '$1$', why1: 'Write tan as sin/cos and simplify the compound fraction.' },
      { p: '\\dfrac{\\sin(\\theta)}{\\cos(\\theta)}', a: '$\\tan(\\theta)$', d1: '$\\cot(\\theta)$', d2: '$1$', why1: 'This ratio *is* the definition of tan.' },
      { p: '\\dfrac{1 - \\cos^2(\\theta)}{\\sin(\\theta)}', a: '$\\sin(\\theta)$', d1: '$\\cos(\\theta)$', d2: '$\\tan(\\theta)$', why1: 'The top is $\\sin^2\\theta$; one factor cancels with the bottom.' },
      { p: '\\sin(\\theta)\\tan(\\theta) + \\cos(\\theta)', a: '$\\dfrac{1}{\\cos(\\theta)}$', d1: '$\\sin(\\theta)$', d2: '$1$', why1: 'Put both terms over $\\cos\\theta$: the top becomes $\\sin^2\\theta + \\cos^2\\theta = 1$.' },
      { p: '\\cos^2(\\theta) - 1', a: '$-\\sin^2(\\theta)$', d1: '$\\sin^2(\\theta)$', d2: '$1$', why1: 'It is the negative of $1 - \\cos^2\\theta$ — mind the sign.' },
      { p: '\\tan^2(\\theta)\\cos^2(\\theta)', a: '$\\sin^2(\\theta)$', d1: '$\\cos^2(\\theta)$', d2: '$1$', why1: 'Square the identity $\\tan\\theta\\cos\\theta = \\sin\\theta$.' }
    ]);
    const m = mcq(rng, pick.a, [{ text: pick.d1, why: pick.why1 }, { text: pick.d2 }, { text: '$0$' }]);
    return {
      prompt: `Simplify $${pick.p}$.`,
      answerType: 'mcq', answer: { correctIndex: m.correctIndex, optionTraps: m.optionTraps }, mcqOptions: m.options,
      hints: ['Use the Pythagorean identity and $\\tan\\theta = \\sin\\theta/\\cos\\theta$.', pick.why1, `The answer is ${pick.a}.`],
      steps: [
        { h: 'Key identity', d: `$\\sin^2\\theta + \\cos^2\\theta = 1$ and $\\tan\\theta = \\dfrac{\\sin\\theta}{\\cos\\theta}$` },
        { h: 'Simplify', d: `$${pick.p} = $ ${pick.a}` }
      ]
    };
  },

  // ── Sine & cosine rules ──────────────────────────────────────────────────
  'y11-sine-cosine-rule': (rng, diff) => {
    if (diff === 1) {
      const A = ri(rng, 35, 75), B = ri(rng, 30, 170 - A - 20);
      const a = ri(rng, 8, 30);
      const b = a * Math.sin(rad(B)) / Math.sin(rad(A));
      return {
        prompt: `In triangle $ABC$, $\\angle A = ${A}°$, $\\angle B = ${B}°$ and side $a = ${a}$ cm (opposite $\\angle A$). Find side $b$, correct to 1 decimal place.`,
        answerType: 'numeric', answer: { value: r1(b), tol: 0.07 }, answerSuffix: 'cm',
        traps: [{ value: r1(a * Math.sin(rad(A)) / Math.sin(rad(B))), why: 'Match each side with its *own* opposite angle: $\\frac{a}{\\sin A} = \\frac{b}{\\sin B}$.', tol: 0.07 }],
        hints: ['Two angles + one side → sine rule.', `$\\dfrac{b}{\\sin ${B}°} = \\dfrac{${a}}{\\sin ${A}°}$.`, `$b = \\dfrac{${a} \\sin ${B}°}{\\sin ${A}°}$.`],
        steps: [
          { h: 'Sine rule', d: `$\\dfrac{a}{\\sin A} = \\dfrac{b}{\\sin B}$` },
          { h: 'Rearrange', d: `$b = \\dfrac{${a}\\sin(${B}°)}{\\sin(${A}°)} = \\dfrac{${a} \\times ${r3(Math.sin(rad(B)))}}{${r3(Math.sin(rad(A)))}}$` },
          { h: 'Round', d: `$b \\approx ${r1(b)}$ cm` }
        ]
      };
    }
    if (diff === 2) {
      const A = ri(rng, 40, 80);
      const a = ri(rng, 15, 30);
      const bMax = a / Math.sin(rad(A));
      const b = ri(rng, 8, Math.min(25, Math.floor(bMax) - 1));
      const B = Math.asin(b * Math.sin(rad(A)) / a) * 180 / Math.PI;
      return {
        prompt: `In triangle $ABC$, $\\angle A = ${A}°$, side $a = ${a}$ m and side $b = ${b}$ m. Find the acute angle $B$, correct to the nearest degree.`,
        answerType: 'numeric', answer: { value: Math.round(B), tol: 0.51 }, answerSuffix: '°', answerPrefix: 'B =',
        traps: [{ value: Math.round(Math.asin(Math.min(0.999, a * Math.sin(rad(A)) / Math.max(a, b + 20))) * 180 / Math.PI), why: 'Keep sides paired with their opposite angles when rearranging the sine rule.', tol: 0.51 }],
        hints: ['Sine rule with the angle as the unknown.', `$\\dfrac{\\sin B}{${b}} = \\dfrac{\\sin ${A}°}{${a}}$.`, `$\\sin B = ${r3(b * Math.sin(rad(A)) / a)}$; apply $\\sin^{-1}$.`],
        steps: [
          { h: 'Sine rule', d: `$\\dfrac{\\sin B}{b} = \\dfrac{\\sin A}{a}$` },
          { h: 'Substitute', d: `$\\sin B = \\dfrac{${b}\\sin(${A}°)}{${a}} = ${r3(b * Math.sin(rad(A)) / a)}$` },
          { h: 'Inverse sine', d: `$B = \\sin^{-1}(${r3(b * Math.sin(rad(A)) / a)}) \\approx ${Math.round(B)}°$` }
        ]
      };
    }
    if (diff === 3) {
      const b = ri(rng, 6, 15), c = ri(rng, 6, 15), A = ri(rng, 35, 120);
      const a2 = b * b + c * c - 2 * b * c * Math.cos(rad(A));
      const a = Math.sqrt(a2);
      return {
        prompt: `In triangle $ABC$, sides $b = ${b}$ cm and $c = ${c}$ cm enclose the angle $\\angle A = ${A}°$. Find side $a$, correct to 1 decimal place.`,
        answerType: 'numeric', answer: { value: r1(a), tol: 0.07 }, answerSuffix: 'cm',
        traps: [
          { value: r1(Math.sqrt(b * b + c * c)), why: `That's Pythagoras — this triangle isn't right-angled, so you need the cosine rule with its $-2bc\\cos A$ correction.`, tol: 0.07 },
          { value: r1(a2), why: `That's $a^2$ — take the square root at the end.`, tol: 0.07 }
        ],
        hints: ['Two sides + the included angle → cosine rule.', `$a^2 = b^2 + c^2 - 2bc\\cos A$.`, `$a^2 = ${b * b} + ${c * c} - ${2 * b * c}\\cos(${A}°) = ${r2(a2)}$.`],
        steps: [
          { h: 'Cosine rule', d: `$a^2 = b^2 + c^2 - 2bc\\cos A$` },
          { h: 'Substitute', d: `$a^2 = ${b * b} + ${c * c} - ${2 * b * c} \\times ${r3(Math.cos(rad(A)))} = ${r2(a2)}$` },
          { h: 'Square root', d: `$a = \\sqrt{${r2(a2)}} \\approx ${r1(a)}$ cm` }
        ]
      };
    }
    const a = ri(rng, 6, 14), b = ri(rng, 6, 14), C = ri(rng, 30, 140);
    const area = 0.5 * a * b * Math.sin(rad(C));
    return {
      prompt: `Two sides of a triangle measure $${a}$ m and $${b}$ m, with an included angle of $${C}°$. Find the area of the triangle, correct to 1 decimal place.`,
      answerType: 'numeric', answer: { value: r1(area), tol: 0.07 }, answerSuffix: 'm²',
      traps: [
        { value: r1(0.5 * a * b), why: 'That’s the right-angle formula — with an included angle, area $= \\frac{1}{2}ab\\sin C$.', tol: 0.07 },
        { value: r1(a * b * Math.sin(rad(C))), why: 'Don’t forget the ½ in $\\frac{1}{2}ab\\sin C$.', tol: 0.07 }
      ],
      hints: ['Area from two sides and the included angle.', `$A = \\frac{1}{2}ab\\sin C$.`, `$\\frac{1}{2} \\times ${a} \\times ${b} \\times \\sin(${C}°)$.`],
      steps: [
        { h: 'Formula', d: `$A = \\tfrac{1}{2}ab\\sin C$` },
        { h: 'Substitute', d: `$A = \\tfrac{1}{2} \\times ${a} \\times ${b} \\times ${r3(Math.sin(rad(C)))}$` },
        { h: 'Round', d: `$A \\approx ${r1(area)}$ m²` }
      ]
    };
  },

  // ── Exponentials & logarithms ────────────────────────────────────────────
  'y11-explog': (rng, diff) => {
    if (diff === 1) {
      const base = rc(rng, [2, 3, 4, 5, 6, 7, 8, 9, 10]);
      const p = base === 2 ? ri(rng, 2, 10) : base === 3 ? ri(rng, 2, 7) : base <= 5 ? ri(rng, 2, 5) : ri(rng, 2, 4);
      const recip = rng() < 0.4;
      const argTex = recip ? `\\dfrac{1}{${base ** p}}` : `${base ** p}`;
      const ans = recip ? -p : p;
      return {
        prompt: `Evaluate $\\log_{${base}}\\left(${argTex}\\right)$.`,
        answerType: 'numeric', answer: { value: ans },
        traps: [
          { value: recip ? p : base ** p / base, why: recip ? `A reciprocal argument gives a *negative* index: $\\frac{1}{${base ** p}} = ${base}^{-${p}}$.` : `A logarithm asks “what power?”: $${base}^{?} = ${base ** p}$.` },
          { value: p * base, why: `$\\log_{${base}}$ returns just the exponent — no multiplying by the base.` }
        ].filter(t => t.value !== ans),
        hints: ['A log asks: base to what power gives this number?', `$${base}^{?} = ${recip ? `\\frac{1}{${base ** p}}` : base ** p}$.`, `$${base}^{${ans}} = ${recip ? `\\frac{1}{${base ** p}}` : base ** p}$.`],
        steps: [
          { h: 'Rewrite as a power question', d: `$${base}^{x} = ${argTex}$` },
          ...(recip ? [{ h: 'Negative index', d: `$\\dfrac{1}{${base ** p}} = ${base}^{-${p}}$` }] : []),
          { h: 'Answer', d: `$x = ${ans}$` }
        ]
      };
    }
    if (diff === 2) {
      const base = rc(rng, [2, 3, 5, 10]);
      const op = rc(rng, ['+', '-']);
      let pick;
      if (op === '+') {
        const res = base === 2 ? ri(rng, 3, 8) : base === 3 ? ri(rng, 2, 5) : ri(rng, 2, 4);
        const N = base ** res;
        const divisors = [];
        for (let d = 2; d * d <= N; d++) if (N % d === 0) { divisors.push(d); if (d !== N / d) divisors.push(N / d); }
        const x = divisors.length ? rc(rng, divisors) : base;
        pick = { base, x, y: N / x, res };
      } else {
        const res = base === 2 ? ri(rng, 2, 6) : base === 3 ? ri(rng, 1, 4) : ri(rng, 1, 3);
        const y = ri(rng, 2, 15);
        pick = { base, x: y * base ** res, y, res };
      }
      return {
        prompt: `Evaluate $\\log_{${pick.base}}(${pick.x}) ${op} \\log_{${pick.base}}(${pick.y})$.`,
        answerType: 'numeric', answer: { value: pick.res },
        traps: [{ value: op === '+' ? Math.log10(pick.x + pick.y) : pick.x - pick.y, why: op === '+' ? 'Adding logs *multiplies* the arguments: $\\log a + \\log b = \\log(ab)$.' : 'Subtracting logs *divides* the arguments: $\\log a - \\log b = \\log(a/b)$.', tol: 0.01 }],
        hints: [op === '+' ? 'Log law: $\\log a + \\log b = \\log(ab)$.' : 'Log law: $\\log a - \\log b = \\log(a/b)$.', `Combine: $\\log_{${pick.base}}(${op === '+' ? pick.x + ' \\times ' + pick.y : pick.x + ' \\div ' + pick.y})$.`, `$= \\log_{${pick.base}}(${op === '+' ? pick.x * pick.y : pick.x / pick.y})$.`],
        steps: [
          { h: 'Combine with the log law', d: `$\\log_{${pick.base}}(${op === '+' ? `${pick.x} \\times ${pick.y}` : `${pick.x} \\div ${pick.y}`}) = \\log_{${pick.base}}(${op === '+' ? pick.x * pick.y : pick.x / pick.y})$` },
          { h: 'Evaluate', d: `$${pick.base}^{${pick.res}} = ${op === '+' ? pick.x * pick.y : pick.x / pick.y}$, so the answer is $${pick.res}$` }
        ]
      };
    }
    if (diff === 3) {
      const base = rc(rng, [2, 3, 4, 5, 6, 7]);
      const shift = ri(rng, -4, 4);
      const p = ri(rng, 2, base === 2 ? 8 : base === 3 ? 5 : 4);
      const x = p - shift;
      return {
        prompt: `Solve $${base}^{x ${sgn(shift)}} = ${base ** p}$.`.replace(' + 0', ''),
        answerType: 'numeric', answer: { value: x }, answerPrefix: 'x =',
        stepcheck: { kind: 'equation', variable: 'x', solutions: [x] },
        traps: [{ value: p + shift, why: `Equate the exponents: $x ${sgn(shift)} = ${p}$, then move ${Math.abs(shift)} across (mind the sign).` }].filter(t => t.value !== x),
        hints: [`Write ${base ** p} as a power of ${base}.`, `$${base ** p} = ${base}^{${p}}$, so the exponents must match.`, `$x ${sgn(shift)} = ${p}$.`],
        steps: [
          { h: 'Same base on both sides', d: `$${base}^{x ${sgn(shift)}} = ${base}^{${p}}$`.replace(' + 0', '') },
          { h: 'Equate exponents', d: `$x ${sgn(shift)} = ${p}$`.replace(' + 0', '') },
          { h: 'Solve', d: `$x = ${x}$` }
        ]
      };
    }
    const base = rc(rng, [2, 3, 4, 5, 6, 7, 8, 9, 11, 13]);
    const target = ri(rng, 15, 400);
    const x = Math.log(target) / Math.log(base);
    return {
      prompt: `Solve $${base}^x = ${target}$, correct to 2 decimal places.`,
      answerType: 'numeric', answer: { value: r2(x), tol: 0.011 }, answerPrefix: 'x =',
      traps: [
        { value: r2(target / base), why: 'The unknown is an *exponent* — bring it down with logarithms, don’t divide.' },
        { value: r2(Math.log(base) / Math.log(target)), why: 'Change of base: $x = \\frac{\\ln ' + target + '}{\\ln ' + base + '}$ — the target goes on top.' }
      ],
      hints: ['Take a logarithm of both sides.', `$x \\ln ${base} = \\ln ${target}$.`, `$x = \\dfrac{\\ln ${target}}{\\ln ${base}}$.`],
      steps: [
        { h: 'Log both sides', d: `$\\ln(${base}^x) = \\ln(${target})$` },
        { h: 'Bring the power down', d: `$x\\ln ${base} = \\ln ${target}$` },
        { h: 'Divide', d: `$x = \\dfrac{\\ln ${target}}{\\ln ${base}} = ${r3(x)}\\ldots \\approx ${r2(x)}$` }
      ]
    };
  },

  // ── Introduction to differentiation ──────────────────────────────────────
  'y11-diff': (rng, diff) => {
    if (diff === 1) {
      const a = nz(rng, -9, 9), n = ri(rng, 2, 9);
      return {
        prompt: `Differentiate $y = ${a}x^{${n}}$.`,
        answerType: 'expression', answer: { expr: `${a * n}x^${n - 1}` },
        inputHint: `e.g. ${a * n}x^${n - 1}`,
        answerPrefix: 'dy/dx =',
        traps: [
          { expr: `${a * n}x^${n}`, why: 'Multiply by the old power *and* reduce the power by 1.' },
          { expr: `${a}x^${n - 1}`, why: 'The old power multiplies out the front: bring the ' + n + ' down.' }
        ],
        hints: ['Power rule: $\\frac{d}{dx} x^n = nx^{n-1}$.', `Bring the ${n} down: $${a} \\times ${n} = ${a * n}$.`, `Reduce the power: $x^{${n - 1}}$.`],
        steps: [
          { h: 'Power rule', d: `$\\dfrac{d}{dx}\\left(ax^n\\right) = anx^{n-1}$` },
          { h: 'Apply', d: `$\\dfrac{dy}{dx} = ${a} \\times ${n} \\, x^{${n - 1}} = ${a * n}x^{${n - 1}}$` }
        ]
      };
    }
    if (diff === 2) {
      const a = nz(rng, 1, 3), b = nz(rng, -5, 5), c = nz(rng, -7, 7), d = nz(rng, -9, 9);
      return {
        prompt: `Differentiate $f(x) = ${poly([a, b, c, d])}$.`,
        answerType: 'expression', answer: { expr: `${3 * a}x^2 + ${2 * b}x + ${c}` },
        inputHint: 'e.g. 6x^2 - 4x + 3',
        answerPrefix: "f '(x) =",
        traps: [{ expr: `${3 * a}x^2 + ${2 * b}x + ${c === 0 ? 1 : c}x`, why: `The derivative of $${c}x$ is just $${c}$ — and the constant ${d} vanishes.` }],
        hints: ['Differentiate term by term with the power rule.', `$x^3 → 3x^2$, $x^2 → 2x$, $x → 1$, constant → 0.`, `$${a}x^3 → ${3 * a}x^2$, $\\ ${b}x^2 → ${2 * b}x$, $\\ ${c}x → ${c}$, $\\ ${d} → 0$.`],
        steps: [
          { h: 'Term by term', d: `$${a}x^3 \\to ${3 * a}x^2, \\quad ${b}x^2 \\to ${2 * b}x, \\quad ${c}x \\to ${c}, \\quad ${d} \\to 0$` },
          { h: 'Combine', d: `$f'(x) = ${poly([3 * a, 2 * b, c])}$` }
        ]
      };
    }
    if (diff === 3) {
      const a = nz(rng, 1, 3), b = nz(rng, -6, 6), c = nz(rng, -8, 8), x0 = nz(rng, -3, 3);
      const grad = 2 * a * x0 + b;
      return {
        prompt: `Find the gradient of the tangent to $y = ${poly([a, b, c])}$ at the point where $x = ${x0}$.`,
        answerType: 'numeric', answer: { value: grad },
        traps: [
          { value: a * x0 * x0 + b * x0 + c, why: 'That’s the *y-value* at the point — the gradient comes from substituting into the *derivative*.' }
        ].filter(t => t.value !== grad),
        hints: ['Differentiate first, then substitute the x-value.', `$\\frac{dy}{dx} = ${poly([2 * a, b])}$.`, `Evaluate at $x = ${x0}$.`],
        steps: [
          { h: 'Differentiate', d: `$\\dfrac{dy}{dx} = ${poly([2 * a, b])}$` },
          { h: 'Substitute x = ' + x0, d: `$${2 * a}(${x0}) ${sgn(b)} = ${grad}$` }
        ]
      };
    }
    const a = 1, b = nz(rng, -6, 6), c = nz(rng, -8, 8);
    const targetGrad = nz(rng, -6, 6);
    const x0v = (targetGrad - b) / 2;
    if (!Number.isInteger(x0v)) return year11['y11-diff'](rng, diff);
    const y0 = x0v * x0v + b * x0v + c;
    return {
      prompt: `Find the point on the curve $y = ${poly([1, b, c])}$ where the gradient equals $${targetGrad}$.`,
      answerType: 'point', answer: { x: x0v, y: y0 },
      inputHint: 'e.g. (2, -3)',
      traps: [{ why: 'Set the *derivative* equal to the target gradient, solve for x, then find y from the original curve.' }],
      hints: ['Differentiate and set the result equal to the given gradient.', `$2x ${sgn(b)} = ${targetGrad}$.`, `$x = ${x0v}$; substitute into the original equation for y.`],
      steps: [
        { h: 'Differentiate', d: `$\\dfrac{dy}{dx} = 2x ${sgn(b)}$` },
        { h: 'Set equal to the gradient', d: `$2x ${sgn(b)} = ${targetGrad} \\Rightarrow x = ${x0v}$` },
        { h: 'Find y from the curve', d: `$y = (${x0v})^2 ${sgn(b)}(${x0v}) ${sgn(c)} = ${y0}$ → $(${x0v}, ${y0})$` }
      ]
    };
  },

  // ── Probability & counting ───────────────────────────────────────────────
  'y11-probability': (rng, diff) => {
    if (diff === 1) {
      const n = ri(rng, 5, 14), r = ri(rng, 2, Math.min(6, n - 1));
      const useC = rc(rng, [true, false]);
      const val = useC ? nCr(n, r) : nPr(n, r);
      return {
        prompt: `Evaluate $^{${n}}${useC ? 'C' : 'P'}_{${r}}$.`,
        answerType: 'numeric', answer: { value: val },
        traps: [
          { value: useC ? nPr(n, r) : nCr(n, r), why: useC ? '$^nC_r$ counts *unordered* selections — divide the arrangements by $r!$.' : '$^nP_r$ counts *ordered* arrangements — don’t divide by $r!$.' },
          { value: n * r, why: `Use the formula: $^{n}${useC ? 'C' : 'P'}_{r} = \\frac{n!}{${useC ? 'r!(n-r)!' : '(n-r)!'}}$.` }
        ].filter(t => t.value !== val),
        hints: [useC ? 'Combinations: order doesn’t matter.' : 'Permutations: order matters.', `$^{${n}}${useC ? 'C' : 'P'}_{${r}} = \\frac{${n}!}{${useC ? `${r}!(${n - r})!` : `(${n - r})!`}}$.`, useC ? `Compute $\\frac{${nPr(n, r)}}{${factorial(r)}}$.` : `Multiply ${r} descending factors from ${n}.`],
        steps: [
          { h: 'Formula', d: `$^{${n}}${useC ? 'C' : 'P'}_{${r}} = \\dfrac{${n}!}{${useC ? `${r}!\\,(${n - r})!` : `(${n - r})!`}}$` },
          { h: 'Evaluate', d: useC ? `$= \\dfrac{${nPr(n, r)}}{${factorial(r)}} = ${val}$` : `$= ${Array.from({ length: r }, (_, i) => n - i).join(' \\times ')} = ${val}$` }
        ]
      };
    }
    if (diff === 2) {
      const word = rc(rng, ['CAT', 'DOGS', 'BIRD', 'PLANT', 'HORSE', 'MUSIC', 'PENCIL', 'NUMBER', 'WOMBAT', 'FRIEND', 'PYTHON', 'GARDEN', 'JUMPED', 'FLOWER', 'MONKEY', 'BRIDGE', 'CANDLES', 'DOLPHIN', 'JACKETS', 'MERCURY', 'PROBLEMS', 'FLAMINGO']);
      const n = word.length;
      if (rng() < 0.55) {
        const r = ri(rng, 2, n - 1);
        const val = nPr(n, r);
        return {
          prompt: `How many different $${r}$-letter arrangements can be made from the letters of **${word}**, using each letter at most once? (All its letters are distinct.)`,
          answerType: 'numeric', answer: { value: val },
          traps: [
            { value: nCr(n, r), why: 'The letters are arranged in order, so this is a permutation — do not divide by $' + r + '!$.' },
            { value: n ** r, why: 'Each letter may be used at most once, so the number of choices shrinks: ' + Array.from({ length: r }, (_, i) => n - i).join(' × ') + '.' }
          ].filter(t => t.value !== val),
          hints: [`There are ${n} choices for the first letter, ${n - 1} for the second, and so on.`, `That is $^{${n}}P_{${r}} = \\frac{${n}!}{(${n - r})!}$.`, `$${Array.from({ length: r }, (_, i) => n - i).join(' \\times ')}$.`],
          steps: [
            { h: 'Multiplication principle', d: `$${Array.from({ length: r }, (_, i) => n - i).join(' \\times ')}$` },
            { h: 'Evaluate', d: `$^{${n}}P_{${r}} = ${val}$` }
          ]
        };
      }
      return {
        prompt: `How many different arrangements can be made using **all** the letters of the word ${word}? (All its letters are distinct.)`,
        answerType: 'numeric', answer: { value: factorial(n) },
        traps: [
          { value: n * n, why: 'Each position uses up a letter: multiply the *shrinking* choices — that’s a factorial.' },
          { value: factorial(n - 1), why: `${word} has ${n} letters, so the count is ${n}!` }
        ],
        hints: ['How many choices for the first letter? Then the second?', `$${n} \\times ${n - 1} \\times ${n - 2} \\times \\cdots \\times 1$.`, `That product is $${n}!$.`],
        steps: [
          { h: 'Multiplication principle', d: `${n} choices, then ${n - 1}, then ${n - 2}, … down to 1` },
          { h: 'Factorial', d: `$${n}! = ${factorial(n)}$` }
        ]
      };
    }
    if (diff === 3) {
      const n = ri(rng, 6, 18), r = ri(rng, 2, 6);
      return {
        prompt: `A school must pick a committee of $${r}$ students from a group of $${n}$. How many different committees are possible?`,
        answerType: 'numeric', answer: { value: nCr(n, r) },
        traps: [{ value: nPr(n, r), why: 'A committee has no order — divide the ordered count by $' + r + '!$ (use combinations).' }],
        hints: ['Does the order of committee members matter?', 'No order → combinations.', `$^{${n}}C_{${r}} = \\frac{${n}!}{${r}!(${n - r})!}$.`],
        steps: [
          { h: 'Order doesn’t matter', d: `Use $^{${n}}C_{${r}}$` },
          { h: 'Evaluate', d: `$^{${n}}C_{${r}} = \\dfrac{${nPr(n, r)}}{${factorial(r)}} = ${nCr(n, r)}$` }
        ]
      };
    }
    const nA = ri(rng, 2, 12), nB = ri(rng, 2, 12);
    const total = nA + nB;
    const f = new Frac(nA * (nA - 1) + nB * (nB - 1), total * (total - 1));
    return {
      prompt: `A drawer holds $${nA}$ black socks and $${nB}$ white socks. Two socks are taken at random without replacement. Find the probability they **match**, as a fraction in simplest form.`,
      answerType: 'numeric', answer: { value: f.value, simplestFraction: { n: f.n, d: f.d } },
      inputHint: 'e.g. 7/15',
      traps: [{ value: new Frac(nA * (nA - 1), total * (total - 1)).value, why: 'A matching pair can be black *or* white — add both cases.' }],
      hints: ['“Match” means both black OR both white.', `Both black: $\\frac{${nA}}{${total}} \\times \\frac{${nA - 1}}{${total - 1}}$. Both white: $\\frac{${nB}}{${total}} \\times \\frac{${nB - 1}}{${total - 1}}$.`, 'Add the two probabilities and simplify.'],
      steps: [
        { h: 'Both black', d: `$\\dfrac{${nA}}{${total}} \\times \\dfrac{${nA - 1}}{${total - 1}} = ${new Frac(nA * (nA - 1), total * (total - 1)).latex()}$` },
        { h: 'Both white', d: `$\\dfrac{${nB}}{${total}} \\times \\dfrac{${nB - 1}}{${total - 1}} = ${new Frac(nB * (nB - 1), total * (total - 1)).latex()}$` },
        { h: 'Add', d: `$= ${f.latex()}$` }
      ]
    };
  }
};
