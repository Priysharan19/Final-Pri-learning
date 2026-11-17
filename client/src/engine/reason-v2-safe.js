// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Pri Reason V2/V4 safety facade
//
// V2 certifies symbolic/rational transformations. V4 handles only the domain
// classes V2 deliberately left unsupported: nested rational quotients and simple
// log/root equalities whose complete low-degree real solution sets can be proved.
// Ordinary algebra keeps the established V1/V2 policy and stable diagnoses.
// ─────────────────────────────────────────────────────────────────────────────

import { parse, evaluate, numsClose } from './expr.js';
import {
  sameEquationClaim as sameEquationClaimV2,
  assessEquationLine as assessEquationLineV2,
  sameExpressionClaim,
  sameInverseFunctionClaim,
  parseRelation,
  sameRelationClaim,
  assessRelationLine,
  differentiateAst,
  assessDerivativeLine
} from './reason-v2.js';
import {
  sameEquationClaim as sameEquationClaimV1,
  assessEquationLine as assessEquationLineV1,
  assessNumericCheckLine
} from './reason.js';
import {
  compareDomainAwareEquationClaims,
  domainFunctionEquationSignature,
  domainSolutionDiagnosis,
  equationSolutionSet,
  relateSolutionSets,
  absCaseSets
} from './reason-v4.js';

function unwrap(node) {
  let out = node;
  while (out?.t === 'group') out = out.v;
  return out;
}

function containsVariable(node, variable = null) {
  node = unwrap(node);
  if (!node || typeof node !== 'object') return false;
  if (node.t === 'var' || node.t === 'const') {
    if (['pi', 'e', 'tau'].includes(node.v)) return false;
    return variable ? node.v === variable : true;
  }
  return ['l', 'r', 'v', 'arg'].some(k => containsVariable(node[k], variable));
}

/** True when a subtree contains division by something variable-dependent. */
function containsVariableDenominator(node, variable = null) {
  node = unwrap(node);
  if (!node || typeof node !== 'object') return false;
  if (node.t === 'bin' && node.op === '/' && containsVariable(node.r, variable)) return true;
  return ['l', 'r', 'v', 'arg'].some(k => containsVariableDenominator(node[k], variable));
}

/**
 * Quotient-of-rational-denominator hazard:
 *   A / (B / C(x))
 * V4 can certify this class when every relevant numerator, denominator and
 * exclusion is low-degree. Higher/unsupported forms still fall back to V1.
 */
export function hasNestedDomainHazard(node, variable = null) {
  node = unwrap(node);
  if (!node || typeof node !== 'object') return false;
  if (node.t === 'bin' && node.op === '/' && containsVariableDenominator(node.r, variable)) return true;
  return ['l', 'r', 'v', 'arg'].some(k => hasNestedDomainHazard(node[k], variable));
}

function equationHazard(a, b, variable = null) {
  return hasNestedDomainHazard(a, variable) || hasNestedDomainHazard(b, variable);
}

function domainFunctionClass(a, b, variable = null) {
  return !!domainFunctionEquationSignature(a, variable)
    || !!domainFunctionEquationSignature(b, variable);
}

function shouldUseV4(a, b, variable = null) {
  return equationHazard(a, b, variable) || domainFunctionClass(a, b, variable);
}

export function sameEquationClaim(a, b, variable = null) {
  if (shouldUseV4(a, b, variable)) {
    const v4 = compareDomainAwareEquationClaims(a, b, variable);
    if (v4.decidable) return v4.same;
    if (equationHazard(a, b, variable)) return sameEquationClaimV1(a, b, variable);
  }
  return sameEquationClaimV2(a, b, variable);
}

function exactDomainComparison(a, b, variable = null) {
  if (!shouldUseV4(a, b, variable)) return null;
  const comparison = compareDomainAwareEquationClaims(a, b, variable);
  if (!comparison.decidable) return null;
  if (comparison.same) return { status: 'ok', trusted: true };
  const diagnosis = domainSolutionDiagnosis(comparison);
  return { status: 'break', trusted: false, note: diagnosis.message, diagnosis };
}


