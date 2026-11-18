// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · line interpreter · the deterministic VERIFIER
//
// An interpreter says what a line CLAIMS. This module decides whether the claim
// is TRUE, and nothing an interpreter sends can move that decision except by
// naming a claim the verifier then checks for itself. The verdict is one of:
//
//   valid               the statement is true (and, for a quantity, is that
//                       quantity of the named given object, by this module's
//                       own computation)
//   given               it restates the question, or sets up what the question
//                       asks (a condition the prompt calls for)
//   first-break         the statement is false, proven by arithmetic or by the
//                       question's own function. ONLY a rule-interpreted claim
//                       may reach this verdict (a model's reading never can)
//   follows-from-error  a line consistent with the student's own earlier wrong
//                       line (the engine's error-carried-forward separation)
//   unverifiable        no verdict, with a reason the student can be shown
//
// A claim of any other shape, an unknown quantity, an unreadable expression, an
// ambiguous object, a domain restriction, a degrees/radians doubt, a rounded
// decimal: unverifiable. Nothing here awards a method mark.
// ─────────────────────────────────────────────────────────────────────────────
import { evaluate, exprEquivalent } from '../../../client/src/engine/expr.js';
import {
  parseSafe, freeVars, constantValue, makeFn, polynomial, degreeOf, polyRoots, extremes, periodOf,
  derivativeAt, ambiguousCall, maybeDegrees, degreesReading, plainArithmetic
} from './truth.js';
import { foldText } from './claims.js';

export const VERDICTS = Object.freeze(['valid', 'given', 'first-break', 'follows-from-error', 'unverifiable']);
export const TICKED = new Set(['valid', 'given']);

const U = (why, basis = null) => ({ verdict: 'unverifiable', why, basis });
const V = (basis, extra = {}) => ({ verdict: 'valid', why: null, basis, ...extra });
const BREAK = (why, basis, extra = {}) => ({ verdict: 'first-break', why, basis, ...extra });

// ── the student's own words for a quantity (closed lexicon, deterministic) ──
const LABEL_LEXICON = [
  ['maximum', /^(max|maximum|maximum value|max value|greatest value|largest value|max\.)$/],
  ['minimum', /^(min|minimum|minimum value|min value|least value|smallest value|min\.)$/],
  ['amplitude', /^(amplitude|amp)$/],
  ['period', /^(period)$/],
  ['midline', /^(midline|mid-line|mean level|centre line|equilibrium|equilibrium level|centre)$/],
  ['gradient', /^(gradient|slope)$/],
  ['y-intercept', /^(y-intercept|y intercept|yintercept|y-int)$/],
  ['x-intercept', /^(x-intercept|x intercept|xintercept|x-int|zero|zeros|roots?)$/],
  ['stationary-point-x', /^(stationary point|stationary points|turning point|turning points)$/],
  ['discriminant', /^(discriminant|delta)$/],
  ['answer', /^(ans|answer)$/],
  ['area', /^(area|a)$/], ['perimeter', /^(perimeter|p)$/], ['volume', /^(volume|v)$/], ['mean', /^(mean|average)$/], ['median', /^(median)$/]
];
const DERIVATIVE_LABEL = /^([a-z])'(?:\(([a-z])\))?$|^d([a-z])\/d([a-z])$|^derivative$/;

/** What a student's label word means, or null. The single letters (a, p, v) count only for the asked concept (see answerFacts). */
export function labelConcept(label) {
  const key = foldText(label).toLowerCase().replace(/\s+/g, ' ').trim().replace(/\s*-\s*/g, '-');
  if (DERIVATIVE_LABEL.test(key.replace(/\s/g, ''))) return 'derivative';
  for (const [q, re] of LABEL_LEXICON) if (re.test(key)) return q;
  return null;
}
const SINGLE_LETTER_CONCEPTS = new Set(['area', 'perimeter', 'volume']);

/** The name of the function whose derivative a label names (f'(x) -> f, dy/dx -> y), or ''. */
function derivativeSubject(label) {
  const key = foldText(label).toLowerCase().replace(/\s/g, '');
  let m = /^([a-z])'/.exec(key); if (m) return m[1];
  m = /^d([a-z])\/d[a-z]$/.exec(key); if (m) return m[1];
  return '';
}

