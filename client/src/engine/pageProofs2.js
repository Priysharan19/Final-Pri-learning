// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the second page-proof pass: function values, implications, conditions, derivatives, closed-interval extremes, check lists, graph labels
// (26 November 2026, Prithagoras edition; owner rule: every line of working ticked or crossed with a reason)
//
// A real photo of a correct page ticked 3 lines of 21. The lines left unchecked were the ones that are only true OF THE QUESTION'S OWN FUNCTION:
// `v(2) = 12(2) - 3(2)^2 = 24 - 12 = 12`, `dv/dt = 12 - 6t`, `12 - 6t = 0 => t = 2`, `Set dv/dt = 0:`, `Check values of v at t = 0, 2, 4:`, the point
// label `(2, 12)` read off the sketch, the axis ticks of the sketch, and the conclusion `The maximum velocity is 12 m s^-1, obtained at t = 2`.
// Each is proved here from the prompt's function and domain, and from nothing else: never the answer, the solution, the hints or the traps
// (worldOf reads the prompt only). Pure, deterministic, no model.
//
//   1. function value      `v(2) = 12(2) - 3(2)^2 = 24 - 12 = 12`     every side comes to what the function gives there; a side that does not is the first false link
//   2. implication         `12 - 6t = 0 => t = 2` (also so, hence, therefore, the therefore sign, ->, a comma)   the right side is the COMPLETE solution set
//                          of the left equation (or the solutions inside the question's stated domain); a partial set is a note until the page supplies the rest
//   3. condition           `Set dv/dt = 0:`, `Let dy/dx = 0`, `For stationary points f'(x) = 0`, `when v = 0`   neutral: consistent with what the question asks
//   4. derivative          `dv/dt = 12 - 6t`, `v'(t) = ...`, `d/dt(12t - 3t^2) = ...`, `v'(2) = 0`   the real derivative (exact for a polynomial)
//   5. closed-interval extreme   `The maximum velocity is 12 m s^-1, obtained at t = 2`   the engine finds the extreme over the whole closed interval
//   6. check list          `Check values of v at t = 0, 2, 4:`   neutral when the list is exactly the endpoints and the stationary points
//   7. graph labels        a run of bare ticks and axis names is `figure-label` (neutral); a point label `(2, 12)` is ticked only if it is on the curve and in the domain
//
// Hard rules. A line it cannot prove stays exactly as it was (a note). A wrong value, a wrong link, a wrong root, a point off the curve or a value outside the
// domain is never ticked. The only cross is `witnessOf`, and only for a claim that is false by the question's own function (or, for an implication, by the
// equation on the same line): it names the first false link and the value the function gives. A page that sets the function letter again to something else
// is no longer judged by the question's function.
// ─────────────────────────────────────────────────────────────────────────────
import { evaluate, variablesOf, ambiguousForms } from './expr.js';
import { texToPlain } from './texToPlain.js';
import { clean, lead, astOf, constOf, worldOf, fitPoly, polyAt, polyD } from './pageProofs.js';

const close = (a, b, tol = 1e-9) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= tol * Math.max(1, Math.abs(a), Math.abs(b));
const NUMRE = String.raw`-?\d+(?:\.\d+)?(?:/\d+(?:\.\d+)?)?`;
const ARROW_SRC = String.raw`(?:⇒|⟹|=>|⟶|→|->|∴|\bso\b|\bhence\b|\btherefore\b|\bthus\b)`;
export const CLASS = Object.freeze({
  value: 'function-value', implication: 'equation-solved', condition: 'condition-stated', derivative: 'derivative-of-function',
  extremum: 'conclusion-extremum', checkList: 'check-values-list', figure: 'figure-label', point: 'point-on-curve'
});
/** The neutral (context) classes this pass gives: the page shows them as stated, never as a tick or a cross. */
export const NEUTRAL = Object.freeze(new Set([CLASS.condition, CLASS.checkList, CLASS.figure]));

