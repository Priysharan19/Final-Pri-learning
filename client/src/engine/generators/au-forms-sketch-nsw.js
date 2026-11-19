// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Prithagoras capacity overlay: graph-sketch forms (Year 11 and
// Year 12 Advanced).
//
// A sketch question asks the student to state the features of a graph: its
// x-intercepts, y-intercept and turning points. The answer is a DECLARED
// FEATURE SET (engine/graphFeatures.js). The engine derives the true features
// from the function in `answer.graph.spec` and compares; the key written here
// (`answer.key`, `answer.text`) is computed from the numbers shown by a
// separate route (roots by factorisation, vertex by -b/2a, stationary points
// from the derivative's factors), and client/test/graph-sketch-forms-check.mjs
// requires that the two routes agree. No model is involved anywhere, and no
// feature value is placed in any public field of the question.
//
// Forms (each an extra form of an EXISTING offered generator, at a difficulty
// that already assesses the dot point):
//   y11-quadfunc  D2  factorised parabola          x-intercepts, y-intercept, vertex
//   y11-quadfunc  D2  vertex-form parabola         (may have no x-intercepts)
//   y11-quadfunc  D2  factorised, a other than 1   (opens up or down)
//   y12-appdiff   D2,D3  (x - a)^2 (x - b)         touching root, two stationary points
//   y12-appdiff   D3  expanded cubic               y-intercept, stationary points
// Every value is an integer and every |y| is at most 12, so each feature is
// exact and sits inside the marker's tolerance band only when it is right.
// SYNTHETIC: no student or examiner evidence.
// ─────────────────────────────────────────────────────────────────────────────
import { ri, rc, nz, poly } from '../qhelpers.js';

/** Keep drawing until the maker accepts the draw; a defect throws rather than shipping a degenerate item. */
function until(make, tries = 400) {
  for (let i = 0; i < tries; i++) { const q = make(); if (q) return q; }
  throw new Error('au-forms sketch: no valid instance');
}

const MAX_Y = 12;
const num = v => String(v);
/** "(x - 3)" or "(x + 2)" for the root r. */
const fac = r => `(x ${r < 0 ? '+' : '-'} ${Math.abs(r)})`;
/** " + 5" / " - 5" for appending a signed constant to an expression. */
const sg = k => (k < 0 ? `- ${Math.abs(k)}` : `+ ${k}`);
/** A factor (x - r); a zero shift is just x. */
const fx = r => (r === 0 ? 'x' : `(x ${sg(-r)})`);
const lead = a => (a === 1 ? '' : a === -1 ? '-' : String(a));
const pt = (x, y) => `(${num(x)}, ${num(y)})`;
const list = xs => xs.map(num).join(' and ');
const nature = k => (k === 'max' ? 'maximum' : 'minimum');

/**
 * One sketch question. `key` is the feature set a right answer states, in the
 * input contract of graphFeatures.js, holding only the features asked for.
 */
function sketch({ prompt, expression, ask, key, hints, steps }) {
  const scheme = Object.fromEntries(ask.map(k => [k, 1]));
  const parts = [];
  if (key.intercepts?.x) parts.push(key.intercepts.x.length ? `x-intercepts ${key.intercepts.x.join(', ')}` : 'no x-intercepts');
  if (key.intercepts && 'y' in key.intercepts) parts.push(`y-intercept ${key.intercepts.y}`);
  if (key.turning) parts.push(key.turning.map(t => `${nature(t.kind)} at ${pt(t.x, t.y)}`).join('; '));
  return {
    prompt,
    answerType: 'graph-sketch',
    sketchAsk: ask,
    answer: { graph: { spec: { expression, from: -10, to: 10 }, scheme }, key, text: parts.join('; ') },
    traps: [],
    hints,
    steps
  };
}

