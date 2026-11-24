// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the author question bank's MANUAL parts (Prithagoras, NSW Years 11-12)
//
// About 3,000 of the owner's parts are `answerType: "manual"`: show / prove / explain / sketch / justify, and "find" questions whose answer
// was never given a structured key. This module does two things with them, from the data alone, and never invents a mark:
//
//   1. classifyManual  which of four kinds a part is, from its prompt's words (outside the maths).
//   2. deriveKey       for a "find" part only: a structured key (numeric, expression, equation, set or point) when, and only when, his own
//                      printed answer `ans` reads fully as ONE value of one of those forms AND that value is a result of his LAST worked step.
//                      Anything else is not guessed: the part stays a worked-solution question (no mark, ever).
//
// The caller (tools/qbank-import.mjs) then runs a derived part through exactly the checks an authored auto-markable part passes (the engine
// accepts the key, the hint leak rule, the figure rule, the layout rules) plus one more here: at least two plausible WRONG values are refused.
//
// For a part that stays manual, `manualHintLeaks` is the leak rule: the "answer" of a show-that question is in its prompt, so a hint is held
// against the RESULTS of his worked steps instead: a hint may not state one.
//
// Pure and deterministic: no clock, no network, no model, no randomness.
// ─────────────────────────────────────────────────────────────────────────────
import { exprEquivalent, parse, normalize, evaluate } from '../client/src/engine/expr.js';
import { texToPlain } from './qbank-leak.mjs';

const MATH = /(?<!\\)\$((?:\\\$|[^$])+?)(?<!\\)\$/g;
const spansOf = t => [...String(t ?? '').matchAll(MATH)].map(m => m[1]);
const proseOf = t => String(t ?? '').replace(MATH, ' ');
const safe = (fn, fallback = null) => { try { return fn(); } catch { return fallback; } };

// ── 0. function applications, written with their brackets ────────────────────
// TeX writes `\cos 2x` and means cos(2x); the engine reads the plain text `cos2x` or `cos 2x` as cos(2)·x. So every function application in
// a span is bracketed BEFORE it is turned into plain text (`\cos(2x)`). TeX's own rule for the argument of a function written without
// brackets: the run of numbers, letters, \pi, groups, fractions, roots and their powers that follows, up to an operator, a comma, a
// relation, a space-command or another function. `\sin x\cos x` is sin(x)·cos(x); `\ln \cos x` nests; `\sin^2 x` is (sin x)².
const FUNCS_TEX = 'arcsin|arccos|arctan|sin|cos|tan|sec|csc|cot|ln|log|exp';
const FN_AT = new RegExp(`^\\\\(${FUNCS_TEX})(?![A-Za-z])`);
const GREEK_TEX = /^\\(?:pi|theta|alpha|beta|gamma|phi|omega|lambda|mu|sigma|delta)(?![A-Za-z])/;
function texGroup(s, i) {   // `{…}` at i: end index after the closing brace, or -1
  if (s[i] !== '{') return -1;
  let d = 0;
  for (let j = i; j < s.length; j++) { if (s[j] === '\\') { j++; continue; } if (s[j] === '{') d++; else if (s[j] === '}' && --d === 0) return j + 1; }
  return -1;
}
function texArgEnd(s, i) {  // one TeX argument (a group, a command, or one character): end index, or -1
  while (s[i] === ' ') i++;
  if (s[i] === '{') return texGroup(s, i);
  if (s[i] === '\\') { const m = /^\\(?:[A-Za-z]+|.)/.exec(s.slice(i)); return m ? i + m[0].length : -1; }
  return i < s.length ? i + 1 : -1;
}
/** The end of one factor of an unbracketed function's argument starting at i, or -1. `first` lets a function be the factor. */
function factorEnd(s, i, first) {
  while (s[i] === ' ') i++;
  let e = -1;
  const rest = s.slice(i);
  let m;
  if ((m = /^\d+(?:\.\d+)?/.exec(rest))) e = i + m[0].length;
  else if ((m = /^[A-Za-z]/.exec(rest))) e = i + 1;
  else if ((m = GREEK_TEX.exec(rest))) e = i + m[0].length;
  else if (s[i] === '{') e = texGroup(s, i);
  else if ((m = /^\\[dt]?frac(?![A-Za-z])/.exec(rest))) { const a = texArgEnd(s, i + m[0].length); e = a < 0 ? -1 : texArgEnd(s, a); }
  else if ((m = /^\\sqrt(?![A-Za-z])/.exec(rest))) { let j = i + m[0].length; if (s[j] === '[') { const c = s.indexOf(']', j); if (c < 0) return -1; j = c + 1; } e = texArgEnd(s, j); }
  else if (first && (m = FN_AT.exec(rest))) { const r = applyAt(s, i); e = r.end; }
  if (e < 0) return -1;
  for (;;) {   // powers and subscripts bind to the factor
    let j = e; while (s[j] === ' ') j++;
    if (s[j] === '^' || s[j] === '_') { const a = texArgEnd(s, j + 1); if (a < 0) break; e = a; } else break;
  }
  return e;
}
/** The function command at i with its bracketed argument: { text, end }. */
function applyAt(s, i) {
  const m = FN_AT.exec(s.slice(i));
  let j = i + m[0].length;
  let head = m[0];
  while (s[j] === ' ') j++;
  if (s[j] === '^') { const a = texArgEnd(s, j + 1); if (a > 0) { head += s.slice(j, a); j = a; } }
  while (s[j] === ' ') j++;
  if (s[j] === '(' || s.startsWith('\\left(', j)) return { text: `${head} `, end: j };       // brackets given: they are the argument
  let end = j, first = true;
  for (;;) { const e = factorEnd(s, end, first); if (e < 0) break; end = e; first = false; }
  if (end === j) return { text: `${head} `, end: j };
  return { text: `${head}(${bracketFunctions(s.slice(j, end).trim())})`, end };
}
/** TeX with every function application bracketed: `\cos 2x-\cos 4x` becomes `\cos(2x)-\cos(4x)`. */
export function bracketFunctions(tex) {
  const s = String(tex ?? '');
  let out = '';
  for (let i = 0; i < s.length;) {
    if (s[i] === '\\' && FN_AT.test(s.slice(i))) { const r = applyAt(s, i); out += r.text; i = r.end; } else { out += s[i]; i++; }
  }
  return out;
}
/** TeX to the plain text the engine reads, function arguments bracketed. Same shape as texToPlain. */
export const plainOf = tex => texToPlain(bracketFunctions(tex));

