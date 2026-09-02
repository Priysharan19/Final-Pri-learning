// Pri Learning · Class 10 generator overlay.
// The established bank is preserved byte-for-byte in india-class10-base.js.
// Only source-reviewed current-syllabus gaps are replaced here.
import { indiaClass10 as baseIndiaClass10 } from './india-class10-base.js';
import { currentPolynomialZeroes } from './india-class10-current-forms.js';

const basePolynomialZeroes = baseIndiaClass10['c10-polynomial-zeroes'];

function polynomialZeroes(rng, diff) {
  // D1–D2 cover the current outcome "find zeroes graphically and algebraically".
  // D3–D4 retain the established zeroes↔coefficients forms.
  return diff <= 2 ? currentPolynomialZeroes(rng, diff) : basePolynomialZeroes(rng, diff);
}

export const indiaClass10 = Object.freeze({
  ...baseIndiaClass10,
  'c10-polynomial-zeroes': polynomialZeroes
});
