/**
 * Pri Learning / original Class IX 2026-27 gap studies.
 * DRAFT AUTHORING REGISTRY — not currently imported in live Notes or Practice.
 * This manifest is for a future authorised Notes/study-only integration.
 *
 * IMPORTANT: These modules contain explanatory worked solutions, so they may
 * only be used in a reveal-based study experience. Never import as client
 * answer/rubric authority for graded, server-issued student assessments.
 */
export const CLASS9_GAP_STUDIES = Object.freeze([
 { id: 'linear-equations-two-variables', title: 'Linear Equations in Two Variables', competencies:['C-3.2','C-8.1','C-9.1'], loader:()=>import('./class9-2026-27-gap-study-pack.js').then(m=>m.class9Linear202627) },
 { id: 'triangles-congruence', title: 'Triangles — Congruence Theorems', competencies:['C-4.1','C-7.3'], loader:()=>import('./class9-2026-27-congruence-studies.js').then(m=>m.class9Congruence202627) },
 { id: 'statistics', title: 'Statistics', competencies:['C-6.1'], loader:()=>import('./class9-2026-27-statistics-studies.js').then(m=>m.class9Statistics202627) },
 { id: 'surface-area-volume', title: 'Surface Area and Volume', competencies:['C-5.2'], loader:()=>import('./class9-2026-27-solid-measure-studies.js').then(m=>m.class9SolidMeasure202627) },
 { id: 'euclid-geometry', title: "Introduction to Euclid's Geometry", competencies:['C-7.1','C-7.3'], loader:()=>import('./class9-2026-27-euclid-studies.js').then(m=>m.class9Euclid202627) },
 { id: 'lines-angles', title: 'Lines and Angles', competencies:['C-7.1','C-7.3'], loader:()=>import('./class9-2026-27-lines-angles-studies.js').then(m=>m.class9LinesAngles202627) },
 { id: 'quadrilaterals', title: '4-gons (Quadrilaterals)', competencies:['C-4.2','C-7.3'], loader:()=>import('./class9-2026-27-quadrilaterals-studies.js').then(m=>m.class9Quadrilaterals202627) }
]);
export const CLASS9_GAP_STUDY_STATUS = 'source-only-unwired-review-pending';
export async function loadClass9GapStudy(chapterId) {
 const row = CLASS9_GAP_STUDIES.find(chapter=>chapter.id===chapterId);
 if (!row) throw new RangeError('Unrecognised CBSE IX study-only chapter');
 const pack = await row.loader();
 if (!pack || !Array.isArray(pack.questions) || !Array.isArray(pack.workedExamples)) {
   throw new TypeError('Invalid CBSE IX study pack contract');
 }
 return pack;
}
