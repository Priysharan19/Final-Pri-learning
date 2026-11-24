// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · a false symbolic continuation, and the facts a teacher's comment on it needs
//
// FEEDBACK ONLY (no mark, no `correct`, no method mark reads it). engine/lineChains.js finds a continuation `= expr` that is provably NOT
// equal to the line above (a slip warning). Here the question decides whether that warning may become a CROSS, and what the cross says.
//
//   · contextAllowsCross(prompt): the question asks for a rewrite (differentiate, expand, simplify, factorise) and defines no context in which
//     two different-looking lines could both be right: no substitution of a given value ("when x = 2", "at x = 1"), no equation to solve
//     (both sides change), no approximation, no integral (a constant of integration), no inequality or domain condition ("for x > 0").
//   · pageBlocksCross(lines, vars): the page itself changes context: a value put in for the letter, a letter redefined (change of variable),
//     an approximation sign, "+ C", a definite-integral bracket, a line that names a condition.
//   · readingIsAmbiguous(text): a notation that reads two ways (`e^2x`, `sin 2x`, `1/2x`, `x^-1/2`) is never crossed.
//   · polyOf: a single-letter polynomial read EXACTLY (BigInt fractions). Where both lines are polynomials the difference is exact, and the
//     terms that differ, and the line above in its simplest form (expanded, descending powers), are named from that. Anything else keeps the
//     numeric facts of the slip warning and says nothing more than it computed.
//
// Pure, deterministic, no I/O.
// ─────────────────────────────────────────────────────────────────────────────
import { parse, normalize } from './expr.js';
import { cleanStatement } from './arithmeticLines.js';
import { literalFraction } from './exact.js';
import { texToPlain } from './texToPlain.js';
import { explainWide, closedValue, WIDE_ERROR_TYPES } from './wideFalseStep.js';

