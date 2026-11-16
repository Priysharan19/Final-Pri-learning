// Isolated original Class X competency bank.
// Loaded on demand: old Class X question paths and their installed bytes stay
// unchanged until a student selects one of these new CBSE D3 skills.
// The families themselves retain source/authorisation metadata in the separate
// curriculum-in-competency-covers.js overlay (human mathematics review pending).
import {
  competencyInverseApRows,
  competencyTicketSystem,
  competencyTriangleArea
} from './india-class10-competency-2026.js';

export const indiaClass10Competency = Object.freeze({
  'c10-ap-inverse-competency': competencyInverseApRows,
  'c10-linear-ticket-competency': competencyTicketSystem,
  'c10-quadratic-triangle-competency': competencyTriangleArea
});
