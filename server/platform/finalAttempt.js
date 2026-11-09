// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · which working lines are final-answer attempts
//
// "Check this line so far" (server/platform/tutor.js) judges a student's
// working against the escrowed solution while the question is still OPEN. A
// line that could be the final answer must never be judged there: if a right
// final line read "matches" and a wrong one read "break", the route would be a
// guess oracle for the answer that Check alone may mark.
//
// The decision is made by the deterministic engine's parsers, by FORM, and
// never by value. No function here compares a line's value with the answer's:
// the answer is read only for its shape (equation, inequality or bare
// expression), its free symbols and which letters it solves for. So a right
// and a wrong final line are classified identically, and so get identical
// replies.
//
// A line is a final-answer attempt when ANY of these hold:
//
//   1. FORM — it has the escrowed final answer's relation shape with exactly
//      the same free symbols ("y = 3x - 4" against "y = 2x + 1"; "0 = t - 11"
//      against "t = 11"; "t = 11 + t - t" too, since symbols are read from
//      what was written, not simplified);
//   2. PIN — it sets an asked unknown on its own against a side free of every
//      asked unknown ("t = 1.1e1", "11 = t"), or it is a bare expression free
//      of the asked unknowns where the answer pins one (a lone "11");
//   3. CONSTANT — the answer is a bare constant once its units are stripped
//      ("462 cm²") and the line states a constant or relates only ONE letter
//      ("A = 462", "n*n = 19*n").
//
// No Step Check verdict or stage is consulted (it once was: a plan's checker
// tagged a WRONG final value with the last stage and left a right one
// untagged, so "A = 462" was judged while "A = 461" was not).
//
// FAIL CLOSED: a line (or the answer) the engine cannot read is an attempt.
// Pure: plain data in, plain data out; it runs in the marker pool.
// ─────────────────────────────────────────────────────────────────────────────
import { evaluate, parse, normalize, variablesOf } from '../../client/src/engine/expr.js';
import { parseRelation } from '../../client/src/engine/reason-v2.js';
import { WORKING_LIMITS } from '../../client/src/engine/checker.js';

const INEQUALITY = new Set(['<', '>', '<=', '>=']);

function clean(text) {
  return String(text ?? '')
    .replace(/\$/g, '')
    .replace(/[−–—]/g, '-')
    .trim()
    .replace(/^∴\s*/, '')
    .replace(/^(so|hence|then|therefore)\s+/i, '')
    .trim();
}

/** Top-level parts of a line or answer: "x = 2, y = 3" → two claims. Commas inside brackets stay. */
function parts(text) {
  const out = [];
  let depth = 0;
  let cur = '';
  for (const ch of String(text)) {
    if ('([{'.includes(ch)) depth += 1;
    else if (')]}'.includes(ch)) depth = Math.max(0, depth - 1);
    if (depth === 0 && (ch === ',' || ch === ';')) { out.push(cur); cur = ''; continue; }
    cur += ch;
  }
  out.push(cur);
  return out.flatMap(p => p.split(/\s+and\s+/i)).map(p => p.trim()).filter(Boolean);
}

const vars = node => [...variablesOf(node)];
const lone = node => {
  let n = node;
  while (n && n.t === 'group') n = n.v;
  return n && n.t === 'var' ? n.v : null;
};

/**
 * One claim read by the engine: { shape, symbols, sides } or null when it
 * cannot be read. `shape` is "eq", "ineq" or "expr"; `sides` the two sides of
 * a relation (absent for an expression).
 */
export function readClaimForm(text) {
  const src = clean(text);
  if (!src || src.length > WORKING_LIMITS.lineChars) return null;
  try {
    const rel = parseRelation(src);
    if (rel && INEQUALITY.has(rel.op)) return { shape: 'ineq', symbols: new Set([...vars(rel.l), ...vars(rel.r)]), sides: [rel.l, rel.r] };
    const ast = parse(normalize(src));
    if (ast.t === 'equation') return { shape: 'eq', symbols: new Set(vars(ast)), sides: [ast.l, ast.r] };
    return { shape: 'expr', symbols: new Set(vars(ast)) };
  } catch { return null; }
}

