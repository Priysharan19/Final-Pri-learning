// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the third page-proof pass: exact-value chains (trigonometric, logarithmic, exponential, factorial and counting values)
// (27 November 2026, Prithagoras edition; owner rule: every line of working ticked or crossed with a reason, nothing left "not checked" on a correct page)
//
// The coverage measure (tools/annotation-coverage.mjs) shows what a correct page still leaves unchecked. The largest group of lines that CAN be proved from
// the line alone is a chain of exact values the arithmetic check refuses on purpose, because it cannot tell a degree from a radian or a base from a base:
//
//   sin(135°) = √2/2          cos(225°) = -√2/2          tan(300°) = -√3          4! = 24          (6C3) = 20
//   d² = 90000 + 40000 - 2(300)(200)cos(120°) = 190000          = 100 (a line that continues the value above it)
//
// A tick here says one thing: every value on the line comes to the same number, computed exactly (no rounding is read as equal). It does not say the line is
// the right step for the question, and it never ties a letter on the left to the question. Nothing is ever crossed by this pass, and nothing here reads the
// answer, the worked solution, the hints or the traps. Pure, deterministic, no model.
//
// Hard rules. A function of an angle is read only when the angle fixes its own unit: a degree sign, or a π in it (or the angle 0). A `log` is read only when the
// line is true as a base-10 log AND as a natural log (a ratio of logs); `ln` is natural. A line with a decimal that is a rounding of the value (0.7071 for √2/2)
// is not an equality here (the rounding class owns it). A line with a list, an inequality, a percent, an approximately sign or a unit is left alone. A side
// that is not a number is allowed only as a first, simple label (`d^2 =`, `A =`), and never as the value the chain is about.
// ─────────────────────────────────────────────────────────────────────────────
import { evaluate, variablesOf, normalize, parse, ambiguousForms } from './expr.js';
import { texToPlain } from './texToPlain.js';
import { clean, lead } from './pageProofs.js';

export const CLASS3 = Object.freeze({ exact: 'exact-value', binomial: 'binomial-coefficient' });

const MAX_CHARS = 160;
const REL = 1e-12;
const same = (a, b) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= REL * Math.max(1, Math.abs(a), Math.abs(b));
const TRIG = new Set(['sin', 'cos', 'tan', 'sec', 'cosec', 'csc', 'cot']);

/** Only the Prithagoras NSW Years 11-12 content: a generated form of y11, y12, me11, me12, or a part of the author's bank (A11, A12, X11, X12). */
export const australianQuestion = q => {
  if (!q || typeof q !== 'object') return false;
  if (typeof q._bank === 'string') return /^[AX](?:11|12)-/.test(q._bank);
  return typeof q.contentId === 'string' && /^gen:(?:y11|y12|me11|me12)-/.test(q.contentId);
};

const fmt = x => { const r = Math.round(x * 1e9) / 1e9; return String(Object.is(r, -0) ? 0 : r); };

// ── reading one side as a number ─────────────────────────────────────────────
/** Does a trigonometric function in the tree have an argument that fixes its unit (it holds π) or is it zero? */
function trigUnitsFixed(node) {
  let ok = true;
  const hasPi = n => !!n && typeof n === 'object' && (n.t === 'const' && n.v === 'pi' || ['l', 'r', 'v', 'arg'].some(k => hasPi(n[k])) || (Array.isArray(n.args) && n.args.some(hasPi)));
  const walk = n => {
    if (!n || typeof n !== 'object' || !ok) return;
    if (n.t === 'call' && TRIG.has(n.fn) && n.arg) {
      let v = NaN; try { v = evaluate(n.arg, {}); } catch { v = NaN; }
      if (!hasPi(n.arg) && v !== 0) { ok = false; return; }
    }
    for (const k of ['l', 'r', 'v', 'arg']) walk(n[k]);
    if (Array.isArray(n.args)) n.args.forEach(walk);
  };
  walk(node);
  return ok;
}
const DEG = /(\d+(?:\.\d+)?)\s*°/g;
/** The side as the engine's text: a degree is its radians. null when a degree sign is left over (a degree after a letter, a stray one). */
const radians = s => { const t = s.replace(DEG, '($1*pi/180)'); return /°/.test(t) ? null : t; };

/** { v, special } for a side that is a number (no letter but e and the named constants), or null. `special` = it uses a function the arithmetic check refuses. */
export function valueOfSide(raw, { logAsLn = false } = {}) {
  let t = String(raw ?? '').trim().replace(/^\((.*)\)$/, (m, inner) => (inner.includes('(') && !balanced(inner) ? m : `(${inner})`));
  if (!t || t.length > MAX_CHARS) return null;
  t = radians(t);
  if (t === null) return null;
  if (logAsLn) t = t.replace(/(?<![A-Za-z])log(?![A-Za-z_])/g, 'ln');
  let ast;
  try { if (ambiguousForms(t).length) return null; ast = parse(normalize(t)); } catch { return null; }
  if (!ast || ast.t === 'equation') return null;
  if ([...variablesOf(ast)].some(x => x !== 'e')) return null;
  if (!trigUnitsFixed(ast)) return null;
  let v;
  try { v = evaluate(ast, {}); } catch { return null; }
  if (!Number.isFinite(v) || Math.abs(v) > 1e12) return null;
  const special = /(?<![A-Za-z])(?:sin|cos|tan|sec|cosec|csc|cot|arcsin|arccos|arctan|ln|log|exp)\b|!|\d\s*C\s*\d|ncr|npr|\be\s*\^|°|π|\bpi\b/.test(t) || /\bsqrt\b|√/.test(t);
  return { v, special };
}
function balanced(s) { let d = 0; for (const c of s) { if (c === '(') d++; else if (c === ')') { d--; if (d < 0) return false; } } return d === 0; }

// a first side that only names a quantity: d^2, A, BD^2, cos θ, FQ, h
const LABEL = /^(?:[A-Za-zθ]{1,3}|[A-Z]\([A-Za-z]\))$/;   // letters only: a digit in a label (d^2, x_1) is part of what it claims, and a changed digit would change the claim, so it is never read here

/**
 * A chain of equal exact values: `label = side = side ...`, or a line that continues the one above (`= side ...`, with `above` the value the line above ended on).
 * @returns { value, special, labelled, cont } or null
 */