// ── expression helpers ──────────────────────────────────────────────────────
function substituteVar(rhs, variable, arg) {
  return rhs.replace(new RegExp(`(?<![A-Za-z])${variable}(?![A-Za-z])`, 'g'), `(${arg})`);
}

/** Inline the given functions' calls: f(g(2)) -> the expression with their rules written in. */
export function expandGiven(text, functions) {
  let out = foldText(text);
  for (let pass = 0; pass < 6; pass++) {
    let changed = false;
    for (const g of functions) {
      const re = new RegExp(`(?<![A-Za-z])${g.name}\\s*\\(`, 'g');
      let m;
      while ((m = re.exec(out))) {
        let depth = 1, i = re.lastIndex;
        while (i < out.length && depth) { if (out[i] === '(') depth++; else if (out[i] === ')') depth--; i++; }
        if (depth) return null;
        const arg = out.slice(re.lastIndex, i - 1);
        // a call written with something that is not an expression (n(A ∪ B), P(A ∩ B)) is not an evaluation of the given rule
        if (!/^[0-9A-Za-z.\s+\-*/^()×÷√π²³]+$/.test(arg) || !parseSafe(arg)) return null;
        const body = `(${substituteVar(g.rhs, g.variable, arg)})`;
        out = out.slice(0, m.index) + body + out.slice(i);
        changed = true;
        break;
      }
    }
    if (!changed) break;
  }
  return out;
}

function equivalent(a, b) {
  try { return exprEquivalent(a, b) === true; } catch { return false; }
}

const decimalsOf = text => { const m = /^\s*-?\d*\.(\d+)\s*$/.exec(text); return m ? m[1].length : (/^\s*-?\d+\s*$/.test(text) ? 0 : null); };

/**
 * Compare a stated constant to a true value. exact | rounded (a stated decimal of
 * two or more places that rounds the truth) | near (a coarser stated number the
 * truth could round to: no verdict) | differs (provably not equal).
 */
export function compareValue(partText, truth) {
  const v = constantValue(partText);
  if (v === null) return { kind: 'unreadable' };
  if (Math.abs(v - truth) <= 1e-9 * Math.max(1, Math.abs(v), Math.abs(truth))) return { kind: 'exact', value: v };
  const d = decimalsOf(partText);
  if (d !== null) {
    const tol = 0.5 * 10 ** -d + 1e-12;
    if (Math.abs(v - truth) <= tol) return { kind: d >= 2 ? 'rounded' : 'near', value: v };
  } else if (/\d\.\d/.test(partText) && Math.abs(v - truth) <= 5e-3 * Math.max(1, Math.abs(truth)) * 0.1) {
    return { kind: 'near', value: v };
  }
  return { kind: 'differs', value: v };
}

// ── the verification context ────────────────────────────────────────────────
function pickFunction(ctx, name) {
  const fns = ctx.fns;
  if (name) {
    const f = fns.filter(g => g.name === name);
    return f.length === 1 ? f[0] : null;
  }
  return fns.length === 1 ? fns[0] : null;
}

function targetFor(ctx, expect) {
  if (expect?.kind === 'derivative-zero' || expect?.kind === 'function-zero') return expect;
  return null;
}

// ── claim verifiers ─────────────────────────────────────────────────────────
function verifyConstChain(parts, ctx, first) {
  // parts are all variable-free once the given functions are written in
  if (!parts.every(p => plainArithmetic(p))) return U('this is not plain arithmetic Pri reads one way', 'not-plain-arithmetic');
  const values = parts.map(p => constantValue(p));
  if (values.some(v => v === null)) return null;
  const truth = values[0];
  let worst = null;
  for (let i = 1; i < parts.length; i++) {
    const c = compareValue(parts[i], truth);
    if (c.kind === 'exact' || c.kind === 'rounded') continue;
    // an expression written first may be the one that is off: compare both ways
    if (c.kind === 'near') { worst = worst || U('a rounded value: not checked as an exact equality', 'rounded'); continue; }
    const back = compareValue(parts[0], constantValue(parts[i]));
    if (back.kind === 'exact' || back.kind === 'rounded') continue;
    const wrongAt = parts[i];
    if (degreesDoubt(parts, truth)) return U('trigonometry of a plain number may be in degrees or radians', 'degrees-or-radians');
    return BREAK(`${parts[0]} does not equal ${wrongAt}`, 'arithmetic', { at: first + i });
  }
  return worst || V('arithmetic');
}