// Units a school answer may carry after its number. Stripped only when they
// FOLLOW a number, so a variable named m or g elsewhere is never touched.
// A unit may be spelled out ("square units", "sq. units", "cubic units",
// "square metres", "sq. cm", "cubic centimetres", "units") or abbreviated.
// The longer words are tried before their prefixes ("metres" before "m").
const UNIT = String.raw`(?:(?:square|sq\.?|cubic|cu\.?)\s*)?(?:(?:centi|milli|kilo)?(?:metres?|meters?)|(?:kilo|milli)?grams?|(?:milli)?litres?|(?:milli)?liters?|seconds?|minutes?|hours?|hrs?|days?|weeks?|months?|years?|units?|rupees?|paise|degrees?|deg|cm|mm|km|kg|mg|ml|sec|min|rs\.?|m|g|l|s|h|°|%)(?:\s*\^?\s*[23]|[²³])?`;
// The number must stand on its own — at the start, or after "=" or a space —
// so "r^2 h" (an exponent, then a variable) is never read as "2 hours".
const TRAILING_UNITS = new RegExp(String.raw`((?:^|[=\s])[-−]?\d[\d.,]*)\s*(?:${UNIT})(?:\s*(?:\/|per)\s*(?:${UNIT}))?\s*\.?\s*$`, 'i');
const LEADING_CURRENCY = /^[\s]*(?:₹|rs\.?|\$)\s*/i;

/** The text with a currency sign before, and units after, its number removed. */
export function stripUnits(text) {
  return clean(text).replace(LEADING_CURRENCY, '').replace(/=\s*(?:₹|rs\.?)\s*/i, '= ').replace(TRAILING_UNITS, '$1').trim();
}

// A numeric expression: digits, a decimal point or separator, operators,
// brackets, roots and π — and nothing that names anything.
const NUMERIC_ONLY = /^[-−+]?[\d.,\s()+\-−*×·/÷^√π²³]*\d[\d.,\s()+\-−*×·/÷^√π²³]*$/u;
// Where a line says "this is the value": a relation sign, a colon, or the
// words that do the same job in English and Hindi.
const SAYS_VALUE = /\s*(?:<=|>=|!=|=|<|>|≤|≥|≠|≈|:|\bis\b|\bequals\b|\bequal to\b|\bare\b|\bwas\b|\bgives\b|\bcomes to\b|है|हैं|बराबर)\s*/iu;

/**
 * With a CONSTANT answer, does this line state a constant — whatever labels
 * it? FORM ONLY, never the value:
 *   · any segment between relation signs, colons or "is"-words that is, after
 *     units are stripped, a bare numeric expression ("area = 462",
 *     "the area is 462", "ans: 462", "Total volume = 462 sq units",
 *     "क्षेत्रफल = 462", "A_1 = 462", "f(r) = 462");
 *   · a line that is only words and one number ("उत्तर 462 है", "462 square units").
 * A side that relates letters ("A = l b") holds no bare number and is not caught.
 */