// ── an independent reading of his TeX: evaluated directly, never through our engine ─────────────
// Used to prove the key (plain text, read by OUR engine) means what his own TeX means: both are evaluated at the same sample points.
const TEX_FN = { sin: Math.sin, cos: Math.cos, tan: Math.tan, sec: x => 1 / Math.cos(x), csc: x => 1 / Math.sin(x), cot: x => 1 / Math.tan(x), ln: Math.log, log: Math.log10, exp: Math.exp, arcsin: Math.asin, arccos: Math.acos, arctan: Math.atan };
function texTokens(src) {
  const s = String(src).replace(/\\([dt]?frac)\s*([0-9A-Za-z])\s*([0-9A-Za-z])(?![0-9A-Za-z])/g, '\\$1{$2}{$3}').replace(/\\(?:left|right|displaystyle|quad|qquad|,|;|!|:| )/g, ' ').replace(/\\mathrm\{\s*e\s*\}/g, 'e');
  const out = []; let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (/\s/.test(c)) { i++; continue; }
    let m;
    if ((m = /^\d+(?:\.\d+)?/.exec(s.slice(i)))) { out.push({ t: 'num', v: Number(m[0]) }); i += m[0].length; }
    else if (c === '\\') { m = /^\\([A-Za-z]+)/.exec(s.slice(i)); if (!m) throw new Error('tex'); out.push({ t: 'cmd', v: m[1] }); i += m[0].length; }
    else if (/[A-Za-z]/.test(c)) { out.push({ t: 'id', v: c }); i++; }
    else if ('+-*/^_(){}[]!'.includes(c)) { out.push({ t: c }); i++; }
    else throw new Error('tex');
  }
  return out;
}
/** The value of a TeX expression at `vars`, or null when it cannot be read or is not finite. */
export function evalTeX(src, vars = {}) {
  let toks; try { toks = texTokens(src); } catch { return null; }
  let k = 0;
  const peek = () => toks[k], next = () => toks[k++];
  const bad = () => { throw new Error('tex'); };
  const isT = (x, t) => x && x.t === t;
  const startsAtom = x => x && (x.t === 'num' || x.t === 'id' || x.t === '(' || x.t === '{' || (x.t === 'cmd' && (x.v === 'pi' || x.v === 'frac' || x.v === 'dfrac' || x.v === 'tfrac' || x.v === 'sqrt' || x.v in TEX_FN)));
  const startsPlainFactor = x => x && (x.t === 'num' || x.t === 'id' || x.t === '{' || (x.t === 'cmd' && (x.v === 'pi' || x.v === 'frac' || x.v === 'dfrac' || x.v === 'tfrac' || x.v === 'sqrt')));
  const group = () => { if (!isT(next(), '{')) bad(); const v = expr(); if (!isT(next(), '}')) bad(); return v; };
  const argument = () => (isT(peek(), '{') ? group() : atomNoFn());
  function atomNoFn() {
    const t = next();
    if (!t) bad();
    if (t.t === 'num') return t.v;
    if (t.t === 'id') { if (Object.hasOwn(vars, t.v)) return vars[t.v]; if (t.v === 'e') return Math.E; return bad(); }
    if (t.t === 'cmd' && t.v === 'pi') return Math.PI;
    bad();
  }
  function atom() {
    const t = peek();
    if (!t) bad();
    if (t.t === 'num') { next(); return t.v; }
    if (t.t === 'id') { next(); if (Object.hasOwn(vars, t.v)) return vars[t.v]; if (t.v === 'e') return Math.E; return bad(); }
    if (t.t === '(') { next(); const v = expr(); if (!isT(next(), ')')) bad(); return v; }
    if (t.t === '{') return group();
    if (t.t === 'cmd') {
      next();
      if (t.v === 'pi') return Math.PI;
      if (t.v === 'frac' || t.v === 'dfrac' || t.v === 'tfrac') { const a = argument(), b = argument(); return a / b; }
      if (t.v === 'sqrt') {
        let n = 2;
        if (isT(peek(), '[')) { next(); n = expr(); if (!isT(next(), ']')) bad(); }
        const v = argument();
        return n === 2 ? Math.sqrt(v) : v ** (1 / n);
      }
      if (t.v in TEX_FN) {
        let pw = 1;
        if (isT(peek(), '^')) { next(); pw = isT(peek(), '{') ? group() : atomNoFn(); }
        if (isT(peek(), '_')) bad();
        let a;
        if (isT(peek(), '(')) { next(); a = expr(); if (!isT(next(), ')')) bad(); }
        else {   // TeX's unbracketed argument: the run of plain factors with their powers; a function only as the first factor
          if (!startsAtom(peek()) || isT(peek(), '(')) bad();
          a = powerFactor();
          while (startsPlainFactor(peek())) a *= powerFactor();
        }
        return TEX_FN[t.v](a) ** pw;
      }
    }
    return bad();
  }
  function powerFactor() {
    const b = atom();
    let v = b;
    if (isT(peek(), '_')) { next(); argument(); }
    if (isT(peek(), '^')) { next(); const e = isT(peek(), '{') ? group() : atomNoFn(); v = b ** e; }
    return v;
  }
  function unary() {
    if (isT(peek(), '-')) { next(); return -unary(); }
    if (isT(peek(), '+')) { next(); return unary(); }
    let v = powerFactor();
    while (isT(peek(), '!')) { next(); let f = 1; for (let q = 2; q <= Math.round(v); q++) f *= q; v = f; }
    return v;
  }
  function term() {
    let v = unary();
    for (;;) {
      const t = peek();
      if (!t) break;
      if (t.t === '*' || (t.t === 'cmd' && (t.v === 'cdot' || t.v === 'times'))) { next(); v *= unary(); }
      else if (t.t === '/' || (t.t === 'cmd' && t.v === 'div')) { next(); v /= unary(); }
      else if (startsAtom(t)) v *= unary();
      else break;
    }
    return v;
  }
  function expr() {
    let v = term();
    for (;;) { const t = peek(); if (isT(t, '+')) { next(); v += term(); } else if (isT(t, '-')) { next(); v -= term(); } else break; }
    return v;
  }
  try { const v = expr(); return k === toks.length && Number.isFinite(v) ? v : null; } catch { return null; }
}
/** The TeX items of his printed answer (one per value): the raw text after the last `=` of each separated piece, or null when it is not that shape. */
export function answerTexItems(ans) {
  const items = [];
  for (const sp of spansOf(ans)) {
    const joined = sp.replace(/\\(?:quad|qquad|,|;|!)/g, ' ').replace(/\\(?:text|mathrm)\{\s*(?:or|and)\s*\}/g, ' ; ');
    let depth = 0, cur = '', pieces = [];
    for (const ch of joined) { if ('({['.includes(ch)) depth++; else if (')}]'.includes(ch)) depth--; if ((ch === ';' || ch === ',') && depth === 0) { pieces.push(cur); cur = ''; } else cur += ch; }
    pieces.push(cur);
    for (const p of pieces.map(x => x.trim()).filter(Boolean)) {
      let d = 0, at = -1;
      for (let i = 0; i < p.length; i++) { const ch = p[i]; if ('({['.includes(ch)) d++; else if (')}]'.includes(ch)) d--; else if (ch === '=' && d === 0 && at < 0) at = i; else if (ch === '=' && d === 0) return null; }
      items.push(at >= 0 ? p.slice(at + 1).trim() : p);
    }
  }
  return items;
}
const SAMPLES = [0.3, 0.7, 1.3, 2.1, 0.45, 1.9];
const closeTo = (a, b) => Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));
/**
 * Does the key (plain text, our engine's reading) equal the value of his own TeX answer, evaluated independently at several points?
 * Returns null when it does, else a code. A numeric key is compared once; an expression or equation at six sample points of each unknown
 * (at least three where his TeX is defined); a set and a point item by item.
 */
