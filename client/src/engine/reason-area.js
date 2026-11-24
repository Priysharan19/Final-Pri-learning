// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Pri Reason — area / definite-integral evidence stages
//
// A numeric "find the area" task has no equation to keep balanced, so the
// equation and expression verifiers cannot read its working. These stages let
// an authored proof plan recognise the four pieces of evidence an examiner
// credits in such a solution:
//
//   area-limits         the points where the region begins and ends
//   area-integrand      the function being integrated (upper minus lower)
//   area-antiderivative a function whose derivative is that integrand
//   area-value          the exact evaluated area
//
// Every stage is evidence-only: it either proves the line against the authored
// mathematics or abstains with a note. It never guesses from prose, never
// accepts an approximation, and never turns an unread line into credit. The
// stage metadata is server/engine-private and its notes never state the
// expected limits, integrand or value.
// ─────────────────────────────────────────────────────────────────────────────

import { normalize, parse, evaluate, numsClose, variablesOf } from './expr.js';

export const AREA_STAGE_KINDS = new Set(['area-limits', 'area-integrand', 'area-antiderivative', 'area-value', 'area-antiderivative-of', 'area-substituted']);

const SAMPLES = [-2.3, -0.9, 0.37, 1.3, 2.1, 3.7, 5.2];
const TOL = 1e-7;
const LABEL = /^(?:a|area|required\s+area|area\s+of\s+(?:the\s+)?region)$/i;
const BOUND = '(\\{[^{}]*\\}|-?[0-9./]+)';
const INTEGRAL = new RegExp(
  '^(?:∫|int(?![a-z]))\\s*(?:_\\s*' + BOUND + '\\s*\\^\\s*' + BOUND +
  '|\\[\\s*([^,\\]]+),\\s*([^\\]]+)\\]|from\\s+(\\S+)\\s+to\\s+(\\S+))?\\s*(.*)$', 'i');
const BRACKET = new RegExp('^\\[(.*)\\]\\s*(?:_\\s*' + BOUND + '\\s*\\^\\s*' + BOUND + ')?$');

const abstain = note => ({ status: 'note', trusted: false, note });
const UNREAD = 'Pri could not match this line to a step of the area calculation, so it earns no step credit.';

function cleanText(value) {
  return String(value ?? '')
    .trim()
    .replace(/[−–—]/g, '-')
    .replace(/\\int(?![a-zA-Z])/g, '∫')
    .replace(/\\(?:left|right|displaystyle|,|;|!)/g, '')
    .replace(/^∴\s*/, '')
    .replace(/^(so|hence|then|therefore)\s+/i, '')
    .split(/(?:=>|⇒|→)/).pop().trim();
}

function astFor(text) {
  try {
    const ast = parse(normalize(String(text).replace(/^\{|\}$/g, '')));
    return ast && ast.t !== 'equation' ? ast : null;
  } catch { return null; }
}

function numberOf(text) {
  const ast = astFor(text);
  if (!ast || variablesOf(ast).size) return null;
  try {
    const value = evaluate(ast, {});
    return Number.isFinite(value) ? value : null;
  } catch { return null; }
}

function boundsOf(lo, hi) {
  if (lo === undefined && hi === undefined) return null;
  const lower = numberOf(lo), upper = numberOf(hi);
  return lower === null || upper === null ? { unread: true } : { lower, upper };
}

/** Read one `=`-separated part of a line as the kind of mathematical object it is. */
function classify(raw, variable) {
  const text = String(raw).trim();
  if (!text) return { type: 'unknown' };
  if (LABEL.test(text)) return { type: 'label' };
  const integral = text.match(INTEGRAL);
  if (integral) {
    const bounds = boundsOf(integral[1] ?? integral[3] ?? integral[5], integral[2] ?? integral[4] ?? integral[6]);
    const body = String(integral[7] || '').replace(new RegExp('\\s*d\\s*' + variable + '\\s*$'), '').trim();
    const ast = astFor(body);
    if (!ast || bounds?.unread) return { type: 'unknown' };
    return { type: 'integral', ast, bounds };
  }
  const bracket = text.match(BRACKET);
  if (bracket) {
    const bounds = boundsOf(bracket[2], bracket[3]);
    const ast = astFor(bracket[1].replace(/\+\s*C\s*$/, ''));
    if (!ast || bounds?.unread) return { type: 'unknown' };
    return { type: 'bracket', ast, bounds };
  }
  const ast = astFor(text.replace(/\+\s*C\s*$/, ''));
  if (!ast) return { type: 'unknown' };
  if (!variablesOf(ast).size) {
    const value = numberOf(text);
    return value === null ? { type: 'unknown' } : { type: 'number', value };
  }
  return { type: 'expr', ast };
}

