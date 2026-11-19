// Pri Learning · living formulas — the declarative specs
//
// A living formula is a typeset formula whose parameters a reader can drag, with a graph that
// redraws and a list of the graph's key features stated in words. This file is the DATA: one
// spec per formula, nothing about drawing. A spec is
//
//   id        the key of its strings: living.<id>.title and living.<id>.p.<param> (en and hi)
//   params    [{ id, symbol, min, max, step, def }]   every value is min + i·step, so the stops are exact
//   formula   [token]   how the formula is set: { tex } fixed maths, { p } a parameter shown as its
//             value ({ square: true } adds a ² after it), { sp } a signed parameter (its sign set
//             outside the slot: "+ 3", "− 3"; { neg: true } flips it, for x − h), { sup } a
//             parameter in the exponent, { supOf: [token] } a raised group of tokens
//   tex(p)    the whole formula with the current values, for the spoken reading
//   window    the fixed graph window (it never moves, so the curve is what moves); `equal` keeps
//             one scale on both axes where slope or roundness is the point
//   fn(p)     the curve as a function of x, or `polylines(p)` for a curve that is not one
//   emphasis  { param: [feature kinds] }  what the graph and the list light up while that symbol is hovered or focused
//   together  [[param, param]]  symbols that act on one feature and so light up together while one is dragged
//   features(p)  the key features: [{ kind, facts, marks }]. `facts` holds numbers only, the
//             sentence is the interface's (living.feat.<kind>). Computed here, by closed form and
//             exact rational arithmetic (engine/exact.js), never by a model, and re-derived by an
//             independent numerical route in client/test/living-formulas-check.mjs.
//
// Learning only: nothing here marks, hints, records an attempt or infers anything about the learner.
import { fraction } from '../engine/exact.js';

const SCALE = 4n; // every parameter stop is a multiple of 1/4, so it is an exact rational n/4
const q = v => BigInt(Math.round(v * 4));

/** The exact sign of b² − 4ac for stops that are multiples of 1/4: -1, 0 or 1 (BigInt arithmetic, no rounding). */
export function discriminantSign(a, b, c) {
  const A = q(a), B = q(b), C = q(c);
  const D = fraction(B * B - 4n * A * C, SCALE * SCALE);
  return D.n === 0n ? 0 : D.n > 0n ? 1 : -1;
}
/** The exact sign of r² − k² (the circle meeting an axis). */
export function squareGapSign(r, k) {
  const R = q(r), K = q(k);
  const D = fraction(R * R - K * K, SCALE * SCALE);
  return D.n === 0n ? 0 : D.n > 0n ? 1 : -1;
}
/** 2π/b as a multiple of π, exactly: b = n/4 → period = (8/n)π, reduced. Returns { n, d } so that period = (n/d)π. */
export function periodInPi(b) {
  return fraction(8n, q(b));
}


// ── Tidy display ────────────────────────────────────────────────────────────
// The formula is shown the way a person would write it: a multiplier of 1 is not written, a
// multiplier of −1 is a minus sign, an added 0 is left out, and (x − 0) is x. Display only: every
// parameter keeps its value and stays draggable in the controls list, and the spoken reading
// (`tex`) still states every value.
const T = tex => ({ tex });
const mult = (id, v) => (v === 1 ? [] : v === -1 ? [T('-')] : [{ p: id }]);
const add = (id, v, tok = { sp: id }) => (v === 0 ? [] : [tok]);

const pt = (shape, x, y) => ({ shape, x, y });
const vline = x => ({ shape: 'vline', x });
const hline = y => ({ shape: 'hline', y });

function frange(min, max, step, def, id, symbol) { return { id, symbol, min, max, step, def }; }

