// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Stage 5 generators (Year 10) for NSW Mathematics K–10 (2022)
// outcomes the Year 7–10 banks left without an approved form. Original to Pri;
// no NESA paper, question or marking guideline is used. Every answer is a whole
// number or an exact expression; trigonometry uses only exact values.
//
//   y10-indices-neg      MA5-IND-P-01   Indices B
//   y10-functions        MA5-FNC-P-01   Functions and other graphs
//   y10-logarithms       MA5-LOG-P-01   Logarithms
//   y10-polynomials      MA5-POL-P-01   Polynomials
//   y10-trig-nonright    MA5-TRG-P-01   Trigonometry C
//   y10-trig-any-angle   MA5-TRG-P-02   Trigonometry D
//   y10-geometry-proof   MA5-GEO-P-02   Properties of geometrical figures C
//   y10-circle-geometry  MA5-CIR-P-01   Circle geometry
//   y10-networks         MA5-NET-P-01   Introduction to networks
// ─────────────────────────────────────────────────────────────────────────────
import { ri, rc, nz } from '../qhelpers.js';

const TRIPLES = [[3, 4, 5], [5, 12, 13], [8, 15, 17], [6, 8, 10]];
const pw = e => String(e);
const px = e => `x^(${e})`;

/** Shortest distances in a small weighted graph (Floyd–Warshall) and a minimum spanning tree weight (Kruskal). */
function graphFacts(n, edges) {
  const INF = 1e9, d = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 0 : INF)));
  for (const [u, v, w] of edges) { d[u][v] = Math.min(d[u][v], w); d[v][u] = Math.min(d[v][u], w); }
  for (let k = 0; k < n; k++) for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) if (d[i][k] + d[k][j] < d[i][j]) d[i][j] = d[i][k] + d[k][j];
  const parent = Array.from({ length: n }, (_, i) => i);
  const find = x => (parent[x] === x ? x : (parent[x] = find(parent[x])));
  let mst = 0, used = 0;
  for (const [u, v, w] of [...edges].sort((a, b) => a[2] - b[2])) if (find(u) !== find(v)) { parent[find(u)] = find(v); mst += w; used++; }
  return { d, mst, connected: used === n - 1 };
}