function partsOf(text, variable) {
  const clause = cleanText(text);
  if (!clause) return null;
  const parts = clause.split('=').map(part => classify(part, variable));
  return parts.some(part => part.type === 'unknown') ? null : parts;
}

function onlyVariable(ast, variable) {
  const free = variablesOf(ast);
  return free.size === 1 && free.has(variable);
}

function valueAt(ast, variable, x) {
  try {
    const value = evaluate(ast, { [variable]: x });
    return Number.isFinite(value) ? value : null;
  } catch { return null; }
}

/** The same function of the variable at every sample point. */
function sameFunction(ast, authored, variable) {
  if (!onlyVariable(ast, variable)) return false;
  return SAMPLES.every(x => {
    const a = valueAt(ast, variable, x), b = valueAt(authored, variable, x);
    return a !== null && b !== null && numsClose(a, b, TOL);
  });
}

/** Differs from the authored antiderivative by a constant only. */
function sameUpToConstant(ast, authored, variable) {
  if (!onlyVariable(ast, variable)) return false;
  let offset = null;
  return SAMPLES.every(x => {
    const a = valueAt(ast, variable, x), b = valueAt(authored, variable, x);
    if (a === null || b === null) return false;
    if (offset === null) { offset = a - b; return true; }
    return numsClose(a - b, offset, TOL);
  });
}

function boundsAgree(bounds, meta) {
  return numsClose(bounds.lower, Number(meta.lower), 1e-9) && numsClose(bounds.upper, Number(meta.upper), 1e-9);
}

function authoredAst(text, variable) {
  const ast = astFor(text);
  return ast && onlyVariable(ast, variable) ? ast : null;
}


// ── Step-mark stages (24 Nov 2026): an antiderivative of the integrand, and the limits substituted ─────────────────────────────────────
// `area-antiderivative-of` carries only the INTEGRAND (read from the question): a line is credited when a function on it differentiates, at
// every sample point where both are defined, to the integrand. It does not need the question's own antiderivative, so any correct
// antiderivative (any constant, any equivalent form, `F(x) = ...`, `∫ f dx = ...`, `[F]_a^b`) is accepted, and a function that is not one is a note.
// `area-substituted` is credited when a line has a number-only part that is a difference E1 - E2 of two number-only expressions equal to
// the expected value (the F(b) - F(a) the question comes to). It does not know F: the scheme layer holds the student's own antiderivative
// line against E1 and E2, so a bare difference of numbers that merely comes to the answer earns nothing there. Both stages only ever TICK
// or abstain: a wrong line is a note, never a cross, and nothing here reads the key.
const H = 1e-5;
const isLabelPart = (text, variable) => {
  const t = String(text).trim();
  if (!t) return true;
  const ast = astFor(t);
  if (!ast) return false;
  const free = [...variablesOf(ast)];
  // a name that is not the variable of integration is a label (F(x), y, A, I): the part names the function, it is not one
  return free.length > 0 && free.some(v => v !== variable) && !/[+\-*/^]/.test(t.replace(/^\s*-/, '').replace(/\(\s*[a-z]\s*\)/i, ''));
};
function derivativeMatches(F, f, variable) {
  let seen = 0;
  for (const x of [0.37, 0.9, 1.3, 2.1, 3.7, 5.2, -0.9, -2.3]) {
    const hi = valueAt(F, variable, x + H), lo = valueAt(F, variable, x - H), want = valueAt(f, variable, x);
    if (hi === null || lo === null || want === null) continue;
    seen++;
    if (!numsClose((hi - lo) / (2 * H), want, 1e-5)) return false;
  }
  return seen >= 4;
}
function assessAntiderivativeOf({ text, meta }) {
  const variable = meta.variable || 'x';
  const f = authoredAst(meta.integrand, variable);
  if (!f) return abstain('This integration stage is not configured safely.');
  const clause = cleanText(text);
  if (!clause || clause.length > 300) return abstain(UNREAD);
  const pieces = clause.split('=').map(part => part.trim()).filter(Boolean);
  const candidates = [];
  for (const piece of pieces) {
    const integral = piece.match(INTEGRAL);
    if (integral && /^(?:∫|int(?![a-z]))/i.test(piece)) {
      // `∫ f dx` on the line is the integral being integrated: it must be this question's integrand, with these limits if it has any
      const bounds = boundsOf(integral[1] ?? integral[3] ?? integral[5], integral[2] ?? integral[4] ?? integral[6]);
      const body = String(integral[7] || '').replace(new RegExp('\\s*d\\s*' + variable + '\\s*$'), '').trim();
      const ast = astFor(body);
      if (!ast || bounds?.unread || !sameFunction(ast, f, variable)) return abstain(UNREAD);
      if (bounds && !boundsAgree(bounds, meta)) return abstain('Pri could not verify the limits written on this integral.');
      continue;
    }
    const bracket = piece.match(BRACKET);
    if (bracket) {
      const bounds = boundsOf(bracket[2], bracket[3]);
      const ast = astFor(bracket[1].replace(/\+\s*C\s*$/, ''));
      if (!ast || bounds?.unread) return abstain(UNREAD);
      if (bounds && !boundsAgree(bounds, meta)) return abstain('Pri could not verify the limits written on this bracket.');
      candidates.push(ast);
      continue;
    }
    if (isLabelPart(piece, variable) || LABEL.test(piece)) continue;
    const ast = astFor(piece.replace(/\+\s*C\s*$/, ''));
    if (!ast) return abstain(UNREAD);
    if (!variablesOf(ast).size) continue;   // a number: a value, not an antiderivative
    if (!onlyVariable(ast, variable)) return abstain(UNREAD);
    candidates.push(ast);
  }
  if (!candidates.length) return abstain(UNREAD);
  if (!candidates.every(F => derivativeMatches(F, f, variable))) return abstain('Pri could not verify this as an antiderivative of the integrand.');
  return { status: 'ok', trusted: true };
}

