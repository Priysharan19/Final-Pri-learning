// PRI Learning Product Readiness Evidence Collectors
// Evidence only. Missing evidence intentionally remains incomplete.

export function calculateScore(items) {
  const total = items.reduce((sum, item) => sum + item.max, 0);
  const earned = items.reduce((sum, item) => sum + item.value, 0);
  return total === 0 ? 0 : Number(((earned / total) * 100).toFixed(2));
}

export function createDimension(name, evidence) {
  return {
    name,
    score: calculateScore(evidence),
    evidence,
    status: evidence.every((item) => item.value >= item.max) ? 'complete' : 'incomplete'
  };
}

export function buildReadinessReport(dimensions) {
  const allEvidence = dimensions.flatMap((dimension) => dimension.evidence);
  return {
    generatedAt: new Date().toISOString(),
    overall: calculateScore(allEvidence),
    dimensions
  };
}
