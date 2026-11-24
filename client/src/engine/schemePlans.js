// Pri Learning · deterministic line checks for question types the step-mark schemes pay (server/platform/schemeAward.js)
//
// R4 (marking authority, step marks). A question of these forms has no authored step plan, so the marked page could not tick the line a
// criterion needs ("differentiates correctly", "integrates correctly"). This module derives that plan from what the QUESTION says (its prompt),
// never from the answer: the function to differentiate or integrate, the point, the limits. The only number taken from the key is checked,
// not trusted: a plan is returned only when the value the engine computes from the prompt agrees with the keyed answer, so a question whose
// prompt the module reads differently from its author gets no plan, and stays on the final answer.
//
//   gradient at a point   "find the gradient of y = f at x = a"          stages: derivative of f, its value at a
//   definite integral     "evaluate the integral of f from a to b" and "the area under y = f from a to b" (f >= 0 on [a, b])
//                                                                          stages: an antiderivative of f, the limits substituted
//   tangent / normal      "the equation of the tangent to y = f at x = a"  stages: derivative of f, its value at a
//
// Every stage only TICKS a line it can prove (the existing plan engine: checker.js stepCheckPlan, reason-area.js). A line it cannot read, or that is
// wrong, is a note, never a cross, so a true page is never crossed and a wrong line is never ticked. The plan carries `scheme`, a tag the scheme types
// pick on; nothing in it reaches a student (the key and the plan stay on the server: engine/publicQuestion.js).
//
// Pure and deterministic: no model, no network, no clock.
import { normalize, parse, evaluate, variablesOf } from './expr.js';
import { differentiateAst } from './reason-v2.js';
import { plainTex } from './checker.js';

const NAMED = /\\(sin|cos|tan|ln|log|exp)\b/g;
/** A KaTeX span as the engine's expression text; null when it has a command the engine cannot read. */
export function texExpr(tex) {
  const s = plainTex(String(tex ?? '').replace(NAMED, '$1').replace(/\\displaystyle|\\,|\\;|\\!/g, ' '));
  return s && !/\\/.test(s) ? s : null;
}

/** An expression tree written back as text the engine reads, every operation bracketed. */
export function astText(ast) {
  if (!ast) return null;
  switch (ast.t) {
    case 'num': return String(ast.v);
    case 'const': return String(ast.v);
    case 'var': return String(ast.v);
    case 'neg': { const v = astText(ast.v); return v === null ? null : `(-${v})`; }
    case 'group': return astText(ast.v);
    case 'bin': { const l = astText(ast.l), r = astText(ast.r); return l === null || r === null ? null : `(${l} ${ast.op} ${r})`; }
    case 'call': { if (!ast.arg) return null; const a = astText(ast.arg); return a === null ? null : `${ast.fn}(${a})`; }
    default: return null;
  }
}

const PREC = { '+': 1, '-': 1, '*': 2, '/': 2, '^': 4 };
/** The same tree with only the brackets it needs: what a student would write, and what a packet shows. */
export function prettyText(ast, parent = 0, right = false) {
  if (!ast) return null;
  const wrap = (txt, p) => (p < parent || (p === parent && right && parent !== 4) ? `(${txt})` : txt);
  switch (ast.t) {
    case 'num': return ast.v < 0 ? `(${ast.v})` : String(Math.round(ast.v * 1e9) / 1e9);
    case 'const': case 'var': return String(ast.v);
    case 'group': return prettyText(ast.v, parent, right);
    case 'neg': { const v = prettyText(ast.v, 3); return v === null ? null : wrap(`-${v}`, 2.5); }
    case 'call': { const a = prettyText(ast.arg, 0); return a === null ? null : `${ast.fn}(${a})`; }
    case 'bin': {
      const p = PREC[ast.op]; if (!p) return null;
      const l = prettyText(ast.l, ast.op === '^' ? 4.5 : p, false), r = prettyText(ast.r, ast.op === '^' ? 5 : p, true);
      return l === null || r === null ? null : wrap(`${l} ${ast.op === '^' || ast.op === '*' ? ast.op : ast.op}${ast.op === '^' ? '' : ' '}`.replace(/ \^$/, '^').replace(/ \*$/, ' *') + r, p);
    }
    default: return null;
  }
}
const parsed = text => { try { const a = parse(normalize(text)); return a.t === 'equation' ? null : a; } catch { return null; } };
const at = (ast, v, x) => { try { const y = evaluate(ast, { [v]: x }); return Number.isFinite(y) ? y : null; } catch { return null; } };
const closeTo = (a, b, rel = 1e-9) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= rel * Math.max(1, Math.abs(a), Math.abs(b));
const num = s => { const v = Number(String(s).replace(/\s+/g, '')); return Number.isFinite(v) ? v : null; };

