// Additional original Class X competency practice, 2026–27.
// This is NOT part of the previously agent-audited NCERT source mapping.
// New authored forms carry their own provenance and are appended after native
// cover replacement; they need independent mathematical review before launch.
export const CBSE_CLASS10_ORIGINAL_COMPETENCY_PROVENANCE = Object.freeze({
  sourceAuthority: 'CBSE Secondary Mathematics X 2026–27 syllabus',
  sourceVersion: 'CBSE-2026-27',
  origin: 'original-parameterised',
  rightsStatus: 'original',
  mathReviewStatus: 'pending-independent',
  humanMathApproved: false,
  boardApproved: false
});

const form = (gen, dp) => Object.freeze({
  gen,
  dp: Object.freeze([dp]),
  diff: Object.freeze([3])
});

export const CBSE_CLASS10_ORIGINAL_COMPETENCY_COVERS = Object.freeze({
  'c10-pair-linear-equations': Object.freeze([form('c10-linear-ticket-competency', 3)]),
  'c10-quadratic-equations': Object.freeze([form('c10-quadratic-triangle-competency', 3)]),
  'c10-arithmetic-progressions': Object.freeze([form('c10-ap-inverse-competency', 2)])
});