/** Does reading a plain-number trig call in degrees make any of these parts equal the truth? Then the mismatch may be a unit, not a mistake. */
function degreesDoubt(parts, _truth) {
  if (!parts.some(p => degreesReading(p))) return false;
  // the parts agree with one another when every trig call on a plain number is read in degrees
  const vals = parts.map(p => constantValue(degreesReading(p) || p));
  if (vals.some(v => v === null)) return true;
  return vals.every(v => Math.abs(v - vals[0]) <= 1e-6 * Math.max(1, Math.abs(vals[0])));
}

function derivativeMatches(fn, exprText) {
  const ast = parseSafe(exprText);
  if (!ast) return null;
  if (freeVars(ast).some(v => v !== fn.variable)) return null;
  const xs = [-1.7, -0.6, 0.45, 1.3, 2.2, 3.1, 4.6];
  let compared = 0;
  for (const x of xs) {
    const d = derivativeAt(fn, x);
    if (d === null) continue;
    let v;
    try { v = evaluate(ast, { [fn.variable]: x }); } catch { continue; }
    if (!Number.isFinite(v)) continue;
    compared++;
    if (Math.abs(v - d) > 1e-5 * Math.max(1, Math.abs(d))) return false;
  }
  return compared >= 4 ? true : null;
}

function quantityTruth(ctx, claim, fn) {
  const q = claim.quantity;
  const co = polynomial(fn);
  const ex = (q === 'maximum' || q === 'minimum' || q === 'amplitude' || q === 'midline' || q === 'period') ? extremes(fn) : null;
  if (ex?.period && ctx.restricted && !ctx.coversPeriod(ex.period)) return { why: 'the question restricts the domain, so the greatest value there is not the maximum of the whole curve' };
  switch (q) {
    case 'maximum': return ex && ex.max !== null && ex.max !== undefined ? (ctx.restricted && !ex.period ? { why: 'the question restricts the domain' } : { value: ex.max }) : { why: 'no maximum proved for this function' };
    case 'minimum': return ex && ex.min !== null && ex.min !== undefined ? (ctx.restricted && !ex.period ? { why: 'the question restricts the domain' } : { value: ex.min }) : { why: 'no minimum proved for this function' };
    case 'amplitude': return ex?.period ? { value: (ex.max - ex.min) / 2 } : { why: 'amplitude is only checked for a sinusoid' };
    case 'midline': return ex?.period ? { value: (ex.max + ex.min) / 2 } : { why: 'midline is only checked for a sinusoid' };
    case 'period': { const P = periodOf(fn); return P ? { value: P } : { why: 'no period proved for this function' }; }
    case 'gradient':
      if (claim.at) { const a = constantValue(claim.at); const d = a === null ? null : derivativeAt(fn, a); return d === null ? { why: 'gradient at that point could not be computed' } : { value: d }; }
      return co && degreeOf(co) === 1 ? { value: co[1] } : { why: 'gradient of a curve needs a point' };
    case 'y-intercept': { const y = fn.f(0); return Number.isFinite(y) ? { value: y } : { why: 'not defined at 0' }; }
    case 'discriminant': return co && degreeOf(co) === 2 ? { value: co[1] * co[1] - 4 * co[2] * co[0] } : { why: 'discriminant is only checked for a quadratic' };
    default: return { why: `${q} is not checked against this question` };
  }
}

/** A part with spacing and a leading connective removed, for comparing it with the whole line. */
const compact = text => foldText(text).replace(/^(?:\s*(?:so|hence|therefore|thus|then|now|and)\b[,:]?|\s*[\u2234\u2235])+/i, '').replace(/\s+/g, '');

function lastOf(parts) { return parts[parts.length - 1]; }

