// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Pri Reason — conservative equation-transformation verifier
//
// Step Check knows the canonical solution(s) to many generated questions, but
// solution survival alone does not prove a transformation is reversible. Pri
// Reason therefore has three outcomes:
//   ok    — positively verified;
//   break — positively disproved;
//   note  — insufficient evidence, so Pri abstains.
//
// The central rule is precision first: no finite set of numerical probe points
// is allowed to certify an equation transformation as correct.
// ─────────────────────────────────────────────────────────────────────────────

import { parse, evaluate, numsClose } from './expr.js';

const SAMPLE = [0.73, 1.31, -0.64, 2.17, -1.72, 0.37, 3.08, -2.29, 4.61, -4.13];
const EPS = 1e-7;
const MAX_PROOF_DEGREE = 12;

const residual = eq => ({ t: 'bin', op: '-', l: eq.l, r: eq.r });

function equationHoldsAt(eq, variable, value) {
  try {
    const env = { [variable]: value };
    const l = evaluate(eq.l, env);
    const r = evaluate(eq.r, env);
    return Number.isFinite(l) && Number.isFinite(r)
      && Math.abs(l - r) <= Math.max(1e-6, Math.abs(l), Math.abs(r)) * 1e-6;
  } catch { return false; }
}

// ── Deterministic polynomial proof ───────────────────────────────────────────
// Equation residuals are reduced to coefficient vectors in one variable. This
// proves ordinary school-algebra rearrangements without trusting sampled values.
// Unsupported/non-polynomial forms simply return null and therefore abstain.

function constantNumber(node) {
  try {
    const v = evaluate(node, {});
    return Number.isFinite(v) ? v : null;
  } catch { return null; }
}

function trimPoly(poly) {
  if (!poly) return null;
  const out = poly.slice();
  while (out.length > 1 && Math.abs(out[out.length - 1]) <= EPS) out.pop();
  for (let i = 0; i < out.length; i++) if (Math.abs(out[i]) <= EPS) out[i] = 0;
  return out;
}

function addPoly(a, b, sign = 1) {
  if (!a || !b) return null;
  const n = Math.max(a.length, b.length);
  if (n > MAX_PROOF_DEGREE + 1) return null;
  const out = new Array(n).fill(0);
  for (let i = 0; i < n; i++) out[i] = (a[i] || 0) + sign * (b[i] || 0);
  return trimPoly(out);
}

function scalePoly(a, scalar) {
  if (!a || !Number.isFinite(scalar)) return null;
  return trimPoly(a.map(v => v * scalar));
}

function mulPoly(a, b) {
  if (!a || !b || a.length + b.length - 2 > MAX_PROOF_DEGREE) return null;
  const out = new Array(a.length + b.length - 1).fill(0);
  for (let i = 0; i < a.length; i++) {
    for (let j = 0; j < b.length; j++) out[i + j] += a[i] * b[j];
  }
  return trimPoly(out);
}

function powPoly(base, exponent) {
  if (!base || !Number.isInteger(exponent) || exponent < 0 || exponent > MAX_PROOF_DEGREE) return null;
  let out = [1];
  let factor = base;
  let n = exponent;
  while (n > 0) {
    if (n & 1) {
      out = mulPoly(out, factor);
      if (!out) return null;
    }
    n >>= 1;
    if (n) {
      factor = mulPoly(factor, factor);
      if (!factor) return null;
    }
  }
  return trimPoly(out);
}

function polynomialCoefficients(node, variable) {
  if (!node || typeof node !== 'object') return null;

  if (node.t === 'num') return [node.v];
  if (node.t === 'group') return polynomialCoefficients(node.v, variable);
  if (node.t === 'neg') return scalePoly(polynomialCoefficients(node.v, variable), -1);

  if (node.t === 'var' || node.t === 'const') {
    if (node.v === variable) return [0, 1];
    const c = constantNumber(node);
    return c === null ? null : [c];
  }

  // Calls such as sqrt(2) are allowed as scalar coefficients only when they are
  // genuinely variable-free. Calls involving the equation variable abstain.
  if (node.t === 'call') {
    const c = constantNumber(node);
    return c === null ? null : [c];
  }

  if (node.t !== 'bin') return null;
  if (node.op === '+' || node.op === '-') {
    return addPoly(
      polynomialCoefficients(node.l, variable),
      polynomialCoefficients(node.r, variable),
      node.op === '+' ? 1 : -1
    );
  }
  if (node.op === '*') {
    return mulPoly(
      polynomialCoefficients(node.l, variable),
      polynomialCoefficients(node.r, variable)
    );
  }
  if (node.op === '/') {
    const num = polynomialCoefficients(node.l, variable);
    const den = polynomialCoefficients(node.r, variable);
    if (!num || !den || den.length !== 1 || Math.abs(den[0]) <= EPS) return null;
    return scalePoly(num, 1 / den[0]);
  }
  if (node.op === '^') {
    const exponent = constantNumber(node.r);
    if (!Number.isInteger(exponent)) return null;
    return powPoly(polynomialCoefficients(node.l, variable), exponent);
  }
  return null;
}

