// Pri Learning — the arithmetic check: line marks for a question with no Step Check.
//
// Owner request, 19 November 2026: "make sure every question has line marking".
// Measured that day, about one written question in seven carried a Step Check
// meta; for the rest, working came back "not verified" and no line was judged.
//
// A full checker needs the question's own structure, topic by topic. This
// module needs nothing from the question, so it applies to all of them. It
// proves one thing only: whether the numbers a line states equal ARE equal.
//
//     -20 - 6 = 14            crossed: -20 - 6 is -26
//     196 + 64 = 260          ticked
//     √(14^2 + 8^2)           not judged (it states nothing)
//     = √260                  ticked, against the line above
//
// A tick here says "the arithmetic on this line is right". It does NOT say the
// line is the right step for the question, and no copy built on it may say so:
// the report is marked `arithmetic: true` and each tick has state 'arithmetic'.
// No mark of any kind comes from it.
//
// Never crossed (a note instead):
//   · a line with a letter in it, an inequality, a unit, a percent or degree sign;
//   · a line with a decimal or an "about equal" sign, which may be a rounding;
//   · a trigonometric or logarithmic value (the angle unit and base are not known);
//   · a line that becomes true under another plausible reading of the
//     handwriting: 23 = 8 is 2^3 = 8 with the index read on the line, and
//     12 = 0.5 is 1/2 with the bar lost. The reader, not the student, may
//     have made that slip.
import { parse, normalize, evaluate, variablesOf, exprEquivalent, withEvaluationBudget } from './expr.js';
import { mathSpan, assignSpan } from './commentTex.js';
import { justifyStep } from './stepJustify.js';
import { cleanLatex } from './texSafe.js';
import { texToPlain } from './texToPlain.js';

// Everything this module evaluates for one page of working is charged to ONE budget (expr.js, "What an evaluation may
// cost"): what a page costs to check must not depend on what is written on it. When the budget is spent the rest
// evaluates to NaN, which is a note, never a tick or a cross.
const PAGE_BUDGET = 200000;

const LIMITS = { lines: 20, chars: 160 };
const NOTE = 'Not checked: this line has no arithmetic Pri can check on its own.';
const UNREAD = 'This line could not be read as maths, so it is not checked.';
const SOFT_NOTE = 'Not checked: this line may use a rounded value, so it is not marked.';
const MISREAD_NOTE = 'Not checked: this line may have been misread, so it is not marked.';
// `y' = e^x(x^2) + e^x(2x) = e^x(x^2 + 2x)`: a derivative mark in front of a worked chain labels the chain like `Area =` does.
// What is judged is the chain after it (a tick says those sides are equal, never that the label is the right derivative).
const SUBSTITUTION_PREFIX = /^[A-Za-z]\s*=\s*-?[\dπ√(][-+*/().\dπ√ ]{0,23}?\s*:\s*(?=\S)/;
const DERIVATIVE_LABEL = /^(?:[A-Za-z]['′]{1,2}(?:\(\s*[a-z]\s*\))?|d(?:\^?2|²)?[a-z]?\/d[a-z](?:\^?2|²)?)\s*=\s*(?=[^=]*=\s*\S)/;
const FUNCTION_WORDS = /\b(?:sin|cos|tan|sec|cosec|csc|cot|ln|log|asin|acos|atan|arcsin|arccos|arctan)\b/i;

// `Ans = 72` under the working: ticked when it equals the line above, never crossed (it may answer something else).
const ANS_LABEL = /^(?:ans|answer)\.?\s*(?==)/i;
const close = (a, b) => Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));
const gcd = (a, b) => (b ? gcd(b, a % b) : Math.abs(a));
/**
 * A value in the exact form a student would write it, as { plain, tex }: an integer; a simple fraction n/d (d <= 12);
 * a surd k√n or (k√n)/d (n square-free, 1 < n <= 50); a rational multiple of π (kπ/d, d <= 12); otherwise four decimal
 * places. An exact form is used only when it reproduces the value to 1e-9. Nothing is guessed.
 */
export function exactForm(v) {
  const done = (plain, tex) => ({ plain: plain.replace(/^-/, '−'), tex });
  if (!Number.isFinite(v)) return { plain: String(v), tex: String(v) };
  if (Number.isInteger(v)) { const s = String(Object.is(v, -0) ? 0 : v); return done(s, s); }
  // A whole number carrying float noise (72.00000000000001, or √2 × √2 = 2.0000000000000004) is that whole number.
  { const whole = Math.round(v); if (Math.abs(v - whole) <= 1e-9 * Math.max(1, Math.abs(whole))) { const s = String(Object.is(whole, -0) ? 0 : whole); return done(s, s); } }
  const sign = v < 0 ? '-' : '', a = Math.abs(v);
  const reproduces = x => Math.abs(x - a) <= 1e-9 * Math.max(1, a);
  for (let d = 2; d <= 12; d++) { const n = Math.round(a * d); if (Math.abs(a * d - n) < 1e-9 && n < 100000) return done(`${sign}${n}/${d}`, `${sign}\\frac{${n}}{${d}}`); }
  // A surd: (a·d)² is a whole number m = k²·n with n square-free; the smallest d gives the reduced form.
  for (let d = 1; d <= 12; d++) {
    const m = Math.round((a * d) ** 2);
    if (m < 2 || m > 50 * 400 || Math.abs((a * d) ** 2 - m) > 1e-7) continue;
    let k = 1; for (let c = 2; c * c <= m; c++) if (m % (c * c) === 0) k = c;   // the largest square factor c² of m
    const n = m / (k * k);
    if (n < 2 || n > 50 || k > 20 || !reproduces((k * Math.sqrt(n)) / d)) continue;
    const root = `${k === 1 ? '' : k}\\sqrt{${n}}`, rootPlain = `${k === 1 ? '' : k}√${n}`;
    return d === 1 ? done(`${sign}${rootPlain}`, `${sign}${root}`) : done(`${sign}${rootPlain}/${d}`, `${sign}\\frac{${root}}{${d}}`);
  }
  for (let d = 1; d <= 12; d++) {
    const n = Math.round((a * d) / Math.PI);
    if (n < 1 || n > 60 || !reproduces((n * Math.PI) / d)) continue;
    const g = gcd(n, d), p = n / g, q = d / g;
    return q === 1 ? done(`${sign}${p === 1 ? '' : p}π`, `${sign}${p === 1 ? '' : p}\\pi`) : done(`${sign}${p === 1 ? '' : p}π/${q}`, `${sign}\\frac{${p === 1 ? '' : p}\\pi}{${q}}`);
  }
  const r = Math.round(v * 1e4) / 1e4, s = String(Object.is(r, -0) ? 0 : r);
  return done(s, s);
}
// In a comment a value is a `$…$` span the client typesets (the plain form is exactForm(v).plain).
const shown = v => `$${exactForm(v).tex}$`;

/** The value of one side when it is plain arithmetic on numbers; null otherwise. */
function valueOf(side) {
  let ast;
  try { ast = parse(normalize(String(side).replace(/⁄/g, '/'))); } catch { return null; }
  if (!ast || ast.t === 'equation') return null;
  if ([...variablesOf(ast)].some(v => v !== 'e')) return null;   // any letter but the constants e and π: not arithmetic on numbers alone
  let v;
  try { v = evaluate(ast, {}); } catch { return null; }
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

// ── Lines that are true as written, whatever the question ────────────────────
// Owner, 19 November 2026: step marking on every Year 11 and 12 question. Two
// more kinds of line can be proved with nothing but the line itself, and both
// are TICK ONLY (a line of this kind is never crossed):
//   · an identity: both sides are the same function of the same letters
//     (12x^2/2 = 6x^2). Sides that differ may be an equation to solve, so
//     that is a note;
//   · a definite integral or a bracket evaluation, worked out numerically:
//     ∫_-2^4 12x dx, [6x^2]_-2^4. Limits are small marks that are easily
//     misread, which is the other reason such a line is never crossed.
const NOT_PROVED = 'Not checked: Pri cannot tell from this line alone whether it is true.';
const LIM = '(\\{[^{}]*\\}|\\([^()]*\\)|-?\\d+(?:\\.\\d+)?|-?(?:pi|π|e))';
const BRACKET_EVAL = new RegExp(`\\[([^\\[\\]]+)\\]_${LIM}\\^${LIM}`, 'g');
const INTEGRAL = new RegExp(`∫_${LIM}\\^${LIM}\\s*(.+?)\\s*d([a-z])(?![a-z])`, 'g');
const closeLoose = (a, b) => Math.abs(a - b) <= 1e-7 * Math.max(1, Math.abs(a), Math.abs(b));

/** A side as a number, or as a function of its letters; null when it cannot be read. */
export function infoOf(side) {
  let ast;
  try { ast = parse(normalize(String(side).replace(/⁄/g, '/'))); } catch { return null; }
  if (!ast || ast.t === 'equation') return null;
  const vars = [...variablesOf(ast)].filter(v => v !== 'e').sort();
  if (vars.length) return { ast, vars };
  let v;
  try { v = evaluate(ast, {}); } catch { return null; }
  return typeof v === 'number' && Number.isFinite(v) ? { value: v } : null;
}
const at = (info, v, x) => { try { const y = info.value !== undefined ? info.value : evaluate(info.ast, { [v]: x }); return typeof y === 'number' && Number.isFinite(y) ? y : null; } catch { return null; } };

/** Replace every definite integral and bracket evaluation by its value; null when one cannot be worked out. */
// An integrand or bracket body is read with a function's bare argument bracketed (`2sin2x`, `cos4x`), then as written.
const readBody = body => { let c = null; try { c = infoOf(cleanStatement(body)); } catch { c = null; } return c || infoOf(body); };
function workOutCalculus(text) {
  let failed = false, used = false;
  const limit = raw => { const info = infoOf(raw.replace(/^\{|\}$/g, '').replace(/π/g, 'pi')); return info && info.value !== undefined ? info.value : null; };
  const put = v => { used = true; return `(${String(Number(v.toPrecision(15)))})`; };
  let out = text.replace(INTEGRAL, (_, lo, hi, body, v) => {
    const a = limit(lo), b = limit(hi), f = readBody(body);
    if (a === null || b === null || !f || (f.vars && (f.vars.length !== 1 || f.vars[0] !== v))) { failed = true; return _; }
    const n = 2000, h = (b - a) / n;
    let sum = 0;
    for (let k = 0; k <= n; k++) { const y = at(f, v, a + k * h); if (y === null) { failed = true; return _; } sum += y * (k === 0 || k === n ? 1 : k % 2 ? 4 : 2); }
    return put(sum * h / 3);
  });
  out = out.replace(BRACKET_EVAL, (_, body, lo, hi) => {
    const a = limit(lo), b = limit(hi), f = readBody(body);
    if (a === null || b === null || !f || (f.vars && f.vars.length !== 1)) { failed = true; return _; }
    const v = f.vars ? f.vars[0] : 'x', top = at(f, v, b), bottom = at(f, v, a);
    if (top === null || bottom === null) { failed = true; return _; }
    return put(top - bottom);
  });
  if (failed || /∫|\]_|\]\^/.test(out)) return null;
  return { text: out, used };
}

/** The same number, or the same function of the same letters at every point tried. */
export function sameAsWritten(a, b) {
  if (a.value !== undefined && b.value !== undefined) return closeLoose(a.value, b.value);
  // Two functions must be of the same letters; a function and a number (sin²x + cos²x = 1) are compared at every point.
  const vars = a.vars || b.vars;
  if (a.ast && b.ast) {
    if (a.vars.join() !== b.vars.join()) return false;
    let equal;
    try { equal = exprEquivalent(a.ast, b.ast) === true; } catch { equal = false; }
    if (!equal) return false;
  }
  // Points of both signs. Where only one side has a value the two are not the same function (ln(x^2) and 2 ln x;
  // √(x^2) and x differ outright), so that is not an identity.
  let agreed = 0;
  for (const x of [-2.7, -1.3, -0.4, 0.6, 1.9, 3.1, 4.3]) {
    const env = Object.fromEntries(vars.map((v, k) => [v, x + 0.37 * k]));
    const val = info => { if (info.value !== undefined) return info.value; try { const y = evaluate(info.ast, env); return typeof y === 'number' && Number.isFinite(y) ? y : null; } catch { return null; } };
    const p = val(a), q = val(b);
    if ((p === null) !== (q === null)) return false;
    if (p === null) continue;
    if (!closeLoose(p, q)) return false;
    agreed++;
  }
  return agreed >= 3;
}