export function keyAgreesWithTeX(key, ans) {
  const items = answerTexItems(ans);
  if (!items || !items.length) return 'tex-unreadable';
  const engineAt = (expr, vars) => safe(() => { const v = evaluate(parse(normalize(expr)), vars); return Number.isFinite(v) ? v : null; }, null);
  const vars = ex => [...new Set((ex.match(/(?<![A-Za-z\\])[A-Za-z](?![A-Za-z])/g) || []).filter(c => c !== 'e'))];
  switch (key.answerType) {
    case 'numeric': { const t = items.length === 1 ? evalTeX(items[0]) : null; return t !== null && closeTo(t, key.answer.value) ? null : 'key-disagrees-with-his-tex'; }
    case 'set': {
      const vals = [...new Set(items.map(i => evalTeX(i)))]; if (vals.some(v => v === null) || vals.length !== key.answer.values.length) return 'key-disagrees-with-his-tex';
      return key.answer.values.every(v => vals.some(t => closeTo(t, v))) ? null : 'key-disagrees-with-his-tex';
    }
    case 'point': {
      const m = /^\(\s*(.+)\s*\)$/.exec(items.join(','))?.[1]; if (!m) return 'tex-unreadable';
      const parts = []; let d = 0, cur = ''; for (const ch of m) { if ('({['.includes(ch)) d++; else if (')}]'.includes(ch)) d--; if (ch === ',' && d === 0) { parts.push(cur); cur = ''; } else cur += ch; } parts.push(cur);
      const [x, y] = parts.map(p => evalTeX(p)); return parts.length === 2 && x !== null && y !== null && closeTo(x, key.answer.x) && closeTo(y, key.answer.y) ? null : 'key-disagrees-with-his-tex';
    }
    case 'expression': case 'equation': {
      if (items.length !== 1) return 'key-disagrees-with-his-tex';
      const texItem = items[0], expr = key.answerType === 'expression' ? key.answer.expr : key.answer.rhs;
      const vs = vars(texItem.replace(/\\[A-Za-z]+/g, ' '));
      let used = 0;
      for (let i = 0; i < SAMPLES.length; i++) {
        const env = Object.fromEntries(vs.map((v, j) => [v, SAMPLES[(i + 2 * j) % SAMPLES.length] * (1 + 0.13 * j)]));
        const t = evalTeX(texItem, env);
        if (t === null) continue;
        const e = engineAt(expr, env);
        if (e === null || !closeTo(t, e)) return 'key-disagrees-with-his-tex';
        used++;
      }
      return used >= 3 ? null : 'tex-undefined-at-sample-points';
    }
    default: return 'key-disagrees-with-his-tex';
  }
}

