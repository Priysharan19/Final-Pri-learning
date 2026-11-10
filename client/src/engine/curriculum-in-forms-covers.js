// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · India coverage — additional question forms per dot point
//
// The coverage report counts how many dot points a generator reaches; it does
// not count how many different QUESTIONS a student meets there. Several Class X
// Algebra dot points were reached by one or two question shapes. The generators
// named here add further shapes at the CBSE rungs D1–D3, and each entry claims
// exactly the dot point its generator writes for (the generator's own
// blueprint says the same, and client/test/india-class10-algebra-forms-check.mjs
// fails if the two ever disagree).
//
// Appended after every other cover table, through the same installer as the
// hardest-level forms: an entry naming a dot point the chapter does not have,
// or a generator the chapter already lists, is a load-time error. Nothing an
// earlier table claimed is removed or re-labelled, and no review state changes —
// authoring a generator is not a source review.
// ─────────────────────────────────────────────────────────────────────────────

const CBSE = [1, 2, 3];
const c = (gen, dp, diff = CBSE) => ({ gen, dp: [...dp], diff: [...diff] });

export const INDIA_FORMS_COVERS = Object.freeze({
  'c10-arithmetic-progressions': [c('c10-ap-term-forms', [0]), c('c10-ap-sum-forms', [1])],
  'c10-polynomials': [c('c10-zero-coefficient-forms', [1])],
  'c10-quadratic-equations': [c('c10-quadratic-k-forms', [2])],
  'c10-pair-linear-equations': [c('c10-linear-condition-forms', [1])]
});
