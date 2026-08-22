/**
 * Pri Learning Mathematical Reasoning Engine V1
 *
 * Purpose:
 * Move beyond answer equality into step-aware validation.
 * This is intentionally deterministic and offline-first.
 */

export function analyseSteps(steps = []) {
  const results = steps.map((step, index) => ({
    step: index + 1,
    expression: step.expression ?? null,
    status: 'needs_validation',
    confidence: 0
  }));

  return {
    valid: results.every((r) => r.expression !== null),
    steps: results,
    misconceptions: detectMisconceptions(steps)
  };
}

function detectMisconceptions(steps) {
  const text = JSON.stringify(steps).toLowerCase();
  const issues = [];

  if (text.includes('divide by zero')) {
    issues.push('division_by_zero');
  }

  if (text.includes('cancel') && text.includes('term')) {
    issues.push('possible_invalid_cancellation');
  }

  return issues;
}

export default { analyseSteps };