// ── Handwritten function notation, and the name of the step ──────────────────
// Owner, 19 November 2026 (a trig proof marked by a competitor step by step):
// students write sin θ, cos²θ, sec θ with no brackets. A named function is
// given its bracket only where the page can be read one way: the function, an
// optional whole-number power (not −1, which is the inverse), then ONE letter,
// for a trig function optionally with a number in front (sin 2θ), and nothing
// attached after it. sin x^2, sin x(x+1) and ln 2x stay unread.
const TRIG = 'sin|cos|tan|sec|cosec|csc|cot';
const FN_END = `(?!\\s*(?!${TRIG}|ln|log)[A-Za-z0-9^(θαβφ])`;   // nothing attached after it, across a space too (sin x y)
const TRIG_BARE = new RegExp(`(?<![A-Za-z])(${TRIG})\\s*(?:\\^\\s*(\\d)\\s*)?(?!\\()\\s*((?:\\d+(?:\\.\\d+)?)?\\s*(?:[A-Za-z]|[θαβφ]))${FN_END}`, 'g');
const LOG_BARE = new RegExp(`(?<![A-Za-z])(ln|log)\\s+([A-Za-z]|[θαβφ])${FN_END}`, 'g');
function bracketFunctions(text) {
  return text
    .replace(TRIG_BARE, (_, fn, power, arg) => (power ? `(${fn}(${arg.replace(/\s+/g, '')}))^${power}` : `${fn}(${arg.replace(/\s+/g, '')})`))
    .replace(LOG_BARE, (_, fn, arg) => `${fn}(${arg})`)
    // a logarithm of one plain number (log 3, ln 10), and a space before its bracket (log (3 + 2))
    .replace(/(?<![A-Za-z])(ln|log)\s+\(/g, '$1(')
    // (not when a fraction follows: ln 1/2 is ln(1/2) to the student and ln(1)/2 to a parser, so it stays unread;
    //  ln 3 / ln 10, a quotient of two logarithms, is read)
    .replace(/(?<![A-Za-z])(ln|log)\s*(\d+(?:\.\d+)?)(?!\s*[A-Za-z0-9^(.!])(?!\s*\/(?!\s*(?:ln|log)))/g, '$1($2)');
}

// ── e^x(…): the exponent and the bracket after it ────────────────────────────────────────────────────────────────────
// Owner, 19 November 2026: `e^x(2x - 4)` is e^x times (2x - 4), whatever the exponent is when it is ONE letter, a
// number, or a bracketed group and a bracket follows it. A bare `e^2x` stays ambiguous (e^(2x) or e^2 times x) and is
// never judged. The only other reading of `e^2(3)` is e^(2·3); a line that is true under that reading is never crossed.
const EXPONENT_LETTER_BRACKET = /(?<=e)\^\s*(-?\s*[A-Za-z])(?=\s*\()/g;
// Any power (a number, e or π raised to a number, π, a letter or a group) followed by one or more brackets: 2^3(2), e^π(2), e^2(3)(4).
const POWER_THEN_BRACKET = /(?:(?<![A-Za-z0-9.])\d+(?:\.\d+)?|(?<![A-Za-z])(?:e|π|pi))\s*\^\s*(-?\s*(?:\d+(?:\.\d+)?|π|pi|[A-Za-z]|\([^()]*\)))/g;
const closingBracket = (t, open) => { let depth = 0; for (let k = open; k < t.length; k++) { if (t[k] === '(') depth++; else if (t[k] === ')' && --depth === 0) return k; } return -1; };
/** Every other reading of a side: the exponent takes the first k brackets after it (k = 1, 2, …) at every such power. */
function exponentTakesBrackets(side) {
  const places = [];
  POWER_THEN_BRACKET.lastIndex = 0;
  for (let m; (m = POWER_THEN_BRACKET.exec(side)); ) {
    const brackets = [];
    let at = m.index + m[0].length;
    for (;;) {
      const open = side.slice(at).search(/\S/);
      if (open < 0 || side[at + open] !== '(') break;
      const end = closingBracket(side, at + open);
      if (end < 0) return [];
      brackets.push([at + open, end]); at = end + 1;
    }
    if (brackets.length) { places.push({ from: m.index, base: m[0].slice(0, m[0].indexOf('^')).trim(), exp: m[1].replace(/\s+/g, ''), brackets, end: at }); POWER_THEN_BRACKET.lastIndex = at; }
  }
  if (!places.length) return [];
  const most = Math.max(...places.map(p => p.brackets.length));
  const out = [];
  for (let k = 1; k <= most; k++) {
    let text = '', from = 0;
    for (const p of places) {
      const take = Math.min(k, p.brackets.length);
      text += side.slice(from, p.from) + `${p.base}^((${p.exp})${p.brackets.slice(0, take).map(([o, e]) => `*${side.slice(o, e + 1)}`).join('')})`;
      from = p.brackets[take - 1][1] + 1;
    }
    out.push(text + side.slice(from));
  }
  return out;
}
/** True when some choice of reading (product, or the exponent taking its brackets) makes every side agree. */
function trueUnderExponentReading(sides, values) {
  const alts = sides.map(s => exponentTakesBrackets(s).map(valueOf).filter(v => v !== null));
  if (alts.every(a => !a.length)) return false;
  const choices = sides.map((_, i) => [values[i], ...alts[i]]);
  const walk = (i, picked) => (i === choices.length ? picked.every(x => close(x, picked[0])) : choices[i].some(c => walk(i + 1, [...picked, c])));
  return walk(0, []);
}

// ── Degrees, and the name of a trigonometric step ─────────────────────────────────────────────────────────────────
// A number followed by ° is an angle in degrees. A line that uses one is read in radians (30° is 30π/180) and is TICK ONLY:
// never crossed, and a letter in it must stand inside a trigonometric function, so that a degree and a radian can never be
// mixed on one side of a sum (sin(180° - θ) = sin θ, sin 30° = 1/2). A degree sign after a letter is not read.
const DEGREE_SIGN = /(\d+(?:\.\d+)?)\s*°/g;
const TRIG_CALLS = /(?<![A-Za-z])(?:sin|cos|tan|sec|cosec|csc|cot)\(/g;
function lettersOnlyInTrig(t) {
  let s = t;
  for (let guard = 0; guard < 8; guard++) {
    TRIG_CALLS.lastIndex = 0;
    const calls = [...s.matchAll(TRIG_CALLS)];
    if (!calls.length) break;
    const m = calls[calls.length - 1];   // the last call opened is the innermost one to close first
    const open = m.index + m[0].length - 1;
    let depth = 0, end = -1;
    for (let k = open; k < s.length; k++) { if (s[k] === '(') depth++; else if (s[k] === ')' && --depth === 0) { end = k; break; } }
    if (end < 0) return false;
    s = `${s.slice(0, m.index)}#${s.slice(end + 1)}`;
  }
  return !/[A-Za-zθαβφ]/.test(s.replace(/#/g, '').replace(/(?<![A-Za-z])(?:pi|e)(?![A-Za-z])/g, ''));
}
const TRIG_FN = new Set(['sin', 'cos', 'tan']);
const trigCall = n => {   // { fn, arg } for ±fn(arg), else null
  n = unwrap(n);
  while (n && n.t === 'neg') n = unwrap(n.v);
  return n && n.t === 'call' && !Array.isArray(n.args) && TRIG_FN.has(n.fn) ? { fn: n.fn, arg: unwrap(n.arg) } : null;
};
const hasPi = n => !!n && typeof n === 'object' && ((n.t === 'const' && n.v === 'pi') || (n.t === 'var' && n.v === 'pi') || ['l', 'r', 'v', 'arg'].some(k => hasPi(n[k])));
const hasCall = n => !!n && typeof n === 'object' && ((n.t === 'call' && n.fn !== 'sqrt' && n.fn !== 'cbrt') || ['l', 'r', 'v', 'arg'].some(k => hasCall(n[k])));   // a function: a root is a number
const constantOf = n => { try { const y = evaluate(n, {}); return typeof y === 'number' && Number.isFinite(y) ? y : null; } catch { return null; } };
const nearly = (a, b) => Math.abs(a - b) <= 1e-9;
const TRIG_POINTS = [-2.7, -1.3, -0.4, 0.6, 1.9, 3.1];
/**
 * 'a related angle' or 'an exact value' for the step from one side to the next, or ''. Said only for the direction that
 * happened, and only about a line already proved true:
 *   related angle  sin(π - x) = sin x, cos(π + x) = -cos x, tan(2π - x) = -tan x, sin 150° = sin 30°: the first side
 *                  is the function of π ± the second side's angle (2π only as 2π - x), the second carries no π, and
 *                  for numbers the second angle is the acute one;
 *   exact value    sin 30° = 1/2, cos(π/4) = 1/√2, tan 60° = √3: a function of 0, 30°, 45°, 60° or 90° set equal
 *                  to a number with no function in it.
 * Anything else, and the same lines the other way round (1/2 = sin 30°, sin x = sin(π - x)), is named nothing.
 */
function trigStepName(fromText, toText) {
  let a, b;
  try { a = parse(normalize(fromText)); b = parse(normalize(toText)); } catch { return ''; }
  if (!a || !b || a.t === 'equation' || b.t === 'equation') return '';
  const ca = trigCall(a), cb = trigCall(b);
  if (ca && !hasCall(b)) {
    const angle = constantOf(ca.arg), value = constantOf(b);
    if (angle === null || value === null || variablesOf(b).size) return '';
    if ([0, Math.PI / 6, Math.PI / 4, Math.PI / 3, Math.PI / 2].some(x => nearly(angle, x))) return 'an exact value';
    return '';
  }
  if (!ca || !cb || ca.fn !== cb.fn) return '';
  const numericA = constantOf(ca.arg), numericB = constantOf(cb.arg);
  if (numericA !== null && numericB !== null) {
    if (!(numericB > 1e-9 && numericB <= Math.PI / 2 + 1e-9) || nearly(numericA, numericB)) return '';
    return [[Math.PI, 1], [Math.PI, -1], [2 * Math.PI, -1]].some(([c, s]) => nearly(numericA, c + s * numericB)) ? 'a related angle' : '';
  }
  if (numericA !== null || numericB !== null || !hasPi(ca.arg) || hasPi(cb.arg)) return '';
  const vars = [...variablesOf(ca.arg)];
  if (!vars.length || vars.join() !== [...variablesOf(cb.arg)].join()) return '';
  const at = (n, x) => { try { const y = evaluate(n, Object.fromEntries(vars.map((v, k) => [v, x + 0.37 * k]))); return typeof y === 'number' && Number.isFinite(y) ? y : null; } catch { return null; } };
  return [[Math.PI, 1], [Math.PI, -1], [2 * Math.PI, -1]].some(([c, s]) => TRIG_POINTS.every(x => { const p = at(ca.arg, x), q = at(cb.arg, x); return p !== null && q !== null && nearly(p, c + s * q); })) ? 'a related angle' : '';
}

// ── Like terms left uncollected in the last line ────────────────────────────────────────────────────────────────────
// 2x + 3x as the last side of a ticked line: said once as a note, "This simplifies to 5x." Read by shape alone, from the
// parsed sum: every term a whole-number multiple of one product of letters (powers by whole numbers), two or more terms
// with the same letters, and the collected sum equal to the written one at points of both signs. Decimals, units
// (a letter next to a letter, a space between a number and a letter), roots, quotients and functions are never read.
function collectLikeTerms(side) {
  const text = String(side).replace(/[−–—]/g, '-');
  // (a letter that may be a unit, m s g h or a capital, is not read either: 2m + 3m may be metres)
  if (/[A-Za-z]{2,}|\d\s+[A-Za-z]|[.\/√()πθ]|\^\s*-|[A-Zmsgh]/.test(text.replace(/\^\s*\d+/g, '^'))) return '';
  let ast;
  try { ast = parse(normalize(text)); } catch { return ''; }
  const flat = (n, sign, out) => {
    n = unwrap(n);
    if (n.t === 'bin' && (n.op === '+' || n.op === '-')) { flat(n.l, sign, out); flat(n.r, n.op === '-' ? -sign : sign, out); return out; }
    if (n.t === 'neg') return flat(n.v, -sign, out);
    out.push([n, sign]);
    return out;
  };
  const monomial = n => {   // { coef, powers: Map letter → exponent } or null
    n = unwrap(n);
    if (n.t === 'num') return Number.isInteger(n.v) ? { coef: n.v, powers: new Map() } : null;
    if (n.t === 'var') return n.v === 'e' ? null : { coef: 1, powers: new Map([[n.v, 1]]) };
    if (n.t === 'neg') { const m = monomial(n.v); return m && { coef: -m.coef, powers: m.powers }; }
    if (n.t === 'bin' && n.op === '*') {
      const l = monomial(n.l), r = monomial(n.r);
      if (!l || !r) return null;
      const powers = new Map(l.powers);
      for (const [k, v] of r.powers) powers.set(k, (powers.get(k) || 0) + v);
      return { coef: l.coef * r.coef, powers };
    }
    if (n.t === 'bin' && n.op === '^') {
      const base = monomial(n.l), p = unwrap(n.r);
      if (!base || base.coef !== 1 || p.t !== 'num' || !Number.isInteger(p.v) || p.v < 2 || p.v > 6) return null;
      return { coef: 1, powers: new Map([...base.powers].map(([k, v]) => [k, v * p.v])) };
    }
    return null;
  };
  const written = flat(ast, 1, []);
  if (written.length < 2 || written.length > 8) return '';
  const groups = new Map();
  for (const [n, sign] of written) {
    const m = monomial(n);
    if (!m) return '';
    const key = [...m.powers].sort(([p], [q]) => (p < q ? -1 : 1)).map(([k, v]) => `${k}^${v}`).join('*');
    const g = groups.get(key) || { coef: 0, powers: m.powers };
    g.coef += sign * m.coef;
    groups.set(key, g);
  }
  if (groups.size >= written.length) return '';   // nothing to collect
  const parts = [...groups.values()].filter(g => g.coef !== 0).map(g => {
    const letters = [...g.powers].sort(([p], [q]) => (p < q ? -1 : 1)).map(([k, v]) => (v === 1 ? k : `${k}^${v}`)).join('');
    const mag = Math.abs(g.coef);
    return { sign: g.coef < 0 ? '-' : '+', body: letters ? `${mag === 1 ? '' : mag}${letters}` : String(mag) };
  });
  const collected = parts.length ? parts.map((p, k) => (k === 0 ? (p.sign === '-' ? '-' : '') : ` ${p.sign} `) + p.body).join('') : '0';
  // The same function at points of both signs, or it is not offered.
  // (compared over the letters of both, so 5x - 5x + z and z are the same function of x and z)
  let b;
  try { b = parse(normalize(collected)); } catch { return ''; }
  const letters = [...new Set([...variablesOf(ast), ...variablesOf(b)])].filter(v => v !== 'e');
  for (const x of [-2.7, -1.3, -0.4, 0.6, 1.9, 3.1, 4.3]) {
    const env = Object.fromEntries(letters.map((v, k) => [v, x + 0.37 * k]));
    let p, q;
    try { p = evaluate(ast, env); q = evaluate(b, env); } catch { return ''; }
    if (typeof p !== 'number' || typeof q !== 'number' || !closeLoose(p, q)) return '';
  }
  return collected;
}

// The comment on a tick may name the step, but only as something the two
// sides are seen to do ("It matches …"): the tick itself rests on the two
// sides being equal, never on this description.
function nameOfStep(fromRaw, toRaw) {
  const a = String(fromRaw || '').toLowerCase().replace(/\s+/g, ''), b = String(toRaw || '').toLowerCase().replace(/\s+/g, '');
  if (!a || !b) return '';
  const v = (a.replace(/cosec/g, 'csc').match(/(?<![a-z])(?:sin|cos|tan|sec|csc|cot)(?:\^\(?\d\)?)?\(?\d*([a-zθαβφ])(?![a-z])/) || [])[1] || 'θ';
  const has = (t, fn) => new RegExp(`(?<![a-z])${fn}(?![a-z])`).test(t.replace(/cosec/g, 'csc'));
  const A = a.replace(/cosec/g, 'csc'), B = b.replace(/cosec/g, 'csc');
  if (has(A, 'sec') && !has(B, 'sec') && has(B, 'cos')) return `the reciprocal identity sec ${v} = 1/cos ${v}`;
  if (has(A, 'csc') && !has(B, 'csc') && has(B, 'sin')) return `the reciprocal identity cosec ${v} = 1/sin ${v}`;
  if (has(A, 'cot') && !has(B, 'cot') && has(B, 'tan')) return `the reciprocal identity cot ${v} = 1/tan ${v}`;
  if (has(A, 'cot') && !has(B, 'cot') && has(B, 'sin') && has(B, 'cos')) return `cot ${v} = cos ${v} / sin ${v}`;
  const sq = (t, fn) => new RegExp(`${fn}\\^\\(?2|\\(${fn}\\([^)]*\\)\\)\\^\\(?2|${fn}\\([^)]*\\)\\^\\(?2`).test(t);
  if (/1[-+]/.test(A) && ((sq(A, 'cos') && !sq(B, 'cos') && sq(B, 'sin')) || (sq(A, 'sin') && !sq(B, 'sin') && sq(B, 'cos')))) return `the Pythagorean identity sin²${v} + cos²${v} = 1`;
  if (/1\+/.test(A) && sq(A, 'tan') && sq(B, 'sec') && !sq(A, 'sec')) return `the identity 1 + tan²${v} = sec²${v}`;
  if (has(B, 'tan') && !has(A, 'tan') && has(A, 'sin') && has(A, 'cos')) return `tan ${v} = sin ${v} / cos ${v}`;
  if (has(A, 'tan') && !has(B, 'tan') && has(B, 'sin') && has(B, 'cos')) return `tan ${v} = sin ${v} / cos ${v}`;
  if (/(?:sin|cos|tan)\(?2[a-zθαβφ]/.test(A) !== /(?:sin|cos|tan)\(?2[a-zθαβφ]/.test(B)) return 'a double-angle identity';
  if (/\+/.test(A) && sq(A, 'sin') && sq(A, 'cos') && !(sq(B, 'sin') && sq(B, 'cos'))) return `the Pythagorean identity sin²${v} + cos²${v} = 1`;
  // Brackets that only hold a function's argument, or wrap a function for its power, are not brackets to expand.
  const plain = t => t.replace(/(?:sqrt|sin|cos|tan|sec|csc|cot|ln|log)\(/g, '#[').replace(/#\[[^()]*\)/g, '#').replace(/\(#\)/g, '#');
  const pa = plain(A), pb = plain(B);
  if (/\(/.test(pa) && !/\(/.test(pb) && !/\//.test(pa)) return 'expanding the brackets';
  if (!/\(/.test(pa) && /\)\(|\d\(|[a-zθ]\(|\)\^/.test(pb) && !/\//.test(pb)) return 'factorising';
  const fractions = t => (t.match(/\//g) || []).length;
  if (fractions(pa) >= 1 && /[-+]/.test(pa.replace(/\([^()]*\)/g, '')) && fractions(pb) === 1 && /^\(.*\)\/[^/]+$/.test(pb)) return 'putting the terms over a common denominator';
  return '';
}

// ── Naming the rule on a tick (words only: no line's verdict depends on anything below) ─────────────────────────────
// stepJustify.js proves which rule turns one expression into the next; when it names one, the comment says so in the
// same words the working view uses for that rule (AnnotatedWorking.jsx, aw.rule.*; the test pins each phrase to its
// label). When it names none, the older pattern namer above is the fallback, and otherwise nothing is said.
const RULE_PHRASE = Object.freeze({
  'reciprocal': 'the reciprocal identity', 'quotient': 'the quotient identity', 'pythagorean': 'the Pythagorean identity',
  'pythagorean-tan': 'the Pythagorean identity (tan and sec)', 'pythagorean-cot': 'the Pythagorean identity (cot and cosec)',
  'double-angle-sin': 'the double-angle formula for sine', 'double-angle-cos': 'the double-angle formula for cosine',
  'double-angle-cos-cos': 'the double-angle formula for cosine', 'double-angle-cos-sin': 'the double-angle formula for cosine',
  'double-angle-tan': 'the double-angle formula for tangent', 'compound-sin': 'the compound-angle formula for sine',
  'compound-cos': 'the compound-angle formula for cosine', 'compound-tan': 'the compound-angle formula for tangent',
  'log-product': 'the log law for a product', 'log-quotient': 'the log law for a quotient', 'log-power': 'the log law for a power',
  'common-denominator': 'writing as one fraction over a common denominator', 'split-fraction': 'splitting a fraction',
  'divide-fraction': 'dividing by a fraction (multiply by its reciprocal)', 'multiply-fractions': 'multiplying fractions',
  'cancel-common-factor': 'cancelling a common factor', 'index-product': 'the index law: multiplying powers',
  'index-power': 'the index law: power of a power', 'index-quotient-power': 'the index law: power of a quotient',
  'expand': 'expanding brackets', 'factorise': 'factorising', 'difference-of-squares': 'the difference of two squares'
});
export const RULE_PHRASES = RULE_PHRASE;
// A name that states a DIRECTION is used only when the two sides show that direction (read from the parsed trees):
//   expanding brackets     the line before has a bracketed sum multiplied or raised, and this line has strictly fewer;
//   factorising            this line is a product (or power) with a bracketed factor, and the line before is not;
//   difference of squares  one side is such a product and the other is not.
// Otherwise the step is named nothing.
const sumNode = x => { x = unwrap(x); return !!x && x.t === 'bin' && (x.op === '+' || x.op === '-'); };
function bracketsMultiplied(n) {
  if (!n || typeof n !== 'object') return 0;
  let c = 0;
  if (n.t === 'bin' && n.op === '*') c += (sumNode(n.l) ? 1 : 0) + (sumNode(n.r) ? 1 : 0);
  if (n.t === 'bin' && n.op === '^' && sumNode(n.l) && unwrap(n.r).t === 'num') c++;
  for (const k of ['l', 'r', 'v', 'arg']) if (n[k] && typeof n[k] === 'object') c += bracketsMultiplied(n[k]);
  return c;
}
function wholeProduct(n) {
  n = unwrap(n);
  while (n && n.t === 'neg') n = unwrap(n.v);
  if (!n) return false;
  if (n.t === 'bin' && n.op === '^') return sumNode(n.l) && unwrap(n.r).t === 'num';
  if (n.t === 'bin' && n.op === '*') return productFactors(n).some(sumNode);
  return false;
}
function directionHolds(kind, fromText, toText) {
  let a, b;
  try { a = parse(normalize(fromText)); b = parse(normalize(toText)); } catch { return false; }
  if (!a || !b || a.t === 'equation' || b.t === 'equation') return false;
  if (kind === 'expand') return bracketsMultiplied(a) > 0 && bracketsMultiplied(b) === 0;   // none left multiplied or raised: a partial expansion or a regrouping is not named
  if (kind === 'factorise') return wholeProduct(b) && !wholeProduct(a);
  return wholeProduct(a) !== wholeProduct(b);   // difference of two squares
}
const DIRECTED = { 'expand': 'expand', 'factorise': 'factorise', 'difference-of-squares': 'squares' };
function nameOfRule(fromText, toText) {
  let j = null;
  try { j = justifyStep(fromText, toText); } catch { j = null; }
  const ids = ((j && j.valid && j.rules) || []).map(r => r.rule).filter(id => !DIRECTED[id] || directionHolds(DIRECTED[id], fromText, toText));
  const phrases = [...new Set(ids.map(id => RULE_PHRASE[id]).filter(Boolean))];
  // The pattern namer often says the same thing with the formula written out (`the reciprocal identity sec θ = 1/cos θ`):
  // when it starts with the proved rule's phrase, its fuller wording is used.
  let older = nameOfStep(fromText, toText);
  if (older === 'expanding the brackets' && !directionHolds('expand', fromText, toText)) older = '';
  if (older === 'factorising' && !directionHolds('factorise', fromText, toText)) older = '';
  if (phrases.length === 1 && older.startsWith(phrases[0])) return older;
  if (phrases.length) return phrases.join(' and ');
  return older;
}

// ── The rule behind a derivative, from the SHAPE of the function that was defined ─────────────────────────────────
// The tick on `u' = …` rests on the number check. The words say a fact about the function the page defined, read from its
// parsed expression tree: a polynomial, a function of an inner function, a product of two functions of x, a quotient of two.
// Anything else, or a mixture, is named nothing.
const unwrap = n => { while (n && n.t === 'group') n = n.v; return n; };
const dependsOn = (n, v) => !!n && typeof n === 'object' && (n.t === 'var' ? n.v === v : ['l', 'r', 'v', 'arg'].some(k => n[k] && typeof n[k] === 'object' && dependsOn(n[k], v)));
const CHAIN_FUNCTIONS = new Set(['sin', 'cos', 'tan', 'sec', 'cosec', 'csc', 'cot', 'ln', 'log', 'exp', 'sqrt', 'arcsin', 'arccos', 'arctan', 'asin', 'acos', 'atan']);
function powerTerm(n, v) {
  n = unwrap(n);
  if (!dependsOn(n, v)) return true;
  if (n.t === 'neg') return powerTerm(n.v, v);
  if (n.t === 'var') return n.v === v;
  if (n.t === 'bin' && n.op === '^') return unwrap(n.l).t === 'var' && unwrap(n.l).v === v && !dependsOn(n.r, v);
  if (n.t === 'bin' && n.op === '*') return !dependsOn(n.l, v) ? powerTerm(n.r, v) : !dependsOn(n.r, v) ? powerTerm(n.l, v) : false;
  if (n.t === 'bin' && n.op === '/') return !dependsOn(n.r, v) && powerTerm(n.l, v);
  return false;
}
const hasPower = n => !!n && typeof n === 'object' && ((n.t === 'bin' && n.op === '^') || ['l', 'r', 'v', 'arg'].some(k => hasPower(n[k])));   // a straight line alone is not named
function sumTerms(n, out = []) { n = unwrap(n); if (n.t === 'bin' && (n.op === '+' || n.op === '-')) { sumTerms(n.l, out); sumTerms(n.r, out); } else out.push(n); return out; }
function productFactors(n, out = []) { if (n.t === 'bin' && n.op === '*') { productFactors(n.l, out); productFactors(n.r, out); } else out.push(n); return out; }
/** { rule, inner } for the function n of v, where inner is the inner function of a chain; null when no rule is named. */
function shapeOf(n, v) {
  n = unwrap(n);
  if (!dependsOn(n, v)) return null;
  if (n.t === 'neg') return shapeOf(n.v, v);
  if (n.t === 'bin' && (n.op === '+' || n.op === '-')) return sumTerms(n).every(t => powerTerm(t, v)) && hasPower(n) ? { rule: 'power rule' } : null;
  if (n.t === 'bin' && n.op === '*') {
    const moving = productFactors(n).filter(f => dependsOn(f, v));
    if (moving.length === 1) return shapeOf(moving[0], v);
    return moving.length === 2 ? { rule: 'product rule' } : null;
  }
  if (n.t === 'bin' && n.op === '/') return !dependsOn(n.r, v) ? shapeOf(n.l, v) : dependsOn(n.l, v) ? { rule: 'quotient rule' } : null;
  if (n.t === 'bin' && n.op === '^') {
    const base = unwrap(n.l);
    if (!dependsOn(n.r, v)) return base.t === 'var' && base.v === v ? { rule: 'power rule' } : { rule: 'chain rule', inner: base };
    if (!dependsOn(base, v)) { const e = unwrap(n.r); return e.t === 'var' && e.v === v ? null : { rule: 'chain rule', inner: e }; }
    return null;
  }
  if (n.t === 'call' && !Array.isArray(n.args) && CHAIN_FUNCTIONS.has(n.fn)) { const a = unwrap(n.arg); return a.t === 'var' && a.v === v ? null : { rule: 'chain rule', inner: a }; }
  return null;
}
/** The inner function's derivative when it is one constant (checked at several points), as exact TeX; null otherwise. */
function innerDerivative(inner, v) {
  const at = x => { try { const y = evaluate(inner, { [v]: x }); return typeof y === 'number' && Number.isFinite(y) ? y : null; } catch { return null; } };
  let c = null;
  for (const x of POINTS) {
    const a = at(x + 1e-4), b = at(x - 1e-4);
    if (a === null || b === null) return null;
    const slope = (a - b) / 2e-4;
    if (c === null) c = slope; else if (Math.abs(slope - c) > 1e-7 * Math.max(1, Math.abs(c))) return null;
  }
  if (c === null || Math.abs(c) < 1e-9 || Math.abs(c - 1) < 1e-9) return null;
  // The central difference of a straight line carries rounding noise: it is read as a whole number or a simple fraction (d <= 12) or not at all.
  for (let d = 1; d <= 12; d++) {
    const n = Math.round(c * d);
    if (n !== 0 && Math.abs(c * d - n) < 1e-8) return `$${exactForm(n / d).tex}$`;
  }
  return null;
}
/** ", by the chain rule with the inner derivative $2$" for the function `text` of `variable`; '' when nothing can be said. */
function derivativeRuleWords(text, variable) {
  let ast;
  try { ast = parse(normalize(text)); } catch { return ''; }
  if (!ast || ast.t === 'equation') return '';
  const shape = shapeOf(ast, variable);
  if (!shape) return '';
  const inner = shape.inner ? innerDerivative(shape.inner, variable) : null;
  return `, by the ${shape.rule}${inner ? ` with the inner derivative ${inner}` : ''}`;
}

// ── Whether the last line's answer is a value yet ────────────────────────────────────────────────────────────────
// A worked expression of plain numbers (2[32 - 64/3], -2 × √3/2, 6 × 12) that is not yet one value gets "This simplifies
// to X", with X from exactForm and only when exactForm has an exact form (a rounded decimal is never offered).
const plainForm = side => String(side).replace(/[−–—]/g, '-').replace(/\s+/g, '').replace(/[×·]/g, '*').replace(/sqrt/gi, '√').replace(/\bpi\b|(?<=\d)pi/gi, 'π')
  .replace(/\((-?\d+(?:\.\d+)?|√\d+|π)\)/g, '$1').replace(/√\((\d+)\)/g, '√$1');
function simplifiesTo(side, stated) {
  const v = valueOf(side);
  if (v === null) return '';
  const compact = plainForm(side);
  if (/^-?(?:\d+\.\d*|\.\d+)$/.test(compact)) return '';          // a decimal is a value
  const exact = exactForm(v);
  if (/[.]|NaN|Infinity/.test(exact.plain)) return '';
  if (compact === exact.plain.replace(/−/g, '-')) return '';       // already the single value
  if (stated && stated.includes(`$${exact.tex}$`)) return ' Give the final answer in that simplified form.';   // the value is already said: not said twice
  return ` This simplifies to $${exact.tex}$.`;
}


// Hoisted so that the plain-number path can use it for lines with e or π.
const folded = side => { let t = side, last; do { last = t; t = t.replace(/\([^()]*\)/g, '#'); } while (t !== last); return t.replace(/(?:√|∛|sqrt)\s*(?:#|\d+(?:\.\d+)?|[A-Za-zθαβφπ])/gi, '#'); };   // a root is one factor too: 1/√2 x
// Structural, not a list of cases: after a division sign comes ONE denominator (a function with its bracket, a
// bracket, a root, a number, or one letter, with an optional power) and then an operator, a closing bracket or the
// end of the side. Anything else attached to it, or a denominator of another shape, or a later `*`, is not read.
const DENOMINATOR = '(?:[A-Za-z]{2,6}#|#|\\d+(?:\\.\\d+)?!?(?![\\d.!])|[A-Za-zθαβφπ](?![A-Za-z]))(?:\\^(?:#|-?\\d+(?!\\d)|[A-Za-zθαβφπ]))?';
const twoWays = t => new RegExp(`[\\/÷]\\s*${DENOMINATOR}\\s*(?![-+=)\\/÷,^\\s]|$)`).test(t) || new RegExp(`[\\/÷](?!\\s*${DENOMINATOR})`).test(t) || /[\/÷].*\*/.test(t);

/** Other ways the same ink may be read: one whole number split as a power or as a fraction. */
function otherReadings(side) {
  const out = [];
  const re = /\d+(?:\.\d+)?/g;
  let m;
  while ((m = re.exec(side)) && out.length < 24) {
    const tok = m[0];
    if (tok.includes('.') || tok.length < 2 || tok.length > 4) continue;
    const before = side[m.index - 1], after = side[m.index + tok.length];
    if (before === '.' || after === '.') continue;
    for (let k = 1; k < tok.length; k++) {
      const a = tok.slice(0, k), b = tok.slice(k);
      if (/^0/.test(b) && b.length > 1) continue;
      for (const joined of [`(${a})^(${b})`, `((${a})/(${b}))`]) out.push(side.slice(0, m.index) + joined + side.slice(m.index + tok.length));
    }
  }
  return out;
}

/** True when re-reading one or two of the numbers on one side makes every side agree. */
function trueUnderAnotherReading(sides, values) {
  // per side: the readings one step away, and (capped) two steps away
  const variants = sides.map(side => {
    const one = otherReadings(side);
    const two = one.slice(0, 12).flatMap(v => otherReadings(v)).slice(0, 60);
    return { one: one.map(valueOf).filter(v => v !== null), all: [...one, ...two].map(valueOf).filter(v => v !== null) };
  });
  const agree = all => all.every(x => close(x, all[0]));
  for (let i = 0; i < sides.length; i++) {
    for (const v of variants[i].all) if (agree(values.map((x, k) => (k === i ? v : x)))) return true;
  }
  return false;
}


// ── What the page itself defines ─────────────────────────────────────────────
// Owner, 19 November 2026 (side by side with a competitor that follows a value
// from line to line): a second pass over the lines the first pass left unmarked.
// It keeps what the student defined on the page and holds later lines to it:
//
//   k = ln(3)/8                       a definition (not judged)
//   A = 12e^(4k) = 12e^(ln(3)/4)      crossed: with k from above, 12e^(4k) is 20.78…, not 15.79…
//   u = x^2 - 4x + 1,  u' = 2x - 4    ticked: the derivative of u, checked numerically
//   e^(8k) = 3 so k = ln(3)/8         ticked: k satisfies the equation before it
//   -x^2 + 6x - 5 = 0,  (x-5)(x-1) = 0   ticked: the same equation, rearranged
//
// A cross needs a worked chain under a name (A = … = …) whose sides are plain
// numbers once the definitions are put in, with no decimal written on the line; a wrong derivative is crossed only
// when it differs clearly at every point tried. Everything else is a tick or
// stays a note. Nothing here reads the question or the answer.
const KEEP = /^(?:sqrt|arcsin|arccos|arctan|asin|acos|atan|cosec|sin|cos|tan|sec|csc|cot|ln|log|exp|abs|pi|e)$/i;
const STATEMENT_SPLIT = /\s+(?:so|and|hence|therefore|then|thus|giving|gives)\s+|\s*(?:⇒|=>|∴)\s*/i;
const POINTS = [-2.3, -1.1, 0.7, 1.6, 2.9];

export function cleanStatement(text) {
  return bracketFunctions(text.replace(/\s*\.\s*$/, '').replace(/[−–—]/g, '-').replace(/[×·]/g, '*').replace(/÷/g, '/')
    .replace(/(\d|\)|!)\s+x\s+(?=\d|\()/gi, '$1*').replace(/\[([^\[\],;_]*)\](?![_^])/g, '($1)'));
}

/** Put the page's definitions into a side. Returns { text, used } or null when a letter stays that is neither defined nor `free`. */
function putIn(side, defs, free) {
  const used = new Set();
  let bad = false;
  // a defined function applied to an argument: M(2), f'(5)
  let t = side.replace(/([A-Za-z])('?)\(([^()]*)\)/g, (m, name, prime, arg) => {
    const d = defs[name + prime];
    if (!d || !d.variable) return m;
    used.add(name + prime);
    return `(${d.expr.replace(new RegExp(`(?<![A-Za-z])${d.variable}(?![A-Za-z])`, 'g'), `(${arg})`)})`;
  });
  t = t.replace(/[A-Za-z]+'?/g, tok => {
    const prime = tok.endsWith("'"), word = prime ? tok.slice(0, -1) : tok;
    if (KEEP.test(word)) { if (prime) bad = true; return tok; }
    return [...word].map((c, k) => {
      const key = c + (prime && k === word.length - 1 ? "'" : '');
      const d = defs[key];
      if (d && !d.variable) { used.add(key); return `(${d.expr})`; }
      if (d && d.variable && free === d.variable) { used.add(key); return `(${d.expr})`; }
      if (key.endsWith("'") || (c !== free)) bad = true;
      return c;
    }).join('*');
  });
  if (bad || /'/.test(t)) return null;
  return { text: t, used: [...used] };
}
const numberOf = text => { const i = infoOf(text); return i && i.value !== undefined ? i.value : null; };
const fnOf = (text, v) => { const i = infoOf(text); if (!i) return null; if (i.value !== undefined) return () => i.value; if (i.vars.join() !== v) return null; return x => { try { const y = evaluate(i.ast, { [v]: x }); return Number.isFinite(y) ? y : null; } catch { return null; } }; };
const lettersOf = text => [...new Set((text.replace(/[A-Za-z]+/g, w => (KEEP.test(w) ? ' ' : w)).match(/[A-Za-z]/g) || []))];

/** `x = 0 or x = -3`, `x = 0, x = -3`, `x = 0 and -3`, `x = ±2`: { letter, items: [{ value }] } with two or more values, or null. */
function rootList(text) {
  const t = text.replace(/\s*\.\s*$/, '').replace(/^(?:so|hence|therefore|thus|then|∴)\s+/i, '').trim();
  const m = t.match(/^([A-Za-z])\s*=\s*(.+)$/);
  if (!m) return null;
  const pm = m[2].match(/^±\s*(\S+)$/);
  if (pm) return { letter: m[1], items: [{ value: pm[1] }, { value: `-${pm[1]}` }] };
  const pieces = m[2].split(/\s*(?:,|\bor\b|\band\b)\s*/i).map(x => x.trim());
  if (pieces.length < 2 || pieces.some(x => !x)) return null;
  const items = [];
  for (const piece of pieces) {
    const self = piece.match(new RegExp(`^${m[1]}\\s*=\\s*(.+)$`));
    const value = (self ? self[1] : piece).trim();
    if (/[=<>A-Za-z]/.test(value.replace(/(?:sqrt|pi)/gi, '')) || /^±/.test(value)) return null;
    items.push({ value });
  }
  return { letter: m[1], items };
}


// ── What the question itself gives (questionFacts.js) ────────────────────────────────────────────────────────────────
// Owner's page, 20 November 2026: `y = 2x(4 - x)` copied from the question, and `Area = ∫_0^4 2x(4 - x) dx` setting up
// the integral it asks for, were true lines that got only a note. The prompt's own facts (questionFacts.js, read from the
// prompt alone) are used as follows, and only to TICK or to leave a note, never to cross:
//   · (only definitions are facts: an equation or expression the prompt states may be false, so it is never given)
//   · a line that restates a given definition, or is the same function of the same letters, is ticked as given;
//   · a given definition is put in as the page's own, for the later lines that use it (y(2) = 8, y' = …);
//   · `Area = ∫_a^b f dx` is ticked when f is the one curve the question gives, it is a quadratic that opens downward,
//     a and b are its two roots, and the WHOLE prompt is a plain request for the area bounded by it and the x-axis
//     (questionFacts.js: a whitelist, so a restriction on the region never reaches here);
//   · a line that nearly copies a given but differs (one digit or sign) stays a note saying so.
const GIVEN_NOTE = 'This is given in the question.';
const MISMATCH_NOTE = 'This does not match what the question gives: check you copied it correctly.';
const PART_LABEL = /^\(?(?:[a-h]|i{1,3}|iv|v|vi{0,3})[.)]\s|^\([a-h]\)|^(?:part|question|q)\s*\(?[a-h0-9]/i;

/** The text of a statement with spacing, products and redundant outer brackets set aside: equal keys are the same writing. */
function textKey(s) {
  let t = cleanStatement(String(s).replace(/\s*\.\s*$/, '')).replace(/\s+/g, '');
  t = t.replace(/(?<!\d)\*|\*(?!\d)/g, '').replace(/([_^])\{(-?[A-Za-z0-9]+)\}/g, '$1$2');
  for (let k = 0; k < 4 && t.startsWith('(') && t.endsWith(')'); k++) {
    let depth = 0, whole = true;
    for (let j = 0; j < t.length; j++) { if (t[j] === '(') depth++; else if (t[j] === ')') depth--; if (depth === 0 && j < t.length - 1) { whole = false; break; } }
    if (!whole) break;
    t = t.slice(1, -1);
  }
  return t;
}
function editDistance(a, b, cap) {
  if (Math.abs(a.length - b.length) > cap) return cap + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    for (let j = 1; j <= b.length; j++) row[j] = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = row;
  }
  return prev[b.length];
}
const sameExpr = (a, b) => { const x = infoOf(cleanStatement(a)), y = infoOf(cleanStatement(b)); return !!(x && y && sameAsWritten(x, y)); };

/** The prompt's facts, checked and ready to use: { byName, seeds, texts, area } or null. */
function prepareFacts(facts) {
  if (!facts || typeof facts !== 'object') return null;
  const byName = new Map();
  for (const d of Array.isArray(facts.defs) ? facts.defs.slice(0, 20) : []) {
    if (!d || typeof d.name !== 'string' || typeof d.expr !== 'string' || !/^[A-Za-z]$/.test(d.name)) continue;
    const expr = cleanStatement(d.expr), info = infoOf(expr);
    if (!info || (info.value === undefined && !info.vars)) continue;
    const vars = info.vars || [];
    const variable = d.variable || (vars.length === 1 ? vars[0] : null);
    const list = byName.get(d.name) || [];
    if (!list.some(e => e.key === textKey(expr))) list.push({ name: d.name, variable, expr, info, vars, key: textKey(expr) });
    byName.set(d.name, list);
  }
  // The seeds: a name given once, as one function of one letter or as one number.
  const seeds = {};
  for (const [name, list] of byName) {
    if (list.length !== 1) continue;
    const e = list[0];
    if (e.info.value === undefined && e.vars.length !== 1) continue;
    seeds[name] = { expr: e.expr, shown: e.expr, variable: e.info.value !== undefined ? null : e.variable, line: -1e9, given: true };
  }
  // The area bounded by the one curve and the x-axis: its form is checked here, its limits when a line states them.
  let area = null;
  if (facts.area && typeof facts.area.name === 'string' && byName.get(facts.area.name)?.length === 1) {
    const e = byName.get(facts.area.name)[0], f = e.vars.length === 1 ? fnOf(e.expr, e.vars[0]) : null;
    const limitsAreRoots = (Array.isArray(facts.area.limits) ? facts.area.limits : []).every(l => { const v = typeof l.value === 'string' ? numberOf(l.value) : null; return v !== null && f && f(v) !== null && Math.abs(f(v)) <= 1e-9; });
    if (f && limitsAreRoots) area = { entry: e, f, variable: e.vars[0] };
  }
  return byName.size ? { byName, seeds, area } : null;
}

/** `Area = ∫_a^b f dx` for the question's quadratic curve between its two roots, opening downward: true, so ticked. */
function areaLineHolds(rhs, prep) {
  if (!prep || !prep.area) return false;
  const m = new RegExp(`^∫_${LIM}\\^${LIM}\\s*(.+?)\\s*d([a-z])$`).exec(rhs.trim());
  if (!m) return false;
  const limit = raw => { const info = infoOf(raw.replace(/^\{|\}$/g, '')); return info && info.value !== undefined ? info.value : null; };
  const a = limit(m[1]), b = limit(m[2]), body = infoOf(m[3]);
  const { f, variable, entry } = prep.area;
  if (a === null || b === null || !(a < b) || !body || !body.vars || body.vars.join() !== variable || m[4] !== variable) return false;
  if (!sameAsWritten(body, entry.info)) return false;
  const at5 = [0, 1, 2, 3, 4].map(k => f(a + (b - a) * k / 4));
  if (at5.some(v => v === null)) return false;
  const scale = Math.max(1, ...at5.map(Math.abs));
  const d1 = at5.slice(1).map((v, k) => v - at5[k]), d2 = d1.slice(1).map((v, k) => v - d1[k]), d3 = d2.slice(1).map((v, k) => v - d2[k]);
  const quadratic = d3.every(v => Math.abs(v) <= 1e-9 * scale) && Math.abs(d2[0]) > 1e-6 * scale;
  return quadratic && Math.abs(at5[0]) <= 1e-9 * scale && Math.abs(at5[4]) <= 1e-9 * scale && at5[2] > 1e-9 * scale;
}

/**
 * What the prompt says about one line (the line without its label). { tick, carry } for a line that is given,
 * { mismatch } for a line that nearly copies a given and differs, else null. Never a cross.
 */
function givenVerdict(src, prep, afterPart) {
  const text = cleanStatement(src.replace(/^(?:so|hence|then|therefore|thus|∴)\s+/i, '').replace(/\s*\.\s*$/, ''));
  if (!text || STATEMENT_SPLIT.test(text) || /\d\s+\d/.test(text) || /[<>≤≥≠≈%°,;]|==|!=/.test(text)) return null;
  const parts = text.split('=').map(x => x.trim());
  if (parts.length >= 2 && parts.every(Boolean)) {
    const head = /^([A-Za-z])(?:\(([a-z])\))?$/.exec(parts[0]);
    const entries = head ? prep.byName.get(head[1]) : null;
    if (head && entries) {
      const rhs = parts.slice(1);
      const usable = entries.filter(e => !head[2] || e.info.value !== undefined || head[2] === e.variable);
      if (rhs.every(p => usable.some(e => sameExpr(p, e.expr)))) {
        const e = usable.find(x => sameExpr(rhs[rhs.length - 1], x.expr));
        return { tick: true, carry: e.info.value === undefined && e.variable ? { text: rhs[rhs.length - 1], variable: e.variable } : null };
      }
      // A near copy of the one definition the prompt gives (one digit or sign changed): a note, never a cross.
      if (!afterPart && entries.length === 1 && rhs.length === 1) {
        const e = entries[0], k = textKey(rhs[0]), info = infoOf(rhs[0]);
        const near = e.info.value !== undefined
          ? info && info.value !== undefined && /^-?\d+(?:\.\d+)?$/.test(k) && !closeLoose(info.value, e.info.value) && info.value !== 0 && editDistance(k, e.key, 1) <= 1
          : info && info.vars && info.vars.join() === e.vars.join() && k.length >= 3 && !sameAsWritten(info, e.info) && editDistance(k, e.key, 2) <= 2;
        if (near) return { mismatch: head[1] };
      }
    }
  }
  // An equation, an identity or a bare expression the prompt states is never given: a prompt may state a false line.
  return null;
}

/** `∫_0^4 y dx` with y given by the question: the given function put in, so the integral is worked out as written. */
function putGivenInIntegrals(raw, prep) {
  if (!prep || !Object.keys(prep.seeds).length) return raw;
  const active = new Map(Object.entries(prep.seeds));
  return raw.map(line => {
    if (PART_LABEL.test(line)) active.clear();
    const src = line.replace(/^\(?[a-h1-9ivx]{1,3}[.)]\s+/i, '').replace(/^[A-Za-z][A-Za-z ]{1,24}:\s*(?=\S)/, '');
    const set = /^(?:let\s+)?([A-Za-z])(?:\(([a-z])\))?\s*=\s*(.+)$/i.exec(src.replace(/\s*\.\s*$/, ''));
    if (set && active.has(set[1]) && !/∫/.test(set[3])) {
      const seed = active.get(set[1]);
      if (!set[3].split('=').every(p => sameExpr(p, seed.expr))) active.delete(set[1]);
    }
    if (!/∫/.test(line) || !active.size) return line;
    return line.replace(new RegExp(INTEGRAL.source, 'g'), (whole, lo, hi, body, v) => {
      const nm = /^([A-Za-z])(?:\(([a-z])\))?$/.exec(body.trim());
      const seed = nm && nm[1] !== v ? active.get(nm[1]) : null;
      if (!seed || seed.variable !== v || (nm[2] && nm[2] !== v)) return whole;
      return `∫_${lo}^${hi}(${seed.expr})d${v}`;
    });
  });
}

// `8 y = 3/tan x` is ambiguous: a definition y = 3/tan x with a question number in front, or the equation 8y = 3/tan x (y = 3/(8 tan x)).
// The page is read three ways: without either (exactly as it always was), as the definition ('D') and as the equation ('E'). A line is ticked when
// the plain reading ticks it, or when BOTH readings tick it; no reading ever crosses.
function pageDefinitions(raw, out, firstBreak, prep = null, degreePrimed = null, tickOnly = false) {
  if (!raw.some(l => /^\s*\d{1,2}\s+[A-Za-z]\s*=/.test(l))) return pageDefinitionsOnce(raw, out, firstBreak, prep, degreePrimed, tickOnly, null);
  const runs = [null, 'D', 'E'].map(mode => { const o = out.slice(); const broke = pageDefinitionsOnce(raw, o, firstBreak, prep, degreePrimed, tickOnly, mode); return { o, broke }; });
  const [plain, d, e] = runs;
  const isTick = l => l && l.status === 'ok';
  for (let i = 0; i < out.length; i++) {
    if (isTick(plain.o[i])) out[i] = plain.o[i];
    else if (isTick(d.o[i]) && isTick(e.o[i])) out[i] = d.o[i];
  }
  return plain.broke;
}
function pageDefinitionsOnce(raw, out, firstBreak, prep, degreePrimed, tickOnly, glueMode) {
  const defs = prep ? { ...prep.seeds } : {};   // 'k' → { expr, line }, 'f' → { expr, variable, line }, "u'" → …   (what the question gives is in from the start)
  let afterPart = false;
  let equation = null;        // the last equation in one unknown: { left, right, variable }
  let broke = null;
  let carry = null;           // { text, variable }: what the last line this pass ticked came to, for the `=` line below
  let pendingGlue = null;
  let zeroed = null;          // { line, expr, variable }: `y' = 0` was stated straight after a derivative the page set
  let chain = null;           // { name, value, line }: the quantity the line above named and what it came to (see "A named quantity")
  const limit = firstBreak === -1 ? raw.length : firstBreak;
  for (let i = 0; i < Math.min(limit, LIMITS.lines); i++) {
    if (raw[i].length > LIMITS.chars) continue;
    if (pendingGlue) { defs[pendingGlue.letter] = pendingGlue.def; pendingGlue = null; }
    const zeroFor = zeroed && zeroed.line === i - 1 ? zeroed : null;
    zeroed = null;
    // A new part of the question may give a letter a new value on the paper, not on the page: what was defined is dropped.
    if (/^\(?(?:[a-h]|i{1,3}|iv|v|vi{0,3})[.)]\s|^\([a-h]\)|^(?:part|question|q)\s*\(?[a-h0-9]/i.test(raw[i])) { for (const k of Object.keys(defs)) delete defs[k]; equation = null; carry = null; afterPart = true; }
    const src = raw[i].replace(/^\(?[a-h1-9ivx]{1,3}[.)]\s+/i, '').replace(/^[A-Za-z][A-Za-z ]{1,24}:\s*(?=\S)/, '');
    // A question number glued to a definition (`8 y = 3/tan x`): when the same letter is used primed or evaluated on a later line, the line is
    // the definition y = … for those lines. The line itself stays a note (the number in front means it is not read as y = … on its own).
    { const g = /^(\d{1,2})\s+([A-Za-z])\s*=\s*(\S.*)$/.exec(src.replace(/\s*\.\s*$/, ''));
      if (glueMode && g && out[i].status === 'note' && !/[<>≤≥≠≈%°,;:=]|∫|\]_/.test(g[3]) && raw.slice(i + 1).some(l => new RegExp(`(?<![A-Za-z])${g[2]}(?:'|\\s*\\()`).test(l))) {
        const last = cleanStatement(g[3].trim());
        const settled = putIn(last, defs, null);
        const body = settled && infoOf(settled.text) ? settled.text : infoOf(last) && lettersOf(last).length <= 1 ? last : null;
        if (body !== null) {
          const expr = glueMode === 'E' ? `(${body})/${g[1]}` : body;
          const def = { expr, shown: glueMode === 'E' ? `${g[1]}${g[2]} = ${last}` : last, variable: lettersOf(body).length === 1 ? lettersOf(body)[0] : null, line: i, glued: true };
          if (glueMode === 'D') { defs[g[2]] = def; carry = null; continue; }
          pendingGlue = { letter: g[2], def };   // 'E': the line is also judged as the equation it may be, as it always was
        }
      } }
    // `y' = 0` (with or without words before it) straight after a derivative the page set: the next line may set that derivative to zero.
    { const zm = src.replace(/\s*\.\s*$/, '').match(/^(?:[A-Za-z][A-Za-z ]*\s+)?([A-Za-z])'\s*=\s*0$/);
      if (zm && defs[`${zm[1]}'`] && defs[`${zm[1]}'`].variable) zeroed = { line: i, expr: defs[`${zm[1]}'`].expr, variable: defs[`${zm[1]}'`].variable }; }
    // `x = 0 or x = -3`, `x = 0, -3`, `x = ±2`: each listed value is a root of the equation in force above, or the line is not ticked.
    if (equation && out[i].status === 'note') {
      const list = rootList(src);
      if (list && list.letter === equation.variable) {
        // only the latest equation line counts: a line with an `=` between it and this one means the list may refer to something else
        const latest = equation.line !== undefined && !raw.slice(equation.line + 1, i).some(l => /=/.test(l));
        const L = fnOf(equation.left, list.letter), R = fnOf(equation.right, list.letter);
        const values = list.items.map(x => numberOf(cleanStatement(x.value)));
        if (latest && L && R && values.every(v => v !== null && v !== undefined)) {
          const fails = list.items.filter((_, k) => { const a = L(values[k]), b = R(values[k]); return a === null || b === null || !close(a, b); });
          if (!fails.length) out[i] = { text: out[i].text, status: 'ok', state: 'arithmetic', note: `${list.items.map(x => assignSpan(list.letter, x.value)).join(', ')} each satisfy ${mathSpan(equation.shown)} above. This does not say these are all the solutions.`, valueChain: { rule: 'page-definitions' } };
          else out[i] = { ...out[i], note: `Not ticked: ${fails.map(x => assignSpan(list.letter, x.value)).join(', ')} ${fails.length > 1 ? 'do' : 'does'} not satisfy ${mathSpan(equation.shown)} above.` };
        }
        delete defs[list.letter]; carry = null;
        continue;
      }
    }
    // What the question gives (see "What the question itself gives"): an integral line, before the lines with no integral.
    if (prep && out[i].status === 'note' && /∫/.test(src)) {
      const body = src.replace(/\s*\.\s*$/, '').replace(/^(?:so|hence|then|therefore|thus|∴)\s+/i, '');
      const area = /^(?:area|a)\s*=\s*(∫.+)$/i.exec(cleanStatement(body));
      let line = null;
      if (area && areaLineHolds(area[1], prep)) line = 'This integral is the area bounded by the curve and the x-axis.';
      if (line) { out[i] = { text: out[i].text, status: 'ok', state: 'arithmetic', note: line, valueChain: { rule: 'question-given' } }; carry = null; continue; }
    }
    // A named quantity carried down the page (`A = 8000(1.05)^3`, `A = 8000(1.157625)`, `A = 9261`; `Interest = A - P`, `= 9261 - 8000`,
    // `1261`). A line that names the same quantity as the line straight above (or continues it with `=`, or is the bare value) is TICKED
    // when its value is the value the line above came to. TICK ONLY: a line that differs is left a note (never crossed, and it does not
    // become the value the next line is held to), and the line that starts a chain is a note (it is a definition or a first step).
    {
      const s = src.replace(/\s*\.\s*$/, '').replace(/[−–—]/g, '-').replace(/[×·]/g, '*').replace(/÷/g, '/').trim();
      const above = chain && chain.line === i - 1 ? chain : null;
      chain = null;
      let parsed = null;
      if (!/[<>≤≥≠≈~%°,;:']|==|!=|∫|\]_|√\s*\[/.test(s)) {
        const named = /^([A-Za-z]{1,14})\s*=\s*(\S.*)$/.exec(s), cont = /^=\s*(\S.*)$/.exec(s);
        if (named && !KEEP.test(named[1])) parsed = { name: named[1], parts: named[2].split('=').map(x => x.trim()) };
        else if (cont) parsed = { name: null, parts: cont[1].split('=').map(x => x.trim()) };
        else if (/^-?\d+(?:\.\d+)?$/.test(s)) parsed = { name: null, parts: [s], bare: true };
      }
      if (parsed && parsed.parts.every(Boolean)) {
        const vals = parsed.parts.map(p => { const put = putIn(cleanStatement(p), defs, null); return put ? numberOf(put.text) : null; });
        if (vals.every(v => v !== null) && vals.every(v => close(v, vals[0]))) {
          const v = vals[0];
          const linked = above && (parsed.name === null || parsed.name === above.name || /^(?:ans|answer)$/i.test(parsed.name));
          if (linked) {
            if (close(v, above.value)) {
              chain = { name: above.name, value: above.value, line: i };
              if (out[i].status === 'note') out[i] = { text: out[i].text, status: 'ok', state: 'arithmetic', note: `This comes to the same value as the line above: ${shown(v)}.`, valueChain: { rule: 'page-definitions' } };
            }
          } else if (parsed.name) {
            chain = { name: parsed.name, value: v, line: i };
            if (parsed.parts.length >= 2 && out[i].status === 'note') out[i] = { text: out[i].text, status: 'ok', state: 'arithmetic', note: `Each side comes to ${shown(v)}.`, valueChain: { rule: 'page-definitions' } };
          }
        }
      }
    }
    if (/[<>≤≥≠≈%°,;:]|==|!=|√\s*\[|∫|\]_/.test(src)) continue;
    const decimal = /\d\.\d|(?:^|[^\d])\.\d/.test(src);
    const ticks = [], facts = [];
    let cross = null;
    const carried = carry;
    carry = null;
    if (prep && out[i].status === 'note' && !/^=/.test(src.trim())) {
      const g = givenVerdict(src, prep, afterPart);
      if (g && g.tick) { out[i] = { text: out[i].text, status: 'ok', state: 'arithmetic', note: GIVEN_NOTE, valueChain: { rule: 'question-given' } }; carry = g.carry; }
      else if (g && g.mismatch) { out[i] = { ...out[i], note: MISMATCH_NOTE }; delete defs[g.mismatch]; continue; }
    }
    // A `=` line under a line this pass ticked: the same expression carried on (tick only).
    if (/^=/.test(src.trim()) && carried && out[i].status === 'note' && !STATEMENT_SPLIT.test(src)) {
      const sides = cleanStatement(src.trim()).split('=').map(x => x.trim()).slice(1);
      const put = sides.every(Boolean) ? sides.map(x => putIn(x, defs, carried.variable)) : [];
      const infos = put.length && put.every(Boolean) ? put.map(x => infoOf(x.text)) : [];
      const top = infoOf(carried.text);
      const grouped = sides.some(x => /[\/÷]\s*\d+(?:\.\d+)?\s*[A-Za-z(]|[\/÷]\s*[A-Za-z]\s*[A-Za-z(]|\^\s*-?\d+(?:\.\d+)?[A-Za-z]|\^\s*[A-Za-z][A-Za-z0-9(]|[\/÷].*\*/.test(x));
      if (top && infos.length && infos.every(Boolean) && !grouped && infos.every(x => sameAsWritten(x, top))) {
        out[i] = { text: out[i].text, status: 'ok', state: 'arithmetic', note: 'This is the line above, written another way.', valueChain: { rule: 'page-definitions' } };
        carry = { text: put[put.length - 1].text, variable: carried.variable };
      }
      continue;
    }
    if (out[i].status === 'ok' && /^=/.test(src.trim()) && carried) { carry = carried; continue; }
    const judgeOne = stmt => {
      const text = cleanStatement(stmt);
      const parts = text.split('=').map(x => x.trim());
      if (parts.length < 2 || parts.some(x => !x)) return;
      const head = parts[0].replace(/^(?:then\s+)?(?:(?:let|take|put|set)\s+)?/i, '');
      // The derivative the page set, put equal to zero (`0 = 6x^2 + 18x` after `y' = 6x^2 + 18x` and `y' = 0`): true as written, never crossed.
      if (zeroFor && parts.length === 2 && (parts[0] === '0' || parts[1] === '0')) {
        const side = parts[0] === '0' ? parts[1] : parts[0];
        const claim = putIn(side, defs, zeroFor.variable), base = putIn(zeroFor.expr, defs, zeroFor.variable);
        const a = claim && infoOf(claim.text), b = base && infoOf(base.text);
        if (a && b && a.vars && b.vars && a.vars.join() === zeroFor.variable && sameAsWritten(a, b)) {
          const left = putIn(parts[0], defs, zeroFor.variable), right = putIn(parts[1], defs, zeroFor.variable);
          if (left && right) equation = { left: left.text, right: right.text, variable: zeroFor.variable, line: i, shown: `${parts[0]} = ${parts[1]}` };
          ticks.push('This sets the derivative above to zero.');
          return;
        }
      }
      const twoWaysHere = parts.some(x => /[\/÷]/.test(x) && (/[\/÷]\s*\d+(?:\.\d+)?\s*[A-Za-z(]|[\/÷]\s*[A-Za-z]\s*[A-Za-z(]|\^\s*-?\d+(?:\.\d+)?[A-Za-z]|\^\s*[A-Za-z][A-Za-z0-9(]/.test(x)));
      if (twoWaysHere) return;
      // `y'(π/6) = -3sin(π/6) x 1/[cos(π/6)]^3`: the derivative the page set (or, with none, the derivative of the definition) at a number.
      // True when the value on the right is that derivative's value there; otherwise a note, never a cross (a number may be misread).
      { const at = /^([A-Za-z])'\((.+)\)$/.exec(head);
        const point = at && defs[at[1]] && parts.length >= 2 && !lettersOf(at[2]).length ? numberOf(cleanStatement(at[2])) : null;
        if (point !== null) {
          const d = defs[at[1]], page = defs[`${at[1]}'`];
          const variable = (page && page.variable) || d.variable || (lettersOf(d.expr).length === 1 ? lettersOf(d.expr)[0] : null);
          const flat = x => { const r = putIn(x, defs, variable); return r ? r.text : null; };
          let slopeAt = null, how = '';
          if (!variable) return;
          if (page && page.variable === variable && flat(page.expr)) { const g = fnOf(flat(page.expr), variable); slopeAt = g ? g(point) : null; how = 'page'; }
          else { const f = flat(d.expr) && fnOf(flat(d.expr), variable); if (f) { const h = 1e-5, a = f(point + h), b = f(point - h); slopeAt = a !== null && b !== null ? (a - b) / (2 * h) : null; how = 'definition'; } }
          const claimed = parts.slice(1).map(x => { const r = putIn(x, defs, null); return r ? numberOf(r.text) : null; });
          if (slopeAt !== null && claimed.every(v => v !== null) && claimed.every(v => Math.abs(v - slopeAt) <= (how === 'page' ? 1e-7 : 1e-5) * Math.max(1, Math.abs(slopeAt)))) {
            ticks.push(how === 'page' ? `This is the value of the derivative above at ${assignSpan(variable, at[2])}.` : `This is the derivative of ${assignSpan(at[1], d.shown)} at ${assignSpan(variable, at[2])}.`);
          }
          return;
        } }
      // B. a derivative of something the page defined: u' = …, f'(x) = …
      let m = head.match(/^([A-Za-z])'(?:\(([a-z])\))?$/);
      if (m && defs[m[1]] && parts.length === 2) {
        const d = defs[m[1]];
        const variable = m[2] || d.variable || (lettersOf(d.expr).length === 1 ? lettersOf(d.expr)[0] : null);
        const base = variable ? putIn(d.expr, defs, variable) : null;
        const claim = variable ? putIn(parts[1], defs, variable) : null;
        const f = base && fnOf(base.text, variable), g = claim && fnOf(claim.text, variable);
        if (f && g) {
          let agree = 0, differ = 0, tried = 0;
          for (const x of POINTS) {
            const h = 1e-5, a = f(x + h), b = f(x - h), c = g(x);
            if (a === null || b === null || c === null) return;
            tried++;
            const slope = (a - b) / (2 * h);
            if (Math.abs(slope - c) <= 1e-5 * Math.max(1, Math.abs(slope), Math.abs(c))) agree++;
            else if (Math.abs(slope - c) > 1e-2 * Math.max(1, Math.abs(slope), Math.abs(c))) differ++;
          }
          if (tried >= 3 && agree === tried) { carry = { text: claim.text, variable }; ticks.push(`This is the derivative of ${assignSpan(m[1], d.shown)}${lettersOf(d.shown).every(c => c === variable) ? derivativeRuleWords(base.text, variable) : ''}.`); facts.push([`${m[1]}'`, { expr: parts[1], shown: parts[1], variable: m[2] || d.variable || null, line: i }]); return; }
          // A number on the right is the gradient at a point (y' = 3√2/2), not a wrong derivative: never crossed.
          if (tried >= 3 && differ === tried && !decimal && !d.given && !d.glued && lettersOf(claim.text).includes(variable) && !(degreePrimed && degreePrimed.has(i)) && !loneTimesSigns(parts[1]).changed) { cross = `The derivative of ${assignSpan(m[1], d.shown)} is not ${mathSpan(parts[1])}.`; return; }
        }
        return;
      }
      // A. a definition: k = …, f(x) = … (a chain after the name is judged below, then its last side is kept)
      m = head.match(/^([A-Za-z])(?:\(([a-z])\))?$/);
      const sides = m ? parts.slice(1) : parts;
      // D. x = value straight after an equation in x: a root of it
      if (m && !m[2] && sides.length === 1 && equation && equation.variable === m[1]) {
        const value = putIn(sides[0], defs, null), v = value && numberOf(value.text);
        const L = v !== null && v !== undefined ? fnOf(equation.left, m[1]) : null, R = L ? fnOf(equation.right, m[1]) : null;
        if (L && R) { const a = L(v), b = R(v); if (a !== null && b !== null && close(a, b)) ticks.push(`${assignSpan(m[1], sides[0])} satisfies the equation before it.`); }
      }
      // C. sides that become plain numbers, or one function of one letter, once the definitions are in
      if (sides.length >= 2) {
        const free = (() => { const all = [...new Set(sides.flatMap(lettersOf))].filter(c => !defs[c] || defs[c].variable); return all.length === 1 ? all[0] : null; })();
        const put = sides.map(x => putIn(x, defs, free));
        if (put.every(Boolean)) {
          const used = [...new Set(put.flatMap(x => x.used))];
          const infos = put.map(x => infoOf(x.text));
          if (infos.every(Boolean)) {
            const numbers = infos.every(x => x.value !== undefined);
            const same = infos.every(x => sameAsWritten(x, infos[0]));
            const from = used.map(k => assignSpan(k, defs[k].shown)).join(', ');
            const where = used.length && used.every(k => defs[k].given) ? 'from the question' : 'from above';
            if (same && used.length) ticks.push(numbers ? `With ${from} ${where}, each side comes to ${shown(infos[0].value)}.` : `With ${from} ${where}, the sides are the same expression.`);
            // Crossed only in a worked chain under a name (A = 12e^(4k) = 12e^(ln(3)/4)): there the two sides are stated
            // equal. Two sides on their own (x^2 = 9 after x = 2) may be a new equation to solve, so that is a note.
            // …and only against a value set on this line or the line straight above it: an older value may belong to
            // another part of the question (independent review).
            else if (!same && numbers && m && used.length && !decimal && used.every(k => !defs[k].variable && defs[k].line >= i - 1)) {
              const k = infos.findIndex(x => !close(x.value, infos[0].value));
              cross = `With ${from} from above, ${mathSpan(sides[0])} comes to ${shown(infos[0].value)}, but this line gives ${shown(infos[k].value)}.`;
              return;
            }
            // E. the same equation as the one before it, rearranged (the difference of the sides is a constant multiple)
            if (!m && sides.length === 2 && free) {
              const L = fnOf(put[0].text, free), R = fnOf(put[1].text, free);
              if (L && R && equation && equation.variable === free && !same) {
                const L0 = fnOf(equation.left, free), R0 = fnOf(equation.right, free);
                let ratio = null, okRatio = 0, tried = 0;
                for (const x of POINTS) { const a = L(x), b = R(x), c = L0 && L0(x), d = R0 && R0(x); if ([a, b, c, d].some(z => z === null || z === undefined)) return; const p1 = a - b, p0 = c - d; if (Math.abs(p0) < 1e-9 || Math.abs(p1) < 1e-9) return; tried++; const r = p1 / p0; if (ratio === null) ratio = r; if (Math.abs(r - ratio) <= 1e-7 * Math.max(1, Math.abs(ratio))) okRatio++; }
                if (tried >= 3 && okRatio === tried) ticks.push('The same equation as the one before it, rearranged.');
              }
              if (L && R && !same) equation = { left: put[0].text, right: put[1].text, variable: free, line: i, shown: text };
            }
          }
        }
      } else if (!m && sides.length === 1) { /* nothing stated */ }
      if (m && !cross) {
        const last = sides[sides.length - 1];
        if (!new RegExp(`(?<![A-Za-z])${m[1]}(?![A-Za-z])`).test(last.replace(/[A-Za-z]+/g, w => (KEEP.test(w) ? ' ' : w)))) {
          const variable = m[2] || null;
          const settled = putIn(last, defs, variable);
          if (settled && infoOf(settled.text)) facts.push([m[1], { expr: settled.text, shown: last, variable, line: i }]);
          else if (!m[2] && infoOf(last)) facts.push([m[1], { expr: last, shown: last, variable: lettersOf(last).length === 1 ? lettersOf(last)[0] : null, line: i, open: lettersOf(last).length > 1 }]);
        }
      }
        };
    // A line is ticked only when its LAST statement is ticked and nothing after the first tick is left unjudged
    // (independent review: `x = 2 so 2x = 5`). Before the first tick a statement may be a premise: words, or an
    // equation or definition with a letter in it. A premise of plain numbers must itself be true.
    const verdicts = [];
    for (const stmt of src.split(STATEMENT_SPLIT).map(x => x && x.trim()).filter(Boolean)) {
      const before = ticks.length;
      const equationBefore = equation;
      judgeOne(stmt);
      if (cross) break;
      if (ticks.length > before) { verdicts.push('tick'); continue; }
      const sides = cleanStatement(stmt).split('=').map(x => x.trim());
      // A statement about the unknown of the equation before it that this pass could not tick (`x = 3`, `2x = 5` after
      // `2x = 4`) is not a premise: it may be false, so the line is not ticked (independent review, rounds 2 and 3).
      if (sides.length >= 2 && equationBefore && sides.some(x => lettersOf(x).includes(equationBefore.variable))) { verdicts.push('bad'); continue; }
      // A claim about a DERIVED quantity of a symbol the page defined (`u' = 3x`, `v' = cos x`, `f'(x) = ...`, `y'' = ...`) that this pass did not tick is
      // never a premise: it may be false (review of 23 November 2026), so the line is not ticked. It ticks only when verified above.
      { const dc = /(?:^|\s)([A-Za-z])'{1,2}(?:\(\s*[a-z]\s*\))?$/.exec(sides[0]) || /(?:^|\s)d{1,2}([a-z])\s*\/\s*d[a-z]\^?2?$/.exec(sides[0]);
        if (dc && sides.length >= 2 && (defs[dc[1]] || raw.slice(0, i).some(l0 => new RegExp(`(?<![A-Za-z'])${dc[1]}\\s*=`).test(l0)))) { verdicts.push('bad'); continue; } }
      const plain = sides.length >= 2 && sides.every(x => x && !lettersOf(x).length);
      const values = plain ? sides.map(numberOf) : [];
      verdicts.push(plain && !(values.every(v => v !== null) && values.every(v => close(v, values[0]))) ? 'bad' : 'premise');
    }
    const firstTick = verdicts.indexOf('tick');
    const lineHolds = firstTick !== -1 && verdicts[verdicts.length - 1] === 'tick' && verdicts.slice(firstTick).every(v => v === 'tick') && !verdicts.includes('bad');
    if (cross) { if (tickOnly) { cross = null; continue; } broke = { index: i, message: cross }; break; }
    for (const [name, d] of facts) if (!d.open) { defs[name] = d; if (prep && prep.seeds[name] && !/'/.test(name) && sameExpr(d.shown, prep.seeds[name].expr)) d.given = true; }
    // A letter set on this line in a way this pass did not record (`Let x = 4`, `x = 4 now`) no longer has its old value.
    for (const k of Object.keys(defs)) if (!facts.some(([name]) => name === k) && new RegExp(`(?<![A-Za-z])${k.replace(/[^A-Za-z]/g, '\\$&')}\\s*=`).test(src)) delete defs[k];
    if (!lineHolds) { if (ticks.length) carry = null; continue; }
    if (ticks.length && out[i].status === 'note') out[i] = { text: out[i].text, status: 'ok', state: 'arithmetic', note: ticks.join(' '), valueChain: { rule: 'page-definitions' } };
  }
  return broke;
}

/**
 * `opts.latex`: the reader's TeX for lines of the working, as [{ text, latex }] (a line is matched by its trimmed text).
 * It is a second reading of a line and is used ONLY to tick or to leave a note, never to cross:
 *   · the working is checked as written, exactly as without it;
 *   · a line that came back a note, whose TeX reading is judged true by this same checker, is ticked (its text stays
 *     the student's);
 *   · a cross whose line is true under the TeX reading becomes the "may have been misread" note, never a tick;
 *   · a tick or a note is never turned into a cross.
 * Both passes are charged to the one page budget.
 *
 * `opts.facts`: what the question's prompt gives (questionFacts.js). Used only to tick or leave a note; see "What the
 * question itself gives". Without it the check is exactly what it was.
 */
// The numbers the question's authored worked solution reaches, for the one page being checked (set and cleared around it).
let SOLUTION_VALUES = null;
let ANSWER_VALUE = null;
export function stepCheckArithmetic(workingText, opts = null) {
  SOLUTION_VALUES = opts && Array.isArray(opts.solutionValues) ? opts.solutionValues.filter(v => Number.isFinite(v)) : null;
  ANSWER_VALUE = opts && Number.isFinite(opts.answerValue) ? opts.answerValue : null;
  try { return stepCheckArithmeticBudgeted(workingText, opts); } finally { SOLUTION_VALUES = null; ANSWER_VALUE = null; }
}
function stepCheckArithmeticBudgeted(workingText, opts) {
  return withEvaluationBudget(PAGE_BUDGET, () => {
    let prep = null;
    try { prep = opts && opts.facts ? prepareFacts(opts.facts) : null; } catch { prep = null; }
    let base = stepCheckArithmeticWithinBudget(workingText, prep);
    try { base = readTwice(workingText, base, prep); } catch { /* the page as written stands */ }
    if (!opts || !Array.isArray(opts.latex) || !opts.latex.length) return base;
    try { return withTexReading(workingText, base, opts.latex, prep); } catch { return base; }
  });
}

/**
 * The content of a line in SOURCE ORDER: each digit, each single letter, each function or constant name. Digits are
 * single tokens so a run may split or join across a layout command (12 and \frac{1}{2}) but never reorder (21 is not).
 */
function contentSignature(text) {
  const s = String(text).toLowerCase().replace(/√/g, 'sqrt').replace(/π/g, 'pi').replace(/θ/g, 'theta').replace(/²/g, '2').replace(/³/g, '3');
  return (s.match(/arcsin|arccos|arctan|cosec|sqrt|cbrt|theta|sin|cos|tan|sec|csc|cot|exp|ln|log|pi|\d|[a-z]/g) || []).join(' ');
}

const FN_RE = 'arcsin|arccos|arctan|cosec|sqrt|cbrt|theta|sin|cos|tan|sec|csc|cot|exp|ln|log|pi';
/** A line as an ordered run of operands (digit, letter, function name) and explicit operators; brackets and spaces are ignored. */
function operandOperatorTokens(text) {
  const s = String(text).toLowerCase().replace(/[−–—]/g, '-').replace(/[×·]/g, '*').replace(/÷/g, '/').replace(/≤/g, '<=').replace(/≥/g, '>=').replace(/≠/g, '!=')
    .replace(/√/g, 'sqrt').replace(/π/g, 'pi').replace(/θ/g, 'theta').replace(/²/g, '^2').replace(/³/g, '^3');
  return (s.match(new RegExp(`${FN_RE}|\\d|[a-z]|<=|>=|!=|[+\\-*/^=<>]`, 'g')) || []).map(t => ({ t, op: /^(?:<=|>=|!=|[+\-*/^=<>])$/.test(t) }));
}
/**
 * The text's tokens must be the TeX's with operators deleted and nothing else: every operand in order, every explicit
 * operator of the text present where it stands, and the TeX adding structure (^, /, *) only where the text has bare adjacency.
 */
function sameStatement(text, converted) {
  const a = operandOperatorTokens(text), b = operandOperatorTokens(converted);
  let j = 0;
  for (const x of a) {
    if (x.op) { if (!(b[j] && b[j].op && b[j].t === x.t)) return false; j++; continue; }
    // Flattening loses a superscript, a fraction bar, a root and a multiplication dot. It never loses a sign or an equals:
    // a + - = or comparison the text does not have at that place is another line.
    while (j < b.length && b[j].op) { if (!/^[\^/*]$/.test(b[j].t)) return false; j++; }
    if (!(b[j] && b[j].t === x.t)) return false;
    j++;
  }
  return b.slice(j).every(y => y.op && /^[\^/*]$/.test(y.t));
}
/** Notes that mean "not judged as one statement" (a label, a trailing equation number, a comma, words), never upgraded. */
function notOneStatement(text) {
  const t = String(text).replace(/[−–—]/g, '-');
  if (/^\(?\d{1,3}[.)](?:\s|$)|^\(\d{1,3}\)|\s\(\d{1,3}\)\s*$|[,;:]|^[+*/×÷]|^-\s|\d\s+\.\s*\d|\d\s*\.\s+\d/.test(t)) return true;
  const known = new RegExp(`^(?:${FN_RE})$`);
  for (const w of t.toLowerCase().match(/[a-z]+/g) || []) {
    if (known.test(w) || w.length === 1) continue;
    if (w.length >= 3 || /^(?:so|is|if|or|to|of|as|by|we|at|an|it|be|do|no|on)$/.test(w)) { if (!/^(?:sin|cos|tan|sec|csc|cot|exp|log|ln)/.test(w)) return true; }
  }
  return false;
}

function withTexReading(workingText, base, pairs, prep = null) {
  const raw = String(workingText || '').split('\n').map(l => l.trim()).filter(Boolean);
  if (base.lines.length !== raw.length) return base;
  const byText = new Map();
  for (const pair of pairs) {
    const key = String(pair?.text ?? '').trim(), tex = cleanLatex(pair?.latex);
    if (!key || !tex) continue;
    // Two lines with the same text and different TeX: neither is trusted.
    byText.set(key, byText.has(key) && byText.get(key) !== tex ? null : tex);
  }
  const alt = raw.map(line => {
    const tex = byText.get(line);
    const plain = tex ? texToPlain(tex) : null;
    return plain && plain.replace(/\s+/g, '') !== line.replace(/\s+/g, '') ? plain : null;
  });
  if (!alt.some(Boolean)) return base;
  let second = stepCheckArithmeticWithinBudget(raw.map((line, i) => alt[i] ?? line).join('\n'), prep);
  try { second = readTwice(raw.map((line, i) => alt[i] ?? line).join('\n'), second, prep); } catch { /* as written */ }
  if (second.lines.length !== base.lines.length) return base;
  const lines = base.lines.map(l => ({ ...l }));
  let changed = false, downgraded = false;
  const trueUnderTex = i => alt[i] !== null && second.lines[i].status === 'ok' && second.lines[i].state === 'arithmetic';
  // AGREEMENT applies to the UPGRADE to a tick only: a tick says the line is right, so the TeX must describe the same
  // content as the text (same digits, letters and function names; a word or a different number in the text that the TeX
  // lacks means it is another line). The DOWNGRADE of a cross to the "may have been misread" note stays permissive: any
  // validated TeX reading that makes the line true softens the cross to a note, which claims nothing.
  const sameContent = i => contentSignature(raw[i]) === contentSignature(alt[i]) && sameStatement(raw[i], alt[i]) && !notOneStatement(raw[i]);
  // A cross that stands (the TeX does not clear that line) still governs the lines below it: nothing there is ticked.
  const standing = base.firstBreak !== -1 && !trueUnderTex(base.firstBreak) ? base.firstBreak : -1;
  base.lines.forEach((p, i) => {
    const t = second.lines[i];
    if (!trueUnderTex(i) || (standing !== -1 && i > standing)) return;
    if (p.status === 'note') { if (!sameContent(i)) return; lines[i] = { ...t, text: p.text }; changed = true; }
    else if (p.status === 'break') { lines[i] = { text: p.text, status: 'note', note: MISREAD_NOTE, unverified: true }; changed = true; downgraded = true; }
  });
  if (!changed) return base;
  // The cross is gone: the lines that followed from it no longer follow from a slip.
  if (downgraded) lines.forEach((l, i) => { if (l.status === 'note' && l.note === 'Follows from the earlier slip.') lines[i] = { ...l, note: MISREAD_NOTE }; });
  const state = l => l.state || (l.status === 'break' ? 'wrong' : l.unreadable ? 'unread' : 'unverified');
  const full = lines.map(l => ({ ...l, state: state(l) }));
  const at = st => full.flatMap((l, k) => (l.state === st ? [k + 1] : []));
  const unverified = at('unverified'), unread = at('unread');
  const firstBreak = full.findIndex(l => l.status === 'break');
  return {
    ...base,
    lines: full,
    firstBreak,
    diagnosis: firstBreak === -1 ? null : base.diagnosis,
    summary: { ...base.summary, checked: full.filter(l => l.status === 'ok').length, arithmetic: at('arithmetic'), wrong: at('wrong'), unverified, unread,
      reason: unverified.length ? base.summary.reason || 'Pri checks only the arithmetic on this question. These lines have none it can check on its own.' : null }
  };
}

// ── What the reader writes that the checker reads another way ────────────────────────────────────────────────────────
// Owner's handwritten pages, 20 November 2026. Normalised before any line is read (the line shown stays as written):
//   · a prime in any of its forms (′ ’ ʹ ´, and a double prime ″) is the ASCII ' that y' and f'(x) are read from;
//   · a degree sign the reader wrote for a prime (`y° = 3[tan x]^-1`): a degree sign directly after ONE letter (not a digit, not part of
//     a longer word) and before `=` or `(` is a prime. `30°` and `sin 30° = 1/2` are untouched;
//   · `integral_2^4` is ∫_2^4, and a space after the underscore of a limit (`]_ -2^4`) is not part of the limit.
const DEGREE_FOR_PRIME = /(?<![A-Za-z0-9])[A-Za-z]°(?=\s*[=(])/;
// Money as it is written on a typeset or printed page: `$9261`, `A$9,261`, `1,261` and a gloss in brackets at the end of a definition
// (`P = 8000 (principal)`). The line shown stays as written; only the reading drops the currency sign, the thousands commas (a comma
// with exactly three digits after it, not in front of a bracket, so a point (2,100) is not read as 2100) and a trailing bracketed
// gloss of two or more plain words (not a function name, never a lone letter such as (x)).
const GLOSS_WORDS = new Set(('principal interest rate annual number of years year months month total amount value cost price deposit balance new old initial final given approx approximately units unit per the an in at to for and or compound simple payment payments loan investment profit loss time period term length width height area volume mass weight speed distance population sales discount tax fee rent').split(' '));
// Closed rule: a trailing bracket is a gloss only when EVERY token inside is a word of GLOSS_WORDS (no letters on their own, digits, operators or
// function names) and at least one of them has 5 or more letters (a bracket of short words, (in) (of) (the), reads as a product of letters); anything else, such as (abc), (xy), (sin x) or (new x), stays in the line as maths and the line is not checkable.
function dropGloss(s) {
  const m = /\s+\(([A-Za-z]+(?:\s+[A-Za-z]+)*)\)\s*$/.exec(s);
  const words = m ? m[1].toLowerCase().split(/\s+/) : [];
  return m && words.every(w => GLOSS_WORDS.has(w)) && words.some(w => w.length >= 5) ? s.slice(0, m.index) : s;
}
function moneyReading(s) {
  return dropGloss(s)
    .replace(/(?<![A-Za-z])(?:A|AU|AUD)?\\?\$\s*(?=\d)/g, '')
    .replace(/(?<![\d.,(\[;])\d{1,3}(?:,\d{3})+(?:\.\d+)?(?![\d,])/g, m => m.replace(/,/g, ''));
}
function normaliseInk(line) {
  return moneyReading(String(line))
    .replace(/(?<=[A-Za-z)])\s*(?:″|′′|’’|ʹʹ|´´)/g, "''")
    .replace(/(?<=[A-Za-z)])[′’ʹ´]/g, "'")
    .replace(/(?<![A-Za-z0-9])([A-Za-z])°(?=\s*[=(])/g, "$1'")
    .replace(/(?<![A-Za-z])integral\s*(?=[_^])/gi, '∫')
    .replace(/(∫|\])\s*_\s+(?=[-−]?\s*[\d{(πe])/g, '$1_');
}

// ── The reader's handwriting, read a second way (owner's page, 21 November 2026) ──────────────────────────────────────
// A lone `x` between two factors is a times sign when the left side is a bracket, a power, a function application or a number (before a number
// or a bracket) and the right side starts another factor:
//     -3[tan x]^-2 x sec^2 x      is −3·[tan x]^(−2)·sec²x      (`sec^2 x` at the END keeps its x: that is the argument)
//     -3sin(π/6) x 1/[cos(π/6)]^3  is −3·sin(π/6)·1/[cos(π/6)]³
// An x straight after a function name is that function's argument (`sin x`, `cos^2 x`), never a times sign. A square bracket raised to a power
// (`[tan x]^-2`) is a grouping. In a line with such a times sign, each factor that is a fraction (`1/2`, `1/(√3)^3`) is one unit: `1/2 x 1/3`
// is (1/2)(1/3) and never 1/(2·1/3). These readings are used ONLY to tick: the page is checked as written, exactly as before; the same page read
// this way is checked a second time, and a line that came back a note and is true under the second reading is ticked. A line that is false
// under the second reading is never crossed from it, and a tick the first reading gave to a line that is FALSE under the second is a note
// (a tick needs the two readings to agree).
const FN_NAMES = 'sin|cos|tan|sec|cosec|csc|cot|ln|log';
const FACTOR_START = new RegExp(`^\\s*(?:\\d|\\(|\\[|√|π|(?:${FN_NAMES}|sqrt|exp)(?![A-Za-z]))`);
const FN_THEN_X = new RegExp(`(?<![A-Za-z])(?:${FN_NAMES})(?:\\^\\s*-?\\d+)?$`);
function loneTimesSigns(line) {
  // Every lone x on a line is read the same way: all of them times signs or none (a line where one is the letter and another is times is not read).
  const cands = [];
  let argEnd = -1, allTimes = true;
  const re = /(?<=\S)\s+x(?=\s+\S)/g;
  for (let m; (m = re.exec(line)); ) {
    const before = line.slice(0, m.index), end = m.index + m[0].length;
    if (FN_THEN_X.test(before)) { argEnd = end; continue; }
    const rest = line.slice(end);
    if (!FACTOR_START.test(rest) && !/^\s*[A-Za-z]/.test(rest)) continue;
    // On the left: a bracket, a power, π or a function with its argument. A bare number on the left (`3 x sin x`) may be the coefficient of the
    // letter (3x sin x), so it is a times sign only before another number or bracket, as it always was (`6 x 12`).
    const left = /[)\]π]$/.test(before) || /\^\s*-?\d+$/.test(before) || before.length === argEnd || (/\d$/.test(before) && /^\s*(?:\d|\()/.test(rest));
    if (left && FACTOR_START.test(rest)) cands.push(m); else allTimes = false;
  }
  if (!cands.length || !allTimes) return { text: line, changed: false };
  let out = '', from = 0;
  for (const m of cands) { out += `${line.slice(from, m.index)} *`; from = m.index + m[0].length; }
  return { text: out + line.slice(from), changed: true };
}
const groupEnd = (s, j) => { let d = 0; for (let k = j; k < s.length; k++) { if (s[k] === '(') d++; else if (s[k] === ')' && --d === 0) return k + 1; } return -1; };
/** The end of ONE atom at s[i]: a number, a bracket, √ and its number or bracket, or a function call, with an optional power; -1 when it is none of these. */
function atomEnd(s, i) {
  let j = i;
  if (/\d/.test(s[j] || '')) { while (j < s.length && /[\d.]/.test(s[j])) j++; }
  else if (s[j] === '(') j = groupEnd(s, j);
  else if (s[j] === '√') { j++; if (/\d/.test(s[j] || '')) { while (j < s.length && /[\d.]/.test(s[j])) j++; } else if (s[j] === '(') j = groupEnd(s, j); else return -1; }
  else { const m = new RegExp(`^(?:${FN_NAMES}|sqrt|exp)`).exec(s.slice(j)); if (!m || s[j + m[0].length] !== '(') return -1; j = groupEnd(s, j + m[0].length); }
  if (j < 0) return -1;
  if (s[j] === '^') { j++; if (s[j] === '-') j++; if (/\d/.test(s[j] || '')) { while (j < s.length && /\d/.test(s[j])) j++; } else if (s[j] === '(') { j = groupEnd(s, j); if (j < 0) return -1; } else return -1; }
  return j;
}
function topLevelSplit(s, ch) {
  const parts = [];
  let depth = 0, cur = '';
  for (const c of s) { if (c === '(' || c === '[') depth++; else if (c === ')' || c === ']') depth--; if (c === ch && depth === 0) { parts.push(cur); cur = ''; } else cur += c; }
  parts.push(cur);
  return parts;
}
/** In a line with times signs: each factor `a/b` whose denominator is ONE atom is written with the fraction slash ⁄ (one unit). */
function fractionsAsUnits(text) {
  return topLevelSplit(text, '=').map(side => {
    const factors = topLevelSplit(side, '*');
    if (factors.length < 2) return side;
    return factors.map(f => {
      const t = f.trim(), cuts = topLevelSplit(t, '/');
      if (cuts.length !== 2 || !cuts[0].trim()) return t;
      const den = cuts[1].trim();
      return atomEnd(den, 0) === den.length ? `${cuts[0].trim()}⁄${den}` : t;
    }).join('*');
  }).join(' = ').replace(/^ = /, '= ');
}
function inkReading(line) {
  let t = line.replace(/\[([^\[\],;_|]*)\](?=\^)(?!\^\s*-?[\w.]+\s*_)/g, '($1)');   // [tan x]^-2: a bracket raised to a power
  const times = loneTimesSigns(t);
  t = times.text;
  // a bracket that holds exactly one simple fraction, sin(π/6) or (3/4), has nothing in it for a later factor to join: it is one unit too
  if (times.changed) t = fractionsAsUnits(bracketFunctions(t)).replace(/\(\s*(-?[^()*+\-\/⁄=]+?)\s*\/\s*(\d+(?:\.\d+)?|[πe]|√\d+)\s*\)/g, '($1⁄$2)');
  return { text: t, times: times.changed };
}
const readTwice = (workingText, base, prep) => {
  const raw = String(workingText || '').split('\n').map(l => l.trim()).filter(Boolean);
  if (base.lines.length !== raw.length) return base;
  const alt = raw.map(l => inkReading(l));
  const own = alt.map((a, i) => a.text !== raw[i]);
  if (!own.some(Boolean)) return base;
  // A `= …` line straight under a line that is read the second way continues that line, so it is read in the same context.
  const differs = own.map((d, i) => d || (i > 0 && /^=/.test(raw[i]) && own[i - 1]));
  const second = stepCheckArithmeticWithinBudget(alt.map(a => a.text).join('\n'), prep, true);
  if (second.lines.length !== base.lines.length) return base;
  const lines = base.lines.map(l => ({ ...l }));
  const brk = base.firstBreak;
  let changed = false;
  base.lines.forEach((p, i) => {
    const t = second.lines[i];
    if (!differs[i]) return;
    if (p.status === 'note' && (brk === -1 || i < brk) && !/^Follows from the earlier slip\.|too long or too far/.test(String(p.note)) && t.status === 'ok' && t.state === 'arithmetic') {
      lines[i] = { ...t, text: p.text, note: String(t.note).replace(/⁄/g, '/') }; changed = true;
    } else if (p.status === 'ok' && alt[i].times && t.readingFalse) {
      // true under the first reading and false under the times reading: the two do not agree, so no tick
      lines[i] = { text: p.text, status: 'note', note: MISREAD_NOTE, unverified: true }; changed = true;
    }
  });
  if (!changed) return base;
  const state = l => l.state || (l.status === 'break' ? 'wrong' : l.unreadable ? 'unread' : 'unverified');
  const full = lines.map(l => ({ ...l, state: state(l) }));
  const at = st => full.flatMap((l, k) => (l.state === st ? [k + 1] : []));
  const unverified = at('unverified'), unread = at('unread');
  const firstBreak = full.findIndex(l => l.status === 'break');
  return {
    ...base, lines: full, firstBreak, diagnosis: firstBreak === -1 ? null : base.diagnosis,
    summary: { ...base.summary, checked: full.filter(l => l.status === 'ok').length, arithmetic: at('arithmetic'), wrong: at('wrong'), unverified, unread,
      reason: unverified.length ? base.summary.reason || 'Pri checks only the arithmetic on this question. These lines have none it can check on its own.' : null }
  };
};

// ── A column sum written down the page ───────────────────────────────────────────────────────────────────────────────
//     196          one block: a bare non-negative number; one or more lines that start with + , or with - and a space (a bare -3
//     + 64         is a negative number, not an operation); an optional rule of dashes; and a bare number. TICK ONLY: the last
//     260          line is ticked when the sum is exactly right. A column that does not add up is a note, never a cross: a list
//     of numbers (a table of values) is not a sum. The block never reaches the line below it.
const COLUMN_FIRST = /^\d+(?:\.\d+)?$/;
const COLUMN_OP = /^(\+|[-−–](?=\s))\s*(\d+(?:\.\d+)?)$/;
const COLUMN_RULE = /^(?:[-–—−_]\s*){2,}$|^[–—]$/;
const significantDigits = n => String(n).replace('.', '').replace(/^0+(?=\d)/, '').length;
/** A plain number as a whole count of 10^-places, so that a column of decimals adds exactly. */
function scaled(n, places) { const [w, f = ''] = String(n).replace('-', '').split('.'); const v = BigInt(w + f.padEnd(places, '0')); return String(n).startsWith('-') ? -v : v; }
function findColumns(raw) {
  const blocks = new Map();   // index of the last line → { members, expression, last, adds }
  const limit = Math.min(raw.length, LIMITS.lines);
  for (let i = 0; i < limit; i++) {
    const first = raw[i].trim();
    if (!COLUMN_FIRST.test(first) || raw[i].length > LIMITS.chars) continue;
    let j = i + 1;
    const ops = [];
    while (j < limit && COLUMN_OP.test(raw[j].trim())) { const m = raw[j].trim().match(COLUMN_OP); ops.push([m[1] === '+' ? 1 : -1, m[2]]); j++; }
    if (!ops.length) continue;
    let ruled = false;
    while (j < limit && COLUMN_RULE.test(raw[j].trim())) { ruled = true; j++; }
    if (j >= limit) continue;
    const last = raw[j].replace(/[−–—]/g, '-').trim();
    if (!/^-?\d+(?:\.\d+)?$/.test(last) || (last.startsWith('-') && !ruled)) continue;
    const members = []; for (let k = i; k <= j; k++) members.push(k);
    const numbers = [first, ...ops.map(([, n]) => n), last];
    // more than 15 significant digits is beyond what a number here holds exactly: not judged
    let adds = false;
    if (numbers.every(n => significantDigits(n.replace('-', '')) <= 15)) {
      const places = Math.max(...numbers.map(n => (n.split('.')[1] || '').length));
      adds = ops.reduce((acc, [sign, n]) => acc + BigInt(sign) * scaled(n, places), scaled(first, places)) === scaled(last, places);
    }
    blocks.set(j, { members, expression: first + ops.map(([sign, n]) => ` ${sign > 0 ? '+' : '-'} ${n}`).join(''), last, adds });
    i = j;
  }
  return blocks;
}

// ── Column vectors ──────────────────────────────────────────────────────────────────────────────────────────────────
// `[14;8]`, `4[-5;-1] + 3[-2;4] = [-20 - 6;-4 + 12]`, `|[14;8]| = √(14^2 + 8^2)`: numeric column vectors, sums of scalar
// multiples of them, and their magnitudes. TICK ONLY: a vector line that is not proved equal is a note, never a cross.
const VECTOR_BRACKET = /\[[^\[\]|]*;[^\[\]|]*\]/;
// The reader also writes the components with commas: `[-5,-1]`, `|4[-5,-1]+3[-2,4]|`, `|[14,8]|` (owner's page, 21 November 2026).
// A comma list in square brackets is a column vector ONLY on a line that does something with vectors, and never on a line about an
// interval, a domain, limits or a function of a bracket (`x ∈ [0,4]`, `for [0,4]`, `∫_[0,4]`, `max[3,4]`):
//   · a number directly in front (`4[-5,-1]`), or `+` / `-` between two brackets, or bars round a bracket, or an equals sign
//     between two brackets (or after a vector on the line above);
//   · and no letter directly in front of the bracket, and none of `∈`, for, in, domain, range, interval, an integral or a limit.
// Such a bracket is read exactly like the `;` form, so the vector reading stays TICK ONLY.
const COMMA_BRACKET = /\[[^\[\],;|]+(?:,[^\[\],;|]+){1,2}\]/g;
const NUMERIC_COMPONENT = /^[\d\s.+\-−–×·*/^()√]+$/;
const NOT_A_VECTOR_LINE = /∈|\b(?:for|in|domain|range|interval|between|where|when|lim|limit)\b|∫|\]\s*_|_\s*[-\d{(\[]/i;
function commaVectorsAsColumns(src, carried) {
  if (!src.includes(',') || !src.includes('[')) return src;
  const found = [...src.matchAll(COMMA_BRACKET)].filter(m => m[0].slice(1, -1).split(',').every(c => /\d/.test(c) && NUMERIC_COMPONENT.test(c)));
  if (!found.length || NOT_A_VECTOR_LINE.test(src)) return src;
  const before = m => src.slice(0, m.index);
  if (found.some(m => /[A-Za-z]\s*$/.test(before(m)))) return src;   // a function of a bracket, not a vector
  const scalar = found.some(m => /(?<![\w.)\]])\d+(?:\.\d+)?\s*[*×·x]?\s*$/i.test(before(m)));
  const between = found.some((m, k) => k > 0 && /^\s*[+\-−–]\s*(?:\d+(?:\.\d+)?\s*[*×·x]?\s*)?$/i.test(src.slice(found[k - 1].index + found[k - 1][0].length, m.index)));
  const equal = found.some((m, k) => k > 0 && /^\s*=\s*$/.test(src.slice(found[k - 1].index + found[k - 1][0].length, m.index))) || (/^\s*=/.test(src) && !!(carried && carried.vec));
  const bars = found.some(m => { const b = src.slice(0, m.index).split('|').length - 1, a = src.slice(m.index + m[0].length).split('|').length - 1; return b % 2 === 1 && a >= 1; });
  if (!(scalar || between || equal || bars)) return src;
  return src.replace(COMMA_BRACKET, whole => (found.some(m => m[0] === whole) ? whole.replace(/,/g, ';') : whole));
}
// The reader also writes a column with a SLASH between its components (`|[14/8]|`, `|[-20 - 6/-4 + 12]|`, 21 November 2026, live). A bracket
// holding exactly one `/` between two numeric expressions is read as a 2-component column ONLY inside magnitude bars, or as an operand of a
// scalar multiple or a sum on a line that also has a comma or semicolon vector, and ONLY when the fraction reading is not true of the line
// while the vector reading is (a tick), or the vector reading is the one that can be compared with an earlier vector line (the warning note).
// Both readings true, or the fraction reading true, leaves the line exactly as it was. Tick only, like every vector reading.
const SLASH_BRACKET = /\[([^\[\],;|/]+)\/([^\[\],;|/]+)\]/g;
function slashVectorsAsColumns(src, carried, ref, vectorPage) {
  if (!vectorPage || !src.includes('[') || !src.includes('/') || NOT_A_VECTOR_LINE.test(src)) return src;
  const found = [...src.matchAll(SLASH_BRACKET)].filter(m => /\d/.test(m[1]) && /\d/.test(m[2]) && NUMERIC_COMPONENT.test(m[1]) && NUMERIC_COMPONENT.test(m[2]));
  if (!found.length || found.some(m => /[A-Za-z]\s*$/.test(src.slice(0, m.index)))) return src;
  const otherVector = /\[[^\[\]|]*[,;][^\[\]|]*\]/.test(src);
  const inBars = m => { const b = src.slice(0, m.index).split('|').length - 1, a = src.slice(m.index + m[0].length).split('|').length - 1; return b % 2 === 1 && a >= 1; };
  const scalar = m => /(?<![\w.)\]])\d+(?:\.\d+)?\s*[*×·x]?\s*$/i.test(src.slice(0, m.index)) || /^\s*[+\-−–]/.test(src.slice(m.index + m[0].length)) || /[+\-−–]\s*(?:\d+(?:\.\d+)?\s*[*×·x]?\s*)?$/i.test(src.slice(0, m.index));
  if (!found.every(m => inBars(m) || (otherVector && scalar(m)))) return src;
  const candidate = src.replace(SLASH_BRACKET, whole => (found.some(m => m[0] === whole) ? whole.replace('/', ';') : whole));
  const bits = candidate.replace(/\s*\.\s*$/, '').split('=').map(x => x.trim());
  const cont = bits[0] === '' && bits.length >= 2;
  const written = cont ? bits.slice(1) : bits;
  if (!written.every(Boolean)) return src;
  let vectors;
  try { vectors = written.map(vectorSide); } catch { return src; }
  if (vectors.some(x => !x)) return src;
  const above = cont && written.length === 1 && carried && (carried.vec ? { vec: carried.vec } : carried.value !== undefined ? { num: carried.value } : null);
  const all = above ? [above, ...vectors] : vectors;
  const vecTrue = all.length >= 2 && all.every(x => sameVectorSide(x, all[0]));
  // the fraction reading of the same line: true only when every side is a number and they agree (bars and brackets of components are not numbers)
  let fracTrue = false;
  try {
    const raw = src.replace(/\s*\.\s*$/, '').split('=').map(x => x.trim());
    const rc = raw[0] === '' && raw.length >= 2, rw = rc ? raw.slice(1) : raw;
    const nv = rw.map(x => (x && !/\|/.test(x) ? valueOf(arithmeticText(x)) : null));
    const base = rc && carried && carried.value !== undefined ? [carried.value, ...nv] : nv;
    fracTrue = base.length >= 2 && base.every(v => v !== null && closeLoose(v, base[0]));
  } catch { fracTrue = false; }
  if (fracTrue) return src;
  const comparable = !!(ref && cont && written.length >= 1 && !!ref.value.vec === !!vectors[0].vec);
  return vecTrue || comparable ? candidate : src;
}
const arithmeticText = s => s.replace(/[−–—]/g, '-').replace(/[×·]/g, '*').replace(/÷/g, '/').replace(/(\d|\)|!)\s+x\s+(?=\d|\()/gi, '$1*').replace(/\[([^\[\],;_|]*)\](?![_^])/g, '($1)');
function vectorTerms(s) {
  const terms = [];
  let depth = 0, bar = false, cur = '', sign = 1;
  const flush = () => { terms.push({ sign, text: cur.trim() }); cur = ''; };
  for (let k = 0; k < s.length; k++) {
    const c = s[k];
    if (c === '(' || c === '[') depth++; else if (c === ')' || c === ']') depth--; else if (c === '|') bar = !bar;
    const before = cur.trim();
    if ((c === '+' || c === '-') && depth === 0 && !bar && before && !/[*\/^(]$/.test(before)) { flush(); sign = c === '-' ? -1 : 1; continue; }
    cur += c;
  }
  flush();
  return terms;
}
/** { vec: [...] } for a vector, { num } for a number, null when the side is neither. */
function vectorSide(raw) {
  let s = arithmeticText(raw.trim());
  if (!s) return null;
  if (!VECTOR_BRACKET.test(raw) && !/\|/.test(raw)) { const v = valueOf(s); return v === null ? null : { num: v }; }
  const terms = vectorTerms(s);
  if (terms.some(t => t.text === '')) return null;
  const asVector = t => {
    const m = t.match(/^(.*?)\s*\*?\s*\[([^\[\]|]*;[^\[\]|]*)\]$/);
    if (!m) return null;
    const comps = m[2].split(';').map(c => valueOf(arithmeticText(c)));
    if (comps.length < 2 || comps.length > 3 || comps.some(c => c === null)) return null;
    let k = 1;
    const pre = m[1].trim();
    if (pre) { k = valueOf(pre === '-' ? '-1' : pre); if (k === null) return null; }
    return comps.map(c => k * c);
  };
  if (terms.length === 1 && /^\|.*\|$/.test(terms[0].text)) {
    const inner = vectorTerms(terms[0].text.slice(1, -1));
    const sum = inner.map(t => ({ sign: t.sign, v: asVector(t.text) }));
    if (!sum.length || sum.some(t => !t.v) || sum.some(t => t.v.length !== sum[0].v.length)) return null;
    const total = sum[0].v.map((_, c) => sum.reduce((a, t) => a + t.sign * t.v[c], 0));
    const squares = total.reduce((a, c) => a + c * c, 0);
    return { num: terms[0].sign * Math.sqrt(squares), squares };
  }
  if (/\|/.test(s)) return null;
  const parts = terms.map(t => ({ sign: t.sign, v: asVector(t.text) }));
  if (!parts.length || parts.some(t => !t.v) || parts.some(t => t.v.length !== parts[0].v.length)) return null;
  return { vec: parts[0].v.map((_, c) => parts.reduce((a, t) => a + t.sign * t.v[c], 0)) };
}
const sameVectorSide = (a, b) => (a.vec && b.vec ? a.vec.length === b.vec.length && a.vec.every((x, k) => closeLoose(x, b.vec[k])) : a.num !== undefined && b.num !== undefined && closeLoose(a.num, b.num));
// A magnitude is shown as the root of its sum of squares when that is a whole number (√740), else in the usual exact form.
const showSide = x => {
  if (x.vec) return showVector(x.vec);
  const sq = Math.round(x.num * x.num);
  if (Math.abs(x.num * x.num - sq) <= 1e-7 * Math.max(1, sq) && sq >= 0) { const r = Math.round(Math.sqrt(sq)); return r * r === sq ? String(r) : `√${sq}`; }
  return exactForm(x.num).plain;
};
const decimalOf = x => (x.vec ? showVector(x.vec) : String(Number(x.num.toPrecision(6))));
const showVector = v => `(${v.map(x => String(Number(x.toPrecision(12)))).join(', ')})`;

// `tickOnly` (the second reading of a page, see readTwice): nothing is crossed and nothing halts the lines below it. A line that would have been
// crossed is a note marked `readingFalse`, so the caller knows the line is false under this reading.
function stepCheckArithmeticWithinBudget(workingText, prep = null, tickOnly = false) {
  const original = String(workingText || '').split('\n').map(l => l.trim()).filter(Boolean);
  const raw = putGivenInIntegrals(original.map(normaliseInk), prep);
  // Lines where the reader's degree sign was read as a prime (`y° = …`): such a line may be the definition y = … written with a stray mark, so a
  // derivative that does not fit is never crossed on it (see pageDefinitions).
  const degreePrimed = new Set(original.flatMap((l, k) => (DEGREE_FOR_PRIME.test(l) ? [k] : [])));
  const columns = findColumns(raw), columnMembers = new Set([...columns.values()].flatMap(c => c.members));
  // Another vector somewhere on the page (a comma or semicolon column, a named vector, a magnitude of a combination): only then is a slash column read.
  const vectorPage = raw.some(x => /\[[^\[\]|]*[,;][^\[\]|]*\]/.test(x) || /(?<![A-Za-z])[a-z]\s*=\s*[\[(]\s*-?\d/.test(x) || /\|[^|]*[A-Za-z][^|]*[+\-][^|]*\|/.test(x));
  const lastValue = new Map();   // line index → the value a ticked line came to (for a bare value written under it)
  const out = [];
  let firstBreak = -1;
  let diagnosis = null;
  let labelled = false;
  const lastSides = new Map();   // line index → the last side of a plain-number tick (for "This simplifies to")
  let prev = null;   // { text, value } or { text, ast, vars }: the last side of the line above, when it could be read
  // The nearest earlier line that was read as a numeric vector or the magnitude of one, and that no warning was raised on: { text, value }.
  let vectorRef = null;

  const note = (text, why, extra = {}) => { out.push({ text, status: 'note', note: why, unverified: true, ...extra }); };

  raw.forEach((line, i) => {
    const carried = prev;
    // A label is set aside: `Numerator:`, `LHS =` in front, `= RHS` behind, an end mark. What such a line leaves for
    // the `=` line below is tick only, like a line of letters.
    // (a word in front of `=`, such as `Area = …`, labels the line like `Area: …`; a full stop or semicolon may end it)
    const src0 = line.replace(/\s*[;.]\s*$/, '').replace(/^(?!(?:sin|cos|tan|sec|cosec|csc|cot|ln|log|sqrt|exp|abs|pi|ans|answer|lhs|rhs)\b)[A-Za-z]{3,14}\s*=\s*(?=\S)/i, '').replace(/^[A-Za-z][A-Za-z ]{1,24}:\s*(?=\S)/, '').replace(/^(?:LHS|RHS|L\.H\.S\.?|R\.H\.S\.?)\s*=\s*(?=\S)/i, '').replace(DERIVATIVE_LABEL, '')
      .replace(/\s*(?:\/\/|∎|□)\s*$/, '').replace(/\s*=\s*(?:LHS|RHS|L\.H\.S\.?|R\.H\.S\.?)\s*$/i, '')
      // `t = 4: 6(16) + 8(4) + 5`: the substitution in front is set aside like any other label (a line that follows it is held to the expression). Tick only (see `substituted`).
      .replace(SUBSTITUTION_PREFIX, '');
    const substituted = SUBSTITUTION_PREFIX.test(line);
    // Owner, 19 November 2026 (a sign slip a competitor caught: `a(2) = (4 - 8 + 2)e^(-2) = 2e^(-2) > 0 so …`):
    //   · a value of a function in front of a worked chain (`a(2) = … = …`) is a label for the chain;
    //   · words after the chain are set aside; `> 0` or `< 0` after it is kept as a claim about the chain's value,
    //     and a tick needs that claim to be true as well.
    let src = src0.replace(/^\(?[a-h]\)(?:\s*\((?:i{1,3}|iv|v)\))?\s+(?=\S)|^\((?:i{1,3}|iv|v)\)\s+(?=\S)/i, ''), signClaim = null;
    { const tail = src.match(/^(.*=.*?)\s*([<>])\s*0\s*(?:(?:so|hence|therefore|thus|which)\b[^=<>]*)?$/i);
      if (tail) { src = tail[1]; signClaim = tail[2]; }
      else { const words = src.match(/^(.*=.*?[\d)])\s+(?:so|hence|therefore|thus)\s+[A-Za-z][^=<>\d]*$/i); if (words) src = words[1]; }
      src = src.replace(/^[A-Za-z]'{0,2}\(\s*-?\d+(?:\.\d+)?\s*\)\s*=\s*(?=[^=]+=)/, ''); }
    const afterLabel = labelled; labelled = src !== line;
    const beforeComma = src;
    src = commaVectorsAsColumns(src, carried);
    const commaForm = src !== beforeComma;
    src = slashVectorsAsColumns(src, carried, vectorRef, vectorPage);
    // Plain arithmetic only, with one more case (owner, 19 November: `… = log 3 + log 2 + log 5` then `= log(3 + 2 + 5)`):
    // a line of letters whose LAST side is a worked expression of plain numbers. The `=` line below it rewrites that
    // expression, so it is held to it. A bare number left by such a line (`t = 5` then `= 20`) stays tick only.
    const before = carried && carried.value !== undefined && (!carried.calculus || carried.compound) && !afterLabel ? carried : null;
    // Only the first rewrite is held this way. What it leaves for the line after it is tick only again: `d = 3^2 + 4^2`,
    // `= 25`, `= 5` drops a square root without writing it, and the last line is not a claim that 25 is 5.
    const underLetters = !!(carried && carried.calculus);
    prev = null;
    if (i >= LIMITS.lines || line.length > LIMITS.chars) return note(line, 'Not checked: this line is too long or too far down the working to check.');
    if (firstBreak !== -1) return note(line, 'Follows from the earlier slip.');
    // A column sum (see findColumns): the block never reaches the line below it, and only its last line carries a verdict.
    if (columnMembers.has(i)) {
      // What the line above the block came to still stands for the `=` line below it: tick only (the block may be margin work).
      prev = carried ? { ...carried, calculus: true, compound: false } : null; labelled = false;
      const block = columns.get(i);
      if (!block) return note(line, NOTE);
      if (block.adds) {
        out.push({ text: line, status: 'ok', state: 'arithmetic', note: `This column adds up: ${mathSpan(`${block.expression} = ${block.last}`)}.`, valueChain: { rule: 'true-as-written' } });
        return;
      }
      return note(line, 'Not checked: Pri does not mark a column of numbers that does not add up as written, so this line is not marked.');
    }
    // A number with more than 15 significant digits is beyond what is held exactly here: the line is not judged.
    if ((src.match(/\d+(?:\.\d+)?/g) || []).some(n => significantDigits(n) > 15)) return note(line, NOTE);
    // Numeric column vectors (see vectorSide): tick only.
    if (VECTOR_BRACKET.test(src)) {
      const body = src.replace(/\s*\.\s*$/, '');
      if (!/[<>≤≥≠≈%°,]|==|!=/.test(body)) {
        const bits = body.split('=').map(x => x.trim());
        const cont = bits[0] === '' && bits.length >= 2;
        const written = cont ? bits.slice(1) : bits;
        const values = written.every(Boolean) ? written.map(vectorSide) : [];
        if (values.length && values.every(Boolean)) {
          const tail = values[values.length - 1];
          // A comma-form line whose last side is a number is an ordinary line of numbers from there on: the lines under it are judged as any are.
          const carry = tail.vec ? { vec: tail.vec, text: written[written.length - 1], calculus: true } : { value: tail.num, text: written[written.length - 1], ...(commaForm ? {} : { calculus: true }) };
          const above = cont && written.length === 1 && carried && (carried.vec ? { vec: carried.vec } : carried.value !== undefined ? { num: carried.value } : null);
          const all = above ? [above, ...values] : values;
          prev = carry;
          // The vector slip warning (see vectorRef): a continuation whose value is not the value of the nearest earlier vector line.
          // Never a tick and never a cross: reader layout of column vectors is unreliable, so the line is a note that says what to check.
          if (cont && vectorRef && !!vectorRef.value.vec === !!values[0].vec && !sameVectorSide(vectorRef.value, values[0])) {
            const agree = values.length >= 2 && values.every(x => sameVectorSide(x, values[0]));
            const earlier = `${mathSpan(vectorRef.text.replace(/^=\s*/, ''))}`;
            const own = agree ? `The two sides of this line agree (${showSide(values[0])}), but it ` : 'This line ';
            prev = null;
            return note(line, `${own}does not equal the earlier line ${earlier}, which comes to ${showSide(vectorRef.value)} (${decimalOf(vectorRef.value)}). Check each component.`, { vectorWarning: true });
          }
          const same = all.length >= 2 && all.every(x => sameVectorSide(x, all[0]));
          if (written.every(Boolean) && values.every(x => sameVectorSide(x, values[0]))) vectorRef = { text: original[i] ?? line, value: tail };
          if (same) {
            const what = all[0].vec ? `the same vector ${showVector(all[0].vec)}` : shown(all[0].num);
            out.push({ text: line, status: 'ok', state: 'arithmetic', note: above ? `This equals the line above: ${what}.` : `Both sides come to ${what}.`, valueChain: { rule: 'true-as-written' } });
            return;
          }
          return note(line, NOT_PROVED);
        }
      }
    }
    const text0 = src.replace(/\s*\.\s*$/, '').replace(/[−–—]/g, '-').replace(/[×·]/g, '*').replace(/÷/g, '/').replace(/^∴\s*/, '').replace(/^(so|hence|then|therefore|thus)\s+/i, '')
      // `Ans = 72` continues the line above; `6 x 12` between two numbers is a times sign; square brackets group.
      .replace(ANS_LABEL, '').replace(/(\d|\)|!)\s+x\s+(?=\d|\()/gi, '$1*')
      .replace(/\[([^\[\],;_]*)\](?![_^])/g, '($1)');
    const ansLine = ANS_LABEL.test(src.replace(/^∴\s*/, '').replace(/^(so|hence|then|therefore|thus)\s+/i, ''));
    // A root with an index, √[3]{…}, is not read: its bracket is not a grouping.
    if (/(?:√|sqrt)\s*\[/i.test(src)) return note(line, NOTE);
    const calc = /∫|\]_/.test(text0) ? workOutCalculus(text0) : { text: text0, used: false };
    if (!calc) return note(line, NOT_PROVED);
    // Degrees (30°): read as radians, tick only, letters only inside a trigonometric function. See "Degrees" above.
    const degrees = DEGREE_SIGN.test(calc.text);
    DEGREE_SIGN.lastIndex = 0;
    const text = bracketFunctions(degrees ? calc.text.replace(DEGREE_SIGN, '($1*pi/180)').replace(/(?<![A-Za-z])(sin|cos|tan|sec|cosec|csc|cot)\s+\(/g, '$1(') : calc.text);
    if (degrees && (/°/.test(text) || !lettersOnlyInTrig(text))) return note(line, NOTE);
    // Independent review, round 1. None of these is arithmetic Pri can read one way only, so none is judged:
    //   a line label or a trailing equation number (`1. 2+3 = 5`, `(2) 2+3 = 5`, `2 + 3 = 5 (2)`), which would be multiplied in;
    //   a comma (two statements on a line, or a decimal comma); a line that starts with an operator and so carries the
    //   line above forward (`- 1 = 2`); a spaced dot (`3 . 4`).
    if (/^\(?\d{1,3}[.)](?:\s|$)|^\(\d{1,3}\)|\s\(\d{1,3}\)\s*$|[,;:]|^[+*/×÷]|^-\s|\d\s+\.\s*\d|\d\s*\.\s+\d/.test(src.replace(/[−–—]/g, '-'))) return note(line, NOTE);
    // A mixed number (2 1/2) or a spaced thousand (1 000) reads as a product: two numbers side by side are not judged.
    if (/[<>≤≥≠%°]|==|!=|\d\s+\d/.test(text)) return note(line, NOTE);
    // Any letter left (a variable, π, e, a unit, a function name) and the line is not arithmetic on numbers alone.
    // nCr and nPr between two numbers, and sqrt, are arithmetic.
    // The constants e and π are numbers; a digit on each side of e (3e2) is not read.
    const CONSTANT = /(?<![A-Za-z])(?:e|pi|π)(?![A-Za-z])/g;
    if (/\de\s*[-+]?\s*\d/.test(text)) return note(line, NOTE);   // 3e2, and 2e + 3 (which reads as 2000)
    if (calc.used || degrees || /[A-Za-zπθ]/.test(text.replace(/sqrt/gi, '').replace(/(\d)\s*[CP]\s*(?=\d)/g, '$1').replace(CONSTANT, '').replace(/(?<![A-Za-z])(?:ln|log)(?=\()/g, ''))) {
      if (signClaim) return note(line, NOT_PROVED);
      // True as written, or a note: never a cross (see "Lines that are true as written").
      if (/≈|≃|~/.test(text)) return note(line, NOT_PROVED);
      const bits = text.split('=').map(s => s.trim());
      const cont = bits[0] === '' && bits.length >= 2;
      const written = cont ? bits.slice(1) : bits;
      if (written.some(s => !s)) return note(line, UNREAD, { unreadable: true });
      // A last side of plain numbers carries to the `=` line below (tick only) even when the line itself is not read.
      { const tail = valueOf(written[written.length - 1]); if (tail !== null) prev = { text: written[written.length - 1], value: tail, calculus: true, compound: !calc.used && /[-+*\/^(]/.test(written[written.length - 1].trim().replace(/^-/, '')) }; }
      // Independent review (two rounds): a letter before a bracket may be a function, and f(x+h) = f(x)+f(h) or
      // x(t+h) = xt+xh read as products is a false line that looks like an identity. A letter before a bracket is read
      // as a product only when the same letter stands inside that bracket (x(x+2), n(n+1)): a function is not applied
      // to itself in school working. A named function must be followed by its bracket (sin x^2 groups two ways).
      // A division or a power followed by a number-and-letter or two letters (1/2x, x^2x, 1/xy) groups two ways too.
      const NAMED = /(?<![A-Za-z])(?:sqrt|arcsin|arccos|arctan|asin|acos|atan|cosec|sin|cos|tan|sec|csc|cot|ln|log|exp|abs)(?![A-Za-z])/gi;
      if (/#(?!\()/.test(text.replace(NAMED, '#'))) return note(line, NOT_PROVED);
      // e^x(…): the exponent is one letter and a bracket follows it, so it is read as e^x times the bracket (see above).
      const bare = text.replace(NAMED, '#').replace(EXPONENT_LETTER_BRACKET, '^($1)');
      for (const m of bare.matchAll(/([A-Za-zπθ])\s*\(/g)) {
        let depth = 0, end = -1;
        for (let k = m.index + m[0].length - 1; k < bare.length; k++) { if (bare[k] === '(') depth++; else if (bare[k] === ')' && --depth === 0) { end = k; break; } }
        const inside = end < 0 ? '' : bare.slice(m.index + m[0].length, end);
        if (!new RegExp(`${m[1]}(?!\\s*\\()`).test(inside)) return note(line, NOT_PROVED);
      }
      if (/\/\s*\d+(?:\.\d+)?\s*[A-Za-z(]|\/\s*[A-Za-z]\s*[A-Za-z(]|\^\s*-?\d+(?:\.\d+)?[A-Za-z]|\^\s*[A-Za-z][A-Za-z0-9(]/.test(bare)) return note(line, NOT_PROVED);
      // A division followed by a product groups two ways (6/2(1+2), 10!/3!7!, 1/cos θ tan θ, 1/2x). Every bracket is
      // first folded to one mark, so a function's own bracket cannot hide what follows the denominator.
      if (written.some(s => twoWays(folded(s).trim()))) return note(line, NOT_PROVED);
      const infos = written.map(infoOf);
      const lastInfo = infos[infos.length - 1];
      // What a line of letters or an integral leaves for the `=` line below is tick only (`calculus`): `t = 5` then `= 20`
      // is the student carrying on something else, not a claim that 5 is 20 (found by the labelled audit).
      if (lastInfo) prev = { text: written[written.length - 1], ...lastInfo, calculus: true, compound: !calc.used && lastInfo.value !== undefined && /[-+*\/^(]/.test(written[written.length - 1].trim().replace(/^-/, '')) };
      if (infos.some(x => !x)) return note(line, NOT_PROVED);
      const all = cont && carried ? [carried, ...infos] : infos;
      if (all.length < 2 || !all.every(x => sameAsWritten(x, all[0]))) return note(line, NOT_PROVED);
      const number = all.find(x => x.value !== undefined);
      const why = calc.used ? (number ? `Worked out, each side comes to ${shown(number.value)}.` : 'Worked out at the limits, the sides agree.')
        : number ? (cont && carried ? `This equals the line above: ${shown(number.value)}.` : `Both sides come to ${shown(number.value)}.`)
          : cont && carried ? 'This is the line above, written another way.' : 'Both sides are the same expression, written two ways.';
      // The step is named from the first two sides that differ in writing (the line above and this one, or this line's own sides).
      const texts = cont && carried ? [carried.text, ...written] : written;
      let named = !calc.used && !number ? nameOfRule(texts[0], texts[1]) : '';
      if (!calc.used && !named) named = trigStepName(texts[0], texts[1]);
      if (!calc.used) lastSides.set(out.length, written[written.length - 1]);
      if (all.every(x => x.value !== undefined)) lastValue.set(out.length, all[0].value);
      out.push({ text: line, status: 'ok', state: 'arithmetic', note: named ? `${why} It matches ${named}.` : why, valueChain: { rule: 'true-as-written' }, ...(number && !named ? { fact: { kind: cont && carried ? 'equals-line-above' : 'both-sides', tex: exactForm(number.value).tex } } : {}) });
      return;
    }
    const approx = /≈|≃|~/.test(text);
    const parts = text.replace(/[≈≃]/g, '=').split('=').map(s => s.trim());
    const continuation = parts[0] === '' && parts.length >= 2;
    const sides = continuation ? parts.slice(1) : parts;
    if (sides.some(s => !s)) return note(line, UNREAD, { unreadable: true });
    const values = sides.map(valueOf);
    // The last side carries to a `= …` line below, whether or not this line states anything.
    const last = values[values.length - 1];
    if (last !== null) prev = { value: last, text: sides[sides.length - 1], prior: prev && typeof prev.value === 'number' ? prev.value : undefined, lineSides: sides.length, lineContinuation: continuation, lineInternal: values.every(v => v !== null && close(v, values[0])), labelled: !continuation && sides.length >= 2 && /[A-Za-z]/.test(sides[0]), ...(underLetters ? { calculus: true } : {}) };
    if (values.some(v => v === null)) return note(line, NOTE);
    // After a line worked out numerically (an integral) or a line of letters, a `=` line of numbers is ticked when it
    // agrees and is otherwise a note: the value above came from limits or letters that may have been misread.
    if (continuation && carried && !before) {
      const agrees = carried.value !== undefined && values.every(v => closeLoose(v, carried.value));
      if (agrees) {
        prev = { ...prev, calculus: true }; lastSides.set(out.length, sides[sides.length - 1]); lastValue.set(out.length, carried.value);
        const trig = carried.text ? trigStepName(carried.text, sides[0]) : '';   // sin 30° then = 1/2
        out.push({ text: line, status: 'ok', state: 'arithmetic', note: `This equals the line above: ${shown(carried.value)}.${trig ? ` It matches ${trig}.` : ''}`, valueChain: { rule: 'true-as-written' }, ...(trig ? {} : { fact: { kind: 'equals-line-above', tex: exactForm(carried.value).tex } }) });
        return;
      }
      return note(line, NOT_PROVED);
    }
    const allSides = continuation && before ? [before.text, ...sides] : sides;
    const allValues = continuation && before ? [before.value, ...values] : values;
    if (allSides.length < 2) return note(line, continuation ? 'Not checked: the line above is not arithmetic Pri can check, so this line has nothing to be compared with.' : NOTE);

    // A division followed by a product (6/2(1+2), 10!/3!7!, 5·4·3/3·2·1) is read two ways by convention: not judged.
    if (allSides.some(s => /[\/÷]/.test(s) && /[\/÷].*(?:\*|[\d)!]\s*\(|\)\s*\d|!\s*\d)/.test(s))) return note(line, NOTE);
    if (allSides.some(x => x.match(CONSTANT) && twoWays(folded(x).trim()))) return note(line, NOTE);   // 1/2π groups two ways
    // `log` may be base 10 or base e. A line with it is ticked only when it is true in both, and crossed only when it
    // is false in both (log 3 + log 2 + log 5 = log(3 + 2 + 5) is false whichever base is meant).
    const BARE_LOG = /(?<![A-Za-z])log\(/g;
    let logFalseInBoth = false;
    if (allSides.some(x => x.match(BARE_LOG))) {
      const natural = allSides.map(x => valueOf(x.replace(BARE_LOG, 'ln(')));
      if (natural.some(v => v === null)) return note(line, NOTE);
      const true10 = allValues.every(v => close(v, allValues[0])), trueE = natural.every(v => close(v, natural[0]));
      if (true10 !== trueE) return note(line, 'Not checked: this line is true for one base of log and not the other, so it is not marked.');
      logFalseInBoth = !true10;
    }
    const soft = approx || allSides.some(s => /\d\.\d|^\.\d|[^\d]\.\d/.test(s) || FUNCTION_WORDS.test(s.replace(/(?<![A-Za-z])(?:ln|log)(?=\()/g, '')));
    // A logarithm set equal to a plain number (ln 5 = 2, log 100 = 3) may be a rounding or a slip of base: a cross needs
    // a logarithm on both of the sides that disagree.
    { const hasLog = x => /(?<![A-Za-z])(?:ln|log)\(/.test(x); const k0 = allValues.findIndex(v => !close(v, allValues[0]));
      if (k0 > 0 && allSides.some(hasLog) && !(hasLog(allSides[0]) && hasLog(allSides[k0]))) return note(line, SOFT_NOTE); }
    if (allValues.every(v => close(v, allValues[0]))) {
      if (signClaim && !(signClaim === '>' ? allValues[0] > 0 : allValues[0] < 0)) return note(line, NOTE);
      const trig = continuation && before && before.text ? trigStepName(before.text, sides[0]) : '';   // sin 30° then = 1/2
      const why = (continuation && before ? `This equals the line above: ${shown(allValues[0])}.` : `Both sides come to ${shown(allValues[0])}.`) + (trig ? ` It matches ${trig}.` : '');
      lastSides.set(out.length, allSides[allSides.length - 1]); lastValue.set(out.length, allValues[0]);
      out.push({ text: line, status: 'ok', state: 'arithmetic', note: why, valueChain: { rule: 'arithmetic' }, ...(trig ? {} : { fact: { kind: continuation && before ? 'equals-line-above' : 'both-sides', tex: exactForm(allValues[0]).tex } }) });
      return;
    }
    if (soft) return note(line, SOFT_NOTE);
    // With e or π on the line a cross needs the constant on every side: `2π = 6` or `e^2 = 7` is a rounding, not a slip.
    { const withConstant = allSides.filter(x => x.match(CONSTANT)).length; if (withConstant && withConstant !== allSides.length) return note(line, SOFT_NOTE); }
    // e may be the student's own letter (e^2 = 4e is true when e = 4): a cross needs every e on the line to be the
    // base of a power, e^(…), which is how Euler's number is written in working. A bare or multiplied e is a note.
    if (allSides.some(x => /(?<![A-Za-z])e(?![A-Za-z])(?!\s*\^)/.test(x))) return note(line, NOTE);
    if (ansLine) return note(line, NOTE);
    // Two bare numbers and nothing else (`500 = 340`) is words lost in reading, not a sum someone got wrong.
    if (allSides.every(x => /^\s*-?\d+(?:\.\d+)?\s*$/.test(x)) && !(continuation && before)) return note(line, NOTE);
    // Owner's page, 19 November 2026 (live): a number jotted in the margin was read into the start of a true line,
    // `16/3 = 2[2(4)^2 - 4^3/3] = 2[32 - 64/3]`, and the line was crossed. A bare number in FRONT of worked
    // expressions that agree with one another is not the line's own claim:
    //   · when what follows it equals the chain above, the line is ticked as that continuation, and the comment says
    //     the number in front was left out;
    //   · otherwise the line is a note. It is never crossed.
    if (!continuation && allSides.length >= 2 && /^\s*-?\d+(?:\.\d+)?(?:\s*\/\s*\d+)?\s*$/.test(allSides[0]) && /[-+*\/^(]/.test(allSides.slice(1).join(' ').replace(/^\s*-/, ''))) {
      const rest = allValues.slice(1);
      if (rest.every(v => close(v, rest[0])) && !close(allValues[0], rest[0])) {
        if (carried && carried.value !== undefined && closeLoose(rest[0], carried.value)) {
          prev = { value: rest[0], text: sides[sides.length - 1], calculus: true };
          lastSides.set(out.length, allSides[allSides.length - 1]); lastValue.set(out.length, rest[0]);
          out.push({ text: line, status: 'ok', state: 'arithmetic', note: `This equals the line above: ${shown(rest[0])}. The ${mathSpan(allSides[0])} in front of it was not read as part of the line.`, valueChain: { rule: 'true-as-written' } });
          return;
        }
        return note(line, MISREAD_NOTE);
      }
    }
    if (trueUnderAnotherReading(allSides, allValues) || trueUnderExponentReading(allSides, allValues)) return note(line, MISREAD_NOTE);
    // The question's own worked solution reaches the value this line gives, and the line is plainly the START of the next authored step with
    // its lazy `=`, not a claim that it equals the line above. Only these shapes are a note; anything else that continues an evaluable line
    // and differs from it stays a cross (a value that merely appears somewhere in the solution is no reason to excuse it):
    //   · the line begins from the value above (`= 7 - 2 = 5` after `7`);
    //   · it is the value above after one operation left unwritten (a root or a square: `= 60` after `3600`; doubling and halving are NOT excused, because a dropped or extra factor of 2 is the commonest slip);
    //   · two parallel calculations, each a complete true equation (`= 4 - (-5) = 9` then `= -5 + 4 = -1`);
    //   · a value listed after a value listed (`= 10` then `= 6`), or a value after a named quantity (`sin B = 48/73` then `= (…)/365`).
    if (continuation && before && SOLUTION_VALUES) {
      const kk = allValues.findIndex(x => !close(x, allValues[0]));
      const W = kk >= 0 ? allValues[kk] : null, V = allValues[0];
      const bareToken = /^\s*-?\d+(?:\.\d+)?\s*$/.test(String(before.text ?? '')) ? String(before.text).trim() : null;
      const startsFromAbove = bareToken !== null && new RegExp(`(?<![\\d.])${bareToken.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\d.])`).test(String(sides[0]));
      const oneOperation = [Math.sqrt(Math.abs(V)), V * V, 10 * V, V / 10].some(x => W !== null && closeLoose(x, W));
      const parallel = sides.length >= 2 && values.every(v => close(v, values[0])) && before.lineSides >= 2 && before.lineInternal === true;
      const combined = W !== null && typeof before.prior === 'number' && (closeLoose(W, V + before.prior) || closeLoose(W, V * before.prior) || closeLoose(W, Math.abs(V - before.prior)));   // the two results above combined (55/78 and 1/78 give 28/39)
      const isAnswer = W !== null && typeof ANSWER_VALUE === 'number' && closeLoose(W, ANSWER_VALUE);   // the question's correct answer, written lazily after the working
      const listed = sides.length === 1 && /^\s*-?\d+(?:\.\d+)?(?:\s*\/\s*\d+)?\s*$/.test(sides[0]) && before.lineSides === 1 && before.lineContinuation === true;
      const afterName = before.labelled === true || before.calculus === true;
      if (W !== null && SOLUTION_VALUES.some(v => closeLoose(v, W)) && (startsFromAbove || oneOperation || parallel || listed || afterName || combined || isAnswer)) {
        return note(line, `This line does not equal the line above (${shown(allValues[0])}) as written, but it is a value the worked solution reaches and it reads as the start of the next step, so it is left as a note. Write the step that gets from one to the other.`);
      }
    }
    // A division sign with a fraction on the same line (1/10 ÷ 2/3) is read left to right by one convention and as written by another.
    if (allSides.some(x => (/÷/.test(x) && /\d\s*\/\s*\d/.test(x)) || /\d\s*[\/÷]\s*\d+(?:\.\d+)?\s*[\/÷]\s*\d/.test(x))) return note(line, NOTE);   // 15 ÷ 5/8 and 1/10 ÷ 2/3: two readings
    const k = allValues.findIndex(v => !close(v, allValues[0]));
    const message = logFalseInBoth ? `${mathSpan(allSides[0])} does not equal ${mathSpan(allSides[k])}, whether log means base 10 or base e.`
      : continuation && before && k >= 1 && allValues.slice(1, k).every(v => close(v, allValues[0]))
      ? `The line above comes to ${shown(allValues[0])}, but this line gives ${shown(allValues[k])}.`
      : `${mathSpan(allSides[0])} comes to ${shown(allValues[0])}, but this line gives ${shown(allValues[k])}.`;
    if (tickOnly || substituted) return note(line, NOT_PROVED, { readingFalse: true });
    // Structured facts (never parsed from the message), carried for engine/lineCommentary.js and used by no verdict:
    //   · a line that continues the line above: the value the working reached and the value this line gives;
    //   · otherwise the first two sides that disagree (side 1 and side k), each with its text, its value and whether it is a bare
    //     number, because either side may be the slip when both are computed expressions;
    //   · a log line that is false under both readings carries no value: no single reading is "the" value.
    const bareNumber = x => /^\s*-?\d+(?:\.\d+)?(?:\s*\/\s*\d+(?:\.\d+)?)?\s*$/.test(x);   // a number or a plain fraction
    const fromAbove = continuation && before && k >= 1;
    const facts = logFalseInBoth ? {}
      : fromAbove ? { expectedTex: exactForm(allValues[0]).tex, writtenTex: exactForm(allValues[k]).tex, expectedFrom: 'line-above' }
      : { expectedFrom: 'sides', sides: { count: allSides.length,
          left: { text: allSides[0], tex: exactForm(allValues[0]).tex, bare: bareNumber(allSides[0]) },
          right: { text: allSides[k], tex: exactForm(allValues[k]).tex, bare: bareNumber(allSides[k]) } } };
    diagnosis = { code: 'arithmetic-not-equal', title: 'The two sides of this line are not equal', message, fix: 'Work this line out again, one operation at a time.', confidence: 'high', ...facts };
    firstBreak = i;
    out.push({ text: line, status: 'break', note: message, diagnosis });
    prev = null;
  });

  // A bare value on its own line (64/3) that equals what the working above came to: the student writing the result.
  // Ticked; one that does not equal it stays a note (it may be margin work), and is never crossed.
  if (firstBreak === -1) {
    const BARE = /^-?(?:\d+(?:\.\d+)?(?:\s*\/\s*\d+(?:\.\d+)?)?|\d*\s*√\s*\d+)$/;
    const bareText = k => raw[k].replace(/[−–—]/g, '-').replace(/\s*\.\s*$/, '').trim();
    for (let k = 1; k < out.length; k++) {
      if (out[k].status !== 'note' || out[k].note !== NOTE || columnMembers.has(k) || !BARE.test(bareText(k))) continue;
      const v = valueOf(bareText(k));
      if (v === null) continue;
      let j = k - 1;
      while (j >= 0 && !columnMembers.has(j) && BARE.test(bareText(j)) && !(out[j].status === 'ok' && lastValue.has(j))) j--;
      if (j < 0 || columnMembers.has(j) || out[j].status !== 'ok' || !lastValue.has(j)) continue;
      const chain = lastValue.get(j);
      // Exactly the value of the working above, or (written with 2 or more decimal places, the working being a value
      // that never ends as a decimal) that value rounded to the places written. A later digit that differs is a note.
      const places = (bareText(k).split('.')[1] || '').length;
      const ends = [...Array(10).keys()].some(d => Math.abs(chain * 10 ** d - Math.round(chain * 10 ** d)) <= 1e-7);
      const rounded = !close(v, chain) && places >= 2 && /^-?\d+\.\d+$/.test(bareText(k)) && !ends && Math.abs(Math.round(chain * 10 ** places) / 10 ** places - v) <= 1e-12 * Math.max(1, Math.abs(v));
      if (!close(v, chain) && !rounded) continue;
      out[k] = { text: out[k].text, status: 'ok', state: 'arithmetic', note: rounded ? `This is the working above, rounded: ${bareText(k)}.` : `This is the value of the working above: ${shown(v)}.`, valueChain: { rule: 'true-as-written' } };
      lastValue.set(k, rounded ? chain : v);
    }
  }
  // The second pass: what the page itself defines (see pageDefinitions).
  {
    let broke = null;
    try { broke = pageDefinitions(raw, out, firstBreak, prep, degreePrimed, tickOnly); } catch { broke = null; }
    if (broke) {
      const message = broke.message;
      diagnosis = { code: 'page-definition-not-held', title: 'This line does not agree with what you wrote above', message, fix: 'Put the value from the earlier line in again and work this line out once more.', confidence: 'high' };
      firstBreak = broke.index;
      out[broke.index] = { text: out[broke.index].text, status: 'break', note: message, diagnosis };
      for (let k = broke.index + 1; k < out.length; k++) out[k] = { text: out[k].text, status: 'note', unverified: true, note: 'Follows from the earlier slip.' };
    }
  }
  // Words only: the last ticked line of a page that has no cross says when its last side is not yet one value.
  if (firstBreak === -1) {
    let k = out.length - 1;
    while (k >= 0 && !(out[k].status === 'ok' && out[k].state === 'arithmetic')) k--;
    if (k >= 0 && lastSides.has(k)) {
      let more = '';
      try {
        more = simplifiesTo(lastSides.get(k), out[k].note);
        // Not when a later line of the page already states that value (a bare value under the working, or an `=` line).
        { const v = valueOf(lastSides.get(k));
          const states = j => (j > k && v !== null) && raw[j].replace(/\s*\.\s*$/, '').split('=').some(x => { const t = x.trim().replace(/[−–—]/g, '-'); return t && valueOf(t) !== null && closeLoose(valueOf(t), v); });
          if (more && raw.some((_, j) => states(j))) more = ''; }
        // Like terms left uncollected: the last line only (a middle line may be mid-working), and only where the plain-number note had nothing to say.
        // Not when the collected form is already written on the page (2x = x + x): the student has said it.
        const written = new Set(raw.flatMap(l => l.split('=')).map(x => x.replace(/[\s−–—]/g, m => (/\s/.test(m) ? '' : '-'))));
        if (!more && k === out.length - 1) { const collected = collectLikeTerms(lastSides.get(k)); if (collected && !written.has(collected.replace(/\s/g, ''))) more = out[k].note.includes(mathSpan(collected)) ? ' Give the final answer in that simplified form.' : ` This simplifies to ${mathSpan(collected)}.`; }
      } catch { more = ''; }
      // `simplifyNote` on the fact tells engine/lineCommentary.js that the note carries simplify advice the commentary would drop
      if (more) out[k] = { ...out[k], note: out[k].note + more, ...(out[k].fact ? { fact: { ...out[k].fact, simplifyNote: true } } : {}) };
    }
  }
  const state = l => l.state || (l.status === 'break' ? 'wrong' : l.unreadable ? 'unread' : 'unverified');
  const lines = out.map((l, k) => ({ ...l, text: original[k] ?? l.text, state: state(l) }));
  const at = st => lines.flatMap((l, k) => (l.state === st ? [k + 1] : []));
  const unverified = at('unverified'), unread = at('unread');
  const summary = {
    total: lines.length,
    checked: lines.filter(l => l.status === 'ok').length,
    given: [], verified: [], arithmetic: at('arithmetic'), conditions: [], wrong: at('wrong'), unverified, unread,
    reason: unverified.length ? 'Pri checks only the arithmetic on this question. These lines have none it can check on its own.' : null
  };
  return { lines, firstBreak, diagnosis, source: 'value-chain', arithmetic: true, summary };
}
