// Deterministic readiness calculator.
// Missing evidence contributes zero, never an assumed pass.

export function calculateReadiness(evidence = []) {
  const total = evidence.reduce((sum, item) => sum + (item.max ?? 1), 0);
  const passed = evidence.reduce((sum, item) => sum + (item.passed ? (item.max ?? 1) : 0), 0);

  return {
    passed,
    total,
    percentage: total === 0 ? 0 : Number(((passed / total) * 100).toFixed(2))
  };
}
