// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Prithagoras content-gap forms F (Extension 1, Year 11)
//   me11-poly      D4 (harder polynomial structures: unknown coefficients from two
//                      factors, remainder on division by a quadratic, roots in
//                      arithmetic progression, bi-quadratic equations, polynomial
//                      inequalities, repeated roots)
//   me11-functions D2 (domain and one-to-one restrictions for inverses)
// Variants are chosen by au-forms-apply.js. Every key is computed in code from the
// numbers the prompt shows (the AI never sets a mark); every key is an integer or
// a set of integers. All forms are original. SYNTHETIC: no student or examiner
// evidence.
// ─────────────────────────────────────────────────────────────────────────────
import { ri, rc, nz, gcd, poly, term, sgn } from '../qhelpers.js';

const REJ = Symbol('reject');
const rej = cond => { if (cond) throw REJ; };
/** Re-draw (same rng, so still deterministic) until a variant accepts its numbers. */
/** The key as text, for the hint check below. */
const keyTexts = q => {
  const a = q.answer || {};
  if (Array.isArray(a.values)) return [a.values.join(", ")];   // naming one root of several is not the whole answer
  if (a.expr !== undefined) return [String(a.expr)];
  return a.value !== undefined ? [String(a.canonicalInput ?? a.value)] : [];
};
/** A hint that writes "= key", "is key", "gives key" or "answer key" states the final answer, even when the same
 *  number only turns up by coincidence in an intermediate line: such a draw is not used. */
const hintStatesKey = q => keyTexts(q).some(k => (q.hints || []).some(h => new RegExp(`(?:=|\\bis\\b|\\bequals\\b|\\bgives\\b|\\banswer\\b|\\bresult\\b)\\s*\\$?\\s*${k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?!\\d|\\.\\d|[\\\\A-Za-z])`).test(String(h).replace(/\s+/g, ' '))));
const R = fn => (rng, diff) => {
  for (let i = 0; i < 300; i++) {
    try { const q = fn(rng, diff); if (hintStatesKey(q)) continue; return q; } catch (e) { if (e !== REJ) throw e; }
  }
  throw new Error('gaps-f variant: no acceptable draw');
};
const V = (diffs, fn) => ({ diffs, make: R(fn) });

const lead = m => (m === 1 ? '' : m === -1 ? '-' : String(m));
const ax = v => (v === 1 ? 'a' : v === -1 ? '-a' : `${v}a`);
const par = v => (v < 0 ? `(${v})` : String(v));
const fin = v => typeof v === 'number' && Number.isFinite(v);
const sortNum = a => [...a].sort((x, y) => x - y);
/** Keep only distinct, finite numeric traps that differ from the key. */
const keepT = (key, list) => {
  const seen = new Set([key]);
  return list.filter(t => {
    if (!fin(t.value) || seen.has(t.value)) return false;
    seen.add(t.value);
    return true;
  });
};
/** a(x-h)^2 + k as TeX (h and k signed). */
const vertexTex = (a, h, k) => `${lead(a)}(x ${sgn(-h)})^2 ${sgn(k)}`;

function numQ(prompt, key, { prefix, suffix, traps = [], hints, steps, dotpoint, hint, stepcheck } = {}) {
  rej(!fin(key) || !Number.isInteger(key));
  const q = { dotpoint, prompt, answerType: 'numeric', answer: { value: key }, traps: keepT(key, traps), hints, steps };
  if (prefix) q.answerPrefix = prefix;
  if (suffix) q.answerSuffix = suffix;
  if (hint) q.inputHint = hint;
  if (stepcheck) q.stepcheck = stepcheck;
  return q;
}