// ── 1. classification ────────────────────────────────────────────────────────
/** The kinds a manual part is, in the order they are tested. `find` is what is left. */
export const MANUAL_KINDS = Object.freeze(['prove', 'explain', 'sketch', 'find']);

/**
 * The kind of a manual part from its prompt's words, outside the maths:
 *   prove    show that, prove, verify, justify, demonstrate      (the result is in the prompt; the answer is an argument)
 *   explain  explain, describe, interpret, comment, why           (a sentence is the answer)
 *   sketch   sketch, graph, draw, plot, shade                     (a picture is the answer)
 *   find     everything else (find, solve, evaluate, state, ...)  (a value is the answer, but his key was not structured)
 */
export function classifyManual(prompt) {
  const t = proseOf(prompt).toLowerCase();
  if (/\b(show|prove|verify|justify|demonstrate|deduce|derive)\b/.test(t)) return 'prove';
  if (/\b(explain|describe|interpret|comment|why|discuss)\b/.test(t)) return 'explain';
  if (/\b(sketch|graph|draw|plot|shade|construct)\b/.test(t)) return 'sketch';
  return 'find';
}

// ── 2. reading his printed answer ────────────────────────────────────────────
const FUNCS_AND_CONSTANTS = /(?<![A-Za-z])(?:sin|cos|tan|sec|cosec|cot|ln|log|exp|sqrt|ncr|npr|arcsin|arccos|arctan|asin|acos|atan|pi|inf)(?![A-Za-z])/g;
/** The single letters a plain reading uses as unknowns (e is the constant). */
const lettersOf = plain => new Set((plain.replace(FUNCS_AND_CONSTANTS, '').match(/[A-Za-zα-ωΑ-Ω]/g) || []).filter(c => c !== 'e'));
const numberOf = plain => {
  const t = String(plain).replace(/π/g, 'pi').replace(/[−–]/g, '-').trim();
  if (!t || !/\d|pi|\be\b/.test(t) || lettersOf(t).size || /[,;]/.test(t)) return null;
  return safe(() => { const v = evaluate(parse(normalize(t)), {}); return Number.isFinite(v) ? v : null; }, null);
};
const near = (a, b) => Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));

/** Splits at top-level commas (not inside brackets). */
function commaItems(s) {
  const out = []; let depth = 0, cur = '';
  for (const ch of s) {
    if ('([{'.includes(ch)) depth++; else if (')]}'.includes(ch)) depth--;
    if (ch === ',' && depth === 0) { out.push(cur); cur = ''; } else cur += ch;
  }
  out.push(cur);
  return out.map(x => x.trim()).filter(Boolean);
}
const RELATION = /(?<![<>!])=(?!=)|<=|>=|<|>|⇒/;
const unwrapOnce = s => { const t = s.trim(); if (!/^\(.*\)$/.test(t)) return t; let d = 0; for (let i = 0; i < t.length; i++) { if (t[i] === '(') d++; else if (t[i] === ')' && --d === 0 && i < t.length - 1) return t; } return t.slice(1, -1).trim(); };

