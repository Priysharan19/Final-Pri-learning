/**
 * Pri Learning Adaptive Intelligence V1
 *
 * Offline deterministic mastery model foundation.
 */

export function updateMastery(current, evidence) {
  const score = Math.max(0, Math.min(1, evidence.score ?? 0));
  const attempts = Math.max(1, evidence.attempts ?? 1);

  const improvement = (score * 0.7) + (Math.min(attempts, 10) / 10 * 0.3);

  return {
    mastery: Math.round(((current ?? 0) * 0.7 + improvement * 0.3) * 100) / 100,
    confidence: Math.min(1, attempts / 10),
    recommendation: recommendNext(score)
  };
}

function recommendNext(score) {
  if (score < 0.5) return 'reteach_foundation';
  if (score < 0.8) return 'target_misconception';
  return 'increase_complexity';
}