export const SPECS = [
  {
    id: 'quadratic',
    emphasis: { a: ['turnMin', 'turnMax', 'axis'], b: ['turnMin', 'turnMax', 'axis'], c: ['yInt'] },
    together: [['a', 'b']],
    params: [frange(-3, 3, 0.5, 1, 'a', 'a'), frange(-6, 6, 1, -2, 'b', 'b'), frange(-6, 6, 1, -3, 'c', 'c')],
    formula: [{ tex: 'y =' }, { p: 'a' }, { tex: 'x^2' }, { sp: 'b' }, { tex: 'x' }, { sp: 'c' }],
    tidy: ({ a, b, c }) => [T('y ='), ...mult('a', a), T('x^2'), ...(b === 0 ? [] : [{ sp: 'b' }, T('x')]), ...add('c', c)],
    tex: ({ a, b, c }) => `y = ${a}x^2 + (${b})x + (${c})`,
    window: { xMin: -6, xMax: 6, yMin: -10, yMax: 10 },
    fn: ({ a, b, c }) => x => a * x * x + b * x + c,
    features({ a, b, c }) {
      const out = [];
      if (a === 0) {
        out.push({ kind: 'notParabola', facts: {}, marks: [] });
      } else {
        const xv = -b / (2 * a), yv = a * xv * xv + b * xv + c;
        out.push({ kind: a > 0 ? 'turnMin' : 'turnMax', facts: { x: xv, y: yv }, marks: [pt('dot', xv, yv)] });
        out.push({ kind: 'axis', facts: { x: xv }, marks: [vline(xv)] });
      }
      const sign = a === 0 ? (b === 0 ? null : 1) : discriminantSign(a, b, c);
      if (sign === null) out.push({ kind: c === 0 ? 'rootsEvery' : 'rootsNone', facts: {}, marks: [] });
      else if (a === 0) { const r = -c / b; out.push({ kind: 'rootOne', facts: { x: r }, marks: [pt('ring', r, 0)] }); }
      else if (sign === 0) { const r = -b / (2 * a); out.push({ kind: 'rootTouch', facts: { x: r }, marks: [pt('ring', r, 0)] }); }
      else if (sign < 0) out.push({ kind: 'rootsNone', facts: {}, marks: [] });
      else {
        const s = Math.sqrt(b * b - 4 * a * c);
        const r1 = (-b - s) / (2 * a), r2 = (-b + s) / (2 * a);
        const [lo, hi] = r1 < r2 ? [r1, r2] : [r2, r1];
        out.push({ kind: 'rootsTwo', facts: { x1: lo, x2: hi }, marks: [pt('ring', lo, 0), pt('ring', hi, 0)] });
      }
      out.push({ kind: 'yInt', facts: { y: c }, marks: [pt('diamond', 0, c)] });
      return out;
    }
  },
  {
    id: 'vertex',
    emphasis: { a: ['turnMin', 'turnMax'], h: ['turnMin', 'turnMax', 'axis'], k: ['turnMin', 'turnMax'] },
    together: [['h', 'k']],
    params: [frange(-3, 3, 0.5, 1, 'a', 'a'), frange(-5, 5, 0.5, 2, 'h', 'h'), frange(-6, 6, 0.5, -3, 'k', 'k')],
    formula: [{ tex: 'y =' }, { p: 'a' }, { tex: '(x' }, { sp: 'h', neg: true }, { tex: ')^2' }, { sp: 'k' }],
    tidy: ({ a, h, k }) => [T('y ='), ...mult('a', a), ...(h === 0 ? [T('x^2')] : [T('(x'), { sp: 'h', neg: true }, T(')^2')]), ...add('k', k)],
    tex: ({ a, h, k }) => `y = ${a}(x - (${h}))^2 + (${k})`,
    window: { xMin: -6, xMax: 6, yMin: -10, yMax: 10 },
    fn: ({ a, h, k }) => x => a * (x - h) * (x - h) + k,
    features({ a, h, k }) {
      const out = [];
      if (a === 0) {
        out.push({ kind: 'notParabola', facts: {}, marks: [] });
        out.push({ kind: k === 0 ? 'rootsEvery' : 'rootsNone', facts: {}, marks: [] });
        out.push({ kind: 'yInt', facts: { y: k }, marks: [pt('diamond', 0, k)] });
        return out;
      }
      out.push({ kind: a > 0 ? 'turnMin' : 'turnMax', facts: { x: h, y: k }, marks: [pt('dot', h, k)] });
      out.push({ kind: 'axis', facts: { x: h }, marks: [vline(h)] });
      // −k/a is exact in quarters: its sign decides the roots
      const ratio = -k / a;
      if (ratio > 0) {
        const d = Math.sqrt(ratio);
        out.push({ kind: 'rootsTwo', facts: { x1: h - d, x2: h + d }, marks: [pt('ring', h - d, 0), pt('ring', h + d, 0)] });
      } else if (ratio === 0) out.push({ kind: 'rootTouch', facts: { x: h }, marks: [pt('ring', h, 0)] });
      else out.push({ kind: 'rootsNone', facts: {}, marks: [] });
      const y0 = a * h * h + k;
      out.push({ kind: 'yInt', facts: { y: y0 }, marks: [pt('diamond', 0, y0)] });
      return out;
    }
  },
  {
    id: 'line',
    emphasis: { m: ['slopeUp', 'slopeDown', 'slopeFlat', 'xInt'], c: ['yInt'] },
    together: [],
    params: [frange(-4, 4, 0.5, 1, 'm', 'm'), frange(-6, 6, 1, 2, 'c', 'c')],
    formula: [{ tex: 'y =' }, { p: 'm' }, { tex: 'x' }, { sp: 'c' }],
    tidy: ({ m, c }) => [T('y ='), ...(m === 0 ? [] : [...mult('m', m), T('x')]), ...(m === 0 ? [{ p: 'c' }] : add('c', c))],
    tex: ({ m, c }) => `y = ${m}x + (${c})`,
    window: { xMin: -8, xMax: 8, equal: true },
    fn: ({ m, c }) => x => m * x + c,
    features({ m, c }) {
      const out = [{ kind: m > 0 ? 'slopeUp' : m < 0 ? 'slopeDown' : 'slopeFlat', facts: { m }, marks: [] }];
      out.push({ kind: 'yInt', facts: { y: c }, marks: [pt('diamond', 0, c)] });
      if (m !== 0) out.push({ kind: 'xInt', facts: { x: -c / m }, marks: [pt('ring', -c / m, 0)] });
      else out.push({ kind: c === 0 ? 'rootsEvery' : 'rootsNone', facts: {}, marks: [] });
      return out;
    }
  },
  {
    id: 'sine',
    emphasis: { a: ['amplitude', 'range'], b: ['period'], c: ['shift', 'firstMax'], d: ['midline', 'range'] },
    together: [],
    params: [frange(-3, 3, 0.5, 2, 'a', 'a'), frange(0.5, 3, 0.5, 1, 'b', 'b'), frange(-3, 3, 0.5, 0, 'c', 'c'), frange(-3, 3, 1, 0, 'd', 'd')],
    formula: [{ tex: 'y =' }, { p: 'a' }, { tex: '\\sin\\big(' }, { p: 'b' }, { tex: '(x' }, { sp: 'c', neg: true }, { tex: ')\\big)' }, { sp: 'd' }],
    tidy: ({ a, b, c, d }) => [T('y ='), ...mult('a', a), ...(b === 1 && c === 0 ? [T('\\sin(x)')] : b === 1 ? [T('\\sin(x'), { sp: 'c', neg: true }, T(')')] : c === 0 ? [T('\\sin('), { p: 'b' }, T('x)')] : [T('\\sin\\big('), { p: 'b' }, T('(x'), { sp: 'c', neg: true }, T(')\\big)')]), ...add('d', d)],
    tex: ({ a, b, c, d }) => `y = ${a}\\sin(${b}(x - (${c}))) + (${d})`,
    window: { xMin: -7, xMax: 7, yMin: -7, yMax: 7 },
    fn: ({ a, b, c, d }) => x => a * Math.sin(b * (x - c)) + d,
    features({ a, b, c, d }) {
      const amp = Math.abs(a);
      const per = periodInPi(b); // exact multiple of π
      const periodValue = (Number(per.n) / Number(per.d)) * Math.PI;
      const out = [
        { kind: 'midline', facts: { y: d }, marks: [hline(d)] },
        { kind: 'amplitude', facts: { amp }, marks: [] },
        { kind: 'period', facts: { n: Number(per.n), d: Number(per.d), value: periodValue }, marks: [] }
      ];
      if (amp === 0) return [{ kind: 'flatSine', facts: { y: d }, marks: [hline(d)] }];
      out.push({ kind: 'range', facts: { max: d + amp, min: d - amp }, marks: [hline(d + amp), hline(d - amp)] });
      // The first maximum to the right of x = c is a quarter period on (a > 0), three quarters on (a < 0).
      const xMax = c + (a > 0 ? 0.25 : 0.75) * periodValue;
      out.push({ kind: 'shift', facts: { c }, marks: [pt('dot', c, d)] });
      // x = c + (pn/pd)π, exactly: a quarter period (a > 0) or three quarters (a < 0) of (n/d)π
      const reach = fraction(BigInt(per.n) * (a > 0 ? 1n : 3n), 4n * BigInt(per.d));
      out.push({ kind: 'firstMax', facts: { x: xMax, y: d + amp, c, pn: Number(reach.n), pd: Number(reach.d) }, marks: [pt('dot', xMax, d + amp)] });
      return out;
    }
  },
  {
    id: 'exponential',
    emphasis: { a: ['yInt'], b: ['grows', 'decays', 'asymH'] },
    together: [],
    params: [frange(-3, 3, 0.5, 1, 'a', 'a'), frange(0.25, 4, 0.25, 2, 'b', 'b')],
    formula: [{ tex: 'y =' }, { p: 'a' }, { tex: '\\cdot' }, { p: 'b' }, { sup: 'x' }],
    tex: ({ a, b }) => `y = ${a} \\cdot ${b}^{x}`,
    window: { xMin: -4, xMax: 4, yMin: -8, yMax: 8 },
    fn: ({ a, b }) => x => a * Math.pow(b, x),
    features({ a, b }) {
      if (a === 0) return [{ kind: 'zeroFn', facts: {}, marks: [] }];
      if (b === 1) return [{ kind: 'constantFn', facts: { y: a }, marks: [hline(a)] }];
      const out = [{ kind: b > 1 ? 'grows' : 'decays', facts: { b }, marks: [] }];
      out.push({ kind: 'yInt', facts: { y: a }, marks: [pt('diamond', 0, a)] });
      out.push({ kind: 'asymH', facts: { y: 0 }, marks: [hline(0)] });
      out.push({ kind: 'noXInt', facts: {}, marks: [] });
      return out;
    }
  },
  {
    id: 'logarithm',
    emphasis: { a: ['passes', 'xInt', 'rises', 'falls'], h: ['asymV', 'passes', 'xInt'], k: ['passes', 'xInt'] },
    together: [['h', 'k']],
    params: [frange(-3, 3, 0.5, 1, 'a', 'a'), frange(-3, 3, 1, 0, 'h', 'h'), frange(-4, 4, 1, 0, 'k', 'k')],
    formula: [{ tex: 'y =' }, { p: 'a' }, { tex: '\\log_2(x' }, { sp: 'h', neg: true }, { tex: ')' }, { sp: 'k' }],
    tex: ({ a, h, k }) => `y = ${a}\\log_2(x - (${h})) + (${k})`,
    window: { xMin: -5, xMax: 11, yMin: -7, yMax: 7 },
    fn: ({ a, h, k }) => x => (x > h ? a * Math.log2(x - h) + k : NaN),
    features({ a, h, k }) {
      if (a === 0) return [{ kind: 'zeroLog', facts: { y: k }, marks: [hline(k)] }];
      const xr = h + Math.pow(2, -k / a);
      return [
        { kind: 'asymV', facts: { x: h }, marks: [vline(h)] },
        { kind: 'xInt', facts: { x: xr }, marks: [pt('ring', xr, 0)] },
        { kind: 'passes', facts: { x: h + 1, y: k }, marks: [pt('dot', h + 1, k)] },
        { kind: a > 0 ? 'rises' : 'falls', facts: {}, marks: [] }
      ];
    }
  },
  {
    id: 'absolute',
    emphasis: { a: ['slopes', 'cornerMin', 'cornerMax'], h: ['cornerMin', 'cornerMax'], k: ['cornerMin', 'cornerMax'] },
    together: [['h', 'k']],
    params: [frange(-3, 3, 0.5, 1, 'a', 'a'), frange(-5, 5, 1, 2, 'h', 'h'), frange(-6, 6, 1, -1, 'k', 'k')],
    formula: [{ tex: 'y =' }, { p: 'a' }, { tex: '\\lvert x' }, { sp: 'h', neg: true }, { tex: '\\rvert' }, { sp: 'k' }],
    tex: ({ a, h, k }) => `y = ${a}\\left|x - (${h})\\right| + (${k})`,
    window: { xMin: -8, xMax: 8, yMin: -8, yMax: 8 },
    fn: ({ a, h, k }) => x => a * Math.abs(x - h) + k,
    features({ a, h, k }) {
      if (a === 0) return [{ kind: 'zeroAbs', facts: { y: k }, marks: [hline(k)] }, { kind: k === 0 ? 'rootsEvery' : 'rootsNone', facts: {}, marks: [] }, { kind: 'yInt', facts: { y: k }, marks: [pt('diamond', 0, k)] }];
      const out = [
        { kind: a > 0 ? 'cornerMin' : 'cornerMax', facts: { x: h, y: k }, marks: [pt('dot', h, k)] },
        { kind: 'slopes', facts: { m: Math.abs(a) }, marks: [] }
      ];
      const reach = -k / a;
      if (reach > 0) out.push({ kind: 'rootsTwo', facts: { x1: h - reach, x2: h + reach }, marks: [pt('ring', h - reach, 0), pt('ring', h + reach, 0)] });
      else if (reach === 0) out.push({ kind: 'rootTouch', facts: { x: h }, marks: [pt('ring', h, 0)] });
      else out.push({ kind: 'rootsNone', facts: {}, marks: [] });
      const y0 = a * Math.abs(h) + k;
      out.push({ kind: 'yInt', facts: { y: y0 }, marks: [pt('diamond', 0, y0)] });
      return out;
    }
  },
  {
    id: 'circle',
    emphasis: { h: ['centre', 'crossX', 'crossY'], k: ['centre', 'crossX', 'crossY'], r: ['radius', 'crossX', 'crossY'] },
    together: [['h', 'k']],
    params: [frange(-3, 3, 1, 1, 'h', 'h'), frange(-3, 3, 1, 1, 'k', 'k'), frange(1, 4, 0.5, 3, 'r', 'r')],
    formula: [{ tex: '(x' }, { sp: 'h', neg: true }, { tex: ')^2 + (y' }, { sp: 'k', neg: true }, { tex: ')^2 =' }, { p: 'r', square: true }],
    tex: ({ h, k, r }) => `(x - (${h}))^2 + (y - (${k}))^2 = ${r}^2`,
    window: { xMin: -8, xMax: 8, equal: true },
    polylines: ({ h, k, r }) => {
      const pts = [];
      for (let i = 0; i <= 240; i += 1) { const t = (i / 240) * 2 * Math.PI; pts.push([h + r * Math.cos(t), k + r * Math.sin(t)]); }
      return [pts];
    },
    features({ h, k, r }) {
      const out = [{ kind: 'centre', facts: { x: h, y: k }, marks: [pt('dot', h, k)] }, { kind: 'radius', facts: { r }, marks: [] }];
      // crossing the x-axis (y = 0): (x − h)² = r² − k²;  the y-axis (x = 0): (y − k)² = r² − h²
      const sx = squareGapSign(r, k);
      if (sx > 0) { const d = Math.sqrt(r * r - k * k); out.push({ kind: 'crossX', facts: { x1: h - d, x2: h + d }, marks: [pt('ring', h - d, 0), pt('ring', h + d, 0)] }); }
      else if (sx === 0) out.push({ kind: 'touchX', facts: { x: h }, marks: [pt('ring', h, 0)] });
      else out.push({ kind: 'missX', facts: {}, marks: [] });
      const sy = squareGapSign(r, h);
      if (sy > 0) { const d = Math.sqrt(r * r - h * h); out.push({ kind: 'crossY', facts: { y1: k - d, y2: k + d }, marks: [pt('diamond', 0, k - d), pt('diamond', 0, k + d)] }); }
      else if (sy === 0) out.push({ kind: 'touchY', facts: { y: k }, marks: [pt('diamond', 0, k)] });
      else out.push({ kind: 'missY', facts: {}, marks: [] });
      return out;
    }
  },
  {
    id: 'normal',
    emphasis: { mu: ['peak', 'inflect'], sigma: ['inflect', 'rule'] },
    together: [['mu', 'sigma']],
    params: [frange(40, 60, 1, 50, 'mu', 'μ'), frange(2, 8, 1, 5, 'sigma', 'σ')],
    formula: [{ tex: 'y = (1/(' }, { p: 'sigma' }, { tex: '\\sqrt{2\\pi}))\\,e' }, { supOf: [{ tex: '-(x-' }, { p: 'mu' }, { tex: ')^2/(2' }, { p: 'sigma', square: true }, { tex: ')' }] }],
    tex: ({ mu, sigma }) => `y = \\dfrac{1}{${sigma}\\sqrt{2\\pi}} e^{-\\frac{(x - ${mu})^2}{2\\cdot ${sigma}^2}}`,
    window: { xMin: 30, xMax: 70, yMin: 0, yMax: 0.22, noYAxis: true },
    fn: ({ mu, sigma }) => x => Math.exp(-((x - mu) ** 2) / (2 * sigma * sigma)) / (sigma * Math.sqrt(2 * Math.PI)),
    features({ mu, sigma }) {
      const top = 1 / (sigma * Math.sqrt(2 * Math.PI));
      const dens = x => Math.exp(-((x - mu) ** 2) / (2 * sigma * sigma)) / (sigma * Math.sqrt(2 * Math.PI));
      return [
        { kind: 'peak', facts: { x: mu, y: top, sigma }, marks: [pt('dot', mu, top), vline(mu)] },
        { kind: 'inflect', facts: { x1: mu - sigma, x2: mu + sigma }, marks: [pt('ring', mu - sigma, dens(mu - sigma)), pt('ring', mu + sigma, dens(mu + sigma))] },
        { kind: 'rule', facts: { lo1: mu - sigma, hi1: mu + sigma, lo2: mu - 2 * sigma, hi2: mu + 2 * sigma, lo3: mu - 3 * sigma, hi3: mu + 3 * sigma }, marks: [] }
      ];
    }
  }
];

export const SPEC_BY_ID = Object.freeze(Object.fromEntries(SPECS.map(s => [s.id, s])));
export const defaultsOf = spec => Object.fromEntries(spec.params.map(p => [p.id, p.def]));
/** The value at stop i (exact: stops are multiples of a power-of-two step). */
export const valueAt = (param, i) => Math.round((param.min + i * param.step) * 1e6) / 1e6 + 0;
export const stopsOf = param => Math.round((param.max - param.min) / param.step);
export const indexOf = (param, v) => Math.min(stopsOf(param), Math.max(0, Math.round((v - param.min) / param.step)));