function unknownNames(node, out = new Set()) {
  if (!node || typeof node !== 'object') return out;
  if (node.t === 'var' || node.t === 'const') {
    if (constantNumber(node) === null) out.add(node.v);
    return out;
  }
  for (const key of ['l', 'r', 'v', 'arg']) unknownNames(node[key], out);
  return out;
}

function proportionalPolynomials(a, b) {
  a = trimPoly(a);
  b = trimPoly(b);
  if (!a || !b || a.length !== b.length) return false;

  let pivot = -1;
  for (let i = 0; i < a.length; i++) {
    if (Math.abs(a[i]) > EPS || Math.abs(b[i]) > EPS) { pivot = i; break; }
  }
  // 0 = 0 is an identity, not an equation claim worth trusting.
  if (pivot < 0 || Math.abs(a[pivot]) <= EPS || Math.abs(b[pivot]) <= EPS) return false;

  const ratio = a[pivot] / b[pivot];
  if (!Number.isFinite(ratio) || Math.abs(ratio) <= EPS) return false;
  for (let i = 0; i < a.length; i++) {
    const want = ratio * b[i];
    if (Math.abs(a[i] - want) > 1e-8 * Math.max(1, Math.abs(a[i]), Math.abs(want))) return false;
  }
  return true;
}

/**
 * Deterministically prove that two one-variable polynomial equations express
 * the same claim up to multiplication by one non-zero scalar.
 *
 * This intentionally has no numerical-sampling fallback. If the expressions
 * are outside the proof vocabulary, the caller receives false and abstains.
 */
export function sameEquationClaim(a, b, variable = null) {
  if (!a || !b || a.t !== 'equation' || b.t !== 'equation') return false;
  const da = residual(a);
  const db = residual(b);
  const names = [...new Set([...unknownNames(da), ...unknownNames(db)])];
  const chosen = variable || (names.length === 1 ? names[0] : null);
  if (!chosen || names.some(name => name !== chosen)) return false;
  return proportionalPolynomials(
    polynomialCoefficients(da, chosen),
    polynomialCoefficients(db, chosen)
  );
}

// ── Polynomial certification ─────────────────────────────────────────────────
// A non-zero polynomial of degree d has at most d distinct real roots. If a
// candidate degree-d equation is satisfied by d distinct canonical solutions,
// the solution set is complete; no sampling assumption is needed.

function polynomialDegree(node, variable) {
  const poly = polynomialCoefficients(node, variable);
  return poly ? trimPoly(poly).length - 1 : null;
}

function residualLooksIdenticallyZero(eq, variable) {
  const poly = polynomialCoefficients(residual(eq), variable);
  if (!poly) return false;
  return trimPoly(poly).every(v => Math.abs(v) <= EPS);
}

function distinctNumbers(values) {
  const out = [];
  for (const v of values || []) {
    const n = Number(v);
    if (!Number.isFinite(n)) continue;
    if (!out.some(x => numsClose(x, n, 1e-7))) out.push(n);
  }
  return out;
}

function certifiedByFinitePolynomial(eq, meta) {
  const variable = meta?.variable;
  const sols = distinctNumbers(meta?.solutions);
  if (!variable || !sols.length) return false;
  if (residualLooksIdenticallyZero(eq, variable)) return false;
  const degree = polynomialDegree(residual(eq), variable);
  if (!Number.isInteger(degree) || degree < 1) return false;
  if (sols.length < degree) return false;
  return sols.every(sol => equationHoldsAt(eq, variable, sol));
}

// ── Positive counterevidence: definite extra roots ───────────────────────────
// Numerical scanning is used only to find a concrete counterexample. It can
// prove a candidate wrong, never prove it right.

function polynomialEquationDegree(eq, variable) {
  if (!eq || eq.t !== 'equation') return null;
  return polynomialDegree(residual(eq), variable);
}

function evalResidual(eq, variable, x) {
  try {
    const v = evaluate(residual(eq), { [variable]: x });
    return Number.isFinite(v) ? v : NaN;
  } catch { return NaN; }
}

function addRoot(out, x) {
  if (!Number.isFinite(x)) return;
  if (!out.some(r => Math.abs(r - x) <= 2e-5 * Math.max(1, Math.abs(r), Math.abs(x)))) out.push(x);
}