const unwrap = ast => (ast && ast.t === 'group' ? unwrap(ast.v) : ast);
/** E1 - E2 as two trees when the expression is a subtraction at its top level, else null. */
export function topLevelDifference(ast) {
  const a = unwrap(ast);
  if (!a || a.t !== 'bin') return null;
  if (a.op === '-') return [a.l, a.r];
  if (a.op === '+' && unwrap(a.r)?.t === 'neg') return [a.l, unwrap(a.r).v];
  return null;
}
function assessSubstituted({ text, meta }) {
  const variable = meta.variable || 'x';
  const expected = Number(meta.expected);
  if (!Number.isFinite(expected)) return abstain('This substitution stage is not configured safely.');
  const clause = cleanText(text);
  if (!clause || clause.length > 300) return abstain(UNREAD);
  // A line is credited only when EVERY number-only part of it is the value (to the rounding a question may ask for): `243 - (-32) = 550` has a
  // difference that is right and a claim that is not, and is a note.
  let shown = false;
  for (const piece of clause.split('=').map(part => part.trim()).filter(Boolean)) {
    // An integral or a bracket on the line is judged by its limits, whatever it holds: this question's limits, or the line is not credited.
    const brk = piece.match(BRACKET);
    if (brk) { const b = boundsOf(brk[2], brk[3]); if (b && !b.unread && boundsAgree(b, meta)) continue; return abstain('Pri could not verify the limits written on this line.'); }
    const itg = piece.match(INTEGRAL);
    if (itg && /^(?:∫|int(?![a-z]))/i.test(piece)) { const b = boundsOf(itg[1] ?? itg[3] ?? itg[5], itg[2] ?? itg[4] ?? itg[6]); if (b && !b.unread && boundsAgree(b, meta)) continue; return abstain('Pri could not verify the limits written on this line.'); }
    const ast = astFor(piece);
    if (ast && variablesOf(ast).size) {
      // A part with a letter is judged, never skipped: it may only name the function (`F(x)`, `A`), or be exactly F(upper) - F(lower) for this
      // question's limits. `F(3) + F(1)` and `F(5) - F(1)` come to the same numbers as the right line and are not it.
      if (isLabelPart(piece, variable) || LABEL.test(piece)) continue;
      const fd = piece.replace(/\s+/g, '').match(/^([A-Za-z])\(([^()]+)\)-\(?([A-Za-z])\(([^()]+)\)\)?$/);
      if (fd && fd[1] === fd[3]) {
        const at = t => { const a = astFor(t); if (!a || variablesOf(a).size) return null; try { const v = evaluate(a, {}); return Number.isFinite(v) ? v : null; } catch { return null; } };
        const hi = at(fd[2]), lo = at(fd[4]);
        if (hi !== null && lo !== null && numsClose(hi, Number(meta.upper), 1e-9) && numsClose(lo, Number(meta.lower), 1e-9)) continue;
      }
      return abstain('Pri could not match this line to the limits substituted into an antiderivative.');
    }
    if (!ast) continue;
    let v = null; try { v = evaluate(ast, {}); } catch { v = null; }
    if (!Number.isFinite(v)) continue;
    if (!numsClose(v, expected, 1e-9) && Math.abs(v - expected) > 6e-4) return abstain('Pri could not match this line to the limits substituted into an antiderivative.');
    const parts = topLevelDifference(ast);
    if (!parts) continue;
    let e1 = null, e2 = null;
    try { e1 = evaluate(parts[0], {}); e2 = evaluate(parts[1], {}); } catch { continue; }
    if (Number.isFinite(e1) && Number.isFinite(e2) && numsClose(e1 - e2, expected, 1e-9)) shown = true;
  }
  if (shown) return { status: 'ok', trusted: true };
  return abstain('Pri could not match this line to the limits substituted into an antiderivative.');
}

