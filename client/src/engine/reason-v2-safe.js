// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Pri Reason V2/V4 safety facade
//
// V2 certifies symbolic/rational transformations. V4 handles only the domain
// classes V2 deliberately left unsupported: nested rational quotients and simple
// log/root equalities whose complete low-degree real solution sets can be proved.
// Ordinary algebra keeps the established V1/V2 policy and stable diagnoses.
// ─────────────────────────────────────────────────────────────────────────────

import { parse } from './expr.js';
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
  assessEquationLine as assessEquationLineV1
} from './reason.js';
import {
  compareDomainAwareEquationClaims,
  domainFunctionEquationSignature,
  domainSolutionDiagnosis
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

export function assessEquationLine({ ast, previousAst = null, previousTrusted = false, meta = null } = {}) {
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