// ═════════════════════════════════════════════════════════════════════════════
// y11-quadfunc, difficulty 2 (the vertex of a parabola)
// ═════════════════════════════════════════════════════════════════════════════
const QUAD_SKETCH = [
  // y = (x - p)(x - q): intercepts by factors, vertex halfway between them.
  {
    diffs: [2],
    make: rng => until(() => {
      const p = nz(rng, -5, 5), q = nz(rng, -5, 5);
      if (q <= p || (p + q) % 2 !== 0) return null;
      const m = (p + q) / 2, v = (m - p) * (m - q), c = p * q;
      if (Math.abs(c) > MAX_Y || Math.abs(v) > MAX_Y || m === 0) return null;
      const roots = [p, q];
      return sketch({
        prompt: `Sketch the parabola $y = ${fac(p)}${fac(q)}$. State its $x$-intercepts, its $y$-intercept and its vertex.`,
        expression: `${fac(p)}*${fac(q)}`,
        ask: ['xIntercepts', 'yIntercept', 'turning'],
        key: { intercepts: { x: roots, y: c }, turning: [{ x: m, y: v, kind: 'min' }] },
        hints: [
          'The $x$-intercepts are where $y = 0$. A product is zero when one of its factors is zero.',
          'The $y$-intercept is the value of $y$ when $x = 0$.',
          'The vertex lies on the axis of symmetry, halfway between the two $x$-intercepts.'
        ],
        steps: [
          { h: 'The x-intercepts', d: `Put $y = 0$: $${fac(p)}${fac(q)} = 0$, so $x = ${p}$ and $x = ${q}$.` },
          { h: 'The y-intercept', d: `Put $x = 0$: $y = (${-p})(${-q}) = ${c}$.` },
          { h: 'The vertex', d: `The axis of symmetry is $x = \\dfrac{${p} + ${q < 0 ? `(${q})` : q}}{2} = ${m}$. Then $y = (${m - p})(${m - q}) = ${v}$. The coefficient of $x^2$ is positive, so the vertex $${pt(m, v)}$ is a minimum.` }
        ]
      });
    })
  },
  // y = a(x - h)^2 + k: the vertex is read off, the intercepts may not exist.
  {
    diffs: [2],
    make: rng => until(() => {
      const a = rc(rng, [1, 1, -1, -1, 2, -2]), h = nz(rng, -5, 5);
      const real = rng() < 0.55;
      let k, roots;
      if (real) {
        const w = ri(rng, 1, 4);
        if (w === Math.abs(h)) return null;
        k = -a * w * w;
        roots = [h - w, h + w];
      } else {
        k = a * ri(rng, 1, 5);
        roots = [];
      }
      const c = a * h * h + k;
      if (Math.abs(c) > MAX_Y || Math.abs(k) > MAX_Y) return null;
      const tex = `${lead(a)}(x ${sg(-h)})^2 ${sg(k)}`;
      const kind = a > 0 ? 'min' : 'max';
      const why = roots.length
        ? `Put $y = 0$: $(x ${sg(-h)})^2 = ${-k / a}$, so $x ${sg(-h)} = \\pm ${Math.sqrt(-k / a)}$ and $x = ${roots[0]}$ or $x = ${roots[1]}$.`
        : `Put $y = 0$: $(x ${sg(-h)})^2 = ${-k / a}$, which is negative, so there is no real solution and the curve never meets the $x$-axis.`;
      return sketch({
        prompt: `Sketch the parabola $y = ${tex}$. State its $x$-intercepts (if there are any), its $y$-intercept and its vertex.`,
        expression: `${a}*(x ${sg(-h)})^2 ${sg(k)}`,
        ask: ['xIntercepts', 'yIntercept', 'turning'],
        key: { intercepts: { x: roots, y: c }, turning: [{ x: h, y: k, kind }] },
        hints: [
          'The equation is in the form $y = a(x - h)^2 + k$, so the vertex can be read from it directly.',
          'The $y$-intercept is the value of $y$ when $x = 0$.',
          'For the $x$-intercepts put $y = 0$ and ask whether $(x - h)^2$ can equal that value.'
        ],
        steps: [
          { h: 'The vertex', d: `The form $y = a(x - h)^2 + k$ has its vertex at $(h, k)$, so the vertex is $${pt(h, k)}$. Since $a ${a > 0 ? '>' : '<'} 0$ it is a ${nature(kind)}.` },
          { h: 'The y-intercept', d: `Put $x = 0$: $y = ${lead(a)}(${-h})^2 ${sg(k)} = ${c}$.` },
          { h: 'The x-intercepts', d: why }
        ]
      });
    })
  },
  // y = a(x - p)(x - q) with a other than 1: opens up or down.
  {
    diffs: [2],
    make: rng => until(() => {
      const a = rc(rng, [-1, -1, -2, 2, 3, -3]);
      const p = nz(rng, -4, 4), q = nz(rng, -4, 4);
      if (q <= p || (p + q) % 2 !== 0) return null;
      const m = (p + q) / 2, v = a * (m - p) * (m - q), c = a * p * q;
      if (Math.abs(c) > MAX_Y || Math.abs(v) > MAX_Y || m === 0) return null;
      const kind = a > 0 ? 'min' : 'max';
      return sketch({
        prompt: `Sketch the parabola $y = ${lead(a)}${fac(p)}${fac(q)}$. State its $x$-intercepts, its $y$-intercept and its turning point.`,
        expression: `${a}*${fac(p)}*${fac(q)}`,
        ask: ['xIntercepts', 'yIntercept', 'turning'],
        key: { intercepts: { x: [p, q], y: c }, turning: [{ x: m, y: v, kind }] },
        hints: [
          'The $x$-intercepts are where $y = 0$: set each bracket equal to zero.',
          'The $y$-intercept is the value of $y$ when $x = 0$. The number in front of the brackets multiplies the whole product.',
          'The turning point is on the axis of symmetry, halfway between the $x$-intercepts. The sign of the number in front decides whether it is a maximum or a minimum.'
        ],
        steps: [
          { h: 'The x-intercepts', d: `Put $y = 0$: $x = ${p}$ or $x = ${q}$.` },
          { h: 'The y-intercept', d: `Put $x = 0$: $y = ${a}(${-p})(${-q}) = ${c}$.` },
          { h: 'The turning point', d: `The axis of symmetry is $x = ${m}$, halfway between $${p}$ and $${q}$. Then $y = ${a}(${m - p})(${m - q}) = ${v}$. Since $a ${a > 0 ? '>' : '<'} 0$ the turning point $${pt(m, v)}$ is a ${nature(kind)}.` }
        ]
      });
    })
  }
];