// ═══════════════════════ me11-poly · D4 ═════════════════════════════════════
// Cell D4 exercises dot point 2 (solve polynomial equations); forms carry their own
// honest dot point (0 factor/remainder theorem, 1 roots and coefficients, 2 solving).
const polyForms = [
  // The equations solved over the rationals (rational root theorem; fractional roots, a repeated root): the forms that
  // used to be the direct form of this cell (dot point 2).
  V([4], rng => {
    // Solving over the rationals: the rational root theorem narrows the search,
    // and the factors that come out need not have leading coefficient 1.
    const branch = ri(rng, 0, 2);
    if (branch === 0) {
      const p = rc(rng, [2, 3]);
      let q = nz(rng, -7, 7);
      for (let guard = 0; gcd(Math.abs(q), p) !== 1 && guard < 40; guard++) q = nz(rng, -7, 7);
      if (gcd(Math.abs(q), p) !== 1) rej(true);
      const r = nz(rng, -5, 5);
      let s = nz(rng, -5, 5);
      if (s === r) s = r === 5 ? -1 : r + 1;
      const c3 = p, c2 = -(p * (r + s) + q), c1 = p * r * s + q * (r + s), c0 = -q * r * s;
      return {
        prompt: `Solve $${poly([c3, c2, c1, c0])} = 0$ over the rationals.`,
        answerType: 'set', answer: { values: [q / p, r, s] },
        inputHint: 'e.g. x = 3/2, -1, 4',
        traps: [
          { value: q, why: `A factor $(${p}x ${sgn(-q)})$ is zero at $x = \\dfrac{${q}}{${p}}$, not at $x = ${q}$ — divide by the leading $${p}$.` },
          { value: c0, why: 'The rational root theorem says a root is $\\pm\\dfrac{\\text{factor of the constant}}{\\text{factor of the leading coefficient}}$ — the constant term itself is rarely a root.' }
        ],
        hints: [`By the rational root theorem any rational root is $\\pm\\dfrac{p}{q}$ with $p \\mid ${Math.abs(c0)}$ and $q \\mid ${p}$.`,
          `Testing the integer candidates finds $x = ${r}$, so $(x ${sgn(-r)})$ is a factor.`,
          `Dividing out leaves $(${p}x ${sgn(-q)})(x ${sgn(-s)})$, and one root is a fraction.`],
        steps: [
          { h: 'Candidate rational roots', d: `$\\pm\\dfrac{\\text{factors of } ${Math.abs(c0)}}{\\text{factors of } ${p}}$` },
          { h: 'Factorise fully', d: `$${poly([c3, c2, c1, c0])} = (${p}x ${sgn(-q)})(x ${sgn(-r)})(x ${sgn(-s)})$` },
          { h: 'Null factor law', d: `$x = \\dfrac{${q}}{${p}}$, $\\ x = ${r}$, $\\ x = ${s}$` }
        ]
      };
    }
    if (branch === 1) {
      const p = rc(rng, [2, 3]), r = rc(rng, [2, 3]);
      let q = nz(rng, -5, 5), s = nz(rng, -5, 5);
      for (let guard = 0; (gcd(Math.abs(q), p) !== 1 || gcd(Math.abs(s), r) !== 1 || q * r === s * p) && guard < 60; guard++) {
        q = nz(rng, -5, 5); s = nz(rng, -5, 5);
      }
      if (gcd(Math.abs(q), p) !== 1 || gcd(Math.abs(s), r) !== 1 || q * r === s * p) rej(true);
      const t = nz(rng, -4, 4);
      const c3 = p * r, c2 = -(p * s + q * r + p * r * t), c1 = q * s + (p * s + q * r) * t, c0 = -q * s * t;
      return {
        prompt: `Solve $${poly([c3, c2, c1, c0])} = 0$ over the rationals.`,
        answerType: 'set', answer: { values: [q / p, s / r, t] },
        inputHint: 'e.g. x = 1/2, -2/3, 4',
        traps: [
          { value: q * s, why: 'Two of the three roots here are fractions — the leading coefficient does not divide out neatly into integer roots.' },
          { value: t, why: `$x = ${t}$ is only **one** of the three solutions; the question asks for all of them.` }
        ],
        hints: [`The leading coefficient is $${c3} = ${p} \\times ${r}$, so denominators of $${p}$ and $${r}$ are both possible.`,
          `The integer root is $x = ${t}$; divide $(x ${sgn(-t)})$ out first.`,
          `What is left factorises as $(${p}x ${sgn(-q)})(${r}x ${sgn(-s)})$.`],
        steps: [
          { h: 'Find the integer root', d: `$P(${t}) = 0$, so $(x ${sgn(-t)})$ is a factor` },
          { h: 'Factorise the quadratic left behind', d: `$(${p}x ${sgn(-q)})(${r}x ${sgn(-s)})$` },
          { h: 'Null factor law', d: `$x = \\dfrac{${q}}{${p}}$, $\\ x = \\dfrac{${s}}{${r}}$, $\\ x = ${t}$` }
        ]
      };
    }
    const p = rc(rng, [2, 3]);
    let q = nz(rng, -6, 6);
    for (let guard = 0; gcd(Math.abs(q), p) !== 1 && guard < 40; guard++) q = nz(rng, -6, 6);
    if (gcd(Math.abs(q), p) !== 1) rej(true);
    const t = nz(rng, -5, 5);
    const c3 = p * p, c2 = -(2 * p * q + p * p * t), c1 = q * q + 2 * p * q * t, c0 = -q * q * t;
    return {
      prompt: `Solve $${poly([c3, c2, c1, c0])} = 0$ over the rationals, listing each **distinct** solution once.`,
      answerType: 'set', answer: { values: [q / p, t] },
      inputHint: 'e.g. x = 3/2, -4',
      traps: [
        { value: q, why: `$(${p}x ${sgn(-q)})^2 = 0$ gives $x = \\dfrac{${q}}{${p}}$ — the leading $${p}$ still has to be divided out.` },
        { value: c0, why: 'The constant term is not a root here. Use the rational root theorem to narrow the candidates first.' }
      ],
      hints: [`The cubic has a **repeated** rational factor.`,
        `$x = ${t}$ is one root; dividing $(x ${sgn(-t)})$ out leaves a perfect square.`,
        `That square is $(${p}x ${sgn(-q)})^2$.`],
      steps: [
        { h: 'Factorise', d: `$${poly([c3, c2, c1, c0])} = (${p}x ${sgn(-q)})^2(x ${sgn(-t)})$` },
        { h: 'Null factor law', d: `$(${p}x ${sgn(-q)})^2 = 0 \\Rightarrow x = \\dfrac{${q}}{${p}}$ (twice); $\\ x = ${t}$` },
        { h: 'Distinct solutions', d: `$x = \\dfrac{${q}}{${p}}$ or $x = ${t}$` }
      ]
    };
  }),
  // Two factors given, two unknown coefficients (dot point 0).
  V([4], rng => {
    const m = rc(rng, [1, 1, 2, 3]);
    const p = nz(rng, -4, 4), q = nz(rng, -4, 4), r = nz(rng, -4, 4);
    rej(p === q || p === r || q === r);
    const A = -m * (p + q + r), B = m * (p * q + p * r + q * r), C = -m * p * q * r;
    rej(A === 0 || B === 0 || Math.abs(C) > 60);
    const ask = rc(rng, ['a', 'b', 'sum']);
    const key = ask === 'a' ? A : ask === 'b' ? B : A + B;
    // solve the pair of equations for given roots (p, q) and constant C; may be fractional
    const solve = (u, v) => {
      const det = u * u * v - v * v * u;
      if (det === 0) return null;
      const ru = -(m * u ** 3 + C), rv = -(m * v ** 3 + C);
      return { a: (ru * v - rv * u) / det, b: (u * u * rv - v * v * ru) / det };
    };
    const wrong = solve(-p, -q);
    const wrongVal = wrong ? (ask === 'a' ? wrong.a : ask === 'b' ? wrong.b : wrong.a + wrong.b) : NaN;
    const eq = u => `${u * u === 1 ? '' : u * u}a ${sgn(u)}b = ${-(m * u ** 3 + C)}`;
    const what = ask === 'a' ? 'the value of $a$' : ask === 'b' ? 'the value of $b$' : 'the value of $a + b$';
    return numQ(
      `The polynomial $P(x) = ${lead(m)}x^3 + ax^2 + bx ${sgn(C)}$ has $(x ${sgn(-p)})$ and $(x ${sgn(-q)})$ as factors. Find ${what}.`,
      key,
      {
        dotpoint: 0, prefix: ask === 'sum' ? 'a + b =' : `${ask} =`,
        traps: [
          { value: wrongVal, why: `A factor $(x ${sgn(-p)})$ means $P(${p}) = 0$ — use the value that makes the factor zero, not its negative.` },
          { value: ask === 'sum' ? A - B : ask === 'a' ? B : A, why: ask === 'sum' ? 'Add the two coefficients: the question asks for $a + b$, not $a - b$.' : `That is the other coefficient. Check which unknown you were asked for.` }
        ],
        hints: ['The factor theorem: if $(x - c)$ is a factor then $P(c) = 0$. Apply it to both factors.',
          `Substitute $x = ${p}$ and $x = ${q}$ into $P(x)$ and set each result to $0$. That gives two linear equations in $a$ and $b$.`,
          'Solve the pair of equations simultaneously, for example by eliminating $b$.'],
        steps: [
          { h: 'Factor theorem at the first zero', d: `$P(${p}) = 0 \\Rightarrow ${eq(p)}$` },
          { h: 'Factor theorem at the second zero', d: `$P(${q}) = 0 \\Rightarrow ${eq(q)}$` },
          { h: 'Solve simultaneously', d: `$a = ${A}$, $\\ b = ${B}$` },
          { h: 'Answer', d: `${what.replace('the value of ', '')} $= ${key}$` }
        ]
      }
    );
  }),

  // Remainder on division by a quadratic from two remainders (dot point 0).
  V([4], rng => {
    const p = nz(rng, -5, 5), q = nz(rng, -5, 5);
    rej(p === q);
    const m = nz(rng, -6, 6), c = nz(rng, -9, 9);
    const r1 = m * p + c, r2 = m * q + c;
    rej(r1 === 0 || r2 === 0 || r1 === r2);
    const key = `(${m})*x + (${c})`;
    return {
      dotpoint: 0,
      prompt: `A polynomial $P(x)$ leaves remainder $${r1}$ when divided by $(x ${sgn(-p)})$ and remainder $${r2}$ when divided by $(x ${sgn(-q)})$. Find the remainder when $P(x)$ is divided by $(x ${sgn(-p)})(x ${sgn(-q)})$.`,
      answerType: 'expression', answer: { expr: key }, inputHint: 'e.g. 3x - 2',
      traps: [
        { expr: `(${-m})*x + (${c})`, why: `Substitute the **zeroes** $x = ${p}$ and $x = ${q}$ into $ax + b$ — the factors $(x ${sgn(-p)})$ and $(x ${sgn(-q)})$ are zero at $${p}$ and $${q}$, not at $${-p}$ and $${-q}$.` },
        { expr: `(${m})*x + (${r1})`, why: `$b$ is the remainder on division by the quadratic's constant part, not $${r1}$: the first condition is $a(${p}) + b = ${r1}$, so $b$ must have $${m * p}$ taken off.` }
      ],
      hints: ['Dividing by a quadratic leaves a remainder of degree at most $1$, so write $P(x) = (x - p)(x - q)Q(x) + ax + b$.',
        `Put $x = ${p}$ and $x = ${q}$: each makes the quadratic factor vanish, so $${ax(p)} + b$ and $${ax(q)} + b$ equal the given remainders.`,
        'Subtract the two equations to find $a$, then substitute back to find $b$.'],
      steps: [
        { h: 'Form of the remainder', d: `$P(x) = (x ${sgn(-p)})(x ${sgn(-q)})Q(x) + ax + b$` },
        { h: 'Use the two remainders', d: `$P(${p}) = ${ax(p)} + b = ${r1}$ and $P(${q}) = ${ax(q)} + b = ${r2}$` },
        { h: 'Subtract', d: `$${ax(p - q)} = ${r1 - r2} \\Rightarrow a = ${m}$` },
        { h: 'Back-substitute', d: `$b = ${r1} - ${par(m)}(${p}) = ${c}$, so the remainder is $${poly([m, c])}$` }
      ]
    };
  }),

  // Remainder of an explicit polynomial on division by (x-p)(x-q) (dot point 0).
  V([4], rng => {
    const deg = rc(rng, [3, 4]);
    const cs = deg === 3 ? [rc(rng, [1, 2, -1]), ri(rng, -4, 4), ri(rng, -6, 6), ri(rng, -8, 8)]
      : [rc(rng, [1, 2, -1]), ri(rng, -3, 3), ri(rng, -4, 4), ri(rng, -6, 6), ri(rng, -8, 8)];
    const p = ri(rng, -3, 2), q = ri(rng, p + 1, 3);
    rej(p === q || p === 0 || q === 0);
    const ev = x => cs.reduce((acc, c) => acc * x + c, 0);
    const vp = ev(p), vq = ev(q);
    const m = (vq - vp) / (q - p), c = vp - m * p;
    rej(!Number.isInteger(m) || m === 0 || c === 0 || Math.abs(m) > 60 || Math.abs(c) > 80);
    return {
      dotpoint: 0,
      prompt: `Find the remainder when $P(x) = ${poly(cs)}$ is divided by $(x ${sgn(-p)})(x ${sgn(-q)})$.`,
      answerType: 'expression', answer: { expr: `(${m})*x + (${c})` }, inputHint: 'e.g. 5x - 7',
      traps: [
        { expr: `(${vp})`, why: `A constant is the remainder on division by a **linear** factor. Dividing by a quadratic leaves a remainder of degree at most $1$.` },
        { expr: `(${-m})*x + (${c})`, why: 'Check the signs of the zeroes you substituted, and the order of the two subtractions when finding the slope.' }
      ],
      hints: ['The remainder has the form $ax + b$, because the divisor has degree $2$.',
        `Evaluate $P(${p})$ and $P(${q})$: they equal $${ax(p)} + b$ and $${ax(q)} + b$.`,
        'Solve those two equations for $a$ and $b$.'],
      steps: [
        { h: 'Form of the remainder', d: `$P(x) = (x ${sgn(-p)})(x ${sgn(-q)})Q(x) + ax + b$` },
        { h: 'Evaluate at the zeroes', d: `$P(${p}) = ${vp}$ and $P(${q}) = ${vq}$` },
        { h: 'Two equations', d: `$${ax(p)} + b = ${vp}$ and $${ax(q)} + b = ${vq}$` },
        { h: 'Solve', d: `$a = ${m}$, $\\ b = ${c}$, remainder $${poly([m, c])}$` }
      ]
    };
  }),

  // Roots in arithmetic progression: the sum of the roots fixes the middle root (dot point 1).
  V([4], rng => {
    const r = nz(rng, -4, 4), e = ri(rng, 1, 4);
    rej(r === e || r === -e);
    const B = -3 * r, D = -r * (r * r - e * e), K = 3 * r * r - e * e;
    rej(B === 0 || D === 0 || K === 0 || Math.abs(D) > 60);
    return numQ(
      `The equation $x^3 ${sgn(B)}x^2 + kx ${sgn(D)} = 0$ has three real roots that form an arithmetic progression. Find the value of $k$.`,
      K,
      {
        dotpoint: 1, prefix: 'k =',
        traps: [
          { value: r, why: `$${r}$ is the **middle** root, found from the sum of the roots $= ${3 * r}$. The question asks for the coefficient $k$.` },
          { value: 3 * r * r + e * e, why: 'The sum of the products of the roots two at a time is $\\alpha\\beta+\\alpha\\gamma+\\beta\\gamma$ with $(\\alpha-d)(\\alpha+d) = \\alpha^2 - d^2$, so the $d^2$ is **subtracted**.' }
        ],
        hints: ['Call the roots $\\alpha - d$, $\\alpha$ and $\\alpha + d$. Their sum is $3\\alpha$.',
          'The sum of the roots is $-\\dfrac{b}{a}$ for $ax^3 + bx^2 + cx + d$. Use it to find the middle root.',
          'The middle root satisfies the equation. Substitute it and solve for $k$ (or use the product of the roots to find $d$ first).'],
        steps: [
          { h: 'Name the roots', d: `$\\alpha - d,\\ \\alpha,\\ \\alpha + d$` },
          { h: 'Sum of roots', d: `$3\\alpha = ${-B} \\Rightarrow \\alpha = ${r}$` },
          { h: 'The middle root satisfies the equation', d: `$${par(r)}^3 ${sgn(B)}(${par(r)})^2 + k(${par(r)}) ${sgn(D)} = 0$` },
          { h: 'Solve for k', d: `$k = ${K}$` }
        ]
      }
    );
  }),

  // Quartic that is a quadratic in x^2 (dot point 2).
  V([4], rng => {
    const m = rc(rng, [1, 1, 2, 3]);
    const both = rng() < 0.6;
    const s = ri(rng, 1, 4);
    let values, B, C, nTxt;
    if (both) {
      const t = ri(rng, 1, 5);
      rej(s === t);
      B = -m * (s * s + t * t); C = m * s * s * t * t;
      values = sortNum([-s, s, -t, t]);
      nTxt = `$${s * s}$ and $${t * t}$`;
    } else {
      const n = ri(rng, 1, 8);
      rej(n === s * s);
      B = m * (n - s * s); C = -m * n * s * s;
      values = sortNum([-s, s]);
      nTxt = `$${s * s}$ or $-${n}$`;
    }
    rej(B === 0 || Math.abs(C) > 400);
    const P = poly([m, 0, B, 0, C]);
    const us = both ? [s * s, (values[3] === s ? values[2] : values[3]) ** 2] : [s * s, -(C / (-m * s * s))];
    const sq = Math.max(...us);
    return {
      dotpoint: 2,
      prompt: `Find all real solutions of $${P} = 0$.`,
      answerType: 'set', answer: { values }, inputHint: 'e.g. x = ±2, ±5',
      stepcheck: { kind: 'equation', variable: 'x', solutions: values },
      traps: [
        { value: sq, why: `$x^2 = ${sq}$ is the value of the **square**. Take the square root, and remember both $+$ and $-$.` },
        { value: -B / m, why: `$${-B / m}$ is the sum of the two values of $x^2$, not a solution.` }
      ].filter(t => !values.includes(t.value)),
      hints: ['There are only even powers of $x$, so substitute $u = x^2$ to get a quadratic.',
        `Factorise the quadratic in $u$. Its roots are ${nTxt}.`,
        'Each positive value of $u$ gives two values of $x$; a negative value of $u$ gives no real $x$.'],
      steps: [
        { h: 'Substitute u = x²', d: `$${poly([m, B, C], 'u')} = 0$` },
        { h: 'Factorise', d: `$${lead(m)}(u ${sgn(-us[0])})(u ${sgn(-us[1])}) = 0$` },
        { h: 'Return to x', d: `Keep only $u \\ge 0$ and take $x = \\pm\\sqrt{u}$` },
        { h: 'Solutions', d: `$x = ${values.join(',\\ ')}$` }
      ]
    };
  }),

  // Polynomial inequality with three integer zeroes: sum of the integer solutions in a stated range (dot point 2).
  V([4], rng => {
    const m = rc(rng, [1, 1, 2, -1, -2]);
    const z = sortNum([nz(rng, -5, 5), nz(rng, -5, 5), nz(rng, -5, 5)]);
    rej(z[0] === z[1] || z[1] === z[2] || z[1] - z[0] < 2 || z[2] - z[1] < 2);
    const [a, b, c] = z;
    const strict = rng() < 0.5;
    const P = x => m * (x - a) * (x - b) * (x - c);
    const cs = [m, -m * (a + b + c), m * (a * b + a * c + b * c), -m * a * b * c];
    const holds = (x, st) => (st ? P(x) > 0 : P(x) >= 0);
    // m > 0: P >= 0 on [a, b] and [c, inf), bounded above by U. m < 0: on (-inf, a] and [b, c], bounded below by L.
    const bound = m > 0 ? c + ri(rng, 2, 4) : a - ri(rng, 2, 4);
    const lo = m > 0 ? a - 3 : bound, hi = m > 0 ? bound : c + 3;
    const sumOver = st => { let s = 0; for (let x = lo; x <= hi; x++) if (holds(x, st)) s += x; return s; };
    const key = sumOver(strict);
    rej(key === 0);
    const only = pred => { let s = 0; for (let x = lo; x <= hi; x++) if (holds(x, strict) && pred(x)) s += x; return s; };
    const lastPiece = m > 0 ? only(x => x >= c) : only(x => x >= b);
    const sym = strict ? '>' : '\\ge';
    const bTxt = m > 0 ? `$x \\le ${bound}$` : `$x \\ge ${bound}$`;
    return numQ(
      `Let $P(x) = ${poly(cs)}$. Find the sum of all the integers $x$ with ${bTxt} that satisfy $P(x) ${sym} 0$.`,
      key,
      {
        dotpoint: 2,
        traps: [
          { value: sumOver(!strict), why: strict ? 'The inequality is strict, so the zeroes of $P$ themselves are **not** solutions.' : 'The inequality is $\\ge 0$, so the zeroes of $P$ themselves **are** solutions.' },
          { value: lastPiece, why: 'The solution set has two separate pieces. Both contribute integers to the sum.' }
        ],
        hints: ['Find the three integer zeroes of $P$ (try small factors of the constant term with the factor theorem).',
          `Sketch the sign of $P$: the leading coefficient is ${m > 0 ? 'positive' : 'negative'}, and the sign changes at each simple zero.`,
          `List the integers in each region where $P(x) ${strict ? '>' : '\\ge'} 0$ within the stated range, then add them.`],
        steps: [
          { h: 'Factorise', d: `$P(x) = ${lead(m)}(x ${sgn(-a)})(x ${sgn(-b)})(x ${sgn(-c)})$` },
          { h: 'Sign of P', d: m > 0 ? `$P > 0$ on $(${a}, ${b})$ and for $x > ${c}$` : `$P > 0$ for $x < ${a}$ and on $(${b}, ${c})$` },
          { h: 'Apply the range and the inequality', d: `Take the integers in these regions with ${bTxt}${strict ? '' : ', including the zeroes'}` },
          { h: 'Add', d: `Sum $= ${key}$` }
        ]
      }
    );
  }),

  // Repeated root: all values of k (dot point 2).
  V([4], rng => {
    const r1 = ri(rng, -4, 4), r2 = ri(rng, -4, 4);
    rej(r1 === r2 || (r1 + r2) % 2 !== 0);
    const B = -3 * (r1 + r2) / 2, C = 3 * r1 * r2;
    rej(B === 0 || C === 0);
    const kOf = r => -(r ** 3 + B * r * r + C * r);
    const values = sortNum([kOf(r1), kOf(r2)]);
    rej(values[0] === values[1] || Math.abs(values[0]) > 400 || Math.abs(values[1]) > 400);
    return {
      dotpoint: 2,
      prompt: `Find all values of $k$ for which the equation $${poly([1, B, C, 0])} + k = 0$ has a repeated root.`,
      answerType: 'set', answer: { values }, inputHint: 'e.g. k = -4, 27',
      traps: [
        { value: r1, why: `$${r1}$ is a possible position of the repeated root, not a value of $k$. Substitute it into the equation to find $k$.` },
        { value: r2, why: `$${r2}$ is a possible position of the repeated root, not a value of $k$. Substitute it into the equation to find $k$.` }
      ].filter(t => !values.includes(t.value)),
      hints: ['A repeated root of $P(x) = 0$ is a root of both $P(x)$ and $P\'(x)$.',
        `Solve $P'(x) = ${poly([3, 2 * B, C])} = 0$ to find where a repeated root can sit.`,
        'Substitute each of those $x$-values into $P(x) = 0$ and solve for $k$.'],
      steps: [
        { h: 'A repeated root is a root of the derivative', d: `$P'(x) = ${poly([3, 2 * B, C])} = 3(x ${sgn(-r1)})(x ${sgn(-r2)})$` },
        { h: 'Candidate positions', d: `$x = ${r1}$ or $x = ${r2}$` },
        { h: 'Substitute into P(x) = 0', d: `$k = -\\left(${par(r1)}^3 ${sgn(B)}(${par(r1)})^2 ${sgn(C)}(${par(r1)})\\right)$ and likewise for $x = ${r2}$` },
        { h: 'Both values of k', d: `$k = ${values[0]}$ or $k = ${values[1]}$` }
      ]
    };
  })
];