function scanRoots(eq, variable, lo, hi, step, limit = 12) {
  const out = [];
  let px = lo;
  let py = evalResidual(eq, variable, px);
  if (Number.isFinite(py) && Math.abs(py) < 1e-8) addRoot(out, px);

  for (let x = lo + step; x <= hi + 1e-9 && out.length < limit; x += step) {
    const y = evalResidual(eq, variable, x);
    if (Number.isFinite(y) && Math.abs(y) < 1e-8) addRoot(out, x);
    if (Number.isFinite(py) && Number.isFinite(y) && py * y < 0) {
      let a = px, b = x, fa = py;
      for (let i = 0; i < 55; i++) {
        const m = (a + b) / 2;
        const fm = evalResidual(eq, variable, m);
        if (!Number.isFinite(fm)) break;
        if (Math.abs(fm) < 1e-11) { a = b = m; break; }
        if (fa * fm <= 0) b = m;
        else { a = m; fa = fm; }
      }
      addRoot(out, (a + b) / 2);
    }
    px = x;
    py = y;
  }
  return out;
}

function definiteExtraRoot(eq, meta) {
  const variable = meta?.variable;
  const expected = distinctNumbers(meta?.solutions);
  if (!variable || !expected.length) return null;
  const degree = polynomialEquationDegree(eq, variable);
  if (!Number.isInteger(degree) || degree < 1 || degree > 8) return null;

  const roots = [
    ...scanRoots(eq, variable, -40, 40, 0.25),
    ...scanRoots(eq, variable, -2000, 2000, 2)
  ];
  return roots.find(root => !expected.some(sol => numsClose(root, sol, 2e-5))) ?? null;
}

function lostSolutionDiagnosis(variable, solution) {
  return {
    code: 'lost-solution',
    title: 'A valid solution was lost',
    message: `This step no longer works when ${variable} = ${solution}, even though that value solves the original problem.`,
    fix: 'Only use transformations that preserve every solution of the equation.',
    confidence: 'high'
  };
}

function extraSolutionDiagnosis(variable, root) {
  const shown = Number(root.toPrecision(8));
  return {
    code: 'extraneous-solution',
    title: 'This step introduces an extra solution',
    message: `${variable} = ${shown} satisfies this new line but is not a solution of the original equation. The transformation is not reversible.`,
    fix: 'Check the operation that changed the equation. Squaring, multiplying by an expression, or dropping a restriction can introduce extra solutions.',
    confidence: 'high'
  };
}

function droppedConstraintDiagnosis() {
  return {
    code: 'constraint-dropped',
    title: 'The equation lost its constraint',
    message: 'This line is true for every value, so it no longer carries the restriction from the equation above.',
    fix: 'A valid step must preserve the same solution set; do not replace the equation by an identity such as 0 = 0.',
    confidence: 'high'
  };
}

/** Assess one parsed equation line. */
export function assessEquationLine({ ast, previousAst = null, previousTrusted = false, meta = null } = {}) {
  if (!ast || ast.t !== 'equation') return { status: 'note', trusted: false, note: 'Skipped — this is not an equation.' };
  const variable = meta?.variable;
  const solutions = distinctNumbers(meta?.solutions);

  if (variable && solutions.length) {
    for (const sol of solutions) {
      if (!equationHoldsAt(ast, variable, sol)) {
        return {
          status: 'break', trusted: false,
          note: `This is the line where it goes wrong — ${variable} = ${sol} solves the original problem but no longer satisfies this equation.`,
          diagnosis: lostSolutionDiagnosis(variable, sol)
        };
      }
    }

    if (residualLooksIdenticallyZero(ast, variable)) {
      return { status: 'break', trusted: false, note: droppedConstraintDiagnosis().message, diagnosis: droppedConstraintDiagnosis() };
    }

    const extra = definiteExtraRoot(ast, meta);
    if (extra !== null) {
      const diagnosis = extraSolutionDiagnosis(variable, extra);
      return { status: 'break', trusted: false, note: diagnosis.message, diagnosis };
    }
  }

  if (meta?.source) {
    try {
      const source = parse(meta.source);
      if (source.t === 'equation' && sameEquationClaim(source, ast, variable)) return { status: 'ok', trusted: true };
    } catch { /* fall through */ }
  }

  if (previousAst && sameEquationClaim(previousAst, ast, variable)) {
    return previousTrusted
      ? { status: 'ok', trusted: true }
      : (certifiedByFinitePolynomial(ast, meta)
        ? { status: 'ok', trusted: true }
        : { status: 'note', trusted: false, note: 'This follows from the line above, but the starting equation was not independently verifiable.' });
  }

  if (certifiedByFinitePolynomial(ast, meta)) return { status: 'ok', trusted: true };

  return {
    status: 'note', trusted: false,
    note: 'The known answer still satisfies this line, but Pri cannot prove that this transformation preserves exactly the same solutions, so it is not marked correct.'
  };
}