function assessLimits({ text, meta, checkEquation }) {
  const variable = meta.variable || 'x';
  const values = (meta.values || []).map(Number);
  if (!values.length || !values.every(Number.isFinite) || typeof checkEquation !== 'function') {
    return abstain('This limits stage is not configured safely.');
  }
  const clause = cleanText(text).replace(/\s+and\s+/gi, ' or ');
  // Only a statement written purely in the variable of integration is a claim
  // about where the region begins and ends. `A = 49/2` or `y = 7x` is not.
  const pure = new RegExp('^(?:or|[' + variable + '0-9\\s=+\\-*/^().,])+$', 'i');
  if (!clause.includes('=') || !pure.test(clause) || !new RegExp(variable, 'i').test(clause)) return abstain(UNREAD);
  let ok = false;
  try { ok = checkEquation({ kind: 'equation', variable, solutions: values }, clause) === true; }
  catch { ok = false; }
  return ok ? { status: 'ok', trusted: true } : abstain('Pri could not verify these as the limits of the region.');
}

function assessIntegrand({ text, meta }) {
  const variable = meta.variable || 'x';
  const authored = authoredAst(meta.expr, variable);
  if (!authored) return abstain('This integrand stage is not configured safely.');
  const parts = partsOf(text, variable);
  if (!parts) return abstain(UNREAD);
  const integrals = parts.filter(part => part.type === 'integral');
  if (integrals.length) {
    if (!integrals.every(part => sameFunction(part.ast, authored, variable))) {
      return abstain('Pri could not verify this as the integrand for the region.');
    }
    if (integrals.some(part => part.bounds && !boundsAgree(part.bounds, meta))) {
      return abstain('Pri could not verify the limits written on this integral.');
    }
    if (meta.requireIntegral && !integrals.some(part => part.bounds)) {
      return abstain('Write the integral with its limits so Pri can verify the set-up.');
    }
    return { status: 'ok', trusted: true };
  }
  // The integrand written without an integral sign is evidence only when the
  // student had to construct it; where the prompt already states the function,
  // copying it out is not a step.
  if (meta.requireIntegral) return abstain(UNREAD);
  const exprs = parts.filter(part => part.type === 'expr');
  if (parts.some(part => part.type === 'bracket') || !exprs.length) return abstain(UNREAD);
  if (!exprs.every(part => sameFunction(part.ast, authored, variable))) {
    return abstain('Pri could not verify this as the integrand for the region.');
  }
  return { status: 'ok', trusted: true };
}