/** `\text{ or }` and `\text{ and }` inside a span are separators; any other \text, units or words make the answer not a bare value. */
function spanPlain(span) {
  const joined = span.replace(/\\(?:quad|qquad|,|;|!)/g, ' ').replace(/\\text\{\s*(?:or|and)\s*\}/g, ' ; ').replace(/\\mathrm\{\s*(?:or|and)\s*\}/g, ' ; ');
  if (/\\(?:text|mathrm|mbox|textbf|operatorname|begin|left\\\{)/.test(joined) && !/\\mathrm\{\s*e\s*\}/.test(joined)) return null;
  const { plain, unread } = plainOf(joined.replace(/\\mathrm\{\s*e\s*\}/g, 'e'));
  return unread.length ? null : plain.replace(/\^\(\s*\)/g, '');
}

/**
 * What his printed answer is, as ONE value, or why it is not:
 *   { kind: 'numeric' | 'expression' | 'equation' | 'set' | 'point', ... } or { no: <code> }.
 * The text must be maths and nothing else (no unit, no word but "or"/"and" between values), must not be approximate, and must be one
 * quantity (a semicolon outside the maths is his sign for two quantities: refused).
 */
export function readPrintedAnswer(ans, prompt) {
  if (typeof ans !== 'string' || !ans.trim()) return { no: 'no-printed-answer' };
  if (/\\approx|\\pm|\\mp|\\ldots|\\dots|[≈±∓]/.test(ans)) return { no: 'approximate-or-plus-minus' };
  const outside = ans.replace(MATH, '\u0001');
  if (/;/.test(outside)) return { no: 'several-quantities' };
  const between = outside.split('\u0001').join(' ').replace(/\b(?:or|and)\b/gi, ' ').replace(/[\s.,]+/g, '');
  if (between) return { no: 'words-with-the-answer' };
  const spans = spansOf(ans);
  if (!spans.length) return { no: 'no-maths' };
  const proseP = proseOf(prompt).toLowerCase();
  const items = [];
  for (const sp of spans) {
    const plain = spanPlain(sp);
    if (plain === null) return { no: 'unreadable-or-has-words' };
    for (const piece of plain.split(';')) if (piece.trim()) items.push(piece.trim());
  }
  const listed = items.length > 1 || (items.length === 1 && commaItems(items[0]).length > 1 && !/^\(.*\)$/.test(items[0].trim()));
  if (!listed) {
    const item = items[0];
    if (/[<>]|<=|>=|!=|\.\.\./.test(item)) return { no: 'inequality-or-range' };
    if (/°|%/.test(item)) return { no: 'unit-in-answer' };
    // A point, only where the question asks for one.
    const pt = /^\(\s*([^,()]+(?:\([^)]*\))?)\s*,\s*([^,()]+(?:\([^)]*\))?)\s*\)$/.exec(item.replace(/^[A-Z]\s*=\s*/, ''));
    if (pt) {
      const x = numberOf(pt[1]), y = numberOf(pt[2]);
      if (x === null || y === null) return { no: 'point-not-closed' };
      if (!/\b(?:point|coordinates|vertex|centre|center|midpoint|intersect\w*|turning|stationary|foot|image|reflection|location|position)\b/.test(proseP)) return { no: 'point-not-asked' };
      return { kind: 'point', x, y, plain: item };
    }
    const rel = item.split(/(?<![<>!])=(?!=)/).map(x => x.trim());
    if (rel.length > 2) return { no: 'chain-of-equalities' };
    if (rel.length === 2) {
      const [lhs, rhs] = rel;
      if (/^[A-Za-z](?:_\w+)?$/.test(lhs)) {
        const v = numberOf(rhs);
        if (v !== null) return { kind: 'numeric', value: v, plain: rhs };
        if (lhs === 'y' && /\bequation\b/.test(proseP) && lettersOf(rhs).size >= 1 && lettersOf(rhs).size <= 2) return { kind: 'equation', lhs: 'y', rhs, plain: item };
        return { no: 'left-side-not-a-bare-value' };
      }
      const prefix = /^(dy\/dx|y'|f'\(x\)|f\(x\)|g\(x\)|y'')$/.exec(lhs.replace(/\s+/g, '').replace(/^\(\(dy\)\/\(dx\)\)$/, 'dy/dx'));
      if (prefix && lettersOf(rhs).size >= 1 && lettersOf(rhs).size <= 2) return { kind: 'expression', expr: rhs, prefix: `${prefix[1]} =`, plain: rhs };
      return { no: 'left-side-not-a-bare-value' };
    }
    const v = numberOf(item);
    if (v !== null) return { kind: 'numeric', value: v, plain: item };
    const letters = lettersOf(item);
    if (letters.size >= 1 && letters.size <= 3 && !RELATION.test(item)) return { kind: 'expression', expr: item, plain: item };
    return { no: 'not-one-value' };
  }
  // A list: a set of values, only where the question asks for several (solve, roots, ...), every item one number (of one unknown).
  if (!/\b(?:solve|solutions?|roots?|zeros?|values|intercepts?|stationary|turning|intersect\w*|find all|which)\b/.test(proseP)) return { no: 'list-not-asked' };
  const flat = items.flatMap(it => commaItems(it));
  const values = []; let unknown = null;
  for (const f of flat) {
    const m = /^([A-Za-z])\s*=\s*(.+)$/.exec(f);
    if (m) { if (unknown && unknown !== m[1]) return { no: 'several-unknowns' }; unknown = m[1]; }
    const v = numberOf(m ? m[2] : f);
    if (v === null) return { no: 'list-item-not-a-number' };
    if (!values.some(u => near(u, v))) values.push(v);
  }
  if (values.length < 2) return { no: 'list-too-short' };
  return { kind: 'set', values, plain: flat.join(', ') };
}

/** The candidate values a worked step states: every maths span's whole, each side of each relation, each list item, parentheses peeled. */
function stepCandidates(stepText) {
  const out = new Set();
  for (const sp of spansOf(stepText)) {
    const { plain, unread } = plainOf(sp.replace(/\\(?:quad|qquad|,|;|!)/g, ' '));
    if (unread.length || !plain) continue;
    for (const part of plain.split(/⇒/)) {
      out.add(part.trim());
      for (const side of part.split(RELATION)) { const s = side.trim(); if (s) { out.add(s); out.add(unwrapOnce(s)); for (const it of commaItems(unwrapOnce(s))) out.add(unwrapOnce(it)); } }
    }
  }
  return [...out].filter(Boolean);
}

/** Is `read` (readPrintedAnswer's value) a result of this step? */
function stepStates(read, stepText) {
  const cands = stepCandidates(stepText);
  switch (read.kind) {
    case 'numeric': return cands.some(c => { const v = numberOf(c); return v !== null && near(v, read.value); });
    case 'expression': return cands.some(c => lettersOf(c).size && safe(() => exprEquivalent(c, read.expr), false) === true);
    case 'equation': {
      for (const sp of spansOf(stepText)) {
        const { plain } = plainOf(sp);
        const sides = plain.split(/(?<![<>!])=(?!=)/).map(x => x.trim());
        for (let i = 0; i + 1 < sides.length; i++) if (sides[i] === 'y' && safe(() => exprEquivalent(sides[i + 1], read.rhs), false) === true) return true;
      }
      return false;
    }
    case 'set': return read.values.every(v => cands.some(c => { const n = numberOf(c); return n !== null && near(n, v); }));
    case 'point': return cands.some(c => { const m = /^\(?\s*([^,()]+)\s*,\s*([^,()]+)\s*\)?$/.exec(c); if (!m) return false; const x = numberOf(m[1]), y = numberOf(m[2]); return x !== null && y !== null && near(x, read.x) && near(y, read.y); });
    default: return false;
  }
}

