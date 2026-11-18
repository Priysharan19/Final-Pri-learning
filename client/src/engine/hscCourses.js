// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · which HSC examinations the priorities view covers for a student
//
// Tiny and dependency-free on purpose: pages decide whether to offer the HSC
// 2027 priorities from this file, without loading the priorities engine or its
// NESA metadata (engine/hsc/, its own on-demand chunk).
//
// Prithagoras only: a student on the India course gets nothing here. Advanced
// students sit Advanced; Extension 1 students sit Advanced and Extension 1;
// Extension 2 students sit Extension 1 (and Extension 2, which the engine does
// not cover). Standard and Years 7–10 have none.
// ─────────────────────────────────────────────────────────────────────────────

export function hscCoursesFor(user) {
  if (!user || user.course !== 'nsw' || !(Number(user.year) >= 11)) return [];
  const pw = user.pathway || 'advanced';
  if (pw === 'advanced') return ['advanced'];
  if (pw === 'ext1') return ['advanced', 'extension1'];
  if (pw === 'ext2') return ['extension1'];
  return [];
}
