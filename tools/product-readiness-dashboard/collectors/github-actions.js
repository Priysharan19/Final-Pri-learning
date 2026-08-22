// Evidence collector for engineering reliability.
// Produces evidence objects only; scoring happens elsewhere.

export function collectGithubActionsEvidence(runs = []) {
  const total = runs.length;
  const passed = runs.filter((run) => run.status === 'success').length;

  return {
    id: 'engineering.github_actions',
    category: 'engineering_reliability',
    evidence: {
      passed,
      total,
      status: total > 0 ? 'measured' : 'missing'
    }
  };
}
