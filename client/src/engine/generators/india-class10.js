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
// The three outcomes that were still served by an NSW Year 8/Year 10 generator.
import { indiaClass10Core } from './india-class10-core.js';
// Hardest-level (D3) forms, tranche 1 — see curriculum-in-hardest-covers.js.
import { class10HardestForms } from './india-class10-hardest.js';
import {
  competencyInverseApRows,
  competencyTicketSystem,
  competencyTriangleArea
} from './india-class10-competency-2026.js';

const basePolynomialZeroes = baseIndiaClass10['c10-polynomial-zeroes'];

// Add original Class X scenario families at D4 only. The previous forms stay
// reachable and the established lower difficulties remain unchanged.
// A change to these outputs requires the canonical content-version/digest
// reconciliation by the current L1/L5 owner before integration into main.
const extraD4 = (existing, extra) => (rng, difficulty) =>
  difficulty === 4 && rng() < 0.5 ? extra(rng) : existing(rng, difficulty);
const class10Ap = extraD4(baseIndiaClass10['c10-arithmetic-progressions'], competencyInverseApRows);
const class10Pair = extraD4(indiaClass10Core['c10-linear-pair-methods'], competencyTicketSystem);
const class10QuadraticContext = extraD4(currentQuadraticContext, competencyTriangleArea);

function polynomialZeroes(rng, diff) {
  // D1–D2 cover the current outcome "find zeroes graphically and algebraically".
  // D3–D4 retain the established zeroes↔coefficients forms.
  return diff <= 2 ? currentPolynomialZeroes(rng, diff) : basePolynomialZeroes(rng, diff);
}

export const indiaClass10 = Object.freeze({
  ...baseIndiaClass10,
  ...indiaClass10Core,
  'c10-arithmetic-progressions': class10Ap,
  'c10-linear-pair-methods': class10Pair,
  'c10-polynomial-zeroes': polynomialZeroes,
  'c10-triangles-current': currentTriangles,
  'c10-irrationality-proofs': currentIrrationalityProof,
  'c10-linear-graphs': currentLinearPairGraphs,
  'c10-linear-solution-conditions': currentLinearSolutionConditions,
  'c10-quadratic-context': class10QuadraticContext,
  'c10-quadratic-discriminant': currentQuadraticDiscriminant,
  'c10-surface-area-combo': currentSurfaceAreaCombination,
  'c10-trigonometry-current': currentClass10Trigonometry,
  'c10-trig-boundary-relations': currentTrigBoundaryRelations,
  'c10-trig-applications-current': currentClass10TrigApplications,
  ...class10HardestForms
});