export const year10Nsw = {
  // ── Indices B: negative indices in algebraic form ──────────────────────────
  'y10-indices-neg': (rng, diff) => {
    const nzr = () => nz(rng, -6, 6);
    if (diff === 1) {
      let a, b;
      do { a = nzr(); b = nzr(); } while (a + b === 0 || a + b === 1 || a * b === a + b);
      return {
        prompt: `Simplify $x^{${pw(a)}}\\times x^{${pw(b)}}$. Leave the answer as a power of $x$.`,
        answerType: 'expression', answer: { expr: px(a + b) }, answerPrefix: '=',
        traps: [{ expr: px(a * b), why: 'When multiplying powers of the same base, add the indices.' }],
        hints: ['$x^a\\times x^b = x^{a+b}$, also for negative indices.', `$${a} + ${pw(b) === String(b) ? b : `(${b})`}$.`, 'Check the sign of the sum.'],
        steps: [{ h: 'Add the indices', d: `$x^{${pw(a)}}\\times x^{${pw(b)}} = x^{${a} + (${b})} = x^{${pw(a + b)}}$` }]
      };
    }
    if (diff === 2) {
      let a, b;
      do { a = nzr(); b = nz(rng, -4, 4); } while (a * b === 0 || a * b === 1 || a * b === a + b);
      return {
        prompt: `Simplify $\\left(x^{${pw(a)}}\\right)^{${pw(b)}}$. Leave the answer as a power of $x$.`,
        answerType: 'expression', answer: { expr: px(a * b) }, answerPrefix: '=',
        traps: [{ expr: px(a + b), why: 'A power of a power: multiply the indices.' }],
        hints: ['$(x^a)^b = x^{ab}$.', `$${a}\\times (${b})$.`, 'Check the sign of the product.'],
        steps: [{ h: 'Multiply the indices', d: `$(x^{${pw(a)}})^{${pw(b)}} = x^{${a}\\times(${b})} = x^{${pw(a * b)}}$` }]
      };
    }
    if (diff === 3) {
      let a, b;
      do { a = nzr(); b = nzr(); } while (a + b === 0 || a + b === 1);
      let c = ri(rng, 2, 7), d = ri(rng, 2, 7);
      if (c === d) d = d === 7 ? 6 : d + 1;
      return {
        prompt: `Simplify $${c}x^{${pw(a)}}\\times ${d}x^{${pw(b)}}$.`,
        answerType: 'expression', answer: { expr: `${c * d}*${px(a + b)}` }, answerPrefix: '=',
        traps: [{ expr: `${c + d}*${px(a + b)}`, why: 'Multiply the coefficients ($c\\times d$) and add the indices.' }],
        hints: ['Multiply the numbers; add the indices.', `$${c}\\times ${d} = ${c * d}$.`, `$${a} + (${b}) = ${a + b}$.`],
        steps: [{ h: 'Coefficients', d: `$${c}\\times ${d} = ${c * d}$` }, { h: 'Indices', d: `$x^{${pw(a)}}\\times x^{${pw(b)}} = x^{${pw(a + b)}}$` }]
      };
    }
    let a, b;
    do { a = nzr(); b = nzr(); } while (a - b === 0 || a - b === 1);
    const d = ri(rng, 2, 5), q = ri(rng, 2, 6);
    return {
      prompt: `Simplify $\\dfrac{${d * q}x^{${pw(a)}}}{${d}x^{${pw(b)}}}$.`,
      answerType: 'expression', answer: { expr: `${q}*${px(a - b)}` }, answerPrefix: '=',
      traps: [{ expr: `${q}*${px(a + b)}`, why: 'When dividing powers of the same base, subtract the indices.' }],
      hints: ['Divide the numbers; subtract the indices.', `$${d * q}\\div ${d} = ${q}$.`, `$${a} - (${b}) = ${a - b}$.`],
      steps: [{ h: 'Coefficients', d: `$${d * q}\\div ${d} = ${q}$` }, { h: 'Indices', d: `$x^{${pw(a)}}\\div x^{${pw(b)}} = x^{${pw(a - b)}}$` }]
    };
  },

  // ── Functions ──────────────────────────────────────────────────────────────
  'y10-functions': (rng, diff) => {
    if (diff === 1) {
      const p = ri(rng, 1, 4), q = nz(rng, -9, 9), a = nz(rng, -4, 5);
      return {
        prompt: `$f(x) = ${p === 1 ? '' : p}x^2 ${q >= 0 ? '+' : '-'} ${Math.abs(q)}$. Find $f(${a})$.`,
        answerType: 'numeric', answer: { value: p * a * a + q },
        traps: [{ value: (p * a) ** 2 + q, why: 'Only $x$ is squared; multiply by $p$ after squaring.' }].filter(t => t.value !== p * a * a + q),
        hints: ['Replace $x$ with the number in brackets.', `$(${a})^2 = ${a * a}$.`, `$${p}\\times ${a * a} ${q >= 0 ? '+' : '-'} ${Math.abs(q)}$.`],
        steps: [{ h: 'Substitute', d: `$f(${a}) = ${p}(${a})^2 ${q >= 0 ? '+' : '-'} ${Math.abs(q)} = ${p * a * a + q}$` }]
      };
    }
    if (diff === 2) {
      const m = ri(rng, 2, 7), c = nz(rng, -9, 9), x = nz(rng, -6, 8);
      return {
        prompt: `$f(x) = ${m}x ${c >= 0 ? '+' : '-'} ${Math.abs(c)}$. For what value of $x$ is $f(x) = ${m * x + c}$?`,
        answerType: 'numeric', answer: { value: x },
        traps: [{ value: m * x + c, why: 'The value given is $f(x)$, the output. Solve for the input $x$.' }].filter(t => t.value !== x),
        hints: ['Set $f(x)$ equal to the value and solve.', `$${m}x ${c >= 0 ? '+' : '-'} ${Math.abs(c)} = ${m * x + c}$.`, `$${m}x = ${m * x}$.`],
        steps: [{ h: 'Solve', d: `$${m}x = ${m * x + c} ${c >= 0 ? '-' : '+'} ${Math.abs(c)} = ${m * x} \\Rightarrow x = ${x}$` }]
      };
    }
    if (diff === 3) {
      const m = ri(rng, 2, 5), c = nz(rng, -5, 5), p = ri(rng, 2, 4), a = ri(rng, 1, 4);
      const g = p * a, val = m * g + c;
      return {
        prompt: `$f(x) = ${m}x ${c >= 0 ? '+' : '-'} ${Math.abs(c)}$ and $g(x) = ${p}x$. Find $f(g(${a}))$.`,
        answerType: 'numeric', answer: { value: val },
        traps: [{ value: p * (m * a + c), why: '$f(g(a))$ means do $g$ first, then put the result into $f$.' }].filter(t => t.value !== val),
        hints: [`Find $g(${a}) = ${g}$ first.`, `Then $f(${g}) = ${m}(${g}) ${c >= 0 ? '+' : '-'} ${Math.abs(c)}$.`, 'Work from the inside out.'],
        steps: [{ h: 'Inner function', d: `$g(${a}) = ${g}$` }, { h: 'Outer function', d: `$f(${g}) = ${val}$` }]
      };
    }
    const m = ri(rng, 2, 12);
    return {
      prompt: `$f(x) = x^2 - ${m * m}$. Find the positive value of $x$ for which $f(x) = 0$.`,
      answerType: 'numeric', answer: { value: m },
      traps: [{ value: m * m, why: 'Set $x^2 - k = 0$, then take the square root.' }],
      hints: ['Set $f(x) = 0$.', `$x^2 = ${m * m}$.`, 'Take the positive square root.'],
      steps: [{ h: 'Solve', d: `$x^2 - ${m * m} = 0 \\Rightarrow x^2 = ${m * m} \\Rightarrow x = ${m}$` }]
    };
  },

  // ── Logarithms ─────────────────────────────────────────────────────────────
  'y10-logarithms': (rng, diff) => {
    const b = rc(rng, [2, 3, 4, 5, 10]), k = ri(rng, 2, 5);
    const N = b ** k;
    if (diff === 1) {
      return {
        prompt: `Evaluate $\\log_{${b}} ${N}$.`,
        answerType: 'numeric', answer: { value: k },
        traps: [{ value: N / b, why: `$\\log_{${b}}${N}$ asks: what power of ${b} gives ${N}?` }].filter(t => t.value !== k),
        hints: [`Ask: ${b} to what power gives $${N}$?`, `$${b}^{${k}} = ${N}$.`, 'The logarithm is that power.'],
        steps: [{ h: 'Rewrite', d: `$${b}^{${k}} = ${N}$, so $\\log_{${b}} ${N} = ${k}$` }]
      };
    }
    if (diff === 2) {
      const i = ri(rng, 1, k - 1), j = k - i;
      return {
        prompt: `Evaluate $\\log_{${b}} ${b ** i} + \\log_{${b}} ${b ** j}$.`,
        answerType: 'numeric', answer: { value: k },
        traps: [{ value: i * j, why: 'The sum of two logarithms of the same base is the logarithm of the product: add the results.' }].filter(t => t.value !== k),
        hints: ['Evaluate each logarithm separately, or use $\\log a + \\log b = \\log ab$.', `$\\log_{${b}}${b ** i} = ${i}$.`, `$\\log_{${b}}${b ** j} = ${j}$.`],
        steps: [{ h: 'Each term', d: `$\\log_{${b}} ${b ** i} = ${i}$ and $\\log_{${b}} ${b ** j} = ${j}$` }, { h: 'Add', d: `$${i} + ${j} = ${k}$` }]
      };
    }
    if (diff === 3) {
      return {
        prompt: `Solve $${b}^x = ${N}$.`,
        answerType: 'numeric', answer: { value: k },
        traps: [{ value: N / b, why: 'Write both sides as powers of the same base and equate the indices.' }].filter(t => t.value !== k),
        hints: [`Write $${N}$ as a power of $${b}$.`, `$${N} = ${b}^{${k}}$.`, 'Equate the indices.'],
        steps: [{ h: 'Same base', d: `$${b}^x = ${b}^{${k}}$` }, { h: 'Equate indices', d: `$x = ${k}$ (also $x = \\log_{${b}} ${N}$)` }]
      };
    }
    const i = ri(rng, 2, 5), j = ri(rng, 1, i - 1);
    return {
      prompt: `Evaluate $\\log_{${b}} ${b ** i} - \\log_{${b}} ${b ** j}$.`,
      answerType: 'numeric', answer: { value: i - j },
      traps: [{ value: i + j, why: 'A difference of logarithms is the logarithm of a quotient: subtract the results.' }],
      hints: ['$\\log a - \\log b = \\log\\dfrac{a}{b}$, or evaluate each.', `$\\log_{${b}}${b ** i} = ${i}$ and $\\log_{${b}}${b ** j} = ${j}$.`, 'Subtract.'],
      steps: [{ h: 'Each term', d: `$${i}$ and $${j}$` }, { h: 'Subtract', d: `$${i} - ${j} = ${i - j}$` }]
    };
  },

  // ── Polynomials ────────────────────────────────────────────────────────────
  'y10-polynomials': (rng, diff) => {
    if (diff === 1) {
      const m = ri(rng, 2, 5), n = ri(rng, 2, 5);
      return {
        prompt: `$P(x)$ is a polynomial of degree $${m}$ and $Q(x)$ is a polynomial of degree $${n}$. What is the degree of the product $P(x)\\,Q(x)$?`,
        answerType: 'numeric', answer: { value: m + n },
        traps: [{ value: m * n, why: 'When polynomials are multiplied the degrees add.' }].filter(t => t.value !== m + n),
        hints: ['The leading terms multiply: $x^m\\times x^n = x^{m+n}$.', `$${m} + ${n}$.`, 'The degree is the highest power.'],
        steps: [{ h: 'Leading terms', d: `$x^{${m}}\\times x^{${n}} = x^{${m + n}}$, so the degree is $${m + n}$` }]
      };
    }
    if (diff === 2) {
      const a = ri(rng, 1, 3), b = nz(rng, -5, 5), c = nz(rng, -6, 6), x = ri(rng, -3, 3);
      const v = a * x ** 3 + b * x + c;
      return {
        prompt: `$P(x) = ${a === 1 ? '' : a}x^3 ${b >= 0 ? '+' : '-'} ${Math.abs(b) === 1 ? '' : Math.abs(b)}x ${c >= 0 ? '+' : '-'} ${Math.abs(c)}$. Find $P(${x})$.`,
        answerType: 'numeric', answer: { value: v },
        traps: [{ value: a * 3 * x + b * x + c, why: '$x^3$ means $x\\times x\\times x$, not $3x$.' }].filter(t => t.value !== v),
        hints: ['Substitute and use brackets for negative values.', `$(${x})^3 = ${x ** 3}$.`, `$${a}(${x ** 3}) ${b >= 0 ? '+' : '-'} ${Math.abs(b)}(${x}) ${c >= 0 ? '+' : '-'} ${Math.abs(c)}$.`],
        steps: [{ h: 'Substitute', d: `$P(${x}) = ${a}(${x})^3 ${b >= 0 ? '+' : '-'} ${Math.abs(b)}(${x}) ${c >= 0 ? '+' : '-'} ${Math.abs(c)} = ${v}$` }]
      };
    }
    if (diff === 3) {
      const a = nz(rng, -5, 5), b = nz(rng, -5, 5), c = nz(rng, -5, 5);
      // (x + a)(x^2 + b x + c): the coefficient of x^2 is b + a
      return {
        prompt: `Expand $(x ${a >= 0 ? '+' : '-'} ${Math.abs(a)})(x^2 ${b >= 0 ? '+' : '-'} ${Math.abs(b)}x ${c >= 0 ? '+' : '-'} ${Math.abs(c)})$ and write down the coefficient of $x^2$.`,
        answerType: 'numeric', answer: { value: a + b },
        traps: [{ value: a * b, why: 'The $x^2$ terms come from $x\\times bx$ and $a\\times x^2$: add them.' }].filter(t => t.value !== a + b),
        hints: ['Find which pairs of terms multiply to give $x^2$.', `$x\\times(${b}x)$ and $(${a})\\times x^2$.`, `$${b} + (${a})$.`],
        steps: [{ h: 'The $x^2$ terms', d: `$x\\cdot ${b}x = ${b}x^2$ and $${a}\\cdot x^2 = ${a}x^2$` }, { h: 'Add', d: `$${b} + (${a}) = ${a + b}$` }]
      };
    }
    const a = ri(rng, 1, 4), b = nz(rng, -5, 5), x = ri(rng, 1, 3);
    const P = a * x * x + b * x, Q = x * x * x - b;
    return {
      prompt: `$P(x) = ${a === 1 ? '' : a}x^2 ${b >= 0 ? '+' : '-'} ${Math.abs(b) === 1 ? '' : Math.abs(b)}x$ and $Q(x) = x^3 ${-b >= 0 ? '+' : '-'} ${Math.abs(b)}$. Find $P(${x}) + Q(${x})$.`,
      answerType: 'numeric', answer: { value: P + Q },
      traps: [{ value: P * Q, why: 'The question asks for the sum $P + Q$, not the product.' }].filter(t => t.value !== P + Q),
      hints: [`$P(${x}) = ${P}$.`, `$Q(${x}) = ${Q}$.`, 'Add the two values.'],
      steps: [{ h: 'Each value', d: `$P(${x}) = ${P}$ and $Q(${x}) = ${Q}$` }, { h: 'Add', d: `$${P} + ${Q} = ${P + Q}$` }]
    };
  },

  // ── Trigonometry C: non-right-angled triangles with exact values ──────────
  'y10-trig-nonright': (rng, diff) => {
    if (diff === 1) {
      const a = 2 * ri(rng, 2, 9), b = 2 * ri(rng, 2, 9), C = rc(rng, [30, 150]);
      return {
        prompt: `In triangle $ABC$, $a = ${a}$ cm, $b = ${b}$ cm and the included angle $C = ${C}^\\circ$. Find the area of the triangle, in cm². (Use $\\sin ${C}^\\circ = \\tfrac12$.)`,
        answerType: 'numeric', answer: { value: a * b / 4 }, answerSuffix: 'cm²',
        traps: [{ value: a * b / 2, why: 'Area $=\\tfrac12 ab\\sin C$ and $\\sin C = \\tfrac12$, so there is a second half.' }],
        hints: ['Area $=\\tfrac12 ab\\sin C$.', `$\\sin ${C}^\\circ = \\tfrac12$.`, `$\\tfrac12\\times ${a}\\times ${b}\\times\\tfrac12$.`],
        steps: [{ h: 'Formula', d: `$A = \\tfrac12(${a})(${b})\\sin ${C}^\\circ = \\tfrac12\\times ${a * b}\\times\\tfrac12 = ${a * b / 4}$ cm²` }]
      };
    }
    if (diff === 2) {
      const [a, b, c] = rc(rng, [[3, 8, 7], [5, 8, 7], [7, 15, 13], [8, 15, 13], [8, 3, 7], [8, 5, 7], [15, 7, 13], [15, 8, 13]]);
      return {
        prompt: `In triangle $ABC$, $a = ${a}$ cm, $b = ${b}$ cm and the angle between them is $C = 60^\\circ$. Find the length of $c$, in cm. (Use $\\cos 60^\\circ = \\tfrac12$.)`,
        answerType: 'numeric', answer: { value: c }, answerSuffix: 'cm',
        traps: [{ value: c * c, why: 'The cosine rule gives $c^2$; take the square root.' }],
        hints: ['$c^2 = a^2 + b^2 - 2ab\\cos C$.', `$2ab\\cos 60^\\circ = ${a * b}$.`, `$c^2 = ${a * a} + ${b * b} - ${a * b} = ${c * c}$.`],
        steps: [{ h: 'Cosine rule', d: `$c^2 = ${a * a} + ${b * b} - 2(${a})(${b})\\cdot\\tfrac12 = ${c * c}$` }, { h: 'Square root', d: `$c = ${c}$ cm` }]
      };
    }
    if (diff === 3) {
      const a = ri(rng, 3, 15);
      return {
        prompt: `In triangle $ABC$, $A = 30^\\circ$, $B = 90^\\circ$ and $a = ${a}$ cm. Use the sine rule to find $b$, in cm. (Use $\\sin 30^\\circ = \\tfrac12$.)`,
        answerType: 'numeric', answer: { value: 2 * a }, answerSuffix: 'cm',
        traps: [{ value: a / 2, why: 'The sine rule: $\\dfrac{a}{\\sin A} = \\dfrac{b}{\\sin B}$, so $b = a\\times\\dfrac{\\sin B}{\\sin A}$.' }],
        hints: ['$\\dfrac{a}{\\sin A} = \\dfrac{b}{\\sin B}$.', `$\\sin 30^\\circ = \\tfrac12$ and $\\sin 90^\\circ = 1$.`, `$b = ${a}\\times\\dfrac{1}{1/2}$.`],
        steps: [{ h: 'Sine rule', d: `$\\dfrac{${a}}{1/2} = \\dfrac{b}{1}$` }, { h: 'Solve', d: `$b = ${2 * a}$ cm` }]
      };
    }
    const [a, b, c] = rc(rng, [[3, 5, 7], [5, 3, 7], [7, 8, 13], [8, 7, 13], [5, 16, 19], [16, 5, 19]]);
    return {
      prompt: `In triangle $ABC$, $a = ${a}$ cm, $b = ${b}$ cm and the angle between them is $C = 120^\\circ$. Find the length of $c$, in cm. (Use $\\cos 120^\\circ = -\\tfrac12$.)`,
      answerType: 'numeric', answer: { value: c }, answerSuffix: 'cm',
      traps: [{ value: Math.sqrt(a * a + b * b - a * b), why: 'For $120^\\circ$ the cosine is negative, so the cosine rule ADDS $ab$.' }].filter(t => Number.isInteger(t.value) && t.value !== c),
      hints: ['$c^2 = a^2 + b^2 - 2ab\\cos C$ with $\\cos 120^\\circ = -\\tfrac12$.', `$-2ab\\cos 120^\\circ = +${a * b}$.`, `$c^2 = ${a * a} + ${b * b} + ${a * b} = ${c * c}$.`],
      steps: [{ h: 'Cosine rule', d: `$c^2 = ${a * a} + ${b * b} - 2(${a})(${b})(-\\tfrac12) = ${c * c}$` }, { h: 'Square root', d: `$c = ${c}$ cm` }]
    };
  },

  // ── Trigonometry D: exact values and equations for any angle ──────────────
  'y10-trig-any-angle': (rng, diff) => {
    if (diff === 1) {
      const k = ri(rng, 1, 9), m = ri(rng, 1, 9) + ((k + 1) % 2);
      const mm = (k + m) % 2 === 0 ? m : m + 1;
      return {
        prompt: `Evaluate $${k}\\sin 30^\\circ + ${mm}\\cos 60^\\circ$ exactly.`,
        answerType: 'numeric', answer: { value: (k + mm) / 2 },
        traps: [{ value: k + mm, why: '$\\sin 30^\\circ = \\cos 60^\\circ = \\tfrac12$, not 1.' }],
        hints: ['$\\sin 30^\\circ = \\tfrac12$ and $\\cos 60^\\circ = \\tfrac12$.', `$${k}\\times\\tfrac12 + ${mm}\\times\\tfrac12$.`, 'Add.'],
        steps: [{ h: 'Exact values', d: `$${k}(\\tfrac12) + ${mm}(\\tfrac12) = ${(k + mm) / 2}$` }]
      };
    }
    if (diff === 2) {
      const forms = [
        { tex: '\\sin 150^\\circ', f: k => k / 2, why: '$\\sin 150^\\circ = \\sin 30^\\circ = \\tfrac12$ (positive in the second quadrant).' },
        { tex: '\\cos 120^\\circ', f: k => -k / 2, why: '$\\cos 120^\\circ = -\\cos 60^\\circ = -\\tfrac12$ (negative in the second quadrant).' },
        { tex: '\\tan 135^\\circ', f: k => -k, why: '$\\tan 135^\\circ = -\\tan 45^\\circ = -1$ (negative in the second quadrant).' },
        { tex: '\\sin 210^\\circ', f: k => -k / 2, why: '$\\sin 210^\\circ = -\\sin 30^\\circ = -\\tfrac12$ (negative in the third quadrant).' }
      ];
      const f = rc(rng, forms), k = 2 * ri(rng, 1, 8);
      return {
        prompt: `Evaluate $${k}\\times ${f.tex}$ exactly.`,
        answerType: 'numeric', answer: { value: f.f(k) },
        traps: [{ value: -f.f(k), why: f.why }],
        hints: ['Find the reference angle and the sign for the quadrant.', f.why, `Multiply by $${k}$.`],
        steps: [{ h: 'Exact value', d: f.why }, { h: 'Multiply', d: `$${k}\\times(${f.f(k) / k}) = ${f.f(k)}$` }]
      };
    }
    const EQ = [
      { tex: '\\sin\\theta = \\tfrac12', sols: [30, 150] }, { tex: '\\cos\\theta = \\tfrac12', sols: [60, 300] },
      { tex: '\\cos\\theta = -\\tfrac12', sols: [120, 240] }, { tex: '\\tan\\theta = 1', sols: [45, 225] },
      { tex: '\\tan\\theta = -1', sols: [135, 315] }, { tex: '\\sin\\theta = -\\tfrac12', sols: [210, 330] }
    ];
    const e = rc(rng, EQ), small = diff === 3;
    return {
      prompt: `Solve $${e.tex}$ for $0^\\circ \\le \\theta \\le 360^\\circ$. Give the ${small ? 'smaller' : 'larger'} of the two solutions, in degrees.`,
      answerType: 'numeric', answer: { value: small ? e.sols[0] : e.sols[1] }, answerSuffix: '°',
      traps: [{ value: small ? e.sols[1] : e.sols[0], why: `There are two solutions in this range, ${e.sols[0]}° and ${e.sols[1]}°: choose the ${small ? 'smaller' : 'larger'}.` }],
      hints: ['Find the reference angle from the exact value.', 'Use the signs of the trigonometric ratios in the four quadrants.', `The two solutions are $${e.sols[0]}^\\circ$ and $${e.sols[1]}^\\circ$.`],
      steps: [{ h: 'Both solutions', d: `$\\theta = ${e.sols[0]}^\\circ$ or $${e.sols[1]}^\\circ$` }, { h: 'Choose', d: `The ${small ? 'smaller' : 'larger'} is $${small ? e.sols[0] : e.sols[1]}^\\circ$` }]
    };
  },

  // ── Deductive geometry ─────────────────────────────────────────────────────
  'y10-geometry-proof': (rng, diff) => {
    if (diff === 1) {
      const base = ri(rng, 35, 80);
      return {
        prompt: `In triangle $ABC$, $AB = AC$ and $\\angle ABC = ${base}^\\circ$. Find $\\angle BAC$, in degrees.`,
        answerType: 'numeric', answer: { value: 180 - 2 * base }, answerSuffix: '°',
        traps: [{ value: 180 - base, why: 'Equal sides have equal opposite angles, so $\\angle ACB = \\angle ABC$ too: both base angles are $' + base + '^\\circ$.' }],
        hints: ['Equal sides $AB = AC$ means $\\angle ACB = \\angle ABC$.', 'The angles of a triangle add to $180^\\circ$.', `$180 - 2\\times ${base}$.`],
        steps: [{ h: 'Isosceles triangle', d: `$\\angle ACB = \\angle ABC = ${base}^\\circ$` }, { h: 'Angle sum', d: `$\\angle BAC = 180 - ${2 * base} = ${180 - 2 * base}^\\circ$` }]
      };
    }
    if (diff === 2) {
      const [a, b, c] = rc(rng, TRIPLES), m = ri(rng, 1, 3);
      return {
        prompt: `The diagonals of a rhombus are $${2 * a * m}$ cm and $${2 * b * m}$ cm. Find the length of one side of the rhombus, in cm.`,
        answerType: 'numeric', answer: { value: c * m }, answerSuffix: 'cm',
        traps: [{ value: a * m + b * m, why: 'The diagonals of a rhombus bisect each other at right angles: use half of each diagonal and Pythagoras.' }],
        hints: ['The diagonals of a rhombus bisect each other at right angles.', `Half-diagonals: $${a * m}$ and $${b * m}$.`, 'A side is the hypotenuse of the right triangle they form.'],
        steps: [{ h: 'Half the diagonals', d: `$${a * m}$ cm and $${b * m}$ cm` }, { h: 'Pythagoras', d: `side$^2 = ${(a * m) ** 2} + ${(b * m) ** 2} = ${(c * m) ** 2}$, so the side is $${c * m}$ cm` }]
      };
    }
    if (diff === 3) {
      const x = ri(rng, 50, 120);
      return {
        prompt: `In parallelogram $ABCD$, $\\angle DAB = ${x}^\\circ$. Find $\\angle ABC$ and give its size in degrees.`,
        answerType: 'numeric', answer: { value: 180 - x }, answerSuffix: '°',
        traps: [{ value: x, why: 'Opposite angles of a parallelogram are equal, but adjacent angles are co-interior between parallel sides and add to $180^\\circ$.' }].filter(t => t.value !== 180 - x),
        hints: ['$AD \\parallel BC$, so $\\angle DAB$ and $\\angle ABC$ are co-interior angles.', 'Co-interior angles add to $180^\\circ$.', `$180 - ${x}$.`],
        steps: [{ h: 'Co-interior angles', d: `$\\angle ABC = 180 - ${x} = ${180 - x}^\\circ$` }]
      };
    }
    const s = ri(rng, 5, 14), x = ri(rng, 40, 80);
    return {
      prompt: `Triangle $ABC$ is congruent to triangle $DEF$ with $A$ matching $D$, $B$ matching $E$ and $C$ matching $F$. $AB = ${s}$ cm and $\\angle ABC = ${x}^\\circ$. Find $\\angle DEF$, in degrees.`,
      answerType: 'numeric', answer: { value: x }, answerSuffix: '°',
      traps: [{ value: s, why: 'Matching angles of congruent triangles are equal; the length $AB$ is not an angle.' }],
      hints: ['Corresponding parts of congruent triangles are equal.', '$B$ corresponds to $E$.', `So $\\angle DEF = \\angle ABC$.`],
      steps: [{ h: 'Correspondence', d: `$\\angle DEF = \\angle ABC = ${x}^\\circ$` }]
    };
  },

  // ── Circle geometry ────────────────────────────────────────────────────────
  'y10-circle-geometry': (rng, diff) => {
    if (diff === 1) {
      const x = ri(rng, 20, 80);
      return {
        prompt: `An arc subtends an angle of $${x}^\\circ$ at the circumference of a circle. What angle does the same arc subtend at the centre, in degrees?`,
        answerType: 'numeric', answer: { value: 2 * x }, answerSuffix: '°',
        traps: [{ value: x / 2, why: 'The angle at the centre is twice the angle at the circumference.' }],
        hints: ['The angle at the centre is twice the angle at the circumference on the same arc.', `$2\\times ${x}$.`, 'Check that the answer is the larger angle.'],
        steps: [{ h: 'Circle theorem', d: `$2\\times ${x} = ${2 * x}^\\circ$` }]
      };
    }
    if (diff === 2) {
      const x = ri(rng, 50, 130);
      return {
        prompt: `$ABCD$ is a cyclic quadrilateral with $\\angle ABC = ${x}^\\circ$. Find $\\angle ADC$, in degrees.`,
        answerType: 'numeric', answer: { value: 180 - x }, answerSuffix: '°',
        traps: [{ value: x, why: 'Opposite angles of a cyclic quadrilateral add to $180^\\circ$; they are not equal.' }].filter(t => t.value !== 180 - x),
        hints: ['Opposite angles of a cyclic quadrilateral are supplementary.', `$\\angle ADC + ${x} = 180$.`, `$180 - ${x}$.`],
        steps: [{ h: 'Cyclic quadrilateral', d: `$\\angle ADC = 180 - ${x} = ${180 - x}^\\circ$` }]
      };
    }
    if (diff === 3) {
      const x = ri(rng, 20, 65);
      return {
        prompt: `$PT$ is a tangent to a circle with centre $O$, touching it at $T$. $\\angle OPT = ${x}^\\circ$. Find $\\angle POT$, in degrees.`,
        answerType: 'numeric', answer: { value: 90 - x }, answerSuffix: '°',
        traps: [{ value: 180 - x, why: 'A tangent meets the radius at $90^\\circ$, so triangle $OTP$ has a right angle at $T$.' }],
        hints: ['A tangent is perpendicular to the radius at the point of contact: $\\angle OTP = 90^\\circ$.', 'The angles of triangle $OTP$ add to $180^\\circ$.', `$180 - 90 - ${x}$.`],
        steps: [{ h: 'Tangent and radius', d: `$\\angle OTP = 90^\\circ$` }, { h: 'Angle sum', d: `$\\angle POT = 180 - 90 - ${x} = ${90 - x}^\\circ$` }]
      };
    }
    const [r, t, d] = rc(rng, [[5, 12, 13], [3, 4, 5], [8, 15, 17], [6, 8, 10]]), m = ri(rng, 1, 3);
    return {
      prompt: `A point $P$ is $${d * m}$ cm from the centre of a circle of radius $${r * m}$ cm. Find the length of the tangent from $P$ to the circle, in cm.`,
      answerType: 'numeric', answer: { value: t * m }, answerSuffix: 'cm',
      traps: [{ value: d * m - r * m, why: 'The tangent and the radius to the point of contact are perpendicular: use Pythagoras with $OP$ as the hypotenuse.' }].filter(x => x.value !== t * m),
      hints: ['The radius to the point of contact is perpendicular to the tangent.', `$OP$ is the hypotenuse: $${d * m}$ cm.`, `Tangent$^2 = ${d * m}^2 - ${r * m}^2$.`],
      steps: [{ h: 'Right angle at the contact point', d: `tangent$^2 = ${(d * m) ** 2} - ${(r * m) ** 2} = ${(t * m) ** 2}$` }, { h: 'Square root', d: `The tangent is $${t * m}$ cm` }]
    };
  },

  // ── Introduction to networks ───────────────────────────────────────────────
  'y10-networks': (rng, diff) => {
    const V = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
    if (diff <= 2) {
      // Degrees are read off a real simple graph, so the sequence can exist; level 2 is connected.
      const n = ri(rng, 4, 7);
      const edges = [];
      const has = (u, v) => edges.some(([x, y]) => (x === u && y === v) || (x === v && y === u));
      if (diff === 2) for (let i = 1; i < n; i++) edges.push([ri(rng, 0, i - 1), i]);
      for (let e = ri(rng, 2, n); e > 0; e--) { const u = ri(rng, 0, n - 1), v = ri(rng, 0, n - 1); if (u !== v && !has(u, v)) edges.push([u, v]); }
      const degs = Array.from({ length: n }, (_, i) => edges.filter(([u, v]) => u === i || v === i).length);
      const listed = degs.map((d, i) => `${V[i]} has degree ${d}`).join(', ');
      if (diff === 1) {
        return {
          prompt: `A simple network (no loops, no repeated edges) has ${n} vertices: ${listed}. How many edges does it have?`,
          answerType: 'numeric', answer: { value: edges.length },
          traps: [{ value: edges.length * 2, why: 'Each edge adds 1 to the degree of two vertices, so the degrees add to twice the number of edges.' }],
          hints: ['The sum of the degrees is twice the number of edges.', `$${degs.join(' + ')} = ${degs.reduce((x, y) => x + y, 0)}$.`, 'Halve it.'],
          steps: [{ h: 'Degree sum', d: `$${degs.join(' + ')} = ${edges.length * 2}$` }, { h: 'Edges', d: `$${edges.length * 2}\\div 2 = ${edges.length}$` }]
        };
      }
      const odd = degs.filter(d => d % 2 === 1).length;
      return {
        prompt: `A connected simple network has ${n} vertices: ${listed}. How many vertices have an odd degree?`,
        answerType: 'numeric', answer: { value: odd },
        traps: [{ value: n - odd, why: 'Count the odd degrees, not the even ones.' }].filter(t => t.value !== odd),
        hints: ['A degree is odd if it is not divisible by 2.', `The degrees are ${degs.join(', ')}.`, 'Count the odd ones.'],
        steps: [{ h: 'Odd degrees', d: `${degs.filter(d => d % 2 === 1).join(', ') || 'none'}: ${odd} of them` }]
      };
    }
    // Levels 3 and 4: a small weighted network
    for (let tries = 0; tries < 400; tries++) {
      const n = diff === 3 ? 5 : 6;
      const edges = [];
      for (let i = 1; i < n; i++) edges.push([ri(rng, 0, i - 1), i, ri(rng, 2, 12)]);
      for (let e = 0; e < n; e++) { const u = ri(rng, 0, n - 1), v = ri(rng, 0, n - 1); if (u !== v && !edges.some(([a, b]) => (a === u && b === v) || (a === v && b === u))) edges.push([u, v, ri(rng, 2, 12)]); }
      const f = graphFacts(n, edges);
      if (!f.connected) continue;
      const list = edges.map(([u, v, w]) => `${V[u]}–${V[v]} ${w}`).join(', ');
      if (diff === 3) {
        const dist = f.d[0][n - 1];
        return {
          prompt: `A network has the weighted edges ${list}. Find the length of the shortest path from $A$ to $${V[n - 1]}$.`,
          answerType: 'numeric', answer: { value: dist },
          traps: [{ value: f.mst, why: 'A shortest path joins two particular vertices; a spanning tree joins them all.' }].filter(t => t.value !== dist),
          hints: ['List the routes from $A$ and add the edge weights.', 'Check that no shorter route exists.', 'Work outward from $A$, keeping the smallest total to each vertex.'],
          steps: [{ h: 'Shortest distance', d: `The smallest total from $A$ to $${V[n - 1]}$ is $${dist}$` }]
        };
      }
      return {
        prompt: `A network has the weighted edges ${list}. Find the total weight of a minimum spanning tree.`,
        answerType: 'numeric', answer: { value: f.mst },
        traps: [{ value: edges.reduce((s, e) => s + e[2], 0), why: 'A spanning tree uses only $n - 1$ edges and none may form a cycle.' }].filter(t => t.value !== f.mst),
        hints: ['Order the edges from smallest to largest weight.', 'Add each edge unless it makes a cycle.', `A tree on ${n} vertices has ${n - 1} edges.`],
        steps: [{ h: 'Greedy method', d: `Taking the smallest edges that join new vertices gives a total of $${f.mst}$` }]
      };
    }
    throw new Error('y10-networks: no connected network found');
  }
};
