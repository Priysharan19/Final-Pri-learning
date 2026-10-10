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

export const AREA_STAGE_KINDS = new Set(['area-limits', 'area-integrand', 'area-antiderivative', 'area-value']);

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
