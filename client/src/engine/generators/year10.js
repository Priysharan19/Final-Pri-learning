// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Year 10 generators
// ─────────────────────────────────────────────────────────────────────────────
import { ri, rc, rs, nz, distinct, gcd, Frac, mcq, term, sgn, moneyPlain, r1, r2, r3, rad, surdSimp, surdLatex, surdStr, NAMES } from '../qhelpers.js';
import { figRightTriangle, figBearing, figParabola } from '../figures.js';

// ── Curves and scatterplots ──────────────────────────────────────────────────
// engine/figures.js draws a parabola but neither an exponential/hyperbolic
// curve nor a scatterplot. Both builders below stay inside the tag and
// attribute vocabulary the figure sanitiser allows — svg, g, line, path,
// circle, text — so what they emit survives the round trip unchanged.

const PLOT_ACCENT = '#3987e5';
const PLOT_WARN = '#f59e0b';
const PN = v => Math.round(v * 100) / 100;
const plotText = (x, y, s, size = 12) =>
  `<text x="${PN(x)}" y="${PN(y)}" fill="currentColor" stroke="none" font-size="${size}" font-family="Inter, system-ui, sans-serif" text-anchor="middle">${s}</text>`;

/** y = f(x) on signed axes, with optional dashed asymptotes and one marked point. */
function figCurve({ f, hAsym, vAsym, mark, span = 6, high = 5 }) {
  const W = 330, H = 250;
  const X = x => W / 2 + x * (W / 2 - 22) / span;
  const Y = y => H / 2 - y * (H / 2 - 24) / high;
  let inner = `<line x1="14" y1="${H / 2}" x2="${W - 14}" y2="${H / 2}"/><line x1="${W / 2}" y1="14" x2="${W / 2}" y2="${H - 14}"/>`;
  inner += `<path d="M ${W - 20} ${H / 2 - 4} l 8 4 l -8 4"/><path d="M ${W / 2 - 4} 20 l 4 -8 l 4 8"/>`;
  for (let t = -span + 1; t <= span - 1; t++) {
    if (!t) continue;
    inner += `<line x1="${PN(X(t))}" y1="${H / 2 - 4}" x2="${PN(X(t))}" y2="${H / 2 + 4}"/>`;
    if (t % 2 === 0) inner += plotText(X(t), H / 2 + 18, t, 11);
  }
  for (let t = -high + 1; t <= high - 1; t++) {
    if (!t) continue;
    inner += `<line x1="${W / 2 - 4}" y1="${PN(Y(t))}" x2="${W / 2 + 4}" y2="${PN(Y(t))}"/>`;
    if (t % 2 === 0) inner += plotText(W / 2 - 16, Y(t) + 4, t, 11);
  }
  if (hAsym != null) inner += `<line x1="16" y1="${PN(Y(hAsym))}" x2="${W - 16}" y2="${PN(Y(hAsym))}" stroke="${PLOT_WARN}" stroke-dasharray="5 4"/>`;
  if (vAsym != null) inner += `<line x1="${PN(X(vAsym))}" y1="16" x2="${PN(X(vAsym))}" y2="${H - 16}" stroke="${PLOT_WARN}" stroke-dasharray="5 4"/>`;
  // Sampled in runs: a run of one point would draw as a round dot and read as
  // a marked coordinate, so only runs of two or more become a subpath.
  const runs = [];
  let run = [];
  for (let px = -span; px <= span + 1e-9; px += 0.06) {
    const py = f(px);
    if (!Number.isFinite(py) || py < -high || py > high) { if (run.length > 1) runs.push(run); run = []; continue; }
    run.push(`${PN(X(px))} ${PN(Y(py))}`);
  }
  if (run.length > 1) runs.push(run);
  const d = runs.map(r => `M ${r[0]} ` + r.slice(1).map(pt => `L ${pt}`).join(' ')).join(' ');
  if (d) inner += `<path d="${d}" stroke="${PLOT_ACCENT}" stroke-width="2.2"/>`;
  if (mark) {
    inner += `<circle cx="${PN(X(mark[0]))}" cy="${PN(Y(mark[1]))}" r="4" fill="${PLOT_ACCENT}" stroke="none"/>`;
    const lx = Math.min(W - 34, Math.max(36, X(mark[0]) + (mark[0] < 0 ? -32 : 32)));
    inner += plotText(lx, Y(mark[1]) - 10, `(${mark[0]}, ${mark[1]})`, 11.5);
  }
  inner += plotText(W - 12, H / 2 + 18, 'x', 12.5) + plotText(W / 2 + 14, 22, 'y', 12.5);
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Curve on coordinate axes" style="max-width:330px;width:100%;height:auto;display:block">` +
    `<g fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round">${inner}</g></svg>`;
}

/** Scatterplot in the first quadrant; `line` draws a line of best fit. */
function figScatter({ pts, xMax, yMax, xLabel, yLabel, line }) {
  const W = 360, H = 260, L = 46, B = 42;
  const X = x => L + x / xMax * (W - L - 18);
  const Y = y => H - B - y / yMax * (H - B - 22);
  let inner = `<line x1="${L}" y1="${H - B}" x2="${W - 12}" y2="${H - B}"/><line x1="${L}" y1="16" x2="${L}" y2="${H - B}"/>`;
  const xStep = Math.max(1, Math.round(xMax / 5)), yStep = Math.max(1, Math.round(yMax / 5));
  for (let t = xStep; t <= xMax; t += xStep) {
    inner += `<line x1="${PN(X(t))}" y1="${H - B}" x2="${PN(X(t))}" y2="${H - B + 5}"/>` + plotText(X(t), H - B + 19, t, 11);
  }
  for (let t = yStep; t <= yMax; t += yStep) {
    inner += `<line x1="${L - 5}" y1="${PN(Y(t))}" x2="${L}" y2="${PN(Y(t))}"/>` + plotText(L - 18, Y(t) + 4, t, 11);
  }
  if (line) {
    inner += `<line x1="${PN(X(line[0][0]))}" y1="${PN(Y(line[0][1]))}" x2="${PN(X(line[1][0]))}" y2="${PN(Y(line[1][1]))}" stroke="${PLOT_WARN}" stroke-width="1.8"/>`;
  }
  for (const [px, py] of pts) inner += `<circle cx="${PN(X(px))}" cy="${PN(Y(py))}" r="4" fill="${PLOT_ACCENT}" stroke="none"/>`;
  inner += plotText((L + W) / 2, H - 8, xLabel, 12);
  inner += plotText(L + 46, 12, yLabel, 11.5);
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Scatterplot" style="max-width:360px;width:100%;height:auto;display:block">` +
    `<g fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round">${inner}</g></svg>`;
}