function verifyQuantity(claim, ctx, first) {
  const concept = labelConcept(claim.label);
  if (!concept) return U('the label is not one Pri checks', 'label');
  if (concept !== claim.quantity && !(claim.quantity === 'derivative' && concept === 'derivative')) return U('the label does not name that quantity', 'label-mismatch');
  const parts = claim.parts;
  // ── the derivative: a variable expression, compared with the true derivative of the named function
  if (concept === 'derivative') {
    const fn = pickFunction(ctx, derivativeSubject(claim.label));
    if (!fn) return U('the question gives no single function to differentiate', 'object');
    // the first expression is the derivative; a later part may be that derivative worked at a point
    const e = expandGiven(parts[0], ctx.fns.filter(g => g !== fn));
    // a plain number after "y' =" is the gradient at some point, not the derivative function
    if (e !== null && parseSafe(e) && !freeVars(parseSafe(e)).length) return U('a number here is the gradient at a point, which this line does not say', 'derivative-at-a-point');
    const ok = e === null ? null : derivativeMatches(fn, e);
    if (ok === null) return U('this expression could not be compared with the derivative', 'derivative');
    if (!ok) return BREAK(`${parts[0]} is not the derivative of ${fn.name}(${fn.variable})`, 'derivative', { at: first });
    for (const p of parts.slice(1)) {
      const pe = expandGiven(p, ctx.fns);
      if (pe === null || !parseSafe(pe) || !freeVars(parseSafe(pe)).length || !equivalent(pe, e)) return U('only the derivative itself is checked, not a value worked from it', 'derivative-chain');
    }
    return V('derivative');
  }
  // ── a computed quantity of one given object
  const fn = pickFunction(ctx, claim.subject && /^[A-Za-z]$/.test(claim.subject) ? claim.subject : '');
  if (fn) {
    const truth = quantityTruth(ctx, { ...claim, quantity: concept }, fn);
    if (truth.value === undefined) return U(truth.why, 'no-truth');
    ctx.currentFn = fn;
    return judgeAgainst(parts, truth.value, first, 'quantity', ctx);
  }
  // ── no function: the asked quantity, from the question's answer (ticks only)
  return answerQuantity(claim, concept, parts, ctx);
}

function locationDoubt(ctx, stated, truth) {
  if (!Number.isFinite(stated) || !ctx.currentFn) return false;
  const y = ctx.currentFn.f(stated);
  return Number.isFinite(y) && Math.abs(y - truth) <= 1e-6 * Math.max(1, Math.abs(truth));
}

function judgeAgainst(parts, truth, first, basis, ctx) {
  const rounded = [];
  for (let i = 0; i < parts.length; i++) {
    const text = expandGiven(parts[i], ctx.fns) ?? parts[i];
    if (ambiguousCall(text)) return U('a function name without brackets can be read two ways', 'ambiguous');
    if (!plainArithmetic(text)) return U('this is not plain arithmetic Pri reads one way', 'not-plain-arithmetic');
    const c = compareValue(text, truth);
    if (c.kind === 'unreadable') return U('this expression could not be evaluated', 'unreadable');
    if (c.kind === 'exact') continue;
    if (c.kind === 'rounded') { rounded.push(i); continue; }
    if (c.kind === 'near') return U('a rounded value: not checked as an exact equality', 'rounded');
    if (degreesDoubt([text, String(truth)], truth)) return U('trigonometry of a plain number may be in degrees or radians', 'degrees-or-radians');
    // "max = 4" may name WHERE the maximum is (t = 4), not its value: when the stated number is a
    // place at which the function takes the true value, the line is not crossed
    if (locationDoubt(ctx, c.value, truth)) return U('this number is where the greatest or least value occurs, which may be what the line means', 'location-or-value');
    return BREAK(`${parts[i]} is not the ${basis}`, basis, { at: first + i, expected: truth });
  }
  return V(basis, { rounded: rounded.length > 0 });
}