const norm = t => clean(String(t ?? '')).replace(/[′’‘`´]/g, "'").replace(/[≤⩽]/g, '<=').replace(/[≥⩾]/g, '>=').replace(/\s+/g, ' ').trim();
const stripEnd = t => t.replace(/[.;,:]+$/, '').trim();
const fmt = x => { const r = Math.round(x * 1e6) / 1e6; return String(Object.is(r, -0) ? 0 : r); };
/** `12t-3t^(2)` as `12t − 3t²`: for a sentence the student reads. */
const pretty = s => String(s).replace(/\^\(\s*(-?\d+)\s*\)/g, '^$1').replace(/(?<=[\w)])\s*([+-])\s*(?=[\w(])/g, ' $1 ');
const show = s => pretty(s).replace(/\^2/g, '²').replace(/\^3/g, '³').replace(/ - /g, ' − ').replace(/(?<![\w)²³])-(?=\d)/g, '−');
const texOf = s => pretty(s).replace(/\^(-?\d+)/g, '^{$1}');

// ── the question's world: function, domain, task ─────────────────────────────
/** The prompt with its maths spans converted to plain text, and the spans themselves. */
function promptPlain(prompt) {
  const text = String(prompt ?? '').replace(/\\\$/g, '\u0001');
  const spans = [];
  let out = '', last = 0;
  for (const m of text.matchAll(/\$\$?([^$]+)\$\$?/g)) {
    let plain = m[1]; try { plain = texToPlain(m[1]) || m[1]; } catch { /* as written */ }
    spans.push(norm(plain));
    out += text.slice(last, m.index) + norm(plain); last = m.index + m[0].length;
  }
  out += text.slice(last);
  return { text: out.replace(/\*\*/g, '').replace(/\u0001/g, '$'), spans };
}

/** `0 <= t <= 4`, `t >= 0`, `1 < x < 5`, `x > 2`: the domain the prompt states for the variable v (a bound is null when not stated). null when none. */
export function domainOf(prompt, v) {
  const { spans, text } = promptPlain(prompt);
  const pieces = [...spans, ...text.split(/[;,]|\band\b|\bfor\b|\bwhere\b|\bwhen\b/i)].map(s => s.trim());
  let dom = null;
  const set = (side, val, closed) => { dom = dom || { lo: null, hi: null, loClosed: false, hiClosed: false }; if (side === 'lo') { dom.lo = val; dom.loClosed = closed; } else { dom.hi = val; dom.hiClosed = closed; } };
  const N = String.raw`(-?\d+(?:\.\d+)?)`;
  for (const p of pieces) {
    let m = new RegExp(String.raw`(?:^|[^<>=\w])${N}\s*(<=|<)\s*${v}\s*(<=|<)\s*${N}(?![\w.])`).exec(p);
    if (m) { set('lo', Number(m[1]), m[2] === '<='); set('hi', Number(m[4]), m[3] === '<='); continue; }
    m = new RegExp(String.raw`(?:^|[^<>=\w])${v}\s*(>=|>)\s*${N}(?![\w.])`).exec(p); if (m) { set('lo', Number(m[2]), m[1] === '>='); continue; }
    m = new RegExp(String.raw`(?:^|[^<>=\w])${v}\s*(<=|<)\s*${N}(?![\w.])`).exec(p); if (m) { set('hi', Number(m[2]), m[1] === '<='); continue; }
  }
  return dom;
}
const inDomain = (dom, a) => !dom || ((dom.lo === null || (dom.loClosed ? a >= dom.lo - 1e-12 : a > dom.lo)) && (dom.hi === null || (dom.hiClosed ? a <= dom.hi + 1e-12 : a < dom.hi)));

/** 'max' | 'min' | null: what the prompt asks for (both words, or neither, is null). */
export function taskOf(prompt) {
  const t = promptPlain(prompt).text.toLowerCase();
  const mx = /\b(?:maxim\w*|greatest|largest|highest|biggest|peak)\b/.test(t), mn = /\b(?:minim\w*|least|smallest|lowest|fewest)\b/.test(t);
  return mx && !mn ? 'max' : mn && !mx ? 'min' : null;
}

const TRIG = /\b(?:sin|cos|tan|sec|cosec|csc|cot|asin|acos|atan|arcsin|arccos|arctan)\b/;
const ABS_LIKE = /\b(?:abs|floor|ceil|sgn|sign|round)\b|\|/;
/** The question's world: its prompt text, task, and (when the prompt gives exactly one) its function with domain; `fn` is null otherwise. */
export function world2(q) {
  const text = promptPlain(q?.prompt).text;
  let fn = null;
  try {
    const w = worldOf(q);
    if (w && !ambiguousForms(w.expr).length && !ABS_LIKE.test(w.expr)) fn = { ...w, domain: domainOf(q?.prompt, w.v), trig: TRIG.test(w.expr), exprPlain: norm(w.expr) };
  } catch { fn = null; }
  return { fn, text, task: taskOf(q?.prompt), prompt: String(q?.prompt ?? ''), domainFor: v => (fn && fn.v === v ? fn.domain : domainOf(q?.prompt, v)) };
}

// ── numbers: exactness, rounding ─────────────────────────────────────────────
/** Is x a ratio p/q with q <= 1000 (to 1e-10)? Then the function value is exact and a different written value is wrong, not rounded. */
function isRational(x) {
  if (!Number.isFinite(x)) return false;
  for (let q = 1; q <= 1000; q++) { const p = Math.round(x * q); if (Math.abs(x - p / q) <= 1e-10 * Math.max(1, Math.abs(x))) return true; }
  return false;
}
/** A constant written as text, the number e allowed (`100e^0`, `e^(0.5)`): its value, or null. constOf refuses any letter, so `e` is read here. */
function constVal(text) {
  const c = constOf(text);
  if (c !== null) return c;
  const t = clean(text).replace(/^\(\s*(.*)\s*\)$/, '$1');
  if (!/(?<![A-Za-z])e(?![A-Za-z])/.test(t) || /[A-Za-z]/.test(t.replace(/(?<![A-Za-z])e(?![A-Za-z])|\b(?:sqrt|pi)\b|π|√/g, ''))) return null;
  const a = astOf(t);
  if (!a || a.t === 'equation' || [...variablesOf(a)].some(x => x !== 'e')) return null;
  try { const v = evaluate(a, {}); return Number.isFinite(v) ? v : null; } catch { return null; }
}
const placesOf = s => { const m = /^-?\d*\.(\d+)$/.exec(String(s).replace(/\s+/g, '')); return m ? m[1].length : null; };
/** How a written side stands against the true value T: 'eq' | 'rounded' | 'near' (within one unit of its last place, which may be a truncation) | 'ne'. */
function against(sideText, s, T, tol) {
  if (close(s, T, tol)) return 'eq';
  const p = placesOf(clean(sideText).replace(/^\((.*)\)$/, '$1'));
  if (p !== null && p <= 8) {
    const u = 10 ** -p;
    // a value that is exact in decimals (11.25) is not 'rounded' by 11.3: that is a different number, left as a note, never ticked
    const terminating = [0, 1, 2, 3, 4, 5, 6, 7, 8].some(k => Math.abs(T * 10 ** k - Math.round(T * 10 ** k)) <= 1e-7);
    if (Math.abs(s - T) <= 0.5 * u * (1 + 1e-9)) return terminating ? 'near' : 'rounded';
    if (Math.abs(s - T) <= u * (1 + 1e-9)) return 'near';
  }
  return 'ne';
}

// ── all the real roots of a polynomial ───────────────────────────────────────
/** Real roots of the polynomial (coefficients low to high), sorted; null for the zero polynomial (every number is a root). */
export function realRoots(co) {
  const c = co.slice(); while (c.length > 1 && Math.abs(c[c.length - 1]) < 1e-12) c.pop();
  if (c.length < 2) return c.length === 1 && Math.abs(c[0]) < 1e-12 ? null : [];
  if (c.length === 2) return [-c[0] / c[1]];
  const R = 1 + Math.max(...c.slice(0, -1).map(Math.abs)) / Math.abs(c[c.length - 1]);
  const crit = realRoots(polyD(c));
  if (crit === null) return null;
  const P = x => polyAt(c, x);
  const cuts = [-R, ...crit.filter(x => x > -R && x < R).sort((a, b) => a - b), R];
  const roots = [];
  const scale = Math.max(1, ...c.map(Math.abs));
  for (const x of crit) if (Math.abs(P(x)) <= 1e-9 * scale * Math.max(1, Math.abs(x)) ** c.length) roots.push(x);   // a repeated root sits at a critical point
  for (let i = 0; i + 1 < cuts.length; i++) {
    let a = cuts[i], b = cuts[i + 1], fa = P(a);
    const fb = P(b);
    if (Math.abs(fa) <= 1e-12 * scale || Math.abs(fb) <= 1e-12 * scale || fa * fb > 0) continue;
    for (let k = 0; k < 200; k++) { const m = (a + b) / 2, fm = P(m); if (fa * fm <= 0) b = m; else { a = m; fa = fm; } if (b - a < 1e-15 * Math.max(1, Math.abs(a))) break; }
    roots.push((a + b) / 2);
  }
  roots.sort((x, y) => x - y);
  return roots.filter((x, i) => i === 0 || Math.abs(x - roots[i - 1]) > 1e-7 * Math.max(1, Math.abs(x)));
}

// ── the extreme of a smooth function over a closed interval ──────────────────
/** { value, at: [points where it is attained], stationary: [stationary points inside], ends: [lo, hi] } or null when the extreme cannot be proved. */
export function extremeOver(w, dom, kind) {
  if (!w || TRIG.test(w.expr) || !dom || dom.lo === null || dom.hi === null || !dom.loClosed || !dom.hiClosed || !(dom.lo < dom.hi)) return null;
  const { lo, hi } = dom;
  let stationary;
  if (w.dpoly) {
    const r = realRoots(w.dpoly);
    if (r === null) return null;
    stationary = r.filter(x => x >= lo - 1e-9 && x <= hi + 1e-9).map(x => Math.min(hi, Math.max(lo, x)));
  } else {
    // a smooth function that is not a polynomial: the derivative's sign changes on a fine grid, refined by bisection; the function must be finite and
    // continuous on the whole interval (no pole), which a division by a letter or a tangent would break, so those are refused
    if (/\/\s*[^\s\d(]|\/\s*\(\s*[^)]*[A-Za-z]/.test(w.expr) || /\b(?:tan|cot|sec|cosec|csc|ln|log)\b/.test(w.expr)) return null;
    const N = 4000, xs = Array.from({ length: N + 1 }, (_, i) => lo + (hi - lo) * i / N), g = x => w.d1(x);
    if (xs.some(x => !Number.isFinite(w.f(x)))) return null;
    stationary = [];
    for (let i = 0; i < N; i++) {
      let a = xs[i], b = xs[i + 1], ga = g(a);
      const gb = g(b);
      if (!Number.isFinite(ga) || !Number.isFinite(gb)) return null;
      if (ga === 0) stationary.push(a);
      if (ga * gb < 0) { for (let k = 0; k < 100; k++) { const m = (a + b) / 2, gm = g(m); if (ga * gm <= 0) b = m; else { a = m; ga = gm; } } stationary.push((a + b) / 2); }
    }
  }
  const cand = [...new Set([lo, hi, ...stationary].map(x => Math.round(x * 1e12) / 1e12))];
  const vals = cand.map(x => ({ x, y: w.f(x) }));
  if (vals.some(p => !Number.isFinite(p.y))) return null;
  const best = kind === 'max' ? Math.max(...vals.map(p => p.y)) : Math.min(...vals.map(p => p.y));
  const at = vals.filter(p => close(p.y, best, 1e-9)).map(p => p.x);
  return { value: best, at, stationary: [...new Set(stationary.map(x => Math.round(x * 1e9) / 1e9))].sort((a, b) => a - b), ends: [lo, hi], all: vals };
}

// ── what the page has set again ──────────────────────────────────────────────
/** Does this line set the function letter to something other than the question's function? `v(t) = 5t`, `v = t^2`; never `v(2) = ...` or `dv/dt = ...`. */
function redefines(text, w) {
  const t = stripEnd(lead(norm(text)));
  if (/[<>:]|=>|->|⇒|→/.test(t)) return false;
  const m = new RegExp(String.raw`^${w.name}\s*(?:\(\s*${w.v}\s*\))?\s*=\s*(.+)$`).exec(t);
  if (!m) return false;
  const first = m[1].split('=')[0].trim();
  if (!new RegExp(String.raw`(?<![A-Za-z])${w.v}(?![A-Za-z])`).test(first)) return false;     // no variable on the right: a value, not a definition
  const a = astOf(first);
  if (!a || a.t === 'equation') return true;                                                     // cannot be read: the function is treated as set again
  const free = [...variablesOf(a)].filter(x => x !== 'e');
  if (free.some(x => x !== w.v)) return true;
  for (const x of [-3.1, -1.7, 0.4, 1.3, 2.2, 3.7, 5.1]) { let g; try { g = evaluate(a, { [w.v]: x }); } catch { g = NaN; } if (!close(g, w.f(x), 1e-9)) return true; }
  return false;
}
/** The first line index at or after which the question's function is no longer the page's function (Infinity when it never is). */
function redefinedAt(texts, fn) {
  if (!fn) return Infinity;
  for (let i = 0; i < texts.length; i++) if (redefines(texts[i], fn)) return i;
  return Infinity;
}

// ── labels ───────────────────────────────────────────────────────────────────
/** `v(2)` → { kind:'y', a:2 }, `v'(2)` → d1, `v''(2)` → d2; `v(t)`/`v` → y with a = null; `dv/dt`, `v'(t)`, `d/dt(v)` → d1 symbolic; `d2v/dt2`, `v''` → d2. */
function labelOf2(raw, w) {
  const t = norm(raw).replace(/\s+/g, '');
  const n = w.name, v = w.v;
  if (t === n || t === `${n}(${v})`) return { kind: 'y', a: null };
  if (t === `d${n}/d${v}` || t === `${n}'` || t === `${n}'(${v})` || t === `d/d${v}(${n})` || t === `d/d${v}(${n}(${v}))`) return { kind: 'd1', a: null };
  if (new RegExp(`^d\\^?2${n}/d${v}\\^?2$`).test(t) || t === `${n}''` || t === `${n}''(${v})` || t === `d^2/d${v}^2(${n})`) return { kind: 'd2', a: null };
  let m = new RegExp(`^${n}\\((.+)\\)$`).exec(t);
  if (m && m[1] !== v) { const a = constOf(m[1]); if (a !== null) return { kind: 'y', a }; }
  m = new RegExp(`^${n}'\\((.+)\\)$`).exec(t);
  if (m && m[1] !== v) { const a = constOf(m[1]); if (a !== null) return { kind: 'd1', a }; }
  m = new RegExp(`^${n}''\\((.+)\\)$`).exec(t);
  if (m && m[1] !== v) { const a = constOf(m[1]); if (a !== null) return { kind: 'd2', a }; }
  return null;
}
const truthAt = (w, kind, a) => (kind === 'y' ? w.f(a) : kind === 'd1' ? w.d1(a) : w.d2(a));
const tolOf = (w, kind) => (kind === 'y' || w.poly ? 1e-9 : 1e-6);
const SAMPLE = [-3.1, -1.7, -0.6, 0.4, 1.3, 2.2, 3.7, 5.1, 6.3, 7.9];

/** An expression in the variable v alone: its AST, or null. */
function exprIn(text, v) {
  const a = astOf(text);
  if (!a || a.t === 'equation') return null;
  if (ambiguousForms(clean(text)).length) return null;
  const free = [...variablesOf(a)].filter(x => x !== 'e');
  if (free.some(x => x !== v)) return null;
  return a;
}
const valueAt = (ast, v, x) => { try { const r = evaluate(ast, { [v]: x }); return Number.isFinite(r) ? r : NaN; } catch { return NaN; } };

// ── 1. function value ────────────────────────────────────────────────────────
/**
 * `v(2) = 12(2) - 3(2)^2 = 24 - 12 = 12`  →  { verdict: 'true' | 'false' | 'unsure' | 'outside', ... } or null (not a function-value line).
 * `false` carries `index` (the side, counted after the label, that is the first false link), `got` and `truth`.
 */
export function functionValue(w, text) {
  const t = stripEnd(lead(norm(text)));
  if (/[<>≠≈:⇒→]|=>|->/.test(t) || !t.includes('=')) return null;
  const parts = t.split('=').map(s => s.trim());
  if (parts.length < 2 || parts.some(p => !p)) return null;
  const label = labelOf2(parts[0], w);
  if (!label || label.a === null) return null;
  const sides = parts.slice(1);
  const vals = sides.map(s => constVal(s));
  if (vals.some(x => x === null) || sides.some(s => ambiguousForms(clean(s)).length)) return null;
  if (w.trig && label.kind === 'y' && !sides.concat(parts[0]).some(s => /π|\bpi\b/i.test(s))) return { verdict: 'unsure', why: 'trig-unit' };
  if (!inDomain(w.domain, label.a)) return { verdict: 'outside', label };
  const T = truthAt(w, label.kind, label.a);
  if (!Number.isFinite(T)) return null;
  const tol = tolOf(w, label.kind);
  let rounded = false, near = false;
  for (let k = 0; k < sides.length; k++) {
    const r = against(sides[k], vals[k], T, tol);
    if (r === 'rounded') rounded = true;
    else if (r === 'near') near = true;
    else if (r === 'ne') return { verdict: 'false', index: k, got: vals[k], truth: T, label, sideText: sides[k], exact: isRational(T) };
  }
  if (near) return { verdict: 'unsure', why: 'near-rounding' };
  return { verdict: 'true', label, truth: T, rounded, sides };
}

function valueNote(w, r) {
  const l = r.label;
  const what = l.kind === 'y' ? `${w.name}(${fmt(l.a)})` : `${w.name}${l.kind === 'd1' ? "'" : "''"}(${fmt(l.a)})`;
  const ofWhat = l.kind === 'y' ? `${w.name}(${w.v}) = ${show(w.exprPlain)}` : `the ${l.kind === 'd1' ? '' : 'second '}derivative of ${w.name}(${w.v}) = ${show(w.exprPlain)}`;
  return `Correct: for ${ofWhat}, ${what} = ${fmt(r.truth)}, and every expression on this line comes to ${fmt(r.truth)}${r.rounded ? ' (the decimal is that value rounded)' : ''}.`;
}

// ── 2. implication ───────────────────────────────────────────────────────────
const SOLN_SPLIT = /\s*(?:\bor\b|\band\b|,|;|&)\s*/i;
/** `t = 2`, `t = 2 or t = 4`, `t = 2, 4`, `t = 2, t = 4`, `t = ±2`: { v, vals[] } or null. */
function solutionList(text) {
  const t = stripEnd(norm(text).replace(/^(?:so|hence|therefore|thus|∴)\s*:?\s*/i, ''));
  const lead1 = /^([a-z])\s*=\s*(.+)$/.exec(t);
  if (!lead1) return null;
  const v = lead1[1], vals = [];
  const pm = /^±\s*(.+)$/.exec(lead1[2].trim());
  const flat = (pm ? pm[1] : lead1[2]).split(SOLN_SPLIT).map(p => p.trim()).filter(Boolean);
  for (const p of flat) {
    const m = new RegExp(`^(?:${v}\\s*=\\s*)?(.+)$`).exec(p);
    if (!m) return null;
    const x = constOf(m[1]);
    if (x === null) return null;
    vals.push(x);
    if (pm) vals.push(-x);
  }
  if (!vals.length) return null;
  return { v, vals: [...new Set(vals.map(x => Math.round(x * 1e12) / 1e12))].sort((a, b) => a - b) };
}
/** Split `E1 <arrow> E2`: [E1, E2] or null. A comma joins them only when the part after it starts `v =`. */
function splitImplication(text) {
  const t = stripEnd(norm(text));
  let m = new RegExp(String.raw`^(.*?=.*?)\s*,?\s*${ARROW_SRC}\s*:?\s*(.+)$`, 'i').exec(t);
  if (m && m[2].includes('=') && !new RegExp(ARROW_SRC, 'i').test(m[2])) return [m[1].trim(), m[2].trim()];
  m = /^(.*?=.*?[^,\s])\s*,\s*([a-z]\s*=\s*.+)$/.exec(t);
  if (m) return [m[1].trim(), m[2].trim()];
  return null;
}

/** The equation of a left side: { v, co (coefficients of L - R), label } for a polynomial equation in one letter, else null. */
function equationOf(fn, leftText) {
  const parts = leftText.split('=').map(s => s.trim());
  if (parts.some(p => !p) || parts.length < 2 || parts.length > 3) return null;
  let label = null;
  const L = parts[parts.length - 2], R = parts[parts.length - 1];
  if (parts.length === 3) {
    // `dv/dt = 12 - 6t = 0`: the first side names the derivative of the question's function, and the middle side must be it
    const lb = fn ? labelOf2(parts[0], fn) : null;
    if (!lb || lb.a !== null || lb.kind !== 'd1') return null;
    const dc = derivativeClaim(fn, `${parts[0]} = ${L}`);
    if (!dc || dc.verdict !== 'true') return null;
    label = lb;
  }
  const A = astOf(L), B = astOf(R);
  if (!A || !B || A.t === 'equation' || B.t === 'equation') return null;
  if (ambiguousForms(clean(L)).length || ambiguousForms(clean(R)).length) return null;
  const free = new Set([...variablesOf(A), ...variablesOf(B)]); free.delete('e');
  if (free.size !== 1) return null;
  const v = [...free][0];
  const co = fitPoly(x => valueAt(A, v, x) - valueAt(B, v, x));
  if (!co) return null;
  return { v, co, label, L, R };
}

/**
 * `12 - 6t = 0 => t = 2`  →  { verdict: 'complete' | 'partial' | 'wrong', ... } or null.
 *  complete: the stated values are exactly the real solutions (or exactly those inside the stated domain)
 *  partial:  every stated value is a solution but a solution is missing
 *  wrong:    a stated value is not a solution of the left equation
 */
export function implication(world, text) {
  const parts = splitImplication(text);
  if (!parts) return null;
  const eq = equationOf(world.fn, parts[0]);
  const sol = solutionList(parts[1]);
  if (!eq || !sol || sol.v !== eq.v) return null;
  const all = realRoots(eq.co);
  if (all === null) return null;
  const scale = Math.max(1, ...eq.co.map(Math.abs));
  const isRoot = x => Math.abs(polyAt(eq.co, x)) <= 1e-9 * scale * Math.max(1, Math.abs(x)) ** eq.co.length;
  const bad = sol.vals.filter(x => !isRoot(x));
  if (bad.length) return { verdict: 'wrong', bad: bad[0], vals: sol.vals, roots: all, eq, v: eq.v, label: eq.label, parts };
  const dom = world.domainFor(eq.v);
  const inDom = dom ? all.filter(x => inDomain(dom, x)) : all;
  const same = (A, B) => A.length === B.length && A.every((x, i) => close(x, B[i], 1e-9));
  const complete = same(sol.vals, all) || (!!dom && same(sol.vals, inDom) && sol.vals.every(x => inDomain(dom, x)));
  return { verdict: complete ? 'complete' : 'partial', vals: sol.vals, roots: all, inDom, eq, v: eq.v, label: eq.label, parts, restricted: !!dom && !same(inDom, all) };
}

// ── 3. condition ─────────────────────────────────────────────────────────────
const SET_WORD = /^(?:setting|set|let|put|putting|for|when|where|if|at|require|need|solve|so|then|now|hence|therefore|thus|we need|we set|we want|to find|to get|stationary points?|turning points?|occur|occurs|a|the|maximum|minimum|max|min|maxima|minima|point|points|value|values|both|stationary|turning)\b[\s,:]*/i;
/** `Set dv/dt = 0:`, `Let dy/dx = 0`, `For stationary points f'(x) = 0`, `when v = 0`: { kind: 'stationary' | 'zero' | 'second' } or null. */
function conditionOf(w, text) {
  let t = stripEnd(norm(text)).toLowerCase();
  for (let g = 0; g < 8; g++) { const m = SET_WORD.exec(t); if (!m || !m[0].trim()) break; t = t.slice(m[0].length); }
  const m = /^(.+?)\s*=\s*(?:0|zero)$/.exec(t);
  if (!m) return null;
  const lb = labelOf2(m[1], { ...w, name: w.name.toLowerCase() });
  if (!lb || lb.a !== null) return null;
  return { kind: lb.kind === 'd1' ? 'stationary' : lb.kind === 'd2' ? 'second' : 'zero' };
}
/** Is the condition one the question's own task calls for? */
function conditionFits(world, c) {
  const text = world.text.toLowerCase();
  if (c.kind === 'stationary') return /maxim|minim|stationary|turning|optimi|greatest|least|largest|smallest|highest|lowest|peak|extrem|\bmax\b|\bmin\b|\brest\b|instantaneous|\bbest\b/.test(text);
  if (c.kind === 'second') return /inflex|inflect|concav|nature|maxim|minim|acceleration|stationary|turning/.test(text);
  return /\brest\b|\bstops?\b|\bzero\b|intercept|\broots?\b|\bsolve\b|\bwhen\b|\bhits?\b|ground|reach|crosses|how long|\btime\b|at which|\bwhere\b/.test(text);
}

// ── 4. derivative ────────────────────────────────────────────────────────────
/** `dv/dt = 12 - 6t`, `v'(t) = ...`, `d/dt(12t - 3t^2) = 12 - 6t` → { verdict: 'true' | 'false' } or null (cannot be judged). */
export function derivativeClaim(w, text) {
  const t = stripEnd(lead(norm(text)));
  if (/[<>:]|=>|->|⇒|→/.test(t)) return null;
  const parts = t.split('=').map(s => s.trim());
  if (parts.length < 2 || parts.some(p => !p)) return null;
  const lb = labelOf2(parts[0], w);
  const rhs = parts.slice(1);
  let d, what, sample = SAMPLE;
  if (lb && lb.a === null && (lb.kind === 'd1' || lb.kind === 'd2')) {
    d = lb.kind === 'd1' ? w.d1 : w.d2; what = { kind: lb.kind };
    if (w.domain && w.domain.lo !== null && w.domain.hi !== null) sample = SAMPLE.map((_, i) => w.domain.lo + (w.domain.hi - w.domain.lo) * (i + 0.5) / SAMPLE.length);
  } else {
    // d/dt(expression) = ...: the derivative of the expression written, not of the question's function
    const m = new RegExp(String.raw`^d/d${w.v}\s*\((.+)\)$`).exec(parts[0]);
    if (!m) return null;
    const E = exprIn(m[1], w.v); if (!E) return null;
    const co = fitPoly(x => valueAt(E, w.v, x));
    d = co ? (x => polyAt(polyD(co), x)) : (x => { const h = 1e-2 * Math.max(1, Math.abs(x)); return (-valueAt(E, w.v, x + 2 * h) + 8 * valueAt(E, w.v, x + h) - 8 * valueAt(E, w.v, x - h) + valueAt(E, w.v, x - 2 * h)) / (12 * h); });
    what = { kind: 'expr', exact: !!co, expr: m[1] };
  }
  // `dv/dt = 12 - 6t = 0`: what follows the derivative's own expressions is a condition set on it (or a value at a point), not another claim about the derivative
  const varRe = new RegExp(String.raw`(?<![A-Za-z])${w.v}(?![A-Za-z])`);
  let take = 0; while (take < rhs.length && varRe.test(rhs[take])) take++;
  if (!take) return null;
  const asts = rhs.slice(0, take).map(s => exprIn(s, w.v));
  if (asts.some(a => !a)) return null;
  const exact = what.kind === 'expr' ? what.exact : !!w.poly;
  if (!exact && sample === SAMPLE) sample = [-1.7, -0.6, 0.4, 1.3, 2.2, 0.9, 0.2, 1.8, 2.6];     // a numerical derivative is only trusted near the origin, where its step error is far below the tolerance
  const tol = exact ? 1e-9 : 1e-6;
  let seen = 0, differ = 0;
  for (const x of sample) {
    const want = d(x);
    if (!Number.isFinite(want)) continue;
    let bad = false;
    for (const a of asts) { const got = valueAt(a, w.v, x); if (!Number.isFinite(got)) return null; if (!close(want, got, tol)) bad = true; }
    if (bad) differ++;
    seen++;
  }
  if (seen < (exact ? 5 : 4)) return null;
  if (differ === 0) return { verdict: 'true', what, trailing: rhs.length > take };
  // false only when the real derivative is exact (a polynomial) and the written one differs at every point tried: a numerical derivative is never the witness
  if (exact && differ >= seen) return { verdict: 'false', what };
  return null;
}

// ── 5. closed-interval extreme ───────────────────────────────────────────────
const NATURE = /\b(maxim(?:um|a)|max|greatest|largest|highest|biggest|minim(?:um|a)|min|least|smallest|lowest)\b/i;
const STOP = new Set(['is', 'at', 'when', 'and', 'which', 'so', 'the', 'occurs', 'obtained', 'reached', 'attained', 'found', 'where', 'for', 'in', 'of', 'then', 'hence', 'this', 'that', 'a', 'an', 'it', 'its', 'by', 'to', 'than', 'because', 'since', 'if', 'but', 'not', 'or']);
const GENERIC = new Set(['value', 'values', 'the', 'of', 'a', 'an', 'is', 'possible', 'overall', 'absolute', 'global', 'local', 'number', 'amount', 'level', 'point', 'for', 'in', 'this', 'function', 'curve', 'graph']);
const unitToken = tk => !STOP.has(tk.toLowerCase()) && (/^[A-Za-z]{1,9}\.?$/.test(tk) || /^[A-Za-z]{1,6}\^-?\d$/.test(tk) || /^[A-Za-z]{1,6}(?:²|³)$/.test(tk) || /^[A-Za-z]{1,6}(?:\/[A-Za-z]{1,6}(?:\^?[23²³])?)+$/.test(tk) || /^[A-Za-z]{1,6}\.[A-Za-z]{1,6}(?:\^-?\d)?$/.test(tk) || /^[°%$]$/.test(tk));
/** `The maximum velocity is 12 m s^-1, obtained at t = 2.` → { nature: 'max'|'min', value, at: number|null } or null. */
export function extremumClaim(world, text) {
  const w = world.fn;
  let t = stripEnd(norm(text).replace(/^(?:conclusion|answer|ans|therefore|hence|so|thus|∴)\s*[:.]?\s*/i, '').replace(/^(?:conclusion|answer)\s*[:.]?\s*/i, ''));
  t = t.replace(/\[\s*([^\]]*?)\s*\]/g, '$1').replace(/⁻¹/g, '^-1').replace(/\bm\s*s\^-1\b/g, 'm/s').replace(/\bm\s*s\^-2\b/g, 'm/s^2');
  const nm = NATURE.exec(t);
  if (!nm) return null;
  const nature = /^(?:max|greatest|largest|highest|biggest)/i.test(nm[1]) ? 'max' : 'min';
  let rest = t.slice(nm.index + nm[0].length).trim();
  // words between the nature and the verb: `maximum velocity`, `maximum value of v`, `minimum speed`
  const verb = /\b(?:is|are|equals|was)\b|=/.exec(rest);
  if (!verb) return null;
  const subject = rest.slice(0, verb.index).trim();
  if (subject.split(/\s+/).filter(Boolean).length > 6 || /\d/.test(subject.replace(new RegExp(`${w.name}\\(${w.v}\\)`), ''))) return null;
  // WHAT is the maximum of: `max = 21` may be the value or the place it is reached, and `min = -2` may be of another function, so a conclusion is read only
  // when it names the quantity: the function's own letter, or a word the question itself uses (`maximum velocity` under a question that asks for the maximum velocity)
  const named = subject.toLowerCase().split(/[^a-z0-9']+/).filter(x => x && !GENERIC.has(x));
  const words = new Set(world.text.toLowerCase().split(/[^a-z0-9']+/).filter(Boolean));
  const inPrompt = x => words.has(x) || words.has(x.replace(/s$/, '')) || words.has(`${x}s`);
  const asksValue = /\b(?:maxim(?:um|a)|greatest|largest|highest|biggest|minim(?:um|a)|least|smallest|lowest)\s+values?\b/i.test(world.text);
  if (named.length ? !named.every(x => x === w.name.toLowerCase() || inPrompt(x)) : !(asksValue && /\bvalues?\b/i.test(subject))) return null;
  rest = rest.slice(verb.index + verb[0].length).trim().replace(/^=\s*/, '');
  const num = new RegExp(String.raw`^(?:${w.name}\s*=\s*|${w.name}\(\s*${w.v}\s*\)\s*=\s*)?(${NUMRE})(?![\d.])\s*(.*)$`).exec(rest);
  if (!num) return null;
  const value = constVal(num[1]);
  if (value === null) return null;
  let tail = num[2].trim(), at = null;
  const am = new RegExp(String.raw`^(.*?)\s*[,;(]?\s*\b(?:obtained|reached|attained|occurs?|achieved|found|when|at|where)\b\s*(?:\b(?:at|when|for)\b\s*)?(?:${w.v}\s*=\s*)?(${NUMRE})\s*\)?\s*$`, 'i').exec(tail);
  if (am) { at = constOf(am[2]); if (at === null) return null; tail = am[1].trim(); }
  else if (/\b(?:at|when|obtained|occurs|reached|attained|achieved|where)\b/i.test(tail)) {
    // a place is mentioned but cannot be taken apart (the reader lost the end of the line: `obtained at t =`): the value alone is judged
    const cut = /^(.*?)\s*[,;(]?\s*\b(?:obtained|reached|attained|occurs?|achieved|found|when|at|where)\b.*$/i.exec(tail);
    if (!cut) return null;
    tail = cut[1].trim();
  }
  tail = tail.replace(/[,;.]+$/, '').trim();
  if (tail) { const toks = tail.split(/\s+/); if (toks.length > 4 || !toks.every(unitToken)) return null; }
  return { nature, value, valueText: num[1], at, unit: tail };
}
/** The verdict on a conclusion: 'true' | 'false' | 'note' (undecidable, or not what the question asks) with the engine's extreme. */
export function conclusionVerdict(world, claim) {
  const w = world.fn;
  if (world.task && claim.nature !== world.task) return { verdict: 'note', why: 'other-extreme' };
  const ex = extremeOver(w, w.domain, claim.nature);
  if (!ex) return { verdict: 'note', why: 'no-extreme' };
  const how = against(claim.valueText, claim.value, ex.value, w.poly ? 1e-9 : 1e-6);
  if (how === 'near') return { verdict: 'note', why: 'near-rounding', ex };
  if (how === 'ne') return { verdict: 'false', ex, claim, part: 'value' };
  if (claim.at !== null && !ex.at.some(x => close(x, claim.at, 1e-6))) return { verdict: 'false', ex, claim, part: 'place' };
  return { verdict: 'true', ex, claim, rounded: how === 'rounded' };
}

// ── 6. check list ────────────────────────────────────────────────────────────
/** `Check values of v at t = 0, 2, 4:` → the numbers listed, or null. */
function checkListOf(w, text) {
  const t = stripEnd(norm(text)).toLowerCase();
  const n = w.name.toLowerCase();
  const m = new RegExp(String.raw`^(?:now\s+|next\s+|then\s+)?(?:check|evaluate|calculate|compute|find|test|compare|work out|determine|list)\s+(?:the\s+)?(?:values?|function values?|heights?|velocit(?:y|ies)|speeds?|${n})?\s*(?:of\s+${n}(?:\(\s*${w.v}\s*\))?\s*)?(?:(?:at|when|for|with)\s+)?${w.v}\s*=\s*(.+)$`).exec(t);
  if (!m) return null;
  const nums = [];
  for (const part of m[1].split(/\s*(?:,|;|\band\b|\bor\b)\s*/)) { const p = part.trim().replace(new RegExp(`^${w.v}\\s*=\\s*`), ''); const x = constOf(p); if (x === null) return null; nums.push(x); }
  return nums.length ? [...new Set(nums.map(x => Math.round(x * 1e12) / 1e12))].sort((a, b) => a - b) : null;
}

// ── 7. figure labels ─────────────────────────────────────────────────────────
function pointLabel(text) {
  const t = clean(String(text ?? '')).replace(/[.;]+$/, '').trim();
  const m = new RegExp(String.raw`^\(\s*(${NUMRE})\s*,\s*(${NUMRE})\s*\)$`).exec(t);
  if (!m) return null;
  const a = constOf(m[1]), b = constOf(m[2]);
  return a === null || b === null ? null : { a, b };
}
/** The numbers a sketch of this question would mark: 0, the ends of the domain, the stationary points, and the function's value at each. */
function sketchValues(w) {
  const xs = new Set([0]);
  if (w.domain) { if (w.domain.lo !== null) xs.add(w.domain.lo); if (w.domain.hi !== null) xs.add(w.domain.hi); }
  if (w.dpoly) { const r = realRoots(w.dpoly); if (r) for (const x of r) if (inDomain(w.domain, x)) xs.add(Math.round(x * 1e9) / 1e9); }
  const all = new Set(xs);
  for (const x of xs) { const y = w.f(x); if (Number.isFinite(y)) all.add(Math.round(y * 1e9) / 1e9); }
  return all;
}
const tickOf = (t, w, vals) => { if (!/^-?\d+(?:\.\d+)?$/.test(t)) return false; const x = Number(t); return [...vals].some(v => close(v, x, 1e-9)); };
const axisOf = (t, w) => t.length === 1 && (t === w.name || t === w.v || t === 'O');
const labelLike = (text, w, vals) => { const t = clean(String(text ?? '')).replace(/[.;]+$/, '').trim(); return tickOf(t, w, vals) || axisOf(t, w) || !!pointLabel(t); };

// ── the pass ─────────────────────────────────────────────────────────────────
const tickLine = (l, cls, note, extra = {}) => ({ text: l.text, status: 'ok', state: 'arithmetic', note, valueChain: { rule: 'proved' }, fact: { kind: 'proved', proof: cls }, tickClass: cls, ...extra });
const neutralLine = (l, cls, note) => ({ text: l.text, status: 'note', state: 'unverified', unverified: true, context: true, note, tickClass: cls });
const UPGRADABLE = new Set(['arithmetic-chain', 'true-as-written', 'substitution-evaluated', 'labelled-substitution']);

/**
 * @param q      the question (only `prompt` is read)
 * @param lines  the report's lines, in order
 * @param limit  lines at or after this index are never touched (the first cross)
 * @param open   (l, i) => may this line take a new tick? Notes only.
 * @returns the new lines (the same array when nothing changed) and the number of lines that changed
 */
export function pageProofs2(q, lines, limit, open) {
  const world = world2(q);
  const fn = world.fn;
  const out = lines.slice();
  const texts = lines.map(l => String(l?.text ?? ''));
  const stop = Math.min(limit, lines.length, redefinedAt(texts, fn));      // from the line that sets the function again, nothing is judged by the question's function
  let n = 0;
  const candidate = i => { const l = lines[i]; return !!l && l.status === 'note' && open(l, i) && !l.unread && !l.unreadable; };
  const partial = [];                                                      // implication lines whose solution set is partial: { i, roots, vals, v }
  const vals = fn ? sketchValues(fn) : new Set();

  for (let i = 0; i < stop; i++) {
    const l = lines[i];
    if (!l) continue;
    const text = texts[i];
    // a tick the engine already gave to a function value keeps its status and gets the class that says what it proved
    if (l.status === 'ok') {
      if (fn && (!l.tickClass || UPGRADABLE.has(l.tickClass))) { let r = null; try { r = functionValue(fn, text); } catch { r = null; } if (r && r.verdict === 'true') { out[i] = { ...l, tickClass: CLASS.value }; n++; } }
      continue;
    }
    if (!candidate(i)) continue;
    const tries = [() => implicationLine(world, l, text, partial, i)];
    if (fn) tries.push(() => valueLine(fn, l, text), () => conditionLine(world, l, text), () => derivativeLine(fn, l, text), () => conclusionLine(world, l, text, texts, i), () => checkListLine(world, l, text), () => pointLine(fn, l, text));
    let res = null;
    for (const tr of tries) { try { res = tr(); } catch { res = null; } if (res) break; }
    if (res) { out[i] = res; n++; }
  }
  // the roots a later line states (`t = 2` alone) complete an earlier partial list
  for (const p of partial) {
    const later = texts.slice(p.i + 1, stop).map(t => solutionList(t)).filter(s => s && s.v === p.v).flatMap(s => s.vals);
    const have = [...p.vals, ...later].filter(x => p.roots.some(r => close(r, x, 1e-9)));
    const missing = p.roots.filter(r => !have.some(x => close(x, r, 1e-9)));
    if (!missing.length && candidate(p.i) && out[p.i] === lines[p.i]) { out[p.i] = tickLine(lines[p.i], CLASS.implication, `Correct: ${show(stripEnd(norm(p.parts[0])))} has the solutions ${p.roots.map(x => `${p.v} = ${fmt(x)}`).join(' and ')}; this line states ${p.vals.map(x => `${p.v} = ${fmt(x)}`).join(', ')} and a later line of the page states the rest.`); n++; }
  }
  // runs of graph labels (a bare tick or axis name is a label only beside another label)
  if (fn) {
    for (let i = 0; i < stop; i++) {
      if (out[i] !== lines[i] || !candidate(i) || !labelLike(texts[i], fn, vals) || pointLabel(texts[i])) continue;
      let a = i, b = i;
      while (a > 0 && a - 1 < stop && labelLike(texts[a - 1], fn, vals) && lines[a - 1]?.status !== 'break') a--;
      while (b + 1 < stop && labelLike(texts[b + 1], fn, vals)) b++;
      if (b - a + 1 < 2) continue;
      out[i] = neutralLine(lines[i], CLASS.figure, 'This is a label of the sketch (an axis name, or a mark at a key value); there is no step in it to check.'); n++;
    }
  }
  return { lines: n ? out : lines, n };
}

function valueLine(fn, l, text) {
  const r = functionValue(fn, text);
  if (!r || r.verdict !== 'true') return null;
  return tickLine(l, CLASS.value, valueNote(fn, r));
}
function implicationLine(world, l, text, partial, i) {
  const r = implication(world, text);
  if (!r || r.verdict === 'wrong') return null;
  if (r.verdict === 'partial') { partial.push({ i, roots: r.roots, vals: r.vals, v: r.v, parts: r.parts }); return null; }
  const eqText = show(stripEnd(norm(r.parts[0])));
  const set = r.vals.map(x => `${r.v} = ${fmt(x)}`).join(' or ');
  const count = r.roots.length === 1 ? 'exactly one solution' : r.roots.length === 0 ? 'no solution' : `exactly ${r.roots.length} solutions`;
  return tickLine(l, CLASS.implication, `Correct: ${eqText} has ${count}${r.restricted ? ' in the interval the question gives' : ''}, ${set}, and this line states ${r.restricted && r.vals.length !== r.roots.length ? 'that one' : 'all of them'}.`);
}
function conditionLine(world, l, text) {
  const c = conditionOf(world.fn, text);
  if (!c || !conditionFits(world, c)) return null;
  const why = c.kind === 'stationary' ? `the question asks for ${world.task === 'min' ? 'a minimum' : world.task === 'max' ? 'a maximum' : 'a greatest or least value'}, and that is found where the derivative is 0` : c.kind === 'second' ? 'the second derivative is the test the question calls for' : 'this is the condition the question asks about';
  return neutralLine(l, CLASS.condition, `A condition is stated, not a step to check: ${why}.`);
}
function derivativeLine(fn, l, text) {
  const r = derivativeClaim(fn, text);
  // a derivative followed by more `=` (`= 0`, `= 4`) says something else too (set to zero, or its value at a point): the derivative is right, but the line is not proved as a whole
  if (!r || r.verdict !== 'true' || r.trailing) return null;
  const nm = r.what.kind === 'expr' ? `the derivative of ${show(norm(r.what.expr))}` : `the ${r.what.kind === 'd2' ? 'second ' : ''}derivative of ${fn.name}(${fn.v}) = ${show(fn.exprPlain)}`;
  return tickLine(l, CLASS.derivative, `Correct: this is ${nm}, and it agrees at every value tried.`);
}
const showDomain = w => (w.domain ? `${fmt(w.domain.lo)} ${w.domain.loClosed ? '≤' : '<'} ${w.v} ${w.domain.hiClosed ? '≤' : '<'} ${fmt(w.domain.hi)}` : 'the domain');
function conclusionLine(world, l, text, texts, i) {
  const w = world.fn;
  const claim = extremumClaim(world, text);
  if (!claim) return null;
  const r = conclusionVerdict(world, claim);
  if (r.verdict !== 'true') return null;
  const ends = endpointFacts(w, texts, i, r.ex);
  const where = r.ex.at.map(x => `${w.v} = ${fmt(x)}`).join(' and ');
  return tickLine(l, CLASS.extremum, `Correct: over ${showDomain(w)} the ${claim.nature === 'max' ? 'maximum' : 'minimum'} of ${w.name}(${w.v}) = ${show(w.exprPlain)} is ${fmt(r.ex.value)}, reached at ${where}${claim.at !== null ? ', as this line says' : ''}.${r.rounded ? ' The value written is that maximum rounded.' : ''}${ends}`, { statedAnswer: fmt(claim.value) });
}
/** The endpoint values the student wrote, named only when the page wrote them (and they are right). */
function endpointFacts(w, texts, i, ex) {
  const got = [];
  for (const e of ex.ends) {
    for (let j = 0; j < i; j++) { const r = functionValue(w, texts[j]); if (r && r.verdict === 'true' && r.label.kind === 'y' && close(r.label.a, e, 1e-9)) { got.push(`${w.name}(${fmt(e)}) = ${fmt(r.truth)}`); break; } }
  }
  return got.length === ex.ends.length ? ` The endpoints give ${got.join(', ')}.` : '';
}
function checkListLine(world, l, text) {
  const w = world.fn;
  const nums = checkListOf(w, text);
  if (!nums || !w.domain || !world.task) return null;
  const ex = extremeOver(w, w.domain, world.task);
  if (!ex) return null;
  const want = [...new Set([...ex.ends, ...ex.stationary].map(x => Math.round(x * 1e9) / 1e9))].sort((a, b) => a - b);
  if (want.length !== nums.length || !want.every((x, k) => close(x, nums[k], 1e-9))) return null;
  return neutralLine(l, CLASS.checkList, `The values listed are the two ends of the interval and the stationary point${ex.stationary.length === 1 ? '' : 's'}, which is where the ${world.task === 'max' ? 'greatest' : 'least'} value of ${w.name}(${w.v}) can be; this line only names them.`);
}
function pointLine(w, l, text) {
  const p = pointLabel(text);
  if (!p || !inDomain(w.domain, p.a)) return null;
  const T = w.f(p.a);
  if (!Number.isFinite(T) || !close(T, p.b, 1e-9)) return null;
  if (w.trig && !isRational(T)) return null;
  return tickLine(l, CLASS.point, `Correct: ${w.name}(${fmt(p.a)}) = ${fmt(T)} for ${w.name}(${w.v}) = ${show(w.exprPlain)}, so (${fmt(p.a)}, ${fmt(p.b)}) is on the curve${w.domain ? ` and ${w.v} = ${fmt(p.a)} is inside ${showDomain(w)}` : ''}.`);
}

// ── the cross: the first claim that is false by the question's own function ──
/**
 * The first line of `texts` that states something false: a function value (the first false link of its chain, by the question's function), a solution
 * that does not solve the equation on the same line, a derivative that is not the derivative of the question's function, or a maximum/minimum over the
 * closed interval that is not. `skip(i)` names lines that must not be judged (a line the engine already ticked, or that follows a slip).
 * @returns { index, rule, message, corrected } or null
 */
export function witnessOf(q, texts, skip = () => false) {
  const world = world2(q);
  const fn = world.fn;
  const stop = Math.min(texts.length, redefinedAt(texts, fn));
  for (let i = 0; i < stop; i++) {
    if (skip(i)) continue;
    const text = String(texts[i] ?? '');
    let im = null;
    try { im = implication(world, text); } catch { im = null; }
    if (im && im.verdict === 'wrong') {
      const eq = show(stripEnd(norm(im.parts[0])));
      return { index: i, rule: 'implication', message: `$${im.v} = ${fmt(im.bad)}$ is not a solution of $${texOf(stripEnd(norm(im.parts[0])))}$: ${im.roots.length ? `the solution${im.roots.length === 1 ? ' is' : 's are'} ${im.roots.map(x => `$${im.v} = ${fmt(x)}$`).join(' and ')}` : `${eq} has no real solution`}.`, corrected: im.roots.length ? `${im.v} = ${im.roots.map(fmt).join(' or ')}` : null };
    }
    if (!fn) continue;
    let r = null;
    try { r = functionValue(fn, text); } catch { r = null; }
    if (r && r.verdict === 'false' && !fn.trig) {
      const l = r.label;
      const nm = l.kind === 'y' ? `${fn.name}(${fmt(l.a)})` : `${fn.name}${l.kind === 'd1' ? "'" : "''"}(${fmt(l.a)})`;
      return { index: i, rule: 'function-value', message: `With $${fn.name}(${fn.v}) = ${texOf(fn.exprPlain)}$ from the question, $${nm}$ comes to $${fmt(r.truth)}$, but this line gives $${fmt(r.got)}$.`, corrected: `${nm} = ${fmt(r.truth)}` };
    }
    let dc = null;
    try { dc = derivativeClaim(fn, text); } catch { dc = null; }
    if (dc && dc.verdict === 'false' && dc.what.kind === 'd1' && fn.dpoly) {
      const dtex = polyTex(fn.dpoly, fn.v);
      return { index: i, rule: 'derivative', message: `The derivative of $${fn.name}(${fn.v}) = ${texOf(fn.exprPlain)}$ is $${dtex}$, which is not what this line says.`, corrected: `d${fn.name}/d${fn.v} = ${dtex}` };
    }
    let cl = null;
    try { cl = extremumClaim(world, text); } catch { cl = null; }
    if (cl) {
      const v = conclusionVerdict(world, cl);
      if (v.verdict === 'false') {
        const nm = cl.nature === 'max' ? 'maximum' : 'minimum';
        return { index: i, rule: 'extremum', message: v.part === 'value' ? `Over ${showDomain(fn)} the ${nm} of $${fn.name}(${fn.v}) = ${texOf(fn.exprPlain)}$ is $${fmt(v.ex.value)}$, not $${fmt(cl.value)}$.` : `The ${nm} $${fmt(v.ex.value)}$ is reached at ${v.ex.at.map(x => `$${fn.v} = ${fmt(x)}$`).join(' and ')}, not at $${fn.v} = ${fmt(cl.at)}$.`, corrected: `${nm} = ${fmt(v.ex.value)}` };
      }
    }
  }
  return null;
}
function polyTex(co, v) {
  const parts = [];
  for (let k = co.length - 1; k >= 0; k--) { const c = Math.round(co[k] * 1e9) / 1e9; if (!c) continue; const a = Math.abs(c); parts.push({ neg: c < 0, body: k === 0 ? fmt(a) : `${a === 1 ? '' : fmt(a)}${v}${k === 1 ? '' : `^{${k}}`}` }); }
  if (!parts.length) return '0';
  return parts.map((p, i) => (i === 0 ? (p.neg ? '-' : '') + p.body : `${p.neg ? '-' : '+'} ${p.body}`)).join(' ');
}