// ═════════════════════════════════════════════════════════════════════════════
// y12-appdiff (stationary points and their nature)
// ═════════════════════════════════════════════════════════════════════════════
const CUBIC_SKETCH = [
  // y = s(x - a)^2 (x - b), b - a = +-3: a touching root and a second stationary point.
  {
    diffs: [2, 3],
    make: rng => until(() => {
      const s = rc(rng, [1, 1, -1]), a = nz(rng, -3, 3), b = a + rc(rng, [-3, 3]);
      if (b === 0 || Math.abs(a * a * b) > MAX_Y) return null;
      const c = (a + 2 * b) / 3;                       // the second stationary point: f'(x) = s(x - a)(3x - a - 2b)
      const f = x => s * (x - a) * (x - a) * (x - b);
      const yc = f(c), y0 = f(0);
      // Just left of x = a the curve rises if s(x - b) > 0 there: a is a maximum when s(a - b) < 0.
      const kindA = s * (a - b) < 0 ? 'max' : 'min';
      const kindC = kindA === 'max' ? 'min' : 'max';
      const turning = [{ x: a, y: 0, kind: kindA }, { x: c, y: yc, kind: kindC }].sort((u, w) => u.x - w.x);
      if (Math.abs(yc) > MAX_Y || !Number.isInteger(c)) return null;
      const expr = `${s === -1 ? '-' : ''}(x ${sg(-a)})^2(x ${sg(-b)})`;
      return sketch({
        prompt: `Sketch the curve $y = ${expr}$. State its $x$-intercepts, its $y$-intercept and its stationary points, and whether each stationary point is a maximum or a minimum.`,
        expression: `${s}*(x ${sg(-a)})^2*(x ${sg(-b)})`,
        ask: ['xIntercepts', 'yIntercept', 'turning'],
        key: { intercepts: { x: [...new Set([a, b])].sort((u, w) => u - w), y: y0 }, turning },
        hints: [
          'The $x$-intercepts are where $y = 0$. A squared factor gives a root where the curve touches the axis and turns back.',
          'At a stationary point $\\dfrac{dy}{dx} = 0$. Use the product rule, or expand first.',
          'To find the nature of each stationary point, check the sign of $\\dfrac{dy}{dx}$ either side of it, or the sign of $\\dfrac{d^2y}{dx^2}$.'
        ],
        steps: [
          { h: 'The x-intercepts', d: `Put $y = 0$: $x = ${a}$ (a touching root, from the squared factor) or $x = ${b}$.` },
          { h: 'The y-intercept', d: `Put $x = 0$: $y = ${y0}$.` },
          { h: 'The stationary points', d: `$\\dfrac{dy}{dx} = 0$ at $x = ${a}$ and at $x = ${c}$. At $x = ${a}$, $y = 0$; at $x = ${c}$, $y = ${yc}$.` },
          { h: 'Their nature', d: `The point $${pt(a, 0)}$ is a ${nature(kindA)} and the point $${pt(c, yc)}$ is a ${nature(kindC)}, found from the sign of $\\dfrac{dy}{dx}$ either side of each.` }
        ]
      });
    })
  },
  // y = a x^3 + bx^2 + cx + d with stationary points at integers: y-intercept and turning points.
  {
    diffs: [3],
    make: rng => until(() => {
      const s = rc(rng, [1, 1, -1]), s1 = ri(rng, -2, 1), s2 = s1 + rc(rng, [2, 2, 4]);
      if (s2 > 3) return null;
      const d = ri(rng, -3, 3);
      const B = -3 * s * (s1 + s2) / 2, C = 3 * s * s1 * s2;
      const f = x => s * x * x * x + B * x * x + C * x + d;
      const y1 = f(s1), y2 = f(s2);
      if (Math.abs(y1) > MAX_Y || Math.abs(y2) > MAX_Y || !Number.isInteger(B) || y1 === y2) return null;
      // f'(x) = 3s(x - s1)(x - s2): for s = 1 the first stationary point is a maximum.
      const k1 = s > 0 ? 'max' : 'min', k2 = s > 0 ? 'min' : 'max';
      const tex = poly([s, B, C, d]);
      return sketch({
        prompt: `Find the stationary points of $y = ${tex}$ and determine their nature. Sketch the curve, stating its $y$-intercept and its stationary points.`,
        expression: `${s}*x^3 ${sg(B)}*x^2 ${sg(C)}*x ${sg(d)}`,
        ask: ['yIntercept', 'turning'],
        key: { intercepts: { y: d }, turning: [{ x: s1, y: y1, kind: k1 }, { x: s2, y: y2, kind: k2 }] },
        hints: [
          'Differentiate, then solve $\\dfrac{dy}{dx} = 0$ for the $x$-values of the stationary points.',
          'Substitute each $x$-value into the original equation to find its $y$-value.',
          'Use the sign of $\\dfrac{d^2y}{dx^2}$ at each point: positive is a minimum, negative is a maximum.'
        ],
        steps: [
          { h: 'Differentiate', d: `$\\dfrac{dy}{dx} = ${poly([3 * s, 2 * B, C])}$, which factorises as $${lead(3 * s)}${fx(s1)}${fx(s2)}$.` },
          { h: 'The stationary points', d: `$\\dfrac{dy}{dx} = 0$ at $x = ${s1}$ and $x = ${s2}$, giving $y = ${y1}$ and $y = ${y2}$.` },
          { h: 'Their nature', d: `$\\dfrac{d^2y}{dx^2} = ${poly([6 * s, 2 * B])}$. At $x = ${s1}$ it is ${6 * s * s1 + 2 * B > 0 ? 'positive' : 'negative'}, so $${pt(s1, y1)}$ is a ${nature(k1)}; at $x = ${s2}$ it is ${6 * s * s2 + 2 * B > 0 ? 'positive' : 'negative'}, so $${pt(s2, y2)}$ is a ${nature(k2)}.` },
          { h: 'The y-intercept', d: `Put $x = 0$: $y = ${d}$.` }
        ]
      });
    })
  }
];

export const forms = {
  'y11-quadfunc': QUAD_SKETCH,
  'y12-appdiff': CUBIC_SKETCH
};