const tidy = s => String(s ?? '').replace(/[−–—]/g, '-').replace(/[′’`]/g, "'").replace(/[×·]/g, '*').replace(/÷/g, '/').trim();

// ── the question ───────────────────────────────────────────────────────────────────────────────────────────────────────
const TASK = /\b(?:differentiat\w*|derivative|gradient function|dy\s*\/\s*dx|expand\w*|simplif\w*|factoris\w*|factoriz\w*|product rule|quotient rule|chain rule)\b/i;
const CONTEXT = [
  /\b(?:when|at|if|where|given|for|whenever|substitut\w*|evaluat\w*|approximat\w*|estimat\w*|nearest|decimal|significant|sig\.?\s*fig\w*)\b/i,
  /\b(?:solv\w*|solution|roots?|zeros?|intercepts?|equations?|inequalit\w*|simultaneous|satisf\w*|prove|show that|verif\w*|identity|identities|tangent|normal|stationary|turning|maxim\w*|minim\w*|optimi\w*)\b/i,
  /\b(?:integra\w*|antiderivative|primitive|limits?|lim|series|sum|sequence|domain|range|exact value|numerically)\b/i,
  /\b(?:complex|imagin\w*|modulus|argument|vectors?|matri(?:x|ces)|sets?|union|intersect\w*|subscript\w*|polar|conjugate|surds?|radicals?)\b|[±∪∩∈]|\\pm|\\mathbb|\\cup|\\cap|\\in\b|\\vec|\\begin/i,
  /[<>≤≥≈∫]|\\int|\\approx|\\le(?![a-z])|\\ge(?![a-z])|\\leq|\\geq|\\lim|\\sum/
];
/** One question, one target: a part label, a second part, a second expression to work on, or a second paragraph is a different question. */
export function isMultiPart(prompt, light = false) {
  const raw = String(prompt ?? '');
  if (/\n\s*\S/.test(raw.trim())) return true;
  if (/(?:^|[\s(])\(?[a-hi]{1,3}\)|\(\s*(?:i{1,3}|iv|v)\s*\)|\bpart\b|\bparts\b|\bhence\b|\bthen\b[^.]*\b(?:find|simplify|expand|differentiate)\b|\b(?:first|second|also|and then|next)\b/i.test(raw.replace(/\$[^$]*\$/g, ' $ '))) return true;
  if (light) return false;   // a closed-number page: several expressions in ONE question is not several parts
  // more than one expression to work on: two or more TeX spans that are not a bare letter or number
  const spans = [...raw.matchAll(/\$+([^$]+)\$+/g)].map(m => m[1].trim()).filter(t => !/^[A-Za-z]$/.test(t) && !/^-?\d+(?:\.\d+)?$/.test(t));
  if (spans.length > 1) return true;
  // more than one sentence that asks for work
  const asks = raw.replace(/\$[^$]*\$/g, ' $ ').split(/[.?!]/).filter(x => TASK.test(x) || /\b(?:find|show|write|solve|calculate|state)\b/i.test(x));
  return asks.length > 1;
}
/** The letter is a real variable of THIS question: the prompt itself uses it, and it is never i, j or e. */
export function isRealVariable(prompt, v) {
  if (typeof v !== 'string' || !/^[a-df-hk-z]$/.test(v)) return false;   // not i, j, e
  const p = String(prompt ?? '').replace(/\\[A-Za-z]+/g, ' ');
  return new RegExp(`(?<![A-Za-z])${v}(?![A-Za-z])`).test(p);
}
/** The question asks for a rewrite and defines no context that could make two different-looking lines both right. */
export function contextAllowsCross(prompt) {
  const p = String(prompt ?? '').replace(/\$+/g, ' ');
  if (!p.trim() || p.length > 1500) return false;
  return TASK.test(p) && !CONTEXT.some(re => re.test(p)) && !isMultiPart(prompt);
}

/**
 * A page of closed numbers (no letter): a chain `= 12 + 10`, `= 22` is a rewrite whatever the question says about its context. Not when the
 * question rounds or approximates, asks to prove or solve, has several parts, or works in sets, vectors, complex numbers or integrals.
 */
export function contextAllowsNumericCross(prompt) {
  const p = String(prompt ?? '').replace(/\$+/g, ' ');
  if (!p.trim() || p.length > 1500 || isMultiPart(prompt, true)) return false;
  return !/\b(?:approximat\w*|estimat\w*|nearest|decimal|significant|sig\.?\s*fig\w*|round\w*|correct to|solv\w*|equations?|inequalit\w*|prove|show that|verif\w*|integra\w*|limits?|series|sum|sequence|complex|imagin\w*|vectors?|matri(?:x|ces)|sets?|union|intersect\w*|polar|conjugate|percent\w*|interest|currency|\bcost\b|\bpay\w*)\b|[±∪∩∈≈∫<>≤≥%]|\\pm|\\approx|\\int|\\le(?![a-z])|\\ge(?![a-z])|\\begin|\\vec|\\sum|\\lim/i.test(p);
}

// ── the page ───────────────────────────────────────────────────────────────────────────────────────────────────────────
/** True when something on the page changes the context for the letters in play: the page is not a plain chain of rewrites. */
export function pageBlocksCross(lines, vars) {
  const set = new Set(vars || []);
  for (const raw of lines || []) {
    const t = tidy(raw);
    if (/[≈≃~<>≤≥∫⇒→±∪∩|_\[\]{}]|=>|\\int|\\approx/.test(t)) return true;
    if (/^\(?[a-hi]{1,3}\)|^part\b|^q(?:uestion)?\s*\d|^\d+\s*[.)]\s|^\(\s*(?:i{1,3}|iv|v)\s*\)/i.test(t)) return true;   // a part label: another question follows
    if (/\+\s*c\b/i.test(t) || /\]\s*_/.test(t) || /\b(?:when|at|if|sub\w*|approx\w*|solve|since|where|given that|for)\b/i.test(t.replace(/^(?:let|then)\b/i, ''))) return true;
    if (/:/.test(t)) return true;                                   // `t = 4: ...` a substitution label, `Check:` and the like
    // a value put in for a letter of the chain (`x = 2`), or the letter redefined (`let x = t + 1`): the lines below are not rewrites of the lines above
    for (const v of set) {
      if (new RegExp(`(?:^|[\\s,;(])${v}\\s*=\\s*-?\\s*\\d`).test(t)) return true;
      if (new RegExp(`\\b(?:let|put|set|take|substitute)\\s+${v}\\s*=`, 'i').test(t)) return true;
    }
    // an equation whose two sides both carry a letter of the chain and which is not a continuation: a line that is being solved
    const parts = t.split('=');
    if (parts.length === 2 && parts[0].trim() && parts[1].trim()) {
      const has = s => [...set].some(v => new RegExp(`(?<![A-Za-z])${v}(?![A-Za-z])`).test(s));
      const labelLike = /^(?:[A-Za-z](?:'{0,2})|d[a-z]\s*\/\s*d[a-z]|[A-Za-z]'{0,2}\(\s*[a-z]\s*\))$/.test(parts[0].trim().replace(/\s+/g, ''));
      if (has(parts[0]) && has(parts[1]) && !labelLike) return true;
    }
  }
  return false;
}

/** A notation that reads two ways: crossed under neither (the topic checker's every-reading rule). */
export function readingIsAmbiguous(text) {
  const t = tidy(text);
  return /\^\s*-?\s*\d+(?:\.\d+)?\s*[a-z(]/i.test(t)                                   // e^2x, x^2y
    || /\^\s*-?\s*\d+(?:\.\d+)?\s*\/\s*[\d(a-z]/i.test(t)                              // x^-1/2
    || /(?<![A-Za-z])(?:sin|cos|tan|sec|cosec|csc|cot|ln|log|arcsin|arccos|arctan|sinh|cosh|tanh)\s*(?:\^\s*-?\d+\s*)?[-+]?\s*[\da-z]/i.test(t)   // sin 2x, cos x
    || /\/\s*(?:\d+(?:\.\d+)?(?![\d.])|[a-z])\s*(?:[a-z(]|\d)/i.test(t)                          // 1/2x, x/2y
    || /\d\s+\d/.test(t);                                                               // two numbers run together
}

// ── exact polynomials in one letter ────────────────────────────────────────────────────────────────────────────────────
const gcd = (a, b) => { a = a < 0n ? -a : a; b = b < 0n ? -b : b; while (b) [a, b] = [b, a % b]; return a || 1n; };
const frac = (n, d = 1n) => { if (d < 0n) { n = -n; d = -d; } const g = gcd(n, d); return { n: n / g, d: d / g }; };
const fAdd = (a, b) => frac(a.n * b.d + b.n * a.d, a.d * b.d);
const fMul = (a, b) => frac(a.n * b.n, a.d * b.d);
const fIsZero = a => a.n === 0n;
const fEq = (a, b) => a.n === b.n && a.d === b.d;
const MAX_DEGREE = 12, MAX_TERMS = 40, MAX_POW = 8;

/** A polynomial as Map(degree → exact coefficient) in the letter `st.v`, or null when the tree is anything else. */
function polyOf(node, st) {
  if (!node || typeof node !== 'object') return null;
  const clean = m => { for (const [k, c] of m) if (fIsZero(c)) m.delete(k); return m; };
  const add = (a, b, s = 1n) => { const o = new Map(a); for (const [k, c] of b) o.set(k, fAdd(o.get(k) || frac(0n), fMul(c, frac(s)))); return clean(o); };
  const mul = (a, b) => {
    const o = new Map();
    for (const [i, x] of a) for (const [j, y] of b) { if (i + j > MAX_DEGREE) return null; o.set(i + j, fAdd(o.get(i + j) || frac(0n), fMul(x, y))); }
    return clean(o);
  };
  switch (node.t) {
    case 'num': { const f = literalFraction(String(node.s ?? node.v)); return f ? new Map(fIsZero(frac(f.n, f.d)) ? [] : [[0, frac(f.n, f.d)]]) : null; }
    case 'var': if (st.v === null) st.v = node.v; return st.v === node.v ? new Map([[1, frac(1n)]]) : null;
    case 'group': return polyOf(node.v, st);
    case 'neg': { const a = polyOf(node.v, st); return a ? add(new Map(), a, -1n) : null; }
    case 'bin': {
      const l = polyOf(node.l, st); if (!l) return null;
      if (node.op === '^') {
        let ex = node.r; while (ex && ex.t === 'group') ex = ex.v;
        const e = ex && ex.t === 'num' ? Number(ex.v) : NaN;
        if (!Number.isInteger(e) || e < 0 || e > MAX_POW) return null;
        let acc = new Map([[0, frac(1n)]]);
        for (let k = 0; k < e && acc; k++) acc = mul(acc, l);
        return acc;
      }
      const r = polyOf(node.r, st); if (!r) return null;
      if (node.op === '+') return add(l, r);
      if (node.op === '-') return add(l, r, -1n);
      if (node.op === '*') return mul(l, r);
      if (node.op === '/') {
        if (r.size !== 1 || !r.has(0)) return null;
        const c = r.get(0); const inv = frac(c.d, c.n);
        return mul(l, new Map([[0, inv]]));
      }
      return null;
    }
    default: return null;
  }
}
const astOf = text => { try { return parse(normalize(cleanStatement(tidy(text)))); } catch { return null; } };
/** { v, c } for a side that is a polynomial in one letter (a constant has v null), or null. */
export function readPoly(text) {
  try {
    const ast = astOf(text); if (!ast) return null;
    const st = { v: null };
    const c = polyOf(ast, st);
    if (!c || c.size > MAX_TERMS) return null;
    return { v: st.v, c };
  } catch { return null; }
}

// ── writing a polynomial ───────────────────────────────────────────────────────────────────────────────────────────────
const absF = a => ({ n: a.n < 0n ? -a.n : a.n, d: a.d });
function coeffTex(a) { return a.d === 1n ? String(a.n) : `\\frac{${a.n}}{${a.d}}`; }
function coeffPlain(a) { return a.d === 1n ? String(a.n) : `(${a.n}/${a.d})`; }
function powerText(v, deg, tex) { return deg === 0 ? '' : deg === 1 ? v : tex && deg > 9 ? `${v}^{${deg}}` : `${v}^${deg}`; }
/** One term, signed (`-2x`, `3x^2`, `5`); `tex` for TeX. */
function termText(v, deg, c, tex) {
  const mag = absF(c), body = powerText(v, deg, tex);
  const k = deg !== 0 && mag.n === 1n && mag.d === 1n ? '' : (tex ? coeffTex(mag) : coeffPlain(mag));
  return `${c.n < 0n ? '-' : ''}${k}${body}`;
}
/** The polynomial, expanded, descending powers: `3x^2 - 2x`. */
function polyText(p, tex) {
  if (!p.c.size) return '0';
  const degs = [...p.c.keys()].sort((a, b) => b - a);
  return degs.map((d, i) => { const t = termText(p.v, d, p.c.get(d), tex); return i === 0 ? t : (t.startsWith('-') ? ` - ${t.slice(1)}` : ` + ${t}`); }).join('');
}

/**
 * The facts of a false continuation, from the two sides as the student wrote them. Everything is computed; nothing is guessed.
 *   {} when either side is not a polynomial in one letter (the caller keeps the numeric example)
 *   { aboveTex, writtenTex, aboveText, writtenText, correctedText, correctedTex, changed: [{ fromTex, toTex }], same: [tex] }
 */
export function falseStepFacts(aboveSide, writtenSide) {
  const a = readPoly(aboveSide), b = readPoly(writtenSide);
  if (!a || !b || (a.v && b.v && a.v !== b.v)) return null;
  const v = a.v || b.v || 'x';
  const A = { v, c: a.c }, B = { v, c: b.c };
  const degs = [...new Set([...A.c.keys(), ...B.c.keys()])].sort((x, y) => y - x);
  const changed = [], same = [];
  for (const d of degs) {
    const x = A.c.get(d), y = B.c.get(d);
    if (x && y && fEq(x, y)) { same.push(termText(v, d, x, true)); continue; }
    changed.push({ fromTex: x ? termText(v, d, x, true) : null, toTex: y ? termText(v, d, y, true) : null, fromText: x ? termText(v, d, x, false) : null, toText: y ? termText(v, d, y, false) : null });
  }
  if (!changed.length) return null;   // exactly equal: not a false step
  return {
    exact: true, aboveText: polyText(A, false), writtenText: polyText(B, false), aboveTex: polyText(A, true), writtenTex: polyText(B, true),
    correctedText: polyText(A, false), correctedTex: polyText(A, true), changed, same
  };
}

const MAX_CHANGES = 3;
/**
 * The diagnosis a crossed false continuation carries (the shape engine/lineChains.js and the result card read). `facts` is
 * falseStepFacts(...) or null; `example` the slip warning's own numeric example. `message` is the engine's plain sentence;
 * engine/lineCommentary.js writes the typeset one from the same structured fields.
 */
export function crossDiagnosis(facts, example, ctx = null) {
  const fix = 'Work this line out again from the line above, one term at a time.';
  const base = { code: 'false-continuation', title: 'This line is not equal to the line above', fix, confidence: 'high', expectedFrom: 'symbolic' };
  let d;
  if (facts && facts.changed.length <= MAX_CHANGES) {
    d = { ...base, exact: true, aboveTex: facts.aboveTex, writtenTex: facts.writtenTex, correctedTex: facts.correctedTex, correctedText: facts.correctedText,
      changed: facts.changed.map(c => ({ fromTex: c.fromTex, toTex: c.toTex })), same: facts.same.slice(0, 6) };
  } else if (facts) {
    d = { ...base, exact: true, aboveTex: facts.aboveTex, writtenTex: facts.writtenTex, correctedTex: facts.correctedTex, correctedText: facts.correctedText, changed: [], same: [] };
  } else {
    d = { ...base, exact: false, ...(example ? { example: { at: example.at.map(a => ({ v: a.v, value: a.value })), above: example.above, written: example.written } } : {}) };
  }
  // the annotation: structured, each field only when the engine computed it
  let ex = null;
  if (ctx && ctx.aboveSide && ctx.writtenSide) {
    // two closed numbers have no terms to name: the arithmetic is told by engine/wideFalseStep.js
    let closed = false; try { const pa = readPoly(ctx.aboveSide), pb = readPoly(ctx.writtenSide); closed = !!(pa && pb && !pa.v && !pb.v); } catch { closed = false; }
    if (!closed) { try { ex = explainFalseStep(ctx.aboveSide, ctx.writtenSide); } catch { ex = null; } }
  }
  // Sides that are not both polynomials, or a polynomial case the term rules could not name: the single-edit repair of engine/wideFalseStep.js
  if (ctx && ctx.aboveSide && ctx.writtenSide && (!ex || !ex.type)) {
    let wx = null; try { wx = explainWide(ctx.aboveSide, ctx.writtenSide, ctx.strict || null); } catch { wx = null; }
    if (wx) { ex = ex ? { ...ex } : { exact: false }; for (const k of ['type', 'whatChanged', 'whyWrong', 'corrected', 'check', 'checkAt']) if (wx[k] !== undefined && ex[k] === undefined) ex[k] = wx[k]; }
  }
  if (ex) {
    if (ex.whatChanged) d.whatChanged = ex.whatChanged;
    if (ex.whyWrong) { d.whyWrong = ex.whyWrong; d.errorType = ex.type; }
    if (ex.corrected) d.corrected = ex.corrected;
    if (ex.check) { d.check = ex.check; d.checkAt = ex.checkAt; }
  } else if (example && example.at && example.at.length) {
    d.check = `At ${example.at.map(a => `${a.v} = ${a.value}`).join(', ')} the line above gives ${example.above} but this line gives ${example.written}.`;
  }
  if (ctx && Number.isInteger(ctx.lineNo) && ctx.lineNo >= 2) d.fromLine = ctx.lineNo - 1;
  if (ctx && Number.isInteger(ctx.lineNo) && ctx.lineNo >= 2 && Number.isInteger(ctx.checkedBefore) && ctx.checkedBefore >= 1) {
    d.kept = `Every line checked before line ${ctx.lineNo} is correct.${ctx.ruleApplied ? ' The product rule was applied correctly; this is an algebra slip.' : ''}`;
  }
  // the plain-text sentence old clients read: a concise join of the fields, or the engine's own sentence when none was computed
  const parts = [d.whatChanged, d.whyWrong, d.corrected ? `Corrected line: ${d.corrected}.` : null, d.check, d.kept].filter(Boolean);
  d.comment = parts.length ? parts.join(' ') : (facts ? `This line is not equal to the line above, which simplifies to ${facts.aboveText}.` : 'This line is not equal to the line above.');
  d.message = d.comment;
  return d;
}

// ── a page that names its factors and the rule it uses (product rule, owner's page 23 November 2026) ──────────────────────
const NAME = /^[a-z]$/;
const sameFunction = (a, b) => {
  // identically equal: exactly, as polynomials in one letter (the factors of a polynomial question), never by sampling alone
  const p = readPoly(a), q = readPoly(b);
  if (!p || !q) return false;
  if (p.v && q.v && p.v !== q.v) return false;
  const keys = new Set([...p.c.keys(), ...q.c.keys()]);
  for (const k of keys) { const x = p.c.get(k), y = q.c.get(k); if (!x || !y || !fEq(x, y)) return false; }
  return true;
};
/** `Let u = x^2 and v = x - 1.`: the definitions it makes, or null. At least two, one letter each, each a complete expression. */
export function readDefinitions(text) {
  const t = tidy(text).replace(/[.;]\s*$/, '');
  const m = /^(?:let|take|put|set)\s+(.+)$/i.exec(t);
  if (!m) return null;
  const pieces = m[1].split(/\s*(?:,|;|\band\b|&)\s*/i).map(x => x.trim()).filter(Boolean);
  if (pieces.length < 2 || pieces.length > 3) return null;
  const defs = [];
  for (const piece of pieces) {
    const d = /^([a-z])\s*=\s*([^=]+)$/.exec(piece);
    if (!d || !NAME.test(d[1]) || defs.some(x => x.name === d[1])) return null;
    const poly = readPoly(d[2]);
    if (!poly) return null;
    defs.push({ name: d[1], expr: d[2].trim() });
  }
  return defs;
}
/** The function the question differentiates (`y = x^2(x - 1)`, `f(x) = ...`) read from the prompt's own statement, or null. */
export function questionFunction(prompt) {
  const found = [];
  for (const span of String(prompt ?? '').matchAll(/\$+([^$]+)\$+/g)) {
    let plain = ''; try { plain = tidy(texToPlain(span[1])); } catch { plain = ''; }
    const m = /^(?:[a-z]|[a-z]\s*\(\s*[a-z]\s*\))\s*=\s*([^=<>]+)$/.exec(plain);
    if (m && readPoly(m[1])) found.push(m[1].trim());
  }
  return found.length === 1 ? found[0] : null;
}
/** The prompt's function equals the product of the two definitions (either order): the line sets up the product rule on the question's own function. */
export function factorsOfQuestion(defs, prompt) {
  if (!defs || defs.length !== 2) return false;
  const f = questionFunction(prompt);
  if (!f) return false;
  const [a, b] = defs;
  const prod = readPoly(`(${a.expr})(${b.expr})`);
  const want = readPoly(f);
  if (!prod || !want) return false;
  return sameFunction(`(${a.expr})(${b.expr})`, f);
}
/**
 * The product rule stated in the page's own letters: `dy/dx = u'v + uv'` (either order of the two products, either order of each product),
 * where u and v are the two letters the page has just defined as the factors. Also `y' = ...`. True as a rule, whatever the question.
 */
export function isProductRuleStatement(text, defs) {
  if (!defs || defs.length !== 2) return false;
  const [u, v] = [defs[0].name, defs[1].name];
  const t = tidy(text).replace(/\s+/g, '').replace(/[.;]$/, '');
  const m = /^(?:dy\/dx|y')=(.+)$/.exec(t);
  const rhs = m ? m[1] : null;
  if (!rhs) return false;
  const terms = rhs.split('+');
  if (terms.length !== 2) return false;
  // a product of the factor letters, each with an optional prime or `d` derivative, in either order: u'v, vu', u'*v
  const read = term => {
    const toks = [...term.replace(/\*/g, '').matchAll(/([a-z])('?)/g)];
    if (toks.length !== 2 || toks.map(x => x[0]).join('') !== term.replace(/\*/g, '')) return null;
    const letters = toks.map(x => x[1]);
    if (letters.slice().sort().join('') !== [u, v].slice().sort().join('')) return null;
    const primed = toks.filter(x => x[2] === "'").map(x => x[1]);
    return primed.length === 1 ? primed[0] : null;
  };
  const r = terms.map(read);
  if (r.some(x => x === null)) return false;
  return r[0] !== r[1];   // one term differentiates u, the other v
}

// ── a line that only sets the work up ──────────────────────────────────────────────────────────────────────────────────────
const INSTRUCTION = /^(?:differentiat\w*|expand|simplif\w*|factoris\w*|factoriz\w*|use|using|apply|applying)\b/i;
const LEAD_IN = /^(?:by|using|use|apply(?:ing)?|from|with|so|then|now|first|next|recall|the|we|step\s*\d+)\b[^=<>0-9]*$/i;
const RULE_WORD = /\b(?:rule|formula|method|theorem|identity|definition|property|law)\b/i;
/** `Differentiate y = ... using the product rule.` or `By the product rule,`: the task or the method named, with no claim in it. */
export function isContextLine(text) {
  const t = tidy(text).replace(/[.:,;]+\s*$/, '');
  if (!t || t.length > 140) return false;
  if (INSTRUCTION.test(t) && RULE_WORD.test(t) && !/[<>]/.test(t)) return true;
  return !/[=<>0-9]/.test(t) && LEAD_IN.test(t) && RULE_WORD.test(t);
}

// ── what a ticked continuation DID (owner, 23 November 2026: "it should not just say correct, I need details") ───────────────────
// Each claim is recomputed here from the two lines, exactly (polynomials in one letter, BigInt fractions). A kind is returned only when its
// claim holds term by term; otherwise `equal-above` (equal, nothing more said) or null.
/** The terms of a side at depth 0, each with its sign: `2x(x - 1) + x^2` gives ['2x(x - 1)', '+ x^2']. null on an unbalanced side. */
export function topTerms(side) {
  const t = tidy(side).replace(/\s+/g, ' ').trim();
  const out = []; let depth = 0, cur = '';
  for (let i = 0; i < t.length; i++) {
    const ch = t[i];
    if (ch === '(' || ch === '[') depth++;
    if (ch === ')' || ch === ']') depth--;
    if (depth < 0) return null;
    const prev = t.slice(0, i).trimEnd().slice(-1);
    if (depth === 0 && (ch === '+' || ch === '-') && cur.trim() !== '' && prev !== '^' && prev !== '(' && prev !== '*' && prev !== '/') { out.push(cur.trim()); cur = ch; continue; }
    cur += ch;
  }
  if (depth !== 0) return null;
  if (cur.trim()) out.push(cur.trim());
  return out;
}
const sameC = (a, b) => !!a && !!b && fEq(a, b);
const termKey = (c, d) => `${d}:${c.n}/${c.d}`;
/** A term (signed text) as one monomial { c, d, v } when it is one, else null. */
function monomial(text) {
  const p = readPoly(text);
  if (!p || p.c.size > 1) return p && p.c.size === 0 ? { c: frac(0n), d: 0, v: p.v } : null;
  const [[d, c]] = [...p.c.entries()];
  return { c, d, v: p.v };
}
const polyEqual = (a, b) => { if (!a || !b) return false; const ks = new Set([...a.c.keys(), ...b.c.keys()]); for (const k of ks) if (!sameC(a.c.get(k), b.c.get(k))) return false; return !(a.v && b.v && a.v !== b.v && a.c.size); };
const signedText = (terms, tex) => terms.map((t, i) => { const s = termText(t.v || 'x', t.d, t.c, tex); return i === 0 ? s : (s.startsWith('-') ? ` - ${s.slice(1)}` : ` + ${s}`); }).join('');
/** The factors of a single product `2x(x + 2)` as expanded TeX, each a polynomial in one letter; at least two, one of them carrying the letter. null otherwise. */
function productFactors(side) {
  const ast = astOf(side); if (!ast) return null;
  let node = ast; while (node && node.t === 'group') node = node.v;
  const flat = [];
  const walk = n => { if (n && n.t === 'bin' && n.op === '*') { walk(n.l); walk(n.r); } else flat.push(n); };
  walk(node);
  if (flat.length < 2 || flat.length > 5) return null;
  // the plain factors (a number, a power of the letter) are one factor, written first; each bracket is its own factor
  const plain = flat.filter(n => n.t !== 'group'), groups = flat.filter(n => n.t === 'group');
  const parts = [];
  if (plain.length) parts.push(plain.reduce((l, r) => ({ t: 'bin', op: '*', l, r })));
  parts.push(...groups);
  if (parts.length < 2) return null;
  const out = []; let letter = false;
  for (const f of parts) {
    const st = { v: null }; const c = polyOf(f, st);
    if (!c || !c.size) return null;
    if (st.v) letter = true;
    out.push(polyText({ v: st.v || 'x', c }, true));
  }
  return letter ? out : null;
}
/** Where `top / bottom` is the whole side (one division at depth 0): [top, bottom] as text, else null. */
function splitSlash(side) {
  const t = tidy(side).replace(/\s+/g, ' ').trim();
  let depth = 0, at = -1;
  for (let i = 0; i < t.length; i++) {
    const ch = t[i];
    if (ch === '(') depth++; if (ch === ')') depth--;
    if (depth === 0 && ch === '/') { if (at >= 0) return null; at = i; }
    if (depth === 0 && at < 0 && (ch === '+' || ch === '-') && i > 0 && t[i - 1] !== '^' && t[i - 1] !== '(' ) return null;   // a sum, not one fraction
  }
  if (at <= 0) return null;
  const strip = x => { x = x.trim(); while (/^\(.*\)$/.test(x) && (() => { let d = 0; for (let i = 0; i < x.length; i++) { if (x[i] === '(') d++; if (x[i] === ')') { d--; if (d === 0 && i < x.length - 1) return false; } } return true; })()) x = x.slice(1, -1).trim(); return x; };
  const top = strip(t.slice(0, at)), bottom = strip(t.slice(at + 1));
  return top && bottom ? [top, bottom] : null;
}
/**
 * How `thisSide` follows from `aboveSide` where the sides are not both polynomials: { kind } | null. Only claims that recompute exactly.
 *   cancelled  the line above is one fraction whose denominator divides the numerator exactly, and this line is the quotient
 *   evaluated  the line above is arithmetic on numbers and this line is that value written as a single number
 */
export function stepHowWide(aboveSide, thisSide) {
  const parts = splitSlash(aboveSide);
  if (parts) {
    const num = readPoly(parts[0]), den = readPoly(parts[1]), q = readPoly(thisSide);
    if (num && den && q && den.v && den.c.size >= 1 && (!q.v || q.v === den.v) && (!num.v || num.v === den.v)) {
      const prod = readPoly(`(${thisSide})*(${parts[1]})`);
      if (prod && polyEqual(prod, num)) return { kind: 'cancelled', factorTex: polyText({ v: den.v, c: den.c }, true) };
    }
  }
  const a = closedValue(aboveSide), b = closedValue(thisSide);
  if (a !== null && b !== null && Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a)) && /^-?\d+(?:\.\d+)?$/.test(tidy(thisSide).replace(/\s+/g, '')) && !/^-?\d+(?:\.\d+)?$/.test(tidy(aboveSide).replace(/\s+/g, ''))) {
    return { kind: 'evaluated', valueTex: String(thisSide).trim() };
  }
  return null;
}

/**
 * How `thisSide` follows from `aboveSide` (both the part after `=`): { kind, ... } | null. Only claims that recompute exactly.
 *   one         a factor (1) was dropped and nothing else changed
 *   expanded    each bracketed summand of the line above is replaced by its exact expansion, term by term, the other summands unchanged
 *   collected   like terms combined: each degree appears once and its coefficient is the sum of the line above's
 *   equal-above equal as polynomials, no operation detected
 */
export function stepHow(aboveSide, thisSide) {
  const a = readPoly(aboveSide), b = readPoly(thisSide);
  if (!a || !b || !polyEqual(a, b)) return null;
  const norm = s => tidy(s).replace(/\s+/g, '');
  // multiplying by one: the line above carries a factor (1) or *1 and removing it gives this line, character for character
  const A = norm(aboveSide), B = norm(thisSide);
  if (A !== B) for (const re of [/\(1\)/, /\*1(?![\d.])/, /(?<![\d.\w)])1\*/]) { if (re.test(A) && A.replace(re, '') === B) return { kind: 'one' }; }
  const at = topTerms(aboveSide), bt = topTerms(thisSide);
  if (!at || !bt || A === B) return A === B ? null : { kind: 'equal-above' };
  const bracketed = s => /[()]/.test(s);
  // factorised: a line with no brackets became ONE product of two or more factors (each a polynomial), equal exactly (checked above)
  if (!at.some(bracketed) && bt.length === 1 && bracketed(bt[0]) && at.length >= 2) {
    const fs = productFactors(thisSide);
    if (fs) return { kind: 'factorised', factors: fs };
  }
  // expanded (one product of brackets): the line above is a single product and this line has no bracket: the exact expansion of that product
  if (at.length === 1 && bracketed(at[0]) && !bt.some(bracketed) && productFactors(aboveSide)) {
    const pa = readPoly(aboveSide);
    if (pa && pa.v) return { kind: 'expanded', items: [{ fromText: tidy(aboveSide).replace(/\s+/g, ' '), toTex: polyText(pa, true) }] };
  }
  // expanded: bracketed summands replaced by their exact expansion, the others kept as they are
  if (at.some(bracketed) && !bt.some(bracketed)) {
    const expected = []; const shown = [];
    for (const s of at) {
      if (!bracketed(s)) { expected.push(norm(s.replace(/^\+/, ''))); continue; }
      const p = readPoly(s); if (!p || !p.v) return { kind: 'equal-above' };   // a bracket of numbers is evaluated, not expanded
      const ms = [...p.c.entries()].sort((x, y) => y[0] - x[0]);
      for (const [d, c] of ms) expected.push(`${d}:${c.n}/${c.d}`);
      shown.push({ fromText: s.replace(/^\+\s*/, ''), toTex: polyText(p, true) });
    }
    const keyOf = s => { const m = monomial(s); return m ? termKey(m.c, m.d) : null; };
    const want = expected.map(x => (/^\d+:-?\d+\/\d+$/.test(x) ? x : keyOf(x))).sort();
    const have = bt.map(keyOf).sort();
    if (want.every(Boolean) && JSON.stringify(want) === JSON.stringify(have) && shown.length <= 2) return { kind: 'expanded', items: shown };
    return { kind: 'equal-above' };
  }
  // collected: no brackets, each degree once, coefficient the sum of the line above's
  if (!at.some(bracketed) && !bt.some(bracketed)) {
    const am = at.map(monomial), bm = bt.map(monomial);
    if (am.every(Boolean) && bm.every(Boolean) && bm.length < am.length) {
      const by = new Map();
      for (const m of am) by.set(m.d, [...(by.get(m.d) || []), m]);
      const degs = bm.map(m => m.d);
      if (new Set(degs).size === degs.length && degs.every(d => by.has(d)) && by.size === degs.length) {
        const groups = [];
        for (const m of bm) {
          const g = by.get(m.d); const sum = g.reduce((s, x) => fAdd(s, x.c), frac(0n));
          if (!sameC(sum, m.c)) return { kind: 'equal-above' };
          if (g.length >= 2) groups.push({ fromTex: signedText(g.map(x => ({ ...x, v: x.v || m.v })), true), toTex: termText(m.v || 'x', m.d, m.c, true) });
        }
        if (groups.length && groups.length <= 2 && bm.some(m => m.d > 0 && by.get(m.d).length >= 2)) return { kind: 'collected', groups };   // like TERMS: at least one group carries the letter
      }
    }
  }
  return { kind: 'equal-above' };
}

/** `u' = 2x and v' = 1.`: when each statement is the exact derivative of that factor, [{ nameTex, exprTex }] in the order written; else null. */
export function readDerivativeStatements(text, defs) {
  if (!defs) return null;
  const t = tidy(text).replace(/^then\b\s*/i, '').replace(/[.;]\s*$/, '');
  const pieces = t.split(/\s*(?:,|;|\band\b|&)\s*/i).map(x => x.trim()).filter(Boolean);
  if (!pieces.length || pieces.length > 3) return null;
  const items = [];
  for (const piece of pieces) {
    const m = /^([a-z])'\s*=\s*([^=]+)$/.exec(piece);
    if (!m) return null;
    const def = defs.find(d => d.name === m[1]);
    const mine = readPoly(m[2]), src = def && readPoly(def.expr);
    if (!def || !mine || !src) return null;
    const dsrc = { v: src.v, c: new Map([...src.c.entries()].filter(([d]) => d > 0).map(([d, c]) => [d - 1, fMul(c, frac(BigInt(d)))])) };
    if (!polyEqual(mine, dsrc)) return null;
    items.push({ nameTex: `${m[1]}'`, exprTex: polyText({ v: src.v || 'x', c: dsrc.c }, true), name: m[1], expr: m[2].trim() });
  }
  return new Set(items.map(i => i.name)).size === items.length ? items : null;
}

/** The product rule's right-hand side with u, v, u', v' put in: true when `thisSide` equals it and carries the page's own expressions. */
export function isRuleSubstitution(ruleSide, thisSide, defs, derivs) {
  if (!defs || defs.length !== 2 || !derivs || derivs.length !== 2) return false;
  const rule = tidy(ruleSide).replace(/\s+/g, '');
  const sub = { u: defs[0].name, v: defs[1].name };
  void sub;
  const built = rule.replace(/([a-z])('?)/g, (_, n, pr) => { const d = pr ? derivs.find(x => x.name === n) : defs.find(x => x.name === n); return d ? `(${d.expr})` : '#'; });
  if (built.includes('#')) return false;
  const want = readPoly(built), got = readPoly(thisSide);
  if (!want || !got || !polyEqual(want, got)) return false;
  const T = tidy(thisSide).replace(/\s+/g, '');
  return defs.every(d => T.includes(tidy(d.expr).replace(/\s+/g, ''))) && derivs.every(d => T.includes(tidy(d.expr).replace(/\s+/g, '')));
}

// ── the annotation of a crossed line (owner, 23 November 2026: "very detailed quality annotation when the user makes a mistake") ─────
// A closed catalogue keyed by the error type the engine DETECTS by exact term-by-term comparison of the two lines' expanded forms. Every
// field is optional and omitted when it was not computed: nothing here is a guess, and a type that cannot be told gets no `whyWrong`.
const QUOTE = t => t;
const ERROR_CATALOGUE = Object.freeze({
  // owner's page: the like terms were collected and the lone term beside them was changed
  'coefficient-beside-collected': 'Collecting {group} gives {sum} and leaves the {term} term alone, so {term} stays {term}.',
  'coefficient-alone': 'Nothing in the line above combines with the {term} term, so its coefficient stays {coef}.',
  'like-terms-wrong': 'Adding {terms} gives {sum}, not {written}.',
  'dropped-term': 'Every term of the line above has to be carried down: the {term} term is missing here.',
  'extra-term': 'The line above has no {term} term, so nothing here can produce one.',
  'sign-error': 'The sign of the {term} term changed. A sign changes only when a term is multiplied by a negative or moved across the equals sign, and neither happens between these two lines.',
  'exponent-changed': 'The power {from} became {to}. A power keeps its exponent unless it is multiplied or divided by another power of the same letter.',
  'bracket-product': 'Each term of one bracket multiplies each term of the other: {product} {state}.'
});
/** Every error type a false-continuation diagnosis may name: closed, so a card never shows an invented category. */
export const ERROR_TYPES = Object.freeze([...Object.keys(ERROR_CATALOGUE), ...WIDE_ERROR_TYPES]);
const monos = side => { const ts = topTerms(side); if (!ts) return null; const ms = ts.map(monomial); return ms.every(Boolean) ? ms : null; };
const evalAt = (p, x) => { let sum = frac(0n); for (const [d, c] of p.c) { let pw = frac(1n); for (let k = 0; k < d; k++) pw = fMul(pw, x); sum = fAdd(sum, fMul(c, pw)); } return sum; };
const fText = a => (a.d === 1n ? String(a.n) : `${a.n}/${a.d}`);
const sentence = s => `${s.charAt(0).toUpperCase()}${s.slice(1)}`;
const fill = (t, slots) => t.replace(/\{(\w+)\}/g, (_, k) => slots[k]);

/** The product terms of a bracketed summand `2x(x - 1)` of exactly two factors: [{ a, b, prod }] as signed texts, or null. */
function productPairs(summand) {
  const ast = astOf(summand.replace(/^\s*\+\s*/, ''));
  const flat = [];
  const walk = n => { if (n && n.t === 'bin' && n.op === '*') { walk(n.l); walk(n.r); } else flat.push(n); };
  walk(ast);
  if (flat.length !== 2) return null;
  const toTerms = n => { const st = { v: null }; const p = polyOf(n, st); return p ? { v: st.v, terms: [...p.entries()].map(([d, c]) => ({ d, c })).sort((x, y) => y.d - x.d) } : null; };
  const [A, B] = [toTerms(flat[0]), toTerms(flat[1])];
  if (!A || !B || A.terms.length * B.terms.length > 9) return null;
  const v = A.v || B.v || 'x';
  const out = [];
  for (const x of A.terms) for (const y of B.terms) out.push({ a: termText(v, x.d, x.c, false), b: termText(v, y.d, y.c, false), d: x.d + y.d, c: fMul(x.c, y.c), prod: termText(v, x.d + y.d, fMul(x.c, y.c), false) });
  return out;
}

/**
 * Everything the engine computed about a false continuation of polynomial lines, as plain-text facts. null when either side is not a
 * polynomial in one letter. Fields: type, whatChanged, whyWrong, corrected, check (each omitted when not computed).
 */
export function explainFalseStep(aboveSide, writtenSide) {
  const a = readPoly(aboveSide), b = readPoly(writtenSide);
  if (!a || !b || (a.v && b.v && a.v !== b.v)) return null;
  const v = a.v || b.v || 'x';
  const degs = [...new Set([...a.c.keys(), ...b.c.keys()])].sort((x, y) => y - x);
  const rows = degs.filter(d => !(a.c.get(d) && b.c.get(d) && fEq(a.c.get(d), b.c.get(d)))).map(d => ({ d, a: a.c.get(d) || null, b: b.c.get(d) || null }));
  if (!rows.length) return null;
  const T = (d, c) => termText(v, d, c, false);
  const out = { exact: true };
  out.corrected = `= ${polyText({ v, c: a.c }, false)}`;
  // a one-line self-check: the first of a few values at which the two lines differ
  for (const k of [1n, 2n, -1n, 3n]) {
    const x = frac(k), ya = evalAt({ c: a.c }, x), yb = evalAt({ c: b.c }, x);
    if (!fEq(ya, yb)) { out.check = `At ${v} = ${k} the line above gives ${fText(ya)} but this line gives ${fText(yb)}.`; out.checkAt = { v, x: Number(k), above: fText(ya), written: fText(yb) }; break; }
  }
  // a term is NAMED only when it literally appears on the line it is said to be on; otherwise the collected form is said so
  const writtenAbove = monos(aboveSide), writtenThis = monos(writtenSide);
  const lit = (list, d, c) => !!list && list.some(m => m.d === d && fEq(m.c, c));
  const pow = d => (d === 0 ? 'constant' : d === 1 ? v : `${v}^${d}`);
  if (rows.length <= 3) out.whatChanged = rows.map(r => {
    const aOk = !r.a || lit(writtenAbove, r.d, r.a), bOk = !r.b || lit(writtenThis, r.d, r.b);
    if (aOk && bOk) return r.a && r.b ? `The term ${T(r.d, r.a)} became ${T(r.d, r.b)}.` : r.a ? `The term ${T(r.d, r.a)} is missing.` : `An extra term ${T(r.d, r.b)} appears.`;
    return `Collected, the ${pow(r.d)} ${r.d === 0 ? 'term' : 'terms'} come to ${r.a ? T(r.d, r.a) : 'nothing'} in the line above and ${r.b ? T(r.d, r.b) : 'nothing'} in this line.`;
  }).join(' ');
  // the type: exact, from the terms of the line above as written (a bracketed line above is expanded by the distributive law first)
  const written = monos(aboveSide);
  const brackets = topTerms(aboveSide);
  let type = null, slots = null;
  if (rows.length === 1) {
    const r = rows[0];
    // 1  a bracket whose product is missing or wrong
    if (brackets && brackets.some(s => /[()]/.test(s))) {
      for (const s of brackets.filter(x => /[()]/.test(x))) {
        const pairs = productPairs(s); if (!pairs) continue;
        const diff = fAdd(r.a || frac(0n), fMul(r.b || frac(0n), frac(-1n)));
        const hit = pairs.find(p => p.d === r.d && fEq(p.c, diff));
        if (hit) { type = 'bracket-product'; slots = { product: `${hit.a} \u00d7 ${hit.b} = ${hit.prod}`, state: r.b ? 'is not what is written' : 'is missing' }; break; }
      }
    }
    const hasBrackets = !!(brackets && brackets.some(x => /[()]/.test(x)));   // a bracketed line above: only the bracket rule is told, the others cannot be (signs change when a bracket is multiplied out)
    if (!type && hasBrackets) { /* unclassified */ }
    else if (!type && r.a && !r.b && lit(written, r.d, r.a)) { type = 'dropped-term'; slots = { term: T(r.d, r.a) }; }
    else if (!type && !r.a && r.b && lit(writtenThis, r.d, r.b)) { type = 'extra-term'; slots = { term: T(r.d, r.b) }; }
    else if (!type && r.a && r.b && fEq(r.b, frac(-r.a.n, r.a.d)) && lit(written, r.d, r.a) && lit(writtenThis, r.d, r.b)) { type = 'sign-error'; slots = { term: T(r.d, r.a) }; }
    else if (!type && r.a && r.b && written) {
      const at = written.filter(m => m.d === r.d);
      const groups = [...new Set(written.map(m => m.d))].filter(d => d !== r.d && written.filter(m => m.d === d).length >= 2);
      if (at.length >= 2 && lit(writtenThis, r.d, r.b)) { type = 'like-terms-wrong'; slots = { terms: signedText(at.map(m => ({ ...m, v })), false), sum: T(r.d, r.a), written: T(r.d, r.b) }; }
      else if (at.length === 1 && groups.length && lit(writtenThis, r.d, r.b)) { const d = groups[0]; const g = written.filter(m => m.d === d); type = 'coefficient-beside-collected'; slots = { group: signedText(g.map(m => ({ ...m, v })), false), sum: T(d, a.c.get(d)), term: T(r.d, r.a) }; }
      else if (at.length === 1 && lit(writtenThis, r.d, r.b)) { type = 'coefficient-alone'; slots = { term: T(r.d, r.a), coef: fText(r.a) }; }
    }
  } else if (rows.length === 2) {
    const [p, q] = rows;
    const from = p.a && !p.b ? p : q.a && !q.b ? q : null, to = from === p ? q : p;
    if (from && !to.a && to.b && fEq(from.a, to.b) && from.d !== to.d && from.d >= 1 && to.d >= 1 && lit(written, from.d, from.a) && lit(writtenThis, to.d, to.b)) { type = 'exponent-changed'; slots = { from: T(from.d, from.a), to: T(to.d, to.b) }; }
  }
  if (type) { out.type = type; out.whyWrong = sentence(fill(ERROR_CATALOGUE[type], slots)); }
  void QUOTE;
  return out;
}

// ── work that is true but is not "the line above, rewritten" ─────────────────────────────────────────────────────────────────────
/**
 * The written line is the value of a PROPER part of the line above (one piece expanded, one bracket, a sub-sum), or of any earlier side on the
 * page (a restart): the student is working on a piece, not rewriting the whole line, so nothing is crossed.
 */
export function isPartialWork(aboveSide, writtenSide, earlierSides = []) {
  const w = readPoly(writtenSide);
  if (!w) return false;
  const same = t => { const p = readPoly(t); return !!p && polyEqual(p, w) && !(p.v && w.v && p.v !== w.v && p.c.size && w.c.size); };
  const terms = topTerms(aboveSide);
  if (terms && terms.length >= 2 && terms.length <= 10) {
    const n = terms.length;
    for (let mask = 1; mask < (1 << n) - 1; mask++) {   // every proper non-empty sub-sum
      const pick = terms.filter((_, k) => mask & (1 << k)).map((t, k) => (k === 0 ? t.replace(/^\+\s*/, '') : (/^[+-]/.test(t) ? t : `+ ${t}`))).join(' ');
      if (same(pick)) return true;
    }
  }
  // one factor, or a product of some of the factors, of a product
  const ast = astOf(aboveSide);
  const factors = [];
  const walk = n => { if (n && n.t === 'bin' && n.op === '*') { walk(n.l); walk(n.r); } else factors.push(n); };
  walk(ast);
  if (factors.length >= 2 && factors.length <= 6) {
    for (let mask = 1; mask < (1 << factors.length) - 1; mask++) {
      let prod = null; let ok = true;
      for (let k = 0; k < factors.length; k++) if (mask & (1 << k)) { const st = { v: null }; const p = polyOf(factors[k], st); if (!p) { ok = false; break; } prod = prod ? (() => { const o = new Map(); for (const [i, x] of prod) for (const [j, y] of p) o.set(i + j, fAdd(o.get(i + j) || frac(0n), fMul(x, y))); return o; })() : p; }
      if (ok && prod && polyEqual({ v: w.v, c: prod }, w)) return true;
    }
  }
  for (const e of earlierSides) { if (same(e)) return true; }
  return false;
}

/**
 * A line that claims derivatives of names the page defined (`u' = 3x and v' = 1` after `Let u = x^2 and v = x - 1`): { claimed, verified }.
 * `verified` is true only when EVERY piece is the exact derivative of its definition. A line with no such claim gives null.
 */
export function derivativeClaims(text, defs) {
  if (!defs) return null;
  const t = tidy(text).replace(/^then\b\s*/i, '').replace(/[.;]\s*$/, '');
  const pieces = t.split(/\s*(?:,|;|\band\b|&)\s*/i).map(x => x.trim()).filter(Boolean);
  const claims = pieces.map(p => /^([a-z])'\s*=\s*([^=]+)$/.exec(p)).filter(m => m && defs.some(d => d.name === m[1]));
  if (!claims.length) return null;
  const items = readDerivativeStatements(text, defs);
  return { claimed: claims.length, verified: !!items && items.length === pieces.length };
}