// ═══════════════════════ me11-functions · D2 ═════════════════════════════════
// Cell D2 exercises dot point 1 (domain restrictions); forms carry their own dot point.
const funcForms = [
  // Vertex form, leading coefficient not 1: the restriction is keyed on the vertex x (dot point 1).
  V([2], rng => {
    const a = rc(rng, [2, 3, 4, -2, -3, -1]);
    const h = nz(rng, -6, 6), k = nz(rng, -9, 9);
    const wantLeft = rng() < 0.5;
    return numQ(
      `Let $f(x) = ${vertexTex(a, h, k)}$. Find the ${wantLeft ? '**largest** value of $p$ such that $f$ restricted to $x \\le p$' : '**smallest** value of $p$ such that $f$ restricted to $x \\ge p$'} has an inverse function.`,
      h,
      {
        dotpoint: 1, prefix: 'p =',
        traps: [
          { value: -h, why: `$(x ${sgn(-h)})^2$ is zero at $x = ${h}$, not $x = ${-h}$. Set the bracket equal to zero.` },
          { value: k, why: `$${k}$ is the ${a > 0 ? 'minimum' : 'maximum'} **value** of $f$ (a $y$-value). The restriction is on $x$, so use the $x$-coordinate of the vertex.` }
        ],
        hints: ['A parabola is one-to-one on either side of its axis of symmetry, so the restriction must start (or stop) at the vertex.',
          `The function is already in vertex form $a(x - h)^2 + k$.`,
          `The vertex has $x$-coordinate $h$, where the bracket $(x ${sgn(-h)})$ is zero.`],
        steps: [
          { h: 'Read the vertex', d: `$f(x) = ${vertexTex(a, h, k)}$ has vertex $(${h}, ${k})$` },
          { h: 'One-to-one on one side of the axis', d: `The axis of symmetry is $x = ${h}$, so $f$ is one-to-one on $x ${wantLeft ? '\\le' : '\\ge'} ${h}$` },
          { h: 'Answer', d: `$p = ${h}$` }
        ]
      }
    );
  }),

  // Range of a restricted quadratic = domain of the inverse (dot point 1).
  V([2], rng => {
    const a = rc(rng, [1, 2, 3]);
    const h = nz(rng, -5, 5), k = nz(rng, -8, 8);
    const rightSide = rng() < 0.5;
    const d = ri(rng, 1, 4);
    const p = rightSide ? h + d : h - d;
    const c = a * d * d + k;
    return numQ(
      `The function $f(x) = ${vertexTex(a, h, k)}$ is defined only for $x ${rightSide ? '\\ge' : '\\le'} ${p}$. The inverse function $f^{-1}$ has domain $x \\ge c$. Find the value of $c$.`,
      c,
      {
        dotpoint: 1, prefix: 'c =',
        traps: [
          { value: k, why: `$${k}$ is the lowest value of the **unrestricted** parabola, reached at $x = ${h}$. With the restriction $x ${rightSide ? '\\ge' : '\\le'} ${p}$ the vertex is not in the domain, so the lowest value is $f(${p})$.` },
          { value: p, why: `$${p}$ is the endpoint of the domain of $f$. The domain of $f^{-1}$ is the **range** of $f$, a set of $y$-values.` }
        ],
        hints: ['The domain of $f^{-1}$ is the range of $f$.',
          `On $x ${rightSide ? '\\ge' : '\\le'} ${p}$ the function is one-to-one and ${rightSide ? 'increases' : 'decreases'} away from the vertex at $x = ${h}$ (the vertex is outside the domain).`,
          `The smallest output therefore occurs at the endpoint $x = ${p}$.`],
        steps: [
          { h: 'Vertex is outside the domain', d: `The vertex is at $x = ${h}$, but the domain is $x ${rightSide ? '\\ge' : '\\le'} ${p}$` },
          { h: 'Smallest output', d: `$f(${p}) = ${lead(a)}(${p - h})^2 ${sgn(k)}$` },
          { h: 'Range of f, domain of f⁻¹', d: `$f(x) \\ge ${c}$, so the domain of $f^{-1}$ is $x \\ge ${c}$` }
        ]
      }
    );
  }),

  // Linear fractional function: the value missing from the domain of the inverse (dot point 1).
  V([2], rng => {
    const c = rc(rng, [2, 3]);
    const m = nz(rng, -4, 4);
    const a = m * c;
    const b = nz(rng, -9, 9), d = nz(rng, -9, 9);
    rej(m * d === b);                        // otherwise f is constant
    return numQ(
      `The function $f(x) = \\dfrac{${term(a, 'x')} ${sgn(b)}}{${term(c, 'x')} ${sgn(d)}}$ is defined for every real $x$ that makes the denominator non-zero. Its inverse $f^{-1}$ is not defined at exactly one real number. Find that number.`,
      m,
      {
        dotpoint: 1, prefix: 'x =',
        traps: [
          { value: a, why: `$${a}$ is the numerator's coefficient of $x$. The value $f$ never reaches is the **ratio** of the leading coefficients, $\\dfrac{${a}}{${c}}$.` },
          { value: -d / c, why: `$x = -\\dfrac{${d}}{${c}}$ is excluded from the domain of $f$. The domain of $f^{-1}$ is the **range** of $f$, so ask which $y$ is never produced.` }
        ],
        hints: ['The domain of $f^{-1}$ is the range of $f$. Which $y$-value can $f$ never take?',
          'Write $f(x)$ as a constant plus a fraction whose numerator has no $x$, by dividing the numerator by the denominator.',
          'The fraction part is never $0$, so $f$ never reaches the constant.'],
        steps: [
          { h: 'Divide', d: `$f(x) = ${m} + \\dfrac{${b - m * d}}{${term(c, 'x')} ${sgn(d)}}$` },
          { h: 'The fraction is never zero', d: `$\\dfrac{${b - m * d}}{${term(c, 'x')} ${sgn(d)}} \\ne 0$` },
          { h: 'Range of f, domain of f⁻¹', d: `$f(x) \\ne ${m}$, so $f^{-1}$ is not defined at $x = ${m}$` }
        ]
      }
    );
  }),

  // Evaluate an exponential's inverse by solving f(x) = y0 (dot point 0).
  V([2], rng => {
    const B = rc(rng, [2, 2, 3]);
    const x0 = B === 2 ? ri(rng, 1, 5) : ri(rng, 1, 3);
    const a = rc(rng, [1, 2, 3, 4, 5]), k = nz(rng, -9, 9);
    const y0 = a * B ** x0 + k;
    return numQ(
      `For $f(x) = ${a === 1 ? '' : `${a} \\times `}${B}^x ${sgn(k)}$, evaluate $f^{-1}(${y0})$.`,
      x0,
      {
        dotpoint: 0,
        traps: [
          { value: B ** x0, why: `$${B}^x = ${B ** x0}$ gives the **value of the power**. The answer is the exponent $x$ that produces it.` },
          { value: (y0 + k) / a > 0 && Number.isInteger(Math.log(Math.abs((y0 + k) / a)) / Math.log(B)) ? Math.round(Math.log((y0 + k) / a) / Math.log(B)) : NaN, why: `Undo the constant first: ${k > 0 ? 'subtract' : 'add'} $${Math.abs(k)}$, not the other way round.` }
        ],
        hints: [`$f^{-1}(${y0})$ is the value of $x$ for which $f(x) = ${y0}$.`,
          `Write $${a === 1 ? '' : `${a} \\times `}${B}^x ${sgn(k)} = ${y0}$, then ${k > 0 ? 'subtract' : 'add'} $${Math.abs(k)}$ ${a === 1 ? '' : `and divide by $${a}$ `}to isolate the power.`,
          `Write the right-hand side as a power of $${B}$.`],
        steps: [
          { h: 'Solve f(x) equals the value', d: `$${a === 1 ? '' : `${a} \\times `}${B}^x ${sgn(k)} = ${y0}$` },
          { h: 'Isolate the power', d: `$${B}^x = ${B ** x0}$` },
          { h: 'Match the exponent', d: `$${B}^x = ${B}^{${x0}}$, so $x = ${x0}$` }
        ]
      }
    );
  }),

  // Inverse of the left-hand branch of a parabola: the negative square root (dot point 1).
  V([2], rng => {
    const a = rc(rng, [1, 1, 2, 3]);
    const h = nz(rng, -5, 5), k = nz(rng, -8, 8), s = ri(rng, 1, 6);
    const y0 = a * s * s + k;
    return numQ(
      `The function $f(x) = ${vertexTex(a, h, k)}$ is defined for $x \\le ${h}$. Evaluate $f^{-1}(${y0})$.`,
      h - s,
      {
        dotpoint: 1,
        traps: [
          { value: h + s, why: `That is the other solution of $f(x) = ${y0}$, which lies on the right of the vertex and outside the domain $x \\le ${h}$.` },
          { value: s, why: `$${s}$ is only $\\sqrt{\\dfrac{${y0 - k}}{${a}}}$. Add or subtract it from $${h}$, choosing the side that lies in the domain.` }
        ],
        hints: [`Solve $f(x) = ${y0}$. There are two solutions, one each side of the vertex.`,
          `$(x ${sgn(-h)})^2 = ${s * s}$, so $x ${sgn(-h)} = \\pm ${s}$.`,
          `The domain is $x \\le ${h}$, so choose the solution that is **less than** $${h}$.`],
        steps: [
          { h: 'Set f(x) equal to the value', d: `$${vertexTex(a, h, k)} = ${y0}$` },
          { h: 'Isolate the square', d: `$(x ${sgn(-h)})^2 = ${s * s}$` },
          { h: 'Two roots', d: `$x ${sgn(-h)} = \\pm ${s}$` },
          { h: 'Choose the branch', d: `$x \\le ${h}$ needs the negative root: $x = ${h - s}$` }
        ]
      }
    );
  }),

  // Where f and f^-1 meet: solve f(x) = x and reject the root outside the domain (dot point 1).
  V([2], rng => {
    const h = nz(rng, -4, 5), j = ri(rng, 1, 4);
    const t1 = h - j, t2 = h + j + 1;
    const k = t1 * t2 - h * h;
    rej(k === 0);
    return numQ(
      `The function $f(x) = (x ${sgn(-h)})^2 ${sgn(k)}$, $x \\ge ${h}$, has an inverse. The graphs of $y = f(x)$ and $y = f^{-1}(x)$ meet at exactly one point. Find the $x$-coordinate of that point.`,
      t2,
      {
        dotpoint: 1, prefix: 'x =',
        stepcheck: { kind: 'equation', variable: 'x', solutions: [t2], rejected: [t1] },
        traps: [
          { value: t1, why: `$x = ${t1}$ solves $f(x) = x$ for the unrestricted parabola, but it is less than $${h}$, so it is not in the domain of $f$.` },
          { value: h, why: `$${h}$ is the vertex's $x$-coordinate, the start of the domain. It is not where the graph meets the line $y = x$.` }
        ],
        hints: ['For an increasing function, the graphs of $f$ and $f^{-1}$ meet where each meets the line $y = x$.',
          'Solve $f(x) = x$ to get a quadratic in $x$ and factorise it.',
          `Two roots appear. Keep only the one that lies in the domain $x \\ge ${h}$.`],
        steps: [
          { h: 'Meeting on the line y = x', d: `$(x ${sgn(-h)})^2 ${sgn(k)} = x$` },
          { h: 'Rearrange and factorise', d: `$x^2 ${sgn(-(2 * h + 1))}x ${sgn(h * h + k)} = (x ${sgn(-t1)})(x ${sgn(-t2)}) = 0$` },
          { h: 'Apply the domain', d: `$x = ${t1}$ or $x = ${t2}$; only $x \\ge ${h}$ is allowed` },
          { h: 'Answer', d: `$x = ${t2}$` }
        ]
      }
    );
  })
];

export const forms = {
  'me11-poly': polyForms,
  'me11-functions': funcForms
};