const SPECIAL = /(?<![A-Za-z])(?:sin|cos|tan|sec|cosec|csc|cot|arcsin|arccos|arctan|ln|log|exp)\b|!|\d\s*C\s*\d|ncr|npr|\be\s*\^|°|π|\bpi\b|\bsqrt\b|√/;
export function exactChain(text, above = null, aboveSpecial = false) {
  const t = lead(String(text ?? '')).replace(/[.]+$/, '').trim();
  if (!t || t.length > MAX_CHARS * 2 || /[<>≤≥≠≈≃~,;:%±⇒⟹→]|=>|->|\bor\b|\band\b/i.test(t) || /\s[A-Za-z]{3,}\s/.test(t)) return null;
  const parts = t.split('=').map(s => s.trim());
  if (parts.length < 2 || parts.length > 6) return null;
  const cont = parts[0] === '';
  if (cont) { if (above === null || parts.slice(1).some(p => !p)) return null; parts.shift(); }
  else if (parts.some(p => !p)) return null;
  const hasLog = /(?<![A-Za-z])log(?![A-Za-z_])/.test(t);
  const squash = s => s.replace(/\s+/g, '');
  let first = null, labelled = false, special = false;
  for (const logAsLn of hasLog ? [false, true] : [false]) {
    const vals = parts.map(p => valueOfSide(p, { logAsLn }));
    labelled = !cont && vals[0] === null;
    if (labelled && !LABEL.test(squash(parts[0]))) return null;
    const nums = labelled ? vals.slice(1) : vals;
    if (nums.some(x => x === null) || nums.length < (cont ? 1 : 2)) return null;
    const all = cont ? [{ v: above }, ...nums] : nums;
    if (!all.every(x => same(x.v, all[0].v))) return null;
    if (first !== null && !same(first, all[0].v)) return null;   // a log read as base 10 and as natural must give one value
    first = all[0].v;
    special = nums.some(x => x.special) || (cont && aboveSpecial);
  }
  const body = labelled ? parts.slice(1) : parts;
  if (!cont && new Set(body.map(squash)).size < 2) return null;   // sides that read the same say nothing
  if (!special) return null;
  return { value: first, special, labelled, cont };
}

/** The value a line ended on, when its last side is a number: `a = b = 5` gives 5. */
export function endValue(text) {
  const t = lead(String(text ?? '')).replace(/[.]+$/, '').trim();
  if (!t || /[<>≤≥≠≈≃~,;:%±⇒⟹→]|=>|->/.test(t)) return null;
  const parts = t.split('=').map(s => s.trim());
  const last = parts[parts.length - 1];
  if (!last) return null;
  const r = valueOfSide(last);
  return r ? r.v : null;
}