// The prompt asks for a particular FORM, which an expression key (any equivalent expression is accepted) cannot police.
const ASKS_A_FORM = /\b(?:factori[sz]e\w*|expand\w*|simplif\w*|in the form|complete the square|completing the square|partial fractions?|rationali[sz]e\w*|rational denominator|single (?:fraction|logarithm|power)|fully|as a (?:single|product|sum|fraction)|lowest terms|simplest)\b/i;
// A numeric key is any equal value, so only a form a number can be written in more than one way matters.
const ASKS_A_NUMBER_FORM = /\b(?:simplif\w*|expand\w*|factori[sz]e\w*|rational denominator|rationali[sz]e\w*|simplest|lowest terms|mixed number|as a (?:single|fraction|product)|in the form|surd form)\b/i;
// The prompt mandates a METHOD, which a final-answer key cannot police.
const ASKS_A_METHOD = /\b(?:hence|use|by \w+ing|first principles|use (?:the |a |an )?(?:substitution|identity|product|sum|method|compound|factor|remainder|binomial|formula|integration|induction)|using|by (?:using|completing|substitution|induction|first principles|parts|the)|with \$[a-z]\s*=|let \$[a-z]\s*=|apply)\b/i;
// The prompt names a precision: a decimal key would need a tolerance the author did not give.
const NAMES_A_PRECISION = /\b(?:decimal places?|d\.p\.|significant fig\w*|s\.f\.|nearest|correct to|to \d+ (?:dp|sf)|round\w*)\b/i;
// The prompt asks for more than one thing.
const ASKS_SEVERAL = /\b(?:and (?:hence |then )?(?:find|state|write|determine|calculate|show|sketch|explain|justify)|both|respectively)\b/i;

// The prompt asks for more than a value: a reason, a justification, an explanation, a second thing to state, a "hence show".
const ASKS_MORE_THAN_A_VALUE = /\b(?:reasons?|justif\w*|explain\w*|because|why|whether|comment|briefly|hence|show|prove|verify|state\b[^.?!]*\band\b|give\b[^.?!]*\band\b|write\b[^.?!]*\band\b|and (?:give|state|write|say)|with (?:a|an|the|your) \w*\s*(?:reason|explanation|working|justification))\b/i;

/**
 * The natural ways a student types his printed answer (`shown` is his TeX read with every function bracketed): as read, with redundant brackets
 * taken out, with π for pi, one rearrangement (the terms of a sum in the other order), and a terminating decimal where it is a plain number.
 * Every one is a correct answer by his own printed answer; the importer asks the real marker to agree.
 */
function balancedEnd(s, i) { let d = 0; for (let j = i; j < s.length; j++) { if (s[j] === '(') d++; else if (s[j] === ')' && --d === 0) return j; } return -1; }
const simpleToken = x => /^-?[A-Za-z0-9.]+(?:\^[A-Za-z0-9]+)?$/.test(x) || /^[A-Za-z]+\([^()]*\)$/.test(x);
export function tidyPlain(plain) {
  let s = String(plain);
  // ((A)/(B)) -> A/B, with brackets kept where A or B is not one token; a fraction inside something else keeps its own brackets
  for (let guard = 0; guard < 20; guard++) {
    let changed = false;
    for (let i = 0; i < s.length - 1; i++) {
      if (s[i] !== '(' || s[i + 1] !== '(') continue;
      const close = balancedEnd(s, i); if (close < 0) continue;
      const aEnd = balancedEnd(s, i + 1);
      if (aEnd < 0 || s[aEnd + 1] !== '/' || s[aEnd + 2] !== '(') continue;
      const bEnd = balancedEnd(s, aEnd + 2);
      if (bEnd !== close - 1) continue;
      const A = s.slice(i + 2, aEnd), B = s.slice(aEnd + 3, bEnd);
      const wrap = x => (simpleToken(x) ? x : `(${x})`);
      const whole = i === 0 && close === s.length - 1;
      const rep = `${wrap(A)}/${wrap(B)}`;
      s = s.slice(0, i) + (whole ? rep : `(${rep})`) + s.slice(close + 1);
      changed = true; break;
    }
    if (!changed) break;
  }
  return s.replace(/\^\(([0-9]+|[A-Za-z])\)/g, '^$1');
}
function topTerms(s) {
  const terms = []; let d = 0, cur = '';
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === '(') d++; else if (ch === ')') d--;
    if ((ch === '+' || ch === '-') && d === 0 && cur.trim()) { terms.push(cur.trim()); cur = ch === '-' ? '-' : ''; } else cur += ch;
  }
  if (cur.trim()) terms.push(cur.trim());
  return terms;
}
export function naturalForms(key) {
  const rhs = key.shown ?? '';
  const pi = p => p.replace(/(?<![A-Za-z])pi(?![A-Za-z])/g, 'π');
  const spell = p => [p, tidyPlain(p), pi(tidyPlain(p)), pi(p)];
  const reorder = p => { const t = topTerms(tidyPlain(p)); return t.length >= 2 ? [t.slice().reverse().map((x, i) => (i === 0 || x.startsWith('-') ? x : `+${x}`)).join('')] : []; };
  const one = p => [...spell(p), ...reorder(p)];
  switch (key.answerType) {
    case 'numeric': {
      const out = one(rhs);
      const v = key.answer.value;
      if (!/^-?\d*\.?\d+$/.test(rhs) && /^-?\d+(?:\.\d{1,8})?$/.test(String(v)) && !/[A-Za-z]/.test(rhs.replace(/\bpi\b/g, ''))) out.push(String(v));
      return [...new Set(out)];
    }
    case 'expression': { const f = one(rhs); return [...new Set([...f, ...(key.answerPrefix ? f.slice(0, 2).map(x => `${key.answerPrefix} ${x}`) : [])])]; }
    case 'equation': return [...new Set(one(rhs.replace(/^y\s*=\s*/, '')).flatMap(x => [`y = ${x}`, `y=${x}`]))];
    case 'set': {
      const parts = rhs.split(/,\s*/).map(x => x.trim()).filter(Boolean);
      const bare = parts.map(x => x.replace(/^[A-Za-z]\s*=\s*/, ''));
      const a = bare.map(x => pi(tidyPlain(x)));
      return [...new Set([parts.join(', '), bare.join(', '), a.join(', '), a.slice().reverse().join(', ')])];
    }
    case 'point': { const m = /^\(?\s*(.+?)\s*,\s*(.+?)\s*\)?$/.exec(rhs.replace(/^[A-Z]\s*=\s*/, '')); return m ? [...new Set([`(${m[1]}, ${m[2]})`, `(${tidyPlain(m[1])}, ${tidyPlain(m[2])})`, `${tidyPlain(m[1])}, ${tidyPlain(m[2])}`])] : []; }
    default: return [];
  }
}

