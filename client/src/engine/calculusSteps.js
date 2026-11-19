// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · calculus working: where it really breaks, and what the slip is
//
// The expression Step Check knew one thing about a line of working: is it
// equivalent to the final answer? For an antiderivative that is the wrong
// question. The first line of honest working is the question itself
// ("∫16x⁷dx"), and every correct step on the way is NOT equal to the final
// answer until it is the answer. So a student who wrote
//
//     ∫16x⁷dx
//     = 8x⁸
//
// was told line 1, a restatement of the question, "is no longer equivalent to
// the expression you started with — the slip is here", and nothing about the
// real slip, the coefficient of line 2.
//
// This module reads calculus working the way a teacher does, deterministically
// (AI proposes, the engine decides — no model is involved):
//
//   · a line that restates the question (∫… dx, d/dx(…), or the integrand or
//     function itself) is the START, never a slip;
//   · an antiderivative line is verified by DIFFERENTIATING it and comparing
//     with the integrand, so a different constant, or ∫16x⁷dx − ∫8dx, is
//     recognised as true;
//   · a line that fails is named from a closed catalogue of power-rule and
//     chain-rule slips, each a plain one-sentence message (a counterexample
//     when none fits — never "no longer equivalent");
//   · anything this module cannot read it hands back unread (null), and the
//     caller keeps its previous behaviour. It never turns a mark: it only
//     decides which line is flagged and what that line is told.
//
// Pure: no I/O, no globals.
// ─────────────────────────────────────────────────────────────────────────────
import { normalize, parse, evaluate, exprEquivalent, variablesOf } from './expr.js';
import { differentiateAst } from './reason-v2.js';

const SAMPLE_POINTS = Object.freeze([-2.3, -1.1, -0.4, 0.35, 0.9, 1.7, 2.6, 3.2]);
const MAX_LINE_CHARS = 400;
const SUP = '⁰¹²³⁴⁵⁶⁷⁸⁹';

// ── Small helpers ───────────────────────────────────────────────────────────
const sup = n => {
  const s = String(n);
  return [...s].map(ch => (ch === '-' ? '⁻' : /\d/.test(ch) ? SUP[Number(ch)] : ch)).join('');
};
const near = (a, b) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));
export function fmtNum(v) {
  if (!Number.isFinite(v)) return String(v);
  if (Number.isInteger(v)) return String(v);
  for (let d = 2; d <= 12; d++) {
    const n = Math.round(v * d);
    if (Math.abs(v - n / d) < 1e-9) return `${n}/${d}`;
  }
  return String(Number(v.toPrecision(6)));
}
const power = (q, v = 'x') => (q === 0 ? '' : q === 1 ? v : `${v}${sup(q)}`);
const term = (c, q, v = 'x') => {
  if (q === 0) return fmtNum(c);
  const k = c === 1 ? '' : c === -1 ? '-' : fmtNum(c);
  return `${k}${power(q, v)}`;
};

const tryParse = text => { try { return parse(normalize(text)); } catch { return null; } };
const valueAt = (ast, x, v = 'x') => { try { return evaluate(ast, { [v]: x }); } catch { return NaN; } };

/** d/dv of an expression at x: exact when the engine can differentiate it, else a 5-point stencil. */
function derivativeAt(ast, x, v = 'x', cache = new WeakMap()) {
  let exact = cache.get(ast);
  if (exact === undefined) {
    try { exact = differentiateAst(ast, v) || null; } catch { exact = null; }
    cache.set(ast, exact);
  }
  if (exact) { const d = valueAt(exact, x, v); if (Number.isFinite(d)) return { value: d, exact: true }; }
  const h = 1e-3 * Math.max(1, Math.abs(x));
  const f = t => valueAt(ast, t, v);
  const d = (f(x - 2 * h) - 8 * f(x - h) + 8 * f(x + h) - f(x + 2 * h)) / (12 * h);
  return { value: d, exact: false };
}

/** Do two functions of v agree at the sample points (at least four comparable ones)? */
function sameFunction(fa, fb, rel = 1e-7) {
  let compared = 0;
  for (const x of SAMPLE_POINTS) {
    const a = fa(x), b = fb(x);
    if (!Number.isFinite(a) || !Number.isFinite(b)) continue;
    compared++;
    if (Math.abs(a - b) > rel * Math.max(1, Math.abs(a), Math.abs(b))) return false;
  }
  return compared >= 4;
}

// ── Polynomials, for the power-rule catalogue ───────────────────────────────
/** An expression in one variable as { power: coefficient }, or null when it is not a polynomial. */
export function polyOf(ast, v = 'x', depth = 0) {
  if (!ast || depth > 40) return null;
  const mul = (a, b) => {
    const out = new Map();
    for (const [p, c] of a) for (const [q, d] of b) out.set(p + q, (out.get(p + q) || 0) + c * d);
    return out.size > 120 ? null : out;
  };
  switch (ast.t) {
    case 'num': return new Map([[0, ast.v]]);
    case 'group': return polyOf(ast.v, v, depth + 1);
    case 'var': return ast.v === v ? new Map([[1, 1]]) : null;
    case 'neg': { const p = polyOf(ast.v, v, depth + 1); return p && new Map([...p].map(([k, c]) => [k, -c])); }
    case 'bin': {
      const l = polyOf(ast.l, v, depth + 1), r = polyOf(ast.r, v, depth + 1);
      if (ast.op === '^') {
        const e = ast.r.t === 'num' ? ast.r.v : (ast.r.t === 'group' && ast.r.v.t === 'num' ? ast.r.v.v : null);
        if (!l || e === null || !Number.isInteger(e) || e < 0 || e > 16) return null;
        let acc = new Map([[0, 1]]);
        for (let i = 0; i < e && acc; i++) acc = mul(acc, l);
        return acc;
      }
      if (!l || !r) return null;
      if (ast.op === '+' || ast.op === '-') {
        const out = new Map(l);
        for (const [k, c] of r) out.set(k, (out.get(k) || 0) + (ast.op === '+' ? c : -c));
        return out;
      }
      if (ast.op === '*') return mul(l, r);
      if (ast.op === '/') {
        if (r.size !== 1 || !r.has(0) || r.get(0) === 0) return null;
        return new Map([...l].map(([k, c]) => [k, c / r.get(0)]));
      }
      return null;
    }
    default: return null;
  }
}
const cleanPoly = p => new Map([...p].filter(([, c]) => Math.abs(c) > 1e-12));