export function statesAConstant(line) {
  const text = clean(line).replace(/[०-९]/g, d => String(d.charCodeAt(0) - 0x0966));
  if (!/[\d०-९]/.test(text)) return false;
  // Units the stripper does not know (any script: "वर्ग सेमी") are words AFTER
  // the number; they are dropped too. This only ever widens what counts as an
  // attempt — the safe direction.
  const segments = text.split(SAYS_VALUE)
    .map(s => stripUnits(s).replace(/(\d)(?:\s+[\p{L}\p{M}][\p{L}\p{M}.²³^\d]*)+\s*$/u, '$1').trim())
    .filter(Boolean);
  if (segments.some(s => NUMERIC_ONLY.test(s))) return true;
  // Words and one number: drop every word (any script) and see what is left.
  const bare = stripUnits(text.replace(/[\p{L}\p{M}][\p{L}\p{M}.'’_]*/gu, ' ')).replace(/[\s:,.;!?"'“”‘’()-]+$/u, '').trim();
  return NUMERIC_ONLY.test(bare) && !/[=<>≤≥]/.test(text);
}

/** Is the escrowed answer a bare constant once its units are stripped? */
export function isConstantAnswer(answerText) {
  const parts_ = parts(stripUnits(answerText));
  if (parts_.length !== 1) return false;
  const c = readClaimForm(parts_[0]);
  return !!c && c.shape === 'expr' && c.symbols.size === 0;
}

const sameSet = (a, b) => a.size === b.size && [...a].every(v => b.has(v));

/**
 * The escrowed final answer's FORM, never its value: the forms of its claims
 * and the letters it solves for. `null` when it cannot be read (every line is
 * then an attempt). `answerText` is the escrow's display answer, `variable`
 * the Step Check's asked unknown when it has one, `prefix` the answer prefix.
 */
export function answerForm({ answerText = '', variable = null, prefix = '' } = {}) {
  const unknowns = new Set();
  if (typeof variable === 'string' && variable) unknowns.add(variable);
  const pre = String(prefix || '').match(/^\s*([A-Za-z])\s*=\s*$/);
  if (pre) unknowns.add(pre[1]);
  // A bare constant answer, units stripped ("36036 cm³", "₹ 450", "12.5 %"):
  // every line that pins ONE symbol to a constant — or is a constant — is an
  // attempt, whatever the symbol is called (V, V_1, A, x) and whatever the
  // value. Without this a unit made the answer unreadable as a claim, and the
  // Step Check's own placement of a RIGHT value decided the reply (L2 repro).
  if (isConstantAnswer(answerText)) return { constant: true, forms: [], unknowns, valueSymbols: [] };
  const claims = parts(clean(answerText)).map(readClaimForm);
  if (!claims.length || claims.some(c => !c)) return null;
  for (const c of claims) {
    if (c.shape === 'expr') continue;
    for (const [side, other] of [c.sides, [...c.sides].reverse()]) {
      const v = lone(side);
      if (v && !vars(other).includes(v)) unknowns.add(v);
    }
  }
  const forms = [];
  for (const c of claims) {
    forms.push({ shape: c.shape, symbols: c.symbols });
    // A bare value under an asked unknown ("11" for "t =") is the claim "t = 11".
    if (c.shape === 'expr') for (const u of unknowns) forms.push({ shape: 'eq', symbols: new Set([...c.symbols, u]) });
  }
  const valueSymbols = answerValueSymbols(answerText, unknowns);
  if (!valueSymbols) return null;
  return { forms, unknowns, valueSymbols };
}

function readTree(text) {
  try { return parse(normalize(clean(text))); } catch { return null; }
}

// ── Value-side form (review of #780) ─────────────────────────────────────────
// A side's EFFECTIVE symbols: the letters its value actually depends on, read
// case-insensitively, with cancelling terms ("z - z") simplified away by
// probing the engine's evaluator at fixed points. Never compares a value with
// the answer's — only which letters a side depends on. Unreadable → null.
const PROBES = [[0.37, 1.91], [1.53, -0.71], [-1.29, 2.47]];
export function effectiveSymbols(node) {
  const names = vars(node);
  const env = (shift = null) => Object.fromEntries(names.map((n, i) => [n, PROBES[i % 3][0] + i * 0.113 + (shift === n ? 0.731 : 0)]));
  try {
    const base = evaluate(node, env());
    if (!Number.isFinite(base)) return null;
    const out = new Set();
    for (const n of names) {
      const moved = evaluate(node, env(n));
      if (!Number.isFinite(moved)) return null;
      if (Math.abs(moved - base) > 1e-9 * Math.max(1, Math.abs(base))) out.add(n.toLowerCase());
    }
    return out;
  } catch { return null; }
}

/**
 * The answer's VALUE sides: for an equation or inequality, every side that is
 * not a lone asked unknown; for a bare expression, the expression. Their
 * effective symbol sets, case-folded. null when any cannot be read.
 */
function answerValueSymbols(answerText, unknowns) {
  const out = [];
  for (const p of parts(clean(answerText))) {
    const src = clean(p);
    let rel = null;
    let ast;
    try { rel = parseRelation(src); ast = rel && INEQUALITY.has(rel.op) ? null : parse(normalize(src)); } catch { return null; }
    const sides = rel && INEQUALITY.has(rel.op) ? [rel.l, rel.r] : ast?.t === 'equation' ? [ast.l, ast.r] : [ast];
    const value = sides.length === 1 ? sides : sides.filter(s => !(lone(s) && unknowns.has(lone(s))));
    for (const s of (value.length ? value : sides)) {
      const eff = effectiveSymbols(s);
      if (!eff) return null;
      out.push(eff);
    }
  }
  // A purely numeric value side ("11") is left to the PIN rule: matching it here
  // would also stop every arithmetic working line ("7 + 4 = 11") from being judged.
  return out.filter(s => s.size > 0);
}

/** Is this one claim a final-answer attempt, by form alone? Unreadable → yes. */
function claimIsAttempt(text, form) {
  const c = readClaimForm(stripUnits(text));
  if (!c) return true;
  if (form.constant) {
    // Decided by which letters each side carries, never by the value.
    if (c.shape === 'expr') return c.symbols.size === 0;
    // STRUCTURAL: any equation or inequality whose free symbols are all one
    // letter (case-folded) determines that letter — "V = 36036", "n*n = 19*n",
    // "2n + 3 > 7" — so it is an attempt whatever its form.
    return new Set([...c.symbols].map(s => String(s).toLowerCase())).size <= 1;
  }
  // VALUE SIDE: any side of the line (or the line itself) that depends on
  // exactly the letters the answer's value side depends on — case-folded,
  // cancelling terms removed — is the answer's expression in another dress:
  // "Y = 2x+1", "y+z-z = 2x+1", "f(x) = 2x+1", "(x+1)^2 = x^2+2x+1".
  if (form.valueSymbols) {
    const sides = c.sides || [readTree(text)];
    for (const s of sides) {
      if (!s) return true;
      const eff = effectiveSymbols(s);
      if (!eff) return true;
      if (form.valueSymbols.some(v => sameSet(v, eff))) return true;
    }
  }
  if (form.forms.some(f => f.shape === c.shape && sameSet(f.symbols, c.symbols))) return true;
  if (!form.unknowns.size) return false;
  const freeOfUnknowns = node => !vars(node).some(v => form.unknowns.has(v));
  if (c.shape === 'expr') return [...c.symbols].every(v => !form.unknowns.has(v));
  return [c.sides, [...c.sides].reverse()].some(([side, other]) => form.unknowns.has(lone(side)) && freeOfUnknowns(other));
}

/**
 * Index of the first final-answer attempt in `lines`, or -1. Decided from the
 * lines' shape and symbols and the answer's form, without any value.
 */
export function firstFinalAttempt(lines, form) {
  // Shape and symbols only. No Step Check verdict or stage may enter here: a
  // checker tags a line differently when it is right and when it is wrong, so
  // anything it says would make this decision depend on the value.
  if (!Array.isArray(lines)) return 0;
  for (let i = 0; i < lines.length; i += 1) {
    if (!form) return i;
    if (form.constant && statesAConstant(lines[i])) return i;
    const claims = parts(clean(lines[i]));
    if (!claims.length || claims.some(p => claimIsAttempt(p, form))) return i;
  }
  return -1;
}
