// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Prithagoras capacity overlay · Year 9 (slot y910-c)
// Extra structural forms for y9-nonlinear-a, y9-algebra, y9-simint,
// y9-rate-change, y9-trig, y9-indices-sci, y9-data-inquiry, y9-data and
// y9-probability. Every key is computed in code from the numbers the prompt
// shows; the AI never sets a mark. Original to Pri.
// ─────────────────────────────────────────────────────────────────────────────
import { ri, rc, rs, nz, Frac, mcq, moneyPlain, r1, r2, rad, NAMES, sgn } from '../qhelpers.js';

// ── payload helpers ──────────────────────────────────────────────────────────
const cleanTraps = (traps, value, tol) => {
  const seen = new Set();
  return (traps || []).filter(t => {
    if (!t || !Number.isFinite(t.value)) return false;
    if (Math.abs(t.value - value) <= Math.max(2 * (tol || 0), 1e-9)) return false;
    const k = String(t.value);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
};
function N(prompt, value, o = {}) {
  const p = {
    prompt, answerType: 'numeric',
    answer: { value, ...(o.tol != null ? { tol: o.tol } : {}), ...(o.percent ? { percent: true } : {}) },
    traps: cleanTraps((o.traps || []).map(t => (o.tol != null && t.tol == null ? { ...t, tol: o.tol } : t)), value, o.tol),
    hints: o.hints, steps: o.steps
  };
  if (o.suffix) p.answerSuffix = o.suffix;
  if (o.prefix) p.answerPrefix = o.prefix;
  if (o.input) p.inputHint = o.input;
  return p;
}
function F(prompt, f, o = {}) {
  return {
    prompt, answerType: 'numeric', answer: { value: f.value, simplestFraction: { n: f.n, d: f.d } },
    inputHint: o.input || 'e.g. 3/8',
    traps: cleanTraps(o.traps, f.value, 0), hints: o.hints, steps: o.steps
  };
}
function M(rng, prompt, correct, distractors, hints, steps) {
  const m = mcq(rng, correct, distractors);
  return { prompt, answerType: 'mcq', answer: { correctIndex: m.correctIndex, optionTraps: m.optionTraps }, mcqOptions: m.options, hints, steps };
}
const T = (value, why) => ({ value, why });
const sq = h => `(x ${h >= 0 ? '-' : '+'} ${Math.abs(h)})^2`;
const par = v => v < 0 ? `(${v})` : `${v}`;
const sci = (m, e) => `$${m} \\times 10^{${e}}$`;
const fracTx = (a, b) => `$\\dfrac{${a}}{${b}}$`;
const TRIPLES = [[3, 4, 5], [5, 12, 13], [8, 15, 17], [7, 24, 25], [20, 21, 29]];

// ── y9-nonlinear-a ───────────────────────────────────────────────────────────
const nonlinearA = [
  { // reverse: find x from y
    make: (rng, diff) => {
      const a = ri(rng, 1, 5 + diff), c = nz(rng, -9, 9), x = ri(rng, 2, 4 + 2 * diff), y = a * x * x + c;
      return N(`For the parabola $y = ${a === 1 ? '' : a}x^2 ${sgn(c)}$, the point with $y = ${y}$ has a positive $x$-value. Find $x$.`, x, {
        traps: [T(x * x, 'You have found $x^2$; take the square root to get $x$.'), T((y - c) / a / 2, 'Squaring is undone by a square root, not by halving.')],
        hints: ['Undo the steps in reverse: subtract the constant, divide, then take a square root.', `$${y} ${c >= 0 ? '-' : '+'} ${Math.abs(c)} = ${y - c}$.`, `$x^2 = ${(y - c) / a}$.`],
        steps: [{ h: 'Isolate the square term', d: `$${a}x^2 = ${y} ${c >= 0 ? '-' : '+'} ${Math.abs(c)} = ${y - c}$` }, { h: 'Divide', d: `$x^2 = ${x * x}$` }, { h: 'Square root', d: `$x = ${x}$` }]
      });
    }
  },
  { // missing parameter a
    make: (rng, diff) => {
      const c = nz(rng, -9, 9), a = ri(rng, 2, 6 + diff), x = ri(rng, 2, 3 + diff), y = a * x * x + c;
      return N(`The parabola $y = ax^2 ${sgn(c)}$ passes through the point $(${x}, ${y})$. Find the value of $a$.`, a, {
        traps: [T(y / (x * x), 'Subtract the constant term before dividing by $x^2$.'), T((y - c) / x, 'The $x$ is squared: divide by $x^2$, not by $x$.')],
        hints: ['Substitute the point into the rule.', `$${y} = a(${x})^2 ${sgn(c)}$.`, `$${y - c} = ${x * x}a$.`],
        steps: [{ h: 'Substitute', d: `$${y} = a(${x * x}) ${sgn(c)}$` }, { h: 'Subtract the constant', d: `$${x * x}a = ${y - c}$` }, { h: 'Divide', d: `$a = ${a}$` }]
      });
    }
  },
  { // context: height of a ball
    make: (rng, diff) => {
      const v = rc(rng, [10, 15, 20, 25, 30, 35, 40, 45]);
      const who = rc(rng, ['cricket ball', 'football', 'netball', 'tennis ball']);
      if (rng() < 0.4) {
        const T0 = v / 5;
        return N(`A ${who} is thrown upwards from the ground so its height after $t$ seconds is $h = ${v}t - 5t^2$ metres. After how many seconds does it return to the ground?`, T0, {
          suffix: 's',
          traps: [T(v / 10, 'That is the time it takes to reach its highest point, half the flight.'), T(v / 5 + 1, 'Set $h = 0$ and factorise: $t(' + v + ' - 5t) = 0$.')],
          hints: ['On the ground, $h = 0$.', `Factorise: $t(${v} - 5t) = 0$.`, `$${v} - 5t = 0$.`],
          steps: [{ h: 'Set $h = 0$', d: `$${v}t - 5t^2 = t(${v} - 5t) = 0$` }, { h: 'Solve', d: `$t = 0$ (launch) or $t = ${T0}$` }]
        });
      }
      const t = ri(rng, 1, Math.max(1, Math.min(v / 5 - 1, 2 + diff * 2)));
      const h = v * t - 5 * t * t;
      return N(`A ${who} is thrown upwards so its height after $t$ seconds is $h = ${v}t - 5t^2$ metres. How high is it after $${t}$ second${t === 1 ? '' : 's'}?`, h, {
        suffix: 'm',
        traps: [T(v * t - 25 * t * t, 'Only $t$ is squared: $5t^2 = 5\\times t^2$, not $(5t)^2$.'), T((v - 5) * t, '$t^2$ means $t\\times t$, not $t$.')],
        hints: ['Substitute the time into the rule.', `$t^2 = ${t * t}$.`, `$${v}\\times ${t} - 5\\times ${t * t}$.`],
        steps: [{ h: 'Substitute', d: `$h = ${v}(${t}) - 5(${t})^2 = ${v * t} - ${5 * t * t} = ${h}$ m` }]
      });
    }
  },
  { // table: deduce a from two entries then evaluate
    make: (rng, diff) => {
      const a = ri(rng, 1, 6), c = nz(rng, -8, 8), X = ri(rng, 2, 4 + diff);
      return N(`A table of values for $y = ax^2 + c$ shows $y = ${c}$ when $x = 0$ and $y = ${a + c}$ when $x = 1$. Find $y$ when $x = ${X}$.`, a * X * X + c, {
        traps: [T(c + a * X, 'The pattern is not linear: $x$ is squared.'), T(a * X * X, 'Remember to add the constant $c$.')],
        hints: ['Use $x = 0$ to read off $c$, then $x = 1$ to find $a$.', `$a = ${a + c} - ${par(c)} = ${a}$.`, `$y = ${a}(${X})^2 + ${par(c)}$.`],
        steps: [{ h: 'Find c', d: `$c = ${c}$` }, { h: 'Find a', d: `$a + ${par(c)} = ${a + c}$, so $a = ${a}$` }, { h: 'Evaluate', d: `$y = ${a}\\times ${X * X} ${sgn(c)} = ${a * X * X + c}$` }]
      });
    }
  },
  { // hyperbola reverse
    make: (rng, diff) => {
      const m = ri(rng, 1, 3 + diff), k = 12 * m;
      const x1 = rc(rng, [2, 3, 4, 6]), x2 = rc(rng, [1, 2, 3, 4, 6, 12].filter(v => v !== x1));
      const y1 = k / x1, y2 = k / x2;
      return N(`A hyperbola $y = \\dfrac{k}{x}$ passes through $(${x1}, ${y1})$. Find the value of $x$ when $y = ${y2}$.`, x2, {
        traps: [T(x1 * y2 / y1, 'This is $x$ and $y$ varying directly; for a hyperbola the product $xy$ is constant.'), T(y2 * k, 'Rearrange $y = \\dfrac{k}{x}$ to $x = \\dfrac{k}{y}$.')],
        hints: ['Find $k = xy$ first.', `$k = ${x1}\\times ${y1} = ${k}$.`, `$x = \\dfrac{${k}}{${y2}}$.`],
        steps: [{ h: 'Find k', d: `$k = ${x1}\\times ${y1} = ${k}$` }, { h: 'Rearrange', d: `$x = \\dfrac{k}{y} = \\dfrac{${k}}{${y2}} = ${x2}$` }]
      });
    }
  },
  { // MCQ: turning point to rule
    make: (rng) => {
      const h = nz(rng, -7, 7), k = nz(rng, -9, 9), down = rng() < 0.5;
      const rule = (hh, kk, d) => `$y = ${d ? '-' : ''}${sq(hh)} ${kk >= 0 ? '+' : '-'} ${Math.abs(kk)}$`;
      return M(rng, `A parabola has its turning point at $(${h}, ${k})$ and opens ${down ? 'downwards' : 'upwards'}. Which rule describes it?`,
        rule(h, k, down), [
          { text: rule(-h, k, down), why: 'The bracket holds $x - h$: a turning point at $x = ' + h + '$ needs $(x ' + (h >= 0 ? '-' : '+') + ' ' + Math.abs(h) + ')$.' },
          { text: rule(h, -k, down), why: 'The number added outside the bracket is the $y$-coordinate $k$, with its own sign.' },
          { text: rule(h, k, !down), why: down ? 'A negative sign in front of the bracket makes the parabola open downwards.' : 'Without a negative sign the parabola opens upwards.' }
        ],
        ['Turning-point form: $y = a(x - h)^2 + k$.', 'The sign of $a$ decides whether it opens up or down.', 'Match $h$ inside the bracket and $k$ outside.'],
        [{ h: 'Turning-point form', d: `$y = a(x - h)^2 + k$ with $(h, k) = (${h}, ${k})$` }, { h: 'Direction', d: `${down ? '$a < 0$ (opens downwards)' : '$a > 0$ (opens upwards)'}` }, { h: 'Rule', d: rule(h, k, down) }]);
    }
  },
  { // circle through a point
    diffs: [3, 4],
    make: (rng) => {
      const [a, b, c] = rc(rng, TRIPLES), m = ri(rng, 1, 4);
      const flip = rng() < 0.5;
      const px = (flip ? b : a) * m * (rng() < 0.5 ? -1 : 1), py = (flip ? a : b) * m * (rng() < 0.5 ? -1 : 1);
      return N(`A circle with its centre at the origin passes through the point $(${px}, ${py})$. Find its radius.`, c * m, {
        traps: [T(Math.abs(px) + Math.abs(py), 'The radius is the straight-line distance $\\sqrt{x^2 + y^2}$, not $|x| + |y|$.'), T(px * px + py * py, 'That is $r^2$; take the square root.')],
        hints: ['A circle centred at the origin has $x^2 + y^2 = r^2$.', `$${px * px} + ${py * py} = ${px * px + py * py}$.`, 'Take the positive square root.'],
        steps: [{ h: 'Substitute', d: `$r^2 = (${px})^2 + (${py})^2 = ${px * px + py * py}$` }, { h: 'Square root', d: `$r = ${c * m}$` }]
      });
    }
  }
];

// ── y9-algebra ───────────────────────────────────────────────────────────────
const algebra = [
  { // missing parameter in a binomial product
    make: (rng) => {
      const a = nz(rng, -7, 7); let k = nz(rng, -7, 7);
      const P = a + k, Q = a * k;
      if (rng() < 0.5) {
        return N(`When $(x ${sgn(a)})(x + k)$ is expanded and simplified, the result is $x^2 ${sgn(P)}x ${sgn(Q)}$. Find $k$.`, k, {
          traps: [T(P + a, 'The coefficient of $x$ is $a + k$, so subtract $a$ from it.'), T(Q, 'The constant term is the product $ak$, not $k$ itself.')],
          hints: ['Expand the brackets first.', `The $x$ term is $(${a} + k)x$.`, `$${a} + k = ${P}$.`],
          steps: [{ h: 'Expand', d: `$(x ${sgn(a)})(x + k) = x^2 + (${a} + k)x + ${par(a)}k$` }, { h: 'Match the $x$ term', d: `$${a} + k = ${P}$` }, { h: 'Solve', d: `$k = ${k}$` }]
        });
      }
      return N(`When $(x ${sgn(a)})(x + k)$ is expanded and simplified, the constant term is $${Q}$. Find $k$.`, k, {
        traps: [T(Q - a, 'The constant term is the product $a \\times k$, not the sum.'), T(Q * a, 'Divide by $a$ rather than multiplying.')],
        hints: ['The constant term is the product of the two numbers in the brackets.', `$${par(a)}\\times k = ${Q}$.`, `Divide both sides by ${par(a)}.`],
        steps: [{ h: 'Constant term', d: `$${par(a)}\\times k = ${Q}$` }, { h: 'Solve', d: `$k = \\dfrac{${Q}}{${par(a)}} = ${k}$` }]
      });
    }
  },
  { // MCQ factorise
    make: (rng, diff) => {
      let a, b;
      do { a = nz(rng, -9, 9); b = nz(rng, -9, 9); } while (a === b || a === -b);
      const P = a + b, Q = a * b;
      const fx = (u, v) => `$(x ${sgn(u)})(x ${sgn(v)})$`;
      return M(rng, `Factorise $x^2 ${sgn(P)}x ${sgn(Q)}$.`, fx(a, b), [
        { text: fx(-a, -b), why: 'Check by expanding: the signs give the opposite middle term.' },
        { text: fx(a, -b), why: 'The two numbers must multiply to the constant term and add to the $x$-coefficient.' },
        { text: `$(x ${sgn(P)})(x ${sgn(Q)})$`, why: 'The numbers are not the sum and product themselves: find two numbers with that sum and product.' }
      ],
        ['Find two numbers that multiply to the constant and add to the coefficient of $x$.', `Product ${Q}, sum ${P}.`, 'Check by expanding.'],
        [{ h: 'Product and sum', d: `Numbers with product $${Q}$ and sum $${P}$: $${a}$ and $${b}$` }, { h: 'Factorise', d: fx(a, b) }]);
    }
  },
  { // coefficient of x
    make: (rng) => {
      const m = ri(rng, 1, 4), n = ri(rng, 1, 4), a = nz(rng, -9, 9), b = nz(rng, -9, 9);
      const co = m * b + a * n;
      return N(`When $(${m === 1 ? '' : m}x ${sgn(a)})(${n === 1 ? '' : n}x ${sgn(b)})$ is expanded and simplified, what is the coefficient of $x$?`, co, {
        traps: [T(m * b, 'You need both the outer and the inner products.'), T(a + b, 'Each constant is multiplied by the coefficient in the other bracket.')],
        hints: ['Outer product plus inner product.', `Outer: $${m === 1 ? '' : m}x\\times ${par(b)} = ${m * b}x$.`, `Inner: $${par(a)}\\times ${n === 1 ? '' : n}x = ${a * n}x$.`],
        steps: [{ h: 'Outer', d: `$${m * b}x$` }, { h: 'Inner', d: `$${a * n}x$` }, { h: 'Add', d: `$${m * b}x ${sgn(a * n)}x = ${co}x$` }]
      });
    }
  },
  { // context: rectangle area
    make: (rng, diff) => {
      const a = ri(rng, 1, 8), b = ri(rng, 1, 8), X = ri(rng, 2, 6 + 2 * diff);
      const thing = rc(rng, ['vegetable garden', 'timber deck', 'rooftop terrace', 'netball court', 'paved courtyard']);
      return N(`A rectangular ${thing} in Sydney has length $(x + ${a})$ metres and width $(x + ${b})$ metres. Its area is $x^2 + px + q$ square metres. Find the area, in m², when $x = ${X}$ using the expanded form.`, (X + a) * (X + b), {
        suffix: 'm²',
        traps: [T(X * X + a * b, 'The middle term $(a + b)x$ is missing from the expansion.'), T((X + a) + (X + b), 'Area is length $\\times$ width, not their sum.')],
        hints: ['Expand $(x + a)(x + b)$.', `$x^2 + ${a + b}x + ${a * b}$.`, `Substitute $x = ${X}$.`],
        steps: [{ h: 'Expand', d: `$(x + ${a})(x + ${b}) = x^2 + ${a + b}x + ${a * b}$` }, { h: 'Substitute', d: `$${X * X} + ${(a + b) * X} + ${a * b} = ${(X + a) * (X + b)}$ m²` }]
      });
    }
  },
  { // difference of two squares mentally
    make: (rng) => {
      const c = rc(rng, [20, 30, 40, 50, 100]), d = ri(rng, 1, 9), A = c + d, B = c - d;
      return N(`Use $a^2 - b^2 = (a + b)(a - b)$ to evaluate $${A}^2 - ${B}^2$.`, 4 * c * d, {
        traps: [T((A - B) ** 2, 'Factorise as $(a + b)(a - b)$: the sum is also needed.'), T(A * A - B * A, 'Use the identity for both brackets: $(a + b)(a - b)$.')],
        hints: ['Write it as $(a + b)(a - b)$.', `$a + b = ${A + B}$ and $a - b = ${A - B}$.`, `Multiply $${A + B}\\times ${A - B}$.`],
        steps: [{ h: 'Factorise', d: `$${A}^2 - ${B}^2 = (${A} + ${B})(${A} - ${B}) = ${A + B}\\times ${A - B}$` }, { h: 'Multiply', d: `$${4 * c * d}$` }]
      });
    }
  },
  { // solve a quadratic by factorising
    diffs: [3, 4],
    make: (rng) => {
      let p, q;
      do { p = nz(rng, -9, 9); q = nz(rng, -9, 9); } while (p === q);
      const B = -(p + q), C = p * q, big = Math.max(p, q), small = Math.min(p, q);
      return N(`Solve $x^2 ${sgn(B)}x ${sgn(C)} = 0$. Give the **larger** of the two solutions.`, big, {
        traps: [T(small, 'That is the smaller solution.'), T(-big, 'If $(x - r) = 0$ then $x = r$: change the sign of the number in the bracket.')],
        hints: ['Factorise into two brackets.', `Two numbers with product $${C}$ and sum $${B}$.`, 'Each bracket gives one solution.'],
        steps: [{ h: 'Factorise', d: `$(x ${sgn(-p)})(x ${sgn(-q)}) = 0$` }, { h: 'Solve', d: `$x = ${p}$ or $x = ${q}$` }, { h: 'Larger', d: `$x = ${big}$` }]
      });
    }
  },
  { // completing the square constant
    diffs: [3, 4],
    make: (rng) => {
      const k = ri(rng, 2, 12), b = 2 * k * (rng() < 0.5 ? 1 : -1);
      return N(`What constant $c$ makes $x^2 ${sgn(b)}x + c$ a perfect square?`, k * k, {
        traps: [T(Math.abs(b), 'Halve the coefficient of $x$, then square it.'), T(k, 'Square the half as well: $c = (b \\div 2)^2$.')],
        hints: ['A perfect square is $(x + k)^2 = x^2 + 2kx + k^2$.', `Here $2k = ${b}$.`, `$k = ${b / 2}$, so $c = k^2$.`],
        steps: [{ h: 'Match', d: `$2k = ${b}$, so $k = ${b / 2}$` }, { h: 'Constant', d: `$c = k^2 = ${k * k}$` }]
      });
    }
  },
  { // identity: x^2 + y^2 from sum and product
    diffs: [3, 4],
    make: (rng) => {
      const a = ri(rng, 2, 9), b = ri(rng, 2, 9) + 0, S = a + b, P = a * b;
      return N(`Two positive numbers have a sum of $${S}$ and a product of $${P}$. Find the sum of their squares.`, a * a + b * b, {
        traps: [T(S * S, 'The sum of squares is $(x + y)^2 - 2xy$: subtract twice the product.'), T(S * S - P, 'Subtract $2xy$, not $xy$.')],
        hints: ['Expand $(x + y)^2 = x^2 + 2xy + y^2$.', `$x^2 + y^2 = ${S}^2 - 2(${P})$.`, 'Evaluate.'],
        steps: [{ h: 'Identity', d: `$x^2 + y^2 = (x + y)^2 - 2xy$` }, { h: 'Substitute', d: `$${S * S} - ${2 * P} = ${a * a + b * b}$` }]
      });
    }
  }
];

// ── y9-simint ────────────────────────────────────────────────────────────────
const RATES = [2, 2.5, 3, 3.5, 4, 4.5, 5, 6];
const simint = [
  { // find the principal
    make: (rng) => {
      const P = ri(rng, 5, 60) * 500 / 5, rr = rc(rng, RATES), n = ri(rng, 2, 8), I = r2(P * rr / 100 * n);
      return N(`An investment earned ${moneyPlain(I)} in simple interest over $${n}$ years at $${rr}\\%$ p.a. How much was originally invested?`, P, {
        prefix: '$', tol: 0.005,
        traps: [T(r2(I / (rr / 100)), `That is the principal times ${n}: divide by the number of years as well.`), T(r2(I / n), 'That is one year’s interest: divide by the rate as well.')],
        hints: ['Rearrange $I = Prn$ for $P$.', `$P = \\dfrac{I}{rn}$.`, `$P = \\dfrac{${I}}{${rr / 100}\\times ${n}}$.`],
        steps: [{ h: 'Rearrange', d: `$P = \\dfrac{I}{rn} = \\dfrac{${I}}{${rr / 100}\\times ${n}}$` }, { h: 'Evaluate', d: `$P = ${P}$` }]
      });
    }
  },
  { // find the time
    make: (rng) => {
      const P = ri(rng, 4, 80) * 250, rr = rc(rng, RATES), n = ri(rng, 2, 10), I = r2(P * rr / 100 * n);
      return N(`${moneyPlain(P)} is invested at $${rr}\\%$ p.a. simple interest and earns ${moneyPlain(I)}. For how many years was it invested?`, n, {
        suffix: 'years',
        traps: [T(r2(I / P * 100), 'That is the total percentage earned: divide it by the annual rate.'), T(r2(I / (P * rr)), 'Use the rate as a decimal: $r = ' + rr / 100 + '$.')],
        hints: ['Rearrange $I = Prn$ for $n$.', `$n = \\dfrac{I}{Pr}$.`, `$n = \\dfrac{${I}}{${P}\\times ${rr / 100}}$.`],
        steps: [{ h: 'Rearrange', d: `$n = \\dfrac{I}{Pr} = \\dfrac{${I}}{${P}\\times ${rr / 100}}$` }, { h: 'Evaluate', d: `$n = ${n}$ years` }]
      });
    }
  },
  { // months
    make: (rng) => {
      const P = ri(rng, 2, 40) * 500, rr = rc(rng, RATES), mo = rc(rng, [3, 6, 9, 18, 30]);
      const I = P * rr / 100 * mo / 12;
      return N(`${rc(rng, NAMES)} deposits ${moneyPlain(P)} for $${mo}$ months at $${rr}\\%$ p.a. simple interest. How much interest is earned, to the nearest cent?`, r2(I), {
        prefix: '$', tol: 0.005,
        traps: [T(r2(P * rr / 100 * mo), 'The time must be in years: $' + mo + '$ months is $\\dfrac{' + mo + '}{12}$ of a year.')],
        hints: ['Change the months to years.', `$n = \\dfrac{${mo}}{12}$ years.`, `$I = ${P}\\times ${rr / 100}\\times \\dfrac{${mo}}{12}$.`],
        steps: [{ h: 'Time in years', d: `$n = \\dfrac{${mo}}{12} = ${r2(mo / 12)}$` }, { h: 'Interest', d: `$I = ${P}\\times ${rr / 100}\\times \\dfrac{${mo}}{12} = ${r2(I)}$` }]
      });
    }
  },
  { // loan repayments
    make: (rng) => {
      const P = ri(rng, 4, 40) * 500, rr = rc(rng, [5, 6, 7, 8, 9, 10]), n = ri(rng, 2, 5);
      const total = P + P * rr / 100 * n, per = total / (12 * n);
      const what = rc(rng, ['a second-hand car', 'a surfboard and wetsuit', 'a caravan', 'a home theatre system']);
      return N(`${rc(rng, NAMES)} borrows ${moneyPlain(P)} for ${what} at $${rr}\\%$ p.a. simple interest for $${n}$ years, repaid in equal monthly instalments. Find each instalment, to the nearest cent.`, r2(per), {
        prefix: '$', tol: 0.005,
        traps: [T(r2(P / (12 * n)), 'Include the interest: repay the principal plus interest.'), T(r2(total / n), 'That is a yearly repayment; there are $12n$ monthly instalments.')],
        hints: ['Total repaid $=$ principal $+$ interest.', `Interest: $I = ${P}\\times ${rr / 100}\\times ${n} = ${r2(P * rr / 100 * n)}$.`, `Divide by $12\\times ${n} = ${12 * n}$ instalments.`],
        steps: [{ h: 'Interest', d: `$I = ${r2(P * rr / 100 * n)}$` }, { h: 'Total', d: `$${P} + ${r2(P * rr / 100 * n)} = ${r2(total)}$` }, { h: 'Per month', d: `$${r2(total)}\\div ${12 * n} = ${r2(per)}$` }]
      });
    }
  },
  { // two investments
    make: (rng) => {
      const P1 = ri(rng, 2, 20) * 500, P2 = ri(rng, 2, 20) * 500, r1_ = rc(rng, RATES), r2_ = rc(rng, RATES.filter(v => v !== r1_)), n = ri(rng, 2, 6);
      const tot = P1 * r1_ / 100 * n + P2 * r2_ / 100 * n;
      return N(`${moneyPlain(P1)} is invested at $${r1_}\\%$ p.a. and ${moneyPlain(P2)} at $${r2_}\\%$ p.a., both simple interest for $${n}$ years. Find the total interest earned on both.`, r2(tot), {
        prefix: '$', tol: 0.005,
        traps: [T(r2((P1 + P2) * r1_ / 100 * n), 'Each amount earns interest at its own rate.'), T(r2(tot / n), `That is one year’s total: multiply by ${n}.`)],
        hints: ['Find each interest separately.', `First: $${P1}\\times ${r1_ / 100}\\times ${n} = ${r2(P1 * r1_ / 100 * n)}$.`, 'Add the two amounts.'],
        steps: [{ h: 'First', d: `$${P1}\\times ${r1_ / 100}\\times ${n} = ${r2(P1 * r1_ / 100 * n)}$` }, { h: 'Second', d: `$${P2}\\times ${r2_ / 100}\\times ${n} = ${r2(P2 * r2_ / 100 * n)}$` }, { h: 'Total', d: `$${r2(tot)}$` }]
      });
    }
  },
  { // yearly interest gives principal
    make: (rng) => {
      const P = ri(rng, 2, 50) * 400, rr = rc(rng, RATES), I1 = r2(P * rr / 100);
      return N(`An account pays ${moneyPlain(I1)} each year in simple interest at $${rr}\\%$ p.a. What is the amount in the account earning that interest?`, P, {
        prefix: '$', tol: 0.005,
        traps: [T(r2(I1 * rr), 'Divide by the rate as a decimal, not multiply.'), T(r2(I1 / rr), 'The rate must be written as a decimal ($' + rr + '\\% = ' + rr / 100 + '$) or multiplied by 100.')],
        hints: ['One year’s interest is $P\\times r$.', `$${I1} = P\\times ${rr / 100}$.`, 'Divide both sides by the decimal rate.'],
        steps: [{ h: 'One year', d: `$I = Pr$, so $P = \\dfrac{I}{r}$` }, { h: 'Evaluate', d: `$P = \\dfrac{${I1}}{${rr / 100}} = ${P}$` }]
      });
    }
  },
  { // MCQ: which expression gives the total
    make: (rng) => {
      const P = ri(rng, 2, 40) * 500, rr = rc(rng, RATES), n = ri(rng, 2, 8);
      return M(rng, `${moneyPlain(P)} is invested at $${rr}\\%$ p.a. simple interest for $${n}$ years. Which expression gives the **total** value at the end?`,
        `$${P} + ${P}\\times ${rr / 100}\\times ${n}$`, [
          { text: `$${P}\\times ${rr / 100}\\times ${n}$`, why: 'That is only the interest; add the principal back.' },
          { text: `$${P}(1 + ${rr / 100})^{${n}}$`, why: 'That is compound interest; simple interest is the same amount every year.' },
          { text: `$${P} + ${P}\\times ${rr}\\times ${n}$`, why: `Write the rate as a decimal ($${rr}\\% = ${rr / 100}$).` }
        ],
        ['Simple interest: $I = Prn$.', 'Total $=$ principal $+$ interest.', 'Rate as a decimal.'],
        [{ h: 'Interest', d: `$I = ${P}\\times ${rr / 100}\\times ${n}$` }, { h: 'Total', d: `$A = ${P} + I$` }]);
    }
  },
  { // balances in a table
    make: (rng) => {
      const P = ri(rng, 4, 40) * 500, rr = rc(rng, [2, 4, 5, 6]), I1 = P * rr / 100, n = ri(rng, 5, 12);
      const B1 = P + I1, B2 = P + 2 * I1;
      return N(`A simple-interest account has a balance of ${moneyPlain(B1)} after 1 year and ${moneyPlain(B2)} after 2 years. What will the balance be after $${n}$ years?`, r2(P + n * I1), {
        prefix: '$', tol: 0.005,
        traps: [T(r2(B1 * n), 'The balance grows by the same dollar amount each year; it is not multiplied.'), T(r2(B2 + (n - 2) * B1), 'Add only the yearly interest, not the whole balance.')],
        hints: ['Simple interest adds the same amount every year.', `Yearly interest: $${B2} - ${B1} = ${r2(I1)}$.`, `Balance $= ${B1} + ${n - 1}\\times ${r2(I1)}$.`],
        steps: [{ h: 'Yearly interest', d: `$${B2} - ${B1} = ${r2(I1)}$` }, { h: 'After $n$ years', d: `$${B1} + ${n - 1}\\times ${r2(I1)} = ${r2(P + n * I1)}$` }]
      });
    }
  }
];

// ── y9-rate-change ───────────────────────────────────────────────────────────
const rateChange = [
  { // negative rate: remaining volume / time to empty
    make: (rng, diff) => {
      const r = ri(rng, 3, 9 + diff * 2), t = ri(rng, 2, 8), extra = ri(rng, 2, 12) * 5;
      const V = r * t + extra;
      const thing = rc(rng, ['swimming pool', 'water tank', 'rainwater tank', 'trough']);
      if (rng() < 0.5) {
        return N(`A ${thing} holds $${V}$ litres. Its volume is changing at a rate of $-${r}$ litres per minute. How many litres remain after $${t}$ minutes?`, extra, {
          suffix: 'L',
          traps: [T(V + r * t, 'A negative rate means the volume is falling.'), T(r * t, 'That is the amount lost; subtract it from the starting volume.')],
          hints: ['Change $=$ rate $\\times$ time.', `Change: $-${r}\\times ${t} = -${r * t}$.`, `Remaining: $${V} - ${r * t}$.`],
          steps: [{ h: 'Change in volume', d: `$-${r}\\times ${t} = -${r * t}$ L` }, { h: 'Remaining', d: `$${V} - ${r * t} = ${extra}$ L` }]
        });
      }
      return N(`A ${thing} holds $${r * t}$ litres and is drained at a constant $${r}$ litres per minute. How many minutes until it is empty?`, t, {
        suffix: 'min',
        traps: [T(r * t * r, 'Time $=$ amount $\\div$ rate.'), T(r * t - r, 'Divide rather than subtract.')],
        hints: ['Time $=$ amount $\\div$ rate.', `$\\dfrac{${r * t}}{${r}}$.`, 'Check by multiplying back.'],
        steps: [{ h: 'Divide', d: `$${r * t}\\div ${r} = ${t}$ minutes` }]
      });
    }
  },
  { // average speed from two readings
    make: (rng) => {
      const s = ri(rng, 3, 9), t1 = ri(rng, 1, 5), t2 = t1 + ri(rng, 2, 6), d1 = ri(rng, 4, 40);
      const d2 = d1 + s * (t2 - t1);
      return N(`${rc(rng, NAMES)} runs along the beach. After $${t1}$ seconds they are $${d1}$ m from the start and after $${t2}$ seconds they are $${d2}$ m from the start. What is their average speed between these times?`, s, {
        suffix: 'm/s',
        traps: [T(d2 / t2, 'Use the change in distance and the change in time, not the totals.'), T((d2 - d1) / t2, 'Divide by the time elapsed, $' + (t2 - t1) + '$ s, not the final time.')],
        hints: ['Average speed $=\\dfrac{\\text{change in distance}}{\\text{change in time}}$.', `Distance: $${d2} - ${d1} = ${d2 - d1}$ m.`, `Time: $${t2} - ${t1} = ${t2 - t1}$ s.`],
        steps: [{ h: 'Changes', d: `$${d2} - ${d1} = ${d2 - d1}$ m in $${t2} - ${t1} = ${t2 - t1}$ s` }, { h: 'Divide', d: `$\\dfrac{${d2 - d1}}{${t2 - t1}} = ${s}$ m/s` }]
      });
    }
  },
  { // unit conversion of rates
    make: (rng) => {
      if (rng() < 0.5) {
        const k = ri(rng, 2, 14), kmh = 18 * k, ms = 5 * k;
        return N(`A cyclist travels at $${kmh}$ km/h. Express this speed in metres per second.`, ms, {
          suffix: 'm/s',
          traps: [T(r1(kmh * 3.6), 'To change km/h into m/s, divide by $3.6$ (1000 m per 3600 s).'), T(r1(kmh / 60), 'There are 1000 m in a km and 3600 s in an hour: multiply by $\\dfrac{1000}{3600}$.')],
          hints: ['1 km $= 1000$ m and 1 h $= 3600$ s.', `$${kmh}\\times\\dfrac{1000}{3600}$.`, 'Divide by $3.6$.'],
          steps: [{ h: 'Convert', d: `$${kmh}\\times\\dfrac{1000}{3600} = ${kmh}\\div 3.6 = ${ms}$ m/s` }]
        });
      }
      const ms = ri(rng, 4, 40);
      return N(`A sprinter runs at $${ms}$ m/s. Express this speed in kilometres per hour, correct to 1 decimal place.`, r1(ms * 3.6), {
        suffix: 'km/h', tol: 0.05,
        traps: [T(r1(ms / 3.6), 'To change m/s into km/h, multiply by $3.6$.'), T(r1(ms * 60), 'There are 3600 seconds in an hour and 1000 m in a km: multiply by $3.6$.')],
        hints: ['In one hour there are 3600 s.', `$${ms}\\times 3600 = ${ms * 3600}$ m per hour.`, 'Divide by 1000 to get km.'],
        steps: [{ h: 'Convert', d: `$${ms}\\times 3.6 = ${r1(ms * 3.6)}$ km/h` }]
      });
    }
  },
  { // average rate of change of a quadratic model
    make: (rng) => {
      const a = ri(rng, 1, 5), b = ri(rng, 1, 8), p = ri(rng, 0, 4), q = p + ri(rng, 2, 4);
      const d = t => a * t * t + b * t;
      const rate = (d(q) - d(p)) / (q - p);
      return N(`A skateboarder rolls down a ramp so that the distance travelled after $t$ seconds is $d = ${a === 1 ? '' : a}t^2 + ${b}t$ metres. Find the average speed between $t = ${p}$ and $t = ${q}$ seconds.`, rate, {
        suffix: 'm/s',
        traps: [T(d(q) - d(p), 'Divide the change in distance by the change in time.'), T(d(q) / q, 'Start the interval at $t = ' + p + '$, not at zero.')],
        hints: ['Average speed $=\\dfrac{d(q) - d(p)}{q - p}$.', `$d(${p}) = ${d(p)}$ and $d(${q}) = ${d(q)}$.`, `$\\dfrac{${d(q) - d(p)}}{${q - p}}$.`],
        steps: [{ h: 'Distances', d: `$d(${p}) = ${d(p)}$, $d(${q}) = ${d(q)}$` }, { h: 'Rate', d: `$\\dfrac{${d(q)} - ${d(p)}}{${q} - ${p}} = ${rate}$ m/s` }]
      });
    }
  },
  { // falling temperature
    make: (rng) => {
      const r = ri(rng, 1, 4), h = ri(rng, 2, 6), T1 = ri(rng, 24, 38), T2 = T1 - r * h;
      return N(`In Sydney the temperature falls from $${T1}^\\circ$C at 2 pm to $${T2}^\\circ$C ${h} hours later. What is the average rate of change of temperature, in $^\\circ$C per hour? (A fall is a negative rate.)`, -r, {
        suffix: '°C/h',
        traps: [T(r, 'The temperature is falling, so the rate of change is negative.'), T(-(T1 - T2) * h, 'Divide the change by the time; do not multiply.')],
        hints: ['Rate $=\\dfrac{\\text{change in temperature}}{\\text{change in time}}$.', `Change: $${T2} - ${T1} = ${T2 - T1}$.`, `Divide by $${h}$ hours.`],
        steps: [{ h: 'Change', d: `$${T2} - ${T1} = ${T2 - T1}$` }, { h: 'Rate', d: `$\\dfrac{${T2 - T1}}{${h}} = ${-r}$ °C/h` }]
      });
    }
  },
  { // unit price comparison
    make: (rng) => {
      const pA = ri(rng, 30, 80) / 10, pB = pA + ri(rng, 3, 15) / 10;
      const nA = rc(rng, [2, 4, 5, 10]), nB = rc(rng, [2, 4, 5, 10]);
      const cA = r2(pA * nA), cB = r2(pB * nB);
      const item = rc(rng, ['mangoes', 'prawns', 'lamb mince', 'tomatoes', 'cherries']);
      return N(`Shop A sells ${item} for ${moneyPlain(cA)} for ${nA} kg. Shop B sells them for ${moneyPlain(cB)} for ${nB} kg. How much cheaper per kilogram is the better buy?`, r2(pB - pA), {
        prefix: '$', tol: 0.005,
        traps: [T(r2(Math.abs(cB - cA)), 'Compare the price per kilogram, not the total prices.'), T(r2(Math.abs(cB / nA - cA / nB)), 'Divide each price by its own number of kilograms.')],
        hints: ['Find each price per kilogram: price $\\div$ kilograms.', `Shop A: $${cA}\\div ${nA} = ${r2(cA / nA)}$.`, `Shop B: $${cB}\\div ${nB} = ${r2(cB / nB)}$.`],
        steps: [{ h: 'Unit prices', d: `A: $${r2(cA / nA)}$ per kg; B: $${r2(cB / nB)}$ per kg` }, { h: 'Difference', d: `$${r2(cB / nB)} - ${r2(cA / nA)} = ${r2(pB - pA)}$` }]
      });
    }
  },
  { // MCQ: which is the faster rate
    make: (rng) => {
      const sA = ri(rng, 40, 90) / 10, dA = r2(sA * ri(rng, 6, 20)), sB = sA + rc(rng, [-1, 1]) * ri(rng, 3, 15) / 10;
      const tA = r2(dA / sA), tB = ri(rng, 6, 20), dB = r2(sB * tB);
      const A = `Runner A: $${dA}$ m in $${tA}$ s`, B = `Runner B: $${dB}$ m in $${tB}$ s`;
      const fastA = dA / tA > dB / tB;
      return M(rng, `${A}. ${B}. Who has the greater average speed?`, fastA ? 'Runner A' : 'Runner B', [
        { text: fastA ? 'Runner B' : 'Runner A', why: 'Compare distance $\\div$ time for each runner.' },
        { text: 'They have the same average speed', why: `The speeds are $${r2(dA / tA)}$ and $${r2(dB / tB)}$ m/s: different.` },
        { text: dA > dB ? 'Runner A, because they ran further' : 'Runner B, because they ran further', why: 'Covering more distance does not mean a faster speed; time matters too.' }
      ].filter(d => !(d.text === (dA > dB ? (fastA ? 'Runner A' : 'Runner B') : '') )),
      ['Average speed $=\\dfrac{\\text{distance}}{\\text{time}}$.', 'Work out each speed.', 'Compare them.'],
      [{ h: 'Speeds', d: `A: $${dA}\\div ${tA} = ${r2(dA / tA)}$ m/s; B: $${dB}\\div ${tB} = ${r2(dB / tB)}$ m/s` }]);
    }
  }
];

// ── y9-trig ──────────────────────────────────────────────────────────────────
const trig = [
  { // ladder
    make: (rng) => {
      const L = ri(rng, 4, 12), ang = ri(rng, 55, 80), v = L * Math.sin(rad(ang));
      return N(`A ladder $${L}$ m long leans against a vertical wall and makes an angle of $${ang}°$ with the level ground. How high up the wall does it reach? Give your answer correct to 1 decimal place.`, r1(v), {
        suffix: 'm', tol: 0.06,
        traps: [T(r1(L * Math.cos(rad(ang))), 'That is the distance from the wall along the ground: the height is *opposite* the angle, so use sine.'), T(r1(L / Math.sin(rad(ang))), 'The ladder is the hypotenuse; the height is $L \\sin\\theta$, not $L \\div \\sin\\theta$.')],
        hints: ['Sketch the right-angled triangle: ladder $=$ hypotenuse.', 'The height is opposite the angle at the ground.', `$\\sin(${ang}°) = \\dfrac{h}{${L}}$.`],
        steps: [{ h: 'Choose sine', d: `$\\sin(${ang}°) = \\dfrac{h}{${L}}$` }, { h: 'Rearrange', d: `$h = ${L}\\sin(${ang}°) \\approx ${r1(v)}$ m` }]
      });
    }
  },
  { // angle of depression
    make: (rng) => {
      const h = ri(rng, 20, 90), ang = ri(rng, 15, 50), d = h / Math.tan(rad(ang));
      return N(`From a clifftop lookout $${h}$ m above the sea, the angle of depression to a boat is $${ang}°$. How far is the boat from the base of the cliff, correct to 1 decimal place?`, r1(d), {
        suffix: 'm', tol: 0.07,
        traps: [T(r1(h * Math.tan(rad(ang))), 'The distance is *adjacent* to the angle at the boat: divide the height by $\\tan\\theta$.'), T(r1(h / Math.sin(rad(ang))), 'That is the line of sight (the hypotenuse), not the distance along the sea.')],
        hints: ['The angle of depression equals the angle of elevation from the boat.', `$\\tan(${ang}°) = \\dfrac{${h}}{d}$.`, `$d = \\dfrac{${h}}{\\tan(${ang}°)}$.`],
        steps: [{ h: 'Alternate angles', d: `The angle at the boat is $${ang}°$` }, { h: 'Use tangent', d: `$\\tan(${ang}°) = \\dfrac{${h}}{d}$` }, { h: 'Solve', d: `$d = \\dfrac{${h}}{${Math.tan(rad(ang)).toFixed(3)}} \\approx ${r1(d)}$ m` }]
      });
    }
  },
  { // angle from sine
    make: (rng) => {
      const opp = ri(rng, 5, 20), hyp = opp + ri(rng, 3, 15), th = Math.asin(opp / hyp) * 180 / Math.PI;
      return N(`In a right-angled triangle the hypotenuse is $${hyp}$ cm and a side opposite the angle $\\theta$ is $${opp}$ cm. Find $\\theta$, correct to the nearest degree.`, Math.round(th), {
        suffix: '°', tol: 0.51, prefix: 'θ =',
        traps: [T(Math.round(Math.acos(opp / hyp) * 180 / Math.PI), 'Opposite $\\div$ hypotenuse is sine, not cosine.'), T(Math.round(opp / hyp * 100) / 100, 'That is $\\sin\\theta$; use the inverse sine to get the angle.')],
        hints: ['Opposite and hypotenuse: use sine.', `$\\sin\\theta = \\dfrac{${opp}}{${hyp}}$.`, `$\\theta = \\sin^{-1}(${(opp / hyp).toFixed(3)})$.`],
        steps: [{ h: 'Ratio', d: `$\\sin\\theta = \\dfrac{${opp}}{${hyp}} = ${(opp / hyp).toFixed(3)}$` }, { h: 'Inverse', d: `$\\theta = ${r1(th)}° \\approx ${Math.round(th)}°$` }]
      });
    }
  },
  { // MCQ: identify the ratio
    make: (rng) => {
      const [a0, b0, c0] = rc(rng, TRIPLES), m = ri(rng, 1, 3);
      const [a, b, c] = [a0 * m, b0 * m, c0 * m];
      const swap = rng() < 0.5, opp = swap ? b : a, adj = swap ? a : b;
      const fn = rc(rng, ['sin', 'cos', 'tan']);
      const R = { sin: [opp, c], cos: [adj, c], tan: [opp, adj] };
      const ds = Object.keys(R).filter(k => k !== fn).map(k => ({ text: fracTx(...R[k]), why: `That ratio is $${k}\\,\\theta$.` }));
      ds.push({ text: fracTx(R[fn][1], R[fn][0]), why: `That is the reciprocal of $${fn}\\,\\theta$.` });
      return M(rng, `A right-angled triangle has sides $${a}$ cm, $${b}$ cm and $${c}$ cm. The angle $\\theta$ is opposite the $${opp}$ cm side. Which fraction equals $${fn}\\,\\theta$?`, fracTx(...R[fn]), ds,
        ['Label the hypotenuse, opposite and adjacent sides.', 'SOH CAH TOA.', `The hypotenuse is $${c}$ cm.`],
        [{ h: 'Sides', d: `opposite $${opp}$, adjacent $${adj}$, hypotenuse $${c}$` }, { h: 'Ratio', d: `$${fn}\\,\\theta = \\dfrac{${R[fn][0]}}{${R[fn][1]}}$` }]);
    }
  },
  { // complementary identity
    make: (rng) => {
      let a; do { a = ri(rng, 10, 80); } while (a === 45);
      const fn = rc(rng, ['sin', 'cos']), other = fn === 'sin' ? 'cos' : 'sin';
      return N(`$\\${fn}\\,${a}° = \\${other}\\,\\theta$, where $\\theta$ is acute. Find $\\theta$.`, 90 - a, {
        suffix: '°', prefix: 'θ =',
        traps: [T(a, 'The sine of an angle equals the cosine of its complement: $\\theta = 90° - ' + a + '°$.'), T(180 - a, 'The two acute angles in a right triangle add to $90°$, not $180°$.')],
        hints: ['In a right triangle, sine of one acute angle is cosine of the other.', 'The acute angles add to $90°$.', `$\\theta = 90° - ${a}°$.`],
        steps: [{ h: 'Complementary angles', d: `$\\sin A = \\cos(90° - A)$` }, { h: 'Solve', d: `$\\theta = 90° - ${a}° = ${90 - a}°$` }]
      });
    }
  },
  { // ramp angle
    make: (rng) => {
      const rise = ri(rng, 3, 12) / 10, run = ri(rng, 6, 18), th = Math.atan(rise / run) * 180 / Math.PI;
      return N(`A ramp at a Sydney train station rises $${rise}$ m over a horizontal distance of $${run}$ m. Find the angle of the ramp to the horizontal, correct to 1 decimal place.`, r1(th), {
        suffix: '°', tol: 0.06,
        traps: [T(r1(90 - th), 'That is the angle at the top of the ramp; you need the angle with the horizontal.'), T(r1(Math.asin(rise / run) * 180 / Math.PI), 'The horizontal distance is the adjacent side, not the hypotenuse: use tangent.')],
        hints: ['Rise is opposite and the horizontal distance is adjacent.', `$\\tan\\theta = \\dfrac{${rise}}{${run}}$.`, 'Use the inverse tangent.'],
        steps: [{ h: 'Ratio', d: `$\\tan\\theta = \\dfrac{${rise}}{${run}} = ${(rise / run).toFixed(4)}$` }, { h: 'Inverse', d: `$\\theta = \\tan^{-1}(${(rise / run).toFixed(4)}) \\approx ${r1(th)}°$` }]
      });
    }
  },
  { // pole and shadow
    make: (rng) => {
      const s = ri(rng, 4, 25), ang = ri(rng, 25, 65), h = s * Math.tan(rad(ang));
      return N(`A flagpole casts a shadow $${s}$ m long on level ground when the sun's angle of elevation is $${ang}°$. How tall is the flagpole, correct to 1 decimal place?`, r1(h), {
        suffix: 'm', tol: 0.06,
        traps: [T(r1(s / Math.tan(rad(ang))), 'The pole is *opposite* the angle: height $=$ shadow $\\times\\tan\\theta$.'), T(r1(s * Math.sin(rad(ang))), 'The shadow is the adjacent side, so use tangent, not sine.')],
        hints: ['The shadow is adjacent, the pole is opposite.', `$\\tan(${ang}°) = \\dfrac{h}{${s}}$.`, `$h = ${s}\\tan(${ang}°)$.`],
        steps: [{ h: 'Tangent', d: `$\\tan(${ang}°) = \\dfrac{h}{${s}}$` }, { h: 'Solve', d: `$h = ${s}\\times ${Math.tan(rad(ang)).toFixed(3)} \\approx ${r1(h)}$ m` }]
      });
    }
  }
];

// ── y9-indices-sci ───────────────────────────────────────────────────────────
const indicesSci = [
  { // scientific notation to ordinary number
    make: (rng) => {
      let mant; do { mant = ri(rng, 11, 99) / 10; } while (Math.round(mant * 10) % 10 === 0);
      const small = rng() < 0.5, p = small ? ri(rng, 2, 6) : ri(rng, 3, 7);
      const val = Number(`${mant}e${small ? -p : p}`), wrong = Number(`${mant}e${small ? p : -p}`);
      return N(`Write ${sci(mant, small ? `-${p}` : p)} as an ordinary number.`, val, {
        tol: val * 1e-9,
        traps: [T(wrong, small ? 'A negative power moves the point to the *left*, making the number small.' : 'A positive power moves the point to the *right*, making the number large.'), T(Number(`${mant}e${small ? -(p - 1) : p - 1}`), 'Count the places the point moves: one more place than that.')],
        hints: [small ? 'A negative power means the number is less than 1.' : 'A positive power means the number is large.', `Move the decimal point ${p} places ${small ? 'left' : 'right'}.`, 'Fill any gaps with zeros.'],
        steps: [{ h: 'Move the point', d: `${p} places ${small ? 'left' : 'right'}` }, { h: 'Result', d: `$${val.toLocaleString('en-AU', { maximumFractionDigits: 12, useGrouping: false })}$` }]
      });
    }
  },
  { // quotient of scientific numbers: find exponent
    make: (rng) => {
      let m1, m2; do { m1 = ri(rng, 2, 9); m2 = ri(rng, 2, 9); } while (m1 === m2);
      const p = ri(rng, 4, 12), q = ri(rng, 1, 3);
      const n = p - q + (m1 < m2 ? -1 : 0);
      return N(`Evaluate $\\dfrac{${m1} \\times 10^{${p}}}{${m2} \\times 10^{${q}}}$ and write it as $a \\times 10^{n}$ with $1 \\le a < 10$. Enter $n$.`, n, {
        prefix: 'n =',
        traps: [T(p - q, m1 < m2 ? `$${m1} \\div ${m2} < 1$, so the mantissa must be rescaled and the power drops by 1.` : 'Subtract the powers: you may have been fine, check the mantissa.'), T(p + q, 'Dividing powers of 10 *subtracts* the indices.')],
        hints: ['Divide the mantissas and subtract the powers.', `$\\dfrac{${m1}}{${m2}} = ${r2(m1 / m2)}$ and $10^{${p}}\\div 10^{${q}} = 10^{${p - q}}$.`, m1 < m2 ? 'The mantissa is less than 1, so rewrite it between 1 and 10.' : 'The mantissa is already between 1 and 10.'],
        steps: [{ h: 'Mantissas', d: `$${m1}\\div ${m2} = ${r2(m1 / m2)}$` }, { h: 'Powers', d: `$10^{${p}}\\div 10^{${q}} = 10^{${p - q}}$` }, { h: 'Normalise', d: `$n = ${n}$` }]
      });
    }
  },
  { // time = distance / speed
    make: (rng) => {
      const m = rc(rng, [2, 3, 4, 5]), j = ri(rng, 2, 9), q = ri(rng, 2, 5), p = q + ri(rng, 1, 4);
      const t = j * 10 ** (p - q);
      return N(`A probe travels at $${m} \\times 10^{${q}}$ km/h. How many hours does it take to travel $${m * j} \\times 10^{${p}}$ km?`, t, {
        suffix: 'h',
        traps: [T(j * 10 ** (p + q), 'Time $=$ distance $\\div$ speed, so the powers of 10 are subtracted.'), T(m * j * 10 ** (p - q), 'Divide the mantissas too.')],
        hints: ['Time $=$ distance $\\div$ speed.', `$\\dfrac{${m * j} \\times 10^{${p}}}{${m} \\times 10^{${q}}}$.`, `Subtract the powers: $10^{${p - q}}$.`],
        steps: [{ h: 'Divide', d: `$\\dfrac{${m * j}}{${m}} \\times 10^{${p} - ${q}} = ${j} \\times 10^{${p - q}}$` }, { h: 'Evaluate', d: `$${t}$ hours` }]
      });
    }
  },
  { // power of a power and coefficient
    make: (rng) => {
      if (rng() < 0.5) {
        const a = ri(rng, 1, 4), b = ri(rng, 2, 4), c = ri(rng, 1, a * b - 1) , n = a * b - c;
        return N(`Simplify $\\dfrac{(x^{${a}})^{${b}}}{x^{${c}}}$, giving the answer as $x^{n}$. Enter $n$.`, n, {
          prefix: 'n =',
          traps: [T(a + b - c, 'A power of a power *multiplies* the indices.'), T(a * b + c, 'Dividing by $x^{' + c + '}$ subtracts the index.')],
          hints: ['Power of a power: multiply the indices.', `$(x^{${a}})^{${b}} = x^{${a * b}}$.`, `$x^{${a * b}}\\div x^{${c}} = x^{${a * b} - ${c}}$.`],
          steps: [{ h: 'Power of a power', d: `$x^{${a * b}}$` }, { h: 'Quotient', d: `$x^{${a * b} - ${c}} = x^{${n}}$` }]
        });
      }
      const k = ri(rng, 2, 4), a = ri(rng, 1, 4), b = ri(rng, 2, 3);
      return N(`$(${k}x^{${a}})^{${b}} = cx^{${a * b}}$. Find the value of $c$.`, k ** b, {
        prefix: 'c =',
        traps: [T(k * b, 'The coefficient is raised to the power too: $c = k^{b}$.'), T(k, 'Every factor inside the bracket is raised to the power ' + b + '.')],
        hints: ['Raise each factor in the bracket to the power.', `$(${k})^{${b}}$.`, `$(x^{${a}})^{${b}} = x^{${a * b}}$.`],
        steps: [{ h: 'Coefficient', d: `$${k}^{${b}} = ${k ** b}$` }, { h: 'Index', d: `$(x^{${a}})^{${b}} = x^{${a * b}}$` }]
      });
    }
  },
  { // evaluate with zero and negative indices
    make: (rng) => {
      const a = ri(rng, 2, 4), b = rc(rng, [2, 3, 4, 5]), p = ri(rng, 1, 3);
      if (rng() < 0.5) {
        const f = new Frac(1, b ** p).add(new Frac(1, 1));
        return F(`Evaluate $${a}^0 + ${b}^{-${p}}$, giving your answer as a fraction.`, f, {
          input: 'e.g. 9/8',
          traps: [T(1 + b * p * -1, 'A negative index means a reciprocal, not a negative number.'), T(1 / (b ** p), 'Anything to the power $0$ is $1$; add it.')],
          hints: [`$${a}^0 = 1$.`, `$${b}^{-${p}} = \\dfrac{1}{${b ** p}}$.`, 'Add the two values.'],
          steps: [{ h: 'Zero index', d: `$${a}^0 = 1$` }, { h: 'Negative index', d: `$${b}^{-${p}} = \\dfrac{1}{${b ** p}}$` }, { h: 'Add', d: `$1 + \\dfrac{1}{${b ** p}} = ${f.latex()}$` }]
        });
      }
      const c = rc(rng, [2, 3, 4]), q = ri(rng, 1, 2), f = new Frac(c ** q, b ** p);
      if (f.d === 1) return indicesSci[4].make(rng);
      return F(`Evaluate $${c}^{${q}} \\times ${b}^{-${p}}$, giving your answer as a fraction in simplest form.`, f, {
        input: 'e.g. 4/9',
        traps: [T(-(c ** q) * b * p, 'A negative index means a reciprocal.'), T(c ** q / b ** p * -1, 'The answer is not negative.')],
        hints: [`$${b}^{-${p}} = \\dfrac{1}{${b ** p}}$.`, `$${c}^{${q}} = ${c ** q}$.`, 'Multiply and simplify.'],
        steps: [{ h: 'Negative index', d: `$${b}^{-${p}} = \\dfrac{1}{${b ** p}}$` }, { h: 'Multiply', d: `$${c ** q}\\times\\dfrac{1}{${b ** p}} = ${f.latex()}$` }]
      });
    }
  },
  { // MCQ: compare scientific numbers
    make: (rng) => {
      for (let tries = 0; tries < 200; tries++) {
        const items = [];
        const seen = new Set();
        while (items.length < 4) {
          const m = ri(rng, 11, 99) / 10, e = ri(rng, -4, 6), v = Number(`${m}e${e}`);
          if (seen.has(v)) continue;
          seen.add(v); items.push({ m, e, v });
        }
        const largest = rng() < 0.5;
        const sorted = [...items].sort((x, y) => largest ? y.v - x.v : x.v - y.v);
        const best = sorted[0];
        const hi = Math.max(...items.map(i => i.m)), byMant = items.find(i => i.m === hi);
        if (byMant === best) continue;
        return M(rng, `Which of these is the ${largest ? 'largest' : 'smallest'} number?`, sci(best.m, best.e),
          items.filter(i => i !== best).map(i => ({ text: sci(i.m, i.e), why: 'Compare the powers of 10 first; the mantissa only matters when the powers are equal.' })),
          ['Compare the powers of 10 first.', 'A bigger exponent means a bigger number.', 'Use the mantissa only to break ties.'],
          [{ h: 'Order by power', d: `${largest ? 'Largest' : 'Smallest'} exponent decides: ${sci(best.m, best.e)}` }]);
      }
      return indicesSci[0].make(rng);
    }
  },
  { // MCQ: negative index meaning
    make: (rng) => {
      const b = ri(rng, 2, 9), p = ri(rng, 2, 5);
      return M(rng, `Which expression is equal to $${b}^{-${p}}$?`, `$\\dfrac{1}{${b}^{${p}}}$`, [
        { text: `$-${b}^{${p}}$`, why: 'A negative index does not make the value negative.' },
        { text: `$-${b * p}$`, why: 'The index is not multiplied by the base.' },
        { text: `$${b}^{${p}}$`, why: 'A negative index takes the reciprocal.' }
      ],
        ['A negative index means a reciprocal.', '$a^{-n} = \\dfrac{1}{a^n}$.', 'Not a negative number.'],
        [{ h: 'Rule', d: `$${b}^{-${p}} = \\dfrac{1}{${b}^{${p}}}$` }]);
    }
  }
];

// ── y9-data-inquiry ──────────────────────────────────────────────────────────
const dataInquiry = [
  { // compare two IQRs
    make: (rng) => {
      const mk = () => { const mn = ri(rng, 5, 30), q1 = mn + ri(rng, 3, 8), md = q1 + ri(rng, 3, 8), iqr = ri(rng, 8, 22); return { mn, q1, md, q3: Math.max(q1 + iqr, md + 2), mx: 0 }; };
      const A = mk(), B = mk();
      A.mx = A.q3 + ri(rng, 3, 12); B.mx = B.q3 + ri(rng, 3, 12);
      const ia = A.q3 - A.q1, ib = B.q3 - B.q1;
      if (ia === ib) return dataInquiry[0].make(rng);
      const s = o => `min $${o.mn}$, $Q_1 = ${o.q1}$, median $${o.md}$, $Q_3 = ${o.q3}$, max $${o.mx}$`;
      return N(`Class A scores: ${s(A)}. Class B scores: ${s(B)}. By how many marks is the interquartile range of the class with the **greater** spread larger?`, Math.abs(ia - ib), {
        suffix: 'marks',
        traps: [T(Math.abs((A.mx - A.mn) - (B.mx - B.mn)), 'That compares the ranges; use $Q_3 - Q_1$ for each class.'), T(Math.abs(A.md - B.md), 'Compare the interquartile ranges, not the medians.')],
        hints: ['IQR $= Q_3 - Q_1$ for each class.', `A: $${A.q3} - ${A.q1} = ${ia}$.`, `B: $${B.q3} - ${B.q1} = ${ib}$.`],
        steps: [{ h: 'IQRs', d: `A: $${ia}$, B: $${ib}$` }, { h: 'Difference', d: `$${Math.abs(ia - ib)}$` }]
      });
    }
  },
  { // score needed on the next test
    make: (rng) => {
      for (let i = 0; i < 400; i++) {
        const sc = Array.from({ length: 4 }, () => ri(rng, 52, 95)), tgt = ri(rng, 65, 85), sum = sc.reduce((s, v) => s + v, 0), need = 5 * tgt - sum;
        if (need < 30 || need > 100) continue;
        const avg = sum / 4;
        return N(`${rc(rng, NAMES)} scored $${sc.join(', ')}$ in four maths tests. What score is needed in the fifth test to bring the mean of all five tests to exactly $${tgt}$?`, need, {
          traps: [T(tgt, 'The fifth score must make up for the earlier scores that are above or below the target.'), T(r2(tgt + (tgt - avg)), 'The shortfall is spread over five tests, not four: use the total.')],
          hints: ['Total needed $=5\\times$ the target mean.', `$5\\times ${tgt} = ${5 * tgt}$.`, `Subtract the four scores (total $${sum}$).`],
          steps: [{ h: 'Total needed', d: `$5\\times ${tgt} = ${5 * tgt}$` }, { h: 'Fifth score', d: `$${5 * tgt} - ${sum} = ${need}$` }]
        });
      }
      return dataInquiry[0].make(rng);
    }
  },
  { // removing a value
    make: (rng) => {
      const n = ri(rng, 5, 9), mp = ri(rng, 20, 60), t = ri(rng, 1, 6), m = mp + t, v = mp + n * t;
      return N(`The mean of $${n}$ values is $${m}$. When the value $${v}$ is removed, what is the mean of the remaining $${n - 1}$ values?`, mp, {
        traps: [T(m, 'Removing a value changes the total and the count.'), T(m - v, 'Work with totals: find the original total first.')],
        hints: [`Original total: $${n}\\times ${m} = ${n * m}$.`, `Subtract the removed value $${v}$.`, `Divide by $${n - 1}$.`],
        steps: [{ h: 'Original total', d: `$${n}\\times ${m} = ${n * m}$` }, { h: 'Remaining total', d: `$${n * m} - ${v} = ${n * m - v}$` }, { h: 'New mean', d: `$${n * m - v}\\div ${n - 1} = ${mp}$` }]
      });
    }
  },
  { // stem-and-leaf
    make: (rng) => {
      const n = rc(rng, [9, 11, 13]), vals = Array.from({ length: n }, () => ri(rng, 10, 69)).sort((a, b) => a - b);
      const stems = [...new Set(vals.map(v => Math.floor(v / 10)))];
      const rows = stems.map(s => `${s} | ${vals.filter(v => Math.floor(v / 10) === s).map(v => v % 10).join(' ')}`).join('\n');
      const range = rng() < 0.5;
      const med = vals[(n - 1) / 2];
      return N(`A stem-and-leaf plot shows the number of surf-club members at ${n} beaches (key: $3 | 4$ means $34$).\n${rows}\nFind the ${range ? 'range' : 'median'}.`, range ? vals[n - 1] - vals[0] : med, {
        traps: range ? [T(vals[n - 1], 'The range is largest minus smallest.')] : [T(vals[(n - 1) / 2 - 1], `The median is the ${(n + 1) / 2}th value: count the leaves, not the stems.`), T(stems[Math.floor(stems.length / 2)], 'The median is a data value, not a stem.')],
        hints: ['Read each stem and leaf as a two-digit number.', `There are ${n} values.`, range ? 'Subtract the smallest from the largest.' : `The median is the ${(n + 1) / 2}th value.`],
        steps: [{ h: 'List in order', d: `$${vals.join(', ')}$` }, { h: range ? 'Range' : 'Median', d: range ? `$${vals[n - 1]} - ${vals[0]} = ${vals[n - 1] - vals[0]}$` : `The ${(n + 1) / 2}th value is $${med}$` }]
      });
    }
  },
  { // MCQ: median class
    make: (rng) => {
      const k = rc(rng, [4, 5]), w = rc(rng, [5, 10]), fs = Array.from({ length: k }, () => ri(rng, 3, 14));
      const tot = () => fs.reduce((s, v) => s + v, 0);
      const clsAt = r => { let c = 0; for (let i = 0; i < k; i++) { c += fs[i]; if (c >= r) return i; } return k - 1; };
      // keep the median class unambiguous: odd total, or both middle values in one class
      for (let g = 0; g < 100 && tot() % 2 === 0 && clsAt(tot() / 2) !== clsAt(tot() / 2 + 1); g++) fs[ri(rng, 0, k - 1)] += 1;
      const N_ = tot(), pos = (N_ + 1) / 2;
      const idx = clsAt(Math.ceil(pos));
      const lab = i => `$${i * w}$–$${i * w + w - 1}$`;
      const modal = fs.indexOf(Math.max(...fs));
      const ds = [];
      for (let i = 0; i < k; i++) if (i !== idx) ds.push({ text: lab(i), why: i === modal ? 'That is the modal class (the tallest). The median class is found from cumulative frequency.' : 'Find where the cumulative frequency reaches the middle position.' });
      return M(rng, `The scores of $${N_}$ students are grouped: ${fs.map((f, i) => `${i * w}–${i * w + w - 1}: ${f} students`).join('; ')}. Which class contains the median?`, lab(idx), ds,
        ['Find the middle position $(N + 1)\\div 2$.', 'Add frequencies as you go (cumulative).', 'The class where the total first reaches that position holds the median.'],
        [{ h: 'Middle position', d: `$(${N_} + 1)\\div 2 = ${pos}$` }, { h: 'Cumulative', d: `The ${pos}th value falls in ${lab(idx)}` }]);
    }
  },
  { // count outliers
    make: (rng) => {
      for (let i = 0; i < 300; i++) {
        const q1 = ri(rng, 20, 40), iqr = ri(rng, 8, 20), q3 = q1 + iqr, lo = q1 - 1.5 * iqr, hi = q3 + 1.5 * iqr;
        const vals = Array.from({ length: 8 }, () => ri(rng, Math.max(1, Math.floor(lo) - 15), Math.ceil(hi) + 20));
        if (vals.some(v => v === lo || v === hi)) continue;
        const out = vals.filter(v => v < lo || v > hi).length, up = vals.filter(v => v > hi).length;
        if (out < 1) continue;
        return N(`A data set has $Q_1 = ${q1}$ and $Q_3 = ${q3}$. Using the $1.5\\times\\text{IQR}$ rule, how many of these values are outliers: $${vals.join(', ')}$?`, out, {
          traps: [T(up, 'Check below the lower fence as well as above the upper fence.'), T(vals.filter(v => v < q1 || v > q3).length, 'Outliers lie beyond the fences, not just outside the box.')],
          hints: ['Find the IQR, then both fences.', `IQR $= ${iqr}$; lower fence $= ${lo}$; upper fence $= ${hi}$.`, 'Count values below the lower or above the upper fence.'],
          steps: [{ h: 'Fences', d: `$${q1} - ${1.5 * iqr} = ${lo}$ and $${q3} + ${1.5 * iqr} = ${hi}$` }, { h: 'Count', d: `${out} value${out === 1 ? '' : 's'} outside $[${lo}, ${hi}]$` }]
        });
      }
      return dataInquiry[1].make(rng);
    }
  },
  { // median from a frequency table
    make: (rng) => {
      const xs = [ri(rng, 1, 2), ri(rng, 3, 4), ri(rng, 5, 6), ri(rng, 7, 8), ri(rng, 9, 10)];
      for (let i = 0; i < 100; i++) {
        const fs = xs.map(() => ri(rng, 1, 8)), n = fs.reduce((s, v) => s + v, 0);
        if (n % 2 === 0) continue;
        let cum = 0, med = xs[0];
        for (let j = 0; j < 5; j++) { cum += fs[j]; if (cum >= (n + 1) / 2) { med = xs[j]; break; } }
        return N(`A frequency table: ${xs.map((x, j) => `score $${x}$ occurs ${fs[j]} time${fs[j] === 1 ? '' : 's'}`).join('; ')}. Find the median score.`, med, {
          traps: [T(xs[2], 'The median is not the middle row: use cumulative frequency to find the middle value.'), T(xs[fs.indexOf(Math.max(...fs))], 'That is the mode (most frequent).')],
          hints: [`There are $${n}$ values, so the median is the $${(n + 1) / 2}$th.`, 'Add the frequencies down the table.', 'Find the score where the running total reaches that position.'],
          steps: [{ h: 'Position', d: `$(${n} + 1)\\div 2 = ${(n + 1) / 2}$th value` }, { h: 'Cumulative', d: `the $${(n + 1) / 2}$th value is $${med}$` }]
        });
      }
      return dataInquiry[1].make(rng);
    }
  }
];

// ── y9-data ──────────────────────────────────────────────────────────────────
const data = [
  { // median of an even-sized list
    make: (rng) => {
      for (let i = 0; i < 200; i++) {
        const n = rc(rng, [6, 8, 10]), d = Array.from({ length: n }, () => ri(rng, 2, 50)).sort((a, b) => a - b);
        if (d[n / 2 - 1] === d[n / 2]) continue;
        const med = (d[n / 2 - 1] + d[n / 2]) / 2;
        return N(`For the ordered data set $${d.join(',\\ ')}$, find the **median**.`, med, {
          traps: [T(d[n / 2], 'With an even number of values the median is the mean of the two middle values.'), T(d[n / 2 - 1], 'Average the two middle values.')],
          hints: [`There are ${n} values, so there is no single middle value.`, `The middle two are the ${n / 2}th and ${n / 2 + 1}th.`, 'Find their mean.'],
          steps: [{ h: 'Middle two', d: `$${d[n / 2 - 1]}$ and $${d[n / 2]}$` }, { h: 'Mean', d: `$\\dfrac{${d[n / 2 - 1]} + ${d[n / 2]}}{2} = ${med}$` }]
        });
      }
      return data[1].make(rng);
    }
  },
  { // unordered median
    make: (rng) => {
      for (let i = 0; i < 200; i++) {
        const n = rc(rng, [7, 9, 11]), d = Array.from({ length: n }, () => ri(rng, 2, 60));
        const s = [...d].sort((a, b) => a - b), med = s[(n - 1) / 2];
        if (d[(n - 1) / 2] === med) continue;
        return N(`Daily rainfall (mm) at a Sydney weather station over ${n} days was $${d.join(',\\ ')}$. Find the median rainfall.`, med, {
          suffix: 'mm',
          traps: [T(d[(n - 1) / 2], 'Put the data in order first: the median is the middle of the *ordered* list.')],
          hints: ['Write the values in order from smallest to largest.', `The median is the ${(n + 1) / 2}th value.`, 'Read it off the ordered list.'],
          steps: [{ h: 'Order', d: `$${s.join(',\\ ')}$` }, { h: 'Median', d: `the ${(n + 1) / 2}th value is $${med}$ mm` }]
        });
      }
      return data[0].make(rng);
    }
  },
  { // lower fence
    make: (rng) => {
      const q1 = ri(rng, 20, 45), q3 = q1 + ri(rng, 6, 20), iqr = q3 - q1;
      return N(`A data set has $Q_1 = ${q1}$ and $Q_3 = ${q3}$. Using the $1.5\\times\\text{IQR}$ rule, below what value is a data point an outlier?`, q1 - 1.5 * iqr, {
        traps: [T(q1 - iqr, 'The fence is $1.5\\times\\text{IQR}$ beyond the quartile, not $1\\times$.'), T(q3 + 1.5 * iqr, 'That is the upper fence; subtract from $Q_1$ for the lower fence.')],
        hints: [`IQR $= ${q3} - ${q1} = ${iqr}$.`, `$1.5\\times ${iqr} = ${1.5 * iqr}$.`, 'Subtract that from $Q_1$.'],
        steps: [{ h: 'IQR', d: `$${iqr}$` }, { h: 'Lower fence', d: `$${q1} - ${1.5 * iqr} = ${q1 - 1.5 * iqr}$` }]
      });
    }
  },
  { // MCQ: is this an outlier
    make: (rng) => {
      for (let i = 0; i < 300; i++) {
        const q1 = ri(rng, 20, 40), iqr = ri(rng, 8, 20), q3 = q1 + iqr, lo = q1 - 1.5 * iqr, hi = q3 + 1.5 * iqr;
        const v = ri(rng, Math.floor(lo) - 10, Math.ceil(hi) + 10);
        if (v === lo || v === hi || v < 0) continue;
        const status = v < lo ? 'below' : v > hi ? 'above' : 'within';
        const opts = {
          below: { text: `Yes, it is below the lower fence of $${lo}$`, why: status === 'below' ? '' : 'The value is not below the lower fence.' },
          above: { text: `Yes, it is above the upper fence of $${hi}$`, why: 'The value is not above the upper fence.' },
          within: { text: `No, it lies between the fences $${lo}$ and $${hi}$`, why: 'Check the value against the fences: it lies beyond one of them.' }
        };
        const ds = Object.keys(opts).filter(k => k !== status).map(k => ({ text: opts[k].text, why: status === 'within' ? 'The value lies inside both fences, so it is not an outlier.' : opts[k].why }));
        return M(rng, `A data set has $Q_1 = ${q1}$ and $Q_3 = ${q3}$. Is the value $${v}$ an outlier by the $1.5\\times\\text{IQR}$ rule?`, opts[status].text, ds,
          ['Find the IQR and both fences.', `IQR $= ${iqr}$.`, 'Compare the value with the fences.'],
          [{ h: 'Fences', d: `$${lo}$ and $${hi}$` }, { h: 'Compare', d: opts[status].text }]);
      }
      return data[2].make(rng);
    }
  },
  { // MCQ: skewness from five-number summary
    make: (rng) => {
      for (let i = 0; i < 300; i++) {
        const mn = ri(rng, 2, 15), q1 = mn + ri(rng, 3, 14), med = q1 + ri(rng, 2, 14), q3 = med + ri(rng, 2, 14), mx = q3 + ri(rng, 3, 20);
        const lower = med - q1, upper = q3 - med, tl = q1 - mn, tu = mx - q3;
        if (Math.abs(lower - upper) < 3) continue;
        if (tl === tu || (lower < upper) !== (tl < tu)) continue;
        const pos = lower < upper;
        return M(rng, `A box plot has min $${mn}$, $Q_1 = ${q1}$, median $${med}$, $Q_3 = ${q3}$, max $${mx}$. Describe the shape of the distribution.`,
          pos ? 'Positively skewed (longer tail to the right)' : 'Negatively skewed (longer tail to the left)', [
            { text: pos ? 'Negatively skewed (longer tail to the left)' : 'Positively skewed (longer tail to the right)', why: pos ? 'The median is closer to $Q_1$ and the upper whisker is longer: the tail is on the right.' : 'The median is closer to $Q_3$ and the lower whisker is longer: the tail is on the left.' },
            { text: 'Approximately symmetric', why: `The median is ${lower} above $Q_1$ but ${upper} below $Q_3$: not symmetric.` }
          ],
          ['Compare $\\text{median} - Q_1$ with $Q_3 - \\text{median}$.', 'The longer side shows the tail.', 'A tail to the right is positive skew.'],
          [{ h: 'Compare', d: `$${med} - ${q1} = ${lower}$ and $${q3} - ${med} = ${upper}$` }, { h: 'Shape', d: pos ? 'tail to the right: positive skew' : 'tail to the left: negative skew' }]);
      }
      return data[2].make(rng);
    }
  },
  { // dot plot median
    make: (rng) => {
      for (let i = 0; i < 200; i++) {
        const k = ri(rng, 4, 6), start = ri(rng, 1, 5), xs = Array.from({ length: k }, (_, j) => start + j), fs = xs.map(() => ri(rng, 1, 7));
        const n = fs.reduce((s, v) => s + v, 0);
        if (n % 2 === 0) continue;
        let cum = 0, med = xs[0];
        for (let j = 0; j < k; j++) { cum += fs[j]; if (cum >= (n + 1) / 2) { med = xs[j]; break; } }
        const mode = xs[fs.indexOf(Math.max(...fs))];
        return N(`A dot plot of the goals scored in $${n}$ netball games has ${xs.map((x, j) => `${fs[j]} dot${fs[j] === 1 ? '' : 's'} above ${x}`).join(', ')}. What is the median number of goals?`, med, {
          traps: [T(xs[Math.floor(k / 2)], 'The median is found by counting dots, not by taking the middle number on the axis.'), T(mode, 'That is the mode (the tallest stack).')],
          hints: [`$${n}$ dots, so the median is the $${(n + 1) / 2}$th dot.`, 'Count the dots from the left.', 'Which value is the middle dot above?'],
          steps: [{ h: 'Position', d: `$(${n} + 1)\\div 2 = ${(n + 1) / 2}$` }, { h: 'Count dots', d: `the $${(n + 1) / 2}$th dot is above $${med}$` }]
        });
      }
      return data[0].make(rng);
    }
  },
  { // IQR from fence
    make: (rng) => {
      const q3 = ri(rng, 30, 60), iqr = ri(rng, 4, 20), F_ = q3 + 1.5 * iqr;
      return N(`A data set has $Q_3 = ${q3}$ and the upper fence for outliers, using the $1.5\\times\\text{IQR}$ rule, is $${F_}$. Find the interquartile range.`, iqr, {
        traps: [T(F_ - q3, 'That is $1.5\\times\\text{IQR}$: divide it by $1.5$.'), T(F_ - q3 - 1.5, 'The fence is $Q_3 + 1.5\\times\\text{IQR}$.')],
        hints: ['Upper fence $= Q_3 + 1.5\\times\\text{IQR}$.', `$${F_} - ${q3} = ${F_ - q3}$.`, 'Divide by $1.5$.'],
        steps: [{ h: 'Subtract $Q_3$', d: `$1.5\\times\\text{IQR} = ${F_} - ${q3} = ${F_ - q3}$` }, { h: 'Divide', d: `$\\text{IQR} = ${F_ - q3}\\div 1.5 = ${iqr}$` }]
      });
    }
  }
];

// ── y9-probability ───────────────────────────────────────────────────────────
const DECK = [];
for (const s of ['hearts', 'diamonds', 'clubs', 'spades']) for (const r of ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']) DECK.push({ s, r });
const CARD_EVENTS = [
  ['a heart', c => c.s === 'hearts'], ['a spade', c => c.s === 'spades'], ['a club', c => c.s === 'clubs'],
  ['a red card', c => c.s === 'hearts' || c.s === 'diamonds'], ['a king', c => c.r === 'K'], ['a queen', c => c.r === 'Q'],
  ['an ace', c => c.r === 'A'], ['a face card (J, Q or K)', c => ['J', 'Q', 'K'].includes(c.r)]
];
const probability = [
  { // complement
    make: (rng) => {
      if (rng() < 0.5) {
        const n = ri(rng, 3, 6), f = new Frac(2 ** n - 1, 2 ** n);
        return F(`A fair coin is tossed $${n}$ times. Find the probability of getting **at least one head**, as a fraction in simplest form.`, f, {
          input: 'e.g. 7/8',
          traps: [T(1 / 2 ** n, 'That is the probability of *no* heads (all tails); subtract it from 1.'), T(n / 2 ** n, 'Use the complement: $1 - P(\\text{no heads})$.')],
          hints: ['Use the complement: $P(\\text{at least one}) = 1 - P(\\text{none})$.', `$P(\\text{all tails}) = \\dfrac{1}{${2 ** n}}$.`, 'Subtract from 1.'],
          steps: [{ h: 'None', d: `$P(\\text{all tails}) = \\dfrac{1}{${2 ** n}}$` }, { h: 'Complement', d: `$1 - \\dfrac{1}{${2 ** n}} = ${f.latex()}$` }]
        });
      }
      const k = ri(rng, 2, 3), f = new Frac(6 ** k - 5 ** k, 6 ** k);
      return F(`A fair die is rolled $${k}$ times. Find the probability of rolling **at least one six**, as a fraction in simplest form.`, f, {
        input: 'e.g. 11/36',
        traps: [T(k / 6, 'Adding $\\tfrac16$ each time double counts outcomes: use the complement.'), T(5 ** k / 6 ** k, 'That is the probability of *no* sixes; subtract it from 1.')],
        hints: ['Use the complement.', `$P(\\text{no six}) = \\left(\\dfrac56\\right)^{${k}} = \\dfrac{${5 ** k}}{${6 ** k}}$.`, 'Subtract from 1.'],
        steps: [{ h: 'No sixes', d: `$\\dfrac{${5 ** k}}{${6 ** k}}$` }, { h: 'Complement', d: `$1 - \\dfrac{${5 ** k}}{${6 ** k}} = ${f.latex()}$` }]
      });
    }
  },
  { // expected count
    make: (rng) => {
      const d = rc(rng, [4, 5, 8, 10]), nn = ri(rng, 1, d - 1);
      const f = new Frac(nn, d), trials = f.d * ri(rng, 4, 20), exp = trials * f.n / f.d;
      const who = rc(rng, NAMES);
      return N(`${who} scores a goal from a set shot with probability $${f.latex()}$. How many goals would ${who} be expected to score from $${trials}$ shots?`, exp, {
        traps: [T(trials * f.d / f.n, 'Expected number $=$ probability $\\times$ number of trials (multiply, not divide).'), T(trials - exp, 'That is the expected number of *misses*.')],
        hints: ['Expected number $=$ probability $\\times$ trials.', `$${f.latex()}\\times ${trials}$.`, 'Divide the number of shots first, then multiply.'],
        steps: [{ h: 'Multiply', d: `$${f.latex()}\\times ${trials} = ${exp}$` }]
      });
    }
  },
  { // Venn
    make: (rng) => {
      for (let i = 0; i < 300; i++) {
        const T_ = ri(rng, 30, 60), A = ri(rng, 8, 25), B = ri(rng, 8, 25), both = ri(rng, 2, Math.min(A, B) - 1);
        const either = A + B - both;
        if (either > T_ - 3) continue;
        const neither = rng() < 0.5;
        const [a, b] = rc(rng, [['netball', 'cricket'], ['swimming', 'tennis'], ['surf life saving', 'AFL']]);
        const f = new Frac(neither ? T_ - either : either, T_);
        return F(`Of $${T_}$ students, $${A}$ play ${a}, $${B}$ play ${b} and $${both}$ play both. One student is chosen at random. Find the probability they play ${neither ? '**neither** sport' : '**at least one** of the two sports'}, as a fraction in simplest form.`, f, {
          traps: [T((A + B) / T_, 'Students who play both have been counted twice: subtract the overlap.'), T(neither ? either / T_ : (T_ - either) / T_, neither ? 'That is the probability of playing at least one sport.' : 'That is the probability of playing neither.')],
          hints: ['Students in both groups are counted twice if you add.', `At least one: $${A} + ${B} - ${both} = ${either}$.`, neither ? `Neither: $${T_} - ${either}$.` : `Probability: $\\dfrac{${either}}{${T_}}$.`],
          steps: [{ h: 'At least one', d: `$${A} + ${B} - ${both} = ${either}$` }, { h: 'Probability', d: neither ? `$\\dfrac{${T_} - ${either}}{${T_}} = ${f.latex()}$` : `$\\dfrac{${either}}{${T_}} = ${f.latex()}$` }]
        });
      }
      return probability[1].make(rng);
    }
  },
  { // two-way table conditional
    diffs: [3, 4],
    make: (rng) => {
      const a = ri(rng, 4, 20), b = ri(rng, 4, 20), c = ri(rng, 4, 20), d = ri(rng, 4, 20);
      const given = rng() < 0.5;
      return F(`In Year 9, $${a}$ boys and $${b}$ girls walk to school, and $${c}$ boys and $${d}$ girls catch the bus. A student chosen from those who ${given ? 'catch the bus' : 'walk'} is picked at random. What is the probability that the student is a **boy**?`, given ? new Frac(c, c + d) : new Frac(a, a + b), {
        traps: [T(given ? c / (a + b + c + d) : a / (a + b + c + d), 'Only the students in the stated group count: use that group as the total.'), T((a + c) / (a + b + c + d), 'That is the chance of a boy in the whole year; use only the stated group.')],
        hints: ['Restrict to the group named in the question.', given ? `Bus: $${c} + ${d} = ${c + d}$ students.` : `Walk: $${a} + ${b} = ${a + b}$ students.`, 'Boys in that group $\\div$ students in that group.'],
        steps: [{ h: 'The group', d: given ? `$${c + d}$ students catch the bus` : `$${a + b}$ students walk` }, { h: 'Probability', d: given ? `$\\dfrac{${c}}{${c + d}} = ${new Frac(c, c + d).latex()}$` : `$\\dfrac{${a}}{${a + b}} = ${new Frac(a, a + b).latex()}$` }]
      });
    }
  },
  { // with replacement
    make: (rng) => {
      const r = ri(rng, 2, 9), b = ri(rng, 2, 9), t = r + b, same = rng() < 0.5;
      const f = new Frac(same ? r * r + b * b : 2 * r * b, t * t);
      const wo = same ? new Frac(r * (r - 1) + b * (b - 1), t * (t - 1)) : new Frac(2 * r * b, t * (t - 1));
      return F(`A bag has $${r}$ red and $${b}$ blue counters. A counter is drawn, **replaced**, and a second is drawn. Find the probability that the two counters are ${same ? 'the **same** colour' : '**different** colours'}, as a fraction in simplest form.`, f, {
        traps: [T(wo.value, 'The counter is replaced, so the bag is the same for both draws (denominator $' + t + '$ each time).'), T(same ? (r * r) / (t * t) : r * b / (t * t), same ? 'The same colour can be red-red or blue-blue.' : 'Different colours can happen in two orders.')],
        hints: ['Each draw has $' + t + '$ counters.', same ? 'Add P(red, red) and P(blue, blue).' : 'Add P(red, blue) and P(blue, red).', 'Multiply along each branch.'],
        steps: [{ h: 'Branches', d: same ? `$\\dfrac{${r}}{${t}}\\times\\dfrac{${r}}{${t}} + \\dfrac{${b}}{${t}}\\times\\dfrac{${b}}{${t}}$` : `$2\\times\\dfrac{${r}}{${t}}\\times\\dfrac{${b}}{${t}}$` }, { h: 'Simplify', d: `$\\dfrac{${same ? r * r + b * b : 2 * r * b}}{${t * t}} = ${f.latex()}$` }]
      });
    }
  },
  { // find the number of blue counters from P(red)
    make: (rng) => {
      for (let i = 0; i < 200; i++) {
        const T_ = ri(rng, 8, 40), r = ri(rng, 2, T_ - 2), f = new Frac(r, T_);
        if (f.d === T_ && false) continue;
        return N(`A bag contains $${r}$ red counters and some blue counters. The probability of drawing a red counter is $${f.latex()}$. How many blue counters are in the bag?`, T_ - r, {
          traps: [T(T_, 'That is the total number of counters; subtract the red ones.'), T(f.d - f.n, 'The fraction is simplified, so these numbers may not be the actual counts.')],
          hints: [`$P(\\text{red}) = \\dfrac{${r}}{\\text{total}} = ${f.latex()}$.`, 'Find the total number of counters.', 'Subtract the red counters.'],
          steps: [{ h: 'Total', d: `$\\text{total} = ${r}\\div ${f.latex()} = ${T_}$` }, { h: 'Blue', d: `$${T_} - ${r} = ${T_ - r}$` }]
        });
      }
      return probability[1].make(rng);
    }
  },
  { // MCQ: expression for both red without replacement
    diffs: [3, 4],
    make: (rng) => {
      const r = ri(rng, 3, 9), b = ri(rng, 2, 9), t = r + b;
      const fr = (n, d) => `\\dfrac{${n}}{${d}}`;
      return M(rng, `A bag has $${r}$ red and $${b}$ blue counters. Two counters are drawn **without replacement**. Which calculation gives $P(\\text{both red})$?`,
        `$${fr(r, t)}\\times ${fr(r - 1, t - 1)}$`, [
          { text: `$${fr(r, t)}\\times ${fr(r, t)}$`, why: 'Without replacement the second draw has one fewer red counter and one fewer counter in total.' },
          { text: `$${fr(r, t)} + ${fr(r - 1, t - 1)}$`, why: 'For "both" events you multiply along the branch; adding is for "or".' },
          { text: `$${fr(r, t)}\\times ${fr(r - 1, t)}$`, why: 'The total also drops by one on the second draw.' }
        ],
        ['The first counter is not put back.', 'After one red is taken, how many red and how many in total?', 'Multiply the two branch probabilities.'],
        [{ h: 'First red', d: `$${fr(r, t)}$` }, { h: 'Second red', d: `$${fr(r - 1, t - 1)}$` }, { h: 'Both', d: `$${fr(r, t)}\\times ${fr(r - 1, t - 1)}$` }]);
    }
  },
  { // cards: A or B with overlap
    make: (rng) => {
      for (let i = 0; i < 100; i++) {
        const [x, y] = rs(rng, CARD_EVENTS).slice(0, 2);
        const nA = DECK.filter(x[1]).length, nB = DECK.filter(y[1]).length, both = DECK.filter(c => x[1](c) && y[1](c)).length;
        if (both === 0 || DECK.filter(c => x[1](c) || y[1](c)).length === nA || DECK.filter(c => x[1](c) || y[1](c)).length === nB) continue;
        const u = nA + nB - both, f = new Frac(u, 52);
        return F(`A card is drawn at random from a standard pack of 52 cards. Find the probability that it is ${x[0]} **or** ${y[0]}, as a fraction in simplest form.`, f, {
          input: 'e.g. 4/13',
          traps: [T((nA + nB) / 52, 'Cards that are both have been counted twice: subtract the overlap.'), T(nA * nB / 2704, 'For "or" you add the probabilities; multiplying is for "and" on separate draws.')],
          hints: ['Use $P(A\\text{ or }B) = P(A) + P(B) - P(A\\text{ and }B)$.', `${nA} are ${x[0].replace(/^an? /, '')}, ${nB} are ${y[0].replace(/^an? /, '')}, ${both} are both.`, `$${nA} + ${nB} - ${both}$ cards.`],
          steps: [{ h: 'Count', d: `$${nA} + ${nB} - ${both} = ${u}$ cards` }, { h: 'Probability', d: `$\\dfrac{${u}}{52} = ${f.latex()}$` }]
        });
      }
      return probability[0].make(rng);
    }
  }
];

// ── presentation tidy: no bare coefficient 1 / exponent 1, singular units ────
const SING = { seconds: 'second', minutes: 'minute', hours: 'hour', days: 'day', weeks: 'week', years: 'year', metres: 'metre', litres: 'litre', kilometres: 'kilometre' };
export function tidyText(s) {
  return s
    .replace(/(\$1\$|(?<![\d.\w{^_\\])1)(\s+)(seconds|minutes|hours|days|weeks|years|metres|litres|kilometres)\b/g, (m, a, sp, u) => `${a}${sp}${SING[u]}`)
    .replace(/\bA open/g, 'An open')
    .replace(/(?<![\d.A-Za-z{^_\\])1([xtkbyn])(?![A-Za-z])/g, '$1')
    .replace(/([A-Za-z)])\^\{1\}(?!\d)/g, '$1')
    .replace(/([A-Za-z])\^1(?![\d{])/g, '$1')
    .replace(/\(([a-z])\)\^\\circ/g, '$1^\\circ');
}
const SKIP = new Set(['answer', 'figure', 'expr', 'inputHint', 'correctIndex']);
function tidyDeep(v) {
  if (typeof v === 'string') return tidyText(v);
  if (Array.isArray(v)) return v.map(tidyDeep);
  if (v && typeof v === 'object') {
    const o = {};
    for (const k of Object.keys(v)) o[k] = SKIP.has(k) ? v[k] : tidyDeep(v[k]);
    return o;
  }
  return v;
}
const tidyForms = list => list.map(f => ({ ...f, make: (rng, ...rest) => tidyDeep(f.make(rng, ...rest)) }));

const rawForms = {
  'y9-nonlinear-a': nonlinearA,
  'y9-algebra': algebra,
  'y9-simint': simint,
  'y9-rate-change': rateChange,
  'y9-trig': trig,
  'y9-indices-sci': indicesSci,
  'y9-data-inquiry': dataInquiry,
  'y9-data': data,
  'y9-probability': probability
};

export const forms = Object.fromEntries(Object.entries(rawForms).map(([k, v]) => [k, tidyForms(v)]));