function answerQuantity(claim, concept, parts, ctx) {
  const a = ctx.answer;
  if (!a || !['answer', 'area', 'perimeter', 'volume', 'mean', 'median', 'maximum', 'minimum', 'gradient', 'y-intercept', 'period', 'amplitude'].includes(concept)) return U('no object to check this against', 'object');
  if (concept === 'answer') { if (!ctx.isLast) return U('only the last line is compared with the answer', 'not-last'); }
  else if (!ctx.description.asked.includes(concept)) return U('this is not the quantity the question asks for', 'not-asked');
  // a tick only: equal to the issued answer. A different value is never a cross (it may be a part of the question).
  const last = lastOf(parts);
  const value = constantValue(last);
  if (value === null || a.kind !== 'numeric') return U('no value to compare', 'answer');
  const c = compareValue(last, a.value);
  return (c.kind === 'exact' || c.kind === 'rounded') ? V('asked-quantity-equals-answer') : U('the line is not the final answer, and the question gives no function to check a part against', 'answer');
}

/** An equation in one unknown as polynomial coefficients and its real roots, or null (degree 1 to 4 only). */
export function equationPoly(l, r, fns = []) {
  const el = expandGiven(l, fns), er = expandGiven(r, fns);
  if (el === null || er === null || ambiguousCall(el) || ambiguousCall(er)) return null;
  const letters = new Set(`${el} ${er}`.replace(/\b(?:sin|cos|tan|ln|log|exp|sqrt)\b/g, '').match(/(?<![A-Za-z])[A-Za-z](?![A-Za-z])/g) || []);
  if (letters.size !== 1 || /[A-Za-z]{2,}/.test(`${el} ${er}`.replace(/\b(?:sin|cos|tan|ln|log|exp|sqrt)\b/g, ''))) return null;
  const variable = [...letters][0];
  const fn = makeFn({ name: 'E', variable, rhs: `(${el}) - (${er})` });
  if (!fn) return null;
  const co = polynomial(fn);
  if (!co || degreeOf(co) < 1) return null;
  const roots = polyRoots(co);
  return roots && roots.length ? { variable, co, roots } : null;
}
const sameRoots = (a, b) => a.length === b.length && a.every((x, i) => Math.abs(x - b[i]) <= 1e-6 * Math.max(1, Math.abs(x)));

function verifyEquation(claim, ctx, first, prev) {
  const parts = claim.parts;
  // one side alone asserts nothing: an equation needs both sides, or there is nothing to be true
  if (parts.length < 2) return U('a single expression is not an equation', 'one-sided');
  // solution asserted for the question's one equation ("x = 4")
  const expanded = parts.map(p => expandGiven(p, ctx.fns));
  if (expanded.some(p => p === null)) return U('a function call could not be read', 'expand');
  if (expanded.some(p => ambiguousCall(p))) return U('a function name without brackets can be read two ways', 'ambiguous');
  // the line restates a given: a function's rule, or the question's own equation
  const body = parts.length === 2 ? parts : null;
  if (body) {
    const [l, r] = body;
    const g = ctx.fns.find(f => new RegExp(`^${f.name}\\s*\\(\\s*${f.variable}\\s*\\)$`).test(l.trim()) || (f.implicit && l.trim() === f.name));
    if (g) {
      if (equivalent(r, g.rhs)) return { verdict: 'given', why: null, basis: 'restates-the-question' };
      return U('this line may be solving or rearranging, not restating', 'function-rule');
    }
    for (const e of ctx.description.equations) if ((equivalent(l, e.lhs) && equivalent(r, e.rhs)) || (equivalent(l, e.rhs) && equivalent(r, e.lhs))) return { verdict: 'given', why: null, basis: 'restates-the-question' };
  }
  // a zero condition awaiting its expression ("Let y' = 0" then "3x^2 + 6x = 0")
  const t = targetFor(ctx, prev.expect);
  if (t && parts.length === 2 && constantValue(parts[1]) === 0 && freeVars(parseSafe(parts[0]) || { t: 'num' }).length) {
    const e = expanded[0];
    const ok = t.kind === 'derivative-zero' ? derivativeMatches(t.fn, e) : (equivalent(e, expandGiven(`${t.fn.name}(${t.fn.variable})`, [t.fn])));
    if (ok === true) return V(t.kind === 'derivative-zero' ? 'derivative-set-to-zero' : 'function-set-to-zero', { carry: { expect: t } });
    if (ok === false) return BREAK(`${parts[0]} is not the ${t.kind === 'derivative-zero' ? 'derivative' : 'function'} set to zero`, 'condition', { at: first });
    return U('could not be compared with the condition set above', 'condition');
  }
  // arithmetic: every part is a number once the given functions are written in
  const allConst = expanded.every(p => freeVars(parseSafe(p) || { t: 'num' }).length === 0 && parseSafe(p));
  if (allConst) return verifyConstChain(expanded, ctx, first) || U('this expression could not be evaluated', 'unreadable');
  // an identity: every part is the same expression
  if (expanded.every(p => parseSafe(p))) {
    if (expanded.slice(1).every(p => equivalent(p, expanded[0]))) return V('identity');
    // a step that keeps the equation's solutions: same real roots as the line above (or the question's own equation)
    if (parts.length === 2) {
      const here = equationPoly(parts[0], parts[1], ctx.fns);
      const before = prev.eq || (ctx.description.equations.length === 1 ? equationPoly(ctx.description.equations[0].lhs, ctx.description.equations[0].rhs, []) : null);
      if (here && before && here.variable === before.variable && sameRoots(here.roots, before.roots)) return prev.broken ? { verdict: 'follows-from-error', why: 'consistent with an earlier wrong line', basis: 'same-solutions' } : V('same-solutions');
      if (here && before && here.variable === before.variable) return U('this equation has different solutions from the one above: a step may have lost or added one', 'solutions-differ');
    }
    return U('this is an equation about the unknown, or a rearrangement Pri cannot confirm', 'conditional-equation');
  }
  return U('this line could not be read as mathematics', 'unreadable');
}

