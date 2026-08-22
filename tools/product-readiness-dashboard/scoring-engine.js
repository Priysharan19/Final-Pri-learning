// Pri Learning Product Readiness Scoring Engine
// Scores are calculated from evidence objects, never manually assigned.

export function calculateScore(evidence) {
  const items = Object.values(evidence);
  const passed = items.filter(item => item.passed === item.required).length;
  const total = items.length;
  return total === 0 ? 0 : Number(((passed / total) * 100).toFixed(2));
}

export function calculateDimension(dimension) {
  const evidence = Object.values(dimension.evidence || {});
  const earned = evidence.reduce((sum, item) => sum + item.value * item.weight, 0);
  const possible = evidence.reduce((sum, item) => sum + item.max * item.weight, 0);
  return possible === 0 ? 0 : Number(((earned / possible) * 100).toFixed(2));
}

export function calculateOverall(dimensions) {
  const scores = Object.values(dimensions);
  return Number((scores.reduce((a,b)=>a+b,0) / scores.length).toFixed(2));
}
