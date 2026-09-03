// Pri Learning · Class 10 generator overlay.
// The established bank is preserved byte-for-byte in india-class10-base.js.
// Only source-reviewed current-syllabus gaps are replaced here.
import { indiaClass10 as baseIndiaClass10 } from './india-class10-base.js';
import { currentPolynomialZeroes, currentTriangles } from './india-class10-current-forms.js';
import { currentIrrationalityProof } from './india-class10-irrationality.js';
import { currentLinearPairGraphs } from './india-class10-linear-graphs.js';
import { currentQuadraticContext } from './india-class10-quadratic-context.js';
import { currentSurfaceAreaCombination } from './india-class10-surface-combo.js';
import { currentClass10Trigonometry, currentClass10TrigApplications } from './india-class10-trigonometry.js';
import { currentLinearSolutionConditions, currentQuadraticDiscriminant, currentTrigBoundaryRelations } from './india-class10-production-gaps.js';

const basePolynomialZeroes = baseIndiaClass10['c10-polynomial-zeroes'];

function polynomialZeroes(rng, diff) {
  // D1–D2 cover the current outcome "find zeroes graphically and algebraically".
  // D3–D4 retain the established zeroes↔coefficients forms.
  return diff <= 2 ? currentPolynomialZeroes(rng, diff) : basePolynomialZeroes(rng, diff);
}

export const indiaClass10 = Object.freeze({
  ...baseIndiaClass10,
  'c10-polynomial-zeroes': polynomialZeroes,
  'c10-triangles-current': currentTriangles,
  'c10-irrationality-proofs': currentIrrationalityProof,
  'c10-linear-graphs': currentLinearPairGraphs,
  'c10-linear-solution-conditions': currentLinearSolutionConditions,
  'c10-quadratic-context': currentQuadraticContext,
  'c10-quadratic-discriminant': currentQuadraticDiscriminant,
  'c10-surface-area-combo': currentSurfaceAreaCombination,
  'c10-trigonometry-current': currentClass10Trigonometry,
  'c10-trig-boundary-relations': currentTrigBoundaryRelations,
  'c10-trig-applications-current': currentClass10TrigApplications
});
