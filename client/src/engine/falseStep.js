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

const tidy = s => String(s ?? '').replace(/[−–—]/g, '-').replace(/[′’`]/g, "'").replace(/[×·]/g, '*').replace(/÷/g, '/').trim();

// ── the question ───────────────────────────────────────────────────────────────────────────────────────────────────────
const TASK = /\b(?:differentiat\w*|derivative|gradient function|dy\s*\/\s*dx|expand\w*|simplif\w*|factoris\w*|factoriz\w*|product rule|quotient rule|chain rule)\b/i;
const CONTEXT = [
  /\b(?:when|at|if|where|given|for|whenever|substitut\w*|evaluat\w*|approximat\w*|estimat\w*|nearest|decimal|significant|sig\.?\s*fig\w*)\b/i,
  /\b(?:solv\w*|solution|roots?|zeros?|intercepts?|equations?|inequalit\w*|simultaneous|satisf\w*|prove|show that|verif\w*|identity|identities|tangent|normal|stationary|turning|maxim\w*|minim\w*|optimi\w*)\b/i,
  /\b(?:integra\w*|antiderivative|primitive|limits?|lim|series|sum|sequence|domain|range|exact value|numerically)\b/i,
  /[<>≤≥≈∫]|\\int|\\approx|\\le(?![a-z])|\\ge(?![a-z])|\\leq|\\geq|\\lim|\\sum/
];
/** The question asks for a rewrite and defines no context that could make two different-looking lines both right. */
export function contextAllowsCross(prompt) {
  const p = String(prompt ?? '').replace(/\$+/g, ' ');
  if (!p.trim() || p.length > 1500) return false;
  return TASK.test(p) && !CONTEXT.some(re => re.test(p));
}

// ── the page ───────────────────────────────────────────────────────────────────────────────────────────────────────────
/** True when something on the page changes the context for the letters in play: the page is not a plain chain of rewrites. */
export function pageBlocksCross(lines, vars) {
  const set = new Set(vars || []);
  for (const raw of lines || []) {
    const t = tidy(raw);
    if (/[≈≃~<>≤≥∫⇒→]|=>|\\int|\\approx/.test(t)) return true;
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
    || /\/\s*(?:\d+(?:\.\d+)?|[a-z])\s*(?:[a-z(]|\d)/i.test(t)                          // 1/2x, x/2y
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

/** What changed, in plain words from the exact terms (never from the student's text). */
function changeWords(changed) {
  return changed.map(c => (c.fromText && c.toText ? `the ${c.fromText} term became ${c.toText}` : c.fromText ? `the ${c.fromText} term is missing` : `an extra ${c.toText} term appears`)).join('; ');
}
const MAX_CHANGES = 3;
/**
 * The diagnosis a crossed false continuation carries (the shape engine/lineChains.js and the result card read). `facts` is
 * falseStepFacts(...) or null; `example` the slip warning's own numeric example. `message` is the engine's plain sentence;
 * engine/lineCommentary.js writes the typeset one from the same structured fields.
 */
export function crossDiagnosis(facts, example) {
  const fix = 'Work this line out again from the line above, one term at a time.';
  const base = { code: 'false-continuation', title: 'This line is not equal to the line above', fix, confidence: 'high', expectedFrom: 'symbolic' };
  if (facts && facts.changed.length <= MAX_CHANGES) {
    const message = `The line above simplifies to ${facts.aboveText}, but this line comes to ${facts.writtenText}: ${changeWords(facts.changed)}${facts.same.length ? '; the other terms are the same' : ''}. The corrected line is = ${facts.correctedText}.`;
    return { ...base, message, exact: true, aboveTex: facts.aboveTex, writtenTex: facts.writtenTex, correctedTex: facts.correctedTex, correctedText: facts.correctedText,
      changed: facts.changed.map(c => ({ fromTex: c.fromTex, toTex: c.toTex })), same: facts.same.slice(0, 6) };
  }
  if (facts) {
    return { ...base, message: `This line is not equal to the line above, which simplifies to ${facts.aboveText}. The corrected line is = ${facts.correctedText}.`, exact: true, aboveTex: facts.aboveTex, writtenTex: facts.writtenTex, correctedTex: facts.correctedTex, correctedText: facts.correctedText, changed: [], same: [] };
  }
  const at = example && Array.isArray(example.at) ? example.at.map(a => `${a.v} = ${a.value}`).join(', ') : '';
  const message = example ? `This line is not equal to the line above (for example at ${at} the line above comes to ${example.above} and this line gives ${example.written}).` : 'This line is not equal to the line above.';
  return { ...base, message, exact: false, ...(example ? { example: { at: example.at.map(a => ({ v: a.v, value: a.value })), above: example.above, written: example.written } } : {}) };
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