// ── Absolute-value equations, by solution set ────────────────────────────────
// Where the complete real solution set of a line and of the line above can be
// found exactly (reason-v4 equationSolutionSet), a step is judged on the sets:
// the same set is valid; a larger set is an IMPLIED step (every solution kept,
// a root added: squaring, clearing a denominator) and is credited with a note;
// a smaller or different set is a break, except that dropping to exactly the
// question's own answer is rejecting an extraneous root, which is valid; and
// from an empty set to a non-empty one is a break unless every new value makes
// the line above undefined (the usual extraneous root). Mirrors the benchmark's
// SymPy rules. Anything the sets cannot decide falls through unchanged.
function usesCoveredClass(node, variable = null) {
  // Absolute value only. Rational equations keep their established policy
  // (restoring a root a denominator excluded is a break, and a starting
  // rational line stays unproved), and a starting radical line stays an
  // abstention (pri-reason-check #7); both are still judged on their LAST line
  // by the incomplete flag.
  node = unwrap(node);
  if (!node || typeof node !== 'object') return false;
  if (node.t === 'call' && node.fn === 'abs') return containsVariable(node.arg, variable);
  return ['l', 'r', 'v', 'arg'].some(k => usesCoveredClass(node[k], variable));
}
function wantedSolutions(meta) {
  if (!Array.isArray(meta?.solutions)) return null;
  const out = [];
  for (const s of meta.solutions) {
    const v = typeof s === 'number' ? s : (() => { try { return evaluate(parse(String(s)), {}); } catch { return NaN; } })();
    if (!Number.isFinite(v)) return null;
    out.push(v);
  }
  return out;
}
function undefinedAt(eq, variable, x) {
  try {
    const env = { [variable]: x };
    return !Number.isFinite(evaluate(eq.l, env)) || !Number.isFinite(evaluate(eq.r, env));
  } catch { return true; }
}
const listRoots = roots => roots.map(r => Number(r.toPrecision(8))).join(', ');
function assessBySolutionSet({ ast, previousAst, previousTrusted, meta, variable, anchorAst = null }) {
  if (!ast || ast.t !== 'equation' || !variable) return null;
  if (!usesCoveredClass(ast, variable) && !(previousAst && usesCoveredClass(previousAst, variable))) return null;
  const cur = equationSolutionSet(ast, variable);
  if (!cur || cur.kind !== 'finite') return null;
  const wanted = wantedSolutions(meta);
  const answer = wanted ? { kind: 'finite', variable, roots: wanted } : null;
  if (previousTrusted && previousAst?.t === 'equation') {
    const prev = equationSolutionSet(previousAst, variable);
    const rel = prev && prev.kind === 'finite' ? relateSolutionSets(prev, cur) : null;
    if (rel === 'same') return { status: 'ok', trusted: true };
    if (rel === 'superset') {
      const added = cur.roots.filter(x => !prev.roots.some(y => numsClose(x, y, 1e-7)));
      if (prev.roots.length === 0 && !added.every(x => undefinedAt(previousAst, variable, x))) {
        const diagnosis = domainSolutionDiagnosis({ variable, a: prev, b: cur });
        return { status: 'break', trusted: false, note: diagnosis.message, diagnosis };
      }
      return { status: 'ok', trusted: true, implied: true, note: `True of every solution above, and it also allows ${variable} = ${listRoots(added)}, which the line above does not — check each value against the question.` };
    }
    // One case of the absolute value (Q = P or -Q = P) is a branch: valid to
    // write down whatever its sign condition then decides.
    if (rel === 'subset' || rel === 'different') {
      const cases = absCaseSets(previousAst, variable) || (anchorAst ? absCaseSets(anchorAst, variable) : null);
      // The line must BE a case equation (rearranged, scaled), not merely share its roots.
      const branch = cases && cases.find(c => relateSolutionSets(c, cur) === 'same' && sameEquationClaim(ast, c.equation, variable));
      if (branch) return { status: 'ok', trusted: true, implied: true, note: `This is one case of the absolute value (${variable} = ${listRoots(cur.roots) || 'no value'}); check it against its own condition.` };
    }
    if (rel === 'subset' || rel === 'different') {
      if (rel === 'subset' && answer && relateSolutionSets(answer, cur) === 'same') return { status: 'ok', trusted: true };
      const diagnosis = domainSolutionDiagnosis({ variable, a: prev, b: cur });
      return { status: 'break', trusted: false, note: diagnosis.message, diagnosis };
    }
    return null;
  }
  // No verified line above: the line stands only if its complete solution set is exactly the question's.
  if (answer && relateSolutionSets(answer, cur) === 'same') return { status: 'ok', trusted: true };
  return null;
}

export function assessEquationLine({ ast, previousAst = null, previousTrusted = false, meta = null, anchorAst = null } = {}) {
  // A line with no unknown left in it is a check of the answer, whichever
  // reasoner would otherwise own it.
  const numericCheck = assessNumericCheckLine(ast, { previousAst, meta });
  if (numericCheck) return numericCheck;

  const variable = meta?.variable || null;
  let source = null;
  if (meta?.source) {
    try { source = parse(meta.source); } catch { source = null; }
  }

  if (source?.t === 'equation' && ast?.t === 'equation') {
    const assessed = exactDomainComparison(source, ast, variable);
    if (assessed) return assessed;
  }
  if (previousTrusted && previousAst?.t === 'equation' && ast?.t === 'equation') {
    const assessed = exactDomainComparison(previousAst, ast, variable);
    if (assessed) return assessed;
  }

  const bySet = assessBySolutionSet({ ast, previousAst, previousTrusted, meta, variable: variable || meta?.variable || null, anchorAst });
  if (bySet) return bySet;

  if (hasNestedDomainHazard(ast, variable)
      || hasNestedDomainHazard(previousAst, variable)
      || hasNestedDomainHazard(source, variable)) {
    return assessEquationLineV1({ ast, previousAst, previousTrusted, meta });
  }
  return assessEquationLineV2({ ast, previousAst, previousTrusted, meta });
}

export {
  sameExpressionClaim,
  sameInverseFunctionClaim,
  parseRelation,
  sameRelationClaim,
  assessRelationLine,
  differentiateAst,
  assessDerivativeLine
};
