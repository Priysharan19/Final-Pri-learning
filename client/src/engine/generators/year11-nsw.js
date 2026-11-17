// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Year 11 generators for the NSW Mathematics Advanced (2024)
// outcomes that had no, or too few, approved forms. Original to Pri; no NESA
// paper, question or marking guideline is used. Every answer is exact.
//
//   y11-functions-more  MAV-11-01  Working with functions
//   y11-transform       MAV-11-03  Graph transformations
//   y11-trig-ident      MAV-11-05  Trigonometric identities and equations
//   y11-explog-more     MAV-11-08  Exponential and logarithmic functions (logarithms)
//   y11-data-sets       MAV-11-10  Probability and data (data)
// ─────────────────────────────────────────────────────────────────────────────
import { ri, rc, nz } from '../qhelpers.js';

const sg = c => (c >= 0 ? `+ ${c}` : `- ${Math.abs(c)}`);

export const year11Nsw = {
  // ── Working with functions ─────────────────────────────────────────────────
  'y11-functions-more': (rng, diff) => {
    if (diff === 1) {
      const a = nz(rng, -9, 9), m = ri(rng, 1, 4);
      return {
        prompt: `What is the smallest value of $x$ in the domain of $f(x) = \\sqrt{${m === 1 ? '' : m}x ${sg(-a * m)}}$?`,
        answerType: 'numeric', answer: { value: a },
        traps: [{ value: a * m, why: 'Solve $mx - c \\ge 0$: the domain starts where the expression under the root is $0$.' }].filter(t => t.value !== a),
        hints: ['The expression under a square root cannot be negative.', `$${m === 1 ? '' : m}x ${sg(-a * m)} \\ge 0$.`, 'Solve the inequality; the boundary is the smallest value.'],
        steps: [{ h: 'Under the root', d: `$${m === 1 ? '' : m}x ${sg(-a * m)} \\ge 0 \\Rightarrow x \\ge ${a}$` }, { h: 'Smallest value', d: `$x = ${a}$` }]
      };
    }
    if (diff === 2) {
      const p = ri(rng, 1, 3), h = nz(rng, -5, 5), k = nz(rng, -9, 9);
      return {
        prompt: `Find the minimum value of the function $f(x) = ${p === 1 ? '' : p}(x ${sg(-h)})^2 ${sg(k)}$. (It is the lowest value in its range.)`,
        answerType: 'numeric', answer: { value: k },
        traps: [{ value: h, why: 'A squared bracket is never negative: the minimum value of $f$ is the constant added outside it.' }].filter(t => t.value !== k),
        hints: ['A square is at least $0$.', `The bracket is $0$ when $x = ${h}$.`, 'Then $f(x)$ equals the added constant.'],
        steps: [{ h: 'Smallest square', d: `$(x ${sg(-h)})^2 \\ge 0$, so $f(x) \\ge ${k}$` }, { h: 'Minimum', d: `$f_{\\min} = ${k}$` }]
      };
    }
    if (diff === 3) {
      const m = ri(rng, 2, 6), c = nz(rng, -9, 9), x = ri(rng, -4, 6);
      const y = m * x + c;
      return {
        prompt: `$f(x) = ${m}x ${sg(c)}$. Find $f^{-1}(${y})$, the value of $x$ for which $f(x) = ${y}$.`,
        answerType: 'numeric', answer: { value: x },
        traps: [{ value: y - c, why: 'Solve $mx + c = y$ for $x$: subtract $c$, then divide by $m$.' }].filter(t => t.value !== x),
        hints: ['The inverse undoes $f$: solve $f(x) = ' + y + '$.', `$${m}x = ${y} ${sg(-c)}$.`, `Divide by $${m}$.`],
        steps: [{ h: 'Solve f(x) = y', d: `$${m}x ${sg(c)} = ${y} \\Rightarrow ${m}x = ${m * x} \\Rightarrow x = ${x}$` }]
      };
    }
    const p = ri(rng, 2, 4), q = nz(rng, -6, 6), r = ri(rng, 2, 4), a = ri(rng, 1, 4);
    const g = r * a, val = p * g + q;
    return {
      prompt: `$f(x) = ${p}x ${sg(q)}$ and $g(x) = ${r}x$. Find $f(g(${a}))$.`,
      answerType: 'numeric', answer: { value: val },
      traps: [{ value: r * (p * a + q), why: '$f(g(a))$ means apply $g$ first, then $f$.' }].filter(t => t.value !== val),
      hints: [`Find $g(${a}) = ${g}$ first.`, `Then $f(${g}) = ${p}(${g}) ${sg(q)}$.`, 'Work from the inside out.'],
      steps: [{ h: 'Inner function', d: `$g(${a}) = ${g}$` }, { h: 'Outer function', d: `$f(${g}) = ${val}$` }]
    };
  },

  // ── Graph transformations (points) ─────────────────────────────────────────
  'y11-transform': (rng, diff) => {
    const x = nz(rng, -6, 6), y = nz(rng, -6, 6);
    if (diff === 1) {
      const h = nz(rng, -5, 5), k = nz(rng, -5, 5);
      return {
        prompt: `The point $(${x}, ${y})$ lies on the graph of $y = f(x)$. Find the image of this point on the graph of $y = f(x ${sg(-h)}) ${sg(k)}$.`,
        answerType: 'point', answer: { x: x + h, y: y + k }, inputHint: 'e.g. (3, -4)',
        traps: [{ why: 'Replacing $x$ by $x - h$ moves the graph $h$ units to the RIGHT, and adding $k$ outside moves it $k$ units up.' }],
        hints: ['$y = f(x - h) + k$ translates the graph $h$ right and $k$ up.', `$h = ${h}$ and $k = ${k}$.`, 'Add the shifts to the coordinates.'],
        steps: [{ h: 'Translate', d: `$(${x} + ${pn(h)}, ${y} + ${pn(k)}) = (${x + h}, ${y + k})$` }]
      };
    }
    if (diff === 2) {
      const axis = rc(rng, ['x', 'y']);
      return {
        prompt: `The point $(${x}, ${y})$ lies on the graph of $y = f(x)$. Find the image of this point on the graph of $y = ${axis === 'x' ? '-f(x)' : 'f(-x)'}$.`,
        answerType: 'point', answer: axis === 'x' ? { x, y: -y } : { x: -x, y }, inputHint: 'e.g. (3, -4)',
        traps: [{ why: axis === 'x' ? 'A minus in front of $f$ reflects in the $x$-axis: only the $y$-coordinate changes sign.' : 'A minus inside the bracket reflects in the $y$-axis: only the $x$-coordinate changes sign.' }],
        hints: [axis === 'x' ? '$y = -f(x)$ reflects the graph in the $x$-axis.' : '$y = f(-x)$ reflects the graph in the $y$-axis.', 'Change the sign of the one coordinate that moves.', 'The other stays the same.'],
        steps: [{ h: 'Reflect', d: axis === 'x' ? `$(${x}, ${y}) \\to (${x}, ${-y})$` : `$(${x}, ${y}) \\to (${-x}, ${y})$` }]
      };
    }
    const a = rc(rng, [2, 3]), b = rc(rng, [2, 3]);
    if (diff === 3) {
      return {
        prompt: `The point $(${x * b}, ${y})$ lies on the graph of $y = f(x)$. Find the image of this point on the graph of $y = ${a}f\\left(\\dfrac{x}{${b}}\\right)$.`,
        answerType: 'point', answer: { x: x * b * b, y: a * y }, inputHint: 'e.g. (3, -4)',
        traps: [{ why: `Replacing $x$ by $\\dfrac{x}{${b}}$ stretches horizontally by a factor of ${b} (multiply the $x$-coordinate); the factor ${a} multiplies $y$.` }],
        hints: [`$y = ${a}f(\\frac{x}{${b}})$: vertical factor $${a}$, horizontal factor $${b}$.`, 'Multiply $y$ by the vertical factor.', 'Multiply $x$ by the horizontal factor.'],
        steps: [{ h: 'Dilate', d: `$x\\to ${b}x,\\; y \\to ${a}y$ gives $(${x * b * b}, ${a * y})$` }]
      };
    }
    const k = nz(rng, -5, 5);
    return {
      prompt: `The point $(${x}, ${y})$ lies on the graph of $y = f(x)$. The graph is reflected in the $y$-axis, then stretched vertically by a factor of $${a}$, then moved $${Math.abs(k)}$ units ${k > 0 ? 'up' : 'down'}. Find the image of the point.`,
      answerType: 'point', answer: { x: -x, y: a * y + k }, inputHint: 'e.g. (3, -4)',
      traps: [{ why: 'Do the steps in the order given: reflect, then stretch, then shift. The shift is applied after the stretch.' }],
      hints: ['Reflecting in the $y$-axis changes the sign of $x$.', `Stretching vertically multiplies $y$ by ${a}.`, 'Then add the vertical shift.'],
      steps: [{ h: 'Reflect', d: `$(${-x}, ${y})$` }, { h: 'Stretch', d: `$(${-x}, ${a * y})$` }, { h: 'Shift', d: `$(${-x}, ${a * y + k})$` }]
    };
  },

  // ── Trigonometric identities and equations ─────────────────────────────────
  'y11-trig-ident': (rng, diff) => {
    if (diff === 1) {
      const k = ri(rng, 1, 9), m = ri(rng, 2, 6);
      return {
        prompt: `Simplify $${m}\\sin^2\\theta + ${m}\\cos^2\\theta + ${k}$ to a single number.`,
        answerType: 'numeric', answer: { value: m + k },
        traps: [{ value: k, why: '$\\sin^2\\theta + \\cos^2\\theta = 1$, so the first two terms are $' + m + '\\times 1$.' }],
        hints: ['Factor out the common coefficient.', `$${m}(\\sin^2\\theta + \\cos^2\\theta) = ${m}\\times 1$.`, 'Add the constant.'],
        steps: [{ h: 'Pythagorean identity', d: `$${m}(\\sin^2\\theta + \\cos^2\\theta) ${sg(k)} = ${m}(1) ${sg(k)} = ${m + k}$` }]
      };
    }
    const EQ = [
      { tex: '\\sin\\theta = \\tfrac12', sols: [30, 150] }, { tex: '\\cos\\theta = \\tfrac12', sols: [60, 300] },
      { tex: '\\cos\\theta = -\\tfrac12', sols: [120, 240] }, { tex: '\\tan\\theta = 1', sols: [45, 225] },
      { tex: '\\tan\\theta = -1', sols: [135, 315] }, { tex: '\\sin\\theta = -\\tfrac12', sols: [210, 330] },
      { tex: '\\sin\\theta = \\tfrac{\\sqrt3}{2}', sols: [60, 120] }, { tex: '\\cos\\theta = \\tfrac{\\sqrt3}{2}', sols: [30, 330] },
      { tex: '\\tan\\theta = \\sqrt3', sols: [60, 240] }, { tex: '\\cos\\theta = -\\tfrac{\\sqrt3}{2}', sols: [150, 210] }
    ];
    const e = rc(rng, EQ);
    if (diff === 2 || diff === 4) {
      const small = diff === 2;
      return {
        prompt: `Solve $${e.tex}$ for $0^\\circ \\le \\theta \\le 360^\\circ$. Give the ${small ? 'smaller' : 'larger'} of the two solutions, in degrees.`,
        answerType: 'numeric', answer: { value: small ? e.sols[0] : e.sols[1] }, answerSuffix: '°',
        traps: [{ value: small ? e.sols[1] : e.sols[0], why: `There are two solutions, ${e.sols[0]}° and ${e.sols[1]}°: choose the ${small ? 'smaller' : 'larger'}.` }],
        hints: ['Find the reference angle from the exact value.', 'Use the quadrants where the ratio has that sign.', `The two solutions are $${e.sols[0]}^\\circ$ and $${e.sols[1]}^\\circ$.`],
        steps: [{ h: 'Both solutions', d: `$\\theta = ${e.sols[0]}^\\circ$ or $${e.sols[1]}^\\circ$` }, { h: 'Choose', d: `$${small ? e.sols[0] : e.sols[1]}^\\circ$` }]
      };
    }
    const val = rc(rng, [-1, 0, 1, 0.5, -0.5, 2]);
    const label = { '-1': '-1', '0': '0', '1': '1', '0.5': '\\tfrac12', '-0.5': '-\\tfrac12', '2': '2' }[String(val)];
    const exact = val === 0 ? 3 : (Math.abs(val) === 1 ? 1 : (Math.abs(val) < 1 ? 2 : 0));
    return {
      prompt: `How many solutions does $\\sin\\theta = ${label}$ have for $0^\\circ \\le \\theta \\le 360^\\circ$?`,
      answerType: 'numeric', answer: { value: exact },
      traps: [{ value: exact === 1 ? 2 : (exact === 3 ? 2 : 1), why: 'A sine value strictly between $-1$ and $1$ (other than $0$) is reached twice in $0^\\circ$–$360^\\circ$; $\\pm 1$ once; $0$ three times ($0^\\circ$, $180^\\circ$ and $360^\\circ$); beyond $\\pm 1$ never.' }],
      hints: ['Sine takes every value in $[-1, 1]$.', 'Values strictly inside $(-1, 1)$, other than $0$, occur twice in $0^\\circ$–$360^\\circ$; the end angles $0^\\circ$ and $360^\\circ$ are both included.', '$\\pm 1$ occurs once, $0$ three times; anything else never.'],
      steps: [{ h: 'Count', d: `$\\sin\\theta = ${label}$ has ${exact} solution${exact === 1 ? '' : 's'} in the interval` }]
    };
  },

  // ── Logarithms ─────────────────────────────────────────────────────────────
  'y11-explog-more': (rng, diff) => {
    const b = rc(rng, [2, 3, 4, 5, 10]), k = ri(rng, 2, 5);
    if (diff === 1) {
      const i = ri(rng, 1, k - 1), j = k - i;
      return {
        prompt: `Evaluate $\\log_{${b}} ${b ** i} + \\log_{${b}} ${b ** j}$.`,
        answerType: 'numeric', answer: { value: k },
        traps: [{ value: i * j, why: 'Add the logarithms: $\\log_b x + \\log_b y = \\log_b(xy)$.' }].filter(t => t.value !== k),
        hints: ['Evaluate each logarithm, or use $\\log a + \\log b = \\log ab$.', `$\\log_{${b}} ${b ** i} = ${i}$.`, `$\\log_{${b}} ${b ** j} = ${j}$.`],
        steps: [{ h: 'Each term', d: `$${i}$ and $${j}$` }, { h: 'Add', d: `$${k}$` }]
      };
    }
    if (diff === 2) {
      return {
        prompt: `Solve $${b}^x = ${b ** k}$ for $x$.`,
        answerType: 'numeric', answer: { value: k },
        traps: [{ value: b ** k / b, why: 'Write both sides as powers of the same base and equate the indices.' }].filter(t => t.value !== k),
        hints: [`Write $${b ** k}$ as a power of $${b}$.`, `$${b ** k} = ${b}^{${k}}$.`, 'Equate the indices.'],
        steps: [{ h: 'Same base', d: `$${b}^x = ${b}^{${k}} \\Rightarrow x = ${k}$` }]
      };
    }
    if (diff === 3) {
      const m = ri(rng, 2, 15);
      return {
        prompt: `Evaluate $\\ln\\left(e^{${m}}\\right) + \\ln 1$.`,
        answerType: 'numeric', answer: { value: m },
        traps: [{ value: m + 1, why: '$\\ln 1 = 0$, not $1$.' }],
        hints: ['$\\ln e^m = m$ because $\\ln$ is the inverse of $e^x$.', '$\\ln 1 = 0$.', 'Add the two values.'],
        steps: [{ h: 'Inverse functions', d: `$\\ln e^{${m}} = ${m}$ and $\\ln 1 = 0$` }, { h: 'Add', d: `$${m}$` }]
      };
    }
    return {
      prompt: `Solve $\\log_{${b}} x = ${k}$ for $x$.`,
      answerType: 'numeric', answer: { value: b ** k },
      traps: [{ value: b * k, why: '$\\log_b x = k$ means $x = b^k$, not $b\\times k$.' }].filter(t => t.value !== b ** k),
      hints: ['Rewrite in index form.', `$x = ${b}^{${k}}$.`, `$${b}^{${k}} = ${b ** k}$.`],
      steps: [{ h: 'Index form', d: `$x = ${b}^{${k}} = ${b ** k}$` }]
    };
  },

  // ── Data: mean, spread and transformations ─────────────────────────────────
  'y11-data-sets': (rng, diff) => {
    if (diff === 1) {
      const m = ri(rng, 10, 50), n = ri(rng, 2, 4);
      const xs = []; for (let i = 0; i < n; i++) { const d = ri(rng, 1, 8); xs.push(m - d, m + d); }
      return {
        prompt: `Find the mean of the data: ${xs.join(', ')}.`,
        answerType: 'numeric', answer: { value: m },
        traps: [{ value: xs.reduce((s, v) => s + v, 0), why: 'Divide the total by the number of values.' }],
        hints: ['Mean $=\\dfrac{\\text{sum}}{\\text{count}}$.', `There are $${xs.length}$ values.`, 'The values come in pairs either side of the mean.'],
        steps: [{ h: 'Sum and divide', d: `$\\dfrac{${xs.reduce((s, v) => s + v, 0)}}{${xs.length}} = ${m}$` }]
      };
    }
    if (diff === 2) {
      const xs = Array.from({ length: 9 }, () => ri(rng, 2, 60)).sort((a, b) => a - b);
      return {
        prompt: `Nine scores in order are ${xs.join(', ')}. Find the median.`,
        answerType: 'numeric', answer: { value: xs[4] },
        traps: [{ value: Math.round(xs.reduce((s, v) => s + v, 0) / 9), why: 'The median is the middle value of the ordered list, not the mean.' }].filter(t => t.value !== xs[4]),
        hints: ['With nine values the median is the 5th.', 'The data are already in order.', 'Count to the 5th value.'],
        steps: [{ h: 'Middle value', d: `The 5th value is $${xs[4]}$` }]
      };
    }
    const m = ri(rng, 10, 50), d = ri(rng, 2, 9), half = ri(rng, 2, 4);
    const xs = []; for (let i = 0; i < half; i++) xs.push(m - d, m + d);
    if (diff === 3) {
      return {
        prompt: `A data set has ${xs.length} values, half equal to $${m - d}$ and half equal to $${m + d}$. Find its standard deviation (the population standard deviation, $\\sigma$).`,
        answerType: 'numeric', answer: { value: d },
        traps: [{ value: d * d, why: 'That is the variance. The standard deviation is its square root.' }].filter(t => t.value !== d),
        hints: ['Every value is the same distance from the mean.', `The mean is $${m}$ and each value is $${d}$ away.`, 'So the average squared deviation is $d^2$; take the square root.'],
        steps: [{ h: 'Mean', d: `$\\mu = ${m}$` }, { h: 'Variance', d: `$\\sigma^2 = \\dfrac{${xs.length}(${d})^2}{${xs.length}} = ${d * d}$` }, { h: 'Standard deviation', d: `$\\sigma = ${d}$` }]
      };
    }
    const a = ri(rng, 2, 5), c = ri(rng, 1, 9);
    return {
      prompt: `A data set has mean $${m}$ and standard deviation $${d}$. Every value is multiplied by $${a}$ and then $${c}$ is added. What is the standard deviation of the new data?`,
      answerType: 'numeric', answer: { value: a * d },
      traps: [{ value: a * d + c, why: 'Adding a constant shifts every value equally, so it does not change the spread.' }],
      hints: ['Multiplying scales the spread by the same factor.', 'Adding a constant does not change the spread.', `$${a}\\times ${d}$.`],
      steps: [{ h: 'Scale and shift', d: `$\\sigma_{new} = |${a}|\\times ${d} = ${a * d}$` }]
    };
  }
};

function pn(v) { return v < 0 ? `(${v})` : String(v); }
