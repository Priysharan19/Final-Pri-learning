// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Prithagoras content-gap forms D (Further Calculus, Extension 1 Year 12)
//   me12-calc D3 (dot point 1, volumes of solids of revolution)
//   me12-calc D4 (dot point 2, areas between curves, including regions measured from the y-axis)
// Variants are chosen by au-forms-apply.js. Every key is computed in code from the
// numbers the prompt shows (the AI never sets a mark): volumes are exact multiples
// of pi (typed as e.g. 2pi/15), areas are whole numbers or exact fractions a/b.
// All questions are original. SYNTHETIC: no student or examiner evidence.
// ─────────────────────────────────────────────────────────────────────────────
import { ri, rc } from '../qhelpers.js';

const REJ = Symbol('reject');
const rej = cond => { if (cond) throw REJ; };
/** Re-draw (same rng, so still deterministic) until a variant accepts its numbers. */
const R = fn => (rng, diff) => {
  for (let i = 0; i < 200; i++) {
    try { return fn(rng, diff); } catch (e) { if (e !== REJ) throw e; }
  }
  throw new Error('gaps-d variant: no acceptable draw');
};
const V = (diffs, fn) => ({ diffs, make: R(fn) });

// ── exact rationals ──
const gcd = (a, b) => { a = Math.abs(a); b = Math.abs(b); while (b) { [a, b] = [b, a % b]; } return a || 1; };
const frac = (n, d = 1) => {
  if (d < 0) { n = -n; d = -d; }
  const g = gcd(n, d);
  return { n: n / g, d: d / g };
};
const fval = f => f.n / f.d;
const fstr = f => (f.d === 1 ? `${f.n}` : `${f.n}/${f.d}`);
const ftex = f => (f.d === 1 ? `${f.n}` : `\\dfrac{${f.n}}{${f.d}}`);
const fin = v => typeof v === 'number' && Number.isFinite(v);

/** Exact coefficient of pi for a volume. */
function piOf(f) {
  const head = f.n === 1 ? 'pi' : `${f.n}pi`;
  const texHead = f.n === 1 ? '\\pi' : `${f.n}\\pi`;
  return {
    typed: f.d === 1 ? head : `${head}/${f.d}`,
    tex: f.d === 1 ? texHead : `\\dfrac{${texHead}}{${f.d}}`,
    val: f.n * Math.PI / f.d
  };
}

/** `p x + q` as LaTeX, omitting zero terms. */
function lin(p, q) {
  const xs = p === 1 ? 'x' : p === -1 ? '-x' : p === 0 ? '' : `${p}x`;
  if (q === 0) return xs || '0';
  if (!xs) return `${q}`;
  return `${xs} ${q < 0 ? '-' : '+'} ${Math.abs(q)}`;
}
const co = k => (k === 1 ? '' : `${k}`);

/** Assemble a numeric payload; traps are kept only if distinct from the key and each other. */
function build({ prompt, key, typed, trapDefs, hints, steps, dotpoint, tol }) {
  rej(!fin(key));
  const seen = [key];
  const traps = [];
  for (const t of trapDefs) {
    if (!fin(t.value)) continue;
    if (seen.some(s => Math.abs(s - t.value) <= 0.02 * Math.max(1, Math.abs(s)) * 0.5 + 1e-9)) continue;
    seen.push(t.value);
    traps.push({ value: t.value, why: t.why, tol: 0.002 * Math.max(1, Math.abs(t.value)) });
  }
  const answer = tol != null
    ? { value: key, requireExact: true, canonicalInput: typed, tol }
    : { value: key, requireExact: true, canonicalInput: typed };
  return { dotpoint, prompt, answerType: 'numeric', answer, inputHint: tol != null ? 'e.g. 27/4 or 9' : 'e.g. 2pi/15', traps, hints, steps };
}

const VOL = (prompt, f, o) => {
  const p = piOf(f);
  return build({ prompt, key: p.val, typed: p.typed, dotpoint: 1, ...o({ ...p, f }) });
};
const AREA = (prompt, f, o) => {
  rej(f.n <= 0);
  return build({ prompt, key: fval(f), typed: fstr(f), tol: 0.0005, dotpoint: 2, ...o({ f, tex: ftex(f) }) });
};
const NOPI = 'The volume of revolution carries a factor of $\\pi$: $V = \\pi\\int y^2\\,dx$ (or $\\pi\\int x^2\\,dy$).';
const dropPi = f => ({ value: fval(f), why: NOPI });