function verifyContinues(claim, ctx, first, prev) {
  if (!prev || !prev.lastPart) return U('there is no line above to continue', 'no-previous');
  const parts = [prev.lastPart, ...claim.parts];
  const exp = parts.map(p => expandGiven(p, ctx.fns));
  if (exp.some(p => p === null || ambiguousCall(p))) return U('a function call could not be read', 'expand');
  const consts = exp.map(p => constantValue(p));
  const arith = consts.every(v => v !== null);
  let own;
  if (arith) own = verifyConstChain(exp, ctx, first - 1);
  else if (exp.every(p => parseSafe(p))) own = exp.slice(1).every(p => equivalent(p, exp[0])) ? V('identity') : U('does not match the line above as the same expression', 'not-identity');
  else own = U('could not be read', 'unreadable');
  if (own.verdict === 'first-break') {
    // That a line starting with "=" continues the line above is itself a reading: it may restate
    // an earlier line, or follow a step the student did not write. A disagreement with the line
    // above is therefore never crossed; it is shown as "couldn't verify".
    return U('does not match the line above; it may continue an earlier step', 'continuation-mismatch');
  }
  if (own.verdict !== 'valid') return own;
  // an equal continuation is only as good as the line it continues
  if (prev.verdict === 'valid' || prev.verdict === 'given') return V('continuation');
  if (prev.verdict === 'first-break' || prev.verdict === 'follows-from-error') return { verdict: 'follows-from-error', why: 'consistent with the line above, which was wrong', basis: 'continuation' };
  return U('depends on the line above, which could not be verified', 'depends-on-previous');
}

function verifyCondition(claim, ctx) {
  const [lhs, rhs] = claim.parts.length === 2 ? claim.parts : [claim.subject || claim.label, claim.parts[0]];
  const zero = constantValue(rhs) === 0;
  if (!zero || !lhs) return U('a condition other than "= 0" is not checked', 'condition');
  const concept = labelConcept(lhs);
  if (concept === 'derivative') {
    const fn = pickFunction(ctx, derivativeSubject(lhs));
    const wants = ctx.description.cues.some(c => ['stationary', 'maximum', 'minimum'].includes(c));
    if (!fn || !wants) return U('the question does not ask for stationary points, so Pri cannot say this is the step to take', 'condition-not-called-for');
    return { verdict: 'given', why: null, basis: 'condition-called-for', carry: { expect: { kind: 'derivative-zero', fn } } };
  }
  const fn = pickFunction(ctx, /^[A-Za-z]$/.test(lhs.trim()) ? lhs.trim() : (/^([A-Za-z])\s*\(\s*[A-Za-z]\s*\)$/.exec(lhs.trim()) || [])[1] || '');
  const wants = ctx.description.cues.some(c => ['x-intercept'].includes(c)) || /\bsolve\b|\bzero|\broot|intercept/i.test(ctx.description.prompt);
  if (fn && wants) return { verdict: 'given', why: null, basis: 'condition-called-for', carry: { expect: { kind: 'function-zero', fn } } };
  return U('the question does not call for this condition', 'condition-not-called-for');
}