/** The derivative of an expression of x as text, or null when the engine cannot differentiate it. */
export function derivativeText(source, variable = 'x') {
  const ast = parsed(source);
  if (!ast) return null;
  try { return astText(differentiateAst(ast, variable)); } catch { return null; }
}

/** Simpson's rule with many panels: the integral the engine itself computes from the integrand and the limits. */
export function integrate(ast, variable, lo, hi, n = 4000) {
  const h = (hi - lo) / n; let s = at(ast, variable, lo), t = at(ast, variable, hi);
  if (s === null || t === null) return null;
  s += t;
  for (let i = 1; i < n; i++) { const y = at(ast, variable, lo + i * h); if (y === null) return null; s += y * (i % 2 ? 4 : 2); }
  return (s * h) / 3;
}

const tolOf = payload => Math.max(Number(payload?.answer?.tol) || 0, 1e-9 * Math.max(1, Math.abs(Number(payload?.answer?.value))));
const keyValue = payload => (payload?.answerType === 'numeric' && Number.isFinite(Number(payload.answer?.value)) ? Number(payload.answer.value) : null);
const oneLine = prompt => String(prompt ?? '').replace(/\s+/g, ' ').trim();

// ── gradient at a point ──────────────────────────────────────────────────────────────────────────────────────────────────
const GRADIENT = [
  /gradient of (?:the curve )?\$y\s*=\s*([^$]+)\$ at the point where \$x\s*=\s*(-?[\d.]+)\$/i,
  /^If \$y\s*=\s*([^$]+)\$,? find (?:the gradient )?\$[^$]*\$ at \$x\s*=\s*(-?[\d.]+)\$/i
];
function gradientPlan(payload) {
  const key = keyValue(payload);
  if (key === null) return null;
  const prompt = oneLine(payload.prompt);
  let m = null;
  for (const re of GRADIENT) { m = re.exec(prompt); if (m) break; }
  if (!m) return null;
  const source = texExpr(m[1]); const x0 = num(m[2]);
  if (!source || x0 === null) return null;
  const deriv = derivativeText(source);
  const ast = deriv && parsed(deriv);
  if (!ast || [...variablesOf(ast)].some(v => v !== 'x')) return null;
  const value = at(ast, 'x', x0);
  if (value === null || Math.abs(value - key) > tolOf(payload)) return null;
  // A derivative that is zero everywhere (the function is a constant) leaves nothing to differentiate: "0 = 0" would be a true derivative line.
  if ([-1.7, 0.6, 2.3].every(t => Math.abs(at(ast, 'x', t) ?? 0) < 1e-12)) return null;
  return {
    kind: 'plan', scheme: 'gradient-at-point', creditPerStage: true,
    stages: [
      { kind: 'derivative', variable: 'x', source },
      { kind: 'evaluation', source: deriv, substitutions: { x: x0 }, expected: value, labels: ['m', 'gradient', 'dy/dx', 'y\''] }
    ]
  };
}

/** The plan a generated question of these forms is checked against, or null. `subtopicId` limits the forms read. */
export function schemePlanFor(payload, subtopicId) {
  if (!payload || payload.stepcheck) return null;
  try {
    if (subtopicId === 'y12-diff') return gradientPlan(payload);
  } catch { /* an unreadable prompt has no plan */ }
  return null;
}

/** Add a derived plan to a payload that carries none. The payload is returned unchanged when there is no plan. */
export function withSchemePlan(payload, subtopicId) {
  const plan = schemePlanFor(payload, subtopicId);
  return plan ? { ...payload, stepcheck: plan } : payload;
}