const volumes = [
  // y = sqrt(ax + b) about the x-axis
  V([3], rng => {
    const a = ri(rng, 1, 5), b = ri(rng, 1, 6), c = ri(rng, 1, 5);
    const f = frac(a * c * c + 2 * b * c, 2);
    const g = `${co(a)}x + ${b}`;
    return VOL(`The region bounded by the curve $y = \\sqrt{${g}}$, the $x$-axis, the $y$-axis and the line $x = ${c}$ is rotated about the $x$-axis. Find the **exact** volume of the solid formed.`, f, ({ tex, val }) => ({
      trapDefs: [
        dropPi(f),
        { value: Math.PI * (2 / (3 * a)) * (Math.pow(a * c + b, 1.5) - Math.pow(b, 1.5)), why: 'The formula uses $y^2$, not $y$. Squaring $\\sqrt{ax+b}$ removes the root, so there is no $\\tfrac{3}{2}$ power to integrate.' }
      ],
      hints: [`Use $V = \\pi\\int_0^{${c}} y^2\\,dx$ and square $y$ first.`, `$y^2 = ${g}$, so $V = \\pi\\int_0^{${c}} (${g})\\,dx$.`, `The antiderivative is $\\left[${a === 1 ? '' : `\\tfrac{${a}}{2}`}${a === 1 ? '\\tfrac{x^2}{2}' : 'x^2'} + ${b}x\\right]$; substitute $x = ${c}$ and $x = 0$.`],
      steps: [
        { h: 'Volume formula', d: `$V = \\pi\\displaystyle\\int_0^{${c}} y^2\\,dx$` },
        { h: 'Square the function', d: `$y^2 = ${g}$` },
        { h: 'Integrate', d: `$V = \\pi\\left[${a === 1 ? '\\dfrac{x^2}{2}' : `\\dfrac{${a}x^2}{2}`} + ${b}x\\right]_0^{${c}}$` },
        { h: 'Evaluate', d: `$V = ${tex}$` }
      ]
    }));
  }),

  // y = x^2, 0 <= x <= c, about the x-axis
  V([3], rng => {
    const c = ri(rng, 1, 4);
    const f = frac(c ** 5, 5);
    return VOL(`The region bounded by the parabola $y = x^2$, the $x$-axis and the line $x = ${c}$ is rotated about the $x$-axis through one revolution. Find the **exact** volume of the solid formed.`, f, ({ tex }) => ({
      trapDefs: [
        dropPi(f),
        { value: Math.PI * c ** 3 / 3, why: 'The radius is $y = x^2$, so the cross-sectional area is $\\pi y^2 = \\pi x^4$. Integrating $x^2$ squares nothing.' }
      ],
      hints: ['Each disc has radius $y$ and area $\\pi y^2$.', `$V = \\pi\\int_0^{${c}} (x^2)^2\\,dx = \\pi\\int_0^{${c}} x^4\\,dx$.`, `Integrate to get $\\pi\\left[\\tfrac{x^5}{5}\\right]_0^{${c}}$ and evaluate.`],
      steps: [
        { h: 'Volume formula', d: `$V = \\pi\\displaystyle\\int_0^{${c}} y^2\\,dx$` },
        { h: 'Square the function', d: `$y^2 = (x^2)^2 = x^4$` },
        { h: 'Integrate', d: `$V = \\pi\\left[\\dfrac{x^5}{5}\\right]_0^{${c}}$` },
        { h: 'Evaluate', d: `$V = ${tex}$` }
      ]
    }));
  }),

  // y = 1/x between x = m and x = c about the x-axis
  V([3], rng => {
    const m = ri(rng, 1, 3), c = ri(rng, m + 1, m + 4);
    const f = frac(c - m, m * c);
    return VOL(`The region bounded by the curve $y = \\dfrac{1}{x}$, the $x$-axis and the lines $x = ${m}$ and $x = ${c}$ is rotated about the $x$-axis. Find the **exact** volume of the solid formed.`, f, ({ tex }) => ({
      trapDefs: [
        dropPi(f),
        { value: Math.PI * Math.log(c / m), why: 'The integrand is $y^2 = \\dfrac{1}{x^2}$, not $\\dfrac{1}{x}$; its antiderivative is $-\\dfrac{1}{x}$, not a logarithm.' }
      ],
      hints: ['Square the radius first: $y^2 = \\dfrac{1}{x^2} = x^{-2}$.', `$V = \\pi\\int_{${m}}^{${c}} x^{-2}\\,dx$.`, `$\\int x^{-2}\\,dx = -\\dfrac{1}{x}$, so evaluate $\\pi\\left[-\\dfrac{1}{x}\\right]_{${m}}^{${c}}$.`],
      steps: [
        { h: 'Volume formula', d: `$V = \\pi\\displaystyle\\int_{${m}}^{${c}} y^2\\,dx$` },
        { h: 'Square the function', d: `$y^2 = x^{-2}$` },
        { h: 'Integrate', d: `$V = \\pi\\left[-\\dfrac{1}{x}\\right]_{${m}}^{${c}}$` },
        { h: 'Evaluate', d: `$V = \\pi\\left(\\dfrac{1}{${m}} - \\dfrac{1}{${c}}\\right) = ${tex}$` }
      ]
    }));
  }),

  // washer: parabola y = x^2 and line y = kx about the x-axis
  V([3], rng => {
    const k = ri(rng, 2, 5);
    const f = frac(2 * k ** 5, 15);
    return VOL(`The region enclosed between the parabola $y = x^2$ and the line $y = ${k}x$ is rotated about the $x$-axis. Find the **exact** volume of the solid formed.`, f, ({ tex }) => ({
      trapDefs: [
        dropPi(f),
        { value: Math.PI * k ** 5 / 30, why: 'The cross-section is a washer: subtract the **squares** of the radii, $\\pi(R^2 - r^2)$, not the square of the difference of the radii.' },
        { value: Math.PI * k ** 5 / 3, why: 'This is the volume generated by the line alone. The solid is hollowed out by the volume generated by the parabola.' }
      ],
      hints: [`The curves meet where $x^2 = ${k}x$, that is at $x = 0$ and $x = ${k}$. Between these the line is above the parabola.`, `Each cross-section is a washer with outer radius $${k}x$ and inner radius $x^2$, so $V = \\pi\\int_0^{${k}} \\left((${k}x)^2 - (x^2)^2\\right)dx$.`, `Simplify the integrand to $${k * k}x^2 - x^4$ and integrate.`],
      steps: [
        { h: 'Intersections', d: `$x^2 = ${k}x \\Rightarrow x = 0$ or $x = ${k}$` },
        { h: 'Washer volume formula', d: `$V = \\pi\\displaystyle\\int_0^{${k}} \\left(R^2 - r^2\\right)dx$ with $R = ${k}x$, $r = x^2$` },
        { h: 'Integrate', d: `$V = \\pi\\left[\\dfrac{${k * k}x^3}{3} - \\dfrac{x^5}{5}\\right]_0^{${k}}$` },
        { h: 'Evaluate', d: `$V = ${tex}$` }
      ]
    }));
  }),

  // washer: y = sqrt(ax) and line y = x about the x-axis
  V([3], rng => {
    const a = ri(rng, 2, 6);
    const f = frac(a ** 3, 6);
    return VOL(`The curve $y = \\sqrt{${a}x}$ and the line $y = x$ enclose a region. The region is rotated about the $x$-axis. Find the **exact** volume of the solid formed.`, f, ({ tex }) => ({
      trapDefs: [
        dropPi(f),
        { value: Math.PI * a ** 3 / 30, why: 'Subtract the squares of the radii, $R^2 - r^2$. The square of the difference $(R - r)^2$ is a different quantity.' },
        { value: Math.PI * a ** 3 / 2, why: 'This is the volume generated by the curve alone; the volume generated by the line $y = x$ must be taken away.' }
      ],
      hints: [`Solve $\\sqrt{${a}x} = x$ to find where the curves meet: $x = 0$ and $x = ${a}$.`, `Between them the curve is above the line, so $V = \\pi\\int_0^{${a}} \\left(${a}x - x^2\\right)dx$.`, `Integrate $${a}x - x^2$ term by term and evaluate between $0$ and $${a}$.`],
      steps: [
        { h: 'Intersections', d: `$${a}x = x^2 \\Rightarrow x = 0$ or $x = ${a}$` },
        { h: 'Washer volume formula', d: `$V = \\pi\\displaystyle\\int_0^{${a}} \\left(R^2 - r^2\\right)dx$ with $R^2 = ${a}x$, $r^2 = x^2$` },
        { h: 'Integrate', d: `$V = \\pi\\left[\\dfrac{${a}x^2}{2} - \\dfrac{x^3}{3}\\right]_0^{${a}}$` },
        { h: 'Evaluate', d: `$V = ${tex}$` }
      ]
    }));
  }),

  // rotation about the y-axis: y = x^2 (x >= 0) up to y = h
  V([3], rng => {
    const h = ri(rng, 2, 9);
    const f = frac(h * h, 2);
    return VOL(`The region bounded by the parabola $y = x^2$ (for $x \\ge 0$), the $y$-axis and the line $y = ${h}$ is rotated about the $y$-axis. Find the **exact** volume of the solid formed.`, f, ({ tex }) => ({
      trapDefs: [
        dropPi(f),
        { value: Math.PI * h ** 3 / 3, why: 'About the $y$-axis the radius is $x$, so the integrand is $x^2 = y$. It is not $y^2$.' }
      ],
      hints: ['Rotating about the $y$-axis means integrating with respect to $y$: $V = \\pi\\int x^2\\,dy$.', `From $y = x^2$, $x^2 = y$, and $y$ runs from $0$ to $${h}$.`, `Evaluate $\\pi\\int_0^{${h}} y\\,dy = \\pi\\left[\\tfrac{y^2}{2}\\right]_0^{${h}}$.`],
      steps: [
        { h: 'Volume formula', d: `$V = \\pi\\displaystyle\\int_0^{${h}} x^2\\,dy$` },
        { h: 'Write $x^2$ in terms of $y$', d: `$x^2 = y$` },
        { h: 'Integrate', d: `$V = \\pi\\left[\\dfrac{y^2}{2}\\right]_0^{${h}}$` },
        { h: 'Evaluate', d: `$V = ${tex}$` }
      ]
    }));
  }),

  // rotation about the y-axis: y = sqrt(x) up to y = h
  V([3], rng => {
    const h = ri(rng, 1, 4);
    const f = frac(h ** 5, 5);
    return VOL(`The region bounded by the curve $y = \\sqrt{x}$, the $y$-axis and the line $y = ${h}$ is rotated about the $y$-axis. Find the **exact** volume of the solid formed.`, f, ({ tex }) => ({
      trapDefs: [
        dropPi(f),
        { value: Math.PI * h * h / 2, why: 'From $y = \\sqrt{x}$ we get $x = y^2$, so $x^2 = y^4$. Using $x^2 = y$ would be solving for $x$ incorrectly.' }
      ],
      hints: ['Rotating about the $y$-axis, the radius of each disc is $x$, so $V = \\pi\\int x^2\\,dy$.', `Make $x$ the subject: $y = \\sqrt{x}$ gives $x = y^2$, so $x^2 = y^4$.`, `Evaluate $\\pi\\int_0^{${h}} y^4\\,dy$.`],
      steps: [
        { h: 'Volume formula', d: `$V = \\pi\\displaystyle\\int_0^{${h}} x^2\\,dy$` },
        { h: 'Make $x$ the subject', d: `$x = y^2$, so $x^2 = y^4$` },
        { h: 'Integrate', d: `$V = \\pi\\left[\\dfrac{y^5}{5}\\right]_0^{${h}}$` },
        { h: 'Evaluate', d: `$V = ${tex}$` }
      ]
    }));
  }),

  // rotation about the y-axis: x = y^2 + 1 between y = 0 and y = c
  V([3], rng => {
    const c = ri(rng, 1, 4);
    const f = frac(3 * c ** 5 + 10 * c ** 3 + 15 * c, 15);
    return VOL(`The region bounded by the curve $x = y^2 + 1$, the $y$-axis and the lines $y = 0$ and $y = ${c}$ is rotated about the $y$-axis. Find the **exact** volume of the solid formed.`, f, ({ tex }) => ({
      trapDefs: [
        dropPi(f),
        { value: Math.PI * (c ** 5 / 5 + c), why: 'Square the whole expression: $(y^2 + 1)^2 = y^4 + 2y^2 + 1$. The middle term is not zero.' }
      ],
      hints: ['About the $y$-axis, $V = \\pi\\int x^2\\,dy$ with $x = y^2 + 1$.', 'Expand $(y^2 + 1)^2 = y^4 + 2y^2 + 1$ before integrating.', `Integrate $y^4 + 2y^2 + 1$ from $0$ to $${c}$.`],
      steps: [
        { h: 'Volume formula', d: `$V = \\pi\\displaystyle\\int_0^{${c}} x^2\\,dy$` },
        { h: 'Square the function', d: `$x^2 = (y^2 + 1)^2 = y^4 + 2y^2 + 1$` },
        { h: 'Integrate', d: `$V = \\pi\\left[\\dfrac{y^5}{5} + \\dfrac{2y^3}{3} + y\\right]_0^{${c}}$` },
        { h: 'Evaluate', d: `$V = ${tex}$` }
      ]
    }));
  }),

  // region between y = x(x - a) and the x-axis about the x-axis
  V([3], rng => {
    const a = ri(rng, 1, 5);
    const f = frac(a ** 5, 30);
    return VOL(`The region enclosed between the curve $y = x(x - ${a})$ and the $x$-axis is rotated about the $x$-axis. Find the **exact** volume of the solid formed.`, f, ({ tex }) => ({
      trapDefs: [
        dropPi(f),
        { value: Math.PI * a ** 6 / 36, why: 'The disc area is $\\pi y^2$ at each $x$; do not integrate $y$ first and then square the result.' }
      ],
      hints: [`The curve meets the $x$-axis at $x = 0$ and $x = ${a}$, so these are the limits.`, `$y^2 = x^2(x - ${a})^2 = x^4 - ${2 * a}x^3 + ${a * a}x^2$.`, `Integrate $\\pi\\int_0^{${a}} \\left(x^4 - ${2 * a}x^3 + ${a * a}x^2\\right)dx$ term by term.`],
      steps: [
        { h: 'Limits', d: `$x(x - ${a}) = 0 \\Rightarrow x = 0$ or $x = ${a}$` },
        { h: 'Square the function', d: `$y^2 = x^4 - ${2 * a}x^3 + ${a * a}x^2$` },
        { h: 'Integrate', d: `$V = \\pi\\left[\\dfrac{x^5}{5} - \\dfrac{${a}x^4}{2} + \\dfrac{${a * a}x^3}{3}\\right]_0^{${a}}$` },
        { h: 'Evaluate', d: `$V = ${tex}$` }
      ]
    }));
  })
];