// ── The question's own calculus, read from its prompt ───────────────────────
const TEX_SPAN = /\$([^$]+)\$/g;
function texToPlain(tex) {
  let s = String(tex || '');
  // An exponent in braces first, so a fraction whose denominator carries one (\dfrac{12}{x^{3}}) has no nested braces left.
  for (let guard = 0; guard < 6 && /\^\s*\{[^{}]*\}/.test(s); guard++) s = s.replace(/\^\s*\{([^{}]*)\}/g, '^($1)');
  for (let guard = 0; guard < 6 && /\\d?frac/.test(s); guard++) {
    s = s.replace(/\\d?frac\s*(\{[^{}]*\}|[0-9a-zA-Z])\s*(\{[^{}]*\}|[0-9a-zA-Z])/g, (_, a, b) => `((${a.replace(/^\{|\}$/g, '')})/(${b.replace(/^\{|\}$/g, '')}))`);
  }
  s = s.replace(/\\sqrt\s*\{([^{}]*)\}/g, 'sqrt($1)')
    .replace(/\^\s*\{([^{}]*)\}/g, '^($1)')
    .replace(/\\(sin|cos|tan|ln|log)\b/g, '$1')
    .replace(/\\(times|cdot)/g, '*')
    .replace(/\\(left|right|displaystyle|,|;|!|quad|qquad)/g, '')
    .replace(/[{}]/g, '');
  return /\\[a-zA-Z]+/.test(s) ? null : s.trim();
}

/**
 * What the question asks, when it is an indefinite integral or a derivative of
 * one function: { relation: 'antiderivative' | 'derivative', given, variable }.
 * `given` is the integrand, or the function to differentiate. Null otherwise
 * (a definite integral, a rate, a tangent, a prompt with no single function).
 */