// ── equations: the line says what the line above says, or some of its solutions ─────────────────────────────────────────────
// `y' = 1 - 2cos x = 0  =>  cos x = 1/2`, `6^x = 393  =>  x ln 6 = ln 393`, `x = 3 (or x = 5)`: two equations in the SAME one letter, compared by their real
// solutions over -30 <= x <= 30 (found from sign changes and refined, each checked to be a root). Two classes, both proved by computing, never by a rule:
//   same-equation-as-line-above   every real solution of this line is one of the line above and the other way round (and there is at least one)
//   satisfies-equation-above      a line that states values of the letter (`x = 1/3, 5/3`, `cos x = -1`): every solution it gives, in the window, solves the line above
// A solution set that is empty, that touches zero without crossing (a repeated root) or that is found in no window is not read at all (a note).
const WINDOW = 30, GRID = 24000;
const unminus = t => clean(t).replace(DEG, '($1*pi/180)');
function equationOf(text) {
  const t = unminus(lead(String(text ?? ''))).replace(/[.]+$/, '').trim();
  if (!t || t.length > MAX_CHARS * 2 || /[<>≤≥≠≈≃~;:%±⇒⟹→∫]|=>|->|\]_|\bor\b|\band\b/i.test(t)) return null;
  if (/,/.test(t)) return null;
  const parts = t.split('=').map(x => x.trim());
  if (parts.length < 2 || parts.length > 3 || parts.some(x => !x)) return null;
  // `y' = E = 0` and `V''(t) = E = 0`: a label, then the equation E = 0
  const pair = parts.length === 3 ? [parts[1], parts[2]] : [parts[0], parts[1]];
  if (parts.length === 3 && !/^[A-Za-z][A-Za-z0-9_]*(?:'{1,2})?(?:\([A-Za-z]\))?$/.test(parts[0].replace(/\s+/g, '')) && !/^\(?d[A-Za-z]\)?\/?/.test(parts[0])) return null;
  let l, r;
  try { if (ambiguousForms(pair[0]).length || ambiguousForms(pair[1]).length) return null; l = parse(normalize(pair[0])); r = parse(normalize(pair[1])); } catch { return null; }
  if (l.t === 'equation' || r.t === 'equation') return null;
  const vs = [...new Set([...variablesOf(l), ...variablesOf(r)])].filter(x => x !== 'e');
  if (vs.length !== 1 || /^(?:pi|theta|alpha|beta)$/.test(vs[0]) && false) return null;
  if (!trigUnitsFixedOrVar(l) || !trigUnitsFixedOrVar(r)) return null;
  const v = vs[0];
  const f = x => { try { const y = evaluate(l, { [v]: x }) - evaluate(r, { [v]: x }); return Number.isFinite(y) ? y : NaN; } catch { return NaN; } };
  return { v, f, l, r, text: t };
}
// a trigonometric function of the one letter (sin x, cos 2x, tan θ) is read in radians, as every NSW Year 11-12 equation in x is: only a degree sign in the line changes that, and a degree sign was turned into radians above
const trigUnitsFixedOrVar = () => true;
function rootsOf(f, lo = -WINDOW, hi = WINDOW, grid = GRID) {
  const out = [];
  let px = lo, pv = f(px);
  for (let i = 1; i <= grid; i++) {
    const x = lo + ((hi - lo) * i) / grid, v = f(x);
    if (Number.isFinite(pv) && Number.isFinite(v)) {
      if (pv === 0) out.push(px);
      else if (pv * v < 0) {
        let a = px, b = x, fa = pv;
        for (let k = 0; k < 70; k++) { const m = (a + b) / 2, fm = f(m); if (!Number.isFinite(fm)) return null; if (fa * fm <= 0) b = m; else { a = m; fa = fm; } }
        const r = (a + b) / 2;
        if (Math.abs(f(r)) <= 1e-7 * Math.max(1, Math.abs(pv), Math.abs(v))) out.push(r);
      }
    }
    px = x; pv = v;
  }
  if (Number.isFinite(pv) && pv === 0 && !out.includes(px)) out.push(px);
  return out;
}
const rootLists = new Map();
const rootsCached = e => { if (!rootLists.has(e.text)) { if (rootLists.size > 400) rootLists.clear(); rootLists.set(e.text, rootsOf(e.f)); } return rootLists.get(e.text); };
const sameRoots = (a, b) => a.length === b.length && a.every((x, k) => Math.abs(x - b[k]) <= 1e-6 * Math.max(1, Math.abs(x)));
/** 'same' | 'satisfies' | null: how the line's equation stands to the equation above it. */
export function equationRelation(above, line) {
  const A = equationOf(above), B = equationOf(line);
  if (!A || !B || A.v !== B.v) return null;
  const ra = rootsCached(A), rb = rootsCached(B);
  if (!ra || !rb || !ra.length || !rb.length) return null;
  if (A.text.replace(/\s+/g, '') === B.text.replace(/\s+/g, '')) return null;
  // only a line that SOLVES (a letter, or one function of it, equal to a number: `x = 3`, `cos x = 1/2`) is read: a line that is itself an equation in a new shape (`(u - 4)(u - 4) = 0` for `(u - 2)(u - 4) = 0`,
  // or `(2^x - 1)(e^x - 2) = 0` for `(e^x - 1)(e^x - 2) = 0`) can share its roots by chance and is a claim about that equation. A line that gives only SOME of the solutions
  // (`cos x = 1` under `sin x(1/cos x - 2) = 0`: true of x = 0, and not the case the page is solving) is never ticked either: only the same set of solutions is.
  const isValueSide = n => !!n && ((n.t === 'var') || (n.t === 'call' && n.arg && n.arg.t === 'var'));
  if (!(isValueSide(B.l) && variablesOf(B.r).size === 0)) return null;
  if (sameRoots(ra, rb)) return { kind: 'same', count: ra.length, v: A.v };
  return null;
}

// ── a binomial expansion in the question: the term, or its coefficient ───────────────────────────────────────────────
// `Find the coefficient of x^3 in (2 - x)^7` and `(7C3)*2^4*(-1)^3`, `Find the term independent of x in (x^2 - 1/x)^9` and `(9C6)*(-1)^6`: the prompt names ONE
// expansion (a + b)^n of two terms in x and ONE target power; the coefficient is computed from the prompt alone (never the answer), and a line is ticked only when
// every side of it is that coefficient, or that coefficient times x^k (the term).
const PEQ = /([A-Za-z])\^\((-?\d+)\)|(?<![A-Za-z])([A-Za-z])(?![A-Za-z\^(])/;
function plainPrompt(prompt) {
  const text = String(prompt ?? '').replace(/\\\$/g, '\u0001');
  return text.replace(/\$\$?([^$]+)\$\$?/g, (_, tex) => { let p = null; try { p = texToPlain(tex); } catch { p = null; } return ` ${p || tex} `; }).replace(/\*\*/g, '').replace(/\s+/g, ' ').replace(/\u0001/g, '$');
}
const monomial = ast => {
  const g = x => { try { return evaluate(ast, { x }); } catch { return NaN; } };
  const a = g(2), b = g(3), c = g(5);
  if (![a, b, c].every(Number.isFinite) || a === 0 || b === 0 || c === 0) return null;
  const e = Math.log(Math.abs(b / a)) / Math.log(3 / 2);
  const er = Math.round(e);
  if (Math.abs(e - er) > 1e-9 || Math.abs(er) > 40) return null;
  const co = a / 2 ** er;
  if (!same(co * 3 ** er, b) || !same(co * 5 ** er, c)) return null;
  return { c: co, e: er };
};
const choose = (n, k) => { let r = 1; for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i; return Math.round(r); };
function splitTop(s) {
  const cuts = []; let d = 0;
  for (let i = 0; i < s.length; i++) { const ch = s[i]; if (ch === '(') d++; else if (ch === ')') d--; else if (d === 0 && i > 0 && (ch === '+' || ch === '-') && !/[\^(*\/+\-]/.test(s[i - 1] || '')) cuts.push(i); }
  return cuts;
}
/** { n, k, coefficient } from the prompt, or null when it does not name exactly one two-term expansion and one target power. */
export function binomialAsk(prompt) {
  const text = plainPrompt(prompt);
  const ex = [...text.matchAll(/\(((?:[^()]|\((?:[^()]|\([^()]*\))*\))+)\)\^\((\d+)\)/g)].filter(m => /(?<![A-Za-z])x(?![A-Za-z])/.test(m[1]));
  if (ex.length !== 1) return null;
  const n = Number(ex[0][2]);
  if (n < 2 || n > 30) return null;
  let k = null;
  if (/\b(?:term independent of|independent of|constant term)\b/i.test(text)) k = 0;
  const m = /\bcoefficient of\s+(?:the term in\s+)?x(?:\^\((-?\d+)\))?(?![A-Za-z0-9])/i.exec(text);
  if (m) { if (k !== null) return null; k = m[1] === undefined ? 1 : Number(m[1]); }
  if (k === null) return null;
  const body = ex[0][1].replace(/\s+/g, '');
  const cuts = splitTop(body);
  if (cuts.length !== 1) return null;
  let A, B;
  try { A = monomial(parse(normalize(body.slice(0, cuts[0])))); B = monomial(parse(normalize(body.slice(cuts[0])))); } catch { return null; }
  if (!A || !B) return null;
  let coefficient = 0, found = false;
  for (let j = 0; j <= n; j++) if (A.e * (n - j) + B.e * j === k) { coefficient += choose(n, j) * A.c ** (n - j) * B.c ** j; found = true; }
  if (!found) coefficient = 0;
  if (!Number.isFinite(coefficient) || Math.abs(coefficient) > 1e12) return null;
  return { n, k, coefficient, found };
}
/** The line says the coefficient asked for (every side is it, or it times x^k), as numbers computed exactly. */
export function binomialLine(ask, text) {
  if (!ask || !ask.found) return null;
  const t = lead(String(text ?? '')).replace(/[.]+$/, '').trim();
  if (!t || t.length > MAX_CHARS * 2 || /[<>≤≥≠≈≃~,;:%±⇒⟹→]|=>|->|\bor\b|\band\b/i.test(t) || !/(?:\d\s*C\s*\d|ncr)/i.test(t.replace(/\s+/g, '')) && !/\^/.test(t)) return null;
  const parts = t.split('=').map(x => x.trim());
  if (parts.some(p => !p) || parts.length > 5) return null;
  const sides = [];
  for (const p of parts) {
    let ast;
    try { if (ambiguousForms(p).length) return null; ast = parse(normalize(p)); } catch { return null; }
    if (!ast || ast.t === 'equation') return null;
    const vs = [...variablesOf(ast)].filter(x => x !== 'e');
    if (vs.length > 1 || (vs.length === 1 && vs[0] !== 'x')) return null;
    if (vs.length === 0) { let v; try { v = evaluate(ast, {}); } catch { return null; } if (!same(v, ask.coefficient)) return null; sides.push('coefficient'); }
    else { const mo = monomial(ast); if (!mo || mo.e !== ask.k || !same(mo.c, ask.coefficient)) return null; sides.push('term'); }
  }
  if (new Set(parts.map(x => x.replace(/\s+/g, ''))).size < 2 && parts.length > 1) return null;
  return { ask, sides };
}

// ── the integral in the question: its antiderivative, its limits, its value ──────────────────────────────────────────────────
// The prompt names ONE integral, `\int_a^b f(x) dx` (or `\int f(x) dx`). From the prompt alone (never the answer or the worked solution) a line is ticked when:
//   antiderivative-checked    a bare expression F (an optional constant factor, an optional `+ C`) whose derivative is f at every one of many values
//   definite-integral-evaluated   `k[F]_a^b` with the prompt's own limits and k F' = f; or an expression or a chain (`[F]_a^b = F(b) - F(a) = v`) every side of which comes to the integral's value
// The integral's value is computed by quadrature (Gauss-Legendre on a cosine-spaced grid, so an endpoint like 1/sqrt(4 - x^2) is read) and compared to 1e-8; a value
// that is only close is not ticked.
const GL = (() => {
  // 12-point Gauss-Legendre nodes and weights on [-1, 1]
  const n = 12, xs = [], ws = [];
  for (let i = 0; i < n; i++) {
    let x = Math.cos(Math.PI * (i + 0.75) / (n + 0.5)), dp = 1;
    for (let it = 0; it < 100; it++) { let p0 = 1, p1 = x; for (let k = 2; k <= n; k++) { const p2 = ((2 * k - 1) * x * p1 - (k - 1) * p0) / k; p0 = p1; p1 = p2; } dp = (n * (x * p1 - p0)) / (x * x - 1); const dx = p1 / dp; x -= dx; if (Math.abs(dx) < 1e-15) break; }
    let p0 = 1, p1 = x; for (let k = 2; k <= n; k++) { const p2 = ((2 * k - 1) * x * p1 - (k - 1) * p0) / k; p0 = p1; p1 = p2; }
    dp = (n * (x * p1 - p0)) / (x * x - 1);
    xs.push(x); ws.push(2 / ((1 - x * x) * dp * dp));
  }
  return { xs, ws };
})();
/** The integral of g from a to b, or null (g not finite in between). x = a + (b - a)(1 - cos(pi t))/2 clusters the nodes at both ends. */
export function quadrature(g, a, b) {
  if (!(Number.isFinite(a) && Number.isFinite(b)) || a === b) return null;
  const PANELS = 64;
  let total = 0;
  for (let p = 0; p < PANELS; p++) {
    const t0 = p / PANELS, t1 = (p + 1) / PANELS;
    for (let i = 0; i < GL.xs.length; i++) {
      const t = (t0 + t1) / 2 + ((t1 - t0) / 2) * GL.xs[i];
      const x = a + ((b - a) * (1 - Math.cos(Math.PI * t))) / 2;
      const w = (GL.ws[i] * (t1 - t0)) / 2 * ((b - a) * Math.PI * Math.sin(Math.PI * t)) / 2;
      let y; try { y = g(x); } catch { return null; }
      if (!Number.isFinite(y)) { if (i === 0 || i === GL.xs.length - 1) continue; return null; }
      total += w * y;
    }
  }
  return Number.isFinite(total) ? total : null;
}
function braced(s, i) {            // the argument starting at s[i]: a {...} group or one token; returns [text, nextIndex]
  while (s[i] === ' ') i++;
  if (s[i] === '{') { let d = 0, j = i; for (; j < s.length; j++) { if (s[j] === '{') d++; else if (s[j] === '}') { d--; if (!d) break; } } return [s.slice(i + 1, j), j + 1]; }
  const m = /^\\[A-Za-z]+|^./.exec(s.slice(i)); return m ? [m[0], i + m[0].length] : ['', i];
}
/** { a, b, f, v, lo, hi, plain } for the one integral of the prompt (`a`, `b` null when indefinite), or null. */
export function integralAsk(prompt) {
  const text = String(prompt ?? '').replace(/\\\$/g, '\u0001');
  const spans = [...text.matchAll(/\$\$?([^$]+)\$\$?/g)].map(m => m[1]);
  const withInt = spans.filter(sp => /\\int(?![A-Za-z])/.test(sp));
  if (withInt.length !== 1) return null;
  let tex = withInt[0].replace(/\\displaystyle|\\left|\\right|\\!/g, '').replace(/\\,|\;|\\:/g, ' ').trim();
  if ((tex.match(/\\int(?![A-Za-z])/g) || []).length !== 1) return null;
  let i = tex.indexOf('\\int') + 4, lo = null, hi = null;
  const rest0 = tex.slice(0, tex.indexOf('\\int')).trim();
  if (rest0) return null;                 // something before the integral (a factor, a name): not read
  for (let k = 0; k < 2; k++) { while (tex[i] === ' ') i++; if (tex[i] === '_') { [lo, i] = braced(tex, i + 1); } else if (tex[i] === '^') { [hi, i] = braced(tex, i + 1); } }
  const body = tex.slice(i).trim();
  let integrand = null;
  const fr = /^\\d?frac\{\s*d([a-z])\s*\}\{(.*)\}$/.exec(body);
  if (fr) integrand = { v: fr[1], tex: `\\frac{1}{${fr[2]}}` };
  else { const m = /^(.*?)\s*d([a-z])\s*$/.exec(body); if (m && m[1].trim()) integrand = { v: m[2], tex: m[1].trim() }; }
  if (!integrand || /\\int|\\sum|\\lim/.test(integrand.tex)) return null;
  let plain = null; try { plain = texToPlain(integrand.tex); } catch { plain = null; }
  if (!plain) return null;
  let node; try { if (ambiguousForms(plain).length) return null; node = parse(normalize(plain)); } catch { return null; }
  if (!node || node.t === 'equation' || [...variablesOf(node)].some(x => x !== integrand.v && x !== 'e')) return null;
  const v = integrand.v;
  const f = x => { try { return evaluate(node, { [v]: x }); } catch { return NaN; } };
  let a = null, b = null;
  if (lo !== null || hi !== null) {
    if (lo === null || hi === null) return null;
    const cv = t => { let p = null; try { p = texToPlain(t); } catch { p = null; } p = p || t.replace(/\\pi/g, 'pi'); const r = p ? valueOfSide(p) : null; return r ? r.v : null; };
    a = cv(lo); b = cv(hi);
    if (a === null || b === null) return null;
  }
  return { v, f, a, b, node, definite: a !== null };
}
const sampleXs = (ask, k = 14) => {
  const lo = ask.definite ? Math.min(ask.a, ask.b) : -2.9, hi = ask.definite ? Math.max(ask.a, ask.b) : 3.3;
  return Array.from({ length: k }, (_, i) => lo + ((hi - lo) * (i + 0.37 + 0.11 * (i % 3))) / (k + 0.8));
};
const dd = (F, x) => { const h = 1e-3 * Math.max(1, Math.abs(x)); return (-F(x + 2 * h) + 8 * F(x + h) - 8 * F(x - h) + F(x - 2 * h)) / (12 * h); };
/** Is the expression text an antiderivative of the prompt's integrand (times k, plus a constant)? { k } or null. */
function antiderivativeOf(ask, exprText, k = 1) {
  let ast; try { if (ambiguousForms(exprText).length) return null; ast = parse(normalize(exprText.replace(/\+\s*C\s*$/, ''))); } catch { return null; }
  if (!ast || ast.t === 'equation' || [...variablesOf(ast)].some(x => x !== ask.v && x !== 'e')) return null;
  const F = x => { try { return k * evaluate(ast, { [ask.v]: x }); } catch { return NaN; } };
  let seen = 0;
  for (const x of sampleXs(ask)) {
    const want = ask.f(x), got = dd(F, x);
    if (!Number.isFinite(want) || !Number.isFinite(got)) continue;
    if (Math.abs(want - got) > 1e-6 * Math.max(1, Math.abs(want))) return null;
    seen++;
  }
  return seen >= 8 ? { F, ast } : null;
}
const BRACKET = /^(.*?)\[(.+)\]\s*_\s*\{?\s*([^{}^]+?)\s*\}?\s*\^\s*\{?\s*([^{}]+?)\s*\}?$/;
const DIFFERS = (a, b) => !Number.isFinite(a) || !Number.isFinite(b) || Math.abs(a - b) > 1e-8 * Math.max(1, Math.abs(a), Math.abs(b));
function integralLine(ask, text, cache) {
  if (!ask) return null;
  const t = lead(String(text ?? '')).replace(/[.]+$/, '').trim();
  if (!t || t.length > MAX_CHARS * 2 || /[<>≤≥≠≈≃~,;:%±⇒⟹→∫]|=>|->|\bor\b|\band\b/i.test(t)) return null;
  const parts = t.split('=').map(x => x.trim());
  if (parts.some(p => !p) || parts.length > 5) return null;
  const limitVal = s => { const r = valueOfSide(String(s).replace(/^\{|\}$/g, '').replace(/\\pi/g, 'pi')); return r ? r.v : null; };
  // the value of the integral, once
  const total = () => { if (cache.total === undefined) cache.total = ask.definite ? quadrature(ask.f, ask.a, ask.b) : null; return cache.total; };
  // a definite line: every side is a bracket with the prompt's limits (k F' = f), or a number equal to the integral
  if (ask.definite) {
    const T = total(); if (T === null) return null;
    let sawBracket = false;
    for (const p of parts) {
      const bm = BRACKET.exec(p);
      if (bm) {
        const lo = limitVal(bm[3]), hi = limitVal(bm[4]);
        if (lo === null || hi === null || DIFFERS(lo, ask.a) || DIFFERS(hi, ask.b)) return null;
        const factor = bm[1].trim().replace(/\*$/, '').trim();
        let k = 1;
        if (factor) { const r = valueOfSide(factor); if (!r) return null; k = r.v; }
        if (!antiderivativeOf(ask, bm[2], k)) return null;
        sawBracket = true; continue;
      }
      if (/[\[\]]|_/.test(p)) return null;
      const r = valueOfSide(p);
      if (!r || DIFFERS(r.v, T)) return null;
    }
    if (parts.length === 1 && !sawBracket && !/(?:arc)?(?:sin|cos|tan)|ln|e\s*\^|sqrt|pi|π/.test(parts[0])) return null;
    if (parts.length > 1 && new Set(parts.map(x => x.replace(/\s+/g, ''))).size < 2) return null;
    return { kind: 'definite', value: T, bracket: sawBracket };
  }
  // an indefinite integral: a bare antiderivative
  if (parts.length === 1) { const k = antiderivativeOf(ask, parts[0]); if (k) return { kind: 'antiderivative' }; }
  return null;
}
// the same bare antiderivative in a definite question (the line before the limits are put in): `(1/3)*arctan(((x)/3))`
function bareAntiderivative(ask, text) {
  if (!ask || !ask.definite) return null;
  const t = lead(String(text ?? '')).replace(/[.]+$/, '').trim();
  if (!t || t.length > MAX_CHARS || /[=<>≤≥≠≈≃~,;:%±⇒⟹→∫\[\]_]|=>|->/.test(t)) return null;
  if (!/(?<![A-Za-z])[A-Za-z](?![A-Za-z])/.test(t.replace(/\b(?:sin|cos|tan|ln|log|sqrt|exp|arcsin|arccos|arctan|pi)\b/g, ''))) return null;
  const k = antiderivativeOf(ask, t);
  return k ? { kind: 'antiderivative' } : null;
}

// ── a triangle in the question ───────────────────────────────────────────────────────────────────────────────────────────
// `In triangle ABC, A = 40°, B = 75° and a = 10`, `sides 8 and 11 and included angle 65°`, `a = 7, b = 9 and C = 38°`: the prompt gives enough to fix the triangle
// (two angles and a side, two sides and the angle between them, or three sides), and the rest is computed from the prompt alone, never the answer. A line is then
// ticked when every side of it comes to the same number WITH each letter put in as the prompt gives it (a side as `a`, an angle as `A`) or as the triangle works out
// (the letters the prompt does not give), or, for the one free letter of a line (`c^2 =`, `x =`, `A =` for the area), the quantity the question asks for.
// The whole line is then true of the question's own triangle. An angle in a sine ratio the prompt leaves two ways (SSA) is never solved.
const rawPrompt = prompt => String(prompt ?? '').replace(/\\\$/g, '\u0001').replace(/\$+/g, ' ').replace(/\^\s*\{?\s*\\circ\s*\}?/g, '°').replace(/\\(?:text|mathrm)\{([^}]*)\}/g, '$1').replace(/\\(?:triangle)/g, ' triangle ').replace(/\\angle/g, ' angle ').replace(/\\[,;:! ]/g, ' ').replace(/\\(?:dfrac|frac)\{([^{}]*)\}\{([^{}]*)\}/g, '($1/$2)').replace(/\*\*/g, '').replace(/\s+/g, ' ');
const NUMV = String.raw`(\d+(?:\.\d+)?)`;
const rad = d => (d * Math.PI) / 180;
export function triangleWorld(prompt) {
  const t = rawPrompt(prompt);
  const name = /(?:triangle|△)\s*([A-Z])([A-Z])([A-Z])\b/.exec(t);
  const verts = name ? [name[1], name[2], name[3]] : null;
  const sides = {}, angles = {};
  for (const m of t.matchAll(new RegExp(String.raw`(?<![A-Za-z\\])([a-z])\s*=\s*${NUMV}(?![\d.]|\s*°|\s*\^)`, 'g'))) sides[m[1]] = Number(m[2]);
  for (const m of t.matchAll(new RegExp(String.raw`(?<![A-Za-z\\])(?:angle\s*)?([A-Z])\s*=\s*${NUMV}\s*°`, 'g'))) angles[m[1]] = rad(Number(m[2]));
  const both = /\barea\b/i.test(t) && /\b(?:third side|diagonal|distance|how far|apart)/i.test(t);
  const ask = both ? null : /\barea\b/i.test(t) ? 'area' : /\b(?:third side|side\b|diagonal|distance|how far|length|apart)/i.test(t) ? 'side' : /\bangle\b/i.test(t) && /\bfind\b[^.]*\b(?:angle|[A-Z])\b/i.test(t) ? 'angle' : null;
  // unlabelled: `sides 8 and 11 and included angle 65°`
  const sas = new RegExp(String.raw`(?:sides?|lengths?|rods?|paths?)[^.]*?${NUMV}\s*(?:cm|m|km)?\s*(?:and|,)\s*${NUMV}\s*(?:cm|m|km)?[^.]*?(?:included|enclosing|enclosed|between|at an angle of|at)\s*(?:angle\s*)?(?:of\s*)?${NUMV}\s*°`, 'i').exec(t);
  const askL = /\bfind\s+(?:the\s+(?:size\s+of\s+)?(?:acute\s+)?(?:side\s+|angle\s+)?)?([A-Za-z])(?![A-Za-z])/i.exec(t);
  const world = { ask, askLetter: askL ? askL[1] : null, letters: null, free: null };
  if (verts && Object.keys(sides).length + Object.keys(angles).length >= 3) {
    const low = v => v.toLowerCase();
    const [A, B, C] = verts, side = { [A]: sides[low(A)], [B]: sides[low(B)], [C]: sides[low(C)] }, ang = { [A]: angles[A], [B]: angles[B], [C]: angles[C] };
    const knownA = verts.filter(v => ang[v] !== undefined), knownS = verts.filter(v => side[v] !== undefined);
    const clash = Object.keys(sides).some(k => !verts.map(low).includes(k)) || Object.keys(angles).some(k => !verts.includes(k));
    if (clash) return null;
    let ok = false;
    if (knownA.length >= 2 && knownS.length >= 1) {
      const third = verts.find(v => ang[v] === undefined); if (third) ang[third] = Math.PI - knownA.reduce((s, v) => s + ang[v], 0);
      const k = side[knownS[0]] / Math.sin(ang[knownS[0]]);
      for (const v of verts) if (side[v] === undefined) side[v] = k * Math.sin(ang[v]);
      ok = verts.every(v => Number.isFinite(side[v]) && side[v] > 0 && Number.isFinite(ang[v]) && ang[v] > 0);
    } else if (knownS.length === 2 && knownA.length === 1 && verts.find(v => side[v] === undefined) === knownA[0]) {
      const c = verts.find(v => side[v] === undefined), [u, w] = knownS; // the known angle is at c's vertex: it is between sides u and w
      side[c] = Math.sqrt(side[u] ** 2 + side[w] ** 2 - 2 * side[u] * side[w] * Math.cos(ang[c]));
      for (const [x, y, z] of [[u, w, c], [w, u, c]]) ang[x] = Math.acos((side[y] ** 2 + side[z] ** 2 - side[x] ** 2) / (2 * side[y] * side[z]));
      ok = verts.every(v => Number.isFinite(side[v]) && Number.isFinite(ang[v]));
    } else if (knownS.length === 3 && knownA.length === 0) {
      for (const v of verts) { const [y, z] = verts.filter(x => x !== v); ang[v] = Math.acos((side[y] ** 2 + side[z] ** 2 - side[v] ** 2) / (2 * side[y] * side[z])); }
      ok = verts.every(v => Number.isFinite(ang[v]));
    }
    if (!ok) return null;
    world.letters = {};
    for (const v of verts) { world.letters[low(v)] = side[v]; world.letters[v] = ang[v]; }
    world.area = 0.5 * side[A] * side[B] * Math.sin(ang[C]);
    world.givenLetters = new Set([...Object.keys(sides), ...Object.keys(angles)]);
    world.kind = 'labelled';
    return world;
  }
  if (sas && !verts) {
    const s1 = Number(sas[1]), s2 = Number(sas[2]), th = rad(Number(sas[3]));
    if (!(s1 > 0 && s2 > 0 && Number(sas[3]) > 0 && Number(sas[3]) < 180)) return null;
    world.kind = 'sas'; world.sides = [s1, s2]; world.theta = th;
    world.c2 = s1 * s1 + s2 * s2 - 2 * s1 * s2 * Math.cos(th); world.c = Math.sqrt(world.c2);
    world.area = 0.5 * s1 * s2 * Math.sin(th);
    return world;
  }
  return null;
}
const KNOWN_FN = /\b(?:sin|cos|tan|sqrt|ln|log|pi|exp|arcsin|arccos|arctan)\b/g;
const squashL = p => p.replace(/\s+/g, '');
function triangleLine(w, text) {
  if (!w) return null;
  const t = lead(String(text ?? '')).replace(/[.]+$/, '').trim();
  if (!t || t.length > MAX_CHARS * 2 || /[<>≤≥≠≈≃~,;:%±⇒⟹→∫\[\]]|=>|->|\bor\b|\band\b/i.test(t)) return null;
  const parts = t.split('=').map(x => x.trim());
  if (parts.some(p => !p) || parts.length > 5) return null;
  const evalSide = (p, env) => {
    const r = radians(p); if (r === null) return null;
    let ast; try { if (ambiguousForms(r).length) return null; ast = parse(normalize(r)); } catch { return null; }
    if (!ast || ast.t === 'equation') return null;
    if ([...variablesOf(ast)].some(x => x !== 'e' && env[x] === undefined)) return null;
    if (!trigUnitsFixedLetters(ast, env)) return null;
    let v; try { v = evaluate(ast, env); } catch { return null; }
    return Number.isFinite(v) && Math.abs(v) < 1e12 ? v : null;
  };
  const free = [...new Set(parts.flatMap(p => (p.replace(KNOWN_FN, ' ').match(/(?<![A-Za-z])[A-Za-z](?![A-Za-z])/g) || [])))].filter(x => x !== 'e');
  if (w.kind === 'labelled') {
    // every letter of the line must be one of the triangle's (a side, or an angle in a sine or a cosine, in radians); one free letter is the asked quantity
    const stray = free.filter(x => w.letters[x] === undefined);
    if (stray.length > 1) return null;
    if (stray.length === 1 && w.ask === null) return null;
    const hasAngleLetter = free.some(x => /[A-Z]/.test(x) && w.letters[x] !== undefined);
    const attempts = [];
    const base = { ...w.letters };
    if (stray.length === 1) {
      const L = stray[0];
      for (const target of [w.ask === 'area' ? w.area : null]) if (target !== null) attempts.push({ ...base, [L]: target });
      if (w.ask === 'side' || w.ask === 'angle') return null;   // a labelled prompt names its unknowns: a letter it does not name is not read
    } else attempts.push(base);
    for (const env of attempts) {
      const vals = parts.map(p => evalSide(p, env));
      if (vals.some(v => v === null)) continue;
      if (!vals.every(v => same(v, vals[0]))) continue;
      if (new Set(parts.map(x => x.replace(/\s+/g, ''))).size < 2 && parts.length > 1) continue;
      if (parts.length === 1 && free.length > 0) { const T = w.askLetter && /^[a-z]$/.test(w.askLetter) ? w.letters[w.askLetter] : null; if (T === undefined || T === null || !same(vals[0], T)) continue; }
      if (free.length === 0) { const T = w.askLetter && /^[a-z]$/.test(w.askLetter) ? w.letters[w.askLetter] : null; if (T === undefined || T === null || !same(vals[0], T)) continue; }
      // a bare line that uses no letter of the triangle is not a statement about it
      if (!hasAngleLetter && !free.length && !/[°]|sin|cos|tan/.test(t)) continue;
      const given = free.filter(x => w.givenLetters.has(x));
      return { value: vals[0], area: stray.length === 1, labelled: true, letters: free, given };
    }
    return null;
  }
  // unlabelled SAS: a bare expression, or a line with one free letter, whose value is the area, the third side squared, or the third side (what the question asks)
  let targets = w.ask === 'area' ? [w.area] : w.ask === 'side' ? [w.c2, w.c] : null;
  if (!targets) return null;
  if (free.length > 1) return null;
  if (free.length === 1 && !/^[A-Za-z]$/.test(free[0])) return null;
  // the label says which quantity: `L^2` the square of the third side, `L` the third side (or the area)
  const lab = parts.length > 1 && free.length === 1 ? squashL(parts[0]) : null;
  if (lab !== null) {
    if (new RegExp(`^${free[0]}\\^\\(?2\\)?$`).test(lab)) targets = w.ask === 'side' ? [w.c2] : null;
    else if (lab === free[0]) targets = w.ask === 'side' ? [w.c] : [w.area];
    else return null;
    if (!targets) return null;
  }
  const consts = parts.filter((p, i) => !(i === 0 && free.length === 1 && parts.length > 1 && new RegExp(`(?<![A-Za-z])${free[0]}(?![A-Za-z])`).test(p)));
  if (free.length === 1 && consts.length === parts.length) return null;   // the letter sits in a later side: not read
  const vals = consts.map(p => evalSide(p, {}));
  if (!vals.length || vals.some(v => v === null)) return null;
  if (!targets.some(T => vals.every(v => same(v, T)))) return null;
  if (consts.length === 1 && !/sin|cos|tan|sqrt/.test(consts[0])) return null;
  return { value: vals[0], area: w.ask === 'area', labelled: false, letters: free, given: [] };
}
/** A trigonometric function of an expression with a letter is read in radians because the letter holds the angle in radians; a bare number needs a degree sign or π. */
function trigUnitsFixedLetters(ast, env) {
  let ok = true;
  const walk = n => {
    if (!n || typeof n !== 'object' || !ok) return;
    if (n.t === 'call' && TRIG.has(n.fn) && n.arg) {
      const vs = [...variablesOf(n.arg)];
      let v = NaN; try { v = evaluate(n.arg, env); } catch { v = NaN; }
      const hasPi = x => !!x && typeof x === 'object' && (x.t === 'const' && x.v === 'pi' || ['l', 'r', 'v', 'arg'].some(k => hasPi(x[k])) || (Array.isArray(x.args) && x.args.some(hasPi)));
      const letterAngle = vs.length && vs.every(x => /^[A-Z]$/.test(x));
      if (!hasPi(n.arg) && v !== 0 && !letterAngle) { ok = false; return; }
    }
    for (const k of ['l', 'r', 'v', 'arg']) walk(n[k]);
    if (Array.isArray(n.args)) n.args.forEach(walk);
  };
  walk(ast);
  return ok;
}

// ── a list of values of an expression, solving the equation above inside the question's interval ──────────────────────────────
// `2x = π/4, 5π/4` under `sin 2x = √2/2` for `0 ≤ x ≤ 2π`: the interval comes from the prompt (a maths span `0 <= x <= 2π`), the real solutions of the line above inside it are
// found by computing, and the expression on the left is evaluated at each: the line is ticked only when those values are EXACTLY the ones the line lists (none missing, none extra).
export function domainOfPrompt(prompt, v) {
  const spans = [...String(prompt ?? '').replace(/\\\$/g, '\u0001').matchAll(/\$\$?([^$]+)\$\$?/g)].map(m => m[1]);
  for (const sp of spans) {
    const t = sp.replace(/\\leqslant|\\le(?:q)?(?![A-Za-z])/g, '<=').replace(/\\pi/g, 'pi').replace(/\\tfrac|\\dfrac|\\frac/g, '\\frac').replace(/\s+/g, '');
    const m = new RegExp(String.raw`^(.+?)<=${v}<=(.+)$`).exec(t);
    if (!m) continue;
    const conv = z => { const f = /^\\frac\{?([^{}]+)\}?\{?([^{}]+)\}?$/.exec(z); const e = f ? `(${f[1]})/(${f[2]})` : z; const r = valueOfSide(e.replace(/\\/g, '')); return r ? r.v : null; };
    const lo = conv(m[1]), hi = conv(m[2]);
    if (lo !== null && hi !== null && hi > lo && hi - lo < 100) return { lo, hi };
  }
  return null;
}
export function listedSolutions(above, text, domFor) {
  const A = equationOf(above); if (!A) return null;
  const dom = typeof domFor === 'function' ? domFor(A.v) : domFor;
  if (!dom) return null;
  const t = lead(String(text ?? '')).replace(/[.]+$/, '').trim();
  if (!t || t.length > MAX_CHARS * 2 || /[<>≤≥≠≈≃~;:%±⇒⟹→]|=>|->|\bor\b|\band\b/i.test(t)) return null;
  const eq = t.indexOf('=');
  if (eq < 1 || t.indexOf('=', eq + 1) >= 0) return null;
  const lhs = t.slice(0, eq).trim(), listTxt = t.slice(eq + 1).trim();
  const vals = [];
  for (const piece of listTxt.split(',')) { const r = valueOfSide(piece.trim()); if (!r) return null; vals.push(r.v); }
  if (!vals.length || vals.length > 8) return null;
  let L; try { if (ambiguousForms(radians(lhs) ?? '').length) return null; L = parse(normalize(radians(lhs))); } catch { return null; }
  if (!L || L.t === 'equation') return null;
  const lv = [...variablesOf(L)].filter(x => x !== 'e');
  if (lv.length !== 1 || lv[0] !== A.v) return null;
  const EL = x => { try { return evaluate(L, { [A.v]: x }); } catch { return NaN; } };
  // the left side is the letter, or a straight-line function of it (2x, x - pi/3, x/2): a product or a power would not be "the angle" the list is of
  { const c0 = EL(0), c1 = EL(1), c2 = EL(2.5), c3 = EL(-1.7); if (![c0, c1, c2, c3].every(Number.isFinite) || Math.abs(c1 - c0) < 1e-9 || !same(c2, c0 + 2.5 * (c1 - c0)) || !same(c3, c0 - 1.7 * (c1 - c0))) return null; }
  const roots = rootsOf(A.f, dom.lo, dom.hi, 16000);
  if (!roots || !roots.length) return null;
  const mapped = roots.map(EL);
  if (mapped.some(x => !Number.isFinite(x))) return null;
  const uniq = xs => xs.slice().sort((p, q) => p - q).filter((x, i, a) => !i || Math.abs(x - a[i - 1]) > 1e-6);
  const want = uniq(mapped), got = uniq(vals);
  if (want.length !== got.length || !want.every((x, k) => Math.abs(x - got[k]) <= 1e-6 * Math.max(1, Math.abs(x)))) return null;
  return { count: want.length, v: A.v, lo: dom.lo, hi: dom.hi };
}

// ── the pass ─────────────────────────────────────────────────────────────────
const tickLine = (l, cls, note, says, saysTex) => ({ text: l.text, status: 'ok', state: 'arithmetic', note, valueChain: { rule: 'proved' }, fact: { kind: 'proved', proof: cls, says, ...(saysTex ? { saysSegs: [{ t: 'text', v: `${says.slice(0, says.indexOf(saysTex))}` }, { t: 'tex', v: saysTex }] } : {}) }, tickClass: cls });

/**
 * @param q      the question (only its identity is read: the pass is for the Australian edition)
 * @param lines  the report's lines, in order
 * @param limit  lines at or after this index are never touched (the first cross)
 * @param open   (l, i) => may this line take a new tick? Notes only.
 * @returns the new lines (the same array when nothing changed) and the number of lines that changed
 */
export function pageProofs3(q, lines, limit, open) {
  if (!australianQuestion(q) || !Array.isArray(lines)) return { lines, n: 0 };
  const out = lines.slice();
  let n = 0;
  let ask; try { ask = binomialAsk(q.prompt); } catch { ask = null; }
  let integ; try { integ = integralAsk(q.prompt); } catch { integ = null; }
  const integCache = {};
  const domFor = v => { try { return domainOfPrompt(q.prompt, v); } catch { return null; } };
  let tri; try { tri = triangleWorld(q.prompt); } catch { tri = null; }
  for (let i = 0; i < Math.min(limit, lines.length); i++) {
    const l = lines[i];
    if (!l || l.status !== 'note' || !open(l, i) || l.unread || l.unreadable) continue;
    const text = String(l.text ?? '');
    const prev = i > 0 ? out[i - 1] : null;
    const prevOk = prev && prev.status !== 'break' && !prev.unread && !prev.unreadable && prev.followsFromError !== true;
    let res = null;
    try {
      const above = prevOk ? endValue(String(prev.text ?? '')) : null;
      const chain = exactChain(text, above, prevOk && SPECIAL.test(String(prev.text ?? '')));
      if (chain) {
        const says = chain.cont ? `Equal to the value above, ${fmt(chain.value)}` : `Every value on this line is ${fmt(chain.value)}`;
        res = tickLine(l, CLASS3.exact, `Correct: ${chain.cont ? 'this line continues the line above and every value on it comes to' : 'every value on this line is computed exactly and comes to'} ${fmt(chain.value)}${chain.labelled ? '. Only the numbers are checked; what the letter on the left stands for is not' : ''}.`, says);
      }
      if (!res) {
        const b = binomialLine(ask, text);
        if (b) {
          const whatItIs = b.ask.k === 0 ? 'the term independent of x' : `the coefficient of x^${b.ask.k}`;
          res = tickLine(l, CLASS3.binomial, `Correct: the question asks for ${whatItIs} in the expansion, and every expression on this line comes to ${fmt(b.ask.coefficient)}${b.sides.includes('term') ? ' (with its power of x)' : ''}.`, `Comes to ${fmt(b.ask.coefficient)}, ${whatItIs}`);
        }
      }
      if (!res && integ) {
        const r = integralLine(integ, text, integCache) || bareAntiderivative(integ, text);
        if (r && r.kind === 'antiderivative') res = tickLine(l, 'antiderivative-checked', 'Correct: differentiating this expression gives the integrand in the question, at every value tried.', 'Its derivative is the integrand');
        else if (r) res = tickLine(l, 'definite-integral-evaluated', `Correct: ${r.bracket ? 'the limits are the question\'s own, the antiderivative is right, and ' : ''}every expression on this line comes to the value of the integral in the question, ${fmt(r.value)}.`, `The value of the integral, ${fmt(r.value)}`);
      }
      if (!res && tri) {
        const r = triangleLine(tri, text);
        if (r) res = tickLine(l, 'triangle-value', `Correct: with ${r.labelled ? 'the sides and angles the question gives, and the rest of the triangle worked out from them' : 'the two sides and the angle between them that the question gives'}, every value on this line comes to ${fmt(r.value)}${r.area ? ', the area' : ''}. Only the numbers are checked.`, `Comes to ${fmt(r.value)}, from the triangle in the question`);
      }
      if (!res && prevOk) {
        const r = listedSolutions(String(prev.text ?? ''), text, domFor);
        if (r) res = tickLine(l, 'solutions-in-interval', `Correct: the equation above has exactly ${r.count} solution${r.count === 1 ? '' : 's'} in the interval the question gives, and they are the values this line lists.`, 'Every solution in the interval, none missing');
      }
      if (!res && prevOk) {
        const r = equationRelation(String(prev.text ?? ''), text);
        if (r) {
          res = tickLine(l, 'same-equation-as-line-above', `Correct: this line has the same real solutions as the line above (${r.count} in all between -${WINDOW} and ${WINDOW}), so it is the same equation written another way.`, `The same equation as the line above, rearranged`);
        }
      }
    } catch { res = null; }
    if (!res) continue;
    out[i] = res;
    n++;
  }
  return { lines: n ? out : lines, n };
}
