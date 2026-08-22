/**
 * Pri Ink Structure Parser V2 foundation.
 *
 * Converts recognised ink tokens into a mathematical structure graph.
 * Recognition confidence must remain explicit; no silent guessing.
 */

export function parseMathStructure(tokens = []) {
  return {
    type: detectType(tokens),
    tokens,
    confidence: calculateConfidence(tokens),
    requiresConfirmation: calculateConfidence(tokens) < 0.8
  };
}

function detectType(tokens) {
  const joined = tokens.map(t => t.value).join('');

  if (joined.includes('/')) return 'fraction_candidate';
  if (joined.includes('=')) return 'equation_candidate';
  return 'expression_candidate';
}

function calculateConfidence(tokens) {
  if (!tokens.length) return 0;
  return tokens.reduce((sum, token) => sum + (token.confidence ?? 0), 0) / tokens.length;
}