export function calculusContext(meta, prompt) {
  if (!meta || meta.kind !== 'expression' || typeof meta.canonical !== 'string') return null;
  const text = String(prompt || '');
  const spans = [...text.matchAll(TEX_SPAN)].map(m => m[1]);
  const integral = spans.find(s => /\\int(?!\s*[_^])/.test(s));
  if (integral && !/\\oint|\\iint/.test(integral)) {
    const m = /\\int\s*([\s\S]*?)(?:\\,|\\;|\s)*d\s*([a-z])\s*$/.exec(integral.trim());
    const body = m && texToPlain(m[1]);
    const given = body && tryParse(body);
    if (given) return { relation: 'antiderivative', given, variable: m[2], canonical: tryParse(meta.canonical) };
    return null;
  }
  if (/differentiat|derivative|\bd\/dx|\\frac\s*\{\s*d/i.test(text) && spans.length === 1) {
    const plain = texToPlain(spans[0]);
    const eq = plain && plain.split('=');
    if (eq && eq.length === 2 && /^[a-z](\([a-z]\))?$/i.test(eq[0].trim())) {
      const given = tryParse(eq[1]);
      if (given) return { relation: 'derivative', given, variable: (variablesOf(given).values().next().value) || 'x', dependent: eq[0].trim().replace(/\(.*$/, ''), canonical: tryParse(meta.canonical) };
    }
  }
  // A derivative of one named quantity with respect to another ("Find dA/dr if A = πr²", \frac{dA}{dr} where A = …): the prompt
  // itself defines the quantity, so a line about it can be held to it. The asked letters must be named by the prompt and the
  // quantity defined once, as a plain function of the other letter.
  const asked = [...text.matchAll(/\\d?frac\s*\{\s*d\s*([A-Za-z])\s*\}\s*\{\s*d\s*([A-Za-z])\s*\}|\bd\s*([A-Za-z])\s*\/\s*d\s*([A-Za-z])\b/g)];
  if (asked.length === 1 && /differentiat|derivative|\bfind\b|\bd\s*[A-Za-z]\s*\/|\\frac/i.test(text)) {
    const N = asked[0][1] || asked[0][3], Dv = asked[0][2] || asked[0][4];
    if (N !== Dv) {
      const flat = text.replace(/\$([^$]+)\$/g, (m, a) => ' ' + (texToPlain(a.replace(/\\pi\b/g, 'pi')) || '') + ' ');
      const defs = [...String(flat).matchAll(new RegExp('(?:^|[\\s,.;(])' + N + '\\s*(?:\\(\\s*' + Dv + '\\s*\\))?\\s*=\\s*([^=,;\\n]+?)(?=\\s*(?:[,;.]\\s|[,;]$|\\.$|$|\\band\\b|\\bfind\\b|\\bwhere\\b))', 'gi'))];
      if (defs.length === 1) {
        const given = tryParse(defs[0][1].trim());
        if (given && [...variablesOf(given)].every(l => l === Dv || l === 'e') && variablesOf(given).has(Dv)) {
          return { relation: 'derivative', given, variable: Dv, dependent: N, canonical: tryParse(meta.canonical) };
        }
      }
    }
  }
  return null;
}

// ── Reading a line ──────────────────────────────────────────────────────────
const FUNCTION_LABEL = /^(?:y|f|g|F|[a-z]\s*\(\s*[a-z]\s*\))$/;
const LABEL = /^(?:y|f|g|F|[a-z]\s*\(\s*[a-z]\s*\)|[a-z]\s*['′]\s*(?:\(\s*[a-z]\s*\))?|d\s*[a-z]\s*\/\s*d\s*[a-z]|d\s*\/\s*d\s*[a-z])$/;

/** Top-level '=' split ('<', '>', '≤', '≥', '≠' are not equals). */
function segmentsOf(line) {
  const text = normalize(String(line || '')).replace(/^∴\s*/, '').replace(/^(so|hence|then|therefore)\s+/i, '');
  const out = [];
  let depth = 0, start = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if ('([{'.includes(ch)) depth++;
    else if (')]}'.includes(ch)) depth = Math.max(0, depth - 1);
    else if (ch === '=' && depth === 0 && !(i > 0 && '<>≤≥≠!'.includes(text[i - 1]))) { out.push(text.slice(start, i).trim()); start = i + 1; }
  }
  out.push(text.slice(start).trim());
  return out;
}

/** Additive terms at the top level, each with its sign. */
function termsOf(text) {
  const s = String(text).trim();
  const terms = [];
  let depth = 0, start = 0, sign = 1;
  const push = end => { const t = s.slice(start, end).trim(); if (t) terms.push({ sign, text: t }); };
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if ('([{'.includes(ch)) depth++;
    else if (')]}'.includes(ch)) depth = Math.max(0, depth - 1);
    else if ((ch === '+' || ch === '-') && depth === 0 && i > start && !/[\^*/(]\s*$/.test(s.slice(start, i)) && !(/^∫/.test(s.slice(start, i).trim()) && !/d[a-z]\s*$/.test(s.slice(start, i).trim()))) {
      push(i); start = i + 1; sign = ch === '-' ? -1 : 1;
    }
  }
  push(s.length);
  if (terms.length && /^[+-]/.test(terms[0].text)) {
    const neg = terms[0].text.startsWith('-');
    terms[0] = { sign: terms[0].sign * (neg ? -1 : 1), text: terms[0].text.slice(1).trim() };
  }
  return terms;
}

const INTEGRAL_TERM = /^(?:(.*?)\s*\*?\s*)?(?:∫|\\int)\s*(.+?)\s*d\s*([a-z])$/;
const DERIV_TERM = /^(?:(.*?)\s*\*?\s*)?(?:d\s*\/\s*d\s*([a-z])|\\frac\s*\{d\}\{d\s*([a-z])\})\s*[([]\s*(.+)\s*[)\]]$/;
const CONSTANT_TERM = /^[cC]$/;

/**
 * A segment of working as a function of x, under `relation`: for an
 * antiderivative question, d/dx of what the student wrote (an integral sign
 * differentiates to its integrand); for a derivative question, its value (a
 * d/dx(…) is differentiated). Null when any part cannot be read.
 * `kind` is 'plain' for one ordinary expression, 'mixed' when a term is an
 * integral or derivative operator, and 'start' for the bare operator of the
 * question itself.
 */
function readSegment(text, ctx) {
  if (!text || text.length > MAX_LINE_CHARS) return null;
  const v = ctx.variable;
  const terms = termsOf(text);
  if (!terms.length) return null;
  const parts = [];
  let operators = 0, constants = 0;
  for (const t of terms) {
    if (CONSTANT_TERM.test(t.text)) {
      // A constant of integration belongs to an antiderivative, once, added. Anywhere else the line is not read.
      if (ctx.relation !== 'antiderivative' || t.sign < 0 || ++constants > 1) return null;
      continue;
    }
    const integral = INTEGRAL_TERM.exec(t.text);
    const deriv = DERIV_TERM.exec(t.text);
    if (integral) {
      const coef = integral[1] ? tryParse(integral[1]) : null;
      const body = tryParse(integral[2]);
      if ((integral[1] && !coef) || !body) return null;
      operators++;
      parts.push({ sign: t.sign, kind: 'integral', body, coef });
    } else if (deriv) {
      const coef = deriv[1] ? tryParse(deriv[1]) : null;
      const body = tryParse(deriv[4]);
      if ((deriv[1] && !coef) || !body) return null;
      operators++;
      parts.push({ sign: t.sign, kind: 'deriv', body, coef });
    } else if (/∫|\\int|d\s*\/\s*d/.test(t.text)) {
      return null;
    } else {
      const ast = tryParse(t.text);
      if (!ast) return null;
      parts.push({ sign: t.sign, kind: 'plain', ast });
    }
  }
  if (!parts.length) return null;
  const caches = parts.map(() => new WeakMap());
  const approx = { used: false };
  // What the segment is, as a function of x, under the question's relation.
  const asFunction = x => {
    let total = 0;
    for (const [i, p] of parts.entries()) {
      let val;
      const c = p.coef ? valueAt(p.coef, x, v) : 1;
      if (p.kind === 'integral') {
        // d/dx of ∫g dx is g; in a derivative question an integral is not meaningful.
        if (ctx.relation !== 'antiderivative') return NaN;
        val = c * valueAt(p.body, x, v);
      } else if (p.kind === 'deriv') {
        if (ctx.relation !== 'derivative') return NaN;
        const d = derivativeAt(p.body, x, v, caches[i]); if (!d.exact) approx.used = true;
        val = c * d.value;
      } else if (ctx.relation === 'antiderivative') {
        const d = derivativeAt(p.ast, x, v, caches[i]); if (!d.exact) approx.used = true;
        val = d.value;
      } else val = valueAt(p.ast, x, v);
      total += p.sign * val;
    }
    return total;
  };
  const single = parts.length === 1 ? parts[0] : null;
  const onlyPlain = parts.every(p => p.kind === 'plain');
  const kind = single && single.kind !== 'plain' && !single.coef ? 'operator' : (onlyPlain ? 'plain' : 'mixed');
  // The plain expression itself (constants of integration dropped), for the catalogue.
  const plainAst = onlyPlain ? plainOf(parts) : null;
  return { kind, parts, asFunction, approx, constants, operators, plainAst, text };
}

function plainOf(parts) {
  let acc = null;
  for (const p of parts) {
    const node = p.sign < 0 ? { t: 'neg', v: p.ast } : p.ast;
    acc = acc ? { t: 'bin', op: '+', l: acc, r: node } : node;
  }
  return acc;
}

// ── Judging a line ──────────────────────────────────────────────────────────
/**
 * How one line of working stands against an indefinite integral or a
 * derivative the question asked for.
 *
 *   { status: 'ok' | 'note' | 'break', note?, diagnosis? , restates?: true }
 *
 * `ok` only where the engine's old rule said ok (the line, or its last
 * '='-segment, equals the final answer): marks are decided elsewhere and are
 * unchanged. `break` is a line that is wrong under the question's own
 * relation, with the slip named when it can be. `note` is everything true
 * that is not the answer: a restatement, an antiderivative that differs from
 * the answer by a constant. Null when the line cannot be read (the caller
 * keeps its previous behaviour).
 */
export function assessCalculusLine(line, ctx, meta, stage = { claimed: false }) {
  if (!ctx || !line || String(line).length > MAX_LINE_CHARS) return null;
  // The question written out again is the START only at the start: before any
  // line has made a claim, and not as a continuation ("= …") of an earlier line.
  // The same expression later on is a claim, and judged as one.
  const startAllowed = !/^\s*=/.test(String(line));
  try {
    // "dy/dx = … + C": a derivative is a function, not a family of them. Said as a claim (a derivative label), an added arbitrary
    // constant is false under every reading, whatever else the line says.
    if (ctx.relation === 'derivative' && /^\s*(?:∴\s*)?(?:d[a-z]\s*\/\s*d[a-z]|[a-z]\s*['′](?:\s*\(\s*[a-z]\s*\))?|[a-z]\s*\(\s*[a-z]\s*\)\s*['′])\s*=/i.test(String(line))) {
      const tail = segmentsOf(line).filter(t => t !== '').pop();
      if (tail && termsOf(tail).some(t => t.sign > 0 && CONSTANT_TERM.test(t.text)) && termsOf(tail).length > 1) {
        const d = D('diff-constant-kept', 'A constant was added', 'A derivative is one function: an arbitrary constant + C belongs to an integral, not to a derivative.', 'Leave out + C when you differentiate.', 'high');
        return { status: 'break', note: d.message, diagnosis: d };
      }
    }
    const segs = segmentsOf(line).filter(s => s !== '');
    if (!segs.length) return null;
    const read = [];
    for (const text of segs) {
      if (LABEL.test(text)) { read.push({ label: true, text }); continue; }
      const seg = readSegment(text, ctx);
      if (!seg) return null;
      read.push({ ...seg, text });
    }
    const real = read.filter(s => !s.label);
    if (!real.length) return null;
    const target = ctx.relation === 'antiderivative' ? x => valueAt(ctx.given, x, ctx.variable) : null;

    // The answer test the checker has always applied, EXACTLY (marks hang on it): the last
    // '='-segment of the line, as the line is cleaned, equivalent to the final answer. A
    // constant of integration is therefore not part of it: "2x⁸ + C" is a true line, not the answer.
    const cleanedLine = normalize(String(line)).replace(/^∴\s*/, '').replace(/^(so|hence|then|therefore)\s+/i, '');
    const answerCandidate = cleanedLine.includes('=') ? cleanedLine.split('=').pop() : cleanedLine;
    let isAnswer = false;
    try { isAnswer = exprEquivalent(answerCandidate, meta.canonical, { positiveOnly: meta.positiveOnly }); } catch { isAnswer = false; }

    const verdicts = real.map((seg, position) => {
      // A label that says "this is the derivative / the answer" (dy/dx, f′(x), F) makes the line a claim.
      const labelsOk = ctx.relation === 'derivative' ? read.every(r => !r.label || FUNCTION_LABEL.test(r.text)) : read.every(r => !r.label);
      const mayRestate = startAllowed && labelsOk && position === 0 && !read.slice(0, read.indexOf(seg)).some(r => !r.label);
      if (ctx.relation === 'antiderivative') {
        // The question's own integral, or its integrand: the start.
        if (seg.kind === 'operator' && seg.parts[0].kind === 'integral' && sameFunction(x => valueAt(seg.parts[0].body, x, ctx.variable), target)) return 'start';
        if (mayRestate && seg.kind === 'plain' && seg.operators === 0 && sameFunction(x => valueAt(seg.plainAst, x, ctx.variable), target)) return 'start';
        return sameFunction(seg.asFunction, target, seg.approx.used ? 1e-4 : 1e-7) ? 'valid' : 'invalid';
      }
      // A derivative question: the function itself, or d/dx of it, is the start.
      const givenFn = x => valueAt(ctx.given, x, ctx.variable);
      if (seg.kind === 'operator' && seg.parts[0].kind === 'deriv' && sameFunction(x => valueAt(seg.parts[0].body, x, ctx.variable), givenFn)) return 'start';
      if (mayRestate && seg.kind === 'plain' && sameFunction(x => valueAt(seg.plainAst, x, ctx.variable), givenFn)) {
        // The function written out again is the start (an exact derivative, e^x, is judged below as an answer first).
        return 'start';
      }
      const expected = ctx.canonical ? (x => valueAt(ctx.canonical, x, ctx.variable)) : null;
      if (!expected) return 'unread';
      return sameFunction(seg.asFunction, expected, seg.approx.used ? 1e-4 : 1e-7) ? 'valid' : 'invalid';
    });
    if (verdicts.includes('unread')) return null;

    if (isAnswer) return { status: 'ok' };
    const firstInvalid = verdicts.indexOf('invalid');
    if (firstInvalid === -1) {
      const onlyStart = verdicts.every(x => x === 'start');
      return onlyStart ? { status: 'note', restates: true }
        : { status: 'note', note: ctx.relation === 'antiderivative'
          ? 'True — differentiating this line gives the integrand. It differs from the final answer by a constant, or is not yet simplified.'
          : 'True — this line equals the derivative, written another way.' };
    }
    const bad = real[firstInvalid];
    const diagnosis = diagnoseSlip(ctx, bad, meta);
    return { status: 'break', note: diagnosis.message, diagnosis };
  } catch (e) {
    if (globalThis.__CALC_DEBUG__) console.log(e.stack);
    return null;
  }
}

// ── Naming the slip ─────────────────────────────────────────────────────────
const D = (code, title, message, fix, confidence = 'high', detail = {}) => ({ code, title, message, fix, confidence, detail });

/** Terms of the correct answer and of the student's line as polynomials, constants set aside. */
function polysFor({ given: g, canonical: c, student: st, variable: v }) {
  const given = polyOf(g, v);
  const correct = c ? polyOf(c, v) : null;
  const student = st ? polyOf(st, v) : null;
  if (!given || !correct || !student) return null;
  return { given: cleanPoly(given), correct: cleanPoly(correct), student: cleanPoly(student) };
}

/** The scale a linear inner function ax + b puts into f(ax + b), or null. */
export function innerCoefficient(ast, v = 'x') {
  let found = null;
  const visit = node => {
    if (found !== null || !node || typeof node !== 'object') return;
    let inner = null;
    if (node.t === 'call') inner = node.arg;
    else if (node.t === 'bin' && node.op === '^' && node.l.t === 'var' && node.l.v === 'e') inner = node.r;
    else if (node.t === 'bin' && node.op === '^' && node.l.t === 'group') inner = node.l;
    if (inner) {
      const f = x => valueAt(inner, x, v);
      const a = f(1) - f(0);
      if (Number.isFinite(a) && Math.abs(f(2) - f(0) - 2 * a) < 1e-9 && Math.abs(a) > 1e-9) { found = a; return; }
    }
    for (const key of ['l', 'r', 'v', 'arg']) visit(node[key]);
  };
  visit(ast);
  return found;
}

function diagnoseSlip(ctx, seg, meta) {
  const v = ctx.variable;
  let named = null;
  try {
    const parts = { given: ctx.given, canonical: ctx.canonical, student: seg.plainAst, variable: v };
    named = ctx.relation === 'antiderivative' ? antiderivativeSlip(parts) : derivativeSlip(parts);
  } catch { named = null; }
  if (named) return named;
  // No catalogue entry fits: a counterexample, truthful and specific to this line.
  for (const x of [2, 3, 1, -1, 0.5, 4]) {
    const got = ctx.relation === 'antiderivative' ? seg.asFunction(x) : seg.asFunction(x);
    const want = ctx.relation === 'antiderivative' ? valueAt(ctx.given, x, v) : (ctx.canonical ? valueAt(ctx.canonical, x, v) : NaN);
    if (!Number.isFinite(got) || !Number.isFinite(want) || Math.abs(got - want) <= 1e-7 * Math.max(1, Math.abs(want))) continue;
    const message = ctx.relation === 'antiderivative'
      ? `Differentiate this line to check it: at ${v} = ${x} it gives ${fmtNum(Number(got.toPrecision(8)))}, but the integrand is ${fmtNum(Number(want.toPrecision(8)))} there.`
      : `At ${v} = ${x} this line is ${fmtNum(Number(got.toPrecision(8)))}, but the derivative is ${fmtNum(Number(want.toPrecision(8)))} there.`;
    return D(ctx.relation === 'antiderivative' ? 'antiderivative-check' : 'derivative-check', 'This line does not check out', message,
      ctx.relation === 'antiderivative' ? 'Differentiate your line: you should get the integrand back.' : 'Recheck the rule used on this line.', 'medium', { x });
  }
  return D('counterexample', 'This line is no longer true', 'This line does not follow from the question.', 'Compare it with the question term by term.', 'low');
}

/** The named power-rule or chain-rule slip in a student's antiderivative, or null. */
export function antiderivativeSlip({ given: givenAst, canonical, student: studentAst, variable: v }) {
  // A linear inner function: ∫ f(ax + b) dx = F(ax + b) / a.
  if (!studentAst) return null;
  const a = innerCoefficient(givenAst, v);
  if (a !== null && Math.abs(Math.abs(a) - 1) > 1e-9 && canonical) {
    const right = x => valueAt(canonical, x, v);
    const studentFn = x => valueAt(studentAst, x, v);
    {
      if (sameFunction(studentFn, x => right(x) * a)) {
        return D('int-linear-inner-not-divided', 'The inside function was not divided out',
          `The inside of the function is ${fmtNum(a)}${v}, so integrating divides by ${fmtNum(a)}: your line is ${fmtNum(a)} times too big.`,
          `Divide by ${fmtNum(a)}, the coefficient of ${v} inside.`);
      }
      if (sameFunction(studentFn, x => right(x) * a * a)) {
        return D('int-linear-inner-multiplied', 'Multiplied by the inside instead of dividing',
          `You multiplied by ${fmtNum(a)}; integrating divides by the coefficient of ${v} inside the function (here ${fmtNum(a)}).`,
          `Divide, don't multiply, by ${fmtNum(a)}.`);
      }
    }
  }
  const polys = polysFor({ given: givenAst, canonical, student: studentAst, variable: v });
  if (!polys) return null;
  const { given, correct, student } = polys;
  // Compare power by power, highest first; the constant of integration is not marked.
  const powers = [...new Set([...correct.keys(), ...student.keys()])].filter(q => q !== 0 || correct.has(0)).sort((x, y) => Number(correct.has(y)) - Number(correct.has(x)) || y - x);
  for (const q of powers) {
    const r = correct.get(q) || 0, s = student.get(q) || 0;
    if (near(r, s)) continue;
    const n = q - 1;                       // the power the integrand term had
    const c = given.get(n);                // its coefficient
    if (c === undefined) {                 // a term the answer does not have
      if (s !== 0 && given.has(q + 1) === false) continue;
      return null;
    }
    const shown = term(c, n, v);
    if (s !== 0) {
      if (near(s, c) && q !== 1) {
        return D('int-no-divide', 'Forgot to divide by the new power',
          `Your power is right (${power(q, v)}). You forgot to divide the coefficient by the new power: ${fmtNum(c)} ÷ ${q} = ${fmtNum(r)}.`,
          `Integrating ${shown} raises the power to ${q} and divides by ${q}.`, 'high', { q, c });
      }
      if (n !== 0 && n !== 1 && near(s, c / n)) {
        return D('int-divide-old-power', 'Divided by the old power',
          `Your power is right (${power(q, v)}). You divided by the old power ${n}; divide by the new power instead: ${fmtNum(c)} ÷ ${q} = ${fmtNum(r)}.`,
          `Divide by ${q}, the power after integrating.`, 'high', { q, c });
      }
      if (near(s, -r)) {
        return D('int-sign', 'Sign slip',
          `Your power is right (${power(q, v)}) and so is the size of the coefficient, but the sign is the wrong way round.`,
          'Check the sign carried from the integrand.', 'high', { q });
      }
      return D('int-wrong-divisor', 'Wrong divisor',
        `Your power is right (${power(q, v)}). Check the coefficient: ${fmtNum(c)} ÷ ${q} = ${fmtNum(r)}.`,
        `Divide ${fmtNum(c)} by the new power, ${q}.`, 'high', { q, c });
    }
    // The student's line has nothing at power q: what does it have at the old power?
    const kept = student.get(n);
    if (kept !== undefined && (near(kept, c) || near(kept, r))) {
      if (n === 0) {
        return D('int-constant-not-integrated', 'A constant was not integrated',
          `The constant ${fmtNum(c)} also has to be integrated: ∫${fmtNum(c)} dx = ${fmtNum(c)}${v}.`,
          `A constant integrates to that constant times ${v}.`, 'high', { c });
      }
      return D('int-power-not-raised', 'Power not raised',
        `Integrating raises the power by one: ${power(n, v)} should become ${power(q, v)}, but your line still has ${power(n, v)}.`,
        `Raise the power to ${q}, then divide by ${q}.`, 'high', { n, q });
    }
    const lowered = student.get(n - 1);
    if (lowered !== undefined && near(lowered, c * n)) {
      return D('int-differentiated', 'Differentiated instead of integrating',
        `That is what differentiating ${shown} gives. Integrating goes the other way: the power rises to ${q}.`,
        'Integrate: raise the power by one, then divide by the new power.', 'high', { n, q });
    }
    return null;
  }
  return null;
}

/** The named power-rule or chain-rule slip in a student's derivative, or null. */
export function derivativeSlip({ given: givenAst, canonical, student: studentAst, variable: v }) {
  if (!studentAst) return null;
  const a = innerCoefficient(givenAst, v);
  if (a !== null && Math.abs(Math.abs(a) - 1) > 1e-9 && canonical) {
    const right = x => valueAt(canonical, x, v);
    const studentFn = x => valueAt(studentAst, x, v);
    if (sameFunction(studentFn, x => right(x) / a)) {
      return D('diff-chain-inner-missing', 'Chain rule: the inside was not differentiated',
        `You differentiated the outside but not the inside: the inside is ${fmtNum(a)}${v}, so multiply by ${fmtNum(a)}.`,
        `Multiply by the derivative of the inside, ${fmtNum(a)}.`, 'high', { a });
    }
  }
  const polys = polysFor({ given: givenAst, canonical, student: studentAst, variable: v });
  if (!polys) return null;
  const { given, correct, student } = polys;
  // The answer's own terms first (highest power first), then terms the student added.
  const powers = [...new Set([...correct.keys(), ...student.keys()])].sort((x, y) => Number(correct.has(y)) - Number(correct.has(x)) || y - x);
  for (const q of powers) {
    const r = correct.get(q) || 0, s = student.get(q) || 0;
    if (near(r, s)) continue;
    const p = q + 1;                       // the power the function term had
    const c = given.get(p);
    if (q === 0 && s !== 0 && given.has(0) && near(s, r + given.get(0))) {
      return D('diff-constant-kept', 'A constant was kept',
        `A constant has zero gradient, so ${fmtNum(given.get(0))} disappears when you differentiate.`,
        'Differentiate a constant to 0.', 'high');
    }
    if (c === undefined) return null;
    const shown = term(c, p, v);
    if (s !== 0) {
      if (near(s, c) && p !== 1) {
        return D('diff-no-multiply', 'Forgot to multiply by the old power',
          `Your power is right (${power(q, v)}). You forgot to multiply by the old power: ${fmtNum(c)} × ${p} = ${fmtNum(r)}.`,
          `Differentiating ${shown} multiplies by ${p} and lowers the power to ${q}.`, 'high', { p, c });
      }
      if (near(s, -r)) {
        return D('diff-sign', 'Sign slip',
          `Your power is right (${power(q, v)}) and so is the size of the coefficient, but the sign is the wrong way round.`,
          'Check the sign carried from the function.', 'high');
      }
      return D('diff-wrong-multiplier', 'Wrong multiplier',
        `Your power is right (${power(q, v)}). Check the coefficient: ${fmtNum(c)} × ${p} = ${fmtNum(r)}.`,
        `Multiply ${fmtNum(c)} by the old power, ${p}.`, 'high', { p, c });
    }
    const kept = student.get(p);
    if (kept !== undefined && (near(kept, r) || near(kept, c))) {
      return D('diff-power-not-lowered', 'Power not lowered',
        `Differentiating lowers the power by one: ${power(p, v)} should become ${power(q, v)}${q === 0 ? ' (just a number)' : ''}, but your line still has ${power(p, v)}.`,
        `Multiply by ${p}, then lower the power to ${q}.`, 'high', { p, q });
    }
    const raised = student.get(p + 1);
    if (raised !== undefined && near(raised, c / (p + 1))) {
      return D('diff-integrated', 'Integrated instead of differentiating',
        `That is what integrating ${shown} gives. Differentiating goes the other way: the power falls to ${q}.`,
        'Differentiate: multiply by the power, then lower it by one.', 'high', { p, q });
    }
    return null;
  }
  return null;
}

/**
 * Refine one line of a derivative question that carries authored derivative
 * metadata (kind 'derivative', reason-v2's assessDerivativeLine): the function
 * written out again is the START, not a slip, and a slip is named from the
 * power-rule and chain-rule catalogue. `assessed` is what the line was judged
 * as; only a break is ever changed, and only to a note (a restatement) or to a
 * better-named break — never to ok.
 */
export function refineDerivativeLine(text, meta, assessed, stage = { claimed: false }) {
  if (!assessed || assessed.status !== 'break' || !meta?.source || !meta?.canonical) return assessed;
  try {
    const segs = segmentsOf(text).filter(t => t !== '' && !LABEL.test(t));
    if (!segs.length) return assessed;
    const source = tryParse(meta.source), canonical = tryParse(meta.canonical);
    const variable = meta.variable || 'x';
    if (!source || !canonical) return assessed;
    const asts = segs.map(t => (termsOf(t).length && !/∫|\\int|d\s*\/\s*d/.test(t) ? tryParse(t) : null));
    if (asts.some(a => !a)) return assessed;
    const sameAs = (a, b) => sameFunction(x => valueAt(a, x, variable), x => valueAt(b, x, variable));
    const allLabels = segmentsOf(text).filter(t => t !== '' && LABEL.test(t));
    if (!/^\s*=/.test(String(text)) && allLabels.every(l => FUNCTION_LABEL.test(l)) && asts.length === 1 && sameAs(asts[0], source)) return { status: 'note', restates: true };
    const last = asts[asts.length - 1];
    const named = derivativeSlip({ given: source, canonical, student: last, variable });
    return named ? { status: 'break', note: named.message, diagnosis: named } : assessed;
  } catch { return assessed; }
}

const FORMULA_LABEL = /d\s*[uvw]\s*\/\s*d\s*[a-z]|\b[uvw]\s*['′]/i;

/**
 * A derivative claim whose right side is written in the student's own labels (the quotient rule (v du/dx - u dv/dx)/v^2, the
 * product rule u dv/dx + v du/dx) is a FORMULA, not a function of the variable. It is proven false only by substituting the
 * student's own definitions: every label it uses must be defined on an earlier line as a plain function of the variable, the
 * derivatives of the labels are taken from those definitions, and the result must differ from the question's derivative.
 * Anything else (a label with no definition, an unreadable definition, a derivative the engine cannot take exactly) abstains.
 */
function formulaProvenFalse(rhsText, ctx, previousTexts) {
  const v = ctx.variable;
  if (!ctx.canonical) return false;
  const holders = ['j', 'k', 'h'];
  if (/[jkh]/i.test(rhsText)) return false;
  const used = new Map();   // label -> placeholder for its derivative
  let text = rhsText.replace(/d\s*([uvw])\s*\/\s*d\s*([a-z])/gi, (m, L, w) => {
    if (w !== v) return '\u0000';
    const key = L.toLowerCase();
    if (!used.has(key)) used.set(key, holders[used.size] || null);
    return used.get(key) || '\u0000';
  }).replace(/\b([uvw])\s*['′]/gi, (m, L) => {
    const key = L.toLowerCase();
    if (!used.has(key)) used.set(key, holders[used.size] || null);
    return used.get(key) || '\u0000';
  });
  if (text.includes('\u0000')) return false;
  const ast = tryParse(text);
  if (!ast) return false;
  const letters = new Set([...variablesOf(ast)].filter(l => l !== v && l !== 'e' && !holders.includes(l)));
  for (const key of used.keys()) letters.add(key);
  if (!letters.size) return false;
  const defs = new Map();
  for (const L of letters) {
    if (!/^[uvw]$/.test(L)) return false;
    let def = null;
    for (const prior of previousTexts) {
      const m = new RegExp('^\\s*(?:let\\s+)?' + L + '\\s*=\\s*([^=]+)$', 'i').exec(normalize(String(prior)).replace(/^∴\s*/, ''));
      if (m) { const a = tryParse(m[1]); def = a && [...variablesOf(a)].every(l => l === v || l === 'e') ? a : null; }
    }
    if (!def) return false;
    defs.set(L, def);
  }
  const cache = new WeakMap();
  const expected = x => valueAt(ctx.canonical, x, v);
  let exactOnly = true;
  const mine = x => {
    const env = { [v]: x };
    for (const [L, def] of defs) {
      env[L] = valueAt(def, x, v);
      const key = used.get(L);
      if (key) { const d = derivativeAt(def, x, v, cache); if (!d.exact) exactOnly = false; env[key] = d.value; }
    }
    try { return evaluate(ast, env); } catch { return NaN; }
  };
  const same = sameFunction(mine, expected, 1e-7);
  return exactOnly && !same && SAMPLE_POINTS.some(x => Number.isFinite(mine(x))) && SAMPLE_POINTS.filter(x => Number.isFinite(mine(x)) && Number.isFinite(expected(x))).length >= 4;
}

/**
 * A function applied to an unbracketed argument ("cos 2x", "cos2x", "sin x^2") has two readings of how far the argument runs:
 * the whole next term (cos(2x)) or only its first factor (cos(2)·x). Returns the line written under each reading, or null when
 * the line has no such function. A caller that finds the line true under either reading must not cross it.
 */
export function unbracketedReadings(line) {
  const text = String(line || '');
  const FN = /(?<![a-z])(sin|cosec|cos|tan|sec|csc|cot|ln|log|exp|sqrt)(\s*\^\s*\d+)?\s*(?=[0-9a-z.])(?!\()/gi;
  const TERM = /^(?:\d+(?:\.\d+)?|[a-z])(?:\s*\^\s*(?:-?\d+|[a-z]))?(?:\s*[a-z0-9.]+(?:\s*\^\s*(?:-?\d+|[a-z]))?)*/i;
  const FIRST = /^(?:\d+(?:\.\d+)?|[a-z])(?:\s*\^\s*(?:-?\d+|[a-z]))?/i;
  if (!FN.test(text)) return null;
  const build = pick => {
    let out = '', i = 0, changed = false;
    FN.lastIndex = 0;
    let m;
    while ((m = FN.exec(text))) {
      const start = m.index + m[0].length;
      const rest = text.slice(start);
      const run = (/^[0-9a-z.]/i.test(rest) ? (pick === 'first' ? FIRST : TERM).exec(rest) : null);
      if (!run) continue;
      out += text.slice(i, m.index) + m[1] + (m[2] || '') + '(' + run[0].trim() + ')';
      i = start + run[0].length; changed = true;
      FN.lastIndex = i;
    }
    return changed ? out + text.slice(i) : null;
  };
  const whole = build('whole'), first = build('first');
  if (!whole || !first || whole === first) return null;
  return [whole, first];
}

/**
 * Is this line PROVEN false under every plausible reading? (CTO ruling on the owner's rule "a true line is never crossed".)
 *
 * A bare line, or a "= …" continuation, in a derivative question has two readings: (a) it equals an expression written
 * above it, (b) it is the requested derivative. It is false only if it fails both: it is neither the derivative nor any
 * earlier plain line of the chain. A line "∫f dx = F" in an antiderivative question is a statement about the integral:
 * it is false when F′ is not f, whichever integrand f it is about (a true side integral is never crossed).
 * Anything unreadable, approximated, or about another letter is NOT proven: the caller abstains with a note.
 */
export function lineProvenFalse(line, ctx, previousTexts = []) {
  try {
    if (!ctx || !line || String(line).length > MAX_LINE_CHARS) return false;
    const v = ctx.variable;
    // A function written without brackets ("sin 6x + 6", "ln x + 1") has two readings of how far its argument runs: abstain.
    if (/\b(?:sin|cos|tan|sec|cosec|csc|cot|ln|log|exp|sqrt)\s+[^(\s]/i.test(String(line))) return false;
    // A line that names a function or its derivative (f(x) = …, f'(x) = …, g′ = …) is a definition of the method, not a claim.
    if (ctx.relation === 'antiderivative' && /^\s*(?:∴\s*)?[a-zA-Z]\s*(?:['′]\s*)?(?:\(\s*[a-z]\s*\))?\s*=/.test(String(line)) && !/^\s*[Fy]\s*(\(\s*[a-z]\s*\))?\s*=/.test(String(line))) return false;
    const allSegs = segmentsOf(line).filter(t => t !== '');
    const segs = allSegs.filter(t => !LABEL.test(t));
    if (!segs.length) return false;
    // A letter the question does not use is allowed only as a claim about something the chain has fixed: after a label (y′ =, dy/dx =)
    // or as a bare "= …" continuation. A new letter on the left of an equals sign (A = πr², V = ∫…, u = 2x + 1, let u = …) is a definition.
    const claim = allSegs.length > segs.length || /^\s*=/.test(String(line));
    const fresh = segs.some(t => { const a = tryParse(t.replace(/^let\s+/i, '')); return a && [...variablesOf(a)].some(l => l !== ctx.variable && l !== 'e'); });
    if ((fresh && !claim) || /^\s*let\b/i.test(String(line))) return false;
    // A derivative line written in the student's own u, v labels is a formula: abstain unless it is false after their own definitions.
    if (ctx.relation === 'derivative' && segs.some(t => FORMULA_LABEL.test(t))) return formulaProvenFalse(segs[segs.length - 1], ctx, previousTexts);
    const read = segs.map(t => readSegment(t, ctx));
    if (read.some(r => !r)) return false;
    if (ctx.relation === 'antiderivative') {
      // ∫g dx = F (= F2 …): each later segment must have g as its derivative.
      const first = read[0];
      if (read.length === 1 && first.kind === 'plain' && !first.approx.used) {
        // A bare or "= …" line: it is an antiderivative of the question's integrand, or of an integrand a line above names
        // (a side integral, or a factor pulled out: "(2x+3)^3 → …"), or it restates one of them or another line above.
        // It is false only if it is none of these. A line with no variable (a du factor, 1/6) claims no antiderivative.
        if (!variablesOf(first.plainAst || {}).has(v)) return false;
        const targets = [x => valueAt(ctx.given, x, v)];
        const restated = [];
        for (const prior of previousTexts) {
          const pieces = String(prior).split(/→|->/).flatMap(t => segmentsOf(t)).filter(t => t !== '' && !LABEL.test(t));
          for (const piece of pieces) {
            const r = readSegment(piece, ctx);
            if (!r) { if (/∫|\\int|d\s*\/\s*d|[uvw]\b/.test(piece)) continue; return false; }
            if (r.kind === 'operator' && r.parts[0].kind === 'integral') { const body = r.parts[0].body; targets.push(x => valueAt(body, x, v)); }
            else if (r.kind === 'plain') { const ast = r.plainAst; targets.push(x => valueAt(ast, x, v)); restated.push(x => valueAt(ast, x, v)); }
          }
        }
        if (read.length === 1 && segs.length === 1 && /^\s*[a-zA-Z]\s*(\(\s*[a-z]\s*\))?\s*=/.test(String(line)) && !/^\s*[Fy]\s*(\(\s*[a-z]\s*\))?\s*=/.test(String(line))) return false;   // "f(x) = …": a definition
        const q = x => valueAt(first.plainAst, x, v);
        return targets.every(t => !sameFunction(first.asFunction, t)) && restated.every(t => !sameFunction(q, t)) && (/^\s*=/.test(String(line)) || segmentsOf(line).some(t => LABEL.test(t)) || !sameFunction(q, x => valueAt(ctx.given, x, v)));   // "= f" after ∫f dx is false; "y = f" is a claim; a bare f only rewrites the integrand
      }
      // The FIRST line of the working that is a lone integral is the restated question: a different integrand is a mis-copy.
      if (read.length === 1 && first.kind === 'operator' && first.parts[0].kind === 'integral' && previousTexts.length === 0 && !/^\s*=/.test(String(line))) {
        return !sameFunction(x => valueAt(first.parts[0].body, x, v), x => valueAt(ctx.given, x, v));
      }
      if (read.length < 2 || first.kind !== 'operator' || first.parts[0].kind !== 'integral') return false;
      const g = x => valueAt(first.parts[0].body, x, v);
      for (const seg of read.slice(1)) {
        if (seg.kind !== 'plain' || seg.approx.used) return false;
        if (!sameFunction(seg.asFunction, g)) return true;
      }
      return false;
    }
    // Derivative question: a plain line, judged under both readings.
    const last = read[read.length - 1];
    if (last.kind !== 'plain' || last.approx.used || read.some(r => r.kind !== 'plain')) return false;
    const expected = ctx.canonical ? (x => valueAt(ctx.canonical, x, v)) : null;
    if (!expected) return false;
    if (sameFunction(last.asFunction, expected, 1e-7)) return false;               // reading (b): it is the derivative
    for (const prior of previousTexts) {                                            // reading (a): equal to a line above
      const ps = segmentsOf(prior).filter(t => t !== '' && !LABEL.test(t));
      if (!ps.length) return false;                                                 // an unreadable line above: not proven
      const pr = readSegment(ps[ps.length - 1], ctx);
      if (!pr) { if (!/∫|d\s*\/\s*d/.test(ps[ps.length - 1])) return false; continue; }
      if (pr.kind === 'plain' && sameFunction(last.asFunction, pr.asFunction)) return false;
    }
    const given = x => valueAt(ctx.given, x, v);
    if (sameFunction(last.asFunction, given)) return false;                          // equal to the question's own function
    return true;
  } catch { return false; }
}

/**
 * A line about another quantity than the one the question asks about (CTO ruling, review of f177f682a): a definition
 * ("let u = x^2 + 1", "A = pi r^2", "f(x) = x^3"), an assignment ("x = 2"), or the derivative of one letter with respect to
 * another that is not the asked derivative ("dy/du = 3u^2", "dA/dr = 2 pi r", "ds/dt = 3t^2"). Such a line is never held to the
 * answer. It is crossed only when it is a derivative of a letter the student defined on an earlier line and the engine proves it
 * false from that definition ("y = u^3" then "dy/du = 4u^2"); proven true is a note that says so. Null: not such a line.
 */
export function sideLine(line, ctx, previousTexts = []) {
  try {
    if (!ctx || !line) return null;
    const v = ctx.variable;
    const text = normalize(String(line)).replace(/^∴\s*/, '').replace(/^(so|hence|then|therefore)\s+/i, '').trim();
    const defNote = 'This defines something the method uses, so it is not checked against the answer.';
    if (/^let\b/i.test(text)) return { status: 'note', note: defNote };
    const dep = new Set(['y', 'F', ctx.dependent].filter(Boolean));
    // dN/dD = rhs
    const d = /^d\s*([A-Za-z])\s*\/\s*d\s*([A-Za-z])\s*=\s*(.+)$/.exec(text);
    if (d) {
      const [, N, D, rhs] = d;
      if (D === v && (dep.has(N))) return null;               // the asked derivative: judged as before
      const defs = [];
      for (const prior of previousTexts) {
        const m = new RegExp('^\\s*(?:let\\s+)?' + N + '\\s*=\\s*(.+)$', 'i').exec(normalize(String(prior)).replace(/^∴\s*/, ''));
        if (m && !/=/.test(m[1])) defs.push(m[1].trim());
      }
      const R = tryParse(rhs);
      for (const def of defs) {
        const E = tryParse(def);
        if (!E || !R) continue;
        const vars = new Set([...variablesOf(E), ...variablesOf(R)]);
        if ([...vars].some(l => l !== D && l !== 'e') || !vars.has(D)) continue;
        const cache = new WeakMap();
        const same = sameFunction(x => valueAt(R, x, D), x => derivativeAt(E, x, D, cache).value, 1e-6);
        const exact = derivativeAt(E, 1.3, D, cache).exact;
        return same ? { status: 'note', note: `True: it follows from ${N} = ${def}.` }
          : exact ? { status: 'break', note: `This does not follow from your own line ${N} = ${def}.` } : { status: 'note', note: defNote };
      }
      return { status: 'note', note: defNote };
    }
    // a letter (or letter(x)) = something, where the letter is not the question's own function or derivative: a definition or an assignment
    const a = /^([A-Za-z])\s*(?:\(\s*[A-Za-z]\s*\))?\s*=\s*(.+)$/.exec(text);
    if (a && !dep.has(a[1]) && !/=/.test(a[2].replace(/[<>≤≥!]=/g, ''))) return { status: 'note', note: defNote };
    return null;
  } catch { return null; }
}

/** Every diagnosis code this module can name, for the misconception ontology and its tests. */
export const CALCULUS_DIAGNOSIS_CODES = Object.freeze([
  'int-no-divide', 'int-divide-old-power', 'int-wrong-divisor', 'int-power-not-raised', 'int-constant-not-integrated',
  'int-differentiated', 'int-sign', 'int-linear-inner-not-divided', 'int-linear-inner-multiplied',
  'diff-no-multiply', 'diff-wrong-multiplier', 'diff-power-not-lowered', 'diff-constant-kept', 'diff-integrated', 'diff-sign', 'diff-chain-inner-missing',
  // not misconceptions: a counterexample against the line, named for the calculus question it came from
  'antiderivative-check', 'derivative-check'
]);