/**
 * A structured key for a "find" part, or { no: <code> }. `ans` is his printed answer for THIS part (the question's `ans`, or the part's).
 * The key is returned only when: the prompt is a find (not show/prove/explain/sketch), it asks for ONE value (no reason, no second thing) and no
 * particular form or precision, the printed answer reads fully as one value, that value is a result of his LAST worked step, and the key
 * (function arguments bracketed) equals his own TeX evaluated independently at sample points. The caller still runs the pack checks on it.
 * A numeric key whose own form is not a bare number also carries `alt`: the same value as an exact-form expression, for the numeric box that
 * would refuse his form (e^2+5, 3π²/2: "work it out first"); the caller uses whichever accepts his natural typed forms, else holds the part.
 */
export function deriveKey(part, ans) {
  const prose = proseOf(part.prompt);
  if (classifyManual(part.prompt) !== 'find') return { no: 'not-a-find' };
  if (ASKS_MORE_THAN_A_VALUE.test(prose)) return { no: 'asks-more-than-a-value' };
  if (ASKS_SEVERAL.test(prose)) return { no: 'asks-several-things' };
  if (ASKS_A_METHOD.test(prose) || /(?:with|let|using) \$[a-zA-Z]\s*=/.test(part.prompt)) return { no: 'asks-a-method' };
  if (NAMES_A_PRECISION.test(prose)) return { no: 'names-a-precision' };
  const read = readPrintedAnswer(ans, part.prompt);
  if (read.no) return { no: read.no };
  if ((read.kind === 'expression' || read.kind === 'equation') && ASKS_A_FORM.test(prose)) return { no: 'asks-a-form' };
  if ((read.kind === 'numeric' || read.kind === 'set' || read.kind === 'point') && ASKS_A_NUMBER_FORM.test(prose)) return { no: 'asks-a-form' };
  const steps = Array.isArray(part.steps) ? part.steps : [];
  if (!steps.length) return { no: 'no-steps' };
  if (!stepStates(read, String(steps[steps.length - 1].d ?? ''))) return { no: 'not-the-last-step-result' };
  let key;
  switch (read.kind) {
    case 'numeric': key = { answerType: 'numeric', answer: { value: read.value }, shown: read.plain }; break;
    case 'expression': key = { answerType: 'expression', answer: { expr: read.expr }, ...(read.prefix ? { answerPrefix: read.prefix } : {}), shown: read.plain }; break;
    case 'equation': key = { answerType: 'equation', answer: { lhs: read.lhs, rhs: read.rhs }, shown: read.plain }; break;
    case 'set': key = { answerType: 'set', answer: { values: read.values }, shown: read.plain }; break;
    case 'point': key = { answerType: 'point', answer: { x: read.x, y: read.y }, shown: read.plain }; break;
    default: return { no: 'unknown-kind' };
  }
  const disagree = keyAgreesWithTeX(key, ans);
  if (disagree) return { no: disagree };
  if (key.answerType === 'numeric' && !/^-?\d*\.?\d+$/.test(read.plain)) {
    const alt = { answerType: 'expression', answer: { expr: read.plain }, shown: read.plain };
    if (!keyAgreesWithTeX(alt, ans)) key.alt = alt;
  }
  return key;
}

/** The part as an auto-markable one, with the derived key: the last criterion becomes the answer criterion (its position, not its words). */
export function asDerivedPart(part, key) {
  const criteria = part.criteria.map((c, i, all) => (i === all.length - 1 ? { ...c, answer: true } : { ...c }));
  for (const c of criteria) if (c.answer !== true) delete c.answer;
  return { ...part, answerType: key.answerType, answer: key.answer, criteria, traps: [], ...(key.answerPrefix ? { answerPrefix: key.answerPrefix } : {}), derivedKey: true };
}

/**
 * Plausible WRONG answers to a derived key, as a student would type them: the key's negative, its double, one more, a swap, a dropped
 * or added element. The caller asks the engine to refuse every one; at least two must exist and all must be refused.
 */
export function plausibleWrongs(key) {
  const a = key.answer;
  switch (key.answerType) {
    case 'numeric': return [...new Set([-a.value, a.value * 2, a.value + 1, a.value / 2, a.value - 1].filter(v => Number.isFinite(v) && !near(v, a.value)).map(v => String(+v.toPrecision(12))))];
    case 'expression': return [`-(${a.expr})`, `2*(${a.expr})`, `(${a.expr})+1`, `(${a.expr})*x`];
    case 'equation': return [`${a.lhs} = -(${a.rhs})`, `${a.lhs} = 2*(${a.rhs})`, `${a.lhs} = (${a.rhs})+1`];
    case 'set': return [a.values.slice(1).map(String).join(', '), [...a.values, Math.max(...a.values) + 1].join(', '), a.values.map(v => -v).join(', ')].filter(s => s);
    case 'point': return [`(${a.y}, ${a.x})`, `(${-a.x}, ${a.y})`, `(${a.x}, ${-a.y})`, `(${a.x + 1}, ${a.y})`];
    default: return [];
  }
}

// ── 3. the leak rule for a question that stays a worked solution ─────────────
const fold = t => String(t ?? '').toLowerCase().replace(/\s+/g, '').replace(/\\(?:left|right|displaystyle|quad|qquad|,|;|!)/g, '');
const smallWhole = v => Number.isInteger(v) && Math.abs(v) <= 10;