export const year10 = {

  // ── Quadratic equations ──────────────────────────────────────────────────
  'y10-quadratics': (rng, diff) => {
    if (diff === 1) {
      const p = nz(rng, -8, 8), q = nz(rng, -8, 8);
      return {
        prompt: `Solve $(x ${sgn(-p)})(x ${sgn(-q)}) = 0$.`,
        answerType: p === q ? 'numeric' : 'set',
        answer: p === q ? { value: p } : { values: [p, q] },
        inputHint: p === q ? 'x =' : 'e.g. x = 2 or x = -5',
        traps: [{ value: p === q ? -p : null, why: 'Null factor law: each bracket equals zero, so flip the sign of the number in the bracket.' }].filter(t => t.value !== null && t.value !== undefined),
        hints: ['If two things multiply to zero, one of them must be zero.', `Set each bracket to zero: $x ${sgn(-p)} = 0$ or $x ${sgn(-q)} = 0$.`, `Solve each little equation.`],
        steps: [
          { h: 'Null factor law', d: `$x ${sgn(-p)} = 0$ or $x ${sgn(-q)} = 0$` },
          { h: 'Solve each', d: p === q ? `$x = ${p}$ (a repeated root)` : `$x = ${p}$ or $x = ${q}$` }
        ],
        stepcheck: { kind: 'equation', variable: 'x', solutions: p === q ? [p] : [p, q] }
      };
    }
    if (diff === 2) {
      const p = nz(rng, -7, 7), q = nz(rng, -7, 7);
      const b = p + q, c = p * q;
      return {
        prompt: `Factorise $x^2 ${b === 0 ? '' : `${sgn(b)}x`} ${sgn(c)}$.`.replace(/\s+/g, ' '),
        answerType: 'expression', answer: { expr: `(x + ${p})(x + ${q})` },
        inputHint: 'e.g. (x + 3)(x - 2)',
        traps: [{ expr: `(x + ${b})(x + ${c === 0 ? 1 : Math.sign(c)})`, why: 'Look for two numbers that *multiply* to the constant and *add* to the x-coefficient.' }],
        hints: [`Find two numbers with product $${c}$ and sum $${b}$.`, `Try factor pairs of ${c}.`, `${p} and ${q} work: $${p} \\times ${q} = ${c}$, $${p} + ${q} = ${b}$.`],
        steps: [
          { h: 'Product and sum', d: `Need product $= ${c}$ and sum $= ${b}$` },
          { h: 'The pair', d: `$${p}$ and $${q}$` },
          { h: 'Factorised form', d: `$(x ${sgn(p)})(x ${sgn(q)})$` },
          { h: 'Check', d: `Expanding returns $x^2 ${sgn(b)}x ${sgn(c)}$ ✓`.replace('+ 0x ', '') }
        ]
      };
    }
    if (diff === 3) {
      const p = nz(rng, -8, 8);
      let q = nz(rng, -8, 8);
      if (q === p) q = p > 0 ? p - (p === 1 ? -1 : 1) : p + 1;
      const b = -(p + q), c = p * q;
      return {
        prompt: `Solve $x^2 ${b === 0 ? '' : `${sgn(b)}x`} ${sgn(c)} = 0$ by factorising.`.replace(/\s+/g, ' '),
        answerType: 'set', answer: { values: [p, q] },
        inputHint: 'e.g. x = 2 or x = -5',
        stepcheck: { kind: 'equation', variable: 'x', solutions: [p, q] },
        traps: [{ value: -p, why: 'After factorising, the roots have the *opposite* sign to the numbers in the brackets.' }],
        hints: [`Factorise first: product $${c}$, sum $${b}$.`, `$(x ${sgn(-p)})(x ${sgn(-q)}) = 0$.`, 'Now apply the null factor law.'],
        steps: [
          { h: 'Factorise', d: `$x^2 ${sgn(b)}x ${sgn(c)} = (x ${sgn(-p)})(x ${sgn(-q)})$`.replace('+ 0x ', '') },
          { h: 'Null factor law', d: `$x ${sgn(-p)} = 0$ or $x ${sgn(-q)} = 0$` },
          { h: 'Solutions', d: `$x = ${p}$ or $x = ${q}$` }
        ]
      };
    }
    const a = rc(rng, [1, 1, 2]), bb = nz(rng, -6, 6), cc = nz(rng, -8, 8);
    const disc = bb * bb - 4 * a * cc;
    if (disc <= 0) return year10['y10-quadratics'](rng, diff); // ensure two real roots
    const sq = Math.sqrt(disc);
    const x1 = (-bb + sq) / (2 * a), x2 = (-bb - sq) / (2 * a);
    return {
      prompt: `Use the quadratic formula to solve $${a === 1 ? '' : a}x^2 ${sgn(bb)}x ${sgn(cc)} = 0$. Give both solutions, correct to 2 decimal places if needed.`,
      answerType: 'set', answer: { values: [r2(x1), r2(x2)], tol: 0.011 },
      inputHint: 'e.g. x = 0.61 or x = -3.61',
      stepcheck: { kind: 'equation', variable: 'x', solutions: [x1, x2] },
      traps: [{ value: r2((-bb + sq) / 2), why: `Don't forget to divide by $2a = ${2 * a}$ — the whole of $-b \\pm \\sqrt{\\Delta}$ sits over it.`, tol: 0.011 }],
      hints: ['$x = \\dfrac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}$.', `Here $a = ${a}$, $b = ${bb}$, $c = ${cc}$; find the discriminant first.`, `$\\Delta = ${bb}^2 - 4(${a})(${cc}) = ${disc}$; $\\sqrt{\\Delta} \\approx ${r3(sq)}$.`],
      steps: [
        { h: 'Identify a, b, c', d: `$a = ${a},\\ b = ${bb},\\ c = ${cc}$` },
        { h: 'Discriminant', d: `$\\Delta = b^2 - 4ac = ${bb * bb} - ${4 * a * cc} = ${disc}$` },
        { h: 'Apply the formula', d: `$x = \\dfrac{${-bb} \\pm \\sqrt{${disc}}}{${2 * a}}$` },
        { h: 'Two solutions', d: `$x \\approx ${r2(x1)}$ or $x \\approx ${r2(x2)}$` }
      ]
    };
  },

  // ── Parabolas & non-linear graphs ────────────────────────────────────────
  'y10-nonlinear': (rng, diff) => {
    if (diff === 1) {
      // Two shapes: read the vertex from the equation, or from a drawn graph
      if (rc(rng, [true, false])) {
        const h = nz(rng, -3, 3), k = nz(rng, -4, 4);
        const aa = rc(rng, [1, -1]);
        return {
          prompt: `The graph of a parabola is shown on 1-unit axes. State the coordinates of its **vertex**.`,
          figure: figParabola({ a: aa, h, k, showVertex: false }),
          answerType: 'point', answer: { x: h, y: k },
          inputHint: 'e.g. (3, -2)',
          traps: [{ why: 'Read the turning point straight off the graph — across first (x), then up or down (y).' }],
          hints: ['The vertex is the turning point of the curve.', `It sits ${aa > 0 ? 'at the bottom of the smile' : 'at the top of the frown'}.`, `Count units from the origin along each axis.`],
          steps: [
            { h: 'Locate the turning point', d: aa > 0 ? 'The lowest point of the parabola' : 'The highest point of the parabola' },
            { h: 'Read the coordinates', d: `$(${h}, ${k})$` }
          ]
        };
      }
      const h = nz(rng, -6, 6), k = nz(rng, -8, 8);
      return {
        prompt: `State the vertex of the parabola $y = (x ${sgn(-h)})^2 ${sgn(k)}$.`,
        answerType: 'point', answer: { x: h, y: k },
        inputHint: 'e.g. (3, -2)',
        traps: [{ why: 'In $y = (x - h)^2 + k$ the vertex is $(h, k)$ — the sign inside the bracket flips.' }],
        hints: ['Compare with the vertex form $y = (x - h)^2 + k$.', `Inside the bracket: $x ${sgn(-h)}$ means $h = ${h}$ (sign flips).`, `$k = ${k}$ is read directly.`],
        steps: [
          { h: 'Vertex form', d: `$y = (x - h)^2 + k$ has vertex $(h, k)$` },
          { h: 'Match', d: `$x ${sgn(-h)} = x - (${h})$, so $h = ${h}$; and $k = ${k}$` },
          { h: 'Vertex', d: `$(${h}, ${k})$` }
        ]
      };
    }
    if (diff === 2) {
      const a = nz(rng, -3, 3), c = nz(rng, -8, 8);
      const b = nz(rng, -6, 6);
      const m = mcq(rng, `y-intercept $${c}$; opens ${a > 0 ? 'upward' : 'downward'}`, [
        { text: `y-intercept $${c}$; opens ${a > 0 ? 'downward' : 'upward'}`, why: `The sign of the $x^2$ coefficient decides the direction: $a = ${a}$ ${a > 0 ? '> 0 → a smile (upward)' : '< 0 → a frown (downward)'}.` },
        { text: `y-intercept $${b}$; opens ${a > 0 ? 'upward' : 'downward'}`, why: 'The y-intercept is the constant term (set x = 0).' },
        { text: `y-intercept $${-c}$; opens ${a > 0 ? 'downward' : 'upward'}` }
      ]);
      return {
        prompt: `For the parabola $y = ${a === 1 ? '' : a === -1 ? '-' : a}x^2 ${sgn(b)}x ${sgn(c)}$, identify the y-intercept and whether it opens upward or downward.`,
        answerType: 'mcq', answer: { correctIndex: m.correctIndex, optionTraps: m.optionTraps }, mcqOptions: m.options,
        hints: ['Set $x = 0$ for the y-intercept.', `At $x = 0$: $y = ${c}$.`, `The $x^2$ coefficient is ${a} — ${a > 0 ? 'positive, so it opens up' : 'negative, so it opens down'}.`],
        steps: [
          { h: 'y-intercept', d: `$y(0) = ${c}$` },
          { h: 'Direction', d: `$a = ${a}$ is ${a > 0 ? 'positive → opens upward' : 'negative → opens downward'}` }
        ]
      };
    }
    if (diff === 3) {
      const p = nz(rng, -7, 7);
      let q = nz(rng, -7, 7);
      if (q === p) q = -p || 3;
      return {
        prompt: `Find the x-intercepts of the parabola $y = (x ${sgn(-p)})(x ${sgn(-q)})$.`,
        answerType: 'set', answer: { values: [p, q] },
        inputHint: 'e.g. x = 1 or x = -4',
        traps: [{ value: -p, why: 'x-intercepts occur where each factor is zero — flip the sign of the numbers in the brackets.' }],
        hints: ['x-intercepts happen where $y = 0$.', 'Use the null factor law on the two brackets.', `$x = ${p}$ or $x = ${q}$.`],
        steps: [
          { h: 'Set y = 0', d: `$(x ${sgn(-p)})(x ${sgn(-q)}) = 0$` },
          { h: 'Null factor law', d: `$x = ${p}$ or $x = ${q}$` },
          { h: 'Bonus', d: `The axis of symmetry is midway: $x = ${(p + q) / 2}$` }
        ]
      };
    }
    // Reading exponential and hyperbolic graphs: the dashed lines are the
    // asymptotes, and the marked point is what pins the remaining parameter.
    if (rc(rng, [true, false])) {
      const h = ri(rng, -3, 3), c = ri(rng, -3, 3);
      const k = nz(rng, -6, 6);
      const t = rc(rng, [1, -1, 2, -2]);
      if (k % t !== 0) return year10['y10-nonlinear'](rng, diff);
      const px = h + t, py = k / t + c;
      if (Math.abs(px) > 5 || Math.abs(py) > 4 || (px === 0 && py === 0)) return year10['y10-nonlinear'](rng, diff);
      const figure = figCurve({ f: x => k / (x - h) + c, hAsym: c, vAsym: h, mark: [px, py] });
      const ask = ri(rng, 0, 2);
      if (ask === 0) {
        return {
          prompt: `The hyperbola shown passes through the marked point $(${px}, ${py})$. Its asymptotes are drawn as dashed lines. State the equation of the **vertical asymptote**.`,
          figure,
          answerType: 'numeric', answer: { value: h }, answerPrefix: 'x =',
          traps: [{ value: c, why: 'That is the *horizontal* asymptote — the dashed line the curve flattens out along. A vertical asymptote is the value of $x$ the curve never reaches.' }].filter(t => t.value !== h),
          hints: ['A vertical asymptote is the $x$-value the curve rushes away from without ever touching.',
            'Find the dashed line that runs straight up and down.',
            `It crosses the $x$-axis at $x = ${h}$.`],
          steps: [
            { h: 'Find the upright dashed line', d: `It sits at $x = ${h}$` },
            { h: 'Write the equation', d: `$x = ${h}$` }
          ]
        };
      }
      if (ask === 1) {
        return {
          prompt: `The hyperbola shown passes through the marked point $(${px}, ${py})$. State the equation of the **horizontal asymptote** — the value $y$ approaches as $x$ grows large.`,
          figure,
          answerType: 'numeric', answer: { value: c }, answerPrefix: 'y =',
          traps: [{ value: h, why: 'That is the *vertical* asymptote. The horizontal one is the level the curve flattens towards on the far left and far right.' }].filter(t => t.value !== c),
          hints: ['Follow the right-hand branch out to the right — what height does it settle at?',
            'That level is the horizontal dashed line.',
            `It crosses the $y$-axis at $y = ${c}$.`],
          steps: [
            { h: 'Follow the curve outwards', d: `Both branches flatten towards the same level` },
            { h: 'Read the level', d: `$y = ${c}$` }
          ]
        };
      }
      return {
        prompt: `The hyperbola shown has equation $y = \\dfrac{k}{x - h} + c$. From the graph its asymptotes are $x = ${h}$ and $y = ${c}$, and it passes through the marked point $(${px}, ${py})$. Find $k$.`,
        figure,
        answerType: 'numeric', answer: { value: k },
        traps: [
          { value: py, why: `$k$ is not the $y$-value of the point. Substitute the point into $y = \\dfrac{k}{x - ${h}} ${sgn(c)}$ and solve.` },
          { value: -k, why: 'Check the sign of $x - h$ at the marked point — a point to the left of the vertical asymptote makes that bracket negative.' }
        ].filter(t => t.value !== k),
        hints: [`Substitute $x = ${px}$ and $y = ${py}$ into $y = \\dfrac{k}{x - ${h}} ${sgn(c)}$.`,
          `First move the $${c}$ across: $${py} ${sgn(-c)} = \\dfrac{k}{${px} ${sgn(-h)}}$.`,
          `That is $${py - c} = \\dfrac{k}{${t}}$.`],
        steps: [
          { h: 'Substitute the point', d: `$${py} = \\dfrac{k}{${px} ${sgn(-h)}} ${sgn(c)}$` },
          { h: 'Subtract the horizontal asymptote', d: `$${py} ${sgn(-c)} = ${py - c} = \\dfrac{k}{${t}}$` },
          { h: 'Multiply through', d: `$k = ${py - c} \\times ${t < 0 ? `(${t})` : t} = ${k}$` }
        ]
      };
    }
    const a = ri(rng, 1, 4), b = rc(rng, [2, 3]), c = nz(rng, -4, 3);
    const y0 = a + c, y1 = a * b + c;
    if (Math.abs(y1) > 4 || Math.abs(y0) > 4) return year10['y10-nonlinear'](rng, diff);
    const figure = figCurve({ f: x => a * Math.pow(b, x) + c, hAsym: c, mark: [1, y1] });
    const ask = ri(rng, 0, 2);
    if (ask === 0) {
      return {
        prompt: `The exponential curve shown passes through the marked point $(1, ${y1})$. State the equation of its **horizontal asymptote** — the value $y$ approaches as $x \\to -\\infty$.`,
        figure,
        answerType: 'numeric', answer: { value: c }, answerPrefix: 'y =',
        traps: [{ value: y0, why: `$${y0}$ is where the curve crosses the $y$-axis. The asymptote is the level it flattens towards further left, which it never quite reaches.` }].filter(t => t.value !== c),
        hints: ['Follow the curve to the **left** — it flattens out but never quite lands.',
          'That level is drawn as the dashed line.',
          `It sits at $y = ${c}$.`],
        steps: [
          { h: 'Follow the curve leftwards', d: 'The curve flattens towards a fixed level' },
          { h: 'Read the dashed line', d: `$y = ${c}$` }
        ]
      };
    }
    if (ask === 1) {
      return {
        prompt: `The exponential curve shown has equation $y = a \\times b^{x} ${sgn(c)}$ and passes through the marked point $(1, ${y1})$. State the coordinates of its **$y$-intercept**.`,
        figure,
        answerType: 'point', answer: { x: 0, y: y0 },
        inputHint: 'e.g. (0, 5)',
        traps: [{ why: `The $y$-intercept has $x = 0$. Since $b^{0} = 1$, that puts $y = a ${sgn(c)}$ — read it straight off where the curve crosses the vertical axis.` }],
        hints: ['The $y$-intercept is where the curve crosses the vertical axis, so $x = 0$.',
          `$b^{0} = 1$ for any base, so $y = a \\times 1 ${sgn(c)}$.`,
          `Read the crossing height off the graph: $y = ${y0}$.`],
        steps: [
          { h: 'Set x = 0', d: `$y = a \\times b^{0} ${sgn(c)} = a ${sgn(c)}$` },
          { h: 'Read it off the graph', d: `The curve crosses the $y$-axis at $y = ${y0}$` },
          { h: 'Write as a point', d: `$(0, ${y0})$` }
        ]
      };
    }
    return {
      prompt: `The exponential curve shown has equation $y = a \\times b^{x} + c$. From the graph its horizontal asymptote is $y = ${c}$, it crosses the $y$-axis at $(0, ${y0})$, and it passes through $(1, ${y1})$. Find the **base $b$**.`,
      figure,
      answerType: 'numeric', answer: { value: b },
      traps: [
        { value: y1 - y0, why: 'An exponential curve **multiplies** by $b$ for each step of $1$ in $x$; the difference between the two heights is not the base.' },
        { value: r2(y1 / y0), why: `The $${c}$ has to be stripped off both heights first — the multiplying happens to the $a b^{x}$ part, not to the shift.` }
      ].filter(t => t.value !== b),
      hints: [`Subtract the asymptote from both heights: $${y0} ${sgn(-c)} = ${y0 - c}$ and $${y1} ${sgn(-c)} = ${y1 - c}$.`,
        `Those are $a$ and $ab$, so $a = ${y0 - c}$.`,
        `Then $b = ${y1 - c} \\div ${y0 - c}$.`],
      steps: [
        { h: 'Strip off the shift', d: `$a b^{0} = ${y0} ${sgn(-c)} = ${a}$, $\\quad a b^{1} = ${y1} ${sgn(-c)} = ${a * b}$` },
        { h: 'Divide consecutive values', d: `$\\dfrac{ab}{a} = \\dfrac{${a * b}}{${a}} = ${b}$` },
        { h: 'Base', d: `$b = ${b}$` }
      ]
    };
  },

  // ── Simultaneous equations ───────────────────────────────────────────────
  'y10-simeq': (rng, diff) => {
    const x = ri(rng, -5, 6), y = ri(rng, -5, 6);
    if (diff === 1) {
      const m = nz(rng, -3, 3), c = y - m * x;
      const a2 = ri(rng, 2, 4), b2 = ri(rng, 1, 3);
      const r2v = a2 * x + b2 * y;
      return {
        prompt: `Solve the simultaneous equations $y = ${term(m)} ${sgn(c)}$ and $${a2}x + ${b2}y = ${r2v}$ by substitution. Give your answer as a point $(x, y)$.`,
        answerType: 'point', answer: { x, y },
        inputHint: 'e.g. (2, -1)',
        traps: [{ why: 'Substitute the expression for y into the second equation, so only x remains.' }],
        hints: ['Replace y in the second equation with the expression from the first.', `$${a2}x + ${b2}(${term(m)} ${sgn(c)}) = ${r2v}$.`, `Expand and solve: $${a2 + b2 * m}x = ${r2v - b2 * c}$.`],
        steps: [
          { h: 'Substitute', d: `$${a2}x + ${b2}(${term(m)} ${sgn(c)}) = ${r2v}$` },
          { h: 'Expand', d: `$${a2}x + ${b2 * m}x ${sgn(b2 * c)} = ${r2v}$` },
          { h: 'Solve for x', d: `$${a2 + b2 * m}x = ${r2v - b2 * c}$, so $x = ${x}$` },
          { h: 'Back-substitute', d: `$y = ${m}(${x}) ${sgn(c)} = ${y}$ → $(${x}, ${y})$` }
        ]
      };
    }
    if (diff === 2) {
      const a1 = ri(rng, 2, 4), b1 = ri(rng, 1, 3);
      const c1 = a1 * x + b1 * y, c2v = a1 * x - b1 * y;
      return {
        prompt: `Solve by elimination: $${a1}x + ${b1}y = ${c1}$ and $${a1}x - ${b1}y = ${c2v}$. Give your answer as a point $(x, y)$.`,
        answerType: 'point', answer: { x, y },
        inputHint: 'e.g. (3, 2)',
        traps: [{ why: 'The y-terms have opposite signs — *adding* the equations eliminates y immediately.' }],
        hints: ['Look at the y terms: one is +, one is −.', `Add the equations: $${2 * a1}x = ${c1 + c2v}$.`, `Then substitute x back to find y.`],
        steps: [
          { h: 'Add the equations', d: `$${2 * a1}x = ${c1 + c2v}$, so $x = ${x}$` },
          { h: 'Substitute back', d: `$${a1}(${x}) + ${b1}y = ${c1}$` },
          { h: 'Solve for y', d: `$${b1}y = ${c1 - a1 * x}$, so $y = ${y}$ → $(${x}, ${y})$` }
        ]
      };
    }
    if (diff === 3) {
      const a1 = ri(rng, 2, 3), b1 = ri(rng, 1, 2), a2 = ri(rng, 1, 2), b2 = ri(rng, 3, 4);
      const c1 = a1 * x + b1 * y, c2v = a2 * x + b2 * y;
      const k = a1 / gcd(a1, a2), k2 = a2 / gcd(a1, a2);
      return {
        prompt: `Solve by elimination: $${a1}x + ${b1}y = ${c1}$ and $${a2}x + ${b2}y = ${c2v}$. Give your answer as a point $(x, y)$.`,
        answerType: 'point', answer: { x, y },
        inputHint: 'e.g. (-1, 4)',
        traps: [{ why: 'Scale one (or both) equations so a pair of coefficients match, then subtract.' }],
        hints: ['Multiply the equations so the x (or y) coefficients match.', `Multiply the first by ${k2} and the second by ${k}: both x-coefficients become ${a1 * k2}.`, 'Subtract to eliminate x, then solve for y.'],
        steps: [
          { h: 'Match coefficients', d: `×${k2}: $${a1 * k2}x + ${b1 * k2}y = ${c1 * k2}$; ×${k}: $${a2 * k}x + ${b2 * k}y = ${c2v * k}$` },
          { h: 'Subtract', d: `$${b1 * k2 - b2 * k}y = ${c1 * k2 - c2v * k}$` },
          { h: 'Solve for y', d: `$y = ${y}$` },
          { h: 'Back-substitute', d: `$${a1}x = ${c1} - ${b1 * y}$, so $x = ${x}$ → $(${x}, ${y})$` }
        ]
      };
    }
    const adult = ri(rng, 18, 35), child = ri(rng, 8, adult - 5);
    const nA = ri(rng, 2, 6), nC = ri(rng, 2, 7);
    const people = nA + nC, cost = nA * adult + nC * child;
    return {
      prompt: `A group of $${people}$ people pays ${moneyPlain(cost)} for cinema tickets. Adult tickets cost ${moneyPlain(adult)} and child tickets ${moneyPlain(child)}. How many **adult** tickets were bought?`,
      answerType: 'numeric', answer: { value: nA },
      traps: [{ value: nC, why: 'That’s the number of *child* tickets — the question asks for adults.' }],
      hints: [`Let $a$ = adults, $c$ = children. Write two equations.`, `$a + c = ${people}$ and $${adult}a + ${child}c = ${cost}$.`, `Substitute $c = ${people} - a$ into the money equation.`],
      steps: [
        { h: 'Define variables', d: `$a + c = ${people}$, $\\quad ${adult}a + ${child}c = ${cost}$` },
        { h: 'Substitute c', d: `$${adult}a + ${child}(${people} - a) = ${cost}$` },
        { h: 'Expand & solve', d: `$${adult - child}a = ${cost - child * people}$, so $a = ${nA}$` },
        { h: 'Check', d: `$${nA}$ adults + $${nC}$ children $= ${people}$ people, cost ${moneyPlain(cost)} ✓` }
      ]
    };
  },

  // ── Trigonometry & bearings ──────────────────────────────────────────────
  'y10-trig': (rng, diff) => {
    if (diff === 1) {
      const angle = ri(rng, 20, 60), dist = ri(rng, 15, 80);
      const h = dist * Math.tan(rad(angle));
      return {
        prompt: `From a point $${dist}$ m from the base of a building, the angle of elevation to the roof is $${angle}°$, as shown. Find the height of the building, correct to 1 decimal place.`,
        figure: figRightTriangle({ base: `${dist} m`, height: '? m', angle: `${angle}°`, anglePos: 'base' }),
        answerType: 'numeric', answer: { value: r1(h), tol: 0.07 }, answerSuffix: 'm',
        traps: [{ value: r1(dist / Math.tan(rad(angle))), why: 'Height is *opposite* the angle and the ground distance is *adjacent*: height = distance × tan θ.', tol: 0.07 }],
        hints: ['Sketch the right-angled triangle: ground = adjacent, height = opposite.', `$\\tan(${angle}°) = \\frac{h}{${dist}}$.`, `$h = ${dist} \\times \\tan(${angle}°)$.`],
        steps: [
          { h: 'Set up tan', d: `$\\tan(${angle}°) = \\dfrac{h}{${dist}}$` },
          { h: 'Rearrange', d: `$h = ${dist} \\times ${r3(Math.tan(rad(angle)))} \\approx ${r1(h)}$ m` }
        ]
      };
    }
    if (diff === 2) {
      const angle = ri(rng, 15, 45), height = ri(rng, 30, 120);
      const d = height / Math.tan(rad(angle));
      return {
        prompt: `From the top of a $${height}$ m cliff, the angle of **depression** to a boat is $${angle}°$. How far is the boat from the base of the cliff, correct to 1 decimal place? (The marked angle at the boat equals the angle of depression — alternate angles.)`,
        figure: figRightTriangle({ base: '? m', height: `${height} m (cliff)`, angle: `${angle}°`, anglePos: 'base' }),
        answerType: 'numeric', answer: { value: r1(d), tol: 0.09 }, answerSuffix: 'm',
        traps: [{ value: r1(height * Math.tan(rad(angle))), why: 'The angle of depression equals the angle of elevation from the boat — distance = height ÷ tan θ here.', tol: 0.09 }],
        hints: ['Angle of depression from the top = angle of elevation from the boat (alternate angles).', `$\\tan(${angle}°) = \\frac{${height}}{d}$.`, `$d = \\frac{${height}}{\\tan(${angle}°)}$.`],
        steps: [
          { h: 'Alternate angles', d: `The boat sees the cliff top at $${angle}°$ elevation` },
          { h: 'Set up tan', d: `$\\tan(${angle}°) = \\dfrac{${height}}{d}$` },
          { h: 'Rearrange', d: `$d = \\dfrac{${height}}{${r3(Math.tan(rad(angle)))}} \\approx ${r1(d)}$ m` }
        ]
      };
    }
    if (diff === 3) {
      const brg = rc(rng, [30, 40, 50, 60, 70, 120, 130, 140, 150]);
      const dist = ri(rng, 8, 40);
      const east = dist * Math.sin(rad(brg));
      return {
        prompt: `A yacht sails $${dist}$ km on a bearing of $${String(brg).padStart(3, '0')}°$T, as shown. How far **east** of its starting point is it, correct to 1 decimal place?`,
        figure: figBearing({ bearing: brg, dist: `${dist} km`, to: 'yacht' }),
        answerType: 'numeric', answer: { value: r1(east), tol: 0.07 }, answerSuffix: 'km',
        traps: [{ value: r1(dist * Math.cos(rad(brg))), why: 'Bearings are measured from north — the *east* displacement is $d \\sin(\\text{bearing})$.', tol: 0.09 }],
        hints: ['Draw north up; the bearing is measured clockwise from north.', 'East displacement = distance × sin(bearing).', `$${dist} \\times \\sin(${brg}°)$.`],
        steps: [
          { h: 'Resolve the displacement', d: `east $= ${dist}\\sin(${brg}°)$, north $= ${dist}\\cos(${brg}°)$` },
          { h: 'Evaluate', d: `east $= ${dist} \\times ${r3(Math.sin(rad(brg)))} \\approx ${r1(east)}$ km` }
        ]
      };
    }
    const legN = ri(rng, 5, 20), legE = ri(rng, 5, 20);
    const bearing = Math.round(Math.atan(legE / legN) * 180 / Math.PI);
    return {
      prompt: `A hiker walks $${legN}$ km due north, then $${legE}$ km due east. What is the **bearing** of the hiker from the starting point, to the nearest degree?`,
      answerType: 'numeric', answer: { value: bearing, tol: 0.51 }, answerSuffix: '°T',
      traps: [{ value: Math.round(Math.atan(legN / legE) * 180 / Math.PI), why: 'The bearing angle sits at the start point, between north and the line to the hiker: $\\tan\\theta = \\text{east}/\\text{north}$.', tol: 0.51 }],
      hints: ['Sketch the two legs; the bearing is the angle at the start, clockwise from north.', `$\\tan\\theta = \\dfrac{\\text{east}}{\\text{north}} = \\dfrac{${legE}}{${legN}}$.`, `$\\theta = \\tan^{-1}(${r3(legE / legN)})$.`],
      steps: [
        { h: 'Right-angled triangle', d: `north leg $${legN}$, east leg $${legE}$` },
        { h: 'Angle from north', d: `$\\theta = \\tan^{-1}\\left(\\dfrac{${legE}}{${legN}}\\right) = ${r1(Math.atan(legE / legN) * 180 / Math.PI)}°$` },
        { h: 'Bearing', d: `$\\approx ${String(bearing).padStart(3, '0')}°$T` }
      ]
    };
  },

  // ── Surds & fractional indices ───────────────────────────────────────────
  'y10-surds': (rng, diff) => {
    const SQUARE_FREE = [2, 3, 5, 6, 7, 10, 11, 13, 14, 15, 17, 19, 21, 22, 23, 26, 29, 30];
    if (diff === 1) {
      const k = ri(rng, 2, 6), r = rc(rng, SQUARE_FREE.filter(v => v <= 23));
      const n = k * k * r;
      return {
        prompt: `Simplify $\\sqrt{${n}}$.`,
        answerType: 'numeric', answer: { value: k * Math.sqrt(r), surdForm: { k, r } },
        inputHint: 'e.g. 2sqrt(5)',
        traps: [{ value: n / 2, why: 'Simplifying a surd means extracting *square* factors, not halving.' }],
        hints: [`Look for a square factor of ${n}.`, `$${n} = ${k * k} \\times ${r}$, and ${k * k} is a perfect square.`, `$\\sqrt{${k * k}} = ${k}$ comes out the front.`],
        steps: [
          { h: 'Split out the square factor', d: `$\\sqrt{${n}} = \\sqrt{${k * k} \\times ${r}}$` },
          { h: 'Take the root of the square', d: `$= \\sqrt{${k * k}} \\times \\sqrt{${r}} = ${k}\\sqrt{${r}}$` }
        ]
      };
    }
    if (diff === 2) {
      const a = rc(rng, [2, 3, 5, 6, 7, 10, 11, 13, 14, 15]);
      const pool = [2, 3, 5, 6, 7, 8, 10, 12, 14, 15, 18, 20, 21, 22, 24, 27, 28, 30]
        .filter(x => surdSimp(x * a).k > 1 && surdSimp(x * a).r > 1);
      const b = rc(rng, pool.length ? pool : [8]);
      const prod = a * b;
      const s = surdSimp(prod);
      return {
        prompt: `Simplify $\\sqrt{${a}} \\times \\sqrt{${b}}$.`,
        answerType: 'numeric', answer: { value: s.k * Math.sqrt(s.r), surdForm: { k: s.k, r: s.r } },
        inputHint: 'e.g. 2sqrt(3)',
        traps: [{ value: Math.sqrt(a + b), why: 'Roots multiply under one root: $\\sqrt{a}\\sqrt{b} = \\sqrt{ab}$ — the numbers multiply, they don’t add.', tol: 0.01 }],
        hints: ['Combine under a single square root.', `$\\sqrt{${a}} \\times \\sqrt{${b}} = \\sqrt{${prod}}$.`, `Now extract the square factor: $${prod} = ${s.k * s.k} \\times ${s.r}$.`],
        steps: [
          { h: 'Multiply under one root', d: `$\\sqrt{${a} \\times ${b}} = \\sqrt{${prod}}$` },
          { h: 'Extract the square factor', d: `$\\sqrt{${s.k * s.k} \\times ${s.r}} = ${surdLatex(s.k, s.r)}$` }
        ]
      };
    }
    if (diff === 3) {
      const b = rc(rng, SQUARE_FREE.filter(v => v <= 15));
      if (rng() < 0.45) {
        const c = rc(rng, SQUARE_FREE.filter(v => v !== b && v <= 30));
        return {
          prompt: `Expand and simplify $(\\sqrt{${c}} + \\sqrt{${b}})(\\sqrt{${c}} - \\sqrt{${b}})$.`,
          answerType: 'numeric', answer: { value: c - b },
          traps: [
            { value: c + b, why: 'This is a difference of two squares: the middle terms cancel and the last term is *subtracted*.' },
            { value: c * b, why: `Only the outer and inner products cancel — the squares stay separate: $${c} - ${b}$.` }
          ].filter(t => t.value !== c - b),
          hints: ['This is a conjugate pair — difference of two squares.', `$(x+y)(x-y) = x^2 - y^2$ with $x = \\sqrt{${c}}$, $y = \\sqrt{${b}}$.`, `$(\\sqrt{${c}})^2 - (\\sqrt{${b}})^2 = ${c} - ${b}$.`],
          steps: [
            { h: 'Difference of two squares', d: `$(\\sqrt{${c}})^2 - (\\sqrt{${b}})^2$` },
            { h: 'Evaluate', d: `$${c} - ${b} = ${c - b}$` },
            { h: 'Note', d: 'The surds vanish — that’s why conjugates are used to rationalise denominators.' }
          ]
        };
      }
      const a = ri(rng, 2, 12);
      return {
        prompt: `Expand and simplify $(${a} + \\sqrt{${b}})(${a} - \\sqrt{${b}})$.`,
        answerType: 'numeric', answer: { value: a * a - b },
        traps: [
          { value: a * a + b, why: `This is a difference of two squares: $(x+y)(x-y) = x^2 - y^2$, and $(\\sqrt{${b}})^2 = ${b}$.` },
          { value: a * a - Math.sqrt(b), why: `$(\\sqrt{${b}})^2 = ${b}$, not $\\sqrt{${b}}$.`, tol: 0.01 }
        ],
        hints: ['This is a conjugate pair — difference of two squares.', `$(x+y)(x-y) = x^2 - y^2$ with $x = ${a}$, $y = \\sqrt{${b}}$.`, `$${a}^2 - (\\sqrt{${b}})^2 = ${a * a} - ${b}$.`],
        steps: [
          { h: 'Difference of two squares', d: `$(${a})^2 - (\\sqrt{${b}})^2$` },
          { h: 'Evaluate', d: `$${a * a} - ${b} = ${a * a - b}$` },
          { h: 'Note', d: 'The surds vanish — that’s why conjugates are used to rationalise denominators.' }
        ]
      };
    }
    const isCube = rng() < 0.4;
    const root = isCube ? ri(rng, 2, 6) : ri(rng, 2, 12);
    const p = isCube ? root ** 3 : root * root;
    const den = isCube ? 3 : 2;
    const numTop = rc(rng, isCube ? [1, 2, 4] : [1, 3, 5]);
    const neg = rng() < 0.35;
    const idx = neg ? -numTop : numTop;
    const val = neg ? 1 / root ** numTop : root ** numTop;
    return {
      prompt: `Evaluate $${p}^{${idx}/${den}}$.`,
      answerType: 'numeric', answer: neg ? { value: val, simplestFraction: { n: 1, d: root ** numTop } } : { value: val },
      inputHint: neg ? 'e.g. 1/81' : 'e.g. 27',
      traps: [
        { value: p * idx / den, why: 'A fractional index is a root, not multiplication by the fraction.' },
        { value: neg ? -val : p ** numTop / den, why: `Take the ${den === 2 ? 'square' : 'cube'} root *first*, then raise to the power ${numTop}${neg ? ' and take the reciprocal' : ''} — much smaller numbers.` }
      ].filter(t => Math.abs(t.value - val) > 1e-9),
      hints: [
        `The denominator ${den} means a ${den === 2 ? 'square' : 'cube'} root.`,
        `$${p}^{1/${den}} = ${root}$.`,
        neg ? `A negative index means the reciprocal: $\\dfrac{1}{${root}^{${numTop}}}$.` : `Then raise to the power ${numTop}: $${root}^{${numTop}}$.`
      ],
      steps: [
        { h: 'Root first', d: `$${p}^{1/${den}} = ${root}$` },
        { h: 'Then the power', d: `$${root}^{${numTop}} = ${root ** numTop}$` },
        ...(neg ? [{ h: 'Negative index', d: `$${p}^{${idx}/${den}} = \\dfrac{1}{${root ** numTop}}$` }] : [])
      ]
    };
  },

  // ── Compound interest & depreciation ─────────────────────────────────────
  'y10-compound': (rng, diff) => {
    const P = ri(rng, 4, 24) * 500;
    const rr = rc(rng, [3, 4, 5, 6, 7, 8]);
    const n = ri(rng, 2, 6);
    const A = P * (1 + rr / 100) ** n;
    if (diff === 1) {
      return {
        prompt: `${moneyPlain(P)} is invested at $${rr}\\%$ p.a. **compound** interest for $${n}$ years. Find the final value, correct to the nearest cent.`,
        answerType: 'numeric', answer: { value: r2(A), tol: 0.02 }, answerPrefix: '$',
        traps: [{ value: r2(P * (1 + rr * n / 100)), why: 'That’s simple interest — compound interest multiplies by $(1 + r)$ each year, growing on the growth.', tol: 0.02 }],
        hints: ['Compound growth: $A = P(1 + r)^n$.', `$A = ${P} \\times ${(1 + rr / 100)}^{${n}}$.`, `$${(1 + rr / 100)}^{${n}} = ${r3((1 + rr / 100) ** n)}\\ldots$`],
        steps: [
          { h: 'Formula', d: `$A = P(1 + r)^n = ${P}(${1 + rr / 100})^{${n}}$` },
          { h: 'Evaluate the growth factor', d: `$(${1 + rr / 100})^{${n}} = ${r3((1 + rr / 100) ** n)}\\ldots$` },
          { h: 'Multiply', d: `$A \\approx ${r2(A)}$ → ${moneyPlain(r2(A))}` }
        ]
      };
    }
    if (diff === 2) {
      return {
        prompt: `${moneyPlain(P)} is invested at $${rr}\\%$ p.a. compounding annually for $${n}$ years. How much **interest** is earned, to the nearest cent?`,
        answerType: 'numeric', answer: { value: r2(A - P), tol: 0.02 }, answerPrefix: '$',
        traps: [{ value: r2(A), why: `${moneyPlain(r2(A))} is the final balance — subtract the principal for the interest alone.`, tol: 0.02 }],
        hints: ['Find the final value first, then subtract the principal.', `$A = ${P}(${1 + rr / 100})^{${n}} = ${r2(A)}$.`, `Interest $= A - P$.`],
        steps: [
          { h: 'Final value', d: `$A = ${P}(${1 + rr / 100})^{${n}} = ${r2(A)}$` },
          { h: 'Subtract the principal', d: `$I = ${r2(A)} - ${P} = ${r2(A - P)}$ → ${moneyPlain(r2(A - P))}` }
        ]
      };
    }
    if (diff === 3) {
      const car = ri(rng, 15, 60) * 1000;
      const dep = rc(rng, [10, 12, 15, 20, 25]);
      const yrs = ri(rng, 2, 5);
      const val = car * (1 - dep / 100) ** yrs;
      return {
        prompt: `A car bought for ${moneyPlain(car)} depreciates at $${dep}\\%$ p.a. (declining balance). Find its value after $${yrs}$ years, to the nearest dollar.`,
        answerType: 'numeric', answer: { value: Math.round(val), tol: 1.01 }, answerPrefix: '$',
        traps: [
          { value: Math.round(car * (1 - dep * yrs / 100)), why: 'Declining-balance depreciation multiplies by $(1 - r)$ each year — it isn’t a straight-line loss.', tol: 1.01 },
          { value: Math.round(car * (1 + dep / 100) ** yrs), why: 'Depreciation *shrinks* the value: the multiplier is $(1 - r)$, less than 1.', tol: 1.01 }
        ],
        hints: ['Same structure as compound interest, but the value shrinks.', `$V = ${car}(1 - ${dep / 100})^{${yrs}}$.`, `Multiplier: $${1 - dep / 100}$ each year.`],
        steps: [
          { h: 'Depreciation formula', d: `$V = P(1 - r)^n = ${car}(${1 - dep / 100})^{${yrs}}$` },
          { h: 'Evaluate', d: `$V = ${r2(val)} \\approx ${moneyPlain(Math.round(val))}$` }
        ]
      };
    }
    const diffI = A - P * (1 + rr * n / 100);
    return {
      prompt: `${moneyPlain(P)} is invested for $${n}$ years at $${rr}\\%$ p.a. How much **more** does compound interest (annual) earn than simple interest, to the nearest cent?`,
      answerType: 'numeric', answer: { value: r2(diffI), tol: 0.02 }, answerPrefix: '$',
      traps: [{ value: r2(A - P), why: 'That’s the total compound interest — the question wants the *gap* between compound and simple.', tol: 0.02 }],
      hints: ['Work out each scheme’s final value separately.', `Compound: $${P}(${1 + rr / 100})^{${n}} = ${r2(A)}$. Simple: $${P}(1 + ${rr / 100} \\times ${n}) = ${r2(P * (1 + rr * n / 100))}$.`, 'Subtract the two.'],
      steps: [
        { h: 'Compound value', d: `$${P}(${1 + rr / 100})^{${n}} = ${r2(A)}$` },
        { h: 'Simple value', d: `$${P}(1 + ${rr / 100} \\times ${n}) = ${r2(P * (1 + rr * n / 100))}$` },
        { h: 'Difference', d: `$${r2(A)} - ${r2(P * (1 + rr * n / 100))} = ${r2(diffI)}$ → ${moneyPlain(r2(diffI))}` }
      ]
    };
  },

  // ── Similarity & scale ───────────────────────────────────────────────────
  'y10-similarity': (rng, diff) => {
    if (diff === 1) {
      const k = rc(rng, [1.5, 2, 2.5, 3, 3.5, 4, 5, 6]);
      const a = ri(rng, 3, 20);
      return {
        prompt: `Two similar triangles have matching sides $${a}$ cm and $${a * k}$ cm. What is the scale factor from the smaller to the larger?`,
        answerType: 'numeric', answer: { value: k },
        traps: [{ value: a * k - a, why: 'Scale factor is a *ratio* (divide), not a difference.' }],
        hints: ['Scale factor = new length ÷ original length.', `$${a * k} \\div ${a}$.`, `Every side of the larger triangle is ${k} times longer.`],
        steps: [{ h: 'Divide matching sides', d: `$k = \\dfrac{${a * k}}{${a}} = ${k}$` }]
      };
    }
    if (diff === 2) {
      const k = rc(rng, [1.5, 2, 2.5, 3, 3.5, 4, 5]);
      const a = ri(rng, 3, 16), b = ri(rng, 4, 20);
      return {
        prompt: `Triangles $ABC$ and $DEF$ are similar. $AB = ${a}$ cm matches $DE = ${a * k}$ cm, and $BC = ${b}$ cm matches $EF$. Find $EF$.`,
        answerType: 'numeric', answer: { value: b * k }, answerSuffix: 'cm',
        traps: [
          { value: b + a * (k - 1), why: 'Similar figures scale by *multiplying*, not by adding the same amount to each side.' },
          { value: r2(b / k), why: 'The scale factor goes from ABC to DEF — multiply by it, don’t divide.', tol: 0.02 }
        ],
        hints: ['Find the scale factor from the matching pair first.', `$k = ${a * k}/${a} = ${k}$.`, `$EF = ${b} \\times ${k}$.`],
        steps: [
          { h: 'Scale factor', d: `$k = \\dfrac{${a * k}}{${a}} = ${k}$` },
          { h: 'Apply to BC', d: `$EF = ${b} \\times ${k} = ${b * k}$ cm` }
        ]
      };
    }
    if (diff === 3) {
      const k = rc(rng, [1.5, 2, 2.5, 3, 3.5, 4, 5]);
      const A = ri(rng, 6, 60);
      return {
        prompt: `Two similar figures have a length scale factor of $${k}$. The smaller figure has area $${A}$ cm². Find the area of the larger figure.`,
        answerType: 'numeric', answer: { value: A * k * k, tol: 0.01 }, answerSuffix: 'cm²',
        traps: [{ value: A * k, why: 'Areas scale by the *square* of the length factor: $k^2$, not $k$.' }],
        hints: ['Lengths scale by k — what do areas scale by?', `Areas scale by $k^2 = ${k * k}$.`, `$${A} \\times ${k * k}$.`],
        steps: [
          { h: 'Area scale factor', d: `$k^2 = ${k}^2 = ${k * k}$` },
          { h: 'Multiply', d: `$${A} \\times ${k * k} = ${A * k * k}$ cm²` }
        ]
      };
    }
    const scale = rc(rng, [10000, 20000, 25000, 40000, 50000, 80000, 100000, 150000, 200000, 250000, 500000]);
    const mapCm = ri(rng, 2, 24);
    const km = mapCm * scale / 100000;
    return {
      prompt: `A map has scale $1 : ${scale.toLocaleString('en-AU')}$. Two towns are $${mapCm}$ cm apart on the map. What is the real distance between them, in kilometres?`,
      answerType: 'numeric', answer: { value: km, tol: 0.001 }, answerSuffix: 'km',
      traps: [{ value: mapCm * scale / 1000, why: 'Careful with units: cm → km divides by 100 000 (100 cm/m × 1000 m/km).' }],
      hints: ['Real distance = map distance × scale (in cm first).', `$${mapCm} \\times ${scale.toLocaleString('en-AU')} = ${(mapCm * scale).toLocaleString('en-AU')}$ cm.`, 'Convert: 100 000 cm = 1 km.'],
      steps: [
        { h: 'Scale up', d: `$${mapCm} \\times ${scale.toLocaleString('en-AU')} = ${(mapCm * scale).toLocaleString('en-AU')}$ cm` },
        { h: 'Convert to km', d: `$${(mapCm * scale).toLocaleString('en-AU')} \\div 100\\,000 = ${km}$ km` }
      ]
    };
  },

  // ── Statistics & bivariate data ──────────────────────────────────────────
  'y10-stats': (rng, diff) => {
    if (diff === 1) {
      const vals = [ri(rng, 1, 4), ri(rng, 5, 8), ri(rng, 9, 12)];
      const freqs = [ri(rng, 2, 6), ri(rng, 3, 8), ri(rng, 2, 5)];
      const totalF = freqs[0] + freqs[1] + freqs[2];
      const totalV = vals[0] * freqs[0] + vals[1] * freqs[1] + vals[2] * freqs[2];
      const mean = totalV / totalF;
      return {
        prompt: `A frequency table records goals per game: value $${vals[0]}$ (frequency $${freqs[0]}$), value $${vals[1]}$ (frequency $${freqs[1]}$), value $${vals[2]}$ (frequency $${freqs[2]}$). Find the mean, correct to 2 decimal places.`,
        answerType: 'numeric', answer: { value: r2(mean), tol: 0.011 },
        traps: [
          { value: r2((vals[0] + vals[1] + vals[2]) / 3), why: 'Each value occurs multiple times — weight by frequency: $\\sum fx \\div \\sum f$.' },
          { value: totalV, why: `${totalV} is $\\sum fx$ — divide by the total frequency ${totalF}.` }
        ],
        hints: ['Mean from a table: $\\bar{x} = \\frac{\\sum f x}{\\sum f}$.', `$\\sum fx = ${vals[0]}·${freqs[0]} + ${vals[1]}·${freqs[1]} + ${vals[2]}·${freqs[2]} = ${totalV}$.`, `$\\sum f = ${totalF}$.`],
        steps: [
          { h: 'Multiply value × frequency', d: `$${vals[0] * freqs[0]} + ${vals[1] * freqs[1]} + ${vals[2] * freqs[2]} = ${totalV}$` },
          { h: 'Total frequency', d: `$${freqs.join(' + ')} = ${totalF}$` },
          { h: 'Divide', d: `$\\bar{x} = \\dfrac{${totalV}}{${totalF}} = ${r2(mean)}$` }
        ]
      };
    }
    if (diff === 2) {
      const m = ri(rng, 40, 60);
      const tight = [m - 2, m - 1, m, m + 1, m + 2];
      const wide = [m - 15, m - 7, m, m + 8, m + 14];
      const first = rc(rng, [true, false]);
      const A = first ? tight : wide, B = first ? wide : tight;
      const ans = first ? 'Set B' : 'Set A';
      const mm = mcq(rng, `${ans} — same mean, larger spread (standard deviation)`, [
        { text: `${first ? 'Set A' : 'Set B'} — its values are packed closer to the mean`, why: 'Standard deviation measures spread about the mean — the *wider* set has the larger deviation.' },
        { text: 'They have equal standard deviation because the means are equal', why: 'Two sets can share a mean but differ wildly in spread — the deviation measures the spread, not the centre.' },
        { text: 'Impossible to compare without the median' }
      ]);
      return {
        prompt: `Set A: $${A.join(', ')}$. Set B: $${B.join(', ')}$. Both have mean $${m}$. Which set has the larger **standard deviation**?`,
        answerType: 'mcq', answer: { correctIndex: mm.correctIndex, optionTraps: mm.optionTraps }, mcqOptions: mm.options,
        hints: ['Standard deviation measures typical distance from the mean.', 'Look at how far each set’s values stray from ' + m + '.', `${ans}'s values sit much further from the mean.`],
        steps: [
          { h: 'Compare deviations', d: `${first ? 'A' : 'B'}: within $\\pm2$ of the mean. ${first ? 'B' : 'A'}: up to $\\pm15$ away.` },
          { h: 'Conclusion', d: `${ans} has the larger standard deviation.` }
        ]
      };
    }
    if (diff === 3) {
      // Reading a scatterplot: which way the cloud slopes, how tightly it
      // clusters, and what that says about the two variables.
      const ctx = rc(rng, [
        { xL: 'Hours of study', yL: 'Test mark (%)', up: true, who: 'students', rise: 'the more they study, the higher they score', fall: 'the more they study, the lower they score' },
        { xL: 'Hours of TV per week', yL: 'Test mark (%)', up: false, who: 'students', rise: 'more television goes with higher marks', fall: 'more television goes with lower marks' },
        { xL: 'Age of car (years)', yL: 'Resale value (thousands)', up: false, who: 'cars', rise: 'older cars are worth more', fall: 'older cars are worth less' },
        { xL: 'Rainfall (mm)', yL: 'Grass height (cm)', up: true, who: 'plots', rise: 'more rain goes with taller grass', fall: 'more rain goes with shorter grass' },
        { xL: 'Daily maximum (°C)', yL: 'Hot drinks sold', up: false, who: 'days', rise: 'warmer days sell more hot drinks', fall: 'warmer days sell fewer hot drinks' }
      ]);
      const n = ri(rng, 8, 13);
      const xs = distinct(rng, n, () => ri(rng, 1, 14)).sort((a, b) => a - b);
      if (xs.length < n) return year10['y10-stats'](rng, diff);
      const m = (ctx.up ? 1 : -1) * ri(rng, 2, 4);
      const base = ctx.up ? ri(rng, 8, 18) : ri(rng, 52, 64);
      const noise = xs.map(() => rc(rng, [-3, -2, -1, 1, 2, 3]));
      const ys = xs.map((x, i) => m * x + base + noise[i]);
      if (Math.min(...ys) < 3 || Math.max(...ys) > 78) return year10['y10-stats'](rng, diff);
      const yMax = Math.ceil(Math.max(...ys) / 10) * 10;
      const above = noise.filter(v => v > 0).length;
      const figure = figScatter({
        pts: xs.map((x, i) => [x, ys[i]]), xMax: 15, yMax,
        xLabel: ctx.xL, yLabel: ctx.yL,
        line: [[xs[0], m * xs[0] + base], [xs[n - 1], m * xs[n - 1] + base]]
      });
      const ask = ri(rng, 0, 2);
      if (ask === 0) {
        const mm = mcq(rng, `A strong ${ctx.up ? 'positive' : 'negative'} association`, [
          { text: `A strong ${ctx.up ? 'negative' : 'positive'} association`, why: `The cloud of points runs ${ctx.up ? 'up' : 'down'} to the right, so as ${ctx.xL.toLowerCase()} increases the ${ctx.yL.toLowerCase()} ${ctx.up ? 'increases' : 'decreases'}.` },
          { text: `A weak ${ctx.up ? 'positive' : 'negative'} association`, why: 'The direction is right, but the points hug the line closely rather than scattering loosely — that makes the association strong.' },
          { text: 'No association', why: 'There is a clear pattern here: the points march steadily in one direction rather than sitting in a shapeless cloud.' }
        ]);
        return {
          prompt: `The scatterplot shows ${ctx.yL.toLowerCase()} against ${ctx.xL.toLowerCase()} for $${n}$ ${ctx.who}. Describe the association between the two variables.`,
          figure,
          answerType: 'mcq', answer: { correctIndex: mm.correctIndex, optionTraps: mm.optionTraps }, mcqOptions: mm.options,
          hints: ['Ask two questions: which way does the cloud slope, and how tightly do the points hug that slope?',
            `Reading left to right, the points head ${ctx.up ? 'upwards' : 'downwards'} — that fixes the direction.`,
            'They sit very close to a straight line, so the association is strong rather than weak.'],
          steps: [
            { h: 'Direction', d: `The points fall from left to right? ${ctx.up ? 'No — they rise, so the association is positive.' : 'Yes — they fall, so the association is negative.'}` },
            { h: 'Strength', d: 'The points cluster tightly about a straight line, so the association is strong.' },
            { h: 'Describe it', d: `A strong ${ctx.up ? 'positive' : 'negative'} association.` }
          ]
        };
      }
      if (ask === 1) {
        return {
          prompt: `The scatterplot shows ${ctx.yL.toLowerCase()} against ${ctx.xL.toLowerCase()} for $${n}$ ${ctx.who}, with a line of best fit drawn. How many of the $${n}$ points lie **above** the line?`,
          figure,
          answerType: 'numeric', answer: { value: above },
          traps: [
            { value: n - above, why: 'That is the count *below* the line — read the question’s direction carefully.' },
            { value: n, why: 'A line of best fit runs through the middle of the cloud, so points sit on both sides of it.' }
          ].filter(t => t.value !== above),
          hints: ['Take the points one at a time and ask whether each sits over or under the drawn line.',
            'No point sits exactly on the line here, so every one of them counts once.',
            `Counting the ones above gives $${above}$ out of $${n}$.`],
          steps: [
            { h: 'Check each point against the line', d: `$${n}$ points in total, none of them on the line` },
            { h: 'Count the ones above', d: `$${above}$ above, $${n - above}$ below` },
            { h: 'Answer', d: `$${above}$` }
          ]
        };
      }
      const mm = mcq(rng, `As ${ctx.xL.toLowerCase()} increases, ${ctx.yL.toLowerCase()} tends to **${ctx.up ? 'increase' : 'decrease'}** — ${ctx.up ? ctx.rise : ctx.fall}.`, [
        { text: `As ${ctx.xL.toLowerCase()} increases, ${ctx.yL.toLowerCase()} tends to **${ctx.up ? 'decrease' : 'increase'}** — ${ctx.up ? ctx.fall : ctx.rise}.`, why: `The points climb ${ctx.up ? 'up' : 'down'} to the right, which is the opposite of this description.` },
        { text: 'There is no relationship between the two variables.', why: 'The points follow a clear straight-line trend, so a relationship is plainly visible.' },
        { text: `Every extra unit of ${ctx.xL.toLowerCase()} changes ${ctx.yL.toLowerCase()} by exactly the same amount.`, why: 'The points only *cluster* about a line — they do not sit on it, so the change is a tendency rather than an exact rule.' }
      ]);
      return {
        prompt: `The scatterplot shows ${ctx.yL.toLowerCase()} against ${ctx.xL.toLowerCase()} for $${n}$ ${ctx.who}. Which statement best describes what the graph shows?`,
        figure,
        answerType: 'mcq', answer: { correctIndex: mm.correctIndex, optionTraps: mm.optionTraps }, mcqOptions: mm.options,
        hints: ['Read the plot from left to right and watch what happens to the height of the points.',
          `Here they head ${ctx.up ? 'upwards' : 'downwards'}.`,
          'Then check the wording: does the statement claim a *tendency*, or an exact rule the points do not obey?'],
        steps: [
          { h: 'Direction of the trend', d: `Left to right, the points ${ctx.up ? 'rise' : 'fall'}` },
          { h: 'Translate into context', d: `So ${ctx.up ? ctx.rise : ctx.fall}` },
          { h: 'Tendency, not a rule', d: 'The scatter about the line means this describes a general tendency.' }
        ]
      };
    }
    const n1 = ri(rng, 10, 20), n2 = ri(rng, 10, 20);
    const m1 = ri(rng, 55, 75), m2 = ri(rng, 60, 85);
    const combined = (n1 * m1 + n2 * m2) / (n1 + n2);
    return {
      prompt: `Class P ($${n1}$ students) averaged $${m1}\\%$ on a test; Class Q ($${n2}$ students) averaged $${m2}\\%$. Find the combined mean of all $${n1 + n2}$ students, correct to 1 decimal place.`,
      answerType: 'numeric', answer: { value: r1(combined), tol: 0.06 }, answerSuffix: '%',
      traps: [{ value: (m1 + m2) / 2, why: `The classes have different sizes, so weight each mean by its class size — a straight average of ${m1} and ${m2} ignores that.` }],
      hints: ['Rebuild each class’s total marks.', `Totals: $${n1} \\times ${m1} = ${n1 * m1}$ and $${n2} \\times ${m2} = ${n2 * m2}$.`, `Divide the grand total by ${n1 + n2}.`],
      steps: [
        { h: 'Class totals', d: `$${n1} \\times ${m1} = ${n1 * m1}$, $\\quad ${n2} \\times ${m2} = ${n2 * m2}$` },
        { h: 'Grand total', d: `$${n1 * m1} + ${n2 * m2} = ${n1 * m1 + n2 * m2}$` },
        { h: 'Combined mean', d: `$\\dfrac{${n1 * m1 + n2 * m2}}{${n1 + n2}} = ${r1(combined)}\\%$` }
      ]
    };
  },

  // ── Conditional probability ──────────────────────────────────────────────
  'y10-probability': (rng, diff) => {
    if (diff === 1) {
      const both = ri(rng, 3, 8), onlyA = ri(rng, 3, 9), onlyB = ri(rng, 3, 9), neither = ri(rng, 2, 6);
      const total = both + onlyA + onlyB + neither;
      const f = new Frac(both, total);
      return {
        prompt: `In a class of $${total}$, $${onlyA + both}$ play basketball, $${onlyB + both}$ play netball, and $${both}$ play **both**. One student is chosen at random. Find $P(\\text{plays both})$, as a fraction in simplest form.`,
        answerType: 'numeric', answer: { value: f.value, simplestFraction: { n: f.n, d: f.d } },
        inputHint: 'e.g. 1/5',
        traps: [{ value: both / (onlyA + both + onlyB + both), why: 'The denominator is the whole class — don’t double-count the overlap when totalling.' }],
        hints: ['A Venn diagram helps: overlap = both sports.', `The overlap region holds ${both} students.`, `$P = \\frac{${both}}{${total}}$, then simplify.`],
        steps: [
          { h: 'Overlap', d: `${both} students play both` },
          { h: 'Probability', d: `$\\dfrac{${both}}{${total}} = ${f.latex()}$` }
        ]
      };
    }
    if (diff === 2) {
      const yesA = ri(rng, 8, 20), noA = ri(rng, 5, 15), yesB = ri(rng, 6, 18), noB = ri(rng, 4, 14);
      const f = new Frac(yesA, yesA + yesB);
      return {
        prompt: `A two-way table of a survey: Year 10 — $${yesA}$ own a pet, $${noA}$ don't; Year 11 — $${yesB}$ own a pet, $${noB}$ don't. Given that a randomly chosen student **owns a pet**, find the probability they are in Year 10 (simplest-form fraction).`,
        answerType: 'numeric', answer: { value: f.value, simplestFraction: { n: f.n, d: f.d } },
        inputHint: 'e.g. 2/3',
        traps: [{ value: yesA / (yesA + noA + yesB + noB), why: '“Given that they own a pet” shrinks the world to pet-owners only — the denominator is the pet-owner column, not everyone.' }],
        hints: ['The condition restricts you to one column of the table.', `Pet owners: $${yesA} + ${yesB} = ${yesA + yesB}$.`, `Of those, ${yesA} are Year 10.`],
        steps: [
          { h: 'Restrict to the condition', d: `Pet owners: $${yesA} + ${yesB} = ${yesA + yesB}$` },
          { h: 'Conditional probability', d: `$P(\\text{Y10} \\mid \\text{pet}) = \\dfrac{${yesA}}{${yesA + yesB}} = ${f.latex()}$` }
        ]
      };
    }
    if (diff === 3) {
      const pAB = rc(rng, [[1, 10], [1, 8], [3, 20], [1, 6], [1, 12], [1, 5], [2, 15], [3, 25], [1, 20], [7, 40]]);
      const pB = rc(rng, [[1, 4], [3, 10], [2, 5], [1, 2], [3, 5], [7, 10], [2, 3], [4, 5], [5, 8], [3, 4]]);
      const fAB = new Frac(pAB[0], pAB[1]);
      const fB = new Frac(pB[0], pB[1]);
      if (fAB.value >= fB.value) return year10['y10-probability'](rng, diff);
      const cond = fAB.div(fB);
      return {
        prompt: `Events $A$ and $B$ satisfy $P(A \\cap B) = ${fAB.latex()}$ and $P(B) = ${fB.latex()}$. Find $P(A \\mid B)$, as a fraction in simplest form.`,
        answerType: 'numeric', answer: { value: cond.value, simplestFraction: { n: cond.n, d: cond.d } },
        inputHint: 'e.g. 2/5',
        traps: [{ value: fAB.mul(fB).value, why: 'Conditional probability *divides*: $P(A\\mid B) = \\frac{P(A \\cap B)}{P(B)}$.' }],
        hints: ['Use the conditional probability formula.', `$P(A \\mid B) = \\dfrac{P(A \\cap B)}{P(B)}$.`, `$${fAB.latex()} \\div ${fB.latex()} = ${fAB.latex()} \\times ${new Frac(fB.d, fB.n).latex()}$.`],
        steps: [
          { h: 'Formula', d: `$P(A \\mid B) = \\dfrac{P(A \\cap B)}{P(B)}$` },
          { h: 'Substitute', d: `$= ${fAB.latex()} \\div ${fB.latex()}$` },
          { h: 'Evaluate', d: `$= ${cond.latex()}$` }
        ]
      };
    }
    const pA = rc(rng, [[1, 2], [2, 5], [3, 10], [1, 4]]);
    const pB = rc(rng, [[1, 5], [3, 10], [1, 2], [2, 5]]);
    const fA = new Frac(pA[0], pA[1]), fB2 = new Frac(pB[0], pB[1]);
    const indep = rc(rng, [true, false]);
    const fAB = indep ? fA.mul(fB2) : fA.mul(fB2).add(new Frac(1, 20));
    const mm = mcq(rng, indep ? `Yes — because $P(A \\cap B) = P(A)P(B)$` : `No — because $P(A \\cap B) \\ne P(A)P(B)$`, [
      { text: indep ? `No — because $P(A) \\ne P(B)$` : `Yes — because $P(A) \\ne P(B)$`, why: 'Independence isn’t about the events having equal probabilities — it’s the product test: does $P(A\\cap B) = P(A)P(B)$?' },
      { text: indep ? `No — independent events must be mutually exclusive` : `Yes — the events are mutually exclusive`, why: 'Mutually exclusive is a *different* idea (can’t happen together). Independent events generally CAN happen together.' },
      { text: 'Cannot be determined from the information given' }
    ]);
    return {
      prompt: `Events $A$ and $B$ have $P(A) = ${fA.latex()}$, $P(B) = ${fB2.latex()}$ and $P(A \\cap B) = ${fAB.latex()}$. Are $A$ and $B$ independent?`,
      answerType: 'mcq', answer: { correctIndex: mm.correctIndex, optionTraps: mm.optionTraps }, mcqOptions: mm.options,
      hints: ['Independence test: multiply P(A) and P(B).', `$P(A)P(B) = ${fA.mul(fB2).latex()}$.`, `Compare with $P(A \\cap B) = ${fAB.latex()}$.`],
      steps: [
        { h: 'Product test', d: `$P(A)P(B) = ${fA.latex()} \\times ${fB2.latex()} = ${fA.mul(fB2).latex()}$` },
        { h: 'Compare', d: `$P(A \\cap B) = ${fAB.latex()}$ — ${indep ? 'equal, so independent' : 'different, so NOT independent'}` }
      ]
    };
  }
};

