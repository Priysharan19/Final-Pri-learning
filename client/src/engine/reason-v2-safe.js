// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Pri Reason V2 safety facade
//
// The V2 rational normaliser certifies many low-degree rational equations by
// carrying numerator/denominator polynomials. A quotient whose *divisor itself*
// contains a variable-dependent denominator has an additional domain exclusion
// that moves into the numerator when inverted (for example 1/(1/x)). Until V3
// represents domain constraints as first-class proof objects, this facade blocks
// that proof class completely. Precision beats coverage: dangerous nested
// quotients abstain and fall back to V1 rather than receiving a false OK.
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
 * The C(x) != 0 restriction belongs to the original expression but becomes a
 * numerator factor after inversion. The current finite-rational normaliser does
 * not yet retain that independent exclusion set, so this proof must abstain.
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

export function sameEquationClaim(a, b, variable = null) {
  if (equationHazard(a, b, variable)) return sameEquationClaimV1(a, b, variable);
  return sameEquationClaimV2(a, b, variable);
}

export function assessEquationLine({ ast, previousAst = null, previousTrusted = false, meta = null } = {}) {
  const variable = meta?.variable || null;
  let source = null;
  if (meta?.source) {
    try { source = parse(meta.source); } catch { source = null; }
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
