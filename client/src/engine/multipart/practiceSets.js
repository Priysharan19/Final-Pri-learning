// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · generated multi-part practice sets (Prithagoras, NSW Years 11-12)
//
// "Exam-style practice set N": multi-part questions made by tools/build-multipart-papers.mjs
// from the engine's sets (client/src/engine/multipart/sets-nsw.js) and served by the same
// paper surface as the owner's Extension 1 papers (server/content/papers/nsw-practice/).
// They are generated practice: not the owner's authored papers, not HSC or NESA papers.
// This file is plain data shared by the page and the server: which practice chapter
// offers which set (by syllabus outcome), and who is offered them.
// ─────────────────────────────────────────────────────────────────────────────

/** Practice chapter -> the syllabus outcomes whose parts it offers (NESA outcome codes, written out here; this file imports nothing). */
export const PRACTICE_SET_SUBTOPICS = Object.freeze({
  'y11-trigfunc': ['MAV-11-04'],
  'y11-trig-ident': ['MAV-11-05'],
  'y11-explog': ['MAV-11-07'],
  'y11-explog-more': ['MAV-11-08'],
  'y12-appdiff': ['MAV-12-06'],
  'y12-motion': ['MAV-12-06'],
  'y12-explogcalc': ['MAV-12-04', 'MAV-12-06'],
  'y12-integration': ['MAV-12-05'],
  'y12-integral-calc': ['MAV-12-05'],
  'me12-vectors': ['ME1-12-02']
});

/** The chapters of the practice page that show the practice sets. */
export const PRACTICE_SET_CHAPTERS = Object.freeze(Object.keys(PRACTICE_SET_SUBTOPICS));

/** Year 11-12 on an NSW pathway that studies these topics (not Standard). Free: the server decides, never this. */
export function practiceSetsFor(user) {
  return !!user && user.course === 'nsw' && Number(user.year) >= 11 && ['advanced', 'ext1', 'ext2'].includes(user.pathway);
}