function assessAntiderivative({ text, meta }) {
  const variable = meta.variable || 'x';
  const authored = authoredAst(meta.antiderivative, variable);
  if (!authored) return abstain('This integration stage is not configured safely.');
  const parts = partsOf(text, variable);
  if (!parts) return abstain(UNREAD);
  const brackets = parts.filter(part => part.type === 'bracket');
  const candidates = brackets.length ? brackets : parts.filter(part => part.type === 'expr');
  if (!candidates.length) return abstain(UNREAD);
  if (!candidates.every(part => sameUpToConstant(part.ast, authored, variable))) {
    return abstain('Pri could not verify this as the integral of the integrand.');
  }
  if (brackets.some(part => part.bounds && !boundsAgree(part.bounds, meta))) {
    return abstain('Pri could not verify the limits written on this bracket.');
  }
  return { status: 'ok', trusted: true };
}

function assessValue({ text, meta }) {
  const expected = Number(meta.expected);
  if (!Number.isFinite(expected)) return abstain('This evaluation stage is not configured safely.');
  const parts = partsOf(text, meta.variable || 'x');
  if (!parts) return abstain(UNREAD);
  const numbers = parts.filter(part => part.type === 'number');
  if (!numbers.length || parts[parts.length - 1].type !== 'number') return abstain(UNREAD);
  // Exact only: a rounded decimal is not the evaluated area.
  if (!numbers.every(part => numsClose(part.value, expected, 1e-9))) {
    return abstain('Pri could not verify this as the evaluated area.');
  }
  return { status: 'ok', trusted: true, value: expected };
}

/**
 * Verify one line against one area stage. `checkEquation(meta, clause)` is the
 * caller's exact equation verifier (true only for a proven line); it is passed
 * in so this module does not import the checker that imports it.
 */
export function assessAreaLine({ text, meta = null, checkEquation = null } = {}) {
  if (!meta || !AREA_STAGE_KINDS.has(meta.kind)) return abstain('This area stage is not configured safely.');
  try {
    if (meta.kind === 'area-limits') return assessLimits({ text, meta, checkEquation });
    if (meta.kind === 'area-integrand') return assessIntegrand({ text, meta });
    if (meta.kind === 'area-antiderivative') return assessAntiderivative({ text, meta });
    if (meta.kind === 'area-antiderivative-of') return assessAntiderivativeOf({ text, meta });
    if (meta.kind === 'area-substituted') return assessSubstituted({ text, meta });
    return assessValue({ text, meta });
  } catch { return abstain(UNREAD); }
}

/**
 * The authored plan for "area = ∫ₐᵇ f(x) dx" tasks. The plan refuses to exist
 * unless its own pieces agree with each other: the antiderivative must
 * differentiate to the integrand and evaluate, between the limits, to the
 * keyed area. A question whose metadata is inconsistent gets no working
 * rubric at all rather than a wrong one.
 */
export function areaPlan({ variable = 'x', integrand, antiderivative, lower, upper, value, limits = null, integrandGiven = false } = {}) {
  const f = authoredAst(integrand, variable), F = authoredAst(antiderivative, variable);
  if (!f || !F || ![lower, upper, value].every(Number.isFinite)) return null;
  const h = 1e-5;
  const differentiates = SAMPLES.every(x => {
    const hi = valueAt(F, variable, x + h), lo = valueAt(F, variable, x - h), at = valueAt(f, variable, x);
    return hi !== null && lo !== null && at !== null && numsClose((hi - lo) / (2 * h), at, 1e-5);
  });
  const top = valueAt(F, variable, upper), bottom = valueAt(F, variable, lower);
  if (!differentiates || top === null || bottom === null || !numsClose(top - bottom, value, 1e-9)) return null;
  const stages = [];
  if (Array.isArray(limits) && limits.length) stages.push({ kind: 'area-limits', variable, values: limits, independent: true });
  stages.push({ kind: 'area-integrand', variable, expr: integrand, lower, upper, requireIntegral: integrandGiven, independent: true });
  const integrated = stages.length;
  stages.push({ kind: 'area-antiderivative', variable, antiderivative, lower, upper, independent: true });
  // A bare number is an answer claim, not a derivation: the evaluated area is
  // credited only once the integration that produces it has been verified.
  stages.push({ kind: 'area-value', variable, expected: value, requires: [integrated] });
  return { kind: 'plan', creditPerStage: true, stages };
}