function rootsOf(ctx, prev, claim) {
  const t = targetFor(ctx, prev.expect);
  if (t) {
    if (t.kind === 'function-zero') { const co = polynomial(t.fn); return co ? { co, label: 'the function set to zero' } : null; }
    const co = polynomial(t.fn);
    if (!co) return null;
    return { co: co.slice(1).map((c, i) => c * (i + 1)), label: 'the derivative set to zero' };
  }
  const eqs = ctx.description.equations;
  if (eqs.length === 1 && !ctx.fns.length) {
    const e = eqs[0];
    const syn = makeFn({ name: 'E', variable: [...new Set((`${e.lhs} ${e.rhs}`.match(/(?<![A-Za-z])[A-Za-z](?![A-Za-z])/g) || []))][0] || 'x', rhs: `(${e.lhs}) - (${e.rhs})` });
    const co = syn ? polynomial(syn) : null;
    const letters = new Set(`${e.lhs} ${e.rhs}`.replace(/\b(?:sin|cos|tan|ln|log|exp|sqrt)\b/g, '').match(/(?<![A-Za-z])[A-Za-z](?![A-Za-z])/g) || []);
    if (!co || letters.size !== 1 || !letters.has(claim.subject)) return null;
    return { co, label: 'the equation', variable: syn.variable, lone: true };
  }
  return null;
}

function verifySolutionSet(claim, ctx, prev) {
  if (ctx.restricted) return U('the question restricts the values allowed, so Pri does not check the set', 'domain');
  const spec = rootsOf(ctx, prev, claim);
  if (!spec) return U('no equation to substitute these values into', 'no-target');
  const P = x => spec.co.reduce((acc, c, i) => acc + c * x ** i, 0);
  const scale = Math.max(1, ...spec.co.map(Math.abs));
  const values = claim.parts.map(p => constantValue(p));
  if (values.some(v => v === null)) return U('a value in this set could not be read', 'unreadable');
  for (let i = 0; i < values.length; i++) {
    if (Math.abs(P(values[i])) > 1e-7 * scale * Math.max(1, Math.abs(values[i]) ** degreeOf(spec.co))) {
      // "x = 3" may be a substitution or a step, not a solution of the question's equation: only a
      // condition the student set up above (Let y' = 0) makes it a claim that can be crossed.
      if (spec.lone) return U(`${claim.parts[i]} does not satisfy the question's equation, but this line may not be offered as its solution`, 'not-a-root');
      return BREAK(`${claim.parts[i]} does not satisfy ${spec.label}`, 'solution', { at: 0 });
    }
  }
  if (values.length === 1) return V('root');
  const roots = polyRoots(spec.co);
  if (!roots) return U('could not list every root to compare the set', 'roots');
  const same = roots.length === new Set(values.map(v => Math.round(v * 1e9))).size && roots.every(r => values.some(v => Math.abs(v - r) < 1e-6));
  return same ? V('solution-set') : U('each value is a root, but Pri cannot confirm the set is complete', 'incomplete');
}

