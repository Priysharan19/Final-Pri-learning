// Pri Learning · which living formulas sit in which India chapter's notes (chapter id → spec ids).
// Placed only where the chapter teaches that curve; the normal distribution is absent because the
// India syllabus in this app does not teach it. Imported by the India notes page only.
export const LIVING_IN = Object.freeze({
  'c10-quadratic-equations': ['quadratic', 'vertex'],
  'c10-pair-linear-equations': ['line'],
  'c11-straight-lines': ['line'],
  'c11-trig-functions': ['sine'],
  'c11-relations-functions': ['absolute'],
  'c11-conic-sections': ['circle'],
  'c12-continuity-differentiability': ['exponential', 'logarithm']
});
export const livingIdsIn = chapterId => LIVING_IN[chapterId] || [];
