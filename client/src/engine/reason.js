// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Pri Reason — conservative equation-transformation verifier
//
// Step Check already knows the canonical solution(s) to many generated
// questions. That is useful evidence, but it is not enough to prove that an
// intermediate equation is a valid transformation: an equation can keep every
// correct solution while adding new ones. For example, if x = 5 is correct,
// `(x - 5)(x - 100) = 0` is still true at x = 5 but is not equivalent.
//
// Pri Reason therefore separates three outcomes:
//   ok    — the transformation is positively verified;
//   break — it is positively disproved (lost/added solutions, etc.);
//   note  — the known answer survives but reversibility cannot be proved.
//
// The design is intentionally precision-first. An uncertain line is never
// promoted to "correct" just to make the UI look confident.
// ─────────────────────────────────────────────────────────────────────────────

import { parse, evaluate, exprEquivalent, variablesOf, numsClose } from './expr.js';

const SAMPLE = [0.73, 1.31, -0.64, 2.17, -1.72, 0.37, 3.08, -2.29, 4.61, -4.13];
const EPS = 1e-7;

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

/**
 * Strong algebraic proof for ordinary rearrangements: two equation residuals
 * are equivalent up to one non-zero constant factor.
 */
export function sameEquationClaim(a, b) {
  if (!a || !b || a.t !== 'equation' || b.t !== 'equation') return false;
  const da = residual(a);
  const db = residual(b);
  if (exprEquivalent(da, db)) return true;

  const names = [...new Set([...variablesOf(da), ...variablesOf(db)])];
  let ratio = null;
  let seen = 0;
  for (let s = 0; s < SAMPLE.length; s++) {
    const env = {};
    names.forEach((name, i) => { env[name] = SAMPLE[(s + i * 3) % SAMPLE.length]; });
    const va = evaluate(da, env);
    const vb = evaluate(db, env);
    if (!Number.isFinite(va) || !Number.isFinite(vb)) continue;
    if (Math.abs(vb) < 1e-9) {
      if (Math.abs(va) > EPS) return false;
      continue;
    }
    const r = va / vb;
    if (!Number.isFinite(r) || Math.abs(r) < 1e-10) return false;
    if (ratio === null) ratio = r;
    else if (Math.abs(r - ratio) > 1e-6 * Math.max(1, Math.abs(ratio))) return false;
    seen++;
  }
  return seen >= 3 && ratio !== null;
}

// ── Polynomial certification ─────────────────────────────────────────────────
// A non-zero polynomial of degree d has at most d distinct real roots. If a
// candidate degree-d equation is satisfied by d distinct canonical solutions,
// the solution set is therefore complete; no sampling assumption is needed.

function polynomialDegree(node, variable) {
  if (!node || typeof node !== 'object') return null;
  switch (node.t) {
    case 'num': return 0;
    case 'group': return polynomialDegree(node.v, variable);
    case 'neg': return polynomialDegree(node.v, variable);
    case 'var': return node.v === variable ? 1 : null;
    case 'const': return node.v === variable ? 1 : null;
    case 'call': return null;
    case 'bin': {
      const dl = polynomialDegree(node.l, variable);
      const dr = polynomialDegree(node.r, variable);
      if (node.op === '+' || node.op === '-') return dl === null || dr === null ? null : Math.max(dl, dr);
      if (node.op === '*') return dl === null || dr === null ? null : dl + dr;
      if (node.op === '/') return dl === null || dr !== 0 ? null : dl;
      if (node.op === '^') {
        if (dl === null || node.r?.t !== 'num' || !Number.isInteger(node.r.v) || node.r.v < 0 || node.r.v > 8) return null;
        return dl * node.r.v;
      }
      return null;
    }
    default: return null;
  }
}

function residualLooksIdenticallyZero(eq, variable) {
  const d = residual(eq);
  let seen = 0;
  for (const x of SAMPLE) {
    const v = evaluate(d, { [variable]: x });
    if (!Number.isFinite(v)) continue;
    seen++;
    if (Math.abs(v) > EPS * Math.max(1, Math.abs(x))) return false;
  }
  return seen >= 4;
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
// We never use this numerical scan to *prove* a line correct. It is only a way
// to find a concrete extra root and prove a line wrong. The scan is restricted
// to polynomial equations, avoiding discontinuity-as-root mistakes.

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

/**
 * Assess one parsed equation line. `previousAst` is the previous readable
 * equation, while `previousTrusted` says whether Pri positively verified it.
 */
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

  // An authored source is the strongest possible local reference.
  if (meta?.source) {
    try {
      const source = parse(meta.source);
      if (source.t === 'equation' && sameEquationClaim(source, ast)) return { status: 'ok', trusted: true };
    } catch { /* fall through to other proofs */ }
  }

  // Ordinary school rearrangements reduce to the same residual up to scale.
  if (previousAst && sameEquationClaim(previousAst, ast)) {
    return previousTrusted
      ? { status: 'ok', trusted: true }
      : (certifiedByFinitePolynomial(ast, meta)
        ? { status: 'ok', trusted: true }
        : { status: 'note', trusted: false, note: 'This follows from the line above, but the starting equation was not independently verifiable.' });
  }

  // A finite polynomial can sometimes be proved directly from the canonical
  // solution set without trusting the previous line.
  if (certifiedByFinitePolynomial(ast, meta)) return { status: 'ok', trusted: true };

  // No proof and no counterexample: abstain. This is a deliberate product
  // state, not a parser failure.
  return {
    status: 'note', trusted: false,
    note: 'The known answer still satisfies this line, but Pri cannot prove that this transformation preserves exactly the same solutions, so it is not marked correct.'
  };
}