/** The verdict of one claim. */
export function verifyClaim(claim, ctx, index, prev) {
  try {
    switch (claim.kind) {
      case 'prose': return U('no mathematical claim on this line', 'prose');
      case 'unparseable': return U('Pri could not read this line as a mathematical claim', claim.reason || 'unparseable');
      case 'restates-given':
      case 'expression': {
        const e = expandGiven(claim.parts[claim.parts.length - 1], ctx.fns);
        if (e === null || ambiguousCall(e)) return U('a function call could not be read', 'expand');
        const given = ctx.fns.some(f => equivalent(e, f.rhs)) || ctx.description.equations.some(q => equivalent(e, q.lhs) || equivalent(e, q.rhs));
        if (given && freeVars(parseSafe(e) || { t: 'num' }).length) return { verdict: 'given', why: null, basis: 'restates-the-question' };
        // a bare value ties to the answer only when the WHOLE line is that value (no label, no "=")
        if (ctx.isLast && ctx.answer?.kind === 'numeric' && claim.parts.length === 1 && !claim.label && !claim.subject && !claim.at && ctx.bareLine === compact(claim.parts[0])) {
          const c = compareValue(e, ctx.answer.value);
          if (c.kind === 'exact' || c.kind === 'rounded') return V('final-value-equals-answer');
        }
        return U('a bare expression is not a claim Pri can check', 'bare-expression');
      }
      case 'equation': return verifyEquation(claim, ctx, 0, prev);
      case 'evaluates': {
        const fn = claim.subject && pickFunction(ctx, claim.subject.replace(/\(.*/, ''));
        if (!fn || !claim.at) return U('the function is not one the question gives', 'object');
        return verifyEquation({ ...claim, parts: [`${fn.name}(${claim.at})`, ...claim.parts] }, ctx, 0, prev);
      }
      case 'continues': return verifyContinues(claim, ctx, 1, prev);
      case 'quantity': return verifyQuantity(claim, ctx, 0);
      case 'condition': return verifyCondition(claim, ctx);
      case 'solution-set': return verifySolutionSet(claim, ctx, prev);
      case 'defines': return U('a definition is a choice of notation, not a claim', 'definition');
      default: return U('unknown claim', 'unknown');
    }
  } catch {
    return U('this line could not be checked', 'error');
  }
}

/**
 * Verdicts for a whole transcript. `items[i] = { claim, source }`. `facts` is the
 * server's own knowledge of the question: `answer` ({kind:'numeric', value}) is
 * used for ticks of the asked quantity only and is never sent to an interpreter.
 */
export function verifyLines(items, description, facts = {}) {
  const fns = description.functions.map(makeFn).filter(Boolean);
  const bounds = restrictedBounds(description);
  const ctx = {
    description, fns, answer: facts.answer || null, restricted: description.restricted,
    coversPeriod: P => !!bounds && (bounds.hi - bounds.lo) >= P - 1e-9, isLast: false
  };
  const out = [];
  let prev = { verdict: null, lastPart: null, broken: false, expect: null };
  items.forEach((item, i) => {
    ctx.isLast = i === items.length - 1;
    ctx.bareLine = typeof item.text === 'string' ? compact(item.text) : null;
    const claim = item.claim;
    let r = verifyClaim(claim, ctx, i, prev);
    // The interpretation's source decides what it may do. Only a rule reading may cross a line.
    if (r.verdict === 'first-break' && item.source !== 'rule') r = U('Pri read this line with a model and cannot mark it wrong; it is not confirmed', 'model-reading-cannot-cross');
    // First break only once: a later contradiction is judged against the student's own work.
    if (r.verdict === 'first-break' && prev.broken) r = { verdict: 'follows-from-error', why: 'a later line after the first wrong one', basis: r.basis };
    const carry = r.carry || null;
    if (r.verdict === 'first-break') prev.broken = true;
    const lastPart = ['equation', 'continues', 'quantity', 'evaluates', 'expression', 'restates-given', 'defines', 'solution-set'].includes(claim.kind) && claim.parts.length
      ? lastOf(claim.parts) : prev.lastPart;
    let eq = prev.eq;
    if (claim.kind === 'equation' && claim.parts.length === 2) eq = equationPoly(claim.parts[0], claim.parts[1], ctx.fns) || eq;
    prev = { verdict: r.verdict, kind: claim.kind, eq, lastPart, broken: prev.broken, expect: carry?.expect ?? (['prose', 'unparseable'].includes(claim.kind) ? prev.expect : (r.verdict === 'given' || r.verdict === 'valid') && claim.kind === 'solution-set' ? null : prev.expect) };
    const { carry: _c, ...rest } = r;
    out.push({ index: i, source: item.source, kind: claim.kind, ...rest });
  });
  return out;
}

function restrictedBounds(description) {
  for (const text of description.inequalities) {
    const m = /(-?[\d.]+)\s*[≤<]\s*[A-Za-zθ]\s*[≤<]\s*(-?[\d.]+)/.exec(foldText(text));
    if (m) return { lo: Number(m[1]), hi: Number(m[2]) };
  }
  return null;
}