const areas = [
  // parabola and a line through two integer-x points
  V([4], rng => {
    const p = ri(rng, -3, 2), q = ri(rng, p + 1, 3);
    const s = p + q, t = -p * q;
    const f = frac((q - p) ** 3, 6);
    return AREA(`Find the area of the region enclosed by the parabola $y = x^2$ and the line $y = ${lin(s, t)}$.`, f, ({ tex }) => ({
      trapDefs: [
        { value: fval(frac(q ** 3 - p ** 3, 3)), why: 'This is the area under the parabola between the intersection points, not the area between the curves. Subtract the parabola from the line.' },
        { value: fval(frac(3 * s * q * q + 6 * t * q - 2 * q ** 3, 6)), why: `The limits are the two intersection points $x = ${p}$ and $x = ${q}$, not $0$ and $${q}$.` }
      ],
      hints: ['Find the intersections by solving $x^2 = \\text{line}$.', `They meet where $x^2 = ${lin(s, t)}$, at $x = ${p}$ and $x = ${q}$. The line is above the parabola between them.`, `Integrate $(${lin(s, t)}) - x^2$ from $x = ${p}$ to $x = ${q}$.`],
      steps: [
        { h: 'Intersections', d: `$x^2 = ${lin(s, t)}$ gives $x = ${p}$ and $x = ${q}$` },
        { h: 'Which curve is on top', d: `Between the intersections the line is above the parabola` },
        { h: 'Set up the area', d: `$A = \\displaystyle\\int_{${p}}^{${q}} \\left(${lin(s, t)} - x^2\\right)dx$` },
        { h: 'Evaluate', d: `$A = ${tex}$` }
      ]
    }));
  }),

  // two parabolas, symmetric about the y-axis
  V([4], rng => {
    const m = ri(rng, 1, 3), n = ri(rng, 1, 3), r = ri(rng, 1, 3);
    const c = (m + n) * r * r;
    const f = frac(4 * (m + n) * r ** 3, 3);
    return AREA(`Find the area enclosed between the parabolas $y = ${co(m)}x^2$ and $y = ${c} - ${co(n)}x^2$.`, f, ({ tex }) => ({
      trapDefs: [
        { value: fval(frac(2 * (m + n) * r ** 3, 3)), why: 'The region lies on both sides of the $y$-axis, so integrate from $x = -' + r + '$ to $x = ' + r + '$ (or double the integral from $0$ to $' + r + '$).' },
        { value: fval(frac(6 * c * r - 2 * n * r ** 3, 3)), why: 'Subtract the lower curve from the upper curve. Integrating only $y = ' + c + ' - ' + co(n) + 'x^2$ gives the area under the upper parabola, not the area between them.' }
      ],
      hints: [`Equate the curves: $${co(m)}x^2 = ${c} - ${co(n)}x^2$ gives $x = \\pm ${r}$.`, `The upper curve is $y = ${c} - ${co(n)}x^2$, so the integrand is $${c} - ${co(m + n)}x^2$.`, `The integrand is even, so $A = 2\\int_0^{${r}} \\left(${c} - ${co(m + n)}x^2\\right)dx$.`],
      steps: [
        { h: 'Intersections', d: `$${co(m)}x^2 = ${c} - ${co(n)}x^2 \\Rightarrow ${co(m + n)}x^2 = ${c}$, so $x = \\pm ${r}$` },
        { h: 'Upper minus lower', d: `$${c} - ${co(n)}x^2 - ${co(m)}x^2 = ${c} - ${co(m + n)}x^2$` },
        { h: 'Set up using symmetry', d: `$A = 2\\displaystyle\\int_0^{${r}} \\left(${c} - ${co(m + n)}x^2\\right)dx$` },
        { h: 'Evaluate', d: `$A = ${tex}$` }
      ]
    }));
  }),

  // x = y^2, the y-axis and y = h: integrate with respect to y
  V([4], rng => {
    const h = ri(rng, 2, 6);
    const f = frac(h ** 3, 3);
    return AREA(`Find the area of the region bounded by the curve $x = y^2$, the $y$-axis and the line $y = ${h}$.`, f, ({ tex }) => ({
      trapDefs: [
        { value: 2 * h ** 3 / 3, why: `That is the area between the curve and the line $x = ${h * h}$ — the rest of the rectangle. The region asked for lies between the $y$-axis and the curve.` },
        { value: h ** 3, why: 'Integrate $x = y^2$ with respect to $y$; do not multiply the width and height of the bounding rectangle.' }
      ],
      hints: ['Each horizontal strip runs from the $y$-axis ($x = 0$) to the curve, so the width is $x = y^2$.', `The strips stack from $y = 0$ to $y = ${h}$, so $A = \\int_0^{${h}} x\\,dy$.`, `Integrate $y^2$ and substitute the limits.`],
      steps: [
        { h: 'Choose the variable', d: `The region is described from the $y$-axis, so integrate with respect to $y$` },
        { h: 'Set up the area', d: `$A = \\displaystyle\\int_0^{${h}} y^2\\,dy$` },
        { h: 'Integrate', d: `$A = \\left[\\dfrac{y^3}{3}\\right]_0^{${h}}$` },
        { h: 'Evaluate', d: `$A = ${tex}$` }
      ]
    }));
  }),

  // y = x^2 + k, the y-axis and y = h (x >= 0), with h - k a perfect square
  V([4], rng => {
    const k = ri(rng, 1, 5), s = ri(rng, 1, 4), h = k + s * s;
    const f = frac(2 * s ** 3, 3);
    return AREA(`Find the area of the region bounded by the curve $y = x^2 + ${k}$ (for $x \\ge 0$), the $y$-axis and the line $y = ${h}$.`, f, ({ tex }) => ({
      trapDefs: [
        { value: s ** 3 / 3 + k * s, why: `That is the area **under** the curve from $x = 0$ to $x = ${s}$. The region asked for lies between the curve and the line $y = ${h}$.` },
        { value: h * s, why: 'That is the whole bounding rectangle, which still includes the area under the curve.' }
      ],
      hints: [`The curve reaches $y = ${h}$ where $x^2 = ${s * s}$, that is at $x = ${s}$.`, `The region is the rectangle $0 \\le x \\le ${s}$, $0 \\le y \\le ${h}$, with the area under the curve removed.`, `Integrate $${h} - (x^2 + ${k})$ from $x = 0$ to $x = ${s}$.`],
      steps: [
        { h: 'Where the curve meets the line', d: `$x^2 + ${k} = ${h} \\Rightarrow x = ${s}$` },
        { h: 'Set up the area', d: `$A = \\displaystyle\\int_0^{${s}} \\left(${h} - (x^2 + ${k})\\right)dx = \\int_0^{${s}} \\left(${s * s} - x^2\\right)dx$` },
        { h: 'Integrate', d: `$A = \\left[${s * s}x - \\dfrac{x^3}{3}\\right]_0^{${s}}$` },
        { h: 'Evaluate', d: `$A = ${tex}$` }
      ]
    }));
  }),

  // x = y(a - y) and the y-axis
  V([4], rng => {
    const a = ri(rng, 2, 7);
    const f = frac(a ** 3, 6);
    return AREA(`Find the area of the region enclosed by the curve $x = y(${a} - y)$ and the $y$-axis.`, f, ({ tex }) => ({
      trapDefs: [
        { value: a ** 3 / 2, why: 'The width of each horizontal strip is $x = ay - y^2$. Dropping the $-y^2$ term overstates the area.' },
        { value: a ** 3 / 4, why: `This is the area of the bounding rectangle $\\left(${a} \\times \\tfrac{${a * a}}{4}\\right)$, which is larger than the region.` }
      ],
      hints: [`The curve meets the $y$-axis ($x = 0$) where $y = 0$ and $y = ${a}$.`, `Between these values $x = ${a}y - y^2$ is positive, so $A = \\int_0^{${a}} (${a}y - y^2)\\,dy$.`, 'Integrate term by term and substitute the limits.'],
      steps: [
        { h: 'Where the curve meets the $y$-axis', d: `$y(${a} - y) = 0 \\Rightarrow y = 0$ or $y = ${a}$` },
        { h: 'Set up the area', d: `$A = \\displaystyle\\int_0^{${a}} \\left(${a}y - y^2\\right)dy$` },
        { h: 'Integrate', d: `$A = \\left[\\dfrac{${a}y^2}{2} - \\dfrac{y^3}{3}\\right]_0^{${a}}$` },
        { h: 'Evaluate', d: `$A = ${tex}$` }
      ]
    }));
  }),

  // cubic y = x^3 and the line y = mx in the first quadrant
  V([4], rng => {
    const r = ri(rng, 2, 4), m = r * r;
    const f = frac(r ** 4, 4);
    return AREA(`Find the area of the region in the first quadrant bounded by the curve $y = x^3$ and the line $y = ${m}x$.`, f, ({ tex }) => ({
      trapDefs: [
        { value: r ** 4 / 2, why: 'That is the area under the line alone. The area under the cubic has to be subtracted.' },
        { value: 3 * r ** 4 / 4, why: 'The area between curves is the **difference** of the two areas, not their sum.' }
      ],
      hints: [`Solve $x^3 = ${m}x$ for $x > 0$ to find the right-hand edge: $x = ${r}$.`, `Between $x = 0$ and $x = ${r}$ the line is above the cubic.`, `Integrate $${m}x - x^3$ from $0$ to $${r}$.`],
      steps: [
        { h: 'Intersections', d: `$x^3 = ${m}x \\Rightarrow x = 0$ or $x = ${r}$ (first quadrant)` },
        { h: 'Set up the area', d: `$A = \\displaystyle\\int_0^{${r}} \\left(${m}x - x^3\\right)dx$` },
        { h: 'Integrate', d: `$A = \\left[\\dfrac{${m}x^2}{2} - \\dfrac{x^4}{4}\\right]_0^{${r}}$` },
        { h: 'Evaluate', d: `$A = ${tex}$` }
      ]
    }));
  }),

  // y = sqrt(x) and y = x/k
  V([4], rng => {
    const k = ri(rng, 2, 5);
    const f = frac(k ** 3, 6);
    return AREA(`Find the area of the region enclosed by the curve $y = \\sqrt{x}$ and the line $y = \\dfrac{x}{${k}}$.`, f, ({ tex }) => ({
      trapDefs: [
        { value: 2 * k ** 3 / 3, why: 'That is the area under the curve $y = \\sqrt{x}$ alone. Subtract the area under the line.' },
        { value: k ** 3 / 2, why: 'That is the area under the line alone. The region lies between the line and the curve.' }
      ],
      hints: [`Solve $\\sqrt{x} = \\dfrac{x}{${k}}$: squaring gives $x = \\dfrac{x^2}{${k * k}}$, so $x = 0$ or $x = ${k * k}$.`, 'On this interval the curve $y = \\sqrt{x}$ is above the line.', `Integrate $\\sqrt{x} - \\dfrac{x}{${k}}$ from $0$ to $${k * k}$, writing $\\sqrt{x} = x^{1/2}$.`],
      steps: [
        { h: 'Intersections', d: `$x = 0$ and $x = ${k * k}$` },
        { h: 'Set up the area', d: `$A = \\displaystyle\\int_0^{${k * k}} \\left(x^{1/2} - \\dfrac{x}{${k}}\\right)dx$` },
        { h: 'Integrate', d: `$A = \\left[\\dfrac{2x^{3/2}}{3} - \\dfrac{x^2}{${2 * k}}\\right]_0^{${k * k}}$` },
        { h: 'Evaluate', d: `$A = ${tex}$` }
      ]
    }));
  }),

  // sign change: y = x(x - a) from x = 0 to x = u
  V([4], rng => {
    const a = ri(rng, 1, 4), u = a * ri(rng, 2, 3);
    const Fu = frac(2 * u ** 3 - 3 * a * u * u, 6);   // F(u) = u^3/3 - a u^2/2
    const area = frac(2 * u ** 3 - 3 * a * u * u + 2 * a ** 3, 6);   // F(u) + a^3/3
    return AREA(`Find the total area between the curve $y = x(x - ${a})$ and the $x$-axis, from $x = 0$ to $x = ${u}$.`, area, ({ tex }) => ({
      trapDefs: [
        { value: fval(Fu), why: `That is the **signed** integral. The curve is below the $x$-axis for $0 < x < ${a}$, so that part counts negatively; areas must be added as positive quantities.` },
        { value: fval(frac(2 * u ** 3 - 3 * a * u * u + a ** 3, 6)), why: `That counts only the part above the $x$-axis ($x > ${a}$). The region between $x = 0$ and $x = ${a}$ lies below the axis but still has area.` }
      ],
      hints: [`The curve crosses the $x$-axis at $x = 0$ and $x = ${a}$, so it changes sign inside the interval.`, `Find $\\int_0^{${a}} x(x - ${a})\\,dx$ (negative) and $\\int_{${a}}^{${u}} x(x - ${a})\\,dx$ (positive) separately.`, 'Take the absolute value of the first part before adding the two.'],
      steps: [
        { h: 'Find the sign change', d: `$x(x - ${a}) < 0$ for $0 < x < ${a}$ and $> 0$ for $x > ${a}$` },
        { h: 'Antiderivative', d: `$F(x) = \\dfrac{x^3}{3} - \\dfrac{${a}x^2}{2}$` },
        { h: 'Split the area', d: `$A = \\left|F(${a}) - F(0)\\right| + \\left(F(${u}) - F(${a})\\right)$` },
        { h: 'Evaluate', d: `$A = ${tex}$` }
      ]
    }));
  }),

  // sign change: y = x^3 - m x with m = a^2, enclosed between the curve and the x-axis (two lobes)
  V([4], rng => {
    const a = ri(rng, 2, 4), m = a * a;
    const f = frac(a ** 4, 2);
    return AREA(`Find the total area enclosed between the curve $y = x^3 - ${m}x$ and the $x$-axis.`, f, ({ tex }) => ({
      trapDefs: [
        { value: 0, why: 'The two lobes lie on opposite sides of the $x$-axis, so the signed integral over the whole interval cancels to $0$. Areas must all be counted as positive.' },
        { value: a ** 4 / 4, why: 'That is the area of one lobe only. The curve encloses two regions with the $x$-axis.' }
      ],
      hints: [`Factorise: $x^3 - ${m}x = x(x - ${a})(x + ${a})$, so the curve meets the $x$-axis at $x = -${a}$, $0$ and $${a}$.`, 'The curve is symmetric about the origin, so the two lobes have equal area.', `Find the area of the lobe from $x = 0$ to $x = ${a}$ (it lies below the axis) and double it.`],
      steps: [
        { h: 'Zeros of the curve', d: `$x(x - ${a})(x + ${a}) = 0 \\Rightarrow x = -${a}, 0, ${a}$` },
        { h: 'Use symmetry', d: `The curve is odd, so the lobes on $[-${a}, 0]$ and $[0, ${a}]$ have equal areas` },
        { h: 'Area of one lobe', d: `$\\left|\\displaystyle\\int_0^{${a}} (x^3 - ${m}x)\\,dx\\right| = \\left|\\dfrac{${a}^4}{4} - \\dfrac{${m}\\cdot ${a}^2}{2}\\right| = \\dfrac{${a ** 4}}{4}$` },
        { h: 'Double it', d: `$A = ${tex}$` }
      ]
    }));
  })
];

export const forms = { 'me12-calc': [...volumes, ...areas] };