/**
 * The results of his worked steps: every non-first side of every relation and every closed value in them, minus what the prompt itself says.
 * The LAST step's results are all kept; an earlier step's keep only what is not a bare symbol or a small whole number (a hint may say "set it
 * to 0"), which is what a hint is allowed to name.
 */
export function stepResults(part) {
  const promptFolded = new Set([...spansOf(part.prompt).map(s => fold(plainOf(s).plain)), ...stepCandidates(part.prompt)].map(fold));
  const steps = Array.isArray(part.steps) ? part.steps : [];
  const out = [];
  steps.forEach((s, i) => {
    const last = i === steps.length - 1;
    for (const sp of spansOf(s.d)) {
      const { plain, unread } = plainOf(sp.replace(/\\(?:quad|qquad|,|;|!)/g, ' '));
      if (unread.length || !plain) continue;
      const sides = plain.split(/(?<![<>!])=(?!=)/).map(x => x.trim()).filter(Boolean);
      const results = sides.length > 1 ? sides.slice(1) : (last ? sides : []);
      for (const r0 of results) for (const r of [r0, ...commaItems(unwrapOnce(r0)).map(unwrapOnce)]) {
        const f = fold(r);
        if (!f || promptFolded.has(f)) continue;
        const n = numberOf(r);
        if (!last && ((n !== null && smallWhole(n)) || /^[A-Za-zα-ωΑ-Ω]$/.test(r) || r.length < 3)) continue;
        if (last && /^[A-Za-zα-ωΑ-Ω]$/.test(r)) continue;
        out.push({ plain: r, value: n, last });
      }
    }
  });
  return out;
}

/** Every number, fraction and function-of-a-number in a text (maths spans read as plain, prose as written), with its value. */
function numberValuesIn(text) {
  const parts = [...spansOf(text).map(sp => plainOf(sp.replace(/\\(?:quad|qquad|,|;|!)/g, ' ')).plain), proseOf(text)];
  const out = [];
  for (const part of parts) {
    let rest = String(part);
    for (const m of rest.matchAll(/(?<![A-Za-z])(?:ln|log|sqrt|sin|cos|tan|exp)\s*\(?\s*-?\d+(?:\.\d+)?\s*\)?/g)) { const v = numberOf(m[0].replace(/^([a-z]+)\s*\(?\s*(-?[\d.]+)\s*\)?$/, '$1($2)')); if (v !== null) out.push({ text: m[0].trim(), value: v }); }
    rest = rest.replace(/(?<![A-Za-z])(?:ln|log|sqrt|sin|cos|tan|exp)\s*\(?\s*-?\d+(?:\.\d+)?\s*\)?/g, ' ');
    for (const m of rest.matchAll(/\d+(?:\.\d+)?\s*\/\s*\d+(?:\.\d+)?|\d+(?:\.\d+)?/g)) { const v = numberOf(m[0]); if (v !== null) out.push({ text: m[0].trim(), value: v }); }
  }
  return out;
}

/** Why this hint states a result of the worked steps, or null. */
export function stepResultLeak(part, hint, results = stepResults(part)) {
  const t = String(hint ?? '');
  const sides = [];
  for (const sp of spansOf(t)) {
    const { plain, unread } = plainOf(sp);
    if (unread.length) { if (/\d/.test(plain)) return 'unread TeX in a hint span (fail closed)'; continue; }
    for (const side of plain.split(RELATION)) { const s = side.trim(); if (s) { sides.push(s); sides.push(unwrapOnce(s)); for (const it of commaItems(unwrapOnce(s))) sides.push(unwrapOnce(it)); } }
  }
  // Prose maths ("56/8", "x = 3") is read as well: the words around it are dropped.
  for (const m of proseOf(t).matchAll(/[A-Za-z0-9().^*/+\-\s]*[0-9][A-Za-z0-9().^*/+\-\s]*(?:=[A-Za-z0-9().^*/+\-\s]+)?/g)) for (const side of m[0].split('=')) { const s = side.trim(); if (/\d/.test(s) && s.length >= 2) sides.push(s); }
  // What the question itself says is not a result, even when it equals one (the target of a show-that is in the prompt).
  const stated = new Set(stepCandidates(part.prompt).map(fold));
  // Every number (and a function of a number: ln 0.4, sqrt(7), 56/8) the hint states, wherever it is written, against every result of the worked
  // steps that the prompt does not itself give: "n = 300 or 360" and "take ln 0.4" state set-up values the student is to find.
  const given = numberValuesIn(part.prompt);
  for (const tok of numberValuesIn(t)) {
    if (given.some(g => near(Math.abs(g), Math.abs(tok.value)))) continue;
    for (const r of results) if (r.value !== null && near(Math.abs(tok.value), Math.abs(r.value)) && (r.last || !smallWhole(r.value))) return `it states ${tok.text.slice(0, 30)}, a result of the worked steps that the question does not give`;
  }
  for (const s of sides) {
    if (stated.has(fold(s))) continue;
    const sv = numberOf(s);
    for (const r of results) {
      if (fold(s) === fold(r.plain) && fold(s).length >= 2) return `it states "${r.plain.slice(0, 30)}", a result of the worked steps`;
      if (sv !== null && r.value !== null && near(sv, r.value) && (r.last || !smallWhole(r.value))) return `it states ${+sv.toFixed(6)}, a result of the worked steps`;
      if (sv === null && r.value === null && lettersOf(s).size && lettersOf(r.plain).size && s.length >= 3 && safe(() => exprEquivalent(s, r.plain), false) === true) return `it states "${s.slice(0, 30)}", a result of the worked steps`;
    }
  }
  return null;
}
