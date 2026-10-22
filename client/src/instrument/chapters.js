// Pri Learning · v1.1 instrument interface — chapter identity.
//
// Each chapter of the student's syllabus gets a muted print colour (eight,
// assigned in syllabus order and repeated). Nothing here reads or changes
// marks: it is identity only.

export const CHAPTER_COLOURS = ['--in-c2', '--in-c5', '--in-c1', '--in-c4', '--in-c3', '--in-c6', '--in-c7', '--in-c8'];

export const colourFor = index => CHAPTER_COLOURS[((index % CHAPTER_COLOURS.length) + CHAPTER_COLOURS.length) % CHAPTER_COLOURS.length];

/**
 * What the Index may say about a chapter, from the evidence the server gave.
 * Accuracy is only stated over enough answers (the same floor Progress uses),
 * so the Index never says "100%" about one right answer.
 */
export function chapterEvidence(row, accuracyClaim, floor) {
  const attempts = Number(row?.attempts || row?.evidence?.attempts || 0);
  const correct = Number(row?.correct || row?.evidence?.correct || 0);
  const claim = accuracyClaim(correct, attempts, floor);
  // The ring shows mastery only where accuracy may be stated, so it never
  // implies a level the floor withholds.
  const mastery = claim.enough ? Math.max(0, Math.min(100, Number(row?.mastery || 0))) : 0;
  return { attempts, correct, accuracy: claim.enough ? claim.value : null, mastery };
}

/** The student's own syllabus within /curriculum: their CBSE class, or their JEE stream. */
export function scopeFor(curriculum, user) {
  if (!curriculum || !user) return null;
  const track = user.indiaTrack || (isIndian(user) ? 'cbse' : null);
  if (!track || track === 'cbse') return (curriculum.years || []).find(s => Number(s.year) === Number(user.year)) || null;
  return (curriculum.streams || []).find(s => s.track === track && (s.year == null || Number(s.year) === Number(user.year)))
    || (curriculum.streams || []).find(s => s.track === track)
    || null;
}

/** The track a practice link carries: an Indian track, or none outside India. */
export const practiceTrack = user => user?.indiaTrack || (isIndian(user) ? 'cbse' : null);

function isIndian(user) { return user?.course === 'in' || user?.country === 'in'; }
